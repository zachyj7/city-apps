// What Chess, Checkers and Mancala look like, and what a tap on the board does. Moves go to the referee as
// { t: 'g', a: 'move', ... } (see chess.js, checkers.js, mancala.js). Each player sees the board from their
// own side; people watching see it from Player 1's side.
import { legal as chessLegal, NAMES } from './chess.js';
import { legal as ckLegal, count as ckCount } from './checkers.js';
import { legal as mcLegal, pitsOf, STORE } from './mancala.js';

const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const VS = '︎';   // draw as a plain symbol, never as an emoji
export const chessGlyph = x => `<span class="cp ${x === x.toUpperCase() ? 'w' : 'b'}" aria-hidden="true">${GLYPH[x.toLowerCase()]}${VS}</span>`;

// The turn buttons float over the bottom of the middle of the screen: keep the board clear of them.
const controlsRoom = () => { const c = document.getElementById('controls'); return c && c.offsetHeight ? c.offsetHeight + 8 : 56; };
// The board is as big as the middle of the screen allows, leaving room for a name bar above and below it.
function sizeFor(box, bars = 2) {
  const m = box.parentElement, cs = getComputedStyle(m);
  const w = m.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 8;
  const h = m.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - bars * 50 - 16 - controlsRoom();
  return Math.max(220, Math.floor(Math.min(w, h)));
}

// A name bar for one player: their color, their name, whose turn, and a little extra (pieces taken, seeds).
function bar(x, p, extra, turn) {
  const { esc, rackStyle, ic, pid } = x;
  if (!p) return '<div class="bg-pl"></div>';
  return `<div class="bg-pl ${turn ? 'turn' : ''}" style="${rackStyle(p.rc)}">
    <span class="bg-name">${p.cpu ? ic('bot') : ''}${esc(p.name)}${p.pid === pid ? ' <small>(you)</small>' : ''}</span>
    <span class="bg-extra">${extra || ''}</span>${turn ? `<span class="bg-turn">${p.pid === pid ? 'Your turn' : 'Their turn'}</span>` : ''}</div>`;
}
const pl = (S, id) => S.players.find(q => q.pid === id);
const live = S => S.phase === 'play';

/* ---------------- Chess ---------------- */

export function renderChess(box, x) {
  const { A, pid } = x;
  const S = A.S, c = S.chess;
  if (!c) { box.innerHTML = ''; return; }
  const flip = pid === c.bl;
  const mine = live(S) && S.turn === pid;
  const moves = mine ? chessLegal(c) : [];
  const from = new Set(moves.map(m => m.f));
  if (!from.has(A.bsel)) A.bsel = null;
  const to = new Map(moves.filter(m => m.f === A.bsel).map(m => [m.t, m]));
  const king = c.check ? c.b.indexOf(c.side === 'w' ? 'K' : 'k') : -1;
  let sq = '';
  for (let v = 0; v < 64; v++) {
    const i = flip ? 63 - v : v, r = i >> 3, col = i & 7, x0 = c.b[i];
    const cls = ['sq', (r + col) % 2 ? 'dk' : 'lt',
      c.last && (c.last.f === i || c.last.t === i) ? 'last' : '', A.bsel === i ? 'sel' : '', to.has(i) ? (x0 || to.get(i).ep ? 'hit' : 'to') : '',
      i === king ? 'check' : '', from.has(i) ? 'can' : ''].join(' ');
    const vr = v >> 3, vc = v & 7;
    const coord = (vc === 0 ? `<i class="rk">${8 - r}</i>` : '') + (vr === 7 ? `<i class="fl">${'abcdefgh'[col]}</i>` : '');
    const label = x0 ? `${x0 === x0.toUpperCase() ? 'White' : 'Black'} ${NAMES[x0.toLowerCase()]}` : 'Empty';
    sq += `<button class="${cls}" data-act="bsq" data-sq="${i}" aria-label="${'abcdefgh'[col]}${8 - r} ${label}">${x0 ? chessGlyph(x0) : ''}${coord}</button>`;
  }
  const cap = side => c.cap.filter(k => (side === 'w' ? k === k.toLowerCase() : k === k.toUpperCase())).map(chessGlyph).join('');
  const W = pl(S, c.w), B = pl(S, c.bl);
  const top = flip ? W : B, bot = flip ? B : W;
  const topSide = flip ? 'w' : 'b', botSide = flip ? 'b' : 'w';
  const turnSide = c.side;
  const promo = A.promo ? `<div class="bg-promo" role="dialog" aria-label="Turn your pawn into">${'qrbn'.split('').map(p => `<button data-act="bpromo" data-p="${p}" aria-label="${NAMES[p]}">${chessGlyph(c.side === 'w' ? p.toUpperCase() : p)}</button>`).join('')}</div>` : '';
  box.innerHTML = `<div class="bg-wrap" style="--sz:${sizeFor(box)}px">
    ${bar(x, top, `<span class="bg-cap">${cap(topSide)}</span>`, live(S) && turnSide === topSide)}
    <div class="bg-board chess ${mine ? 'mine' : ''}">${sq}${promo}</div>
    ${bar(x, bot, `<span class="bg-cap">${cap(botSide)}</span>`, live(S) && turnSide === botSide)}
  </div>`;
}

