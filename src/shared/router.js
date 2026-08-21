import { useState, useEffect, useCallback } from 'react';

/* ============================= ROUTER =============================
   A tiny History API router — no dependency, because the whole app only
   needs three shapes of URL:

     /                     the landing page
     /leaderboards         every game's board on one page
     /wordle               a game, played locally on this device
     /wordle/board         that game's own leaderboard tab
     /wordle/ABCD24        an online room, which is what invite links point at

   Room codes are uppercase and unambiguous: no O/0 or I/1, so they survive
   being read aloud or typed off someone else's screen. */

const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;

export const makeRoomCode = () => {
  const bytes = new Uint8Array(ROOM_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => ROOM_ALPHABET[b % ROOM_ALPHABET.length]).join("");
};

export const isRoomCode = (s) =>
  typeof s === "string" &&
  s.length === ROOM_CODE_LENGTH &&
  [...s].every((ch) => ROOM_ALPHABET.includes(ch));

/* The host/join screen is a URL rather than component state, so refreshing
   while choosing keeps you there instead of dropping you back into the local
   game. It cannot be mistaken for a room code: codes are six characters from
   an alphabet with no lower case in it. */
export const ONLINE_SEGMENT = "online";

/* Likewise for the leaderboard: `/tetris/board` is a place, so it can be
   linked to from the hub page and survives a refresh. Neither segment can be
   mistaken for a room code, which is six characters and has no lower case. */
export const BOARD_SEGMENT = "board";

/* The one page that is not a game. Plural, so it cannot collide with a future
   game id called "leaderboard" — and it reads as what it is. */
export const BOARDS_ROUTE = "leaderboards";

const MODES = [ONLINE_SEGMENT, BOARD_SEGMENT];

/* pathname -> { gameId, roomCode, mode } */
export const parsePath = (pathname) => {
  const [gameId = "", raw = ""] = pathname.split("/").filter(Boolean);
  const upper = raw.toUpperCase();
  const lower = raw.toLowerCase();
  return {
    gameId: gameId || null,
    roomCode: isRoomCode(upper) ? upper : null,
    mode: MODES.includes(lower) ? lower : null,
  };
};

/* `segment` is either a room code or "online"; parsePath sorts out which. */
export const buildPath = (gameId, segment) =>
  !gameId ? "/" : segment ? `/${gameId}/${segment}` : `/${gameId}`;

/* Current route, kept in sync with the address bar and the back button. */
export function useRoute() {
  const read = () => parsePath(window.location.pathname);
  const [route, setRoute] = useState(read);

  useEffect(() => {
    const onPop = () => setRoute(read());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((gameId, roomCode = null, { replace = false } = {}) => {
    const path = buildPath(gameId, roomCode);
    if (path !== window.location.pathname) {
      window.history[replace ? "replaceState" : "pushState"]({}, "", path);
    }
    setRoute(parsePath(path));
  }, []);

  return [route, navigate];
}
