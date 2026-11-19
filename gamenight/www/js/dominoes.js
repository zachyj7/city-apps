// Dominoes, the Mexican Train way (double-twelve set), with the family's house rules: the shared trains are
// "community trains", and there can be several. The referee side, for 2-8 players.
// Each round's engine is a double (12, then 11, ... down to blank) in the middle. Everyone draws their tiles first;
// whoever holds the round's double lays it in the middle and so has gone first (play carries on to their left).
// If nobody holds it, that round is skipped and the next double down is looked for. Everyone builds their own
// train from it. One tile a turn (or a double and the tile that covers it): on your first turn on your own
// train; after that on your own train, any community train (anyone may start a new one after their first turn,
// up to six), or another player's train only if it has a penny on it. If someone couldn't start their own train, someone
// else may start it for them; that is their whole turn. Can't play? Draw one; if it still doesn't play, a marker goes on your train (so
// others may play on it) until you play on it again. A double must be covered straight away by the same player;
// if they can't (after drawing), it stays an open double and everyone must cover it before playing anywhere
// else. The round ends when someone plays their last tile; everyone scores the pips left in hand. Lowest total
// after the last round wins. (If nobody can play and the boneyard is empty, the round ends there.)
//
// A tile is a number 0-90; TILES[id] = [a, b] with a <= b. Trains are kept as [{ id, a, b }] where b is the
// open end. d.trains holds each player's train (by pid) and the community trains ('c0', 'c1', ...).

export const TILES = (() => { const t = []; for (let a = 0; a <= 12; a++) for (let b = a; b <= 12; b++) t.push([a, b]); return t; })();
export const pips = id => TILES[id][0] + TILES[id][1];
const isDouble = id => TILES[id][0] === TILES[id][1];
const DEAL = { 2: 16, 3: 16, 4: 15, 5: 14, 6: 12, 7: 10, 8: 9 };
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const seated = s => s.players.filter(p => p.seat);
const fits = (id, n) => TILES[id][0] === n || TILES[id][1] === n;
export const MAX_COMMUNITY = 6;
export const communityKeys = d => Object.keys(d.trains).filter(k => d.trains[k].community).sort((a, b) => d.trains[a].n - d.trains[b].n);

// The open end of a train (the engine's number while it is empty).
export const endOf = (d, key) => { const t = d.trains[key] ? d.trains[key].tiles : []; return t.length ? t[t.length - 1].b : d.engine; };   // ('new': a community train not started yet)

// Every move this player may make now: [{ id, train }].
export function moves(d, p) {
  const out = [], hand = p.hand || [];
  const on = key => { const n = endOf(d, key); for (const id of hand) if (fits(id, n)) out.push({ id, train: key }); };
  const t = d.turn || {};
  if (t.cover) { on(t.cover); return out; }                 // the double I just played must be covered
  if (d.open) { on(d.open); return out; }                   // an open double: everyone covers it first
  on(p.pid);
  if (!d.first[p.pid]) return out;                          // first turn: my own train only
  for (const key of communityKeys(d)) on(key);
  // a new community train starts from the engine
  if (communityKeys(d).length < MAX_COMMUNITY) for (const id of hand) if (fits(id, d.engine)) out.push({ id, train: 'new' });
  for (const key in d.trains) if (!d.trains[key].community && key !== p.pid && d.trains[key].marker) on(key);
  return out;
}

export const DOMINOES = {
  start(room, seats, cfg) {
    const s = room.s;
    s.dm = { cfg, roundNo: 0, rounds: +cfg.rounds || 13, scores: {}, why: null };
    for (const q of seats) s.dm.scores[q.pid] = 0;
    deal(room);
  },

  act(room, p, m) {
    const s = room.s, d = s.dm;
    if (!d || d.stage !== 'play' || s.turn !== p.pid) return;
    if (m.a === 'play') {
      const id = Math.floor(+m.id);
      const mv = moves(d, p).find(x => x.id === id && x.train === m.train);
      if (mv) place(room, p, mv);
      return;
    }
    if (m.a === 'draw') { if (!moves(d, p).length) draw(room, p); return; }
  },

  auto(s) {
    const d = s.dm;
    if (!d || s.phase !== 'play') return null;
    if (d.stage === 'scored') return { key: 'next:' + d.roundNo, ms: 7000 };
    const p = s.players.find(q => q.pid === s.turn);
    return p && p.cpu ? { key: `cpu:${s.turnNo}:${d.turn.played}:${d.turn.drew}`, ms: 700 + Math.random() * 500 } : null;
  },
  run(room, key) {
    const s = room.s, t = DOMINOES.auto(s);
    if (!t || t.key !== key) return;
    if (s.dm.stage === 'scored') return deal(room);
    cpuStep(room, room.player(s.turn));
  },
  // someone is away: their turn is played for them, one step at a time
  skip(room, cur) { if (cur && room.s.dm && room.s.dm.stage === 'play') { for (let i = 0; i < 20 && room.s.turn === cur.pid && room.s.phase === 'play'; i++) cpuStep(room, cur); } },
  end(room) { if (room.s.dm) room.s.dm.why = 'The host ended the game'; room.finish(null); },
};

