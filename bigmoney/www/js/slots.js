import { G, S, addMoney, buff } from './state.js';
import { openPanel, fmt, toast, canPay } from './ui.js';
import { sfx } from './audio.js';

// weight = stops on each reel (out of 100), pay = multiple of the bet for three in a row
const SYM = [
  { e: '🍒', w: 30, pay: 6 }, { e: '🍋', w: 25, pay: 10 }, { e: '🔔', w: 20, pay: 20 },
  { e: '💎', w: 12, pay: 60 }, { e: '7️⃣', w: 8, pay: 150 }, { e: '💰', w: 5, pay: 500 },
];
const BETS = [10, 50, 100, 500, 2500];
const THEMES = ['Ruby Reels', 'Royal Sevens', 'Deep Blue', 'Lucky Clover'];
const pick = () => { let r = Math.random() * 100; for (let i = 0; i < SYM.length; i++) { r -= SYM[i].w; if (r < 0) return i; } return 0; };

export function payout(a, b, c, bet) {
  if (a === b && b === c) return SYM[a].pay * bet;
  return [a, b, c].filter(x => x === 0).length === 2 ? bet : 0;
}

export function openSlots(it) {
  let bet = 10, busy = false, alive = true;
  const k = G.layout.slots[it.i].k;
  const b = openPanel({ title: '🎰 ' + THEMES[k], cls: 'slots theme' + k, close: () => { alive = false; } });
  b.innerHTML = `
    <div class="reels"><div class="reel">🍒</div><div class="reel">💎</div><div class="reel">7️⃣</div></div>
    <div class="slotmsg" id="slotmsg">Three of a kind pays. Two cherries gets your bet back.</div>
    <div class="row bets">${BETS.map(v => `<button class="chip" data-bet="${v}">${fmt(v)}</button>`).join('')}</div>
    <button class="big gold" id="spin">SPIN</button>
    <div class="paytable">${SYM.map(s => `<span>${s.e}${s.e}${s.e} <b>×${s.pay}</b></span>`).join('')}<span>🍒🍒 <b>×1</b></span></div>`;
  const reels = [...b.querySelectorAll('.reel')], msg = b.querySelector('#slotmsg');
  const mark = () => b.querySelectorAll('[data-bet]').forEach(x => x.classList.toggle('on', +x.dataset.bet === bet));
  mark();
  b.querySelectorAll('[data-bet]').forEach(x => x.onclick = () => { if (!busy) { bet = +x.dataset.bet; mark(); sfx('click'); } });
  b.querySelector('#spin').onclick = () => {
    if (busy || !canPay(bet)) return;
    busy = true;
    addMoney(-bet, true);
    msg.textContent = 'Good luck…'; msg.className = 'slotmsg';
    const res = [pick(), pick(), pick()];
    reels.forEach((r, i) => {
      r.classList.add('spin');
      const iv = setInterval(() => { r.textContent = SYM[(Math.random() * SYM.length) | 0].e; if (i === 0) sfx('reel'); }, 70);
      setTimeout(() => {
        clearInterval(iv);
        r.textContent = SYM[res[i]].e; r.classList.remove('spin');
        if (alive) sfx('stop');
        if (i === 2) finish(res);
      }, 650 + i * 420);
    });
  };
  function finish(res) {
    busy = false;
    let win = payout(res[0], res[1], res[2], bet);
    if (win > bet && buff('lucky')) win = Math.round(win * 1.1);
    if (win > 0) {
      addMoney(win);
      const jack = res[0] === res[1] && res[1] === res[2] && res[0] >= 3;
      if (alive) { msg.textContent = win > bet ? `WIN ${fmt(win)}!` : 'Bet back.'; msg.className = 'slotmsg ' + (win > bet ? 'win' : ''); sfx(jack ? 'big' : win > bet ? 'win' : 'coin'); }
      if (jack) { G.send({ t: 'ev', k: 'say', v: `hit ${SYM[res[0]].e}${SYM[res[0]].e}${SYM[res[0]].e} on the slots for ${fmt(win)}!` }); toast('JACKPOT! ' + fmt(win), 'good'); }
    } else if (alive) { msg.textContent = 'No win. Spin again?'; sfx('lose'); }
    if (S.money < 10 && alive) msg.textContent = 'Out of cash. The cashier, the range and the pond can help.';
  }
}
