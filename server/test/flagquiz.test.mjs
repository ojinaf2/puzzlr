/* Flag quiz rules. Run with: node test/flagquiz.test.mjs */

import { GAMES, QUIZ_DURATIONS, QUIZ_MIN_QUESTIONS, QUIZ_MAX_QUESTIONS } from '../src/games.js';

let passed = 0, failed = 0;
const check = (label, ok, detail = '') => {
  if (ok) { passed++; console.log('  PASS  ' + label); }
  else { failed++; console.log('  FAIL  ' + label + (detail ? '  -> ' + detail : '')); }
};

const q = GAMES.flagquiz;

const makeRoom = (players = ['ana', 'ben']) => {
  const room = {
    gameId: 'flagquiz', status: 'playing', hostId: players[0],
    players: players.map((id, i) => ({ id, name: id, seat: i, connected: true, lastSeen: Date.now() })),
    game: q.create(),
  };
  room.game = q.start(room);
  return room;
};
const answer = (room, who, code) => {
  const p = room.players.find((x) => x.id === who);
  return q.move(room, p, { index: room.game.progress[who].index, code });
};
const correctCodeFor = (room, who) => room.game.questions[room.game.progress[who].index].answerCode;
const wrongCodeFor = (room, who) => {
  const cur = room.game.questions[room.game.progress[who].index];
  return cur.options.find((o) => o[1] !== cur.answerCode)[1];
};
const finish = (room, who, howManyRight) => {
  const total = room.game.questionCount;
  for (let i = 0; i < total; i++) {
    answer(room, who, i < howManyRight ? correctCodeFor(room, who) : wrongCodeFor(room, who));
  }
};

console.log('\n— setup —');
{
  const r = makeRoom();
  check('a question is built for each slot', r.game.questions.length === r.game.questionCount);
  check('every question has four options', r.game.questions.every((x) => x.options.length === 4));
  check('the answer is among the options', r.game.questions.every((x) => x.options.some((o) => o[1] === x.answerCode)));
  check('options are all different', r.game.questions.every((x) => new Set(x.options.map((o) => o[1])).size === 4));
  check('a whole-quiz clock is set', typeof r.game.endsAt === 'number');
  check('everyone starts on question one', Object.values(r.game.progress).every((p) => p.index === 0 && p.correct === 0));
  check('more than two can play', q.maxPlayers > 2, String(q.maxPlayers));
}

console.log('\n— answering —');
{
  const r = makeRoom();
  answer(r, 'ana', correctCodeFor(r, 'ana'));
  check('a right answer scores', r.game.progress.ana.correct === 1);
  check('and moves you on', r.game.progress.ana.index === 1);
  answer(r, 'ana', wrongCodeFor(r, 'ana'));
  check('a wrong answer does not score', r.game.progress.ana.correct === 1);
  check('but still moves you on', r.game.progress.ana.index === 2);
  check('players advance independently', r.game.progress.ben.index === 0);
}

console.log('\n— rejecting nonsense —');
{
  const r = makeRoom();
  check('an option not on the list is refused', !!q.move(r, r.players[0], { index: 0, code: 'zz' }).error);
  check('answering a question you are not on is refused',
    !!q.move(r, r.players[0], { index: 3, code: correctCodeFor(r, 'ana') }).error);
  r.game.endsAt = Date.now() - 1;
  check('answering after the clock is refused', !!answer(r, 'ana', correctCodeFor(r, 'ana')).error);
}

console.log('\n— finishing —');
{
  const r = makeRoom();
  finish(r, 'ana', 7);
  check('finishing is recorded', typeof r.game.progress.ana.finishedAt === 'number');
  check('the score is kept', r.game.progress.ana.correct === 7, String(r.game.progress.ana.correct));
  check('you cannot answer again', !!q.move(r, r.players[0], { index: 10, code: 'us' }).error);
  check('the quiz waits for the others', r.game.winners === undefined);
}
{
  const r = makeRoom();
  finish(r, 'ana', 6);
  const res = finish(r, 'ben', 9) ?? q.move(r, r.players[1], {});
  check('everyone finishing ends it early', Array.isArray(r.game.winners), JSON.stringify(r.game.winners));
  check('the higher score wins', r.game.winners?.[0] === 'ben', JSON.stringify(r.game.winners));
  check('the winner is credited', r.game.wins.ben === 1 && r.game.wins.ana === 0, JSON.stringify(r.game.wins));
}

