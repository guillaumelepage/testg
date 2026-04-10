'use strict';

const MAP_WIDTH = 80;
const MAP_HEIGHT = 60;

// Tile types
const T = { GRASS: 0, DARK_GRASS: 1, WATER: 2, SAND: 3, DIRT: 4, FOREST: 5, MOUNTAIN: 6 };

// ── Population constants ───────────────────────────────────────────────────────
const POP = {
  YEAR_TICKS:    20,   // 1 in-game year = 20 real seconds
  ADULT_AGE:     16,   // years to become adult
  get ADULT_TICKS() { return this.YEAR_TICKS * this.ADULT_AGE; }, // 320 ticks ≈ 5.3 min
  REPRO_COOLDOWN: 240, // ticks between births per house (4 min)
  SDF_TIMEOUT:    90,  // ticks homeless before going enemy (1.5 min)
  HOUSE_CAPACITY: 2,   // adults per house
};

// Construction times in ticks (1 tick = 1 s)
const BUILD_TIMES = {
  house: 10, barracks: 20, farm: 8, mine: 15,
  lumber_mill: 12, market: 18, tower: 20, church: 25, stable: 20, wall: 3,
};

function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function generateMap(seed) {
  const rand = rng(seed);
  const map = Array.from({ length: MAP_HEIGHT }, () => Array(MAP_WIDTH).fill(T.GRASS));
  const resources = [];

  // Water bodies
  for (let i = 0; i < 5; i++) {
    let cx = Math.floor(rand() * MAP_WIDTH);
    let cy = Math.floor(rand() * MAP_HEIGHT);
    const size = 3 + Math.floor(rand() * 6);
    for (let dy = -size; dy <= size; dy++) {
      for (let dx = -size; dx <= size; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT) {
          if (dx * dx + dy * dy <= size * size) map[ny][nx] = T.WATER;
        }
      }
    }
    for (let dy = -(size + 2); dy <= size + 2; dy++) {
      for (let dx = -(size + 2); dx <= size + 2; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT) {
          const d2 = dx * dx + dy * dy;
          if (d2 <= (size + 2) * (size + 2) && d2 > size * size && map[ny][nx] === T.GRASS)
            map[ny][nx] = T.SAND;
        }
      }
    }
  }

  // Forest clusters
  for (let i = 0; i < 12; i++) {
    let cx = Math.floor(rand() * MAP_WIDTH);
    let cy = Math.floor(rand() * MAP_HEIGHT);
    const size = 2 + Math.floor(rand() * 5);
    for (let dy = -size; dy <= size; dy++) {
      for (let dx = -size; dx <= size; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT)
          if (dx * dx + dy * dy <= size * size && map[ny][nx] === T.GRASS) map[ny][nx] = T.FOREST;
      }
    }
  }

  // Mountains
  for (let i = 0; i < 6; i++) {
    let cx = Math.floor(rand() * MAP_WIDTH);
    let cy = Math.floor(rand() * MAP_HEIGHT);
    const size = 1 + Math.floor(rand() * 4);
    for (let dy = -size; dy <= size; dy++) {
      for (let dx = -size; dx <= size; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT)
          if (dx * dx + dy * dy <= size * size && map[ny][nx] !== T.WATER) map[ny][nx] = T.MOUNTAIN;
      }
    }
  }

  // Resources
  const resourceDefs = [
    { type: 'wood',  tile: T.FOREST,   count: 20, amount: 200 },
    { type: 'stone', tile: T.MOUNTAIN, count: 12, amount: 300 },
    { type: 'gold',  tile: T.MOUNTAIN, count: 8,  amount: 400 },
    { type: 'food',  tile: T.GRASS,    count: 15, amount: 150 },
  ];
  for (const def of resourceDefs) {
    let placed = 0, attempts = 0;
    while (placed < def.count && attempts < 500) {
      attempts++;
      const x = Math.floor(rand() * MAP_WIDTH);
      const y = Math.floor(rand() * MAP_HEIGHT);
      if (map[y][x] === def.tile && !resources.find(r => r.x === x && r.y === y)) {
        const dP1 = Math.abs(x - 5) + Math.abs(y - 5);
        const dP2 = Math.abs(x - (MAP_WIDTH - 6)) + Math.abs(y - (MAP_HEIGHT - 6));
        if (dP1 > 6 && dP2 > 6) {
          resources.push({
            id: `res_${resources.length}`, type: def.type, x, y,
            amount: def.amount, maxAmount: def.amount,
            state: 'alive', regrowTimer: 0,
          });
          placed++;
        }
      }
    }
  }

  return { map, resources };
}

class GameRoom {
  constructor(code, difficulty = 1.0) {
    this.code = code;
    this.players = {};
    this.playerOrder = [];
    this.state = 'waiting';
    // 0.7 = Facile, 1.0 = Normal, 1.4 = Difficile, 2.0 = Brutal
    this.difficulty = difficulty;

    const seed = Date.now() & 0x7fffffff;
    const { map, resources } = generateMap(seed);
    this.mapSeed = seed;
    this.map = map;

    this.shared = {
      resources: { wood: 200, stone: 100, gold: 50, food: 150 },
      resourceNodes: resources,
      buildings: [],
      units: [],
      nextId: 1,
    };

    // ── Player starting setup (two town halls, shared co-op) ──────────────────
    const th1 = this._findValidSpawnArea(4, 4, 2);
    const th2 = this._findValidSpawnArea(MAP_WIDTH - 6, MAP_HEIGHT - 6, 2);
    this._addBuilding('town_hall', th1.x, th1.y, 'shared');
    this._addBuilding('town_hall', th2.x, th2.y, 'shared');
    this._addUnit('paysan', th1.x + 2, th1.y,     'player');
    this._addUnit('paysan', th1.x + 1, th1.y + 1, 'player');
    this._addUnit('paysan', th2.x - 1, th2.y + 1, 'player');

    // ── Enemy clan: top-right corner ─────────────────────────────────────────
    const enemyCamp = this._findValidSpawnArea(MAP_WIDTH - 9, 3, 2);
    this.enemy = {
      campX: enemyCamp.x, campY: enemyCamp.y,
      aggroLevel: 0,
      buildTimer: 0,
    };
    this._addBuilding('town_hall', this.enemy.campX, this.enemy.campY, 'enemy');
    this._addUnit('homme_armes', this.enemy.campX + 2, this.enemy.campY + 2, 'enemy');
    this._addUnit('archer',      this.enemy.campX + 3, this.enemy.campY + 1, 'enemy');
    this._addUnit('mercenaire',  this.enemy.campX + 1, this.enemy.campY + 3, 'enemy');

    // ── Neutral mobs scattered across map ────────────────────────────────────
    const mobRand = rng(seed ^ 0x5a5a5a5a);
    this._spawnNeutralMobs(mobRand);

    // ── Enemy villages (with archer towers) ──────────────────────────────────
    this.shared.villages = this._generateVillages();
    this.shared.dungeons = this._generateDungeons();

    // ── NPCs ──────────────────────────────────────────────────────────────────
    this.shared.npcs = SERVER_NPC_DEFS.map(d => ({
      ...d, quest: { ...d.quest },
      questAccepted: false, questProgress: 0, questCompleted: false,
    }));

    this.activeBattle = null;
    this._pendingEvents = [];
    this.eventTimer = 0;

    // ── Population: 6 founding adults (3 couples) housed in town_hall area ────
    this.shared.population = [];
    const foundingPaysans = this.shared.units.filter(u => u.type === 'paysan');
    for (let i = 0; i < 6; i++) {
      const paysanUnit = foundingPaysans[i] || null;
      this.shared.population.push({
        id: `cit_s${i}`,
        age: POP.ADULT_TICKS + 50,   // already adult
        isChild: false,
        birthHouseId: null,
        houseId: 'townhall_start',   // virtual; exempt from SDF
        sdfTimer: 0,
        x: 6 + (i % 3), y: 5 + Math.floor(i / 3),
        deployed: !!paysanUnit,
        unitId: paysanUnit ? paysanUnit.id : null,
      });
    }
  }

  _nextId() { return `obj_${this.shared.nextId++}`; }

  _addBuilding(type, x, y, owner, buildTime = 0) {
    this.shared.buildings.push({
      id: this._nextId(), type, x, y, owner, hp: 500, maxHp: 500,
      underConstruction: buildTime > 0,
      constructionProgress: 0,
      constructionTime: buildTime,
    });
  }

  _addUnit(type, x, y, owner) {
    const stats = UNIT_BASE_STATS[type] || UNIT_BASE_STATS['homme_armes'];
    const isEnemy = owner === 'enemy';
    const hpMul = isEnemy ? (this.difficulty || 1.0) : 1.0;
    const maxHp = Math.round(stats.maxHp * hpMul);
    const unit = {
      id: this._nextId(), type, x, y, owner,
      hp: maxHp, maxHp,
      moves: stats.moves.slice(),
      gatherState: 'idle',
      targetResource: null,
      inventory: 0,
      inventoryMax: 20,
      inventoryType: null,
      targetX: null,
      targetY: null,
    };
    this.shared.units.push(unit);
    return unit;
  }

  join(socketId, name, clan, heroType) {
    if (this.playerOrder.length >= 2) return false;
    const num = this.playerOrder.length + 1;
    this.players[socketId] = { id: `p${num}`, name, clan, socketId, heroType: heroType || 'roi_guerrier' };
    this.playerOrder.push(socketId);
    return true;
  }

