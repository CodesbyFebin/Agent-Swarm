export const API = (import.meta.env.VITE_API_URL || 'http://localhost:8787').replace(/\/$/, '');

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
  return body;
}

export const api = {
  health: () => request('/health'),
  me: () => request('/me'),
  signup: (payload) => request('/auth/signup', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload) => request('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  logout: () => request('/auth/logout', { method: 'POST', body: '{}' }),

  organizations: () => request('/api/organizations'),
  projects: () => request('/api/projects'),
  createProject: (payload) => request('/api/projects', { method: 'POST', body: JSON.stringify(payload) }),

  missions: (projectId) => request(`/api/missions${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`),
  mission: (id) => request(`/api/missions/${id}`),
  createMission: (payload) => request('/api/missions', { method: 'POST', body: JSON.stringify(payload) }),
  pause: (id) => request(`/api/missions/${id}/pause`, { method: 'POST', body: '{}' }),
  resume: (id) => request(`/api/missions/${id}/resume`, { method: 'POST', body: '{}' }),
  cancel: (id) => request(`/api/missions/${id}/cancel`, { method: 'POST', body: '{}' }),
  approve: (id) => request(`/api/approvals/${id}/approve`, { method: 'POST', body: '{}' }),
  reject: (id) => request(`/api/approvals/${id}/reject`, { method: 'POST', body: '{}' }),
  streamUrl: (id, after = 0) => `${API}/api/missions/${id}/stream?after=${after}`,
};
