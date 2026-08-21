import { useState, useEffect, useMemo, useRef } from 'react';
import { C } from '../shared/theme.js';
import { Btn, TileBtn, Centered, hStyle, pStyle } from '../shared/ui.jsx';
import { DIFFICULTIES, pickWord, suggestSpelling } from '../data/hangmanWords.js';
import { todayNumber, dailyPick, saveBoard, finishDaily, todaysRecord } from '../shared/daily.js';
import { DailyPanel } from '../shared/dailyUi.jsx';
import { LeaderboardTabs, LeaderboardPanel, NamePrompt } from '../shared/leaderboardUi.jsx';
import { useScoreSubmit } from '../shared/leaderboard.js';
import { sfx } from '../shared/sound.js';

/* ============================= HANGMAN =============================
   Two ways to play. Against the bot it draws a word from the banks at the
   chosen difficulty. Pass-and-play rotates a setter each round: everyone
   else guesses together, and the setter scores if they stump the room.

   Seven wrong guesses finish the cowboy: head, hat, torso, two arms and
   two legs. */
const MAX_WRONG = 7;
const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const MIN_PLAYERS = 2, MAX_PLAYERS = 6, MAX_ROUNDS = 10;
const labelStyle = { fontSize: "0.75rem", letterSpacing: ".18em", textTransform: "uppercase", color: C.dim, fontWeight: 700 };

const cleanWord = (raw) => raw.toUpperCase().replace(/[^A-Z ]/g, "").replace(/\s+/g, " ").trim();

const DAILY_ID = "hangman";
const DAILY_DIFFICULTY = "medium";

