/* Low-poly models for people, creatures and world objects. Every model faces +z. */
import * as THREE from './vendor/three.module.min.js';
import { TAU } from './util.js';

const lam = (color, extra) => new THREE.MeshLambertMaterial(Object.assign({ color, flatShading: true }, extra));
const basic = color => new THREE.MeshBasicMaterial({ color });
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const at = (mesh, x, y, z) => { mesh.position.set(x, y, z); return mesh; };
/* A limb that swings from its top end. */
function limb(w, len, m, x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  g.add(at(box(w, len, w, m), 0, -len / 2, 0));
  return g;
}
const EYE = 0x8ff6ff;

export function humanoid(o = {}) {
  const g = new THREE.Group(), cloth = lam(o.cloth ?? 0x4a6a9a), skin = lam(o.skin ?? 0xe6b99a), dark = lam(o.legs ?? 0x3a3344);
  const legs = [limb(0.24, 0.75, dark, -0.17, 0.75, 0), limb(0.24, 0.75, dark, 0.17, 0.75, 0)];
  const arms = [limb(0.2, 0.7, cloth, -0.42, 1.48, 0), limb(0.2, 0.7, cloth, 0.42, 1.48, 0)];
  const torso = at(box(0.66, 0.8, 0.38, cloth), 0, 1.14, 0);
  const head = at(new THREE.Mesh(new THREE.SphereGeometry(0.27, 8, 6), skin), 0, 1.8, 0);
  g.add(...legs, ...arms, torso, head);
  if (o.hair !== undefined) g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.29, 8, 6, 0, TAU, 0, 1.7), lam(o.hair)), 0, 1.84, -0.03));
  if (o.hat !== undefined) { const h = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.5, 8), lam(o.hat)); g.add(at(h, 0, 2.18, 0)); }
  if (o.hood !== undefined) { const h = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.62, 6), lam(o.hood)); g.add(at(h, 0, 2.02, -0.05)); }
  if (o.cloak !== undefined) g.add(at(box(0.72, 1.05, 0.08, lam(o.cloak)), 0, 1.02, -0.25));
  if (o.eyes) for (const x of [-0.1, 0.1]) g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.05, 5, 4), basic(o.eyes)), x, 1.83, 0.24));
  if (o.ring) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 6, 16), basic(0x7fe6d6)); r.position.set(0, -0.72, 0.1); arms[1].add(r); g.userData.ring = r; }
  if (o.halo) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.05, 6, 24), basic(0xfff0c0)); r.position.set(0, 1.5, -0.3); g.add(r); g.userData.halo = r; }
  g.userData.legs = legs; g.userData.arms = arms;
  g.scale.setScalar(o.scale ?? 1);
  return g;
}

function quadruped(o) {
  const g = new THREE.Group(), m = lam(o.color), d = lam(o.dark ?? 0x2e2a3a);
  g.add(at(box(0.7, 0.62, 1.5, m), 0, 0.95, 0));
  const head = at(box(0.5, 0.5, 0.62, m), 0, 1.25, 0.95); g.add(head);
  g.add(at(box(0.3, 0.26, 0.36, d), 0, 1.15, 1.36));
  for (const x of [-0.14, 0.14]) g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.06, 5, 4), basic(EYE)), x, 1.36, 1.27));
  for (const x of [-0.17, 0.17]) g.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 4), d), x, 1.62, 0.82));
  const legs = [limb(0.2, 0.7, d, -0.24, 0.7, 0.55), limb(0.2, 0.7, d, 0.24, 0.7, -0.55), limb(0.2, 0.7, d, 0.24, 0.7, 0.55), limb(0.2, 0.7, d, -0.24, 0.7, -0.55)];
  g.add(...legs);
  const tail = at(box(0.14, 0.14, 0.6, d), 0, 1.1, -1); tail.rotation.x = 0.5; g.add(tail);
  if (o.antlers) for (const s of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(s * 0.2, 1.5, 0.9);
    const bm = lam(0xe9e2c8, { emissive: 0x3a5a66 });
    const main = at(box(0.09, 1.1, 0.09, bm), 0, 0.5, 0); a.add(main);
    for (let i = 0; i < 3; i++) { const t = at(box(0.07, 0.5, 0.07, bm), s * 0.18, 0.4 + i * 0.3, 0); t.rotation.z = -s * 0.9; a.add(t); }
    a.rotation.z = -s * 0.45; g.add(a);
  }
  g.userData.legs = legs;
  return g;
}

