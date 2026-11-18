# Jensen Games

Family game night online for up to 8 people, with everyone's face around the table. Nine games:
**Number Tiles** (tile rummy), **Blackjack** against a computer dealer, **Color Clash** (a match-the-color
card game where +2s and +4s stack), **Idiot**, **Hearts**, **Dominoes** (Mexican Train rules), and three two-player
board games: **Chess**, **Checkers** and **Mancala**.

## The lobby

- **Who's playing?** Everyone picks their own name from the list (Audrey, Gabe, Josh, Matt, Nina, Shiloh, Zach).
  You can also play as a different name for the day; your stats are still saved under your own name, and the
  lobby shows it in brackets.
- **Open lobbies** are listed on the start screen (tap one to join it). The browser running a lobby posts a
  short notice on a free public MQTT broker (`js/lobbies.js`): only the lobby name, the game and how many people
  are in it, never names or faces. Anyone who knows where to look could see it, so the host can switch off
  **Show this lobby on the start screen** in the lobby. The notice is cleared when the lobby closes.
- Everyone opens the same link (or types the same lobby name) and joins the lobby. The page used to be called
  Family Tiles; the old address (`/familytiles/`) sends people to the new one.
- Each player has their own color, picked on the join screen and changeable in the lobby. Two people can't have
  the same color: taken colors are greyed out with the owner's initial, and if yours was taken when you joined
  you get the next free one (with a message saying so). Your color frames your face, your seat and your spot
  at the table in every game.
- The first person in is the **host** (crown). Only the host picks the game, changes its settings, adds or
  removes computer players and starts it. The host can hand the crown to someone else (crown button on their
  name); if the host leaves, the next person still here takes over.
- The host puts the lobby in order by dragging people (with a mouse, anywhere on their card; on a touch screen,
  by the grip on its left). The numbers are Player 1, 2, 3...: the order of play, and in the two-player board
  games Players 1 and 2 play and everyone else watches. Dragging never moves the crown.
- After picking a game the lobby shows that game's settings (everyone sees them; only the host can change them).
  **Change** goes back to the list of games.
- **End this game** (host only, in Settings, tap twice) stops the game for everyone. After any game,
  **Back to the lobby** returns to the same game's settings.
- Computer players (**Easy**, **Medium**, **Hard**) can play every game. The host's browser plays their turns.
- **Lifetime stats** (Settings, or the start screen): wins out of games played for everyone, for every game and
  rock paper scissors (plus money up or down in Blackjack). Each finished game is saved on every device at the
  table, and devices pass along records the others are missing whenever they play together (`js/lifetime.js`),
  so every device catches up. Games the host ends early don't count (except Blackjack, which always ends that way).
  The trophy by each face shows their lifetime wins at the game being played.
- Colors: eight ready-made ones, or **Custom** for any color at all.

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

## Idiot

- 2–8 players (two decks for 6 or more). Everyone gets 3 cards face down, 3 face up on top of them, and 3 in hand.
- Before play: tap a card in your hand, then one of your face-up cards, to swap them. Press **Ready**.
- Play one or more cards of the same rank (tap to choose, then **Play**), equal to or higher than the top of the
  pile; aces are high. A **2** goes on anything and anything goes on a 2. A **10**, or four of the same rank in a
  row, **burns** the pile and you go again. Draw back up to 3 while the deck lasts.
- Can't play (or don't want to)? **Pick up** the pile.
- With your hand gone, play your face-up cards; then your face-down ones, blind (tap one). A blind card that
  doesn't play means you pick up the pile and that card.
- First one out wins; the last one holding cards is the Idiot.

## Hearts

- 3 or 4 players (with 3, the 2 of diamonds is taken out and everyone gets 17 cards). Lowest score wins.
- Each hand starts by passing 3 cards: left, right, across, then keep (with three players: left, right, keep).
  Cards you were passed are outlined until the first trick.
- The 2 of clubs leads. Follow suit if you can. No hearts or queen of spades on the first trick (unless that's
  all you have), and hearts can't be led until one has been played.
