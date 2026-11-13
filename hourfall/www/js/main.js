/* Hourfall: game loop, player, streaming of towns / people / enemies, world content, cutscenes, saving. */
import * as THREE from './vendor/three.module.min.js';
import { buildWorld, height, weights, groundColor, regionAt, townAt, skyGround, WATER, EDGE, TOWNS, TOWN, ISLES, LIFT, REG } from './world.js';
import * as E from './models.js';
import { buildTown, plazaR, polar } from './towns.js';
import { Builder, G } from './gfx.js';
import { ITEMS, KINDS, ROSTER, BOSSES, COGS, SKILLS, PAGES, HERB_COLOR, WAY_NAMES, foeStats, xpNeed } from './data.js';
import { QUESTS, NPCS, INTRO, SITES, CROWD, ambientLine, readNote, spireDoor, cogScene, cogCount } from './story.js';
import { Combat } from './combat.js';
import { UI } from './ui.js';
import { makeAudio } from './audio.js';
import { clamp, lerp, dist, rng, TAU, angDiff } from './util.js';

const SAVE_KEY = 'hourfall.save.v2', CELL = 180;
const $ = id => document.getElementById(id);
const START = polar(TOWN.dawnmere, 185, 9);
const fresh = () => ({ v: 2, name: 'Apprentice', x: START[0], z: START[1], rot: Math.PI, layer: 'ground', hp: 104, level: 1, xp: 0, sp: 0, coins: 30, inv: { w_needle: 1, tonic: 3 },
  eq: { weapon: 'w_needle', armor: null, trinket: null, gadget: null, glyphs: [] }, up: {}, skills: {}, flags: {}, quests: {}, kills: {}, opened: {}, cells: {}, minutes: {}, pages: {}, way: {}, seen: { dawnmere: 1 },
  home: 'dawnmere', track: 'main', mute: false, look: { skin: 2, hair: 1, hairStyle: 1, top: 0, cape: 2, body: 0 } });

const glCanvas = $('gl'), fx = $('fx'), fxc = fx.getContext('2d');
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: window.devicePixelRatio < 2, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6)); renderer.autoClear = false;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(55, 1, 0.4, 20000);
let W = 1, H = 1, started = false, shake = 0, time = 0, last = 0;
const v3 = new THREE.Vector3();

const g = {
  S: fresh(), focus: 0, touch: matchMedia('(pointer: coarse)').matches, sfx: makeAudio(), nearest: null, busy: false, minuteTotal: 0, lastFightTime: 0,
  player: { x: 0, z: 0, y: 0, rot: Math.PI, moving: false, swing: 0, swim: false, under: false, model: null },
  flag: n => g.S.flags[n],
  setFlag(n, v = 1) { g.S.flags[n] = v; if (n === 'ended') g.S.flags.endings = Object.assign({}, g.S.flags.endings, { [v]: 1 }); checkQuests(); },
  has: id => g.S.inv[id] || 0,
  give(id, n = 1, quiet) {
    const it = ITEMS[id], S = g.S; S.inv[id] = (S.inv[id] || 0) + n;
    if (!quiet) { g.ui.toast(`${it.icon} ${it.name}${n > 1 ? ' ×' + n : ''}`, it.r); if (it.r >= 3) { g.sfx.rare(); g.ui.region(it.name, ['', '', '', 'Epic', 'Legendary'][it.r] + ' item found'); } else g.sfx.pickup(); }
    const eq = S.eq;
    if ((it.type === 'armor' && !eq.armor) || (it.type === 'trinket' && !eq.trinket) || (it.type === 'gadget' && !eq.gadget) || (it.type === 'glyph' && eq.glyphs.length < g.glyphSlots() && !eq.glyphs.includes(id))) g.equip(id);
    checkQuests();
  },
  take(id, n = 1) { g.S.inv[id] = Math.max(0, (g.S.inv[id] || 0) - n); if (!g.S.inv[id]) { delete g.S.inv[id]; if (g.isEquipped(id)) g.unequip(id); } },
  glyphSlots: () => 2 + (g.S.skills.glyph3 || 0),
  isEquipped(id) { const e = g.S.eq; return e.weapon === id || e.armor === id || e.trinket === id || e.gadget === id || e.glyphs.includes(id); },
  equip(id) {
    const it = ITEMS[id], e = g.S.eq;
    if (it.type === 'glyph') { if (!e.glyphs.includes(id)) { if (e.glyphs.length >= g.glyphSlots()) e.glyphs.shift(); e.glyphs.push(id); } }
    else e[it.type] = id;
    g.S.hp = Math.min(g.S.hp, g.stats().maxHp);
  },
  unequip(id) {
    const it = ITEMS[id], e = g.S.eq;
    if (it.type === 'glyph') e.glyphs = e.glyphs.filter(x => x !== id); else if (it.type !== 'weapon') e[it.type] = null; else e.weapon = 'w_needle';
    g.S.hp = Math.min(g.S.hp, g.stats().maxHp);
  },
  stats() {
    const S = g.S, wid = ITEMS[S.eq.weapon] ? S.eq.weapon : 'w_needle', w = ITEMS[wid], a = ITEMS[S.eq.armor] || {}, t = ITEMS[S.eq.trinket] || {}, gd = ITEMS[S.eq.gadget], sk = {};
    for (const s of SKILLS) sk[s.id] = S.skills[s.id] || 0;
    return { weapon: w, armor: a, trinket: t, gadget: gd ? Object.assign({ id: S.eq.gadget }, gd) : null, sk, atk: w.atk * (1 + 0.12 * (S.up[wid] || 0)) + S.level * 1.5, def: a.def || 0,
      maxHp: 90 + 14 * S.level + (a.hp || 0) + (t.hp || 0) + 25 * sk.vital, guardMul: t.guard || 1, focusMul: t.focus || 1, coinMul: t.coin || 1, slow: t.slow || 1, glyphs: S.eq.glyphs.filter(id => g.has(id)) };
  },
  useItem(id) {
    const it = ITEMS[id]; if (!g.has(id) || it.type !== 'use') return false;
    if (it.heal) g.heal(it.heal);
    if (it.focus) g.focus = 100;
    g.take(id, 1); g.sfx.drink(); g.ui.toast(it.icon + ' ' + it.name + ' used');
    return true;
  },
  usePotion() {
    const miss = g.stats().maxHp - g.S.hp, have = ['tonic', 'tonic2', 'tonic3', 'elixir'].filter(id => g.has(id));
    if (!have.length || miss < 1) return false;
    return g.useItem(have.find(id => ITEMS[id].heal >= miss) || have[have.length - 1]);
  },
  hurt(n) { g.S.hp = Math.max(0, g.S.hp - n); return g.S.hp <= 0; },
  heal(n) { g.S.hp = Math.min(g.stats().maxHp, g.S.hp + n); },
  addCoins(n) { g.S.coins += Math.round(n); },
  addXp(n) {
    const S = g.S; S.xp += n;
    while (S.xp >= xpNeed(S.level)) { S.xp -= xpNeed(S.level); S.level++; S.sp++; S.hp = g.stats().maxHp; g.ui.region('Level ' + S.level, 'Skill point earned'); g.sfx.level(); }
  },
  startQuest(id, quiet) {
    if (g.S.quests[id]) return;
    g.S.quests[id] = { step: 0, k0: Object.assign({}, g.S.kills) };
    if (id !== 'main' && !quiet) { g.ui.region(QUESTS[id].name, 'New quest'); g.sfx.quest(); if (!g.questActive(g.S.track) || g.S.track === 'main') g.S.track = id; }
    checkQuests();
  },
  questActive: id => !!g.S.quests[id] && !g.S.quests[id].done,
  questDone: id => !!g.S.quests[id] && g.S.quests[id].done,
  killsSince: (id, kind) => (g.S.kills[kind] || 0) - ((g.S.quests[id] && g.S.quests[id].k0[kind]) || 0),
  questText(id) { const q = QUESTS[id], s = q.steps[g.S.quests[id].step]; return s ? (typeof s.t === 'function' ? s.t(g) : s.t) : ''; },
  target(id = g.S.track) {
    if (!g.questActive(id)) return null;
    const s = QUESTS[id].steps[g.S.quests[id].step]; if (!s || !s.at) return null;
    return s.at(g);
  },
  tracked() {
    let id = g.S.track;
    if (!g.questActive(id)) { id = Object.keys(g.S.quests).find(g.questActive); if (!id) return null; g.S.track = id; }
    const t = g.target(), p = g.player;
    let d = null, dir = '';
    if (t) { d = Math.round(dist(p.x, p.z, t[0], t[1])); dir = '↑↗→↘↓↙←↖'[Math.round(Math.atan2(t[0] - p.x, -(t[1] - p.z)) / (Math.PI / 4) + 8) % 8]; }
    return { name: QUESTS[id].name, text: g.questText(id), dist: d, dir };
  },
  project(obj, up = 0) { v3.setFromMatrixPosition(obj.matrixWorld); v3.y += up; v3.project(camera); return { x: (v3.x * 0.5 + 0.5) * W, y: (-v3.y * 0.5 + 0.5) * H }; },
  projectPlayer: () => g.project(g.player.model, 2.3),
  playerSwing() { g.player.swing = 1; },
  shake(n) { shake = Math.max(shake, n); },
  save() {
    if (g.combat.active || !started) return;
    const S = g.S; S.x = g.player.x; S.z = g.player.z; S.rot = g.player.rot;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* storage full or blocked: play on without saving */ }
  },
  reset() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* nothing to erase */ } started = false; location.reload(); },
  interact() { if (g.nearest && !g.busy && !g.ui.blocking && !g.combat.active && !cine) run(g.nearest.use); },
  rebuildPlayer() {
    const L = g.S.look, p = g.player;
    if (p.model) scene.remove(p.model);
    p.model = E.person({ skin: E.SKINS[L.skin], hair: E.HAIRS[L.hair], hairStyle: L.hairStyle, top: E.DYES[L.top], cape: E.DYES[L.cape], body: L.body, ring: true, trim: 0xd9b45a });
    scene.add(p.model);
  },
  travel, duel, endCombat,
  /* Turn the camera to face the player, for the character editor. */
  viewFront(on) { camYaw = on ? g.player.rot + 0.35 : g.player.rot + Math.PI; camDist = on ? 6.5 : 13; camPitch = on ? 0.16 : 0.42; lastLook = on ? 1e9 : time; },
  afterEnding() { g.world.setPhase(4); },
  cine: {
    /* Camera circles a place while its name is shown. */
    orbit(x, z, r, h, secs, title) { return shot({ kind: 'orbit', x, z, r, h, dur: secs, y: Math.max(height(x, z), 0) + (g.S.layer === 'sky' ? 230 : 0) }, title); },
    /* Camera turns from where it is (or `from`) to look at a far point. */
    look(from, at, secs, title) { return shot({ kind: 'look', from, at, dur: secs }, title); },
  },
};
let cine = null;
function shot(c, title) {
  if (title) g.ui.region(title);
  document.body.classList.add('cine');
  return new Promise(done => { cine = Object.assign(c, { t: 0, done: () => { cine = null; document.body.classList.remove('cine'); camSnap = true; done(); } }); });
}

