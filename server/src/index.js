/* ============================= PUZZLR ROOM SERVER =============================
   One Cloudflare Durable Object per room code. The object is the referee: it
   owns the board, decides whose turn it is and rejects anything illegal, so a
   player cannot win by editing their own client.

   Connect with:  wss://<host>/room/ABCD24

   The WebSocket Hibernation API is used throughout, which means an idle room
   costs nothing and can be evicted from memory without dropping its players.
   Because of that eviction, room state lives in storage rather than on `this`. */

import { GAMES } from './games.js';
import { boardOf } from '../../src/data/leaderboards.js';

/* Wrangler binds a Durable Object by finding its class exported from the
   entry module, so the leaderboard is re-exported here even though nothing in
   this file constructs one. */
export { Leaderboard } from './leaderboard.js';

const MAX_IDLE_MS = 30 * 60 * 1000;   // rooms are forgotten after half an hour of silence
const GRACE_MS = 90 * 1000;           // a dropped player keeps their seat this long
const LISTING_STALE_MS = 2 * 60 * 1000;  // a listing nobody has refreshed is presumed dead
const MAX_LISTED = 60;                   // a browse list longer than this helps nobody

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

/* ============================= THE DIRECTORY =============================
   A single Durable Object listing rooms that are open to join.

   It exists because Durable Objects cannot see one another: each room is its
   own isolated object, so "show me the open rooms" has no answer unless
   somebody keeps a list. Rooms announce themselves here whenever their player
   count or status changes, and withdraw when they start, empty or expire.

   The list is advisory, never authoritative. A room can fill or start in the
   moment between listing and tapping it, so joining still goes through the
   room itself and can still be refused. Entries are also pruned on read: a
   room that dies without withdrawing (an eviction, a crash) would otherwise
   sit in the list forever. */
export class Directory {
  constructor(ctx) {
    this.ctx = ctx;
  }

  async rooms() {
    return (await this.ctx.storage.get('rooms')) ?? {};
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/announce') {
      const entry = await request.json();
      const rooms = await this.rooms();
      rooms[entry.code] = { ...entry, updatedAt: Date.now() };
      await this.ctx.storage.put('rooms', rooms);
      return json({ ok: true });
    }

    if (url.pathname === '/withdraw') {
      const { code } = await request.json();
      const rooms = await this.rooms();
      delete rooms[code];
      await this.ctx.storage.put('rooms', rooms);
      return json({ ok: true });
    }

    if (url.pathname === '/list') {
      const gameId = url.searchParams.get('gameId');
      const rooms = await this.rooms();
      const now = Date.now();
      let pruned = false;

      const open = [];
      for (const [code, entry] of Object.entries(rooms)) {
        if (now - entry.updatedAt > LISTING_STALE_MS) { delete rooms[code]; pruned = true; continue; }
        if (gameId && entry.gameId !== gameId) continue;
        if (entry.status !== 'lobby' || entry.players >= entry.max) continue;
        /* A private room is listed so you can see somebody is playing, but its
           code never leaves this object. Publishing it made "private" purely
           decorative: the code is the only credential a room has, and it was
           sitting in the browse response for anyone to read and join with.
           Withholding it here is what actually enforces the setting — no
           client, however edited, can join a private room it was not given the
           code for. */
        open.push(entry.visibility === 'private' ? { ...entry, code: undefined } : entry);
      }
      if (pruned) await this.ctx.storage.put('rooms', rooms);

      open.sort((a, b) => b.updatedAt - a.updatedAt);
      return json({ rooms: open.slice(0, MAX_LISTED) });
    }

    return json({ error: 'not found' }, 404);
  }
}

export class Room {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  /* ------------------------------ state ------------------------------ */

  async load() {
    return (await this.ctx.storage.get('room')) ?? null;
  }

