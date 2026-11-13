// The referee. It runs in one player's browser (the host) and holds the true game.
// Every change is sent to everyone as one full snapshot, so if the host leaves, whoever takes over
// carries on from their last snapshot.
import { makePool, checkTurn, rackPoints, openingPoints, isMJ, OPEN_POINTS, DEAL, segments, cellsFromSets, tidyCells, layoutSets } from './rules.js';
import { aiTurn } from './ai.js';

const CPU_NAMES = ['Ruby', 'Otto', 'Pip', 'Juno', 'Ziggy', 'Nova', 'Bolt', 'Echo'];
const LEVELS = ['easy', 'medium', 'hard'];
const RACK_COLORS = ['red', 'blue', 'green', 'pink', 'purple', 'black', 'white', 'yellow'];

const MAX_SEATS = 8;

export function emptyState() {
  return { v: 0, phase: 'lobby', players: [], pool: [], table: [], cells: [], turn: null, turnNo: 0, work: null, passes: 0, sets: 1, log: [], result: null, round: 0 };
}

export class Room {
  constructor(snapshot) {
    this.s = snapshot ? JSON.parse(JSON.stringify(snapshot)) : emptyState();
    for (const p of this.s.players) p.on = !!p.cpu;        // people have to say hello again; computers are always here
    this.cpuT = null;
    if (!Array.isArray(this.s.cells)) this.s.cells = cellsFromSets(this.s.table || []);
    this.conns = new Set();
    this.ping = setInterval(() => this.each(c => c.send({ t: 'ping' })), 3000);
  }

  close() { clearInterval(this.ping); clearTimeout(this.cpuT); this.cpuT = null; this.closed = true; }
  each(f) { for (const c of this.conns) f(c); }
  player(pid) { return this.s.players.find(p => p.pid === pid); }
  seated() { return this.s.players.filter(p => p.seat); }
  note(text) { this.s.log.push(text); if (this.s.log.length > 6) this.s.log.shift(); }

  // Someone arrived holding a newer game than ours (say the host reloaded and grabbed the table first):
  // carry on with theirs, keeping everyone who is connected right now.
  adopt(snap) {
    const s = this.s;
    if (!snap || !Array.isArray(snap.players) || !(snap.at > Date.now() - 6 * 3600e3)) return;
    if (!(snap.round > s.round || (snap.round === s.round && snap.v > s.v))) return;
    const here = s.players.filter(p => p.on);
    this.s = JSON.parse(JSON.stringify(snap));
    const online = new Set([...this.conns].map(c => c.pid));
    for (const p of this.s.players) p.on = !!p.cpu || online.has(p.pid);
    for (const p of here) if (!this.player(p.pid)) this.s.players.push({ ...p, seat: false, rack: [], opened: false });
  }

  push() {
    this.s.v++;
    this.s.at = Date.now();
    const m = { t: 'state', s: this.s };
    this.each(c => c.send(m));
    this.schedule();
  }

  // ---- computer players ----
  schedule() {
    const s = this.s;
    if (this.closed || this.cpuT || s.phase !== 'play') return;
    const p = this.player(s.turn);
    if (!p || !p.cpu) return;
    const turnNo = s.turnNo;
    // a short pause to "think", so people can follow along
    this.cpuT = setTimeout(() => { this.cpuT = null; this.cpuTurn(turnNo); }, 1500 + Math.random() * 1300);
  }

  cpuTurn(turnNo) {
    const s = this.s;
    const p = this.player(s.turn);
    if (this.closed || s.phase !== 'play' || s.turnNo !== turnNo || !p || !p.cpu) return;
    let plan = null;
    try { plan = aiTurn(p.cpu, s.table, p.rack, p.opened); } catch (e) { console.error(e); }
    if (!plan || checkTurn(s.table, p.rack, plan.table, plan.rack, p.opened)) return this.draw(p);
    // Show the move on the table for a moment, then make it final.
    s.work = { cells: layoutSets(s.cells, plan.table), table: plan.table, rack: plan.rack };
    this.s.v++; this.s.at = Date.now();
    const m = { t: 'state', s: this.s };
    this.each(c => c.send(m));
    this.cpuT = setTimeout(() => {
      this.cpuT = null;
      if (this.closed || s !== this.s || s.turnNo !== turnNo) return;
      this.commit(p, s.work);
    }, 1400);
  }

