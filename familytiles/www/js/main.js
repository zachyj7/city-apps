// Family Tiles: what each player sees and touches.
import { Net } from './net.js';
import { Video } from './video.js';
import { tile, analyze, rackPoints, openingPoints, checkTurn, SYMBOLS, COLOR_NAMES, OPEN_POINTS } from './rules.js';

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
const cleanCode = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);

const A = {
  S: null, net: null, video: null, name: '', code: '',
  W: null,            // my turn in progress: { turnNo, table: [{k, ids}], rack: [ids], startTable, startRack }
  hist: [], sel: new Set(), order: [], seen: new Set(), fresh: new Set(),
  nope: null, sound: store.get('sound', true), sortUndo: null, grid: null, cols: 7, rc: (() => { try { return sessionStorage.getItem('ft-rc'); } catch (e) { return null; } })() || store.get('rc', 'yellow'), lastFx: null, drag: null, camOn: false, micOn: true, zoom: store.get('zoom', 1), shapes: store.get('shapes', true),
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
  A.video = new Video(() => renderSeats());
  A.video.init();
  A.net = new Net(code, {
    onStatus: s => { A.status = s; renderStatus(); },
    onOpen: () => hello(),
    onMsg: m => {
      if (m.t === 'state') setState(m.s);
      else if (m.t === 'nope') { A.nope = m.why; renderCenter(); beep(220, 0.25); }
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
  // Keep my own rack order; newly drawn tiles go on the end and glow for a moment.
  if (m) {
    const rack = new Set(m.rack);
    const keep = A.order.filter(id => rack.has(id));
    const added = m.rack.filter(id => !keep.includes(id));
    if (was && was.phase === 'play' && S.phase === 'play' && added.length && added.length < 4) {
      for (const id of added) A.fresh.add(id);
      setTimeout(() => { for (const id of added) A.fresh.delete(id); renderRack(); }, 4000);
    }
    A.order = keep.concat(added);
    if (S.phase !== 'play' || !was || was.round !== S.round) A.fresh.clear();
  }
  if (myTurn()) {
    if (!A.W || A.W.turnNo !== S.turnNo) beginTurn();
  } else {
    if (A.W) A.sel.clear();
    A.W = null; A.hist = []; A.nope = null;
  }
  if (S.phase === 'play' && was && was.turn !== S.turn && S.turn === pid) beep(660, 0.15, 880);
  if (S.phase === 'over' && was && was.phase === 'play') { confetti(); [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => beep(f, 0.22), i * 120)); }
  if (S.fx && S.fx.k !== A.lastFx) { if (A.lastFx !== null || (was && was.v < S.fx.k)) showMJ(S.fx.name); A.lastFx = S.fx.k; }
  else if (A.lastFx === null) A.lastFx = S.fx ? S.fx.k : 0;
  A.video.sync(S.players.filter(p => p.on && p.peer && p.pid !== pid).map(p => p.peer));
  renderAll();
}

function beginTurn() {
  const S = A.S, m = me();
  const w = S.work;
  A.W = {
    turnNo: S.turnNo,
    startTable: S.table.map(a => a.slice()),
    startRack: m.rack.slice(),
    table: (w ? w.table : S.table).map(ids => ({ k: setKey++, ids: ids.slice() })),
    rack: orderLike(w ? w.rack : m.rack),
    startGrid: cloneGrid(A.grid),
  };
  A.hist = []; A.sel.clear(); A.nope = null;
}

function orderLike(ids) {
  const set = new Set(ids);
  const keep = A.order.filter(id => set.has(id));
  return keep.concat(ids.filter(id => !keep.includes(id)));
}

function snapshotW() { return JSON.stringify({ table: A.W.table, rack: A.W.rack, grid: A.grid }); }
function commit() {
  A.nope = null;
  A.W.table = A.W.table.filter(s => s.ids.length);
  A.order = A.W.rack.slice();
  send({ t: 'work', table: A.W.table.map(s => s.ids), rack: A.W.rack });
  renderAll();
}

/* ---------------- moving tiles ---------------- */

function moveSelected(target) {
  const ids = [...A.sel];
  if (!ids.length) return;
  if (!A.W) {   // not my turn: only rearranging my own rack
    if (!target.startsWith('rack')) return;
    toRack(ids.filter(id => A.order.includes(id)), target);
    A.sel.clear(); renderRack(); return;
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
  for (const s of W.table) s.ids = s.ids.filter(id => !mv.has(id));
  if (target === 'new') { W.rack = rackRest; W.table.push({ k: setKey++, ids: moving }); }
  else if (target.startsWith('set:')) {
    const s = W.table.find(x => x.k === +target.slice(4));
    W.rack = rackRest;
    if (s) s.ids.push(...moving); else W.table.push({ k: setKey++, ids: moving });
  } else { W.rack = rackRest.concat(moving); toRack(moving, target); }
  A.sel.clear();
  commit();
}

function undo() {
  if (!A.W || !A.hist.length) return;
  const h = JSON.parse(A.hist.pop());
  A.W.table = h.table; A.W.rack = h.rack; A.grid = h.grid; A.sel.clear(); commit();
}
function resetTurn() {
  if (!A.W) return;
  if (A.W.table.length || A.hist.length) A.hist.push(snapshotW());
  A.W.table = A.W.startTable.map(ids => ({ k: setKey++, ids: ids.slice() }));
  A.W.rack = orderLike(A.W.startRack);
  A.grid = cloneGrid(A.W.startGrid);
  A.sel.clear(); commit();
}
function draw() {
  if (!myTurn()) return;
  A.sel.clear();
  send({ t: 'draw' });
}
function done() {
  if (!A.W) return;
  const why = checkTurn(A.W.startTable, A.W.startRack, A.W.table.map(s => s.ids), A.W.rack, me().opened);
  if (why) { A.nope = why; renderCenter(); beep(220, 0.25); return; }
  send({ t: 'done' });
}
/* ---------------- drawing the screen ---------------- */

function tileHTML(id, extra = '') {
  const t = tile(id);
  const cls = ['tile', t.j ? 'joker' : 'c' + t.c, A.sel.has(id) ? 'sel' : '', A.fresh.has(id) ? 'fresh' : '', extra].join(' ');
  const label = t.j ? 'Joker' : `${COLOR_NAMES[t.c]} ${t.n}`;
  const face = t.j ? '<span class="num">☺</span><span class="sym">JOKER</span>'
    : `<span class="num">${t.n}</span>${A.shapes ? `<span class="sym">${SYMBOLS[t.c]}</span>` : ''}`;
  return `<div class="${cls}" data-id="${id}" role="button" aria-label="${label}">${face}</div>`;
}

function renderAll() { renderStatus(); renderSeats(); renderCenter(); renderMe(); }

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
    el.innerHTML = `<div class="face"><div class="avatar"></div><div class="nm"></div><div class="flag">▶ TURN</div></div>
      <div class="minirack"><div class="ridges"></div><div class="mini-edge"><span class="engr"></span></div><div class="count"></div></div>
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
    const count = isMe && A.W ? A.W.rack.length : work ? work.rack.length : p.rack.length;
    el.classList.toggle('turn', playing && S.turn === p.pid);
    el.classList.toggle('idle', playing && S.turn !== p.pid);
    el.classList.toggle('off', !p.on);
    el.classList.toggle('me', !!isMe);
    el.querySelector('.engr').textContent = p.name;
    el.querySelector('.nm').textContent = p.name;
    const mr = el.querySelector('.minirack'), st = rackStyle(p.rc);
    if (mr.getAttribute('style') !== st) mr.setAttribute('style', st);
    const c = el.querySelector('.count');
    c.textContent = p.seat && S.phase !== 'lobby' ? String(count) : '';
    c.title = 'tiles left';
    let tag = '';
    if (!p.on) tag = '⚠ Lost connection';
    else if (playing && S.turn === p.pid) tag = isMe ? '▶ Your turn' : '▶ Playing now';
    else if (playing && !p.seat) tag = 'Watching';
    else if (S.phase !== 'lobby' || p.total) tag = `Score ${p.total > 0 ? '+' : ''}${p.total}`;
    el.querySelector('.tag').innerHTML = tag;
    const face = el.querySelector('.face');
    const av = face.querySelector('.avatar');
    av.textContent = (p.name || '?').slice(0, 1).toUpperCase();
    av.style.background = `hsl(${hash(p.pid) % 360},55%,38%)`;
    let stream = null, key = p.peer;
    if (isMe) { stream = A.camOn && A.video.cam; key = 'me'; }
    else if (p.cam && p.on) stream = A.video.streams.get(p.peer);
    const old = face.querySelector('video');
    if (stream) {
      const v = videoFor(key, stream, isMe, isMe);
      if (old !== v) { if (old) old.remove(); face.appendChild(v); v.play().catch(() => {}); }
    } else if (old) old.remove();
    // A remote person whose camera is on but whose picture has not arrived yet.
    face.classList.toggle('waiting', !isMe && p.cam && p.on && !stream);
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
}

function syncChildren(parent, kids) {
  kids.forEach((k, i) => { if (parent.children[i] !== k) parent.insertBefore(k, parent.children[i] || null); });
  while (parent.children.length > kids.length) parent.lastChild.remove();
}

function renderCenter() {
  const S = A.S, box = $('#center');
  if (!S) { box.innerHTML = '<div class="panel"><h2>Finding your table…</h2></div>'; $('#banner').innerHTML = ''; return; }
  renderBanner();
  if (S.phase === 'lobby') return renderLobby(box);
  if (S.phase === 'over') return renderOver(box);
  renderBoard(box);
}

function renderBanner() {
  const S = A.S, b = $('#banner');
  let html = '';
  if (S.phase === 'play') {
    const cur = S.players.find(p => p.pid === S.turn);
    // A wide bar in the player's own rack color with their name, so whose turn it is reads at a glance.
    if (cur) html = `<div class="turnbar ${myTurn() ? 'you' : ''}" style="${rackStyle(cur.rc)}">${myTurn() ? 'Your turn!' : `${esc(cur.name)}'s turn`}</div>`;
    const last = S.log[S.log.length - 1];
    if (cur && !cur.on && !myTurn()) html += `<div class="lost">${ic('alert')}${esc(cur.name)} lost connection <button class="btn small" data-act="skip">${ic('skip')}Skip their turn</button></div>`;
    html += `<div class="bannerline">${last ? `<span class="last">${esc(last)}</span>` : ''}<span class="pool">Tiles left to draw: <b>${S.pool.length}</b></span></div>`;
  }
  b.innerHTML = html;
  b.className = myTurn() ? 'mine' : '';
  const cur = S.phase === 'play' && S.players.find(p => p.pid === S.turn);
  document.title = !cur ? 'Family Tiles' : myTurn() ? '▶ Your turn! · Family Tiles' : `${cur.name}'s turn · Family Tiles`;
}

function renderLobby(box) {
  const S = A.S;
  const here = S.players.filter(p => p.on);
  const sets = here.length > 4 ? 2 : 1;
  const link = location.origin + location.pathname + '?room=' + A.code;
  const chips = here.map((p, i) => `<div class="pchip" style="${rackStyle(p.rc)}"><span class="av">${esc((p.name || '?').slice(0, 1).toUpperCase())}</span>
      <span class="pn">${esc(p.name)}<span class="pt">${p.pid === pid ? 'You' : i >= 8 ? 'Watching (table full)' : 'Ready'}</span></span></div>`).join('');
  const open = Math.max(0, Math.min(8, Math.max(2, here.length + 1)) - here.length);
  const empties = Array.from({ length: open }, () => `<div class="pchip empty-seat">Open seat</div>`).join('');
  box.innerHTML = `<div class="card lobby">
    <div class="panelhead"><span class="badge">${ic('users')}</span><div><h2>Table “${esc(A.code)}”</h2><p>Waiting for everyone to sit down</p></div></div>
    <div class="section"><h3>Invite your family</h3>
      <div class="linkrow"><input readonly value="${esc(link)}" aria-label="Table link"><button class="btn" data-act="copy">${ic('link')}Copy link</button>${navigator.share ? `<button class="btn" data-act="share">${ic('share')}Share</button>` : ''}</div>
    </div>
    <div class="section"><h3>At the table · ${here.length} of 8</h3>
      <div class="players">${chips}${empties}</div>
      <p class="hint">${here.length < 2 ? 'Waiting for at least one more player…' : `${Math.min(here.length, 8)} players, ${sets === 2 ? 'two sets of tiles (5 or more players)' : 'one set of tiles'}.`}</p>
    </div>
    <div class="section"><h3>Your rack color</h3><div class="swatches">${swatches(A.rc, 'setrc')}</div></div>
    <button class="btn go huge" data-act="start" ${here.length < 2 ? 'disabled' : ''}>Start the game ${ic('arrow')}</button>
    <p class="tip">${ic('cam')}Press <b>Camera</b> at the top so everyone can see your face.</p>
  </div>`;
}

function renderOver(box) {
  const S = A.S;
  const rows = (S.result || []).slice().sort((a, b) => b.delta - a.delta);
  const win = rows.find(r => r.win);
  const sign = n => (n > 0 ? `<span class="plus">+${n}</span>` : n < 0 ? `<span class="minus">${n}</span>` : '0');
  box.innerHTML = `<div class="card over">
    <div class="winner"><span class="cup">${ic('trophy')}</span><h2>${esc(win ? win.name : '')} wins!</h2></div>
    <table class="scores"><tr><th>Player</th><th>Left on rack</th><th>This game</th><th>Total</th></tr>
    ${rows.map((r, i) => { const p = S.players.find(q => q.pid === r.pid); return `<tr class="${r.win ? 'win' : ''}"><td><span class="rank">${i + 1}</span>${esc(r.name)}</td><td>${r.left}</td><td>${sign(r.delta)}</td><td>${p ? sign(p.total) : ''}</td></tr>`; }).join('')}
    </table>
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

function boardSets() {
  const S = A.S;
  if (A.W) return A.W.table;
  const t = (S.work ? S.work.table : S.table);
  return t.map((ids, i) => ({ k: 'v' + i, ids }));
}

function renderBoard(box) {
  const S = A.S;
  const sets = boardSets();
  const live = !!A.W;
  const before = new Set(S.table.flat());
  const showMarks = !!S.work || live;
  const selecting = A.sel.size > 0;
  let html = '';
  if (A.nope) html += `<div class="nope" role="alert">${ic('alert')}${esc(A.nope)}</div>`;
  if (live && !me().opened) {
    const pts = openingPoints(A.W.startTable, A.W.startRack, A.W.table.map(s => s.ids));
    const ok = pts >= OPEN_POINTS;
    html += `<div class="meter ${ok ? 'ok' : ''}"><span>First play</span><span class="bar"><i style="width:${Math.min(100, pts / OPEN_POINTS * 100)}%"></i></span><span><b>${pts}</b> / ${OPEN_POINTS}</span>${ok ? ic('check') : ''}</div>`;
  }
  if (live && !selecting && !A.W.table.length) html += `<div class="help">${ic('plus')}<span>Tap tiles on your rack to pick them up, then tap <b>New set</b>. Or drag them onto the table.</span></div>`;
  html += `<div class="sets ${live ? 'live' : ''} ${selecting ? 'selecting' : ''}">`;
  for (const s of sets) {
    const a = analyze(s.ids);
    const order = a.ok ? a.order : s.ids;
    const bad = showMarks && !a.ok;
    html += `<div class="set ${bad ? 'bad' : ''}" ${live ? `data-drop="set:${s.k}"` : ''}>
      <div class="tiles">${order.map(id => tileHTML(id, before.has(id) ? '' : 'placed')).join('')}</div>
      ${live ? `<button class="slot" data-drop="set:${s.k}" aria-label="Add picked tiles to this set">${ic('plus')}</button>` : ''}
      ${bad ? `<div class="why">${esc(a.why)}</div>` : ''}
    </div>`;
  }
  if (live) html += `<button class="set newset" data-drop="new">${ic('plus')}New set</button>`;
  if (!sets.length && !live) html += `<div class="empty"><span class="ghosttiles"><i></i><i></i><i></i></span>The table is empty. Sets will appear here.</div>`;
  html += '</div>';
  box.innerHTML = html;
}

function renderMe() {
  const S = A.S, m = me();
  const c = $('#controls');
  // The rack only shows during a game, so the lobby and results get the whole screen.
  document.querySelector('footer').hidden = !(S && S.phase === 'play');
  if (!S || !m) { c.innerHTML = ''; renderRack(); return; }
  let html = '';
  if (myTurn()) {
    const placed = A.W && A.W.rack.length < A.W.startRack.length;
    html += `<button class="btn go" data-act="done">${ic('check')}Done</button>`;
    html += `<button class="btn draw" data-act="draw">${S.pool.length ? `${ic('draw')}<span>Draw<span class="long"> a tile</span></span>` : `${ic('skip')}Pass`}</button>`;
    html += `<button class="btn" data-act="undo" aria-label="Undo" ${A.hist.length ? '' : 'disabled'}>${ic('undo')}<span class="long">Undo</span></button>`;
    html += `<button class="btn" data-act="reset" aria-label="Reset" ${placed || (A.W && A.hist.length) ? '' : 'disabled'}>${ic('reset')}<span class="long">Reset</span></button>`;
    html += `<button class="btn" data-act="torack" aria-label="Back to rack" ${A.sel.size ? '' : 'disabled'}>${ic('torack')}<span><span class="long">Back to </span>rack</span></button>`;
  }
  c.innerHTML = html;
  $('#sorts').hidden = !(m.seat && S.phase === 'play');
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
  $('#rackInfo').innerHTML = `${ids.length} tiles<span class="pts"> · ${rackPoints(ids)} points</span>`;
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
  for (const el of container.querySelectorAll('.tile[data-id]')) before.set(el.dataset.id, el.getBoundingClientRect());
  change();
  const moved = [];
  for (const el of container.querySelectorAll('.tile[data-id]')) {
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
  container.offsetWidth;   // apply the starting positions before animating
  for (const el of moved) { el.style.transition = 'transform .18s ease-out'; el.style.transform = ''; }
}

/* ---------------- tapping and dragging ---------------- */

let press = null, ghost = null, hover = null;

function canPick(id) {
  if (A.W) return true;
  return A.S && me() && A.order.includes(id);
}

document.addEventListener('pointerdown', e => {
  const t = e.target.closest('.tile[data-id]');
  if (!t || e.button > 0 || t.closest('.ghost')) return;
  const id = +t.dataset.id;
  if (!canPick(id)) return;
  press = { id, x: e.clientX, y: e.clientY, drag: false };
});

function startDrag(id) {
  if (!A.sel.has(id)) { A.sel.clear(); A.sel.add(id); }
  ghost = document.createElement('div');
  ghost.className = 'ghost';
  ghost.innerHTML = [...A.sel].slice(0, 6).map(x => tileHTML(x)).join('');
  document.body.appendChild(ghost);
  document.body.classList.add('dragging');
  A.drag = { ids: [...A.sel], slot: null, view: null };
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

document.addEventListener('pointermove', e => {
  if (!press) return;
  if (!press.drag) {
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < 8) return;
    press.drag = true;
    startDrag(press.id);
  }
  e.preventDefault();
  ghost.style.transform = `translate(${e.clientX - 30}px, ${e.clientY - 46}px) rotate(-3deg)`;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const overRack = el && el.closest('#rack');
  const canRack = !A.W || A.drag.ids.every(id => A.W.startRack.includes(id));
  if (setDragSlot(overRack && canRack ? slotAt(e.clientX, e.clientY) : null)) flip($('#rack .grooves'), renderRack);
  const d = overRack ? null : el && el.closest('[data-drop]');
  if (hover !== d) { if (hover) hover.classList.remove('hover'); hover = d; if (d) d.classList.add('hover'); }
}, { passive: false });

function endDrag() {
  ghost && ghost.remove(); ghost = null;
  document.body.classList.remove('dragging');
  if (hover) hover.classList.remove('hover');
  hover = null;
  const d = A.drag; A.drag = null;
  return d;
}

document.addEventListener('pointerup', () => {
  if (!press) return;
  const p = press; press = null;
  if (!p.drag) { toggle(p.id); return; }
  const target = hover;
  const d = endDrag();
  const g = $('#rack .grooves');
  if (d.slot) flip(g, () => moveSelected('rackslot:' + d.slot));
  else if (target) moveSelected(target.dataset.drop);
  else { A.sel.clear(); flip(g, renderAll); }
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
  const d = e.target.closest('[data-drop]');
  if (d && A.sel.size && !e.target.closest('.tile')) { flip($('#rack .grooves'), () => moveSelected(d.dataset.drop)); return; }
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
  else if (act === 'torack') moveSelected('rack');
  else if (act === 'sortnum') sortRack('num');
  else if (act === 'sortcol') sortRack('col');
  else if (act === 'skip') send({ t: 'skip' });
  else if (act === 'copy') copyLink();
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
  if (A.S) renderRack();
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
function showSettings(open) {
  $('#settings').hidden = !open;
  $('#setBtn').setAttribute('aria-expanded', open);
  $('#setBtn').classList.toggle('on', open);
}
$('#setBtn').addEventListener('click', e => { e.stopPropagation(); showSettings($('#settings').hidden); });
$('#setClose').addEventListener('click', () => showSettings(false));
document.addEventListener('pointerdown', e => { if (!$('#settings').hidden && !(e.target.closest && e.target.closest('#settings, #setBtn'))) showSettings(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') showSettings(false); });
let rz = 0;
window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { renderSeats(); renderRack(); }, 150); });

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
