import { useState } from 'react';
import { C, SHADOW, GLOSS, GLOSS_SOFT, grad, paleGrad, EASE } from './theme.js';
import { soundOn, setSoundOn } from './sound.js';

/* ============================= SHARED UI =============================
   Buttons are built from three things stacked: a vertical gradient so the face
   is lit from above, an inset white line along the top edge so it reads as
   convex, and two drop shadows so it sits above the page rather than on it.
   The press itself lives in CSS (`.btn3d:active` in Puzzlr.jsx) rather than in
   JS handlers, because :active is the only version that behaves correctly for
   a finger as well as a mouse. */
export function Btn({ children, onClick, variant = "primary", style = {}, ...p }) {
  const base = {
    border: "none", borderRadius: 12, fontWeight: 700, cursor: "pointer",
    fontFamily: "inherit", position: "relative",
    transition: `transform .18s ${EASE}, box-shadow .18s ${EASE}, filter .18s ${EASE}`,
  };
  const styles = {
    primary: {
      background: grad(C.accent), color: "#fff", padding: "12px 26px", fontSize: "0.9375rem",
      boxShadow: `${GLOSS}, ${SHADOW.md}`, textShadow: "0 1px 1px rgba(74,53,36,.28)",
    },
    ghost: {
      background: paleGrad(C.panel2), color: C.text, padding: "11px 22px", fontSize: "0.875rem",
      boxShadow: `${GLOSS_SOFT}, ${SHADOW.sm}`,
    },
    // Tertiary: deliberately flat. If everything is lifted, nothing reads as lifted.
    subtle: {
      background: "transparent", color: C.dim, padding: "9px 16px", fontSize: "0.8125rem",
      border: `1px solid ${C.line}`, borderRadius: 11,
    },
  };
  return (
    <button className={variant === "subtle" ? "btn-flat" : "btn3d"} onClick={onClick}
      style={{ ...base, ...styles[variant], ...style }} {...p}>
      {children}
    </button>
  );
}

// Reusable stylish tile: rounded, soft shadow, subtle hover-lift. Used for answer choices.
export function TileBtn({ children, onClick, disabled, noPad, style = {} }) {
  const [hover, setHover] = useState(false);
  const lift = hover && !disabled;
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className={disabled ? undefined : "tile3d"}
      style={{
        borderRadius: 16, cursor: disabled ? "default" : "pointer", fontFamily: "inherit",
        color: C.text, transition: `transform .2s ${EASE}, box-shadow .2s ${EASE}`,
        transform: lift ? "translateY(-3px)" : "none",
        boxShadow: lift ? `${GLOSS_SOFT}, ${SHADOW.lg}` : `${GLOSS_SOFT}, ${SHADOW.sm}`,
        ...(noPad ? {} : { background: paleGrad(C.panel), border: "2px solid transparent" }),
        ...style,
      }}>
      {children}
    </button>
  );
}

/* Sound is a property of the site rather than of one game, so the switch lives
   in the header next to the theme toggle and looks like it — one control, in
   the same place, whichever game you are in. */
export function SoundToggle() {
  const [on, setOn] = useState(soundOn);
  return (
    <button onClick={() => { const next = !on; setOn(next); setSoundOn(next); }}
      className="btn3d" aria-pressed={on}
      aria-label={on ? "Turn sound off" : "Turn sound on"}
      title={on ? "Sound on" : "Sound off"}
      style={{
        width: 38, height: 38, borderRadius: 12, border: "none", padding: 0, flexShrink: 0,
        cursor: "pointer", color: on ? C.text : C.dim, background: paleGrad(C.panel2),
        boxShadow: `${GLOSS_SOFT}, ${SHADOW.sm}`, display: "grid", placeItems: "center",
      }}>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 9v6h4l5 4V5L8 9H4z" />
        {on
          ? <><path d="M16.5 8.5a5 5 0 0 1 0 7" /><path d="M19 6a8.5 8.5 0 0 1 0 12" opacity=".6" /></>
          : <path d="M17 9.5l4 5M21 9.5l-4 5" opacity=".8" />}
      </svg>
    </button>
  );
}

/* ============================= TABS =============================
   One strip, used by every game that has more than one way to play. It exists
   because there are now three callers — the daily switch, the online switch
   and the leaderboard — and three hand-rolled copies of the same row of pills
   would drift apart the first time one of them was adjusted.

   The scroll matters. Wordl Unlimited's strip is four tabs wide, which does
   not fit across a small phone, and a strip that wraps to two lines reads as
   two separate controls. Scrolling sideways keeps it one object; the bar
   itself is hidden because a scrollbar under four pills looks like a mistake.

   `items` are { key, label, active, onClick, suffix }. */
export function Tabs({ items, style = {} }) {
  return (
    <div className="tabstrip" role="tablist" style={{
      display: "flex", gap: 4, background: C.panel, border: `1px solid ${C.line}`,
      borderRadius: 9, padding: 4, marginBottom: 14,
      maxWidth: "100%", overflowX: "auto", ...style,
    }}>
      {items.filter(Boolean).map(({ key, label, active, onClick, suffix }) => (
        <button key={key} onClick={active ? undefined : onClick} role="tab" aria-selected={!!active}
          style={{
            background: active ? C.accent : "transparent", color: active ? "#fff" : C.dim,
            border: "none", borderRadius: 7, padding: "7px 18px", fontSize: "0.84375rem",
            fontWeight: 700, fontFamily: "inherit", cursor: active ? "default" : "pointer",
            flexShrink: 0, whiteSpace: "nowrap",
            transition: `background .15s ${EASE}, color .15s ${EASE}`,
          }}>
          {label}{!active && suffix ? suffix : ""}
        </button>
      ))}
    </div>
  );
}

/* ============================= small layout helpers ============================= */
export function Centered({ children }) { return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", width: "100%" }}>{children}</div>; }
export const hStyle = { fontFamily: "var(--font-head)", fontSize: "1.75rem", fontWeight: 700, margin: "0 0 8px" };
export const pStyle = { color: C.dim, fontSize: "0.90625rem", lineHeight: 1.6, maxWidth: 440, margin: "0 0 18px" };
