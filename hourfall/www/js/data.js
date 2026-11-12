/* Game data: items, enemies, where things are hidden, and Oren's journal. */

export const ITEMS = {
  /* weapons. zone = strike zone width, crit = size of the bright centre, critDmg = centre-hit multiplier */
  w_needle: { name: "Apprentice's Needle", type: 'weapon', icon: '🗡️', atk: 6, price: 20, desc: 'A long brass clock hand, sharpened on the workshop step. Yours since you were ten.' },
  w_iron: { name: 'Iron Hour-Hand', type: 'weapon', icon: '🗡️', atk: 11, price: 120, desc: 'Heavy, honest, and straight. Pulled from a tower clock that no longer needs it.' },
  w_twin: { name: 'Twin Ticks', type: 'weapon', icon: '⚔️', atk: 9, twin: true, price: 260, desc: 'A pair of quick blades. Two strike zones ride the ring at once.' },
  w_antler: { name: 'Antler Glaive', type: 'weapon', icon: '🦌', atk: 17, crit: 1.7, price: 400, desc: 'Cut from the King of the Hollow. The bright centre of every strike zone is far wider.' },
  w_hammer: { name: 'Bellhammer', type: 'weapon', icon: '🔨', atk: 30, zone: 0.62, price: 520, desc: 'Rings like a struck bell. Enormous blows, but a narrow strike zone.' },
  w_glass: { name: 'Glassedge', type: 'weapon', icon: '🔪', atk: 23, critDmg: 2.5, price: 640, desc: 'A sliver of the Hourglass. Centre hits cut far deeper than any other blade.' },
  w_frost: { name: 'Rimebrand', type: 'weapon', icon: '❄️', atk: 28, chill: true, price: 800, desc: 'Cold enough to slow a moment. Centre hits briefly slow the dot.' },
  w_dawn: { name: 'Dawnhand', type: 'weapon', icon: '🌅', atk: 38, zone: 1.2, crit: 1.3, price: 0, desc: 'Forged from loose minutes. It strikes like the first second of morning.' },
  /* armour */
  a_wool: { name: 'Wool Cloak', type: 'armor', icon: '🧥', def: 2, hp: 10, price: 60, desc: "Tobin's spare. Smells of sheep. Warm anyway." },
  a_warden: { name: "Warden's Coat", type: 'armor', icon: '🧥', def: 4, hp: 25, price: 220, desc: 'Stiff leather with brass buttons shaped like tiny gears.' },
  a_bark: { name: 'Barkmail', type: 'armor', icon: '🛡️', def: 6, hp: 40, price: 380, desc: 'Plates of stilled bark. It stopped growing mid-ring, and will not break.' },
  a_glass: { name: 'Glassweave', type: 'armor', icon: '🛡️', def: 9, hp: 55, price: 520, desc: 'Caravan work: thread spun from the Flats themselves.' },
  a_rime: { name: 'Rimeplate', type: 'armor', icon: '🛡️', def: 12, hp: 80, price: 800, desc: 'Monastery armour, frozen the same shape for three hundred years.' },
  /* trinkets */
  t_bezel: { name: 'Brass Bezel', type: 'trinket', icon: '⭕', guard: 1.3, price: 180, desc: 'Parry zones are 30% wider.' },
  t_lucky: { name: 'Lucky Escapement', type: 'trinket', icon: '🍀', coin: 1.4, price: 200, desc: 'Enemies drop 40% more coin.' },
  t_spring: { name: 'Quicksilver Spring', type: 'trinket', icon: '🌀', focus: 1.5, price: 320, desc: 'Focus builds 50% faster.' },
  t_heart: { name: 'Heartstone', type: 'trinket', icon: '❤️', hp: 50, price: 320, desc: '+50 health. Warm to the touch, and ticking.' },
  t_pendulum: { name: 'Slow Pendulum', type: 'trinket', icon: '🕰️', slow: 0.87, price: 320, desc: 'The dot moves 13% slower in every fight.' },
  /* glyphs: each one adds its own coloured zone to the ring */
  g_mend: { name: 'Glyph of Mending', type: 'glyph', icon: '✚', color: '#6fe08a', cd: 13, price: 240, desc: 'Adds a green zone. Hit it to heal a fifth of your health.' },
  g_ember: { name: 'Glyph of Embers', type: 'glyph', icon: '🔥', color: '#ff9a3c', cd: 9, price: 240, desc: 'Adds an orange zone. Hit it for a heavy blow that leaves the enemy burning.' },
  g_frost: { name: 'Glyph of Rime', type: 'glyph', icon: '❄', color: '#8fd0ff', cd: 14, price: 300, desc: 'Adds a pale blue zone. Hit it to slow the dot for six seconds.' },
  g_storm: { name: 'Glyph of Storms', type: 'glyph', icon: '⚡', color: '#f4e04d', cd: 10, price: 300, desc: 'Adds a yellow zone. Hit it to strike every enemy at once.' },
  g_thief: { name: 'Glyph of Magpies', type: 'glyph', icon: '◆', color: '#e08fe0', cd: 11, price: 300, desc: 'Adds a violet zone. Hit it to strike and shake coins loose.' },
  g_echo: { name: 'Glyph of Echoes', type: 'glyph', icon: '≋', color: '#ffffff', cd: 15, price: 0, desc: 'Adds a white zone. Hit it and your next three strikes land twice.' },
  /* consumables */
  tonic: { name: 'Tonic', type: 'use', icon: '🧪', heal: 45, price: 25, desc: 'Restores 45 health. Tastes of mint and pennies.' },
  tonic2: { name: 'Strong Tonic', type: 'use', icon: '⚗️', heal: 120, price: 70, desc: 'Restores 120 health.' },
  elixir: { name: 'Sunpetal Elixir', type: 'use', icon: '🌼', heal: 9999, price: 160, desc: 'Restores all health.' },
  draught: { name: 'Focus Draught', type: 'use', icon: '🫧', focus: 100, price: 60, desc: 'Fills your Focus. Usable from the pack before a hard fight.' },
  /* gathered and dropped */
  sunpetal: { name: 'Sunpetal', type: 'mat', icon: '🌼', price: 8, desc: 'Still turned toward a sun that will not move.' },
  duskcap: { name: 'Duskcap', type: 'mat', icon: '🍄', price: 10, desc: 'A forest mushroom that only opens at dusk. It has been open for nine days.' },
  frostbloom: { name: 'Frostbloom', type: 'mat', icon: '💠', price: 14, desc: 'A flower of ice. It does not melt in the hand.' },
  pelt: { name: 'Stilled Pelt', type: 'mat', icon: '🐺', price: 12, desc: 'Grey fur, cold as slate.' },
  dust: { name: 'Moth Dust', type: 'mat', icon: '✨', price: 16, desc: 'It hangs in the air when you let go of it.' },
  shardm: { name: 'Glass Shard', type: 'mat', icon: '🔹', price: 22, desc: 'Sand, stopped halfway to being something else.' },
  core: { name: 'Frost Core', type: 'mat', icon: '🧊', price: 34, desc: 'The slow heart of a golem.' },
  scrap: { name: 'Brass Scrap', type: 'mat', icon: '⚙️', price: 9, desc: 'Gears and springs. Everything here was a clock once.' },
  /* key items */
  cog_dawn: { name: 'Cog of Dawn', type: 'key', icon: '🌄', desc: 'A wheel of pale gold. It hums when you face east.' },
  cog_noon: { name: 'Cog of Noon', type: 'key', icon: '☀️', desc: 'A wheel of white glass, warm as a windowsill.' },
  cog_dusk: { name: 'Cog of Dusk', type: 'key', icon: '🌆', desc: 'A wheel of dark iron. It is heavier than it should be.' },
  locket: { name: "Pip's Locket", type: 'key', icon: '📿', desc: 'A tin locket. Inside, a lock of hair and a pressed sunpetal.' },
  cargo: { name: 'Caravan Cargo', type: 'key', icon: '📦', desc: 'A sealed crate stamped with the caravan sun.' },
};

