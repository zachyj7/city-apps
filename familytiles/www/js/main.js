// Family Tiles: what each player sees and touches.
import { Net } from './net.js';
import { Video } from './video.js';
import { initHelp } from './help.js';
import { initStats } from './stats.js';
import { tile, analyze, openingPoints, checkTurn, groupsOf, tidyPos, autoSplit, COLOR_NAMES, OPEN_POINTS, BOARD_W } from './rules.js';

// Rack colors to pick from. hi/base/lo/deep shade the plastic, ink is the pressed-in name, text is printing on it.
const RACKS = {
  yellow: { label: 'Yellow', hi: '#ffe14d', base: '#f7c600', lo: '#d9a800', deep: '#a67f00', ink: '#8f6c00', text: '#3a2c00' },
  red:    { label: 'Red',    hi: '#ff8a80', base: '#e3262a', lo: '#bb1a1e', deep: '#7d0e10', ink: '#8a1012', text: '#2e0000' },
  blue:   { label: 'Blue',   hi: '#7db4ff', base: '#2472e6', lo: '#1857b5', deep: '#0d3570', ink: '#0d3570', text: '#001433' },
  green:  { label: 'Green',  hi: '#7fe39a', base: '#25a84e', lo: '#18843b', deep: '#0d5224', ink: '#0b4a20', text: '#00240c' },
  pink:   { label: 'Pink',   hi: '#ffc2e0', base: '#ff6eb6', lo: '#e04a96', deep: '#a3265f', ink: '#8a1a52', text: '#3a0020' },
  purple: { label: 'Purple', hi: '#c9a6ff', base: '#9257ff', lo: '#7136e6', deep: '#43169a', ink: '#3a1088', text: '#16003d' },
  black:  { label: 'Black',  hi: '#6b6b6b', base: '#333333', lo: '#222222', deep: '#000000', ink: '#141414', text: '#f2f2f2' },
  white:  { label: 'White',  hi: '#ffffff', base: '#ebebeb', lo: '#cfcfcf', deep: '#9a9a9a', ink: '#9a9a9a', text: '#1a1a1a' },
};
const rackStyle = rc => { const r = RACKS[rc] || RACKS.yellow; return `--rk-hi:${r.hi};--rk:${r.base};--rk-lo:${r.lo};--rk-deep:${r.deep};--rk-ink:${r.ink};--rk-text:${r.text}`; };
const swatches = (cur, act) => Object.entries(RACKS).map(([k, r]) =>
  `<button type="button" class="swatch ${k === cur ? 'on' : ''}" data-${act}="${k}" style="${rackStyle(k)}" aria-pressed="${k === cur}" aria-label="${r.label} rack"><span class="sw-top"></span><span class="sw-edge">${r.label}</span></button>`).join('');

const $ = s => document.querySelector(s);
const qs = new URLSearchParams(location.search);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem('ft-' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('ft-' + k, JSON.stringify(v)); } catch (e) { /* private window */ } },
};
function saveRc() { store.set('rc', A.rc); try { sessionStorage.setItem('ft-rc', A.rc); } catch (e) { /* ignore */ } }
const pid = (() => {
  const make = () => Math.random().toString(36).slice(2, 10);
  try { let p = sessionStorage.getItem('ft-pid'); if (!p) { p = make(); sessionStorage.setItem('ft-pid', p); } return p; }
  catch (e) { return make(); }
})();
const ic = n => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const LEVEL_NAMES = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
const cleanCode = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);

const A = {
  S: null, net: null, video: null, name: '', code: '',
  W: null,            // my turn in progress: { turnNo, pos: {id: [x, y]}, rack: [ids], startTable, startPos, startRack }
  hist: [], sel: new Set(), order: [], seen: new Set(), fresh: new Map(), loose: new Set(), bu: null,
  vol: store.get('vol', {}), sound: store.get('sound', true), sortUndo: null, grid: null, cols: 7, rc: (() => { try { return sessionStorage.getItem('ft-rc'); } catch (e) { return null; } })() || store.get('rc', 'yellow'), lastFx: null, lastAlert: null, lastShame: null, fit: false, drag: null, camOn: false, micOn: true, zoom: store.get('zoom', 1), shapes: store.get('shapes', true),
  status: 'connecting',
};
window.FT = A;   // for testing from the console
let setKey = 1;

/* ---------------- joining ---------------- */

function setupJoin() {
  let tabName = null;
  try { tabName = sessionStorage.getItem('ft-name'); } catch (e) { /* ignore */ }
  $('#name').value = tabName || store.get('name', '');
  $('#code').value = cleanCode(qs.get('room')) || store.get('code', '') || 'family';
  $('#joinForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#name').value.trim().slice(0, 18);
    const code = cleanCode($('#code').value);
    if (!name) { $('#name').focus(); $('#joinErr').textContent = 'Please type your name.'; return; }
    if (!code) { $('#code').focus(); $('#joinErr').textContent = 'Please type a table name, like family.'; return; }
    store.set('name', name); store.set('code', code);
    try { sessionStorage.setItem('ft-name', name); } catch (e) { /* ignore */ }
    start(name, code);
  });
  const pick = $('#rcPick');
  const paint = () => { pick.innerHTML = swatches(A.rc, 'rc'); };
  paint();
  pick.addEventListener('click', e => { const b = e.target.closest('[data-rc]'); if (b) { A.rc = b.dataset.rc; saveRc(); paint(); } });
  if (qs.has('auto') && $('#name').value) $('#joinForm').requestSubmit();
}

function start(name, code) {
  A.name = name; A.code = code;
  const u = new URL(location.href); u.searchParams.set('room', code); u.searchParams.delete('auto');
  history.replaceState(null, '', u);
  $('#join').hidden = true; $('#game').hidden = false;
  $('#tableName').textContent = code;
  applyZoom();
  A.grid = loadGrid();
  if (!A.video) { A.video = new Video(() => renderSeats()); A.video.init(); }
  A.net = new Net(code, {
    onStatus: s => { A.status = s; renderStatus(); },
    onOpen: () => { laySent = ''; hello(); },
    onMsg: m => {
      if (m.t === 'state') setState(m.s);
      else if (m.t === 'nope') { toast(m.why); beep(220, 0.25); }
      else if (m.t === 'relay') help.rx(m.from, m.m);
      else if (m.t === 'closed') {
        // Someone closed the table: forget this game so it can't come back, and go to the join screen.
        try { sessionStorage.removeItem(snapKey()); sessionStorage.removeItem(gridKey()); } catch (e) { /* ignore */ }
        A.grid = null;
        const hosting = !!(A.net && A.net.room);
        // The host waits a moment so the message reaches everyone before its connection closes.
        setTimeout(() => leaveTable(`${m.by} closed the table. Join again to start fresh.`), hosting ? 1200 : 0);
      }
    },
    onLost: () => {},
    onPeer: peer => A.video.setPeer(peer),
    snapshot,
  });
  A.net.start();
  renderAll();
  if (qs.has('fakecam')) toggleCam();
}

// The last game we saw, kept across a reload so the game survives anyone (even the host) refreshing.
const snapKey = () => 'ft-snap-' + A.code;
function saveSnap(S) { try { sessionStorage.setItem(snapKey(), JSON.stringify(S)); } catch (e) { /* full or private */ } }
function loadSnap() { try { return JSON.parse(sessionStorage.getItem(snapKey())); } catch (e) { return null; } }
function snapshot() { return A.S || loadSnap(); }

function hello() {
  const snap = snapshot();
  A.net.send({ t: 'hello', pid, name: A.name, rc: A.rc, snap: snap && snap.round ? snap : null, peer: A.net.peer && A.net.peer.id, cam: A.camOn, mic: A.camOn && A.micOn && A.video.hasMic() });
}
function send(m) { A.net && A.net.send(m); }

/* ---------------- state ---------------- */

const me = () => A.S && A.S.players.find(p => p.pid === pid);
const myTurn = () => !!(A.S && A.S.phase === 'play' && A.S.turn === pid);
const seated = () => A.S ? A.S.players.filter(p => p.seat) : [];

function setState(S) {
  const was = A.S;
  A.S = S;
  if (A.fit && (S.phase !== 'play' || (was && was.turnNo !== S.turnNo))) A.fit = false;
  saveSnap(S);
  const m = me();
  // Keep my own rack order; a newly drawn tile goes on the end and glows once.
  if (m) {
    const rack = new Set(m.rack);
    const keep = A.order.filter(id => rack.has(id));
    const added = m.rack.filter(id => !keep.includes(id));
    A.order = keep.concat(added);
    // Only a tile that really is new to my rack glows (not tiles coming back from the table).
    const prev = was && was.players.find(p => p.pid === pid);
    if (prev && was.phase === 'play' && S.phase === 'play' && was.round === S.round) {
      const had = new Set(prev.rack);
      const drawn = m.rack.filter(id => !had.has(id));
      if (drawn.length === 1) A.fresh.set(drawn[0], Date.now());
    } else A.fresh.clear();
  }
  if (myTurn()) {
    if (!A.W || A.W.turnNo !== S.turnNo) beginTurn();
  } else {
    if (A.W) A.sel.clear();
    A.W = null; A.hist = []; A.loose.clear(); clearTimeout(settleT);
  }
  if (S.phase === 'play' && was && was.turn !== S.turn && S.turn === pid) beep(660, 0.15, 880);
  if (S.phase === 'over' && was && was.phase === 'play' && S.result && S.result.pid) { confetti(); [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => beep(f, 0.22), i * 120)); }
  if (S.fx && S.fx.k !== A.lastFx) { if (A.lastFx !== null || (was && was.v < S.fx.k)) showMJ(S.fx.name); A.lastFx = S.fx.k; }
  else if (A.lastFx === null) A.lastFx = S.fx ? S.fx.k : 0;
  // Someone is down to their last few tiles: everyone gets a notice (not for one that happened before we arrived).
  const sk = S.shame ? S.shame.k : 0;
  if (A.lastShame !== null && S.shame && sk !== A.lastShame) showShame(S.shame);
  A.lastShame = sk;
  const ak = S.alert ? S.alert.k : 0;
  if (A.lastAlert !== null && S.alert && ak !== A.lastAlert) showAlert(S.alert);
  A.lastAlert = ak;
  A.video.sync(S.players.filter(p => p.on && p.peer && p.pid !== pid).map(p => p.peer));
  flip(null, renderAll);
  help.state();
  stats.state();
}

const clonePos = p => { const o = {}; for (const k in p || {}) o[k] = [p[k][0], p[k][1]]; return o; };
const r2 = v => Math.round(v * 100) / 100;

function beginTurn() {
  const S = A.S, m = me();
  const w = S.work;
  A.W = {
    turnNo: S.turnNo,
    startTable: S.table.map(a => a.slice()),
    startPos: clonePos(S.pos),
    startRack: m.rack.slice(),
    pos: clonePos(w ? w.pos : S.pos),
    rack: orderLike(w ? w.rack : m.rack),
    startGrid: cloneGrid(A.grid),
  };
  A.hist = []; A.sel.clear(); A.loose.clear();
}

function orderLike(ids) {
  const set = new Set(ids);
  const keep = A.order.filter(id => set.has(id));
  return keep.concat(ids.filter(id => !keep.includes(id)));
}

function snapshotW() { return JSON.stringify({ pos: A.W.pos, rack: A.W.rack, grid: A.grid }); }
function commit() {
  A.order = A.W.rack.slice();
  send({ t: 'work', pos: A.W.pos, rack: A.W.rack });
  renderAll();
}

