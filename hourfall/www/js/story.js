/* The story: quests, the people of Meridian, and the endings.
   Dialogue is plain async code: `await say(...)` shows lines, `await g.ui.choose(...)` asks. */
import { MINUTES, PAGES, BELLS, CRATES } from './data.js';

const cogs = g => g.has('cog_dawn') + g.has('cog_noon') + g.has('cog_dusk');
export const cogCount = cogs;
const count = o => Object.keys(o).length;
async function say(g, name, ...lines) { for (const l of lines) await g.ui.say(name, l); }

export const INTRO = [
  'Above the island of Meridian hangs the Great Dial.',
  'For a thousand years its Spark has circled the sky, carrying morning and evening behind it.',
  'Nine days ago, in the last minute of dusk, the Spark stopped.',
  'The sun has not set. Birds hang in the air where they were. And things that stood still too long have begun to get up again, hollow.',
  'You are apprentice to Oren, Keeper of the Dial. He climbed the Spire that night. He has not come down.',
  'You woke in the square of Dawnmere with a ring in your fist: a Pivot, the only thing on the island still keeping time.',
];

export const QUESTS = {
  main: {
    name: 'The Hour That Stayed', main: true,
    steps: [
      { t: 'Speak with Elder Maren in Dawnmere', done: g => g.flag('met_maren'), at: [0, 122] },
      { t: 'Wake the Pivot: fight the Stilled Scarecrow in the fenced yard', done: g => g.flag('killed_scarecrow'), at: [30, 166] },
      { t: "Search Oren's workshop, the house with the ring over its door", done: g => g.flag('read_note'), at: [-33.5, 171.5] },
      { t: g => `Recover the three Cogs (${cogs(g)}/3)`, done: g => cogs(g) >= 3,
        at: g => !g.has('cog_dawn') ? (g.flag('met_fenn') ? [-235, 40] : [-148, 113]) : !g.has('cog_noon') ? (g.flag('met_isolde') ? [240, 20] : [163, 123]) : (g.flag('met_halvard') ? [-70, -255] : [60, -172]) },
      { t: 'Carry the Cogs to the door of the Dial Spire', done: g => g.flag('gate_open'), at: [0, -43] },
      { t: 'Face the Keeper of the Dial', done: g => g.flag('killed_oren'), at: [0, -43] },
      { t: 'Choose the hour', done: g => g.flag('ended'), at: [0, -43] },
    ],
    reward: { xp: 0 },
  },
  flock: {
    name: 'The Stilled Flock',
    steps: [
      { t: g => `Put down Stillwolves (${Math.min(4, g.killsSince('flock', 'wolf'))}/4)`, done: g => g.killsSince('flock', 'wolf') >= 4 },
      { t: 'Return to Tobin in Dawnmere', done: g => g.flag('flock_in'), at: [30, 118] },
    ],
    reward: { xp: 60, coins: 60, items: { a_wool: 1 } },
  },
  remedy: {
    name: 'A Remedy for Stillness',
    steps: [
      { t: g => `Gather 3 Sunpetal (${Math.min(3, g.has('sunpetal'))}/3) and 2 Duskcap (${Math.min(2, g.has('duskcap'))}/2). Duskcap grows in Whisperwood.`, done: g => g.flag('remedy_in') || (g.has('sunpetal') >= 3 && g.has('duskcap') >= 2) },
      { t: 'Bring the herbs to Wren in Dawnmere', done: g => g.flag('remedy_in'), at: [-15, 150] },
    ],
    reward: { xp: 80, items: { g_mend: 1 } },
  },
  locket: {
    name: 'The Locket in the Mere',
    steps: [
      { t: 'Swim to the islet in Mirror Mere, east of Dawnmere, and find the locket', done: g => g.flag('locket_in') || g.has('locket') > 0, at: [75, 55] },
      { t: 'Return the locket to Pip', done: g => g.flag('locket_in'), at: [-9, 131] },
    ],
    reward: { xp: 90, items: { t_lucky: 1 } },
  },
  moths: {
    name: 'Moths to a Flame',
    steps: [
      { t: g => `Scatter Mothwisps in Whisperwood (${Math.min(5, g.killsSince('moths', 'moth'))}/5)`, done: g => g.killsSince('moths', 'moth') >= 5 },
      { t: 'Return to Fenn at his camp', done: g => g.flag('moths_in'), at: [-148, 113] },
    ],
    reward: { xp: 120, coins: 40, items: { g_ember: 1 } },
  },
  cargo: {
    name: "The Caravan's Lost Cargo",
    steps: [
      { t: g => `Find the crates scattered across the Saltglass Flats (${Math.min(3, g.has('cargo'))}/3)`, done: g => g.flag('cargo_in') || g.has('cargo') >= 3, at: g => { const c = CRATES.find(c => !g.S.opened[c.id]); return c ? [c.x, c.z] : null; } },
      { t: 'Return the cargo to Captain Isolde', done: g => g.flag('cargo_in'), at: [163, 123] },
    ],
    reward: { xp: 180, coins: 150, items: { w_twin: 1 } },
  },
  bells: {
    name: "Halvard's Bells",
    steps: [
      { t: g => `Ring the three watch-bells of the Frostspine (${BELLS.filter(b => g.S.opened[b.id]).length}/3)`, done: g => BELLS.every(b => g.S.opened[b.id]), at: g => { const b = BELLS.find(b => !g.S.opened[b.id]); return b ? [b.x, b.z] : null; } },
      { t: 'Return to Brother Halvard', done: g => g.flag('bells_in'), at: [60, -172] },
    ],
    reward: { xp: 260, coins: 80, items: { w_hammer: 1 } },
  },
  bounty: {
    name: 'Bounty: The Gravedial',
    steps: [
      { t: 'Put the Gravedial to rest in the Quiet Yard, north-west of Dawnmere', done: g => g.flag('killed_gravedial'), at: [-62, 30] },
      { t: 'Collect the bounty from Bram', done: g => g.flag('bounty_in'), at: [15, 143] },
    ],
    reward: { xp: 150, coins: 180 },
  },
  minutes: {
    name: 'Loose Minutes',
    steps: [
      { t: g => `Gather Lost Minutes and bring them to Tick by the well (${count(g.S.minutes)}/${MINUTES.length} found)`, done: g => g.flag('min24'), at: [4.5, 145] },
    ],
    reward: { xp: 400 },
  },
  pages: {
    name: "The Keeper's Journal",
    steps: [
      { t: g => `Find the pages of Oren's journal (${count(g.S.pages)}/${PAGES.length})`, done: g => count(g.S.pages) >= PAGES.length },
    ],
    reward: { xp: 300, items: { g_echo: 1 } },
  },
};

