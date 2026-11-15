// Tile rummy rules. Pure functions only, shared by the host (the referee) and every player's screen.
// One set of tiles = numbers 1-13 in four colours, two of each, plus two jokers: 106 tiles.
// Tile ids: set * 106 + i. i 0..103 are numbers, 104 and 105 are jokers.

export const PER_SET = 106;
export const COLOR_NAMES = ['black', 'red', 'blue', 'orange'];
export const SYMBOLS = ['♣', '♥', '♠', '◆'];
export const JOKER_POINTS = 30;
export const OPEN_POINTS = 30;
export const DEAL = 14;

export function tile(id) {
  const i = id % PER_SET;
  if (i >= 104) return { j: true, c: 4, n: 0 };
  return { j: false, n: Math.floor(i / 8) + 1, c: Math.floor(i / 2) % 4 };
}

export function makePool(sets) {
  const a = [];
  for (let i = 0; i < PER_SET * sets; i++) a.push(i);
  for (let i = a.length - 1; i > 0; i--) {
    const k = Math.floor(Math.random() * (i + 1));
    [a[i], a[k]] = [a[k], a[i]];
  }
  return a;
}

const span = (lo, hi) => { let s = 0; for (let v = lo; v <= hi; v++) s += v; return s; };

// Works out whether a pile of tiles is a valid set, what order to show it in, and what it is worth.
export function analyze(ids) {
  const ts = ids.map(id => ({ id, ...tile(id) }));
  const jokers = ts.filter(t => t.j), real = ts.filter(t => !t.j);
  const len = ts.length;
  const plain = [...real].sort((a, b) => a.c - b.c || a.n - b.n).concat(jokers).map(t => t.id);
  if (len < 3) return { ok: false, order: plain, value: 0, why: 'Needs 3 or more tiles' };
  if (!real.length) return { ok: true, kind: 'group', order: plain, value: 0 };

  const options = [];
  const n0 = real[0].n, c0 = real[0].c;

  // Group: one number, all different colors, 3 or 4 tiles.
  const sameN = real.every(t => t.n === n0);
  const colours = new Set(real.map(t => t.c));
  if (sameN && colours.size === real.length && len <= 4) {
    options.push({ ok: true, kind: 'group', order: [...real].sort((a, b) => a.c - b.c).concat(jokers).map(t => t.id), value: n0 * len });
  }

  // Run: one color, numbers in a row, jokers fill the gaps.
  const sameC = real.every(t => t.c === c0);
  const nums = new Set(real.map(t => t.n));
  let lo = Math.min(...real.map(t => t.n)), hi = Math.max(...real.map(t => t.n));
  if (sameC && nums.size === real.length && len <= 13 && hi - lo + 1 <= len) {
    let extra = len - (hi - lo + 1);
    const up = Math.min(extra, 13 - hi);
    hi += up; lo -= extra - up;
    const byN = new Map(real.map(t => [t.n, t.id]));
    const js = jokers.map(t => t.id);
    const order = [];
    for (let v = lo; v <= hi; v++) order.push(byN.has(v) ? byN.get(v) : js.shift());
    options.push({ ok: true, kind: 'run', order, value: span(lo, hi), lo });
  }

  if (options.length) return options.sort((a, b) => b.value - a.value)[0];

  let why = 'Use one number in different colors, or numbers in a row in one color';
  if (sameN && colours.size !== real.length) why = 'A color is used twice';
  else if (sameN && len > 4) why = 'A group can have only 4 tiles';
  else if (sameC && nums.size !== real.length) why = 'A number is used twice';
  else if (sameC) why = 'The numbers are not in a row';
  return { ok: false, order: plain, value: 0, why };
}

export function rackPoints(ids) {
  return ids.reduce((s, id) => { const t = tile(id); return s + (t.j ? JOKER_POINTS : t.n); }, 0);
}

const key = ids => [...ids].sort((a, b) => a - b).join(',');

// Points a player's first play is worth: new sets made only from their own rack tiles.
export function openingPoints(startTable, startRack, table) {
  const old = new Set(startTable.map(key));
  const mine = new Set(startRack);
  let pts = 0;
  for (const s of table) {
    if (old.has(key(s))) continue;
    if (!s.every(id => mine.has(id))) continue;
    const a = analyze(s);
    if (a.ok) pts += a.value;
  }
  return pts;
}

