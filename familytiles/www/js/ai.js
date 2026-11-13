// Computer players. Given the table and a rack, work out a turn: the new table and what is left on the rack,
// or null to draw. Every level follows the real rules (first play of 30+ from its own rack, valid sets).
//   easy   - plays from its rack without jokers, often only one set, sometimes adds onto the table,
//            and now and then just draws
//   medium - puts down as much of its rack as it can (jokers too) and adds tiles onto sets on the table
//   hard   - all of that, and rearranges the table: splits runs to slip tiles in the middle and borrows
//            tiles from sets that stay valid without them
import { tile, analyze, OPEN_POINTS } from './rules.js';

const keyOf = id => { const t = tile(id); return t.j ? 'J' : t.c + ':' + t.n; };

// Every set that could be made from these tiles, as lists of tile keys ("color:number", or "J" for a joker).
function candidateSets(ids, useJokers) {
  const have = new Map();
  for (const id of ids) { const k = keyOf(id); have.set(k, (have.get(k) || 0) + 1); }
  const jokers = useJokers ? (have.get('J') || 0) : 0;
  const out = [];
  // groups: one number, different colors, 3 or 4 tiles
  for (let n = 1; n <= 13; n++) {
    const cols = [0, 1, 2, 3].filter(c => have.get(c + ':' + n));
    const subsets = 1 << cols.length;
    for (let m = 1; m < subsets; m++) {
      const pick = cols.filter((_, i) => m & (1 << i)).map(c => c + ':' + n);
      for (let j = 0; j <= jokers; j++) {
        const size = pick.length + j;
        if (size >= 3 && size <= 4) out.push([...pick, ...Array(j).fill('J')]);
      }
    }
  }
  // runs: one color, numbers in a row, jokers in the gaps
  for (let c = 0; c < 4; c++) {
    for (let s = 1; s <= 11; s++) {
      let missing = 0, real = 0;
      const keys = [];
      for (let n = s; n <= 13; n++) {
        const k = c + ':' + n;
        if (have.get(k)) { keys.push(k); real++; } else { keys.push('J'); missing++; }
        if (missing > jokers) break;
        if (keys.length >= 3 && real > 0) out.push(keys.slice());
      }
    }
  }
  return out;
}

const countsOf = ids => { const m = new Map(); for (const id of ids) { const k = keyOf(id); m.set(k, (m.get(k) || 0) + 1); } return m; };

// Choose sets from the rack that use as many tiles as possible (and, for a first play, reach 30 points).
function bestPacking(ids, useJokers, needOpen, limit = 40000) {
  const cands = candidateSets(ids, useJokers);
  const sample = new Map(ids.map(id => [keyOf(id), id]));
  const info = cands.map(keys => ({ keys, value: analyze(keys.map(k => sample.get(k))).value }))
    .sort((a, b) => b.keys.length - a.keys.length || b.value - a.value);
  const counts = countsOf(ids);
  const total = ids.length;
  let best = { tiles: 0, value: 0, sets: [] }, nodes = 0;
  const chosen = [];
  const fits = keys => {
    const need = new Map();
    for (const k of keys) need.set(k, (need.get(k) || 0) + 1);
    for (const [k, n] of need) if ((counts.get(k) || 0) < n) return false;
    return true;
  };
  const take = (keys, d) => { for (const k of keys) counts.set(k, counts.get(k) - d); };
  (function dfs(i, tiles, value) {
    if (++nodes > limit) return;
    if ((!needOpen || value >= OPEN_POINTS) && (tiles > best.tiles || (tiles === best.tiles && value > best.value))) {
      best = { tiles, value, sets: chosen.slice() };
    }
    if (tiles + (total - tiles) <= best.tiles && (!needOpen || best.value >= OPEN_POINTS)) return;
    for (let k = i; k < info.length; k++) {
      const c = info[k];
      if (!fits(c.keys)) continue;
      take(c.keys, 1); chosen.push(c);
      dfs(k, tiles + c.keys.length, value + c.value);
      chosen.pop(); take(c.keys, -1);
      if (nodes > limit) return;
    }
  })(0, 0, 0);
  return best;
}

// Turn chosen key lists back into real tile ids taken from the rack.
function realize(sets, rack) {
  const pool = new Map();
  for (const id of rack) { const k = keyOf(id); if (!pool.has(k)) pool.set(k, []); pool.get(k).push(id); }
  const out = sets.map(s => s.keys.map(k => pool.get(k).pop()));
  const used = new Set(out.flat());
  return { sets: out, rest: rack.filter(id => !used.has(id)) };
}

