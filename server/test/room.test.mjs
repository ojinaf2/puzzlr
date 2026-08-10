/* End-to-end test of the room server: boots the Worker in Miniflare, opens real
   WebSocket connections for two players and plays actual games through them.
   Run with:  npm test  (from the server/ folder) */

import { Miniflare } from 'miniflare';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

let passed = 0, failed = 0;
const check = (label, ok, detail = '') => {
  if (ok) { passed++; console.log('  PASS  ' + label); }
  else { failed++; console.log('  FAIL  ' + label + (detail ? '  -> ' + detail : '')); }
};

// Bundle the worker (it imports games.js) into a single ES module for Miniflare.
const bundled = await build({
  entryPoints: [path.join(root, 'src/index.js')],
  bundle: true, format: 'esm', write: false, platform: 'neutral', target: 'es2022',
});
const script = bundled.outputFiles[0].text;

const mf = new Miniflare({
  modules: true,
  script,
  durableObjects: { ROOMS: { className: 'Room', useSQLite: true } },
  compatibilityDate: '2025-06-01',
});
await mf.ready;

/* A test client: connects, and lets us await the next state snapshot. */
async function connect(code) {
  const res = await mf.dispatchFetch(`http://x/room/${code}`, { headers: { Upgrade: 'websocket' } });
  const ws = res.webSocket;
  ws.accept();
  const inbox = [];
  const waiters = [];
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (waiters.length) waiters.shift()(msg); else inbox.push(msg);
  });
  return {
    ws,
    send: (o) => ws.send(JSON.stringify(o)),
    next: (timeout = 2000) => new Promise((resolve, reject) => {
      if (inbox.length) return resolve(inbox.shift());
      const t = setTimeout(() => reject(new Error('timed out waiting for a message')), timeout);
      waiters.push((m) => { clearTimeout(t); resolve(m); });
    }),
    // Skip ahead to the next 'state' message, ignoring anything else.
    nextState: async function (timeout = 2000) {
      for (let i = 0; i < 10; i++) {
        const m = await this.next(timeout);
        if (m.type === 'state') return m;
      }
      throw new Error('no state message');
    },
    close: () => ws.close(),
  };
}

console.log('\n— health —');
{
  const res = await mf.dispatchFetch('http://x/health');
  check('health endpoint responds', res.status === 200);
  const bad = await mf.dispatchFetch('http://x/room/short');
  check('malformed room path is rejected', bad.status === 404);
}

console.log('\n— two players join and the game auto-starts —');
let a, b;
{
  a = await connect('ABCD24');
  a.send({ type: 'join', code: 'ABCD24', gameId: 'tictactoe', playerId: 'p-alice', name: 'Alice' });
  let s = await a.nextState();
  check('first player lands in the lobby', s.room.status === 'lobby', s.room.status);
  check('first player becomes host', s.room.hostId === 'p-alice');

  b = await connect('ABCD24');
  b.send({ type: 'join', code: 'ABCD24', gameId: 'tictactoe', playerId: 'p-bob', name: 'Bob' });
  s = await b.nextState();
  check('two players auto-start the game', s.room.status === 'playing', s.room.status);
  check('seats assigned in join order', s.room.players.map(p => p.seat).join(',') === '0,1');
  await a.nextState(); // Alice is told too
}

console.log('\n— the server enforces the rules —');
{
  b.send({ type: 'move', index: 0 });           // Bob is seat 1, so not his turn
  const err = await b.next();
  check('moving out of turn is refused', err.type === 'error', JSON.stringify(err));

  a.send({ type: 'move', index: 0 });
  let s = await a.nextState();
  check('a legal move is applied', s.room.game.board[0] === 'X', JSON.stringify(s.room.game.board));
  await b.nextState();

  b.send({ type: 'move', index: 0 });           // already occupied
  const err2 = await b.next();
  check('playing an occupied square is refused', err2.type === 'error', JSON.stringify(err2));

  a.send({ type: 'move', index: 4 });           // still Bob's turn
  const err3 = await a.next();
  check('taking two turns in a row is refused', err3.type === 'error', JSON.stringify(err3));
}

