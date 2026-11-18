// Chess: the rules, the referee side and the computer player. Two players: Player 1 has white and moves first.
// The board is 64 squares, 0 = a8 (top left from white's side) ... 63 = h1. Pieces are letters: white
// uppercase (PNBRQK), black lowercase, '' for an empty square.

const START = 'rnbqkbnrpppppppp' + ' '.repeat(32) + 'PPPPPPPPRNBQKBNR';
const isW = x => x && x === x.toUpperCase();
const sideOf = x => (x ? (isW(x) ? 'w' : 'b') : null);
const rc = sq => [sq >> 3, sq & 7];
const at = (r, c) => (r < 0 || r > 7 || c < 0 || c > 7 ? -1 : r * 8 + c);
const KN = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KG = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];
export const NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
export const sqName = sq => 'abcdefgh'[sq & 7] + (8 - (sq >> 3));

export function newBoard() {
  return { b: START.split('').map(x => (x === ' ' ? '' : x)), side: 'w', cast: 'KQkq', ep: -1, half: 0 };
}

// Is square sq attacked by side `by`?
function attacked(b, sq, by) {
  const [r, c] = rc(sq);
  const own = x => x && sideOf(x) === by;
  const is = (x, k) => own(x) && x.toLowerCase() === k;
  // pawns
  const pr = by === 'w' ? r + 1 : r - 1;
  for (const dc of [-1, 1]) { const s = at(pr, c + dc); if (s >= 0 && is(b[s], 'p')) return true; }
  for (const [dr, dc] of KN) { const s = at(r + dr, c + dc); if (s >= 0 && is(b[s], 'n')) return true; }
  for (const [dr, dc] of KG) { const s = at(r + dr, c + dc); if (s >= 0 && is(b[s], 'k')) return true; }
  for (const [dirs, ks] of [[DIAG, 'bq'], [ORTH, 'rq']]) {
    for (const [dr, dc] of dirs) {
      let rr = r + dr, cc = c + dc;
      for (let s = at(rr, cc); s >= 0; rr += dr, cc += dc, s = at(rr, cc)) {
        const x = b[s];
        if (!x) continue;
        if (own(x) && ks.includes(x.toLowerCase())) return true;
        break;
      }
    }
  }
  return false;
}
const kingSq = (b, side) => b.indexOf(side === 'w' ? 'K' : 'k');
export const inCheck = (st, side = st.side) => attacked(st.b, kingSq(st.b, side), side === 'w' ? 'b' : 'w');

// Every move that follows how the pieces move, before checking whether it leaves your own king in check.
function pseudo(st) {
  const { b, side } = st, out = [], foe = side === 'w' ? 'b' : 'w';
  for (let f = 0; f < 64; f++) {
    const x = b[f];
    if (!x || sideOf(x) !== side) continue;
    const k = x.toLowerCase(), [r, c] = rc(f);
    const add = (t, extra) => out.push({ f, t, ...extra });
    if (k === 'p') {
      const dir = side === 'w' ? -1 : 1, last = side === 'w' ? 0 : 7, home = side === 'w' ? 6 : 1;
      const push = t => { if ((t >> 3) === last) for (const p of 'qrbn') add(t, { p }); else add(t); };
      const one = at(r + dir, c);
      if (one >= 0 && !b[one]) {
        push(one);
        const two = at(r + 2 * dir, c);
        if (r === home && !b[two]) add(two, { two: true });
      }
      for (const dc of [-1, 1]) {
        const t = at(r + dir, c + dc);
        if (t < 0) continue;
        if (b[t] && sideOf(b[t]) === foe) push(t);
        else if (t === st.ep) add(t, { ep: true });
      }
    } else if (k === 'n' || k === 'k') {
      for (const [dr, dc] of k === 'n' ? KN : KG) {
        const t = at(r + dr, c + dc);
        if (t >= 0 && sideOf(b[t]) !== side) add(t);
      }
      if (k === 'k') {
        const row = side === 'w' ? 7 : 0, K = side === 'w' ? 'K' : 'k', Q = side === 'w' ? 'Q' : 'q';
        if (f === row * 8 + 4 && !attacked(b, f, foe)) {
          if (st.cast.includes(K) && !b[f + 1] && !b[f + 2] && b[f + 3] === (side === 'w' ? 'R' : 'r') && !attacked(b, f + 1, foe) && !attacked(b, f + 2, foe)) add(f + 2, { castle: 'k' });
          if (st.cast.includes(Q) && !b[f - 1] && !b[f - 2] && !b[f - 3] && b[f - 4] === (side === 'w' ? 'R' : 'r') && !attacked(b, f - 1, foe) && !attacked(b, f - 2, foe)) add(f - 2, { castle: 'q' });
        }
      }
    } else {
      const dirs = k === 'b' ? DIAG : k === 'r' ? ORTH : [...DIAG, ...ORTH];
      for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        for (let t = at(rr, cc); t >= 0; rr += dr, cc += dc, t = at(rr, cc)) {
          if (!b[t]) { add(t); continue; }
          if (sideOf(b[t]) === foe) add(t);
          break;
        }
      }
    }
  }
  return out;
}

