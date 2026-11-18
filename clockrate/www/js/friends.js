/* Friends: invite links, friend codes, and syncing times between friends.

   There is no Clock Rate server yet, so friends sync through a free public MQTT broker.
   Each player keeps one "retained" message with their name and recent times on their own topic;
   the broker hands the latest one to anyone who subscribes, even if that player is offline.
     p/<CODE>          that player's name, all-time bests and the last 8 days of official times
     in/<CODE>/<FROM>  "FROM added you": lets one tap on an invite link add both players
   Anyone who knows a code can read that player's name and times, which is the same information a
   leaderboard shows. Swap this file for the real backend later (docs/NEXT-STEPS.md, section 3). */
(() => {
'use strict';
const CA = window.CA, st = CA.store, S = () => st.s;
const BROKER = 'wss://broker.emqx.io:8084/mqtt';
const ROOT = 'cityapps/clockrate/v1/';
const enc = new TextEncoder(), dec = new TextDecoder();

/* ---------- a minimal MQTT 3.1.1 client over WebSocket (QoS 0 only) ---------- */
function mqtt(url, clientId, onMsg, onState) {
  let ws = null, buf = new Uint8Array(0), up = false, pid = 1, ping = 0, retry = 0, backoff = 2000, closed = false;
  const subs = new Set(), queue = [];
  const str = s => { const b = enc.encode(s); return [b.length >> 8, b.length & 255, ...b]; };
  const len = n => { const o = []; do { let d = n % 128; n = Math.floor(n / 128); if (n) d |= 128; o.push(d); } while (n); return o; };
  const pkt = (type, body) => new Uint8Array([type, ...len(body.length), ...body]);
  const send = p => { if (up) ws.send(p); else queue.push(p); };
  const subPkt = (topics, unsub) => {
    const id = pid = pid % 65535 + 1, body = [id >> 8, id & 255];
    topics.forEach(t => body.push(...str(t), ...(unsub ? [] : [0])));
    return pkt(unsub ? 0xA2 : 0x82, body);
  };
  function connect() {
    if (closed) return;
    try { ws = new WebSocket(url, 'mqtt'); } catch (e) { return later(); }
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => ws.send(pkt(0x10, [...str('MQTT'), 4, 2, 0, 60, ...str(clientId)]));
    ws.onmessage = e => {
      const a = new Uint8Array(e.data), b = new Uint8Array(buf.length + a.length);
      b.set(buf); b.set(a, buf.length); buf = b;
      for (;;) {
        let i = 1, n = 0, m = 1, d;
        do { if (i >= buf.length) return; d = buf[i++]; n += (d & 127) * m; m *= 128; } while (d & 128);
        if (buf.length < i + n) return;
        read(buf[0], buf.subarray(i, i + n)); buf = buf.slice(i + n);
      }
    };
    ws.onclose = ws.onerror = () => { if (ws) { ws.onclose = ws.onerror = null; ws = null; } if (up) { up = false; onState(false); } clearInterval(ping); later(); };
  }
  function later() { clearTimeout(retry); if (!closed) retry = setTimeout(connect, backoff); backoff = Math.min(backoff * 2, 60000); }
  function read(h, b) {
    const type = h >> 4;
    if (type === 2) {                                   // CONNACK
      if (b[1] !== 0) { ws.close(); return; }
      up = true; backoff = 2000; onState(true);
      if (subs.size) ws.send(subPkt([...subs]));
      queue.splice(0).forEach(p => ws.send(p));
      ping = setInterval(() => { if (up) ws.send(new Uint8Array([0xC0, 0])); }, 45000);
    } else if (type === 3) {                            // PUBLISH
      const tl = (b[0] << 8) | b[1], topic = dec.decode(b.subarray(2, 2 + tl)), skip = 2 + tl + ((h >> 1) & 3 ? 2 : 0);
      onMsg(topic, dec.decode(b.subarray(skip)));
    }
  }
  connect();
  return {
    get up() { return up; },
    sub(t) { if (subs.has(t)) return; subs.add(t); if (up) ws.send(subPkt([t])); },
    unsub(t) { if (!subs.delete(t)) return; if (up) ws.send(subPkt([t], true)); },
    /* retained: the broker keeps the last one and gives it to every new subscriber. '' clears it. */
    pub(t, text, retain) { send(pkt(0x30 | (retain ? 1 : 0), [...str(t), ...enc.encode(text)])); },
    retry() { if (!ws && !closed) { backoff = 2000; clearTimeout(retry); connect(); } }
  };
}

/* ---------- friends ---------- */
const code = id => String(id || '').replace(/^u/, '').toUpperCase();
const clean = s => String(s || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
const myCode = () => code(S().me.id);
const list = () => S().friends || (S().friends = {});
const changed = () => { st.save(); F.onchange(); };

let net = null, lastPub = '', pubTimer = 0;
function payload() {
  const s = S(), days = CA.lastDays(8).map(d => d.key), h = {}, b = {};
  ['gauntlet'].concat(CA.games.map(g => g.id)).forEach(g => {
    const all = s.history[g] || {};
    days.forEach(d => { if (all[d] != null) (h[g] || (h[g] = {}))[d] = all[d]; });
    const best = st.best(g); if (best != null) b[g] = best;
  });
  return JSON.stringify({v: 1, n: s.me.name || '', b, h});
}
function publish() {
  clearTimeout(pubTimer);
  pubTimer = setTimeout(() => {
    if (!net) return;
    const p = payload(); if (p === lastPub && net.up) return;
    lastPub = p; net.pub(ROOT + 'p/' + myCode(), p, true);
  }, 400);
}
function onMsg(topic, text) {
  const t = topic.slice(ROOT.length).split('/');
  let d = null; try { d = text ? JSON.parse(text) : null; } catch (e) { return; }
  if (t[0] === 'p') {
    const f = list()[t[1]]; if (!f || !d) return;
    f.name = String(d.n || f.name || '').slice(0, 16); f.b = d.b || {}; f.h = d.h || {}; f.seen = Date.now();
    changed();
  } else if (t[0] === 'in' && t[1] === myCode() && d) {
    /* Someone opened my invite link or typed my code: add them back. */
    if (!list()[t[2]] && t[2] !== myCode() && !(S().blocked || {})[t[2]]) { addRaw(t[2], d.n); changed(); F.onadded(t[2]); }
  }
}
function addRaw(c, name) {
  list()[c] = {name: String(name || '').slice(0, 16), b: {}, h: {}, added: Date.now()};
  if (S().blocked) delete S().blocked[c];
  if (net) net.sub(ROOT + 'p/' + c);
}
function start() {
  if (net || !window.WebSocket || !window.TextEncoder) return;
  net = mqtt(BROKER, 'cr-' + myCode() + '-' + Math.random().toString(36).slice(2, 6),
    onMsg, on => { F.online = on; if (on) { lastPub = ''; publish(); } F.onchange(); });
  net.sub(ROOT + 'in/' + myCode() + '/+');
  Object.keys(list()).forEach(c => net.sub(ROOT + 'p/' + c));
}

const F = CA.friends = {
  online: false,
  onchange() {}, onadded() {},          // set by app.js
  get code() { return myCode(); },
  link() { return location.origin + location.pathname + '?add=' + myCode(); },
  list: () => Object.entries(list()).map(([c, f]) => Object.assign({code: c}, f)),
  get: c => list()[c],
  /* Returns an error message, or '' when added. */
  add(raw) {
    const c = clean(raw);
    if (c.length !== 8) return 'Codes are 8 letters and numbers.';
    if (c === myCode()) return "That's your own code.";
    if (list()[c]) return 'Already on your list.';
    addRaw(c, '');
    if (net) net.pub(ROOT + 'in/' + c + '/' + myCode(), JSON.stringify({n: S().me.name || ''}), true);
    changed();
    return '';
  },
  remove(c) {
    delete list()[c];
    (S().blocked || (S().blocked = {}))[c] = 1;
    if (net) { net.unsub(ROOT + 'p/' + c); net.pub(ROOT + 'in/' + myCode() + '/' + c, '', true); net.pub(ROOT + 'in/' + c + '/' + myCode(), '', true); }
    changed();
  },
  publish,
  start
};

/* Republish whenever saved data changes (a finished run, a retry, a new name). */
CA.onsave = publish;
document.addEventListener('visibilitychange', () => { if (!document.hidden && net) net.retry(); });
})();
