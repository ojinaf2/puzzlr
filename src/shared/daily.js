import { useState, useEffect } from 'react';

/* ============================= DAILY PUZZLES =============================

   One puzzle a day, the same for everyone, with no server and no database
   behind it. The date *is* the seed: every browser shuffles the answer list
   the same way and takes the same entry, so two people comparing scores are
   comparing the same puzzle without anything having been coordinated.

   Progress and streaks live in localStorage. That makes them per-device and
   per-browser, which is a deliberate limit rather than a missing feature —
   there are no accounts here to tie a history to. Clearing site data resets
   a streak, and nothing can be done about that without a database.

   The day rolls over at the player's own midnight, not UTC, so "today's
   puzzle" means what they expect it to wherever they are.                */

const EPOCH = Date.UTC(2026, 0, 1);          // the day numbered 1
const DAY_MS = 86400000;

export const todayNumber = () => {
  const now = new Date();
  const local = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((local - EPOCH) / DAY_MS) + 1;
};

export const msUntilTomorrow = () => {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return midnight - now;
};

/* ------------------------------------------------------------ the choosing
   Picking with `hash(day) % length` would repeat answers long before the list
   ran out, so instead the whole list is shuffled once with a fixed seed and
   read in order. Nothing repeats until every entry has been used: 6.8 years
   for Wordle's 2,500 answers. The shuffle is pure, so it comes out identical
   on every device, today and in five years. */

const xmur3 = (str) => {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h ^ (h >>> 16)) >>> 0;
};

const mulberry32 = (seed) => () => {
  seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const orders = new Map();                    // shuffling 2,500 words per render adds up

const orderFor = (list, salt) => {
  const key = `${salt}:${list.length}`;
  let order = orders.get(key);
  if (!order) {
    const next = mulberry32(xmur3(salt));
    order = [...list];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    orders.set(key, order);
  }
  return order;
};

/* The entry for a given day. `salt` keeps two games that share a list from
   handing out the same answer on the same day. */
export const dailyPick = (list, salt, day = todayNumber()) => {
  const order = orderFor(list, salt);
  return order[(day - 1 + order.length * 1000) % order.length];
};

/* -------------------------------------------------------------- the record
   Kept small and versioned, because it has to survive being read by a build
   of the site newer than the one that wrote it. */

const KEY = (gameId) => `puzzlr:daily:${gameId}`;
const EMPTY = { day: 0, board: null, done: null, played: 0, won: 0, streak: 0, best: 0, lastWon: 0, dist: {} };

/* The day of the most recent win, which is not something `day` can answer.

   `day` is the day the *stored board* belongs to, and `saveBoard` moves it to
   today the moment the first guess is typed — clearing `done` with it. So by
   the time a puzzle is finished, "did they win yesterday?" has already been
   overwritten by the act of playing today. Reading continuity off `day` meant
   every streak reset to 1 for anyone who typed a guess, which is everyone.

   The fallback reads the old shape, for a record written before this field
   existed: back then the answer really was `day` plus `done`, and that is
   still correct for anyone who has not started today's puzzle yet. */
const lastWonDay = (prev) => prev.lastWon || (prev.done?.won ? prev.day : 0);

export const loadDaily = (gameId) => {
  try {
    const raw = localStorage.getItem(KEY(gameId));
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : { ...EMPTY };
  } catch {
    return { ...EMPTY };                     // private browsing, or a wiped quota
  }
};

const write = (gameId, record) => {
  try { localStorage.setItem(KEY(gameId), JSON.stringify(record)); } catch { /* not worth failing a game over */ }
  return record;
};

/* Store the half-finished board so a refresh mid-puzzle does not lose it. */
export const saveBoard = (gameId, day, board) => {
  const prev = loadDaily(gameId);
  return write(gameId, prev.day === day ? { ...prev, board } : { ...prev, day, board, done: null });
};

/* Count a finished puzzle exactly once. Calling it twice for the same day is
   a no-op, so a re-render or a second tab cannot inflate a streak.
   `bucket` labels the result for the distribution chart — the guess count for
   Wordle, the number of wrong letters for Hangman. */
export const finishDaily = (gameId, day, won, bucket) => {
  const prev = loadDaily(gameId);
  if (prev.day === day && prev.done) return prev;
  const continues = lastWonDay(prev) === day - 1;
  const streak = won ? (continues ? prev.streak : 0) + 1 : 0;
  return write(gameId, {
    ...prev,
    day,
    done: { won, bucket },
    lastWon: won ? day : lastWonDay(prev),
    played: prev.played + 1,
    won: prev.won + (won ? 1 : 0),
    streak,
    best: Math.max(prev.best, streak),
    dist: won ? { ...prev.dist, [bucket]: (prev.dist[bucket] || 0) + 1 } : prev.dist,
  });
};

/* Today's record, or a blank one when the stored day has rolled over. */
export const todaysRecord = (gameId, day) => {
  const r = loadDaily(gameId);
  return r.day === day ? r : { ...r, board: null, done: null };
};

/* ----------------------------------------------------------------- sharing
   navigator.clipboard needs a secure context and is missing on some older
   phone browsers, hence the textarea fallback. */
export const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch { return false; }
  }
};

/* Live "next puzzle in 3h 12m", ticking once a minute. */
export function useCountdown() {
  const [ms, setMs] = useState(msUntilTomorrow);
  useEffect(() => {
    const t = setInterval(() => setMs(msUntilTomorrow()), 30000);
    return () => clearInterval(t);
  }, []);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
