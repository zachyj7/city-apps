/* Loads the Blender models (models/assets.glb) and turns them into game-ready data.
   Each model becomes a list of parts: plain arrays of positions, normals and colours, plus a role
   per vertex for parts the game tints (skin, roof, cloth...). Static things are merged into big
   meshes; moving things (people, creatures, chests) are built from their parts. */
import * as THREE from './vendor/three.module.min.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { DRACOLoader } from './vendor/DRACOLoader.js';
import { VC, useAssetHelpers } from './gfx.js';

export const A = {};
export const ROLES = ['', 'SKIN', 'TOP', 'BOT', 'TRIM', 'HAIR', 'HAT', 'CAPE', 'BOOT', 'METAL', 'M1', 'M2', 'M3', 'EYE', 'WALL', 'ROOF', 'CLOTH', 'BLOOM', 'GEM', 'WOOD'];
const RI = Object.fromEntries(ROLES.map((r, i) => [r, i]));
/* Colours used when the game gives no palette. */
export const DEF = { SKIN: 0xe8b48e, TOP: 0x2f8f86, BOT: 0x3a3344, TRIM: 0x7a5234, HAIR: 0x5a3a24, HAT: 0xd9b45a, CAPE: 0x8a3a55, BOOT: 0x4a3628, METAL: 0xb8bcc8,
  M1: 0x77738c, M2: 0x3a3848, M3: 0xffb040, EYE: 0x8ff6ff, WALL: 0xf2e6c8, ROOF: 0xc8763a, CLOTH: 0xc8443a, BLOOM: 0xffd24a, GEM: 0x7fe6d6, WOOD: 0x9a6a3a };

const tc = new THREE.Color();
export async function loadAssets(url, onProgress) {
  const draco = new DRACOLoader(); draco.setDecoderPath(new URL('./vendor/draco/', import.meta.url).href);
  const loader = new GLTFLoader(); loader.setDRACOLoader(draco);
  const gltf = await loader.loadAsync(url, e => onProgress && e.total && onProgress(e.loaded / e.total));
  const nodes = gltf.parser.json.nodes, nameOf = o => { const a = gltf.parser.associations.get(o); return a && a.nodes !== undefined ? nodes[a.nodes].name : null; };
  for (const root of gltf.scene.children) {
    const id = nameOf(root); if (!id) continue;
    const parts = [];
    const visit = (obj, parent) => {
      const nm = nameOf(obj);
      if (nm && nm.startsWith(id + '.')) {
        const p = { name: nm.slice(id.length + 1), parent, pos: obj.position.toArray(), P: [], N: [], C: [], R: [] };
        parts.push(p);
        obj.traverse(m => { if (m.isMesh && (m === obj || nameOf(m) === null || nameOf(m) === nm)) addMesh(p, m, obj); });
        for (const c of obj.children) if (nameOf(c) && nameOf(c) !== nm) visit(c, p.name);
        return;
      }
      for (const c of obj.children) visit(c, parent);
    };
    for (const c of root.children) visit(c, null);
    for (const p of parts) { p.P = new Float32Array(p.P); p.N = new Float32Array(p.N); p.C = new Float32Array(p.C); p.R = new Uint8Array(p.R); }
    A[id] = { parts, by: Object.fromEntries(parts.map(p => [p.name, p])) };
  }
  draco.dispose();
  return A;
}
const m4 = new THREE.Matrix4(), n3 = new THREE.Matrix3(), v = new THREE.Vector3();
function addMesh(p, mesh, partNode) {
  let g = mesh.geometry; if (g.index) g = g.toNonIndexed();
  /* mesh children of a multi-material node sit at identity inside it */
  m4.identity(); let o = mesh; while (o && o !== partNode) { o.updateMatrix(); m4.premultiply(o.matrix); o = o.parent; }
  n3.getNormalMatrix(m4);
  const name = (mesh.material && mesh.material.name) || '', role = name.startsWith('r_') ? RI[name.slice(2)] || 0 : 0;
  if (!role) tc.set('#' + (name.startsWith('c_') ? name.slice(2, 8) : 'ff00ff')).convertSRGBToLinear();
  const pa = g.attributes.position, na = g.attributes.normal;
  for (let i = 0; i < pa.count; i++) {
    v.fromBufferAttribute(pa, i).applyMatrix4(m4); p.P.push(v.x, v.y, v.z);
    v.fromBufferAttribute(na, i).applyMatrix3(n3).normalize(); p.N.push(v.x, v.y, v.z);
    p.C.push(tc.r, tc.g, tc.b); p.R.push(role);
  }
}

/* Absolute offset of a part (its own position plus its parents'). */
export function partOffset(a, p) { const o = [...p.pos]; let q = p.parent && a.by[p.parent]; while (q) { o[0] += q.pos[0]; o[1] += q.pos[1]; o[2] += q.pos[2]; q = q.parent && a.by[q.parent]; } return o; }

/* Colour a part with a palette: { ROLE: 0xrrggbb }. */
const cache = new Map();
export function colors(p, pal) {
  const C = new Float32Array(p.C);
  if (!p.R.some(r => r)) return C;
  const lin = {};
  for (let i = 0; i < p.R.length; i++) {
    const r = p.R[i]; if (!r) continue;
    let c = lin[r]; if (!c) { const key = ROLES[r]; c = lin[r] = tc.set((pal && pal[key] !== undefined ? pal[key] : DEF[key])).convertSRGBToLinear().toArray(); }
    C[i * 3] = c[0]; C[i * 3 + 1] = c[1]; C[i * 3 + 2] = c[2];
  }
  return C;
}
export function geometry(p, pal, shift) {
  const g = new THREE.BufferGeometry();
  let P = p.P;
  if (shift) { P = new Float32Array(P); for (let i = 0; i < P.length; i += 3) { P[i] -= shift[0]; P[i + 1] -= shift[1]; P[i + 2] -= shift[2]; } }
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(p.N, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colors(p, pal), 3));
  return g;
}
/* One merged geometry for the whole model (for scenery drawn by instancing). */
export function flatGeometry(id, pal) {
  const key = id + JSON.stringify(pal || 0);
  if (cache.has(key)) return cache.get(key);
  const a = A[id]; let n = 0; for (const p of a.parts) n += p.P.length;
  const P = new Float32Array(n), N = new Float32Array(n), C = new Float32Array(n); let k = 0;
  for (const p of a.parts) {
    const o = partOffset(a, p), c = colors(p, pal);
    for (let i = 0; i < p.P.length; i += 3) { P[k + i] = p.P[i] + o[0]; P[k + i + 1] = p.P[i + 1] + o[1]; P[k + i + 2] = p.P[i + 2] + o[2]; }
    N.set(p.N, k); C.set(c, k); k += p.P.length;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  g.computeBoundingSphere();
  cache.set(key, g);
  return g;
}
useAssetHelpers(partOffset, colors);

/* A posable model: a Group with one child Group per part, each holding its mesh. Parts are found in userData by name. */
export function instance(id, pal, mat = VC) {
  const a = A[id], root = new THREE.Group(), made = {};
  for (const p of a.parts) {
    const g = new THREE.Group(); g.name = p.name;
    g.position.fromArray(p.pos);
    if (p.P.length) g.add(new THREE.Mesh(geometry(p, pal), mat));
    (p.parent ? made[p.parent] : root).add(g);
    made[p.name] = g; root.userData[p.name] = g;
  }
  return root;
}
