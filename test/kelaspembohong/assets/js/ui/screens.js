import { state } from '../core/state.js';

export function showScreen(id) {
  const current = document.querySelector('.screen.active');
  const next = document.getElementById(id);
  if (!next || current === next) return;
  if (current) { current.classList.remove('active'); }
  next.classList.add('active', 'slide-in');
  setTimeout(() => {
    next.classList.remove('slide-in');
    if (window.refreshIcons) window.refreshIcons();
  }, 300);
  state.screenHistory.push(id);
}