  // Find nearest walkable tile (not WATER, not MOUNTAIN) from (preferX, preferY)
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
    return { x: preferX, y: preferY }; // fallback (shouldn't happen)
  }

  // Find nearest position where a size×size footprint is fully walkable
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

  // Called when both players are connected (state → 'playing')
  startGame() {
    const preferredSpawns = [
      { x: 8, y: 6 },
      { x: MAP_WIDTH - 9, y: MAP_HEIGHT - 7 },
    ];
    this.playerOrder.forEach((socketId, i) => {
      const player = this.players[socketId];
      const pref = preferredSpawns[i] || preferredSpawns[0];
      const sp = this._findValidSpawn(pref.x, pref.y);
      this._addHero(player.heroType || 'roi_guerrier', sp.x, sp.y, socketId);
    });
  }

  _addHero(heroType, x, y, socketId) {
    const stats = HERO_BASE_STATS[heroType] || HERO_BASE_STATS['roi_guerrier'];
    const hero = {
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

  leave(socketId) {
    // Keep player data in case they reconnect — just mark them disconnected
    if (this.players[socketId]) {
      this.players[socketId].disconnected = true;
    }
    this.playerOrder = this.playerOrder.filter(id => id !== socketId);
  }

  isFull()  { return this.playerOrder.length >= 2; }
  isEmpty() { return this.playerOrder.length === 0; }

  // Spawn a hero for a player who joins a game already in progress
  addLateJoiner(socketId) {
    const player = this.players[socketId];
    if (!player) return;
    // Pick the spawn index based on how many players are already in
    const spawnPrefs = [
      { x: 8, y: 6 },
      { x: MAP_WIDTH - 9, y: MAP_HEIGHT - 7 },
      { x: 8, y: MAP_HEIGHT - 7 },
      { x: MAP_WIDTH - 9, y: 6 },
    ];
    const idx = Math.max(0, this.playerOrder.length - 1);
    const pref = spawnPrefs[idx % spawnPrefs.length];
    const sp = this._findValidSpawn(pref.x, pref.y);
    this._addHero(player.heroType || 'roi_guerrier', sp.x, sp.y, socketId);
  }

  getStateSnapshot() {
    return {
      code: this.code,
      mapSeed: this.mapSeed,
      map: this.map,
      players: Object.values(this.players),
      shared: this.shared,
      npcs: this.shared.npcs,
      activeBattle: this.activeBattle,
    };
  }

  handleAction(socketId, action) {
    const player = this.players[socketId];
    if (!player || this.state !== 'playing') return null;
    switch (action.type) {
      case 'MOVE_UNIT':      return this._moveUnit(action.unitId, action.tx, action.ty);
      case 'GATHER':         return this._gatherResource(action.unitId, action.resourceId);
      case 'PLACE_BUILDING': return this._placeBuilding(action.buildingType, action.tx, action.ty);
      case 'TRAIN_UNIT':     return this._trainUnit(action.buildingId, action.unitType);
      case 'BATTLE_MOVE':    return this._battleMove(action.moveIndex);
      case 'INTERACT_NPC':   return this._interactNpc(action.npcId, socketId);
      case 'ACCEPT_QUEST':   return this._acceptQuest(action.npcId, action.heroId);
      case 'ENTER_DUNGEON':  return this._enterDungeon(action.dungeonId, action.unitId);
      default: return null;
    }
  }

  // ─── Movement ────────────────────────────────────────────────────────────────

  _moveUnit(unitId, tx, ty) {
    // Refuse movement while a battle is in progress (prevents overwriting activeBattle)
    if (this.activeBattle) return null;
    const unit = this.shared.units.find(u => u.id === unitId);
    if (!unit || unit.owner === 'enemy' || unit.owner === 'neutral') return null;
    if (ty < 0 || ty >= MAP_HEIGHT || tx < 0 || tx >= MAP_WIDTH) return null;
    if (this.map[ty][tx] === T.WATER || this.map[ty][tx] === T.MOUNTAIN) return null;

    // Village tower at destination → start siege (unit walks adjacent, attacks each tick)
    const village = (this.shared.villages || []).find(v => !v.capturedBy && v.x === tx && v.y === ty);
    if (village) {
      this._startVillageSiege(unit, village);
      return { type: 'STATE_UPDATE', shared: this.shared };
    }

    // Neutral mob at destination → turn-based battle (same system as enemies)
    const neutral = this.shared.units.find(u => u.x === tx && u.y === ty && u.owner === 'neutral');
    if (neutral) {
      return this._startBattle(unit, neutral);
    }

    // Enemy unit at destination → battle (immediate)
    const enemy = this.shared.units.find(u => u.x === tx && u.y === ty && u.owner === 'enemy');
    if (enemy) {
      this.enemy.aggroLevel = Math.min(100, this.enemy.aggroLevel + 40);
      return this._startBattle(unit, enemy);
    }

    // Wall blocks destination
    if (this.shared.buildings.find(b => b.type === 'wall' && b.x === tx && b.y === ty && !b.underConstruction)) return null;

    // Normal tile → set movement target, unit walks there step by step
    unit.targetX = tx;
    unit.targetY = ty;
    unit.gatherState    = 'idle';
    unit.targetResource = null;

    return { type: 'STATE_UPDATE', shared: this.shared };
  }

  // ─── Timed global effects ─────────────────────────────────────────────────

  tickTimedEffects() {
    let changed = false;
    // Stun countdown on individual units
    for (const u of this.shared.units) {
      if (u.stunned > 0) { u.stunned--; changed = true; }
    }
    // Global timed states
    if (this.shared.nightOfBlood > 0) { this.shared.nightOfBlood--; changed = true; }
    if (this.shared.truce > 0)        { this.shared.truce--;        changed = true; }
    return changed;
  }

  // ─── Population ───────────────────────────────────────────────────────────

  tickPopulation() {
    let changed = false;
    const pop = this.shared.population;
    const houses = this.shared.buildings.filter(b => b.type === 'house' && !b.underConstruction);

    // 1. Age all children and promote to adult when ready
    for (const cit of pop.filter(c => c.isChild)) {
      cit.age++;
      changed = true;
      if (cit.age >= POP.ADULT_TICKS) {
        cit.isChild = false;
        cit.houseId = null;  // needs their own house
        cit.sdfTimer = 0;
        // Position them outside their birth house
        const bh = this.shared.buildings.find(b => b.id === cit.birthHouseId);
        cit.x = bh ? bh.x + 1 : 8;
        cit.y = bh ? bh.y + 1 : 6;
        this._pendingEvents.push({
          type: 'random_event',
          message: '🧑 Un enfant vient d\'avoir 16 ans ! Construisez-lui une maison, sinon il rejoindra les ennemis.',
          color: 0xffaa44,
        });
      }
    }

    // 2. Reproduction: each house with no current child tries to birth one
    for (const house of houses) {
      const hasChild = pop.some(c => c.isChild && c.birthHouseId === house.id);
      if (hasChild) continue;
      const residents = pop.filter(c => !c.isChild && c.houseId === house.id);
      if (residents.length < POP.HOUSE_CAPACITY) continue; // no couple yet
      house.reproTimer = (house.reproTimer || 0) + 1;
      changed = true;
      if (house.reproTimer >= POP.REPRO_COOLDOWN) {
        house.reproTimer = 0;
        const child = {
          id: `cit_${this._nextId()}`,
          age: 0, isChild: true,
          birthHouseId: house.id, houseId: house.id,
          sdfTimer: 0, x: house.x, y: house.y,
          deployed: false, unitId: null,
        };
        pop.push(child);
        this._pendingEvents.push({
          type: 'random_event',
          message: `👶 Une naissance ! L'enfant sera adulte dans ${Math.round(POP.ADULT_TICKS / 60)} min.`,
          color: 0xffccaa,
        });
      }
    }

    // 3. SDF adults: countdown → enemy
    for (const cit of pop.filter(c => !c.isChild && !c.houseId && !c.deployed)) {
      cit.sdfTimer++;
      changed = true;
      if (cit.sdfTimer >= POP.SDF_TIMEOUT) {
        const x = Math.max(1, Math.min(MAP_WIDTH - 2, Math.round(cit.x) || 10));
        const y = Math.max(1, Math.min(MAP_HEIGHT - 2, Math.round(cit.y) || 10));
        if (this.map[y]?.[x] !== T.WATER && this.map[y]?.[x] !== T.MOUNTAIN
          && !this.shared.units.find(u => u.x === x && u.y === y)) {
          this._addUnit('homme_armes', x, y, 'enemy');
        }
        pop.splice(pop.indexOf(cit), 1);
        this._pendingEvents.push({
          type: 'random_event',
          message: '😡 Un sans-abri désespéré a rejoint les ennemis ! Construisez des maisons.',
          color: 0xff4400,
        });
      }
    }

    return changed;
  }

  // Step all player units one tile toward their targetX/targetY (1 tile per tick)
  tickUnitMovement() {
    let changed = false;
    for (const unit of this.shared.units) {
      if (unit.owner === 'enemy' || unit.owner === 'neutral') continue;
      if (unit.targetX === null || unit.targetX === undefined) continue;
      // Orage: unit is temporarily frozen
      if (unit.stunned > 0) { changed = true; continue; }
      // Gathering takes over movement
      if (unit.gatherState && unit.gatherState !== 'idle') {
        unit.targetX = null; unit.targetY = null; continue;
      }
      if (unit.x === unit.targetX && unit.y === unit.targetY) {
        unit.targetX = null; unit.targetY = null; continue;
      }
      // Fractional-accumulator speed: heroes 1.8x, attack units 1.4x, paysans 1.0x
      const speed = UNIT_SPEED[unit.type] || 1.0;
      unit._moveAccum = (unit._moveAccum || 0) + speed;
      while (unit._moveAccum >= 1) {
        unit._moveAccum -= 1;
        if (unit.x === unit.targetX && unit.y === unit.targetY) break;
        this._stepToward(unit, unit.targetX, unit.targetY);
      }
      changed = true;
    }
    return changed;
  }

  // ─── Gathering ────────────────────────────────────────────────────────────

  _gatherResource(unitId, resourceId) {
    const unit = this.shared.units.find(u => u.id === unitId);
    const node = this.shared.resourceNodes.find(r => r.id === resourceId);
    if (!unit || !node || node.amount <= 0) return null;
    // Trees that are regrowing cannot be gathered
    if (node.type === 'wood' && node.state && node.state !== 'alive') return null;
    unit.targetResource = resourceId;
    unit.gatherState    = 'to_resource';
    unit.inventory      = 0;
    unit.inventoryType  = node.type;
    return { type: 'STATE_UPDATE', shared: this.shared };
  }

  tickGathering() {
    let changed = false;
    for (const unit of this.shared.units) {
      if (!unit.gatherState || unit.gatherState === 'idle') continue;
      const node = unit.targetResource
        ? this.shared.resourceNodes.find(r => r.id === unit.targetResource)
        : null;

      switch (unit.gatherState) {
        case 'to_resource': {
          if (!node || node.amount <= 0) {
            unit.gatherState = 'idle'; unit.targetResource = null;
          } else {
            const arrived = this._stepToward(unit, node.x, node.y);
            if (arrived) unit.gatherState = 'gathering';
          }
          changed = true; break;
        }
        case 'gathering': {
          // Tree regrowing mid-gather → abort
          if (node?.type === 'wood' && node.state && node.state !== 'alive') {
            unit.gatherState = unit.inventory > 0 ? 'to_deposit' : 'idle';
            unit.targetResource = null; changed = true; break;
          }
          if (!node || node.amount <= 0) {
            unit.gatherState = unit.inventory > 0 ? 'to_deposit' : 'idle';
            if (!unit.inventory) unit.targetResource = null;
          } else {
            const take = Math.min(5, node.amount, unit.inventoryMax - unit.inventory);
            node.amount -= take;
            unit.inventory += take;
            // When a wood node hits 0, mark it as stump → will regrow
            if (node.amount <= 0 && node.type === 'wood') {
              node.state = 'stump';
              node.regrowTimer = 0;
            }
            if (unit.inventory >= unit.inventoryMax || node.amount <= 0) {
              unit.gatherState = 'to_deposit';
            }
          }
          changed = true; break;
        }
        case 'to_deposit': {
          const depot = this._nearestDepot(unit.inventoryType, unit.x, unit.y);
          if (!depot) {
            // No depot available — drop resources in place
            this.shared.resources[unit.inventoryType] =
              (this.shared.resources[unit.inventoryType] || 0) + unit.inventory;
            unit.inventory = 0; unit.gatherState = 'idle';
          } else {
            // All buildings are 2×2, visual center at (bld.x+1, bld.y+1)
            const tx = depot.x + 1, ty = depot.y + 1;
            const dist = Math.abs(unit.x - tx) + Math.abs(unit.y - ty);
            if (dist <= 2) {
              this.shared.resources[unit.inventoryType] =
                (this.shared.resources[unit.inventoryType] || 0) + unit.inventory;
              unit.inventory = 0;
              const stillValid = node && node.amount > 0;
              unit.gatherState = stillValid ? 'to_resource' : 'idle';
              if (!stillValid) unit.targetResource = null;
            } else {
              this._stepToward(unit, tx, ty);
            }
          }
          changed = true; break;
        }
      }
    }
    return changed;
  }

  // Move one tile toward (tx,ty), avoiding water/mountain; returns true when arrived
  // Exception: the destination tile itself may be mountain if it holds a resource node.
  _stepToward(unit, tx, ty) {
    if (unit.x === tx && unit.y === ty) return true;
    const dx = tx - unit.x, dy = ty - unit.y;
    const isResourceTile = (nx, ny) =>
      nx === tx && ny === ty &&
      this.shared.resourceNodes.some(r => r.x === nx && r.y === ny && r.amount > 0);
    const tryStep = (nx, ny) => {
      if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) return false;
      const tile = this.map[ny][nx];
      if (tile === T.WATER) return false;
      if (tile === T.MOUNTAIN && !isResourceTile(nx, ny)) return false;
      if (this.shared.buildings.find(b => b.type === 'wall' && b.x === nx && b.y === ny && !b.underConstruction)) return false;
      unit.x = nx; unit.y = ny; return true;
    };
    if (Math.abs(dx) >= Math.abs(dy)) {
      if (!tryStep(unit.x + Math.sign(dx), unit.y)) tryStep(unit.x, unit.y + Math.sign(dy));
    } else {
      if (!tryStep(unit.x, unit.y + Math.sign(dy))) tryStep(unit.x + Math.sign(dx), unit.y);
    }
    return unit.x === tx && unit.y === ty;
  }

  // Like _stepToward but for enemy units: attacks walls instead of stopping
  _stepTowardEnemy(unit, tx, ty) {
    if (unit.x === tx && unit.y === ty) return true;
    const dx = tx - unit.x, dy = ty - unit.y;
    const tryStep = (nx, ny) => {
      if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) return false;
      if (this.map[ny][nx] === T.WATER || this.map[ny][nx] === T.MOUNTAIN) return false;
      const wall = this.shared.buildings.find(b => b.type === 'wall' && b.x === nx && b.y === ny);
      if (wall) {
        wall.hp -= 20;
        if (wall.hp <= 0) {
          this.shared.buildings = this.shared.buildings.filter(b => b.id !== wall.id);
          unit.x = nx; unit.y = ny;
        }
        return true;
      }
      unit.x = nx; unit.y = ny; return true;
    };
    if (Math.abs(dx) >= Math.abs(dy)) {
      if (!tryStep(unit.x + Math.sign(dx), unit.y)) tryStep(unit.x, unit.y + Math.sign(dy));
    } else {
      if (!tryStep(unit.x, unit.y + Math.sign(dy))) tryStep(unit.x + Math.sign(dx), unit.y);
    }
    return unit.x === tx && unit.y === ty;
  }

  // Returns the nearest building that can receive `resourceType`
  // Specialized buildings are preferred; town_hall is the universal fallback.
  _nearestDepot(resourceType, x, y) {
    const ACCEPTS = {
      wood:  ['lumber_mill', 'town_hall'],
      stone: ['mine',        'town_hall'],
      gold:  ['mine',        'town_hall'],
      food:  ['farm',        'town_hall'],
    };
    const types = ACCEPTS[resourceType] || ['town_hall'];
    const depots = this.shared.buildings.filter(
      b => types.includes(b.type) && !b.underConstruction && b.owner === 'shared',
    );
    if (!depots.length) return null;
    return depots.reduce((best, b) => {
      const d  = Math.abs(b.x - x) + Math.abs(b.y - y);
      const bd = Math.abs(best.x - x) + Math.abs(best.y - y);
      return d < bd ? b : best;
    });
  }

  // ─── Resource regen (trees regrow after being cut) ────────────────────────

  // ─── Random events (every 3 min) ──────────────────────────────────────────

  tickRandomEvents() {
    this.eventTimer++;
    if (this.eventTimer % 180 !== 0) return false; // 180 ticks × 1 s = 3 min

    const evTypes = [
      'merchant', 'drought', 'mercenaries', 'enemy_raid',
      'storm', 'wolf_pack', 'deposit', 'fire', 'mage',
      'deserter', 'refugees', 'night_blood', 'discovery', 'truce', 'boss',
    ];
    const chosen = evTypes[Math.floor(Math.random() * evTypes.length)];
    let message = '', color = 0xffd700;

    const GOOD_EVENTS   = new Set(['merchant', 'deposit', 'refugees', 'discovery', 'truce', 'mage']);
    const DANGER_EVENTS = new Set(['enemy_raid', 'wolf_pack', 'fire', 'night_blood', 'boss', 'mercenaries', 'deserter', 'drought', 'storm']);
    const _sound = GOOD_EVENTS.has(chosen) ? 'good' : DANGER_EVENTS.has(chosen) ? 'danger' : 'event';

    const nearTownHall = (offsets) => {
      const th = this.shared.buildings.find(b => b.type === 'town_hall' && b.owner !== 'enemy');
      if (!th) return [];
      const results = [];
      for (const off of offsets) {
        const x = th.x + off.dx, y = th.y + off.dy;
        if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) continue;
        if (this.map[y]?.[x] === T.WATER || this.map[y]?.[x] === T.MOUNTAIN) continue;
        if (this.shared.units.find(u => u.x === x && u.y === y)) continue;
        results.push({ x, y });
      }
      return results;
    };

    switch (chosen) {
      // ── Original 4 ────────────────────────────────────────────────────────────
      case 'merchant': {
        if ((this.shared.resources.wood || 0) >= 200) {
          this.shared.resources.wood -= 200;
          this.shared.resources.gold = (this.shared.resources.gold || 0) + 50;
          message = '🧳 Un marchand passe ! -200 bois, +50 or';
        } else {
          this.shared.resources.gold = (this.shared.resources.gold || 0) + 25;
          message = '🧳 Un marchand généreux offre +25 or !';
        }
        color = 0xffd700;
        break;
      }
      case 'drought': {
        this.shared.resources.food = Math.max(0, (this.shared.resources.food || 0) - 80);
        message = '☀️ Sécheresse ! -80 nourriture.';
        color = 0xff8800;
        break;
      }
      case 'mercenaries': {
        const slots = nearTownHall([{ dx: 2, dy: 0 }, { dx: -1, dy: 1 }, { dx: 0, dy: 2 }, { dx: 1, dy: -1 }]);
        for (const s of slots.slice(0, 2)) this._addUnit('mercenaire', s.x, s.y, 'player');
        message = '⚔️ Renfort ! 2 mercenaires rejoignent votre cause.';
        color = 0x44cc88;
        break;
      }
      case 'enemy_raid': {
        this._spawnEnemyClanUnit();
        this._spawnEnemyClanUnit();
        this.enemy.aggroLevel = Math.min(100, this.enemy.aggroLevel + 40);
        message = '💀 Raid ennemi ! Une horde approche.';
        color = 0xcc2222;
        break;
      }
      // ── 10 nouveaux ───────────────────────────────────────────────────────────
      case 'storm': {
        // Stun all player units for 3 ticks
        for (const u of this.shared.units) {
          if (u.owner !== 'enemy' && u.owner !== 'neutral') u.stunned = 3;
        }
        message = '🌩 Orage ! Vos unités sont immobilisées pendant 3 secondes.';
        color = 0x4488ff;
        break;
      }
      case 'wolf_pack': {
        // Spawn 3 wolves near a random player unit
        const players = this.shared.units.filter(u => u.owner !== 'enemy' && u.owner !== 'neutral');
        if (players.length) {
          const target = players[Math.floor(Math.random() * players.length)];
          const offsets = [{ dx: 2, dy: 0 }, { dx: -2, dy: 0 }, { dx: 0, dy: 2 }, { dx: 0, dy: -2 }];
          let spawned = 0;
          for (const off of offsets) {
            if (spawned >= 3) break;
            const x = target.x + off.dx, y = target.y + off.dy;
            if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) continue;
            if (this.map[y]?.[x] === T.WATER || this.map[y]?.[x] === T.MOUNTAIN) continue;
            if (this.shared.units.find(u => u.x === x && u.y === y)) continue;
            this.shared.units.push({
              id: this._nextId(), type: 'loup', x, y, owner: 'neutral',
              hp: 25, maxHp: 25, moves: [], reward: 10,
              gatherState: 'idle', targetResource: null,
              inventory: 0, inventoryMax: 0, inventoryType: null,
            });
            spawned++;
          }
        }
        message = '🐺 Meute affamée ! Des loups rodent près de vos unités.';
        color = 0x997755;
        break;
      }
      case 'deposit': {
        // Spawn a new gold or stone resource node near player
        const th = this.shared.buildings.find(b => b.type === 'town_hall' && b.owner !== 'enemy');
        if (th) {
          const rType = Math.random() < 0.5 ? 'gold' : 'stone';
          for (let attempt = 0; attempt < 30; attempt++) {
            const x = th.x + Math.floor(Math.random() * 14) - 7;
            const y = th.y + Math.floor(Math.random() * 14) - 7;
            if (x < 1 || x >= MAP_WIDTH - 1 || y < 1 || y >= MAP_HEIGHT - 1) continue;
            if (this.shared.resourceNodes.find(r => r.x === x && r.y === y)) continue;
            if (this.map[y]?.[x] === T.WATER) continue;
            const amount = rType === 'gold' ? 300 : 400;
            this.shared.resourceNodes.push({
              id: `res_ev_${this._nextId()}`, type: rType, x, y,
              amount, maxAmount: amount, state: 'alive', regrowTimer: 0,
            });
            break;
          }
        }
        message = '💎 Gisement découvert ! Une nouvelle veine de ressources apparaît.';
        color = 0x88ddff;
        break;
      }
      case 'fire': {
        // Random player building loses 30% HP
        const blds = this.shared.buildings.filter(b => b.owner === 'shared' && !b.underConstruction && b.type !== 'wall');
        if (blds.length) {
          const target = blds[Math.floor(Math.random() * blds.length)];
          target.hp = Math.max(1, Math.round(target.hp * 0.7));
        }
        message = '🔥 Incendie ! La foudre frappe un de vos bâtiments (-30% HP).';
        color = 0xff4400;
        break;
      }
      case 'mage': {
        // Wandering mage NPC grants XP to first hero who interacts
        const th = this.shared.buildings.find(b => b.type === 'town_hall' && b.owner !== 'enemy');
        if (th) {
          this.shared.npcs.push({
            id: `npc_mage_${this._nextId()}`,
            type: 'pretre', x: th.x + 3, y: th.y,
            name: 'Mage Itinérant',
            temporary: true, xpReward: 40,
            quest: { id: `mage_quest_${Date.now()}`, type: 'none', needed: 0 },
            questAccepted: false, questProgress: 0, questCompleted: false,
          });
        }
        message = '🧙 Un mage itinérant s\'installe près de votre camp. Interagissez avec lui !';
        color = 0xaa55ff;
        break;
      }
      case 'deserter': {
        // A random enemy unit switches sides
        const enemies = this.shared.units.filter(u => u.owner === 'enemy');
        if (enemies.length) {
          const deserter = enemies[Math.floor(Math.random() * enemies.length)];
          deserter.owner = 'player';
          deserter.hp = Math.round(deserter.hp * 0.6); // wounded
        }
        message = '⚓ Déserteur ! Un soldat ennemi rejoint votre camp.';
        color = 0x44cc88;
        break;
      }
      case 'refugees': {
        // Free paysan near town hall
        const slots2 = nearTownHall([{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 0, dy: -1 }]);
        if (slots2.length) this._addUnit('paysan', slots2[0].x, slots2[0].y, 'player');
        message = '🏚 Des réfugiés arrivent ! Un paysan gratuit rejoint votre village.';
        color = 0xaabb88;
        break;
      }
      case 'night_blood': {
        this.shared.nightOfBlood = 60; // 60 ticks = 1 min
        this.enemy.aggroLevel = Math.min(100, this.enemy.aggroLevel + 50);
        message = '🌕 Nuit de Sang ! Les ennemis frappent plus fort pendant 1 minute.';
        color = 0xcc0000;
        break;
      }
      case 'discovery': {
        this.nextBuildDiscount = 0.25;
        message = '📜 Découverte Ancienne ! Votre prochain bâtiment coûte 25% moins cher.';
        color = 0xddcc55;
        break;
      }
      case 'truce': {
        this.shared.truce = 90; // 90 ticks = 1.5 min
        this.enemy.aggroLevel = 0;
        message = '🕊 Trêve ! Les ennemis se retirent pendant 90 secondes.';
        color = 0x88ccff;
        break;
      }
      case 'boss': {
        // Spawn tyran somewhere in the middle of the map, very aggressive
        let bx = 35 + Math.floor(Math.random() * 10) - 5;
        let by = 25 + Math.floor(Math.random() * 10) - 5;
        // Avoid water/mountain
        for (let attempt = 0; attempt < 20; attempt++) {
          if (this.map[by]?.[bx] !== T.WATER && this.map[by]?.[bx] !== T.MOUNTAIN
            && !this.shared.units.find(u => u.x === bx && u.y === by)) break;
          bx = 30 + Math.floor(Math.random() * 20);
          by = 20 + Math.floor(Math.random() * 20);
        }
        const boss = UNIT_BASE_STATS.tyran;
        this.shared.units.push({
          id: this._nextId(), type: 'tyran', x: bx, y: by,
          owner: 'neutral', hp: boss.maxHp, maxHp: boss.maxHp,
          moves: [], reward: boss.reward,
          gatherState: 'idle', targetResource: null,
          inventory: 0, inventoryMax: 0, inventoryType: null,
          isBoss: true,
        });
        this._pendingEvents.push({ type: 'random_event', message: '💀 Un Tyran des Ombres surgit au cœur de la carte !', color: 0x7700aa, sound: 'danger' });
        return true;
      }
    }

    this._pendingEvents.push({ type: 'random_event', message, color, sound: _sound });
    return true;
  }

  tickResourceRegen() {
    let changed = false;
    const REGROW_TICKS = 90; // 90 s to full regrow
    for (const node of this.shared.resourceNodes) {
      if (node.type !== 'wood' || !node.state || node.state === 'alive') continue;
      node.regrowTimer = (node.regrowTimer || 0) + 1;
      if (node.regrowTimer >= REGROW_TICKS) {
        node.state = 'alive';
        node.amount = node.maxAmount || 200;
        node.regrowTimer = 0;
        changed = true;
      } else if (node.state === 'stump' && node.regrowTimer >= Math.floor(REGROW_TICKS * 0.35)) {
        node.state = 'sapling';
        changed = true;
      }
    }
    return changed;
  }

  // ─── Construction ─────────────────────────────────────────────────────────

  tickConstruction() {
    let changed = false;
    for (const bld of this.shared.buildings) {
      if (!bld.underConstruction) continue;
      bld.constructionProgress++;
      if (bld.constructionProgress >= bld.constructionTime) {
        bld.underConstruction = false;
        // New house: move in SDF adults first, then virtual settlers if none
        if (bld.type === 'house') {
          bld.reproTimer = 0;
          const sdfAdults = this.shared.population.filter(c => !c.isChild && !c.houseId && !c.deployed);
          const movedIn = sdfAdults.slice(0, POP.HOUSE_CAPACITY);
          for (const cit of movedIn) { cit.houseId = bld.id; cit.sdfTimer = 0; }
          // If fewer than 2 moved in, create virtual settlers to fill the house
          for (let i = movedIn.length; i < POP.HOUSE_CAPACITY; i++) {
            this.shared.population.push({
              id: `cit_${this._nextId()}`,
              age: POP.ADULT_TICKS + Math.floor(Math.random() * 100),
              isChild: false, birthHouseId: bld.id, houseId: bld.id,
              sdfTimer: 0, x: bld.x + (i === 0 ? 0 : 1), y: bld.y,
              deployed: false, unitId: null,
            });
          }
        }
      }
      changed = true;
    }
    return changed;
  }

  // ─── Building placement ───────────────────────────────────────────────────

  _placeBuilding(type, tx, ty) {
    const cost = BUILDING_COSTS[type];
    if (!cost) return null;
    for (const [res, amount] of Object.entries(cost)) {
      if ((this.shared.resources[res] || 0) < amount) return null;
    }
    if (this.map[ty]?.[tx] === T.WATER || this.map[ty]?.[tx] === T.MOUNTAIN) return null;

    // Territory check: must build near a player town_hall or captured village
    if (type !== 'wall') {
      const TOWN_R = 22, VILLAGE_R = 16;
      const halls = this.shared.buildings.filter(b => b.type === 'town_hall' && b.owner !== 'enemy');
      const captured = (this.shared.villages || []).filter(v => v.capturedBy);
      const inTerritory =
        halls.some(h => Math.abs(h.x - tx) + Math.abs(h.y - ty) <= TOWN_R)
        || captured.some(v => Math.abs(v.x - tx) + Math.abs(v.y - ty) <= VILLAGE_R);
      if (!inTerritory) return null;
    }

    if (type === 'wall') {
      const wallCount = this.shared.buildings.filter(b => b.type === 'wall').length;
      if (wallCount >= 20) return null;
      if (this.shared.buildings.some(b => b.x === tx && b.y === ty)) return null;
      if (this.shared.resourceNodes.some(r => r.x === tx && r.y === ty)) return null;
    } else {
      const occupied = this.shared.buildings.some(b => b.x === tx && b.y === ty)
        || this.shared.units.some(u => u.x === tx && u.y === ty);
      if (occupied) return null;
    }

    const discount = this.nextBuildDiscount || 0;
    this.nextBuildDiscount = 0;
    for (const [res, amount] of Object.entries(cost)) {
      this.shared.resources[res] -= Math.round(amount * (1 - discount));
    }
    const buildTime = BUILD_TIMES[type] || 10;
    this._addBuilding(type, tx, ty, 'shared', buildTime);
    // Quest progress: build
    this._updateQuestProgressAll('build', type);
    return { type: 'STATE_UPDATE', shared: this.shared };
  }

  // ─── Unit training ────────────────────────────────────────────────────────

  _trainUnit(buildingId, unitType) {
    const building = this.shared.buildings.find(b => b.id === buildingId);
    if (!building || building.underConstruction) return null;
    const cost = UNIT_COSTS[unitType];
    if (!cost) return null;
    for (const [res, amount] of Object.entries(cost)) {
      if ((this.shared.resources[res] || 0) < amount) return null;
    }
    // Require an available adult citizen (housed, not yet deployed)
    const citizen = this.shared.population.find(c => !c.isChild && c.houseId && !c.deployed);
    if (!citizen) {
      return { type: 'ERROR', message: 'Pas d\'habitant disponible ! Attendez une naissance ou construisez des maisons.' };
    }
    for (const [res, amount] of Object.entries(cost)) this.shared.resources[res] -= amount;
    citizen.deployed = true;
    const unit = this._addUnit(unitType, building.x + 1, building.y + 1, 'player');
    citizen.unitId = unit.id;
    // Quest progress: train_units
    this._updateQuestProgressAll('train_units', unitType);
    return { type: 'STATE_UPDATE', shared: this.shared };
  }

  // ─── Neutral mobs ─────────────────────────────────────────────────────────

  // ─── Enemy villages ───────────────────────────────────────────────────────

  _generateVillages() {
    const rand = rng(this.mapSeed ^ 0x7abc1234);
    const villages = [];
    const prefs = [
      { x: 38, y: 12 }, { x: 16, y: 32 }, { x: 62, y: 28 },
      { x: 40, y: 48 }, { x: 22, y: 50 }, { x: 60, y: 48 },
    ];

    // Player base positions (both players share the same map corners)
    const BASE1 = { x: 8, y: 6 };
    const BASE2 = { x: MAP_WIDTH - 9, y: MAP_HEIGHT - 7 };

    // Distance-based tier (1=close/easy … 5=far/hard)
    const _tier = (vx, vy) => {
      const d1 = Math.sqrt((vx - BASE1.x) ** 2 + (vy - BASE1.y) ** 2);
      const d2 = Math.sqrt((vx - BASE2.x) ** 2 + (vy - BASE2.y) ** 2);
      const d  = Math.min(d1, d2); // nearest player base
      // Map 0…70 tiles → tier 1…5
      if (d < 18) return 1;
      if (d < 28) return 2;
      if (d < 38) return 3;
      if (d < 50) return 4;
      return 5;
    };

    // Per-tier tower HP, guard type, guard HP, loot scale
    const TIER_DEF = {
      1: { towerHp: 200, guardType: 'homme_armes', guardHp: 50,  guardCount: 1, lootMul: 0.7 },
      2: { towerHp: 280, guardType: 'homme_armes', guardHp: 70,  guardCount: 2, lootMul: 1.0 },
      3: { towerHp: 350, guardType: 'frere_epee',  guardHp: 90,  guardCount: 2, lootMul: 1.3 },
      4: { towerHp: 440, guardType: 'croise',      guardHp: 110, guardCount: 2, lootMul: 1.7 },
      5: { towerHp: 550, guardType: 'garde_roi',   guardHp: 140, guardCount: 3, lootMul: 2.2 },
    };

    for (const pref of prefs) {
      if (villages.length >= 4) break;
      const sp = this._findValidSpawn(pref.x, pref.y);
      // Stay clear of player starts, enemy camp, other villages
      if (Math.abs(sp.x - BASE1.x) + Math.abs(sp.y - BASE1.y) < 16) continue;
      if (Math.abs(sp.x - BASE2.x)  + Math.abs(sp.y - BASE2.y)  < 16) continue;
      if (Math.abs(sp.x - this.enemy.campX) + Math.abs(sp.y - this.enemy.campY) < 14) continue;
      if (villages.some(v => Math.abs(v.x - sp.x) + Math.abs(v.y - sp.y) < 16)) continue;

      const vid  = `village_${villages.length}`;
      const tier = _tier(sp.x, sp.y);
      const def  = TIER_DEF[tier];

      const towerHp = Math.round(def.towerHp * (this.difficulty || 1.0));
      villages.push({
        id: vid, x: sp.x, y: sp.y, level: tier,
        hp: towerHp, maxHp: towerHp, capturedBy: null,
        loot: {
          wood:  Math.floor((100 + Math.floor(rand() * 150)) * def.lootMul),
          stone: Math.floor(( 40 + Math.floor(rand() * 100)) * def.lootMul),
          gold:  Math.floor(( 25 + Math.floor(rand() *  80)) * def.lootMul),
          food:  Math.floor(( 80 + Math.floor(rand() * 120)) * def.lootMul),
        },
        shotTimer: Math.floor(rand() * 5),
        shotCooldown: 5, arrowRange: 6, arrowDamage: 18 + (tier - 1) * 4,
      });

      // Guards (count and type depend on tier)
      const guardOffsets = [{ dx: 2, dy: 0 }, { dx: -1, dy: 2 }, { dx: 2, dy: -1 }];
      let placed = 0;
      for (const off of guardOffsets) {
        if (placed >= def.guardCount) break;
        const gx = Math.max(1, Math.min(MAP_WIDTH - 2, sp.x + off.dx));
        const gy = Math.max(1, Math.min(MAP_HEIGHT - 2, sp.y + off.dy));
        if (this.map[gy]?.[gx] === T.WATER || this.map[gy]?.[gx] === T.MOUNTAIN) continue;
        this.shared.units.push({
          id: this._nextId(), type: def.guardType, x: gx, y: gy,
          owner: 'neutral', hp: Math.round(def.guardHp * (this.difficulty || 1.0)), maxHp: Math.round(def.guardHp * (this.difficulty || 1.0)), moves: [], reward: 15 + tier * 8,
          gatherState: 'idle', targetResource: null,
          inventory: 0, inventoryMax: 0, inventoryType: null,
          villageGuard: vid, homeX: sp.x, homeY: sp.y,
        });
        placed++;
      }

      // 1 house adjacent to village tower
      const houseOff = [{ dx: -2, dy: 0 }, { dx: 0, dy: 2 }, { dx: 2, dy: 1 }, { dx: -1, dy: -2 }];
      for (const off of houseOff) {
        const hx = sp.x + off.dx, hy = sp.y + off.dy;
        if (hx < 1 || hx >= MAP_WIDTH - 1 || hy < 1 || hy >= MAP_HEIGHT - 1) continue;
        if (this.map[hy]?.[hx] === T.WATER || this.map[hy]?.[hx] === T.MOUNTAIN) continue;
        this._addBuilding('house', hx, hy, 'neutral');
        break;
      }

      // 1 paysan wanders near the house
      const px = Math.max(1, Math.min(MAP_WIDTH - 2, sp.x - 2));
      const py = Math.max(1, Math.min(MAP_HEIGHT - 2, sp.y + 1));
      if (this.map[py]?.[px] !== T.WATER && this.map[py]?.[px] !== T.MOUNTAIN) {
        this.shared.units.push({
          id: this._nextId(), type: 'paysan', x: px, y: py,
          owner: 'neutral', hp: 30, maxHp: 30, moves: [], reward: 5,
          gatherState: 'idle', targetResource: null,
          inventory: 0, inventoryMax: 0, inventoryType: null,
          villageGuard: vid, homeX: sp.x, homeY: sp.y,
        });
      }
    }
    return villages;
  }

  _generateDungeons() {
    const DEFS = [
      {
        pos: { x: 25, y: 20 },
        artifact: { name: 'Cœur de Fer', stat: 'hp', value: 30 },
        rooms: [
          { name: 'Entrée sombre',       mobs: [{ type: 'loup', hp: 45 }, { type: 'sanglier', hp: 60 }] },
          { name: 'Couloir hanté',       mobs: [{ type: 'homme_armes', hp: 80 }, { type: 'archer', hp: 65 }, { type: 'loup', hp: 45 }] },
          { name: 'Gardien du Tombeau',  mobs: [{ type: 'garde_roi', hp: 200 }] },
        ],
      },
      {
        pos: { x: 52, y: 36 },
        artifact: { name: 'Lame Maudite', stat: 'atk', value: 8 },
        rooms: [
          { name: 'Antre des brigands',  mobs: [{ type: 'mercenaire', hp: 70 }, { type: 'compagnie_loup', hp: 75 }] },
          { name: 'Salle des gardes',    mobs: [{ type: 'chevalier', hp: 95 }, { type: 'homme_armes', hp: 80 }, { type: 'archer', hp: 65 }] },
          { name: 'Chef des Pillards',   mobs: [{ type: 'croise', hp: 220 }] },
        ],
      },
      {
        pos: { x: 32, y: 46 },
        artifact: { name: 'Égide Ancienne', stat: 'def', value: 6 },
        rooms: [
          { name: 'Crypte profonde',     mobs: [{ type: 'sanglier', hp: 65 }, { type: 'ours', hp: 90 }] },
          { name: 'Salle maudite',       mobs: [{ type: 'frere_epee', hp: 90 }, { type: 'croise', hp: 95 }] },
          { name: 'Seigneur de l\'Ombre', mobs: [{ type: 'chevalier', hp: 240 }] },
        ],
      },
    ];

    const dungeons = [];
    for (let i = 0; i < DEFS.length; i++) {
      const def = DEFS[i];
      const sp = this._findValidSpawn(def.pos.x, def.pos.y);
      if (Math.abs(sp.x - 8) + Math.abs(sp.y - 6) < 12) continue;
      if (Math.abs(sp.x - (MAP_WIDTH - 9)) + Math.abs(sp.y - (MAP_HEIGHT - 7)) < 12) continue;
      dungeons.push({
        id: `dungeon_${i}`, x: sp.x, y: sp.y,
        cleared: false, artifact: def.artifact, rooms: def.rooms,
      });
    }
    return dungeons;
  }

  _enterDungeon(dungeonId, unitId) {
    const dungeon = (this.shared.dungeons || []).find(d => d.id === dungeonId && !d.cleared);
    const hero = this.shared.units.find(u => u.id === unitId && u.owner !== 'enemy' && u.owner !== 'neutral');
    if (!dungeon || !hero || this.activeBattle) return null;
    return this._startDungeonRoom(hero, dungeon, 0);
  }

  _startDungeonRoom(hero, dungeon, roomIdx) {
    // Clean up leftover dungeon units from previous rooms
    this.shared.units = this.shared.units.filter(u => u.dungeonUnit !== dungeon.id);

    const room = dungeon.rooms[roomIdx];
    const newMobs = room.mobs.map(m => {
      const mob = {
        id: this._nextId(), type: m.type, x: dungeon.x, y: dungeon.y,
        owner: 'neutral', hp: m.hp, maxHp: m.hp, moves: [], reward: 0,
        gatherState: 'idle', targetResource: null,
        inventory: 0, inventoryMax: 0, inventoryType: null,
        dungeonUnit: dungeon.id,
      };
      this.shared.units.push(mob);
      return mob;
    });

    this.activeBattle = {
      playerTeamIds: [hero.id],
      enemyTeamIds: newMobs.map(m => m.id),
      currentPlayerIdx: 0, currentEnemyIdx: 0,
      turn: 'player',
      dungeon: { id: dungeon.id, room: roomIdx, heroId: hero.id },
      log: [`🏰 ${room.name} (salle ${roomIdx + 1}/${dungeon.rooms.length})`],
    };
    return { type: 'BATTLE_START', battle: this._battleSnapshot() };
  }

  // Called when a player unit moves onto a village tower tile
  _startVillageSiege(unit, village) {
    // Find an adjacent walkable tile
    const dirs = [{ dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }];
    let adjX = village.x, adjY = village.y;
    for (const d of dirs) {
      const nx = village.x + d.dx, ny = village.y + d.dy;
      if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT
          && this.map[ny][nx] !== T.WATER && this.map[ny][nx] !== T.MOUNTAIN) {
        adjX = nx; adjY = ny; break;
      }
    }
    unit.targetX = adjX; unit.targetY = adjY;
    unit.siegeTarget = village.id;
    unit.gatherState = 'idle'; unit.targetResource = null;
  }

  _captureVillage(village) {
    village.capturedBy = 'player';
    village.hp = 0;
    for (const [res, amt] of Object.entries(village.loot || {})) {
      this.shared.resources[res] = (this.shared.resources[res] || 0) + amt;
    }
    // Remove guards
    this.shared.units = this.shared.units.filter(u => u.villageGuard !== village.id);
    // Clear siege state
    for (const u of this.shared.units) {
      if (u.siegeTarget === village.id) u.siegeTarget = null;
    }
    // Transfer buildings inside the village's territory to the player
    this._transferVillageBuildings(village, 'player');

    // Spawn enemy counter-attack force — scales with village level
    this._spawnVillageCounterAttack(village);

    this._pendingEvents.push({ type: 'village_captured', villageId: village.id, loot: village.loot });
  }

  // Enemy reconquest force recaptures a village tower
  _reclaimVillage(village) {
    const TIER_DEF = {
      1: { towerHp: 200 }, 2: { towerHp: 280 }, 3: { towerHp: 350 },
      4: { towerHp: 440 }, 5: { towerHp: 550 },
    };
    const maxHp = TIER_DEF[village.level || 2]?.towerHp || 280;
    village.capturedBy = null;
    village.hp = Math.floor(maxHp * 0.4); // restored to 40% HP
    // Remove reconquest units targeting this village
    this.shared.units = this.shared.units.filter(u => u.reconquestTarget !== village.id);
    // Transfer buildings back to neutral
    this._transferVillageBuildings(village, 'neutral');
    this._pendingEvents.push({ type: 'village_reclaimed', villageId: village.id });
  }

  // Spawn enemy units near a captured village to retake it
  _spawnVillageCounterAttack(village) {
    const tier = village.level || 2;
    const COUNTER_UNIT = {
      1: 'homme_armes', 2: 'homme_armes', 3: 'frere_epee',
      4: 'croise',       5: 'garde_roi',
    };
    const count      = 2 + Math.floor(tier / 2); // 2-4 units
    const unitType   = COUNTER_UNIT[tier] || 'homme_armes';
    const stats      = UNIT_BASE_STATS[unitType] || UNIT_BASE_STATS['homme_armes'];
    const spawnOffsets = [
      { dx: -5, dy: 0 }, { dx: 5, dy: 0 },
      { dx: 0, dy: -5 }, { dx: 0, dy: 5 },
      { dx: -4, dy: 3 }, { dx: 4, dy: -3 },
    ];

    let placed = 0;
    for (const off of spawnOffsets) {
      if (placed >= count) break;
      const sx = village.x + off.dx;
      const sy = village.y + off.dy;
      if (sx < 1 || sx >= MAP_WIDTH - 1 || sy < 1 || sy >= MAP_HEIGHT - 1) continue;
      if (this.map[sy]?.[sx] === T.WATER || this.map[sy]?.[sx] === T.MOUNTAIN) continue;
      if (this.shared.units.find(u => u.x === sx && u.y === sy)) continue;

      this.shared.units.push({
        id: this._nextId(), type: unitType,
        x: sx, y: sy, owner: 'enemy',
        hp: stats.maxHp, maxHp: stats.maxHp,
        moves: stats.moves.slice(), reward: 0,
        gatherState: 'idle', targetResource: null,
        inventory: 0, inventoryMax: 0, inventoryType: null,
        // Tag this unit as a reconquest force targeting this village
        reconquestTarget: village.id,
        targetX: village.x, targetY: village.y,
      });
      placed++;
    }
  }

  // Transfer ownership of buildings in this village's radius
  // newOwner: 'player' (captured) or 'neutral' (recaptured by enemy, future use)
  _transferVillageBuildings(village, newOwner) {
    const VILLAGE_R = 16;
    for (const bld of this.shared.buildings) {
      if (bld.owner === 'enemy') continue; // enemy buildings stay as-is
      const dist = Math.abs(bld.x - village.x) + Math.abs(bld.y - village.y);
      if (dist <= VILLAGE_R) {
        // Neutral village buildings → transfer to player; player buildings nearby stay as-is
        if (bld.owner === 'neutral' || (newOwner === 'neutral' && bld.owner === 'shared')) {
          bld.owner = newOwner === 'player' ? 'shared' : 'neutral';
        }
      }
    }
  }

  // Each tick: units adjacent to their siege target attack the tower
  tickVillageSiege() {
    let changed = false;
    if (!this.shared.villages?.length) return false;
    for (const unit of this.shared.units) {
      if (!unit.siegeTarget) continue;
      const village = this.shared.villages.find(v => v.id === unit.siegeTarget);
      if (!village || village.capturedBy) { unit.siegeTarget = null; continue; }
      if (Math.abs(unit.x - village.x) + Math.abs(unit.y - village.y) > 1) continue;
      const stats = UNIT_BASE_STATS[unit.type] || HERO_BASE_STATS[unit.type] || UNIT_BASE_STATS['homme_armes'];
      const atk = Math.floor((stats.atk || 15) * (0.7 + Math.random() * 0.6));
      village.hp = Math.max(0, village.hp - atk);
      changed = true;
      if (village.hp <= 0) { this._captureVillage(village); unit.siegeTarget = null; }
    }
    return changed;
  }

  // Each tick: uncaptured village towers shoot at nearest player unit in range
  tickVillageTowers() {
    let changed = false;
    if (!this.shared.villages?.length) return false;
    const playerUnits = this.shared.units.filter(u => u.owner !== 'enemy' && u.owner !== 'neutral');
    for (const village of this.shared.villages) {
      if (village.capturedBy) continue;
      village.shotTimer = (village.shotTimer || 0) + 1;
      if (village.shotTimer < village.shotCooldown) continue;
      village.shotTimer = 0;
      let nearest = null, nearestDist = Infinity;
      for (const u of playerUnits) {
        const d = Math.abs(u.x - village.x) + Math.abs(u.y - village.y);
        if (d <= village.arrowRange && d < nearestDist) { nearest = u; nearestDist = d; }
      }
      if (nearest) {
        nearest.hp = Math.max(1, nearest.hp - village.arrowDamage);
        this._pendingEvents.push({
          type: 'arrow_shot',
          fromX: village.x, fromY: village.y,
          toX: nearest.x, toY: nearest.y,
        });
        changed = true;
      }
    }
    return changed;
  }

  // ─── Neutral mobs ─────────────────────────────────────────────────────────

  _spawnNeutralMobs(rand) {
    const mobDefs = [
      { type: 'loup',     hp: 25, reward: 10 },
      { type: 'sanglier', hp: 40, reward: 18 },
      { type: 'ours',     hp: 65, reward: 30 },
    ];
    let placed = 0, attempts = 0;
    while (placed < 18 && attempts < 400) {
      attempts++;
      const x = Math.floor(rand() * MAP_WIDTH);
      const y = Math.floor(rand() * MAP_HEIGHT);
      if (this.map[y][x] === T.WATER || this.map[y][x] === T.MOUNTAIN) continue;
      if (Math.abs(x - 5) + Math.abs(y - 5) < 12) continue;
      if (Math.abs(x - (MAP_WIDTH - 6)) + Math.abs(y - (MAP_HEIGHT - 6)) < 12) continue;
      if (Math.abs(x - this.enemy.campX) + Math.abs(y - this.enemy.campY) < 10) continue;
      const mob = mobDefs[Math.floor(rand() * mobDefs.length)];
      this.shared.units.push({
        id: this._nextId(), type: mob.type, x, y, owner: 'neutral',
        hp: mob.hp, maxHp: mob.hp, moves: [],
        reward: mob.reward,
        gatherState: 'idle', targetResource: null,
        inventory: 0, inventoryMax: 0, inventoryType: null,
      });
      placed++;
    }
  }

  tickNeutralMobs() {
    const VILLAGE_AGGRO_RADIUS = 8;
    let changed = false;
    const playerUnits = this.shared.units.filter(u => u.owner !== 'enemy' && u.owner !== 'neutral');

    for (const unit of this.shared.units.filter(u => u.owner === 'neutral')) {
      // ── Village guards: proximity aggro ──────────────────────────────────────
      if (unit.villageGuard) {
        const village = (this.shared.villages || []).find(v => v.id === unit.villageGuard);
        if (village?.capturedBy) continue; // village already taken — guards removed anyway

        // Find nearest player unit within aggro radius of the village centre
        let nearestPlayer = null, nearestDist = Infinity;
        for (const p of playerUnits) {
          const d = Math.abs(p.x - unit.homeX) + Math.abs(p.y - unit.homeY);
          if (d <= VILLAGE_AGGRO_RADIUS && d < nearestDist) { nearestPlayer = p; nearestDist = d; }
        }

        if (nearestPlayer) {
          unit.aggroMode = true;
          if (!this.activeBattle) {
            const prevX = unit.x, prevY = unit.y;
            this._stepToward(unit, nearestPlayer.x, nearestPlayer.y);
            if (unit.x !== prevX || unit.y !== prevY) changed = true;
            // Collision with a player unit → trigger battle
            const hit = playerUnits.find(p => p.x === unit.x && p.y === unit.y);
            if (hit) {
              unit.x = prevX; unit.y = prevY; // keep positions distinct
              const result = this._startBattle(hit, unit);
              if (result) this._pendingEvents.push({ type: 'battle_start', battle: result.battle });
              changed = true;
            }
          }
        } else {
          unit.aggroMode = false;
          // Return to patrol zone if too far from home
          const distHome = Math.abs(unit.x - unit.homeX) + Math.abs(unit.y - unit.homeY);
          if (distHome > 4) {
            const prevX = unit.x, prevY = unit.y;
            this._stepToward(unit, unit.homeX, unit.homeY);
            if (unit.x !== prevX || unit.y !== prevY) changed = true;
          } else if (Math.random() < 0.15) {
            const dirs = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];
            const { dx, dy } = dirs[Math.floor(Math.random() * 4)];
            const nx = unit.x + dx, ny = unit.y + dy;
            const dHome = Math.abs(nx - unit.homeX) + Math.abs(ny - unit.homeY);
            if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT
              && this.map[ny][nx] !== T.WATER && this.map[ny][nx] !== T.MOUNTAIN
              && dHome <= 4
              && !this.shared.units.find(u => u !== unit && u.x === nx && u.y === ny)) {
              unit.x = nx; unit.y = ny; changed = true;
            }
          }
        }
        continue;
      }

      // ── Boss: always aggro, very large radius ────────────────────────────────
      if (unit.isBoss) {
        if (!this.activeBattle) {
          let nearestPlayer = null, nearestDist = Infinity;
          for (const p of playerUnits) {
            const d = Math.abs(p.x - unit.x) + Math.abs(p.y - unit.y);
            if (d < nearestDist) { nearestPlayer = p; nearestDist = d; }
          }
          if (nearestPlayer) {
            const prevX = unit.x, prevY = unit.y;
            this._stepToward(unit, nearestPlayer.x, nearestPlayer.y);
            if (unit.x !== prevX || unit.y !== prevY) changed = true;
            const hit = playerUnits.find(p => p.x === unit.x && p.y === unit.y);
            if (hit) {
              unit.x = prevX; unit.y = prevY;
              const result = this._startBattle(hit, unit);
              if (result) this._pendingEvents.push({ type: 'battle_start', battle: result.battle });
              changed = true;
            }
          }
        }
        continue;
      }

      // ── Regular neutral mobs: random wander ──────────────────────────────────
      if (Math.random() < 0.15) {
        const dirs = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];
        const { dx, dy } = dirs[Math.floor(Math.random() * 4)];
        const nx = unit.x + dx, ny = unit.y + dy;
        if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT
          && this.map[ny][nx] !== T.WATER && this.map[ny][nx] !== T.MOUNTAIN
          && !this.shared.units.find(u => u !== unit && u.x === nx && u.y === ny)) {
          unit.x = nx; unit.y = ny; changed = true;
        }
      }
    }
    return changed;
  }

  // ─── Enemy AI ─────────────────────────────────────────────────────────────

  _spawnEnemyClanUnit() {
    const pool = ['homme_armes', 'archer', 'mercenaire', 'compagnie_loup'];
    const type = pool[Math.floor(Math.random() * pool.length)];
    const cx = this.enemy.campX + 1 + Math.floor(Math.random() * 3 - 1);
    const cy = this.enemy.campY + 1 + Math.floor(Math.random() * 3 - 1);
    const x = Math.max(0, Math.min(MAP_WIDTH - 1, cx));
    const y = Math.max(0, Math.min(MAP_HEIGHT - 1, cy));
    if (this.map[y]?.[x] === T.WATER || this.map[y]?.[x] === T.MOUNTAIN) return;
    this._addUnit(type, x, y, 'enemy');
  }

  tickEnemyAI() {
    let changed = false;
    const enemies       = this.shared.units.filter(u => u.owner === 'enemy');
    const playerUnits   = this.shared.units.filter(u => u.owner !== 'enemy' && u.owner !== 'neutral');
    const playerBldgs   = this.shared.buildings.filter(b => b.owner === 'shared');

    // ── Aggro detection ────────────────────────────────────────────────────────
    let aggroGain = 0;
    outer:
    for (const e of enemies) {
      for (const p of playerUnits) {
        if (Math.abs(e.x - p.x) + Math.abs(e.y - p.y) <= 12) { aggroGain = 8; break outer; }
      }
    }
    this.enemy.aggroLevel = Math.max(0, Math.min(100, this.enemy.aggroLevel + aggroGain - 1));
    const isAggro = this.enemy.aggroLevel >= 30;

    // ── Reconquest units: march toward captured village & attack tower ────────
    const capturedVillages = (this.shared.villages || []).filter(v => v.capturedBy);
    for (const unit of enemies) {
      if (!unit.reconquestTarget) continue;
      const village = capturedVillages.find(v => v.id === unit.reconquestTarget);
      if (!village) { unit.reconquestTarget = null; continue; } // village no longer captured

      const dist = Math.abs(unit.x - village.x) + Math.abs(unit.y - village.y);
      if (dist > 1) {
        // March toward tower
        this._stepTowardEnemy(unit, village.x, village.y);
        changed = true;
      } else {
        // Adjacent to tower — attack it
        const dmg = 20 + Math.floor(Math.random() * 15);
        village.hp = Math.max(0, (village.hp || 0) - dmg);
        changed = true;
        if (village.hp <= 0) {
          this._reclaimVillage(village);
        } else {
          // Trigger battle between this reconquest unit and nearby player units
          if (!this.activeBattle) {
            const nearbyPlayers = this.shared.units.filter(u =>
              u.owner !== 'enemy' && u.owner !== 'neutral' &&
              Math.abs(u.x - village.x) + Math.abs(u.y - village.y) <= 5
            );
            if (nearbyPlayers.length > 0) {
              const result = this._startBattle(nearbyPlayers[0], unit);
              if (result) this._pendingEvents.push({ type: 'battle_start', battle: result.battle });
            }
          }
        }
      }
    }

    // ── Movement ──────────────────────────────────────────────────────────────
    for (const unit of enemies) {
      if (unit.reconquestTarget) continue; // handled above
      if (isAggro && playerBldgs.length > 0) {
        // Find nearest player building
        let nearestBld = playerBldgs[0], nearestDist = Infinity;
        for (const b of playerBldgs) {
          const d = Math.abs(b.x - unit.x) + Math.abs(b.y - unit.y);
          if (d < nearestDist) { nearestBld = b; nearestDist = d; }
        }
        const tx = nearestBld.type === 'wall' ? nearestBld.x : nearestBld.x + 1;
        const ty = nearestBld.type === 'wall' ? nearestBld.y : nearestBld.y + 1;
        if (nearestDist > 1) { this._stepTowardEnemy(unit, tx, ty); changed = true; }
      } else {
        // Patrol: stay near camp
        const campCX = this.enemy.campX + 1, campCY = this.enemy.campY + 1;
        const distToCamp = Math.abs(unit.x - campCX) + Math.abs(unit.y - campCY);
        if (distToCamp > 8) {
          this._stepTowardEnemy(unit, campCX, campCY); changed = true;
        } else if (Math.random() < 0.25) {
          const dirs = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];
          const { dx, dy } = dirs[Math.floor(Math.random() * 4)];
          const nx = unit.x + dx, ny = unit.y + dy;
          if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT
            && this.map[ny][nx] !== T.WATER && this.map[ny][nx] !== T.MOUNTAIN
            && !this.shared.buildings.find(b => b.type === 'wall' && b.x === nx && b.y === ny && !b.underConstruction)) {
            unit.x = nx; unit.y = ny; changed = true;
          }
        }
      }
    }

    // ── Enemies deal damage to adjacent player buildings ──────────────────────
    for (const e of enemies) {
      for (const b of playerBldgs) {
        const bx = b.type === 'wall' ? b.x : b.x + 1;
        const by = b.type === 'wall' ? b.y : b.y + 1;
        if (Math.abs(e.x - bx) + Math.abs(e.y - by) <= 1) {
          b.hp = Math.max(0, b.hp - 12);
          if (b.hp <= 0) this.shared.buildings = this.shared.buildings.filter(x => x.id !== b.id);
          changed = true; break;
        }
      }
    }

    // ── Player units dealing with enemy buildings (destroy_buildings quest) ────
    const enemyBldgs = this.shared.buildings.filter(b => b.owner === 'enemy');
    for (const b of enemyBldgs) {
      if (b.hp <= 0) {
        this._updateQuestProgressAll('destroy_buildings', null);
        this.shared.buildings = this.shared.buildings.filter(x => x.id !== b.id);
        changed = true;
      }
    }

    // ── Spawn new enemy units (scales with time; blocked during truce) ────────
    this.enemy.buildTimer++;
    const maxEnemies = Math.min(4 + Math.floor(this.enemy.buildTimer / 80), 14);
    if (!this.shared.truce && enemies.length < maxEnemies && this.enemy.buildTimer % 22 === 0) {
      this._spawnEnemyClanUnit(); changed = true;
    }
    if (this.shared.truce) { this.enemy.aggroLevel = 0; }

    return changed;
  }

  // ─── NPC / Quest ──────────────────────────────────────────────────────────

  _interactNpc(npcId, socketId) {
    const npc = this.shared.npcs.find(n => n.id === npcId);
    if (!npc) return null;
    // Temporary mage: grant XP to hero and disappear
    if (npc.temporary && !npc.questCompleted) {
      const hero = this.shared.units.find(u => u.isHero && u.heroOwner === socketId);
      if (hero) {
        hero.xp = (hero.xp || 0) + (npc.xpReward || 40);
        while (hero.level < XP_PER_LEVEL.length - 1 && hero.xp >= XP_PER_LEVEL[hero.level + 1]) {
          hero.level++;
          hero.maxHp += 15;
          hero.hp = Math.min(hero.hp + 15, hero.maxHp);
        }
      }
      npc.questCompleted = true;
      this._pendingEvents.push({
        type: 'random_event',
        message: `🧙 Le mage itinérant offre +${npc.xpReward} XP à votre héros et disparaît.`,
        color: 0xaa55ff,
      });
      return { type: 'STATE_UPDATE', shared: this.shared };
    }
    // Find this player's hero
    const hero = this.shared.units.find(u => u.isHero && u.heroOwner === socketId);
    return { type: 'NPC_INTERACT', npc, heroId: hero?.id };
  }

  _acceptQuest(npcId, heroId) {
    const npc = this.shared.npcs.find(n => n.id === npcId);
    const hero = this.shared.units.find(u => u.id === heroId && u.isHero);
    if (!npc || !hero || npc.questAccepted || npc.questCompleted) return null;
    npc.questAccepted = true;
    npc.questProgress = 0;
    hero.activeQuest = npc.quest.id;
    hero.questProgress = 0;
    return { type: 'STATE_UPDATE', shared: this.shared };
  }

  // Progress quest for a specific hero (mob kill with known killer)
  _updateQuestProgress(hero, questType, target) {
    if (!hero.isHero || !hero.activeQuest) return;
    const npc = this.shared.npcs.find(n => n.quest.id === hero.activeQuest);
    if (!npc || npc.questCompleted) return;
    const q = npc.quest;
    if (q.type !== questType) return;
    if (target && q.target && q.target !== target) return;
    npc.questProgress = (npc.questProgress || 0) + 1;
    hero.questProgress = npc.questProgress;
    if (npc.questProgress >= q.needed) this._completeQuest(hero, npc);
  }

  // Progress quest for all heroes (build / train / destroy — any hero may benefit)
  _updateQuestProgressAll(questType, target) {
    for (const unit of this.shared.units) {
      if (!unit.isHero || !unit.activeQuest) continue;
      this._updateQuestProgress(unit, questType, target);
    }
  }

  _completeQuest(hero, npc) {
    npc.questCompleted = true;
    hero.activeQuest = null;
    // XP
    hero.xp = (hero.xp || 0) + npc.quest.xpReward;
    // Level up
    while (hero.level < XP_PER_LEVEL.length - 1 && hero.xp >= XP_PER_LEVEL[hero.level + 1]) {
      hero.level++;
      hero.maxHp += 15;
      hero.hp = Math.min(hero.hp + 15, hero.maxHp);
    }
    // Resources
    for (const [res, amt] of Object.entries(npc.quest.resReward || {})) {
      this.shared.resources[res] = (this.shared.resources[res] || 0) + amt;
    }
    // Equipment slot
    if (npc.quest.equipReward) {
      const slot = EQUIP_SLOT_MAP[npc.quest.equipReward] || 'weapon';
      hero.equipment = hero.equipment || {};
      hero.equipment[slot] = npc.quest.equipReward;
    }
  }

  // ─── Battle ───────────────────────────────────────────────────────────────

  _startBattle(triggerPlayer, triggerEnemy) {
    const RANGE = 5;
    const cx = (triggerPlayer.x + triggerEnemy.x) / 2;
    const cy = (triggerPlayer.y + triggerEnemy.y) / 2;
    const inRange = (u) => Math.abs(u.x - cx) + Math.abs(u.y - cy) <= RANGE;

    const playerTeamIds = [
      triggerPlayer.id,
      ...this.shared.units.filter(u => u.owner !== 'enemy' && u.owner !== 'neutral'
        && u.id !== triggerPlayer.id && inRange(u)).map(u => u.id),
    ];
    // Nearby neutral units join the enemy team only when the trigger is neutral (e.g. village guards)
    const enemyIsNeutral = triggerEnemy.owner === 'neutral';
    const enemyTeamIds = [
      triggerEnemy.id,
      ...this.shared.units.filter(u =>
        (u.owner === 'enemy' || (enemyIsNeutral && u.owner === 'neutral'))
        && u.id !== triggerEnemy.id && inRange(u)).map(u => u.id),
    ];

    this.activeBattle = {
      playerTeamIds, enemyTeamIds,
      currentPlayerIdx: 0, currentEnemyIdx: 0,
      turn: 'player',
      log: [`⚔ ${playerTeamIds.length} allié(s) contre ${enemyTeamIds.length} ennemi(s) !`],
    };
    return { type: 'BATTLE_START', battle: this._battleSnapshot() };
  }

  _battleSnapshot() {
    const b = this.activeBattle;
    const resolve = ids => ids.map(id => this.shared.units.find(u => u.id === id)).filter(Boolean);
    return {
      playerTeam: resolve(b.playerTeamIds),
      enemyTeam:  resolve(b.enemyTeamIds),
      currentPlayerIdx: b.currentPlayerIdx,
      currentEnemyIdx:  b.currentEnemyIdx,
      log: b.log,
    };
  }

  _battleMove(moveIndex) {
    if (!this.activeBattle) return null;
    const b = this.activeBattle;

    const playerUnit = this.shared.units.find(u => u.id === b.playerTeamIds[b.currentPlayerIdx]);
    const enemyUnit  = this.shared.units.find(u => u.id === b.enemyTeamIds[b.currentEnemyIdx]);
    if (!playerUnit || !enemyUnit) return null;

    const pStats = UNIT_BASE_STATS[playerUnit.type] || UNIT_BASE_STATS['homme_armes'];
    const eStats = UNIT_BASE_STATS[enemyUnit.type]  || UNIT_BASE_STATS['homme_armes'];

    const playerMove = pStats.moves[moveIndex] || pStats.moves[0];
    const enemyMove  = eStats.moves[Math.floor(Math.random() * eStats.moves.length)];
    const log = [];

    // Player attacks
    const pDmg = this._calcDamage(playerMove, pStats, eStats, enemyUnit.type, playerUnit, enemyUnit);
    enemyUnit.hp = Math.max(0, enemyUnit.hp - pDmg);
    log.push(`${playerMove.name} inflige ${pDmg} dégâts à ${enemyUnit.type} !`);

    if (enemyUnit.hp <= 0) {
      log.push(`${enemyUnit.type} est vaincu !`);
      // Neutral mob reward (mobs and village guards)
      if (enemyUnit.owner === 'neutral') {
        const nStats = UNIT_BASE_STATS[enemyUnit.type];
        const reward = nStats?.reward || enemyUnit.reward || 10;
        const rTypes = ['wood', 'stone', 'gold', 'food'];
        const rType  = rTypes[Math.floor(Math.random() * rTypes.length)];
        this.shared.resources[rType] = (this.shared.resources[rType] || 0) + reward;
        log.push(`💰 +${reward} ${rType} !`);
        if (playerUnit.isHero) this._updateQuestProgress(playerUnit, 'kill_mobs', enemyUnit.type);
      }
      this.shared.units = this.shared.units.filter(u => u.id !== enemyUnit.id);
      b.currentEnemyIdx++;
      const nextEnemy = this.shared.units.find(u => u.id === b.enemyTeamIds[b.currentEnemyIdx]);
      if (!nextEnemy) {
        // ── Dungeon room cleared → advance to next room or complete ────────────
        if (b.dungeon) {
          const { id: dungeonId, room: roomIdx, heroId } = b.dungeon;
          const dungeon = (this.shared.dungeons || []).find(d => d.id === dungeonId);
          const hero = this.shared.units.find(u => u.id === heroId);
          const nextRoom = roomIdx + 1;
          if (dungeon && nextRoom < dungeon.rooms.length && hero) {
            log.push(`✅ Salle ${roomIdx + 1} terminée !`);
            b.log = log;
            const result = this._startDungeonRoom(hero, dungeon, nextRoom);
            return { type: 'DUNGEON_NEXT_ROOM', room: nextRoom, battle: result.battle };
          }
          if (dungeon) {
            dungeon.cleared = true;
            // Apply artifact permanently to hero
            if (hero) {
              hero.artifacts = [...(hero.artifacts || []), dungeon.artifact];
              if (dungeon.artifact.stat === 'hp') {
                hero.maxHp += dungeon.artifact.value;
                hero.hp = hero.maxHp;
              }
            }
            log.push(`✨ ${dungeon.artifact.name} obtenu !`);
          }
          this.activeBattle = null;
          this.shared.units = this.shared.units.filter(u => !u.dungeonUnit);
          for (const u of this.shared.units) {
            if (u.owner !== 'enemy' && u.owner !== 'neutral') u.hp = u.maxHp;
          }
          return { type: 'BATTLE_END', winner: 'player', log, dungeonComplete: dungeon?.artifact, shared: this.shared };
        }
        // ── Normal battle win ──────────────────────────────────────────────────
        this.activeBattle = null;
        for (const u of this.shared.units) {
          if (u.owner !== 'enemy' && u.owner !== 'neutral') u.hp = u.maxHp;
        }
        return { type: 'BATTLE_END', winner: 'player', log, shared: this.shared };
      }
      log.push(`${nextEnemy.type} entre en combat !`);
      b.log = log;
      return { type: 'BATTLE_UPDATE', battle: this._battleSnapshot(), shared: this.shared };
    }

    // Enemy retaliates
    const eDmg = this._calcDamage(enemyMove, eStats, pStats, playerUnit.type, enemyUnit, playerUnit);
    playerUnit.hp = Math.max(0, playerUnit.hp - eDmg);
    log.push(`${enemyUnit.type} utilise ${enemyMove.name} — ${eDmg} dégâts !`);

    if (playerUnit.hp <= 0) {
      log.push(`${playerUnit.type} est vaincu !`);
      // Citizen linked to this unit dies with them
      const deadCitIdx = this.shared.population.findIndex(c => c.unitId === playerUnit.id);
      if (deadCitIdx !== -1) this.shared.population.splice(deadCitIdx, 1);
      this.shared.units = this.shared.units.filter(u => u.id !== playerUnit.id);
      b.currentPlayerIdx++;
      const nextPlayer = this.shared.units.find(u => u.id === b.playerTeamIds[b.currentPlayerIdx]);
      if (!nextPlayer) {
        this.activeBattle = null;
        for (const u of this.shared.units) {
          if (u.owner === 'enemy') u.hp = u.maxHp;
        }
        return { type: 'BATTLE_END', winner: 'enemy', log, shared: this.shared };
      }
      log.push(`${nextPlayer.type} prend le relais !`);
    }

    b.log = log;
    return { type: 'BATTLE_UPDATE', battle: this._battleSnapshot(), shared: this.shared };
  }

  _calcDamage(move, atkStats, defStats, defUnitType, atkUnit = null, defUnit = null) {
    if (!move || !move.power) return 0;
    let atk = atkStats.atk;
    let def = defStats.def;
    for (const art of (atkUnit?.artifacts || [])) { if (art.stat === 'atk') atk += art.value; }
    for (const art of (defUnit?.artifacts || [])) { if (art.stat === 'def') def += art.value; }
    // Nuit de sang: enemy units deal +20% dmg
    if (this.shared.nightOfBlood > 0 && (atkUnit?.owner === 'enemy' || atkUnit?.owner === 'neutral')) atk *= 1.2;
    // Enemy damage scales with difficulty (base × difficulty, min ×1)
    if (atkUnit?.owner === 'enemy') atk *= Math.max(1.0, this.difficulty || 1.0);
    const base = move.power * (atk / Math.max(1, def));
    const effectiveness = TYPE_CHART[move.moveType]?.[UNIT_MOVE_TYPE[defUnitType]] ?? 1;
    return Math.round(base * effectiveness * (0.85 + Math.random() * 0.15));
  }
}

