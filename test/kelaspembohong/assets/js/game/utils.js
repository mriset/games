import { CARDS } from '../data/cards.js';
import { state } from '../core/state.js';

export const AVATAR_COLORS = ['#f5c842','#ff6b35','#a855f7','#22c55e','#3b82f6','#ec4899','#14b8a6','#f97316','#8b5cf6','#06b6d4','#84cc16','#ef4444','#f59e0b','#10b981','#6366f1','#e11d48'];

export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({length:6}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
export function generatePlayerId() {
  return 'p_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}
export function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function getRandomCard(edition, usedIds) {
  const cards = CARDS[edition] || CARDS.base;
  const available = cards.filter(c => !usedIds.includes(c.id));
  if (available.length === 0) return cards[Math.floor(Math.random() * cards.length)];
  return available[Math.floor(Math.random() * available.length)];
}
export function labelFromIndex(i) {
  return String.fromCharCode(65 + i); // A, B, C...
}

export function clearTimers() {
  if (state.writeTimer) clearInterval(state.writeTimer);
  if (state.voteTimer) clearInterval(state.voteTimer);
}
