/* Builds every settlement: one merged mesh per town, in that region's own architecture. */
import { rng, TAU, dist } from './util.js';
import { Builder, G } from './gfx.js';
import { height } from './world.js';

export const plazaR = t => (t.size === 3 ? 46 : t.id === 'emberdeep' ? 58 : t.size === 2 ? 24 : 13);
/* Position inside a town: degrees clockwise from north, and distance from the centre. */
export function polar(t, deg, r) { const a = deg * Math.PI / 180; return [t.x + Math.sin(a) * r, t.z - Math.cos(a) * r]; }

const WIN = 0xffe08a, DOOR = 0x4a3324;
const pick = (R, a) => a[Math.floor(R() * a.length)];
const HOUSE = {
  vale(b, R) {
    const wall = pick(R, [0xf2e6c8, 0xe6d8b8, 0xf6ecd6]), roof = pick(R, [0xd9b45a, 0xc89a4a, 0xb8763a]);
    b.add(G.box(7, 3.6, 6), wall, { y: 1.8 }).add(G.box(7.2, 0.3, 6.2), 0x7a5234, { y: 3.5 }).add(G.cone(5.7, 3.2, 4), roof, { y: 5.2, ry: Math.PI / 4, sz: 0.9 })
      .add(G.box(1.3, 2.2, 0.2), DOOR, { y: 1.1, z: 3.02 }).add(G.box(1, 1, 0.2), WIN, { x: -2.2, y: 2.2, z: 3.02 }).add(G.box(1, 1, 0.2), WIN, { x: 2.2, y: 2.2, z: 3.02 }).add(G.box(0.8, 2.2, 0.8), 0x9a8f88, { x: 2, y: 5.6, z: -1 });
  },
  crown(b, R) {
    const roof = pick(R, [0x3d5fb0, 0x4a6ac0, 0x8a3a55, 0x3a7a8a]), tall = 5.4 + R() * 2.4;
    b.add(G.box(6.6, tall, 6), 0xe6e0d6, { y: tall / 2 }).add(G.box(6.8, 0.35, 6.2), 0x5a4030, { y: tall * 0.5 }).add(G.box(6.8, 0.35, 6.2), 0x5a4030, { y: tall - 0.2 })
      .add(G.cone(5.5, 4.2, 4), roof, { y: tall + 2.1, ry: Math.PI / 4, sz: 0.9 }).add(G.box(1.4, 2.4, 0.2), DOOR, { y: 1.2, z: 3.02 });
    for (const x of [-2, 2]) for (const y of [2.4, tall - 1.4]) b.add(G.box(1, 1.2, 0.2), WIN, { x, y, z: 3.02 });
    if (R() < 0.4) b.add(G.cyl(1.3, 1.3, tall + 3, 10), 0xd6d0c6, { x: 3.4, y: (tall + 3) / 2, z: -2.4 }).add(G.cone(1.7, 2.6, 10), roof, { x: 3.4, y: tall + 4.3, z: -2.4 });
  },
  coast(b, R) {
    const wall = pick(R, [0xff9a8a, 0x7fe0d0, 0xffe08a, 0x9ad0ff, 0xffb0d0]);
    for (const x of [-2.6, 2.6]) for (const z of [-2.2, 2.2]) b.add(G.cyl(0.2, 0.2, 1.8, 6), 0x8a6a4a, { x, y: 0.9, z });
    b.add(G.box(6.4, 0.3, 5.6), 0xb08a5a, { y: 1.8 }).add(G.box(5.6, 2.8, 4.6), wall, { y: 3.3 }).add(G.box(7.2, 0.35, 6.2), 0xd9c07a, { y: 5, rz: 0.14 })
      .add(G.box(1.2, 2, 0.2), DOOR, { y: 2.9, z: 2.32 }).add(G.box(1, 0.9, 0.2), 0xffffff, { x: 1.9, y: 3.5, z: 2.32 }).add(G.box(1.6, 0.2, 2.4), 0xb08a5a, { y: 0.9, z: 3.6, rx: 0.75 })
      .add(G.cap(0.42, 2.4), pick(R, [0xff5a5a, 0x3fc0c0, 0xffd24a, 0xffffff]), { x: -3.4, y: 1.9, z: 2.6, rz: 0.2, sz: 0.2 });
  },
  jungle(b, R) {
    for (let i = 0; i < 4; i++) b.add(G.cyl(0.22, 0.26, 2.4, 6), 0x5a4030, { x: Math.cos(i * 1.57 + 0.8) * 2.6, y: 1.2, z: Math.sin(i * 1.57 + 0.8) * 2.6 });
    b.add(G.cyl(3.8, 3.8, 0.3, 12), 0x8a6a4a, { y: 2.4 }).add(G.cyl(3, 3, 2.6, 12), 0xa8824a, { y: 3.8 }).add(G.cone(4.6, 3.8, 12), pick(R, [0x3f9a4a, 0x4fae4a, 0x2f8a52]), { y: 7 })
      .add(G.box(1.2, 2, 0.2), DOOR, { y: 3.5, z: 2.96 }).add(G.box(0.8, 2.6, 0.12), 0x7a5234, { y: 1.2, z: 3.9, rx: -0.35 }).add(G.sph(0.3, 8, 6), 0xffb040, { x: 2.2, y: 4.6, z: 2.4 });
  },
  desert(b, R) {
    const wall = pick(R, [0xf0d8a8, 0xe6c890, 0xf6e4c0]);
    b.add(G.box(7, 4, 6), wall, { y: 2 }).add(G.box(7.3, 0.5, 6.3), 0xd0a870, { y: 4.2 }).add(G.box(1.3, 2.4, 0.2), 0x3a2a24, { y: 1.2, z: 3.02 }).add(G.box(0.8, 1, 0.2), 0x3a2a24, { x: 2.2, y: 2.6, z: 3.02 })
      .add(G.box(3.2, 0.12, 1.8), pick(R, [0xc8443a, 0x3fa8a0, 0xe0a030, 0x6a5ab0]), { x: -1, y: 3, z: 3.8, rx: 0.3 });
    if (R() < 0.5) b.add(G.dome(2.3, 14), pick(R, [0xffffff, 0x3fa8a0, 0xe0b85a]), { y: 4.3, x: 1 });
  },
  crag(b, R) {
    const tall = 8 + R() * 3;
    b.add(G.box(4.8, tall, 4.8), 0xa49a94, { y: tall / 2 }).add(G.box(5, 0.4, 5), 0x7a706a, { y: tall * 0.55 }).add(G.cone(4, 3.6, 4), 0x4a5a6a, { y: tall + 1.8, ry: Math.PI / 4 })
      .add(G.box(5.6, 0.3, 1.5), 0x7a5234, { y: tall * 0.55, z: 2.8 }).add(G.box(1.2, 2.2, 0.2), DOOR, { y: 1.1, z: 2.42 }).add(G.box(0.9, 1.1, 0.2), WIN, { y: tall * 0.55 + 1.4, z: 2.42 }).add(G.box(0.9, 1.1, 0.2), WIN, { y: tall - 1.4, z: 2.42 });
  },
  frost(b, R) {
    if (R() < 0.5) b.add(G.dome(3.6, 16), 0xf2f7fc, { sy: 0.85 }).add(G.cyl(1.2, 1.2, 2, 10), 0xe0eaf4, { y: 0.9, z: 3.6, rx: Math.PI / 2 }).add(G.cyl(0.9, 0.9, 0.1, 10), 0x3a3a48, { y: 0.9, z: 4.62, rx: Math.PI / 2 });
    else b.add(G.cyl(3.4, 3.6, 2.6, 14), pick(R, [0xb08a6a, 0x9a7a5a, 0xc0a080]), { y: 1.3 }).add(G.cone(3.9, 2, 14), 0x8a6a4a, { y: 3.6 }).add(G.tor(3.5, 0.2, 18), 0xf4f0e6, { y: 2.6, rx: Math.PI / 2 }).add(G.box(1.3, 2, 0.3), 0x5a4030, { y: 1, z: 3.5 }).add(G.cyl(0.3, 0.3, 0.6, 6), 0x5a5a66, { y: 4.7 });
  },
  sky(b, R) {
    b.add(G.cyl(1.9, 2.7, 8, 12), 0xfaf6ee, { y: 4 }).add(G.cone(2.5, 3.8, 12), 0xe0b85a, { y: 9.9 }).add(G.tor(3.3, 0.13, 22), 0xe0b85a, { y: 6.4, rx: Math.PI / 2 }).add(G.ico(0.5, 0), 0x9fe6ff, { y: 12.8 })
      .add(G.box(1.2, 2.3, 0.3), 0x6a8ad0, { y: 1.15, z: 2.6 }).add(G.box(0.8, 1.2, 0.3), 0x9fe6ff, { y: 5, z: 2.2 });
  },
  volcano(b, R) {
    b.add(G.box(7, 4.4, 6), 0x3a3644, { y: 2.2 }).add(G.box(7.4, 0.5, 6.4), 0x2a2630, { y: 4.6 }).add(G.box(1.3, 2.3, 0.2), 0x1c1a22, { y: 1.15, z: 3.02 }).add(G.box(1, 1, 0.2), 0xff8a3a, { x: -2.2, y: 2.4, z: 3.02 }).add(G.box(1, 1, 0.2), 0xff8a3a, { x: 2.2, y: 2.4, z: 3.02 })
      .add(G.cyl(0.5, 0.6, 4, 8), 0x5a5460, { x: 2.2, y: 6.6, z: -1.4 }).add(G.cyl(0.4, 0.4, 0.2, 8), 0xff7a2a, { x: 2.2, y: 8.7, z: -1.4 });
  },
  reef(b, R) {
    const c = pick(R, [0xffb0c8, 0x9fe6d6, 0xf2e0a0, 0xc0b0ff]);
    b.add(G.dome(3.6, 16), c, { sy: 0.95 }).add(G.tor(2.2, 0.3, 18), 0xffffff, { y: 2.3, rx: Math.PI / 2 }).add(G.sph(0.6, 10, 8), 0xfff6f0, { y: 3.6 }).add(G.cyl(1, 1, 0.2, 12), 0x2a3a5a, { y: 1.1, z: 3.45, rx: Math.PI / 2 })
      .add(G.cone(0.5, 3.4, 6), 0xff7a8a, { x: 3.6, y: 1.7, z: -1 }).add(G.cone(0.4, 2.4, 6), 0xff9aa4, { x: 4.2, y: 1.2, z: 0.2 });
  },
};
function stall(b, R) {
  const c = pick(R, [0xc8443a, 0x3d5fb0, 0xe0a030, 0x4f9a4a, 0x8a4ab8, 0x3fa8a0]);
  for (const x of [-1.4, 1.4]) for (const z of [-0.8, 0.8]) b.add(G.cyl(0.08, 0.08, 2.6, 5), 0x7a5234, { x, y: 1.3, z });
  b.add(G.box(3, 0.9, 1.2), 0x9a7a4a, { y: 0.45, z: 0.5 }).add(G.box(3.4, 0.12, 2.2), c, { y: 2.7, rx: 0.16 }).add(G.box(3.4, 0.12, 0.5), 0xffffff, { y: 2.5, z: 1.25, rx: 0.16 });
  for (let i = 0; i < 4; i++) b.add(G.sph(0.2, 6, 5), pick(R, [0xff5a5a, 0xffd24a, 0x7fd05a, 0xff9a3c, 0xb48aff]), { x: -1 + i * 0.66, y: 1.05, z: 0.5 });
}
const lamp = b => b.add(G.cyl(0.08, 0.12, 3.2, 6), 0x3a3a48, { y: 1.6 }).add(G.sph(0.3, 8, 6), 0xffe08a, { y: 3.4 });
const banner = (b, c) => b.add(G.cyl(0.08, 0.08, 6, 5), 0x7a5234, { y: 3 }).add(G.box(1.4, 2.2, 0.06), c, { x: 0.75, y: 4.7 });
function fountain(b, big) {
  const s = big ? 1.8 : 1;
  b.add(G.cyl(3.4 * s, 3.6 * s, 0.9, 18), 0xb8b4c0, { y: 0.45 }).add(G.cyl(3 * s, 3 * s, 0.2, 18), 0x5fc4e6, { y: 0.9 }).add(G.cyl(0.5 * s, 0.7 * s, 3, 10), 0xb8b4c0, { y: 1.5 }).add(G.cyl(1.4 * s, 0.4 * s, 0.4, 14), 0xb8b4c0, { y: 3 }).add(G.tor(1.1 * s, 0.1, 20), 0xd9b45a, { y: 4.4 * (big ? 1.3 : 1) }).add(G.sph(0.24, 8, 6), 0xffe08a, { x: 1.1 * s, y: 4.4 * (big ? 1.3 : 1) });
}

