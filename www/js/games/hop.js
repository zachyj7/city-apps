/* Hop: hold to charge a jump, let go to leap. A marker shows where you will land.
   One continuous course. A flag platform marks the end of each level, and the run carries straight on past it.
   The platforms never change, so every jump length can be learned, and a long jump can skip a platform. */
CA.game({
  id: 'hop', name: 'Hop', arc: '#F5802A', dot: '#6A4CF0', par: 40, keys: 'hold',
  blurb: 'Hold to charge, let go to jump.',
  how: 'Hold to charge a jump. The marker shows where you will land. Let go when it is over a platform. Numbered platforms are the level flags. A long jump can skip a platform. Miss, and you go back to where you jumped from.',
  make(env) {
    const L = env.levels, COUNT = [3, 3, 4, 4, 5, 5, 6, 6, 7, 7];     // platforms per level, the last one is the flag
    const MIN = 0.4, MAXJ = 2.3;                                     // shortest and longest jump, in platform units
    const VIEW = 4.6;                                                // platform units across the screen, so MAXJ is half of it

    /* Build the whole course once. Each level's stretch comes from that level's fixed random stream. */
    const plats = [{x: 0, w: 0.9, flag: 0}], flags = [];
    for (let l = 1, x = 0; l <= L; l++) {
      const rnd = env.rng(l), width = 0.7 - 0.34 * (l - 1) / (L - 1);
      for (let i = 0; i < COUNT[l - 1]; i++) {
        x += 0.95 + rnd() * 0.9;
        const flag = i === COUNT[l - 1] - 1 ? l : 0;
        plats.push({x, w: flag ? Math.max(0.5, width) : width * (0.85 + rnd() * 0.3), flag});
        if (i === COUNT[l - 1] - 1) x = plats[plats.length - 1].x;
      }
      flags.push(plats.length - 1);
    }

    let w = 300, h = 300, cur = 0, cleared = 0;
    let charging = false, charge = 0, fly = null, fallAt = null, cam = 0;
    let lock = 0, shake = 0, time = 0, done = false;

    /* Later levels charge faster, so the timing gets tighter. */
    const rate = () => 3.5 + 2.5 * Math.min(L - 1, cleared) / (L - 1);
    const reach = () => Math.min(MAXJ, MIN + charge);
    const platAt = x => {
      for (let i = cur; i < plats.length && plats[i].x - plats[i].w / 2 <= x; i++) if (Math.abs(x - plats[i].x) <= plats[i].w / 2) return i;
      return -1;
    };

    return {
      layout(W, H) { w = W; h = H; },
      down() {
        if (done || lock > 0 || fly) return;
        charging = true; charge = 0;
      },
      up() {
        if (!charging) return;
        charging = false;
        const d = reach(), x1 = plats[cur].x + d;
        fly = {x0: plats[cur].x, x1, d, t: 0, dur: 0.2 + 0.05 * d, land: platAt(x1)};
      },
      update(dt) {
        time += dt; shake *= Math.exp(-dt * 9);
        if (lock > 0) { lock -= dt; if (lock <= 0) { lock = 0; fallAt = null; } }
        if (charging) charge = Math.min(MAXJ - MIN, charge + rate() * dt);
        if (fly) {
          fly.t += dt / fly.dur;
          if (fly.t >= 1) {
            const f = fly; fly = null;
            if (f.land >= 0) {
              const p = plats[f.land];
              if (f.land !== cur && Math.abs(f.x1 - p.x) <= p.w * 0.15) env.flash('Perfect');
              cur = f.land; env.sfx.hit(cur, false);
              /* Landing on or beyond a flag clears that level. The run just keeps going. */
              while (cleared < L && cur >= flags[cleared]) {
                cleared++; env.level(cleared);
                if (cleared < L) env.sfx.clear();
              }
              if (cleared >= L) { done = true; env.finish(); }
            } else {
              fallAt = f.x1; lock = 0.5; shake = 1; env.flash('Miss', true); env.sfx.miss();
            }
          }
        }
        const focus = fly ? fly.x0 + (fly.x1 - fly.x0) * Math.min(1, fly.t) : plats[cur].x;
        cam += (focus - cam) * Math.min(1, dt * 9);
      },
      draw(g) {
        const c = env.col, U = Math.min(w / VIEW, 100), Y = h * 0.6, r = U * 0.17;
        const sx = x => w * 0.25 + (x - cam) * U;
        g.save();
        if (!env.RM) g.translate(Math.sin(time * 70) * 8 * shake, 0);
        g.textAlign = 'center'; g.textBaseline = 'middle';
        /* platforms: level flags are in the game color and carry their level number */
        for (const p of plats) {
          const x = sx(p.x) - p.w * U / 2;
          if (x > w + 40 || x + p.w * U < -40) continue;
          g.fillStyle = p.flag ? c.arc : c.track;
          CA.rr(g, x, Y, p.w * U, h - Y + 30, Math.min(12, p.w * U * 0.25)); g.fill();
          if (p.flag) { g.fillStyle = '#0B1F22'; g.font = CA.font(14); g.fillText(String(p.flag), sx(p.x), Y + 18); }
        }
        /* landing marker */
        if (charging) {
          const lx = plats[cur].x + reach(), on = platAt(lx) > cur, mx = sx(lx);
          g.fillStyle = on ? c.arc : c.muted;
          g.beginPath(); g.moveTo(mx, Y - 4); g.lineTo(mx - 9, Y - 20); g.lineTo(mx + 9, Y - 20); g.closePath(); g.fill();
        }
        /* the dot */
        let dx = plats[cur].x, dy = Y - r, squash = 1;
        if (fly) {
          const t = Math.min(1, fly.t);
          dx = fly.x0 + (fly.x1 - fly.x0) * t; dy = Y - r - Math.sin(Math.PI * t) * U * (0.45 + 0.14 * fly.d);
        } else if (fallAt != null) {
          dx = fallAt; dy = Y - r + (0.5 - lock) * (h - Y) * 2.4;
        } else if (charging) squash = 1 - 0.3 * (charge / (MAXJ - MIN));
        g.fillStyle = lock > 0 ? c.muted : c.dot;
        g.beginPath(); g.ellipse(sx(dx), dy + r * (1 - squash), r * (2 - squash), r * squash, 0, 0, CA.TAU); g.fill();
        g.restore();
        if (!done) {
          const left = flags[Math.min(L - 1, cleared)] - cur;
          g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillStyle = c.muted; g.font = CA.font(15, 600);
          g.fillText(left + (left === 1 ? ' jump to the flag' : ' platforms to the flag'), w / 2, 46);
        }
      },
      /* Test helper: press, then let go when the jump reaches the next platform's middle. */
      _hint() {
        if (done || lock > 0 || fly) return null;
        if (!charging) return {press: 1};
        return reach() >= plats[cur + 1].x - plats[cur].x - 0.02 ? {release: 1} : null;
      }
    };
  }
});
