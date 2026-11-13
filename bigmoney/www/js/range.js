// Quickscope range: first person, one bolt-action rifle, pop-up targets.
import * as THREE from './vendor/three.module.min.js';
import { G, S, save, addMoney, buff } from './state.js';
import { $, fmt, toast } from './ui.js';
import { prop } from './avatar.js';
import { sfx } from './audio.js';

const R = { on: false, yaw: 0, pitch: 0, ads: 0, scope: false, scopeAt: 0, cool: 0, kick: 0, targets: [], spawnIn: 0, round: 0, score: 0, hits: 0, shots: 0, qs: 0, t: 0 };
const VS = 0.62;   // viewmodel scale
const HIP = new THREE.Vector3(0.16, -0.17, -0.4), AIM = new THREE.Vector3(0, -0.158 * VS, -0.2);
const ROUND = 45;
let rifle, flash, ui;

export function initRange() {
  ui = $('#rangeui');
  const hold = (id, down, up) => { const b = $(id); b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); down(); }); if (up) for (const ev of ['pointerup', 'pointercancel']) b.addEventListener(ev, up); };
  hold('#rScope', () => setScope(true), () => setScope(false));
  hold('#rFire', fire);
  $('#rStart').onclick = startRound;
  $('#rExit').onclick = exitRange;
  const cv = G.canvas;
  cv.addEventListener('mousedown', e => {
    if (!R.on) return;
    if (document.pointerLockElement !== cv) { if (!G.touch && cv.requestPointerLock) cv.requestPointerLock(); return; }
    if (e.button === 0) fire(); else if (e.button === 2) setScope(true);
  });
  window.addEventListener('mouseup', e => { if (R.on && e.button === 2) setScope(false); });
  document.addEventListener('mousemove', e => { if (R.on && document.pointerLockElement === cv) rangeLook(e.movementX, e.movementY); });
  cv.addEventListener('contextmenu', e => e.preventDefault());
}

export function rangeKey(code, down) {
  if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'KeyQ') setScope(down);
  else if (down && code === 'Space') fire();
  else if (down && code === 'KeyR') startRound();
  else if (down && code === 'Escape') exitRange();
}
export function rangeLook(dx, dy) {
  const k = 0.0028 * (G.camera.fov / 62);
  R.yaw = Math.max(-0.78, Math.min(0.78, R.yaw + dx * k));
  R.pitch = Math.max(-0.3, Math.min(0.4, R.pitch - dy * k));
}
function setScope(v) { if (v && !R.scope) R.scopeAt = performance.now(); R.scope = v; }

export function enterRange(it) {
  const b = G.layout.range.booths[it.i];
  if (!rifle) {
    rifle = prop('rifle'); rifle.scale.setScalar(VS);
    flash = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0 }));
    flash.position.set(0, 0.065, -1.3); rifle.add(flash);
  }
  G.camera.add(rifle);
  Object.assign(R, { on: true, yaw: 0, pitch: 0, ads: 0, scope: false, cool: 0, round: 0, score: 0, booth: b, spawnIn: 0.5 });
  Object.assign(G.pos, { x: b.x, z: b.z, r: Math.PI / 2, y: 0 });
  G.mode = 'range'; G.anim = 3;
  G.me.root.visible = false;
  ui.classList.remove('hidden');
  document.body.classList.add('fps');
  hud();
  toast(G.touch ? 'Hold SCOPE, then FIRE. Scope and shoot fast for quickscope bonus.' : 'Click to lock the mouse. Right-click or Shift to scope, left-click or Space to fire.');
}
export function exitRange() {
  if (!R.on) return;
  R.on = false;
  if (document.pointerLockElement) document.exitPointerLock();
  G.camera.remove(rifle);
  for (const t of R.targets) G.scene.remove(t.o);
  R.targets = [];
  G.camera.fov = 62; G.camera.updateProjectionMatrix();
  G.me.root.visible = true;
  G.mode = 'walk'; G.anim = 0;
  G.pos.x -= 0.6;
  ui.classList.add('hidden');
  $('#scope').classList.add('hidden');
  document.body.classList.remove('fps');
}

function startRound() {
  if (R.round > 0) return;
  Object.assign(R, { round: ROUND, score: 0, hits: 0, shots: 0, qs: 0 });
  for (const t of R.targets) G.scene.remove(t.o);
  R.targets = []; R.spawnIn = 0.3;
  sfx('bite'); hud();
}
function endRound() {
  R.round = 0;
  const pay = Math.floor(R.score / 25);
  const best = R.score > S.best.range;
  if (best) { S.best.range = R.score; save(); }
  if (pay) addMoney(pay);
  sfx(pay ? 'win' : 'lose');
  pop(`Round over · ${R.score} pts · ${R.hits}/${R.shots} hits · ${R.qs} quickscopes${pay ? ' · ' + fmt(pay) : ''}${best ? ' · NEW BEST' : ''}`, 'big');
  if (best && R.score > 1500) G.send({ t: 'ev', k: 'say', v: `scored ${R.score} on the quickscope range!` });
  hud();
}
function hud() {
  $('#rInfo').innerHTML = R.round > 0 ? `<b>${R.score}</b> pts · ${Math.ceil(R.round)}s` : `Best ${S.best.range} · free practice`;
  $('#rStart').classList.toggle('hidden', R.round > 0);
}
function pop(text, cls = '') {
  const p = document.createElement('div');
  p.className = 'rpop ' + cls; p.textContent = text;
  ui.appendChild(p);
  setTimeout(() => p.remove(), cls === 'big' ? 4500 : 1100);
}

