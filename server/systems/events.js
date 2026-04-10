'use strict';
const { MAP_WIDTH, MAP_HEIGHT, T } = require('../constants');

module.exports = {

  tickRandomEvents() {
    this.eventTimer++;
    if (this.eventTimer % 180 !== 0) return false;

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
      case 'merchant': {
        if ((this.shared.resources.wood || 0) >= 200) {
          this.shared.resources.wood -= 200;
          this.shared.resources.gold = (this.shared.resources.gold || 0) + 50;
          message = '🧳 Un marchand passe ! -200 bois, +50 or';
        } else {
          this.shared.resources.gold = (this.shared.resources.gold || 0) + 25;
          message = '🧳 Un marchand généreux offre +25 or !';
        }
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
      case 'storm': {
        for (const u of this.shared.units) {
          if (u.owner !== 'enemy' && u.owner !== 'neutral') u.stunned = 3;
        }
        message = '🌩 Orage ! Vos unités sont immobilisées pendant 3 secondes.';
        color = 0x4488ff;
        break;
      }
      case 'wolf_pack': {
        const players = this.shared.units.filter(u => u.owner !== 'enemy' && u.owner !== 'neutral');
        if (players.length) {
          const target  = players[Math.floor(Math.random() * players.length)];
          const offsets = [{ dx: 2, dy: 0 }, { dx: -2, dy: 0 }, { dx: 0, dy: 2 }, { dx: 0, dy: -2 }];
          let spawned = 0;
          for (const off of offsets) {
            if (spawned >= 3) break;
            const x = target.x + off.dx, y = target.y + off.dy;
            if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) continue;
            if (this.map[y]?.[x] === T.WATER || this.map[y]?.[x] === T.MOUNTAIN) continue;
            if (this.shared.units.find(u => u.x === x && u.y === y)) continue;
            this._addUnit('loup', x, y, 'neutral');
            spawned++;
          }
        }
        message = '🐺 Meute affamée ! Des loups rodent près de vos unités.';
        color = 0x997755;
        break;
      }
      case 'deposit': {
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
        message = "🧙 Un mage itinérant s'installe près de votre camp. Interagissez avec lui !";
        color = 0xaa55ff;
        break;
      }
      case 'deserter': {
        const enemies = this.shared.units.filter(u => u.owner === 'enemy');
        if (enemies.length) {
          const deserter = enemies[Math.floor(Math.random() * enemies.length)];
          deserter.owner = 'player';
          deserter.hp = Math.round(deserter.hp * 0.6);
        }
        message = '⚓ Déserteur ! Un soldat ennemi rejoint votre camp.';
        color = 0x44cc88;
        break;
      }
      case 'refugees': {
        const slots2 = nearTownHall([{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 0, dy: -1 }]);
        if (slots2.length) this._addUnit('paysan', slots2[0].x, slots2[0].y, 'player');
        message = '🏚 Des réfugiés arrivent ! Un paysan gratuit rejoint votre village.';
        color = 0xaabb88;
        break;
      }
      case 'night_blood': {
        this.shared.nightOfBlood = 60;
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
        this.shared.truce = 90;
        this.enemy.aggroLevel = 0;
        message = '🕊 Trêve ! Les ennemis se retirent pendant 90 secondes.';
        color = 0x88ccff;
        break;
      }
      case 'boss': {
        let bx = 35 + Math.floor(Math.random() * 10) - 5;
        let by = 25 + Math.floor(Math.random() * 10) - 5;
        for (let attempt = 0; attempt < 20; attempt++) {
          if (this.map[by]?.[bx] !== T.WATER && this.map[by]?.[bx] !== T.MOUNTAIN
              && !this.shared.units.find(u => u.x === bx && u.y === by)) break;
          bx = 30 + Math.floor(Math.random() * 20);
          by = 20 + Math.floor(Math.random() * 20);
        }
        const bossUnit = this._addUnit('tyran', bx, by, 'neutral');
        bossUnit.isBoss = true;
        this._pendingEvents.push({ type: 'random_event', message: '💀 Un Tyran des Ombres surgit au cœur de la carte !', color: 0x7700aa, sound: 'danger' });
        return true;
      }
    }

    this._pendingEvents.push({ type: 'random_event', message, color, sound: _sound });
    return true;
  },
};