/* City Apps core: config, helpers, sound. Loaded first. */
window.CA = {
  games: [],
  config: {
    levels: 10,              // every City Apps game has exactly 10 levels
    testMode: true,          // true = no real ads or purchases; both succeed instantly so the flow can be tested
    demo: true,              // true = fill leaderboards with made-up demo players until the online backend is connected
    starterTokens: 3,        // practice tokens a new player starts with
    practiceCost: 1,
    gauntletPracticeCost: 2,
    packs: [                 // placeholder prices; real ones come from the app stores
      {id: 'tokens_5', tokens: 5, price: '$0.99'},
      {id: 'tokens_15', tokens: 15, price: '$1.99'},
      {id: 'tokens_40', tokens: 40, price: '$3.99'}
    ]
  }
};
(() => {
'use strict';
const CA = window.CA;
CA.TAU = Math.PI * 2;

CA.fmt = s => {
  const cs = Math.floor(s * 100 + 1e-6), m = Math.floor(cs / 6000), r = cs - m * 6000;
  const sec = Math.floor(r / 100), c = r % 100;
  return m + ':' + (sec < 10 ? '0' : '') + sec + '.' + (c < 10 ? '0' : '') + c;
};
CA.fmtShort = s => { s = Math.round(s); return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60); };

/* Seeded random. Each game uses a fixed seed, so its course is identical on every run. */
CA.rng = seed => {
  let a = seed | 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
CA.hash = str => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
};
CA.dayKey = (d = new Date()) =>
  d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

CA.font = (px, weight) => (weight || 800) + ' ' + Math.round(px) + 'px "Bricolage Grotesque",ui-rounded,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
CA.rr = (g, x, y, w, h, r) => {
  g.beginPath();
  if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h);
};

/* ---------- sound and haptics ---------- */
let ac = null;
function audio() {
  if (!CA.sfx.on) return null;
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
  if (ac && ac.state === 'suspended') { try { ac.resume(); } catch (e) {} }
  return ac;
}
function tone(freq, dur, type, vol, when) {
  const a = audio(); if (!a) return;
  try {
    const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + (when || 0);
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.1, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + dur + 0.03);
  } catch (e) {}
}
const SCALE = [0, 2, 4, 7, 9];
const note = n => 330 * Math.pow(2, (SCALE[n % 5] + 12 * Math.floor(n / 5)) / 12);
const buzz = ms => { try { if (CA.sfx.on && navigator.vibrate) navigator.vibrate(ms); } catch (e) {} };

CA.sfx = {
  on: true,
  unlock: audio,
  hit(n, perfect) {
    n = (n || 0) % 15;
    tone(note(n), 0.17, 'triangle', 0.11);
    if (perfect) tone(note(n) * 2, 0.22, 'sine', 0.05);
    buzz(perfect ? 14 : 8);
  },
  miss() { tone(150, 0.2, 'sawtooth', 0.05); tone(110, 0.24, 'sine', 0.08); buzz([30, 40, 30]); },
  clear() { [0, 2, 4].forEach((n, i) => tone(note(n + 5), 0.2, 'triangle', 0.09, i * 0.07)); buzz([12, 40, 24]); },
  finish() { [0, 2, 4, 7, 9].forEach((n, i) => tone(note(n + 5), 0.3, 'triangle', 0.1, i * 0.09)); buzz([20, 50, 20, 50, 40]); }
};

/* Games register themselves with CA.game({...}). See games/pivot.js for the shape. */
CA.game = def => CA.games.push(def);
})();