/* ---------------- moving tiles ---------------- */

// target is 'rack', 'rackslot:r,c' or 'board' (with pt = where the first tile's top-left corner goes, in tile units).
// The chosen tiles in the order they sit (table tiles row by row, then rack tiles in reading order), not the
// order they were tapped, so a group keeps its order wherever it goes.
function selOrder(ids) {
  const pos = A.W ? A.W.pos : {};
  const key = id => {
    if (pos[id]) return [0, Math.round(pos[id][1]), pos[id][0]];
    const s = slotOf(id);
    return s ? [1, s[0], s[1]] : [2, 0, 0];
  };
  return ids.map(id => [id, key(id)]).sort((a, b) => a[1][0] - b[1][0] || a[1][1] - b[1][1] || a[1][2] - b[1][2]).map(a => a[0]);
}

function moveSelected(target, pt) {
  const ids = selOrder([...A.sel]);
  if (!ids.length) return;
  if (!A.W) {   // not my turn: only rearranging my own rack
    if (target.startsWith('rack')) toRack(ids.filter(id => A.order.includes(id)), target);
    A.sel.clear(); renderAll(); return;
  }
  const W = A.W;
  let moving = ids;
  if (target.startsWith('rack')) {
    const mine = new Set(W.startRack);
    moving = ids.filter(id => mine.has(id));
    if (moving.length < ids.length) toast('Tiles that were already on the table have to stay there.');
    if (!moving.length) return;
  }
  A.hist.push(snapshotW());
  const mv = new Set(moving);
  const rackRest = W.rack.filter(id => !mv.has(id));
  if (target === 'board') {
    // Tiles stay exactly where they are put; a moment later they are straightened up (see settleNow).
    W.rack = rackRest;
    if (dropShape) {
      // a dragged group keeps its rows; pt is the group's top-left
      const w = Math.max(...moving.map(id => (dropShape.off.get(id) || [0])[0])) + 1;
      const x = Math.min(Math.max(pt[0], 0), Math.max(0, BOARD_W - w)), y = Math.max(pt[1], 0);
      moving.forEach(id => { const [ox, oy] = dropShape.off.get(id) || [0, 0]; W.pos[id] = [r2(x + ox), r2(y + oy)]; A.loose.add(id); });
    } else {
      const x = Math.min(Math.max(pt[0], 0), Math.max(0, BOARD_W - moving.length)), y = Math.max(pt[1], 0);
      moving.forEach((id, i) => { W.pos[id] = [r2(x + i), r2(y)]; A.loose.add(id); });
    }
    // A tile played into the middle of a run splits it straight away; otherwise things straighten after a pause.
    // Tiles put onto a set already on the table slot in at once (their neighbours shift over).
    const joins = groupsOf(W.pos).some(g => g.some(id => mv.has(id)) && g.some(id => !A.loose.has(id)));
    settleSoon(joins || autoSplit(W.pos, A.loose) ? 150 : 900);
  } else {
    for (const id of moving) delete W.pos[id];
    W.rack = rackRest.concat(moving);
    toRack(moving, target);
  }
  A.sel.clear();
  commit();
}

// A moment after tiles are put down, each set is straightened into a level, evenly spaced row.
// Sets stay where they were put: nothing snaps to a grid.
let settleT = 0;
function settleSoon(ms = 900) { clearTimeout(settleT); settleT = setTimeout(settleNow, ms); }
function settleNow() {
  clearTimeout(settleT);
  if (!A.W) { A.loose.clear(); return; }
  if (A.drag) return settleSoon();
  const split = autoSplit(A.W.pos, A.loose);
  const next = split ? tidyPos(split.pos, split.moved) : tidyPos(A.W.pos, A.loose);
  A.loose.clear();
  const ids = Object.keys(next);
  if (ids.every(id => A.W.pos[id] && A.W.pos[id][0] === next[id][0] && A.W.pos[id][1] === next[id][1])) return;
  flip(null, () => { A.W.pos = next; commit(); });
}

// Open a gap in a rack row at slot (r, c): the tile there and the ones after it slide one slot right.
function gapAt(g, r, c) {
  const row = g[r], n = row.length;
  const k = row.indexOf(null, c);
  const out = k < 0 ? row[n - 1] : null;
  for (let i = k < 0 ? n - 1 : k; i > c; i--) row[i] = row[i - 1];
  row[c] = null;
  if (out == null) return;
  // the row was full: its last tile goes to the first free slot further down (never back into the space just
  // made); with none below, to the first free slot anywhere else
  for (let rr = r + 1; rr < g.length; rr++) { const cc = g[rr].indexOf(null); if (cc >= 0) { g[rr][cc] = out; return; } }
  for (let rr = 0; rr <= r; rr++) for (let cc = 0; cc < n; cc++) if (g[rr][cc] == null && !(rr === r && cc === c)) { g[rr][cc] = out; return; }
  g.push([out, ...Array(n - 1).fill(null)]);
}

// The Space button: puts a space just before each selected tile. On the table that splits a set in two;
// on the rack the tile and its neighbours slide over one slot.
function addSpace() {
  A.wide = null;
  const ids = [...A.sel];
  const W = A.W;
  const onBoard = W ? ids.filter(id => W.pos[id]) : [];
  const onRack = A.grid ? ids.filter(id => slotOf(id)) : [];
  if (!onBoard.length && !onRack.length) return;
  if (W) A.hist.push(snapshotW());
  flip(null, () => {
    if (onBoard.length) {
      const sel = new Set(onBoard), moved = new Set(A.loose);
      for (const g of groupsOf(W.pos)) {
        let shift = 0;
        g.forEach((id, i) => {
          if (i && sel.has(id)) shift++;
          if (shift) { W.pos[id] = [r2(W.pos[id][0] + shift), W.pos[id][1]]; moved.add(id); }
        });
      }
      W.pos = tidyPos(W.pos, moved);
      A.loose.clear();
    }
    const byCol = onRack.map(id => [id, slotOf(id)[1]]).sort((a, b) => b[1] - a[1]);
    for (const [id] of byCol) { const [r, c] = slotOf(id); gapAt(A.grid, r, c); }
    A.sel.clear();
    if (W) commit(); else renderAll();
  });
}

function undo() {
  if (!A.W || !A.hist.length) return;
  const h = JSON.parse(A.hist.pop());
  A.wide = null;
  clearTimeout(settleT); A.loose.clear();
  flip(null, () => { A.W.pos = h.pos; A.W.rack = h.rack; A.grid = h.grid; A.sel.clear(); commit(); });
}
function resetTurn() {
  if (!A.W) return;
  A.hist.push(snapshotW());
  clearTimeout(settleT); A.loose.clear();
  flip(null, () => {
    A.W.pos = clonePos(A.W.startPos);
    A.W.rack = orderLike(A.W.startRack);
    A.grid = cloneGrid(A.W.startGrid); A.wide = null;
    A.sel.clear(); commit();
  });
}
function draw() {
  if (!myTurn()) return;
  clearTimeout(settleT); A.loose.clear();
  A.sel.clear();
  send({ t: 'draw' });
}
function done() {
  if (!A.W) return;
  settleNow();
  const why = checkTurn(A.W.startTable, A.W.startRack, groupsOf(A.W.pos), A.W.rack, me().opened);
  if (why) { toast(why); beep(220, 0.25); return; }
  send({ t: 'done' });
}
/* ---------------- drawing the screen ---------------- */

const FRESH_MS = 1800;
// The shape on each tile, drawn crisp and solid so the four colors are easy to tell apart:
// black club, red heart, blue spade, orange diamond.
const SHAPES = [
  '<g stroke="none"><circle cx="10" cy="5.4" r="4"/><circle cx="5.2" cy="11" r="4"/><circle cx="14.8" cy="11" r="4"/><circle cx="10" cy="9.6" r="2.6"/><path d="M8.7 11 L6.8 18.8 H13.2 L11.3 11 Z"/></g>',
  '<path d="M10 18.4 C3.8 13.9 0.9 10.6 0.9 6.7 C0.9 3.8 3.1 1.6 5.8 1.6 C7.6 1.6 9.1 2.6 10 4.1 C10.9 2.6 12.4 1.6 14.2 1.6 C16.9 1.6 19.1 3.8 19.1 6.7 C19.1 10.6 16.2 13.9 10 18.4 Z"/>',
  // the spade's top with the club's stem, drawn as one solid shape (no edge between them, like the club)
  '<g stroke="none"><path d="M10 0.6 C15.6 5.1 19.3 8 19.3 11.6 C19.3 14.2 17.3 15.9 15 15.9 C13.4 15.9 11.9 15.1 10 13.2 C8.1 15.1 6.6 15.9 5 15.9 C2.7 15.9 0.7 14.2 0.7 11.6 C0.7 8 4.4 5.1 10 0.6 Z"/><path d="M8.7 11 L6.8 18.8 H13.2 L11.3 11 Z"/></g>',
  '<polygon points="10,0.8 19.2,10 10,19.2 0.8,10"/>',
].map(p => `<svg class="sym" viewBox="0 0 20 20" aria-hidden="true">${p}</svg>`);

// The 0 is drawn in its own little span (see .z in style.css), so the 10 has a plain zero the same height as the 1.
const numHTML = n => String(n).replace(/0/g, '<span class="z">0</span>');

// Each set of tiles has two jokers, each with its own photo (see .jface in style.css).
const jokerFace = id => (id % 106 === 105 ? 'jface j2' : 'jface');

function tileHTML(id, extra = '', style = '') {
  const t = tile(id);
  // The glow carries on from where it was when the screen is redrawn, instead of starting over.
  let fresh = '';
  if (A.fresh.has(id)) {
    const age = Date.now() - A.fresh.get(id);
    if (age < FRESH_MS) { fresh = 'fresh'; style += `;animation-delay:-${age}ms`; } else A.fresh.delete(id);
  }
  const cls = ['tile', t.j ? 'joker' : 'c' + t.c, A.sel.has(id) ? 'sel' : '', fresh, extra].join(' ');
  const label = t.j ? 'Joker' : `${COLOR_NAMES[t.c]} ${t.n}`;
  const face = t.j ? `<span class="${jokerFace(id)}" aria-hidden="true"></span><span class="sym">JOKER</span>`
    : `<span class="num">${numHTML(t.n)}</span>${A.shapes ? SHAPES[t.c] : ''}`;
  return `<div class="${cls}" data-id="${id}" role="button" aria-label="${label}"${style ? ` style="${style}"` : ''}>${face}</div>`;
}

// The rack and buttons go first: the table then sizes itself to the room that is left.
function renderAll() { renderStatus(); renderSeats(); renderMe(); renderCenter(); }

function renderStatus() {
  const labels = { host: 'Connected', client: 'Connected', joining: 'Joining…', reconnecting: 'Reconnecting…', connecting: 'Connecting…', offline: 'No connection, retrying…' };
  const el = $('#status');
  const good = A.status === 'host' || A.status === 'client';
  el.className = 'status' + (good ? ' good' : '');
  el.title = labels[A.status] || A.status;
  el.querySelector('span').textContent = labels[A.status] || A.status;
  const cam = $('#camBtn');
  cam.innerHTML = A.camOn ? `${ic('cam')}<span>Camera on</span>` : `${ic('camoff')}<span>Camera</span>`;
  cam.classList.toggle('on', A.camOn);
  cam.setAttribute('aria-pressed', A.camOn);
  const mic = $('#micBtn');
  mic.hidden = !A.camOn || !A.video || !A.video.hasMic();
  mic.innerHTML = A.micOn ? `${ic('mic')}<span>Mute</span>` : `${ic('micoff')}<span>Unmute</span>`;
  mic.classList.toggle('muted', !A.micOn);
}

