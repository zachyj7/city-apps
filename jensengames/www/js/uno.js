// Color Clash: the referee side. Match the top card's color or number; first to empty their hand wins.
// +2 and +4 cards stack: a +4 can go on a +4 or a +2 (and a +2 on a +2, if the host allows it), and the
// next player who can't add to the pile takes the lot.
//
// A card is a number 0-107. Each of the four colors has one 0, two each of 1-9, and two each of Skip, Reverse
// and +2 (25 cards); then 4 Wild and 4 Wild +4.

export const SKIP = 10, REV = 11, PLUS2 = 12, WILD = 13, PLUS4 = 14;
export const CARD = (() => {
  const out = [];
  for (let c = 0; c < 4; c++) {
    out.push({ c, v: 0 });
    for (let v = 1; v <= 12; v++) { out.push({ c, v }); out.push({ c, v }); }
  }
  for (let i = 0; i < 4; i++) out.push({ c: 4, v: WILD });
  for (let i = 0; i < 4; i++) out.push({ c: 4, v: PLUS4 });
  return out;
})();
export const COLOR_NAMES = ['Red', 'Yellow', 'Green', 'Blue'];
export const isWild = id => CARD[id].c === 4;

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const seated = s => s.players.filter(p => p.seat);

// Can this card go on the pile right now?
export function canPlay(u, id) {
  const k = CARD[id], top = CARD[u.pile[u.pile.length - 1]];
  if (u.pend) {
    if (k.v === PLUS4) return true;
    return k.v === PLUS2 && u.pendKind === 2 && u.cfg.stack2 === 'yes';
  }
  if (k.c === 4) return true;
  return k.c === u.color || (top.c !== 4 && k.v === top.v);
}

// The cards in this player's hand they may play now (only the one just drawn, after drawing).
export function playable(s, p) {
  const u = s.uno;
  if (!u || s.phase !== 'play' || s.turn !== p.pid) return [];
  if (u.drawn != null) return p.hand.includes(u.drawn) && canPlay(u, u.drawn) ? [u.drawn] : [];
  return p.hand.filter(id => canPlay(u, id));
}

export const UNO = {
  start(room, seats, cfg) {
    const s = room.s;
    const deck = shuffle(Array.from({ length: 108 }, (_, i) => i));
    for (const q of seats) q.hand = deck.splice(0, cfg.hand);
    // the first card turned up is a number card
    let i = deck.findIndex(id => CARD[id].v <= 9);
    const first = deck.splice(i, 1)[0];
    s.uno = { cfg, deck, pile: [first], color: CARD[first].c, dir: 1, pend: 0, pendKind: 0, drawn: null, last: null };
    s.turn = seats[(s.round - 1) % seats.length].pid;
    room.note(`Color Clash! ${room.player(s.turn).name} goes first.`);
  },

  act(room, p, m) {
    const s = room.s, u = s.uno;
    if (!u || s.turn !== p.pid) return;
    if (m.a === 'play') {
      const id = Math.floor(+m.id);
      if (!p.hand.includes(id) || !playable(s, p).includes(id)) return;
      let col = null;
      if (isWild(id)) { col = Math.floor(+m.col); if (!(col >= 0 && col <= 3)) return; }
      return playCard(room, p, id, col);
    }
    if (m.a === 'draw') {
      if (u.drawn != null) return;
      if (u.pend) return take(room, p);
      return drawFor(room, p);
    }
    if (m.a === 'pass') {
      if (u.drawn == null) return;
      u.drawn = null;
      return next(room, 1);
    }
  },

  auto(s) {
    const u = s.uno;
    if (!u || s.phase !== 'play') return null;
    const p = s.players.find(q => q.pid === s.turn);
    if (p && p.cpu) return { key: 'cpu:' + s.turnNo + ':' + (u.drawn != null), ms: 1100 + Math.random() * 900 };
    return null;
  },

  run(room, key) {
    const s = room.s, t = UNO.auto(s);
    if (!t || t.key !== key) return;
    cpuTurn(room, room.player(s.turn));
  },

  // Someone is away on their turn: they draw (or take the stack), and play moves on.
  skip(room, cur) {
    const u = room.s.uno;
    if (!u) return;
    room.note(`${cur.name} was skipped (away)`);
    if (u.drawn != null) { u.drawn = null; return next(room, 1); }
    if (u.pend) return take(room, cur);
    drawFor(room, cur, true);
  },

  end(room) { room.finish(null); },
};

function refill(u) {
  if (u.deck.length) return true;
  if (u.pile.length < 2) return false;
  const top = u.pile.pop();
  u.deck = shuffle(u.pile);
  u.pile = [top];
  return true;
}
function drawOne(u, p) { if (!refill(u)) return null; const id = u.deck.pop(); p.hand.push(id); return id; }

