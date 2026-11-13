import * as THREE from './vendor/three.module.min.js';
import { G, S, save, addMoney, buff } from './state.js';
import { $, fmt, esc, toast, closePanel, panelOpen } from './ui.js';
import { unlock, sfx } from './audio.js';
import { loadWorld, collide, inWall } from './world.js';
import { makeAvatar } from './avatar.js';
import { Net } from './net.js';
import { openSlots } from './slots.js';
import { initTables, onBJ, onPK, onHole, tablesLost, openBJ, openPK, standUp } from './tables.js';
import { openBar, openShop, openCashier, openMenu } from './bar.js';
import { initRange, enterRange, exitRange, updateRange, rangeKey, rangeLook } from './range.js';
import { initFishing, enterFishing, exitFishing, updateFishing, fishKey, openTackle } from './fishing.js';

// ------------------------------------------------------------------ renderer
const canvas = G.canvas = $('#gl');
G.touch = matchMedia('(pointer: coarse)').matches;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !G.touch, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, G.touch ? 1.5 : 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
G.renderer = renderer;
const scene = G.scene = new THREE.Scene();
scene.background = new THREE.Color('#07040a');
scene.fog = new THREE.Fog('#07040a', 40, 110);
const camera = G.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 140);
scene.add(camera);
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

// ------------------------------------------------------------------ title
const q = new URLSearchParams(location.search);
$('#name').value = S.name || '';
$('#room').value = (q.get('room') || 'lobby').slice(0, 20);
$('#play').onclick = async () => {
  unlock();
  S.name = $('#name').value.trim().slice(0, 16) || 'Guest' + ((Math.random() * 900 + 100) | 0);
  G.roomCode = ($('#room').value.trim().toLowerCase().replace(/[^a-z0-9]/g, '') || 'lobby').slice(0, 20);
  save();
  $('#play').disabled = true;
  try {
    await loadWorld((i, f) => { $('#load').textContent = `Loading the casino… ${Math.round((i + f) * 50)}%`; });
  } catch (e) { $('#load').textContent = 'Could not load the casino. Check your connection and reload.'; console.error(e); return; }
  begin();
};
$('#name').addEventListener('keydown', e => { if (e.key === 'Enter') $('#play').click(); });

function begin() {
  G.me = makeAvatar(S.look, '');
  scene.add(G.me.root);
  G.fx = { confetti };
  initTables(); initRange(); initFishing();
  // anything left on a table when the last session ended comes home
  const back = S.pend.bj + S.pend.pk;
  if (back > 0) { S.pend.bj = S.pend.pk = 0; addMoney(back, true); setTimeout(() => toast(`${fmt(back)} from your last table was returned.`), 1500); }
  const L = G.layout;
  G.net = new Net(G.roomCode, { bj: L.bj.map(t => ({ id: t.id, min: t.min, max: t.max, seats: t.seats.length })), pk: L.pk.map(t => ({ id: t.id, sb: t.sb, bb: t.bb, min: t.min, max: t.max, seats: t.seats.length })) },
    { onOpen: () => G.send({ t: 'hello', name: S.name, look: S.look }), onMsg, onLost, onStatus });
  G.send = m => G.net.send(m);
  G.net.start();
  G.mode = 'walk';
  $('#title').classList.add('hidden');
  $('#hud').classList.remove('hidden');
  if (G.touch) document.body.classList.add('touch');
  showMoney();
  toast(`Welcome to Big Money, ${S.name}!`, 'good');
}

