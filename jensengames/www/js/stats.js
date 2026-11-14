// Statistics and the coach, for whoever signs in with the statistics login (in Settings).
//   - numbers for the game so far: each player's turns, tiles played, draws, biggest play
//   - the best play for your last turn, once it is over, played back step by step
//     (or, with "always show", a card during every turn - and everyone is told you are cheating)
//   - "Can I go out?": yes or no, whether all your tiles can go down in one turn
// Everything here is worked out on this screen from what this player can see.
import { tile, analyze, COLOR_NAMES, OPEN_POINTS } from './rules.js';
import { bestPlay } from './ai.js';


export function initStats({ A, pid, esc, ic, send }) {
  const $ = s => document.querySelector(s);
  const me = () => A.S && A.S.players.find(p => p.pid === pid);
  const myTurn = () => !!(A.S && A.S.phase === 'play' && A.S.turn === pid);
  let unlocked = false;
  let live = false;      // "Always show the best play": off until switched on, every time

  let cur = null;      // my turn in progress: { turnNo, table, rack, opened }
  let last = null;     // my last finished turn, the same plus what I did: { ..., played, drew }
  let lastResult = null, outResult = null, liveResult = null;

  /* ---------------- little tiles ---------------- */
  const mini = (id, hi) => {
    const t = tile(id);
    return t.j ? `<span class="mt joker${hi ? ' hi' : ''}"><i class="${id % 106 === 105 ? 'jface j2' : 'jface'}"></i></span>` : `<span class="mt c${t.c}${hi ? ' hi' : ''}">${String(t.n).replace(/0/g, '<span class="z">0</span>')}</span>`;
  };
  // The table after a play, with the tiles from the rack ringed; sets that changed are listed first.
  function setsHTML(res, before) {
    const mine = new Set(res.played), was = new Set((before || []).map(s => [...s].sort((a, b) => a - b).join(',')));
    const sets = res.table.map(s => ({ s, changed: !was.has([...s].sort((a, b) => a - b).join(',')) }));
    sets.sort((a, b) => b.changed - a.changed);
    return `<div class="msets">${sets.map(({ s, changed }) =>
      `<div class="mset ${changed ? 'changed' : ''}">${s.map(id => mini(id, mine.has(id))).join('')}</div>`).join('')}</div>`;
  }
  const pts = ids => ids.reduce((s, id) => s + (tile(id).j ? 0 : tile(id).n), 0);

  /* ---------------- the panel ---------------- */
  const panel = document.createElement('div');
  panel.id = 'stats'; panel.hidden = true;
  panel.innerHTML = `<div class="card stcard" role="dialog" aria-label="Statistics">
      <div class="pophead"><b>${ic('trophy')} Statistics</b><button class="iconbtn" data-st="close" aria-label="Close statistics">${ic('close')}</button></div>
      <div class="stbody"></div>
    </div>`;
  document.body.appendChild(panel);
  const body = panel.querySelector('.stbody');
  panel.addEventListener('click', e => {
    if (e.target === panel) return close();
    const b = e.target.closest('[data-st]');
    if (!b) return;
    const act = b.dataset.st;
    if (act === 'close') close();
    else if (act === 'last') analyzeLast();
    else if (act === 'out') canGoOut();
    else if (act === 'replay') playReplay();
    else if (act === 'prev') goStep(replay ? replay.i - 1 : 0);
    else if (act === 'next') goStep(replay ? replay.i + 1 : 0);
    else if (act === 'step') goStep(+b.dataset.k);
  });
  panel.addEventListener('change', e => {
    if (e.target.id !== 'stLive') return;
    live = e.target.checked;
    const S = A.S, m = me();
    if (S && S.phase === 'play' && m && m.seat) {
      if (live && !m.cheat) send({ t: 'cheat' });
      else if (!live && m.cheat) send({ t: 'cheat', on: false });
    }
    liveResult = null;
    syncLive();
    render();
  });
  document.addEventListener('keydown', e => {
    if (panel.hidden) return;
    if (e.key === 'Escape') close();
    else if (replay && e.key === 'ArrowLeft') { e.preventDefault(); goStep(replay.i - 1); }
    else if (replay && e.key === 'ArrowRight') { e.preventDefault(); goStep(replay.i + 1); }
  });

  // The helper (bigz) can lock the whole page for the table.
  const locked = () => !!(A.S && A.S.statsOff);
  function open() {
    if (!unlocked || locked()) return;
    const set = $('#settings');
    if (set && !set.hidden) $('#setClose').click();   // the statistics take over from Settings
    panel.hidden = false; render();
  }
  function close() { panel.hidden = true; }

  // Redrawn as the game goes on, keeping the scroll position.
  function render() {
    if (panel.hidden) return;
    const top = body.scrollTop;
    draw();
    body.scrollTop = top;
  }
  function draw() {
    const S = A.S, m = me();
    if (!S || S.phase === 'lobby' || !m) {
      body.innerHTML = `${coachHTML()}<p class="stnote">The game numbers show up once a game has started.</p>`;
      placeReplay();
      return;
    }
    const seated = S.players.filter(p => p.seat);
    const time = S.startedAt ? Math.max(0, Math.round((Date.now() - S.startedAt) / 60000)) : null;
    const onTable = (S.table || []).flat().length;
    const myRack = m.rack || [];
    const turns = seated.reduce((s, p) => s + ((p.st && p.st.turns) || 0), 0);
    const tiles = [
      ['Tiles left to draw', S.pool.length],
      ['On the table', `${onTable} <small>in ${(S.table || []).length} sets</small>`],
      ['Turns taken', turns],
      ['Playing for', time == null ? '–' : `${time} min`],
      ['Your tiles', `${myRack.length} <small>${pts(myRack)} points</small>`],
      ['Your jokers', myRack.filter(id => tile(id).j).length],
    ];
    const rows = seated.map(p => {
      const st = p.st || {};
      const n = p.pid === S.turn && S.work ? S.work.rack.length : (p.rack || []).length;
      return `<tr class="${p.pid === pid ? 'me' : ''}"><th>${esc(p.name)}${p.pid === S.turn && S.phase === 'play' ? ' <i class="sturn">▶</i>' : ''}</th>
        <td>${n}</td><td>${st.turns || 0}</td><td>${st.played || 0}</td><td>${st.drew || 0}</td><td>${st.best || 0}</td>
        <td>${p.opened ? ic('check') : '–'}</td><td>${(p.w && p.w.tiles) || 0}</td></tr>`;
    }).join('');
    body.innerHTML = `
      ${coachHTML()}
      <h3>This game</h3>
      <div class="stgrid">${tiles.map(([k, v]) => `<div class="stbox"><span>${k}</span><b>${v}</b></div>`).join('')}</div>
      <h3>Players</h3>
      <div class="sttable"><table>
        <thead><tr><th></th><th>In hand</th><th>Turns</th><th>Tiles played</th><th>Draws</th><th>Biggest play</th><th>First 30</th><th>Wins</th></tr></thead>
        <tbody>${rows}</tbody></table></div>`;
    placeReplay();
  }

  function coachHTML() {
    const turnNow = myTurn();
    // Always about the turn you last finished, never the one you are playing now.
    const canLast = !!last;
    const lastNote = !last ? 'Available after you finish a turn.' : turnNow ? 'This is about your last turn, not the one you are playing now.' : '';
    return `<h3 class="first">Coach</h3>
      <div class="coach">
        <div class="strow"><div><b>Best play for my last turn</b><span>What was the most you could have put down?</span></div>
          <button class="btn" data-st="last" ${canLast ? '' : 'disabled'}>${ic('sortnum')}Analyze</button></div>
        ${lastNote ? `<p class="sthint">${lastNote}</p>` : ''}
        ${lastResult && canLast ? lastResult : ''}
        <label class="strow"><div><b>Always show the best play</b><span>A card during each of your turns with the best play there is. <em class="warn">Everyone at the table will see you are a cheater while it is on, and the end of the game shows how many times you switched it on.</em></span></div>
          <input type="checkbox" class="switch" id="stLive" ${live ? 'checked' : ''}></label>
        <div class="strow"><div><b>Can I go out?</b><span>Could you put down every tile and win this turn?</span></div>
          <button class="btn" data-st="out" ${A.S && A.S.phase === 'play' && me() && me().seat ? '' : 'disabled'}>${ic('trophy')}Check</button></div>
        ${outResult || ''}
      </div>`;
  }

  /* ---------------- the coach ---------------- */
  function thinking(where) { where(`<div class="stres"><p class="stnote">${ic('sortnum')} Thinking…</p></div>`); }

  /* The replay: the turn as it started, then one step for each set the best play makes or changes. Tiles slide
     from the rack (or from other sets) into place, so it is clear how the turn could have been played. */
  let replay = null, rpTimer = 0;
  const rpEl = document.createElement('div');
  rpEl.className = 'replay';
  const name = id => { const x = tile(id); return x.j ? 'joker' : `${COLOR_NAMES[x.c]} ${x.n}`; };
  const list = ids => { const a = ids.map(name); return a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a[0]; };
  // The rack as it was when the turn started: its rows of slots, with each tile where it was (gaps kept),
  // trimmed of empty rows at the bottom and empty slots at the right.
  function rackRows(grid, rack) {
    const have = new Set(rack), seen = new Set();
    let g = (grid || []).map(r => r.map(x => (x != null && have.has(x) && !seen.has(x) && seen.add(x) ? x : null)));
    if (!g.length) g = [Array(Math.max(7, rack.length)).fill(null)];
    for (const id of rack) if (!seen.has(id)) {   // anything missing goes into the first gap
      let done = false;
      for (const r of g) { const c = r.indexOf(null); if (c >= 0) { r[c] = id; done = true; break; } }
      if (!done) g.push([id, ...Array(g[0].length - 1).fill(null)]);
    }
    while (g.length > 1 && g[g.length - 1].every(x => x == null)) g.pop();
    let w = 0;
    for (const r of g) r.forEach((x, c) => { if (x != null) w = Math.max(w, c + 1); });
    return g.map(r => r.slice(0, Math.max(1, w)));
  }
  function replaySteps(startTable, rack, res, grid) {
    const key = s => [...s].sort((a, b) => a - b).join(',');
    const was = new Set(startTable.map(key));
    const build = res.table.filter(s => !was.has(key(s)));
    let table = startTable.map(s => s.slice()), hand = rackRows(grid, rack);
    const steps = [{ table, hand, moving: [], caption: 'Your turn started like this.' }];
    build.forEach((set, i) => {
      const inHand = new Set(hand.flat()), fromRack = set.filter(id => inHand.has(id)), fromTable = set.filter(id => !inHand.has(id));
      // the new set goes where most of its tiles came from
      let at = -1, most = 0;
      table.forEach((s, k) => { const c = s.filter(id => set.includes(id)).length; if (c > most) { most = c; at = k; } });
      hand = hand.map(r => r.map(x => (set.includes(x) ? null : x)));   // the slot it left stays empty
      table = table.map(s => s.filter(id => !set.includes(id)));
      table.splice(at < 0 ? table.length : at, 0, set.slice());
      table = table.filter(s => s.length);
      const kind = analyze(set).kind === 'run' ? 'run' : 'group';
      let caption;
      if (!fromTable.length) caption = `Put down your ${list(fromRack)} as a new ${kind}.`;
      else if (!fromRack.length) caption = `Move the ${list(fromTable)} on the table into a ${kind} of their own.`;
      else caption = `Put your ${list(fromRack)} with the ${list(fromTable)} from the table to make a ${kind}.`;
      steps.push({ table, hand, moving: set, caption: `Step ${i + 1} of ${build.length}: ${caption}` });
    });
    return steps;
  }
  function drawStep(i, animate) {
    const st = replay.steps[i], mine = new Set(replay.played), moving = new Set(st.moving);
    const before = new Map();
    if (animate) for (const e of rpEl.querySelectorAll('[data-rid]')) before.set(e.dataset.rid, e.getBoundingClientRect());
    const tileHtml = id => { const x = tile(id), cls = `mt ${x.j ? 'joker' : 'c' + x.c}${mine.has(id) ? ' hi' : ''}${moving.has(id) ? ' moving' : ''}`; return `<span class="${cls}" data-rid="${id}">${x.j ? `<i class="${id % 106 === 105 ? 'jface j2' : 'jface'}"></i>` : String(x.n).replace(/0/g, '<span class="z">0</span>')}</span>`; };
    rpEl.innerHTML = `<p class="rp-cap">${st.caption}</p>
      <div class="rp-table">${st.table.length ? st.table.map(s => `<div class="mset${s.some(id => moving.has(id)) ? ' changed' : ''}">${s.map(tileHtml).join('')}</div>`).join('') : '<span class="sthint">The table is empty.</span>'}</div>
      <div class="rp-rack"><span>Your rack</span><div class="rp-grid" style="grid-template-columns: repeat(${st.hand[0].length}, var(--mtw))">${st.hand.flat().map(x => (x == null ? '<i class="rp-slot"></i>' : tileHtml(x))).join('')}</div></div>
      <div class="rp-ctl">
        <button class="iconbtn rp-arrow" data-st="prev" aria-label="Previous step" ${i ? '' : 'disabled'}>${ic('arrow')}</button>
        <span class="rp-dots">${replay.steps.map((_, k) => `<button class="${k === i ? 'on' : ''}" data-st="step" data-k="${k}" aria-label="Step ${k}"></button>`).join('')}</span>
        <button class="iconbtn rp-arrow next" data-st="next" aria-label="Next step" ${i < replay.steps.length - 1 ? '' : 'disabled'}>${ic('arrow')}</button>
        <span class="rp-sp"></span>
        <button class="btn small" data-st="replay">${ic('reset')}Play</button></div>`;
    replay.i = i;
    if (!animate) return;
    for (const e of rpEl.querySelectorAll('[data-rid]')) {
      const b = before.get(e.dataset.rid);
      if (!b) continue;
      const a = e.getBoundingClientRect(), dx = b.left - a.left, dy = b.top - a.top;
      if (!dx && !dy) continue;
      e.style.transform = `translate(${dx}px, ${dy}px)`;
      e.style.transition = 'none';
      e.offsetWidth;
      e.style.transition = 'transform .7s cubic-bezier(.3, .8, .3, 1)';
      e.style.transform = '';
    }
  }
  // Go to a step by hand (the arrows, the dots or the arrow keys): the autoplay stops.
  function goStep(k) {
    if (!replay) return;
    clearTimeout(rpTimer);
    k = Math.max(0, Math.min(replay.steps.length - 1, k));
    if (k !== replay.i) drawStep(k, true);
  }
  function playReplay() {
    if (!replay) return;
    clearTimeout(rpTimer);
    let i = 0;
    drawStep(0, false);
    const next = () => { if (++i >= replay.steps.length) return; drawStep(i, true); rpTimer = setTimeout(next, 1700); };
    rpTimer = setTimeout(next, 1100);
  }
  // The panel is redrawn as the game goes on; the replay is one element that is put back each time.
  function placeReplay() {
    const slot = body.querySelector('#rpSlot');
    if (slot && replay) slot.replaceWith(rpEl);
  }

  function analyzeLast() {
    if (!last) return;
    replay = null; clearTimeout(rpTimer);
    thinking(h => { lastResult = h; render(); });
    setTimeout(() => {
      const res = bestPlay(last.table, last.rack, last.opened, { ms: 2500 });
      const n = res.played.length;
      const did = last.drew ? 'You drew a tile.' : `You put down ${last.played} tile${last.played === 1 ? '' : 's'}.`;
      let head;
      if (!n) head = last.opened ? 'There was nothing you could put down: drawing was right.' : `You couldn't make your first ${OPEN_POINTS} with those tiles: drawing was right.`;
      else if (!last.drew && last.played >= n) head = `You found the best play: ${n} tile${n === 1 ? '' : 's'}.`;
      else head = `The best play put down ${n} tile${n === 1 ? '' : 's'} (${res.value} points).`;
      lastResult = `<div class="stres open">
          <p class="${n && (last.drew || last.played < n) ? 'stbad' : 'stgood'}"><b>${head}</b> ${did}${res.complete ? '' : ' <small>(best found in the time allowed)</small>'}</p>
          ${n ? `<p class="sthint">Ringed tiles are from your rack.</p><div id="rpSlot"></div>` : ''}
        </div>`;
      replay = n ? { steps: replaySteps(last.table, last.rack, res, last.grid), played: res.played, i: 0 } : null;
      render();
      if (replay) playReplay();
    }, 30);
  }

  function canGoOut() {
    const S = A.S, m = me();
    if (!S || !m) return;
    const turnNow = myTurn() && A.W && cur;
    const table = turnNow ? cur.table : (S.table || []).map(s => s.slice());
    const rack = turnNow ? cur.rack : (m.rack || []).slice();
    const opened = turnNow ? cur.opened : m.opened;
    thinking(h => { outResult = h; render(); });
    setTimeout(() => {
      const res = bestPlay(table, rack, opened, { ms: 3000 });
      const all = res.played.length === rack.length && rack.length > 0;
      outResult = `<div class="stres stanswer ${all ? 'yes' : 'no'}"><b>${all ? 'Yes' : 'No'}</b></div>`;
      render();
    }, 30);
  }

  /* ---------------- the card that shows the best play during my turn ---------------- */
  const card = document.createElement('div');
  card.id = 'coachCard'; card.hidden = true;
  document.body.appendChild(card);
  card.addEventListener('click', e => { if (e.target.closest('[data-st=fold]')) card.classList.toggle('folded'); });
  let liveFor = null;
  function syncLive() {
    const on = unlocked && !locked() && live && myTurn() && cur;
    if (!on) { card.hidden = true; return; }
    const foot = document.querySelector('footer');
    card.style.bottom = ((foot && foot.offsetHeight) || 0) + 10 + 'px';
    if (liveFor !== cur.turnNo) {
      liveFor = cur.turnNo; liveResult = null;
      card.hidden = false;
      card.innerHTML = `<div class="cchead"><b>${ic('sortnum')} Best play</b><span>Thinking…</span></div>`;
      const forTurn = cur.turnNo, c = cur;
      setTimeout(() => {
        if (!cur || cur.turnNo !== forTurn) return;
        const res = bestPlay(c.table, c.rack, c.opened, { ms: 1200 });
        const n = res.played.length;
        liveResult = `<div class="cchead"><b>${ic('sortnum')} Best play</b><span>${n ? `${n} tile${n === 1 ? '' : 's'} · ${res.value} points` : 'Draw a tile'}</span><button class="iconbtn" data-st="fold" aria-label="Show or hide the best play">${ic('arrow')}</button></div>
          ${n ? setsHTML(res, c.table) : `<p class="sthint">${c.opened ? 'Nothing you can put down this turn.' : `Your tiles can't make ${OPEN_POINTS} on their own yet.`}</p>`}`;
        card.innerHTML = liveResult;
      }, 60);
    }
    card.hidden = false;
  }

  /* ---------------- following the game ---------------- */
  function state() {
    const S = A.S, m = me();
    if (S && m && myTurn() && A.W) {
      if (!cur || cur.turnNo !== A.W.turnNo) {
        cur = { turnNo: A.W.turnNo, table: A.W.startTable.map(s => s.slice()), rack: A.W.startRack.slice(), opened: !!m.opened, grid: A.W.startGrid ? A.W.startGrid.map(r => r.slice()) : null };
      }
    } else if (cur) {
      // my turn just ended: what did I do?
      const now = (m && m.rack) || [];
      const before = new Set(cur.rack);
      const drew = now.some(id => !before.has(id));
      last = { ...cur, drew, played: drew ? 0 : Math.max(0, cur.rack.length - now.length) };
      cur = null; lastResult = null; outResult = null;
    }
    if (S && S.phase !== 'play') { cur = null; }
    // locked by the helper: the page closes, Always show goes off, and the Settings button is greyed out
    const btn = $('#statsBtn');
    if (btn) {
      btn.disabled = locked();
      btn.title = locked() ? 'Locked for this table' : '';
      const lab = btn.querySelector('.setlabel');
      if (lab && lab.lastChild) lab.lastChild.textContent = locked() ? 'Statistics and coach (locked)' : 'Statistics and coach';
    }
    if (locked()) {
      live = false; liveFor = null; lastResult = outResult = liveResult = null;
      replay = null; clearTimeout(rpTimer); close();
    }
    // keep the table's record in step with the switch (on: marked a cheater; off: the mark comes off)
    if (unlocked && S && S.phase === 'play' && m && m.seat) {
      if (live && !m.cheat) send({ t: 'cheat' });
      else if (!live && m.cheat) send({ t: 'cheat', on: false });
    }
    syncLive();
    render();
  }

  return {
    unlock(on) { unlocked = !!on; live = false; liveFor = null; if (!on) { close(); card.hidden = true; } syncLive(); },
    open,
    state,
    leave() { cur = null; last = null; lastResult = outResult = liveResult = null; liveFor = null; replay = null; clearTimeout(rpTimer); close(); card.hidden = true; },
  };
}