- Each heart is 1 point and the queen of spades 13. Take them all (**shoot the moon**) and everyone else gets 26.
- The game ends when someone reaches 50 or 100 (host's choice).

## Dominoes

Mexican Train rules (from the RNK Gaming sheet) with the family's house rules.

- Double-twelve set. 2–8 players draw 16 tiles each (2–3 players), 15 (4), 14 (5), 12 (6), 10 (7) or 9 (8).
- Each round's engine is a double in the middle: double 12 in the first round, then 11, down to double blank
  (13 rounds; the host can choose 7, 3 or 1). Who starts moves round one seat each round.
- The middle is drawn like a real station hub: a black octagon with the engine lying in a white slot. **Your own
  train always heads straight down**, toward your tiles; everyone else's comes off the side nearest their face on
  screen; community trains take the free sides,
  and if there are more trains than sides, the extras go in between, starting a little further out. Toy trains
  and pennies sit on each train's first tile. Trains carry no colors.
- Long trains **snake**: tiles sit on a grid of half-tile squares, and near the edge of the table a train turns
  90 degrees (the matching halves side by side, making a square corner), runs across one tile, turns again and
  comes back alongside itself. Each train only winds into its own half of the gap toward its neighbour. Only when
  even that is full are the oldest tiles counted as "+n". **Fit** shrinks the tiles until every train shows whole.
- A size slider on the tray makes your own dominoes bigger or smaller (remembered on that device). Tiles you can
  play have a gold edge; the others are not dimmed.
- **One tile a turn** (or a double and the tile that covers it). Your first turn starts your own train.
- After that: on your own train, any **community train**, or another player's train only if it has a **penny**.
  Tap a tile to choose it, then tap the end of a train (or **Play**, when it fits just one place). Or **drag** a
  tile from your tray onto a train: the trains it fits light up, and once dropped it waits there until you press
  **Confirm** (or **Cancel** to take it back).
- **Your tiles sit in a tray** like the Number Tiles rack: drag them anywhere (gaps allowed; dropping on a tile
  slides it aside), and double-tap a tile (or press **Flip**) to turn it end for end, so you can lay out trains in
  your hand to plan ahead. Only you see the layout, and it stays put for the round on that device.
- **Community trains** (house rule, in place of a single Mexican Train): after your first turn you may start a new
  one with a tile that matches the engine, up to six. Each is marked with a little toy locomotive in its own color.
- Can't play? **Draw a tile**. A **penny** goes on your train only if you still can't play anywhere (or there is
  nothing left to draw); then others may play on it, until you play on it again. With the boneyard empty you **Pass**.
- **Starting someone's train** (house rule): if a player couldn't start their own train, someone else may start it
  for them with a tile matching the engine. That is their whole turn; they can't play another tile.
- **Doubles** must be covered straight away by the same player. If they can't (even after drawing), it is an
  **open double**: everyone must cover it before playing anywhere else.
- A round ends when someone plays their last tile; everyone scores the total of the tiles left in hand. If
  nobody can play and the boneyard is empty, the round ends there. Lowest total after the last round wins.
- The tiles look like a Cardinal color-dot set: pips in each number's own color and layout (1 light blue, 2 green,
  3 red, 4 brown, 5 blue, 6 yellow, 7 magenta, 8 teal, 9 purple, 10 orange, 11 maroon, 12 grey).

## Chess, Checkers and Mancala

- Two players: Players 1 and 2 in the lobby order (a computer player can take either spot). Anyone else in the
  lobby watches the board live. Each player sees the board from their own side; watchers see Player 1's side.
- Tap a piece (the ones that can move glow), then tap where it goes. **Give up** (tap twice) ends it with the
  other player winning; the host can also end it from Settings.
- **Chess**: Player 1 has white. Full rules: castling, en passant, promotion (pick the piece), check,
  checkmate, and draws by stalemate, too few pieces, 50 moves or the same position three times.
- **Checkers**: Player 1 has red and moves first. Pieces move forward diagonally, kings both ways; a piece that
  can keep jumping must, and reaching the far row makes a king (which ends the turn). Setting: must jump when
  you can (yes/no). 40 moves each with no jump is a draw.
- **Mancala** (Kalah rules): six pits a side, store on your right. Last seed in your store: go again. Last seed
  in an empty pit of yours: capture it and the pit across. When a side runs out, each side keeps its own seeds
  and the bigger store wins. Setting: 3–6 seeds per pit.
- Computers: Easy looks one move ahead with plenty of luck, Medium a few moves, Hard deeper (`chess.js`,
  `checkers.js`, `mancala.js`; the screens are in `boardview.js` and `boards.css`).

## Tap someone's face: whispers and rock paper scissors

- Tap anyone's face (their webcam) to open a little menu for them.
- **Whisper to ...** (any time, in the lobby or any game): a private message only that person sees. It pops up
  on their screen with a **Reply** button; the whisper box keeps the conversation while you are at the table.
  The referee passes it to that one person (and back to you) and keeps nothing.
- **Rock paper scissors with ...** (during any game; computers too): they get the challenge as a small card and
  can pick or say no thanks. The game carries on underneath and nobody leaves their seat. Picks stay private
  (the referee only tells the two players), and a running score is kept for each pair.

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
- **Helper sign-in** (bottom of Settings): the helper can look at another player's screen to sort out a technical problem. The tiles and
  cards in that player's hand are blanked, and they see a notice with a **Stop** button the whole time.
  The helper can also **Take control**: once the player taps **Allow**, the helper's taps, typing and scrolling
  happen on the player's own page (Settings, camera, color, the lobby and start screen). Their cards and tiles,
  the game itself, whispers and rock paper scissors, and Leave / Close for everyone / End game are always off
  limits; the player's own browser enforces this, and a ring shows each tap. The player's notice says the
  helper can't see or touch their cards or tiles, and **Stop** ends control too. It shows the game
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
