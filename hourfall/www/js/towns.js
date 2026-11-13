/* Builds every settlement from the Blender buildings, each with its own street plan:
   Highmark is a walled grid city, Dawnmere a farm village on a winding lane, Saltcrest a strip of
   stilt houses and piers along the shore, Canopy a ring of tree houses joined by rope bridges,
   Mirage a packed walled medina, Highcrag climbs the mountainside, Hearthhold huddles inside a
   palisade, the Aerie spreads across floating isles, Pearlreach is clusters of shell domes, and
   Emberdeep rings a lava lake. One merged mesh per town keeps it cheap to draw. */
import { rng, TAU, dist, clamp } from './util.js';
import { Builder, G } from './gfx.js';
import { A } from './assets.js';
import { height, ISLES, WATER } from './world.js';

export const plazaR = t => (t.size === 3 ? 46 : t.id === 'emberdeep' ? 58 : t.size === 2 ? 22 : 12);
/* Position inside a town: degrees clockwise from north, and distance from the centre. */
export function polar(t, deg, r) { const a = deg * Math.PI / 180; return [t.x + Math.sin(a) * r, t.z - Math.cos(a) * r]; }

const pick = (R, a) => a[Math.floor(R() * a.length)];
const PAL = {
  vale: { WALL: [0xf2e6c8, 0xe6d8b8, 0xf6ecd6, 0xe8dcc0], ROOF: [0xd9b45a, 0xc89a4a, 0xb8763a, 0xc8a050], TRIM: [0x7a5234, 0x6a4630], CLOTH: [0xc8443a, 0x4f9a4a] },
  crown: { WALL: [0xe6e0d6, 0xf0e8dc, 0xe0d4c4, 0xd8dce6], ROOF: [0x3d5fb0, 0x4a6ac0, 0x8a3a55, 0x3a7a8a, 0x5a5a7a], TRIM: [0x5a4030, 0x3a3a48], CLOTH: [0x3d5fb0, 0xc8443a, 0xe0a030, 0x8a3a55] },
  coast: { WALL: [0xff9a8a, 0x7fe0d0, 0xffe08a, 0x9ad0ff, 0xffb0d0, 0xb0f0a0], ROOF: [0xd9c07a, 0xc8a060, 0xf2e6c8], TRIM: [0xf2ead8, 0x3fc0c0], CLOTH: [0xff5a5a, 0x3fc0c0, 0xffd24a] },
  jungle: { WALL: [0xa8824a, 0xb8945a, 0x98744a], ROOF: [0x3f9a4a, 0x4fae4a, 0x2f8a52, 0x6a9a3a], TRIM: [0x5a4030], CLOTH: [0xe07a2a, 0xe050a0] },
  desert: { WALL: [0xf0d8a8, 0xe6c890, 0xf6e4c0, 0xead0a0], ROOF: [0xffffff, 0x3fa8a0, 0xe0b85a, 0xc86a4a], TRIM: [0xd0a870], CLOTH: [0xc8443a, 0x3fa8a0, 0xe0a030, 0x6a5ab0] },
  crag: { WALL: [0xa49a94, 0x9a948e, 0xb0a8a0], ROOF: [0x4a5a6a, 0x5a6a7a, 0x6a5a4a], TRIM: [0x6a4630], CLOTH: [0xc8443a] },
  frost: { WALL: [0x8a7a6a, 0x9a8a78, 0xb0a090], ROOF: [0x6a5a4a, 0x5a4a3a], TRIM: [0x6a4630, 0x8a6a4a], CLOTH: [0x9ad0ff] },
  sky: { WALL: [0xfaf6ee], ROOF: [0xe0b85a, 0x6a8ad0, 0x9ab0e0], TRIM: [0xe0b85a], CLOTH: [0xffffff, 0x9fe6ff, 0xffe08a] },
  volcano: { WALL: [0x3a3644, 0x4a4450, 0x443c48], ROOF: [0x2e2a36, 0x3a3036], TRIM: [0x2e2a36], CLOTH: [0xff7a2a] },
  reef: { WALL: [0xffb0c8, 0x9fe6d6, 0xf2e0a0, 0xc0b0ff, 0xffd0b0], ROOF: [0xffffff, 0xff7a8a, 0x7fe0c0], TRIM: [0xffffff], CLOTH: [0xff8ab0] },
};
const palette = (style, R) => { const p = PAL[style] || PAL.vale; return { WALL: pick(R, p.WALL), ROOF: pick(R, p.ROOF), TRIM: pick(R, p.TRIM), CLOTH: pick(R, p.CLOTH) }; };
const FLAG = { crown: 0x3d5fb0, vale: 0x6f9a4a, coast: 0x3fc0c0, jungle: 0xe07a2a, desert: 0xc8443a, crag: 0x6a6a7a, frost: 0x9ad0ff, sky: 0xe0b85a, volcano: 0xff7a2a, reef: 0xff8ab0 };

