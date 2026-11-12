/* Ring combat. One input: tap.
   A dot circles the ring. Coloured zones sit on it:
     teal   strike zone   tap inside to hit, bright centre is a critical. A hit flips the dot, like Pivot.
     red    enemy attack  tap inside to parry, centre is a riposte. Let the dot pass through and you are hit.
     other  glyph zones   one per equipped glyph, each with its own effect.
   Tapping on empty ring is a miss and locks the dot for a moment, so mashing never pays.
   Filling Focus lets you trigger Flow: for a few seconds every tap is a hit. */
import { TAU, clamp, angDiff } from './util.js';
import { ITEMS } from './data.js';

const DEG = Math.PI / 180;
const rand = (a, b) => a + Math.random() * (b - a);

export class Combat {
  constructor(g) { this.g = g; this.active = false; this.foes = []; this.floats = []; this.zones = []; this.flowT = 0; }

  start(foes) {
    const g = this.g;
    this.st = g.stats();
    this.foes = foes;
    for (const f of foes) { f.cd = rand(0.9, 1.7) + foes.indexOf(f) * 1.3; f.stun = 0; f.burn = 0; f.armor = f.def.armor || 0; f.swing = 0; f.hitT = 0; f.patI = 0; }
    this.boss = foes.some(f => f.def.boss);
    this.tutorial = foes.some(f => f.def.tutorial);
    this.angle = -Math.PI / 2; this.dir = 1; this.zones = [];
    this.lock = 0; this.combo = 0; this.flowT = 0; this.slowT = 0; this.echo = 0; this.potCd = 0;
    this.time = 0; this.pulse = 0; this.shakeT = 0; this.flash = null; this.over = 0; this.result = null; this.lastTap = -1;
    this.floats = [];
    this.glyphs = this.st.glyphs.map((id, i) => ({ id, it: ITEMS[id], cd: 3 + i * 3 }));
    this.active = true;
    this.spawnStrike(170);
    if (this.st.weapon.twin) this.spawnStrike();
    this.say(this.boss ? foes[0].def.name : 'Fight!');
  }

  get target() { return this.foes.find(f => f.hp > 0); }
  get omega() {
    const t = this.target, base = t ? t.def.tempo * (t.phase2 ? 1.12 : 1) : 2.5;
    return base * this.st.slow * (this.slowT > 0 ? 0.62 : 1) * (1 + Math.min(this.combo, 10) * 0.012);
  }
  guards() { return this.zones.filter(z => z.kind === 'guard'); }
  say(text, bad) { this.flash = { text, bad, t: 0 }; }
  float(f, text, color) {
    const p = f ? this.g.project(f.model, 2.2 * (f.model.scale.y || 1)) : this.g.projectPlayer();
    this.floats.push({ x: p.x + rand(-24, 24), y: p.y, text, color, t: 0 });
  }

  /* Find a spot ahead of the dot that does not overlap another zone. */
  freeAngle(lo, hi, half) {
    let a = 0;
    for (let i = 0; i < 10; i++) {
      a = this.angle + this.dir * rand(lo, hi) * DEG;
      if (this.zones.every(z => Math.abs(angDiff(a, z.a)) > z.half + half + 0.12)) break;
    }
    return a;
  }
  spawnStrike(min) {
    const half = 21 * DEG * (this.st.weapon.zone || 1) * (this.st.weapon.twin ? 0.8 : 1);
    this.zones.push({ kind: 'strike', a: this.freeAngle(min || 95, 255, half), half, v: 0 });
  }

