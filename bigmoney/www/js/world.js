// Loads the Blender exports, dresses a few materials the exporter can't express, and answers "can I stand here?".
import * as THREE from './vendor/three.module.min.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { G, NPC_LOOKS } from './state.js';
import { makeAvatar, prop } from './avatar.js';

function carpetTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#6e1424'; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = '#c9983a'; x.lineWidth = 5;
  for (const [ox, oy] of [[0, 0], [128, 128], [-128, 128], [128, -128], [256, 0], [0, 256], [256, 256]]) {
    x.beginPath(); x.moveTo(ox + 64, oy); x.lineTo(ox + 128, oy + 64); x.lineTo(ox + 64, oy + 128); x.lineTo(ox, oy + 64); x.closePath(); x.stroke();
    x.fillStyle = '#8f1c30'; x.fill();
    x.fillStyle = '#e0b040'; x.beginPath(); x.arc(ox + 64, oy + 64, 9, 0, 7); x.fill();
  }
  x.fillStyle = '#4a0c18';
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.beginPath(); x.arc(i * 64, j * 64 + (i % 2 ? 0 : 0), 5, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function rippleTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#1b7ea6'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) {
    x.strokeStyle = `rgba(${150 + Math.random() * 100},240,255,${0.08 + Math.random() * 0.2})`;
    x.lineWidth = 1 + Math.random() * 2;
    const px = Math.random() * 256, py = Math.random() * 256, w = 20 + Math.random() * 50;
    for (const dx of [-256, 0, 256]) { x.beginPath(); x.ellipse(px + dx, py, w, w * 0.25, 0, 0, 7); x.stroke(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export async function loadWorld(onProgress) {
  const loader = new GLTFLoader();
  const get = (url, w) => new Promise((ok, bad) => loader.load(url, ok, e => onProgress && e.total && onProgress(w, e.loaded / e.total), bad));
  const [layout, casino, props] = await Promise.all([fetch('assets/layout.json').then(r => r.json()), get('assets/casino.glb', 0), get('assets/props.glb', 1)]);
  G.layout = layout;
  for (const o of props.scene.children) G.props[o.name] = o;
  const scene = G.scene;
  scene.add(casino.scene);
  const seen = new Set();
  casino.scene.traverse(m => {
    if (!m.isMesh || seen.has(m.material)) return;
    seen.add(m.material);
    const mt = m.material, n = mt.name;
    if (n === 'carpet') { mt.map = carpetTexture(); mt.color.set('#ffffff'); mt.needsUpdate = true; }
    else if (n === 'water') { mt.map = G.waterTex = rippleTexture(); mt.color.set('#ffffff'); mt.transparent = true; mt.opacity = 0.84; mt.roughness = 0.1; mt.metalness = 0.3; mt.depthWrite = false; mt.needsUpdate = true; }
    else if (n === 'glass') { mt.transparent = true; mt.opacity = 0.25; mt.depthWrite = false; }
    else if (n === 'gold') { mt.emissive.set('#7a5206'); mt.emissiveIntensity = 1; }
  });
  for (const o of Object.values(G.props)) o.traverse(m => { if (m.isMesh && m.material.name === 'glass') { m.material.transparent = true; m.material.opacity = 0.35; m.material.depthWrite = false; } else if (m.isMesh && m.material.name === 'gold') { m.material.emissive.set('#7a5206'); m.material.emissiveIntensity = 1; } });

  // gold and chrome need something to reflect: a soft warm room painted on a canvas
  const ec = document.createElement('canvas'); ec.width = 256; ec.height = 128;
  const ex = ec.getContext('2d'), gr = ex.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, '#fff1d6'); gr.addColorStop(0.35, '#b8683a'); gr.addColorStop(0.6, '#5a1a2a'); gr.addColorStop(1, '#2a0c14');
  ex.fillStyle = gr; ex.fillRect(0, 0, 256, 128);
  ex.fillStyle = '#fffbe8'; for (let i = 0; i < 8; i++) ex.fillRect(i * 32 + 6, 14, 18, 10);
  const et = new THREE.CanvasTexture(ec); et.mapping = THREE.EquirectangularReflectionMapping; et.colorSpace = THREE.SRGBColorSpace;
  const pm = new THREE.PMREMGenerator(G.renderer);
  scene.environment = pm.fromEquirectangular(et).texture; scene.environmentIntensity = 0.9;
  pm.dispose(); et.dispose();
  scene.add(new THREE.AmbientLight('#ffe6d0', 0.7));
  scene.add(new THREE.HemisphereLight('#fff2e0', '#3a1826', 0.7));
  const sun = new THREE.DirectionalLight('#fff4e6', 1.5); sun.position.set(8, 20, 12); scene.add(sun);
  for (const [x, y, z, c, i, d] of layout.lights) { const l = new THREE.PointLight(c, i * 6, d, 1.4); l.position.set(x, y, z); scene.add(l); }

  // staff and the shop's mannequins
  G.npcs = [];
  const person = (n, look, name) => { const a = makeAvatar(look, name); a.root.position.set(n.x, 0, n.z); a.root.rotation.y = n.rot; scene.add(a.root); G.npcs.push(a); return a; };
  for (const n of layout.npcs) person(n, NPC_LOOKS[n.look], n.name);
  layout.shop.mannequins.forEach((n, i) => { const a = person(n, NPC_LOOKS['model' + (i + 1)], ''); a.root.position.y = 0.24; a.pose = i === 1 ? 5 : 0; });
  G.dollar = prop('dollar'); G.dollar.position.fromArray(layout.dollar); scene.add(G.dollar);
}

// Push a circle of radius r out of every wall and piece of furniture. Mutates p {x, z}.
export function collide(p, r) {
  const L = G.layout;
  for (let pass = 0; pass < 2; pass++) {
    for (const b of L.col) {
      const cx = Math.max(b[0], Math.min(p.x, b[2])), cz = Math.max(b[1], Math.min(p.z, b[3]));
      let dx = p.x - cx, dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) { const d = Math.sqrt(d2); p.x = cx + dx / d * r; p.z = cz + dz / d * r; } else {
        const l = p.x - b[0], rr = b[2] - p.x, t = p.z - b[1], bt = b[3] - p.z, m = Math.min(l, rr, t, bt);
        if (m === l) p.x = b[0] - r; else if (m === rr) p.x = b[2] + r; else if (m === t) p.z = b[1] - r; else p.z = b[3] + r;
      }
    }
    for (const c of L.cir) {
      const dx = p.x - c[0], dz = p.z - c[1], d = Math.hypot(dx, dz), m = r + c[2];
      if (d < m) { if (d < 1e-4) { p.x = c[0] + m; } else { p.x = c[0] + dx / d * m; p.z = c[1] + dz / d * m; } }
    }
  }
}

// Is this point inside something tall enough to hide the camera (a wall or pillar)?
export function inWall(x, z, pad = 0.25) {
  for (const b of G.layout.col) if (b[4] && x > b[0] - pad && x < b[2] + pad && z > b[1] - pad && z < b[3] + pad) return true;
  return false;
}
