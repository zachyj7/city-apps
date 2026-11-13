/* The continent of Meridian: a streamed open world about 7 km across.
   Terrain is generated from maths, so nothing is downloaded. Near ground loads in chunks around the
   player; a coarse copy of the whole continent is always drawn behind it, so far mountains stay visible. */
import * as THREE from './vendor/three.module.min.js';
import { clamp, lerp, sstep, fbm, rng, dist, TAU, angDiff } from './util.js';
import { Builder, G, VC } from './gfx.js';

export const WATER = 0, HALF = 3600, EDGE = 3480;

/* Regions, easiest to hardest. Anything outside them is open grassland ("plains"). */
export const REG = {
  vale: { name: 'Dawnmere Vale', x: -700, z: 1300, r: 900, lvl: 1 },
  coast: { name: 'The Salt Coast', x: 700, z: 2600, r: 800, lvl: 6 },
  jungle: { name: 'The Verdance', x: -2300, z: 2100, r: 850, lvl: 10 },
  desert: { name: 'The Glass Wastes', x: 2500, z: 500, r: 950, lvl: 14 },
  crag: { name: 'The Highcrags', x: -2100, z: -1700, r: 900, lvl: 18 },
  frost: { name: 'Frostspine', x: 0, z: -2700, r: 900, lvl: 22 },
  heath: { name: 'Galeheath', x: -2800, z: 200, r: 700, lvl: 26 },
  reef: { name: 'The Drowned Reach', x: 2100, z: 2300, r: 650, lvl: 29 },
  volcano: { name: 'The Cinderdeep', x: 2200, z: -2100, r: 850, lvl: 33 },
};
const RK = Object.keys(REG);

/* Cities (size 2), the castle (3) and hamlets (1). h is filled in below from the land itself. */
export const TOWNS = [
  { id: 'highmark', name: 'Highmark', x: 0, z: 0, r: 250, size: 3, style: 'crown', reg: 'crown' },
  { id: 'dawnmere', name: 'Dawnmere', x: -700, z: 1300, r: 95, size: 2, style: 'vale', reg: 'vale' },
  { id: 'saltcrest', name: 'Saltcrest', x: 700, z: 2560, r: 100, size: 2, style: 'coast', reg: 'coast' },
  { id: 'canopy', name: 'Canopy', x: -2300, z: 2100, r: 100, size: 2, style: 'jungle', reg: 'jungle' },
  { id: 'mirage', name: 'Mirage', x: 2500, z: 500, r: 125, size: 2, style: 'desert', reg: 'desert' },
  { id: 'highcrag', name: 'Highcrag', x: -2100, z: -1700, r: 100, size: 2, style: 'crag', reg: 'crag' },
  { id: 'hearthhold', name: 'Hearthhold', x: 0, z: -2650, r: 100, size: 2, style: 'frost', reg: 'frost' },
  { id: 'aerie', name: 'The Aerie', x: -2800, z: 200, r: 120, size: 2, style: 'sky', reg: 'heath', sky: true },
  { id: 'pearlreach', name: 'Pearlreach', x: 2100, z: 2300, r: 110, size: 2, style: 'reef', reg: 'reef' },
  { id: 'emberdeep', name: 'Emberdeep', x: 2200, z: -2100, r: 125, size: 2, style: 'volcano', reg: 'volcano' },
  { id: 'galefoot', name: 'Galefoot', x: -2620, z: 420, r: 55, size: 1, style: 'crag', reg: 'heath' },
  { id: 'millbrook', name: 'Millbrook', x: -260, z: 640, r: 55, size: 1, style: 'vale', reg: 'crown' },
  { id: 'threestones', name: 'Three Stones', x: 980, z: 860, r: 55, size: 1, style: 'vale', reg: 'crown' },
  { id: 'windrest', name: 'Windrest', x: -1400, z: 240, r: 55, size: 1, style: 'vale', reg: 'crown' },
  { id: 'coldwater', name: 'Coldwater', x: -480, z: -1380, r: 55, size: 1, style: 'frost', reg: 'crown' },
  { id: 'ashford', name: 'Ashford', x: 1250, z: -980, r: 55, size: 1, style: 'volcano', reg: 'crown' },
  { id: 'dunewatch', name: 'Dunewatch', x: 1640, z: 1380, r: 55, size: 1, style: 'desert', reg: 'desert' },
  { id: 'reedhaven', name: 'Reedhaven', x: -1300, z: 2620, r: 55, size: 1, style: 'coast', reg: 'coast' },
  { id: 'lanternfall', name: 'Lanternfall', x: 620, z: -1720, r: 55, size: 1, style: 'frost', reg: 'frost' },
];
/* Boss arenas and other flattened landmarks (size 0: no houses). */
for (const [id, name, x, z, reg] of [['a_vale', 'The Fallow Field', -380, 1640, 'vale'], ['a_coast', "Breaker's Cove", 1080, 2700, 'coast'], ['a_jungle', 'Antler Hollow', -2640, 2400, 'jungle'],
  ['a_desert', 'The Sunken Clock', 2880, 140, 'desert'], ['a_crag', "Warden's Stair", -2420, -2060, 'crag'], ['a_frost', "Warden's Crown", -320, -3020, 'frost'],
  ['a_reef', 'The Bell Deep', 2380, 2560, 'reef'], ['a_volcano', 'The Ash Throne', 1780, -1700, 'volcano'], ['a_graves', 'The Quiet Yard', -960, 1020, 'vale']]) TOWNS.push({ id, name, x, z, r: 34, size: 0, style: reg, reg });
