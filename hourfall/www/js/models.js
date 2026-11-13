/* Cel-shaded people, creatures and world objects. Every model faces +z.
   Each character is a merged body plus a few moving parts, so a crowd stays cheap to draw. */
import * as THREE from './vendor/three.module.min.js';
import { TAU } from './util.js';
import { Builder, G, VC, VC2, glow } from './gfx.js';

export const SKINS = [0xffe0cc, 0xf6d2b8, 0xe8b48e, 0xc98a5e, 0x9a6442, 0x6e4530];
export const HAIRS = [0x2a211c, 0x5a3a24, 0x9a5a2a, 0xd9a04a, 0xe6e0d0, 0xb0b4c0, 0xc8443a, 0x4a6ad0, 0x8a4ab8, 0x3fa890];
export const DYES = [0x2f8f86, 0x3d5fb0, 0x8a3a55, 0xc8443a, 0xe0a030, 0x4f9a4a, 0x7a4ab0, 0xf2ead8, 0x3a3a48, 0xe07a9a];
export const HAIR_STYLES = ['Bald', 'Short', 'Spiky', 'Long', 'Bun', 'Tail', 'Crest', 'Bob'];
export const BODIES = ['Lean', 'Broad', 'Small'];
const EYE = 0x8ff6ff, DARK = 0x1c1a2a;
const part = (b, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); g.add(b.mesh()); return g; };

