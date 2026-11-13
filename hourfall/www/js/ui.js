/* Everything drawn with HTML: HUD, dialogue, menus, shops, map, character editor, casino, story crawl. */
import { ITEMS, SKILLS, SHOPS, PEARL_SHOP, PRIZES, PAGES, RARITY, RCOL, WAY_NAMES, xpNeed } from './data.js';
import { QUESTS } from './story.js';
import { HALF, TOWNS, TOWN } from './world.js';
import { SKINS, HAIRS, DYES, HAIR_STYLES, BODIES } from './models.js';
import { clamp, TAU } from './util.js';

const $ = id => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const hex = c => '#' + c.toString(16).padStart(6, '0');
const TYPES = [['weapon', 'Weapons'], ['armor', 'Armour'], ['trinket', 'Trinkets'], ['gadget', 'Gadgets (one equipped, used with its button in a fight)'], ['glyph', 'Glyphs'], ['relic', 'Relics (always active)'], ['use', 'Supplies'], ['mat', 'Materials'], ['key', 'Keepsakes']];

export function statLine(it, up) {
  const s = [];
  if (it.atk) s.push('Attack ' + Math.round(it.atk * (1 + 0.12 * (up || 0))) + (up ? ' (+' + up + ')' : ''));
  if (it.def) s.push('Defence ' + it.def);
  if (it.hp) s.push('+' + it.hp + ' health');
  if (it.heal) s.push(it.heal > 999 ? 'Full heal' : 'Heals ' + it.heal);
  if (it.cd && it.type === 'gadget') s.push('Recharge ' + it.cd + 's');
  return s.join(' · ');
}

