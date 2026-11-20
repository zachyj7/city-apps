// The referee. It runs in one player's browser (the host) and holds the true game.
// Every change is sent to everyone as one full snapshot, so if the host leaves, whoever takes over
// carries on from their last snapshot.
import { makePool, checkTurn, isMJ, DEAL, groupsOf, tidyPos, layoutPos, packPos, pickValue } from './rules.js';
import { aiTurn } from './ai.js';
import { check } from './help.js';
import { GAMES, cfgFor, COLORS, STAT_PROFILES, RPS_ID, okColor, cleanRec } from './games.js';
import { BJ } from './bj.js';
import { UNO } from './uno.js';
import { CHESS } from './chess.js';
import { CHECKERS } from './checkers.js';
import { MANCALA } from './mancala.js';
import { IDIOT } from './idiot.js';
import { HEARTS_GAME } from './hearts.js';
import { DOMINOES } from './dominoes.js';

const CPU_NAMES = ['Ruby', 'Otto', 'Pip', 'Juno', 'Ziggy', 'Nova', 'Bolt', 'Echo'];
const LEVELS = ['easy', 'medium', 'hard'];
// The other games' referees (Number Tiles is the code in this file).
const MODS = { bj: BJ, uno: UNO, chess: CHESS, checkers: CHECKERS, mancala: MANCALA, idiot: IDIOT, hearts: HEARTS_GAME, dominoes: DOMINOES };
const RPS = ['r', 'p', 's'];
const rpsBeats = (x, y) => (x === 'r' && y === 's') || (x === 'p' && y === 'r') || (x === 's' && y === 'p');

const MAX_SEATS = 8;

