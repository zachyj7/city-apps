/* The story: quests, the people of Meridian, what makes each city worth returning to, and the endings.
   Dialogue is plain async code: `await say(...)` shows lines, `await g.ui.choose(...)` asks. */
import { COGS, PAGES, ITEMS, PEARL_SHOP } from './data.js';
import { TOWN, REG } from './world.js';

const count = o => Object.keys(o).length;
export const cogCount = g => COGS.filter(k => g.has('cog_' + k)).length;
async function say(g, name, ...lines) { for (const l of lines) await g.ui.say(name, l); }
const P = (town, ang, rad) => { const t = TOWN[town], a = ang * Math.PI / 180; return [t.x + Math.sin(a) * rad, t.z - Math.cos(a) * rad]; };
const T = id => [TOWN[id].x, TOWN[id].z];
const ready = (g, id, step) => g.questActive(id) && g.S.quests[id].step === step;
const killed = (g, id) => g.flag('killed_' + id);

export const INTRO = [
  'Above the continent of Meridian hangs the Great Dial.',
  'For a thousand years its Spark has circled the sky, carrying morning and evening behind it to nine countries.',
  'Nine days ago, in the last minute of dusk, the Spark stopped.',
  'The sun has not set. Birds hang in the air where they were. And things that stood still too long have begun to get up again, hollow.',
  'You are apprentice to Oren, Keeper of the Dial. He climbed the Spire that night. He has not come down.',
  'You woke at home in Dawnmere with a ring in your fist: a Pivot, the only thing on the continent still keeping time.',
];

/* Things in the world that quests use: [id, kind, x, z, label]. */
export const SITES = [
  ['bell1', 'bell', -2260, -1480, 'Ring the watch-bell'], ['bell2', 'bell', -1900, -1960, 'Ring the watch-bell'], ['bell3', 'bell', -2520, -1640, 'Ring the watch-bell'],
  ['fire1', 'beacon', 240, -2500, 'Light the beacon'], ['fire2', 'beacon', -330, -2760, 'Light the beacon'], ['fire3', 'beacon', 130, -2940, 'Light the beacon'],
  ['crate1', 'crate', 2260, 760, 'Take the cargo'], ['crate2', 'crate', 2760, 620, 'Take the cargo'], ['crate3', 'crate', 2420, 180, 'Take the cargo'],
  ['wreck1', 'wreck', 1960, 2420, 'Search the wreck'], ['wreck2', 'wreck', 2240, 2160, 'Search the wreck'], ['wreck3', 'wreck', 2000, 2180, 'Search the wreck'],
];
const sitesDone = (g, p) => SITES.filter(s => s[0].startsWith(p) && g.S.opened[s[0]]).length;
const nextSite = (g, p) => { const s = SITES.find(s => s[0].startsWith(p) && !g.S.opened[s[0]]); return s ? [s[2], s[3]] : null; };

export const QUESTS = {
  main: {
    name: 'The Hour That Stayed', main: true,
    steps: [
      { t: 'Speak with Elder Maren in Dawnmere', done: g => g.flag('met_maren'), at: () => P('dawnmere', 200, 14) },
      { t: 'Wake the Pivot: fight the Stilled Scarecrow in the yard south-east of the village', done: g => killed(g, 'scarecrow'), at: () => P('dawnmere', 135, 62) },
      { t: "Read the note in Oren's old workshop, the house by the windmill", done: g => g.flag('read_note'), at: () => P('dawnmere', 330, 34) },
      { t: 'Follow the road north-east to the castle city of Highmark and find the Regent', done: g => g.flag('met_regent'), at: () => P('highmark', 0, 74) },
      { t: g => `Recover the nine Cogs from the nine countries (${cogCount(g)}/9)`, done: g => cogCount(g) >= 9, at: g => { const k = COGS.find(k => !g.has('cog_' + k)); return k ? [REG[k].x, REG[k].z] : null; } },
      { t: 'Carry the Cogs to the door of the Dial Spire in Highmark', done: g => g.flag('gate_open'), at: () => P('highmark', 0, 74) },
      { t: 'Face the Keeper of the Dial', done: g => killed(g, 'oren'), at: () => P('highmark', 0, 74) },
      { t: 'Choose the hour', done: g => g.flag('ended'), at: () => P('highmark', 0, 74) },
    ],
  },
  q_vale: { name: 'The Fallow King', steps: [
    { t: g => `Tobin's flock has turned. Put down Stillwolves near Dawnmere (${Math.min(3, g.killsSince('q_vale', 'wolf'))}/3)`, done: g => g.killsSince('q_vale', 'wolf') >= 3 },
    { t: 'Tell Tobin it is done', done: g => g.flag('vale_tobin'), at: () => P('dawnmere', 100, 20) },
    { t: g => `Bring Wren 3 Sunpetal for scarecrow-salt (${Math.min(3, g.has('sunpetal'))}/3). They grow in the fields.`, done: g => g.flag('vale_salt'), at: () => P('dawnmere', 250, 20) },
    { t: 'Go to the Fallow Field, north-east of Dawnmere, and face the Fallow King', done: g => killed(g, 'harvestking'), at: () => T('a_vale') },
  ], reward: { xp: 150, coins: 100, items: { a_wool: 1 } } },
  q_coast: { name: 'Old Breaker', steps: [
    { t: 'Find Harbourmaster Marisol in Saltcrest, on the south coast', done: g => g.flag('met_marisol'), at: () => P('saltcrest', 200, 14) },
    { t: 'The Storm Horn is with Old Tam in Reedhaven, far west along the shore', done: g => g.flag('met_tam'), at: () => P('reedhaven', 180, 8) },
    { t: g => `Clear the Gullwraiths from Tam's light (${Math.min(4, g.killsSince('q_coast', 'gull'))}/4)`, done: g => g.flag('coast_gulls') || g.killsSince('q_coast', 'gull') >= 4 },
    { t: 'Return to Old Tam for the horn', done: g => g.has('r_horn') > 0 || g.flag('horn_blown'), at: () => P('reedhaven', 180, 8) },
    { t: "Blow the horn at Breaker's Cove, east of Saltcrest", done: g => g.flag('horn_blown'), at: () => T('a_coast') },
    { t: 'Fight Old Breaker', done: g => killed(g, 'breaker'), at: () => T('a_coast') },
  ], reward: { xp: 400, coins: 250 } },
  q_jungle: { name: 'The King in the Hollow', steps: [
    { t: 'Find Elder Yara in Canopy, deep in the Verdance to the south-west', done: g => g.flag('met_yara'), at: () => P('canopy', 200, 14) },
    { t: 'Speak with Fenn the tracker in Canopy', done: g => g.flag('met_fenn'), at: () => P('canopy', 100, 20) },
    { t: g => `Gather Moth Dust from Mothwisps for the lure-lantern (${Math.min(3, g.has('dust'))}/3)`, done: g => g.flag('has_lure') || g.has('dust') >= 3 },
    { t: 'Have Ixa the apothecary make the lure-lantern', done: g => g.flag('has_lure'), at: () => P('canopy', 250, 20) },
    { t: 'Hang the lantern in Antler Hollow, south-west of Canopy', done: g => g.flag('lure_set'), at: () => T('a_jungle') },
    { t: 'Face the Antler King', done: g => killed(g, 'antlerking'), at: () => T('a_jungle') },
  ], reward: { xp: 700, coins: 400, items: { a_bark: 1 } } },
  q_desert: { name: 'The Hourglass', steps: [
    { t: 'Find Madame Sable at the Golden Mirage casino, far to the east', done: g => g.flag('met_sable'), at: () => P('mirage', 200, 16) },
    { t: 'Captain Isolde holds the sun-key. Find her in Dunewatch, south-west of Mirage', done: g => g.flag('met_isolde'), at: () => P('dunewatch', 180, 8) },
    { t: g => `Recover the caravan's cargo from the Wastes (${sitesDone(g, 'crate')}/3)`, done: g => g.flag('sunkey') || sitesDone(g, 'crate') >= 3, at: g => nextSite(g, 'crate') },
    { t: 'Return the cargo to Captain Isolde', done: g => g.flag('sunkey'), at: () => P('dunewatch', 180, 8) },
    { t: 'Open the Sunken Clock, north-east of Mirage, and face the Hourglass', done: g => killed(g, 'hourglass'), at: () => T('a_desert') },
  ], reward: { xp: 1100, coins: 700 } },
  q_crag: { name: 'The Cliffwarden', steps: [
    { t: 'Climb to Highcrag in the north-west and find Thane Brakka', done: g => g.flag('met_brakka'), at: () => P('highcrag', 200, 14) },
    { t: 'Brother Halvard in Coldwater knows the old bell-rite', done: g => g.flag('met_halvard'), at: () => P('coldwater', 180, 8) },
    { t: g => `Ring the three watch-bells of the Highcrags (${sitesDone(g, 'bell')}/3)`, done: g => sitesDone(g, 'bell') >= 3, at: g => nextSite(g, 'bell') },
    { t: "The Cliffwarden has woken on the Warden's Stair. Face it.", done: g => killed(g, 'cliffwarden'), at: () => T('a_crag') },
  ], reward: { xp: 1600, coins: 1000 } },
  q_frost: { name: 'The Rimewarden', steps: [
    { t: 'Find Chieftain Sigrun in Hearthhold, in the far north', done: g => g.flag('met_sigrun'), at: () => P('hearthhold', 200, 14) },
    { t: 'Old Ulf in Lanternfall can ward the beacons', done: g => g.flag('met_ulf'), at: () => P('lanternfall', 180, 8) },
    { t: g => `Bring Ulf 3 Frostbloom for the warding fire (${Math.min(3, g.has('frostbloom'))}/3)`, done: g => g.flag('frost_ward') },
    { t: g => `Light the three beacons around Hearthhold (${sitesDone(g, 'fire')}/3)`, done: g => sitesDone(g, 'fire') >= 3, at: g => nextSite(g, 'fire') },
    { t: "Face the Rimewarden at Warden's Crown", done: g => killed(g, 'rimewarden'), at: () => T('a_frost') },
  ], reward: { xp: 2200, coins: 1400 } },
  q_heath: { name: 'The Stormcrown', steps: [
    { t: 'Find Pim the liftkeeper in Galefoot, on the western heath', done: g => g.flag('met_pim'), at: () => P('galefoot', 180, 8) },
    { t: g => `The wind-lift needs Storm Feathers from Stormhawks (${Math.min(3, g.has('feather'))}/3)`, done: g => g.flag('lift_on') },
    { t: 'Ride the wind-lift north of Galefoot up to the Aerie and find Archivist Seraphine', done: g => g.flag('met_seraphine'), at: () => P('aerie', 200, 14) },
    { t: 'Cross the far bridge and face the Stormcrown', done: g => killed(g, 'stormcrown'), at: () => [-2960, 60] },
  ], reward: { xp: 2900, coins: 1800, items: { a_feather: 1 } } },
  q_reef: { name: 'The Drowned Bell', steps: [
    { t: 'Nerida the diver in Saltcrest knows the way under the sea', done: g => g.has('r_tide') > 0, at: () => P('saltcrest', 100, 20) },
    { t: 'Walk into the sea east of Saltcrest and find Queen Thalassa in Pearlreach', done: g => g.flag('met_thalassa'), at: () => P('pearlreach', 200, 14) },
    { t: g => `Recover the bell-clappers from the wrecks (${sitesDone(g, 'wreck')}/3)`, done: g => g.flag('clappers_in') || sitesDone(g, 'wreck') >= 3, at: g => nextSite(g, 'wreck') },
    { t: 'Bring the clappers to Queen Thalassa', done: g => g.flag('clappers_in'), at: () => P('pearlreach', 200, 14) },
    { t: 'Face the Drowned Bell in the Bell Deep', done: g => killed(g, 'drownedbell'), at: () => T('a_reef') },
  ], reward: { xp: 3400, coins: 2200 } },
  q_volcano: { name: 'The Cinder Heart', steps: [
    { t: 'Find Garrick the smith in Ashford, on the road to the volcano', done: g => g.flag('met_garrick'), at: () => P('ashford', 180, 8) },
    { t: g => `Garrick needs Frost Cores from Rime Golems to cool the canyon gate (${Math.min(2, g.has('core'))}/2)`, done: g => g.flag('gate_cooled') },
    { t: 'Take the canyon into the crater and find Forge-matron Vessa in Emberdeep', done: g => g.flag('met_vessa'), at: () => P('emberdeep', 200, 50) },
    { t: g => `Earn your passage: survive three rounds of the Crucible (best: ${g.S.crucible || 0})`, done: g => (g.S.crucible || 0) >= 3, at: () => P('emberdeep', 0, 60) },
    { t: 'Face the Cinder Heart on the Ash Throne, outside the crater', done: g => killed(g, 'cinderheart'), at: () => T('a_volcano') },
  ], reward: { xp: 4200, coins: 3000, items: { a_magma: 1 } } },
  locket: { name: 'The Locket in the Mill-pond', steps: [
    { t: 'Find the chest Pip buried by the pond in Millbrook, north-east of Dawnmere', done: g => g.flag('locket_in') || g.has('locket') > 0, at: () => P('millbrook', 300, 30) },
    { t: 'Return the locket to Pip in Dawnmere', done: g => g.flag('locket_in'), at: () => P('dawnmere', 30, 16) },
  ], reward: { xp: 90, items: { t_lucky: 1 } } },
  bounty: { name: 'Bounty: The Gravedial', steps: [
    { t: 'Put the Gravedial to rest in the Quiet Yard, north-west of Dawnmere', done: g => killed(g, 'gravedial'), at: () => T('a_graves') },
    { t: 'Collect the bounty from Bram', done: g => g.flag('bounty_in'), at: () => P('dawnmere', 60, 24) },
  ], reward: { xp: 220, coins: 300 } },
  minutes: { name: 'Loose Minutes', steps: [{ t: g => `Gather Lost Minutes and bring them to Tick in Dawnmere (${count(g.S.minutes)} of ${g.minuteTotal} found)`, done: g => g.flag('min60'), at: () => P('dawnmere', 320, 10) }], reward: { xp: 2000 } },
  pages: { name: "The Keeper's Journal", steps: [{ t: g => `Find the pages of Oren's journal in ruins across the continent (${count(g.S.pages)}/${PAGES.length})`, done: g => count(g.S.pages) >= PAGES.length }], reward: { xp: 1500, items: { g_echo: 1 } } },
  arena: { name: 'The Highmark Arena', steps: [{ t: g => `Rise through the arena ranks (${g.S.arena || 0}/5)`, done: g => (g.S.arena || 0) >= 5, at: () => P('highmark', 90, 62) }], reward: { xp: 3000, items: { w_second: 1 } } },
};

