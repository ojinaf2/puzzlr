import { useState, useEffect, useMemo } from 'react';
import { C } from '../shared/theme.js';
import { Btn, Centered } from '../shared/ui.jsx';

/* ============================= CONNECT 4 =============================
   Pass-and-play for 2. Drawn as a single SVG so it reads like the real
   toy: a blue board with circular holes punched through it, and the red
   and yellow discs sitting *behind* the board showing through the holes. */
const COLS = 7, ROWS = 6;
const CELL = 64, PAD = 10, HOLE = 25, DISC = 26;
const GHOST = 64;                            // headroom above the board for the hovering disc
const BOARD_W = COLS * CELL + PAD * 2;
const BOARD_H = ROWS * CELL + PAD * 2;
const VIEW_H = GHOST + BOARD_H;

const RED = "#d62828", YELLOW = "#f6c31c";
const BOARD = "#1b64d4", BOARD_EDGE = "#1450ab";
const colourOf = (v) => (v === "R" ? RED : YELLOW);

const idx = (r, c) => r * COLS + c;
const cx = (c) => PAD + c * CELL + CELL / 2;
const cy = (r) => GHOST + PAD + r * CELL + CELL / 2;

// Every run of four, precomputed once: horizontal, vertical and both diagonals.
const WIN_LINES = (() => {
  const lines = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (c + 3 < COLS) lines.push([idx(r,c), idx(r,c+1), idx(r,c+2), idx(r,c+3)]);
    if (r + 3 < ROWS) lines.push([idx(r,c), idx(r+1,c), idx(r+2,c), idx(r+3,c)]);
    if (r + 3 < ROWS && c + 3 < COLS) lines.push([idx(r,c), idx(r+1,c+1), idx(r+2,c+2), idx(r+3,c+3)]);
    if (r + 3 < ROWS && c - 3 >= 0) lines.push([idx(r,c), idx(r+1,c-1), idx(r+2,c-2), idx(r+3,c-3)]);
  }
  return lines;
})();

