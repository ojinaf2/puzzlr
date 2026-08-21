import { useState, useCallback, useMemo } from 'react';
import { C } from '../shared/theme.js';
import { rand } from '../shared/utils.js';
import { Btn, Centered, hStyle, pStyle } from '../shared/ui.jsx';
import { SPECTRA, scoreForGuess as sharedScore } from '../data/spectra.js';
import { makeRoomCode } from '../shared/router.js';
import { RoomStatus, lobbyView, InviteLink, OnlineEntry, PlayTabs } from '../shared/online.jsx';
import { useRoom } from '../shared/useRoom.js';
import { savedName } from '../shared/identity.js';
import { sfx } from '../shared/sound.js';

/* ============================= WAVELENGTH ============================= */
/* The floor is one clue each; the rest are simply longer games. Capped at
   the server's own limit of twenty. */
const roundChoices = (players) => {
  const out = [];
  for (let n = players; n <= 20 && out.length < 6; n += (n < players + 3 ? 1 : 2)) out.push(n);
  return out;
};

export default function Wavelength({ roomCode, mode, navigate }) {
  /* The host/join screen is a route, not component state, so a refresh
     while choosing keeps you on it instead of dropping back to the local
     game. */
  if (roomCode) return <OnlineWavelength roomCode={roomCode} navigate={navigate} />;
  if (mode === 'online') {
    return <OnlineEntry gameId="wavelength" gameName="Wavelength" navigate={navigate}
      onCancel={() => navigate('wavelength')} />;
  }
  return <LocalWavelength navigate={navigate} onOnline={() => navigate('wavelength', 'online')} />;
}

function LocalWavelength({ navigate, onOnline }) {
  const [phase, setPhase] = useState("intro"); // intro, clue, guess, reveal
  const [spectrum, setSpectrum] = useState(SPECTRA[0]);
  const [target, setTarget] = useState(50);
  const [guess, setGuess] = useState(50);
  const [totalP1, setTotalP1] = useState(0);
  const [totalP2, setTotalP2] = useState(0);
  const [round, setRound] = useState(1);
  const [lastScore, setLastScore] = useState(0);
  const activePlayer = round % 2 === 1 ? 1 : 2; // player giving clue this round

  const newRound = useCallback(() => {
    setSpectrum(SPECTRA[rand(SPECTRA.length)]);
    setTarget(8 + rand(85)); setGuess(50); setPhase("clue");
  }, []);

  const scoreForGuess = sharedScore;   // same numbers the room server uses

  const doReveal = () => {
    const s = scoreForGuess(guess, target); setLastScore(s);
    // Landing in a band or missing entirely is the whole result of a round.
    if (s > 0) sfx.good(); else sfx.bad();
    if (activePlayer === 1) setTotalP2((v) => v + s); else setTotalP1((v) => v + s);
    setPhase("reveal");
  };

  // Band segments centered on target for the reveal dial
  const bands = useMemo(() => {
    const segs = []; const centers = [[-15,-8,C.gold,2],[-8,-3,C.danger,3],[-3,3,C.accent2,4],[3,8,C.danger,3],[8,15,C.gold,2]];
    for (const [lo, hi, col, pts] of centers) segs.push({ lo: Math.max(0, target + lo), hi: Math.min(100, target + hi), col, pts });
    return segs;
  }, [target]);

  if (phase === "intro") return (
    <Centered>
      <PlayTabs localLabel="Same device" localPeople={2} onOnline={onOnline} />
      <h2 style={hStyle}>Wavelength</h2>
      <p style={pStyle}>Players split into teams to read each other's minds by guessing where a hidden target lies on a physical or digital spectrum based on a single conceptual clue.</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        <Btn onClick={() => { setRound(1); setTotalP1(0); setTotalP2(0); newRound(); }}>Start</Btn>
      </div>
    </Centered>
  );

  return (
    <Centered>
      <div style={{ display: "flex", gap: 18, fontSize: "0.8125rem", color: C.dim, marginBottom: 4 }}>
        <span style={{ color: activePlayer===1?C.accent:C.dim, fontWeight: activePlayer===1?800:400 }}>P1: {totalP1}</span>
        <span>Round {round} / 6</span>
        <span style={{ color: activePlayer===2?C.accent:C.dim, fontWeight: activePlayer===2?800:400 }}>P2: {totalP2}</span>
      </div>

      {phase === "clue" && (
        <>
          <p style={pStyle}><b style={{color:C.accent}}>Player {activePlayer}</b>, look at the dial (others look away). Then give a one-word clue and hand the device over.</p>
          <Dial left={spectrum[0]} right={spectrum[1]} showTarget target={target} value={target} onChange={() => {}} readOnly />
          <Btn onClick={() => setPhase("guess")} style={{ marginTop: 14 }}>Clue given, pass device</Btn>
        </>
      )}
      {phase === "guess" && (
        <>
          <p style={pStyle}>Other player: slide to where you think the target is, using the clue.</p>
          <Dial left={spectrum[0]} right={spectrum[1]} value={guess} onChange={setGuess} />
          <Btn onClick={doReveal} style={{ marginTop: 14 }}>Lock in guess</Btn>
        </>
      )}
      {phase === "reveal" && (
        <>
          <p style={pStyle}>{lastScore > 0 ? `+${lastScore} points!` : "Missed the zone — 0 points."} Target was at {target}.</p>
          <Dial left={spectrum[0]} right={spectrum[1]} value={guess} showTarget target={target} bands={bands} readOnly />
          <Btn onClick={() => { if (round >= 6) setPhase("done"); else { setRound((r) => r + 1); newRound(); } }} style={{ marginTop: 14 }}>
            {round >= 6 ? "See result" : "Next round"}
          </Btn>
        </>
      )}
      {phase === "done" && (
        <>
          <h2 style={hStyle}>{totalP1 === totalP2 ? "It's a tie!" : `Player ${totalP1 > totalP2 ? 1 : 2} wins!`}</h2>
          <p style={pStyle}>P1: {totalP1} &nbsp;•&nbsp; P2: {totalP2}</p>
          <Btn onClick={() => { setRound(1); setTotalP1(0); setTotalP2(0); newRound(); }}>Play again</Btn>
        </>
      )}
    </Centered>
  );
}