/* What ordinary people say, by country, before and after their Cog is recovered, and after the dawn. */
const AMB = {
  vale: [["They say the scarecrows walk the Fallow Field at dusk. It is always dusk.", "My hens haven't laid in nine days. Can't blame them.", "Oren was born here, you know. Quiet boy. Always winding things."], ["The Fallow Field is just a field again. I walked it this morning. Well. This dusk.", "You're Oren's apprentice! The whole Vale is talking."]],
  crown: [["Nine days of sunset. The lamplighters have stopped bothering.", "The Regent has guards on the Spire door day and... well. Day.", "Have you seen the arena? Folk fight there to feel like something still changes.", "I came for the market. I've stayed for the market. Nothing else moves.", "Look up. The Spark is right there. Stuck like a fly in amber."], ["The Spark moved! I saw it! A notch, I swear it.", "Is it true someone is bringing the Cogs home?", "The sky's a different colour than yesterday. First new thing in weeks."]],
  coast: [["Surf's been frozen mid-curl for nine days. Kai still paddles out. Says the one wave left is the best one.", "Old Breaker took two boats. We don't sail past the Cove.", "Tide's stuck halfway. Can't fish it, can't walk it."], ["The tide went out! Then it came back! I cried, honestly.", "With Breaker gone the boats are out again. Fish for supper."]],
  jungle: [["The canopy hasn't dripped in nine days. That is not a small thing here.", "Do not go to the Hollow. The stag there has been one leap from landing since it stopped.", "The moths stand in our fires. They do not burn. I do not sleep."], ["The Hollow is quiet. The King finally landed.", "Listen. Frogs. I had forgotten frogs."]],
  desert: [["The Mirage never closes. It couldn't if it wanted to. It's always evening.", "Sand turned to glass under the caravans. Mind your feet.", "Madame Sable takes any wager. I once saw her bet a man his own shadow."], ["The glass has stopped singing at night. Whatever you did out there, thank you.", "Luck's turning. You can feel it at the tables."]],
  crag: [["We rang the bells at dusk for six hundred years. Then dusk stayed.", "The cliff-road is closed. Something big stands on the Warden's Stair.", "Bounties are posted at the hall. Coin for claws."], ["The Stair is open. Trade's coming up the mountain again.", "I heard the bells. Three of them. I thought I'd dreamed it."]],
  frost: [["The cold doesn't deepen and it doesn't lift. It just waits.", "Bjarn's forge is the last warm thing in Frostspine.", "The founder's statue walked off its plinth. We do not speak of where it went."], ["The Rimewarden is stone again. The Chieftain wept. Do not tell her I said so.", "The beacons are lit. You can see home from the ice now."]],
  sky: [["The wind stopped. Do you understand what that means, for a city that sails on it?", "The Stormcrown circles the far isle. It was a weathervane once.", "From here you can see all nine countries. And the Dial, close enough to touch."], ["Wind! Real wind! Mind your hat!", "The vanes are turning. The Aerie is under way again."]],
  volcano: [["The mountain's been holding the same breath for nine days.", "The Crucible never cools. Vessa says fighting keeps the forges honest.", "Don't touch the lava. I shouldn't need to say it. I say it weekly."], ["The Heart's gone quiet. First time I've heard my own hammer in days.", "You fought the Cinder Heart? Sit. Drink. Tell it again."]],
  reef: [["The current stopped. Our gardens are starving for it.", "The great bell fell silent and something moved into it.", "A land-walker! How are you breathing? Never mind. Welcome."], ["The current is back. Feel it? Like the sea remembering us.", "The bell rings on the hour again. If there were hours."]],
};
const REG_BOSS = { vale: 'harvestking', coast: 'breaker', jungle: 'antlerking', desert: 'hourglass', crag: 'cliffwarden', frost: 'rimewarden', sky: 'stormcrown', reef: 'drownedbell', volcano: 'cinderheart' };
export function ambientLine(g, style, seed) {
  if (g.flag('ended') === 'caught') return ["Morning. Actual morning. I'd forgotten the colour of it.", "The sun went down, and then it came up. I stayed awake to watch.", "Whoever started the Dial again, I hope someone is buying them breakfast."][seed % 3];
  const after = style === 'crown' ? cogCount(g) > 0 : killed(g, REG_BOSS[style]), a = AMB[style][after ? 1 : 0];
  return a[seed % a.length];
}
/* How many townsfolk wander each kind of settlement. */
export const CROWD = { 3: 26, 2: 9, 1: 3 };

