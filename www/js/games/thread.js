/* Thread: steady hands. Drag the dot along the path without leaving it. */
CA.game({
  id: 'thread', name: 'Thread', arc: '#6FAE1C', dot: '#1C74E8', par: 35,
  blurb: 'Drag the dot along the path. Stay inside.',
  how: 'Press the dot and drag it along the path to the ring at the end. Leave the path and you go back to the start of that level.',
  make(env) {
    const L = env.levels;
    let w = 300, h = 300, level = 1, pts = null, px = [], idx = 0, width = 40;
    let drag = false, lock = 0, shake = 0, gap = 0, time = 0, done = false;

    function build() {
      const rnd = env.rng(level), P = 4 + Math.floor(level / 2), ctrl = [];
      let sgn = rnd() < 0.5 ? -1 : 1;
      for (let i = 0; i < P; i++) {
        const amp = (i === 0 || i === P - 1) ? rnd() * 0.2 : 0.2 + rnd() * 0.26;
        ctrl.push([0.5 + sgn * amp, 1 - i / (P - 1)]);
        sgn = -sgn;
      }
      /* Catmull-Rom through the control points */
      pts = [];
      const STEPS = 22;
      for (let i = 0; i < P - 1; i++) {
        const p0 = ctrl[i - 1] || ctrl[i], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[i + 2] || ctrl[i + 1];
        for (let s = 0; s < STEPS; s++) {
          const t = s / STEPS, t2 = t * t, t3 = t2 * t;
          const f = k => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
          pts.push([Math.min(1, Math.max(0, f(0))), Math.min(1, Math.max(0, f(1)))]);
        }
      }
      pts.push(ctrl[P - 1]);
      idx = 0; drag = false;
      place();
    }
    function place() {
      width = Math.max(30, Math.min(w, h, 480) * (0.17 - 0.008 * level));
      const m = width / 2 + 12;
      px = pts.map(p => [m + p[0] * (w - 2 * m), m + p[1] * (h - 2 * m)]);
    }
    function nearest(x, y) {
      let d = 1e9, at = idx;
      for (let i = Math.max(0, idx - 6), hi = Math.min(px.length - 1, idx + 16); i <= hi; i++) {
        const dd = Math.hypot(x - px[i][0], y - px[i][1]);
        if (dd < d) { d = dd; at = i; }
      }
      return {d, at};
    }
    function stroke(g, to) {
      g.beginPath(); g.moveTo(px[0][0], px[0][1]);
      for (let i = 1; i <= to; i++) g.lineTo(px[i][0], px[i][1]);
      g.stroke();
    }

    return {
      layout(W, H) { w = W; h = H; if (!pts) build(); else place(); },
      down(x, y) {
        if (done || lock > 0 || gap > 0) return;
        const p = px[idx];
        if (Math.hypot(x - p[0], y - p[1]) <= Math.max(width / 2, 24) + 10) drag = true;
      },
      move(x, y) {
        if (!drag || done) return;
        const n = nearest(x, y);
        if (n.d > width / 2 + 6) {
          drag = false; idx = 0; lock = 0.5; shake = 1;
          env.flash('Miss', true); env.sfx.miss();
          return;
        }
        if (n.at > idx) idx = n.at;
        if (idx >= px.length - 1) {
          drag = false; env.level(level);
          if (level >= L) { done = true; env.finish(); } else { env.sfx.clear(); gap = 0.2; }
        }
      },
      up() { drag = false; },
      update(dt) {
        time += dt; lock = Math.max(0, lock - dt); shake *= Math.exp(-dt * 9);
        if (gap > 0) { gap -= dt; if (gap <= 0) { level++; build(); } }
      },
      draw(g) {
        const c = env.col, last = px.length - 1, head = px[idx], end = px[last];
        g.save();
        if (!env.RM) g.translate(Math.sin(time * 70) * 8 * shake, 0);
        g.lineCap = 'round'; g.lineJoin = 'round';
        g.strokeStyle = c.track; g.lineWidth = width; stroke(g, last);
        if (idx > 0) { g.strokeStyle = c.arc; g.lineWidth = width * 0.45; stroke(g, idx); }
        g.strokeStyle = c.ink; g.lineWidth = 4;
        g.beginPath(); g.arc(end[0], end[1], width * 0.3, 0, CA.TAU); g.stroke();
        const r = Math.max(10, width * 0.32);
        if (!drag && lock <= 0 && !env.RM) {
          g.strokeStyle = c.dot; g.globalAlpha = 0.35; g.lineWidth = 3;
          g.beginPath(); g.arc(head[0], head[1], r + 6 + 3 * Math.sin(time * 5), 0, CA.TAU); g.stroke();
          g.globalAlpha = 1;
        }
        g.fillStyle = lock > 0 ? c.muted : c.dot;
        g.beginPath(); g.arc(head[0], head[1], r, 0, CA.TAU); g.fill();
        g.restore();
      },
      /* Test helper: the next point to drag to. */
      _hint() {
        if (done || lock > 0 || gap > 0) return null;
        const p = px[Math.min(px.length - 1, idx + (drag ? 3 : 0))];
        return {x: p[0], y: p[1], drag: true, grab: !drag};
      }
    };
  }
});
