// The games you can play in Jensen Games, and the settings the host can change for each.
// Shared by the referee (room.js) and the screens (main.js), so both agree on what is allowed.

export const GAMES = {
  tiles: {
    id: 'tiles', name: 'Number Tiles', blurb: 'Rummy with number tiles. Make runs and groups; first to play every tile wins.',
    min: 2, max: 8, icon: 'tiles',
    settings: [
      { key: 'sets', label: 'Tile sets', def: 'auto', options: [['auto', 'Auto'], ['1', 'One set'], ['2', 'Two sets']] },
    ],
  },
  bj: {
    id: 'bj', name: 'Blackjack', blurb: 'Beat the computer dealer to 21 with pretend money. Run out? Buy back in for free.',
    min: 1, max: 8, icon: 'cards',
    settings: [
      { key: 'chips', label: 'Starting money', def: 1000, options: [[500, '$500'], [1000, '$1,000'], [5000, '$5,000']] },
      { key: 'min', label: 'Smallest bet', def: 10, options: [[5, '$5'], [10, '$10'], [25, '$25'], [100, '$100']] },
      { key: 'decks', label: 'Decks in the shoe', def: 2, options: [[1, '1'], [2, '2'], [6, '6']] },
      { key: 's17', label: 'Dealer on soft 17', def: 'stand', options: [['stand', 'Stands'], ['hit', 'Hits']] },
      { key: 'pays', label: 'Blackjack pays', def: '3:2', options: [['3:2', '3 to 2'], ['6:5', '6 to 5']] },
    ],
  },
  uno: {
    id: 'uno', name: 'Color Clash', blurb: 'Match the color or the number and be first to empty your hand. +4s stack!',
    min: 2, max: 8, icon: 'colorcards',
    settings: [
      { key: 'hand', label: 'Cards to start', def: 7, options: [[5, '5'], [7, '7'], [10, '10']] },
      { key: 'stack2', label: '+2 on a +2', def: 'yes', options: [['yes', 'Allowed'], ['no', 'Not allowed']] },
      { key: 'draw', label: 'When you draw', def: 'one', options: [['one', 'Draw one'], ['until', 'Draw till you can play']] },
    ],
  },
  idiot: {
    id: 'idiot', name: 'Idiot', blurb: 'Play higher or pick up the pile. 2 resets, 10 burns. Don’t be the last one holding cards!',
    min: 2, max: 8, icon: 'cards', settings: [],
  },
  hearts: {
    id: 'hearts', name: 'Hearts', blurb: 'Dodge the hearts and the queen of spades. Lowest score wins.',
    min: 3, max: 4, icon: 'cards',
    settings: [
      { key: 'to', label: 'Game ends at', def: 100, options: [[50, '50 points'], [100, '100 points']] },
    ],
  },
  dominoes: {
    id: 'dominoes', name: 'Dominoes', blurb: 'Double-twelve trains: build yours toward you, share the community trains, cover your doubles. Lowest score wins.',
    min: 2, max: 8, icon: 'board',
    settings: [
      { key: 'rounds', label: 'Rounds', def: 13, options: [[13, 'All 13 (12 down to 0)'], [7, '7'], [3, '3'], [1, '1']] },
    ],
  },
  // The board games are for two. Everyone else in the lobby watches; the host's order picks who plays.
  chess: {
    id: 'chess', name: 'Chess', blurb: 'Checkmate the other king. Player 1 has white and moves first.',
    min: 2, max: 2, icon: 'board', settings: [],
  },
  checkers: {
    id: 'checkers', name: 'Checkers', blurb: 'Jump and take every piece. Reach the far side to get a king.',
    min: 2, max: 2, icon: 'board',
    settings: [
      { key: 'must', label: 'Must jump', def: 'yes', options: [['yes', 'Yes'], ['no', 'No']] },
    ],
  },
  mancala: {
    id: 'mancala', name: 'Mancala', blurb: 'Sow seeds around the board and fill your store. Most seeds wins.',
    min: 2, max: 2, icon: 'board',
    settings: [
      { key: 'seeds', label: 'Seeds per pit', def: 4, options: [[3, '3'], [4, '4'], [5, '5'], [6, '6']] },
    ],
  },
};
// Two-player board games: the rest of the lobby watches.
export const BOARD_GAMES = ['chess', 'checkers', 'mancala'];

export const GAME_IDS = Object.keys(GAMES);

// The host's choices for a game, with anything missing or not allowed set back to the default.
export function cfgFor(game, saved) {
  const g = GAMES[game], out = {};
  if (!g) return out;
  for (const st of g.settings) {
    const v = saved && saved[st.key];
    out[st.key] = st.options.some(o => o[0] === v) ? v : st.def;
  }
  return out;
}

// Player colors: everyone at the table has their own. Besides these, anyone can pick a custom color ('#rrggbb').
export const COLORS = ['yellow', 'red', 'blue', 'green', 'pink', 'purple', 'black', 'white'];
export const isHex = c => typeof c === 'string' && /^#[0-9a-f]{6}$/.test(c);
export const okColor = c => COLORS.includes(c) || isHex(c);

// The family: everyone picks their own name, and lifetime stats are kept under it (whatever name they play as).
export const PROFILES = ['Audrey', 'Gabe', 'Josh', 'Matt', 'Nina', 'Shiloh', 'Zach'];
// Lifetime records also cover rock paper scissors.
export const RPS_ID = 'rps';

// A lifetime record is one finished game: { id, at, g (game), ps (profiles who played), cpu (computers that
// played), win (a profile, 'cpu' or null), net (Blackjack: money up or down per profile) }.
export function cleanRec(r) {
  if (!r || typeof r !== 'object' || typeof r.id !== 'string' || r.id.length > 24 || !Number.isFinite(r.at)) return null;
  if (!GAMES[r.g] && r.g !== RPS_ID) return null;
  const ps = Array.isArray(r.ps) ? [...new Set(r.ps.filter(x => PROFILES.includes(x)))] : [];
  if (!ps.length) return null;
  const win = PROFILES.includes(r.win) || r.win === 'cpu' ? r.win : null;
  const out = { id: r.id, at: r.at, g: r.g, ps, cpu: Math.max(0, Math.min(8, Math.floor(+r.cpu) || 0)), win };
  if (r.net && typeof r.net === 'object') {
    out.net = {};
    for (const k of ps) if (Number.isFinite(r.net[k])) out.net[k] = Math.round(r.net[k]);
  }
  return out;
}

// Wins are counted per game: p.w = { tiles: 2, bj: 1, ... }
export const winsOf = (p, g) => (p && p.w && p.w[g]) || 0;