export const TOWN = Object.fromEntries(TOWNS.map(t => [t.id, t]));
const ROAD_SEGS = [];
const road = (...ids) => { for (let i = 0; i < ids.length - 1; i++) ROAD_SEGS.push([TOWN[ids[i]], TOWN[ids[i + 1]]]); };
road('dawnmere', 'millbrook', 'highmark', 'threestones', 'dunewatch', 'mirage');
road('dawnmere', 'saltcrest'); road('dawnmere', 'reedhaven', 'canopy'); road('saltcrest', 'pearlreach');
road('highmark', 'windrest', 'galefoot'); road('highmark', 'coldwater', 'highcrag'); road('coldwater', 'hearthhold');
road('highmark', 'lanternfall', 'hearthhold'); road('highmark', 'ashford', 'emberdeep');

/* Floating islands of the Aerie. Bridges join each island to the first. */
export const ISLES = [
  { x: -2800, z: 200, r: 125, y: 230 }, { x: -2620, z: 300, r: 34, y: 230 }, { x: -2960, z: 60, r: 46, y: 230 },
  { x: -2890, z: 400, r: 40, y: 230 }, { x: -2660, z: 60, r: 38, y: 230 }, { x: -2990, z: 290, r: 30, y: 230 },
];
export const LIFT = { x: -2620, z: 300 };
export function skyGround(x, z) {
  for (const i of ISLES) if (dist(x, z, i.x, i.z) < i.r - 1) return i.y;
  const a = ISLES[0];
  for (let k = 1; k < ISLES.length; k++) {
    const b = ISLES[k], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz, t = clamp(((x - a.x) * dx + (z - a.z) * dz) / l2, 0, 1);
    if (dist(x, z, a.x + dx * t, a.z + dz * t) < 3.2) return a.y;
  }
  return null;
}

export function weights(x, z) {
  const wob = (fbm(x * 0.0021 + 7.3, z * 0.0021 - 3.1) - 0.5) * 520, w = {};
  let best = 'plains', bw = 0.5;
  for (const k of RK) { const r = REG[k], v = sstep(r.r, r.r * 0.7, dist(x, z, r.x, r.z) + wob); w[k] = v; if (v > bw) { bw = v; best = k; } }
  w.id = best;
  return w;
}
const VOL = REG.volcano;
function rawHeight(x, z, w) {
  const d0 = Math.hypot(x, z), n1 = fbm(x * 0.004, z * 0.004), n2 = fbm(x * 0.013 + 31, z * 0.013 - 17);
  let h = 7 + (n1 - 0.45) * 40 + (n2 - 0.5) * 10;
  if (w.vale) h = lerp(h, 6 + (n2 - 0.5) * 8 + (n1 - 0.45) * 14, w.vale);
  if (w.coast) h = lerp(h, 2.4 + (n2 - 0.5) * 4, w.coast);
  if (w.heath) h = lerp(h, 16 + (n1 - 0.45) * 34 + (n2 - 0.5) * 6, w.heath);
  if (w.jungle) { const j = fbm(x * 0.01 - 80, z * 0.01 + 60); h += w.jungle * ((j - 0.5) * 46 - sstep(0.06, 0, Math.abs(j - 0.5)) * 9); }
  if (w.desert) h = lerp(h, 7 + Math.sin(x * 0.021 + n1 * 8) * 5 + Math.sin(z * 0.031 + n2 * 5) * 3 + sstep(0.62, 0.66, n2) * 36, w.desert);
  if (w.frost) h += w.frost * (fbm(x * 0.008 + 50, z * 0.008 + 50) * 74 + 8);
  if (w.crag) {
    const rg = 1 - Math.abs(fbm(x * 0.006 + 9, z * 0.006 - 4) * 2 - 1), raw = rg * rg * 200 + n2 * 22, t = raw / 24, f = Math.floor(t);
    h = lerp(h, 10 + (f + sstep(0.72, 1, t - f)) * 24, w.crag);
  }
  if (w.volcano) {
    const dv = dist(x, z, VOL.x, VOL.z);
    let hv = dv > 230 ? 18 + 290 * sstep(800, 230, dv) + (n2 - 0.5) * 34 * sstep(230, 420, dv) : 90 + sstep(168, 230, dv) * 218;
    /* A canyon through the south-west wall is the only road into the crater. */
    const off = Math.abs(angDiff(Math.atan2(z - VOL.z, x - VOL.x), Math.PI * 0.75));
    if (dv > 150 && dv < 760) hv = lerp(hv, Math.min(hv, 90 - sstep(230, 740, dv) * 64), sstep(0.2, 0.09, off * Math.min(1, dv / 300)));
    h = lerp(h, hv, w.volcano);
  }
  if (w.reef) h = lerp(h, -44 + (n2 - 0.5) * 18 + (n1 - 0.5) * 10, w.reef);
  const edge = 2980 + fbm(x * 0.0012 + 3, z * 0.0012 + 8) * 520;
  h -= sstep(edge - 160, edge + 260, d0) * 75;
  return h;
}
for (const t of TOWNS) {
  t.h = t.sky ? ISLES[0].y : Math.max(rawHeight(t.x, t.z, weights(t.x, t.z)), t.reg === 'reef' ? -60 : 3);
  if (t.id === 'emberdeep') t.h = 90;
  if (t.id === 'highmark') t.h = Math.max(t.h, 12);
}
const GROUND_TOWNS = TOWNS.filter(t => !t.sky);
export function height(x, z, w) {
  let h = rawHeight(x, z, w || weights(x, z));
  for (const t of GROUND_TOWNS) {
    const dx = x - t.x, dz = z - t.z;
    if (dx > t.r || dx < -t.r || dz > t.r || dz < -t.r) continue;
    const d = Math.hypot(dx, dz);
    if (d < t.r) h = lerp(h, t.h, 1 - sstep(t.r * 0.62, t.r, d));
  }
  const dv = dist(x, z, VOL.x, VOL.z);
  if (dv < 44) h = lerp(h, 74, sstep(44, 30, dv));
  return h;
}
export function roadDist(x, z) {
  let best = 1e9;
  for (const [a, b] of ROAD_SEGS) {
    const dx = b.x - a.x, dz = b.z - a.z, t = clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz), 0, 1);
    const d = Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t));
    if (d < best) best = d;
  }
  return best + (fbm(x * 0.03, z * 0.03) - 0.5) * 8;
}
export function townAt(x, z, pad = 0) { for (const t of GROUND_TOWNS) if (dist(x, z, t.x, t.z) < t.r + pad) return t; return null; }
/* Name and danger level of wherever the player is standing. */
export function regionAt(x, z) {
  const w = weights(x, z);
  if (w.id !== 'plains') return { id: w.id, name: REG[w.id].name, lvl: REG[w.id].lvl };
  const d = Math.hypot(x, z);
  return { id: 'plains', name: d < 900 ? 'The Crownlands' : 'The Wide Marches', lvl: clamp(Math.round(2 + d / 330), 3, 11) };
}

