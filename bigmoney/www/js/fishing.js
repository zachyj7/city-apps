// Fishing off the pier, and the tackle shop's upgrade tree.
import * as THREE from './vendor/three.module.min.js';
import { G, S, save, addMoney, buff, UPGRADES, BRANCHES, FISH, RARITY } from './state.js';
import { $, fmt, toast, openPanel, canPay, esc } from './ui.js';
import { prop } from './avatar.js';
import { sfx } from './audio.js';

const F = { on: false, phase: 'idle', power: 0, dir: 1, t: 0, held: false };
const up = id => !!S.fish.up[id];
const tier = pre => { let n = 0; for (let i = 1; i <= 4; i++) if (up(pre + i)) n = i; return n; };
let ui, bobber, line, tip, show, splashes = [];

export function initFishing() {
  ui = $('#fishui');
  const b = $('#fAct');
  b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); press(true); });
  for (const ev of ['pointerup', 'pointercancel']) b.addEventListener(ev, () => press(false));
  $('#fExit').onclick = exitFishing;
}
export function fishKey(code, down) {
  if (code === 'Space' || code === 'KeyE') press(down);
  else if (down && code === 'Escape') exitFishing();
}

export function enterFishing(it) {
  const sp = G.layout.fish.spots.reduce((a, s) => Math.hypot(s.x - it.x, s.z - it.z) < Math.hypot(a.x - it.x, a.z - it.z) ? s : a);
  if (!bobber) {
    bobber = prop('bobber');
    line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: '#e8f4ff', transparent: true, opacity: 0.7 }));
    line.frustumCulled = false;
    tip = new THREE.Object3D(); tip.position.y = 2.27;
  }
  Object.assign(G.pos, { x: sp.x, z: sp.z, r: sp.rot, y: 0 });
  G.mode = 'fish'; G.anim = 2;
  G.me.hold('rod'); G.me.held.add(tip);
  G.me.held.traverse(m => { if (m.isMesh && m.material.name === 'rod_blank') { m.material = m.material.clone(); m.material.color.set(['#2a2a30', '#3f7ae0', '#15151a', '#c9ccd2', '#d9a93a'][tier('rod')]); m.material.metalness = tier('rod') >= 3 ? 0.9 : 0.2; } });
  G.cam.yaw = Math.PI / 2 + 0.35; G.cam.pitch = 0.3; G.cam.dist = 6;
  Object.assign(F, { on: true, phase: 'idle', held: false, sp });
  G.scene.add(line);
  ui.classList.remove('hidden');
  document.body.classList.add('fishing');
  hud('Hold to charge a cast, let go to throw.');
}
export function exitFishing() {
  if (!F.on) return;
  F.on = false;
  G.scene.remove(bobber); G.scene.remove(line);
  if (show) { G.scene.remove(show.o); show = null; }
  G.me.hold('');
  G.mode = 'walk'; G.anim = 0;
  G.pos.x += 0.5;
  G.cam.dist = 6.5;
  ui.classList.add('hidden');
  document.body.classList.remove('fishing');
}

function hud(msg) {
  const lab = { idle: 'CAST', charge: 'CAST', cast: '…', wait: 'REEL IN', bite: 'HOOK!', reel: 'REEL', done: 'CAST' }[F.phase];
  $('#fAct').textContent = lab;
  $('#fAct').classList.toggle('alert', F.phase === 'bite');
  $('#fBars').classList.toggle('hidden', F.phase !== 'reel' && F.phase !== 'charge');
  $('#fBars').classList.toggle('charge', F.phase === 'charge');
  if (msg != null) $('#fMsg').innerHTML = msg;
}

function press(down) {
  if (!F.on) return;
  F.held = down;
  if (down) {
    if (F.phase === 'idle' || F.phase === 'done') { if (show) { G.scene.remove(show.o); show = null; } F.phase = 'charge'; F.power = 0; F.dir = 1; hud('Let go to cast.'); }
    else if (F.phase === 'wait') { F.phase = 'idle'; G.scene.remove(bobber); hud('Reeled in. Hold to cast again.'); }
    else if (F.phase === 'bite') { F.phase = 'reel'; F.tension = 0.25; F.surge = 0; F.surgeIn = 1 + Math.random(); sfx('hit'); hud(`Something's on! Hold to reel, ease off when the line turns red.`); }
  } else if (F.phase === 'charge') cast();
}

