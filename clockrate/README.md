# Clock Rate

Clock Rate is a City Apps game: five speedrun skill games in one app. One official run per game per day, one retry a day, and a gauntlet that runs all five back to back. The point is who is fastest among your friends.

**Status: prototype.** Everything runs on one device. Other players are demo data, and ads and purchases are switched off. See [docs/NEXT-STEPS.md](docs/NEXT-STEPS.md) for what it takes to launch.

## Try it

```bash
python -m http.server 8124 --directory www
```

Then open http://localhost:8124 in a browser (phone-sized window recommended).

## Games

| Game | Skill | What you do |
| --- | --- | --- |
| Pivot | Timing | Tap when the dot is inside the zone. |
| Count | Search | Tap the numbers in order. |
| Recall | Memory | Memorize the lit tiles, then tap them back. |
| Hop | Touch | Hold to charge a jump, let go to land on the next platform. Long jumps can skip one. |
| Slide | Route finding | Swipe to slide the dot until it hits something. Stop it on the ring. |

## Rules

- Every game has exactly **10 levels**. Level 10 is hard but fair.
- **Courses never change.** Every level of every game is identical on every run, so players can learn and optimize a route. Nothing is randomized.
- **One official run** per game per day. The clock starts on the first tap and does not pause.
- **One retry** per day, for any one game. The new time replaces the old one, faster or slower.
- **The Gauntlet**: all five back to back, once a day, no retries. The clock never stops between games. It does not use up the single-game runs.
- **Practice runs** cost tokens (1 per game, 2 for the gauntlet). Tokens come from purchases or watching an ad. Practice times stay off the leaderboard.
- Mistakes cost time, never the run.
- Rank tiers (Bronze to Legend) come from time cut-offs per game.

## Layout

- `www/index.html`, `www/app.css` — the app page and styles
- `www/js/core.js` — settings (`testMode`, `demo`, token prices), helpers, sound
- `www/js/store.js` — daily-run rules, saved data, leaderboard data, ads and purchase hooks
- `www/js/app.js` — screens: home, game page, the run, results, profiles
- `www/js/games/` — one file per game
- `capacitor.config.json`, `package.json` — wrapper config for the iOS and Android builds (not yet run)

## Adding a game

Copy a file in `www/js/games/`, give it a new `id`, and add a `<script>` tag in `www/index.html`. The comment at the top of `pivot.js` describes the shape. Keep it to 10 levels, build every level from `env.rng(level)` so it is the same on every run, and make mistakes cost time.