async function run(fn) {
  if (g.busy) return;
  g.busy = true;
  try { await fn(); } catch (e) { console.error(e); } finally { g.busy = false; checkQuests(); g.save(); }
}
const phase = () => (g.S.flags.ended === 'caught' ? 4 : Math.min(3, Math.floor(cogCount(g) / 3)));
function checkQuests() {
  const S = g.S;
  for (const id of Object.keys(S.quests)) {
    const q = S.quests[id], def = QUESTS[id];
    if (!def || q.done) continue;
    const before = q.step;
    while (q.step < def.steps.length && def.steps[q.step].done(g)) q.step++;
    if (q.step >= def.steps.length) {
      q.done = true;
      const r = def.reward || {};
      if (id !== 'main') { g.ui.region(def.name, 'Quest complete'); g.sfx.quest(); }
      if (r.coins) { g.addCoins(r.coins); g.ui.toast('+' + r.coins + ' coin', 1); }
      if (r.items) for (const k in r.items) g.give(k, r.items[k]);
      if (r.xp) g.addXp(r.xp);
      if (S.track === id) S.track = 'main';
    } else if (q.step !== before && started) g.ui.toast('Quest updated: ' + def.name);
  }
  if (g.world) g.world.setPhase(phase());
}

/* ---- where the ground is ---- */
const sky = () => g.S.layer === 'sky';
function groundY(x, z) { return sky() ? (skyGround(x, z) ?? ISLES[0].y) : height(x, z); }
function landFix(x, z, wet) {
  if (wet || height(x, z) > WATER + 0.6) return [x, z];
  for (let r = 3; r < 90; r += 3) for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, nx = x + Math.cos(a) * r, nz = z + Math.sin(a) * r; if (height(nx, nz) > WATER + 0.8) return [nx, nz]; }
  return [x, z];
}

/* ---- things: everything you can walk up to. Meshes exist only while the player is near. ---- */
const things = [], foes = [];
function addThing(t) {
  if (!t.sky && !t.wet) [t.x, t.z] = landFix(t.x, t.z);
  t.y = t.sky ? ISLES[0].y : height(t.x, t.z); if (!t.sky && !t.wet) t.y = Math.max(t.y, WATER);
  things.push(t); return t;
}
function showThing(t) { if (!t.mesh) { t.mesh = t.make(); t.mesh.position.set(t.x, t.y, t.z); if (t.rot !== undefined) t.mesh.rotation.y = t.rot; scene.add(t.mesh); if (t.init) t.init(t.mesh); } }
function hideThing(t) { if (t.mesh) { scene.remove(t.mesh); t.mesh = null; } }
function dropThing(t) { hideThing(t); const i = things.indexOf(t); if (i >= 0) things.splice(i, 1); }
const blank = () => new THREE.Object3D();

