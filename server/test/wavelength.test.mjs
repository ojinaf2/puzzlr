/* Wavelength rules. Run with: node test/wavelength.test.mjs */

import { GAMES } from '../src/games.js';

let passed = 0, failed = 0;
const check = (label, ok, detail = '') => {
  if (ok) { passed++; console.log('  PASS  ' + label); }
  else { failed++; console.log('  FAIL  ' + label + (detail ? '  -> ' + detail : '')); }
};

const w = GAMES.wavelength;

const makeRoom = (ids = ['ana', 'ben', 'cara']) => {
  const room = {
    gameId: 'wavelength', status: 'playing', hostId: ids[0],
    players: ids.map((id, i) => ({ id, name: id, seat: i, connected: true, lastSeen: Date.now() })),
    game: w.create(),
  };
  room.game = w.start(room);
  return room;
};
const act = (room, who, msg) => w.move(room, room.players.find((p) => p.id === who), msg);
const giver = (room) => room.game.giverId;
const others = (room) => room.players.filter((p) => p.id !== giver(room)).map((p) => p.id);

console.log('\n— setup —');
{
  const r = makeRoom();
  check('everyone gives exactly one clue', r.game.totalRounds === 3, String(r.game.totalRounds));
  check('it opens on the clue phase', r.game.phase === 'clue');
  check('a clue-giver is chosen', r.game.order.includes(r.game.giverId));
  check('a spectrum is picked', Array.isArray(r.game.spectrum) && r.game.spectrum.length === 2);
  check('the target avoids the very edges', r.game.target >= 8 && r.game.target <= 92, String(r.game.target));
  check('everyone starts on zero', Object.values(r.game.scores).every((s) => s === 0));
  check('seven is the ceiling', w.maxPlayers === 7, String(w.maxPlayers));

  const seven = makeRoom(['a','b','c','d','e','f','g']);
  check('seven players means seven rounds', seven.game.totalRounds === 7, String(seven.game.totalRounds));
}

console.log('\n— giving the clue —');
{
  const r = makeRoom();
  const notGiver = others(r)[0];
  check('a guesser cannot give the clue', !!act(r, notGiver, { action: 'clue', clue: 'hot' }).error);
  check('an empty clue is refused', !!act(r, giver(r), { action: 'clue', clue: '   ' }).error);
  check('the giver can give one', !act(r, giver(r), { action: 'clue', clue: 'volcano' }).error);
  check('and it moves to guessing', r.game.phase === 'guess');
  check('the clue is recorded', r.game.clue === 'volcano');
  check('a second clue is refused', !!act(r, giver(r), { action: 'clue', clue: 'again' }).error);
}

console.log('\n— guessing —');
{
  const r = makeRoom();
  act(r, giver(r), { action: 'clue', clue: 'volcano' });
  const [g1, g2] = others(r);

  check('the clue-giver cannot guess', !!act(r, giver(r), { action: 'guess', value: 50 }).error);
  check('a dial off the scale is refused', !!act(r, g1, { action: 'guess', value: 140 }).error);
  check('a negative dial is refused', !!act(r, g1, { action: 'guess', value: -5 }).error);
  check('a real guess is taken', !act(r, g1, { action: 'guess', value: 62 }).error && r.game.guesses[g1] === 62);
  check('it can be moved before locking', !act(r, g1, { action: 'guess', value: 70 }).error && r.game.guesses[g1] === 70);

  act(r, g1, { action: 'lock' });
  check('locking sticks', r.game.locked[g1] === true);
  check('and the dial then stops moving', !!act(r, g1, { action: 'guess', value: 20 }).error);
  check('one player locking does not end the round', r.game.phase === 'guess');

  act(r, g2, { action: 'lock' });
  check('everyone locking reveals it', r.game.phase === 'reveal', r.game.phase);
}

console.log('\n— scoring —');
{
  const r = makeRoom();
  act(r, giver(r), { action: 'clue', clue: 'x' });
  const [g1, g2] = others(r);
  const t = r.game.target;

  act(r, g1, { action: 'guess', value: t });        // dead on: 4
  act(r, g2, { action: 'guess', value: t + 10 });   // within 15: 2
  act(r, g1, { action: 'lock' });
  act(r, g2, { action: 'lock' });

  check('a bullseye is worth four', r.game.roundPoints[g1] === 4, String(r.game.roundPoints[g1]));
  check('a middling guess is worth two', r.game.roundPoints[g2] === 2, String(r.game.roundPoints[g2]));
  check('the clue-giver takes both added together', r.game.roundPoints[giver(r)] === 6, String(r.game.roundPoints[giver(r)]));
  check('and the running totals agree', r.game.scores[g1] === 4 && r.game.scores[g2] === 2 && r.game.scores[giver(r)] === 6,
    JSON.stringify(r.game.scores));
}
{
  const r = makeRoom();
  act(r, giver(r), { action: 'clue', clue: 'x' });
  const [g1, g2] = others(r);
  const far = r.game.target > 50 ? 0 : 100;
  act(r, g1, { action: 'guess', value: far });
  act(r, g2, { action: 'guess', value: far });
  act(r, g1, { action: 'lock' }); act(r, g2, { action: 'lock' });
  check('a wild miss scores nothing', r.game.roundPoints[g1] === 0 && r.game.roundPoints[g2] === 0);
  check('and the clue-giver gets nothing either', r.game.roundPoints[giver(r)] === 0);
}

