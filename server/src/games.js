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
    wins: {},
  }),

  start(room, prev) {
    // Alternate who moves first, so X is not a permanent advantage.
    const startSeat = prev ? (prev.startSeat + 1) % 2 : 0;
    return {
      board: Array(9).fill(null),
      turnSeat: startSeat,
      startSeat,
      winner: null,
      line: null,
      draw: false,
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
    wins: {},
  }),

  start(room, prev) {
    const startSeat = prev ? (prev.startSeat + 1) % 2 : 0;
    return {
      board: Array(C4_ROWS * C4_COLS).fill(null),
      turnSeat: startSeat,
      startSeat,
      lastMove: null,
      winner: null,
      line: null,
      draw: false,
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

export const GAMES = { tictactoe, connect4, wordle };
