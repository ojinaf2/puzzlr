import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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

// Every flag file is 4:3, so "contain" shows the whole flag with no cropping.
const flagFit = { width: "100%", aspectRatio: "4 / 3", objectFit: "contain", display: "block" };

/* Typed answers (hard mode) are matched loosely: case, spacing, punctuation and
   accents are ignored, and these common alternative names are accepted too. */
const ALIASES = {
  us: ["usa", "united states of america", "america"],
  gb: ["uk", "great britain", "britain"],
  ae: ["uae"],
  cz: ["czech republic"],
  kr: ["republic of korea"],
  kp: ["dprk", "democratic peoples republic of korea"],
  nl: ["holland"],
  ru: ["russian federation"],
  tr: ["turkiye"],
  ir: ["islamic republic of iran"],
  va: ["vatican"],
};
// Order matters: punctuation becomes a space, and only then is whitespace
// collapsed and trimmed - otherwise a trailing "." would leave a stray space.
const normalize = (s) => s
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // strip accents
  .toLowerCase()
  .replace(/[.,'\u2019\-]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .replace(/^the /, "")
  .trim();
const matchesAnswer = (input, answer) => {
  const n = normalize(input);
  if (!n) return false;
  if (n === normalize(answer[0])) return true;
  return (ALIASES[answer[1]] || []).some((a) => normalize(a) === n);
};

/* Typeahead so nobody loses a point to a typo. A country matches if the name
   starts with what you typed, or if any word in it does — so "k" offers Kenya
   and Kuwait, but also South Korea and United Kingdom. Whole-name matches are
   listed first; COUNTRIES is already alphabetical, so each group stays sorted. */
const MAX_SUGGESTIONS = 6;
const suggestFor = (raw) => {
  const query = normalize(raw);
  if (!query) return [];
  const leading = [], midName = [];
  for (const c of COUNTRIES) {
    const name = normalize(c[0]);
    if (name.startsWith(query)) leading.push(c);
    else if (name.split(" ").some((w) => w.startsWith(query))) midName.push(c);
  }
  return [...leading, ...midName].slice(0, MAX_SUGGESTIONS);
};

export default function FlagQuiz() {
  const [mode, setMode] = useState(null); // "flag2country" | "country2flag"
  const [difficulty, setDifficulty] = useState("easy"); // "easy" | "hard"
  const [q, setQ] = useState(null);
  const [picked, setPicked] = useState(null);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState(null); // { correct } once an answer is locked in
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [qnum, setQnum] = useState(0);
  const [listOpen, setListOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1); // index into suggestions, -1 = none
  const inputRef = useRef(null);

  const makeQ = useCallback((m, d) => {
    const answer = COUNTRIES[rand(COUNTRIES.length)];
    // Hard mode for country → flag means six flags on screen instead of four.
    const distractors = m === "country2flag" && d === "hard" ? 5 : 3;
    const pool = shuffle(COUNTRIES.filter((c) => c[1] !== answer[1])).slice(0, distractors);
    const options = shuffle([answer, ...pool]);
    setQ({ answer, options, mode: m, difficulty: d });
    setPicked(null); setTyped(""); setResult(null); setListOpen(false); setHighlight(-1);
  }, []);

  const typedMode = q && q.mode === "flag2country" && q.difficulty === "hard";

  // Put the cursor straight in the box on each new typed question.
  useEffect(() => { if (typedMode && !result) inputRef.current?.focus(); }, [qnum, typedMode, result]);

  const score1 = (correct) => {
    if (correct) { setScore((s) => s + 1); setStreak((s) => s + 1); } else setStreak(0);
  };

  const start = (m) => { setMode(m); setScore(0); setStreak(0); setQnum(1); makeQ(m, difficulty); };
  const pick = (opt) => { if (picked) return; setPicked(opt);
    const correct = opt[1] === q.answer[1];
    setResult({ correct }); score1(correct); };
  const submitTyped = () => {
    if (result || !typed.trim()) return;
    const correct = matchesAnswer(typed, q.answer);
    setResult({ correct }); score1(correct); setListOpen(false); setHighlight(-1);
  };
  const next = () => { setQnum((n) => n + 1); makeQ(mode, difficulty); };

  const suggestions = useMemo(
    () => (typedMode && !result ? suggestFor(typed) : []),
    [typed, typedMode, result]
  );
  const showList = listOpen && suggestions.length > 0;

  const chooseSuggestion = (c) => {
    setTyped(c[0]); setListOpen(false); setHighlight(-1);
    inputRef.current?.focus();     // filled in, but the player still confirms
  };
  const onTypedKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setListOpen(true); setHighlight((i) => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((i) => Math.max(i - 1, -1)); }
    else if (e.key === "Escape") { setListOpen(false); setHighlight(-1); }
    else if (e.key === "Enter" && showList && highlight >= 0) {
      e.preventDefault();          // first Enter picks the name, a second one submits it
      chooseSuggestion(suggestions[highlight]);
    }
  };

  if (!mode) return (
    <Centered>
      <h2 style={hStyle}>Flag Quiz</h2>
      <p style={{ ...pStyle, marginBottom: 10 }}>Two ways to play. Pick a difficulty, then a mode:</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        {[["easy", "Easy"], ["hard", "Hard"]].map(([d, label]) => (
          <Btn key={d} variant={difficulty === d ? "primary" : "ghost"} onClick={() => setDifficulty(d)}
            style={{ padding: "8px 22px", fontSize: 14 }}>{label}</Btn>
        ))}
      </div>
      <p style={{ ...pStyle, fontSize: 13.5, marginBottom: 22 }}>
        {difficulty === "easy"
          ? "Four options to choose from."
          : "Flag → Country: type the country yourself, no options. Country → Flag: six flags instead of four."}
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <Btn onClick={() => start("flag2country")}>Flag → Country</Btn>
        <Btn onClick={() => start("country2flag")} variant="ghost">Country → Flag</Btn>
      </div>
    </Centered>
  );

  const correct = result && result.correct;
  const sixUp = q.options.length > 4;
  return (
    <Centered>
      <div style={{ display: "flex", gap: 18, fontSize: 13, color: C.dim, marginBottom: 14 }}>
        <span>Question {qnum}</span><span style={{color:C.accent2}}>Score {score}</span><span style={{color:C.gold}}>Streak {streak}</span>
        <span>{q.difficulty === "hard" ? "Hard" : "Easy"}</span>
      </div>

      {q.mode === "flag2country" ? (
        <>
          <Flag code={q.answer[1]} style={{ ...flagFit, width: 270, borderRadius: 12, border: `1px solid ${C.line}`, marginBottom: 24, boxShadow: "0 10px 26px rgba(74,53,36,.22)" }} />
          {typedMode ? (
            <form onSubmit={(e) => { e.preventDefault(); submitTyped(); }}
              style={{ display: "flex", gap: 10, width: "100%", maxWidth: 420, justifyContent: "center", flexWrap: "wrap" }}>
              <div style={{ position: "relative", flex: "1 1 220px", minWidth: 0 }}>
                <input ref={inputRef} value={typed}
                  onChange={(e) => { setTyped(e.target.value); setListOpen(true); setHighlight(-1); }}
                  onKeyDown={onTypedKeyDown}
                  onFocus={() => setListOpen(true)}
                  onBlur={() => setListOpen(false)}
                  disabled={!!result} placeholder="Type the country" autoComplete="off" spellCheck="false"
                  role="combobox" aria-expanded={showList} aria-controls="fq-suggestions" aria-autocomplete="list"
                  style={{ width: "100%", padding: "13px 16px", fontSize: 16, fontFamily: "inherit", color: C.text,
                    background: result ? C.panel2 : "#fff", border: `2px solid ${result ? (correct ? C.correct : C.danger) : C.line}`,
                    borderRadius: 12, outlineColor: C.accent, transition: "border-color .2s" }} />
                {showList && (
                  <ul id="fq-suggestions" role="listbox" style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 20,
                    listStyle: "none", margin: 0, padding: 4, textAlign: "left", background: "#fff",
                    border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: "0 12px 28px rgba(74,53,36,.18)",
                    maxHeight: 244, overflowY: "auto" }}>
                    {suggestions.map((c, i) => (
                      <li key={c[1]} role="option" aria-selected={i === highlight}
                        onMouseDown={(e) => e.preventDefault()}   // keep focus so onBlur doesn't close first
                        onClick={() => chooseSuggestion(c)}
                        onMouseEnter={() => setHighlight(i)}
                        style={{ padding: "10px 12px", borderRadius: 8, cursor: "pointer", fontSize: 15,
                          background: i === highlight ? C.panel : "transparent" }}>{c[0]}</li>
                    ))}
                  </ul>
                )}
              </div>
              {!result && <Btn type="submit" disabled={!typed.trim()} style={{ opacity: typed.trim() ? 1 : .5 }}>Check</Btn>}
            </form>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, width: "100%", maxWidth: 460 }}>
              {q.options.map((opt) => {
                const isAns = opt[1] === q.answer[1], isPick = picked && opt[1] === picked[1];
                let bg = C.panel, bd = "transparent", col = C.text;
                if (picked) { if (isAns) { bg = C.correct; bd = C.correct; col = "#fff"; } else if (isPick) { bg = C.danger; bd = C.danger; col = "#fff"; } else { bg = C.panel; } }
                return <TileBtn key={opt[1]} onClick={() => pick(opt)} disabled={!!picked} style={{ background: bg, border: `2px solid ${bd}`, color: col, padding: "16px 12px", fontSize: 16, fontWeight: 700 }}>{opt[0]}</TileBtn>;
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: 26, fontWeight: 700, marginBottom: 24 }}>{q.answer[0]}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, width: "100%", maxWidth: sixUp ? 620 : 460 }}>
            {q.options.map((opt) => {
              const isAns = opt[1] === q.answer[1], isPick = picked && opt[1] === picked[1];
              let bd = "transparent", ring = "0 4px 14px rgba(74,53,36,.14)";
              if (picked) { if (isAns) { bd = C.correct; ring = `0 0 0 3px ${C.correct}55, 0 6px 16px rgba(74,53,36,.2)`; } else if (isPick) { bd = C.danger; ring = `0 0 0 3px ${C.danger}55`; } }
              return <TileBtn key={opt[1]} onClick={() => pick(opt)} disabled={!!picked} noPad style={{ background: C.panel, border: `3px solid ${bd}`, padding: 8, boxShadow: ring }}>
                <Flag code={opt[1]} style={{ ...flagFit, borderRadius: 6 }} />
              </TileBtn>;
            })}
          </div>
        </>
      )}

      <div style={{ minHeight: 26, marginTop: 16, fontSize: 15, fontWeight: 700 }}>
        {result && <span style={{ color: correct ? C.correct : C.danger }}>{correct ? "Correct!" : `It's ${q.answer[0]}`}</span>}
      </div>
      {result && <div style={{ display: "flex", gap: 10 }}>
        <Btn onClick={next}>Next</Btn>
        <Btn onClick={() => setMode(null)} variant="subtle">Change mode</Btn>
      </div>}
    </Centered>
  );
}
