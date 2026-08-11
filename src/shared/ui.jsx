import { useState } from 'react';
import { C, SHADOW, GLOSS, GLOSS_SOFT, grad, paleGrad, EASE } from './theme.js';

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
      background: grad(C.accent), color: "#fff", padding: "12px 26px", fontSize: 15,
      boxShadow: `${GLOSS}, ${SHADOW.md}`, textShadow: "0 1px 1px rgba(74,53,36,.28)",
    },
    ghost: {
      background: paleGrad(C.panel2), color: C.text, padding: "11px 22px", fontSize: 14,
      boxShadow: `${GLOSS_SOFT}, ${SHADOW.sm}`,
    },
    // Tertiary: deliberately flat. If everything is lifted, nothing reads as lifted.
    subtle: {
      background: "transparent", color: C.dim, padding: "9px 16px", fontSize: 13,
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

/* ============================= small layout helpers ============================= */
export function Centered({ children }) { return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", width: "100%" }}>{children}</div>; }
export const hStyle = { fontFamily: "'Times New Roman', Times, serif", fontSize: 28, fontWeight: 700, margin: "0 0 8px" };
export const pStyle = { color: C.dim, fontSize: 14.5, lineHeight: 1.6, maxWidth: 440, margin: "0 0 18px" };
