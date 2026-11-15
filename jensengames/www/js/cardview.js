// What Blackjack and Color Clash look like: the cards, the table in the middle, and the buttons at the bottom.
// Everything here only draws; moves go to the referee as { t: 'g', a: ... } (see bj.js and uno.js).
import { RANKS, rankOf, suitOf, total, isBJ, options } from './bj.js';
import { CARD, SKIP, REV, PLUS2, WILD, PLUS4, COLOR_NAMES, isWild, playable } from './uno.js';

const money = n => '$' + Math.round(n).toLocaleString('en-US');

/* ---------------- playing cards ---------------- */

// spade, heart, diamond, club (the same solid shapes as on the tiles)
const SUIT_SVG = [
  '<g stroke="none"><path d="M10 0.6 C15.6 5.1 19.3 8 19.3 11.6 C19.3 14.2 17.3 15.9 15 15.9 C13.4 15.9 11.9 15.1 10 13.2 C8.1 15.1 6.6 15.9 5 15.9 C2.7 15.9 0.7 14.2 0.7 11.6 C0.7 8 4.4 5.1 10 0.6 Z"/><path d="M8.7 11 L6.8 18.8 H13.2 L11.3 11 Z"/></g>',
  '<path d="M10 18.4 C3.8 13.9 0.9 10.6 0.9 6.7 C0.9 3.8 3.1 1.6 5.8 1.6 C7.6 1.6 9.1 2.6 10 4.1 C10.9 2.6 12.4 1.6 14.2 1.6 C16.9 1.6 19.1 3.8 19.1 6.7 C19.1 10.6 16.2 13.9 10 18.4 Z"/>',
  '<polygon points="10,0.8 18,10 10,19.2 2,10"/>',
  '<g stroke="none"><circle cx="10" cy="5.4" r="4"/><circle cx="5.2" cy="11" r="4"/><circle cx="14.8" cy="11" r="4"/><circle cx="10" cy="9.6" r="2.6"/><path d="M8.7 11 L6.8 18.8 H13.2 L11.3 11 Z"/></g>',
].map(p => `<svg viewBox="0 0 20 20" aria-hidden="true">${p}</svg>`);
const SUIT_NAMES = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANK_NAMES = ['Ace', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Jack', 'Queen', 'King'];

export function pcard(id, cls = '') {
  if (id == null) return `<div class="pc back ${cls}" aria-label="Face-down card"></div>`;
  const r = rankOf(id), su = suitOf(id), red = su === 1 || su === 2;
  const mid = r >= 10 ? `<b class="pc-face">${RANKS[r]}</b>` : SUIT_SVG[su];
  return `<div class="pc ${red ? 'red' : ''} ${cls}" role="img" aria-label="${RANK_NAMES[r]} of ${SUIT_NAMES[su]}">
    <span class="pc-c"><b>${RANKS[r]}</b>${SUIT_SVG[su]}</span><span class="pc-mid">${mid}</span><span class="pc-c pc-br"><b>${RANKS[r]}</b>${SUIT_SVG[su]}</span></div>`;
}

/* ---------------- Color Clash cards ---------------- */

// Each color also has its own shape, so they are easy to tell apart: red heart, yellow sun, green leaf, blue drop.
const CSHAPES = [
  '<path d="M10 18.4 C3.8 13.9 0.9 10.6 0.9 6.7 C0.9 3.8 3.1 1.6 5.8 1.6 C7.6 1.6 9.1 2.6 10 4.1 C10.9 2.6 12.4 1.6 14.2 1.6 C16.9 1.6 19.1 3.8 19.1 6.7 C19.1 10.6 16.2 13.9 10 18.4 Z"/>',
  '<circle cx="10" cy="10" r="5"/><path d="M10 0.5v3M10 16.5v3M0.5 10h3M16.5 10h3M3.3 3.3l2.1 2.1M14.6 14.6l2.1 2.1M3.3 16.7l2.1-2.1M14.6 5.4l2.1-2.1" stroke-width="2.2" stroke-linecap="round"/>',
  '<path d="M3 17 C3 8 8 3 17 3 C17 12 12 17 3 17 Z"/>',
  '<path d="M10 1 C14 7 16.5 10 16.5 13 A6.5 6.5 0 0 1 3.5 13 C3.5 10 6 7 10 1 Z"/>',
].map(p => `<svg class="cshape" viewBox="0 0 20 20" aria-hidden="true">${p}</svg>`);
const SKIP_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M6 18L18 6"/></svg>';
const REV_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h13l-3.5-3.5M20 15H7l3.5 3.5"/></svg>';
const WHEEL = '<svg class="wheel" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12V2a10 10 0 0 1 10 10z" fill="#e63327"/><path d="M12 12h10a10 10 0 0 1-10 10z" fill="#1f6fd1"/><path d="M12 12v10A10 10 0 0 1 2 12z" fill="#1d9a4d"/><path d="M12 12H2A10 10 0 0 1 12 2z" fill="#f5c400"/></svg>';
export const CC_COLORS = ['#e63327', '#f5c400', '#1d9a4d', '#1f6fd1'];

function ccFace(k) {
  if (k.v <= 9) return { big: String(k.v), small: String(k.v), name: String(k.v) };
  if (k.v === SKIP) return { big: SKIP_SVG, small: SKIP_SVG, name: 'Skip' };
  if (k.v === REV) return { big: REV_SVG, small: REV_SVG, name: 'Reverse' };
  if (k.v === PLUS2) return { big: '+2', small: '+2', name: 'Plus two' };
  if (k.v === WILD) return { big: WHEEL, small: 'W', name: 'Wild' };
  return { big: `${WHEEL}<b class="over">+4</b>`, small: '+4', name: 'Wild plus four' };
}

export function ccard(id, cls = '', attrs = '') {
  if (id == null) return `<div class="cc back ${cls}" ${attrs} aria-label="Face-down card"><span class="cc-logo">JG</span></div>`;
  const k = CARD[id], f = ccFace(k);
  const shape = k.c < 4 ? CSHAPES[k.c] : '';
  const label = (k.c < 4 ? COLOR_NAMES[k.c] + ' ' : '') + f.name;
  return `<div class="cc ${k.c < 4 ? 'k' + k.c : 'kw'} ${cls}" data-card="${id}" role="button" aria-label="${label}" ${attrs}>
    <span class="cc-c">${f.small}${shape}</span><span class="cc-mid">${f.big}</span><span class="cc-c cc-br">${f.small}${shape}</span></div>`;
}
export const colorShape = c => CSHAPES[c];

/* ---------------- Blackjack: the table ---------------- */

const RES = { bj: 'Blackjack!', win: 'Win', push: 'Push', lose: 'Lose', bust: 'Bust' };

export function renderBJ(box, x) {
  const { A, pid, esc, rackStyle } = x;
  const S = A.S, b = S.bj;
  if (!b) { box.innerHTML = ''; return; }
  // Only cards that weren't on the table last time slide in; the rest stay put when the screen is redrawn.
  const seen = A.bjSeen || new Set(), now = new Set();
  const card = (key, c) => { now.add(key); return pcard(c, seen.has(key) ? '' : 'deal'); };
  const dealerCards = b.dealer.map((c, i) => card(`d${b.n}:${i}:${i === 1 && b.hole}`, i === 1 && b.hole ? null : c)).join('');
  const dt = b.dealer.length ? total(b.hole ? [b.dealer[0]] : b.dealer).t : 0;
  const dBust = !b.hole && dt > 21;
  let info = '';
  if (b.stage === 'bet') info = 'Place your bets';
  else if (b.stage === 'play') { const c = S.players.find(p => p.pid === b.cur.pid); info = c ? (c.pid === pid ? 'Your turn' : `${esc(c.name)}'s turn`) : ''; }
  else if (b.stage === 'dealer') info = "Dealer's turn";
  else if (b.stage === 'settle') info = b.peek ? 'Dealer blackjack' : dBust ? 'Dealer busts!' : 'Results';
  const spots = S.players.filter(p => p.seat).map(p => {
    const hs = b.hands[p.pid];
    const mine = p.pid === pid;
    let inner;
    if (hs && hs.length) {
      inner = hs.map((h, i) => {
        const active = b.stage === 'play' && b.cur && b.cur.pid === p.pid && b.cur.h === i;
        const t = total(h.cards);
        const tot = isBJ(h) ? 'BJ' : (t.soft && t.t < 21 && !h.done ? `${t.t - 10}/${t.t}` : t.t);
        const res = h.res ? `<span class="bj-res r-${h.res}">${RES[h.res]}${h.net ? ` ${h.net > 0 ? '+' : '−'}${money(Math.abs(h.net))}` : ''}</span>` : '';
        return `<div class="bj-hand ${active ? 'active' : ''} ${h.bust ? 'bust' : ''}">
          <div class="bj-cards">${h.cards.map((c, k) => card(`${b.n}:${p.pid}:${i}:${k}:${c}`, c)).join('')}</div>
          <div class="bj-meta"><span class="bj-tot">${tot}</span><span class="bj-bet">${money(h.bet)}${h.doubled ? ' ×2' : ''}</span>${res}</div></div>`;
      }).join('');
    } else if (b.stage === 'bet') {
      inner = b.bets[p.pid] ? `<div class="bj-wait ok"><span class="chipdot"></span>${money(b.bets[p.pid])}</div>`
        : b.sit[p.pid] ? '<div class="bj-wait">Sitting out</div>' : '<div class="bj-wait">Betting…</div>';
    } else inner = '<div class="bj-wait">Sitting out</div>';
    const cur = b.stage === 'play' && b.cur && b.cur.pid === p.pid;
    return `<div class="bj-spot ${cur ? 'cur' : ''} ${mine ? 'mine' : ''}" style="${rackStyle(p.rc)}">
      <div class="bj-name"><span>${esc(p.name)}</span><b>${money(p.chips)}</b></div>${inner}
      ${p.buy ? `<div class="bj-buy" title="Free buy-backs">Buy-backs ×${p.buy}</div>` : ''}</div>`;
  }).join('');
  A.bjSeen = now;
  box.innerHTML = `<div class="bj-table">
    <div class="bj-dealer">
      <div class="bj-dlabel">Dealer${b.dealer.length ? ` <b class="bj-tot ${dBust ? 'bust' : ''}">${b.hole ? dt + ' + ?' : dt}</b>` : ''}</div>
      <div class="bj-cards big">${dealerCards || pcard(null, 'ghostcard') + pcard(null, 'ghostcard')}</div>
      <div class="bj-rule">Dealer ${b.cfg.s17 === 'hit' ? 'hits' : 'stands on'} soft 17 · Blackjack pays ${b.cfg.pays.replace(':', ' to ')}</div>
    </div>
    <div class="bj-info">${info}</div>
    <div class="bj-spots" data-n="${S.players.filter(p => p.seat).length}">${spots}</div>
  </div>`;
}

// The buttons along the bottom for Blackjack.
export function bjControls(x) {
  const { A, pid, esc, ic, rackStyle } = x;
  const S = A.S, b = S.bj, m = S.players.find(p => p.pid === pid);
  if (!b) return '';
  if (!m || !m.seat) return `<span class="poolchip">Watching this game</span>`;
  const cfg = b.cfg;
  const bal = `<span class="poolchip money" title="Your money">${ic('chip')}<b>${money(m.chips)}</b></span>`;
  if (b.stage === 'bet') {
    const placed = b.bets[pid];
    if (placed) {
      const waiting = S.players.some(p => p.seat && p.on && !b.bets[p.pid] && !b.sit[p.pid]);
      return `${bal}<span class="turnchip" style="${rackStyle(m.rc)}">Bet ${money(placed)}</span>
        <button class="btn" data-act="g:unbet">${ic('undo')}Change</button>
        ${waiting && S.host === pid ? `<button class="btn go" data-act="g:deal">${ic('cards')}Deal now</button>` : ''}`;
    }
    if (m.chips < cfg.min) return `${bal}<button class="btn go" data-act="g:buyback">${ic('plus')}Free buy-back · ${money(cfg.chips)}</button>`;
    const amt = Math.max(cfg.min, Math.min(m.chips, A.bjBet || m.lastBet || cfg.min));
    A.bjBet = amt;
    const chips = [1, 5, 10, 50].map(k => k * cfg.min).filter(v => v <= m.chips);
    return `${bal}<span class="betbox">
        ${chips.map(v => `<button class="pokerchip c${chips.indexOf(v)}" data-act="betadd" data-v="${v}" aria-label="Add ${money(v)}">${v >= 1000 ? v / 1000 + 'k' : v}</button>`).join('')}
        <button class="btn" data-act="betclear" aria-label="Back to the smallest bet">${ic('reset')}</button>
      </span>
      <button class="btn go" data-act="g:bet" data-amt="${amt}">${ic('check')}Bet ${money(amt)}</button>
      ${b.sit[pid] ? '<span class="poolchip">Sitting out</span>' : `<button class="btn" data-act="g:sit">Sit out</button>`}`;
  }
  if (b.stage === 'play') {
    const o = options(S, m);
    if (o) {
      return `${bal}<button class="btn go" data-act="g:hit">${ic('plus')}Hit</button>
        <button class="btn draw" data-act="g:stand">${ic('stop')}Stand</button>
        <button class="btn" data-act="g:double" ${o.double ? '' : 'disabled'}>×2 Double</button>
        <button class="btn" data-act="g:split" ${o.split ? '' : 'disabled'}>${ic('split')}Split</button>`;
    }
    const c = S.players.find(p => p.pid === b.cur.pid);
    return `${bal}${c ? `<span class="turnchip" style="${rackStyle(c.rc)}">${c.cpu ? ic('bot') : ''}${esc(c.name)}</span>` : ''}
      ${c && !c.on ? `<button class="btn" data-act="skip">${ic('skip')}Skip</button>` : ''}`;
  }
  if (b.stage === 'dealer') return `${bal}<span class="turnchip dealerchip">Dealer</span>`;
  return `${bal}<button class="btn go" data-act="g:next">${ic('arrow')}Next hand</button>`;
}

/* ---------------- Color Clash: the table ---------------- */

export function renderUno(box, x) {
  const { A, pid, esc, rackStyle } = x;
  const S = A.S, u = S.uno;
  if (!u) { box.innerHTML = ''; return; }
  const cur = S.players.find(p => p.pid === S.turn);
  const mine = cur && cur.pid === pid;
  const under = u.pile.slice(-4, -1);
  const top = u.pile[u.pile.length - 1];
  // a little scatter in the pile: each card keeps the same tilt every time it is drawn
  const tilt = id => ((id * 37) % 25) - 12;
  const pile = under.map(id => ccard(id, 'under', `style="--r:${tilt(id)}deg"`)).join('') + ccard(top, 'top ' + (u.last && u.last.k > (A.unoSeen || 0) ? 'landed' : ''), `style="--r:${tilt(top) / 3}deg"`);
  A.unoSeen = u.last ? u.last.k : 0;
  const by = u.last && S.players.find(p => p.pid === u.last.pid);
  const canDraw = mine && u.drawn == null;
  box.innerHTML = `<div class="cc-table" style="--cur:${CC_COLORS[u.color]}">
    <div class="cc-ring ${u.dir < 0 ? 'ccw' : ''}" aria-hidden="true"></div>
    <div class="cc-piles">
      <button class="cc-deck" data-act="${canDraw ? 'g:draw' : ''}" ${canDraw ? '' : 'disabled'} aria-label="${u.pend ? 'Take the cards' : 'Draw a card'}">
        ${ccard(null, 'd3')}${ccard(null, 'd2')}${ccard(null, 'd1')}<span class="cc-count">${u.deck.length}</span></button>
      <div class="cc-pile">${pile}${by ? `<span class="cc-by" style="${rackStyle(by.rc)}">${esc(by.name)}</span>` : ''}</div>
    </div>
    <div class="cc-now">
      <span class="cc-color" style="background:${CC_COLORS[u.color]}">${colorShape(u.color)}${COLOR_NAMES[u.color]}</span>
      ${u.pend ? `<span class="cc-pend">+${u.pend}</span>` : ''}
      <span class="cc-dirlabel">${u.dir > 0 ? '↻' : '↺'}</span>
    </div>
  </div>`;
}

// My cards along the bottom: the ones I can play now stand up; tap one to play it.
export function unoHand(el, x) {
  const { A, pid } = x;
  const S = A.S, u = S.uno, m = S.players.find(p => p.pid === pid);
  if (!u || !m || !m.seat) { el.innerHTML = ''; return; }
  const can = new Set(playable(S, m));
  const myTurn = S.turn === pid;
  const order = m.hand.slice().sort((a, b) => CARD[a].c - CARD[b].c || CARD[a].v - CARD[b].v || a - b);
  el.style.setProperty('--n', order.length);
  el.innerHTML = order.map(id => ccard(id, [myTurn ? (can.has(id) ? 'ok' : 'no') : '', id === u.drawn ? 'new' : '', A.wildPick === id ? 'picking' : ''].join(' '), `data-act="${myTurn && can.has(id) ? 'cplay' : ''}" data-id="${id}"`)).join('')
    + (A.wildPick != null && can.has(A.wildPick) ? `<div class="wildpick" role="dialog" aria-label="Choose a color">${[0, 1, 2, 3].map(c => `<button class="wp" data-act="cwild" data-col="${c}" style="background:${CC_COLORS[c]}" aria-label="${COLOR_NAMES[c]}">${colorShape(c)}<span>${COLOR_NAMES[c]}</span></button>`).join('')}</div>` : '');
}

export function unoControls(x) {
  const { A, pid, esc, ic, rackStyle } = x;
  const S = A.S, u = S.uno, m = S.players.find(p => p.pid === pid);
  if (!u) return '';
  if (!m || !m.seat) return `<span class="poolchip">Watching this game</span>`;
  if (S.turn === pid) {
    if (u.pend) return `<span class="turnchip" style="${rackStyle(m.rc)}">Your turn</span><button class="btn draw" data-act="g:draw">${ic('draw')}Take ${u.pend}</button>`;
    if (u.drawn != null) return `<span class="turnchip" style="${rackStyle(m.rc)}">Your turn</span><button class="btn draw" data-act="g:pass">${ic('skip')}Keep it</button>`;
    return `<span class="turnchip" style="${rackStyle(m.rc)}">Your turn</span><button class="btn draw" data-act="g:draw">${ic('draw')}Draw</button>`;
  }
  const c = S.players.find(p => p.pid === S.turn);
  return `${c ? `<span class="turnchip" style="${rackStyle(c.rc)}">${c.cpu ? ic('bot') : ''}${esc(c.name)}</span>` : ''}
    ${c && !c.on ? `<button class="btn" data-act="skip">${ic('skip')}Skip</button>` : ''}
    <span class="poolchip">${ic('draw')}<b>${u.deck.length}</b></span>`;
}

export { money, isWild };
