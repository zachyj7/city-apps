// Blackjack: the referee side. Everyone plays against a computer dealer with pretend money.
// Runs in the host's browser as part of the Room; all of it lives in s.bj and on each player (chips, buy).
//
// A card is a number: rank = id % 13 (0 ace, 1-9 two to ten, 10 jack, 11 queen, 12 king), suit = (id / 13 | 0) % 4.

export const rankOf = id => id % 13;
export const suitOf = id => Math.floor(id / 13) % 4;
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const val = id => { const r = rankOf(id); return r === 0 ? 11 : Math.min(10, r + 1); };

// The best total for some cards, and whether an ace is still counting as 11 (a "soft" hand).
export function total(cards) {
  let t = 0, aces = 0;
  for (const c of cards) { t += val(c); if (rankOf(c) === 0) aces++; }
  while (t > 21 && aces) { t -= 10; aces--; }
  return { t, soft: aces > 0 };
}
export const isBJ = h => h.cards.length === 2 && !h.split && total(h.cards).t === 21;

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const shoe = decks => shuffle(Array.from({ length: 52 * decks }, (_, i) => i));

const seated = s => s.players.filter(p => p.seat);

// What a hand can do right now (for the buttons, and checked again when it is pressed).
export function options(s, p) {
  const b = s.bj, h = b && b.stage === 'play' && b.cur && b.cur.pid === p.pid && b.hands[p.pid] && b.hands[p.pid][b.cur.h];
  if (!h || h.done) return null;
  const two = h.cards.length === 2;
  const pairs = two && val(h.cards[0]) === val(h.cards[1]);
  return {
    hit: true, stand: true,
    double: two && p.chips >= h.bet,
    split: pairs && p.chips >= h.bet && b.hands[p.pid].length < 4,
  };
}

