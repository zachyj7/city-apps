// Blackjack and poker as the player sees them. The Room decides everything; this draws its state and sends choices.
import { G, S, save, addMoney } from './state.js';
import { $, fmt, esc, card, toast, openPanel, closePanel, canPay } from './ui.js';
import { bjTotal } from './cards.js';
import { sfx } from './audio.js';
import { makeAvatar } from './avatar.js';

const tp = () => $('#tablep');
const table = (k, id) => G.layout[k].find(t => t.id === id);
const LIVE = ['pre', 'flop', 'turn', 'river'];

export function initTables() {
  tp().addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) act(b.dataset.a, +b.dataset.v || 0); });
  tp().addEventListener('input', e => { if (e.target.id === 'raise') $('#raiseBtn').textContent = 'Raise to ' + fmt(+e.target.value); });
  setInterval(() => { const t = tp().querySelector('[data-dl]'); if (t) t.textContent = Math.max(0, Math.ceil((+t.dataset.dl - Date.now()) / 1000)) + 's'; }, 250);
}

function sitDown(k, id, i) {
  const T = table(k, id), st = T.seats[i];
  closePanel();
  G.seat = { k, id, i, T };
  G.mode = 'seat';
  Object.assign(G.pos, { x: st.x, z: st.z, r: st.rot, y: T.seatH - 0.62 });
  G.anim = 1;
  G.cam.dist = 5.4; G.cam.pitch = 0.62; G.cam.yaw = st.rot + Math.PI;
  tp().classList.remove('hidden');
  document.body.classList.add('seated');
}
export function standUp() {
  if (!G.seat) return;
  const { T, i } = G.seat, st = T.seats[i];
  const dx = st.x - T.x, dz = st.z - T.z, d = Math.hypot(dx, dz) || 1;
  Object.assign(G.pos, { x: st.x + dx / d * 1.2, z: st.z + dz / d * 1.2, y: 0 });
  G.anim = 0; G.seat = null;
  if (G.mode === 'seat') G.mode = 'walk';
  G.cam.dist = 6.5; G.cam.pitch = 0.32;
  tp().classList.add('hidden'); tp().innerHTML = '';
  document.body.classList.remove('seated');
}

function sync(k, s) {
  const i = s.seats.findIndex(x => x && x.pid === G.myId && !x.gone), me = i >= 0 ? s.seats[i] : null;
  if (me) { if (!G.seat) sitDown(k, s.id, i); } else if (G.seat && G.seat.k === k && G.seat.id === s.id) standUp();
  // what to hand back if the room vanishes mid-game
  if (k === 'bj') S.pend.bj = me && s.phase !== 'done' ? me.bet : 0;
  else S.pend.pk = me ? me.stack + (s.phase === 'show' ? 0 : me.tot) : 0;
  save();
  if (G.seat && G.seat.k === k && G.seat.id === s.id) render();
}
export function onBJ(s) { s.at = Date.now(); const old = G.bj[s.id]; G.bj[s.id] = s; if (G.seat && old && JSON.stringify(old.seats) + old.dealer !== JSON.stringify(s.seats) + s.dealer) sfx('card'); sync('bj', s); }
export function onPK(s) { s.at = Date.now(); const old = G.pk[s.id]; G.pk[s.id] = s; if (s.phase === 'idle') delete G.pkHole[s.id]; if (G.seat && old && old.board.length !== s.board.length) sfx('card'); syncBots(s); sync('pk', s); }
// House players get a body in their chair so the table doesn't look empty.
const botAvs = {};
const BOT_LOOKS = ['outfit_tourist', 'outfit_hoodie', 'outfit_red', 'outfit_royal', 'outfit_white', 'outfit_angler'];
function syncBots(s) {
  const T = table('pk', s.id);
  if (!T) return;
  T.seats.forEach((st, j) => {
    const key = s.id + j, x = s.seats[j], want = x && x.bot && !x.gone ? x.name : null, cur = botAvs[key];
    if (cur && cur.name !== want) { G.scene.remove(cur.av.root); cur.av.dispose(); G.npcs.splice(G.npcs.indexOf(cur.av), 1); delete botAvs[key]; }
    if (want && !botAvs[key]) {
      let h = 0; for (const c of want) h = (h * 31 + c.charCodeAt(0)) >>> 0;
      const av = makeAvatar({ skin: h % 6, hairColor: (h >> 3) % 6, hair: h & 1 ? 'hair_long' : 'hair_short', outfit: BOT_LOOKS[(h >> 5) % 6], hat: ['', 'hat_fedora', 'hat_cowboy', '', 'hat_cap'][(h >> 8) % 5], eye: (h >> 11) & 1 ? 'eye_shades' : '' }, want);
      av.root.position.set(st.x, T.seatH - 0.62, st.z); av.root.rotation.y = st.rot; av.pose = 1;
      G.scene.add(av.root); G.npcs.push(av);
      botAvs[key] = { name: want, av };
    }
  });
}
function clearBots() { for (const k in botAvs) { const c = botAvs[k]; G.scene.remove(c.av.root); c.av.dispose(); G.npcs.splice(G.npcs.indexOf(c.av), 1); delete botAvs[k]; } }
export function onHole(m) { G.pkHole[m.tb] = m.cards; if (G.seat && G.seat.id === m.tb) render(); }

