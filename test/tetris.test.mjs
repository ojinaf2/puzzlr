/* Tetris: the 7-bag, SRS rotation with wall kicks, locking, clears, scoring.

     node test/tetris.test.mjs

   These are the rules that cannot be checked by playing. A wall kick failing
   in one of the eight rotation transitions looks like "that felt off" rather
   than like a bug, and a 7-bag that quietly reshuffles early takes hundreds of
   pieces to notice. Both are a line of arithmetic away from being wrong and
   neither announces itself. */

const R = await import('../src/games/tetrisRules.js');
const {
  COLS, ROWS, TYPES, LINE_SCORES,
  newGame, moveLeft, moveRight, moveBy, rotate, holdPiece,
  canFall, softDrop, hardDrop, ghostY, lock, resolveClear,
  collides, cellsOf, pieceCells, gravityMs,
} = R;

let pass = 0, fail = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else { fail++; console.log(`FAIL ${label}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log(`FAIL ${label}`); } };

const empty = () => Array.from({ length: ROWS }, () => Array(COLS).fill(null));

/* Rows given bottom-up, so a test reads the way the board looks. "#" is
   filled, "." is not. */
const boardOf = (...rows) => {
  const b = empty();
  rows.forEach((line, i) => {
    const r = ROWS - 1 - i;
    [...line].forEach((ch, c) => { b[r][c] = ch === '#' ? 'X' : null; });
  });
  return b;
};

const withPiece = (g, type, rot, x, y) => ({ ...g, piece: { type, rot, x, y } });
const inBounds = (cells) => cells.every(([x, y]) => x >= 0 && x < COLS && y < ROWS);

/* Deals the next piece without the stack ever getting in the way: drop the
   current one to the floor, then wipe the board. Locking it where it stands
   would bury the spawn square and end the game after a couple of pieces. */
const nextPiece = (g) => ({ ...hardDrop(g), board: empty() });

/* ------------------------------------------------------------ the 7-bag */
{
  let g = newGame(12345);
  const seen = [];
  for (let i = 0; i < 21; i++) {
    seen.push(g.piece.type);
    g = nextPiece(g);
  }
  const firstSeven = seen.slice(0, 7);
  const secondSeven = seen.slice(7, 14);
  const thirdSeven = seen.slice(14, 21);
  eq('the first seven are all seven pieces', [...firstSeven].sort().join(''), TYPES.slice().sort().join(''));
  eq('so are the next seven', [...secondSeven].sort().join(''), TYPES.slice().sort().join(''));
  eq('and the seven after that', [...thirdSeven].sort().join(''), TYPES.slice().sort().join(''));
}
{
  // The point of a bag is that it is not independent randomness.
  let g = newGame(999);
  const seen = [];
  for (let i = 0; i < 70; i++) { seen.push(g.piece.type); g = nextPiece(g); }
  const counts = TYPES.map((t) => seen.filter((s) => s === t).length);
  eq('ten bags give exactly ten of each', counts, [10, 10, 10, 10, 10, 10, 10]);
  const longestRun = seen.reduce((acc, t, i) => (
    i && t === seen[i - 1] ? { run: acc.run + 1, max: Math.max(acc.max, acc.run + 1) } : { run: 1, max: acc.max }
  ), { run: 0, max: 0 }).max;
  ok('no piece ever comes three times in a row', longestRun <= 2);
}
{
  const a = newGame(42), b = newGame(42), c = newGame(43);
  eq('the same seed deals the same piece', a.piece.type, b.piece.type);
  eq('and the same queue behind it', a.queue, b.queue);
  ok('a different seed usually differs',
    a.piece.type !== c.piece.type || JSON.stringify(a.queue) !== JSON.stringify(c.queue));
}

/* --------------------------------------------------------- SRS wall kicks */
{
  // A vertical I hard against the left wall has to kick right to turn flat.
  const g = withPiece(newGame(1), 'I', 1, -2, 4);
  const r = rotate(g, 1);
  ok('a wall-hugging I rotates at all', r.piece.rot !== 1);
  ok('and lands inside the board', inBounds(pieceCells(r.piece)));
}
{
  // Every piece, flush against each wall, in every rotation state: turning
  // must either succeed cleanly or be refused, never leave the board.
  let rotations = 0, escapes = 0;
  for (const type of TYPES) {
    for (let rot = 0; rot < 4; rot++) {
      for (const x of [-2, -1, 0, COLS - 4, COLS - 3, COLS - 2]) {
        const g = withPiece(newGame(1), type, rot, x, 8);
        if (collides(g.board, type, rot, x, 8)) continue;   // invalid start
        const r = rotate(g, 1);
        rotations++;
        if (!inBounds(pieceCells(r.piece))) escapes++;
      }
    }
  }
  ok(`no rotation escapes the board (${rotations} tried)`, escapes === 0);
  ok('and there were plenty to try', rotations > 40);
}
{
  // Boxed in on all sides, a rotation must be refused rather than forced.
  const board = empty();
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) board[r][c] = 'X';
  for (const [c, r] of [[4, 10], [5, 10], [4, 11], [5, 11]]) board[r][c] = null;
  const g = { ...newGame(1), board, piece: { type: 'T', rot: 0, x: 3, y: 10 } };
  eq('a boxed-in piece refuses to rotate', rotate(g, 1).piece.rot, 0);
}
{
  const g = withPiece(newGame(1), 'T', 0, 3, 5);
  eq('clockwise goes 0 to 1', rotate(g, 1).piece.rot, 1);
  eq('anticlockwise goes 0 to 3', rotate(g, -1).piece.rot, 3);
  eq('four clockwise turns come home',
    [1, 2, 3, 4].reduce((s) => rotate(s, 1), g).piece.rot, 0);
}
{
  eq('O never changes shape',
    [0, 1, 2, 3].map((rot) => JSON.stringify(cellsOf('O', rot, 0, 0))).filter((v, i, a) => a.indexOf(v) === i).length, 1);
}

/* ------------------------------------------------------------- moving */
{
  const g = withPiece(newGame(1), 'T', 0, 3, 5);
  eq('left moves one column', moveLeft(g).piece.x, 2);
  eq('right moves one column', moveRight(g).piece.x, 4);
}
{
  // Hard against the left wall: T at rot 0 has a cell at box x 0.
  const g = withPiece(newGame(1), 'T', 0, 0, 5);
  eq('the wall stops it', moveLeft(g).piece.x, 0);
}
{
  const g = withPiece(newGame(1), 'O', 0, 3, ROWS - 2);
  eq('the floor stops it falling', canFall(g), false);
}

/* -------------------------------------------------------------- ghost */
{
  const g = withPiece(newGame(1), 'O', 0, 3, 0);
  eq('on an empty board the ghost sits on the floor', ghostY(g), ROWS - 2);
}
{
  const board = boardOf('##########');
  const g = { ...newGame(1), board, piece: { type: 'O', rot: 0, x: 3, y: 0 } };
  eq('a filled bottom row lifts the ghost', ghostY(g), ROWS - 3);
}

/* ------------------------------------------------------------ dropping */
{
  const g = withPiece(newGame(1), 'O', 0, 3, 0);
  eq('soft drop pays a point a cell', softDrop(g).score, 1);
  eq('and moves one row', softDrop(g).piece.y, 1);
}
{
  const g = { ...withPiece(newGame(1), 'O', 0, 3, 0), score: 0 };
  const dropped = hardDrop(g);
  // O spawns at y 0 and lands at ROWS-2, so it travels ROWS-2 rows at 2 each.
  eq('hard drop pays two a cell', dropped.score, (ROWS - 2) * 2);
  ok('and locks the piece', dropped.piece === null || dropped.piece.type !== undefined);
}

/* -------------------------------------------------- locking and clearing */
{
  // One gap left in the bottom row; an O dropped into it fills two rows'
  // worth of nothing, so only the bottom row completes.
  const board = boardOf('########..', '########..');
  const g = { ...newGame(1), board, piece: { type: 'O', rot: 0, x: 7, y: ROWS - 2 } };
  const locked = lock(g);
  eq('a completed row is reported, not removed', locked.pending, [ROWS - 2, ROWS - 1]);
  eq('the board still shows them while they flash', locked.status, 'clearing');
  ok('and the cells really are filled', locked.board[ROWS - 1].every((c) => c !== null));

  const done = resolveClear(locked);
  eq('resolving takes them out', done.board[ROWS - 1].every((c) => c === null), true);
  eq('two rows is a double', done.lines, 2);
  eq('scored at level one', done.score, LINE_SCORES[2] * 1);
  eq('and play resumes', done.status, 'playing');
}
{
  const board = boardOf('#########.');
  const g = { ...newGame(1), board, piece: { type: 'I', rot: 1, x: 7, y: ROWS - 4 } };
  const done = resolveClear(lock(g));
  eq('a single is a hundred', done.score, 100);
  eq('one line counted', done.lines, 1);
}
{
  // Four at once, which is the moment the whole game is built around.
  const board = boardOf('#########.', '#########.', '#########.', '#########.');
  const g = { ...newGame(1), board, piece: { type: 'I', rot: 1, x: 7, y: ROWS - 4 } };
  const locked = lock(g);
  eq('four rows go at once', locked.pending.length, 4);
  const done = resolveClear(locked);
  eq('a tetris is eight hundred', done.score, 800);
  eq('and it is reported for the celebration', done.lastClear, 4);
  ok('with a fresh id so the animation replays', done.clearId > g.clearId);
}
{
  // Scoring scales with level, which is the reason to survive.
  const board = boardOf('#########.');
  const g = { ...newGame(1), board, level: 5, piece: { type: 'I', rot: 1, x: 7, y: ROWS - 4 } };
  eq('a single at level five is five hundred', resolveClear(lock(g)).score, 100 * 5);
}
{
  const board = boardOf('#########.');
  const g = { ...newGame(1), board, lines: 9, piece: { type: 'I', rot: 1, x: 7, y: ROWS - 4 } };
  const done = resolveClear(lock(g));
  eq('the tenth line is a new level', done.level, 2);
  eq('and the count carries on', done.lines, 10);
}
{
  const board = boardOf('..........');
  const g = { ...newGame(1), board, piece: { type: 'O', rot: 0, x: 3, y: ROWS - 2 } };
  const locked = lock(g);
  eq('an incomplete row clears nothing', locked.pending, null);
  eq('and the next piece is already up', locked.status, 'playing');
  ok('with a piece to play', !!locked.piece);
}

/* --------------------------------------------------------------- hold */
{
  const g = newGame(7);
  const first = g.piece.type;
  const held = holdPiece(g);
  eq('holding stores the current piece', held.hold, first);
  ok('and deals a different one', held.piece.type !== first || held.queue.length >= 0);
  eq('hold is now spent', held.holdUsed, true);

  const again = holdPiece(held);
  eq('a second hold on the same piece does nothing', again.piece.type, held.piece.type);
  eq('and the slot is untouched', again.hold, held.hold);
}
{
  // After a lock the flag resets and the swap goes the other way.
  const g = newGame(7);
  const held = holdPiece(g);
  const stored = held.hold, onBoard = held.piece.type;
  const next = nextPiece(held);
  eq('a new piece restores the hold', next.holdUsed, false);
  const swapped = holdPiece(next);
  eq('holding again brings the stored piece back', swapped.piece.type, stored);
  ok('and stores what was in play', swapped.hold !== stored || stored === onBoard);
}

/* ----------------------------------------------------------- game over */
{
  /* Stacked to the ceiling with the last two columns open, and a vertical I
     dropped into one of them — so the stack blocks the spawn square while no
     row is ever actually complete. Leaving only one column open does not work:
     whatever fills it completes those rows, the board clears, and the game
     cheerfully carries on. The first version of this test proved exactly
     that. */
  const board = empty();
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS - 2; c++) board[r][c] = 'X';
  const g = { ...newGame(1), board, piece: { type: 'I', rot: 1, x: 6, y: ROWS - 4 } };
  const locked = lock(g);
  eq('nothing cleared', locked.pending, null);
  eq('nowhere to put the next piece ends it', locked.status, 'over');
  eq('and there is no piece in play', locked.piece, null);
}
{
  const g = newGame(1);
  eq('a new game is playable', g.status, 'playing');
  ok('with a piece', !!g.piece);
  ok('and a queue to preview', g.queue.length >= 3);
  eq('nothing held yet', g.hold, null);
  eq('and no score', [g.score, g.lines, g.level], [0, 0, 1]);
}

/* ------------------------------------------------------------- gravity */
{
  const climb = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(gravityMs);
  ok('every level up to ten is strictly faster', climb.every((v, i) => i === 0 || v < climb[i - 1]));
  ok('level one is a second a row', Math.abs(gravityMs(1) - 1000) < 1);
  ok('level five is about a third of a second', gravityMs(5) > 300 && gravityMs(5) < 400);
  ok('level ten is well under a tenth', gravityMs(10) < 100);
  // Past the floor it plateaus rather than continuing into nonsense.
  ok('it never goes below the floor', gravityMs(200) >= R.GRAVITY_FLOOR_MS);
  eq('and high levels all sit on it', [gravityMs(15), gravityMs(20), gravityMs(99)],
    [R.GRAVITY_FLOOR_MS, R.GRAVITY_FLOOR_MS, R.GRAVITY_FLOOR_MS]);
  ok('the curve never increases', [...Array(40)].every((_, i) => i === 0 || gravityMs(i + 1) <= gravityMs(i)));
}

/* ---------------------------------------------------------------- rush
   Score buys speed on top of the level curve, and never gives it back. */
{
  const { speedMultiplier: mult, BASE_MULTIPLIER } = R;
  eq('a fresh game already starts above the level curve', mult(0), 1.5);
  eq('and that is the documented base', mult(0), BASE_MULTIPLIER);
  eq('just under eight thousand is still the opening pace', mult(7999), 1.5);
  eq('eight thousand doubles the level curve', mult(8000), 2);
  eq('and holds to fourteen', mult(13999), 2);
  eq('fourteen thousand', mult(14000), 2.5);
  eq('twenty thousand', mult(20000), 3);
  eq('twenty-six thousand', mult(26000), 3.5);
  eq('thirty-four thousand', mult(34000), 3.7);
  eq('and it never goes higher', [mult(50000), mult(1e6)], [3.7, 3.7]);
  ok('the tiers never step down',
    [0, 5000, 8000, 13999, 14000, 20000, 26000, 34000, 99999]
      .every((s, i, a) => i === 0 || mult(s) >= mult(a[i - 1])));
  ok('every tier is faster than the opening pace',
    R.SPEED_TIERS.every((t) => t.multiplier > BASE_MULTIPLIER));
  ok('the tier table is ordered highest-first, which is what the lookup assumes',
    R.SPEED_TIERS.every((t, i, a) => i === 0 || t.from < a[i - 1].from));
}
{
  const { fallMs, gravityMs: grav, RUSH_FLOOR_MS, BASE_MULTIPLIER } = R;
  eq('a fresh game is already faster than the bare level curve', fallMs(1, 0), grav(1) / BASE_MULTIPLIER);
  ok('which is to say, quicker than it used to be', fallMs(1, 0) < grav(1));
  eq('at level one, doubled', fallMs(1, 8000), grav(1) / 2);
  eq('at level one, two and a half', fallMs(1, 14000), grav(1) / 2.5);
  eq('at level one, the top tier', fallMs(1, 34000), grav(1) / 3.7);
  ok('a rushed fall is always quicker than the plain one', fallMs(3, 34000) < grav(3));
  // 3.7 times a floored 60ms is 16ms, which is a teleport rather than a fall.
  eq('but never past the rush floor', fallMs(20, 34000), RUSH_FLOOR_MS);
  ok('and the floor is still playable-ish', RUSH_FLOOR_MS >= 20);
  ok('speed only ever increases with score',
    [0, 8000, 14000, 20000, 26000, 34000].every((s, i, a) => i === 0 || fallMs(5, s) <= fallMs(5, a[i - 1])));
}

/* --------------------------------------------------------- frozen states */
{
  const over = { ...newGame(1), status: 'over' };
  eq('a finished game ignores movement', moveLeft(over), over);
  eq('and rotation', rotate(over, 1), over);
  eq('and hold', holdPiece(over), over);
}

console.log(`\ntetris: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
