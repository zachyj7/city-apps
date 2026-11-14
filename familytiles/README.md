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
  (♣ black club, ♥ red heart, ♠ blue spade, ◆ orange diamond, drawn solid with a fine dark edge). The two jokers in each set show a photo each (`www/img/joker.jpg` and `joker2.jpg`) with JOKER under it. **A− / A+** makes everything bigger or smaller.
- Each player's rack is a wedge rack with their name pressed into the edge, in the color they pick
  (yellow, red, blue, green, pink, purple, black or white).
- The rack has 3 rows of slots, and each tile stands in a groove. Tiles stay where you put them, so you can
  leave gaps. Drag a tile onto another and that one slides aside; or tap a tile, then tap an empty slot
  (with several tiles chosen, tapping an empty spot lets go of them instead: a group is moved by dragging).
  Pressing the same sort button twice undoes the sort.
- With a mouse, drag a box over tiles (starting on an empty part of the table or rack) to choose several at once;
  hold Shift (or Ctrl/Cmd) to add to the tiles already chosen. A group moves together and keeps its order.
- The table works like the rack: put tiles anywhere. Tiles side by side make a set and a space separates sets,
  like words in a sentence. Everyone sees the same layout. At the end of each turn the sets are put in order and packed up
  tidily, in reading order, one space apart.
- **Fit** (with the turn buttons) zooms the table out so every row is on screen at once, with a spare row to
  play into. Tiles go down as usual; at the end of the turn the table is tidied and goes back to its normal size.
- Settings has a volume slider for each person, plus text size, color shapes and game sounds.
- Every menu (join, waiting room, results, settings) fits on one screen without scrolling, on phones and computers.
- Whose turn it is shows as a flag and glowing frame on that player's face, and in the browser tab's title.
  Each face also shows how many tiles they hold and the backs of those tiles, laid out where that player has them on their rack
  (only which slots are filled is shared, never which tiles), and whether they have made their first 30.
- Split a run on the table and play your own tile into one of the halves, and everyone sees a signed **MJ!**
- When someone gets down to 3 tiles (or fewer), and again at their last tile, everyone sees a notice in that
  player's rack color.
- **Helper sign-in** (bottom of Settings): the helper can look at another player's screen to sort out a technical problem. The tiles in that
  player's hand are blanked, and they see a notice with a **Stop** button the whole time. It shows the game
  page only, not the rest of their device (`js/help.js`). The helper can also lock the Statistics and coach page
  for the whole table (and open it again); the referee checks the sign-in before it changes.
- **Statistics and coach** (top of Settings, open to everyone unless the helper has locked it): a coach, then each player's turns, tiles played, draws
  and biggest play. The coach plays back, step by step, the best play for your last turn once it is over (starting from
  your rack as you had it, rows and all; the arrows, dots or arrow keys go back and forth between steps), and
  **Can I go out?** answers yes or no. **Always show the best play** (off until switched on) puts a card
  with the best play up during every turn, and marks that player as a **cheater** to everyone until they
  have played a whole turn with it switched off. The best play is searched for in your own browser for up to
  a few seconds (`js/stats.js`, `bestPlay` in `js/ai.js`).

## Rules

- Everyone starts with 14 tiles. On your turn, put down sets or draw one tile.
- A set is 3+ numbers in a row in one color (a run), or 3–4 of the same number in different colors (a group).
  Jokers stand in for any tile.
- Your first play must add up to 30 points or more, using only your own tiles.
- After that you can rearrange anything on the table, as long as every set is valid when you press Done.
- First to empty their rack wins. There are no points: only wins are counted. If the tiles run out and
  everyone passes, the game ends with no winner.
- Tiles on the table sit wherever you put them. Tiles close together are one set; leave a gap to keep sets
  apart (or put the dotted **Space** tile, in the bottom-right corner of your rack, down like any tile: it leaves a gap
  where it goes, in a set on the table or a slot on the rack, and goes back to its corner).

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
