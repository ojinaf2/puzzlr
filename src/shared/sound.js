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
  /* Muting stops the scheduler but must not forget that a game is running,
     or turning the sound back on mid-game leaves it silent until the next
     round. `wantMusic` is that memory. */
  if (!on) halt(); else if (wantMusic) begin();
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

/* ------------------------------------------------------------------ cues */
export const sfx = {
  spawn: () => tone({ freq: 620, dur: 0.045, gain: 0.07, type: "triangle" }),
  move: () => tone({ freq: 300, dur: 0.03, gain: 0.05, type: "square" }),
  rotate: () => tone({ freq: 480, dur: 0.05, gain: 0.08, type: "square", bend: 1.25 }),
  hold: () => { tone({ freq: 400, dur: 0.07, gain: 0.11, type: "triangle", bend: 1.6 }); tone({ freq: 660, at: 0.06, dur: 0.08, gain: 0.09, type: "triangle" }); },
  land: () => { thud({ dur: 0.1, gain: 0.2, cutoff: 620 }); tone({ freq: 150, dur: 0.08, gain: 0.13, type: "square", bend: 0.6 }); },
  clear: () => [0, 1, 2].forEach((i) => tone({ freq: 520 * (1 + i * 0.26), at: i * 0.05, dur: 0.12, gain: 0.13, type: "square" })),
  /* The big one: an arpeggio up, then the same notes an octave higher a beat
     later, so it lands twice. */
  tetris: () => {
    [0, 4, 7, 12, 16].forEach((semi, i) => tone({ freq: 330 * 2 ** (semi / 12), at: i * 0.055, dur: 0.16, gain: 0.16, type: "square" }));
    [12, 16, 19, 24].forEach((semi, i) => tone({ freq: 330 * 2 ** (semi / 12), at: 0.3 + i * 0.05, dur: 0.22, gain: 0.12, type: "triangle" }));
  },
  levelUp: () => [0, 5, 9].forEach((semi, i) => tone({ freq: 440 * 2 ** (semi / 12), at: i * 0.06, dur: 0.14, gain: 0.12, type: "triangle" })),
  over: () => [0, -3, -7, -12].forEach((semi, i) => tone({ freq: 400 * 2 ** (semi / 12), at: i * 0.13, dur: 0.28, gain: 0.15, type: "square" })),
};

/* ----------------------------------------------------------------- music
   A sixteen-step bar at four steps a beat. `null` is a rest; numbers are
   semitones from A. Four bars of bass with a lead over the top. */
const BPM = 128;
const STEP = 60 / BPM / 4;
const A = 220;
const hz = (semi) => A * 2 ** (semi / 12);

const BASS = [
  0, null, 0, null, 7, null, 0, null, 5, null, 5, null, 3, null, 3, null,
  0, null, 0, null, 7, null, 0, null, 5, null, 3, null, 0, null, -2, null,
  -4, null, -4, null, 3, null, -4, null, 0, null, 0, null, 3, null, 5, null,
  0, null, 0, null, 7, null, 12, null, 7, null, 5, null, 3, null, 0, null,
];
const LEAD = [
  12, null, 15, 12, 19, null, 15, null, 17, null, 15, 12, 12, null, null, null,
  12, null, 15, 12, 19, null, 22, null, 20, null, 17, 15, 12, null, null, null,
  8, null, 12, 8, 15, null, 12, null, 8, null, 7, null, 8, null, 12, null,
  12, null, 19, null, 17, null, 15, null, 12, null, 7, null, 0, null, null, null,
];

let musicTimer = null;
let step = 0;
let nextAt = 0;

/* A lookahead scheduler rather than a note-per-timeout: setInterval drifts and
   is throttled in a background tab, but notes queued against the audio clock
   play exactly when they were told to. */
const LOOKAHEAD_MS = 25;
const HORIZON = 0.12;

function pump() {
  const c = audio();
  if (!c) return;
  while (nextAt < c.currentTime + HORIZON) {
    const at = nextAt - c.currentTime;
    const b = BASS[step % BASS.length];
    const l = LEAD[step % LEAD.length];
    if (b !== null && b !== undefined) tone({ freq: hz(b - 12), at, dur: STEP * 1.6, gain: 0.075, type: "triangle" });
    if (l !== null && l !== undefined) tone({ freq: hz(l), at, dur: STEP * 1.3, gain: 0.05, type: "square" });
    // A soft tick on the backbeat, to give it a pulse without a drum kit.
    if (step % 8 === 4) thud({ at, dur: 0.05, gain: 0.05, cutoff: 2600 });
    step += 1;
    nextAt += STEP;
  }
}

/* `wantMusic` is whether a game is running; `musicTimer` is whether we are
   actually making noise about it. Muting separates the two. */
let wantMusic = false;

function begin() {
  if (musicTimer) return;
  const c = audio();
  if (!c) return;
  step = 0;
  nextAt = c.currentTime + 0.08;
  pump();
  musicTimer = setInterval(pump, LOOKAHEAD_MS);
}

function halt() {
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
}

export function startMusic() {
  wantMusic = true;
  if (enabled) begin();
}

export function stopMusic() {
  wantMusic = false;
  halt();
}

export const musicPlaying = () => musicTimer !== null;
