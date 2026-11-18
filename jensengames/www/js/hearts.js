// Hearts: the referee side. Three or four players; the lowest score wins.
// Each hand: pass 3 cards (left, right, across, then keep; with three players left, right, keep), then
// 13 tricks (17 with three players, who play without the 2 of diamonds). The 2 of clubs leads the first trick.
// Follow suit if you can. No hearts or queen of spades on the first trick (unless that's all you have), and no
// leading hearts until a heart has been played (unless that's all you have). Each heart taken is 1 point and
// the queen of spades is 13; take all of them ("shoot the moon") and everyone else gets 26 instead. The game
// ends when someone reaches the target; lowest score wins.
//
// Cards are 0-51 as in Blackjack: rank = id % 13 (0 ace ... 12 king), suit = id / 13 (0 spades, 1 hearts,
// 2 diamonds, 3 clubs). Aces are high here.
import { rankOf, suitOf } from './bj.js';

export const SPADES = 0, HEARTS = 1, DIAMONDS = 2, CLUBS = 3;
export const QS = 11, TWO_CLUBS = 3 * 13 + 1, TWO_DIAMONDS = 2 * 13 + 1;
export const high = id => (rankOf(id) === 0 ? 14 : rankOf(id) + 1);
export const points = id => (suitOf(id) === HEARTS ? 1 : id === QS ? 13 : 0);
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const seated = s => s.players.filter(p => p.seat);
export const sortHand = h => h.slice().sort((a, b) => ([CLUBS, DIAMONDS, SPADES, HEARTS].indexOf(suitOf(a)) - [CLUBS, DIAMONDS, SPADES, HEARTS].indexOf(suitOf(b))) || high(a) - high(b));

// Where this hand's cards are passed: 1 left, -1 right, 2 across, 0 keep.
export function passDir(n, handNo) {
  const cycle = n === 4 ? [1, -1, 2, 0] : [1, -1, 0];
  return cycle[handNo % cycle.length];
}
export const PASS_NAMES = { 1: 'left', '-1': 'right', 2: 'across', 0: '' };

// The cards this player may play now.
export function legal(h, hand) {
  if (!hand.length) return [];
  const first = h.tricks === 0;
  if (!h.trick.length) {
    if (first && hand.includes(TWO_CLUBS)) return [TWO_CLUBS];
    const nonHearts = hand.filter(id => suitOf(id) !== HEARTS);
    return h.broken || !nonHearts.length ? hand.slice() : nonHearts;
  }
  const suit = suitOf(h.trick[0].id);
  const follow = hand.filter(id => suitOf(id) === suit);
  if (follow.length) return follow;
  if (first) {
    const clean = hand.filter(id => !points(id));
    if (clean.length) return clean;
  }
  return hand.slice();
}

