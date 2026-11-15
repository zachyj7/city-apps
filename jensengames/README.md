# Jensen Games

Family game night online for up to 8 people, with everyone's face around the table. Three games:
**Number Tiles** (tile rummy), **Blackjack** against a computer dealer, and **Color Clash** (a match-the-color
card game where +2s and +4s stack).

## The lobby

- Everyone opens the same link (or types the same lobby name) and joins the lobby. The page used to be called
  Family Tiles; the old address (`/familytiles/`) sends people to the new one.
- Each player has their own color, picked on the join screen and changeable in the lobby. Two people can't have
  the same color: taken colors are greyed out with the owner's initial, and if yours was taken when you joined
  you get the next free one (with a message saying so). Your color frames your face, your seat and your spot
  at the table in every game.
- The first person in is the **host** (crown). Only the host picks the game, changes its settings, adds or
  removes computer players and starts it. The host can hand the crown to someone else (crown button on their
  name); if the host leaves, the next person still here takes over.
- After picking a game the lobby shows that game's settings (everyone sees them; only the host can change them).
  **Change** goes back to the list of games.
- **End this game** (host only, in Settings, tap twice) stops the game for everyone. After any game,
  **Back to the lobby** returns to the same game's settings.
- Computer players (**Easy**, **Medium**, **Hard**) can play every game. The host's browser plays their turns.
- Wins are counted per game and shown with a trophy by each face.

## Blackjack

- Pretend money only. Everyone starts with the host's chosen amount ($500, $1,000 or $5,000).
- Each hand: tap chips to build your bet (the first chip starts a new amount; the circle arrow goes back to the
  smallest bet), then **Bet**. When everyone has bet (or sat out), the cards are dealt. The host can **Deal now**
  without waiting for slow deciders.
- **Hit**, **Stand**, **Double** (on your first two cards) and **Split** (a pair, up to four hands; split aces get
  one card each). 21 stands by itself.
- The computer dealer peeks for blackjack under an ace or a ten, then draws to 17 (standing or hitting on a soft
  17, as the host chose). Blackjack pays 3 to 2 (or 6 to 5). No insurance or surrender.
- Out of money? **Free buy-back** puts you back at the starting amount, as often as you like. Buy-backs are
  counted, and the final standings (when the host ends the game) count them against you: the winner is whoever
  is furthest up.
- Settings: starting money, smallest bet, decks in the shoe (1, 2 or 6; reshuffled at the last quarter),
  dealer on soft 17, blackjack pays.
- Computers: Easy goes on a hunch, Medium plays like the dealer, Hard follows basic strategy.

## Color Clash

- 108 cards: in red (heart), yellow (sun), green (leaf) and blue (drop), one 0, two each of 1–9, Skip, Reverse
  and +2; plus four Wild and four Wild +4. Each color has its own shape so it doesn't rely on color alone.
- Play a card that matches the color or the number/symbol on the pile, or a Wild (then pick the new color).
  Cards you can play stand up in your hand; tap one to play it. Can't (or don't want to) play? **Draw**: if the
  card you drew can be played you can play it or **Keep it**. (Host setting: draw one, or draw until you can play.)
- **Stacking**: a +4 can go on a +4 or on a +2, and the total keeps growing (+2, +4, +8, ...). A +2 on a +2 is
  allowed too unless the host turns it off. The first player who can't (or won't) add to it presses **Take** and
  picks up the whole stack, and their turn is over.
- Reverse with two players works like Skip. First to play their last card wins; everyone sees a notice when
  someone is down to one card.
- Settings: cards to start (5, 7 or 10), +2 on a +2, draw one or draw until you can play.

## Number Tiles

- Computer players (added by the host in the lobby): **Easy** (learning the game), **Medium** (a solid player) or **Hard**
  (rearranges the table, splits runs, borrows tiles). Mix and match up to 8 players, or play alone against them.
  The host's browser runs their turns (`js/ai.js`).
- **Leave** (in Settings or the lobby) takes you back to the start so you can join again; your seat
  is kept during a game. **Close table for everyone** sends everyone back and clears the game.
- **Camera on** uses the front camera on phones and the webcam on computers. Faces stay on screen all game.
- 2–4 players use one set of 106 tiles; 5–8 players use two sets (the host can also choose one or two sets).
- Big, high-contrast tiles in the Atkinson Hyperlegible font, with a shape on every tile for each color
  (♣ black club, ♥ red heart, ♠ blue spade, ◆ orange diamond, drawn solid with a fine dark edge). The two jokers in each set show a photo each (`www/img/joker.jpg` and `joker2.jpg`) with JOKER under it. **A− / A+** makes everything bigger or smaller.
- Each player's rack is a wedge rack with their name pressed into the edge, in their color
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
- **Done** and **Draw** sit under the rack. **Undo**, **Reset** and **Fit** are on the rack's edge, to the right of
  the Sort buttons, with a slider between them that makes the tiles on your rack bigger or smaller (remembered on
  this device; bigger tiles mean fewer slots across).
- **Fit** zooms the table out so every row is on screen at once, with a spare row to
  play into. Tiles go down as usual. It stays on (on this device) until you press it again.
- **Live table**: while someone plays, everyone sees their moves as they happen, including the tiles they are
  carrying over the table and the faded spots tiles were lifted from. Tiles carried around their own rack stay private.
- **Drew a tile**: when anyone draws (or has to pass with nothing left to draw), a quick pop-up in their rack
  colour tells everyone.
- **Who played what**: tiles going down are outlined in the player's rack colour, with their name across the
  bottom of their tiles. It stays for a few seconds after the turn ends, then fades away.
- **Sort 1-2-3 / Sort colors** line the tiles up and centre each row on the rack.
- Settings has a volume slider for each person, plus text size, color shapes and game sounds.
- Every menu fits on one screen on computers; on phones the lobby scrolls when a game with several settings is picked.
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
  with the best play up during every turn, and marks that player as a **cheater** to everyone while it is
  on (the mark comes off as soon as it is switched off). The end-of-game screen shows how many times each player
  switched it on. The best play is searched for in your own browser for up to
  a few seconds (`js/stats.js`, `bestPlay` in `js/ai.js`).

### Rules

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
hosts the referee in their browser (`js/room.js`; Blackjack is `js/bj.js`, Color Clash `js/uno.js`, and what they
look like is `js/cardview.js` and `games.css`; the game list and settings are `js/games.js`). Every change is sent to everyone as a full snapshot, so if the
host leaves or reloads, someone else takes over without losing the game. Video is a direct two-way call
between every pair of players (`js/video.js`).

Some home or phone networks block direct connections. Without a relay (TURN) server, a player on such a
network may not be able to connect or may not see video.

## Test locally

    python jensengames/scripts/serve.py      # http://localhost:8151

Open two tabs with the same `?room=` code. Add `&fakecam` to use a moving test picture instead of a real
camera. `window.JG` holds the game state for poking at from the console.

Saved settings on each device start with `jg-`; ones saved by Family Tiles (`ft-`) are copied over the first time.