/* ---- people ---- */
async function turnIn(g, quest, flag, name, ...lines) {
  await say(g, name, ...lines);
  g.setFlag(flag);
}
const ready = (g, id, step) => g.questActive(id) && g.S.quests[id].step === step;

export const NPCS = [
  { id: 'maren', name: 'Elder Maren', x: 0, z: 122, look: { cloth: 0x7a4a6a, hair: 0xe6e6ea, cloak: 0x5a3a55, skin: 0xd9b89a },
    async talk(g) {
      if (!g.flag('met_maren')) {
        await say(g, 'Elder Maren', "You're on your feet. Good. Nine days we've watched you lie cold as a hearthstone, and that ring ticking in your fist the whole while.",
          "Look up, child. The Spark hasn't moved since the moment we found you. It's dusk, and it has been dusk for nine days.",
          "Your master went up the Spire that night. Oren. He hasn't come down, and nothing that goes near the Spire comes back the same.",
          "The stopped things are waking wrong. We call them the Stilled. Blades pass through the moment they're stuck in. But that ring of yours still keeps time, and time is the one thing they can't stand.",
          "The old scarecrow got up and walked on the second day. We penned it in the yard, south-east of the square. Go and see what your Pivot does to it.");
        g.setFlag('met_maren'); return;
      }
      if (!g.flag('killed_scarecrow')) return say(g, 'Elder Maren', 'The yard is south-east of the square, inside the fence. Watch the dot. Strike when it crosses the teal. When the ring shows red, that is the creature swinging: catch it there.');
      if (!g.flag('read_note')) return say(g, 'Elder Maren', "So the ring bites. Then there's hope. Oren's workshop is south-west of here, the house with the ring over the door. If he left word for anyone, he left it for you.");
      if (g.flag('ended') === 'caught') return say(g, 'Elder Maren', 'Morning. I had honestly forgotten the colour of it. Go and stand in it a while. You have earned every minute.');
      if (cogs(g) >= 3) return say(g, 'Elder Maren', 'All three. I can feel the air leaning toward the Spire, like a held breath. Whatever is up there, child, it knew your name before any of us did.');
      return say(g, 'Elder Maren', `He took the Cogs out himself? Oren would sooner cut off his hands. Find them. Dawn in the wood to the west, Noon under the glass to the east, Dusk on the mountain. You have ${cogs(g)} of three.`,
        'And ask the people out there for help. Fenn in the Whisperwood. Captain Isolde with the caravan. Old Halvard up at the monastery, if the cold has not taken him.');
    } },
  { id: 'bram', name: 'Bram', x: 15, z: 143, look: { cloth: 0x9a6a3a, hair: 0x5a3a24, hat: 0x6a4a33 },
    async talk(g) {
      if (ready(g, 'bounty', 1)) await turnIn(g, 'bounty', 'bounty_in', 'Bram', "It's down? Truly? My grandmother is buried in that yard. I've not been able to bring her flowers in nine days.", 'Take the purse. All of it. And thank you.');
      const opts = ['Trade', 'Never mind'];
      if (!g.S.quests.bounty && g.flag('killed_scarecrow')) opts.splice(1, 0, 'Any work going?');
      const c = await g.ui.choose('Bram', "Coin still spends, even if the day won't. What do you need?", opts);
      if (opts[c] === 'Trade') return g.ui.shop('bram', 'Bram');
      if (opts[c] === 'Any work going?') {
        await say(g, 'Bram', 'Something walks the Quiet Yard, north-west of here, past the stream. Tall. Wears a ring of light behind its head like a saint in a window. The Gravedial, folk are calling it.', "The village has put together a purse for whoever lays it down. Mind yourself. It's quicker than it looks.");
        g.startQuest('bounty');
      }
    } },
  { id: 'wren', name: 'Wren', x: -15, z: 150, look: { cloth: 0x4f7a55, hair: 0x9a4a2a, skin: 0xe6c0a0 },
    async talk(g) {
      if (!g.S.quests.remedy) {
        await say(g, 'Wren', "My father was in the orchard when it stopped. He's still there. One foot off the ladder.", "I think I can make something that keeps the stillness out of a body. I need three Sunpetal from the fields and two Duskcap from the Whisperwood. I can't leave him to fetch them.");
        g.startQuest('remedy'); return;
      }
      if (g.questActive('remedy') && g.has('sunpetal') >= 3 && g.has('duskcap') >= 2) {
        g.take('sunpetal', 3); g.take('duskcap', 2);
        await turnIn(g, 'remedy', 'remedy_in', 'Wren', "That's them. Give me a moment.", "It works on cuts, at least. It won't bring him down the ladder. But I've pressed the recipe into a glyph for your ring. Strike the green when you see it.");
        return;
      }
      const c = await g.ui.choose('Wren', 'I can brew from what you bring me.', ['2 Sunpetal → Tonic', '2 Duskcap → Strong Tonic', '2 Frostbloom → Sunpetal Elixir', 'Never mind']);
      const r = [['sunpetal', 'tonic'], ['duskcap', 'tonic2'], ['frostbloom', 'elixir']][c];
      if (!r) return;
      if (g.has(r[0]) < 2) return say(g, 'Wren', "You haven't enough of those. Look for the little glowing blooms.");
      g.take(r[0], 2); g.give(r[1], 1);
    } },
  { id: 'tobin', name: 'Tobin', x: 30, z: 118, look: { cloth: 0x8a7a5a, hair: 0x3a2a1a, hat: 0xc8b070 },
    async talk(g) {
      if (!g.S.quests.flock) {
        await say(g, 'Tobin', "My dogs. Four of 'em. They were chasing a hare when the Spark stuck, and they've been chasing it ever since, only now there's no hare and no dog left in 'em.", "Stillwolves, folk say. They're out in the fields. Put them down for me. Kindly, if there's a kindly way.");
        g.startQuest('flock'); return;
      }
      if (ready(g, 'flock', 1)) return turnIn(g, 'flock', 'flock_in', 'Tobin', "It's done, then.", "Here. My spare cloak, and what coin I've got. They were good dogs. You tell anyone who asks, they were good dogs.");
      if (g.questActive('flock')) return say(g, 'Tobin', "They run the fields around the village. Grey things with lamp eyes. You'll know them.");
      return say(g, 'Tobin', 'I keep whistling for them. Habit.');
    } },
  { id: 'pip', name: 'Pip', x: -9, z: 131, look: { cloth: 0xd9a04a, hair: 0x6a3a1a, scale: 0.68 },
    async talk(g) {
      if (!g.S.quests.locket) {
        await say(g, 'Pip', "I buried my treasure on the little island in the Mere, 'cause pirates do. It's got my mum's locket in it.", "But now there's things in the fields and I'm not allowed. You've got a magic ring. Can you swim? You can just swim there. It's east.");
        g.startQuest('locket'); return;
      }
      if (g.questActive('locket') && g.has('locket')) {
        g.take('locket', 1);
        return turnIn(g, 'locket', 'locket_in', 'Pip', "You got it! You actually swam!", "This was in the chest too. It's lucky. I found it in a clock. You can have it, 'cause you're a pirate now.");
      }
      if (g.flag('ended') === 'caught') return say(g, 'Pip', "The sun went DOWN and then it came UP again! Did you see? Did you do that?");
      return say(g, 'Pip', g.questDone('locket') ? "Mum says the sky's stuck. I think it's just thinking." : "The island's in the middle of the Mere. East! You can't miss it. Well, you can, but don't.");
    } },
  { id: 'tick', name: 'Tick', x: 4.5, z: 145, look: { cloth: 0xc8a04a, skin: 0xd9b45a, legs: 0x8a6a2a, eyes: 0x7fe6d6, halo: true, scale: 0.6 },
    async talk(g) {
      const n = count(g.S.minutes);
      if (!g.S.quests.minutes) {
        await say(g, 'Tick', "Tick. Tick. Tick. Pardon. I count. It's what I'm for. Oren built me to count the minutes off the Dial.", "I have counted the same minute twelve thousand, nine hundred and sixty times. It is a very long minute.",
          "But there are others. Loose ones. They shook free when the Spark stopped, and they drift about the island glowing, belonging to nobody. Bring me any you find. Spare time ought not to be wasted. I can wind it into useful things.");
        g.startQuest('minutes'); return;
      }
      const tiers = [[6, 'min6', { t_pendulum: 1 }, 0, 'Six minutes. Enough to boil an egg, or to wind this. A Slow Pendulum. It will make your ring take its time.'],
        [12, 'min12', { t_heart: 1 }, 0, 'Twelve. Now we are getting somewhere. I have wound them into a Heartstone. It ticks. I find that reassuring.'],
        [18, 'min18', { elixir: 2 }, 400, 'Eighteen minutes. Do you know, sixteen is enough for an old man to climb a great many stairs? I did the sum. I do not know why I did the sum.'],
        [24, 'min24', { w_dawn: 1 }, 0, 'Twenty-four. All of them. Every loose minute on Meridian. I have wound them into a single hand. I call it the Dawnhand, because I am an optimist.']];
      let gave = false;
      for (const [need, flag, items, coins, line] of tiers) {
        if (n >= need && !g.flag(flag)) { await say(g, 'Tick', line); for (const k in items) g.give(k, items[k]); if (coins) g.addCoins(coins); g.setFlag(flag); gave = true; }
      }
      if (!gave) {
        const next = tiers.find(t => !g.flag(t[1]));
        await say(g, 'Tick', next ? `You carry ${n} loose minute${n === 1 ? '' : 's'}. Bring me ${next[0]} and I can wind something new. Look in quiet corners. Minutes pool where nobody is watching.` : 'Tick. Tick. I have nothing left to count but the real ones. I am looking forward to it.');
      }
    } },
  { id: 'fenn', name: 'Fenn', x: -148, z: 113, look: { cloth: 0x4a5a3a, hair: 0x2a2a2a, hood: 0x3a4a30, cloak: 0x3a4a30, skin: 0xc89a7a },
    async talk(g) {
      if (!g.flag('met_fenn')) {
        await say(g, 'Fenn', "Keep your voice down. The wood listens now.", "You're the Keeper's apprentice. I saw him come through, the night it stopped. Running. He had something gold under his coat, and he was crying like a man at a graveside.",
          "He went west to the Hollow and came back without the gold. Next morning the old stag was standing in the ring of stones. The Antler King. He's been one leap from landing for nine days.",
          "If you want what Oren left there, you'll go through him. Follow the camp west and a little south. And take your time with him. He has plenty.");
        g.setFlag('met_fenn');
      }
      if (!g.S.quests.moths) {
        await say(g, 'Fenn', "While you're in my wood: the Mothwisps. They come to my fire and stand in it, and it doesn't burn them, and I haven't slept. Scatter five of them and I'll teach your ring what fire is for.");
        g.startQuest('moths'); return;
      }
      if (ready(g, 'moths', 1)) return turnIn(g, 'moths', 'moths_in', 'Fenn', 'Quiet. Finally.', 'Hold out the ring. There. Strike the orange when it shows and they will burn for it.');
      return say(g, 'Fenn', g.has('cog_dawn') ? "You laid him down. I heard him land, all the way from here. It was the first sound of anything finishing I've heard in nine days." : 'The Hollow is west and south of here. A ring of mossy stones. You will hear him breathing before you see him.');
    } },
  { id: 'isolde', name: 'Captain Isolde', x: 163, z: 123, look: { cloth: 0xc86a4a, hair: 0x1c1c24, cloak: 0xd9b45a, skin: 0xb07a5a },
    async talk(g) {
      if (!g.flag('met_isolde')) {
        await say(g, 'Captain Isolde', "A walker, out of the west, with a working timepiece. I'd have paid a year's profit for that nine days ago.", "We were crossing the Flats when the hour stopped. The sand turned to glass under the wagons. Half my cargo is out there. Half my crew, too, mid-step.",
          "Your master? Aye. He came through at a dead run and went east, to the Sunken Clock. An old dial, bigger than a house, half buried. Something lives under its face now. It pours itself from one shape to the other. We call it the Hourglass.",
          "It wears armour like a shell. Only a blow dead in the bright centre will crack it. Remember that.");
        g.setFlag('met_isolde');
      }
      if (!g.S.quests.cargo) {
        await say(g, 'Captain Isolde', 'Three crates went off the wagons when the ground set. If you cross the Flats anyway, bring them home and I will make it worth the walk.');
        g.startQuest('cargo'); return;
      }
      if (g.questActive('cargo') && g.has('cargo') >= 3) {
        g.take('cargo', 3);
        return turnIn(g, 'cargo', 'cargo_in', 'Captain Isolde', 'All three. Seals unbroken. You are either honest or incurious.', 'Twin Ticks. My own, from when I was quicker. Two blades, two chances on the ring. And coin, because I pay my debts.');
      }
      return say(g, 'Captain Isolde', g.has('cog_noon') ? "The glass has stopped singing at night. Whatever you did out there, the crew thanks you. The ones who can." : 'The Sunken Clock is east and north of camp. You cannot miss a clock the size of a barn. Sef has supplies, if you have coin.');
    } },
  { id: 'sef', name: 'Sef', x: 170, z: 119, look: { cloth: 0x4f7f9a, hair: 0xd9d9e0, hat: 0xd9b45a, skin: 0xb07a5a },
    async talk(g) { await say(g, 'Sef', "Quartermaster. Everything's for sale. Prices are what they were at dusk, because it's still dusk."); return g.ui.shop('sef', 'Sef'); } },
  { id: 'halvard', name: 'Brother Halvard', x: 60, z: -172, look: { cloth: 0x6a6a8a, hair: 0xe6e6ea, hood: 0x5a5a7a, cloak: 0x5a5a7a, skin: 0xd9c0b0 },
    async talk(g) {
      if (!g.flag('met_halvard')) {
        await say(g, 'Brother Halvard', "Come in out of the wind. What's left of in.", "I am the last of the order that kept the mountain's hour. We rang the bells at dusk for six hundred years. That night I rang them, and the sound simply... stayed. It is still up there. You can walk into it.",
          "Oren came past my door before the echo did. He went up to the Warden's Crown, far to the north-west, the highest ring of stones. He carried dark iron. He left without it.",
          "The Rimewarden stands there now. Our founder's statue. It was only ever stone. Go carefully, and go well armoured. It strikes in threes.");
        g.setFlag('met_halvard');
      }
      if (!g.S.quests.bells) {
        await say(g, 'Brother Halvard', 'There are three watch-bells on the Frostspine. If each were struck once more, the old echo might finally let go. My legs will not carry me. Yours might.');
        g.startQuest('bells'); return;
      }
      if (ready(g, 'bells', 1)) return turnIn(g, 'bells', 'bells_in', 'Brother Halvard', 'I heard them. One, two, three. And then, for the first time in nine days, I heard them stop.', 'Take the Bellhammer. It is how we rang the great one. It is not a subtle instrument.');
      return say(g, 'Brother Halvard', g.has('cog_dusk') ? 'The mountain is quieter. Not at peace. But quieter.' : "The Crown is north-west along the ridge. The bells stand on the high ground. You'll see their frames against the sky.");
    } },
];