  addCpu(level) {
    const s = this.s;
    if (s.phase === 'play' || !LEVELS.includes(level)) return;
    if (s.players.filter(q => q.on).length >= 8) return;
    const used = new Set(s.players.map(q => q.name));
    const name = CPU_NAMES.find(n => !used.has(n)) || 'Robot ' + (s.players.length + 1);
    const usedColors = new Set(s.players.map(q => q.rc));
    const rc = RACK_COLORS.find(c => !usedColors.has(c)) || 'yellow';
    s.players.push({ pid: 'cpu-' + Math.random().toString(36).slice(2, 8), name, cpu: level, rc, on: true, seat: false, rack: [], opened: false, total: 0 });
    this.note(`${name} (computer, ${level}) sat down`);
  }

  add(c) {
    this.conns.add(c);
    c.onmsg = m => { try { this.msg(c, m); } catch (e) { console.error(e); } };
    c.onclose = () => {
      this.conns.delete(c);
      const p = c.pid && this.player(c.pid);
      if (p && ![...this.conns].some(o => o.pid === p.pid)) {
        p.on = false;
        if (this.s.phase === 'lobby') this.s.players = this.s.players.filter(q => q !== p);
        this.push();
      }
    };
  }

  msg(c, m) {
    const s = this.s;
    if (m.t === 'hello') {
      c.pid = m.pid;
      if (m.snap) this.adopt(m.snap);
      let p = this.player(m.pid);
      if (!p) {
        p = { pid: m.pid, name: '', seat: false, rack: [], opened: false, total: 0 };
        s.players.push(p);
        if (s.phase === 'lobby') this.note(`${clean(m.name)} sat down`);
        else this.note(`${clean(m.name)} is watching`);
      }
      p.name = clean(m.name); p.rc = cleanColor(m.rc); p.peer = m.peer; p.cam = !!m.cam; p.mic = !!m.mic; p.on = true;
      return this.push();
    }
    const p = c.pid && this.player(c.pid);
    if (!p) return;

    if (m.t === 'addcpu') { this.addCpu(m.level); return this.push(); }
    if (m.t === 'rmcpu') {
      if (s.phase === 'play') return;
      s.players = s.players.filter(q => !(q.cpu && q.pid === m.pid));
      return this.push();
    }

    if (m.t === 'cam') { p.cam = !!m.cam; p.mic = !!m.mic; return this.push(); }
    if (m.t === 'rc') { p.rc = cleanColor(m.rc); return this.push(); }

    // Close the table for everyone: they all go back to the join screen and the game is cleared.
    if (m.t === 'closeall') {
      this.s = emptyState();
      this.each(k => k.send({ t: 'closed', by: p.name }));
      return;
    }

    if (m.t === 'start') {
      if (s.phase === 'play') return;
      const ready = s.players.filter(q => q.on);
      if (ready.length < 2) return;
      const seats = ready.slice(0, MAX_SEATS);
      s.sets = seats.length > 4 ? 2 : 1;
      s.pool = makePool(s.sets);
      for (const q of s.players) { q.seat = seats.includes(q); q.rack = []; q.opened = false; }
      for (const q of seats) q.rack = s.pool.splice(0, DEAL);
      s.table = []; s.cells = []; s.work = null; s.passes = 0; s.result = null; s.round++;
      s.phase = 'play';
      s.log = [];
      // Take turns starting with a different player each game.
      s.turn = seats[(s.round - 1) % seats.length].pid; s.turnNo++;
      this.note(`New game! ${s.sets === 2 ? 'Two sets' : 'One set'} of tiles. ${this.player(s.turn).name} goes first.`);
      return this.push();
    }

    if (m.t === 'newgame') {
      if (s.phase !== 'over') return;
      s.phase = 'lobby'; s.table = []; s.cells = []; s.work = null; s.result = null;
      s.players = s.players.filter(q => q.on);
      for (const q of s.players) { q.seat = false; q.rack = []; }
      return this.push();
    }

    if (s.phase !== 'play') return;

    if (m.t === 'skip') {
      const cur = this.player(s.turn);
      if (!cur || cur.on) return;
      this.note(`${p.name} skipped ${cur.name}'s turn`);
      return this.draw(cur);
    }

    if (s.turn !== p.pid) return;

    if (m.t === 'work') {
      const cells = Array.isArray(m.cells) ? m.cells.slice(0, 600).map(x => (x == null ? null : Number(x))) : null;
      const rack = Array.isArray(m.rack) ? m.rack.map(Number) : null;
      if (!cells || !rack) return;
      const table = segments(cells);
      const want = [...s.table.flat(), ...p.rack].sort((a, b) => a - b).join(',');
      const got = [...table.flat(), ...rack].sort((a, b) => a - b).join(',');
      if (want !== got) return;
      s.work = { cells, table, rack };
      return this.push();
    }

    if (m.t === 'draw') return this.draw(p);

    if (m.t === 'done') {
      const w = s.work || { cells: s.cells, table: s.table, rack: p.rack };
      const why = checkTurn(s.table, p.rack, w.table, w.rack, p.opened);
      if (why) return c.send({ t: 'nope', why });
      return this.commit(p, w);
    }
  }

