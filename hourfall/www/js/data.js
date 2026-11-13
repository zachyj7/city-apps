/* Game data: items, skills, enemies, shops. */

export const RARITY = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
export const RCOL = ['#c9c9d4', '#6fe08a', '#6aa8ff', '#c08aff', '#ffb84a'];

/* r = rarity. Weapons: zone = strike-zone width, crit = size of the bright centre, critDmg = centre multiplier.
   Legendary items carry a flag that changes how the ring itself behaves (see combat.js). */
export const ITEMS = {
  w_needle: { name: "Apprentice's Needle", type: 'weapon', icon: '🗡️', r: 0, atk: 6, price: 20, desc: 'A long brass clock hand, sharpened on the workshop step. Yours since you were ten.' },
  w_iron: { name: 'Iron Hour-Hand', type: 'weapon', icon: '🗡️', r: 0, atk: 11, price: 120, desc: 'Heavy, honest and straight. Pulled from a tower clock that no longer needs it.' },
  w_harvest: { name: 'Harvest Scythe', type: 'weapon', icon: '🌾', r: 1, atk: 14, zone: 1.15, price: 260, desc: 'Taken from the Fallow King. Its long sweep makes every strike zone wider.' },
  w_tide: { name: 'Tidecutter', type: 'weapon', icon: '🗡️', r: 1, atk: 17, price: 420, desc: 'A Saltcrest cutlass, kept sharp on wet sandstone.' },
  w_claw: { name: "Breaker's Claw", type: 'weapon', icon: '🦀', r: 2, atk: 20, riposte: 2, price: 600, desc: 'Old Breaker\'s pincer on a haft. Ripostes hit twice as hard.' },
  w_twin: { name: 'Twin Ticks', type: 'weapon', icon: '⚔️', r: 2, atk: 16, twin: true, price: 640, desc: 'A pair of quick blades. Two strike zones ride the ring at once.' },
  w_antler: { name: 'Antler Glaive', type: 'weapon', icon: '🦌', r: 2, atk: 24, crit: 1.7, price: 800, desc: 'Cut from the King of the Hollow. The bright centre of every strike zone is far wider.' },
  w_scim: { name: 'Mirage Scimitar', type: 'weapon', icon: '🗡️', r: 1, atk: 29, price: 1100, desc: 'Curved like a dune. Sold with a wink in the Mirage bazaar.' },
  w_glass: { name: 'Glassedge', type: 'weapon', icon: '🔪', r: 3, atk: 32, critDmg: 2.5, price: 1500, desc: 'A sliver of the Hourglass. Centre hits cut far deeper than any other blade.' },
  w_hammer: { name: 'Bellhammer', type: 'weapon', icon: '🔨', r: 2, atk: 50, zone: 0.62, price: 1600, desc: 'Rings like a struck bell. Enormous blows, but a narrow strike zone.' },
  w_pick: { name: 'Cragbreaker', type: 'weapon', icon: '⛏️', r: 3, atk: 40, pierce: true, price: 2000, desc: 'The Cliffwarden\'s own fist, re-hafted. Ignores armour completely.' },
  w_frost: { name: 'Rimebrand', type: 'weapon', icon: '❄️', r: 3, atk: 48, chill: true, price: 2600, desc: 'Cold enough to slow a moment. Centre hits briefly slow the dot.' },
  w_gale: { name: 'Galespear', type: 'weapon', icon: '🪶', r: 3, atk: 54, crit: 1.3, focusHit: 1.6, price: 3200, desc: 'A feather of the Stormcrown. Every hit builds far more Focus.' },
  w_tidecall: { name: 'Tidecaller', type: 'weapon', icon: '🔱', r: 4, atk: 60, splash: 0.5, price: 0, desc: 'LEGENDARY. Every strike breaks like a wave over all your enemies at once.' },
  w_cinder: { name: 'Cinderbrand', type: 'weapon', icon: '🔥', r: 4, atk: 68, burnCrit: true, price: 0, desc: 'LEGENDARY. Centre hits set the enemy burning, and burning enemies take double damage from strikes.' },
  w_second: { name: 'The Second Hand', type: 'weapon', icon: '⏱️', r: 4, atk: 42, noFlip: true, ramp: 0.07, price: 0, desc: 'LEGENDARY. The dot never turns back. Every hit in a row strikes harder, without limit, until you miss.' },
  w_dawn: { name: 'Dawnhand', type: 'weapon', icon: '🌅', r: 4, atk: 62, zone: 1.25, fourth: true, price: 0, desc: 'LEGENDARY. Forged from loose minutes. Every fourth strike is a guaranteed centre hit.' },
  a_wool: { name: 'Wool Cloak', type: 'armor', icon: '🧥', r: 0, def: 2, hp: 10, price: 60, desc: "Tobin's spare. Smells of sheep. Warm anyway." },
  a_warden: { name: "Warden's Coat", type: 'armor', icon: '🧥', r: 1, def: 4, hp: 25, price: 220, desc: 'Stiff leather with brass buttons shaped like tiny gears.' },
  a_shell: { name: 'Shellmail', type: 'armor', icon: '🐚', r: 1, def: 6, hp: 40, price: 520, desc: 'Saltcrest armour, stitched from tide-polished shell.' },
  a_bark: { name: 'Barkmail', type: 'armor', icon: '🛡️', r: 2, def: 8, hp: 55, price: 800, desc: 'Plates of stilled bark. It stopped growing mid-ring, and will not break.' },
  a_glass: { name: 'Glassweave', type: 'armor', icon: '🛡️', r: 2, def: 11, hp: 75, price: 1300, desc: 'Caravan work: thread spun from the Wastes themselves.' },
  a_crag: { name: 'Cragplate', type: 'armor', icon: '🛡️', r: 2, def: 14, hp: 95, price: 1900, desc: 'Highcrag steel, heavy as a promise.' },
  a_rime: { name: 'Rimeplate', type: 'armor', icon: '🛡️', r: 3, def: 17, hp: 125, price: 2600, desc: 'Hearthhold armour, frozen the same shape for three hundred years.' },
  a_feather: { name: 'Featherfall Cloak', type: 'armor', icon: '🪽', r: 4, def: 15, hp: 110, veil: true, price: 0, desc: 'LEGENDARY. The first blow to land in every fight simply misses you.' },
  a_pearl: { name: 'Pearlscale', type: 'armor', icon: '🦪', r: 3, def: 20, hp: 150, price: 0, desc: 'Scale armour of the Drowned Reach. Light as water.' },
  a_magma: { name: 'Magma Core', type: 'armor', icon: '🌋', r: 4, def: 22, hp: 170, thorns: true, price: 0, desc: 'LEGENDARY. Anything that strikes you catches fire.' },
  t_bezel: { name: 'Brass Bezel', type: 'trinket', icon: '⭕', r: 1, guard: 1.3, price: 180, desc: 'Parry zones are 30% wider.' },
  t_lucky: { name: 'Lucky Escapement', type: 'trinket', icon: '🍀', r: 1, coin: 1.4, price: 200, desc: 'Enemies drop 40% more coin.' },
  t_spring: { name: 'Quicksilver Spring', type: 'trinket', icon: '🌀', r: 2, focus: 1.5, price: 600, desc: 'Focus builds 50% faster.' },
  t_heart: { name: 'Heartstone', type: 'trinket', icon: '❤️', r: 2, hp: 60, price: 600, desc: '+60 health. Warm to the touch, and ticking.' },
  t_pendulum: { name: 'Slow Pendulum', type: 'trinket', icon: '🕰️', r: 2, slow: 0.87, price: 600, desc: 'The dot moves 13% slower in every fight.' },
  t_dice: { name: "Gambler's Dice", type: 'trinket', icon: '🎲', r: 4, dice: true, price: 0, desc: 'LEGENDARY. Every blow you land rolls the dice: anywhere from half damage to three times.' },
  t_frost: { name: 'Frostheart', type: 'trinket', icon: '💙', r: 4, freeze: true, price: 0, desc: 'LEGENDARY. A perfect parry freezes the attacker solid for three seconds.' },
  t_crown: { name: 'Crown of Hours', type: 'trinket', icon: '👑', r: 4, startFocus: true, price: 0, desc: 'LEGENDARY. You begin every fight with Focus already full.' },
  g_mend: { name: 'Glyph of Mending', type: 'glyph', icon: '✚', r: 1, color: '#6fe08a', cd: 13, price: 240, desc: 'Adds a green zone. Hit it to heal a fifth of your health.' },
  g_ember: { name: 'Glyph of Embers', type: 'glyph', icon: '🔥', r: 1, color: '#ff9a3c', cd: 9, price: 240, desc: 'Adds an orange zone. Hit it for a heavy blow that leaves the enemy burning.' },
  g_frost: { name: 'Glyph of Rime', type: 'glyph', icon: '❄', r: 2, color: '#8fd0ff', cd: 14, price: 700, desc: 'Adds a pale blue zone. Hit it to slow the dot for six seconds.' },
  g_storm: { name: 'Glyph of Storms', type: 'glyph', icon: '⚡', r: 2, color: '#f4e04d', cd: 10, price: 700, desc: 'Adds a yellow zone. Hit it to strike every enemy at once.' },
  g_thief: { name: 'Glyph of Magpies', type: 'glyph', icon: '◆', r: 1, color: '#e08fe0', cd: 11, price: 500, desc: 'Adds a violet zone. Hit it to strike and shake coins loose.' },
  g_quake: { name: 'Glyph of Quakes', type: 'glyph', icon: '⛰', r: 3, color: '#c8a070', cd: 16, price: 1800, desc: 'Adds a brown zone. Hit it to stun every enemy for three seconds.' },
  g_gale: { name: 'Glyph of Gales', type: 'glyph', icon: '🌪', r: 3, color: '#bff4ff', cd: 14, price: 1800, desc: 'Adds a sky-blue zone. Hit it to gain a third of your Focus at once.' },
  g_echo: { name: 'Glyph of Echoes', type: 'glyph', icon: '≋', r: 3, color: '#ffffff', cd: 15, price: 0, desc: 'Adds a white zone. Hit it and your next three strikes land twice.' },
  x_hook: { name: 'Grapnel Hand', type: 'gadget', icon: '🪝', r: 1, cd: 12, price: 380, desc: 'GADGET. Yanks the dot straight onto a strike zone and lands a perfect hit.' },
  x_bellows: { name: 'Brass Bellows', type: 'gadget', icon: '💨', r: 1, cd: 18, price: 380, desc: 'GADGET. Pumps a third of your Focus bar in one squeeze.' },
  x_watch: { name: 'Stopwatch', type: 'gadget', icon: '⏱', r: 2, cd: 22, price: 900, desc: 'GADGET. Stops every enemy mid-swing for four seconds.' },
  x_bomb: { name: 'Clockwork Bomb', type: 'gadget', icon: '💣', r: 2, cd: 20, price: 900, desc: 'GADGET. A heavy blast on every enemy that cracks one layer of armour.' },
  x_lens: { name: 'Mirror Lens', type: 'gadget', icon: '🔮', r: 3, cd: 20, price: 2200, desc: 'GADGET. The next enemy attack is turned back as a riposte, whatever you do.' },
  r_boots: { name: 'Windstride Boots', type: 'relic', icon: '👢', r: 3, price: 1500, desc: 'RELIC, always active. You run 45% faster across the world.' },
  r_compass: { name: 'Minute Compass', type: 'relic', icon: '🧭', r: 3, price: 0, desc: 'RELIC, always active. Chests and Lost Minutes near you appear on the minimap.' },
  r_tide: { name: 'Tidecharm', type: 'relic', icon: '🫧', r: 3, price: 0, desc: 'RELIC, always active. You can breathe water, and walk the sea floor as if it were a road.' },
  r_horn: { name: 'Storm Horn', type: 'key', icon: '📯', r: 2, desc: 'A lighthouse horn. Old Breaker comes when it is blown.' },
  tonic: { name: 'Tonic', type: 'use', icon: '🧪', r: 0, heal: 45, price: 25, desc: 'Restores 45 health. Tastes of mint and pennies.' },
  tonic2: { name: 'Strong Tonic', type: 'use', icon: '⚗️', r: 1, heal: 120, price: 70, desc: 'Restores 120 health.' },
  tonic3: { name: 'Grand Tonic', type: 'use', icon: '🍶', r: 2, heal: 320, price: 180, desc: 'Restores 320 health.' },
  elixir: { name: 'Sunpetal Elixir', type: 'use', icon: '🌼', r: 2, heal: 9999, price: 320, desc: 'Restores all health.' },
  draught: { name: 'Focus Draught', type: 'use', icon: '🫧', r: 1, focus: 100, price: 60, desc: 'Fills your Focus. Drink it before a hard fight.' },
  sunpetal: { name: 'Sunpetal', type: 'mat', icon: '🌼', r: 0, price: 8, desc: 'Still turned toward a sun that will not move.' },
  duskcap: { name: 'Duskcap', type: 'mat', icon: '🍄', r: 0, price: 10, desc: 'A mushroom that only opens at dusk. It has been open for nine days.' },
  frostbloom: { name: 'Frostbloom', type: 'mat', icon: '💠', r: 1, price: 14, desc: 'A flower of ice. It does not melt in the hand.' },
  ore: { name: 'Iron Ore', type: 'mat', icon: '🪨', r: 0, price: 14, desc: 'Good ore. The Hearthhold forge will take all you can carry.' },
  starmetal: { name: 'Starmetal', type: 'mat', icon: '🌠', r: 2, price: 60, desc: 'Fell from the Dial itself. Smiths go quiet when they see it.' },
  pelt: { name: 'Stilled Pelt', type: 'mat', icon: '🐺', r: 0, price: 12, desc: 'Grey fur, cold as slate.' },
  dust: { name: 'Moth Dust', type: 'mat', icon: '✨', r: 0, price: 16, desc: 'It hangs in the air when you let go of it.' },
  shardm: { name: 'Glass Shard', type: 'mat', icon: '🔹', r: 0, price: 22, desc: 'Sand, stopped halfway to being something else.' },
  core: { name: 'Frost Core', type: 'mat', icon: '🧊', r: 1, price: 40, desc: 'The slow heart of a golem.' },
  feather: { name: 'Storm Feather', type: 'mat', icon: '🪶', r: 1, price: 36, desc: 'Crackles faintly. Lighter than it has any right to be.' },
  pearl: { name: 'Reach Pearl', type: 'mat', icon: '⚪', r: 2, price: 50, desc: 'The currency of Pearlreach. Aquatic creatures carry them.' },
  ember: { name: 'Live Ember', type: 'mat', icon: '♨️', r: 1, price: 44, desc: 'Still burning. It has been burning for nine days.' },
  scrap: { name: 'Brass Scrap', type: 'mat', icon: '⚙️', r: 0, price: 9, desc: 'Gears and springs. Everything here was a clock once.' },
  locket: { name: "Pip's Locket", type: 'key', icon: '📿', r: 1, desc: 'A tin locket. Inside, a lock of hair and a pressed sunpetal.' },
  cargo: { name: 'Caravan Cargo', type: 'key', icon: '📦', r: 0, desc: 'A sealed crate stamped with the caravan sun.' },
  clapper: { name: 'Bell Clapper', type: 'key', icon: '🔔', r: 1, desc: 'A bronze clapper from a drowned bell.' },
};
export const COGS = ['vale', 'coast', 'jungle', 'desert', 'crag', 'frost', 'heath', 'reef', 'volcano'];
const COG_NAME = { vale: 'Seedtime', coast: 'Tides', jungle: 'Growth', desert: 'Noon', crag: 'Stone', frost: 'Midwinter', heath: 'Storms', reef: 'the Deep', volcano: 'Embers' };
for (const k of COGS) ITEMS['cog_' + k] = { name: 'Cog of ' + COG_NAME[k], type: 'key', icon: '⚙️', r: 4, desc: 'One of the nine wheels that carry the Spark. It hums when you face the castle.' };

