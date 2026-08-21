/* ============================= LEADERBOARDS =============================

   What can be ranked, and what counts as a better result.

   Imported by the browser *and* by the Worker, the way the word lists and
   country lists already are. That matters more here than it does for a word
   list: the direction of a board is what stops a Minesweeper client claiming
   a "best" time of nine hours, and the bounds are what stops any client
   posting a score of Infinity. Keeping one copy means the referee and the
   table it draws can never disagree about which end is winning.

   Plain data and pure functions only — no JSX, no browser globals. The
   Worker imports this file directly.

   A GAME WITH SEVERAL VARIANTS GETS SEVERAL BOARDS.
   A nine-by-nine Minesweeper time is not a sixteen-by-thirty time, and a 4x4
   2048 score is not a 6x6 one. Ranking them together would bury everyone
   playing the hard version, so each variant is its own board and the game
   shows a row of chips to switch between them. A game with one variant shows
   no chips at all.

   `dir` is which way is better: "high" for scores and streaks, "low" for
   times. `bounds` is [min, max] of what will be accepted — a sanity check
   rather than a security measure. See the note in server/src/leaderboard.js
   about what these boards can and cannot promise.                         */

export const LEADERBOARDS = {
  wordle: {
    metric: "Longest daily streak",
    unit: "days",
    dir: "high",
    format: "number",
    bounds: [1, 5000],
    variants: [{ key: "daily", label: "Daily" }],
  },

  hangman: {
    metric: "Longest daily streak",
    unit: "days",
    dir: "high",
    format: "number",
    bounds: [1, 5000],
    variants: [{ key: "daily", label: "Daily" }],
  },

  tetris: {
    metric: "Highest score",
    unit: "points",
    dir: "high",
    format: "number",
    /* Solo only. The online mode reports its own score from the browser and
       is refereed only on the seed — see the Tetris note in CLAUDE.md. */
    bounds: [1, 5000000],
    variants: [{ key: "solo", label: "Solo" }],
  },

  2048: {
    metric: "Highest score",
    unit: "points",
    dir: "high",
    format: "number",
    bounds: [1, 20000000],
    variants: [
      { key: "4", label: "4×4" },
      { key: "5", label: "5×5" },
      { key: "6", label: "6×6" },
    ],
  },

  minesweeper: {
    metric: "Fastest clear",
    unit: null,
    dir: "low",
    format: "time",
    variants: [
      /* Easy starts at zero on purpose: a first click really can clear a 9x9
         board outright, and rejecting that would throw away the best time
         anybody can have. The bigger boards cannot be won instantly, so their
         floors are a little above it. */
      { key: "easy", label: "Easy", bounds: [0, 86400] },
      { key: "medium", label: "Medium", bounds: [1, 86400] },
      { key: "hard", label: "Hard", bounds: [2, 86400] },
    ],
  },

  flags: {
    metric: "Longest streak",
    unit: "in a row",
    dir: "high",
    format: "number",
    bounds: [1, 10000],
    variants: [
      { key: "flag2country-easy", label: "Flag → Country · Easy" },
      { key: "flag2country-hard", label: "Flag → Country · Hard" },
      { key: "country2flag-easy", label: "Country → Flag · Easy" },
      { key: "country2flag-hard", label: "Country → Flag · Hard" },
    ],
  },
};

/* Snake has no leaderboard, deliberately — asked for and left out. Anything
   absent from the table above simply has no board, and the tab that would
   show one is not rendered. */
export const boardOf = (gameId) => LEADERBOARDS[gameId] ?? null;

export const hasLeaderboard = (gameId) => !!LEADERBOARDS[gameId];

export const variantOf = (gameId, key) => {
  const board = boardOf(gameId);
  if (!board) return null;
  return board.variants.find((v) => v.key === String(key)) ?? null;
};

/* A variant may narrow the game's bounds; most do not bother. */
export const boundsFor = (gameId, key) => {
  const board = boardOf(gameId);
  if (!board) return null;
  return variantOf(gameId, key)?.bounds ?? board.bounds ?? null;
};

/* The only place that knows which end of a board is winning. */
export const beats = (dir, candidate, current) =>
  dir === "low" ? candidate < current : candidate > current;

export const sortEntries = (dir, entries) =>
  [...entries].sort((a, b) =>
    (dir === "low" ? a.value - b.value : b.value - a.value)
    // Ties go to whoever got there first, which is the only fair tiebreak
    // available without recording more than a number.
    || a.at - b.at);

const mmss = (seconds) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export const formatScore = (format, value) =>
  format === "time" ? mmss(value) : Number(value).toLocaleString();