/* `markers` plots several dials at once, which is how the reveal shows where
   everybody landed. Each is { value, label }. */
function Dial({ left, right, value, onChange, showTarget, target, bands, readOnly, markers }) {
  const W = 440, H = 230, cx = W / 2, cy = H - 20, R = 180;
  const toXY = (pct, r = R) => { const ang = Math.PI - (pct / 100) * Math.PI; return [cx + r * Math.cos(ang), cy - r * Math.sin(ang)]; };
  const arcPath = (p0, p1, r) => { const [x0,y0]=toXY(p0,r),[x1,y1]=toXY(p1,r); const large = (p1-p0)>50?1:0; return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`; };
  const [nx, ny] = toXY(value, R - 8);

  return (
    <div style={{ width: "100%", maxWidth: W, marginTop: 8 }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
        <path d={arcPath(0, 100, R)} fill="none" stroke={C.panel2} strokeWidth="34" strokeLinecap="round" />
        {bands && bands.map((b, i) => <path key={i} d={arcPath(b.lo, b.hi, R)} fill="none" stroke={b.col} strokeWidth="34" />)}
        {showTarget && !bands && (() => { const [tx, ty] = toXY(target); return <path d={arcPath(Math.max(0,target-3), Math.min(100,target+3), R)} fill="none" stroke={C.accent2} strokeWidth="34" />; })()}
        {showTarget && (() => { const [tx, ty] = toXY(target, R + 22); const [bx, by] = toXY(target, R - 20);
          return <line x1={bx} y1={by} x2={tx} y2={ty} stroke={C.text} strokeWidth="2" strokeDasharray="4 3" />; })()}
        {markers ? markers.map((m, i) => {
          const [mx, my] = toXY(m.value, R - 8);
          const [lx, ly] = toXY(m.value, R + 16);
          return (
            <g key={i}>
              <line x1={cx} y1={cy} x2={mx} y2={my} stroke={C.accent} strokeWidth="3" strokeLinecap="round" opacity=".75" />
              <circle cx={mx} cy={my} r="7" fill={C.accent} />
              <text x={lx} y={ly} textAnchor="middle" fontSize="13" fontWeight="700" fill={C.text}>{m.label}</text>
            </g>
          );
        }) : (
          <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={C.accent} strokeWidth="5" strokeLinecap="round" />
        )}
        <circle cx={cx} cy={cy} r="12" fill={C.accent} />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", fontWeight: 700, color: C.dim, marginTop: -6 }}>
        <span>{left}</span><span>{right}</span>
      </div>
      {!readOnly && <input type="range" min="0" max="100" value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ width: "100%", marginTop: 10, accentColor: C.accent }} />}
    </div>
  );
}

/* ============================= ONLINE WAVELENGTH =============================
   Everyone takes a turn giving the clue. Only the clue-giver sees the target;
   the rest slide their own dial, hidden from each other until the reveal. Each
   guesser scores on how close they land and the clue-giver takes all of those
   points added together. */

const capStyle = { fontSize: "0.75rem", letterSpacing: ".18em", textTransform: "uppercase", color: C.dim, fontWeight: 700 };

function Scoreboard({ room, g, playerId }) {
  const rows = [...room.players].sort((a, b) => (g.scores[b.id] ?? 0) - (g.scores[a.id] ?? 0));
  return (
    <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
      {rows.map((p) => (
        <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "9px 14px", borderRadius: 10,
          background: p.id === g.giverId ? C.panel2 : C.panel, fontSize: "0.875rem" }}>
          <span style={{ fontWeight: 700 }}>
            {p.name}{p.id === playerId ? ' (you)' : ''}
            {p.id === g.giverId ? ' — clue' : ''}
            {!p.connected ? ' ·' : ''}
          </span>
          <span style={{ display: "flex", gap: 10 }}>
            {g.roundPoints?.[p.id] !== undefined && g.phase === 'reveal' &&
              <span style={{ color: C.correct, fontWeight: 700 }}>+{g.roundPoints[p.id]}</span>}
            <b style={{ color: C.accent2 }}>{g.scores[p.id] ?? 0}</b>
          </span>
        </div>
      ))}
    </div>
  );
}

function OnlineWavelength({ roomCode, navigate }) {
  const [name, setName] = useState(() => savedName());
  const { status, room, me, playerId, error, send } = useRoom({ gameId: 'wavelength', roomCode, name });
  const [clueDraft, setClueDraft] = useState("");
  const [dial, setDial] = useState(50);

  const lobby = lobbyView({ status, room, me, roomCode, gameId: 'wavelength', navigate, name, onName: setName, send, skipLobby: true });
  if (lobby) return lobby;

  const g = room.game;
  const isHost = room.hostId === playerId;

  /* ------------------------------- lobby ------------------------------- */
  if (room.status === 'lobby') {
    return (
      <Centered>
        <h2 style={hStyle}>Wavelength</h2>
        <p style={pStyle}>
          Everyone takes a turn giving a one-word clue for a target only they can see.
          The closer people land, the more you all score.
        </p>
        <InviteLink gameId="wavelength" roomCode={roomCode} visibility={room?.visibility}
          onVisibility={me && room?.hostId === me.id ? (v) => send({ type: 'visibility', visibility: v }) : undefined} />

        <div style={{ ...capStyle, marginTop: 24, marginBottom: 10 }}>In the room ({room.players.length}/7)</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 18, maxWidth: 400 }}>
          {room.players.map((p) => (
            <span key={p.id} style={{ background: C.panel, borderRadius: 20, padding: "6px 14px", fontSize: "0.875rem", fontWeight: 700 }}>
              {p.name}{p.id === room.hostId ? ' ★' : ''}
            </span>
          ))}
        </div>
        {/* The floor is one clue each, so nobody misses their turn at the good
            half of the game. Above that the host can make it as long as
            they like. */}
        {isHost && room.players.length >= 2 && (
          <div style={{ width: "100%", maxWidth: 380, marginBottom: 16 }}>
            <div style={{ ...capStyle, marginBottom: 8 }}>Rounds</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
              {roundChoices(room.players.length).map((n) => {
                const on = (g.chosenRounds ?? room.players.length) === n;
                return (
                  <button key={n} onClick={() => send({ type: 'config', rounds: n })}
                    style={{
                      minWidth: 46, padding: "8px 12px", borderRadius: 9, border: "none",
                      cursor: "pointer", fontFamily: "inherit", fontSize: "0.875rem", fontWeight: 700,
                      background: on ? C.accent : C.panel, color: on ? "#fff" : C.text,
                    }}>{n}</button>
                );
              })}
            </div>
            <p style={{ ...pStyle, fontSize: "0.75rem", margin: "8px auto 0" }}>
              At least {room.players.length}, so everyone gives a clue.
            </p>
          </div>
        )}

        <p style={{ ...pStyle, fontSize: "0.8125rem" }}>
          {room.players.length < 2
            ? 'Waiting for at least one more player.'
            : `${g.chosenRounds ?? room.players.length} rounds, clue-giving takes turns.`}
        </p>
        {isHost
          ? <Btn disabled={room.players.length < 2} style={{ opacity: room.players.length < 2 ? .5 : 1 }}
              onClick={() => send({ type: 'start' })}>Start game</Btn>
          : <div style={{ fontSize: "0.875rem", color: C.dim }}>Waiting for the host to start…</div>}
        <Btn variant="subtle" style={{ marginTop: 16 }} onClick={() => navigate('wavelength')}>Leave room</Btn>
      </Centered>
    );
  }

  const giver = room.players.find((p) => p.id === g.giverId);
  const iAmGiver = g.giverId === playerId;
  const guessers = room.players.filter((p) => p.id !== g.giverId);
  const lockedCount = guessers.filter((p) => g.locked?.[p.id]).length;
  const iLocked = !!g.locked?.[playerId];

  /* ------------------------------ finished ------------------------------ */
  if (g.phase === 'done') {
    const ranked = [...room.players].sort((a, b) => (g.scores[b.id] ?? 0) - (g.scores[a.id] ?? 0));
    const top = g.scores[ranked[0].id] ?? 0;
    const winners = ranked.filter((p) => (g.scores[p.id] ?? 0) === top);
    return (
      <Centered>
        <div style={{ ...capStyle, marginBottom: 8 }}>Final</div>
        <h2 style={hStyle}>
          {winners.length > 1 ? "It's a tie!" : winners[0].id === playerId ? 'You win!' : `${winners[0].name} wins`}
        </h2>
        <p style={pStyle}>{g.totalRounds} rounds, everyone gave a clue.</p>
        <Scoreboard room={room} g={g} playerId={playerId} />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          {isHost && <Btn onClick={() => send({ type: 'rematch' })}>Play again</Btn>}
          <Btn variant="subtle" onClick={() => navigate('wavelength')}>Leave room</Btn>
        </div>
      </Centered>
    );
  }

  /* ------------------------------ in play ------------------------------ */
  return (
    <Centered>
      <RoomStatus status={status} error={error} />
      <div style={{ display: "flex", gap: 16, fontSize: "0.8125rem", color: C.dim, marginBottom: 10, flexWrap: "wrap", justifyContent: "center" }}>
        <span>Round {g.round} of {g.totalRounds}</span>
        <span style={{ color: C.accent2, fontWeight: 700 }}>{giver?.name ?? '—'} is giving the clue</span>
      </div>

      {/* A vanished clue-giver would otherwise leave the room waiting forever. */}
      {isHost && giver && !giver.connected && g.phase !== 'reveal' && g.phase !== 'done' && (
        <div style={{ background: C.panel2, borderRadius: 12, padding: "10px 16px", marginBottom: 14, fontSize: "0.84375rem", textAlign: "center", maxWidth: 400 }}>
          {giver.name} has lost connection. Their seat is held for a minute and a half.
          <div style={{ marginTop: 8 }}>
            <Btn variant="ghost" style={{ padding: "7px 16px", fontSize: "0.8125rem" }}
              onClick={() => send({ type: 'move', action: 'skip' })}>Skip this round</Btn>
          </div>
        </div>
      )}

      {/* ---- the clue-giver thinks of a word ---- */}
      {g.phase === 'clue' && (iAmGiver ? (
        <>
          <p style={pStyle}>
            Only you can see the target. Give a one-word clue that points at it — the closer everyone
            lands, the more you score.
          </p>
          <Dial left={g.spectrum[0]} right={g.spectrum[1]} showTarget target={g.target} value={g.target} onChange={() => {}} readOnly />
          {/* A prompt you have no feel for makes a dull round for everyone. The
              target moves with it, so there is nothing to fish for. */}
          <Btn variant="subtle" style={{ marginTop: 12 }}
            onClick={() => send({ type: 'move', action: 'respin' })}>Change prompt</Btn>
          <form onSubmit={(e) => { e.preventDefault(); if (clueDraft.trim()) { send({ type: 'move', action: 'clue', clue: clueDraft }); setClueDraft(""); } }}
            style={{ display: "flex", gap: 10, marginTop: 16, width: "100%", maxWidth: 380, justifyContent: "center", flexWrap: "wrap" }}>
            <input value={clueDraft} onChange={(e) => setClueDraft(e.target.value)} autoFocus maxLength={40}
              placeholder="Your clue" autoComplete="off"
              style={{ flex: "1 1 200px", minWidth: 0, padding: "13px 16px", fontSize: "1rem", fontFamily: "inherit", color: C.text,
                background: C.bg, border: `2px solid ${C.line}`, borderRadius: 12, outlineColor: C.accent, textAlign: "center" }} />
            <Btn type="submit" disabled={!clueDraft.trim()} style={{ opacity: clueDraft.trim() ? 1 : .5 }}>Send clue</Btn>
          </form>
        </>
      ) : (
        <>
          <h2 style={{ ...hStyle, fontSize: "1.625rem" }}>{giver?.name} is thinking…</h2>
          <p style={pStyle}>They can see the target. You will get their clue in a moment.</p>
          <Dial left={g.spectrum[0]} right={g.spectrum[1]} value={50} onChange={() => {}} readOnly />
        </>
      ))}

      {/* ---- everyone else slides a dial ---- */}
      {g.phase === 'guess' && (
        <>
          <div style={{ ...capStyle, marginBottom: 6 }}>The clue</div>
          <div style={{ fontFamily: "var(--font-head)", fontSize: "2.125rem", fontWeight: 700, marginBottom: 14 }}>{g.clue}</div>

          {iAmGiver ? (
            <>
              <p style={pStyle}>Sit tight — {lockedCount} of {guessers.length} have locked in.</p>
              <Dial left={g.spectrum[0]} right={g.spectrum[1]} showTarget target={g.target} value={g.target} onChange={() => {}} readOnly />
            </>
          ) : (
            <>
              <Dial left={g.spectrum[0]} right={g.spectrum[1]}
                value={g.guesses?.[playerId] ?? dial}
                onChange={(v) => { setDial(v); send({ type: 'move', action: 'guess', value: v }); }}
                readOnly={iLocked} />
              <div style={{ marginTop: 14 }}>
                {iLocked
                  ? <span style={{ fontSize: "0.875rem", color: C.dim }}>Locked in — waiting for the others ({lockedCount}/{guessers.length})</span>
                  : <Btn onClick={() => send({ type: 'move', action: 'lock' })}>Lock in guess</Btn>}
              </div>
            </>
          )}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", marginTop: 14 }}>
            {guessers.map((p) => (
              <span key={p.id} style={{ fontSize: "0.75rem", background: g.locked?.[p.id] ? C.panel2 : C.panel,
                borderRadius: 20, padding: "4px 12px", color: g.locked?.[p.id] ? C.text : C.dim }}>
                {p.name}{g.locked?.[p.id] ? ' ✓' : '…'}
              </span>
            ))}
          </div>
        </>
      )}

      {/* ---- everything turned over ---- */}
      {g.phase === 'reveal' && (
        <>
          <div style={{ ...capStyle, marginBottom: 6 }}>The clue was</div>
          <div style={{ fontFamily: "var(--font-head)", fontSize: "1.875rem", fontWeight: 700, marginBottom: 10 }}>{g.clue}</div>
          <Dial left={g.spectrum[0]} right={g.spectrum[1]} showTarget target={g.target} readOnly
            bands={revealBands(g.target)}
            markers={guessers
              .filter((p) => g.guesses?.[p.id] !== undefined)
              .map((p) => ({ value: g.guesses[p.id], label: p.name.slice(0, 6) }))} />
          <p style={{ ...pStyle, marginTop: 16 }}>
            The target was at {g.target}. {giver?.name} scored {g.roundPoints?.[g.giverId] ?? 0} from everyone combined.
          </p>
          <Scoreboard room={room} g={g} playerId={playerId} />
          {(isHost || iAmGiver)
            ? <Btn onClick={() => send({ type: 'move', action: 'next' })}>
                {g.round >= g.totalRounds ? 'See final scores' : 'Next round'}
              </Btn>
            : <div style={{ fontSize: "0.875rem", color: C.dim }}>Waiting for the host…</div>}
        </>
      )}

      <Btn variant="subtle" style={{ marginTop: 18 }} onClick={() => navigate('wavelength')}>Leave room</Btn>
    </Centered>
  );
}

/* The coloured scoring bands around the target, same shape as the local game. */
function revealBands(target) {
  const spans = [[-15,-8,C.gold,2],[-8,-3,C.danger,3],[-3,3,C.accent2,4],[3,8,C.danger,3],[8,15,C.gold,2]];
  return spans.map(([lo, hi, col, pts]) => ({
    lo: Math.max(0, target + lo), hi: Math.min(100, target + hi), col, pts,
  }));
}
