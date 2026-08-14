import { roomServerUrl, myPlayerId } from './useRoom.js';

/* ============================= FINDING A ROOM =============================

   Everything that happens before you are in a room: browsing what is open,
   and testing a code someone gave you.

   The browse list is plain HTTP rather than the game websocket, deliberately.
   A player reading the list has not joined anything yet, and opening a room
   socket to ask "what rooms exist?" would create rooms as a side effect of
   asking about them.                                                       */

// The websocket URL is the configured one; the HTTP origin is the same host.
const httpBase = () => {
  const ws = roomServerUrl();
  return ws ? ws.replace(/^ws/, 'http') : null;
};

export async function listRooms(gameId, { signal } = {}) {
  const base = httpBase();
  if (!base) return [];
  const res = await fetch(`${base}/rooms?gameId=${encodeURIComponent(gameId)}`, { signal });
  if (!res.ok) throw new Error('Could not reach the room server.');
  const data = await res.json();
  return Array.isArray(data.rooms) ? data.rooms : [];
}

/* Tries a code and reports back what happened.

   This does not merely check the code — it performs the actual join, and the
   caller navigates into the room on success. Doing it that way is what makes
   "no room found" possible to show *on the form*, next to the box you typed
   into, rather than after dropping you into a room screen that then fails.

   Reconnecting afterwards is free: the seat is keyed by player id, so the
   real connection reclaims the same seat a moment later. */
export function joinRoom({ gameId, code, name, create = false, visibility = 'public' }) {
  return new Promise((resolve) => {
    const base = roomServerUrl();
    if (!base) return resolve({ ok: false, message: 'Online play is not configured.' });

    let ws;
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws?.close(); } catch { /* already gone */ }
      resolve(result);
    };

    const timer = setTimeout(
      () => finish({ ok: false, message: 'The room server did not answer. Try again.' }),
      8000);

    try { ws = new WebSocket(`${base}/room/${code}`); }
    catch { return finish({ ok: false, message: 'Could not reach the room server.' }); }

    ws.onopen = () => ws.send(JSON.stringify({
      type: 'join', code, gameId, playerId: myPlayerId(), name, create, visibility,
    }));

    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.type === 'state') return finish({ ok: true });
      if (msg.type === 'error') return finish({ ok: false, code: msg.code, message: msg.message });
    };

    ws.onerror = () => finish({ ok: false, message: 'Could not reach the room server.' });
    ws.onclose = () => finish({ ok: false, message: 'The connection closed before the room answered.' });
  });
}

/* What the real connection should say when it opens. A host has to keep
   asking to create for as long as the room might not exist yet; a joiner must
   never create, or a mistyped code silently becomes an empty room. Kept in
   memory only: after a reload the room genuinely exists, so joining is right. */
const intents = new Map();

export const setIntent = (code, intent) => intents.set(code, intent);
export const getIntent = (code) => intents.get(code) ?? { create: false, visibility: 'public' };

export const CODE_RE = /^[A-Z0-9]{6}$/;
export const cleanCode = (raw) => raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