const C = h => new THREE.Color(h), tc = new THREE.Color(), tc2 = new THREE.Color();
const col = { grass: C(0x7dbb4c), grass2: C(0x9ccf5a), vale: C(0x8fd05a), sand: C(0xf0dca0), wet: C(0xd9c488), jungle: C(0x2f9a4e), jungle2: C(0x1f7a52),
  desert: C(0xf2cf8a), glass: C(0x9fe6d6), mesa: C(0xd98a55), rock: C(0x8b8c9a), snow: C(0xdfe9f5), heath: C(0xa9b86a), heather: C(0xb48ad0),
  ash: C(0x4a4450), lava: C(0xff7a2a), basalt: C(0x2e2a36), sea: C(0xcdbf8a), coral: C(0x6fc0b0), road: C(0xcbb083), cliff: C(0x9a8f88), deep: C(0x3b8fb0) };
export function groundColor(x, z, h, slope, w, out) {
  const n = fbm(x * 0.02, z * 0.02);
  out.copy(col.grass).lerp(col.grass2, n);
  if (w.vale) out.lerp(tc.copy(col.vale).lerp(col.grass2, n), w.vale);
  if (w.coast) out.lerp(col.sand, w.coast);
  if (w.jungle) out.lerp(tc.copy(col.jungle).lerp(col.jungle2, n), w.jungle);
  if (w.heath) out.lerp(tc.copy(col.heath).lerp(col.heather, sstep(0.5, 0.7, n)), w.heath);
  if (w.desert) out.lerp(tc.copy(col.desert).lerp(col.glass, sstep(0.6, 0.72, fbm(x * 0.011 + 9, z * 0.011)) * 0.8).lerp(col.mesa, sstep(0.3, 1.2, slope)), w.desert);
  if (w.crag) out.lerp(tc.copy(col.grass).lerp(col.cliff, sstep(0.25, 0.9, slope) * 0.9 + 0.1), w.crag);
  if (w.frost) out.lerp(tc.copy(col.snow).lerp(col.rock, sstep(0.6, 1.3, slope)), w.frost);
  if (w.volcano) out.lerp(tc.copy(col.ash).lerp(col.basalt, n).lerp(col.lava, sstep(0.045, 0.01, Math.abs(fbm(x * 0.012 + 40, z * 0.012 - 40) - 0.5)) * sstep(60, 100, h)), w.volcano);
  if (w.reef) out.lerp(tc.copy(col.sea).lerp(col.coral, n), w.reef);
  if (!w.frost && !w.volcano && !w.desert) out.lerp(col.cliff, sstep(0.9, 1.6, slope) * 0.8);
  if (h > WATER + 0.5 && roadDist(x, z) < 9) out.lerp(col.road, sstep(9, 4, roadDist(x, z)) * 0.85);
  if (h < WATER + 2.2 && !w.reef) out.lerp(col.wet, sstep(WATER + 2.2, WATER + 0.3, h));
  return out;
}

const PHASES = [
  { top: 0x3a2f6a, hor: 0xffa05a, fog: 0xe6a878, sun: 0xffc48a, si: 2.5, sky: 0xd9c2f0, gnd: 0xb08a72, hi: 2.6, stars: 0.12 },
  { top: 0x232660, hor: 0xd97890, fog: 0xa87898, sun: 0xffa8b4, si: 2.2, sky: 0xbcb2f0, gnd: 0x94809a, hi: 2.6, stars: 0.5 },
  { top: 0x0d1338, hor: 0x4860a8, fog: 0x40548e, sun: 0xb4c4ff, si: 2.0, sky: 0xa9bbf6, gnd: 0x6878a6, hi: 2.9, stars: 1 },
  { top: 0x2f387a, hor: 0xffbba8, fog: 0xc89ca8, sun: 0xffd0b8, si: 2.4, sky: 0xd0caf4, gnd: 0xa48a92, hi: 2.6, stars: 0.3 },
  { top: 0x3f8fe0, hor: 0xcfeaff, fog: 0xc4e4f8, sun: 0xfff4d6, si: 3.0, sky: 0xd6eaff, gnd: 0x94a480, hi: 2.3, stars: 0 },
];

