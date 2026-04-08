'use strict';

const MAP_WIDTH = 80;
const MAP_HEIGHT = 60;

// Tile types
const T = { GRASS: 0, DARK_GRASS: 1, WATER: 2, SAND: 3, DIRT: 4, FOREST: 5, MOUNTAIN: 6 };

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
          resources.push({ id: `res_${resources.length}`, type: def.type, x, y, amount: def.amount });
          placed++;
        }
      }
    }
  }

  return { map, resources };
}

class GameRoom {
  constructor(code) {
    this.code = code;
    this.players = {};
    this.playerOrder = [];
    this.state = 'waiting';

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
    this._addBuilding('town_hall', 4, 4, 'shared');
    this._addBuilding('town_hall', MAP_WIDTH - 6, MAP_HEIGHT - 6, 'shared');
    this._addUnit('paysan', 6, 4, 'player');
    this._addUnit('paysan', 5, 5, 'player');
    this._addUnit('paysan', MAP_WIDTH - 7, MAP_HEIGHT - 5, 'player');

    // ── Enemy clan: top-right corner ─────────────────────────────────────────
    this.enemy = {
      campX: MAP_WIDTH - 9, campY: 3,
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

    // ── NPCs ──────────────────────────────────────────────────────────────────
    this.shared.npcs = SERVER_NPC_DEFS.map(d => ({
      ...d, quest: { ...d.quest },
      questAccepted: false, questProgress: 0, questCompleted: false,
    }));

    this.activeBattle = null;
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
    this.shared.units.push({
      id: this._nextId(), type, x, y, owner,
      hp: stats.maxHp, maxHp: stats.maxHp,
      moves: stats.moves.slice(),
      gatherState: 'idle',
      targetResource: null,
      inventory: 0,
      inventoryMax: 20,
      inventoryType: null,
      // Path-following movement
      targetX: null,
      targetY: null,
    });
  }

  join(socketId, name, clan, heroType) {
    if (this.playerOrder.length >= 2) return false;
    const num = this.playerOrder.length + 1;
    this.players[socketId] = { id: `p${num}`, name, clan, socketId, heroType: heroType || 'roi_guerrier' };
    this.playerOrder.push(socketId);
    return true;
  }

  // Called when both players are connected (state → 'playing')
  startGame() {
    const spawnPoints = [
      { x: 7, y: 5 },
      { x: MAP_WIDTH - 8, y: MAP_HEIGHT - 6 },
    ];
    this.playerOrder.forEach((socketId, i) => {
      const player = this.players[socketId];
      const sp = spawnPoints[i] || spawnPoints[0];
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
    delete this.players[socketId];
    this.playerOrder = this.playerOrder.filter(id => id !== socketId);
  }

  isFull()  { return this.playerOrder.length >= 2; }
  isEmpty() { return this.playerOrder.length === 0; }

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
      default: return null;
    }
  }

  // ─── Movement ────────────────────────────────────────────────────────────────

  _moveUnit(unitId, tx, ty) {
    const unit = this.shared.units.find(u => u.id === unitId);
    if (!unit || unit.owner === 'enemy' || unit.owner === 'neutral') return null;
    if (ty < 0 || ty >= MAP_HEIGHT || tx < 0 || tx >= MAP_WIDTH) return null;
    if (this.map[ty][tx] === T.WATER || this.map[ty][tx] === T.MOUNTAIN) return null;

    // Neutral mob at destination → auto-fight (instant)
    const neutral = this.shared.units.find(u => u.x === tx && u.y === ty && u.owner === 'neutral');
    if (neutral) {
      const nStats = UNIT_BASE_STATS[neutral.type];
      const dmg = Math.floor((nStats?.atk || 8) * 0.4);
      unit.hp = Math.max(1, unit.hp - dmg);
      const mobType = neutral.type;
      this.shared.units = this.shared.units.filter(u => u.id !== neutral.id);
      const rewardTypes = ['wood', 'stone', 'gold', 'food'];
      const rType = rewardTypes[Math.floor(Math.random() * 4)];
      this.shared.resources[rType] = (this.shared.resources[rType] || 0) + (nStats?.reward || 10);
      // Quest progress: kill_mobs
      if (unit.isHero) this._updateQuestProgress(unit, 'kill_mobs', mobType);
      // Walk to the mob's tile after fighting
      unit.targetX = tx; unit.targetY = ty;
      unit.gatherState = 'idle'; unit.targetResource = null;
      return { type: 'STATE_UPDATE', shared: this.shared };
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

  // Step all player units one tile toward their targetX/targetY (1 tile per tick)
  tickUnitMovement() {
    let changed = false;
    for (const unit of this.shared.units) {
      if (unit.owner === 'enemy' || unit.owner === 'neutral') continue;
      if (unit.targetX === null || unit.targetX === undefined) continue;
      // Gathering takes over movement
      if (unit.gatherState && unit.gatherState !== 'idle') {
        unit.targetX = null; unit.targetY = null; continue;
      }
      if (unit.x === unit.targetX && unit.y === unit.targetY) {
        unit.targetX = null; unit.targetY = null; continue;
      }
      this._stepToward(unit, unit.targetX, unit.targetY);
      changed = true;
    }
    return changed;
  }

  // ─── Gathering ────────────────────────────────────────────────────────────

  _gatherResource(unitId, resourceId) {
    const unit = this.shared.units.find(u => u.id === unitId);
    const node = this.shared.resourceNodes.find(r => r.id === resourceId);
    if (!unit || !node || node.amount <= 0) return null;
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
          if (!node || node.amount <= 0) {
            unit.gatherState = unit.inventory > 0 ? 'to_deposit' : 'idle';
            if (!unit.inventory) unit.targetResource = null;
          } else {
            const take = Math.min(5, node.amount, unit.inventoryMax - unit.inventory);
            node.amount -= take;
            unit.inventory += take;
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
  _stepToward(unit, tx, ty) {
    if (unit.x === tx && unit.y === ty) return true;
    const dx = tx - unit.x, dy = ty - unit.y;
    const tryStep = (nx, ny) => {
      if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) return false;
      if (this.map[ny][nx] === T.WATER || this.map[ny][nx] === T.MOUNTAIN) return false;
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
      b => types.includes(b.type) && !b.underConstruction && b.owner !== 'enemy',
    );
    if (!depots.length) return null;
    return depots.reduce((best, b) => {
      const d  = Math.abs(b.x - x) + Math.abs(b.y - y);
      const bd = Math.abs(best.x - x) + Math.abs(best.y - y);
      return d < bd ? b : best;
    });
  }

  // ─── Construction ─────────────────────────────────────────────────────────

  tickConstruction() {
    let changed = false;
    for (const bld of this.shared.buildings) {
      if (!bld.underConstruction) continue;
      bld.constructionProgress++;
      if (bld.constructionProgress >= bld.constructionTime) bld.underConstruction = false;
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

    for (const [res, amount] of Object.entries(cost)) this.shared.resources[res] -= amount;
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
    for (const [res, amount] of Object.entries(cost)) this.shared.resources[res] -= amount;
    this._addUnit(unitType, building.x + 1, building.y + 1, 'player');
    // Quest progress: train_units
    this._updateQuestProgressAll('train_units', unitType);
    return { type: 'STATE_UPDATE', shared: this.shared };
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
    let changed = false;
    for (const unit of this.shared.units.filter(u => u.owner === 'neutral')) {
      if (Math.random() < 0.15) {
        const dirs = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];
        const { dx, dy } = dirs[Math.floor(Math.random() * 4)];
        const nx = unit.x + dx, ny = unit.y + dy;
        if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT
          && this.map[ny][nx] !== T.WATER && this.map[ny][nx] !== T.MOUNTAIN
          && !this.shared.units.find(u => u !== unit && u.x === nx && u.y === ny)) {
          unit.x = nx; unit.y = ny;
          changed = true;
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
    const playerBldgs   = this.shared.buildings.filter(b => b.owner !== 'enemy');

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

    // ── Movement ──────────────────────────────────────────────────────────────
    for (const unit of enemies) {
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
          b.hp = Math.max(0, b.hp - 5);
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

    // ── Spawn new enemy units (scales with time) ──────────────────────────────
    this.enemy.buildTimer++;
    const maxEnemies = Math.min(4 + Math.floor(this.enemy.buildTimer / 80), 14);
    if (enemies.length < maxEnemies && this.enemy.buildTimer % 22 === 0) {
      this._spawnEnemyClanUnit(); changed = true;
    }

    return changed;
  }

  // ─── NPC / Quest ──────────────────────────────────────────────────────────

  _interactNpc(npcId, socketId) {
    const npc = this.shared.npcs.find(n => n.id === npcId);
    if (!npc) return null;
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
    const enemyTeamIds = [
      triggerEnemy.id,
      ...this.shared.units.filter(u => u.owner === 'enemy'
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
    const pDmg = this._calcDamage(playerMove, pStats, eStats, enemyUnit.type);
    enemyUnit.hp = Math.max(0, enemyUnit.hp - pDmg);
    log.push(`${playerMove.name} inflige ${pDmg} dégâts à ${enemyUnit.type} !`);

    if (enemyUnit.hp <= 0) {
      log.push(`${enemyUnit.type} est vaincu !`);
      this.shared.units = this.shared.units.filter(u => u.id !== enemyUnit.id);
      b.currentEnemyIdx++;
      const nextEnemy = this.shared.units.find(u => u.id === b.enemyTeamIds[b.currentEnemyIdx]);
      if (!nextEnemy) {
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
    const eDmg = this._calcDamage(enemyMove, eStats, pStats, playerUnit.type);
    playerUnit.hp = Math.max(0, playerUnit.hp - eDmg);
    log.push(`${enemyUnit.type} utilise ${enemyMove.name} — ${eDmg} dégâts !`);

    if (playerUnit.hp <= 0) {
      log.push(`${playerUnit.type} est vaincu !`);
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

  _calcDamage(move, atkStats, defStats, defUnitType) {
    if (!move || !move.power) return 0;
    const base = move.power * (atkStats.atk / defStats.def);
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

const UNIT_MOVE_TYPE = {
  chevalier: 'CAVALERIE', garde_roi: 'LOURD', homme_armes: 'LOURD',
  archer: 'LEGER', croise: 'LOURD', mercenaire: 'LEGER',
  compagnie_loup: 'LEGER', frere_epee: 'LOURD', paysan: 'LEGER',
  // Neutral mobs
  loup: 'LEGER', sanglier: 'CAVALERIE', ours: 'LOURD',
  // Heroes
  roi_guerrier: 'LOURD', chasseresse: 'LEGER', mage_arcane: 'MAGIE',
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
};

const BUILDING_COSTS = {
  house:       { wood: 50 },
  barracks:    { wood: 80, stone: 60, gold: 20 },
  farm:        { wood: 40 },
  mine:        { wood: 60, stone: 40 },
  lumber_mill: { wood: 50, stone: 30 },
  market:      { wood: 60, stone: 40, gold: 30 },
  tower:       { wood: 40, stone: 80, gold: 20 },
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
};

// Hero stats also available via UNIT_BASE_STATS for battle lookup
UNIT_BASE_STATS.roi_guerrier = { ...HERO_BASE_STATS.roi_guerrier };
UNIT_BASE_STATS.chasseresse  = { ...HERO_BASE_STATS.chasseresse  };
UNIT_BASE_STATS.mage_arcane  = { ...HERO_BASE_STATS.mage_arcane  };

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