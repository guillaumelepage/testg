'use strict';
const { UNIT_BASE_STATS, UNIT_MOVE_TYPE, TYPE_CHART, XP_PER_LEVEL } = require('../constants');

module.exports = {

  _startBattle(triggerPlayer, triggerEnemy) {
    const RANGE = 5;
    const cx = (triggerPlayer.x + triggerEnemy.x) / 2;
    const cy = (triggerPlayer.y + triggerEnemy.y) / 2;
    const inRange = (u) => Math.abs(u.x - cx) + Math.abs(u.y - cy) <= RANGE;

    const playerTeamIds = [
      triggerPlayer.id,
      ...this.shared.units.filter(u =>
        u.owner !== 'enemy' && u.owner !== 'neutral' && u.type !== 'paysan'
        && u.id !== triggerPlayer.id && inRange(u)
      ).map(u => u.id),
    ];
    const enemyIsNeutral = triggerEnemy.owner === 'neutral';
    const enemyTeamIds = [
      triggerEnemy.id,
      ...this.shared.units.filter(u =>
        (u.owner === 'enemy' || (enemyIsNeutral && u.owner === 'neutral'))
        && u.id !== triggerEnemy.id && inRange(u)
      ).map(u => u.id),
    ];

    this.activeBattle = {
      playerTeamIds, enemyTeamIds,
      currentPlayerIdx: 0, currentEnemyIdx: 0,
      _moveSig: null,
      log: [`⚔ ${playerTeamIds.length} allié(s) contre ${enemyTeamIds.length} ennemi(s) !`],
    };
    return { type: 'BATTLE_START', battle: this._battleSnapshot() };
  },

  _battleSnapshot() {
    const b       = this.activeBattle;
    const resolve = ids => ids.map(id => this.shared.units.find(u => u.id === id)).filter(Boolean);
    return {
      playerTeam: resolve(b.playerTeamIds),
      enemyTeam:  resolve(b.enemyTeamIds),
      currentPlayerIdx: b.currentPlayerIdx,
      currentEnemyIdx:  b.currentEnemyIdx,
      log: b.log,
    };
  },

  _battleMove(moveIndex) {
    if (!this.activeBattle) return null;
    const b = this.activeBattle;

    // Dedup: reject if this exact state+move was already processed
    const sig = `${b.currentPlayerIdx}:${b.currentEnemyIdx}:${moveIndex}`;
    if (sig === b._moveSig) return null;
    b._moveSig = sig;

    const playerUnit = this.shared.units.find(u => u.id === b.playerTeamIds[b.currentPlayerIdx]);
    const enemyUnit  = this.shared.units.find(u => u.id === b.enemyTeamIds[b.currentEnemyIdx]);
    if (!playerUnit || !enemyUnit) return null;

    const pStats = UNIT_BASE_STATS[playerUnit.type] || UNIT_BASE_STATS['homme_armes'];
    const eStats = UNIT_BASE_STATS[enemyUnit.type]  || UNIT_BASE_STATS['homme_armes'];

    const playerMove = pStats.moves[moveIndex] || pStats.moves[0];
    const enemyMove  = eStats.moves[Math.floor(Math.random() * eStats.moves.length)];
    const log = [];

    // Fuite !
    if (playerMove.power === 0) {
      log.push(`${playerUnit.type} fuit le combat !`);
      b._moveSig = null;
      b.log = log;
      return { type: 'BATTLE_UPDATE', battle: this._battleSnapshot(), shared: this.shared };
    }

    // Player attacks
    const pDmg = this._calcDamage(playerMove, pStats, eStats, enemyUnit.type, playerUnit, enemyUnit);
    enemyUnit.hp = Math.max(0, enemyUnit.hp - pDmg);
    log.push(`${playerMove.name} inflige ${pDmg} dégâts à ${enemyUnit.type} !`);

    if (enemyUnit.hp <= 0) {
      log.push(`${enemyUnit.type} est vaincu !`);
      if (enemyUnit.owner === 'neutral') {
        const nStats = UNIT_BASE_STATS[enemyUnit.type];
        const reward = nStats?.reward || enemyUnit.reward || 10;
        const rTypes = ['wood', 'stone', 'gold', 'food'];
        const rType  = rTypes[Math.floor(Math.random() * rTypes.length)];
        this.shared.resources[rType] = (this.shared.resources[rType] || 0) + reward;
        log.push(`💰 +${reward} ${rType} !`);
        if (playerUnit.isHero) this._updateQuestProgress(playerUnit, 'kill_mobs', enemyUnit.type);
      }
      const hero = b.playerTeamIds.map(id => this.shared.units.find(u => u.id === id)).find(u => u?.isHero);
      if (hero) {
        const xpGain = Math.round(((UNIT_BASE_STATS[enemyUnit.type] || UNIT_BASE_STATS['homme_armes']).maxHp || 50) / 5);
        hero.xp = (hero.xp || 0) + xpGain;
        log.push(`✨ +${xpGain} XP`);
        while (hero.level < XP_PER_LEVEL.length - 1 && hero.xp >= XP_PER_LEVEL[hero.level + 1]) {
          hero.level++;
          hero.maxHp += 15;
          hero.hp = Math.min(hero.hp + 15, hero.maxHp);
          log.push(`⬆ ${hero.type} passe au niveau ${hero.level} !`);
        }
      }
      this.shared.units = this.shared.units.filter(u => u.id !== enemyUnit.id);
      b.currentEnemyIdx++;
      const nextEnemy = this.shared.units.find(u => u.id === b.enemyTeamIds[b.currentEnemyIdx]);
      if (!nextEnemy) {
        // Dungeon: advance room or complete
        if (b.dungeon) {
          const { id: dungeonId, room: roomIdx, heroId } = b.dungeon;
          const dungeon = (this.shared.dungeons || []).find(d => d.id === dungeonId);
          const hero2   = this.shared.units.find(u => u.id === heroId);
          const nextRoom = roomIdx + 1;
          if (dungeon && nextRoom < dungeon.rooms.length && hero2) {
            log.push(`✅ Salle ${roomIdx + 1} terminée !`);
            b.log = log;
            const result = this._startDungeonRoom(hero2, dungeon, nextRoom);
            return { type: 'DUNGEON_NEXT_ROOM', room: nextRoom, battle: result.battle };
          }
          if (dungeon) {
            dungeon.cleared = true;
            if (hero2) {
              hero2.artifacts = [...(hero2.artifacts || []), dungeon.artifact];
              if (dungeon.artifact.stat === 'hp') { hero2.maxHp += dungeon.artifact.value; hero2.hp = hero2.maxHp; }
            }
            log.push(`✨ ${dungeon.artifact.name} obtenu !`);
          }
          this.activeBattle = null;
          this.shared.units = this.shared.units.filter(u => !u.dungeonUnit);
          for (const u of this.shared.units) {
            if (u.owner !== 'enemy' && u.owner !== 'neutral')
              u.hp = Math.min(u.maxHp, u.hp + Math.round((u.maxHp - u.hp) * 0.4));
          }
          return { type: 'BATTLE_END', winner: 'player', log, dungeonComplete: dungeon?.artifact, shared: this.shared };
        }
        // Normal win
        this.activeBattle = null;
        for (const u of this.shared.units) {
          if (u.owner !== 'enemy' && u.owner !== 'neutral')
            u.hp = Math.min(u.maxHp, u.hp + Math.round((u.maxHp - u.hp) * 0.4));
        }
        return { type: 'BATTLE_END', winner: 'player', log, shared: this.shared };
      }
      log.push(`${nextEnemy.type} entre en combat !`);
      b._moveSig = null;
      b.log = log;
      return { type: 'BATTLE_UPDATE', battle: this._battleSnapshot(), shared: this.shared };
    }

    // Enemy retaliates
    const eDmg = this._calcDamage(enemyMove, eStats, pStats, playerUnit.type, enemyUnit, playerUnit);
    playerUnit.hp = Math.max(0, playerUnit.hp - eDmg);
    log.push(`${enemyUnit.type} utilise ${enemyMove.name} — ${eDmg} dégâts !`);

    if (playerUnit.hp <= 0) {
      log.push(`${playerUnit.type} est vaincu !`);
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

    b._moveSig = null;
    b.log = log;
    return { type: 'BATTLE_UPDATE', battle: this._battleSnapshot(), shared: this.shared };
  },

  tickBattleGuard() {
    if (!this.activeBattle) return;
    const b = this.activeBattle;
    const playerAlive = b.playerTeamIds.some(id => this.shared.units.find(u => u.id === id));
    const enemyAlive  = b.enemyTeamIds.some(id => this.shared.units.find(u => u.id === id));
    if (!playerAlive || !enemyAlive) {
      const winner = playerAlive ? 'player' : 'enemy';
      this.activeBattle = null;
      this._pendingEvents.push({
        type: 'battle_end',
        winner, log: ['⚠ Combat résolu automatiquement.'], shared: this.shared,
      });
    }
  },

  _calcDamage(move, atkStats, defStats, defUnitType, atkUnit = null, defUnit = null) {
    if (!move || !move.power) return 0;
    let atk = atkStats.atk;
    let def = defStats.def;
    for (const art of (atkUnit?.artifacts || [])) { if (art.stat === 'atk') atk += art.value; }
    for (const art of (defUnit?.artifacts || [])) { if (art.stat === 'def') def += art.value; }
    if (this.shared.nightOfBlood > 0 && (atkUnit?.owner === 'enemy' || atkUnit?.owner === 'neutral')) atk *= 1.2;
    if (atkUnit?.owner === 'enemy') atk *= Math.max(1.0, this.difficulty || 1.0);
    const base          = move.power * (atk / Math.max(1, def));
    const effectiveness = TYPE_CHART[move.moveType]?.[UNIT_MOVE_TYPE[defUnitType]] ?? 1;
    return Math.round(base * effectiveness * (0.85 + Math.random() * 0.15));
  },
};