export const BJ = {
  start(room, seats, cfg) {
    const s = room.s;
    for (const q of seats) { q.chips = cfg.chips; q.buy = 0; q.lastBet = cfg.min; q.won = 0; }
    s.bj = { cfg, stage: 'bet', shoe: shoe(cfg.decks), dealer: [], hole: true, hands: {}, bets: {}, sit: {}, cur: null, n: 1, peek: false };
    s.turn = null;
    room.note(`Blackjack! Everyone starts with $${cfg.chips.toLocaleString('en-US')}. Place your bets.`);
  },

  act(room, p, m) {
    const s = room.s, b = s.bj;
    if (!b || !p.seat) return;
    const cfg = b.cfg;
    if (b.stage === 'bet') {
      if (m.a === 'bet') {
        const amt = Math.floor(+m.amt);
        const have = p.chips + (b.bets[p.pid] || 0);
        if (!(amt >= cfg.min && amt <= have)) return;
        p.chips = have - amt; b.bets[p.pid] = amt; p.lastBet = amt; delete b.sit[p.pid];
        return room.push();
      }
      if (m.a === 'unbet') {
        if (!b.bets[p.pid]) return;
        p.chips += b.bets[p.pid]; delete b.bets[p.pid];
        return room.push();
      }
      if (m.a === 'sit') {
        if (b.bets[p.pid]) { p.chips += b.bets[p.pid]; delete b.bets[p.pid]; }
        b.sit[p.pid] = true;
        return room.push();
      }
      if (m.a === 'buyback') {
        if (p.chips + (b.bets[p.pid] || 0) >= cfg.min) return;
        buyBack(room, p);
        return room.push();
      }
      if (m.a === 'deal') {   // the host deals without waiting for anyone still deciding
        if (p.pid !== s.host || !Object.keys(b.bets).length) return;
        return deal(room);
      }
      return;
    }
    if (b.stage === 'settle' && m.a === 'next') return nextHand(room);
    if (b.stage !== 'play') return;
    const o = options(s, p);
    if (!o || !o[m.a]) return;
    play(room, p, m.a);
  },

  // Anything that happens by itself: computer players betting and playing, the dealer, the next hand.
  auto(s) {
    const b = s.bj;
    if (!b) return null;
    if (b.stage === 'bet') {
      const cpu = seated(s).find(q => q.cpu && !b.bets[q.pid] && !b.sit[q.pid]);
      if (cpu) return { key: 'cpubet:' + cpu.pid + ':' + b.n, ms: 500 + Math.random() * 500 };
      const people = seated(s).filter(q => q.on);
      if (people.length && people.every(q => b.bets[q.pid] || b.sit[q.pid]) && Object.keys(b.bets).length) return { key: 'deal:' + b.n, ms: 700 };
      return null;
    }
    if (b.stage === 'play' && b.cur) {
      const p = s.players.find(q => q.pid === b.cur.pid);
      if (p && p.cpu) return { key: `cpu:${s.turnNo}`, ms: 900 + Math.random() * 700 };
      return null;
    }
    if (b.stage === 'dealer') return { key: 'dealer:' + b.n + ':' + b.dealer.length + ':' + b.hole, ms: b.hole ? 600 : 850 };
    if (b.stage === 'settle') return { key: 'next:' + b.n, ms: 7000 };
    return null;
  },

  run(room, key) {
    const s = room.s, b = s.bj, t = BJ.auto(s);
    if (!b || !t || t.key !== key) return;
    if (key.startsWith('cpubet:')) {
      const p = room.player(key.split(':')[1]);
      if (p.chips < b.cfg.min) buyBack(room, p);
      const amt = cpuBet(p, b.cfg);
      p.chips -= amt; b.bets[p.pid] = amt; p.lastBet = amt;
      return room.push();
    }
    if (key.startsWith('deal:')) return deal(room);
    if (key.startsWith('cpu:')) {
      const p = room.player(b.cur.pid);
      return play(room, p, cpuMove(s, p));
    }
    if (key.startsWith('dealer:')) return dealerStep(room);
    if (key.startsWith('next:')) return nextHand(room);
  },

  // Someone left in the middle of their hand: they stand.
  skip(room, cur) {
    const b = room.s.bj;
    if (b && b.stage === 'play' && b.cur && b.cur.pid === cur.pid) { room.note(`${cur.name} stood (away)`); play(room, cur, 'stand'); }
  },

  // The host ends the game: whoever has the most money (counting the free buy-backs against them) wins.
  end(room) {
    const s = room.s, b = s.bj;
    if (b && b.stage !== 'settle') for (const pid in b.bets) { const p = room.player(pid); if (p) p.chips += b.bets[pid]; }
    if (b && (b.stage === 'play' || b.stage === 'dealer')) for (const pid in b.hands) { const p = room.player(pid); if (p) for (const h of b.hands[pid]) p.chips += h.bet; }
    const start = b ? b.cfg.chips : 0;
    const rows = seated(s).map(p => ({ pid: p.pid, name: p.name, rc: p.rc, chips: p.chips, buy: p.buy || 0, net: p.chips - start * (1 + (p.buy || 0)), won: p.won || 0 }));
    rows.sort((x, y) => y.net - x.net || y.chips - x.chips);
    const top = rows[0];
    const winner = top && (rows.length === 1 ? top.net > 0 : top.net > rows[1].net) ? room.player(top.pid) : null;
    s.bjEnd = { rows, start };
    room.finish(winner);
  },
};

function buyBack(room, p) {
  const cfg = room.s.bj.cfg;
  p.chips = cfg.chips; p.buy = (p.buy || 0) + 1;
  room.s.ann = { pid: p.pid, name: p.name, rc: p.rc, kind: 'buy', text: `${p.name} bought back in`, sub: `Free! +$${cfg.chips.toLocaleString('en-US')}`, k: room.s.v + 1 };
  room.note(`${p.name} bought back in for free`);
}

function draw(b) {
  if (!b.shoe.length) b.shoe = shoe(b.cfg.decks);
  return b.shoe.pop();
}

