'use strict';
const { MAP_WIDTH, MAP_HEIGHT, T, TILE_SPEED_FACTOR, UNIT_SPEED } = require('../constants');

module.exports = {

  _gatherResource(unitId, resourceId) {
    const unit = this.shared.units.find(u => u.id === unitId);
    const node = this.shared.resourceNodes.find(r => r.id === resourceId);
    if (!unit || !node || node.amount <= 0) return null;
    if (node.type === 'wood' && node.state && node.state !== 'alive') return null;
    unit.targetResource = resourceId;
    unit.gatherState    = 'to_resource';
    unit.inventory      = 0;
    unit.inventoryType  = node.type;
    return { type: 'STATE_UPDATE', shared: this.shared };
  },

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
            unit.gatherState = 'idle'; unit.targetResource = null; unit._gatherStuck = 0;
          } else {
            const prevX = unit.x, prevY = unit.y;
            const arrived = this._stepToward(unit, node.x, node.y);
            if (arrived) {
              unit.gatherState = 'gathering'; unit._gatherStuck = 0;
            } else if (unit.x === prevX && unit.y === prevY) {
              unit._gatherStuck = (unit._gatherStuck || 0) + 1;
              if (unit._gatherStuck >= 15) {
                unit.gatherState = 'idle'; unit.targetResource = null; unit._gatherStuck = 0;
              }
            }
          }
          changed = true; break;
        }
        case 'gathering': {
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
            this.shared.resources[unit.inventoryType] =
              (this.shared.resources[unit.inventoryType] || 0) + unit.inventory;
            unit.inventory = 0; unit.gatherState = 'idle';
          } else {
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
              const prevX = unit.x, prevY = unit.y;
              this._stepToward(unit, tx, ty);
              if (unit.x === prevX && unit.y === prevY) {
                unit._gatherStuck = (unit._gatherStuck || 0) + 1;
                if (unit._gatherStuck >= 15) {
                  this.shared.resources[unit.inventoryType] =
                    (this.shared.resources[unit.inventoryType] || 0) + unit.inventory;
                  unit.inventory = 0; unit.gatherState = 'idle'; unit._gatherStuck = 0;
                }
              } else {
                unit._gatherStuck = 0;
              }
            }
          }
          changed = true; break;
        }
      }
    }
    return changed;
  },

  tickUnitMovement() {
    let changed = false;
    for (const unit of this.shared.units) {
      if (unit.owner === 'enemy' || unit.owner === 'neutral') continue;
      if (unit.targetX === null || unit.targetX === undefined) continue;
      if (unit.stunned > 0) { changed = true; continue; }
      if (unit.gatherState && unit.gatherState !== 'idle') {
        unit.targetX = null; unit.targetY = null; continue;
      }
      if (unit.x === unit.targetX && unit.y === unit.targetY) {
        unit.targetX = null; unit.targetY = null; continue;
      }
      const speed         = UNIT_SPEED[unit.type] || 1.0;
      const terrainFactor = TILE_SPEED_FACTOR[this.map[unit.y]?.[unit.x]] ?? 1.0;
      unit._moveAccum = (unit._moveAccum || 0) + speed * terrainFactor;
      while (unit._moveAccum >= 1) {
        unit._moveAccum -= 1;
        if (unit.x === unit.targetX && unit.y === unit.targetY) break;
        this._stepToward(unit, unit.targetX, unit.targetY, true);
      }
      changed = true;
    }
    return changed;
  },

  _stepToward(unit, tx, ty, preventStack = false) {
    if (unit.x === tx && unit.y === ty) return true;
    const dx = tx - unit.x, dy = ty - unit.y;
    const isResourceTile = (nx, ny) =>
      nx === tx && ny === ty &&
      this.shared.resourceNodes.some(r => r.x === nx && r.y === ny && r.amount > 0);
    const tryStep = (nx, ny) => {
      if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) return false;
      const tile = this.map[ny][nx];
      if (tile === T.WATER || tile === T.SNOW) return false;
      if (tile === T.MOUNTAIN && !isResourceTile(nx, ny)) return false;
      if (this._wallSet.has(`${nx},${ny}`)) return false;
      if (preventStack && (nx !== tx || ny !== ty) &&
          this.shared.units.find(u => u !== unit && u.owner === unit.owner &&
              u.x === nx && u.y === ny && u.targetX != null)) return false;
      unit.x = nx; unit.y = ny; return true;
    };
    if (Math.abs(dx) >= Math.abs(dy)) {
      if (!tryStep(unit.x + Math.sign(dx), unit.y)) tryStep(unit.x, unit.y + Math.sign(dy));
    } else {
      if (!tryStep(unit.x, unit.y + Math.sign(dy))) tryStep(unit.x + Math.sign(dx), unit.y);
    }
    return unit.x === tx && unit.y === ty;
  },

  _stepTowardEnemy(unit, tx, ty) {
    if (unit.x === tx && unit.y === ty) return true;
    const dx = tx - unit.x, dy = ty - unit.y;
    const tryStep = (nx, ny) => {
      if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) return false;
      if (this.map[ny][nx] === T.WATER || this.map[ny][nx] === T.MOUNTAIN || this.map[ny][nx] === T.SNOW) return false;
      if (this._wallSet.has(`${nx},${ny}`)) {
        const wall = this.shared.buildings.find(b => b.type === 'wall' && b.x === nx && b.y === ny);
        if (wall) {
          wall.hp -= 20;
          if (wall.hp <= 0) {
            this._wallSet.delete(`${nx},${ny}`);
            this.shared.buildings = this.shared.buildings.filter(b => b.id !== wall.id);
            unit.x = nx; unit.y = ny;
          }
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
  },

  _nearestDepot(resourceType, x, y) {
    const ACCEPTS = {
      wood:  ['lumber_mill', 'town_hall'],
      stone: ['mine',        'town_hall'],
      gold:  ['mine',        'town_hall'],
      food:  ['farm',        'town_hall'],
    };
    const types  = ACCEPTS[resourceType] || ['town_hall'];
    const depots = this.shared.buildings.filter(
      b => types.includes(b.type) && !b.underConstruction && b.owner === 'shared',
    );
    if (!depots.length) return null;
    return depots.reduce((best, b) => {
      const d  = Math.abs(b.x - x) + Math.abs(b.y - y);
      const bd = Math.abs(best.x - x) + Math.abs(best.y - y);
      return d < bd ? b : best;
    });
  },
};