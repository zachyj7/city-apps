/* Shared look: cel-shaded materials and a builder that merges many coloured shapes into one mesh. */
import * as THREE from './vendor/three.module.min.js';

const ramp = new THREE.DataTexture(new Uint8Array([105, 165, 215, 255]), 4, 1, THREE.RedFormat);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true;

const cache = new Map();
/* One shared toon material per colour (and option set), so thousands of parts cost few shader programs. */
export function toon(color, extra) {
  const key = color + (extra ? JSON.stringify(extra) : '');
  let m = cache.get(key);
  if (!m) { m = new THREE.MeshToonMaterial(Object.assign({ color, gradientMap: ramp }, extra)); cache.set(key, m); }
  return m;
}
export const glow = color => { const k = 'g' + color; let m = cache.get(k); if (!m) { m = new THREE.MeshBasicMaterial({ color }); cache.set(k, m); } return m; };
/* Material for merged, vertex-coloured meshes. */
export const VC = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp });
export const VC2 = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp, side: THREE.DoubleSide });

const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3(), V = new THREE.Vector3(), N3 = new THREE.Matrix3(), C = new THREE.Color();
const prim = new Map();
const cached = (k, f) => { let g = prim.get(k); if (!g) { g = f(); if (g.index) g = g.toNonIndexed(); prim.set(k, g); } return g; };
export const G = {
  box: (w, h, d) => cached(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)),
  cyl: (rt, rb, h, n = 8) => cached(`c${rt},${rb},${h},${n}`, () => new THREE.CylinderGeometry(rt, rb, h, n)),
  cone: (r, h, n = 8) => cached(`k${r},${h},${n}`, () => new THREE.ConeGeometry(r, h, n)),
  sph: (r, w = 10, h = 8) => cached(`s${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h)),
  dome: (r, w = 12) => cached(`d${r},${w}`, () => new THREE.SphereGeometry(r, w, 6, 0, Math.PI * 2, 0, Math.PI / 2)),
  ico: (r, d = 1) => cached(`i${r},${d}`, () => new THREE.IcosahedronGeometry(r, d)),
  tor: (r, t, n = 20) => cached(`t${r},${t},${n}`, () => new THREE.TorusGeometry(r, t, 6, n)),
  cap: (r, l) => cached(`p${r},${l}`, () => new THREE.CapsuleGeometry(r, l, 3, 8)),
};

export class Builder {
  constructor() { this.p = []; this.n = []; this.c = []; this.B = null; }
  /* Everything added after this is placed relative to (x,y,z), turned by ry and scaled by s. */
  at(x = 0, y = 0, z = 0, ry = 0, s = 1) { this.B = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(s, s, s)); return this; }
  /* Append a shape. o = {x,y,z, rx,ry,rz, s (uniform) or sx,sy,sz}. */
  add(geo, color, o = {}) {
    E.set(o.rx || 0, o.ry || 0, o.rz || 0); Q.setFromEuler(E);
    P.set(o.x || 0, o.y || 0, o.z || 0); S.set(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1);
    M.compose(P, Q, S); if (this.B) M.premultiply(this.B); N3.getNormalMatrix(M); C.set(color);
    const pa = geo.attributes.position.array, na = geo.attributes.normal.array, p = this.p, n = this.n, c = this.c;
    for (let i = 0; i < pa.length; i += 3) {
      V.set(pa[i], pa[i + 1], pa[i + 2]).applyMatrix4(M); p.push(V.x, V.y, V.z);
      V.set(na[i], na[i + 1], na[i + 2]).applyMatrix3(N3).normalize(); n.push(V.x, V.y, V.z);
      c.push(C.r, C.g, C.b);
    }
    return this;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    return g;
  }
  mesh(mat = VC) { return new THREE.Mesh(this.build(), mat); }
}
