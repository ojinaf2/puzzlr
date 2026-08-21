/* Daily-puzzle bookkeeping: streaks, distributions and the once-a-day rule.

     node test/daily.test.mjs

   Same style as the server suites -- plain node, no framework. This logic gets
   a test rather than a browser run because the interesting cases span days,
   and the UI cannot reach them without changing the system clock. */
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, v),
};

const { finishDaily, loadDaily, saveBoard, todaysRecord } = await import('../src/shared/daily.js');

let pass = 0, fail = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else { fail++; console.log(`FAIL ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
};

const reset = () => store.clear();

// consecutive wins build a streak
reset();
finishDaily('g', 10, true, '3');
eq('day 10 streak', loadDaily('g').streak, 1);
finishDaily('g', 11, true, '4');
eq('day 11 streak', loadDaily('g').streak, 2);
finishDaily('g', 12, true, '2');
eq('day 12 streak', loadDaily('g').streak, 3);
eq('best tracks streak', loadDaily('g').best, 3);
eq('distribution', loadDaily('g').dist, { 3: 1, 4: 1, 2: 1 });

// a skipped day restarts the streak, but best is kept
finishDaily('g', 15, true, '5');
eq('after a gap', loadDaily('g').streak, 1);
eq('best survives gap', loadDaily('g').best, 3);

// a loss ends the streak and is not counted in the distribution
finishDaily('g', 16, false, 'X');
eq('loss zeroes streak', loadDaily('g').streak, 0);
eq('loss not in dist', loadDaily('g').dist['X'], undefined);
eq('played counts losses', loadDaily('g').played, 5);   // days 10,11,12,15,16
eq('won counts wins only', loadDaily('g').won, 4);      // all but day 16

// a win the day after a loss starts at 1, not 0
finishDaily('g', 17, true, '1');
eq('win after loss', loadDaily('g').streak, 1);

// finishing the same day twice must not inflate anything
reset();
finishDaily('g', 20, true, '3');
finishDaily('g', 20, true, '3');
finishDaily('g', 20, false, 'X');
eq('idempotent played', loadDaily('g').played, 1);
eq('idempotent streak', loadDaily('g').streak, 1);
eq('idempotent dist', loadDaily('g').dist, { 3: 1 });

// yesterday's board must not leak into today
reset();
saveBoard('g', 30, ['aaaaa']);
eq('board kept same day', todaysRecord('g', 30).board, ['aaaaa']);
eq('board cleared next day', todaysRecord('g', 31).board, null);

/* A streak has to survive being played, not just being scored.

   Every guess calls saveBoard, which moves the stored day to today before the
   puzzle is finished. The tests above went straight from finishDaily to
   finishDaily and so never saw it — while every real player types a guess
   first, which used to reset their streak to 1 every single day. */
reset();
finishDaily('g', 40, true, '3');
saveBoard('g', 41, ['aaaaa']);                 // a guess typed the next day
finishDaily('g', 41, true, '4');
eq('a guess before finishing does not break the streak', loadDaily('g').streak, 2);

saveBoard('g', 42, ['bbbbb']);
finishDaily('g', 42, true, '2');
eq('and keeps building', loadDaily('g').streak, 3);

// A gap is still a gap, however the days in between were spent.
saveBoard('g', 45, ['ccccc']);
finishDaily('g', 45, true, '2');
eq('a skipped day still restarts it', loadDaily('g').streak, 1);
eq('best survives the gap', loadDaily('g').best, 3);

// A loss still ends it, and does not quietly count as the last win.
saveBoard('g', 46, ['ddddd']);
finishDaily('g', 46, false, 'X');
eq('a loss zeroes it', loadDaily('g').streak, 0);
saveBoard('g', 47, ['eeeee']);
finishDaily('g', 47, true, '2');
eq('the day after a loss starts from one', loadDaily('g').streak, 1);

/* A record written by the build before `lastWon` existed still has to read
   correctly for a player who has not started today's puzzle yet. */
reset();
store.set('puzzlr:daily:g', JSON.stringify(
  { day: 50, board: null, done: { won: true, bucket: '3' }, played: 4, won: 4, streak: 4, best: 4, dist: {} }));
finishDaily('g', 51, true, '3');
eq('an older record still continues its streak', loadDaily('g').streak, 5);

// a wiped localStorage must not throw
globalThis.localStorage = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
eq('survives blocked storage', loadDaily('g').streak, 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
