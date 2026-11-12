/* Hourfall: game loop, player, enemies, world objects, saving. */
import * as THREE from './vendor/three.module.min.js';
import { buildWorld, height, weights, regionName, WATER, EDGE, SPOTS } from './world.js';
import * as E from './entities.js';
import { ITEMS, ENEMIES, SPAWNS, BOSSES, WAYSTONES, CHESTS, MINUTES, PAGES, HERBS, HERB_COLOR, BELLS, CRATES, xpNeed } from './data.js';
import { QUESTS, NPCS, INTRO, readNote, spireDoor, afterOren, cogCount } from './story.js';
import { Combat } from './combat.js';
import { UI } from './ui.js';
import { makeAudio } from './audio.js';
import { clamp, lerp, dist, rng, TAU, angDiff } from './util.js';

const SAVE_KEY = 'hourfall.save.v1';
const $ = id => document.getElementById(id);
const fresh = () => ({ v: 1, x: -3, z: 137, rot: Math.PI, hp: 104, level: 1, xp: 0, coins: 20, inv: { w_needle: 1, tonic: 2 },
  eq: { weapon: 'w_needle', armor: null, trinket: null, glyphs: [] }, flags: {}, quests: {}, kills: {}, opened: {}, minutes: {}, pages: {}, way: {}, home: 'dawnmere', track: 'main', mute: false });

/* ---- renderer ---- */
const glCanvas = $('gl'), fx = $('fx'), fxc = fx.getContext('2d');
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: window.devicePixelRatio < 2, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.3, 3200);
let W = 1, H = 1;

const g = {
  S: fresh(), focus: 0, touch: matchMedia('(pointer: coarse)').matches, sfx: makeAudio(), nearest: null, busy: false,
  player: { x: 0, z: 0, y: 0, rot: Math.PI, moving: false, swing: 0, swim: false, model: null },
  flag: n => g.S.flags[n],
  setFlag(n, v = 1) { g.S.flags[n] = v; if (n === 'ended') g.S.flags.endings = Object.assign({}, g.S.flags.endings, { [v]: 1 }); checkQuests(); },
  has: id => g.S.inv[id] || 0,
  give(id, n = 1, quiet) {
    const it = ITEMS[id]; g.S.inv[id] = (g.S.inv[id] || 0) + n;
    if (!quiet) { g.ui.toast(`${it.icon} ${it.name}${n > 1 ? ' ×' + n : ''}`, it.type !== 'mat' && it.type !== 'use'); g.sfx.pickup(); }
    const eq = g.S.eq;
    if ((it.type === 'armor' && !eq.armor) || (it.type === 'trinket' && !eq.trinket) || (it.type === 'glyph' && eq.glyphs.length < 2 && !eq.glyphs.includes(id))) g.equip(id);
    checkQuests();
  },
  take(id, n = 1) { g.S.inv[id] = Math.max(0, (g.S.inv[id] || 0) - n); if (!g.S.inv[id]) { delete g.S.inv[id]; if (g.isEquipped(id)) g.unequip(id); } },
  isEquipped(id) { const e = g.S.eq; return e.weapon === id || e.armor === id || e.trinket === id || e.glyphs.includes(id); },
  equip(id) {
    const it = ITEMS[id], e = g.S.eq;
    if (it.type === 'glyph') { if (!e.glyphs.includes(id)) { if (e.glyphs.length >= 2) e.glyphs.shift(); e.glyphs.push(id); } }
    else e[it.type] = id;
    g.S.hp = Math.min(g.S.hp, g.stats().maxHp);
  },
  unequip(id) {
    const it = ITEMS[id], e = g.S.eq;
    if (it.type === 'glyph') e.glyphs = e.glyphs.filter(x => x !== id); else if (it.type !== 'weapon') e[it.type] = null; else e.weapon = 'w_needle';
    g.S.hp = Math.min(g.S.hp, g.stats().maxHp);
  },
  stats() {
    const S = g.S, w = ITEMS[S.eq.weapon] || ITEMS.w_needle, a = ITEMS[S.eq.armor] || {}, t = ITEMS[S.eq.trinket] || {};
    return { weapon: w, atk: w.atk + S.level * 1.5, def: a.def || 0, maxHp: 90 + 14 * S.level + (a.hp || 0) + (t.hp || 0),
      guardMul: t.guard || 1, focusMul: t.focus || 1, coinMul: t.coin || 1, slow: t.slow || 1, glyphs: S.eq.glyphs.filter(id => g.has(id)) };
  },
  useItem(id) {
    const it = ITEMS[id]; if (!g.has(id) || it.type !== 'use') return false;
    if (it.heal) g.heal(it.heal);
    if (it.focus) g.focus = 100;
    g.take(id, 1); g.sfx.glyph(); g.ui.toast(it.icon + ' ' + it.name + ' used');
    return true;
  },
  usePotion() {
    const miss = g.stats().maxHp - g.S.hp, have = ['tonic', 'tonic2', 'elixir'].filter(id => g.has(id));
    if (!have.length || miss < 1) return false;
    return g.useItem(have.find(id => ITEMS[id].heal >= miss) || have[have.length - 1]);
  },
  hurt(n) { g.S.hp = Math.max(0, g.S.hp - n); return g.S.hp <= 0; },
  heal(n) { g.S.hp = Math.min(g.stats().maxHp, g.S.hp + n); },
  addCoins(n) { g.S.coins += Math.round(n); },
  addXp(n) {
    const S = g.S; S.xp += n;
    while (S.xp >= xpNeed(S.level)) { S.xp -= xpNeed(S.level); S.level++; S.hp = g.stats().maxHp; g.ui.region('Level ' + S.level, 'Health and attack increased'); g.sfx.level(); }
  },
  startQuest(id) {
    if (g.S.quests[id]) return;
    g.S.quests[id] = { step: 0, k0: Object.assign({}, g.S.kills) };
    if (id !== 'main') { g.ui.region(QUESTS[id].name, 'New quest'); g.sfx.quest(); if (!g.questActive(g.S.track) || g.S.track === 'main') g.S.track = id; }
    checkQuests();
  },
  questActive: id => !!g.S.quests[id] && !g.S.quests[id].done,
  questDone: id => !!g.S.quests[id] && g.S.quests[id].done,
  killsSince: (id, kind) => (g.S.kills[kind] || 0) - ((g.S.quests[id] && g.S.quests[id].k0[kind]) || 0),
  questText(id) { const q = QUESTS[id], s = q.steps[g.S.quests[id].step]; return s ? (typeof s.t === 'function' ? s.t(g) : s.t) : ''; },
  target() {
    const id = g.S.track; if (!g.questActive(id)) return null;
    const s = QUESTS[id].steps[g.S.quests[id].step]; if (!s || !s.at) return null;
    return typeof s.at === 'function' ? s.at(g) : s.at;
  },
  tracked() {
    let id = g.S.track;
    if (!g.questActive(id)) { id = Object.keys(g.S.quests).find(g.questActive); if (!id) return null; g.S.track = id; }
    const t = g.target(), p = g.player;
    let d = null, dir = '';
    if (t) { d = Math.round(dist(p.x, p.z, t[0], t[1])); dir = '↑↗→↘↓↙←↖'[Math.round(Math.atan2(t[0] - p.x, -(t[1] - p.z)) / (Math.PI / 4) + 8) % 8]; }
    return { name: QUESTS[id].name, text: g.questText(id), dist: d, dir };
  },
  project(obj, up = 0) {
    v3.setFromMatrixPosition(obj.matrixWorld); v3.y += up; v3.project(camera);
    return { x: (v3.x * 0.5 + 0.5) * W, y: (-v3.y * 0.5 + 0.5) * H };
  },
  projectPlayer: () => g.project(g.player.model, 2.3),
  playerSwing() { g.player.swing = 1; },
  shake(n) { shake = Math.max(shake, n); },
  save() {
    if (g.combat.active || !started) return;
    const S = g.S; S.x = g.player.x; S.z = g.player.z; S.rot = g.player.rot;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* storage full or blocked: play on without saving */ }
  },
  reset() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* nothing to erase */ } started = false; location.reload(); },
  interact() { if (g.nearest && !g.busy && !g.ui.blocking && !g.combat.active) run(g.nearest.use); },
  travel, fightSpecial, endCombat,
  afterEnding() { g.world.setPhase(4); },
};
const v3 = new THREE.Vector3();
let started = false, shake = 0, time = 0;