console.log('\n— playing a game out to a win —');
{
  // Alice already has 0. X: 0,1,2 across the top. O answers on the middle row.
  b.send({ type: 'move', index: 3 }); await b.nextState(); await a.nextState();
  a.send({ type: 'move', index: 1 }); await a.nextState(); await b.nextState();
  b.send({ type: 'move', index: 4 }); await b.nextState(); await a.nextState();
  a.send({ type: 'move', index: 2 });
  const s = await a.nextState();
  check('the winner is recorded', s.room.game.winner === 'p-alice', String(s.room.game.winner));
  check('the winning line is reported', JSON.stringify(s.room.game.line) === '[0,1,2]', JSON.stringify(s.room.game.line));
  check('the room is marked over', s.room.status === 'over', s.room.status);
  check('the tally increments once', s.room.game.wins['p-alice'] === 1, JSON.stringify(s.room.game.wins));
  await b.nextState();
}

console.log('\n— rematch keeps the score and alternates who starts —');
{
  a.send({ type: 'rematch' });
  const s = await a.nextState();
  await b.nextState();
  check('the board is cleared', s.room.game.board.every((c) => c === null));
  check('the score carries over', s.room.game.wins['p-alice'] === 1, JSON.stringify(s.room.game.wins));
  check('the other player starts this time', s.room.game.startSeat === 1, String(s.room.game.startSeat));
  check('play resumes', s.room.status === 'playing', s.room.status);
}

console.log('\n— dropping out and coming back —');
{
  b.close();
  const s = await a.nextState(3000);
  const bob = s.room.players.find((p) => p.id === 'p-bob');
  check('the dropped player is flagged, not removed', bob && bob.connected === false, JSON.stringify(bob));
  check('their seat is kept', s.room.players.length === 2);

  // Same playerId, as a browser refresh would send.
  const b2 = await connect('ABCD24');
  b2.send({ type: 'join', code: 'ABCD24', gameId: 'tictactoe', playerId: 'p-bob', name: 'Bob' });
  const s2 = await b2.nextState();
  const bobBack = s2.room.players.find((p) => p.id === 'p-bob');
  check('rejoining restores the same seat', bobBack.seat === 1 && bobBack.connected === true, JSON.stringify(bobBack));
  check('the game in progress is still there', s2.room.status === 'playing', s2.room.status);
  b = b2;
  await a.nextState();
}

console.log('\n— a third player cannot barge in —');
{
  const c = await connect('ABCD24');
  c.send({ type: 'join', code: 'ABCD24', gameId: 'tictactoe', playerId: 'p-carol', name: 'Carol' });
  const m = await c.next();
  check('a full/started room turns away newcomers', m.type === 'error', JSON.stringify(m));
  c.close();
}

console.log('\n— claiming a win is refused while the opponent is present —');
{
  a.send({ type: 'claim' });
  const m = await a.next();
  check('cannot claim against a connected player', m.type === 'error', JSON.stringify(m));
}

console.log('\n— rooms are namespaced by code —');
{
  const d = await connect('ZZZZZZ');
  d.send({ type: 'join', code: 'ZZZZZZ', gameId: 'tictactoe', playerId: 'p-dave', name: 'Dave' });
  const s = await d.nextState();
  check('a different code is a different room', s.room.players.length === 1, String(s.room.players.length));
  check('and it starts in its own lobby', s.room.status === 'lobby', s.room.status);
  d.close();
}

console.log('\n— a mismatched game id is rejected —');
{
  const e = await connect('QQQQQQ');
  e.send({ type: 'join', code: 'QQQQQQ', gameId: 'tictactoe', playerId: 'p-x' });
  await e.nextState();
  const f = await connect('QQQQQQ');
  f.send({ type: 'join', code: 'QQQQQQ', gameId: 'connect4', playerId: 'p-y' });
  const m = await f.next();
  check('joining with the wrong game is refused', m.type === 'error', JSON.stringify(m));
  e.close(); f.close();
}

await mf.dispose();
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
