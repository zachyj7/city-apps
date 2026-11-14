// The referee. It runs in one player's browser (the host) and holds the true game.
// Every change is sent to everyone as one full snapshot, so if the host leaves, whoever takes over
// carries on from their last snapshot.
import { makePool, checkTurn, isMJ, DEAL, groupsOf, tidyPos, layoutPos, packPos } from './rules.js';
import { aiTurn } from './ai.js';
import { check } from './help.js';

const CPU_NAMES = ['Ruby', 'Otto', 'Pip', 'Juno', 'Ziggy', 'Nova', 'Bolt', 'Echo'];
const LEVELS = ['easy', 'medium', 'hard'];
const RACK_COLORS = ['red', 'blue', 'green', 'pink', 'purple', 'black', 'white', 'yellow'];

const MAX_SEATS = 8;

export function emptyState() {
  return { v: 0, phase: 'lobby', players: [], pool: [], table: [], pos: {}, turn: null, turnNo: 0, work: null, passes: 0, sets: 1, log: [], result: null, round: 0 };
}

export class Room {
  constructor(snapshot) {
    this.s = snapshot ? JSON.parse(JSON.stringify(snapshot)) : emptyState();
    for (const p of this.s.players) p.on = !!p.cpu;        // people have to say hello again; computers are always here
    this.cpuT = null;
    fixState(this.s);
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
    fixState(this.s);
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
    const pos = layoutPos(s.pos, plan.table);
    s.work = { pos, table: groupsOf(pos), rack: plan.rack };
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
    s.players.push({ pid: 'cpu-' + Math.random().toString(36).slice(2, 8), name, cpu: level, rc, on: true, seat: false, rack: [], opened: false, wins: 0 });
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
        p = { pid: m.pid, name: '', seat: false, rack: [], opened: false, wins: 0 };
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
    // They switched the best-play helper on: marked as a cheater, and everyone is told. Switched off, the mark
    // comes off straight away. Each time it is switched on is counted, for the end of the game.
    if (m.t === 'cheat') {
      if (s.phase !== 'play' || !p.seat) return;
      if (m.on === false) {
        if (!p.cheat) return;
        p.cheat = false;
        return this.push();
      }
      if (s.statsOff || p.cheat) return;   // locked page: no best-play card to switch on
      p.cheat = true; p.cheats = (p.cheats || 0) + 1;
      s.shame = { name: p.name, pid: p.pid, k: s.v + 1 };
      this.note(p.name + ' turned on the best-play helper');
      return this.push();
    }
    // The helper locks (or opens) the Statistics and coach page for the whole table. The sign-in is checked
    // here too, one check at a time and not in quick succession.
    if (m.t === 'statslock') {
      if (this.checking || Date.now() - (this.lastCheck || 0) < 1500) return;
      this.checking = true;
      check(m.u, m.p).then(role => {
        this.checking = false; this.lastCheck = Date.now();
        if (role !== 'helper' || this.closed || this.s !== s) return;
        const off = !!m.off;
        if (!!s.statsOff === off) return this.push();
        s.statsOff = off;
        if (off) for (const q of s.players) q.cheat = false;   // the best-play card goes away with the page
        this.note(off ? 'Statistics and coach were locked' : 'Statistics and coach were opened again');
        this.push();
      });
      return;
    }

    // The shape of their rack (which slots hold a tile), shown on their little rack for everyone.
    if (m.t === 'layout') {
      if (!Array.isArray(m.rows) || !m.rows.length || m.rows.length > 8 || !m.rows.every(x => typeof x === 'string' && /^[01]{1,30}$/.test(x))) return;
      if (p.lay && p.lay.join('/') === m.rows.join('/')) return;
      p.lay = m.rows;
      return this.push();
    }

    // A private note from one player to another (the helper view uses it). Nothing in the game changes.
    if (m.t === 'relay') {
      if (typeof m.to !== 'string' || !m.m || typeof m.m !== 'object' || JSON.stringify(m.m).length > 20000) return;
      const out = { t: 'relay', from: p.pid, m: m.m };
      this.each(k => { if (k.pid === m.to) k.send(out); });
      return;
    }

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
      for (const q of s.players) { q.seat = seats.includes(q); q.rack = []; q.opened = false; q.st = { turns: 0, played: 0, drew: 0, best: 0 }; q.cheat = false; q.cheats = 0; }
      s.startedAt = Date.now();
      for (const q of seats) q.rack = s.pool.splice(0, DEAL);
      s.table = []; s.pos = {}; s.work = null; s.played = null; s.passes = 0; s.result = null; s.round++;
      s.phase = 'play';
      s.log = [];
      // Take turns starting with a different player each game.
      s.turn = seats[(s.round - 1) % seats.length].pid; s.turnNo++;
      this.note(`New game! ${s.sets === 2 ? 'Two sets' : 'One set'} of tiles. ${this.player(s.turn).name} goes first.`);
      return this.push();
    }

