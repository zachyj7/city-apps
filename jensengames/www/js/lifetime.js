// Lifetime stats: every finished game, kept on this device and swapped with everyone at the table.
// There is no server, so each device keeps the whole family's records. When people play together their
// devices pass along whatever the others are missing, so every device catches up the next time it joins.
// Records have their own id, so a game is never counted twice.
import { GAMES, GAME_IDS, PROFILES, RPS_ID, cleanRec } from './games.js';

const KEY = 'jg-ledger';
let recs = new Map();
try { for (const r of JSON.parse(localStorage.getItem(KEY)) || []) { const c = cleanRec(r); if (c) recs.set(c.id, c); } } catch (e) { /* none yet */ }

function save() { try { localStorage.setItem(KEY, JSON.stringify([...recs.values()])); } catch (e) { /* full or private */ } }

export const allRecs = () => [...recs.values()];

// Add records (from the referee). Returns how many were new.
export function mergeRecs(list) {
  let n = 0;
  for (const r of Array.isArray(list) ? list : []) {
    const c = cleanRec(r);
    if (c && !recs.has(c.id)) { recs.set(c.id, c); n++; }
  }
  if (n) save();
  return n;
}

export const lifeWins = (prof, g) => allRecs().filter(r => r.win === prof && (!g || r.g === g)).length;

// One player's totals for one game: played, won, and (Blackjack) money up or down.
function tally(prof, g) {
  let played = 0, won = 0, net = 0;
  for (const r of recs.values()) {
    if (r.g !== g || !r.ps.includes(prof)) continue;
    played++;
    if (r.win === prof) won++;
    if (r.net && Number.isFinite(r.net[prof])) net += r.net[prof];
  }
  return { played, won, net };
}

const COLS = [...GAME_IDS.map(id => [id, GAMES[id].name]), [RPS_ID, 'Rock Paper Scissors']];
const money = n => (n < 0 ? '−' : '+') + '$' + Math.abs(Math.round(n)).toLocaleString('en-US');

// The table of everyone's lifetime stats: wins out of games played, for each game.
export function lifeTable(me, esc) {
  const rows = PROFILES.map(p => {
    const t = COLS.map(([g]) => tally(p, g));
    return { p, t, won: t.reduce((s, x) => s + x.won, 0), played: t.reduce((s, x) => s + x.played, 0) };
  }).sort((a, b) => b.won - a.won || b.played - a.played || a.p.localeCompare(b.p));
  const cell = (x, g) => {
    if (!x.played) return '<td class="none">–</td>';
    const pct = Math.round((x.won / x.played) * 100);
    return `<td><b>${x.won}</b><small> of ${x.played}</small><i>${pct}%</i>${g === 'bj' && x.net ? `<em class="${x.net > 0 ? 'up' : 'down'}">${money(x.net)}</em>` : ''}</td>`;
  };
  const total = allRecs().length;
  return `<div class="lifewrap"><table class="lifetable">
    <thead><tr><th>Player</th><th>All games</th>${COLS.map(([, n]) => `<th>${esc(n)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr class="${r.p === me ? 'me' : ''}"><th>${esc(r.p)}</th>${cell(r, null)}${r.t.map((x, i) => cell(x, COLS[i][0])).join('')}</tr>`).join('')}</tbody>
  </table></div>
  <p class="fieldhint">Wins out of games played. ${total} game${total === 1 ? '' : 's'} recorded. Games the host ends early don't count (except Blackjack, which ends that way).
  Each device keeps everyone's records and catches up from the others whenever you play together.</p>`;
}
