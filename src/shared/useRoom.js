import { useState, useEffect, useRef, useCallback } from 'react';
import { getIntent } from './rooms.js';
import { myPlayerId } from './identity.js';

/* ============================= ROOM CONNECTION =============================
   Talks to the Durable Object that runs a room. The server is the referee, so
   this file deliberately holds no rules — it sends intents and renders back
   whatever snapshot the server returns.

   Reconnection is the whole point of the design: phones lose signal, tabs get
   backgrounded, and a dropped socket should never cost you your seat. The
   player id is kept in localStorage, so reconnecting reclaims the same seat. */

const DEV_HOSTS = ['localhost', '127.0.0.1'];

export const roomServerUrl = () => {
  const configured = import.meta.env.VITE_ROOM_SERVER;
  if (configured) return configured.replace(/\/$/, '');
  if (DEV_HOSTS.includes(window.location.hostname)) return 'ws://127.0.0.1:8787';
  return null;   // production URL not set yet; the UI explains rather than hanging
};

/* The websocket URL is the configured one; the HTTP origin is the same host.
   Shared with rooms.js and the leaderboard, which both talk to this Worker
   over plain HTTP rather than a socket. */
export const httpBase = () => {
  const ws = roomServerUrl();
  return ws ? ws.replace(/^ws/, 'http') : null;
};

/* status: 'needs-name' | 'connecting' | 'open' | 'reconnecting' | 'offline' | 'unconfigured' */
export function useRoom({ gameId, roomCode, name }) {
  const [status, setStatus] = useState('connecting');
  const [room, setRoom] = useState(null);
  const [error, setError] = useState(null);
  // Kept beside the message so callers can branch without matching prose.
  const [errorCode, setErrorCode] = useState(null);
  const wsRef = useRef(null);
  const attemptRef = useRef(0);
  const closedRef = useRef(false);
  const playerId = useRef(myPlayerId()).current;

  useEffect(() => {
    if (!roomCode || !gameId) return;
    const base = roomServerUrl();
    if (!base) { setStatus('unconfigured'); return; }
    // Collect a name before taking a seat, so nobody shows up as "Player 2".
    if (!name) { setStatus('needs-name'); return; }
    setStatus('connecting');

    closedRef.current = false;
    let heartbeat = null;
    let retry = null;

    const open = () => {
      const ws = new WebSocket(`${base}/room/${roomCode}`);
      wsRef.current = ws;

      ws.onopen = () => {
        attemptRef.current = 0;
        setStatus('open');
        setError(null);
        /* The intent matters on every reconnect, not just the first join: a
           host whose socket drops before anyone else arrives must still be
           allowed to recreate the room, while a joiner must never create one. */
        const intent = getIntent(roomCode);
        ws.send(JSON.stringify({ type: 'join', code: roomCode, gameId, playerId, name, ...intent }));
        // Keeps intermediaries from culling an idle socket mid-game.
        heartbeat = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
        }, 25000);
      };

      ws.onmessage = (e) => {
        let msg;
        try { msg = JSON.parse(e.data); } catch { return; }
        if (msg.type === 'state') { setRoom(msg.room); setError(null); setErrorCode(null); }
        else if (msg.type === 'error') { setError(msg.message); setErrorCode(msg.code ?? null); }
      };

      ws.onclose = () => {
        clearInterval(heartbeat);
        if (closedRef.current) return;
        // Back off, but keep trying: a phone in a tunnel should recover on its own.
        const wait = Math.min(1000 * 2 ** attemptRef.current, 10000);
        attemptRef.current += 1;
        setStatus(attemptRef.current > 4 ? 'offline' : 'reconnecting');
        retry = setTimeout(open, wait);
      };

      ws.onerror = () => { try { ws.close(); } catch { /* onclose handles it */ } };
    };

    open();
    return () => {
      closedRef.current = true;
      clearInterval(heartbeat);
      clearTimeout(retry);
      try { wsRef.current?.close(); } catch { /* already gone */ }
    };
  }, [gameId, roomCode, playerId, name]);

  const send = useCallback((msg) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  const me = room?.players.find((p) => p.id === playerId) ?? null;
  return { status, room, me, playerId, error, errorCode, send };
}
