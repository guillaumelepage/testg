'use strict';

const {
  MAP_WIDTH, MAP_HEIGHT, T, POP,
  UNIT_BASE_STATS, HERO_BASE_STATS,
  SERVER_NPC_DEFS,
} = require('./constants');
const { rng, generateMap } = require('./mapgen');

// ── System mixins ──────────────────────────────────────────────────────────────
const MovementSystem   = require('./systems/movement');
const BuildingSystem   = require('./systems/building');
const CombatSystem     = require('./systems/combat');
const PopulationSystem = require('./systems/population');
const VillageSystem    = require('./systems/village');
const AISystem         = require('./systems/ai');
const DungeonSystem    = require('./systems/dungeon');
const EventSystem      = require('./systems/events');
const NpcSystem        = require('./systems/npc');

class GameRoom {
  constructor(code, difficulty = 1.0) {
    this.code       = code;
    this.players    = {};
    this.playerOrder = [];
    this.state      = 'waiting';
    this.difficulty = difficulty; // 0.7=Facile 1.0=Normal 1.4=Difficile 2.0=Brutal

    const seed = Date.now() & 0x7fffffff;
    const { map, resources } = generateMap(seed);
    this.mapSeed = seed;
    this.map     = map;

    this.shared = {
      resources:     { wood: 200, stone: 100, gold: 50, food: 150 },
      resourceNodes: resources,
      buildings:     [],
      units:         [],
      nextId:        1,
    };

    // Player town halls + starting paysans
    const th1 = this._findValidSpawnArea(4, 4, 2);
    const th2 = this._findValidSpawnArea(MAP_WIDTH - 6, MAP_HEIGHT - 6, 2);
    this._addBuilding('town_hall', th1.x, th1.y, 'shared');
    this._addBuilding('town_hall', th2.x, th2.y, 'shared');
    this._addUnit('paysan', th1.x + 2, th1.y,     'player');
    this._addUnit('paysan', th1.x + 1, th1.y + 1, 'player');
    this._addUnit('paysan', th2.x - 1, th2.y + 1, 'player');

    // Enemy camp
    const enemyCamp = this._findValidSpawnArea(MAP_WIDTH - 9, 3, 2);
    this.enemy = { campX: enemyCamp.x, campY: enemyCamp.y, aggroLevel: 0, buildTimer: 0 };
    this._addBuilding('town_hall', this.enemy.campX, this.enemy.campY, 'enemy');
    this._addUnit('homme_armes', this.enemy.campX + 2, this.enemy.campY + 2, 'enemy');
    this._addUnit('archer',      this.enemy.campX + 3, this.enemy.campY + 1, 'enemy');
    this._addUnit('mercenaire',  this.enemy.campX + 1, this.enemy.campY + 3, 'enemy');

    // Neutral mobs, villages, dungeons, NPCs
    this._spawnNeutralMobs(rng(seed ^ 0x5a5a5a5a));
    this.shared.villages = this._generateVillages();
    this.shared.dungeons = this._generateDungeons();
    this.shared.npcs     = SERVER_NPC_DEFS.map(d => ({
      ...d, quest: { ...d.quest },
      questAccepted: false, questProgress: 0, questCompleted: false,
    }));

    this.activeBattle  = null;
    this._pendingEvents = [];
    this.eventTimer    = 0;
    this._wallSet      = new Set(); // completed wall positions as "x,y" strings

    // Founding population (6 adults, 3 couples)
    this.shared.population = [];
    const foundingPaysans  = this.shared.units.filter(u => u.type === 'paysan');
    for (let i = 0; i < 6; i++) {
      const pu = foundingPaysans[i] || null;
      this.shared.population.push({
        id: `cit_s${i}`,
        age: POP.ADULT_TICKS + 50, isChild: false,
        birthHouseId: null, houseId: 'townhall_start',
        sdfTimer: 0,
        x: 6 + (i % 3), y: 5 + Math.floor(i / 3),
        deployed: !!pu, unitId: pu ? pu.id : null,
      });
    }
  }

  // ── Core helpers ─────────────────────────────────────────────────────────────

  _nextId() { return `obj_${this.shared.nextId++}`; }