function buildStatic() {
  const S = g.S;
  for (const n of NPCS) {
    const t = TOWN[n.town], [x, z] = polar(t, n.ang, n.rad), R = rng(n.id.length * 97 + x);
    addThing({ type: 'npc', x, z, sky: t.sky, wet: t.reg === 'reef', r: 3.6, label: 'Talk to ' + n.name.split(' ').pop(), rot: Math.atan2(t.x - x, t.z - z), make: () => E.person(n.look || E.culture(t.style, R)), use: () => n.talk(g), named: n.name });
  }
  for (const id in WAY_NAMES) {
    const t = TOWN[id], [x, z] = polar(t, 45, plazaR(t) - 7);
    const th = addThing({ type: 'way', x, z, id, sky: t.sky, wet: t.reg === 'reef', r: 3.8, label: '', make: E.waystone, init: m => th.wake(m), use: () => useWaystone(th, id) });
    th.wake = m => { const on = !!S.way[id]; if (m) { m.userData.ringMesh.material.color.set(on ? 0x7fe6d6 : 0x555a66); m.userData.dot.material.color.set(on ? 0xffd58a : 0x555a66); } th.label = on ? 'Rest at waystone' : 'Wake waystone'; };
    th.wake();
  }
  for (const [id, kind, x, z, label] of SITES) {
    const wet = kind === 'wreck';
    const th = addThing({ type: 'site', id, x, z, wet, r: 3.8, label: S.opened[id] ? null : label, swing: 0,
      make: () => (kind === 'bell' ? E.bell() : kind === 'crate' ? E.crate() : kind === 'wreck' ? E.chest(2) : new Builder().add(G.cyl(1.2, 1.5, 2.4, 8), 0x8d8a9a, { y: 1.2 }).add(G.cone(0.9, S.opened[id] ? 2.2 : 0.01, 6), 0xffa040, { y: 3.4 }).mesh()),
      use: async () => {
        if (kind === 'beacon' && !g.flag('frost_ward')) return g.ui.say('', 'A cold iron beacon. It will not hold a flame without a ward.');
        S.opened[id] = 1; th.label = null;
        if (kind === 'bell') { th.swing = 1; g.sfx.bell(); g.ui.toast('The bell rings, and the old echo lets go.', 1); }
        if (kind === 'crate') { g.give('cargo', 1); hideThing(th); th.gone = true; }
        if (kind === 'wreck') { g.give('clapper', 1); th.mesh.userData.lid.rotation.x = -1.9; }
        if (kind === 'beacon') { hideThing(th); g.sfx.flow(); g.ui.toast('The beacon catches.', 1); }
      } });
    if (kind === 'crate' && S.opened[id]) th.gone = true;
  }
  const dm = TOWN.dawnmere, hm = TOWN.highmark;
  let [x, z] = polar(dm, 330, 34);
  addThing({ type: 'desk', x, z, r: 4, label: "Enter Oren's workshop", make: blank, use: () => readNote(g) });
  [x, z] = polar(hm, 0, 78);
  addThing({ type: 'door', x, z, r: 6, label: 'The Spire door', make: blank, use: () => spireDoor(g) });
  [x, z] = polar(TOWN.millbrook, 300, 30);
  const lk = addThing({ type: 'chest', x, z, r: 3, label: S.opened.locket ? null : 'Open chest', make: () => E.chest(3), init: m => { if (S.opened.locket) m.userData.lid.rotation.x = -1.9; }, use: async () => { S.opened.locket = 1; lk.label = null; lk.mesh.userData.lid.rotation.x = -1.9; g.give('locket', 1); g.addCoins(60); } });
  /* quest spots at two arenas */
  const spot = (town, flag, need, label, line) => { const t = TOWN[town]; const th = addThing({ type: 'spot', x: t.x + 6, z: t.z + 6, r: 5, make: blank, get label() { return !g.flag(flag) && need() ? label : null; }, use: async () => { g.sfx.horn(); await g.ui.say('', line); g.setFlag(flag); } }); return th; };
  spot('a_coast', 'horn_blown', () => g.has('r_horn') > 0, 'Blow the Storm Horn', 'The horn bellows across the frozen surf. Far out, something enormous turns over, and starts walking in.');
  spot('a_jungle', 'lure_set', () => g.flag('has_lure'), 'Hang the lure-lantern', 'Moths drift in from every side and hang around the lantern like snow. Behind them, antlers.');
  /* wind-lift */
  addThing({ type: 'lift', x: LIFT.x, z: LIFT.z, r: 4.5, make: E.lift, get label() { return g.flag('lift_on') ? 'Ride the wind-lift up' : null; }, use: () => rideLift('sky') });
  addThing({ type: 'lift', x: LIFT.x, z: LIFT.z, sky: true, r: 4.5, make: E.lift, label: 'Ride the wind-lift down', use: () => rideLift('ground') });
  /* guardians */
  for (const b of BOSSES) {
    let bx, bz, skyB = false;
    if (b.sky) { bx = ISLES[b.sky].x; bz = ISLES[b.sky].z; skyB = true; } else if (b.ang !== undefined) [bx, bz] = polar(TOWN[b.town], b.ang, b.rad); else { bx = TOWN[b.town].x; bz = TOWN[b.town].z; }
    const f = makeFoe(b.kind, b.lvl, bx, bz, { id: b.id, boss: b, sky: skyB, wet: b.id === 'drownedbell' });
    if (S.flags['killed_' + b.id]) f.state = 'dead';
    foes.push(f);
  }
}
async function rideLift(to) {
  g.sfx.flow(); await g.ui.fade(true);
  g.S.layer = to; placePlayer(LIFT.x + 3, LIFT.z + 3);
  await g.ui.fade(false);
  if (to === 'sky' && !g.S.seen.aerie) { g.S.seen.aerie = 1; g.ui.region('The Aerie', 'City on the wind'); }
}
async function useWaystone(t, id) {
  const S = g.S;
  if (!S.way[id]) { S.way[id] = 1; t.wake(t.mesh); g.sfx.minute(); g.ui.region(WAY_NAMES[id], 'Waystone woken'); g.addXp(20); g.ui.toast('You can travel here from the map.', 1); }
  else { g.ui.toast('You rest a while. The Stilled stir again.'); deadCells.clear(); g.sfx.glyph(); }
  S.home = id; S.hp = g.stats().maxHp;
}
async function travel(id) {
  const t = TOWN[id]; if (!t || g.combat.active) return;
  g.busy = true; await g.ui.fade(true);
  g.S.layer = t.sky ? 'sky' : 'ground';
  const [x, z] = polar(t, 45, plazaR(t) - 11); placePlayer(x, z);
  g.busy = false; await g.ui.fade(false); g.save();
}
function placePlayer(x, z) {
  const p = g.player; p.x = x; p.z = z; p.y = groundY(x, z); camSnap = true;
  g.world.stream(x, z, true); streamT = 9;
}

/* ---- towns: buildings and their crowds load as you approach ---- */
const loaded = new Map();
function streamTowns() {
  const p = g.player; let changed = false;
  for (const t of TOWNS) {
    const d = dist(p.x, p.z, t.x, t.z), on = loaded.has(t.id);
    if (!on && d < t.r + 520) {
      const o = { things: [] };
      if (t.size > 0) {
        const b = buildTown(t); o.mesh = b.mesh; o.col = b.colliders; scene.add(o.mesh);
        const R = rng(t.x * 7 + t.z * 13 + 1), n = CROWD[t.size], P = plazaR(t);
        for (let i = 0; i < n; i++) {
          const a = R() * 360, rad = P * (0.3 + R() * 0.62), [x, z] = polar(t, a, rad), look = E.culture(t.style, rng(i * 131 + t.x));
          if (t.id === 'highmark' && i < 4) Object.assign(look, { outfit: 'armor', hat: 'helm', hatColor: 0xc8443a, cape: 0x3d5fb0 });
          const th = addThing({ type: 'amb', x, z, hx: x, hz: z, sky: t.sky, wet: t.reg === 'reef', r: 3, label: 'Talk', rot: R() * TAU, wt: R() * 6, make: () => E.person(look), use: () => g.ui.say(t.name + ' townsfolk', ambientLine(g, t.style === 'crag' && t.reg === 'heath' ? 'sky' : t.style, i + t.x)) });
          o.things.push(th);
        }
      } else {
        const b = new Builder(), c = { vale: 0xc8b070, coast: 0xd9c8a0, jungle: 0x6f7a5c, desert: 0xbfe6dc, crag: 0x8a807a, frost: 0xb9c6d6, reef: 0x9fe6d6, volcano: 0x3a3644 }[t.style];
        for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, x = t.x + Math.cos(a) * 26, z = t.z + Math.sin(a) * 26; b.add(G.cyl(1, 1.3, 6 + (i * 7 % 5), 7), c, { x, y: height(x, z) + 3, z }); }
        if (t.id === 'a_desert') b.add(G.tor(15, 1.2, 30), 0xd9b45a, { x: t.x, y: t.h + 3, z: t.z - 8, rx: -1.2 });
        if (t.id === 'a_graves') for (let i = 0; i < 14; i++) { const x = t.x + Math.cos(i * 2.4) * (6 + i), z = t.z + Math.sin(i * 2.4) * (6 + i); b.add(G.box(0.9, 1.5, 0.3), 0x8d8a96, { x, y: height(x, z) + 0.6, z, ry: i }); }
        o.mesh = b.mesh(); o.mesh.frustumCulled = false; o.col = []; scene.add(o.mesh);
      }
      for (const c of o.col) c.sky = !!t.sky;
      loaded.set(t.id, o); changed = true;
    } else if (on && d > t.r + 700) {
      const o = loaded.get(t.id); scene.remove(o.mesh); o.mesh.geometry.dispose(); for (const th of o.things) dropThing(th);
      loaded.delete(t.id); changed = true;
    }
  }
  if (changed) { const c = [{ x: REG.volcano.x, z: REG.volcano.z, r: 41 }]; for (const o of loaded.values()) c.push(...o.col); g.world.colliders = c; }
}

