import { TILE_SIZE, MAP_W, MAP_H, IMPASSABLE } from './constants';
import { socketManager } from '../network/SocketManager';
import { BUILDING_DATA } from '../data/buildings';

// Input handling, selection, build mode, battle entry mixin — mixed into WorldScene.prototype
export const InputHandlerMixin = {

  // ─── Camera ────────────────────────────────────────────────────────────────

  _handleCameraScroll() {
    if (this._drag?.moved) return;

    const cam = this.cameras.main;
    const { width: sw, height: sh } = this.scale;
    const ptr = this.input.activePointer;
    const edge = 40, spd = this.camSpeed;
    let dx = 0, dy = 0;

    const kLeft  = this.cursors?.left.isDown  || this.wasd?.left.isDown;
    const kRight = this.cursors?.right.isDown || this.wasd?.right.isDown;
    const kUp    = this.cursors?.up.isDown    || this.wasd?.up.isDown;
    const kDown  = this.cursors?.down.isDown  || this.wasd?.down.isDown;

    const isMouse = ptr.button !== undefined && !this.sys.game.device.os.android && !this.sys.game.device.os.iOS;
    const eLeft  = isMouse && ptr.x < edge;
    const eRight = isMouse && ptr.x > sw - edge;
    const eUp    = isMouse && ptr.y < edge;
    const eDown  = isMouse && ptr.y > sh - edge;

    if (kLeft  || eLeft)  dx = -spd;
    else if (kRight || eRight) dx =  spd;
    if (kUp    || eUp)    dy = -spd;
    else if (kDown  || eDown)  dy =  spd;

    if (dx !== 0) cam.scrollX += dx;
    if (dy !== 0) cam.scrollY += dy;
  },

  // ─── Pointer down / up ────────────────────────────────────────────────────

  _onPointerDown(ptr) {
    const ptrs = this.input.manager.pointers.filter(p => p.isDown);

    if (ptrs.length === 2) {
      const [a, b] = ptrs;
      this._pinch = { dist: Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y), zoom: this.cameras.main.zoom };
      this._drag  = null;
      return;
    }

    if (ptr.rightButtonDown()) {
      this._cancelBuildMode();
      this._deselectAll();
      return;
    }

    const cam = this.cameras.main;
    const wp0 = cam.getWorldPoint(ptr.x, ptr.y);
    const isShift = !!(ptr.event?.shiftKey);
    this._drag = { x: ptr.x, y: ptr.y, camX: cam.scrollX, camY: cam.scrollY, moved: false,
                   shift: isShift, worldX: wp0.x, worldY: wp0.y };
  },

  _onPointerUp(ptr) {
    if (this._drag?.moved && this._drag.shift) {
      const cam = this.cameras.main;
      const wp = cam.getWorldPoint(ptr.x, ptr.y);
      this.selectBox.clear();
      const tx0 = Math.min(this._drag.worldX, wp.x) / TILE_SIZE;
      const ty0 = Math.min(this._drag.worldY, wp.y) / TILE_SIZE;
      const tx1 = Math.max(this._drag.worldX, wp.x) / TILE_SIZE;
      const ty1 = Math.max(this._drag.worldY, wp.y) / TILE_SIZE;
      const inBox = this.shared.units.filter(u =>
        u.owner === 'player' && u.x >= tx0 && u.x <= tx1 && u.y >= ty0 && u.y <= ty1
      );
      if (inBox.length > 0) {
        this._deselectAll();
        this.selectedUnits = [...inBox];
        this.selectedUnit  = inBox[0];
        this._updateAllRings();
        this.scene.get('UI')?.showUnitPanel(this.selectedUnit);
        if (inBox.length > 1) this.scene.get('UI')?.showMessage(`${inBox.length} unités groupées`, 0x44aaff);
      }
    } else if (this._drag && !this._drag.moved) {
      this._onWorldClick(ptr);
    }
    this.selectBox?.clear();
    this._drag  = null;
    this._pinch = null;
  },

  // ─── Mouse / touch move ───────────────────────────────────────────────────

  _onMouseMove(ptr) {
    const ptrs = this.input.manager.pointers.filter(p => p.isDown);

    // Pinch zoom (2 fingers)
    if (ptrs.length === 2 && this._pinch) {
      const [a, b] = ptrs;
      const newDist = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
      const scale   = newDist / this._pinch.dist;
      const cam     = this.cameras.main;
      const midX    = (a.x + b.x) / 2;
      const midY    = (a.y + b.y) / 2;
      const wp0     = cam.getWorldPoint(midX, midY);
      cam.setZoom(Phaser.Math.Clamp(this._pinch.zoom * scale, 0.3, 2.5));
      const wp1 = cam.getWorldPoint(midX, midY);
      cam.scrollX -= (wp1.x - wp0.x);
      cam.scrollY -= (wp1.y - wp0.y);
      return;
    }

    // Single-finger / mouse drag
    if (this._drag && ptr.isDown && !this.buildMode) {
      const dx = ptr.x - this._drag.x;
      const dy = ptr.y - this._drag.y;
      if (!this._drag.moved && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        this._drag.moved = true;
      }
      // Shift+drag → box selection rectangle (no camera pan)
      if (this._drag.moved && this._drag.shift) {
        const cam = this.cameras.main;
        const wp = cam.getWorldPoint(ptr.x, ptr.y);
        this.selectBox.clear();
        this.selectBox.lineStyle(2, 0x44aaff, 0.9);
        this.selectBox.fillStyle(0x44aaff, 0.08);
        const bx = Math.min(this._drag.worldX, wp.x);
        const by = Math.min(this._drag.worldY, wp.y);
        const bw = Math.abs(wp.x - this._drag.worldX);
        const bh = Math.abs(wp.y - this._drag.worldY);
        this.selectBox.fillRect(bx, by, bw, bh);
        this.selectBox.strokeRect(bx, by, bw, bh);
        return;
      }
      if (this._drag.moved) {
        const cam = this.cameras.main;
        cam.scrollX = this._drag.camX - dx / cam.zoom;
        cam.scrollY = this._drag.camY - dy / cam.zoom;
        return;
      }
    }

    const wp = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
    const tx = Math.floor(wp.x / TILE_SIZE);
    const ty = Math.floor(wp.y / TILE_SIZE);

    // Build mode
    if (this.buildMode) {
      const inTerritory = this._isInTerritory(tx, ty);
      this.buildCursor.setPosition(tx * TILE_SIZE, ty * TILE_SIZE).setVisible(true);
      this.buildCursor.setFillStyle(inTerritory ? 0x00ff00 : 0xff2200, inTerritory ? 0.22 : 0.30);
      this.buildCursor.setStrokeStyle(2, inTerritory ? 0x00ff00 : 0xff2200, inTerritory ? 0.8 : 0.9);
      this._setCursor(inTerritory ? 'crosshair' : 'not-allowed');
      this.hoverGfx.clear();

      // Wall drag: paint while holding
      if (this.buildMode === 'wall' && ptr.isDown) {
        const key = `${tx},${ty}`;
        if (key !== this._lastWallTile) {
          this._lastWallTile = key;
          socketManager.sendAction({ type: 'PLACE_BUILDING', buildingType: 'wall', tx, ty });
        }
      }
      return;
    }

    this.buildCursor.setVisible(false);

    const unit        = this.shared.units.find(u => u.x === tx && u.y === ty);
    const resource    = this.shared.resourceNodes.find(r => r.x === tx && r.y === ty && r.amount > 0);
    const building    = this._buildingAt(tx, ty);
    const villageTower = (this.shared.villages || []).find(v => !v.capturedBy && v.x === tx && v.y === ty);
    const tileIdx     = this.mapData[ty]?.[tx];
    const walkable    = tileIdx !== undefined && !IMPASSABLE.has(tileIdx);

    // Hover highlight
    this.hoverGfx.clear();
    if (tx >= 0 && tx < MAP_W && ty >= 0 && ty < MAP_H) {
      const isAttackable = (unit && (unit.owner === 'enemy' || unit.owner === 'neutral') && this.selectedUnit)
                        || (villageTower && this.selectedUnit);
      if (isAttackable) {
        this.hoverGfx.lineStyle(2, 0xff3322, 0.75);
        this.hoverGfx.strokeRect(tx * TILE_SIZE + 1, ty * TILE_SIZE + 1, TILE_SIZE - 2, TILE_SIZE - 2);
        this.hoverGfx.fillStyle(0xff3322, 0.10);
        this.hoverGfx.fillRect(tx * TILE_SIZE + 1, ty * TILE_SIZE + 1, TILE_SIZE - 2, TILE_SIZE - 2);
      } else {
        this.hoverGfx.lineStyle(1, 0xffffff, 0.18);
        this.hoverGfx.strokeRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }

    // Cursor icon
    if (villageTower && this.selectedUnit) {
      this._setCursor('crosshair');
    } else if (unit) {
      if ((unit.owner === 'enemy' || unit.owner === 'neutral') && this.selectedUnit) this._setCursor('crosshair');
      else if (unit.owner === 'player') this._setCursor('pointer');
      else                              this._setCursor('default');
    } else if (resource && this.selectedUnit?.type === 'paysan') {
      this._setCursor('cell');
    } else if (building) {
      this._setCursor('pointer');
    } else if (this.selectedUnit) {
      this._setCursor(walkable ? 'move' : 'not-allowed');
    } else {
      this._setCursor('default');
    }

    // Terrain tooltip
    const TILE_LABELS = [
      'Herbe', 'Herbe sombre', 'Eau', 'Sable', 'Terre',
      'Forêt', 'Montagne',
      'Marais', 'Chemin', 'Eau peu profonde', 'Neige', 'Ruines', 'Terres cultivées',
    ];
    const TILE_SPEED = { 7: '×0.45 vitesse', 8: '×1.6 vitesse', 9: '×0.55 vitesse' };
    if (tx >= 0 && tx < MAP_W && ty >= 0 && ty < MAP_H && tileIdx !== undefined) {
      const label = TILE_LABELS[tileIdx] || 'Inconnu';
      const speed = TILE_SPEED[tileIdx] ? `  (${TILE_SPEED[tileIdx]})` : '';
      this._tileTooltip.setText(`${label}${speed}`).setVisible(true);
    } else {
      this._tileTooltip.setVisible(false);
    }
  },

  _setCursor(type) {
    this.game.canvas.style.cursor = type;
  },

  // ─── Click ────────────────────────────────────────────────────────────────

  _onWorldClick(ptr) {
    const wp = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
    const tx = Math.floor(wp.x / TILE_SIZE);
    const ty = Math.floor(wp.y / TILE_SIZE);
    const isShift = !!(ptr.event?.shiftKey);

    if (this.buildMode) {
      if (!this._isInTerritory(tx, ty)) {
        this.scene.get('UI')?.showMessage('⚠ Hors territoire ! Capturez un village pour étendre votre zone.', 0xff6622);
        return;
      }
      socketManager.sendAction({ type: 'PLACE_BUILDING', buildingType: this.buildMode, tx, ty });
      if (this.buildMode === 'wall') {
        this._lastWallTile = `${tx},${ty}`;
      } else {
        this._cancelBuildMode();
      }
      return;
    }

    // Village tower at tile?
    const tower = (this.shared.villages || []).find(v => !v.capturedBy && v.x === tx && v.y === ty);
    if (tower && this.selectedUnit) {
      socketManager.sendAction({ type: 'MOVE_UNIT', unitId: this.selectedUnit.id, tx, ty });
      const support = this.selectedUnits.filter(u => u.id !== this.selectedUnit.id);
      const suppOffsets = [[2,0],[-2,0],[0,2],[0,-2],[2,1],[-2,1],[1,2],[-1,2]];
      support.forEach((u, i) => {
        const o = suppOffsets[i % suppOffsets.length];
        socketManager.sendAction({ type: 'MOVE_UNIT', unitId: u.id, tx: tx + o[0], ty: ty + o[1] });
      });
      this.scene.get('UI')?.showMessage('⚔ Siège de la tour ennemie !', 0xff8800);
      this._deselectAll();
      return;
    }

    // NPC at tile?
    const npc = (this.shared.npcs || []).find(n => n.x === tx && n.y === ty);
    if (npc && this.selectedUnit?.isHero) {
      const hero = this.selectedUnit;
      const dist = Math.abs(tx - hero.x) + Math.abs(ty - hero.y);
      const walkMs = this._walkMs(hero, dist);
      if (dist > 0) socketManager.sendAction({ type: 'MOVE_UNIT', unitId: hero.id, tx, ty });
      this._animWalkTo(hero.id, tx, ty, walkMs);
      this.time.delayedCall(walkMs, () => socketManager.sendAction({ type: 'INTERACT_NPC', npcId: npc.id }));
      this._deselectAll();
      return;
    }

    // Unit at tile?
    const unit = this.shared.units.find(u => u.x === tx && u.y === ty);
    if (unit) {
      if (this.selectedUnit && (unit.owner === 'enemy' || unit.owner === 'neutral')) {
        const attacker = this.selectedUnit;
        const dist = Math.abs(tx - attacker.x) + Math.abs(ty - attacker.y);
        const walkMs = this._walkMs(attacker, dist);
        socketManager.sendAction({ type: 'MOVE_UNIT', unitId: attacker.id, tx, ty });
        this._pendingBattleWalk = { unitId: attacker.id, tx, ty, walkMs, sentAt: Date.now() };
        const support = this.selectedUnits.filter(u => u.id !== attacker.id);
        const suppOffsets = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
        support.forEach((u, i) => {
          const o = suppOffsets[i % suppOffsets.length];
          socketManager.sendAction({ type: 'MOVE_UNIT', unitId: u.id, tx: tx + o[0], ty: ty + o[1] });
        });
        this._deselectAll();
      } else if (unit.owner === 'player') {
        this._selectUnit(unit, isShift);
      }
      return;
    }

    // Resource + paysan selected → gather
    const resource = this.shared.resourceNodes.find(r => r.x === tx && r.y === ty && r.amount > 0);
    if (resource && this.selectedUnit?.type === 'paysan') {
      socketManager.sendAction({ type: 'GATHER', unitId: this.selectedUnit.id, resourceId: resource.id });
      this.scene.get('UI')?.showMessage(`Paysan → récolte de ${resource.type}`, 0x88cc44);
      this._deselectAll();
      return;
    }

    // Building?
    const building = this._buildingAt(tx, ty);
    if (building) {
      this._selectBuilding(building);
      return;
    }

    // Move selected unit(s)
    if (this.selectedUnit) {
      if (this.selectedUnits.length > 1) {
        const FORMATION = [
          [0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1],
          [2,0],[-2,0],[0,2],[0,-2],[2,1],[1,2],[-1,2],[-2,1],[-2,-1],[-1,-2],[1,-2],[2,-1],
        ];
        this.selectedUnits.forEach((u, i) => {
          const o = FORMATION[i] || FORMATION[FORMATION.length - 1];
          socketManager.sendAction({ type: 'MOVE_UNIT', unitId: u.id, tx: tx + o[0], ty: ty + o[1] });
        });
      } else {
        socketManager.sendAction({ type: 'MOVE_UNIT', unitId: this.selectedUnit.id, tx, ty });
      }
      this._deselectAll();
      return;
    }

    this._deselectAll();
  },

  // ─── Building hit-test ─────────────────────────────────────────────────────

  _buildingAt(tx, ty) {
    return this.shared.buildings.find(b => {
      if (b.type === 'wall') return b.x === tx && b.y === ty;
      const cx = b.x + 1, cy = b.y + 1;
      return tx >= cx - 1 && tx <= cx + 1 && ty >= cy - 1 && ty <= cy + 1;
    });
  },

  // ─── Selection ─────────────────────────────────────────────────────────────

  _selectUnit(unit, additive = false) {
    if (additive) {
      const idx = this.selectedUnits.findIndex(u => u.id === unit.id);
      if (idx >= 0) {
        this.selectedUnits.splice(idx, 1);
      } else {
        this.selectedUnits.push(unit);
      }
      this.selectedUnit = this.selectedUnits[this.selectedUnits.length - 1] || null;
    } else {
      this._deselectAll();
      this.selectedUnits = [unit];
      this.selectedUnit  = unit;
    }
    this._updateAllRings();
    if (this.selectedUnits.length > 1) {
      this.scene.get('UI')?.showMessage(`${this.selectedUnits.length} unités groupées`, 0x44aaff);
    }
    if (this.selectedUnit) this.scene.get('UI')?.showUnitPanel(this.selectedUnit);
    if (unit.type === 'paysan') {
      this._showResourceHighlights(true);
      this.scene.get('UI')?.showMessage('Sélectionnez une ressource à récolter', 0x88cc44);
    }
  },

  _selectBuilding(building) {
    if (building.owner === 'neutral' || building.owner === 'enemy') return;
    this._deselectAll();
    this.selectedBuilding = building;
    const pop = this.shared.population || [];
    const popInfo = {
      residents:      pop.filter(c => !c.isChild && c.houseId === building.id).length,
      child:          pop.find(c => c.isChild && c.birthHouseId === building.id) || null,
      availableAdults: pop.filter(c => !c.isChild && c.houseId && !c.deployed).length,
      sdfCount:       pop.filter(c => !c.isChild && !c.houseId && !c.deployed).length,
    };
    this.scene.get('UI')?.showBuildingPanel(building, (unitType) => {
      socketManager.sendAction({ type: 'TRAIN_UNIT', buildingId: building.id, unitType });
    }, popInfo, (buildingId) => {
      socketManager.sendAction({ type: 'DEMOLISH_BUILDING', buildingId });
    });
  },

  _deselectAll() {
    this.selectedUnit     = null;
    this.selectedUnits    = [];
    this.selectedBuilding = null;
    this.selectionRing.setVisible(false);
    this._hideGroupRings();
    this._showResourceHighlights(false);
    this.scene.get('UI')?.hidePanel();
  },

  // ─── Group ring helpers ────────────────────────────────────────────────────

  _getGroupRing(i) {
    while (this.groupRings.length <= i) {
      const r = this.add.image(0, 0, 'selection_ring')
        .setVisible(false).setDepth(4.8).setTint(0x44aaff).setAlpha(0.75);
      this.groupRings.push(r);
    }
    return this.groupRings[i];
  },

  _hideGroupRings() {
    for (const r of this.groupRings) r.setVisible(false);
  },

  _updateAllRings() {
    this._hideGroupRings();
    let gi = 0;
    for (const u of this.selectedUnits) {
      const obj = this.unitObjects.get(u.id);
      if (!obj) continue;
      if (u.id === this.selectedUnit?.id) {
        this.selectionRing.setPosition(obj.x, obj.y).setVisible(true);
      } else {
        this._getGroupRing(gi++).setPosition(obj.x, obj.y).setVisible(true);
      }
    }
    if (!this.selectedUnit) this.selectionRing.setVisible(false);
  },

  _updateSelectionRing() {
    if (!this.selectedUnit && !this.selectedUnits.length) return;
    const obj = this.unitObjects.get(this.selectedUnit?.id);
    if (obj) this.selectionRing.setPosition(obj.x, obj.y).setVisible(true);
    let gi = 0;
    for (const u of this.selectedUnits) {
      if (u.id === this.selectedUnit?.id) continue;
      const uObj = this.unitObjects.get(u.id);
      const r = this.groupRings[gi];
      if (r && uObj) r.setPosition(uObj.x, uObj.y);
      gi++;
    }
  },

  // ─── Resource highlights ──────────────────────────────────────────────────

  _showResourceHighlights(show) {
    if (this.resHighlightTween) { this.resHighlightTween.stop(); this.resHighlightTween = null; }
    this.resHighlightGfx.clear();
    if (!show) { this.resHighlightGfx.setAlpha(1); return; }

    for (const node of this.shared.resourceNodes) {
      if (node.amount <= 0) continue;
      if (node.type === 'wood' && node.state && node.state !== 'alive') {
        this.resHighlightGfx.lineStyle(1, 0x887755, 0.35);
        this.resHighlightGfx.strokeCircle(node.x * TILE_SIZE + TILE_SIZE / 2, node.y * TILE_SIZE + TILE_SIZE / 2, 22);
        continue;
      }
      const px = node.x * TILE_SIZE + TILE_SIZE / 2;
      const py = node.y * TILE_SIZE + TILE_SIZE / 2;
      const colors = { wood: 0x88cc44, stone: 0xaaaaaa, gold: 0xffd700, food: 0xffaa00 };
      this.resHighlightGfx.lineStyle(2, colors[node.type] || 0xffffff, 0.85);
      this.resHighlightGfx.strokeCircle(px, py, 26);
      this.resHighlightGfx.lineStyle(1, colors[node.type] || 0xffffff, 0.3);
      this.resHighlightGfx.strokeRect(node.x * TILE_SIZE + 2, node.y * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    }

    this.resHighlightTween = this.tweens.add({
      targets: this.resHighlightGfx,
      alpha: { from: 1, to: 0.35 },
      duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  },

  // ─── Build mode ───────────────────────────────────────────────────────────

  _isInTerritory(tx, ty) {
    if (this.buildMode === 'wall') return true;
    const TOWN_R = 22, VILLAGE_R = 16;
    const halls = this.shared.buildings.filter(b => b.type === 'town_hall' && b.owner !== 'enemy');
    const captured = (this.shared.villages || []).filter(v => v.capturedBy);
    return halls.some(h => Math.abs(h.x - tx) + Math.abs(h.y - ty) <= TOWN_R)
        || captured.some(v => Math.abs(v.x - tx) + Math.abs(v.y - ty) <= VILLAGE_R);
  },

  _enterBuildMode(type) {
    this.buildMode = type;
    this.buildCursor.setVisible(true);
    this.scene.get('UI')?.showMessage(`Cliquez pour poser : ${BUILDING_DATA[type]?.label}`, 0xffd700);
    this.scene.get('UI')?.showCancelBtn();
    this._drawTerritoryOverlay();
  },

  _cancelBuildMode() {
    this.buildMode = null;
    this.buildCursor.setVisible(false);
    this._setCursor('default');
    this.scene.get('UI')?._hideCancelBtn();
    this.territoryGfx?.clear();
  },

  _drawTerritoryOverlay() {
    if (!this.territoryGfx) {
      this.territoryGfx = this.add.graphics().setDepth(1.6);
    }
    const g = this.territoryGfx;
    g.clear();

    const TOWN_R = 22, VILLAGE_R = 16;
    const halls = this.shared.buildings.filter(b => b.type === 'town_hall' && b.owner !== 'enemy');
    const captured = (this.shared.villages || []).filter(v => v.capturedBy);

    for (const h of halls) {
      const cx = (h.x + 1) * TILE_SIZE, cy = (h.y + 1) * TILE_SIZE;
      const r = TOWN_R * TILE_SIZE;
      g.fillStyle(0x44aaff, 0.06); g.fillCircle(cx, cy, r);
      g.lineStyle(2, 0x44aaff, 0.30); g.strokeCircle(cx, cy, r);
    }
    for (const v of captured) {
      const cx = v.x * TILE_SIZE + TILE_SIZE / 2, cy = v.y * TILE_SIZE + TILE_SIZE / 2;
      const r = VILLAGE_R * TILE_SIZE;
      g.fillStyle(0xffd700, 0.05); g.fillCircle(cx, cy, r);
      g.lineStyle(2, 0xffd700, 0.28); g.strokeCircle(cx, cy, r);
    }
  },

  // ─── Dungeon ──────────────────────────────────────────────────────────────

  _clickDungeon(dungeon) {
    if (dungeon.cleared) {
      this.scene.get('UI')?.showMessage('Ce donjon a déjà été exploré.', 0x666644);
      return;
    }
    if (!this.selectedUnit) {
      this.scene.get('UI')?.showMessage('Sélectionnez une unité pour explorer le donjon', 0x8855cc);
      return;
    }
    socketManager.sendAction({ type: 'ENTER_DUNGEON', dungeonId: dungeon.id, unitId: this.selectedUnit.id });
    this.scene.get('UI')?.showMessage(`⚔ ${this.selectedUnit.type} entre dans le donjon…`, 0x8855cc);
    this._deselectAll();
  },

  // ─── Walk helpers ─────────────────────────────────────────────────────────

  _walkMs(unit, dist) {
    const SPEEDS = { roi_guerrier: 1.8, chasseresse: 1.8, mage_arcane: 1.8,
                     paladin: 1.8, assassin: 1.8, necromancien: 1.8,
                     chevalier: 1.4, homme_armes: 1.4, garde_roi: 1.4,
                     croise: 1.4, frere_epee: 1.4, compagnie_loup: 1.4,
                     archer: 1.2, mercenaire: 1.2 };
    const speed = SPEEDS[unit?.type] || 1.0;
    return Math.max(200, Math.min(dist, 5) * Math.round(220 / speed));
  },

  _animWalkTo(unitId, tx, ty, walkMs) {
    const obj = this.unitObjects.get(unitId);
    if (!obj || walkMs <= 0) return;
    this.tweens.killTweensOf(obj);
    this.tweens.add({
      targets: obj,
      x: tx * TILE_SIZE + TILE_SIZE / 2,
      y: ty * TILE_SIZE + TILE_SIZE / 2,
      duration: walkMs,
      ease: 'Linear',
    });
  },

  // ─── Battle entry ─────────────────────────────────────────────────────────

  _enterBattle(battle) {
    const pending = this._pendingBattleWalk;
    this._pendingBattleWalk = null;

    if (pending) {
      const elapsed   = Date.now() - pending.sentAt;
      const remaining = Math.max(0, pending.walkMs - elapsed);
      this._animWalkTo(pending.unitId, pending.tx, pending.ty, remaining);
      if (remaining > 0) {
        this.time.delayedCall(remaining, () => this._doEnterBattle(battle));
        return;
      }
    }
    this._doEnterBattle(battle);
  },

  _doEnterBattle(battle) {
    if (this.scene.isActive('Battle') || this.scene.isPaused('World')) return;
    this.scene.launch('Battle', { battle, worldScene: this });
    this.scene.pause('World');
  },
};