import Phaser from 'phaser';
import { socketManager } from '../network/SocketManager';
import { HERO_DEFS } from '../data/heroes';

// ─── Clans data ──────────────────────────────────────────────────────────────

const CLANS = [
  { key: 'loups_fer',      label: 'Les Loups de Fer',        icon: '🐺', color: 0x5a5a7a, bonus: 'Cavalerie +20% ATK' },
  { key: 'main_noire',     label: 'La Main Noire',            icon: '✦',  color: 0x1a1a2a, bonus: 'Mercenaires -25% or' },
  { key: 'corbeaux_nord',  label: 'Corbeaux du Nord',         icon: '◈',  color: 0x2a3a6a, bonus: 'Archers +20% ATK' },
  { key: 'ordre_lion',     label: "L'Ordre du Lion",          icon: '⬡',  color: 0x6a4a10, bonus: 'Garde royale dispo.' },
  { key: 'fils_chene',     label: 'Les Fils du Chêne',        icon: '✿',  color: 0x2a5a1a, bonus: 'Bois de départ +100' },
  { key: 'lances_argent',  label: 'Lances d\'Argent',         icon: '⟁',  color: 0x3a3a5a, bonus: 'Hommes d\'armes +DEF' },
  { key: 'confrerie_aube', label: "Confrérie de l'Aube",      icon: '✛',  color: 0x3a3a6a, bonus: 'Croisés -30% coût' },
  { key: 'ombres',         label: 'Ombres du Royaume',        icon: '🌑', color: 0x0d0d20, bonus: 'Unités +20% vitesse' },
];

// ─── Tutorial pages ───────────────────────────────────────────────────────────

const TUTORIAL = [
  {
    title: 'Bienvenue, Seigneur !',
    lines: [
      'Conquête Médiévale est un jeu de stratégie coopératif médiéval.',
      '',
      '• Vous et votre allié partagez un village et ses ressources.',
      '• Récoltez bois, pierre, or et nourriture pour construire.',
      '• Entraînez des unités pour défendre votre territoire.',
      '• Des vagues ennemies arrivent toutes les 30 secondes.',
      '',
      'Les combats se déroulent en tours — comme Pokémon !',
    ],
  },
  {
    title: 'Naviguer sur la Carte',
    lines: [
      'Déplacer la caméra :',
      '  • WASD  ou  ↑ ↓ ← →   (touches directionnelles)',
      '  • Pousser la souris vers le bord de l\'écran',
      '  • Molette souris : zoom avant / arrière',
      '',
      'La minimap (bas droite) montre la carte entière.',
      '  🔵 = vos unités    🔴 = ennemis    🟡 = bâtiments',
    ],
  },
  {
    title: 'Ressources & Construction',
    lines: [
      'Récolter des ressources :',
      '  ① Cliquer sur un Paysan pour le sélectionner',
      '  ② Cliquer sur une ressource (bois 🪵, pierre ⛰, or 💰, nourriture 🌾)',
      '     → Le paysan se déplace et récolte automatiquement.',
      '',
      'Construire un bâtiment :',
      '  ① Cliquer sur  🏗 Construire  (bas de l\'écran)',
      '  ② Choisir un bâtiment dans le menu',
      '  ③ Cliquer sur une case libre de la carte pour le poser',
    ],
  },
  {
    title: 'Le Système de Combat',
    lines: [
      'Quand votre unité se déplace sur une case ennemie → COMBAT !',
      '',
      'Le combat est tour par tour (style Pokémon) :',
      '  • Choisissez parmi 4 attaques à chaque tour',
      '  • 4 types de dégâts : LOURD · LÉGER · CAVALERIE · MAGIE',
      '',
      '  LOURD    > LÉGER       CAVALERIE  > LOURD',
      '  MAGIE    > LOURD       LÉGER      > MAGIE',
      '',
      'Choisissez l\'attaque la plus efficace contre le type ennemi !',
    ],
  },
  {
    title: 'Coopération Multijoueur',
    lines: [
      'Pour jouer avec un ami (sur n\'importe quel réseau) :',
      '',
      '  Joueur 1  →  Crée une salle  →  reçoit un code 6 lettres',
      '  Joueur 2  →  Entre ce code   →  la partie démarre !',
      '',
      '• Les ressources sont PARTAGÉES entre les deux joueurs.',
      '• Chacun peut commander toutes les unités alliées.',
      '• Coordinatez : l\'un construit, l\'autre attaque !',
      '',
      '⚔️  Bonne chance, Seigneur !',
    ],
  },
];

