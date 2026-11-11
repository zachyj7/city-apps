/* Pivot: timing. Tap when the dot is inside the zone.
   Game shape used by every City Apps game:
     CA.game({id, name, blurb, how, arc, dot, par, keys, make(env)})
     make(env) returns {layout(w,h), update(dt), draw(g), down(x,y), move?(x,y), up?()}
     env gives: levels, rng(level), col, RM, sfx, flash(text, bad), level(n) when level n is cleared, finish() */
CA.game({
  id: 'pivot', name: 'Pivot', arc: '#0FA08C', dot: '#EE3F74', par: 50, keys: 'tap',
  blurb: 'Tap when the dot is in the zone.',
  how: 'Tap when the dot is inside the zone. The bright center counts double. A miss costs you a lap.',
  make(env) {
    const TAU = CA.TAU, DEG = Math.PI / 180, L = env.levels;
    let w = 300, h = 300, size = 300, level = 1, rnd;
    let angle, dir, rem, target, half, omega, need, left;
    let locked = 0;               // after a miss: 1 = taps off until the far side of the ring, 2 = until the dot has passed the zone
    let clearT = -1, pulse = 0, shake = 0, time = 0, streak = 0, done = false;

    const geom = () => { const lw = size * 0.085, R = size / 2 - lw / 2 - 12; return {cx: w / 2, cy: h / 2, lw, R}; };
    const tol = () => { const g = geom(); return (g.lw * 0.42 / g.R) * 0.5; };
    function spawn(minDeg) {
      const lo = minDeg || 100;
      rem = (lo + rnd() * (270 - lo)) * DEG;
      target = angle + dir * rem;
    }
    function setup() {
      const k = (level - 1) / (L - 1);
      need = 3 + Math.ceil(level * 0.5); left = need;
      omega = 2.4 + 3.6 * k; half = (44 - 24 * k) / 2 * DEG;
      rnd = env.rng(level);
      angle = -Math.PI / 2; dir = 1; spawn(160);
      locked = 0; streak = 0; clearT = -1;
    }
    setup();

    return {
      layout(W, H) { w = W; h = H; size = Math.max(150, Math.min(W, H, 440)); },
      down() {
        if (done || clearT >= 0 || locked) return;
        if (Math.abs(rem) <= half + tol()) {
          const perfect = Math.abs(rem) <= half * 0.34, n = need - left;
          left = Math.max(0, left - (perfect ? 2 : 1));
          streak = perfect ? streak + 1 : 0;
          if (perfect) env.flash(streak > 1 ? 'Perfect ×' + streak : 'Perfect');
          pulse = 1; env.sfx.hit(n, perfect);
          if (left <= 0) {
            clearT = 0; env.level(level);
            if (level >= L) { done = true; env.finish(); } else env.sfx.clear();
          } else { dir = -dir; spawn(); }
        } else {
          /* The dot keeps going. Taps stay off until it comes back around, so spamming never pays. */
          locked = rem > Math.PI ? 1 : 2;
          shake = 1; streak = 0;
          env.flash('Miss', true); env.sfx.miss();
        }
      },
      update(dt) {
        time += dt; pulse *= Math.exp(-dt * 10); shake *= Math.exp(-dt * 9);
        if (clearT >= 0) {
          clearT += dt / 0.4;
          if (clearT >= 1 && !done) { level++; setup(); }
          return;
        }
        rem -= omega * dt;
        if (locked === 1 && rem <= Math.PI) locked = 0;
        if (rem < -(half + tol())) { rem += TAU; target += dir * TAU; locked = 0; streak = 0; }
        angle = target - dir * rem;
      },
      draw(g) {
        const {cx, cy, lw, R} = geom(), c = env.col;
        g.save();
        if (!env.RM) {
          const sc = 1 + 0.03 * pulse;
          g.translate(cx + Math.sin(time * 70) * 9 * shake, cy); g.scale(sc, sc); g.translate(-cx, -cy);
        }
        g.lineCap = 'round'; g.lineWidth = lw; g.strokeStyle = c.track;
        g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke();
        if (clearT >= 0) {
          const e = 1 - Math.pow(1 - Math.min(1, clearT), 3);
          g.strokeStyle = c.arc;
          g.beginPath(); g.arc(cx, cy, R, angle, angle + Math.max(0.001, TAU * e)); g.stroke();
        } else {
          const cap = (lw / 2) / R, a = Math.max(half - cap, 0.002), pa = half * 0.34;
          g.strokeStyle = c.arc;
          g.beginPath(); g.arc(cx, cy, R, target - a, target + a); g.stroke();
          g.lineCap = 'butt'; g.lineWidth = lw * 0.4; g.strokeStyle = 'rgba(255,255,255,.42)';
          g.beginPath(); g.arc(cx, cy, R, target - pa, target + pa); g.stroke();
        }
        const mx = cx + Math.cos(angle) * R, my = cy + Math.sin(angle) * R, mr = lw * 0.42;
        g.fillStyle = c.bg; g.beginPath(); g.arc(mx, my, mr + 3.5, 0, TAU); g.fill();
        g.fillStyle = locked ? c.muted : c.dot; g.beginPath(); g.arc(mx, my, mr, 0, TAU); g.fill();
        g.restore();

        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = c.ink; g.font = CA.font(size * 0.3);
        g.fillText(String(left), cx, cy - size * 0.03);
        g.fillStyle = c.muted; g.font = CA.font(Math.max(13, size * 0.045), 500);
        g.fillText(left === 1 ? 'hit to go' : 'hits to go', cx, cy + size * 0.16);
      },
      /* Test helper: where a perfect player would tap right now, or null to wait. */
      _hint() { return (!done && clearT < 0 && !locked && Math.abs(rem) <= half * 0.9 && Math.abs(rem) > half * 0.4) ? {x: w / 2, y: h / 2} : null; }
    };
  }
});