  // A finished, checked turn: put it on the table, then it's the next player's turn (or the game is won).
  commit(p, w) {
    const s = this.s;
    {
      const played = p.rack.length - w.rack.length;
      if (p.opened && isMJ(s.table, p.rack, w.table)) {
        s.fx = { t: 'mj', name: p.name, k: s.v + 1 };
        this.note(`MJ! ${p.name} split a run and played in the middle`);
      }
      if (!p.opened) {
        p.opened = true;
        this.note(`${p.name} made a first play worth ${openingPoints(s.table, p.rack, w.table)} points (${OPEN_POINTS} needed)`);
      } else this.note(`${p.name} played ${played} tile${played === 1 ? '' : 's'}`);
      s.cells = tidyCells(w.cells || layoutSets(s.cells, w.table)); s.table = segments(s.cells);
      p.rack = w.rack; s.work = null; s.passes = 0;
      if (!p.rack.length) return this.finish(p);
      return this.next();
    }
  }

  draw(p) {
    const s = this.s;
    s.work = null;
    if (s.pool.length) { p.rack.push(s.pool.pop()); s.passes = 0; this.note(`${p.name} drew a tile`); }
    else {
      s.passes++;
      this.note(`${p.name} passed (no tiles left to draw)`);
      if (s.passes >= this.seated().length) {
        const best = [...this.seated()].sort((a, b) => rackPoints(a.rack) - rackPoints(b.rack))[0];
        return this.finish(best);
      }
    }
    this.next();
  }

  next() {
    const s = this.s, seats = this.seated();
    const i = seats.findIndex(q => q.pid === s.turn);
    s.turn = seats[(i + 1) % seats.length].pid;
    s.turnNo++;
    this.push();
  }

  finish(winner) {
    const s = this.s;
    let won = 0;
    const result = this.seated().map(q => {
      const left = rackPoints(q.rack);
      if (q === winner) return { pid: q.pid, name: q.name, left, delta: 0, win: true };
      won += left; q.total -= left;
      return { pid: q.pid, name: q.name, left, delta: -left };
    });
    winner.total += won;
    result.find(r => r.win).delta = won;
    s.result = result; s.phase = 'over'; s.turn = null; s.work = null;
    this.note(`${winner.name} wins!`);
    this.push();
  }
}

function cleanColor(c) { return /^[a-z]{2,8}$/.test(c || '') ? c : 'yellow'; }
function clean(n) { return String(n || 'Player').replace(/[<>&"]/g, '').trim().slice(0, 18) || 'Player'; }