export function person(o = {}) {
  const g = new THREE.Group(), b = new Builder(), W = o.body === 1 ? 1.2 : o.body === 2 ? 0.86 : 1;
  const skin = o.skin ?? SKINS[2], top = o.top ?? DYES[0], bot = o.bot ?? 0x3a3344, hair = o.hair ?? HAIRS[1], hc = o.hatColor ?? 0xd9b45a, long = o.outfit === 'robe' || o.outfit === 'dress';
  if (long) b.add(G.cyl(0.25 * W, 0.5 * W, 1.05, 12), top, { y: 0.95 }).add(G.cyl(0.52 * W, 0.52 * W, 0.08, 12), o.trim ?? hc, { y: 0.46 });
  else b.add(G.cyl(0.28 * W, 0.31 * W, 0.66, 12), o.outfit === 'bare' ? skin : top, { y: 1.1 }).add(G.cyl(0.31 * W, 0.28 * W, 0.24, 12), bot, { y: 0.7 });
  if (o.outfit === 'armor') b.add(G.cyl(0.31 * W, 0.34 * W, 0.4, 12), 0xb8bcc8, { y: 1.2 }).add(G.sph(0.17, 8, 6), 0xb8bcc8, { x: 0.38 * W, y: 1.42 }).add(G.sph(0.17, 8, 6), 0xb8bcc8, { x: -0.38 * W, y: 1.42 });
  if (o.outfit === 'bare') b.add(G.cyl(0.3 * W, 0.3 * W, 0.1, 12), top, { y: 0.84 });
  b.add(G.cyl(0.3 * W, 0.3 * W, 0.07, 12), o.trim ?? 0x5a4030, { y: 0.83 });
  b.add(G.sph(0.34, 16, 12), skin, { y: 1.74 });
  for (const x of [-0.125, 0.125]) b.add(G.sph(0.05, 8, 6), o.eyes ?? DARK, { x, y: 1.77, z: 0.305, sy: 1.5, sz: 0.5 });
  if (!o.eyes) b.add(G.box(0.1, 0.02, 0.02), 0xb0605a, { y: 1.62, z: 0.325 });
  /* hair */
  const hs = o.hairStyle ?? 1;
  if (hs > 0 && !['hood', 'fur', 'helm', 'horns'].includes(o.hat)) {
    b.add(G.dome(0.365, 14), hair, { y: 1.75, z: -0.03, rx: -0.28, sy: hs === 7 ? 1.25 : 1 });
    if (hs === 2) for (let i = 0; i < 6; i++) b.add(G.cone(0.1, 0.3, 5), hair, { x: Math.cos(i * 1.05) * 0.2, y: 2.08, z: Math.sin(i * 1.05) * 0.2 - 0.04, rz: -Math.cos(i * 1.05) * 0.6, rx: Math.sin(i * 1.05) * 0.6 });
    if (hs === 3) b.add(G.box(0.62, 0.7, 0.16), hair, { y: 1.45, z: -0.27 });
    if (hs === 4) b.add(G.sph(0.17, 8, 6), hair, { y: 2.1, z: -0.14 });
    if (hs === 5) b.add(G.cap(0.08, 0.5), hair, { y: 1.6, z: -0.42, rx: 0.5 });
    if (hs === 6) for (let i = 0; i < 5; i++) b.add(G.box(0.08, 0.26, 0.14), hair, { y: 2.14 - Math.abs(i - 2) * 0.05, z: 0.2 - i * 0.12 });
    if (hs === 7) b.add(G.box(0.66, 0.34, 0.2), hair, { y: 1.62, z: -0.2 });
  }
  /* headwear */
  switch (o.hat) {
    case 'straw': b.add(G.cone(0.72, 0.3, 14), hc, { y: 2.08 }); break;
    case 'hood': b.add(G.sph(0.4, 12, 10), hc, { y: 1.77, z: -0.07 }).add(G.cone(0.2, 0.4, 8), hc, { y: 2.16, z: -0.2, rx: -0.6 }); break;
    case 'turban': b.add(G.tor(0.27, 0.13, 14), hc, { y: 2.0, rx: Math.PI / 2 }).add(G.sph(0.25, 10, 8), hc, { y: 2.04 }).add(G.sph(0.06, 6, 5), 0x7fe6d6, { y: 2.02, z: 0.36 }); break;
    case 'fur': b.add(G.sph(0.43, 12, 10), hc, { y: 1.78, z: -0.09 }).add(G.tor(0.34, 0.09, 14), 0xf4f0e6, { y: 1.76, z: 0.16 }); break;
    case 'helm': b.add(G.dome(0.39, 14), 0xb8bcc8, { y: 1.74 }).add(G.box(0.06, 0.3, 0.5), hc, { y: 2.2, z: -0.05 }).add(G.box(0.8, 0.08, 0.1), 0xb8bcc8, { y: 1.78, z: 0.3, sx: 0.5 }); break;
    case 'horns': b.add(G.dome(0.39, 14), 0x8a8a96, { y: 1.74 }); for (const s of [-1, 1]) b.add(G.cone(0.09, 0.42, 6), 0xf2ead8, { x: s * 0.42, y: 2.0, rz: -s * 0.9 }); break;
    case 'feather': b.add(G.tor(0.34, 0.05, 14), 0xe0a030, { y: 1.9, rx: Math.PI / 2 }); for (let i = -1; i <= 1; i++) b.add(G.cone(0.08, 0.6, 4), [0xff5a5a, hc, 0x4ad0b0][i + 1], { x: i * 0.16, y: 2.3, z: -0.24, rz: -i * 0.3, sz: 0.3 }); break;
    case 'goggles': for (const x of [-0.13, 0.13]) b.add(G.tor(0.085, 0.03, 10), 0xd9b45a, { x, y: 1.86, z: 0.3 }); b.add(G.tor(0.345, 0.03, 14), 0x5a4030, { y: 1.86, rx: Math.PI / 2 }); break;
    case 'mask': b.add(G.sph(0.3, 10, 8), 0x3a3644, { y: 1.64, z: 0.1, sy: 0.6 }).add(G.cyl(0.07, 0.07, 0.14, 8), 0xff8a3a, { y: 1.6, z: 0.38, rx: Math.PI / 2 }); break;
    case 'fin': b.add(G.cone(0.3, 0.55, 8), hc, { y: 2.12, z: -0.08, sx: 0.16, rx: -0.3 }); for (const s of [-1, 1]) b.add(G.cone(0.16, 0.34, 6), hc, { x: s * 0.38, y: 1.78, rz: -s * 1.2, sz: 0.2 }); break;
    case 'crown': b.add(G.cyl(0.26, 0.24, 0.14, 12), 0xf2c84a, { y: 2.06 }); for (let i = 0; i < 6; i++) b.add(G.cone(0.05, 0.14, 4), 0xf2c84a, { x: Math.cos(i * 1.05) * 0.24, y: 2.18, z: Math.sin(i * 1.05) * 0.24 }); break;
    case 'wizard': b.add(G.cyl(0.6, 0.6, 0.04, 14), hc, { y: 2.0 }).add(G.cone(0.34, 0.8, 12), hc, { y: 2.4, rz: 0.12 }); break;
    case 'bandana': b.add(G.dome(0.37, 14), hc, { y: 1.78, sy: 0.7 }).add(G.box(0.1, 0.3, 0.05), hc, { x: 0.2, y: 1.7, z: -0.36, rz: 0.4 }); break;
    case 'cap': b.add(G.dome(0.37, 14), hc, { y: 1.8, sy: 0.75 }).add(G.box(0.4, 0.04, 0.3), hc, { y: 1.9, z: 0.4 }); break;
  }
  /* extras */
  if (o.cape !== undefined) b.add(G.box(0.74 * W, 1.0, 0.07), o.cape, { y: 1.0, z: -0.3, rx: 0.08 });
  for (const a of o.acc || []) {
    if (a === 'pack') b.add(G.box(0.46, 0.5, 0.26), 0x8a6a4a, { y: 1.14, z: -0.36 }).add(G.cyl(0.14, 0.14, 0.5, 8), 0xc8b070, { y: 1.46, z: -0.36, rz: Math.PI / 2 });
    if (a === 'scarf') b.add(G.tor(0.26 * W, 0.09, 12), hc, { y: 1.44, rx: Math.PI / 2 });
    if (a === 'collar') b.add(G.tor(0.3 * W, 0.12, 12), 0xf4f0e6, { y: 1.42, rx: Math.PI / 2 });
    if (a === 'pads') for (const s of [-1, 1]) b.add(G.sph(0.18, 8, 6), hc, { x: s * 0.4 * W, y: 1.42 });
    if (a === 'wings') for (const s of [-1, 1]) b.add(G.cone(0.3, 0.9, 5), 0xffffff, { x: s * 0.36, y: 1.36, z: -0.34, rz: s * 2.2, sz: 0.2 });
    if (a === 'apron') b.add(G.box(0.44 * W, 0.6, 0.05), 0xf2ead8, { y: 0.92, z: 0.3 });
    if (a === 'leaf') for (let i = 0; i < 8; i++) b.add(G.cone(0.1, 0.36, 4), 0x4fae4a, { x: Math.cos(i * 0.785) * 0.3 * W, y: 0.6, z: Math.sin(i * 0.785) * 0.3 * W, rx: Math.PI });
    if (a === 'halo') b.add(G.tor(0.6, 0.04, 20), 0xfff0c0, { y: 1.6, z: -0.36 });
  }
  g.add(b.mesh());
  const arm = () => new Builder().add(G.cap(0.085 * W, 0.4), o.outfit === 'bare' ? skin : top, { y: -0.26 }).add(G.sph(0.1, 8, 6), skin, { y: -0.56 });
  const leg = () => new Builder().add(G.cap(0.105 * W, 0.36), long ? top : bot, { y: -0.26 }).add(G.box(0.2, 0.14, 0.32), o.boots ?? 0x4a3628, { y: -0.6, z: 0.05 });
  const arms = [part(arm(), -0.38 * W, 1.4, 0), part(arm(), 0.38 * W, 1.4, 0)], legs = [part(leg(), -0.15 * W, 0.7, 0), part(leg(), 0.15 * W, 0.7, 0)];
  arms[0].rotation.z = -0.12; arms[1].rotation.z = 0.12;
  g.add(...arms, ...legs);
  if (o.ring) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 6, 18), glow(0x7fe6d6)); r.position.set(0, -0.62, 0.1); arms[1].add(r); g.userData.ring = r; }
  g.userData.legs = legs; g.userData.arms = arms;
  g.scale.setScalar((o.scale ?? 1) * (o.body === 2 ? 0.9 : 1));
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
    case 'reef': o.skin = pick(R, [0x6fd0e0, 0x4fb0d0, 0x7fe0c0, 0x8fa8f0]); o.outfit = R() < 0.5 ? 'bare' : 'dress'; o.top = pick(R, [0x3f9a8a, 0xff8ab0, 0xf2d0e0, 0x5a6ad0]); o.bot = o.top; o.hat = 'fin'; o.hatColor = pick(R, [0xff8ab0, 0xffd24a, 0x5a6ad0]); o.hairStyle = 0; o.boots = o.skin; o.eyes = DARK; break;
  }
  return o;
}