/* ---------------- Checkers ---------------- */

export function renderCheckers(box, x) {
  const { A, pid } = x;
  const S = A.S, k = S.ck;
  if (!k) { box.innerHTML = ''; return; }
  const flip = pid === k.bp;
  const mine = live(S) && S.turn === pid;
  const moves = mine ? ckLegal(k, k.must) : [];
  const from = new Set(moves.map(m => m.f));
  if (k.chain >= 0 && mine) A.bsel = k.chain;
  if (!from.has(A.bsel)) A.bsel = null;
  const to = new Map(moves.filter(m => m.f === A.bsel).map(m => [m.t, m]));
  const path = new Set(k.last ? k.last.path : []);
  let sq = '';
  for (let v = 0; v < 64; v++) {
    const i = flip ? 63 - v : v, r = i >> 3, col = i & 7, p = k.b[i];
    const dark = (r + col) % 2 === 1;
    const cls = ['sq', dark ? 'dk' : 'lt', path.has(i) ? 'last' : '', A.bsel === i ? 'sel' : '', to.has(i) ? (to.get(i).cap != null ? 'hit' : 'to') : '', from.has(i) ? 'can' : ''].join(' ');
    const piece = p ? `<span class="ck ${p.toLowerCase()} ${p === p.toUpperCase() ? 'king' : ''}" aria-hidden="true">${p === p.toUpperCase() ? '<b>♛︎</b>' : ''}</span>` : '';
    const label = p ? `${p.toLowerCase() === 'a' ? 'Red' : 'White'} ${p === p.toUpperCase() ? 'king' : 'piece'}` : 'Empty';
    sq += dark ? `<button class="${cls}" data-act="bsq" data-sq="${i}" aria-label="${label}">${piece}</button>` : `<span class="${cls}"></span>`;
  }
  const R = pl(S, k.a), Wh = pl(S, k.bp);
  const top = flip ? R : Wh, bot = flip ? Wh : R;
  const topSide = flip ? 'a' : 'b', botSide = flip ? 'b' : 'a';
  const left = side => `<span class="ck mini ${side}"></span>${ckCount(k.b, side)} left`;
  box.innerHTML = `<div class="bg-wrap" style="--sz:${sizeFor(box)}px">
    ${bar(x, top, left(topSide), live(S) && k.side === topSide)}
    <div class="bg-board checkers ${mine ? 'mine' : ''}">${sq}</div>
    ${bar(x, bot, left(botSide), live(S) && k.side === botSide)}
    ${mine && k.chain >= 0 ? '<div class="bg-hint">Keep jumping!</div>' : ''}
  </div>`;
}

/* ---------------- Mancala ---------------- */

// Seeds sit in a little heap: placed on a spiral so each pit keeps the same look from one turn to the next.
function seeds(n, big) {
  const show = Math.min(n, big ? 40 : 24), out = [];
  for (let i = 0; i < show; i++) {
    const a = i * 2.39996, d = Math.sqrt(i + 0.5) / Math.sqrt(show + 0.5) * (big ? 34 : 30);
    out.push(`<i class="seed s${i % 5}" style="left:${(50 + Math.cos(a) * d).toFixed(1)}%;top:${(50 + Math.sin(a) * d * (big ? 1.5 : 1)).toFixed(1)}%"></i>`);
  }
  return out.join('');
}