/* Run a piece of story without letting the player start a second one on top of it. */
async function run(fn) {
  if (g.busy) return;
  g.busy = true;
  try { await fn(); } finally { g.busy = false; checkQuests(); g.save(); }
}

function checkQuests() {
  const S = g.S;
  for (const id of Object.keys(S.quests)) {
    const q = S.quests[id], def = QUESTS[id];
    if (q.done) continue;
    const before = q.step;
    while (q.step < def.steps.length && def.steps[q.step].done(g)) q.step++;
    if (q.step >= def.steps.length) {
      q.done = true;
      const r = def.reward || {};
      if (id !== 'main') { g.ui.region(def.name, 'Quest complete'); g.sfx.quest(); }
      if (r.coins) { g.addCoins(r.coins); g.ui.toast('+' + r.coins + ' coin', true); }
      if (r.items) for (const k in r.items) g.give(k, r.items[k]);
      if (r.xp) g.addXp(r.xp);
      if (S.track === id) S.track = 'main';
    } else if (q.step !== before && started) g.ui.toast('Quest updated: ' + def.name);
  }
  if (g.world) g.world.setPhase(S.flags.ended === 'caught' ? 4 : cogCount(g));
}

/* ---- world objects ---- */
const things = [], foes = [];
function landFix(x, z) {
  if (height(x, z) > WATER + 0.5) return [x, z];
  for (let r = 2; r < 60; r += 2) for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, nx = x + Math.cos(a) * r, nz = z + Math.sin(a) * r; if (height(nx, nz) > WATER + 0.7) return [nx, nz]; }
  return [x, z];
}
function addThing(t, mesh) {
  [t.x, t.z] = landFix(t.x, t.z);
  t.y = Math.max(height(t.x, t.z), WATER); t.mesh = mesh;
  mesh.position.set(t.x, t.y, t.z); scene.add(mesh); things.push(t);
  return t;
}
function buildThings() {
  const S = g.S;
  for (const n of NPCS) {
    const m = E.humanoid(n.look);
    addThing({ type: 'npc', x: n.x, z: n.z, r: 3.4, label: 'Talk to ' + n.name.split(' ').pop(), npc: n, use: () => n.talk(g) }, m);
    m.rotation.y = Math.atan2(-n.x, 140 - n.z);
  }
  for (const w of WAYSTONES) {
    const m = E.waystone();
    const t = addThing({ type: 'way', x: w.x, z: w.z, r: 3.6, id: w.id, label: '', use: () => useWaystone(t, w) }, m);
    t.wake = () => { const on = !!S.way[w.id]; m.userData.ring.material.color.set(on ? 0x7fe6d6 : 0x555a66); m.userData.dot.material.color.set(on ? 0xffd58a : 0x555a66); t.label = on ? 'Rest at waystone' : 'Wake waystone'; };
    t.wake();
  }
  for (const c of CHESTS) {
    const m = E.chest(c.big); m.rotation.y = (c.x * 7 + c.z) % 6;
    const t = addThing({ type: 'chest', x: c.x, z: c.z, r: 2.8, label: 'Open chest', use: async () => {
      S.opened[c.id] = 1; t.label = null; m.userData.lid.rotation.x = -1.9; g.sfx.pickup();
      if (c.coins) { g.addCoins(c.coins); g.ui.toast('+' + c.coins + ' coin', true); }
      for (const k in c.loot) g.give(k, c.loot[k]);
    } }, m);
    if (S.opened[c.id]) { t.label = null; m.userData.lid.rotation.x = -1.9; }
  }
  MINUTES.forEach(([x, z], i) => { if (!S.minutes[i]) addThing({ type: 'minute', x, z, i, auto: 1.9 }, E.minute()); });
  PAGES.forEach((p, i) => { if (!S.pages[i]) addThing({ type: 'page', x: p.x, z: p.z, i, auto: 1.9 }, E.page()); });
  HERBS.forEach(([id, x, z]) => addThing({ type: 'herb', x, z, id, auto: 1.7, t: 0 }, E.herb(HERB_COLOR[id])));
  for (const b of BELLS) {
    const m = E.bell();
    const t = addThing({ type: 'bell', x: b.x, z: b.z, r: 3.4, label: S.opened[b.id] ? null : 'Ring the bell', swing: 0, use: async () => {
      S.opened[b.id] = 1; t.label = null; t.swing = 1; g.sfx.bell(); g.ui.toast('The bell rings, and the old echo lets go.', true);
    } }, m);
  }
  for (const c of CRATES) if (!S.opened[c.id]) {
    const t = addThing({ type: 'crate', x: c.x, z: c.z, r: 3, label: 'Take the cargo', use: async () => { S.opened[c.id] = 1; t.gone = true; t.mesh.visible = false; g.give('cargo', 1); } }, E.crate());
  }
  const blank = () => new THREE.Object3D();
  addThing({ type: 'desk', x: -33.5, z: 171.5, r: 3.4, label: "Enter Oren's workshop", use: () => readNote(g) }, blank());
  addThing({ type: 'door', x: 0, z: -42.5, r: 4.5, label: 'The Spire door', use: () => spireDoor(g) }, blank());
}
async function useWaystone(t, w) {
  const S = g.S;
  if (!S.way[w.id]) {
    S.way[w.id] = 1; t.wake(); g.sfx.minute(); g.ui.region(w.name, 'Waystone woken'); g.addXp(15);
    g.ui.toast('You can travel here from the map.', true);
  } else { g.ui.toast('You rest a while. The Stilled stir again.'); for (const e of foes) if (e.state === 'dead' && !e.id && !e.special) respawn(e); g.sfx.glyph(); }
  S.home = w.id; S.hp = g.stats().maxHp;
}
async function travel(id) {
  const w = WAYSTONES.find(w => w.id === id); if (!w || g.combat.active) return;
  g.busy = true; await g.ui.fade(true);
  const [x, z] = landFix(w.x + 2.5, w.z + 2.5); placePlayer(x, z);
  g.busy = false; await g.ui.fade(false); g.save();
}
function placePlayer(x, z) { const p = g.player; p.x = x; p.z = z; p.y = Math.max(height(x, z), WATER - 0.9); camSnap = true; }

