/* Daily-run rules, saved progress, and the data layer.
   Everything here is local to the device for now. CA.net and CA.services are the two seams
   that get swapped for the real backend, ad network and store billing (see docs/NEXT-STEPS.md). */
(() => {
'use strict';
const CA = window.CA, C = CA.config, KEY = 'cityapps-v1';

const blank = () => ({
  v: 1,
  me: {id: 'u' + Math.random().toString(36).slice(2, 10), name: ''},
  tokens: C.starterTokens, sound: true,
  day: '', today: null,
  history: {}                // history[gameId][day] = official time that day
});
const freshDay = () => ({runs: {}, retryUsed: false});

let S = blank();
try {
  const p = JSON.parse(localStorage.getItem(KEY));
  if (p && p.v === 1 && p.me && p.me.id) S = Object.assign(blank(), p);
} catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

function rollover() {
  const d = CA.dayKey();
  if (S.day === d && S.today) return false;
  S.day = d; S.today = freshDay(); save();
  return true;
}
rollover();
/* A run that was in progress when the app closed counts as not finished. */
for (const id in S.today.runs) if (S.today.runs[id].status === 'live') S.today.runs[id].status = 'dnf';
save();
CA.sfx.on = S.sound !== false;

const hist = g => S.history[g] || (S.history[g] = {});
const store = CA.store = {
  get s() { return S; },
  save, rollover,
  run: g => S.today.runs[g] || {status: 'none'},
  canRun: g => store.run(g).status === 'none',
  /* One retry a day, shared across the five games. The gauntlet never gets one. */
  canRetry: g => g !== 'gauntlet' && !S.today.retryUsed && ['done', 'dnf'].includes(store.run(g).status),
  best: g => { const v = Object.values(S.history[g] || {}); return v.length ? Math.min(...v) : null; },
  begin(g, kind) {
    if (kind === 'retry') { S.today.retryUsed = true; delete hist(g)[S.day]; }
    S.today.runs[g] = {status: 'live', retried: kind === 'retry'};
    save();
  },
  finish(g, time, splits) {
    const prev = store.best(g), r = S.today.runs[g] || {};
    S.today.runs[g] = {status: 'done', time, splits, retried: !!r.retried};
    hist(g)[S.day] = time;
    save();
    return {prev, isBest: prev == null || time < prev};
  },
  abandon(g) { const r = S.today.runs[g]; if (r && r.status === 'live') { r.status = 'dnf'; save(); } },
  spend(n) { if (S.tokens < n) return false; S.tokens -= n; save(); return true; },
  grant(n) { S.tokens += n; save(); },
  setName(n) { S.me.name = n; save(); },
  setSound(on) { S.sound = on; CA.sfx.on = on; save(); }
};

/* ---------- rank tiers ----------
   par = a solid clean run. Breakpoints are multiples of par. These pars are first guesses;
   once real times exist they should be set from the actual averages. */
const TIERS = [['legend', 'Legend', 0.8], ['diamond', 'Diamond', 1], ['gold', 'Gold', 1.3], ['silver', 'Silver', 1.7], ['bronze', 'Bronze', Infinity]];
CA.par = g => g === 'gauntlet' ? CA.games.reduce((a, x) => a + x.par, 0) : CA.games.find(x => x.id === g).par;
CA.tier = (g, t) => { const p = CA.par(g), r = TIERS.find(x => t <= p * x[2]); return {key: r[0], name: r[1]}; };
CA.tierCuts = g => TIERS.map(x => ({key: x[0], name: x[1], under: CA.par(g) * x[2]}));   // fastest tier first
CA.tierOrder = TIERS.map(x => ({key: x[0], name: x[1]}));

/* ---------- data layer (local + demo players) ---------- */
const NAMES = 'Maya,Jordan,Leo,Ava,Noah,Zoe,Eli,Mia,Kai,Ivy,Owen,Ruby,Finn,Lena,Theo,Nora,Jude,Isla,Max,Elle,Remy,Tess,Cole,Wren,Dane,Faye,Reid,Skye,Beau,June,Nico,Cleo,Seth,Vera,Troy,Gwen,Abel,Dara,Zane,Lux'.split(',');
const demo = !C.demo ? [] : NAMES.map((n, i) => {
  const r = CA.rng(CA.hash('player' + i));
  return {id: 'd' + i, name: n + ' ' + String.fromCharCode(65 + Math.floor(r() * 26)) + '.', skill: 0.82 + r() * 1.0, friend: i < 8};
});
/* day = a day key for that day's time, or 'best' for the all-time best */
function demoTime(p, g, day) {
  const best = day === 'best', r = CA.rng(CA.hash(p.id + g + (best ? '' : day)));
  if (r() < (best ? 0.08 : 0.25)) return null;
  return Math.round(CA.par(g) * p.skill * (best ? 0.93 : 0.97 + r() * 0.22) * 100) / 100;
}
/* The last n days, oldest first, ending today. */
CA.lastDays = n => {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    out.push({key: CA.dayKey(d), label: i === 0 ? 'Today' : d.toLocaleDateString(undefined, {weekday: 'short'})});
  }
  return out;
};
const myTime = (g, period) => period === 'today' ? (store.run(g).status === 'done' ? store.run(g).time : null) : store.best(g);
const allIds = () => ['gauntlet'].concat(CA.games.map(g => g.id));

CA.net = {
  /* scope: 'friends' | 'global'.  period: 'today' | 'best'.  Returns rows fastest first. */
  board(g, scope, period) {
    const rows = demo.filter(p => scope !== 'friends' || p.friend)
      .map(p => ({id: p.id, name: p.name, time: demoTime(p, g, period === 'today' ? S.day : 'best')}));
    rows.push({id: S.me.id, name: S.me.name || 'You', time: myTime(g, period), me: true});
    return rows.filter(r => r.time != null).sort((a, b) => a.time - b.time);
  },
  profile(pid) {
    const mine = pid === S.me.id, p = mine ? {id: S.me.id, name: S.me.name || 'You'} : demo.find(x => x.id === pid);
    if (!p) return null;
    /* days: the previous 6 days plus today. series[g][i] is the official time on days[i], or null. */
    const days = CA.lastDays(7), out = {id: p.id, name: p.name, mine, friend: !!p.friend, days, best: {}, series: {}};
    allIds().forEach(g => {
      out.best[g] = mine ? myTime(g, 'best') : demoTime(p, g, 'best');
      out.series[g] = days.map(d => {
        const t = mine ? (S.history[g] || {})[d.key] : demoTime(p, g, d.key);
        return t == null ? null : t;
      });
    });
    return out;
  }
};

/* ---------- ads and purchases ----------
   Test mode: both succeed instantly with no ad and no charge.
   Production: swap in AdMob rewarded ads and RevenueCat purchases here. */
CA.services = {
  rewardedAd: () => Promise.resolve(!!C.testMode),
  buy: pack => Promise.resolve(!!C.testMode)
};
})();