/* Oren's desk: the note that starts the hunt. */
export async function readNote(g) {
  await say(g, '', 'The workshop is cold. Tools are laid out for a job never started. On the bench, weighted with a brass gear, a note in Oren\'s square hand:');
  await say(g, "Oren's note", 'Apprentice. If you are reading this, you are up and about, and I am glad of it, more than this paper can hold.',
    'The three Cogs are out of the Dial. I took them out. Dawn has gone to the wood, Noon under the glass, Dusk to the mountain. They are to stay there.',
    'Do not look for them. Do not come up the Spire. Mind the shop. Be kind to Tick.', 'I am sorry about the dusk. It was the best I could do. — O.');
  await say(g, '', 'He stopped the Dial himself. Oren, who would not let a clock in the shop run four seconds slow.', 'There is a page torn from his journal under the bench. There may be others. And there are three Cogs to find, whatever he says.');
  g.setFlag('read_note');
}

/* The Spire door. */
export async function spireDoor(g) {
  const n = cogs(g);
  if (g.flag('killed_oren')) return ending(g);
  if (!g.flag('read_note')) return say(g, '', 'A door of black iron, three times your height. It has no handle. Three round sockets sit cold and empty in its face.');
  if (n < 3 && !g.flag('gate_open')) return say(g, '', `Three sockets in the black door: one edged with gold, one with glass, one with iron. You hold ${n} of the three Cogs.`);
  if (!g.flag('gate_open')) {
    await say(g, '', 'You set the Cogs in their sockets. Dawn. Noon. Dusk. They turn a quarter turn by themselves and the door breathes inward.',
      'Stairs. A great many stairs. Somewhere far above, a ring is ticking that is not yours.');
    g.setFlag('gate_open');
  }
  await say(g, 'Oren', "That's far enough.", "You found them. Of course you found them. I trained you to find the fault in anything.",
    "I can't let you start it. I know how that sounds. Go home. Please. It can be dusk forever. People will get used to dusk.");
  const c = await g.ui.choose('Oren', 'Put the ring down, apprentice.', ['Raise the Pivot', 'Not yet']);
  if (c === 0) g.fightSpecial('oren', 0, -36);
}