/* ---- the wilds: every 180 m square of the continent may hold something ---- */
const LOOT = [[1, 't_bezel'], [3, 'x_hook'], [6, 'g_mend'], [8, 't_lucky'], [10, 'g_ember'], [12, 'x_bellows'], [14, 't_spring'], [16, 'g_thief'], [18, 't_heart'], [20, 'x_bomb'], [22, 'g_frost'], [24, 't_pendulum'], [26, 'g_storm'], [28, 'x_watch'], [30, 'g_quake'], [33, 'g_gale']];
const cells = new Map(), deadCells = new Map();
function cellInfo(cx, cz, only) {
  const R = rng((cx * 928371) ^ (cz * 1237) ^ 99), r = R(), x = (cx + 0.15 + R() * 0.7) * CELL, z = (cz + 0.15 + R() * 0.7) * CELL;
  let type = r < 0.34 ? 'pack' : r < 0.46 ? 'chest' : r < 0.56 ? 'minute' : r < 0.68 ? 'herb' : r < 0.76 ? 'ore' : r < 0.8 ? 'rift' : r < 0.835 ? 'ruin' : null;
  if (!type || (only && type !== only) || Math.hypot(x, z) > 3300 || townAt(x, z, 26)) return null;
  const w = weights(x, z), y = height(x, z, w);
  if (y < WATER + 0.7 && w.id !== 'reef') return null;
  if (w.id === 'reef' && (type === 'herb' || type === 'ore')) type = 'pack';
  return { id: 'c' + cx + '_' + cz, type, x, z, reg: w.id, wet: w.id === 'reef', R };
}
function spawnCell(cx, cz) {
  const c = cellInfo(cx, cz), S = g.S, o = { things: [], foes: [] };
  cells.set(cx + ',' + cz, o);
  if (!c) return;
  const lvl = regionAt(c.x, c.z).lvl + Math.floor(c.R() * 3), R = c.R;
  if (c.type === 'pack') {
    if (deadCells.has(c.id)) return;
    const roster = ROSTER[c.reg], n = 1 + Math.floor(R() * 2.4);
    for (let i = 0; i < n; i++) { const f = makeFoe(roster[Math.floor(R() * roster.length)], lvl, c.x + (R() - 0.5) * 14, c.z + (R() - 0.5) * 14, { cell: c.id, wet: c.wet }); foes.push(f); o.foes.push(f); }
  } else if (c.type === 'chest') {
    if (S.cells[c.id]) return;
    const pool = LOOT.filter(([l, id]) => l <= lvl + 2 && !g.has(id)), gear = R() < 0.24 && pool.length ? pool[Math.floor(R() * pool.length)][1] : null, rar = gear ? ITEMS[gear].r + 1 : R() < 0.3 ? 1 : 0;
    const th = addThing({ type: 'chest', x: c.x, z: c.z, wet: c.wet, r: 3, label: 'Open chest', rot: R() * 6, make: () => E.chest(Math.min(4, rar)), use: async () => {
      S.cells[c.id] = 1; th.label = null; th.mesh.userData.lid.rotation.x = -1.9; g.sfx.chest();
      const coins = Math.round((20 + lvl * 12) * (1 + rar * 0.6)); g.addCoins(coins); g.ui.toast('+' + coins + ' coin', 1);
      if (gear && !g.has(gear)) g.give(gear, 1); else g.give(lvl > 24 ? 'tonic3' : lvl > 10 ? 'tonic2' : 'tonic', 1 + rar);
      if (R() < 0.3) g.give('draught', 1);
    } });
    o.things.push(th);
  } else if (c.type === 'minute') {
    if (S.minutes[c.id]) return;
    o.things.push(addThing({ type: 'minute', x: c.x, z: c.z, wet: c.wet, id: c.id, auto: 2, make: E.minute }));
  } else if (c.type === 'ruin') {
    if (S.cells[c.id] || Object.keys(S.pages).length >= PAGES.length) return;
    o.things.push(addThing({ type: 'page', x: c.x, z: c.z, id: c.id, auto: 2, make: () => { const m = E.page(); m.add(new Builder().add(G.cyl(0.5, 0.6, 3, 7), 0x8d8a9a, { x: 1.6, y: 1.5 }).add(G.cyl(0.5, 0.6, 1.6, 7), 0x8d8a9a, { x: -1.5, y: 0.8, z: 0.6 }).add(G.box(3.6, 0.5, 0.9), 0x77728a, { y: 0.25, z: -1.4 }).mesh()); return m; } }));
  } else if (c.type === 'herb' || c.type === 'ore') {
    const id = c.type === 'ore' ? (R() < 0.12 && lvl > 16 ? 'starmetal' : 'ore') : c.reg === 'jungle' ? 'duskcap' : c.reg === 'frost' || c.reg === 'crag' ? 'frostbloom' : R() < 0.8 ? 'sunpetal' : 'duskcap';
    for (let i = 0; i < (c.type === 'ore' ? 2 : 3); i++) o.things.push(addThing({ type: 'herb', x: c.x + (R() - 0.5) * 9, z: c.z + (R() - 0.5) * 9, id, auto: 1.8, t: 0, make: () => (c.type === 'ore' ? E.ore(id === 'starmetal' ? 0xfff0a0 : 0xc8a070) : E.herb(HERB_COLOR[id])) }));
  } else if (c.type === 'rift') {
    if (S.cells[c.id]) return;
    const th = addThing({ type: 'rift', x: c.x, z: c.z, r: 4, label: 'Enter the Time Rift (Lv ' + (lvl + 3) + ')', make: E.rift, use: async () => {
      const roster = ROSTER[c.reg], r1 = await g.duel(roster[0], lvl + 2, { safe: true }), r2 = r1 === 'win' ? await g.duel(roster[roster.length - 1], lvl + 3, { safe: true, elite: true }) : r1;
      if (r2 !== 'win') return g.ui.toast('The rift throws you out. It will keep.');
      S.cells[c.id] = 1; S.sp++; g.addCoins(80 + lvl * 20); g.sfx.level(); g.ui.region('Rift closed', '+1 skill point'); dropThing(th);
    } });
    o.things.push(th);
  }
}
function streamCells() {
  const p = g.player, cx = Math.floor(p.x / CELL), cz = Math.floor(p.z / CELL);
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (!cells.has((cx + dx) + ',' + (cz + dz))) spawnCell(cx + dx, cz + dz);
  for (const [k, o] of cells) {
    const [x, z] = k.split(',').map(Number);
    if (Math.abs(x - cx) > 3 || Math.abs(z - cz) > 3) { if (o.foes.some(f => f.state === 'fight')) continue; for (const t of o.things) dropThing(t); for (const f of o.foes) removeFoe(f); cells.delete(k); }
  }
  for (const [id, t] of deadCells) if (time > t) deadCells.delete(id);
}

