/* ============================= SOUND =============================

   Everything here is synthesised with the Web Audio API at runtime. There are
   no audio files, which is deliberate on three counts: nothing to download and
   nothing to 404 (the same reason the flags are served from our own domain and
   every icon is inline SVG), nothing added to the bundle, and no licence to
   worry about for a hobby site.

   ON THE MUSIC
   The loop below is written for this game rather than lifted from anywhere.
   The famous falling-blocks theme is a nineteenth-century Russian folk melody
   and the tune itself is long out of copyright, but the arrangements everyone
   actually recognises are not, and "close enough to be recognisable" is
   exactly the wrong place to stand. So this is its own thing: a minor-key
   chiptune loop that sits under the game without pretending to be that one.
   If a properly licensed track is ever wanted, `startMusic` is the only place
   that would need to change.

   AUTOPLAY
   Browsers refuse to start audio without a user gesture, and are right to.
   The context is created lazily on the first call, which in practice is the
   press that starts the game — so nothing here fights the browser or makes
   noise at somebody who has not asked for it.                              */

const PREF_KEY = "puzzlr:sound";

let ctx = null;
let master = null;
let enabled = true;

try { enabled = localStorage.getItem(PREF_KEY) !== "0"; } catch { /* private mode */ }

export const soundOn = () => enabled;

export function setSoundOn(on) {
  enabled = !!on;
  try { localStorage.setItem(PREF_KEY, on ? "1" : "0"); } catch { /* private mode */ }
  if (master && ctx) master.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, 0.01);
  /* Muting pauses the track but must not forget that a game is running, or
     turning the sound back on mid-round leaves it silent until the next one.
     `wantMusic` is that memory. */
  if (!on) { if (el) el.pause(); }
  else if (wantMusic) play();
}

/* Created on demand, never at module load: an AudioContext made outside a
   gesture starts suspended and stays that way. */
const audio = () => {
  if (!enabled) return null;
  if (!ctx) {
    const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    try { ctx = new AC(); } catch { return null; }
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => { /* still not allowed yet */ });
  return ctx;
};

/* One note. `bend` is a multiplier on the starting frequency, so 2 sweeps an
   octave up and 0.5 an octave down. */