const doubleOf = n => TILES.findIndex(([a, b]) => a === n && b === n);

function deal(room) {
  const s = room.s, d = s.dm, seats = seated(s), n = seats.length;
  // everyone draws from the whole set
  const bone = shuffle(Array.from({ length: TILES.length }, (_, i) => i));
  for (const q of seats) q.hand = bone.splice(0, DEAL[Math.max(2, Math.min(8, n))]);
  // whoever holds this round's double lays it in the middle; nobody has it: that round is skipped
  let holder = null;
  for (; d.roundNo < d.rounds; d.roundNo++) {
    d.engine = 12 - d.roundNo;
    holder = seats.find(q => q.hand.includes(doubleOf(d.engine)));
    if (holder) break;
    room.note(`Nobody drew double ${d.engine}: round ${d.roundNo + 1} is skipped`);
  }
  if (!holder) return finishGame(room);
  holder.hand.splice(holder.hand.indexOf(doubleOf(d.engine)), 1);
  d.bone = bone;
  d.trains = {};
  for (const q of seats) d.trains[q.pid] = { tiles: [], marker: false };
  Object.assign(d, { stage: 'play', first: {}, open: null, passes: 0, ending: false, last: null, roundPts: null });
  d.turn = { played: 0, drew: false, cover: null };
  // laying the engine was the holder's go: the next player plays first
  s.turn = seats[(seats.indexOf(holder) + 1) % n].pid;
  s.turnNo++;
  s.ann = { pid: holder.pid, name: holder.name, rc: holder.rc, kind: 'dbl', text: `${holder.name} had double ${d.engine} and laid it in the middle`, sub: 'Engine!', k: s.v + 1 };
  room.note(`Round ${d.roundNo + 1} of ${d.rounds}: ${holder.name} laid the engine, double ${d.engine}. ${room.player(s.turn).name} plays first.`);
  room.push();
}

function place(room, p, mv) {
  const s = room.s, d = s.dm;
  if (mv.train === 'new') {
    const k = communityKeys(d).length;
    mv = { ...mv, train: 'c' + k };
    d.trains[mv.train] = { tiles: [], community: true, n: k };
    room.note(`${p.name} started a community train`);
  }
  const train = d.trains[mv.train], n = endOf(d, mv.train);
  // starting the train of someone who couldn't: that is the whole turn
  const startedFor = !train.community && mv.train !== p.pid && !train.tiles.length;
  let [a, b] = TILES[mv.id];
  if (a !== n) [a, b] = [b, a];   // the matching number joins the train
  p.hand.splice(p.hand.indexOf(mv.id), 1);
  train.tiles.push({ id: mv.id, a, b });
  if (mv.train === p.pid) train.marker = false;          // playing on your own train takes your marker off
  if (d.open === mv.train) d.open = null;                // an open double is covered
  const t = d.turn;
  if (t.cover === mv.train) t.cover = null;
  t.played++; d.passes = 0;
  d.last = { pid: p.pid, id: mv.id, train: mv.train, k: s.v + 1 };
  if (isDouble(mv.id)) {
    t.cover = mv.train; t.drew = false;                   // cover it now (drawing again if need be)
    s.ann = { pid: p.pid, name: p.name, rc: p.rc, kind: 'dbl', text: `${p.name} played double ${a}: it must be covered`, sub: 'Double!', k: s.v + 1 };
  }
  if (!p.hand.length) {
    // out! (even on a double). Anyone who hasn't had a first turn yet still gets one.
    if (seated(s).every(q => d.first[q.pid] || q.pid === p.pid)) return endRound(room, p);
    d.ending = true; t.cover = null;
    return endTurn(room, p, true);
  }
  if (startedFor) {
    const who = room.player(mv.train);
    if (who) room.note(`${p.name} started ${who.name}'s train`);
    return endTurn(room, p, true);
  }
  if (t.cover) { s.turnNo++; return room.push(); }    // a double: now the tile that covers it
  endTurn(room, p, true);                             // one tile a turn
}