function deal(room) {
  const s = room.s, b = s.bj;
  if (b.stage !== 'bet' || !Object.keys(b.bets).length) return;
  // Reshuffle when the shoe is down to its last quarter, before the cards come out.
  if (b.shoe.length < 52 * b.cfg.decks * 0.25) { b.shoe = shoe(b.cfg.decks); room.note('The dealer shuffled the cards'); b.shuffled = b.n; }
  b.hands = {};
  const players = seated(s).filter(q => b.bets[q.pid]);
  for (const q of players) b.hands[q.pid] = [{ cards: [], bet: b.bets[q.pid] }];
  b.dealer = [];
  for (let r = 0; r < 2; r++) {
    for (const q of players) b.hands[q.pid][0].cards.push(draw(b));
    b.dealer.push(draw(b));
  }
  b.hole = true; b.stage = 'play'; b.bets = {};
  for (const q of players) { const h = b.hands[q.pid][0]; if (total(h.cards).t === 21) h.done = true; }
  // The dealer peeks under an ace or a ten: with blackjack, the hand is over straight away.
  const up = b.dealer[0];
  if ((rankOf(up) === 0 || val(up) === 10) && total(b.dealer).t === 21) {
    b.hole = false; b.peek = true;
    room.note('The dealer has blackjack');
    return settle(room);
  }
  b.peek = false;
  advance(room);
}

// Move on to the next hand that still has to be played, or to the dealer.
function advance(room) {
  const s = room.s, b = s.bj;
  const order = seated(s).filter(q => b.hands[q.pid]);
  let start = 0;
  if (b.cur) { const i = order.findIndex(q => q.pid === b.cur.pid); start = i < 0 ? 0 : i; }
  for (let i = start; i < order.length; i++) {
    const hs = b.hands[order[i].pid];
    const h = hs.findIndex(x => !x.done);
    if (h >= 0) {
      const changed = !b.cur || b.cur.pid !== order[i].pid || b.cur.h !== h;
      b.cur = { pid: order[i].pid, h };
      s.turn = order[i].pid;
      if (changed) s.turnNo++;
      return room.push();
    }
  }
  b.cur = null; s.turn = null; s.turnNo++;
  b.stage = 'dealer';
  room.push();
}

function play(room, p, a) {
  const s = room.s, b = s.bj, hs = b.hands[p.pid], h = hs[b.cur.h];
  if (a === 'hit') {
    h.cards.push(draw(b));
    const t = total(h.cards).t;
    if (t > 21) { h.done = true; h.bust = true; room.note(`${p.name} busted`); }
    else if (t === 21) h.done = true;
  } else if (a === 'stand') {
    h.done = true;
  } else if (a === 'double') {
    p.chips -= h.bet; h.bet *= 2; h.doubled = true;
    h.cards.push(draw(b));
    h.done = true;
    if (total(h.cards).t > 21) h.bust = true;
    room.note(`${p.name} doubled down`);
  } else if (a === 'split') {
    p.chips -= h.bet;
    const second = { cards: [h.cards.pop()], bet: h.bet, split: true };
    h.split = true;
    hs.splice(b.cur.h + 1, 0, second);
    const aces = rankOf(h.cards[0]) === 0;
    h.cards.push(draw(b)); second.cards.push(draw(b));
    // Split aces get one card each and that's all.
    if (aces) { h.done = true; second.done = true; }
    for (const x of [h, second]) if (total(x.cards).t === 21) x.done = true;
    room.note(`${p.name} split`);
  }
  advance(room);
}

function dealerStep(room) {
  const s = room.s, b = s.bj;
  if (b.hole) { b.hole = false; return room.push(); }
  const live = Object.values(b.hands).flat().some(h => !h.bust && !isBJ(h));
  const { t, soft } = total(b.dealer);
  const hit = live && (t < 17 || (t === 17 && soft && b.cfg.s17 === 'hit'));
  if (hit) { b.dealer.push(draw(b)); return room.push(); }
  settle(room);
}

