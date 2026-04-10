import Phaser from 'phaser';
import { socketManager } from '../network/SocketManager';
import { soundManager } from '../network/SoundManager';
import { UNIT_STATS, TYPE_CHART, UNIT_MOVE_TYPE } from '../data/units';

export class BattleScene extends Phaser.Scene {
  constructor() { super('Battle'); }

  init(data) {
    this.battle      = data.battle;
    this.worldScene  = data.worldScene;
    this.actionLocked = false;
    this._refreshFromBattle(data.battle);
  }

  _refreshFromBattle(battle) {
    this.battle          = battle;
    this.playerTeam      = battle.playerTeam  || [];
    this.enemyTeam       = battle.enemyTeam   || [];
    this.currentPlayerIdx = battle.currentPlayerIdx ?? 0;
    this.currentEnemyIdx  = battle.currentEnemyIdx  ?? 0;

    this.playerUnit  = this.playerTeam[this.currentPlayerIdx] || this.playerTeam[0];
    this.enemyUnit   = this.enemyTeam[this.currentEnemyIdx]  || this.enemyTeam[0];
    this.playerStats = UNIT_STATS[this.playerUnit?.type] || UNIT_STATS['homme_armes'];
    this.enemyStats  = UNIT_STATS[this.enemyUnit?.type]  || UNIT_STATS['homme_armes'];
  }

  create() {
    const { width: W, height: H } = this.cameras.main;

    this._drawBackground(W, H);
    this._drawPlatform(W * 0.72, H * 0.44, 0x2a1a0a, 150, 28);
    this._drawPlatform(W * 0.28, H * 0.63, 0x0a1a0a, 150, 28);

    // Positions de référence pour les animations
    this._enemySpriteX = W * 0.72; this._enemySpriteY = H * 0.38;
    this._playerSpriteX = W * 0.28; this._playerSpriteY = H * 0.59;

    // ── Queued enemy ghosts (behind active sprite) ────────────────────────────
    this._buildEnemyGhosts(W, H);

    // ── Enemy sprite ─────────────────────────────────────────────────────────
    this.enemySprite = this.add.image(this._enemySpriteX, this._enemySpriteY, `battle_${this.enemyUnit?.type}_enemy`)
      .setDisplaySize(112, 112).setDepth(3);

    // ── Player sprite ─────────────────────────────────────────────────────────
    this.playerSprite = this.add.image(this._playerSpriteX, this._playerSpriteY, `battle_${this.playerUnit?.type}`)
      .setDisplaySize(112, 112).setDepth(3).setFlipX(true);

    // ── HP bars ───────────────────────────────────────────────────────────────
    this.enemyHpBar  = this._createHpBar(W * 0.6,  H * 0.22, this.enemyUnit,  false);
    this.playerHpBar = this._createHpBar(W * 0.4,  H * 0.77, this.playerUnit, true);

    // ── Team rosters (small icons) ────────────────────────────────────────────
    this._buildRosters(W, H);

    // ── Type badges ───────────────────────────────────────────────────────────
    this._typeBadge(W * 0.28, H * 0.76, UNIT_MOVE_TYPE[this.playerUnit?.type] || '?', 0x3366aa);
    this._typeBadge(W * 0.72, H * 0.26, UNIT_MOVE_TYPE[this.enemyUnit?.type]  || '?', 0xaa3322);

    // ── Message log ───────────────────────────────────────────────────────────
    const logY = H * 0.86;
    this.add.rectangle(W / 2, logY, W * 0.9, 60, 0x1a0f05, 0.92)
      .setStrokeStyle(1, 0xc8960c, 0.5).setDepth(5);
    this.logText = this.add.text(W * 0.06, logY - 24, this._fmtLog(this.battle.log), {
      fontFamily: 'Georgia, serif', fontSize: '13px', color: '#d4c090',
      wordWrap: { width: W * 0.88 }, lineSpacing: 4,
    }).setDepth(6);

    // ── Move buttons ──────────────────────────────────────────────────────────
    this.moveButtonGroup = this.add.group();
    this._buildMoveButtons(W, H);

    // ── Network ───────────────────────────────────────────────────────────────
    socketManager
      .on('battle_update',     (data) => this._onBattleUpdate(data))
      .on('battle_end',        (data) => this._onBattleEnd(data))
      .on('dungeon_next_room', (data) => this._onDungeonNextRoom(data));
  }

  // ─── Background ───────────────────────────────────────────────────────────