// Checks a finished turn. Returns null if it is fine, otherwise a short reason to show the player.
export function checkTurn(startTable, startRack, table, rack, opened) {
  const before = [...startTable.flat(), ...startRack].sort((a, b) => a - b);
  const after = [...table.flat(), ...rack].sort((a, b) => a - b);
  if (before.join(',') !== after.join(',')) return 'Something went wrong with the tiles. Press Reset and try again.';
  const onTable = new Set(table.flat());
  for (const id of startTable.flat()) if (!onTable.has(id)) return 'Tiles on the table must stay on the table.';
  const played = startRack.filter(id => onTable.has(id));
  if (!played.length) return 'Put at least one tile on the table, or press Draw.';
  if (table.some(s => !analyze(s).ok)) return 'Fix the sets marked in red first.';
  if (!opened) {
    const now = new Set(table.map(key));
    if (startTable.some(s => !now.has(key(s)))) return 'On your first play you can only use tiles from your own rack. Press Reset.';
    const mine = new Set(startRack);
    const old = new Set(startTable.map(key));
    if (table.some(s => !old.has(key(s)) && !s.every(id => mine.has(id)))) return 'On your first play you can only use tiles from your own rack. Press Reset.';
    const pts = openingPoints(startTable, startRack, table);
    if (pts < OPEN_POINTS) return `Your first play must add up to ${OPEN_POINTS} or more. You have ${pts}.`;
  }
  return null;
}

// The "MJ": an existing run on the table gets split into two runs, and the player's own tile goes in the middle.
// Example: red 3-4-5-6-7-8-9 becomes 3-4-5-6 and 6-7-8-9 using the player's red 6.
export function isMJ(startTable, startRack, table) {
  const mine = new Set(startRack);
  const played = new Set(table.flat().filter(id => mine.has(id)));
  if (!played.size) return false;
  for (const s of startTable) {
    const a = analyze(s);
    if (!a.ok || a.kind !== 'run') continue;
    const lo = a.lo, hi = a.lo + s.length - 1;
    const old = new Set(s);
    const homes = table.filter(t => t.some(id => old.has(id)));
    const runs = homes.filter(t => { const b = analyze(t); return b.ok && b.kind === 'run'; });
    if (runs.length < 2) continue;
    // The player's tile has to go into one of the split runs (not, say, a group made from the middle tile).
    const inside = runs.some(t => t.some(id => {
      if (!played.has(id)) return false;
      const x = tile(id);
      return x.j || (x.n >= lo && x.n <= hi);
    }));
    if (inside) return true;
  }
  return false;
}

// ---- the table: every tile has its own place ----
// A tile on the table sits at [x, y]: x in tile widths across, y in rows down, on a table BOARD_W tiles wide
// (the same for everyone, so a set is never wrapped onto two lines). Nothing snaps to a grid. Tiles that are
// close together on the same level are one set; tiles further apart are separate sets.

export const BOARD_W = 15;      // wide enough for the longest run (13 tiles)
const JOIN_X = 1.6;             // tiles whose left edges are this close (1 = touching) belong together...
const JOIN_Y = 0.6;             // ...when they also overlap in height (a tile is about 0.7 of a row tall)
const GAP = 0.8;                // the clear space kept between two sets on one row, so they never read as one
const r2 = v => Math.round(v * 100) / 100;

// The sets on the table, each listed left to right.
export function groupsOf(pos) {
  const ids = Object.keys(pos || {}).map(Number).sort((a, b) => pos[a][0] - pos[b][0] || pos[a][1] - pos[b][1] || a - b);
  const parent = new Map(ids.map(id => [id, id]));
  const find = a => { while (parent.get(a) !== a) a = parent.get(a); return a; };
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = pos[ids[i]], b = pos[ids[j]];
    if (b[0] - a[0] > JOIN_X) break;
    if (Math.abs(b[1] - a[1]) <= JOIN_Y) parent.set(find(ids[j]), find(ids[i]));
  }
  const out = new Map();
  for (const id of ids) { const r = find(id); if (!out.has(r)) out.set(r, []); out.get(r).push(id); }
  return [...out.values()];
}

// Sets as rectangles { x, y, n }: n tiles wide, one row tall.
const hits = (a, b) => a.x < b.x + b.n + GAP - 1e-6 && b.x < a.x + a.n + GAP - 1e-6 && Math.abs(a.y - b.y) < 1 - 1e-6;
const maxX = n => Math.max(0, BOARD_W - n);
const freeAt = (placed, n, x, y) => y >= 0 && x >= 0 && x <= maxX(n) + 1e-6 && !placed.some(p => hits({ x, y, n }, p));

