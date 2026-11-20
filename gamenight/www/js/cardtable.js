// What Idiot, Hearts and Dominoes look like: the table in the middle, my cards (or tiles) along the bottom, and
// the buttons. Everything here only draws; taps are turned into moves in main.js (see tableTap) and go to the
// referee as { t: 'g', a: ... } (idiot.js, hearts.js, dominoes.js).
import { pcard } from './cardview.js';
import { rankOf, suitOf } from './bj.js';
import { canPlay, source, val } from './idiot.js';
import { legal as heartsLegal, high, points, sortHand, PASS_NAMES, HEARTS } from './hearts.js';
import { TILES, moves as trainMoves, endOf, communityKeys } from './dominoes.js';

const seatedOf = S => S.players.filter(p => p.seat);
const meOf = (S, pid) => S.players.find(p => p.pid === pid);
const nameChip = (x, p, extra = '') => `<span class="turnchip" style="${x.rackStyle(p.rc)}">${p.cpu ? x.ic('bot') : ''}${x.esc(p.name)}${extra}</span>`;
function waitChip(x) {
  const { A, pid, esc, ic, rackStyle } = x, S = A.S;
  const c = S.players.find(p => p.pid === S.turn);
  if (!c) return '';
  return `<span class="turnchip" style="${rackStyle(c.rc)}">${c.cpu ? ic('bot') : ''}${c.pid === pid ? 'Your turn' : esc(c.name)}</span>${!c.on ? `<button class="btn" data-act="skip">${ic('skip')}Skip</button>` : ''}`;
}
const ord = n => n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th');

// my cards along the bottom (the same fan as Color Clash)
function fan(el, cards) {
  el.style.setProperty('--n', cards.length);
  el.classList.add('pfan');
  el.innerHTML = cards.join('');
}

/* ---------------- Idiot ---------------- */

export function renderIdiot(box, x) {
  const { A, pid, esc, rackStyle, ic } = x, S = A.S, g = S.id;
  if (!g) { box.innerHTML = ''; return; }
  const me = meOf(S, pid), myTurn = S.turn === pid && g.stage === 'play';
  const src = me && me.seat ? source(g, me) : null;
  const sel = A.isel || new Set();
  const top = g.pile.slice(-4);
  const spot = p => {
    const mine = p.pid === pid, up = g.up[p.pid] || [], down = g.down[p.pid] || [];
    const slots = [0, 1, 2].map(i => {
      const u = up[i], d = i < down.length;
      let inner = d ? `<span class="idown">${pcard(null)}</span>` : '<span class="idown empty"></span>';
      // my face-down cards: tap one, blind, once hand and face-up cards are gone
      if (mine && myTurn && src === 'down' && d && u == null) inner = `<button class="idown pick" data-act="idown" data-i="${i}" aria-label="Face-down card ${i + 1}">${pcard(null)}</button>`;
      if (u != null) {
        const can = mine && ((g.stage === 'swap' && !g.ready[pid]) || (myTurn && src === 'up' && canPlay(g, u)));
        const cls = [sel.has(u) ? 'sel' : '', mine && g.stage === 'swap' && A.iswap != null ? 'swapto' : '', can ? 'ok' : ''].join(' ');
        inner += can ? `<button class="iup" data-act="iup" data-id="${u}">${pcard(u, cls)}</button>` : `<span class="iup">${pcard(u, cls)}</span>`;
      }
      return `<span class="islot">${inner}</span>`;
    }).join('');
    const place = g.out.indexOf(p.pid);
    const tag = place >= 0 ? `<b class="ct-tag out">${ord(place + 1)} out</b>`
      : g.stage === 'swap' ? (g.ready[p.pid] ? `<b class="ct-tag ok">${ic('check')}Ready</b>` : '<b class="ct-tag">Swapping…</b>')
      : `<b class="ct-tag">${ic('cards')}${p.hand.length}</b>`;
    return `<div class="ct-spot ${S.turn === p.pid && g.stage === 'play' ? 'cur' : ''} ${mine ? 'mine' : ''}" style="${rackStyle(p.rc)}">
      <div class="ct-name"><span>${esc(p.name)}</span>${tag}</div><div class="islots">${slots}</div></div>`;
  };
  let info;
  if (g.stage === 'swap') info = me && me.seat && !g.ready[pid] ? 'Swap: tap a card in your hand, then one of your face-up cards. Then press Ready.' : 'Waiting for everyone to swap…';
  else {
    const c = meOf(S, S.turn);
    info = c ? (c.pid === pid ? (src === 'down' ? 'Your turn: pick a face-down card' : 'Your turn') : `${esc(c.name)}'s turn`) : '';
  }
  const last = g.last && meOf(S, g.last.pid);
  box.innerHTML = `<div class="ct-table idiot">
    <div class="ct-mid">
      <div class="ct-deck">${g.deck.length ? pcard(null) : '<div class="pc ghostcard back"></div>'}<span class="cc-count">${g.deck.length}</span></div>
      <div class="ct-pile">${top.length ? top.map((id, i) => pcard(id, `p${top.length - 1 - i} ${i === top.length - 1 && g.last && g.last.k > (A.idSeen || 0) ? 'landed' : ''}`)).join('') : '<span class="ct-empty">Empty pile<small>anything goes</small></span>'}
        ${g.pile.length ? `<span class="cc-count">${g.pile.length}</span>` : ''}${last && g.pile.length ? `<span class="cc-by" style="${rackStyle(last.rc)}">${esc(last.name)}</span>` : ''}</div>
      ${g.burned ? `<div class="ct-burn" title="Cards burned">🔥 ${g.burned}</div>` : ''}
    </div>
    <div class="bj-info">${info}</div>
    <div class="ct-spots">${seatedOf(S).map(spot).join('')}</div>
  </div>`;
  A.idSeen = g.last ? g.last.k : 0;
}

export function idiotHand(el, x) {
  const { A, pid } = x, S = A.S, g = S.id, m = meOf(S, pid);
  if (!g || !m || !m.seat) { el.innerHTML = ''; return; }
  const myTurn = S.turn === pid && g.stage === 'play' && source(g, m) === 'hand';
  const sel = A.isel || new Set();
  const cards = m.hand.slice().sort((a, b) => val(a) - val(b) || a - b).map(id => {
    const swap = g.stage === 'swap' && !g.ready[pid];
    const ok = swap || (myTurn && canPlay(g, id));
    const cls = [ok ? 'ok' : (myTurn ? 'no' : ''), sel.has(id) || A.iswap === id ? 'sel' : ''].join(' ');
    return `<button class="pcbtn" data-act="${ok ? 'ihand' : ''}" data-id="${id}">${pcard(id, cls)}</button>`;
  });
  fan(el, cards);
}

