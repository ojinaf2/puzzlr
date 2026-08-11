import { useSyncExternalStore } from 'react';

/* ============================= THEME =============================

   Two palettes, one set of names. `C.text` does not return a colour — it
   returns `var(--c-text)`, and the actual value is swapped on the root
   element when the theme changes. That is the whole trick: every game already
   writes `color: C.text` in an inline style, so all seven of them became
   theme-aware without a single edit.

   The consequence to remember: **the values in `C` are strings like
   "var(--c-text)", not hex.** Anything doing arithmetic on a colour has to go
   through `grad`/`paleGrad`/`tint` below, which know how to map a token onto
   its pre-computed variable. `shade()` still expects a real hex and is for
   literal colours only — the per-game accents in the registry, mostly. */

const LIGHT = {
  bg: "#ffffff", panel: "#f7ecd9", panel2: "#f0ddc0", line: "#e2cba6",
  text: "#4a3524", dim: "#8a6d52",
  correct: "#6aaa64", present: "#c9973f", absent: "#b79b7e", key: "#e0be93",
  accent: "#b5651d", accent2: "#a0522d", danger: "#c0492f", gold: "#c9973f",
};

/* Warm near-black rather than grey. A neutral dark theme would throw away the
   thing that makes the light one recognisable. */
const DARK = {
  bg: "#16110c", panel: "#231a12", panel2: "#2e2318", line: "#3b2e20",
  text: "#f2e6d4", dim: "#ac9070",
  correct: "#5f9d59", present: "#bf8f3a", absent: "#4e3f30", key: "#41321f",
  accent: "#c9762e", accent2: "#b0602a", danger: "#cf5741", gold: "#d1a24a",
};

export const THEMES = { light: LIGHT, dark: DARK };
const KEYS = Object.keys(LIGHT);

/* --------------------------------------------------------------- colour */
const hex2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");

/* Lightens (positive) or darkens (negative) a real hex colour. Literal
   colours only — passing it a `var(...)` string will not work. */
export const shade = (hex, pct) => {
  const n = parseInt(hex.slice(1), 16);
  const parts = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return "#" + parts.map((c) => hex2(pct > 0 ? c + (255 - c) * pct : c * (1 + pct))).join("");
};

const gradOf = (hex) => `linear-gradient(180deg, ${shade(hex, .22)} 0%, ${hex} 52%, ${shade(hex, -.12)} 100%)`;
const paleOf = (hex) => `linear-gradient(180deg, ${shade(hex, .45)} 0%, ${hex} 70%)`;

/* A token ("var(--c-accent)") maps onto its pre-computed sibling variable; a
   literal hex is computed on the spot. Both spellings are in use — palette
   colours are tokens, per-game accents are literals. */
const tokenName = (v) => (typeof v === "string" && v.startsWith("var(--c-") ? v.slice(8, -1) : null);

export const grad = (colour) => {
  const t = tokenName(colour);
  return t ? `var(--grad-${t})` : gradOf(colour);
};
export const paleGrad = (colour) => {
  const t = tokenName(colour);
  return t ? `var(--pale-${t})` : paleOf(colour);
};

/* A wash of a game's accent laid over whatever the current panel colour is.
   Translucent rather than pre-mixed, so the same call reads as a pale tint in
   the light theme and a deep one in the dark theme. */
export const tint = (hex) => `linear-gradient(150deg, ${hex}3d, ${hex}1a), var(--c-panel2)`;

/* --------------------------------------------------------------- depth
   Two shadows, never one. A tight contact shadow says an object is resting on
   the page; a wide ambient one says there is air under it. A single blurry
   shadow just looks smudged, which is the usual reason a "3D" button reads as
   cheap. These are variables too: the dark theme needs deeper, blacker
   shadows and a far fainter top highlight to read the same way. */
export const SHADOW = { sm: "var(--shadow-sm)", md: "var(--shadow-md)", lg: "var(--shadow-lg)" };
export const GLOSS = "var(--gloss)";
export const GLOSS_SOFT = "var(--gloss-soft)";
export const GLASS = "var(--glass)";      // translucent header fill
export const GLOW = "var(--glow)";        // the bloom behind the hero
export const LOGO = "var(--logo)";        // the P mark
export const PILL = "var(--pill)";        // small inset badges

/* Everything a surface needs that is not a flat palette colour. Derived from
   the palette rather than written twice, so a change to `accent` carries
   through to the logo and the hero bloom on its own. */