/* ---- enemies ---- */
function makeFoe(kind, lvl, x, z, extra) {
  const def = KINDS[kind], s = foeStats(kind, lvl);
  return Object.assign({ kind, def, lvl, x, z, hx: x, hz: z, hp: s.hp, maxHp: s.hp, atk: s.atk, tempo: s.tempo, xp: s.xp, coins: s.coins, state: 'idle', model: null, cool: 0, wt: 0, tx: x, tz: z, rot: 0, dieT: 0, swing: 0, hitT: 0 }, extra);
}
function foeModel(e) { if (!e.model) { e.model = E.enemyModel(e.kind); e.base = e.model.scale.x; scene.add(e.model); } return e.model; }
function removeFoe(e) { if (e.model) scene.remove(e.model); e.model = null; const i = foes.indexOf(e); if (i >= 0) foes.splice(i, 1); }
const foeY = e => (e.sky ? ISLES[0].y : e.wet ? height(e.x, e.z) : Math.max(height(e.x, e.z), WATER - 0.3));

let fight = null, duelDone = null;
function startCombat(e) {
  if (g.combat.active || (g.busy && !e.special)) return;
  const p = g.player, list = [e];
  if (!e.def.boss && !e.special) for (const f of foes) if (f !== e && f.state !== 'dead' && !f.def.still && !f.special && list.length < 3 && dist(f.x, f.z, e.x, e.z) < 10) list.push(f);
  const big = e.base > 1.6 ? 6 : 4.2, a0 = Math.atan2(e.x - p.x, e.z - p.z), camD = Math.max(9.5, 8.8 / (W / H)) + (e.base > 1.6 ? 3 : 0), near = sky() ? [] : g.world.blockers(p.x, p.z, camD + 12);
  let dx = 0, dz = 0, bestScore = 1e9;
  for (let i = 0; i < 12; i++) {
    const a = a0 + (i % 2 ? -1 : 1) * Math.ceil(i / 2) * (TAU / 12), cx = Math.sin(a), cz = Math.cos(a), mx = p.x + cx * 2.1, mz = p.z + cz * 2.1, kx = mx - cz * camD, kz = mz + cx * camD;
    if (sky() ? skyGround(p.x + cx * big, p.z + cz * big) === null : (!p.under && height(p.x + cx * big, p.z + cz * big) < WATER + 0.3)) continue;
    let score = i * 0.2 + (sky() ? 0 : Math.max(0, height(kx, kz) - p.y - 3) * 2);
    for (const b of near) { const t = clamp(((b.x - kx) * (mx - kx) + (b.z - kz) * (mz - kz)) / (camD * camD), 0, 1.15); if (Math.hypot(b.x - (kx + (mx - kx) * t), b.z - (kz + (mz - kz) * t)) < 2.4 + t * 2.6) score += 3; }
    if (score < bestScore) { bestScore = score; dx = cx; dz = cz; }
  }
  if (bestScore > 1e8) { dx = Math.sin(a0); dz = Math.cos(a0); }
  const mx = p.x + dx * 2.1, mz = p.z + dz * 2.1, kx = mx - dz * camD, kz = mz + dx * camD;
  g.world.hideScenery(b => { if (dist(b.x, b.z, mx, mz) > camD + 14) return false; const t = clamp(((b.x - kx) * (mx - kx) + (b.z - kz) * (mz - kz)) / (camD * camD), -0.1, 1.5); return Math.hypot(b.x - (kx + (mx - kx) * t), b.z - (kz + (mz - kz) * t)) < 3 + Math.max(0, t) * 4.5; });
  list.forEach((f, i) => { const side = i === 0 ? 0 : i === 1 ? 1 : -1; f.state = 'fight'; f.fx = p.x + dx * (big + Math.abs(side) * 1.6) - dz * side * 2.3; f.fz = p.z + dz * (big + Math.abs(side) * 1.6) + dx * side * 2.3; foeModel(f).visible = true; });
  fight = { foes: list, dx, dz, camD };
  p.rot = Math.atan2(dx, dz); p.moving = false; stick.on = false; $('stick').style.display = 'none';
  g.combat.start(list);
  if (e.def.boss) g.sfx.roar();
}
/* A staged fight that comes back with its result: arena, rifts, trials, the last duel. */
function duel(kind, lvl, opts = {}) {
  const p = g.player, x = p.x + Math.sin(p.rot) * 5, z = p.z + Math.cos(p.rot) * 5;
  const e = makeFoe(kind, lvl, x, z, { special: true, opts, sky: sky(), wet: p.under });
  if (opts.elite) { e.hp = e.maxHp = Math.round(e.hp * 1.8); e.xp *= 2; e.coins *= 2; }
  foes.push(e); foeModel(e).position.set(x, p.y, z);
  return new Promise(done => { duelDone = done; startCombat(e); });
}
function endCombat(result, t) {
  const S = g.S, list = fight.foes, first = list[0], opts = first.opts || {}; fight = null; g.lastFightTime = t;
  g.world.showScenery();
  if (result === 'win') {
    let xp = 0, coins = 0;
    const scav = 1 + 0.25 * (S.skills.scav || 0);
    for (const e of list) {
      e.state = 'dead'; e.dieT = Math.min(e.dieT || 1, 1);
      if (opts.noXp) continue;
      xp += e.xp; coins += Math.round(e.coins * (0.7 + Math.random() * 0.6) * g.stats().coinMul);
      S.kills[e.kind] = (S.kills[e.kind] || 0) + 1;
      if (e.id || e.kind === 'oren') S.flags['killed_' + (e.id || e.kind)] = 1;
      if (e.cell) deadCells.set(e.cell, time + 260);
      for (const [id, ch] of e.def.drops || []) if (Math.random() < ch * (ITEMS[id].type === 'mat' ? scav : 1) && !(ITEMS[id].type !== 'mat' && ITEMS[id].type !== 'use' && g.has(id))) g.give(id, 1);
      if (e.boss && e.boss.cog) g.give('cog_' + e.boss.cog, 1);
    }
    if (!opts.noXp) { g.addCoins(coins); g.ui.toast(`+${xp} xp${coins ? ' · +' + coins + ' coin' : ''}`); g.addXp(xp); }
    g.sfx.win(); if (S.hp < 1) S.hp = 1;
    checkQuests();
    if (first.boss && first.boss.cog) run(() => cogScene(g, first));
    else if (first.kind === 'scarecrow') run(() => g.ui.say('', 'The scarecrow folds up like washing. The ring in your hand is warm. Whatever the Stilled are, the Pivot can finish them.'));
  } else if (result === 'lose') {
    for (const e of list) { if (!e.special) { e.state = 'idle'; e.hp = e.maxHp; e.cool = 6; e.x = e.hx; e.z = e.hz; } }
    if (opts.safe) { S.hp = Math.round(g.stats().maxHp * 0.4); g.focus = 0; }
    else run(async () => {
      await g.ui.fade(true);
      const lost = Math.floor(S.coins * 0.1); S.coins -= lost; S.hp = g.stats().maxHp; g.focus = 0;
      const t2 = TOWN[S.home] || TOWN.dawnmere; S.layer = t2.sky ? 'sky' : 'ground';
      const [x, z] = polar(t2, 45, plazaR(t2) - 11); placePlayer(x, z);
      await g.ui.fade(false);
      await g.ui.say('', `The moment lets you go. You wake beside the waystone${lost ? ', ' + lost + ' coin lighter' : ''}.`);
    });
  } else { for (const e of list) if (!e.special) { e.state = 'idle'; e.cool = 9; } g.ui.toast('You slip away.'); }
  for (const e of list) if (e.special && (result !== 'win')) removeFoe(e);
  if (first.special && duelDone) { const d = duelDone; duelDone = null; setTimeout(() => { for (const e of list) if (e.special) removeFoe(e); d(result); }, result === 'win' ? 900 : 50); }
  g.save();
}

