import Phaser from 'phaser';
import { socketManager } from '../network/SocketManager';
import { soundManager } from '../network/SoundManager';
import { BUILDING_DATA } from '../data/buildings';
import { HERO_DEFS } from '../data/heroes';

import { TILE_SIZE, MAP_W, MAP_H } from '../world/constants';
import { FogOfWarMixin }   from '../world/FogOfWar';
import { EntityLayerMixin } from '../world/EntityLayer';
import { InputHandlerMixin } from '../world/InputHandler';

// Tile texture key array — index matches T constants (GRASS=0 … FARMLAND=12)
const TILE_KEYS = [
  'tile_grass', 'tile_dark_grass', 'tile_water', 'tile_sand', 'tile_dirt',
  'tile_forest', 'tile_mountain',
  'tile_marsh', 'tile_path', 'tile_shallow_water', 'tile_snow', 'tile_ruins', 'tile_farmland',
];

export class WorldScene extends Phaser.Scene {
  constructor() { super('World'); }

  init(data) {
    this.snapshot = data.snapshot;
    this.shared   = data.snapshot.shared;
    this.players  = data.snapshot.players;
    this.mapData  = data.snapshot.map;
    this.selectedUnit     = null;
    this.selectedUnits    = [];
    this.selectedBuilding = null;
    this.buildMode        = null;
    this.unitObjects     = new Map();
    this.buildingObjects = new Map();
    this.resourceObjects = new Map();
    this.npcObjects      = new Map();
    this.villageObjects  = new Map();
    this.dungeonObjects  = new Map();
    this.sdfObjects      = new Map();
    this.childObjects    = new Map();
    this.visitedTiles    = new Set();
    this.mySocketId = socketManager.socket?.id;
    this._myPlayer  = data.snapshot.players?.find(p => p.socketId === this.mySocketId);
  }