  _drawBackground(W, H) {
    // Sky
    const sky = this.add.graphics().setDepth(0);
    sky.fillGradientStyle(0x0d1a3a, 0x0d1a3a, 0x1a3020, 0x1a3020, 1);
    sky.fillRect(0, 0, W, H * 0.56);
    // Ground
    const ground = this.add.graphics().setDepth(0);
    ground.fillGradientStyle(0x1a3020, 0x1a3020, 0x0f1e0a, 0x0f1e0a, 1);
    ground.fillRect(0, H * 0.56, W, H * 0.44);
    // Distant castle
    const c = this.add.graphics().setDepth(1).setAlpha(0.35);
    c.fillStyle(0x080c18);
    c.fillRect(W * 0.62, H * 0.28, 10, H * 0.28);
    c.fillRect(W * 0.77, H * 0.22, 10, H * 0.34);
    c.fillRect(W * 0.60, H * 0.38, 70, H * 0.18);
    c.fillRect(W * 0.58, H * 0.25, 28, 10); c.fillRect(W * 0.74, H * 0.19, 28, 10);
    // Stars & moon
    const stars = this.add.graphics().setDepth(1).setAlpha(0.55);
    stars.fillStyle(0xffffff);
    for (let i = 0; i < 45; i++) stars.fillCircle(Math.random() * W, Math.random() * H * 0.4, 0.8 + Math.random() * 1.2);
    this.add.circle(W * 0.86, H * 0.11, 28, 0xfff8d0).setDepth(1).setAlpha(0.65);
    this.add.circle(W * 0.88, H * 0.10, 24, 0x0d1a3a).setDepth(1).setAlpha(0.65);
  }

  _drawPlatform(x, y, color, w, h) {
    const g = this.add.graphics().setDepth(2);
    g.fillStyle(color, 0.8); g.fillEllipse(x, y, w, h);
    g.lineStyle(2, 0xc8960c, 0.25); g.strokeEllipse(x, y, w, h);
  }

  // ─── Queued enemy ghosts ──────────────────────────────────────────────────

  _buildEnemyGhosts(W, H) {
    this.enemyGhosts = [];
    // Units after the current one that are still alive
    const queued = this.enemyTeam.slice(this.currentEnemyIdx + 1).filter(u => u.hp > 0);
    if (queued.length === 0) return;

    // Stack positions: slightly right and behind the main sprite, shrinking
    const configs = [
      { offX: W * 0.10, offY: H * 0.04, size: 72, alpha: 0.42 },
      { offX: W * 0.18, offY: H * 0.08, size: 52, alpha: 0.26 },
    ];

    queued.slice(0, configs.length).forEach((unit, i) => {
      const cfg = configs[i];
      const sx = this._enemySpriteX + cfg.offX;
      const sy = this._enemySpriteY + cfg.offY;
      const ghost = this.add.image(sx, sy, `battle_${unit.type}_enemy`)
        .setDisplaySize(cfg.size, cfg.size)
        .setAlpha(cfg.alpha)
        .setDepth(2); // behind active sprite (depth 3)
      this.enemyGhosts.push(ghost);
    });
  }

  _rebuildEnemyGhosts() {
    for (const g of (this.enemyGhosts || [])) g.destroy();
    const { width: W, height: H } = this.cameras.main;
    this._buildEnemyGhosts(W, H);
  }

  // ─── HP bar ───────────────────────────────────────────────────────────────

  _createHpBar(x, y, unit, isPlayer) {
    if (!unit) return null;
    const stats  = UNIT_STATS[unit.type] || {};
    const barW   = 220, barH = 14;
    const pct    = unit.hp / unit.maxHp;
    const label  = isPlayer ? stats.label || unit.type : stats.label || unit.type;
    const color  = isPlayer ? '#88ccff' : '#ff9988';

    this.add.text(x - barW / 2, y - 24, label, {
      fontFamily: 'Georgia, serif', fontSize: '14px', color,
    }).setDepth(6);
    this.add.text(x + barW / 2, y - 24, `HP`, {
      fontFamily: 'monospace', fontSize: '10px', color: '#888866',
    }).setOrigin(1, 0).setDepth(6);

    this.add.rectangle(x, y, barW, barH, 0x330000).setDepth(6);
    const fill = this.add.rectangle(x - barW / 2, y, barW * pct, barH, this._hpColor(pct))
      .setOrigin(0, 0.5).setDepth(7);
    const txt = this.add.text(x, y, `${unit.hp} / ${unit.maxHp}`, {
      fontFamily: 'monospace', fontSize: '11px', color: '#ffffff',
    }).setOrigin(0.5).setDepth(8);

    return { fill, txt, maxHp: unit.maxHp, barW };
  }