export function idiotControls(x) {
  const { A, pid, ic } = x, S = A.S, g = S.id, m = meOf(S, pid);
  if (!g) return '';
  if (!m || !m.seat) return `${waitChip(x)}<span class="poolchip">Watching this game</span>`;
  if (g.out.includes(pid)) return `${waitChip(x)}<span class="poolchip">You're out!</span>`;
  if (g.stage === 'swap') return g.ready[pid] ? '<span class="poolchip">Waiting for everyone…</span>' : `<button class="btn go" data-act="g:ready">${ic('check')}Ready</button>`;
  if (S.turn !== pid) return waitChip(x);
  const n = (A.isel || new Set()).size, src = source(g, m);
  return `<span class="turnchip" style="${x.rackStyle(m.rc)}">Your turn</span>
    ${src !== 'down' ? `<button class="btn go" data-act="iplay" ${n ? '' : 'disabled'}>${ic('check')}Play${n > 1 ? ` ${n}` : ''}</button>` : ''}
    <button class="btn draw" data-act="g:take" ${g.pile.length ? '' : 'disabled'}>${ic('draw')}Pick up ${g.pile.length}</button>`;
}

/* ---------------- Hearts ---------------- */

const SUIT_SYM = ['♠', '♥', '♦', '♣'];
export function renderHearts(box, x) {
  const { A, pid, esc, rackStyle, ic } = x, S = A.S, h = S.hr;
  if (!h) { box.innerHTML = ''; return; }
  const seats = seatedOf(S), n = seats.length;
  const mi = Math.max(0, seats.findIndex(p => p.pid === pid));
  // where each player sits around the trick, from my side: me at the bottom
  const posOf = p => { const k = (seats.indexOf(p) - mi + n) % n; return n === 4 ? ['s', 'w', 'n', 'e'][k] : ['s', 'w', 'e'][k]; };
  let winPid = null;
  if (h.stage === 'trick' && h.trick.length) {
    const suit = suitOf(h.trick[0].id);
    winPid = h.trick.filter(t => suitOf(t.id) === suit).sort((a, b) => high(b.id) - high(a.id))[0].pid;
  }
  const trick = h.trick.map(t => { const p = meOf(S, t.pid); return `<div class="ht-card ${posOf(p)} ${t.pid === winPid ? 'win' : ''}">${pcard(t.id)}</div>`; }).join('');
  const label = p => {
    const pts = (h.taken[p.pid] || []).reduce((s, id) => s + points(id), 0);
    return `<div class="ht-name ${posOf(p)} ${S.turn === p.pid ? 'cur' : ''}" style="${rackStyle(p.rc)}"><span>${p.cpu ? ic('bot') : ''}${esc(p.name)}</span><b title="Score">${h.scores[p.pid] || 0}</b>${pts ? `<i title="Points taken this hand">+${pts}</i>` : ''}</div>`;
  };
  let info = '';
  if (h.stage === 'pass') {
    const me = seats.indexOf(meOf(S, pid));
    const to = me >= 0 ? seats[(((me + h.dir) % n) + n) % n] : null;
    info = me < 0 ? `Passing ${PASS_NAMES[h.dir]}…` : h.passed[pid] ? 'Waiting for everyone to pass…' : `Pick 3 cards to pass ${PASS_NAMES[h.dir]}${to ? ` to ${esc(to.name)}` : ''}`;
  } else if (h.stage === 'scored') {
    info = 'Hand over: ' + seats.map(p => `${esc(p.name)} +${h.handPts[p.pid]}`).join(' · ');
  } else if (h.stage === 'trick') {
    const w = meOf(S, winPid); info = w ? `${w.pid === pid ? 'You take' : esc(w.name) + ' takes'} the trick` : '';
  } else {
    const c = meOf(S, S.turn); info = c ? (c.pid === pid ? 'Your turn' : `${esc(c.name)}'s turn`) : '';
  }
  box.innerHTML = `<div class="ct-table hearts">
    <div class="ht-felt n${n}">${seats.map(label).join('')}<div class="ht-trick">${trick}</div>
      <div class="ht-broken ${h.broken ? 'on' : ''}" title="${h.broken ? 'Hearts are broken' : 'Hearts not broken yet'}">♥</div></div>
    <div class="bj-info">${info}</div>
    <div class="ht-rule">Game ends at ${h.cfg.to} · Lowest score wins</div>
  </div>`;
}

export function heartsHand(el, x) {
  const { A, pid } = x, S = A.S, h = S.hr, m = meOf(S, pid);
  if (!h || !m || !m.seat) { el.innerHTML = ''; return; }
  const passing = h.stage === 'pass' && !h.passed[pid];
  const myTurn = h.stage === 'play' && S.turn === pid;
  const ok = new Set(myTurn ? heartsLegal(h, m.hand) : []);
  const sel = A.hsel || new Set();
  const got = new Set(h.tricks === 0 && h.got ? h.got[pid] || [] : []);
  const cards = sortHand(m.hand).map(id => {
    const can = passing || ok.has(id);
    const cls = [can ? 'ok' : myTurn ? 'no' : '', sel.has(id) ? 'sel' : '', got.has(id) ? 'got' : ''].join(' ');
    return `<button class="pcbtn" data-act="${can ? 'hcard' : ''}" data-id="${id}">${pcard(id, cls)}</button>`;
  });
  fan(el, cards);
}

export function heartsControls(x) {
  const { A, pid, ic } = x, S = A.S, h = S.hr, m = meOf(S, pid);
  if (!h) return '';
  if (!m || !m.seat) return `${waitChip(x)}<span class="poolchip">Watching this game</span>`;
  if (h.stage === 'pass') {
    if (h.passed[pid]) return '<span class="poolchip">Waiting for everyone to pass…</span>';
    const n = (A.hsel || new Set()).size;
    return `<button class="btn go" data-act="hpass" ${n === 3 ? '' : 'disabled'}>${ic('arrow')}Pass ${n === 3 ? '3 cards' : `(${n} of 3)`}</button>`;
  }
  if (h.stage !== 'play') return `<span class="poolchip">Your score: <b>${h.scores[pid] || 0}</b></span>`;
  return `${waitChip(x)}<span class="poolchip">Score <b>${h.scores[pid] || 0}</b></span>`;
}

