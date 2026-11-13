/* People, creatures and world objects, assembled from the Blender models in models/assets.glb.
   Every model faces +z. Moving parts are separate groups that animate() swings. */
import * as THREE from './vendor/three.module.min.js';
import { TAU } from './util.js';
import { Builder, G, VC, glow } from './gfx.js';
import { A, instance, geometry } from './assets.js';

export const SKINS = [0xffe0cc, 0xf6d2b8, 0xe8b48e, 0xc98a5e, 0x9a6442, 0x6e4530];
export const HAIRS = [0x2a211c, 0x5a3a24, 0x9a5a2a, 0xd9a04a, 0xe6e0d0, 0xb0b4c0, 0xc8443a, 0x4a6ad0, 0x8a4ab8, 0x3fa890];
export const DYES = [0x2f8f86, 0x3d5fb0, 0x8a3a55, 0xc8443a, 0xe0a030, 0x4f9a4a, 0x7a4ab0, 0xf2ead8, 0x3a3a48, 0xe07a9a];
export const HAIR_STYLES = ['Bald', 'Short', 'Spiky', 'Long', 'Bun', 'Tail', 'Crest', 'Bob'];
export const BODIES = ['Lean', 'Broad', 'Small'];
const EYE = 0x8ff6ff, DARK = 0x1c1a2a;
const HIDES_HAIR = { hood: 1, fur: 1, helm: 1, horns: 1, mask: 0 };
const darker = (c, k = 0.6) => { const x = new THREE.Color(c).multiplyScalar(k); return x.getHex(); };

/* o: skin top bot hair hairStyle hat hatColor cape outfit trim boots eyes acc[] body scale ring */
export function person(o = {}) {
  const g = new THREE.Group(), broad = o.body === 1, small = o.body === 2, outfit = o.outfit || 'tunic';
  const pal = { SKIN: o.skin ?? SKINS[2], TOP: o.top ?? DYES[0], BOT: o.bot ?? 0x3a3344, TRIM: o.trim ?? darker(o.top ?? DYES[0], 0.55), HAIR: o.hair ?? HAIRS[1], HAT: o.hatColor ?? 0xd9b45a,
    CAPE: o.cape ?? 0x8a3a55, BOOT: o.boots ?? 0x4a3628, METAL: 0xb8bcc8 };
  const b = new Builder(), wide = broad ? 1.15 : 1;
  b.addAsset(A['K.torso_' + outfit] || A['K.torso_tunic'], pal, { sx: wide, sz: broad ? 1.08 : 1 });
  const hs = o.hairStyle ?? 1;
  if (hs > 0 && !HIDES_HAIR[o.hat]) b.addAsset(A['K.hair' + hs], pal);
  if (o.hat) b.addAsset(A['K.hat_' + o.hat], pal);
  if (o.cape !== undefined) b.addAsset(A['K.acc_cape'], pal, { sx: wide });
  for (const a of o.acc || []) b.addAsset(A['K.acc_' + a], pal, { sx: a === 'halo' ? 1 : wide });
  if (o.eyes && o.eyes !== DARK) for (const s of [-1, 1]) b.add(G.sph(0.07, 10, 8), o.eyes, { x: s * 0.125, y: 1.79, z: 0.31, sz: 0.5 });
  g.add(b.mesh());
  const limbs = A['K.limbs'], armPal = outfit === 'bare' ? Object.assign({}, pal, { TOP: pal.SKIN, TRIM: pal.BOT }) : pal;
  const part = (name, p) => { const q = limbs.by[name], grp = new THREE.Group(); grp.position.fromArray(q.pos); if (broad && name.startsWith('arm')) grp.position.x *= 1.15; grp.add(new THREE.Mesh(geometry(q, p), VC)); g.add(grp); return grp; };
  const arms = [part('arm0', armPal), part('arm1', armPal)], legs = [part('leg0', pal), part('leg1', pal)];
  arms[0].rotation.z = -0.1; arms[1].rotation.z = 0.1;
  if (o.ring) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 6, 18), glow(0x7fe6d6)); r.position.set(0, -0.58, 0.12); arms[1].add(r); g.userData.ring = r; }
  g.userData.legs = legs; g.userData.arms = arms;
  g.scale.setScalar((o.scale ?? 1) * (small ? 0.88 : 1));
  return g;
}

