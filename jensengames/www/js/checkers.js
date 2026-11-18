// Checkers: the rules, the referee side and the computer player. Two players on the dark squares of an 8x8
// board. Player 1 is red ('a', starting on the bottom three rows) and moves first; Player 2 is white ('b').
// Capital letters are kings. Pieces move diagonally forward; kings move both ways. A jump takes the piece
// jumped over, and a piece that can keep jumping must carry on. Reaching the far row makes a king (and ends
// the turn). With "Must jump" on, a jump has to be taken when there is one.

const at = (r, c) => (r < 0 || r > 7 || c < 0 || c > 7 ? -1 : r * 8 + c);
export const sideOf = x => (x ? x.toLowerCase() : null);
const isKing = x => x && x === x.toUpperCase();
const DIRS = { a: [[-1, -1], [-1, 1]], b: [[1, -1], [1, 1]] };
const ALL = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

export function newBoard() {
  const b = Array(64).fill('');
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) {
    if (r < 3) b[at(r, c)] = 'b';
    else if (r > 4) b[at(r, c)] = 'a';
  }
  return { b, side: 'a', chain: -1, quiet: 0 };
}

const dirsOf = x => (isKing(x) ? ALL : DIRS[sideOf(x)]);

function jumpsFrom(b, f) {
  const x = b[f], out = [], r = f >> 3, c = f & 7;
  for (const [dr, dc] of dirsOf(x)) {
    const o = at(r + dr, c + dc), t = at(r + 2 * dr, c + 2 * dc);
    if (t >= 0 && !b[t] && b[o] && sideOf(b[o]) !== sideOf(x)) out.push({ f, t, cap: o });
  }
  return out;
}
function stepsFrom(b, f) {
  const out = [], r = f >> 3, c = f & 7;
  for (const [dr, dc] of dirsOf(b[f])) { const t = at(r + dr, c + dc); if (t >= 0 && !b[t]) out.push({ f, t }); }
  return out;
}

// The single moves allowed now (one step, or one hop of a jump).
export function legal(st, mustJump = true) {
  if (st.chain >= 0) return jumpsFrom(st.b, st.chain);
  const jumps = [], steps = [];
  st.b.forEach((x, f) => {
    if (!x || sideOf(x) !== st.side) return;
    jumps.push(...jumpsFrom(st.b, f));
    steps.push(...stepsFrom(st.b, f));
  });
  return jumps.length && mustJump ? jumps : [...jumps, ...steps];
}

// After one move: the new position. If the same piece must keep jumping, chain says where it is and it is still
// the same player's turn.
export function apply(st, m) {
  const b = st.b.slice();
  let x = b[m.f];
  b[m.f] = ''; if (m.cap != null) b[m.cap] = '';
  const row = m.t >> 3;
  const crowned = !isKing(x) && ((x === 'a' && row === 0) || (x === 'b' && row === 7));
  if (crowned) x = x.toUpperCase();
  b[m.t] = x;
  const more = m.cap != null && !crowned && jumpsFrom(b, m.t).length;
  return {
    b, side: more ? st.side : st.side === 'a' ? 'b' : 'a', chain: more ? m.t : -1,
    quiet: m.cap != null || (!isKing(st.b[m.f]) && !crowned) ? 0 : st.quiet + 1, crowned,
  };
}

export const count = (b, side) => b.filter(x => sideOf(x) === side).length;

/* ---------------- the referee ---------------- */

export const CHECKERS = {
  start(room, seats, cfg) {
    const s = room.s;
    s.ck = { ...newBoard(), a: seats[0].pid, bp: seats[1].pid, must: cfg.must !== 'no', last: null, why: null };
    s.turn = seats[0].pid;
    room.note(`Checkers! ${seats[0].name} has red and goes first.`);
  },

  act(room, p, m) {
    const s = room.s, k = s.ck;
    if (!k) return;
    if (m.a === 'resign') {
      if (!p.seat) return;
      k.why = `${p.name} gave up`;
      return room.finish(room.player(p.pid === k.a ? k.bp : k.a) || null);
    }
    if (m.a !== 'move' || s.turn !== p.pid) return;
    const mv = legal(k, k.must).find(x => x.f === m.f && x.t === m.to);
    if (mv) doMove(room, mv);
  },

  auto(s) {
    const p = s.ck && s.players.find(q => q.pid === s.turn);
    return p && p.cpu ? { key: 'cpu:' + s.turnNo, ms: (s.ck.chain >= 0 ? 450 : 800) + Math.random() * 500 } : null;
  },
  run(room, key) {
    const s = room.s, t = CHECKERS.auto(s);
    if (!t || t.key !== key) return;
    const mv = cpuMove(s.ck, room.player(s.turn).cpu);
    if (mv) doMove(room, mv);
  },
  skip() {},
  end(room) { if (room.s.ck) room.s.ck.why = 'The host ended the game'; room.finish(null); },
};

function doMove(room, mv) {
  const s = room.s, k = s.ck, mover = room.player(s.turn);
  const n = apply(k, mv);
  Object.assign(k, { b: n.b, side: n.side, chain: n.chain, quiet: n.quiet });
  // the path of this turn so far, so everyone can see the whole jump
  k.last = k.last && k.last.open ? { path: [...k.last.path, mv.t], open: n.chain >= 0 } : { path: [mv.f, mv.t], open: n.chain >= 0 };
  if (n.crowned) s.ann = { pid: mover.pid, name: mover.name, rc: mover.rc, kind: 'king', text: `${mover.name} got a king`, sub: 'King me!', k: s.v + 1 };
  s.turn = k.side === 'a' ? k.a : k.bp;
  s.turnNo++;
  const foe = k.side;
  if (!count(k.b, foe) || !legal(k, k.must).length) {
    k.why = count(k.b, foe) ? 'No moves left' : 'Every piece taken';
    return room.finish(mover);
  }
  if (k.quiet >= 80) { k.why = '40 moves each with no jump: a draw'; return room.finish(null); }
  room.push();
}

/* ---------------- the computer player ---------------- */

function evaluate(st) {
  let sc = 0;
  st.b.forEach((x, i) => {
    if (!x) return;
    const r = i >> 3;
    let v = isKing(x) ? 500 : 300 + (sideOf(x) === 'a' ? 7 - r : r) * 8;
    if (!isKing(x) && (r === 0 || r === 7)) v += 20;   // the back row guards against kings
    sc += sideOf(x) === 'a' ? v : -v;
  });
  return st.side === 'a' ? sc : -sc;
}

function search(st, depth, alpha, beta, must) {
  const ms = legal(st, must);
  if (!ms.length) return -100000 - depth;
  if (depth <= 0 && st.chain < 0) return evaluate(st);
  for (const m of ms) {
    const n = apply(st, m);
    const v = n.side === st.side ? search(n, depth, alpha, beta, must) : -search(n, depth - 1, -beta, -alpha, must);
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return alpha;
}

export function cpuMove(st, level) {
  const must = st.must !== false;
  const ms = legal(st, must);
  if (!ms.length) return null;
  const depth = level === 'hard' ? 6 : level === 'medium' ? 3 : 1;
  const noise = level === 'easy' ? 250 : level === 'medium' ? 40 : 5;
  let best = null, bv = -Infinity;
  for (const m of ms) {
    const n = apply(st, m);
    const v = (n.side === st.side ? search(n, depth, -Infinity, Infinity, must) : -search(n, depth - 1, -Infinity, Infinity, must)) + Math.random() * noise;
    if (v > bv) { bv = v; best = m; }
  }
  return best;
}
