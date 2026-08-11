/* ============================= THEME =============================
   The one palette every game shares: white background, warm browns and
   terracotta, light tan tiles. Import `C` rather than hard-coding colours. */
export const C = {
  bg: "#ffffff", panel: "#f7ecd9", panel2: "#f0ddc0", line: "#e2cba6",
  text: "#4a3524", dim: "#8a6d52",
  correct: "#6aaa64", present: "#c9973f", absent: "#b79b7e",
  accent: "#b5651d", accent2: "#a0522d", danger: "#c0492f", gold: "#c9973f",
};

/* ---------------------------------------------------------------- depth
   Two shadows, never one. A tight contact shadow says an object is resting on
   the page; a wide ambient one says there is air under it. A single blurry
   shadow just looks smudged, which is the usual reason a "3D" button reads as
   cheap. Both are tinted with the palette's brown rather than black, so they
   sit in the warm background instead of greying it out. */
export const SHADOW = {
  sm: "0 1px 2px rgba(74,53,36,.10), 0 2px 6px rgba(74,53,36,.05)",
  md: "0 2px 4px rgba(74,53,36,.10), 0 8px 20px rgba(74,53,36,.09)",
  lg: "0 4px 10px rgba(74,53,36,.10), 0 18px 40px rgba(74,53,36,.13)",
};

/* An inset line of white along the top edge. This is the single detail that
   makes a surface read as convex rather than merely coloured — it imitates a
   light source above the screen catching the top bevel. */
export const GLOSS = "inset 0 1px 0 rgba(255,255,255,.45)";
export const GLOSS_SOFT = "inset 0 1px 0 rgba(255,255,255,.7)";

/* --------------------------------------------------------------- colour
   `shade` lightens (positive) or darkens (negative) a hex colour, so a single
   accent can generate its own gradient instead of every caller inventing a
   second colour by eye. */
const hex2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");

export const shade = (hex, pct) => {
  const n = parseInt(hex.slice(1), 16);
  const parts = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return "#" + parts.map((c) => hex2(pct > 0 ? c + (255 - c) * pct : c * (1 + pct))).join("");
};

/* A lit surface: brightest at the top, the true colour through the middle,
   slightly darker at the base. */
export const grad = (hex) =>
  `linear-gradient(180deg, ${shade(hex, .22)} 0%, ${hex} 52%, ${shade(hex, -.12)} 100%)`;

/* The same idea for pale surfaces like cards, where a full gradient would look
   dirty — just a breath of white at the top. */
export const paleGrad = (hex) =>
  `linear-gradient(180deg, ${shade(hex, .45)} 0%, ${hex} 70%)`;

/* A washed tint of a game's accent, for the square its icon sits in. */
export const tint = (hex) =>
  `linear-gradient(150deg, ${shade(hex, .78)} 0%, ${shade(hex, .55)} 100%)`;

/* iOS eases: things leave quickly and arrive slowly, and a pressed control
   snaps back with a little overshoot. */
export const EASE = "cubic-bezier(.32,.72,0,1)";
export const SPRING = "cubic-bezier(.34,1.56,.64,1)";
