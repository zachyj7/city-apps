// Save data, the shared game context, and the catalogues of things to buy.
const KEY = 'bigmoney.v1';
const fresh = () => ({
  name: '', money: 1000, sound: true,
  owned: { hair_short: 1, outfit_tux: 1 },
  look: { skin: 0, hairColor: 0, hair: 'hair_short', outfit: 'outfit_tux', hat: '', eye: '', neck: '', back: '' },
  fish: { up: {}, log: {}, caught: 0 },
  best: { range: 0 }, stats: { won: 0, spent: 0 }, pend: { bj: 0, pk: 0 }, daily: '',
});

function load() {
  let s = fresh();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw) s = { ...s, ...raw, look: { ...s.look, ...raw.look }, fish: { ...s.fish, ...raw.fish }, best: { ...s.best, ...raw.best }, stats: { ...s.stats, ...raw.stats }, pend: { ...s.pend, ...raw.pend } };
  } catch (e) { /* private mode or bad data: start fresh */ }
  return s;
}

export const S = load();
export function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }

// Everything the modules share. main.js fills it in.
export const G = {
  mode: 'title', layout: null, scene: null, camera: null, props: {}, players: new Map(), myId: null, me: null,
  pos: { x: 0, y: 0, z: 15, r: Math.PI }, cam: { yaw: 0, pitch: 0.32, dist: 6.5 }, anim: 0,
  seat: null, bj: {}, pk: {}, pkHole: {}, buffs: {}, buzz: 0, net: null, send: () => {}, onMoney: [],
};

export function addMoney(n, quiet) {
  n = Math.round(n);
  if (!n) return;
  S.money = Math.max(0, S.money + n);
  if (n > 0) S.stats.won += n; else S.stats.spent -= n;
  save();
  for (const f of G.onMoney) f(n, quiet);
}
export const buff = k => (G.buffs[k] || 0) > Date.now();

export const SKINS = ['#e8b98f', '#f3d2b3', '#c68a5c', '#9a6238', '#6b4226', '#f0c27a'];
export const HAIRS = ['#2a1a10', '#111114', '#8a5a2a', '#d9b060', '#b03a2a', '#e8e8ee', '#ff4fa3', '#3f7ae0'];

