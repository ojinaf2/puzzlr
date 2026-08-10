/* ============================= SERVER-SIDE RULES =============================
   Every game the room server understands. The rules live here, not in the
   browser, so an edited client cannot take two turns or claim a win it did
   not earn.

   To add a game, add one entry:
     maxPlayers / minPlayers  seat limits
     autoStart                begin as soon as the room is full (2-player games)
     create()                 empty state for a brand new room
     start(room, prev)        state for a fresh round, carrying the score over
     move(room, player, msg)  validate and apply; return { error } or { over }
     forfeit(room, quitter)   award the game when somebody abandons it
     config(room, msg)        optional, host-only settings between rounds
     timeUp(room)             optional, called when a round clock expires
     view(room, playerId)     optional, to hide things from other players
*/

// Shared with the browser build rather than copied, so the two can never drift.
import { validSet as VALID, answerList as ANSWERS } from '../../src/data/words.js';
import { COUNTRIES } from '../../src/data/countries.js';
import { SPECTRA, scoreForGuess } from '../../src/data/spectra.js';

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const ticTacToeWinner = (board) => {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return { mark: board[a], line };
  }
  return null;
};

// Carry the running tally across rounds, adding any player who joined late.
const carryScores = (room, prev) => {
  const wins = { ...(prev?.wins ?? {}) };
  for (const p of room.players) if (wins[p.id] == null) wins[p.id] = 0;
  return wins;
};

const tictactoe = {
  maxPlayers: 2,
  minPlayers: 2,
  autoStart: true,

  create: () => ({
    board: Array(9).fill(null),
    turnSeat: 0,
    startSeat: 0,
    winner: null,
    line: null,
    draw: false,
    roundNo: 0,
    wins: {},
  }),

  start(room, prev) {
    // Alternate who moves first, so X is not a permanent advantage. Round one
    // always opens with seat 0 — only later rounds swap.
    const startSeat = prev?.roundNo ? (prev.startSeat + 1) % 2 : 0;
    return {
      board: Array(9).fill(null),
      turnSeat: startSeat,
      startSeat,
      winner: null,
      line: null,
      draw: false,
      roundNo: (prev?.roundNo ?? 0) + 1,
      wins: carryScores(room, prev),
    };
  },

  move(room, player, msg) {
    const g = room.game;
    if (g.winner || g.draw) return { error: 'That round is already over.' };
    if (player.seat !== g.turnSeat) return { error: 'Not your turn.' };

    const i = msg.index;
    if (!Number.isInteger(i) || i < 0 || i > 8) return { error: 'That square does not exist.' };
    if (g.board[i]) return { error: 'That square is taken.' };

    g.board[i] = player.seat === 0 ? 'X' : 'O';

    const won = ticTacToeWinner(g.board);
    if (won) {
      g.winner = player.id;
      g.line = won.line;
      g.wins[player.id] = (g.wins[player.id] ?? 0) + 1;
      return { over: true };
    }
    if (g.board.every(Boolean)) {
      g.draw = true;
      return { over: true };
    }
    g.turnSeat = 1 - g.turnSeat;
    return {};
  },

  forfeit(room, quitter) {
    const g = room.game;
    if (g.winner || g.draw) return {};
    const other = room.players.find((p) => p.id !== quitter.id);
    if (!other) return {};
    g.winner = other.id;
    g.forfeitedBy = quitter.id;
    g.wins[other.id] = (g.wins[other.id] ?? 0) + 1;
    return { over: true };
  },
};

/* ------------------------------- connect 4 ------------------------------- */
const C4_COLS = 7, C4_ROWS = 6;
const c4Index = (r, c) => r * C4_COLS + c;

