'use strict';
const { MAP_WIDTH, MAP_HEIGHT, T, VILLAGE_TIER } = require('../constants');

module.exports = {

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
      this._addUnit(mob.type, x, y, 'neutral', {
        hp: mob.hp, maxHp: mob.hp, reward: mob.reward, inventoryMax: 0,
      });
      placed++;
    }
  },

  _spawnEnemyClanUnit() {
    const pool = ['homme_armes', 'archer', 'mercenaire', 'compagnie_loup'];
    const type = pool[Math.floor(Math.random() * pool.length)];
    const cx = this.enemy.campX + 1 + Math.floor(Math.random() * 3 - 1);
    const cy = this.enemy.campY + 1 + Math.floor(Math.random() * 3 - 1);
    const x  = Math.max(0, Math.min(MAP_WIDTH - 1, cx));
    const y  = Math.max(0, Math.min(MAP_HEIGHT - 1, cy));
    if (this.map[y]?.[x] === T.WATER || this.map[y]?.[x] === T.MOUNTAIN) return;
    this._addUnit(type, x, y, 'enemy');
  },

  tickNeutralMobs() {
    const VILLAGE_AGGRO_RADIUS = 8;
    let changed = false;
    const playerUnits = this.shared.units.filter(u => u.owner !== 'enemy' && u.owner !== 'neutral');

    for (const unit of this.shared.units.filter(u => u.owner === 'neutral')) {
      // Village guards
      if (unit.villageGuard) {
        const village = (this.shared.villages || []).find(v => v.id === unit.villageGuard);
        if (village?.capturedBy) continue;
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
            const hit = playerUnits.find(p => p.x === unit.x && p.y === unit.y);
            if (hit) {
              unit.x = prevX; unit.y = prevY;
              const result = this._startBattle(hit, unit);
              if (result) this._pendingEvents.push({ type: 'battle_start', battle: result.battle });
              changed = true;
            }
          }
        } else {
          unit.aggroMode = false;
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

      // Boss: always pursues nearest player
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

      // Regular neutrals: random wander
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
  },

  tickEnemyAI() {
    let changed = false;
    const enemies     = this.shared.units.filter(u => u.owner === 'enemy');
    const playerUnits = this.shared.units.filter(u => u.owner !== 'enemy' && u.owner !== 'neutral');
    const playerBldgs = this.shared.buildings.filter(b => b.owner === 'shared');

    // Aggro detection
    let aggroGain = 0;
    outer:
    for (const e of enemies) {
      for (const p of playerUnits) {
        if (Math.abs(e.x - p.x) + Math.abs(e.y - p.y) <= 12) { aggroGain = 8; break outer; }
      }
    }
    this.enemy.aggroLevel = Math.max(0, Math.min(100, this.enemy.aggroLevel + aggroGain - 1));
    const isAggro = this.enemy.aggroLevel >= 30;

    // Reconquest: check for dead capturing unit
    for (const v of (this.shared.villages || [])) {
      if (v.capturingEnemyId && !this.shared.units.find(u => u.id === v.capturingEnemyId)) {
        const def  = VILLAGE_TIER[v.level || 2];
        v.hp = Math.floor(Math.round(def.towerHp * (this.difficulty || 1.0)) * 0.25);
        v.captureTimer = null;
        v.capturingEnemyId = null;
        this._pendingEvents.push({ type: 'village_capture_interrupted', villageId: v.id });
        changed = true;
      }
    }

    const capturedVillages = (this.shared.villages || []).filter(v => v.capturedBy);
    for (const unit of enemies) {
      if (!unit.reconquestTarget) continue;
      const village = capturedVillages.find(v => v.id === unit.reconquestTarget);
      if (!village) { unit.reconquestTarget = null; continue; }
      const dist = Math.abs(unit.x - village.x) + Math.abs(unit.y - village.y);
      if (dist > 1) {
        this._stepTowardEnemy(unit, village.x, village.y);
        changed = true;
      } else {
        changed = true;
        if (!village.capturingEnemyId) {
          const dmg = 20 + Math.floor(Math.random() * 15);
          village.hp = Math.max(0, (village.hp || 0) - dmg);
          if (village.hp <= 0) {
            village.captureTimer = 0;
            village.capturingEnemyId = unit.id;
            this._pendingEvents.push({ type: 'village_capture_progress', villageId: village.id, ticks: 0, maxTicks: 8 });
          } else if (!this.activeBattle) {
            const nearby = playerUnits.filter(u => Math.abs(u.x - village.x) + Math.abs(u.y - village.y) <= 5);
            if (nearby.length > 0) {
              const result = this._startBattle(nearby[0], unit);
              if (result) this._pendingEvents.push({ type: 'battle_start', battle: result.battle });
            }
          }
        } else if (village.capturingEnemyId === unit.id) {
          village.captureTimer = (village.captureTimer || 0) + 1;
          this._pendingEvents.push({ type: 'village_capture_progress', villageId: village.id, ticks: village.captureTimer, maxTicks: 8 });
          if (!this.activeBattle) {
            const nearby = playerUnits.filter(u => Math.abs(u.x - village.x) + Math.abs(u.y - village.y) <= 4);
            if (nearby.length > 0) {
              const result = this._startBattle(nearby[0], unit);
              if (result) this._pendingEvents.push({ type: 'battle_start', battle: result.battle });
            }
          }
          if (village.captureTimer >= 8) {
            village.captureTimer = null;
            village.capturingEnemyId = null;
            this._reclaimVillage(village);
          }
        }
      }
    }

    // Movement
    for (const unit of enemies) {
      if (unit.reconquestTarget) continue;
      if (isAggro && playerBldgs.length > 0) {
        let nearestBld = playerBldgs[0], nearestDist = Infinity;
        for (const b of playerBldgs) {
          const d = Math.abs(b.x - unit.x) + Math.abs(b.y - unit.y);
          if (d < nearestDist) { nearestBld = b; nearestDist = d; }
        }
        const tx = nearestBld.type === 'wall' ? nearestBld.x : nearestBld.x + 1;
        const ty = nearestBld.type === 'wall' ? nearestBld.y : nearestBld.y + 1;
        if (nearestDist > 1) { this._stepTowardEnemy(unit, tx, ty); changed = true; }
      } else {
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

    // Enemy attacks adjacent player buildings
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

    // Remove destroyed enemy buildings + quest progress
    const enemyBldgs = this.shared.buildings.filter(b => b.owner === 'enemy');
    for (const b of enemyBldgs) {
      if (b.hp <= 0) {
        this._updateQuestProgressAll('destroy_buildings', null);
        this.shared.buildings = this.shared.buildings.filter(x => x.id !== b.id);
        changed = true;
      }
    }

    // Spawn new enemy units
    this.enemy.buildTimer++;
    const maxEnemies = Math.min(4 + Math.floor(this.enemy.buildTimer / 80), 14);
    if (!this.shared.truce && enemies.length < maxEnemies && this.enemy.buildTimer % 22 === 0) {
      this._spawnEnemyClanUnit(); changed = true;
    }
    if (this.shared.truce) this.enemy.aggroLevel = 0;

    return changed;
  },
};