// ------------------------------------------------------------------ multiplayer
function onStatus(s) {
  G.netLabel = { host: 'online (hosting)', client: 'online', solo: 'offline, retrying', joining: 'joining…', reconnecting: 'reconnecting…', connecting: 'connecting…' }[s] || s;
  $('#net').textContent = `${G.roomCode} · ${G.players.size + 1} 👤 · ${G.netLabel}`;
}
function dropPlayer(id) {
  const p = G.players.get(id);
  if (!p) return;
  scene.remove(p.av.root); p.av.dispose(); G.players.delete(id);
}
function onLost() {
  for (const id of [...G.players.keys()]) dropPlayer(id);
  G.myId = null;
  tablesLost();
}
function addPlayer(d) {
  if (d.id === G.myId || G.players.has(d.id)) return;
  const av = makeAvatar(d.look, d.name);
  av.root.position.set(d.x, d.y, d.z); av.root.rotation.y = d.r;
  scene.add(av.root);
  G.players.set(d.id, { av, name: d.name, x: d.x, y: d.y, z: d.z, r: d.r, a: d.a | 0, sp: 0 });
}
function onMsg(m) {
  switch (m.t) {
    case 'welcome':
      G.myId = m.id;
      for (const id of [...G.players.keys()]) dropPlayer(id);
      m.players.forEach(addPlayer); m.bj.forEach(onBJ); m.pk.forEach(onPK);
      break;
    case 'join': addPlayer(m.p); chatLine(`${esc(m.p.name)} walked in`, 'sys'); break;
    case 'left': { const p = G.players.get(m.id); if (p) chatLine(`${esc(p.name)} left`, 'sys'); dropPlayer(m.id); break; }
    case 'ps': for (const [id, x, y, z, r, a] of m.p) { const p = G.players.get(id); if (p) Object.assign(p, { x, y, z, r, a }); } break;
    case 'pl': { const p = G.players.get(m.id); if (p) { p.av.setLook(m.look); if (m.name !== p.name) { p.name = m.name; p.av.setName(m.name); } } break; }
    case 'chat': chatLine(`<b>${esc(m.name)}</b> ${esc(m.m)}`); break;
    case 'pay': addMoney(m.amt, m.amt < 0); if (m.why === 'round') toast('🥂 Someone bought a round: +$25', 'good'); break;
    case 'note': toast(m.m); break;
    case 'bjs': onBJ(m.s); break;
    case 'pks': onPK(m.s); break;
    case 'pkh': onHole(m); break;
    case 'ev': {
      const p = G.players.get(m.id), who = m.id === G.myId ? 'You' : esc(m.name);
      if (m.k === 'say') chatLine(`🎉 <b>${who}</b> ${esc(String(m.v).slice(0, 120))}`, 'sys');
      else if (m.k === 'confetti' && p) { confetti(p.x, p.z); chatLine(`🍾 <b>${who}</b> popped champagne`, 'sys'); }
      else if (m.k === 'round') chatLine(`🥂 <b>${who}</b> bought a round for the house`, 'sys');
      else if (m.k === 'emote' && p) p.emote = { a: m.v | 0, until: Date.now() + 3000 };
      break;
    }
  }
  if (m.t === 'welcome' || m.t === 'join' || m.t === 'left') onStatus(G.net.state);
}

// ------------------------------------------------------------------ chat, HUD
function chatLine(html, cls = '') {
  const d = document.createElement('div');
  d.className = 'cl ' + cls; d.innerHTML = html;
  const log = $('#chatlog');
  log.appendChild(d);
  while (log.children.length > 7) log.firstChild.remove();
  setTimeout(() => d.classList.add('old'), 12000);
}
$('#chatform').addEventListener('submit', e => {
  e.preventDefault();
  const i = $('#chatin'), v = i.value.trim();
  if (v) G.send({ t: 'chat', m: v });
  i.value = ''; i.blur();
  $('#chatform').classList.remove('open');
});
$('#bChat').onclick = () => { $('#chatform').classList.add('open'); $('#chatin').focus(); };
$('#bMenu').onclick = () => { if (G.mode === 'walk' || G.mode === 'ui') openMenu(); };
$('#bWave').onclick = () => emote(5);
$('#bDance').onclick = () => emote(4);
function emote(a) { G.emote = { a, until: Date.now() + 3000 }; G.send({ t: 'ev', k: 'emote', v: a }); }

