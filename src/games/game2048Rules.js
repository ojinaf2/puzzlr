/* ============================= 2048 RULES =============================

   Pure rules, kept out of the component so node can test them without a
   browser — the same reason Snake and Minesweeper split theirs out. The
   interesting cases here are unreachable by clicking: the once-per-move merge
   rule needs a specific row handed to it, and "did the board actually change"
   needs a board where it did not.

   TILES CARRY IDENTITY
   A move returns tiles, not a grid of numbers. Each tile keeps the same `id`
   from the moment it spawns until it is absorbed by a merge, which is what
   lets the component animate the same DOM node from A to B instead of
   re-rendering a fresh grid every move.

   Two tiles come out of a merge, not one:
     - the survivor, carrying the doubled value and `merged: true`
     - the absorbed one, moved onto the survivor's cell and marked `absorbed`

   The absorbed tile is dead weight for the rules — it is filtered out at the
   start of the next move — but it has to finish sliding to where it died, or
   a merge looks like one tile vanishing and another suddenly doubling. */

export const SIZES = [4, 5, 6];
export const WIN_VALUE = 2048;
export const DIRECTIONS = ["up", "down", "left", "right"];

/* Maps a position along a line onto a board cell, so one line-solver handles
   all four directions. `i` is which line (row or column), `j` is how far along
   it a tile sits counting from the wall it is travelling towards — so j=0 is
   always the destination, whichever way we are going. */
const coord = (dir, i, j, n) => {
  if (dir === "left") return [i, j];
  if (dir === "right") return [i, n - 1 - j];
  if (dir === "up") return [j, i];
  return [n - 1 - j, i];                                            // down
};

const key = (r, c, n) => r * n + c;

/* 90% a 2, 10% a 4 — the original's odds. */
const newValue = (rnd) => (rnd() < 0.9 ? 2 : 4);

const emptyCells = (tiles, n) => {
  const taken = new Set(tiles.map((t) => key(t.r, t.c, n)));
  const out = [];
  for (let i = 0; i < n * n; i++) if (!taken.has(i)) out.push(i);
  return out;
};

/* Places one tile on a random empty cell. Returns the tile, or null if the
   board is full — the caller decides whether that is a problem. */
const makeTile = (tiles, n, seq, rnd) => {
  const empties = emptyCells(tiles, n);
  if (!empties.length) return null;
  const cell = empties[Math.floor(rnd() * empties.length)];
  return {
    id: seq,
    value: newValue(rnd),
    r: Math.floor(cell / n),
    c: cell % n,
    isNew: true,
    merged: false,
    absorbed: false,
  };
};

export function newGame(size = 4, rnd = Math.random) {
  const n = SIZES.includes(size) ? size : 4;
  const tiles = [];
  let seq = 1;
  for (let i = 0; i < 2; i++) {
    const t = makeTile(tiles, n, seq++, rnd);
    if (t) tiles.push(t);
  }
  return { size: n, tiles, score: 0, seq, won: false, keepGoing: false };
}

/* The live board is the tiles that are not mid-death. Everything that reads
   positions — merging, spawning, game-over — goes through this. */
export const liveTiles = (g) => g.tiles.filter((t) => !t.absorbed);

export function gridOf(g) {
  const grid = Array.from({ length: g.size }, () => Array(g.size).fill(0));
  for (const t of liveTiles(g)) grid[t.r][t.c] = t.value;
  return grid;
}

/* Builds a state from a plain grid of numbers. Only used by the tests, which
   is the whole point of the split — a test can state the board it cares about
   instead of playing towards one.

   The board is squared off from whichever dimension is longer, so a test can
   hand over a single row (`[[2, 2, 2, 2]]`) and get a real 4x4 board with the
   rest empty, rather than a 1x1 one with tiles hanging off the side. */
export function fromGrid(grid, extra = {}) {
  const n = Math.max(grid.length, ...grid.map((row) => row.length));
  const tiles = [];
  let seq = 1;
  grid.forEach((row, r) => row.forEach((v, c) => {
    if (v) tiles.push({ id: seq++, value: v, r, c, isNew: false, merged: false, absorbed: false });
  }));
  return { size: n, tiles, score: 0, seq, won: false, keepGoing: false, ...extra };
}

/* True while any move would change something: an empty cell to slide into, or
   two equal neighbours to merge. Checking right and down only is enough —
   every adjacent pair gets visited once from one side or the other. */
export function canMove(g) {
  const n = g.size;
  const live = liveTiles(g);
  if (live.length < n * n) return true;
  const grid = gridOf(g);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const v = grid[r][c];
      if (c + 1 < n && grid[r][c + 1] === v) return true;
      if (r + 1 < n && grid[r + 1][c] === v) return true;
    }
  }
  return false;
}

export const isOver = (g) => !canMove(g);

/* The classic algorithm, per line: compress out the gaps, merge equal
   neighbours scanning from the destination wall outwards, compress again.
   Walking outwards from the wall and skipping past a tile once it has merged
   is what enforces "each tile merges at most once per move" — it is why
   `2 2 2 2` gives `4 4` and never `8`. */
export function move(g, dir, rnd = Math.random) {
  if (!DIRECTIONS.includes(dir)) return { ...g, moved: false };

  const n = g.size;
  const live = liveTiles(g);
  const at = new Map(live.map((t) => [key(t.r, t.c, n), t]));

  const survivors = [];
  const dying = [];
  let gained = 0;
  let moved = false;
  let reached = false;

  for (let i = 0; i < n; i++) {
    const line = [];
    for (let j = 0; j < n; j++) {
      const [r, c] = coord(dir, i, j, n);
      const t = at.get(key(r, c, n));
      if (t) line.push(t);                       // compress: gaps never enter
    }

    const solved = [];
    let k = 0;
    while (k < line.length) {
      const a = line[k], b = line[k + 1];
      if (b && a.value === b.value) {
        solved.push({ keep: a, eaten: b, value: a.value * 2 });
        gained += a.value * 2;
        if (a.value * 2 >= WIN_VALUE) reached = true;
        k += 2;                                  // b is spent; a cannot merge again
      } else {
        solved.push({ keep: a, eaten: null, value: a.value });
        k += 1;
      }
    }

    solved.forEach((s, j) => {
      const [r, c] = coord(dir, i, j, n);
      if (s.keep.r !== r || s.keep.c !== c) moved = true;
      survivors.push({
        ...s.keep, r, c, value: s.value, merged: !!s.eaten, isNew: false,
      });
      if (s.eaten) {
        moved = true;                            // the eaten tile always travels
        dying.push({ ...s.eaten, r, c, merged: false, isNew: false, absorbed: true });
      }
    });
  }

  /* A move that changes nothing is not a move: no tile spawns, no score, and
     the state is handed back untouched so undo and the animation flags are
     not disturbed. */
  if (!moved) return { ...g, moved: false };

  let seq = g.seq;
  const tiles = [...survivors, ...dying];
  /* Occupancy is the survivors alone — a dying tile is sitting on a cell that
     its survivor already owns, so counting it would hide an empty cell. */
  const spawn = makeTile(survivors, n, seq, rnd);
  if (spawn) { tiles.push(spawn); seq += 1; }

  return {
    ...g,
    tiles,
    seq,
    score: g.score + gained,
    won: g.won || reached,
    moved: true,
    gained,
  };
}