/* ---- shared services ---- */
async function forge(g, name) {
  const id = g.S.eq.weapon, n = g.S.up[id] || 0, it = ITEMS[id];
  if (n >= 5) return say(g, name, `Your ${it.name} is as fine as steel gets. Bring me a different blade.`);
  const ore = 3 + n * 2, star = n >= 3 ? n - 2 : 0, coin = 150 * (n + 1) * (1 + it.r);
  const c = await g.ui.choose(name, `I can temper your ${it.name} to +${n + 1}: 12% more attack. It will cost ${ore} Iron Ore${star ? ', ' + star + ' Starmetal' : ''} and ${coin} coin. You have ${g.has('ore')} ore${star ? ', ' + g.has('starmetal') + ' starmetal' : ''}.`, ['Temper it', 'Not now']);
  if (c) return;
  if (g.has('ore') < ore || g.has('starmetal') < star || g.S.coins < coin) return say(g, name, 'You are short. Ore comes from the grey outcrops in the hills; Starmetal from the strongest sentinels.');
  g.take('ore', ore); if (star) g.take('starmetal', star); g.S.coins -= coin; g.S.up[id] = n + 1; g.sfx.forge();
  return say(g, name, `There. ${it.name} +${n + 1}. Listen to it ring.`);
}
async function brew(g, name) {
  const c = await g.ui.choose(name, 'I brew from what you bring me.', ['2 Sunpetal → Tonic', '2 Duskcap → Strong Tonic', '2 Frostbloom → Grand Tonic', '3 Live Ember → Sunpetal Elixir', 'Never mind']);
  const r = [['sunpetal', 2, 'tonic'], ['duskcap', 2, 'tonic2'], ['frostbloom', 2, 'tonic3'], ['ember', 3, 'elixir']][c];
  if (!r) return;
  if (g.has(r[0]) < r[1]) return say(g, name, "You haven't enough of those.");
  g.take(r[0], r[1]); g.give(r[2], 1);
}
/* A string of duels with no rest between: the arena and the Crucible. */
async function gauntlet(g, kinds, lvl) {
  for (const k of kinds) { const r = await g.duel(k, lvl, { safe: true }); if (r !== 'win') return false; }
  return true;
}

