/* Slide: route finding. Swipe and the dot slides until something stops it. Stop it on the ring.
   The boards never change, so the fastest route can be found once and then run from memory. */
CA.game({
  id: 'slide', name: 'Slide', arc: '#6FAE1C', dot: '#1C74E8', par: 30, keys: 'arrows',
  blurb: 'Swipe to slide. Stop on the ring.',
  how: 'Swipe to slide the dot. It keeps going until it hits a wall or a block. Stop it on the ring. The boards never change, so find the shortest route and remember it.',
  make(env) {
    const L = env.levels, WANT = [2, 3, 3, 4, 4, 5, 5, 6, 6, 7];        // fewest swipes that solve each level
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];                    // right, left, down, up
    let w = 300, h = 300, level = 1, n = 5, blocks = [], start = 0, goal = 0, pos = 0;
    let anim = null, queued = -1, armed = false, sx = 0, sy = 0;
    let lock = 0, shake = 0, gap = 0, time = 0, done = false;

    function slideFrom(p, d) {
      let x = p % n, y = (p - x) / n;
      for (;;) {
        const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
        if (nx < 0 || ny < 0 || nx >= n || ny >= n || blocks[ny * n + nx]) break;
        x = nx; y = ny;
      }
      return y * n + x;
    }
    function bfs(from) {
      const dist = new Map([[from, 0]]), via = new Map(), q = [from];
      for (let i = 0; i < q.length; i++) {
        for (let d = 0; d < 4; d++) {
          const t = slideFrom(q[i], d);
          if (t !== q[i] && !dist.has(t)) { dist.set(t, dist.get(q[i]) + 1); via.set(t, [q[i], d]); q.push(t); }
        }
      }
      return {dist, via};
    }
    const inner = p => { const x = p % n, y = (p - x) / n; return x > 0 && y > 0 && x < n - 1 && y < n - 1; };
    /* Does the slide from p in direction d end against a block (true) or the outer wall (false)? */
    function blockStop(p, d) {
      const t = slideFrom(p, d), nx = t % n + DIRS[d][0], ny = Math.floor(t / n) + DIRS[d][1];
      return nx >= 0 && ny >= 0 && nx < n && ny < n;
    }
    /* Fewest block-stops on ANY shortest route to the ring. High means no shortest route can just ride the outer wall. */
    function minBlockStops(dist) {
      const order = [...dist.keys()].sort((a, b) => dist.get(a) - dist.get(b)), best = new Map([[start, 0]]);
      for (const p of order) {
        if (!best.has(p)) continue;
        for (let d = 0; d < 4; d++) {
          const t = slideFrom(p, d);
          if (t === p || dist.get(t) !== dist.get(p) + 1) continue;
          const v = best.get(p) + (blockStop(p, d) ? 1 : 0);
          if (!best.has(t) || v < best.get(t)) best.set(t, v);
        }
      }
      return best.get(goal);
    }
    /* Deterministic: keep drawing boards from the level's fixed random stream until one needs exactly
       WANT swipes, has its ring away from the outer wall, forces most stops to be against blocks on every
       shortest route, and has no position the ring cannot be reached from. Same result on every device. */
    function build() {
      const rnd = env.rng(level);
      n = level <= 3 ? 5 : level <= 7 ? 6 : 7;
      for (let tries = 0; tries < 60000; tries++) {
        blocks = [];
        for (let i = 0; i < n * n; i++) blocks.push(rnd() < 0.2);
        const free = []; blocks.forEach((b, i) => { if (!b) free.push(i); });
        start = free[Math.floor(rnd() * free.length)]; goal = free[Math.floor(rnd() * free.length)];
        if (start === goal || !inner(goal)) continue;
        const r = bfs(start);
        if (r.dist.get(goal) !== WANT[level - 1]) continue;
        if (minBlockStops(r.dist) < Math.ceil(WANT[level - 1] * 0.7)) continue;
        let ok = true;
        for (const s of r.dist.keys()) if (s !== goal && !bfs(s).dist.has(goal)) { ok = false; break; }
        if (ok) break;
      }
      pos = start; anim = null; queued = -1; armed = false;
    }
    build();
    const geom = () => { const side = Math.min(w, h, 440) - 8; return {x0: (w - side) / 2, y0: (h - side) / 2, cell: side / n}; };

    function swipe(d) {
      if (done || gap > 0 || lock > 0) return;
      if (anim) { queued = d; return; }
      const t = slideFrom(pos, d);
      if (t === pos) return;
      const cells = Math.abs(t % n - pos % n) + Math.abs(Math.floor(t / n) - Math.floor(pos / n));
      anim = {from: pos, to: t, t: 0, dur: 0.05 + 0.03 * cells};
      env.sfx.hit(cells);
    }
    function arrive() {
      pos = anim.to; anim = null;
      if (pos === goal) {
        queued = -1; env.level(level);
        if (level >= L) { done = true; env.finish(); } else { env.sfx.clear(); gap = 0.25; }
      } else if (!bfs(pos).dist.has(goal)) {
        queued = -1; pos = start; lock = 0.4; shake = 1; env.flash('Dead end', true); env.sfx.miss();
      } else if (queued >= 0) { const d = queued; queued = -1; swipe(d); }
    }

    return {
      layout(W, H) { w = W; h = H; },
      down(x, y) { sx = x; sy = y; armed = true; },
      move(x, y) {
        if (!armed) return;
        const dx = x - sx, dy = y - sy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
        armed = false;
        swipe(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 1) : (dy > 0 ? 2 : 3));
      },
      up() { armed = false; },
      swipe,
      update(dt) {
        time += dt; lock = Math.max(0, lock - dt); shake *= Math.exp(-dt * 9);
        if (anim) { anim.t += dt / anim.dur; if (anim.t >= 1) arrive(); }
        if (gap > 0) { gap -= dt; if (gap <= 0) { level++; build(); } }
      },
      draw(g) {
        const c = env.col, {x0, y0, cell} = geom(), pad = cell * 0.05;
        const at = p => [x0 + (p % n + 0.5) * cell, y0 + (Math.floor(p / n) + 0.5) * cell];
        g.save();
        if (!env.RM) g.translate(Math.sin(time * 70) * 8 * shake, 0);
        for (let i = 0; i < n * n; i++) {
          const x = x0 + (i % n) * cell + pad, y = y0 + Math.floor(i / n) * cell + pad, s = cell - pad * 2;
          g.fillStyle = blocks[i] ? c.muted : c.track;
          CA.rr(g, x, y, s, s, s * 0.18); g.fill();
        }
        const [gx, gy] = at(goal);
        g.strokeStyle = c.arc; g.lineWidth = cell * 0.11;
        g.beginPath(); g.arc(gx, gy, cell * 0.28, 0, CA.TAU); g.stroke();
        let [px, py] = at(pos);
        if (anim) {
          const e = 1 - Math.pow(1 - Math.min(1, anim.t), 2), [ax, ay] = at(anim.from), [bx, by] = at(anim.to);
          px = ax + (bx - ax) * e; py = ay + (by - ay) * e;
        }
        g.fillStyle = lock > 0 ? c.muted : c.dot;
        g.beginPath(); g.arc(px, py, cell * 0.26, 0, CA.TAU); g.fill();
        g.restore();
      },
      /* Test helper: the next swipe on a shortest route. */
      _hint() {
        if (done || anim || gap > 0 || lock > 0 || pos === goal) return null;
        const via = bfs(pos).via;
        let t = goal;
        while (via.get(t)[0] !== pos) t = via.get(t)[0];
        return {swipe: via.get(t)[1]};
      },
      _board() { return {n, blocks: blocks.filter(Boolean).length, want: WANT[level - 1]}; }
    };
  }
});
