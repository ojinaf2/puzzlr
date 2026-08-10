import { useState, useEffect, useCallback, useRef } from 'react';
import { C } from '../shared/theme.js';
import { rand } from '../shared/utils.js';
import { Btn, Centered, hStyle, pStyle } from '../shared/ui.jsx';
import { validSet, answerList } from '../data/words.js';
import { makeRoomCode } from '../shared/router.js';
import { RoomStatus, lobbyView, InviteLink } from '../shared/online.jsx';
import { useRoom, savedName, roomServerUrl } from '../shared/useRoom.js';

/* ============================= WORDLE ============================= */
const W_ROWS = 6, W_COLS = 5;
const scoreGuess = (guess, answer) => {
  const res = Array(W_COLS).fill("absent");
  const a = answer.split(""); const counts = {};
  for (const c of a) counts[c] = (counts[c] || 0) + 1;
  for (let i = 0; i < W_COLS; i++) if (guess[i] === a[i]) { res[i] = "correct"; counts[guess[i]]--; }
  for (let i = 0; i < W_COLS; i++) { if (res[i] === "correct") continue; if (counts[guess[i]] > 0) { res[i] = "present"; counts[guess[i]]--; } }
  return res;
};
const KEYS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

export default function Wordle({ roomCode, navigate }) {
  if (roomCode) return <OnlineWordle roomCode={roomCode} navigate={navigate} />;
  return <LocalWordle navigate={navigate} />;
}