const depthFor = (name) => {
  const p = THEMES[name];
  const dark = name === "dark";
  return {
    "shadow-sm": dark ? "0 1px 2px rgba(0,0,0,.5), 0 2px 6px rgba(0,0,0,.35)"
                      : "0 1px 2px rgba(74,53,36,.10), 0 2px 6px rgba(74,53,36,.05)",
    "shadow-md": dark ? "0 2px 4px rgba(0,0,0,.5), 0 8px 20px rgba(0,0,0,.42)"
                      : "0 2px 4px rgba(74,53,36,.10), 0 8px 20px rgba(74,53,36,.09)",
    "shadow-lg": dark ? "0 4px 10px rgba(0,0,0,.5), 0 18px 40px rgba(0,0,0,.55)"
                      : "0 4px 10px rgba(74,53,36,.10), 0 18px 40px rgba(74,53,36,.13)",
    /* The top highlight has to be far fainter on a dark surface. At light-mode
       strength it reads as a hairline scratch rather than a lit edge. */
    gloss: dark ? "inset 0 1px 0 rgba(255,255,255,.13)" : "inset 0 1px 0 rgba(255,255,255,.45)",
    "gloss-soft": dark ? "inset 0 1px 0 rgba(255,255,255,.07)" : "inset 0 1px 0 rgba(255,255,255,.7)",
    glass: dark ? "rgba(22,17,12,.7)" : "rgba(255,255,255,.72)",
    glow: `radial-gradient(closest-side, ${shade(p.accent, dark ? -.6 : .82)}, transparent)`,
    logo: `linear-gradient(150deg, ${shade(p.accent, .28)}, ${p.accent} 55%, ${p.accent2})`,
    /* White at low alpha on dark, so a badge lifts off the panel instead of
       punching a bright hole in it. */
    pill: dark ? "rgba(255,255,255,.07)" : "rgba(255,255,255,.75)",
    wash: dark ? "rgba(255,255,255,.07)" : "rgba(74,53,36,.05)",
    "wash-strong": dark ? "rgba(255,255,255,.12)" : "rgba(74,53,36,.09)",
  };
};

/* iOS eases: things leave quickly and arrive slowly, and a pressed control
   snaps back with a little overshoot. */
export const EASE = "cubic-bezier(.32,.72,0,1)";
export const SPRING = "cubic-bezier(.34,1.56,.64,1)";

/* The palette every game reads. Values are variable references, not colours. */
export const C = Object.fromEntries(KEYS.map((k) => [k, `var(--c-${k})`]));

/* ------------------------------------------------------------ the css
   Emitted once into the page. Every derived gradient is pre-computed for both
   themes here rather than at each call site, so switching theme is a single
   attribute change and never a React re-render of the whole tree. */
const block = (selector, name) => {
  const p = THEMES[name];
  const lines = [
    ...KEYS.map((k) => `--c-${k}:${p[k]};`),
    ...KEYS.map((k) => `--grad-${k}:${gradOf(p[k])};`),
    ...KEYS.map((k) => `--pale-${k}:${paleOf(p[k])};`),
    ...Object.entries(depthFor(name)).map(([k, v]) => `--${k}:${v};`),
    `color-scheme:${name};`,
  ];
  return `${selector}{${lines.join("")}}`;
};

export const themeCss = () => [
  block(":root", "light"),
  /* Device preference decides while no choice has been made. The :not() is
     what lets an explicit choice win: once data-theme is stamped on the root,
     this rule stops matching entirely. */
  `@media (prefers-color-scheme: dark){${block(':root:not([data-theme])', "dark")}}`,
  block(':root[data-theme="dark"]', "dark"),
  block(':root[data-theme="light"]', "light"),
].join("\n");

/* ---------------------------------------------------------------- store
   A tiny external store rather than context: the theme is read by module-level
   code as well as components, and this keeps a single source of truth without
   wrapping the tree in a provider. */
const STORE_KEY = "puzzlr:theme";

const systemPrefersDark = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;

const stored = () => {
  try { return localStorage.getItem(STORE_KEY); } catch { return null; }
};

let chosen = stored();                                   // null until the user picks
let current = chosen || (systemPrefersDark() ? "dark" : "light");
const listeners = new Set();

const apply = () => {
  if (typeof document === "undefined") return;
  /* Only stamp the attribute once a choice exists. Leaving it off lets the
     prefers-color-scheme rule keep working, so a visitor who has never
     touched the toggle follows their device if they change it later. */
  if (chosen) document.documentElement.setAttribute("data-theme", chosen);
  else document.documentElement.removeAttribute("data-theme");
};

export const getTheme = () => current;

export const setTheme = (next) => {
  chosen = next;
  current = next;
  try { localStorage.setItem(STORE_KEY, next); } catch { /* private mode; the theme just will not persist */ }
  apply();
  listeners.forEach((f) => f());
};

export const toggleTheme = () => setTheme(current === "dark" ? "light" : "dark");

const subscribe = (f) => {
  listeners.add(f);
  return () => listeners.delete(f);
};

/* Follow the device while the visitor has not expressed a preference. */
if (typeof matchMedia === "function") {
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", (e) => {
    if (chosen) return;
    current = e.matches ? "dark" : "light";
    listeners.forEach((f) => f());
  });
}

apply();

export const useTheme = () => useSyncExternalStore(subscribe, getTheme, () => "light");