// ── Game Data ──────────────────────────────────────────────────────────────────

const TYPE_CHART = {
  LOURD:     { LOURD: 1,   LEGER: 1.5, CAVALERIE: 0.5, MAGIE: 0.5 },
  LEGER:     { LOURD: 0.7, LEGER: 1,   CAVALERIE: 1,   MAGIE: 1.2 },
  CAVALERIE: { LOURD: 1.5, LEGER: 1,   CAVALERIE: 1,   MAGIE: 0.7 },
  MAGIE:     { LOURD: 1.5, LEGER: 0.8, CAVALERIE: 1.2, MAGIE: 1   },
};

// ── Unit movement speed multipliers (tiles per tick, fractional accumulator) ──
const UNIT_SPEED = {
  // Heroes × 1.8
  roi_guerrier: 1.8, chasseresse: 1.8, mage_arcane: 1.8,
  paladin: 1.8, assassin: 1.8, necromancien: 1.8,
  // Attack troops × 1.4
  homme_armes: 1.4, archer: 1.4, chevalier: 1.4,
  garde_roi: 1.4, croise: 1.4, mercenaire: 1.4,
  compagnie_loup: 1.4, frere_epee: 1.4, banniere_rouge: 1.4,
  // Gatherer — unchanged
  paysan: 1.0,
  // Boss — slow but relentless
  tyran: 1.2,
};