/* Enemies. tempo = dot speed (radians a second). every = seconds between attacks. */
export const ENEMIES = {
  scarecrow: { name: 'Stilled Scarecrow', hp: 56, atk: 4, tempo: 2.1, every: [5, 6], pat: ['single'], xp: 20, coins: [5, 5], drops: [], lvl: 1, tutorial: true, still: true },
  husk: { name: 'Husk', hp: 90, atk: 7, tempo: 2.3, every: [3.6, 5], pat: ['single'], xp: 14, coins: [3, 8], drops: [['scrap', 0.5], ['tonic', 0.12]], lvl: 1 },
  wolf: { name: 'Stillwolf', hp: 115, atk: 9, tempo: 2.7, every: [3, 4.4], pat: ['single', 'double'], xp: 20, coins: [4, 10], drops: [['pelt', 0.6]], lvl: 2 },
  moth: { name: 'Mothwisp', hp: 195, atk: 12, tempo: 3.0, every: [3, 4.2], pat: ['drift', 'single', 'drift'], xp: 32, coins: [8, 16], drops: [['dust', 0.6]], lvl: 4 },
  barkling: { name: 'Barkling', hp: 270, atk: 15, tempo: 2.5, every: [3.4, 4.6], pat: ['heavy', 'single'], armor: 2, xp: 42, coins: [10, 20], drops: [['duskcap', 0.4], ['scrap', 0.4], ['tonic', 0.15]], lvl: 5 },
  crab: { name: 'Shardback', hp: 390, atk: 19, tempo: 3.0, every: [2.9, 4], pat: ['double', 'feint', 'single'], xp: 58, coins: [14, 26], drops: [['shardm', 0.6], ['tonic2', 0.1]], lvl: 7 },
  wraith: { name: 'Dust Wraith', hp: 350, atk: 22, tempo: 3.4, every: [2.8, 3.8], pat: ['flip', 'single', 'feint'], xp: 64, coins: [16, 30], drops: [['shardm', 0.35], ['dust', 0.35]], lvl: 8 },
  golem: { name: 'Rime Golem', hp: 610, atk: 27, tempo: 2.7, every: [3, 4], pat: ['triple', 'heavy', 'double'], armor: 3, xp: 90, coins: [20, 40], drops: [['core', 0.6], ['tonic2', 0.18]], lvl: 10 },
  rimewraith: { name: 'Rime Wraith', hp: 520, atk: 30, tempo: 3.7, every: [2.5, 3.5], pat: ['feint', 'flip', 'drift', 'double'], xp: 96, coins: [22, 44], drops: [['frostbloom', 0.5], ['core', 0.25]], lvl: 11 },
  gravedial: { name: 'The Gravedial', hp: 650, atk: 20, tempo: 3.3, every: [2.4, 3.2], pat: ['double', 'feint', 'flip', 'heavy'], xp: 220, coins: [120, 120], drops: [['t_spring', 1]], lvl: 7, boss: true, still: true },
  antlerking: { name: 'The Antler King', hp: 850, atk: 17, tempo: 2.8, every: [2.8, 3.8], pat: ['single', 'double', 'heavy'], pat2: ['double', 'drift', 'heavy', 'triple'], xp: 260, coins: [150, 150], drops: [['w_antler', 1], ['cog_dawn', 1]], lvl: 6, boss: true, still: true },
  hourglass: { name: 'The Hourglass', hp: 1350, atk: 25, tempo: 3.1, every: [2.6, 3.4], pat: ['double', 'feint', 'heavy'], pat2: ['flip', 'triple', 'feint', 'double'], armor: 3, xp: 460, coins: [260, 260], drops: [['w_glass', 1], ['cog_noon', 1]], lvl: 9, boss: true, still: true },
  rimewarden: { name: 'The Rimewarden', hp: 2050, atk: 33, tempo: 3.2, every: [2.4, 3.2], pat: ['triple', 'heavy', 'drift'], pat2: ['triple', 'flip', 'feint', 'heavy', 'double'], armor: 4, xp: 720, coins: [400, 400], drops: [['w_frost', 1], ['cog_dusk', 1]], lvl: 12, boss: true, still: true },
  oren: { name: 'Oren, Keeper of the Dial', hp: 3000, atk: 38, tempo: 3.5, every: [2.2, 3], pat: ['double', 'feint', 'heavy', 'drift'], pat2: ['flip', 'triple', 'feint', 'double', 'heavy'], xp: 1200, coins: [0, 0], drops: [], lvl: 14, boss: true, still: true },
};

