import { useState, useEffect, useMemo } from 'react';
import { C } from '../shared/theme.js';
import { Btn, Centered, hStyle, pStyle } from '../shared/ui.jsx';
import { makeRoomCode } from '../shared/router.js';
import { RoomStatus, lobbyView } from '../shared/online.jsx';
import { useRoom, savedName, roomServerUrl } from '../shared/useRoom.js';

/* ============================= TIC-TAC-TOE =============================
   Pass-and-play on one device, or online with an invite link. The online mode
   keeps no rules of its own: the server decides every move, and this file only
   draws whatever snapshot comes back. */
const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

/* The board, shared by both modes. `mark` is X or O, `disabled` blocks input. */
function Board({ board, winLine, winnerMark, onPlay, disabled }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 92px)", gridTemplateRows: "repeat(3, 92px)", gap: 10 }}>
      {board.map((v, i) => {
        const hl = winLine && winLine.includes(i);
        const canPlay = !v && !disabled;
        return (
          <button key={i} onClick={() => canPlay && onPlay(i)}
            style={{ background: hl ? (winnerMark === "X" ? "#e6ddc0" : "#f0d3c4") : C.panel, border: `2px solid ${hl ? (winnerMark === "X" ? C.accent : C.danger) : "transparent"}`, borderRadius: 16, fontSize: 46, fontWeight: 800, color: v === "X" ? C.accent : C.danger, cursor: canPlay ? "pointer" : "default", display: "grid", placeItems: "center", boxShadow: hl ? "0 6px 18px rgba(74,53,36,.22)" : "0 3px 9px rgba(74,53,36,.12)", transition: "transform .1s, box-shadow .15s" }}
            onMouseEnter={(e) => { if (canPlay) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 18px rgba(74,53,36,.2)"; } }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = hl ? "0 6px 18px rgba(74,53,36,.22)" : "0 3px 9px rgba(74,53,36,.12)"; }}>
            {v}
          </button>
        );
      })}
    </div>
  );
}

export default function TicTacToe({ roomCode, navigate }) {
  if (roomCode) return <OnlineTicTacToe roomCode={roomCode} navigate={navigate} />;
  return <LocalTicTacToe navigate={navigate} />;
}

/* ------------------------------ same device ------------------------------ */
function LocalTicTacToe({ navigate }) {
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
      <Board board={board} winLine={winner?.line} winnerMark={winner?.who} onPlay={play} disabled={!!winner} />
      <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap", justifyContent: "center" }}>
        <Btn onClick={reset} variant="ghost">{winner || full ? "Play again" : "Reset board"}</Btn>
        {/* Hidden until a room server is configured, so nobody is sent to a dead end. */}
        {roomServerUrl() && (
          <Btn variant="subtle" onClick={() => navigate('tictactoe', makeRoomCode())}>Play online instead</Btn>
        )}
      </div>
    </Centered>
  );
}

/* -------------------------------- online -------------------------------- */
function OnlineTicTacToe({ roomCode, navigate }) {
  const [name, setName] = useState(() => savedName());
  const { status, room, me, playerId, error, send } = useRoom({ gameId: 'tictactoe', roomCode, name });

  // Every hook has run by now, so it is safe to bail out into a waiting screen.
  const lobby = lobbyView({ status, room, me, roomCode, gameId: 'tictactoe', navigate, name, onName: setName });
  if (lobby) return lobby;

  const g = room.game;
  const opponent = room.players.find((p) => p.id !== playerId);
  const myMark = me.seat === 0 ? 'X' : 'O';
  const myTurn = room.status === 'playing' && g.turnSeat === me.seat;
  const over = room.status === 'over';

  const winnerPlayer = g.winner && room.players.find((p) => p.id === g.winner);
  const winnerMark = winnerPlayer ? (winnerPlayer.seat === 0 ? 'X' : 'O') : null;

  const stale = opponent && !opponent.connected && Date.now() - opponent.lastSeen > 90000;

  return (
    <Centered>
      <RoomStatus status={status} error={error} />

      <div style={{ display: "flex", gap: 20, fontSize: 14, marginBottom: 10, flexWrap: "wrap", justifyContent: "center" }}>
        <span style={{ color: C.accent, fontWeight: 800 }}>
          {me.seat === 0 ? me.name : opponent?.name ?? '—'} (X) &nbsp;{g.wins[room.players.find((p) => p.seat === 0)?.id] ?? 0}
        </span>
        <span style={{ color: C.dim }}>vs</span>
        <span style={{ color: C.danger, fontWeight: 800 }}>
          {me.seat === 1 ? me.name : opponent?.name ?? '—'} (O) &nbsp;{g.wins[room.players.find((p) => p.seat === 1)?.id] ?? 0}
        </span>
      </div>

      <div style={{ fontSize: 15, color: C.dim, height: 24, marginBottom: 10 }}>
        {over && g.forfeitedBy ? <b style={{ color: C.accent }}>{opponent?.name} left — you win</b>
          : over && g.winner ? <b style={{ color: g.winner === playerId ? C.correct : C.danger }}>{g.winner === playerId ? 'You win!' : `${opponent?.name ?? 'They'} win${g.winner === playerId ? '' : 's'}!`}</b>
          : over && g.draw ? "Draw."
          : myTurn ? <b style={{ color: C.accent }}>Your turn ({myMark})</b>
          : <>Waiting for {opponent?.name ?? 'them'}…</>}
      </div>

      {opponent && !opponent.connected && !over && (
        <div style={{ background: C.panel2, borderRadius: 12, padding: "10px 16px", marginBottom: 12, fontSize: 13.5, color: C.text, textAlign: "center", maxWidth: 380 }}>
          {opponent.name} lost connection. Their seat is held while they reconnect.
          {stale && <div style={{ marginTop: 8 }}><Btn variant="ghost" style={{ padding: "7px 16px", fontSize: 13 }} onClick={() => send({ type: 'claim' })}>Claim the win</Btn></div>}
        </div>
      )}

      <Board board={g.board} winLine={g.line} winnerMark={winnerMark}
        onPlay={(i) => send({ type: 'move', index: i })}
        disabled={!myTurn || over} />

      <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap", justifyContent: "center" }}>
        {over && <Btn onClick={() => send({ type: 'rematch' })}>Play again</Btn>}
        <Btn variant="subtle" onClick={() => navigate('tictactoe')}>Leave room</Btn>
      </div>
    </Centered>
  );
}
