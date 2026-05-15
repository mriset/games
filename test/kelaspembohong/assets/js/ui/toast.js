export function showToast(msg, type='info', dur=2500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show ${type}`;
  clearTimeout(t._to);
  t._to = setTimeout(() => t.classList.remove('show'), dur);
}

export function showLoading(text='Memuat...') {
  document.getElementById('loading-overlay').style.display = 'flex';
  document.getElementById('loading-text').textContent = text;
}

export function hideLoading() {
  document.getElementById('loading-overlay').style.display = 'none';
}