const UNIT_MOVE_TYPE = {
  chevalier: 'CAVALERIE', garde_roi: 'LOURD', homme_armes: 'LOURD',
  archer: 'LEGER', croise: 'LOURD', mercenaire: 'LEGER',
  compagnie_loup: 'LEGER', frere_epee: 'LOURD', paysan: 'LEGER', tyran: 'LOURD',
  // Neutral mobs
  loup: 'LEGER', sanglier: 'CAVALERIE', ours: 'LOURD',
  // Heroes
  roi_guerrier: 'LOURD', chasseresse: 'LEGER', mage_arcane: 'MAGIE',
  paladin: 'LOURD', assassin: 'LEGER', necromancien: 'MAGIE',
};

const UNIT_BASE_STATS = {
  chevalier: {
    maxHp: 120, atk: 35, def: 25, spd: 18,
    moves: [
      { name: 'Charge de Cavalerie', moveType: 'CAVALERIE', power: 40 },
      { name: "Coup d'Épée",          moveType: 'LOURD',     power: 30 },
      { name: 'Piétinement',          moveType: 'CAVALERIE', power: 25 },
      { name: 'Garde Noble',          moveType: 'LOURD',     power: 10 },
    ],
  },
  garde_roi: {
    maxHp: 150, atk: 30, def: 35, spd: 12,
    moves: [
      { name: 'Frappe Royale',        moveType: 'LOURD', power: 38 },
      { name: 'Bouclier du Roi',      moveType: 'LOURD', power: 5  },
      { name: 'Lame Sacrée',          moveType: 'MAGIE', power: 28 },
      { name: 'Formation Défensive',  moveType: 'LOURD', power: 8  },
    ],
  },
  homme_armes: {
    maxHp: 100, atk: 28, def: 22, spd: 15,
    moves: [
      { name: 'Coup de Lance', moveType: 'LOURD', power: 32 },
      { name: 'Mêlée',         moveType: 'LOURD', power: 25 },
      { name: 'Bousculade',    moveType: 'LOURD', power: 20 },
      { name: 'Riposte',       moveType: 'LOURD', power: 15 },
    ],
  },
  archer: {
    maxHp: 75, atk: 32, def: 14, spd: 22,
    moves: [
      { name: 'Tir Rapide',       moveType: 'LEGER', power: 28 },
      { name: 'Pluie de Flèches', moveType: 'LEGER', power: 22 },
      { name: 'Flèche Percante',  moveType: 'LEGER', power: 36 },
      { name: 'Tir à la Volée',   moveType: 'LEGER', power: 18 },
    ],
  },
  croise: {
    maxHp: 130, atk: 32, def: 28, spd: 13,
    moves: [
      { name: 'Frappe Sainte',   moveType: 'MAGIE', power: 38 },
      { name: 'Épée de Lumière', moveType: 'MAGIE', power: 32 },
      { name: 'Jugement Divin',  moveType: 'MAGIE', power: 45 },
      { name: 'Prière Guerrière',moveType: 'LOURD', power: 10 },
    ],
  },
  mercenaire: {
    maxHp: 90, atk: 36, def: 16, spd: 20,
    moves: [
      { name: 'Lame Sombre',   moveType: 'LEGER', power: 35 },
      { name: 'Coup Bas',      moveType: 'LEGER', power: 28 },
      { name: 'Double Frappe', moveType: 'LEGER', power: 20 },
      { name: 'Embuscade',     moveType: 'LEGER', power: 40 },
    ],
  },
  compagnie_loup: {
    maxHp: 85, atk: 30, def: 18, spd: 24,
    moves: [
      { name: 'Morsure du Loup', moveType: 'LEGER',     power: 30 },
      { name: 'Ruée',            moveType: 'CAVALERIE',  power: 28 },
      { name: "Croc d'Acier",   moveType: 'LEGER',     power: 36 },
      { name: 'Hurlement',       moveType: 'LEGER',     power: 12 },
    ],
  },
  frere_epee: {
    maxHp: 110, atk: 33, def: 24, spd: 16,
    moves: [
      { name: "Serment de l'Épée",    moveType: 'LOURD', power: 35 },
      { name: "Fraternité d'Armes",   moveType: 'LOURD', power: 28 },
      { name: 'Tranchant',            moveType: 'LOURD', power: 32 },
      { name: 'Parade',               moveType: 'LOURD', power: 8  },
    ],
  },
  paysan: {
    maxHp: 55, atk: 12, def: 8, spd: 14,
    moves: [
      { name: 'Coup de Faux',     moveType: 'LEGER', power: 14 },
      { name: 'Lancer de Pierre', moveType: 'LEGER', power: 10 },
      { name: 'Bâton Rustique',   moveType: 'LEGER', power: 12 },
      { name: 'Fuite !',          moveType: 'LEGER', power: 0  },
    ],
  },
  // ── Neutral mobs ───────────────────────────────────────────────────────────
  loup: {
    maxHp: 25, atk: 15, def: 5, spd: 20, reward: 10,
    moves: [{ name: 'Morsure', moveType: 'LEGER', power: 12 }],
  },
  sanglier: {
    maxHp: 40, atk: 18, def: 10, spd: 14, reward: 18,
    moves: [{ name: 'Charge Sauvage', moveType: 'CAVALERIE', power: 16 }],
  },
  ours: {
    maxHp: 65, atk: 22, def: 15, spd: 10, reward: 30,
    moves: [{ name: 'Griffe', moveType: 'LOURD', power: 20 }],
  },
  tyran: {
    maxHp: 600, atk: 50, def: 40, spd: 10, reward: 300,
    moves: [
      { name: 'Rugissement Dévastateur', moveType: 'LOURD',     power: 60 },
      { name: 'Frappe Titanesque',       moveType: 'LOURD',     power: 50 },
      { name: 'Griffe du Tyran',         moveType: 'CAVALERIE', power: 45 },
      { name: 'Terreur Absolue',         moveType: 'MAGIE',     power: 55 },
    ],
  },
};