/* How many of each creature roam each region. */
export const SPAWNS = [
  { kind: 'husk', biome: 'meadow', n: 9 }, { kind: 'wolf', biome: 'meadow', n: 8 },
  { kind: 'moth', biome: 'forest', n: 9 }, { kind: 'barkling', biome: 'forest', n: 7 }, { kind: 'wolf', biome: 'forest', n: 4 },
  { kind: 'crab', biome: 'flats', n: 9 }, { kind: 'wraith', biome: 'flats', n: 7 },
  { kind: 'golem', biome: 'frost', n: 8 }, { kind: 'rimewraith', biome: 'frost', n: 8 },
];
export const BOSSES = [
  { id: 'scarecrow', kind: 'scarecrow', x: 30, z: 166 },
  { id: 'gravedial', kind: 'gravedial', x: -62, z: 30 },
  { id: 'antlerking', kind: 'antlerking', x: -235, z: 40 },
  { id: 'hourglass', kind: 'hourglass', x: 240, z: 20 },
  { id: 'rimewarden', kind: 'rimewarden', x: -70, z: -255 },
];

export const WAYSTONES = [
  { id: 'dawnmere', name: 'Dawnmere', x: 9, z: 133 },
  { id: 'mere', name: 'Mirror Mere', x: 121, z: 62 },
  { id: 'fenncamp', name: "Fenn's Camp", x: -153, z: 118 },
  { id: 'caravan', name: 'The Caravan', x: 159, z: 128 },
  { id: 'spire', name: 'Spire Gate', x: 12, z: -12 },
  { id: 'monastery', name: 'Hollow Monastery', x: 65, z: -167 },
  { id: 'crownfoot', name: "Crown's Foot", x: -40, z: -208 },
];