export class UI {
  constructor(g) {
    this.g = g; this.dialogOpen = false; this.menuOpen = false; this.crawlOpen = false; this.titleOpen = true; this.lookOpen = false;
    this.tab = 'Pack'; this.sel = null; this.shopId = null; this.resolve = null; this.typing = null; this.custom = null;
    $('dialog').addEventListener('pointerdown', e => { e.stopPropagation(); if (e.target.tagName !== 'BUTTON') this.advance(); });
    $('menuClose').onclick = () => this.closeMenu();
    $('menu').addEventListener('pointerdown', e => { if (e.target.id === 'menu') this.closeMenu(); });
    $('menuBtn').onclick = () => { if (!g.combat.active) this.openMenu(); };
    const press = (id, fn) => $(id).addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); fn(); });
    press('act', () => g.interact()); press('flowBtn', () => g.combat.flow()); press('potBtn', () => g.combat.potion()); press('fleeBtn', () => g.combat.flee()); press('gadBtn', () => g.combat.gadget());
    $('crawl').addEventListener('pointerdown', () => this.crawlNext && this.crawlNext());
    $('jumpBtn').addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); g.setJumpHeld(true); });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) $('jumpBtn').addEventListener(ev, () => g.setJumpHeld(false));
    press('mountBtn', () => g.mount());
    this.mini = $('mini').getContext('2d');
  }
  get blocking() { return this.dialogOpen || this.menuOpen || this.crawlOpen || this.titleOpen || this.lookOpen; }

  /* ---- dialogue ---- */
  show(name, text) {
    clearTimeout(this.hideT);
    this.dialogOpen = true; $('dialog').classList.remove('hidden');
    $('dName').textContent = name || ''; $('dChoices').innerHTML = ''; $('dMore').style.display = 'none';
    const t = $('dText'); t.textContent = ''; t.style.fontStyle = name ? 'normal' : 'italic';
    let i = 0; clearInterval(this.typing);
    return new Promise(done => {
      this.finishType = () => { clearInterval(this.typing); this.typing = null; t.textContent = text; done(); };
      this.typing = setInterval(() => { i += 2; t.textContent = text.slice(0, i); if (i % 6 === 0) this.g.sfx.talk(); if (i >= text.length) this.finishType(); }, 16);
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
  toast(text, rarity) {
    const t = el('div', 'toast', text); if (rarity) { t.style.borderColor = RCOL[rarity] || RCOL[1]; t.style.color = RCOL[rarity] || RCOL[1]; }
    $('toasts').appendChild(t);
    while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
    setTimeout(() => t.remove(), 3000);
  }
  region(name, sub) {
    const r = $('region'); r.innerHTML = name + (sub ? '<small>' + sub + '</small>' : ''); r.classList.add('show');
    clearTimeout(this.regT); this.regT = setTimeout(() => r.classList.remove('show'), 3000);
  }
  fade(on) { $('fade').classList.toggle('on', on); return new Promise(r => setTimeout(r, 520)); }

  /* ---- HUD ---- */
  hud(cine) {
    const g = this.g, S = g.S, st = g.stats(), inC = g.combat.active, c = g.combat;
    $('hud').classList.toggle('quiet', cine || this.lookOpen);
    $('hpFill').style.width = clamp(S.hp / st.maxHp * 100, 0, 100) + '%';
    $('hpText').textContent = Math.ceil(S.hp) + ' / ' + st.maxHp;
    $('xpFill').style.width = clamp(S.xp / xpNeed(S.level) * 100, 0, 100) + '%';
    $('focusFill').style.width = g.focus + '%';
    $('focusFill').parentElement.classList.toggle('full', g.focus >= 100);
    $('lvl').textContent = S.level; $('coins').textContent = S.coins + (S.sp ? '  ✦' + S.sp : '');
    const q = g.tracked();
    $('quest').innerHTML = q && !inC ? '<b>' + q.name + '</b>' + q.text + (q.dist !== null ? ' <small>' + q.dir + ' ' + q.dist + 'm</small>' : '') : '';
    const a = $('act'), near = !inC && !this.blocking && !cine && g.nearest;
    a.classList.toggle('hidden', !near);
    if (near && a.dataset.l !== near.label) { a.dataset.l = near.label; a.innerHTML = near.label + (g.touch ? '' : '<kbd>E</kbd>'); }
    $('flowBtn').classList.toggle('hidden', !(inC && g.focus >= 100 && c.flowT <= 0));
    $('fleeBtn').classList.toggle('hidden', !inC || c.boss || !!c.tut || c.trial);
    const pots = g.has('tonic') + g.has('tonic2') + g.has('tonic3') + g.has('elixir');
    $('potBtn').classList.toggle('hidden', !inC || !pots);
    $('potBtn').textContent = '🧪 ' + pots + (g.touch ? '' : ' Q');
    $('flowBtn').textContent = g.touch ? 'FLOW' : 'FLOW (F)';
    const gd = st.gadget, gb = $('gadBtn');
    gb.classList.toggle('hidden', !inC || !gd);
    if (inC && gd) { gb.textContent = gd.icon + (c.gadCd > 0 ? ' ' + Math.ceil(c.gadCd) : g.touch ? '' : ' G'); gb.classList.toggle('cool', c.gadCd > 0); }
    const roam = !inC && !cine && !this.blocking && g.touch;
    $('jumpBtn').classList.toggle('hidden', !roam || !g.has('r_glider'));
    $('mountBtn').classList.toggle('hidden', !roam || !g.has('r_strider'));
    $('mountBtn').classList.toggle('on', !!g.player.mounted);
    $('menuBtn').classList.toggle('hidden', inC); $('mini').classList.toggle('hidden', inC);
    if (!inC && !cine) this.drawMini();
  }
  drawMini() {
    const g = this.g, c = this.mini, size = 220, span = 190, k = size / span, p = g.player, M = g.mini;
    const X = x => (x - p.x) * k + size / 2, Z = z => (z - p.z) * k + size / 2;
    c.fillStyle = '#3f8fb0'; c.fillRect(0, 0, size, size);
    c.imageSmoothingEnabled = true;
    c.drawImage(M.canvas, X(M.x - M.span / 2), Z(M.z - M.span / 2), M.span * k, M.span * k);
    const dot = (x, z, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(X(x), Z(z), r, 0, TAU); c.fill(); c.lineWidth = 1.5; c.strokeStyle = 'rgba(0,0,0,.6)'; c.stroke(); };
    const compass = g.has('r_compass');
    for (const t of g._things) {
      if (t.gone || Math.abs(t.x - p.x) > 100 || Math.abs(t.z - p.z) > 100) continue;
      if (t.type === 'npc') dot(t.x, t.z, 5, '#ffffff'); else if (t.type === 'way') dot(t.x, t.z, 6, '#22d3b4'); else if (t.type === 'rift') dot(t.x, t.z, 5, '#b48aff');
      else if (compass && (t.type === 'minute' || (t.type === 'chest' && t.label))) dot(t.x, t.z, 4, t.type === 'minute' ? '#ffd58a' : '#ff9a3c');
    }
    for (const f of g._foes) if (f.state !== 'dead' && f.model && f.model.visible && Math.abs(f.x - p.x) < 100 && Math.abs(f.z - p.z) < 100) dot(f.x, f.z, f.def.boss ? 6 : 3.5, '#ff5470');
    this.target(c, X, Z, size, false); this.arrow(c, X(p.x), Z(p.z), 11);
  }
  target(c, X, Z, size, big) {
    const t = this.g.target(); if (!t) return;
    let x = X(t[0]), z = Z(t[1]);
    const dx = x - size / 2, dz = z - size / 2, d = Math.hypot(dx, dz), max = size / 2 - 12;
    if (!big && d > max) { x = size / 2 + dx / d * max; z = size / 2 + dz / d * max; }
    c.save(); c.translate(x, z); c.rotate(Math.PI / 4); c.fillStyle = '#ffd58a'; c.strokeStyle = '#2a1e10'; c.lineWidth = 2; c.fillRect(-7, -7, 14, 14); c.strokeRect(-7, -7, 14, 14); c.restore();
  }
  arrow(c, x, y, s) {
    c.save(); c.translate(x, y); c.rotate(-this.g.player.rot + Math.PI); c.fillStyle = '#fff'; c.strokeStyle = '#1b1838'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, -s); c.lineTo(s * 0.7, s * 0.8); c.lineTo(0, s * 0.4); c.lineTo(-s * 0.7, s * 0.8); c.closePath(); c.fill(); c.stroke(); c.restore();
  }

  /* ---- menu ---- */
  openMenu(tab, keep) {
    if (!keep) { this.shopId = null; this.custom = null; }
    this.menuOpen = true; this.tab = tab || (['Shop', 'Custom'].includes(this.tab) ? 'Pack' : this.tab);
    $('menu').classList.remove('hidden'); this.render(); this.g.sfx.click();
  }
  closeMenu() {
    this.menuOpen = false; this.shopId = null; this.custom = null; if (['Shop', 'Custom'].includes(this.tab)) this.tab = 'Pack';
    $('menu').classList.add('hidden'); if (this.menuDone) { const d = this.menuDone; this.menuDone = null; d(); } this.g.save();
  }
  shop(id, name) { this.shopId = id; this.shopName = name; this.openMenu('Shop', true); return new Promise(r => { this.menuDone = r; }); }
  /* A one-off screen in the menu frame (casino tables, special traders). */
  panel(name, draw) { this.custom = { name, draw }; this.openMenu('Custom', true); return new Promise(r => { this.menuDone = r; }); }
  render() {
    const tabs = $('tabs'), names = (this.shopId ? ['Shop'] : this.custom ? ['Custom'] : []).concat(['Pack', 'Skills', 'Quests', 'Map', 'Journal', 'System']);
    tabs.innerHTML = '';
    for (const n of names) { const b = el('button', n === this.tab ? 'on' : '', n === 'Shop' ? this.shopName : n === 'Custom' ? this.custom.name : n + (n === 'Skills' && this.g.S.sp ? ' ✦' : '')); b.onclick = () => { this.tab = n; this.sel = null; this.render(); this.g.sfx.click(); }; tabs.appendChild(b); }
    const body = $('menuBody'), keep = body.scrollTop; body.innerHTML = '';
    if (this.tab === 'Custom') this.custom.draw(body); else this['tab' + this.tab](body);
    body.scrollTop = keep;
  }
  itemBtn(id, extra = '') {
    const g = this.g, it = ITEMS[id], n = g.S.inv[id] || 0, up = g.S.up[id];
    const b = el('button', 'item' + (g.isEquipped(id) ? ' eq' : '') + (this.sel === id ? ' sel' : ''), `<span class="ic">${it.icon}</span><span class="nm" style="color:${RCOL[it.r || 0]}">${it.name}${up ? ' +' + up : ''}</span>${n > 1 ? `<span class="ct">×${n}</span>` : ''}${extra}`);
    b.style.borderLeft = '3px solid ' + RCOL[it.r || 0];
    return b;
  }
  tabPack(body) {
    const g = this.g, S = g.S, st = g.stats();
    body.appendChild(el('div', 'stats', `<span><b>${S.name}</b> · Level <b>${S.level}</b></span><span>Health <b>${Math.ceil(S.hp)}/${st.maxHp}</b></span><span>Attack <b>${Math.round(st.atk)}</b></span><span>Defence <b>${st.def}</b></span><span>Coin <b>${S.coins}</b></span>`));
    for (const [type, title] of TYPES) {
      const ids = Object.keys(S.inv).filter(id => S.inv[id] > 0 && ITEMS[id] && ITEMS[id].type === type).sort((a, b) => (ITEMS[b].r || 0) - (ITEMS[a].r || 0));
      if (!ids.length) continue;
      body.appendChild(el('h3', '', title + (type === 'glyph' ? ` (equip up to ${g.glyphSlots()})` : '')));
      const grid = el('div', 'grid');
      for (const id of ids) { const b = this.itemBtn(id); b.onclick = () => { this.sel = id; this.render(); }; grid.appendChild(b); }
      body.appendChild(grid);
    }
    if (this.sel && S.inv[this.sel]) {
      const id = this.sel, it = ITEMS[id], d = el('div', 'detail', `<span class="tag" style="color:${RCOL[it.r || 0]}">${RARITY[it.r || 0]}${statLine(it, S.up[id]) ? ' · ' + statLine(it, S.up[id]) : ''}</span><h4>${it.icon} ${it.name}</h4><p>${it.desc}</p>`);
      const btn = (label, fn, gold) => { const b = el('button', gold ? 'gold' : '', label); b.onclick = () => { fn(); g.sfx.equip(); this.render(); }; d.appendChild(b); };
      if (['weapon', 'armor', 'trinket', 'glyph', 'gadget'].includes(it.type)) { if (g.isEquipped(id)) { if (it.type !== 'weapon') btn('Unequip', () => g.unequip(id)); } else btn('Equip', () => g.equip(id), true); }
      if (it.type === 'use') btn('Use', () => g.useItem(id), true);
      body.appendChild(d);
      setTimeout(() => d.scrollIntoView({ block: 'nearest' }), 0);
    }
  }
  tabSkills(body) {
    const g = this.g, S = g.S;
    body.appendChild(el('div', 'stats', `<span>Skill points <b>${S.sp}</b></span><span>Earn one each level, and one for every Time Rift you close.</span>`));
    for (const s of SKILLS) {
      const r = S.skills[s.id] || 0, cost = s.cost || 1, row = el('div', 'shoprow', `<span class="ic">${'●'.repeat(r)}${'○'.repeat(s.max - r)}</span><span class="nm"><b>${s.name}</b><small>${s.desc}</small></span>`);
      const b = el('button', 'gold', r >= s.max ? 'Mastered' : 'Learn ✦' + cost); b.disabled = r >= s.max || S.sp < cost;
      b.onclick = () => { S.sp -= cost; S.skills[s.id] = r + 1; g.sfx.level(); this.render(); };
      row.appendChild(b); body.appendChild(row);
    }
  }
  tabQuests(body) {
    const g = this.g, S = g.S, ids = Object.keys(S.quests).filter(i => QUESTS[i]);
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
    const g = this.g, S = g.S, cv = el('canvas'); cv.id = 'bigMap'; cv.width = cv.height = 720; body.appendChild(cv);
    const c = cv.getContext('2d'), k = 720 / (HALF * 2), X = x => (x + HALF) * k, Z = z => (z + HALF) * k;
    c.imageSmoothingEnabled = true; c.drawImage(g.world.map, 0, 0, 720, 720);
    c.textAlign = 'center';
    for (const t of TOWNS) {
      if (!t.size && !S.seen[t.id] && !g.flag('met_regent')) continue;
      const seen = S.seen[t.id] || S.way[t.id];
      c.fillStyle = t.size >= 2 ? (S.way[t.id] ? '#22d3b4' : '#ffffff') : t.size ? '#e6e6f0' : '#ff8a9a'; c.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = 2;
      c.beginPath(); c.arc(X(t.x), Z(t.z), t.size === 3 ? 7 : t.size === 2 ? 5 : 3, 0, TAU); c.fill(); c.stroke();
      if (t.size >= 2 || seen) { c.font = (t.size >= 2 ? '700 13px' : '600 10px') + ' system-ui'; c.lineWidth = 3; const nm = seen || t.size >= 2 && g.flag('met_regent') ? t.name : '?'; c.strokeText(nm, X(t.x), Z(t.z) - 9); c.fillStyle = '#fff'; c.fillText(nm, X(t.x), Z(t.z) - 9); }
    }
    this.target(c, X, Z, 720, true); this.arrow(c, X(g.player.x), Z(g.player.z), 9);
    body.appendChild(el('h3', '', 'Waystones: travel instantly to any you have woken'));
    const row = el('div', 'travel');
    for (const id in WAY_NAMES) if (S.way[id]) { const b = el('button', '', WAY_NAMES[id]); b.onclick = () => { this.closeMenu(); g.travel(id); }; row.appendChild(b); }
    if (!row.children.length) row.appendChild(el('span', '', 'None yet. Every city has a waystone near its fountain. Touch it to wake it.'));
    body.appendChild(row);
  }
  tabJournal(body) {
    const g = this.g, S = g.S, n = Object.keys(S.minutes).length, np = Object.keys(S.pages).length;
    body.appendChild(el('h3', '', 'Lost Minutes'));
    body.appendChild(el('div', 'lore', `<b>${n} of ${g.minuteTotal}</b> gathered. Spare time, shaken loose when the Spark stopped. They glow in quiet corners of every country. Tick in Dawnmere winds them into gear.`));
    body.appendChild(el('h3', '', 'Records'));
    body.appendChild(el('div', 'lore', `Arena rank <b>${S.arena || 0}/5</b> · Crucible best <b>round ${S.crucible || 0}</b> · Bounties <b>${S.bounties || 0}</b> · Best ride <b>${S.surf ? S.surf.toFixed(1) + 's' : '—'}</b> · Rifts closed <b>${Object.keys(S.cells).filter(k => S.cells[k] === 1).length ? '✓' : '—'}</b>`));
    body.appendChild(el('h3', '', "Oren's journal"));
    PAGES.forEach((p, i) => body.appendChild(i < np ? el('div', 'lore', p) : el('div', 'lore miss', 'A page is missing here. Look for ruins in the wild.')));
    const e = S.flags.endings || {};
    body.appendChild(el('h3', '', 'Endings seen'));
    body.appendChild(el('div', 'lore', ['kept', 'paid', 'caught'].map(k => (e[k] ? { kept: 'The Kept Hour', paid: 'The Paid Hour', caught: 'The Caught Hour' }[k] : '???')).join(' · ')));
  }
  tabSystem(body) {
    const g = this.g, d = el('div', 'sys');
    d.innerHTML = `<h3>Controls</h3><p><b>Move</b>: WASD / arrow keys, or drag on the left half of the screen.<br><b>Look</b>: drag with the mouse or a finger. Scroll or pinch to zoom.<br><b>Interact</b>: E, or the button that appears.<br><b>Fight</b>: tap anywhere, click, or press Space. F starts Flow. G uses your gadget. Q drinks a tonic.<br><b>Menu</b>: Tab or Esc. <b>Map</b>: M.</p><h3>Game</h3>`;
    const b = (label, fn) => { const x = el('button', '', label); x.onclick = fn; d.appendChild(x); return x; };
    b('Sound: ' + (g.S.mute ? 'off' : 'on'), () => { g.S.mute = !g.S.mute; g.sfx.setMute(g.S.mute); this.render(); });
    b('Change appearance', () => { this.closeMenu(); this.lookEditor(); });
    b('Save now', () => { g.save(); this.toast('Saved'); });
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
      const row = el('div', 'shoprow', `<span class="ic">${it.icon}</span><span class="nm"><b style="color:${RCOL[it.r || 0]}">${it.name}</b><small>${statLine(it) ? statLine(it) + ' · ' : ''}${it.desc}</small></span>`);
      const b = el('button', 'gold', owned ? 'Owned' : it.price + ' ◉'); b.disabled = owned || S.coins < it.price;
      b.onclick = () => { S.coins -= it.price; g.give(id, 1, true); g.sfx.coin(); this.render(); };
      row.appendChild(b); body.appendChild(row);
    }
    const sell = Object.keys(S.inv).filter(id => S.inv[id] > 0 && ITEMS[id] && !['key', 'relic'].includes(ITEMS[id].type) && ITEMS[id].price && !(g.isEquipped(id) && S.inv[id] < 2));
    if (sell.length) body.appendChild(el('h3', '', 'Sell'));
    for (const id of sell) {
      const it = ITEMS[id], price = Math.max(1, Math.floor(it.price / 2));
      const row = el('div', 'shoprow', `<span class="ic">${it.icon}</span><span class="nm" style="color:${RCOL[it.r || 0]}">${it.name} ×${S.inv[id]}</span>`);
      const b = el('button', '', '+' + price + ' ◉'); b.onclick = () => { g.take(id, 1); S.coins += price; g.sfx.coin(); this.render(); };
      row.appendChild(b); body.appendChild(row);
    }
  }
  /* Shops that take something other than coin. */
  trade(name, list, cur, curName) {
    return this.panel(name, body => {
      const g = this.g, S = g.S, have = cur ? g.has(cur) : S.coins;
      body.appendChild(el('div', 'stats', `<span>Your ${curName} <b>${have}</b></span>`));
      for (const [id, cost] of list) {
        const it = ITEMS[id], owned = it.type !== 'use' && it.type !== 'mat' && S.inv[id] > 0;
        const row = el('div', 'shoprow', `<span class="ic">${it.icon}</span><span class="nm"><b style="color:${RCOL[it.r || 0]}">${it.name}</b><small>${statLine(it) ? statLine(it) + ' · ' : ''}${it.desc}</small></span>`);
        const b = el('button', 'gold', owned ? 'Owned' : cost + ' ' + curName); b.disabled = owned || have < cost;
        b.onclick = () => { if (cur) g.take(cur, cost); else S.coins -= cost; g.give(id, 1); this.render(); };
        row.appendChild(b); body.appendChild(row);
      }
    });
  }
  pearls() { return this.trade('Pearl Exchange', PEARL_SHOP, 'pearl', 'pearls'); }
  prizes() { return this.trade('Prize Cage', PRIZES, null, 'coin'); }

  /* ---- character editor ---- */
  lookEditor(first) {
    const g = this.g, L = g.S.look, box = $('look');
    this.lookOpen = true; box.classList.remove('hidden'); g.viewFront(true);
    return new Promise(done => {
      const draw = () => {
        box.innerHTML = `<h2>${first ? 'Who are you?' : 'Change appearance'}</h2>`;
        if (first) { const inp = el('input'); inp.maxLength = 14; inp.value = g.S.name; inp.placeholder = 'Name'; inp.oninput = () => { g.S.name = inp.value.trim() || 'Apprentice'; }; box.appendChild(inp); }
        const sw = (title, key, cols) => { const r = el('div', 'lrow', `<span>${title}</span>`), w = el('div', 'sws'); cols.forEach((c, i) => { const b = el('button', 'sw' + (L[key] === i ? ' on' : '')); b.style.background = hex(c); b.onclick = () => { L[key] = i; g.rebuildPlayer(); g.sfx.click(); draw(); }; w.appendChild(b); }); r.appendChild(w); box.appendChild(r); };
        const cyc = (title, key, names) => { const r = el('div', 'lrow', `<span>${title}</span>`), w = el('div', 'sws'); const a = el('button', '', '◀'), n = el('b', '', names[L[key]]), b = el('button', '', '▶'); a.onclick = () => { L[key] = (L[key] + names.length - 1) % names.length; g.rebuildPlayer(); g.sfx.click(); draw(); }; b.onclick = () => { L[key] = (L[key] + 1) % names.length; g.rebuildPlayer(); g.sfx.click(); draw(); }; w.append(a, n, b); r.appendChild(w); box.appendChild(r); };
        sw('Skin', 'skin', SKINS); cyc('Hair', 'hairStyle', HAIR_STYLES); sw('Hair colour', 'hair', HAIRS); cyc('Build', 'body', BODIES); sw('Tunic', 'top', DYES); sw('Cloak', 'cape', DYES);
        const ok = el('button', 'gold big', first ? 'Begin' : 'Done'); ok.onclick = () => { this.lookOpen = false; box.classList.add('hidden'); g.viewFront(false); g.sfx.quest(); done(); }; box.appendChild(ok);
      };
      draw();
    });
  }

  /* ---- the Golden Mirage ---- */
  casino(game) {
    const g = this.g, S = g.S; let bet = 20, msg = 'Place your bet.', busy = false, st = null;
    const title = { roulette: 'Roulette', slots: 'Slots', blackjack: 'Blackjack' }[game];
    const pay = (n, text) => { S.coins += n; msg = text; if (n > 0) g.sfx.win(); else g.sfx.miss(); };
    const card = () => { const v = 1 + Math.floor(Math.random() * 13); return { v: Math.min(10, v), n: ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][v - 1], s: '♠♥♦♣'[Math.floor(Math.random() * 4)] }; };
    const total = h => { let t = h.reduce((a, c) => a + c.v, 0); if (h.some(c => c.v === 1) && t + 10 <= 21) t += 10; return t; };
    const cards = h => h.map(c => `<span class="card${'♥♦'.includes(c.s) ? ' red' : ''}">${c.n}${c.s}</span>`).join('');
    return this.panel(title, body => {
      const again = () => this.render();
      body.appendChild(el('div', 'stats', `<span>Your coin <b>${S.coins}</b></span><span>Bet <b>${bet}</b></span>`));
      const bets = el('div', 'travel'); for (const b of [10, 20, 50, 200, 1000]) { const x = el('button', b === bet ? 'gold' : '', String(b)); x.disabled = busy || !!st || S.coins < b; x.onclick = () => { bet = b; again(); }; bets.appendChild(x); } body.appendChild(bets);
      const stage = el('div', 'table'); body.appendChild(stage);
      const act = el('div', 'travel'); body.appendChild(act);
      const btn = (label, fn, off) => { const b = el('button', 'gold', label); b.disabled = !!off; b.onclick = fn; act.appendChild(b); };
      const broke = S.coins < bet;
      if (game === 'roulette') {
        stage.innerHTML = `<div class="wheel" id="wheel">${st ? st : '?'}</div><p>${msg}</p>`;
        const spin = (kind, mult) => { S.coins -= bet; busy = true; again(); let n = 0; const iv = setInterval(() => { const w = $('wheel'); if (w) w.textContent = Math.floor(Math.random() * 37); g.sfx.tickSound(); if (++n > 16) { clearInterval(iv); const r = Math.floor(Math.random() * 37), red = r && [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(r), col = r === 0 ? 'green' : red ? 'red' : 'black'; busy = false; st = `<span class="${col}">${r}</span>`; if (col === kind) pay(bet * mult, `${r} ${col}. You win ${bet * mult}!`); else pay(0, `${r} ${col}. The house thanks you.`); again(); st = null; } }, 70); };
        btn('Red ×2', () => spin('red', 2), busy || broke); btn('Black ×2', () => spin('black', 2), busy || broke); btn('Green ×30', () => spin('green', 30), busy || broke);
      } else if (game === 'slots') {
        const SYM = ['🍒', '🍒', '🍒', '🔔', '🔔', '⭐', '⭐', '💎', '7️⃣', '⚙️'], PAY = { '🍒': 4, '🔔': 12, '⭐': 25, '💎': 80, '7️⃣': 200, '⚙️': 500 };
        stage.innerHTML = `<div class="reels" id="reels">${(st || ['❔', '❔', '❔']).map(s => `<span>${s}</span>`).join('')}</div><p>${msg}</p><small>Three alike pays: 🍒×4 🔔×12 ⭐×25 💎×80 7️⃣×200 ⚙️×500. Two cherries pay ×2.</small>`;
        btn('Pull the lever', () => { S.coins -= bet; busy = true; again(); let n = 0; const iv = setInterval(() => { const r = $('reels'); const roll = [0, 1, 2].map(() => SYM[Math.floor(Math.random() * SYM.length)]); if (r) r.innerHTML = roll.map(s => `<span>${s}</span>`).join(''); g.sfx.tickSound(); if (++n > 14) { clearInterval(iv); busy = false; st = roll; const [a, b, c] = roll; if (a === b && b === c) pay(bet * PAY[a], `${a}${a}${a}! You win ${bet * PAY[a]}!`); else if (roll.filter(s => s === '🍒').length === 2) pay(bet * 2, 'Two cherries. You win ' + bet * 2 + '.'); else pay(0, 'No luck. Again?'); again(); } }, 80); }, busy || broke);
      } else {
        if (!st) { stage.innerHTML = `<p>${msg}</p><small>Closest to 21 wins. Dealer stands on 17. Blackjack pays 3 to 2.</small>`; btn('Deal', () => { S.coins -= bet; st = { p: [card(), card()], d: [card(), card()], bet }; msg = ''; if (total(st.p) === 21) { pay(Math.round(bet * 2.5), 'Blackjack! You win ' + Math.round(bet * 2.5) + '.'); st.over = true; } g.sfx.card(); again(); }, broke); }
        else {
          const over = st.over;
          stage.innerHTML = `<p>Dealer ${over ? '(' + total(st.d) + ')' : ''}</p><div>${over ? cards(st.d) : cards([st.d[0]]) + '<span class="card back">?</span>'}</div><p>You (${total(st.p)})</p><div>${cards(st.p)}</div><p>${msg}</p>`;
          const stand = () => { while (total(st.d) < 17) st.d.push(card()); const p = total(st.p), d = total(st.d); st.over = true; if (d > 21 || p > d) pay(st.bet * 2, 'You win ' + st.bet * 2 + '!'); else if (p === d) pay(st.bet, 'Push. Your bet comes back.'); else pay(0, 'Dealer wins.'); again(); };
          if (over) btn('Again', () => { st = null; msg = 'Place your bet.'; again(); });
          else { btn('Hit', () => { st.p.push(card()); g.sfx.card(); if (total(st.p) > 21) { st.over = true; pay(0, 'Bust.'); } again(); }); btn('Stand', stand); btn('Double', () => { S.coins -= st.bet; st.bet *= 2; st.p.push(card()); if (total(st.p) > 21) { st.over = true; pay(0, 'Bust.'); again(); } else stand(); }, S.coins < st.bet || st.p.length > 2); }
        }
      }
    });
  }
}
