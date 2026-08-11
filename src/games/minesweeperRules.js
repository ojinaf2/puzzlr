/* ============================= MINESWEEPER RULES =============================
   The board and every move on it, as pure functions. Kept out of the component
   so the mechanics can be tested directly — see test/minesweeper.test.mjs.

   A board is flat arrays indexed by `row * cols + col`, not a grid of objects:
   Hard is 480 cells and every reveal walks neighbours, so keeping it flat
   avoids rebuilding hundreds of objects on each click.

     mine[]   1 where a mine sits
     adj[]    how many of the eight neighbours are mines
     state[]  COVERED | REVEALED | FLAGGED
     wave[]   BFS depth at which a cell was uncovered, purely so the reveal can
              ripple outward instead of appearing all at once                */

export const COVERED = 0, REVEALED = 1, FLAGGED = 2;

export const LEVELS = [
  { key: "easy", name: "Easy", rows: 9, cols: 9, mines: 10, blurb: "9 x 9, 10 mines" },
  { key: "medium", name: "Medium", rows: 16, cols: 16, mines: 40, blurb: "16 x 16, 40 mines" },
  { key: "hard", name: "Hard", rows: 16, cols: 30, mines: 99, blurb: "16 x 30, 99 mines" },
];

export const levelOf = (key) => LEVELS.find((l) => l.key === key) ?? LEVELS[0];

export const neighbours = (level, i) => {
  const r = Math.floor(i / level.cols);
  const c = i % level.cols;
  const out = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= level.rows || nc >= level.cols) continue;
      out.push(nr * level.cols + nc);
    }
  }
  return out;
};

/* Hard is 16 rows by 30 columns, which cannot fit across a phone. Turning it
   on its side gives 30 by 16 — the same board, the same mine count, the same
   game — and it fits a portrait screen without scrolling. Minesweeper has no
   preferred orientation, so nothing is lost by it. */
export const transpose = (level) => ({ ...level, rows: level.cols, cols: level.rows });

/* Accepts a level key or an already-shaped level object, so a caller can hand
   in a transposed one. */
export const newGame = (levelOrKey) => {
  const level = typeof levelOrKey === "string" ? levelOf(levelOrKey) : levelOrKey;
  const size = level.rows * level.cols;
  return {
    level,
    mine: new Array(size).fill(0),
    adj: new Array(size).fill(0),
    state: new Array(size).fill(COVERED),
    wave: new Array(size).fill(-1),
    planted: false,
    status: "ready",              // ready | playing | won | lost
    hitIndex: -1,                 // the mine that ended it
    flags: 0,
  };
};

/* Mines are laid only once the first cell is known, and never on that cell or
   its eight neighbours. That is what guarantees an opening click can neither
   lose instantly nor land on a bare number — it always opens a region. */
export const plant = (g, safeIndex) => {
  const { level } = g;
  const size = level.rows * level.cols;
  const forbidden = new Set([safeIndex, ...neighbours(level, safeIndex)]);

  /* On a board too crowded to keep the whole neighbourhood clear, protect the
     clicked cell alone. None of the three built-in levels hits this, but a
     future one could, and silently placing fewer mines would be worse. */
  let pool = [];
  for (let i = 0; i < size; i++) if (!forbidden.has(i)) pool.push(i);
  if (pool.length < level.mines) {
    pool = [];
    for (let i = 0; i < size; i++) if (i !== safeIndex) pool.push(i);
  }

  // Partial Fisher-Yates: shuffle only as many as we need to draw.
  for (let i = 0; i < level.mines; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const mine = new Array(size).fill(0);
  for (let i = 0; i < level.mines; i++) mine[pool[i]] = 1;

  const adj = new Array(size).fill(0);
  for (let i = 0; i < size; i++) {
    if (mine[i]) continue;
    let n = 0;
    for (const nb of neighbours(level, i)) if (mine[nb]) n++;
    adj[i] = n;
  }
  return { ...g, mine, adj, planted: true };
};

const isWon = (g) => {
  for (let i = 0; i < g.state.length; i++) {
    if (!g.mine[i] && g.state[i] !== REVEALED) return false;
  }
  return true;
};

/* Every safe cell uncovered is the win. Flagging the mines is not required —
   that is the classic rule, and players who never flag would otherwise be
   unable to finish. */
const settle = (g) => (isWon(g) ? { ...g, status: "won" } : g);

/* Breadth-first, with an explicit queue rather than recursion: an empty region
   on Hard can run to hundreds of cells and deep recursion would risk the
   stack. BFS also gives each cell a depth, which the UI uses to ripple the
   reveal outward from the click. */
const flood = (g, start) => {
  const state = [...g.state];
  const wave = [...g.wave];
  let queue = [start];
  let depth = 0;
  state[start] = REVEALED;
  wave[start] = 0;

  while (queue.length) {
    const next = [];
    for (const cur of queue) {
      if (g.adj[cur] !== 0) continue;          // numbers stop the spread
      for (const nb of neighbours(g.level, cur)) {
        if (state[nb] !== COVERED) continue;   // already open, or flagged
        state[nb] = REVEALED;
        wave[nb] = depth + 1;
        next.push(nb);
      }
    }
    queue = next;
    depth++;
  }
  return { ...g, state, wave };
};

export const revealAt = (g, i) => {
  if (g.status === "won" || g.status === "lost") return g;
  if (g.state[i] === REVEALED || g.state[i] === FLAGGED) return g;

  let next = g;
  if (!next.planted) next = { ...plant(next, i), status: "playing" };
  else if (next.status === "ready") next = { ...next, status: "playing" };

  if (next.mine[i]) {
    const state = [...next.state];
    state[i] = REVEALED;
    return { ...next, state, status: "lost", hitIndex: i };
  }
  return settle(flood(next, i));
};

export const toggleFlag = (g, i) => {
  if (g.status === "won" || g.status === "lost") return g;
  if (g.state[i] === REVEALED) return g;          // nothing to flag
  const state = [...g.state];
  const flagging = state[i] === COVERED;
  state[i] = flagging ? FLAGGED : COVERED;
  return { ...g, state, flags: g.flags + (flagging ? 1 : -1) };
};

/* Chording: clicking a number that already has exactly that many flags around
   it opens the rest of its neighbours. It is the standard speed technique, and
   it is honest — if the flags are wrong, it detonates. */
export const chord = (g, i) => {
  if (g.status !== "playing") return g;
  if (g.state[i] !== REVEALED || g.adj[i] === 0) return g;

  const nbs = neighbours(g.level, i);
  const flagged = nbs.filter((n) => g.state[n] === FLAGGED).length;
  if (flagged !== g.adj[i]) return g;

  let next = g;
  for (const n of nbs) {
    if (next.state[n] !== COVERED) continue;
    next = revealAt(next, n);
    if (next.status === "lost") return next;
  }
  return next;
};

/* Mines remaining as the player sees it. Deliberately allowed to go negative
   when they over-flag — that is the classic behaviour, and it is a count of
   unplaced flags rather than a hint about where anything is. */
export const minesLeft = (g) => g.level.mines - g.flags;

export const bestKey = (levelKey) => `puzzlr:minesweeper:best:${levelKey}`;

export const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};
