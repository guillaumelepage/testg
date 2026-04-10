import { TILE_SIZE, RESOURCE_KEYS, treeTexKey } from './constants';
import { socketManager } from '../network/SocketManager';

// Entity spawning + state sync mixin — mixed into WorldScene.prototype via Object.assign
export const EntityLayerMixin = {

  // ─── Resource nodes ───────────────────────────────────────────────────────

  _spawnResource(node) {
    const texKey = node.type === 'wood'
      ? treeTexKey(node)
      : (RESOURCE_KEYS[node.type] || 'res_stone');
    const scale = node.type === 'wood' ? (node.state === 'sapling' ? 0.55 : 0.9) : 0.82;
    const img = this.add.image(
      node.x * TILE_SIZE + TILE_SIZE / 2,
      node.y * TILE_SIZE + TILE_SIZE / 2,
      texKey
    ).setDepth(2).setScale(scale);
    this.resourceObjects.set(node.id, img);
  },

  // ─── Buildings ─────────────────────────────────────────────────────────────

  _spawnBuilding(bld) {
    // ── Walls are 1×1 tiles ─────────────────────────────────────────────────
    if (bld.type === 'wall') {
      const img = this.add.image(
        bld.x * TILE_SIZE + TILE_SIZE / 2,
        bld.y * TILE_SIZE + TILE_SIZE / 2,
        'bld_wall',
      ).setDepth(3).setOrigin(0.5).setDisplaySize(TILE_SIZE - 2, TILE_SIZE - 2)
        .setAlpha(bld.underConstruction ? 0.45 : 1);
      this.buildingObjects.set(bld.id, img);
      return;
    }

    // ── Regular 2×2 buildings ───────────────────────────────────────────────
    const sz = bld.type === 'town_hall' ? 96 : bld.type === 'tower' ? 48 : 64;
    const cx = (bld.x + 1) * TILE_SIZE;
    const cy = (bld.y + 1) * TILE_SIZE;

    const img = this.add.image(cx, cy, `bld_${bld.type}`)
      .setDepth(3).setOrigin(0.5).setDisplaySize(sz, sz)
      .setAlpha(bld.underConstruction ? 0.45 : 1);
    this.buildingObjects.set(bld.id, img);

    // HP bar under building
    const barY = cy + sz / 2 + 6;
    this.add.rectangle(cx, barY, 48, 7, 0x330000).setDepth(4);
    this.add.rectangle(cx - 24, barY, 48 * (bld.hp / bld.maxHp), 7, 0x22cc22)
      .setOrigin(0, 0.5).setDepth(4);

    // Construction progress bar
    if (bld.underConstruction) {
      const pct = bld.constructionProgress / bld.constructionTime;
      const progBg   = this.add.rectangle(cx, cy - sz / 2 - 10, 52, 8, 0x222222).setDepth(5).setOrigin(0.5);
      const progFill = this.add.rectangle(cx - 26, cy - sz / 2 - 10, Math.max(1, 52 * pct), 8, 0xffcc00)
        .setDepth(5).setOrigin(0, 0.5);
      const progLabel = this.add.text(cx, cy - sz / 2 - 22, '🔨', { fontSize: '14px' })
        .setDepth(5).setOrigin(0.5);
      img._progBg    = progBg;
      img._progFill  = progFill;
      img._progLabel = progLabel;
    }
  },

  // ─── Units ─────────────────────────────────────────────────────────────────

  _spawnUnit(unit) {
    const isEnemy   = unit.owner === 'enemy';
    const isNeutral = unit.owner === 'neutral';
    const texKey = isEnemy ? `unit_${unit.type}_enemy` : `unit_${unit.type}`;
    const img    = this.add.image(0, 0, texKey).setDisplaySize(36, 36);
    if (isNeutral) img.setTint(0xaacc88); // subtle green tint for wildlife
    const hpBg   = this.add.rectangle(0, 22, 40, 6, 0x330000).setOrigin(0.5);
    const hpFill = this.add.rectangle(-20, 22, 40, 6, 0x22cc22).setOrigin(0, 0.5);

    const children = [img, hpBg, hpFill];

    // Hero: add a quest indicator text above
    if (unit.isHero) {
      const questBadge = this.add.text(0, -26, unit.activeQuest ? '❗' : '✦', {
        fontSize: '12px',
      }).setOrigin(0.5);
      children.push(questBadge);
      img._questBadge = questBadge;
    }

    const container = this.add.container(
      unit.x * TILE_SIZE + TILE_SIZE / 2,
      unit.y * TILE_SIZE + TILE_SIZE / 2,
      children
    ).setDepth(6);

    container.hpFill   = hpFill;
    container.unitRef  = unit;
    container.questBadge = unit.isHero ? children[children.length - 1] : null;
    this.unitObjects.set(unit.id, container);
  },

  // ─── NPCs ──────────────────────────────────────────────────────────────────

  _spawnNpc(npc) {
    const texKey = `npc_${npc.type}`;
    const img = this.add.image(
      npc.x * TILE_SIZE + TILE_SIZE / 2,
      npc.y * TILE_SIZE + TILE_SIZE / 2,
      texKey,
    ).setDisplaySize(36, 36).setDepth(5);

    const indicator = npc.questCompleted ? '✓' : npc.questAccepted ? '❗' : '❓';
    const badge = this.add.text(
      npc.x * TILE_SIZE + TILE_SIZE / 2,
      npc.y * TILE_SIZE + TILE_SIZE / 2 - 24,
      indicator, { fontSize: '14px' },
    ).setOrigin(0.5).setDepth(7);

    const label = this.add.text(
      npc.x * TILE_SIZE + TILE_SIZE / 2,
      npc.y * TILE_SIZE + TILE_SIZE + 2,
      npc.name, {
        fontFamily: 'sans-serif', fontSize: '9px', color: '#d4b060',
        backgroundColor: '#00000066', padding: { x: 2, y: 1 },
      },
    ).setOrigin(0.5, 0).setDepth(7);

    this.npcObjects.set(npc.id, { img, badge, label, npc });
  },

  // ─── Villages ──────────────────────────────────────────────────────────────

  _spawnVillage(village) {
    const wx = village.x * TILE_SIZE + TILE_SIZE / 2;
    const wy = village.y * TILE_SIZE + TILE_SIZE / 2;
    const captured = !!village.capturedBy;
    const vis = captured || this._tileVisible(village.x, village.y);

    const ring = this.add.graphics().setDepth(0.5).setVisible(vis);
    this._drawVillageRing(ring, wx, wy, captured);

    const tower = this.add.image(wx, wy, captured ? 'village_tower_cap' : 'village_tower')
      .setOrigin(0.5).setDepth(village.y + 0.8).setDisplaySize(72, 72).setVisible(vis);

    const barW = 56;
    const hpBg = this.add.rectangle(wx, wy - 44, barW, 7, 0x330000)
      .setDepth(village.y + 1).setVisible(vis && !captured);
    const hpFill = this.add.rectangle(wx - barW / 2, wy - 44, barW * (village.hp / village.maxHp), 7, 0xcc2222)
      .setOrigin(0, 0.5).setDepth(village.y + 1).setVisible(vis && !captured);

    const lvlStr = !captured && village.level ? ` Niv.${village.level}` : '';
    const lbl = this.add.text(wx, wy - 56,
      captured ? '✦ Village allié' : `⚔ Village ennemi${lvlStr}`, {
        fontFamily: 'sans-serif', fontSize: '10px',
        color: captured ? '#ffd700' : '#ff6644',
        backgroundColor: '#00000088', padding: { x: 3, y: 2 },
      }).setOrigin(0.5).setDepth(village.y + 1).setVisible(vis);

    this.villageObjects.set(village.id, { ring, tower, hpBg, hpFill, lbl });
  },

  _drawVillageRing(g, wx, wy, captured) {
    const r = 8 * TILE_SIZE;
    g.clear();
    g.fillStyle(captured ? 0x2244bb : 0x882222, captured ? 0.06 : 0.04);
    g.fillCircle(wx, wy, r);
    g.lineStyle(2, captured ? 0x4488ff : 0xcc4444, captured ? 0.35 : 0.25);
    g.strokeCircle(wx, wy, r);
  },

  _syncVillages() {
    for (const village of (this.shared.villages || [])) {
      const objs = this.villageObjects.get(village.id);
      if (!objs) { this._spawnVillage(village); continue; }

      const captured = !!village.capturedBy;
      const vis = captured || this._tileVisible(village.x, village.y);

      objs.tower?.setVisible(vis);
      objs.ring?.setVisible(vis);
      objs.lbl?.setVisible(vis);

      if (village.capturedBy) {
        if (objs.tower?.active && objs.tower.texture?.key !== 'village_tower_cap') {
          objs.tower.setTexture('village_tower_cap');
          const wx = village.x * TILE_SIZE + TILE_SIZE / 2;
          const wy = village.y * TILE_SIZE + TILE_SIZE / 2;
          this._drawVillageRing(objs.ring, wx, wy, true);
          objs.hpBg.setVisible(false);
          objs.hpFill.setVisible(false);
          if (objs.lbl?.active) objs.lbl.setText('✦ Village allié').setColor('#ffd700');
        }
      } else {
        if (objs.tower?.active && objs.tower.texture?.key === 'village_tower_cap') {
          objs.tower.setTexture('village_tower');
          const wx = village.x * TILE_SIZE + TILE_SIZE / 2;
          const wy = village.y * TILE_SIZE + TILE_SIZE / 2;
          this._drawVillageRing(objs.ring, wx, wy, false);
          if (objs.lbl?.active) objs.lbl.setColor('#ff6644');
        }
        objs.hpBg?.setVisible(vis);
        objs.hpFill?.setVisible(vis);
        if (vis) {
          const barW = 56;
          const pct = village.hp / village.maxHp;
          objs.hpFill.setDisplaySize(Math.max(1, barW * pct), 7);
          const col = pct > 0.5 ? 0x22cc22 : pct > 0.25 ? 0xddaa00 : 0xcc2222;
          objs.hpFill.setFillStyle(col);
          const lvlStr = village.level ? ` Niv.${village.level}` : '';
          const capStr = village.capturingEnemyId ? ` (Prise en cours… ${village.captureTimer || 0}/8)` : '';
          if (objs.lbl?.active) objs.lbl.setText(`⚔ Village ennemi${lvlStr}${capStr}`);
        }
      }
    }
  },

  // ─── Population (SDF adults + children) ─────────────────────────────────────

  _syncSdfCitizens(population) {
    const sdfAdults = population.filter(c => !c.isChild && !c.houseId && !c.deployed);
    const seenIds = new Set(sdfAdults.map(c => c.id));

    for (const cit of sdfAdults) {
      if (!this.sdfObjects.has(cit.id)) {
        const wx = (cit.x || 8) * TILE_SIZE + TILE_SIZE / 2;
        const wy = (cit.y || 6) * TILE_SIZE + TILE_SIZE / 2;
        const img = this.add.image(wx, wy, 'unit_paysan')
          .setTint(0xff6600).setDisplaySize(32, 32).setDepth(5);
        const badge = this.add.text(wx, wy - 22, 'SDF', {
          fontFamily: 'monospace', fontSize: '9px', color: '#ff4400',
          stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(6);
        const barBg   = this.add.rectangle(wx, wy + 20, 32, 4, 0x330000).setDepth(6);
        const barFill = this.add.rectangle(wx - 16, wy + 20, 1, 4, 0xff4400).setOrigin(0, 0.5).setDepth(7);
        this.sdfObjects.set(cit.id, { img, badge, barBg, barFill, cit });
      }
      const objs = this.sdfObjects.get(cit.id);
      if (objs) {
        const pct = Math.min(1, (cit.sdfTimer || 0) / 90);
        objs.barFill.setDisplaySize(32 * pct, 4);
        objs.barFill.setFillStyle(pct > 0.6 ? 0xcc2200 : 0xff8800);
      }
    }

    for (const [id, objs] of this.sdfObjects) {
      if (!seenIds.has(id)) {
        objs.img.destroy(); objs.badge.destroy(); objs.barBg.destroy(); objs.barFill.destroy();
        this.sdfObjects.delete(id);
      }
    }
  },

  _spawnChild(cit, house) {
    const hCX = (house.x + 1) * TILE_SIZE;
    const hCY = (house.y + 1) * TILE_SIZE;
    const body  = this.add.circle(0, 0, 5, 0xffccaa).setStrokeStyle(1, 0xb88858);
    const icon  = this.add.text(0, -13, '👶', { fontSize: '9px' }).setOrigin(0.5);
    const cnt   = this.add.container(hCX, hCY, [body, icon]).setDepth(4.5);
    this.childObjects.set(cit.id, { cnt, hCX, hCY });
    this._startChildWander(cnt, hCX, hCY);
  },

  _startChildWander(cnt, hCX, hCY) {
    if (!cnt.active) return;
    const R  = TILE_SIZE * 1.6;
    const tx = hCX + (Math.random() - 0.5) * R * 2;
    const ty = hCY + (Math.random() - 0.5) * R * 2;
    this.tweens.add({
      targets: cnt,
      x: tx, y: ty,
      duration: 1600 + Math.random() * 1200,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (!cnt.active) return;
        this.time.delayedCall(400 + Math.random() * 800, () => {
          this._startChildWander(cnt, hCX, hCY);
        });
      },
    });
  },

  _syncChildren(shared) {
    const children = (shared.population || []).filter(c => c.isChild);
    const seenIds  = new Set(children.map(c => c.id));

    for (const [id, objs] of this.childObjects) {
      if (!seenIds.has(id)) {
        objs.cnt.destroy();
        this.childObjects.delete(id);
      }
    }
    for (const cit of children) {
      if (this.childObjects.has(cit.id)) continue;
      const house = shared.buildings.find(b => b.id === cit.birthHouseId);
      if (house) this._spawnChild(cit, house);
    }
  },

  // ─── Dungeons ──────────────────────────────────────────────────────────────

  _syncDungeons() {
    for (const dungeon of (this.shared.dungeons || [])) {
      if (!this.dungeonObjects.has(dungeon.id)) {
        const wx = dungeon.x * TILE_SIZE + TILE_SIZE / 2;
        const wy = dungeon.y * TILE_SIZE + TILE_SIZE / 2;
        const img = this.add.image(wx, wy, 'cave_entrance')
          .setDisplaySize(TILE_SIZE, TILE_SIZE).setDepth(3)
          .setInteractive({ useHandCursor: true });
        const lbl = this.add.text(wx, wy - 30, dungeon.artifact?.name || 'Donjon', {
          fontFamily: 'Georgia, serif', fontSize: '10px', color: '#cc88ff',
          stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(4);
        img.on('pointerdown', () => this._clickDungeon(dungeon));
        this.dungeonObjects.set(dungeon.id, { img, lbl });
      }
      const objs = this.dungeonObjects.get(dungeon.id);
      if (dungeon.cleared) {
        objs.img.setAlpha(0.3);
        objs.lbl.setText('Exploré').setColor('#666644');
      }
    }
  },

  // ─── State sync ────────────────────────────────────────────────────────────

  _applyStateUpdate(delta) {
    // Merge delta into local shared state (full snapshot on game_start, partial on tick updates)
    if (delta.units         !== undefined) this.shared.units         = delta.units;
    if (delta.buildings     !== undefined) this.shared.buildings     = delta.buildings;
    if (delta.resources     !== undefined) this.shared.resources     = delta.resources;
    if (delta.resourceNodes !== undefined) this.shared.resourceNodes = delta.resourceNodes;
    if (delta.population    !== undefined) this.shared.population    = delta.population;
    if (delta.villages      !== undefined) this.shared.villages      = delta.villages;
    if (delta.npcs          !== undefined) this.shared.npcs          = delta.npcs;
    if (delta.dungeons      !== undefined) this.shared.dungeons      = delta.dungeons;
    if (delta.nightOfBlood  !== undefined) this.shared.nightOfBlood  = delta.nightOfBlood;
    if (delta.truce         !== undefined) this.shared.truce         = delta.truce;
    const shared = this.shared;
    this.scene.get('UI')?.syncResources(shared.resources);

    const seenIds = new Set();
    for (const unit of shared.units) {
      seenIds.add(unit.id);
      const obj = this.unitObjects.get(unit.id);
      if (obj) {
        this.tweens.killTweensOf(obj);
        this.tweens.add({
          targets: obj, duration: 920, ease: 'Linear',
          x: unit.x * TILE_SIZE + TILE_SIZE / 2,
          y: unit.y * TILE_SIZE + TILE_SIZE / 2,
        });
        if (obj.hpFill) {
          const pct = unit.hp / unit.maxHp;
          obj.hpFill.setDisplaySize(40 * pct, 6);
          obj.hpFill.setFillStyle(pct > 0.5 ? 0x22cc22 : pct > 0.25 ? 0xccaa00 : 0xcc2222);
        }
      } else {
        this._spawnUnit(unit);
      }
    }

    // Remove dead units
    for (const [id, obj] of this.unitObjects) {
      if (!seenIds.has(id)) {
        obj.destroy();
        this.unitObjects.delete(id);
        if (this.gatherBadges.has(id)) {
          this.gatherBadges.get(id).destroy();
          this.gatherBadges.delete(id);
        }
      }
    }

    // Update resource visuals
    for (const node of shared.resourceNodes) {
      const obj = this.resourceObjects.get(node.id);
      if (!obj) continue;
      if (node.type === 'wood') {
        const newKey = treeTexKey(node);
        if (obj.texture?.key !== newKey) obj.setTexture(newKey);
        const scale = node.state === 'sapling' ? 0.55 : 0.9;
        obj.setScale(scale).setAlpha(1);
      } else {
        obj.setAlpha(node.amount > 0 ? 1 : 0.25);
        obj.setScale(0.45 + 0.37 * Math.max(0, node.amount / (node.maxAmount || 400)));
      }
    }

    // Spawn new buildings / update construction state
    const existingBldIds = new Set(this.buildingObjects.keys());
    for (const bld of shared.buildings) {
      if (!existingBldIds.has(bld.id)) {
        this._spawnBuilding(bld);
      } else {
        const img = this.buildingObjects.get(bld.id);
        if (!img) continue;
        if (bld.underConstruction) {
          img.setAlpha(0.45);
          const pct = bld.constructionProgress / bld.constructionTime;
          if (img._progFill) img._progFill.setDisplaySize(Math.max(1, 52 * pct), 8);
        } else {
          img.setAlpha(1);
          if (img._progBg)    { img._progBg.destroy();    img._progBg    = null; }
          if (img._progFill)  { img._progFill.destroy();  img._progFill  = null; }
          if (img._progLabel) { img._progLabel.destroy(); img._progLabel = null; }
        }
      }
    }

    // Remove dead units from group; deselect if primary is dead
    if (this.selectedUnits.length > 0) {
      this.selectedUnits = this.selectedUnits.filter(u => shared.units.find(su => su.id === u.id));
      if (this.selectedUnit && !shared.units.find(u => u.id === this.selectedUnit.id)) {
        this.selectedUnit = this.selectedUnits[0] || null;
        if (!this.selectedUnit) this._deselectAll();
        else this._updateAllRings();
      }
    }

    if (this.selectedUnit?.type === 'paysan') {
      this._showResourceHighlights(true);
    }

    // Update NPC quest badges
    for (const npc of (shared.npcs || [])) {
      const obj = this.npcObjects.get(npc.id);
      if (obj) {
        const indicator = npc.questCompleted ? '✓' : npc.questAccepted ? '❗' : '❓';
        obj.badge.setText(indicator);
        obj.npc = npc;
      }
    }

    // Update hero quest badges
    for (const unit of shared.units) {
      const obj = this.unitObjects.get(unit.id);
      if (obj?.questBadge && unit.isHero) {
        obj.questBadge.setText(unit.activeQuest ? '❗' : '✦');
      }
    }

    this._syncSdfCitizens(shared.population || []);
    this._syncChildren(shared);
    this._syncDungeons();

    // Fog must run before villages (villages visibility depends on fog state)
    this._updateFog();
    this._syncVillages();
  },

  // ─── Gathering badges ─────────────────────────────────────────────────────

  _updateGatherBadges() {
    const BADGE = { to_resource: '🚶', gathering: '⛏', to_deposit: '📦' };
    for (const unit of this.shared.units) {
      const obj = this.unitObjects.get(unit.id);
      if (!obj) continue;
      const px = obj.x, py = obj.y;
      const icon = BADGE[unit.gatherState];
      if (icon) {
        if (!this.gatherBadges.has(unit.id)) {
          const badge = this.add.text(px, py - 26, icon, { fontSize: '13px' })
            .setOrigin(0.5).setDepth(8);
          this.gatherBadges.set(unit.id, badge);
        }
        const badge = this.gatherBadges.get(unit.id);
        badge.setText(icon).setPosition(px, py - 26);
      } else {
        if (this.gatherBadges.has(unit.id)) {
          this.gatherBadges.get(unit.id).destroy();
          this.gatherBadges.delete(unit.id);
        }
      }
    }
  },

  // ─── Network event handlers ───────────────────────────────────────────────

  _showArrowShot(data) {
    const fx = this.add.graphics().setDepth(50);
    const x1 = data.fromX * TILE_SIZE + TILE_SIZE / 2;
    const y1 = data.fromY * TILE_SIZE + TILE_SIZE / 2;
    const x2 = data.toX   * TILE_SIZE + TILE_SIZE / 2;
    const y2 = data.toY   * TILE_SIZE + TILE_SIZE / 2;
    fx.lineStyle(2, 0xffcc44, 0.85);
    fx.beginPath(); fx.moveTo(x1, y1); fx.lineTo(x2, y2); fx.strokePath();
    this.tweens.add({
      targets: fx, alpha: 0, duration: 320, ease: 'Expo.easeOut',
      onComplete: () => fx.destroy(),
    });
  },

  _showNpcDialogue(npc, heroId) {
    if (this._npcDialogue) {
      this._npcDialogue.forEach(o => o.destroy());
      this._npcDialogue = null;
    }
    const { width: W, height: H } = this.cameras.main;
    const panelW = 480, panelH = 280;
    const cx = W / 2, cy = H / 2;
    const items = [];

    const bg = this.add.rectangle(cx, cy, panelW, panelH, 0x100808, 0.95)
      .setStrokeStyle(3, 0xc8960c, 0.8).setDepth(30).setScrollFactor(0);
    items.push(bg);

    const q = npc.quest;
    items.push(this.add.text(cx, cy - panelH / 2 + 20, `${npc.name}`, {
      fontFamily: 'Georgia, serif', fontSize: '16px', color: '#c8960c',
    }).setOrigin(0.5).setDepth(31).setScrollFactor(0));
    items.push(this.add.text(cx, cy - panelH / 2 + 45, `"${q.label}"`, {
      fontFamily: 'Georgia, serif', fontSize: '13px', color: '#aa8840',
    }).setOrigin(0.5).setDepth(31).setScrollFactor(0));
    items.push(this.add.text(cx, cy - panelH / 2 + 72, q.desc, {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#cfc090',
      wordWrap: { width: panelW - 40 }, align: 'center',
    }).setOrigin(0.5, 0).setDepth(31).setScrollFactor(0));

    const resCost = Object.entries(q.resReward || {}).map(([k, v]) => `${v} ${k}`).join(', ');
    items.push(this.add.text(cx, cy + 40, `Récompenses : ${q.xpReward} XP · ${resCost} · ${q.equipReward || ''}`, {
      fontFamily: 'monospace', fontSize: '10px', color: '#88cc88',
    }).setOrigin(0.5).setDepth(31).setScrollFactor(0));

    const progress = npc.questCompleted ? 'Quête terminée !' :
      npc.questAccepted ? `Progression : ${npc.questProgress || 0} / ${q.needed}` : '';
    if (progress) {
      items.push(this.add.text(cx, cy + 62, progress, {
        fontFamily: 'monospace', fontSize: '11px', color: npc.questCompleted ? '#ffd700' : '#aaaaaa',
      }).setOrigin(0.5).setDepth(31).setScrollFactor(0));
    }

    if (!npc.questAccepted && !npc.questCompleted && heroId) {
      const acceptBg = this.add.rectangle(cx, cy + panelH / 2 - 30, 180, 36, 0x1a3a20, 0.95)
        .setInteractive({ useHandCursor: true }).setStrokeStyle(2, 0x44aa66).setDepth(31).setScrollFactor(0);
      const acceptTxt = this.add.text(cx, cy + panelH / 2 - 30, '✓ Accepter la quête', {
        fontFamily: 'Georgia, serif', fontSize: '13px', color: '#88cc88',
      }).setOrigin(0.5).setDepth(32).setScrollFactor(0);
      acceptBg.on('pointerdown', () => {
        socketManager.sendAction({ type: 'ACCEPT_QUEST', npcId: npc.id, heroId });
        items.forEach(o => o.destroy()); this._npcDialogue = null;
      });
      acceptBg.on('pointerover', () => acceptBg.setStrokeStyle(2, 0xffd700));
      acceptBg.on('pointerout',  () => acceptBg.setStrokeStyle(2, 0x44aa66));
      items.push(acceptBg, acceptTxt);
    }

    const closeTxt = this.add.text(cx + panelW / 2 - 16, cy - panelH / 2 + 10, '✕', {
      fontFamily: 'sans-serif', fontSize: '16px', color: '#886630',
    }).setInteractive({ useHandCursor: true }).setOrigin(1, 0).setDepth(32).setScrollFactor(0);
    closeTxt.on('pointerdown', () => { items.forEach(o => o.destroy()); this._npcDialogue = null; });
    closeTxt.on('pointerover', () => closeTxt.setColor('#ffd700'));
    closeTxt.on('pointerout',  () => closeTxt.setColor('#886630'));
    items.push(closeTxt);

    this._npcDialogue = items;
  },

  _onVillageCaptured(data) {
    const loot = data.loot || {};
    const parts = Object.entries(loot).map(([k, v]) => `${v} ${k[0].toUpperCase()}`).join('  ');
    this.scene.get('UI')?.showMessage(`🏰 Village capturé ! +${parts}`, 0xffd700);
  },

  _onReconnected() {
    if (!this._worldReady) return;
    this.scene.get('UI')?.showMessage('✔ Reconnecté !', 0x44cc88);
  },
};