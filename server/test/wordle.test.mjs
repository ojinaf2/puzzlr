/* Wordle race rules, including what each player is allowed to see.
   Run with: node test/wordle.test.mjs */

import { GAMES, WORDLE_DURATIONS } from '../src/games.js';

let passed = 0, failed = 0;
const check = (label, ok, detail = '') => {
  if (ok) { passed++; console.log('  PASS  ' + label); }
  else { failed++; console.log('  FAIL  ' + label + (detail ? '  -> ' + detail : '')); }
};

const w = GAMES.wordle;

const makeRoom = (answer = 'crane') => {
  const room = {
    gameId: 'wordle', status: 'playing',
    hostId: 'ana',
    players: [
      { id: 'ana', name: 'Ana', seat: 0, connected: true, lastSeen: Date.now() },
      { id: 'ben', name: 'Ben', seat: 1, connected: true, lastSeen: Date.now() },
    ],
    game: w.create(),
  };
  room.game = w.start(room);
  room.game.answer = answer;          // pin it so the test is deterministic
  return room;
};
const guess = (room, who, word) => w.move(room, room.players.find((p) => p.id === who), { word });

console.log('\n— setup —');
{
  const r = makeRoom();
  check('both players get a board', Object.keys(r.game.boards).length === 2);
  check('the same word for everyone', typeof r.game.answer === 'string' && r.game.answer.length === 5);
  check('it does not start automatically', w.autoStart === false);
  check('a round clock is set by default', typeof r.game.roundEndsAt === 'number');
}

console.log('\n— guess validation —');
{
  const r = makeRoom();
  check('a short word is refused', !!guess(r, 'ana', 'cat').error);
  check('a long word is refused', !!guess(r, 'ana', 'crates').error);
  check('a non-word is refused', !!guess(r, 'ana', 'zzzzz').error, 'zzzzz should not be in the list');
  check('a real word is accepted', !guess(r, 'ana', 'slate').error);
  check('case does not matter', !guess(r, 'ana', 'SLATE'.toLowerCase()).error);
}

console.log('\n— scoring —');
{
  const r = makeRoom('crane');
  guess(r, 'ana', 'crane');
  check('an exact match is all green', r.game.boards.ana.scores[0].every((s) => s === 'correct'), JSON.stringify(r.game.boards.ana.scores[0]));
}
{
  // "nacre" is an anagram of "crane", but the final e still lands in place,
  // so it is green and the rest are present.
  const r = makeRoom('crane');
  guess(r, 'ana', 'nacre');
  const s = r.game.boards.ana.scores[0];
  check('an anagram is present, except letters that land in place',
    JSON.stringify(s) === JSON.stringify(['present','present','present','present','correct']), JSON.stringify(s));
}
{
  // "abbey" against "babes". The b at index 2 and the e at index 3 are in
  // place; the leading a and b are present; y is absent. The point is that the
  // two b's must not both score off the answer's single remaining b.
  const r = makeRoom('babes');
  guess(r, 'ana', 'abbey');
  const s = r.game.boards.ana.scores[0];
  check('duplicate letters do not over-count',
    JSON.stringify(s) === JSON.stringify(['present','present','correct','correct','absent']), JSON.stringify(s));
}
{
  // "eerie" holds three e's but "crane" only one, so exactly one of those
  // three positions may score. (The r scores separately and correctly.)
  const r = makeRoom('crane');
  guess(r, 'ana', 'eerie');
  const s = r.game.boards.ana.scores[0];
  const ePositions = [0, 1, 4];                     // where the e's sit in "eerie"
  const eScored = ePositions.filter((i) => s[i] !== 'absent').length;
  check('a letter scores only as often as the answer holds it', eScored === 1, JSON.stringify(s));
  check('and it is the one in the right place that scores', s[4] === 'correct', JSON.stringify(s));
}

console.log('\n— the race —');
{
  const r = makeRoom('crane');
  guess(r, 'ben', 'slate');
  const res = guess(r, 'ana', 'crane');
  check('first to solve takes the round', r.game.winner === 'ana', String(r.game.winner));
  check('the round ends', res.over === true);
  check('their score goes up', r.game.wins.ana === 1, JSON.stringify(r.game.wins));
  check('the loser scores nothing', r.game.wins.ben === 0);
  check('the clock is cleared', r.game.roundEndsAt === null);
  check('the other player can no longer guess', !!guess(r, 'ben', 'crane').error);
}

