'use strict';

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { GameRoom } = require('./GameRoom');

const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.get('/health', (_, res) => res.json({ status: 'ok' }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

/** @type {Map<string, GameRoom>} */
const rooms = new Map();

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// Game tick: movement + gather + construction + AI + neutral mobs every 1s
setInterval(() => {
  for (const [code, room] of rooms) {
    if (room.state !== 'playing') continue;
    const moveChanged    = room.tickUnitMovement();
    const gatherChanged  = room.tickGathering();
    const buildChanged   = room.tickConstruction();
    const aiChanged      = room.tickEnemyAI();
    const mobChanged     = room.tickNeutralMobs();
    if (moveChanged || gatherChanged || buildChanged || aiChanged || mobChanged) {
      io.to(code).emit('state_update', { shared: room.shared });
    }
  }
}, 1000);

io.on('connection', (socket) => {
  console.log(`[+] ${socket.id} connected`);

  socket.on('list_rooms', (cb) => {
    const available = [];
    for (const [code, room] of rooms) {
      if (!room.isFull() && room.state === 'waiting') {
        const host = Object.values(room.players)[0];
        if (host) available.push({ code, hostName: host.name, hostClan: host.clan });
      }
    }
    cb(available);
  });

  socket.on('create_room', ({ name, clan }, cb) => {
    let code;
    do { code = generateCode(); } while (rooms.has(code));
    const room = new GameRoom(code);
    rooms.set(code, room);
    room.join(socket.id, name, clan);
    socket.join(code);
    socket.data.roomCode = code;
    console.log(`[room] ${socket.id} created room ${code}`);
    cb({ ok: true, code, snapshot: room.getStateSnapshot() });
  });

  socket.on('join_room', ({ code, name, clan }, cb) => {
    const room = rooms.get(code?.toUpperCase());
    if (!room) { cb({ ok: false, error: 'Salle introuvable' }); return; }
    if (room.isFull()) { cb({ ok: false, error: 'Salle pleine' }); return; }
    room.join(socket.id, name, clan);
    socket.join(code);
    socket.data.roomCode = code;
    room.state = 'playing';
    const snapshot = room.getStateSnapshot();
    // Notify all in room (including the joiner) that game starts
    io.to(code).emit('game_start', snapshot);
    console.log(`[room] ${socket.id} joined room ${code} — game starting`);
    cb({ ok: true, code, snapshot });
  });

  socket.on('action', (action) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room) return;
    const result = room.handleAction(socket.id, action);
    if (!result) return;
    io.to(code).emit(result.type.toLowerCase(), result);
  });

  socket.on('disconnect', () => {
    const code = socket.data.roomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    room.leave(socket.id);
    io.to(code).emit('player_left', { message: 'Un joueur a quitté la partie.' });
    if (room.isEmpty()) {
      rooms.delete(code);
      console.log(`[room] ${code} supprimée (vide)`);
    }
    console.log(`[-] ${socket.id} disconnected from ${code}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`\n🏰 Medieval Conquest Server — port ${PORT}\n`);
});