/* ---------------- Dominoes (Mexican Train rules) ---------------- */

// A double-twelve color-dot set, like the family's Cardinal box: each number has its own pip color and layout.
// Pip positions are [x, y] in percent of the half (three columns; three rows up to 9, four rows above that).
const L = 25, M = 50, R = 75, T = 25, C = 50, B = 75;   // even margins
// 10-12 use a square 4-row grid (same span both ways), kept clear of the bar between the halves
const L4 = 20, R4 = 80, Y4 = [20, 40, 60, 80];
const PIPS = [
  [],
  [[M, C]],
  [[R, T], [L, B]],
  [[R, T], [M, C], [L, B]],
  [[L, T], [R, T], [L, B], [R, B]],
  [[L, T], [R, T], [M, C], [L, B], [R, B]],
  [[L, T], [L, C], [L, B], [R, T], [R, C], [R, B]],
  [[L, T], [L, C], [L, B], [R, T], [R, C], [R, B], [M, C]],
  [[L, T], [M, T], [R, T], [L, C], [R, C], [L, B], [M, B], [R, B]],
  [[L, T], [M, T], [R, T], [L, C], [M, C], [R, C], [L, B], [M, B], [R, B]],
  [...Y4.map(y => [L4, y]), ...Y4.map(y => [R4, y]), [M, 20], [M, 80]],
  [...Y4.map(y => [L4, y]), ...Y4.map(y => [R4, y]), [M, 20], [M, 50], [M, 80]],
  [...Y4.map(y => [L4, y]), ...Y4.map(y => [M, y]), ...Y4.map(y => [R4, y])],
];
const half = n => `<span class="dh n${n}"><span class="pp">${PIPS[n].map(([x, y]) => `<i style="left:${x}%;top:${y}%"></i>`).join('')}</span></span>`;
export const domino = (a, b, cls = '') => `<span class="dm ${cls}" role="img" aria-label="${a} and ${b}">${half(a)}${half(b)}</span>`;

// The little toy locomotives that mark the community trains (one color each), and the penny that marks a
// player's train when they couldn't play.
export const TOY_COLORS = ['#d62a2a', '#3a8de0', '#f5c518', '#3dcc8c', '#b8399f', '#f59a1a', '#f58fb5', '#6b3a22', '#f4efe2'];
export const toyTrain = (color, cls = '') => `<svg class="toy ${cls}" viewBox="0 0 40 30" style="--tc:${color}" aria-hidden="true">
  <g class="tb"><rect x="3" y="4" width="13" height="18" rx="2"/><rect x="1" y="2" width="17" height="3.5" rx="1.2"/><rect x="14" y="11" width="22" height="11" rx="3"/>
  <rect x="28" y="4" width="5" height="8" rx="1"/><rect x="26.5" y="2.5" width="8" height="3" rx="1.2"/><rect x="1" y="20" width="37" height="3.5" rx="1.2"/></g>
  <rect x="6" y="8" width="7" height="6" rx="1" fill="rgba(255,255,255,.6)"/>
  <g class="tw"><circle cx="9" cy="25" r="4"/><circle cx="20" cy="25" r="4"/><circle cx="31" cy="25" r="4"/></g>
  <rect x="16" y="13" width="18" height="2.5" rx="1" fill="rgba(255,255,255,.35)"/></svg>`;
export const penny = (title = '') => `<span class="penny" title="${title}" aria-label="${title}">1¢</span>`;

// Where the trains go: like the real station hub, a black octagon with eight sides. My own train always takes the
// side facing down toward my tiles; everyone else's takes the free side nearest their face on screen; community trains take the free sides, and any more go in between two
// sides, starting a little further out.
const SIDES = 8, STEP = 2 * Math.PI / SIDES;
const angDiff = (a, b) => { let x = Math.abs(a - b) % (2 * Math.PI); return x > Math.PI ? 2 * Math.PI - x : x; };
function placeTrains(players, nCommunity, hubRect, faceOf, mine) {
  const cx = hubRect.left + hubRect.width / 2, cy = hubRect.top + hubRect.height / 2;
  const want = players.map((p, i) => {
    const r = faceOf(p);
    return { key: p.pid, a: r ? Math.atan2(r.top + r.height / 2 - cy, r.left + r.width / 2 - cx) : -Math.PI / 2 + i * STEP };
  });
  const slots = Array.from({ length: SIDES }, (_, k) => k * STEP), taken = new Set(), out = {};
  // my own train always heads straight down, toward my tiles
  const DOWN = SIDES / 4;
  if (mine && want.some(w => w.key === mine)) { out[mine] = { a: slots[DOWN], extra: false }; taken.add(DOWN); }
  // players first: the closest free side, the nearest pairs settled first
  const pairs = [];
  want.forEach(w => slots.forEach((s, k) => pairs.push({ w, k, d: angDiff(w.a, s) })));
  pairs.sort((x, y) => x.d - y.d);
  for (const { w, k } of pairs) if (!out[w.key] && !taken.has(k)) { out[w.key] = { a: slots[k], extra: false }; taken.add(k); }
  // players beyond eight (only with 9+, which can't happen) would fall through to the in-between spots below
  // community trains take the free sides furthest from the players' trains first
  const dist = k => (taken.size ? Math.min(...[...taken].map(t => angDiff(slots[k], slots[t]))) : 0);
  const free = slots.map((s, k) => k).filter(k => !taken.has(k)).sort((x, y) => dist(y) - dist(x));
  const between = Array.from({ length: SIDES }, (_, k) => k * STEP + STEP / 2);
  for (let i = 0; i < nCommunity; i++) {
    if (i < free.length) out['c' + i] = { a: slots[free[i]], extra: false };
    else out['c' + i] = { a: between[(i - free.length) * 3 % SIDES], extra: true };   // spread round the hub
  }
  return out;
}

