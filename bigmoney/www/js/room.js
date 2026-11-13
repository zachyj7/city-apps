// The casino floor's referee. One copy runs for a room, in the browser of whoever is hosting.
// It never touches the page: connections are plain objects with send(), so it also runs in Node for tests.
import { newDeck, bjTotal, evalHand, handName, handCat } from './cards.js';

const now = () => Date.now();
const BOTS = ['Lucky Lou', 'Diamond Dee', 'Big Tony', 'River Rae', 'All-In Al', 'Chip Charlie', 'Queenie', 'Slow Roll Sal'];
const clean = (s, n) => String(s || '').replace(/[<>\n\r]/g, '').trim().slice(0, n);

export class Room {
  constructor(cfg) {
    this.P = new Map();
    this.n = 1;
    this.bj = {};
    this.pk = {};
    for (const c of cfg.bj) this.bj[c.id] = { id: c.id, min: c.min, max: c.max, seats: Array(c.seats).fill(null), dealer: [], hole: true, phase: 'bet', turn: -1, dl: 0, deck: [] };
    for (const c of cfg.pk) this.pk[c.id] = { id: c.id, sb: c.sb, bb: c.bb, min: c.min, max: c.max, seats: Array(c.seats).fill(null), board: [], pot: 0, btn: -1, turn: -1, phase: 'idle', cur: 0, minR: c.bb, dl: 0, deck: [], msg: '', auto: false, reveal: false, botAt: 0 };
    this.lastPos = 0;
    this.lastPing = 0;
    this.iv = setInterval(() => this.tick(), 100);
  }

  close() { clearInterval(this.iv); }

  // ---------------------------------------------------------------- people
  add(conn) {
    const p = { id: 'p' + this.n++, conn, name: 'Guest', look: null, x: 0, y: 0, z: 15, r: 0, a: 0, in: false, seat: null, seen: now() };
    this.P.set(p.id, p);
    conn.onmsg = m => { p.seen = now(); try { this.onMsg(p, m); } catch (e) { console.error('room', e); } };
    conn.onclose = () => this.drop(p);
    return p;
  }

  drop(p) {
    if (!this.P.has(p.id)) return;
    this.P.delete(p.id);
    if (p.seat) {
      if (p.seat.k === 'bj') this.bjLeave(this.bj[p.seat.tb], p.seat.i);
      else this.pkLeave(this.pk[p.seat.tb], p.seat.i);
    }
    if (p.in) this.bcast({ t: 'left', id: p.id });
  }

  send(pid, m) { const p = this.P.get(pid); if (p) try { p.conn.send(m); } catch (e) { /* gone */ } }
  bcast(m, except) { for (const p of this.P.values()) if (p.in && p.id !== except) try { p.conn.send(m); } catch (e) { /* gone */ } }
  pay(pid, amt, why) { if (amt) this.send(pid, { t: 'pay', amt, why }); }
  pub(p) { return { id: p.id, name: p.name, look: p.look, x: p.x, y: p.y, z: p.z, r: p.r, a: p.a }; }