function spawn() {
  const sp = G.layout.range.spawns, used = R.targets.map(t => t.i);
  const free = sp.map((_, i) => i).filter(i => !used.includes(i));
  const i = free[(Math.random() * free.length) | 0], [x, y, z] = sp[i];
  const o = prop('target');
  o.rotation.y = -Math.PI / 2;
  o.position.set(x, y - 1.4, z);
  G.scene.add(o);
  R.targets.push({ o, i, x, y, z, age: 0, life: R.round > 0 ? 2.6 + Math.random() * 1.2 : 5, dead: 0 });
}

function fire() {
  if (!R.on || R.cool > 0) return;
  R.cool = 1.05; R.kick = 1;
  sfx('shot'); sfx('bolt');
  flash.material.opacity = 1;
  if (R.round > 0) R.shots++;
  const scoped = R.ads > 0.9, sinceScope = (performance.now() - R.scopeAt) / 1000;
  const spread = scoped ? 0 : 0.03 + (1 - R.ads) * 0.07;
  const dir = new THREE.Vector3(); G.camera.getWorldDirection(dir);
  dir.x += (Math.random() - 0.5) * 2 * spread; dir.y += (Math.random() - 0.5) * 2 * spread; dir.z += (Math.random() - 0.5) * 2 * spread;
  dir.normalize();
  const o = G.camera.position;
  let best = null, bd = 1e9, off = 0;
  for (const t of R.targets) {
    if (t.dead || t.age < 0.15 || dir.x <= 0) continue;
    const k = (t.x - o.x) / dir.x, py = o.y + dir.y * k, pz = o.z + dir.z * k, d = Math.hypot(py - t.o.position.y, pz - t.z);
    if (d < 0.5 && k < bd) { best = t; bd = k; off = d; }
  }
  R.pitch += 0.035;
  if (!best) return;
  best.dead = 0.001;
  sfx('hit');
  const qs = scoped && sinceScope < 0.7, ns = R.ads < 0.5, bull = off < 0.1;
  const pts = 100 + Math.round((best.x - 22) * 2) + (bull ? 100 : 0) + (qs ? 150 : 0) + (ns ? 300 : 0);
  pop(`${ns ? 'NO-SCOPE! ' : qs ? 'QUICKSCOPE! ' : ''}${bull ? 'Bullseye ' : ''}+${pts}`, qs || ns ? 'qs' : '');
  if (R.round > 0) { R.score += pts; R.hits++; if (qs) R.qs++; hud(); }
}

export function updateRange(dt) {
  if (!R.on) return;
  R.t += dt;
  const speed = buff('steady') ? 5.2 : 4;           // about a quarter second to scope in
  R.ads = Math.max(0, Math.min(1, R.ads + (R.scope ? dt : -dt) * speed));
  R.cool = Math.max(0, R.cool - dt);
  R.kick = Math.max(0, R.kick - dt * 5);
  flash.material.opacity = Math.max(0, flash.material.opacity - dt * 14);
  const cam = G.camera, e = R.ads * R.ads * (3 - 2 * R.ads);
  const sway = buff('steady') ? 0 : 0.004 + G.buzz * 0.003;
  const yaw = R.yaw + Math.sin(R.t * 1.3) * sway * e, pitch = R.pitch + Math.sin(R.t * 1.9) * sway * e + R.kick * 0.02;
  cam.position.set(R.booth.x, 1.62, R.booth.z);
  cam.lookAt(R.booth.x + Math.cos(pitch) * Math.cos(yaw), 1.62 + Math.sin(pitch), R.booth.z + Math.cos(pitch) * Math.sin(yaw));
  cam.fov = 62 + (13 - 62) * e; cam.updateProjectionMatrix();
  rifle.position.lerpVectors(HIP, AIM, e);
  rifle.position.z += R.kick * 0.07;
  rifle.rotation.set(R.kick * 0.09, 0, (1 - e) * 0.05 + (R.cool > 0.2 && R.cool < 0.8 ? Math.sin((0.8 - R.cool) / 0.6 * Math.PI) * 0.25 : 0));
  const full = R.ads > 0.92;
  rifle.visible = !full;
  $('#scope').classList.toggle('hidden', !full);
  // targets
  if (R.round > 0) { R.round -= dt; if (R.round <= 0) endRound(); else if (((R.round + dt) | 0) !== (R.round | 0)) hud(); }
  R.spawnIn -= dt;
  if (R.spawnIn <= 0 && R.targets.length < (R.round > 0 ? 3 : 2)) { spawn(); R.spawnIn = R.round > 0 ? 0.55 + Math.random() * 0.6 : 1.2; }
  for (const t of R.targets) {
    t.age += dt;
    if (t.dead) { t.dead += dt; t.o.rotation.x = -Math.min(1.5, t.dead * 9); t.o.position.y -= dt * 2; }
    else if (t.age > t.life) t.o.position.y -= dt * 4;
    else t.o.position.y = Math.min(t.y, t.o.position.y + dt * 7);
  }
  R.targets = R.targets.filter(t => { const gone = t.dead > 0.5 || t.age > t.life + 0.4; if (gone) G.scene.remove(t.o); return !gone; });
}