/* ---- scenery models: each is one merged, vertex-coloured shape ---- */
function props() {
  const b = () => new Builder(), P = {};
  P.oak = b().add(G.cyl(0.3, 0.5, 3, 7), 0x7a5234, { y: 1.5 }).add(G.ico(2.3, 1), 0x5fae45, { y: 4.6 }).add(G.ico(1.6, 1), 0x74c254, { x: 1.5, y: 3.8, z: 0.4 }).add(G.ico(1.5, 1), 0x4f9a3f, { x: -1.3, y: 4, z: -0.7 }).add(G.ico(1.3, 1), 0x86cf5e, { y: 6, z: 0.6 }).build();
  P.pine = b().add(G.cyl(0.25, 0.4, 2.4, 6), 0x6a4630, { y: 1.2 }).add(G.cone(2.3, 3.2, 8), 0x2f7a48, { y: 3.4 }).add(G.cone(1.8, 2.8, 8), 0x378a50, { y: 5.2 }).add(G.cone(1.2, 2.4, 8), 0x42985a, { y: 6.9 }).build();
  P.spine = b().add(G.cyl(0.25, 0.4, 2.4, 6), 0x5a4a44, { y: 1.2 }).add(G.cone(2.3, 3.2, 8), 0x3f7a6a, { y: 3.4 }).add(G.cone(2.0, 1, 8), 0xf2f7fc, { y: 4.6 }).add(G.cone(1.8, 2.8, 8), 0x4a8a78, { y: 5.4 }).add(G.cone(1.2, 2.4, 8), 0xf2f7fc, { y: 7 }).build();
  let pb = b().add(G.cyl(0.2, 0.34, 6, 6), 0xb08a5a, { y: 3, rz: 0.12 }).add(G.sph(0.3, 6, 5), 0x7a5a30, { x: -0.36, y: 5.9 });
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; pb.add(G.cone(0.5, 3.4, 4), i % 2 ? 0x4fae4a : 0x62c258, { x: -0.36 + Math.cos(a) * 1.5, y: 5.9, z: Math.sin(a) * 1.5, rz: Math.cos(a) * -1.9, rx: Math.sin(a) * 1.9, sz: 0.4 }); }
  P.palm = pb.build();
  P.jtree = b().add(G.cyl(0.5, 0.9, 9, 7), 0x5a4030, { y: 4.5 }).add(G.cyl(3.6, 2.2, 1.4, 9), 0x2f8f4a, { y: 9.4 }).add(G.cyl(2.6, 3.4, 1.2, 9), 0x3fa858, { y: 10.6 }).add(G.cyl(1.2, 2.4, 1, 9), 0x56bf62, { y: 11.6 }).add(G.cyl(0.06, 0.06, 5, 4), 0x4f9a4a, { x: 2.2, y: 6.6 }).add(G.cyl(0.06, 0.06, 4, 4), 0x4f9a4a, { x: -1.8, y: 7, z: 1.2 }).build();
  P.cactus = b().add(G.cap(0.45, 2.6), 0x4f9a58, { y: 1.8 }).add(G.cap(0.26, 0.9), 0x58a862, { x: 0.8, y: 2.2 }).add(G.cap(0.24, 0.6), 0x4f9a58, { x: 0.5, y: 1.7, rz: 1.57 }).add(G.cap(0.24, 0.8), 0x58a862, { x: -0.8, y: 2.6 }).add(G.cap(0.22, 0.6), 0x4f9a58, { x: -0.5, y: 2.1, rz: 1.57 }).add(G.sph(0.16, 6, 4), 0xff7aa8, { y: 3.6 }).build();
  P.dead = b().add(G.cyl(0.16, 0.34, 3.6, 5), 0x5a4a44, { y: 1.8 }).add(G.cyl(0.07, 0.14, 1.8, 4), 0x5a4a44, { x: 0.6, y: 3.2, rz: -0.9 }).add(G.cyl(0.06, 0.12, 1.5, 4), 0x5a4a44, { x: -0.5, y: 2.7, rz: 1 }).build();
  P.shard = b().add(G.cone(0.7, 3.4, 5), 0x9ff0e0, { y: 1.7 }).add(G.cone(0.45, 2, 5), 0xc8fff4, { x: 0.7, y: 1, rz: -0.4 }).add(G.cone(0.4, 1.6, 5), 0x7fd8c8, { x: -0.6, y: 0.8, rz: 0.5 }).build();
  P.ice = b().add(G.cone(0.8, 4, 5), 0xbfe6ff, { y: 2 }).add(G.cone(0.5, 2.2, 5), 0xe6f6ff, { x: 0.8, y: 1.1, rz: -0.35 }).build();
  P.basalt = b().add(G.cyl(0.7, 0.8, 3.4, 6), 0x2e2a36, { y: 1.7 }).add(G.cyl(0.6, 0.7, 2.2, 6), 0x3a3644, { x: 1.1, y: 1.1 }).add(G.cyl(0.5, 0.6, 1.4, 6), 0x2e2a36, { x: -0.9, y: 0.7, z: 0.5 }).add(G.box(0.3, 0.1, 0.3), 0xff8a3a, { x: 0.5, y: 0.05, z: 0.8 }).build();
  P.rock = b().add(G.ico(1, 0), 0x8f8e98, { y: 0.4, sy: 0.7 }).add(G.ico(0.6, 0), 0xa3a2ac, { x: 0.9, y: 0.25, z: 0.3, sy: 0.7 }).build();
  P.bush = b().add(G.ico(0.9, 1), 0x58a848, { y: 0.55, sy: 0.75 }).add(G.ico(0.6, 1), 0x6cbc54, { x: 0.7, y: 0.4 }).build();
  pb = b(); for (let i = 0; i < 5; i++) pb.add(G.cone(0.09, 0.7, 3), i % 2 ? 0x8fcf5a : 0x74b84a, { x: Math.cos(i * 2.4) * 0.25, y: 0.3, z: Math.sin(i * 2.4) * 0.25, rz: Math.cos(i * 2.4) * 0.3, rx: Math.sin(i) * 0.3 }); P.tuft = pb.build();
  pb = b(); for (let i = 0; i < 4; i++) { const x = Math.cos(i * 1.9) * 0.4, z = Math.sin(i * 1.9) * 0.4; pb.add(G.cyl(0.03, 0.03, 0.5, 3), 0x5fa84a, { x, y: 0.25, z }).add(G.sph(0.13, 6, 4), [0xffd24a, 0xff7aa8, 0xffffff, 0xb48aff][i], { x, y: 0.55, z }); } P.flower = pb.build();
  P.shroom = b().add(G.cyl(0.3, 0.42, 2.4, 7), 0xf2ead8, { y: 1.2 }).add(G.dome(1.5, 10), 0xe0508a, { y: 2.2, sy: 0.7 }).add(G.sph(0.2, 6, 4), 0xfff0f6, { x: 0.7, y: 2.95, z: 0.3 }).add(G.sph(0.16, 6, 4), 0xfff0f6, { x: -0.6, y: 2.9, z: -0.5 }).build();
  P.coral = b().add(G.cyl(0.18, 0.3, 2, 6), 0xff7a8a, { y: 1 }).add(G.cyl(0.12, 0.18, 1.4, 5), 0xff9aa4, { x: 0.5, y: 1.6, rz: -0.7 }).add(G.cyl(0.12, 0.18, 1.2, 5), 0xff9aa4, { x: -0.45, y: 1.4, rz: 0.8 }).add(G.sph(0.24, 6, 5), 0xffc2c8, { y: 2.1 }).add(G.sph(0.2, 6, 5), 0xffc2c8, { x: 1, y: 2.1 }).add(G.sph(0.2, 6, 5), 0xffc2c8, { x: -0.9, y: 1.8 }).build();
  pb = b(); for (let i = 0; i < 4; i++) pb.add(G.box(0.3, 1.6, 0.06), i % 2 ? 0x3f9a6a : 0x58b47a, { x: Math.sin(i * 1.7) * 0.3, y: 0.8 + i * 1.5, rz: Math.sin(i * 2.1) * 0.3, ry: i }); P.kelp = pb.build();
  return P;
}
/* What grows where: [model, chance] per placement attempt. */
const FLORA = {
  plains: [['oak', 0.1], ['bush', 0.07], ['rock', 0.03], ['tuft', 0.26], ['flower', 0.08]],
  vale: [['oak', 0.08], ['bush', 0.06], ['tuft', 0.3], ['flower', 0.18], ['rock', 0.02]],
  coast: [['palm', 0.14], ['rock', 0.04], ['tuft', 0.08], ['bush', 0.03]],
  jungle: [['jtree', 0.34], ['bush', 0.2], ['shroom', 0.06], ['flower', 0.1], ['rock', 0.03]],
  desert: [['cactus', 0.07], ['shard', 0.05], ['rock', 0.06], ['dead', 0.02]],
  crag: [['pine', 0.12], ['rock', 0.14], ['tuft', 0.08]],
  frost: [['spine', 0.17], ['rock', 0.06], ['ice', 0.05]],
  heath: [['rock', 0.08], ['tuft', 0.3], ['bush', 0.05], ['dead', 0.03], ['flower', 0.06]],
  reef: [['coral', 0.24], ['kelp', 0.22], ['rock', 0.08]],
  volcano: [['basalt', 0.14], ['dead', 0.04], ['rock', 0.1]],
};
const TALL = { oak: 1, pine: 1, spine: 1, palm: 1, jtree: 1, cactus: 1, shard: 1, ice: 1, basalt: 1, shroom: 1, dead: 1, coral: 1, kelp: 1 };

