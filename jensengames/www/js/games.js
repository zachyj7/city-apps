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
};

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

// Player colors: everyone at the table has their own.
export const COLORS = ['yellow', 'red', 'blue', 'green', 'pink', 'purple', 'black', 'white'];

// Wins are counted per game: p.w = { tiles: 2, bj: 1, ... }
export const winsOf = (p, g) => (p && p.w && p.w[g]) || 0;
