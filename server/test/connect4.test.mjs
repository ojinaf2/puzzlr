/* Connect 4 rules, checked directly. Run with: node test/connect4.test.mjs */

import { GAMES } from '../src/games.js';

let passed = 0, failed = 0;
const check = (label, ok, detail = '') => {
  if (ok) { passed++; console.log('  PASS  ' + label); }
  else { failed++; console.log('  FAIL  ' + label + (detail ? '  -> ' + detail : '')); }
};

const c4 = GAMES.connect4;
const COLS = 7, ROWS = 6;
const at = (board, r, c) => board[r * COLS + c];

const makeRoom = () => {
  const room = {
    gameId: 'connect4', status: 'playing',
    players: [
      { id: 'red', name: 'Red', seat: 0, connected: true, lastSeen: Date.now() },
      { id: 'yel', name: 'Yellow', seat: 1, connected: true, lastSeen: Date.now() },
    ],
    game: c4.create(),
  };
  room.game = c4.start(room);
  return room;
};
const drop = (room, who, column) => c4.move(room, room.players.find((p) => p.id === who), { column });

console.log('\n— board shape and gravity —');
{
  const r = makeRoom();
  check('the board is 7 by 6', r.game.board.length === 42);
  drop(r, 'red', 3);
  check('the first disc lands on the floor', at(r.game.board, 5, 3) === 'R', JSON.stringify(r.game.board.slice(35)));
  drop(r, 'yel', 3);
  check('the next stacks on top of it', at(r.game.board, 4, 3) === 'Y');
  check('it does not float higher', at(r.game.board, 3, 3) === null);
}

console.log('\n— turn order and illegal drops —');
{
  const r = makeRoom();
  check('seat 1 cannot open', !!drop(r, 'yel', 0).error);
  check('seat 0 can', !drop(r, 'red', 0).error);
  check('seat 0 cannot go twice', !!drop(r, 'red', 1).error);
  check('a column off the board is refused', !!drop(r, 'yel', 7).error);
  check('a negative column is refused', !!drop(r, 'yel', -1).error);
  check('a non-integer column is refused', !!drop(r, 'yel', 2.5).error);
}

console.log('\n— a full column is refused —');
{
  const r = makeRoom();
  for (let i = 0; i < 3; i++) { drop(r, 'red', 0); drop(r, 'yel', 0); }
  const filled = r.game.board.filter((c, i) => i % COLS === 0 && c).length;
  check('six discs fill the column', filled === 6, String(filled));
  const who = r.game.turnSeat === 0 ? 'red' : 'yel';
  check('a seventh is refused', !!drop(r, who, 0).error);
}

console.log('\n— winning —');
{
  // Horizontal: red takes columns 0-3 on the bottom row, yellow answers up top.
  const r = makeRoom();
  drop(r, 'red', 0); drop(r, 'yel', 0);
  drop(r, 'red', 1); drop(r, 'yel', 1);
  drop(r, 'red', 2); drop(r, 'yel', 2);
  const res = drop(r, 'red', 3);
  check('four across wins', r.game.winner === 'red', String(r.game.winner));
  check('the round ends', res.over === true);
  check('the winning four are reported', r.game.line?.length === 4, JSON.stringify(r.game.line));
  check('the tally moves', r.game.wins.red === 1, JSON.stringify(r.game.wins));
}
{
  // Vertical: red stacks one column while yellow plays elsewhere.
  const r = makeRoom();
  drop(r, 'red', 2); drop(r, 'yel', 3);
  drop(r, 'red', 2); drop(r, 'yel', 3);
  drop(r, 'red', 2); drop(r, 'yel', 3);
  const res = drop(r, 'red', 2);
  check('four stacked wins', r.game.winner === 'red' && res.over === true);
}
{
  // Diagonal going up to the right.
  const r = makeRoom();
  drop(r, 'red', 0);                        // (5,0)
  drop(r, 'yel', 1);                        // (5,1)
  drop(r, 'red', 1);                        // (4,1)
  drop(r, 'yel', 2);                        // (5,2)
  drop(r, 'red', 3);                        // (5,3) filler
  drop(r, 'yel', 2);                        // (4,2)
  drop(r, 'red', 2);                        // (3,2)
  drop(r, 'yel', 3);                        // (4,3)
  drop(r, 'red', 4);                        // (5,4) filler
  drop(r, 'yel', 3);                        // (3,3)
  const res = drop(r, 'red', 3);            // (2,3) completes (5,0)(4,1)(3,2)(2,3)
  check('four on a diagonal wins', r.game.winner === 'red', String(r.game.winner));
  check('and it ends the round', res.over === true);
}

console.log('\n— no false positives —');
{
  const r = makeRoom();
  drop(r, 'red', 0); drop(r, 'yel', 1);
  drop(r, 'red', 2); drop(r, 'yel', 3);
  check('three of a colour with a gap is not a win', r.game.winner === null);
  check('play continues', !drop(r, 'red', 4).error);
}

console.log('\n— play stops once the round is over —');
{
  const r = makeRoom();
  drop(r, 'red', 0); drop(r, 'yel', 0);
  drop(r, 'red', 1); drop(r, 'yel', 1);
  drop(r, 'red', 2); drop(r, 'yel', 2);
  drop(r, 'red', 3);
  check('the game is won', r.game.winner === 'red');
  check('further drops are refused', !!drop(r, 'yel', 5).error);
}

console.log('\n— rematch and forfeit —');
{
  const r = makeRoom();
  drop(r, 'red', 0); drop(r, 'yel', 0);
  drop(r, 'red', 1); drop(r, 'yel', 1);
  drop(r, 'red', 2); drop(r, 'yel', 2);
  drop(r, 'red', 3);
  r.game = c4.start(r, r.game);
  check('the board is cleared', r.game.board.every((c) => c === null));
  check('the score carries over', r.game.wins.red === 1, JSON.stringify(r.game.wins));
  check('the other player starts', r.game.startSeat === 1 && r.game.turnSeat === 1);
  check('no stale last move', r.game.lastMove === null);

  drop(r, 'yel', 0);
  c4.forfeit(r, r.players[1]);
  check('abandoning hands the win over', r.game.winner === 'red', String(r.game.winner));
  check('the forfeit is recorded', r.game.forfeitedBy === 'yel');
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