/* Each person's voice has its own volume. Most browsers let a video's volume be set directly; iPhones and
   iPads don't, so there the sound goes through a volume control (Web Audio) and the video itself stays muted. */
const VOL_DIRECT = (() => { try { const v = document.createElement('video'); v.volume = 0.5; return Math.abs(v.volume - 0.5) < 0.01; } catch (e) { return false; } })();
const gains = new Map();
let vac = null;
function volumeOf(p) { const v = A.vol[p.pid]; return typeof v === 'number' ? v : 1; }
function applyVolume(p, v, stream) {
  const vol = volumeOf(p);
  if (VOL_DIRECT) { v.muted = false; v.volume = vol; return; }
  v.muted = true;
  try {
    vac = vac || new (window.AudioContext || window.webkitAudioContext)();
    if (vac.state === 'suspended') vac.resume();
    let g = gains.get(p.pid);
    if (!g || g.stream !== stream) {
      if (g) try { g.src.disconnect(); } catch (e) { /* ignore */ }
      const src = vac.createMediaStreamSource(stream);
      const gain = vac.createGain();
      src.connect(gain).connect(vac.destination);
      g = { src, gain, stream };
      gains.set(p.pid, g);
    }
    g.gain.gain.value = vol;
  } catch (e) { v.muted = false; }
}

// The list of volume sliders in Settings: one for each other person at the table.
let volKey = '';
function renderVolumes(force) {
  const box = $('#volList');
  if (!box) return;
  const people = A.S ? A.S.players.filter(p => p.on && !p.cpu && p.pid !== pid) : [];
  const key = people.map(p => p.pid + p.name).join('|');
  if (!force && key === volKey) return;
  volKey = key;
  box.innerHTML = people.length ? people.map(p => {
    const v = Math.round(volumeOf(p) * 100);
    return `<label class="volrow"><span class="vname">${esc(p.name)}</span><input type="range" min="0" max="100" step="5" value="${v}" data-volpid="${esc(p.pid)}" aria-label="Volume for ${esc(p.name)}"><b>${v}%</b></label>`;
  }).join('') : '<p class="fieldhint">No one else is here yet. Their volume sliders will show up here.</p>';
}

/* Seats: one card per person, kept between updates so videos keep playing. */
const seatEls = new Map();
const videoEls = new Map();

function videoFor(key, stream, mirror, muted) {
  let v = videoEls.get(key);
  if (!v) {
    v = document.createElement('video');
    v.autoplay = true; v.playsInline = true; v.setAttribute('playsinline', '');
    videoEls.set(key, v);
  }
  v.muted = muted;
  v.classList.toggle('mirror', !!mirror);
  if (v.srcObject !== stream) { v.srcObject = stream; v.play().catch(() => {}); }
  return v;
}

function seatEl(p) {
  let el = seatEls.get(p.pid);
  if (!el) {
    el = document.createElement('div');
    el.className = 'seat';
    el.innerHTML = `<div class="face"><div class="avatar"></div><div class="nm"></div><div class="flag">▶ TURN</div><div class="open30"></div><div class="stamp">Cheater</div></div>
      <div class="minirack"><div class="backs"></div><div class="mini-edge"><span class="engr"></span></div><b class="mcount" hidden></b></div>
      <div class="tag"></div>`;
    seatEls.set(p.pid, el);
  }
  return el;
}

/* Each player's rack layout (which slots have a tile, row by row) goes to everyone, so the little rack by
   their face shows their tiles where they really are. Only the shape is shared, never which tiles they are. */
const layOf = g => {
  const rows = g.map(r => r.map(x => (x == null ? '0' : '1')).join(''));
  while (rows.length > ROWS && !rows[rows.length - 1].includes('1')) rows.pop();
  return rows;
};
function drawBacks(el, n, rows) {
  const backs = el.querySelector('.backs');
  const ones = rows ? rows.join('').split('1').length - 1 : -1;
  // A layout that doesn't match their tile count (a computer player, or one still on its way) is filled in order.
  if (n && ones !== n) {
    const cols = 10;
    rows = Array.from({ length: Math.max(ROWS, Math.ceil(n / cols)) }, (_, r) =>
      Array.from({ length: cols }, (_, c) => (r * cols + c < n ? '1' : '0')).join(''));
  }
  const key = n ? rows.join('/') : '';
  if (backs.dataset.k === key) return;
  backs.dataset.k = key;
  backs.style.setProperty('--cols', n ? rows[0].length : 10);
  backs.innerHTML = n ? rows.map(r => r.replace(/1/g, '<i></i>').replace(/0/g, '<b></b>')).join('') : '';
  backs.title = n ? `${n} tiles left` : '';
  const cnt = el.querySelector('.mcount');
  cnt.hidden = !n; cnt.textContent = n || '';
  cnt.title = backs.title;
}
let laySent = '', layT = 0;
function sendLayout() {
  const S = A.S, m = me();
  if (!S || !m || !m.seat || S.phase !== 'play' || !A.grid) return;
  const rows = layOf(A.grid), k = rows.join('/');
  if (k === laySent && (m.lay || []).join('/') === k) return;
  clearTimeout(layT);
  layT = setTimeout(() => { laySent = k; send({ t: 'layout', rows }); }, 250);
}

function renderSeats() {
  if (!A.S) return;
  const S = A.S;
  const list = S.players.filter(p => p.on || p.seat);
  const mi = list.findIndex(p => p.pid === pid);
  const others = mi < 0 ? list : [...list.slice(mi + 1), ...list.slice(0, mi)];
  const playing = S.phase === 'play';

  const fill = (p, isMe) => {
    const el = seatEl(p);
    const work = playing && S.turn === p.pid && S.work;
    const count = isMe && A.W ? A.W.rack.length : work ? work.rack.length : (p.rack || []).length;
    el.classList.toggle('turn', playing && S.turn === p.pid);
    el.classList.toggle('idle', playing && S.turn !== p.pid);
    el.classList.toggle('off', !p.on);
    el.classList.toggle('me', !!isMe);
    el.classList.toggle('cheat', !!(p.cheat && playing));
    el.querySelector('.engr').textContent = p.name;
    el.querySelector('.nm').textContent = p.name;
    const mr = el.querySelector('.minirack'), st = rackStyle(p.rc);
    if (mr.getAttribute('style') !== st) mr.setAttribute('style', st);
    // Their rack shows the backs of the tiles they still hold, laid out the way they have them.
    drawBacks(el, p.seat && playing ? count : 0, isMe && A.grid ? layOf(A.grid) : p.lay);
    // Whether they have made their first play of 30 yet.
    const ob = el.querySelector('.open30'), show = !!(p.seat && playing);
    const obHtml = show ? `${ic(p.opened ? 'check' : 'lock')}30` : '';
    if (ob.innerHTML !== obHtml) ob.innerHTML = obHtml;
    ob.className = 'open30' + (show ? ' show' : '') + (p.opened ? ' yes' : '');
    ob.title = p.opened ? 'Has made their first 30' : 'Has not made their first 30 yet';
    let tag = '';
    if (!p.on) tag = '⚠ Lost connection';
    else if (playing && !p.seat) tag = 'Watching';
    else if (p.wins) tag = `${ic('trophy')} ${p.wins}`;
    if (el.querySelector('.tag').innerHTML !== tag) el.querySelector('.tag').innerHTML = tag;
    const face = el.querySelector('.face');
    const av = face.querySelector('.avatar');
    const avHtml = p.cpu ? `<b class="mono">${ic('bot')}</b><small>${LEVEL_NAMES[p.cpu]}</small>` : `<b class="mono">${esc((p.name || '?').slice(0, 1).toUpperCase())}</b>`;
    if (av.innerHTML !== avHtml) av.innerHTML = avHtml;
    av.classList.toggle('bot', !!p.cpu);
    if (av.getAttribute('style') !== st) av.setAttribute('style', st);
    let stream = null, key = p.peer;
    if (isMe) { stream = A.camOn && A.video.cam; key = 'me'; }
    else if (p.cam && p.on) stream = A.video.streams.get(p.peer);
    const old = face.querySelector('video');
    if (stream) {
      const v = videoFor(key, stream, isMe, isMe);
      if (old !== v) { if (old) old.remove(); face.appendChild(v); v.play().catch(() => {}); }
      if (!isMe) applyVolume(p, v, stream);
    } else if (old) old.remove();
    // A remote person whose camera is on but whose picture has not arrived yet.
    face.classList.toggle('waiting', !!(!isMe && p.cam && p.on && !stream));
    // Their own sound: unmuted for others. Show who is muted.
    el.classList.toggle('mic-off', !!p.cam && !p.mic);
    return el;
  };

  const wide = window.innerWidth >= 1100;
  const left = $('#seatsL'), right = $('#seatsR');
  const els = others.map(p => fill(p, false));
  const m = me();
  const mine = m ? [fill(m, true)] : [];
  if (wide) {
    // You sit at the end of the shorter side, so the rack below gets the full width.
    const all = [...els, ...mine], half = Math.ceil(all.length / 2);
    syncChildren(left, all.slice(0, half));
    syncChildren(right, all.slice(half));
    syncChildren($('#mySeat'), []);
  } else {
    syncChildren($('#mySeat'), []);
    syncChildren(left, [...els, ...mine]);
    syncChildren(right, []);
  }
  left.dataset.n = left.children.length;
  right.dataset.n = right.children.length;
  for (const [k, el] of seatEls) if (!list.some(p => p.pid === k)) { el.remove(); seatEls.delete(k); }
  renderVolumes();
}

function syncChildren(parent, kids) {
  kids.forEach((k, i) => { if (parent.children[i] !== k) parent.insertBefore(k, parent.children[i] || null); });
  while (parent.children.length > kids.length) parent.lastChild.remove();
}

// One column for the waiting room and results when the middle is narrow for the chosen text size.
function fitMain() {
  const m = $('main');
  if (m && m.clientWidth) m.classList.toggle('compact', m.clientWidth < 960 * A.zoom);
}

function renderCenter() {
  const S = A.S, box = $('#center');
  box.parentElement.classList.toggle('mat', !!S && S.phase === 'play');
  fitMain();
  if (!S) { box.innerHTML = '<div class="panel"><h2>Finding your table…</h2></div>'; return; }
  const cur = S.phase === 'play' && S.players.find(p => p.pid === S.turn);
  document.title = !cur ? 'Family Tiles' : myTurn() ? '▶ Your turn! · Family Tiles' : `${cur.name}'s turn · Family Tiles`;
  if (S.phase === 'lobby') return renderLobby(box);
  if (S.phase === 'over') return renderOver(box);
  renderBoard(box);
}

