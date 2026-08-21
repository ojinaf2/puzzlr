/* ============================= TETRIS RULES =============================

   The whole engine, with no React and no DOM, so node can test it — the same
   split Snake, Minesweeper and 2048 use. It matters more here than in any of
   them: SRS wall kicks and the 7-bag are exactly the kind of rules that look
   right until the one case where they are not, and neither can be reached
   reliably by playing.

   The state is a plain serialisable object and every function is pure, taking
   a state and returning a new one. That is deliberate beyond testability: an
   online mode would need two browsers to agree on the same game, and the only
   thing that makes that cheap is a deterministic engine plus a seed. Nothing
   here reads the clock or Math.random — the caller supplies the seed and
   drives the timing.                                                        */

export const COLS = 10;
export const ROWS = 20;

export const TYPES = ["I", "O", "T", "S", "Z", "J", "L"];

/* The colours are the toy, like Connect 4's red and yellow, so they are
   literals rather than palette tokens and stay the same in both themes. The
   well is dark in both themes for the same reason it is dark in every other
   Tetris: it is the only background these seven all read against. A mid-tone
   well sits in the middle of their luminance range and kills all seven at
   once — measured, not guessed. */
export const COLOURS = {
  I: "#3fa9a5", O: "#d9a520", T: "#9b5fa8", S: "#5aa356",
  Z: "#c0492f", J: "#3f6fc4", L: "#d97a2b",
};

/* Cells of each piece in its own box, per rotation state 0-3. Box coordinates,
   x right and y down — note that is upside down from how SRS is usually
   written, which matters for the kick table below. */
const SHAPES = {
  I: [
    [[0, 1], [1, 1], [2, 1], [3, 1]],
    [[2, 0], [2, 1], [2, 2], [2, 3]],
    [[0, 2], [1, 2], [2, 2], [3, 2]],
    [[1, 0], [1, 1], [1, 2], [1, 3]],
  ],
  O: [
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
  ],
  T: [
    [[1, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [1, 2]],
    [[1, 0], [0, 1], [1, 1], [1, 2]],
  ],
  S: [
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[1, 0], [1, 1], [2, 1], [2, 2]],
    [[1, 1], [2, 1], [0, 2], [1, 2]],
    [[0, 0], [0, 1], [1, 1], [1, 2]],
  ],
  Z: [
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[2, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [1, 2], [2, 2]],
    [[1, 0], [0, 1], [1, 1], [0, 2]],
  ],
  J: [
    [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [2, 2]],
    [[1, 0], [1, 1], [0, 2], [1, 2]],
  ],
  L: [
    [[2, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 2]],
    [[0, 1], [1, 1], [2, 1], [0, 2]],
    [[0, 0], [1, 0], [1, 1], [1, 2]],
  ],
};

/* SRS wall kicks: the offsets to try, in order, when a rotation is blocked
   where the piece stands. This is the whole reason modern Tetris rotation
   feels right — without it a piece flush against a wall simply refuses to
   turn, and T-spins do not exist.

   Published SRS tables have y pointing up. These are negated, because the
   board here has y pointing down; getting that backwards produces a rotation
   system that works in open space and kicks the wrong way in a well, which is
   the failure that looks like "mostly fine". */
