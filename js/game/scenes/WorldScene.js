import Phaser from 'phaser';
import { socketManager } from '../network/SocketManager';
import { BUILDING_DATA } from '../data/buildings';
import { HERO_DEFS } from '../data/heroes';

const TILE_SIZE = 48;
const MAP_W = 80;
const MAP_H = 60;

const TILE_KEYS = ['tile_grass', 'tile_dark_grass', 'tile_water', 'tile_sand', 'tile_dirt', 'tile_forest', 'tile_mountain'];
// Wood uses state-based textures; other resources have fixed textures
const RESOURCE_KEYS = { stone: 'res_stone', gold: 'res_gold', food: 'res_food' };
function _treeTexKey(node) {
  if (node.state === 'stump')   return 'res_tree_stump';
  if (node.state === 'sapling') return 'res_tree_sapling';
  return 'res_tree';
}

// Tile indices that block movement (must match GameRoom.js T values)
const IMPASSABLE = new Set([2, 6]); // WATER=2, MOUNTAIN=6

// Vision radius per unit/building type (fog of war)
const UNIT_VISION = {
  paysan: 2,
  homme_armes: 4, archer: 4, mercenaire: 4, compagnie_loup: 4,
  chevalier: 5, garde_roi: 5, croise: 5, frere_epee: 5, banniere_rouge: 5,
  // Heroes use their own visionRadius from HERO_DEFS
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
    this.npcObjects = new Map();
    this.villageObjects = new Map();
    this.dungeonObjects = new Map();
    this.sdfObjects = new Map();
    this.visitedTiles = new Set(); // fog of war memory
    this.mySocketId = socketManager.socket?.id;
    // Store own player info for reconnection (socket ID may change on reconnect)
    this._myPlayer = data.snapshot.players?.find(p => p.socketId === this.mySocketId);
  }

  create() {
    // ── Camera bounds (set early so loader uses correct scroll factor) ─────────
    this.cameras.main.setBounds(0, 0, MAP_W * TILE_SIZE, MAP_H * TILE_SIZE);

    // ── Loading overlay (fixed to screen, depth 100) ───────────────────────────
    const { width: SW, height: SH } = this.scale;
    const _ld = this._createLoader(SW, SH);

    this._worldReady = false;

    // Defer heavy world-build by one frame so the loader renders first
    this.time.delayedCall(40, () => {
      this._buildWorld();
      this._worldReady = true;
      _ld.setProgress(1);
      // Short pause at 100%, then fade out
      this.time.delayedCall(300, () => {
        this.tweens.add({
          targets: _ld.objects,
          alpha: 0, duration: 450, ease: 'Sine.easeIn',
          onComplete: () => _ld.objects.forEach(o => o.destroy()),
        });
      });
    });
  }

  _createLoader(W, H) {
    const cx = W / 2, cy = H / 2;
    const barW = Math.min(320, W * 0.7), barH = 12;

    const bg  = this.add.rectangle(cx, cy, W, H, 0x0a0605, 1).setScrollFactor(0).setDepth(100);
    const emblem = this.add.text(cx, cy - 60, '🏰', { fontSize: '48px' }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
    const title  = this.add.text(cx, cy - 4,  'CHARGEMENT DE LA PARTIE', {
      fontFamily: 'Georgia, serif', fontSize: '16px', color: '#c8960c',
      shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 4, fill: true },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

    // Progress bar background
    const barBg = this.add.rectangle(cx, cy + 28, barW, barH, 0x2a1a0a, 1)
      .setStrokeStyle(1, 0x4a3010).setScrollFactor(0).setDepth(101);
    // Progress fill (starts at width=0)
    const fill  = this.add.rectangle(cx - barW / 2, cy + 28, 1, barH - 2, 0xc8960c, 1)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(102);

    const hint = this.add.text(cx, cy + 52, 'Génération du monde médiéval...', {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#555533',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

    // Pulsing dots animation
    let dot = 0;
    const dotTimer = this.time.addEvent({ delay: 380, loop: true, callback: () => {
      const dots = ['·  ·  ·', '●  ·  ·', '●  ●  ·', '●  ●  ●'][dot++ % 4];
      hint.setText(`Génération du monde médiéval  ${dots}`);
    }});

    const objects = [bg, emblem, title, barBg, fill, hint];

    return {
      objects,
      setProgress(pct) {
        fill.setDisplaySize(Math.max(2, barW * pct), barH - 2);
        dotTimer.remove();
        hint.setText('Prêt !');
      },
    };
  }

  _buildWorld() {
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
    for (const node    of this.shared.resourceNodes)  this._spawnResource(node);
    for (const bld     of this.shared.buildings)      this._spawnBuilding(bld);
    for (const unit    of this.shared.units)          this._spawnUnit(unit);
    for (const npc     of (this.shared.npcs || []))   this._spawnNpc(npc);
    for (const village of (this.shared.villages || [])) this._spawnVillage(village);

    // ── Input ─────────────────────────────────────────────────────────────────
    this.input.on('pointerdown', this._onPointerDown, this);
    this.input.on('pointermove', this._onMouseMove,   this);
    this.input.on('pointerup',   this._onPointerUp,   this);

    this._drag = null;
    this._pinch = null;

    // ── Keyboard ──────────────────────────────────────────────────────────────
    this.cursors  = this.input.keyboard?.createCursorKeys();
    this.wasd     = this.input.keyboard?.addKeys({ up: 'W', left: 'A', down: 'S', right: 'D' });
    this.camSpeed = 8;
    this.input.keyboard?.on('keydown-ESC', () => this._cancelBuildMode());

    // ── Wall drag state ───────────────────────────────────────────────────────
    this._lastWallTile = null;

    // ── Selection ring ────────────────────────────────────────────────────────
    this.selectionRing = this.add.image(0, 0, 'selection_ring').setVisible(false).setDepth(5);

    // ── Gathering badges ──────────────────────────────────────────────────────
    this.gatherBadges = new Map();

    // ── Zoom: mouse wheel ─────────────────────────────────────────────────────
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
    this.fogGfx = this.add.graphics().setDepth(20);
    this._updateFog();

    // ── Network ───────────────────────────────────────────────────────────────
    socketManager
      .on('state_update',   (data) => this._applyStateUpdate(data.shared))
      .on('battle_start',   (data) => this._enterBattle(data.battle))
      .on('battle_update',  (data) => this._applyStateUpdate(data.shared))
      .on('battle_end',     (data) => this._applyStateUpdate(data.shared))
      .on('player_left',       ()     => this.scene.get('UI')?.showMessage('Votre allié a quitté la partie !', 0xff4444))
      .on('player_joined',     (data) => this.scene.get('UI')?.showMessage(`${data.name} a rejoint la partie !`, 0x44cc88))
      .on('npc_interact',      (data) => this._showNpcDialogue(data.npc, data.heroId))
      .on('village_captured',  (data) => this._onVillageCaptured(data))
      .on('arrow_shot',        (data) => this._showArrowShot(data))
      .on('random_event',      (data) => this.scene.get('UI')?.showMessage(data.message, data.color))
      .on('action_error',      (data) => this.scene.get('UI')?.showMessage(data.message, 0xff4444))
      .on('connected',         ()     => this._onReconnected())
      .on('disconnected',      ()     => this.scene.get('UI')?.showMessage('⚠ Connexion perdue… Reconnexion automatique', 0xff8800))
      .on('game_start',        (snap) => this._applyStateUpdate(snap.shared));

    this.mySocketId = socketManager.socket?.id;

    // ── HUD ───────────────────────────────────────────────────────────────────
    this.scene.launch('UI', { shared: this.shared, onBuild: (type) => this._enterBuildMode(type) });

    // Center camera on first player town hall
    const th = this.shared.buildings.find(b => b.type === 'town_hall');
    if (th) this.cameras.main.centerOn((th.x + 1) * TILE_SIZE, (th.y + 1) * TILE_SIZE);
  }

  update() {
    if (!this._worldReady) return;
    this._handleCameraScroll();
    this._updateSelectionRing();
    this._updateGatherBadges();
    this.scene.get('UI')?.syncResources(this.shared.resources);
  }

  // ─── Camera ───────────────────────────────────────────────────────────────

  _handleCameraScroll() {
    // Skip keyboard/edge scroll if touch-dragging (touch drag handles panning)
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

    // Edge panning only for mouse (not touch, where ptr.x is at last tap position)
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
  }

  // ─── Pointer down / up (mouse + touch) ───────────────────────────────────

  _onPointerDown(ptr) {
    const ptrs = this.input.manager.pointers.filter(p => p.isDown);

    if (ptrs.length === 2) {
      // Pinch start
      const [a, b] = ptrs;
      this._pinch = { dist: Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y), zoom: this.cameras.main.zoom };
      this._drag  = null;
      return;
    }

    // Right-click → cancel immediately (desktop)
    if (ptr.rightButtonDown()) {
      this._cancelBuildMode();
      this._deselectAll();
      return;
    }

    // Single pointer: start potential drag
    const cam = this.cameras.main;
    this._drag = { x: ptr.x, y: ptr.y, camX: cam.scrollX, camY: cam.scrollY, moved: false };
  }

  _onPointerUp(ptr) {
    // If this was a clean tap (not a drag), fire the click handler
    if (this._drag && !this._drag.moved) {
      this._onWorldClick(ptr);
    }
    this._drag  = null;
    this._pinch = null;
  }

  // ─── Mouse / touch move ────────────────────────────────────────────────────

  _onMouseMove(ptr) {
    const ptrs = this.input.manager.pointers.filter(p => p.isDown);

    // ── Pinch zoom (2 fingers) ────────────────────────────────────────────────
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

    // ── Single-finger / mouse drag → pan camera ───────────────────────────────
    if (this._drag && ptr.isDown && !this.buildMode) {
      const dx = ptr.x - this._drag.x;
      const dy = ptr.y - this._drag.y;
      if (!this._drag.moved && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        this._drag.moved = true;
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
      // Red cursor + tint when outside territory
      this.buildCursor.setFillStyle(inTerritory ? 0x00ff00 : 0xff2200, inTerritory ? 0.22 : 0.30);
      this.buildCursor.setStrokeStyle(2, inTerritory ? 0x00ff00 : 0xff2200, inTerritory ? 0.8 : 0.9);
      this._setCursor(inTerritory ? 'crosshair' : 'not-allowed');
      this.hoverGfx.clear();

      // Wall drag: paint while holding (mouse or touch)
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
    const unit        = this.shared.units.find(u => u.x === tx && u.y === ty);
    const resource    = this.shared.resourceNodes.find(r => r.x === tx && r.y === ty && r.amount > 0);
    const building    = this._buildingAt(tx, ty);
    const villageTower = (this.shared.villages || []).find(v => !v.capturedBy && v.x === tx && v.y === ty);
    const tileIdx     = this.mapData[ty]?.[tx];
    const walkable    = tileIdx !== undefined && !IMPASSABLE.has(tileIdx);

    // Hover highlight — red for attackable targets, white otherwise
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
  }

  _setCursor(type) {
    this.game.canvas.style.cursor = type;
  }

  // ─── Click ────────────────────────────────────────────────────────────────

  _onWorldClick(ptr) {
    const wp = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
    const tx = Math.floor(wp.x / TILE_SIZE);
    const ty = Math.floor(wp.y / TILE_SIZE);

    if (this.buildMode) {
      if (!this._isInTerritory(tx, ty)) {
        this.scene.get('UI')?.showMessage('⚠ Hors territoire ! Capturez un village pour étendre votre zone.', 0xff6622);
        return;
      }
      socketManager.sendAction({ type: 'PLACE_BUILDING', buildingType: this.buildMode, tx, ty });
      if (this.buildMode === 'wall') {
        // Stay in wall mode — allow painting more walls
        this._lastWallTile = `${tx},${ty}`;
      } else {
        this._cancelBuildMode();
      }
      return;
    }

    // Village tower at tile? → siege (unit walks adjacent and attacks each tick)
    const tower = (this.shared.villages || []).find(v => !v.capturedBy && v.x === tx && v.y === ty);
    if (tower && this.selectedUnit) {
      socketManager.sendAction({ type: 'MOVE_UNIT', unitId: this.selectedUnit.id, tx, ty });
      this.scene.get('UI')?.showMessage('⚔ Siège de la tour ennemie !', 0xff8800);
      this._deselectAll();
      return;
    }

    // NPC at tile? (hero must be selected to interact)
    const npc = (this.shared.npcs || []).find(n => n.x === tx && n.y === ty);
    if (npc && this.selectedUnit?.isHero) {
      const hero = this.selectedUnit;
      const dist = Math.abs(tx - hero.x) + Math.abs(ty - hero.y);
      const walkMs = this._walkMs(hero, dist);
      // Walk to NPC first, then interact
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
        // Attack — move selected unit toward enemy/mob, delay battle until unit arrives
        const attacker = this.selectedUnit;
        const dist = Math.abs(tx - attacker.x) + Math.abs(ty - attacker.y);
        const walkMs = this._walkMs(attacker, dist);
        socketManager.sendAction({ type: 'MOVE_UNIT', unitId: attacker.id, tx, ty });
        this._pendingBattleWalk = { unitId: attacker.id, tx, ty, walkMs, sentAt: Date.now() };
        this._deselectAll();
      } else if (unit.owner === 'player') {
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
    const pop = this.shared.population || [];
    const popInfo = {
      residents:      pop.filter(c => !c.isChild && c.houseId === building.id).length,
      child:          pop.find(c => c.isChild && c.birthHouseId === building.id) || null,
      availableAdults: pop.filter(c => !c.isChild && c.houseId && !c.deployed).length,
      sdfCount:       pop.filter(c => !c.isChild && !c.houseId && !c.deployed).length,
    };
    this.scene.get('UI')?.showBuildingPanel(building, (unitType) => {
      socketManager.sendAction({ type: 'TRAIN_UNIT', buildingId: building.id, unitType });
    }, popInfo);
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
      // Stump/sapling = can't gather yet, show dimmer indicator
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

    // Pulse animation
    this.resHighlightTween = this.tweens.add({
      targets: this.resHighlightGfx,
      alpha: { from: 1, to: 0.35 },
      duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  // ─── Build mode ───────────────────────────────────────────────────────────

  // Returns true if tile (tx,ty) is within player territory (mirrors server logic)
  _isInTerritory(tx, ty) {
    if (this.buildMode === 'wall') return true; // walls have no restriction
    const TOWN_R = 22, VILLAGE_R = 16;
    const halls = this.shared.buildings.filter(b => b.type === 'town_hall' && b.owner !== 'enemy');
    const captured = (this.shared.villages || []).filter(v => v.capturedBy);
    return halls.some(h => Math.abs(h.x - tx) + Math.abs(h.y - ty) <= TOWN_R)
        || captured.some(v => Math.abs(v.x - tx) + Math.abs(v.y - ty) <= VILLAGE_R);
  }

  _enterBuildMode(type) {
    this.buildMode = type;
    this.buildCursor.setVisible(true);
    this.scene.get('UI')?.showMessage(`Cliquez pour poser : ${BUILDING_DATA[type]?.label}`, 0xffd700);
    this.scene.get('UI')?.showCancelBtn();
    this._drawTerritoryOverlay();
  }

  _cancelBuildMode() {
    this.buildMode = null;
    this.buildCursor.setVisible(false);
    this._setCursor('default');
    this.scene.get('UI')?._hideCancelBtn();
    this.territoryGfx?.clear();
  }

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
  }

  // ─── Spawn helpers ────────────────────────────────────────────────────────

  _spawnResource(node) {
    const texKey = node.type === 'wood'
      ? _treeTexKey(node)
      : (RESOURCE_KEYS[node.type] || 'res_stone');
    const scale = node.type === 'wood' ? (node.state === 'sapling' ? 0.55 : 0.9) : 0.82;
    const img = this.add.image(
      node.x * TILE_SIZE + TILE_SIZE / 2,
      node.y * TILE_SIZE + TILE_SIZE / 2,
      texKey
    ).setDepth(2).setScale(scale);
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

    const children = [img, hpBg, hpFill];

    // Hero: add a quest indicator text above
    if (unit.isHero) {
      const questBadge = this.add.text(0, -26, unit.activeQuest ? '❗' : '✦', {
        fontSize: '12px',
      }).setOrigin(0.5);
      children.push(questBadge);
      // Store reference for updates
      img._questBadge = questBadge;
    }

    const container = this.add.container(
      unit.x * TILE_SIZE + TILE_SIZE / 2,
      unit.y * TILE_SIZE + TILE_SIZE / 2,
      children
    ).setDepth(6);

    container.hpFill  = hpFill;
    container.unitRef = unit;
    container.questBadge = unit.isHero ? children[children.length - 1] : null;
    this.unitObjects.set(unit.id, container);
  }

  _spawnNpc(npc) {
    const texKey = `npc_${npc.type}`;
    const img = this.add.image(
      npc.x * TILE_SIZE + TILE_SIZE / 2,
      npc.y * TILE_SIZE + TILE_SIZE / 2,
      texKey,
    ).setDisplaySize(36, 36).setDepth(5);

    // Quest indicator above NPC
    const indicator = npc.questCompleted ? '✓' : npc.questAccepted ? '❗' : '❓';
    const badge = this.add.text(
      npc.x * TILE_SIZE + TILE_SIZE / 2,
      npc.y * TILE_SIZE + TILE_SIZE / 2 - 24,
      indicator, { fontSize: '14px' },
    ).setOrigin(0.5).setDepth(7);

    // Name label
    const label = this.add.text(
      npc.x * TILE_SIZE + TILE_SIZE / 2,
      npc.y * TILE_SIZE + TILE_SIZE + 2,
      npc.name, {
        fontFamily: 'sans-serif', fontSize: '9px', color: '#d4b060',
        backgroundColor: '#00000066', padding: { x: 2, y: 1 },
      },
    ).setOrigin(0.5, 0).setDepth(7);

    this.npcObjects.set(npc.id, { img, badge, label, npc });
  }

  // ─── Village towers ──────────────────────────────────────────────────────

  _spawnVillage(village) {
    const wx = village.x * TILE_SIZE + TILE_SIZE / 2;
    const wy = village.y * TILE_SIZE + TILE_SIZE / 2;

    // Region ring (territory that becomes buildable on capture)
    const ring = this.add.graphics().setDepth(0.5);
    this._drawVillageRing(ring, wx, wy, !!village.capturedBy);

    // Tower sprite
    const tower = this.add.image(wx, wy, village.capturedBy ? 'village_tower_cap' : 'village_tower')
      .setOrigin(0.5).setDepth(village.y + 0.8).setDisplaySize(72, 72);

    // HP bar (hidden when captured)
    const barW = 56;
    const hpBg = this.add.rectangle(wx, wy - 44, barW, 7, 0x330000)
      .setDepth(village.y + 1).setVisible(!village.capturedBy);
    const hpFill = this.add.rectangle(wx - barW / 2, wy - 44, barW * (village.hp / village.maxHp), 7, 0xcc2222)
      .setOrigin(0, 0.5).setDepth(village.y + 1).setVisible(!village.capturedBy);

    // Label
    const lbl = this.add.text(wx, wy - 56,
      village.capturedBy ? '✦ Village allié' : '⚔ Village ennemi', {
        fontFamily: 'sans-serif', fontSize: '10px',
        color: village.capturedBy ? '#ffd700' : '#ff6644',
        backgroundColor: '#00000088', padding: { x: 3, y: 2 },
      }).setOrigin(0.5).setDepth(village.y + 1);

    this.villageObjects.set(village.id, { ring, tower, hpBg, hpFill, lbl });
  }

  _drawVillageRing(g, wx, wy, captured) {
    const r = 8 * TILE_SIZE;
    g.clear();
    g.fillStyle(captured ? 0x2244bb : 0x882222, captured ? 0.06 : 0.04);
    g.fillCircle(wx, wy, r);
    g.lineStyle(2, captured ? 0x4488ff : 0xcc4444, captured ? 0.35 : 0.25);
    g.strokeCircle(wx, wy, r);
  }

  _syncVillages() {
    for (const village of (this.shared.villages || [])) {
      const objs = this.villageObjects.get(village.id);
      if (!objs) { this._spawnVillage(village); continue; }

      if (village.capturedBy) {
        // Update to captured state (only once)
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
        // Update HP bar
        const barW = 56;
        const pct = village.hp / village.maxHp;
        objs.hpFill.setDisplaySize(Math.max(1, barW * pct), 7);
        const col = pct > 0.5 ? 0x22cc22 : pct > 0.25 ? 0xddaa00 : 0xcc2222;
        objs.hpFill.setFillStyle(col);
      }
    }
  }

  _syncSdfCitizens(population) {
    const sdfAdults = population.filter(c => !c.isChild && !c.houseId && !c.deployed);
    const seenIds = new Set(sdfAdults.map(c => c.id));

    // Spawn new SDF objects
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
        // Urgency bar (sdfTimer / SDF_TIMEOUT)
        const barBg = this.add.rectangle(wx, wy + 20, 32, 4, 0x330000).setDepth(6);
        const barFill = this.add.rectangle(wx - 16, wy + 20, 1, 4, 0xff4400).setOrigin(0, 0.5).setDepth(7);
        this.sdfObjects.set(cit.id, { img, badge, barBg, barFill, cit });
      }
      // Update urgency bar (sdfTimer visible)
      const objs = this.sdfObjects.get(cit.id);
      if (objs) {
        const pct = Math.min(1, (cit.sdfTimer || 0) / 90);
        objs.barFill.setDisplaySize(32 * pct, 4);
        objs.barFill.setFillStyle(pct > 0.6 ? 0xcc2200 : 0xff8800);
      }
    }

    // Remove citizens who are no longer SDF
    for (const [id, objs] of this.sdfObjects) {
      if (!seenIds.has(id)) {
        objs.img.destroy(); objs.badge.destroy(); objs.barBg.destroy(); objs.barFill.destroy();
        this.sdfObjects.delete(id);
      }
    }
  }

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
  }

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
  }

  _onVillageCaptured(data) {
    const loot = data.loot || {};
    const parts = Object.entries(loot).map(([k, v]) => `${v} ${k[0].toUpperCase()}`).join('  ');
    this.scene.get('UI')?.showMessage(`🏰 Village capturé ! +${parts}`, 0xffd700);
  }

  // Brief animated arrow-shot line between tower and target
  _onReconnected() {
    if (!this._worldReady) return;
    // SocketManager handles rejoin_game automatically on reconnect (see connect handler).
    // Just show a confirmation message; game_start listener will refresh the state.
    this.scene.get('UI')?.showMessage('✔ Reconnecté !', 0x44cc88);
  }

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
  }

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

    // NPC name & quest title
    items.push(this.add.text(cx, cy - panelH / 2 + 20, `${npc.name}`, {
      fontFamily: 'Georgia, serif', fontSize: '16px', color: '#c8960c',
    }).setOrigin(0.5).setDepth(31).setScrollFactor(0));

    const q = npc.quest;
    items.push(this.add.text(cx, cy - panelH / 2 + 45, `"${q.label}"`, {
      fontFamily: 'Georgia, serif', fontSize: '13px', color: '#aa8840',
    }).setOrigin(0.5).setDepth(31).setScrollFactor(0));

    items.push(this.add.text(cx, cy - panelH / 2 + 72, q.desc, {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#cfc090',
      wordWrap: { width: panelW - 40 }, align: 'center',
    }).setOrigin(0.5, 0).setDepth(31).setScrollFactor(0));

    // Rewards
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

    // Accept button (only if quest not yet taken)
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

    // Close button
    const closeTxt = this.add.text(cx + panelW / 2 - 16, cy - panelH / 2 + 10, '✕', {
      fontFamily: 'sans-serif', fontSize: '16px', color: '#886630',
    }).setInteractive({ useHandCursor: true }).setOrigin(1, 0).setDepth(32).setScrollFactor(0);
    closeTxt.on('pointerdown', () => { items.forEach(o => o.destroy()); this._npcDialogue = null; });
    closeTxt.on('pointerover', () => closeTxt.setColor('#ffd700'));
    closeTxt.on('pointerout',  () => closeTxt.setColor('#886630'));
    items.push(closeTxt);

    this._npcDialogue = items;
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
      if (!obj) continue;
      if (node.type === 'wood') {
        const newKey = _treeTexKey(node);
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

    // Update NPC quest badges
    for (const npc of (shared.npcs || [])) {
      const obj = this.npcObjects.get(npc.id);
      if (obj) {
        const indicator = npc.questCompleted ? '✓' : npc.questAccepted ? '❗' : '❓';
        obj.badge.setText(indicator);
        obj.npc = npc; // keep local reference fresh
      }
    }

    // Update hero quest badges
    for (const unit of shared.units) {
      const obj = this.unitObjects.get(unit.id);
      if (obj?.questBadge && unit.isHero) {
        obj.questBadge.setText(unit.activeQuest ? '❗' : '✦');
      }
    }

    // Sync SDF adults on map
    this._syncSdfCitizens(shared.population || []);

    // Update villages
    this._syncVillages();

    // Update dungeons
    this._syncDungeons();

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
      const r = unit.isHero
        ? (HERO_DEFS[unit.type]?.visionRadius ?? 5)
        : (UNIT_VISION[unit.type] ?? 3);
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

  // ─── Walk helpers ─────────────────────────────────────────────────────────

  // ms to walk `dist` tiles for this unit (heroes faster, paysans slower)
  _walkMs(unit, dist) {
    const SPEEDS = { roi_guerrier: 1.8, chasseresse: 1.8, mage_arcane: 1.8,
                     chevalier: 1.4, homme_armes: 1.4, garde_roi: 1.4,
                     croise: 1.4, frere_epee: 1.4, compagnie_loup: 1.4,
                     archer: 1.2, mercenaire: 1.2 };
    const speed = SPEEDS[unit?.type] || 1.0;
    return Math.max(200, Math.min(dist, 5) * Math.round(220 / speed));
  }

  // Immediately tween the unit sprite toward (tx, ty) over walkMs
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
  }

  _enterBattle(battle) {
    const pending = this._pendingBattleWalk;
    this._pendingBattleWalk = null;

    if (pending) {
      const elapsed  = Date.now() - pending.sentAt;
      const remaining = Math.max(0, pending.walkMs - elapsed);
      // Animate unit walking to target before entering battle
      this._animWalkTo(pending.unitId, pending.tx, pending.ty, remaining);
      if (remaining > 0) {
        this.time.delayedCall(remaining, () => this._doEnterBattle(battle));
        return;
      }
    }
    this._doEnterBattle(battle);
  }

  _doEnterBattle(battle) {
    // Guard against double launch (e.g. delayedCall fires after a second battle_start arrives)
    if (this.scene.isActive('Battle') || this.scene.isPaused('World')) return;
    this.scene.launch('Battle', { battle, worldScene: this });
    this.scene.pause('World');
  }
}