function renderLobby(box) {
  const S = A.S;
  const here = S.players.filter(p => p.on);
  const sets = here.length > 4 ? 2 : 1;
  const link = location.origin + location.pathname + '?room=' + A.code;
  const chips = here.map((p, i) => `<div class="pchip ${p.cpu ? 'cpu' : ''}" style="${rackStyle(p.rc)}"><span class="av">${p.cpu ? `${ic('bot')}<i class="lvl">${LEVEL_NAMES[p.cpu][0]}</i>` : esc((p.name || '?').slice(0, 1).toUpperCase())}</span>
      <span class="pn">${esc(p.name)}<span class="pt">${p.pid === pid ? 'You' : p.cpu ? `Computer · ${LEVEL_NAMES[p.cpu]}` : i >= 8 ? 'Watching (table full)' : 'Ready'}</span></span>
      ${p.cpu ? `<button class="iconbtn rm" data-act="rmcpu" data-pid="${esc(p.pid)}" aria-label="Remove ${esc(p.name)}">${ic('close')}</button>` : ''}</div>`).join('');
  const full = here.length >= 8;
  const open = here.length < 8 ? 1 : 0;
  const empties = Array.from({ length: open }, () => `<div class="pchip empty-seat">Open seat</div>`).join('');
  box.innerHTML = `<div class="card lobby">
    <div class="lcol">
      <div class="panelhead"><span class="badge">${ic('users')}</span><div class="ph"><h2>Table “${esc(A.code)}”</h2><p>Waiting for everyone to sit down</p></div>
        <span class="headact"><button class="btn small" data-act="${navigator.share ? 'share' : 'copy'}">${ic(navigator.share ? 'share' : 'link')}Invite</button><button class="btn small" data-act="leave" aria-label="Leave table">${ic('logout')}</button></span></div>
      <div class="section invite"><h3>Invite your family</h3>
        <div class="linkrow"><input readonly value="${esc(link)}" aria-label="Table link"><button class="btn" data-act="copy">${ic('link')}Copy link</button>${navigator.share ? `<button class="btn" data-act="share">${ic('share')}Share</button>` : ''}</div>
      </div>
      <div class="section"><h3>At the table · ${here.length} of 8 · ${here.length < 2 ? 'need one more' : sets === 2 ? 'two sets of tiles' : 'one set of tiles'}</h3>
        <div class="players">${chips}${empties}</div>
      </div>
    </div>
    <div class="lcol">
      <div class="section cpusec ${full ? 'full' : ''}"><h3>Add a computer player</h3>
        <div class="cpuadd">
          <button class="btn" data-act="addcpu" data-level="easy" ${full ? 'disabled' : ''}>${ic('plus')}<span><b>Easy</b><small>Learning</small></span></button>
          <button class="btn" data-act="addcpu" data-level="medium" ${full ? 'disabled' : ''}>${ic('plus')}<span><b>Medium</b><small>Solid</small></span></button>
          <button class="btn" data-act="addcpu" data-level="hard" ${full ? 'disabled' : ''}>${ic('plus')}<span><b>Hard</b><small>Tricky</small></span></button>
        </div>
      </div>
      <div class="section"><h3>Your rack color</h3><div class="swatches row8">${swatches(A.rc, 'setrc')}</div></div>
      <button class="btn go huge" data-act="start" ${here.length < 2 ? 'disabled' : ''}>Start the game ${ic('arrow')}</button>
      <div class="lobbyfoot"><span class="tip">${ic('cam')}<span>Press <b>Camera</b> so everyone can see you.</span></span><button class="btn small leave" data-act="leave">${ic('logout')}Leave</button></div>
    </div>
  </div>`;
}

// No points: whoever plays all their tiles first wins, and only wins are counted.
function renderOver(box) {
  const S = A.S;
  const r = S.result || {};
  const rows = S.players.filter(p => p.seat || p.wins).sort((a, b) => (b.wins || 0) - (a.wins || 0));
  box.innerHTML = `<div class="card over">
    <div class="winner"><span class="cup">${ic('trophy')}</span><h2>${r.name ? `${esc(r.name)} wins!` : 'No winner this time'}</h2></div>
    <div class="wins">${rows.map(p => `<div class="winrow ${p.pid === r.pid ? 'win' : ''}"><span class="wn">${esc(p.name)}${p.cheat ? ' <i class="cheattag">cheater</i>' : ''}</span><span class="wc">${ic('trophy')}<b>${p.wins || 0}</b></span></div>`).join('')}</div>
    <button class="btn go huge" data-act="newgame">Play again ${ic('arrow')}</button>
  </div>`;
}

// A burst of confetti in the rack colors when a game is won.
function confetti() {
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = $('#confetti');
  const colors = ['#ffcf33', '#e3262a', '#2472e6', '#25a84e', '#ff6eb6', '#9257ff', '#ffffff'];
  let html = '';
  for (let i = 0; i < 110; i++) {
    const d = 2.4 + Math.random() * 2.2;
    html += `<i style="left:${Math.random() * 100}%;background:${colors[i % colors.length]};--dx:${Math.round(Math.random() * 240 - 120)}px;--rot:${Math.round(Math.random() * 900 - 450)}deg;animation-duration:${d}s;animation-delay:${(Math.random() * .6).toFixed(2)}s;width:${8 + Math.random() * 6}px"></i>`;
  }
  box.innerHTML = html;
  setTimeout(() => { box.innerHTML = ''; }, 5500);
}

/* ---------------- the table: tiles sit wherever they are put ---------------- */
// Every tile on the table has its own position, measured in tile widths across and rows down, on a table
// that is the same width (BOARD_W tiles) for everyone. Tiles close together are one set (see groupsOf).

function boardPos() {
  const S = A.S;
  if (A.W) return A.W.pos;
  return (S.work ? S.work.pos : S.pos) || {};
}

// The size of a tile on the table. The table is always BOARD_W tiles wide, so the tiles grow to fill the
// space (as long as about five rows still fit in its height), or shrink, down to a readable minimum, so the
// whole width fits. On very narrow screens the table scrolls sideways instead of wrapping a set onto two lines.
const BOARD_ROWS = 5;
// With Fit on, the tiles shrink so every row on the table (and one spare row during your turn) fits on screen.
function measureBoard(box, rows) {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;visibility:hidden;width:var(--bw)';
  box.appendChild(probe);
  const base = probe.offsetWidth || 48;
  probe.remove();
  const m = box.parentElement, cs = getComputedStyle(m);
  const roomH = m.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - BOARD_PAD;
  const tall = Math.floor((roomH / BOARD_ROWS - 16) / 1.34);
  const fit = Math.floor(box.clientWidth / BOARD_W) - 4;
  let bw = Math.max(Math.min(fit, Math.max(base, tall)), Math.round(30 * A.zoom));
  if (A.fit && rows) {
    const byH = Math.floor((roomH - 4 - 16 * (rows - 1)) / (1.34 * rows));
    bw = Math.max(12, Math.min(bw, byH, fit));
  }
  const bh = Math.round(bw * 1.34);
  return (A.bu = { bw, bh, ux: bw + 4, uy: bh + 16 });
}

const BOARD_PAD = 6;   // a little felt above the top row
function boardPoint(px, py) {
  const b = $('#board').getBoundingClientRect();
  return [(px - b.left) / A.bu.ux, (py - b.top - BOARD_PAD) / A.bu.uy];
}

function renderBoard(box) {
  const S = A.S;
  const live = !!A.W;
  const pos = boardPos();
  const before = S.pos || {};
  const showMarks = live || !!S.work;
  const lifted = new Set(A.drag ? A.drag.ids : []);
  let lowest = 0;
  for (const id in pos) lowest = Math.max(lowest, pos[id][1]);
  const u = measureBoard(box, Math.ceil(lowest + 1 + (live ? 1 : 0)));
  let html = '', maxX = BOARD_W, maxY = 0;
  for (const g of groupsOf(pos)) {
    const ok = analyze(g).ok;
    g.forEach((id, i) => {
      const [x, y] = pos[id];
      maxX = Math.max(maxX, x + 1); maxY = Math.max(maxY, y);
      const cls = [before[id] ? '' : 'placed', lifted.has(id) ? 'lifted' : '', showMarks ? (ok ? 'seg-ok' : 'seg-bad') : 'seg', i ? '' : 'seg-start', i === g.length - 1 ? 'seg-end' : ''].join(' ');
      html += tileHTML(id, cls, `left:${(x * u.ux).toFixed(1)}px;top:${(y * u.uy + BOARD_PAD).toFixed(1)}px`);
    });
  }
  const mainEl = box.parentElement, cs = getComputedStyle(mainEl);
  const wpx = Math.ceil(maxX * u.ux - 4);
  const room = mainEl.offsetHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 2 - (wpx > box.clientWidth ? 9 : 0);
  // The table fills the space it has and doesn't scroll. Only once a set sits on the bottom row that fits
  // does it grow, by one more row at most (during your turn, so there is somewhere to put a new set).
  const lastRow = Math.max(0, Math.floor((room - BOARD_PAD - u.bh) / u.uy));
  const extra = html && live && maxY >= lastRow - 0.01 ? 1 : 0;
  const need = html ? (maxY + extra) * u.uy + BOARD_PAD + u.bh + 4 : 0;
  const h = Math.max(need, room);
  box.innerHTML = `<div id="board" class="board ${live ? 'live' : ''}" style="--tw:${u.bw}px;--th:${u.bh}px;width:${wpx}px;height:${Math.floor(h)}px">${html}</div>`;
}

// The "first 30" badge: a green tick once a player has made their opening play, a grey padlock until then.
function openBadge(opened, extra = '') {
  return `<span class="open30 show ${opened ? 'yes' : ''} ${extra}" title="${opened ? 'Has made their first 30' : 'Has not made their first 30 yet'}">${ic(opened ? 'check' : 'lock')}30</span>`;
}

function renderMe() {
  const S = A.S, m = me();
  const c = $('#controls');
  // The rack only shows during a game, so the lobby and results get the whole screen.
  document.querySelector('footer').hidden = !(S && S.phase === 'play');
  if (!S || !m || S.phase !== 'play') { c.innerHTML = ''; renderRack(); return; }
  const fitBtn = `<button class="btn ${A.fit ? 'on' : ''}" data-act="fit" aria-pressed="${A.fit}" aria-label="Fit the whole table on screen" title="Fit the whole table on screen">${ic('fit')}<span class="long">Fit</span></button>`;
  let html = '';
  if (myTurn()) {
    const placed = A.W && A.W.rack.length < A.W.startRack.length;
    html += `<button class="btn go" data-act="done">${ic('check')}Done</button>`;
    html += `<button class="btn draw" data-act="draw" title="Tiles left to draw: ${S.pool.length}">${S.pool.length ? `${ic('draw')}Draw<b class="cnt">${S.pool.length}</b>` : `${ic('skip')}Pass`}</button>`;
    html += `<button class="btn" data-act="undo" aria-label="Undo" title="Undo" ${A.hist.length ? '' : 'disabled'}>${ic('undo')}<span class="long">Undo</span></button>`;
    html += `<button class="btn" data-act="reset" aria-label="Reset" title="Reset" ${placed || (A.W && A.hist.length) ? '' : 'disabled'}>${ic('reset')}<span class="long">Reset</span></button>`;
    html += fitBtn;
    html += `<button class="btn" data-act="torack" aria-label="Back to rack" title="Back to rack" ${A.sel.size ? '' : 'disabled'}>${ic('torack')}<span class="long">Rack</span></button>`;
  } else {
    const cur = S.players.find(p => p.pid === S.turn);
    if (cur) html += `<span class="turnchip" style="${rackStyle(cur.rc)}">${cur.cpu ? ic('bot') : ''}${esc(cur.name)}</span>`;
    if (cur && !cur.on) html += `<button class="btn" data-act="skip">${ic('skip')}Skip</button>`;
    html += fitBtn;
    html += `<span class="poolchip" title="Tiles left to draw: ${S.pool.length}">${ic('draw')}<b>${S.pool.length}</b></span>`;
  }
  c.innerHTML = html;
  $('#sorts').hidden = !m.seat;
  renderRack();
}

/* ---------------- the rack: 3 rows of slots, gaps allowed ---------------- */

