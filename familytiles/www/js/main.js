// Family Tiles: what each player sees and touches.
import { Net } from './net.js';
import { Video } from './video.js';
import { tile, analyze, rackPoints, openingPoints, checkTurn, SYMBOLS, COLOR_NAMES, OPEN_POINTS } from './rules.js';

const $ = s => document.querySelector(s);
const qs = new URLSearchParams(location.search);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem('ft-' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('ft-' + k, JSON.stringify(v)); } catch (e) { /* private window */ } },
};
const pid = (() => {
  const make = () => Math.random().toString(36).slice(2, 10);
  try { let p = sessionStorage.getItem('ft-pid'); if (!p) { p = make(); sessionStorage.setItem('ft-pid', p); } return p; }
  catch (e) { return make(); }
})();
const cleanCode = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);

const A = {
  S: null, net: null, video: null, name: '', code: '',
  W: null,            // my turn in progress: { turnNo, table: [{k, ids}], rack: [ids], startTable, startRack }
  hist: [], sel: new Set(), order: [], seen: new Set(), fresh: new Set(),
  nope: null, camOn: false, micOn: true, zoom: store.get('zoom', 1), shapes: store.get('shapes', true),
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
  if (qs.has('auto') && $('#name').value) $('#joinForm').requestSubmit();
}

function start(name, code) {
  A.name = name; A.code = code;
  const u = new URL(location.href); u.searchParams.set('room', code); u.searchParams.delete('auto');
  history.replaceState(null, '', u);
  $('#join').hidden = true; $('#game').hidden = false;
  $('#tableName').textContent = code;
  applyZoom();
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
  A.net.send({ t: 'hello', pid, name: A.name, snap: snap && snap.round ? snap : null, peer: A.net.peer && A.net.peer.id, cam: A.camOn, mic: A.camOn && A.micOn && A.video.hasMic() });
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
  };
  A.hist = []; A.sel.clear(); A.nope = null;
}

function orderLike(ids) {
  const set = new Set(ids);
  const keep = A.order.filter(id => set.has(id));
  return keep.concat(ids.filter(id => !keep.includes(id)));
}

function snapshotW() { return JSON.stringify({ table: A.W.table, rack: A.W.rack }); }
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
    A.order = place(A.order.filter(id => !A.sel.has(id)), ids.filter(id => A.order.includes(id)), target);
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
  } else W.rack = place(rackRest, moving, target);
  A.sel.clear();
  commit();
}

// Put tiles into a rack order, at the end or just before a given tile.
function place(rest, moving, target) {
  if (target.startsWith('rackat:')) {
    const at = rest.indexOf(+target.slice(7));
    if (at >= 0) return [...rest.slice(0, at), ...moving, ...rest.slice(at)];
  }
  return [...rest, ...moving];
}