/* Skills bought with skill points (one per level, more from Time Rifts). */
export const SKILLS = [
  { id: 'wide', name: 'Steady Hand', max: 3, desc: 'Strike zones are 8% wider per rank.' },
  { id: 'keen', name: 'Keen Eye', max: 3, desc: 'The bright centre of strike zones is 15% wider per rank.' },
  { id: 'finish', name: 'Finisher', max: 3, desc: 'Three centre hits in a row unleash a Finisher. Each rank adds 60% to its damage.' },
  { id: 'counter', name: 'Counterweight', max: 3, desc: 'After a parry your next strike deals 30% more per rank.' },
  { id: 'vital', name: 'Mainspring', max: 5, desc: '+25 health per rank.' },
  { id: 'flow', name: 'Deep Flow', max: 3, desc: 'Flow lasts one second longer per rank.' },
  { id: 'second', name: 'Second Wind', max: 3, desc: 'A riposte heals 3% of your health per rank.' },
  { id: 'forgive', name: 'Forgiving Ring', max: 2, desc: 'A missed tap locks the dot for a shorter time.' },
  { id: 'momentum', name: 'Momentum', max: 2, desc: 'The combo bonus keeps growing for 5 more hits per rank.' },
  { id: 'glyph3', name: 'Third Glyph', max: 1, cost: 3, desc: 'Unlocks a third glyph slot.' },
  { id: 'tinker', name: 'Tinkerer', max: 2, desc: 'Gadgets recharge 20% faster per rank.' },
  { id: 'scav', name: 'Scavenger', max: 2, desc: 'Enemies drop materials 25% more often per rank.' },
];

