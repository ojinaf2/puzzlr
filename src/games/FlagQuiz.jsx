import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { C } from '../shared/theme.js';
import { rand, shuffle } from '../shared/utils.js';
import { Btn, TileBtn, Centered, hStyle, pStyle } from '../shared/ui.jsx';
import { COUNTRIES } from '../data/countries.js';
import { makeRoomCode } from '../shared/router.js';
import { RoomStatus, lobbyView, InviteLink } from '../shared/online.jsx';
import { useRoom, savedName, roomServerUrl } from '../shared/useRoom.js';

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

export default function FlagQuiz({ roomCode, navigate }) {
  if (roomCode) return <OnlineFlagQuiz roomCode={roomCode} navigate={navigate} />;
  return <LocalFlagQuiz navigate={navigate} />;
}

function LocalFlagQuiz({ navigate }) {
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
      {roomServerUrl() && (
        <Btn variant="subtle" style={{ marginTop: 18 }} onClick={() => navigate('flags', makeRoomCode())}>
          Race friends online
        </Btn>
      )}
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

/* ============================= ONLINE QUIZ =============================
   Everyone answers the same questions against one clock. Most correct wins,
   but only among players who finished: running out of time is a loss however
   many you had right. */

const QUIZ_DURATION_LABELS = [
  [30000, '30 sec'], [60000, '1 min'], [120000, '2 min'], [240000, '4 min'], [0, 'Untimed'],
];
const QUESTION_CHOICES = [5, 10, 15, 25, 50];
const capStyle = { fontSize: 12, letterSpacing: ".18em", textTransform: "uppercase", color: C.dim, fontWeight: 700 };

function QuizClock({ endsAt }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!endsAt) return;
    const t = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, [endsAt]);
  if (!endsAt) return <span style={{ color: C.dim }}>Untimed</span>;
  const secs = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
  return (
    <span style={{ fontWeight: 800, color: secs <= 10 ? C.danger : C.text, fontVariantNumeric: "tabular-nums" }}>
      {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
    </span>
  );
}