// Add single rack tiles onto the ends of runs or into groups already on the table.
function addOn(table, rack) {
  let changed = true, any = false;
  while (changed) {
    changed = false;
    for (const id of [...rack].sort((a, b) => tile(a).j - tile(b).j)) {
      for (const s of table) {
        if (analyze([...s, id]).ok) { s.push(id); rack.splice(rack.indexOf(id), 1); changed = any = true; break; }
      }
    }
  }
  return any;
}

// Split a run in two and put a rack tile into one half (the MJ).
function splitIn(table, rack) {
  for (const id of rack) {
    if (tile(id).j) continue;
    for (let si = 0; si < table.length; si++) {
      const a = analyze(table[si]);
      if (!a.ok || a.kind !== 'run') continue;
      const order = a.order;
      for (let k = 1; k < order.length; k++) {
        const L = order.slice(0, k), R = order.slice(k);
        for (const [x, y] of [[[...L, id], R], [L, [id, ...R]]]) {
          if (analyze(x).ok && analyze(y).ok) {
            table.splice(si, 1, x, y);
            rack.splice(rack.indexOf(id), 1);
            return true;
          }
        }
      }
    }
  }
  return false;
}

// Tiles that can be taken off the table while what stays behind is still valid.
function donors(table) {
  const out = [];
  table.forEach((s, si) => {
    const a = analyze(s);
    s.forEach(id => {
      const rest = s.filter(x => x !== id);
      if (analyze(rest).ok) out.push({ id, si, leave: [rest] });
    });
    if (a.ok && a.kind === 'run') {
      for (let k = 3; k <= a.order.length - 4; k++) {
        const L = a.order.slice(0, k), R = a.order.slice(k + 1);
        if (analyze(L).ok && analyze(R).ok) out.push({ id: a.order[k], si, leave: [L, R] });
      }
    }
  });
  return out;
}

// Borrow one or two tiles from the table to make a new set with tiles from the rack.
function borrow(table, rack) {
  const ds = donors(table);
  const tryWith = picks => {
    const ids = [...rack, ...picks.map(d => d.id)];
    const cands = candidateSets(ids, true);
    const pickKeys = picks.map(d => keyOf(d.id));
    for (const keys of cands.sort((a, b) => b.length - a.length)) {
      const left = keys.slice();
      if (!pickKeys.every(k => { const i = left.indexOf(k); if (i < 0) return false; left.splice(i, 1); return true; })) continue;
      if (left.length < 2) continue;
      // the rest of the keys must come from the rack
      const pool = countsOf(rack);
      if (!left.every(k => { const n = pool.get(k) || 0; if (!n) return false; pool.set(k, n - 1); return true; })) continue;
      const fromRack = [];
      const rk = [...rack];
      for (const k of left) { const i = rk.findIndex(x => keyOf(x) === k); fromRack.push(rk.splice(i, 1)[0]); }
      const newSet = [...picks.map(d => d.id), ...fromRack];
      if (!analyze(newSet).ok) continue;
      // rebuild the table: donor sets replaced by what they leave behind
      const bySet = new Map(picks.map(d => [d.si, d]));
      const next = [];
      table.forEach((s, si) => { const d = bySet.get(si); if (d) next.push(...d.leave); else next.push(s); });
      next.push(newSet);
      table.length = 0; table.push(...next);
      for (const x of fromRack) rack.splice(rack.indexOf(x), 1);
      return true;
    }
    return false;
  };
  for (const d of ds) if (tryWith([d])) return true;
  for (let i = 0; i < ds.length; i++) for (let j = i + 1; j < ds.length; j++) {
    if (ds[i].si === ds[j].si) continue;
    if (tryWith([ds[i], ds[j]])) return true;
  }
  return false;
}

export function aiTurn(level, startTable, startRack, opened) {
  const table = startTable.map(s => s.slice());
  let rack = startRack.slice();
  const easy = level === 'easy', hard = level === 'hard';

  if (easy && opened && Math.random() < 0.22) return null;   // easy players sometimes just draw

  const pack = bestPacking(rack, !easy, !opened, hard ? 60000 : 25000);
  let sets = pack.sets;
  if (easy && sets.length && Math.random() < 0.5) {
    // one set at a time, unless more are needed to reach 30 on the first play
    const keep = [];
    let pts = 0;
    for (const s of sets) { keep.push(s); pts += s.value; if (opened || pts >= OPEN_POINTS) break; }
    sets = keep;
  }
  if (!opened && pack.value < OPEN_POINTS) return null;
  const made = realize(sets, rack);
  table.push(...made.sets);
  rack = made.rest;

  // Only after the first play may a player touch what is already on the table.
  if (opened && (!easy || Math.random() < 0.35)) {
    for (let round = 0; round < 12; round++) {
      let moved = addOn(table, rack);
      if (hard && rack.length) moved = splitIn(table, rack) || borrow(table, rack) || moved;
      if (!moved) break;
    }
  }
  if (rack.length === startRack.length) return null;
  return { table, rack };
}