export async function afterOren(g) {
  await say(g, 'Oren', "Enough. Enough. You always were quicker than me. I just had longer arms.", 'You want to know why. Look up. Not at the Dial. At the crown of the Spire. The scaffold.');
  await say(g, '', 'You look up.', 'High above, where the rotten boards have given way, someone is falling. They hang in the amber air a hand\'s width above the stones, perfectly still.',
    'They are wearing your coat.');
  await say(g, 'Oren', "It was the last minute of dusk. I heard the boards go. I had the three keys in my pocket and I did not think.", "What stands here talking to me is the part of you I could carry down. A shadow with a ring in its hand. The rest of you is up there, one heartbeat from the ground.",
    "If the Spark moves, that heartbeat happens. So I stopped it. I stopped everything. And I would do it again, and I am sorry, and I would do it again.");
  return ending(g);
}

async function ending(g) {
  const n = count(g.S.minutes);
  const c = await g.ui.choose('', `The Dial waits. In your pocket, ${n} loose minute${n === 1 ? '' : 's'}.`, ['Start the Dial', 'Leave the hour stopped', 'Not yet']);
  if (c === 2) return;
  if (c === 1) {
    await g.ui.crawl(['You put the ring in his hand and close his fingers around it.', 'It is dusk in Meridian. It will always be dusk in Meridian.', 'The orchards hold their apples. The birds hold their places in the air. In the fields, the hollow things keep getting up.',
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