export const OUTFITS = [
  { id: 'outfit_tux', name: 'House Tux', price: 0, top: '#1d1d24', bottom: '#17171d', shoes: '#0c0c10', accent: '#f1efe9' },
  { id: 'outfit_tourist', name: 'Tourist', price: 150, top: '#2aa7a0', bottom: '#c9b27a', shoes: '#f1efe9', accent: '#ffd24a' },
  { id: 'outfit_hoodie', name: 'Grey Hoodie', price: 300, top: '#6a6f7a', bottom: '#2b3040', shoes: '#e9e9ee', accent: '#6a6f7a' },
  { id: 'outfit_angler', name: 'Angler Vest', price: 600, top: '#5f6b36', bottom: '#6a5a40', shoes: '#3a2a1a', accent: '#c9b27a' },
  { id: 'outfit_red', name: 'Red Velvet', price: 1500, top: '#9a1226', bottom: '#15151a', shoes: '#0c0c10', accent: '#15151a' },
  { id: 'outfit_white', name: 'White Suit', price: 4000, top: '#f1efe9', bottom: '#f1efe9', shoes: '#d9a93a', accent: '#ff4fa3' },
  { id: 'outfit_royal', name: 'Royal Purple', price: 9000, top: '#5b2aa8', bottom: '#2a1450', shoes: '#d9a93a', accent: '#d9a93a' },
  { id: 'outfit_neon', name: 'Neon Runner', price: 20000, top: '#15151a', bottom: '#15151a', shoes: '#3dff6a', accent: '#2fd8ff', glow: '#2fd8ff' },
  { id: 'outfit_gold', name: 'Solid Gold', price: 75000, top: '#d9a93a', bottom: '#b88a2a', shoes: '#f1efe9', accent: '#fff2c0', metal: 1 },
];
export const ITEMS = [
  { id: 'hair_short', slot: 'hair', name: 'Short Hair', price: 0 },
  { id: 'hair_long', slot: 'hair', name: 'Long Hair', price: 100 },
  { id: 'hair_mohawk', slot: 'hair', name: 'Neon Mohawk', price: 2500 },
  { id: 'hat_cap', slot: 'hat', name: 'Ball Cap', price: 200 },
  { id: 'hat_bucket', slot: 'hat', name: 'Bucket Hat', price: 400 },
  { id: 'hat_fedora', slot: 'hat', name: 'Fedora', price: 900 },
  { id: 'hat_cowboy', slot: 'hat', name: 'Cowboy Hat', price: 1800 },
  { id: 'hat_top', slot: 'hat', name: 'Top Hat', price: 5000 },
  { id: 'hat_halo', slot: 'hat', name: 'Halo', price: 15000 },
  { id: 'hat_crown', slot: 'hat', name: 'Crown', price: 50000 },
  { id: 'eye_shades', slot: 'eye', name: 'Shades', price: 350 },
  { id: 'eye_gold', slot: 'eye', name: 'Gold Rims', price: 2500 },
  { id: 'eye_visor', slot: 'eye', name: 'Laser Visor', price: 8000 },
  { id: 'neck_bowtie', slot: 'neck', name: 'Bow Tie', price: 250 },
  { id: 'neck_chain', slot: 'neck', name: 'Gold Chain', price: 3000 },
  { id: 'neck_ice', slot: 'neck', name: 'Iced Chain', price: 25000 },
  { id: 'back_cape', slot: 'back', name: 'Velvet Cape', price: 6000 },
  { id: 'back_wings', slot: 'back', name: 'Golden Wings', price: 40000 },
];
export const NPC_LOOKS = {
  dealer: { skin: 2, hairColor: 1, hair: 'hair_short', outfit: 'outfit_red', neck: 'neck_bowtie' },
  bartender: { skin: 1, hairColor: 2, hair: 'hair_long', outfit: 'outfit_tux', neck: 'neck_bowtie' },
  stylist: { skin: 3, hairColor: 6, hair: 'hair_mohawk', outfit: 'outfit_white', eye: 'eye_gold', neck: 'neck_chain' },
  cashier: { skin: 0, hairColor: 5, hair: 'hair_short', outfit: 'outfit_royal', eye: 'eye_shades' },
  angler: { skin: 5, hairColor: 5, hair: 'hair_short', outfit: 'outfit_angler', hat: 'hat_bucket' },
  model1: { skin: 4, hairColor: 1, hair: 'hair_short', outfit: 'outfit_gold', hat: 'hat_crown', neck: 'neck_ice', back: 'back_cape' },
  model2: { skin: 1, hairColor: 3, hair: 'hair_long', outfit: 'outfit_neon', eye: 'eye_visor', hat: 'hat_halo', back: 'back_wings' },
  model3: { skin: 2, hairColor: 0, hair: 'hair_short', outfit: 'outfit_tourist', hat: 'hat_cowboy', eye: 'eye_shades' },
};