  enemyAttack(f) {
    const d = f.def, pats = f.phase2 && d.pat2 ? d.pat2 : d.pat;
    let p = pats[f.patI++ % pats.length];
    if (p === 'flip' && this.guards().length) p = 'single';
    const half = 17 * DEG * this.st.guardMul, lead = Math.max(115, this.omega * 0.72 / DEG);
    const add = (off, o = {}) => this.zones.push(Object.assign({ kind: 'guard', a: this.angle + this.dir * (lead + off) * DEG, half, foe: f, dmg: d.atk, v: 0, entered: false }, o));
    if (p === 'flip') { this.dir = -this.dir; this.say('Reversed!', true); this.g.sfx.flip(); add(40); }
    else if (p === 'double') { add(0); add(62); }
    else if (p === 'triple') { for (let i = 0; i < 3; i++) add(i * 52, { dmg: d.atk * 0.75 }); }
    else if (p === 'drift') add(50, { v: -this.dir * 0.55 });
    else if (p === 'feint') add(0, { jump: 0.42 });
    else if (p === 'heavy') add(110, { half: half * 0.68, dmg: d.atk * 1.7, heavy: true });
    else add(rand(0, 60));
    f.wind = 1;
    this.g.sfx.warn();
  }

  hitFoe(f, dmg, color, label) {
    if (!f || f.hp <= 0) return;
    dmg = Math.max(1, Math.round(dmg));
    f.hp -= dmg; f.hitT = 1;
    this.float(f, (label ? label + ' ' : '') + dmg, color || '#ffffff');
    if (!f.phase2 && f.def.pat2 && f.hp > 0 && f.hp <= f.maxHp / 2) { f.phase2 = true; this.say(f.def.name + ' quickens!', true); f.cd = 1.5; }
    if (f.hp <= 0) {
      f.hp = 0; this.zones = this.zones.filter(z => z.foe !== f); this.g.sfx.kill();
      if (!this.target) { this.over = 0.9; this.result = 'win'; this.zones = []; }
    }
  }
  hurt(z) {
    const dmg = Math.max(1, Math.round(z.dmg - this.st.def));
    this.combo = 0; this.shakeT = 1; z.foe.swing = 1;
    this.float(null, '-' + dmg, '#ff6b81');
    this.g.sfx.hurt(); this.g.shake(z.heavy ? 0.7 : 0.4);
    if (this.g.hurt(dmg)) { this.over = 1.2; this.result = 'lose'; this.zones = []; this.say('Stilled...', true); }
  }
  addFocus(n) { if (this.flowT <= 0) this.g.focus = clamp(this.g.focus + n * this.st.focusMul, 0, 100); }