// The position after a move (a new object; the old one is left alone).
export function apply(st, m) {
  const b = st.b.slice(), x = b[m.f], k = x.toLowerCase(), side = st.side;
  const took = b[m.t] || (m.ep ? b[m.t + (side === 'w' ? 8 : -8)] : '');
  b[m.t] = m.p ? (side === 'w' ? m.p.toUpperCase() : m.p) : x;
  b[m.f] = '';
  if (m.ep) b[m.t + (side === 'w' ? 8 : -8)] = '';
  if (m.castle === 'k') { b[m.f + 1] = b[m.f + 3]; b[m.f + 3] = ''; }
  if (m.castle === 'q') { b[m.f - 1] = b[m.f - 4]; b[m.f - 4] = ''; }
  let cast = st.cast;
  const lose = s => { cast = cast.replace(s, ''); };
  if (x === 'K') { lose('K'); lose('Q'); }
  if (x === 'k') { lose('k'); lose('q'); }
  for (const [sq, ch] of [[63, 'K'], [56, 'Q'], [7, 'k'], [0, 'q']]) if (m.f === sq || m.t === sq) lose(ch);
  return {
    b, side: side === 'w' ? 'b' : 'w', cast, ep: m.two ? (m.f + m.t) / 2 : -1,
    half: k === 'p' || took ? 0 : st.half + 1, took,
  };
}

export function legal(st) {
  return pseudo(st).filter(m => { const n = apply(st, m); return !attacked(n.b, kingSq(n.b, st.side), n.side); });
}

// Only kings, or a king and one bishop or knight: nobody can win.
function noMaterial(b) {
  const rest = b.filter(x => x && x.toLowerCase() !== 'k');
  return !rest.length || (rest.length === 1 && 'bn'.includes(rest[0].toLowerCase()));
}
const posKey = st => st.b.map(x => x || '.').join('') + st.side + st.cast + st.ep;

/* ---------------- the referee ---------------- */

export const CHESS = {
  start(room, seats) {
    const s = room.s;
    const st = newBoard();
    s.chess = { ...st, w: seats[0].pid, bl: seats[1].pid, last: null, check: false, cap: [], keys: [posKey(st)], why: null };
    s.turn = seats[0].pid;
    room.note(`Chess! ${seats[0].name} has white and goes first.`);
  },

  act(room, p, m) {
    const s = room.s, c = s.chess;
    if (!c) return;
    if (m.a === 'resign') {
      if (!p.seat) return;
      const other = room.player(p.pid === c.w ? c.bl : c.w);
      c.why = `${p.name} gave up`;
      return room.finish(other || null);
    }
    if (m.a !== 'move' || s.turn !== p.pid) return;
    const mv = legal(c).find(x => x.f === m.f && x.t === m.to && (x.p || null) === (m.p || (x.p ? 'q' : null)));
    if (!mv) return;
    doMove(room, mv);
  },

  auto(s) {
    const p = s.chess && s.players.find(q => q.pid === s.turn);
    return p && p.cpu ? { key: 'cpu:' + s.turnNo, ms: 700 + Math.random() * 700 } : null;
  },
  run(room, key) {
    const s = room.s, t = CHESS.auto(s);
    if (!t || t.key !== key) return;
    const p = room.player(s.turn);
    const mv = cpuMove(s.chess, p.cpu);
    if (mv) doMove(room, mv);
  },
  skip() {},
  end(room) { if (room.s.chess) room.s.chess.why = 'The host ended the game'; room.finish(null); },
};

