/**
 * API Client Module - handles all REST calls to the server
 */
const API_BASE = 'https://cashflow-railway.onrender.com/api';

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
    try {
      const headers = {
        'Content-Type': 'application/json'
      };

      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const opts = {
        method,
        headers
      };

      if (body) {
        opts.body = JSON.stringify(body);
      }

      const res = await fetch(`${API_BASE}${path}`, opts);

      let data = null;

      // JSON parse safe
      try {
        data = await res.json();
      } catch (e) {
        console.error('❌ JSON parse error:', e);
        throw new Error('Serverdan noto‘g‘ri javob keldi');
      }

      // DEBUG (MUHIM)
      console.log(`📡 ${method} ${path}`, data);

      if (!res.ok) {
        const message = data?.message || 'Request failed';
        console.error('❌ API ERROR:', message);
        const err = new Error(message);
        err.status = res.status;
        throw err;
      }

      return data;

    } catch (error) {
      console.error('🚨 REQUEST FAILED:', error);
      throw error;
    }
  }

  // METHODS
  get(path) {
    return this.request('GET', path);
  }

  post(path, body) {
    return this.request('POST', path, body);
  }

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

  listRooms() {
    return this.get('/rooms');
  }

  getRoom(roomId) {
    return this.get(`/rooms/${roomId}`);
  }

  getRoomState(roomId) {
    return this.get(`/rooms/${roomId}/state`);
  }
}

// global
window.api = new ApiClient();
