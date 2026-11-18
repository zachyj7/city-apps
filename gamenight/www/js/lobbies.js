// Open lobbies on the start screen. There is no server of our own, so whoever is running a lobby (the referee's
// browser) posts a short notice on a free public MQTT broker: the lobby name, the game and how many people are
// in it (no names, no faces). The notice is "retained", so the start screen gets every current one as soon as it
// looks, and it is cleared when the lobby closes, or by the broker itself if that browser disappears.
const BROKER = 'wss://broker.emqx.io:8084/mqtt';
const ROOT = 'cityapps/jensengames/v1/lobby/';   // (the old name stays here on purpose, like the lobby id in net.js)
const FRESH_MS = 3 * 60e3;   // a notice not refreshed for this long is treated as gone
const enc = new TextEncoder(), dec = new TextDecoder();

/* A minimal MQTT 3.1.1 client over WebSocket (QoS 0), as in Clock Rate, plus a "last will": a message the broker
   posts for us if we vanish without saying goodbye (here: an empty retained message, which clears our notice). */
function mqtt(clientId, onMsg, onState, will) {
  let ws = null, buf = new Uint8Array(0), up = false, pid = 1, ping = 0, retry = 0, backoff = 2000, closed = false;
  const subs = new Set(), queue = [];
  const str = s => { const b = enc.encode(s); return [b.length >> 8, b.length & 255, ...b]; };
  const len = n => { const o = []; do { let d = n % 128; n = Math.floor(n / 128); if (n) d |= 128; o.push(d); } while (n); return o; };
  const pkt = (type, body) => new Uint8Array([type, ...len(body.length), ...body]);
  const send = p => { if (up) ws.send(p); else queue.push(p); };
  const subPkt = topics => {
    const id = pid = pid % 65535 + 1, body = [id >> 8, id & 255];
    topics.forEach(t => body.push(...str(t), 0));
    return pkt(0x82, body);
  };
  function connect() {
    if (closed) return;
    try { ws = new WebSocket(BROKER, 'mqtt'); } catch (e) { return later(); }
    ws.binaryType = 'arraybuffer';
    // flags: clean session, plus (with a will) will flag and will retain
    ws.onopen = () => ws.send(pkt(0x10, [...str('MQTT'), 4, will ? 0x26 : 0x02, 0, 60, ...str(clientId), ...(will ? [...str(will), 0, 0] : [])]));
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
    if (type === 2) {
      if (b[1] !== 0) { ws.close(); return; }
      up = true; backoff = 2000; onState(true);
      if (subs.size) ws.send(subPkt([...subs]));
      queue.splice(0).forEach(p => ws.send(p));
      ping = setInterval(() => { if (up) ws.send(new Uint8Array([0xC0, 0])); }, 45000);
    } else if (type === 3) {
      const tl = (b[0] << 8) | b[1], topic = dec.decode(b.subarray(2, 2 + tl)), skip = 2 + tl + ((h >> 1) & 3 ? 2 : 0);
      onMsg(topic, dec.decode(b.subarray(skip)));
    }
  }
  connect();
  return {
    sub(t) { if (subs.has(t)) return; subs.add(t); if (up) ws.send(subPkt([t])); },
    pub(t, text, retain) { send(pkt(0x30 | (retain ? 1 : 0), [...str(t), ...enc.encode(text)])); },
    // goodbye: anything queued goes first, then a clean disconnect (so the broker does not post the will)
    close() {
      closed = true; clearTimeout(retry); clearInterval(ping);
      const w = ws;
      if (w && up) { try { w.send(new Uint8Array([0xE0, 0])); } catch (e) { /* gone */ } setTimeout(() => { try { w.close(); } catch (e) { /* gone */ } }, 300); }
      else if (w) try { w.close(); } catch (e) { /* gone */ }
      ws = null; up = false;
    },
  };
}
const rid = () => Math.random().toString(36).slice(2, 8);

/* The start screen: every open lobby, newest first. onChange(list) is called whenever it changes. */
export function watchLobbies(onChange) {
  const seen = new Map();
  const list = () => [...seen.values()].filter(x => Date.now() - x.at < FRESH_MS).sort((a, b) => b.at - a.at);
  let last = '';
  const tell = () => { const l = list(), k = JSON.stringify(l); if (k !== last) { last = k; onChange(l); } };
  const c = mqtt('jg-w-' + rid(), (topic, text) => {
    const code = topic.slice(ROOT.length);
    if (!/^[a-z0-9]{1,20}$/.test(code)) return;
    let x = null;
    try { x = text ? JSON.parse(text) : null; } catch (e) { x = null; }
    if (x && Number.isFinite(x.at) && Number.isFinite(x.n) && x.n > 0) seen.set(code, { code, game: typeof x.game === 'string' ? x.game : null, phase: x.phase === 'play' ? 'play' : 'lobby', n: Math.min(8, Math.floor(x.n)), at: Math.min(x.at, Date.now()) });
    else seen.delete(code);
    tell();
  }, () => {});
  c.sub(ROOT + '+');
  const t = setInterval(tell, 20000);
  return () => { clearInterval(t); c.close(); };
}

/* The browser running a lobby's referee keeps its notice up to date. set(code, info) posts it (only when it
   changed, or once a minute to show it is still there); set(null) takes it down. */
export function lobbyNotice() {
  let c = null, code = null, lastKey = '', lastAt = 0;
  const drop = () => { if (!c) return; c.pub(ROOT + code, '', true); c.close(); c = null; code = null; lastKey = ''; };
  return {
    set(next, info) {
      if (!next || !info) return drop();
      if (next !== code) { drop(); code = next; c = mqtt('jg-h-' + rid(), () => {}, () => {}, ROOT + code); }
      const key = JSON.stringify(info);
      if (key === lastKey && Date.now() - lastAt < 60e3) return;
      lastKey = key; lastAt = Date.now();
      c.pub(ROOT + code, JSON.stringify({ ...info, at: Date.now() }), true);
    },
  };
}