function undo() {
  if (!A.W || !A.hist.length) return;
  const h = JSON.parse(A.hist.pop());
  A.W.table = h.table; A.W.rack = h.rack; A.sel.clear(); commit();
}
function resetTurn() {
  if (!A.W) return;
  if (A.W.table.length || A.hist.length) A.hist.push(snapshotW());
  A.W.table = A.W.startTable.map(ids => ({ k: setKey++, ids: ids.slice() }));
  A.W.rack = orderLike(A.W.startRack);
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
function sortRack(by) {
  const cmp = by === 'num'
    ? (a, b) => { const x = tile(a), y = tile(b); return x.j - y.j || x.n - y.n || x.c - y.c || a - b; }
    : (a, b) => { const x = tile(a), y = tile(b); return x.c - y.c || x.n - y.n || a - b; };
  if (A.W) { A.W.rack.sort(cmp); A.order = A.W.rack.slice(); renderRack(); }
  else { A.order.sort(cmp); renderRack(); }
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
  el.textContent = labels[A.status] || A.status;
  el.className = 'pill ' + (A.status === 'host' || A.status === 'client' ? 'good' : 'warn');
  $('#camBtn').textContent = A.camOn ? '📷 Camera off' : '📷 Camera on';
  $('#camBtn').classList.toggle('on', A.camOn);
  $('#micBtn').hidden = !A.camOn || !A.video || !A.video.hasMic();
  $('#micBtn').textContent = A.micOn ? '🎤 Mute' : '🔇 Unmute';
  $('#micBtn').classList.toggle('muted', !A.micOn);
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
    el.innerHTML = `<div class="face"><div class="avatar"></div></div>
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
    el.classList.toggle('off', !p.on);
    el.classList.toggle('me', !!isMe);
    el.querySelector('.engr').textContent = p.name;
    const c = el.querySelector('.count');
    c.textContent = p.seat && S.phase !== 'lobby' ? String(count) : '';
    c.title = 'tiles left';
    let tag = '';
    if (!p.on) tag = '⚠ Lost connection';
    else if (playing && S.turn === p.pid) tag = isMe ? '▶ Your turn' : '▶ Playing now';
    else if (playing && !p.seat) tag = 'Watching';
    else if (S.phase !== 'lobby' || p.total) tag = `Score ${p.total > 0 ? '+' : ''}${p.total}`;
    if (!p.on && playing && S.turn === p.pid && !isMe) tag += ' <button class="skip" data-act="skip">Skip turn</button>';
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
    const half = Math.ceil(els.length / 2);
    syncChildren(left, els.slice(0, half));
    syncChildren(right, els.slice(half));
    syncChildren($('#mySeat'), mine);
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
    if (myTurn()) html = `<div class="big you">Your turn!</div>`;
    else if (cur) html = `<div class="big">${esc(cur.name)} is playing…</div>`;
    const last = S.log[S.log.length - 1];
    if (last) html += `<div class="last">${esc(last)}</div>`;
    html += `<div class="pool">Tiles left to draw: <b>${S.pool.length}</b></div>`;
  }
  b.innerHTML = html;
  b.className = myTurn() ? 'mine' : '';
}

function renderLobby(box) {
  const S = A.S;
  const here = S.players.filter(p => p.on);
  const sets = here.length > 4 ? 2 : 1;
  const link = location.origin + location.pathname + '?room=' + A.code;
  box.innerHTML = `<div class="panel lobby">
    <h2>Table “${esc(A.code)}”</h2>
    <p>Send this link to your family so they join the same table:</p>
    <div class="linkrow"><input readonly value="${esc(link)}" aria-label="Table link"><button class="btn" data-act="copy">Copy link</button>${navigator.share ? '<button class="btn" data-act="share">Share</button>' : ''}</div>
    <h3>At the table (${here.length} of 8)</h3>
    <ol class="who">${here.map((p, i) => `<li>${esc(p.name)}${p.pid === pid ? ' (you)' : ''}${i >= 8 ? ' — watching, table is full' : ''}</li>`).join('')}</ol>
    <p class="hint">${here.length < 2 ? 'Waiting for at least one more player…' : `${Math.min(here.length, 8)} players: ${sets === 2 ? 'two sets of tiles (5 or more players)' : 'one set of tiles'}.`}</p>
    <button class="btn go huge" data-act="start" ${here.length < 2 ? 'disabled' : ''}>Start the game</button>
    <p class="hint">Tip: press <b>📷 Camera on</b> at the top so everyone can see your face.</p>
  </div>`;
}

function renderOver(box) {
  const S = A.S;
  const rows = (S.result || []).slice().sort((a, b) => b.delta - a.delta);
  const win = rows.find(r => r.win);
  box.innerHTML = `<div class="panel over">
    <h2>🏆 ${esc(win ? win.name : '')} wins!</h2>
    <table class="scores"><tr><th>Player</th><th>Left on rack</th><th>This game</th><th>Total</th></tr>
    ${rows.map(r => { const p = S.players.find(q => q.pid === r.pid); return `<tr class="${r.win ? 'win' : ''}"><td>${esc(r.name)}</td><td>${r.left}</td><td>${r.delta > 0 ? '+' : ''}${r.delta}</td><td>${p ? p.total : ''}</td></tr>`; }).join('')}
    </table>
    <button class="btn go huge" data-act="newgame">Play again</button>
  </div>`;
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
  if (A.nope) html += `<div class="nope" role="alert">✋ ${esc(A.nope)}</div>`;
  if (live && !me().opened) {
    const pts = openingPoints(A.W.startTable, A.W.startRack, A.W.table.map(s => s.ids));
    html += `<div class="meter ${pts >= OPEN_POINTS ? 'ok' : ''}">First play: <b>${pts}</b> of ${OPEN_POINTS} points ${pts >= OPEN_POINTS ? '✓' : ''}</div>`;
  }
  if (live && !selecting && !A.W.table.length) html += `<div class="help">Tap tiles on your rack to pick them up, then tap <b>＋ New set</b>. Or drag them onto the table.</div>`;
  html += `<div class="sets ${live ? 'live' : ''} ${selecting ? 'selecting' : ''}">`;
  for (const s of sets) {
    const a = analyze(s.ids);
    const order = a.ok ? a.order : s.ids;
    const bad = showMarks && !a.ok;
    html += `<div class="set ${bad ? 'bad' : ''}" ${live ? `data-drop="set:${s.k}"` : ''}>
      <div class="tiles">${order.map(id => tileHTML(id, before.has(id) ? '' : 'placed')).join('')}</div>
      ${live ? `<button class="slot" data-drop="set:${s.k}" aria-label="Add picked tiles to this set">＋</button>` : ''}
      ${bad ? `<div class="why">✗ ${esc(a.why)}</div>` : ''}
    </div>`;
  }
  if (live) html += `<button class="set newset" data-drop="new">＋ New set</button>`;
  if (!sets.length && !live) html += `<div class="empty">The table is empty. Sets will appear here.</div>`;
  html += '</div>';
  box.innerHTML = html;
}

function renderMe() {
  const S = A.S, m = me();
  const c = $('#controls');
  if (!S || !m) { c.innerHTML = ''; renderRack(); return; }
  let html = '';
  if (myTurn()) {
    const placed = A.W && A.W.rack.length < A.W.startRack.length;
    html += `<button class="btn go" data-act="done">✓ Done</button>`;
    html += `<button class="btn draw" data-act="draw">${S.pool.length ? '⬇ Draw a tile' : 'Pass'}</button>`;
    html += `<button class="btn" data-act="undo" ${A.hist.length ? '' : 'disabled'}>↶ Undo</button>`;
    html += `<button class="btn" data-act="reset" ${placed || (A.W && A.hist.length) ? '' : 'disabled'}>⟲ Reset</button>`;
    html += `<button class="btn" data-act="torack" ${A.sel.size ? '' : 'disabled'}>Back to rack</button>`;
  }
  c.innerHTML = html;
  $('#sorts').hidden = !(m.seat && S.phase === 'play');
  renderRack();
}

function renderRack() {
  const S = A.S, m = me();
  const rack = $('#rack');
  $('#rackName').textContent = A.name;
  if (!S || !m || !m.seat || S.phase === 'lobby') {
    rack.querySelector('.grooves').innerHTML = `<div class="rackmsg">${S && S.phase === 'play' ? 'You are watching this game. You will get a seat in the next one.' : 'Your tiles will appear here.'}</div>`;
    return;
  }
  const ids = A.W ? A.W.rack : A.order;
  const pts = rackPoints(ids);
  rack.querySelector('.grooves').innerHTML = ids.map(id => tileHTML(id)).join('');
  $('#rackInfo').innerHTML = `${ids.length} tiles<span class="pts"> · ${pts} points</span>`;
  rack.classList.toggle('live', true);
}

/* ---------------- tapping and dragging ---------------- */

let press = null, ghost = null, hover = null;

function canPick(id) {
  if (A.W) return true;
  return A.S && me() && A.order.includes(id);
}

document.addEventListener('pointerdown', e => {
  const t = e.target.closest('.tile[data-id]');
  if (!t || e.button > 0) return;
  const id = +t.dataset.id;
  if (!canPick(id)) return;
  press = { id, x: e.clientX, y: e.clientY, drag: false };
});

document.addEventListener('pointermove', e => {
  if (!press) return;
  if (!press.drag) {
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < 10) return;
    press.drag = true;
    if (!A.sel.has(press.id)) { A.sel.clear(); A.sel.add(press.id); }
    ghost = document.createElement('div');
    ghost.className = 'ghost';
    ghost.innerHTML = [...A.sel].slice(0, 6).map(id => tileHTML(id)).join('');
    document.body.appendChild(ghost);
    document.body.classList.add('dragging');
    renderCenter(); renderRack(); renderMe();
  }
  e.preventDefault();
  ghost.style.transform = `translate(${e.clientX - 30}px, ${e.clientY - 40}px)`;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const d = dropAt(el);
  if (hover !== d) { if (hover) hover.classList.remove('hover'); hover = d; if (d) d.classList.add('hover'); }
}, { passive: false });

function dropAt(el) {
  if (!el) return null;
  const t = el.closest('#rack .tile[data-id]');
  if (t) return t;
  return el.closest('[data-drop]') || (el.closest('#rack') ? $('#rack .grooves') : null);
}

document.addEventListener('pointerup', e => {
  if (!press) return;
  const p = press; press = null;
  if (!p.drag) { toggle(p.id); return; }
  ghost && ghost.remove(); ghost = null;
  document.body.classList.remove('dragging');
  if (hover) hover.classList.remove('hover');
  const d = hover; hover = null;
  if (d && d.matches('.tile[data-id]')) moveSelected('rackat:' + d.dataset.id);
  else if (d) moveSelected(d.dataset.drop);
  else { A.sel.clear(); renderAll(); }
});
document.addEventListener('pointercancel', () => {
  press = null; ghost && ghost.remove(); ghost = null; document.body.classList.remove('dragging');
});

function toggle(id) {
  if (A.sel.has(id)) A.sel.delete(id); else A.sel.add(id);
  renderCenter(); renderMe();
}

document.addEventListener('click', e => {
  const d = e.target.closest('[data-drop]');
  if (d && A.sel.size && !e.target.closest('.tile')) { moveSelected(d.dataset.drop); return; }
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
  store.set('zoom', A.zoom);
}

$('#camBtn').addEventListener('click', toggleCam);
$('#micBtn').addEventListener('click', toggleMic);
$('#bigger').addEventListener('click', () => { A.zoom += 0.1; applyZoom(); });
$('#smaller').addEventListener('click', () => { A.zoom -= 0.1; applyZoom(); });
$('#shapesBtn').addEventListener('click', () => { A.shapes = !A.shapes; store.set('shapes', A.shapes); renderCenter(); renderRack(); });
let rz = 0;
window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(renderSeats, 150); });

let toastT = 0;
function toast(text, ms = 4000) {
  const t = $('#toast');
  t.textContent = text; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms);
}

let ac = null;
function beep(f, dur, f2) {
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
