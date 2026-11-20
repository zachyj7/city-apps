// Game Night: what each player sees and touches. Everyone meets in the lobby, the host picks a game
// (Number Tiles, Blackjack or Color Clash), and the faces stay around the table whatever is being played.
import { Net } from './net.js';
import { Video } from './video.js';
import { initHelp } from './help.js';
import { initStats } from './stats.js';
import { tile, analyze, openingPoints, checkTurn, groupsOf, tidyPos, autoSplit, COLOR_NAMES, OPEN_POINTS, BOARD_W, BIG_TILE } from './rules.js';
import { GAMES, GAME_IDS, COLORS, cfgFor, winsOf, BOARD_GAMES, PROFILES, GUEST, STAT_PROFILES, isHex } from './games.js';
import { allRecs, mergeRecs, lifeWins, lifeTable } from './lifetime.js';
import { watchLobbies, lobbyNotice } from './lobbies.js';
import { renderChess, renderCheckers, renderMancala, boardControls, boardTap, chessGlyph } from './boardview.js';
import { renderIdiot, idiotHand, idiotControls, renderHearts, heartsHand, heartsControls, renderDominoes, dominoHand, dominoControls, tableTap, TABLE_ACTS, HAND_GAMES, domino, setTrayHooks } from './cardtable.js';
import { renderBJ, bjControls, renderUno, unoHand, unoControls, pcard, ccard, money, isWild } from './cardview.js';

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
// A custom color ('#rrggbb') gets its own shades worked out the same way.
const mixHex = (hex, t) => { const n = parseInt(hex.slice(1), 16); const f = c => Math.round(t > 0 ? c + (255 - c) * t : c * (1 + t)); return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(c => f(c).toString(16).padStart(2, '0')).join(''); };
const customRacks = new Map();
function rackOf(rc) {
  if (RACKS[rc]) return RACKS[rc];
  if (!isHex(rc)) return RACKS.yellow;
  if (!customRacks.has(rc)) {
    const n = parseInt(rc.slice(1), 16), lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    customRacks.set(rc, { label: 'Custom', hi: mixHex(rc, 0.38), base: rc, lo: mixHex(rc, -0.16), deep: mixHex(rc, -0.5), ink: mixHex(rc, -0.45), text: lum > 0.55 ? '#1a1a1a' : '#f7f7f7' });
  }
  return customRacks.get(rc);
}
const rackStyle = rc => { const r = rackOf(rc); return `--rk-hi:${r.hi};--rk:${r.base};--rk-lo:${r.lo};--rk-deep:${r.deep};--rk-ink:${r.ink};--rk-text:${r.text}`; };
// taken: color -> the name of whoever has it (those can't be picked)
const swatches = (cur, act, taken = {}) => COLORS.map(k => {
  const r = RACKS[k], who = taken[k];
  return `<button type="button" class="swatch ${k === cur ? 'on' : ''} ${who ? 'taken' : ''}" data-${act}="${k}" style="${rackStyle(k)}" aria-pressed="${k === cur}" ${who ? `disabled title="${esc(who)} has this color"` : ''} aria-label="${r.label}${who ? ` (${esc(who)})` : ''}"><span class="sw-top">${who ? esc(who.slice(0, 1).toUpperCase()) : ''}</span><span class="sw-edge"></span></button>`;
}).join('')
  // the last one opens a color picker for any color at all
  + `<label class="swatch custom ${isHex(cur) ? 'on' : ''}" style="${rackStyle(isHex(cur) ? cur : '#8a8f98')}" title="Pick any color"><input type="color" data-custom="${act}" value="${isHex(cur) ? cur : '#3fc1c9'}" aria-label="Pick your own color"><span class="sw-top">${isHex(cur) ? '' : '+'}</span><span class="sw-edge">Custom</span></label>`;

const $ = s => document.querySelector(s);
const qs = new URLSearchParams(location.search);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Saved settings start with "jg-". Ones saved under the old name (Family Tiles, "ft-") are carried over once.
for (const st of [(() => { try { return localStorage; } catch (e) { return null; } })(), (() => { try { return sessionStorage; } catch (e) { return null; } })()]) {
  try {
    if (!st || st.getItem('jg-moved')) continue;
    for (let i = 0; i < st.length; i++) { const k = st.key(i); if (k && k.startsWith('ft-') && st.getItem('jg-' + k.slice(3)) == null) st.setItem('jg-' + k.slice(3), st.getItem(k)); }
    st.setItem('jg-moved', '1');
  } catch (e) { /* private window */ }
}
const store = {
  get(k, d) { try { const v = localStorage.getItem('jg-' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('jg-' + k, JSON.stringify(v)); } catch (e) { /* private window */ } },
};
function saveRc() { store.set('rc', A.rc); try { sessionStorage.setItem('jg-rc', A.rc); } catch (e) { /* ignore */ } }
const pid = (() => {
  const make = () => Math.random().toString(36).slice(2, 10);
  try { let p = sessionStorage.getItem('jg-pid'); if (!p) { p = make(); sessionStorage.setItem('jg-pid', p); } return p; }
  catch (e) { return make(); }
})();
const ic = n => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const LEVEL_NAMES = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
const cleanCode = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);

const A = {
  fit: (() => { try { return localStorage.getItem('jg-fit') === '1'; } catch (e) { return false; } })(),   // Fit: on until switched off
  S: null, net: null, video: null, name: '', code: '',
  W: null,            // my turn in progress: { turnNo, pos: {id: [x, y]}, rack: [ids], startTable, startPos, startRack }
  hist: [], sel: new Set(), order: [], seen: new Set(), fresh: new Map(), loose: new Set(), bu: null,
  vol: store.get('vol', {}), sound: store.get('sound', true), sortUndo: null, grid: null, cols: 7, rc: (() => { try { return sessionStorage.getItem('jg-rc'); } catch (e) { return null; } })() || store.get('rc', 'yellow'), lastFx: null, lastAlert: null, lastDrew: null, lastShame: null, drag: null, camOn: false, micOn: true, zoom: store.get('zoom', 1), shapes: store.get('shapes', true),
  status: 'connecting',
};
window.JG = A;   // for testing from the console
let setKey = 1;

/* ---------------- joining ---------------- */

function setupJoin() {
  // Who you are (lifetime stats are saved under this) and, if you like, a different name to play as today.
  const sel = $('#prof');
  sel.innerHTML = `<option value="">Choose your name…</option>` + PROFILES.map(n => `<option>${esc(n)}</option>`).join('')
    + `<option value="${GUEST}">Someone else (type your name)</option>`;
  // "Someone else": the name box is their name (and needed); their stats are kept under Guest
  const nameMode = () => {
    const guest = sel.value === GUEST;
    $('#nameLabel').innerHTML = guest ? 'Your name' : 'Play as a different name <span class="opt">(optional)</span>';
    $('#name').placeholder = guest ? 'Type your name' : 'Leave blank to use your own name';
    $('#nameHint').textContent = guest ? 'Your games count as Guest in the lifetime stats.' : 'Your stats are always saved under your own name.';
    if (guest && document.activeElement === sel) $('#name').focus();
  };
  sel.addEventListener('change', nameMode);
  let tabProf = null, tabNick = null;
  try { tabProf = sessionStorage.getItem('jg-prof'); tabNick = sessionStorage.getItem('jg-nick'); } catch (e) { /* ignore */ }
  const prof = qs.get('prof') || tabProf || store.get('prof', '');
  if (STAT_PROFILES.includes(prof)) sel.value = prof;
  nameMode();
  $('#name').value = tabNick || '';
  $('#code').value = cleanCode(qs.get('room')) || store.get('code', '') || 'family';
  $('#joinForm').addEventListener('submit', e => {
    e.preventDefault();
    const prof = sel.value;
    const nick = $('#name').value.trim().slice(0, 18);
    const code = cleanCode($('#code').value);
    if (!STAT_PROFILES.includes(prof)) { sel.focus(); $('#joinErr').textContent = 'Please choose your name.'; return; }
    if (prof === GUEST && !nick) { $('#name').focus(); $('#joinErr').textContent = 'Please type your name.'; return; }
    if (!code) { $('#code').focus(); $('#joinErr').textContent = 'Please type a lobby name, like family.'; return; }
    store.set('prof', prof); store.set('code', code);
    try { sessionStorage.setItem('jg-prof', prof); sessionStorage.setItem('jg-nick', nick); } catch (e) { /* ignore */ }
    A.prof = prof;
    start(nick || prof, code);
  });
  // one of each: a tile, a playing card and a Color Clash card
  $('#joinLogo').innerHTML = `${pcard(0)}<span class="tile c1"><span class="num">7</span></span>${ccard(100)}`;
  const pick = $('#rcPick');
  const paint = () => { pick.innerHTML = swatches(A.rc, 'rc'); };
  paint();
  pick.addEventListener('click', e => { const b = e.target.closest('[data-rc]'); if (b) { A.rc = b.dataset.rc; saveRc(); paint(); } });
  pick.addEventListener('change', e => { if (e.target.matches('[data-custom]') && isHex(e.target.value.toLowerCase())) { A.rc = e.target.value.toLowerCase(); saveRc(); paint(); } });
  showLobbies();
  if (qs.has('auto') && STAT_PROFILES.includes(sel.value) && (sel.value !== GUEST || $('#name').value.trim())) $('#joinForm').requestSubmit();
}

// The open lobbies, listed on the start screen. Tapping one fills in its name (and joins, once you have
// chosen your name).
let stopWatch = null;
function showLobbies() {
  if (stopWatch) return;
  const box = $('#openLobbies');
  stopWatch = watchLobbies(list => {
    box.hidden = !list.length;
    box.innerHTML = list.length ? `<span class="olabel">Open lobbies</span>` + list.map(x => {
      const g = x.game && GAMES[x.game];
      const what = x.phase === 'play' ? (g ? `Playing ${g.name}` : 'Playing') : g ? `Getting ready for ${g.name}` : 'In the lobby';
      return `<button type="button" class="olobby" data-act="joinlobby" data-code="${esc(x.code)}"><b>${esc(x.code)}</b><span>${esc(what)} · ${x.n} ${x.n === 1 ? 'person' : 'people'}</span>${ic('arrow')}</button>`;
    }).join('') : '';
  });
}
function hideLobbies() { if (stopWatch) { stopWatch(); stopWatch = null; } }

