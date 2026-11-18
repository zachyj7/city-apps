/* The app shell: home, game pages, the run itself, results, leaderboards, profiles. */
(() => {
'use strict';
const CA = window.CA, C = CA.config, st = CA.store, fmt = CA.fmt;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const GAUNT = {
  id: 'gauntlet', name: 'The Gauntlet', blurb: 'All five. One clock.',
  how: 'All five games back to back. The clock never stops, not even between games, and each game starts the instant the last one ends. One run a day, no retries.'
};
const def = id => id === 'gauntlet' ? GAUNT : CA.games.find(g => g.id === id);
const ui = {screen: 'home', prev: 'home', gid: null, scope: 'friends', period: 'today', pid: null};
const ordinal = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
const tierPill = (g, t) => { const x = CA.tier(g, t); return `<span class="tier t-${x.key}">${x.name}</span>`; };

/* ---------- navigation ---------- */
function go(screen) {
  if (screen !== ui.screen) ui.prev = ui.screen;
  ui.screen = screen;
  ['home', 'game', 'profile', 'play'].forEach(s => { $('s-' + s).hidden = s !== screen; });
  if (screen === 'home') renderHome();
  if (screen === 'game') renderGame();
  if (screen === 'profile') renderProfile();
  window.scrollTo(0, 0);
}

/* ---------- leaderboard ---------- */
function boardHTML(gid, scope, period, limit) {
  let rows = CA.net.board(gid, scope, period).map((r, i) => Object.assign({rank: i + 1}, r));
  if (!rows.length) return `<p class="empty">No times ${period === 'today' ? 'yet today' : 'yet'}.</p>`;
  if (limit && rows.length > limit) {
    const me = rows.find(r => r.me);
    rows = rows.slice(0, limit);
    if (me && me.rank > limit) rows.push(me);
  }
  return '<ol class="board">' + rows.map(r =>
    `<li><button class="brow${r.me ? ' mine' : ''}" data-act="profile" data-pid="${esc(r.id)}">` +
    `<span class="rk${r.rank === 1 ? ' r1' : ''}">${r.rank}</span><span class="nm">${esc(r.name)}${r.me ? '<i>you</i>' : ''}</span>` +
    `${tierPill(gid, r.time)}<span class="tm">${fmt(r.time)}</span></button></li>`).join('') + '</ol>';
}
const tabs = (key, cur, opts) => '<div class="tabs">' + opts.map(o =>
  `<button data-act="tab" data-key="${key}" data-val="${o[0]}" aria-pressed="${cur === o[0]}">${o[1]}</button>`).join('') + '</div>';
function friendRank(gid) {
  const rows = CA.net.board(gid, 'friends', 'today'), i = rows.findIndex(r => r.me);
  return i < 0 ? '' : rows.length === 1 ? 'First on the board today' : `${ordinal(i + 1)} of ${rows.length} friends today`;
}

/* ---------- icons ---------- */
/* One small picture per game, showing what you do in it. Colors come from --c and --d on the card. */
const ICON = {
  pivot: '<circle cx="22" cy="24" r="14" fill="none" stroke="var(--c)" stroke-width="7"/><circle cx="22" cy="10" r="6" fill="var(--d)" stroke="var(--surface)" stroke-width="2.5"/>',
  count: '<circle cx="13" cy="14" r="9" fill="var(--d)"/><circle cx="32" cy="18" r="8" fill="none" stroke="var(--c)" stroke-width="3"/><circle cx="18" cy="34" r="8" fill="none" stroke="var(--c)" stroke-width="3"/>' +
    '<g font-size="11" font-weight="800" text-anchor="middle" font-family="inherit"><text x="13" y="18" fill="#fff">1</text><text x="32" y="22" fill="var(--ink)">2</text><text x="18" y="38" fill="var(--ink)">3</text></g>',
  recall: [0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => `<rect x="${4 + (i % 3) * 13}" y="${4 + Math.floor(i / 3) * 13}" width="10" height="10" rx="3" fill="${[1, 3, 8].includes(i) ? 'var(--c)' : i === 5 ? 'var(--d)' : 'var(--track)'}"/>`).join(''),
  hop: '<rect x="3" y="29" width="13" height="12" rx="3" fill="var(--c)"/><rect x="28" y="29" width="13" height="12" rx="3" fill="var(--c)"/>' +
    '<path d="M10 23Q21 0 32 17" fill="none" stroke="var(--d)" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 6"/><circle cx="34" cy="21" r="6.5" fill="var(--d)"/>',
  slide: '<rect x="35" y="8" width="6" height="28" rx="3" fill="var(--c)"/><path d="M6 22h16" stroke="var(--d)" stroke-width="6" stroke-linecap="round" opacity=".35"/><circle cx="25" cy="22" r="8" fill="var(--d)"/>'
};
const icon = id => `<svg class="ico" viewBox="0 0 44 44" aria-hidden="true">${ICON[id] || ICON.pivot}</svg>`;
/* One bar in the game color; the Gauntlet gets all five. */
const strip = id => '<span class="strip" aria-hidden="true">' + (id === 'gauntlet' ? CA.games : [def(id)]).map(g => `<i style="background:${g.arc}"></i>`).join('') + '</span>';
const tierLegend = () => '<div class="legend" aria-label="Tiers from slowest to fastest">' +
  CA.tierOrder.slice().reverse().map(t => `<b class="tier t-${t.key}">${t.name}</b>`).join('<i aria-hidden="true">›</i>') + '</div>';

/* ---------- home ---------- */
function renderHome() {
  st.rollover();
  const now = new Date(), end = new Date(now); end.setHours(24, 0, 0, 0);
  const mins = Math.max(1, Math.round((end - now) / 60000)), left = mins >= 60 ? Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm' : mins + 'm';
  const gr = st.run('gauntlet');
  const gbody = gr.status === 'done' ? `<span class="g-time tn">${fmt(gr.time)}</span><span class="g-status">${tierPill('gauntlet', gr.time)}<span>${esc(friendRank('gauntlet'))}</span></span>`
    : gr.status === 'dnf' ? '<span class="g-status">Did not finish today</span>' : '';
  const gaunt = `<div class="gaunt"><button class="g-main" data-act="open" data-gid="gauntlet">` +
    `${strip('gauntlet')}<span class="g-kicker">The Gauntlet</span><span class="g-title">All five. One clock.</span>${gbody}</button>` +
    (gr.status === 'none' ? `<button class="g-run" data-act="run" data-gid="gauntlet">Run the Gauntlet</button>` : '') + `</div>`;
  const soloDone = CA.games.map(g => st.run(g.id)).filter(r => r.status === 'done'), soloTotal = soloDone.reduce((a, r) => a + r.time, 0);
  const cards = CA.games.map(g => {
    const r = st.run(g.id);
    const stat = r.status === 'done' ? `<span class="cstat"><span class="tn">${fmt(r.time)}</span>${tierPill(g.id, r.time)}</span>`
      : r.status === 'dnf' ? '<span class="cstat dnf">DNF</span>' : '';
    return `<li class="card" style="--c:${g.arc};--d:${g.dot}">` +
      `<button class="cmain" data-act="open" data-gid="${g.id}" aria-label="${g.name}: leaderboard and stats">${icon(g.id)}<span class="ctext"><b>${g.name}</b></span>${stat}</button>` +
      (r.status === 'none' ? `<button class="go" data-act="run" data-gid="${g.id}" aria-label="Run ${g.name}">Run</button>` : '') +
      `<button class="chev" data-act="open" data-gid="${g.id}" aria-label="${g.name} leaderboard and stats">›</button></li>`;
  }).join('');
  $('s-home').innerHTML =
    `<header class="top"><div><h1>Clock Rate</h1><p class="sub">${now.toLocaleDateString(undefined, {weekday: 'long', month: 'short', day: 'numeric'})} · times reset in ${left}</p></div>` +
    `<button class="me" data-act="profile" data-pid="${esc(st.s.me.id)}">${esc(st.s.me.name || 'You')}</button></header>` +
    `<h2>Run each game solo</h2><ul class="games">${cards}</ul>` +
    `<div class="total"><span>Solo total today<small>${soloDone.length} of ${CA.games.length} games run</small></span><b class="tn">${soloDone.length ? fmt(soloTotal) : '–'}</b></div>` +
    `<h2>Or run all five back to back</h2>` + gaunt + tierLegend() +
    `<p class="foot">A City Apps game.${C.demo || C.testMode ? ` Test build. ${C.demo ? 'Other players are demo data.' : ''} ${C.testMode ? 'Ads and purchases are switched off.' : ''}` : ''}</p>`;
}

/* ---------- game page ---------- */
function splitsHTML(r) {
  if (!r.splits || r.splits.length < 2) return '';
  return '<ol class="splits">' + r.splits.map((s, i) => `<li><span>${CA.games[i].name}</span><span>${fmt(s)}</span></li>`).join('') + '</ol>';
}
function renderGame() {
  const g = def(ui.gid), r = st.run(g.id), isG = g.id === 'gauntlet', cost = isG ? C.gauntletPracticeCost : C.practiceCost;
  let today;
  if (r.status === 'none') {
    today = `<button class="btn big" data-act="run">Start today's run</button>` +
      `<p class="note">You get one run a day. The clock starts on your first tap, and the time counts.</p>`;
  } else {
    today = r.status === 'done'
      ? `<div class="bigtime">${fmt(r.time)}</div><div class="under">${tierPill(g.id, r.time)}<span>${esc(friendRank(g.id))}</span></div>${splitsHTML(r)}`
      : `<div class="bigtime dnf">DNF</div><div class="under">Today's run was not finished.</div>`;
    today += st.canRetry(g.id)
      ? `<button class="btn quiet" data-act="retry">Use today's retry</button><p class="note">One retry a day, for any game. The new time replaces this one, faster or slower.</p>`
      : `<p class="note">${isG ? 'The gauntlet has no retries.' : st.s.today.retryUsed ? "Today's retry is used." : ''} Next run tomorrow.</p>`;
  }
  const cuts = CA.tierCuts(g.id).map((c, i, all) =>
    `<li><b class="tier t-${c.key}">${c.name}</b><span>${isFinite(c.under) ? 'under ' + CA.fmtShort(c.under) : CA.fmtShort(all[i - 1].under) + ' or slower'}</span></li>`).join('');
  $('s-game').innerHTML =
    `<div class="${isG ? 'g-page' : ''}"${isG ? '' : ` style="--c:${g.arc};--d:${g.dot}"`}>` +
    `<button class="back" data-act="back">‹ Back</button>` +
    `<div class="hero"><h1>${g.name}</h1><p>${g.how}</p></div>` +
    `<div class="today">${strip(g.id)}${today}</div>` +
    `<button class="link" data-act="practice">Practice run<span>${plural(cost, 'token')} · ${st.s.tokens} left</span></button>` +
    `<h2>Leaderboard</h2>` +
    tabs('scope', ui.scope, [['friends', 'Friends'], ['global', 'Global']]) +
    tabs('period', ui.period, [['today', 'Today'], ['best', 'All-time best']]) +
    boardHTML(g.id, ui.scope, ui.period, 20) +
    `<h2>Tiers, fastest first</h2><ol class="cutlist">${cuts}</ol></div>`;
}

/* ---------- profile: a week of times per game ---------- */
/* Line chart of the previous 6 days plus today. sers = [{name, cls, vals}], cls is 's1' (their line) or 's2' (yours). */
function chartHTML(days, sers, title) {
  const all = [].concat(...sers.map(s => s.vals)).filter(v => v != null);
  if (!all.length) return `<p class="empty">No times in the last week.</p>`;
  const Wd = 320, Ht = 136, pl = 42, pr = 12, pt = 10, pb = 24, n = days.length;
  let lo = Math.min(...all), hi = Math.max(...all);
  if (hi - lo < 2) { lo -= 1; hi += 1; }
  const padv = (hi - lo) * 0.14; lo = Math.max(0, lo - padv); hi += padv;
  const X = i => pl + i * (Wd - pl - pr) / (n - 1), Y = v => pt + (hi - v) / (hi - lo) * (Ht - pt - pb);
  let svg = '';
  [lo + (hi - lo) * 0.1, (lo + hi) / 2, hi - (hi - lo) * 0.1].forEach(v => {
    svg += `<line class="grid" x1="${pl}" x2="${Wd - pr}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="ax" x="${pl - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${CA.fmtShort(v)}</text>`;
  });
  days.forEach((d, i) => { svg += `<text class="ax" x="${(i === n - 1 ? Wd - 2 : X(i)).toFixed(1)}" y="${Ht - 6}" text-anchor="${i === n - 1 ? 'end' : 'middle'}">${esc(d.label)}</text>`; });
  svg += `<line class="cross" x1="0" x2="0" y1="${pt}" y2="${Ht - pb}" visibility="hidden"/>`;
  sers.forEach(s => {
    let d = '', pen = false;
    s.vals.forEach((v, i) => { if (v == null) { pen = false; return; } d += (pen ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); pen = true; });
    svg += `<path class="ln ${s.cls}" d="${d}"/>`;
    s.vals.forEach((v, i) => { if (v != null) svg += `<circle class="pt ${s.cls}" cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="4.5"/>`; });
  });
  const cw = (Wd - pl - pr) / (n - 1);
  days.forEach((d, i) => {
    const tip = d.label + ': ' + sers.map(s => s.name + ' ' + (s.vals[i] == null ? 'no run' : fmt(s.vals[i]))).join(' · ');
    svg += `<rect class="hit" x="${(X(i) - cw / 2).toFixed(1)}" y="0" width="${cw.toFixed(1)}" height="${Ht}" data-x="${X(i).toFixed(1)}" data-tip="${esc(tip)}"/>`;
  });
  const legend = sers.length < 2 ? '' : '<div class="lg">' + sers.map(s => `<span><i class="${s.cls}"></i>${esc(s.name)}</span>`).join('') + '</div>';
  const table = `<details class="tbl"><summary>Show as a table</summary><table><tr><th>Day</th>${sers.map(s => `<th>${esc(s.name)}</th>`).join('')}</tr>` +
    days.map((d, i) => `<tr><td>${esc(d.label)}</td>${sers.map(s => `<td>${s.vals[i] == null ? '–' : fmt(s.vals[i])}</td>`).join('')}</tr>`).join('') + `</table></details>`;
  return legend + `<svg class="chart" viewBox="0 0 ${Wd} ${Ht}" role="img" aria-label="${esc(title)}: times over the last week. Lower is faster.">${svg}</svg>` +
    `<p class="tip" aria-live="polite">Tap a day to see the times.</p>` + table;
}
function renderProfile() {
  const p = CA.net.profile(ui.pid), me = CA.net.profile(st.s.me.id);
  if (!p) return go('home');
  const ids = ['gauntlet'].concat(CA.games.map(g => g.id)), first = p.name.split(' ')[0];
  let wins = 0, losses = 0;
  const cards = ids.map(id => {
    const g = def(id), a = p.best[id], b = me.best[id];
    let verdict = a ? `<small>Best ${fmt(a)}</small>` : '<small>No time yet</small>';
    if (!p.mine && a && b) {
      const d = Math.abs(a - b).toFixed(2);
      if (b < a) { wins++; verdict = `<small class="win">Your best is ${d}s faster</small>`; }
      else if (a < b) { losses++; verdict = `<small>${esc(first)}'s best is ${d}s faster</small>`; }
      else verdict = '<small>Bests are tied</small>';
    }
    const sers = p.mine ? [{name: 'You', cls: 's2', vals: p.series[id]}]
      : [{name: first, cls: 's1', vals: p.series[id]}, {name: 'You', cls: 's2', vals: me.series[id]}];
    return `<div class="cmp">${strip(id)}<div class="cmp-head"><span>${g.name}</span>${a ? tierPill(id, a) : ''}</div>` +
      `<div class="cmp-sub">${verdict}</div>${chartHTML(p.days, sers, g.name)}</div>`;
  }).join('');
  const todays = CA.games.map(g => p.series[g.id][p.days.length - 1]), ran = todays.filter(v => v != null);
  const total = `<p class="score">Solo total today: ${ran.length === CA.games.length ? fmt(ran.reduce((a, b) => a + b, 0)) : `${ran.length} of ${CA.games.length} games run`}</p>`;
  const score = p.mine ? '' : `<p class="score">${wins || losses ? `Best times: you lead ${wins}, ${esc(first)} leads ${losses}` : 'No games in common yet'}</p>`;
  const settings = !p.mine ? '' :
    `<h2>You</h2>` +
    `<button class="setrow" data-act="rename">Name<span>${esc(p.name)}</span></button>` +
    `<button class="setrow" data-act="friends">Add friends<span>Share your code</span></button>` +
    `<button class="setrow" data-act="sound">Sound<span>${st.s.sound ? 'On' : 'Off'}</span></button>` +
    `<button class="setrow" data-act="tokens">Practice tokens<span>${st.s.tokens}</span></button>`;
  $('s-profile').innerHTML =
    `<button class="back" data-act="back">‹ Back</button>` +
    `<h1 class="pname">${esc(p.name)}</h1>${score}${total}` +
    `<h2>Times over the last week</h2>` + cards + tierLegend() + settings;
}
/* Tap or hover a day on a chart to read its times. */
function chartTip(e) {
  const hit = e.target.closest && e.target.closest('.hit');
  if (!hit) return;
  const card = hit.closest('.cmp'), cross = card.querySelector('.cross');
  card.querySelector('.tip').textContent = hit.dataset.tip;
  cross.setAttribute('x1', hit.dataset.x); cross.setAttribute('x2', hit.dataset.x); cross.setAttribute('visibility', 'visible');
}
document.addEventListener('pointerover', chartTip);
document.addEventListener('click', chartTip);

/* ---------- sheets ---------- */
let sheetLocked = false;
function openSheet(html, locked) {
  sheetLocked = !!locked;
  $('sheet').innerHTML = html; $('sheetwrap').classList.add('open');
  const f = $('sheet').querySelector('input,button'); if (f) setTimeout(() => { try { f.focus({preventScroll: true}); } catch (e) {} }, 80);
}
function closeSheet() { $('sheetwrap').classList.remove('open'); sheetLocked = false; }
let onYes = null;
function confirmSheet(title, body, yes, no, cb) {
  onYes = cb;
  openSheet(`<h3>${title}</h3><p>${body}</p><button class="btn" data-act="yes">${yes}</button><button class="btn quiet" data-act="close">${no}</button>`);
}
function nameSheet(first) {
  openSheet(`<h3>${first ? 'What should we call you?' : 'Change your name'}</h3>` +
    `<p>${first ? 'This is the name your friends see next to your times.' : 'Your friends see this next to your times.'}</p>` +
    `<input id="nameIn" maxlength="16" autocomplete="nickname" autocapitalize="words" value="${esc(st.s.me.name)}" placeholder="Your name">` +
    `<div class="err" id="nameErr"></div><button class="btn" data-act="savename">${first ? "Let's go" : 'Save'}</button>`, first);
}
function tokenSheet(need) {
  const packs = C.packs.map(p => `<button class="pack" data-act="buy" data-pack="${p.id}">${p.tokens} tokens<span>${p.price}</span></button>`).join('');
  openSheet(`<h3>Practice tokens</h3>` +
    `<p>${need ? `This practice run takes ${plural(need, 'token')}. ` : ''}You have ${st.s.tokens}. Practice runs are the same course as the real thing and stay off the leaderboard.</p>` +
    `<button class="btn" data-act="ad">Watch a short ad for 1 token</button>${packs}` +
    (C.testMode ? `<p class="note">Test build: no ad is shown and nothing is charged.</p>` : '') +
    `<button class="link" data-act="close">Not now</button>`);
}

/* ---------- the run ---------- */
const col = {};
function readCol() {
  const cs = getComputedStyle(document.documentElement), g = n => cs.getPropertyValue(n).trim();
  Object.assign(col, {bg: g('--bg'), surface: g('--surface'), ink: g('--ink'), muted: g('--muted'), track: g('--track'), line: g('--line'), arc: g('--arc'), dot: g('--dot')});
}
const cv = $('cv'), ctx = cv.getContext('2d'), stage = $('stage');
let P = null, W = 300, H = 300, dpr = 1, loopGen = 0;
for (let i = 0; i < C.levels; i++) $('segs').appendChild(document.createElement('i'));

function setSegs(done, live) {
  const s = $('segs').children;
  for (let i = 0; i < s.length; i++) s[i].className = i < done ? 'on' : (i === done && live ? 'cur' : '');
  $('lvl').textContent = live && done < C.levels ? `Level ${done + 1} of ${C.levels}` : '';
}
function flash(text, bad) {
  const f = $('flash'); f.textContent = text;
  f.className = 'flash' + (bad ? ' bad' : ''); void f.offsetWidth; f.classList.add('go');
}
function resize() {
  const r = stage.getBoundingClientRect();
  W = Math.max(120, r.width); H = Math.max(120, r.height);
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  if (P && P.inst) P.inst.layout(W, H);
}
if (window.ResizeObserver) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);

const MODE = {official: 'Your one run today', retry: 'Retry · this time counts', practice: 'Practice'};
function startPlay(target, kind) {
  P = {target, kind, queue: target === 'gauntlet' ? CA.games.map(g => g.id) : [target], qi: 0,
    base: 0, splitBase: 0, elapsed: 0, splits: [], running: false, started: false, committed: false, complete: false, inst: null, t0: null, last: 0, endAt: 0, swapAt: 0};
  go('play');
  prepGame();
  const gen = ++loopGen;
  const loop = t => { if (!P || gen !== loopGen) return; tick(t); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
function prepGame() {
  const g = def(P.queue[P.qi]), multi = P.queue.length > 1, intro = multi ? GAUNT : g, practice = P.kind === 'practice';
  P.def = g; P.inst = null; P.started = false; P.running = false;
  document.documentElement.style.setProperty('--arc', g.arc);
  document.documentElement.style.setProperty('--dot', g.dot);
  readCol();
  $('pName').textContent = g.name;
  $('pMode').textContent = multi ? `Gauntlet · game ${P.qi + 1} of ${P.queue.length}${practice ? ' · practice' : ''}` : MODE[P.kind];
  $('timer').textContent = fmt(P.elapsed);
  setSegs(0, false);
  $('result').hidden = true;
  $('flash').className = 'flash'; $('flash').textContent = '';
  const r = $('ready'); r.hidden = false;
  r.innerHTML = `<span class="r-kicker">${multi ? (practice ? 'Practice' : 'Your one Gauntlet run today') : MODE[P.kind]}</span><span class="r-name">${intro.name}</span>` +
    `<span class="r-how">${intro.how}</span><span class="r-go">${practice ? 'Tap to start the clock' : 'Tap to start. This one counts.'}</span>`;
  resize();
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
}
/* Put the current game on screen and make it live. The clock is not touched here. */
function launch() {
  /* Courses never change: the same seed every run, every day, for everyone, so routes can be learned. */
  const g = P.def, seed = CA.hash('course:' + g.id);
  P.inst = g.make({
    levels: C.levels, col, RM, sfx: CA.sfx, flash,
    rng: level => CA.rng(seed + level * 7919),
    level: n => setSegs(n, n < C.levels),
    finish: gameDone
  });
  resize();
  P.started = true; P.running = true;
  $('ready').hidden = true;
  setSegs(0, true);
}
function begin() {
  if (!P || P.started || P.complete) return;
  CA.sfx.unlock();
  if (!P.committed) {
    if (P.kind === 'practice') {
      if (!st.spend(P.target === 'gauntlet' ? C.gauntletPracticeCost : C.practiceCost)) { exit(); return; }
    } else st.begin(P.target, P.kind);
    P.committed = true;
  }
  P.t0 = null;
  launch();
}
function gameDone() {
  const now = Math.floor(P.elapsed * 100) / 100;
  P.splits.push(Math.round((now - P.splitBase) * 100) / 100);
  P.splitBase = now;
  if (P.qi < P.queue.length - 1) {
    /* Gauntlet: the clock keeps running and the next game comes straight up. */
    P.swapAt = P.last + 350; CA.sfx.clear();
  } else {
    P.running = false; P.elapsed = now;
    $('timer').textContent = fmt(P.elapsed);
    P.endAt = P.last + 650; CA.sfx.finish();
  }
}
function tick(t) {
  if (!P) return;
  const dt = Math.max(0, Math.min(0.05, P.last ? (t - P.last) / 1000 : 0));
  P.last = t;
  if (P.running) {
    /* Wall-clock time: leaving the app does not stop the clock. */
    if (P.t0 == null) P.t0 = t;
    P.elapsed = P.base + (t - P.t0) / 1000;
    $('timer').textContent = fmt(P.elapsed);
  }
  if (P.inst && P.started) {
    if (P.running || P.endAt) P.inst.update(dt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    P.inst.draw(ctx);
  }
  if (P.swapAt && t >= P.swapAt) {
    P.swapAt = 0; P.qi++;
    prepGame(); launch(); flash(P.def.name);
  }
  if (P.endAt && t >= P.endAt) { P.endAt = 0; complete(); }
}

function complete() {
  P.complete = true;
  const g = def(P.target), t = P.elapsed, practice = P.kind === 'practice';
  let kicker, lines = '', btns;
  if (practice) {
    kicker = 'Practice run';
    lines = `<div class="r-line sub2">Practice times stay off the leaderboard.</div>`;
    btns = `<button class="btn" data-act="exit">Done</button><button class="btn quiet" data-act="again">Practice again</button>`;
  } else {
    const res = st.finish(P.target, t, P.splits);
    kicker = res.prev == null ? 'First time on the board' : res.isBest ? 'New personal best' : "Today's time";
    lines = `<div class="r-line">${esc(friendRank(g.id))}</div>`;
    if (res.prev != null) lines += `<div class="r-line sub2">${res.isBest ? (res.prev - t).toFixed(2) + 's faster than your best' : (t - res.prev).toFixed(2) + 's off your best of ' + fmt(res.prev)}</div>`;
    btns = `<button class="btn" data-act="exit">${st.canRetry(g.id) ? 'Keep this time' : 'Done'}</button>` +
      (st.canRetry(g.id) ? `<button class="btn quiet" data-act="retry">Use today's retry</button>` : '') +
      `<button class="link" data-act="share">Share this time</button>`;
  }
  const el = $('result');
  el.innerHTML = `<div class="r-kicker">${kicker} · ${g.name}</div><div class="bigtime${RM ? '' : ' in'}">${fmt(t)}</div>` +
    `<div class="under" style="margin-bottom:6px">${tierPill(g.id, t)}</div>${lines}${splitsHTML({splits: P.splits})}<div class="r-btns">${btns}</div>`;
  el.hidden = false;
  setSegs(C.levels, false);
}
function exit() {
  const gid = P ? P.target : ui.gid;
  P = null;
  document.documentElement.style.removeProperty('--arc');
  document.documentElement.style.removeProperty('--dot');
  ui.gid = gid; go('game'); ui.prev = 'home';
}
function tryPractice(gid) {
  const cost = gid === 'gauntlet' ? C.gauntletPracticeCost : C.practiceCost;
  if (st.s.tokens < cost) return tokenSheet(cost);
  startPlay(gid, 'practice');
}

/* ---------- input ---------- */
function pt(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
const live = () => P && P.inst && P.started && P.running;
cv.addEventListener('pointerdown', e => {
  if (e.button) return; e.preventDefault();
  if (!live()) return;
  try { cv.setPointerCapture(e.pointerId); } catch (x) {}
  const [x, y] = pt(e); P.inst.down(x, y);
});
cv.addEventListener('pointermove', e => { if (live() && P.inst.move) { const [x, y] = pt(e); P.inst.move(x, y); } });
['pointerup', 'pointercancel'].forEach(n => cv.addEventListener(n, () => { if (P && P.inst && P.inst.up) P.inst.up(); }));
$('ready').addEventListener('pointerdown', e => { if (e.button) return; e.preventDefault(); begin(); });
$('ready').addEventListener('click', begin);     // keyboard and assistive tech
document.addEventListener('keydown', e => {
  if (e.repeat || ui.screen !== 'play' || !P || $('sheetwrap').classList.contains('open')) return;
  if (!live()) return;
  const k = P.def.keys;
  if ((k === 'tap' || k === 'hold') && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); P.inst.down(W / 2, H / 2); }
  if (k === 'lr' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); P.inst.down(e.key === 'ArrowLeft' ? W * 0.25 : W * 0.75, H / 2); }
  const arrow = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].indexOf(e.key);
  if (k === 'arrows' && arrow >= 0) { e.preventDefault(); P.inst.swipe(arrow); }
});

const acts = {
  open(d) { ui.gid = d.gid; ui.period = 'today'; go('game'); },
  back() { go(ui.screen === 'profile' && ui.prev === 'game' ? 'game' : 'home'); },
  profile(d) { ui.pid = d.pid; go('profile'); },
  tab(d) { ui[d.key] = d.val; renderGame(); },
  run(d) {
    const gid = d.gid || ui.gid, g = def(gid);
    if (!st.canRun(gid)) return;
    /* Make it unmistakable that this spends the day's only run. */
    confirmSheet(gid === 'gauntlet' ? 'Your one Gauntlet run' : `Your one ${g.name} run`,
      gid === 'gauntlet'
        ? 'This is your only Gauntlet run today. All five games back to back, the clock never stops between them, and there are no retries. The clock starts on your first tap and the time goes on the board.'
        : `This is your only ${g.name} run today. The clock starts on your first tap and the time goes on the board. Quitting counts as a DNF.` +
          (st.s.today.retryUsed ? ' Your retry is already used.' : ' You have one retry today, for any one game.'),
      'Start my run', 'Not yet', () => startPlay(gid, 'official'));
  },
  retry() {
    const gid = P ? P.target : ui.gid, r = st.run(gid);
    if (!st.canRetry(gid)) return;
    confirmSheet('Use your retry?',
      (r.status === 'done' ? `Your ${fmt(r.time)} gets thrown out. ` : '') + 'Whatever you run next is your time for today, faster or slower. This is your only retry today, across every game.',
      'Retry', r.status === 'done' ? 'Keep my time' : 'Not now', () => startPlay(gid, 'retry'));
  },
  practice() { tryPractice(ui.gid); },
  again() { const gid = P.target; exit(); tryPractice(gid); },
  exit,
  quit() {
    if (!P) return;
    if (!P.committed || P.complete) return exit();
    const practice = P.kind === 'practice';
    confirmSheet('Quit this run?', practice ? 'The practice token is already spent.' : 'It will count as a DNF for today.', 'Quit', 'Keep going',
      () => { if (!practice) st.abandon(P.target); exit(); });
  },
  yes() { const cb = onYes; onYes = null; closeSheet(); if (cb) cb(); },
  close() { if (!sheetLocked) closeSheet(); },
  rename() { nameSheet(false); },
  savename() {
    const v = $('nameIn').value.replace(/\s+/g, ' ').trim();
    if (v.length < 2) { $('nameErr').textContent = 'Use at least 2 characters.'; return; }
    st.setName(v.slice(0, 16)); sheetLocked = false; closeSheet(); go(ui.screen);
  },
  sound() { st.setSound(!st.s.sound); renderProfile(); },
  tokens() { tokenSheet(0); },
  friends() {
    openSheet(`<h3>Add friends</h3><p>Friends add you with this code.</p><div class="code">${esc(st.s.me.id.slice(1).toUpperCase())}</div>` +
      `<p>Friend codes start working once online accounts are connected. Until then the friends list shows demo players.</p><button class="btn" data-act="close">OK</button>`);
  },
  ad() {
    CA.services.rewardedAd().then(ok => {
      if (ok) st.grant(1);
      closeSheet(); if (ui.screen !== 'play') go(ui.screen);
    });
  },
  buy(d) {
    const pack = C.packs.find(p => p.id === d.pack);
    CA.services.buy(pack).then(ok => {
      if (ok) st.grant(pack.tokens);
      closeSheet(); if (ui.screen !== 'play') go(ui.screen);
    });
  },
  share() {
    const g = def(P.target), text = `I ran ${g.name} in ${fmt(P.elapsed)} on Clock Rate. Beat that.`;
    if (navigator.share) navigator.share({text}).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => flash('Copied'), () => {});
  }
};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (b && acts[b.dataset.act]) acts[b.dataset.act](b.dataset);
});
$('scrim').addEventListener('click', () => acts.close());
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && $('sheetwrap').classList.contains('open')) acts.close();
  if (e.key === 'Enter' && e.target && e.target.id === 'nameIn') acts.savename();
});
document.addEventListener('keyup', e => {
  if ((e.key === ' ' || e.key === 'Enter') && P && P.inst && P.inst.up && P.def.keys === 'hold') P.inst.up();
});
document.addEventListener('visibilitychange', () => { if (!document.hidden && ui.screen === 'home') renderHome(); });
if (window.matchMedia) {
  const mq = matchMedia('(prefers-color-scheme: dark)'), cb = () => requestAnimationFrame(readCol);
  if (mq.addEventListener) mq.addEventListener('change', cb);
}

/* ---------- start ---------- */
CA.tick = tick;                        // exposed so tests can drive frames by hand
CA.debug = {get P() { return P; }};
readCol();
go('home');
if (!st.s.me.name) nameSheet(true);
})();