function showMoney() { $('#money').textContent = fmt(S.money); }
G.onMoney.push((n, quiet) => {
  showMoney();
  if (quiet && n < 0) return;
  const d = document.createElement('div');
  d.className = 'delta ' + (n > 0 ? 'up' : 'down'); d.textContent = (n > 0 ? '+' : '') + fmt(n).replace('$-', '-$');
  $('#moneywrap').appendChild(d);
  setTimeout(() => d.remove(), 1400);
});
setInterval(() => {
  const now = Date.now(), names = { lucky: '🍺 Lucky', angler: '🍻 Bites', steady: '☕ Steady', aura: '🍸 Glow' };
  $('#buffs').innerHTML = Object.keys(names).filter(k => G.buffs[k] > now).map(k => `<span>${names[k]} ${Math.ceil((G.buffs[k] - now) / 60000)}m</span>`).join('');
  if (G.buzz > 0) G.buzz = Math.max(0, G.buzz - 0.02);
}, 1000);

// ------------------------------------------------------------------ input
const keys = {};
const stick = { x: 0, y: 0, id: -1 };
const typing = () => { const a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'); };
addEventListener('keydown', e => {
  if (G.mode === 'title') return;
  if (typing()) { if (e.key === 'Escape') document.activeElement.blur(); return; }
  if (e.code === 'Enter') { e.preventDefault(); $('#bChat').click(); return; }
  if (G.mode === 'range') { if (e.code === 'Space') e.preventDefault(); return rangeKey(e.code, true); }
  if (G.mode === 'fish') { if (e.code === 'Space') e.preventDefault(); if (!e.repeat) fishKey(e.code, true); return; }
  keys[e.code] = true;
  if (e.repeat) return;
  if (e.code === 'KeyE') interact();
  else if (e.code === 'Escape') { if (panelOpen()) closePanel(); else if (G.seat) G.send({ t: G.seat.k, tb: G.seat.id, a: 'leave' }); }
  else if (e.code === 'KeyM' || e.code === 'Tab') { e.preventDefault(); openMenu(); }
});
addEventListener('keyup', e => {
  keys[e.code] = false;
  if (G.mode === 'range') rangeKey(e.code, false);
  else if (G.mode === 'fish') fishKey(e.code, false);
});
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

let look = null;
canvas.addEventListener('pointerdown', e => {
  unlock();
  if (look || (G.mode === 'range' && e.pointerType === 'mouse')) return;
  look = { id: e.pointerId, x: e.clientX, y: e.clientY };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  if (!look || e.pointerId !== look.id) return;
  const dx = e.clientX - look.x, dy = e.clientY - look.y;
  look.x = e.clientX; look.y = e.clientY;
  if (G.mode === 'range') return rangeLook(dx * 1.6, dy * 1.6);
  G.cam.yaw -= dx * 0.006;
  G.cam.pitch = Math.max(-0.1, Math.min(1.25, G.cam.pitch + dy * 0.005));
});
for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, e => { if (look && e.pointerId === look.id) look = null; });
canvas.addEventListener('wheel', e => { G.cam.dist = Math.max(2.8, Math.min(11, G.cam.dist + e.deltaY * 0.006)); e.preventDefault(); }, { passive: false });

const st = $('#stick'), knob = $('#knob');
function stickMove(e) {
  const r = st.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, m = r.width / 2;
  let dx = (e.clientX - cx) / m, dy = (e.clientY - cy) / m;
  const d = Math.hypot(dx, dy);
  if (d > 1) { dx /= d; dy /= d; }
  stick.x = dx; stick.y = -dy;
  knob.style.transform = `translate(${dx * m * 0.6}px, ${dy * m * 0.6}px)`;
}
st.addEventListener('pointerdown', e => { e.preventDefault(); unlock(); stick.id = e.pointerId; st.setPointerCapture(e.pointerId); stickMove(e); });
st.addEventListener('pointermove', e => { if (e.pointerId === stick.id) stickMove(e); });
for (const ev of ['pointerup', 'pointercancel']) st.addEventListener(ev, e => { if (e.pointerId === stick.id) { stick.id = -1; stick.x = stick.y = 0; knob.style.transform = ''; } });