/* How each people of Meridian dresses. R is a seeded random function, so every villager is the same each visit. */
const pick = (R, a) => a[Math.floor(R() * a.length)];
export function culture(style, R) {
  const o = { skin: pick(R, SKINS), hair: pick(R, HAIRS.slice(0, 6)), hairStyle: 1 + Math.floor(R() * 7), body: Math.floor(R() * 3), acc: [] };
  const maybe = (p, v) => (R() < p ? v : undefined);
  switch (style) {
    case 'vale': o.top = pick(R, [0x6f9a4a, 0x9a7a4a, 0xd9c7a0, 0xb0683a, 0x4f7a6a]); o.bot = pick(R, [0x5a4030, 0x4a4a3a]); o.hat = maybe(0.45, 'straw'); o.hatColor = 0xe0c070; if (R() < 0.4) o.acc.push('apron'); if (R() < 0.3) o.outfit = 'dress'; break;
    case 'crown': o.top = pick(R, [0x3d5fb0, 0x8a3a55, 0x7a4ab0, 0x2f8f86, 0xc8443a]); o.bot = 0x2e2a3a; o.hat = maybe(0.3, 'cap'); o.hatColor = pick(R, [0x3d5fb0, 0x8a3a55, 0xd9b45a]); o.cape = maybe(0.35, pick(R, [0xd9b45a, 0x3a3a48, 0x8a3a55])); if (R() < 0.3) o.outfit = 'dress'; o.trim = 0xd9b45a; break;
    case 'coast': o.skin = pick(R, SKINS.slice(2, 5)); o.outfit = R() < 0.55 ? 'bare' : undefined; o.top = pick(R, [0xff7a5a, 0x3fc0c0, 0xffd24a, 0xff8ab0, 0x5ad07a]); o.bot = o.top; o.hat = maybe(0.4, pick(R, ['bandana', 'straw'])); o.hatColor = pick(R, [0xff5a5a, 0xffffff, 0x3fc0c0]); o.hair = pick(R, [0xd9a04a, 0xe6e0d0, 0x5a3a24, 0x3fa890]); o.boots = o.skin; break;
    case 'jungle': o.skin = pick(R, SKINS.slice(2, 6)); o.outfit = R() < 0.5 ? 'bare' : undefined; o.top = pick(R, [0x3f9a4a, 0x8a5a2a, 0xe07a2a]); o.bot = 0x5a4030; o.hat = maybe(0.6, 'feather'); o.hatColor = pick(R, [0xffd24a, 0x4a8af0, 0xe050a0]); o.acc.push('leaf'); o.boots = o.skin; break;
    case 'desert': o.outfit = 'robe'; o.top = pick(R, [0xf2ead8, 0xe0c890, 0x3fa8a0, 0xc86a4a, 0x6a5ab0]); o.hat = maybe(0.75, 'turban'); o.hatColor = pick(R, [0xffffff, 0xc8443a, 0x3fa8a0, 0xe0a030]); o.acc.push('scarf'); o.skin = pick(R, SKINS.slice(2, 6)); break;
    case 'crag': o.top = pick(R, [0x6a6a7a, 0x7a5a44, 0x4a5a4a]); o.bot = 0x3a3028; o.hat = pick(R, ['horns', 'hood', undefined]); o.hatColor = 0x5a5a66; o.acc.push('pads'); o.body = R() < 0.6 ? 1 : o.body; o.cape = maybe(0.4, 0x5a4a3a); break;
    case 'frost': o.top = pick(R, [0xdfe6f0, 0x8aa0c0, 0xb08a6a]); o.bot = 0x6a5a4a; o.hat = 'fur'; o.hatColor = pick(R, [0xb08a6a, 0x8a6a4a, 0xd0d6e0]); o.acc.push('collar'); o.body = R() < 0.5 ? 1 : o.body; o.skin = pick(R, SKINS.slice(0, 3)); o.boots = 0xf4f0e6; break;
    case 'sky': o.outfit = R() < 0.6 ? 'robe' : undefined; o.top = pick(R, [0xffffff, 0xe6f0ff, 0xf2e0b0]); o.bot = 0xd9b45a; o.hat = maybe(0.6, 'goggles'); o.acc.push('wings'); o.hair = pick(R, [0xe6e0d0, 0xb0b4c0, 0x4a6ad0, 0xd9a04a]); o.trim = 0xd9b45a; break;
    case 'volcano': o.top = pick(R, [0x3a3644, 0x5a3a34, 0x4a4450]); o.bot = 0x2a2630; o.hat = pick(R, ['mask', 'goggles', undefined]); o.acc.push('pads'); o.hatColor = 0xc8443a; o.acc.push('apron'); o.skin = pick(R, SKINS.slice(1, 6)); break;
    case 'reef': o.skin = pick(R, [0x6fd0e0, 0x4fb0d0, 0x7fe0c0, 0x8fa8f0]); o.outfit = R() < 0.5 ? 'bare' : 'dress'; o.top = pick(R, [0x3f9a8a, 0xff8ab0, 0xf2d0e0, 0x5a6ad0]); o.bot = o.top; o.hat = 'fin'; o.hatColor = pick(R, [0xff8ab0, 0xffd24a, 0x5a6ad0]); o.hairStyle = 0; o.boots = o.skin; break;
  }
  return o;
}

