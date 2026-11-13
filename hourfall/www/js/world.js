/* The continent of Meridian: a streamed open world about 7 km across.
   Terrain is generated from maths: rolling regions, mountain ranges with passes, rivers that carve
   valleys down to the sea, a great lake, and a ragged coastline. Near ground loads in chunks around
   the player with Blender-modelled scenery; a coarse copy of the whole continent is always drawn behind. */
import * as THREE from './vendor/three.module.min.js';
import { clamp, lerp, sstep, fbm, rng, dist, TAU, angDiff } from './util.js';
import { Builder, G, VC } from './gfx.js';
import { A, flatGeometry } from './assets.js';

export const WATER = 0, HALF = 3700, EDGE = 3550;

/* Regions, easiest to hardest. Anything outside them is open country ("plains"). */
export const REG = {
  vale: { name: 'Dawnmere Vale', x: -700, z: 950, r: 800, lvl: 1 },
  coast: { name: 'The Salt Coast', x: 800, z: 2550, r: 760, lvl: 6 },
  jungle: { name: 'The Verdance', x: -2150, z: 1400, r: 820, lvl: 10 },
  desert: { name: 'The Glass Wastes', x: 2250, z: 250, r: 900, lvl: 14 },
  crag: { name: 'The Highcrags', x: -1950, z: -750, r: 820, lvl: 18 },
  frost: { name: 'Frostspine', x: 500, z: -2750, r: 860, lvl: 22 },
  heath: { name: 'Galeheath', x: -1550, z: -1950, r: 650, lvl: 26 },
  reef: { name: 'The Drowned Reach', x: 2750, z: 2250, r: 650, lvl: 29 },
  volcano: { name: 'The Cinderdeep', x: 2500, z: -1800, r: 820, lvl: 33 },
};
const RK = Object.keys(REG);

/* Cities (size 2), the castle (3), hamlets (1) and boss arenas (0). Heights are filled in from the land. */
export const TOWNS = [
  { id: 'highmark', name: 'Highmark', x: 300, z: -350, r: 250, size: 3, style: 'crown', reg: 'crown' },
  { id: 'dawnmere', name: 'Dawnmere', x: -760, z: 980, r: 110, size: 2, style: 'vale', reg: 'vale' },
  { id: 'saltcrest', name: 'Saltcrest', x: 950, z: 2420, r: 110, size: 2, style: 'coast', reg: 'coast' },
  { id: 'canopy', name: 'Canopy', x: -2050, z: 1350, r: 105, size: 2, style: 'jungle', reg: 'jungle' },
  { id: 'mirage', name: 'Mirage', x: 2150, z: 250, r: 125, size: 2, style: 'desert', reg: 'desert' },
  { id: 'highcrag', name: 'Highcrag', x: -1850, z: -800, r: 115, size: 2, style: 'crag', reg: 'crag' },
  { id: 'hearthhold', name: 'Hearthhold', x: 450, z: -2600, r: 105, size: 2, style: 'frost', reg: 'frost' },
  { id: 'aerie', name: 'The Aerie', x: -1600, z: -2050, r: 120, size: 2, style: 'sky', reg: 'heath', sky: true },
  { id: 'pearlreach', name: 'Pearlreach', x: 2750, z: 2250, r: 110, size: 2, style: 'reef', reg: 'reef' },
  { id: 'emberdeep', name: 'Emberdeep', x: 2500, z: -1800, r: 125, size: 2, style: 'volcano', reg: 'volcano' },
  { id: 'galefoot', name: 'Galefoot', x: -1350, z: -1640, r: 55, size: 1, style: 'crag', reg: 'heath' },
  { id: 'millbrook', name: 'Millbrook', x: -300, z: 560, r: 55, size: 1, style: 'vale', reg: 'crown' },
  { id: 'threestones', name: 'Three Stones', x: 1150, z: 520, r: 55, size: 1, style: 'vale', reg: 'crown' },
  { id: 'windrest', name: 'Windrest', x: -1200, z: 150, r: 55, size: 1, style: 'vale', reg: 'crown' },
  { id: 'coldwater', name: 'Coldwater', x: -450, z: -1300, r: 55, size: 1, style: 'frost', reg: 'crown' },
  { id: 'ashford', name: 'Ashford', x: 1500, z: -1100, r: 55, size: 1, style: 'volcano', reg: 'crown' },
  { id: 'dunewatch', name: 'Dunewatch', x: 1550, z: 1250, r: 55, size: 1, style: 'desert', reg: 'desert' },
  { id: 'reedhaven', name: 'Reedhaven', x: -1300, z: 2450, r: 55, size: 1, style: 'coast', reg: 'coast' },
  { id: 'lanternfall', name: 'Lanternfall', x: 1350, z: -2250, r: 55, size: 1, style: 'frost', reg: 'frost' },
  { id: 'brightwater', name: 'Brightwater', x: 230, z: 1250, r: 55, size: 1, style: 'vale', reg: 'crown' },
  { id: 'stonebridge', name: 'Stonebridge', x: -900, z: -450, r: 55, size: 1, style: 'crag', reg: 'crown' },
  { id: 'oasis', name: 'Palmspring', x: 2950, z: 850, r: 55, size: 1, style: 'desert', reg: 'desert' },
];
for (const [id, name, x, z, reg] of [['a_vale', 'The Fallow Field', -480, 760, 'vale'], ['a_coast', "Breaker's Cove", 1350, 2560, 'coast'], ['a_jungle', 'Antler Hollow', -2380, 1180, 'jungle'],
  ['a_desert', 'The Sunken Clock', 2550, -60, 'desert'], ['a_crag', "Warden's Stair", -2200, -1080, 'crag'], ['a_frost', "Warden's Crown", 120, -2980, 'frost'],
  ['a_reef', 'The Bell Deep', 2950, 2480, 'reef'], ['a_volcano', 'The Ash Throne', 2000, -1620, 'volcano'], ['a_graves', 'The Quiet Yard', -1000, 760, 'vale']]) TOWNS.push({ id, name, x, z, r: 34, size: 0, style: reg, reg });