// ------------------------------------------------------------------ interaction
const LABEL = {
  slot: () => '🎰 Play slots', bar: () => '🍸 Order a drink', shop: () => '👔 Browse the Style Shop', cashier: () => '💵 Talk to the cashier',
  range: () => '🎯 Step up to the range', fish: () => '🎣 Fish here', tackle: () => '🎣 Tackle shop upgrades',
  bj: it => { const t = G.layout.bj.find(x => x.id === it.id); return `🃏 Sit at blackjack (${fmt(t.min)} min)`; },
  pk: it => { const t = G.layout.pk.find(x => x.id === it.id); return `♠ Sit at poker (${fmt(t.sb)}/${fmt(t.bb)})`; },
};
const DO = { slot: openSlots, bar: openBar, shop: () => openShop(true), cashier: openCashier, range: enterRange, fish: enterFishing, tackle: openTackle, bj: openBJ, pk: openPK };
let near = null;
function findNear() {
  let best = null, bd = 1e9;
  for (const it of G.layout.interact) {
    const d = Math.hypot(it.x - G.pos.x, it.z - G.pos.z);
    if (d < it.r && d / it.r < bd) { bd = d / it.r; best = it; }
  }
  if (best !== near) {
    near = best;
    const p = $('#prompt');
    p.classList.toggle('hidden', !best);
    if (best) p.innerHTML = LABEL[best.t](best) + (G.touch ? '' : ' <kbd>E</kbd>');
  }
}
function interact() { if (G.mode === 'walk' && near) { sfx('click'); DO[near.t](near); } }
$('#prompt').onclick = interact;

// ------------------------------------------------------------------ confetti
const bits = [];
const bitGeo = new THREE.PlaneGeometry(0.09, 0.14);
function confetti(x, z) {
  sfx('big');
  for (let i = 0; i < 90; i++) {
    const m = new THREE.Mesh(bitGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(Math.random(), 0.9, 0.6), side: THREE.DoubleSide }));
    m.position.set(x, 1.6, z);
    const a = Math.random() * 6.28, s = 1 + Math.random() * 3;
    bits.push({ m, vx: Math.cos(a) * s, vy: 3 + Math.random() * 4, vz: Math.sin(a) * s, t: 0 });
    scene.add(m);
  }
}

// ------------------------------------------------------------------ frame
const angLerp = (a, b, t) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; };
const camPos = new THREE.Vector3();
let sendIn = 0, mySpeed = 0, T = 0, auraMesh = null;
function aura(root, on) {
  if (!!root.userData.aura === on) return;
  if (on) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.62, 28), new THREE.MeshBasicMaterial({ color: '#ffc23a', transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.05; root.add(m); root.userData.aura = m;
  } else { root.remove(root.userData.aura); root.userData.aura = null; }
}