function LocalWordle({ navigate }) {
  const [answer, setAnswer] = useState(() => answerList[rand(answerList.length)]);
  const [guesses, setGuesses] = useState([]);
  const [scores, setScores] = useState([]);
  const [current, setCurrent] = useState("");
  const [status, setStatus] = useState("playing");
  const [toast, setToast] = useState("");
  const [shake, setShake] = useState(false);
  const [revealRow, setRevealRow] = useState(-1);
  const tt = useRef(null);
  const bridgeRef = useRef(null);
  const openPhoneKeyboard = () => bridgeRef.current?.focus();

  const showToast = useCallback((m) => { setToast(m); clearTimeout(tt.current); tt.current = setTimeout(() => setToast(""), 1500); }, []);
  const reset = useCallback(() => { setAnswer(answerList[rand(answerList.length)]); setGuesses([]); setScores([]); setCurrent(""); setStatus("playing"); setRevealRow(-1); }, []);

  const submit = useCallback(() => {
    if (status !== "playing") return;
    if (current.length !== W_COLS) { setShake(true); setTimeout(() => setShake(false), 500); showToast("Not enough letters"); return; }
    if (!validSet.has(current)) { setShake(true); setTimeout(() => setShake(false), 500); showToast("Not in word list"); return; }
    const sc = scoreGuess(current, answer);
    const ng = [...guesses, current], ns = [...scores, sc];
    setGuesses(ng); setScores(ns); setRevealRow(ng.length - 1); setCurrent("");
    if (current === answer) { setStatus("won"); setTimeout(() => showToast(["Genius","Magnificent","Impressive","Splendid","Great","Phew"][ng.length - 1]), 1500); }
    else if (ng.length === W_ROWS) { setStatus("lost"); setTimeout(() => showToast(answer.toUpperCase()), 1500); }
  }, [current, answer, guesses, scores, status, showToast]);

  const onKey = useCallback((k) => {
    if (status !== "playing") return;
    if (k === "enter") submit();
    else if (k === "back") setCurrent((c) => c.slice(0, -1));
    else if (/^[a-z]$/.test(k) && current.length < W_COLS) setCurrent((c) => c + k);
  }, [current, status, submit]);

  useEffect(() => {
    const h = (e) => {
      // Ignore keys typed into a field — otherwise the phone keyboard bridge
      // and this listener would both add the same letter.
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "enter") { e.preventDefault(); onKey("enter"); } else if (k === "backspace") onKey("back"); else if (/^[a-z]$/.test(k)) onKey(k);
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [onKey]);

  const keyState = {};
  guesses.forEach((g, gi) => g.split("").forEach((c, i) => { const s = scores[gi][i], p = keyState[c];
    if (s === "correct" || (s === "present" && p !== "correct") || (s === "absent" && !p)) keyState[c] = s; }));

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
      <TypingBridge inputRef={bridgeRef} value={current} onValue={setCurrent} onEnter={submit} />
      <div style={{ height: 22, marginBottom: 6, fontSize: 13 }}>{toast && <span style={{ background: C.panel2, padding: "4px 12px", borderRadius: 6 }}>{toast}</span>}</div>
      {/* Tapping the grid opens the phone's own keyboard. */}
      <div onClick={openPhoneKeyboard} style={{ display: "grid", gridTemplateRows: `repeat(${W_ROWS}, 1fr)`, gap: 6, marginBottom: 14, cursor: "text" }}>
        {Array.from({ length: W_ROWS }).map((_, r) => {
          const g = guesses[r] ?? (r === guesses.length ? current : ""); const sc = scores[r];
          const isShake = shake && r === guesses.length; const isWin = status === "won" && r === guesses.length - 1;
          return (
            <div key={r} className={isShake ? "row-shake" : isWin ? "win-bounce" : ""} style={{ display: "grid", gridTemplateColumns: `repeat(${W_COLS}, 1fr)`, gap: 6 }}>
              {Array.from({ length: W_COLS }).map((_, c) => {
                const ch = g[c] || ""; const revealed = sc && revealRow >= r; const st = revealed ? sc[c] : null;
                const bg = st === "correct" ? C.correct : st === "present" ? C.present : st === "absent" ? C.absent : "transparent";
                const bd = st ? bg : ch ? "#9c7a54" : C.line;
                const txt = st ? "#fff" : C.text;
                return <div key={c} className={revealed ? "tile-flip" : ch && !sc ? "tile-fill" : ""} style={{ width: 56, height: 56, display: "grid", placeItems: "center", background: bg, border: `2px solid ${bd}`, borderRadius: 9, fontSize: 27, fontWeight: 800, textTransform: "uppercase", color: txt, animationDelay: revealed ? `${c * 0.18}s` : "0s" }}>{ch}</div>;
              })}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", justifyContent: "center" }}>
        {status !== "playing" && <Btn onClick={reset}>{status === "won" ? "Next word" : "Try another"}</Btn>}
        {roomServerUrl() && (
          <Btn variant="subtle" onClick={() => navigate('wordle', makeRoomCode())}>Race a friend online</Btn>
        )}
      </div>
      <Keyboard onKey={onKey} keyState={keyState} />
      <button onClick={openPhoneKeyboard}
        style={{ marginTop: 12, background: "none", border: "none", color: C.dim, fontSize: 13, fontFamily: "inherit", cursor: "pointer", textDecoration: "underline" }}>
        Use my phone's keyboard instead
      </button>
    </div>
  );
}
function KbKey({ children, onClick, wide, bg = "#e0be93", kc = C.text }) {
  return <button onClick={onClick} style={{ minWidth: wide ? 54 : 30, height: 58, background: bg, color: kc, border: "none", borderRadius: 9, fontSize: wide ? 12 : 16, fontWeight: 700, textTransform: "uppercase", cursor: "pointer", flex: wide ? "0 0 auto" : "1 1 0", maxWidth: 48, boxShadow: "0 2px 5px rgba(74,53,36,.18)", transition: "transform .08s", touchAction: "manipulation", userSelect: "none", WebkitTapHighlightColor: "transparent" }}
    onMouseDown={(e)=>e.currentTarget.style.transform="translateY(1px)"} onMouseUp={(e)=>e.currentTarget.style.transform="none"} onMouseLeave={(e)=>e.currentTarget.style.transform="none"}>{children}</button>;
}

/* The on-screen keyboard. It reclaims the page's side padding so the keys get
   as much width as the screen allows — on a phone that is the difference
   between comfortable keys and constant mis-taps. */
function Keyboard({ onKey, keyState }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "calc(100% + 28px)",
      marginLeft: -14, marginRight: -14, maxWidth: 520, alignSelf: "center" }}>
      {KEYS.map((row, ri) => (
        <div key={ri} style={{ display: "flex", justifyContent: "center", gap: 6 }}>
          {ri === 2 && <KbKey wide onClick={() => onKey("enter")}>Enter</KbKey>}
          {row.split("").map((k) => {
            const st = keyState[k];
            const bg = st === "correct" ? C.correct : st === "present" ? C.present : st === "absent" ? C.absent : "#e0be93";
            return <KbKey key={k} onClick={() => onKey(k)} bg={bg} kc={st ? "#fff" : C.text}>{k}</KbKey>;
          })}
          {ri === 2 && <KbKey wide onClick={() => onKey("back")}>Del</KbKey>}
        </div>
      ))}
    </div>
  );
}

/* Lets the phone's own keyboard drive the game. The input is invisible but
   real and focusable, which is what makes iOS open the keyboard at all — a
   display:none field would be ignored. */
function TypingBridge({ inputRef, value, onValue, onEnter }) {
  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => onValue(e.target.value.replace(/[^a-zA-Z]/g, "").slice(0, W_COLS).toLowerCase())}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onEnter(); } }}
      inputMode="text" autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck="false"
      aria-label="Type your guess"
      style={{ position: "absolute", opacity: 0, pointerEvents: "none", height: 1, width: 1, padding: 0, border: 0 }}
    />
  );
}

