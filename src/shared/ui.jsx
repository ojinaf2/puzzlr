import { useState } from 'react';
import { C } from './theme.js';

/* ============================= SHARED UI ============================= */
export function Btn({ children, onClick, variant = "primary", style = {}, ...p }) {
  const base = { border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "filter .15s" };
  const styles = {
    primary: { background: C.accent, color: "#fff", padding: "11px 24px", fontSize: 15 },
    ghost: { background: C.panel2, color: C.text, padding: "10px 20px", fontSize: 14 },
    subtle: { background: "transparent", color: C.dim, padding: "8px 14px", fontSize: 13, border: `1px solid ${C.line}` },
  };
  return <button onClick={onClick} style={{ ...base, ...styles[variant], ...style }} onMouseDown={(e)=>e.currentTarget.style.filter="brightness(.9)"} onMouseUp={(e)=>e.currentTarget.style.filter="none"} onMouseLeave={(e)=>e.currentTarget.style.filter="none"} {...p}>{children}</button>;
}

// Reusable stylish tile: rounded, soft shadow, subtle hover-lift. Used for answer choices.
export function TileBtn({ children, onClick, disabled, noPad, style = {} }) {
  const [hover, setHover] = useState(false);
  const lift = hover && !disabled;
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        borderRadius: 14, cursor: disabled ? "default" : "pointer", fontFamily: "inherit",
        color: C.text, transition: "transform .13s ease, box-shadow .13s ease, background .2s",
        transform: lift ? "translateY(-3px)" : "none",
        boxShadow: lift ? "0 10px 22px rgba(74,53,36,.2)" : "0 3px 10px rgba(74,53,36,.12)",
        ...(noPad ? {} : { background: C.panel, border: "2px solid transparent" }),
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
