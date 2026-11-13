# Big Money

A third-person online casino you walk around in. Play money only.

- **Slots** – 20 machines, five bet sizes.
- **Blackjack** – two tables ($10 and $100 minimum), five seats each, shared with whoever else is in the room.
- **Texas Hold'em** – two no-limit tables ($5/$10 and $50/$100). House players fill empty seats and leave as friends sit down.
- **Bar** – drinks with timed perks, champagne confetti, a round for the house.
- **Style Shop** – outfits, hats, eyewear, chains, capes and wings that other players see.
- **Quickscope Range** – first-person bolt-action rifle, pop-up targets, 45-second scored rounds that pay out.
- **Fishing** – cast, hook, fight the line. A 20-node upgrade tree at the tackle stall and a 16-fish log.
- **Cashier** – daily bonus, and a comp if you go broke.

## Run it

```
python bigmoney/scripts/serve.py
```

Then open http://localhost:8141. Controls: WASD or the on-screen stick to move, drag to look, **E** or the gold button to use things, **Enter** to chat.

## Playing together

Type the same room name on the title screen (or share the link in the ☰ menu). There is no game server: players find each
other through the public PeerJS broker and the first one in hosts the table logic (`js/room.js`) in their browser. If the host
leaves, someone else takes over; chips still on a table go back to their owners. With no internet you get a private room.

Money, clothes, upgrades and the fish log are saved in the browser (`localStorage`), per device.

## Models

Everything 3D is built in Blender by `blender/build_assets.py`:

```
blender --background --python bigmoney/blender/build_assets.py
```

It writes `www/assets/casino.glb` (the building), `www/assets/props.glb` (avatar parts, clothes, rifle, rod, fish, targets),
`www/assets/layout.json` (walls, seats, machines, spawn points) and `blender/bigmoney.blend` to open and edit by hand.
Re-run it after changing the script; the game picks up the new files on refresh.

## Code map

| File | What it does |
| --- | --- |
| `js/main.js` | boot, input, camera, multiplayer sync, chat |
| `js/room.js`, `js/cards.js` | the referee: blackjack and poker rules, house players (runs in Node too) |
| `js/net.js` | peer-to-peer rooms and host hand-over |
| `js/world.js`, `js/avatar.js` | loading the Blender exports, collisions, people |
| `js/tables.js`, `js/slots.js`, `js/bar.js` | table UI, slots, bar / shop / cashier / menu |
| `js/range.js`, `js/fishing.js` | the range and the pond |
| `js/state.js` | save data and the catalogues (clothes, upgrades, fish) |