function tone({ freq, at = 0, dur = 0.09, type = "square", gain = 0.18, bend = 0 }) {
  const c = audio();
  if (!c) return;
  const t0 = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (bend) osc.frequency.exponentialRampToValueAtTime(Math.max(25, freq * bend), t0 + dur);
  /* Ramps rather than steps at both ends. A square wave switched on at full
     amplitude clicks, and the click is louder than the note. */
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

/* Filtered noise, for anything that should read as a thud rather than a note. */
function thud({ at = 0, dur = 0.13, gain = 0.22, cutoff = 700 }) {
  const c = audio();
  if (!c) return;
  const t0 = c.currentTime + at;
  const frames = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = c.createBufferSource();
  src.buffer = buf;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(cutoff, t0);
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(lp); lp.connect(g); g.connect(master);
  src.start(t0);
  src.stop(t0 + dur);
}

/* ------------------------------------------------------------------ cues
   Two groups. The first are shared across the site and named for what
   happened rather than for which game it happened in — a right answer sounds
   the same in the flag quiz as it does in hangman, which is the point. The
   second are Tetris's own, because a piece landing has no equivalent
   elsewhere.

   Kept quiet on purpose. These fire constantly during play, and the ones that
   matter (a win, a mine) only read as loud if the ordinary ones are not. */

const seq = (notes, { root = 440, step = 0.08, dur = 0.2, gain = 0.14, type = "triangle" } = {}) =>
  notes.forEach((semi, i) => tone({ freq: root * 2 ** (semi / 12), at: i * step, dur, gain, type }));

/* ------------------------------------------------------------- shared */
const tap = () => tone({ freq: 380, dur: 0.035, gain: 0.07, type: "square" });
const pop = () => tone({ freq: 520, dur: 0.09, gain: 0.12, type: "triangle", bend: 1.9 });
const good = () => seq([0, 7], { root: 523, step: 0.07, dur: 0.13, gain: 0.11 });
const bad = () => tone({ freq: 220, dur: 0.2, gain: 0.12, type: "sawtooth", bend: 0.55 });
const win = () => seq([0, 4, 7, 12], { root: 523, step: 0.09, dur: 0.26, gain: 0.14 });
const lose = () => seq([0, -3, -7, -12], { root: 400, step: 0.13, dur: 0.28, gain: 0.14, type: "square" });
const reveal = () => seq([0, 4, 7], { root: 392, step: 0.05, dur: 0.16, gain: 0.09 });
const flag = () => tone({ freq: 700, dur: 0.055, gain: 0.09, type: "square", bend: 1.4 });
const drop = () => tone({ freq: 300, dur: 0.13, gain: 0.13, type: "triangle", bend: 0.5 });
const swoosh = () => thud({ dur: 0.08, gain: 0.06, cutoff: 1900 });
const boom = () => {
  thud({ dur: 0.4, gain: 0.3, cutoff: 300 });
  tone({ freq: 90, dur: 0.32, gain: 0.18, type: "sawtooth", bend: 0.4 });
};

export const sfx = {
  tap, pop, good, bad, win, lose, reveal, flag, drop, swoosh, boom,

  /* ----------------------------------------------------------- tetris */
  spawn: () => tone({ freq: 620, dur: 0.045, gain: 0.07, type: "triangle" }),
  move: () => tone({ freq: 300, dur: 0.03, gain: 0.05, type: "square" }),
  rotate: () => tone({ freq: 480, dur: 0.05, gain: 0.08, type: "square", bend: 1.25 }),
  hold: () => { tone({ freq: 400, dur: 0.07, gain: 0.11, type: "triangle", bend: 1.6 }); tone({ freq: 660, at: 0.06, dur: 0.08, gain: 0.09, type: "triangle" }); },
  land: () => { thud({ dur: 0.1, gain: 0.2, cutoff: 620 }); tone({ freq: 150, dur: 0.08, gain: 0.13, type: "square", bend: 0.6 }); },
  clear: () => [0, 1, 2].forEach((i) => tone({ freq: 520 * (1 + i * 0.26), at: i * 0.05, dur: 0.12, gain: 0.13, type: "square" })),
  /* The big one: an arpeggio up, then the same notes an octave higher a beat
     later, so it lands twice. */
  tetris: () => {
    seq([0, 4, 7, 12, 16], { root: 330, step: 0.055, dur: 0.16, gain: 0.16, type: "square" });
    [12, 16, 19, 24].forEach((semi, i) => tone({ freq: 330 * 2 ** (semi / 12), at: 0.3 + i * 0.05, dur: 0.22, gain: 0.12, type: "triangle" }));
  },
  levelUp: () => seq([0, 5, 9], { root: 440, step: 0.06, dur: 0.14, gain: 0.12 }),
  over: lose,
};

/* ----------------------------------------------------------------- music
   A real track rather than a synthesised loop, served from our own domain
   like the flags and for the same reason. It is a plain <audio> element, not
   a Web Audio buffer: nothing here needs to process the music, only start and
   stop it, and an element streams rather than decoding three megabytes into
   memory before the first note.

   `preload: none` matters. The file is only fetched once somebody actually
   starts a game with the sound on, so anyone who never opens Tetris — or
   turns the sound off — never downloads it.

   The caller supplies the source, so this stays a shared module rather than a
   Tetris one. */
const MUSIC_VOLUME = 0.34;      // under the cues, which are the informative part

let el = null;
let wantSrc = null;
/* Whether a game is running, as opposed to whether we are currently making
   noise about it. Muting separates the two, or turning the sound back on
   mid-round leaves it silent until the next one. */
let wantMusic = false;

function play() {
  if (!wantSrc || !enabled) return;
  if (!el) {
    el = new Audio();
    el.loop = true;
    el.preload = "none";
    el.volume = MUSIC_VOLUME;
  }
  if (el.dataset.src !== wantSrc) {
    el.dataset.src = wantSrc;
    el.src = wantSrc;
  }
  /* Rejects until the browser has seen a gesture, which is the right
     behaviour — there is nothing to do about it but try again next time. */
  el.play().catch(() => { /* not allowed yet */ });
}

export function startMusic(src) {
  wantMusic = true;
  if (src) wantSrc = src;
  play();
}

export function stopMusic() {
  wantMusic = false;
  if (el) {
    el.pause();
    try { el.currentTime = 0; } catch { /* not seekable yet */ }
  }
}

/* Pause is not stop. A paused game is still a game, so the track holds its
   place rather than rewinding — coming back to the same bar is the difference
   between a pause and a restart. */
export function pauseMusic() {
  if (el) el.pause();
}

export function resumeMusic() {
  if (wantMusic && enabled) play();
}

export const musicPlaying = () => !!el && !el.paused;