  tap() {
    const g = this.g, st = this.st;
    if (!this.active || this.over) return;
    if (this.time - this.lastTap < (this.flowT > 0 ? 0.11 : 0.07)) return;
    this.lastTap = this.time;
    const t = this.target;
    if (this.flowT > 0) {
      this.zones = this.zones.filter(z => !(z.kind === 'guard' && Math.abs(angDiff(this.angle, z.a)) <= z.half + 0.1));
      this.combo++; this.pulse = 1; g.playerSwing(); g.sfx.hit(this.combo, true);
      this.hitFoe(t, st.atk * 0.45, '#ffe08a');
      return;
    }
    if (this.lock > 0) return;
    const tol = 0.055;
    let best = null;
    for (const z of this.zones) {
      const d = Math.abs(angDiff(this.angle, z.a));
      if (d <= z.half + tol && (!best || rank(z) < rank(best))) { best = z; best.d = d; }
    }
    if (!best) {
      this.lock = 0.55; this.combo = 0; this.shakeT = 0.6; this.say('Miss', true); g.sfx.miss();
      return;
    }
    this.zones.splice(this.zones.indexOf(best), 1);
    this.pulse = 1;
    if (best.kind === 'guard') {
      const perfect = best.d <= best.half * 0.42;
      if (perfect) {
        this.say('Riposte!'); g.sfx.parry(true); g.playerSwing(); this.addFocus(14);
        best.foe.stun = 1.3; this.hitFoe(best.foe, st.atk * 1.5, '#ffe08a');
      } else { this.say('Parry'); g.sfx.parry(false); this.addFocus(6); this.float(null, 'Block', '#9fe6ff'); }
      return;
    }
    if (best.kind === 'glyph') {
      const gl = this.glyphs.find(x => x.id === best.glyph);
      gl.cd = gl.it.cd; g.sfx.glyph(); g.playerSwing(); this.addFocus(5);
      switch (best.glyph) {
        case 'g_mend': { const n = Math.round(st.maxHp * 0.2); g.heal(n); this.float(null, '+' + n, '#6fe08a'); this.say('Mended'); break; }
        case 'g_ember': this.hitFoe(t, st.atk * 1.6, '#ff9a3c'); if (t) t.burn = 4; this.say('Burning'); break;
        case 'g_frost': this.slowT = 6; this.say('Time slows'); break;
        case 'g_storm': for (const f of this.foes) this.hitFoe(f, st.atk * 1.3, '#f4e04d'); this.say('Storm'); break;
        case 'g_thief': { const n = 6 + g.S.level * 3; g.addCoins(n); this.hitFoe(t, st.atk, '#e08fe0'); this.float(null, '+' + n + ' coin', '#ffd58a'); break; }
        case 'g_echo': this.echo = 3; this.say('Echo ×3'); break;
      }
      return;
    }
    /* strike */
    const perfect = best.d <= best.half * 0.36 * (st.weapon.crit || 1);
    let dmg = st.atk * (1 + Math.min(this.combo, 10) * 0.05) * (perfect ? (st.weapon.critDmg || 1.75) : 1), label = perfect ? 'Crit' : '';
    if (t && t.armor > 0) {
      if (perfect) { t.armor--; this.say(t.armor ? 'Armour cracked' : 'Armour broken!'); g.sfx.crack(); }
      else { dmg *= 0.3; label = 'Glancing'; }
    } else if (perfect) this.say(this.combo > 1 ? 'Perfect ×' + (this.combo + 1) : 'Perfect');
    this.combo++;
    g.playerSwing(); g.sfx.hit(this.combo, perfect);
    this.addFocus(perfect ? 12 : 6);
    if (perfect && st.weapon.chill) this.slowT = Math.max(this.slowT, 2);
    this.hitFoe(t, dmg, perfect ? '#ffe08a' : '#ffffff', label);
    if (this.echo > 0 && !this.over) { this.echo--; this.hitFoe(this.target, dmg * 0.8, '#ffffff', 'Echo'); }
    if (this.over) return;
    if (!this.guards().length) this.dir = -this.dir;
    this.spawnStrike();
  }

  flow() {
    if (!this.active || this.over || this.g.focus < 100 || this.flowT > 0) return;
    this.g.focus = 0; this.flowT = 4; this.lock = 0; this.say('FLOW'); this.g.sfx.flow();
  }
  potion() {
    if (!this.active || this.over || this.potCd > 0) return;
    if (this.g.usePotion()) this.potCd = 3;
  }
  flee() {
    if (!this.active || this.over || this.boss) return;
    this.over = 0.3; this.result = 'flee'; this.zones = [];
  }

