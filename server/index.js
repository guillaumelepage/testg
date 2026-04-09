'use strict';

const path = require('path');
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { GameRoom } = require('./GameRoom');

const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors());

// Sert les fichiers du build webpack
app.use(express.static(path.join(__dirname, '../dist')));

app.get('/health', (_, res) => res.json({ status: 'ok' }));

// Route d'accueil
app.get('/', (_, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

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

setInterval(() => {
  for (const [code, room] of rooms) {
    if (room.state !== 'playing') continue;
    const moveChanged    = room.tickUnitMovement();
    const gatherChanged  = room.tickGathering();
    const buildChanged   = room.tickConstruction();
    const regenChanged   = room.tickResourceRegen();
    const aiChanged      = room.tickEnemyAI();
    const timedChanged   = room.tickTimedEffects();
    const popChanged     = room.tickPopulation();
    const mobChanged     = room.tickNeutralMobs();
    const villageChanged = room.tickVillageTowers() | room.tickVillageSiege();
    const eventChanged   = room.tickRandomEvents();

    // Flush pending events (arrow shots, captures…)
    for (const ev of room._pendingEvents.splice(0)) {
      io.to(code).emit(ev.type, ev);
    }

    if (moveChanged || gatherChanged || buildChanged || regenChanged || aiChanged || mobChanged || villageChanged || eventChanged || timedChanged || popChanged) {
      io.to(code).emit('state_update', { shared: room.shared });
    }
  }
}, 1000);

io.on('connection', (socket) => {
  console.log(`[+] ${socket.id} connected`);

  socket.on('list_rooms', (cb) => {
    const available = [];
    for (const [code, room] of rooms) {
      if (room.isFull()) continue;
      const host = Object.values(room.players)[0];
      if (host) available.push({
        code,
        hostName: host.name,
        hostClan: host.clan,
        inProgress: room.state === 'playing',
      });
    }
    cb(available);
  });

  socket.on('create_room', ({ name, clan, heroType }, cb) => {
    let code;
    do { code = generateCode(); } while (rooms.has(code));
    const room = new GameRoom(code);
    rooms.set(code, room);
    room.join(socket.id, name, clan, heroType);
    socket.join(code);
    socket.data.roomCode = code;
    console.log(`[room] ${socket.id} created room ${code}`);
    cb({ ok: true, code, snapshot: room.getStateSnapshot() });
  });

  socket.on('join_room', ({ code, name, clan, heroType }, cb) => {
    const normalizedCode = code?.toUpperCase();
    const room = rooms.get(normalizedCode);
    if (!room) { cb({ ok: false, error: 'Salle introuvable' }); return; }
    if (room.isFull()) { cb({ ok: false, error: 'Salle pleine' }); return; }

    room.join(socket.id, name, clan, heroType);
    socket.join(normalizedCode);
    socket.data.roomCode = normalizedCode;

    if (room.state === 'playing') {
      // Late join — spawn a hero for the newcomer, send snapshot only to them
      room.addLateJoiner(socket.id);
      const snapshot = room.getStateSnapshot();
      socket.emit('game_start', snapshot);
      io.to(normalizedCode).emit('player_joined', { name });
      console.log(`[room] ${socket.id} late-joined ${normalizedCode}`);
      cb({ ok: true, code: normalizedCode, snapshot });
    } else {
      // Normal join — second player completes the pair, start the game
      room.state = 'playing';
      room.startGame();
      const snapshot = room.getStateSnapshot();
      io.to(normalizedCode).emit('game_start', snapshot);
      console.log(`[room] ${socket.id} joined ${normalizedCode} — game starting`);
      cb({ ok: true, code: normalizedCode, snapshot });
    }
  });

  // Reconnection: player rejoins a game in progress with their old player name
  socket.on('rejoin_game', ({ code, name }) => {
    const room = rooms.get(code);
    if (!room || room.state !== 'playing') return;
    // Find existing player slot by name
    const oldId = Object.keys(room.players).find(id => room.players[id].name === name);
    if (!oldId) return;
    const player = room.players[oldId];
    delete room.players[oldId];
    room.players[socket.id] = { ...player, socketId: socket.id };
    room.playerOrder = room.playerOrder.map(id => id === oldId ? socket.id : id);
    // Reassign hero ownership
    const hero = room.shared.units.find(u => u.isHero && u.heroOwner === oldId);
    if (hero) hero.heroOwner = socket.id;
    socket.join(code);
    socket.data.roomCode = code;
    socket.emit('game_start', room.getStateSnapshot());
    console.log(`[room] ${socket.id} rejoined ${code} (was ${oldId})`);
  });

  socket.on('action', (action) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room) return;

    const result = room.handleAction(socket.id, action);
    if (!result) return;

    // NPC_INTERACT and ERROR are private — send only to the initiating player
    if (result.type === 'NPC_INTERACT') {
      socket.emit('npc_interact', result);
    } else if (result.type === 'ERROR') {
      socket.emit('action_error', result);
    } else {
      io.to(code).emit(result.type.toLowerCase(), result);
    }
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
