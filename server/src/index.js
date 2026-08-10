/* ============================= PUZZLR ROOM SERVER =============================
   One Cloudflare Durable Object per room code. The object is the referee: it
   owns the board, decides whose turn it is and rejects anything illegal, so a
   player cannot win by editing their own client.

   Connect with:  wss://<host>/room/ABCD24

   The WebSocket Hibernation API is used throughout, which means an idle room
   costs nothing and can be evicted from memory without dropping its players.
   Because of that eviction, room state lives in storage rather than on `this`. */

import { GAMES } from './games.js';

const MAX_IDLE_MS = 30 * 60 * 1000;   // rooms are forgotten after half an hour of silence
const GRACE_MS = 90 * 1000;           // a dropped player keeps their seat this long

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
    const roundAt = room.status === 'playing' ? room.game?.roundEndsAt : null;
    await this.ctx.storage.setAlarm(roundAt ? Math.min(idleAt, roundAt) : idleAt);
  }

  fresh(code, gameId) {
    return {
      code,
      gameId,
      hostId: null,
      status: 'lobby',                // lobby | playing | over
      players: [],                    // { id, name, seat, connected, lastSeen }
      game: GAMES[gameId].create(),
      updatedAt: Date.now(),
    };
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
      if (!room) room = this.fresh(msg.code, gameId);
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
        room.game = def.start(room);
      }

      await this.save(room);
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
      room.game = def.start(room);
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
    if (room.status === 'playing' && room.game?.roundEndsAt && now >= room.game.roundEndsAt && def.timeUp) {
      const result = def.timeUp(room);
      if (result?.over) room.status = 'over';
      await this.save(room);
      this.broadcast(room);
      return;
    }

    if (now - room.updatedAt >= MAX_IDLE_MS) {
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

    if (url.pathname === '/health') {
      return new Response('ok', { headers: { 'access-control-allow-origin': '*' } });
    }

    const match = url.pathname.match(/^\/room\/([A-Z0-9]{6})$/);
    if (!match) return new Response('not found', { status: 404 });

    const id = env.ROOMS.idFromName(match[1]);
    return env.ROOMS.get(id).fetch(request);
  },
};
