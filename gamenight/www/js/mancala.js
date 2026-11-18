// Mancala (the Kalah rules): the rules, the referee side and the computer player.
// 14 spots: 0-5 are Player 1's pits (left to right as they look at it), 6 is their store; 7-12 are Player 2's
// pits and 13 their store. Pick up every seed in one of your pits and drop one in each spot going
// counterclockwise, skipping the other player's store. Last seed in your store: go again. Last seed in an
// empty pit of yours: take it and every seed in the pit across from it. When one side is empty the game is
// over, the other side's seeds go to their owner's store, and the bigger store wins.

export const STORE = [6, 13];
export const pitsOf = side => (side === 0 ? [0, 1, 2, 3, 4, 5] : [7, 8, 9, 10, 11, 12]);

export function newBoard(seeds) {
  const p = Array(14).fill(seeds);
  p[6] = 0; p[13] = 0;
  return { p, side: 0 };
}

export const legal = st => pitsOf(st.side).filter(i => st.p[i] > 0);

// One move: the new position, and what happened (the last spot sown, a capture, the game over).
export function apply(st, i) {
  const p = st.p.slice(), side = st.side, skip = STORE[1 - side];
  let n = p[i], at = i;
  p[i] = 0;
  while (n) { at = (at + 1) % 14; if (at === skip) continue; p[at]++; n--; }
  let cap = 0;
  if (at !== STORE[side] && pitsOf(side).includes(at) && p[at] === 1 && p[12 - at] > 0) {
    cap = p[12 - at] + 1;
    p[STORE[side]] += cap; p[at] = 0; p[12 - at] = 0;
  }
  const again = at === STORE[side];
  let over = false;
  if (pitsOf(0).every(k => !p[k]) || pitsOf(1).every(k => !p[k])) {
    over = true;
    for (const s of [0, 1]) for (const k of pitsOf(s)) { p[STORE[s]] += p[k]; p[k] = 0; }
  }
  return { p, side: again || over ? side : 1 - side, last: at, cap, again: again && !over, over };
}

/* ---------------- the referee ---------------- */

export const MANCALA = {
  start(room, seats, cfg) {
    const s = room.s;
    s.mc = { ...newBoard(cfg.seeds || 4), pl: [seats[0].pid, seats[1].pid], last: null, why: null };
    s.turn = seats[0].pid;
    room.note(`Mancala! ${seats[0].name} goes first.`);
  },

  act(room, p, m) {
    const s = room.s, g = s.mc;
    if (!g) return;
    if (m.a === 'resign') {
      if (!p.seat) return;
      g.why = `${p.name} gave up`;
      return room.finish(room.player(g.pl[p.pid === g.pl[0] ? 1 : 0]) || null);
    }
    if (m.a !== 'move' || s.turn !== p.pid) return;
    const i = Math.floor(+m.i);
    if (legal(g).includes(i)) doMove(room, i);
  },

  auto(s) {
    const p = s.mc && s.players.find(q => q.pid === s.turn);
    return p && p.cpu ? { key: 'cpu:' + s.turnNo, ms: 900 + Math.random() * 600 } : null;
  },
  run(room, key) {
    const s = room.s, t = MANCALA.auto(s);
    if (!t || t.key !== key) return;
    const i = cpuMove(s.mc, room.player(s.turn).cpu);
    if (i != null) doMove(room, i);
  },
  skip() {},
  end(room) { if (room.s.mc) room.s.mc.why = 'The host ended the game'; room.finish(null); },
};

function doMove(room, i) {
  const s = room.s, g = s.mc, mover = room.player(s.turn);
  const n = apply(g, i);
  g.p = n.p; g.side = n.side;
  g.last = { from: i, to: n.last, k: s.v + 1 };
  if (n.over) {
    const [a, b] = [g.p[6], g.p[13]];
    g.why = `${a} to ${b}`;
    return room.finish(a === b ? null : room.player(g.pl[a > b ? 0 : 1]) || null);
  }
  if (n.cap) s.ann = { pid: mover.pid, name: mover.name, rc: mover.rc, kind: 'cap', text: `${mover.name} captured ${n.cap} seeds`, sub: `+${n.cap}`, k: s.v + 1 };
  else if (n.again) s.ann = { pid: mover.pid, name: mover.name, rc: mover.rc, kind: 'again', text: `${mover.name} goes again`, sub: 'Again!', k: s.v + 1 };
  s.turn = g.pl[g.side];
  s.turnNo++;
  room.push();
}

/* ---------------- the computer player ---------------- */

function search(st, depth, me) {
  if (depth === 0) return st.p[STORE[me]] - st.p[STORE[1 - me]];
  const ms = legal(st);
  if (!ms.length) return st.p[STORE[me]] - st.p[STORE[1 - me]];
  let best = st.side === me ? -Infinity : Infinity;
  for (const i of ms) {
    const n = apply(st, i);
    const v = n.over ? (n.p[STORE[me]] - n.p[STORE[1 - me]]) * 10 : search(n, n.side === st.side ? depth : depth - 1, me);
    best = st.side === me ? Math.max(best, v) : Math.min(best, v);
  }
  return best;
}

export function cpuMove(st, level) {
  const ms = legal(st);
  if (!ms.length) return null;
  if (level === 'easy' && Math.random() < 0.5) return ms[Math.floor(Math.random() * ms.length)];
  const depth = level === 'hard' ? 5 : level === 'medium' ? 3 : 1;
  let best = null, bv = -Infinity;
  for (const i of ms) {
    const n = apply(st, i);
    const v = (n.over ? (n.p[STORE[st.side]] - n.p[STORE[1 - st.side]]) * 10 : search(n, n.side === st.side ? depth : depth - 1, st.side)) + Math.random() * 0.5;
    if (v > bv) { bv = v; best = i; }
  }
  return best;
}
