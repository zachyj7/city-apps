/* Everything drawn with HTML: HUD, dialogue, menus, shop, map, story crawl. */
import { ITEMS, WAYSTONES, PAGES, MINUTES, SHOPS, xpNeed } from './data.js';
import { QUESTS, NPCS } from './story.js';
import { HALF } from './world.js';
import { clamp, TAU } from './util.js';

const $ = id => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const TYPES = [['weapon', 'Weapons'], ['armor', 'Armour'], ['trinket', 'Trinkets'], ['glyph', 'Glyphs'], ['use', 'Supplies'], ['mat', 'Materials'], ['key', 'Keepsakes']];

export function statLine(it) {
  const s = [];
  if (it.atk) s.push('Attack ' + it.atk);
  if (it.def) s.push('Defence ' + it.def);
  if (it.hp) s.push('+' + it.hp + ' health');
  if (it.heal) s.push(it.heal > 999 ? 'Full heal' : 'Heals ' + it.heal);
  return s.join(' · ');
}

export class UI {
  constructor(g) {
    this.g = g; this.dialogOpen = false; this.menuOpen = false; this.crawlOpen = false; this.titleOpen = true;
    this.tab = 'Pack'; this.sel = null; this.shopId = null; this.resolve = null; this.typing = null;
    $('dialog').addEventListener('pointerdown', e => { e.stopPropagation(); if (e.target.tagName !== 'BUTTON') this.advance(); });
    $('menuClose').onclick = () => this.closeMenu();
    $('menu').addEventListener('pointerdown', e => { if (e.target.id === 'menu') this.closeMenu(); });
    $('menuBtn').onclick = () => { if (!g.combat.active) this.openMenu(); };
    $('act').addEventListener('pointerdown', e => { e.stopPropagation(); g.interact(); });
    $('flowBtn').addEventListener('pointerdown', e => { e.stopPropagation(); g.combat.flow(); });
    $('potBtn').addEventListener('pointerdown', e => { e.stopPropagation(); g.combat.potion(); });
    $('fleeBtn').addEventListener('pointerdown', e => { e.stopPropagation(); g.combat.flee(); });
    $('crawl').addEventListener('pointerdown', () => this.crawlNext && this.crawlNext());
    this.mini = $('mini').getContext('2d');
  }
  get blocking() { return this.dialogOpen || this.menuOpen || this.crawlOpen || this.titleOpen; }

  /* ---- dialogue ---- */
  show(name, text) {
    clearTimeout(this.hideT);
    this.dialogOpen = true; $('dialog').classList.remove('hidden');
    $('dName').textContent = name || ''; $('dChoices').innerHTML = ''; $('dMore').style.display = 'none';
    const t = $('dText'); t.textContent = ''; t.style.fontStyle = name ? 'normal' : 'italic';
    let i = 0; clearInterval(this.typing);
    return new Promise(done => {
      this.finishType = () => { clearInterval(this.typing); this.typing = null; t.textContent = text; done(); };
      this.typing = setInterval(() => { i += 2; t.textContent = text.slice(0, i); if (i >= text.length) this.finishType(); }, 16);
    });
  }
  hideSoon() { this.hideT = setTimeout(() => { this.dialogOpen = false; $('dialog').classList.add('hidden'); }, 40); }
  async say(name, text) {
    await this.show(name, text);
    $('dMore').style.display = '';
    await new Promise(r => { this.resolve = r; });
    this.resolve = null; this.g.sfx.click(); this.hideSoon();
  }
  async choose(name, text, options) {
    await this.show(name, text);
    const box = $('dChoices');
    const i = await new Promise(r => {
      this.pick = r;
      options.forEach((o, i) => { const b = el('button', '', (i + 1) + '. ' + o); b.onclick = e => { e.stopPropagation(); r(i); }; box.appendChild(b); });
    });
    this.pick = null; box.innerHTML = ''; this.g.sfx.click(); this.hideSoon();
    return i;
  }
  advance() { if (this.typing) this.finishType(); else if (this.resolve) this.resolve(); }
  key(n) { if (this.pick && n < $('dChoices').children.length) this.pick(n); }

  async crawl(lines) {
    this.crawlOpen = true; $('crawl').classList.remove('hidden');
    const t = $('crawlText');
    for (const l of lines) {
      t.style.opacity = 0; await new Promise(r => setTimeout(r, 350));
      t.textContent = l; t.classList.toggle('big', l === l.toUpperCase() && l.length < 30); t.style.opacity = 1;
      await new Promise(r => { const go = () => { clearTimeout(tm); this.crawlNext = null; r(); }; const tm = setTimeout(go, 9000); setTimeout(() => { this.crawlNext = go; }, 500); });
    }
    t.style.opacity = 0; await new Promise(r => setTimeout(r, 500));
    $('crawl').classList.add('hidden'); this.crawlOpen = false;
  }