/* One landmark per city: the thing that makes the place worth coming back to. */
const FEATURE = {
  dawnmere(b) { b.add(G.cyl(2.6, 3.4, 9, 10), 0xf2e6c8, { y: 4.5 }).add(G.cone(3.2, 3, 10), 0xb8763a, { y: 10.5 }); for (let i = 0; i < 4; i++) b.add(G.box(0.5, 7, 0.12), 0xf6ecd6, { y: 8, z: 3, rz: i * 1.57 + 0.4, x: Math.sin(-i * 1.57 - 0.4) * 3.2, sy: 1 }); b.add(G.box(1.3, 2.2, 0.2), DOOR, { y: 1.1, z: 3.2 }); return 4.5; },
  saltcrest(b) { b.add(G.box(9, 3.4, 6), 0x7fe0d0, { y: 2.6 }).add(G.box(10.6, 0.4, 7.6), 0xd9c07a, { y: 4.6, rz: 0.08 }).add(G.box(9.4, 0.4, 6.4), 0xb08a5a, { y: 0.8 }); for (let i = 0; i < 6; i++) b.add(G.cap(0.45, 2.6), [0xff5a5a, 0xffd24a, 0x3fc0c0, 0xffffff, 0xff8ab0, 0x5ad07a][i], { x: -4.5 + i * 1.8, y: 2.4, z: 4, rx: -0.2, sz: 0.2 }); b.add(G.box(3, 0.3, 24), 0xb08a5a, { x: 8, y: 0.9, z: -8 }); return 6.5; },
  canopy(b) { b.add(G.cyl(4, 6, 26, 12), 0x5a4030, { y: 13 }).add(G.cyl(16, 9, 5, 14), 0x2f8f4a, { y: 27 }).add(G.cyl(11, 15, 4, 14), 0x3fa858, { y: 31 }).add(G.cyl(4, 10, 3.6, 14), 0x56bf62, { y: 34.6 }).add(G.box(2, 3, 0.4), 0x2a1c14, { y: 1.5, z: 5.8 }).add(G.cyl(7, 7, 0.4, 14), 0x8a6a4a, { y: 8 }); for (let i = 0; i < 5; i++) b.add(G.sph(0.4, 8, 6), 0xffb040, { x: Math.cos(i * 1.26) * 6.6, y: 9, z: Math.sin(i * 1.26) * 6.6 }); return 7; },
  mirage(b) { b.add(G.cyl(12, 12, 6, 20), 0xf6e4c0, { y: 3 }).add(G.dome(11, 20), 0xe0b03a, { y: 6 }).add(G.tor(12.4, 0.5, 30), 0xff5aa0, { y: 6.2, rx: Math.PI / 2 }).add(G.tor(8, 0.4, 26), 0x5af0e0, { y: 13.6, rx: Math.PI / 2 }).add(G.sph(1.4, 10, 8), 0xff5aa0, { y: 18 }).add(G.box(4, 4.6, 0.6), 0x3a1c34, { y: 2.3, z: 11.9 }); for (const x of [-4, 4]) b.add(G.cyl(0.7, 0.8, 7, 10), 0xffffff, { x, y: 3.5, z: 12.4 }).add(G.sph(0.9, 10, 8), 0xffe08a, { x, y: 7.6, z: 12.4 }); return 13; },
  highcrag(b) { b.add(G.box(9, 6, 7), 0xa49a94, { y: 3 }).add(G.cone(7.4, 4, 4), 0x4a5a6a, { y: 8, ry: Math.PI / 4, sz: 0.85 }).add(G.cyl(1.6, 2.2, 16, 10), 0x8a807a, { x: 5.6, y: 8 }).add(G.sph(1.3, 10, 8), 0xffb040, { x: 5.6, y: 17 }).add(G.box(2, 3, 0.3), DOOR, { y: 1.5, z: 3.6 }).add(G.box(3, 2.2, 0.3), 0xe6d8b8, { x: -2.6, y: 2.6, z: 3.7 }); return 7; },
  hearthhold(b) { b.add(G.box(10, 5, 8), 0x8a7a6a, { y: 2.5 }).add(G.cone(8, 3.4, 4), 0x6a5a4a, { y: 6.7, ry: Math.PI / 4, sz: 0.85 }).add(G.cyl(1.6, 2, 11, 10), 0x5a5a66, { x: -3.4, y: 5.5, z: -2 }).add(G.cyl(1.3, 1.3, 0.3, 10), 0xff7a2a, { x: -3.4, y: 11.1, z: -2 }).add(G.box(3, 3, 0.4), 0xff8a3a, { y: 1.5, z: 4.1 }).add(G.box(1.6, 0.9, 1), 0x3a3a48, { x: 3.6, y: 0.45, z: 5.6 }); return 7; },
  aerie(b) { b.add(G.cyl(6, 7, 7, 16), 0xfaf6ee, { y: 3.5 }).add(G.dome(6, 18), 0x6a8ad0, { y: 7 }).add(G.cyl(0.6, 0.9, 8, 8), 0xe0b85a, { x: 2, y: 11.6, z: 1, rz: -0.7 }).add(G.tor(7.6, 0.16, 28), 0xe0b85a, { y: 9, rx: 1.2 }).add(G.box(2, 3, 0.4), 0x3a4a7a, { y: 1.5, z: 6.6 }); return 8; },
  pearlreach(b) { b.add(G.dome(8, 18), 0xffd0e0, { sy: 0.5 }).add(G.dome(8, 18), 0xfff0f6, { y: 2.6, sy: 0.6, rx: -0.75, z: -3 }).add(G.sph(2.2, 14, 10), 0xfffafa, { y: 2.6 }).add(G.cone(0.9, 6, 6), 0xff7a8a, { x: 9, y: 3 }).add(G.cone(0.7, 4.4, 6), 0x9fe6d6, { x: -9, y: 2.2 }); return 9; },
  emberdeep(b) { for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; b.add(G.cyl(1.2, 1.5, 8 + (i % 3) * 2, 6), 0x2e2a36, { x: Math.cos(a) * 9, y: 4, z: Math.sin(a) * 9 }).add(G.sph(0.6, 8, 6), 0xff8a3a, { x: Math.cos(a) * 9, y: 9.4 + (i % 3) * 1, z: Math.sin(a) * 9 }); } b.add(G.cyl(8, 8.4, 0.5, 18), 0x4a4450, { y: 0.25 }); return 0; },
};