/* ---- people ---- */
const N = (id, name, town, ang, rad, look, talk) => ({ id, name, town, ang, rad, look, talk });
export const NPCS = [
  /* Dawnmere */
  N('maren', 'Elder Maren', 'dawnmere', 200, 14, { top: 0x7a4a6a, hair: 0xe6e6ea, hairStyle: 4, cape: 0x5a3a55, skin: 0xe8b48e, outfit: 'dress' }, async g => {
    if (!g.flag('met_maren')) {
      await say(g, 'Elder Maren', "You're on your feet. Good. Nine days we've watched you lie cold as a hearthstone, and that ring ticking in your fist the whole while.",
        "Look north-east, child. Over the castle. The Spark hasn't moved since the night Oren carried you home. It's dusk, and it has been dusk for nine days.",
        "The stopped things are waking wrong. We call them the Stilled. Blades pass through the moment they're stuck in. But that ring of yours still keeps time, and time is the one thing they can't stand.",
        "The old scarecrow got up and walked on the second day. We penned it in the yard, south-east of the square. Go and see what your Pivot does to it.");
      g.setFlag('met_maren'); return;
    }
    if (!killed(g, 'scarecrow')) return say(g, 'Elder Maren', 'The yard is south-east of the square. Watch the dot. Strike when it crosses the teal. When the ring shows red, that is the creature swinging: catch it there.');
    if (!g.flag('read_note')) return say(g, 'Elder Maren', "So the ring bites. Then there's hope. Oren kept a workshop here, the house beside the windmill. If he left word for anyone, he left it for you.");
    if (!g.S.quests.q_vale) {
      await say(g, 'Elder Maren', "Nine Cogs. He scattered all nine? Then you'll need the Regent in Highmark. Follow the road north-east. You can't miss a castle with a sky-wide clock over it.",
        "But one of the nine is here in the Vale. I can feel it, out in the Fallow Field, where the scarecrows have crowned a king. Tobin and Wren can help you. Start with Tobin. His dogs have gone the same way.");
      g.startQuest('q_vale'); return;
    }
    if (g.flag('ended') === 'caught') return say(g, 'Elder Maren', 'Morning. I had honestly forgotten the colour of it. Go and stand in it a while. You have earned every minute.');
    return say(g, 'Elder Maren', killed(g, 'harvestking') ? `The Fallow Field is quiet. One Cog home. You have ${cogCount(g)} of nine. The Regent in Highmark will know where the rest lie.` : 'Tobin first, then Wren, then the Field. And child: nobody will think less of you for running from a fight you cannot win yet.');
  }),
  N('bram', 'Bram', 'dawnmere', 60, 24, { top: 0x9a6a3a, hair: 0x5a3a24, hat: 'cap', hatColor: 0x6a4a33, acc: ['apron'], body: 1 }, async g => {
    if (ready(g, 'bounty', 1)) { await say(g, 'Bram', "It's down? Truly? My grandmother is buried in that yard. I've not been able to bring her flowers in nine days.", 'Take the purse. All of it.'); g.setFlag('bounty_in'); }
    const opts = ['Trade', 'Never mind'];
    if (!g.S.quests.bounty && killed(g, 'scarecrow')) opts.splice(1, 0, 'Any work going?');
    const c = await g.ui.choose('Bram', "Coin still spends, even if the day won't. What do you need?", opts);
    if (opts[c] === 'Trade') return g.ui.shop('bram', 'Bram');
    if (opts[c] === 'Any work going?') { await say(g, 'Bram', 'Something walks the Quiet Yard, north-west of here. Tall. Wears a ring of light behind its head like a saint in a window. The Gravedial, folk call it.', "The village has a purse for whoever lays it down. It's quicker than it looks. Get some levels on you first."); g.startQuest('bounty'); }
  }),
  N('wren', 'Wren', 'dawnmere', 250, 20, { top: 0x4f7a55, hair: 0x9a4a2a, hairStyle: 5, skin: 0xf6d2b8, acc: ['apron'] }, async g => {
    if (ready(g, 'q_vale', 2)) {
      if (g.has('sunpetal') < 3) return say(g, 'Wren', 'Scarecrow-salt. Three Sunpetal, ground fine. The yellow blooms in the fields: just walk through them. It will make the King of the Field stand and fight instead of blowing away.');
      g.take('sunpetal', 3); await say(g, 'Wren', "That's them. There. Throw it on the Field's edge and he'll come.", "My father was in the orchard when it stopped. He's still there. One foot off the ladder. End this, would you?"); g.setFlag('vale_salt'); return;
    }
    return brew(g, 'Wren');
  }),
  N('tobin', 'Tobin', 'dawnmere', 100, 20, { top: 0x8a7a5a, hair: 0x3a2a1a, hat: 'straw', hatColor: 0xc8b070, body: 1 }, async g => {
    if (ready(g, 'q_vale', 1)) { await say(g, 'Tobin', "It's done, then.", "They were good dogs. You tell anyone who asks. Wren's making something for the Field. Go and see her."); g.setFlag('vale_tobin'); return; }
    if (g.questActive('q_vale') && g.S.quests.q_vale.step === 0) return say(g, 'Tobin', "My dogs were chasing a hare when the Spark stuck, and they've been chasing it since, only now there's no hare and no dog left in 'em. Stillwolves. They run the fields round the village. Put three down. Kindly, if there's a kindly way.");
    return say(g, 'Tobin', killed(g, 'harvestking') ? "Field's safe to graze. If I had anything left to graze on it." : 'I keep whistling for them. Habit.');
  }),
  N('pip', 'Pip', 'dawnmere', 30, 16, { top: 0xd9a04a, hair: 0x6a3a1a, hairStyle: 2, body: 2, scale: 0.72 }, async g => {
    if (!g.S.quests.locket) { await say(g, 'Pip', "I buried my treasure by the pond in Millbrook, 'cause pirates do. It's got my mum's locket in it.", "But now there's things on the road and I'm not allowed. You've got a magic ring. It's up the road, north-east. Purple chest!"); g.startQuest('locket'); return; }
    if (g.questActive('locket') && g.has('locket')) { g.take('locket', 1); await say(g, 'Pip', 'You got it! You actually went!', "This was in my pocket. It's lucky. You can have it, 'cause you're a pirate now."); g.setFlag('locket_in'); return; }
    return say(g, 'Pip', g.flag('ended') === 'caught' ? 'The sun went DOWN and then it came UP again! Did you do that?' : "Mum says the sky's stuck. I think it's just thinking.");
  }),
  N('tick', 'Tick', 'dawnmere', 320, 10, { top: 0xc8a04a, skin: 0xe0b85a, bot: 0x8a6a2a, eyes: 0x7fe6d6, hairStyle: 0, acc: ['halo'], scale: 0.62, hat: 'goggles' }, async g => {
    const n = count(g.S.minutes);
    if (!g.S.quests.minutes) {
      await say(g, 'Tick', "Tick. Tick. Pardon. I count. It's what I'm for. Oren built me to count the minutes off the Dial.", 'I have counted the same minute twelve thousand, nine hundred and sixty times. It is a very long minute.',
        'But there are others. Loose ones. They shook free when the Spark stopped and they drift about the continent glowing, belonging to nobody. Bring me any you find. I can wind spare time into useful things.');
      g.startQuest('minutes'); return;
    }
    const tiers = [[5, 'min5', { t_pendulum: 1 }, 'Five minutes. Enough to boil an egg, or to wind this: a Slow Pendulum.'], [12, 'min12', { r_compass: 1 }, 'Twelve. I have wound them into a compass that points at lost things. It will find you more minutes. And chests. I am not above chests.'],
      [20, 'min20', { t_heart: 1 }, 'Twenty. A Heartstone. It ticks. I find that reassuring.'], [30, 'min30', { t_crown: 1 }, 'Thirty minutes. Half an hour of nobody\'s time. I have made a crown of it.'],
      [45, 'min45', { w_dawn: 1 }, 'Forty-five. I have wound them into a single hand. I call it the Dawnhand, because I am an optimist.'], [60, 'min60', { elixir: 5 }, 'Sixty. A whole hour, belonging to you alone. Do you know, sixteen is enough for an old man to climb a great many stairs? I did the sum once.']];
    let gave = false;
    for (const [need, flag, items, line] of tiers) if (n >= need && !g.flag(flag)) { await say(g, 'Tick', line); for (const k in items) g.give(k, items[k]); g.setFlag(flag); gave = true; }
    if (!gave) { const next = tiers.find(t => !g.flag(t[1])); await say(g, 'Tick', next ? `You carry ${n} loose minute${n === 1 ? '' : 's'}. Bring me ${next[0]} and I can wind something new. Look in quiet corners. Minutes pool where nobody is watching.` : 'Tick. Tick. I have nothing left to count but the real ones. I am looking forward to it.'); }
  }),
  /* Highmark */
  N('isaura', 'Regent Isaura', 'highmark', 356, 70, { top: 0x3d5fb0, hair: 0x2a211c, hairStyle: 4, hat: 'crown', cape: 0x8a3a55, outfit: 'dress', trim: 0xd9b45a, skin: 0xc98a5e }, async g => {
    if (!g.flag('met_regent')) {
      await g.cine.orbit(0, -96, 130, 70, 5, 'The Dial Spire');
      await say(g, 'Regent Isaura', "So you are the apprentice. Oren spoke of you. Usually while complaining. I took that for love.", 'He went up the Spire nine nights ago with the Cog-keys on his belt, and the door sealed behind him. Nine sockets. Nine Cogs. All gone.',
        "My scouts have found where they fell: one in each country under the Dial. Each has gathered a guardian around itself. Something Stilled, and strong.",
        'The Vale, the Salt Coast, the Verdance. Those are within your reach. The Wastes, the Highcrags, Frostspine: harder. The sky-city, the drowned city, and the Cinderdeep will kill you until you are a great deal more than you are now.',
        'Every city has its own leader. Find them; they know their own monsters. And spend your coin. Highmark has an armoury, a market, and an arena. You will need all three.');
      g.setFlag('met_regent');
      for (const k of COGS) g.startQuest('q_' + k, true);
      return;
    }
    const n = cogCount(g);
    if (g.flag('ended') === 'caught') return say(g, 'Regent Isaura', 'I have ordered the bells rung at dawn. Every dawn. Forever. Thank you, apprentice. Keeper, now, I think.');
    return say(g, 'Regent Isaura', n >= 9 ? 'All nine. The door is behind me. Whatever is at the top of those stairs, it is yours to face. Go well prepared. Nothing in the nine countries was as strong as what waits up there.' : `${n} of nine. ${n < 3 ? 'Begin close to home: the Vale, the Coast, the Verdance.' : n < 6 ? 'The Wastes, the Highcrags and Frostspine next, if you are ready.' : 'Only the hardest remain. Temper your blade in Hearthhold. Learn every skill you can.'}`);
  }),
  N('rook', 'Captain Rook', 'highmark', 180, 60, { top: 0x3d5fb0, outfit: 'armor', hat: 'helm', hatColor: 0xc8443a, cape: 0x3d5fb0, body: 1 }, async g => say(g, 'Captain Rook', g.flag('met_regent') ? `A word of soldier's advice. Check the level over an enemy before you swing. If it's well above yours, walk away. There's no shame in a waystone.` : 'Welcome to Highmark. The Regent holds court at the keep, straight up the avenue, under the Spire. Market is all around the fountain.')),
  N('odile', 'Odile', 'highmark', 67, 43, { top: 0x8a3a55, hair: 0xd9a04a, hairStyle: 7, acc: ['apron'], outfit: 'dress' }, async g => g.ui.shop('market', "Odile's Sundries")),
  N('hale', 'Armourer Hale', 'highmark', 112, 43, { top: 0x5a5a66, hair: 0x2a211c, hairStyle: 1, outfit: 'armor', body: 1, acc: ['apron'] }, async g => g.ui.shop('armory', 'Royal Armoury')),
  N('plume', 'Madame Plume', 'highmark', 247, 43, { top: 0xe07a9a, hair: 0x8a4ab8, hairStyle: 4, hat: 'wizard', hatColor: 0xe07a9a, outfit: 'dress', acc: ['scarf'] }, async g => { await say(g, 'Madame Plume', 'Darling. Nine days in the same hair? Sit. Sit! We can fix all of it.'); return g.ui.lookEditor(); }),
  N('ilmari', 'Sage Ilmari', 'highmark', 292, 43, { top: 0x7a4ab0, hair: 0xe6e0d0, hairStyle: 3, hat: 'wizard', hatColor: 0x7a4ab0, outfit: 'robe' }, async g => { await say(g, 'Sage Ilmari', `The ring rewards patience. Three centre strikes in a row is a Finisher. A parry sharpens your next blow. You have ${g.S.sp} skill point${g.S.sp === 1 ? '' : 's'} to spend.`, 'Purple rifts in the wild are tears in the stopped hour. Close one and you will come away wiser. That is to say: with a skill point.'); return g.ui.openMenu('Skills'); }),
  N('lark', 'Lark the Bard', 'highmark', 150, 30, { top: 0x2f8f86, hair: 0xc8443a, hairStyle: 5, hat: 'cap', hatColor: 0x2f8f86, cape: 0xe0a030 }, async g => {
    const done = COGS.filter(k => g.has('cog_' + k)).map(k => REG[k].name);
    return say(g, 'Lark the Bard', done.length ? `I'm writing a ballad. So far it goes: the apprentice walked through ${done.join(', ')}. It doesn't rhyme yet. Keep going and I'll have more to work with.` : "I sing the news. There hasn't been any in nine days. Do something, would you? I'm down to weather, and there isn't any of that either.");
  }),
  N('brannoc', 'Arena-master Brannoc', 'highmark', 90, 62, { top: 0xc8443a, hair: 0x2a211c, hairStyle: 6, outfit: 'bare', body: 1, acc: ['pads'], hatColor: 0xd9b45a, skin: 0x9a6442 }, async g => {
    g.startQuest('arena');
    const rank = g.S.arena || 0, names = ['Sand', 'Bronze', 'Silver', 'Gold', 'Champion'], lvl = [5, 12, 20, 28, 37][rank];
    if (rank >= 5) return say(g, 'Arena-master Brannoc', 'Champion of Highmark. There is no one left to put in front of you. The Second Hand is yours. Never let it turn back.');
    const c = await g.ui.choose('Arena-master Brannoc', `The ${names[rank]} rank: three fights, back to back, no rest. Around level ${lvl}. Win and the purse is ${300 * (rank + 1) * (rank + 1)} coin. Lose and you walk out on your own feet. Mostly.`, ['Enter the arena', 'Not yet']);
    if (c) return;
    const sets = [['husk', 'wolf', 'boar'], ['shellback', 'panther', 'barkling'], ['dustwraith', 'cragram', 'stonewarden'], ['rimegolem', 'stormhawk', 'angler'], ['magmagolem', 'ashwraith', 'champion']];
    if (await gauntlet(g, sets[rank], lvl)) { g.S.arena = rank + 1; g.addCoins(300 * (rank + 1) * (rank + 1)); g.sfx.quest(); await say(g, 'Arena-master Brannoc', `${names[rank]} rank is yours! Hear that crowd. Come back when you want the next.`); }
    else await say(g, 'Arena-master Brannoc', 'Up you get. Sand washes off. Come back stronger.');
  }),
  /* Saltcrest & Reedhaven */
  N('marisol', 'Harbourmaster Marisol', 'saltcrest', 200, 14, { top: 0x3fc0c0, hair: 0x2a211c, hairStyle: 5, hat: 'bandana', hatColor: 0xff5a5a, skin: 0x9a6442, acc: ['scarf'] }, async g => {
    if (!g.flag('met_marisol')) { await say(g, 'Harbourmaster Marisol', "Castle sent you? About time they sent someone. Old Breaker. Biggest crab that ever lived, and nine days ago it stopped being a crab and started being a problem.", "It only comes up for the Storm Horn, same as it always did. Horn's with Old Tam at the Reedhaven light, a long walk west along the shore. Fetch it, blow it at the Cove, and be ready."); g.setFlag('met_marisol'); return; }
    return say(g, 'Harbourmaster Marisol', killed(g, 'breaker') ? "Boats are out. Nets are full. You drink free in Saltcrest for life. Nerida's been asking after you, by the way. Something about the deep." : "Reedhaven's west along the coast. Tam's deaf as a post, so shout.");
  }),
  N('kai', 'Kai', 'saltcrest', 150, 26, { top: 0xffd24a, outfit: 'bare', hair: 0xd9a04a, hairStyle: 2, skin: 0xc98a5e, body: 0 }, async g => {
    const best = g.S.surf || 0;
    const c = await g.ui.choose('Kai', `There's one wave left in the whole sea, frozen mid-curl. Want to ride it? It's all timing. No dodging, just hit every zone as fast as you can.${best ? ' Your best: ' + best.toFixed(1) + 's.' : ''} Under 40 seconds wins coin. Under 25 and I'll be properly impressed.`, ['Ride the Big One (20 coin)', 'Maybe later']);
    if (c || g.S.coins < 20) return;
    g.S.coins -= 20;
    const r = await g.duel('wave', Math.max(3, g.S.level), { safe: true, noXp: true });
    if (r !== 'win') return;
    const t = g.lastFightTime, prize = t < 25 ? 300 : t < 40 ? 80 : 0;
    if (!best || t < best) g.S.surf = t;
    if (prize) g.addCoins(prize);
    await say(g, 'Kai', `${t.toFixed(1)} seconds! ${t < 25 ? 'Unreal. Take it, take it, you earned it.' : t < 40 ? 'Solid ride. Here.' : 'You stayed on, at least. Go again?'}`);
    if (t < 25 && !g.flag('surf_prize')) { g.setFlag('surf_prize'); g.give('x_bellows', 1); }
  }),
  N('nerida', 'Nerida', 'saltcrest', 100, 20, { top: 0x3f9a8a, hair: 0x3fa890, hairStyle: 3, skin: 0xc98a5e, outfit: 'bare', acc: ['scarf'], hatColor: 0x7fe0c0 }, async g => {
    if (g.has('r_tide')) return say(g, 'Nerida', killed(g, 'drownedbell') ? 'The Reach is singing again. I can hear it from the pier.' : 'Walk into the sea east of here and keep walking. Pearlreach is where the floor glows. Mind the anglers.');
    if (!killed(g, 'breaker')) return say(g, 'Nerida', "I dive for the Reach-folk. Did. Old Breaker sits right on the way down. Deal with him and we'll talk about the deep.");
    await say(g, 'Nerida', "There's a city down there. Pearlreach. They've a Cog too, and something worse than Breaker sitting on it.", 'Take my Tidecharm. You can breathe with it. You can walk the sea floor like a road. It is very far down, and nothing there is weak. Go when you are ready, not before.');
    g.give('r_tide', 1);
  }),
  N('finn', 'Finn', 'saltcrest', 22, 26, { top: 0xff7a5a, hair: 0xe6e0d0, hairStyle: 1, hat: 'straw', hatColor: 0xe0c070, skin: 0x9a6442 }, async g => g.ui.shop('surf', "Finn's Surf Shack")),
  N('tam', 'Old Tam', 'reedhaven', 180, 8, { top: 0x4a6a8a, hair: 0xe6e0d0, hairStyle: 3, hat: 'cap', hatColor: 0x2a3a5a, body: 2, skin: 0xf6d2b8 }, async g => {
    if (!g.flag('met_tam')) { await say(g, 'Old Tam', "EH? THE HORN? Aye, I have the horn.", "CAN'T GET TO IT. Gullwraiths. All over the light. Used to be gulls. Scatter four of 'em and it's yours."); g.setFlag('met_tam'); g.S.quests.q_coast.k0 = Object.assign({}, g.S.kills); return; }
    if (g.has('r_horn') || g.flag('horn_blown')) return say(g, 'Old Tam', killed(g, 'breaker') ? 'HEARD IT GO DOWN FROM HERE. And I can\'t hear anything.' : "BLOW IT AT THE COVE. East of Saltcrest. STAND WELL BACK. Then don't.");
    if (g.killsSince('q_coast', 'gull') < 4) return say(g, 'Old Tam', 'FOUR GULLWRAITHS. They flock along this shore. Then the horn.');
    await say(g, 'Old Tam', 'QUIET. Lovely. Here. Mind the mouthpiece.'); g.setFlag('coast_gulls'); g.give('r_horn', 1);
  }),
  /* Canopy */
  N('yara', 'Elder Yara', 'canopy', 200, 14, { top: 0x3f9a4a, hair: 0xe6e0d0, hairStyle: 3, hat: 'feather', hatColor: 0xffd24a, skin: 0x6e4530, outfit: 'dress', acc: ['leaf'] }, async g => {
    if (!g.flag('met_yara')) { await say(g, 'Elder Yara', 'The forest told us you were coming. It tells us very little else now. It has stopped mid-word.', 'The stag in the Hollow was the oldest thing in the Verdance. Now it is the oldest thing that cannot die. It hides from footsteps but not from light.', 'Fenn tracks it. Ixa, in the great tree, makes lanterns the moths cannot resist, and where the moths go, the King follows. Speak to them both.'); g.setFlag('met_yara'); return; }
    return say(g, 'Elder Yara', killed(g, 'antlerking') ? 'He landed. After nine days in the air, he landed, and the whole forest breathed out. Take our thanks, and the bark of the eldest tree to wear.' : 'Fenn, then Ixa. The Hollow lies south-west.');
  }),
  N('fenn', 'Fenn', 'canopy', 100, 20, { top: 0x4a5a3a, hair: 0x2a2a2a, hat: 'hood', hatColor: 0x3a4a30, cape: 0x3a4a30, skin: 0xc98a5e }, async g => {
    if (!g.flag('met_fenn')) { await say(g, 'Fenn', 'Keep your voice down. The wood listens now.', "I saw your master come through, the night it stopped. Running. Something gold under his coat, and crying like a man at a graveside.", 'Bring three pinches of Moth Dust to Ixa. Mothwisps drop it. They are everywhere here. Mind the Shadecats; they feint.'); g.setFlag('met_fenn'); return; }
    return say(g, 'Fenn', killed(g, 'antlerking') ? "I heard him land, all the way from here. First sound of anything finishing I've heard in nine days." : 'Dust to Ixa. Lantern to the Hollow. Then keep your feet.');
  }),
  N('ixa', 'Ixa', 'canopy', 250, 20, { top: 0xe07a2a, hair: 0x2a211c, hairStyle: 4, hat: 'feather', hatColor: 0xe050a0, skin: 0x9a6442, acc: ['apron', 'leaf'] }, async g => {
    if (g.flag('met_fenn') && !g.flag('has_lure')) {
      if (g.has('dust') < 3) return say(g, 'Ixa', 'Three Moth Dust for a lure-lantern. Not two. Two is a night-light.');
      g.take('dust', 3); await say(g, 'Ixa', 'There. Hang it in the Hollow and step back. Then step forward again, because he will come.'); g.setFlag('has_lure'); return;
    }
    const c = await g.ui.choose('Ixa', 'Remedies, or something brewed to order?', ['Shop', 'Brew', 'Never mind']);
    if (c === 0) return g.ui.shop('apoth', "Ixa's Apothecary"); if (c === 1) return brew(g, 'Ixa');
  }),
  /* Mirage & Dunewatch */
  N('sable', 'Madame Sable', 'mirage', 200, 16, { top: 0x6a1c4a, hair: 0x2a211c, hairStyle: 4, hat: 'turban', hatColor: 0xe0b03a, outfit: 'dress', trim: 0xe0b03a, skin: 0xc98a5e, cape: 0xe0b03a }, async g => {
    if (!g.flag('met_sable')) { await say(g, 'Madame Sable', 'Welcome to the Golden Mirage, where it is always the best hour of the evening. Regrettably, it is now always that hour everywhere.', 'You want the Cog. It lies under the Sunken Clock, north-east, and a thing of glass and gold pours itself over it. We call it the Hourglass.', 'The Clock opens only to a sun-key. Captain Isolde carries the last one, and she is stuck in Dunewatch with a broken caravan. Help her and she will help you. Then come back and lose some money. You look lucky.'); g.setFlag('met_sable'); return; }
    return say(g, 'Madame Sable', killed(g, 'hourglass') ? 'The house salutes you. The tables are kinder since the glass stopped singing. Or perhaps you are simply luckier.' : 'Isolde is in Dunewatch, south-west. The tables are inside, when you need cheering up.');
  }),
  N('dex', 'Dex the Croupier', 'mirage', 350, 30, { top: 0x1c1a2a, hair: 0x2a211c, hairStyle: 1, hat: 'cap', hatColor: 0xc8443a, acc: ['scarf'], trim: 0xe0b03a }, async g => {
    const c = await g.ui.choose('Dex the Croupier', `Tables are open. You have ${g.S.coins} coin. Winnings also buy prizes at the cage.`, ['Roulette', 'Slots', 'Blackjack', 'Prize cage', 'Leave']);
    if (c < 3) return g.ui.casino(['roulette', 'slots', 'blackjack'][c]);
    if (c === 3) return g.ui.prizes();
  }),
  N('zahir', 'Zahir', 'mirage', 112, 26, { top: 0x3fa8a0, hair: 0x2a211c, hat: 'turban', hatColor: 0xffffff, outfit: 'robe', acc: ['scarf'], skin: 0x9a6442 }, async g => g.ui.shop('bazaar', "Zahir's Bazaar")),
  N('isolde', 'Captain Isolde', 'dunewatch', 180, 8, { top: 0xc86a4a, hair: 0x1c1c24, hairStyle: 5, cape: 0xd9b45a, skin: 0x9a6442, hat: 'bandana', hatColor: 0xd9b45a }, async g => {
    if (!g.flag('met_isolde')) { await say(g, 'Captain Isolde', "A walker with a working timepiece. I'd have paid a year's profit for that nine days ago.", 'The sand turned to glass under my wagons. Three crates went off into the Wastes. Bring them home and the sun-key is yours. I pay my debts.', 'The Hourglass wears armour like a shell. Only a blow dead in the bright centre will crack it. Remember that.'); g.setFlag('met_isolde'); return; }
    if (g.flag('sunkey')) return say(g, 'Captain Isolde', killed(g, 'hourglass') ? 'The crew thanks you. The ones who can.' : 'The Sunken Clock is north-east of Mirage. You cannot miss a clock the size of a barn.');
    if (g.has('cargo') < 3) return say(g, 'Captain Isolde', `${g.has('cargo')} of three. They lie out in the Wastes around Mirage.`);
    g.take('cargo', 3); await say(g, 'Captain Isolde', 'All three. Seals unbroken. You are either honest or incurious. Here: the sun-key. And my own Twin Ticks, from when I was quicker.'); g.setFlag('sunkey'); g.give('w_twin', 1);
  }),
  /* Highcrag & Coldwater */
  N('brakka', 'Thane Brakka', 'highcrag', 200, 14, { top: 0x6a6a7a, hair: 0xc8443a, hairStyle: 3, hat: 'horns', body: 1, cape: 0x5a4a3a, acc: ['pads'], hatColor: 0x8a8a96 }, async g => {
    if (!g.flag('met_brakka')) { await say(g, 'Thane Brakka', "Lowlander. You climbed all this way, so I'll not waste your breath.", "The Cliffwarden was a mountain's worth of scree that got ideas. It sleeps under the Warden's Stair with your Cog in its chest, and it wakes only for the old bell-rite.", 'The last monk who knows the rite is Halvard, down in Coldwater. Three bells. Then the Stair. Bring armour-breaking blows: it has more hide than sense.'); g.setFlag('met_brakka'); return; }
    return say(g, 'Thane Brakka', killed(g, 'cliffwarden') ? "The Stair's open. The mountain owes you a debt and so do I. The bounty hall pays double for anyone who dropped the Warden. Well. It pays the same. But they'll say it with respect." : 'Halvard, in Coldwater. Then three bells. Then the Stair.');
  }),
  N('orla', 'Orla', 'highcrag', 350, 30, { top: 0x7a5a44, hair: 0x5a3a24, hairStyle: 5, hat: 'hood', hatColor: 0x4a5a4a, acc: ['pack'] }, async g => {
    const lvl = Math.max(8, g.S.level + 2), purse = 60 + lvl * 28;
    const c = await g.ui.choose('Orla', `Bounty hall. There's always something that needs dropping. Today's mark is around level ${lvl}, tougher than the common run. ${purse} coin and whatever it's carrying.`, ['Take the bounty', 'Shop', 'Leave']);
    if (c === 1) return g.ui.shop('crag', 'Highcrag Outfitters');
    if (c !== 0) return;
    const kinds = ['stonewarden', 'cragram', 'panther', 'rimegolem', 'magmagolem', 'angler'];
    if (await g.duel(kinds[(g.S.bounties || 0) % kinds.length], lvl, { safe: true, elite: true }) === 'win') { g.S.bounties = (g.S.bounties || 0) + 1; g.addCoins(purse); g.give(Math.random() < 0.3 ? 'starmetal' : 'ore', 2); await say(g, 'Orla', `Clean work. That's ${g.S.bounties} for you. Purse is yours.`); }
    else await say(g, 'Orla', 'It happens. The mark will keep.');
  }),
  N('halvard', 'Brother Halvard', 'coldwater', 180, 8, { top: 0x6a6a8a, hair: 0xe6e6ea, hat: 'hood', hatColor: 0x5a5a7a, cape: 0x5a5a7a, outfit: 'robe', skin: 0xf6d2b8 }, async g => {
    if (!g.flag('met_halvard')) { await say(g, 'Brother Halvard', "Come in out of the wind. What's left of in.", 'We rang the bells at dusk for six hundred years. That night I rang them and the sound simply... stayed. It is still up there. You can walk into it.', 'Strike each of the three watch-bells once more. The old echo will let go, and the thing under the Stair will wake to answer it. My legs will not carry me. Yours might.'); g.setFlag('met_halvard'); return; }
    return say(g, 'Brother Halvard', sitesDone(g, 'bell') >= 3 ? 'I heard them. One, two, three. And then, for the first time in nine days, I heard them stop.' : 'Three bells on the high ground of the Crags. You will see their frames against the sky.');
  }),
  /* Hearthhold & Lanternfall */
  N('sigrun', 'Chieftain Sigrun', 'hearthhold', 200, 14, { top: 0x8aa0c0, hair: 0xe6e0d0, hairStyle: 5, hat: 'fur', hatColor: 0xd0d6e0, body: 1, cape: 0xf4f0e6, acc: ['collar', 'pads'] }, async g => {
    if (!g.flag('met_sigrun')) { await say(g, 'Chieftain Sigrun', 'You came through the Spine alone? Then sit at my fire. You have earned that much.', "Our founder's statue stood three hundred years in this square. Nine days ago it stepped down and walked north, and the cold went with it. The Rimewarden. It strikes in threes.", 'It cannot bear the old beacon-fires. But the beacons will not hold a flame unless Old Ulf wards them. He winters in Lanternfall, east of here.'); g.setFlag('met_sigrun'); return; }
    return say(g, 'Chieftain Sigrun', killed(g, 'rimewarden') ? 'He is stone again. I have set him back on his plinth, facing the fire this time. Hearthhold is yours, always.' : 'Ulf. Then the three beacons. Then the Crown, north-west. And see Bjarn at the forge before you go.');
  }),
  N('bjarn', 'Forge-master Bjarn', 'hearthhold', 350, 30, { top: 0x5a3a34, hair: 0xc8443a, hairStyle: 6, body: 1, outfit: 'bare', acc: ['apron'], skin: 0xe8b48e }, async g => forge(g, 'Forge-master Bjarn')),
  N('ylva', 'Ylva', 'hearthhold', 112, 26, { top: 0xdfe6f0, hair: 0xd9a04a, hairStyle: 3, hat: 'fur', hatColor: 0xb08a6a, acc: ['collar'] }, async g => g.ui.shop('frost', "Ylva's Stores")),
  N('ulf', 'Old Ulf', 'lanternfall', 180, 8, { top: 0xb08a6a, hair: 0xe6e0d0, hairStyle: 3, hat: 'horns', hatColor: 0x8a8a96, outfit: 'robe', acc: ['collar'], body: 2 }, async g => {
    if (!g.flag('met_ulf')) { await say(g, 'Old Ulf', 'Sigrun sent you. She only sends people when she wants something set on fire.', 'A warding fire needs three Frostbloom. Ice-flowers. They grow across Frostspine, and the Rime Wraiths carry them. Bring three.'); g.setFlag('met_ulf'); return; }
    if (g.flag('frost_ward')) return say(g, 'Old Ulf', sitesDone(g, 'fire') >= 3 ? 'All three lit. I can see them from my door. Go and finish it.' : 'Carry the flame to the three beacons round Hearthhold.');
    if (g.has('frostbloom') < 3) return say(g, 'Old Ulf', `${g.has('frostbloom')} of three Frostbloom.`);
    g.take('frostbloom', 3); await say(g, 'Old Ulf', 'Hold out the ring. There. It will carry the flame. Touch it to each beacon.'); g.setFlag('frost_ward');
  }),
  /* Galefoot & the Aerie */
  N('pim', 'Pim', 'galefoot', 180, 8, { top: 0xe6f0ff, hair: 0x4a6ad0, hairStyle: 2, hat: 'goggles', acc: ['wings', 'pack'], body: 2 }, async g => {
    if (!g.flag('met_pim')) { await say(g, 'Pim', "You want UP? Everybody wants up. Lift's dead. No wind. A wind-lift with no wind is a hole in the air.", 'But Storm Feathers still hold a charge. The hawks on the heath carry them. Three, and I can get the lift breathing.'); g.setFlag('met_pim'); return; }
    if (g.flag('lift_on')) return say(g, 'Pim', killed(g, 'stormcrown') ? "Wind's back! I don't even need the feathers! I'm keeping them. They're mine now." : 'Lift is just north of the village. Stand in the light and hold on to your teeth.');
    if (g.has('feather') < 3) return say(g, 'Pim', `${g.has('feather')} of three Storm Feathers. The Stormhawks. Big, blue, angry.`);
    g.take('feather', 3); await say(g, 'Pim', "Ha! Listen to it hum! North of the village, the ring of light. Up you go."); g.setFlag('lift_on');
  }),
  N('seraphine', 'Archivist Seraphine', 'aerie', 200, 14, { top: 0xffffff, hair: 0xb0b4c0, hairStyle: 4, hat: 'goggles', outfit: 'robe', acc: ['wings'], trim: 0xd9b45a, skin: 0xffe0cc }, async g => {
    if (!g.flag('met_seraphine')) { await g.cine.orbit(-2800, 200, 170, 60, 5, 'The Aerie'); await say(g, 'Archivist Seraphine', 'A groundling. With a Pivot. How perfectly timely, if you will forgive the word.', 'From here we watched it happen. We saw Oren on the Spire. We saw someone fall. We have not been able to look away since.', 'Our Cog is in the breast of the Stormcrown, on the far isle, across the long bridge. It was our weathervane. It reverses the ring more than any creature I have catalogued. Keep your head.'); g.setFlag('met_seraphine'); return; }
    return say(g, 'Archivist Seraphine', killed(g, 'stormcrown') ? 'We are under sail again. Take the cloak. It was made for someone who falls. I think you should have it.' : 'The far isle, across the western bridge. And visit Quill. Glyphs are our trade.');
  }),
  N('quill', 'Quill', 'aerie', 112, 26, { top: 0xf2e0b0, hair: 0xd9a04a, hairStyle: 7, outfit: 'robe', acc: ['wings'], hat: 'goggles' }, async g => g.ui.shop('scribe', "Quill's Glyphs")),
  /* Pearlreach */
  N('thalassa', 'Queen Thalassa', 'pearlreach', 200, 14, { skin: 0x6fd0e0, top: 0xf2d0e0, outfit: 'dress', hat: 'crown', hairStyle: 0, cape: 0x5a6ad0, trim: 0xfff0f6, eyes: 0x1c1a2a, acc: ['scarf'], hatColor: 0xff8ab0 }, async g => {
    if (!g.flag('met_thalassa')) { await g.cine.orbit(2100, 2300, 90, 26, 5, 'Pearlreach'); await say(g, 'Queen Thalassa', 'A walker from the dry, wearing a Tidecharm. Nerida chooses her friends well.', 'Our great bell kept the tides for the whole coast. When the hour stopped, the bell fell silent, and something drifted into it and made it a body.', 'It can be rung out. But the three clappers were lost in the wrecks around the city. Bring them, and I will wake the bell for you to break.'); g.setFlag('met_thalassa'); return; }
    if (g.flag('clappers_in')) return say(g, 'Queen Thalassa', killed(g, 'drownedbell') ? 'The current has returned. Pearlreach will sing of you for as long as there are tides.' : 'The Bell Deep lies south-east. Strike in threes, as it does.');
    if (g.has('clapper') < 3) return say(g, 'Queen Thalassa', `${g.has('clapper')} of three clappers. Search the wrecks.`);
    g.take('clapper', 3); await say(g, 'Queen Thalassa', 'All three. Then it wakes. Go to the Bell Deep, and may the water carry you.'); g.setFlag('clappers_in');
  }),
  N('maro', 'Maro', 'pearlreach', 112, 26, { skin: 0x7fe0c0, top: 0x5a6ad0, outfit: 'bare', hat: 'fin', hatColor: 0xffd24a, hairStyle: 0, eyes: 0x1c1a2a }, async g => g.ui.pearls()),
  /* Ashford & Emberdeep */
  N('garrick', 'Garrick', 'ashford', 180, 8, { top: 0x5a3a34, hair: 0x2a211c, hairStyle: 1, body: 1, hat: 'goggles', acc: ['apron', 'pads'], hatColor: 0x5a5460 }, async g => {
    if (!g.flag('met_garrick')) { await say(g, 'Garrick', "Emberdeep? Inside the mountain. One road in: the canyon, north-east of here. And the canyon gate's been glowing white for nine days.", "It needs cooling. Proper cold. Two Frost Cores, out of the Rime Golems in Frostspine. I know. Other end of the world. That's why nobody's done it."); g.setFlag('met_garrick'); return; }
    if (g.flag('gate_cooled')) return say(g, 'Garrick', killed(g, 'cinderheart') ? "The mountain's breathing easy. Vessa sent down a cask. First delivery in nine days." : 'Gate is cold. Follow the canyon up into the crater. Mind the hounds.');
    if (g.has('core') < 2) return say(g, 'Garrick', `${g.has('core')} of two Frost Cores.`);
    g.take('core', 2); await say(g, 'Garrick', 'Stand back. ...There. Hear it tick as it cools? Canyon is open. Tell Vessa I sent you.'); g.setFlag('gate_cooled');
  }),
  N('vessa', 'Forge-matron Vessa', 'emberdeep', 200, 50, { top: 0x3a3644, hair: 0xe6e0d0, hairStyle: 6, body: 1, hat: 'mask', acc: ['apron', 'pads'], hatColor: 0xc8443a, skin: 0x9a6442 }, async g => {
    if (!g.flag('met_vessa')) { await g.cine.orbit(2200, -2100, 150, 60, 5, 'Emberdeep'); await say(g, 'Forge-matron Vessa', 'Garrick sent you. Then you carried frost across the whole continent to get here. Good. Stubborn is what we work with.', "The Cinder Heart sits on the Ash Throne outside the crater. It is the mountain's own heart, stopped mid-beat. Five layers of slag for armour. Nothing here is harder.", 'I will not send anyone to it who cannot stand three rounds of the Crucible. Prove it at the ring of pillars, north of the lake.'); g.setFlag('met_vessa'); return; }
    return say(g, 'Forge-matron Vessa', killed(g, 'cinderheart') ? 'You brought the Heart down. Wear the Core. It suits you better than it suited the mountain.' : (g.S.crucible || 0) >= 3 ? 'Three rounds. You will do. The Ash Throne is west of the crater, outside the wall.' : 'The Crucible. Three rounds. Then we talk.');
  }),
  N('crucible', 'Crucible-keeper Ash', 'emberdeep', 0, 62, { top: 0x2a2630, hair: 0xc8443a, hairStyle: 2, hat: 'mask', outfit: 'bare', body: 1, acc: ['pads'], hatColor: 0xff7a2a, skin: 0x6e4530 }, async g => {
    const best = g.S.crucible || 0;
    const c = await g.ui.choose('Crucible-keeper Ash', `The Crucible. Round after round, each hotter than the last, no rest between. Your best: round ${best}. Every round pays more. Round 8 pays in legend.`, ['Step in', 'Leave']);
    if (c) return;
    const pool = ['cinderling', 'emberhound', 'ashwraith', 'magmagolem'];
    let round = 0;
    while (round < 12 && await g.duel(pool[round % 4], 30 + round * 2, { safe: true }) === 'win') { round++; g.addCoins(120 * round); }
    if (round > best) g.S.crucible = round;
    if (round >= 8 && !g.flag('crucible_prize')) { g.setFlag('crucible_prize'); g.give('t_frost', 1); }
    await say(g, 'Crucible-keeper Ash', round ? `Round ${round}. ${round >= 8 ? 'Legend.' : round >= 3 ? 'Respectable.' : 'Warm-up.'} The ring is always lit.` : 'It burns everyone the first time.');
  }),
  N('cole', 'Cole', 'emberdeep', 112, 62, { top: 0x4a4450, hair: 0x2a211c, hairStyle: 1, hat: 'goggles', acc: ['apron'] }, async g => g.ui.shop('ember', "Cole's Coalworks")),
  /* hamlet traders */
  ...[['millbrook', 'Miller Anwen', "The mill hasn't turned in nine days. I sell what I've got."], ['threestones', 'Hob', 'Three stones, three roads. East is the Wastes. Buy water.'], ['windrest', 'Widow Carys', 'West of here the heath begins, and above it the sky-city. Nobody goes up any more.'], ['dunewatch', 'Sef', "Prices are what they were at dusk, because it's still dusk."], ['galefoot', 'Bryn', 'You want the lift? Talk to Pim. You want supplies? Talk to me.'], ['coldwater', 'Marta', 'North-west is the Crags. North is the Spine. Either way, buy tonics.'], ['lanternfall', 'Kell', 'We keep the lanterns lit so the dark knows where the village ends.'], ['ashford', 'Tansy', "Everything tastes of ash. I've stopped apologising for it."], ['reedhaven', 'Dilly', 'Tam shouts, I sell. It works.']]
    .map(([town, name, line], i) => N('trader_' + town, name, town, 20, 8, null, async g => { await say(g, name, line); return g.ui.shop('hamlet', name); })),
];