/* ============================= ONLINE RACE =============================
   Same word, both players, first to solve takes the round. The opponent's grid
   shows only the colours of their guesses: enough to feel them closing in,
   never enough to read their words. */

const DURATION_LABELS = [
  [30000, '30 sec'], [60000, '1 min'], [120000, '2 min'], [0, 'No limit'],
];

/* Tiles for one player. `letters` is empty for an opponent's grid. */
function Grid({ rows, size, hideLetters }) {
  return (
    <div style={{ display: "grid", gridTemplateRows: `repeat(${W_ROWS}, 1fr)`, gap: size > 30 ? 6 : 4 }}>
      {Array.from({ length: W_ROWS }).map((_, r) => (
        <div key={r} style={{ display: "grid", gridTemplateColumns: `repeat(${W_COLS}, 1fr)`, gap: size > 30 ? 6 : 4 }}>
          {Array.from({ length: W_COLS }).map((_, c) => {
            const row = rows[r];
            const st = row?.scores?.[c] ?? null;
            const ch = hideLetters ? "" : (row?.letters?.[c] ?? "");
            const bg = st === "correct" ? C.correct : st === "present" ? C.present : st === "absent" ? C.absent : "transparent";
            const bd = st ? bg : ch ? "#9c7a54" : C.line;
            return (
              <div key={c} style={{ width: size, height: size, display: "grid", placeItems: "center", background: bg,
                border: `2px solid ${bd}`, borderRadius: size > 30 ? 9 : 5, fontSize: size * 0.48, fontWeight: 800,
                textTransform: "uppercase", color: st ? "#fff" : C.text }}>
                {ch}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Countdown({ endsAt }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!endsAt) return;
    const t = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, [endsAt]);
  if (!endsAt) return <span style={{ color: C.dim }}>No time limit</span>;
  const left = Math.max(0, endsAt - Date.now());
  const secs = Math.ceil(left / 1000);
  const low = secs <= 10;
  return (
    <span style={{ fontWeight: 800, color: low ? C.danger : C.text, fontVariantNumeric: "tabular-nums" }}>
      {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
    </span>
  );
}

function OnlineWordle({ roomCode, navigate }) {
  const [name, setName] = useState(() => savedName());
  const { status, room, me, playerId, error, send } = useRoom({ gameId: 'wordle', roomCode, name });
  const [current, setCurrent] = useState("");
  const [toast, setToast] = useState("");
  const [shake, setShake] = useState(false);
  const bridgeRef = useRef(null);
  const openPhoneKeyboard = () => bridgeRef.current?.focus();

  // The server is the judge of a guess, so its complaints become the toast.
  useEffect(() => {
    if (!error) return;
    setToast(error);
    setShake(true);
    const a = setTimeout(() => setShake(false), 500);
    const b = setTimeout(() => setToast(""), 1600);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [error]);

  const playing = room?.status === 'playing';
  const myBoard = room?.game?.boards?.[playerId];
  const iAmDone = !!(myBoard?.solved || myBoard?.out);

  const onKey = useCallback((k) => {
    if (!playing || iAmDone) return;
    if (k === 'enter') {
      if (current.length !== W_COLS) { setToast('Not enough letters'); setShake(true); setTimeout(() => setShake(false), 500); return; }
      send({ type: 'move', word: current });
      setCurrent("");
    } else if (k === 'back') setCurrent((c) => c.slice(0, -1));
    else if (/^[a-z]$/.test(k) && current.length < W_COLS) setCurrent((c) => c + k);
  }, [current, playing, iAmDone, send]);

  useEffect(() => {
    const h = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'enter') { e.preventDefault(); onKey('enter'); }
      else if (k === 'backspace') onKey('back');
      else if (/^[a-z]$/.test(k)) onKey(k);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onKey]);

  // Clear anything half-typed when a new round is dealt.
  const roundNo = room?.game?.roundNo;
  useEffect(() => { setCurrent(""); }, [roundNo]);

  const lobby = lobbyView({ status, room, me, roomCode, gameId: 'wordle', navigate, name, onName: setName, skipLobby: true });
  if (lobby) return lobby;

  const g = room.game;
  const opponent = room.players.find((p) => p.id !== playerId);
  const isHost = room.hostId === playerId;

  /* ---- waiting room, where the host picks how long a round lasts ---- */
  if (room.status === 'lobby') {
    return (
      <Centered>
        <h2 style={hStyle}>Wordle race</h2>
        <p style={pStyle}>Same word, both of you at once. First to solve it wins the round.</p>
        <InviteLink gameId="wordle" roomCode={roomCode} />

        <div style={{ marginTop: 26, marginBottom: 8, fontSize: 12, letterSpacing: ".18em", textTransform: "uppercase", color: C.dim, fontWeight: 700 }}>
          Round length
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 18 }}>
          {DURATION_LABELS.map(([ms, label]) => (
            <Btn key={ms} variant={g.durationMs === ms ? "primary" : "ghost"}
              onClick={() => isHost && send({ type: 'config', durationMs: ms })}
              style={{ padding: "8px 18px", fontSize: 14, opacity: isHost ? 1 : .6, cursor: isHost ? "pointer" : "default" }}>
              {label}
            </Btn>
          ))}
        </div>
        {!isHost && <p style={{ ...pStyle, fontSize: 13 }}>{room.players.find((p) => p.id === room.hostId)?.name ?? 'The host'} picks the length and starts the game.</p>}

        <div style={{ fontSize: 14, color: C.dim, marginBottom: 16 }}>
          {opponent ? `${opponent.name} is here.` : 'Nobody else here yet.'}
        </div>
        {isHost
          ? <Btn disabled={!opponent} style={{ opacity: opponent ? 1 : .5 }} onClick={() => send({ type: 'start' })}>Start</Btn>
          : <div style={{ fontSize: 14, color: C.dim }}>Waiting for the host to start…</div>}
        <Btn variant="subtle" style={{ marginTop: 16 }} onClick={() => navigate('wordle')}>Leave room</Btn>
      </Centered>
    );
  }

  /* ------------------------------ the race ------------------------------ */
  const over = room.status === 'over';
  const oppBoard = opponent ? g.boards[opponent.id] : null;

  const myRows = Array.from({ length: W_ROWS }, (_, r) => {
    if (myBoard.guesses[r]) return { letters: myBoard.guesses[r], scores: myBoard.scores[r] };
    if (r === myBoard.guesses.length) return { letters: current, scores: null };
    return { letters: "", scores: null };
  });
  const oppRows = Array.from({ length: W_ROWS }, (_, r) => ({ letters: "", scores: oppBoard?.scores?.[r] ?? null }));

  const keyState = {};
  myBoard.guesses.forEach((word, gi) => word.split("").forEach((ch, i) => {
    const s = myBoard.scores[gi][i], prev = keyState[ch];
    if (s === "correct" || (s === "present" && prev !== "correct") || (s === "absent" && !prev)) keyState[ch] = s;
  }));

  const verdict = over
    ? (g.forfeitedBy ? `${opponent?.name ?? 'They'} left — you win`
      : g.winner === playerId ? 'You got it first!'
      : g.winner ? `${opponent?.name ?? 'They'} got it first`
      : 'Nobody got it')
    : null;

  return (
    <Centered>
      <RoomStatus status={status} error={null} />

      <div style={{ display: "flex", gap: 18, fontSize: 14, marginBottom: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
        <span style={{ color: C.accent, fontWeight: 800 }}>{me.name} {g.wins[playerId] ?? 0}</span>
        <span style={{ color: C.dim }}>vs</span>
        <span style={{ color: C.accent2, fontWeight: 800 }}>{opponent?.name ?? '—'} {opponent ? (g.wins[opponent.id] ?? 0) : 0}</span>
        <span style={{ color: C.dim }}>Round {g.roundNo}</span>
        {!over && <Countdown endsAt={g.roundEndsAt} />}
      </div>

      <div style={{ height: 22, marginBottom: 6, fontSize: 13 }}>
        {toast && <span style={{ background: C.panel2, padding: "4px 12px", borderRadius: 6 }}>{toast}</span>}
      </div>

      <TypingBridge inputRef={bridgeRef} value={current} onValue={setCurrent} onEnter={() => onKey('enter')} />

      <div style={{ display: "flex", gap: 24, alignItems: "flex-start", justifyContent: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <div className={shake ? "row-shake" : ""} onClick={openPhoneKeyboard} style={{ cursor: "text" }}>
          <div style={{ fontSize: 12, letterSpacing: ".16em", textTransform: "uppercase", color: C.dim, fontWeight: 700, marginBottom: 8, textAlign: "center" }}>You</div>
          <Grid rows={myRows} size={56} />
        </div>
        <div>
          <div style={{ fontSize: 12, letterSpacing: ".16em", textTransform: "uppercase", color: C.dim, fontWeight: 700, marginBottom: 8, textAlign: "center" }}>
            {opponent?.name ?? 'Opponent'}{oppBoard?.solved ? ' ✓' : ''}
          </div>
          <Grid rows={oppRows} size={26} hideLetters />
        </div>
      </div>

      {over ? (
        <>
          <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6, color: g.winner === playerId ? C.correct : C.text }}>{verdict}</div>
          <div style={{ fontSize: 15, color: C.dim, marginBottom: 16 }}>
            The word was <b style={{ color: C.text, textTransform: "uppercase" }}>{g.answer}</b>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <Btn onClick={() => send({ type: 'rematch' })}>Next word</Btn>
            <Btn variant="subtle" onClick={() => navigate('wordle')}>Leave room</Btn>
          </div>
        </>
      ) : iAmDone ? (
        <div style={{ fontSize: 15, color: C.dim }}>
          {myBoard.solved ? 'Solved — waiting for the round to finish…' : 'Out of guesses — waiting…'}
        </div>
      ) : (
        <>
          <Keyboard onKey={onKey} keyState={keyState} />
          <button onClick={openPhoneKeyboard}
            style={{ marginTop: 12, background: "none", border: "none", color: C.dim, fontSize: 13, fontFamily: "inherit", cursor: "pointer", textDecoration: "underline" }}>
            Use my phone's keyboard instead
          </button>
        </>
      )}
    </Centered>
  );
}