// A double laid on a train (waiting for Confirm) may have the tile that covers it laid after it, and Confirm plays
// both. These are the tiles that may cover it now: none for any other tile, once a cover is laid, or when the double
// starts someone else's empty train (that ends the turn).
function coverIds(A, d, m) {
  const pd = A.pending;
  if (!pd || pd.cover != null || TILES[pd.id][0] !== TILES[pd.id][1]) return [];
  const t = d.trains[pd.train];
  if (t && !t.community && pd.train !== m.pid && !t.tiles.length) return [];
  const n = TILES[pd.id][0];
  return m.hand.filter(id => id !== pd.id && (TILES[id][0] === n || TILES[id][1] === n));
}

export function renderDominoes(box, x) {
  const { A, pid, esc, rackStyle, rackOf } = x, S = A.S, d = S.dm;
  if (!d) { box.innerHTML = ''; return; }
  const me = meOf(S, pid), myTurn = d.stage === 'play' && S.turn === pid && me;
  const mvs = myTurn ? trainMoves(d, me) : [];
  // a tile dropped on a train waits there for Confirm (only while it can still go there)
  if (A.pending && !(myTurn && mvs.some(mv => mv.id === A.pending.id && mv.train === A.pending.train))) A.pending = null;
  if (A.pending && A.pending.cover != null && !me.hand.includes(A.pending.cover)) A.pending.cover = null;
  const cov = myTurn ? coverIds(A, d, me) : [];
  // where the chosen tile may go: once a tile is laid, nowhere else, except a double's cover on that double
  const where = new Set(A.pending ? (cov.includes(A.dsel) ? [A.pending.train] : []) : mvs.filter(m => m.id === A.dsel).map(m => m.train));
  const fresh = d.last && d.last.k > (A.dmSeen || 0) ? d.last.id : null;
  const seats = seatedOf(S), comm = communityKeys(d);
  const ghost = where.has('new') || !!(A.pending && A.pending.train === 'new');   // the chosen tile could start a new community train
  let info;
  if (d.stage === 'scored') info = 'Round over: ' + seats.map(p => `${esc(p.name)} +${d.roundPts[p.pid]}`).join(' · ');
  else if (!myTurn) { const c = meOf(S, S.turn); info = c ? `${esc(c.name)}'s turn` : ''; }
  else if (d.turn.cover) info = 'Cover your double!';
  else if (d.open) info = 'Cover the open double first';
  else if (!d.first[pid]) info = 'First turn: start your own train';
  else {
    // someone couldn't start their own train (it has a penny and nothing on it): I may start it for them, as my turn
    const stuck = seats.filter(p => p.pid !== pid && d.trains[p.pid] && d.trains[p.pid].marker && !d.trains[p.pid].tiles.length && mvs.some(m => m.train === p.pid));
    info = A.pending ? (cov.length ? 'Now cover your double, then Confirm' : 'Play it there? Confirm or Cancel')
      : A.dsel != null && where.size > 1 ? 'Tap the end of a train, or drag the domino onto it'
      : stuck.length ? `Your turn · You can start ${stuck.map(p => esc(p.name)).join(' or ')}'s train for them (it uses your turn)`
      : 'Your turn';
  }

  // the table: as big as the middle of the screen allows, with room for the line above and the scores below
  const main = box.parentElement, cs = getComputedStyle(main);
  const ctl = document.getElementById('controls'), ctlH = ctl && ctl.offsetHeight ? ctl.offsetHeight + 10 : 60;
  // the table size slider (A.dtz) grows or shrinks the whole table; bigger than the screen, it scrolls
  const TZ = A.dtz || 1;
  const W = Math.round(Math.max(280, main.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 6) * TZ);
  const H = Math.round(Math.max(170, main.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - ctlH - 56) * TZ);
  box.innerHTML = `<div class="ct-table mtrain">
    <div class="mt-head"><span class="bj-info">${info}</span><span class="mt-round">Round ${Math.min(d.roundNo + (d.stage === 'scored' ? 0 : 1), d.rounds)} of ${d.rounds} · Draw pile ${d.bone.length}</span></div>
    <div class="mt-hub" style="width:${W}px;height:${H}px"></div>
  </div>`;
  const hub = box.querySelector('.mt-hub'), hr = hub.getBoundingClientRect();
  const faceOf = p => { const el = document.querySelector(`.seat[data-pid="${CSS.escape(p.pid)}"] .face`); const r = el && el.getBoundingClientRect(); return r && r.width ? r : null; };
  const nComm = comm.length + (ghost ? 1 : 0);
  const place = placeTrains(seats, nComm, hr, faceOf, me && me.seat ? pid : null);
  const cx = W / 2, cy = H / 2;
  const keys = [...seats.map(p => p.pid), ...comm, ...(ghost ? ['new'] : [])];
  const posOf = k => place[k === 'new' ? 'c' + comm.length : k] || { a: 0, extra: true };
  /* Each train runs straight out from its side of the octagon. Only its last three tiles' worth shows (a double,
     laid across, counts as half a tile); older tiles slide back under the octagon. So every train has the same
     most room it can need, and one tile size shows all of them on every screen. */
  const SHOW = 6;                                     // in half-tiles: three whole tiles
  const cellOf = dw => dw * 1.06 + 1.5;
  const r0For = (pos, dw) => (pos.extra ? dw * 4.5 : dw * 2.6 - 2);   // in-between trains start further out
  // the pieces of a train, out from the hub: (the last tile gone under the octagon,) the tiles still showing,
  // a tile waiting for Confirm (and a double's cover), then the open end
  function piecesOf(key) {
    const t = d.trains[key], tiles = t ? t.tiles : [];
    const all = tiles.map(tl => ({ kind: 'tile', tid: tl.id, tl, cells: tl.a === tl.b ? 1 : 2, dbl: tl.a === tl.b }));
    let e = endOf(d, key);
    if (A.pending && A.pending.train === key && myTurn) for (const id of [A.pending.id, A.pending.cover]) {
      if (id == null) continue;
      let [pa, pb] = TILES[id];
      if (pa !== e) [pa, pb] = [pb, pa];
      all.push({ kind: 'pend', tid: id, ab: [pa, pb], cells: pa === pb ? 1 : 2, dbl: pa === pb });
      e = pb;
    }
    let from = all.length, used = 0;
    while (from > 0 && used + all[from - 1].cells <= SHOW) used += all[--from].cells;
    const list = from > 0 ? [{ ...all[from - 1], gone: true }] : [];
    return [...list, ...all.slice(from), { kind: 'end', cells: 1, n: e }];
  }
  const layout = (key, dw) => {
    const cell = cellOf(dw), r0 = r0For(posOf(key), dw);
    let x = r0;
    return piecesOf(key).map(p => {
      if (p.gone) return { ...p, x: r0 - cell * p.cells / 2, y: 0, rot: 0 };   // just under the octagon's edge
      const it = { ...p, x: x + cell * p.cells / 2, y: 0, rot: 0 };
      x += cell * p.cells;
      return it;
    });
  };
  // the biggest tiles that let every train, at its longest, stay on the table
  const fits = dw => keys.every(k => {
    const pos = posOf(k), R = r0For(pos, dw) + cellOf(dw) * (SHOW + 1), w = dw * 1.15, pad = 4;
    const c = Math.cos(pos.a), sn = Math.sin(pos.a);
    return Math.abs(R * c) + w * Math.abs(sn) <= W / 2 - pad && Math.abs(R * sn) + w * Math.abs(c) <= H / 2 - pad;
  });
  let dw = Math.round(28 * (A.zoom || 1) * TZ);
  while (dw > 7 && !fits(dw)) dw--;
  const lays = {};
  for (const k of keys) lays[k] = layout(k, dw);
  // the octagon: its flat sides face the eight trains; the engine lies in a slot in the middle
  const ap = dw * 2.6;                                             // centre to the middle of a side
  const rv = ap / Math.cos(Math.PI / SIDES);                       // centre to a corner
  const oct = Array.from({ length: SIDES }, (_, k) => { const a = k * STEP + STEP / 2; return `${(cx + rv * Math.cos(a)).toFixed(1)},${(cy + rv * Math.sin(a)).toFixed(1)}`; }).join(' ');
  // the slot the engine lies in: a hole a little bigger than a domino, so the felt shows round it
  const ew = Math.round(dw * 1.05), sw = ew * 2.12 + 8, sh = ew * 1.12 + 8, sr = Math.min(6, sh / 4);
  const sx = cx - sw / 2, sy = cy - sh / 2;
  const slot = `M${sx + sr},${sy} h${sw - 2 * sr} a${sr},${sr} 0 0 1 ${sr},${sr} v${sh - 2 * sr} a${sr},${sr} 0 0 1 -${sr},${sr} h-${sw - 2 * sr} a${sr},${sr} 0 0 1 -${sr},-${sr} v-${sh - 2 * sr} a${sr},${sr} 0 0 1 ${sr},-${sr} z`;
  const marks = [];   // the toy trains and pennies, laid on top of the octagon
  const spoke = key => {
    const pos = posOf(key), t = d.trains[key], who = meOf(S, key), isComm = key === 'new' || (t && t.community);
    const color = isComm ? TOY_COLORS[(key === 'new' ? comm.length : t.n) % TOY_COLORS.length] : '#888';
    const deg = pos.a * 180 / Math.PI;
    const can = where.has(key), end = endOf(d, key);
    const label = isComm ? (key === 'new' ? 'Start a community train here' : 'Community train') : `${who ? (who.pid === pid ? 'your' : esc(who.name) + "'s") : ''} train`;
    const pieces = lays[key];
    // --rot: how far the piece ends up turned on screen, so a tile's shading can stay lit from the top
    const at = (p, inner, cls = '', upright = false) => `<span class="mt-it ${cls}" style="left:${p.x.toFixed(1)}px;top:${p.y.toFixed(1)}px;transform:translate(-50%, -50%) rotate(${upright ? -deg : p.rot}deg);--rot:${upright ? 0 : (deg + p.rot).toFixed(1)}deg">${inner}</span>`;
    let html = '';
    pieces.forEach(p => {
      const tag = p.tid != null ? `mt-t" data-tid="${p.tid}` : '';
      if (p.gone) { if (!pos.extra) html += at(p, domino(p.ab ? p.ab[0] : p.tl.a, p.ab ? p.ab[1] : p.tl.b, p.dbl ? 'dbl' : 'h'), `mt-under ${tag}`); }
      else if (p.kind === 'tile') html += at(p, domino(p.tl.a, p.tl.b, `${p.tl.a === p.tl.b ? 'dbl' : 'h'} ${p.tl.id === fresh ? 'landed' : ''}`), tag);
      else if (p.kind === 'pend') html += at(p, domino(p.ab[0], p.ab[1], `${p.ab[0] === p.ab[1] ? 'dbl' : 'h'} pending`), tag);
      else html += at(p, `<button class="dm-end ${can ? 'on' : ''}" data-act="dmtrain" data-train="${esc(key)}" data-n="${p.n}" ${can ? '' : 'disabled'} aria-label="Play on ${label} (open end ${p.n})" title="${label}"><span class="dm endpip">${half(p.n)}</span></button>`, '', true);
    });
    // the marker sits on the first piece, by the hub (as on the real table)
    const first = pieces.find(p => !p.gone);
    const mark = isComm ? toyTrain(color) : t && t.marker ? penny(`${esc(who ? who.name : '')} couldn't play: anyone may play here`) : '';
    // at the very start of the train, sitting on the octagon's edge: drawn in a layer above the octagon
    if (mark && first) {
      const mx = Math.min(first.x, r0For(pos, dw) - dw * 0.15);
      marks.push(`<span class="mt-mk2${key === 'new' ? ' ghostmk' : ''}" style="left:${(cx + mx * Math.cos(pos.a)).toFixed(1)}px;top:${(cy + mx * Math.sin(pos.a)).toFixed(1)}px;--dw:${dw}px">${mark}</span>`);
    }
    if (d.open === key && pieces.length) html += at(pieces[pieces.length - 1], '<b class="mt-opendbl">Cover!</b>', 'mt-flag', true);
    // still lit while a laid double waits for its cover; any other laid tile ends the choosing
    const pend = pieces.some(p => p.kind === 'pend' && !p.gone) && cov.length;
    return `<div data-key="${esc(key)}" class="mt-spoke ${pend ? 'dropok' : ''} ${d.open === key ? 'open' : ''} ${key === 'new' ? 'mt-new' : ''} ${isComm ? 'comm' : ''}"
      style="--dw:${dw}px;transform:translate(${cx}px, ${cy}px) rotate(${deg}deg)">${html}</div>`;
  };
  hub.innerHTML = keys.map(spoke).join('')
    + `<div class="mt-mks">${marks.join('')}</div>`
    + `<svg class="mt-station" width="${W}" height="${H}" aria-hidden="true"><path fill-rule="evenodd" d="M${oct.replace(/ /g, ' L')} Z ${slot}"/></svg>`
    + `<div class="mt-engine" style="left:${cx}px;top:${cy}px;--dw:${ew}px" title="The engine: double ${d.engine}">${domino(d.engine, d.engine, 'h')}</div>`;
  A.dmSeen = d.last ? d.last.k : 0;
  // a tile that moved along its train (pushed back under the octagon) slides there rather than jumping
  if (A.dmDw === dw) hub.querySelectorAll('.mt-t').forEach(el => {
    const was = A.dmAt && A.dmAt[el.dataset.tid];
    const now = [parseFloat(el.style.left), parseFloat(el.style.top)];
    if (was && el.parentElement.dataset.key === was[2] && (Math.abs(was[0] - now[0]) > 1 || Math.abs(was[1] - now[1]) > 1) && el.animate)
      el.animate([{ left: was[0] + 'px', top: was[1] + 'px', opacity: 1 }, { left: now[0] + 'px', top: now[1] + 'px', opacity: el.classList.contains('mt-under') ? 0 : 1 }], { duration: 450, easing: 'cubic-bezier(.3, .7, .3, 1)' });
  });
  A.dmDw = dw; A.dmAt = {};
  hub.querySelectorAll('.mt-t').forEach(el => { A.dmAt[el.dataset.tid] = [parseFloat(el.style.left), parseFloat(el.style.top), el.parentElement.dataset.key]; });
}

