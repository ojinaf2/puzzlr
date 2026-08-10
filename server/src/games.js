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
     view(room, playerId)     optional, to hide things from other players
*/

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

export const GAMES = { tictactoe, connect4 };
