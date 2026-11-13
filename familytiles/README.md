# Family Tiles

Number-tile rummy for up to 8 people online, with everyone's face around the table.

- Everyone opens the same link (or types the same table name) and joins one table.
- **Camera on** uses the front camera on phones and the webcam on computers. Faces stay on screen all game.
- 2–4 players use one set of 106 tiles; 5–8 players use two sets.
- Big, high-contrast tiles in the Atkinson Hyperlegible font, with a shape on every tile for each color
  (■ black, ● red, ▲ blue, ◆ orange). **A− / A+** makes everything bigger or smaller.
- Each player's rack is a wedge rack with their name pressed into the edge, in the color they pick
  (yellow, red, blue, green, pink, purple, black or white).
- The rack has 3 rows of slots, and each tile stands in a groove. Tiles stay where you put them, so you can
  leave gaps. Drag a tile onto another and that one slides aside; or tap a tile, then tap an empty slot.
  Pressing the same sort button twice undoes the sort.
- Whose turn it is shows as a big bar in that player's rack color, a flag and glowing frame on their face,
  and in the browser tab's title.
- Split a run on the table and play your own tile into one of the halves, and everyone sees a signed **MJ!**

## Rules

- Everyone starts with 14 tiles. On your turn, put down sets or draw one tile.
- A set is 3+ numbers in a row in one color (a run), or 3–4 of the same number in different colors (a group).
  Jokers stand in for any tile.
- Your first play must add up to 30 points or more, using only your own tiles.
- After that you can rearrange anything on the table, as long as every set is valid when you press Done.
- First to empty their rack wins and scores the points left on everyone else's racks. If the tiles run out
  and everyone passes, the lowest rack wins.

## How it works

No server of our own: the public PeerJS broker introduces the players, and the first person at a table
hosts the game in their browser (`js/room.js`). Every change is sent to everyone as a full snapshot, so if the
host leaves or reloads, someone else takes over without losing the game. Video is a direct two-way call
between every pair of players (`js/video.js`).

Some home or phone networks block direct connections. Without a relay (TURN) server, a player on such a
network may not be able to connect or may not see video.

## Test locally

    python familytiles/scripts/serve.py      # http://localhost:8151

Open two tabs with the same `?room=` code. Add `&fakecam` to use a moving test picture instead of a real
camera. `window.FT` holds the game state for poking at from the console.