const CS = 128, CN = 24, VIEW = 3;
export function buildWorld(scene) {
  const far = new THREE.Scene();
  const PROP = props();

  /* ---- distant copy of the whole continent ---- */
  const FN = 132, fgeo = new THREE.PlaneGeometry(HALF * 2, HALF * 2, FN, FN); fgeo.rotateX(-Math.PI / 2);
  const fp = fgeo.attributes.position, fc = new Float32Array(fp.count * 3), c = new THREE.Color();
  const map = document.createElement('canvas'); map.width = map.height = FN + 1;
  const mg = map.getContext('2d'), img = mg.createImageData(FN + 1, FN + 1);
  for (let i = 0; i < fp.count; i++) {
    const x = fp.getX(i), z = fp.getZ(i), w = weights(x, z), h = height(x, z, w);
    fp.setY(i, h - 1.5);
    const slope = Math.abs(height(x + 12, z, w) - h) / 12;
    groundColor(x, z, h, slope, w, c);
    fc[i * 3] = c.r; fc[i * 3 + 1] = c.g; fc[i * 3 + 2] = c.b;
    tc2.copy(h < WATER ? col.deep : c).convertLinearToSRGB();
    const sh = h < WATER ? clamp(1 + h * 0.008, 0.6, 1) : clamp(0.86 + h * 0.0016, 0.8, 1.25);
    img.data[i * 4] = tc2.r * 255 * sh; img.data[i * 4 + 1] = tc2.g * 255 * sh; img.data[i * 4 + 2] = tc2.b * 255 * sh; img.data[i * 4 + 3] = 255;
  }
  mg.putImageData(img, 0, 0);
  fgeo.setAttribute('color', new THREE.BufferAttribute(fc, 3)); fgeo.computeVertexNormals();
  far.add(new THREE.Mesh(fgeo, VC));
  const farWater = new THREE.Mesh(new THREE.PlaneGeometry(30000, 30000).rotateX(-Math.PI / 2), new THREE.MeshToonMaterial({ color: 0x3f9ec4 })); farWater.position.y = WATER - 0.4; far.add(farWater);
  const water = new THREE.Mesh(new THREE.CircleGeometry(620, 40).rotateX(-Math.PI / 2), new THREE.MeshToonMaterial({ color: 0x4fb4d8, transparent: true, opacity: 0.78, side: THREE.DoubleSide }));
  water.position.y = WATER; scene.add(water);
  const lava = new THREE.Mesh(new THREE.CircleGeometry(46, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff8a2a })); lava.position.set(VOL.x, 86.5, VOL.z); scene.add(lava);
  const lavaLight = new THREE.PointLight(0xff6a20, 4000, 260); lavaLight.position.set(VOL.x, 110, VOL.z); scene.add(lavaLight);

  /* ---- floating islands ---- */
  const ib = new Builder();
  for (const i of ISLES) {
    ib.add(G.cyl(i.r, i.r * 0.92, 5, 22), 0x8fd05a, { x: i.x, y: i.y - 2.5, z: i.z }).add(G.cone(i.r * 0.93, i.r * 1.1, 9), 0x8a7a6a, { x: i.x, y: i.y - 5 - i.r * 0.55, z: i.z, rx: Math.PI })
      .add(G.cone(i.r * 0.4, i.r * 0.9, 6), 0x7a6a5c, { x: i.x + i.r * 0.4, y: i.y - 5 - i.r * 0.45, z: i.z + i.r * 0.2, rx: Math.PI });
  }
  for (let k = 1; k < ISLES.length; k++) {
    const a = ISLES[0], b2 = ISLES[k], dx = b2.x - a.x, dz = b2.z - a.z, l = Math.hypot(dx, dz), ry = Math.atan2(dx, dz);
    ib.add(G.box(7, 0.6, l), 0xf4ecd8, { x: (a.x + b2.x) / 2, y: a.y - 0.3, z: (a.z + b2.z) / 2, ry });
    for (const s of [-3.6, 3.6]) ib.add(G.box(0.3, 1.2, l), 0xe0b85a, { x: (a.x + b2.x) / 2 + Math.cos(ry) * s, y: a.y + 0.5, z: (a.z + b2.z) / 2 - Math.sin(ry) * s, ry });
  }
  /* The wind-lift: a column of light from the heath up to the first small island. */
  ib.add(G.cyl(3.4, 3.4, 0.5, 14), 0xe0b85a, { x: LIFT.x, y: height(LIFT.x, LIFT.z) + 0.2, z: LIFT.z });
  const isles = ib.mesh(); isles.frustumCulled = false; scene.add(isles);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 232, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xbff4ff, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.set(LIFT.x, 116, LIFT.z); scene.add(beam);

  /* ---- the Great Dial, hanging over the castle and visible from the whole continent ---- */
  const dialMat = new THREE.MeshBasicMaterial({ color: 0xf2d9a0, fog: false });
  const dial = new THREE.Mesh(new THREE.TorusGeometry(1100, 13, 6, 120), dialMat);
  dial.position.set(0, 900, 0); dial.rotation.set(-1.25, 0, 0.14); far.add(dial);
  for (let i = 0; i < 12; i++) { const t = new THREE.Mesh(new THREE.BoxGeometry(12, 110, 12), dialMat), a = i / 12 * TAU; t.position.set(Math.cos(a) * 1100, Math.sin(a) * 1100, 0); t.rotation.z = a + Math.PI / 2; dial.add(t); }
  const spark = new THREE.Mesh(new THREE.SphereGeometry(56, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff0c0, fog: false }));
  const halo = new THREE.Mesh(new THREE.SphereGeometry(104, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffb060, fog: false, transparent: true, opacity: 0.28 }));
  spark.add(halo); dial.add(spark);
  let sparkA = 0.5, sparkTo = 0.5;
  const placeSpark = () => spark.position.set(Math.cos(sparkA) * 1100, Math.sin(sparkA) * 1100, 0);
  placeSpark();

  /* ---- sky ---- */
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() } },
    vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 hor; varying float h; void main(){ float t = pow(clamp(h*1.2+0.04,0.0,1.0),0.55); gl_FragColor = vec4(mix(hor, top, t),1.0); }',
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 24, 14), skyMat); far.add(sky);
  const R = rng(77), sp = new Float32Array(1100 * 3);
  for (let i = 0; i < 1100; i++) { const a = R() * TAU, e = Math.acos(R() * 0.96); sp[i * 3] = Math.sin(e) * Math.cos(a) * 8600; sp[i * 3 + 1] = Math.cos(e) * 8600; sp[i * 3 + 2] = Math.sin(e) * Math.sin(a) * 8600; }
  const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false })); far.add(stars);
  /* Clouds, frozen mid-sky like everything else. */
  const cb = new Builder();
  for (let i = 0; i < 46; i++) { const a = R() * TAU, d = 500 + R() * 3600, x = Math.cos(a) * d, z = Math.sin(a) * d, y = 420 + R() * 260, s = 40 + R() * 70; for (let k = 0; k < 4; k++) cb.add(G.ico(1, 1), 0xffffff, { x: x + (k - 1.5) * s * 0.8, y: y + (k % 2) * s * 0.2, z: z + (R() - 0.5) * s, sx: s, sy: s * 0.42, sz: s * 0.8 }); }
  far.add(new THREE.Mesh(cb.build(), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, fog: false })));

  const lights = [scene, far].map(s => { const sun = new THREE.DirectionalLight(0xffffff, 2); s.add(sun); s.add(sun.target); const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1); s.add(hemi); s.fog = new THREE.Fog(0xffffff, 140, 1500); return { sun, hemi, fog: s.fog }; });

  const MN = 140, mp = new Float32Array(MN * 3), ms = [];
  for (let i = 0; i < MN; i++) { mp[i * 3] = (R() - 0.5) * 80; mp[i * 3 + 1] = R() * 14; mp[i * 3 + 2] = (R() - 0.5) * 80; ms.push(R() * TAU); }
  const moteGeo = new THREE.BufferGeometry(); moteGeo.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ color: 0xffe2a8, size: 0.1, transparent: true, opacity: 0.8, depthWrite: false })); motes.frustumCulled = false; scene.add(motes);

  /* ---- streamed ground ---- */
  const chunks = new Map(), queue = [];
  const idx = []; for (let j = 0; j < CN; j++) for (let i = 0; i < CN; i++) { const a = j * (CN + 1) + i, b2 = a + 1, d = a + CN + 1, e = d + 1; idx.push(a, d, b2, b2, d, e); }
  const dummy = new THREE.Object3D(), ic = new THREE.Color();
  function makeChunk(cx, cz) {
    const x0 = cx * CS, z0 = cz * CS, st = CS / CN, W = CN + 3, hs = new Float32Array(W * W), ws = new Array(W * W);
    for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) { const x = x0 + (i - 1) * st, z = z0 + (j - 1) * st, w = weights(x, z); ws[j * W + i] = w; hs[j * W + i] = height(x, z, w); }
    const n = (CN + 1) * (CN + 1), pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), colr = new Float32Array(n * 3);
    for (let j = 0; j <= CN; j++) for (let i = 0; i <= CN; i++) {
      const k = j * (CN + 1) + i, q = (j + 1) * W + i + 1, h = hs[q], dx = hs[q + 1] - hs[q - 1], dz = hs[q + W] - hs[q - W], x = x0 + i * st, z = z0 + j * st;
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
      const l = Math.hypot(dx, 2 * st, dz); nor[k * 3] = -dx / l; nor[k * 3 + 1] = 2 * st / l; nor[k * 3 + 2] = -dz / l;
      groundColor(x, z, h, Math.hypot(dx, dz) / (2 * st), ws[q], c); colr[k * 3] = c.r; colr[k * 3 + 1] = c.g; colr[k * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.BufferAttribute(colr, 3)); geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, VC); scene.add(mesh);
    const R2 = rng((cx * 73856093) ^ (cz * 19349663)), lists = {}, tall = [];
    for (let a = 0; a < 64; a++) {
      const x = x0 + R2() * CS, z = z0 + R2() * CS, r = R2(), s = 0.8 + R2() * 0.7, rot = R2() * TAU, tint = 0.86 + R2() * 0.28;
      const w = weights(x, z), table = FLORA[w.id];
      let kind = null, acc = 0; for (const [k, p] of table) { acc += p; if (r < acc) { kind = k; break; } }
      if (!kind) continue;
      const h = height(x, z, w);
      if (w.id === 'reef' ? h > -6 : h < WATER + 0.8) continue;
      if (townAt(x, z, 3) || (w.id !== 'jungle' && roadDist(x, z) < 6) || dist(x, z, VOL.x, VOL.z) < 60) continue;
      (lists[kind] = lists[kind] || []).push({ x, y: h - 0.12, z, s: TALL[kind] ? s * 1.15 : s, rot, tint });
      if (TALL[kind]) tall.push({ x, z });
    }
    const meshes = [];
    for (const k in lists) {
      const L = lists[k], im = new THREE.InstancedMesh(PROP[k], VC, L.length);
      L.forEach((t, i) => { dummy.position.set(t.x, t.y, t.z); dummy.rotation.set(0, t.rot, 0); dummy.scale.setScalar(t.s); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); im.setColorAt(i, ic.setScalar(t.tint)); t.im = im; t.i = i; });
      im.frustumCulled = false; scene.add(im); meshes.push(im);
    }
    return { mesh, meshes, lists, tall };
  }
  function dropChunk(ch) { scene.remove(ch.mesh); ch.mesh.geometry.dispose(); for (const m of ch.meshes) { scene.remove(m); m.dispose(); } }
  let lastC = null;
  function stream(px, pz, all) {
    const cx = Math.floor(px / CS), cz = Math.floor(pz / CS), key = cx + ',' + cz;
    if (key !== lastC) {
      lastC = key; queue.length = 0;
      for (const [k, ch] of chunks) { const [x, z] = k.split(',').map(Number); if (Math.abs(x - cx) > VIEW + 1 || Math.abs(z - cz) > VIEW + 1) { dropChunk(ch); chunks.delete(k); } }
      for (let dz = -VIEW; dz <= VIEW; dz++) for (let dx = -VIEW; dx <= VIEW; dx++) if (!chunks.has((cx + dx) + ',' + (cz + dz))) queue.push([cx + dx, cz + dz, dx * dx + dz * dz]);
      queue.sort((a, b2) => b2[2] - a[2]);
    }
    let n = all ? 999 : 1;
    while (n-- > 0 && queue.length) { const [x, z] = queue.pop(); chunks.set(x + ',' + z, makeChunk(x, z)); }
  }
  /* Fights clear the scenery between the camera and the fighters, then put it back. */
  const hidden = [], m4 = new THREE.Matrix4(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  function hideScenery(test) {
    for (const ch of chunks.values()) for (const k in ch.lists) for (const t of ch.lists[k]) if (test(t)) { t.im.getMatrixAt(t.i, m4); hidden.push([t.im, t.i, m4.clone()]); t.im.setMatrixAt(t.i, zero); t.im.instanceMatrix.needsUpdate = true; }
  }
  function showScenery() { for (const [im, i, m] of hidden) { im.setMatrixAt(i, m); im.instanceMatrix.needsUpdate = true; } hidden.length = 0; }
  function blockers(x, z, r) { const out = []; for (const ch of chunks.values()) for (const t of ch.tall) if (dist(t.x, t.z, x, z) < r) out.push(t); return out; }

  const cur = { top: C(PHASES[0].top), hor: C(PHASES[0].hor), fog: C(PHASES[0].fog), sun: C(PHASES[0].sun), sky: C(PHASES[0].sky), gnd: C(PHASES[0].gnd), si: PHASES[0].si, hi: PHASES[0].hi, stars: PHASES[0].stars };
  let target = PHASES[0], under = 0;
  const deep = C(0x1f6f9a), v3 = new THREE.Vector3();
  const apply = () => {
    skyMat.uniforms.top.value.copy(cur.top); skyMat.uniforms.hor.value.copy(cur.hor); stars.material.opacity = cur.stars;
    for (const l of lights) {
      l.fog.color.copy(cur.fog).lerp(deep, under); l.fog.near = lerp(140, 4, under); l.fog.far = lerp(1500, 150, under);
      l.sun.color.copy(cur.sun); l.sun.intensity = cur.si; l.hemi.color.copy(cur.sky).lerp(deep, under * 0.5); l.hemi.groundColor.copy(cur.gnd); l.hemi.intensity = cur.hi;
    }
  };
  return {
    far, map, colliders: [], hideScenery, showScenery, blockers, stream,
    setPhase(p, instant) {
      target = PHASES[clamp(p, 0, 4)]; sparkTo = 0.5 + p * 0.5;
      if (instant) { for (const k of ['top', 'hor', 'fog', 'sun', 'sky', 'gnd']) cur[k].set(target[k]); cur.si = target.si; cur.hi = target.hi; cur.stars = target.stars; sparkA = sparkTo; placeSpark(); apply(); }
    },
    update(dt, t, cam, px, pz, isUnder) {
      const k = Math.min(1, dt * 0.5);
      for (const key of ['top', 'hor', 'fog', 'sun', 'sky', 'gnd']) cur[key].lerp(tc.set(target[key]), k);
      cur.si = lerp(cur.si, target.si, k); cur.hi = lerp(cur.hi, target.hi, k); cur.stars = lerp(cur.stars, target.stars, k);
      if (Math.abs(sparkTo - sparkA) > 0.001) { sparkA = lerp(sparkA, sparkTo, k * 0.6); placeSpark(); }
      under = lerp(under, isUnder ? 1 : 0, Math.min(1, dt * 3));
      apply();
      sky.position.copy(cam.position); stars.position.copy(cam.position);
      water.position.x = px; water.position.z = pz;
      spark.getWorldPosition(v3); v3.sub(cam.position).normalize().multiplyScalar(100);
      for (const l of lights) { l.sun.target.position.copy(cam.position); l.sun.position.copy(cam.position).add(v3); }
      halo.scale.setScalar(1 + Math.sin(t * 1.3) * 0.08);
      lava.material.color.setHSL(0.06 + Math.sin(t * 2) * 0.012, 1, 0.55);
      beam.material.opacity = 0.18 + Math.sin(t * 3) * 0.06;
      const a = moteGeo.attributes.position;
      for (let i = 0; i < MN; i++) {
        let x = a.getX(i), y = a.getY(i) + Math.sin(t * 0.6 + ms[i]) * dt * 0.3, z = a.getZ(i);
        if (x - cam.position.x > 40) x -= 80; else if (x - cam.position.x < -40) x += 80;
        if (z - cam.position.z > 40) z -= 80; else if (z - cam.position.z < -40) z += 80;
        a.setXYZ(i, x, y, z);
      }
      a.needsUpdate = true; motes.position.y = cam.position.y - 6;
      stream(px, pz);
    },
  };
}