/* ---- creatures ---- */
function eyes(b, x, y, z, r = 0.07, c = EYE) { for (const s of [-1, 1]) b.add(G.sph(r, 6, 5), c, { x: s * x, y, z }); }
function quad(o) {
  const g = new THREE.Group(), b = new Builder(), c = o.color, d = o.dark ?? 0x2e2a3a;
  b.add(G.cap(0.42, 1.0), c, { y: 0.95, rx: Math.PI / 2 }).add(G.sph(0.36, 10, 8), c, { y: 1.25, z: 0.9 }).add(G.cap(0.16, 0.2), d, { y: 1.15, z: 1.25, rx: Math.PI / 2 });
  eyes(b, 0.17, 1.36, 1.17);
  for (const s of [-1, 1]) b.add(G.cone(0.11, 0.3, 5), d, { x: s * 0.2, y: 1.62, z: 0.8 });
  b.add(G.cap(0.08, 0.5), d, { y: 1.15, z: -0.95, rx: -0.9 });
  if (o.mane) b.add(G.sph(0.46, 8, 6), o.mane, { y: 1.3, z: 0.55, sy: 1.1 });
  if (o.tusks) for (const s of [-1, 1]) b.add(G.cone(0.06, 0.3, 5), 0xf2ead8, { x: s * 0.16, y: 1.16, z: 1.36, rx: -0.7 });
  if (o.horns) for (const s of [-1, 1]) b.add(G.tor(0.2, 0.07, 10), 0xe9e2c8, { x: s * 0.36, y: 1.44, z: 0.86, ry: Math.PI / 2 });
  if (o.antlers) for (const s of [-1, 1]) { b.add(G.cyl(0.04, 0.06, 1.1, 5), 0xe9e2c8, { x: s * 0.42, y: 1.95, z: 0.85, rz: -s * 0.45 }); for (let i = 0; i < 3; i++) b.add(G.cyl(0.03, 0.04, 0.5, 4), 0xe9e2c8, { x: s * (0.5 + i * 0.16), y: 1.9 + i * 0.26, z: 0.85, rz: -s * 1.2 }); }
  if (o.spikes) for (let i = 0; i < 4; i++) b.add(G.cone(0.12, 0.4, 5), o.spikes, { y: 1.5, z: 0.4 - i * 0.36 });
  g.add(b.mesh());
  const leg = () => new Builder().add(G.cap(0.1, 0.44), d, { y: -0.32 });
  const legs = [part(leg(), -0.24, 0.72, 0.5), part(leg(), 0.24, 0.72, -0.5), part(leg(), 0.24, 0.72, 0.5), part(leg(), -0.24, 0.72, -0.5)];
  g.add(...legs); g.userData.legs = legs;
  return g;
}
function floater(o) {
  const g = new THREE.Group(), body = new THREE.Group(), b = new Builder(); g.add(body); body.position.y = 1.5;
  b.add(G.sph(0.48, 12, 10), o.color, { y: 0.5 }).add(G.cone(0.46, 1.3, 10), o.color, { y: -0.3, rx: Math.PI });
  eyes(b, 0.17, 0.58, 0.4, 0.08);
  if (o.crown) for (let i = 0; i < 5; i++) b.add(G.cone(0.07, 0.3, 4), o.crown, { x: Math.cos(i * 1.26) * 0.3, y: 1.04, z: Math.sin(i * 1.26) * 0.3 });
  const m = b.mesh(new THREE.MeshToonMaterial({ vertexColors: true, transparent: true, opacity: o.opacity ?? 0.9 })); body.add(m);
  const wings = [];
  if (o.wings) for (const s of [-1, 1]) { const w = new THREE.Group(); w.position.set(s * 0.25, 0.4, -0.1); w.add(new Builder().add(G.sph(0.7, 8, 6), o.wings, { x: s * 0.7, sy: 1.3, sz: 0.06 }).mesh()); body.add(w); wings.push(w); }
  g.userData.float = body; g.userData.wings = wings;
  return g;
}
function golem(o) {
  const g = new THREE.Group(), b = new Builder(), c = o.color, d = o.dark ?? 0x555a6a;
  b.add(G.ico(0.95, 1), c, { y: 1.8, sy: 0.9 }).add(G.ico(0.4, 1), d, { y: 2.75, z: 0.1 }).add(G.cyl(0.5, 0.6, 0.5, 8), d, { y: 1.0 });
  eyes(b, 0.15, 2.8, 0.42);
  if (o.crystal) for (let i = 0; i < 4; i++) b.add(G.cone(0.2, 0.9, 5), o.crystal, { x: -0.6 + i * 0.4, y: 2.7, z: -0.4, rz: (1.5 - i) * 0.3 });
  if (o.moss) b.add(G.ico(0.5, 1), o.moss, { x: 0.5, y: 2.5, z: -0.1, sy: 0.5 });
  g.add(b.mesh());
  const arm = () => new Builder().add(G.cap(0.26, 0.9), c, { y: -0.6 }).add(G.ico(0.38, 1), d, { y: -1.3 });
  const leg = () => new Builder().add(G.cap(0.26, 0.5), d, { y: -0.45 });
  const arms = [part(arm(), -1.1, 2.3, 0), part(arm(), 1.1, 2.3, 0)], legs = [part(leg(), -0.42, 1.0, 0), part(leg(), 0.42, 1.0, 0)];
  g.add(...arms, ...legs); g.userData.legs = legs; g.userData.arms = arms;
  return g;
}
function crab(o) {
  const g = new THREE.Group(), b = new Builder();
  b.add(G.dome(0.95, 12), o.color, { y: 0.45, sy: 0.7 }).add(G.cyl(0.95, 0.8, 0.2, 12), o.dark ?? 0x5a8f88, { y: 0.4 });
  for (const s of [-1, 1]) { b.add(G.cyl(0.04, 0.04, 0.3, 4), o.color, { x: s * 0.22, y: 1.1, z: 0.6 }); for (let i = 0; i < 3; i++) b.add(G.cap(0.06, 0.5), o.dark ?? 0x5a8f88, { x: s * (1 + i * 0.05), y: 0.3, z: -0.4 + i * 0.36, rz: s * 0.8 }); }
  eyes(b, 0.22, 1.28, 0.6, 0.09);
  if (o.spikes) for (let i = 0; i < 5; i++) b.add(G.cone(0.14, 0.5, 5), o.spikes, { x: Math.cos(i * 1.26) * 0.45, y: 1.05, z: Math.sin(i * 1.26) * 0.45 });
  g.add(b.mesh());
  const claws = [];
  for (const s of [-1, 1]) { const c = part(new Builder().add(G.sph(0.36, 8, 6), o.color, { z: 0.6, sz: 1.4, sy: 0.7 }).add(G.cone(0.12, 0.4, 5), o.color, { x: 0.12, z: 1.2, rx: Math.PI / 2 }), s * 0.9, 0.6, 0.4); g.add(c); claws.push(c); }
  g.userData.claws = claws;
  return g;
}
function blob(o) {
  const g = new THREE.Group(), body = new THREE.Group(), b = new Builder(); g.add(body);
  b.add(G.sph(0.8, 14, 10), o.color, { y: 0.62, sy: 0.8 }).add(G.sph(0.3, 8, 6), o.light ?? 0xffffff, { x: -0.25, y: 0.95, z: 0.4, sy: 0.6 });
  eyes(b, 0.26, 0.7, 0.66, 0.1, DARK);
  if (o.spikes) for (let i = 0; i < 6; i++) b.add(G.cone(0.12, 0.4, 5), o.spikes, { x: Math.cos(i * 1.05) * 0.45, y: 1.2, z: Math.sin(i * 1.05) * 0.45, rz: -Math.cos(i * 1.05) * 0.5, rx: Math.sin(i * 1.05) * 0.5 });
  body.add(b.mesh(new THREE.MeshToonMaterial({ vertexColors: true, transparent: true, opacity: 0.92 })));
  g.userData.bounce = body;
  return g;
}
function bird(o) {
  const g = new THREE.Group(), body = new THREE.Group(), b = new Builder(); g.add(body); body.position.y = 1.7;
  b.add(G.sph(0.42, 10, 8), o.color, { sz: 1.3 }).add(G.sph(0.28, 8, 6), o.color, { y: 0.3, z: 0.5 }).add(G.cone(0.1, 0.36, 5), 0xf2b040, { y: 0.26, z: 0.84, rx: Math.PI / 2 }).add(G.cone(0.26, 0.7, 5), o.dark ?? o.color, { z: -0.8, rx: -Math.PI / 2, sy: 1, sx: 1, sz: 0.3 });
  eyes(b, 0.15, 0.38, 0.68, 0.06);
  if (o.crest) b.add(G.cone(0.1, 0.4, 4), o.crest, { y: 0.66, z: 0.42, rx: -0.5 });
  body.add(b.mesh());
  const wings = [];
  for (const s of [-1, 1]) { const w = new THREE.Group(); w.position.set(s * 0.3, 0.1, 0); w.add(new Builder().add(G.sph(0.8, 8, 6), o.dark ?? o.color, { x: s * 0.75, sy: 0.08, sz: 0.5 }).mesh()); body.add(w); wings.push(w); }
  g.userData.float = body; g.userData.flap = wings;
  return g;
}
function fish(o) {
  const g = new THREE.Group(), body = new THREE.Group(), b = new Builder(); g.add(body); body.position.y = 1.5;
  b.add(G.sph(0.5, 12, 8), o.color, { sz: o.long ? 2.6 : 1.5, sx: o.long ? 0.6 : 0.8 }).add(G.cone(0.4, 0.6, 5), o.fin ?? o.color, { z: o.long ? -1.5 : -1, rx: Math.PI / 2, sx: 0.2 }).add(G.cone(0.2, 0.5, 4), o.fin ?? o.color, { y: 0.5, sx: 0.2 });
  eyes(b, o.long ? 0.22 : 0.3, 0.12, o.long ? 0.95 : 0.5, 0.09);
  if (o.lure) b.add(G.cyl(0.02, 0.02, 0.7, 4), o.color, { y: 0.6, z: 0.6, rx: 0.7 }).add(G.sph(0.12, 8, 6), 0xfff0a0, { y: 0.86, z: 0.95 });
  if (o.teeth) for (let i = -2; i <= 2; i++) b.add(G.cone(0.04, 0.16, 4), 0xffffff, { x: i * 0.08, y: -0.12, z: o.long ? 1.24 : 0.72, rx: Math.PI });
  body.add(b.mesh()); g.userData.float = body; g.userData.swim = body;
  return g;
}
function jelly(o) {
  const g = new THREE.Group(), body = new THREE.Group(), b = new Builder(); g.add(body); body.position.y = 1.8;
  b.add(G.dome(0.8, 14), o.color, {}).add(G.cyl(0.8, 0.7, 0.14, 14), o.rim ?? 0xffffff, { y: -0.05 });
  for (let i = 0; i < 7; i++) b.add(G.cap(0.04, 1.2), o.rim ?? 0xffffff, { x: Math.cos(i * 0.9) * 0.45, y: -0.8, z: Math.sin(i * 0.9) * 0.45 });
  eyes(b, 0.2, 0.3, 0.66, 0.08, DARK);
  body.add(b.mesh(new THREE.MeshToonMaterial({ vertexColors: true, transparent: true, opacity: 0.8 }))); g.userData.float = body; g.userData.pulse = body;
  return g;
}
const STILLED = { top: 0x6a6480, skin: 0x9a98b0, bot: 0x3d3a50, eyes: EYE, hat: 'hood', hatColor: 0x4a4660, hairStyle: 0 };
const scaled = (m, s) => { m.scale.setScalar(s); return m; };
const MODELS = {
  scarecrow: () => { const m = person({ top: 0x9a7a4a, skin: 0xd9c38a, bot: 0x6a4a33, hat: 'straw', hatColor: 0x7a5a30, eyes: EYE, hairStyle: 0 }); m.userData.arms.forEach((a, i) => { a.rotation.z = (i ? 1 : -1) * 1.4; }); m.userData.legs = null; m.userData.arms = null; return m; },
  husk: () => person(STILLED),
  wolf: () => quad({ color: 0x77738c }), boar: () => quad({ color: 0x7a5a4a, tusks: true, mane: 0x4a3a34 }), crow: () => bird({ color: 0x3a3848, crest: 0x8ff6ff }),
  bramble: () => blob({ color: 0x5aa84a, spikes: 0x7a5234 }), shellback: () => crab({ color: 0xe07a5a, dark: 0xb05a44 }), gull: () => bird({ color: 0xe6e6ee, dark: 0x9a9ab0 }),
  saltslime: () => blob({ color: 0x6fd0e0 }), moth: () => floater({ color: 0xcfc6e8, wings: 0xa9e6dc }), barkling: () => golem({ color: 0x6a5238, dark: 0x4a5a34, moss: 0x5aa84a, crystal: 0x6fd08a }),
  vinecoil: () => fish({ color: 0x4a9a4a, long: true, fin: 0x8fd05a, teeth: true }), panther: () => quad({ color: 0x2e2a44, dark: 0x1c1a2a }),
  shardback: () => crab({ color: 0x9fe6d6, spikes: 0xc8fff4 }), dustwraith: () => floater({ color: 0xe0c890, opacity: 0.7, crown: 0xc86a4a }), glasshound: () => quad({ color: 0x9fe0d6, dark: 0x5a9a94, spikes: 0xc8fff4 }),
  cragram: () => quad({ color: 0x9a8f88, dark: 0x4a4440, horns: true, mane: 0xd0c8c0 }), stonewarden: () => golem({ color: 0x8b8c9a, dark: 0x5a5a66, moss: 0x7dbb4c }), harrier: () => bird({ color: 0x8a6a4a, dark: 0x5a4030, crest: 0xc8443a }),
  rimegolem: () => golem({ color: 0xc9dcf0, dark: 0x7a8aa0, crystal: 0x9fdcff }), rimewraith: () => floater({ color: 0xbfe0ff, opacity: 0.75, wings: 0xe6f4ff }), frostwolf: () => quad({ color: 0xe6eef6, dark: 0x8aa0c0, mane: 0xffffff }),
  galewisp: () => floater({ color: 0xe6f6ff, opacity: 0.65, crown: 0xd9b45a }), stormhawk: () => bird({ color: 0x5a6ab0, dark: 0x3a4480, crest: 0xf4e04d }), cloudjelly: () => jelly({ color: 0xf0f4ff, rim: 0xb0c8ff }),
  eel: () => fish({ color: 0x3a6a8a, long: true, fin: 0x7fe0c0, teeth: true }), jelly: () => jelly({ color: 0xff8ad0, rim: 0xffd0f0 }), angler: () => fish({ color: 0x3a3a5a, lure: true, teeth: true, fin: 0x5a5a8a }), reefcrab: () => crab({ color: 0x5a8ad0, dark: 0x3a5a9a, spikes: 0xff8ab0 }),
  cinderling: () => blob({ color: 0xff7a2a, light: 0xffe08a, spikes: 0x3a3036 }), magmagolem: () => golem({ color: 0x3a3036, dark: 0xff7a2a, crystal: 0xffb040 }), ashwraith: () => floater({ color: 0x5a5460, opacity: 0.8, crown: 0xff7a2a }), emberhound: () => quad({ color: 0x3a3036, dark: 0xff7a2a, spikes: 0xffb040 }),
  /* bosses and elites */
  harvestking: () => scaled(person({ top: 0x7a5a30, skin: 0xe0b85a, bot: 0x4a3628, hat: 'crown', eyes: EYE, hairStyle: 0, cape: 0x8a3a2a, acc: ['pads'], hatColor: 0x7a5a30, body: 1 }), 2.1),
  breaker: () => scaled(crab({ color: 0xd0584a, dark: 0x8a3a34, spikes: 0xf2ead8 }), 2.6),
  antlerking: () => scaled(quad({ color: 0x5f6f66, dark: 0x2e3a36, antlers: true, mane: 0x8fae9a }), 2.3),
  hourglass: () => scaled(golem({ color: 0xa9e0d2, dark: 0xd9b45a, crystal: 0xf2b6c8 }), 1.8),
  cliffwarden: () => scaled(golem({ color: 0x7a7a88, dark: 0x4a4a55, moss: 0x7dbb4c, crystal: 0xd0c8c0 }), 2.2),
  rimewarden: () => scaled(golem({ color: 0xdfeaf6, dark: 0x5a6a8a, crystal: 0x7fc6ff }), 2.2),
  stormcrown: () => scaled(bird({ color: 0x3a4480, dark: 0x1c2450, crest: 0xf4e04d }), 3),
  drownedbell: () => scaled(jelly({ color: 0x5a8ad0, rim: 0xffe08a }), 2.6),
  cinderheart: () => scaled(golem({ color: 0x2a2228, dark: 0xff6a20, crystal: 0xffd060 }), 2.5),
  gravedial: () => scaled(person({ top: 0x2a2838, skin: 0xb0b0c8, bot: 0x1c1a28, hat: 'hood', hatColor: 0x2a2838, cape: 0x3d3a50, eyes: 0xffd58a, acc: ['halo'], hairStyle: 0 }), 1.3),
  oren: () => scaled(person({ top: 0x3d4a7a, skin: 0xd9b89a, bot: 0x2a2838, hair: 0xe6e6ea, hairStyle: 3, cape: 0xd9b45a, acc: ['halo', 'pads'], hatColor: 0xd9b45a, ring: true, outfit: 'robe' }), 1.35),
};
export function enemyModel(kind) { return (MODELS[kind] || MODELS.husk)(); }