export const TOWN = Object.fromEntries(TOWNS.map(t => [t.id, t]));
const ROAD_SEGS = [];
const road = (...ids) => { for (let i = 0; i < ids.length - 1; i++) ROAD_SEGS.push([TOWN[ids[i]], TOWN[ids[i + 1]]]); };
road('dawnmere', 'millbrook', 'highmark', 'ashford', 'emberdeep');
road('dawnmere', 'brightwater', 'saltcrest', 'pearlreach'); road('dawnmere', 'reedhaven', 'canopy');
road('highmark', 'threestones', 'mirage', 'oasis'); road('threestones', 'dunewatch', 'brightwater');
road('highmark', 'stonebridge', 'windrest'); road('stonebridge', 'highcrag'); road('highmark', 'coldwater', 'hearthhold', 'lanternfall', 'ashford');
road('coldwater', 'galefoot'); road('windrest', 'dawnmere');

/* Rivers run from the hills to the lake or the sea. Lakes are discs of water. */
const RIVERS = [
  [[750, -2000], [820, -1200], [850, -500], [700, 300], [560, 850]],
  [[520, 1180], [430, 1700], [560, 2250], [620, 2800], [650, 3300]],
  [[-1500, -400], [-1150, -100], [-900, 300], [-600, 520], [-200, 830], [330, 950]],
  [[-1750, 700], [-1850, 1100], [-1800, 1700], [-2050, 2300], [-2300, 3100]],
  [[1900, -2400], [1700, -2900], [1650, -3400]],
];
export const LAKES = [{ x: 950, z: 2720, r: 190 }, { x: 560, z: 1000, r: 230 }, { x: -2600, z: -300, r: 140 }, { x: 2950, z: 850, r: 40 }];
/* Mountain ranges: ridged peaks along a line, with passes where roads cross. */
const RANGES = [
  { pts: [[-800, -1900], [-200, -1850], [900, -1650], [1900, -1350]], w: 260, h: 230 },
  { pts: [[-1250, -1300], [-1450, -400], [-1350, 500]], w: 230, h: 170 },
  { pts: [[1450, -600], [1750, 300], [1650, 1050]], w: 220, h: 150 },
  { pts: [[-3200, 600], [-2800, 1000]], w: 250, h: 120 },
];
function segDist(x, z, pts) {
  let best = 1e9;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], dx = bx - ax, dz = bz - az, t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    const d = Math.hypot(x - ax - dx * t, z - az - dz * t); if (d < best) best = d;
  }
  return best;
}