function floater(o) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body); body.position.y = 1.5;
  const m = lam(o.color, { transparent: true, opacity: o.opacity ?? 0.9, emissive: o.emissive ?? 0x000000 });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.5, 6), m); cone.rotation.x = Math.PI; body.add(cone);
  body.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.34, 7, 6), m), 0, 0.85, 0));
  for (const x of [-0.12, 0.12]) body.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.06, 5, 4), basic(EYE)), x, 0.9, 0.3));
  const wings = [];
  if (o.wings) for (const s of [-1, 1]) {
    const w = new THREE.Group(); w.position.set(s * 0.2, 0.4, -0.1);
    const p = new THREE.Mesh(new THREE.CircleGeometry(0.8, 5), lam(o.wings, { side: THREE.DoubleSide, transparent: true, opacity: 0.8 }));
    p.position.x = s * 0.7; p.scale.y = 1.4; w.add(p); body.add(w); wings.push(w);
  }
  g.userData.float = body; g.userData.wings = wings;
  return g;
}

function golem(o) {
  const g = new THREE.Group(), m = lam(o.color), d = lam(o.dark ?? 0x555a6a);
  g.add(at(box(1.5, 1.3, 1, m), 0, 1.75, 0));
  g.add(at(box(0.6, 0.5, 0.6, d), 0, 2.65, 0.1));
  for (const x of [-0.14, 0.14]) g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.07, 5, 4), basic(EYE)), x, 2.7, 0.42));
  const legs = [limb(0.5, 1.1, d, -0.42, 1.1, 0), limb(0.5, 1.1, d, 0.42, 1.1, 0)];
  const arms = [limb(0.48, 1.5, m, -1.05, 2.3, 0), limb(0.48, 1.5, m, 1.05, 2.3, 0)];
  g.add(...legs, ...arms);
  if (o.crystal) for (let i = 0; i < 4; i++) {
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.4, 0), lam(o.crystal, { emissive: o.crystal, emissiveIntensity: 0.35 }));
    c.scale.y = 2; c.position.set(-0.6 + i * 0.4, 2.6, -0.35); c.rotation.z = (i - 1.5) * 0.3; g.add(c);
  }
  g.userData.legs = legs; g.userData.arms = arms;
  return g;
}

function crab(o) {
  const g = new THREE.Group(), m = lam(o.color, { emissive: 0x16403c }), d = lam(0x5a8f88);
  const shell = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), m); shell.scale.set(1.2, 0.5, 1); shell.position.y = 0.7; g.add(shell);
  for (const x of [-0.2, 0.2]) g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.07, 5, 4), basic(EYE)), x, 0.95, 0.6));
  const arms = [];
  for (const s of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(s * 0.9, 0.7, 0.4);
    const claw = new THREE.Mesh(new THREE.OctahedronGeometry(0.4, 0), m); claw.scale.set(0.7, 0.6, 1.4); claw.position.z = 0.6; a.add(claw); g.add(a); arms.push(a);
    for (let i = 0; i < 3; i++) { const l = at(box(0.1, 0.6, 0.1, d), s * (0.9 + i * 0.08), 0.32, -0.4 + i * 0.35); l.rotation.z = s * 0.5; g.add(l); }
  }
  g.userData.claws = arms;
  return g;
}

function scarecrow() {
  const g = humanoid({ cloth: 0x9a7a4a, skin: 0xd9c38a, legs: 0x6a4a33, hat: 0x5a4030, eyes: EYE });
  g.add(at(box(0.12, 2.2, 0.12, lam(0x6a4a33)), 0, 1, -0.2));
  g.userData.arms.forEach((a, i) => { a.rotation.z = (i ? 1 : -1) * 1.4; });
  g.userData.legs = null; g.userData.arms = null;
  return g;
}

const STILLED = { cloth: 0x6a6480, skin: 0x9a98b0, legs: 0x3d3a50, eyes: EYE };
export function enemyModel(kind) {
  switch (kind) {
    case 'scarecrow': return scarecrow();
    case 'husk': return humanoid({ ...STILLED, hood: 0x4a4660 });
    case 'wolf': return quadruped({ color: 0x77738c });
    case 'moth': return floater({ color: 0xcfc6e8, wings: 0xa9e6dc, emissive: 0x2a3a55 });
    case 'barkling': return golem({ color: 0x5a4a38, dark: 0x3a4a30, crystal: 0x6fd08a });
    case 'crab': return crab({ color: 0x9fe6d6 });
    case 'wraith': return floater({ color: 0xd9c9a0, opacity: 0.7, emissive: 0x554a30 });
    case 'golem': return golem({ color: 0xb9c9dc, dark: 0x7a8aa0, crystal: 0x9fdcff });
    case 'rimewraith': return floater({ color: 0xbfe0ff, opacity: 0.75, emissive: 0x2a4a70, wings: 0xe6f4ff });
    case 'gravedial': return humanoid({ cloth: 0x2a2838, skin: 0xb0b0c8, legs: 0x1c1a28, hood: 0x2a2838, cloak: 0x3d3a50, eyes: 0xffd58a, halo: true, scale: 1.25 });
    case 'antlerking': { const q = quadruped({ color: 0x5f6f66, dark: 0x2e3a36, antlers: true }); q.scale.setScalar(2.2); return q; }
    case 'hourglass': { const q = golem({ color: 0xa9e0d2, dark: 0xd9b45a, crystal: 0xf2b6c8 }); q.scale.setScalar(1.7); return q; }
    case 'rimewarden': { const q = golem({ color: 0xdfeaf6, dark: 0x5a6a8a, crystal: 0x7fc6ff }); q.scale.setScalar(2.1); return q; }
    case 'oren': return humanoid({ cloth: 0x3d4a7a, skin: 0xd9b89a, legs: 0x2a2838, hair: 0xd9d9e0, cloak: 0xd9b45a, halo: true, ring: true, scale: 1.3 });
  }
  return humanoid(STILLED);
}