function settle(room) {
  const s = room.s, b = s.bj;
  const d = total(b.dealer).t, dBJ = b.dealer.length === 2 && d === 21;
  const pays = b.cfg.pays === '6:5' ? 1.2 : 1.5;
  let best = null;
  for (const pid in b.hands) {
    const p = room.player(pid);
    let net = 0;
    for (const h of b.hands[pid]) {
      const t = total(h.cards).t, bj = isBJ(h);
      let win;   // what comes back to the player, stake included
      if (h.bust) { h.res = 'bust'; win = 0; }
      else if (bj && !dBJ) { h.res = 'bj'; win = h.bet + Math.floor(h.bet * pays); }
      else if (dBJ && !bj) { h.res = 'lose'; win = 0; }
      else if (bj && dBJ) { h.res = 'push'; win = h.bet; }
      else if (d > 21 || t > d) { h.res = 'win'; win = h.bet * 2; }
      else if (t === d) { h.res = 'push'; win = h.bet; }
      else { h.res = 'lose'; win = 0; }
      h.net = win - h.bet; net += h.net;
      if (p) p.chips += win;
    }
    if (p && net > 0) { p.won = (p.won || 0) + 1; if (!best || net > best.net) best = { p, net }; }
  }
  b.stage = 'settle'; b.cur = null; s.turn = null; s.turnNo++;
  room.note(best ? `${best.p.name} won $${best.net.toLocaleString('en-US')}` : 'The dealer wins this one');
  room.push();
}

function nextHand(room) {
  const s = room.s, b = s.bj;
  if (b.stage !== 'settle') return;
  b.stage = 'bet'; b.hands = {}; b.dealer = []; b.hole = true; b.bets = {}; b.cur = null; b.n++;
  // People who sat out stay sitting out; anyone who left is sat out.
  for (const q of seated(s)) if (!q.on && !q.cpu) b.sit[q.pid] = true;
  room.push();
}

/* ---------------- computer players ---------------- */

function cpuBet(p, cfg) {
  const m = cfg.min;
  let amt;
  if (p.cpu === 'easy') amt = m * (1 + Math.floor(Math.random() * 4));
  else if (p.cpu === 'medium') amt = m * 2;
  else amt = Math.max(m, Math.round(p.chips * 0.05 / m) * m);
  return Math.max(m, Math.min(p.chips, amt));
}

// Easy players go on a hunch, medium ones play like the dealer, hard ones follow basic strategy.
function cpuMove(s, p) {
  const b = s.bj, h = b.hands[p.pid][b.cur.h], o = options(s, p);
  const { t, soft } = total(h.cards);
  if (p.cpu === 'easy') return t < 12 + Math.floor(Math.random() * 5) ? 'hit' : 'stand';
  if (p.cpu === 'medium') return t < 17 ? 'hit' : 'stand';
  const up = val(b.dealer[0]);   // 2-11
  if (o.split) {
    const r = val(h.cards[0]);
    const split = r === 11 || r === 8 || (r === 9 && up <= 9 && up !== 7) || (r === 7 && up <= 7) || (r === 6 && up <= 6) || (r === 4 && (up === 5 || up === 6)) || ((r === 2 || r === 3) && up <= 7);
    if (split) return 'split';
  }
  const dbl = x => (o.double ? 'double' : x);
  if (soft) {
    if (t >= 19) return 'stand';
    if (t === 18) return up >= 3 && up <= 6 ? dbl('stand') : up <= 8 ? 'stand' : 'hit';
    if (t === 17) return up >= 3 && up <= 6 ? dbl('hit') : 'hit';
    if (t >= 15) return up >= 4 && up <= 6 ? dbl('hit') : 'hit';
    return up >= 5 && up <= 6 ? dbl('hit') : 'hit';
  }
  if (t >= 17) return 'stand';
  if (t >= 13) return up <= 6 ? 'stand' : 'hit';
  if (t === 12) return up >= 4 && up <= 6 ? 'stand' : 'hit';
  if (t === 11) return dbl('hit');
  if (t === 10) return up <= 9 ? dbl('hit') : 'hit';
  if (t === 9) return up >= 3 && up <= 6 ? dbl('hit') : 'hit';
  return 'hit';
}
