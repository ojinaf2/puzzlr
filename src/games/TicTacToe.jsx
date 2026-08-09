import { useState, useEffect, useMemo } from 'react';
import { C } from '../shared/theme.js';
import { Btn, Centered } from '../shared/ui.jsx';

/* ============================= TIC-TAC-TOE ============================= */
const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
export default function TicTacToe() {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [xNext, setXNext] = useState(true);
  const [wins, setWins] = useState({ X: 0, O: 0 });

  const winner = useMemo(() => { for (const [a,b,c] of LINES) if (board[a] && board[a] === board[b] && board[a] === board[c]) return { who: board[a], line: [a,b,c] }; return null; }, [board]);
  const full = board.every(Boolean);

  useEffect(() => { if (winner) setWins((w) => ({ ...w, [winner.who]: w[winner.who] + 1 })); }, [winner]);

  const play = (i) => { if (board[i] || winner) return; const nb = [...board]; nb[i] = xNext ? "X" : "O"; setBoard(nb); setXNext(!xNext); };
  const reset = () => { setBoard(Array(9).fill(null)); setXNext(true); };

  return (
    <Centered>
      <div style={{ display: "flex", gap: 20, fontSize: 14, marginBottom: 10 }}>
        <span style={{ color: C.accent, fontWeight: 800 }}>X &nbsp;{wins.X}</span>
        <span style={{ color: C.dim }}>vs</span>
        <span style={{ color: C.danger, fontWeight: 800 }}>O &nbsp;{wins.O}</span>
      </div>
      <div style={{ fontSize: 15, color: C.dim, height: 24, marginBottom: 10 }}>
        {winner ? <b style={{ color: winner.who === "X" ? C.accent : C.danger }}>{winner.who} wins!</b> : full ? "Draw." : <>Turn: <b style={{ color: xNext ? C.accent : C.danger }}>{xNext ? "X" : "O"}</b></>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 92px)", gridTemplateRows: "repeat(3, 92px)", gap: 10 }}>
        {board.map((v, i) => { const hl = winner && winner.line.includes(i);
          const canPlay = !v && !winner;
          return <button key={i} onClick={() => play(i)}
            style={{ background: hl ? (winner.who==="X"?"#e6ddc0":"#f0d3c4") : C.panel, border: `2px solid ${hl ? (winner.who==="X"?C.accent:C.danger) : "transparent"}`, borderRadius: 16, fontSize: 46, fontWeight: 800, color: v === "X" ? C.accent : C.danger, cursor: canPlay ? "pointer" : "default", display: "grid", placeItems: "center", boxShadow: hl ? "0 6px 18px rgba(74,53,36,.22)" : "0 3px 9px rgba(74,53,36,.12)", transition: "transform .1s, box-shadow .15s" }}
            onMouseEnter={(e)=>{ if(canPlay){ e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 8px 18px rgba(74,53,36,.2)"; } }}
            onMouseLeave={(e)=>{ e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow=hl?"0 6px 18px rgba(74,53,36,.22)":"0 3px 9px rgba(74,53,36,.12)"; }}>{v}</button>; })}
      </div>
      <Btn onClick={reset} variant="ghost" style={{ marginTop: 16 }}>{winner || full ? "Play again" : "Reset board"}</Btn>
    </Centered>
  );
}
