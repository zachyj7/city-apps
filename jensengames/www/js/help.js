// Helper view: someone who signs in as the helper can look at another player's screen to sort out a
// technical problem. The other player's browser sends a picture of its page (as HTML, never the real
// screen), with the tiles in their hand blanked out, and shows a notice with a Stop button while it does.
//
// The sign-in is checked in each browser against a scrambled copy of the username and password, so the
// plain text is not in this file. It keeps casual visitors out; it is not strong security.
// (The salt keeps the game's old name on purpose: changing it would stop the existing sign-in working.)
const SALT = 'familytiles-helper-v1', ROUNDS = 200000;
const KEYS = { helper: 'ed5ea437a688e4ea739c93fd156211d6e1b537c4ca62320fa177fa8faeb98969' };
const CHUNK = 12000;        // one message stays well under what a data channel will carry
const FRAME_MS = 600;       // at most this often
const KEEP_MS = 6000;       // the helper says "still here" this often
const DROP_MS = 20000;      // and is forgotten after this long without it

// Which login this is ('helper'), or null. (The referee uses it too, for the coach switch.)
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

export function initHelp({ A, pid, send, toast, esc, ic }) {
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
    const key = cred ? cred.role + '|' + statsOn + '|' + people.map(p => p.pid + p.name).join('|') : 'out';
    if (key === boxKey) return;
    boxKey = key;
    if (!cred) {
      box.innerHTML = `<details class="helpin"><summary>${ic('lock')}Helper sign-in</summary>
        <form id="helpForm" autocomplete="off">
          <input id="helpUser" aria-label="Username" placeholder="Username" autocapitalize="none" spellcheck="false" maxlength="40">
          <input id="helpPass" type="password" aria-label="Password" placeholder="Password" maxlength="60">
          <button class="btn" type="submit">Sign in</button>
        </form></details>`;
      return;
    }
    box.innerHTML = `<span class="setlabel">${ic('users')}Helper: view a screen<button type="button" class="linkbtn" data-help="out">Sign out</button></span>
      <div class="helplist">${people.length
        ? people.map(p => `<button type="button" class="btn" data-view="${esc(p.pid)}">${esc(p.name)}</button>`).join('')
        : '<span class="helpnone">Nobody else is at the table yet.</span>'}</div>
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
    cred = { u, p, role };
    renderBox();
  });
  box.addEventListener('click', e => {
    const v = e.target.closest('[data-view]');
    if (v) return view(v.dataset.view);
    if (e.target.closest('[data-help=out]')) { closeViewer(); cred = null; renderBox(); }
  });

  // The viewer: their page, drawn in a frame the size of their screen and shrunk to fit mine.
  const viewer = document.createElement('div');
  viewer.id = 'viewer'; viewer.hidden = true;
  viewer.innerHTML = `<div class="vhead"><span class="vtitle"></span><span class="vinfo"></span><button type="button" class="btn" data-help="close">${ic('close')}<span>Close</span></button></div>
    <div class="vstage"><div class="vnote"></div><div class="vwrap"><iframe sandbox="allow-same-origin" title="Their screen" tabindex="-1"></iframe></div></div>`;
  document.body.appendChild(viewer);
  const frame = viewer.querySelector('iframe'), wrap = viewer.querySelector('.vwrap'), stage = viewer.querySelector('.vstage');
  viewer.querySelector('[data-help=close]').addEventListener('click', () => closeViewer());
  let frameReady = false, last = null, keepT = 0, waitT = 0;
  frame.addEventListener('load', () => { frameReady = true; if (last) paint(last); });

  function note(text) { const n = viewer.querySelector('.vnote'); n.textContent = text; n.hidden = !text; }

  function view(id) {
    if (!cred || cred.role !== 'helper') return;
    closeViewer();
    viewing = { pid: id, name: nameOf(id), parts: null };
    last = null; frameReady = false;
    const links = [...document.querySelectorAll('link[rel=stylesheet]')].map(l => l.outerHTML).join('');
    frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><base href="${esc(location.href)}">${links}<style>html,body{overflow:hidden}</style></head><body></body></html>`;
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
    doc.documentElement.className = f.hc || '';
    doc.documentElement.setAttribute('style', f.hs || '');
    doc.body.className = f.bc || '';
    doc.body.innerHTML = f.html;
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
    if (!e.target.closest('button')) return;
    for (const id of watchers.keys()) relay(id, { k: 'stop' });
    watchers.clear(); sync();
  });

  let obs = null, frameT = 0, lastSent = 0, lastHtml = '', frameId = 0, dropT = 0;
  const soon = () => { if (!frameT && watchers.size) frameT = setTimeout(sendFrame, Math.max(0, FRAME_MS - (Date.now() - lastSent))); };

  function sync() {
    const names = [...watchers.keys()].map(nameOf);
    banner.hidden = !names.length;
    const html = names.length ? `<span>${ic('users')}<b>${esc(names.join(', '))}</b> can see your screen to help. Your tiles are hidden.</span><button type="button" class="btn">Stop</button>` : '';
    if (banner.innerHTML !== html) banner.innerHTML = html;
    if (names.length && !obs) {
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
    } else if (!names.length && obs) {
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
    body.querySelectorAll('script, iframe, #viewer, #helpBox').forEach(n => n.remove());
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
    return body.innerHTML;
  }

  function sendFrame(force) {
    clearTimeout(frameT); frameT = 0;
    if (!watchers.size) return;
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
      if (!viewing || from !== viewing.pid) return;
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
      let gone = false;
      for (const id of watchers.keys()) { const p = A.S && A.S.players.find(q => q.pid === id); if (!p || !p.on) { watchers.delete(id); gone = true; } }
      if (gone) sync();
      if (viewing) {
        const p = A.S && A.S.players.find(q => q.pid === viewing.pid);
        if (!p || !p.on) note(`${viewing.name} is not connected right now.`);
        else if (last) note('');
      }
    },
    leave() { closeViewer(true); watchers.clear(); sync(); },
    render: renderBox,
  };
}