// ─── Scene ────────────────────────────────────────────────────────────────────

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    this.activeInput     = null;
    this.allInputs       = [];
    this.selectedClan    = CLANS[0];
    this.selectedHero    = 'roi_guerrier';
    this.clanBtns        = [];
    this.availableRooms  = [];
    this.roomListObjects = [];
    this._tabObjects     = [];   // narrow-mode tab content

    socketManager.connect('');

    const { width: W, height: H } = this.cameras.main;

    this._drawBackground(W, H);
    this._buildTitle(W, H);

    // Responsive: tab layout on narrow screens, side-by-side on wide
    if (W < 600) {
      this._buildTabLayout(W, H);
    } else {
      this._buildSideBySide(W, H);
    }

    this._buildTutorialBtn(W, H);

    // ── Keyboard handler ────────────────────────────────────────────────────
    // Desktop: Phaser keyboard handler (skipped when native input has focus)
    this.input.keyboard?.on('keydown', (e) => {
      if (document.activeElement === this._nativeEl) return; // native input handles it
      if (!this.activeInput) return;
      const s = this.activeInput.state;
      if (e.key === 'Backspace') {
        s.value = s.value.slice(0, -1);
      } else if (e.key === 'Enter' || e.key === 'Escape') {
        this._blurAll(); return;
      } else if (e.key === 'Tab') {
        const idx = this.allInputs.indexOf(this.activeInput);
        this._focusInput(this.allInputs[(idx + 1) % this.allInputs.length]); return;
      } else if (e.key.length === 1 && s.value.length < s.maxLen) {
        s.value += e.key;
      }
      this._renderInput(this.activeInput);
    });

    // ── Network ─────────────────────────────────────────────────────────────
    socketManager
      .on('connected', () => {
        this.connTxt?.setText('● Connecté').setColor('#55cc55');
        this._refreshRooms();
        this._showRejoinBanner();
      })
      .on('disconnected', () => {
        this.connTxt?.setText('● Déconnecté').setColor('#cc3333');
      })
      .on('game_start', (snapshot) => {
        this.scene.start('World', { snapshot });
      });

    this.time.addEvent({ delay: 5000, loop: true, callback: this._refreshRooms, callbackScope: this });

    // Restore form values if this is a resize-triggered restart
    if (this._resize_name !== undefined) {
      if (this.nameInput) { this.nameInput.state.value = this._resize_name; this._renderInput(this.nameInput); }
      if (this.codeInput && this._resize_code) { this.codeInput.state.value = this._resize_code; this._renderInput(this.codeInput); }
      this._resize_name = undefined;
      this._resize_code = undefined;
    }

    // ── Resize handling ──────────────────────────────────────────────────────
    this.scale.on('resize', this._onResize, this);
    this.events.once('shutdown', () => this.scale.off('resize', this._onResize, this));
  }

  _onResize() {
    this._resize_name = this.nameInput?.state.value ?? '';
    this._resize_code = this.codeInput?.state.value ?? '';
    this.scene.restart();
  }

  // ─── Background ──────────────────────────────────────────────────────────────

  _drawBackground(W, H) {
    this.add.rectangle(W / 2, H / 2, W, H, 0x09070c);
    const g = this.add.graphics();
    g.lineStyle(1, 0x171215, 1);
    for (let x = 0; x <= W; x += 48) { g.moveTo(x, 0); g.lineTo(x, H); }
    for (let y = 0; y <= H; y += 48) { g.moveTo(0, y); g.lineTo(W, y); }
    g.strokePath();
    g.fillStyle(0x0f0c13, 0.55);
    for (let i = 0; i < 28; i++) {
      g.fillRect(Math.floor(Math.random() * (W / 48)) * 48 + 2,
                 Math.floor(Math.random() * (H / 48)) * 48 + 2, 44, 44);
    }
    const f = this.add.graphics();
    f.lineStyle(4, 0x3a2a0a); f.strokeRect(8, 8, W - 16, H - 16);
    f.lineStyle(1, 0xc8960c, 0.35); f.strokeRect(14, 14, W - 28, H - 28);
    f.fillStyle(0xc8960c, 0.55);
    [[20, 20], [W - 20, 20], [20, H - 20], [W - 20, H - 20]]
      .forEach(([cx, cy]) => f.fillCircle(cx, cy, 5));
  }

  // ─── Title bar ───────────────────────────────────────────────────────────────

  _buildTitle(W, H) {
    const titleH = Math.max(36, Math.floor(H * 0.08));
    const g = this.add.graphics();
    g.fillStyle(0x120900, 0.92); g.fillRect(0, 8, W, titleH);
    g.lineStyle(2, 0xc8960c, 0.45); g.moveTo(0, 8 + titleH); g.lineTo(W, 8 + titleH); g.strokePath();
    g.fillStyle(0xc8960c, 0.35); g.fillRect(0, 8, W, 2);

    const fs = Math.max(12, Math.floor(W / 52));
    this.add.text(W / 2, 8 + titleH / 2, '⚔  CONQUÊTE MÉDIÉVALE  ⚔', {
      fontFamily: 'Georgia, serif', fontSize: `${fs}px`, color: '#c8960c',
      shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 6, fill: true },
    }).setOrigin(0.5);

    this.connTxt = this.add.text(W - 12, 8 + titleH / 2, '● Connexion...', {
      fontFamily: 'monospace', fontSize: '11px', color: '#888855',
    }).setOrigin(1, 0.5);

    this._titleH = 8 + titleH + 4;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WIDE LAYOUT (W >= 600) — two side-by-side columns
  // ═══════════════════════════════════════════════════════════════════════════

  _buildSideBySide(W, H) {
    const leftW = Math.max(300, Math.min(420, Math.floor(W * 0.38)));
    const py    = this._titleH;
    const ph    = H - py - 32;
    const gap   = 10;

    this._buildProfilePanel(12, py, leftW, ph, W, H);
    this._buildPlayPanel(12 + leftW + gap, py, W - (12 + leftW + gap) - 12, ph, W, H);
  }

  // ─── Profile panel (name + clan) ─────────────────────────────────────────────

  _buildProfilePanel(px, py, pw, ph, W, H) {
    this._drawPanel(px, py, pw, ph, 'VOTRE PROFIL');

    // Name
    this.add.text(px + 10, py + 36, 'Nom du seigneur', {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#c8a060',
    });
    this.nameInput = this._createInput(px + 10, py + 50, pw - 20, 'Votre nom...', 22);

    // Clan
    this.add.text(px + 10, py + 88, 'Clan', {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#c8a060',
    });
    const sl = this.add.graphics();
    sl.lineStyle(1, 0xc8960c, 0.25);
    sl.moveTo(px + 10, py + 100); sl.lineTo(px + pw - 10, py + 100); sl.strokePath();

    this._buildClanGrid(px + 10, py + 104, pw - 20, ph - 110);
  }

  _buildClanGrid(gx, gy, gw, gh) {
    const cols = 2, gapX = 4, gapY = 4;
    const bw   = Math.floor((gw - gapX) / cols);
    const rows  = Math.ceil(CLANS.length / cols);
    const bh    = Math.max(36, Math.floor((gh - gapY * (rows - 1)) / rows));

    CLANS.forEach((clan, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const bx  = gx + col * (bw + gapX);
      const by  = gy + row * (bh + gapY);
      const selected = i === 0;

      const bg = this.add.rectangle(bx + bw / 2, by + bh / 2, bw, bh, clan.color, 0.88)
        .setInteractive({ useHandCursor: true })
        .setStrokeStyle(selected ? 2 : 1, selected ? 0xffd700 : 0x555535);

      const iconFs = Math.min(16, Math.max(10, Math.floor(bh * 0.22)));
      const lblFs  = Math.min(12, Math.max(7,  Math.floor(bh * 0.17)));
      const bonFs  = Math.min(10, Math.max(6,  Math.floor(bh * 0.13)));

      this.add.text(bx + 4, by + 4, clan.icon, { fontSize: `${iconFs}px` });
      this.add.text(bx + 4 + iconFs + 2, by + 4, clan.label, {
        fontFamily: 'serif', fontSize: `${lblFs}px`, color: '#d4c090',
        wordWrap: { width: bw - iconFs - 12 },
      });
      if (bh > 44) {
        this.add.text(bx + 4, by + bh - bonFs - 4, clan.bonus, {
          fontFamily: 'monospace', fontSize: `${bonFs}px`, color: '#a08050',
          wordWrap: { width: bw - 8 },
        });
      }

      bg.on('pointerover', () => { if (this.selectedClan.key !== clan.key) bg.setStrokeStyle(1, 0xc8960c, 0.8); });
      bg.on('pointerout',  () => { if (this.selectedClan.key !== clan.key) bg.setStrokeStyle(1, 0x555535); });
      bg.on('pointerdown', () => this._selectClan(clan, bg));
      this.clanBtns.push({ bg, key: clan.key });
    });
  }

  _selectClan(clan) {
    this.selectedClan = clan;
    for (const btn of this.clanBtns) {
      btn.bg.setStrokeStyle(btn.key === clan.key ? 2 : 1,
                             btn.key === clan.key ? 0xffd700 : 0x555535);
    }
  }

  // ─── Play panel (create + join) ───────────────────────────────────────────────

  _buildPlayPanel(px, py, pw, ph, W, H) {
    const topH = Math.max(150, Math.floor(ph * 0.40));
    const gap  = 8;
    const botH = ph - topH - gap;

    this._buildCreateSection(px, py, pw, topH, W, H);
    this._buildJoinSection(px, py + topH + gap, pw, botH, W, H);

    // Status message (shared)
    this.statusMsgTxt = this.add.text(W / 2, H - 20, '', {
      fontFamily: 'sans-serif', fontSize: '13px', color: '#ccaa44',
      backgroundColor: '#180f04cc', padding: { x: 10, y: 4 },
    }).setOrigin(0.5).setVisible(false);
  }

  _buildCreateSection(px, py, pw, ph, W, H) {
    this._drawPanel(px, py, pw, ph, 'CRÉER UNE PARTIE');

    const descH = Math.floor(ph * 0.28);
    this.add.text(px + 12, py + 36, 'Lancez une partie coopérative. Partagez le code avec votre allié.', {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#777755',
      wordWrap: { width: pw - 24 },
    });

    const btnY = py + 36 + descH + 20;
    this.createBtn = this._makeButton(px + pw / 2, btnY, pw - 40, 40,
      '⚔  Créer la salle  ⚔', 0x3a5080, () => {
        const name = this.nameInput.state.value.trim() || 'Joueur 1';
        this._showHeroPicker(async (heroType) => {
          try {
            const res = await socketManager.createRoom(name, this.selectedClan.key, heroType);
            socketManager.setSession(res.code, name);
            this._showWaitingState(res.code, px, py, pw, ph);
          } catch (e) { this._showStatus(e.message, '#ff5533'); }
        });
      });

    // Waiting state (hidden)
    const codeFs = Math.max(28, Math.min(48, Math.floor(pw / 5)));
    const codeLbl = this.add.text(px + pw / 2, py + ph / 2 - 16, '', {
      fontFamily: 'monospace', fontSize: `${codeFs}px`, color: '#ffd700',
      shadow: { offsetX: 0, offsetY: 0, color: '#c8960c', blur: 12, fill: true },
    }).setOrigin(0.5).setVisible(false);
    const waitLbl = this.add.text(px + pw / 2, py + ph / 2 + codeFs / 2 + 6, '', {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#aaaaaa',
    }).setOrigin(0.5).setVisible(false);
    this._createdCodeTxt = codeLbl;
    this._waitingTxt     = waitLbl;
  }

  _buildJoinSection(px, py, pw, ph, W, H) {
    this._drawPanel(px, py, pw, ph, 'REJOINDRE UNE PARTIE');

    this.add.text(px + 12, py + 36, 'Salles disponibles  (actualisation auto)', {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#c8a060',
    });

    // Room list
    const listY = py + 56;
    const listH = Math.max(40, ph - 110);
    const listX = px + 12;
    const listW = pw - 24;
    const listBg = this.add.graphics();
    listBg.fillStyle(0x07060a, 0.65); listBg.fillRect(listX, listY, listW, listH);
    listBg.lineStyle(1, 0x3a2a0a, 0.9); listBg.strokeRect(listX, listY, listW, listH);
    this.noRoomsTxt = this.add.text(listX + listW / 2, listY + listH / 2,
      'Aucune salle\ndisponible', {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#444433', align: 'center',
      }).setOrigin(0.5);
    this._list = { x: listX, y: listY, w: listW, h: listH };

    // Manual join row
    const joinY = py + ph - 44;
    this.add.text(px + 12, joinY, 'Code :', {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#888866',
    });
    const codeInputW = Math.floor((pw - 24 - 8) * 0.45);
    const joinBtnW   = pw - 24 - codeInputW - 8;
    this.codeInput   = this._createInput(px + 12, joinY + 14, codeInputW, 'XXXXXX', 6);
    this._makeButton(px + 12 + codeInputW + 8 + joinBtnW / 2, joinY + 14 + 16, joinBtnW, 32,
      'Rejoindre →', 0x3a6040, () => {
        const name = this.nameInput.state.value.trim() || 'Joueur 2';
        const code = this.codeInput.state.value.toUpperCase().trim();
        if (code.length < 3) { this._showStatus('Code trop court (6 lettres requis)', '#ff5533'); return; }
        this._showHeroPicker((heroType) => this._doJoin(code, name, heroType));
      });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NARROW LAYOUT (W < 600) — tab system
  // ═══════════════════════════════════════════════════════════════════════════

  _buildTabLayout(W, H) {
    const tabY  = this._titleH;
    const tabH  = 38;
    const contY = tabY + tabH;
    const contH = H - contY - 32;
    const tabs  = ['PROFIL', 'JOUER'];

    // Tab bar background
    const tbg = this.add.graphics();
    tbg.fillStyle(0x0d0a04, 0.95);
    tbg.fillRect(0, tabY, W, tabH);
    tbg.lineStyle(1, 0x3a2a0a);
    tbg.moveTo(0, tabY + tabH); tbg.lineTo(W, tabY + tabH); tbg.strokePath();

    const tabW = Math.floor(W / tabs.length);
    this._tabBgs  = [];
    this._tabTxts = [];

    tabs.forEach((label, i) => {
      const tx = i * tabW;
      const bg = this.add.rectangle(tx + tabW / 2, tabY + tabH / 2, tabW, tabH, i === 0 ? 0x1e1206 : 0x08060a, 1)
        .setInteractive({ useHandCursor: true });
      const txt = this.add.text(tx + tabW / 2, tabY + tabH / 2, label, {
        fontFamily: 'Georgia, serif', fontSize: '13px',
        color: i === 0 ? '#c8960c' : '#666644',
      }).setOrigin(0.5);

      // Separator
      if (i > 0) {
        const sep = this.add.graphics();
        sep.lineStyle(1, 0x3a2a0a); sep.moveTo(tx, tabY + 4); sep.lineTo(tx, tabY + tabH - 4); sep.strokePath();
      }

      bg.on('pointerdown', () => this._switchTab(i, W, H, contY, contH));
      this._tabBgs.push(bg);
      this._tabTxts.push(txt);
    });

    // Active indicator line
    this._tabLine = this.add.graphics();
    this._drawTabLine(0, tabY, tabW, tabH);

    this._tabContY = contY;
    this._tabContH = contH;
    this._activeTab = 0;

    // Status message
    this.statusMsgTxt = this.add.text(W / 2, H - 20, '', {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#ccaa44',
      backgroundColor: '#180f04cc', padding: { x: 8, y: 3 },
    }).setOrigin(0.5).setVisible(false).setDepth(10);

    // Build initial tab content
    this._switchTab(0, W, H, contY, contH);
  }

  _drawTabLine(idx, tabY, tabW, tabH) {
    this._tabLine.clear();
    this._tabLine.lineStyle(2, 0xc8960c);
    const tx = idx * tabW;
    this._tabLine.moveTo(tx + 6, tabY + tabH - 2);
    this._tabLine.lineTo(tx + tabW - 6, tabY + tabH - 2);
    this._tabLine.strokePath();
  }

  _switchTab(idx, W, H, contY, contH) {
    // Update tab appearance
    const tabs = ['PROFIL', 'JOUER'];
    const tabW  = Math.floor(W / tabs.length);
    const tabY  = this._titleH;
    const tabH  = 38;

    this._tabBgs.forEach((bg, i) => {
      bg.setFillStyle(i === idx ? 0x1e1206 : 0x08060a);
    });
    this._tabTxts.forEach((txt, i) => {
      txt.setColor(i === idx ? '#c8960c' : '#666644');
    });
    this._drawTabLine(idx, tabY, tabW, tabH);
    this._activeTab = idx;

    // Destroy old content
    for (const o of this._tabObjects) { if (o && o.destroy) o.destroy(); }
    this._tabObjects = [];
    this.clanBtns = [];
    this.allInputs = [];
    this.activeInput = null;

    const pad = 10;
    if (idx === 0) {
      this._buildNarrowProfileTab(W, H, contY, contH, pad);
    } else {
      this._buildNarrowPlayTab(W, H, contY, contH, pad);
    }
  }

  _buildNarrowProfileTab(W, H, contY, contH, pad) {
    // Track objects created in this tab via a proxy
    const track = (obj) => { this._tabObjects.push(obj); return obj; };

    // Panel background
    track(this.add.rectangle(W / 2, contY + contH / 2, W - 16, contH, 0x100a04, 0.93)
      .setStrokeStyle(1, 0x3a2a0a));

    // Name input
    track(this.add.text(pad + 8, contY + 8, 'Nom du seigneur', {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#c8a060',
    }));
    this.nameInput = this._createInput(pad + 8, contY + 22, W - 2 * pad - 16, 'Votre nom...', 22);
    track(this.nameInput.bg); track(this.nameInput.txt);

    // Clan label
    track(this.add.text(pad + 8, contY + 62, 'Clan', {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#c8a060',
    }));
    const sl = track(this.add.graphics());
    sl.lineStyle(1, 0xc8960c, 0.25);
    sl.moveTo(pad + 8, contY + 74); sl.lineTo(W - pad - 8, contY + 74); sl.strokePath();

    // Clan grid — 2 cols
    const gx   = pad + 8;
    const gy   = contY + 78;
    const gw   = W - 2 * pad - 16;
    const gh   = contH - 84;
    const cols = 2, gapX = 4, gapY = 4;
    const bw   = Math.floor((gw - gapX) / cols);
    const rows  = Math.ceil(CLANS.length / cols);
    const bh    = Math.max(30, Math.floor((gh - gapY * (rows - 1)) / rows));

    CLANS.forEach((clan, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const bx  = gx + col * (bw + gapX);
      const by  = gy + row * (bh + gapY);
      const sel = i === 0;

      const bg = track(this.add.rectangle(bx + bw / 2, by + bh / 2, bw, bh, clan.color, 0.88)
        .setInteractive({ useHandCursor: true })
        .setStrokeStyle(sel ? 2 : 1, sel ? 0xffd700 : 0x555535));

      const iconFs = Math.min(14, Math.max(9, Math.floor(bh * 0.22)));
      const lblFs  = Math.min(11, Math.max(7, Math.floor(bh * 0.17)));

      track(this.add.text(bx + 4, by + 4, clan.icon, { fontSize: `${iconFs}px` }));
      track(this.add.text(bx + 4 + iconFs + 2, by + 3, clan.label, {
        fontFamily: 'serif', fontSize: `${lblFs}px`, color: '#d4c090',
        wordWrap: { width: bw - iconFs - 12 },
      }));

      bg.on('pointerover', () => { if (this.selectedClan.key !== clan.key) bg.setStrokeStyle(1, 0xc8960c); });
      bg.on('pointerout',  () => { if (this.selectedClan.key !== clan.key) bg.setStrokeStyle(1, 0x555535); });
      bg.on('pointerdown', () => this._selectClan(clan));
      this.clanBtns.push({ bg, key: clan.key });
    });
  }

  _buildNarrowPlayTab(W, H, contY, contH, pad) {
    const track = (obj) => { this._tabObjects.push(obj); return obj; };
    const cx    = W / 2;
    const pw    = W - 2 * pad;

    // ── CREATE ──────────────────────────────────────────────────────────────
    const createH = Math.floor(contH * 0.42);
    const createY = contY;

    track(this.add.rectangle(cx, createY + createH / 2, pw, createH, 0x100a04, 0.93)
      .setStrokeStyle(1, 0x3a2a0a));
    track(this.add.rectangle(cx, createY + 15, pw, 30, 0x1e1206, 1));
    track(this.add.text(pad + 10, createY + 6, 'CRÉER UNE PARTIE', {
      fontFamily: 'Georgia, serif', fontSize: '11px', color: '#c8960c',
    }));

    // Create button
    const createBtn = this._makeButton(cx, createY + createH * 0.45, pw - 30, 38,
      '⚔  Créer la salle  ⚔', 0x3a5080, () => {
        const name = this.nameInput?.state.value.trim() || 'Joueur 1';
        this._showHeroPicker(async (heroType) => {
          try {
            const res = await socketManager.createRoom(name, this.selectedClan.key, heroType);
            socketManager.setSession(res.code, name);
            this._showWaitingStateNarrow(res.code, cx, createY, createH, createBtn);
          } catch (e) { this._showStatus(e.message, '#ff5533'); }
        });
      });
    track(createBtn.bg); track(createBtn.txt);
    this._createBtn = createBtn;

    // Waiting state (hidden)
    const codeFs = Math.max(22, Math.min(36, Math.floor(pw / 6)));
    const codeLbl = track(this.add.text(cx, createY + createH * 0.42, '', {
      fontFamily: 'monospace', fontSize: `${codeFs}px`, color: '#ffd700',
      shadow: { offsetX: 0, offsetY: 0, color: '#c8960c', blur: 12, fill: true },
    }).setOrigin(0.5).setVisible(false));
    const waitLbl = track(this.add.text(cx, createY + createH * 0.68, '', {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#aaaaaa',
    }).setOrigin(0.5).setVisible(false));
    this._createdCodeTxt = codeLbl;
    this._waitingTxt     = waitLbl;

    // ── JOIN ────────────────────────────────────────────────────────────────
    const joinY = createY + createH + 8;
    const joinH = contH - createH - 8;

    track(this.add.rectangle(cx, joinY + joinH / 2, pw, joinH, 0x100a04, 0.93)
      .setStrokeStyle(1, 0x3a2a0a));
    track(this.add.rectangle(cx, joinY + 15, pw, 30, 0x1e1206, 1));
    track(this.add.text(pad + 10, joinY + 6, 'REJOINDRE UNE PARTIE', {
      fontFamily: 'Georgia, serif', fontSize: '11px', color: '#c8960c',
    }));

    // Room list
    const listY = joinY + 34;
    const listH = Math.max(30, joinH - 82);
    const listX = pad + 10;
    const listW = pw - 20;
    const listBg = track(this.add.graphics());
    listBg.fillStyle(0x07060a, 0.65); listBg.fillRect(listX, listY, listW, listH);
    listBg.lineStyle(1, 0x3a2a0a, 0.9); listBg.strokeRect(listX, listY, listW, listH);
    this.noRoomsTxt = track(this.add.text(listX + listW / 2, listY + listH / 2,
      'Aucune salle disponible', {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#444433', align: 'center',
      }).setOrigin(0.5));
    this._list = { x: listX, y: listY, w: listW, h: listH };

    // Manual code input + join button
    const joinRowY = joinY + joinH - 40;
    track(this.add.text(pad + 10, joinRowY, 'Code :', {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#888866',
    }));
    const codeInpW = Math.floor((pw - 20 - 6) * 0.48);
    const joinBtnW = pw - 20 - codeInpW - 6;
    this.codeInput = this._createInput(pad + 10, joinRowY + 14, codeInpW, 'XXXXXX', 6);
    track(this.codeInput.bg); track(this.codeInput.txt);
    const jbtn = this._makeButton(pad + 10 + codeInpW + 6 + joinBtnW / 2, joinRowY + 14 + 16,
      joinBtnW, 32, 'Rejoindre →', 0x3a6040, () => {
        const name = this.nameInput?.state.value.trim() || 'Joueur 2';
        const code = this.codeInput.state.value.toUpperCase().trim();
        if (code.length < 3) { this._showStatus('Code trop court (6 lettres requis)', '#ff5533'); return; }
        this._showHeroPicker((heroType) => this._doJoin(code, name, heroType));
      });
    track(jbtn.bg); track(jbtn.txt);
  }

  _showWaitingStateNarrow(code, cx, createY, createH, createBtn) {
    createBtn.bg.setVisible(false).disableInteractive();
    createBtn.txt.setVisible(false);
    this._createdCodeTxt.setText(code).setVisible(true);
    this._waitingTxt.setText('En attente de votre allié...').setVisible(true);
    this.tweens.add({ targets: this._createdCodeTxt, alpha: { from: 1, to: 0.6 }, duration: 900, yoyo: true, repeat: -1 });
    let d = 0;
    const dots = ['●  ○  ○', '○  ●  ○', '○  ○  ●'];
    this.time.addEvent({ delay: 400, loop: true, callback: () => {
      this._waitingTxt.setText(`En attente…  ${dots[d++ % 3]}`);
    }});
  }

  // ─── Tutorial button ──────────────────────────────────────────────────────────

  _buildTutorialBtn(W, H) {
    const tutBg = this.add.rectangle(W / 2, H - 18, Math.min(240, W - 32), 26, 0x1a0f04, 0.92)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(1, 0x4a3010, 0.8);
    this.add.text(W / 2, H - 18, '?  Tutoriel — Comment jouer', {
      fontFamily: 'Georgia, serif', fontSize: '12px', color: '#c8a060',
    }).setOrigin(0.5);
    tutBg.on('pointerover', () => tutBg.setStrokeStyle(2, 0xffd700, 0.8));
    tutBg.on('pointerout',  () => tutBg.setStrokeStyle(1, 0x4a3010, 0.8));
    tutBg.on('pointerdown', () => this._showTutorial());
  }

  // ─── Room list ────────────────────────────────────────────────────────────────

  async _refreshRooms() {
    this.availableRooms = await socketManager.listRooms();
    this._renderRoomList();
  }

  _renderRoomList() {
    for (const obj of this.roomListObjects) obj.destroy();
    this.roomListObjects = [];

    const rooms = this.availableRooms;
    if (!this._list || !this.noRoomsTxt) return;
    this.noRoomsTxt.setVisible(rooms.length === 0);
    if (rooms.length === 0) return;

    const { x, y, w, h } = this._list;
    const rowH    = Math.min(46, Math.floor(h / Math.max(1, rooms.length)));
    const maxRows = Math.floor(h / rowH);

    rooms.slice(0, maxRows).forEach((room, i) => {
      const ry = y + i * rowH + 3;
      const rw = w - 6;

      const rowBg = this.add.rectangle(x + 3 + rw / 2, ry + (rowH - 6) / 2, rw, rowH - 6, 0x14100a, 0.92)
        .setInteractive({ useHandCursor: true }).setStrokeStyle(1, 0x3a2a0a);
      rowBg.on('pointerover', () => rowBg.setStrokeStyle(2, 0xc8960c, 0.9));
      rowBg.on('pointerout',  () => rowBg.setStrokeStyle(1, 0x3a2a0a));
      rowBg.on('pointerdown', () => {
        const name = this.nameInput?.state.value.trim() || 'Joueur 2';
        this._showHeroPicker((heroType) => this._doJoin(room.code, name, heroType));
      });

      const statusLabel = room.inProgress ? '⚔ En cours' : '⏳ En attente';
      const statusColor = room.inProgress ? '#ff9944'    : '#aaaaaa';
      const codeTxt  = this.add.text(x + 8, ry + 4,  room.code,             { fontFamily: 'monospace',     fontSize: '14px', color: '#ffd700' });
      const nameTxt  = this.add.text(x + 8, ry + 22, room.hostName || '—',  { fontFamily: 'Georgia, serif', fontSize: '12px', color: '#d4c090' });
      const statTxt  = this.add.text(x + w - 10, ry + 4,  statusLabel,      { fontFamily: 'monospace',     fontSize: '10px', color: statusColor }).setOrigin(1, 0);
      const joinHint = this.add.text(x + w - 10, ry + 22, '→ Rejoindre',    { fontFamily: 'serif',         fontSize: '11px', color: '#88cc88'  }).setOrigin(1, 0);

      this.roomListObjects.push(rowBg, codeTxt, nameTxt, statTxt, joinHint);
    });
  }

  async _doJoin(code, name, heroType) {
    try {
      await socketManager.joinRoom(code, name, this.selectedClan.key, heroType || this.selectedHero);
      socketManager.setSession(code.toUpperCase(), name);
    } catch (e) { this._showStatus(e.message, '#ff5533'); }
  }

  // ─── Rejoin banner (shown after page refresh if session exists) ──────────────

  _showRejoinBanner() {
    const sess = socketManager.session;
    if (!sess) return;
    if (this._rejoinBanner) return; // already shown

    const { width: W, height: H } = this.cameras.main;
    const bw = Math.min(460, W * 0.9), bh = 64;
    const bx = W / 2, by = H - 44;

    const bg = this.add.rectangle(bx, by, bw, bh, 0x1a3a1a, 0.96)
      .setStrokeStyle(2, 0x44cc88, 0.9).setDepth(50).setScrollFactor(0);
    const lbl = this.add.text(bx, by - 10,
      `🔄  Partie en cours détectée  (${sess.code} · ${sess.name})`, {
        fontFamily: 'Georgia, serif', fontSize: '13px', color: '#88ffcc',
      }).setOrigin(0.5).setDepth(51).setScrollFactor(0);

    const btnBg = this.add.rectangle(bx, by + 18, 180, 24, 0x2a7a4a, 0.95)
      .setStrokeStyle(1, 0x44cc88).setInteractive({ useHandCursor: true })
      .setDepth(51).setScrollFactor(0);
    const btnTxt = this.add.text(bx, by + 18, 'Reprendre la partie', {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#ffffff',
    }).setOrigin(0.5).setDepth(52).setScrollFactor(0);

    const dismissBg = this.add.rectangle(bx + 100, by + 18, 60, 24, 0x3a1a1a, 0.9)
      .setStrokeStyle(1, 0x884444).setInteractive({ useHandCursor: true })
      .setDepth(51).setScrollFactor(0);
    const dismissTxt = this.add.text(bx + 100, by + 18, 'Ignorer', {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#cc8888',
    }).setOrigin(0.5).setDepth(52).setScrollFactor(0);

    const banner = [bg, lbl, btnBg, btnTxt, dismissBg, dismissTxt];
    this._rejoinBanner = banner;

    btnBg.on('pointerdown', () => {
      banner.forEach(o => o.destroy());
      this._rejoinBanner = null;
      socketManager.socket?.emit('rejoin_game', sess);
    });
    dismissBg.on('pointerdown', () => {
      socketManager.clearSession();
      banner.forEach(o => o.destroy());
      this._rejoinBanner = null;
    });
  }

  // ─── Waiting state (wide layout) ─────────────────────────────────────────────

  _showWaitingState(code, px, py, pw, topH) {
    this.createBtn.bg.setVisible(false).disableInteractive();
    this.createBtn.txt.setVisible(false);
    this._createdCodeTxt.setText(code).setVisible(true);
    this._waitingTxt.setText('En attente de votre allié...').setVisible(true);
    this.tweens.add({ targets: this._createdCodeTxt, alpha: { from: 1, to: 0.6 }, duration: 900, yoyo: true, repeat: -1 });
    let d = 0;
    const dots = ['●  ○  ○', '○  ●  ○', '○  ○  ●'];
    this.time.addEvent({ delay: 400, loop: true, callback: () => {
      this._waitingTxt.setText(`En attente de votre allié…  ${dots[d++ % 3]}`);
    }});
  }

  // ─── Hero picker ──────────────────────────────────────────────────────────────

  _showHeroPicker(onConfirm) {
    const { width: W, height: H } = this.cameras.main;
    const heroes = Object.entries(HERO_DEFS);
    const cardW  = Math.max(110, Math.floor((Math.min(W, 680) - 80) / heroes.length));
    const cardH  = Math.max(200, Math.floor(cardW * 1.25));
    const gap    = Math.max(6, Math.floor(W * 0.012));
    const totalW = heroes.length * cardW + (heroes.length - 1) * gap;
    const panelW = Math.min(W - 24, totalW + 48);
    const panelH = Math.min(H - 48, cardH + 90);
    const cx = W / 2, cy = H / 2;

    const overlay = [];
    const dimmer = this.add.rectangle(cx, cy, W, H, 0x000000, 0.82).setDepth(60).setInteractive();
    const panel  = this.add.rectangle(cx, cy, panelW, panelH, 0x10080e).setDepth(61)
      .setStrokeStyle(3, 0xc8960c, 0.75);
    overlay.push(dimmer, panel);

    const title = this.add.text(cx, cy - panelH / 2 + 20, 'CHOISISSEZ VOTRE HÉROS', {
      fontFamily: 'Georgia, serif', fontSize: `${Math.max(13, Math.floor(panelW / 28))}px`, color: '#c8960c',
    }).setOrigin(0.5).setDepth(62);
    overlay.push(title);

    let pickedKey = this.selectedHero;
    const cardBgs = {};
    const startX  = cx - totalW / 2 + cardW / 2;

    heroes.forEach(([key, def], i) => {
      const bx = startX + i * (cardW + gap);
      const by = cy + 10;
      const top = by - cardH / 2; // absolute top of card
      const isSelected = key === pickedKey;

      const cardBg = this.add.rectangle(bx, by, cardW, cardH, isSelected ? 0x2a1a06 : 0x14100a, 0.95)
        .setStrokeStyle(isSelected ? 2 : 1, isSelected ? 0xffd700 : 0x4a3010)
        .setInteractive({ useHandCursor: true }).setDepth(62);
      cardBgs[key] = cardBg;

      // Font sizes capped so they can't overflow
      const iconFs = Math.min(22, Math.max(14, Math.floor(cardW * 0.18)));
      const namFs  = Math.min(12, Math.max(9,  Math.floor(cardW * 0.08)));
      const smFs   = Math.min(9,  Math.max(7,  Math.floor(cardW * 0.06)));

      // All positions as fixed % of cardH from card top — no overlap possible
      const iconY  = top + cardH * 0.13;
      const nameY  = top + cardH * 0.31;
      const descY  = top + cardH * 0.42;
      const statsY = top + cardH * 0.60;
      const movesY = top + cardH * 0.76;

      const icon  = this.add.text(bx, iconY, def.icon, { fontSize: `${iconFs}px` })
        .setOrigin(0.5).setDepth(63);
      const name  = this.add.text(bx, nameY, def.label, {
        fontFamily: 'Georgia, serif', fontSize: `${namFs}px`, color: '#c8960c',
      }).setOrigin(0.5).setDepth(63);
      const desc  = this.add.text(bx, descY, def.desc, {
        fontFamily: 'sans-serif', fontSize: `${smFs}px`, color: '#aaaaaa',
        wordWrap: { width: cardW - 14 }, align: 'center',
      }).setOrigin(0.5, 0).setDepth(63);
      const stats = this.add.text(bx, statsY, [
        `❤ ${def.maxHp}  ⚔ ${def.atk}  🛡 ${def.def}`,
        `💨 ${def.spd}   👁 ${def.visionRadius}   ${def.moveType}`,
      ].join('\n'), {
        fontFamily: 'monospace', fontSize: `${smFs}px`, color: '#b0a080', align: 'center',
      }).setOrigin(0.5, 0).setDepth(63);
      const moves = this.add.text(bx, movesY, def.moves.map(m => `• ${m.name}`).join('\n'), {
        fontFamily: 'sans-serif', fontSize: `${smFs}px`, color: '#888866', align: 'center',
      }).setOrigin(0.5, 0).setDepth(63);

      cardBg.on('pointerover', () => { if (key !== pickedKey) cardBg.setStrokeStyle(1, 0xc8960c); });
      cardBg.on('pointerout',  () => { if (key !== pickedKey) cardBg.setStrokeStyle(1, 0x4a3010); });
      cardBg.on('pointerdown', () => {
        pickedKey = key; this.selectedHero = key;
        for (const [k, bg] of Object.entries(cardBgs)) {
          bg.setFillStyle(k === key ? 0x2a1a06 : 0x14100a);
          bg.setStrokeStyle(k === key ? 2 : 1, k === key ? 0xffd700 : 0x4a3010);
        }
      });
      overlay.push(cardBg, icon, name, desc, stats, moves);
    });

    const confirmBg = this.add.rectangle(cx, cy + panelH / 2 - 28, 180, 38, 0x1a3a20, 0.95)
      .setInteractive({ useHandCursor: true }).setStrokeStyle(2, 0x44aa66).setDepth(62);
    const confirmTxt = this.add.text(cx, cy + panelH / 2 - 28, '✓  Confirmer', {
      fontFamily: 'Georgia, serif', fontSize: '14px', color: '#88cc88',
    }).setOrigin(0.5).setDepth(63);
    confirmBg.on('pointerover', () => confirmBg.setStrokeStyle(2, 0xffd700));
    confirmBg.on('pointerout',  () => confirmBg.setStrokeStyle(2, 0x44aa66));
    confirmBg.on('pointerdown', () => {
      overlay.forEach(o => o.destroy());
      onConfirm(pickedKey);
    });
    overlay.push(confirmBg, confirmTxt);
  }

  // ─── Tutorial ─────────────────────────────────────────────────────────────────

  _showTutorial() {
    const { width: W, height: H } = this.cameras.main;
    this._tutOverlay = [];
    this._tutContent = [];
    this._tutPage    = 0;
    this._tutW = Math.min(W - 24, 740);
    this._tutH = Math.min(H - 40, 500);

    const dimmer = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.78).setDepth(50).setInteractive();
    const panel  = this.add.rectangle(W / 2, H / 2, this._tutW, this._tutH, 0x10080e).setDepth(51)
      .setStrokeStyle(3, 0xc8960c, 0.75);
    this._tutOverlay = [dimmer, panel];
    dimmer.on('pointerdown', () => this._closeTutorial());
    this._renderTutPage(0);
  }

  _renderTutPage(pageIdx) {
    for (const o of this._tutContent) o.destroy();
    this._tutContent = [];

    const { width: W, height: H } = this.cameras.main;
    const cx   = W / 2, cy = H / 2;
    const page = TUTORIAL[pageIdx];
    const tW   = this._tutW || Math.min(W - 24, 740);
    const tH   = this._tutH || Math.min(H - 40, 500);
    const hW   = tW / 2;
    const hH   = tH / 2;
    const narrow = tW < 480;
    const bodyW = narrow ? tW - 32 : Math.floor(tW * 0.52);
    const bodyX = cx - hW + 16;

    // Header
    const hdr = this.add.rectangle(cx, cy - hH + 21, tW, 40, 0x1e1206, 1).setDepth(52);
    const ttl = this.add.text(cx, cy - hH + 21, page.title, {
      fontFamily: 'Georgia, serif', fontSize: `${Math.max(13, Math.floor(tW / 40))}px`, color: '#c8960c',
    }).setOrigin(0.5).setDepth(53);
    const pgn = this.add.text(cx + hW - 10, cy - hH + 21, `${pageIdx + 1}/${TUTORIAL.length}`, {
      fontFamily: 'monospace', fontSize: '12px', color: '#886630',
    }).setOrigin(1, 0.5).setDepth(53);

    // Body
    const body = this.add.text(bodyX, cy - hH + 50, page.lines.join('\n'), {
      fontFamily: 'sans-serif', fontSize: `${Math.max(11, Math.floor(tW / 58))}px`, color: '#cfc090',
      lineSpacing: 4, wordWrap: { width: bodyW },
    }).setDepth(52);

    // Illustration (only on wide panels)
    const illGfx = this.add.graphics().setDepth(52);
    if (!narrow) this._drawIllustration(illGfx, pageIdx, cx + Math.floor(tW * 0.22), cy - 10);

    // Close ✕
    const closeX = this.add.text(cx + hW - 8, cy - hH + 4, '✕', {
      fontFamily: 'sans-serif', fontSize: '20px', color: '#886630',
    }).setInteractive({ useHandCursor: true }).setDepth(53).setOrigin(1, 0);
    closeX.on('pointerover', () => closeX.setColor('#ffd700'));
    closeX.on('pointerout',  () => closeX.setColor('#886630'));
    closeX.on('pointerdown', () => this._closeTutorial());

    // Dots
    const dotY = cy + hH - 26;
    for (let i = 0; i < TUTORIAL.length; i++) {
      const dot = this.add.circle(cx - (TUTORIAL.length - 1) * 10 + i * 20, dotY,
        i === pageIdx ? 6 : 4, i === pageIdx ? 0xffd700 : 0x555533).setDepth(53);
      this._tutContent.push(dot);
    }

    // Prev / Next
    const hasPrev = pageIdx > 0;
    const hasNext = pageIdx < TUTORIAL.length - 1;
    const btnY    = cy + hH - 26;
    const btnW    = Math.min(120, Math.floor(tW * 0.18));

    const prevBg = this.add.rectangle(cx - btnW - 8, btnY, btnW, 34,
      hasPrev ? 0x2a1a06 : 0x111111, 0.92)
      .setInteractive({ useHandCursor: hasPrev }).setStrokeStyle(1, hasPrev ? 0x886630 : 0x222222).setDepth(53);
    const prevTxt = this.add.text(cx - btnW - 8, btnY, '← Préc.', {
      fontFamily: 'sans-serif', fontSize: '12px', color: hasPrev ? '#c8a060' : '#333322',
    }).setOrigin(0.5).setDepth(54);

    const nextBg = this.add.rectangle(cx + btnW + 8, btnY, btnW, 34, 0x1a3020, 0.92)
      .setInteractive({ useHandCursor: true }).setStrokeStyle(1, 0x3a6040).setDepth(53);
    const nextTxt = this.add.text(cx + btnW + 8, btnY, hasNext ? 'Suivant →' : 'Fermer ✓', {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#88cc88',
    }).setOrigin(0.5).setDepth(54);

    if (hasPrev) prevBg.on('pointerdown', () => this._renderTutPage(pageIdx - 1));
    nextBg.on('pointerdown', () => hasNext ? this._renderTutPage(pageIdx + 1) : this._closeTutorial());

    [prevBg, nextBg].forEach((b, j) => {
      b.on('pointerover', () => b.setStrokeStyle(2, 0xffd700));
      b.on('pointerout',  () => b.setStrokeStyle(1, j === 0 ? (hasPrev ? 0x886630 : 0x222222) : 0x3a6040));
    });

    this._tutContent.push(hdr, ttl, pgn, body, illGfx, closeX, prevBg, prevTxt, nextBg, nextTxt);
  }

  _drawIllustration(g, pageIdx, cx, cy) {
    const iW = 220, iH = 170;
    g.lineStyle(1, 0x3a2a0a, 0.5); g.strokeRect(cx - iW / 2, cy - iH / 2, iW, iH);

    switch (pageIdx) {
      case 0: {
        g.fillStyle(0x3a6a30); g.fillRect(cx - iW / 2, cy - iH / 2, iW, iH);
        g.fillStyle(0x2a5aaa); g.fillEllipse(cx - 20, cy + 10, 70, 40);
        g.fillStyle(0x265a20); g.fillCircle(cx - 60, cy - 30, 24);
        g.fillStyle(0x6a6060); g.fillTriangle(cx + 60, cy - 50, cx + 40, cy - 20, cx + 80, cy - 20);
        g.fillStyle(0x8b5e3c); g.fillRect(cx + 20, cy + 10, 40, 26);
        g.fillStyle(0x3a6bbf); g.fillCircle(cx + 64, cy - 28, 9);
        g.fillStyle(0xcc3322); g.fillCircle(cx - 70, cy + 50, 9);
        break;
      }
      case 1: {
        g.lineStyle(3, 0x4a3010); g.strokeRect(cx - iW / 2, cy - iH / 2, iW, iH);
        g.lineStyle(2, 0xffd700, 0.7); g.strokeRect(cx - 60, cy - 40, 120, 80);
        const arr = (ax, ay, dir) => {
          const [dx, dy] = { U: [0,-1], D: [0,1], L: [-1,0], R: [1,0] }[dir];
          g.fillStyle(0xffd700, 0.75);
          g.fillTriangle(ax + dx * 18, ay + dy * 18, ax - dy * 8, ay + dx * 8, ax + dy * 8, ay - dx * 8);
        };
        arr(cx, cy - 60, 'U'); arr(cx, cy + 60, 'D'); arr(cx - 80, cy, 'L'); arr(cx + 80, cy, 'R');
        break;
      }
      case 2: {
        const drawUnit = (x, y, c) => { g.fillStyle(c); g.fillCircle(x, y, 14); };
        const drawRes  = (x, y) => { g.fillStyle(0x2a5a1a); g.fillCircle(x, y - 6, 16); g.fillStyle(0x5a3a1a); g.fillRect(x - 4, y + 6, 8, 12); };
        const drawTH   = (x, y) => { g.fillStyle(0x8b5e3c); g.fillRect(x - 20, y - 14, 40, 28); g.fillStyle(0x6b3a1f); g.fillTriangle(x, y - 22, x - 22, y - 12, x + 22, y - 12); };
        drawUnit(cx - 80, cy, 0xa0784a); drawRes(cx - 20, cy); drawTH(cx + 70, cy);
        g.lineStyle(2, 0xffd700, 0.6); g.strokeCircle(cx - 80, cy, 16);
        break;
      }
      case 3: {
        g.fillStyle(0x1a2a50); g.fillRect(cx - iW / 2, cy - iH / 2, iW, iH * 0.5);
        g.fillStyle(0x2a3a10); g.fillRect(cx - iW / 2, cy, iW, iH * 0.5);
        g.fillStyle(0xcc2222); g.fillCircle(cx + 55, cy - 28, 20);
        g.fillStyle(0x3a6bbf); g.fillCircle(cx - 55, cy + 28, 20);
        g.fillStyle(0x330000); g.fillRect(cx + 16, cy - 58, 75, 10);
        g.fillStyle(0xcc3322); g.fillRect(cx + 16, cy - 58, 50, 10);
        g.fillStyle(0x330000); g.fillRect(cx - iW / 2 + 8, cy + 50, 75, 10);
        g.fillStyle(0x22cc22); g.fillRect(cx - iW / 2 + 8, cy + 50, 68, 10);
        break;
      }
      case 4: {
        g.fillStyle(0x3a6bbf); g.fillCircle(cx - 60, cy - 14, 22);
        g.lineStyle(3, 0x88bbff, 0.6); g.strokeCircle(cx - 60, cy - 14, 24);
        g.fillStyle(0x8b0000); g.fillCircle(cx + 60, cy - 14, 22);
        g.lineStyle(3, 0xff8888, 0.6); g.strokeCircle(cx + 60, cy - 14, 24);
        g.fillStyle(0x1e1206); g.fillRoundedRect(cx - 50, cy + 18, 100, 36, 6);
        g.lineStyle(2, 0xc8960c, 0.7); g.strokeRoundedRect(cx - 50, cy + 18, 100, 36, 6);
        [0xffd700, 0x4a8c3f, 0x808080, 0xdd8800].forEach((c, i) => { g.fillStyle(c); g.fillCircle(cx - 34 + i * 22, cy + 36, 6); });
        break;
      }
    }
  }

  _closeTutorial() {
    for (const o of this._tutOverlay) o.destroy();
    for (const o of this._tutContent) o.destroy();
    this._tutOverlay = [];
    this._tutContent = [];
  }

  // ─── Input helpers ────────────────────────────────────────────────────────────

  _createInput(x, y, w, placeholder, maxLen = 24) {
    const bg = this.add.rectangle(x + w / 2, y + 16, w, 32, 0x0c0807)
      .setStrokeStyle(1, 0x4a3010).setInteractive({ useHandCursor: true });
    const txt = this.add.text(x + 8, y + 7, placeholder, {
      fontFamily: 'monospace', fontSize: '14px', color: '#4a4430',
    });
    const state = { value: '', active: false, placeholder, maxLen };
    const inp = { bg, txt, state };
    bg.on('pointerdown', () => this._focusInput(inp));
    this.allInputs.push(inp);
    return inp;
  }

  _focusInput(inp) {
    this._blurAll();
    this.activeInput = inp;
    inp.state.active = true;
    inp.bg.setStrokeStyle(2, 0xffd700);
    this._renderInput(inp);
    // Open mobile keyboard (also works on desktop)
    const el = this._getNativeInput();
    el.maxLength = inp.state.maxLen || 30;
    el.value = inp.state.value || '';
    el.oninput = () => {
      if (!this.activeInput) return;
      this.activeInput.state.value = el.value;
      this._renderInput(this.activeInput);
    };
    el.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); this._blurAll(); }
      else if (e.key === 'Tab') {
        e.preventDefault();
        const idx = this.allInputs.indexOf(this.activeInput);
        if (idx >= 0) this._focusInput(this.allInputs[(idx + 1) % this.allInputs.length]);
      }
    };
    el.onblur = () => {
      // Delay so button pointerdown still fires before blur clears activeInput
      setTimeout(() => { if (this.activeInput === inp) this._blurAll(); }, 200);
    };
    el.focus();
  }

  _blurAll() {
    for (const i of this.allInputs) {
      i.state.active = false;
      if (i.bg?.active) i.bg.setStrokeStyle(1, 0x4a3010);
      this._renderInput(i);
    }
    this.activeInput = null;
    if (this._nativeEl) {
      this._nativeEl.oninput = null;
      this._nativeEl.onkeydown = null;
      this._nativeEl.onblur = null;
      this._nativeEl.blur();
    }
  }

  _getNativeInput() {
    if (!this._nativeEl) {
      const el = document.createElement('input');
      el.type = 'text';
      el.setAttribute('autocomplete', 'off');
      el.setAttribute('autocorrect', 'off');
      el.setAttribute('autocapitalize', 'off');
      el.setAttribute('spellcheck', 'false');
      // Must be in the viewport and font-size ≥ 16px to prevent iOS zoom
      Object.assign(el.style, {
        position: 'fixed', left: '50%', top: '40%',
        width: '240px', height: '40px',
        transform: 'translateX(-50%)',
        opacity: '0.01',         // nearly invisible
        border: 'none', outline: 'none',
        background: 'transparent', color: 'transparent',
        fontSize: '16px',        // prevents iOS auto-zoom
        zIndex: '9999',
        pointerEvents: 'none',   // clicks fall through to Phaser
      });
      document.body.appendChild(el);
      this._nativeEl = el;
      // Clean up on scene shutdown
      this.events.once('shutdown', () => {
        el.remove(); this._nativeEl = null;
      });
    }
    this._nativeEl.style.pointerEvents = 'auto'; // allow focus
    return this._nativeEl;
  }

  _renderInput(inp) {
    if (!inp.txt?.active) return;
    const s = inp.state;
    if (s.value)       inp.txt.setText(s.value).setColor('#ffffff');
    else if (s.active) inp.txt.setText('|').setColor('#c8960c');
    else               inp.txt.setText(s.placeholder).setColor('#4a4430');
  }

  // ─── UI helpers ───────────────────────────────────────────────────────────────

  _drawPanel(x, y, w, h, title) {
    this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x100a04, 0.93).setStrokeStyle(2, 0x3a2a0a);
    this.add.rectangle(x + w / 2, y + 14, w, 28, 0x1e1206, 1);
    this.add.text(x + 12, y + 5, title, { fontFamily: 'Georgia, serif', fontSize: '11px', color: '#c8960c' });
    const sl = this.add.graphics();
    sl.lineStyle(1, 0x4a3010, 0.7); sl.moveTo(x, y + 28); sl.lineTo(x + w, y + 28); sl.strokePath();
  }

  _makeButton(x, y, w, h, label, color, onClick) {
    const bg = this.add.rectangle(x, y, w, h, color, 0.88)
      .setInteractive({ useHandCursor: true }).setStrokeStyle(1, 0xffffff, 0.15);
    const fs = Math.max(11, Math.min(15, Math.floor(w / 12)));
    const txt = this.add.text(x, y, label, {
      fontFamily: 'Georgia, serif', fontSize: `${fs}px`, color: '#ffffff',
    }).setOrigin(0.5);
    bg.on('pointerover', () => { bg.setAlpha(1); bg.setStrokeStyle(2, 0xffd700, 0.8); });
    bg.on('pointerout',  () => { bg.setAlpha(0.88); bg.setStrokeStyle(1, 0xffffff, 0.15); });
    bg.on('pointerdown', onClick);
    return { bg, txt };
  }

  _showStatus(msg, color = '#ccaa44') {
    if (!this.statusMsgTxt) return;
    this.statusMsgTxt.setText(msg).setColor(color).setVisible(true);
    this.time.delayedCall(4000, () => this.statusMsgTxt?.setVisible(false));
  }
}