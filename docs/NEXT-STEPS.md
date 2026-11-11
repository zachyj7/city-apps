# City Apps: from prototype to the stores

Where things stand: the app in `www/` is a working prototype. All five games, the daily run rules, the retry, practice tokens, the gauntlet, leaderboards, profiles and comparison all work, but everything is saved on the one device. Other players are demo data, and ads and purchases are switched off (`testMode` and `demo` in `www/js/core.js`).

To make it real, four things have to be added: an online backend, the store wrappers, payments, and ads. Steps marked **You** need you personally (accounts, money, legal). Steps marked **Build** are code work.

## 1. Decisions to make first (You)

1. **App name.** "City Apps" is the studio. The app itself needs a name that is free on both stores.
2. **Who publishes.** To show "City Apps" as the seller you need a registered business (an LLC is typical) and a free D-U-N-S number. Without one, both stores list your personal legal name.
3. **Minimum age.** This is the big one. The app is aimed at students, which means some players will be under 13.
   - Under-13 players trigger COPPA in the US (and similar laws elsewhere): parental consent for accounts, no personalized ads, strict limits on collecting data.
   - The simplest path is to make the app 13+ with an age check at sign-up, use non-personalized ads only, and not collect location.
   - Talk to a lawyer before launch. I can build whatever they tell you is needed, but I can't give legal advice.
4. **"People around you."** Do this with school or group codes that players join, not GPS. Location data from minors is a legal and store-review problem.
5. **Token prices.** Placeholders are 5 for $0.99, 15 for $1.99, 40 for $3.99. A gauntlet practice costs 2 tokens, a single game 1.

## 2. Accounts to open (You)

| Account | Cost | Why |
| --- | --- | --- |
| Apple Developer Program | $99 a year | Required to publish on the App Store |
| Google Play Console | $25 once | Required to publish on Google Play |
| Supabase (or Firebase) | Free to start | Accounts, times, leaderboards, friends |
| RevenueCat | Free until about $2,500 a month in revenue | One purchase system for iOS, Android and web |
| Google AdMob | Free | Rewarded ads ("watch an ad for a practice run") |
| Stripe | Per-transaction fee | Token purchases on the web version |
| A domain name | About $12 a year | Web version, privacy policy, support page |
| Web hosting (Cloudflare Pages, Netlify or Vercel) | Free to start | Hosts the web version |

Notes:
- Google makes new personal developer accounts run a closed test with at least 12 testers for 14 days before going public. Start this early. Check the current number in Play Console, since Google has changed it before.
- Apple takes 30% of purchases, or 15% if you enrol in the App Store Small Business Program (do this). Google takes 15% on the first $1M a year.
- **You are on Windows. iPhone apps can only be built on a Mac.** Options: borrow or buy a Mac, or use a cloud build service (Codemagic and Ionic Appflow both build Capacitor apps without a Mac). Android builds work on Windows with Android Studio.

## 3. Online backend (Build, after you create the Supabase project)

What it has to do:
- **Sign-in.** "Continue with Apple" and "Continue with Google", plus play-as-guest that can be upgraded later. Apple requires the Apple option whenever Google sign-in is offered. One account works on iOS, Android and web, with the same stats.
- **Runs.** The server, not the phone, decides whether you still have today's run, your retry, and your gauntlet run. Otherwise changing the phone's clock gives unlimited runs.
- **Times.** Leaderboard times are checked on the server. Right now the time comes straight from the device, which is easy to fake. At minimum the server should issue the run and reject impossible times.
- **Leaderboards.** Per game and gauntlet, today and all-time, friends, group and global.
- **Friends and groups.** Friend codes, share links, school or group codes.
- **Tiers from real data.** The tier cut-offs are currently my guesses (`par` in each game file). Once there are real times, set them from actual percentiles.
- **Names.** A filter for offensive display names, and a way to report one.

The app already has the seams for this: `CA.net` (leaderboards and profiles) and `CA.store` (run rules) in `www/js/store.js`.

## 4. App Store and Google Play builds (Build + You)

The app is wrapped with Capacitor, which packages the same `www/` folder as a native app. `package.json` and `capacitor.config.json` are in place but not yet run.

1. You: decide the app id (currently the placeholder `com.cityapps.daily`). It can't be changed after release.
2. Build: `npm install`, then add the Android and iOS projects.
3. You: install Android Studio (Windows is fine). For iOS, a Mac or a cloud build service.
4. You: app icon, screenshots, store description, privacy policy URL, support URL, age rating questionnaire, and the data-safety forms on both stores.
5. Both stores review the app. Allow one to three days each, more if rejected.

## 5. Monetization (Build + You)

- **Token purchases.** RevenueCat on top of Apple and Google billing, Stripe on the web. You create three consumable products (5, 15, 40 tokens) in App Store Connect and Play Console and the matching ones in RevenueCat. Tokens are stored on the account so they follow the player across devices.
- **Rewarded ads.** AdMob, mobile apps only to start. Web rewarded ads need a separate Google program with traffic requirements, so the web version would launch with purchases only.
- Both plug in at `CA.services` in `www/js/store.js`.
- You: tax and bank details in App Store Connect, Play Console and AdMob. Nothing pays out until these are done.
- Keeping it low-key is fine and is how it's built: purchases only appear when someone asks for a practice run without tokens, or opens their own profile. The stores do require the price to be clear at the moment of purchase, which their own payment sheet handles.

## 6. Before launch

- Playtest on real phones with real people. Every game's difficulty and every tier cut-off is untested by human hands.
- Decide the daily reset time. Right now it's the phone's local midnight. For a fair global board, the server should own it.
- Thread is easier with a mouse than a finger. Decide whether web and mobile share a board for that game.

## Suggested order

1. You: pick the app name, age policy and publisher (section 1), and open the Apple, Google and Supabase accounts.
2. Build: backend and sign-in, with real leaderboards and friends.
3. Build: Android build, then start Google's closed test.
4. Build: purchases and ads.
5. You + Build: iOS build, store listings, review, launch.
