import { G, S, addMoney, save, OUTFITS, ITEMS, SKINS, HAIRS } from './state.js';
import { openPanel, closePanel, fmt, toast, canPay, esc } from './ui.js';
import { sfx } from './audio.js';

const MIN = 60000;
const DRINKS = [
  { id: 'water', e: '💧', name: 'Tap Water', price: 0, d: 'Sobers you right up.', go: () => { G.buzz = 0; } },
  { id: 'lager', e: '🍺', name: 'Lucky Lager', price: 25, d: 'Slot wins pay 10% more for 5 minutes.', buff: ['lucky', 5], buzz: 1 },
  { id: 'ale', e: '🍻', name: "Angler's Ale", price: 40, d: 'Fish bite 30% sooner for 5 minutes.', buff: ['angler', 5], buzz: 1 },
  { id: 'espresso', e: '☕', name: 'Steady Shot Espresso', price: 40, d: 'No scope sway on the range for 5 minutes.', buff: ['steady', 5], buzz: -1 },
  { id: 'martini', e: '🍸', name: 'High Roller Martini', price: 150, d: 'A golden glow everyone can see for 10 minutes.', buff: ['aura', 10], buzz: 2 },
  { id: 'champagne', e: '🍾', name: 'Champagne Shower', price: 500, d: 'Confetti for the whole room.', buzz: 2, go: () => { G.send({ t: 'ev', k: 'confetti' }); G.fx.confetti(G.pos.x, G.pos.z); } },
  { id: 'round', e: '🥂', name: 'A Round for the House', price: 1000, d: 'Everyone online gets a drink and $25.', buzz: 1, go: () => G.send({ t: 'round' }) },
];

export function openBar() {
  const b = openPanel({ title: '🍸 The Bar' });
  b.innerHTML = `<div class="list">${DRINKS.map((d, i) => `<button class="item" data-i="${i}"><span class="ic">${d.e}</span><span class="tx"><b>${d.name}</b><small>${d.d}</small></span><span class="pr">${d.price ? fmt(d.price) : 'Free'}</span></button>`).join('')}</div>`;
  b.querySelectorAll('[data-i]').forEach(x => x.onclick = () => {
    const d = DRINKS[+x.dataset.i];
    if (!canPay(d.price)) return;
    addMoney(-d.price, true);
    sfx('pour');
    if (d.buff) G.buffs[d.buff[0]] = Date.now() + d.buff[1] * MIN;
    G.buzz = Math.max(0, Math.min(8, G.buzz + (d.buzz || 0)));
    if (d.go) d.go();
    G.drinkUntil = Date.now() + 25000;
    toast(`${d.e} ${d.name}${d.buff ? ' — ' + d.d : ''}`, 'good');
    G.send({ t: 'ev', k: 'drink' });
  });
}

// ---------------------------------------------------------------- style shop and wardrobe
const TABS = [['outfit', 'Outfits'], ['hat', 'Hats'], ['eye', 'Eyewear'], ['neck', 'Neck'], ['back', 'Back'], ['hair', 'Hair'], ['body', 'Body']];

