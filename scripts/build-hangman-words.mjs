/* ===================== HANGMAN WORD BANK GENERATOR =====================

   Regenerates src/data/hangmanWords.js. Run it by hand, commit the result:

     node scripts/build-hangman-words.mjs           # rewrite the data file
     node scripts/build-hangman-words.mjs --dry     # print stats, write nothing

   Nothing here ships to the browser. The dictionaries are devDependencies and
   the only thing the site ever loads is the generated file, so the project
   keeps its "no runtime dependencies" rule.

   WHY IT IS NOT JUST A FREQUENCY CUTOFF
   The hand-written banks this replaces were all concrete nouns -- anchor,
   antler, apron, attic. That is what makes hangman guessable. The most common
   English words are nothing of the sort ("about", "accept", "account"), so
   ranking by frequency alone produces a bank that plays much worse than the
   one it replaces. WordNet groups every noun into a lexicographer category, so
   we take the physical ones and use frequency only to sort the survivors into
   difficulties.                                                            */

import { readFileSync, writeFileSync } from 'fs';
import wordnet from 'wordnet-db';
import english from 'wordlist-english';
import naughty from 'naughty-words';

const OUT = new URL('../src/data/hangmanWords.js', import.meta.url);
const DRY = process.argv.includes('--dry');

/* ---------------------------------------------------------------- sources */

/* WordNet lexicographer files holding things you can point at. The numbers are
   fixed by WordNet itself and listed in its lexnames file. */
const CONCRETE = new Map([
  [5, 'animal'], [6, 'artifact'], [8, 'body'], [13, 'food'],
  [17, 'object'], [20, 'plant'], [27, 'substance'],
]);

/* data.noun: "offset lexFile ss_type wordCount word lexId word lexId ... | gloss"
   Multi-word lemmas are joined with underscores, so the a-z test drops them
   along with proper nouns, hyphenations and anything with a digit. */
const nouns = new Map();                       // word -> category
for (const line of readFileSync(wordnet.path + '/data.noun', 'utf8').split('\n')) {
  if (!line || line.startsWith('  ')) continue;            // licence header
  const [meta] = line.split(' | ');
  const parts = meta.split(' ');
  const lexFile = Number(parts[1]);
  if (!CONCRETE.has(lexFile)) continue;
  const count = parseInt(parts[3], 16);
  for (let i = 0; i < count; i++) {
    const word = parts[4 + i * 2];
    if (/^[a-z]{3,9}$/.test(word) && !nouns.has(word)) {
      nouns.set(word, CONCRETE.get(lexFile));
    }
  }
}

/* Every noun lemma WordNet knows, concrete or not, purely so the plural test
   below can see that "sights" is the plural of "sight" -- an abstract noun
   that never enters the bank itself. */
const allNouns = new Set();
for (const line of readFileSync(wordnet.path + '/index.noun', 'utf8').split('\n')) {
  if (!line || line.startsWith('  ')) continue;
  allNouns.add(line.split(' ')[0]);
}

/* Sense tag counts, summed per part of speech. WordNet's index.sense records
   how often each sense was seen in a hand-tagged corpus, which is the only
   thing here that can tell "bench" (a noun people use) from "come" (a verb
   with a noun sense nobody reaches for). Format:
     lemma%ss_type:lex:id:: sense_key offset sense_number tag_cnt
   where ss_type 1 is a noun, 2 a verb, 3 and 5 adjectives, 4 an adverb. */
const tags = new Map();                        // word -> { noun, other }
for (const line of readFileSync(wordnet.path + '/index.sense', 'utf8').split('\n')) {
  if (!line) continue;
  const parts = line.split(' ');
  const [lemma, rest] = parts[0].split('%');
  if (!rest) continue;
  const count = Number(parts[3]) || 0;
  if (!count) continue;
  const entry = tags.get(lemma) || { noun: 0, other: 0 };
  entry[rest[0] === '1' ? 'noun' : 'other'] += count;
  tags.set(lemma, entry);
}

/* SCOWL size bands, smallest first. A word's band is a decent proxy for how
   well known it is: band 10 is the 3,940 commonest words, band 70 the tail. */
const BANDS = [10, 20, 35, 40, 50, 55, 60, 70];
const band = new Map();
for (const b of BANDS) {
  for (const w of english[`english/${b}`]) if (!band.has(w)) band.set(w, b);
}

/* Verb lemmas, for spotting gerunds below. */
const allVerbs = new Set();
for (const line of readFileSync(wordnet.path + '/index.verb', 'utf8').split('\n')) {
  if (!line || line.startsWith('  ')) continue;
  allVerbs.add(line.split(' ')[0]);
}

/* naughty-words is aimed at moderating user text, so it misses words that are
   merely unwelcome as a puzzle answer on a site aimed partly at children --
   mild vulgarities, drugs, death and British slang it has no entry for. */