// Every run of four on the grid, worked out once at module load.
const C4_LINES = (() => {
  const lines = [];
  for (let r = 0; r < C4_ROWS; r++) for (let c = 0; c < C4_COLS; c++) {
    if (c + 3 < C4_COLS) lines.push([c4Index(r,c), c4Index(r,c+1), c4Index(r,c+2), c4Index(r,c+3)]);
    if (r + 3 < C4_ROWS) lines.push([c4Index(r,c), c4Index(r+1,c), c4Index(r+2,c), c4Index(r+3,c)]);
    if (r + 3 < C4_ROWS && c + 3 < C4_COLS) lines.push([c4Index(r,c), c4Index(r+1,c+1), c4Index(r+2,c+2), c4Index(r+3,c+3)]);
    if (r + 3 < C4_ROWS && c - 3 >= 0) lines.push([c4Index(r,c), c4Index(r+1,c-1), c4Index(r+2,c-2), c4Index(r+3,c-3)]);
  }
  return lines;
})();

const connectFourWinner = (board) => {
  for (const line of C4_LINES) {
    const [a, b, c, d] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c] && board[a] === board[d]) {
      return { disc: board[a], line };
    }
  }
  return null;
};

const connect4 = {
  maxPlayers: 2,
  minPlayers: 2,
  autoStart: true,

  create: () => ({
    board: Array(C4_ROWS * C4_COLS).fill(null),
    turnSeat: 0,
    startSeat: 0,
    lastMove: null,
    winner: null,
    line: null,
    draw: false,
    roundNo: 0,
    wins: {},
  }),

  start(room, prev) {
    const startSeat = prev?.roundNo ? (prev.startSeat + 1) % 2 : 0;
    return {
      board: Array(C4_ROWS * C4_COLS).fill(null),
      turnSeat: startSeat,
      startSeat,
      lastMove: null,
      winner: null,
      line: null,
      draw: false,
      roundNo: (prev?.roundNo ?? 0) + 1,
      wins: carryScores(room, prev),
    };
  },

  move(room, player, msg) {
    const g = room.game;
    if (g.winner || g.draw) return { error: 'That round is already over.' };
    if (player.seat !== g.turnSeat) return { error: 'Not your turn.' };

    const col = msg.column;
    if (!Number.isInteger(col) || col < 0 || col >= C4_COLS) return { error: 'That column does not exist.' };

    // Gravity: settle in the lowest free slot of the column.
    let landed = -1;
    for (let r = C4_ROWS - 1; r >= 0; r--) {
      const i = c4Index(r, col);
      if (!g.board[i]) { landed = i; break; }
    }
    if (landed < 0) return { error: 'That column is full.' };

    g.board[landed] = player.seat === 0 ? 'R' : 'Y';
    g.lastMove = landed;

    const won = connectFourWinner(g.board);
    if (won) {
      g.winner = player.id;
      g.line = won.line;
      g.wins[player.id] = (g.wins[player.id] ?? 0) + 1;
      return { over: true };
    }
    if (g.board.every(Boolean)) {
      g.draw = true;
      return { over: true };
    }
    g.turnSeat = 1 - g.turnSeat;
    return {};
  },

  forfeit(room, quitter) {
    const g = room.game;
    if (g.winner || g.draw) return {};
    const other = room.players.find((p) => p.id !== quitter.id);
    if (!other) return {};
    g.winner = other.id;
    g.forfeitedBy = quitter.id;
    g.wins[other.id] = (g.wins[other.id] ?? 0) + 1;
    return { over: true };
  },
};

/* --------------------------------- wordle ---------------------------------
   A race: both players get the same word and the first to solve it takes the
   round. Guesses are validated and scored here, and the answer is stripped out
   of what gets sent to players, so it cannot be read out of the network tab. */
const W_COLS = 5, W_ROWS = 6;
export const WORDLE_DURATIONS = [30000, 60000, 120000, 0];   // 0 means no limit

const scoreGuess = (guess, answer) => {
  const res = Array(W_COLS).fill('absent');
  const counts = {};
  for (const ch of answer) counts[ch] = (counts[ch] ?? 0) + 1;
  for (let i = 0; i < W_COLS; i++) if (guess[i] === answer[i]) { res[i] = 'correct'; counts[guess[i]]--; }
  for (let i = 0; i < W_COLS; i++) {
    if (res[i] === 'correct') continue;
    if (counts[guess[i]] > 0) { res[i] = 'present'; counts[guess[i]]--; }
  }
  return res;
};