/* Shared walk / idle animation. `swing` 0..1 plays an attack lunge. */
export function animate(m, t, moving, swing = 0) {
  const u = m.userData, s = moving ? Math.sin(t * 11) * 0.7 : 0;
  if (u.legs) u.legs.forEach((l, i) => { l.rotation.x = i % 2 ? -s : s; });
  if (u.arms) { u.arms[0].rotation.x = -s * 0.8; u.arms[1].rotation.x = s * 0.8 - Math.sin(swing * Math.PI) * 2.2; }
  if (u.float) { u.float.position.y = 1.5 + Math.sin(t * 2.2 + m.id) * 0.18; u.float.rotation.x = Math.sin(swing * Math.PI) * 0.6; }
  if (u.wings) u.wings.forEach((w, i) => { w.rotation.y = (i ? -1 : 1) * Math.sin(t * 16) * 0.7; });
  if (u.claws) u.claws.forEach((c, i) => { c.rotation.y = (i ? -1 : 1) * (0.3 + Math.sin(t * 3) * 0.15) ; c.rotation.x = -Math.sin(swing * Math.PI) * 0.9; });
  if (u.halo) u.halo.rotation.z = t * 0.8;
}

/* ---- world objects ---- */
export function chest(big) {
  const g = new THREE.Group(), wood = lam(big ? 0x6a3f6a : 0x7a5230), trim = lam(0xd9b45a);
  g.add(at(box(1.1, 0.6, 0.75, wood), 0, 0.3, 0));
  const lid = new THREE.Group(); lid.position.set(0, 0.6, -0.37);
  lid.add(at(box(1.14, 0.3, 0.79, wood), 0, 0.15, 0.37)); lid.add(at(box(0.2, 0.26, 0.1, trim), 0, 0.05, 0.78));
  g.add(lid); g.userData.lid = lid;
  return g;
}
export function waystone() {
  const g = new THREE.Group();
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 3.4, 6), lam(0x8d8a9a)), 0, 1.7, 0));
  const r = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.1, 6, 24), basic(0x555a66)); r.position.y = 3.2; g.add(r);
  const d = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), basic(0x555a66)); d.position.set(1.15, 3.2, 0); g.add(d);
  g.userData.ring = r; g.userData.dot = d;
  return g;
}
export function minute() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), basic(0xfff0c0)); core.position.y = 1.2; g.add(core);
  const r = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.04, 5, 18), basic(0xffc66a)); r.position.y = 1.2; g.add(r);
  g.userData.spin = [core, r];
  return g;
}
export function page() {
  const g = new THREE.Group();
  const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.04), basic(0xf4ead0)); p.position.y = 1.1; p.rotation.x = -0.3; g.add(p);
  const r = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.03, 5, 18), basic(0x7fe6d6)); r.position.y = 1.1; r.rotation.x = Math.PI / 2; g.add(r);
  g.userData.spin = [p];
  return g;
}
export function herb(color) {
  const g = new THREE.Group();
  g.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 5), lam(0x4b8a45)), 0, 0.3, 0));
  g.add(at(new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 0), lam(color, { emissive: color, emissiveIntensity: 0.5 })), 0, 0.72, 0));
  return g;
}
export function bell() {
  const g = new THREE.Group(), wood = lam(0x6a4a33);
  g.add(at(box(0.25, 3, 0.25, wood), -1, 1.5, 0), at(box(0.25, 3, 0.25, wood), 1, 1.5, 0), at(box(2.4, 0.25, 0.3, wood), 0, 3, 0));
  const b = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.95, 8, 1, true), lam(0xd9b45a, { side: THREE.DoubleSide })); b.position.y = 2.3; g.add(b);
  g.userData.bell = b;
  return g;
}
export function crate() {
  const g = new THREE.Group();
  g.add(at(box(1, 1, 1, lam(0x9a6a3a)), 0, 0.45, 0)); g.add(at(box(1.04, 0.14, 1.04, lam(0xc86a4a)), 0, 0.6, 0));
  g.rotation.set(0.15, 0.6, 0.1);
  return g;
}
export function marker() {
  const m = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 4), basic(0xffd58a));
  m.rotation.x = Math.PI;
  return m;
}
