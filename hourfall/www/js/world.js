/* The island of Meridian: terrain shape, regions, scenery, sky. */
import * as THREE from './vendor/three.module.min.js';
import { clamp, lerp, sstep, fbm, rng, dist, TAU } from './util.js';

export const WATER = -1.2, HALF = 340, EDGE = 322;

/* Flattened clearings for towns, camps and boss arenas. */
export const SPOTS = [
  { id: 'dawnmere', x: 0, z: 140, r: 50, h: 3 },
  { id: 'fenncamp', x: -150, z: 110, r: 17, h: 4 },
  { id: 'hollow', x: -235, z: 40, r: 27, h: 5 },
  { id: 'caravan', x: 165, z: 120, r: 19, h: 2.5 },
  { id: 'sunkclock', x: 240, z: 20, r: 27, h: 2 },
  { id: 'monastery', x: 60, z: -175, r: 19, h: 16 },
  { id: 'peak', x: -70, z: -255, r: 27, h: 30 },
  { id: 'spire', x: 0, z: -40, r: 42, h: 10 },
  { id: 'graves', x: -62, z: 30, r: 15, h: 4 },
];
export const LAKE = { x: 75, z: 55, r: 42 };

export function weights(x, z) {
  const wob = (fbm(x * 0.01 + 7.3, z * 0.01 - 3.1) - 0.5) * 70;
  const frost = sstep(-105, -165, z + wob);
  return { frost, forest: sstep(-85, -140, x + wob) * (1 - frost), flats: sstep(95, 150, x - wob) * (1 - frost) };
}

export function height(x, z) {
  const w = weights(x, z), d = Math.hypot(x, z);
  let h = (fbm(x * 0.011, z * 0.011) - 0.42) * 16 + 1.8;
  h += w.forest * (fbm(x * 0.03, z * 0.03) - 0.5) * 6;
  h = lerp(h, 1.4 + Math.sin(x * 0.07 + z * 0.03) * 1.1 + fbm(x * 0.03 + 20, z * 0.03) * 2.2, w.flats * 0.85);
  h += w.frost * (fbm(x * 0.02 + 50, z * 0.02 + 50) * 34 + 4);
  const ld = dist(x, z, LAKE.x, LAKE.z);
  h -= (1 - sstep(10, LAKE.r, ld)) * 9;
  h += (1 - sstep(0, 8, ld)) * 10.5;
  h -= sstep(288, 338, d) * 30;
  for (const s of SPOTS) {
    const sd = dist(x, z, s.x, s.z);
    if (sd < s.r) h = lerp(h, s.h, 1 - sstep(s.r * 0.55, s.r, sd));
  }
  return h;
}

export function regionName(x, z) {
  if (dist(x, z, 0, 140) < 52) return 'Dawnmere';
  if (dist(x, z, 0, -40) < 46) return 'The Dial Spire';
  if (dist(x, z, LAKE.x, LAKE.z) < LAKE.r) return 'Mirror Mere';
  if (dist(x, z, -235, 40) < 30) return 'Antler Hollow';
  if (dist(x, z, 240, 20) < 30) return 'The Sunken Clock';
  if (dist(x, z, -70, -255) < 30) return "Warden's Crown";
  if (dist(x, z, -62, 30) < 18) return 'The Quiet Yard';
  const w = weights(x, z);
  if (w.frost > 0.5) return 'Frostspine';
  if (w.forest > 0.5) return 'Whisperwood';
  if (w.flats > 0.5) return 'Saltglass Flats';
  return 'The Meridian Fields';
}

const C = h => new THREE.Color(h);
const col = { meadow: C(0x7fa64e), meadow2: C(0x94b659), forest: C(0x3f6f3c), sand: C(0xd8c79c), glass: C(0x9fd6c6),
  snow: C(0xb4c0d2), rock: C(0x7c7f8d), shore: C(0xcbb98a), stone: C(0x8e8a9a), deep: C(0x4d6b5a) };
