/* ============================= THE LEADERBOARD =============================

   One Durable Object per game, holding every variant of that game's board.
   Rooms are per code and die after half an hour; these are permanent and
   shared by everybody, so they are a different object with a different
   lifetime rather than another job for Room.

   WHAT THIS CAN AND CANNOT PROMISE
   Scores are reported by the browser. The server checks that a value is a
   number of the right shape, inside plausible bounds, arriving no faster than
   a person could produce one — and that is the whole of it. Nothing here can
   tell a real 40,000-point Tetris game from a fabricated one, because the
   game was simulated in the browser and only its result was sent.

   That is the same trade CLAUDE.md describes for online Tetris, and it is
   worth being honest that a public leaderboard leans on it harder than a
   match between two friends does. It is a wall of names, not a record book.
   Anything that needed to be trustworthy would have to be simulated here.

   IDENTITY
   Entries are keyed by a random id kept in the player's browser, so the same
   browser holds one row however many days it plays across, and beating your
   own score updates that row instead of adding another. Clearing site data
   loses the id, and with it the claim on the row — there is no account to
   fall back on, which is the deliberate cost of having no accounts.       */

import { boardOf, variantOf, boundsFor, beats, sortEntries } from '../../src/data/leaderboards.js';

const MAX_ENTRIES = 100;        // a table longer than this helps nobody
const MAX_NAME = 14;            // matches the name box in shared/online.jsx
const WRITE_GAP_MS = 2000;      // one accepted write per player per this long
const SEEN_CAP = 500;           // ceiling on the rate-limit map, so a flood cannot grow it

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type',
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  });

/* Names go on a page everyone can see, so this is deliberately strict: no
   control characters, no runs of whitespace to fake indentation, and a hard
   length limit. It is not a profanity filter — there is none, and adding one
   would mean shipping a word list into the Worker. */
export const cleanName = (raw) =>
  String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028\u2029]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME);

const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

/* Pure, and exported, so the rules can be tested without a Workers runtime —
   the same reason Snake and Minesweeper keep their rules in a plain module. */
export function validate({ gameId, board, id, name, value }) {
  const def = boardOf(gameId);
  if (!def) return { error: 'no such leaderboard' };
  if (!variantOf(gameId, board)) return { error: 'no such board' };
  if (!ID_RE.test(String(id ?? ''))) return { error: 'bad player id' };

  const clean = cleanName(name);
  if (!clean) return { error: 'a name is needed' };

  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return { error: 'bad value' };
  const [min, max] = boundsFor(gameId, board);
  if (n < min || n > max) return { error: 'value out of range' };

  return { entry: { id: String(id), name: clean, value: n, at: Date.now() } };
}

export class Leaderboard {
  constructor(ctx) {
    this.ctx = ctx;
    /* In instance memory rather than storage: the object can be evicted and
       lose this, and the worst that costs is one extra accepted write. Putting
       it in storage would mean a row per player forever, to solve a problem
       that does not exist yet. */
    this.seen = new Map();
  }

  async entries(board) {
    return (await this.ctx.storage.get(`board:${board}`)) ?? [];
  }

  async put(board, entries) {
    await this.ctx.storage.put(`board:${board}`, entries);
  }

  tooSoon(id, now) {
    const last = this.seen.get(id);
    if (last && now - last < WRITE_GAP_MS) return true;
    if (this.seen.size > SEEN_CAP) this.seen.clear();
    this.seen.set(id, now);
    return false;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const gameId = url.searchParams.get('gameId') ?? '';

    if (url.pathname === '/list') {
      const board = url.searchParams.get('board') ?? '';
      if (!variantOf(gameId, board)) return json({ error: 'no such board' }, 404);
      const def = boardOf(gameId);
      return json({ entries: sortEntries(def.dir, await this.entries(board)) });
    }

    if (url.pathname === '/submit') {
      const body = await request.json().catch(() => ({}));
      const { error, entry } = validate({ ...body, gameId });
      if (error) return json({ error }, 400);

      const def = boardOf(gameId);
      const board = String(body.board);
      const entries = await this.entries(board);
      const mine = entries.find((e) => e.id === entry.id);

      const improves = !mine || beats(def.dir, entry.value, mine.value);
      /* A player who has not beaten themselves still gets their name
         refreshed, so renaming shows on the board without having to earn a
         new best first. */
      const renames = !!mine && mine.name !== entry.name;

      /* Nothing to write. This is not an error and is not worth rate
         limiting — it is what a resubmitted best looks like, and every game
         resubmits its best on purpose so a submission lost to a bad
         connection repairs itself. Hand back the board and say nothing. */
      if (!improves && !renames) {
        return json({ entries: sortEntries(def.dir, entries) });
      }

      /* A real write, arriving faster than a person could have earned it.
         Skipped rather than refused: the board handed back is still the
         truth, and the next finished game sends the same number again. A
         refusal here would leave the caller rendering a board it knows is
         out of date, which is the worse failure of the two. */
      if (this.tooSoon(entry.id, entry.at)) {
        return json({ entries: sortEntries(def.dir, entries), skipped: true });
      }

      if (mine) {
        mine.name = entry.name;
        if (improves) { mine.value = entry.value; mine.at = entry.at; }
      } else {
        entries.push(entry);
      }

      const ranked = sortEntries(def.dir, entries).slice(0, MAX_ENTRIES);
      await this.put(board, ranked);
      return json({ entries: ranked });
    }

    /* Renaming touches every board this game has, because a player who
       changes their name expects the old one gone from all of them and has no
       idea the site keeps one table per difficulty. */
    if (url.pathname === '/rename') {
      const body = await request.json().catch(() => ({}));
      const def = boardOf(gameId);
      if (!def) return json({ error: 'no such leaderboard' }, 404);
      if (!ID_RE.test(String(body.id ?? ''))) return json({ error: 'bad player id' }, 400);
      const clean = cleanName(body.name);
      if (!clean) return json({ error: 'a name is needed' }, 400);

      for (const variant of def.variants) {
        const entries = await this.entries(variant.key);
        const mine = entries.find((e) => e.id === String(body.id));
        if (!mine || mine.name === clean) continue;
        mine.name = clean;
        await this.put(variant.key, entries);
      }
      return json({ ok: true });
    }

    return json({ error: 'not found' }, 404);
  }
}