console.log('\n— running out of guesses —');
{
  const r = makeRoom('crane');
  const six = ['slate','pilot','mound','fizzy','husky','bugle'];
  for (const g of six) { guess(r, 'ana', g); guess(r, 'ben', g); }
  check('a player is out after six', r.game.boards.ana.out === true);
  check('both being out ends the round', r.game.timedOut === true);
  check('nobody scores', r.game.wins.ana === 0 && r.game.wins.ben === 0, JSON.stringify(r.game.wins));
  check('a seventh guess is refused', !!guess(r, 'ana', 'crane').error);
}

console.log('\n— the clock —');
{
  const r = makeRoom('crane');
  r.game.roundEndsAt = Date.now() - 1;              // pretend the clock just ran out
  check('a late guess is refused', !!guess(r, 'ana', 'crane').error);

  const r2 = makeRoom('crane');
  const res = w.timeUp(r2);
  check('time up ends the round', res.over === true && r2.game.timedOut === true);
  check('and nobody scores', r2.game.wins.ana === 0 && r2.game.wins.ben === 0);

  const r3 = makeRoom('crane');
  guess(r3, 'ana', 'crane');
  const after = w.timeUp(r3);
  check('time up cannot overwrite a finished round', !after.over && r3.game.winner === 'ana');
}

console.log('\n— round length settings —');
{
  const r = makeRoom();
  r.status = 'over';
  check('an offered length is accepted', !w.config(r, { durationMs: 120000 }).error);
  check('and it sticks', r.game.durationMs === 120000);
  check('no limit is allowed', !w.config(r, { durationMs: 0 }).error);
  check('a made-up length is refused', !!w.config(r, { durationMs: 12345 }).error);
  r.status = 'playing';
  check('settings are locked mid-round', !!w.config(r, { durationMs: 30000 }).error);
  check('the offered lengths are 30s, 60s, 2min and none', JSON.stringify(WORDLE_DURATIONS) === '[30000,60000,120000,0]');
}
{
  const r = makeRoom();
  r.status = 'over';
  w.config(r, { durationMs: 0 });
  const next = w.start(r, r.game);
  check('no limit means no clock', next.roundEndsAt === null);
  check('the setting carries into the next round', next.durationMs === 0);
}

console.log('\n— what each player can see —');
{
  const r = makeRoom('crane');
  guess(r, 'ben', 'slate');
  const anaSees = w.view(r, 'ana');

  check('the answer is hidden while playing', anaSees.game.answer === null, String(anaSees.game.answer));
  check('you can see your own board', Array.isArray(anaSees.game.boards.ana.guesses));
  check("you cannot read the opponent's words", anaSees.game.boards.ben.guesses === undefined, JSON.stringify(anaSees.game.boards.ben));
  check('but you can see their colours', Array.isArray(anaSees.game.boards.ben.scores) && anaSees.game.boards.ben.scores.length === 1);
  check('and how many guesses they have made', anaSees.game.boards.ben.guessCount === 1);
  check('the raw word appears nowhere in what is sent', !JSON.stringify(anaSees).includes('slate'), 'ben’s guess leaked');

  guess(r, 'ana', 'crane');
  r.status = 'over';
  const afterwards = w.view(r, 'ana');
  check('the answer is revealed once the round is over', afterwards.game.answer === 'crane');
}

console.log('\n— rematch and forfeit —');
{
  const r = makeRoom('crane');
  guess(r, 'ana', 'crane');
  const next = w.start(r, r.game);
  check('a new word is dealt', typeof next.answer === 'string');
  check('boards are wiped', next.boards.ana.guesses.length === 0);
  check('the score carries over', next.wins.ana === 1, JSON.stringify(next.wins));
  check('the round number advances', next.roundNo === 2, String(next.roundNo));

  const r2 = makeRoom('crane');
  w.forfeit(r2, r2.players[1]);
  check('abandoning hands the round over', r2.game.winner === 'ana' && r2.game.wins.ana === 1);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