function OnlineFlagQuiz({ roomCode, navigate }) {
  const [name, setName] = useState(() => savedName());
  const { status, room, me, playerId, error, send } = useRoom({ gameId: 'flagquiz', roomCode, name });

  const lobby = lobbyView({ status, room, me, roomCode, gameId: 'flags', navigate, name, onName: setName, skipLobby: true });
  if (lobby) return lobby;

  const g = room.game;
  const isHost = room.hostId === playerId;
  const mine = g.progress?.[playerId];

  /* ------------------------------- lobby ------------------------------- */
  if (room.status === 'lobby') {
    return (
      <Centered>
        <h2 style={hStyle}>Flag Quiz race</h2>
        <p style={pStyle}>Same questions, one clock. Most right wins — but you have to finish.</p>
        <InviteLink gameId="flags" roomCode={roomCode} />

        <div style={{ width: "100%", maxWidth: 420, marginTop: 26, textAlign: "left" }}>
          <div style={{ ...capStyle, marginBottom: 8 }}>Mode</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
            {[['flag2country', 'Flag → Country'], ['country2flag', 'Country → Flag']].map(([m, label]) => (
              <Btn key={m} variant={g.mode === m ? "primary" : "ghost"}
                onClick={() => isHost && send({ type: 'config', mode: m })}
                style={{ padding: "8px 16px", fontSize: 14, opacity: isHost ? 1 : .6 }}>{label}</Btn>
            ))}
          </div>

          <div style={{ ...capStyle, marginBottom: 8 }}>Questions</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
            {QUESTION_CHOICES.map((n) => (
              <Btn key={n} variant={g.questionCount === n ? "primary" : "ghost"}
                onClick={() => isHost && send({ type: 'config', questionCount: n })}
                style={{ padding: "8px 18px", fontSize: 14, opacity: isHost ? 1 : .6 }}>{n}</Btn>
            ))}
          </div>

          <div style={{ ...capStyle, marginBottom: 8 }}>Time for the whole quiz</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
            {QUIZ_DURATION_LABELS.map(([ms, label]) => (
              <Btn key={ms} variant={g.durationMs === ms ? "primary" : "ghost"}
                onClick={() => isHost && send({ type: 'config', durationMs: ms })}
                style={{ padding: "8px 16px", fontSize: 14, opacity: isHost ? 1 : .6 }}>{label}</Btn>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 14, color: C.dim, marginBottom: 14 }}>
          {room.players.length === 1 ? 'Nobody else here yet.' : `Here: ${room.players.map((p) => p.name).join(', ')}`}
        </div>
        {isHost
          ? <Btn disabled={room.players.length < 2} style={{ opacity: room.players.length < 2 ? .5 : 1 }}
              onClick={() => send({ type: 'start' })}>Start quiz</Btn>
          : <div style={{ fontSize: 14, color: C.dim }}>Waiting for the host to start…</div>}
        <Btn variant="subtle" style={{ marginTop: 16 }} onClick={() => navigate('flags')}>Leave room</Btn>
      </Centered>
    );
  }

  /* ------------------------------ results ------------------------------ */
  if (room.status === 'over') {
    const table = room.players.map((p) => ({
      p, prog: g.progress[p.id] ?? { correct: 0, index: 0, finishedAt: null },
    })).sort((a, b) => {
      if (!!b.prog.finishedAt !== !!a.prog.finishedAt) return b.prog.finishedAt ? 1 : -1;
      return b.prog.correct - a.prog.correct;
    });
    const iWon = (g.winners ?? []).includes(playerId);
    const iRanOut = !mine?.finishedAt;
    const stoppedEarly = !!g.endedEarly;      // host called it, rather than a clock running out
    const unfinishedLabel = stoppedEarly ? 'Unfinished' : "Time's up";

    return (
      <Centered>
        <div style={{ ...capStyle, marginBottom: 8 }}>Round {g.roundNo}</div>
        <h2 style={{ ...hStyle, color: iWon ? C.correct : iRanOut ? C.danger : C.text }}>
          {iWon ? 'You win!' : iRanOut ? (stoppedEarly ? 'Quiz ended' : "Time's up") : (g.winners?.length ? `${room.players.find((p) => p.id === g.winners[0])?.name ?? 'They'} wins` : 'Nobody finished')}
        </h2>
        <p style={pStyle}>
          {iRanOut
            ? (stoppedEarly
              ? 'The quiz was stopped before you finished, so this one does not count as a win.'
              : 'You ran out of time before finishing, so this one goes down as a loss.')
            : 'Most right out of everyone who finished.'}
        </p>

        <div style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
          {table.map(({ p, prog }) => {
            const won = (g.winners ?? []).includes(p.id);
            return (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "12px 16px", borderRadius: 12, fontSize: 15,
                background: won ? C.panel2 : C.panel, border: `2px solid ${won ? C.correct : 'transparent'}` }}>
                <span style={{ fontWeight: 700 }}>{p.name}{p.id === playerId ? ' (you)' : ''}</span>
                <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  {!prog.finishedAt && <span style={{ fontSize: 12, color: C.danger, fontWeight: 700 }}>{unfinishedLabel}</span>}
                  <b style={{ color: C.accent2 }}>{prog.correct}/{g.questionCount}</b>
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          {isHost && <Btn onClick={() => send({ type: 'rematch' })}>Play again</Btn>}
          <Btn variant="subtle" onClick={() => navigate('flags')}>Leave room</Btn>
        </div>
      </Centered>
    );
  }

  /* ------------------------------ playing ------------------------------ */
  const question = g.questions?.[mine?.index ?? 0] ?? null;
  const lastAnswer = mine?.answers?.[mine.answers.length - 1] ?? null;
  const done = !!mine?.finishedAt;

  return (
    <Centered>
      <RoomStatus status={status} error={error} />

      <div style={{ display: "flex", gap: 16, fontSize: 13, color: C.dim, marginBottom: 12, flexWrap: "wrap", justifyContent: "center", alignItems: "center" }}>
        <span>Question {Math.min((mine?.index ?? 0) + 1, g.questionCount)} of {g.questionCount}</span>
        <span style={{ color: C.accent2, fontWeight: 700 }}>{mine?.correct ?? 0} right</span>
        <QuizClock endsAt={g.endsAt} />
      </div>

      {/* How everyone else is getting on. */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 16 }}>
        {room.players.filter((p) => p.id !== playerId).map((p) => {
          const prog = g.progress[p.id] ?? { index: 0, correct: 0 };
          return (
            <span key={p.id} style={{ fontSize: 12, background: C.panel, borderRadius: 20, padding: "4px 12px", color: C.dim }}>
              {p.name} {prog.finishedAt ? '✓ done' : `${prog.index}/${g.questionCount}`}
            </span>
          );
        })}
      </div>

      {/* Untimed, so nothing will end the quiz if somebody stops answering. */}
      {isHost && !g.endsAt && (
        <Btn variant="ghost" style={{ marginBottom: 14, padding: "7px 16px", fontSize: 13 }}
          onClick={() => send({ type: 'move', action: 'endNow' })}>End quiz now</Btn>
      )}

      {done ? (
        <>
          <h2 style={hStyle}>Finished</h2>
          <p style={pStyle}>
            {mine.correct} out of {g.questionCount} right. Waiting for everyone else…
          </p>
        </>
      ) : question ? (
        <>
          <div style={{ height: 20, marginBottom: 8, fontSize: 13, fontWeight: 700 }}>
            {lastAnswer && (lastAnswer.correct
              ? <span style={{ color: C.correct }}>Correct</span>
              : <span style={{ color: C.danger }}>Wrong</span>)}
          </div>

          {g.mode === 'flag2country' ? (
            <>
              <Flag code={question.prompt} style={{ ...flagFit, width: 250, borderRadius: 12, border: `1px solid ${C.line}`, marginBottom: 22, boxShadow: "0 10px 26px rgba(74,53,36,.22)" }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, width: "100%", maxWidth: 460 }}>
                {question.options.map((opt) => (
                  <TileBtn key={opt[1]} onClick={() => send({ type: 'move', index: mine.index, code: opt[1] })}
                    style={{ padding: "16px 12px", fontSize: 16, fontWeight: 700 }}>{opt[0]}</TileBtn>
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: 28, fontWeight: 700, marginBottom: 22 }}>
                {question.prompt}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, width: "100%", maxWidth: 460 }}>
                {question.options.map((opt) => (
                  <TileBtn key={opt[1]} onClick={() => send({ type: 'move', index: mine.index, code: opt[1] })}
                    noPad style={{ background: C.panel, border: "3px solid transparent", padding: 8 }}>
                    <Flag code={opt[1]} style={{ ...flagFit, borderRadius: 6 }} />
                  </TileBtn>
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <p style={pStyle}>Waiting for the next question…</p>
      )}

      <Btn variant="subtle" style={{ marginTop: 18 }} onClick={() => navigate('flags')}>Leave room</Btn>
    </Centered>
  );
}