  _updateHpBar(bar, unit) {
    if (!bar || !unit) return;
    const pct = Math.max(0, unit.hp / unit.maxHp);
    this.tweens.add({ targets: bar.fill, displayWidth: bar.barW * pct, duration: 300, ease: 'Power2' });
    bar.fill.setFillStyle(this._hpColor(pct));
    bar.txt.setText(`${unit.hp} / ${unit.maxHp}`);
  }

  _hpColor(pct) {
    if (pct > 0.5) return 0x22cc22;
    if (pct > 0.25) return 0xddaa00;
    return 0xcc2222;
  }

  // ─── Team rosters ─────────────────────────────────────────────────────────

  _buildRosters(W, H) {
    this.rosterObjects = [];

    // Player team — bottom strip
    this.playerTeam.forEach((unit, i) => {
      const rx = W * 0.06 + i * 52;
      const ry = H * 0.93;
      const isActive = i === this.currentPlayerIdx;
      const stats = UNIT_STATS[unit.type] || {};
      const c = isActive ? (stats.color || 0x3a6bbf) : 0x333333;

      const bg = this.add.rectangle(rx, ry, 44, 36, c, isActive ? 0.95 : 0.5)
        .setStrokeStyle(isActive ? 2 : 1, isActive ? 0xffd700 : 0x444444).setDepth(10);
      const lbl = this.add.text(rx, ry - 4, unit.type.slice(0, 4), {
        fontFamily: 'monospace', fontSize: '9px', color: isActive ? '#ffffff' : '#666644',
      }).setOrigin(0.5).setDepth(11);
      const hpPct = unit.hp / unit.maxHp;
      const hpFill = this.add.rectangle(rx - 20, ry + 10, 40 * hpPct, 4, this._hpColor(hpPct))
        .setOrigin(0, 0.5).setDepth(11);
      const dead = unit.hp <= 0;
      if (dead) { bg.setAlpha(0.25); lbl.setAlpha(0.25); }

      this.rosterObjects.push(bg, lbl, hpFill);
    });

    // Enemy team — top strip
    this.enemyTeam.forEach((unit, i) => {
      const rx = W * 0.94 - i * 52;
      const ry = H * 0.07;
      const isActive = i === this.currentEnemyIdx;

      const bg = this.add.rectangle(rx, ry, 44, 36, isActive ? 0x6a1a1a : 0x333333, isActive ? 0.95 : 0.5)
        .setStrokeStyle(isActive ? 2 : 1, isActive ? 0xff4444 : 0x444444).setDepth(10);
      const lbl = this.add.text(rx, ry - 4, unit.type.slice(0, 4), {
        fontFamily: 'monospace', fontSize: '9px', color: isActive ? '#ff8888' : '#664444',
      }).setOrigin(0.5).setDepth(11);
      const hpPct = unit.hp / unit.maxHp;
      const hpFill = this.add.rectangle(rx - 20, ry + 10, 40 * hpPct, 4, this._hpColor(hpPct))
        .setOrigin(0, 0.5).setDepth(11);
      if (unit.hp <= 0) { bg.setAlpha(0.25); lbl.setAlpha(0.25); }

      this.rosterObjects.push(bg, lbl, hpFill);
    });

    // Count labels
    const { width: W2, height: H2 } = this.cameras.main;
    this.add.text(W2 * 0.06, H2 * 0.89,
      `Alliés : ${this.playerTeam.filter(u => u.hp > 0).length}/${this.playerTeam.length}`, {
        fontFamily: 'monospace', fontSize: '11px', color: '#88bbff',
      }).setDepth(10);
    this.add.text(W2 * 0.94, H2 * 0.12,
      `Ennemis : ${this.enemyTeam.filter(u => u.hp > 0).length}/${this.enemyTeam.length}`, {
        fontFamily: 'monospace', fontSize: '11px', color: '#ff9988',
      }).setOrigin(1, 0).setDepth(10);
  }

  _rebuildRosters() {
    for (const o of this.rosterObjects || []) o.destroy();
    const { width: W, height: H } = this.cameras.main;
    this._buildRosters(W, H);
  }

  // ─── Type badge ───────────────────────────────────────────────────────────

  _typeBadge(x, y, type, color) {
    this.add.rectangle(x, y, 72, 18, color, 0.8).setDepth(6);
    this.add.text(x, y, type, {
      fontFamily: 'monospace', fontSize: '10px', color: '#ffffff',
    }).setOrigin(0.5).setDepth(7);
  }

