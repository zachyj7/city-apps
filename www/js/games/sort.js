/* Sort: fast decisions. Send each piece left or right.
   Filled pieces are sorted by color, outlined pieces by shape. The bins show what goes where. */
CA.game({
  id: 'sort', name: 'Sort', arc: '#F5802A', dot: '#6A4CF0', par: 55, keys: 'lr',
  blurb: 'Left or right. Decide fast.',
  how: 'Tap the left or right side to sort each piece into its bin. Filled pieces go by color. Outlined pieces go by shape. The bins change, so check them. A wrong side freezes you for a moment.',
  make(env) {
    const L = env.levels;
    let w = 300, h = 300, level = 1, q = [], i = 0, mode = 'c', cs = 0, ss = 0;
    let lock = 0, shake = 0, gap = 0, time = 0, done = false;
    const fly = [];

    function build() {
      const rnd = env.rng(level);
      mode = level <= 4 ? (level % 2 ? 'c' : 's') : 'm';
      cs = level < 3 ? 0 : level === 3 ? 1 : +(rnd() < 0.5);   // 1 = color bins swapped
      ss = level < 4 ? 0 : level === 4 ? 1 : +(rnd() < 0.5);   // 1 = shape bins swapped
      q = []; i = 0;
      for (let k = 0; k < 4 + level; k++) q.push({color: +(rnd() < 0.5), shape: +(rnd() < 0.5), filled: mode === 'c' ? true : mode === 's' ? false : rnd() < 0.5});
    }
    build();
    const sideOf = it => it.filled ? it.color ^ cs : it.shape ^ ss;   // 0 = left, 1 = right
    const binH = () => Math.min(120, h * 0.26);

    function piece(g, it, x, y, S, color) {
      g.fillStyle = g.strokeStyle = color; g.lineWidth = S * 0.14;
      const r = it.filled ? S / 2 : S / 2 - S * 0.07;
      if (it.shape === 0) { g.beginPath(); g.arc(x, y, r, 0, CA.TAU); }
      else CA.rr(g, x - r, y - r, r * 2, r * 2, S * 0.12);
      if (it.filled) g.fill(); else g.stroke();
    }

    return {
      layout(W, H) { w = W; h = H; },
      down(x) {
        if (done || lock > 0 || gap > 0) return;
        const s = x < w / 2 ? 0 : 1, it = q[i];
        if (s === sideOf(it)) {
          fly.push({it, s, t: 0}); i++; env.sfx.hit(i - 1);
          if (i >= q.length) {
            env.level(level);
            if (level >= L) { done = true; env.finish(); } else { env.sfx.clear(); gap = 0.25; }
          }
        } else {
          lock = 0.8; shake = 1; env.flash('Miss', true); env.sfx.miss();
        }
      },
      update(dt) {
        time += dt; lock = Math.max(0, lock - dt); shake *= Math.exp(-dt * 9);
        for (let k = fly.length - 1; k >= 0; k--) { fly[k].t += dt / 0.18; if (fly[k].t >= 1) fly.splice(k, 1); }
        if (gap > 0) { gap -= dt; if (gap <= 0) { level++; build(); } }
      },
      draw(g) {
        const c = env.col, bh = binH(), by = h - bh - 4, S = Math.min(w, by) * 0.3;
        const cx = w / 2, cy = by * 0.56, colors = [c.arc, c.dot];

        /* bins */
        for (let s = 0; s < 2; s++) {
          const bx = s ? w / 2 + 6 : 8, bw = w / 2 - 14, mid = bx + bw / 2, my = by + bh / 2, ic = Math.min(bh * 0.42, bw * 0.3);
          g.fillStyle = c.surface; CA.rr(g, bx, by, bw, bh, 20); g.fill();
          const showC = mode !== 's', showS = mode !== 'c';
          const off = showC && showS ? ic * 0.7 : 0;
          if (showC) piece(g, {filled: true, shape: 0}, mid - off, my, ic, colors[s ^ cs]);
          if (showS) piece(g, {filled: false, shape: s ^ ss}, mid + off, my, ic, c.ink);
        }
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = c.muted; g.font = CA.font(15, 600);
        g.fillText(mode === 'c' ? 'Match the color' : mode === 's' ? 'Match the shape' : 'Filled: color  ·  Outline: shape', cx, by - 18);
        if (!done && gap <= 0) g.fillText((q.length - i) + ' left', cx, 46);

        /* pieces */
        for (const f of fly) {
          g.globalAlpha = 1 - f.t;
          piece(g, f.it, cx + (f.s ? 1 : -1) * f.t * w * 0.3, cy + f.t * (by - cy) * 0.6, S * (1 - f.t * 0.4), colors[f.it.color]);
        }
        g.globalAlpha = 1;
        if (i < q.length) {
          if (i + 1 < q.length) { g.globalAlpha = 0.35; piece(g, q[i + 1], cx, cy - S * 0.95, S * 0.36, colors[q[i + 1].color]); g.globalAlpha = 1; }
          const sx = env.RM ? 0 : Math.sin(time * 70) * 8 * shake;
          piece(g, q[i], cx + sx, cy, S, lock > 0 ? c.muted : colors[q[i].color]);
        }
      },
      _hint() {
        if (done || lock > 0 || gap > 0 || i >= q.length) return null;
        return {x: sideOf(q[i]) ? w * 0.75 : w * 0.25, y: h / 2};
      }
    };
  }
});
