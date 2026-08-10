import { useState, useEffect, useCallback } from 'react';

/* ============================= ROUTER =============================
   A tiny History API router — no dependency, because the whole app only
   needs three shapes of URL:

     /                     the landing page
     /wordle               a game, played locally on this device
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

/* pathname -> { gameId, roomCode } */
export const parsePath = (pathname) => {
  const [gameId = "", raw = ""] = pathname.split("/").filter(Boolean);
  const roomCode = raw.toUpperCase();
  return {
    gameId: gameId || null,
    roomCode: isRoomCode(roomCode) ? roomCode : null,
  };
};

export const buildPath = (gameId, roomCode) =>
  !gameId ? "/" : roomCode ? `/${gameId}/${roomCode}` : `/${gameId}`;

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