  create() {
    this.cameras.main.setBounds(0, 0, MAP_W * TILE_SIZE, MAP_H * TILE_SIZE);

    const { width: SW, height: SH } = this.scale;
    const _ld = this._createLoader(SW, SH);

    this._worldReady = false;

    this.time.delayedCall(40, () => {
      this._buildWorld();
      this._worldReady = true;
      _ld.setProgress(1);
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

    const bg     = this.add.rectangle(cx, cy, W, H, 0x0a0605, 1).setScrollFactor(0).setDepth(100);
    const emblem = this.add.text(cx, cy - 60, '🏰', { fontSize: '48px' }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
    const title  = this.add.text(cx, cy - 4, 'CHARGEMENT DE LA PARTIE', {
      fontFamily: 'Georgia, serif', fontSize: '16px', color: '#c8960c',
      shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 4, fill: true },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

    const barBg = this.add.rectangle(cx, cy + 28, barW, barH, 0x2a1a0a, 1)
      .setStrokeStyle(1, 0x4a3010).setScrollFactor(0).setDepth(101);
    const fill  = this.add.rectangle(cx - barW / 2, cy + 28, 1, barH - 2, 0xc8960c, 1)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(102);

    const hint = this.add.text(cx, cy + 52, 'Génération du monde médiéval...', {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#555533',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

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
        const baseKey = TILE_KEYS[this.mapData[y][x]] || 'tile_grass';
        const v = ((x * 1619 + y * 2971) ^ (x * 37 + y * 53)) & 3;
        rt.draw(`${baseKey}_${v}`, x * TILE_SIZE, y * TILE_SIZE);
      }
    }

    // ── Subtle grid ───────────────────────────────────────────────────────────
    const gg = this.add.graphics();
    gg.lineStyle(1, 0x000000, 0.06);
    for (let x = 0; x <= MAP_W; x++) gg.moveTo(x * TILE_SIZE, 0).lineTo(x * TILE_SIZE, MAP_H * TILE_SIZE);
    for (let y = 0; y <= MAP_H; y++) gg.moveTo(0, y * TILE_SIZE).lineTo(MAP_W * TILE_SIZE, y * TILE_SIZE);
    gg.strokePath();

    // ── Graphics layers ───────────────────────────────────────────────────────
    this.resHighlightGfx = this.add.graphics().setDepth(1.5);
    this.resHighlightTween = null;
    this.hoverGfx = this.add.graphics().setDepth(1.8);

    this._tileTooltip = this.add.text(8, this.cameras.main.height - 22, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#ddd8aa',
      backgroundColor: '#000000aa', padding: { x: 4, y: 2 },
    }).setScrollFactor(0).setDepth(25).setVisible(false);

    this.buildCursor = this.add.rectangle(0, 0, TILE_SIZE * 2, TILE_SIZE * 2, 0x00ff00, 0.22)
      .setStrokeStyle(2, 0x00ff00, 0.8).setOrigin(0).setVisible(false).setDepth(1.9);

    // ── Spawn all game objects ─────────────────────────────────────────────────
    for (const node    of this.shared.resourceNodes)  this._spawnResource(node);
    for (const bld     of this.shared.buildings)      this._spawnBuilding(bld);
    for (const unit    of this.shared.units)          this._spawnUnit(unit);
    for (const npc     of (this.shared.npcs || []))   this._spawnNpc(npc);
    for (const village of (this.shared.villages || [])) this._spawnVillage(village);
    for (const cit of (this.shared.population || []).filter(c => c.isChild)) {
      const house = this.shared.buildings.find(b => b.id === cit.birthHouseId);
      if (house) this._spawnChild(cit, house);
    }

    // ── Input ─────────────────────────────────────────────────────────────────
    this.input.on('pointerdown', this._onPointerDown, this);
    this.input.on('pointermove', this._onMouseMove,   this);
    this.input.on('pointerup',   this._onPointerUp,   this);

    this._drag  = null;
    this._pinch = null;

    this.cursors  = this.input.keyboard?.createCursorKeys();
    this.wasd     = this.input.keyboard?.addKeys({ up: 'W', left: 'A', down: 'S', right: 'D' });
    this.camSpeed = 8;
    this.input.keyboard?.on('keydown-ESC', () => this._cancelBuildMode());

    this._lastWallTile  = null;
    this._pendingBattleWalk = null;
    this._npcDialogue   = null;

    // ── Selection / group rings ───────────────────────────────────────────────
    this.selectionRing = this.add.image(0, 0, 'selection_ring').setVisible(false).setDepth(5);
    this.groupRings    = [];
    this.selectBox     = this.add.graphics().setDepth(60);
    this.gatherBadges  = new Map();

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
      .on('battle_start',   (data) => { soundManager.battleStart(); this._enterBattle(data.battle); })
      .on('battle_update',  (data) => this._applyStateUpdate(data.shared))
      .on('battle_end',     (data) => this._applyStateUpdate(data.shared))
      .on('player_left',    () => { soundManager.playerLeft();  this.scene.get('UI')?.showMessage('Votre allié a quitté la partie !', 0xff4444); })
      .on('player_joined',  (data) => { soundManager.playerJoined(); this.scene.get('UI')?.showMessage(`${data.name} a rejoint la partie !`, 0x44cc88); })
      .on('npc_interact',      (data) => this._showNpcDialogue(data.npc, data.heroId))
      .on('village_captured',  (data) => { soundManager.villageCaptured(); this._onVillageCaptured(data); })
      .on('village_reclaimed',          ()     => { soundManager.eventDanger(); this.scene.get('UI')?.showMessage("⚠ Village repris par l'ennemi !", 0xff6622); })
      .on('village_capture_interrupted', ()     => { soundManager.eventGood();   this.scene.get('UI')?.showMessage('✔ Prise de possession interrompue !', 0x44cc88); })
      .on('arrow_shot',        (data) => this._showArrowShot(data))
      .on('random_event',      (data) => {
        if (data.sound === 'good')        soundManager.eventGood();
        else if (data.sound === 'danger') soundManager.eventDanger();
        else                              soundManager.event();
        this.scene.get('UI')?.showMessage(data.message, data.color);
      })
      .on('action_error',      (data) => { soundManager.error(); this.scene.get('UI')?.showMessage(data.message, 0xff4444); })
      .on('connected',         ()     => this._onReconnected())
      .on('disconnected',      ()     => this.scene.get('UI')?.showMessage('⚠ Connexion perdue… Reconnexion automatique', 0xff8800))
      .on('game_start',        (snap) => this._applyStateUpdate(snap.shared));

    this.mySocketId = socketManager.socket?.id;

    // ── HUD ───────────────────────────────────────────────────────────────────
    this.scene.launch('UI', { shared: this.shared, onBuild: (type) => this._enterBuildMode(type) });

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
}

// Mix all subsystems into the WorldScene prototype
Object.assign(WorldScene.prototype, FogOfWarMixin, EntityLayerMixin, InputHandlerMixin);