// The room is gone (host left, or we lost them). Take back whatever was still on the table.
export function tablesLost() {
  const back = S.pend.bj + S.pend.pk;
  S.pend.bj = S.pend.pk = 0;
  if (back > 0) { addMoney(back, true); toast(`Table closed. ${fmt(back)} returned to you.`); }
  save();
  standUp();
  G.bj = {}; G.pk = {}; G.pkHole = {};
  clearBots();
}

export function openBJ(it) {
  const T = table('bj', it.id), s = G.bj[it.id];
  if (S.money < T.min) return toast(`This table's minimum is ${fmt(T.min)}`, 'bad');
  let best = -1, bd = 1e9;
  T.seats.forEach((st, i) => { if (s && s.seats[i]) return; const d = Math.hypot(st.x - G.pos.x, st.z - G.pos.z); if (d < bd) { bd = d; best = i; } });
  G.send({ t: 'bj', tb: it.id, a: 'sit', seat: best });
}
export function openPK(it) {
  const T = table('pk', it.id), s = G.pk[it.id];
  if (S.money < T.min) return toast(`Buy-in starts at ${fmt(T.min)}`, 'bad');
  const opts = [T.min, T.min * 2.5, T.min * 5, T.max].filter(v => v <= S.money);
  const b = openPanel({ title: "♠ Texas Hold'em", cls: 'small' });
  b.innerHTML = `<p>No-limit, blinds ${fmt(T.sb)} / ${fmt(T.bb)}. House players fill empty seats until friends arrive.</p>
    <p class="dim">Choose your buy-in:</p><div class="row">${opts.map(v => `<button class="chip" data-buy="${v}">${fmt(v)}</button>`).join('')}</div>`;
  b.querySelectorAll('[data-buy]').forEach(x => x.onclick = () => {
    let best = -1, bd = 1e9;
    T.seats.forEach((st, i) => { if (s && s.seats[i]) return; const d = Math.hypot(st.x - G.pos.x, st.z - G.pos.z); if (d < bd) { bd = d; best = i; } });
    G.send({ t: 'pk', tb: it.id, a: 'sit', seat: best, buy: +x.dataset.buy });
    closePanel();
  });
}

function act(a, v) {
  const { k, id, i } = G.seat || {};
  if (!k) return;
  sfx('chip');
  if (a === 'leave') return G.send({ t: k, tb: id, a: 'leave' });
  if (k === 'bj') {
    const me = G.bj[id].seats[i];
    if (a === 'bet' && !canPay(v)) return;
    if (a === 'double' && !canPay(me.bet)) return;
    G.send({ t: 'bj', tb: id, a, amt: v });
  } else {
    if (a === 'raise') v = +$('#raise').value;
    if (a === 'set') { const r = $('#raise'); r.value = v; $('#raiseBtn').textContent = 'Raise to ' + fmt(+r.value); return; }
    if (a === 'buy') { if (!canPay(v)) return; }
    G.send({ t: 'pk', tb: id, a, amt: v });
  }
}

function render() {
  const el = tp();
  el.innerHTML = G.seat.k === 'bj' ? bjHTML() : pkHTML();
}
const timer = s => s.tl ? `<span class="tl" data-dl="${s.at + s.tl}"></span>` : '';

