# Family Tiles

Number-tile rummy for up to 8 people online, with everyone's face around the table.

- Everyone opens the same link (or types the same table name) and joins one table.
- Add computer players in the waiting room: **Easy** (learning the game), **Medium** (a solid player) or **Hard**
  (rearranges the table, splits runs, borrows tiles). Mix and match up to 8 players, or play alone against them.
  The host's browser runs their turns (`js/ai.js`).
- **Leave table** (in Settings or the waiting room) takes you back to the start so you can join again; your seat
  is kept during a game. **Close table for everyone** sends everyone back and clears the game.
- **Camera on** uses the front camera on phones and the webcam on computers. Faces stay on screen all game.
- 2–4 players use one set of 106 tiles; 5–8 players use two sets.
- Big, high-contrast tiles in the Atkinson Hyperlegible font, with a shape on every tile for each color
  (■ black, ● red, ▲ blue, ◆ orange). **A− / A+** makes everything bigger or smaller.
- Each player's rack is a wedge rack with their name pressed into the edge, in the color they pick
  (yellow, red, blue, green, pink, purple, black or white).
- The rack has 3 rows of slots, and each tile stands in a groove. Tiles stay where you put them, so you can
  leave gaps. Drag a tile onto another and that one slides aside; or tap a tile, then tap an empty slot.
  Pressing the same sort button twice undoes the sort.
- The table works like the rack: put tiles anywhere. Tiles side by side make a set and a space separates sets,
  like words in a sentence. Everyone sees the same layout; finished sets are put in order at the end of a turn.
- Settings has a volume slider for each person, plus text size, color shapes and game sounds.
- Every menu (join, waiting room, results, settings) fits on one screen without scrolling, on phones and computers.
- Whose turn it is shows as a flag and glowing frame on that player's face, and in the browser tab's title.
  Each face also shows the backs of the tiles they hold and whether they have made their first 30.
- Split a run on the table and play your own tile into one of the halves, and everyone sees a signed **MJ!**

## Rules

- Everyone starts with 14 tiles. On your turn, put down sets or draw one tile.
- A set is 3+ numbers in a row in one color (a run), or 3–4 of the same number in different colors (a group).
  Jokers stand in for any tile.
- Your first play must add up to 30 points or more, using only your own tiles.
- After that you can rearrange anything on the table, as long as every set is valid when you press Done.
- First to empty their rack wins. There are no points: only wins are counted. If the tiles run out and
  everyone passes, the game ends with no winner.
- Tiles on the table sit wherever you put them. Tiles close together are one set; leave a gap to keep sets
  apart (or choose a tile and press Space to open a gap before it).

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