console.log('\n— running out of time is a loss —');
{
  const r = makeRoom();
  finish(r, 'ana', 3);                            // Ana finishes, but only 3 right
  for (let i = 0; i < 5; i++) answer(r, 'ben', correctCodeFor(r, 'ben'));   // Ben: 5 right, unfinished
  q.timeUp(r);
  check('only finishers can win', r.game.winners.length === 1 && r.game.winners[0] === 'ana', JSON.stringify(r.game.winners));
  check('Ben genuinely had the better score', r.game.progress.ben.correct > r.game.progress.ana.correct,
    JSON.stringify({ ben: r.game.progress.ben.correct, ana: r.game.progress.ana.correct }));
  check('but an unfinished run scores nothing', r.game.wins.ben === 0, JSON.stringify(r.game.wins));
  check('the finisher is credited', r.game.wins.ana === 1);
}
{
  const r = makeRoom();
  answer(r, 'ana', correctCodeFor(r, 'ana'));
  q.timeUp(r);
  check('nobody finishing means nobody wins', r.game.winners.length === 0, JSON.stringify(r.game.winners));
  check('and nobody is credited', Object.values(r.game.wins).every((v) => v === 0), JSON.stringify(r.game.wins));
}

console.log('\n— ties —');
{
  const r = makeRoom();
  finish(r, 'ana', 5);
  finish(r, 'ben', 5);
  check('equal finishers both win', r.game.winners.length === 2, JSON.stringify(r.game.winners));
  check('and both are credited', r.game.wins.ana === 1 && r.game.wins.ben === 1);
}

console.log('\n— settings —');
{
  const r = makeRoom();
  r.status = 'over';
  check('a mode can be chosen', !q.config(r, { mode: 'country2flag' }).error && r.game.mode === 'country2flag');
  check('an unknown mode is refused', !!q.config(r, { mode: 'nonsense' }).error);
  check('a question count in range is accepted', !q.config(r, { questionCount: 15 }).error && r.game.questionCount === 15);
  check('too few questions is refused', !!q.config(r, { questionCount: QUIZ_MIN_QUESTIONS - 1 }).error);
  check('too many questions is refused', !!q.config(r, { questionCount: QUIZ_MAX_QUESTIONS + 1 }).error);
  check('a fractional count is refused', !!q.config(r, { questionCount: 7.5 }).error);
  check('an offered duration is accepted', !q.config(r, { durationMs: 240000 }).error);
  check('an invented duration is refused', !!q.config(r, { durationMs: 99 }).error);
  check('the offered durations are 30s, 60s, 2min and 4min', JSON.stringify(QUIZ_DURATIONS) === '[30000,60000,120000,240000]');
  r.status = 'playing';
  check('settings are locked once running', !!q.config(r, { questionCount: 5 }).error);
}
{
  const r = makeRoom();
  r.status = 'over';
  q.config(r, { mode: 'country2flag', questionCount: 5, durationMs: 30000 });
  const next = q.start(r, r.game);
  check('settings carry into the next quiz', next.mode === 'country2flag' && next.questionCount === 5 && next.durationMs === 30000);
  check('and it builds that many questions', next.questions.length === 5);
  check('the round number advances', next.roundNo === 2);
}

console.log('\n— what players can see —');
{
  const r = makeRoom();
  answer(r, 'ana', correctCodeFor(r, 'ana'));
  const seen = q.view(r, 'ana');

  const shown = seen.game.questions.filter(Boolean);
  check('only the question you are on is sent', shown.length === 1, String(shown.length));
  check('and it carries no stored answer', shown[0].answerCode === undefined, JSON.stringify(shown[0]));
  check('later questions are withheld entirely', seen.game.questions[5] === null);
  check('you can see your own answers', Array.isArray(seen.game.progress.ana.answers));
  check("you cannot see another player's answer list", seen.game.progress.ben.answers === undefined);
  check('but you can see how far they have got', typeof seen.game.progress.ben.index === 'number');

  r.status = 'over';
  const after = q.view(r, 'ana');
  check('everything is revealed at the end', after.game.questions.every((x) => x && x.answerCode));
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