    if (m.t === 'newgame') {
      if (s.phase !== 'over') return;
      s.phase = 'lobby'; s.table = []; s.pos = {}; s.work = null; s.result = null;
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

    if (m.t === 'hand') {
      const ids = Array.isArray(m.ids) ? m.ids.slice(0, 120).map(Number).filter(Number.isInteger) : [];
      const off = Array.isArray(m.off) ? m.off.slice(0, 120).map(o => (Array.isArray(o) ? [+o[0] || 0, +o[1] || 0] : [0, 0])) : [];
      const at = Array.isArray(m.at) && m.at.every(Number.isFinite) ? [m.at[0], m.at[1]] : null;
      const out = { t: 'hand', from: p.pid, turnNo: s.turnNo, ids, off, at };
      this.each(k => { if (k.pid !== p.pid) k.send(out); });
      return;
    }

    if (m.t === 'work') {
      const pos = cleanPos(m.pos);
      const rack = Array.isArray(m.rack) ? m.rack.map(Number) : null;
      if (!pos || !rack) return;
      const table = groupsOf(pos);
      const want = [...s.table.flat(), ...p.rack].sort((a, b) => a - b).join(',');
      const got = [...table.flat(), ...rack].sort((a, b) => a - b).join(',');
      if (want !== got) return;
      s.work = { pos, table, rack };
      return this.push();
    }

    if (m.t === 'draw') return this.draw(p);

    if (m.t === 'done') {
      const w = s.work || { pos: s.pos, table: s.table, rack: p.rack };
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
      const st = p.st || (p.st = { turns: 0, played: 0, drew: 0, best: 0 });
      st.turns++; st.played += played; st.best = Math.max(st.best, played);
      if (p.opened && isMJ(s.table, p.rack, w.table)) {
        s.fx = { t: 'mj', name: p.name, k: s.v + 1 };
        this.note(`MJ! ${p.name} split a run and played in the middle`);
      }
      if (!p.opened) {
        p.opened = true;
        this.note(`${p.name} made their first play`);
      } else this.note(`${p.name} played ${played} tile${played === 1 ? '' : 's'}`);
      // Straighten the table up, put each set in order, and pack the sets up tidily.
      s.pos = packPos(tidyPos(w.pos || layoutPos(s.pos, w.table), null, true)); s.table = groupsOf(s.pos);
      const before = p.rack.length, left = w.rack.length;
      if (left === 1 && before > 1 || left > 1 && left <= 3 && before > 3) {
        s.alert = { name: p.name, pid: p.pid, rc: p.rc, n: left, k: s.v + 1 };
        this.note(left === 1 ? `${p.name} is down to their last tile` : `${p.name} is down to ${left} tiles`);
      }
      const keep = new Set(w.rack), put = p.rack.filter(id => !keep.has(id));
      if (put.length) s.played = { pid: p.pid, ids: put, k: s.v + 1 };
      p.rack = w.rack; s.work = null; s.passes = 0;
      if (!p.rack.length) return this.finish(p);
      return this.next();
    }
  }

  draw(p) {
    const s = this.s;
    s.work = null;
    const st = p.st || (p.st = { turns: 0, played: 0, drew: 0, best: 0 });
    st.turns++;
    // everyone gets a little pop-up saying so
    s.drew = { pid: p.pid, name: p.name, rc: p.rc, pass: !s.pool.length, k: s.v + 1 };
    if (s.pool.length) { p.rack.push(s.pool.pop()); s.passes = 0; st.drew++; this.note(`${p.name} drew a tile`); }
    else {
      s.passes++;
      this.note(`${p.name} passed (no tiles left to draw)`);
      // Nobody can draw and everybody passed: the game is stuck, so it ends with no winner.
      if (s.passes >= this.seated().length) return this.finish(null);
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
    // No points: the first player to play all their tiles wins, and only wins are counted.
    if (winner) winner.wins = (winner.wins || 0) + 1;
    s.result = winner ? { pid: winner.pid, name: winner.name } : { pid: null, name: '' };
    s.phase = 'over'; s.turn = null; s.work = null;
    this.note(winner ? `${winner.name} wins!` : 'Nobody could play: no winner this time');
    this.push();
  }
}

function cleanColor(c) { return /^[a-z]{2,8}$/.test(c || '') ? c : 'yellow'; }
function clean(n) { return String(n || 'Player').replace(/[<>&"]/g, '').trim().slice(0, 18) || 'Player'; }

// A table position sent by a player: { tileId: [x, y] } with sensible numbers only.
function cleanPos(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const keys = Object.keys(o);
  if (keys.length > 300) return null;
  const out = {};
  for (const k of keys) {
    const id = Number(k), v = o[k];
    if (!Number.isInteger(id) || !Array.isArray(v) || typeof v[0] !== 'number' || typeof v[1] !== 'number' || !isFinite(v[0]) || !isFinite(v[1])) return null;
    out[id] = [Math.round(Math.min(Math.max(v[0], 0), 60) * 100) / 100, Math.round(Math.min(Math.max(v[1], 0), 400) * 100) / 100];
  }
  return out;
}

// Bring a game saved by an older version up to date (tile positions on the table, wins instead of scores).
function fixState(s) {
  if (!s.pos || typeof s.pos !== 'object' || Array.isArray(s.pos)) s.pos = layoutPos({}, s.table || []);
  if (s.work && !s.work.pos) s.work = null;
  if (Array.isArray(s.result)) { const w = s.result.find(x => x.win); s.result = w ? { pid: w.pid, name: w.name } : { pid: null, name: '' }; }
  delete s.cells;
  for (const p of s.players) { if (typeof p.wins !== 'number') p.wins = 0; delete p.total; }
}