export async function readNote(g) {
  await say(g, '', 'The workshop is cold. Tools are laid out for a job never started. On the bench, weighted with a brass gear, a note in Oren\'s square hand:');
  await say(g, "Oren's note", 'Apprentice. If you are reading this, you are up and about, and I am glad of it, more than this paper can hold.',
    'The nine Cogs are out of the Dial. I took them out. One has gone to each country, as far apart as I could carry them. They are to stay there.',
    'Do not look for them. Do not come to Highmark. Do not come up the Spire. Mind the shop. Be kind to Tick.', 'I am sorry about the dusk. It was the best I could do. — O.');
  await say(g, '', 'He stopped the Dial himself. Oren, who would not let a clock in the shop run four seconds slow.', 'There are pages torn from his journal, too. He must have dropped them as he ran. And there are nine Cogs to find, whatever he says.');
  g.setFlag('read_note');
}

export async function spireDoor(g) {
  const n = cogCount(g);
  if (killed(g, 'oren')) return ending(g);
  if (!g.flag('met_regent')) return say(g, '', 'A door of black iron, five times your height, at the foot of the Spire. It has no handle. Nine round sockets sit cold and empty in its face.');
  if (n < 9 && !g.flag('gate_open')) return say(g, '', `Nine sockets in the black door, each edged in a different metal. You hold ${n} of the nine Cogs.`);
  if (!g.flag('gate_open')) { await say(g, '', 'You set the Cogs in their sockets, one by one. They turn a quarter turn by themselves and the door breathes inward.', 'Stairs. A great many stairs. Somewhere far above, a ring is ticking that is not yours.'); g.setFlag('gate_open'); }
  await say(g, 'Oren', "That's far enough.", 'You found them. All nine. Of course you did. I trained you to find the fault in anything.', "I can't let you start it. I know how that sounds. Go home. Please. It can be dusk forever. People will get used to dusk.");
  const c = await g.ui.choose('Oren', 'Put the ring down, apprentice.', ['Raise the Pivot', 'Not yet']);
  if (c === 0) { const r = await g.duel('oren', 40, { boss: true }); if (r === 'win') await afterOren(g); }
}