  _addBuilding(type, x, y, owner, buildTime = 0) {
    this.shared.buildings.push({
      id: this._nextId(), type, x, y, owner,
      hp: 500, maxHp: 500,
      underConstruction: buildTime > 0,
      constructionProgress: 0,
      constructionTime: buildTime,
    });
    if (type === 'wall' && buildTime === 0) this._wallSet.add(`${x},${y}`);
  }

  /** extra: optional field overrides (hp/maxHp, villageGuard, homeX/Y, reward…) */
  _addUnit(type, x, y, owner, extra = {}) {
    const stats  = UNIT_BASE_STATS[type] || UNIT_BASE_STATS['homme_armes'];
    const hpMul  = owner === 'enemy' ? (this.difficulty || 1.0) : 1.0;
    const maxHp  = Math.round(stats.maxHp * hpMul);
    const unit   = {
      id: this._nextId(), type, x, y, owner,
      hp: maxHp, maxHp,
      moves: stats.moves.slice(),
      gatherState: 'idle', targetResource: null,
      inventory: 0, inventoryMax: 20, inventoryType: null,
      targetX: null, targetY: null,
      ...extra,
    };
    this.shared.units.push(unit);
    return unit;
  }

  _addHero(heroType, x, y, socketId) {
    const stats = HERO_BASE_STATS[heroType] || HERO_BASE_STATS['roi_guerrier'];
    const hero  = {
      id: this._nextId(), type: heroType, x, y, owner: 'player',
      hp: stats.maxHp, maxHp: stats.maxHp,
      moves: stats.moves.map(m => ({ ...m })),
      gatherState: 'idle', targetResource: null,
      inventory: 0, inventoryMax: 0, inventoryType: null,
      targetX: null, targetY: null,
      isHero: true, heroOwner: socketId,
      level: 1, xp: 0,
      equipment: { ...stats.startEquip },
      activeQuest: null, questProgress: 0,
    };
    this.shared.units.push(hero);
    return hero;
  }