/* Enemy kinds. Stats scale with the level of wherever they are met. hp/atk are multipliers. */
const K = (name, hp, atk, tempo, pat, x = {}) => Object.assign({ name, hp, atk, tempo, pat }, x);
export const KINDS = {
  scarecrow: K('Stilled Scarecrow', 0.5, 0.5, -0.2, ['single'], { tutorial: true, still: true }),
  husk: K('Husk', 1, 1, 0, ['single'], { drops: [['scrap', 0.5], ['tonic', 0.12]] }),
  wolf: K('Stillwolf', 0.9, 1.1, 0.3, ['single', 'double'], { drops: [['pelt', 0.6]] }),
  boar: K('Tuskhusk', 1.3, 1.2, 0, ['heavy', 'single'], { drops: [['pelt', 0.5]] }),
  crow: K('Stillcrow', 0.7, 0.9, 0.5, ['drift', 'single'], { drops: [['scrap', 0.4]] }),
  bramble: K('Bramblet', 1.1, 0.9, -0.1, ['single', 'single', 'double'], { drops: [['sunpetal', 0.5]] }),
  shellback: K('Shellback', 1.4, 1, 0, ['double', 'heavy'], { armor: 1, drops: [['scrap', 0.4], ['tonic', 0.15]] }),
  gull: K('Gullwraith', 0.8, 1.1, 0.5, ['drift', 'feint'], { drops: [['dust', 0.4]] }),
  saltslime: K('Saltslime', 1.2, 0.9, 0, ['single', 'double'], { drops: [['tonic', 0.2]] }),
  moth: K('Mothwisp', 0.9, 1, 0.3, ['drift', 'single', 'drift'], { drops: [['dust', 0.6]] }),
  barkling: K('Barkling', 1.5, 1.2, -0.2, ['heavy', 'single'], { armor: 2, drops: [['duskcap', 0.5], ['scrap', 0.3]] }),
  vinecoil: K('Vinecoil', 1.1, 1.1, 0.2, ['double', 'feint'], { drops: [['duskcap', 0.5]] }),
  panther: K('Shadecat', 0.9, 1.3, 0.6, ['feint', 'double', 'flip'], { drops: [['pelt', 0.6]] }),
  shardback: K('Shardback', 1.4, 1.1, 0, ['double', 'feint', 'single'], { armor: 1, drops: [['shardm', 0.6]] }),
  dustwraith: K('Dust Wraith', 1, 1.2, 0.4, ['flip', 'single', 'feint'], { drops: [['shardm', 0.35], ['dust', 0.35]] }),
  glasshound: K('Glasshound', 1, 1.2, 0.5, ['double', 'drift'], { drops: [['shardm', 0.5]] }),
  cragram: K('Cragram', 1.3, 1.3, 0.1, ['heavy', 'double'], { drops: [['ore', 0.6]] }),
  stonewarden: K('Stone Sentinel', 1.8, 1.2, -0.3, ['triple', 'heavy'], { armor: 3, drops: [['ore', 0.8], ['starmetal', 0.08]] }),
  harrier: K('Harrier', 0.8, 1.2, 0.6, ['drift', 'feint', 'flip'], { drops: [['feather', 0.3]] }),
  rimegolem: K('Rime Golem', 1.8, 1.2, -0.3, ['triple', 'heavy', 'double'], { armor: 3, drops: [['core', 0.6], ['tonic2', 0.18]] }),
  rimewraith: K('Rime Wraith', 1, 1.3, 0.5, ['feint', 'flip', 'drift', 'double'], { drops: [['frostbloom', 0.5], ['core', 0.25]] }),
  frostwolf: K('Frostwolf', 1, 1.2, 0.4, ['double', 'single', 'feint'], { drops: [['pelt', 0.6]] }),
  galewisp: K('Galewisp', 0.9, 1.2, 0.6, ['flip', 'drift', 'feint'], { drops: [['feather', 0.4]] }),
  stormhawk: K('Stormhawk', 1, 1.3, 0.6, ['double', 'drift', 'flip'], { drops: [['feather', 0.7]] }),
  cloudjelly: K('Cloudjelly', 1.3, 1.1, 0.1, ['triple', 'single'], { drops: [['starmetal', 0.12], ['tonic2', 0.2]] }),
  eel: K('Reach Eel', 1, 1.3, 0.5, ['feint', 'double', 'flip'], { drops: [['pearl', 0.5]] }),
  jelly: K('Lantern Jelly', 1.3, 1.1, 0, ['triple', 'drift'], { drops: [['pearl', 0.5]] }),
  angler: K('Deep Angler', 1.5, 1.4, 0.2, ['heavy', 'feint', 'double'], { drops: [['pearl', 0.7]] }),
  reefcrab: K('Reefclaw', 1.6, 1.2, 0, ['double', 'heavy', 'triple'], { armor: 2, drops: [['pearl', 0.6]] }),
  cinderling: K('Cinderling', 1.1, 1.2, 0.3, ['double', 'single', 'feint'], { drops: [['ember', 0.6]] }),
  magmagolem: K('Magma Golem', 2, 1.3, -0.2, ['triple', 'heavy', 'double'], { armor: 4, drops: [['ember', 0.7], ['starmetal', 0.15]] }),
  ashwraith: K('Ash Wraith', 1, 1.4, 0.6, ['flip', 'feint', 'drift', 'double'], { drops: [['ember', 0.4]] }),
  emberhound: K('Emberhound', 1.1, 1.3, 0.6, ['double', 'feint', 'flip'], { drops: [['ember', 0.5]] }),
  wave: K('The Big One', 4, 0, 0.4, [], { trial: true, still: true }),
  /* bosses */
  harvestking: K('The Fallow King', 8, 1.2, 0.2, ['single', 'double', 'heavy'], { boss: true, still: true, pat2: ['double', 'drift', 'heavy', 'triple'], drops: [['w_harvest', 1]] }),
  breaker: K('Old Breaker', 9, 1.2, 0.2, ['double', 'heavy', 'single'], { boss: true, still: true, armor: 2, pat2: ['triple', 'heavy', 'feint', 'double'], drops: [['w_claw', 1]] }),
  antlerking: K('The Antler King', 9, 1.25, 0.3, ['single', 'double', 'heavy'], { boss: true, still: true, pat2: ['double', 'drift', 'heavy', 'triple', 'feint'], drops: [['w_antler', 1]] }),
  hourglass: K('The Hourglass', 10, 1.25, 0.3, ['double', 'feint', 'heavy'], { boss: true, still: true, armor: 3, pat2: ['flip', 'triple', 'feint', 'double'], drops: [['w_glass', 1]] }),
  cliffwarden: K('The Cliffwarden', 10, 1.3, 0.2, ['heavy', 'triple', 'double'], { boss: true, still: true, armor: 4, pat2: ['triple', 'heavy', 'flip', 'heavy'], drops: [['w_pick', 1]] }),
  rimewarden: K('The Rimewarden', 11, 1.3, 0.3, ['triple', 'heavy', 'drift'], { boss: true, still: true, armor: 4, pat2: ['triple', 'flip', 'feint', 'heavy', 'double'], drops: [['w_frost', 1]] }),
  stormcrown: K('The Stormcrown', 10, 1.35, 0.6, ['drift', 'flip', 'double', 'feint'], { boss: true, still: true, pat2: ['flip', 'triple', 'feint', 'drift', 'flip'], drops: [['w_gale', 1]] }),
  drownedbell: K('The Drowned Bell', 11, 1.35, 0.3, ['triple', 'drift', 'heavy'], { boss: true, still: true, armor: 2, pat2: ['triple', 'feint', 'flip', 'triple'], drops: [['w_tidecall', 1]] }),
  cinderheart: K('The Cinder Heart', 12, 1.4, 0.4, ['heavy', 'triple', 'feint', 'double'], { boss: true, still: true, armor: 5, pat2: ['triple', 'flip', 'heavy', 'feint', 'triple'], drops: [['w_cinder', 1]] }),
  gravedial: K('The Gravedial', 5, 1.2, 0.5, ['double', 'feint', 'flip', 'heavy'], { boss: true, still: true, drops: [['t_spring', 1]] }),
  champion: K('Arena Champion', 4, 1.2, 0.4, ['double', 'feint', 'heavy', 'flip'], { boss: true, still: true }),
  oren: K('Oren, Keeper of the Dial', 16, 1.45, 0.5, ['double', 'feint', 'heavy', 'drift'], { boss: true, still: true, armor: 3, pat2: ['flip', 'triple', 'feint', 'double', 'heavy', 'flip'] }),
};
/* What roams each region. */
export const ROSTER = {
  vale: ['husk', 'wolf', 'bramble'], plains: ['husk', 'wolf', 'boar', 'crow'], coast: ['shellback', 'gull', 'saltslime'], jungle: ['moth', 'barkling', 'vinecoil', 'panther'],
  desert: ['shardback', 'dustwraith', 'glasshound'], crag: ['cragram', 'stonewarden', 'harrier'], frost: ['rimegolem', 'rimewraith', 'frostwolf'],
  heath: ['galewisp', 'stormhawk', 'cloudjelly'], reef: ['eel', 'jelly', 'angler', 'reefcrab'], volcano: ['cinderling', 'magmagolem', 'ashwraith', 'emberhound'],
};
export const BOSSES = [
  { id: 'scarecrow', kind: 'scarecrow', lvl: 1, town: 'dawnmere', ang: 135, rad: 62 },
  { id: 'harvestking', kind: 'harvestking', lvl: 5, town: 'a_vale', cog: 'vale' },
  { id: 'breaker', kind: 'breaker', lvl: 9, town: 'a_coast', cog: 'coast', need: 'horn_blown' },
  { id: 'antlerking', kind: 'antlerking', lvl: 13, town: 'a_jungle', cog: 'jungle', need: 'lure_set' },
  { id: 'hourglass', kind: 'hourglass', lvl: 17, town: 'a_desert', cog: 'desert', need: 'sunkey' },
  { id: 'cliffwarden', kind: 'cliffwarden', lvl: 21, town: 'a_crag', cog: 'crag', need: 'bells_rung' },
  { id: 'rimewarden', kind: 'rimewarden', lvl: 25, town: 'a_frost', cog: 'frost', need: 'beacons_lit' },
  { id: 'stormcrown', kind: 'stormcrown', lvl: 29, sky: 2, cog: 'heath', need: 'vanes_calmed' },
  { id: 'drownedbell', kind: 'drownedbell', lvl: 32, town: 'a_reef', cog: 'reef', need: 'clappers_in' },
  { id: 'cinderheart', kind: 'cinderheart', lvl: 36, town: 'a_volcano', cog: 'volcano', need: 'crucible_won' },
  { id: 'gravedial', kind: 'gravedial', lvl: 8, town: 'a_graves' },
];
export function foeStats(kind, lvl) {
  const k = KINDS[kind];
  return { hp: Math.round((70 + 34 * lvl) * k.hp), atk: (5 + 2.4 * lvl) * k.atk, tempo: Math.min(4.3, 2.2 + lvl * 0.045 + k.tempo * 0.6), xp: Math.round((10 + 8 * lvl) * (k.boss ? 9 : k.hp)), coins: Math.round((4 + lvl * 2.2) * (k.boss ? 14 : 1)) };
}