/* Floating islands of the Aerie. Bridges join each island to the first. Island 1 sits over the wind-lift. */
export const ISLES = [
  { x: -1600, z: -2050, r: 125, y: 270 }, { x: -1400, z: -1780, r: 34, y: 270 }, { x: -1870, z: -2190, r: 46, y: 270 },
  { x: -1730, z: -1830, r: 40, y: 270 }, { x: -1410, z: -2230, r: 38, y: 270 }, { x: -1800, z: -1950, r: 30, y: 270 },
];
export const LIFT = { x: -1400, z: -1780 };
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
const VOL = REG.volcano, CANYON = Math.atan2(TOWN.ashford.z - VOL.z, TOWN.ashford.x - VOL.x);
export function roadDist(x, z) {
  let best = 1e9;
  for (const [a, b] of ROAD_SEGS) {
    const dx = b.x - a.x, dz = b.z - a.z, t = clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz), 0, 1);
    const d = Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t));
    if (d < best) best = d;
  }
  return best + (fbm(x * 0.03, z * 0.03) - 0.5) * 8;
}
export function riverDist(x, z) { let b = 1e9; for (const r of RIVERS) b = Math.min(b, segDist(x, z, r)); return b; }
function rawHeight(x, z, w) {
  const d0 = Math.hypot(x, z), n1 = fbm(x * 0.004, z * 0.004), n2 = fbm(x * 0.013 + 31, z * 0.013 - 17);
  let h = 9 + (n1 - 0.45) * 46 + (n2 - 0.5) * 12 + (fbm(x * 0.0012 - 4, z * 0.0012 + 9) - 0.5) * 50;
  if (w.vale) h = lerp(h, 6 + (n2 - 0.5) * 8 + (n1 - 0.45) * 18, w.vale);
  if (w.coast) h = lerp(h, 2.6 + (n2 - 0.5) * 4 + sstep(0.62, 0.7, n1) * 24, w.coast);
  if (w.heath) h = lerp(h, 34 + (n1 - 0.45) * 50 + (n2 - 0.5) * 8, w.heath);
  if (w.jungle) { const j = fbm(x * 0.01 - 80, z * 0.01 + 60); h += w.jungle * ((j - 0.5) * 56 - sstep(0.06, 0, Math.abs(j - 0.5)) * 9); }
  if (w.desert) h = lerp(h, 9 + Math.sin(x * 0.021 + n1 * 8) * 5 + Math.sin(z * 0.031 + n2 * 5) * 3 + sstep(0.6, 0.64, n2) * 46, w.desert);
  if (w.frost) h += w.frost * (fbm(x * 0.008 + 50, z * 0.008 + 50) * 90 + 14);
  if (w.crag) {
    const rg = 1 - Math.abs(fbm(x * 0.006 + 9, z * 0.006 - 4) * 2 - 1), raw = rg * rg * 140 + n2 * 18, t = raw / 16, f = Math.floor(t);
    h = lerp(h, 14 + (f + sstep(0.78, 1, t - f)) * 16, w.crag);
  }
  if (w.volcano) {
    const dv = dist(x, z, VOL.x, VOL.z);
    let hv = dv > 230 ? 18 + 300 * sstep(800, 230, dv) + (n2 - 0.5) * 34 * sstep(230, 420, dv) : 90 + sstep(168, 230, dv) * 228;
    const off = Math.abs(angDiff(Math.atan2(z - VOL.z, x - VOL.x), CANYON));
    if (dv > 150 && dv < 760) hv = lerp(hv, Math.min(hv, 90 - sstep(230, 740, dv) * 64), sstep(0.2, 0.09, off * Math.min(1, dv / 300)));
    h = lerp(h, hv, w.volcano);
  }
  /* mountain ranges, eased into passes where the roads go through */
  for (const R of RANGES) {
    const d = segDist(x, z, R.pts); if (d > R.w) continue;
    const ridge = 1 - Math.abs(fbm(x * 0.007 + 3, z * 0.007 - 7) * 2 - 1), rd = roadDist(x, z);
    h += sstep(R.w, R.w * 0.25, d) * (ridge * ridge * R.h + 20) * sstep(40, 220, rd);
  }
  if (w.reef) h = lerp(h, -48 + (n2 - 0.5) * 20 + (n1 - 0.5) * 12, w.reef);
  /* rivers carve broad valleys; the channel itself sits below the water line */
  const rv = riverDist(x, z) + (n2 - 0.5) * 14;
  if (rv < 170) { const bed = -2.6; h = lerp(h, Math.min(h, 3 + rv * 0.06), sstep(170, 40, rv)); h = lerp(h, bed, sstep(16, 7, rv)); }
  for (const L of LAKES) { const d = dist(x, z, L.x, L.z) + (n2 - 0.5) * 30; if (d < L.r + 120) h = lerp(lerp(h, Math.min(h, 2.5), sstep(L.r + 120, L.r, d)), -6 - sstep(L.r, 0, d) * 8, sstep(L.r, L.r - 26, d)); }
  /* the coast: a ragged edge with bays and headlands */
  const edge = 3250 + (fbm(x * 0.0009 + 3, z * 0.0009 + 8) - 0.5) * 900 + (fbm(x * 0.004, z * 0.004 - 20) - 0.5) * 160;
  h -= sstep(edge - 180, edge + 260, d0) * 80 * (1 - (w.reef || 0) * 0.85);
  return h;
}
for (const t of TOWNS) {
  t.h = t.sky ? ISLES[0].y : Math.max(rawHeight(t.x, t.z, weights(t.x, t.z)), t.reg === 'reef' ? -60 : 3);
  if (t.id === 'emberdeep') t.h = 90;
  if (t.id === 'highmark') t.h = Math.max(t.h, 14);
  if (t.id === 'saltcrest') t.h = 2.6;
  /* Highcrag clings to the mountainside: only its square is levelled. */
  t.flat = t.style === 'crag' && t.size === 2 ? 34 : t.id === 'saltcrest' ? 72 : t.r * 1.15;
}
const GROUND_TOWNS = TOWNS.filter(t => !t.sky);
export function height(x, z, w) {
  let h = rawHeight(x, z, w || weights(x, z));
  for (const t of GROUND_TOWNS) {
    const dx = x - t.x, dz = z - t.z, r = t.flat;
    if (dx > r || dx < -r || dz > r || dz < -r) continue;
    const d = Math.hypot(dx, dz);
    if (d < r) h = lerp(h, t.h, 1 - sstep(r * 0.62, r, d));
  }
  /* roads run on causeways over rivers and shallows */
  if (h < WATER + 1 && h > -14) { const rd = roadDist(x, z); if (rd < 7) h = lerp(h, WATER + 1.1, sstep(7, 4, rd)); }
  const dv = dist(x, z, VOL.x, VOL.z);
  if (dv < 44) h = lerp(h, 74, sstep(44, 30, dv));
  return h;
}
export function townAt(x, z, pad = 0) { for (const t of GROUND_TOWNS) if (dist(x, z, t.x, t.z) < t.r + pad) return t; return null; }
export function regionAt(x, z) {
  const w = weights(x, z);
  if (w.id !== 'plains') return { id: w.id, name: REG[w.id].name, lvl: REG[w.id].lvl };
  const d = Math.hypot(x - 300, z + 350);
  return { id: 'plains', name: d < 900 ? 'The Crownlands' : 'The Wide Marches', lvl: clamp(Math.round(2 + d / 330), 3, 11) };
}

