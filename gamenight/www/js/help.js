// Helper view: someone who signs in as the helper can look at another player's screen to sort out a
// technical problem. The other player's browser sends a picture of its page (as HTML, never the real
// screen), with the tiles in their hand blanked out, and shows a notice with a Stop button while it does.
//
// The helper can also ask to take control. Once the player allows it, the helper's taps, typing and scrolling
// on the picture are done on the player's own page, except anything to do with playing: their tiles and cards,
// the game's buttons and board, their whispers and rock paper scissors, and leaving or closing the table. The
// player's own browser decides what is allowed, and Stop ends control too.
//
// The sign-in is checked in each browser against a scrambled copy of the username and password, so the
// plain text is not in this file. It keeps casual visitors out; it is not strong security.
// (The salt keeps the game's old name on purpose: changing it would stop the existing sign-in working.)
const SALT = 'familytiles-helper-v1', ROUNDS = 200000;
const KEYS = {
  helper: 'ed5ea437a688e4ea739c93fd156211d6e1b537c4ca62320fa177fa8faeb98969',   // bigz
  audrey: '29303579c0590945af16498dfeac97aba6a8b80efbf769ef44266679b4ff1083',   // a quick peek at Gabe's tiles
  nina: '373df60bd0af11848da28e28ad17e3b403340f46d897bf4b8139e0b55772e099',     // a switch that hides her own tiles
};
const ROLE_NAMES = { helper: 'Big Z', audrey: 'Audrey', nina: 'Nina' };
const SIGNIN_KEY = 'jg-signin';   // the sign-in, kept for this tab so a reload doesn't sign you out
const CHUNK = 12000;        // one message stays well under what a data channel will carry
const FRAME_MS = 600;       // at most this often
const KEEP_MS = 6000;       // the helper says "still here" this often
const DROP_MS = 20000;      // and is forgotten after this long without it
// What a helper in control can never touch: anything to do with playing, private messages, and leaving or
// closing the table. (During a game, the middle of the screen is blocked too: see allowed().)
const BLOCKED = '#rack, #hand, #board, #pickBoard, #controls, .tile, .pc, .cc, .dm, #rpsBox, #wBox, #wNote, #seatMenu, .seat, #helpBanner, #viewer, #closeAllBtn, #endBtn, #leaveBtn, [data-act=leave], #helpBox';

// Which login this is ('helper', 'audrey', 'nina'), or null. (The referee uses it too, for the coach switch.)
export async function check(u, p) {
  try {
    const enc = new TextEncoder();
    const k = await crypto.subtle.importKey('raw', enc.encode(String(u).trim().toLowerCase() + '\n' + String(p)), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(SALT), iterations: ROUNDS }, k, 256);
    const hex = [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
    return Object.keys(KEYS).find(r => KEYS[r] === hex) || null;
  } catch (e) { return null; }
}

function device(ua) {
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /CrOS/.test(ua) ? 'Chromebook' : /Linux/.test(ua) ? 'Linux' : 'Unknown device';
  const br = /Edg\//.test(ua) ? 'Edge' : /Firefox\/|FxiOS/.test(ua) ? 'Firefox' : /Chrome\/|CriOS/.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'browser';
  return `${os} · ${br}`;
}

