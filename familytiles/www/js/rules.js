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
    const inside = homes.some(t => t.some(id => {
      if (!played.has(id)) return false;
      const x = tile(id);
      return x.j || (x.n >= lo && x.n <= hi);
    }));
    if (inside) return true;
  }
  return false;
}