function draw(room, p) {
  const s = room.s, d = s.dm, t = d.turn;
  if (t.drew || !d.bone.length) return giveUp(room, p);
  p.hand.push(d.bone.pop());
  t.drew = true;
  s.drew = { pid: p.pid, name: p.name, rc: p.rc, pass: false, n: 1, k: s.v + 1 };
  if (!moves(d, p).length) return giveUp(room, p);
  s.turnNo++;
  room.push();
}

// Nothing they may play anywhere, even after drawing (or with nothing left to draw): a penny goes on their
// train, so others may play on it, and a double they couldn't cover stays open for everyone.
function giveUp(room, p) {
  const s = room.s, d = s.dm, t = d.turn;
  d.trains[p.pid].marker = true;
  if (t.cover) { d.open = t.cover; room.note(`Open double! Everyone must cover it first`); }
  if (!t.played) d.passes++;
  room.note(`${p.name} couldn't play`);
  endTurn(room, p, !!t.played);
}

function endTurn(room, p) {
  const s = room.s, d = s.dm, seats = seated(s);
  d.first[p.pid] = true;
  d.turn = { played: 0, drew: false, cover: null };
  // blocked: nobody can play and nothing left to draw
  if (!d.bone.length && d.passes >= seats.length) return endRound(room, null);
  let i = seats.findIndex(q => q.pid === p.pid);
  for (let k = 1; k <= seats.length; k++) {
    const q = seats[(i + k) % seats.length];
    if (d.ending && d.first[q.pid]) continue;              // after someone went out on their first turn
    s.turn = q.pid; s.turnNo++;
    return room.push();
  }
  endRound(room, seats.find(q => !q.hand.length) || null);
}

function endRound(room, outP) {
  const s = room.s, d = s.dm, seats = seated(s);
  const got = {};
  for (const q of seats) { got[q.pid] = q.hand.reduce((n, id) => n + pips(id), 0); d.scores[q.pid] = (d.scores[q.pid] || 0) + got[q.pid]; }
  d.roundPts = got; d.roundOut = outP ? outP.pid : null;
  if (outP) s.ann = { pid: outP.pid, name: outP.name, rc: outP.rc, kind: 'last', text: `${outP.name} played their last tile!`, sub: 'Out!', k: s.v + 1 };
  room.note(outP ? `${outP.name} went out` : 'Nobody can play: the round is over');
  d.roundNo++;
  if (d.roundNo >= d.rounds) return finishGame(room);
  d.stage = 'scored'; s.turn = null; s.turnNo++;
  room.push();
}

function finishGame(room) {
  const s = room.s, d = s.dm, seats = seated(s);
  const order = seats.slice().sort((a, b) => d.scores[a.pid] - d.scores[b.pid]);
  d.why = 'Final scores: ' + order.map(q => `${q.name} ${d.scores[q.pid]}`).join(', ');
  const tie = order.length > 1 && d.scores[order[0].pid] === d.scores[order[1].pid];
  return room.finish(tie ? null : order[0]);
}

/* ---------------- computer players ---------------- */

// One step of a computer's turn: play a tile (or cover its double), or draw.
export function cpuChoice(d, p) {
  const ms = moves(d, p);
  if (!ms.length) return { a: 'draw' };
  if (p.cpu === 'easy' && Math.random() < 0.5) return { a: 'play', ...ms[Math.floor(Math.random() * ms.length)] };
  const has = n => p.hand.filter(id => fits(id, n)).length;
  const score = mv => {
    const [a, b] = TILES[mv.id];
    let sc = pips(mv.id);
    if (mv.train === p.pid) sc += 8;                                         // keep my own train moving (and unmarked)
    if (a === b) sc += has(a) > 1 ? 25 : -30;                                 // only play a double I can cover
    if (p.cpu === 'hard') { const other = a === endOf(d, mv.train) ? b : a; sc += has(other) * 3; }   // leave an end I can follow
    return sc;
  };
  return { a: 'play', ...ms.sort((x, y) => score(y) - score(x))[0] };
}

function cpuStep(room, p) {
  const s = room.s, d = s.dm;
  if (!p || d.stage !== 'play') return;
  const c = cpuChoice(d, p);
  if (c.a === 'draw') return draw(room, p);
  place(room, p, { id: c.id, train: c.train });
}
