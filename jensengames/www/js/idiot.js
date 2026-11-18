// Idiot (also known by a ruder name): the referee side. Nobody wants to be the last one holding cards.
// Everyone gets 3 cards face down, 3 face up on top of them, and 3 in hand. Before play, swap hand cards with
// your face-up ones. Then play one or more cards of the same rank, equal to or higher than the top of the pile
// (aces high), and draw back up to 3 while the deck lasts. A 2 can go on anything and anything can go on a 2;
// a 10 (or four of the same rank in a row) burns the pile and you go again. Can't play? Pick up the pile.
// With your hand gone, play your face-up cards, then your face-down ones blind. First one out wins; the last
// one left with cards is the Idiot.
//
// Cards are 0-51 as in Blackjack: rank = id % 13 (0 ace ... 12 king), suit = id / 13.
import { rankOf } from './bj.js';

export const val = id => (rankOf(id) === 0 ? 14 : rankOf(id) + 1);   // 2..14, aces high
const RESET = 2, BURN = 10;
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const seated = s => s.players.filter(p => p.seat);

// The card that counts on the pile (the top one), or null when anything goes.
const topOf = g => (g.pile.length ? g.pile[g.pile.length - 1] : null);
export function canPlay(g, id) {
  const v = val(id), top = topOf(g);
  if (v === RESET || v === BURN || top == null || val(top) === RESET) return true;
  return v >= val(top);
}
// Where this player plays from now: their hand, then face-up cards, then face-down ones.
export function source(g, p) {
  if (p.hand.length) return 'hand';
  if ((g.up[p.pid] || []).length) return 'up';
  if ((g.down[p.pid] || []).length) return 'down';
  return null;
}
const outOf = (g, p) => !p.hand.length && !(g.up[p.pid] || []).length && !(g.down[p.pid] || []).length;

export const IDIOT = {
  start(room, seats) {
    const s = room.s, deck = shuffle(Array.from({ length: seats.length > 5 ? 104 : 52 }, (_, i) => i));   // two decks for 6+ (ids 52-103 are the second)
    const g = s.id = { deck, pile: [], burned: 0, down: {}, up: {}, ready: {}, out: [], last: null, stage: 'swap', why: null };
    for (const q of seats) { g.down[q.pid] = deck.splice(0, 3); g.up[q.pid] = deck.splice(0, 3); q.hand = deck.splice(0, 3); }
    // computers put their best cards face up and are ready straight away
    for (const q of seats) if (q.cpu) { cpuSwap(g, q); g.ready[q.pid] = true; }
    s.turn = seats[(s.round - 1) % seats.length].pid;
    room.note('Idiot! Swap cards with your face-up ones, then press Ready.');
  },

  act(room, p, m) {
    const s = room.s, g = s.id;
    if (!g || !p.seat || g.out.includes(p.pid)) return;
    if (g.stage === 'swap') {
      if (m.a === 'swap') {
        const h = Math.floor(+m.h), u = Math.floor(+m.u), up = g.up[p.pid];
        const hi = p.hand.indexOf(h), ui = up.indexOf(u);
        if (hi < 0 || ui < 0 || g.ready[p.pid]) return;
        p.hand[hi] = u; up[ui] = h;
        return room.push();
      }
      if (m.a === 'ready') { g.ready[p.pid] = true; return begin(room); }
      return;
    }
    if (s.turn !== p.pid) return;
    if (m.a === 'take') return take(room, p);
    if (m.a === 'play') {
      const src = source(g, p);
      if (src === 'down') {
        const i = Math.floor(+m.i), down = g.down[p.pid];
        if (!(i >= 0 && i < down.length)) return;
        return flip(room, p, i);
      }
      const from = src === 'hand' ? p.hand : g.up[p.pid];
      const ids = Array.isArray(m.ids) ? [...new Set(m.ids.map(x => Math.floor(+x)))] : [];
      if (!ids.length || !ids.every(id => from.includes(id)) || !ids.every(id => rankOf(id) === rankOf(ids[0])) || !canPlay(g, ids[0])) return;
      return play(room, p, ids, src);
    }
  },

  auto(s) {
    const g = s.id;
    if (!g || s.phase !== 'play') return null;
    // someone who dropped off during the swap is made ready after a while, so nobody waits forever
    if (g.stage === 'swap') return s.players.some(q => q.seat && !q.on && !g.ready[q.pid]) ? { key: 'away:' + s.v, ms: 15000 } : null;
    const p = s.players.find(q => q.pid === s.turn);
    return p && p.cpu ? { key: 'cpu:' + s.turnNo, ms: 900 + Math.random() * 700 } : null;
  },
  run(room, key) {
    const s = room.s, t = IDIOT.auto(s);
    if (!t || t.key !== key) return;
    if (key.startsWith('away:')) return IDIOT.skip(room, null);
    cpuTurn(room, room.player(s.turn));
  },
  // someone is away: they are made ready, or their turn is played for them
  skip(room, cur) {
    const g = room.s.id;
    if (!g) return;
    if (g.stage === 'swap') { for (const q of seated(room.s)) if (!q.on) g.ready[q.pid] = true; return begin(room); }
    cpuTurn(room, cur);
  },
  end(room) { if (room.s.id) room.s.id.why = 'The host ended the game'; room.finish(null); },
};

function begin(room) {
  const s = room.s, g = s.id;
  const people = seated(s);
  if (people.every(q => g.ready[q.pid])) {
    g.stage = 'play'; s.turnNo++;
    room.note(`${room.player(s.turn).name} goes first.`);
  }
  room.push();
}

