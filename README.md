# City Apps

Lightweight mobile games that are simple, challenging and polished. Every game is about doing something as fast as possible.

## Games

| Game | Folder | What you do |
| --- | --- | --- |
| Pivot | [`pivot/`](pivot/) | Tap when the dot is inside the zone. Clear 10 levels against the clock. |

## How the repo is laid out

- `index.html` is the studio home page. It links to every game.
- Each game lives in its own folder with an `index.html` (for example `pivot/index.html`).
- Games are plain HTML, CSS and JavaScript with no build step. Open the file in a browser to play.

## What makes a City Apps game

- **Ten levels.** Every game has exactly 10 levels, and the tenth is hard but fair.
- **Speed is the score.** The clock is the main number on screen, and beating your best time is the goal.
- **One simple input.** Playable with one thumb, understood in a few seconds.
- **Learnable.** Levels are the same every run, so practice pays off.
- **Lightweight.** A single self-contained file per game, quick to load, saves progress on the device.
- **Polished.** Sound, haptics, light and dark mode, reduced-motion support, safe-area padding.

## Adding a game

1. Make a new folder named after the game, with an `index.html` inside.
2. Use a unique save key in `localStorage` (Pivot uses `pivot-save-v3`).
3. Add the game to the list in the root `index.html` and to the table above.