const freshBoards = (room) =>
  Object.fromEntries(room.players.map((p) => [p.id, { guesses: [], scores: [], solved: false, out: false }]));

const wordle = {
  maxPlayers: 2,
  minPlayers: 2,
  autoStart: false,          // the host picks a round length first

  create: () => ({
    answer: null,
    boards: {},
    durationMs: 60000,
    roundEndsAt: null,
    winner: null,
    timedOut: false,
    roundNo: 0,
    wins: {},
  }),

  start(room, prev) {
    const durationMs = prev?.durationMs ?? 60000;
    return {
      answer: ANSWERS[Math.floor(Math.random() * ANSWERS.length)],
      boards: freshBoards(room),
      durationMs,
      roundEndsAt: durationMs ? Date.now() + durationMs : null,
      winner: null,
      timedOut: false,
      roundNo: (prev?.roundNo ?? 0) + 1,
      wins: carryScores(room, prev),
    };
  },

  // Host-only, and only between rounds.
  config(room, msg) {
    if (room.status === 'playing') return { error: 'Finish the round first.' };
    const ms = msg.durationMs;
    if (!WORDLE_DURATIONS.includes(ms)) return { error: 'Not a round length we offer.' };
    room.game.durationMs = ms;
    return {};
  },

  move(room, player, msg) {
    const g = room.game;
    if (g.winner || g.timedOut) return { error: 'That round is over.' };
    if (g.roundEndsAt && Date.now() > g.roundEndsAt) return { error: 'Time is up.' };

    const board = g.boards[player.id];
    if (!board) return { error: 'You are not playing this round.' };
    if (board.solved || board.out) return { error: 'You are done for this round.' };

    const guess = String(msg.word ?? '').toLowerCase();
    if (guess.length !== W_COLS) return { error: 'Five letters, please.' };
    if (!VALID.has(guess)) return { error: 'Not in word list' };

    board.guesses.push(guess);
    board.scores.push(scoreGuess(guess, g.answer));

    if (guess === g.answer) {
      board.solved = true;
      g.winner = player.id;                        // first to solve takes the round
      g.wins[player.id] = (g.wins[player.id] ?? 0) + 1;
      g.roundEndsAt = null;
      return { over: true };
    }

    if (board.guesses.length >= W_ROWS) board.out = true;

    // Both players having run out of guesses ends the round with nobody scoring.
    if (Object.values(g.boards).every((b) => b.out || b.solved)) {
      g.timedOut = true;
      g.roundEndsAt = null;
      return { over: true };
    }
    return {};
  },

  deadline: (room) => room.game?.roundEndsAt ?? null,

  // Called by the room's alarm when the clock runs out on a round.
  timeUp(room) {
    const g = room.game;
    if (g.winner || g.timedOut) return {};
    g.timedOut = true;
    g.roundEndsAt = null;
    return { over: true };                          // nobody solved it, so nobody scores
  },

  forfeit(room, quitter) {
    const g = room.game;
    if (g.winner || g.timedOut) return {};
    const other = room.players.find((p) => p.id !== quitter.id);
    if (!other) return {};
    g.winner = other.id;
    g.forfeitedBy = quitter.id;
    g.wins[other.id] = (g.wins[other.id] ?? 0) + 1;
    g.roundEndsAt = null;
    return { over: true };
  },

  /* What each player is allowed to see. Opponents' guesses are reduced to their
     colour patterns, so you can watch them closing in without reading their
     words. The answer is withheld until the round is over. */
  view(room, playerId) {
    const g = room.game;
    const boards = {};
    for (const [pid, b] of Object.entries(g.boards ?? {})) {
      boards[pid] = pid === playerId
        ? b
        : { scores: b.scores, guessCount: b.guesses.length, solved: b.solved, out: b.out };
    }
    const revealed = room.status === 'over';
    return { ...room, game: { ...g, boards, answer: revealed ? g.answer : null } };
  },
};