function doMove(room, mv) {
  const s = room.s, c = s.chess;
  const mover = room.player(s.turn);
  const n = apply(c, mv);
  if (n.took) c.cap.push(n.took);
  Object.assign(c, { b: n.b, side: n.side, cast: n.cast, ep: n.ep, half: n.half });
  c.last = { f: mv.f, t: mv.t };
  c.keys = n.half === 0 ? [posKey(c)] : [...c.keys, posKey(c)].slice(-110);
  c.check = inCheck(c);
  s.turn = c.side === 'w' ? c.w : c.bl;
  s.turnNo++;
  const next = room.player(s.turn);
  const moves = legal(c);
  if (!moves.length) {
    if (c.check) { c.why = 'Checkmate!'; room.note(`Checkmate! ${mover.name} wins`); return room.finish(mover); }
    c.why = 'Stalemate: no legal moves, so it is a draw'; return room.finish(null);
  }
  if (noMaterial(c.b)) { c.why = 'Not enough pieces left to checkmate: a draw'; return room.finish(null); }
  if (c.half >= 100) { c.why = '50 moves with no capture or pawn move: a draw'; return room.finish(null); }
  const key = posKey(c);
  if (c.keys.filter(k => k === key).length >= 3) { c.why = 'The same position three times: a draw'; return room.finish(null); }
  if (c.check && next) s.ann = { pid: next.pid, name: next.name, rc: next.rc, kind: 'check', text: `${next.name} is in check`, sub: 'Check!', k: s.v + 1 };
  room.note(`${mover.name} moved ${NAMES[(n.b[mv.t] || 'p').toLowerCase()]} to ${sqName(mv.t)}`);
  room.push();
}

/* ---------------- the computer player ---------------- */

const VAL = { p: 100, n: 310, b: 330, r: 500, q: 900, k: 0 };
// a small push toward the middle of the board, and pawns forward
const CENTER = Array.from({ length: 64 }, (_, i) => { const [r, c] = rc(i); return 14 - 4 * (Math.abs(3.5 - r) + Math.abs(3.5 - c)); });

function evaluate(st) {
  let sc = 0;
  st.b.forEach((x, i) => {
    if (!x) return;
    const k = x.toLowerCase(), w = isW(x);
    let v = VAL[k];
    if (k === 'n' || k === 'b') v += CENTER[i];
    else if (k === 'p') v += (w ? 6 - (i >> 3) : (i >> 3) - 1) * 8 + CENTER[i] / 3;
    else if (k === 'q') v += CENTER[i] / 3;
    sc += w ? v : -v;
  });
  return st.side === 'w' ? sc : -sc;
}

const order = (st, ms) => ms.map(m => [m, (st.b[m.t] ? VAL[st.b[m.t].toLowerCase()] * 10 - VAL[st.b[m.f].toLowerCase()] : 0) + (m.p === 'q' ? 800 : 0)])
  .sort((a, b) => b[1] - a[1]).map(a => a[0]);

function search(st, depth, alpha, beta) {
  if (depth === 0) return evaluate(st);
  const ms = legal(st);
  if (!ms.length) return inCheck(st) ? -100000 - depth : 0;
  for (const m of order(st, ms)) {
    const v = -search(apply(st, m), depth - 1, -beta, -alpha);
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return alpha;
}

export function cpuMove(st, level) {
  const ms = legal(st);
  if (!ms.length) return null;
  const depth = level === 'hard' ? 4 : level === 'medium' ? 2 : 1;
  const noise = level === 'easy' ? 160 : level === 'medium' ? 30 : 6;
  let best = null, bv = -Infinity;
  for (const m of order(st, ms)) {
    const n = apply(st, m);
    // a move that mates straight away is always taken
    if (!legal(n).length && inCheck(n)) return m;
    const v = -search(n, depth - 1, -Infinity, best ? -(bv - noise) : Infinity) + Math.random() * noise;
    if (v > bv) { bv = v; best = m; }
  }
  return best;
}