const ALSO_BLOCKED = new Set([
  'coke', 'condom', 'corpse', 'crap', 'dope', 'drivel', 'duff', 'fanny',
  'heroin', 'jail', 'liquor', 'lush', 'opium', 'pigsty', 'prison', 'scum',
  'slag', 'smoker', 'stiff', 'tit', 'tits', 'toilet', 'tramp', 'weed',
]);
/* Real nouns that survive every rule above and still make a poor puzzle: too
   abstract to picture, or better known as another part of speech. Too few to
   be worth another heuristic -- add to this list when one turns up. */
const WEAK = new Set([
  'array', 'axis', 'bent', 'cant', 'delta', 'farce', 'genre', 'holder',
  'intake', 'jargon', 'matrix', 'medium', 'motive', 'notion', 'poll', 'pulp',
  'sake', 'sole', 'spur', 'thing', 'vector', 'viewer', 'ward',
]);

const blocked = new Set([...naughty.en, ...ALSO_BLOCKED, ...WEAK]);

/* ---------------------------------------------------------------- filters */

const isPlural = (w) =>
  (w.endsWith('s') && allNouns.has(w.slice(0, -1))) ||
  (w.endsWith('es') && allNouns.has(w.slice(0, -2))) ||
  (w.endsWith('ies') && allNouns.has(w.slice(0, -3) + 'y'));

/* Reject a word whose noun sense loses to its verb or adjective sense. This is
   what keeps "come", "tore", "insert" and "return" out: WordNet files them
   under a physical category, but nobody hearing them thinks of an object.
   Words with no tag data at all are too rare to be confusable, so they pass. */
const nounDominates = (w) => {
  const t = tags.get(w);
  return !t || t.noun > t.other;
};

/* A word can be common for a reason that has nothing to do with its noun
   sense. "sang", "shook", "stole", "tore", "drove" and "felt" are all filed
   under a physical category by WordNet and all sit in the commonest SCOWL
   band, yet none was ever tagged as a noun in the corpus -- their fame is
   entirely verbal. Rare words have no tag data either, but they are not
   confusable, so the test only applies where the word is common. */
const famousAsNoun = (w) => band.get(w) > 20 || (tags.get(w)?.noun ?? 0) > 0;

/* "filing", "wiring", "coping", "making": technically nouns, weak puzzles. */
const isGerund = (w) => {
  if (!w.endsWith('ing') || w.length < 6) return false;
  const stem = w.slice(0, -3);
  return allVerbs.has(stem) || allVerbs.has(stem + 'e') ||
    (stem.at(-1) === stem.at(-2) && allVerbs.has(stem.slice(0, -1)));
};

const rejected = { noBand: 0, plural: 0, blocked: 0, verby: 0, gerund: 0, inflected: 0 };

const candidates = [];
for (const [word, category] of nouns) {
  if (!band.has(word)) { rejected.noBand++; continue; }     // too obscure to rank
  if (isPlural(word)) { rejected.plural++; continue; }
  if (blocked.has(word)) { rejected.blocked++; continue; }
  if (!nounDominates(word)) { rejected.verby++; continue; }
  if (!famousAsNoun(word)) { rejected.inflected++; continue; }
  if (isGerund(word)) { rejected.gerund++; continue; }
  candidates.push({ word, category, band: band.get(word), len: word.length });
}

/* ----------------------------------------------------------- difficulties
   Bands and lengths chosen to match the blurbs the game already shows. */
const RULES = {
  easy:   (c) => c.band <= 20 && c.len >= 4 && c.len <= 6,
  medium: (c) => c.band <= 40 && c.len >= 4 && c.len <= 7,
  hard:   (c) => c.band <= 50 && (c.len === 3 || (c.len >= 7 && c.len <= 9)),
};

/* Keep every hand-picked word: they were chosen well and some sit outside the
   bands above. Existing banks are read back out of the file being replaced. */
