/* All sound is synthesised, so there are no audio files to download. */
export function makeAudio() {
  let ac = null, master = null, mute = false, musicT = null;
  const init = () => {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = mute ? 0 : 0.5; master.connect(ac.destination);
      music();
    } catch (e) { ac = null; }
  };
  function tone(freq, dur, type = 'sine', vol = 0.2, slide = 0, delay = 0) {
    if (!ac || mute) return;
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
  const note = n => 261.6 * Math.pow(2, n / 12);
  /* A slow, sparse music box over a low drone. */
  function music() {
    const chords = [[-12, -5, 4], [-15, -8, 0], [-17, -10, -1], [-14, -7, 2]];
    let bar = 0;
    const step = () => {
      if (ac && !mute && ac.state === 'running' && !document.hidden) {
        const ch = chords[bar++ % chords.length];
        ch.forEach((n, i) => tone(note(n), 6.5, 'sine', 0.045, 0, i * 0.05));
        for (let i = 0; i < 4; i++) if (Math.random() < 0.6) tone(note(ch[2] + [0, 3, 7, 8, 12, 15][Math.floor(Math.random() * 6)]), 1.6, 'triangle', 0.035, 0, i * 1.5 + Math.random() * 0.3);
      }
      musicT = setTimeout(step, 6000);
    };
    step();
  }
  return {
    init,
    setMute(m) { mute = m; if (master) master.gain.value = m ? 0 : 0.5; },
    hit(n, perfect) { const f = note(SCALE[Math.min(n, SCALE.length - 1)]); tone(f, 0.16, 'triangle', 0.22); if (perfect) tone(f * 2, 0.22, 'sine', 0.14, 0, 0.03); tone(140, 0.08, 'square', 0.08, 0.5); },
    miss() { tone(150, 0.2, 'sawtooth', 0.1, 0.5); },
    hurt() { tone(110, 0.3, 'sawtooth', 0.2, 0.4); tone(70, 0.3, 'square', 0.14, 0.6); },
    parry(p) { tone(p ? 1320 : 880, 0.12, 'square', 0.1); tone(p ? 1980 : 1320, 0.2, 'sine', 0.12, 0, 0.04); },
    warn() { tone(330, 0.12, 'square', 0.05); tone(330, 0.12, 'square', 0.05, 0, 0.14); },
    flip() { tone(500, 0.18, 'sine', 0.1, 2); },
    crack() { tone(900, 0.1, 'square', 0.12, 0.3); tone(1400, 0.2, 'triangle', 0.1, 0.5, 0.05); },
    glyph() { [0, 4, 7, 12].forEach((n, i) => tone(note(n + 12), 0.2, 'sine', 0.1, 0, i * 0.04)); },
    flow() { [0, 4, 7, 12, 16, 19].forEach((n, i) => tone(note(n), 0.4, 'triangle', 0.12, 0, i * 0.06)); },
    kill() { tone(300, 0.4, 'sawtooth', 0.1, 0.2); tone(600, 0.3, 'sine', 0.1, 0.3, 0.05); },
    win() { [0, 4, 7, 12].forEach((n, i) => tone(note(n), 0.3, 'triangle', 0.14, 0, i * 0.1)); },
    level() { [0, 4, 7, 12, 16].forEach((n, i) => tone(note(n + 12), 0.4, 'sine', 0.14, 0, i * 0.09)); },
    pickup() { tone(880, 0.1, 'sine', 0.12); tone(1320, 0.16, 'sine', 0.12, 0, 0.07); },
    minute() { [12, 16, 19, 24, 28].forEach((n, i) => tone(note(n), 0.5, 'sine', 0.1, 0, i * 0.07)); },
    coin() { tone(1200, 0.07, 'square', 0.06); tone(1600, 0.1, 'square', 0.06, 0, 0.06); },
    click() { tone(660, 0.05, 'sine', 0.06); },
    bell() { tone(392, 2.2, 'sine', 0.25); tone(784, 1.6, 'sine', 0.1); tone(1180, 1, 'sine', 0.05); },
    quest() { [7, 12, 16].forEach((n, i) => tone(note(n), 0.5, 'triangle', 0.12, 0, i * 0.14)); },
  };
}