function nextIndex(s, steps) {
  const seats = seated(s), i = seats.findIndex(q => q.pid === s.turn);
  const n = seats.length;
  return seats[(((i + steps * s.uno.dir) % n) + n) % n];
}
function next(room, steps) {
  const s = room.s;
  s.turn = nextIndex(s, steps).pid;
  s.turnNo++;
  room.push();
}

function playCard(room, p, id, col) {
  const s = room.s, u = s.uno, k = CARD[id];
  p.hand.splice(p.hand.indexOf(id), 1);
  u.pile.push(id);
  if (u.pile.length > 40) u.deck.unshift(...u.pile.splice(0, u.pile.length - 40));   // keep the pile short in the snapshot
  u.color = k.c === 4 ? col : k.c;
  u.drawn = null;
  u.last = { pid: p.pid, id, col: u.color, k: s.v + 1 };
  if (!p.hand.length) {
    room.note(`${p.name} played their last card!`);
    return room.finish(p);
  }
  if (p.hand.length === 1) {
    s.ann = { pid: p.pid, name: p.name, rc: p.rc, kind: 'last', text: `${p.name} has one card left!`, sub: 'Last card!', k: s.v + 1 };
  }
  const seats = seated(s);
  let steps = 1;
  if (k.v === SKIP) steps = 2;
  else if (k.v === REV) { u.dir *= -1; if (seats.length === 2) steps = 2; }
  else if (k.v === PLUS2) { u.pend += 2; u.pendKind = 2; }
  else if (k.v === PLUS4) { u.pend += 4; u.pendKind = 4; }
  if (u.pend && (k.v === PLUS2 || k.v === PLUS4) && u.pend > (k.v === PLUS2 ? 2 : 4)) room.note(`${p.name} stacked it: +${u.pend}!`);
  if (k.v === SKIP) {
    const who = nextIndex(s, 1);
    s.ann = { pid: who.pid, name: who.name, rc: who.rc, kind: 'skip', text: `${who.name} is skipped`, sub: 'Skip!', k: s.v + 1 };
  }
  next(room, steps);
}

// Can't (or won't) add to a +2/+4 stack: take every card in it, and the turn is over.
function take(room, p) {
  const s = room.s, u = s.uno, n = u.pend;
  let got = 0;
  for (let i = 0; i < n; i++) if (drawOne(u, p) != null) got++;
  u.pend = 0; u.pendKind = 0;
  s.ann = { pid: p.pid, name: p.name, rc: p.rc, kind: 'take', text: `${p.name} takes ${got}`, sub: `+${got}`, k: s.v + 1 };
  room.note(`${p.name} picked up ${got} cards`);
  next(room, 1);
}

function drawFor(room, p, away) {
  const s = room.s, u = s.uno;
  let id = drawOne(u, p), n = id == null ? 0 : 1;
  if (u.cfg.draw === 'until') while (id != null && !canPlay(u, id)) { id = drawOne(u, p); if (id != null) n++; }
  s.drew = { pid: p.pid, name: p.name, rc: p.rc, pass: !n, n, k: s.v + 1 };
  if (id != null && canPlay(u, id) && !away) {
    u.drawn = id;   // they may play it, or keep it
    s.turnNo++;
    return room.push();
  }
  next(room, 1);
}

/* ---------------- computer players ---------------- */

function bestColor(hand) {
  const n = [0, 0, 0, 0];
  for (const id of hand) if (CARD[id].c < 4) n[CARD[id].c]++;
  const m = Math.max(...n);
  return m ? n.indexOf(m) : Math.floor(Math.random() * 4);
}

function cpuTurn(room, p) {
  const s = room.s, u = s.uno;
  const can = playable(s, p);
  if (!can.length) {
    if (u.drawn != null) { u.drawn = null; return next(room, 1); }
    if (u.pend) return take(room, p);
    return drawFor(room, p);
  }
  const nextP = nextIndex(s, 1);
  const danger = nextP.hand.length <= 2;
  let pick;
  if (p.cpu === 'easy') pick = can[Math.floor(Math.random() * can.length)];
  else {
    const score = id => {
      const k = CARD[id];
      let sc = 0;
      if (k.c !== 4) sc += 20 + k.v / 2;              // play colored cards first, high ones first
      if (k.c === u.color) sc += 3;
      if (k.v === WILD) sc = 4;
      if (k.v === PLUS4) sc = u.pend ? 30 : 2;        // save the +4 for when it is needed
      if (p.cpu === 'hard' && danger && (k.v === SKIP || k.v === REV || k.v === PLUS2 || k.v === PLUS4)) sc += 40;
      if (p.cpu === 'hard' && p.hand.length <= 2 && k.c === 4) sc += 10;
      return sc;
    };
    pick = can.slice().sort((a, b) => score(b) - score(a))[0];
  }
  const rest = p.hand.filter(id => id !== pick);
  playCard(room, p, pick, isWild(pick) ? bestColor(rest.length ? rest : p.hand) : null);
}