/* reserve: [{x, z, r}] spots that must stay clear (people, waystones, quest objects). */
export function buildTown(t, reserve = []) {
  /* Buildings go into 64 m tiles, each with a full-detail mesh and a cheap block stand-in;
     main.js shows the detailed one only near the player. Walls, landmarks and paving go in `b`, always drawn. */
  const tiles = new Map(), tileOf = (x, z) => { const k = Math.floor(x / 64) + ',' + Math.floor(z / 64); let T = tiles.get(k); if (!T) tiles.set(k, T = { x: (Math.floor(x / 64) + 0.5) * 64, z: (Math.floor(z / 64) + 0.5) * 64, hi: new Builder(), lo: new Builder() }); return T; };
  const R = rng(Math.round(t.x * 31 + t.z * 17 + 5)), b = new Builder(), col = [], P = plazaR(t), taken = reserve.map(s => ({ x: s.x, z: s.z, r: s.r || 3 }));
  const ground = (x, z) => (t.sky ? t.h : height(x, z));
  const free = (x, z, r) => taken.every(s => dist(x, z, s.x, s.z) > s.r + r);
  const claim = (x, z, r) => taken.push({ x, z, r });
  const face = (x, z) => Math.atan2(t.x - x, t.z - z);
  /* a building: model id, world x z, facing, scale, footprint radius. Foundations fill any drop in the ground. */
  function put(id, x, z, ry, s = 1, r = 4.6, pal, opts = {}) {
    if (!opts.force && !free(x, z, r * s)) return false;
    let y = ground(x, z);
    if (!t.sky && opts.found !== false) {
      let lo = y, hi = y; for (let k = 0; k < 6; k++) { const h = ground(x + Math.cos(k) * r * s * 0.8, z + Math.sin(k) * r * s * 0.8); lo = Math.min(lo, h); hi = Math.max(hi, h); }
      if (hi - lo > 0.6) { b.at(x, lo - 0.5, z, ry, 1).add(G.box(r * s * 1.7, hi - lo + 0.8, r * s * 1.5), t.style === 'volcano' ? 0x2e2a36 : 0x9a8f88, { y: (hi - lo + 0.8) / 2 }); y = hi; }
    }
    const p = pal || palette(t.style, R);
    if (opts.tile) {
      const T = tileOf(x, z), w = r * s * 1.45, h = (t.style === 'crown' ? 9 : t.style === 'crag' ? 11 : 4.5) * s;
      T.hi.at(x, y - 0.1 + (opts.lift || 0), z, ry, s).addAsset(A[id], p);
      T.lo.at(x, y - 0.1, z, ry, 1).add(G.box(w, h, w * 0.85), p.WALL ?? 0xe6e0d6, { y: h / 2 }).add(G.cone(w * 0.75, h * 0.45, 4), p.ROOF ?? 0x8a5a34, { y: h + h * 0.22, ry: Math.PI / 4 });
    } else b.at(x, y - 0.1 + (opts.lift || 0), z, ry, s).addAsset(A[id], p);
    claim(x, z, r * s); if (r > 0) col.push({ x, z, r: r * s * 0.95 });
    return true;
  }
  const house = (x, z, ry, s = 1, opts) => put('B.' + t.style + (R() < 0.5 ? '_a' : '_b'), x, z, ry, s, t.style === 'crown' ? 4.4 : 4.6, null, Object.assign({ tile: true }, opts));
  /* street furniture is detail: drawn only in the near tiles */
  const furn = (id, x, z, ry = 0, pal, r = 1.2) => { const y = ground(x, z); claim(x, z, r); tileOf(x, z).hi.at(x, y - 0.05, z, ry, 1).addAsset(A['F.' + id], pal || palette(t.style, R)); return true; };

  /* every inhabited place gets a square with something in the middle and market stalls round it */
  if (t.size > 0) {
    if (t.id !== 'emberdeep' && t.id !== 'canopy') put(t.size === 3 ? 'F.fountain_big' : t.size === 2 ? 'F.fountain' : 'F.well', t.x, t.z, 0, 1, t.size === 3 ? 7 : 4, palette(t.style, R), { force: true });
    else claim(t.x, t.z, 6);
    const stalls = t.size === 3 ? 14 : t.size === 2 ? 6 : 2;
    for (let i = 0; i < stalls; i++) { const [x, z] = polar(t, (i + 0.5) * 360 / stalls + 7, P + 3); if (free(x, z, 1.5)) furn('stall', x, z, face(x, z), { CLOTH: pick(R, [0xc8443a, 0x3d5fb0, 0xe0a030, 0x4f9a4a, 0x8a4ab8, 0x3fa8a0]) }, 1.8); }
    for (let i = 0; i < (t.size === 3 ? 12 : t.size === 2 ? 6 : 3); i++) { const n = t.size === 3 ? 12 : t.size === 2 ? 6 : 3, [x, z] = polar(t, i * 360 / n + 22, P * 0.7); if (free(x, z, 1)) furn('lamp', x, z, face(x, z)); }
    for (let i = 0; i < 4; i++) { const [x, z] = polar(t, i * 90 + 8, P + 8); if (free(x, z, 1)) furn('banner', x, z, i * 1.57, { CLOTH: FLAG[t.style] }); }
    for (let i = 0; i < (t.size === 3 ? 10 : t.size === 2 ? 4 : 1); i++) { const [x, z] = polar(t, R() * 360, P * 0.55 + R() * P * 0.4); if (free(x, z, 1.4)) furn(pick(R, ['bench', 'barrels', 'cart']), x, z, R() * TAU); }
  }
  LAYOUT[t.id === 'highmark' ? 'crown' : t.size === 1 ? 'hamlet' : t.size === 0 ? 'arena' : t.style](t, { R, b, put, house, furn, free, claim, face, ground, P, col });
  b.B = null;
  const mesh = b.mesh(); mesh.frustumCulled = false;
  const parts = [...tiles.values()].map(T => { const hi = T.hi.mesh(), lo = T.lo.mesh(); hi.frustumCulled = lo.frustumCulled = false; return { x: T.x, z: T.z, hi, lo }; });
  return { mesh, tiles: parts, colliders: col };
}