const tmpC = new THREE.Color();
function groundColor(x, z, h, slope, out) {
  const w = weights(x, z), n = fbm(x * 0.05, z * 0.05);
  out.copy(col.meadow).lerp(col.meadow2, n);
  out.lerp(col.forest, w.forest);
  out.lerp(tmpC.copy(col.sand).lerp(col.glass, sstep(0.55, 0.75, fbm(x * 0.04 + 9, z * 0.04))), w.flats);
  out.lerp(tmpC.copy(col.snow).lerp(col.rock, sstep(0.5, 1.1, slope)), w.frost);
  if (dist(x, z, 0, -40) < 40) out.lerp(col.stone, 1 - sstep(26, 40, dist(x, z, 0, -40)));
  if (dist(x, z, 0, 140) < 30) out.lerp(col.shore, (1 - sstep(8, 30, dist(x, z, 0, 140))) * 0.6);
  out.lerp(col.shore, 1 - sstep(WATER + 0.2, WATER + 1.6, h));
  if (h < WATER) out.lerp(col.deep, sstep(WATER, WATER - 4, h));
  return out;
}

/* Sky colours for each step of the story: 0 dusk, 1 twilight, 2 night, 3 first light, 4 day. */
const PHASES = [
  { top: 0x2b2350, hor: 0xff8a4c, fog: 0xc7866a, sun: 0xffb27a, si: 1.7, sky: 0xcdb6e6, gnd: 0xa07a66, hi: 1.0, stars: 0.15 },
  { top: 0x1b1d48, hor: 0xc7627a, fog: 0x8f6080, sun: 0xff9aa8, si: 1.4, sky: 0xb0a6e8, gnd: 0x86708a, hi: 1.0, stars: 0.5 },
  { top: 0x0a0f2e, hor: 0x3b4f8c, fog: 0x34467c, sun: 0xa9bcff, si: 1.3, sky: 0x9fb2f0, gnd: 0x5c6a96, hi: 1.15, stars: 1 },
  { top: 0x2a3270, hor: 0xffb3a0, fog: 0xbf929e, sun: 0xffc9b0, si: 1.6, sky: 0xc6c0ee, gnd: 0x9a8088, hi: 1.0, stars: 0.35 },
  { top: 0x3f8fe0, hor: 0xcfeaff, fog: 0xbfe0f5, sun: 0xfff4d6, si: 2.1, sky: 0xcfe6ff, gnd: 0x8a9a75, hi: 0.75, stars: 0 },
];

