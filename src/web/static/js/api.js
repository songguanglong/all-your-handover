const API_BASE = '/api/admin';

function esc(str) {
  const d = document.createElement('div');
  d.textContent = String(str ?? '');
  return d.innerHTML;
}

const api = {
  async get(path) {
    const res = await fetch(`${API_BASE}${path}`);
    return res.json();
  },

  async post(path, data) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async put(path, data) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async del(path) {
    const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE' });
    return res.json();
  },
};