/* ---- creatures: a Blender body plus a palette ---- */
function creature(id, pal, s = 1) {
  const m = instance(id, Object.assign({ EYE }, pal)), u = m.userData;
  u.legs = ['leg0', 'leg1', 'leg2', 'leg3'].map(n => u[n]).filter(Boolean);
  if (!u.legs.length) u.legs = null;
  u.arms = u.arm0 ? [u.arm0, u.arm1] : null;
  u.wings = u.wing0 ? [u.wing0, u.wing1] : [];
  u.flap = u.flap0 ? [u.flap0, u.flap1] : null;
  u.claws = u.claw0 ? [u.claw0, u.claw1] : null;
  if (u.float) u.float.userData.y0 = u.float.position.y;
  if (id === 'C.fish' || id === 'C.eel' || id === 'C.angler') u.swim = u.float;
  if (id === 'C.jelly') u.pulse = u.float;
  if (u.bounce) u.bounce.userData.y0 = 0;
  m.scale.setScalar(s);
  return m;
}
const STILLED = { top: 0x6a6480, skin: 0x9a98b0, bot: 0x3d3a50, eyes: EYE, hat: 'hood', hatColor: 0x4a4660, hairStyle: 0 };
const scaled = (m, s) => { m.scale.setScalar(s); return m; };
const C = (id, M1, M2, M3, s) => () => creature(id, { M1, M2, M3 }, s);
const MODELS = {
  scarecrow: () => { const m = person({ top: 0x9a7a4a, skin: 0xd9c38a, bot: 0x6a4a33, hat: 'straw', hatColor: 0x7a5a30, eyes: EYE, hairStyle: 0, acc: ['scarf'] }); m.userData.arms.forEach((a, i) => { a.rotation.z = (i ? 1 : -1) * 1.4; }); m.userData.legs = null; m.userData.arms = null; return m; },
  husk: () => person(STILLED),
  wolf: C('C.wolf', 0x77738c, 0x4a4660, 0x9a96b0), boar: C('C.boar', 0x7a5a4a, 0x4a3a34, 0xc8a070), crow: C('C.bird', 0x3a3848, 0x2a2838, 0x8ff6ff),
  bramble: C('C.slime', 0x5aa84a, 0x3a7a34, 0x7a5234), shellback: C('C.crab', 0xe07a5a, 0xb05a44, 0xf2ead8), gull: C('C.bird', 0xe6e6ee, 0x9a9ab0, 0xf2b040),
  saltslime: C('C.slime', 0x6fd0e0, 0x3fa0b0, 0xffffff), moth: C('C.wisp', 0xcfc6e8, 0x8a80b0, 0xa9e6dc), barkling: C('C.golem', 0x6a5238, 0x4a5a34, 0x6fd08a),
  vinecoil: C('C.eel', 0x4a9a4a, 0x8fd05a, 0x2f6a34), panther: C('C.cat', 0x2e2a44, 0x1c1a2a, 0xb48aff),
  shardback: C('C.crab', 0x9fe6d6, 0x5a9a94, 0xc8fff4), dustwraith: C('C.wisp', 0xe0c890, 0xb09060, 0xc86a4a), glasshound: C('C.hound', 0x9fe0d6, 0x5a9a94, 0xc8fff4),
  cragram: C('C.ram', 0x9a8f88, 0xd0c8c0, 0x4a4440), stonewarden: C('C.golem', 0x8b8c9a, 0x5a5a66, 0x7dbb4c), harrier: C('C.bird', 0x8a6a4a, 0x5a4030, 0xc8443a),
  rimegolem: C('C.golem', 0xc9dcf0, 0x7a8aa0, 0x9fdcff), rimewraith: C('C.wisp', 0xbfe0ff, 0x8aa8d0, 0xe6f4ff), frostwolf: C('C.wolf', 0xe6eef6, 0x8aa0c0, 0xffffff),
  galewisp: C('C.wisp', 0xe6f6ff, 0xb0c8e0, 0xd9b45a), stormhawk: C('C.bird', 0x5a6ab0, 0x3a4480, 0xf4e04d), cloudjelly: C('C.jelly', 0xf0f4ff, 0xb0c8ff, 0xb0c8ff),
  eel: C('C.eel', 0x3a6a8a, 0x7fe0c0, 0x2a4a6a), jelly: C('C.jelly', 0xff8ad0, 0xffd0f0, 0xffd0f0), angler: C('C.angler', 0x3a3a5a, 0x5a5a8a, 0x2a2a44), reefcrab: C('C.crab', 0x5a8ad0, 0x3a5a9a, 0xff8ab0),
  cinderling: C('C.slime', 0xff7a2a, 0xc84a1a, 0x3a3036), magmagolem: C('C.golem', 0x3a3036, 0xff7a2a, 0xffb040), ashwraith: C('C.wisp', 0x5a5460, 0x3a3644, 0xff7a2a), emberhound: C('C.hound', 0x3a3036, 0xff7a2a, 0xffb040),
  wave: () => new THREE.Group(),
  harvestking: () => scaled(person({ top: 0x7a5a30, skin: 0xe0b85a, bot: 0x4a3628, hat: 'crown', eyes: EYE, hairStyle: 0, cape: 0x8a3a2a, acc: ['pads', 'collar'], hatColor: 0x7a5a30, body: 1 }), 2.1),
  breaker: C('C.crab', 0xd0584a, 0x8a3a34, 0xf2ead8, 2.6),
  antlerking: C('C.stag', 0x5f6f66, 0x2e3a36, 0x8fae9a, 2.3),
  hourglass: C('C.golem', 0xa9e0d2, 0xd9b45a, 0xf2b6c8, 1.8),
  cliffwarden: C('C.golem', 0x7a7a88, 0x4a4a55, 0xd0c8c0, 2.2),
  rimewarden: C('C.golem', 0xdfeaf6, 0x5a6a8a, 0x7fc6ff, 2.2),
  stormcrown: C('C.bird', 0x3a4480, 0x1c2450, 0xf4e04d, 3),
  drownedbell: C('C.jelly', 0x5a8ad0, 0xffe08a, 0xffe08a, 2.6),
  cinderheart: C('C.golem', 0x2a2228, 0xff6a20, 0xffd060, 2.5),
  champion: () => scaled(person({ top: 0xc8443a, outfit: 'armor', hat: 'helm', hatColor: 0xd9b45a, cape: 0x3d5fb0, body: 1 }), 1.25),
  gravedial: () => scaled(person({ top: 0x2a2838, skin: 0xb0b0c8, bot: 0x1c1a28, hat: 'hood', hatColor: 0x2a2838, cape: 0x3d3a50, eyes: 0xffd58a, acc: ['halo'], hairStyle: 0, outfit: 'robe' }), 1.3),
  oren: () => scaled(person({ top: 0x3d4a7a, skin: 0xd9b89a, bot: 0x2a2838, hair: 0xe6e6ea, hairStyle: 3, cape: 0xd9b45a, acc: ['halo', 'pads'], hatColor: 0xd9b45a, ring: true, outfit: 'robe' }), 1.35),
};
export function enemyModel(kind) { return (MODELS[kind] || MODELS.husk)(); }

