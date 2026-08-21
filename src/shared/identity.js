import { useSyncExternalStore } from 'react';

/* ============================= WHO YOU ARE =============================

   There are no accounts here, so "who you are" is two random ids and a name,
   all three living in this browser's localStorage and nowhere else. Clearing
   site data forgets all of it — that is the cost of having nothing to log in
   to, and it is the same cost daily streaks already pay.

   TWO IDS, ON PURPOSE.
   The room server broadcasts the player list to everyone in the room, ids and
   all, so anybody you have ever played against has seen your room id. That is
   fine for a seat in a room — it is what lets you reclaim the seat after a
   dropped connection — but it would be the wrong thing to key a leaderboard
   row on, because a row is only yours for as long as nobody else can name it.
   So the leaderboard gets its own id, generated here and never sent to a
   room.

   THE NAME IS SHARED.
   One name for the site: the one your friends see in a lobby is the one that
   goes on the board. Changing it in the header changes both.               */

const ROOM_ID_KEY = 'puzzlr:playerId';
const SCORE_ID_KEY = 'puzzlr:scoreId';
const NAME_KEY = 'puzzlr:playerName';

const read = (key) => {
  try { return localStorage.getItem(key); } catch { return null; }
};

const write = (key, value) => {
  try { localStorage.setItem(key, value); } catch { /* private mode; nothing to be done */ }
};

/* A missing crypto.randomUUID is possible on older phone browsers over plain
   http. The fallback is not cryptographically anything, and does not need to
   be — it only has to not collide. */
const newId = (prefix) => {
  const random = crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return prefix + random;
};

const idIn = (key, prefix) => {
  let id = read(key);
  if (!id) { id = newId(prefix); write(key, id); }
  return id;
};

/* The seat in a room. Sent to the room server; visible to everyone there. */
export const myPlayerId = () => idIn(ROOM_ID_KEY, 'p-');

/* The row on a leaderboard. Sent only to the leaderboard endpoint. */
export const myScoreId = () => idIn(SCORE_ID_KEY, 's-');

export const savedName = () => read(NAME_KEY) || '';

/* --------------------------------------------------------------- the name
   The header can rename you while a game is on screen, and the game has to
   notice — so the name is a tiny store rather than a value read once at
   mount. Same shape as the theme store in theme.js. */

const listeners = new Set();
let current = null;                       // read lazily; localStorage is not free

const snapshot = () => {
  if (current === null) current = savedName();
  return current;
};

export const saveName = (raw) => {
  const clean = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 14);
  if (clean === snapshot()) return clean;
  current = clean;
  write(NAME_KEY, clean);
  listeners.forEach((fn) => fn());
  return clean;
};

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const useSavedName = () => useSyncExternalStore(subscribe, snapshot, () => '');