function nextTurn(room, again) {
  const s = room.s, g = s.id, seats = seated(s).filter(q => !g.out.includes(q.pid));
  if (!again || g.out.includes(s.turn)) {
    const all = seated(s), i = all.findIndex(q => q.pid === s.turn);
    for (let k = 1; k <= all.length; k++) { const q = all[(i + k) % all.length]; if (!g.out.includes(q.pid)) { s.turn = q.pid; break; } }
  }
  s.turnNo++;
  if (seats.length <= 1) return;
  room.push();
}

function play(room, p, ids, src) {
  const s = room.s, g = s.id;
  const from = src === 'hand' ? p.hand : g.up[p.pid];
  for (const id of ids) from.splice(from.indexOf(id), 1);
  g.pile.push(...ids);
  while (src === 'hand' && p.hand.length < 3 && g.deck.length) p.hand.push(g.deck.pop());
  return after(room, p, ids);
}

// A face-down card, played blind: it goes on the pile if it can; if not, they pick up the pile and that card.
function flip(room, p, i) {
  const s = room.s, g = s.id, id = g.down[p.pid].splice(i, 1)[0];
  if (canPlay(g, id)) { g.pile.push(id); return after(room, p, [id], true); }
  g.last = { pid: p.pid, ids: [id], blind: true, miss: true, k: s.v + 1 };
  p.hand.push(...g.pile, id); g.pile = [];
  s.ann = { pid: p.pid, name: p.name, rc: p.rc, kind: 'take', text: `${p.name} turned up a card that didn't play`, sub: 'Picked up!', k: s.v + 1 };
  room.note(`${p.name} flipped a card that didn't play and picked up the pile`);
  nextTurn(room, false);
}

function after(room, p, ids, blind) {
  const s = room.s, g = s.id;
  const top = g.pile.slice(-4);
  const burn = val(ids[0]) === BURN || (top.length === 4 && top.every(id => rankOf(id) === rankOf(top[0])));
  g.last = { pid: p.pid, ids, blind: !!blind, burn, k: s.v + 1 };
  if (burn) {
    g.burned += g.pile.length; g.pile = [];
    s.ann = { pid: p.pid, name: p.name, rc: p.rc, kind: 'burn', text: `${p.name} burned the pile`, sub: 'Burn!', k: s.v + 1 };
  }
  if (outOf(g, p)) {
    g.out.push(p.pid);
    const left = seated(s).filter(q => !g.out.includes(q.pid));
    room.note(`${p.name} is out!`);
    if (left.length <= 1) {
      const idiot = left[0];
      g.why = idiot ? `${idiot.name} is the Idiot!` : '';
      return room.finish(room.player(g.out[0]) || null);
    }
    if (!burn) s.ann = { pid: p.pid, name: p.name, rc: p.rc, kind: 'last', text: `${p.name} is out!`, sub: g.out.length === 1 ? 'First out!' : 'Out!', k: s.v + 1 };
  }
  nextTurn(room, burn);
}

function take(room, p) {
  const s = room.s, g = s.id;
  if (!g.pile.length) return;
  const n = g.pile.length;
  p.hand.push(...g.pile); g.pile = [];
  g.last = { pid: p.pid, ids: [], took: n, k: s.v + 1 };
  s.ann = { pid: p.pid, name: p.name, rc: p.rc, kind: 'take', text: `${p.name} picked up ${n} card${n === 1 ? '' : 's'}`, sub: `+${n}`, k: s.v + 1 };
  room.note(`${p.name} picked up the pile`);
  nextTurn(room, false);
}

/* ---------------- computer players ---------------- */

// Before play: the best cards (10s, 2s, aces, then high) go face up.
function cpuSwap(g, p) {
  const keep = id => { const v = val(id); return v === BURN ? 100 : v === RESET ? 90 : v; };
  const all = [...p.hand, ...g.up[p.pid]].sort((a, b) => keep(b) - keep(a));
  g.up[p.pid] = all.slice(0, 3); p.hand = all.slice(3);
}

// Play the lowest ordinary rank that goes (all of that rank); keep 2s and 10s for when they are needed.
export function cpuChoice(g, p) {
  const src = source(g, p);
  if (src === 'down') return { a: 'play', i: Math.floor(Math.random() * g.down[p.pid].length) };
  const from = src === 'hand' ? p.hand : g.up[p.pid];
  const ok = from.filter(id => canPlay(g, id));
  if (!ok.length) return g.pile.length ? { a: 'take' } : null;
  const special = id => val(id) === RESET || val(id) === BURN;
  let pick;
  if (p.cpu === 'easy') pick = ok[Math.floor(Math.random() * ok.length)];
  else {
    const plain = ok.filter(id => !special(id)).sort((a, b) => val(a) - val(b));
    // Hard burns a big pile rather than play a low card onto it
    if (p.cpu === 'hard' && g.pile.length >= 6 && ok.some(id => val(id) === BURN)) pick = ok.find(id => val(id) === BURN);
    else pick = plain[0] != null ? plain[0] : ok.sort((a, b) => val(a) - val(b))[0];
  }
  return { a: 'play', ids: from.filter(id => rankOf(id) === rankOf(pick)) };
}

function cpuTurn(room, p) {
  const s = room.s, g = s.id;
  if (!p || g.stage !== 'play') return;
  const c = cpuChoice(g, p);
  if (!c) return nextTurn(room, false);
  if (c.a === 'take') return take(room, p);
  if (c.i != null) return flip(room, p, c.i);
  play(room, p, c.ids, source(g, p));
}