export function initHelp({ A, pid, send, toast, esc, ic, hooks = {} }) {
  const $ = s => document.querySelector(s);
  const box = $('#helpBox');
  const relay = (to, m) => send({ t: 'relay', to, m });
  const nameOf = id => { const p = A.S && A.S.players.find(q => q.pid === id); return p ? p.name : 'Someone'; };

  let cred = null;                 // { u, p, role } once signed in
  let viewing = null;              // the screen I am looking at: { pid, name, parts, got }
  const watchers = new Map();      // people looking at my screen: pid -> { tok, at }
  const errors = [];
  window.addEventListener('error', e => { errors.push(String(e.message || e.type).slice(0, 120)); if (errors.length > 3) errors.shift(); });

  /* ---------------- the helper's side ---------------- */

  let boxKey = null;
  function renderBox() {
    const people = cred && A.S ? A.S.players.filter(p => p.on && !p.cpu && p.pid !== pid) : [];
    const statsOn = !(A.S && A.S.statsOff);
    const sharing = sharingAll;
    const key = cred ? cred.role + '|' + statsOn + '|' + sharing + '|' + people.map(p => [p.pid, p.name, p.cam, p.mic].join(',')).join('|') : 'out';
    if (key === boxKey) return;
    boxKey = key;
    if (!cred) {
      box.innerHTML = `<details class="helpin"><summary>${ic('lock')}Sign in</summary>
        <form id="helpForm" autocomplete="off">
          <input id="helpUser" aria-label="Username" placeholder="Username" autocapitalize="none" spellcheck="false" maxlength="40">
          <input id="helpPass" type="password" aria-label="Password" placeholder="Password" maxlength="60">
          <button class="btn" type="submit">Sign in</button>
        </form></details>`;
      return;
    }
    if (cred.role !== 'helper') {
      box.innerHTML = `<span class="setlabel">${ic('lock')}Signed in as ${esc(ROLE_NAMES[cred.role] || cred.role)}<button type="button" class="linkbtn" data-help="out">Sign out</button></span>`;
      return;
    }
    // each person: view their screen, and mute or unmute their microphone
    const micBtn = p => !p.cam ? `<button type="button" class="btn hmic" disabled title="Their camera is off">${ic('micoff')}<span>Camera off</span></button>`
      : `<button type="button" class="btn hmic ${p.mic ? '' : 'muted'}" data-hush="${esc(p.pid)}" data-on="${p.mic ? 1 : 0}" aria-label="${p.mic ? 'Mute' : 'Unmute'} ${esc(p.name)}">${p.mic ? `${ic('mic')}<span>Mute</span>` : `${ic('micoff')}<span>Unmute</span>`}</button>`;
    box.innerHTML = `<span class="setlabel">${ic('users')}Helper: view a screen, mute someone<button type="button" class="linkbtn" data-help="out">Sign out</button></span>
      <div class="helprows">${people.length
        ? people.map(p => `<div class="helprow"><button type="button" class="btn" data-view="${esc(p.pid)}">${esc(p.name)}</button>${micBtn(p)}</div>`).join('')
        : '<span class="helpnone">Nobody else is at the table yet.</span>'}</div>
      <div class="helpshare"><button type="button" class="btn ${sharing ? 'on' : ''}" data-help="share">${ic(sharing ? 'stop' : 'users')}${sharing ? 'Stop sharing my game' : 'Share my game with everyone'}</button></div>
      <label class="setrow helpstats"><span class="setlabel">${ic('trophy')}Statistics and coach for everyone</span>
        <input type="checkbox" class="switch" id="helpStats" ${statsOn ? 'checked' : ''}></label>`;
  }

  // The helper can lock the Statistics and coach page for the whole table (and open it again).
  // The referee checks the sign-in too.
  box.addEventListener('change', e => {
    if (e.target.id !== 'helpStats' || !cred) return;
    send({ t: 'statslock', off: !e.target.checked, u: cred.u, p: cred.p });
    toast(e.target.checked ? 'Statistics and coach are open to everyone again.' : 'Statistics and coach are now locked for everyone.');
  });

  box.addEventListener('submit', async e => {
    e.preventDefault();
    const u = $('#helpUser').value, p = $('#helpPass').value;
    const btn = box.querySelector('button[type=submit]');
    btn.disabled = true;
    const role = await check(u, p);
    btn.disabled = false;
    if (!role) { $('#helpPass').value = ''; return toast('That username or password is not right.'); }
    signedIn({ u, p, role });
  });
  function signedIn(c) {
    cred = c;
    try { if (c) sessionStorage.setItem(SIGNIN_KEY, JSON.stringify({ u: c.u, p: c.p })); else sessionStorage.removeItem(SIGNIN_KEY); } catch (e) { /* private window */ }
    boxKey = null; renderBox();
    if (hooks.onRole) hooks.onRole(c ? c.role : null);
  }
  // signed in earlier in this tab: check it again and carry on
  (async () => {
    let c = null;
    try { c = JSON.parse(sessionStorage.getItem(SIGNIN_KEY)); } catch (e) { /* none */ }
    if (!c || !c.u) return;
    const role = await check(c.u, c.p);
    if (role && !cred) signedIn({ u: c.u, p: c.p, role });
  })();
  box.addEventListener('click', e => {
    const v = e.target.closest('[data-view]');
    if (v) return view(v.dataset.view);
    if (e.target.closest('[data-help=share]')) return void (sharingAll ? stopShare() : startShare());
    const h = e.target.closest('[data-hush]');
    if (h && cred && cred.role === 'helper') {
      const on = h.dataset.on === '1';   // their microphone is on now: mute it
      relay(h.dataset.hush, { k: 'hush', mute: on, u: cred.u, p: cred.p });
      h.disabled = true;   // until their device answers (the list redraws when their microphone changes)
      setTimeout(() => { h.disabled = false; }, 4000);
      return;
    }
    if (e.target.closest('[data-help=out]')) { closeViewer(); stopShare(); signedIn(null); }
  });

  /* ---------------- Big Z muting someone; Audrey's peek ----------------
     Both are asked of the other person's own browser, which checks the sign-in itself before doing anything. */
  async function onHush(from, m) {
    if ((await check(m.u, m.p)) !== 'helper') return;
    if (hooks.setMic) hooks.setMic(!m.mute, nameOf(from));
  }
  let peekAsk = null;   // { pid, at } while waiting for a peek to come back
  function peek(to) {
    if (!cred || cred.role !== 'audrey') return false;
    peekAsk = { pid: to, at: Date.now() };
    relay(to, { k: 'peek', u: cred.u, p: cred.p });
    return true;
  }
  async function onPeek(from, m) {
    if ((await check(m.u, m.p)) !== 'audrey') return;
    const hand = hooks.myHand ? hooks.myHand() : null;
    relay(from, { k: 'peekans', ...(hand || { none: 1 }) });
  }

  /* ---------------- the helper sharing their game with everyone ----------------
     Not the real screen: the same copy of this page the helper view uses, so only the game is shown, as the
     helper sees it, with the tiles in their hand blanked out (everything else shows, menus included). Where their mouse is
     goes along too, drawn as a big pointer. The referee checks the helper sign-in first, and everyone's page
     only shows pictures from the person the referee has marked as sharing. */
  let sharingAll = false, shareAsk = 0, shareTries = 0, audKey = '';
  const audience = () => (A.S ? A.S.players.filter(p => p.on && !p.cpu && p.pid !== pid).map(p => p.pid) : []);
  function startShare() {
    if (!cred || sharingAll) return;
    sharingAll = true; audKey = '';
    shareTries = 0; askShare();
    document.addEventListener('pointermove', onPtr, true);
    document.addEventListener('pointerdown', onPtr, true);
    document.documentElement.addEventListener('pointerleave', onPtrOut);
    sync();
    boxKey = null; renderBox(); renderShare();
    toast('Everyone can see your game now. Your tiles stay hidden.');
  }
  function askShare() { shareAsk = Date.now(); shareTries++; send({ t: 'share', on: true, u: cred.u, p: cred.p }); }
  function stopShare() {
    if (!sharingAll) return;
    sharingAll = false;
    document.removeEventListener('pointermove', onPtr, true);
    document.removeEventListener('pointerdown', onPtr, true);
    document.documentElement.removeEventListener('pointerleave', onPtrOut);
    send({ t: 'share', on: false });
    sync();
    boxKey = null; renderBox(); renderShare();
  }
  // Where the mouse is, as a share of the window, at most about 15 times a second (a click always goes).
  let ptrAt = 0, ptrT = 0, ptrLast = null;
  function ptrSend(m) { ptrAt = Date.now(); for (const to of audience()) relay(to, m); }
  function onPtr(e) {
    const m = { k: 'sp', x: +(e.clientX / (window.innerWidth || 1)).toFixed(4), y: +(e.clientY / (window.innerHeight || 1)).toFixed(4) };
    if (e.type === 'pointerdown') { clearTimeout(ptrT); ptrT = 0; return ptrSend({ ...m, down: 1 }); }
    ptrLast = m;
    if (ptrT) return;
    ptrT = setTimeout(() => { ptrT = 0; if (ptrLast) ptrSend(ptrLast); }, Math.max(0, 66 - (Date.now() - ptrAt)));
  }
  function onPtrOut() { clearTimeout(ptrT); ptrT = 0; ptrLast = null; ptrSend({ k: 'sp', out: 1 }); }

  // Everyone else: the helper's game, big over the table, or small in a corner, with their pointer.
  const shareEl = document.createElement('div');
  shareEl.id = 'shareView'; shareEl.hidden = true;
  shareEl.innerHTML = `<div class="shhead"><span class="shtitle"></span><button type="button" class="btn" data-sh="size"></button></div>
    <div class="shstage"><div class="shnote">Connecting…</div><div class="shwrap" hidden><iframe sandbox="allow-same-origin" title="Shared game" tabindex="-1"></iframe>
    <svg class="shptr" hidden viewBox="0 0 32 32" aria-hidden="true"><path d="M4 2 L4 26 L10.5 20 L15 30 L19.5 28 L15 18.5 L24 18.5 Z"/></svg></div></div>`;
  document.body.appendChild(shareEl);
  const sFrame = shareEl.querySelector('iframe'), sWrap = shareEl.querySelector('.shwrap'), sStage = shareEl.querySelector('.shstage'), sPtr = shareEl.querySelector('.shptr');
  let shareBig = true, shareFrom = null, sReady = false, sLast = null, sParts = null, sPos = null, sAskT = 0;
  shareEl.addEventListener('click', e => {
    if (e.target.closest('[data-sh=size]') || (!shareBig && e.target.closest('.shstage'))) { shareBig = !shareBig; renderShare(); }
  });
  sFrame.addEventListener('load', () => { sReady = true; if (sLast) paintShare(sLast); });
  // The helper's own reminder that they are sharing, with a Stop button.
  const mineEl = document.createElement('div');
  mineEl.id = 'shareMine'; mineEl.hidden = true;
  mineEl.innerHTML = `<span>${ic('users')}Everyone can see your game (your tiles stay hidden)</span><button type="button" class="btn">Stop</button>`;
  mineEl.querySelector('button').addEventListener('click', () => stopShare());
  document.body.appendChild(mineEl);

  function renderShare() {
    const S = A.S;
    mineEl.hidden = !sharingAll;
    if (sharingAll) {
      // Ours didn't get marked as shared (the referee was busy, or we reconnected): ask again, a few times.
      const meP = S && S.players.find(p => p.pid === pid);
      if (cred && meP && meP.on && !meP.share && Date.now() - shareAsk > 3000 && shareTries < 4) askShare();
      // Someone new at the table gets the whole picture straight away.
      const k = audience().join('|');
      if (k !== audKey) { audKey = k; sendFrame(true); }
    }
    const who = S && S.players.find(p => p.share && p.on && p.pid !== pid);
    if (!who) {
      if (shareFrom) { shareFrom = null; sLast = null; sParts = null; clearInterval(sAskT); sAskT = 0; }
      shareEl.hidden = true;
      return;
    }
    if (shareFrom !== who.pid) {
      shareFrom = who.pid; shareBig = true; sLast = null; sParts = null; sReady = false; sPos = null;
      const links = [...document.querySelectorAll('link[rel=stylesheet]')].map(l => l.outerHTML).join('');
      sFrame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><base href="${esc(location.href)}">${links}<style>html,body{overflow:hidden}</style></head><body></body></html>`;
      sWrap.hidden = true; sPtr.setAttribute('hidden', '');
      shareEl.querySelector('.shnote').hidden = false;
      // ask for a picture until one arrives (we may have joined, or reloaded, after it started)
      const ask = () => { if (shareFrom && !sLast) relay(shareFrom, { k: 'shareme' }); else { clearInterval(sAskT); sAskT = 0; } };
      clearInterval(sAskT); ask(); sAskT = setInterval(ask, 4000);
    }
    shareEl.hidden = false;
    shareEl.classList.toggle('small', !shareBig);
    shareEl.querySelector('.shtitle').textContent = `${who.name} is sharing their game`;
    shareEl.querySelector('[data-sh=size]').innerHTML = shareBig ? `${ic('close')}<span>Make small</span>` : `<span>Make big</span>`;
    shareFit();
  }

  let sK = 1;
  function shareFit() {
    if (!sLast || shareEl.hidden) return;
    const pad = shareBig ? 16 : 0;
    const k = sK = Math.min(1, (sStage.clientWidth - pad) / sLast.w, (sStage.clientHeight - pad) / sLast.h);
    sWrap.style.width = sLast.w * k + 'px'; sWrap.style.height = sLast.h * k + 'px';
    sFrame.style.width = sLast.w + 'px'; sFrame.style.height = sLast.h + 'px';
    sFrame.style.transform = `scale(${k})`;
    placePtr();
  }
  window.addEventListener('resize', shareFit);
  function placePtr() {
    if (!sPos || !sLast || sPos.out) { sPtr.setAttribute('hidden', ''); return; }
    sPtr.removeAttribute('hidden');
    sPtr.style.left = (sPos.x * sLast.w * sK).toFixed(1) + 'px';
    sPtr.style.top = (sPos.y * sLast.h * sK).toFixed(1) + 'px';
  }
  function paintShare(f) {
    sLast = f;
    if (!sReady) return;
    const doc = sFrame.contentDocument;
    if (!doc) return;
    doc.documentElement.className = f.hc || '';
    doc.documentElement.setAttribute('style', f.hs || '');
    doc.body.className = f.bc || '';
    doc.body.innerHTML = f.html;
    shareEl.querySelector('.shnote').hidden = true; sWrap.hidden = false;
    sStage.style.setProperty('--ar', `${f.w} / ${f.h}`);   // used when small: the stage takes the shape of their screen
    shareFit();
    for (const el of doc.querySelectorAll('[data-sx]')) { el.scrollLeft = +el.dataset.sx; el.scrollTop = +el.dataset.sy; }
  }
  function onSharePtr(m) {
    sPos = m.out ? { out: true } : { x: Math.min(1, Math.max(0, +m.x || 0)), y: Math.min(1, Math.max(0, +m.y || 0)) };
    placePtr();
    if (m.down) { sPtr.classList.remove('down'); void sPtr.getBoundingClientRect(); sPtr.classList.add('down'); }
  }

  // The viewer: their page, drawn in a frame the size of their screen and shrunk to fit mine.
  const viewer = document.createElement('div');
  viewer.id = 'viewer'; viewer.hidden = true;
  viewer.innerHTML = `<div class="vhead"><span class="vtitle"></span><span class="vinfo"></span><button type="button" class="btn vctl" data-help="ctl">${ic('stop')}<span>Take control</span></button><button type="button" class="btn" data-help="close">${ic('close')}<span>Close</span></button></div>
    <div class="vstage"><div class="vnote"></div><div class="vwrap"><iframe sandbox="allow-same-origin" title="Their screen" tabindex="-1"></iframe></div></div>`;
  document.body.appendChild(viewer);
  const frame = viewer.querySelector('iframe'), wrap = viewer.querySelector('.vwrap'), stage = viewer.querySelector('.vstage');
  viewer.querySelector('[data-help=close]').addEventListener('click', () => closeViewer());
  let frameReady = false, last = null, keepT = 0, waitT = 0;
  // control: 'off', 'asked' (waiting for them to allow it) or 'on'
  let ctl = 'off';
  const ctlBtn = viewer.querySelector('[data-help=ctl]');
  function setCtl(v) {
    ctl = v;
    ctlBtn.classList.toggle('on', v === 'on');
    ctlBtn.querySelector('span').textContent = v === 'on' ? 'Stop controlling' : v === 'asked' ? 'Waiting for them to allow…' : 'Take control';
    viewer.classList.toggle('controlling', v === 'on');
    if (frame.contentDocument && frame.contentDocument.body) frame.contentDocument.body.classList.toggle('hctl', v === 'on');
  }
  ctlBtn.addEventListener('click', () => {
    if (!viewing) return;
    if (ctl === 'off') { setCtl('asked'); relay(viewing.pid, { k: 'ctlask' }); }
    else { relay(viewing.pid, { k: 'ctlend' }); setCtl('off'); }
  });
  // What a tap, typing or scrolling on the picture means on their page: the element (by its place in the page,
  // checked again on their side) and what to do with it.
  const ref = el => ({ hx: +el.getAttribute('data-hx'), tag: el.tagName, id: el.id || null, act: el.getAttribute('data-act') || null });
  const doIt = m => { if (viewing && ctl === 'on') relay(viewing.pid, { k: 'do', ...m }); };
  const typing = el => el && ((el.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|range|color)$/.test(el.type)) || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
  frame.addEventListener('load', () => {
    const doc = frame.contentDocument;
    if (!doc) return;
    doc.addEventListener('click', e => {
      if (ctl !== 'on') { e.preventDefault(); return; }
      const t = e.target.closest && e.target.closest('[data-hx]');
      if (!t) return;
      if (typing(t)) return;   // typed into, below
      e.preventDefault();
      const el = t.closest('button, a, label, input, select, summary, [data-act], [role=button], .swatch') || t;
      doIt({ a: 'click', ...ref(el) });
    }, true);
    let typeT = 0;
    doc.addEventListener('input', e => {
      const t = e.target;
      if (ctl !== 'on' || !typing(t) || !t.hasAttribute('data-hx')) return;
      clearTimeout(typeT);
      typeT = setTimeout(() => doIt({ a: 'set', v: String(t.value).slice(0, 200), ...ref(t) }), t.tagName === 'SELECT' ? 0 : 200);
    }, true);
    doc.addEventListener('keydown', e => {
      if (ctl === 'on' && e.key === 'Enter' && typing(e.target) && e.target.hasAttribute('data-hx')) { e.preventDefault(); clearTimeout(typeT); doIt({ a: 'set', v: String(e.target.value).slice(0, 200), enter: true, ...ref(e.target) }); }
    }, true);
    doc.addEventListener('submit', e => e.preventDefault(), true);
    doc.addEventListener('wheel', e => {
      if (ctl !== 'on') return;
      const t = e.target.closest && e.target.closest('[data-hx]');
      if (t) { e.preventDefault(); doIt({ a: 'scroll', dy: Math.max(-600, Math.min(600, e.deltaY)), ...ref(t) }); }
    }, { passive: false, capture: true });
  });
  frame.addEventListener('load', () => { frameReady = true; if (last) paint(last); });

  function note(text) { const n = viewer.querySelector('.vnote'); n.textContent = text; n.hidden = !text; }

  function view(id) {
    if (!cred || cred.role !== 'helper') return;
    closeViewer();
    viewing = { pid: id, name: nameOf(id), parts: null };
    last = null; frameReady = false;
    const links = [...document.querySelectorAll('link[rel=stylesheet]')].map(l => l.outerHTML).join('');
    // with control on, the parts that are theirs to play show a no-entry cursor
    const blocked = BLOCKED.split(',').map(x => `body.hctl ${x.trim()}, body.hctl ${x.trim()} *`).join(',');
    frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><base href="${esc(location.href)}">${links}<style>html,body{overflow:hidden} body.hctl{cursor:pointer} ${blocked}{cursor:not-allowed !important}</style></head><body></body></html>`;
    setCtl('off');
    viewer.querySelector('.vtitle').textContent = `${viewing.name}'s screen`;
    viewer.querySelector('.vinfo').textContent = 'Tiles in their hand are hidden';
    wrap.hidden = true;
    note(`Asking ${viewing.name}'s device…`);
    viewer.hidden = false;
    const ask = () => viewing && relay(viewing.pid, { k: 'watch', u: cred.u, p: cred.p });
    ask();
    keepT = setInterval(ask, KEEP_MS);
    waitT = setTimeout(() => { if (viewing && !last) note(`No answer from ${viewing.name}'s device. They may need to refresh the page to get the latest version.`); }, 9000);
  }

  function closeViewer(quiet) {
    clearInterval(keepT); clearTimeout(waitT);
    if (viewing && ctl !== 'off' && !quiet) relay(viewing.pid, { k: 'ctlend' });
    setCtl('off');
    if (viewing && !quiet) relay(viewing.pid, { k: 'unwatch' });
    viewing = null; last = null;
    viewer.hidden = true;
  }

  function fit() {
    if (!last) return;
    const k = Math.min(1, (stage.clientWidth - 24) / last.w, (stage.clientHeight - 24) / last.h);
    wrap.style.width = last.w * k + 'px'; wrap.style.height = last.h * k + 'px';
    frame.style.width = last.w + 'px'; frame.style.height = last.h + 'px';
    frame.style.transform = `scale(${k})`;
  }
  window.addEventListener('resize', fit);

  function paint(f) {
    last = f;
    clearTimeout(waitT);
    if (!frameReady) return;
    const doc = frame.contentDocument;
    if (!doc) return;
    const act = doc.activeElement, keepHx = act && act.getAttribute && act.getAttribute('data-hx');
    const caret = keepHx && typeof act.selectionStart === 'number' ? [act.selectionStart, act.selectionEnd, act.value] : null;
    doc.documentElement.className = f.hc || '';
    doc.documentElement.setAttribute('style', f.hs || '');
    doc.body.className = f.bc || '';
    doc.body.innerHTML = f.html;
    doc.body.classList.toggle('hctl', ctl === 'on');
    if (keepHx) {
      const el = doc.querySelector(`[data-hx="${keepHx}"]`);
      if (el && el.tagName === act.tagName) { if (caret) { el.value = caret[2]; } el.focus(); if (caret) try { el.setSelectionRange(caret[0], caret[1]); } catch (e) { /* not a text box */ } }
    }
    note(''); wrap.hidden = false;
    fit();
    for (const el of doc.querySelectorAll('[data-sx]')) { el.scrollLeft = +el.dataset.sx; el.scrollTop = +el.dataset.sy; }
    const i = f.info || {};
    const bits = [`${f.w}×${f.h}`, device(i.ua || ''), i.touch ? 'touch' : 'mouse', `text ${Math.round((i.zoom || 1) * 100)}%`, i.status === 'host' ? 'connected (hosting)' : i.status === 'client' ? 'connected' : i.status, `camera ${i.cam ? 'on' : 'off'}`];
    if (i.errs && i.errs.length) bits.push('error: ' + i.errs[i.errs.length - 1]);
    viewer.querySelector('.vinfo').textContent = 'Tiles in their hand are hidden · ' + bits.join(' · ');
  }

  /* ---------------- the side being looked at ---------------- */

  const banner = document.createElement('div');
  banner.id = 'helpBanner'; banner.hidden = true;
  document.body.appendChild(banner);
  banner.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.ctl) {
      const w = watchers.get(b.dataset.ctl);
      if (w) { w.ask = false; w.ctl = b.dataset.yes === '1'; relay(b.dataset.ctl, { k: w.ctl ? 'ctlok' : 'ctlno' }); }
      return sync();
    }
    for (const id of watchers.keys()) relay(id, { k: 'stop' });
    watchers.clear(); sync();
  });

  let obs = null, frameT = 0, lastSent = 0, lastHtml = '', frameId = 0, dropT = 0;
  const soon = () => { if (!frameT && (watchers.size || sharingAll)) frameT = setTimeout(sendFrame, Math.max(0, FRAME_MS - (Date.now() - lastSent))); };

  function sync() {
    const names = [...watchers.keys()].map(nameOf);
    const asking = [...watchers].find(([, w]) => w.ask), driving = [...watchers].filter(([, w]) => w.ctl).map(([id]) => nameOf(id));
    banner.hidden = !names.length;
    banner.classList.toggle('ctl', !!driving.length || !!asking);
    const html = !names.length ? ''
      : asking ? `<span>${ic('users')}<b>${esc(nameOf(asking[0]))}</b> wants to control your screen to help. They can't see or touch your cards or tiles.</span><button type="button" class="btn go" data-ctl="${esc(asking[0])}" data-yes="1">Allow</button><button type="button" class="btn" data-ctl="${esc(asking[0])}" data-yes="0">No</button>`
      : driving.length ? `<span>${ic('users')}<b>${esc(driving.join(', '))}</b> is controlling your screen to help. They can't see or touch your cards or tiles.</span><button type="button" class="btn">Stop</button>`
      : `<span>${ic('users')}<b>${esc(names.join(', '))}</b> can see your screen to help. They can't see or touch your cards or tiles.</span><button type="button" class="btn">Stop</button>`;
    if (banner.innerHTML !== html) banner.innerHTML = html;
    const any = names.length || sharingAll;
    if (any && !obs) {
      obs = new MutationObserver(soon);
      obs.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
      document.addEventListener('scroll', soon, true);
      window.addEventListener('resize', soon);
      dropT = setInterval(() => {
        const n = Date.now();
        let gone = false;
        for (const [id, w] of watchers) if (n - w.at > DROP_MS) { watchers.delete(id); gone = true; }
        if (gone) sync();
      }, 5000);
    } else if (!any && obs) {
      obs.disconnect(); obs = null;
      document.removeEventListener('scroll', soon, true);
      window.removeEventListener('resize', soon);
      clearInterval(dropT); clearTimeout(frameT); frameT = 0; lastHtml = '';
    }
  }

  // A copy of the page as it is now, with anything private taken out.
  function capture() {
    const body = document.body.cloneNode(true);
    const L = document.body.querySelectorAll('*'), C = body.querySelectorAll('*');
    for (let i = 0; i < L.length; i++) {
      const l = L[i], c = C[i];
      c.setAttribute('data-hx', i);
      if (l.scrollLeft || l.scrollTop) { c.setAttribute('data-sx', l.scrollLeft); c.setAttribute('data-sy', l.scrollTop); }
      const tag = l.tagName;
      if (tag === 'INPUT') {
        if (l.type === 'checkbox' || l.type === 'radio') { if (l.checked) c.setAttribute('checked', ''); else c.removeAttribute('checked'); }
        else if (l.type === 'password') c.removeAttribute('value');
        else c.setAttribute('value', l.value);
      } else if (tag === 'VIDEO') {
        const ph = document.createElement('div');
        ph.className = 'vidph'; ph.textContent = 'Camera picture';
        c.replaceWith(ph);
      }
    }
    body.querySelectorAll('script, iframe, #viewer, #helpBox, #shareView, #shareMine').forEach(n => n.remove());
    // The tiles in the hand (and any being carried) are blanked.
    body.querySelectorAll('#rack .tile, .ghost .tile').forEach(t => {
      t.className = 'tile hid'; t.innerHTML = '';
      t.removeAttribute('data-id'); t.removeAttribute('aria-label');
    });
    // and so are the cards in a Color Clash hand
    body.querySelectorAll('#hand .cc').forEach(t => {
      t.className = 'cc back'; t.innerHTML = '';
      t.removeAttribute('data-card'); t.removeAttribute('data-id'); t.removeAttribute('aria-label');
    });
    // and playing cards (Idiot, Hearts) and dominoes in the hand
    body.querySelectorAll('#hand .pc').forEach(t => { t.className = 'pc back'; t.innerHTML = ''; t.removeAttribute('aria-label'); });
    body.querySelectorAll('#hand .dm').forEach(t => { t.className = 'dm v hid'; t.innerHTML = '<span class="dh"></span><span class="dh"></span>'; t.removeAttribute('aria-label'); });
    body.querySelectorAll('#hand [data-id]').forEach(t => t.removeAttribute('data-id'));
    // the face-down tiles in the draw for who goes first stay face down
    body.querySelectorAll('.pkw:not(.up):not(.anim) .pk-front').forEach(t => { t.innerHTML = ''; });
    return body.innerHTML;
  }

  function sendFrame(force) {
    clearTimeout(frameT); frameT = 0;
    if (!watchers.size && !sharingAll) return;
    lastSent = Date.now();
    let html;
    try { html = capture(); } catch (e) { return; }
    const de = document.documentElement;
    // (a tab in the background can report no size at all)
    const w = window.innerWidth || de.clientWidth || 800, h = window.innerHeight || de.clientHeight || 600;
    const sig = w + 'x' + h + html;
    if (!force && sig === lastHtml) return;
    lastHtml = sig;
    const text = JSON.stringify({
      w, h, hc: de.className, hs: de.getAttribute('style') || '', bc: document.body.className, html,
      info: { ua: navigator.userAgent.slice(0, 200), touch: navigator.maxTouchPoints > 0, zoom: A.zoom, status: A.status, cam: A.camOn, errs: errors },
    });
    const n = Math.ceil(text.length / CHUNK), id = ++frameId;
    for (const to of watchers.keys()) for (let i = 0; i < n; i++) relay(to, { k: 'f', id, i, n, d: text.slice(i * CHUNK, (i + 1) * CHUNK) });
    if (sharingAll) for (const to of audience()) for (let i = 0; i < n; i++) relay(to, { k: 'sf', id, i, n, d: text.slice(i * CHUNK, (i + 1) * CHUNK) });
  }

  // Find the element the helper means on this page, and check it is one they may use.
  function target(m) {
    let el = Number.isInteger(m.hx) && m.hx >= 0 ? document.body.querySelectorAll('*')[m.hx] : null;
    const same = e => e && e.tagName === m.tag && (m.id ? e.id === m.id : true) && (m.act ? e.getAttribute('data-act') === m.act : true);
    if (!same(el)) {
      el = (m.id && document.getElementById(m.id)) || (m.act && [...document.querySelectorAll('[data-act]')].find(e => e.getAttribute('data-act') === m.act)) || null;
      if (!same(el)) return null;
    }
    return el;
  }
  function allowed(el) {
    if (!el || !document.body.contains(el)) return false;
    if (el.closest(BLOCKED)) return false;
    // during a game the middle of the screen is the game itself
    if (A.S && A.S.phase === 'play' && el.closest('#center')) return false;
    return true;
  }
  // a ring where the helper tapped, so it is clear what they are doing
  function ping(el) {
    const r = el.getBoundingClientRect(), d = document.createElement('div');
    d.className = 'helpping';
    d.style.left = r.left + r.width / 2 + 'px'; d.style.top = r.top + r.height / 2 + 'px';
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 700);
  }
  function onDo(from, m) {
    const w = watchers.get(from);
    if (!w || !w.ctl) return;
    w.at = Date.now();
    const el = target(m);
    if (!allowed(el)) return relay(from, { k: 'nope' });
    ping(el);
    if (m.a === 'click') {
      if (el.tagName === 'INPUT' && /^(text|search|email|number|tel|url)$/.test(el.type)) el.focus();
      else el.click();
    } else if (m.a === 'set' && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') && el.type !== 'password') {
      el.value = String(m.v || '').slice(0, 200);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      if (m.enter && el.form) el.form.requestSubmit();
    } else if (m.a === 'scroll') {
      let s = el;
      while (s && s !== document.body && !(s.scrollHeight > s.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(s).overflowY))) s = s.parentElement;
      (s && s !== document.body ? s : document.scrollingElement).scrollBy(0, +m.dy || 0);
    }
    soon();
  }

  let checking = false, lastCheck = 0;
  async function onWatch(from, m) {
    const tok = String(m.u) + '\n' + String(m.p);
    const w = watchers.get(from);
    if (w && w.tok === tok) { w.at = Date.now(); return; }
    // One sign-in check at a time, and not in quick succession, so nobody can sit there guessing.
    if (checking || Date.now() - lastCheck < 2000) return;
    checking = true;
    const ok = (await check(m.u, m.p)) === 'helper';
    checking = false; lastCheck = Date.now();
    if (!ok) return relay(from, { k: 'deny' });
    watchers.set(from, { tok, at: Date.now() });
    sync();
    sendFrame(true);
  }

  return {
    rx(from, m) {
      if (!m || typeof from !== 'string') return;
      if (m.k === 'watch') return void onWatch(from, m);
      if (m.k === 'unwatch') { if (watchers.delete(from)) sync(); return; }
      if (m.k === 'ctlask') { const w = watchers.get(from); if (w && !w.ctl) { w.ask = true; sync(); } return; }
      if (m.k === 'ctlend') { const w = watchers.get(from); if (w) { w.ctl = false; w.ask = false; sync(); } return; }
      if (m.k === 'do') return onDo(from, m);
      if (m.k === 'hush') return void onHush(from, m);
      if (m.k === 'peek') return void onPeek(from, m);
      if (m.k === 'peekans') {
        if (!peekAsk || peekAsk.pid !== from || Date.now() - peekAsk.at > 15000) return;
        peekAsk = null;
        if (hooks.showPeek) hooks.showPeek(from, m);
        return;
      }
      // the helper's game, shared with everyone
      if (m.k === 'shareme') { if (sharingAll && Date.now() - lastSent > 1000) sendFrame(true); return; }
      if (from === shareFrom && m.k === 'sp') return onSharePtr(m);
      if (from === shareFrom && m.k === 'sf') {
        let p = sParts;
        if (!p || p.id !== m.id) p = sParts = { id: m.id, n: m.n, got: 0, d: [] };
        if (p.d[m.i] == null) { p.d[m.i] = String(m.d); p.got++; }
        if (p.got === p.n) { sParts = null; try { paintShare(JSON.parse(p.d.join(''))); } catch (e) { /* a broken picture is skipped */ } }
        return;
      }
      if (!viewing || from !== viewing.pid) return;
      if (m.k === 'ctlok') { setCtl('on'); toast(`${viewing.name} let you control their screen. Their cards and tiles stay theirs.`); return; }
      if (m.k === 'ctlno') { setCtl('off'); toast(`${viewing.name} said no to control.`); return; }
      if (m.k === 'nope') { toast('That part is theirs to play, so it can\'t be done for them.', 2500); return; }
      if (m.k === 'deny') { closeViewer(true); toast('Their device did not accept the helper sign-in.'); }
      else if (m.k === 'stop') { const n = viewing.name; closeViewer(true); toast(`${n} stopped showing their screen.`); }
      else if (m.k === 'f') {
        let p = viewing.parts;
        if (!p || p.id !== m.id) p = viewing.parts = { id: m.id, n: m.n, got: 0, d: [] };
        if (p.d[m.i] == null) { p.d[m.i] = String(m.d); p.got++; }
        if (p.got === p.n) { viewing.parts = null; try { paint(JSON.parse(p.d.join(''))); } catch (e) { /* a broken picture is skipped */ } }
      }
    },
    // The players changed: tidy the list, and forget anyone who has gone.
    state() {
      renderBox();
      renderShare();
      let gone = false;
      for (const id of watchers.keys()) { const p = A.S && A.S.players.find(q => q.pid === id); if (!p || !p.on) { watchers.delete(id); gone = true; } }
      if (gone) sync();
      if (viewing) {
        const p = A.S && A.S.players.find(q => q.pid === viewing.pid);
        if (!p || !p.on) note(`${viewing.name} is not connected right now.`);
        else if (last) note('');
      }
    },
    leave() { closeViewer(true); watchers.clear(); sync(); stopShare(); renderShare(); },
    render: renderBox,
    role: () => (cred ? cred.role : null),
    peek,
  };
}
