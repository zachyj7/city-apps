// Where players find a route to each other. STUN works when both sides are on ordinary home wifi; phones on
// cellular sit behind carrier NAT that blocks direct connections, so they need a TURN relay to pass data through.
// TURN logins come from Metered (free tier, metered.ca): paste your app's credentials URL below, the one shown
// on the dashboard as https://<your-app>.metered.live/api/v1/turn/credentials?apiKey=<key>.
export const TURN_URL = '';

const STUN = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];
const KEY = 'turn-cache-v1';

let pending = null;

// The ICE server list for a new connection. Fetched once per page; if the fetch fails, the last good list
// (saved in this browser) is used and the next connection attempt tries again.
export function iceServers() {
  if (!TURN_URL) return Promise.resolve(STUN);
  if (!pending) pending = fetchTurn().then(list => {
    if (list) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* no storage */ } return STUN.concat(list); }
    pending = null;
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { /* no storage */ }
    return Array.isArray(saved) ? STUN.concat(saved) : STUN;
  });
  return pending;
}

async function fetchTurn() {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const t = setTimeout(() => ctl && ctl.abort(), 5000);
  try {
    const r = await fetch(TURN_URL, ctl ? { signal: ctl.signal } : {});
    if (!r.ok) return null;
    const list = await r.json();
    return Array.isArray(list) && list.length ? list.filter(s => s && s.urls && !String(s.urls).startsWith('stun:')) : null;
  } catch (e) { return null; } finally { clearTimeout(t); }
}