/* ---- input ---- */
const keys = {}, stick = { on: false, id: null, ox: 0, oy: 0, x: 0, y: 0 }, look = new Map();
let camYaw = 0, camPitch = 0.42, camDist = 13, lastLook = -9, pinch = 0, camSnap = true;
function tapAction() {
  if (cine) { if (cine.t > 0.8) cine.t = cine.dur; }
  else if (g.ui.dialogOpen) g.ui.advance();
  else if (g.combat.active) g.combat.tap();
}
addEventListener('keydown', e => {
  g.sfx.init();
  if (e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  if (k === 'tab') e.preventDefault();
  if (e.repeat) return;
  keys[k] = true;
  if (!started || g.ui.crawlOpen) { if (g.ui.crawlNext && (k === ' ' || k === 'enter')) g.ui.crawlNext(); return; }
  if (k === ' ' || k === 'enter') { e.preventDefault(); tapAction(); }
  else if (k === 'e') { if (g.ui.dialogOpen) g.ui.advance(); else g.interact(); }
  else if (k === 'f') g.combat.flow();
  else if (k === 'q') g.combat.potion();
  else if (k === 'g' || k === 'r') g.combat.gadget();
  else if (k >= '1' && k <= '9') g.ui.key(+k - 1);
  else if (k === 'tab' || k === 'escape' || k === 'i') { if (g.ui.menuOpen) g.ui.closeMenu(); else if (!g.ui.blocking && !g.combat.active && !cine) g.ui.openMenu(); }
  else if (k === 'm') { if (g.ui.menuOpen) g.ui.closeMenu(); else if (!g.ui.blocking && !g.combat.active && !cine) g.ui.openMenu('Map'); }
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
glCanvas.addEventListener('pointerdown', e => {
  g.sfx.init();
  if (e.pointerType === 'touch') g.touch = true;
  if (!started) return;
  if (cine || g.ui.dialogOpen || g.combat.active) { tapAction(); return; }
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
    if (look.size >= 2) { const o = [...look.entries()].find(([id]) => id !== e.pointerId)[1], d = Math.hypot(e.clientX - o.x, e.clientY - o.y); if (pinch) camDist = clamp(camDist * pinch / d, 6, 30); pinch = d; }
    else { camYaw -= (e.clientX - l.x) * 0.0055; camPitch = clamp(camPitch + (e.clientY - l.y) * 0.004, 0.08, 1.25); lastLook = time; }
    l.x = e.clientX; l.y = e.clientY;
  }
});
const pointerEnd = e => { if (stick.on && e.pointerId === stick.id) { stick.on = false; stick.x = stick.y = 0; $('stick').style.display = 'none'; } look.delete(e.pointerId); pinch = 0; };
glCanvas.addEventListener('pointerup', pointerEnd); glCanvas.addEventListener('pointercancel', pointerEnd);
glCanvas.addEventListener('wheel', e => { camDist = clamp(camDist * (e.deltaY > 0 ? 1.1 : 0.9), 6, 30); e.preventDefault(); }, { passive: false });
addEventListener('contextmenu', e => e.preventDefault());

/* ---- per-frame updates ---- */
let stepT = 0;
function updatePlayer(dt) {
  const p = g.player;
  let ix = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0) + stick.x;
  let iy = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0) - stick.y;
  const mag = Math.hypot(ix, iy);
  p.moving = mag > 0.15;
  if (p.moving) {
    const k = Math.min(1, mag) / mag; ix *= k; iy *= k;
    const fxx = -Math.sin(camYaw), fzz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    const mx = fxx * iy + rx * ix, mz = fzz * iy + rz * ix, speed = (p.swim ? 5.5 : p.under ? 8.5 : 10.5) * (g.has('r_boots') && !p.swim ? 1.45 : 1);
    let nx = p.x + mx * speed * dt, nz = p.z + mz * speed * dt;
    for (const c of g.world.colliders) { if (!!c.sky !== sky()) continue; const d = dist(nx, nz, c.x, c.z), r = c.r + 0.5; if (d < r && d > 0.001) { nx = c.x + (nx - c.x) / d * r; nz = c.z + (nz - c.z) / d * r; } }
    const rad = Math.hypot(nx, nz); if (rad > EDGE) { nx *= EDGE / rad; nz *= EDGE / rad; }
    if (!sky() || skyGround(nx, nz) !== null) { p.x = nx; p.z = nz; }
    p.rot += angDiff(Math.atan2(mx, mz), p.rot) * Math.min(1, dt * 12);
    if (time - lastLook > 1.2) { const d = angDiff(p.rot + Math.PI, camYaw); camYaw += d * (1 + Math.cos(d)) * 0.5 * Math.min(1, dt * 1.6); }
    if ((stepT -= dt) <= 0) { stepT = 0.3; g.sfx.step(p.swim || p.under); }
  }
  const gh = groundY(p.x, p.z), tide = g.has('r_tide') > 0;
  p.swim = !sky() && !tide && gh < WATER - 0.75;
  p.under = !sky() && tide && gh < WATER - 2.2;
  const ty = p.swim ? WATER - 1.05 : gh;
  p.y = camSnap ? ty : lerp(p.y, ty, Math.min(1, dt * 14));
}
function updateFoes(dt) {
  const p = g.player, inFight = g.combat.active, calm = g.ui.blocking || g.busy || !!cine, safe = !!townAt(p.x, p.z, 10) && !sky();
  for (const e of [...foes]) {
    if (e.boss && e.boss.need && !g.flag(e.boss.need)) { if (e.model) e.model.visible = false; continue; }
    if (e.state === 'dead') { if (e.dieT > 0 && e.model) { e.dieT = Math.max(0, e.dieT - dt * 1.6); e.model.scale.setScalar(e.base * e.dieT); e.model.rotation.y += dt * 6; if (e.dieT === 0) e.model.visible = false; } continue; }
    const d = dist(p.x, p.z, e.x, e.z);
    if (d > 150) { if (e.model) e.model.visible = false; continue; }
    const m = foeModel(e); m.visible = true;
    if (e.state === 'fight') {
      e.x = lerp(e.x, e.fx, Math.min(1, dt * 6)); e.z = lerp(e.z, e.fz, Math.min(1, dt * 6)); e.rot = Math.atan2(p.x - e.x, p.z - e.z);
      const wind = g.combat.zones.some(z => z.foe === e) ? 0.28 : 0, lunge = Math.sin(e.swing * Math.PI) * 1.5 - e.hitT * 0.4;
      m.position.set(e.x - fight.dx * lunge, sky() || e.special ? p.y : foeY(e), e.z - fight.dz * lunge); m.rotation.y = e.rot;
      E.animate(m, time, false, Math.max(wind, e.swing));
      if (e.hp <= 0) { e.dieT = Math.max(0.01, (e.dieT || 1) - dt * 1.6); m.scale.setScalar(e.base * e.dieT); }
      continue;
    }
    let moving = false;
    if (!(inFight || calm) && !!e.sky === sky()) {
      e.cool = Math.max(0, e.cool - dt);
      const step = (tx, tz, sp) => {
        const dx = tx - e.x, dz = tz - e.z, l = Math.hypot(dx, dz); if (l < 0.4) return;
        const nx = e.x + dx / l * sp * dt, nz = e.z + dz / l * sp * dt;
        e.rot += angDiff(Math.atan2(dx, dz), e.rot) * Math.min(1, dt * 8);
        if ((e.wet || height(nx, nz) > WATER + 0.3) && !townAt(nx, nz, 4)) { e.x = nx; e.z = nz; moving = true; }
      };
      if (e.def.still) {
        if (d < 30) e.rot += angDiff(Math.atan2(p.x - e.x, p.z - e.z), e.rot) * Math.min(1, dt * 3);
        if (d < (e.def.boss ? 9 : 4.6) && !e.cool) { startCombat(e); continue; }
      } else if (e.state === 'chase') {
        if (d > 27 || dist(e.x, e.z, e.hx, e.hz) > 38 || safe) { e.state = 'idle'; e.cool = 3; }
        else if (d < 2.4) { startCombat(e); continue; }
        else step(p.x, p.z, 6.4);
      } else {
        if (d < 13 && !e.cool && !safe && !p.swim) e.state = 'chase';
        else { if ((e.wt -= dt) <= 0) { e.wt = 3 + Math.random() * 5; e.tx = e.hx + (Math.random() * 2 - 1) * 9; e.tz = e.hz + (Math.random() * 2 - 1) * 9; } step(e.tx, e.tz, 1.6); }
      }
    }
    m.position.set(e.x, foeY(e), e.z); m.rotation.y = e.rot;
    E.animate(m, time + e.hx, moving, 0);
  }
}
function updateThings(dt) {
  const p = g.player, S = g.S; let best = null, bd = 99;
  const free = !(g.combat.active || g.busy || g.ui.blocking || cine);
  for (const t of things) {
    if (t.gone) continue;
    const d = dist(p.x, p.z, t.x, t.z);
    if (t.type === 'herb' && t.t > 0) { t.t -= dt; continue; }
    if (d > 190) { if (t.mesh && d > 240) hideThing(t); continue; }
    showThing(t);
    const m = t.mesh, u = m.userData;
    if (u.spin) for (const s of u.spin) s.rotation.y += dt * 2;
    if (u.spinZ) u.spinZ.rotation.z += dt * 1.5;
    if (u.spinY) { u.spinY.rotation.z += dt * 2; u.spinY.position.y = 1 + Math.sin(time * 2) * 0.5; }
    if (t.type === 'minute') m.position.y = t.y + Math.sin(time * 2 + t.x) * 0.2;
    if (t.type === 'amb') {
      if (d < 7 && free) m.rotation.y += angDiff(Math.atan2(p.x - t.x, p.z - t.z), m.rotation.y) * Math.min(1, dt * 4);
      else {
        if ((t.wt -= dt) <= 0) { t.wt = 4 + Math.random() * 8; t.tx = t.hx + (Math.random() * 2 - 1) * 12; t.tz = t.hz + (Math.random() * 2 - 1) * 12; t.walk = Math.random() < 0.7; }
        const dx = t.tx - t.x, dz = t.tz - t.z, l = Math.hypot(dx, dz);
        if (t.walk && l > 0.6) { t.x += dx / l * 1.5 * dt; t.z += dz / l * 1.5 * dt; m.rotation.y += angDiff(Math.atan2(dx, dz), m.rotation.y) * Math.min(1, dt * 5); m.position.set(t.x, t.y, t.z); E.animate(m, time * 0.6 + t.hx, true); } else E.animate(m, time, false);
      }
    }
    if (t.type === 'npc' && d < 9 && free) m.rotation.y += angDiff(Math.atan2(p.x - t.x, p.z - t.z), m.rotation.y) * Math.min(1, dt * 4);
    if (t.type === 'way' && S.way[t.id]) { const a = time * 1.4; u.dot.position.set(Math.cos(a) * 1.15, 3.2 + Math.sin(a) * 1.15, 0); }
    if (t.swing > 0) { t.swing = Math.max(0, t.swing - dt * 0.4); if (u.bell) u.bell.rotation.z = Math.sin(time * 9) * 0.5 * t.swing; }
    if (!free || !!t.sky !== sky()) continue;
    if (t.auto && d < t.auto) {
      if (t.type === 'minute') { S.minutes[t.id] = 1; t.gone = true; hideThing(t); const n = Object.keys(S.minutes).length; g.sfx.minute(); g.ui.region('A Lost Minute', n + ' of ' + g.minuteTotal); g.addXp(12 + S.level * 2); checkQuests(); }
      else if (t.type === 'page') { const i = Object.keys(S.pages).length; S.pages[i] = 1; S.cells[t.id] = 1; t.gone = true; hideThing(t); g.sfx.pickup(); g.startQuest('pages'); run(async () => { await g.ui.say("Oren's journal", PAGES[i]); g.addXp(30 + S.level * 4); }); }
      else if (t.type === 'herb') { t.t = 240; hideThing(t); g.give(t.id, 1); }
      continue;
    }
    if (t.label && d < t.r && d < bd) { best = t; bd = d; }
  }
  g.nearest = best;
}
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
function updateCamera(dt) {
  const p = g.player;
  if (cine) {
    cine.t += dt; const k = clamp(cine.t / cine.dur, 0, 1);
    if (cine.kind === 'orbit') { const a = camYaw + k * 1.6; tmpB.set(cine.x, cine.y + cine.h * 0.35, cine.z); tmpA.set(cine.x + Math.sin(a) * cine.r, cine.y + cine.h, cine.z + Math.cos(a) * cine.r); }
    else { if (!cine.p0) { cine.p0 = cine.from ? new THREE.Vector3(...cine.from) : camPos.clone().setY(camPos.y + 4); cine.l0 = camLook.clone(); } tmpA.copy(cine.p0); tmpB.copy(cine.l0).lerp(v3.set(...cine.at), k * k * (3 - 2 * k)); }
    camPos.copy(tmpA); camLook.copy(tmpB); camera.position.copy(camPos); camera.lookAt(camLook);
    if (cine.t >= cine.dur) cine.done();
    return;
  }
  if (fight) {
    const d = fight.camD, reach = fight.foes[0].base > 1.6 ? 3 : 2.1;
    tmpB.set(p.x + fight.dx * reach, p.y + 1.7 + (fight.foes[0].base > 1.6 ? 1 : 0), p.z + fight.dz * reach);
    tmpA.set(tmpB.x - fight.dz * d, tmpB.y + 1.2 + d * 0.1, tmpB.z + fight.dx * d);
  } else {
    const c = Math.cos(camPitch) * camDist;
    tmpB.set(p.x, p.y + 1.9, p.z);
    tmpA.set(p.x + Math.sin(camYaw) * c, p.y + 1.9 + Math.sin(camPitch) * camDist, p.z + Math.cos(camYaw) * c);
    if (!sky()) for (let i = 1; i <= 5; i++) {
      const t = i / 5, x = lerp(tmpB.x, tmpA.x, t), z = lerp(tmpB.z, tmpA.z, t), y = lerp(tmpB.y, tmpA.y, t);
      if (height(x, z) + 0.5 > y) { tmpA.lerpVectors(tmpB, tmpA, Math.max(0.22, t - 0.2)); tmpA.y += 1.5; break; }
    }
    /* Keep the camera out of buildings. */
    for (let i = 2; i <= 6; i++) {
      const t = i / 6, x = lerp(tmpB.x, tmpA.x, t), z = lerp(tmpB.z, tmpA.z, t);
      if (g.world.colliders.some(c => c.r > 3 && !!c.sky === sky() && dist(x, z, c.x, c.z) < c.r - 0.3)) { tmpA.lerpVectors(tmpB, tmpA, Math.max(0.25, t - 0.22)); tmpA.y += 2.2; break; }
    }
  }
  if (!sky()) tmpA.y = Math.max(tmpA.y, height(tmpA.x, tmpA.z) + 1.2, p.under ? -999 : WATER + 0.8);
  if (p.under) tmpA.y = Math.min(tmpA.y, WATER - 1.5);
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
  m.rotation.x = p.swim ? 0.9 : 0;
}