  // ─── Move buttons ─────────────────────────────────────────────────────────

  _buildMoveButtons(W, H) {
    // Clear old buttons
    this.moveButtonGroup.clear(true, true);

    const moves = this.playerStats.moves || [];
    const eType = UNIT_MOVE_TYPE[this.enemyUnit?.type] || 'LEGER';

    const TYPE_COL = { LOURD: 0x7a4a2a, LEGER: 0x2a5a2a, CAVALERIE: 0x2a3a7a, MAGIE: 0x5a2a7a };
    const btnW = 204, btnH = 40;
    const baseX = W / 2 - btnW / 2 - 4;
    const baseY = H - 140;

    this.add.rectangle(W / 2, H - 96, btnW * 2 + 24, btnH * 2 + 20, 0x1a0f05, 0.9)
      .setStrokeStyle(1, 0xc8960c, 0.5).setDepth(5);

    moves.forEach((move, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const bx = baseX + col * (btnW + 8) + btnW / 2;
      const by = baseY + row * (btnH + 8);
      const eff = TYPE_CHART[move.moveType]?.[eType] ?? 1;
      const effLabel = eff > 1.2 ? '▲ Efficace' : eff < 0.8 ? '▼ Résistance' : '';
      const effColor = eff > 1.2 ? '#88ff88' : eff < 0.8 ? '#ff8888' : '#888888';
      const typeColor = TYPE_COL[move.moveType] || 0x444444;

      const bg = this.add.rectangle(bx, by, btnW, btnH, typeColor, 0.9)
        .setInteractive({ useHandCursor: true })
        .setStrokeStyle(1, 0xc8960c, 0.6).setDepth(7);
      const nameTxt = this.add.text(bx - btnW / 2 + 8, by - 9, move.name, {
        fontFamily: 'Georgia, serif', fontSize: '13px', color: '#f0e0c0',
      }).setDepth(8);
      const pwrTxt = this.add.text(bx + btnW / 2 - 8, by - 9, move.power ? `⚔ ${move.power}` : '—', {
        fontFamily: 'monospace', fontSize: '12px', color: '#ffcc88',
      }).setOrigin(1, 0).setDepth(8);
      const effTxt = this.add.text(bx - btnW / 2 + 8, by + 5, effLabel, {
        fontFamily: 'sans-serif', fontSize: '10px', color: effColor,
      }).setDepth(8);
      const typeTxt = this.add.text(bx + btnW / 2 - 8, by + 6, move.moveType, {
        fontFamily: 'monospace', fontSize: '9px', color: '#aaaaaa',
      }).setOrigin(1, 0).setDepth(8);

      bg.on('pointerover', () => bg.setStrokeStyle(2, 0xffd700, 1));
      bg.on('pointerout',  () => bg.setStrokeStyle(1, 0xc8960c, 0.6));
      bg.on('pointerdown', () => { if (!this.actionLocked) this._playerMove(i); });

      this.moveButtonGroup.addMultiple([bg, nameTxt, pwrTxt, effTxt, typeTxt]);
    });
  }

  _lockButtons(locked) {
    this.moveButtonGroup.getChildren().forEach(c => {
      if (c.type === 'Rectangle') {
        locked ? c.disableInteractive() : c.setInteractive({ useHandCursor: true });
        c.setAlpha(locked ? 0.45 : 1);
      }
    });
  }

  // ─── Battle flow ──────────────────────────────────────────────────────────

  _playerMove(moveIndex) {
    this.actionLocked = true;
    this._lockButtons(true);
    socketManager.sendAction({ type: 'BATTLE_MOVE', moveIndex });
  }