const LAYOUT = {
  /* Highmark: a grid of tall townhouses inside the curtain wall, avenues to four gates, the keep and Spire to the north, the arena east. */
  crown(t, { R, b, put, house, furn, free, claim, ground, P }) {
    const WR = 212, [kx, kz] = polar(t, 0, P + 50), [ax, az] = polar(t, 90, P + 40);
    put('L.keep', kx, kz, 0, 1, 0, null, { force: true });
    for (let x = -28; x <= 28; x += 8) for (let z = -17; z <= 17; z += 8) claim(kx + x, kz + z, 7);
    put('L.arena', ax, az, Math.PI / 2, 1, 0, null, { force: true }); claim(ax, az, 24);
    const N = 40;
    for (let i = 0; i < N; i++) {
      const a = (i + 0.5) / N * TAU, x = t.x + Math.sin(a) * WR, z = t.z - Math.cos(a) * WR, gate = [0, 10, 20, 30].some(g => Math.abs(i + 0.5 - g) < 1.1);
      if (gate) continue;
      b.at(x, ground(x, z) - 1.5, z, -a + Math.PI / 2, 1).addAsset(A['L.wall'], null, { sz: 1.75 });
      for (let k = -2; k <= 2; k++) claim(x + Math.cos(a) * k * 7, z + Math.sin(a) * k * 7, 4.5);
      if (i % 2 === 0) put('L.tower', t.x + Math.sin(i / N * TAU) * WR, t.z - Math.cos(i / N * TAU) * WR, 0, 1, 4.2, null, { force: true });
    }
    for (let k = 0; k < 4; k++) { const [x, z] = polar(t, k * 90, WR); put('L.gate', x, z, -k * Math.PI / 2, 1, 0, null, { force: true }); claim(x, z, 6); }
    /* reserve the avenues */
    for (let d = P; d < WR; d += 6) for (let k = 0; k < 4; k++) { const [x, z] = polar(t, k * 90, d); claim(x, z, 6.5); }
    const C = 25;
    for (let gx = -9; gx <= 9; gx++) for (let gz = -9; gz <= 9; gz++) {
      const cx = t.x + gx * C, cz = t.z + gz * C, d = dist(cx, cz, t.x, t.z);
      if (d > WR - 18 || d < P + 12) continue;
      if (R() < 0.14) { /* a little garden square instead of a block */ furn('planter', cx, cz); furn('bench', cx + 4, cz, Math.PI / 2); continue; }
      for (const s of [-1, 1]) house(cx + (R() - 0.5) * 2, cz + s * 5.6, s > 0 ? 0 : Math.PI, 1);
    }
    for (let k = 0; k < 4; k++) for (let d = P + 14; d < WR - 10; d += 22) for (const s of [-1, 1]) {
      const a = k * Math.PI / 2, x = t.x + Math.sin(a) * d + Math.cos(a) * s * 9, z = t.z - Math.cos(a) * d + Math.sin(a) * s * 9;
      if (free(x, z, 0)) furn(d % 44 < 22 ? 'planter' : 'lamp', x, z);
    }
    for (const deg of [45, 135, 225, 315]) { const [x, z] = polar(t, deg, P + 6); furn('statue', x, z, deg * Math.PI / 180 + Math.PI); }
  },
  /* Dawnmere: cottages strung along a winding lane, fields and fences outside, the windmill on the hill. */
  vale(t, { R, b, put, house, furn, free, ground, P, face }) {
    const [wx, wz] = polar(t, 0, P + 16); put('L.dawnmere', wx, wz, 0, 1, 5, null, { force: true });
    const [ox, oz] = polar(t, 330, 40); put('B.vale_a', ox, oz, face(ox, oz), 1.1, 4.6, { WALL: 0xb8b0c4, ROOF: 0x3d4a7a, TRIM: 0x3a3a48 }, { force: true });
    for (let i = -7; i <= 7; i++) {
      if (!i) continue;
      const u = i * 11, a = Math.sin(i * 0.5) * 0.6 + 0.8, lx = t.x + Math.cos(a) * u, lz = t.z + Math.sin(a) * u;
      for (const s of [-1, 1]) {
        const x = lx - Math.sin(a) * s * 15 + (R() - 0.5) * 4, z = lz + Math.cos(a) * s * 15 + (R() - 0.5) * 4;
        if (dist(x, z, t.x, t.z) > P + 6) house(x, z, Math.atan2(lx - x, lz - z), 0.95 + R() * 0.15);
      }
    }
    /* crop fields outside the village */
    for (let f = 0; f < 6; f++) {
      const a = f / 6 * TAU + 0.3, r = 78 + R() * 12, fx = t.x + Math.cos(a) * r, fz = t.z + Math.sin(a) * r, ry = R() * 3, crop = pick(R, [0xd9b45a, 0x7fbf4a, 0xb8d06a, 0xe0a030]);
      if (!free(fx, fz, 8)) continue;
      for (let k = -4; k <= 4; k++) { const x = fx + Math.cos(ry) * k * 2.2, z = fz - Math.sin(ry) * k * 2.2; b.at(x, ground(x, z), z, ry, 1).add(G.box(1.2, 0.7, 16), crop, { y: 0.3 }).add(G.box(0.4, 0.2, 16), 0x8a6a4a, { x: 1.1, y: 0.05 }); }
      for (let k = 0; k < 10; k++) { const aa = k / 10 * TAU, x = fx + Math.cos(aa) * 13, z = fz + Math.sin(aa) * 13; b.at(x, ground(x, z), z, -aa, 1).add(G.box(0.2, 1.2, 0.2), 0x7a5234, { y: 0.6 }).add(G.box(0.12, 0.12, 8), 0x8a6a4a, { y: 0.9, z: 4 }); }
    }
    for (let k = 0; k < 8; k++) { const [x, z] = polar(t, R() * 360, 55 + R() * 35); if (free(x, z, 2)) b.at(x, ground(x, z), z, R() * 3, 1).add(G.cyl(1.0, 1.2, 1.4, 10), 0xe0c070, { y: 0.7 }).add(G.cone(1.05, 0.7, 10), 0xd9b45a, { y: 1.75 }); }
  },
  /* Saltcrest: houses in two rows along the shore, piers out into the sea, the lighthouse on the point. */
  coast(t, { R, b, put, house, furn, free, claim, ground, P }) {
    /* the sea lies in the direction with the most water along it */
    let sea = 0, wet = -1;
    for (let k = 0; k < 24; k++) { const a = k / 24 * TAU; let n = 0; for (let d = 60; d <= 420; d += 40) if (height(t.x + Math.sin(a) * d, t.z - Math.cos(a) * d) < WATER) n += 1 + (420 - d) / 420; if (n > wet) { wet = n; sea = a; } }
    const sx = Math.sin(sea), sz = -Math.cos(sea), ax = Math.cos(sea), az = Math.sin(sea), ry = Math.atan2(sx, sz);
    const [lx, lz] = [t.x + sx * 92 + ax * 78, t.z + sz * 92 + az * 78];
    put('L.saltcrest', lx, lz, ry, 1, 6.5, null, { force: true });
    for (let row = 0; row < 3; row++) for (let i = -6; i <= 6; i++) {
      const along = i * 15 + (row % 2) * 7, out = [62, 34, -30][row], x = t.x + ax * along + sx * out, z = t.z + az * along + sz * out;
      if (Math.abs(along) < P + 4 && Math.abs(out) < P + 4) continue;
      put(row === 0 ? 'B.coast_a' : 'B.coast_b', x + (R() - 0.5) * 3, z + (R() - 0.5) * 3, row === 0 ? ry : ry, 1, 4.6);
    }
    for (const along of [-50, 0, 50]) { const x = t.x + ax * along + sx * 100, z = t.z + az * along + sz * 100; put('F.dock', x, z, ry, 1, 0, null, { force: true, found: false, lift: -ground(x, z) }); claim(x, z, 3); }
    for (let k = 0; k < 6; k++) { const x = t.x + ax * (R() - 0.5) * 160 + sx * (78 + R() * 8), z = t.z + az * (R() - 0.5) * 160 + sz * (78 + R() * 8); if (free(x, z, 1)) b.at(x, ground(x, z), z, R() * 3, 1).add(G.cyl(0.08, 0.08, 2.8, 5), 0xf2ead8, { y: 1.4 }).add(G.cone(1.6, 0.7, 8), pick(R, [0xff5a5a, 0x3fc0c0, 0xffd24a]), { y: 2.9 }); }
  },
  /* Canopy: the great tree in the middle, tree houses around it, rope bridges between neighbours. */
  jungle(t, { R, b, put, house, free, ground, P, face }) {
    put('L.canopy', t.x, t.z, 0, 1, 7.5, null, { force: true });
    const ring = [];
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * TAU + R() * 0.2, r = 34 + (i % 2) * 24 + R() * 6, x = t.x + Math.cos(a) * r, z = t.z + Math.sin(a) * r;
      if (put('B.jungle_a', x, z, face(x, z), 0.95 + R() * 0.15, 4.4)) ring.push([x, z]);
    }
    for (let i = 0; i < ring.length; i++) {
      const [x1, z1] = ring[i], [x2, z2] = ring[(i + 1) % ring.length], l = dist(x1, z1, x2, z2);
      if (l > 34) continue;
      const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2, y = (ground(x1, z1) + ground(x2, z2)) / 2 + 3.5;
      b.at(mx, y, mz, Math.atan2(x2 - x1, z2 - z1), 1).add(G.box(1.2, 0.12, l - 7.5), 0x8a6a4a).add(G.box(0.05, 0.05, l - 7.5), 0xc8b080, { x: 0.6, y: 0.9 }).add(G.box(0.05, 0.05, l - 7.5), 0xc8b080, { x: -0.6, y: 0.9 });
    }
    for (let i = 0; i < 5; i++) { const a = R() * TAU, r = 80 + R() * 15; house(t.x + Math.cos(a) * r, t.z + Math.sin(a) * r, R() * TAU); }
  },
  /* Mirage: a packed medina of narrow alleys inside a mud wall, the casino at its heart. */
  desert(t, { R, b, put, free, claim, ground, P }) {
    put('L.mirage', t.x, t.z - 6, 0, 1, 14, null, { force: true });
    for (let d = P; d < 110; d += 5) claim(t.x, t.z + d, 4);
    const C = 13;
    for (let gx = -8; gx <= 8; gx++) for (let gz = -8; gz <= 8; gz++) {
      const x = t.x + gx * C + (gz % 2) * 4, z = t.z + gz * C, d = dist(x, z, t.x, t.z);
      if (d < P + 16 || d > 104 || Math.abs(gx * C) < 5) continue;
      put(R() < 0.7 ? 'B.desert_a' : 'B.desert_b', x, z, Math.round(R() * 4) * Math.PI / 2, 0.85, 4.4);
    }
    const WR = 116;
    for (let i = 0; i < 48; i++) {
      const a = (i + 0.5) / 48 * TAU; if ([12, 24, 36, 0].some(gg => Math.abs(i + 0.5 - gg) < 0.9 || Math.abs(i + 0.5 - 48) < 0.9)) continue;
      const x = t.x + Math.sin(a) * WR, z = t.z - Math.cos(a) * WR;
      b.at(x, ground(x, z) - 0.5, z, -a, 1).add(G.box(15.4, 6, 2.2), 0xe6c890, { y: 3 }).add(G.box(15.4, 0.6, 2.6), 0xd0a870, { y: 6.2 });
      for (let k = -2; k <= 2; k++) b.add(G.box(1.2, 1, 2.2), 0xe6c890, { x: k * 3, y: 7 });
    }
    for (let i = 0; i < 10; i++) { const a = R() * TAU, r = 124 + R() * 25, x = t.x + Math.cos(a) * r, z = t.z + Math.sin(a) * r; if (free(x, z, 2)) b.at(x, ground(x, z), z, R() * 3, 1).addAsset(A['P.palm']); }
  },
  /* Highcrag: tall stone houses climbing the slopes, each on its own footing, the great hall above the square. */
  crag(t, { R, put, house, ground, P, face }) {
    const [hx, hz] = polar(t, 0, P + 18); put('L.highcrag', hx, hz, 0, 1, 9, null, { force: true });
    /* houses go wherever the mountainside offers a ledge */
    let n = 0;
    for (let i = 0; i < 160 && n < 26; i++) {
      const a = i * 2.4, r = 34 + (i % 40) * 2.2, x = t.x + Math.cos(a) * r, z = t.z + Math.sin(a) * r;
      let lo = 1e9, hi = -1e9; for (let k = 0; k < 6; k++) { const h = ground(x + Math.cos(k) * 4, z + Math.sin(k) * 4); lo = Math.min(lo, h); hi = Math.max(hi, h); }
      if (hi - lo < 4.5 && house(x, z, face(x, z), 0.95)) n++;
    }
  },
  /* Hearthhold: longhouses and snow domes huddled round the fire inside a palisade, the mead-hall at the head. */
  frost(t, { R, b, put, house, free, ground, P, face }) {
    const [hx, hz] = polar(t, 0, P + 16); put('L.hearthhold', hx, hz, 0, 1, 9, null, { force: true });
    for (let i = 0; i < 18; i++) { const a = i / 18 * TAU + 0.15, r = 44 + (i % 3) * 13, x = t.x + Math.sin(a) * r, z = t.z - Math.cos(a) * r; house(x, z, face(x, z), 1); }
    for (let i = 0; i < 70; i++) {
      const a = i / 70 * TAU; if ([0, 17, 35, 52].some(g => Math.abs(i - g) < 2)) continue;
      const x = t.x + Math.sin(a) * 92, z = t.z - Math.cos(a) * 92;
      b.at(x, ground(x, z), z, 0, 1).add(G.cyl(0.42, 0.48, 4.6, 7), 0x8a6a4a, { y: 2.3 }).add(G.cone(0.42, 0.9, 7), 0x8a6a4a, { y: 5.05 });
    }
    for (let k = 0; k < 5; k++) { const [x, z] = polar(t, k * 72 + 30, P - 4); if (free(x, z, 1)) b.at(x, ground(x, z), z, 0, 1).add(G.cyl(0.5, 0.5, 0.4, 8), 0x5a5a66, { y: 0.2 }).add(G.cone(0.4, 1.0, 6), 0xffa040, { y: 0.9 }); }
  },
  /* The Aerie: the observatory on the great isle, towers and pavilions round its rim, one on every small isle. */
  sky(t, { R, put, house, P, face }) {
    put('L.aerie', t.x, t.z - P - 14, 0, 1, 9, null, { force: true });
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, r = 62 + (i % 2) * 30, x = t.x + Math.sin(a) * r, z = t.z - Math.cos(a) * r; house(x, z, face(x, z), 1); }
    for (const isle of ISLES.slice(2)) put('B.sky_' + (R() < 0.5 ? 'a' : 'b'), isle.x + 6, isle.z + 6, R() * TAU, 0.9, 4.6);
  },
  /* Pearlreach: shell domes and coral towers in clusters on the sea floor, the palace at the centre. */
  reef(t, { R, put, house, P, face }) {
    put('L.pearlreach', t.x, t.z - P - 12, 0, 1, 10, null, { force: true });
    for (let c = 0; c < 4; c++) {
      const a = c / 4 * TAU + 0.6, r = 70, cx = t.x + Math.sin(a) * r, cz = t.z - Math.cos(a) * r;
      for (let i = 0; i < 6; i++) { const x = cx + (R() - 0.5) * 34, z = cz + (R() - 0.5) * 34; house(x, z, face(x, z), 0.9 + R() * 0.3); }
    }
  },
  /* Emberdeep: basalt houses on terraces round the lava lake, the Crucible to the north. */
  volcano(t, { R, put, house, P, face }) {
    const [cx, cz] = polar(t, 0, P + 18); put('L.emberdeep', cx, cz, 0, 1, 18, null, { force: true });
    for (let i = 0; i < 22; i++) { const a = (i + 0.5) / 22 * TAU, r = 84 + (i % 2) * 18, x = t.x + Math.sin(a) * r, z = t.z - Math.cos(a) * r; if (Math.abs(((a / TAU * 360) + 360) % 360 - 0) < 28) continue; house(x, z, face(x, z), 1); }
  },
  /* Hamlets: a handful of houses round a well, with a haystack or two. */
  hamlet(t, { R, b, house, free, ground, face }) {
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + R() * 0.5, r = 22 + R() * 14, x = t.x + Math.cos(a) * r, z = t.z + Math.sin(a) * r; house(x, z, face(x, z), 0.95); }
    for (let k = 0; k < 3; k++) { const a = R() * TAU, r = 38 + R() * 10, x = t.x + Math.cos(a) * r, z = t.z + Math.sin(a) * r; if (free(x, z, 2)) b.at(x, ground(x, z), z, 0, 1).add(G.cyl(1.0, 1.2, 1.4, 10), 0xe0c070, { y: 0.7 }).add(G.cone(1.05, 0.7, 10), 0xd9b45a, { y: 1.75 }); }
  },
  /* Boss arenas: a ring of standing stones in the region's stone, and the Sunken Clock in the Wastes. */
  arena(t, { R, b, ground, col }) {
    const c = { vale: 0xc8b070, coast: 0xd9c8a0, jungle: 0x6f7a5c, desert: 0xbfe6dc, crag: 0x8a807a, frost: 0xb9c6d6, reef: 0x9fe6d6, volcano: 0x3a3644 }[t.style];
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, x = t.x + Math.cos(a) * 26, z = t.z + Math.sin(a) * 26, h = 6 + (i * 7 % 5); b.at(x, ground(x, z) - 0.3, z, a, 1).add(G.box(2.2, h, 1.6), c, { y: h / 2 }).add(G.box(2.6, 0.5, 2), c, { y: h + 0.25 }); col.push({ x, z, r: 1.6 }); }
    if (t.id === 'a_desert') b.at(t.x, t.h, t.z, 0, 1).addAsset(A['L.sunkclock']);
    if (t.id === 'a_graves') for (let i = 0; i < 16; i++) { const x = t.x + Math.cos(i * 2.4) * (6 + i), z = t.z + Math.sin(i * 2.4) * (6 + i); b.at(x, ground(x, z), z, i, 1).add(G.box(0.9, 1.5, 0.3), 0x8d8a96, { y: 0.6 }).add(G.cyl(0.45, 0.45, 0.3, 10), 0x8d8a96, { y: 1.35, rx: Math.PI / 2 }); }
  },
};
