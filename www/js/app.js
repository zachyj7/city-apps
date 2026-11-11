/* The app shell: home, game pages, the run itself, results, leaderboards, profiles. */
(() => {
'use strict';
const CA = window.CA, C = CA.config, st = CA.store, fmt = CA.fmt;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const GAUNT = {
  id: 'gauntlet', name: 'The Gauntlet', blurb: 'All five. One clock.',
  how: 'All five games back to back on one clock. The clock only runs while you are playing. One run a day, no retries.'
};
const def = id => id === 'gauntlet' ? GAUNT : CA.games.find(g => g.id === id);
const ui = {screen: 'home', prev: 'home', gid: null, scope: 'friends', period: 'today', pid: null, pperiod: 'best'};
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

/* ---------- home ---------- */
function renderHome() {
  st.rollover();
  const now = new Date(), end = new Date(now); end.setHours(24, 0, 0, 0);
  const mins = Math.max(1, Math.round((end - now) / 60000)), left = mins >= 60 ? Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm' : mins + 'm';
  const gr = st.run('gauntlet');
  const gstat = gr.status === 'done' ? `<span class="tn">${fmt(gr.time)}</span>${tierPill('gauntlet', gr.time)}<span>${esc(friendRank('gauntlet'))}</span>`
    : gr.status === 'dnf' ? 'Did not finish today' : 'Run it once. No retries.';
  const cards = CA.games.map(g => {
    const r = st.run(g.id);
    const stat = r.status === 'done' ? `<span class="tn">${fmt(r.time)}</span>${tierPill(g.id, r.time)}`
      : r.status === 'dnf' ? '<span class="dnf">DNF</span>' : '<em class="go">Run</em>';
    return `<li><button class="card" data-act="open" data-gid="${g.id}" style="--c:${g.arc};--d:${g.dot}">` +
      `<span class="ico" aria-hidden="true"></span><span class="cmain"><b>${g.name}</b><small>${g.blurb}</small></span><span class="cstat">${stat}</span></button></li>`;
  }).join('');
  $('s-home').innerHTML =
    `<header class="top"><div><h1>City Apps</h1><p class="sub">${now.toLocaleDateString(undefined, {weekday: 'long', month: 'short', day: 'numeric'})} · new courses in ${left}</p></div>` +
    `<button class="me" data-act="profile" data-pid="${esc(st.s.me.id)}">${esc(st.s.me.name || 'You')}</button></header>` +
    `<button class="gaunt" data-act="open" data-gid="gauntlet"><span class="g-kicker">The Gauntlet</span><span class="g-title">All five. One clock.</span><span class="g-status">${gstat}</span></button>` +
    `<h2>Today's runs</h2><ul class="games">${cards}</ul>` +
    `<h2>Friends · Gauntlet today</h2>${boardHTML('gauntlet', 'friends', 'today', 5)}` +
    (C.demo || C.testMode ? `<p class="foot">Test build. ${C.demo ? 'Other players are demo data.' : ''} ${C.testMode ? 'Ads and purchases are switched off.' : ''}</p>` : '');
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
      `<p class="note">One run a day. The clock starts on your first tap, and the time counts.</p>`;
  } else {
    today = r.status === 'done'
      ? `<div class="bigtime">${fmt(r.time)}</div><div class="under">${tierPill(g.id, r.time)}<span>${esc(friendRank(g.id))}</span></div>${splitsHTML(r)}`
      : `<div class="bigtime dnf">DNF</div><div class="under">Today's run was not finished.</div>`;
    today += st.canRetry(g.id)
      ? `<button class="btn quiet" data-act="retry">Use today's retry</button><p class="note">One retry a day, for any game. The new time replaces this one, faster or slower.</p>`
      : `<p class="note">${isG ? 'The gauntlet has no retries.' : st.s.today.retryUsed ? "Today's retry is used." : ''} New course tomorrow.</p>`;
  }
  const cuts = CA.tierCuts(g.id).map(c => `<b class="t-${c.key}">${c.name}</b> under ${CA.fmtShort(c.under)}`).join(' · ');
  $('s-game').innerHTML =
    `<button class="back" data-act="back">‹ Back</button>` +
    `<div class="hero"><h1>${g.name}</h1><p>${g.how}</p></div>` +
    `<div class="today">${today}</div>` +
    `<button class="link" data-act="practice">Practice run<span>${plural(cost, 'token')} · ${st.s.tokens} left</span></button>` +
    `<h2>Leaderboard</h2>` +
    tabs('scope', ui.scope, [['friends', 'Friends'], ['global', 'Global']]) +
    tabs('period', ui.period, [['today', 'Today'], ['best', 'All-time best']]) +
    boardHTML(g.id, ui.scope, ui.period, 20) +
    `<p class="cuts">${cuts}</p>`;
}

/* ---------- profile and compare ---------- */
function renderProfile() {
  const p = CA.net.profile(ui.pid), me = CA.net.profile(st.s.me.id);
  if (!p) return go('home');
  const per = ui.pperiod, ids = ['gauntlet'].concat(CA.games.map(g => g.id));
  let wins = 0, losses = 0;
  const first = p.name.split(' ')[0];
  const rows = ids.map(id => {
    const g = def(id), a = p[per][id], b = me[per][id], max = Math.max(a || 0, b || 0) || 1;
    const bar = (cls, who, t) => `<div class="bar ${cls}"><span class="who">${esc(who)}</span><span class="trk"><span class="fill" style="width:${t ? Math.max(4, t / max * 100) : 0}%"></span></span>` +
      `<span class="val${t ? '' : ' none'}">${t ? fmt(t) : 'No time'}</span></div>`;
    let verdict = a ? tierPill(id, a) : '';
    if (!p.mine && a && b) {
      const d = Math.abs(a - b).toFixed(2);
      if (b < a) { wins++; verdict = `<small class="win">You by ${d}s</small>`; }
      else if (a < b) { losses++; verdict = `<small>${esc(first)} by ${d}s</small>`; }
      else verdict = '<small>Tied</small>';
    }
    return `<div class="cmp" style="--c:${g.arc || 'var(--muted)'}"><div class="cmp-head"><span>${g.name}</span>${verdict}</div>` +
      bar('', p.mine ? 'You' : first, a) + (p.mine ? '' : bar('you', 'You', b)) + `</div>`;
  }).join('');
  const score = p.mine ? '' : `<p class="score">${wins || losses ? `You ${wins} · ${esc(first)} ${losses}` : 'No games in common yet'}</p>`;
  const settings = !p.mine ? '' :
    `<h2>You</h2>` +
    `<button class="setrow" data-act="rename">Name<span>${esc(p.name)}</span></button>` +
    `<button class="setrow" data-act="friends">Add friends<span>Share your code</span></button>` +
    `<button class="setrow" data-act="sound">Sound<span>${st.s.sound ? 'On' : 'Off'}</span></button>` +
    `<button class="setrow" data-act="tokens">Practice tokens<span>${st.s.tokens}</span></button>`;
  $('s-profile').innerHTML =
    `<button class="back" data-act="back">‹ Back</button>` +
    `<h1 class="pname">${esc(p.name)}</h1>${score}` +
    tabs('pperiod', per, [['best', 'All-time best'], ['today', 'Today']]) +
    `<p class="note" style="text-align:left">Shorter bar is faster.</p>` + rows + settings;
}

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
    `<p>${need ? `This practice run takes ${plural(need, 'token')}. ` : ''}You have ${st.s.tokens}. Practice runs use today's course and stay off the leaderboard.</p>` +
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

const MODE = {official: "Today's run", retry: 'Retry · this time counts', practice: 'Practice'};
function startPlay(target, kind) {
  P = {target, kind, queue: target === 'gauntlet' ? CA.games.map(g => g.id) : [target], qi: 0,
    base: 0, elapsed: 0, splits: [], running: false, started: false, committed: false, complete: false, inst: null, t0: null, last: 0, endAt: 0};
  go('play');
  prepGame();
  const gen = ++loopGen;
  const loop = t => { if (!P || gen !== loopGen) return; tick(t); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
function prepGame() {
  const g = def(P.queue[P.qi]), multi = P.queue.length > 1;
  P.def = g; P.inst = null; P.started = false; P.running = false;
  document.documentElement.style.setProperty('--arc', g.arc);
  document.documentElement.style.setProperty('--dot', g.dot);
  readCol();
  $('pName').textContent = g.name;
  $('pMode').textContent = (multi ? `Gauntlet ${P.qi + 1} of ${P.queue.length} · ` : '') + (multi && P.kind !== 'practice' ? 'no retries' : MODE[P.kind]);
  $('timer').textContent = fmt(P.elapsed);
  setSegs(0, false);
  $('result').hidden = true;
  const r = $('ready'); r.hidden = false;
  r.innerHTML = `<span class="r-kicker">${multi ? `Game ${P.qi + 1} of ${P.queue.length}` : MODE[P.kind]}</span><span class="r-name">${g.name}</span>` +
    `<span class="r-how">${g.how}</span><span class="r-go">${P.committed ? 'Tap to go' : 'Tap to start the clock'}</span>`;
  resize();
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
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
  const g = P.def, seed = CA.hash(CA.dayKey() + ':' + g.id);
  P.inst = g.make({
    levels: C.levels, col, RM, sfx: CA.sfx, flash,
    rng: level => CA.rng(seed + level * 7919),
    level: n => setSegs(n, n < C.levels),
    finish: gameDone
  });
  resize();
  P.started = true; P.running = true; P.t0 = null;
  $('ready').hidden = true;
  setSegs(0, true);
}
function gameDone() {
  P.running = false;
  P.elapsed = Math.floor(P.elapsed * 100) / 100;
  P.splits.push(Math.round((P.elapsed - P.base) * 100) / 100);
  P.base = P.elapsed;
  $('timer').textContent = fmt(P.elapsed);
  P.endAt = P.last + 650;
  if (P.qi < P.queue.length - 1) CA.sfx.clear(); else CA.sfx.finish();
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
  if (P.endAt && t >= P.endAt) {
    P.endAt = 0;
    if (P.qi < P.queue.length - 1) { P.qi++; prepGame(); } else complete();
  }
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
  if (k === 'tap' && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); P.inst.down(W / 2, H / 2); }
  if (k === 'lr' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); P.inst.down(e.key === 'ArrowLeft' ? W * 0.25 : W * 0.75, H / 2); }
});

const acts = {
  open(d) { ui.gid = d.gid; ui.period = 'today'; go('game'); },
  back() { go(ui.screen === 'profile' && ui.prev === 'game' ? 'game' : 'home'); },
  profile(d) { ui.pid = d.pid; go('profile'); },
  tab(d) { ui[d.key] = d.val; if (ui.screen === 'profile') renderProfile(); else renderGame(); },
  run() { if (st.canRun(ui.gid)) startPlay(ui.gid, 'official'); },
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
    const g = def(P.target), text = `I ran ${g.name} in ${fmt(P.elapsed)} on City Apps. Beat that.`;
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