/* My tiles: a tray like the Number Tiles rack. Rows of slots, gaps allowed. Drag a tile anywhere (dropping on a
   tile slides it and its neighbours aside), double-tap or press Flip to turn it end for end, so trains can be
   laid out in the hand to plan ahead. Only I see the layout; it is kept on this device for the round.
   Dragging a tile onto a train it fits shows it there, to be played with Confirm (or put back with Cancel). */
let trayHooks = { rerender: () => {} };
export function setTrayHooks(h) { trayHooks = h; }
const trayKey = A => 'jg-tray-' + (A.code || '');
function loadTray(A) { try { return JSON.parse(sessionStorage.getItem(trayKey(A))); } catch (e) { return null; } }
function saveTray(A) { try { sessionStorage.setItem(trayKey(A), JSON.stringify(A.tray)); } catch (e) { /* private window */ } }

// Make the tray hold exactly my tiles: tiles keep their slots, played ones leave a gap, new ones (dealt or
// drawn) go into the first empty slot. A new round starts a fresh tray.
function fitTray(A, d, hand, cols) {
  const round = `${A.S.round}:${d.roundNo}`;
  let t = A.tray || loadTray(A);
  if (!t || t.round !== round) t = { round, cols, rows: [], flip: {} };
  if (t.cols !== cols) {   // the screen changed width: same order, new rows
    const ids = t.rows.flat().filter(id => id != null);
    t = { round, cols, rows: [], flip: t.flip };
    ids.forEach((id, i) => { const r = Math.floor(i / cols); (t.rows[r] = t.rows[r] || Array(cols).fill(null))[i % cols] = id; });
  }
  const mine = new Set(hand);
  t.rows = t.rows.map(row => row.map(id => (id != null && mine.has(id) ? id : null)));
  const placed = new Set(t.rows.flat());
  for (const id of hand) {
    if (placed.has(id)) continue;
    let done = false;
    for (const row of t.rows) { const c = row.indexOf(null); if (c >= 0) { row[c] = id; done = true; break; } }
    if (!done) { const row = Array(cols).fill(null); row[0] = id; t.rows.push(row); }
  }
  // always a spare row to lay things out in
  while (t.rows.length < 2 || t.rows[t.rows.length - 1].some(id => id != null)) t.rows.push(Array(cols).fill(null));
  while (t.rows.length > 2 && t.rows[t.rows.length - 1].every(id => id == null) && t.rows[t.rows.length - 2].every(id => id == null)) t.rows.pop();
  for (const k in t.flip) if (!mine.has(+k)) delete t.flip[k];
  A.tray = t; saveTray(A);
  return t;
}