// The closest spot to (x, y) where a set of n tiles does not crowd any other set.
function nearestFree(placed, n, x, y) {
  if (freeAt(placed, n, x, y)) return [x, y];
  for (let r = 1; r < 600; r++) {
    const d = r * 0.25;
    let best = null, bd = Infinity;
    for (let i = -r; i <= r; i++) {
      const e = i * 0.25;
      for (const [dx, dy] of [[e, -d], [e, d], [-d, e], [d, e]]) {
        const cx = r2(x + dx), cy = r2(y + dy);
        if (!freeAt(placed, n, cx, cy)) continue;
        const dist = dx * dx + dy * dy;
        if (dist < bd) { bd = dist; best = [cx, cy]; }
      }
    }
    if (best) return best;
  }
  return [x, y];
}

// The first open spot reading across and then down, for a brand new set.
function firstFree(placed, n) {
  for (let y = 0; ; y++) for (let x = 0; x <= maxX(n); x += 0.5) if (freeAt(placed, n, x, y)) return [x, y];
}

// The sets on the table when some tiles ("moved") have just been put down. Tiles put onto or beside a set
// join that set only: the nearest one, so a tile dropped on the end of one set never ties it to its neighbour.
function joinMoved(pos, mv) {
  const stillPos = {}, movedPos = {};
  for (const k of Object.keys(pos)) (mv.has(Number(k)) ? movedPos : stillPos)[k] = pos[k];
  const sets = groupsOf(stillPos);
  if (!Object.keys(movedPos).length) return sets;
  const out = sets.map(g => g.slice()), alone = [];
  for (const c of groupsOf(movedPos)) {
    let best = -1, bd = Infinity;
    sets.forEach((g, gi) => {
      for (const a of g) for (const b of c) {
        const dx = Math.abs(pos[a][0] - pos[b][0]);
        if (dx <= JOIN_X && Math.abs(pos[a][1] - pos[b][1]) <= JOIN_Y && dx < bd) { bd = dx; best = gi; }
      }
    });
    if (best < 0) alone.push(c); else out[best].push(...c);
  }
  for (const g of out) g.sort((a, b) => pos[a][0] - pos[b][0] || pos[a][1] - pos[b][1] || a - b);
  return [...out, ...alone];
}

// Straighten the table up: each set becomes a level, evenly spaced row, staying where it was put.
// "moved" are the tiles just put down: the tiles that were already there stay still and the new ones line up
// with them. A set that would crowd another is nudged to the nearest clear spot. With "reorder" (the end of
// a turn) each valid set is also put in order (runs low to high, groups by color).
export function tidyPos(pos, moved, reorder) {
  const mv = moved || new Set();
  const groups = joinMoved(pos, mv).map(g => {
    const still = g.filter(id => !mv.has(id));
    const base = still.length ? still : g;
    const y = base.reduce((s, id) => s + pos[id][1], 0) / base.length;
    const k = g.findIndex(id => !mv.has(id));
    const x = k < 0 ? pos[g[0]][0] : pos[g[k]][0] - k;
    let ids = g;
    if (reorder) { const a = analyze(g); if (a.ok) ids = a.order; }
    return { ids, n: g.length, x: r2(Math.min(Math.max(x, 0), maxX(g.length))), y: r2(Math.max(0, y)), loose: still.length < g.length, grown: still.length > 0 && still.length < g.length,
      sx: still.length ? Math.min(...still.map(id => pos[id][0])) : 0 };
  });
  const placed = [], out = {};
  const put = (g, x0, y0) => {
    const [x, y] = nearestFree(placed, g.n, r2(Math.min(Math.max(x0, 0), maxX(g.n))), y0);
    placed.push({ x, y, n: g.n });
    g.ids.forEach((id, i) => { out[id] = [r2(x + i), r2(y)]; });
  };
  // A set that just had tiles added to it stays put and takes the room it needs...
  // A tile added on its left end would push into a close neighbour on that side: the set grows rightwards instead.
  const mid = g => g.x + g.n / 2;
  const grown = groups.filter(g => g.grown);
  for (const g of grown) {
    if (groups.some(o => !o.loose && mid(o) < mid(g) && hits(g, o))) g.x = r2(Math.min(g.sx, maxX(g.n)));
    put(g, g.x, g.y);
  }
  // ...and untouched sets beside it on the same row slide along to make that room (nearest ones first).
  const rest = groups.filter(g => !g.loose);
  for (const g of rest) {
    const near = grown.filter(a => Math.abs(a.y - g.y) < 1).sort((a, b) => Math.abs(mid(a) - mid(g)) - Math.abs(mid(b) - mid(g)))[0];
    g.side = near ? (mid(g) >= mid(near) ? 1 : -1) : 0;
  }
  const ordered = [...rest.filter(g => g.side < 0).sort((a, b) => b.x - a.x), ...rest.filter(g => g.side >= 0).sort((a, b) => a.x - b.x)];
  for (const g of ordered) {
    let x = g.x;
    if (g.side) for (let n = 0; n < 30; n++) {
      const p = placed.find(q => hits({ x, y: g.y, n: g.n }, q));
      if (!p) break;
      x = r2(g.side > 0 ? p.x + p.n + GAP : p.x - g.n - GAP);
    }
    put(g, x, g.y);
  }
  // Brand new sets go last: they are the ones that give way.
  for (const g of groups.filter(g => g.loose && !g.grown)) put(g, g.x, g.y);
  return out;
}