/* ------------------------------- flag quiz -------------------------------
   Everybody answers the same questions in the same order, against one clock
   for the whole quiz. Most correct wins — but only among players who actually
   finished: running out of time is a loss however many you had right. */
export const QUIZ_DURATIONS = [30000, 60000, 120000, 240000];
export const QUIZ_MIN_QUESTIONS = 5, QUIZ_MAX_QUESTIONS = 15;

const pickN = (list, n) => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
};

const buildQuestions = (mode, count) =>
  pickN(COUNTRIES, count).map((answer) => {
    const distractors = pickN(COUNTRIES.filter((c) => c[1] !== answer[1]), 3);
    const options = pickN([answer, ...distractors], 4);
    return {
      // For flag -> country the prompt is the flag; for country -> flag it is
      // the name. Either way the correct code is kept back for checking.
      prompt: mode === 'flag2country' ? answer[1] : answer[0],
      options,
      answerCode: answer[1],
      answerName: answer[0],
    };
  });

const freshProgress = (room) =>
  Object.fromEntries(room.players.map((p) => [p.id, { index: 0, correct: 0, answers: [], finishedAt: null }]));

const flagquiz = {
  maxPlayers: 8,
  minPlayers: 2,
  autoStart: false,

  create: () => ({
    mode: 'flag2country',
    questionCount: 10,
    durationMs: 60000,
    questions: [],
    endsAt: null,
    progress: {},
    roundNo: 0,
    wins: {},
  }),

  start(room, prev) {
    const mode = prev?.mode ?? 'flag2country';
    const questionCount = prev?.questionCount ?? 10;
    const durationMs = prev?.durationMs ?? 60000;
    return {
      mode, questionCount, durationMs,
      questions: buildQuestions(mode, questionCount),
      endsAt: Date.now() + durationMs,
      progress: freshProgress(room),
      roundNo: (prev?.roundNo ?? 0) + 1,
      wins: carryScores(room, prev),
    };
  },

  config(room, msg) {
    if (room.status === 'playing') return { error: 'Finish this quiz first.' };
    const g = room.game;
    if (msg.mode !== undefined) {
      if (!['flag2country', 'country2flag'].includes(msg.mode)) return { error: 'Unknown mode.' };
      g.mode = msg.mode;
    }
    if (msg.questionCount !== undefined) {
      const n = msg.questionCount;
      if (!Number.isInteger(n) || n < QUIZ_MIN_QUESTIONS || n > QUIZ_MAX_QUESTIONS) {
        return { error: `Between ${QUIZ_MIN_QUESTIONS} and ${QUIZ_MAX_QUESTIONS} questions.` };
      }
      g.questionCount = n;
    }
    if (msg.durationMs !== undefined) {
      if (!QUIZ_DURATIONS.includes(msg.durationMs)) return { error: 'Not a time we offer.' };
      g.durationMs = msg.durationMs;
    }
    return {};
  },

  move(room, player, msg) {
    const g = room.game;
    if (Date.now() > g.endsAt) return { error: "Time's up." };

    const mine = g.progress[player.id];
    if (!mine) return { error: 'You are not in this quiz.' };
    if (mine.finishedAt) return { error: 'You have already finished.' };
    if (msg.index !== mine.index) return { error: 'That is not the question you are on.' };

    const q = g.questions[mine.index];
    if (!q) return { error: 'No such question.' };

    const chosen = String(msg.code ?? '');
    if (!q.options.some((o) => o[1] === chosen)) return { error: 'That is not one of the options.' };

    const right = chosen === q.answerCode;
    mine.answers.push({ chosen, correct: right, answerCode: q.answerCode });
    if (right) mine.correct += 1;
    mine.index += 1;

    if (mine.index >= g.questionCount) mine.finishedAt = Date.now();

    // Everyone done early ends the quiz without waiting for the clock.
    if (Object.values(g.progress).every((p) => p.finishedAt)) {
      flagquiz.settle(room);
      return { over: true };
    }
    return {};
  },

  deadline: (room) => room.game?.endsAt ?? null,

  timeUp(room) {
    if (room.status !== 'playing') return {};
    flagquiz.settle(room);
    return { over: true };
  },

  /* Decide the winner. Not finishing is a loss, whatever the score. */
  settle(room) {
    const g = room.game;
    g.endsAt = null;
    const finishers = room.players.filter((p) => g.progress[p.id]?.finishedAt);
    if (finishers.length === 0) { g.winners = []; return; }
    const best = Math.max(...finishers.map((p) => g.progress[p.id].correct));
    g.winners = finishers.filter((p) => g.progress[p.id].correct === best).map((p) => p.id);
    for (const id of g.winners) g.wins[id] = (g.wins[id] ?? 0) + 1;
  },

  forfeit() { return {}; },   // a quiz carries on regardless of who wanders off

  view(room, playerId) {
    const g = room.game;
    const over = room.status === 'over';
    const mine = g.progress?.[playerId];

    // Only the question in front of you, and never the stored answer.
    const questions = over
      ? g.questions.map(({ prompt, options, answerCode, answerName }) => ({ prompt, options, answerCode, answerName }))
      : (g.questions ?? []).map((q, i) => (mine && i === mine.index ? { prompt: q.prompt, options: q.options } : null));

    // Everyone can see how far along the others are — it is a race, after all.
    const progress = Object.fromEntries(Object.entries(g.progress ?? {}).map(([pid, p]) => [
      pid,
      pid === playerId ? p : { index: p.index, correct: p.correct, finishedAt: p.finishedAt },
    ]));

    return { ...room, game: { ...g, questions, progress } };
  },
};