export function dominoHand(el, x) {
  const { A, pid } = x, S = A.S, d = S.dm, m = meOf(S, pid);
  if (!d || !m || !m.seat) { el.innerHTML = ''; return; }
  if (trayDrag) { el.classList.add('dmhand', 'tray'); return; }   // not while a tile is being carried
  const myTurn = d.stage === 'play' && S.turn === pid;
  if (A.pending && !(myTurn && m.hand.includes(A.pending.id))) A.pending = null;
  const cov = myTurn ? coverIds(A, d, m) : [];
  A.dcover = cov;   // for the drag
  // what may be played lights up: once a tile is laid, only the tiles that may cover a laid double
  const ok = new Set(!myTurn ? [] : A.pending ? cov : trainMoves(d, m).map(mv => mv.id));
  if (A.dsel != null && !m.hand.includes(A.dsel)) A.dsel = null;
  el.classList.add('dmhand', 'tray');
  const width = el.clientWidth || el.parentElement.clientWidth || 600;
  const k = (A.zoom || 1) * (A.dz || 1);   // text size, and the tray's own size slider
  const cols = Math.max(4, Math.min(14, Math.floor((width - 16) / (64 * k))));
  const dw = Math.max(14, Math.min(30 * k, Math.floor(((width - 16) / cols - 8) / 2.2)));
  // a tile laid on a train (waiting for Confirm) or just sent to be played has left the hand: its slot shows empty
  const gone = new Set([A.pending && A.pending.id, A.pending && A.pending.cover, ...(A.dsent || [])].filter(id => id != null));
  const t = fitTray(A, d, m.hand, cols);
  el.style.setProperty('--tdw', dw + 'px');
  el.innerHTML = t.rows.map((row, r) => `<div class="trow">${row.map((id, c) => {
    if (id == null || gone.has(id)) return `<span class="tslot" data-r="${r}" data-c="${c}"></span>`;
    const [a, b] = TILES[id], f = t.flip[id];
    const cls = [ok.has(id) ? 'ok' : myTurn ? 'no' : '', A.dsel === id ? 'sel' : ''].join(' ');
    return `<span class="tslot" data-r="${r}" data-c="${c}"><button class="ttile ${cls}" data-act="dmtile" data-id="${id}" aria-label="${f ? b : a} and ${f ? a : b}${ok.has(id) ? ', can be played' : ''}">${domino(f ? b : a, f ? a : b, 'h')}</button></span>`;
  }).join('')}</div>`).join('');
}