const BUILDING_COSTS = {
  house:       { wood: 50 },
  barracks:    { wood: 80, stone: 60, gold: 20 },
  farm:        { wood: 40 },
  mine:        { wood: 60, stone: 40 },
  lumber_mill: { wood: 50, stone: 30 },
  market:      { wood: 60, stone: 40, gold: 30 },
  tower:       { wood: 40, stone: 80, gold: 20 },
  church:      { wood: 70, stone: 80, gold: 40 },
  stable:      { wood: 80, stone: 30, food: 40 },
  wall:        { stone: 15, wood: 5 },
};

const UNIT_COSTS = {
  paysan:         { food: 50 },
  homme_armes:    { food: 60, gold: 40 },
  archer:         { wood: 20, food: 50, gold: 30 },
  chevalier:      { food: 80, gold: 80 },
  croise:         { food: 70, gold: 70 },
  mercenaire:     { gold: 100 },
  compagnie_loup: { food: 60, gold: 50 },
  frere_epee:     { food: 65, gold: 55 },
};

// ── Hero base stats ───────────────────────────────────────────────────────────
const HERO_BASE_STATS = {
  roi_guerrier: {
    maxHp: 220, atk: 42, def: 38, spd: 14,
    moves: [
      { name: 'Frappe Royale',  moveType: 'LOURD', power: 45, desc: 'Coup de majesté dévastateur.' },
      { name: 'Décret Martial', moveType: 'LOURD', power: 35, desc: 'Attaque commandée.' },
      { name: 'Garde du Trône', moveType: 'LOURD', power: 15, desc: 'Position défensive.' },
      { name: 'Exécution',      moveType: 'LOURD', power: 60, desc: 'Frappe finale puissante.' },
    ],
    startEquip: { weapon: 'epee_rouille', armor: 'armure_rouille', accessory: null },
  },
  chasseresse: {
    maxHp: 160, atk: 50, def: 22, spd: 28,
    moves: [
      { name: 'Tir de Précision', moveType: 'LEGER', power: 52, desc: 'Vise le point faible.' },
      { name: 'Pluie de Traits',  moveType: 'LEGER', power: 32, desc: 'Multiples flèches rapides.' },
      { name: 'Piège Forestier',  moveType: 'LEGER', power: 28, desc: 'Ralentit la cible.' },
      { name: 'Flèche Enflammée', moveType: 'MAGIE', power: 42, desc: 'Brûle la cible.' },
    ],
    startEquip: { weapon: 'arc_primitif', armor: 'armure_rouille', accessory: null },
  },
  mage_arcane: {
    maxHp: 140, atk: 58, def: 15, spd: 18,
    moves: [
      { name: 'Éclair Arcane',  moveType: 'MAGIE', power: 55, desc: 'Foudre magique concentrée.' },
      { name: 'Boule de Feu',   moveType: 'MAGIE', power: 48, desc: 'Explosif et dévastateur.' },
      { name: 'Gel Temporel',   moveType: 'MAGIE', power: 30, desc: 'Ralentit et endommage.' },
      { name: 'Nova Arcanique', moveType: 'MAGIE', power: 65, desc: 'Explosion magique ultime.' },
    ],
    startEquip: { weapon: 'baton_bois', armor: 'robe_bure', accessory: null },
  },
  paladin: {
    maxHp: 280, atk: 35, def: 50, spd: 10,
    moves: [
      { name: 'Marteau Divin',   moveType: 'LOURD', power: 38, desc: 'Écrase avec la grâce des cieux.' },
      { name: 'Bouclier de Foi', moveType: 'LOURD', power: 12, desc: 'Réduit les dégâts reçus.' },
      { name: 'Lumière Sacrée',  moveType: 'MAGIE', power: 45, desc: 'Rayon de purification.' },
      { name: 'Jugement Saint',  moveType: 'LOURD', power: 60, desc: 'Frappe ultime au nom du divin.' },
    ],
    startEquip: { weapon: 'epee_rouille', armor: 'armure_rouille', accessory: null },
  },
  assassin: {
    maxHp: 130, atk: 62, def: 12, spd: 36,
    moves: [
      { name: 'Lame Jumelle',    moveType: 'LEGER', power: 48, desc: 'Deux coups simultanés.' },
      { name: 'Croc-en-Jambe',   moveType: 'LEGER', power: 32, desc: 'Déstabilise et frappe.' },
      { name: 'Poison Mortel',   moveType: 'LEGER', power: 40, desc: 'Lame enduite de venin.' },
      { name: 'Ombre Mortelle',  moveType: 'LEGER', power: 70, desc: 'Surgit de l\'obscurité.' },
    ],
    startEquip: { weapon: 'epee_rouille', armor: 'armure_rouille', accessory: null },
  },
  necromancien: {
    maxHp: 150, atk: 60, def: 14, spd: 16,
    moves: [
      { name: 'Toucher Nécrotique', moveType: 'MAGIE', power: 52, desc: 'Draine la force vitale.' },
      { name: 'Nuage de Miasme',    moveType: 'MAGIE', power: 38, desc: 'Gaz pestilentiel.' },
      { name: 'Os Brisés',          moveType: 'LOURD', power: 44, desc: 'Invoquer la douleur.' },
      { name: 'Fléau des Morts',    moveType: 'MAGIE', power: 68, desc: 'Énergie de l\'au-delà.' },
    ],
    startEquip: { weapon: 'baton_bois', armor: 'robe_bure', accessory: null },
  },
};

