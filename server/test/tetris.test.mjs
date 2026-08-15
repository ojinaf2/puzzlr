/* Tetris versus rules: the shared seed, the survival verdict, and what the
   object will and will not accept from a client.
   Run with: node test/tetris.test.mjs */

import { GAMES } from '../src/games.js';

let passed = 0, failed = 0;
const check = (label, ok, detail = '') => {
  if (ok) { passed++; console.log('  PASS  ' + label); }
  else { failed++; console.log('  FAIL  ' + label + (detail ? '  -> ' + detail : '')); }
};

const t = GAMES.tetris;

const makeRoom = () => {
  const room = {
    gameId: 'tetris', status: 'playing',
    hostId: 'ana',
    players: [
      { id: 'ana', name: 'Ana', seat: 0, connected: true, lastSeen: Date.now() },
      { id: 'ben', name: 'Ben', seat: 1, connected: true, lastSeen: Date.now() },
    ],
    game: t.create(),
  };
  room.game = t.start(room);
  return room;
};
const send = (room, who, msg) => t.move(room, room.players.find((p) => p.id === who), msg);
const rows = (fill = 0) => Array(20).fill(fill);

console.log('\n— setup —');
{
  const r = makeRoom();
  check('both players get a board', Object.keys(r.game.boards).length === 2);
  check('both start alive', Object.values(r.game.boards).every((b) => b.alive));
  check('both start on nothing', Object.values(r.game.boards).every((b) => b.score === 0 && b.lines === 0));
  check('it starts as soon as the room fills', t.autoStart === true);
  check('two players, no more', t.maxPlayers === 2 && t.minPlayers === 2);
}
{
  // The seed is the whole point: it is what makes both boards the same game.
  const r = makeRoom();
  check('a seed is dealt', Number.isInteger(r.game.seed));
  check('the seed is a sane 32-bit value', r.game.seed >= 0 && r.game.seed < 2 ** 31);
  const seeds = new Set();
  for (let i = 0; i < 40; i++) seeds.add(t.start(makeRoom()).seed);
  check('and it differs between rounds', seeds.size > 30, `${seeds.size}/40 distinct`);
}
{
  const r = makeRoom();
  check('there is a countdown before pieces fall', r.game.startsAt > Date.now() + 1000);
}

console.log('\n— progress reports —');
{
  const r = makeRoom();
  check('a normal report is accepted', !send(r, 'ana', { kind: 'progress', score: 400, lines: 4, level: 1, rows: rows() }).error);
  check('and lands on the right board', r.game.boards.ana.score === 400 && r.game.boards.ana.lines === 4);
  check('without touching the opponent', r.game.boards.ben.score === 0);
}
{
  const r = makeRoom();
  send(r, 'ana', { kind: 'progress', score: 900, lines: 8, level: 2, rows: rows() });
  send(r, 'ana', { kind: 'progress', score: 100, lines: 1, level: 1, rows: rows() });
  check('a score cannot go backwards', r.game.boards.ana.score === 900);
  check('nor can lines', r.game.boards.ana.lines === 8);
  check('nor the level', r.game.boards.ana.level === 2);
}
{
  const r = makeRoom();
  check('a negative score is refused', !!send(r, 'ana', { kind: 'progress', score: -5, lines: 0, level: 1 }).error);
  check('a fractional score is refused', !!send(r, 'ana', { kind: 'progress', score: 1.5, lines: 0, level: 1 }).error);
  check('a missing score is refused', !!send(r, 'ana', { kind: 'progress', lines: 0, level: 1 }).error);
  check('an absurd score is refused', !!send(r, 'ana', { kind: 'progress', score: 1e12, lines: 0, level: 1 }).error);
  check('nothing stuck to the board', r.game.boards.ana.score === 0);
}
{
  const r = makeRoom();
  send(r, 'ana', { kind: 'progress', score: 10, lines: 0, level: 1, rows: rows(1023) });
  check('a full-width row packs to 1023', r.game.boards.ana.rows[0] === 1023);

  send(r, 'ana', { kind: 'progress', score: 20, lines: 0, level: 1, rows: [1, 2, 3] });
  check('a short board is ignored', r.game.boards.ana.rows.length === 20);
  send(r, 'ana', { kind: 'progress', score: 30, lines: 0, level: 1, rows: rows(4096) });
  check('an out-of-range row is ignored', r.game.boards.ana.rows[0] === 1023);
  check('but the score still went up', r.game.boards.ana.score === 30);
}
{
  const r = makeRoom();
  check('an unknown kind is refused', !!send(r, 'ana', { kind: 'garbage' }).error);
}

console.log('\n— topping out —');
{
  const r = makeRoom();
  send(r, 'ana', { kind: 'progress', score: 500, lines: 5, level: 1, rows: rows() });
  const out = send(r, 'ana', { kind: 'topout', score: 500, rows: rows() });
  check('topping out ends the round', out.over === true);
  check('the one still standing wins', r.game.winner === 'ben');
  check('and takes the tally', r.game.wins.ben === 1);
  check('the one who died is marked', r.game.boards.ana.alive === false);
  check('with a time of death', typeof r.game.boards.ana.finishedAt === 'number');
  check('the survivor is untouched', r.game.boards.ben.alive === true);
}
{
  const r = makeRoom();
  send(r, 'ana', { kind: 'topout', score: 100, rows: rows() });
  check('a second report after the round is refused', !!send(r, 'ana', { kind: 'progress', score: 999, lines: 0, level: 1 }).error);
  check('and the opponent cannot carry on either', !!send(r, 'ben', { kind: 'progress', score: 999, lines: 0, level: 1 }).error);
  check('the score did not move', r.game.boards.ben.score === 0);
}
{
  // Losing does not have to mean scoring less — surviving is the whole game.
  const r = makeRoom();
  send(r, 'ana', { kind: 'progress', score: 9000, lines: 40, level: 5, rows: rows() });
  send(r, 'ben', { kind: 'progress', score: 100, lines: 1, level: 1, rows: rows() });
  send(r, 'ana', { kind: 'topout', score: 9000, rows: rows() });
  check('the higher score can still lose', r.game.winner === 'ben');
  check('and the loser keeps their score', r.game.boards.ana.score === 9000);
}

console.log('\n— quitting —');
{
  const r = makeRoom();
  const out = t.forfeit(r, r.players[0]);
  check('walking out hands over the round', out.over === true);
  check('the one who stayed wins', r.game.winner === 'ben');
  check('and it is recorded as a forfeit', r.game.forfeitedBy === 'ana');
}
{
  const r = makeRoom();
  send(r, 'ana', { kind: 'topout', score: 1, rows: rows() });
  const before = JSON.stringify(r.game);
  t.forfeit(r, r.players[0]);
  check('forfeiting a finished round changes nothing', JSON.stringify(r.game) === before);
}

console.log('\n— rounds —');
{
  const r = makeRoom();
  send(r, 'ana', { kind: 'topout', score: 700, rows: rows() });
  const next = t.start(r, r.game);
  check('the tally carries over', next.wins.ben === 1);
  check('the round number climbs', next.roundNo === 2);
  check('everyone is alive again', Object.values(next.boards).every((b) => b.alive));
  check('scores are wiped', Object.values(next.boards).every((b) => b.score === 0));
  // Not "differs from last round" — two random draws may legitimately match,
  // and the 40-sample check above already covers the distribution.
  check('and a seed is dealt again', Number.isInteger(next.seed) && next.seed >= 0);
  check('with a new countdown', next.startsAt > Date.now() + 1000);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
