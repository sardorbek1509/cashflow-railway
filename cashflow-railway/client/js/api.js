/**
 * API Client Module - handles all REST calls to the server
 */
const API_BASE = '/api';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('cf_token') || null;
    this.user = JSON.parse(localStorage.getItem('cf_user') || 'null');
  }
  setToken(token) {
    this.token = token;
    if (token) localStorage.setItem('cf_token', token);
    else localStorage.removeItem('cf_token');
  }
  setUser(user) {
    this.user = user;
    if (user) localStorage.setItem('cf_user', JSON.stringify(user));
    else localStorage.removeItem('cf_user');
  }
  getToken() { return this.token; }
  getUser() { return this.user; }
  logout() {
    this.setToken(null);
    this.setUser(null);
  }
  async request(method, path, body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${API_BASE}${path}`, opts);
    let data;
    try {
      data = await res.json();
    } catch (err) {
      data = { message: await res.text() };
    }
    if (!res.ok) {
      const err = new Error(data.message || `Request failed with status ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  }
  get(path) { return this.request('GET', path); }
  post(path, body) { return this.request('POST', path, body); }
  register(username, email, password) { return this.post('/auth/register', { username, email, password }); }
  login(email, password) { return this.post('/auth/login', { email, password }); }
  getMe() { return this.get('/auth/me'); }
  createRoom(maxPlayers = 4) { return this.post('/rooms', { maxPlayers }); }
  listRooms() { return this.get('/rooms'); }
  getRoom(roomId) { return this.get(`/rooms/${roomId}`); }
  getRoomState(roomId) { return this.get(`/rooms/${roomId}/state`); }
  deleteRoom(roomId) { return this.request('DELETE', `/rooms/${roomId}`); }
}
window.api = new ApiClient();
window.CF_API = {
  Auth: {
    login: async (email, password) => {
      const res = await window.api.login(email, password);
      window.api.setToken(res.data.token);
      window.api.setUser(res.data.user);
      return res;
    },
    register: async (username, email, password) => {
      const res = await window.api.register(username, email, password);
      window.api.setToken(res.data.token);
      window.api.setUser(res.data.user);
      return res;
    },
    getMe: async () => {
      const res = await window.api.getMe();
      if (res?.data?.user) {
        window.api.setUser(res.data.user);
      }
      return res;
    },
    logout: () => window.api.logout(),
    isLoggedIn: () => !!window.api.getToken(),
    getCurrentUser: () => window.api.getUser()
  },
  Rooms: {
    create: async (maxPlayers) => {
      const res = await window.api.createRoom(maxPlayers);
      return res?.data?.room || null;
    },
    list: async () => {
      const res = await window.api.listRooms();
      return res?.data?.rooms || [];
    },
    get: async (roomId) => {
      const res = await window.api.getRoom(roomId);
      return res?.data?.room || null;
    },
    getState: async (roomId) => {
      const res = await window.api.getRoomState(roomId);
      return res?.data || null;
    },
    delete: async (roomId) => {
      return await window.api.deleteRoom(roomId);
    }
  },
  getToken: () => window.api.getToken()
};
