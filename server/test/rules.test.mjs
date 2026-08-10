/* Tests the server-side rules on their own, with no Workers runtime involved.
   These are the parts that decide who won and whose turn it is, so they are
   worth checking directly. Run with: node test/rules.test.mjs */

import { GAMES } from '../src/games.js';

let passed = 0, failed = 0;
const check = (label, ok, detail = '') => {
  if (ok) { passed++; console.log('  PASS  ' + label); }
  else { failed++; console.log('  FAIL  ' + label + (detail ? '  -> ' + detail : '')); }
};

const ttt = GAMES.tictactoe;

// A stand-in for the room the Durable Object would be holding.
const makeRoom = () => {
  const room = {
    gameId: 'tictactoe',
    status: 'playing',
    players: [
      { id: 'alice', name: 'Alice', seat: 0, connected: true, lastSeen: Date.now() },
      { id: 'bob', name: 'Bob', seat: 1, connected: true, lastSeen: Date.now() },
    ],
    game: ttt.create(),
  };
  room.game = ttt.start(room);
  return room;
};
const play = (room, who, index) => ttt.move(room, room.players.find((p) => p.id === who), { index });

console.log('\n— turn order —');
{
  const r = makeRoom();
  check('seat 0 moves first', r.game.turnSeat === 0);
  check('seat 1 is refused first', !!play(r, 'bob', 0).error);
  check('seat 0 is allowed', !play(r, 'alice', 0).error);
  check('the turn passes over', r.game.turnSeat === 1);
  check('seat 0 cannot move twice', !!play(r, 'alice', 1).error);
}

console.log('\n— illegal moves —');
{
  const r = makeRoom();
  play(r, 'alice', 4);
  check('an occupied square is refused', !!play(r, 'bob', 4).error);
  check('an out-of-range index is refused', !!play(r, 'bob', 9).error);
  check('a negative index is refused', !!play(r, 'bob', -1).error);
  check('a non-integer index is refused', !!play(r, 'bob', 1.5).error);
  check('a missing index is refused', !!ttt.move(r, r.players[1], {}).error);
}

console.log('\n— every winning line is detected —');
{
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  // Squares Bob can safely take without completing a line of his own.
  let allFound = true, allTallied = true;
  for (const line of lines) {
    const r = makeRoom();
    const spare = [0,1,2,3,4,5,6,7,8].filter((i) => !line.includes(i));
    let result;
    for (let i = 0; i < 3; i++) {
      result = play(r, 'alice', line[i]);
      if (i < 2) play(r, 'bob', spare[i]);
    }
    if (r.game.winner !== 'alice' || !result.over) allFound = false;
    if (r.game.wins.alice !== 1) allTallied = false;
  }
  check('all 8 lines produce a win', allFound);
  check('each win increments the tally exactly once', allTallied);
}

console.log('\n— draws —');
{
  const r = makeRoom();
  // X O X / X O O / O X X  — a full board with no line
  const order = [
    ['alice',0],['bob',1],['alice',2],
    ['bob',4],['alice',3],['bob',5],
    ['alice',7],['bob',6],['alice',8],
  ];
  let last;
  for (const [who, i] of order) last = play(r, who, i);
  check('a full board with no line is a draw', r.game.draw === true, JSON.stringify(r.game.board));
  check('a draw has no winner', r.game.winner === null);
  check('a draw ends the round', last.over === true);
  check('a draw scores nobody', r.game.wins.alice === 0 && r.game.wins.bob === 0, JSON.stringify(r.game.wins));
}

console.log('\n— play cannot continue after the round ends —');
{
  const r = makeRoom();
  play(r, 'alice', 0); play(r, 'bob', 3);
  play(r, 'alice', 1); play(r, 'bob', 4);
  play(r, 'alice', 2);
  check('the round is won', r.game.winner === 'alice');
  check('further moves are refused', !!play(r, 'bob', 5).error);
}

console.log('\n— rematch —');
{
  const r = makeRoom();
  play(r, 'alice', 0); play(r, 'bob', 3);
  play(r, 'alice', 1); play(r, 'bob', 4);
  play(r, 'alice', 2);
  r.game = ttt.start(r, r.game);
  check('the board is cleared', r.game.board.every((c) => c === null));
  check('the score is carried over', r.game.wins.alice === 1, JSON.stringify(r.game.wins));
  check('the loser starts the next round', r.game.startSeat === 1 && r.game.turnSeat === 1);

  r.game = ttt.start(r, r.game);
  check('and it alternates back again', r.game.startSeat === 0);
}

console.log('\n— forfeit when somebody abandons the game —');
{
  const r = makeRoom();
  play(r, 'alice', 0);
  const res = ttt.forfeit(r, r.players[0]);          // Alice walks away
  check('the remaining player wins', r.game.winner === 'bob', String(r.game.winner));
  check('the forfeit is recorded', r.game.forfeitedBy === 'alice');
  check('it counts on the scoreboard', r.game.wins.bob === 1, JSON.stringify(r.game.wins));
  check('the round is over', res.over === true);

  const finished = makeRoom();
  play(finished, 'alice', 0); play(finished, 'bob', 3);
  play(finished, 'alice', 1); play(finished, 'bob', 4);
  play(finished, 'alice', 2);
  ttt.forfeit(finished, finished.players[1]);
  check('forfeiting an already-won game changes nothing', finished.game.winner === 'alice' && finished.game.wins.alice === 1);
}

console.log('\n— a late joiner gets a scoreboard entry —');
{
  const r = makeRoom();
  play(r, 'alice', 0); play(r, 'bob', 3);
  play(r, 'alice', 1); play(r, 'bob', 4);
  play(r, 'alice', 2);
  r.players.push({ id: 'carol', name: 'Carol', seat: 2, connected: true, lastSeen: Date.now() });
  r.game = ttt.start(r, r.game);
  check('the new player starts on zero', r.game.wins.carol === 0, JSON.stringify(r.game.wins));
  check('existing scores are untouched', r.game.wins.alice === 1);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