  async save(room) {
    room.updatedAt = Date.now();
    await this.ctx.storage.put('room', room);
    // One alarm serves two jobs: ending a timed round, and forgetting an idle
    // room. Whichever comes first wins, and the handler works out which fired.
    const idleAt = Date.now() + MAX_IDLE_MS;
    const def = GAMES[room.gameId];
    const roundAt = room.status === 'playing' ? def?.deadline?.(room) : null;
    await this.ctx.storage.setAlarm(roundAt ? Math.min(idleAt, roundAt) : idleAt);
  }

  fresh(code, gameId, visibility) {
    return {
      code,
      gameId,
      hostId: null,
      visibility: visibility === 'private' ? 'private' : 'public',
      status: 'lobby',                // lobby | playing | over
      players: [],                    // { id, name, seat, connected, lastSeen }
      game: GAMES[gameId].create(),
      updatedAt: Date.now(),
    };
  }

  /* Keep the browse list in step. Called after anything that changes what a
     would-be joiner needs to know: who is hosting, how full it is, whether it
     has started. A room that has started, emptied or ended withdraws itself,
     because listing a room nobody can join is worse than listing nothing. */
  async announce(room) {
    const live = room.players.filter((p) => p.connected).length;
    const joinable = room.status === 'lobby' && live > 0;
    try {
      /* Resolving the binding is inside the try on purpose. If DIRECTORY is
         missing — an un-run migration, an older deploy, a test harness that
         does not bind it — this throws, and a throw out here would take the
         whole join handler down with it. Rooms must keep working over their
         code even with no directory at all. */
      const stub = this.env.DIRECTORY.get(this.env.DIRECTORY.idFromName('v1'));
      if (!joinable) {
        await stub.fetch('https://directory/withdraw', {
          method: 'POST',
          body: JSON.stringify({ code: room.code }),
        });
        return;
      }
      const host = room.players.find((p) => p.id === room.hostId);
      await stub.fetch('https://directory/announce', {
        method: 'POST',
        body: JSON.stringify({
          code: room.code,
          gameId: room.gameId,
          host: host?.name ?? 'Someone',
          players: room.players.length,
          max: GAMES[room.gameId].maxPlayers,
          visibility: room.visibility ?? 'public',
          status: room.status,
        }),
      });
    } catch {
      /* The directory is a convenience. If it is unreachable the room still
         works perfectly over its code — never let this break a game. */
    }
  }

  /* --------------------------- broadcasting --------------------------- */

  // Each player gets their own view, so a game can hide things from opponents.
  broadcast(room) {
    const def = GAMES[room.gameId];
    for (const ws of this.ctx.getWebSockets()) {
      const playerId = ws.deserializeAttachment()?.playerId ?? null;
      const view = def.view ? def.view(room, playerId) : room;
      try {
        ws.send(JSON.stringify({ type: 'state', room: view, you: playerId }));
      } catch { /* socket already gone; close handler will tidy up */ }
    }
  }

  sendTo(ws, payload) {
    try { ws.send(JSON.stringify(payload)); } catch { /* ignore */ }
  }

  /* ---------------------------- messages ---------------------------- */