export default function Hangman() {
  const [screen, setScreen] = useState("menu");   // menu | botSetup | localSetup | setWord | handoff | play | final
  const [mode, setMode] = useState(null);         // bot | local | daily
  /* The menu's own tab strip. Hangman picks its mode with three buttons and a
     setup screen behind each, which reads well as it is — so the strip sits
     above that rather than trying to fold "play the bot" into a tab. */
  const [view, setView] = useState("play");
  const board = useScoreSubmit(DAILY_ID);
  const [difficulty, setDifficulty] = useState("easy");
  const [rounds, setRounds] = useState(5);
  const [players, setPlayers] = useState([{ id: 1, name: "Player 1" }, { id: 2, name: "Player 2" }]);
  const [scores, setScores] = useState({});
  const [botWins, setBotWins] = useState(0);
  const [round, setRound] = useState(1);
  const [word, setWord] = useState("");
  const [guessed, setGuessed] = useState([]);
  const [draft, setDraft] = useState("");
  const nextId = useRef(3);
  const scoredRef = useRef(false);

  const day = todayNumber();
  const [record, setRecord] = useState(() => todaysRecord(DAILY_ID, day));
  const dailyWord = useMemo(
    () => cleanWord(dailyPick(DIFFICULTIES.find((d) => d.key === DAILY_DIFFICULTY).words, DAILY_ID, day)),
    [day]);

  const setterIndex = (round - 1) % players.length;
  const setter = players[setterIndex];
  const nameOf = (p, i) => (p.name.trim() || `Player ${i + 1}`);

  const needed = useMemo(() => new Set(word.replace(/[^A-Z]/g, "").split("")), [word]);
  const won = word !== "" && [...needed].every((l) => guessed.includes(l));
  const wrongLetters = guessed.filter((l) => !needed.has(l));
  const lost = wrongLetters.length >= MAX_WRONG;
  const over = won || lost;

  useEffect(() => {
    if (won) sfx.win();
    if (lost) sfx.lose();
  }, [won, lost]);

  /* Guesses in the order they were made, hit or miss. It gives away how long
     the attempt took without giving away the word itself. */
  const buildDailyShare = () => {
    const trail = guessed.map((l) => (needed.has(l) ? "🟩" : "🟥")).join("");
    const headline = won ? `solved, ${wrongLetters.length} wrong` : "not solved";
    return `Puzzlr Hangman #${day} — ${headline}\n\n${trail}\n\nplaypuzzlr.com`;
  };

  /* Award the round exactly once, whichever way it ended. */
  useEffect(() => {
    if (!over || scoredRef.current) return;
    scoredRef.current = true;
    if (mode === "bot") { if (won) setBotWins((w) => w + 1); }
    else if (mode === "daily") {
      const next = finishDaily(DAILY_ID, day, won, won ? String(wrongLetters.length) : "X");
      setRecord(next);
      // The longest streak ever reached, not today's — see the note in Wordle.
      if (next.best > 0) board.submit("daily", next.best);
    }
    else if (!won) setScores((s) => ({ ...s, [setter.id]: (s[setter.id] || 0) + 1 }));
  }, [over, won, mode, setter, day, wrongLetters.length]);   // eslint-disable-line react-hooks/exhaustive-deps

  /* Keep today's half-guessed board, so a refresh does not cost the attempt. */
  useEffect(() => {
    if (mode === "daily" && screen === "play") saveBoard(DAILY_ID, day, guessed);
  }, [mode, screen, guessed, day]);

  /* Physical keyboard, same as Wordle. */
  useEffect(() => {
    if (screen !== "play" || over) return;
    const h = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (/^[a-z]$/.test(k)) guess(k.toUpperCase());
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const guess = (letter) => {
    if (over) return;
    // A letter already tried changes nothing, so it should not sound like it did.
    if (guessed.includes(letter)) return;
    if (needed.has(letter)) sfx.good(); else sfx.bad();
    setGuessed((g) => (g.includes(letter) ? g : [...g, letter]));
  };

  const beginRound = (n, w) => {
    setRound(n); setWord(w); setGuessed([]); scoredRef.current = false; setScreen("play");
  };

  const startBot = () => {
    setMode("bot"); setBotWins(0);
    beginRound(1, cleanWord(pickWord(difficulty)));
  };
  /* One word, once a day, picked up wherever it was left. */
  const startDaily = () => {
    setMode("daily"); setRound(1); setWord(dailyWord);
    setGuessed(record.board || []);
    scoredRef.current = !!record.done;
    setScreen("play");
  };
  const startLocal = () => {
    setMode("local"); setScores({}); setRound(1); setDraft(""); setScreen("setWord");
  };
  const nextRound = () => {
    const n = round + 1;
    if (n > rounds) { setScreen("final"); return; }
    if (mode === "bot") beginRound(n, cleanWord(pickWord(difficulty)));
    else { setRound(n); setDraft(""); setScreen("setWord"); }
  };

  const suggestion = useMemo(() => {
    const w = cleanWord(draft);
    return w.includes(" ") || w.length < 3 ? null : suggestSpelling(w);
  }, [draft]);

  /* ------------------------------- menu ------------------------------- */
  if (screen === "menu") return (
    <Centered>
      <LeaderboardTabs gameId={DAILY_ID} view={view} setView={setView} />
      {view === "board" ? (
        <LeaderboardPanel gameId={DAILY_ID} localBest={() => record.best || null} />
      ) : <>
        <Anim />
        <h2 style={hStyle}>Hangman</h2>
        <p style={pStyle}>Guess the word one letter at a time. Seven wrong guesses and the cowboy is done for.</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <Btn onClick={startDaily}>Daily word{record.done ? " ✓" : ""}</Btn>
          <Btn variant="ghost" onClick={() => { setMode("bot"); setScreen("botSetup"); }}>Play the bot</Btn>
          <Btn variant="ghost" onClick={() => { setMode("local"); setScreen("localSetup"); }}>Pass and play</Btn>
        </div>
        <p style={{ ...pStyle, fontSize: "0.8125rem", marginTop: 14, marginBottom: 0 }}>
          Everyone gets the same daily word — puzzle #{day}.
          {record.streak > 0 && ` You are ${record.streak} day${record.streak === 1 ? "" : "s"} into a streak.`}
        </p>
      </>}
    </Centered>
  );

  /* ---------------------------- bot setup ---------------------------- */
  if (screen === "botSetup") return (
    <Centered>
      <Anim />
      <h2 style={hStyle}>Play the bot</h2>
      <p style={pStyle}>The bot picks a word each round. Guess every one of them for a perfect score.</p>

      <div style={{ width: "100%", maxWidth: 460, textAlign: "left" }}>
        <div style={{ ...labelStyle, marginBottom: 8 }}>Difficulty</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
          {DIFFICULTIES.map((d) => (
            <TileBtn key={d.key} onClick={() => setDifficulty(d.key)}
              style={{ padding: "14px 16px", textAlign: "left", border: `2px solid ${difficulty === d.key ? C.accent : "transparent"}` }}>
              <div style={{ fontSize: "1rem", fontWeight: 800 }}>{d.name}</div>
              <div style={{ fontSize: "0.8125rem", color: C.dim, marginTop: 2 }}>{d.blurb}</div>
            </TileBtn>
          ))}
        </div>
        <RoundPicker rounds={rounds} setRounds={setRounds} />
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <Btn onClick={startBot}>Start</Btn>
        <Btn variant="subtle" onClick={() => setScreen("menu")}>Back</Btn>
      </div>
    </Centered>
  );

  /* --------------------------- local setup --------------------------- */
  if (screen === "localSetup") return (
    <Centered>
      <Anim />
      <h2 style={hStyle}>Pass and play</h2>
      <p style={pStyle}>Players take turns setting a word. Everyone else guesses together — stump them and you score.</p>

      <div style={{ width: "100%", maxWidth: 460, textAlign: "left" }}>
        <div style={{ ...labelStyle, marginBottom: 8 }}>Players ({players.length})</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
          {players.map((p, i) => (
            <div key={p.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ width: 22, color: C.dim, fontSize: "0.8125rem", fontWeight: 700 }}>{i + 1}</span>
              <input value={p.name} maxLength={18}
                onChange={(e) => setPlayers((ps) => ps.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)))}
                placeholder={`Player ${i + 1}`}
                style={{ flex: 1, minWidth: 0, padding: "10px 14px", fontSize: "0.9375rem", fontFamily: "inherit", color: C.text,
                  background: "#fff", border: `2px solid ${C.line}`, borderRadius: 10, outlineColor: C.accent }} />
              <button onClick={() => setPlayers((ps) => ps.length <= MIN_PLAYERS ? ps : ps.filter((x) => x.id !== p.id))}
                disabled={players.length <= MIN_PLAYERS} aria-label={`Remove ${nameOf(p, i)}`}
                style={{ width: 36, height: 36, borderRadius: 9, border: `1px solid ${C.line}`, background: "transparent",
                  color: C.dim, fontSize: "1.125rem", lineHeight: 1, cursor: players.length <= MIN_PLAYERS ? "default" : "pointer",
                  opacity: players.length <= MIN_PLAYERS ? .35 : 1 }}>&minus;</button>
            </div>
          ))}
        </div>
        <Btn variant="ghost" disabled={players.length >= MAX_PLAYERS}
          onClick={() => setPlayers((ps) => ps.length >= MAX_PLAYERS ? ps
            : [...ps, { id: nextId.current++, name: `Player ${ps.length + 1}` }])}
          style={{ opacity: players.length >= MAX_PLAYERS ? .5 : 1, marginBottom: 24 }}>+ Add player</Btn>

        <RoundPicker rounds={rounds} setRounds={setRounds} />
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <Btn onClick={startLocal}>Start</Btn>
        <Btn variant="subtle" onClick={() => setScreen("menu")}>Back</Btn>
      </div>
    </Centered>
  );

  /* ------------------------- setter types a word ------------------------- */
  if (screen === "setWord") {
    const cleaned = cleanWord(draft);
    return (
      <Centered>
        <Anim />
        <div style={{ ...labelStyle, marginBottom: 8 }}>Round {round} of {rounds}</div>
        <h2 style={hStyle}>{nameOf(setter, setterIndex)}, set a word</h2>
        <p style={pStyle}>Everyone else looks away. Anything goes — the group can argue about it afterwards.</p>

        <form onSubmit={(e) => { e.preventDefault(); if (cleaned.length >= 2) setScreen("handoff"); }}
          style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus
            placeholder="Type a word" autoComplete="off" spellCheck="false" maxLength={20}
            style={{ width: "100%", padding: "14px 16px", fontSize: "1.125rem", fontFamily: "inherit", color: C.text,
              background: "#fff", border: `2px solid ${C.line}`, borderRadius: 12, outlineColor: C.accent, textAlign: "center" }} />
          <div style={{ minHeight: 22, fontSize: "0.84375rem", color: C.dim }}>
            {suggestion
              ? <>Did you mean <b style={{ color: C.accent }}>{suggestion}</b>? You can submit yours anyway.</>
              : cleaned.length > 0 && cleaned.length < 2 ? "A little longer, please." : ""}
          </div>
          <Btn type="submit" disabled={cleaned.length < 2} style={{ opacity: cleaned.length < 2 ? .5 : 1 }}>Submit word</Btn>
        </form>
      </Centered>
    );
  }

  /* ----------------------------- hand over ----------------------------- */
  if (screen === "handoff") return (
    <Centered>
      <Anim />
      <h2 style={hStyle}>Pass the device</h2>
      <p style={pStyle}>
        Hand it to everyone else. {nameOf(setter, setterIndex)}, no hints — you score only if nobody gets it.
      </p>
      <Btn onClick={() => beginRound(round, cleanWord(draft))}>We're ready</Btn>
    </Centered>
  );

  /* ------------------------------- final ------------------------------- */
  if (screen === "final") {
    const table = players.map((p, i) => ({ name: nameOf(p, i), pts: scores[p.id] || 0 })).sort((a, b) => b.pts - a.pts);
    const top = table.length ? table[0].pts : 0;
    const winners = table.filter((t) => t.pts === top);
    const perfect = botWins === rounds;
    return (
      <Centered>
        <Anim />
        {mode === "bot" ? (
          <>
            <div style={{ ...labelStyle, marginBottom: 10 }}>Final score</div>
            <div className="hm-pop" style={{ fontFamily: "var(--font-head)", fontSize: "3.25rem", fontWeight: 700, marginBottom: 6 }}>
              {botWins} / {rounds}
            </div>
            <p style={pStyle}>{perfect ? "A perfect score. The cowboy lives." : "Not perfect — the bot got a few past you."}</p>
          </>
        ) : (
          <>
            <h2 style={hStyle}>{winners.length > 1 ? "It's a tie!" : `${winners[0].name} wins`}</h2>
            <p style={pStyle}>A point for every word the room failed to guess.</p>
            <div style={{ width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
              {table.map((t, i) => (
                <div key={t.name + i} className="hm-rise" style={{ animationDelay: `${i * 0.08}s`, display: "flex", justifyContent: "space-between",
                  padding: "12px 16px", borderRadius: 12, background: t.pts === top ? C.panel2 : C.panel, fontSize: "1rem" }}>
                  <span style={{ fontWeight: 700 }}>{t.name}</span>
                  <span style={{ fontWeight: 800, color: C.accent2 }}>{t.pts}</span>
                </div>
              ))}
            </div>
          </>
        )}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <Btn onClick={() => (mode === "bot" ? startBot() : startLocal())}>Play again</Btn>
          <Btn variant="subtle" onClick={() => setScreen("menu")}>Change setup</Btn>
        </div>
      </Centered>
    );
  }

  /* ------------------------------- playing ------------------------------- */
  const livesLeft = MAX_WRONG - wrongLetters.length;
  return (
    <Centered>
      <Anim />
      <div style={{ display: "flex", gap: 18, fontSize: "0.8125rem", color: C.dim, marginBottom: 6, flexWrap: "wrap", justifyContent: "center" }}>
        {mode === "daily" ? <span>Puzzle #{day}</span> : <span>Round {round} of {rounds}</span>}
        {mode === "bot" && <><span style={{ color: C.accent2 }}>Solved {botWins}</span><span>{DIFFICULTIES.find((d) => d.key === difficulty).name}</span></>}
        {mode === "daily" && record.streak > 0 && <span style={{ color: C.accent2 }}>Streak {record.streak}</span>}
        {mode === "local" && <span style={{ color: C.accent2 }}>Set by {nameOf(setter, setterIndex)}</span>}
        <span style={{ color: livesLeft <= 2 ? C.danger : C.dim }}>{livesLeft} left</span>
      </div>

      <Cowboy wrong={wrongLetters.length} dead={lost} />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", margin: "18px 0 8px" }}>
        {word.split("").map((ch, i) => {
          if (ch === " ") return <span key={i} style={{ width: 16 }} />;
          const show = guessed.includes(ch) || over;
          const missed = over && !guessed.includes(ch);
          return (
            <span key={i} style={{ width: 30, fontSize: "1.6875rem", fontWeight: 800, textAlign: "center",
              borderBottom: `3px solid ${missed ? C.danger : C.line}`, color: missed ? C.danger : C.text, lineHeight: 1.25 }}>
              {show ? ch : ""}
            </span>
          );
        })}
      </div>

      <div style={{ minHeight: 30, marginBottom: 6, fontSize: "1rem", fontWeight: 800 }}>
        {won && <span style={{ color: C.correct }}>Got it!</span>}
        {lost && <span style={{ color: C.danger }}>Out of guesses.</span>}
      </div>

      {over ? (
        <>
          {mode === "local" && (
            <p style={{ ...pStyle, marginBottom: 14 }}>
              {won ? `No point for ${nameOf(setter, setterIndex)} — the room got it.`
                   : `${nameOf(setter, setterIndex)} scores a point.`}
            </p>
          )}
          {mode === "daily" ? (
            <>
              <DailyPanel record={record} day={day} title="word" buildShare={buildDailyShare}
                buckets={["0", "1", "2", "3", "4", "5", "6"]} caption="Wrong guesses" />
              <Btn variant="ghost" onClick={() => { setMode("bot"); setScreen("botSetup"); }}>Keep playing</Btn>
            </>
          ) : (
            <Btn onClick={nextRound}>{round >= rounds ? "See results" : "Next round"}</Btn>
          )}
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%", maxWidth: 484 }}>
          {KEY_ROWS.map((row, ri) => (
            <div key={ri} style={{ display: "flex", justifyContent: "center", gap: 5 }}>
              {row.split("").map((k) => {
                const L = k.toUpperCase();
                const used = guessed.includes(L);
                const hit = used && needed.has(L);
                return (
                  <button key={k} onClick={() => guess(L)} disabled={used}
                    style={{ flex: "1 1 0", maxWidth: 46, height: 50, borderRadius: 9, border: "none", cursor: used ? "default" : "pointer",
                      fontFamily: "inherit", fontSize: "0.9375rem", fontWeight: 700, textTransform: "uppercase",
                      background: hit ? C.correct : used ? "transparent" : "#e0be93",
                      color: hit ? "#fff" : used ? C.dim : C.text,
                      textDecoration: used && !hit ? "line-through" : "none",
                      boxShadow: used ? "none" : "0 2px 5px rgba(74,53,36,.18)" }}>
                    {k}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <NamePrompt open={board.needsName} metric="streak" onClose={board.dismiss} />
    </Centered>
  );
}

function RoundPicker({ rounds, setRounds }) {
  return (
    <>
      <div style={{ ...labelStyle, marginBottom: 8 }}>Rounds</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 24 }}>
        {Array.from({ length: MAX_ROUNDS }).map((_, i) => (
          <Btn key={i} variant={rounds === i + 1 ? "primary" : "ghost"} onClick={() => setRounds(i + 1)}
            style={{ padding: "7px 15px", fontSize: "0.875rem" }}>{i + 1}</Btn>
        ))}
      </div>
    </>
  );
}

/* The cowboy: head, hat, torso, two arms, two legs — one per wrong guess.
   Drawn head-first so the hat has something to sit on. */
function Cowboy({ wrong, dead }) {
  const on = (n) => wrong >= n;
  const ink = dead ? C.danger : C.text;
  const stroke = { stroke: ink, strokeWidth: 5, strokeLinecap: "round", fill: "none" };
  return (
    <svg viewBox="0 0 250 250" style={{ width: "100%", maxWidth: 260, height: "auto" }} role="img"
      aria-label={`${wrong} of ${MAX_WRONG} wrong guesses`}>
      {/* gallows */}
      <g stroke="#9c7a54" strokeWidth="7" strokeLinecap="round" fill="none">
        <line x1="20" y1="238" x2="120" y2="238" />
        <line x1="45" y1="238" x2="45" y2="18" />
        <line x1="45" y1="18" x2="158" y2="18" />
        <line x1="158" y1="18" x2="158" y2="42" strokeWidth="4" />
      </g>
      {on(1) && <circle className="hm-part" cx="158" cy="62" r="19" {...stroke} />}
      {on(2) && (
        <g className="hm-part">
          <ellipse cx="158" cy="44" rx="34" ry="7" fill={C.accent} />
          <path d="M141 44 q2 -20 17 -20 q15 0 17 20 z" fill={C.accent2} />
        </g>
      )}
      {on(3) && <line className="hm-part" x1="158" y1="81" x2="158" y2="150" {...stroke} />}
      {on(4) && <line className="hm-part" x1="158" y1="98" x2="128" y2="126" {...stroke} />}
      {on(5) && <line className="hm-part" x1="158" y1="98" x2="188" y2="126" {...stroke} />}
      {on(6) && <line className="hm-part" x1="158" y1="150" x2="133" y2="196" {...stroke} />}
      {on(7) && <line className="hm-part" x1="158" y1="150" x2="183" y2="196" {...stroke} />}
    </svg>
  );
}

function Anim() {
  return (
    <style>{`
      @keyframes hmPart { from { opacity: 0; transform: scale(.6) } to { opacity: 1; transform: none } }
      @keyframes hmPop { from { opacity: 0; transform: scale(.85) } to { opacity: 1; transform: none } }
      @keyframes hmRise { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }
      .hm-part { animation: hmPart .3s ease-out both; transform-origin: 158px 120px; }
      .hm-pop { animation: hmPop .45s cubic-bezier(.2,.8,.3,1) both; }
      .hm-rise { animation: hmRise .4s cubic-bezier(.2,.8,.3,1) both; }
      @media (prefers-reduced-motion: reduce) { .hm-part, .hm-pop, .hm-rise { animation: none !important } }
    `}</style>
  );
}