function flipTile(A, id) {
  if (!A.tray) return;
  A.tray.flip[id] = !A.tray.flip[id];
  saveTray(A);
}

// Put a tile into slot (r, c). If a tile is there, it and its neighbours slide right to the next gap in that row
// (or left, if there is none to the right); a full row just swaps the two.
function trayDrop(A, id, r, c) {
  const rows = A.tray.rows;
  let fr = -1, fc = -1;
  rows.forEach((row, i) => { const j = row.indexOf(id); if (j >= 0) { fr = i; fc = j; } });
  if (fr < 0 || !rows[r]) return;
  if (fr === r && fc === c) return;
  rows[fr][fc] = null;
  const row = rows[r];
  if (row[c] != null) {
    let g = row.indexOf(null, c);
    if (g >= 0) { for (let k = g; k > c; k--) row[k] = row[k - 1]; }
    else {
      g = row.lastIndexOf(null, c);
      if (g >= 0) { for (let k = g; k < c; k++) row[k] = row[k + 1]; }
      else { rows[fr][fc] = row[c]; }
    }
  }
  row[c] = id;
  saveTray(A);
}

let trayDrag = null, trayNoClick = 0, lastTap = null;
document.addEventListener('pointerdown', e => {
  const tile = e.target.closest && e.target.closest('#hand.tray .ttile');
  if (!tile || e.button > 0) return;
  if (e.pointerType === 'mouse') e.preventDefault();   // no text selection while dragging (the click still selects)
  const r = tile.getBoundingClientRect();
  trayDrag = { id: +tile.dataset.id, el: tile, x0: e.clientX, y0: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, w: r.width, h: r.height, on: false, ghost: null, over: null };
});
document.addEventListener('pointermove', e => {
  const t = trayDrag;
  if (!t) return;
  if (!t.on) {
    if (Math.hypot(e.clientX - t.x0, e.clientY - t.y0) < 7) return;
    t.on = true;
    t.ghost = t.el.cloneNode(true);
    t.ghost.className = 'tghost';
    t.home = t.ghost.querySelector('.dm').outerHTML; t.face = null;   // how it lies in the hand   // just the tile: none of the tray's looks or animation, so it keeps up with the pointer
    t.ghost.style.setProperty('--tdw', getComputedStyle(t.el).getPropertyValue('--tdw'));
    document.body.appendChild(t.ghost);
    t.el.classList.add('away');
    document.body.classList.add('traydragging');
    // it is chosen, so the trains it can go on light up on the table
    const A = trayHooks.A;
    if (A) { if (!(A.pending && (A.dcover || []).includes(t.id))) A.pending = null; A.dsel = t.id; trayHooks.rerender(); }
  }
  e.preventDefault();
  const gx = e.clientX - t.dx, gy = e.clientY - t.dy;
  t.ghost.style.transform = `translate3d(${gx}px, ${gy}px, 0)`;
  // the slot under the middle of the carried tile (what you see), not under the pointer
  const under = document.elementFromPoint(gx + t.w / 2, gy + t.h / 2);
  const slot = under && under.closest('#hand.tray .tslot');
  // over the table: the nearest open end this tile may be played on, measured from the middle of the carried
  // tile, so it can be dropped near the end's dot rather than right on top of the train
  let end = null;
  if (!slot) {
    const mx = gx + t.w / 2, my = gy + t.h / 2;
    let best = Infinity;
    for (const b of document.querySelectorAll('.mt-spoke .dm-end.on')) {
      const r = b.getBoundingClientRect(), dist = Math.hypot(r.left + r.width / 2 - mx, r.top + r.height / 2 - my);
      const reach = Math.max(70, t.w * 1.3, r.width * 3);
      if (dist < reach && dist < best) { best = dist; end = b; }
    }
  }
  const sp = end ? end.closest('.mt-spoke') : null;
  const key = end ? end.dataset.train : null;
  if (t.spoke && t.spoke !== sp) t.spoke.classList.remove('dropok');
  t.spoke = key ? sp : null; t.board = key;
  if (t.spoke) t.spoke.classList.add('dropok');
  // over a train it fits: the carried tile turns so its matching number leads, however it lay in the hand
  const face = key ? +end.dataset.n : null;
  if (face !== t.face) {
    t.face = face;
    const dm = t.ghost.querySelector('.dm');
    if (dm) dm.outerHTML = face == null ? t.home : (() => { const [a, b] = TILES[t.id]; return domino(a === face ? a : b, a === face ? b : a, 'h'); })();
  }
  if (t.over && t.over !== slot) t.over.classList.remove('tover');
  t.over = slot; if (slot) slot.classList.add('tover');
}, { passive: false });
function endTrayDrag(drop) {
  const t = trayDrag;
  if (!t) return;
  trayDrag = null;
  document.body.classList.remove('traydragging');
  if (!t.on) {
    // a tap: the click selects it. Two quick taps on the same tile (a double-click) turn it end for end, and the
    // second tap doesn't also choose it again or let it go.
    const now = Date.now();
    if (lastTap && lastTap.id === t.id && now - lastTap.at < 400 && trayHooks.A) {
      lastTap = null;
      trayNoClick = now + 300;
      flipTile(trayHooks.A, t.id);
      trayHooks.rerender();
    } else lastTap = { id: t.id, at: now };
    return;
  }
  trayNoClick = Date.now() + 300;
  if (t.ghost) t.ghost.remove();
  const A = trayHooks.A;
  // dropped on a train: shown there, waiting for Confirm
  if (drop && t.board && A) {
    if (A.pending && (A.dcover || []).includes(t.id) && t.board === A.pending.train) { A.pending.cover = t.id; A.dsel = null; }
    else { A.pending = { id: t.id, train: t.board }; A.dsel = t.id; }
    trayHooks.rerender(); return;
  }
  if (drop && t.over && A && A.tray) trayDrop(A, t.id, +t.over.dataset.r, +t.over.dataset.c);
  trayHooks.rerender();
}
document.addEventListener('pointerup', () => endTrayDrag(true));
document.addEventListener('pointercancel', () => endTrayDrag(false));
// the click at the end of a drag doesn't also select the tile
document.addEventListener('click', e => { if (Date.now() < trayNoClick && e.target.closest && e.target.closest('#hand.tray')) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);

export function dominoControls(x) {
  const { A, pid, ic } = x, S = A.S, d = S.dm, m = meOf(S, pid);
  if (!d) return '';
  if (!m || !m.seat) return `${waitChip(x)}<span class="poolchip">Watching this game</span>`;
  if (d.stage !== 'play') return `<span class="poolchip">Your score: <b>${d.scores[pid] || 0}</b></span>`;
  const sel = A.dsel != null && m.hand.includes(A.dsel);
  const flip = sel ? `<button class="btn" data-act="dmflip" title="Turn the chosen domino end for end">${ic('reset')}Flip</button>` : '';
  if (S.turn !== pid) return `${waitChip(x)}${flip}`;
  const mvs = trainMoves(d, m), t = d.turn;
  const me = '';   // no "Your turn" chip here: the line above the table says so
  if (!mvs.length) return `${me}${flip}<button class="btn draw" data-act="g:draw">${ic(d.bone.length && !t.drew ? 'draw' : 'skip')}${d.bone.length && !t.drew ? 'Draw a domino' : 'Pass'}</button>`;
  if (A.pending && mvs.some(mv => mv.id === A.pending.id && mv.train === A.pending.train)) {
    const cover = coverIds(A, d, m).length ? `<span class="poolchip">Lay a domino to cover your double</span>` : '';
    return `${me}${cover}<button class="btn go" data-act="dmconfirm">${ic('check')}Confirm</button><button class="btn" data-act="dmcancel">${ic('undo')}Cancel</button>`;
  }
  const where = sel ? mvs.filter(mv => mv.id === A.dsel) : [];
  const play = where.length === 1 ? `<button class="btn go" data-act="dmplay">${ic('check')}Play</button>` : '';
  const hint = !sel ? (t.cover ? 'Now cover your double: choose a domino' : 'Choose a domino') : where.length > 1 ? 'Tap a train end to play it' : where.length ? '' : "That domino doesn't fit anywhere";
  return `${me}${flip}${play}${hint ? `<span class="poolchip">${hint}</span>` : ''}`;
}

// A tap on one of these games' cards or tiles: returns a move to send, or null (the selection changed).
export function tableTap(A, pid, act, b) {
  const S = A.S, m = S && meOf(S, pid);
  if (!S || !m) return null;
  if (S.game === 'idiot') {
    const g = S.id, id = +b.dataset.id;
    A.isel = A.isel || new Set();
    if (g.stage === 'swap') {
      if (act === 'ihand') { A.iswap = A.iswap === id ? null : id; return null; }
      if (act === 'iup' && A.iswap != null) { const h = A.iswap; A.iswap = null; return { a: 'swap', h, u: id }; }
      return null;
    }
    if (act === 'idown') return { a: 'play', i: +b.dataset.i };
    if (act === 'iplay') { const ids = [...A.isel]; A.isel = new Set(); return ids.length ? { a: 'play', ids } : null; }
    // choose cards of one rank; a different rank starts a new choice
    if (A.isel.has(id)) A.isel.delete(id);
    else { if ([...A.isel].some(o => rankOf(o) !== rankOf(id))) A.isel.clear(); A.isel.add(id); }
    return null;
  }
  if (S.game === 'hearts') {
    const h = S.hr, id = +b.dataset.id;
    A.hsel = A.hsel || new Set();
    if (act === 'hpass') { const ids = [...A.hsel]; if (ids.length !== 3) return null; A.hsel = new Set(); return { a: 'pass', ids }; }
    if (h.stage === 'pass') { if (A.hsel.has(id)) A.hsel.delete(id); else if (A.hsel.size < 3) A.hsel.add(id); return null; }
    return { a: 'play', id };
  }
  if (S.game === 'dominoes') {
    const mv = dominoTap(A, S, m, act, b);
    if (mv) A.dsent = [].concat(mv).map(x => x.id);   // out of the hand right away, before the referee's answer comes back
    return mv;
  }
  return null;
}
function dominoTap(A, S, m, act, b) {
  const d = S.dm, mvs = trainMoves(d, m), cov = coverIds(A, d, m);
  // a laid double: a tile that may cover it is laid after it (it can go nowhere else)
  if ((act === 'dmtile' && cov.includes(+b.dataset.id)) || (act === 'dmtrain' && cov.includes(A.dsel) && b.dataset.train === A.pending.train)) {
    A.pending.cover = act === 'dmtile' ? +b.dataset.id : A.dsel; A.dsel = null; return null;
  }
  // a tap only chooses a tile; it is played with a train end (or Play, when it fits just one place)
  if (act === 'dmtrain') { const id = A.dsel; A.dsel = null; return id != null ? { a: 'play', id, train: b.dataset.train } : null; }
  if (act === 'dmplay') { const where = mvs.filter(mv => mv.id === A.dsel); if (where.length !== 1) return null; A.dsel = null; return { a: 'play', id: where[0].id, train: where[0].train }; }
  if (act === 'dmflip') { if (A.dsel != null) flipTile(A, A.dsel); return null; }
  if (act === 'dmconfirm') {
    const pd = A.pending; A.pending = null; A.dsel = null;
    if (!pd || !mvs.some(mv => mv.id === pd.id && mv.train === pd.train)) return null;
    const out = [{ a: 'play', id: pd.id, train: pd.train }];
    // a new community train gets its name when the double starts it
    if (pd.cover != null) out.push({ a: 'play', id: pd.cover, train: pd.train === 'new' ? 'c' + communityKeys(d).length : pd.train });
    return out;
  }
  if (act === 'dmcancel') { if (A.pending && A.pending.cover != null) A.pending.cover = null; else A.pending = null; return null; }
  A.pending = null;
  const id = +b.dataset.id;
  A.dsel = A.dsel === id ? null : id;
  return null;
}

export const TABLE_ACTS = ['ihand', 'iup', 'idown', 'iplay', 'hcard', 'hpass', 'dmtile', 'dmtrain', 'dmplay', 'dmflip', 'dmconfirm', 'dmcancel'];
export const HAND_GAMES = ['idiot', 'hearts', 'dominoes'];
export { SUIT_SYM, HEARTS };
