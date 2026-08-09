import { useState, useCallback, useMemo } from 'react';
import { C } from '../shared/theme.js';
import { rand } from '../shared/utils.js';
import { Btn, Centered, hStyle, pStyle } from '../shared/ui.jsx';

/* ============================= WAVELENGTH ============================= */
const SPECTRA = [
  ["Cold", "Hot"], ["Cheap", "Expensive"], ["Quiet", "Loud"], ["Weird", "Normal"],
  ["Underrated", "Overrated"], ["Villain", "Hero"], ["Old-fashioned", "Modern"], ["Useless", "Useful"],
  ["Scary", "Comforting"], ["Casual", "Formal"], ["Common", "Rare"], ["Round", "Pointy"],
  ["Boring", "Exciting"], ["Dry", "Wet"], ["Simple", "Complicated"], ["Fantasy", "Sci-fi"],
  ["Unhealthy", "Healthy"], ["Temporary", "Permanent"], ["Guilty pleasure", "Respectable"], ["Slow", "Fast"],
];
const BAND_WIDTHS = [4, 3, 2, 1, 2, 3, 4]; // maps to score 2,3,4,(bullseye5),4,3,2 relative bands
export default function Wavelength() {
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

  const scoreForGuess = (g, t) => { const d = Math.abs(g - t);
    if (d <= 3) return 4; if (d <= 8) return 3; if (d <= 15) return 2; return 0; };

  const doReveal = () => {
    const s = scoreForGuess(guess, target); setLastScore(s);
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
      <h2 style={hStyle}>Wavelength</h2>
      <p style={pStyle}>Pass-and-play for 2. One player sees a hidden target on a spectrum and gives a one-word clue. The other slides the dial to guess where it landed. Closer = more points. Six rounds, take turns.</p>
      <Btn onClick={() => { setRound(1); setTotalP1(0); setTotalP2(0); newRound(); }}>Start</Btn>
    </Centered>
  );

  return (
    <Centered>
      <div style={{ display: "flex", gap: 18, fontSize: 13, color: C.dim, marginBottom: 4 }}>
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
          <p style={pStyle}>P1: {totalP1} &nbsp;\u2022&nbsp; P2: {totalP2}</p>
          <Btn onClick={() => { setRound(1); setTotalP1(0); setTotalP2(0); newRound(); }}>Play again</Btn>
        </>
      )}
    </Centered>
  );
}

function Dial({ left, right, value, onChange, showTarget, target, bands, readOnly }) {
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
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={C.accent} strokeWidth="5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="12" fill={C.accent} />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, color: C.dim, marginTop: -6 }}>
        <span>{left}</span><span>{right}</span>
      </div>
      {!readOnly && <input type="range" min="0" max="100" value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ width: "100%", marginTop: 10, accentColor: C.accent }} />}
    </div>
  );
}