/* Chests. `big` chests hold something special. */
export const CHESTS = [
  { id: 'c1', x: 13, z: 176, loot: { tonic: 2 }, coins: 15 },
  { id: 'c2', x: 75, z: 55, loot: { locket: 1 }, coins: 60, big: true },
  { id: 'c3', x: -96, z: 176, loot: { t_bezel: 1 }, coins: 20, big: true },
  { id: 'c4', x: 52, z: 208, loot: { tonic: 1, sunpetal: 2 }, coins: 25 },
  { id: 'c5', x: -52, z: 86, loot: { scrap: 3 }, coins: 30 },
  { id: 'c6', x: 44, z: 12, loot: { tonic: 2 }, coins: 35 },
  { id: 'c7', x: -24, z: -74, loot: { tonic2: 1, draught: 1 }, coins: 80 },
  { id: 'c8', x: -182, z: 168, loot: { tonic: 2, duskcap: 2 }, coins: 40 },
  { id: 'c9', x: -286, z: -36, loot: { a_bark: 1 }, coins: 50, big: true },
  { id: 'c10', x: -205, z: -52, loot: { tonic2: 1, dust: 3 }, coins: 60 },
  { id: 'c11', x: -262, z: 122, loot: { draught: 1 }, coins: 70 },
  { id: 'c12', x: -120, z: 20, loot: { tonic: 2 }, coins: 30 },
  { id: 'c13', x: 296, z: 92, loot: { g_storm: 1 }, coins: 60, big: true },
  { id: 'c14', x: 206, z: 196, loot: { tonic2: 2 }, coins: 90 },
  { id: 'c15', x: 286, z: -70, loot: { elixir: 1, shardm: 3 }, coins: 110 },
  { id: 'c16', x: 148, z: -44, loot: { tonic2: 1 }, coins: 70 },
  { id: 'c17', x: 172, z: -212, loot: { g_frost: 1 }, coins: 80, big: true },
  { id: 'c18', x: -172, z: -228, loot: { a_rime: 1 }, coins: 100, big: true },
  { id: 'c19', x: 6, z: -262, loot: { elixir: 1, core: 2 }, coins: 140 },
  { id: 'c20', x: -118, z: -150, loot: { tonic2: 2, frostbloom: 2 }, coins: 90 },
  { id: 'c21', x: 0, z: -78, loot: { elixir: 1, draught: 2 }, coins: 150 },
  { id: 'c22', x: 104, z: 262, loot: { draught: 2, elixir: 1 }, coins: 160, big: true },
];

