'use strict';
const { DUNGEON_DEFS, MAP_WIDTH, MAP_HEIGHT } = require('../constants');

module.exports = {

  _generateDungeons() {
    const dungeons = [];
    for (let i = 0; i < DUNGEON_DEFS.length; i++) {
      const def = DUNGEON_DEFS[i];
      const sp  = this._findValidSpawn(def.pos.x, def.pos.y);
      if (Math.abs(sp.x - 8) + Math.abs(sp.y - 6) < 12) continue;
      if (Math.abs(sp.x - (MAP_WIDTH - 9)) + Math.abs(sp.y - (MAP_HEIGHT - 7)) < 12) continue;
      dungeons.push({
        id: `dungeon_${i}`, x: sp.x, y: sp.y,
        cleared: false, artifact: def.artifact, rooms: def.rooms,
      });
    }
    return dungeons;
  },

  _enterDungeon(dungeonId, unitId) {
    const dungeon = (this.shared.dungeons || []).find(d => d.id === dungeonId && !d.cleared);
    const hero    = this.shared.units.find(u => u.id === unitId && u.owner !== 'enemy' && u.owner !== 'neutral');
    if (!dungeon || !hero || this.activeBattle) return null;
    return this._startDungeonRoom(hero, dungeon, 0);
  },

  _startDungeonRoom(hero, dungeon, roomIdx) {
    this.shared.units = this.shared.units.filter(u => u.dungeonUnit !== dungeon.id);
    const room    = dungeon.rooms[roomIdx];
    const newMobs = room.mobs.map(m => {
      const mob = this._addUnit(m.type, dungeon.x, dungeon.y, 'neutral', {
        hp: m.hp, maxHp: m.hp, reward: 0, inventoryMax: 0,
        dungeonUnit: dungeon.id,
      });
      return mob;
    });
    this.activeBattle = {
      playerTeamIds: [hero.id],
      enemyTeamIds:  newMobs.map(m => m.id),
      currentPlayerIdx: 0, currentEnemyIdx: 0,
      _moveSig: null,
      dungeon: { id: dungeon.id, room: roomIdx, heroId: hero.id },
      log: [`🏰 ${room.name} (salle ${roomIdx + 1}/${dungeon.rooms.length})`],
    };
    return { type: 'BATTLE_START', battle: this._battleSnapshot() };
  },
};