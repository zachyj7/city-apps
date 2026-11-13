// Builds a person out of the Blender-made parts and animates the joints by hand.
import * as THREE from './vendor/three.module.min.js';
import { G, SKINS, HAIRS, OUTFITS } from './state.js';

const RIG = { hip: 0.86, legX: 0.11, neck: 0.72, shX: 0.31, shY: 0.58, hand: 0.6 };
const SLOTS = { hair: 'head', hat: 'head', eye: 'head', neck: 'torso', back: 'torso' };
const lerp = (a, b, t) => a + (b - a) * t;

export function prop(name) {
  const src = G.props[name];
  if (!src) return new THREE.Group();
  const o = src.clone(true);
  o.position.set(0, 0, 0);
  return o;
}

function nameTag(text) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.font = '600 30px system-ui, sans-serif';
  const w = Math.min(244, x.measureText(text).width + 28);
  x.fillStyle = 'rgba(10,6,12,.62)';
  x.beginPath(); x.roundRect((256 - w) / 2, 10, w, 44, 22); x.fill();
  x.fillStyle = '#ffe9b0'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, 128, 33, 230);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  s.scale.set(1.5, 0.375, 1);
  s.position.y = 2.25;
  return s;
}

export function makeAvatar(look, name) {
  const root = new THREE.Group(), body = new THREE.Group();
  body.scale.setScalar(0.92);
  root.add(body);
  const mats = {};
  const own = o => {   // give this person their own copies of the recolourable materials
    o.traverse(m => {
      if (!m.isMesh || !m.material.name.startsWith('av_') || m.material.name === 'av_eye') return;
      const n = m.material.name;
      if (!mats[n]) mats[n] = m.material.clone();
      m.material = mats[n];
    });
    return o;
  };
  const J = {};
  J.torso = own(prop('av_torso')); J.torso.position.y = RIG.hip; body.add(J.torso);
  J.head = own(prop('av_head')); J.head.position.y = RIG.neck; J.torso.add(J.head);
  for (const [k, sx] of [['armL', 1], ['armR', -1]]) { J[k] = own(prop('av_arm')); J[k].position.set(sx * RIG.shX, RIG.shY, 0); J.torso.add(J[k]); }
  for (const [k, sx] of [['legL', 1], ['legR', -1]]) { J[k] = own(prop('av_leg')); J[k].position.set(sx * RIG.legX, RIG.hip, 0); body.add(J[k]); }
  const hand = new THREE.Group(); hand.position.y = -RIG.hand; J.armR.add(hand);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.32, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03; root.add(shadow);
  let tag = null;
  const worn = {};
  const A = { root, J, hand, t: Math.random() * 10, walk: 0, held: null, heldName: '', look: null,
    setName(n) { if (tag) { root.remove(tag); tag.material.map.dispose(); } tag = n ? nameTag(n) : null; if (tag) root.add(tag); },
    setLook(lk) {
      A.look = lk = lk || {};
      const of = OUTFITS.find(o => o.id === lk.outfit) || OUTFITS[0];
      const set = (n, c, metal = 0, glow) => { const m = mats[n]; if (!m) return; m.color.set(c); m.metalness = metal; m.roughness = metal ? 0.3 : 0.7; m.emissive.set(glow || 0); m.emissiveIntensity = glow ? 1.6 : 0; };
      set('av_skin', SKINS[lk.skin | 0] || SKINS[0]);
      set('av_top', of.top, of.metal || 0);
      set('av_bottom', of.bottom, of.metal || 0);
      set('av_shoes', of.shoes, 0, of.glow && of.shoes);
      set('av_accent', of.accent, 0, of.glow);
      for (const slot in SLOTS) {
        if (worn[slot]) { worn[slot].parent.remove(worn[slot]); worn[slot] = null; }
        const id = lk[slot];
        if (!id || !G.props[id]) continue;
        worn[slot] = own(prop(id));
        J[SLOTS[slot]].add(worn[slot]);
      }
      set('av_hair', HAIRS[lk.hairColor | 0] || HAIRS[0]);
    },
    hold(n) {
      if (n === A.heldName) return;
      if (A.held) hand.remove(A.held);
      A.heldName = n; A.held = n ? prop(n) : null;
      if (A.held) { hand.add(A.held); A.held.rotation.x = n === 'rod' ? 1.9 : n === 'rifle' ? -Math.PI / 2 : n === 'drink' ? 0 : 0; }
    },
    // a: 0 stand/walk, 1 sitting, 2 fishing, 3 aiming a rifle, 4 dancing, 5 waving
    update(dt, speed, a) {
      A.t += dt;
      A.walk = lerp(A.walk, Math.min(1, speed / 3), Math.min(1, dt * 10));
      const t = A.t, w = A.walk, sw = Math.sin(t * (7 + w * 3)) * w;
      let lL = sw * 0.75, lR = -sw * 0.75, aL = -sw * 0.6, aR = sw * 0.6, aLz = 0.06, aRz = -0.06, ty = 0, trot = 0, hx = 0, by = Math.abs(Math.cos(t * (7 + w * 3))) * w * 0.04;
      if (a === 1) { lL = lR = -1.5; aL = aR = -0.85; by = 0; }
      else if (a === 2) { aR = -1.25 + Math.sin(t * 1.3) * 0.04; aL = -0.5; }
      else if (a === 3) { aR = -1.45; aL = -1.3; aLz = -0.5; aRz = 0.25; trot = 0.3; }
      else if (a === 4) { const d = t * 6; ty = Math.abs(Math.sin(d)) * 0.08; trot = Math.sin(d * 0.5) * 0.5; aL = -2.6 + Math.sin(d) * 0.5; aR = -2.6 - Math.sin(d) * 0.5; lL = Math.sin(d) * 0.4; lR = -Math.sin(d) * 0.4; hx = Math.sin(d) * 0.1; }
      else if (a === 5) { aR = -2.7; aRz = -0.4 + Math.sin(t * 9) * 0.35; }
      else { ty = Math.sin(t * 1.6) * 0.006; }
      const k = Math.min(1, dt * 14);
      J.legL.rotation.x = lerp(J.legL.rotation.x, lL, k); J.legR.rotation.x = lerp(J.legR.rotation.x, lR, k);
      J.armL.rotation.x = lerp(J.armL.rotation.x, aL, k); J.armR.rotation.x = lerp(J.armR.rotation.x, aR, k);
      J.armL.rotation.z = lerp(J.armL.rotation.z, aLz, k); J.armR.rotation.z = lerp(J.armR.rotation.z, aRz, k);
      J.torso.rotation.y = lerp(J.torso.rotation.y, trot, k);
      J.head.rotation.z = lerp(J.head.rotation.z, hx, k);
      body.position.y = by + ty;
      shadow.visible = root.position.y < 0.5;
    },
    dispose() { if (tag) tag.material.map.dispose(); for (const n in mats) mats[n].dispose(); },
  };
  A.setLook(look);
  if (name) A.setName(name);
  return A;
}