  update(dt) {
    if (!this.active) return;
    const g = this.g;
    this.time += dt; this.pulse *= Math.exp(-dt * 10); this.shakeT *= Math.exp(-dt * 9);
    if (this.flash && (this.flash.t += dt) > 0.9) this.flash = null;
    for (const fl of this.floats) fl.t += dt;
    this.floats = this.floats.filter(fl => fl.t < 1);
    for (const f of this.foes) { f.hitT *= Math.exp(-dt * 8); if (f.swing > 0) f.swing = Math.max(0, f.swing - dt * 3); }
    if (this.over) {
      this.over -= dt;
      if (this.over <= 0) { this.active = false; g.endCombat(this.result); }
      return;
    }
    this.lock = Math.max(0, this.lock - dt); this.slowT = Math.max(0, this.slowT - dt);
    this.potCd = Math.max(0, this.potCd - dt); this.flowT = Math.max(0, this.flowT - dt);
    this.angle += this.dir * this.omega * dt;

    for (const z of [...this.zones]) {
      z.a += z.v * dt;
      const inside = Math.abs(angDiff(this.angle, z.a)) <= z.half + 0.055;
      if (z.kind === 'guard') {
        if (z.jump !== undefined && !z.entered && (z.jump -= dt) <= 0) { z.a += this.dir * 62 * DEG; z.jump = undefined; g.sfx.flip(); }
        if (inside) z.entered = true;
        else if (z.entered) {
          this.zones.splice(this.zones.indexOf(z), 1);
          if (this.flowT > 0) { this.float(null, 'Flow', '#ffe08a'); } else { this.hurt(z); if (this.over) return; }
        }
      } else if (z.kind === 'strike') {
        if (inside) z.entered = true;
        else if (z.entered) { z.entered = false; if (this.flowT <= 0) this.combo = 0; }
      }
    }

    for (const f of this.foes) {
      if (f.hp <= 0) continue;
      if (f.burn > 0) { f.burn -= dt; f.burnAcc = (f.burnAcc || 0) + dt; if (f.burnAcc >= 1) { f.burnAcc = 0; this.hitFoe(f, this.st.atk * 0.3, '#ff9a3c'); if (this.over) return; } }
      if (f.stun > 0) { f.stun -= dt; continue; }
      f.cd -= dt;
      if (f.cd <= 0 && this.guards().length < 3) {
        this.enemyAttack(f);
        const e = f.def.every, q = f.phase2 ? 0.82 : f.def.boss ? 1 : 0.8;
        f.cd = rand(e[0], e[1]) * q + (this.tutorial && f.patI === 1 ? 2 : 0);
      }
    }
    for (const gl of this.glyphs) {
      if (this.zones.some(z => z.glyph === gl.id)) continue;
      gl.cd -= dt;
      if (gl.cd <= 0) this.zones.push({ kind: 'glyph', glyph: gl.id, a: this.freeAngle(120, 300, 14 * DEG), half: 14 * DEG, v: 0 });
    }
  }

  /* Test helper: true when a careful player would tap right now. */
  _hint() {
    if (!this.active || this.over || this.lock > 0) return false;
    if (this.flowT > 0) return true;
    return this.zones.some(z => Math.abs(angDiff(this.angle, z.a)) <= z.half * 0.3);
  }

  layout(w, h) { this.w = w; this.h = h; this.R = Math.min(w * 0.42, h * 0.36, 250); this.cx = w / 2; this.cy = h * 0.5; }

  draw(c) {
    const { cx, cy, R } = this, lw = Math.max(16, R * 0.14);
    c.save();
    if (this.shakeT > 0.02) c.translate(Math.sin(this.time * 70) * 9 * this.shakeT, 0);
    const sc = 1 + 0.025 * this.pulse;
    c.translate(cx, cy); c.scale(sc, sc); c.translate(-cx, -cy);
    c.lineCap = 'round'; c.lineWidth = lw;
    c.strokeStyle = this.flowT > 0 ? 'rgba(255,214,120,' + (0.55 + Math.sin(this.time * 14) * 0.15) + ')' : 'rgba(12,12,34,0.6)';
    c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.stroke();
    c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,0.22)';
    c.beginPath(); c.arc(cx, cy, R + lw / 2, 0, TAU); c.stroke(); c.beginPath(); c.arc(cx, cy, R - lw / 2, 0, TAU); c.stroke();