// Hero stats also available via UNIT_BASE_STATS for battle lookup
UNIT_BASE_STATS.roi_guerrier = { ...HERO_BASE_STATS.roi_guerrier };
UNIT_BASE_STATS.chasseresse  = { ...HERO_BASE_STATS.chasseresse  };
UNIT_BASE_STATS.mage_arcane  = { ...HERO_BASE_STATS.mage_arcane  };
UNIT_BASE_STATS.paladin      = { ...HERO_BASE_STATS.paladin      };
UNIT_BASE_STATS.assassin     = { ...HERO_BASE_STATS.assassin     };
UNIT_BASE_STATS.necromancien = { ...HERO_BASE_STATS.necromancien };

// XP thresholds per level (index = level)
const XP_PER_LEVEL = [0, 0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700];

// Equipment → inventory slot map
const EQUIP_SLOT_MAP = {
  epee_rouille: 'weapon', epee_bronze: 'weapon', epee_argent: 'weapon', epee_or: 'weapon',
  arc_primitif: 'weapon', arc_long: 'weapon', arc_composite: 'weapon',
  baton_bois: 'weapon', baton_runes: 'weapon', baton_cristal: 'weapon',
  armure_rouille: 'armor', armure_bronze: 'armor', armure_argent: 'armor',
  robe_bure: 'armor', robe_enchantee: 'armor',
  amulette_chance: 'accessory', collier_vie: 'accessory', anneau_force: 'accessory',
};

