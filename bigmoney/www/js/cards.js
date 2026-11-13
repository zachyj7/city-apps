// Cards are integers 0..51: rank = c % 13 (0 is a two, 12 an ace), suit = floor(c / 13).
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const SUITS = ['♠', '♥', '♦', '♣'];
export const HAND_NAMES = ['High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush'];
const CAT = 13 ** 5;

export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function newDeck(decks = 1) {
  const d = [];
  for (let n = 0; n < decks; n++) for (let c = 0; c < 52; c++) d.push(c);
  return shuffle(d);
}

export function bjTotal(cards) {
  let t = 0, aces = 0;
  for (const c of cards) {
    const r = c % 13;
    if (r === 12) { t += 11; aces++; } else if (r >= 8) t += 10; else t += r + 2;
  }
  while (t > 21 && aces) { t -= 10; aces--; }
  return { t, soft: aces > 0 };
}

// Best poker hand from up to seven cards, as one number: higher wins, equal ties.
export function evalHand(cs) {
  const rc = new Array(13).fill(0), sc = [0, 0, 0, 0], sm = [0, 0, 0, 0];
  let mask = 0;
  for (const c of cs) { const r = c % 13, s = (c / 13) | 0; rc[r]++; sc[s]++; sm[s] |= 1 << r; mask |= 1 << r; }
  const straightHi = m => {
    for (let h = 12; h >= 4; h--) if (((m >> (h - 4)) & 31) === 31) return h;
    return (m & 0x100f) === 0x100f ? 3 : -1;
  };
  const pack = (cat, ks) => { let v = cat; for (let i = 0; i < 5; i++) v = v * 13 + (ks[i] || 0); return v; };
  const kick = (ex, n) => { const o = []; for (let r = 12; r >= 0 && o.length < n; r--) if (rc[r] && !ex.includes(r)) o.push(r); return o; };
  let fs = -1;
  for (let s = 0; s < 4; s++) if (sc[s] >= 5) fs = s;
  if (fs >= 0) { const h = straightHi(sm[fs]); if (h >= 0) return pack(8, [h]); }
  const g = [];
  for (let r = 12; r >= 0; r--) if (rc[r]) g.push([rc[r], r]);
  g.sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  if (!g.length) return 0;
  if (g[0][0] === 4) return pack(7, [g[0][1], ...kick([g[0][1]], 1)]);
  if (g[0][0] === 3 && g[1] && g[1][0] >= 2) return pack(6, [g[0][1], g[1][1]]);
  if (fs >= 0) { const o = []; for (let r = 12; r >= 0 && o.length < 5; r--) if ((sm[fs] >> r) & 1) o.push(r); return pack(5, o); }
  const sh = straightHi(mask);
  if (sh >= 0) return pack(4, [sh]);
  if (g[0][0] === 3) return pack(3, [g[0][1], ...kick([g[0][1]], 2)]);
  if (g[0][0] === 2 && g[1] && g[1][0] === 2) return pack(2, [g[0][1], g[1][1], ...kick([g[0][1], g[1][1]], 1)]);
  if (g[0][0] === 2) return pack(1, [g[0][1], ...kick([g[0][1]], 3)]);
  return pack(0, kick([], 5));
}

export const handCat = v => Math.floor(v / CAT);
export const handName = v => HAND_NAMES[handCat(v)];