/* Shared walk / idle animation. `swing` 0..1 plays an attack lunge. */
export function animate(m, t, moving, swing = 0) {
  const u = m.userData, s = moving ? Math.sin(t * 11) * 0.7 : 0, sw = Math.sin(swing * Math.PI);
  if (u.legs) u.legs.forEach((l, i) => { l.rotation.x = i % 2 ? -s : s; });
  if (u.arms) { u.arms[0].rotation.x = -s * 0.8; u.arms[1].rotation.x = s * 0.8 - sw * 2.2; }
  if (u.float) { u.float.position.y = (u.pulse ? 1.8 : 1.6) + Math.sin(t * 2.2 + m.id) * 0.18; u.float.rotation.x = sw * 0.6; }
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
export function chest(rarity = 0) {
  const g = new THREE.Group(), c = RAR[rarity];
  g.add(new Builder().add(G.box(1.1, 0.6, 0.75), c, { y: 0.3 }).add(G.box(1.16, 0.12, 0.8), 0xd9b45a, { y: 0.3 }).mesh());
  const lid = part(new Builder().add(G.cyl(0.38, 0.38, 1.12, 10, 1), c, { y: 0.02, z: 0.37, rz: Math.PI / 2 }).add(G.box(0.2, 0.26, 0.1), 0xd9b45a, { y: 0.02, z: 0.78 }), 0, 0.6, -0.37);
  g.add(lid); g.userData.lid = lid;
  return g;
}
export function waystone() {
  const g = new THREE.Group();
  g.add(new Builder().add(G.cyl(0.5, 0.8, 3.4, 8), 0x8d8a9a, { y: 1.7 }).add(G.cyl(1.2, 1.4, 0.3, 10), 0x77728a, { y: 0.15 }).mesh());
  const r = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.1, 6, 24), new THREE.MeshBasicMaterial({ color: 0x555a66 })); r.position.y = 3.2; g.add(r);
  const d = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0x555a66 })); d.position.set(1.15, 3.2, 0); g.add(d);
  g.userData.ringMesh = r; g.userData.dot = d;
  return g;
}
export function minute() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), glow(0xfff0c0)); core.position.y = 1.2; g.add(core);
  const r = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.04, 5, 18), glow(0xffc66a)); r.position.y = 1.2; g.add(r);
  g.userData.spin = [core, r];
  return g;
}
export function page() {
  const g = new THREE.Group();
  const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.04), glow(0xf4ead0)); p.position.y = 1.1; p.rotation.x = -0.3; g.add(p);
  const r = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.03, 5, 18), glow(0x7fe6d6)); r.position.y = 1.1; r.rotation.x = Math.PI / 2; g.add(r);
  g.userData.spin = [p];
  return g;
}
export function herb(color) { return new Builder().add(G.cone(0.3, 0.6, 6), 0x4b8a45, { y: 0.3 }).add(G.ico(0.26, 1), color, { y: 0.74 }).add(G.ico(0.16, 1), color, { x: 0.3, y: 0.5 }).mesh(); }
export function ore(color) { return new Builder().add(G.ico(0.7, 0), 0x6a6a78, { y: 0.4, sy: 0.8 }).add(G.cone(0.2, 0.7, 5), color, { x: 0.2, y: 0.9, rz: -0.3 }).add(G.cone(0.16, 0.5, 5), color, { x: -0.3, y: 0.8, rz: 0.5 }).add(G.cone(0.14, 0.4, 5), color, { z: 0.4, y: 0.7, rx: 0.5 }).mesh(); }
export function bell() {
  const g = new THREE.Group();
  g.add(new Builder().add(G.box(0.25, 3, 0.25), 0x6a4a33, { x: -1, y: 1.5 }).add(G.box(0.25, 3, 0.25), 0x6a4a33, { x: 1, y: 1.5 }).add(G.box(2.4, 0.25, 0.3), 0x6a4a33, { y: 3 }).mesh());
  const b = new Builder().add(G.cone(0.6, 0.95, 10), 0xd9b45a, { y: -0.5 }).mesh(VC2); b.position.y = 2.85; g.add(b); g.userData.bell = b;
  return g;
}
export function crate() { const m = new Builder().add(G.box(1, 1, 1), 0x9a6a3a, { y: 0.45 }).add(G.box(1.04, 0.14, 1.04), 0xc86a4a, { y: 0.6 }).mesh(); m.rotation.set(0.15, 0.6, 0.1); return m; }
export function marker() { const m = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 4), glow(0xffd58a)); m.rotation.x = Math.PI; return m; }
export function rift() {
  const g = new THREE.Group();
  const r = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.14, 6, 28), glow(0xb48aff)); r.position.y = 2.2; g.add(r);
  const c = new THREE.Mesh(new THREE.CircleGeometry(1.5, 24), new THREE.MeshBasicMaterial({ color: 0x3a2a6a, transparent: true, opacity: 0.6, side: THREE.DoubleSide })); c.position.y = 2.2; g.add(c);
  g.add(new Builder().add(G.cyl(0.9, 1.1, 0.4, 8), 0x77728a, { y: 0.2 }).mesh());
  g.userData.spinZ = r;
  return g;
}
export function camp() { return new Builder().add(G.cone(1.6, 2.2, 6), 0xc86a4a, { x: -2.4, y: 1.1 }).add(G.cone(0.4, 0.9, 5), 0xffa040, { y: 0.45 }).add(G.cyl(0.6, 0.7, 0.2, 8), 0x5a4a44, { y: 0.1 }).add(G.box(1, 0.8, 0.8), 0x9a6a3a, { x: 1.8, y: 0.4, z: -0.6 }).mesh(); }
export function lift() { const m = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.12, 6, 28), glow(0xbff4ff)); m.rotation.x = Math.PI / 2; m.position.y = 1; const g = new THREE.Group(); g.add(m); g.userData.spinY = m; return g; }
