/* 2048's sliding and merging rules.

     node test/game2048.test.mjs

   Worth testing here rather than in the browser for the usual reason: the
   cases that matter are specific boards, and reaching them by playing is a
   matter of luck. The once-per-move merge rule in particular has exactly one
   interesting shape — a line of four equal tiles — and it is the rule clones
   get wrong. */

const { newGame, move, canMove, isOver, gridOf, fromGrid, liveTiles, WIN_VALUE, SIZES }
  = await import('../src/games/game2048Rules.js');

let pass = 0, fail = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else { fail++; console.log(`FAIL ${label}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};
const ok = (label, cond) => {
  if (cond) pass++; else { fail++; console.log(`FAIL ${label}`); }
};

/* A move always spawns a tile, so a fixed random source does not silence it —
   it just makes it land predictably. Rather than fight that, most assertions
   below read the board *without* the tile that has just appeared, which is
   the thing the slide-and-merge rules actually produced. Spawning gets its
   own tests further down. */
const fixed = () => 0;
/* Spawns into the *last* empty cell instead of the first, for the handful of
   cases that play two moves in a row and need the top row left alone. */
const lastCell = () => 0.999;

const settled = (g) => {
  const grid = Array.from({ length: g.size }, () => Array(g.size).fill(0));
  for (const t of liveTiles(g)) if (!t.isNew) grid[t.r][t.c] = t.value;
  return grid;
};

/* One row, moved, read back as numbers. `fromGrid` squares the board off, so
   a single row of four is a real 4x4 with three empty rows under it. */
const row = (values, dir = 'left') => settled(move(fromGrid([values]), dir, fixed))[0];

/* ------------------------------------------------ the once-per-move rule */
{
  eq('2 2 2 2 left -> 4 4', row([2, 2, 2, 2]), [4, 4, 0, 0]);
  eq('4 4 2 2 left -> 8 4', row([4, 4, 2, 2]), [8, 4, 0, 0]);
  eq('2 2 4 left -> 4 4', row([2, 2, 4, 0]), [4, 4, 0, 0]);
  eq('2 2 2 left -> 4 2', row([2, 2, 2, 0]), [4, 2, 0, 0]);
  eq('4 4 4 4 left -> 8 8', row([4, 4, 4, 4]), [8, 8, 0, 0]);
}

/* Moving the other way has to merge from the other end: 2 2 2 right pairs the
   two nearest the right wall, so the leftover 2 is the one on the left. */
{
  eq('2 2 2 2 right -> 4 4', row([2, 2, 2, 2], 'right'), [0, 0, 4, 4]);
  eq('2 2 2 right -> 2 4', row([2, 2, 2, 0], 'right'), [0, 0, 2, 4]);
  eq('2 2 4 right -> 4 4', row([2, 2, 4, 0], 'right'), [0, 0, 4, 4]);
}

/* -------------------------------------------------- sliding without gaps */
{
  eq('gaps compress left', row([0, 0, 2, 0]), [2, 0, 0, 0]);
  eq('gaps compress right', row([0, 2, 0, 0], 'right'), [0, 0, 0, 2]);
  eq('unequal neighbours do not merge', row([2, 4, 8, 16]), [2, 4, 8, 16]);
  eq('merge across a gap', row([2, 0, 0, 2]), [4, 0, 0, 0]);
}

/* ------------------------------------------------------- all four axes */
{
  const g = fromGrid([
    [2, 0, 0, 0],
    [2, 0, 0, 0],
    [4, 0, 0, 0],
    [4, 0, 0, 0],
  ]);
  eq('up merges columns', settled(move(g, 'up', fixed)).map((r) => r[0]), [4, 8, 0, 0]);
  eq('down merges columns', settled(move(g, 'down', fixed)).map((r) => r[0]), [0, 0, 4, 8]);
}
{
  // The same board every way up, to be sure no direction is transposed wrong.
  const g = fromGrid([
    [2, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);
  eq('lone tile slides right', settled(move(g, 'right', fixed))[0], [0, 0, 0, 2]);
  eq('lone tile slides down', settled(move(g, 'down', fixed))[3], [2, 0, 0, 0]);
  eq('lone tile already up', move(g, 'up', fixed).moved, false);
  eq('lone tile already left', move(g, 'left', fixed).moved, false);
}

/* ------------------------------------------------------------- scoring */
{
  const g = move(fromGrid([[2, 2, 4, 4]]), 'left', fixed);
  eq('score is the sum of what was made', g.score, 4 + 8);
}
{
  const g = move(fromGrid([[2, 4, 8, 16]]), 'left', fixed);
  eq('no merge, no score', g.score, 0);
}
{
  // Score accumulates across moves rather than being recomputed.
  let g = fromGrid([[2, 2, 0, 0]]);
  g = move(g, 'left', fixed);
  g = move(fromGrid([[4, 4, 0, 0]], { score: g.score }), 'left', fixed);
  eq('score accumulates', g.score, 4 + 8);
}

/* -------------------------------------------- a move that changes nothing */
{
  const g = fromGrid([
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 4, 2],
  ]);
  const after = move(g, 'left', () => 0);
  eq('a blocked move reports moved: false', after.moved, false);
  eq('a blocked move spawns nothing', liveTiles(after).length, liveTiles(g).length);
  eq('a blocked move scores nothing', after.score, 0);
}
{
  // Full board, but a merge is available: that IS a move.
  const g = fromGrid([
    [2, 2, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 4, 2],
  ]);
  eq('a merge on a full board counts', move(g, 'left', () => 0).moved, true);
}

/* ------------------------------------------------------------ spawning */
{
  // rnd is called for the cell then the value; 0 picks the first empty cell
  // and lands under the 90% threshold, so a 2.
  const g = move(fromGrid([[2, 2, 0, 0]]), 'left', () => 0);
  const spawned = liveTiles(g).filter((t) => t.isNew);
  eq('exactly one tile spawns after a real move', spawned.length, 1);
  eq('a 0 roll spawns a 2', spawned[0].value, 2);
}
{
  const g = move(fromGrid([[2, 2, 0, 0]]), 'left', () => 0.95);
  eq('a high roll spawns a 4', liveTiles(g).filter((t) => t.isNew)[0].value, 4);
}
{
  const g = newGame(4, () => 0.5);
  eq('a new game starts with two tiles', liveTiles(g).length, 2);
  ok('starting tiles are 2 or 4', liveTiles(g).every((t) => t.value === 2 || t.value === 4));
  eq('a new game scores zero', g.score, 0);
}

/* --------------------------------------------------------------- merging
   identity: the survivor keeps its id, the eaten tile is kept around at the
   destination so it can finish sliding, and it never counts as on the board. */
{
  const before = fromGrid([[2, 2, 0, 0]]);
  const [a, b] = before.tiles;
  const after = move(before, 'left', fixed);
  const survivor = after.tiles.find((t) => t.merged);
  const eaten = after.tiles.find((t) => t.absorbed);

  eq('the survivor is the tile nearest the wall', survivor.id, a.id);
  eq('the survivor carries the doubled value', survivor.value, 4);
  eq('the eaten tile is the far one', eaten.id, b.id);
  eq('the eaten tile travels to the merge cell', [eaten.r, eaten.c], [survivor.r, survivor.c]);
  eq('the eaten tile is off the board', liveTiles(after).filter((t) => !t.isNew).length, 1);
  eq('the board reads as one tile', settled(after)[0], [4, 0, 0, 0]);
}
{
  // Absorbed tiles from a previous move must not block the next one. The
  // spawn is pushed to the far corner so the row under test stays clean.
  let g = move(fromGrid([[2, 2, 0, 0]]), 'left', lastCell);
  g = move(g, 'right', lastCell);
  eq('a dead tile does not survive two moves', g.tiles.filter((t) => t.absorbed).length, 0);
  eq('and does not block the slide', settled(g)[0][3], 4);
}

/* -------------------------------------------------------------- game over */
{
  const g = fromGrid([
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 4, 2],
  ]);
  ok('a full checkerboard is over', isOver(g));
  ok('canMove agrees', !canMove(g));
}
{
  const g = fromGrid([
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 4, 0],
  ]);
  ok('one empty cell is not over', canMove(g));
}
{
  const g = fromGrid([
    [2, 2, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 4, 2],
  ]);
  ok('a full board with a merge left is not over', canMove(g));
}
{
  const g = fromGrid([
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 4, 4],           // the pair is vertical, bottom-right
  ]);
  ok('a vertical merge counts too', canMove(g));
}

/* ------------------------------------------------------------------ win */
{
  const g = move(fromGrid([[1024, 1024, 0, 0]]), 'left', fixed);
  eq('reaching 2048 wins', g.won, true);
  eq('and the tile is there', settled(g)[0][0], WIN_VALUE);
}
{
  const g = move(fromGrid([[512, 512, 0, 0]]), 'left', fixed);
  eq('1024 is not a win', g.won, false);
}
{
  // Past 2048 the flag stays set; the component uses keepGoing to stop showing
  // the message, so `won` must not flip back off.
  let g = move(fromGrid([[1024, 1024, 0, 0]], { keepGoing: true }), 'left', fixed);
  g = move(fromGrid([[2, 4, 0, 0]], { won: g.won, keepGoing: true }), 'left', fixed);
  eq('won stays set once earned', g.won, true);
}

/* ------------------------------------------------------- the bigger boards */
for (const n of SIZES) {
  const g = newGame(n, () => 0.5);
  eq(`${n}x${n} board is square`, gridOf(g).length, n);
  eq(`${n}x${n} rows are the right width`, gridOf(g)[0].length, n);
  eq(`${n}x${n} starts with two tiles`, liveTiles(g).length, 2);
}
{
  // A full line of six still merges into three pairs, not fewer.
  const g = fromGrid([[2, 2, 2, 2, 2, 2]]);
  eq('six equal tiles make three pairs', settled(move(g, 'left', fixed))[0], [4, 4, 4, 0, 0, 0]);
}
{
  const g = fromGrid([[2, 2, 4, 4, 8, 8]]);
  eq('a whole 6-line merges pairwise', settled(move(g, 'left', fixed))[0], [4, 8, 16, 0, 0, 0]);
}
{
  const g = newGame(9, () => 0.5);
  eq('an unsupported size falls back to 4', g.size, 4);
}

/* --------------------------------------------------------- spawn odds
   Not a distribution test — just that both outcomes are reachable and that
   the threshold sits where the original put it. */
{
  let twos = 0, fours = 0;
  for (let i = 0; i < 400; i++) {
    const g = move(fromGrid([[2, 2, 0, 0]]), 'left', Math.random);
    const t = liveTiles(g).find((x) => x.isNew);
    if (t.value === 2) twos++; else fours++;
  }
  ok('twos dominate the spawn', twos > fours * 3);
  ok('fours still happen', fours > 0);
}

console.log(`\n2048: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