export function renderMancala(box, x) {
  const { A, pid } = x;
  const S = A.S, g = S.mc;
  if (!g) { box.innerHTML = ''; return; }
  const me = g.pl[1] === pid ? 1 : 0, op = 1 - me;
  const mine = live(S) && S.turn === pid;
  const can = new Set(mine ? mcLegal(g) : []);
  const last = g.last || {};
  const pit = i => `<button class="pit ${can.has(i) ? 'can' : ''} ${last.from === i ? 'from' : ''} ${last.to === i ? 'to' : ''}" data-act="${can.has(i) ? 'bpit' : ''}" data-i="${i}" ${can.has(i) ? '' : 'tabindex="-1"'} aria-label="${g.p[i]} seeds">
      <span class="heap">${seeds(g.p[i])}</span><b class="n">${g.p[i]}</b></button>`;
  const store = s => `<div class="store ${last.to === STORE[s] ? 'to' : ''}" aria-label="${g.p[STORE[s]]} seeds in the store"><span class="heap">${seeds(g.p[STORE[s]], true)}</span><b class="n">${g.p[STORE[s]]}</b></div>`;
  const P = [pl(S, g.pl[0]), pl(S, g.pl[1])];
  // Sizes: the board is about 2.4 times as wide as it is tall.
  const m = box.parentElement, cs = getComputedStyle(m);
  const w = m.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 8;
  const h = m.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 2 * 50 - 16 - controlsRoom();
  const bw = Math.max(300, Math.floor(Math.min(w, h * 2.4)));
  box.innerHTML = `<div class="bg-wrap mc" style="--bw:${bw}px">
    ${bar(x, P[op], `${g.p[STORE[op]]} in store`, live(S) && g.side === op)}
    <div class="mc-board ${mine ? 'mine' : ''}">
      ${store(op)}
      <div class="mc-row top">${pitsOf(op).slice().reverse().map(pit).join('')}</div>
      <div class="mc-row bot">${pitsOf(me).map(pit).join('')}</div>
      ${store(me)}
    </div>
    ${bar(x, P[me], `${g.p[STORE[me]]} in store`, live(S) && g.side === me)}
  </div>`;
}

/* ---------------- buttons along the bottom ---------------- */

export function boardControls(x) {
  const { A, pid, esc, ic, rackStyle } = x;
  const S = A.S, m = S.players.find(p => p.pid === pid);
  const cur = S.players.find(p => p.pid === S.turn);
  const who = cur ? `<span class="turnchip" style="${rackStyle(cur.rc)}">${cur.cpu ? ic('bot') : ''}${cur.pid === pid ? 'Your turn' : esc(cur.name)}</span>` : '';
  if (!m || !m.seat) return `${who}<span class="poolchip">Watching this game</span>`;
  const armed = A.resignArm && Date.now() - A.resignArm < 4000;
  return `${who}<button class="btn ${armed ? 'armed' : ''}" data-act="bresign">${ic('close')}${armed ? 'Tap again to give up' : 'Give up'}</button>`;
}

// A tap on a square. Returns the move to send, if there is one.
export function boardTap(A, pid, sq) {
  const S = A.S;
  if (!S || S.phase !== 'play' || S.turn !== pid) return null;
  if (S.game === 'chess') {
    const c = S.chess, ms = chessLegal(c);
    const hit = ms.filter(m => m.f === A.bsel && m.t === sq);
    if (hit.length > 1) { A.promo = { f: A.bsel, t: sq }; return null; }
    if (hit.length) { A.bsel = null; A.promo = null; return { a: 'move', f: hit[0].f, to: sq }; }
    A.promo = null;
    A.bsel = A.bsel !== sq && ms.some(m => m.f === sq) ? sq : null;
    return null;
  }
  if (S.game === 'checkers') {
    const k = S.ck, ms = ckLegal(k, k.must);
    const hit = ms.find(m => m.f === A.bsel && m.t === sq);
    if (hit) { A.bsel = null; return { a: 'move', f: hit.f, to: sq }; }
    if (k.chain >= 0) return null;
    A.bsel = A.bsel !== sq && ms.some(m => m.f === sq) ? sq : null;
    // must jump: a tap on a piece that can't jump says why nothing happens
    if (A.bsel == null && k.b[sq] && k.b[sq].toLowerCase() === k.side && ms.some(m => m.cap != null)) A.why = 'You have to jump when you can.';
    return null;
  }
  return null;
}
