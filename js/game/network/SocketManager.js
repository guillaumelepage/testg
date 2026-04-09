import { io } from 'socket.io-client';

class SocketManager {
  constructor() {
    this.socket = null;
    this.handlers = {};
    this._wasConnected = false;
    // Restore session from localStorage so it survives page refresh
    try {
      const raw = localStorage.getItem('conquete_session');
      this.session = raw ? JSON.parse(raw) : null;
    } catch { this.session = null; }
  }

  setSession(code, name) {
    this.session = { code, name };
    try { localStorage.setItem('conquete_session', JSON.stringify({ code, name })); } catch {}
  }

  clearSession() {
    this.session = null;
    try { localStorage.removeItem('conquete_session'); } catch {}
  }

  connect(serverUrl = '') {
    // Idempotent — don't reconnect if already connected or connecting
    if (this.socket?.connected || this.socket?.active) return;
    // Empty string = same origin (proxied in dev, same host in prod)
    this.socket = io(serverUrl, { transports: ['websocket', 'polling'] });

    this.socket.on('connect', () => {
      console.log('[net] connecté', this.socket.id);
      if (this._wasConnected && this.session) {
        // Reconnexion en cours de partie → rejoindre automatiquement
        console.log('[net] reconnexion → rejoin_game', this.session.code);
        this.socket.emit('rejoin_game', this.session);
      }
      this._wasConnected = true;
      this._emit('connected');
    });
    this.socket.on('disconnect', () => {
      console.log('[net] déconnecté');
      this._emit('disconnected');
    });

    // Forwarded server events
    const events = [
      'game_start', 'state_update', 'battle_start', 'battle_update',
      'battle_end', 'player_left', 'player_joined', 'npc_interact', 'error',
      'village_captured', 'arrow_shot', 'dungeon_next_room', 'random_event', 'action_error',
    ];
    for (const ev of events) {
      this.socket.on(ev, (data) => this._emit(ev, data));
    }
  }

  _emit(event, data) {
    const fn = this.handlers[event];
    if (fn) fn(data);
  }

  on(event, fn) {
    this.handlers[event] = fn;
    return this;
  }

  off(event) {
    delete this.handlers[event];
    return this;
  }

  createRoom(name, clan, heroType) {
    return new Promise((resolve, reject) => {
      this.socket.emit('create_room', { name, clan, heroType }, (res) => {
        if (res.ok) resolve(res);
        else reject(new Error(res.error));
      });
    });
  }

  joinRoom(code, name, clan, heroType) {
    return new Promise((resolve, reject) => {
      this.socket.emit('join_room', { code, name, clan, heroType }, (res) => {
        if (res.ok) resolve(res);
        else reject(new Error(res.error));
      });
    });
  }

  listRooms() {
    return new Promise((resolve) => {
      if (!this.socket?.connected) { resolve([]); return; }
      this.socket.emit('list_rooms', (rooms) => resolve(rooms || []));
    });
  }

  sendAction(action) {
    if (this.socket?.connected) this.socket.emit('action', action);
  }
}

export const socketManager = new SocketManager();