const ROWS = 3, GAP = 5;
const gridKey = () => 'ft-grid-' + A.code;
function saveGrid() { try { sessionStorage.setItem(gridKey(), JSON.stringify(A.grid)); } catch (e) { /* ignore */ } }
function loadGrid() { try { return JSON.parse(sessionStorage.getItem(gridKey())); } catch (e) { return null; } }
const cloneGrid = g => (g || []).map(r => r.slice());

function putFirstEmpty(g, id, cols) {
  for (const row of g) { const c = row.indexOf(null); if (c >= 0) { row[c] = id; return; } }
  const r = Array(cols).fill(null); r[0] = id; g.push(r);
}

// Make the grid hold exactly these tiles: tiles keep their slots, tiles that left leave a gap,
// new tiles (just drawn, or back from the table) go into the first empty slot.
function fitGrid(g, ids, cols) {
  const want = new Set(ids), seen = new Set(), homeless = [];
  g = (g || []).map(row => {
    const r = [], over = [];
    row.forEach((x, c) => {
      const keep = x != null && want.has(x) && !seen.has(x);
      if (keep) seen.add(x);
      if (c < cols) r.push(keep ? x : null); else if (keep) over.push(x);
    });
    while (r.length < cols) r.push(null);
    // The rack got narrower: tiles past its end move into the nearest gaps at the end of their own row.
    for (const x of over.reverse()) {
      const k = r.lastIndexOf(null);
      if (k < 0) { homeless.unshift(x); continue; }
      r.splice(k, 1); r.push(x);
    }
    return r;
  });
  while (g.length < ROWS) g.push(Array(cols).fill(null));
  for (const id of ids) if (!seen.has(id) && !homeless.includes(id)) homeless.push(id);
  for (const id of homeless) putFirstEmpty(g, id, cols);
  while (g.length > ROWS && g[g.length - 1].every(x => x == null)) g.pop();
  return g;
}

// Put a tile into slot (r, c). If it is taken, the tiles from there on slide right into the next gap
// (or, with nothing free on that side, the tiles before it slide left).
function insertAt(g, id, r, c, leftFirst) {
  const row = g[r], n = row.length;
  if (row[c] == null) { row[c] = id; return c; }
  const right = () => { const k = row.indexOf(null, c); if (k < 0) return false; for (let i = k; i > c; i--) row[i] = row[i - 1]; row[c] = id; return true; };
  const left = () => { const k = row.lastIndexOf(null, c); if (k < 0) return false; for (let i = k; i < c; i++) row[i] = row[i + 1]; row[c] = id; return true; };
  if (leftFirst ? left() || right() : right() || left()) return c;
  const out = row[n - 1];
  for (let i = n - 1; i > c; i--) row[i] = row[i - 1];
  row[c] = id;
  putFirstEmpty(g, out, n);
  return c;
}

// Drop tiles at a slot. "after" means the pointer was on the right half of a tile: go after it.
// The tiles there are pushed the way the dragged tile was moving: dragged leftwards, they slide left (when
// there is room on that side); otherwise they slide right.
function dropInto(g, ids, r, c, after, push) {
  const cols = g[0].length;
  let leftFirst = push < 0;
  if (after && g[r][c] != null) {
    if (c + 1 < cols) c++;
    else leftFirst = true;   // after the last tile in a full row: the row slides left instead
  }
  if (leftFirst) {
    while (r >= g.length) g.push(Array(cols).fill(null));
    // Each tile goes into the same slot and nudges the ones before it left, so a group keeps its order.
    if (g[r].slice(0, c + 1).filter(x => x == null).length >= ids.length) {
      for (const id of ids) insertAt(g, id, r, c, true);
      return g;
    }
    // no room on the left: push right instead, with the group starting where it would have started
    leftFirst = false;
    c = Math.max(0, c - (ids.length - 1));
  }
  for (const id of ids) {
    while (r >= g.length) g.push(Array(cols).fill(null));
    insertAt(g, id, r, c, leftFirst);
    if (++c >= cols) { c = 0; r++; leftFirst = false; }
  }
  return g;
}

// Fit at least 7 slots across; on a narrow rack the tiles shrink a little to make room.
// Small changes in width (a scrollbar coming and going, a phone's address bar, nudging the window) keep the
// same number of slots, with the tiles a little smaller, so no tile has to move.
const MIN_COLS = 7, HOLD = 0.85;
let heldCols = 0;
function measureCols() {
  const g = $('#rack .grooves');
  $('#rack').style.removeProperty('--tw');
  let probe = document.createElement('div');
  probe.className = 'tile'; probe.style.cssText = 'position:absolute;visibility:hidden';
  g.appendChild(probe);
  const tw = probe.offsetWidth;
  probe.remove();
  const w = g.clientWidth;
  if (!w) return A.cols || MIN_COLS;
  // one column more than the slots: the last one, on the right, is where the Space tile stands
  const fitTw = n => Math.floor((w + GAP) / (n + 1) - GAP);
  let cols = Math.floor((w + GAP) / (tw + GAP)) - 1;
  if (heldCols > cols && fitTw(heldCols) >= tw * HOLD) cols = heldCols;
  else if (cols < MIN_COLS) cols = MIN_COLS;
  if ((cols + 1) * (tw + GAP) - GAP > w) $('#rack').style.setProperty('--tw', Math.max(30, fitTw(cols)) + 'px');
  heldCols = cols;
  return cols;
}

function renderRack() {
  const S = A.S, m = me();
  const rack = $('#rack');
  for (const kv of rackStyle(A.rc).split(';')) { const [k, v] = kv.split(':'); rack.style.setProperty(k, v); }
  rack.classList.toggle('picking', A.sel.size > 0);
  $('#rackName').textContent = A.name;
  const g = rack.querySelector('.grooves');
  if (!S || !m || !m.seat || S.phase === 'lobby') {
    g.style.gridTemplateColumns = '';
    g.innerHTML = `<div class="rackmsg">${S && S.phase === 'play' ? 'You are watching this game. You will get a seat in the next one.' : 'Your tiles will appear here.'}</div>`;
    $('#rackInfo').textContent = '';
    spaceTile().hidden = true;
    return;
  }
  const ids = rackIds();
  A.cols = measureCols();
  // The rack got narrower: remember the wider layout, and put it back if the rack widens again before the
  // tiles are rearranged by hand.
  const was = A.grid && A.grid[0] ? A.grid[0].length : 0;
  if (A.wide && A.wide.cols === A.cols) { A.grid = cloneGrid(A.wide.grid); A.wide = null; }
  else if (was > A.cols && (!A.wide || A.wide.cols < was)) A.wide = { cols: was, grid: cloneGrid(A.grid) };
  A.grid = fitGrid(A.grid, ids, A.cols);
  saveGrid();
  const mine = seatEls.get(pid);
  if (mine) drawBacks(mine, ids.length, layOf(A.grid));
  sendLayout();
  // While dragging: a preview of where the tiles would land (shown faint), or gaps where they came from.
  const d = A.drag;
  const view = d && d.view ? d.view : A.grid;
  g.style.gridTemplateColumns = `repeat(${A.cols}, var(--tw))`;
  g.innerHTML = view.map((row, r) => row.map((x, c) => {
    if (x == null || (d && !d.view && d.ids.includes(x))) return `<div class="cell" data-drop="rackslot:${r},${c}"></div>`;
    return tileHTML(x, d && d.view && d.ids.includes(x) ? 'landing' : '');
  }).join('')).join('');
  let badge = S.phase === 'play' ? openBadge(m.opened) : '';
  if (A.W && !m.opened) {
    // My first play: the badge fills up as the tiles I have put down add up towards 30.
    const pts = openingPoints(A.W.startTable, A.W.startRack, groupsOf(A.W.pos)), ok = pts >= OPEN_POINTS;
    badge = `<span class="open30 show meter ${ok ? 'yes' : ''}" style="--p:${Math.min(100, Math.round(pts / OPEN_POINTS * 100))}%" title="Your first play has to add up to ${OPEN_POINTS}">${ic(ok ? 'check' : 'lock')}<b>${pts}</b>/${OPEN_POINTS}</span>`;
  }
  $('#rackInfo').innerHTML = `${badge}<span>${ids.length}<span class="long"> tiles</span></span>`;
  placeSpaceTile();
  for (const b of document.querySelectorAll('.sortbtn')) {
    const by = b.dataset.act === 'sortnum' ? 'num' : 'col';
    const undo = canUndoSort(by);
    const html = undo ? `${ic('undo')}<span class="lbl">Undo sort</span>` : `${ic(by === 'num' ? 'sortnum' : 'sortcol')}<span class="lbl">${SORT_LABELS[by]}</span>`;
    if (b.innerHTML !== html) b.innerHTML = html;
    b.classList.toggle('undo', undo);
  }
}

const rackIds = () => (A.W ? A.W.rack : A.order);

// Pressing the same sort button again puts the rack back how it was (as long as nothing changed since).
const SORT_LABELS = { num: 'Sort 1-2-3', col: 'Sort colors' };
const canUndoSort = by => !!(A.sortUndo && A.sortUndo.by === by && JSON.stringify(A.grid) === A.sortUndo.after);
function sortRack(by) {
  A.wide = null;
  if (canUndoSort(by)) {
    const back = A.sortUndo.before;
    A.sortUndo = null;
    flip($('#rack .grooves'), () => { A.grid = back; renderRack(); });
    return;
  }
  const before = cloneGrid(A.grid);
  const ids = rackIds().slice();
  const cmp = by === 'num'
    ? (a, b) => { const x = tile(a), y = tile(b); return x.j - y.j || x.n - y.n || x.c - y.c || a - b; }
    : (a, b) => { const x = tile(a), y = tile(b); return x.c - y.c || x.n - y.n || a - b; };
  ids.sort(cmp);
  const cols = A.cols || 7;
  const groups = by === 'num' ? [ids] : [0, 1, 2, 3, 4].map(c => ids.filter(id => tile(id).c === c)).filter(a => a.length);
  const blank = () => Array(cols).fill(null);
  let g = null;
  if (by === 'col') {
    // Keep each color together on one row, with a gap between colors, when they fit in 3 rows.
    g = [blank()];
    let col = 0;
    for (const grp of groups) {
      const need = grp.length + (col ? 1 : 0);
      if (grp.length > cols) { g = null; break; }
      if (col + need > cols) { if (g.length >= ROWS) { g = null; break; } g.push(blank()); col = 0; }
      else if (col) col++;
      for (const id of grp) g[g.length - 1][col++] = id;
    }
  }
  if (!g) {   // otherwise, in reading order
    const flat = groups.flat();
    g = [];
    for (let i = 0; i < Math.max(flat.length, ROWS * cols); i += cols) { const r = flat.slice(i, i + cols); while (r.length < cols) r.push(null); g.push(r); }
  }
  while (g.length < ROWS) g.push(blank());
  flip($('#rack .grooves'), () => {
    A.grid = g;
    A.sortUndo = { by, before, after: JSON.stringify(fitGrid(cloneGrid(g), rackIds(), A.cols)) };
    renderRack();
  });
}

// Put tiles onto the rack: into a chosen slot (neighbours slide over), or the first empty slots.
function toRack(moving, target) {
  A.wide = null;
  const mv = new Set(moving);
  const g = cloneGrid(A.grid).map(r => r.map(x => (mv.has(x) ? null : x)));
  if (target.startsWith('rackslot:') && dropShape) {
    const [r, c, , push] = target.slice(9).split(',').map(Number);
    A.grid = placeOnRack(g, moving, dropShape.off, dropShape.grab, r, c, push < 0);
  } else if (target.startsWith('rackslot:')) {
    const [r, c, after, push] = target.slice(9).split(',').map(Number);
    A.grid = dropInto(g, moving, r, c, !!after, push || 0);
  } else A.grid = g;   // renderRack puts them in the first gaps
}

