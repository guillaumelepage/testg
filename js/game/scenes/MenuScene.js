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
    this.activeInput  = null;   // currently focused input
    this.allInputs    = [];     // all registered inputs
    this.selectedClan = CLANS[0];
    this.selectedHero = 'roi_guerrier';
    this.clanBtns     = [];
    this.availableRooms = [];
    this.roomListObjects = [];  // rendered room rows

    socketManager.connect('');

    const { width: W, height: H } = this.cameras.main;

    this._drawBackground(W, H);
    this._buildTitle(W, H);
    this._buildLeftPanel(W, H);
    this._buildRightPanel(W, H);
    this._buildTutorialBtn(W, H);

    // ── Single global keyboard handler ──────────────────────────────────────
    this.input.keyboard?.on('keydown', (e) => {
      if (!this.activeInput) return;
      const s = this.activeInput.state;

      if (e.key === 'Backspace') {
        s.value = s.value.slice(0, -1);
      } else if (e.key === 'Enter' || e.key === 'Escape') {
        this._blurAll();
        return;
      } else if (e.key === 'Tab') {
        const idx = this.allInputs.indexOf(this.activeInput);
        this._focusInput(this.allInputs[(idx + 1) % this.allInputs.length]);
        return;
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
      })
      .on('disconnected', () => {
        this.connTxt?.setText('● Déconnecté').setColor('#cc3333');
      })
      .on('game_start', (snapshot) => {
        this.scene.start('World', { snapshot });
      });

    // Refresh room list every 5 s
    this.time.addEvent({ delay: 5000, loop: true, callback: this._refreshRooms, callbackScope: this });
  }

  // ─── Background ──────────────────────────────────────────────────────────────

  _drawBackground(W, H) {
    this.add.rectangle(W / 2, H / 2, W, H, 0x09070c);

    // Stone grid
    const g = this.add.graphics();
    g.lineStyle(1, 0x171215, 1);
    for (let x = 0; x <= W; x += 48) { g.moveTo(x, 0); g.lineTo(x, H); }
    for (let y = 0; y <= H; y += 48) { g.moveTo(0, y); g.lineTo(W, y); }
    g.strokePath();

    // Random worn tiles
    g.fillStyle(0x0f0c13, 0.55);
    for (let i = 0; i < 28; i++) {
      g.fillRect(Math.floor(Math.random() * (W / 48)) * 48 + 2,
                 Math.floor(Math.random() * (H / 48)) * 48 + 2, 44, 44);
    }

    // Outer frame
    const f = this.add.graphics();
    f.lineStyle(4, 0x3a2a0a); f.strokeRect(8, 8, W - 16, H - 16);
    f.lineStyle(1, 0xc8960c, 0.35); f.strokeRect(14, 14, W - 28, H - 28);
    // Corner gems
    f.fillStyle(0xc8960c, 0.55);
    [[20, 20], [W - 20, 20], [20, H - 20], [W - 20, H - 20]]
      .forEach(([cx, cy]) => f.fillCircle(cx, cy, 5));
  }

  // ─── Title bar ───────────────────────────────────────────────────────────────

  _buildTitle(W, H) {
    const titleH = Math.max(44, Math.floor(H * 0.115));
    const g = this.add.graphics();
    g.fillStyle(0x120900, 0.92); g.fillRect(0, 8, W, titleH);
    g.lineStyle(2, 0xc8960c, 0.45); g.moveTo(0, 8 + titleH); g.lineTo(W, 8 + titleH); g.strokePath();
    g.fillStyle(0xc8960c, 0.35); g.fillRect(0, 8, W, 2);

    const fs = Math.max(14, Math.floor(W / 52));
    this.add.text(W / 2, 8 + titleH / 2, '⚔  CONQUÊTE MÉDIÉVALE  ⚔', {
      fontFamily: 'Georgia, serif', fontSize: `${fs}px`, color: '#c8960c',
      shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 6, fill: true },
    }).setOrigin(0.5);

    this.connTxt = this.add.text(W - 12, 8 + titleH / 2, '● Connexion...', {
      fontFamily: 'monospace', fontSize: '11px', color: '#888855',
    }).setOrigin(1, 0.5);

    // Store titleH for panels
    this._titleH = 8 + titleH + 6;
  }

  // ─── Left panel — Profile ─────────────────────────────────────────────────────

  _buildLeftPanel(W, H) {
    const py = this._titleH;
    const ph = H - py - 36;
    const pw = Math.max(180, Math.floor(W * 0.29));
    const px = 12;
    this._leftPW = pw; // share with right panel
    this._drawPanel(px, py, pw, ph, 'VOTRE PROFIL');

    // Name
    this.add.text(px + 10, py + 38, 'Nom du seigneur', {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#c8a060',
    });
    this.nameInput = this._createInput(px + 10, py + 54, pw - 20, 'Votre nom...', 22);

    // Clan label
    this.add.text(px + 10, py + 92, 'Clan', {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#c8a060',
    });
    const sl = this.add.graphics();
    sl.lineStyle(1, 0xc8960c, 0.25);
    sl.moveTo(px + 10, py + 106); sl.lineTo(px + pw - 10, py + 106); sl.strokePath();

    // Clan grid — 2 cols, rows auto-sized to fit available height
    const gapX = 5, gapY = 4;
    const cols = 2;
    const bw = Math.floor((pw - 20 - gapX) / cols);
    const availH = ph - 116;
    const rows   = Math.ceil(CLANS.length / cols);
    const bh     = Math.max(38, Math.floor((availH - gapY * (rows - 1)) / rows));

    CLANS.forEach((clan, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const bx = px + 10 + col * (bw + gapX);
      const by = py + 110 + row * (bh + gapY);

      const selected = i === 0;
      const bg = this.add.rectangle(bx + bw / 2, by + bh / 2, bw, bh, clan.color, 0.88)
        .setInteractive({ useHandCursor: true })
        .setStrokeStyle(selected ? 2 : 1, selected ? 0xffd700 : 0x555535);

      const iconFs = Math.max(10, Math.floor(bh * 0.28));
      const lblFs  = Math.max(8,  Math.floor(bh * 0.23));
      const bonFs  = Math.max(7,  Math.floor(bh * 0.17));
      this.add.text(bx + 5, by + 5, clan.icon, { fontSize: `${iconFs}px` });
      this.add.text(bx + 5 + iconFs + 2, by + 4, clan.label, {
        fontFamily: 'serif', fontSize: `${lblFs}px`, color: '#d4c090',
        wordWrap: { width: bw - iconFs - 12 },
      });
      if (bh > 48) {
        this.add.text(bx + 5, by + bh - bonFs - 6, clan.bonus, {
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

  _selectClan(clan, clickedBg) {
    this.selectedClan = clan;
    for (const btn of this.clanBtns) {
      btn.bg.setStrokeStyle(btn.key === clan.key ? 2 : 1,
                             btn.key === clan.key ? 0xffd700 : 0x555535);
    }
  }

  // ─── Right panel — Create / Join ──────────────────────────────────────────────

  _buildRightPanel(W, H) {
    const px  = this._leftPW + 24;
    const py  = this._titleH;
    const pw  = W - px - 12;
    const ph  = H - py - 36;
    const topH = Math.max(160, Math.floor(H * 0.36));
    const gap  = 10;
    const botH = ph - topH - gap;

    // ── CREATE ──────────────────────────────────────────────────────────────
    this._drawPanel(px, py, pw, topH, 'CRÉER UNE PARTIE');

    this.add.text(px + 14, py + 42, [
      'Lancez une nouvelle partie coopérative. Partagez le code',
      'affiché avec votre allié pour qu\'il vous rejoigne.',
    ].join(' '), {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#777755',
      wordWrap: { width: pw - 28 },
    });

    // State A: create button
    this.createBtn = this._makeButton(px + pw / 2, py + 138, pw - 60, 44,
      '⚔  Créer la salle  ⚔', 0x3a5080, () => {
        const name = this.nameInput.state.value.trim() || 'Joueur 1';
        this._showHeroPicker(async (heroType) => {
          try {
            const res = await socketManager.createRoom(name, this.selectedClan.key, heroType);
            this._showWaitingState(res.code, px, py, pw, topH);
          } catch (e) { this._showStatus(e.message, '#ff5533'); }
        });
      });

    // State B: waiting (hidden initially)
    this.waitingGroup = [];
    const codeLbl = this.add.text(px + pw / 2, py + 105, '', {
      fontFamily: 'monospace', fontSize: '48px', color: '#ffd700',
      shadow: { offsetX: 0, offsetY: 0, color: '#c8960c', blur: 12, fill: true },
    }).setOrigin(0.5).setVisible(false);
    const waitLbl = this.add.text(px + pw / 2, py + 156, '', {
      fontFamily: 'sans-serif', fontSize: '13px', color: '#aaaaaa',
    }).setOrigin(0.5).setVisible(false);
    this.waitingGroup = [codeLbl, waitLbl];
    this._createdCodeTxt = codeLbl;
    this._waitingTxt     = waitLbl;

    // ── JOIN ────────────────────────────────────────────────────────────────
    const jy = py + topH + gap;
    this._drawPanel(px, jy, pw, botH, 'REJOINDRE UNE PARTIE');

    this.add.text(px + 14, jy + 42, 'Salles disponibles  (actualisation auto)', {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#c8a060',
    });

    // Room list zone
    const listY = jy + 60;
    const listH = botH - 124;
    const listX = px + 14;
    const listW = pw - 28;

    const listBg = this.add.graphics();
    listBg.fillStyle(0x07060a, 0.65); listBg.fillRect(listX, listY, listW, listH);
    listBg.lineStyle(1, 0x3a2a0a, 0.9); listBg.strokeRect(listX, listY, listW, listH);

    this.noRoomsTxt = this.add.text(px + pw / 2, listY + listH / 2,
      'Aucune salle disponible\nCréez une partie ou attendez qu\'un ami crée la sienne.', {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#444433', align: 'center',
      }).setOrigin(0.5);

    // Store params for room list rendering
    this._list = { x: listX, y: listY, w: listW, h: listH };

    // Manual code input
    const codeRow = jy + botH - 50;
    this.add.text(px + 14, codeRow, 'Code manuel :', {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#888866',
    });
    this.codeInput = this._createInput(px + 14, codeRow + 16, 170, 'XXXXXX', 6);
    this._makeButton(px + pw - 14 - 170, codeRow + 16, 170, 32, 'Rejoindre →', 0x3a6040, () => {
      const name = this.nameInput.state.value.trim() || 'Joueur 2';
      const code = this.codeInput.state.value.toUpperCase().trim();
      if (code.length < 3) { this._showStatus('Code trop court (6 lettres requis)', '#ff5533'); return; }
      this._showHeroPicker((heroType) => this._doJoin(code, name, heroType));
    });

    // Status message (shared)
    this.statusMsgTxt = this.add.text(W / 2, H - 26, '', {
      fontFamily: 'sans-serif', fontSize: '13px', color: '#ccaa44',
      backgroundColor: '#180f04cc', padding: { x: 10, y: 4 },
    }).setOrigin(0.5).setVisible(false);
  }

  // ─── Tutorial button ──────────────────────────────────────────────────────────

  _buildTutorialBtn(W, H) {
    const tutBg = this.add.rectangle(W / 2, H - 22, 240, 28, 0x1a0f04, 0.92)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(1, 0x4a3010, 0.8);
    this.add.text(W / 2, H - 22, '?  Tutoriel — Comment jouer', {
      fontFamily: 'Georgia, serif', fontSize: '13px', color: '#c8a060',
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
    this.noRoomsTxt.setVisible(rooms.length === 0);
    if (rooms.length === 0) return;

    const { x, y, w, h } = this._list;
    const rowH = 46;
    const maxRows = Math.floor(h / rowH);
    const visible = rooms.slice(0, maxRows);

    visible.forEach((room, i) => {
      const ry = y + i * rowH + 4;
      const rw = w - 8;

      const rowBg = this.add.rectangle(x + 4 + rw / 2, ry + rowH / 2 - 2, rw, rowH - 6, 0x14100a, 0.92)
        .setInteractive({ useHandCursor: true })
        .setStrokeStyle(1, 0x3a2a0a);
      rowBg.on('pointerover', () => rowBg.setStrokeStyle(2, 0xc8960c, 0.9));
      rowBg.on('pointerout',  () => rowBg.setStrokeStyle(1, 0x3a2a0a));
      rowBg.on('pointerdown', () => {
        const name = this.nameInput.state.value.trim() || 'Joueur 2';
        this._showHeroPicker((heroType) => this._doJoin(room.code, name, heroType));
      });

      const codeTxt  = this.add.text(x + 10, ry + 5,  room.code,           { fontFamily: 'monospace',     fontSize: '16px', color: '#ffd700' });
      const nameTxt  = this.add.text(x + 10, ry + 26, room.hostName || '—', { fontFamily: 'Georgia, serif', fontSize: '13px', color: '#d4c090' });
      const clanTxt  = this.add.text(x + w - 14, ry + 6,  room.hostClan || '', { fontFamily: 'monospace', fontSize: '10px', color: '#888866' }).setOrigin(1, 0);
      const joinHint = this.add.text(x + w - 14, ry + 26, '→ Rejoindre',       { fontFamily: 'serif',     fontSize: '11px', color: '#88cc88' }).setOrigin(1, 0);

      this.roomListObjects.push(rowBg, codeTxt, nameTxt, clanTxt, joinHint);
    });
  }

  async _doJoin(code, name, heroType) {
    try {
      await socketManager.joinRoom(code, name, this.selectedClan.key, heroType || this.selectedHero);
    } catch (e) { this._showStatus(e.message, '#ff5533'); }
  }

  // ─── Hero picker ──────────────────────────────────────────────────────────────

  _showHeroPicker(onConfirm) {
    const { width: W, height: H } = this.cameras.main;
    const heroes = Object.entries(HERO_DEFS);
    const cardW  = Math.max(140, Math.floor((Math.min(W, 720) - 100) / heroes.length));
    const cardH  = Math.max(220, Math.floor(cardW * 1.3));
    const gap    = Math.max(8, Math.floor(W * 0.015));
    const totalW = heroes.length * cardW + (heroes.length - 1) * gap;
    const panelW = Math.min(W - 32, totalW + 60);
    const panelH = Math.min(H - 60, cardH + 100);
    const cx = W / 2, cy = H / 2;

    const overlay = [];

    const dimmer = this.add.rectangle(cx, cy, W, H, 0x000000, 0.82).setDepth(60).setInteractive();
    const panel  = this.add.rectangle(cx, cy, panelW, panelH, 0x10080e).setDepth(61)
      .setStrokeStyle(3, 0xc8960c, 0.75);
    overlay.push(dimmer, panel);

    const title = this.add.text(cx, cy - panelH / 2 + 22, 'CHOISISSEZ VOTRE HÉROS', {
      fontFamily: 'Georgia, serif', fontSize: '18px', color: '#c8960c',
    }).setOrigin(0.5).setDepth(62);
    overlay.push(title);

    let pickedKey = this.selectedHero;
    const cardBgs = {};

    const startX = cx - totalW / 2;
    heroes.forEach(([key, def], i) => {
      const bx = startX + i * (cardW + gap) + cardW / 2;
      const by = cy + 20;

      const isSelected = key === pickedKey;
      const cardBg = this.add.rectangle(bx, by, cardW, cardH, isSelected ? 0x2a1a06 : 0x14100a, 0.95)
        .setStrokeStyle(isSelected ? 2 : 1, isSelected ? 0xffd700 : 0x4a3010)
        .setInteractive({ useHandCursor: true }).setDepth(62);
      cardBgs[key] = cardBg;

      // Hero icon
      const icon = this.add.text(bx, by - cardH / 2 + 36, def.icon, { fontSize: '36px' })
        .setOrigin(0.5).setDepth(63);
      const name = this.add.text(bx, by - cardH / 2 + 76, def.label, {
        fontFamily: 'Georgia, serif', fontSize: '14px', color: '#c8960c',
      }).setOrigin(0.5).setDepth(63);
      const desc = this.add.text(bx, by - cardH / 2 + 100, def.desc, {
        fontFamily: 'sans-serif', fontSize: '10px', color: '#aaaaaa',
        wordWrap: { width: cardW - 20 }, align: 'center',
      }).setOrigin(0.5, 0).setDepth(63);

      const stats = [
        `❤ ${def.maxHp}  ⚔ ${def.atk}  🛡 ${def.def}`,
        `💨 ${def.spd}   👁 ${def.visionRadius}   ${def.moveType}`,
      ].join('\n');
      const statTxt = this.add.text(bx, by + 50, stats, {
        fontFamily: 'monospace', fontSize: '9px', color: '#b0a080', align: 'center',
      }).setOrigin(0.5).setDepth(63);

      const moveTxt = this.add.text(bx, by + 90, def.moves.map(m => `• ${m.name}`).join('\n'), {
        fontFamily: 'sans-serif', fontSize: '9px', color: '#888866', align: 'center',
      }).setOrigin(0.5, 0).setDepth(63);

      cardBg.on('pointerover', () => { if (key !== pickedKey) cardBg.setStrokeStyle(1, 0xc8960c); });
      cardBg.on('pointerout',  () => { if (key !== pickedKey) cardBg.setStrokeStyle(1, 0x4a3010); });
      cardBg.on('pointerdown', () => {
        pickedKey = key;
        this.selectedHero = key;
        for (const [k, bg] of Object.entries(cardBgs)) {
          bg.setFillStyle(k === key ? 0x2a1a06 : 0x14100a);
          bg.setStrokeStyle(k === key ? 2 : 1, k === key ? 0xffd700 : 0x4a3010);
        }
      });

      overlay.push(cardBg, icon, name, desc, statTxt, moveTxt);
    });

    // Confirm button
    const confirmBg = this.add.rectangle(cx, cy + panelH / 2 - 32, 200, 40, 0x1a3a20, 0.95)
      .setInteractive({ useHandCursor: true }).setStrokeStyle(2, 0x44aa66).setDepth(62);
    const confirmTxt = this.add.text(cx, cy + panelH / 2 - 32, '✓  Confirmer', {
      fontFamily: 'Georgia, serif', fontSize: '15px', color: '#88cc88',
    }).setOrigin(0.5).setDepth(63);
    confirmBg.on('pointerover', () => confirmBg.setStrokeStyle(2, 0xffd700));
    confirmBg.on('pointerout',  () => confirmBg.setStrokeStyle(2, 0x44aa66));
    confirmBg.on('pointerdown', () => {
      overlay.forEach(o => o.destroy());
      onConfirm(pickedKey);
    });
    overlay.push(confirmBg, confirmTxt);
  }

  // ─── Waiting state (after creating a room) ────────────────────────────────────

  _showWaitingState(code, px, py, pw, topH) {
    this.createBtn.bg.setVisible(false).disableInteractive();
    this.createBtn.txt.setVisible(false);

    this._createdCodeTxt.setText(code).setVisible(true);
    this._waitingTxt.setText('En attente de votre allié...').setVisible(true);

    // Pulse animation on the code
    this.tweens.add({
      targets: this._createdCodeTxt,
      alpha: { from: 1, to: 0.6 }, duration: 900, yoyo: true, repeat: -1,
    });

    let d = 0;
    const dots = ['●  ○  ○', '○  ●  ○', '○  ○  ●'];
    this.time.addEvent({ delay: 400, loop: true, callback: () => {
      this._waitingTxt.setText(`En attente de votre allié…  ${dots[d++ % 3]}`);
    }});
  }

  // ─── Tutorial ─────────────────────────────────────────────────────────────────

  _showTutorial() {
    const { width: W, height: H } = this.cameras.main;
    this._tutOverlay = [];
    this._tutContent = [];
    this._tutPage    = 0;

    const tW = Math.min(W - 32, 740);
    const tH = Math.min(H - 40, 500);
    const dimmer = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.78).setDepth(50).setInteractive();
    const panel  = this.add.rectangle(W / 2, H / 2, tW, tH, 0x10080e).setDepth(51)
      .setStrokeStyle(3, 0xc8960c, 0.75);
    this._tutW = tW; this._tutH = tH;

    this._tutOverlay = [dimmer, panel];
    dimmer.on('pointerdown', () => this._closeTutorial());

    this._renderTutPage(0);
  }

  _renderTutPage(pageIdx) {
    for (const o of this._tutContent) o.destroy();
    this._tutContent = [];

    const { width: W, height: H } = this.cameras.main;
    const cx = W / 2, cy = H / 2;
    const page = TUTORIAL[pageIdx];
    const tW   = this._tutW || Math.min(W - 32, 740);
    const tH   = this._tutH || Math.min(H - 40, 500);
    const hW   = tW / 2;
    const hH   = tH / 2;
    const bodyW = Math.floor(tW * 0.52);  // ~left 52% for text
    const illCx = cx + Math.floor(tW * 0.22); // illustration centre

    // Header
    const hdr = this.add.rectangle(cx, cy - hH + 21, tW, 42, 0x1e1206, 1).setDepth(52);
    const ttl = this.add.text(cx, cy - hH + 21, page.title, {
      fontFamily: 'Georgia, serif', fontSize: `${Math.max(14, Math.floor(tW / 39))}px`, color: '#c8960c',
    }).setOrigin(0.5).setDepth(53);
    const pgn = this.add.text(cx + hW - 10, cy - hH + 21, `${pageIdx + 1} / ${TUTORIAL.length}`, {
      fontFamily: 'monospace', fontSize: '12px', color: '#886630',
    }).setOrigin(1, 0.5).setDepth(53);

    // Body text (left column)
    const body = this.add.text(cx - hW + 16, cy - hH + 50, page.lines.join('\n'), {
      fontFamily: 'sans-serif', fontSize: `${Math.max(11, Math.floor(tW / 55))}px`, color: '#cfc090',
      lineSpacing: 5, wordWrap: { width: bodyW },
    }).setDepth(52);

    // Illustration (right column) — only if enough width
    const illGfx = this.add.graphics().setDepth(52);
    if (tW > 480) this._drawIllustration(illGfx, pageIdx, illCx, cy - 10);

    // Close ✕
    const closeX = this.add.text(cx + hW - 10, cy - hH + 4, '✕', {
      fontFamily: 'sans-serif', fontSize: '20px', color: '#886630',
    }).setInteractive({ useHandCursor: true }).setDepth(53).setOrigin(1, 0);
    closeX.on('pointerover', () => closeX.setColor('#ffd700'));
    closeX.on('pointerout',  () => closeX.setColor('#886630'));
    closeX.on('pointerdown', () => this._closeTutorial());

    // Page indicators (dots)
    const dotY = cy + hH - 28;
    for (let i = 0; i < TUTORIAL.length; i++) {
      const dot = this.add.circle(cx - 40 + i * 20, dotY, i === pageIdx ? 6 : 4,
        i === pageIdx ? 0xffd700 : 0x555533).setDepth(53);
      this._tutContent.push(dot);
    }

    // Prev / Next buttons
    const hasPrev = pageIdx > 0;
    const hasNext = pageIdx < TUTORIAL.length - 1;
    const btnY = cy + hH - 28;

    const prevBg = this.add.rectangle(cx - 130, btnY, 120, 36,
      hasPrev ? 0x2a1a06 : 0x111111, 0.92)
      .setInteractive({ useHandCursor: hasPrev }).setStrokeStyle(1, hasPrev ? 0x886630 : 0x222222).setDepth(53);
    const prevTxt = this.add.text(cx - 130, btnY, '← Précédent', {
      fontFamily: 'sans-serif', fontSize: '13px', color: hasPrev ? '#c8a060' : '#333322',
    }).setOrigin(0.5).setDepth(54);

    const nextBg = this.add.rectangle(cx + 130, btnY, 120, 36,
      0x1a3020, 0.92)
      .setInteractive({ useHandCursor: true }).setStrokeStyle(1, 0x3a6040).setDepth(53);
    const nextTxt = this.add.text(cx + 130, btnY, hasNext ? 'Suivant →' : 'Fermer  ✓', {
      fontFamily: 'sans-serif', fontSize: '13px', color: '#88cc88',
    }).setOrigin(0.5).setDepth(54);

    if (hasPrev) prevBg.on('pointerdown', () => this._renderTutPage(pageIdx - 1));
    nextBg.on('pointerdown', () => hasNext ? this._renderTutPage(pageIdx + 1) : this._closeTutorial());

    [prevBg, nextBg].forEach((b, j) => {
      const col = j === 0 ? (hasPrev ? 0x2a1a06 : 0x111111) : 0x1a3020;
      b.on('pointerover', () => b.setStrokeStyle(2, 0xffd700));
      b.on('pointerout',  () => b.setStrokeStyle(1, j === 0 ? (hasPrev ? 0x886630 : 0x222222) : 0x3a6040));
    });

    this._tutContent.push(hdr, ttl, pgn, body, illGfx, closeX, prevBg, prevTxt, nextBg, nextTxt);
  }

  _drawIllustration(g, pageIdx, cx, cy) {
    const iW = 240, iH = 190;
    g.lineStyle(1, 0x3a2a0a, 0.5);
    g.strokeRect(cx - iW / 2, cy - iH / 2, iW, iH);

    switch (pageIdx) {
      case 0: { // Map overview
        g.fillStyle(0x3a6a30); g.fillRect(cx - iW / 2, cy - iH / 2, iW, iH);
        g.fillStyle(0x2a5aaa); g.fillEllipse(cx - 20, cy + 10, 70, 40);
        g.fillStyle(0x265a20); g.fillCircle(cx - 60, cy - 30, 24);
        g.fillStyle(0x6a6060); g.fillTriangle(cx + 60, cy - 50, cx + 40, cy - 20, cx + 80, cy - 20);
        g.fillStyle(0x8b5e3c); g.fillRect(cx + 20, cy + 10, 40, 26); // building
        g.fillStyle(0x6b3a1f); g.fillTriangle(cx + 40, cy + 2, cx + 18, cy + 12, cx + 62, cy + 12);
        g.fillStyle(0x3a6bbf); g.fillCircle(cx + 64, cy - 28, 9);  // player unit
        g.fillStyle(0xcc3322); g.fillCircle(cx - 70, cy + 50, 9);  // enemy unit
        break;
      }
      case 1: { // Camera controls
        g.lineStyle(3, 0x4a3010); g.strokeRect(cx - iW / 2, cy - iH / 2, iW, iH);
        // Viewport inner
        g.lineStyle(2, 0xffd700, 0.7); g.strokeRect(cx - 60, cy - 40, 120, 80);
        // Arrows
        const arr = (ax, ay, dir) => {
          const [dx, dy] = { U: [0,-1], D: [0,1], L: [-1,0], R: [1,0] }[dir];
          g.fillStyle(0xffd700, 0.75);
          g.fillTriangle(ax + dx * 18, ay + dy * 18, ax - dy * 8, ay + dx * 8, ax + dy * 8, ay - dx * 8);
        };
        arr(cx, cy - 60, 'U'); arr(cx, cy + 60, 'D');
        arr(cx - 80, cy, 'L'); arr(cx + 80, cy, 'R');
        // WASD hint
        g.fillStyle(0x2a2a2a, 0.9); [[0,-1],[0,1],[-1,0],[1,0]].forEach(([dx,dy]) => {
          g.fillRoundedRect(cx + dx * 22 - 10, cy + dy * 22 - 10, 20, 20, 3);
        });
        break;
      }
      case 2: { // Resources & building
        const drawUnit = (x, y, c) => { g.fillStyle(c); g.fillCircle(x, y, 14); };
        const drawRes  = (x, y) => { g.fillStyle(0x2a5a1a); g.fillCircle(x, y - 6, 16); g.fillStyle(0x5a3a1a); g.fillRect(x - 4, y + 6, 8, 12); };
        const drawTH   = (x, y) => { g.fillStyle(0x8b5e3c); g.fillRect(x - 20, y - 14, 40, 28); g.fillStyle(0x6b3a1f); g.fillTriangle(x, y - 22, x - 22, y - 12, x + 22, y - 12); };
        const arrow = (x1, y1, x2, y2) => {
          g.lineStyle(2, 0xffd700, 0.7); g.moveTo(x1, y1); g.lineTo(x2 - 8, y2); g.strokePath();
          const a = Math.atan2(y2 - y1, x2 - x1);
          g.fillStyle(0xffd700);
          g.fillTriangle(x2, y2, x2 - 10 * Math.cos(a - 0.4), y2 - 10 * Math.sin(a - 0.4),
                         x2 - 10 * Math.cos(a + 0.4), y2 - 10 * Math.sin(a + 0.4));
        };
        drawUnit(cx - 90, cy, 0xa0784a);
        drawRes(cx - 20, cy);
        drawTH(cx + 75, cy);
        arrow(cx - 74, cy, cx - 38, cy);
        arrow(cx + 4, cy, cx + 54, cy);
        // Selection highlight
        g.lineStyle(2, 0xffd700, 0.6); g.strokeCircle(cx - 90, cy, 16);
        break;
      }
      case 3: { // Battle
        // Sky / ground
        g.fillStyle(0x1a2a50); g.fillRect(cx - iW / 2, cy - iH / 2, iW, iH * 0.5);
        g.fillStyle(0x2a3a10); g.fillRect(cx - iW / 2, cy - iH / 2 + iH * 0.5, iW, iH * 0.5);
        // Enemy (top right)
        g.fillStyle(0xcc2222); g.fillCircle(cx + 60, cy - 30, 22);
        g.lineStyle(2, 0xff8888); g.strokeCircle(cx + 60, cy - 30, 22);
        // Player (bottom left)
        g.fillStyle(0x3a6bbf); g.fillCircle(cx - 60, cy + 30, 22);
        g.lineStyle(2, 0x88bbff); g.strokeCircle(cx - 60, cy + 30, 22);
        // HP bars
        g.fillStyle(0x330000); g.fillRect(cx + 20, cy - 65, 85, 10);
        g.fillStyle(0xcc3322); g.fillRect(cx + 20, cy - 65, 55, 10);
        g.fillStyle(0x330000); g.fillRect(cx - iW / 2 + 8, cy + 56, 85, 10);
        g.fillStyle(0x22cc22); g.fillRect(cx - iW / 2 + 8, cy + 56, 75, 10);
        // Move buttons (mini 2x2)
        const mc = [[0xc8300a],[0x0a4080],[0x6a0a90],[0x0a7040]];
        for (let mi = 0; mi < 4; mi++) {
          const mx = cx - iW / 2 + 8 + (mi % 2) * 60;
          const my = cy + 72 + Math.floor(mi / 2) * 26;
          g.fillStyle(mc[mi][0], 0.85); g.fillRect(mx, my, 56, 22);
        }
        break;
      }
      case 4: { // Coop
        // Two player icons
        const p1c = 0x3a6bbf, p2c = 0x8b0000;
        g.fillStyle(p1c); g.fillCircle(cx - 65, cy - 15, 24);
        g.lineStyle(3, 0x88bbff, 0.6); g.strokeCircle(cx - 65, cy - 15, 26);
        g.fillStyle(p2c); g.fillCircle(cx + 65, cy - 15, 24);
        g.lineStyle(3, 0xff8888, 0.6); g.strokeCircle(cx + 65, cy - 15, 26);
        // Shared resource pool
        g.fillStyle(0x1e1206); g.fillRoundedRect(cx - 52, cy + 20, 104, 38, 6);
        g.lineStyle(2, 0xc8960c, 0.7); g.strokeRoundedRect(cx - 52, cy + 20, 104, 38, 6);
        const rColors = [0xffd700, 0x4a8c3f, 0x808080, 0xdd8800];
        rColors.forEach((c, i) => { g.fillStyle(c); g.fillCircle(cx - 36 + i * 24, cy + 39, 7); });
        // Connection lines
        g.lineStyle(2, 0xffd700, 0.45);
        g.moveTo(cx - 42, cy + 9).lineTo(cx - 42, cy + 20); g.strokePath();
        g.moveTo(cx + 42, cy + 9).lineTo(cx + 42, cy + 20); g.strokePath();
        // Player labels
        g.fillStyle(p1c, 0.2); g.fillRect(cx - 90, cy + 62, 50, 18);
        g.fillStyle(p2c, 0.2); g.fillRect(cx + 40, cy + 62, 50, 18);
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
      .setStrokeStyle(1, 0x4a3010)
      .setInteractive({ useHandCursor: true });
    const txt = this.add.text(x + 8, y + 7, placeholder, {
      fontFamily: 'monospace', fontSize: '14px', color: '#4a4430',
    });
    const state = { value: '', active: false, placeholder, maxLen };
    const inp = { bg, txt, state };
    bg.on('pointerdown', () => this._focusInput(inp));
    this.allInputs.push(inp);
    return inp;
  }

  /** Blur all inputs, then focus the given one. */
  _focusInput(inp) {
    this._blurAll();
    this.activeInput = inp;
    inp.state.active = true;
    inp.bg.setStrokeStyle(2, 0xffd700);
    this._renderInput(inp);
  }

  _blurAll() {
    for (const i of this.allInputs) {
      i.state.active = false;
      i.bg.setStrokeStyle(1, 0x4a3010);
      this._renderInput(i);
    }
    this.activeInput = null;
  }

  _renderInput(inp) {
    const s = inp.state;
    if (s.value)       inp.txt.setText(s.value).setColor('#ffffff');
    else if (s.active) inp.txt.setText('|').setColor('#c8960c');
    else               inp.txt.setText(s.placeholder).setColor('#4a4430');
  }

  // ─── UI helpers ───────────────────────────────────────────────────────────────

  _drawPanel(x, y, w, h, title) {
    this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x100a04, 0.93).setStrokeStyle(2, 0x3a2a0a);
    this.add.rectangle(x + w / 2, y + 16, w, 30, 0x1e1206, 1);
    this.add.text(x + 14, y + 6, title, { fontFamily: 'Georgia, serif', fontSize: '12px', color: '#c8960c' });
    const sl = this.add.graphics();
    sl.lineStyle(1, 0x4a3010, 0.7); sl.moveTo(x, y + 30); sl.lineTo(x + w, y + 30); sl.strokePath();
  }

  _makeButton(x, y, w, h, label, color, onClick) {
    const bg = this.add.rectangle(x, y, w, h, color, 0.88)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(1, 0xffffff, 0.15);
    const txt = this.add.text(x, y, label, {
      fontFamily: 'Georgia, serif', fontSize: '15px', color: '#ffffff',
    }).setOrigin(0.5);
    bg.on('pointerover', () => { bg.setAlpha(1); bg.setStrokeStyle(2, 0xffd700, 0.8); });
    bg.on('pointerout',  () => { bg.setAlpha(0.88); bg.setStrokeStyle(1, 0xffffff, 0.15); });
    bg.on('pointerdown', onClick);
    return { bg, txt };
  }

  _showStatus(msg, color = '#ccaa44') {
    this.statusMsgTxt.setText(msg).setColor(color).setVisible(true);
    this.time.delayedCall(4000, () => this.statusMsgTxt.setVisible(false));
  }
}