/* ---- enemies ---- */
function makeFoe(kind, x, z, extra) {
  const def = ENEMIES[kind];
  return Object.assign({ kind, def, x, z, hx: x, hz: z, hp: def.hp, maxHp: def.hp, state: 'idle', model: null, cool: 0, wt: 0, tx: x, tz: z, rot: 0, dieT: 0, swing: 0, hitT: 0, t: 0 }, extra);
}
function buildFoes() {
  const R = rng(9041);
  for (const sp of SPAWNS) {
    let made = 0, tries = 0;
    while (made < sp.n && tries++ < 4000) {
      const x = (R() * 2 - 1) * 295, z = (R() * 2 - 1) * 295, w = weights(x, z);
      if (Math.hypot(x, z) > 288 || height(x, z) < WATER + 1.2) continue;
      if (!SPOTS.every(s => dist(x, z, s.x, s.z) > s.r + 9)) continue;
      const ok = sp.biome === 'meadow' ? (w.forest + w.flats + w.frost < 0.25 && dist(x, z, 0, 140) > 78 && dist(x, z, 0, -40) > 58) : w[sp.biome] > 0.75;
      if (!ok || foes.some(f => dist(x, z, f.x, f.z) < 16)) continue;
      foes.push(makeFoe(sp.kind, x, z)); made++;
    }
  }
  for (const b of BOSSES) { const f = makeFoe(b.kind, b.x, b.z, { id: b.id }); if (g.S.flags['killed_' + b.id]) f.state = 'dead'; f.rot = Math.atan2(-b.x, 140 - b.z); foes.push(f); }
}
function foeModel(e) {
  if (!e.model) { e.model = E.enemyModel(e.kind); e.base = e.model.scale.x; scene.add(e.model); }
  return e.model;
}
function respawn(e) { e.state = 'idle'; e.hp = e.maxHp; e.x = e.hx; e.z = e.hz; e.dieT = 0; e.cool = 0; e.phase2 = false; if (e.model) e.model.scale.setScalar(e.base); }