// ── NPC definitions (server copy) ────────────────────────────────────────────
const SERVER_NPC_DEFS = [
  { id: 'npc_ermite',   type: 'ermite',   name: 'Vieux Gontran',      x: 22, y: 22,
    quest: { id: 'q_loups',   label: 'La Menace des Loups',
      desc: 'Des loups rôdent près de ma hutte. Éliminez-en 3.',
      type: 'kill_mobs', target: 'loup', needed: 3,
      xpReward: 80,  resReward: { food: 50 },             equipReward: 'epee_bronze' } },
  { id: 'npc_marchand', type: 'marchand', name: 'Aldric le Marchand',  x: 42, y: 28,
    quest: { id: 'q_marche',  label: 'Le Commerce Florissant',
      desc: 'Construisez un marché pour relancer les échanges.',
      type: 'build', target: 'market', needed: 1,
      xpReward: 120, resReward: { gold: 80 },              equipReward: 'amulette_chance' } },
  { id: 'npc_chef',     type: 'ancien',   name: 'Dame Éléonore',       x: 58, y: 18,
    quest: { id: 'q_soldats', label: 'Lever une Armée',
      desc: 'Recrutez 5 soldats pour défendre le royaume.',
      type: 'train_units', target: null, needed: 5,
      xpReward: 150, resReward: { gold: 100, food: 50 },  equipReward: 'armure_bronze' } },
  { id: 'npc_scout',    type: 'scout',    name: "Raban l'Éclaireur",   x: 32, y: 44,
    quest: { id: 'q_ours',    label: 'Le Grand Ours',
      desc: 'Un ours terrifiant menace nos forêts. Abattez-le !',
      type: 'kill_mobs', target: 'ours', needed: 1,
      xpReward: 200, resReward: { stone: 100 },            equipReward: 'arc_long' } },
  { id: 'npc_pretre',   type: 'pretre',   name: 'Frère Ansbert',       x: 52, y: 48,
    quest: { id: 'q_eglise',  label: 'La Maison de Dieu',
      desc: 'Érigez une église pour bénir notre peuple.',
      type: 'build', target: 'church', needed: 1,
      xpReward: 180, resReward: { gold: 60, food: 80 },   equipReward: 'collier_vie' } },
  { id: 'npc_seigneur', type: 'seigneur', name: 'Seigneur Bertrand',   x: 12, y: 42,
    quest: { id: 'q_ennemi',  label: "Écraser l'Ennemi",
      desc: 'Détruisez 2 bâtiments du camp ennemi !',
      type: 'destroy_buildings', target: null, needed: 2,
      xpReward: 300, resReward: { gold: 150, stone: 100 }, equipReward: 'epee_argent' } },
];

module.exports = { GameRoom };