  _onBattleUpdate(data) {
    const { battle } = data;

    // Sauvegarder l'état avant refresh pour détecter morts et changements
    const prevPlayerId = this.playerUnit?.id;
    const prevEnemyId  = this.enemyUnit?.id;
    const prevPlayerHp = this.playerUnit?.hp ?? 0;
    const prevEnemyHp  = this.enemyUnit?.hp  ?? 0;

    this._refreshFromBattle(battle);
    this.logText.setText(this._fmtLog(battle.log));

    const enemyDied    = !!prevEnemyId  && this.enemyUnit?.id  !== prevEnemyId;
    const playerDied   = !!prevPlayerId && this.playerUnit?.id !== prevPlayerId;
    const enemyWasHit  = !enemyDied  && this.enemyUnit  && this.enemyUnit.hp  < prevEnemyHp;
    const playerWasHit = !playerDied && this.playerUnit && this.playerUnit.hp < prevPlayerHp;

    // ── Phase 1 : attaque du joueur (lunge forward) ──────────────────────────
    this._animAttack(this.playerSprite, +52, () => {
      if (enemyWasHit) {
        // Recul + flash → barre HP mise à jour APRÈS le recul
        this.tweens.add({
          targets: this.enemySprite, x: `-=${28}`, duration: 80, yoyo: true, ease: 'Power2',
          onComplete: () => this._updateHpBar(this.enemyHpBar, this.enemyUnit),
        });
        this.tweens.add({ targets: this.enemySprite, alpha: 0.4, duration: 60, yoyo: true, repeat: 1 });
        this._phase2(playerWasHit, playerDied, 2000);

      } else if (enemyDied) {
        // Animation de mort d'abord — barre HP mise à jour pour le suivant après l'entrée
        this._animDie(this.enemySprite, () => {
          this._rebuildEnemyGhosts();
          this._resetSprite(this.enemySprite, this._enemySpriteX, this._enemySpriteY);
          this.enemySprite.setTexture(`battle_${this.enemyUnit?.type}_enemy`);
          this._updateHpBar(this.enemyHpBar, this.enemyUnit);
          this._animEnter(this.enemySprite, 'right', () => this._phase2(playerWasHit, playerDied, 2000));
        });

      } else {
        // Pas de dégât visuel (résistance totale, etc.)
        this.enemySprite.setTexture(`battle_${this.enemyUnit?.type}_enemy`);
        this._phase2(playerWasHit, playerDied, 2000);
      }
    });
  }

  // ── Phase 2 : riposte ennemie (après 2 s) ────────────────────────────────
  _phase2(playerWasHit, playerDied, delay) {
    this.time.delayedCall(delay, () => {
      if (playerWasHit || playerDied) {
        // Ennemi se précipite vers le joueur
        this._animAttack(this.enemySprite, -52, () => {
          if (playerWasHit) {
            // Recul + flash → barre HP mise à jour APRÈS le recul
            this.tweens.add({
              targets: this.playerSprite, x: `+=${28}`, duration: 80, yoyo: true, ease: 'Power2',
              onComplete: () => this._updateHpBar(this.playerHpBar, this.playerUnit),
            });
            this.tweens.add({ targets: this.playerSprite, alpha: 0.3, duration: 60, yoyo: true, repeat: 1 });
            this._finishUpdate(380);

          } else if (playerDied) {
            // Mort du joueur → barre HP mise à jour pour le suivant après l'entrée
            this._animDie(this.playerSprite, () => {
              this._resetSprite(this.playerSprite, this._playerSpriteX, this._playerSpriteY);
              this.playerSprite.setTexture(`battle_${this.playerUnit?.type}`);
              this._updateHpBar(this.playerHpBar, this.playerUnit);
              this._animEnter(this.playerSprite, 'left', () => this._finishUpdate(80));
            });
          }
        });
      } else {
        // Pas de riposte (ennemi neutralisé en phase 1)
        this._finishUpdate(200);
      }
    });
  }

  // ── Helpers d'animation ───────────────────────────────────────────────────

  _animDie(sprite, onComplete) {
    this.tweens.add({
      targets: sprite,
      y: `+=${64}`, alpha: 0, angle: 28,
      duration: 380, ease: 'Power2',
      onComplete,
    });
  }

  _resetSprite(sprite, x, y) {
    sprite.setPosition(x, y).setAlpha(1).setAngle(0);
  }

  _animEnter(sprite, side, onComplete) {
    const origX = sprite.x;
    sprite.x = side === 'right' ? origX + 220 : origX - 220;
    sprite.setAlpha(0);
    this.tweens.add({
      targets: sprite, x: origX, alpha: 1,
      duration: 300, ease: 'Back.easeOut',
      onComplete,
    });
  }

  // Sprite lunges forward by dx px then snaps back; fires onComplete after full round-trip
  _animAttack(sprite, dx, onComplete) {
    this.tweens.add({
      targets: sprite,
      x: `+=${dx}`,
      duration: 180,
      ease: 'Power2',
      yoyo: true,
      onComplete,
    });
  }

  _finishUpdate(delay) {
    this.time.delayedCall(delay, () => {
      this._rebuildRosters();
      this._rebuildEnemyGhosts();
      this.time.delayedCall(100, () => {
        this.actionLocked = false;
        this._lockButtons(false);
      });
    });
  }