let fight = null;   // { foes, dx, dz } while a fight is on
function startCombat(e) {
  if (g.combat.active || g.busy && !e.special) return;
  const p = g.player, list = [e];
  if (!e.def.boss) for (const f of foes) if (f !== e && f.state !== 'dead' && !f.def.still && list.length < 3 && dist(f.x, f.z, e.x, e.z) < 10) list.push(f);
  const big = e.def.boss && e.kind !== 'gravedial' && e.kind !== 'oren' ? 5.4 : 4.2;
  /* Line the fight up along whichever direction keeps trees out of the camera's way. */
  const a0 = Math.atan2(e.x - p.x, e.z - p.z), camD = Math.max(9.5, 8.8 / (W / H)), near = g.world.blockers.filter(b => dist(b.x, b.z, p.x, p.z) < camD + 12);
  let dx = 0, dz = 0, bestScore = 1e9;
  for (let i = 0; i < 12; i++) {
    const a = a0 + (i % 2 ? -1 : 1) * Math.ceil(i / 2) * (TAU / 12), cx = Math.sin(a), cz = Math.cos(a);
    const mx = p.x + cx * 2.1, mz = p.z + cz * 2.1, kx = mx - cz * camD, kz = mz + cx * camD;
    if (height(p.x + cx * big, p.z + cz * big) < WATER + 0.3) continue;
    let score = i * 0.2 + Math.max(0, height(kx, kz) - p.y - 3) * 2;
    for (const b of near) {
      const t = clamp(((b.x - kx) * (mx - kx) + (b.z - kz) * (mz - kz)) / (camD * camD), 0, 1.15);
      const off = Math.hypot(b.x - (kx + (mx - kx) * t), b.z - (kz + (mz - kz) * t));
      if (off < 2.4 + t * 2.6) score += 3;
    }
    if (score < bestScore) { bestScore = score; dx = cx; dz = cz; }
  }
  if (bestScore > 1e8) { dx = Math.sin(a0); dz = Math.cos(a0); }
  {
    const mx = p.x + dx * 2.1, mz = p.z + dz * 2.1, kx = mx - dz * camD, kz = mz + dx * camD;
    g.world.hideScenery(b => {
      if (dist(b.x, b.z, mx, mz) > camD + 14) return false;
      const t = clamp(((b.x - kx) * (mx - kx) + (b.z - kz) * (mz - kz)) / (camD * camD), -0.1, 1.5);
      return Math.hypot(b.x - (kx + (mx - kx) * t), b.z - (kz + (mz - kz) * t)) < 3 + Math.max(0, t) * 4.5;
    });
  }
  list.forEach((f, i) => { const side = i === 0 ? 0 : i === 1 ? 1 : -1; f.state = 'fight'; f.fx = p.x + dx * (big + Math.abs(side) * 1.6) - dz * side * 2.3; f.fz = p.z + dz * (big + Math.abs(side) * 1.6) + dx * side * 2.3; foeModel(f).visible = true; });
  fight = { foes: list, dx, dz };
  p.rot = Math.atan2(dx, dz); p.moving = false; stick.on = false; $('stick').style.display = 'none';
  g.combat.start(list);
}
function fightSpecial(kind, x, z) {
  const e = makeFoe(kind, x, z, { special: true }); foes.push(e);
  const m = foeModel(e); m.position.set(x, height(x, z), z);
  startCombat(e);
}
function endCombat(result) {
  const S = g.S, list = fight.foes; fight = null;
  g.world.showScenery();
  if (result === 'win') {
    let xp = 0, coins = 0;
    for (const e of list) {
      e.state = 'dead'; e.dieT = Math.min(e.dieT || 1, 1); e.t = 200;
      xp += e.def.xp; coins += Math.round(lerp(e.def.coins[0], e.def.coins[1], Math.random()) * g.stats().coinMul);
      S.kills[e.kind] = (S.kills[e.kind] || 0) + 1;
      if (e.id || e.special) S.flags['killed_' + (e.id || e.kind)] = 1;
      for (const [id, ch] of e.def.drops) if (Math.random() < ch && !(ITEMS[id].type !== 'mat' && ITEMS[id].type !== 'use' && g.has(id))) g.give(id, 1);
    }
    g.addCoins(coins); g.ui.toast(`+${xp} xp${coins ? ' · +' + coins + ' coin' : ''}`); g.sfx.win(); g.addXp(xp);
    if (S.hp < 1) S.hp = 1;
    checkQuests();
    const boss = list.find(e => e.def.boss);
    if (boss && boss.kind === 'oren') run(() => afterOren(g));
    else if (boss && ['antlerking', 'hourglass', 'rimewarden'].includes(boss.kind)) run(async () => {
      const n = cogCount(g);
      await g.ui.say('', `${boss.def.name} finishes the moment it was stuck in, and is gone. Where it stood lies a Cog.`);
      await g.ui.say('', n >= 3 ? 'High above, the Spark shudders a third time. All three Cogs are yours. The Spire is waiting.' : 'High above, the Spark shudders forward a notch, and the colour of the sky changes.');
    });
    else if (e0(list).kind === 'scarecrow') run(() => g.ui.say('', 'The scarecrow folds up like washing. The ring in your hand is warm. Whatever the Stilled are, the Pivot can finish them.'));
  } else if (result === 'lose') {
    run(async () => {
      await g.ui.fade(true);
      for (const e of list) { if (e.special) removeFoe(e); else { e.state = 'idle'; e.hp = e.maxHp; e.cool = 6; e.phase2 = false; e.x = e.hx; e.z = e.hz; } }
      const lost = Math.floor(S.coins * 0.1); S.coins -= lost; S.hp = g.stats().maxHp; g.focus = 0;
      const w = WAYSTONES.find(w => w.id === S.home) || WAYSTONES[0], [x, z] = landFix(w.x + 2.5, w.z + 2.5); placePlayer(x, z);
      await g.ui.fade(false);
      await g.ui.say('', `The moment lets you go. You wake beside the waystone${lost ? ', ' + lost + ' coin lighter' : ''}.`);
    });
  } else {
    for (const e of list) { if (e.special) removeFoe(e); else { e.state = 'idle'; e.cool = 9; } }
    g.ui.toast('You slip away.');
  }
  g.save();
}
const e0 = l => l[0];
function removeFoe(e) { if (e.model) scene.remove(e.model); foes.splice(foes.indexOf(e), 1); }

