import { io } from 'socket.io-client';

class SocketManager {
  constructor() {
    this.socket = null;
    this.handlers = {};
  }

  connect(serverUrl = '') {
    // Empty string = same origin (proxied in dev, same host in prod)
    this.socket = io(serverUrl, { transports: ['websocket', 'polling'] });

    this.socket.on('connect', () => {
      console.log('[net] connecté', this.socket.id);
      this._emit('connected');
    });
    this.socket.on('disconnect', () => {
      console.log('[net] déconnecté');
      this._emit('disconnected');
    });

    // Forwarded server events
    const events = [
      'game_start', 'state_update', 'battle_start', 'battle_update',
      'battle_end', 'player_left', 'error',
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

  createRoom(name, clan) {
    return new Promise((resolve, reject) => {
      this.socket.emit('create_room', { name, clan }, (res) => {
        if (res.ok) resolve(res);
        else reject(new Error(res.error));
      });
    });
  }

  joinRoom(code, name, clan) {
    return new Promise((resolve, reject) => {
      this.socket.emit('join_room', { code, name, clan }, (res) => {
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