export function buildTown(t) {
  const R = rng(t.x * 31 + t.z * 17 + 5), b = new Builder(), col = [], P = plazaR(t);
  const hAt = (x, z) => (t.sky ? t.h : height(x, z));
  const put = (x, z, ry, s, fn, r) => { b.at(x, hAt(x, z) - 0.15, z, ry, s); fn(b, R); if (r) col.push({ x, z, r }); };
  const face = (x, z) => Math.atan2(t.x - x, t.z - z);
  /* houses in rings, leaving four streets and the landmark's plot clear */
  const rings = t.size === 3 ? [[P + 22, 16, 1.25], [P + 46, 24, 1.2], [P + 70, 30, 1.15], [P + 94, 36, 1.1], [P + 118, 40, 1.05]] : t.size === 2 ? [[P + 13, 9, 1], [P + 30, 14, 1], [P + 47, 18, 0.95]] : [[P + 9, 7, 0.95]];
  rings.forEach(([rad, n, s], ri) => {
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5 * (ri % 2)) / n * TAU + (R() - 0.5) * 0.08, near = Math.abs(((a + TAU / 8) % (TAU / 4)) - TAU / 8);
      if (t.size > 1 && near * rad < 6.5) continue;
      const rr = rad + (R() - 0.5) * 4, x = t.x + Math.sin(a) * rr, z = t.z - Math.cos(a) * rr;
      if (FEATURE[t.id] && dist(x, z, t.x, t.z - P - 15) < 17) continue;
      if (t.id === 'highmark' && (dist(x, z, 0, -P - 44) < 50 || dist(x, z, P + 40, 0) < 26)) continue;
      put(x, z, face(x, z), s * (0.9 + R() * 0.25), HOUSE[t.style], 4.4 * s);
    }
  });
  /* plaza */
  if (t.id !== 'emberdeep') { put(t.x, t.z, 0, 1, bb => fountain(bb, t.size === 3), t.size === 3 ? 7 : 4); }
  const stalls = t.size === 3 ? 16 : t.size === 2 ? 8 : 2;
  for (let i = 0; i < stalls; i++) { const [x, z] = polar(t, (i + 0.5) * 360 / stalls, P + 2); put(x, z, face(x, z), 1, stall, 1.8); }
  for (let i = 0; i < (t.size === 3 ? 12 : t.size === 2 ? 6 : 3); i++) { const [x, z] = polar(t, i * 360 / (t.size === 3 ? 12 : t.size === 2 ? 6 : 3) + 14, P * 0.62); put(x, z, 0, 1, lamp); }
  const flag = { crown: 0x3d5fb0, vale: 0x6f9a4a, coast: 0x3fc0c0, jungle: 0xe07a2a, desert: 0xc8443a, crag: 0x6a6a7a, frost: 0x9ad0ff, sky: 0xe0b85a, volcano: 0xff7a2a, reef: 0xff8ab0 }[t.style];
  for (let i = 0; i < 4; i++) { const [x, z] = polar(t, i * 90 + 8, P + 7); put(x, z, i * 1.57, 1, bb => banner(bb, flag)); }
  if (FEATURE[t.id]) { const [x, z] = polar(t, 0, P + 15); let r = 0; b.at(x, hAt(x, z) - 0.15, z, 0, 1); r = FEATURE[t.id](b); if (r) col.push({ x, z, r }); }

  if (t.id === 'highmark') {
    /* curtain wall with towers and four gates */
    const WR = 212, N = 36;
    for (let i = 0; i < N; i++) {
      const a = i / N * TAU, a2 = (i + 1) / N * TAU, x = Math.sin(a) * WR, z = -Math.cos(a) * WR, x2 = Math.sin(a2) * WR, z2 = -Math.cos(a2) * WR, y = hAt(x, z);
      if (i % 9) { b.at(x, y - 1, z, 0, 1).add(G.cyl(3.4, 3.8, 17, 10), 0xd6d0c6, { y: 8.5 }).add(G.cone(4.2, 5, 10), 0x3d5fb0, { y: 19.5 }); col.push({ x, z, r: 4 }); }
      const gate = i % 9 === 0 || i % 9 === 8, mx = (x + x2) / 2, mz = (z + z2) / 2, len = Math.hypot(x2 - x, z2 - z);
      b.at(mx, Math.min(y, hAt(x2, z2)) - 1, mz, Math.atan2(x2 - x, z2 - z), 1);
      if (!gate) { b.add(G.box(2.4, 12, len), 0xcfc8be, { y: 6 }).add(G.box(3, 1, len), 0xb8b0a6, { y: 12.4 }); for (let k = 1; k < 4; k++) col.push({ x: x + (x2 - x) * k / 4, z: z + (z2 - z) * k / 4, r: 5 }); }
    }
    /* gates: banners over each road */
    for (let k = 0; k < 4; k++) { const [x, z] = polar(t, k * 90, WR); b.at(x, hAt(x, z), z, k * Math.PI / 2, 1).add(G.box(40, 3, 3), 0xcfc8be, { y: 14 }).add(G.box(6, 5, 0.3), 0x3d5fb0, { y: 9.6, z: 1.6 }).add(G.tor(1.4, 0.2, 18), 0xe0b85a, { y: 9.8, z: 1.9 }); }
    /* the keep, and the Dial Spire rising from it */
    b.at(0, hAt(0, -P - 50) - 0.3, -P - 50, 0, 1).add(G.box(56, 20, 34), 0xdcd6cc, { y: 10 }).add(G.box(58, 2, 36), 0xb8b0a6, { y: 20.6 });
    for (const x of [-28, 28]) for (const z of [-17, 17]) b.add(G.cyl(5, 5.6, 30, 12), 0xd6d0c6, { x, y: 15, z }).add(G.cone(6.4, 9, 12), 0x3d5fb0, { x, y: 34.5, z });
    b.add(G.cyl(7, 13, 150, 12), 0x8a84a0, { y: 95, z: -4 }).add(G.box(8, 11, 1), 0x1c1a2a, { y: 5.5, z: 17.2 }).add(G.tor(2.6, 0.3, 22), 0x7fe6d6, { y: 7, z: 17.9 });
    for (const [y, r] of [[40, 12.6], [80, 10.6], [120, 8.8], [160, 7.4]]) b.add(G.tor(r, 0.9, 26), 0xe0b85a, { y, z: -4, rx: Math.PI / 2 });
    for (const x of [-12, 12]) b.add(G.box(3, 12, 0.3), 0x3d5fb0, { x, y: 11, z: 17.3 });
    for (let x = -24; x <= 24; x += 12) for (let z = -12; z <= 12; z += 12) col.push({ x, z: -P - 50 + z, r: 9 });
    /* the arena, east of the plaza */
    const [ax, az] = polar(t, 90, P + 40);
    b.at(ax, hAt(ax, az) - 0.2, az, 0, 1).add(G.cyl(17, 17, 0.4, 24), 0xe6d0a0, { y: 0.2 });
    for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; if (i === 12) continue; b.add(G.box(6.4, 5, 2), 0xcfc8be, { x: Math.cos(a) * 19, y: 2.5, z: Math.sin(a) * 19, ry: -a + Math.PI / 2 }).add(G.box(1, 3, 0.2), i % 2 ? 0xc8443a : 0x3d5fb0, { x: Math.cos(a) * 19, y: 6.5, z: Math.sin(a) * 19, ry: -a + Math.PI / 2 }); col.push({ x: ax + Math.cos(a) * 19, z: az + Math.sin(a) * 19, r: 3.2 }); }
    /* trees and statues along the avenues */
    for (let k = 0; k < 4; k++) for (let d = P + 12; d < 200; d += 22) for (const s of [-8, 8]) { const a = k * Math.PI / 2, x = Math.sin(a) * d + Math.cos(a) * s, z = -Math.cos(a) * d + Math.sin(a) * s; if (k === 0 && d > P + 14 && d < P + 80) continue; b.at(x, hAt(x, z), z, 0, 1).add(G.cyl(0.3, 0.4, 2.6, 6), 0x7a5234, { y: 1.3 }).add(G.ico(1.9, 1), 0x5fae45, { y: 4 }).add(G.cyl(1, 1.1, 0.5, 8), 0xb8b4c0, { y: 0.25 }); }
  }
  b.B = null;
  const mesh = b.mesh(); mesh.frustumCulled = false;
  return { mesh, colliders: col };
}
