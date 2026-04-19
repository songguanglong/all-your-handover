const API_BASE = '/api/admin';

function esc(str) {
  const d = document.createElement('div');
  d.textContent = String(str ?? '');
  return d.innerHTML;
}

function showError(containerId, message) {
  const el = document.getElementById(containerId);
  if (el) {
    el.innerHTML = `<div class="error">${esc(message)}</div>`;
  }
}

async function handleResponse(res) {
  const data = await res.json().catch(() => ({ code: -1, message: `请求失败 (HTTP ${res.status})` }));
  if (!res.ok) {
    throw new Error(data.message || `请求失败 (HTTP ${res.status})`);
  }
  return data;
}

const api = {
  async get(path) {
    const res = await fetch(`${API_BASE}${path}`);
    return handleResponse(res);
  },

  async post(path, data) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async put(path, data) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
    return handleResponse(res);
  },

  async del(path) {
    const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE' });
    return handleResponse(res);
  },
};