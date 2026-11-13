// Online play with no server of our own. Everyone at a table finds each other through the public PeerJS broker.
// The first one in hosts the referee (Room) in their browser; everyone else connects to them.
// If the host leaves, whoever notices first takes over using the last snapshot they had.
import { Room } from './room.js';

const copy = m => JSON.parse(JSON.stringify(m));
export const ICE = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

export class Net {
  // h: onStatus(s), onOpen(), onMsg(m), onLost(), onPeer(peer), snapshot()
  constructor(code, h) {
    this.hostId = 'familytiles-v1-' + code;
    this.h = h;
    this.gen = 0; this.room = null; this.loop = null; this.conn = null; this.peer = null;
    this.state = 'connecting'; this.lastRx = Date.now(); this.retryAt = 0;
  }

  start() { this.tryHost(); setInterval(() => this.watch(), 2000); }
  status(s) { this.state = s; this.h.onStatus(s); }
  rx(m) { this.lastRx = Date.now(); if (m.t !== 'ping') this.h.onMsg(m); }
  send(m) {
    if (this.loop) this.loop(m);
    else if (this.conn && this.conn.open) try { this.conn.send(m); } catch (e) { /* dropped */ }
  }

  setPeer(peer) { this.peer = peer; this.h.onPeer(peer); }
  killPeer() { try { this.peer && this.peer.destroy(); } catch (e) { /* ignore */ } this.peer = null; }

  offline() {
    this.killPeer();
    this.status('offline');
    this.retryAt = Date.now() + 5000;
  }

  tryHost() {
    const gen = ++this.gen;
    if (!window.Peer) return this.offline();
    let peer, done = false;
    try { peer = new window.Peer(this.hostId, { debug: 0, config: { iceServers: ICE } }); } catch (e) { return this.offline(); }
    const fail = type => {
      if (done || gen !== this.gen) return;
      done = true; clearTimeout(to);
      try { peer.destroy(); } catch (e) { /* ignore */ }
      if (type === 'unavailable-id') this.join(); else this.offline();
    };
    const to = setTimeout(() => fail('timeout'), 9000);
    peer.on('open', () => {
      if (done || gen !== this.gen) return;
      done = true; clearTimeout(to);
      this.setPeer(peer);
      this.room = new Room(this.h.snapshot());
      const local = { send: m => { const c = copy(m); queueMicrotask(() => this.rx(c)); } };
      this.room.add(local);
      this.loop = m => { const c = copy(m); queueMicrotask(() => local.onmsg && local.onmsg(c)); };
      peer.on('connection', c => {
        const k = { send: m => { try { c.send(m); } catch (e) { /* dropped */ } } };
        c.on('open', () => this.room && this.room.add(k));
        c.on('data', d => k.onmsg && k.onmsg(d));
        c.on('close', () => k.onclose && k.onclose());
        c.on('error', () => k.onclose && k.onclose());
      });
      peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) { /* ignore */ } });
      this.status('host');
      this.h.onOpen();
    });
    peer.on('error', e => {
      if (done && gen === this.gen && e.type === 'peer-unavailable') return;   // a video call to someone who left
      fail(e.type);
    });
  }

  join() {
    const gen = ++this.gen;
    this.status('joining');
    let peer;
    try { peer = new window.Peer({ debug: 0, config: { iceServers: ICE } }); } catch (e) { return this.offline(); }
    const giveUp = () => {
      if (gen !== this.gen || this.conn) return;
      try { peer.destroy(); } catch (e) { /* ignore */ }
      this.tryHost();
    };
    const to = setTimeout(giveUp, 12000);
    peer.on('error', e => {
      if (this.conn && e.type === 'peer-unavailable') return;   // a video call to someone who left
      if (!this.conn) { clearTimeout(to); giveUp(); }
    });
    peer.on('open', () => {
      if (gen !== this.gen) return;
      this.setPeer(peer);
      const c = peer.connect(this.hostId, { reliable: true, serialization: 'json' });
      c.on('open', () => {
        if (gen !== this.gen) return;
        clearTimeout(to);
        this.conn = c; this.lastRx = Date.now();
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
    this.killPeer();
    this.h.onLost();
    this.status('reconnecting');
    this.gen++;
    setTimeout(() => this.tryHost(), 300 + Math.random() * 1500);
  }

  watch() {
    const n = Date.now();
    if (this.state === 'client' && n - this.lastRx > 10000) this.lost();
    else if (this.state === 'offline' && n > this.retryAt) this.tryHost();
  }
}
