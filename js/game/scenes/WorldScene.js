import Phaser from 'phaser';
import { socketManager } from '../network/SocketManager';
import { BUILDING_DATA } from '../data/buildings';

const TILE_SIZE = 48;
const MAP_W = 80;
const MAP_H = 60;

const TILE_KEYS = ['tile_grass', 'tile_dark_grass', 'tile_water', 'tile_sand', 'tile_dirt', 'tile_forest', 'tile_mountain'];
const RESOURCE_KEYS = { wood: 'res_wood', stone: 'res_stone', gold: 'res_gold', food: 'res_food' };

// Tile indices that block movement (must match GameRoom.js T values)
const IMPASSABLE = new Set([2, 6]); // WATER=2, MOUNTAIN=6

// Vision radius per unit/building type (fog of war)
const UNIT_VISION = {
  paysan: 2,
  homme_armes: 4, archer: 4, mercenaire: 4, compagnie_loup: 4,
  chevalier: 5, garde_roi: 5, croise: 5, frere_epee: 5, banniere_rouge: 5,
};
const BLD_VISION = { town_hall: 7, tower: 5, wall: 2 };

export class WorldScene extends Phaser.Scene {
  constructor() { super('World'); }

  init(data) {
    this.snapshot = data.snapshot;
    this.shared = data.snapshot.shared;
    this.players = data.snapshot.players;
    this.mapData = data.snapshot.map;
    this.selectedUnit = null;
    this.selectedBuilding = null;
    this.buildMode = null;
    this.unitObjects = new Map();
    this.buildingObjects = new Map();
    this.resourceObjects = new Map();
    this.visitedTiles = new Set(); // fog of war memory
  }