// ---- fishing
export const UPGRADES = [
  // col, row place the node in the tree; req lists what must be owned first
  { id: 'rod1', col: 0, row: 0, name: 'Fiberglass Rod', price: 300, req: [], d: 'Uncommon fish bite more often.' },
  { id: 'rod2', col: 0, row: 1, name: 'Carbon Rod', price: 1500, req: ['rod1'], d: 'Rare fish start showing up.' },
  { id: 'rod3', col: 0, row: 2, name: 'Titanium Rod', price: 7500, req: ['rod2'], d: 'Epic fish are on the table.' },
  { id: 'rod4', col: 0, row: 3, name: 'High Roller Rod', price: 40000, req: ['rod3'], d: 'Legendary catches. Solid gold.' },
  { id: 'reel1', col: 1, row: 0, name: 'Smooth Reel', price: 250, req: [], d: 'Reel in 25% faster.' },
  { id: 'reel2', col: 1, row: 1, name: 'Baitcaster', price: 1200, req: ['reel1'], d: 'Reel in 50% faster.' },
  { id: 'reel3', col: 1, row: 2, name: 'Turbo Reel', price: 6000, req: ['reel2', 'rod2'], d: 'Reel in twice as fast.' },
  { id: 'line1', col: 2, row: 0, name: 'Braided Line', price: 200, req: [], d: 'Tension builds 20% slower.' },
  { id: 'line2', col: 2, row: 1, name: 'Fluorocarbon', price: 1000, req: ['line1'], d: 'Tension builds 35% slower.' },
  { id: 'line3', col: 2, row: 2, name: 'Steel Leader', price: 5000, req: ['line2', 'rod2'], d: 'Tension builds 50% slower.' },
  { id: 'bait1', col: 3, row: 0, name: 'Fat Worms', price: 150, req: [], d: 'Bites come 25% sooner.' },
  { id: 'bait2', col: 3, row: 1, name: 'Fresh Shrimp', price: 900, req: ['bait1'], d: 'Bites 45% sooner, better fish.' },
  { id: 'bait3', col: 3, row: 2, name: 'Glow Lure', price: 4500, req: ['bait2'], d: 'Much better odds on rare fish.' },
  { id: 'bait4', col: 3, row: 3, name: 'Caviar Bait', price: 25000, req: ['bait3', 'rod3'], d: 'The big ones can\'t resist.' },
  { id: 'hook1', col: 4, row: 0, name: 'Barbed Hook', price: 400, req: [], d: 'Longer to react to a bite.' },
  { id: 'hook2', col: 4, row: 1, name: 'Treble Hook', price: 2000, req: ['hook1'], d: 'Fish run away half as fast.' },
  { id: 'gear1', col: 5, row: 0, name: 'Tackle Box', price: 500, req: [], d: 'Fish sell for 15% more.' },
  { id: 'gear2', col: 5, row: 1, name: 'Fish Finder', price: 2500, req: ['gear1'], d: 'No more junk. Sell +30%.' },
  { id: 'gear3', col: 5, row: 2, name: 'Landing Net', price: 8000, req: ['gear2'], d: '1 in 5 catches is a double.' },
  { id: 'gear4', col: 5, row: 3, name: 'Trophy Case', price: 30000, req: ['gear3', 'rod3'], d: 'Fish sell for 60% more.' },
];
export const BRANCHES = ['Rod', 'Reel', 'Line', 'Bait', 'Hook', 'Gear'];
export const RARITY = { junk: '#8a8f98', common: '#d9dde4', uncommon: '#5fd97a', rare: '#55b6ff', epic: '#c58cff', legendary: '#ffc23a' };
export const FISH = [
  { id: 'boot', name: 'Old Boot', r: 'junk', v: 2, m: 'item_boot', c: '#5a4030', s: 0.5, len: 0.9 },
  { id: 'chips', name: 'Soggy Poker Chip', r: 'junk', v: 5, m: 'fish_c', c: '#b03a3a', s: 0.4, len: 0.4 },
  { id: 'bluegill', name: 'Bluegill', r: 'common', v: 15, m: 'fish_a', c: '#5f8fd0', s: 0.8, len: 0.7 },
  { id: 'perch', name: 'Perch', r: 'common', v: 18, m: 'fish_a', c: '#c9a83a', s: 0.9, len: 0.8 },
  { id: 'carp', name: 'Carp', r: 'common', v: 22, m: 'fish_a', c: '#a0764a', s: 1.0, len: 1.1 },
  { id: 'bass', name: 'Largemouth Bass', r: 'uncommon', v: 45, m: 'fish_a', c: '#4f8a4a', s: 1.2, len: 1.2 },
  { id: 'trout', name: 'Rainbow Trout', r: 'uncommon', v: 55, m: 'fish_b', c: '#e08aa0', s: 1.3, len: 1.1 },
  { id: 'catfish', name: 'Catfish', r: 'uncommon', v: 65, m: 'fish_b', c: '#5a5a66', s: 1.4, len: 1.4 },
  { id: 'puffer', name: 'Pufferfish', r: 'rare', v: 150, m: 'fish_c', c: '#e0c060', s: 1.5, len: 1.0 },
  { id: 'pike', name: 'Northern Pike', r: 'rare', v: 180, m: 'fish_b', c: '#6a8a3a', s: 1.7, len: 1.7 },
  { id: 'koi', name: 'Koi', r: 'rare', v: 220, m: 'fish_a', c: '#ff7a3a', s: 1.6, len: 1.2 },
  { id: 'sturgeon', name: 'Sturgeon', r: 'epic', v: 650, m: 'fish_b', c: '#3a4a5a', s: 2.1, len: 2.2 },
  { id: 'goldkoi', name: 'Golden Koi', r: 'epic', v: 950, m: 'fish_a', c: '#ffc23a', s: 2.2, len: 1.4, shiny: 1 },
  { id: 'chest', name: 'Sunken Jackpot', r: 'legendary', v: 2500, m: 'item_chest', c: '#7a4a28', s: 2.4, len: 1.6 },
  { id: 'shark', name: 'Card Shark', r: 'legendary', v: 4000, m: 'fish_d', c: '#7f8fa0', s: 2.8, len: 2.6 },
  { id: 'marlin', name: 'Lucky Sevens Marlin', r: 'legendary', v: 7777, m: 'fish_d', c: '#3a6ae0', s: 3.0, len: 3.0, shiny: 1 },
];