const KICKS_JLSTZ = {
  "01": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "10": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  "12": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  "21": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "23": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  "32": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "30": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "03": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
};
const KICKS_I = {
  "01": [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  "10": [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  "12": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  "21": [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  "23": [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  "32": [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  "30": [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  "03": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
};
const kicksFor = (type, from, to) => {
  if (type === "O") return [[0, 0]];               // O has no meaningful rotation
  return (type === "I" ? KICKS_I : KICKS_JLSTZ)[`${from}${to}`];
};

/* ------------------------------------------------------------------ random
   mulberry32, carried as a number in the state rather than as a closure, so
   a game can be serialised, replayed, or handed to a second browser and stay
   in step. */
const nextRand = (seed) => {
  let a = (seed + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
};

/* The 7-bag. Every piece appears once per seven, which is what stops the long
   droughts and the five-S-in-a-row runs that make pure randomness feel
   spiteful. Refills only when empty. */
const refill = (rng) => {
  const bag = [...TYPES];
  let seed = rng;
  for (let i = bag.length - 1; i > 0; i--) {
    const [r, s] = nextRand(seed);
    seed = s;
    const j = Math.floor(r * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return [bag, seed];
};

/* Keeps the queue topped up to `want` so the preview can show more than one. */
const fill = (queue, bag, rng, want) => {
  let q = [...queue], b = [...bag], seed = rng;
  while (q.length < want) {
    if (!b.length) [b, seed] = refill(seed);
    q.push(b.shift());
  }
  return [q, b, seed];
};

export const PREVIEW = 3;
const SPAWN_X = 3;
const SPAWN_Y = 0;

export const cellsOf = (type, rot, x, y) =>
  SHAPES[type][rot].map(([cx, cy]) => [x + cx, y + cy]);

export const pieceCells = (p) => (p ? cellsOf(p.type, p.rot, p.x, p.y) : []);

const emptyBoard = () => Array.from({ length: ROWS }, () => Array(COLS).fill(null));

/* The settled board as one integer per row, ten bits wide. Enough to draw an
   opponent's thumbnail in an online match, and a twentieth the size of
   sending the cells themselves — which matters when it goes over the wire on
   every piece that lands. Colours are dropped deliberately: at thumbnail size
   they are noise. */
export const packRows = (board) =>
  board.map((row) => row.reduce((bits, cell, x) => (cell ? bits | (1 << x) : bits), 0));

/* A cell is blocked if it is off the sides, below the floor, or already
   filled. Above the top is deliberately allowed — a piece spawns partly
   off-screen and has to be able to sit there. */
const blocked = (board, x, y) =>
  x < 0 || x >= COLS || y >= ROWS || (y >= 0 && board[y][x] !== null);

export const collides = (board, type, rot, x, y) =>
  cellsOf(type, rot, x, y).some(([cx, cy]) => blocked(board, cx, cy));

const spawn = (g) => {
  const [queue, bag, rng] = fill(g.queue, g.bag, g.rng, PREVIEW + 1);
  const type = queue[0];
  const piece = { type, rot: 0, x: SPAWN_X, y: SPAWN_Y };
  const dead = collides(g.board, type, 0, piece.x, piece.y);
  return {
    ...g,
    queue: queue.slice(1),
    bag,
    rng,
    piece: dead ? null : piece,
    holdUsed: false,
    status: dead ? "over" : "playing",
  };
};

export function newGame(seed = 1) {
  const base = {
    board: emptyBoard(),
    piece: null,
    queue: [],
    bag: [],
    rng: seed >>> 0,
    hold: null,
    holdUsed: false,
    score: 0,
    lines: 0,
    level: 1,
    status: "playing",
    pending: null,          // rows waiting to be cleared, while the flash plays
    lastClear: 0,           // how many went at once, for the celebration
    clearId: 0,             // changes every clear, so an animation can restart
  };
  return spawn(base);
}

/* ------------------------------------------------------------------ moving */
export function moveBy(g, dx, dy) {
  if (g.status !== "playing" || !g.piece) return g;
  const { type, rot, x, y } = g.piece;
  if (collides(g.board, type, rot, x + dx, y + dy)) return g;
  return { ...g, piece: { ...g.piece, x: x + dx, y: y + dy } };
}

export const moveLeft = (g) => moveBy(g, -1, 0);
export const moveRight = (g) => moveBy(g, 1, 0);

export const canFall = (g) =>
  !!g.piece && g.status === "playing"
  && !collides(g.board, g.piece.type, g.piece.rot, g.piece.x, g.piece.y + 1);

/* Soft drop pays a point a cell, which is what makes pushing a piece down
   worth doing rather than just waiting for gravity. */
export function softDrop(g) {
  if (!canFall(g)) return g;
  return { ...moveBy(g, 0, 1), score: g.score + 1 };
}

export function ghostY(g) {
  if (!g.piece) return null;
  const { type, rot, x } = g.piece;
  let y = g.piece.y;
  while (!collides(g.board, type, rot, x, y + 1)) y++;
  return y;
}

/* ---------------------------------------------------------------- rotating */
export function rotate(g, dir = 1) {
  if (g.status !== "playing" || !g.piece) return g;
  const { type, rot, x, y } = g.piece;
  const to = (rot + (dir > 0 ? 1 : 3)) % 4;
  for (const [kx, ky] of kicksFor(type, rot, to)) {
    if (!collides(g.board, type, to, x + kx, y + ky)) {
      return { ...g, piece: { ...g.piece, rot: to, x: x + kx, y: y + ky } };
    }
  }
  return g;                                        // every kick blocked
}

/* ------------------------------------------------------------------- hold
   Once per piece. Without the flag a player can swap back and forth forever
   and never have to place anything. */
export function holdPiece(g) {
  if (g.status !== "playing" || !g.piece || g.holdUsed) return g;
  const current = g.piece.type;
  if (g.hold === null) {
    const swapped = spawn({ ...g, hold: current, piece: null });
    return { ...swapped, holdUsed: true };
  }
  const type = g.hold;
  if (collides(g.board, type, 0, SPAWN_X, SPAWN_Y)) {
    return { ...g, hold: current, piece: null, status: "over", holdUsed: true };
  }
  return {
    ...g,
    hold: current,
    piece: { type, rot: 0, x: SPAWN_X, y: SPAWN_Y },
    holdUsed: true,
  };
}

/* ------------------------------------------------------------------ locking
   Locking is two steps on purpose. `lock` merges the piece and reports which
   rows are full without removing them, so the board can be rendered with the
   completed rows still in place while they flash. `resolveClear` then takes
   them out. Collapsing immediately would mean the flash plays over rows that
   are already gone. */
export function lock(g) {
  if (!g.piece) return g;
  const board = g.board.map((row) => [...row]);
  for (const [cx, cy] of pieceCells(g.piece)) {
    if (cy >= 0 && cy < ROWS && cx >= 0 && cx < COLS) board[cy][cx] = g.piece.type;
  }
  const full = [];
  for (let r = 0; r < ROWS; r++) if (board[r].every((c) => c !== null)) full.push(r);

  if (!full.length) return spawn({ ...g, board, piece: null });
  return { ...g, board, piece: null, pending: full, status: "clearing" };
}

export const LINE_SCORES = [0, 100, 300, 500, 800];

export function resolveClear(g) {
  if (!g.pending) return g;
  const gone = new Set(g.pending);
  const kept = g.board.filter((_, r) => !gone.has(r));
  const board = [
    ...Array.from({ length: g.pending.length }, () => Array(COLS).fill(null)),
    ...kept,
  ];
  const count = g.pending.length;
  const lines = g.lines + count;
  return spawn({
    ...g,
    board,
    pending: null,
    status: "playing",
    score: g.score + LINE_SCORES[count] * g.level,
    lines,
    /* A level every ten lines, which is what drives the gravity curve. */
    level: Math.floor(lines / 10) + 1,
    lastClear: count,
    clearId: g.clearId + 1,
  });
}

/* Straight to the bottom, two points a cell, and it locks on arrival. */
export function hardDrop(g) {
  if (g.status !== "playing" || !g.piece) return g;
  const to = ghostY(g);
  const dropped = to - g.piece.y;
  return lock({
    ...g,
    piece: { ...g.piece, y: to },
    score: g.score + dropped * 2,
  });
}

/* The Tetris guideline curve, (0.8 - (level-1) * 0.007) ^ (level-1) seconds:
   a second a row at level 1, a third of a second by level 5, and 64ms by
   level 10.

   It is floored at 60ms, which the curve reaches around level 11. Left
   unfloored it keeps going — level 15 is 7ms and level 20 is under a
   millisecond, which is not a difficulty curve, it is a wall with no
   gameplay behind it. Every version of this game plateaus somewhere; this is
   where. The base is clamped too, because the formula turns negative past
   level 100 and would start handing back nonsense. */
export const GRAVITY_FLOOR_MS = 60;

export function gravityMs(level) {
  const l = Math.max(1, level);
  const base = Math.max(0.05, 0.8 - (l - 1) * 0.007);
  return Math.max(GRAVITY_FLOOR_MS, base ** (l - 1) * 1000);
}

/* ------------------------------------------------------------------ rush
   Score buys speed on top of the level curve. Levels come from lines cleared,
   so a cautious player who clears singles forever climbs slowly; this keys off
   points instead, which means the big clears that earn them also bring the
   pressure. Highest matching tier wins and it never comes back down.

   Below the level curve's own floor there is a second, lower one. Six times a
   60ms fall is 10ms, which is not difficulty — a piece would cross the board
   in a fifth of a second, faster than it can be seen let alone steered. 25ms
   is still brutal (forty rows a second) but it is a fall rather than a
   teleport. */
export const RUSH_FLOOR_MS = 25;

/* The game does not start at the level curve's own pace — it starts half as
   fast again, and climbs from there. An opening piece that drifts down over
   most of a second is a menu, not a game. */
export const BASE_MULTIPLIER = 1.5;

/* Half-step tiers rather than doublings. The old curve went 2x, 4x, 6x, which
   meant crossing 16,000 roughly halved the time you had to think — a cliff
   rather than a climb, and the run usually ended within a piece or two of it.
   These step by 0.5 and stop at 3.7, so the endgame is fast and survivable
   instead of fast and brief. */
export const SPEED_TIERS = [
  { from: 34000, multiplier: 3.7 },
  { from: 26000, multiplier: 3.5 },
  { from: 20000, multiplier: 3 },
  { from: 14000, multiplier: 2.5 },
  { from: 8000, multiplier: 2 },
];

export const speedMultiplier = (score = 0) =>
  SPEED_TIERS.find((t) => score >= t.from)?.multiplier ?? BASE_MULTIPLIER;

/* What the game should actually use: the level curve, then the score tier. */
export function fallMs(level, score = 0) {
  return Math.max(RUSH_FLOOR_MS, gravityMs(level) / speedMultiplier(score));
}

/* ------------------------------------------------------- banked fall time

   The loop counts elapsed milliseconds into an accumulator and spends one row
   every time it crosses the current fall time. That is fine until the fall
   time *changes underneath the bank*, which is what pressing soft drop does:
   at level one the accumulator is filling toward 667ms, and the moment the
   threshold collapses to 90ms every millisecond already banked is spent at
   once. Half a second of waiting became five rows in a single frame — the
   piece lurched down the board and only then began falling smoothly.

   So when the threshold drops, the bank is trimmed to a single step's worth.
   One row comes out immediately, which is what makes the key feel responsive,
   and the rest of the wait is forfeited rather than cashed in.

   Only ever trimmed *downwards*. A threshold that grows (letting go of soft
   drop) keeps its bank, and a long frame at high speed still legitimately
   catches up several rows — capping that would quietly make the endgame
   slower than the curve says it is. */
export function bankedDrop(banked, speed, prevSpeed) {
  return speed < prevSpeed ? Math.min(banked, speed) : banked;
}