  create() {
    // ── Camera ────────────────────────────────────────────────────────────────
    this.cameras.main.setBounds(0, 0, MAP_W * TILE_SIZE, MAP_H * TILE_SIZE);

    // ── Ground (baked into one RenderTexture) ─────────────────────────────────
    const rt = this.add.renderTexture(0, 0, MAP_W * TILE_SIZE, MAP_H * TILE_SIZE).setOrigin(0);
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        rt.draw(TILE_KEYS[this.mapData[y][x]] || 'tile_grass', x * TILE_SIZE, y * TILE_SIZE);
      }
    }

    // ── Subtle grid ───────────────────────────────────────────────────────────
    const gg = this.add.graphics();
    gg.lineStyle(1, 0x000000, 0.06);
    for (let x = 0; x <= MAP_W; x++) gg.moveTo(x * TILE_SIZE, 0).lineTo(x * TILE_SIZE, MAP_H * TILE_SIZE);
    for (let y = 0; y <= MAP_H; y++) gg.moveTo(0, y * TILE_SIZE).lineTo(MAP_W * TILE_SIZE, y * TILE_SIZE);
    gg.strokePath();

    // ── Resource highlight overlay (shown when paysan selected) ───────────────
    this.resHighlightGfx = this.add.graphics().setDepth(1.5);
    this.resHighlightTween = null;

    // ── Hover tile highlight ──────────────────────────────────────────────────
    this.hoverGfx = this.add.graphics().setDepth(1.8);

    // ── Build cursor ──────────────────────────────────────────────────────────
    this.buildCursor = this.add.rectangle(0, 0, TILE_SIZE * 2, TILE_SIZE * 2, 0x00ff00, 0.22)
      .setStrokeStyle(2, 0x00ff00, 0.8).setOrigin(0).setVisible(false).setDepth(1.9);

    // ── Game objects ──────────────────────────────────────────────────────────
    for (const node of this.shared.resourceNodes) this._spawnResource(node);
    for (const bld  of this.shared.buildings)     this._spawnBuilding(bld);
    for (const unit of this.shared.units)         this._spawnUnit(unit);

    // ── Input ─────────────────────────────────────────────────────────────────
    this.input.on('pointerdown', this._onWorldClick, this);
    this.input.on('pointermove', this._onMouseMove,  this);

    // ── Keyboard ──────────────────────────────────────────────────────────────
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd    = this.input.keyboard.addKeys({ up: 'W', left: 'A', down: 'S', right: 'D' });
    this.camSpeed = 8;
    this.input.keyboard.on('keydown-ESC', () => this._cancelBuildMode());

    // ── Wall drag state ───────────────────────────────────────────────────────
    this._lastWallTile = null;

    // ── Selection ring ────────────────────────────────────────────────────────
    this.selectionRing = this.add.image(0, 0, 'selection_ring').setVisible(false).setDepth(5);

    // ── Gathering badge (small icon following gathering workers) ──────────────
    this.gatherBadges = new Map(); // unitId -> text

    // ── Zoom toward cursor ────────────────────────────────────────────────────
    this.input.on('wheel', (ptr, _obj, _dx, dy) => {
      const cam = this.cameras.main;
      const wp0 = cam.getWorldPoint(ptr.x, ptr.y);
      const newZoom = Phaser.Math.Clamp(cam.zoom - dy * 0.0008, 0.3, 2.5);
      cam.setZoom(newZoom);
      const wp1 = cam.getWorldPoint(ptr.x, ptr.y);
      cam.scrollX -= (wp1.x - wp0.x);
      cam.scrollY -= (wp1.y - wp0.y);
    });

    // ── Fog of war ────────────────────────────────────────────────────────────
    // depth 20: above all world objects (units are 6, badges 8)
    this.fogGfx = this.add.graphics().setDepth(20);
    this._updateFog();

    // ── Network ───────────────────────────────────────────────────────────────
    socketManager
      .on('state_update', (data) => this._applyStateUpdate(data.shared))
      .on('battle_start', (data) => this._enterBattle(data.battle))
      .on('battle_update', (data) => this._applyStateUpdate(data.shared))
      .on('battle_end',   (data) => this._applyStateUpdate(data.shared))
      .on('player_left',  ()     => this.scene.get('UI')?.showMessage('Votre allié a quitté la partie !', 0xff4444));

    // ── HUD ───────────────────────────────────────────────────────────────────
    this.scene.launch('UI', { shared: this.shared, onBuild: (type) => this._enterBuildMode(type) });

    // Center camera on first town hall
    const th = this.shared.buildings.find(b => b.type === 'town_hall');
    if (th) this.cameras.main.centerOn((th.x + 1) * TILE_SIZE, (th.y + 1) * TILE_SIZE);
  }

  update() {
    this._handleCameraScroll();
    this._updateSelectionRing();
    this._updateGatherBadges();
    this.scene.get('UI')?.syncResources(this.shared.resources);
  }

  // ─── Camera ───────────────────────────────────────────────────────────────

  _handleCameraScroll() {
    const cam = this.cameras.main;
    const { width: sw, height: sh } = this.scale;
    const ptr = this.input.activePointer;
    const edge = 40, spd = this.camSpeed;
    let dx = 0, dy = 0;

    if (this.cursors.left.isDown  || this.wasd.left.isDown  || ptr.x < edge)       dx = -spd;
    else if (this.cursors.right.isDown || this.wasd.right.isDown || ptr.x > sw - edge) dx =  spd;
    if (this.cursors.up.isDown    || this.wasd.up.isDown    || ptr.y < edge)       dy = -spd;
    else if (this.cursors.down.isDown  || this.wasd.down.isDown  || ptr.y > sh - edge) dy =  spd;

    if (dx !== 0) cam.scrollX += dx;
    if (dy !== 0) cam.scrollY += dy;
  }

  // ─── Mouse ────────────────────────────────────────────────────────────────

  _onMouseMove(ptr) {
    const wp = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
    const tx = Math.floor(wp.x / TILE_SIZE);
    const ty = Math.floor(wp.y / TILE_SIZE);

    // Build mode
    if (this.buildMode) {
      this.buildCursor.setPosition(tx * TILE_SIZE, ty * TILE_SIZE).setVisible(true);
      this._setCursor('crosshair');
      this.hoverGfx.clear();

      // Wall drag: paint while holding mouse button
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

    // Determine what's under the cursor
    const unit     = this.shared.units.find(u => u.x === tx && u.y === ty);
    const resource = this.shared.resourceNodes.find(r => r.x === tx && r.y === ty && r.amount > 0);
    const building = this._buildingAt(tx, ty);
    const tileIdx  = this.mapData[ty]?.[tx];
    const walkable = tileIdx !== undefined && !IMPASSABLE.has(tileIdx);

    // Hover highlight
    this.hoverGfx.clear();
    if (tx >= 0 && tx < MAP_W && ty >= 0 && ty < MAP_H) {
      this.hoverGfx.lineStyle(1, 0xffffff, 0.18);
      this.hoverGfx.strokeRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }

    // Cursor icon
    if (unit) {
      if (unit.owner === 'enemy' && this.selectedUnit) this._setCursor('crosshair');
      else                                              this._setCursor('pointer');
    } else if (resource && this.selectedUnit?.type === 'paysan') {
      this._setCursor('cell');
    } else if (building) {
      this._setCursor('pointer');
    } else if (this.selectedUnit) {
      this._setCursor(walkable ? 'move' : 'not-allowed');
    } else {
      this._setCursor('default');
    }
  }

  _setCursor(type) {
    this.game.canvas.style.cursor = type;
  }

  // ─── Click ────────────────────────────────────────────────────────────────

  _onWorldClick(ptr) {
    if (ptr.rightButtonDown()) {
      this._cancelBuildMode();
      this._deselectAll();
      return;
    }

    const wp = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
    const tx = Math.floor(wp.x / TILE_SIZE);
    const ty = Math.floor(wp.y / TILE_SIZE);

    if (this.buildMode) {
      socketManager.sendAction({ type: 'PLACE_BUILDING', buildingType: this.buildMode, tx, ty });
      if (this.buildMode === 'wall') {
        // Stay in wall mode — allow painting more walls
        this._lastWallTile = `${tx},${ty}`;
      } else {
        this._cancelBuildMode();
      }
      return;
    }

    // Unit at tile?
    const unit = this.shared.units.find(u => u.x === tx && u.y === ty);
    if (unit) {
      if (this.selectedUnit && unit.owner === 'enemy') {
        socketManager.sendAction({ type: 'MOVE_UNIT', unitId: this.selectedUnit.id, tx, ty });
        this._deselectAll();
      } else if (unit.owner !== 'enemy') {
        this._selectUnit(unit);
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

    // Building? (check visual footprint, not just origin tile)
    const building = this._buildingAt(tx, ty);
    if (building) {
      this._selectBuilding(building);
      return;
    }

    // Move selected unit
    if (this.selectedUnit) {
      socketManager.sendAction({ type: 'MOVE_UNIT', unitId: this.selectedUnit.id, tx, ty });
      this._deselectAll();
      return;
    }

    this._deselectAll();
  }

  // ─── Building hit-test ─────────────────────────────────────────────────────
  // Buildings are rendered centered at (bld.x+1, bld.y+1) in tile coords.
  // Visual footprint: ±1 tile for town_hall (96px), ±~0.7 tile otherwise.
  // We check a 3×3 tile area for all building types — generous but never wrong.

  _buildingAt(tx, ty) {
    return this.shared.buildings.find(b => {
      if (b.type === 'wall') return b.x === tx && b.y === ty;
      const cx = b.x + 1, cy = b.y + 1;
      return tx >= cx - 1 && tx <= cx + 1 && ty >= cy - 1 && ty <= cy + 1;
    });
  }

  // ─── Selection ────────────────────────────────────────────────────────────

  _selectUnit(unit) {
    this._deselectAll();
    this.selectedUnit = unit;
    const obj = this.unitObjects.get(unit.id);
    if (obj) this.selectionRing.setPosition(obj.x, obj.y).setVisible(true).setDepth(4);
    this.scene.get('UI')?.showUnitPanel(unit);

    // If paysan: highlight all available resources
    if (unit.type === 'paysan') {
      this._showResourceHighlights(true);
      this.scene.get('UI')?.showMessage('Sélectionnez une ressource à récolter', 0x88cc44);
    }
  }

  _selectBuilding(building) {
    this._deselectAll();
    this.selectedBuilding = building;
    this.scene.get('UI')?.showBuildingPanel(building, (unitType) => {
      socketManager.sendAction({ type: 'TRAIN_UNIT', buildingId: building.id, unitType });
    });
  }

  _deselectAll() {
    this.selectedUnit = null;
    this.selectedBuilding = null;
    this.selectionRing.setVisible(false);
    this._showResourceHighlights(false);
    this.scene.get('UI')?.hidePanel();
  }

  // ─── Resource highlights ──────────────────────────────────────────────────

  _showResourceHighlights(show) {
    if (this.resHighlightTween) { this.resHighlightTween.stop(); this.resHighlightTween = null; }
    this.resHighlightGfx.clear();
    if (!show) { this.resHighlightGfx.setAlpha(1); return; }

    for (const node of this.shared.resourceNodes) {
      if (node.amount <= 0) continue;
      const px = node.x * TILE_SIZE + TILE_SIZE / 2;
      const py = node.y * TILE_SIZE + TILE_SIZE / 2;
      const colors = { wood: 0x88cc44, stone: 0xaaaaaa, gold: 0xffd700, food: 0xffaa00 };
      this.resHighlightGfx.lineStyle(2, colors[node.type] || 0xffffff, 0.85);
      this.resHighlightGfx.strokeCircle(px, py, 26);
      this.resHighlightGfx.lineStyle(1, colors[node.type] || 0xffffff, 0.3);
      this.resHighlightGfx.strokeRect(node.x * TILE_SIZE + 2, node.y * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    }

    // Pulse animation
    this.resHighlightTween = this.tweens.add({
      targets: this.resHighlightGfx,
      alpha: { from: 1, to: 0.35 },
      duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  // ─── Build mode ───────────────────────────────────────────────────────────

  _enterBuildMode(type) {
    this.buildMode = type;
    this.buildCursor.setVisible(true);
    this.scene.get('UI')?.showMessage(`Cliquez pour poser : ${BUILDING_DATA[type]?.label}  (clic droit = annuler)`, 0xffd700);
  }

  _cancelBuildMode() {
    this.buildMode = null;
    this.buildCursor.setVisible(false);
    this._setCursor('default');
  }

  // ─── Spawn helpers ────────────────────────────────────────────────────────

  _spawnResource(node) {
    const img = this.add.image(
      node.x * TILE_SIZE + TILE_SIZE / 2,
      node.y * TILE_SIZE + TILE_SIZE / 2,
      RESOURCE_KEYS[node.type] || 'res_food'
    ).setDepth(2).setScale(0.7);
    this.resourceObjects.set(node.id, img);
  }

  _spawnBuilding(bld) {
    // ── Walls are 1×1 tiles ───────────────────────────────────────────────────
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

    // ── Regular 2×2 buildings ─────────────────────────────────────────────────
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
  }

  _spawnUnit(unit) {
    const isEnemy   = unit.owner === 'enemy';
    const isNeutral = unit.owner === 'neutral';
    const texKey = isEnemy ? `unit_${unit.type}_enemy` : `unit_${unit.type}`;
    const img    = this.add.image(0, 0, texKey).setDisplaySize(36, 36);
    if (isNeutral) img.setTint(0xaacc88); // subtle green tint for wildlife
    const hpBg   = this.add.rectangle(0, 22, 40, 6, 0x330000).setOrigin(0.5);
    const hpFill = this.add.rectangle(-20, 22, 40, 6, 0x22cc22).setOrigin(0, 0.5);

    const container = this.add.container(
      unit.x * TILE_SIZE + TILE_SIZE / 2,
      unit.y * TILE_SIZE + TILE_SIZE / 2,
      [img, hpBg, hpFill]
    ).setDepth(6);

    container.hpFill  = hpFill;
    container.unitRef = unit;
    this.unitObjects.set(unit.id, container);
  }

  _updateSelectionRing() {
    if (!this.selectedUnit) return;
    const obj = this.unitObjects.get(this.selectedUnit.id);
    // Follow the container's live tween position, not snapped tile coords
    if (obj) this.selectionRing.setPosition(obj.x, obj.y).setVisible(true);
  }

  // ─── Gathering badges (small ⛏ icon over gathering workers) ───────────────

  _updateGatherBadges() {
    const BADGE = { to_resource: '🚶', gathering: '⛏', to_deposit: '📦' };
    for (const unit of this.shared.units) {
      const obj = this.unitObjects.get(unit.id);
      if (!obj) continue;

      // Use live container position (follows tweens)
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
  }

  // ─── State sync ───────────────────────────────────────────────────────────

  _applyStateUpdate(shared) {
    this.shared = shared;
    this.scene.get('UI')?.syncResources(shared.resources);

    const seenIds = new Set();
    for (const unit of shared.units) {
      seenIds.add(unit.id);
      const obj = this.unitObjects.get(unit.id);
      if (obj) {
        // Kill any in-progress tween so we start fresh from current visual position
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
      if (obj) {
        obj.setAlpha(node.amount > 0 ? 1 : 0.2);
        obj.setScale(0.4 + 0.3 * (node.amount / 400));
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
          // Construction just finished — restore and remove overlays
          img.setAlpha(1);
          if (img._progBg)    { img._progBg.destroy();    img._progBg    = null; }
          if (img._progFill)  { img._progFill.destroy();  img._progFill  = null; }
          if (img._progLabel) { img._progLabel.destroy(); img._progLabel = null; }
        }
      }
    }

    // Deselect dead unit
    if (this.selectedUnit && !shared.units.find(u => u.id === this.selectedUnit.id)) {
      this._deselectAll();
    }

    // Refresh resource highlights if paysan still selected
    if (this.selectedUnit?.type === 'paysan') {
      this._showResourceHighlights(true);
    }

    // Update fog of war
    this._updateFog();
  }

  // ─── Fog of war ───────────────────────────────────────────────────────────

  _addTilesInRadius(set, cx, cy, r) {
    const r2 = r * r;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r2) {
          const x = cx + dx, y = cy + dy;
          if (x >= 0 && x < MAP_W && y >= 0 && y < MAP_H) set.add(`${x},${y}`);
        }
      }
    }
  }

  _computeVisibility() {
    const visible = new Set();
    for (const bld of this.shared.buildings) {
      if (bld.owner === 'enemy') continue;
      const r  = BLD_VISION[bld.type] ?? 5;
      const cx = bld.type === 'wall' ? bld.x : bld.x + 1;
      const cy = bld.type === 'wall' ? bld.y : bld.y + 1;
      this._addTilesInRadius(visible, cx, cy, r);
    }
    for (const unit of this.shared.units) {
      if (unit.owner === 'enemy' || unit.owner === 'neutral') continue;
      const r = UNIT_VISION[unit.type] ?? 3;
      this._addTilesInRadius(visible, unit.x, unit.y, r);
    }
    for (const key of visible) this.visitedTiles.add(key);
    return visible;
  }

  _updateFog() {
    const visible = this._computeVisibility();
    this.fogGfx.clear();
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const key = `${x},${y}`;
        if (visible.has(key)) continue;
        const alpha = this.visitedTiles.has(key) ? 0.58 : 1.0;
        this.fogGfx.fillStyle(0x000000, alpha);
        this.fogGfx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  _enterBattle(battle) {
    this.scene.launch('Battle', { battle, worldScene: this });
    this.scene.pause('World');
  }
}