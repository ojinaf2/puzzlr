import { useState, useEffect, useCallback, useRef } from 'react';
import { C } from '../shared/theme.js';
import { rand } from '../shared/utils.js';
import { Btn } from '../shared/ui.jsx';
import { validSet, answerList } from '../data/words.js';

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

export default function Wordle() {
  const [answer, setAnswer] = useState(() => answerList[rand(answerList.length)]);
  const [guesses, setGuesses] = useState([]);
  const [scores, setScores] = useState([]);
  const [current, setCurrent] = useState("");
  const [status, setStatus] = useState("playing");
  const [toast, setToast] = useState("");
  const [shake, setShake] = useState(false);
  const [revealRow, setRevealRow] = useState(-1);
  const tt = useRef(null);

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
    const h = (e) => { if (e.metaKey || e.ctrlKey || e.altKey) return; const k = e.key.toLowerCase();
      if (k === "enter") { e.preventDefault(); onKey("enter"); } else if (k === "backspace") onKey("back"); else if (/^[a-z]$/.test(k)) onKey(k); };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [onKey]);

  const keyState = {};
  guesses.forEach((g, gi) => g.split("").forEach((c, i) => { const s = scores[gi][i], p = keyState[c];
    if (s === "correct" || (s === "present" && p !== "correct") || (s === "absent" && !p)) keyState[c] = s; }));

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ height: 22, marginBottom: 6, fontSize: 13 }}>{toast && <span style={{ background: C.panel2, padding: "4px 12px", borderRadius: 6 }}>{toast}</span>}</div>
      <div style={{ display: "grid", gridTemplateRows: `repeat(${W_ROWS}, 1fr)`, gap: 6, marginBottom: 14 }}>
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
      {status !== "playing" && <Btn onClick={reset} style={{ marginBottom: 12 }}>{status === "won" ? "Next word" : "Try another"}</Btn>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%", maxWidth: 484 }}>
        {KEYS.map((row, ri) => (
          <div key={ri} style={{ display: "flex", justifyContent: "center", gap: 5 }}>
            {ri === 2 && <KbKey wide onClick={() => onKey("enter")}>Enter</KbKey>}
            {row.split("").map((k) => { const st = keyState[k];
              const bg = st === "correct" ? C.correct : st === "present" ? C.present : st === "absent" ? C.absent : "#e0be93";
              const kc = st ? "#fff" : C.text;
              return <KbKey key={k} onClick={() => onKey(k)} bg={bg} kc={kc}>{k}</KbKey>; })}
            {ri === 2 && <KbKey wide onClick={() => onKey("back")}>Del</KbKey>}
          </div>
        ))}
      </div>
    </div>
  );
}
function KbKey({ children, onClick, wide, bg = "#e0be93", kc = C.text }) {
  return <button onClick={onClick} style={{ minWidth: wide ? 54 : 32, height: 52, background: bg, color: kc, border: "none", borderRadius: 9, fontSize: wide ? 12 : 15, fontWeight: 700, textTransform: "uppercase", cursor: "pointer", flex: wide ? "0 0 auto" : "1 1 0", maxWidth: 46, boxShadow: "0 2px 5px rgba(74,53,36,.18)", transition: "transform .08s" }}
    onMouseDown={(e)=>e.currentTarget.style.transform="translateY(1px)"} onMouseUp={(e)=>e.currentTarget.style.transform="none"} onMouseLeave={(e)=>e.currentTarget.style.transform="none"}>{children}</button>;
}