export const WAY_NAMES = { highmark: 'Highmark', dawnmere: 'Dawnmere', saltcrest: 'Saltcrest', canopy: 'Canopy', mirage: 'Mirage', highcrag: 'Highcrag', hearthhold: 'Hearthhold', aerie: 'The Aerie', pearlreach: 'Pearlreach', emberdeep: 'Emberdeep' };

export const SHOPS = {
  bram: ['tonic', 'tonic2', 'w_iron', 'a_warden', 'x_hook', 'draught'],
  market: ['tonic2', 'tonic3', 'draught', 'x_bellows', 'x_watch', 't_bezel', 't_lucky', 'g_thief', 'r_boots'],
  armory: ['w_twin', 'a_shell', 'a_bark', 'x_bomb', 't_spring', 't_heart', 't_pendulum'],
  surf: ['tonic2', 'w_tide', 'a_shell', 'g_mend', 'draught'],
  apoth: ['tonic2', 'tonic3', 'elixir', 'g_ember', 'draught'],
  bazaar: ['tonic3', 'elixir', 'w_scim', 'a_glass', 'g_storm', 'g_frost', 'x_lens'],
  crag: ['tonic3', 'a_crag', 'g_quake', 'x_bomb', 'w_hammer'],
  frost: ['tonic3', 'elixir', 'a_rime', 'g_frost', 'draught'],
  scribe: ['g_gale', 'g_quake', 'g_storm', 'elixir', 'x_lens'],
  ember: ['tonic3', 'elixir', 'draught', 'x_watch', 't_pendulum'],
  hamlet: ['tonic', 'tonic2', 'draught'],
};
/* Pearlreach trades in pearls, the casino in winnings. [item, cost] */
export const PEARL_SHOP = [['a_pearl', 12], ['tonic3', 1], ['g_echo', 10], ['starmetal', 2]];
export const PRIZES = [['t_dice', 6000], ['x_lens', 1800], ['elixir', 250]];