  _findValidSpawn(preferX, preferY) {
    for (let radius = 0; radius <= 12; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (radius > 0 && Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
          const nx = preferX + dx, ny = preferY + dy;
          if (nx < 1 || nx >= MAP_WIDTH - 1 || ny < 1 || ny >= MAP_HEIGHT - 1) continue;
          const t = this.map[ny][nx];
          if (t !== T.WATER && t !== T.MOUNTAIN) return { x: nx, y: ny };
        }
      }
    }
    return { x: preferX, y: preferY };
  }

  _findValidSpawnArea(preferX, preferY, size = 2) {
    const clear = (ox, oy) => {
      for (let dy = 0; dy < size; dy++) {
        for (let dx = 0; dx < size; dx++) {
          const nx = ox + dx, ny = oy + dy;
          if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) return false;
          const t = this.map[ny][nx];
          if (t === T.WATER || t === T.MOUNTAIN) return false;
        }
      }
      return true;
    };
    for (let radius = 0; radius <= 14; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (radius > 0 && Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
          const nx = preferX + dx, ny = preferY + dy;
          if (nx < 1 || nx >= MAP_WIDTH - size || ny < 1 || ny >= MAP_HEIGHT - size) continue;
          if (clear(nx, ny)) return { x: nx, y: ny };
        }
      }
    }
    return { x: preferX, y: preferY };
  }

  // ── Player session management ─────────────────────────────────────────────────

  join(socketId, name, clan, heroType) {
    if (this.playerOrder.length >= 2) return false;
    const num = this.playerOrder.length + 1;
    this.players[socketId] = { id: `p${num}`, name, clan, socketId, heroType: heroType || 'roi_guerrier' };
    this.playerOrder.push(socketId);
    return true;
  }

  leave(socketId) {
    if (this.players[socketId]) this.players[socketId].disconnected = true;
    this.playerOrder = this.playerOrder.filter(id => id !== socketId);
  }

  isFull()  { return this.playerOrder.length >= 2; }
  isEmpty() { return this.playerOrder.length === 0; }

  startGame() {
    const preferredSpawns = [
      { x: 8, y: 6 },
      { x: MAP_WIDTH - 9, y: MAP_HEIGHT - 7 },
    ];
    this.playerOrder.forEach((socketId, i) => {
      const player = this.players[socketId];
      const pref   = preferredSpawns[i] || preferredSpawns[0];
      const sp     = this._findValidSpawn(pref.x, pref.y);
      this._addHero(player.heroType || 'roi_guerrier', sp.x, sp.y, socketId);
    });
  }

  addLateJoiner(socketId) {
    const player = this.players[socketId];
    if (!player) return;
    const spawnPrefs = [
      { x: 8, y: 6 }, { x: MAP_WIDTH - 9, y: MAP_HEIGHT - 7 },
      { x: 8, y: MAP_HEIGHT - 7 }, { x: MAP_WIDTH - 9, y: 6 },
    ];
    const idx  = Math.max(0, this.playerOrder.length - 1);
    const pref = spawnPrefs[idx % spawnPrefs.length];
    const sp   = this._findValidSpawn(pref.x, pref.y);
    this._addHero(player.heroType || 'roi_guerrier', sp.x, sp.y, socketId);
  }

  getStateSnapshot() {
    return {
      code: this.code,
      mapSeed: this.mapSeed,
      map: this.map,
      players: Object.values(this.players),
      shared: this.shared,
      activeBattle: this.activeBattle,
    };
  }

  // ── Action dispatcher ─────────────────────────────────────────────────────────

  handleAction(socketId, action) {
    const player = this.players[socketId];
    if (!player || this.state !== 'playing') return null;
    switch (action.type) {
      case 'MOVE_UNIT':         return this._moveUnit(action.unitId, action.tx, action.ty);
      case 'GATHER':            return this._gatherResource(action.unitId, action.resourceId);
      case 'PLACE_BUILDING':    return this._placeBuilding(action.buildingType, action.tx, action.ty);
      case 'TRAIN_UNIT':        return this._trainUnit(action.buildingId, action.unitType);
      case 'BATTLE_MOVE':       return this._battleMove(action.moveIndex);
      case 'INTERACT_NPC':      return this._interactNpc(action.npcId, socketId);
      case 'ACCEPT_QUEST':      return this._acceptQuest(action.npcId, action.heroId);
      case 'ENTER_DUNGEON':     return this._enterDungeon(action.dungeonId, action.unitId);
      case 'DEMOLISH_BUILDING': return this._demolishBuilding(action.buildingId);
      default: return null;
    }
  }

  _moveUnit(unitId, tx, ty) {
    if (this.activeBattle) return null;
    const unit = this.shared.units.find(u => u.id === unitId);
    if (!unit || unit.owner === 'enemy' || unit.owner === 'neutral') return null;
    if (ty < 0 || ty >= MAP_HEIGHT || tx < 0 || tx >= MAP_WIDTH) return null;
    if (this.map[ty][tx] === T.WATER || this.map[ty][tx] === T.MOUNTAIN || this.map[ty][tx] === T.SNOW) return null;

    const village = (this.shared.villages || []).find(v => !v.capturedBy && v.x === tx && v.y === ty);
    if (village) { this._startVillageSiege(unit, village); return { type: 'STATE_UPDATE', shared: this.shared }; }

    const neutral = this.shared.units.find(u => u.x === tx && u.y === ty && u.owner === 'neutral');
    if (neutral) return this._startBattle(unit, neutral);

    const enemy = this.shared.units.find(u => u.x === tx && u.y === ty && u.owner === 'enemy');
    if (enemy) {
      this.enemy.aggroLevel = Math.min(100, this.enemy.aggroLevel + 40);
      return this._startBattle(unit, enemy);
    }

    if (this._wallSet.has(`${tx},${ty}`)) return null;

    unit.targetX = tx; unit.targetY = ty;
    unit.gatherState = 'idle'; unit.targetResource = null;
    return { type: 'STATE_UPDATE', shared: this.shared };
  }
}

// ── Mix all systems into the prototype ────────────────────────────────────────
Object.assign(GameRoom.prototype,
  MovementSystem,
  BuildingSystem,
  CombatSystem,
  PopulationSystem,
  VillageSystem,
  AISystem,
  DungeonSystem,
  EventSystem,
  NpcSystem,
);

module.exports = { GameRoom };