const previous = (() => {
  const src = readFileSync(OUT, 'utf8');
  const grab = (name) => {
    const m = src.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\n\\];`));
    return m ? [...m[1].matchAll(/"([a-z]+)"/g)].map((x) => x[1]) : [];
  };
  return { easy: grab('EASY'), medium: grab('MEDIUM'), hard: grab('HARD') };
})();

const banks = {};
const used = new Set();
for (const key of ['easy', 'medium', 'hard']) {
  /* `used` applies to the carried-forward words as well, or a hand-picked word
     that the generator also placed in an earlier bank lands in both. */
  const picked = new Set(previous[key].filter((w) => !used.has(w)));
  for (const c of candidates) {
    if (used.has(c.word) || picked.has(c.word)) continue;
    if (RULES[key](c)) picked.add(c.word);
  }
  for (const w of picked) used.add(w);
  /* The blocklist wins over the carried-forward words too, so it can never be
     bypassed by a word that was hand-picked before the list existed. */
  banks[key] = [...picked].filter((w) => !blocked.has(w)).sort();
}

/* -------------------------------------------------------------- reporting */
const lengths = (list) => {
  const out = {};
  for (const w of list) out[w.length] = (out[w.length] || 0) + 1;
  return Object.entries(out).map(([k, v]) => `${k}:${v}`).join(' ');
};
console.log('WordNet concrete nouns, 3-9 letters:', nouns.size);
console.log('dropped ->', `unranked ${rejected.noBand}`, `plural ${rejected.plural}`,
  `blocked ${rejected.blocked}`, `verb-first ${rejected.verby}`);
console.log('ranked candidates:', candidates.length, '\n');
for (const key of ['easy', 'medium', 'hard']) {
  console.log(
    key.padEnd(7), String(banks[key].length).padStart(5),
    `(was ${previous[key].length})`.padEnd(12), lengths(banks[key]));
  const step = Math.ceil(banks[key].length / (DRY ? 40 : 12));
  console.log('   sample:', banks[key].filter((_, i) => i % step === 0).join(' '));
}
console.log('\ntotal', banks.easy.length + banks.medium.length + banks.hard.length,
  '(was', previous.easy.length + previous.medium.length + previous.hard.length, ')');

if (DRY) { console.log('\n--dry: nothing written'); process.exit(0); }

/* ----------------------------------------------------------------- output */
const wrap = (list) => {
  const lines = [];
  for (let i = 0; i < list.length; i += 8) {
    lines.push('  ' + list.slice(i, i + 8).map((w) => `"${w}"`).join(', ') + ',');
  }
  return lines.join('\n');
};

writeFileSync(OUT, `import { validSet } from './words.js';

/* ============================= HANGMAN WORD BANKS =============================
   GENERATED FILE -- do not hand-edit. Run \`node scripts/build-hangman-words.mjs\`
   and commit the result. The generator explains its choices.

   Concrete nouns only, taken from WordNet's physical categories (animal,
   artifact, body, food, object, plant, substance) and sorted into difficulties
   by SCOWL commonness band. A plain dictionary dump would be full of proper
   nouns, plurals and abstractions that make hangman miserable to play.

     easy    common words, 4-6 letters
     medium  slightly less common, 4-7 letters
     hard    short 3-letter words and long 7-9 letter ones, both awkward to crack
*/

const EASY = [
${wrap(banks.easy)}
];

const MEDIUM = [
${wrap(banks.medium)}
];

const HARD = [
${wrap(banks.hard)}
];

export const DIFFICULTIES = [
  { key: "easy", name: "Easy", blurb: "Common words, 4-6 letters", words: EASY },
  { key: "medium", name: "Medium", blurb: "Less common, 4-7 letters", words: MEDIUM },
  { key: "hard", name: "Hard", blurb: "Very short or very long words", words: HARD },
];

export const pickWord = (key) => {
  const d = DIFFICULTIES.find((x) => x.key === key) || DIFFICULTIES[0];
  return d.words[Math.floor(Math.random() * d.words.length)];
};

/* --------------------------- spelling suggestions ---------------------------
   Used only to offer a gentle "did you mean" when a player sets a word by hand.
   It never blocks a submission: a deliberate misspelling, an inside joke or a
   name is all fair game, and the group can argue about it themselves. */
const BANK_WORDS = [...EASY, ...MEDIUM, ...HARD];

/* Spelled-correctly check casts a wide net -- the Wordle list adds ~14,800 more
   real words, so a valid word is not wrongly flagged. */
const KNOWN = new Set([...BANK_WORDS, ...validSet]);
export const isKnownWord = (w) => KNOWN.has(w.toLowerCase());

/* Levenshtein distance, abandoned as soon as it cannot come in under \`max\`. */
const distanceWithin = (a, b, max) => {
  if (Math.abs(a.length - b.length) > max) return Infinity;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let rowBest = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (row[j] < rowBest) rowBest = row[j];
    }
    if (rowBest > max) return Infinity;
    prev = row;
  }
  return prev[b.length] <= max ? prev[b.length] : Infinity;
};

/* Nearest everyday word, or null when nothing is close.
   Suggestions come only from these banks, never from the Wordle list: that
   list is full of obscurities like "agita" and "anana" which win on edit
   distance and make the hint worse than useless. */
export const suggestSpelling = (raw) => {
  const w = raw.toLowerCase();
  if (!w || isKnownWord(w)) return null;
  const max = w.length <= 4 ? 1 : 2;
  let best = null, bestDistance = Infinity;
  for (const cand of BANK_WORDS) {
    const d = distanceWithin(w, cand, max);
    if (d < bestDistance) {
      bestDistance = d; best = cand;
      if (d === 1) break;              // a single edit is as close as it gets here
    }
  }
  return bestDistance <= max ? best : null;
};
`);

console.log('\nwrote src/data/hangmanWords.js');