function update(dt) {
  T += dt;
  const P = G.pos, now = Date.now();
  mySpeed = 0;
  if (G.mode === 'walk') {
    let ix = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + stick.x;
    let iy = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) + stick.y;
    let len = Math.hypot(ix, iy);
    if (len > 1) { ix /= len; iy /= len; len = 1; }
    if (len > 0.08) {
      const y = G.cam.yaw + Math.sin(T * 1.7) * G.buzz * 0.05;
      const dx = Math.cos(y) * ix - Math.sin(y) * iy, dz = -Math.sin(y) * ix - Math.cos(y) * iy;
      mySpeed = (keys.ShiftLeft || keys.ShiftRight ? 5.6 : 3.6) * len;
      P.x += dx * mySpeed * dt; P.z += dz * mySpeed * dt;
      P.r = angLerp(P.r, Math.atan2(dx, dz), Math.min(1, dt * 12));
      collide(P, 0.35);
      if (G.emote) G.emote = null;
    }
    findNear();
  } else if (near) { near = null; $('#prompt').classList.add('hidden'); }

  // me
  const emo = G.emote && G.emote.until > now ? G.emote.a : 0;
  const anim = G.anim || emo;
  const drinking = (G.drinkUntil || 0) > now && !G.anim;
  if (G.mode !== 'fish' && G.mode !== 'range') G.me.hold(drinking ? 'drink' : '');
  G.me.root.position.set(P.x, P.y, P.z);
  G.me.root.rotation.y = P.r;
  G.me.update(dt, mySpeed, anim);
  aura(G.me.root, buff('aura'));

  // everyone else
  for (const p of G.players.values()) {
    const o = p.av.root.position, k = Math.min(1, dt * 10);
    const d = Math.hypot(p.x - o.x, p.z - o.z);
    p.sp = d > 0.03 ? Math.min(5, d * 10) : 0;
    if (d > 6) o.set(p.x, p.y, p.z); else { o.x += (p.x - o.x) * k; o.y += (p.y - o.y) * k; o.z += (p.z - o.z) * k; }
    p.av.root.rotation.y = angLerp(p.av.root.rotation.y, p.r, k);
    const a = p.a & 15, e = p.emote && p.emote.until > now ? p.emote.a : 0;
    p.av.hold(a === 2 ? 'rod' : a === 3 ? 'rifle' : p.a & 32 ? 'drink' : '');
    p.av.update(dt, p.sp, a || e);
    aura(p.av.root, !!(p.a & 16));
  }
  for (const n of G.npcs) n.update(dt, 0, n.pose || 0);

  sendIn -= dt;
  if (sendIn <= 0 && G.myId) { sendIn = 0.1; G.send({ t: 'pos', x: +P.x.toFixed(2), y: +P.y.toFixed(2), z: +P.z.toFixed(2), r: +P.r.toFixed(2), a: anim | (buff('aura') ? 16 : 0) | (drinking ? 32 : 0) }); }

  // camera
  if (G.mode === 'range') updateRange(dt);
  else {
    const C = G.cam, ty = P.y + (G.seat ? 1.25 : 1.5);
    const cp = Math.cos(C.pitch), sx = Math.sin(C.yaw) * cp, sy = Math.sin(C.pitch), sz = Math.cos(C.yaw) * cp;
    let d = C.dist;
    for (let s = 0.4; s <= C.dist; s += 0.3) if (inWall(P.x + sx * s, P.z + sz * s)) { d = Math.max(0.5, s - 0.35); break; }
    const top = P.x > 22.3 ? 4.5 : P.x < -22.3 ? 8.4 : 6.4;
    if (ty + sy * d > top) d = Math.max(0.5, (top - ty) / sy);
    camPos.set(P.x + sx * d, ty + sy * d, P.z + sz * d);
    camera.position.lerp(camPos, Math.min(1, dt * 14));
    const wob = G.buzz * 0.012;
    camera.lookAt(P.x + Math.sin(T * 1.1) * wob * 3, ty + Math.sin(T * 0.8) * wob, P.z);
    camera.rotation.z += Math.sin(T * 0.9) * wob;
  }
  updateFishing(dt);

  // set dressing
  if (G.dollar) G.dollar.rotation.y += dt * 0.8;
  if (G.waterTex) { G.waterTex.offset.x = T * 0.012; G.waterTex.offset.y = Math.sin(T * 0.3) * 0.02; }
  for (let i = bits.length - 1; i >= 0; i--) {
    const b = bits[i];
    b.t += dt; b.vy -= 7 * dt;
    b.m.position.x += b.vx * dt; b.m.position.y = Math.max(0.03, b.m.position.y + b.vy * dt); b.m.position.z += b.vz * dt;
    b.m.rotation.x += dt * 9; b.m.rotation.y += dt * 7;
    if (b.t > 3.2) { scene.remove(b.m); b.m.material.dispose(); bits.splice(i, 1); }
  }
}

let last = performance.now();
function frame(t) {
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  if (G.mode !== 'title') update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// For scripted play-tests: the hidden preview pane throttles animation frames, so let a test step time itself.
window.BM = { G, S, keys, interact, exitRange, exitFishing, standUp, tick(n = 1, dt = 1 / 30) { for (let i = 0; i < n; i++) update(dt); renderer.render(scene, camera); } };