const C = h => new THREE.Color(h), tc = new THREE.Color(), tc2 = new THREE.Color();
const col = { grass: C(0x7dbb4c), grass2: C(0x9ccf5a), vale: C(0x8fd05a), sand: C(0xf0dca0), wet: C(0xd9c488), jungle: C(0x2f9a4e), jungle2: C(0x1f7a52),
  desert: C(0xf2cf8a), glass: C(0x9fe6d6), mesa: C(0xd98a55), rock: C(0x8b8c9a), snow: C(0xdfe9f5), heath: C(0xa9b86a), heather: C(0xa898b8),
  ash: C(0x4a4450), lava: C(0xff7a2a), basalt: C(0x2e2a36), sea: C(0xcdbf8a), coral: C(0x6fc0b0), road: C(0xcbb083), cliff: C(0x9a8f88), deep: C(0x3b8fb0), meadow: C(0xb8d86a), peak: C(0xeef3f8) };
export function groundColor(x, z, h, slope, w, out) {
  const n = fbm(x * 0.02, z * 0.02);
  out.copy(col.grass).lerp(col.grass2, n).lerp(col.meadow, sstep(0.6, 0.75, fbm(x * 0.006 + 40, z * 0.006)) * 0.6);
  if (w.vale) out.lerp(tc.copy(col.vale).lerp(col.grass2, n), w.vale);
  if (w.coast) out.lerp(col.sand, w.coast * sstep(20, 8, h));
  if (w.jungle) out.lerp(tc.copy(col.jungle).lerp(col.jungle2, n), w.jungle);
  if (w.heath) out.lerp(tc.copy(col.heath).lerp(col.heather, sstep(0.55, 0.75, n) * 0.6), w.heath);
  if (w.desert) out.lerp(tc.copy(col.desert).lerp(col.glass, sstep(0.6, 0.72, fbm(x * 0.011 + 9, z * 0.011)) * 0.8).lerp(col.mesa, sstep(0.3, 1.2, slope)), w.desert);
  if (w.crag) out.lerp(tc.copy(col.grass).lerp(col.cliff, sstep(0.25, 0.9, slope) * 0.9 + 0.1), w.crag);
  if (w.frost) out.lerp(tc.copy(col.snow).lerp(col.rock, sstep(0.6, 1.3, slope)), w.frost);
  if (w.volcano) out.lerp(tc.copy(col.ash).lerp(col.basalt, n).lerp(col.lava, sstep(0.045, 0.01, Math.abs(fbm(x * 0.012 + 40, z * 0.012 - 40) - 0.5)) * sstep(60, 100, h)), w.volcano);
  if (w.reef) out.lerp(tc.copy(col.sea).lerp(col.coral, n), w.reef);
  if (!w.frost && !w.volcano && !w.desert) out.lerp(col.cliff, sstep(0.75, 1.4, slope) * 0.85);
  if (h > 110 && !w.volcano) out.lerp(col.peak, sstep(110, 170, h) * (1 - sstep(0.9, 1.6, slope) * 0.6) * (1 - (w.crag || 0) * 0.8));
  if (h > WATER + 0.5) { const rd = roadDist(x, z); if (rd < 9) out.lerp(col.road, sstep(9, 4, rd) * 0.85); }
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

/* Cheap stand-ins drawn for scenery further than a chunk away. */
function lowProps() {
  const b = () => new Builder(), P = {};
  P.oak = b().add(G.cyl(0.3, 0.5, 3, 5), 0x7a5234, { y: 1.5 }).add(G.ico(2.6, 0), 0x5fae45, { y: 4.8 }).build();
  P.birch = b().add(G.cyl(0.18, 0.25, 5, 5), 0xf2ece0, { y: 2.5 }).add(G.ico(1.6, 0), 0xa8d05a, { y: 6 }).build();
  P.pine = b().add(G.cyl(0.25, 0.4, 2.4, 5), 0x6a4630, { y: 1.2 }).add(G.cone(2.3, 6, 6), 0x2f7a48, { y: 5.2 }).build();
  P.spine = b().add(G.cyl(0.25, 0.4, 2.4, 5), 0x6a4630, { y: 1.2 }).add(G.cone(2.3, 6, 6), 0x9fb8b8, { y: 5.2 }).build();
  P.palm = b().add(G.cyl(0.2, 0.3, 6.5, 5), 0xb08a5a, { y: 3.2 }).add(G.cone(2.6, 1, 6), 0x4fae4a, { y: 6.6 }).build();
  P.jtree = b().add(G.cyl(0.6, 0.9, 10, 5), 0x5a4030, { y: 5 }).add(G.cyl(3.6, 2.4, 2.6, 7), 0x2f8f4a, { y: 11 }).build();
  P.cactus = b().add(G.cyl(0.45, 0.45, 3.6, 5), 0x4f9a58, { y: 1.8 }).build();
  P.dead = b().add(G.cyl(0.15, 0.3, 3.6, 4), 0x5a4a44, { y: 1.8 }).build();
  P.shard = b().add(G.cone(0.7, 3.4, 5), 0x9ff0e0, { y: 1.7 }).build();
  P.ice = b().add(G.cone(0.8, 4, 5), 0xbfe6ff, { y: 2 }).build();
  P.basalt = b().add(G.cyl(0.8, 0.9, 3, 6), 0x2e2a36, { y: 1.5 }).build();
  P.rock = b().add(G.ico(1, 0), 0x8f8e98, { y: 0.4, sy: 0.7 }).build();
  P.boulder = b().add(G.ico(2.6, 0), 0x8b8a96, { y: 1.2, sy: 0.75 }).build();
  P.cliffrock = b().add(G.cyl(3, 4, 9, 6), 0x9a8f88, { y: 4.5 }).build();
  P.shroom = b().add(G.cyl(0.3, 0.4, 2.4, 5), 0xf2ead8, { y: 1.2 }).add(G.cone(1.6, 1, 7), 0xe0508a, { y: 2.6 }).build();
  P.coral = b().add(G.cyl(0.2, 0.3, 2, 5), 0xff7a8a, { y: 1 }).build();
  P.kelp = b().add(G.box(0.4, 7, 0.1), 0x3f9a6a, { y: 3.5 }).build();
  P.bush = b().add(G.ico(1, 0), 0x58a848, { y: 0.55, sy: 0.75 }).build();
  P.lavarock = b().add(G.ico(1.4, 0), 0x2e2a36, { y: 0.6, sy: 0.6 }).build();
  return P;
}
/* What grows where: [model, chance] per placement attempt. Kinds marked * are only drawn close up. */
const FLORA = {
  plains: [['oak', 0.07], ['birch', 0.03], ['bush', 0.06], ['rock', 0.03], ['boulder', 0.01], ['tuft', 0.24], ['flower', 0.08], ['stump', 0.01], ['log', 0.01]],
  vale: [['oak', 0.06], ['birch', 0.04], ['bush', 0.06], ['tuft', 0.28], ['flower', 0.18], ['rock', 0.02], ['stump', 0.01]],
  coast: [['palm', 0.12], ['rock', 0.04], ['tuft', 0.08], ['bush', 0.03], ['reeds', 0.03]],
  jungle: [['jtree', 0.28], ['bush', 0.16], ['fern', 0.22], ['shroom', 0.05], ['flower', 0.08], ['log', 0.03], ['rock', 0.02]],
  desert: [['cactus', 0.06], ['shard', 0.05], ['rock', 0.05], ['boulder', 0.01], ['dead', 0.02]],
  crag: [['pine', 0.12], ['rock', 0.12], ['boulder', 0.03], ['cliffrock', 0.015], ['tuft', 0.08]],
  frost: [['spine', 0.16], ['rock', 0.05], ['ice', 0.05], ['boulder', 0.01]],
  heath: [['rock', 0.07], ['boulder', 0.02], ['tuft', 0.3], ['bush', 0.05], ['dead', 0.03], ['flower', 0.06]],
  reef: [['coral', 0.22], ['kelp', 0.2], ['rock', 0.07]],
  volcano: [['basalt', 0.12], ['lavarock', 0.06], ['dead', 0.04], ['rock', 0.06]],
};
const NEAR_ONLY = { tuft: 1, flower: 1, fern: 1, reeds: 1, log: 1, stump: 1 };
const TALL = { oak: 1, birch: 1, pine: 1, spine: 1, palm: 1, jtree: 1, cactus: 1, shard: 1, ice: 1, basalt: 1, shroom: 1, dead: 1, coral: 1, kelp: 1, boulder: 1, cliffrock: 1 };

const CS = 128, CN = 32, VIEW = 3;
export function buildWorld(scene) {
  const far = new THREE.Scene();
  const LO = lowProps(), HI = {};
  const hi = k => HI[k] || (HI[k] = flatGeometry('P.' + k));

  /* ---- distant copy of the whole continent ---- */
  const FN = 148, fgeo = new THREE.PlaneGeometry(HALF * 2, HALF * 2, FN, FN); fgeo.rotateX(-Math.PI / 2);
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
  const water = new THREE.Mesh(new THREE.CircleGeometry(700, 48).rotateX(-Math.PI / 2), new THREE.MeshToonMaterial({ color: 0x4fb4d8, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  water.position.y = WATER; scene.add(water);
  const lava = new THREE.Mesh(new THREE.CircleGeometry(46, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff8a2a })); lava.position.set(VOL.x, 86.5, VOL.z); scene.add(lava);
  const lavaLight = new THREE.PointLight(0xff6a20, 4000, 260); lavaLight.position.set(VOL.x, 110, VOL.z); scene.add(lavaLight);

  /* ---- floating islands ---- */
  const ib = new Builder();
  for (const i of ISLES) {
    ib.add(G.cyl(i.r, i.r * 0.92, 5, 26), 0x8fd05a, { x: i.x, y: i.y - 2.5, z: i.z }).add(G.cone(i.r * 0.93, i.r * 1.1, 10), 0x8a7a6a, { x: i.x, y: i.y - 5 - i.r * 0.55, z: i.z, rx: Math.PI })
      .add(G.cone(i.r * 0.4, i.r * 0.9, 7), 0x7a6a5c, { x: i.x + i.r * 0.4, y: i.y - 5 - i.r * 0.45, z: i.z + i.r * 0.2, rx: Math.PI });
    for (let k = 0; k < 4; k++) ib.add(G.cone(i.r * 0.12, i.r * 0.5, 6), 0x9fe6d6, { x: i.x + Math.cos(k * 1.6) * i.r * 0.5, y: i.y - 8 - i.r * 0.3, z: i.z + Math.sin(k * 1.6) * i.r * 0.5, rx: Math.PI });
  }
  for (let k = 1; k < ISLES.length; k++) {
    const a = ISLES[0], b2 = ISLES[k], dx = b2.x - a.x, dz = b2.z - a.z, l = Math.hypot(dx, dz), ry = Math.atan2(dx, dz);
    ib.add(G.box(7, 0.6, l), 0xf4ecd8, { x: (a.x + b2.x) / 2, y: a.y - 0.3, z: (a.z + b2.z) / 2, ry });
    for (const s of [-3.6, 3.6]) ib.add(G.box(0.3, 1.2, l), 0xe0b85a, { x: (a.x + b2.x) / 2 + Math.cos(ry) * s, y: a.y + 0.5, z: (a.z + b2.z) / 2 - Math.sin(ry) * s, ry });
  }
  const isles = ib.mesh(); isles.frustumCulled = false; scene.add(isles);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 270, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xbff4ff, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.set(LIFT.x, height(LIFT.x, LIFT.z) + 135, LIFT.z); scene.add(beam);

  /* ---- the Great Dial, hanging over the castle and visible from the whole continent ---- */
  const dialMat = new THREE.MeshBasicMaterial({ color: 0xf2d9a0, fog: false });
  const dial = new THREE.Mesh(new THREE.TorusGeometry(1100, 13, 6, 120), dialMat);
  dial.position.set(TOWN.highmark.x, 900, TOWN.highmark.z); dial.rotation.set(-1.25, 0, 0.14); far.add(dial);
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
  const cb = new Builder();
  for (let i = 0; i < 52; i++) { const a = R() * TAU, d = 500 + R() * 3600, x = Math.cos(a) * d, z = Math.sin(a) * d, y = 420 + R() * 260, s = 40 + R() * 70; for (let k = 0; k < 4; k++) cb.add(G.ico(1, 1), 0xffffff, { x: x + (k - 1.5) * s * 0.8, y: y + (k % 2) * s * 0.2, z: z + (R() - 0.5) * s, sx: s, sy: s * 0.42, sz: s * 0.8 }); }
  far.add(new THREE.Mesh(cb.build(), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, fog: false })));

  const lights = [scene, far].map(s => { const sun = new THREE.DirectionalLight(0xffffff, 2); s.add(sun); s.add(sun.target); const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1); s.add(hemi); s.fog = new THREE.Fog(0xffffff, 160, 1700); return { sun, hemi, fog: s.fog }; });

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
    for (let a = 0; a < 80; a++) {
      const x = x0 + R2() * CS, z = z0 + R2() * CS, r = R2(), s = 0.8 + R2() * 0.7, rot = R2() * TAU, tint = 0.86 + R2() * 0.28;
      const w = weights(x, z);
      /* woods: patches where trees grow thick, clearings between */
      const wood = w.id === 'plains' || w.id === 'vale' ? sstep(0.52, 0.66, fbm(x * 0.0035 + 11, z * 0.0035 - 5)) : 0;
      let kind = null, acc = 0;
      if (wood && R2() < wood * 0.55) kind = R2() < 0.6 ? 'oak' : R2() < 0.5 ? 'birch' : 'pine';
      else for (const [k, p] of FLORA[w.id]) { acc += p; if (r < acc) { kind = k; break; } }
      if (!kind) continue;
      const h = height(x, z, w);
      if (w.id === 'reef' ? h > -6 : h < WATER + 0.8) continue;
      if (townAt(x, z, 3) || (w.id !== 'jungle' && roadDist(x, z) < 6) || dist(x, z, VOL.x, VOL.z) < 60) continue;
      if (kind !== 'reeds' && w.id !== 'reef' && h < WATER + 3 && R2() < 0.4 && riverDist(x, z) < 40) kind = 'reeds';
      (lists[kind] = lists[kind] || []).push({ x, y: h - 0.12, z, s: TALL[kind] ? s * 1.15 : s, rot, tint });
      if (TALL[kind]) tall.push({ x, z });
    }
    const meshes = { hi: [], lo: [] };
    for (const k in lists) {
      const L = lists[k];
      for (const lod of NEAR_ONLY[k] ? ['hi'] : ['hi', 'lo']) {
        const im = new THREE.InstancedMesh(lod === 'hi' ? hi(k) : LO[k], VC, L.length);
        L.forEach((t, i) => { dummy.position.set(t.x, t.y, t.z); dummy.rotation.set(0, t.rot, 0); dummy.scale.setScalar(t.s); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); im.setColorAt(i, ic.setScalar(t.tint)); (t.im = t.im || {})[lod] = im; t.i = i; });
        im.frustumCulled = false; scene.add(im); meshes[lod].push(im);
      }
    }
    return { mesh, meshes, lists, tall, cx, cz };
  }
  function dropChunk(ch) { scene.remove(ch.mesh); ch.mesh.geometry.dispose(); for (const m of [...ch.meshes.hi, ...ch.meshes.lo]) { scene.remove(m); m.dispose(); } }
  let lastC = null;
  function lod(pcx, pcz) {
    for (const ch of chunks.values()) {
      const near = Math.max(Math.abs(ch.cx - pcx), Math.abs(ch.cz - pcz)) <= 1;
      for (const m of ch.meshes.hi) m.visible = near;
      for (const m of ch.meshes.lo) m.visible = !near;
    }
  }
  function stream(px, pz, all) {
    const cx = Math.floor(px / CS), cz = Math.floor(pz / CS), key = cx + ',' + cz;
    if (key !== lastC) {
      lastC = key; queue.length = 0;
      for (const [k, ch] of chunks) { const [x, z] = k.split(',').map(Number); if (Math.abs(x - cx) > VIEW + 1 || Math.abs(z - cz) > VIEW + 1) { dropChunk(ch); chunks.delete(k); } }
      for (let dz = -VIEW; dz <= VIEW; dz++) for (let dx = -VIEW; dx <= VIEW; dx++) if (!chunks.has((cx + dx) + ',' + (cz + dz))) queue.push([cx + dx, cz + dz, dx * dx + dz * dz]);
      queue.sort((a, b2) => b2[2] - a[2]);
      lod(cx, cz);
    }
    let n = all ? 999 : 1;
    while (n-- > 0 && queue.length) { const [x, z] = queue.pop(); chunks.set(x + ',' + z, makeChunk(x, z)); lod(cx, cz); }
  }
  /* Fights clear the scenery between the camera and the fighters, then put it back. */
  const hidden = [], m4 = new THREE.Matrix4(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  function hideScenery(test) {
    for (const ch of chunks.values()) for (const k in ch.lists) for (const t of ch.lists[k]) if (test(t)) for (const im of Object.values(t.im)) { im.getMatrixAt(t.i, m4); hidden.push([im, t.i, m4.clone()]); im.setMatrixAt(t.i, zero); im.instanceMatrix.needsUpdate = true; }
  }
  function showScenery() { for (const [im, i, m] of hidden) { im.setMatrixAt(i, m); im.instanceMatrix.needsUpdate = true; } hidden.length = 0; }
  function blockers(x, z, r) { const out = []; for (const ch of chunks.values()) for (const t of ch.tall) if (dist(t.x, t.z, x, z) < r) out.push(t); return out; }

  const cur = { top: C(PHASES[0].top), hor: C(PHASES[0].hor), fog: C(PHASES[0].fog), sun: C(PHASES[0].sun), sky: C(PHASES[0].sky), gnd: C(PHASES[0].gnd), si: PHASES[0].si, hi: PHASES[0].hi, stars: PHASES[0].stars };
  let target = PHASES[0], under = 0;
  const deep = C(0x1f6f9a), v3 = new THREE.Vector3();
  const apply = () => {
    skyMat.uniforms.top.value.copy(cur.top); skyMat.uniforms.hor.value.copy(cur.hor); stars.material.opacity = cur.stars;
    for (const l of lights) {
      l.fog.color.copy(cur.fog).lerp(deep, under); l.fog.near = lerp(160, 4, under); l.fog.far = lerp(1700, 150, under);
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