// Animate tiles from where they were to where they are now, so the rack slides instead of jumping.
function flip(container, change) {
  const before = new Map();
  // A tile being dragged has a faded copy where it came from and a space where it will land: those share its
  // number, so they are left out (otherwise one of them flies across between the table and the rack).
  const all = () => document.querySelectorAll('#rack .grooves .tile[data-id]:not(.landing), #board .tile[data-id]:not(.lifted)');
  for (const el of all()) before.set(el.dataset.id, el.getBoundingClientRect());
  change();
  const moved = [];
  for (const el of all()) {
    const b = before.get(el.dataset.id);
    if (!b) continue;
    const a = el.getBoundingClientRect();
    const dx = b.left - a.left, dy = b.top - a.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
    el.style.transition = 'none';
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    moved.push(el);
  }
  if (!moved.length) return;
  document.body.offsetWidth;   // apply the starting positions before animating
  for (const el of moved) { el.style.transition = 'transform .18s ease-out'; el.style.transform = ''; }
}

/* ---------------- tapping and dragging ---------------- */

let press = null, ghost = null, dropShape = null;
const unit = v => Math.min(1, Math.max(0, v));

function canPick(id) {
  if (A.W) return true;
  return A.S && me() && A.order.includes(id);
}

document.addEventListener('pointerdown', e => {
  const t = e.target.closest && e.target.closest('.tile[data-id]');
  if (!t || e.button > 0 || t.closest('.ghost')) return;
  const id = +t.dataset.id;
  if (!canPick(id)) return;
  // Remember where on the tile it was grabbed, so it is put down exactly where it is shown while dragging.
  const r = t.getBoundingClientRect();
  press = { id, x: e.clientX, y: e.clientY, drag: false, fx: unit((e.clientX - r.left) / r.width), fy: unit((e.clientY - r.top) / r.height) };
});

/* The shape of a group being moved: each tile keeps its row (rows top to bottom, in order) and the tiles in
   a row close up next to each other, left to right. off: id -> [column, row], from the group's top-left. */
function shapeOf(ids) {
  const pos = A.W ? A.W.pos : {};
  let tableRows = 0;
  const raw = ids.map(id => {
    if (pos[id]) { const row = Math.round(pos[id][1]); tableRows = Math.max(tableRows, row + 1); return { id, row, x: pos[id][0], table: true }; }
    const s = slotOf(id) || [0, 0];
    return { id, row: s[0], x: s[1], table: false };
  });
  for (const t of raw) if (!t.table) t.row += tableRows;   // chosen from both: the rack tiles go under the table tiles
  const rows = [...new Set(raw.map(t => t.row))].sort((a, b) => a - b);
  const off = new Map();
  rows.forEach((row, k) => {
    const ts = raw.filter(t => t.row === row).sort((a, b) => a.x - b.x);
    const x0 = Math.round(ts[0].x);
    ts.forEach((t, i) => off.set(t.id, [x0 + i, k]));
  });
  const minX = Math.min(...[...off.values()].map(o => o[0]));
  for (const [id, o] of off) off.set(id, [o[0] - minX, o[1]]);
  return off;
}
// Put several tiles side by side into rack row r, starting at slot s, as one block: the other tiles in the row
// move aside (right first, or left first when "left") but keep their order, and the block stays together.
// Returns false when the row hasn't room for them all.
function placeBlock(g, r, ids, s, left) {
  const cols = g[0].length, n = ids.length;
  while (r >= g.length) g.push(Array(cols).fill(null));
  let row = g[r];
  if (left) { row = row.slice().reverse(); s = cols - (s + n); ids = ids.slice().reverse(); }
  const others = row.map((x, i) => [x, i]).filter(a => a[0] != null);
  if (others.length + n > cols) return false;
  s = Math.max(0, Math.min(cols - n, s));
  const after = others.filter(a => a[1] >= s), before = others.filter(a => a[1] < s);
  let p = s + n;
  const ap = after.map(([x, o]) => { const np = Math.max(o, p); p = np + 1; return [x, np]; });
  const over = Math.max(0, p - cols);   // ran off the end: everything slides back, and the tiles before move over
  s -= over; for (const a of ap) a[1] -= over;
  let q = s - 1;
  const bp = before.slice().reverse().map(([x, o]) => { const np = Math.min(o, q); q = np - 1; return [x, np]; });
  if (q < -1) return false;
  const out = Array(cols).fill(null);
  for (const [x, i] of [...ap, ...bp]) out[i] = x;
  ids.forEach((id, i) => { out[s + i] = id; });
  g[r] = left ? out.reverse() : out;
  return true;
}

// Put a group onto the rack keeping its shape: the grabbed tile goes to slot (pr, pc) and every row of the
// group goes into the matching rack row, pushing the tiles there aside (left when "left").
function placeOnRack(g, ids, off, grab, pr, pc, left) {
  const cols = g[0].length, byRow = new Map();
  for (const id of ids) { const [x, y] = off.get(id) || [0, 0]; if (!byRow.has(y)) byRow.set(y, []); byRow.get(y).push([x, id]); }
  const ys = [...byRow.keys()].sort((a, b) => a - b);
  const height = ys.length ? ys[ys.length - 1] + 1 : 1;
  const top = Math.max(0, Math.min(Math.max(g.length, ROWS) - height, pr - grab[1]));
  for (const y of ys) {
    const list = byRow.get(y).sort((a, b) => a[0] - b[0]), row = list.map(a => a[1]);
    const start = Math.max(0, Math.min(cols - row.length, pc - grab[0] + list[0][0]));
    if (row.length < 2 || !placeBlock(g, top + y, row, start, left)) dropInto(g, row, top + y, left ? start + row.length - 1 : start, false, left ? -1 : 0);
  }
  return g;
}

function startDrag(id) {
  if (!A.sel.has(id)) { A.sel.clear(); A.sel.add(id); }
  const ids = selOrder([...A.sel]);
  ghost = document.createElement('div');
  ghost.className = 'ghost';
  const off = shapeOf(ids);
  // each tile sits in its place in the group; the spacing follows the tile size (rack or table) as it is carried
  ghost.innerHTML = ids.map(x => { const [ox, oy] = off.get(x); return tileHTML(x, '', `position:absolute;left:calc(${ox} * (var(--tw) + var(--gap)));top:calc(${oy} * (var(--th) + var(--rgap)))`); }).join('');
  document.body.appendChild(ghost);
  document.body.classList.add('dragging');
  const rt = $('#rack .grooves .tile, #rack .grooves .cell');
  A.drag = { ids, off, grab: off.get(id), slot: null, view: null, over: false, gx: 0, gy: 0, rtw: rt ? rt.offsetWidth : 50 };
  // Start with the tile shown where it already is, so nothing jumps (a group leaves gaps where it was).
  const at = ids.length === 1 && slotOf(id);
  if (at) setDragSlot([...at, 0]);
  renderCenter(); renderMe();
}

function slotOf(id) {
  for (let r = 0; r < A.grid.length; r++) { const c = A.grid[r].indexOf(id); if (c >= 0) return [r, c]; }
  return null;
}

function setDragSlot(at) {
  const d = A.drag;
  // at: the slot under the grabbed tile, and which way the tiles there are pushed (see dropInto)
  if (at) at = [at[0], at[1], 0, d.dir < 0 ? -1 : 0];
  const key = at ? at.join(',') : null;
  if (d.slot === key) return false;
  d.slot = key;
  if (at) {
    const mv = new Set(d.ids);
    d.view = placeOnRack(cloneGrid(A.grid).map(r => r.map(x => (mv.has(x) ? null : x))), d.ids, d.off, d.grab, at[0], at[1], at[3] < 0);
  } else d.view = null;
  return true;
}

// Which slot the pointer is over, from the rack's fixed grid (never from tiles that are mid-slide).
// It only changes when the pointer crosses the gap into the next slot, so nothing twitches.
// Pointing at a tile puts yours in its place and slides it (and the ones after it) aside.
// Which slot a point on the rack is in (the gaps between slots are split down the middle).
function slotAt(x, y) {
  const g = $('#rack .grooves'), kids = g.children, cols = A.cols;
  if (!kids.length || !cols) return null;
  const k0 = kids[0];
  const pitchX = kids.length > 1 && cols > 1 ? kids[1].offsetLeft - k0.offsetLeft : k0.offsetWidth + GAP;
  const pitchY = kids.length > cols ? kids[cols].offsetTop - k0.offsetTop : k0.offsetHeight + 12;
  const box = g.getBoundingClientRect();
  const fx = (x - box.left - k0.offsetLeft + GAP / 2) / pitchX;
  // rows split halfway across the groove between them (a tile is 12px shorter than its row)
  const fy = (y - box.top - k0.offsetTop + 6) / pitchY;
  const rows = Math.ceil(kids.length / cols);
  const r = Math.max(0, Math.min(rows - 1, Math.floor(fy)));
  const c = Math.max(0, Math.min(cols - 1, Math.floor(fx)));
  const at = [r, c, 0];
  at.fx = fx; at.fy = fy;   // where in the slot the point is, for the stickiness in pointermove
  return at;
}

// Dragging near the edge of the playing area scrolls it, but only once the tile has been well inside it:
// a tile coming up from the rack crosses the bottom edge on its way in, and that shouldn't scroll anything.
function edgeScroll(e) {
  const m = document.querySelector('main'), r = m.getBoundingClientRect(), E = 34, step = 14, d = A.drag;
  if (!d.armed) {
    const inside = e.clientX > r.left + E * 2 && e.clientX < r.right - E * 2 && e.clientY > r.top + E * 2 && e.clientY < r.bottom - E * 2;
    if (!inside) return;
    d.armed = true;
  }
  if (e.clientY > r.bottom - E) m.scrollTop += step; else if (e.clientY < r.top + E) m.scrollTop -= step;
  if (e.clientX > r.right - E) m.scrollLeft += step; else if (e.clientX < r.left + E) m.scrollLeft -= step;
}