/* Shared walk / idle animation. `swing` 0..1 plays an attack lunge. */
export function animate(m, t, moving, swing = 0, speed = 11) {
  const u = m.userData, s = moving ? Math.sin(t * speed) * 0.7 : 0, sw = Math.sin(swing * Math.PI);
  if (u.legs) u.legs.forEach((l, i) => { l.rotation.x = i % 2 ? -s : s; });
  if (u.arms) { u.arms[0].rotation.x = -s * 0.8; u.arms[1].rotation.x = s * 0.8 - sw * 2.2; }
  if (u.float) { u.float.position.y = u.float.userData.y0 + Math.sin(t * 2.2 + m.id) * 0.18; u.float.rotation.x = sw * 0.6; }
  if (u.wings) u.wings.forEach((w, i) => { w.rotation.y = (i ? -1 : 1) * Math.sin(t * 16) * 0.7; });
  if (u.flap) u.flap.forEach((w, i) => { w.rotation.z = (i ? 1 : -1) * Math.sin(t * 9) * 0.7; });
  if (u.claws) u.claws.forEach((c, i) => { c.rotation.y = (i ? -1 : 1) * (0.3 + Math.sin(t * 3) * 0.15); c.rotation.x = -sw * 0.9; });
  if (u.bounce) { const k = Math.abs(Math.sin(t * 3 + m.id)); u.bounce.scale.set(1 + (1 - k) * 0.15, 0.8 + k * 0.3 + sw * 0.3, 1 + (1 - k) * 0.15); u.bounce.position.y = k * 0.3 * (moving ? 2 : 1); }
  if (u.swim) u.swim.rotation.y = Math.sin(t * 3 + m.id) * 0.25;
  if (u.pulse) u.pulse.scale.y = 1 + Math.sin(t * 3) * 0.12;
  if (u.ring) u.ring.rotation.z = t * 3;
}

