'use strict';
const { T, POP, BUILD_TIMES, BUILDING_COSTS, UNIT_COSTS } = require('../constants');

module.exports = {

  tickTimedEffects() {
    let changed = false;
    for (const u of this.shared.units) {
      if (u.stunned > 0) { u.stunned--; changed = true; }
    }
    if (this.shared.nightOfBlood > 0) { this.shared.nightOfBlood--; changed = true; }
    if (this.shared.truce > 0)        { this.shared.truce--;        changed = true; }
    return changed;
  },

  tickResourceRegen() {
    let changed = false;
    const REGROW_TICKS = 90;
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
  },

  tickConstruction() {
    let changed = false;
    for (const bld of this.shared.buildings) {
      if (!bld.underConstruction) continue;
      bld.constructionProgress++;
      if (bld.constructionProgress >= bld.constructionTime) {
        bld.underConstruction = false;
        if (bld.type === 'wall') this._wallSet.add(`${bld.x},${bld.y}`);
        if (bld.type === 'house') {
          bld.reproTimer = 0;
          const sdfAdults = this.shared.population.filter(c => !c.isChild && !c.houseId && !c.deployed);
          const movedIn   = sdfAdults.slice(0, POP.HOUSE_CAPACITY);
          for (const cit of movedIn) { cit.houseId = bld.id; cit.sdfTimer = 0; }
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
  },

  _placeBuilding(type, tx, ty) {
    const cost = BUILDING_COSTS[type];
    if (!cost) return null;
    for (const [res, amount] of Object.entries(cost)) {
      if ((this.shared.resources[res] || 0) < amount) return null;
    }
    if (this.map[ty]?.[tx] === T.WATER || this.map[ty]?.[tx] === T.MOUNTAIN) return null;

    if (type !== 'wall') {
      const TOWN_R = 22, VILLAGE_R = 16;
      const halls    = this.shared.buildings.filter(b => b.type === 'town_hall' && b.owner !== 'enemy');
      const captured = (this.shared.villages || []).filter(v => v.capturedBy);
      const inTerritory =
        halls.some(h => Math.abs(h.x - tx) + Math.abs(h.y - ty) <= TOWN_R)
        || captured.some(v => Math.abs(v.x - tx) + Math.abs(v.y - ty) <= VILLAGE_R);
      if (!inTerritory) return null;
    }

    if (type === 'wall') {
      if (this.shared.buildings.filter(b => b.type === 'wall').length >= 20) return null;
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
    this._addBuilding(type, tx, ty, 'shared', BUILD_TIMES[type] || 10);
    this._updateQuestProgressAll('build', type);
    return { type: 'STATE_UPDATE', shared: this.shared };
  },

  _demolishBuilding(buildingId) {
    const idx = this.shared.buildings.findIndex(b => b.id === buildingId);
    if (idx === -1) return null;
    const building = this.shared.buildings[idx];
    if (building.type === 'town_hall') return null;
    const costs = BUILDING_COSTS[building.type] || {};
    const refundRate = building.underConstruction ? 1.0 : 0.5;
    for (const [res, amt] of Object.entries(costs)) {
      if (this.shared.resources[res] !== undefined)
        this.shared.resources[res] += Math.floor(amt * refundRate);
    }
    if (building.type === 'wall') this._wallSet.delete(`${building.x},${building.y}`);
    this.shared.buildings.splice(idx, 1);
    return { type: 'STATE_UPDATE', shared: this.shared };
  },

  _trainUnit(buildingId, unitType) {
    const building = this.shared.buildings.find(b => b.id === buildingId);
    if (!building || building.underConstruction) return null;
    const cost = UNIT_COSTS[unitType];
    if (!cost) return null;
    for (const [res, amount] of Object.entries(cost)) {
      if ((this.shared.resources[res] || 0) < amount) return null;
    }
    const citizen = this.shared.population.find(c => !c.isChild && c.houseId && !c.deployed);
    if (!citizen) {
      return { type: 'ERROR', message: "Pas d'habitant disponible ! Attendez une naissance ou construisez des maisons." };
    }
    for (const [res, amount] of Object.entries(cost)) this.shared.resources[res] -= amount;
    citizen.deployed = true;
    const unit = this._addUnit(unitType, building.x + 1, building.y + 1, 'player');
    citizen.unitId = unit.id;
    this._updateQuestProgressAll('train_units', unitType);
    return { type: 'STATE_UPDATE', shared: this.shared };
  },
};