document.addEventListener('pointermove', e => {
  if (!press) return;
  if (!press.drag) {
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < 8) return;
    press.drag = true;
    startDrag(press.id);
  }
  e.preventDefault();
  const d = A.drag;
  // Which way the tile is moving. It only turns round after a clear move back, so settling a finger
  // over a tile doesn't flip it.
  if (d.ax == null) d.ax = e.clientX;
  if (e.clientX - d.ax > 14 || (d.dir > 0 && e.clientX > d.ax)) { d.dir = 1; d.ax = e.clientX; }
  else if (d.ax - e.clientX > 14 || (d.dir < 0 && e.clientX < d.ax)) { d.dir = -1; d.ax = e.clientX; }
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const overRack = el && el.closest('#rack');
  const canRack = !A.W || d.ids.every(id => A.W.startRack.includes(id));
  d.over = !!(!overRack && A.W && A.bu && el && el.closest('main'));
  // The tiles being carried are drawn at the size they will be where they land, right under the finger.
  const tw = d.over ? A.bu.bw : d.rtw, th = Math.round(tw * 1.34);
  const gap = d.over ? 4 : GAP, rgap = d.over ? 16 : 12;
  ghost.style.setProperty('--tw', tw + 'px'); ghost.style.setProperty('--th', th + 'px');
  ghost.style.setProperty('--gap', gap + 'px'); ghost.style.setProperty('--rgap', rgap + 'px');
  // the group's top-left, so the tile that was grabbed stays exactly under the finger
  d.gx = e.clientX - press.fx * tw - d.grab[0] * (tw + gap);
  d.gy = e.clientY - press.fy * th - d.grab[1] * (th + rgap);
  ghost.style.transform = `translate(${d.gx}px, ${d.gy}px)`;
  // The slot being aimed at sticks until the pointer is well into the next one, so a hand hovering on the
  // line between two slots (or two rows) doesn't make the rack shuffle back and forth.
  // The grabbed tile lands in the slot it covers most: the one its centre is in (slots are all the same size),
  // wherever on the tile it was picked up.
  const cx = d.gx + d.grab[0] * (tw + gap) + tw / 2, cy = d.gy + d.grab[1] * (th + rgap) + th / 2;
  let at = overRack && canRack ? slotAt(cx, cy) : null;
  const STICK = 0.1;   // just enough to stop a wobbling hand flickering between two slots
  if (at && d.aim && Math.abs(at.fy - (d.aim[0] + 0.5)) < 0.5 + STICK && Math.abs(at.fx - (d.aim[1] + 0.5)) < 0.5 + STICK) at = [d.aim[0], d.aim[1], 0];
  d.aim = at ? [at[0], at[1]] : null;
  if (setDragSlot(at)) flip(null, renderRack);
  if (d.over) edgeScroll(e); else d.armed = false;
}, { passive: false });

function endDrag() {
  ghost && ghost.remove(); ghost = null;
  document.body.classList.remove('dragging');
  const d = A.drag; A.drag = null;
  return d;
}

document.addEventListener('pointerup', () => {
  if (!press) return;
  const p = press; press = null;
  if (!p.drag) { toggle(p.id); return; }
  const d = endDrag();
  dropShape = { off: d.off, grab: d.grab };   // the group lands in the shape it was carried in
  try {
    if (d.slot) flip(null, () => moveSelected('rackslot:' + d.slot));
    else if (d.over && A.W && $('#board')) moveSelected('board', boardPoint(d.gx, d.gy));
    else { A.sel.clear(); flip(null, renderAll); }
  } finally { dropShape = null; }
});
document.addEventListener('pointercancel', () => {
  if (!press) return;
  const p = press; press = null;
  if (p.drag) { endDrag(); A.sel.clear(); renderAll(); }
});


/* Choosing several tiles with the mouse: press on an empty part of the table or rack and drag a box over
   them. Shift (or Ctrl/Cmd) adds to the tiles already chosen. A plain click on an empty spot still puts the
   chosen tiles there, as before. */
let band = null, noClickUntil = 0;
document.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'mouse' || e.button !== 0 || press || !A.S || A.S.phase !== 'play') return;
  const t = e.target;
  if (!t.closest || t.closest('.tile[data-id], button, input, a, .ghost, #spaceTile')) return;
  if (!t.closest('main, #rack')) return;
  band = { x: e.clientX, y: e.clientY, on: false, base: e.shiftKey || e.ctrlKey || e.metaKey ? new Set(A.sel) : new Set(), el: null };
});
document.addEventListener('pointermove', e => {
  if (!band) return;
  if (!band.on) {
    if (Math.hypot(e.clientX - band.x, e.clientY - band.y) < 6) return;
    band.on = true;
    band.el = document.createElement('div');
    band.el.className = 'marquee';
    document.body.appendChild(band.el);
    document.body.classList.add('banding');
  }
  e.preventDefault();
  const l = Math.min(band.x, e.clientX), t = Math.min(band.y, e.clientY), r = Math.max(band.x, e.clientX), b = Math.max(band.y, e.clientY);
  Object.assign(band.el.style, { left: l + 'px', top: t + 'px', width: r - l + 'px', height: b - t + 'px' });
  const sel = new Set(band.base);
  for (const el of document.querySelectorAll('#board .tile[data-id], #rack .grooves .tile[data-id]')) {
    const id = +el.dataset.id, q = el.getBoundingClientRect();
    if (canPick(id) && q.left < r && q.right > l && q.top < b && q.bottom > t) sel.add(id);
  }
  // only the outlines change while the box is being drawn; everything else catches up when it is let go
  for (const el of document.querySelectorAll('#board .tile[data-id], #rack .grooves .tile[data-id]')) el.classList.toggle('sel', sel.has(+el.dataset.id));
  A.sel = sel;
});
const endBand = () => {
  if (!band) return;
  const was = band; band = null;
  if (!was.on) return;
  was.el.remove();
  document.body.classList.remove('banding');
  noClickUntil = Date.now() + 250;   // the click that ends the box doesn't also move the tiles
  renderCenter(); renderMe();
};
document.addEventListener('pointerup', endBand);
document.addEventListener('pointercancel', endBand);

/* The Space tile: a dotted tile that always stands in the bottom-right corner of the rack. Put it down like any
   tile and it leaves a space there, then goes back to its corner: on the rack, into any slot (the tiles there
   slide aside); on the table (your turn), into a set, which splits in two at that point. */
function spaceTile() {
  let el = $('#spaceTile');
  if (!el) {
    el = document.createElement('div');
    el.id = 'spaceTile'; el.className = 'spacetile';
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', 'Space: drag onto a tile to open a space before it');
    el.title = 'Drag onto a tile to open a space before it';
    el.innerHTML = `${ic('space')}<small>SPACE</small>`;
    $('#rack').appendChild(el);
  }
  return el;
}
function placeSpaceTile() {
  const el = spaceTile(), g = $('#rack .grooves'), kids = g.children, cols = A.cols;
  if (!kids.length || !cols) { el.hidden = true; return; }
  const rows = Math.ceil(kids.length / cols), last = kids[(rows - 1) * cols + cols - 1] || kids[kids.length - 1];
  const rr = $('#rack').getBoundingClientRect(), q = last.getBoundingClientRect();
  el.hidden = false;
  el.style.left = (q.right + GAP - rr.left) + 'px';
  el.style.top = (q.top - rr.top) + 'px';
}
let spaceDrag = null;
const SPACE = -1;   // stands in for the Space tile while working out where it would go on the rack
const spaceMark = id => { for (const t of document.querySelectorAll('.tile.spacemark')) t.classList.remove('spacemark'); if (id != null) { const t = document.querySelector(`#board .tile[data-id="${id}"]`); if (t) t.classList.add('spacemark'); } };
// On the table: the set the Space tile is put into, and the tile in that set it would push along (the space
// opens before it). Dropped before a set's first tile, after its last, or on empty felt, it does nothing.
function spaceOnTable(gx, gy) {
  if (!A.W || !$('#board')) return null;
  const [x, y] = boardPoint(gx, gy), pos = A.W.pos;
  for (const g of groupsOf(pos)) {
    const sx = pos[g[0]][0], sy = pos[g[0]][1];
    if (Math.abs(sy - y) > 0.5) continue;
    const k = Math.round(x - sx);
    if (k > 0 && k < g.length) return g[k];
  }
  return null;
}
document.addEventListener('pointerdown', e => {
  const st = e.target.closest && e.target.closest('#spaceTile');
  if (!st || e.button > 0 || press || !A.S || A.S.phase !== 'play') return;
  e.preventDefault();
  const r = st.getBoundingClientRect();
  const ghostEl = st.cloneNode(true);
  ghostEl.removeAttribute('id'); ghostEl.classList.add('carried');
  ghostEl.style.left = '0'; ghostEl.style.top = '0';   // it is moved with transform; not where the original stands
  // picked up from where the Space tile stands, at its size, so it does not fly in from a corner
  Object.assign(ghostEl.style, { width: r.width + 'px', height: r.height + 'px', transform: `translate(${r.left}px, ${r.top}px)` });
  ghostEl.style.setProperty('--tw', r.width + 'px'); ghostEl.style.setProperty('--th', r.height + 'px');
  document.body.appendChild(ghostEl);
  st.classList.add('away');
  spaceDrag = { fx: (e.clientX - r.left) / r.width, fy: (e.clientY - r.top) / r.height, rtw: r.width, el: ghostEl, mark: null, slot: null, aim: null, dir: 0, ax: e.clientX, gx: r.left, gy: r.top };
  // the rack shows the space opening like any tile would (neighbours slide aside)
  A.drag = { ids: [], view: null, space: true };
});
document.addEventListener('pointermove', e => {
  if (!spaceDrag) return;
  e.preventDefault();
  const d = spaceDrag;
  if (e.clientX - d.ax > 14 || (d.dir > 0 && e.clientX > d.ax)) { d.dir = 1; d.ax = e.clientX; }
  else if (d.ax - e.clientX > 14 || (d.dir < 0 && e.clientX < d.ax)) { d.dir = -1; d.ax = e.clientX; }
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const overRack = el && el.closest('#rack');
  const overTable = !!(!overRack && A.W && A.bu && el && el.closest('main'));
  // carried at the size of a tile wherever it is: table size over the table, rack size elsewhere
  const tw = overTable ? A.bu.bw : d.rtw, th = Math.round(tw * 1.34);
  if (tw !== d.tw) {   // only when it crosses between the rack and the table
    d.tw = tw;
    Object.assign(d.el.style, { width: tw + 'px', height: th + 'px' });
    d.el.style.setProperty('--tw', tw + 'px'); d.el.style.setProperty('--th', th + 'px');
  }
  d.gx = e.clientX - d.fx * tw; d.gy = e.clientY - d.fy * th;
  d.el.style.transform = `translate(${d.gx}px, ${d.gy}px)`;
  // the table: mark the tile it would push along
  const id = overTable ? spaceOnTable(d.gx, d.gy) : null;
  if (id !== d.mark) { d.mark = id; spaceMark(id); }
  // the rack: the slot it covers most (with a little stickiness), and a preview with the space opened there
  let at = overRack ? slotAt(d.gx + tw / 2, d.gy + th / 2) : null;
  if (at && d.aim && Math.abs(at.fy - (d.aim[0] + 0.5)) < 0.6 && Math.abs(at.fx - (d.aim[1] + 0.5)) < 0.6) at = [d.aim[0], d.aim[1], 0];
  d.aim = at ? [at[0], at[1]] : null;
  const key = at ? `${at[0]},${at[1]},${d.dir < 0 ? -1 : 0}` : null;
  if (key !== d.slot) {
    d.slot = key;
    A.drag.view = at ? spaceView(at[0], at[1], d.dir < 0) : null;
    flip(null, renderRack);
  }
}, { passive: false });
// The rack with the Space tile put in at (r, c) like any tile (pushing tiles aside), then taken out again:
// what is left is the rack with a space at that slot.
function spaceView(r, c, left) {
  const g = dropInto(cloneGrid(A.grid), [SPACE], r, c, false, left ? -1 : 0);
  return g.map(row => row.map(x => (x === SPACE ? null : x)));
}
const endSpaceDrag = drop => {
  if (!spaceDrag) return;
  const d = spaceDrag; spaceDrag = null;
  d.el.remove(); spaceMark(null);
  const view = A.drag && A.drag.space ? A.drag.view : null;
  A.drag = null;
  const st = $('#spaceTile'); if (st) st.classList.remove('away');
  if (drop && view) {
    // the rack: keep the space where the tile was put
    if (A.W) A.hist.push(snapshotW());
    A.wide = null;
    flip(null, () => { A.grid = view; saveGrid(); renderRack(); });
    if (A.W) renderMe();
  } else if (drop && d.mark != null) {
    // the table: the space opens before the marked tile, splitting its set
    A.sel = new Set([d.mark]); addSpace();
  } else flip(null, renderRack);
};
document.addEventListener('pointerup', () => endSpaceDrag(true));
document.addEventListener('pointercancel', () => endSpaceDrag(false));

