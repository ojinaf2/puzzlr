/* ============================= SNAKE RULES =============================
   The whole game as pure data and pure functions, kept apart from the
   component for the same reason the online games keep their rules on the
   server: rules that are just functions can be tested directly. Eating an
   apple depends on where one randomly spawned, so these cases are close to
   untestable through the real UI — see test/snake.test.mjs.

   `step` must stay pure. React may invoke a state updater twice in
   development, and anything that mutated or double-counted would surface as a
   phantom point or a missed collision.                                     */

export const SIZE = 15;
export const CELLS = SIZE * SIZE;

/* The most apples reachable. The snake occupies its own starting cell, so the
   board can never be filled completely — worth stating, because "15 x 15 =
   225" is the number everyone expects and it is not achievable. */
export const MAX_SCORE = CELLS - 1;

export const SPEEDS = [
  { key: "easy", name: "Easy", blurb: "A steady pace to learn on", ms: 175 },
  { key: "medium", name: "Medium", blurb: "A bit faster", ms: 110 },
  { key: "hard", name: "Hard", blurb: "Very, very fast", ms: 62 },
];

export const DIRS = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
  left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};

const cellId = (p) => p.y * SIZE + p.x;

export const spawnApple = (snake) => {
  const taken = new Set(snake.map(cellId));
  const free = [];
  for (let i = 0; i < CELLS; i++) if (!taken.has(i)) free.push(i);
  if (!free.length) return null;                       // board full: a win
  const i = free[Math.floor(Math.random() * free.length)];
  return { x: i % SIZE, y: Math.floor(i / SIZE) };
};

export const freshGame = () => {
  const mid = Math.floor(SIZE / 2);
  const snake = [{ x: mid, y: mid }];
  return {
    snake, apple: spawnApple(snake), dir: DIRS.right, queue: [],
    score: 0, status: "ready", death: null,
  };
};

/* One tick, as a pure function of the previous state. */
export const step = (g) => {
  if (g.status !== "running") return g;

  /* Drain the queue until a usable turn is found. Buffering rather than
     applying input immediately is what makes a fast double-tap — up then
     left — reliably produce both turns instead of swallowing the first. */
  let dir = g.dir;
  let queue = g.queue;
  while (queue.length) {
    const next = queue[0];
    queue = queue.slice(1);
    if (next.x === -dir.x && next.y === -dir.y) continue;   // straight into the neck
    if (next.x === dir.x && next.y === dir.y) continue;     // already going that way
    dir = next;
    break;
  }

  const head = { x: g.snake[0].x + dir.x, y: g.snake[0].y + dir.y };

  if (head.x < 0 || head.y < 0 || head.x >= SIZE || head.y >= SIZE) {
    return { ...g, dir, queue, status: "dead", death: { ...g.snake[0], wall: true } };
  }

  const eating = !!g.apple && head.x === g.apple.x && head.y === g.apple.y;
  /* The tail vacates its cell on this same tick, so following it is legal —
     unless the snake is growing, in which case the tail stays put. Getting
     this wrong is what makes a long snake feel cursed. */
  const body = eating ? g.snake : g.snake.slice(0, -1);
  if (body.some((s) => s.x === head.x && s.y === head.y)) {
    return { ...g, dir, queue, status: "dead", death: { ...head, wall: false } };
  }

  const snake = [head, ...body];
  if (!eating) return { ...g, snake, dir, queue };

  const apple = spawnApple(snake);
  const score = g.score + 1;
  return apple
    ? { ...g, snake, apple, dir, queue, score }
    : { ...g, snake, apple: null, dir, queue, score, status: "won" };
};