export function openShop(buying = true) {
  let tab = 'outfit';
  const oldCam = { ...G.cam };
  G.cam.dist = 3.6; G.cam.pitch = 0.18; G.cam.yaw = G.pos.r;      // swing round to look at yourself
  const b = openPanel({ title: buying ? '👔 Style Shop' : '👔 Wardrobe', cls: 'side', close: () => { Object.assign(G.cam, oldCam); } });
  const apply = () => { save(); G.me.setLook(S.look); G.send({ t: 'look', look: S.look, name: S.name }); };
  const draw = () => {
    const list = tab === 'outfit' ? OUTFITS.map(o => ({ ...o, slot: 'outfit' })) : ITEMS.filter(i => i.slot === tab);
    let body;
    if (tab === 'body') {
      body = `<p class="dim">Skin</p><div class="row">${SKINS.map((c, i) => `<button class="sw ${S.look.skin === i ? 'on' : ''}" data-skin="${i}" style="background:${c}"></button>`).join('')}</div>
        <p class="dim">Hair colour</p><div class="row">${HAIRS.map((c, i) => `<button class="sw ${S.look.hairColor === i ? 'on' : ''}" data-hc="${i}" style="background:${c}"></button>`).join('')}</div>`;
    } else {
      const none = tab !== 'outfit' ? `<button class="item ${!S.look[tab] ? 'on' : ''}" data-id=""><span class="tx"><b>None</b></span><span class="pr"></span></button>` : '';
      body = `<div class="list">${none}${list.map(o => {
        const own = S.owned[o.id] || o.price === 0, on = S.look[tab] === o.id;
        return `<button class="item ${on ? 'on' : ''} ${!own && !buying ? 'locked' : ''}" data-id="${o.id}"><span class="tx"><b>${o.name}</b><small>${on ? 'Wearing' : own ? 'Owned — tap to wear' : buying ? 'Tap to buy' : 'Sold at the Style Shop'}</small></span><span class="pr">${own ? '✓' : fmt(o.price)}</span></button>`;
      }).join('')}</div>`;
    }
    b.innerHTML = `<div class="tabs">${TABS.map(([k, n]) => `<button class="${k === tab ? 'on' : ''}" data-tab="${k}">${n}</button>`).join('')}</div>${body}`;
    b.querySelectorAll('[data-tab]').forEach(x => x.onclick = () => { tab = x.dataset.tab; draw(); });
    b.querySelectorAll('[data-skin]').forEach(x => x.onclick = () => { S.look.skin = +x.dataset.skin; apply(); draw(); });
    b.querySelectorAll('[data-hc]').forEach(x => x.onclick = () => { S.look.hairColor = +x.dataset.hc; apply(); draw(); });
    b.querySelectorAll('[data-id]').forEach(x => x.onclick = () => {
      const id = x.dataset.id, o = list.find(q => q.id === id);
      if (o && !S.owned[id] && o.price > 0) {
        if (!buying) return toast('Visit the Style Shop to buy that');
        if (!canPay(o.price)) return;
        addMoney(-o.price, true); S.owned[id] = 1; sfx('buy'); toast(`Bought ${o.name}`, 'good');
      }
      S.look[tab] = id; apply(); draw();
    });
  };
  draw();
}

// ---------------------------------------------------------------- cashier
export function openCashier() {
  const today = new Date().toDateString();
  const b = openPanel({ title: '💵 Cashier', cls: 'small' });
  const draw = () => {
    const daily = S.daily !== today, broke = S.money < 100;
    b.innerHTML = `<p>Balance <b class="gold">${fmt(S.money)}</b></p>
      <p class="dim">Won all time ${fmt(S.stats.won)} · spent ${fmt(S.stats.spent)} · fish caught ${S.fish.caught} · best range score ${S.best.range}</p>
      <button class="big gold" id="daily" ${daily ? '' : 'disabled'}>${daily ? 'Collect daily $1,000' : 'Daily bonus collected'}</button>
      <button class="big" id="comp" ${broke ? '' : 'disabled'}>${broke ? 'Down on your luck? Take $250' : 'House comp (only when under $100)'}</button>
      <p class="dim">Tip: the range and the pond both pay, no stake needed.</p>`;
    b.querySelector('#daily').onclick = () => { S.daily = today; addMoney(1000); sfx('win'); draw(); };
    b.querySelector('#comp').onclick = () => { addMoney(250); sfx('coin'); draw(); };
  };
  draw();
}

// ---------------------------------------------------------------- menu
export function openMenu() {
  const link = location.origin + location.pathname + '?room=' + encodeURIComponent(G.roomCode);
  const b = openPanel({ title: 'Big Money', cls: 'small' });
  b.innerHTML = `<p>Room <b class="gold">${esc(G.roomCode)}</b> · ${G.players.size + 1} here · <span class="dim">${G.netLabel || ''}</span></p>
    <p class="dim">Friends join by opening this link (or typing the same room name):</p>
    <div class="row"><input id="lnk" readonly value="${esc(link)}"><button class="chip" id="cp">Copy</button></div>
    <div class="row"><input id="nm" maxlength="16" value="${esc(S.name)}" placeholder="Your name"><button class="chip" id="sv">Rename</button></div>
    <button class="big" id="wd">Wardrobe</button>
    <button class="big" id="snd">Sound: ${S.sound ? 'on' : 'off'}</button>
    <p class="dim">Move: WASD or the left stick. Look: drag. Interact: E or the gold button. Chat: Enter.</p>`;
  b.querySelector('#cp').onclick = () => { navigator.clipboard && navigator.clipboard.writeText(link).then(() => toast('Link copied'), () => {}); b.querySelector('#lnk').select(); };
  b.querySelector('#sv').onclick = () => { const n = b.querySelector('#nm').value.trim().slice(0, 16); if (n) { S.name = n; save(); G.me.setName(''); G.send({ t: 'look', look: S.look, name: n }); toast('Name changed'); } };
  b.querySelector('#wd').onclick = () => { closePanel(); openShop(false); };
  b.querySelector('#snd').onclick = e => { S.sound = !S.sound; save(); e.target.textContent = 'Sound: ' + (S.sound ? 'on' : 'off'); };
}