export function buildWorld(scene) {
  const colliders = [];
  const R = rng(20261111);

  /* ---- terrain ---- */
  const SEG = 170, geo = new THREE.PlaneGeometry(HALF * 2, HALF * 2, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3), c = new THREE.Color();
  const map = document.createElement('canvas'); map.width = map.height = SEG + 1;
  const mg = map.getContext('2d'), img = mg.createImageData(SEG + 1, SEG + 1);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = height(x, z);
    pos.setY(i, h);
    const slope = Math.hypot(height(x + 2, z) - h, height(x, z + 2) - h) / 2;
    groundColor(x, z, h, slope, c);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    const m = h < WATER ? tmpC.set(0x3f7f96) : c, shade = clamp(0.8 + (h - 3) * 0.012, 0.7, 1.2);
    tmpC.copy(m).convertLinearToSRGB();
    img.data[i * 4] = tmpC.r * 255 * shade; img.data[i * 4 + 1] = tmpC.g * 255 * shade; img.data[i * 4 + 2] = tmpC.b * 255 * shade; img.data[i * 4 + 3] = 255;
  }
  mg.putImageData(img, 0, 0);
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  scene.add(ground);

  const water = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0x4f9db3, transparent: true, opacity: 0.72 }));
  water.position.y = WATER; scene.add(water);

  /* ---- scenery, drawn with instancing so phones keep up ---- */
  const lam = (color, extra) => new THREE.MeshLambertMaterial(Object.assign({ color, flatShading: true }, extra));
  const kinds = {
    pine: { parts: [[new THREE.CylinderGeometry(0.28, 0.4, 2.4, 5).translate(0, 1.2, 0), lam(0x5b4030)], [new THREE.ConeGeometry(2.1, 6.4, 6).translate(0, 5.2, 0), lam(0xffffff)]], list: [] },
    oak: { parts: [[new THREE.CylinderGeometry(0.3, 0.45, 2.6, 5).translate(0, 1.3, 0), lam(0x6a4a33)], [new THREE.IcosahedronGeometry(2.4, 0).translate(0, 4.2, 0), lam(0xffffff)]], list: [] },
    shard: { parts: [[new THREE.OctahedronGeometry(1, 0).scale(0.7, 2.6, 0.7).translate(0, 1.6, 0), lam(0xffffff, { emissive: 0x1d5a55, transparent: true, opacity: 0.88 })]], list: [] },
    rock: { parts: [[new THREE.DodecahedronGeometry(1, 0).scale(1, 0.7, 1).translate(0, 0.35, 0), lam(0xffffff)]], list: [] },
    bush: { parts: [[new THREE.IcosahedronGeometry(0.9, 0).scale(1, 0.7, 1).translate(0, 0.5, 0), lam(0xffffff)]], list: [] },
  };
  const clear = (x, z, pad) => SPOTS.every(s => dist(x, z, s.x, s.z) > s.r + pad);
  for (let i = 0; i < 12500; i++) {
    const x = (R() * 2 - 1) * 325, z = (R() * 2 - 1) * 325, h = height(x, z);
    if (h < WATER + 0.6 || !clear(x, z, 1)) continue;
    const w = weights(x, z), r = R(), s = 0.75 + R() * 0.7, tint = 0.82 + R() * 0.3;
    let kind = null, color = 0xffffff;
    if (r < 0.07) { kind = 'rock'; color = w.frost > 0.5 ? 0x9fa6b8 : w.flats > 0.5 ? 0xc9b38a : 0x8a8a84; }
    else if (w.frost > 0.5) { if (r < 0.3) { kind = 'pine'; color = 0xb9d2d6; } }
    else if (w.forest > 0.5) { if (r < 0.86) { kind = r < 0.78 ? 'pine' : 'bush'; color = r < 0.78 ? 0x2f6a3e : 0x4b8a45; } }
    else if (w.flats > 0.5) { if (r < 0.2) { kind = 'shard'; color = r < 0.13 ? 0x8fe6d6 : 0xf2b6c8; } }
    else if (r < 0.2) { kind = r < 0.14 ? 'oak' : 'bush'; color = r < 0.11 ? 0x5f9a45 : r < 0.14 ? 0xd98a4a : 0x6fa650; }
    if (!kind) continue;
    kinds[kind].list.push({ x, y: h - 0.15, z, s, rot: R() * TAU, color: new THREE.Color(color).multiplyScalar(tint) });
  }
  const dummy = new THREE.Object3D();
  for (const k of Object.values(kinds)) {
    k.parts.forEach(([g, m], pi) => {
      const im = new THREE.InstancedMesh(g, m, k.list.length);
      k.list.forEach((t, i) => {
        dummy.position.set(t.x, t.y, t.z); dummy.rotation.set(0, t.rot, 0); dummy.scale.setScalar(t.s); dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
        if (pi === k.parts.length - 1) im.setColorAt(i, t.color);
      });
      im.frustumCulled = false; scene.add(im); (k.meshes = k.meshes || []).push(im);
    });
  }

  /* ---- buildings and ruins ---- */
  const add = (mesh, x, y, z, ry) => { mesh.position.set(x, y, z); if (ry) mesh.rotation.y = ry; scene.add(mesh); return mesh; };
  const glow = new THREE.MeshBasicMaterial({ color: 0xffd58a });
  function house(x, z, ry, wall, roof, s = 1) {
    const g = new THREE.Group(), y = height(x, z);
    const b = new THREE.Mesh(new THREE.BoxGeometry(7 * s, 4 * s, 6 * s), lam(wall)); b.position.y = 2 * s; g.add(b);
    const rf = new THREE.Mesh(new THREE.ConeGeometry(5.6 * s, 3.2 * s, 4), lam(roof)); rf.position.y = 5.6 * s; rf.rotation.y = Math.PI / 4; rf.scale.set(1, 1, 0.9); g.add(rf);
    const d = new THREE.Mesh(new THREE.BoxGeometry(1.3 * s, 2.3 * s, 0.2), lam(0x4a3324)); d.position.set(0, 1.15 * s, 3.02 * s); g.add(d);
    for (const wx of [-2.2, 2.2]) { const wn = new THREE.Mesh(new THREE.BoxGeometry(1 * s, 1 * s, 0.2), glow); wn.position.set(wx * s, 2.4 * s, 3.02 * s); g.add(wn); }
    add(g, x, y - 0.2, z, ry); colliders.push({ x, z, r: 4.2 * s });
    return g;
  }
  const V = { x: 0, z: 140 };
  [[-20, -14, 0.5, 0xd9c7a8, 0x9a4a3a], [19, -16, -0.5, 0xcdb9a0, 0x7a5a8a], [-30, 6, 1.2, 0xd5c2a0, 0x4f7a6a], [31, 4, -1.3, 0xe0cfae, 0x9a4a3a],
   [-16, 27, 2.5, 0xcbb89a, 0x7a5a8a], [15, 30, -2.6, 0xd9c7a8, 0x4f7a6a], [0, -30, 0, 0xe6d8bc, 0xb0683a, 1.35]].forEach(([dx, dz, ry, a, b, s]) => house(V.x + dx, V.z + dz, ry, a, b, s));
  /* Oren's workshop: the house with a ring over the door. */
  const ws = house(-38, 168, 0.9, 0xb8b0c4, 0x3d4a7a, 1.15);
  const wr = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.16, 6, 20), new THREE.MeshBasicMaterial({ color: 0x7fe6d6 })); wr.position.set(0, 6.2, 3.7); ws.add(wr);
  /* Well in the square. */
  const well = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 1.2, 10), lam(0x8d8a96)); add(well, 0, height(0, 140) + 0.6, 140); colliders.push({ x: 0, z: 140, r: 2 });
  /* Fence posts around the training yard. */
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; if (i === 9) continue; const px = 30 + Math.cos(a) * 8, pz = 166 + Math.sin(a) * 8; add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.4, 0.3), lam(0x6a4a33)), px, height(px, pz) + 0.7, pz); }

  function tent(x, z, color) { const t = new THREE.Mesh(new THREE.ConeGeometry(3, 3.6, 5), lam(color)); add(t, x, height(x, z) + 1.7, z, R() * 3); colliders.push({ x, z, r: 2.4 }); }
  tent(-156, 104, 0x8a6a4a); tent(-144, 117, 0x5f7a55);
  tent(158, 114, 0xc86a4a); tent(172, 113, 0xd9b45a); tent(170, 127, 0x4f7f9a);
  const fire = m => { const f = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 5), new THREE.MeshBasicMaterial({ color: 0xffa040 })); add(f, m[0], height(m[0], m[1]) + 0.6, m[1]); const l = new THREE.PointLight(0xff9040, 30, 22); l.position.set(m[0], height(m[0], m[1]) + 2, m[1]); scene.add(l); return f; };
  const fires = [fire([-150, 110]), fire([165, 120])];

  function pillars(cx, cz, rad, n, color, tall) {
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU + 0.2, x = cx + Math.cos(a) * rad, z = cz + Math.sin(a) * rad, hh = tall * (0.45 + R() * 0.6);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, hh, 6), lam(color)), x, height(x, z) + hh / 2 - 0.2, z);
      colliders.push({ x, z, r: 1.3 });
    }
  }
  pillars(-235, 40, 23, 9, 0x6f7a5c, 8); pillars(240, 20, 23, 9, 0xbfe6dc, 9); pillars(-70, -255, 23, 9, 0xb9c6d6, 10);
  /* The Sunken Clock: a huge dial face half-buried in the glass. */
  const sunk = new THREE.Mesh(new THREE.TorusGeometry(14, 1.1, 6, 28), lam(0xd9b45a)); add(sunk, 240, 2.4, 20); sunk.rotation.set(-1.25, 0, 0.2);
  /* Monastery ruin. */
  [[52, -182, 12, 6, 0], [68, -182, 9, 4, 0], [48, -170, 8, 5, 1.57], [72, -171, 6, 7, 1.57]].forEach(([x, z, w, hh, ry]) => { add(new THREE.Mesh(new THREE.BoxGeometry(w, hh, 1.2), lam(0x9aa3b4)), x, 16 + hh / 2 - 0.3, z, ry); colliders.push({ x, z, r: 2 }); });
  /* Gravestones. */
  for (let i = 0; i < 14; i++) { const x = -62 + (R() * 2 - 1) * 11, z = 30 + (R() * 2 - 1) * 11; add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2 + R() * 0.5, 0.25), lam(0x8d8a96)), x, height(x, z) + 0.5, z, R() * 0.6 - 0.3); }

  /* The Spire and the Great Dial above it. */
  const spire = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 8, 80, 10), lam(0x6f6a82)); tower.position.y = 40; spire.add(tower);
  for (const [y, r] of [[14, 8.4], [36, 6.6], [58, 5.2]]) { const band = new THREE.Mesh(new THREE.TorusGeometry(r, 0.5, 6, 24), lam(0xd9b45a)); band.rotation.x = Math.PI / 2; band.position.y = y; spire.add(band); }
  const door = new THREE.Mesh(new THREE.BoxGeometry(3.4, 5.4, 0.6), new THREE.MeshBasicMaterial({ color: 0x1c1a2a })); door.position.set(0, 2.7, 7.6); spire.add(door);
  const seal = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.14, 6, 20), new THREE.MeshBasicMaterial({ color: 0x7fe6d6 })); seal.position.set(0, 3.2, 8); spire.add(seal);
  add(spire, 0, 9.8, -52); colliders.push({ x: 0, z: -52, r: 8.6 });
  pillars(0, -40, 34, 12, 0x77728a, 7);

  const dialMat = new THREE.MeshBasicMaterial({ color: 0xf2d9a0, fog: false });
  const dial = new THREE.Mesh(new THREE.TorusGeometry(250, 3.2, 6, 96), dialMat);
  dial.position.set(0, 150, -52); dial.rotation.set(-1.02, 0, 0.18); scene.add(dial);
  const ticks = new THREE.Group(); dial.add(ticks);
  for (let i = 0; i < 12; i++) { const t = new THREE.Mesh(new THREE.BoxGeometry(3, 26, 3), dialMat); const a = i / 12 * TAU; t.position.set(Math.cos(a) * 250, Math.sin(a) * 250, 0); t.rotation.z = a + Math.PI / 2; ticks.add(t); }
  const spark = new THREE.Mesh(new THREE.SphereGeometry(13, 14, 10), new THREE.MeshBasicMaterial({ color: 0xfff0c0, fog: false }));
  const halo = new THREE.Mesh(new THREE.SphereGeometry(24, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffb060, fog: false, transparent: true, opacity: 0.28 }));
  spark.add(halo); dial.add(spark);
  let sparkA = 0.42, sparkTo = 0.42;
  const placeSpark = () => spark.position.set(Math.cos(sparkA) * 250, Math.sin(sparkA) * 250, 0);
  placeSpark();

  /* ---- sky ---- */
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() } },
    vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 hor; varying float h; void main(){ float t = pow(clamp(h*1.25+0.05,0.0,1.0),0.6); gl_FragColor = vec4(mix(hor, top, t),1.0); }',
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 20, 12), skyMat); scene.add(sky);
  const sp = new Float32Array(900 * 3);
  for (let i = 0; i < 900; i++) { const a = R() * TAU, e = Math.acos(R() * 0.95); sp[i * 3] = Math.sin(e) * Math.cos(a) * 1400; sp[i * 3 + 1] = Math.cos(e) * 1400; sp[i * 3 + 2] = Math.sin(e) * Math.sin(a) * 1400; }
  const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false }));
  scene.add(stars);

  const sun = new THREE.DirectionalLight(0xffffff, 1.5); scene.add(sun); scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1); scene.add(hemi);
  scene.fog = new THREE.Fog(0xffffff, 60, 520);

  /* Drifting motes: stopped time, hanging in the air. */
  const MN = 160, mp = new Float32Array(MN * 3), ms = [];
  for (let i = 0; i < MN; i++) { mp[i * 3] = (R() - 0.5) * 80; mp[i * 3 + 1] = R() * 14; mp[i * 3 + 2] = (R() - 0.5) * 80; ms.push(R() * TAU); }
  const moteGeo = new THREE.BufferGeometry(); moteGeo.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ color: 0xffe2a8, size: 0.1, transparent: true, opacity: 0.8, depthWrite: false }));
  motes.frustumCulled = false; scene.add(motes);

  const cur = { top: C(PHASES[0].top), hor: C(PHASES[0].hor), fog: C(PHASES[0].fog), sun: C(PHASES[0].sun), sky: C(PHASES[0].sky), gnd: C(PHASES[0].gnd), si: PHASES[0].si, hi: PHASES[0].hi, stars: PHASES[0].stars };
  let target = PHASES[0];
  const apply = () => {
    skyMat.uniforms.top.value.copy(cur.top); skyMat.uniforms.hor.value.copy(cur.hor);
    scene.fog.color.copy(cur.fog); sun.color.copy(cur.sun); sun.intensity = cur.si * 1.5;
    hemi.color.copy(cur.sky); hemi.groundColor.copy(cur.gnd); hemi.intensity = cur.hi * 3.4; stars.material.opacity = cur.stars;
  };
  const v3 = new THREE.Vector3();
  const blockers = [...kinds.pine.list, ...kinds.oak.list, ...kinds.shard.list];
  /* Fights clear the scenery between the camera and the fighters, then put it back. */
  const hiddenTrees = [], m4 = new THREE.Matrix4(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  function hideScenery(test) {
    for (const k of Object.values(kinds)) k.list.forEach((t, i) => {
      if (!test(t)) return;
      for (const im of k.meshes) { im.getMatrixAt(i, m4); hiddenTrees.push([im, i, m4.clone()]); im.setMatrixAt(i, zero); im.instanceMatrix.needsUpdate = true; }
    });
  }
  function showScenery() { for (const [im, i, m] of hiddenTrees) { im.setMatrixAt(i, m); im.instanceMatrix.needsUpdate = true; } hiddenTrees.length = 0; }
  return {
    colliders, map, seal, door, blockers, hideScenery, showScenery,
    setPhase(p, instant) {
      target = PHASES[clamp(p, 0, 4)]; sparkTo = 0.42 + p * 0.55;
      if (instant) { for (const k of ['top', 'hor', 'fog', 'sun', 'sky', 'gnd']) cur[k].set(target[k]); cur.si = target.si; cur.hi = target.hi; cur.stars = target.stars; sparkA = sparkTo; placeSpark(); apply(); }
    },
    update(dt, t, cam) {
      const k = Math.min(1, dt * 0.5);
      for (const key of ['top', 'hor', 'fog', 'sun', 'sky', 'gnd']) cur[key].lerp(tmpC.set(target[key]), k);
      cur.si = lerp(cur.si, target.si, k); cur.hi = lerp(cur.hi, target.hi, k); cur.stars = lerp(cur.stars, target.stars, k);
      if (Math.abs(sparkTo - sparkA) > 0.001) { sparkA = lerp(sparkA, sparkTo, k * 0.6); placeSpark(); }
      apply();
      sky.position.copy(cam.position); stars.position.copy(cam.position);
      spark.getWorldPosition(v3);
      sun.target.position.copy(cam.position); sun.position.copy(cam.position).add(v3.sub(cam.position).normalize().multiplyScalar(100));
      halo.scale.setScalar(1 + Math.sin(t * 1.3) * 0.08);
      fires.forEach((f, i) => f.scale.setScalar(1 + Math.sin(t * 9 + i) * 0.15));
      const a = moteGeo.attributes.position;
      for (let i = 0; i < MN; i++) {
        let x = a.getX(i), y = a.getY(i) + Math.sin(t * 0.6 + ms[i]) * dt * 0.3, z = a.getZ(i);
        if (x - cam.position.x > 40) x -= 80; else if (x - cam.position.x < -40) x += 80;
        if (z - cam.position.z > 40) z -= 80; else if (z - cam.position.z < -40) z += 80;
        a.setXYZ(i, x, y, z);
      }
      a.needsUpdate = true;
      motes.position.y = cam.position.y - 6;
    },
  };
}