export const PAGES = [
  "The apprentice asks why the Dial needs a keeper if it has never once stopped. I told them: because never is a long time, and somebody ought to be watching. They laughed. Good. Let them laugh a while longer.",
  "A Pivot is only a small Dial. The dot runs, and the hand that holds it chooses the moment. That is all keeping time has ever been. Choosing the moment.",
  "Nine Cogs carry the Spark between them, one for each country under the Dial. Pull one and the hour limps. Pull all nine and the hour stops. I write this down so that I never do it.",
  "The scaffold on the Spire's crown is rotten. I have told the apprentice to stay off it. I have told them four times. They have their mother's ears.",
  "Things left in a stopped moment do not rest. They curdle. The old books call them the Stilled: a stag that cannot finish its leap, a soldier who cannot finish dying. Whatever comes, I must not stop the hour.",
  "It happened at dusk. The scaffold. I was thirty steps below. I heard the boards go, and I saw them in the air, and I had the nine Cog-keys on my belt, and I did not think. I did not think at all.",
  "The hour is stopped. The apprentice hangs a hand's width above the stones and will hang there as long as I hold the Spark. What I could carry of them I carried home to Dawnmere: a shadow with a ring in its hand. It walks. It talks. It thinks it woke up.",
  "I hid the Cogs in the nine countries, where I thought no one could follow. Then the beasts I had stilled rose up and stood guard over them, and I wept, because I had not asked them to.",
  "There are minutes loose on the continent. They shook free when the Spark stopped. Small bright things, spare time, belonging to no one. If someone gathered enough of them... No. I am an old man doing sums because he cannot bear the answer.",
  "If you are reading this, you have the ring, and you are coming up the Spire to start the clock. I will try to stop you. Forgive me. Then do not let me.",
];
export const HERB_COLOR = { sunpetal: 0xffd24a, duskcap: 0xb06ad9, frostbloom: 0x9fdcff };
export const xpNeed = lvl => 40 + 45 * lvl;