function bjHTML() {
  const s = G.bj[G.seat.id], i = G.seat.i, me = s.seats[i];
  const tot = cs => { const v = cs.filter(c => c >= 0); return v.length ? bjTotal(v).t : ''; };
  let ctl;
  if (s.phase === 'bet') {
    ctl = me.bet ? `<span class="dim">Bet placed. Dealing ${timer(s)}</span>`
      : [1, 2, 5, 10, 25, 50].map(m => m * s.min).filter(v => v <= s.max).map(v => `<button class="chip" data-a="bet" data-v="${v}" ${v > S.money ? 'disabled' : ''}>${fmt(v)}</button>`).join('') + (s.tl ? ` <span class="dim">${timer(s)}</span>` : '');
  } else if (s.phase === 'play') {
    ctl = s.turn === i ? `<button class="big" data-a="hit">Hit</button><button class="big" data-a="stand">Stand</button>${me.cards.length === 2 ? `<button class="big" data-a="double" ${me.bet > S.money ? 'disabled' : ''}>Double</button>` : ''} ${timer(s)}`
      : `<span class="dim">${me.bet ? 'Waiting for ' + esc((s.seats[s.turn] || {}).name || 'others') : 'Sitting this hand out'} ${timer(s)}</span>`;
  } else if (s.phase === 'dealer') ctl = '<span class="dim">Dealer plays…</span>';
  else ctl = me.res ? `<span class="res ${me.res}">${me.res}${me.win ? ' ' + fmt(me.win) : ''}</span>` : '<span class="dim">Next hand soon…</span>';
  return `<div class="th"><b>Blackjack</b><span class="dim">${fmt(s.min)}–${fmt(s.max)} · pays 3:2</span><button class="x" data-a="leave">Leave</button></div>
    <div class="dealer"><span class="lbl">Dealer <b>${s.dealer.length ? tot(s.dealer) : ''}</b></span>${s.dealer.map(c => card(c)).join('')}</div>
    <div class="seats">${s.seats.map((x, j) => !x ? '' : `<div class="seat ${j === i ? 'me' : ''} ${s.turn === j ? 'turn' : ''}">
      <div class="nm">${esc(x.name)}</div><div class="cards">${x.cards.map(c => card(c, 'sm')).join('')}</div>
      <div class="info">${x.cards.length ? '<b>' + tot(x.cards) + '</b> · ' : ''}${x.bet ? fmt(x.bet) : 'no bet'}${x.res ? ` <span class="res ${x.res}">${x.res}</span>` : ''}</div></div>`).join('')}</div>
    <div class="ctl">${ctl}</div>`;
}

function pkHTML() {
  const s = G.pk[G.seat.id], i = G.seat.i, me = s.seats[i], hole = G.pkHole[s.id] || [];
  const pot = s.pot + s.seats.reduce((a, x) => a + (x ? x.bet : 0), 0), live = LIVE.includes(s.phase);
  let ctl;
  if (live && s.turn === i) {
    const toCall = Math.min(s.cur - me.bet, me.stack), max = me.bet + me.stack, minTo = Math.min(max, s.cur + s.minR);
    const tgt = f => Math.max(minTo, Math.min(max, Math.round((s.cur + pot * f) / s.bb) * s.bb));
    ctl = `<div class="row"><button class="big bad" data-a="fold">Fold</button><button class="big" data-a="call">${toCall > 0 ? 'Call ' + fmt(toCall) : 'Check'}</button>
      ${max > s.cur ? `<button class="big gold" id="raiseBtn" data-a="raise">Raise to ${fmt(minTo)}</button>` : ''} ${timer(s)}</div>
      ${max > s.cur ? `<div class="row raise"><input type="range" id="raise" min="${minTo}" max="${max}" step="${Math.min(s.bb, Math.max(1, max - minTo))}" value="${minTo}">
        <button class="chip" data-a="set" data-v="${tgt(0.5)}">½ pot</button><button class="chip" data-a="set" data-v="${tgt(1)}">Pot</button><button class="chip" data-a="set" data-v="${max}">All in</button></div>` : ''}`;
  } else if (live) ctl = `<span class="dim">${me.in ? (me.folded ? 'You folded.' : 'Waiting for ' + esc((s.seats[s.turn] || {}).name || 'the deal')) : "You'll be dealt in next hand."} ${s.turn >= 0 ? timer(s) : ''}</span>`;
  else if (s.phase === 'show') ctl = `<span class="res WIN">${esc(s.msg)}</span>`;
  else ctl = `<span class="dim">Shuffling up…</span>${me.stack < s.max && S.money >= s.bb * 20 ? ` <button class="chip" data-a="buy" data-v="${Math.min(s.max - me.stack, s.min, S.money)}">Top up ${fmt(Math.min(s.max - me.stack, s.min, S.money))}</button>` : ''}`;
  return `<div class="th"><b>Hold'em</b><span class="dim">${fmt(s.sb)}/${fmt(s.bb)}</span><span class="pot">Pot ${fmt(pot)}</span><button class="x" data-a="leave">Cash out</button></div>
    <div class="board">${s.board.map(c => card(c)).join('') || '<span class="dim">—</span>'}</div>
    <div class="seats pk">${s.seats.map((x, j) => !x || x.gone ? '' : `<div class="seat ${j === i ? 'me' : ''} ${s.turn === j ? 'turn' : ''} ${x.folded || !x.in && live ? 'out' : ''}">
      <div class="nm">${s.btn === j ? '<em>D</em>' : ''}${esc(x.name)}</div>
      <div class="cards">${j === i && me.in ? hole.map(c => card(c, 'sm')).join('') : x.cards ? x.cards.map(c => card(c, 'sm')).join('') : x.in && !x.folded && s.phase !== 'idle' ? card(-1, 'sm') + card(-1, 'sm') : ''}</div>
      <div class="info"><b>${fmt(x.stack)}</b>${x.bet ? ' · bet ' + fmt(x.bet) : ''}${x.res ? ` <span class="res WIN">${esc(x.res)}</span>` : x.last ? ` <i>${x.last}</i>` : ''}</div></div>`).join('')}</div>
    <div class="ctl">${ctl}</div>`;
}
