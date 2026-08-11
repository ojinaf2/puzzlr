/* Minesweeper's mechanics: mine placement, first-click safety, flood fill,
   flagging, chording and the win and loss conditions.

     node test/minesweeper.test.mjs

   Mine layout is random, so several of these run every difficulty many times
   over rather than trusting one lucky board. */

const R = await import('../src/games/minesweeperRules.js');
const { LEVELS, COVERED, REVEALED, FLAGGED, newGame, plant, revealAt, toggleFlag,
        chord, neighbours, minesLeft, formatTime } = R;

let pass = 0, fail = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else { fail++; console.log(`FAIL ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
};
const ok = (label, cond) => eq(label, !!cond, true);

const count = (arr, v) => arr.reduce((n, x) => n + (x === v ? 1 : 0), 0);

/* ------------------------------------------------- boards and mine counts */
for (const level of LEVELS) {
  const size = level.rows * level.cols;
  let worstNeighbourBreach = 0;
  let minesWrong = 0, adjWrong = 0;

  for (let trial = 0; trial < 40; trial++) {
    const safe = Math.floor(Math.random() * size);
    const g = plant(newGame(level.key), safe);

    if (count(g.mine, 1) !== level.mines) minesWrong++;

    // First click safe, and its whole neighbourhood clear.
    if (g.mine[safe]) worstNeighbourBreach++;
    for (const n of neighbours(level, safe)) if (g.mine[n]) worstNeighbourBreach++;

    // Every number must equal its real neighbouring mine count.
    for (let i = 0; i < size; i++) {
      if (g.mine[i]) continue;
      const real = neighbours(level, i).filter((n) => g.mine[n]).length;
      if (g.adj[i] !== real) { adjWrong++; break; }
    }
  }
  eq(`${level.name}: exact mine count over 40 boards`, minesWrong, 0);
  eq(`${level.name}: first click and neighbours never mined`, worstNeighbourBreach, 0);
  eq(`${level.name}: adjacency numbers all correct`, adjWrong, 0);
  eq(`${level.name}: board size`, newGame(level.key).state.length, size);
}

/* ------------------------------------------------------ no mines up front */
{
  const g = newGame('easy');
  eq('nothing is planted before the first click', count(g.mine, 1), 0);
  eq('and the game has not started', g.status, 'ready');
  const after = revealAt(g, 40);
  eq('the first reveal plants them', count(after.mine, 1), 10);
  eq('the first reveal starts the clock', after.status, 'playing');
  ok('the first click is never a loss', after.status !== 'lost');
}

/* Over many first clicks, one must never lose and must always open a region
   (the clicked cell has no adjacent mines, so it floods). */
{
  let losses = 0, singles = 0;
  for (let t = 0; t < 60; t++) {
    const g = revealAt(newGame('easy'), Math.floor(Math.random() * 81));
    if (g.status === 'lost') losses++;
    if (count(g.state, REVEALED) < 4) singles++;
  }
  eq('60 opening clicks, no instant loss', losses, 0);
  eq('60 opening clicks, each opened an area', singles, 0);
}

/* ------------------------------------------------------------- flood fill */
{
  /* A hand-built board so the expected region is known exactly:
     one mine in the far corner of a 5x5, click the opposite corner. */
  const level = { key: 'test', name: 'T', rows: 5, cols: 5, mines: 1 };
  const size = 25;
  const mine = new Array(size).fill(0);
  mine[24] = 1;                                     // bottom-right
  const adj = new Array(size).fill(0);
  for (let i = 0; i < size; i++) {
    if (mine[i]) continue;
    adj[i] = neighbours(level, i).filter((n) => mine[n]).length;
  }
  const g = {
    level, mine, adj, state: new Array(size).fill(COVERED), wave: new Array(size).fill(-1),
    planted: true, status: 'playing', hitIndex: -1, flags: 0,
  };
  const out = revealAt(g, 0);                       // top-left
  eq('flood opens every safe cell', count(out.state, REVEALED), 24);
  eq('flood never opens the mine', out.state[24], COVERED);
  eq('clearing every safe cell wins', out.status, 'won');
  eq('the origin is wave 0', out.wave[0], 0);
  ok('further cells have a later wave', out.wave[12] > 0);
}
{
  // A numbered cell opens only itself.
  const level = { key: 'test', name: 'T', rows: 3, cols: 3, mines: 1 };
  const mine = [0, 0, 0, 0, 0, 0, 0, 0, 1];
  const adj = new Array(9).fill(0);
  for (let i = 0; i < 9; i++) if (!mine[i]) adj[i] = neighbours(level, i).filter((n) => mine[n]).length;
  const g = { level, mine, adj, state: new Array(9).fill(COVERED), wave: new Array(9).fill(-1),
    planted: true, status: 'playing', hitIndex: -1, flags: 0 };
  const out = revealAt(g, 4);                        // centre, touches the mine
  eq('a numbered cell opens alone', count(out.state, REVEALED), 1);
  eq('and shows the right number', out.adj[4], 1);
}

/* --------------------------------------------------------------- flagging */
{
  let g = revealAt(newGame('easy'), 40);
  const covered = g.state.findIndex((s) => s === COVERED);
  g = toggleFlag(g, covered);
  eq('flagging marks the cell', g.state[covered], FLAGGED);
  eq('and counts down the mines left', minesLeft(g), 9);

  const protectedFromClick = revealAt(g, covered);
  eq('a flag blocks a normal reveal', protectedFromClick.state[covered], FLAGGED);

  g = toggleFlag(g, covered);
  eq('flagging again clears it', g.state[covered], COVERED);
  eq('and restores the counter', minesLeft(g), 10);

  const openCell = g.state.findIndex((s) => s === REVEALED);
  eq('a revealed cell cannot be flagged', toggleFlag(g, openCell).state[openCell], REVEALED);
}
{
  // Over-flagging is allowed and the counter goes negative, as in the original.
  let g = revealAt(newGame('easy'), 40);
  let placed = 0;
  for (let i = 0; i < 81 && placed < 12; i++) {
    if (g.state[i] === COVERED) { g = toggleFlag(g, i); placed++; }
  }
  eq('twelve flags on a ten-mine board', minesLeft(g), -2);
}

/* ------------------------------------------------------------------- loss */
{
  let g = revealAt(newGame('easy'), 40);
  const aMine = g.mine.findIndex((m, i) => m && g.state[i] === COVERED);
  g = revealAt(g, aMine);
  eq('uncovering a mine loses', g.status, 'lost');
  eq('and records which one', g.hitIndex, aMine);
  eq('a lost game ignores further clicks', revealAt(g, 0).status, 'lost');
  eq('a lost game ignores flags', toggleFlag(g, 0).state[0], g.state[0]);
}

/* --------------------------------------------------------------- chording */
{
  const level = { key: 'test', name: 'T', rows: 3, cols: 3, mines: 1 };
  const mine = [0, 0, 0, 0, 0, 0, 0, 0, 1];
  const adj = new Array(9).fill(0);
  for (let i = 0; i < 9; i++) if (!mine[i]) adj[i] = neighbours(level, i).filter((n) => mine[n]).length;
  const base = { level, mine, adj, state: new Array(9).fill(COVERED), wave: new Array(9).fill(-1),
    planted: true, status: 'playing', hitIndex: -1, flags: 0 };

  let g = revealAt(base, 4);
  eq('chording does nothing without the flags', chord(g, 4).state[0], COVERED);

  g = toggleFlag(g, 8);                              // flag the real mine
  g = chord(g, 4);
  eq('chording opens the rest', count(g.state, REVEALED), 8);
  eq('and can win the board', g.status, 'won');
}
{
  // A wrongly placed flag makes chording detonate, as it should.
  const level = { key: 'test', name: 'T', rows: 3, cols: 3, mines: 1 };
  const mine = [0, 0, 0, 0, 0, 0, 0, 0, 1];
  const adj = new Array(9).fill(0);
  for (let i = 0; i < 9; i++) if (!mine[i]) adj[i] = neighbours(level, i).filter((n) => mine[n]).length;
  let g = { level, mine, adj, state: new Array(9).fill(COVERED), wave: new Array(9).fill(-1),
    planted: true, status: 'playing', hitIndex: -1, flags: 0 };
  g = revealAt(g, 4);
  g = toggleFlag(g, 0);                              // wrong cell
  g = chord(g, 4);
  eq('chording on a bad flag loses', g.status, 'lost');
}

/* ------------------------------------------------------- turned on its side
   Hard is laid out sideways on a phone. It has to stay the same game: same
   cell count, same mines, and still first-click-safe. */
{
  const hard = LEVELS.find((l) => l.key === 'hard');
  const tall = R.transpose(hard);
  eq('transposing swaps the axes', [tall.rows, tall.cols], [hard.cols, hard.rows]);
  eq('and keeps the mine count', tall.mines, hard.mines);
  eq('and the cell count', tall.rows * tall.cols, hard.rows * hard.cols);

  const g = newGame(tall);
  eq('a transposed board is the right size', g.state.length, 480);
  eq('and carries its own shape', [g.level.rows, g.level.cols], [30, 16]);

  let breaches = 0, wrongCount = 0;
  for (let t = 0; t < 12; t++) {
    const safe = Math.floor(Math.random() * 480);
    const p = plant(newGame(tall), safe);
    if (count(p.mine, 1) !== 99) wrongCount++;
    if (p.mine[safe]) breaches++;
    for (const n of neighbours(tall, safe)) if (p.mine[n]) breaches++;
  }
  eq('transposed boards still get 99 mines', wrongCount, 0);
  eq('transposed boards are still first-click safe', breaches, 0);
}

/* ------------------------------------------------------------------ misc */
eq('time formats as m:ss', [0, 7, 47, 60, 605].map(formatTime), ['0:00', '0:07', '0:47', '1:00', '10:05']);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
