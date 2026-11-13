// All sound is synthesised, so there are no audio files to load.
import { S } from './state.js';
let ac = null, noiseBuf = null;

export function unlock() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { ac = null; }
}

function tone(f, dur, type = 'sine', vol = 0.15, when = 0, f2 = 0) {
  const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + when;
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol = 0.2, freq = 1200, when = 0, q = 0.7) {
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), t = ac.currentTime + when;
  s.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(ac.destination); s.start(t); s.stop(t + dur + 0.02);
}

const SFX = {
  click: () => tone(700, 0.05, 'square', 0.05),
  card: () => noise(0.07, 0.12, 4000),
  chip: () => { tone(2200, 0.04, 'triangle', 0.1); tone(3100, 0.05, 'triangle', 0.07, 0.03); },
  coin: () => { tone(1320, 0.08, 'square', 0.07); tone(1760, 0.18, 'square', 0.07, 0.07); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, 'triangle', 0.13, i * 0.09)),
  big: () => [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.3, 'square', 0.08, i * 0.08)),
  lose: () => tone(220, 0.3, 'sawtooth', 0.07, 0, 110),
  reel: () => tone(180 + Math.random() * 60, 0.03, 'square', 0.04),
  stop: () => { tone(160, 0.08, 'square', 0.1); noise(0.05, 0.1, 900); },
  shot: () => { noise(0.5, 0.6, 2400, 0, 0.3); tone(110, 0.25, 'sawtooth', 0.3, 0, 40); noise(1.1, 0.12, 500, 0.08); },
  bolt: () => { noise(0.04, 0.2, 5000, 0.25); noise(0.05, 0.22, 3500, 0.5); tone(900, 0.03, 'square', 0.04, 0.5); },
  hit: () => { tone(1500, 0.07, 'square', 0.12); tone(2000, 0.1, 'square', 0.1, 0.05); },
  splash: () => noise(0.4, 0.25, 1800, 0, 0.2),
  bite: () => { tone(880, 0.08, 'square', 0.12); tone(1175, 0.12, 'square', 0.12, 0.09); },
  cast: () => noise(0.35, 0.1, 6000, 0, 2),
  snap: () => { tone(600, 0.15, 'sawtooth', 0.15, 0, 80); },
  pour: () => noise(0.6, 0.08, 3000, 0, 3),
  buy: () => { tone(988, 0.08, 'triangle', 0.12); tone(1319, 0.2, 'triangle', 0.12, 0.08); },
};

export function sfx(name) {
  if (!ac || !S.sound) return;
  try { SFX[name] && SFX[name](); } catch (e) { /* ignore */ }
}
