/* Snake's movement rules: collisions, turning, growth and the win.

     node test/snake.test.mjs

   `step` is a pure function of the previous state, which is what makes this
   testable at all — and the reason it is worth testing here rather than in the
   browser. Eating an apple depends on where the apple randomly spawned, so
   driving these cases through the real UI would mean waiting for luck. */

const { step, freshGame, SIZE, DIRS } = await import('../src/games/snakeRules.js');

let pass = 0, fail = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else { fail++; console.log(`FAIL ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
};

const game = (over) => ({ ...freshGame(), status: "running", ...over });
const at = (x, y) => ({ x, y });

/* --------------------------------------------------------------- moving */
{
  const g = step(game({ snake: [at(5, 5)], apple: at(0, 0) }));
  eq('moves one cell right', g.snake[0], at(6, 5));
  eq('length unchanged without an apple', g.snake.length, 1);
  eq('still running', g.status, 'running');
}

/* -------------------------------------------------------------- turning */
{
  const g = step(game({ snake: [at(5, 5)], apple: at(0, 0), queue: [DIRS.down] }));
  eq('queued turn is applied', g.snake[0], at(5, 6));
  eq('queue is consumed', g.queue.length, 0);
}
{
  // Reversing into your own neck is the classic instant-death bug.
  const g = step(game({ snake: [at(5, 5), at(4, 5)], apple: at(0, 0), queue: [DIRS.left] }));
  eq('180 turn is ignored', g.snake[0], at(6, 5));
  eq('180 turn does not kill', g.status, 'running');
}
{
  // Two turns tapped inside one tick: the first must not be swallowed.
  let g = game({ snake: [at(5, 5)], apple: at(0, 0), queue: [DIRS.up, DIRS.left] });
  g = step(g);
  eq('first buffered turn taken', g.snake[0], at(5, 4));
  g = step(g);
  eq('second buffered turn taken next tick', g.snake[0], at(4, 4));
}

/* ------------------------------------------------------------ collisions */
for (const [name, snake, dir] of [
  ['right wall', [at(SIZE - 1, 5)], DIRS.right],
  ['left wall', [at(0, 5)], DIRS.left],
  ['top wall', [at(5, 0)], DIRS.up],
  ['bottom wall', [at(5, SIZE - 1)], DIRS.down],
]) {
  const g = step(game({ snake, apple: at(9, 9), dir, queue: [] }));
  eq(`${name} kills`, g.status, 'dead');
  eq(`${name} is flagged as a wall`, g.death.wall, true);
}
{
  /* Into the middle of the body, not the tail — the tail is the one body cell
     that is legal to enter, and it is covered separately below. */
  const snake = [at(5, 5), at(6, 5), at(6, 6), at(5, 6), at(4, 6)];
  const g = step(game({ snake, apple: at(0, 0), dir: DIRS.down, queue: [] }));
  eq('running into the body kills', g.status, 'dead');
  eq('body death is not a wall', g.death.wall, false);
  eq('death is recorded where it happened', g.death.x, 5);
}
{
  /* Chasing your own tail is legal: the tail vacates the cell on the same
     tick you enter it. Getting this wrong makes a long snake feel cursed. */
  const snake = [at(5, 5), at(5, 6), at(6, 6), at(6, 5)];
  const g = step(game({ snake, apple: at(0, 0), dir: DIRS.up, queue: [DIRS.right] }));
  eq('following the vacated tail is safe', g.status, 'running');
  eq('and lands on it', g.snake[0], at(6, 5));
}

/* --------------------------------------------------------------- eating */
{
  const g = step(game({ snake: [at(5, 5), at(4, 5)], apple: at(6, 5) }));
  eq('score goes up', g.score, 1);
  eq('snake grows', g.snake.length, 3);
  eq('tail stays put while growing', g.snake[2], at(4, 5));
  eq('a new apple appears', typeof g.apple.x, 'number');
  eq('the new apple is not under the snake',
    g.snake.some((s) => s.x === g.apple.x && s.y === g.apple.y), false);
}
{
  /* Eating while the tail would otherwise have vacated: the cell is still
     occupied this tick, so entering it must be a death, not a free pass. */
  const snake = [at(5, 5), at(5, 6), at(6, 6), at(6, 5)];
  const g = step(game({ snake, apple: at(6, 5), dir: DIRS.up, queue: [DIRS.right] }));
  eq('growing onto the tail kills', g.status, 'dead');
}

/* ------------------------------------------------------------------ win */
{
  // Fill every cell but one, and put the last apple in it.
  const snake = [];
  for (let y = 0; y < SIZE; y++) {
    const row = y % 2 === 0 ? [...Array(SIZE).keys()] : [...Array(SIZE).keys()].reverse();
    for (const x of row) snake.push(at(x, y));
  }
  const last = snake.pop();                       // leave one cell free
  snake.reverse();                                // head first
  const dir = { x: last.x - snake[0].x, y: last.y - snake[0].y };
  // It started one segment long, so its score so far is length minus one.
  const g = step(game({ snake, apple: last, dir, queue: [], score: snake.length - 1 }));
  eq('filling the board wins', g.status, 'won');
  eq('final length is every cell', g.snake.length, SIZE * SIZE);
  eq('top score is cells minus the starting one', g.score, SIZE * SIZE - 1);
}

/* ------------------------------------------------------------- stopping */
{
  const dead = game({ snake: [at(5, 5)], apple: at(0, 0), status: 'dead' });
  eq('a dead game does not move', step(dead), dead);
  const paused = game({ snake: [at(5, 5)], apple: at(0, 0), status: 'paused' });
  eq('a paused game does not move', step(paused), paused);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