  async webSocketMessage(ws, raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    let room = await this.load();
    const now = Date.now();

    if (msg.type === 'join') {
      const gameId = msg.gameId;
      if (!GAMES[gameId]) return this.sendTo(ws, { type: 'error', message: 'Unknown game.' });

      /* Hosting and joining are different acts now. Only a host creates; a
         joiner attaching to a code that does not exist is told so, rather than
         being dropped into an empty room of their own making — which is what
         used to happen to anyone who mistyped a code. */
      if (!room) {
        if (!msg.create) {
          return this.sendTo(ws, { type: 'error', code: 'not-found', message: 'No room found with that code.' });
        }
        room = this.fresh(msg.code, gameId, msg.visibility);
      }

      if (room.gameId !== gameId) {
        return this.sendTo(ws, { type: 'error', message: 'That room code is being used by another game.' });
      }

      const def = GAMES[gameId];
      let player = room.players.find((p) => p.id === msg.playerId);

      if (player) {
        player.connected = true;                    // returning after a refresh or dropout
        player.lastSeen = now;
        if (msg.name) player.name = msg.name;
      } else {
        if (room.status !== 'lobby') {
          return this.sendTo(ws, { type: 'error', message: 'That game has already started.' });
        }
        if (room.players.length >= def.maxPlayers) {
          return this.sendTo(ws, { type: 'error', message: 'That room is full.' });
        }
        player = {
          id: msg.playerId,
          name: msg.name || `Player ${room.players.length + 1}`,
          seat: room.players.length,
          connected: true,
          lastSeen: now,
        };
        room.players.push(player);
      }

      if (!room.hostId || !room.players.some((p) => p.id === room.hostId)) room.hostId = player.id;
      ws.serializeAttachment({ playerId: player.id });

      // Two-player games have nothing to configure, so they begin by themselves.
      if (room.status === 'lobby' && def.autoStart && room.players.length === def.maxPlayers) {
        room.status = 'playing';
        room.game = def.start(room, room.game);   // carries anything set in the lobby
      }

      await this.save(room);
      await this.announce(room);
      return this.broadcast(room);
    }

    if (!room) return;
    const playerId = ws.deserializeAttachment()?.playerId;
    const me = room.players.find((p) => p.id === playerId);
    if (!me) return;
    me.lastSeen = now;
    const def = GAMES[room.gameId];

    if (msg.type === 'start') {
      if (room.hostId !== me.id) return this.sendTo(ws, { type: 'error', message: 'Only the host can start.' });
      if (room.players.length < def.minPlayers) {
        return this.sendTo(ws, { type: 'error', message: `Needs at least ${def.minPlayers} players.` });
      }
      room.status = 'playing';
      room.game = def.start(room, room.game);     // whatever the host chose in the lobby
    }

    /* The host can flip the room between listed and code-only at any point in
       the lobby, so the choice sits next to the code rather than being locked
       in before they have seen it. */
    else if (msg.type === 'visibility') {
      if (room.hostId !== me.id) return this.sendTo(ws, { type: 'error', message: 'Only the host can change that.' });
      room.visibility = msg.visibility === 'private' ? 'private' : 'public';
    }

    else if (msg.type === 'config') {
      if (room.hostId !== me.id) return this.sendTo(ws, { type: 'error', message: 'Only the host can change that.' });
      if (!def.config) return;
      const result = def.config(room, msg);
      if (result?.error) return this.sendTo(ws, { type: 'error', message: result.error });
    }

    else if (msg.type === 'move') {
      if (room.status !== 'playing') return;
      const result = def.move(room, me, msg);
      if (result?.error) return this.sendTo(ws, { type: 'error', message: result.error });
      if (result?.over) room.status = 'over';
    }

    else if (msg.type === 'rematch') {
      if (room.status !== 'over') return;
      room.game = def.start(room, room.game);
      room.status = 'playing';
    }

    // Someone vanished mid-turn and did not come back; let the room move on.
    else if (msg.type === 'claim') {
      const stuck = room.players.find((p) => !p.connected && now - p.lastSeen > GRACE_MS);
      if (!stuck) return this.sendTo(ws, { type: 'error', message: 'They are still connected.' });
      const result = def.forfeit ? def.forfeit(room, stuck) : null;
      if (result?.over) room.status = 'over';
    }

    else if (msg.type === 'ping') {
      await this.save(room);
      return this.sendTo(ws, { type: 'pong' });
    }

    await this.save(room);
    await this.announce(room);
    this.broadcast(room);
  }

