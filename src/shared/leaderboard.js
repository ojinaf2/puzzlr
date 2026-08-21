import { useState, useEffect, useCallback, useRef } from 'react';
import { httpBase } from './useRoom.js';
import { myScoreId, savedName, useSavedName } from './identity.js';
import { LEADERBOARDS, boundsFor, sortEntries } from '../data/leaderboards.js';

/* ============================= TALKING TO THE BOARD =============================

   Plain fetch against the same Worker the rooms run on. If no room server is
   configured there is no leaderboard either, and every tab that would show
   one hides itself rather than leading somewhere broken — the same rule the
   online tabs already follow.

   SUBMITTING IS IDEMPOTENT, AND THAT IS THE ERROR HANDLING.
   Games send their stored best rather than the run that just finished, and
   the server keeps whichever end of the board is winning. So a submission
   lost to a flaky connection is not lost at all: the next finished game sends
   the same number again, and opening the Leaderboard tab sends it too. That
   is why nothing here retries, queues or reports a failure — a failure
   repairs itself, and a toast saying "could not reach the leaderboard" over
   the end of a game would be worse than the silence.                       */

export const leaderboardsEnabled = () => !!httpBase();

/* Boards change slowly and a player flicking between Easy and Hard should not
   refetch each time. Short enough that a score posted from another tab shows
   up on the next look. */
const TTL_MS = 20000;
const cache = new Map();
const keyOf = (gameId, board) => `${gameId}:${board}`;

const remember = (gameId, board, entries) => {
  cache.set(keyOf(gameId, board), { at: Date.now(), entries });
  return entries;
};

export async function fetchBoard(gameId, board, { force = false, signal } = {}) {
  const base = httpBase();
  if (!base) throw new Error('Leaderboards are not configured.');

  const hit = cache.get(keyOf(gameId, board));
  if (hit && !force && Date.now() - hit.at < TTL_MS) return hit.entries;

  const res = await fetch(
    `${base}/leaderboard/${encodeURIComponent(gameId)}?board=${encodeURIComponent(board)}`,
    { signal });
  if (!res.ok) throw new Error('Could not reach the leaderboard.');
  const data = await res.json();
  return remember(gameId, board, Array.isArray(data.entries) ? data.entries : []);
}

/* Returns the fresh board on success and null on any failure, because every
   caller treats "it did not land" the same way: leave the screen alone. */
export async function submitScore(gameId, board, value) {
  const base = httpBase();
  const name = savedName();
  if (!base || !name) return null;

  const bounds = boundsFor(gameId, board);
  const n = Math.round(Number(value));
  // Checked here as well as on the server, purely to save a pointless request.
  if (!bounds || !Number.isFinite(n) || n < bounds[0] || n > bounds[1]) return null;

  try {
    const res = await fetch(`${base}/leaderboard/${encodeURIComponent(gameId)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ board, id: myScoreId(), name, value: n }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.entries) ? remember(gameId, board, data.entries) : null;
  } catch {
    return null;
  }
}

/* A rename has to reach every game the player has ever placed in, because
   they have no way of knowing which those are — and no reason to think the
   site keeps one table per difficulty. Fired and forgotten: if one of them
   misses, the next score posted to it carries the new name anyway. */
export function renameEverywhere(name) {
  const base = httpBase();
  const clean = String(name ?? '').trim();
  if (!base || !clean) return;
  cache.clear();
  for (const gameId of Object.keys(LEADERBOARDS)) {
    fetch(`${base}/leaderboard/${encodeURIComponent(gameId)}/rename`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: myScoreId(), name: clean }),
    }).catch(() => { /* the next score it posts will carry the new name */ });
  }
}

/* ------------------------------------------------------------ reading one
   `board` may be null while a game works out which variant it is on, which
   is why the effect tolerates it rather than the caller having to. */
export function useBoard(gameId, board) {
  const [state, setState] = useState({ entries: null, error: null });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!board || !leaderboardsEnabled()) return undefined;
    const controller = new AbortController();
    let live = true;
    setState((s) => ({ entries: s.entries, error: null }));

    fetchBoard(gameId, board, { force: nonce > 0, signal: controller.signal })
      .then((entries) => { if (live) setState({ entries, error: null }); })
      .catch((err) => {
        if (!live || err.name === 'AbortError') return;
        setState({ entries: null, error: 'Could not reach the leaderboard.' });
      });

    return () => { live = false; controller.abort(); };
  }, [gameId, board, nonce]);

  // Switching variants should show the new board's spinner, not the old rows.
  const entries = state.entries;
  return {
    entries,
    error: state.error,
    reload: useCallback(() => setNonce((n) => n + 1), []),
    accept: useCallback((fresh) => setState({ entries: fresh, error: null }), []),
  };
}

/* ------------------------------------------------------- posting a result
   Used at the end of a game. Hands back a flag the game turns into the name
   prompt: a result worth putting on the board is the moment a name is worth
   asking for, and asking before anyone has played is asking a stranger to
   introduce themselves to an empty room.

   Declining is remembered for the page load only. Refusing once should stop
   the nagging for that sitting without permanently opting anybody out of a
   feature they may want the moment they see the board. */
let declined = false;

export function useScoreSubmit(gameId) {
  const name = useSavedName();
  const [pending, setPending] = useState(null);      // { board, value } awaiting a name
  const nameRef = useRef(name);
  nameRef.current = name;

  const submit = useCallback((board, value) => {
    const bounds = boundsFor(gameId, board);
    const n = Math.round(Number(value));
    if (!leaderboardsEnabled() || !bounds) return;
    if (!Number.isFinite(n) || n < bounds[0] || n > bounds[1]) return;

    if (!nameRef.current) {
      if (!declined) setPending({ board, value: n });
      return;
    }
    submitScore(gameId, board, n);
  }, [gameId]);

  // The name arrived (from the prompt, or from the header while the prompt
  // was open) — send what was waiting on it.
  useEffect(() => {
    if (!name || !pending) return;
    submitScore(gameId, pending.board, pending.value);
    setPending(null);
  }, [name, pending, gameId]);

  return {
    needsName: !!pending && !name,
    /* The dialog reports whether a name was actually saved. On a save there is
       nothing to do here — the effect above sees the new name and posts what
       was waiting — and clearing `pending` now would throw that away. */
    dismiss: useCallback((saved) => {
      if (saved) return;
      declined = true;
      setPending(null);
    }, []),
    submit,
  };
}

/* Where a player sits on a board they may not be visible on. Returns null
   rather than a rank of zero when they are not on it at all. */
export const rankOf = (dir, entries, id) => {
  const sorted = sortEntries(dir, entries);
  const i = sorted.findIndex((e) => e.id === id);
  return i < 0 ? null : i + 1;
};