function start(name, code) {
  A.name = name; A.code = code;
  hideLobbies();
  A.rcAsked = A.rc;   // if someone already has this color, the lobby gives me another and says so
  const u = new URL(location.href); u.searchParams.set('room', code); u.searchParams.delete('auto');
  history.replaceState(null, '', u);
  $('#join').hidden = true; $('#game').hidden = false;
  $('#tableName').textContent = code;
  applyZoom();
  A.grid = loadGrid();
  if (!A.video) { A.video = new Video(() => renderSeats()); A.video.init(); }
  A.net = new Net(code, {
    onStatus: s => { A.status = s; renderStatus(); },
    onOpen: () => { laySent = ''; hello(); send({ t: 'ledger', recs: allRecs() }); },
    onMsg: m => {
      if (m.t === 'state') setState(m.s);
      else if (m.t === 'nope') { toast(m.why); beep(220, 0.25); }
      else if (m.t === 'relay') help.rx(m.from, m.m);
      else if (m.t === 'hand') onHand(m);
      else if (m.t === 'rps') onRps(m);
      else if (m.t === 'whisper') onWhisper(m);
      else if (m.t === 'ledger') { if (mergeRecs(m.recs)) { renderSeats(); if (A.S && A.S.phase === 'over') renderCenter(); if (!$('#lifeBox').hidden) renderLife(); } }
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
const snapKey = () => 'jg-snap-' + A.code;
function saveSnap(S) { try { sessionStorage.setItem(snapKey(), JSON.stringify(S)); } catch (e) { /* full or private */ } }
function loadSnap() { try { return JSON.parse(sessionStorage.getItem(snapKey())); } catch (e) { return null; } }
function snapshot() { return A.S || loadSnap(); }

function hello() {
  const snap = snapshot();
  A.net.send({ t: 'hello', pid, name: A.name, prof: A.prof, rc: A.rc, snap: snap && snap.round ? snap : null, peer: A.net.peer && A.net.peer.id, cam: A.camOn, mic: (micSent = micOut()) });
}
function send(m) { A.net && A.net.send(m); }

/* ---------------- state ---------------- */

const me = () => A.S && A.S.players.find(p => p.pid === pid);
// Number Tiles is being played (the tile code below only runs then); myTurn is my turn in Number Tiles.
const tiles = () => !!(A.S && A.S.game === 'tiles');
const myTurn = () => !!(A.S && A.S.game === 'tiles' && A.S.phase === 'play' && A.S.turn === pid);
const seated = () => A.S ? A.S.players.filter(p => p.seat) : [];
const isHost = () => !!(A.S && A.S.host === pid);

function setState(S) {
  const was = A.S;
  A.S = S;
  saveSnap(S);
  const m = me();
  // The referee gives everyone their own color: if the one I asked for was taken, I get another.
  if (m && m.rc && m.rc !== A.rc) {
    if (A.rcAsked === A.rc) toast(`${rackOf(A.rc).label} was taken, so you are ${rackOf(m.rc).label}.`);
    A.rc = m.rc; saveRc();
  }
  if (m) A.rcAsked = null;
  if (S.phase !== 'play' || S.game !== 'uno') A.wildPick = null;
  A.dsent = null;   // the referee has answered: the hand now shows what is really left
  if (!was || was.turnNo !== S.turnNo || S.phase !== 'play') { A.bsel = null; A.promo = null; A.resignArm = 0; A.isel = new Set(); A.pending = null; if (!(S.dm && S.phase === 'play')) A.dsel = null; }
  if (!was || S.phase !== 'play' || (S.hr && was.hr && S.hr.handNo !== was.hr.handNo) || (S.hr && S.hr.passed && S.hr.passed[pid])) A.hsel = new Set();
  if (S.phase !== 'play' || !S.id || S.id.stage !== 'swap') A.iswap = null;
  rpsState();
  updateNotice();
  applyMic();
  renderRoom();
  // the host can list or unlist the lobby from Settings at any time, games included
  $('#listedRow').hidden = !isHost();
  $('#listedOn').checked = !S.unlisted;
  // Blackjack: each new round of bets starts from my last bet; the first chip tapped starts a new amount.
  if (S.bj && S.bj.stage === 'bet' && !(was && was.bj && was.bj.stage === 'bet' && was.round === S.round)) { A.bjBet = null; A.betFresh = true; }
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
  const dk = S.drew ? S.drew.k : 0;
  if (A.lastDrew != null && S.drew && dk !== A.lastDrew) showDrew(S.drew);
  A.lastDrew = dk;
  // The card games' notices: a free buy-back, a skip, someone taking a +4 stack, someone's last card.
  const nk = S.ann ? S.ann.k : 0;
  if (A.lastAnn != null && S.ann && nk !== A.lastAnn) showAnn(S.ann);
  A.lastAnn = nk;
  const pk = S.played ? S.played.k : 0;
  if (A.lastPlayed != null && S.played && pk !== A.lastPlayed) {
    A.shown = { pid: S.played.pid, ids: new Set(S.played.ids), until: Date.now() + BY_MS };
    clearTimeout(A.shownT); A.shownT = setTimeout(() => { A.shown = null; if (A.S) renderAll(); }, BY_MS + 50);
  }
  A.lastPlayed = pk;
  if (A.hand && (A.hand.ending || A.hand.turnNo !== S.turnNo)) A.hand = null;
  A.video.sync(S.players.filter(p => p.on && p.peer && p.pid !== pid).map(p => p.peer));
  flip(null, renderAll);
  help.state();
  // Statistics and coach are for Number Tiles only.
  $('#statsBtn').hidden = !!(S.game && S.game !== 'tiles');
  if (S.game === 'tiles' || !S.game) stats.state(); else stats.leave();
  const eb = $('#endBtn');
  if (eb) eb.hidden = !(isHost() && S.phase === 'play');
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
  // A tile taken out of a group of one number (like four 7s) leaves no hole: the tiles left slide together,
  // starting where the group started. (Runs are left alone: taking from the middle of a run splits it.)
  for (const g of groupsOf(W.pos)) {
    const rest = g.filter(id => !mv.has(id));
    if (rest.length === g.length || !rest.length) continue;
    const a = analyze(g);
    if (!a.ok || a.kind !== 'group') continue;
    const [x0, y0] = W.pos[g[0]];
    rest.forEach((id, i) => { W.pos[id] = [r2(x0 + i), y0]; });
  }
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
  send({ t: 'done', pos: A.W.pos, rack: A.W.rack });
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

function tileHTML(id, extra = '', style = '', inner = '') {
  const t = tile(id);
  // The glow carries on from where it was when the screen is redrawn, instead of starting over.
  let fresh = '';
  if (A.fresh.has(id)) {
    const age = Date.now() - A.fresh.get(id);
    if (age < FRESH_MS) { fresh = 'fresh'; style += `;animation-delay:-${age}ms`; } else A.fresh.delete(id);
  }
  const cls = ['tile', t.j ? 'joker' : 'c' + t.c, id === BIG_TILE ? 'big' : '', A.sel.has(id) ? 'sel' : '', fresh, extra].join(' ');
  const label = t.j ? 'Joker' : `${COLOR_NAMES[t.c]} ${t.n}`;
  const face = t.j ? `<span class="${jokerFace(id)}" aria-hidden="true"></span><span class="sym">JOKER</span>`
    : `<span class="num">${numHTML(t.n)}</span>${A.shapes ? SHAPES[t.c] : ''}`;
  return `<div class="${cls}" data-id="${id}" role="button" aria-label="${label}"${style ? ` style="${style}"` : ''}>${face}${inner}</div>`;
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
  // on: just the camera icon (the words got cut off); a tap turns it off
  cam.innerHTML = A.camOn ? ic('cam') : `${ic('camoff')}<span>Camera</span>`;
  cam.setAttribute('aria-label', A.camOn ? 'Turn camera off' : 'Turn camera on');
  cam.title = A.camOn ? 'Turn camera off' : 'Turn camera on';
  cam.classList.toggle('on', A.camOn);
  cam.setAttribute('aria-pressed', A.camOn);
  const mic = $('#micBtn');
  mic.hidden = !A.camOn || !A.video || !A.video.hasMic();
  const R = A.S && myRoom();
  if (R && !R.isSnd) {
    // in a room, on a device that isn't the room's sound: the microphone stays off
    mic.innerHTML = `${ic('micoff')}<span>Room</span>`;
    mic.title = `Same room: the sound goes through ${R.snd ? R.snd.name + "'s device" : 'another device'}`;
    mic.classList.add('muted');
  } else {
    mic.innerHTML = A.micOn ? `${ic('mic')}<span>Mute</span>` : `${ic('micoff')}<span>Unmute</span>`;
    mic.title = A.micOn ? 'Mute' : 'Unmute';
    mic.classList.toggle('muted', !A.micOn);
  }
}

/* Same room: people sitting together hear each other in person, so their devices never play each other, and only
   one device in the room (the "room sound") plays everyone else and sends its microphone. Two microphones and two
   speakers in one room would otherwise echo and double every voice for the people far away. */
function myRoom() {
  const m = me();
  if (!m || !m.room) return null;
  const mates = A.S.players.filter(q => q.room === m.room);
  const snd = mates.find(q => q.snd) || null;
  return { id: m.room, mates, snd, isSnd: !!snd && snd.pid === pid };
}
// Do I play this person's voice?
function heard(p) { const R = myRoom(); return !R || (R.isSnd && p.room !== R.id); }
const micLive = () => A.micOn && !(myRoom() && !myRoom().isSnd);
const micOut = () => !!(A.camOn && micLive() && A.video && A.video.hasMic());
let micSent = null;
// Switch my microphone on or off to match the room, and tell everyone if that changed.
function applyMic(force) {
  if (!A.video) return;
  const R = myRoom();
  A.video.setBoost(R && R.isSnd ? A.roomBoost : 1);   // one mic for the whole room: pick up more
  A.video.setMic(micLive());
  const out = micOut();
  if (force || out !== micSent) { micSent = out; send({ t: 'cam', cam: A.camOn, mic: out }); renderStatus(); }
}

// The Same room section in Settings: tick whoever is sitting with you.
let roomKey = '';
function renderRoom() {
  const box = $('#roomBox');
  if (!box || !A.S) return;
  const m = me();
  const R = myRoom();
  const people = A.S.players.filter(p => p.on && !p.cpu && p.pid !== pid);
  const key = JSON.stringify([people.map(p => [p.pid, p.name, p.room, p.snd]), m && m.room, m && m.snd]);
  if (key === roomKey) return;
  roomKey = key;
  const sndName = R && R.snd ? (R.isSnd ? 'this device' : `${esc(R.snd.name)}'s device`) : '';
  box.innerHTML = `<span class="setlabel">${ic('users')}Same room</span>
    <p class="roomhint">Sitting next to someone? Turn them on here. Only one device in the room plays the others and uses its microphone, so there's no echo.</p>
    ${people.length ? people.map(p => `<label class="setrow roomrow"><span class="vname">${esc(p.name)}</span><input type="checkbox" class="switch" data-room="${esc(p.pid)}" ${R && p.room === R.id ? 'checked' : ''} aria-label="${esc(p.name)} is in the same room as me"></label>`).join('')
      : '<p class="fieldhint">No one else is here yet.</p>'}
    ${R ? `<p class="roomsnd">Room sound: <b>${sndName}</b></p>
      ${R.isSnd ? `<label class="volrow"><span class="vname">Mic pickup</span><input type="range" min="100" max="400" step="25" value="${Math.round(A.roomBoost * 100)}" data-roomboost aria-label="How much the microphone picks up for the room"><b>${Math.round(A.roomBoost * 100)}%</b></label>
      <p class="roomhint">This device's microphone is turned up for the whole room. Turn it down if the others hear an echo.</p>` : ''}
      <div class="roombtns">${R.isSnd ? '' : `<button type="button" class="btn" data-roomsnd>${ic('sound')}<span>Use this device for sound</span></button>`}
      <button type="button" class="btn" data-roomleave>${ic('logout')}<span>I'm not in this room</span></button></div>` : ''}`;
}
A.roomBoost = Math.min(4, Math.max(1, +store.get('roomboost', 2.5) || 2.5));
$('#roomBox').addEventListener('input', e => {
  const r = e.target.closest('[data-roomboost]');
  if (!r) return;
  A.roomBoost = r.value / 100;
  store.set('roomboost', A.roomBoost);
  r.nextElementSibling.textContent = r.value + '%';
  applyMic();
});
$('#roomBox').addEventListener('change', e => {
  const t = e.target.closest('[data-room]');
  if (t) send({ t: 'sameroom', pid: t.dataset.room, on: t.checked });
});
$('#roomBox').addEventListener('click', e => {
  if (e.target.closest('[data-roomsnd]')) send({ t: 'roomsnd' });
  else if (e.target.closest('[data-roomleave]')) send({ t: 'sameroom', pid, on: false });
});

/* Each person's voice has its own volume. Most browsers let a video's volume be set directly; iPhones and
   iPads don't, so there the sound goes through a volume control (Web Audio) and the video itself stays muted. */
const VOL_DIRECT = (() => { try { const v = document.createElement('video'); v.volume = 0.5; return Math.abs(v.volume - 0.5) < 0.01; } catch (e) { return false; } })();
const gains = new Map();
let vac = null;
function volumeOf(p) { const v = A.vol[p.pid]; return typeof v === 'number' ? v : 1; }
function applyVolume(p, v, stream) {
  const vol = heard(p) ? volumeOf(p) : 0;
  if (VOL_DIRECT) { v.muted = vol === 0; v.volume = vol; return; }
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
    el.innerHTML = `<div class="face"><div class="avatar"></div><div class="nm"></div><div class="flag">▶ TURN</div><div class="seatwins" hidden></div><div class="open30"></div><div class="stamp">Cheater</div></div>
      <div class="minirack"><div class="backs"></div><div class="mini-edge"><span class="engr"></span></div><b class="mcount" hidden></b></div>
      <div class="tag"></div>`;
    el.dataset.pid = p.pid;
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
    // every seat is framed in its player's color
    el.style.setProperty('--pc', rackOf(p.rc).base);
    const isTiles = S.game === 'tiles' || !S.game;
    el.classList.toggle('cards', !isTiles);
    // Their rack shows the backs of the tiles they still hold, laid out the way they have them.
    drawBacks(el, p.seat && playing && isTiles ? count : 0, isMe && A.grid ? layOf(A.grid) : p.lay);
    // Number Tiles: whether they have made their first play of 30 yet. The card games: their money, or how
    // many cards they hold.
    const ob = el.querySelector('.open30'), show = !!(p.seat && playing);
    let obHtml = '', obCls = 'open30', obTitle = '';
    if (show && isTiles) {
      obHtml = `${ic(p.opened ? 'check' : 'lock')}30`; obCls += ' show' + (p.opened ? ' yes' : '');
      obTitle = p.opened ? 'Has made their first 30' : 'Has not made their first 30 yet';
    } else if (show && S.game === 'bj') {
      obHtml = `${ic('chip')}${money(p.chips || 0)}`; obCls += ' show money'; obTitle = 'Money';
    } else if (show && S.game === 'chess' && S.chess) {
      const w = S.chess.w === p.pid;
      obHtml = chessGlyph(w ? 'K' : 'k'); obCls += ' show bgside'; obTitle = w ? 'Plays white' : 'Plays black';
    } else if (show && S.game === 'checkers' && S.ck) {
      const sd = S.ck.a === p.pid ? 'a' : 'b', n = S.ck.b.filter(x => x && x.toLowerCase() === sd).length;
      obHtml = `<span class="ck mini ${sd}"></span>${n}`; obCls += ' show bgside'; obTitle = `${n} pieces left`;
    } else if (show && S.game === 'mancala' && S.mc) {
      const n = S.mc.p[S.mc.pl[0] === p.pid ? 6 : 13];
      obHtml = `<span class="seed s1"></span>${n}`; obCls += ' show bgside'; obTitle = `${n} seeds in their store`;
    } else if (show && S.game === 'idiot' && S.id) {
      const out = S.id.out.indexOf(p.pid), n = (p.hand || []).length;
      obHtml = out >= 0 ? `${ic('trophy')}Out` : `${ic('cards')}${n}`; obCls += ' show' + (out >= 0 ? ' yes' : ''); obTitle = out >= 0 ? 'Out' : `${n} cards in hand`;
    } else if (show && S.game === 'hearts' && S.hr) {
      obHtml = `♥${S.hr.scores[p.pid] || 0}`; obCls += ' show money'; obTitle = 'Score (lowest wins)';
    } else if (show && S.game === 'dominoes' && S.dm) {
      const n = (p.hand || []).length;
      obHtml = String(n); obCls += ' show dmcount' + (n === 1 ? ' last' : ''); obTitle = `${n} ${n === 1 ? 'domino' : 'dominoes'} in hand · score ${S.dm.scores[p.pid] || 0} (lowest wins)`;
    } else if (show && S.game === 'uno') {
      const n = (p.hand || []).length;
      obHtml = `${ic('cards')}${n}`; obCls += ' show' + (n === 1 ? ' last' : ''); obTitle = `${n} card${n === 1 ? '' : 's'}`;
    }
    if (ob.innerHTML !== obHtml) ob.innerHTML = obHtml;
    ob.className = obCls;
    ob.title = obTitle;
    let tag = '';
    const wins = winsFor(p, S.game || 'tiles');
    if (!p.on) tag = '⚠ Lost connection';
    else if (playing && !p.seat) tag = 'Watching';
    if (el.querySelector('.tag').innerHTML !== tag) el.querySelector('.tag').innerHTML = tag;
    // wins: a small trophy in the top corner of the picture, not a row of its own
    const wb = el.querySelector('.seatwins'), wh = wins && p.on ? `${ic('trophy')}${wins}` : '';
    if (wb.innerHTML !== wh) { wb.innerHTML = wh; wb.hidden = !wh; }
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
    const roomed = !!(p.room && !p.snd);
    el.classList.toggle('roomed', roomed);
    el.classList.toggle('mic-off', !!p.cam && !p.mic && !roomed);
    return el;
  };

  const wide = window.innerWidth >= 1100;
  const left = $('#seatsL'), right = $('#seatsR');
  const els = others.map(p => fill(p, false));
  const m = me();
  const mine = m ? [fill(m, true)] : [];
  // You are always in the bottom left corner, and everyone else goes round clockwise from you in the order
  // of play: up the left side, then down the right side.
  const all = [...mine, ...els];
  if (wide) {
    const half = Math.ceil(all.length / 2);
    syncChildren(left, all.slice(0, half).reverse());
    syncChildren(right, all.slice(half));
    syncChildren($('#mySeat'), []);
  } else {
    // narrow screens have one strip of faces across the top: you first, then the order of play
    syncChildren($('#mySeat'), []);
    syncChildren(left, all);
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
  const gname = S.game ? ' · ' + GAMES[S.game].name : '';
  document.title = !cur ? 'Game Night' + gname : cur.pid === pid ? '▶ Your turn!' + gname : `${cur.name}'s turn${gname}`;
  $('#gameName').hidden = !S.game;
  $('#gameName b').textContent = S.game ? GAMES[S.game].name : '';
  box.parentElement.classList.toggle('cardgame', S.phase === 'play' && S.game !== 'tiles');
  if (S.phase === 'lobby') {
    if (lobbyDrag) { lobbyDrag.stale = true; return; }
    // don't redraw under an open color picker
    if (document.activeElement && document.activeElement.matches && document.activeElement.matches('#center [data-custom]')) { A.lobbyStale = true; return; }
    return renderLobby(box);
  }
  if (S.phase === 'over') return renderOver(box);
  if (S.game === 'bj') return renderBJ(box, viewCtx());
  if (S.game === 'uno') return renderUno(box, viewCtx());
  if (S.game === 'chess') return renderChess(box, viewCtx());
  if (S.game === 'checkers') return renderCheckers(box, viewCtx());
  if (S.game === 'mancala') return renderMancala(box, viewCtx());
  if (S.game === 'idiot') return renderIdiot(box, viewCtx());
  if (S.game === 'hearts') return renderHearts(box, viewCtx());
  if (S.game === 'dominoes') return renderDominoes(box, viewCtx());
  if (S.pick) return renderPick(box);
  renderBoard(box);
}

/* Drawing for who goes first: face-down tiles scattered over the table. Each person taps one and it turns
   over for everyone, with their name under it. Highest goes first (a joker beats a 13); a tie picks again. */
const FLIP_MS = 1100;
const pickedAt = new Map();   // when each tile was first seen turned over here, so its flip plays once
function renderPick(box) {
  const S = A.S, k = S.pick, round = k.r.length, cur = k.r[round - 1];
  const name = x => { const p = S.players.find(q => q.pid === x); return p ? p.name : '?'; };
  const canPick = k.stage === 'pick' && k.who.includes(pid) && cur[pid] == null;
  const mainEl = box.parentElement, cs = getComputedStyle(mainEl);
  const W = box.clientWidth, H = Math.max(240, mainEl.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 4);
  const u = measureBoard(box, 0);
  const n = k.ids.length, cols = Math.ceil(Math.sqrt(n * 2.2)), rows = Math.ceil(n / cols);
  const top = 64, cellW = W / cols, cellH = (H - top - 10) / rows;
  const tw = Math.max(26, Math.floor(Math.min(u.bw * 1.15, cellW * 0.62, (cellH - 34) / 1.34))), th = Math.round(tw * 1.34);
  const now = Date.now();
  for (const id of [...pickedAt.keys()]) if (!k.flips[id]) pickedAt.delete(id);
  let html = '';
  k.ids.forEach((id, i) => {
    const [x, y, rot] = k.at[i] || [0.5, 0.5, 0];
    const f = k.flips[id];
    const left = Math.round(Math.min(Math.max(x * W - tw / 2, 4), W - tw - 4));
    const tp = Math.round(top + Math.min(Math.max(y * (H - top - 10) - th / 2, 0), H - top - 10 - th - 26));
    let cls = 'pkw', label = '', style = `left:${left}px;top:${tp}px;--rot:${rot}deg`;
    if (f) {
      if (!pickedAt.has(id)) pickedAt.set(id, now);
      const age = now - pickedAt.get(id);
      cls += age < FLIP_MS ? ' anim' : ' up';
      if (age < FLIP_MS) style += `;--age:-${age}ms`;
      const p = S.players.find(q => q.pid === f.pid);
      const live = f.r === round;   // turned over this round (earlier rounds' tiles are dimmed)
      if (!live) cls += ' old';
      else if (k.stage === 'won' && k.win === f.pid) cls += ' win';
      else if (k.stage === 'tie' && k.tie.includes(f.pid)) cls += ' tie';
      else if (k.stage !== 'pick') cls += ' lose';
      label = `<span class="byname pkname" style="${p ? rackStyle(p.rc) : ''}">${esc(name(f.pid))}</span>`;
    } else if (canPick) cls += ' can';
    const front = tileHTML(id).replace(' data-id=', ' data-pk=').replace(' role="button"', '');
    html += `<div class="${cls}" style="${style}"><button class="pk" ${f ? 'disabled' : `data-flip="${id}"`} aria-label="${f ? 'Turned over by ' + esc(name(f.pid)) : 'Face-down tile'}" tabindex="${canPick && !f ? 0 : -1}"><div class="pk-in"><div class="pk-back"></div><div class="pk-front">${front}</div></div></button>${label}</div>`;
  });
  // what is happening, across the top of the table
  const waiting = k.who.filter(x => cur[x] == null);
  let msg;
  if (k.stage === 'won') msg = `<b>${esc(name(k.win))}</b> goes first!`;
  else if (k.stage === 'tie') msg = `A tie! <b>${k.tie.map(x => esc(name(x))).join(' and ')}</b> pick again`;
  else if (canPick) msg = round > 1 ? 'A tie! Pick another tile' : 'Pick a tile! Highest goes first';
  else msg = `Waiting for ${waiting.map(x => `<b>${esc(name(x))}</b>`).join(', ')}…`;
  box.innerHTML = `<div id="pickBoard" class="pickboard ${canPick ? 'mine' : ''}" style="--tw:${tw}px;--th:${th}px;width:${Math.floor(W)}px;height:${Math.floor(H)}px">
    <div class="pkmsg ${k.stage}">${msg}</div>${html}</div>`;
  // redraw once the newest flip has finished, so it settles face up
  const last = Math.max(0, ...[...pickedAt.values()].map(t => t + FLIP_MS - now));
  clearTimeout(renderPick.t);
  if (last > 0) renderPick.t = setTimeout(() => { if (A.S && A.S.pick) renderCenter(); }, last + 30);
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('#pickBoard .pkw.can [data-flip]');
  if (!b || !A.S || !A.S.pick) return;
  b.closest('.pkw').classList.remove('can');
  send({ t: 'flip', id: +b.dataset.flip });
});
const viewCtx = () => ({ A, pid, esc, ic, rackStyle, rackOf });

// A little picture of each game, for the game chooser.
const GAME_ART = {
  tiles: () => `<span class="tile c1"><span class="num">7</span></span><span class="tile c2"><span class="num">8</span></span><span class="tile c3"><span class="num">9</span></span>`,
  bj: () => pcard(0) + pcard(25),
  uno: () => ccard(7) + ccard(73) + ccard(104),
  chess: () => `<span class="artsq">${chessGlyph('n')}</span><span class="artsq lt">${chessGlyph('K')}</span><span class="artsq">${chessGlyph('q')}</span>`,
  checkers: () => '<span class="ck b"></span><span class="ck a king"><b>♛︎</b></span><span class="ck a"></span>',
  idiot: () => pcard(1) + pcard(9) + pcard(13),
  hearts: () => pcard(11) + pcard(13) + pcard(25),
  dominoes: () => domino(12, 12, 'v') + domino(5, 9, 'v') + domino(1, 7, 'v'),
  mancala: () => '<span class="artpit"><i class="seed s0"></i><i class="seed s1"></i><i class="seed s2"></i></span><span class="artpit"><i class="seed s3"></i><i class="seed s4"></i></span><span class="artpit"><i class="seed s1"></i><i class="seed s2"></i><i class="seed s0"></i><i class="seed s3"></i></span>',
};
const gameArt = (g, cls = '') => `<span class="gart gart-${g} ${cls}" aria-hidden="true">${GAME_ART[g]()}</span>`;
const players = g => (g.min === g.max ? `${g.min}` : `${g.min}–${g.max}`) + ' players';

/* The lobby: everyone sits down and picks their color; the host picks the game, sets it up and starts it. */
function renderLobby(box) {
  const S = A.S;
  const here = S.players.filter(p => p.on);
  const host = isHost(), hostP = S.players.find(p => p.pid === S.host);
  const hostName = hostP ? esc(hostP.name) : 'The host';
  const g = S.game && GAMES[S.game];
  const link = location.origin + location.pathname + '?room=' + A.code;
  const max = g ? g.max : 8;
  // The host drags people into order: Player 1, 2, 3... In a two-player game the first two play.
  const SIDES = { chess: ['White', 'Black'], checkers: ['Red', 'White'] };
  const role = i => (g && i >= max ? (g.max === 2 ? 'Watches' : 'Watching (full)') : `Player ${i + 1}${g && SIDES[S.game] ? ' · ' + SIDES[S.game][i] : ''}`);
  const chips = here.map((p, i) => `<div class="pchip ${p.cpu ? 'cpu' : ''} ${host ? 'drag' : ''} ${g && i >= max ? 'bench' : ''}" data-pid="${esc(p.pid)}" style="${rackStyle(p.rc)}">${host ? `<span class="grip" title="Drag to change the order" aria-hidden="true"><i></i><i></i><i></i></span>` : ''}<b class="pnum" title="${role(i)}">${g && i >= max ? ic('users') : i + 1}</b><span class="pn">${p.pid === S.host ? `<i class="hostcrown" title="Host">${ic('crown')}</i>` : ''}${esc(p.name)}</span>
      ${p.cpu && host ? `<button class="iconbtn rm" data-act="rmcpu" data-pid="${esc(p.pid)}" aria-label="Remove ${esc(p.name)}">${ic('close')}</button>` : ''}
      ${!p.cpu && host && p.pid !== pid ? `<button class="iconbtn rm" data-act="host" data-pid="${esc(p.pid)}" aria-label="Make ${esc(p.name)} the host" title="Make ${esc(p.name)} the host">${ic('crown')}</button>` : ''}</div>`).join('');
  const full = here.length >= 8;
  const empties = here.length < 8 ? `<div class="pchip empty-seat">Open seat</div>` : '';
  const taken = {};
  for (const p of S.players) if (p.pid !== pid && (p.on || p.seat)) taken[p.rc] = p.name;
  let right;
  if (!g) {
    right = `<div class="section"><h3>${host ? 'Choose a game' : `${hostName} is choosing a game`}</h3>
      <div class="gamepick">${GAME_IDS.map(id => { const x = GAMES[id]; return `<button class="gcard" data-act="pick" data-game="${id}" ${host ? '' : 'disabled'}>
        ${gameArt(id)}<span class="gtxt"><b>${x.name}</b><small>${x.blurb}</small><i>${players(x)}</i></span></button>`; }).join('')}</div>
      ${host ? '' : `<p class="tip">${ic('crown')}<span>Only the host picks the game. Pick your color while you wait.</span></p>`}</div>`;
  } else {
    const cfg = cfgFor(S.game, S.cfg && S.cfg[S.game]);
    const sets = g.settings.map(st => `<div class="gset"><span class="glabel">${st.label}</span><span class="segopts" role="group" aria-label="${st.label}">${st.options.map(([v, label]) =>
      `<button class="${cfg[st.key] === v ? 'on' : ''}" data-act="cfg" data-key="${st.key}" data-v='${esc(JSON.stringify(v))}' aria-pressed="${cfg[st.key] === v}" ${host ? '' : 'disabled'}>${label}</button>`).join('')}</span></div>`).join('');
    const need = g.min - here.length;
    right = `<div class="section gamehead">${gameArt(S.game, 'small')}<div class="gh"><h3>Game</h3><b class="gname">${g.name}</b><small>${players(g)}</small></div>
        ${host ? `<button class="btn small" data-act="pick" data-game="">${ic('undo')}Change</button>` : ''}</div>
      ${g.settings.length ? `<div class="section"><h3>Settings${host ? '' : ` · set by ${hostName}`}</h3><div class="gsets">${sets}</div></div>` : ''}
      ${host ? `<div class="section cpusec ${full ? 'full' : ''}"><h3>Add a computer player</h3>
        <div class="cpuadd">
          <button class="btn" data-act="addcpu" data-level="easy" ${full ? 'disabled' : ''}>${ic('plus')}<span><b>Easy</b><small>Learning</small></span></button>
          <button class="btn" data-act="addcpu" data-level="medium" ${full ? 'disabled' : ''}>${ic('plus')}<span><b>Medium</b><small>Solid</small></span></button>
          <button class="btn" data-act="addcpu" data-level="hard" ${full ? 'disabled' : ''}>${ic('plus')}<span><b>Hard</b><small>Tricky</small></span></button>
        </div></div>` : ''}
      ${host ? `<button class="btn go huge" data-act="start" ${need > 0 ? 'disabled' : ''}>${need > 0 ? `Need ${need} more player${need === 1 ? '' : 's'}` : `Start ${g.name}`} ${ic('arrow')}</button>`
        : `<div class="waitstart">${ic('crown')}<span>Waiting for ${hostName} to start</span></div>`}`;
  }
  box.innerHTML = `<div class="card lobby">
    <div class="lcol">
      <div class="panelhead"><span class="badge">${ic('users')}</span><div class="ph"><h2>Lobby “${esc(A.code)}”</h2>${g ? '' : '<p>Waiting for everyone to sit down</p>'}</div>
        <span class="headact"><button class="btn small" data-act="${navigator.share ? 'share' : 'copy'}">${ic(navigator.share ? 'share' : 'link')}Invite</button><button class="btn small" data-act="leave" aria-label="Leave">${ic('logout')}</button></span></div>
      <div class="section invite"><h3>Invite your family</h3>
        <div class="linkrow"><input readonly value="${esc(link)}" aria-label="Lobby link"><button class="btn" data-act="copy">${ic('link')}Copy link</button>${navigator.share ? `<button class="btn" data-act="share">${ic('share')}Share</button>` : ''}</div>
      </div>
      <div class="section"><h3>In the lobby · ${here.length} of 8</h3>
        ${g && g.max === 2 && here.length > 2 ? '<p class="fieldhint draghint">Players 1 and 2 play; the rest watch.</p>' : ''}
        <div class="players" id="lobbyPlayers">${chips}${empties}</div>
      </div>
      <div class="section"><h3>Your color</h3><div class="swatches row8">${swatches(A.rc, 'setrc', taken)}</div></div>
      ${host ? `<label class="setrow listrow"><span class="setlabel">${ic('users')}Show this lobby on the start screen</span><input type="checkbox" class="switch" data-listed ${S.unlisted ? '' : 'checked'}></label>` : ''}
      <div class="lobbyfoot"><button class="btn small leave" data-act="leave">${ic('logout')}Leave</button></div>
    </div>
    <div class="lcol">${right}</div>
  </div>`;
}

/* The host drags people in the lobby into order. With a mouse, any part of a person's card picks it up; on a
   touch screen, the grip on its left (so the lobby still scrolls with a finger). The order is sent when it is
   put down; while carrying, lobby updates wait. */
let lobbyDrag = null;
const lobbyChips = () => [...document.querySelectorAll('#lobbyPlayers .pchip[data-pid]')];
function renumberChips() { lobbyChips().forEach((c, i) => { const n = c.querySelector('.pnum'); if (n && !c.classList.contains('bench')) n.textContent = i + 1; }); }
document.addEventListener('pointerdown', e => {
  const chip = e.target.closest && e.target.closest('#lobbyPlayers .pchip.drag');
  if (!chip || e.button > 0 || e.target.closest('button') || !isHost()) return;
  if (e.pointerType !== 'mouse' && !e.target.closest('.grip')) return;
  e.preventDefault();
  const r = chip.getBoundingClientRect();
  lobbyDrag = { chip, x0: e.clientX, y0: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, w: r.width, on: false };
});
document.addEventListener('pointermove', e => {
  const d = lobbyDrag;
  if (!d) return;
  if (!d.on) {
    if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 6) return;
    d.on = true;
    d.ghost = d.chip.cloneNode(true);
    d.ghost.classList.add('chipghost');
    d.ghost.style.width = d.w + 'px';
    document.body.appendChild(d.ghost);
    d.chip.classList.add('lifted');
    document.body.classList.add('chipdragging');
  }
  e.preventDefault();
  d.ghost.style.transform = `translate(${e.clientX - d.dx}px, ${e.clientY - d.dy}px) rotate(-2deg)`;
  const over = document.elementFromPoint(e.clientX, e.clientY);
  const t = over && over.closest('#lobbyPlayers .pchip[data-pid]');
  if (!t || t === d.chip) return;
  const list = lobbyChips();
  if (list.indexOf(t) > list.indexOf(d.chip)) t.after(d.chip); else t.before(d.chip);
  renumberChips();
}, { passive: false });
function endLobbyDrag(drop) {
  const d = lobbyDrag;
  if (!d) return;
  lobbyDrag = null;
  document.body.classList.remove('chipdragging');
  if (d.ghost) d.ghost.remove();
  if (d.on && drop && A.S && A.S.phase === 'lobby') {
    const pids = lobbyChips().map(c => c.dataset.pid);
    // show the new order straight away; the referee's update follows
    const rank = new Map(pids.map((x, i) => [x, i]));
    A.S.players.sort((a, b) => (rank.has(a.pid) ? rank.get(a.pid) : 99) - (rank.has(b.pid) ? rank.get(b.pid) : 99));
    send({ t: 'order', pids });
    noClickUntil = Date.now() + 250;
  }
  if (d.on || d.stale) renderCenter();
}
document.addEventListener('pointerup', () => endLobbyDrag(true));
document.addEventListener('pointercancel', () => endLobbyDrag(false));

// Wins by each face: lifetime wins for the family (from the saved records), wins at this table for computers.
const winsFor = (p, g) => (p && p.prof ? lifeWins(p.prof, g) : winsOf(p, g));

// No points: whoever goes out first wins, and only wins are counted (per game). Blackjack shows the money.
function renderOver(box) {
  const S = A.S, g = S.game || 'tiles';
  const r = S.result || {};
  const rows = S.players.filter(p => p.seat || winsFor(p, g)).sort((a, b) => winsFor(b, g) - winsFor(a, g));
  const bj = g === 'bj' && S.bjEnd;
  const bg = { chess: S.chess, checkers: S.ck, mancala: S.mc, idiot: S.id, hearts: S.hr, dominoes: S.dm }[g], why = bg && bg.why;
  const money2 = n => (n < 0 ? '−' : n > 0 ? '+' : '') + money(Math.abs(n));
  const table = bj ? `<div class="bjend"><div class="bjrow head"><span>Player</span><span>Money</span><span>Buy-backs</span><span>Up / down</span></div>
      ${S.bjEnd.rows.map(x => `<div class="bjrow ${x.pid === r.pid ? 'win' : ''}" style="${rackStyle(x.rc)}"><span class="wn"><i class="dot"></i>${esc(x.name)}</span><span>${money(x.chips)}</span><span>${x.buy}</span><span class="${x.net > 0 ? 'up' : x.net < 0 ? 'down' : ''}">${money2(x.net)}</span></div>`).join('')}</div>` : '';
  box.innerHTML = `<div class="card over">
    <div class="winner"><span class="cup">${ic('trophy')}</span><h2>${r.name ? `${esc(r.name)} wins!` : 'No winner this time'}</h2></div>
    ${why ? `<p class="endwhy">${esc(why)}</p>` : ''}
    ${table}
    <div class="wins">${rows.map(p => `<div class="winrow ${p.pid === r.pid ? 'win' : ''}"><span class="wn">${esc(p.name)}${p.cheats && g === 'tiles' ? ` <i class="cheattag" title="Times they switched on Always show the best play this game">cheat mode ×${p.cheats}</i>` : ''}</span><span class="wc" title="${p.prof ? 'Lifetime wins' : 'Wins at this table'}">${ic('trophy')}<b>${winsFor(p, g)}</b></span></div>`).join('')}</div>
    ${g === 'tiles' && rows.some(p => p.cheats) ? `<div class="cheattally"><b>${ic('sortnum')}Cheat mode this game</b>${rows.filter(p => p.cheats).sort((a, b) => b.cheats - a.cheats).map(p => `<span>${esc(p.name)} switched it on <b>${p.cheats}</b> time${p.cheats === 1 ? '' : 's'}</span>`).join('')}</div>` : ''}
    <button class="btn go huge" data-act="newgame">Back to the lobby ${ic('arrow')}</button>
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
// Who put a tile down: shown on the tiles going down during a turn, and for a few seconds after the turn.
const BY_MS = 6000;
// Each such tile is outlined in the player's rack colour, with their name under each run of their tiles.
// (On your own screen during your own turn, your new tiles keep their gold outline instead.)
function byOf(id, before) {
  const S = A.S;
  let who = null, fade = null;
  if (S.work && !A.W && !before[id]) who = S.turn;
  else if (A.shown && A.shown.ids.has(id)) {
    const left = A.shown.until - Date.now();
    if (left <= 0) return null;
    who = A.shown.pid;
    fade = Math.max(0, left - 700);
  }
  const p = who && S.players.find(q => q.pid === who);
  return p ? { p, fade } : null;
}
const fadeStyle = b => (b.fade == null ? '' : `;animation:byOut .7s ease ${b.fade}ms forwards`);
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
  // (with Fit on, the spare row is counted on everyone's turn, so the table is the same fitted size whoever is playing)
  const u = measureBoard(box, Math.ceil(lowest + 2));
  let html = '', names = '', maxX = BOARD_W, maxY = 0;
  for (const g of groupsOf(pos)) {
    const ok = analyze(g).ok;
    let run = null;   // the run of tiles in this set put down by one player, for their name label
    const endRun = () => {
      if (!run) return;
      const cx = (run.x0 + run.n / 2) * u.ux - 2, ty = run.y * u.uy + BOARD_PAD + u.bh;
      names += `<div class="byname" aria-hidden="true" style="${rackStyle(run.b.p.rc)};left:${cx.toFixed(1)}px;top:${ty.toFixed(1)}px${fadeStyle(run.b)}">${esc(run.b.p.name || '?')}</div>`;
      run = null;
    };
    g.forEach((id, i) => {
      const [x, y] = pos[id];
      maxX = Math.max(maxX, x + 1); maxY = Math.max(maxY, y);
      const b = byOf(id, before);
      const cls = [before[id] || b ? '' : 'placed', lifted.has(id) ? 'lifted' : '', showMarks ? (ok ? 'seg-ok' : 'seg-bad') : 'seg', i ? '' : 'seg-start', i === g.length - 1 ? 'seg-end' : '', b ? 'owned' : ''].join(' ');
      const ring = b ? `<i class="byring" aria-hidden="true" style="${rackStyle(b.p.rc)}${fadeStyle(b)}"></i>` : '';
      html += tileHTML(id, cls, `left:${(x * u.ux).toFixed(1)}px;top:${(y * u.uy + BOARD_PAD).toFixed(1)}px`, ring);
      if (b && run && run.b.p === b.p) run.n++;
      else { endRun(); if (b) run = { b, x0: x, y, n: 1 }; }
    });
    endRun();
  }
  html += names;
  const mainEl = box.parentElement, cs = getComputedStyle(mainEl);
  const wpx = Math.ceil(maxX * u.ux - 4);
  const room = mainEl.offsetHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 2 - (wpx > box.clientWidth ? 9 : 0);
  // The table fills the space it has and doesn't scroll. Only once a set sits on the bottom row that fits
  // does it grow, by one more row at most (during your turn, so there is somewhere to put a new set).
  const lastRow = Math.max(0, Math.floor((room - BOARD_PAD - u.bh) / u.uy));
  const extra = html && (live || A.fit) && maxY >= lastRow - 0.01 ? 1 : 0;
  const need = html ? (maxY + extra) * u.uy + BOARD_PAD + u.bh + 4 : 0;
  const h = Math.max(need, room);
  box.innerHTML = `<div id="board" class="board ${live ? 'live' : ''}" style="--tw:${u.bw}px;--th:${u.bh}px;width:${wpx}px;height:${Math.floor(h)}px">${html}</div>`;
  drawHand();
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
  // The card games: no rack, but my cards (Color Clash) and that game's buttons.
  const cards = !!(S && S.phase === 'play' && S.game !== 'tiles');
  $('#rack').hidden = cards;
  $('#hand').hidden = !(cards && (S.game === 'uno' || HAND_GAMES.includes(S.game)) && m && m.seat);
  if (cards) {
    $('#rackTools').innerHTML = '';
    const ctl = { bj: bjControls, uno: unoControls, idiot: idiotControls, hearts: heartsControls, dominoes: dominoControls }[S.game] || boardControls;
    c.innerHTML = ctl(viewCtx());
    // Dominoes: the tray's size slider and Fit
    const dmt = S.game === 'dominoes' && m && m.seat;
    $('#dmTools').hidden = !dmt;
    if (dmt) { $('#dmSize').value = A.dz; $('#dmTable').value = A.dtz; }
    const hand = $('#hand'), draw = { uno: unoHand, idiot: idiotHand, hearts: heartsHand, dominoes: dominoHand }[S.game];
    if (draw && !hand.hidden) { hand.className = 'hand'; draw(hand, viewCtx()); }
    return;
  }
  $('#dmTools').hidden = true;
  if (!S || !m || S.phase !== 'play') { c.innerHTML = ''; $('#rackTools').innerHTML = ''; renderRack(); return; }
  // Undo, Reset and Fit sit on the rack's edge, on the right of the Sort buttons
  let tools = '';
  if (myTurn()) {
    const placed = A.W && A.W.rack.length < A.W.startRack.length;
    tools += `<button class="sortbtn" data-act="undo" aria-label="Undo" title="Undo" ${A.hist.length ? '' : 'disabled'}>${ic('undo')}<span class="long">Undo</span></button>`;
    tools += `<button class="sortbtn" data-act="reset" aria-label="Reset" title="Reset" ${placed || (A.W && A.hist.length) ? '' : 'disabled'}>${ic('reset')}<span class="long">Reset</span></button>`;
  }
  tools += `<button class="sortbtn ${A.fit ? 'on' : ''}" data-act="fit" aria-pressed="${A.fit}" aria-label="Fit the whole table on screen" title="Fit the whole table on screen">${ic('fit')}<span class="long">Fit</span></button>`;
  $('#rackTools').innerHTML = tools;
  let html = '';
  if (myTurn()) {
    // Done only shows once at least one tile has gone from my rack onto the table this turn.
    // one button at a time: Done once a tile has gone from the rack to the table, Draw (or Pass) until then
    if (A.W && A.W.rack.length < A.W.startRack.length) html += `<button class="btn go" data-act="done">${ic('check')}Done</button>`;
    else html += `<button class="btn draw" data-act="draw" title="Tiles left to draw: ${S.pool.length}">${S.pool.length ? `${ic('draw')}Draw<b class="cnt">${S.pool.length} left</b>` : `${ic('skip')}Pass`}</button>`;
  } else {
    const cur = S.players.find(p => p.pid === S.turn);
    if (cur) html += `<span class="turnchip" style="${rackStyle(cur.rc)}">${cur.cpu ? ic('bot') : ''}${esc(cur.name)}</span>`;
    if (cur && !cur.on) html += `<button class="btn" data-act="skip">${ic('skip')}Skip</button>`;
    html += `<span class="poolchip" title="Tiles left to draw: ${S.pool.length}">${ic('draw')}<b>${S.pool.length}</b></span>`;
  }
  c.innerHTML = html;
  $('#sorts').hidden = !m.seat;
  renderRack();
}

/* ---------------- the rack: 3 rows of slots, gaps allowed ---------------- */

const ROWS = 3, GAP = 5;
const gridKey = () => 'jg-grid-' + A.code;
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
  const g = rack.querySelector('.grooves');
  if (S && S.game !== 'tiles' && S.phase === 'play') { spaceTile().hidden = true; return; }
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
  for (const b of document.querySelectorAll('#sorts .sortbtn')) {
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
    // Two colors on the top row and two on the second, with a gap between them, and the jokers on the third
    // row (or beside a color, if every row is taken), as long as each row fits.
    const colored = groups.filter(a => tile(a[0]).c < 4), jokers = groups.find(a => tile(a[0]).c === 4);
    const rows = [];
    for (let i = 0; i < colored.length; i += 2) rows.push(colored.slice(i, i + 2));
    const width = r => r.reduce((s, a) => s + a.length, 0) + r.length - 1;
    if (jokers) {
      if (rows.length < ROWS) rows.push([jokers]);
      else { const r = rows.find(x => width(x) + 1 + jokers.length <= cols); if (r) r.push(jokers); else rows.length = 0; }
    }
    if (rows.length && rows.every(r => width(r) <= cols)) {
      g = rows.map(r => { const row = blank(); let c = 0; r.forEach((a, i) => { if (i) c++; for (const id of a) row[c++] = id; }); return row; });
    }
  }
  if (by === 'col' && !g) {
    // Otherwise each color together on one row, with a gap between colors, when they fit in 3 rows.
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
  // each row centred on the rack, gaps between colors kept
  g = g.map(row => {
    let a = row.findIndex(x => x != null), b = -1;
    row.forEach((x, i) => { if (x != null) b = i; });
    if (a < 0) return row;
    const out = blank(), at = Math.floor((cols - (b - a + 1)) / 2);
    for (let i = a; i <= b; i++) out[at + i - a] = row[i];
    return out;
  });
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
  const all = () => document.querySelectorAll('#rack .grooves .tile[data-id]:not(.landing), #board > .tile[data-id]:not(.lifted)');
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
  document.body.classList.add('dragging', 'moving');
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
  queueHand();
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

/* Live: while it is my turn, the tiles I carry over the table are sent to everyone else as they move (a few
   times a second), so they see where they are going. Tiles carried only around my rack are never sent. */
let handT = 0, handLast = 0, handWas = '';
function sendHand(clear) {
  clearTimeout(handT); handT = 0;
  const d = A.drag;
  if (!A.W) return;
  let m;
  if (clear || !d || !d.ids || !d.ids.length) m = { t: 'hand', ids: [] };
  else if (d.over && $('#board')) {
    const [x, y] = boardPoint(d.gx, d.gy);
    m = { t: 'hand', ids: d.ids, off: d.ids.map(id => d.off.get(id)), at: [Math.round(x * 100) / 100, Math.round(y * 100) / 100] };
  } else {
    const ids = d.ids.filter(id => A.W.pos[id]);   // lifted off the table: they show as picked up
    m = { t: 'hand', ids, off: ids.map(id => d.off.get(id)), at: null };
  }
  const key = JSON.stringify(m);
  if (key === handWas) return;
  handWas = key; handLast = Date.now();
  send(m);
}
function queueHand() {
  if (!A.W || handT) return;
  const wait = Math.max(0, 70 - (Date.now() - handLast));
  handT = setTimeout(() => { handT = 0; sendHand(false); }, wait);
}
function onHand(m) {
  if (myTurn() || !A.S || m.from !== A.S.turn || m.turnNo !== A.S.turnNo) return;
  clearTimeout(A.handT);
  if (!m.ids || !m.ids.length) {
    // dropped: what they did arrives with the next update; until then the tiles stay where they were let go
    if (A.hand) { A.hand.ending = true; A.handT = setTimeout(() => { A.hand = null; drawHand(); }, 800); }
    return;
  }
  A.hand = { from: m.from, turnNo: m.turnNo, ids: m.ids, off: m.off || [], at: m.at };
  A.handT = setTimeout(() => { A.hand = null; drawHand(); }, 4000);   // nothing heard for a while: gone
  drawHand();
}
function drawHand() {
  const board = $('#board');
  if (!board) return;
  const h = A.hand && A.S && !A.W && A.hand.from === A.S.turn ? A.hand : null;
  const ids = new Set(h ? h.ids : []);
  for (const t of board.querySelectorAll('.tile.peerlifted')) if (!ids.has(+t.dataset.id)) t.classList.remove('peerlifted');
  for (const id of ids) { const t = board.querySelector(`:scope > .tile[data-id="${id}"]`); if (t) t.classList.add('peerlifted'); }
  let el = board.querySelector('.peerhand');
  if (!h || !h.at || !A.bu) { if (el) el.remove(); return; }
  const u = A.bu, key = h.ids.join(',') + '|' + u.bw;
  if (!el || el.dataset.key !== key) {
    if (el) el.remove();
    el = document.createElement('div');
    el.className = 'peerhand'; el.dataset.key = key;
    el.innerHTML = h.ids.map((id, i) => { const o = h.off[i] || [0, 0]; return tileHTML(id, 'carried', `left:${(o[0] * u.ux).toFixed(1)}px;top:${(o[1] * u.uy).toFixed(1)}px`); }).join('');
    el.style.transition = 'none';
    el.style.transform = `translate(${h.at[0] * u.ux}px, ${h.at[1] * u.uy + BOARD_PAD}px)`;
    board.appendChild(el);
    el.offsetWidth; el.style.transition = '';
  } else el.style.transform = `translate(${h.at[0] * u.ux}px, ${h.at[1] * u.uy + BOARD_PAD}px)`;
}

function endDrag() {
  if (A.W) sendHand(true);
  ghost && ghost.remove(); ghost = null;
  document.body.classList.remove('dragging', 'moving');
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
  // on bigger screens, the open space in the webcam columns beside the table works too (not on a webcam itself)
  const side = window.innerWidth >= 1100 && t.closest('#seatsL, #seatsR') && !t.closest('.seat');
  if (!(t.closest('main, #rack') || side) || !tiles()) return;
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
// (cx, cy) is the middle of the Space tile being carried: the dividing line nearest to it is the one used.
function spaceOnTable(cx, cy) {
  if (!A.W || !$('#board')) return null;
  const [x, y] = boardPoint(cx, cy), pos = A.W.pos, u = A.bu;
  const midY = u.bh / 2 / u.uy, gap = (u.ux - u.bw) / 2 / u.ux;   // a tile's middle, and half the gap between tiles
  for (const g of groupsOf(pos)) {
    const sx = pos[g[0]][0], sy = pos[g[0]][1];
    if (Math.abs(sy + midY - y) > 0.5) continue;
    // the line before tile k sits in the gap at sx + k: pick the one nearest the middle
    const k = Math.round(x - sx + gap);
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
  document.body.classList.add('moving');
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
  const id = overTable ? spaceOnTable(d.gx + tw / 2, d.gy + th / 2) : null;
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
  document.body.classList.remove('moving');
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
  // the card games' moves
  if (act.startsWith('g:')) {
    const m = { t: 'g', a: act.slice(2) };
    if (b.dataset.amt) m.amt = +b.dataset.amt;
    if (m.a === 'bet') A.bjBet = m.amt;
    send(m);
    return;
  }
  if (act === 'betadd' || act === 'betclear') {
    const S = A.S, mm = me();
    if (!S || !S.bj || !mm) return;
    const base = act === 'betclear' ? 0 : (A.betFresh ? 0 : A.bjBet || 0);
    A.betFresh = false;
    A.bjBet = Math.max(S.bj.cfg.min, Math.min(mm.chips, base + (+b.dataset.v || 0)));
    renderMe();
    return;
  }
  if (act === 'cplay') {
    const id = +b.dataset.id;
    if (isWild(id)) { A.wildPick = A.wildPick === id ? null : id; renderMe(); return; }
    A.wildPick = null;
    send({ t: 'g', a: 'play', id });
    return;
  }
  if (act === 'cwild') {
    const id = A.wildPick;
    A.wildPick = null;
    if (id != null) send({ t: 'g', a: 'play', id, col: +b.dataset.col });
    renderMe();
    return;
  }
  if (act === 'bsq') {
    A.why = null;
    const mv = boardTap(A, pid, +b.dataset.sq);
    if (mv) send({ t: 'g', ...mv });
    if (A.why) toast(A.why, 2500);
    renderCenter();
    return;
  }
  if (act === 'bpromo') {
    if (A.promo) send({ t: 'g', a: 'move', f: A.promo.f, to: A.promo.t, p: b.dataset.p });
    A.promo = null; A.bsel = null; renderCenter();
    return;
  }
  if (act === 'bpit') { send({ t: 'g', a: 'move', i: +b.dataset.i }); return; }
  if (TABLE_ACTS.includes(act)) { const mv = tableTap(A, pid, act, b); if (mv) for (const one of [].concat(mv)) send({ t: 'g', ...one }); renderCenter(); renderMe(); return; }
  if (act === 'bresign') {
    if (A.resignArm && Date.now() - A.resignArm < 4000) { A.resignArm = 0; send({ t: 'g', a: 'resign' }); }
    else { A.resignArm = Date.now(); setTimeout(() => { if (A.S) renderMe(); }, 4100); }
    renderMe();
    return;
  }
  if (act.startsWith('rps')) { rpsAct(act, b); return; }
  if (act === 'whisper') { openWhisper(b.dataset.pid); return; }
  if (act === 'wclose') { closeWhisper(); return; }
  if (act === 'wnoteclose') { $('#wNote').hidden = true; return; }
  if (act === 'joinlobby') { $('#code').value = b.dataset.code; if (STAT_PROFILES.includes($('#prof').value)) $('#joinForm').requestSubmit(); else { $('#prof').focus(); $('#joinErr').textContent = 'Choose your name, then join.'; } return; }
  if (act === 'lifeclose') { showLife(false); return; }
  if (act === 'pick') { send({ t: 'pick', game: b.dataset.game || null }); return; }
  if (act === 'cfg') { let v; try { v = JSON.parse(b.dataset.v); } catch (er) { return; } send({ t: 'cfg', key: b.dataset.key, value: v }); return; }
  if (act === 'host') { send({ t: 'host', pid: b.dataset.pid }); return; }
  if (act === 'start') send({ t: 'start' });
  else if (act === 'newgame') send({ t: 'newgame' });
  else if (act === 'done') done();
  else if (act === 'draw') draw();
  else if (act === 'undo') undo();
  else if (act === 'reset') resetTurn();
  else if (act === 'torack') flip(null, () => moveSelected('rack'));
  else if (act === 'space') addSpace();
  else if (act === 'fit') { A.fit = !A.fit; try { localStorage.setItem('jg-fit', A.fit ? '1' : ''); } catch (e) { /* private */ } renderAll(); }
  else if (act === 'sortnum') sortRack('num');
  else if (act === 'sortcol') sortRack('col');
  else if (act === 'skip') send({ t: 'skip' });
  else if (act === 'copy') copyLink();
  else if (act === 'leave') leaveTable('You left the table.');
  else if (act === 'addcpu') send({ t: 'addcpu', level: b.dataset.level });
  else if (act === 'rmcpu') send({ t: 'rmcpu', pid: b.dataset.pid });
  else if (act === 'share') navigator.share({ title: 'Game Night', text: 'Come play games with us!', url: location.origin + location.pathname + '?room=' + A.code }).catch(() => {});
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
  applyMic(true);
  renderStatus(); renderSeats();
}

function toggleMic() {
  const R = myRoom();
  if (R && !R.isSnd) { toast(`You're in the same room as ${R.mates.filter(q => q.pid !== pid).map(q => q.name).join(' and ')}. The sound goes through ${R.snd ? R.snd.name + "'s device" : 'another device'}. To change that, open Settings.`, 6000); return; }
  A.micOn = !A.micOn;
  applyMic(true);
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
// Dark mode: the felt turns dark grey, nearly black, in every game. Kept on this device.
const setDark = on => document.documentElement.classList.toggle('dark', on);
setDark(!!store.get('dark', false));
$('#darkOn').checked = !!store.get('dark', false);
$('#darkOn').addEventListener('change', e => { store.set('dark', e.target.checked); setDark(e.target.checked); });
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
  notice.set(null); showLobbies();
  A.rps = null; showRps(false); seatMenu(null); closeWhisper(); A.wlog.clear(); if ($('#wNote')) $('#wNote').hidden = true;
  A.S = null; A.W = null; A.lastAlert = null; A.lastDrew = null; A.lastShame = null; A.lastAnn = null; A.wildPick = null; A.bjBet = null; A.hist = []; A.sel.clear(); A.drag = null; A.loose.clear(); A.sortUndo = null; A.status = 'off';
  for (const el of seatEls.values()) el.remove();
  seatEls.clear(); videoEls.clear();
  for (const g of gains.values()) try { g.src.disconnect(); } catch (e) { /* ignore */ }
  gains.clear();
  showSettings(false);
  help.leave();
  stats.leave();
  $('#game').hidden = true; $('#join').hidden = false;
  document.title = 'Game Night';
  const u = new URL(location.href); u.searchParams.delete('auto'); history.replaceState(null, '', u);
  if (msg) toast(msg, 6000);
}
window.JG.leaveTable = leaveTable;

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
// The host can end the game being played (it also asks for a second tap).
let endArm = 0;
$('#endBtn').addEventListener('click', () => {
  const b = $('#endBtn');
  if (!b.classList.contains('armed')) {
    b.classList.add('armed');
    b.querySelector('span').textContent = 'Tap again to end';
    clearTimeout(endArm);
    endArm = setTimeout(() => { b.classList.remove('armed'); b.querySelector('span').textContent = 'End this game'; }, 4000);
    return;
  }
  clearTimeout(endArm);
  b.classList.remove('armed'); b.querySelector('span').textContent = 'End this game';
  send({ t: 'end' });
  showSettings(false);
});

/* ---------------- rock paper scissors on the side ----------------
   During any game anyone (playing or watching) can challenge someone else. It never touches the game:
   turns carry on underneath, and the referee keeps the picks private to the two of them. */
const HANDS = { r: ['✊', 'Rock'], p: ['✋', 'Paper'], s: ['✌️', 'Scissors'] };
const rpsOn = () => !!(A.S && A.S.phase === 'play' && me());
function rpsState() {
  const on = rpsOn();
  document.body.classList.toggle('rps-ok', !!me());
  if (!on) { A.rps = null; showRps(false); if (!me()) seatMenu(null); return; }
  if (!$('#rpsBox').hidden) renderRps();
}
function showRps(open) {
  $('#rpsBox').hidden = !open;
  if (open) { $('#rpsBox').classList.add('front'); $('#wBox').classList.remove('front'); renderRps(); }
}
function onRps(m) {
  if (!rpsOn()) return;
  if (m.busy) { toast(`${m.busy} is already playing rock paper scissors. Try again in a moment.`); return; }
  const g = m.g;
  if ((g.stage === 'gone' || g.stage === 'no') && g.by === pid) return;
  const incoming = g.stage === 'ask' && g.b.pid === pid && !(A.rps && A.rps.id === g.id);
  A.rps = g;
  if (incoming) { beep(523, 0.12); setTimeout(() => beep(784, 0.15), 120); }
  if (g.stage === 'done') [g.res.win === pid ? 784 : 440, g.res.win === pid ? 1047 : 330].forEach((f, i) => setTimeout(() => beep(f, 0.14), i * 120));
  showRps(true);
}
function renderRps() {
  const box = $('#rpsBox'), g = A.rps;
  const head = `<div class="pophead"><b>✊ ✋ ✌️ Rock Paper Scissors</b><button class="iconbtn" data-act="rpsclose" aria-label="Close">${ic('close')}</button></div>`;
  const hand = (v, cls = '') => `<span class="rpshand ${cls}" title="${HANDS[v][1]}">${HANDS[v][0]}</span>`;
  const picks = `<div class="rpspicks">${Object.keys(HANDS).map(v => `<button class="rpspick" data-act="rpspick" data-v="${v}">${hand(v)}<b>${HANDS[v][1]}</b></button>`).join('')}</div>`;
  let body;
  const opp = g && (g.a.pid === pid ? g.b : g.a);
  const chipOf = q => `<span class="turnchip" style="${rackStyle(q.rc)}">${q.cpu ? ic('bot') : ''}${esc(q.name)}</span>`;
  if (!g) {
    const people = A.S.players.filter(p => p.on && p.pid !== pid);
    body = `<p class="fieldhint">Play someone while the game carries on. Nobody leaves the table.</p>
      <div class="rpslist">${people.length ? people.map(p => `<button class="btn rpswho" data-act="rpsask" data-pid="${esc(p.pid)}" style="${rackStyle(p.rc)}"><i class="dot"></i>${p.cpu ? ic('bot') : ''}${esc(p.name)}<span>${ic('arrow')}</span></button>`).join('') : '<p class="fieldhint">No one else is here.</p>'}</div>`;
  } else if (g.stage === 'ask' || g.stage === 'play') {
    const askedMe = g.stage === 'ask' && g.b.pid === pid && !g.mine;
    body = g.mine
      ? `<div class="rpsvs">${hand(g.mine, 'me')}<span class="vs">vs</span><span class="rpshand wait">?</span></div><p class="rpsmsg">Waiting for ${chipOf(opp)}…</p>`
      : `<p class="rpsmsg">${askedMe ? `${chipOf(opp)} wants to play!` : g.picked[opp.pid] ? `${chipOf(opp)} has picked. Your turn!` : `You vs ${chipOf(opp)}`}</p>${picks}
        ${askedMe ? '<button class="btn small rpsno" data-act="rpsno">No thanks</button>' : ''}`;
  } else if (g.stage === 'done') {
    const mine = g.res.pick[pid], theirs = g.res.pick[opp.pid];
    const won = g.res.win === pid, tie = !g.res.win;
    body = `<div class="rpsvs">${hand(mine, won ? 'win' : tie ? '' : 'lose')}<span class="vs">vs</span>${hand(theirs, !won && !tie ? 'win' : tie ? '' : 'lose')}</div>
      <p class="rpsres ${won ? 'won' : tie ? '' : 'lost'}">${won ? 'You win!' : tie ? "It's a tie!" : `${esc(opp.name)} wins!`}</p>
      <p class="rpsscore">You <b>${g.score[pid] || 0}</b> – <b>${g.score[opp.pid] || 0}</b> ${esc(opp.name)}</p>
      <div class="rpsacts"><button class="btn go" data-act="rpsask" data-pid="${esc(opp.pid)}">${ic('reset')}Again</button><button class="btn" data-act="rpsclose">Done</button></div>`;
  } else {
    body = `<p class="rpsmsg">${chipOf(opp)} ${g.stage === 'no' ? 'said no thanks.' : 'stopped playing.'}</p><div class="rpsacts"><button class="btn" data-act="rpsclose">OK</button></div>`;
  }
  box.innerHTML = head + `<div class="rpsbody">${body}</div>`;
}
function rpsAct(act, b) {
  const g = A.rps, live = g && (g.stage === 'ask' || g.stage === 'play');
  if (act === 'rpsclose') { if (live) send({ t: 'rps', a: 'close', id: g.id }); A.rps = null; showRps(false); return; }
  if (act === 'rpsask') { send({ t: 'rps', a: 'ask', to: b.dataset.pid }); return; }
  if (act === 'rpspick' && live && !g.mine) { g.mine = b.dataset.v; send({ t: 'rps', a: 'pick', id: g.id, v: g.mine }); renderRps(); return; }
  if (act === 'rpsno' && live) { send({ t: 'rps', a: 'no', id: g.id }); A.rps = null; showRps(false); return; }
  if (act === 'rpsback') { A.rps = null; renderRps(); }
}
// Tapping someone's face (their webcam) opens a little menu: whisper to them (any time), or rock paper
// scissors (during any game).
function seatMenu(seat) {
  let m = $('#seatMenu');
  if (!seat) { if (m) m.hidden = true; return; }
  const p = A.S && A.S.players.find(q => q.pid === seat.dataset.pid);
  if (!p) return;
  if (!m) { m = document.createElement('div'); m.id = 'seatMenu'; m.className = 'card seatmenu'; m.setAttribute('role', 'menu'); document.body.appendChild(m); }
  m.innerHTML = (p.cpu ? '' : `<button class="btn" role="menuitem" data-act="whisper" data-pid="${esc(p.pid)}"><span class="rpsico" aria-hidden="true">🤫</span>Whisper to ${esc(p.name)}</button>`)
    + (rpsOn() ? `<button class="btn" role="menuitem" data-act="rpsask" data-pid="${esc(p.pid)}"><span class="rpsico" aria-hidden="true">✊✋✌️</span>Rock paper scissors with ${esc(p.name)}</button>` : '');
  if (!m.innerHTML) { m.hidden = true; return; }
  m.hidden = false;
  const r = seat.getBoundingClientRect(), w = m.offsetWidth, h = m.offsetHeight;
  const below = r.bottom + 8 + h < innerHeight;
  m.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
  m.style.top = (below ? r.bottom + 8 : Math.max(8, r.top - h - 8)) + 'px';
}
document.addEventListener('click', e => {
  const menu = e.target.closest && e.target.closest('#seatMenu');
  if (menu) { setTimeout(() => seatMenu(null)); return; }
  const seat = e.target.closest && e.target.closest('.seat[data-pid]');
  const open = $('#seatMenu') && !$('#seatMenu').hidden;
  seatMenu(null);
  if (!seat || !me() || seat.dataset.pid === pid || A.drag) return;
  const p = A.S.players.find(q => q.pid === seat.dataset.pid);
  if (!p || !p.on || (open && A.menuFor === p.pid)) { A.menuFor = null; return; }
  A.menuFor = p.pid;
  seatMenu(seat);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') seatMenu(null); });
window.addEventListener('resize', () => seatMenu(null));

/* ---------------- whispers ----------------
   A private message to one person. The referee passes it to that person only (and back to the sender, so both
   screens show the same thread). Nothing is kept once you leave the table. */
A.wlog = new Map();   // pid -> [{ mine, text, at }]
A.wwith = null;       // who the whisper box is open for
function onWhisper(m) {
  const mine = m.from === pid, other = mine ? m.to : m.from;
  const log = A.wlog.get(other) || [];
  log.push({ mine, text: m.text, at: m.at });
  A.wlog.set(other, log.slice(-40));
  if (mine) { if (A.wwith === other) renderWhisper(); return; }
  beep(880, 0.08); setTimeout(() => beep(660, 0.1), 90);
  if (A.wwith === other && !$('#wBox').hidden) { renderWhisper(); return; }
  whisperNote(m);
}
// A whisper while the box is closed: a card at the top with the message and a Reply button.
function whisperNote(m) {
  let el = $('#wNote');
  if (!el) { el = document.createElement('div'); el.id = 'wNote'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.setAttribute('style', rackStyle(m.rc));
  el.innerHTML = `<div class="wn-card"><span class="wn-ico" aria-hidden="true">🤫</span><div class="wn-txt"><b>${esc(m.name)} whispers</b><span>${esc(m.text)}</span></div>
    <button class="btn small go" data-act="whisper" data-pid="${esc(m.from)}">Reply</button><button class="iconbtn" data-act="wnoteclose" aria-label="Close">${ic('close')}</button></div>`;
  el.hidden = false;
  clearTimeout(A.wNoteT); A.wNoteT = setTimeout(() => { el.hidden = true; }, 12000);
}
function openWhisper(to) {
  A.wwith = to;
  const n = $('#wNote'); if (n) n.hidden = true;
  $('#wBox').hidden = false;
  $('#wBox').classList.add('front'); $('#rpsBox').classList.remove('front');
  renderWhisper();
  const i = $('#wBox input'); if (i) i.focus();
}
function closeWhisper() { A.wwith = null; $('#wBox').hidden = true; }
function renderWhisper() {
  const box = $('#wBox'), p = A.S && A.S.players.find(q => q.pid === A.wwith);
  if (!p) { closeWhisper(); return; }
  const old = box.querySelector('input'), draft = old ? old.value : '', focused = old && document.activeElement === old;
  const log = A.wlog.get(p.pid) || [];
  box.innerHTML = `<div class="pophead"><b>🤫 Whisper to <span class="turnchip" style="${rackStyle(p.rc)}">${esc(p.name)}</span></b><button class="iconbtn" data-act="wclose" aria-label="Close">${ic('close')}</button></div>
    <div class="wthread">${log.length ? log.map(x => `<div class="wmsg ${x.mine ? 'mine' : ''}">${esc(x.text)}</div>`).join('') : `<p class="fieldhint">Only ${esc(p.name)} will see what you write here.</p>`}</div>
    ${p.on ? `<form class="wform"><input maxlength="300" autocomplete="off" placeholder="Type a message" aria-label="Message to ${esc(p.name)}"><button class="btn go" type="submit">${ic('arrow')}<span>Send</span></button></form>` : `<p class="fieldhint">${esc(p.name)} has left.</p>`}`;
  const i = box.querySelector('input');
  if (i) { i.value = draft; if (focused) i.focus(); }
  const t = box.querySelector('.wthread'); t.scrollTop = t.scrollHeight;
}
document.addEventListener('submit', e => {
  if (!e.target.closest('#wBox')) return;
  e.preventDefault();
  const i = e.target.querySelector('input'), text = i.value.trim();
  if (!text || !A.wwith) return;
  send({ t: 'whisper', to: A.wwith, text });
  i.value = ''; i.focus();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#wBox').hidden) closeWhisper(); });


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
window.JG.showMJ = showMJ;

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
window.JG.showAlert = showAlert;

// Someone drew a tile (or had to pass): a quick pop-up in their rack colour, for everyone.
let drewT = 0;
function showDrew(a) {
  let el = $('#drewPop');
  if (!el) { el = document.createElement('div'); el.id = 'drewPop'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  const mine = a.pid === pid, who = mine ? 'You' : esc(a.name);
  el.setAttribute('style', rackStyle(a.rc));
  const dom = !!(A.S && A.S.game === 'dominoes'), what = tiles() ? 'tile' : dom ? 'domino' : 'card', n = a.n || 1;
  el.innerHTML = `<div class="dp-card"><span class="dp-tile ${tiles() ? '' : 'card'}">${a.pass ? ic('skip') : '<b>?</b>'}</span>
    <span class="dp-text">${a.pass ? `${who} passed <small>Nothing left to draw</small>` : n > 1 ? `${who} drew ${n} ${dom ? 'dominoes' : what + 's'}` : `${who} drew a ${what}`}</span></div>`;
  el.hidden = false;
  el.classList.remove('play'); el.offsetWidth; el.classList.add('play');
  clearTimeout(drewT); drewT = setTimeout(() => { el.hidden = true; el.classList.remove('play'); }, 2200);
}
window.JG.showDrew = showDrew;

// The card games' bigger moments, in that player's color: a free buy-back, a skip, a +2/+4 stack taken,
// someone down to their last card.
let annT = 0;
function showAnn(a) {
  let el = $('#annPop');
  if (!el) { el = document.createElement('div'); el.id = 'annPop'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  const mine = a.pid === pid;
  const text = mine ? ({ buy: 'You bought back in', skip: 'You are skipped', take: `You take ${a.sub.slice(1)}`, last: 'You have one card left!' }[a.kind] || a.text) : a.text;
  el.className = 'k-' + a.kind;
  el.setAttribute('style', rackStyle(a.rc));
  el.innerHTML = `<div class="an-card"><b class="an-big">${esc(a.sub)}</b><span class="an-text">${esc(text)}</span></div>`;
  el.hidden = false;
  el.classList.remove('play'); el.offsetWidth; el.classList.add('play');
  clearTimeout(annT); annT = setTimeout(() => { el.hidden = true; el.classList.remove('play'); }, 2600);
  const tune = { buy: [523, 659, 784], skip: [440, 330], take: [392, 330, 262], last: [784, 988, 1175] }[a.kind] || [660];
  tune.forEach((f, i) => setTimeout(() => beep(f, 0.15), i * 110));
}
window.JG.showAnn = showAnn;

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
window.JG.showShame = showShame;

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

// The size of the tiles on my rack, from the slider on its edge (remembered on this device). Bigger tiles mean
// fewer slots across; the tiles keep their rows and slide over where they need to.
A.rz = Math.min(1.5, Math.max(0.7, +store.get('rz', 1) || 1));
$('#rack').style.setProperty('--rz', A.rz);
$('#rackSize').value = A.rz;
$('#rackSize').addEventListener('input', e => {
  A.rz = +e.target.value; store.set('rz', A.rz);
  $('#rack').style.setProperty('--rz', A.rz);
  heldCols = 0; A.wide = null;   // a new size is a fresh start for the slot count
  renderRack();
});

// The table always reaches down to the rack: whenever the space above the rack changes height (the rack's size
// slider, a row more or less on the rack, the window), the table is drawn again to fill it.
if (window.ResizeObserver) {
  let lastH = 0, raf = 0;
  new ResizeObserver(() => {
    const h = $('main').clientHeight;
    if (h === lastH) return;
    lastH = h;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => { if (A.S && A.S.phase === 'play' && A.S.game === 'tiles' && !A.drag) renderCenter(); });
  }).observe($('main'));
}

setTrayHooks({ A, rerender: () => { renderCenter(); renderMe(); } });
// the dominoes tray's size (remembered on this device) and Fit (shared with the Number Tiles Fit)
A.dz = Math.min(1.6, Math.max(0.7, +store.get('dz', 1) || 1));
$('#dmSize').addEventListener('input', e => { A.dz = +e.target.value; store.set('dz', A.dz); renderMe(); });
// the size of the Dominoes table (the trains and the octagon)
A.dtz = Math.min(2, Math.max(0.6, +store.get('dtz', 1) || 1));
$('#dmTable').addEventListener('input', e => { A.dtz = +e.target.value; store.set('dtz', A.dtz); renderCenter(); });
const stats = initStats({ A, pid, esc, ic, send });
stats.unlock(true);   // statistics are open to everyone, from Settings
const help = initHelp({ A, pid, send, toast, esc, ic });
$('#statsBtn').addEventListener('click', () => stats.open());
// the lobby's custom color, and the host's "show on the start screen" switch
document.addEventListener('change', e => {
  const t = e.target;
  if (t.matches && t.matches('#center [data-custom]')) {
    const v = t.value.toLowerCase();
    if (isHex(v)) { A.rc = v; saveRc(); send({ t: 'rc', rc: v }); }
    A.lobbyStale = false; t.blur(); renderAll();
  } else if (t.matches && t.matches('[data-listed]')) send({ t: 'listed', on: t.checked });
});
document.addEventListener('focusout', e => { if (A.lobbyStale && e.target.matches && e.target.matches('#center [data-custom]')) { A.lobbyStale = false; setTimeout(renderCenter); } });

/* ---------------- lifetime stats ---------------- */
function renderLife() { $('#lifeBody').innerHTML = lifeTable(A.prof || store.get('prof', ''), esc); }
function showLife(open) { $('#lifeBox').hidden = !open; if (open) { renderLife(); showSettings(false); } }
$('#lifeBtn').addEventListener('click', () => showLife(true));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#lifeBox').hidden) showLife(false); });

/* ---------------- this lobby on the start screen ----------------
   The browser running the referee keeps a short notice up (lobby name, game, how many people): see lobbies.js. */
const notice = lobbyNotice();
function updateNotice() {
  const S = A.S;
  if (!A.net || !A.net.room || !S || S.unlisted) return notice.set(null);
  notice.set(A.code, { game: S.game || null, phase: S.phase === 'play' ? 'play' : 'lobby', n: S.players.filter(q => q.on && !q.cpu).length });
}
setInterval(updateNotice, 30000);
setupJoin();
