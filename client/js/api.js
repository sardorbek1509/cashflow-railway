/**
 * API Client Module - handles all REST calls to the server
 */
const API_BASE = window.API_BASE || 'https://your-railway-domain.up.railway.app/api';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('cf_token') || null;
  }

  setToken(token) {
    this.token = token;
    if (token) localStorage.setItem('cf_token', token);
    else localStorage.removeItem('cf_token');
  }

  getToken() {
    return this.token;
  }

  async request(method, path, body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    try {
      const res = await fetch(`${API_BASE}${path}`, opts);

      let data = null;
      try {
        data = await res.json();
      } catch {
        console.warn('⚠️ Server returned non-JSON response');
      }

      console.log(`📡 ${method} ${path}`, data);

      if (!res.ok) {
        const message = data?.message || 'Request failed';
        const err = new Error(message);
        err.status = res.status;
        throw err;
      }

      return data;
    } catch (err) {
      console.error('🚨 REQUEST FAILED:', err);
      throw err;
    }
  }

  // HTTP METHODS
  get(path) { return this.request('GET', path); }
  post(path, body) { return this.request('POST', path, body); }

  // AUTH
  register(username, email, password) {
    return this.post('/auth/register', { username, email, password });
  }
  login(email, password) {
    return this.post('/auth/login', { email, password });
  }
  getMe() {
    return this.get('/auth/me');
  }

  // ROOMS
  createRoom(maxPlayers = 4) {
    return this.post('/rooms', { maxPlayers });
  }
  listRooms() { return this.get('/rooms'); }
  getRoom(roomId) { return this.get(`/rooms/${roomId}`); }
  getRoomState(roomId) { return this.get(`/rooms/${roomId}/state`); }
}

// global
window.api = new ApiClient();
