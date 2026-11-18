// Online play with no server of our own. Players in a room find each other through the public PeerJS broker;
// the first one in hosts the Room (the referee) in their browser and everyone else connects to them.
// If the host leaves, whoever notices first takes over. With no internet you get a private room and it keeps trying.
// Players on cellular need the TURN relay from ice.js to reach a host on wifi (or another phone).
import { Room } from './room.js';
import { iceServers } from './ice.js';

const copy = m => JSON.parse(JSON.stringify(m));

export class Net {
  constructor(code, cfg, h) {
    this.hostId = 'bigmoney-v1-' + (String(code).toLowerCase().replace(/[^a-z0-9]/g, '') || 'lobby');
    this.cfg = cfg; this.h = h;
    this.gen = 0; this.tries = 0; this.room = null; this.loop = null; this.conn = null; this.peer = null;
    this.state = 'connecting'; this.lastRx = Date.now(); this.retryAt = 0;
  }

  start() { this.tryHost(); setInterval(() => this.watch(), 2000); }
  status(s) { this.state = s; this.h.onStatus(s); }
  rx(m) { this.lastRx = Date.now(); this.h.onMsg(m); }
  send(m) {
    if (this.loop) this.loop(m);
    else if (this.conn && this.conn.open) try { this.conn.send(m); } catch (e) { /* dropped */ }
  }

  makeLocal() {
    this.room = new Room(this.cfg);
    const conn = { local: true, send: m => { const c = copy(m); queueMicrotask(() => this.rx(c)); } };
    this.room.add(conn);
    this.loop = m => { const c = copy(m); queueMicrotask(() => conn.onmsg && conn.onmsg(c)); };
    this.h.onOpen();
  }
  dropLocal() {
    if (!this.room) return;
    this.room.close(); this.room = null; this.loop = null;
    this.h.onLost();
  }
  // stuck: the room exists but we could not get through to its host, so say so rather than look offline.
  goSolo(stuck) { if (!this.room) this.makeLocal(); this.status(stuck ? 'stuck' : 'solo'); this.retryAt = Date.now() + (stuck ? 8000 : 20000); }

  async tryHost() {
    const gen = ++this.gen;
    if (!window.Peer) return this.goSolo();
    const ice = await iceServers();
    if (gen !== this.gen) return;
    let peer, done = false;
    try { peer = new window.Peer(this.hostId, { debug: 0, config: { iceServers: ice } }); } catch (e) { return this.goSolo(); }
    const fail = type => {
      if (done || gen !== this.gen) return;
      done = true; clearTimeout(to);
      try { peer.destroy(); } catch (e) { /* ignore */ }
      if (type === 'unavailable-id') this.join(); else this.goSolo();
    };
    const to = setTimeout(() => fail('timeout'), 9000);
    peer.on('open', () => {
      if (done || gen !== this.gen) return;
      done = true; clearTimeout(to);
      this.peer = peer;
      if (!this.room) this.makeLocal();
      peer.on('connection', c => {
        const k = { send: m => { try { c.send(m); } catch (e) { /* dropped */ } } };
        c.on('open', () => this.room && this.room.add(k));
        c.on('data', d => k.onmsg && k.onmsg(d));
        c.on('close', () => k.onclose && k.onclose());
        c.on('error', () => k.onclose && k.onclose());
      });
      peer.on('disconnected', () => {
        if (gen !== this.gen || peer.destroyed) return;
        setTimeout(() => { if (gen === this.gen && !peer.destroyed) try { peer.reconnect(); } catch (e) { /* ignore */ } }, 300);
      });
      this.status('host');
    });
    peer.on('error', e => fail(e.type));
  }

  async join() {
    const gen = ++this.gen;
    this.dropLocal();
    this.status('joining');
    const ice = await iceServers();
    if (gen !== this.gen) return;
    let peer;
    try { peer = new window.Peer({ debug: 0, config: { iceServers: ice } }); } catch (e) { return this.goSolo(); }
    this.peer = peer;
    const giveUp = () => {
      if (gen !== this.gen || this.conn) return;
      try { peer.destroy(); } catch (e) { /* ignore */ }
      if (++this.tries >= 3) { this.tries = 0; this.goSolo(true); } else this.tryHost();
    };
    const to = setTimeout(giveUp, 15000);   // a relayed (cellular) connection can take several seconds
    peer.on('error', () => { clearTimeout(to); giveUp(); });
    peer.on('open', () => {
      if (gen !== this.gen) return;
      const c = peer.connect(this.hostId, { reliable: true, serialization: 'json' });
      c.on('open', () => {
        if (gen !== this.gen) return;
        clearTimeout(to);
        this.conn = c; this.tries = 0; this.lastRx = Date.now();
        this.status('client');
        this.h.onOpen();
      });
      c.on('data', m => { if (gen === this.gen) this.rx(m); });
      c.on('close', () => { if (gen === this.gen) this.lost(); });
    });
  }

  lost() {
    if (this.state !== 'client') return;
    this.conn = null;
    try { this.peer && this.peer.destroy(); } catch (e) { /* ignore */ }
    this.h.onLost();
    this.status('reconnecting');
    this.gen++;
    setTimeout(() => this.tryHost(), 300 + Math.random() * 1200);
  }

  watch() {
    const n = Date.now();
    if (this.state === 'client' && n - this.lastRx > 10000) this.lost();
    else if ((this.state === 'solo' || this.state === 'stuck') && n > this.retryAt) { this.retryAt = n + 20000; this.tryHost(); }
  }
}