/* ------------------------------- wavelength -------------------------------
   Players take it in turns to give a clue. The clue-giver alone sees where the
   target sits; everyone else slides their own dial to guess. Each guesser
   scores on how close they land, and the clue-giver takes all of their points
   added together — so a clue that works for the whole room is worth the most.
   Everybody gives exactly one clue, so a room of seven plays seven rounds. */
const WL_MIN_TARGET = 8, WL_TARGET_SPREAD = 85;

const wavelengthRound = (order, round) => ({
  spectrum: SPECTRA[Math.floor(Math.random() * SPECTRA.length)],
  target: WL_MIN_TARGET + Math.floor(Math.random() * WL_TARGET_SPREAD),
  giverId: order[(round - 1) % order.length],
  clue: null,
  guesses: {},
  locked: {},
  roundPoints: {},
});

const wavelength = {
  maxPlayers: 7,
  minPlayers: 2,
  autoStart: false,

  create: () => ({
    phase: 'clue',              // clue | guess | reveal | done
    round: 0,
    totalRounds: 0,
    order: [],
    spectrum: SPECTRA[0],
    target: 50,
    giverId: null,
    clue: null,
    guesses: {},
    locked: {},
    roundPoints: {},
    scores: {},
    roundNo: 0,
  }),

  start(room) {
    // Everyone gives exactly one clue, in the order they joined.
    const order = room.players.map((p) => p.id);
    return {
      ...wavelengthRound(order, 1),
      phase: 'clue',
      round: 1,
      totalRounds: order.length,
      order,
      scores: Object.fromEntries(order.map((id) => [id, 0])),
      roundNo: 1,
    };
  },

  deadline: () => null,        // played at the group's own pace

  move(room, player, msg) {
    const g = room.game;

    if (msg.action === 'clue') {
      if (g.phase !== 'clue') return { error: 'Not the moment for a clue.' };
      if (player.id !== g.giverId) return { error: 'Someone else is giving the clue.' };
      const clue = String(msg.clue ?? '').trim().slice(0, 40);
      if (!clue) return { error: 'Give them something to go on.' };
      g.clue = clue;
      g.phase = 'guess';
      return {};
    }

    if (msg.action === 'guess') {
      if (g.phase !== 'guess') return { error: 'Not the moment for guessing.' };
      if (player.id === g.giverId) return { error: 'You gave the clue.' };
      if (g.locked[player.id]) return { error: 'You have locked yours in.' };
      const value = Number(msg.value);
      if (!Number.isFinite(value) || value < 0 || value > 100) return { error: 'Off the dial.' };
      g.guesses[player.id] = Math.round(value);
      return {};
    }

    if (msg.action === 'lock') {
      if (g.phase !== 'guess') return { error: 'Not the moment for guessing.' };
      if (player.id === g.giverId) return { error: 'You gave the clue.' };
      if (g.guesses[player.id] === undefined) g.guesses[player.id] = 50;
      g.locked[player.id] = true;

      const guessers = room.players.filter((p) => p.id !== g.giverId);
      if (guessers.every((p) => g.locked[p.id])) wavelength.reveal(room);
      return {};
    }

    /* If the clue-giver has vanished, nobody can give the clue and the room
       would sit there forever. Once their grace period is up the host may
       write the round off and move on; nobody scores it. */
    if (msg.action === 'skip') {
      if (room.hostId !== player.id) return { error: 'Only the host can skip a round.' };
      if (g.phase === 'reveal' || g.phase === 'done') return { error: 'Nothing to skip.' };
      const giverPlayer = room.players.find((p) => p.id === g.giverId);
      const gone = !giverPlayer || (!giverPlayer.connected && Date.now() - giverPlayer.lastSeen > 90000);
      if (!gone) return { error: 'They are still here.' };
      if (g.round >= g.totalRounds) { g.phase = 'done'; return { over: true }; }
      const next = g.round + 1;
      Object.assign(g, wavelengthRound(g.order, next), { phase: 'clue', round: next });
      return {};
    }

    if (msg.action === 'next') {
      if (g.phase !== 'reveal') return { error: 'The round is not finished.' };
      if (room.hostId !== player.id && g.giverId !== player.id) {
        return { error: 'The host moves the game on.' };
      }
      if (g.round >= g.totalRounds) { g.phase = 'done'; return { over: true }; }
      const next = g.round + 1;
      Object.assign(g, wavelengthRound(g.order, next), { phase: 'clue', round: next });
      return {};
    }

    return { error: 'Unknown move.' };
  },

  /* Work out the round: each guesser scores on distance, the clue-giver takes
     the lot added together. */
  reveal(room) {
    const g = room.game;
    const points = {};
    let total = 0;
    for (const p of room.players) {
      if (p.id === g.giverId) continue;
      const guess = g.guesses[p.id];
      const pts = guess === undefined ? 0 : scoreForGuess(guess, g.target);
      points[p.id] = pts;
      total += pts;
      g.scores[p.id] = (g.scores[p.id] ?? 0) + pts;
    }
    points[g.giverId] = total;
    g.scores[g.giverId] = (g.scores[g.giverId] ?? 0) + total;
    g.roundPoints = points;
    g.phase = 'reveal';
  },

  // Somebody wandering off should not freeze the round for everyone else.
  forfeit(room, quitter) {
    const g = room.game;
    if (g.phase === 'guess' && quitter.id !== g.giverId) {
      const guessers = room.players.filter((p) => p.id !== g.giverId && p.id !== quitter.id);
      if (guessers.length && guessers.every((p) => g.locked[p.id])) wavelength.reveal(room);
    }
    return {};
  },

  view(room, playerId) {
    const g = room.game;
    const revealed = g.phase === 'reveal' || g.phase === 'done';
    const isGiver = playerId === g.giverId;

    // Only the clue-giver may see the target before the reveal.
    const target = revealed || isGiver ? g.target : null;

    // Nobody sees another player's dial until everything is turned over,
    // otherwise the last to lock in could simply copy.
    const guesses = revealed
      ? g.guesses
      : (g.guesses[playerId] !== undefined ? { [playerId]: g.guesses[playerId] } : {});

    return { ...room, game: { ...g, target, guesses } };
  },
};

export const GAMES = { tictactoe, connect4, wordle, flagquiz, wavelength };