  async webSocketClose(ws) {
    const playerId = ws.deserializeAttachment()?.playerId;
    const room = await this.load();
    if (!room || !playerId) return;
    const player = room.players.find((p) => p.id === playerId);
    if (!player) return;

    player.connected = false;
    player.lastSeen = Date.now();

    // An empty room is deliberately NOT deleted here. Whoever made it has
    // probably already sent the link out, and a host whose phone locks for a
    // moment should come back to the same room rather than a dead invite.
    // The idle alarm clears it up later instead.

    // The host leaving should not strand everyone else.
    if (room.hostId === playerId) {
      const heir = room.players.find((p) => p.connected);
      if (heir) room.hostId = heir.id;
    }
    await this.save(room);
    await this.announce(room);
    this.broadcast(room);
  }

  async webSocketError(ws) {
    return this.webSocketClose(ws);
  }

  async alarm() {
    const room = await this.load();
    if (!room) return;
    const now = Date.now();
    const def = GAMES[room.gameId];

    // A round clock ran out.
    const deadline = def?.deadline?.(room);
    if (room.status === 'playing' && deadline && now >= deadline && def.timeUp) {
      const result = def.timeUp(room);
      if (result?.over) room.status = 'over';
      await this.save(room);
      this.broadcast(room);
      return;
    }

    if (now - room.updatedAt >= MAX_IDLE_MS) {
      // Take it out of the browse list before the state it was listed from is
      // gone, or it lingers there until the staleness sweep catches it.
      await this.announce({ ...room, status: 'over', players: [] });
      await this.ctx.storage.deleteAll();
      for (const ws of this.ctx.getWebSockets()) {
        try { ws.close(1000, 'Room expired'); } catch { /* ignore */ }
      }
      return;
    }
    await this.ctx.storage.setAlarm(now + MAX_IDLE_MS);   // nothing to do yet; look again later
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    if (url.pathname === '/health') {
      return new Response('ok', { headers: { 'access-control-allow-origin': '*' } });
    }

    /* The browse list. Plain HTTP rather than the websocket, because a player
       reading it has not joined anything yet — opening a room socket just to
       ask what rooms exist would create the very rooms being asked about. */
    if (url.pathname === '/rooms') {
      const stub = env.DIRECTORY.get(env.DIRECTORY.idFromName('v1'));
      const gameId = url.searchParams.get('gameId') ?? '';
      return stub.fetch(`https://directory/list?gameId=${encodeURIComponent(gameId)}`);
    }

    /* The leaderboards. Plain HTTP for the same reason the browse list is:
       reading a table is not joining anything, and a websocket per glance
       would be a lot of machinery for a page that changes once a day.

       One object per game holds every variant of that game's board, so
       switching between Easy and Hard is one object's problem rather than
       three objects' — and a game with a busy board cannot slow down a quiet
       one. Unknown game ids are rejected here rather than being allowed to
       conjure an empty object per typo. */
    const lb = url.pathname.match(/^\/leaderboard\/([A-Za-z0-9_-]{1,32})(\/rename)?$/);
    if (lb) {
      const gameId = lb[1];
      if (!boardOf(gameId)) return json({ error: 'no such leaderboard' }, 404);
      const stub = env.LEADERBOARDS.get(env.LEADERBOARDS.idFromName(`lb:${gameId}`));
      const query = `gameId=${encodeURIComponent(gameId)}`;

      if (lb[2]) {
        if (request.method !== 'POST') return json({ error: 'not found' }, 404);
        return stub.fetch(`https://leaderboard/rename?${query}`, { method: 'POST', body: await request.text() });
      }
      if (request.method === 'POST') {
        return stub.fetch(`https://leaderboard/submit?${query}`, { method: 'POST', body: await request.text() });
      }
      const board = url.searchParams.get('board') ?? '';
      return stub.fetch(`https://leaderboard/list?${query}&board=${encodeURIComponent(board)}`);
    }

    const match = url.pathname.match(/^\/room\/([A-Z0-9]{6})$/);
    if (!match) return new Response('not found', { status: 404 });

    const id = env.ROOMS.idFromName(match[1]);
    return env.ROOMS.get(id).fetch(request);
  },
};