/* ---- world objects ---- */
const RAR = [0x9a6a3a, 0x4f9a4a, 0x3d6fd0, 0x8a4ab8, 0xe0a030];
export function chest(rarity = 0) { const m = instance('O.chest', { WOOD: RAR[rarity] }); m.userData.lid = m.userData.lid; return m; }
/* The ring and dot glow once the stone is woken; main.js recolours them and spins the dot. */
export function waystone() {
  const m = instance('O.waystone'), u = m.userData;
  u.ringMesh = u.ring.children[0]; u.ringMesh.material = new THREE.MeshBasicMaterial({ color: 0x555a66 });
  u.dot.material = u.dot.children[0].material = new THREE.MeshBasicMaterial({ color: 0x555a66 });
  return m;
}
export function minute() { const m = instance('O.minute'); for (const k of ['core', 'ring']) m.userData[k].children[0].material = glow(k === 'core' ? 0xfff0c0 : 0xffc66a); m.userData.spin = [m.userData.core, m.userData.ring]; return m; }
export function page() { return instance('O.page'); }
export function herb(color) { return instance('O.herb', { BLOOM: color }); }
export function ore(color) { return instance('O.ore', { GEM: color }); }
export function bell() { return instance('O.bell'); }
export function crate() { const m = instance('O.crate'); m.rotation.set(0.05, 0.6, 0.04); return m; }
export function beacon(lit) { const m = instance('O.beacon'); m.userData.flame.visible = !!lit; return m; }
export function marker() { const m = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 4), glow(0xffd58a)); m.rotation.x = Math.PI; return m; }
export function rift() { const m = instance('O.rift'); m.userData.spinZ = m.userData.ring; return m; }
export function lift() { const m = instance('O.lift'); m.userData.ring.children[0].material = glow(0xbff4ff); m.userData.spinY = m.userData.ring; return m; }
export function strider() { const m = instance('O.strider'); m.userData.legs = ['leg0', 'leg1', 'leg2', 'leg3'].map(n => m.userData[n]); return m; }
export function glider(cloth) { return instance('O.glider', { CLOTH: cloth }); }
