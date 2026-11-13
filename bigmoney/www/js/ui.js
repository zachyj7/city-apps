import { G, S } from './state.js';
import { RANKS, SUITS } from './cards.js';

export const $ = s => document.querySelector(s);
export const fmt = n => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function toast(msg, cls = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + cls;
  t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3100);
}

export function card(c, cls = '') {
  if (c == null) return '';
  if (c < 0) return `<span class="card back ${cls}"></span>`;
  const s = (c / 13) | 0;
  return `<span class="card ${s === 1 || s === 2 ? 'red' : ''} ${cls}"><b>${RANKS[c % 13]}</b><i>${SUITS[s]}</i></span>`;
}

let onClose = null;
// A modal sheet. While it is open the player stands still.
export function openPanel({ title, html = '', cls = '', close }) {
  if (onClose) { const f = onClose; onClose = null; f(); }
  const p = $('#panel');
  p.className = 'panel ' + cls;
  p.innerHTML = `<div class="ph"><h2>${title}</h2><button class="x" data-x aria-label="Close">✕</button></div><div class="pb">${html}</div>`;
  p.querySelector('[data-x]').onclick = closePanel;
  onClose = close || (() => {});
  G.mode = 'ui';
  document.body.classList.add('ui-open');
  return p.querySelector('.pb');
}
export function closePanel() {
  const p = $('#panel');
  if (p.classList.contains('hidden')) return;
  p.className = 'panel hidden';
  p.innerHTML = '';
  document.body.classList.remove('ui-open');
  if (G.mode === 'ui') G.mode = 'walk';
  const f = onClose; onClose = null;
  if (f) f();
}
export const panelOpen = () => !$('#panel').classList.contains('hidden');
export const canPay = n => { if (S.money >= n) return true; toast('Not enough money', 'bad'); return false; };