export const HEARTS_GAME = {
  start(room, seats, cfg) {
    const s = room.s;
    s.hr = { cfg, scores: {}, handNo: 0, stage: 'pass', trick: [], lastTrick: null, taken: {}, passed: {}, broken: false, tricks: 0, lead: null, handPts: null, why: null };
    for (const q of seats) s.hr.scores[q.pid] = 0;
    deal(room);
    room.note(`Hearts! First to ${cfg.to} points ends it; lowest score wins.`);
  },

  act(room, p, m) {
    const s = room.s, h = s.hr;
    if (!h || !p.seat) return;
    if (m.a === 'pass') {
      if (h.stage !== 'pass' || h.passed[p.pid]) return;
      const ids = Array.isArray(m.ids) ? [...new Set(m.ids.map(x => Math.floor(+x)))] : [];
      if (ids.length !== 3 || !ids.every(id => p.hand.includes(id))) return;
      h.passed[p.pid] = ids;
      return afterPass(room);
    }
    if (m.a === 'play') {
      if (h.stage !== 'play' || s.turn !== p.pid) return;
      const id = Math.floor(+m.id);
      if (!legal(h, p.hand).includes(id)) return;
      return playCard(room, p, id);
    }
  },

  auto(s) {
    const h = s.hr;
    if (!h || s.phase !== 'play') return null;
    if (h.stage === 'trick') return { key: 'collect:' + s.turnNo, ms: 1500 };
    if (h.stage === 'scored') return { key: 'next:' + h.handNo, ms: 6000 };
    if (h.stage === 'pass') {
      const cpu = seated(s).find(q => q.cpu && !h.passed[q.pid]);
      if (cpu) return { key: 'pass:' + h.handNo + ':' + cpu.pid, ms: 400 };
      // someone who dropped off has cards passed for them after a while
      return seated(s).some(q => !q.on && !h.passed[q.pid]) ? { key: 'away:' + s.v, ms: 15000 } : null;
    }
    const p = s.players.find(q => q.pid === s.turn);
    return p && p.cpu ? { key: 'cpu:' + s.turnNo, ms: 800 + Math.random() * 600 } : null;
  },
  run(room, key) {
    const s = room.s, h = s.hr, t = HEARTS_GAME.auto(s);
    if (!t || t.key !== key) return;
    if (h.stage === 'trick') return collect(room);
    if (h.stage === 'scored') return deal(room);
    if (key.startsWith('away:')) return HEARTS_GAME.skip(room, null);
    if (h.stage === 'pass') {
      const cpu = seated(s).find(q => q.cpu && !h.passed[q.pid]);
      h.passed[cpu.pid] = cpuPass(cpu.hand, cpu.cpu);
      return afterPass(room);
    }
    const p = room.player(s.turn);
    playCard(room, p, cpuPlay(h, p, seated(s).length));
  },
  // someone is away: pass or play for them
  skip(room, cur) {
    const s = room.s, h = s.hr;
    if (!h) return;
    if (h.stage === 'pass') {
      for (const q of seated(s)) if (!q.on && !h.passed[q.pid]) h.passed[q.pid] = cpuPass(q.hand, 'medium');
      return afterPass(room);
    }
    if (h.stage === 'play' && cur) playCard(room, cur, cpuPlay(h, cur, seated(s).length));
  },
  end(room) { if (room.s.hr) room.s.hr.why = 'The host ended the game'; room.finish(null); },
};

function deal(room) {
  const s = room.s, h = s.hr, seats = seated(s), n = seats.length;
  const deck = shuffle(Array.from({ length: 52 }, (_, i) => i).filter(id => n !== 3 || id !== TWO_DIAMONDS));
  const each = deck.length / n;
  seats.forEach((q, i) => { q.hand = sortHand(deck.slice(i * each, (i + 1) * each)); });
  Object.assign(h, { trick: [], lastTrick: null, taken: {}, passed: {}, broken: false, tricks: 0, handPts: null, dir: passDir(n, h.handNo) });
  for (const q of seats) h.taken[q.pid] = [];
  if (h.dir) { h.stage = 'pass'; s.turn = null; }
  else startPlay(room);
  s.turnNo++;
  room.push();
}

function afterPass(room) {
  const s = room.s, h = s.hr, seats = seated(s), n = seats.length;
  if (!seats.every(q => h.passed[q.pid])) return room.push();
  seats.forEach((q, i) => {
    const to = seats[(((i + h.dir) % n) + n) % n];
    q.hand = q.hand.filter(id => !h.passed[q.pid].includes(id));
    to.gotPass = h.passed[q.pid];
  });
  for (const q of seats) { q.hand = sortHand([...q.hand, ...q.gotPass]); h.got = h.got || {}; h.got[q.pid] = q.gotPass; delete q.gotPass; }
  startPlay(room);
  s.turnNo++;
  room.push();
}

function startPlay(room) {
  const s = room.s, h = s.hr;
  h.stage = 'play';
  const first = seated(s).find(q => q.hand.includes(TWO_CLUBS));
  s.turn = first.pid;
}

function playCard(room, p, id) {
  const s = room.s, h = s.hr, seats = seated(s);
  p.hand.splice(p.hand.indexOf(id), 1);
  h.trick.push({ pid: p.pid, id });
  if (suitOf(id) === HEARTS && !h.broken) { h.broken = true; room.note('Hearts are broken!'); }
  if (id === QS) s.ann = { pid: p.pid, name: p.name, rc: p.rc, kind: 'queen', text: `${p.name} played the queen of spades`, sub: 'Q♠', k: s.v + 1 };
  s.turnNo++;
  if (h.trick.length === seats.length) { h.stage = 'trick'; s.turn = null; return room.push(); }
  const i = seats.findIndex(q => q.pid === p.pid);
  s.turn = seats[(i + 1) % seats.length].pid;
  room.push();
}

