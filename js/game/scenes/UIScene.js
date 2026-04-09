import Phaser from 'phaser';
import { BUILDING_DATA, BUILDABLE } from '../data/buildings';
import { UNIT_STATS, UNIT_COSTS } from '../data/units';
import { HERO_DEFS, XP_PER_LEVEL, EQUIPMENT_DEFS } from '../data/heroes';

const PANEL_W = 280;

export class UIScene extends Phaser.Scene {
  constructor() { super({ key: 'UI', active: false }); }

  init(data) {
    // Persist across restarts (resize)
    if (data && Object.keys(data).length) this._savedData = data;
    const d = this._savedData || data;
    this.shared = d.shared;
    this.onBuild = d.onBuild;
    this.panel = null;
    this.messageTimeout = null;
    this.currentResources = d.shared?.resources || {};
  }

  create() {
    const { width: W, height: H } = this.cameras.main;

    // ── Resource bar (top) — fully responsive ────────────────────────────────
    const barH   = Math.max(36, Math.min(48, Math.floor(H * 0.065)));
    const barY   = barH / 2 + 2;
    const iconFs = Math.max(13, Math.min(18, Math.floor(W / 28)));
    const numFs  = Math.max(11, Math.min(15, Math.floor(W / 34)));

    this.add.rectangle(W / 2, barY, W, barH, 0x1a0f05, 0.92).setOrigin(0.5, 0.5);
    this.add.line(W / 2, barY + barH / 2, 0, 0, W, 0, 0xc8960c, 0.4);

    const resItems = [
      { key: 'wood',  icon: '🪵', label: 'Bois'    },
      { key: 'stone', icon: '⛰',  label: 'Pierre'  },
      { key: 'gold',  icon: '💰', label: 'Or'      },
      { key: 'food',  icon: '🌾', label: 'Nourrit.' },
    ];
    this.resTxts = {};
    const segW = W / resItems.length;
    resItems.forEach((r, i) => {
      const cx = Math.floor(segW * i + segW / 2);
      const iconW = iconFs + 2;
      // Show label only if enough space per segment
      const showLabel = segW > 110;
      if (showLabel) {
        this.add.text(cx - iconW / 2 - 4, barY - barH * 0.28, r.label, {
          fontFamily: 'sans-serif', fontSize: `${Math.max(9, numFs - 3)}px`, color: '#776644',
        }).setOrigin(0.5, 0);
      }
      this.add.text(cx - iconW, barY + (showLabel ? barH * 0.08 : -barH * 0.22), r.icon, {
        fontSize: `${iconFs}px`,
      }).setOrigin(0, 0.5);
      this.resTxts[r.key] = this.add.text(cx + iconW * 0.1, barY + (showLabel ? barH * 0.08 : -barH * 0.22), '0', {
        fontFamily: 'monospace', fontSize: `${numFs}px`, color: '#d4c090',
      }).setOrigin(0, 0.5);

      // Vertical separator (except before first item)
      if (i > 0) {
        const sep = this.add.graphics();
        sep.lineStyle(1, 0x4a3010, 0.5);
        sep.moveTo(segW * i, 6); sep.lineTo(segW * i, barH - 4); sep.strokePath();
      }
    });

    // ── Bottom bar (build + cancel) ───────────────────────────────────────────
    // Keep buttons at a safe distance from the resource bar and within screen bounds
    const bottomBtnH = 40;
    const bottomBtnY = Math.max(barH + bottomBtnH / 2 + 4, H - bottomBtnH / 2 - 8);
    const btnX = W - 90, btnY = bottomBtnY;
    const buildBtn = this.add.rectangle(btnX, btnY, 160, bottomBtnH, 0x3a2a0a, 0.9)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(1, 0xc8960c, 0.7);
    this.add.text(btnX, btnY, '🏗 Construire', {
      fontFamily: 'Georgia, serif', fontSize: '14px', color: '#c8960c',
    }).setOrigin(0.5);
    buildBtn.on('pointerdown', () => this._toggleBuildMenu());

    this.buildMenu = null;
    this.buildMenuVisible = false;

    // ── Cancel build mode button (touch-friendly, visible only in build mode) ──
    const cancelBtn = this.add.rectangle(W / 2, bottomBtnY, 160, bottomBtnH, 0x3a0a0a, 0.92)
      .setStrokeStyle(2, 0xff4444, 0.8).setInteractive({ useHandCursor: true }).setVisible(false);
    const cancelTxt = this.add.text(W / 2, bottomBtnY, '✕  Annuler', {
      fontFamily: 'Georgia, serif', fontSize: '14px', color: '#ff8888',
    }).setOrigin(0.5).setVisible(false);
    cancelBtn.on('pointerdown', () => {
      this.scene.get('World')?._cancelBuildMode();
      this._closeBuildMenu();
      this._hideCancelBtn();
    });
    this._cancelBtn  = cancelBtn;
    this._cancelBtnTxt = cancelTxt;

    // ── Message area ──────────────────────────────────────────────────────────
    const msgY = Math.max(barH + 26, bottomBtnY - 36);
    this.messageTxt = this.add.text(W / 2, msgY, '', {
      fontFamily: 'Georgia, serif', fontSize: '14px',
      color: '#ffd700', backgroundColor: '#1a0f05cc', padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setVisible(false);

    // ── Player list (top-right) ───────────────────────────────────────────────
    if (this.shared?.players) {
      this.shared.players.forEach((p, i) => {
        this.add.text(W - 10, 56 + i * 20, `${p.name}`, {
          fontFamily: 'sans-serif', fontSize: '12px',
          color: p.color || '#ffffff',
        }).setOrigin(1, 0);
      });
    }

    // ── Minimap ───────────────────────────────────────────────────────────────
    this._createMinimap(W, H);

    // ── Initial sync ─────────────────────────────────────────────────────────
    this.syncResources(this.shared?.resources || {});

    // ── Resize handling ───────────────────────────────────────────────────────
    this.scale.on('resize', this._onResize, this);
    this.events.once('shutdown', () => this.scale.off('resize', this._onResize, this));
  }

  _onResize() {
    // Rebuild the whole scene with the saved init data so all positions use fresh W/H
    this.scene.restart(this._savedData || {});
  }

  // ─── Resources ─────────────────────────────────────────────────────────────

  syncResources(res) {
    if (!this.resTxts) return;
    this.currentResources = res;
    for (const [key, txt] of Object.entries(this.resTxts)) {
      const val = Math.floor(res[key] || 0);
      txt.setText(`${val}`);
      txt.setColor(val < 30 ? '#ff6666' : '#d4c090');
    }
  }

  // ─── Cancel build button (touch) ───────────────────────────────────────────

  showCancelBtn() {
    this._cancelBtn?.setVisible(true);
    this._cancelBtnTxt?.setVisible(true);
  }

  _hideCancelBtn() {
    this._cancelBtn?.setVisible(false);
    this._cancelBtnTxt?.setVisible(false);
  }

  // ─── Messages ──────────────────────────────────────────────────────────────

  showMessage(msg, color = 0xffd700) {
    if (this.messageTimeout) this.time.removeEvent(this.messageTimeout);
    this.messageTxt
      .setText(msg)
      .setColor(`#${color.toString(16).padStart(6, '0')}`)
      .setVisible(true);
    this.messageTimeout = this.time.delayedCall(3500, () => this.messageTxt.setVisible(false));
  }

  // ─── Unit info panel ───────────────────────────────────────────────────────

  showUnitPanel(unit) {
    this.hidePanel();

    if (unit.isHero) {
      this._showHeroPanel(unit);
      return;
    }

    const stats = UNIT_STATS[unit.type] || {};
    const { width: W, height: H } = this.cameras.main;
    const px = W - PANEL_W - 10;
    const py = H - 280;
    const panelH = 250;

    const items = [];
    const bg = this.add.rectangle(px + PANEL_W / 2, py + panelH / 2, PANEL_W, panelH, 0x1a0f05, 0.92)
      .setStrokeStyle(2, 0xc8960c, 0.7);
    items.push(bg);

    items.push(this.add.text(px + 10, py + 10, stats.label || unit.type, {
      fontFamily: 'Georgia, serif', fontSize: '15px', color: '#c8960c',
    }));
    items.push(this.add.text(px + 10, py + 30, stats.faction || '', {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#888866',
    }));

    const hpPct = unit.hp / unit.maxHp;
    items.push(this.add.rectangle(px + 10, py + 52, 200, 10, 0x330000).setOrigin(0));
    items.push(this.add.rectangle(px + 10, py + 52, 200 * hpPct, 10,
      hpPct > 0.5 ? 0x22cc22 : hpPct > 0.25 ? 0xddaa00 : 0xcc2222).setOrigin(0));
    items.push(this.add.text(px + 10, py + 65, `❤ ${unit.hp} / ${unit.maxHp}`, {
      fontFamily: 'monospace', fontSize: '11px', color: '#aaaaaa',
    }));

    const statLine = `⚔ ATK ${stats.atk}  🛡 DEF ${stats.def}  💨 SPD ${stats.spd}`;
    items.push(this.add.text(px + 10, py + 82, statLine, {
      fontFamily: 'monospace', fontSize: '10px', color: '#b0a080',
    }));

    items.push(this.add.text(px + 10, py + 100, 'Attaques :', {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#c8a060',
    }));
    (stats.moves || []).forEach((m, i) => {
      items.push(this.add.text(px + 10, py + 116 + i * 26, `${m.name}`, {
        fontFamily: 'serif', fontSize: '12px', color: '#d4c090',
      }));
      items.push(this.add.text(px + 10, py + 128 + i * 26, `  ${m.desc}`, {
        fontFamily: 'sans-serif', fontSize: '10px', color: '#888866',
      }));
    });

    this.panel = { items };
  }

  _showHeroPanel(unit) {
    const def = HERO_DEFS[unit.type] || {};
    const { width: W, height: H } = this.cameras.main;
    const px = W - PANEL_W - 10;
    const panelH = 330;
    const py = H - panelH - 10;
    const items = [];

    const bg = this.add.rectangle(px + PANEL_W / 2, py + panelH / 2, PANEL_W, panelH, 0x14080a, 0.95)
      .setStrokeStyle(2, 0xffd700, 0.9);
    items.push(bg);

    // Hero title row
    items.push(this.add.text(px + 10, py + 10, `${def.icon || '✦'} ${def.label || unit.type}`, {
      fontFamily: 'Georgia, serif', fontSize: '15px', color: '#ffd700',
    }));
    items.push(this.add.text(px + PANEL_W - 10, py + 10, `Niv. ${unit.level}`, {
      fontFamily: 'monospace', fontSize: '13px', color: '#c8960c',
    }).setOrigin(1, 0));

    // HP bar
    const hpPct = unit.hp / unit.maxHp;
    items.push(this.add.rectangle(px + 10, py + 34, PANEL_W - 20, 9, 0x330000).setOrigin(0));
    items.push(this.add.rectangle(px + 10, py + 34, (PANEL_W - 20) * hpPct, 9,
      hpPct > 0.5 ? 0x22cc22 : hpPct > 0.25 ? 0xddaa00 : 0xcc2222).setOrigin(0));
    items.push(this.add.text(px + 10, py + 46, `❤ ${unit.hp} / ${unit.maxHp}`, {
      fontFamily: 'monospace', fontSize: '10px', color: '#aaaaaa',
    }));

    // XP bar
    const xpNext = XP_PER_LEVEL[Math.min(unit.level + 1, XP_PER_LEVEL.length - 1)];
    const xpPrev = XP_PER_LEVEL[unit.level] || 0;
    const xpPct  = xpNext > xpPrev ? (unit.xp - xpPrev) / (xpNext - xpPrev) : 1;
    items.push(this.add.rectangle(px + 10, py + 62, PANEL_W - 20, 7, 0x1a1a3a).setOrigin(0));
    items.push(this.add.rectangle(px + 10, py + 62, (PANEL_W - 20) * Math.max(0, Math.min(1, xpPct)), 7, 0x4488ff).setOrigin(0));
    items.push(this.add.text(px + 10, py + 72, `XP ${unit.xp}${xpNext ? ` / ${xpNext}` : ' (max)'}`, {
      fontFamily: 'monospace', fontSize: '10px', color: '#6699cc',
    }));

    // Equipment
    items.push(this.add.text(px + 10, py + 92, 'Équipement :', {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#c8a060',
    }));
    const eq = unit.equipment || {};
    const slots = [
      { slot: 'weapon',    icon: '⚔', label: EQUIPMENT_DEFS[eq.weapon]?.label    || 'Aucune' },
      { slot: 'armor',     icon: '🛡', label: EQUIPMENT_DEFS[eq.armor]?.label     || 'Aucune' },
      { slot: 'accessory', icon: '💍', label: EQUIPMENT_DEFS[eq.accessory]?.label || 'Aucun'  },
    ];
    slots.forEach((s, i) => {
      items.push(this.add.text(px + 14, py + 108 + i * 18, `${s.icon} ${s.label}`, {
        fontFamily: 'monospace', fontSize: '10px', color: '#b0a080',
      }));
    });

    // Active quest
    items.push(this.add.text(px + 10, py + 168, 'Quête :', {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#c8a060',
    }));
    const worldScene = this.scene.get('World');
    const npc = worldScene?.shared?.npcs?.find(n => n.quest.id === unit.activeQuest);
    const questLine = npc
      ? `${npc.quest.label}\n(${npc.questProgress || 0} / ${npc.quest.needed})`
      : 'Aucune quête active\nParlez à un PNJ (❓)';
    items.push(this.add.text(px + 14, py + 184, questLine, {
      fontFamily: 'sans-serif', fontSize: '10px', color: npc ? '#ffd700' : '#666644',
      wordWrap: { width: PANEL_W - 24 },
    }));

    // Stats line
    items.push(this.add.text(px + 10, py + 230, `⚔ ${def.atk}  🛡 ${def.def}  💨 ${def.spd}  ${def.moveType}`, {
      fontFamily: 'monospace', fontSize: '10px', color: '#b0a080',
    }));

    // Attacks
    items.push(this.add.text(px + 10, py + 248, 'Attaques :', {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#c8a060',
    }));
    (def.moves || unit.moves || []).slice(0, 4).forEach((m, i) => {
      items.push(this.add.text(px + 14, py + 264 + i * 16, `• ${m.name}  (${m.power}🗡)`, {
        fontFamily: 'monospace', fontSize: '9px', color: '#d4c090',
      }));
    });

    this.panel = { items };
  }

  // ─── Building info panel ───────────────────────────────────────────────────

  showBuildingPanel(building, onTrain) {
    this.hidePanel();
    const data = BUILDING_DATA[building.type] || {};
    const { width: W, height: H } = this.cameras.main;
    const px = W - PANEL_W - 10;
    const panelH = 240;
    const py = H - panelH - 10;

    const items = [];
    const bg = this.add.rectangle(px + PANEL_W / 2, py + panelH / 2, PANEL_W, panelH, 0x1a0f05, 0.92)
      .setStrokeStyle(2, 0xc8960c, 0.7);
    items.push(bg);

    items.push(this.add.text(px + 10, py + 10, `${data.icon || '🏠'} ${data.label || building.type}`, {
      fontFamily: 'Georgia, serif', fontSize: '15px', color: '#c8960c',
    }));
    items.push(this.add.text(px + 10, py + 32, data.desc || '', {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#888866',
      wordWrap: { width: PANEL_W - 20 },
    }));

    if (data.produces?.length) {
      items.push(this.add.text(px + 10, py + 72, 'Entraîner :', {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#c8a060',
      }));
      data.produces.forEach((unitType, i) => {
        const us = UNIT_STATS[unitType];
        const cost = UNIT_COSTS[unitType] || {};
        const costStr = Object.entries(cost).map(([k, v]) => `${v}${k[0].toUpperCase()}`).join(' ');
        const btnBg = this.add.rectangle(px + PANEL_W / 2, py + 94 + i * 44, PANEL_W - 20, 38, 0x2a1a06, 0.9)
          .setInteractive({ useHandCursor: true })
          .setStrokeStyle(1, 0x886630, 0.8);
        btnBg.on('pointerover', () => btnBg.setStrokeStyle(2, 0xffd700));
        btnBg.on('pointerout', () => btnBg.setStrokeStyle(1, 0x886630, 0.8));
        btnBg.on('pointerdown', () => onTrain(unitType));

        items.push(btnBg);
        items.push(this.add.text(px + 16, py + 83 + i * 44, us?.label || unitType, {
          fontFamily: 'serif', fontSize: '13px', color: '#d4c090',
        }));
        items.push(this.add.text(px + PANEL_W - 30, py + 85 + i * 44, costStr, {
          fontFamily: 'monospace', fontSize: '10px', color: '#c8960c',
        }).setOrigin(1, 0));
        items.push(this.add.text(px + 16, py + 97 + i * 44, `HP:${us?.maxHp} ATK:${us?.atk} DEF:${us?.def}`, {
          fontFamily: 'monospace', fontSize: '9px', color: '#666644',
        }));
      });
    }

    this.panel = { items };
  }

  hidePanel() {
    if (this.panel) {
      this.panel.items.forEach(i => i.destroy());
      this.panel = null;
    }
  }

  // ─── Build menu ────────────────────────────────────────────────────────────

  _toggleBuildMenu() {
    if (this.buildMenuVisible) {
      this._closeBuildMenu();
    } else {
      this._openBuildMenu();
    }
  }

  _openBuildMenu() {
    this.buildMenuVisible = true;
    const { width: W, height: H } = this.cameras.main;
    const cols = 3;
    const btnW = 100, btnH = 90;
    const menuW = cols * (btnW + 8) + 8;
    const menuH = Math.ceil(BUILDABLE.length / cols) * (btnH + 8) + 16;
    const resBarH  = Math.max(36, Math.min(48, Math.floor(H * 0.065)));
    const btnSafeY = Math.max(resBarH + 20 + 4, H - 20 - 8); // centre du bouton
    const mx = W - menuW - 14;
    const my = Math.max(resBarH + 4, btnSafeY - 20 - menuH - 4);

    const res = this.currentResources || {};
    const canAfford = (cost) => !cost || Object.entries(cost).every(([k, v]) => (res[k] || 0) >= v);

    const items = [];
    const bg = this.add.rectangle(mx + menuW / 2, my + menuH / 2, menuW + 4, menuH + 4, 0x1a0f05, 0.95)
      .setStrokeStyle(2, 0xc8960c, 0.7);
    items.push(bg);

    BUILDABLE.forEach((key, idx) => {
      const data = BUILDING_DATA[key];
      if (!data) return;
      const col = idx % cols, row = Math.floor(idx / cols);
      const bx = mx + 8 + col * (btnW + 8) + btnW / 2;
      const by = my + 8 + row * (btnH + 8) + btnH / 2;

      const cost = data.cost || {};
      const affordable = canAfford(cost);
      const costStr = Object.entries(cost).map(([k, v]) => {
        const have = res[k] || 0;
        const color = have >= v ? '#c8960c' : '#cc4444';
        // We can't do per-char color in Phaser text easily, so build a plain string
        return `${v}${k[0]}`;
      }).join(' ');

      const btnFill = affordable ? 0x2a1a06 : 0x1a1010;
      const strokeCol = affordable ? 0x886630 : 0x664444;
      const btn = this.add.rectangle(bx, by, btnW, btnH, btnFill, 0.92)
        .setStrokeStyle(1, strokeCol, 0.8);

      if (affordable) {
        btn.setInteractive({ useHandCursor: true });
        btn.on('pointerover', () => btn.setFillStyle(0x3a2a0a));
        btn.on('pointerout',  () => btn.setFillStyle(0x2a1a06));
        btn.on('pointerdown', () => { this._closeBuildMenu(); this.onBuild(key); });
      }

      items.push(btn);
      items.push(this.add.text(bx, by - 26, data.icon || '🏠', { fontSize: '20px' })
        .setOrigin(0.5).setAlpha(affordable ? 1 : 0.4));
      items.push(this.add.text(bx, by - 3, data.label, {
        fontFamily: 'sans-serif', fontSize: '10px', color: affordable ? '#d4c090' : '#776655',
        wordWrap: { width: btnW - 4 }, align: 'center',
      }).setOrigin(0.5));
      items.push(this.add.text(bx, by + 20, costStr, {
        fontFamily: 'monospace', fontSize: '9px', color: affordable ? '#c8960c' : '#cc4444',
      }).setOrigin(0.5));

      // Show missing resources below cost
      if (!affordable) {
        const missing = Object.entries(cost)
          .filter(([k, v]) => (res[k] || 0) < v)
          .map(([k, v]) => `-${v - (res[k] || 0)}${k[0]}`)
          .join(' ');
        items.push(this.add.text(bx, by + 33, missing, {
          fontFamily: 'monospace', fontSize: '8px', color: '#ff6666',
        }).setOrigin(0.5));
      }
    });

    this.buildMenu = { items };
  }

  _closeBuildMenu() {
    this.buildMenuVisible = false;
    if (this.buildMenu) {
      this.buildMenu.items.forEach(i => i.destroy());
      this.buildMenu = null;
    }
  }

  // ─── Minimap ───────────────────────────────────────────────────────────────

  _createMinimap(W, H) {
    const mmW = 120, mmH = 90;
    const mmX = W - mmW - 10, mmY = 56;
    const scaleX = mmW / 80, scaleY = mmH / 60;

    // Background
    this.add.rectangle(mmX + mmW / 2, mmY + mmH / 2, mmW + 4, mmH + 4, 0x1a0f05)
      .setStrokeStyle(1, 0xc8960c, 0.6);

    // Static minimap graphics (terrain)
    this.minimapGfx = this.add.graphics();
    this.minimapGfx.setPosition(mmX, mmY);

    // Will be updated in update()
    this._mmX = mmX; this._mmY = mmY;
    this._mmW = mmW; this._mmH = mmH;
    this._mmScaleX = scaleX; this._mmScaleY = scaleY;

    // Title
    this.add.text(mmX, mmY - 12, 'CARTE', {
      fontFamily: 'monospace', fontSize: '9px', color: '#886630',
    });
  }

  update() {
    // Update minimap units
    if (!this.minimapGfx) return;
    const g = this.minimapGfx;
    g.clear();

    const { shared } = this;
    if (!shared) return;

    const sx = this._mmScaleX, sy = this._mmScaleY;

    // Buildings
    for (const bld of (shared.buildings || [])) {
      g.fillStyle(0xc8960c, 0.8);
      g.fillRect(bld.x * sx, bld.y * sy, 4, 4);
    }
    // Units (hide enemy units that haven't been visited — fog aware)
    const worldScene = this.scene.get('World');
    const visited = worldScene?.visitedTiles;
    for (const unit of (shared.units || [])) {
      if (unit.owner === 'enemy' && visited && !visited.has(`${unit.x},${unit.y}`)) continue;
      const col = unit.owner === 'enemy' ? 0xcc2222 : unit.owner === 'neutral' ? 0x88aa44 : 0x3399ff;
      g.fillStyle(col, 0.9);
      g.fillRect(unit.x * sx, unit.y * sy, 3, 3);
    }
    // Resources
    for (const node of (shared.resourceNodes || [])) {
      if (node.amount <= 0) continue;
      const col = { wood: 0x4a6a2a, stone: 0x888888, gold: 0xddcc00, food: 0xdd8800 }[node.type] || 0x666666;
      g.fillStyle(col, 0.5);
      g.fillRect(node.x * sx, node.y * sy, 2, 2);
    }
  }
}