/* ---- input ---- */
const keys = {}, stick = { on: false, id: null, ox: 0, oy: 0, x: 0, y: 0 }, look = new Map();
let camYaw = 0, camPitch = 0.42, camDist = 13, lastLook = -9, pinch = 0, camSnap = true;
function tapAction() {
  if (g.ui.dialogOpen) g.ui.advance();
  else if (g.combat.active) g.combat.tap();
}
addEventListener('keydown', e => {
  g.sfx.init();
  const k = e.key.toLowerCase();
  if (k === 'tab') e.preventDefault();
  if (e.repeat) return;
  keys[k] = true;
  if (!started || g.ui.crawlOpen) { if (g.ui.crawlNext && (k === ' ' || k === 'enter')) g.ui.crawlNext(); return; }
  if (k === ' ' || k === 'enter') { e.preventDefault(); tapAction(); }
  else if (k === 'e') { if (g.ui.dialogOpen) g.ui.advance(); else g.interact(); }
  else if (k === 'f') g.combat.flow();
  else if (k === 'q') g.combat.potion();
  else if (k >= '1' && k <= '9') g.ui.key(+k - 1);
  else if (k === 'tab' || k === 'escape' || k === 'i') { if (g.ui.menuOpen) g.ui.closeMenu(); else if (!g.ui.blocking && !g.combat.active) g.ui.openMenu(); }
  else if (k === 'm') { if (g.ui.menuOpen) g.ui.closeMenu(); else if (!g.ui.blocking && !g.combat.active) g.ui.openMenu('Map'); }
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
glCanvas.addEventListener('pointerdown', e => {
  g.sfx.init();
  if (e.pointerType === 'touch') g.touch = true;
  if (!started) return;
  if (g.ui.dialogOpen || g.combat.active) { tapAction(); return; }
  if (g.ui.blocking) return;
  try { glCanvas.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
  if (e.pointerType !== 'mouse' && e.clientX < W * 0.45 && !stick.on) {
    Object.assign(stick, { on: true, id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 });
    const s = $('stick'); s.style.display = 'block'; s.style.left = (e.clientX - 60) + 'px'; s.style.top = (e.clientY - 60) + 'px'; $('knob').style.transform = '';
  } else look.set(e.pointerId, { x: e.clientX, y: e.clientY });
});
glCanvas.addEventListener('pointermove', e => {
  if (stick.on && e.pointerId === stick.id) {
    let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy; const d = Math.hypot(dx, dy), m = 50;
    if (d > m) { dx *= m / d; dy *= m / d; }
    stick.x = dx / m; stick.y = dy / m; $('knob').style.transform = `translate(${dx}px,${dy}px)`;
  } else if (look.has(e.pointerId)) {
    const l = look.get(e.pointerId);
    if (look.size >= 2) {
      const o = [...look.entries()].find(([id]) => id !== e.pointerId)[1], d = Math.hypot(e.clientX - o.x, e.clientY - o.y);
      if (pinch) camDist = clamp(camDist * pinch / d, 6, 26);
      pinch = d;
    } else {
      camYaw -= (e.clientX - l.x) * 0.0055; camPitch = clamp(camPitch + (e.clientY - l.y) * 0.004, 0.08, 1.25); lastLook = time;
    }
    l.x = e.clientX; l.y = e.clientY;
  }
});
const pointerEnd = e => {
  if (stick.on && e.pointerId === stick.id) { stick.on = false; stick.x = stick.y = 0; $('stick').style.display = 'none'; }
  look.delete(e.pointerId); pinch = 0;
};
glCanvas.addEventListener('pointerup', pointerEnd); glCanvas.addEventListener('pointercancel', pointerEnd);
glCanvas.addEventListener('wheel', e => { camDist = clamp(camDist * (e.deltaY > 0 ? 1.1 : 0.9), 6, 26); e.preventDefault(); }, { passive: false });
addEventListener('contextmenu', e => e.preventDefault());

/* ---- per-frame updates ---- */
function updatePlayer(dt) {
  const p = g.player;
  let ix = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0) + stick.x;
  let iy = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0) - stick.y;
  const mag = Math.hypot(ix, iy);
  p.moving = mag > 0.15;
  if (p.moving) {
    const k = Math.min(1, mag) / mag; ix *= k; iy *= k;
    const fxx = -Math.sin(camYaw), fzz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    const mx = fxx * iy + rx * ix, mz = fzz * iy + rz * ix, speed = p.swim ? 5.5 : 10.5;
    let nx = p.x + mx * speed * dt, nz = p.z + mz * speed * dt;
    for (const c of g.world.colliders) { const d = dist(nx, nz, c.x, c.z), r = c.r + 0.5; if (d < r && d > 0.001) { nx = c.x + (nx - c.x) / d * r; nz = c.z + (nz - c.z) / d * r; } }
    const rad = Math.hypot(nx, nz); if (rad > EDGE) { nx *= EDGE / rad; nz *= EDGE / rad; }
    p.x = nx; p.z = nz;
    p.rot += angDiff(Math.atan2(mx, mz), p.rot) * Math.min(1, dt * 12);
    if (time - lastLook > 1.2) { const d = angDiff(p.rot + Math.PI, camYaw); camYaw += d * (1 + Math.cos(d)) * 0.5 * Math.min(1, dt * 1.6); }
  }
  const gh = height(p.x, p.z);
  p.swim = gh < WATER - 0.75;
  const ty = p.swim ? WATER - 1.05 : gh;
  p.y = camSnap ? ty : lerp(p.y, ty, Math.min(1, dt * 14));
}
function poseFoe(e, dt, moving) {
  const m = e.model, y = Math.max(height(e.x, e.z), WATER - 0.3);
  m.position.set(e.x, y, e.z); m.rotation.y = e.rot;
  E.animate(m, time + e.hx, moving, e.swing);
}
function updateFoes(dt) {
  const p = g.player, inFight = g.combat.active, calm = g.ui.blocking || g.busy;
  const safe = dist(p.x, p.z, 0, 140) < 58;
  for (const e of foes) {
    if (e.state === 'dead') {
      if (e.dieT > 0 && e.model) { e.dieT = Math.max(0, e.dieT - dt * 1.6); e.model.scale.setScalar(e.base * e.dieT); e.model.rotation.y += dt * 6; if (e.dieT === 0) e.model.visible = false; }
      if (!e.id && !e.special && !inFight && (e.t -= dt) <= 0 && dist(p.x, p.z, e.hx, e.hz) > 60) respawn(e);
      continue;
    }
    const d = dist(p.x, p.z, e.x, e.z);
    if (d > 125) { if (e.model) e.model.visible = false; continue; }
    const m = foeModel(e); m.visible = true;
    if (e.state === 'fight') {
      e.x = lerp(e.x, e.fx, Math.min(1, dt * 6)); e.z = lerp(e.z, e.fz, Math.min(1, dt * 6));
      e.rot = Math.atan2(p.x - e.x, p.z - e.z);
      const wind = g.combat.zones.some(z => z.foe === e) ? 0.28 : 0, lunge = Math.sin(e.swing * Math.PI) * 1.5 - e.hitT * 0.4;
      poseFoe(e, dt, false);
      E.animate(m, time, false, Math.max(wind, e.swing));
      m.position.x += -fight.dx * lunge; m.position.z += -fight.dz * lunge;
      if (e.hp <= 0) { e.dieT = e.dieT || 1; e.dieT = Math.max(0.01, e.dieT - dt * 1.6); m.scale.setScalar(e.base * e.dieT); }
      continue;
    }
    if (inFight || calm) { poseFoe(e, dt, false); continue; }
    e.cool = Math.max(0, e.cool - dt);
    let moving = false;
    const step = (tx, tz, sp) => {
      const dx = tx - e.x, dz = tz - e.z, l = Math.hypot(dx, dz); if (l < 0.4) return;
      const nx = e.x + dx / l * sp * dt, nz = e.z + dz / l * sp * dt;
      e.rot += angDiff(Math.atan2(dx, dz), e.rot) * Math.min(1, dt * 8);
      if (height(nx, nz) > WATER + 0.3) { e.x = nx; e.z = nz; moving = true; }
    };
    if (e.def.still) {
      if (d < 24) e.rot += angDiff(Math.atan2(p.x - e.x, p.z - e.z), e.rot) * Math.min(1, dt * 3);
      if (d < (e.def.boss ? 7 : 4.6) && !e.cool) { startCombat(e); continue; }
    } else if (e.state === 'chase') {
      if (d > 27 || dist(e.x, e.z, e.hx, e.hz) > 36 || safe) { e.state = 'idle'; e.cool = 3; }
      else if (d < 2.4) { startCombat(e); continue; }
      else step(p.x, p.z, 6.4);
    } else {
      if (d < 13 && !e.cool && !safe) e.state = 'chase';
      else { if ((e.wt -= dt) <= 0) { e.wt = 3 + Math.random() * 5; e.tx = e.hx + (Math.random() * 2 - 1) * 9; e.tz = e.hz + (Math.random() * 2 - 1) * 9; } step(e.tx, e.tz, 1.6); }
    }
    poseFoe(e, dt, moving);
  }
}
function updateThings(dt) {
  const p = g.player, S = g.S; let best = null, bd = 99;
  for (const t of things) {
    if (t.gone) continue;
    const d = dist(p.x, p.z, t.x, t.z), m = t.mesh;
    if (t.type === 'herb' && t.t > 0) { t.t -= dt; if (t.t <= 0) m.visible = true; continue; }
    m.visible = d < 140;
    if (d > 140) continue;
    if (m.userData.spin) for (const s of m.userData.spin) s.rotation.y += dt * 2;
    if (t.type === 'minute') m.position.y = t.y + Math.sin(time * 2 + t.i) * 0.2;
    if (t.type === 'npc' && d < 9 && !g.combat.active) m.rotation.y += angDiff(Math.atan2(p.x - t.x, p.z - t.z), m.rotation.y) * Math.min(1, dt * 4);
    if (t.type === 'way' && S.way[t.id]) { const a = time * 1.4; m.userData.dot.position.set(Math.cos(a) * 1.15, 3.2 + Math.sin(a) * 1.15, 0); }
    if (t.type === 'bell' && t.swing > 0) { t.swing = Math.max(0, t.swing - dt * 0.4); m.userData.bell.rotation.z = Math.sin(time * 9) * 0.5 * t.swing; }
    if (g.combat.active || g.busy || g.ui.blocking) continue;
    if (t.auto && d < t.auto) {
      if (t.type === 'minute') { S.minutes[t.i] = 1; t.gone = true; m.visible = false; const n = Object.keys(S.minutes).length; g.sfx.minute(); g.ui.region('A Lost Minute', n + ' of ' + MINUTES.length); g.addXp(12); checkQuests(); }
      else if (t.type === 'page') { S.pages[t.i] = 1; t.gone = true; m.visible = false; g.sfx.pickup(); g.startQuest('pages'); run(async () => { await g.ui.say("Oren's journal", PAGES[t.i].t); g.addXp(15); }); }
      else if (t.type === 'herb') { t.t = 240; m.visible = false; g.give(t.id, 1); }
      continue;
    }
    if (t.label && d < t.r && d < bd) { best = t; bd = d; }
  }
  g.nearest = best;
}
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
function updateCamera(dt) {
  const p = g.player;
  if (fight) {
    const aspect = W / H, d = Math.max(9.5, 8.8 / aspect), reach = fight.foes[0].def.boss ? 2.7 : 2.1;
    tmpB.set(p.x + fight.dx * reach, p.y + 1.7, p.z + fight.dz * reach);
    tmpA.set(tmpB.x - fight.dz * d, tmpB.y + 1.2 + d * 0.1, tmpB.z + fight.dx * d);
  } else {
    const c = Math.cos(camPitch) * camDist;
    tmpB.set(p.x, p.y + 1.9, p.z);
    tmpA.set(p.x + Math.sin(camYaw) * c, p.y + 1.9 + Math.sin(camPitch) * camDist, p.z + Math.cos(camYaw) * c);
    /* If a hillside is between the camera and the player, pull the camera in. */
    for (let i = 1; i <= 5; i++) {
      const t = i / 5, x = lerp(tmpB.x, tmpA.x, t), z = lerp(tmpB.z, tmpA.z, t), y = lerp(tmpB.y, tmpA.y, t);
      if (height(x, z) + 0.5 > y) { tmpA.lerpVectors(tmpB, tmpA, Math.max(0.22, t - 0.2)); tmpA.y += 1.5; break; }
    }
  }
  tmpA.y = Math.max(tmpA.y, height(tmpA.x, tmpA.z) + 1.2, WATER + 0.8);
  const k = camSnap ? 1 : Math.min(1, dt * (fight ? 4 : 12));
  camPos.lerp(tmpA, k); camLook.lerp(tmpB, camSnap ? 1 : Math.min(1, dt * (fight ? 5 : 16)));
  camSnap = false;
  camera.position.copy(camPos);
  if (shake > 0.01) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; shake *= Math.exp(-dt * 8); }
  camera.lookAt(camLook);
}
function updatePlayerModel(dt) {
  const p = g.player, m = p.model;
  p.swing = Math.max(0, p.swing - dt * 4);
  m.position.set(p.x, p.y, p.z); m.rotation.y = p.rot;
  if (fight) { const l = Math.sin(p.swing * Math.PI) * 1.3; m.position.x += fight.dx * l; m.position.z += fight.dz * l; }
  E.animate(m, time, p.moving, p.swing);
  if (p.swim) m.rotation.x = 0.9; else m.rotation.x = 0;
  m.userData.ring.rotation.z = time * 3;
}