/* Minimap picture of the land around the player, redrawn only when they have moved a fair way. */
const mini = document.createElement('canvas'); mini.width = mini.height = 44;
const mctx = mini.getContext('2d'), mimg = mctx.createImageData(44, 44), mc = new THREE.Color();
g.mini = { canvas: mini, x: 1e9, z: 1e9, span: 396 };
function drawMiniTex() {
  const p = g.player, M = g.mini; M.x = p.x; M.z = p.z;
  for (let j = 0; j < 44; j++) for (let i = 0; i < 44; i++) {
    const x = p.x + (i - 21.5) * 9, z = p.z + (j - 21.5) * 9, w = weights(x, z), h = height(x, z, w), k = (j * 44 + i) * 4;
    if (h < WATER && w.id !== 'reef') mc.set(0x3f8fb0); else { groundColor(x, z, h, 0.2, w, mc); if (h < WATER) mc.lerp(new THREE.Color(0x3f8fb0), 0.45); }
    mc.convertLinearToSRGB(); mimg.data[k] = mc.r * 255; mimg.data[k + 1] = mc.g * 255; mimg.data[k + 2] = mc.b * 255; mimg.data[k + 3] = 255;
  }
  mctx.putImageData(mimg, 0, 0);
}

let beacon, lastRegion = '', questT = 0, saveT = 0, streamT = 9;
function frame(now) { requestAnimationFrame(frame); tick(now); }
function tick(now) {
  const dt = clamp((now - last) / 1000 || 0.016, 0.001, 0.05); last = now;
  if (!started) return;
  time += dt;
  const ui = g.ui, p = g.player, paused = ui.blocking && !ui.dialogOpen;
  if (!paused) {
    if (!g.combat.active && !ui.blocking && !g.busy && !cine) updatePlayer(dt); else p.moving = false;
    if ((streamT += dt) > 0.4) { streamT = 0; streamTowns(); streamCells(); if (dist(p.x, p.z, g.mini.x, g.mini.z) > 60) drawMiniTex(); }
    updateFoes(dt); updateThings(dt); g.combat.update(dt);
    if ((questT += dt) > 0.5) {
      questT = 0; checkQuests();
      const tn = sky() ? TOWN.aerie : townAt(p.x, p.z), r = tn && tn.size > 0 ? tn.name : tn ? tn.name : regionAt(p.x, p.z).name;
      if (r !== lastRegion) {
        lastRegion = r;
        if (!g.combat.active && !ui.blocking && !cine && !g.busy) {
          if (tn && tn.size >= 2 && !g.S.seen[tn.id]) { g.S.seen[tn.id] = 1; if (!tn.sky && tn.reg !== 'reef') run(() => g.cine.orbit(tn.x, tn.z, tn.r * 0.9 + 40, tn.size === 3 ? 90 : 46, 5.5, tn.name)); else ui.region(tn.name); g.sfx.quest(); }
          else ui.region(r, tn ? '' : 'Danger level ' + regionAt(p.x, p.z).lvl);
        }
        g.sfx.setRegion(sky() ? 'heath' : regionAt(p.x, p.z).id);
      }
    }
    if ((saveT += dt) > 20) { saveT = 0; if (!g.busy) g.save(); }
    if (!g.combat.active) g.focus = Math.max(0, g.focus - dt * 0.4);
  }
  updatePlayerModel(dt); updateCamera(dt);
  const t = g.combat.active || cine ? null : g.target();
  beacon.visible = !!t && dist(p.x, p.z, t ? t[0] : 0, t ? t[1] : 0) > 7;
  if (t) { beacon.position.set(t[0], Math.max(height(t[0], t[1]), WATER) + (sky() && skyGround(t[0], t[1]) !== null ? 230 : 0), t[1]); beacon.children[0].position.y = 4.2 + Math.sin(time * 3) * 0.3; }
  g.world.update(dt, time, camera, p.x, p.z, camera.position.y < WATER - 0.3);
  renderer.clear(); renderer.render(g.world.far, camera); renderer.clearDepth(); renderer.render(scene, camera);
  ui.hud(!!cine);
  fxc.clearRect(0, 0, W, H);
  if (g.combat.active) g.combat.draw(fxc);
}

