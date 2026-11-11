/* Count: search and tap. Tap the numbers in order, 1 upward. */
CA.game({
  id: 'count', name: 'Count', arc: '#2E7BF6', dot: '#F2466A', par: 30,
  blurb: 'Tap the numbers in order.',
  how: 'Tap the numbers in order, starting at 1. A wrong number freezes the board for a moment.',
  make(env) {
    const L = env.levels, N = [3, 4, 4, 5, 5, 6, 6, 7, 7, 8];   // numbers per level
    let w = 300, h = 300, level = 1, items = null, next = 1, n = 0, cols = 2, rows = 2;
    let lock = 0, shake = 0, gap = 0, time = 0, done = false;

    function build() {
      const rnd = env.rng(level);
      n = N[level - 1]; next = 1;
      cols = 3;                                   // fixed grid, so the layout is the same on every screen
      rows = Math.ceil((n + 2) / cols);
      const cells = [];
      for (let i = 0; i < cols * rows; i++) cells.push(i);
      for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
      items = [];
      for (let k = 0; k < n; k++) items.push({n: k + 1, c: cells[k] % cols, r: Math.floor(cells[k] / cols), jx: rnd() * 2 - 1, jy: rnd() * 2 - 1, gone: false});
    }
    function pos(it) {
      const cw = w / cols, ch = h / rows, r = Math.min(cw, ch, 130) * 0.42;
      return {x: (it.c + 0.5) * cw + it.jx * Math.max(0, cw / 2 - r - 4), y: (it.r + 0.5) * ch + it.jy * Math.max(0, ch / 2 - r - 4), r};
    }

    return {
      layout(W, H) { w = W; h = H; if (!items) build(); },
      down(x, y) {
        if (done || lock > 0 || gap > 0) return;
        let hit = null, best = 1e9;
        for (const it of items) {
          if (it.gone) continue;
          const p = pos(it), d = Math.hypot(x - p.x, y - p.y);
          if (d <= p.r + 8 && d < best) { best = d; hit = it; }
        }
        if (!hit) return;
        if (hit.n === next) {
          hit.gone = true; next++; env.sfx.hit(hit.n - 1);
          if (next > n) {
            env.level(level);
            if (level >= L) { done = true; env.finish(); } else { env.sfx.clear(); gap = 0.22; }
          }
        } else {
          lock = 0.6; shake = 1; env.flash('Miss', true); env.sfx.miss();
        }
      },
      update(dt) {
        time += dt; lock = Math.max(0, lock - dt); shake *= Math.exp(-dt * 9);
        if (gap > 0) { gap -= dt; if (gap <= 0) { level++; build(); } }
      },
      draw(g) {
        const c = env.col;
        g.save();
        if (!env.RM) g.translate(Math.sin(time * 70) * 8 * shake, 0);
        g.textAlign = 'center'; g.textBaseline = 'middle';
        for (const it of items) {
          if (it.gone) continue;
          const p = pos(it);
          g.fillStyle = c.surface; g.strokeStyle = lock > 0 ? c.line : c.arc; g.lineWidth = 3;
          g.beginPath(); g.arc(p.x, p.y, p.r, 0, CA.TAU); g.fill(); g.stroke();
          g.fillStyle = lock > 0 ? c.muted : c.ink; g.font = CA.font(p.r * 0.95);
          g.fillText(String(it.n), p.x, p.y + p.r * 0.06);
        }
        g.restore();
      },
      _hint() {
        if (done || lock > 0 || gap > 0) return null;
        const it = items.find(i => i.n === next); if (!it) return null;
        const p = pos(it); return {x: p.x, y: p.y};
      }
    };
  }
});