export default function ConnectFour() {
  const [board, setBoard] = useState(() => Array(ROWS * COLS).fill(null));
  const [redNext, setRedNext] = useState(true);
  const [wins, setWins] = useState({ R: 0, Y: 0 });
  const [lastMove, setLastMove] = useState(null);
  const [hoverCol, setHoverCol] = useState(null);

  const winner = useMemo(() => {
    for (const line of WIN_LINES) {
      const [a, b, c, d] = line;
      if (board[a] && board[a] === board[b] && board[a] === board[c] && board[a] === board[d]) return { who: board[a], line };
    }
    return null;
  }, [board]);
  const full = board.every(Boolean);

  useEffect(() => { if (winner) setWins((w) => ({ ...w, [winner.who]: w[winner.who] + 1 })); }, [winner]);

  const drop = (col) => {
    if (winner) return;
    for (let r = ROWS - 1; r >= 0; r--) {          // fall to the lowest free slot
      const i = idx(r, col);
      if (!board[i]) {
        const nb = [...board]; nb[i] = redNext ? "R" : "Y";
        setBoard(nb); setRedNext(!redNext); setLastMove(i);
        return;
      }
    }
  };
  const reset = () => { setBoard(Array(ROWS * COLS).fill(null)); setRedNext(true); setLastMove(null); };

  const colFull = (c) => !!board[idx(0, c)];
  const turnColour = redNext ? RED : YELLOW;

  return (
    <Centered>
      <style>{`
        @keyframes c4drop { from { transform: translateY(var(--c4-drop)); } to { transform: translateY(0); } }
        .c4-drop { animation: c4drop .4s cubic-bezier(.34,.02,.5,1); }
        @keyframes c4pulse { 0%,100% { opacity: .95 } 50% { opacity: .25 } }
        .c4-win { animation: c4pulse 1.1s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .c4-drop, .c4-win { animation: none !important; } }
      `}</style>

      <div style={{ display: "flex", gap: 20, fontSize: 14, marginBottom: 10, alignItems: "center" }}>
        <span style={{ color: RED, fontWeight: 800 }}>Red &nbsp;{wins.R}</span>
        <span style={{ color: C.dim }}>vs</span>
        <span style={{ color: "#b58900", fontWeight: 800 }}>Yellow &nbsp;{wins.Y}</span>
      </div>
      <div style={{ fontSize: 15, color: C.dim, height: 24, marginBottom: 10 }}>
        {winner
          ? <b style={{ color: winner.who === "R" ? RED : "#b58900" }}>{winner.who === "R" ? "Red" : "Yellow"} wins!</b>
          : full ? "Draw." : <>Turn: <b style={{ color: redNext ? RED : "#b58900" }}>{redNext ? "Red" : "Yellow"}</b></>}
      </div>

      <svg viewBox={`0 0 ${BOARD_W} ${VIEW_H}`} style={{ width: "100%", maxWidth: BOARD_W, height: "auto", touchAction: "manipulation" }}>
        <defs>
          {/* Punch the grid of holes out of the board face. */}
          <mask id="c4-holes">
            <rect x="0" y={GHOST} width={BOARD_W} height={BOARD_H} rx="18" fill="#fff" />
            {board.map((_, i) => <circle key={i} cx={cx(i % COLS)} cy={cy(Math.floor(i / COLS))} r={HOLE} fill="#000" />)}
          </mask>
          <radialGradient id="c4-gloss" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#fff" stopOpacity=".45" />
            <stop offset="55%" stopColor="#fff" stopOpacity=".05" />
            <stop offset="100%" stopColor="#000" stopOpacity=".22" />
          </radialGradient>
        </defs>

        {/* 1. Empty sockets, so unfilled holes read as recessed rather than as bare page. */}
        {board.map((_, i) => <circle key={`s${i}`} cx={cx(i % COLS)} cy={cy(Math.floor(i / COLS))} r={HOLE} fill="#efe7db" />)}

        {/* 2. The discs themselves, drawn slightly wider than the hole so the board hides their rim. */}
        {board.map((v, i) => {
          if (!v) return null;
          const r = Math.floor(i / COLS), c = i % COLS;
          const isNew = i === lastMove;
          return (
            <g key={`d${i}`} className={isNew ? "c4-drop" : ""} style={isNew ? { "--c4-drop": `${-(cy(r) + DISC)}px` } : undefined}>
              <circle cx={cx(c)} cy={cy(r)} r={DISC} fill={colourOf(v)} />
              <circle cx={cx(c)} cy={cy(r)} r={DISC} fill="url(#c4-gloss)" />
            </g>
          );
        })}

        {/* 3. The blue face, with the holes masked away. */}
        <g mask="url(#c4-holes)">
          <rect x="0" y={GHOST} width={BOARD_W} height={BOARD_H} rx="18" fill={BOARD} />
          <rect x="0" y={GHOST} width={BOARD_W} height="14" fill="#3f83e8" opacity=".55" />
          <rect x="0" y={GHOST + BOARD_H - 16} width={BOARD_W} height="16" fill={BOARD_EDGE} opacity=".8" />
        </g>

        {/* 4. Bevel inside each hole for a little depth. */}
        {board.map((_, i) => (
          <circle key={`r${i}`} cx={cx(i % COLS)} cy={cy(Math.floor(i / COLS))} r={HOLE}
            fill="none" stroke="rgba(0,0,0,.18)" strokeWidth="2" />
        ))}

        {/* 5. Ring the winning four. */}
        {winner && winner.line.map((i) => (
          <circle key={`w${i}`} className="c4-win" cx={cx(i % COLS)} cy={cy(Math.floor(i / COLS))} r={HOLE - 5}
            fill="none" stroke="#fff" strokeWidth="4" />
        ))}

        {/* 6. Hover preview + full-column click targets. */}
        {hoverCol !== null && !winner && !colFull(hoverCol) && (
          <circle cx={cx(hoverCol)} cy={GHOST / 2} r={DISC} fill={turnColour} opacity=".55" />
        )}
        {Array.from({ length: COLS }).map((_, c) => {
          const disabled = !!winner || colFull(c);
          return (
            <rect key={`h${c}`} x={PAD + c * CELL} y="0" width={CELL} height={VIEW_H}
              fill="transparent" style={{ cursor: disabled ? "default" : "pointer" }}
              role="button" tabIndex={disabled ? -1 : 0}
              aria-label={`Drop in column ${c + 1}`}
              onMouseEnter={() => setHoverCol(c)} onMouseLeave={() => setHoverCol(null)}
              onClick={() => drop(c)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); drop(c); } }} />
          );
        })}
      </svg>

      <Btn onClick={reset} variant="ghost" style={{ marginTop: 16 }}>{winner || full ? "Play again" : "Reset board"}</Btn>
    </Centered>
  );
}
