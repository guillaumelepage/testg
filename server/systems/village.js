'use strict';
const { MAP_WIDTH, MAP_HEIGHT, T, UNIT_BASE_STATS, HERO_BASE_STATS, VILLAGE_TIER } = require('../constants');
const { rng } = require('../mapgen');

module.exports = {

  _generateVillages() {
    const rand = rng(this.mapSeed ^ 0x7abc1234);
    const villages = [];
    const prefs = [
      { x: Math.floor(MAP_WIDTH * 0.30), y: Math.floor(MAP_HEIGHT * 0.30) },
      { x: Math.floor(MAP_WIDTH * 0.70), y: Math.floor(MAP_HEIGHT * 0.30) },
      { x: Math.floor(MAP_WIDTH * 0.30), y: Math.floor(MAP_HEIGHT * 0.70) },
      { x: Math.floor(MAP_WIDTH * 0.70), y: Math.floor(MAP_HEIGHT * 0.70) },
      { x: Math.floor(MAP_WIDTH * 0.50), y: Math.floor(MAP_HEIGHT * 0.50) },
    ];

    const BASE1 = { x: 8, y: 6 };
    const BASE2 = { x: MAP_WIDTH - 9, y: MAP_HEIGHT - 7 };
    const _tier = (vx, vy) => {
      const d = Math.min(
        Math.sqrt((vx - BASE1.x) ** 2 + (vy - BASE1.y) ** 2),
        Math.sqrt((vx - BASE2.x) ** 2 + (vy - BASE2.y) ** 2),
      );
      if (d < 18) return 1;
      if (d < 28) return 2;
      if (d < 38) return 3;
      if (d < 50) return 4;
      return 5;
    };

    for (const pref of prefs) {
      if (villages.length >= 4) break;
      const sp   = this._findValidSpawn(pref.x, pref.y);
      if (Math.abs(sp.x - BASE1.x) + Math.abs(sp.y - BASE1.y) < 16) continue;
      if (Math.abs(sp.x - BASE2.x) + Math.abs(sp.y - BASE2.y) < 16) continue;
      if (Math.abs(sp.x - this.enemy.campX) + Math.abs(sp.y - this.enemy.campY) < 14) continue;
      if (villages.some(v => Math.abs(v.x - sp.x) + Math.abs(v.y - sp.y) < 16)) continue;

      const vid  = `village_${villages.length}`;
      const tier = _tier(sp.x, sp.y);
      const def  = VILLAGE_TIER[tier];
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
        shotTimer: Math.floor(rand() * 5), shotCooldown: 5,
        arrowRange: 6, arrowDamage: 18 + (tier - 1) * 4,
      });

      // Guards
      const guardHp = Math.round(def.guardHp * (this.difficulty || 1.0));
      const guardOffsets = [{ dx: 2, dy: 0 }, { dx: -1, dy: 2 }, { dx: 2, dy: -1 }];
      let placed = 0;
      for (const off of guardOffsets) {
        if (placed >= def.guardCount) break;
        const gx = Math.max(1, Math.min(MAP_WIDTH - 2, sp.x + off.dx));
        const gy = Math.max(1, Math.min(MAP_HEIGHT - 2, sp.y + off.dy));
        if (this.map[gy]?.[gx] === T.WATER || this.map[gy]?.[gx] === T.MOUNTAIN) continue;
        this._addUnit(def.guardType, gx, gy, 'neutral', {
          hp: guardHp, maxHp: guardHp,
          reward: 15 + tier * 8, inventoryMax: 0,
          villageGuard: vid, homeX: sp.x, homeY: sp.y,
        });
        placed++;
      }

      // House adjacent to tower
      const houseOff = [{ dx: -2, dy: 0 }, { dx: 0, dy: 2 }, { dx: 2, dy: 1 }, { dx: -1, dy: -2 }];
      for (const off of houseOff) {
        const hx = sp.x + off.dx, hy = sp.y + off.dy;
        if (hx < 1 || hx >= MAP_WIDTH - 1 || hy < 1 || hy >= MAP_HEIGHT - 1) continue;
        if (this.map[hy]?.[hx] === T.WATER || this.map[hy]?.[hx] === T.MOUNTAIN) continue;
        this._addBuilding('house', hx, hy, 'neutral');
        break;
      }

      // Village paysan
      const px = Math.max(1, Math.min(MAP_WIDTH - 2, sp.x - 2));
      const py = Math.max(1, Math.min(MAP_HEIGHT - 2, sp.y + 1));
      if (this.map[py]?.[px] !== T.WATER && this.map[py]?.[px] !== T.MOUNTAIN) {
        this._addUnit('paysan', px, py, 'neutral', {
          hp: 30, maxHp: 30, reward: 5, inventoryMax: 0,
          villageGuard: vid, homeX: sp.x, homeY: sp.y,
        });
      }
    }
    return villages;
  },

  _startVillageSiege(unit, village) {
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
  },

  _captureVillage(village) {
    village.capturedBy = 'player';
    village.hp = 0;
    village.captureTimer = null;
    village.capturingEnemyId = null;
    for (const [res, amt] of Object.entries(village.loot || {})) {
      this.shared.resources[res] = (this.shared.resources[res] || 0) + amt;
    }
    this.shared.units = this.shared.units.filter(u => u.villageGuard !== village.id);
    for (const u of this.shared.units) {
      if (u.siegeTarget === village.id) u.siegeTarget = null;
    }
    this._transferVillageBuildings(village, 'player');
    this._spawnVillageCounterAttack(village);
    this._pendingEvents.push({ type: 'village_captured', villageId: village.id, loot: village.loot });
  },

  _reclaimVillage(village) {
    const def   = VILLAGE_TIER[village.level || 2];
    const maxHp = Math.round(def.towerHp * (this.difficulty || 1.0));
    village.capturedBy = null;
    village.hp = Math.floor(maxHp * 0.4);
    village.captureTimer = null;
    village.capturingEnemyId = null;
    this.shared.units = this.shared.units.filter(u => u.reconquestTarget !== village.id);
    this._transferVillageBuildings(village, 'neutral');
    this._pendingEvents.push({ type: 'village_reclaimed', villageId: village.id });
  },

  _spawnVillageCounterAttack(village) {
    const tier      = village.level || 2;
    const def       = VILLAGE_TIER[tier];
    const count     = 2 + Math.floor(tier / 2);
    const unitType  = def.counterUnit;
    const spawnOffsets = [
      { dx: -5, dy: 0 }, { dx: 5, dy: 0 },
      { dx: 0, dy: -5 }, { dx: 0, dy: 5 },
      { dx: -4, dy: 3 }, { dx: 4, dy: -3 },
    ];
    let placed = 0;
    for (const off of spawnOffsets) {
      if (placed >= count) break;
      const sx = village.x + off.dx, sy = village.y + off.dy;
      if (sx < 1 || sx >= MAP_WIDTH - 1 || sy < 1 || sy >= MAP_HEIGHT - 1) continue;
      if (this.map[sy]?.[sx] === T.WATER || this.map[sy]?.[sx] === T.MOUNTAIN) continue;
      if (this.shared.units.find(u => u.x === sx && u.y === sy)) continue;
      this._addUnit(unitType, sx, sy, 'enemy', {
        reconquestTarget: village.id,
        targetX: village.x, targetY: village.y,
      });
      placed++;
    }
  },

  _transferVillageBuildings(village, newOwner) {
    const VILLAGE_R = 16;
    for (const bld of this.shared.buildings) {
      if (bld.owner === 'enemy') continue;
      const dist = Math.abs(bld.x - village.x) + Math.abs(bld.y - village.y);
      if (dist <= VILLAGE_R) {
        if (bld.owner === 'neutral' || (newOwner === 'neutral' && bld.owner === 'shared')) {
          bld.owner = newOwner === 'player' ? 'shared' : 'neutral';
        }
      }
    }
  },

  tickVillageSiege() {
    let changed = false;
    if (!this.shared.villages?.length) return false;
    for (const unit of this.shared.units) {
      if (!unit.siegeTarget) continue;
      const village = this.shared.villages.find(v => v.id === unit.siegeTarget);
      if (!village || village.capturedBy) { unit.siegeTarget = null; continue; }
      if (Math.abs(unit.x - village.x) + Math.abs(unit.y - village.y) > 1) continue;
      const stats = UNIT_BASE_STATS[unit.type] || HERO_BASE_STATS[unit.type] || UNIT_BASE_STATS['homme_armes'];
      const atk   = Math.floor((stats.atk || 15) * (0.7 + Math.random() * 0.6));
      village.hp  = Math.max(0, village.hp - atk);
      changed = true;
      if (village.hp <= 0) { this._captureVillage(village); unit.siegeTarget = null; }
    }
    return changed;
  },

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
  },
};