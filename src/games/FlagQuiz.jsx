import { useState, useEffect, useCallback } from 'react';
import { C } from '../shared/theme.js';
import { rand, shuffle } from '../shared/utils.js';
import { Btn, TileBtn, Centered, hStyle, pStyle } from '../shared/ui.jsx';
import { COUNTRIES } from '../data/countries.js';

/* ============================= FLAG QUIZ ============================= */
// Flags are bundled with the app in /public/flags/ so they load from your own
// domain with no external dependency. (During Claude's artifact preview, external
// image hosts are sandboxed, so local bundling is what makes them show everywhere.)
// Do not point this at a CDN, and do not move or rename public/flags/.
const FLAG_BASE = "/flags/"; // served by Vite from public/flags/xx.svg
function Flag({ code, style }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [code]);
  if (failed) return (
    <div style={{ ...style, background: C.panel2, display: "grid", placeItems: "center", color: C.dim, fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>{code}</div>
  );
  return (
    <img
      src={`${FLAG_BASE}${code}.svg`}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      style={style}
    />
  );
}

export default function FlagQuiz() {
  const [mode, setMode] = useState(null); // "flag2country" | "country2flag"
  const [q, setQ] = useState(null);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [qnum, setQnum] = useState(0);

  const makeQ = useCallback((m) => {
    const answer = COUNTRIES[rand(COUNTRIES.length)];
    const pool = shuffle(COUNTRIES.filter((c) => c[1] !== answer[1])).slice(0, 3);
    const options = shuffle([answer, ...pool]);
    setQ({ answer, options, mode: m }); setPicked(null);
  }, []);

  const start = (m) => { setMode(m); setScore(0); setStreak(0); setQnum(1); makeQ(m); };
  const pick = (opt) => { if (picked) return; setPicked(opt);
    if (opt[1] === q.answer[1]) { setScore((s) => s + 1); setStreak((s) => s + 1); } else setStreak(0); };
  const next = () => { setQnum((n) => n + 1); makeQ(mode); };

  if (!mode) return (
    <Centered>
      <h2 style={hStyle}>Flag Quiz</h2>
      <p style={pStyle}>Two ways to play. Pick your mode:</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <Btn onClick={() => start("flag2country")}>Flag → Country</Btn>
        <Btn onClick={() => start("country2flag")} variant="ghost">Country → Flag</Btn>
      </div>
    </Centered>
  );

  const correct = picked && picked[1] === q.answer[1];
  return (
    <Centered>
      <div style={{ display: "flex", gap: 18, fontSize: 13, color: C.dim, marginBottom: 14 }}>
        <span>Question {qnum}</span><span style={{color:C.accent2}}>Score {score}</span><span style={{color:C.gold}}>Streak {streak}</span>
      </div>

      {q.mode === "flag2country" ? (
        <>
          <Flag code={q.answer[1]} style={{ width: 240, height: 160, objectFit: "cover", borderRadius: 12, border: `1px solid ${C.line}`, marginBottom: 24, boxShadow: "0 10px 26px rgba(74,53,36,.22)" }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, width: "100%", maxWidth: 460 }}>
            {q.options.map((opt) => {
              const isAns = opt[1] === q.answer[1], isPick = picked && opt[1] === picked[1];
              let bg = C.panel, bd = "transparent", col = C.text;
              if (picked) { if (isAns) { bg = C.correct; bd = C.correct; col = "#fff"; } else if (isPick) { bg = C.danger; bd = C.danger; col = "#fff"; } else { bg = C.panel; } }
              return <TileBtn key={opt[1]} onClick={() => pick(opt)} disabled={!!picked} style={{ background: bg, border: `2px solid ${bd}`, color: col, padding: "16px 12px", fontSize: 16, fontWeight: 700 }}>{opt[0]}</TileBtn>;
            })}
          </div>
        </>
      ) : (
        <>
          <div style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: 26, fontWeight: 700, marginBottom: 24 }}>{q.answer[0]}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, width: "100%", maxWidth: 460 }}>
            {q.options.map((opt) => {
              const isAns = opt[1] === q.answer[1], isPick = picked && opt[1] === picked[1];
              let bd = "transparent", ring = "0 4px 14px rgba(74,53,36,.14)";
              if (picked) { if (isAns) { bd = C.correct; ring = `0 0 0 3px ${C.correct}55, 0 6px 16px rgba(74,53,36,.2)`; } else if (isPick) { bd = C.danger; ring = `0 0 0 3px ${C.danger}55`; } }
              return <TileBtn key={opt[1]} onClick={() => pick(opt)} disabled={!!picked} noPad style={{ background: C.panel, border: `3px solid ${bd}`, padding: 8, boxShadow: ring }}>
                <Flag code={opt[1]} style={{ width: "100%", height: 96, objectFit: "cover", borderRadius: 6, display: "block" }} />
              </TileBtn>;
            })}
          </div>
        </>
      )}

      <div style={{ height: 26, marginTop: 16, fontSize: 15, fontWeight: 700 }}>
        {picked && <span style={{ color: correct ? C.correct : C.danger }}>{correct ? "Correct!" : `It's ${q.answer[0]}`}</span>}
      </div>
      {picked && <div style={{ display: "flex", gap: 10 }}>
        <Btn onClick={next}>Next</Btn>
        <Btn onClick={() => setMode(null)} variant="subtle">Change mode</Btn>
      </div>}
    </Centered>
  );
}