  toast(text, good) {
    const t = el('div', 'toast' + (good ? ' good' : ''), text); $('toasts').appendChild(t);
    while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
    setTimeout(() => t.remove(), 3000);
  }
  region(name, sub) {
    const r = $('region'); r.innerHTML = name + (sub ? '<small>' + sub + '</small>' : ''); r.classList.add('show');
    clearTimeout(this.regT); this.regT = setTimeout(() => r.classList.remove('show'), 2600);
  }
  fade(on) { $('fade').classList.toggle('on', on); return new Promise(r => setTimeout(r, 520)); }

  /* ---- HUD ---- */
  hud() {
    const g = this.g, S = g.S, st = g.stats(), inC = g.combat.active;
    $('hpFill').style.width = clamp(S.hp / st.maxHp * 100, 0, 100) + '%';
    $('hpText').textContent = Math.ceil(S.hp) + ' / ' + st.maxHp;
    $('xpFill').style.width = clamp(S.xp / xpNeed(S.level) * 100, 0, 100) + '%';
    $('focusFill').style.width = g.focus + '%';
    $('focusFill').parentElement.classList.toggle('full', g.focus >= 100);
    $('lvl').textContent = S.level; $('coins').textContent = S.coins;
    const q = g.tracked();
    $('quest').innerHTML = q && !inC ? '<b>' + q.name + '</b>' + q.text + (q.dist !== null ? ' <small>' + q.dir + ' ' + q.dist + 'm</small>' : '') : '';
    const a = $('act'), near = !inC && !this.blocking && g.nearest;
    a.classList.toggle('hidden', !near);
    if (near && a.dataset.l !== near.label) { a.dataset.l = near.label; a.innerHTML = near.label + (g.touch ? '' : '<kbd>E</kbd>'); }
    $('flowBtn').classList.toggle('hidden', !(inC && g.focus >= 100 && g.combat.flowT <= 0));
    $('fleeBtn').classList.toggle('hidden', !inC || g.combat.boss);
    const pots = g.has('tonic') + g.has('tonic2') + g.has('elixir');
    $('potBtn').classList.toggle('hidden', !inC || !pots);
    $('potBtn').textContent = '🧪 ' + pots + (g.touch ? '' : ' (Q)');
    $('flowBtn').textContent = g.touch ? 'FLOW' : 'FLOW (F)';
    $('menuBtn').classList.toggle('hidden', inC); $('mini').classList.toggle('hidden', inC);
    if (!inC) this.drawMini();
  }
  drawMini() {
    const g = this.g, c = this.mini, size = 220, span = 170, k = size / span, p = g.player;
    const X = x => (x - p.x) * k + size / 2, Z = z => (z - p.z) * k + size / 2;
    c.fillStyle = '#3f7f96'; c.fillRect(0, 0, size, size);
    c.drawImage(g.world.map, X(-HALF), Z(-HALF), HALF * 2 * k, HALF * 2 * k);
    this.markers(c, X, Z, size, false);
  }
  markers(c, X, Z, size, labels) {
    const g = this.g, p = g.player, dot = (x, z, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(X(x), Z(z), r, 0, TAU); c.fill(); c.lineWidth = 1.5; c.strokeStyle = 'rgba(0,0,0,.6)'; c.stroke(); };
    for (const n of NPCS) dot(n.x, n.z, labels ? 3 : 4, '#ffffff');
    for (const w of WAYSTONES) if (g.S.way[w.id]) {
      dot(w.x, w.z, labels ? 5 : 6, '#22d3b4');
      if (labels) { c.font = '600 11px system-ui'; c.textAlign = 'center'; c.fillStyle = '#fff'; c.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = 3; c.strokeText(w.name, X(w.x), Z(w.z) - 9); c.fillText(w.name, X(w.x), Z(w.z) - 9); }
    }
    const t = g.target();
    if (t) {
      let x = X(t[0]), z = Z(t[1]);
      const dx = x - size / 2, dz = z - size / 2, d = Math.hypot(dx, dz), max = size / 2 - 12;
      if (!labels && d > max) { x = size / 2 + dx / d * max; z = size / 2 + dz / d * max; }
      c.save(); c.translate(x, z); c.rotate(Math.PI / 4); c.fillStyle = '#ffd58a'; c.strokeStyle = '#2a1e10'; c.lineWidth = 2;
      const s = labels ? 6 : 8; c.fillRect(-s, -s, s * 2, s * 2); c.strokeRect(-s, -s, s * 2, s * 2); c.restore();
    }
    c.save(); c.translate(X(p.x), Z(p.z)); c.rotate(-p.rot + Math.PI);
    const s = labels ? 8 : 11;
    c.fillStyle = '#fff'; c.strokeStyle = '#1b1838'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, -s); c.lineTo(s * 0.7, s * 0.8); c.lineTo(0, s * 0.4); c.lineTo(-s * 0.7, s * 0.8); c.closePath(); c.fill(); c.stroke();
    c.restore();
  }

  /* ---- menu ---- */
  openMenu(tab, keepShop) {
    if (!keepShop) this.shopId = null;
    this.menuOpen = true; this.tab = tab || (this.shopId ? 'Shop' : this.tab === 'Shop' ? 'Pack' : this.tab);
    $('menu').classList.remove('hidden'); this.render(); this.g.sfx.click();
  }
  closeMenu() { this.menuOpen = false; this.shopId = null; if (this.tab === 'Shop') this.tab = 'Pack'; $('menu').classList.add('hidden'); if (this.shopDone) { this.shopDone(); this.shopDone = null; } this.g.save(); }
  shop(id, name) { this.shopId = id; this.shopName = name; this.openMenu('Shop', true); return new Promise(r => { this.shopDone = r; }); }
  render() {
    const tabs = $('tabs'), names = (this.shopId ? ['Shop'] : []).concat(['Pack', 'Quests', 'Map', 'Journal', 'System']);
    tabs.innerHTML = '';
    for (const n of names) { const b = el('button', n === this.tab ? 'on' : '', n === 'Shop' ? this.shopName : n); b.onclick = () => { this.tab = n; this.sel = null; this.render(); }; tabs.appendChild(b); }
    const body = $('menuBody'), keep = body.scrollTop; body.innerHTML = '';
    this['tab' + this.tab](body);
    body.scrollTop = keep;
  }
  tabPack(body) {
    const g = this.g, S = g.S, st = g.stats();
    body.appendChild(el('div', 'stats', `<span>Level <b>${S.level}</b></span><span>Health <b>${Math.ceil(S.hp)}/${st.maxHp}</b></span><span>Attack <b>${Math.round(st.atk)}</b></span><span>Defence <b>${st.def}</b></span><span>Coin <b>${S.coins}</b></span>`));
    for (const [type, title] of TYPES) {
      const ids = Object.keys(S.inv).filter(id => S.inv[id] > 0 && ITEMS[id].type === type);
      if (!ids.length) continue;
      body.appendChild(el('h3', '', title + (type === 'glyph' ? ' (equip up to two)' : '')));
      const grid = el('div', 'grid');
      for (const id of ids) {
        const it = ITEMS[id], b = el('button', 'item' + (g.isEquipped(id) ? ' eq' : '') + (this.sel === id ? ' sel' : ''), `<span class="ic">${it.icon}</span><span class="nm">${it.name}</span>${S.inv[id] > 1 ? `<span class="ct">×${S.inv[id]}</span>` : ''}`);
        b.onclick = () => { this.sel = id; this.render(); };
        grid.appendChild(b);
      }
      body.appendChild(grid);
    }
    if (this.sel && S.inv[this.sel]) {
      const id = this.sel, it = ITEMS[id], d = el('div', 'detail', `<span class="tag">${statLine(it) || it.type}</span><h4>${it.icon} ${it.name}</h4><p>${it.desc}</p>`);
      const btn = (label, fn, gold) => { const b = el('button', gold ? 'gold' : '', label); b.onclick = () => { fn(); this.render(); }; d.appendChild(b); };
      if (['weapon', 'armor', 'trinket', 'glyph'].includes(it.type)) {
        if (g.isEquipped(id)) { if (it.type !== 'weapon') btn('Unequip', () => g.unequip(id)); }
        else btn('Equip', () => g.equip(id), true);
      }
      if (it.type === 'use') btn('Use', () => g.useItem(id), true);
      body.appendChild(d);
      setTimeout(() => d.scrollIntoView({ block: 'nearest' }), 0);
    }
  }
  tabQuests(body) {
    const g = this.g, S = g.S, ids = Object.keys(S.quests);
    const active = ids.filter(i => !S.quests[i].done), done = ids.filter(i => S.quests[i].done);
    active.sort((a, b) => (QUESTS[b].main ? 1 : 0) - (QUESTS[a].main ? 1 : 0));
    body.appendChild(el('h3', '', 'Active'));
    if (!active.length) body.appendChild(el('div', 'q', '<span>Nothing left undone.</span>'));
    for (const id of active) {
      const d = el('div', 'q' + (S.track === id ? ' track' : ''), `<b>${QUESTS[id].main ? '★ ' : ''}${QUESTS[id].name}</b><span>${g.questText(id)}</span>`);
      if (S.track !== id) { const b = el('button', '', 'Track'); b.onclick = () => { S.track = id; this.render(); }; d.prepend(b); }
      body.appendChild(d);
    }
    if (done.length) { body.appendChild(el('h3', '', 'Completed')); for (const id of done) body.appendChild(el('div', 'q done', `<b>${QUESTS[id].name}</b>`)); }
  }
  tabMap(body) {
    const g = this.g, cv = el('canvas'); cv.id = 'bigMap'; cv.width = cv.height = 680; body.appendChild(cv);
    const c = cv.getContext('2d'), X = x => x + HALF, Z = z => z + HALF;
    c.drawImage(g.world.map, 0, 0, 680, 680);
    c.save(); c.scale(1, 1); this.markers(c, X, Z, 680, true); c.restore();
    body.appendChild(el('h3', '', 'Waystones: travel instantly to any you have woken'));
    const row = el('div', 'travel');
    for (const w of WAYSTONES) if (g.S.way[w.id]) { const b = el('button', '', w.name); b.onclick = () => { this.closeMenu(); g.travel(w.id); }; row.appendChild(b); }
    if (!row.children.length) row.appendChild(el('span', '', 'None yet. Touch a waystone to wake it.'));
    body.appendChild(row);
  }
  tabJournal(body) {
    const S = this.g.S, n = Object.keys(S.minutes).length;
    body.appendChild(el('h3', '', 'Lost Minutes'));
    body.appendChild(el('div', 'lore', `<b>${n} of ${MINUTES.length}</b> gathered. Spare time, shaken loose when the Spark stopped. They glow in quiet corners of the island.`));
    body.appendChild(el('h3', '', "Oren's journal"));
    PAGES.forEach((p, i) => body.appendChild(S.pages[i] ? el('div', 'lore', p.t) : el('div', 'lore miss', 'A page is missing here.')));
    const e = S.flags.endings || {};
    body.appendChild(el('h3', '', 'Endings seen'));
    body.appendChild(el('div', 'lore', ['kept', 'paid', 'caught'].map(k => e[k] ? { kept: 'The Kept Hour', paid: 'The Paid Hour', caught: 'The Caught Hour' }[k] : '???').join(' · ')));
  }
  tabSystem(body) {
    const g = this.g, d = el('div', 'sys');
    d.innerHTML = `<h3>Controls</h3><p><b>Move</b>: WASD / arrow keys, or drag on the left half of the screen.<br><b>Look</b>: drag with the mouse or a finger. Scroll or pinch to zoom.<br><b>Interact</b>: E, or the button that appears.<br><b>Fight</b>: tap anywhere, click, or press Space. F starts Flow. Q drinks a tonic.<br><b>Menu</b>: Tab or Esc. <b>Map</b>: M.</p><h3>Game</h3>`;
    const b = (label, fn) => { const x = el('button', '', label); x.onclick = fn; d.appendChild(x); return x; };
    const snd = b('Sound: ' + (g.S.mute ? 'off' : 'on'), () => { g.S.mute = !g.S.mute; g.sfx.setMute(g.S.mute); this.render(); });
    b('Save now', () => { g.save(); g.ui.toast('Saved'); });
    const r = b('Erase save and restart', () => { if (r.dataset.sure) g.reset(); else { r.dataset.sure = 1; r.textContent = 'Tap again to erase everything'; } });
    d.appendChild(el('p', '', 'The game saves by itself as you play.'));
    body.appendChild(d);
  }
  tabShop(body) {
    const g = this.g, S = g.S;
    body.appendChild(el('div', 'stats', `<span>Your coin <b>${S.coins}</b></span>`));
    body.appendChild(el('h3', '', 'Buy'));
    for (const id of SHOPS[this.shopId]) {
      const it = ITEMS[id], gear = it.type !== 'use', owned = gear && S.inv[id] > 0;
      const row = el('div', 'shoprow', `<span class="ic">${it.icon}</span><span class="nm">${it.name}<small>${statLine(it) || ''} ${statLine(it) ? '· ' : ''}${it.desc}</small></span>`);
      const b = el('button', 'gold', owned ? 'Owned' : it.price + ' ◉'); b.disabled = owned || S.coins < it.price;
      b.onclick = () => { S.coins -= it.price; g.give(id, 1, true); g.sfx.coin(); this.render(); };
      row.appendChild(b); body.appendChild(row);
    }
    const sell = Object.keys(S.inv).filter(id => S.inv[id] > 0 && ITEMS[id].type !== 'key' && ITEMS[id].price && !(g.isEquipped(id) && S.inv[id] < 2));
    if (sell.length) body.appendChild(el('h3', '', 'Sell'));
    for (const id of sell) {
      const it = ITEMS[id], price = Math.max(1, Math.floor(it.price / 2));
      const row = el('div', 'shoprow', `<span class="ic">${it.icon}</span><span class="nm">${it.name} ×${S.inv[id]}</span>`);
      const b = el('button', '', '+' + price + ' ◉'); b.onclick = () => { g.take(id, 1); S.coins += price; g.sfx.coin(); this.render(); };
      row.appendChild(b); body.appendChild(row);
    }
  }
}