  _onBattleEnd(data) {
    const { winner, log } = data;
    this.logText.setText(this._fmtLog(log));
    this._lockButtons(true);

    const { width: W, height: H } = this.cameras.main;
    const isVictory = winner === 'player';
    const artifact = data.dungeonComplete;

    this.time.delayedCall(500, () => {
      const boxH = artifact ? 230 : 190;
      this.add.rectangle(W / 2, H / 2, 400, boxH, 0x12080a, 0.96)
        .setStrokeStyle(3, isVictory ? (artifact ? 0xcc88ff : 0xffd700) : 0xcc2222).setDepth(20);
      this.add.text(W / 2, H / 2 - boxH / 2 + 30,
        isVictory ? (artifact ? '✨ DONJON TERMINÉ ✨' : '⚔️  VICTOIRE  ⚔️') : '💀  DÉFAITE  💀', {
          fontFamily: 'Georgia, serif', fontSize: '26px',
          color: isVictory ? (artifact ? '#cc88ff' : '#ffd700') : '#cc4422',
        }).setOrigin(0.5).setDepth(21);

      if (artifact) {
        const statLabel = { hp: '+HP max', atk: '+ATK', def: '+DEF' }[artifact.stat] || artifact.stat;
        this.add.text(W / 2, H / 2 - 20, `Artéfact obtenu :`, {
          fontFamily: 'sans-serif', fontSize: '12px', color: '#aaaaaa',
        }).setOrigin(0.5).setDepth(21);
        this.add.text(W / 2, H / 2 + 4, artifact.name, {
          fontFamily: 'Georgia, serif', fontSize: '18px', color: '#cc88ff',
        }).setOrigin(0.5).setDepth(21);
        this.add.text(W / 2, H / 2 + 26, `${statLabel} +${artifact.value}  (permanent)`, {
          fontFamily: 'monospace', fontSize: '13px', color: '#88ffcc',
        }).setOrigin(0.5).setDepth(21);
      } else {
        const msg = isVictory
          ? `${this.playerTeam.filter(u => u.hp > 0).length} allié(s) survivant(s)`
          : 'Toutes vos unités sont tombées...';
        this.add.text(W / 2, H / 2 - 14, msg, {
          fontFamily: 'sans-serif', fontSize: '14px', color: '#d4c090',
        }).setOrigin(0.5).setDepth(21);
      }

      const contY = H / 2 + boxH / 2 - 35;
      const cont = this.add.rectangle(W / 2, contY, 190, 38, 0x3a6bbf, 0.92)
        .setInteractive({ useHandCursor: true }).setDepth(21);
      this.add.text(W / 2, contY, 'Continuer', {
        fontFamily: 'Georgia, serif', fontSize: '15px', color: '#ffffff',
      }).setOrigin(0.5).setDepth(22);
      cont.on('pointerdown', () => {
        // Unregister battle handlers and restore WorldScene's state listeners
        socketManager.off('battle_update').off('battle_end').off('dungeon_next_room');
        const world = this.scene.get('World') || this.worldScene;
        if (world) {
          socketManager
            .on('battle_update', (d) => world._applyStateUpdate(d.shared))
            .on('battle_end',    (d) => world._applyStateUpdate(d.shared))
            .on('battle_start',  (d) => { soundManager.battleStart(); world._enterBattle(d.battle); });
        }
        if (data.shared) world?._applyStateUpdate(data.shared);
        // Resume World via its own ScenePlugin before stopping Battle —
        // avoids Phaser silently dropping the resume when called from a
        // scene that is mid-shutdown (the issue that blocked movement after dungeons).
        if (world?.scene) world.scene.resume();
        this.scene.stop('Battle');
      });
    });
  }

  _onDungeonNextRoom(data) {
    // Reset the BattleScene in-place rather than stop+relaunch.
    // Stopping and relaunching would create a new Phaser scene lifecycle, which
    // caused scene.resume('World') to fail silently at the end of the dungeon.
    socketManager.off('battle_update').off('battle_end').off('dungeon_next_room');

    // Destroy all existing game objects and animations
    this.children.list.slice().forEach(o => o.destroy());
    this.tweens.killAll();
    this.actionLocked = false;

    // Reload with next-room battle data
    this._refreshFromBattle(data.battle);
    this.create();
  }

  _fmtLog(arr) {
    if (!Array.isArray(arr)) return '';
    return arr.slice(-3).join('\n');
  }
}