// The trick is over: the highest card of the suit led takes it.
function collect(room) {
  const s = room.s, h = s.hr, seats = seated(s);
  const suit = suitOf(h.trick[0].id);
  const win = h.trick.filter(t => suitOf(t.id) === suit).sort((a, b) => high(b.id) - high(a.id))[0];
  h.taken[win.pid].push(...h.trick.map(t => t.id));
  h.lastTrick = { cards: h.trick, win: win.pid };
  h.trick = []; h.tricks++;
  const pts = h.lastTrick.cards.reduce((n, t) => n + points(t.id), 0);
  const w = room.player(win.pid);
  if (pts) room.note(`${w.name} took ${pts} point${pts === 1 ? '' : 's'}`);
  s.turnNo++;
  if (seats.every(q => !q.hand.length)) return scoreHand(room);
  h.stage = 'play'; s.turn = win.pid;
  room.push();
}

function scoreHand(room) {
  const s = room.s, h = s.hr, seats = seated(s);
  const got = {};
  for (const q of seats) got[q.pid] = h.taken[q.pid].reduce((n, id) => n + points(id), 0);
  const moon = seats.find(q => got[q.pid] === 26);
  if (moon) {
    for (const q of seats) got[q.pid] = q === moon ? 0 : 26;
    s.ann = { pid: moon.pid, name: moon.name, rc: moon.rc, kind: 'moon', text: `${moon.name} shot the moon! Everyone else takes 26`, sub: 'Moon!', k: s.v + 1 };
  }
  for (const q of seats) h.scores[q.pid] = (h.scores[q.pid] || 0) + got[q.pid];
  h.handPts = got; h.handNo++;
  const target = +h.cfg.to || 100;
  if (seats.some(q => h.scores[q.pid] >= target)) {
    const order = seats.slice().sort((a, b) => h.scores[a.pid] - h.scores[b.pid]);
    h.why = 'Final scores: ' + order.map(q => `${q.name} ${h.scores[q.pid]}`).join(', ');
    const tie = order.length > 1 && h.scores[order[0].pid] === h.scores[order[1].pid];
    return room.finish(tie ? null : order[0]);
  }
  h.stage = 'scored'; s.turn = null;
  room.push();
}

/* ---------------- computer players ---------------- */

// Pass the dangerous cards: the queen, king and ace of spades, then high hearts, then the highest cards.
export function cpuPass(hand, level) {
  if (level === 'easy') return shuffle(hand.slice()).slice(0, 3);
  const danger = id => (id === QS ? 100 : (suitOf(id) === SPADES && high(id) > 12) ? 90 : suitOf(id) === HEARTS ? 40 + high(id) : high(id));
  return hand.slice().sort((a, b) => danger(b) - danger(a)).slice(0, 3);
}

export function cpuPlay(h, p, n) {
  const ok = legal(h, p.hand);
  if (p.cpu === 'easy' || ok.length === 1) return ok[Math.floor(Math.random() * ok.length)];
  const lowFirst = ok.slice().sort((a, b) => high(a) - high(b));
  if (!h.trick.length) {
    // lead low, and not a spade that could pull out the queen onto ourselves
    const safe = lowFirst.filter(id => suitOf(id) !== HEARTS && !(suitOf(id) === SPADES && high(id) >= 12));
    return (safe[0] != null ? safe : lowFirst)[0];
  }
  const suit = suitOf(h.trick[0].id);
  const best = Math.max(...h.trick.filter(t => suitOf(t.id) === suit).map(t => high(t.id)));
  const trickPts = h.trick.reduce((s, t) => s + points(t.id), 0);
  if (suitOf(ok[0]) === suit) {
    const under = lowFirst.filter(id => high(id) < best);
    if (under.length) return under[under.length - 1];                // highest card that still loses the trick
    const last = h.trick.length === n - 1;
    if (last && !trickPts) return lowFirst.filter(id => id !== QS).pop() ?? lowFirst[lowFirst.length - 1];   // take it cheaply with a high card
    return lowFirst.find(id => id !== QS) ?? lowFirst[0];
  }
  // can't follow: get rid of the queen, then high hearts, then the highest card
  if (ok.includes(QS)) return QS;
  const hearts = ok.filter(id => suitOf(id) === HEARTS).sort((a, b) => high(b) - high(a));
  if (hearts.length && p.cpu === 'hard') return hearts[0];
  return ok.slice().sort((a, b) => high(b) - high(a))[0];
}
