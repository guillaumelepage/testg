'use strict';
const { XP_PER_LEVEL, EQUIP_SLOT_MAP } = require('../constants');

module.exports = {

  _interactNpc(npcId, socketId) {
    const npc = this.shared.npcs.find(n => n.id === npcId);
    if (!npc) return null;
    // Temporary mage NPC
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
    const hero = this.shared.units.find(u => u.isHero && u.heroOwner === socketId);
    return { type: 'NPC_INTERACT', npc, heroId: hero?.id };
  },

  _acceptQuest(npcId, heroId) {
    const npc  = this.shared.npcs.find(n => n.id === npcId);
    const hero = this.shared.units.find(u => u.id === heroId && u.isHero);
    if (!npc || !hero || npc.questAccepted || npc.questCompleted) return null;
    npc.questAccepted = true;
    npc.questProgress = 0;
    hero.activeQuest  = npc.quest.id;
    hero.questProgress = 0;
    return { type: 'STATE_UPDATE', shared: this.shared };
  },

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
  },

  _updateQuestProgressAll(questType, target) {
    for (const unit of this.shared.units) {
      if (!unit.isHero || !unit.activeQuest) continue;
      this._updateQuestProgress(unit, questType, target);
    }
  },

  _completeQuest(hero, npc) {
    npc.questCompleted = true;
    hero.activeQuest   = null;
    hero.xp = (hero.xp || 0) + npc.quest.xpReward;
    while (hero.level < XP_PER_LEVEL.length - 1 && hero.xp >= XP_PER_LEVEL[hero.level + 1]) {
      hero.level++;
      hero.maxHp += 15;
      hero.hp = Math.min(hero.hp + 15, hero.maxHp);
    }
    for (const [res, amt] of Object.entries(npc.quest.resReward || {})) {
      this.shared.resources[res] = (this.shared.resources[res] || 0) + amt;
    }
    if (npc.quest.equipReward) {
      const slot = EQUIP_SLOT_MAP[npc.quest.equipReward] || 'weapon';
      hero.equipment = hero.equipment || {};
      hero.equipment[slot] = npc.quest.equipReward;
    }
  },
};