function cast() {
  const w = G.layout.fish.water, d = 4 + F.power * 10;
  F.dist0 = F.dist = d;
  F.from = tip.getWorldPosition(new THREE.Vector3());
  F.to = new THREE.Vector3(Math.max(w.x1, F.sp.x - d), w.y + 0.02, Math.max(w.z1, Math.min(w.z2, F.sp.z + (Math.random() - 0.5) * 3)));
  F.phase = 'cast'; F.t = 0;
  G.scene.add(bobber);
  sfx('cast'); hud('');
}

function pickFish() {
  const rod = tier('rod'), luck = [1, 1, 1.35, 2.1, 3.3][tier('bait')];
  const w = { junk: up('gear2') ? 0 : 14, common: 60, uncommon: 20 * (1 + rod * 0.5), rare: 5 * (rod >= 2 ? 1 + (rod - 2) * 0.8 : 0.15) * luck,
    epic: 0.9 * (rod >= 3 ? 1 + (rod - 3) : rod === 2 ? 0.1 : 0) * luck, legendary: 0.12 * (rod >= 4 ? 1 : rod === 3 ? 0.1 : 0) * luck };
  let r = Math.random() * Object.values(w).reduce((a, b) => a + b, 0), rar = 'common';
  for (const k in w) { r -= w[k]; if (r < 0) { rar = k; break; } }
  const pool = FISH.filter(f => f.r === rar), f = pool[(Math.random() * pool.length) | 0];
  const size = 0.7 + Math.random() * Math.random() * 0.9 + Math.random() * 0.3;
  return { f, size };
}

function land() {
  const { f, size } = F.fish;
  const sell = up('gear4') ? 1.6 : up('gear2') ? 1.3 : up('gear1') ? 1.15 : 1;
  const dbl = up('gear3') && f.r !== 'junk' && Math.random() < 0.2;
  const val = Math.max(1, Math.round(f.v * size * sell)) * (dbl ? 2 : 1);
  const lb = (f.len * size * (f.r === 'junk' ? 1 : 3.2) * (0.8 + f.s * 0.5)).toFixed(1);
  addMoney(val);
  S.fish.caught++;
  const lg = S.fish.log[f.id] || (S.fish.log[f.id] = { n: 0, best: 0 });
  const first = lg.n === 0;
  lg.n++; lg.best = Math.max(lg.best, +lb);
  save();
  sfx(f.r === 'legendary' || f.r === 'epic' ? 'big' : 'win');
  // hold the catch up
  const o = prop(f.m);
  o.traverse(m => { if (m.isMesh && (m.material.name === 'fish_body' || m.material.name === 'fish_fin')) { m.material = m.material.clone(); m.material.color.set(f.c); if (m.material.name === 'fish_fin') m.material.color.multiplyScalar(0.7); if (f.shiny) { m.material.metalness = 0.8; m.material.roughness = 0.25; } } });
  o.scale.setScalar(f.len * size * 1.1);
  o.position.copy(bobber.position);
  G.scene.add(o);
  show = { o, t: 0, from: bobber.position.clone() };
  G.scene.remove(bobber);
  F.phase = 'done';
  hud(`<span style="color:${RARITY[f.r]}">${f.r.toUpperCase()}</span> <b>${esc(f.name)}</b> · ${lb} lb · sold for <b>${fmt(val)}</b>${dbl ? ' (double catch!)' : ''}${first ? ' · NEW' : ''}`);
  if (f.r === 'legendary' || f.r === 'epic') G.send({ t: 'ev', k: 'say', v: `caught a ${f.r} ${f.name} worth ${fmt(val)}!` });
}

