/* Recall: memory. A pattern lights up. It hides on your first tap. Tap every lit tile. */
CA.game({
  id: 'recall', name: 'Recall', arc: '#A650E0', dot: '#F2A413', par: 45,
  blurb: 'Memorize the pattern, then tap it back.',
  how: 'Tiles light up. They hide the moment you tap, so look first, then tap every tile that was lit. A wrong tile shows the pattern again, and costs you time.',
  make(env) {
    const L = env.levels, K = [3, 4, 5, 5, 6, 7, 8, 8, 9, 10];
    const GS = l => l <= 3 ? 3 : l <= 7 ? 4 : 5;
    let w = 300, h = 300, level = 1, gs = 3, k = 3, target, found, phase = 'show', wrong = -1;
    let lock = 0, shake = 0, gap = 0, time = 0, done = false;

    function build() {
      const rnd = env.rng(level);
      gs = GS(level); k = K[level - 1];
      target = new Set(); found = new Set();
      while (target.size < k) target.add(Math.floor(rnd() * gs * gs));
      phase = 'show'; wrong = -1; lock = 0;
    }
    build();
    const geom = () => { const side = Math.min(w, h, 440) - 8; return {side, x0: (w - side) / 2, y0: (h - side) / 2, cell: side / gs}; };

    return {
      layout(W, H) { w = W; h = H; },
      down(x, y) {
        if (done || lock > 0 || gap > 0) return;
        const {x0, y0, cell} = geom(), cx = Math.floor((x - x0) / cell), cy = Math.floor((y - y0) / cell);
        if (cx < 0 || cy < 0 || cx >= gs || cy >= gs) return;
        const idx = cy * gs + cx;
        if (found.has(idx)) return;
        phase = 'guess';
        if (target.has(idx)) {
          found.add(idx); env.sfx.hit(found.size - 1);
          if (found.size === k) {
            env.level(level);
            if (level >= L) { done = true; env.finish(); } else { env.sfx.clear(); gap = 0.3; }
          }
        } else {
          wrong = idx; lock = 0.7; shake = 1; env.flash('Miss', true); env.sfx.miss();
        }
      },
      update(dt) {
        time += dt; shake *= Math.exp(-dt * 9);
        if (lock > 0) { lock -= dt; if (lock <= 0) { lock = 0; wrong = -1; phase = 'show'; } }
        if (gap > 0) { gap -= dt; if (gap <= 0) { level++; build(); } }
      },
      draw(g) {
        const c = env.col, {x0, y0, cell} = geom(), pad = cell * 0.06;
        g.save();
        if (!env.RM) g.translate(Math.sin(time * 70) * 8 * shake, 0);
        for (let i = 0; i < gs * gs; i++) {
          const x = x0 + (i % gs) * cell + pad, y = y0 + Math.floor(i / gs) * cell + pad, s = cell - pad * 2;
          const lit = found.has(i) || ((phase === 'show' || gap > 0 || done) && target.has(i));
          g.fillStyle = i === wrong ? c.dot : lit ? c.arc : c.track;
          CA.rr(g, x, y, s, s, s * 0.2); g.fill();
        }
        g.restore();
      },
      _hint() {
        if (done || lock > 0 || gap > 0) return null;
        const {x0, y0, cell} = geom();
        for (const i of target) if (!found.has(i)) return {x: x0 + (i % gs + 0.5) * cell, y: y0 + (Math.floor(i / gs) + 0.5) * cell};
        return null;
      }
    };
  }
});