// The end of a turn: the sets are packed up tidily in reading order (top row first, left to right), one tile's
// space apart, onto as few rows as they need. Each set keeps its own order.
export function packPos(pos) {
  const sets = groupsOf(pos).map(g => ({ ids: g, x: Math.min(...g.map(id => pos[id][0])), y: Math.round(g.reduce((s, id) => s + pos[id][1], 0) / g.length) }));
  sets.sort((a, b) => a.y - b.y || a.x - b.x);
  const out = {};
  let x = 0, y = 0;
  for (const s of sets) {
    const n = s.ids.length;
    if (x > 0 && x + n > BOARD_W) { x = 0; y++; }
    s.ids.forEach((id, i) => { out[id] = [x + i, y]; });
    x += n + 1;
  }
  return out;
}

// The MJ, done for the player: a tile dropped into a run that it does not simply extend. If the run can be
// split in two so that both halves are valid with the new tile in one of them, the tiles shift apart and a
// space opens between the halves. Example: a red 6 dropped onto red 3-4-5-6-7-8-9 gives 3-4-5-6 and 6-7-8-9.
// Returns { pos, moved } (the new places, and the tiles that moved), or null when there is nothing to split.
export function autoSplit(pos, moved) {
  const mv = moved || new Set();
  let out = null;
  const shifted = new Set(mv);
  for (const g of groupsOf(pos)) {
    const mine = g.filter(id => mv.has(id)), rest = g.filter(id => !mv.has(id));
    if (mine.length !== 1 || rest.length < 3 || analyze(g).ok) continue;
    const a = analyze(rest);
    if (!a.ok || a.kind !== 'run') continue;
    const t = mine[0], order = a.order;
    const at = rest.filter(id => pos[id][0] < pos[t][0]).length;   // where along the run it was dropped
    let best = null;
    for (let k = 1; k < order.length; k++) {
      const L = order.slice(0, k), R = order.slice(k);
      for (const [x, y] of [[[...L, t], R], [L, [t, ...R]]]) {
        const ax = analyze(x), ay = analyze(y);
        if (!ax.ok || !ay.ok) continue;
        if (!best || Math.abs(k - at) < best.d) best = { d: Math.abs(k - at), x: ax.order, y: ay.order };
      }
    }
    if (!best) continue;
    out = out || { ...pos };
    const x0 = Math.min(...rest.map(id => pos[id][0]));
    const y0 = r2(rest.reduce((s, id) => s + pos[id][1], 0) / rest.length);
    best.x.forEach((id, i) => { out[id] = [r2(x0 + i), y0]; });
    // the second half sits one tile's width further along, and is the half that gives way if space is tight
    best.y.forEach((id, i) => { out[id] = [r2(x0 + best.x.length + 1 + i), y0]; shifted.add(id); });
  }
  return out && { pos: out, moved: shifted };
}

// Lay a new list of sets onto the table (for computer players, and for games saved by an older version):
// sets that did not change stay where they were, a changed set goes where most of its tiles already were
// (or as near as it fits), and a brand new set goes into the first open spot.
export function layoutPos(pos, sets) {
  const old = groupsOf(pos).map(g => ({ ids: g, set: new Set(g), x: pos[g[0]][0], y: pos[g[0]][1] }));
  const byKey = new Map(old.map(o => [key(o.ids), o]));
  const placed = [], out = {}, todo = [];
  for (const s of sets) {
    const o = byKey.get(key(s));
    if (!o) { todo.push(s); continue; }
    byKey.delete(key(s));
    placed.push({ x: o.x, y: o.y, n: s.length });
    for (const id of o.ids) out[id] = pos[id];
  }
  for (const s of todo) {
    const a = analyze(s), ids = a.ok ? a.order : s, n = ids.length;
    let home = null, most = 0;
    for (const o of old) { const c = ids.filter(id => o.set.has(id)).length; if (c > most) { most = c; home = o; } }
    const [x, y] = home ? nearestFree(placed, n, r2(Math.min(home.x, maxX(n))), home.y) : firstFree(placed, n);
    placed.push({ x, y, n });
    ids.forEach((id, i) => { out[id] = [r2(x + i), r2(y)]; });
  }
  return out;
}