/* Lost Minutes: spare time shaken loose when the Spark stopped. */
export const MINUTES = [
  [-6, 160], [38, 150], [-44, 190], [70, 100], [75, 62], [-20, 60], [-70, 28], [20, -8],
  [-160, 124], [-210, 100], [-250, 10], [-120, -40], [-270, -80], [-190, 200],
  [170, 104], [228, 60], [262, 150], [200, -30], [300, 20], [120, 190],
  [70, -190], [-20, -200], [-90, -262], [150, -170],
];

export const PAGES = [
  { x: -33, z: 174, t: "The apprentice asks why the Dial needs a keeper if it has never once stopped. I told them: because never is a long time, and somebody ought to be watching. They laughed. Good. Let them laugh a while longer." },
  { x: 34, z: 172, t: "A Pivot is only a small Dial. The dot runs, and the hand that holds it chooses the moment. That is all keeping time has ever been. Choosing the moment." },
  { x: 60, z: 96, t: "Three Cogs carry the Spark between them: Dawn in the wood, Noon under the glass, Dusk on the mountain. Pull one and the hour limps. Pull all three and the hour stops. I write this down so that I never do it." },
  { x: -140, z: 96, t: "The scaffold on the Spire's crown is rotten. I have told the apprentice to stay off it. I have told them four times. They have their mother's ears." },
  { x: -226, z: 62, t: "Things left in a stopped moment do not rest. They curdle. The old books call them the Stilled: a stag that cannot finish its leap, a soldier who cannot finish dying. Whatever comes, I must not stop the hour." },
  { x: 176, z: 132, t: "It happened at dusk. The scaffold. I was thirty steps below. I heard the boards go, and I saw them in the air, and I had the three Cog-keys in my coat, and I did not think. I did not think at all." },
  { x: 232, z: 2, t: "The hour is stopped. The apprentice hangs a hand's width above the stones and will hang there as long as I hold the Spark. What I could carry of them I carried down to the square: a shadow with a ring in its hand. It walks. It talks. It thinks it woke up." },
  { x: 54, z: -168, t: "I hid the Cogs where I thought no one could follow. Then the beasts I had stilled rose up and stood guard over them, and I wept, because I had not asked them to." },
  { x: -58, z: -244, t: "There are minutes loose on the island. They shook free when the Spark stopped. Small bright things, spare time, belonging to no one. If someone gathered enough of them... No. I am an old man doing sums because he cannot bear the answer." },
  { x: -14, z: -22, t: "If you are reading this, you have the ring, and you are coming up the Spire to start the clock. I will try to stop you. Forgive me. Then do not let me." },
];

export const HERBS = [
  ['sunpetal', 22, 104], ['sunpetal', -34, 112], ['sunpetal', 58, 150], ['sunpetal', -70, 150], ['sunpetal', 10, 70], ['sunpetal', 40, 190], ['sunpetal', -50, 60], ['sunpetal', 96, 120],
  ['duskcap', -130, 130], ['duskcap', -170, 80], ['duskcap', -200, 140], ['duskcap', -240, 90], ['duskcap', -160, 0], ['duskcap', -220, -20], ['duskcap', -130, 60],
  ['frostbloom', 40, -160], ['frostbloom', 90, -200], ['frostbloom', -30, -180], ['frostbloom', -100, -220], ['frostbloom', 130, -150], ['frostbloom', -150, -170],
];
export const HERB_COLOR = { sunpetal: 0xffd24a, duskcap: 0xb06ad9, frostbloom: 0x9fdcff };

export const BELLS = [{ id: 'b1', x: 128, z: -228 }, { id: 'b2', x: -6, z: -268 }, { id: 'b3', x: -160, z: -192 }];
export const CRATES = [{ id: 'k1', x: 202, z: 152 }, { id: 'k2', x: 268, z: -42 }, { id: 'k3', x: 142, z: 12 }];

export const SHOPS = {
  bram: ['tonic', 'tonic2', 'w_iron', 'a_warden', 'draught'],
  sef: ['tonic2', 'elixir', 'draught', 'g_thief', 'a_glass', 't_bezel'],
};

export const xpNeed = lvl => 40 + 45 * lvl;