function toggle(id) {
  if (A.sel.has(id)) A.sel.delete(id); else A.sel.add(id);
  renderCenter(); renderMe();
}

document.addEventListener('click', e => {
  if (Date.now() < noClickUntil) return;
  // Tapping an empty spot (on the table or the rack) puts the chosen tile there. With several tiles chosen,
  // tapping an empty spot just lets go of them: a group is moved by dragging it.
  const empty = !e.target.closest('.tile') && (e.target.closest('#board') || e.target.closest('[data-drop]'));
  if (empty && A.sel.size > 1) { A.sel.clear(); renderAll(); return; }
  const bd = e.target.closest('#board');
  if (bd && A.sel.size && !e.target.closest('.tile')) {
    if (A.W) moveSelected('board', boardPoint(e.clientX - A.bu.bw / 2, e.clientY - A.bu.bh / 2));
    else { A.sel.clear(); renderAll(); }
    return;
  }
  const d = e.target.closest('[data-drop]');
  if (d && A.sel.size && !e.target.closest('.tile')) { flip(null, () => moveSelected(d.dataset.drop)); return; }
  const sw = e.target.closest('[data-setrc]');
  if (sw) { A.rc = sw.dataset.setrc; saveRc(); send({ t: 'rc', rc: A.rc }); renderAll(); return; }
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const act = b.dataset.act;
  if (act === 'start') send({ t: 'start' });
  else if (act === 'newgame') send({ t: 'newgame' });
  else if (act === 'done') done();
  else if (act === 'draw') draw();
  else if (act === 'undo') undo();
  else if (act === 'reset') resetTurn();
  else if (act === 'torack') flip(null, () => moveSelected('rack'));
  else if (act === 'space') addSpace();
  else if (act === 'fit') { A.fit = !A.fit; renderAll(); }
  else if (act === 'sortnum') sortRack('num');
  else if (act === 'sortcol') sortRack('col');
  else if (act === 'skip') send({ t: 'skip' });
  else if (act === 'copy') copyLink();
  else if (act === 'leave') leaveTable('You left the table.');
  else if (act === 'addcpu') send({ t: 'addcpu', level: b.dataset.level });
  else if (act === 'rmcpu') send({ t: 'rmcpu', pid: b.dataset.pid });
  else if (act === 'share') navigator.share({ title: 'Family Tiles', text: 'Come play tiles with us!', url: location.origin + location.pathname + '?room=' + A.code }).catch(() => {});
});

function copyLink() {
  const link = location.origin + location.pathname + '?room=' + A.code;
  (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(() => toast('Link copied! Paste it into a text or email.'), () => {
    const i = $('.linkrow input'); i.select(); toast('Press and hold (or Ctrl+C) to copy the link.');
  });
}

/* ---------------- camera, sound, size ---------------- */

async function toggleCam() {
  if (A.camOn) {
    A.video.cameraOff(); A.camOn = false;
  } else {
    try {
      await A.video.cameraOn(qs.has('fakecam'));
      A.camOn = true; A.micOn = true;
    } catch (e) {
      toast(e && e.name === 'NotAllowedError'
        ? 'The camera is blocked. Allow the camera for this page in your browser settings, then try again.'
        : 'Could not start the camera. ' + (e && e.message ? e.message : ''), 7000);
      return;
    }
  }
  send({ t: 'cam', cam: A.camOn, mic: A.camOn && A.micOn && A.video.hasMic() });
  renderStatus(); renderSeats();
}

function toggleMic() {
  A.micOn = !A.micOn;
  A.video.setMic(A.micOn);
  send({ t: 'cam', cam: A.camOn, mic: A.camOn && A.micOn && A.video.hasMic() });
  renderStatus();
}

function applyZoom() {
  A.zoom = Math.min(1.8, Math.max(0.7, Math.round(A.zoom * 10) / 10));
  document.documentElement.style.setProperty('--zoom', A.zoom);
  $('#zoomVal').textContent = Math.round(A.zoom * 100) + '%';
  if (A.S) { renderCenter(); renderRack(); }
  store.set('zoom', A.zoom);
}

$('#camBtn').addEventListener('click', toggleCam);
$('#micBtn').addEventListener('click', toggleMic);
$('#bigger').addEventListener('click', () => { A.zoom += 0.1; applyZoom(); });
$('#smaller').addEventListener('click', () => { A.zoom -= 0.1; applyZoom(); });
$('#shapesOn').checked = A.shapes;
$('#shapesOn').addEventListener('change', e => { A.shapes = e.target.checked; store.set('shapes', A.shapes); renderCenter(); renderRack(); });
$('#soundOn').checked = A.sound;
$('#soundOn').addEventListener('change', e => { A.sound = e.target.checked; store.set('sound', A.sound); if (A.sound) beep(660, 0.12); });
$('#volList').addEventListener('input', e => {
  const r = e.target.closest('[data-volpid]');
  if (!r) return;
  A.vol[r.dataset.volpid] = r.value / 100;
  store.set('vol', A.vol);
  r.nextElementSibling.textContent = r.value + '%';
  renderSeats();
});
function showSettings(open) {
  if (open) { renderVolumes(true); help.render(); }
  $('#settings').hidden = !open;
  $('#setBtn').setAttribute('aria-expanded', open);
  $('#setBtn').classList.toggle('on', open);
}
$('#setBtn').addEventListener('click', e => { e.stopPropagation(); showSettings($('#settings').hidden); });
$('#setClose').addEventListener('click', () => showSettings(false));
document.addEventListener('pointerdown', e => { if (!$('#settings').hidden && !(e.target.closest && e.target.closest('#settings, #setBtn'))) showSettings(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') showSettings(false); });
let rz = 0;
window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { renderSeats(); if (A.S && A.S.phase === 'play') renderCenter(); else fitMain(); renderRack(); }, 150); });

// Leave the table and go back to the join screen, where you can join again (same or different table).
// Your seat is kept while a game is on, so joining the same table again puts you back in it.
function leaveTable(msg) {
  if (!A.net) return;
  A.net.stop(); A.net = null;
  A.video.stopAll();
  A.camOn = false; A.micOn = true;
  A.S = null; A.W = null; A.fit = false; A.lastAlert = null; A.lastShame = null; A.hist = []; A.sel.clear(); A.drag = null; A.loose.clear(); A.sortUndo = null; A.status = 'off';
  for (const el of seatEls.values()) el.remove();
  seatEls.clear(); videoEls.clear();
  for (const g of gains.values()) try { g.src.disconnect(); } catch (e) { /* ignore */ }
  gains.clear();
  showSettings(false);
  help.leave();
  stats.leave();
  $('#game').hidden = true; $('#join').hidden = false;
  document.title = 'Family Tiles';
  const u = new URL(location.href); u.searchParams.delete('auto'); history.replaceState(null, '', u);
  if (msg) toast(msg, 6000);
}
window.FT.leaveTable = leaveTable;

$('#leaveBtn').addEventListener('click', () => leaveTable('You left the table.'));
// Closing the table for everyone asks for a second tap, so it can't happen by accident.
let closeArm = 0;
$('#closeAllBtn').addEventListener('click', () => {
  const b = $('#closeAllBtn');
  if (!b.classList.contains('armed')) {
    b.classList.add('armed');
    b.querySelector('span').textContent = 'Tap again to close';
    clearTimeout(closeArm);
    closeArm = setTimeout(() => { b.classList.remove('armed'); b.querySelector('span').textContent = 'Close for everyone'; }, 4000);
    return;
  }
  clearTimeout(closeArm);
  b.classList.remove('armed'); b.querySelector('span').textContent = 'Close for everyone';
  send({ t: 'closeall' });
});

// The signature move: a big signed "MJ!" across everyone's screen.
let mjT = 0;
function showMJ(name) {
  const el = $('#mj');
  el.querySelector('.by').textContent = `${name} pulled an MJ!`;
  el.hidden = false;
  el.classList.remove('play'); el.offsetWidth; el.classList.add('play');
  clearTimeout(mjT); mjT = setTimeout(() => { el.hidden = true; el.classList.remove('play'); }, 3200);
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.18), i * 90));
}
window.FT.showMJ = showMJ;

// "3 tiles left" / "Last tile!": a card in the player's rack colour drops in with their tiles (backs) on it.
let alertT = 0;
function showAlert(a) {
  // An MJ on the same turn goes first.
  if (!$('#mj').hidden) { setTimeout(() => showAlert(a), 3300); return; }
  let el = $('#alert');
  if (!el) { el = document.createElement('div'); el.id = 'alert'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  const one = a.n === 1, mine = a.pid === pid;
  const who = mine ? 'You' : a.name;
  const line = one ? (mine ? 'You have one tile to go!' : `${esc(who)} has one tile to go!`)
    : (mine ? `You are down to ${a.n} tiles` : `${esc(who)} is down to ${a.n} tiles`);
  el.className = one ? 'one' : 'few';
  el.setAttribute('style', rackStyle(a.rc));
  el.innerHTML = `<div class="al-card">
      <div class="al-tiles">${'<i></i>'.repeat(a.n)}</div>
      <div class="al-text"><b>${one ? 'Last tile!' : `${a.n} tiles left`}</b><span>${line}</span></div>
      <div class="al-shine"></div>
    </div>`;
  el.hidden = false;
  el.classList.remove('play'); el.offsetWidth; el.classList.add('play');
  clearTimeout(alertT); alertT = setTimeout(() => { el.hidden = true; el.classList.remove('play'); }, one ? 3600 : 3100);
  (one ? [784, 988, 784, 1175] : [659, 784, 880]).forEach((f, i) => setTimeout(() => beep(f, one ? 0.16 : 0.13), i * 110));
}
window.FT.showAlert = showAlert;

// Someone switched on "Always show the best play": a big red stamp for everyone.
let shameT = 0;
function showShame(a) {
  let el = $('#shame');
  if (!el) { el = document.createElement('div'); el.id = 'shame'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  const mine = a.pid === pid;
  el.innerHTML = '<div class="sh-stamp">Cheater!</div><div class="sh-by">' + (mine ? 'You turned on the best-play helper. Everyone can see.' : esc(a.name) + ' turned on the best-play helper') + '</div>';
  el.hidden = false;
  el.classList.remove('play'); el.offsetWidth; el.classList.add('play');
  clearTimeout(shameT); shameT = setTimeout(() => { el.hidden = true; el.classList.remove('play'); }, 3400);
  [392, 330, 262].forEach((f, i) => setTimeout(() => beep(f, 0.2), i * 160));
}
window.FT.showShame = showShame;

let toastT = 0;
function toast(text, ms = 4000) {
  const t = $('#toast');
  t.innerHTML = `${ic('alert')}<span>${esc(text)}</span>`; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms);
}

let ac = null;
function beep(f, dur, f2) {
  if (!A.sound) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = f;
    if (f2) o.frequency.setValueAtTime(f2, ac.currentTime + dur / 2);
    g.gain.setValueAtTime(0.15, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + dur);
  } catch (e) { /* no sound */ }
}

const stats = initStats({ A, pid, esc, ic, send });
stats.unlock(true);   // statistics are open to everyone, from Settings
const help = initHelp({ A, pid, send, toast, esc, ic });
$('#statsBtn').addEventListener('click', () => stats.open());
setupJoin();
