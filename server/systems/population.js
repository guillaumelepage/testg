'use strict';
const { MAP_WIDTH, MAP_HEIGHT, T, POP } = require('../constants');

module.exports = {

  tickPopulation() {
    let changed = false;
    const pop    = this.shared.population;
    const houses = this.shared.buildings.filter(b => b.type === 'house' && !b.underConstruction);

    // 1. Age children; promote to adult
    for (const cit of pop.filter(c => c.isChild)) {
      cit.age++;
      changed = true;
      if (cit.age >= POP.ADULT_TICKS) {
        cit.isChild = false;
        cit.houseId = null;
        cit.sdfTimer = 0;
        const bh = this.shared.buildings.find(b => b.id === cit.birthHouseId);
        cit.x = bh ? bh.x + 1 : 8;
        cit.y = bh ? bh.y + 1 : 6;
        this._pendingEvents.push({
          type: 'random_event',
          message: "🧑 Un enfant vient d'avoir 16 ans ! Construisez-lui une maison, sinon il rejoindra les ennemis.",
          color: 0xffaa44,
        });
      }
    }

    // 2. Reproduction: each full house tries to birth a child
    for (const house of houses) {
      const hasChild  = pop.some(c => c.isChild && c.birthHouseId === house.id);
      if (hasChild) continue;
      const residents = pop.filter(c => !c.isChild && c.houseId === house.id);
      if (residents.length < POP.HOUSE_CAPACITY) continue;
      house.reproTimer = (house.reproTimer || 0) + 1;
      changed = true;
      if (house.reproTimer >= POP.REPRO_COOLDOWN) {
        house.reproTimer = 0;
        pop.push({
          id: `cit_${this._nextId()}`,
          age: 0, isChild: true,
          birthHouseId: house.id, houseId: house.id,
          sdfTimer: 0, x: house.x, y: house.y,
          deployed: false, unitId: null,
        });
        this._pendingEvents.push({
          type: 'random_event',
          message: `👶 Une naissance ! L'enfant sera adulte dans ${Math.round(POP.ADULT_TICKS / 60)} min.`,
          color: 0xffccaa,
        });
      }
    }

    // 3. SDF: homeless adults count down → enemy
    const sdfToRemove = [];
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
        sdfToRemove.push(cit.id);
        this._pendingEvents.push({
          type: 'random_event',
          message: '😡 Un sans-abri désespéré a rejoint les ennemis ! Construisez des maisons.',
          color: 0xff4400,
        });
      }
    }
    if (sdfToRemove.length)
      this.shared.population = this.shared.population.filter(c => !sdfToRemove.includes(c.id));

    return changed;
  },
};