function splash(p) {
  sfx('splash');
  const m = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.16, 20), new THREE.MeshBasicMaterial({ color: '#e8fbff', transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(p.x, G.layout.fish.water.y + 0.03, p.z);
  G.scene.add(m); splashes.push({ m, t: 0 });
}

export function updateFishing(dt) {
  for (const s of splashes) { s.t += dt; s.m.scale.setScalar(1 + s.t * 7); s.m.material.opacity = 0.9 - s.t * 1.3; }
  splashes = splashes.filter(s => { if (s.t > 0.7) { G.scene.remove(s.m); s.m.geometry.dispose(); return false; } return true; });
  if (!F.on) return;
  F.t += dt;
  const w = G.layout.fish.water, wy = w.y + 0.02;
  if (F.phase === 'charge') {
    F.power += F.dir * dt * 1.25;
    if (F.power >= 1) { F.power = 1; F.dir = -1; } else if (F.power <= 0) { F.power = 0; F.dir = 1; }
    $('#fProg').style.width = F.power * 100 + '%';
  } else if (F.phase === 'cast') {
    const k = Math.min(1, F.t / 0.8);
    bobber.position.lerpVectors(F.from, F.to, k);
    bobber.position.y += Math.sin(k * Math.PI) * 3;
    if (k >= 1) {
      F.phase = 'wait'; F.t = 0; splash(F.to);
      const sooner = [1, 0.75, 0.55, 0.5, 0.45][tier('bait')] * (buff('angler') ? 0.7 : 1);
      F.biteAt = (2.2 + Math.random() * 6) * sooner;
      hud('Wait for a bite…');
    }
  } else if (F.phase === 'wait') {
    bobber.position.set(F.to.x, wy + Math.sin(F.t * 2.2) * 0.025, F.to.z);
    if (F.t > F.biteAt) { F.phase = 'bite'; F.t = 0; F.fish = pickFish(); F.window = up('hook1') ? 1.5 : 0.95; sfx('bite'); splash(F.to); hud('<b>BITE!</b>'); }
  } else if (F.phase === 'bite') {
    bobber.position.y = wy - 0.12 + Math.sin(F.t * 30) * 0.03;
    if (F.t > F.window) { F.phase = 'idle'; G.scene.remove(bobber); sfx('lose'); hud('Too slow, it stole the bait. Cast again.'); }
  } else if (F.phase === 'reel') {
    const s = F.fish.f.s;
    F.surgeIn -= dt;
    if (F.surgeIn <= 0) { F.surge = F.surge ? 0 : 1; F.surgeIn = F.surge ? 0.7 + Math.random() * 0.9 : 1.2 + Math.random() * 2; if (F.surge) splash(bobber.position); }
    const lineMul = [1, 0.8, 0.65, 0.5][tier('line')], reelMul = [1, 1.25, 1.5, 2][tier('reel')];
    if (F.held) { F.dist -= 1.7 * reelMul * dt / (1 + s * 0.12); F.tension += (0.3 + s * 0.16) * (F.surge ? 2.3 : 1) * lineMul * dt; }
    else { F.tension -= 0.75 * dt; F.dist += (0.35 + s * 0.3) * (F.surge ? 1.6 : 1) * (up('hook2') ? 0.5 : 1) * dt; }
    F.tension = Math.max(0, F.tension);
    const k = Math.max(0, F.dist / F.dist0);
    bobber.position.set(F.sp.x - 0.6 - (F.sp.x - 0.6 - F.to.x) * k, wy - 0.05, F.to.z + Math.sin(F.t * (F.surge ? 9 : 3)) * (F.surge ? 0.5 : 0.2));
    $('#fProg').style.width = Math.max(0, Math.min(100, (1 - k) * 100)) + '%';
    const tb = $('#fTen'); tb.style.width = Math.min(100, F.tension * 100) + '%'; tb.classList.toggle('hot', F.tension > 0.72);
    ui.classList.toggle('shake', !!F.surge);
    if (F.tension >= 1) { F.phase = 'idle'; G.scene.remove(bobber); sfx('snap'); ui.classList.remove('shake'); hud('The line snapped! Ease off when it runs red.'); }
    else if (F.dist > F.dist0 + 7) { F.phase = 'idle'; G.scene.remove(bobber); sfx('lose'); ui.classList.remove('shake'); hud('It got away. Keep reeling when the line is calm.'); }
    else if (F.dist <= 0.4) { ui.classList.remove('shake'); land(); }
  }
  if (show) {
    show.t += dt;
    const k = Math.min(1, show.t / 0.7), hand = tip.getWorldPosition(new THREE.Vector3());
    const dst = new THREE.Vector3(G.pos.x - 1.0, 1.7, G.pos.z);
    show.o.position.lerpVectors(show.from, dst, k); show.o.position.y += Math.sin(k * Math.PI) * 1.2;
    show.o.rotation.y += dt * 2.4;
    void hand;
  }
  // the line: rod tip to bobber with a little sag
  const on = ['cast', 'wait', 'bite', 'reel'].includes(F.phase);
  line.visible = on;
  if (on) {
    const a = tip.getWorldPosition(new THREE.Vector3()), b = bobber.position, p = line.geometry.attributes.position;
    const sag = F.phase === 'reel' ? 0.1 + (1 - Math.min(1, F.tension)) * 0.5 : 0.7;
    p.setXYZ(0, a.x, a.y, a.z); p.setXYZ(1, (a.x + b.x) / 2, (a.y + b.y) / 2 - sag, (a.z + b.z) / 2); p.setXYZ(2, b.x, b.y, b.z);
    p.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- tackle shop
export function openTackle() {
  let tab = 'tree';
  const b = openPanel({ title: '🎣 Tackle Shop', cls: 'wide' });
  const CW = 150, RH = 104, X0 = 12, Y0 = 34;
  const draw = () => {
    let body;
    if (tab === 'tree') {
      const pos = u => [X0 + u.col * CW + 66, Y0 + u.row * RH + 38];
      const lines = UPGRADES.flatMap(u => u.req.map(r => { const a = pos(UPGRADES.find(q => q.id === r)), c = pos(u); return `<line x1="${a[0]}" y1="${a[1]}" x2="${c[0]}" y2="${c[1]}" class="${up(r) ? 'on' : ''}"/>`; })).join('');
      body = `<p class="dim">Spend your winnings here. Each upgrade needs the ones its lines come from.</p><div class="treewrap"><div class="tree" style="width:${X0 * 2 + 6 * CW}px;height:${Y0 + 4 * RH}px">
        <svg width="${X0 * 2 + 6 * CW}" height="${Y0 + 4 * RH}">${lines}</svg>
        ${BRANCHES.map((n, i) => `<div class="bh" style="left:${X0 + i * CW}px">${n}</div>`).join('')}
        ${UPGRADES.map(u => { const own = up(u.id), ok = u.req.every(up); return `<button class="node ${own ? 'own' : ok ? 'ok' : 'lock'}" data-u="${u.id}" style="left:${X0 + u.col * CW}px;top:${Y0 + u.row * RH}px"><b>${u.name}</b><small>${u.d}</small><span>${own ? 'Owned' : fmt(u.price)}</span></button>`; }).join('')}
      </div></div>`;
    } else {
      body = `<div class="list">${FISH.map(f => { const l = S.fish.log[f.id]; return `<div class="item ${l ? '' : 'locked'}"><span class="tx"><b style="color:${RARITY[f.r]}">${l ? f.name : '???'}</b><small>${f.r}${l ? ` · caught ${l.n} · best ${l.best} lb` : ''}</small></span><span class="pr">${l ? '~' + fmt(f.v) : ''}</span></div>`; }).join('')}</div>`;
    }
    b.innerHTML = `<div class="tabs"><button class="${tab === 'tree' ? 'on' : ''}" data-tab="tree">Upgrades</button><button class="${tab === 'log' ? 'on' : ''}" data-tab="log">Fish log (${Object.keys(S.fish.log).length}/${FISH.length})</button><span class="bal">${fmt(S.money)}</span></div>${body}`;
    b.querySelectorAll('[data-tab]').forEach(x => x.onclick = () => { tab = x.dataset.tab; draw(); });
    b.querySelectorAll('[data-u]').forEach(x => x.onclick = () => {
      const u = UPGRADES.find(q => q.id === x.dataset.u);
      if (up(u.id)) return;
      if (!u.req.every(up)) return toast('Needs ' + u.req.filter(r => !up(r)).map(r => UPGRADES.find(q => q.id === r).name).join(' and ') + ' first');
      if (!canPay(u.price)) return;
      addMoney(-u.price, true); S.fish.up[u.id] = 1; save(); sfx('buy'); toast(`${u.name} equipped`, 'good');
      draw();
    });
  };
  draw();
}