export function emptyState() {
  // game: which game the host picked (null until they pick one); cfg: the host's settings for each game.
  return { v: 0, phase: 'lobby', game: null, cfg: {}, host: null, players: [], pool: [], table: [], pos: {}, turn: null, turnNo: 0, work: null, passes: 0, sets: 1, log: [], result: null, round: 0 };
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

  close() { clearInterval(this.ping); clearTimeout(this.cpuT); this.cpuT = null; clearTimeout(this.gT); this.gT = null; clearTimeout(this.pickT); this.pickT = null; this.closed = true; }
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

  // The host is the person who picks the game and starts it: the first person to sit down, and if they
  // leave, the next person still here.
  fixHost() {
    const s = this.s, h = this.player(s.host);
    if (h && h.on && !h.cpu) return;
    const next = s.players.find(p => p.on && !p.cpu);
    s.host = next ? next.pid : null;
  }

  // A color nobody else at the table has (their own choice if it's free).
  freeColor(want, pid) {
    const taken = new Set(this.s.players.filter(q => q.pid !== pid && (q.on || q.seat)).map(q => q.rc));
    if (okColor(want) && !taken.has(want)) return want;
    return COLORS.find(c => !taken.has(c)) || (okColor(want) ? want : 'yellow');
  }

  push() {
    this.fixHost();
    this.tidyRooms();
    this.s.v++;
    this.s.at = Date.now();
    const m = { t: 'state', s: this.s };
    this.each(c => c.send(m));
    this.schedule();
  }

  // A room needs two people still here, and exactly one device carrying its sound (one that is connected).
  tidyRooms() {
    const ps = this.s.players;
    for (const id of new Set(ps.map(x => x.room).filter(Boolean))) {
      const mates = ps.filter(x => x.room === id);
      if (mates.length < 2) { for (const x of mates) { x.room = null; x.snd = false; } continue; }
      const live = mates.filter(x => x.on);
      let snd = mates.find(x => x.snd && x.on) || live[0] || mates.find(x => x.snd) || mates[0];
      for (const x of mates) x.snd = x === snd;
    }
    for (const x of ps) if (!x.room) x.snd = false;
  }

  // ---- computer players ----
  schedule() {
    const s = this.s;
    const mod = MODS[s.game];
    if (mod) return this.scheduleMod(mod);
    if (s.pick && s.phase === 'play') return this.schedulePick();
    if (this.closed || this.cpuT || s.phase !== 'play') return;
    const p = this.player(s.turn);
    if (!p || !p.cpu) return;
    const turnNo = s.turnNo;
    // a short pause to "think", so people can follow along
    this.cpuT = setTimeout(() => { this.cpuT = null; this.cpuTurn(turnNo); }, 1500 + Math.random() * 1300);
  }

  // The card games say what should happen by itself next (a computer's turn, the dealer, the next hand) as a
  // key; it runs after a pause, if the game is still waiting for that same thing.
  scheduleMod(mod) {
    const s = this.s;
    const t = !this.closed && s.phase === 'play' ? mod.auto(s) : null;
    if (!t) { clearTimeout(this.gT); this.gT = null; this.gKey = null; return; }
    if (this.gT && this.gKey === t.key) return;
    clearTimeout(this.gT);
    this.gKey = t.key;
    this.gT = setTimeout(() => {
      this.gT = null; this.gKey = null;
      if (this.closed || this.s !== s || s.phase !== 'play') return;
      try { mod.run(this, t.key); } catch (e) { console.error(e); }
    }, t.ms);
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
    const pid = 'cpu-' + Math.random().toString(36).slice(2, 8);
    // computers take colors from the end of the list, leaving the popular ones for people
    const rc = this.freeColor(COLORS.slice().reverse().find(c => !s.players.some(q => q.on && q.rc === c)), pid);
    s.players.push({ pid, name, cpu: level, rc, on: true, seat: false, rack: [], opened: false, w: {} });
    this.note(`${name} (computer, ${level}) sat down`);
  }

  add(c) {
    this.conns.add(c);
    c.onmsg = m => { try { this.msg(c, m); } catch (e) { console.error(e); } };
    c.onclose = () => {
      this.conns.delete(c);
      const p = c.pid && this.player(c.pid);
      if (p && ![...this.conns].some(o => o.pid === p.pid)) {
        p.on = false; p.share = false;
        this.rpsGone(p.pid);
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
        p = { pid: m.pid, name: '', seat: false, rack: [], opened: false, w: {} };
        s.players.push(p);
        if (s.phase === 'lobby') this.note(`${clean(m.name)} sat down`);
        else this.note(`${clean(m.name)} is watching`);
      }
      p.name = clean(m.name); p.prof = STAT_PROFILES.includes(m.prof) ? m.prof : null; p.rc = this.freeColor(cleanColor(m.rc), p.pid); p.peer = m.peer; p.cam = !!m.cam; p.mic = !!m.mic; p.on = true; p.share = false;
      return this.push();
    }
    const p = c.pid && this.player(c.pid);
    if (!p) return;

    const isHost = p.pid === s.host;
    if (m.t === 'addcpu') { if (!isHost) return; this.addCpu(m.level); return this.push(); }
    if (m.t === 'rmcpu') {
      if (s.phase === 'play' || !isHost) return;
      s.players = s.players.filter(q => !(q.cpu && q.pid === m.pid));
      return this.push();
    }

    if (m.t === 'cam') { p.cam = !!m.cam; p.mic = !!m.mic; return this.push(); }
    // Same room: people sitting together say so, and one of their devices carries the sound for all of them.
    // { pid, on }: put that person in my room, or take them out of it (my own pid with on false: I leave).
    if (m.t === 'sameroom') {
      const q = this.player(m.pid);
      if (!q || q.cpu) return;
      if (q === p) { if (!m.on) { p.room = null; p.snd = false; } return this.push(); }
      if (m.on) {
        const id = p.room || q.room || 'r' + Math.random().toString(36).slice(2, 8);
        const old = [p.room, q.room].filter(x => x && x !== id);
        for (const x of s.players) if (x === p || x === q || (x.room && old.includes(x.room))) x.room = id;
        if (!s.players.some(x => x.room === id && x.snd)) p.snd = true;   // whoever set it up carries the sound
      } else if (p.room && q.room === p.room) { q.room = null; q.snd = false; }
      return this.push();
    }
    // Use my device for my room's sound.
    if (m.t === 'roomsnd') {
      if (!p.room) return;
      for (const x of s.players) if (x.room === p.room) x.snd = x === p;
      return this.push();
    }
    if (m.t === 'rc') {
      const want = cleanColor(m.rc);
      if (this.freeColor(want, p.pid) === want) p.rc = want;   // otherwise someone else has it
      return this.push();
    }

    // The host picks the game (null: back to choosing), changes its settings, or hands being host on.
    if (m.t === 'pick') {
      if (!isHost || s.phase === 'play' || (m.game !== null && !GAMES[m.game])) return;
      s.game = m.game;
      if (m.game) { s.cfg[m.game] = cfgFor(m.game, s.cfg[m.game]); this.note(`${p.name} picked ${GAMES[m.game].name}`); }
      s.phase = 'lobby'; s.result = null;
      return this.push();
    }
    if (m.t === 'cfg') {
      const g = GAMES[s.game];
      if (!isHost || !g || s.phase === 'play') return;
      const st = g.settings.find(x => x.key === m.key);
      if (!st || !st.options.some(o => o[0] === m.value)) return;
      s.cfg[s.game] = { ...cfgFor(s.game, s.cfg[s.game]), [m.key]: m.value };
      return this.push();
    }
    // The host puts the lobby in order (Player 1, 2, 3, ...): that is the order of play, and in a two-player
    // game the first two play and everyone else watches. Being host doesn't move with it.
    if (m.t === 'order') {
      if (!isHost || s.phase === 'play' || !Array.isArray(m.pids)) return;
      const rank = new Map(m.pids.slice(0, 40).map((x, i) => [String(x), i]));
      const r = q => (rank.has(q.pid) ? rank.get(q.pid) : 1e3 + s.players.indexOf(q));
      s.players = s.players.slice().sort((a, b) => r(a) - r(b));
      return this.push();
    }
    // Rock paper scissors on the side, during Number Tiles. Nothing in the game changes.
    if (m.t === 'rps') return this.rpsMsg(p, m);
    // Someone's lifetime records: keep the ones we didn't have (and pass them on to everyone), and send them the
    // ones they are missing.
    if (m.t === 'ledger') {
      this.ledger = this.ledger || new Map();
      const theirs = new Set(), fresh = [];
      for (const r of Array.isArray(m.recs) ? m.recs.slice(0, 20000) : []) {
        const x = cleanRec(r);
        if (!x) continue;
        theirs.add(x.id);
        if (!this.ledger.has(x.id)) { this.ledger.set(x.id, x); fresh.push(x); }
      }
      const missing = [...this.ledger.values()].filter(r => !theirs.has(r.id));
      if (missing.length) c.send({ t: 'ledger', recs: missing });
      if (fresh.length) this.each(k => { if (k !== c) k.send({ t: 'ledger', recs: fresh }); });
      return;
    }
    // A whisper: a private message passed to one person (and back to the sender). Nothing in the game changes.
    if (m.t === 'whisper') {
      const to = this.player(m.to), text = String(m.text || '').replace(/\s+/g, ' ').trim().slice(0, 300);
      if (!to || to.cpu || !to.on || to.pid === p.pid || !text) return;
      const out = { t: 'whisper', from: p.pid, to: to.pid, name: p.name, rc: p.rc, text, at: Date.now() };
      this.each(k => { if (k.pid === to.pid || k.pid === p.pid) k.send(out); });
      return;
    }
    if (m.t === 'listed') { if (!isHost) return; s.unlisted = !m.on; return this.push(); }
    if (m.t === 'host') {
      const to = this.player(m.pid);
      if (!isHost || !to || to.cpu || !to.on) return;
      s.host = to.pid;
      this.note(`${to.name} is the host now`);
      return this.push();
    }
    // The host ends the game in progress for everyone.
    if (m.t === 'end') {
      if (!isHost || s.phase !== 'play') return;
      this.note(`${p.name} ended the game`);
      this.endedEarly = s.game !== 'bj';
      try {
        if (MODS[s.game]) return MODS[s.game].end(this);
        return this.finish(null);
      } finally { this.endedEarly = false; }
    }
    // They switched the best-play helper on: marked as a cheater, and everyone is told. Switched off, the mark
    // comes off straight away. Each time it is switched on is counted, for the end of the game.
    if (m.t === 'cheat') {
      if (s.phase !== 'play' || !p.seat || s.game !== 'tiles') return;
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

    // The helper shares their screen with everyone (or stops). The sign-in is checked here before anyone is
    // shown it, and only one person shares at a time.
    if (m.t === 'share') {
      if (!m.on) { if (!p.share) return; p.share = false; this.note(`${p.name} stopped sharing their screen`); return this.push(); }
      if (p.share || this.checking || Date.now() - (this.lastCheck || 0) < 1500) return;
      this.checking = true;
      check(m.u, m.p).then(role => {
        this.checking = false; this.lastCheck = Date.now();
        if (role !== 'helper' || this.closed || this.s !== s || !p.on) return;
        for (const q of s.players) q.share = q === p;
        this.note(`${p.name} is sharing their screen`);
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
      const g = GAMES[s.game];
      if (s.phase === 'play' || !isHost || !g) return;
      const ready = s.players.filter(q => q.on);
      if (ready.length < g.min) return;
      const seats = ready.slice(0, Math.min(MAX_SEATS, g.max));
      const cfg = s.cfg[s.game] = cfgFor(s.game, s.cfg[s.game]);
      const mod = MODS[s.game];
      if (mod) {
        for (const q of s.players) { q.seat = seats.includes(q); q.rack = []; q.hand = []; q.cheat = false; }
        s.round++; s.turnNo++; s.result = null; s.log = []; s.bjEnd = null; s.ann = null; s.drew = null;
        s.table = []; s.pos = {}; s.work = null; s.played = null; s.pick = null;
        s.startedAt = Date.now();
        s.phase = 'play';
        mod.start(this, seats, cfg);
        return this.push();
      }
      s.sets = cfg.sets === '1' ? 1 : cfg.sets === '2' ? 2 : seats.length > 4 ? 2 : 1;
      s.pool = makePool(s.sets);
      for (const q of s.players) { q.seat = seats.includes(q); q.rack = []; q.opened = false; q.st = { turns: 0, played: 0, drew: 0, best: 0 }; q.cheat = false; q.cheats = 0; }
      s.startedAt = Date.now();
      s.table = []; s.pos = {}; s.work = null; s.played = null; s.passes = 0; s.result = null; s.round++;
      s.phase = 'play';
      s.log = [];
      // Nobody's turn yet: first everyone draws a face-down tile from the table, and the highest goes first.
      s.turn = null; s.turnNo++;
      this.startPick(seats);
      this.note(`New game! ${s.sets === 2 ? 'Two sets' : 'One set'} of tiles. Everyone pick a tile: highest goes first.`);
      return this.push();
    }

    if (m.t === 'newgame') {
      if (s.phase !== 'over') return;
      s.phase = 'lobby'; s.table = []; s.pos = {}; s.work = null; s.result = null; s.bj = null; s.uno = null; s.bjEnd = null;
      s.chess = null; s.ck = null; s.mc = null; s.id = null; s.hr = null; s.dm = null; s.pick = null;
      s.players = s.players.filter(q => q.on);
      for (const q of s.players) { q.seat = false; q.rack = []; q.hand = []; }
      return this.push();
    }

    if (s.phase !== 'play') return;

    if (m.t === 'skip') {
      const cur = this.player(s.turn);
      if (!cur || cur.on) return;
      this.note(`${p.name} skipped ${cur.name}'s turn`);
      if (MODS[s.game]) return MODS[s.game].skip(this, cur);
      return this.draw(cur);
    }

    // A move in one of the card games.
    if (m.t === 'g') {
      const mod = MODS[s.game];
      if (mod) mod.act(this, p, m);
      return;
    }
    if (s.game !== 'tiles') return;

    // Drawing for who goes first: they turned over one of the face-down tiles.
    if (m.t === 'flip') return this.flipTile(p, Number(m.id));

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
      // Done carries the table and rack exactly as they were when it was pressed, so the very last move counts
      // even if its own update hadn't arrived yet (otherwise a winning last tile could be missed).
      const pos = m.pos ? cleanPos(m.pos) : null, rack = Array.isArray(m.rack) ? m.rack.map(Number) : null;
      if (pos && rack) {
        const want = [...s.table.flat(), ...p.rack].sort((a, b) => a - b).join(',');
        const got = [...groupsOf(pos).flat(), ...rack].sort((a, b) => a - b).join(',');
        if (want === got) s.work = { pos, table: groupsOf(pos), rack };
      }
      const w = s.work || { pos: s.pos, table: s.table, rack: p.rack };
      const why = checkTurn(s.table, p.rack, w.table, w.rack, p.opened);
      if (why) return c.send({ t: 'nope', why });
      return this.commit(p, w);
    }
  }

  /* ---- rock paper scissors on the side ----
     Kept out of the game snapshot (so nobody can peek at a pick): only the two players get each update. */
  rpsSend(g) {
    const who = pid => { const q = this.player(pid); return q ? { pid, name: q.name, rc: q.rc, cpu: !!q.cpu } : { pid, name: '?', rc: 'white' }; };
    const key = [g.a, g.b].sort().join('|'), sc = (this.rpsScore && this.rpsScore[key]) || {};
    for (const me of [g.a, g.b]) {
      const view = {
        id: g.id, stage: g.stage, by: g.by || null, me, a: who(g.a), b: who(g.b),
        mine: g.pick[me] || null, picked: { [g.a]: !!g.pick[g.a], [g.b]: !!g.pick[g.b] },
        res: g.stage === 'done' ? { pick: g.pick, win: g.win } : null,
        score: { [g.a]: sc[g.a] || 0, [g.b]: sc[g.b] || 0 },
      };
      this.each(k => { if (k.pid === me) k.send({ t: 'rps', g: view }); });
    }
  }
  rpsGone(pid) {
    if (!this.rps) return;
    for (const g of [...this.rps.values()]) {
      if (g.a !== pid && g.b !== pid) continue;
      this.rps.delete(g.id);
      if (g.stage === 'ask' || g.stage === 'play') { g.stage = 'gone'; g.by = pid; this.rpsSend(g); }
    }
  }
  rpsMsg(p, m) {
    const s = this.s;
    if (s.phase !== 'play') return;
    this.rps = this.rps || new Map(); this.rpsScore = this.rpsScore || {};
    const live = g => g.stage === 'ask' || g.stage === 'play';
    if (m.a === 'ask') {
      const to = this.player(m.to);
      if (!to || to.pid === p.pid || !to.on) return;
      const busy = q => [...this.rps.values()].some(g => live(g) && (g.a === q.pid || g.b === q.pid));
      if (busy(p)) return;
      if (busy(to)) { this.each(k => { if (k.pid === p.pid) k.send({ t: 'rps', busy: to.name }); }); return; }
      for (const g of [...this.rps.values()]) if ([g.a, g.b].some(x => x === p.pid || x === to.pid)) this.rps.delete(g.id);
      const g = { id: Math.random().toString(36).slice(2, 9), a: p.pid, b: to.pid, pick: {}, stage: 'ask' };
      if (to.cpu) { g.pick[to.pid] = RPS[Math.floor(Math.random() * 3)]; g.stage = 'play'; }
      this.rps.set(g.id, g);
      return this.rpsSend(g);
    }
    const g = this.rps.get(m.id);
    if (!g || (g.a !== p.pid && g.b !== p.pid)) return;
    if (m.a === 'pick') {
      if (!live(g) || g.pick[p.pid] || !RPS.includes(m.v)) return;
      g.pick[p.pid] = m.v;
      g.stage = 'play';
      if (g.pick[g.a] && g.pick[g.b]) {
        const x = g.pick[g.a], y = g.pick[g.b];
        g.win = rpsBeats(x, y) ? g.a : rpsBeats(y, x) ? g.b : null;
        g.stage = 'done';
        const key = [g.a, g.b].sort().join('|'), sc = this.rpsScore[key] = this.rpsScore[key] || {};
        if (g.win) sc[g.win] = (sc[g.win] || 0) + 1;
        const A = this.player(g.a), B = this.player(g.b), W = g.win && this.player(g.win);
        this.addRec({ g: RPS_ID, ps: [A, B].filter(q => q && q.prof).map(q => q.prof), cpu: [A, B].filter(q => q && q.cpu).length, win: W ? (W.cpu ? 'cpu' : W.prof || null) : null });
      }
      return this.rpsSend(g);
    }
    if (m.a === 'no' || m.a === 'close') {
      this.rps.delete(g.id);
      if (live(g)) { g.stage = m.a === 'no' ? 'no' : 'gone'; g.by = p.pid; this.rpsSend(g); }
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

  /* ---- drawing for who goes first ----
     s.pick: ids (the face-down tiles on the table) and at (where each lies: x, y as 0..1 of the table, and a
     tilt), flips { id: { pid, r } } (who turned it over, in which round), r (each round's picks, { pid: id }),
     who (who picks this round: everyone, then only those tied for highest), first (the first tile each person
     turned over: it becomes the first tile on their rack), stage 'pick' | 'tie' | 'won'. */
  startPick(seats) {
    const s = this.s, n = Math.max(16, seats.length * 3);
    const ids = s.pool.splice(0, n);
    s.pick = { ids, at: spreadOut(ids.length), flips: {}, r: [{}], who: seats.map(q => q.pid), first: {}, stage: 'pick', win: null, tie: null };
  }

  flipTile(p, id) {
    const s = this.s, k = s.pick;
    if (!k || k.stage !== 'pick' || !k.who.includes(p.pid)) return;
    const cur = k.r[k.r.length - 1];
    if (cur[p.pid] != null || !k.ids.includes(id) || k.flips[id]) return;
    cur[p.pid] = id;
    k.flips[id] = { pid: p.pid, r: k.r.length };
    if (k.first[p.pid] == null) k.first[p.pid] = id;
    if (k.who.every(x => cur[x] != null)) {
      const val = x => pickValue(cur[x]);
      const top = Math.max(...k.who.map(val));
      const best = k.who.filter(x => val(x) === top);
      if (best.length === 1) {
        k.stage = 'won'; k.win = best[0];
        this.note(`${this.player(best[0]).name} drew the highest tile and goes first`);
      } else {
        k.stage = 'tie'; k.tie = best;
        this.note(`A tie! ${best.map(x => this.player(x).name).join(' and ')} pick again`);
      }
    }
    this.push();
  }

  // Computers pick after a moment; someone who has lost their connection gets a tile picked for them.
  // Once everyone has picked, the result stays up for a few seconds before the next round or the deal.
  schedulePick() {
    const s = this.s, k = s.pick;
    if (this.closed || this.pickT) return;
    if (k.stage !== 'pick') {
      this.pickT = setTimeout(() => { this.pickT = null; if (!this.closed && this.s === s && s.pick === k) this.pickNext(); }, 3500);
      return;
    }
    const cur = k.r[k.r.length - 1];
    const q = k.who.map(x => this.player(x)).find(x => x && cur[x.pid] == null && (x.cpu || !x.on));
    if (!q) return;
    this.pickT = setTimeout(() => {
      this.pickT = null;
      if (this.closed || this.s !== s || s.pick !== k || k.stage !== 'pick') return;
      if (!q.cpu && q.on) return this.schedule();   // they came back: they can pick for themselves
      const free = k.ids.filter(id => !k.flips[id]);
      this.flipTile(q, free[Math.floor(Math.random() * free.length)]);
    }, q.cpu ? 900 + Math.random() * 1600 : 10000);
  }

  pickNext() {
    const s = this.s, k = s.pick;
    if (k.stage === 'tie') {
      k.who = k.tie; k.tie = null; k.r.push({}); k.stage = 'pick';
      // more face-down tiles if there aren't enough left for everyone picking again
      let free = k.ids.filter(id => !k.flips[id]).length;
      while (free < k.who.length + 2 && s.pool.length) {
        k.ids.push(s.pool.pop());
        k.at.push([0.05 + Math.random() * 0.9, 0.05 + Math.random() * 0.9, Math.round(Math.random() * 50 - 25)]);
        free++;
      }
      return this.push();
    }
    if (k.stage !== 'won') return;
    // Each person keeps the first tile they turned over; every other tile goes back and is mixed in.
    const keep = new Set(Object.values(k.first));
    s.pool.push(...k.ids.filter(id => !keep.has(id)));
    shuffle(s.pool);
    for (const q of this.seated()) {
      const f = k.first[q.pid];
      q.rack = f != null ? [f, ...s.pool.splice(0, DEAL - 1)] : s.pool.splice(0, DEAL);
    }
    s.turn = this.player(k.win) && this.player(k.win).seat ? k.win : this.seated()[0].pid;
    s.turnNo++;
    s.pick = null;
    this.push();
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
    // No points: the first player to play all their tiles (or cards) wins, and only wins are counted.
    if (winner) { winner.w = winner.w || {}; winner.w[s.game] = (winner.w[s.game] || 0) + 1; }
    s.result = winner ? { pid: winner.pid, name: winner.name } : { pid: null, name: '' };
    s.phase = 'over'; s.turn = null; s.work = null; s.pick = null;
    this.note(winner ? `${winner.name} wins!` : 'No winner this time');
    if (!this.endedEarly) {
      const seats = this.seated();
      const rec = { g: s.game, ps: seats.filter(q => q.prof).map(q => q.prof), cpu: seats.filter(q => q.cpu).length, win: winner ? (winner.cpu ? 'cpu' : winner.prof || null) : null };
      if (s.game === 'bj' && s.bjEnd) { rec.net = {}; for (const r of s.bjEnd.rows) { const q = this.player(r.pid); if (q && q.prof) rec.net[q.prof] = (rec.net[q.prof] || 0) + r.net; } }
      this.addRec(rec);
    }
    this.push();
  }

  // A finished game for the lifetime stats: everyone at the table keeps a copy.
  addRec(r) {
    const rec = cleanRec({ ...r, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), at: Date.now() });
    if (!rec) return;
    this.ledger = this.ledger || new Map();
    this.ledger.set(rec.id, rec);
    this.each(k => k.send({ t: 'ledger', recs: [rec] }));
  }
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [a[i], a[k]] = [a[k], a[i]]; }
  return a;
}

// n tiles scattered over the table: each in its own cell of a loose grid (so they don't pile up), nudged
// about inside it and turned a little. [x, y, tilt]: x and y run 0..1 across the table.
function spreadOut(n) {
  const cols = Math.ceil(Math.sqrt(n * 2.2)), rows = Math.ceil(n / cols);
  const cells = shuffle(Array.from({ length: cols * rows }, (_, i) => i)).slice(0, n);
  return cells.map(i => {
    const c = i % cols, r = Math.floor(i / cols);
    const x = (c + 0.5 + (Math.random() - 0.5) * 0.5) / cols, y = (r + 0.5 + (Math.random() - 0.5) * 0.4) / rows;
    return [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000, Math.round(Math.random() * 50 - 25)];
  });
}

function cleanColor(c) { c = typeof c === 'string' ? c.toLowerCase() : c; return okColor(c) ? c : 'yellow'; }
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
  // from before there were several games: a game in progress is Number Tiles
  if (!s.cfg || typeof s.cfg !== 'object') s.cfg = {};
  if (s.game === undefined) s.game = s.phase === 'lobby' ? null : 'tiles';
  if (s.game && !GAMES[s.game]) s.game = null;
  if (!s.pos || typeof s.pos !== 'object' || Array.isArray(s.pos)) s.pos = layoutPos({}, s.table || []);
  if (s.work && !s.work.pos) s.work = null;
  if (s.pick && (s.phase !== 'play' || s.game !== 'tiles')) s.pick = null;
  if (Array.isArray(s.result)) { const w = s.result.find(x => x.win); s.result = w ? { pid: w.pid, name: w.name } : { pid: null, name: '' }; }
  delete s.cells;
  for (const p of s.players) {
    if (!p.w || typeof p.w !== 'object') p.w = {};
    if (typeof p.wins === 'number') { p.w.tiles = (p.w.tiles || 0) + p.wins; delete p.wins; }
    delete p.total;
  }
}
