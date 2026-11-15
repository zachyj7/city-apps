// Where players find a route to each other. STUN works when both sides are on ordinary home wifi; phones on
// cellular sit behind carrier NAT that blocks direct connections, so they need a TURN relay to pass data through.
// The relay is Metered (free tier, metered.ca; Dashboard -> TURN Server). This login is meant to be public:
// it can only relay traffic, and usage counts against the free monthly allowance.
const TURN_USER = 'fce5722aa351d9206af1d2df';
const TURN_PASS = 'bLvpfKx/21TSp+Hi';

const ICE = [
  { urls: 'stun:stun.relay.metered.ca:80' },
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: [
      'turn:global.relay.metered.ca:80',
      'turn:global.relay.metered.ca:80?transport=tcp',
      'turn:global.relay.metered.ca:443',
      'turns:global.relay.metered.ca:443?transport=tcp',   // looks like ordinary web traffic, for strict networks
    ],
    username: TURN_USER, credential: TURN_PASS,
  },
];

// Kept async so the list could come from a credentials service later without touching net.js.
export function iceServers() { return Promise.resolve(ICE); }