    const cap = (lw / 2) / R;
    for (const z of this.zones) {
      const a = Math.max(z.half - cap, 0.01);
      let color = '#22d3b4', centre = 0.36 * (this.st.weapon.crit || 1);
      if (z.kind === 'guard') { color = z.heavy ? '#ff2d55' : '#ff5470'; centre = 0.42; }
      if (z.kind === 'glyph') { color = ITEMS[z.glyph].color; centre = 0; }
      c.lineCap = 'round'; c.lineWidth = lw; c.strokeStyle = color;
      if (z.kind === 'guard') { c.shadowColor = '#ff2d55'; c.shadowBlur = 14 + Math.sin(this.time * 12) * 6; }
      c.beginPath(); c.arc(cx, cy, R, z.a - a, z.a + a); c.stroke(); c.shadowBlur = 0;
      if (centre) {
        c.lineCap = 'butt'; c.lineWidth = lw * 0.42; c.strokeStyle = 'rgba(255,255,255,0.6)';
        c.beginPath(); c.arc(cx, cy, R, z.a - z.half * centre, z.a + z.half * centre); c.stroke();
      }
      const ix = cx + Math.cos(z.a) * (R + lw * 0.95), iy = cy + Math.sin(z.a) * (R + lw * 0.95);
      c.font = '700 ' + Math.round(lw * 0.62) + 'px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = color;
      c.fillText(z.kind === 'guard' ? (z.heavy ? '‼' : '!') : z.kind === 'glyph' ? ITEMS[z.glyph].icon : '', ix, iy);
    }
    const mx = cx + Math.cos(this.angle) * R, my = cy + Math.sin(this.angle) * R, mr = lw * 0.44;
    c.fillStyle = 'rgba(12,12,34,0.9)'; c.beginPath(); c.arc(mx, my, mr + 4, 0, TAU); c.fill();
    c.fillStyle = this.lock > 0 ? '#7a7a8a' : this.slowT > 0 ? '#8fd0ff' : '#ffd58a';
    c.shadowColor = c.fillStyle; c.shadowBlur = this.lock > 0 ? 0 : 16;
    c.beginPath(); c.arc(mx, my, mr, 0, TAU); c.fill(); c.shadowBlur = 0;
    c.restore();

    c.textAlign = 'center'; c.textBaseline = 'middle';
    const txt = (s, x, y, size, color, weight = 800) => {
      c.font = weight + ' ' + Math.round(size) + 'px system-ui, sans-serif';
      c.lineWidth = Math.max(3, size * 0.16); c.strokeStyle = 'rgba(10,10,30,0.85)'; c.lineJoin = 'round';
      c.strokeText(s, x, y); c.fillStyle = color; c.fillText(s, x, y);
    };
    if (this.combo > 1) txt('×' + this.combo, cx, cy - R + lw * 1.5, R * 0.16, '#ffd58a');
    if (this.echo > 0) txt('echo ' + this.echo, cx, cy - R + lw * 1.5 + R * 0.15, R * 0.09, '#ffffff', 600);
    if (this.flash) {
      const k = 1 - this.flash.t / 0.9;
      c.globalAlpha = clamp(k * 2, 0, 1);
      txt(this.flash.text, cx, cy + R * 0.52 - (1 - k) * 12, R * 0.15, this.flash.bad ? '#ff6b81' : '#ffffff');
      c.globalAlpha = 1;
    }
    for (const fl of this.floats) {
      c.globalAlpha = clamp((1 - fl.t) * 2, 0, 1);
      txt(fl.text, fl.x, fl.y - fl.t * 46, Math.max(17, R * 0.12), fl.color);
      c.globalAlpha = 1;
    }
    /* enemy health */
    const alive = this.foes, bw = Math.min(this.w * 0.6, 340), top = Math.max(46, cy - R - lw - 34 * alive.length - 8);
    alive.forEach((f, i) => {
      const y = top + i * 34, x = cx - bw / 2, k = clamp(f.hp / f.maxHp, 0, 1);
      c.globalAlpha = f.hp > 0 ? 1 : 0.35;
      txt(f.def.name + (f.armor ? '  ' + '🛡'.repeat(f.armor) : ''), cx, y, 14, f === this.target ? '#ffffff' : '#c8c8d8', 700);
      c.fillStyle = 'rgba(12,12,34,0.7)'; c.fillRect(x, y + 10, bw, 9);
      c.fillStyle = f.burn > 0 ? '#ff9a3c' : '#ff5470'; c.fillRect(x, y + 10, bw * k, 9);
      c.globalAlpha = 1;
    });
    if (this.tutorial) {
      const s = this.zones.some(z => z.kind === 'guard') ? 'RED zone: tap as the dot passes through to parry' : 'Tap when the dot is inside the TEAL zone';
      txt(s, cx, Math.min(this.h - 96, cy + R + lw + 26), Math.min(17, this.w * 0.04), '#ffffff', 700);
    }
  }
}
const rank = z => z.kind === 'guard' ? 0 : z.kind === 'glyph' ? 1 : 2;