console.log('\n— the rotation —');
{
  const r = makeRoom();
  const seen = [];
  for (let round = 1; round <= 3; round++) {
    seen.push(giver(r));
    act(r, giver(r), { action: 'clue', clue: 'x' });
    for (const id of others(r)) act(r, id, { action: 'lock' });
    const res = act(r, r.hostId, { action: 'next' });
    if (round === 3) check('the last round finishes the game', res.over === true && r.game.phase === 'done');
  }
  check('everybody gave exactly one clue', new Set(seen).size === 3, JSON.stringify(seen));
  check('and they were the three players', seen.sort().join() === 'ana,ben,cara', JSON.stringify(seen));
}
{
  const r = makeRoom();
  act(r, giver(r), { action: 'clue', clue: 'x' });
  check('you cannot skip ahead mid-round', !!act(r, r.hostId, { action: 'next' }).error);
  for (const id of others(r)) act(r, id, { action: 'lock' });
  const outsider = others(r).find((id) => id !== r.hostId && id !== giver(r));
  if (outsider) check('a bystander cannot move the game on', !!act(r, outsider, { action: 'next' }).error);
  else check('a bystander cannot move the game on', true, 'no eligible bystander in a room this size');
  check('the host can', !act(r, r.hostId, { action: 'next' }).error && r.game.round === 2);
}

console.log('\n— who can see the target —');
{
  const r = makeRoom();
  const giverId = giver(r);
  const guesserId = others(r)[0];

  const asGiver = w.view(r, giverId);
  const asGuesser = w.view(r, guesserId);
  check('the clue-giver sees the target', asGiver.game.target === r.game.target);
  check('a guesser does not', asGuesser.game.target === null, String(asGuesser.game.target));
  check('and it is nowhere in what they receive', !JSON.stringify(asGuesser).includes(`"target":${r.game.target}`));

  act(r, giverId, { action: 'clue', clue: 'x' });
  act(r, guesserId, { action: 'guess', value: 40 });
  const otherGuesser = others(r)[1];
  const asOther = w.view(r, otherGuesser);
  check('one guesser cannot see another’s dial', asOther.game.guesses[guesserId] === undefined, JSON.stringify(asOther.game.guesses));
  check('but can see their own', w.view(r, guesserId).game.guesses[guesserId] === 40);

  act(r, guesserId, { action: 'lock' });
  act(r, otherGuesser, { action: 'lock' });
  const afterReveal = w.view(r, otherGuesser);
  check('everything opens up at the reveal', afterReveal.game.target === r.game.target);
  check('including everyone’s dials', afterReveal.game.guesses[guesserId] === 40);
}

console.log('\n— somebody leaving mid-guess —');
{
  const r = makeRoom();
  act(r, giver(r), { action: 'clue', clue: 'x' });
  const [g1, g2] = others(r);
  act(r, g1, { action: 'lock' });
  check('the round is still waiting', r.game.phase === 'guess');
  r.players = r.players.filter((p) => p.id !== g2);          // g2 wanders off
  w.forfeit(r, { id: g2 });
  check('losing the last guesser reveals rather than hanging', r.game.phase === 'reveal', r.game.phase);
}

console.log('\n— the clue-giver disappearing —');
{
  const r = makeRoom();
  const giverPlayer = r.players.find((p) => p.id === giver(r));
  check('the host cannot skip while they are present', !!act(r, r.hostId, { action: 'skip' }).error);

  giverPlayer.connected = false;
  giverPlayer.lastSeen = Date.now();
  check('nor the moment they drop', !!act(r, r.hostId, { action: 'skip' }).error);

  giverPlayer.lastSeen = Date.now() - 91000;      // grace period elapsed
  const other = others(r).find((id) => id !== r.hostId);
  if (other) check('a non-host still cannot skip', !!act(r, other, { action: 'skip' }).error);
  else check('a non-host still cannot skip', true, 'no eligible non-host here');

  const before = r.game.round;
  check('the host can write the round off', !act(r, r.hostId, { action: 'skip' }).error);
  check('and the game moves on', r.game.round === before + 1 && r.game.phase === 'clue', JSON.stringify({ round: r.game.round, phase: r.game.phase }));
  check('nobody scored the skipped round', Object.values(r.game.scores).every((s) => s === 0), JSON.stringify(r.game.scores));
}
{
  const r = makeRoom(['ana', 'ben']);
  // Skipping the very last round should finish the game rather than overrun.
  act(r, giver(r), { action: 'clue', clue: 'x' });
  for (const id of others(r)) act(r, id, { action: 'lock' });
  act(r, r.hostId, { action: 'next' });            // now on round 2 of 2
  const g2 = r.players.find((p) => p.id === giver(r));
  g2.connected = false; g2.lastSeen = Date.now() - 91000;
  const res = act(r, r.hostId, { action: 'skip' });
  check('skipping the final round ends the game', res.over === true && r.game.phase === 'done', r.game.phase);
}

console.log('\n— two players is still a game —');
{
  const r = makeRoom(['ana', 'ben']);
  check('two rounds for two players', r.game.totalRounds === 2);
  act(r, giver(r), { action: 'clue', clue: 'x' });
  const only = others(r)[0];
  act(r, only, { action: 'guess', value: r.game.target });
  act(r, only, { action: 'lock' });
  check('one guesser locking is enough', r.game.phase === 'reveal');
  check('the giver takes that single score', r.game.roundPoints[giver(r)] === 4, String(r.game.roundPoints[giver(r)]));
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