async function afterOren(g) {
  await say(g, 'Oren', 'Enough. Enough. You always were quicker than me. I just had longer arms.', 'You want to know why. Look up. Not at the Dial. At the crown of the Spire. The scaffold.');
  await g.cine.look([18, 40, -40], [0, 200, -100], 6);
  await say(g, '', 'You look up.', "High above, where the rotten boards have given way, someone is falling. They hang in the amber air a hand's width above the stones, perfectly still.", 'They are wearing your coat.');
  await say(g, 'Oren', 'It was the last minute of dusk. I heard the boards go. I had the nine keys on my belt and I did not think.', 'What stands here talking to me is the part of you I could carry home. A shadow with a ring in its hand. The rest of you is up there, one heartbeat from the ground.',
    'If the Spark moves, that heartbeat happens. So I stopped it. I stopped everything. And I would do it again, and I am sorry, and I would do it again.');
  return ending(g);
}

async function ending(g) {
  const n = count(g.S.minutes);
  const c = await g.ui.choose('', `The Dial waits. In your pocket, ${n} loose minute${n === 1 ? '' : 's'}.`, ['Start the Dial', 'Leave the hour stopped', 'Not yet']);
  if (c === 2) return;
  if (c === 1) {
    await g.ui.crawl(['You put the ring in his hand and close his fingers around it.', 'It is dusk in Meridian. It will always be dusk in Meridian.', 'The orchards hold their apples. The birds hold their places in the air. In nine countries, the hollow things keep getting up.',
      'And every evening that is not an evening, an old man climbs the Spire to sit beside someone who is always, always about to land.', 'THE KEPT HOUR', 'There are other ways for this hour to end.']);
    g.setFlag('ended', 'kept'); return;
  }
  if (n >= 16) {
    await g.ui.crawl(['You open your hand. The loose minutes pour out of it like sparks off a wheel.', `${n} of them. Spare time. Belonging to no one, until now.`,
      '"Sixteen is enough," says Oren, very quietly, "for an old man to climb a great many stairs."', 'He is already running.', 'You set the Pivot against the Dial and choose the moment.',
      'The Spark moves. The hour ends. Far above, the fall finishes — into a pair of long arms, on the last step, with one second to spare.', 'You wake on the stones of the crown with the whole of yourself, and an old man laughing and weeping into your coat.',
      'Over Meridian, for the first time in nine days, the sun goes down.', 'And then, because that is what it is for, it comes up.', 'THE CAUGHT HOUR']);
    g.setFlag('ended', 'caught'); g.afterEnding();
    return;
  }
  await g.ui.crawl(['You set the Pivot against the Dial and choose the moment.', 'The Spark moves.', 'Above you, the heartbeat that has waited nine days finally happens.',
    'It does not hurt. Shadows do not hurt. You have time to see the orchards let go of their apples, and the birds remember their wings, and an old man on his knees in the first dark.',
    'Morning came to Meridian. It was paid for.', 'THE PAID HOUR', `You carried ${n} loose minute${n === 1 ? '' : 's'}. Tick once did a sum: sixteen would have been enough.`, 'The moment is still waiting, if you would choose again.']);
  g.setFlag('ended', 'paid');
}

/* Short scenes played when a guardian falls and its Cog comes home. */
export async function cogScene(g, boss) {
  const n = cogCount(g);
  await say(g, '', `${boss.def.name} finishes the moment it was stuck in, and is gone. Where it stood lies a Cog.`);
  await g.cine.look(null, [0, 900, 0], 4.5, n >= 9 ? 'All nine Cogs' : `${n} of nine`);
  await say(g, '', n >= 9 ? 'Far off over Highmark, the Spark shudders a ninth time. All nine Cogs are yours. The Spire is waiting, and so is whoever sealed it.' : 'Far off over Highmark, the Spark shudders forward a notch, and the colour of the whole sky changes.');
}
export { PEARL_SHOP };