  onMsg(p, m) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'hello') {
      p.name = clean(m.name, 16) || 'Guest';
      p.look = m.look || null;
      const first = !p.in;
      p.in = true;
      p.conn.send({ t: 'welcome', id: p.id, players: [...this.P.values()].filter(o => o.in && o !== p).map(o => this.pub(o)),
        bj: Object.values(this.bj).map(t => this.bjPub(t)), pk: Object.values(this.pk).map(t => this.pkPub(t)) });
      if (first) this.bcast({ t: 'join', p: this.pub(p) }, p.id);
      return;
    }
    if (!p.in) return;
    switch (m.t) {
      case 'pos': p.x = +m.x || 0; p.y = +m.y || 0; p.z = +m.z || 0; p.r = +m.r || 0; p.a = m.a | 0; break;
      case 'look': p.look = m.look; if (m.name) p.name = clean(m.name, 16) || p.name; this.bcast({ t: 'pl', id: p.id, name: p.name, look: p.look }, p.id); break;
      case 'chat': { const s = clean(m.m, 140); if (s) this.bcast({ t: 'chat', id: p.id, name: p.name, m: s }); break; }
      case 'ev': this.bcast({ t: 'ev', id: p.id, name: p.name, k: clean(m.k, 20), v: m.v }, p.id); break;
      case 'round': for (const o of this.P.values()) if (o.in && o !== p) this.pay(o.id, 25, 'round'); this.bcast({ t: 'ev', id: p.id, name: p.name, k: 'round' }); break;
      case 'bj': this.bjMsg(p, m); break;
      case 'pk': this.pkMsg(p, m); break;
    }
  }

  tick() {
    const t = now();
    if (t - this.lastPos >= 100 && this.P.size > 1) {
      this.lastPos = t;
      this.bcast({ t: 'ps', p: [...this.P.values()].filter(p => p.in).map(p => [p.id, p.x, p.y, p.z, p.r, p.a]) });
    }
    if (t - this.lastPing >= 2000) {
      this.lastPing = t;
      this.bcast({ t: 'ping' });
      for (const p of [...this.P.values()]) if (!p.conn.local && t - p.seen > 20000) this.drop(p);
    }
    for (const tb of Object.values(this.bj)) this.bjTick(tb, t);
    for (const tb of Object.values(this.pk)) this.pkTick(tb, t);
  }

  // ---------------------------------------------------------------- blackjack
  bjPub(t) {
    return { id: t.id, min: t.min, max: t.max, phase: t.phase, turn: t.turn, tl: t.dl ? Math.max(0, t.dl - now()) : 0,
      dealer: t.hole && t.dealer.length > 1 ? [t.dealer[0], -1] : t.dealer.slice(),
      seats: t.seats.map(s => s && { pid: s.pid, name: s.name, bet: s.bet, cards: s.cards.slice(), st: s.st, res: s.res || '', win: s.win || 0 }) };
  }
  bjSend(t) { this.bcast({ t: 'bjs', s: this.bjPub(t) }); }
  draw(t, decks) { if (!t.deck.length) t.deck = newDeck(decks); return t.deck.pop(); }

  bjMsg(p, m) {
    const t = this.bj[m.tb];
    if (!t) return;
    const si = t.seats.findIndex(s => s && s.pid === p.id), s = si >= 0 ? t.seats[si] : null;
    switch (m.a) {
      case 'sit': {
        if (s || p.seat) return;
        let i = m.seat | 0;
        if (i < 0 || i >= t.seats.length || t.seats[i]) i = t.seats.findIndex(x => !x);
        if (i < 0) return this.send(p.id, { t: 'note', m: 'That table is full.' });
        t.seats[i] = { pid: p.id, name: p.name, bet: 0, cards: [], st: 'wait' };
        p.seat = { k: 'bj', tb: t.id, i };
        break;
      }
      case 'leave': if (!s) return; this.bjLeave(t, si); return;
      case 'bet': {
        if (!s || t.phase !== 'bet' || s.bet > 0) return;
        const amt = Math.min(t.max, Math.max(t.min, Math.floor(+m.amt || 0)));
        s.bet = amt; s.st = 'ready';
        this.pay(p.id, -amt, 'bj');
        if (!t.dl) t.dl = now() + 12000;
        if (t.seats.every(x => !x || x.bet > 0)) t.dl = Math.min(t.dl, now() + 1500);
        break;
      }
      case 'hit': {
        if (!s || t.phase !== 'play' || t.turn !== si) return;
        s.cards.push(this.draw(t, 6));
        const v = bjTotal(s.cards).t;
        if (v > 21) { s.st = 'bust'; this.bjNext(t); } else if (v === 21) { s.st = 'stand'; this.bjNext(t); } else t.dl = now() + 20000;
        break;
      }
      case 'stand': if (!s || t.phase !== 'play' || t.turn !== si) return; s.st = 'stand'; this.bjNext(t); break;
      case 'double': {
        if (!s || t.phase !== 'play' || t.turn !== si || s.cards.length !== 2) return;
        this.pay(p.id, -s.bet, 'bj');
        s.bet *= 2;
        s.cards.push(this.draw(t, 6));
        s.st = bjTotal(s.cards).t > 21 ? 'bust' : 'stand';
        this.bjNext(t);
        break;
      }
      default: return;
    }
    this.bjSend(t);
  }

  bjLeave(t, i) {
    const s = t.seats[i];
    if (!s) return;
    const p = this.P.get(s.pid);
    if (p) p.seat = null;
    t.seats[i] = null;
    if (t.phase === 'bet') {
      if (s.bet > 0) this.pay(s.pid, s.bet, 'bjback');
      if (!t.seats.some(x => x && x.bet > 0)) t.dl = 0;
    } else if (t.phase === 'play' && t.turn === i) this.bjNext(t);
    this.bjSend(t);
  }

  bjDeal(t) {
    const live = t.seats.filter(s => s && s.bet > 0);
    if (!live.length) { t.dl = 0; return; }
    if (t.deck.length < 60) t.deck = newDeck(6);
    for (const s of live) { s.cards = [this.draw(t, 6), this.draw(t, 6)]; s.st = bjTotal(s.cards).t === 21 ? 'bj' : 'play'; }
    t.dealer = [this.draw(t, 6), this.draw(t, 6)];
    t.hole = true;
    t.turn = -1;
    if (bjTotal(t.dealer).t === 21) { t.hole = false; t.phase = 'dealer'; t.dl = now() + 1200; } else { t.phase = 'play'; this.bjNext(t); }
  }

  bjNext(t) {
    for (let i = t.turn + 1; i < t.seats.length; i++) {
      const s = t.seats[i];
      if (s && s.st === 'play') { t.turn = i; t.dl = now() + 20000; return; }
    }
    t.turn = -1; t.phase = 'dealer'; t.hole = false; t.dl = now() + 900;
  }

  bjTick(t, n) {
    if (!t.dl || n < t.dl) return;
    if (t.phase === 'bet') this.bjDeal(t);
    else if (t.phase === 'play') { const s = t.seats[t.turn]; if (s) s.st = 'stand'; this.bjNext(t); }
    else if (t.phase === 'dealer') {
      const waiting = t.seats.some(s => s && s.st === 'stand');
      if (waiting && bjTotal(t.dealer).t < 17) { t.dealer.push(this.draw(t, 6)); t.dl = n + 900; } else this.bjResolve(t);
    } else if (t.phase === 'done') {
      for (const s of t.seats) if (s) { s.bet = 0; s.cards = []; s.st = 'wait'; s.res = ''; s.win = 0; }
      t.dealer = []; t.hole = true; t.phase = 'bet'; t.dl = 0;
    }
    this.bjSend(t);
  }

  bjResolve(t) {
    const d = bjTotal(t.dealer).t, dbj = t.dealer.length === 2 && d === 21;
    for (const s of t.seats) {
      if (!s || !s.bet) continue;
      const v = bjTotal(s.cards).t;
      let win = 0;
      if (s.st === 'bj') win = dbj ? s.bet : Math.floor(s.bet * 2.5);
      else if (s.st === 'bust') win = 0;
      else if (dbj) win = 0;
      else if (d > 21 || v > d) win = s.bet * 2;
      else if (v === d) win = s.bet;
      s.win = win;
      s.res = s.st === 'bj' && !dbj ? 'BLACKJACK' : s.st === 'bust' ? 'BUST' : win > s.bet ? 'WIN' : win === s.bet ? 'PUSH' : 'LOSE';
      s.st = 'done';
      this.pay(s.pid, win, 'bjwin');
    }
    t.phase = 'done'; t.turn = -1; t.dl = now() + 4500;
  }

  // ---------------------------------------------------------------- poker (no-limit hold'em)
  pkPub(t) {
    return { id: t.id, sb: t.sb, bb: t.bb, min: t.min, max: t.max, phase: t.phase, turn: t.turn, btn: t.btn, board: t.board.slice(), pot: t.pot, cur: t.cur, minR: t.minR,
      tl: t.dl ? Math.max(0, t.dl - now()) : 0, msg: t.msg,
      seats: t.seats.map(s => s && { pid: s.pid, name: s.name, stack: s.stack, bet: s.bet, tot: s.total, in: s.in, folded: s.folded, allin: s.allin, bot: !!s.bot, gone: !!s.gone,
        last: s.last || '', res: s.res || '', cards: t.phase === 'show' && t.reveal && s.in && !s.folded ? s.cards.slice() : null }) };
  }
  pkSend(t) { this.bcast({ t: 'pks', s: this.pkPub(t) }); }
  pkLive(t) { return ['pre', 'flop', 'turn', 'river'].includes(t.phase); }

  pkMsg(p, m) {
    const t = this.pk[m.tb];
    if (!t) return;
    const si = t.seats.findIndex(s => s && s.pid === p.id && !s.gone), s = si >= 0 ? t.seats[si] : null;
    switch (m.a) {
      case 'sit': {
        if (s || p.seat) return;
        const buy = Math.min(t.max, Math.max(t.min, Math.floor(+m.buy || 0)));
        let i = m.seat | 0;
        if (i < 0 || i >= t.seats.length || t.seats[i]) i = t.seats.findIndex(x => !x);
        if (i < 0) {   // bump a house player who isn't in a hand
          i = t.seats.findIndex(x => x.bot && !(this.pkLive(t) && x.in));
          if (i < 0) return this.send(p.id, { t: 'note', m: 'That table is full.' });
        }
        t.seats[i] = { pid: p.id, name: p.name, stack: buy, bet: 0, total: 0, cards: [], in: false, folded: false, allin: false, acted: false };
        p.seat = { k: 'pk', tb: t.id, i };
        this.pay(p.id, -buy, 'pkin');
        if (t.phase === 'idle') t.dl = Math.min(t.dl || Infinity, now() + 1500);
        break;
      }
      case 'leave': if (!s) return; this.pkLeave(t, si); return;
      case 'buy': {
        if (!s || (this.pkLive(t) && s.in)) return;
        const add = Math.min(Math.floor(+m.amt || 0), t.max - s.stack);
        if (add > 0) { s.stack += add; this.pay(p.id, -add, 'pkin'); }
        break;
      }
      case 'fold': case 'call': case 'raise':
        if (!s || !this.pkLive(t) || t.turn !== si) return;
        this.pkAct(t, si, m.a, m.amt);
        return;
      default: return;
    }
    this.pkSend(t);
  }

  pkLeave(t, i) {
    const s = t.seats[i];
    if (!s || s.gone) return;
    const p = this.P.get(s.pid);
    if (p) p.seat = null;
    this.pay(s.pid, s.stack, 'pkout');
    if (this.pkLive(t) && s.in) {
      s.stack = 0; s.gone = true;
      if (!s.folded) {
        if (t.turn === i) return this.pkAct(t, i, 'fold');
        s.folded = true;
        if (t.seats.filter(x => x && x.in && !x.folded).length === 1) return this.pkEnd(t);
      }
    } else t.seats[i] = null;
    this.pkSend(t);
  }

  pkBots(t) {
    const humans = t.seats.filter(s => s && !s.bot).length;
    const want = humans ? Math.max(0, 4 - humans) : 0;
    let bots = t.seats.filter(s => s && s.bot).length;
    for (let i = t.seats.length - 1; i >= 0 && bots > want; i--) if (t.seats[i] && t.seats[i].bot) { t.seats[i] = null; bots--; }
    while (bots < want) {
      const free = t.seats.map((s, i) => s ? -1 : i).filter(i => i >= 0);
      if (!free.length) break;
      const used = t.seats.filter(Boolean).map(s => s.name);
      const names = BOTS.filter(n => !used.includes(n));
      t.seats[free[Math.floor(Math.random() * free.length)]] = { pid: 'bot' + this.n++, name: names[Math.floor(Math.random() * names.length)] || 'House', bot: true,
        stack: t.bb * 100, bet: 0, total: 0, cards: [], in: false, folded: false, allin: false, acted: false };
      bots++;
    }
  }

  pkStart(t) {
    const n = t.seats.length;
    const ok = i => t.seats[i] && t.seats[i].stack > 0;
    const nx = i => { for (let k = 1; k <= n; k++) { const j = (i + k + n) % n; if (ok(j)) return j; } return -1; };
    const count = t.seats.filter((s, i) => ok(i)).length;
    t.btn = nx(t.btn);
    t.deck = newDeck(1);
    for (const s of t.seats) if (s) Object.assign(s, { in: s.stack > 0, folded: false, allin: false, acted: false, bet: 0, total: 0, res: '', last: '', cards: s.stack > 0 ? [t.deck.pop(), t.deck.pop()] : [] });
    const sbI = count === 2 ? t.btn : nx(t.btn), bbI = nx(sbI);
    const post = (i, a) => { const s = t.seats[i], c = Math.min(a, s.stack); s.stack -= c; s.bet += c; s.total += c; if (!s.stack) s.allin = true; };
    post(sbI, t.sb); post(bbI, t.bb);
    Object.assign(t, { cur: t.bb, minR: t.bb, pot: 0, board: [], phase: 'pre', msg: '', auto: false, reveal: false, turn: -1 });
    for (const s of t.seats) if (s && s.in && !s.bot) this.send(s.pid, { t: 'pkh', tb: t.id, cards: s.cards });
    if (!this.pkNext(t, bbI)) return this.pkStreet(t);
    this.pkSend(t);
  }

  pkNext(t, from) {
    const n = t.seats.length;
    for (let k = 1; k <= n; k++) {
      const j = (from + k) % n, s = t.seats[j];
      if (s && s.in && !s.folded && !s.allin && (!s.acted || s.bet < t.cur)) {
        t.turn = j; t.dl = now() + 25000;
        if (s.bot) t.botAt = now() + 900 + Math.random() * 1500;
        return true;
      }
    }
    return false;
  }

  pkAct(t, i, a, amt) {
    const s = t.seats[i];
    const call = () => { const c = Math.min(t.cur - s.bet, s.stack); s.stack -= c; s.bet += c; s.total += c; s.last = c > 0 ? 'call' : 'check'; };
    if (a === 'fold') { s.folded = true; s.last = 'fold'; }
    else if (a === 'raise') {
      const max = s.bet + s.stack;
      let to = Math.min(Math.floor(+amt || 0), max);
      to = Math.max(to, Math.min(max, t.cur + t.minR));
      if (to <= t.cur) call();
      else {
        const add = to - s.bet;
        s.stack -= add; s.bet = to; s.total += add;
        if (to - t.cur >= t.minR) t.minR = to - t.cur;
        s.last = t.cur > 0 ? 'raise' : 'bet';
        t.cur = to;
        for (const o of t.seats) if (o && o !== s) o.acted = false;
      }
    } else call();
    if (!s.stack && !s.folded) { s.allin = true; s.last = 'all in'; }
    s.acted = true;
    if (t.seats.filter(x => x && x.in && !x.folded).length === 1) return this.pkEnd(t);
    if (!this.pkNext(t, i)) return this.pkStreet(t);
    this.pkSend(t);
  }

  pkStreet(t) {
    for (const s of t.seats) if (s) { t.pot += s.bet; s.bet = 0; s.acted = false; if (s.last !== 'fold' && s.last !== 'all in') s.last = ''; }
    t.cur = 0; t.minR = t.bb; t.turn = -1; t.auto = false;
    if (t.phase === 'river') return this.pkEnd(t);
    if (t.phase === 'pre') { t.phase = 'flop'; t.board.push(t.deck.pop(), t.deck.pop(), t.deck.pop()); }
    else { t.phase = t.phase === 'flop' ? 'turn' : 'river'; t.board.push(t.deck.pop()); }
    const can = t.seats.filter(s => s && s.in && !s.folded && !s.allin).length;
    if (can <= 1 || !this.pkNext(t, t.btn)) { t.auto = true; t.dl = now() + 1400; }
    this.pkSend(t);
  }

  pkEnd(t) {
    for (const s of t.seats) if (s) { t.pot += s.bet; s.bet = 0; }
    const cont = t.seats.map((s, i) => s && s.total > 0 ? { i, s } : null).filter(Boolean);
    const live = cont.filter(c => !c.s.folded);
    t.reveal = live.length > 1;
    for (const c of live) c.ev = t.reveal ? evalHand([...c.s.cards, ...t.board]) : 0;
    const levels = [...new Set(live.map(c => c.s.total))].sort((a, b) => a - b);
    const won = {};
    let prev = 0;
    for (const lv of levels) {
      let pot = 0;
      for (const c of cont) pot += Math.max(0, Math.min(c.s.total, lv) - prev);
      const el = live.filter(c => c.s.total >= lv), best = Math.max(...el.map(c => c.ev)), ws = el.filter(c => c.ev === best);
      const share = Math.floor(pot / ws.length);
      ws.forEach((w, k) => { won[w.i] = (won[w.i] || 0) + share + (k === 0 ? pot - share * ws.length : 0); });
      prev = lv;
    }
    // chips nobody left in the hand can win (everyone contesting that side pot folded) go back to whoever put them in
    for (const c of cont) if (c.s.folded && c.s.total > prev) { const back = c.s.total - prev; if (c.s.gone) this.pay(c.s.pid, back, 'pkout'); else c.s.stack += back; }
    const parts = [];
    for (const c of live) {
      const w = won[c.i] || 0;
      c.s.stack += w;
      // "won" only counts what came from other players, so an uncalled bet coming back isn't a win
      if (w > c.s.total) { c.s.res = '+$' + (w - c.s.total) + (t.reveal ? ' · ' + handName(c.ev) : ''); parts.push(c.s.name + ' wins $' + w + (t.reveal ? ' with ' + handName(c.ev) : '')); }
      else if (t.reveal) c.s.res = handName(c.ev);
    }
    t.msg = parts.join(' · ');
    t.phase = 'show'; t.turn = -1; t.auto = false; t.dl = now() + (t.reveal ? 6000 : 2600);
    this.pkSend(t);
  }

  pkClean(t) {
    t.seats.forEach((s, i) => {
      if (!s) return;
      if (s.gone) { t.seats[i] = null; return; }
      if (s.stack <= 0) {
        if (!s.bot) { const p = this.P.get(s.pid); if (p) p.seat = null; this.send(s.pid, { t: 'note', m: 'You busted out. Buy back in any time.' }); }
        t.seats[i] = null; return;
      }
      Object.assign(s, { in: false, folded: false, allin: false, acted: false, bet: 0, total: 0, cards: [], res: '', last: '' });
    });
    Object.assign(t, { board: [], pot: 0, cur: 0, phase: 'idle', turn: -1, msg: '', reveal: false, dl: now() + 2200 });
    this.pkSend(t);
  }

  pkTick(t, n) {
    if (this.pkLive(t)) {
      if (t.auto) { if (n >= t.dl) this.pkStreet(t); return; }
      const s = t.seats[t.turn];
      if (!s) return;
      if (s.bot) { if (n >= t.botAt) { const [a, amt] = this.botMove(t, s); this.pkAct(t, t.turn, a, amt); } } else if (n >= t.dl) this.pkAct(t, t.turn, s.bet >= t.cur ? 'call' : 'fold');
    } else if (t.phase === 'show') { if (n >= t.dl) this.pkClean(t); } else if (n >= t.dl) {
      const before = JSON.stringify(t.seats.map(s => s && s.pid));
      this.pkBots(t);
      const humans = t.seats.some(s => s && !s.bot);
      if (humans && t.seats.filter(s => s && s.stack > 0).length >= 2) return this.pkStart(t);
      t.dl = n + 1000;
      if (before !== JSON.stringify(t.seats.map(s => s && s.pid))) this.pkSend(t);
    }
  }

  botMove(t, s) {
    const toCall = t.cur - s.bet, pot = t.pot + t.seats.reduce((a, x) => a + (x ? x.bet : 0), 0);
    let str;
    if (!t.board.length) {
      const [a, b] = s.cards.map(c => c % 13).sort((x, y) => y - x);
      const suited = ((s.cards[0] / 13) | 0) === ((s.cards[1] / 13) | 0);
      if (a === b) str = 0.6 + a / 12 * 0.4;
      else str = 0.12 + (a + b) / 24 * 0.45 + (suited ? 0.07 : 0) + (a - b === 1 ? 0.05 : 0) + (a >= 10 ? 0.1 : 0);
    } else {
      const cat = handCat(evalHand([...s.cards, ...t.board])), bcat = handCat(evalHand(t.board));
      str = cat === bcat ? 0.16 + Math.max(...s.cards.map(c => c % 13)) / 12 * 0.14 : [0.18, 0.5, 0.7, 0.8, 0.87, 0.91, 0.96, 0.99, 1][cat];
    }
    str += (Math.random() - 0.5) * 0.16;
    const size = f => t.cur + Math.max(t.minR, Math.round(pot * f / t.bb) * t.bb);
    if (toCall <= 0) return str > 0.62 || Math.random() < 0.1 ? ['raise', size(0.4 + Math.random() * 0.35)] : ['call'];
    if (str > 0.86 && Math.random() < 0.6) return ['raise', size(0.7)];
    if (str > toCall / (pot + toCall) + 0.14 && (toCall < s.stack * 0.4 || str > 0.72)) return ['call'];
    if (toCall <= t.bb && str > 0.25) return ['call'];
    return ['fold'];
  }
}