function resize() {
  W = innerWidth; H = innerHeight;
  renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  fx.width = W * dpr; fx.height = H * dpr; fxc.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.combat.layout(W, H);
}

/* ---- boot ---- */
async function boot() {
  g.combat = new Combat(g); g.ui = new UI(g);
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { saved = null; }
  g.world = buildWorld(scene);
  for (let cx = -20; cx < 20; cx++) for (let cz = -20; cz < 20; cz++) if (cellInfo(cx, cz, 'minute')) g.minuteTotal++;
  beacon = new THREE.Group(); beacon.add(E.marker());
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 400, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd58a, transparent: true, opacity: 0.25, depthWrite: false, fog: false })); beam.position.y = 205; beacon.add(beam);
  beacon.children[0].scale.setScalar(2.4); scene.add(beacon);
  resize(); addEventListener('resize', resize); addEventListener('orientationchange', () => setTimeout(resize, 200));
  document.addEventListener('visibilitychange', () => { if (document.hidden) g.save(); });
  addEventListener('pagehide', () => g.save());

  const begin = async isNew => {
    g.sfx.init();
    g.S = isNew || !saved ? fresh() : Object.assign(fresh(), saved);
    g.sfx.setMute(g.S.mute);
    g.rebuildPlayer(); buildStatic();
    const p = g.player; p.rot = g.S.rot; placePlayer(g.S.x, g.S.z); camYaw = p.rot + Math.PI;
    g.world.setPhase(phase(), true);
    $('title').classList.add('hidden'); g.ui.titleOpen = false;
    started = true; streamTowns(); streamCells(); drawMiniTex();
    if (!g.S.quests.main) {
      camYaw = 0.5; camDist = 7; camPitch = 0.2;
      await g.ui.lookEditor(true);
      camDist = 13; camPitch = 0.42; camYaw = p.rot + Math.PI;
      await g.ui.crawl(INTRO);
      $('hud').classList.remove('hidden');
      await g.cine.look([START[0] - 30, 60, START[1] + 60], [0, 900, 0], 6, 'The Great Dial');
      g.S.quests.main = { step: 0, k0: {} };
    }
    $('hud').classList.remove('hidden');
    lastRegion = ''; checkQuests(); g.save();
  };
  $('loading').textContent = '';
  const has = saved && saved.quests && saved.quests.main;
  if (has) { $('btnContinue').classList.remove('hidden'); $('btnContinue').onclick = () => begin(false); }
  const bn = $('btnNew');
  bn.onclick = () => { if (has && !bn.dataset.sure) { bn.dataset.sure = 1; bn.textContent = 'Erase save and start over?'; } else begin(true); };
  window.HF = g; g._tick = tick; g._foes = foes; g._things = things; g._place = placePlayer;
  requestAnimationFrame(frame);
}
setTimeout(boot, 30);
