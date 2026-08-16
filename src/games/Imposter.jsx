import { useState, useEffect, useRef } from 'react';
import { C } from '../shared/theme.js';
import { rand, shuffle } from '../shared/utils.js';
import { Btn, TileBtn, Centered, hStyle, pStyle } from '../shared/ui.jsx';
import { CATEGORIES, maxImposters, MIN_PLAYERS, MAX_PLAYERS } from '../data/imposterWords.js';
import { sfx } from '../shared/sound.js';

/* ============================= IMPOSTER =============================
   Pass-and-play social deduction for 3-10. Everyone gets the same secret
   word except the imposter(s), who only learn that they are the imposter.
   One device is handed around: each player opens their own card in a
   full-screen overlay so nobody else sees it. */

const labelStyle = { fontSize: "0.75rem", letterSpacing: ".18em", textTransform: "uppercase", color: C.dim, fontWeight: 700 };
const cardShell = {
  position: "relative", width: "min(92vw, 420px)", minHeight: 320, borderRadius: 22, overflow: "hidden",
  background: C.panel, display: "grid", placeItems: "center", padding: 28, fontFamily: "inherit", color: C.text,
  boxShadow: "0 26px 60px rgba(74,53,36,.3)",
};

export default function Imposter() {
  const [phase, setPhase] = useState("setup");           // setup | reveal | brief | results
  const [players, setPlayers] = useState([
    { id: 1, name: "Player 1" }, { id: 2, name: "Player 2" }, { id: 3, name: "Player 3" },
  ]);
  const [imposterCount, setImposterCount] = useState(1);
  const [cats, setCats] = useState(() => CATEGORIES.map((c) => c.key));
  const [showCatToImposter, setShowCatToImposter] = useState(true);   // on by default
  const [round, setRound] = useState(null);
  const [seen, setSeen] = useState([]);                  // ids that have viewed their card
  const [open, setOpen] = useState(null);                // { id, shown }
  const nextId = useRef(4);

  const cap = maxImposters(players.length);
  // Shrinking the group can strand an imposter count that is no longer legal.
  useEffect(() => { setImposterCount((n) => Math.min(n, maxImposters(players.length))); }, [players.length]);

  const nameOf = (p, i) => (p.name.trim() || `Player ${i + 1}`);

  const addPlayer = () => setPlayers((p) => p.length >= MAX_PLAYERS ? p
    : [...p, { id: nextId.current++, name: `Player ${p.length + 1}` }]);
  const removePlayer = (id) => setPlayers((p) => p.length <= MIN_PLAYERS ? p : p.filter((x) => x.id !== id));
  const renamePlayer = (id, name) => setPlayers((p) => p.map((x) => (x.id === id ? { ...x, name } : x)));
  const toggleCat = (key) => setCats((cs) =>
    cs.includes(key) ? (cs.length > 1 ? cs.filter((k) => k !== key) : cs) : [...cs, key]);

  const deal = () => {
    const catKey = cats[rand(cats.length)];
    const cat = CATEGORIES.find((c) => c.key === catKey);
    const word = cat.words[rand(cat.words.length)];
    const imposters = shuffle(players.map((p) => p.id)).slice(0, imposterCount);
    const starter = players[rand(players.length)].id;
    setRound({ catKey, catName: cat.name, word, imposters, starter });
    setSeen([]); setOpen(null); setPhase("reveal");
  };

  const finishCard = () => { setSeen((s) => [...s, open.id]); setOpen(null); };

  /* ---------------- setup ---------------- */
  if (phase === "setup") return (
    <Centered>
      <Style />
      <h2 style={hStyle}>Imposter</h2>
      <p style={pStyle}>
        Everyone sees the same secret word — except the imposter. Take turns saying one related
        word out loud, then work out who is faking it.
      </p>

      <div style={{ width: "100%", maxWidth: 460, textAlign: "left" }}>
        <div style={{ ...labelStyle, marginBottom: 8 }}>Players ({players.length})</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
          {players.map((p, i) => (
            <div key={p.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ width: 22, color: C.dim, fontSize: "0.8125rem", fontWeight: 700 }}>{i + 1}</span>
              <input value={p.name} onChange={(e) => renamePlayer(p.id, e.target.value)}
                placeholder={`Player ${i + 1}`} maxLength={18}
                style={{ flex: 1, minWidth: 0, padding: "10px 14px", fontSize: "0.9375rem", fontFamily: "inherit",
                  color: C.text, background: "#fff", border: `2px solid ${C.line}`, borderRadius: 10, outlineColor: C.accent }} />
              <button onClick={() => removePlayer(p.id)} disabled={players.length <= MIN_PLAYERS}
                aria-label={`Remove ${nameOf(p, i)}`}
                style={{ width: 36, height: 36, borderRadius: 9, cursor: players.length <= MIN_PLAYERS ? "default" : "pointer",
                  border: `1px solid ${C.line}`, background: "transparent", color: C.dim, fontSize: "1.125rem", lineHeight: 1,
                  opacity: players.length <= MIN_PLAYERS ? .35 : 1 }}>&minus;</button>
            </div>
          ))}
        </div>
        <Btn variant="ghost" onClick={addPlayer} disabled={players.length >= MAX_PLAYERS}
          style={{ opacity: players.length >= MAX_PLAYERS ? .5 : 1, marginBottom: 24 }}>+ Add player</Btn>

        <div style={{ ...labelStyle, marginBottom: 8 }}>Imposters</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
          {Array.from({ length: cap }).map((_, i) => (
            <Btn key={i} variant={imposterCount === i + 1 ? "primary" : "ghost"} onClick={() => setImposterCount(i + 1)}
              style={{ padding: "8px 20px", fontSize: "0.875rem" }}>{i + 1}</Btn>
          ))}
        </div>
        <p style={{ ...pStyle, fontSize: "0.8125rem", marginBottom: 24 }}>
          {players.length} players allows {cap === 1 ? "1 imposter" : `up to ${cap} imposters`}.
        </p>

        <div style={{ ...labelStyle, marginBottom: 8 }}>Categories</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
          {CATEGORIES.map((c) => {
            const on = cats.includes(c.key);
            return (
              <button key={c.key} onClick={() => toggleCat(c.key)}
                style={{ padding: "9px 16px", borderRadius: 20, cursor: "pointer", fontFamily: "inherit", fontSize: "0.875rem", fontWeight: 700,
                  background: on ? C.accent : "transparent", color: on ? "#fff" : C.dim,
                  border: `1px solid ${on ? C.accent : C.line}`, transition: "background .15s, color .15s" }}>
                {c.name}
              </button>
            );
          })}
        </div>

        <div style={{ ...labelStyle, marginBottom: 8 }}>Show the category to the imposter</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <Btn variant={showCatToImposter ? "primary" : "ghost"} onClick={() => setShowCatToImposter(true)}
            style={{ padding: "8px 20px", fontSize: "0.875rem" }}>On</Btn>
          <Btn variant={!showCatToImposter ? "primary" : "ghost"} onClick={() => setShowCatToImposter(false)}
            style={{ padding: "8px 20px", fontSize: "0.875rem" }}>Off</Btn>
        </div>
        <p style={{ ...pStyle, fontSize: "0.8125rem", marginBottom: 26 }}>
          {showCatToImposter
            ? "The imposter is told the category, so they have a fighting chance of blending in."
            : "The imposter goes in blind — much harder for them."}
        </p>
      </div>

      <Btn onClick={deal}>Start game</Btn>
    </Centered>
  );

  /* ---------------- everyone reveals their own card ---------------- */
  if (phase === "reveal") {
    const allSeen = seen.length === players.length;
    return (
      <Centered>
        <Style />
        <h2 style={hStyle}>Pass the device around</h2>
        <p style={pStyle}>Tap your own name, look at your card alone, then hand it to the next player.</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, width: "100%", maxWidth: 520, marginBottom: 18 }}>
          {players.map((p, i) => {
            const done = seen.includes(p.id);
            return (
              <TileBtn key={p.id} onClick={() => !done && setOpen({ id: p.id, shown: false })} disabled={done}
                style={{ padding: "18px 12px", fontSize: "1rem", fontWeight: 700, opacity: done ? .55 : 1,
                  background: done ? C.panel2 : C.panel, border: `2px solid ${done ? C.line : "transparent"}` }}>
                {nameOf(p, i)}{done ? "  ✓" : ""}
              </TileBtn>
            );
          })}
        </div>

        <p style={{ ...pStyle, marginBottom: 14 }}>{seen.length} of {players.length} have seen their card.</p>
        {allSeen && <Btn onClick={() => setPhase("brief")}>Everyone's ready</Btn>}

        {open && (() => {
          const i = players.findIndex((p) => p.id === open.id);
          const p = players[i];
          const isImp = round.imposters.includes(p.id);
          const seesCat = !isImp || showCatToImposter;
          return (
            <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(255,255,255,.98)", display: "grid", placeItems: "center", padding: 20 }}>
              {!open.shown ? (
                <button className="imp-in" onClick={() => { sfx.reveal(); setOpen((o) => ({ ...o, shown: true })); }}
                  style={{ ...cardShell, cursor: "pointer", border: `2px dashed ${C.line}` }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                    <div style={labelStyle}>{nameOf(p, i)}</div>
                    <div style={{ fontFamily: "var(--font-head)", fontSize: "2.125rem", fontWeight: 700 }}>Tap to reveal</div>
                    <div style={{ fontSize: "0.84375rem", color: C.dim, maxWidth: 260, lineHeight: 1.5 }}>
                      Make sure nobody else can see the screen.
                    </div>
                  </div>
                </button>
              ) : (
                <div className="imp-in" style={{ ...cardShell, border: `2px solid ${isImp ? C.danger : C.line}` }}>
                  <div className={isImp ? "imp-flash-imp" : "imp-flash-crew"} aria-hidden="true"
                    style={{ position: "absolute", inset: 0, pointerEvents: "none", background: isImp ? C.danger : "#f6dfae" }} />
                  <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
                    <div style={{ ...labelStyle, color: isImp ? C.danger : C.dim }}>
                      {seesCat ? round.catName : "Category hidden"}
                    </div>
                    {isImp ? (
                      <div style={{ fontFamily: "var(--font-head)", fontSize: "2.875rem", fontWeight: 700, color: C.danger }}>Imposter</div>
                    ) : (
                      <div style={{ fontFamily: "var(--font-head)", fontSize: "2.5rem", fontWeight: 700, lineHeight: 1.15 }}>{round.word}</div>
                    )}
                    <p style={{ fontSize: "0.875rem", color: C.dim, lineHeight: 1.55, maxWidth: 280, margin: 0 }}>
                      {isImp
                        ? "You don't know the word. Give a clue vague enough to pass, specific enough to look real."
                        : "Give a one-word clue about this. Don't say the word itself."}
                    </p>
                    <Btn onClick={finishCard} style={{ marginTop: 4 }}>Done</Btn>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </Centered>
    );
  }

  /* ---------------- who starts ---------------- */
  if (phase === "brief") {
    const si = players.findIndex((p) => p.id === round.starter);
    return (
      <Centered>
        <Style />
        <div style={{ ...labelStyle, marginBottom: 10 }}>First clue</div>
        <h2 className="imp-in" style={{ ...hStyle, fontSize: "2.5rem", marginBottom: 14 }}>{nameOf(players[si], si)}</h2>
        <p style={pStyle}>
          {nameOf(players[si], si)} gives the first clue, then carry on clockwise. One word each,
          no repeats. After a full lap, argue it out and vote.
        </p>
        <Btn onClick={() => setPhase("results")}>Reveal results</Btn>
      </Centered>
    );
  }

  /* ---------------- the reveal ---------------- */
  const impostors = players.map((p, i) => ({ p, i })).filter(({ p }) => round.imposters.includes(p.id));
  return (
    <Centered>
      <Style />
      <div style={{ ...labelStyle, marginBottom: 10 }}>{round.catName}</div>
      <div className="imp-word" style={{ fontFamily: "var(--font-head)", fontSize: "3rem", fontWeight: 700, marginBottom: 26, lineHeight: 1.1 }}>
        {round.word}
      </div>

      <div style={{ ...labelStyle, marginBottom: 12 }}>{impostors.length === 1 ? "The imposter was" : "The imposters were"}</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginBottom: 30 }}>
        {impostors.map(({ p, i }, n) => (
          <div key={p.id} className="imp-rise"
            style={{ animationDelay: `${0.12 + n * 0.14}s`, padding: "14px 26px", borderRadius: 14, fontSize: "1.25rem", fontWeight: 800,
              color: "#fff", background: C.danger, boxShadow: `0 10px 26px ${C.danger}55` }}>
            {nameOf(p, i)}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        <Btn onClick={deal}>New round</Btn>
        <Btn variant="subtle" onClick={() => setPhase("setup")}>Change setup</Btn>
      </div>
    </Centered>
  );
}

/* Card and reveal animations. The imposter flash is slower and softer than the
   crew one so it lands as a warning rather than a jump-scare. */
function Style() {
  return (
    <style>{`
      @keyframes impIn { from { transform: scale(.86); opacity: 0 } to { transform: scale(1); opacity: 1 } }
      @keyframes impFlashCrew { 0% { opacity: .95 } 45% { opacity: .5 } 100% { opacity: 0 } }
      @keyframes impFlashImp { 0% { opacity: .8 } 30% { opacity: .55 } 100% { opacity: 0 } }
      @keyframes impRise { from { transform: translateY(16px); opacity: 0 } to { transform: none; opacity: 1 } }
      @keyframes impGlow { 0%, 100% { text-shadow: 0 0 0 rgba(181,101,29,0) } 50% { text-shadow: 0 6px 30px rgba(181,101,29,.45) } }
      .imp-in { animation: impIn .34s cubic-bezier(.2,.8,.3,1) both; }
      .imp-flash-crew { animation: impFlashCrew .55s ease-out forwards; }
      .imp-flash-imp { animation: impFlashImp 1s ease-out forwards; }
      .imp-rise { animation: impRise .45s cubic-bezier(.2,.8,.3,1) both; }
      .imp-word { animation: impIn .5s cubic-bezier(.2,.8,.3,1) both, impGlow 2.4s ease-in-out .5s infinite; }
      @media (prefers-reduced-motion: reduce) {
        .imp-in, .imp-flash-crew, .imp-flash-imp, .imp-rise, .imp-word { animation: none !important; }
      }
    `}</style>
  );
}
