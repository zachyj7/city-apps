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
const L = 25, M = 50, R = 75, T = 25, C = 50, B = 75, Y4 = [14, 38, 62, 86];   // even margins; 10-12 use four rows
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
  [...Y4.map(y => [L, y]), ...Y4.map(y => [R, y]), [M, 17], [M, 83]],
  [...Y4.map(y => [L, y]), ...Y4.map(y => [R, y]), [M, 17], [M, 50], [M, 83]],
  [...Y4.map(y => [L, y]), ...Y4.map(y => [M, y]), ...Y4.map(y => [R, y])],
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

export function renderDominoes(box, x) {
  const { A, pid, esc, rackStyle, rackOf } = x, S = A.S, d = S.dm;
  if (!d) { box.innerHTML = ''; return; }
  const me = meOf(S, pid), myTurn = d.stage === 'play' && S.turn === pid && me;
  const mvs = myTurn ? trainMoves(d, me) : [];
  const where = new Set(mvs.filter(m => m.id === A.dsel).map(m => m.train));
  const fresh = d.last && d.last.k > (A.dmSeen || 0) ? d.last.id : null;
  const seats = seatedOf(S), comm = communityKeys(d);
  // a tile dropped on a train waits there for Confirm (only while it can still go there)
  if (A.pending && !(myTurn && mvs.some(mv => mv.id === A.pending.id && mv.train === A.pending.train))) A.pending = null;
  const ghost = where.has('new') || !!(A.pending && A.pending.train === 'new');   // the chosen tile could start a new community train
  let info;
  if (d.stage === 'scored') info = 'Round over: ' + seats.map(p => `${esc(p.name)} +${d.roundPts[p.pid]}`).join(' · ');
  else if (!myTurn) { const c = meOf(S, S.turn); info = c ? `${esc(c.name)}'s turn` : ''; }
  else if (d.turn.cover) info = 'Cover your double!';
  else if (d.open) info = 'Cover the open double first';
  else if (!d.first[pid]) info = 'First turn: start your own train';
  else info = A.pending ? 'Play it there? Confirm or Cancel' : A.dsel != null && where.size > 1 ? 'Tap the end of a train, or drag the tile onto it' : 'Your turn';

  // the table: as big as the middle of the screen allows, with room for the line above and the scores below
  const main = box.parentElement, cs = getComputedStyle(main);
  const ctl = document.getElementById('controls'), ctlH = ctl && ctl.offsetHeight ? ctl.offsetHeight + 10 : 60;
  const W = Math.max(280, main.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 6);
  const H = Math.max(170, main.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - ctlH - 96);
  box.innerHTML = `<div class="ct-table mtrain">
    <div class="mt-head"><span class="bj-info">${info}</span><span class="mt-round">Round ${Math.min(d.roundNo + (d.stage === 'scored' ? 0 : 1), d.rounds)} of ${d.rounds} · Boneyard ${d.bone.length}</span></div>
    <div class="mt-hub" style="width:${W}px;height:${H}px"></div>
    <div class="mt-scores">${seats.slice().sort((a, b) => d.scores[a.pid] - d.scores[b.pid]).map(p => `<span style="${rackStyle(p.rc)}"><i class="dot"></i>${esc(p.name)} <b>${d.scores[p.pid]}</b></span>`).join('')}<small>Lowest wins</small></div>
  </div>`;
  const hub = box.querySelector('.mt-hub'), hr = hub.getBoundingClientRect();
  const faceOf = p => { const el = document.querySelector(`.seat[data-pid="${CSS.escape(p.pid)}"] .face`); const r = el && el.getBoundingClientRect(); return r && r.width ? r : null; };
  const nComm = comm.length + (ghost ? 1 : 0);
  const place = placeTrains(seats, nComm, hr, faceOf, me && me.seat ? pid : null);
  const cx = W / 2, cy = H / 2;
  const keys = [...seats.map(p => p.pid), ...comm, ...(ghost ? ['new'] : [])];
  const posOf = k => place[k === 'new' ? 'c' + comm.length : k] || { a: 0, extra: true };
  // Each train may wind into its own half of the gap toward each neighbour (never into the next train's half).
  const sorted = keys.map(k => posOf(k).a).sort((x, y) => x - y);
  const gaps = a => {
    if (sorted.length < 2) return [Math.PI * 0.8, Math.PI * 0.8];
    const i = sorted.findIndex(x => Math.abs(x - a) < 1e-6);
    const n = sorted.length, prev = sorted[(i - 1 + n) % n], next = sorted[(i + 1) % n];
    const gp = ((a - prev) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) || 2 * Math.PI;
    const gn = ((next - a) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) || 2 * Math.PI;
    return [gp, gn];
  };

  /* Laying out one train, the way it is laid on a real table: on a grid of half-tile squares. A tile covers two
     squares (a double, laid across, one); its matching half always sits right next to the open half before it.
     The train runs straight out from the hub; near the edge of the table it turns 90 degrees for one tile and
     90 degrees again, and comes back alongside itself (a snake), as many times as it needs. Returns null if it
     doesn't fit. x is along the train, out from the centre; y is across it. */
  function snake(items, a, r0, dw) {
    const cell = dw * 1.06 + 1.5;
    const u = [Math.cos(a), Math.sin(a)], v = [-Math.sin(a), Math.cos(a)];
    const [gp, gn] = gaps(a);
    const side = gn >= gp ? 1 : -1;                                   // wind toward the wider gap
    const half = Math.min(Math.PI * 0.4, (side > 0 ? gn : gp) / 2) - 0.05;
    const m = cell * 0.75;
    const xy = (i, j) => [r0 + cell * (i + 0.5), cell * j];
    // a square this train may use: on the table, out of the hub, and inside its own share of the gap
    const ok = (i, j) => {
      if (i < 0 || j * side < 0) return false;
      const [x, y] = xy(i, j);
      const px = cx + x * u[0] + y * v[0], py = cy + x * u[1] + y * v[1];
      if (px < m || px > W - m || py < m || py > H - m) return false;
      if (j !== 0 && Math.atan2(Math.abs(y) + cell * 0.6, Math.max(1, x - cell * 0.6)) > half) return false;
      return true;
    };
    const used = new Set(), k2 = (i, j) => i + ',' + j;
    const free = (i, j) => ok(i, j) && !used.has(k2(i, j));
    const DIRS = [[1, 0], [0, side], [-1, 0], [0, side]];   // out, across, back, across, out ...
    let phase = 0, ci = -1, cj = 0, across = 0;
    const out = [];
    for (const it of items) {
      const n = it.cells;
      let placed = false;
      for (let tries = 0; tries < 2 && !placed; tries++) {
        const [di, dj] = DIRS[phase % 4];
        const cs = [];
        for (let s = 1; s <= n; s++) cs.push([ci + di * s, cj + dj * s]);
        // a double lies across the line, so it also takes the squares on each side of it
        const extra = it.dbl ? cs.flatMap(([i, j]) => [[i + dj, j + di], [i - dj, j - di]]) : [];
        if (cs.every(([i, j]) => free(i, j)) && extra.every(([i, j]) => !used.has(k2(i, j)))) {
          for (const [i, j] of [...cs, ...extra]) used.add(k2(i, j));
          const [x0, y0] = xy(...cs[0]), [x1, y1] = xy(...cs[cs.length - 1]);
          out.push({ ...it, x: (x0 + x1) / 2, y: (y0 + y1) / 2, rot: di > 0 ? 0 : di < 0 ? 180 : dj > 0 ? 90 : -90 });
          [ci, cj] = cs[cs.length - 1];
          if (phase % 2) { across -= n; if (across <= 0) phase++; }   // gone across far enough: head back
          placed = true;
        } else if (phase % 2 === 0) { phase++; across = 2; }      // turn the corner
        else return null;
      }
      if (!placed) return null;
    }
    return out;
  }
  // The pieces of a train, in order: (a count of tiles not shown,) its tiles, a tile waiting for Confirm, the open end.
  function piecesOf(key, dw, hide) {
    const t = d.trains[key], tiles = t ? t.tiles : [], end = endOf(d, key);
    const list = [];
    if (hide) list.push({ kind: 'more', n: hide, cells: 1 });
    for (const tl of tiles.slice(hide)) list.push({ kind: 'tile', tl, cells: tl.a === tl.b ? 1 : 2, dbl: tl.a === tl.b });
    const pend = A.pending && A.pending.train === key && myTurn ? (() => { const [pa, pb] = TILES[A.pending.id]; return pa === end ? [pa, pb] : [pb, pa]; })() : null;
    if (pend) list.push({ kind: 'pend', ab: pend, cells: pend[0] === pend[1] ? 1 : 2, dbl: pend[0] === pend[1] });
    list.push({ kind: 'end', cells: 1 });
    return list;
  }
  const r0For = (pos, ap, dw) => (pos.extra ? ap + dw * 1.9 : ap - 2);   // in-between trains start further out
  const layoutAll = (dw, allowHide) => {
    const ap = dw * 2.6, res = {};
    for (const k of keys) {
      const pos = posOf(k), n = d.trains[k] ? d.trains[k].tiles.length : 0;
      let lay = null, hide = 0;
      for (; hide <= n; hide++) {
        if (hide && !allowHide) return null;
        lay = snake(piecesOf(k, dw, hide), pos.a, r0For(pos, ap, dw), dw);
        if (lay) break;
      }
      res[k] = lay || [];
    }
    return res;
  };
  let dw = Math.round(Math.max(13, Math.min(28, Math.min(W, H) / 22)) * (A.zoom || 1));
  let lays = null;
  // Fit: tiles small enough that every train is shown whole
  if (A.fit) for (; dw > 7 && !(lays = layoutAll(dw, false)); dw--);
  if (!lays) lays = layoutAll(dw, true);
  // the octagon: its flat sides face the eight trains; the engine lies in a slot in the middle
  const ap = dw * 2.6;                                             // centre to the middle of a side
  const rv = ap / Math.cos(Math.PI / SIDES);                       // centre to a corner
  const oct = Array.from({ length: SIDES }, (_, k) => { const a = k * STEP + STEP / 2; return `${(cx + rv * Math.cos(a)).toFixed(1)},${(cy + rv * Math.sin(a)).toFixed(1)}`; }).join(' ');
  const spoke = key => {
    const pos = posOf(key), t = d.trains[key], who = meOf(S, key), isComm = key === 'new' || (t && t.community);
    const color = isComm ? TOY_COLORS[(key === 'new' ? comm.length : t.n) % TOY_COLORS.length] : '#888';
    const deg = pos.a * 180 / Math.PI;
    const can = where.has(key), end = endOf(d, key);
    const label = isComm ? (key === 'new' ? 'Start a community train here' : 'Community train') : `${who ? (who.pid === pid ? 'your' : esc(who.name) + "'s") : ''} train`;
    const pieces = lays[key];
    const at = (p, inner, cls = '', upright = false) => `<span class="mt-it ${cls}" style="left:${p.x.toFixed(1)}px;top:${p.y.toFixed(1)}px;transform:translate(-50%, -50%) rotate(${upright ? -deg : p.rot}deg)">${inner}</span>`;
    let html = '';
    pieces.forEach(p => {
      if (p.kind === 'more') html += at(p, `<span class="mt-more">+${p.n}</span>`, '', true);
      else if (p.kind === 'tile') html += at(p, domino(p.tl.a, p.tl.b, `${p.tl.a === p.tl.b ? 'dbl' : 'h'} ${p.tl.id === fresh ? 'landed' : ''}`));
      else if (p.kind === 'pend') html += at(p, domino(p.ab[0], p.ab[1], `${p.ab[0] === p.ab[1] ? 'dbl' : 'h'} pending`));
      else html += at(p, `<button class="dm-end ${can ? 'on' : ''}" data-act="dmtrain" data-train="${esc(key)}" ${can ? '' : 'disabled'} aria-label="Play on ${label} (open end ${end})" title="${label}"><span class="dm endpip">${half(end)}</span></button>`, '', true);
    });
    // the marker sits on the first piece, by the hub (as on the real table)
    const first = pieces[0];
    const mark = isComm ? toyTrain(color) : t && t.marker ? penny(`${esc(who ? who.name : '')} couldn't play: anyone may play here`) : '';
    if (mark && first) html += at(first, mark, 'mt-mk', true);
    if (d.open === key && pieces.length) html += at(pieces[pieces.length - 1], '<b class="mt-opendbl">Cover!</b>', 'mt-flag', true);
    const pend = pieces.some(p => p.kind === 'pend');
    return `<div class="mt-spoke ${pend ? 'dropok' : ''} ${d.open === key ? 'open' : ''} ${key === 'new' ? 'mt-new' : ''} ${isComm ? 'comm' : ''}"
      style="--dw:${dw}px;transform:translate(${cx}px, ${cy}px) rotate(${deg}deg)">${html}</div>`;
  };
  hub.innerHTML = `<svg class="mt-station" width="${W}" height="${H}" aria-hidden="true"><polygon points="${oct}"/></svg>`
    + keys.map(spoke).join('')
    + `<div class="mt-engine" style="left:${cx}px;top:${cy}px;--dw:${Math.round(dw * 1.05)}px" title="The engine: double ${d.engine}">${domino(d.engine, d.engine, 'h')}</div>`;
  A.dmSeen = d.last ? d.last.k : 0;
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
  const ok = new Set(myTurn ? trainMoves(d, m).map(mv => mv.id) : []);
  if (A.dsel != null && !m.hand.includes(A.dsel)) A.dsel = null;
  el.classList.add('dmhand', 'tray');
  const width = el.clientWidth || el.parentElement.clientWidth || 600;
  const k = (A.zoom || 1) * (A.dz || 1);   // text size, and the tray's own size slider
  const cols = Math.max(4, Math.min(14, Math.floor((width - 16) / (64 * k))));
  const dw = Math.max(14, Math.min(30 * k, Math.floor(((width - 16) / cols - 8) / 2.2)));
  const t = fitTray(A, d, m.hand, cols);
  el.style.setProperty('--tdw', dw + 'px');
  el.innerHTML = t.rows.map((row, r) => `<div class="trow">${row.map((id, c) => {
    if (id == null) return `<span class="tslot" data-r="${r}" data-c="${c}"></span>`;
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

let trayDrag = null, trayNoClick = 0;
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
    t.ghost.className = 'tghost';   // just the tile: none of the tray's looks or animation, so it keeps up with the pointer
    t.ghost.style.setProperty('--tdw', getComputedStyle(t.el).getPropertyValue('--tdw'));
    document.body.appendChild(t.ghost);
    t.el.classList.add('away');
    document.body.classList.add('traydragging');
    // it is chosen, so the trains it can go on light up on the table
    const A = trayHooks.A;
    if (A) { A.dsel = t.id; A.pending = null; trayHooks.rerender(); }
  }
  e.preventDefault();
  const gx = e.clientX - t.dx, gy = e.clientY - t.dy;
  t.ghost.style.transform = `translate3d(${gx}px, ${gy}px, 0)`;
  // the slot under the middle of the carried tile (what you see), not under the pointer
  const under = document.elementFromPoint(gx + t.w / 2, gy + t.h / 2);
  const slot = under && under.closest('#hand.tray .tslot');
  // over the table: the train under the pointer, if this tile may be played on it
  const at = document.elementFromPoint(e.clientX, e.clientY);
  const sp = !slot && at && at.closest('.mt-spoke');
  const end = sp && sp.querySelector('.dm-end.on');
  const key = end ? end.dataset.train : null;
  if (t.spoke && t.spoke !== sp) t.spoke.classList.remove('dropok');
  t.spoke = key ? sp : null; t.board = key;
  if (t.spoke) t.spoke.classList.add('dropok');
  if (t.over && t.over !== slot) t.over.classList.remove('tover');
  t.over = slot; if (slot) slot.classList.add('tover');
}, { passive: false });
function endTrayDrag(drop) {
  const t = trayDrag;
  if (!t) return;
  trayDrag = null;
  document.body.classList.remove('traydragging');
  if (!t.on) return;   // a tap: the click selects it
  trayNoClick = Date.now() + 300;
  if (t.ghost) t.ghost.remove();
  const A = trayHooks.A;
  // dropped on a train: shown there, waiting for Confirm
  if (drop && t.board && A) { A.pending = { id: t.id, train: t.board }; A.dsel = t.id; trayHooks.rerender(); return; }
  if (drop && t.over && A && A.tray) trayDrop(A, t.id, +t.over.dataset.r, +t.over.dataset.c);
  trayHooks.rerender();
}
document.addEventListener('pointerup', () => endTrayDrag(true));
document.addEventListener('pointercancel', () => endTrayDrag(false));
// the click at the end of a drag doesn't also select the tile
document.addEventListener('click', e => { if (Date.now() < trayNoClick && e.target.closest && e.target.closest('#hand.tray')) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
// double-tap a tile to flip it
document.addEventListener('dblclick', e => {
  const tile = e.target.closest && e.target.closest('#hand.tray .ttile');
  if (!tile || !trayHooks.A) return;
  e.preventDefault();
  flipTile(trayHooks.A, +tile.dataset.id);
  trayHooks.rerender();
});

export function dominoControls(x) {
  const { A, pid, ic } = x, S = A.S, d = S.dm, m = meOf(S, pid);
  if (!d) return '';
  if (!m || !m.seat) return `${waitChip(x)}<span class="poolchip">Watching this game</span>`;
  if (d.stage !== 'play') return `<span class="poolchip">Your score: <b>${d.scores[pid] || 0}</b></span>`;
  const sel = A.dsel != null && m.hand.includes(A.dsel);
  const flip = sel ? `<button class="btn" data-act="dmflip" title="Turn the chosen tile end for end">${ic('reset')}Flip</button>` : '';
  if (S.turn !== pid) return `${waitChip(x)}${flip}`;
  const mvs = trainMoves(d, m), t = d.turn;
  const me = `<span class="turnchip" style="${x.rackStyle(m.rc)}">Your turn</span>`;
  if (!mvs.length) return `${me}${flip}<button class="btn draw" data-act="g:draw">${ic(d.bone.length && !t.drew ? 'draw' : 'skip')}${d.bone.length && !t.drew ? 'Draw a tile' : 'Pass'}</button>`;
  if (A.pending && mvs.some(mv => mv.id === A.pending.id && mv.train === A.pending.train)) {
    return `${me}<button class="btn go" data-act="dmconfirm">${ic('check')}Confirm</button><button class="btn" data-act="dmcancel">${ic('undo')}Cancel</button>`;
  }
  const where = sel ? mvs.filter(mv => mv.id === A.dsel) : [];
  const play = where.length === 1 ? `<button class="btn go" data-act="dmplay">${ic('check')}Play</button>` : '';
  const hint = !sel ? (t.cover ? 'Now cover your double: choose a tile' : 'Choose a tile') : where.length > 1 ? 'Tap a train end to play it' : where.length ? '' : "That tile doesn't fit anywhere";
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
    const d = S.dm, mvs = trainMoves(d, m);
    // a tap only chooses a tile; it is played with a train end (or Play, when it fits just one place)
    if (act === 'dmtrain') { const id = A.dsel; A.dsel = null; return id != null ? { a: 'play', id, train: b.dataset.train } : null; }
    if (act === 'dmplay') { const where = mvs.filter(mv => mv.id === A.dsel); if (where.length !== 1) return null; A.dsel = null; return { a: 'play', id: where[0].id, train: where[0].train }; }
    if (act === 'dmflip') { if (A.dsel != null) flipTile(A, A.dsel); return null; }
    if (act === 'dmconfirm') { const pd = A.pending; A.pending = null; A.dsel = null; return pd && mvs.some(mv => mv.id === pd.id && mv.train === pd.train) ? { a: 'play', id: pd.id, train: pd.train } : null; }
    if (act === 'dmcancel') { A.pending = null; return null; }
    A.pending = null;
    const id = +b.dataset.id;
    A.dsel = A.dsel === id ? null : id;
    return null;
  }
  return null;
}
export const TABLE_ACTS = ['ihand', 'iup', 'idown', 'iplay', 'hcard', 'hpass', 'dmtile', 'dmtrain', 'dmplay', 'dmflip', 'dmconfirm', 'dmcancel'];
export const HAND_GAMES = ['idiot', 'hearts', 'dominoes'];
export { SUIT_SYM, HEARTS };