let beacon, lastRegion = '', questT = 0, saveT = 0;
function frame(now) { requestAnimationFrame(frame); tick(now); }
function tick(now) {
  const dt = clamp((now - last) / 1000 || 0.016, 0.001, 0.05); last = now;
  if (!started) return;
  time += dt;
  const ui = g.ui, paused = ui.blocking && !ui.dialogOpen;
  if (!paused) {
    if (!g.combat.active && !ui.blocking && !g.busy) updatePlayer(dt); else g.player.moving = false;
    updateFoes(dt); updateThings(dt); g.combat.update(dt);
    if ((questT += dt) > 0.5) { questT = 0; checkQuests(); const r = regionName(g.player.x, g.player.z); if (r !== lastRegion) { lastRegion = r; if (!g.combat.active && !ui.blocking) ui.region(r); } }
    if ((saveT += dt) > 20) { saveT = 0; if (!g.busy) g.save(); }
    if (!g.combat.active) g.focus = Math.max(0, g.focus - dt * 0.4);
  }
  updatePlayerModel(dt); updateCamera(dt);
  const t = g.combat.active ? null : g.target();
  beacon.visible = !!t && dist(g.player.x, g.player.z, t ? t[0] : 0, t ? t[1] : 0) > 7;
  if (t) { beacon.position.set(t[0], Math.max(height(t[0], t[1]), WATER), t[1]); beacon.children[0].position.y = 4.2 + Math.sin(time * 3) * 0.3; }
  g.world.update(dt, time, camera);
  renderer.render(scene, camera);
  ui.hud();
  fxc.clearRect(0, 0, W, H);
  if (g.combat.active) g.combat.draw(fxc);
}
let last = 0;

