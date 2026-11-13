// Family Tiles: what each player sees and touches.
import { Net } from './net.js';
import { Video } from './video.js';
import { tile, analyze, openingPoints, checkTurn, groupsOf, tidyPos, autoSplit, SYMBOLS, COLOR_NAMES, OPEN_POINTS, BOARD_W } from './rules.js';

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
  vol: store.get('vol', {}), sound: store.get('sound', true), sortUndo: null, grid: null, cols: 7, rc: (() => { try { return sessionStorage.getItem('ft-rc'); } catch (e) { return null; } })() || store.get('rc', 'yellow'), lastFx: null, drag: null, camOn: false, micOn: true, zoom: store.get('zoom', 1), shapes: store.get('shapes', true),
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
    onOpen: () => hello(),
    onMsg: m => {
      if (m.t === 'state') setState(m.s);
      else if (m.t === 'nope') { toast(m.why); beep(220, 0.25); }
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
  A.video.sync(S.players.filter(p => p.on && p.peer && p.pid !== pid).map(p => p.peer));
  flip(null, renderAll);
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
function moveSelected(target, pt) {
  const ids = [...A.sel];
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
    const x = Math.min(Math.max(pt[0], 0), Math.max(0, BOARD_W - moving.length)), y = Math.max(pt[1], 0);
    moving.forEach((id, i) => { W.pos[id] = [r2(x + i), r2(y)]; A.loose.add(id); });
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
  // the row was full: its last tile moves down to the start of the next row
  if (r + 1 >= g.length) g.push(Array(n).fill(null));
  insertAt(g, out, r + 1, 0, false);
}

// The Space button: puts a space just before each selected tile. On the table that splits a set in two;
// on the rack the tile and its neighbours slide over one slot.
function addSpace() {
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
    A.grid = cloneGrid(A.W.startGrid);
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
  const face = t.j ? '<span class="num">☺</span><span class="sym">JOKER</span>'
    : `<span class="num">${t.n}</span>${A.shapes ? `<span class="sym">${SYMBOLS[t.c]}</span>` : ''}`;
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
    el.innerHTML = `<div class="face"><div class="avatar"></div><div class="nm"></div><div class="flag">▶ TURN</div><div class="open30"></div></div>
      <div class="minirack"><div class="backs"></div><div class="mini-edge"><span class="engr"></span></div></div>
      <div class="tag"></div>`;
    seatEls.set(p.pid, el);
  }
  return el;
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
    el.querySelector('.engr').textContent = p.name;
    el.querySelector('.nm').textContent = p.name;
    const mr = el.querySelector('.minirack'), st = rackStyle(p.rc);
    if (mr.getAttribute('style') !== st) mr.setAttribute('style', st);
    // Their rack shows the backs of the tiles they still hold.
    const backs = el.querySelector('.backs'), n = p.seat && playing ? count : 0;
    if (backs.childElementCount !== n) backs.innerHTML = '<i></i>'.repeat(n);
    backs.title = n ? `${n} tiles left` : '';
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
    const avHtml = p.cpu ? `${ic('bot')}<small>${LEVEL_NAMES[p.cpu]}</small>` : esc((p.name || '?').slice(0, 1).toUpperCase());
    if (av.innerHTML !== avHtml) av.innerHTML = avHtml;
    av.classList.toggle('bot', !!p.cpu);
    av.style.background = p.cpu ? '' : `hsl(${hash(p.pid) % 360},55%,38%)`;
    if (p.cpu) av.setAttribute('style', rackStyle(p.rc));
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

  const wide = window.innerWidth >= 900;
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

function renderCenter() {
  const S = A.S, box = $('#center');
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
      <div class="lobbyfoot"><span class="tip">${ic('cam')}Press <b>Camera</b> so everyone can see you.</span><button class="btn small leave" data-act="leave">${ic('logout')}Leave</button></div>
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
    <div class="wins">${rows.map(p => `<div class="winrow ${p.pid === r.pid ? 'win' : ''}"><span class="wn">${esc(p.name)}</span><span class="wc">${ic('trophy')}<b>${p.wins || 0}</b></span></div>`).join('')}</div>
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

// The size of a tile on the table. It shrinks (down to a readable minimum) so the whole width fits;
// on very narrow screens the table scrolls sideways instead of wrapping a set onto two lines.
function measureBoard(box) {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;visibility:hidden;width:var(--bw)';
  box.appendChild(probe);
  const base = probe.offsetWidth || 48;
  probe.remove();
  const fit = Math.floor(box.clientWidth / BOARD_W) - 4;
  const bw = Math.min(base, Math.max(fit, Math.round(30 * A.zoom)));
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
  const u = measureBoard(box);
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
  const room = mainEl.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 2;
  const h = Math.max(html ? (maxY + (live ? 2.4 : 1.2)) * u.uy : 0, room);
  box.innerHTML = `<div id="board" class="board ${live ? 'live' : ''}" style="--tw:${u.bw}px;--th:${u.bh}px;width:${Math.ceil(maxX * u.ux - 4)}px;height:${Math.floor(h)}px">${html}</div>`;
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
  const sp = `<button class="btn" data-act="space" aria-label="Add a space before the chosen tile" title="Add a space before the chosen tile" ${A.sel.size ? '' : 'disabled'}>${ic('space')}<span class="long">Space</span></button>`;
  let html = '';
  if (myTurn()) {
    const placed = A.W && A.W.rack.length < A.W.startRack.length;
    if (A.W && !m.opened) {
      const pts = openingPoints(A.W.startTable, A.W.startRack, groupsOf(A.W.pos));
      const ok = pts >= OPEN_POINTS;
      html += `<span class="meter ${ok ? 'ok' : ''}" title="Your first play has to add up to ${OPEN_POINTS}"><span class="bar"><i style="width:${Math.min(100, pts / OPEN_POINTS * 100)}%"></i></span><span><b>${pts}</b>/${OPEN_POINTS}</span>${ok ? ic('check') : ''}</span>`;
    }
    html += `<button class="btn go" data-act="done">${ic('check')}Done</button>`;
    html += `<button class="btn draw" data-act="draw" title="Tiles left to draw: ${S.pool.length}">${S.pool.length ? `${ic('draw')}Draw<b class="cnt">${S.pool.length}</b>` : `${ic('skip')}Pass`}</button>`;
    html += `<button class="btn" data-act="undo" aria-label="Undo" title="Undo" ${A.hist.length ? '' : 'disabled'}>${ic('undo')}<span class="long">Undo</span></button>`;
    html += `<button class="btn" data-act="reset" aria-label="Reset" title="Reset" ${placed || (A.W && A.hist.length) ? '' : 'disabled'}>${ic('reset')}<span class="long">Reset</span></button>`;
    html += `<button class="btn" data-act="torack" aria-label="Back to rack" title="Back to rack" ${A.sel.size ? '' : 'disabled'}>${ic('torack')}<span class="long">Rack</span></button>`;
    html += sp;
  } else {
    const cur = S.players.find(p => p.pid === S.turn);
    if (cur) html += `<span class="turnchip" style="${rackStyle(cur.rc)}">${cur.cpu ? ic('bot') : ''}${esc(cur.name)}</span>`;
    if (cur && !cur.on) html += `<button class="btn" data-act="skip">${ic('skip')}Skip</button>`;
    html += `<span class="poolchip" title="Tiles left to draw: ${S.pool.length}">${ic('draw')}<b>${S.pool.length}</b></span>`;
    if (m.seat) html += sp;
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
    const r = [];
    row.forEach((x, c) => {
      const keep = x != null && want.has(x) && !seen.has(x);
      if (keep) seen.add(x);
      if (c < cols) r.push(keep ? x : null); else if (keep) homeless.push(x);
    });
    while (r.length < cols) r.push(null);
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
function dropInto(g, ids, r, c, after) {
  const cols = g[0].length;
  let leftFirst = false;
  if (after && g[r][c] != null) {
    if (c + 1 < cols) c++;
    else leftFirst = true;   // after the last tile in a full row: the row slides left instead
  }
  for (const id of ids) {
    while (r >= g.length) g.push(Array(cols).fill(null));
    insertAt(g, id, r, c, leftFirst);
    if (++c >= cols) { c = 0; r++; leftFirst = false; }
  }
  return g;
}

// Fit at least 7 slots across; on a narrow rack the tiles shrink a little to make room.
const MIN_COLS = 7;
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
  const cols = Math.floor((w + GAP) / (tw + GAP));
  if (cols >= MIN_COLS) return cols;
  $('#rack').style.setProperty('--tw', Math.max(30, Math.floor((w + GAP) / MIN_COLS - GAP)) + 'px');
  return MIN_COLS;
}

function renderRack() {
  const S = A.S, m = me();
  const rack = $('#rack');
  for (const kv of rackStyle(A.rc).split(';')) { const [k, v] = kv.split(':'); rack.style.setProperty(k, v); }
  rack.classList.toggle('picking', A.sel.size > 0);
  rack.classList.toggle('myturn', myTurn());
  $('#rackName').textContent = A.name;
  const g = rack.querySelector('.grooves');
  if (!S || !m || !m.seat || S.phase === 'lobby') {
    g.style.gridTemplateColumns = '';
    g.innerHTML = `<div class="rackmsg">${S && S.phase === 'play' ? 'You are watching this game. You will get a seat in the next one.' : 'Your tiles will appear here.'}</div>`;
    $('#rackInfo').textContent = '';
    return;
  }
  const ids = rackIds();
  A.cols = measureCols();
  A.grid = fitGrid(A.grid, ids, A.cols);
  saveGrid();
  // While dragging: a preview of where the tiles would land (shown faint), or gaps where they came from.
  const d = A.drag;
  const view = d && d.view ? d.view : A.grid;
  g.style.gridTemplateColumns = `repeat(${A.cols}, var(--tw))`;
  g.innerHTML = view.map((row, r) => row.map((x, c) => {
    if (x == null || (d && !d.view && d.ids.includes(x))) return `<div class="cell" data-drop="rackslot:${r},${c}"></div>`;
    return tileHTML(x, d && d.view && d.ids.includes(x) ? 'landing' : '');
  }).join('')).join('');
  $('#rackInfo').innerHTML = `${S.phase === 'play' ? openBadge(m.opened) : ''}${ids.length} tiles`;
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
  const mv = new Set(moving);
  const g = cloneGrid(A.grid).map(r => r.map(x => (mv.has(x) ? null : x)));
  if (target.startsWith('rackslot:')) {
    const [r, c, after] = target.slice(9).split(',').map(Number);
    A.grid = dropInto(g, moving, r, c, !!after);
  } else A.grid = g;   // renderRack puts them in the first gaps
}

// Animate tiles from where they were to where they are now, so the rack slides instead of jumping.
function flip(container, change) {
  const before = new Map();
  const all = () => document.querySelectorAll('#rack .grooves .tile[data-id], #board .tile[data-id]');
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

let press = null, ghost = null;
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

function startDrag(id) {
  if (!A.sel.has(id)) { A.sel.clear(); A.sel.add(id); }
  const ids = [...A.sel];
  ghost = document.createElement('div');
  ghost.className = 'ghost';
  ghost.innerHTML = ids.slice(0, 6).map(x => tileHTML(x)).join('');
  document.body.appendChild(ghost);
  document.body.classList.add('dragging');
  const rt = $('#rack .grooves .tile, #rack .grooves .cell');
  A.drag = { ids, idx: Math.min(ids.indexOf(id), 5), slot: null, view: null, over: false, gx: 0, gy: 0, rtw: rt ? rt.offsetWidth : 50 };
  // Start with the tiles shown where they already are, so nothing jumps.
  const at = slotOf(id);
  if (at) setDragSlot([...at, 0]);
  renderCenter(); renderMe();
}

function slotOf(id) {
  for (let r = 0; r < A.grid.length; r++) { const c = A.grid[r].indexOf(id); if (c >= 0) return [r, c]; }
  return null;
}

function setDragSlot(at) {
  const d = A.drag, key = at ? at.join(',') : null;
  if (d.slot === key) return false;
  d.slot = key;
  if (at) {
    const mv = new Set(d.ids);
    d.view = dropInto(cloneGrid(A.grid).map(r => r.map(x => (mv.has(x) ? null : x))), d.ids, at[0], at[1], at[2]);
  } else d.view = null;
  return true;
}

// Which slot the pointer is over, from the rack's fixed grid (never from tiles that are mid-slide).
// It only changes when the pointer crosses the gap into the next slot, so nothing twitches.
// Pointing at a tile puts yours in its place and slides it (and the ones after it) aside.
function slotAt(x, y) {
  const g = $('#rack .grooves'), kids = g.children, cols = A.cols;
  if (!kids.length || !cols) return null;
  const k0 = kids[0];
  const pitchX = kids.length > 1 && cols > 1 ? kids[1].offsetLeft - k0.offsetLeft : k0.offsetWidth + GAP;
  const pitchY = kids.length > cols ? kids[cols].offsetTop - k0.offsetTop : k0.offsetHeight + 12;
  const box = g.getBoundingClientRect();
  const fx = (x - box.left - k0.offsetLeft + GAP / 2) / pitchX;
  const fy = (y - box.top - k0.offsetTop) / pitchY;
  const rows = Math.ceil(kids.length / cols);
  const r = Math.max(0, Math.min(rows - 1, Math.floor(fy)));
  const c = Math.max(0, Math.min(cols - 1, Math.floor(fx)));
  return [r, c, 0];
}

// Dragging near the edge of the playing area scrolls it.
function edgeScroll(e) {
  const m = document.querySelector('main'), r = m.getBoundingClientRect(), E = 34, step = 14;
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
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const overRack = el && el.closest('#rack');
  const canRack = !A.W || d.ids.every(id => A.W.startRack.includes(id));
  d.over = !!(!overRack && A.W && A.bu && el && el.closest('main'));
  // The tiles being carried are drawn at the size they will be where they land, right under the finger.
  const tw = d.over ? A.bu.bw : d.rtw, th = Math.round(tw * 1.34);
  ghost.style.setProperty('--tw', tw + 'px'); ghost.style.setProperty('--th', th + 'px');
  d.gx = e.clientX - press.fx * tw - d.idx * (tw + 4);
  d.gy = e.clientY - press.fy * th;
  ghost.style.transform = `translate(${d.gx}px, ${d.gy}px)`;
  if (setDragSlot(overRack && canRack ? slotAt(e.clientX, e.clientY) : null)) flip(null, renderRack);
  if (d.over) edgeScroll(e);
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
  if (d.slot) flip(null, () => moveSelected('rackslot:' + d.slot));
  else if (d.over && A.W && $('#board')) moveSelected('board', boardPoint(d.gx, d.gy));
  else { A.sel.clear(); flip(null, renderAll); }
});
document.addEventListener('pointercancel', () => {
  if (!press) return;
  const p = press; press = null;
  if (p.drag) { endDrag(); A.sel.clear(); renderAll(); }
});


function toggle(id) {
  if (A.sel.has(id)) A.sel.delete(id); else A.sel.add(id);
  renderCenter(); renderMe();
}

document.addEventListener('click', e => {
  // Tapping an empty spot (on the table or the rack) puts the chosen tiles there.
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
  if (A.S) { if (A.S.phase === 'play') renderCenter(); renderRack(); }
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
  if (open) renderVolumes(true);
  $('#settings').hidden = !open;
  $('#setBtn').setAttribute('aria-expanded', open);
  $('#setBtn').classList.toggle('on', open);
}
$('#setBtn').addEventListener('click', e => { e.stopPropagation(); showSettings($('#settings').hidden); });
$('#setClose').addEventListener('click', () => showSettings(false));
document.addEventListener('pointerdown', e => { if (!$('#settings').hidden && !(e.target.closest && e.target.closest('#settings, #setBtn'))) showSettings(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') showSettings(false); });
let rz = 0;
window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { renderSeats(); if (A.S && A.S.phase === 'play') renderCenter(); renderRack(); }, 150); });

// Leave the table and go back to the join screen, where you can join again (same or different table).
// Your seat is kept while a game is on, so joining the same table again puts you back in it.
function leaveTable(msg) {
  if (!A.net) return;
  A.net.stop(); A.net = null;
  A.video.stopAll();
  A.camOn = false; A.micOn = true;
  A.S = null; A.W = null; A.hist = []; A.sel.clear(); A.drag = null; A.loose.clear(); A.sortUndo = null; A.status = 'off';
  for (const el of seatEls.values()) el.remove();
  seatEls.clear(); videoEls.clear();
  for (const g of gains.values()) try { g.src.disconnect(); } catch (e) { /* ignore */ }
  gains.clear();
  showSettings(false);
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

function hash(s) { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }

setupJoin();
