// Tile rummy rules. Pure functions only, shared by the host (the referee) and every player's screen.
// One set of tiles = numbers 1-13 in four colours, two of each, plus two jokers: 106 tiles.
// Tile ids: set * 106 + i. i 0..103 are numbers, 104 and 105 are jokers.

export const PER_SET = 106;
export const COLOR_NAMES = ['black', 'red', 'blue', 'orange'];
export const SYMBOLS = ['■', '●', '▲', '◆'];
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
const JOIN_Y = 0.5;             // ...when they are also within half a row of the same height
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

// Straighten the table up: each set becomes a level, evenly spaced row, staying where it was put.
// "moved" are the tiles just put down: the tiles that were already there stay still and the new ones line up
// with them. A set that would crowd another is nudged to the nearest clear spot. With "reorder" (the end of
// a turn) each valid set is also put in order (runs low to high, groups by color).
export function tidyPos(pos, moved, reorder) {
  const mv = moved || new Set();
  const groups = groupsOf(pos).map(g => {
    const still = g.filter(id => !mv.has(id));
    const base = still.length ? still : g;
    const y = base.reduce((s, id) => s + pos[id][1], 0) / base.length;
    const k = g.findIndex(id => !mv.has(id));
    const x = k < 0 ? pos[g[0]][0] : pos[g[k]][0] - k;
    let ids = g;
    if (reorder) { const a = analyze(g); if (a.ok) ids = a.order; }
    return { ids, n: g.length, x: r2(Math.min(Math.max(x, 0), maxX(g.length))), y: r2(Math.max(0, y)), loose: still.length < g.length };
  });
  const placed = [], out = {};
  for (const g of [...groups.filter(g => !g.loose), ...groups.filter(g => g.loose)]) {
    const [x, y] = nearestFree(placed, g.n, g.x, g.y);
    placed.push({ x, y, n: g.n });
    g.ids.forEach((id, i) => { out[id] = [r2(x + i), r2(y)]; });
  }
  return out;
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