function resize() {
  W = innerWidth; H = innerHeight;
  renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  fx.width = W * dpr; fx.height = H * dpr; fxc.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.combat.layout(W, H);
}

/* ---- boot ---- */
function boot() {
  g.combat = new Combat(g); g.ui = new UI(g);
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { saved = null; }
  g.world = buildWorld(scene);
  beacon = new THREE.Group();
  beacon.add(E.marker());
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 90, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd58a, transparent: true, opacity: 0.22, depthWrite: false, fog: false })); beam.position.y = 50; beacon.add(beam);
  beacon.children[0].scale.setScalar(2.4); scene.add(beacon);
  g.player.model = E.humanoid({ cloth: 0x2f8f86, hair: 0x3a2a1a, cloak: 0x8a3a55, ring: true }); scene.add(g.player.model);
  resize(); addEventListener('resize', resize); addEventListener('orientationchange', () => setTimeout(resize, 200));
  document.addEventListener('visibilitychange', () => { if (document.hidden) g.save(); });
  addEventListener('pagehide', () => g.save());

  const begin = async isNew => {
    g.sfx.init();
    g.S = isNew || !saved ? fresh() : Object.assign(fresh(), saved);
    g.sfx.setMute(g.S.mute);
    buildThings(); buildFoes();
    const p = g.player; p.rot = g.S.rot; placePlayer(g.S.x, g.S.z); camYaw = p.rot + Math.PI;
    g.world.setPhase(g.S.flags.ended === 'caught' ? 4 : cogCount(g), true);
    $('title').classList.add('hidden'); g.ui.titleOpen = false;
    if (!g.S.quests.main) { await g.ui.crawl(INTRO); g.S.quests.main = { step: 0, k0: {} }; }
    $('hud').classList.remove('hidden');
    started = true; lastRegion = ''; checkQuests(); g.save();
  };
  $('loading').textContent = '';
  if (saved && saved.quests && saved.quests.main) { $('btnContinue').classList.remove('hidden'); $('btnContinue').onclick = () => begin(false); }
  const bn = $('btnNew');
  bn.onclick = () => { if (saved && saved.quests && saved.quests.main && !bn.dataset.sure) { bn.dataset.sure = 1; bn.textContent = 'Erase save and start over?'; } else begin(true); };
  window.HF = g; g._tick = tick; g._foes = foes; g._things = things;   // handy for debugging and automated play-tests
  requestAnimationFrame(frame);
}
setTimeout(boot, 30);
