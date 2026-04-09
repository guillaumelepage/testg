import Phaser from 'phaser';

const T = 48;

const C = {
  GRASS: 0x4a8c3f, GRASS_DARK: 0x3a7030, WATER: 0x2a78b8, WATER_LIGHT: 0x4a98d8,
  SAND: 0xd4b86a, FOREST: 0x2a5a1a, FOREST_TRUNK: 0x5a3a1a,
  MOUNTAIN: 0x7a7060, MOUNTAIN_SNOW: 0xe8e8e8, DIRT: 0x9a7050,
  SKIN: 0xd4a87a, SKIN_DARK: 0xc09060,
};

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    const w = this.cameras.main.width, h = this.cameras.main.height;
    const bar = this.add.graphics();
    bar.fillStyle(0x2a1a0a); bar.fillRect(w * 0.2, h * 0.48, w * 0.6, 20);
    const fill = this.add.graphics();
    this.load.on('progress', (p) => {
      fill.clear(); fill.fillStyle(0xc8960c);
      fill.fillRect(w * 0.2 + 2, h * 0.48 + 2, (w * 0.6 - 4) * p, 16);
    });
    this.add.text(w / 2, h * 0.4, 'CONQUÊTE MÉDIÉVALE', { fontFamily: 'serif', fontSize: '36px', color: '#c8960c' }).setOrigin(0.5);
    this.add.text(w / 2, h * 0.55, 'Chargement...', { fontFamily: 'sans-serif', fontSize: '14px', color: '#aaaaaa' }).setOrigin(0.5);
  }

  create() {
    this._createTileTextures();
    this._createResourceTextures();
    this._createUnitTextures();
    this._createBuildingTextures();
    this._createUITextures();
    this._createNPCTextures();
    this.scene.start('Menu');
  }

  // ─── Tiles ────────────────────────────────────────────────────────────────

  _createTileTextures() {
    const types = [
      { key: 'tile_grass',      fn: this._drawGrass.bind(this) },
      { key: 'tile_dark_grass', fn: this._drawDarkGrass.bind(this) },
      { key: 'tile_water',      fn: this._drawWater.bind(this) },
      { key: 'tile_sand',       fn: this._drawSand.bind(this) },
      { key: 'tile_forest',     fn: this._drawForest.bind(this) },
      { key: 'tile_mountain',   fn: this._drawMountain.bind(this) },
      { key: 'tile_dirt',       fn: this._drawDirt.bind(this) },
    ];
    for (const { key, fn } of types) {
      const g = this.make.graphics({ add: false });
      fn(g); g.generateTexture(key, T, T); g.destroy();
    }
  }

  _drawGrass(g) {
    g.fillStyle(C.GRASS); g.fillRect(0, 0, T, T);
    g.fillStyle(C.GRASS_DARK);
    for (let i = 0; i < 8; i++) { g.fillRect(4 + i*5, 6 + (i%3)*14, 2, 4); g.fillRect(8 + i*5, 10 + (i%3)*14, 2, 4); }
  }
  _drawDarkGrass(g) {
    g.fillStyle(C.GRASS_DARK); g.fillRect(0, 0, T, T);
    g.fillStyle(C.GRASS);
    for (let i = 0; i < 5; i++) g.fillRect(6 + i*9, 8 + i*7, 3, 6);
  }
  _drawWater(g) {
    g.fillStyle(C.WATER); g.fillRect(0, 0, T, T);
    g.fillStyle(C.WATER_LIGHT);
    g.fillRect(4, 12, 16, 3); g.fillRect(24, 28, 14, 3); g.fillRect(6, 36, 20, 3);
  }
  _drawSand(g) {
    g.fillStyle(C.SAND); g.fillRect(0, 0, T, T);
    g.fillStyle(0xb89850);
    for (let i = 0; i < 6; i++) g.fillRect(4 + i*8, 4 + (i%4)*11, 3, 3);
  }
  _drawForest(g) {
    g.fillStyle(C.GRASS_DARK); g.fillRect(0, 0, T, T);
    g.fillStyle(C.FOREST); g.fillCircle(T/2, T/2-2, 16);
    g.fillStyle(0x3a7022); g.fillCircle(T/2-6, T/2+2, 12);
    g.fillStyle(0x225a10); g.fillCircle(T/2+7, T/2+4, 10);
    g.fillStyle(C.FOREST_TRUNK); g.fillRect(T/2-3, T/2+10, 6, 10);
  }
  _drawMountain(g) {
    g.fillStyle(C.GRASS_DARK); g.fillRect(0, 0, T, T);
    g.fillStyle(C.MOUNTAIN); g.fillTriangle(T/2, 4, 4, T-6, T-4, T-6);
    g.fillStyle(0x8a8070); g.fillTriangle(T/2+8, 14, T-6, T-8, T-6, T-6);
    g.fillStyle(C.MOUNTAIN_SNOW); g.fillTriangle(T/2, 4, T/2-8, 20, T/2+8, 20);
  }
  _drawDirt(g) {
    g.fillStyle(C.DIRT); g.fillRect(0, 0, T, T);
    g.fillStyle(0x7a5030);
    for (let i = 0; i < 5; i++) g.fillRect(3 + i*9, 5 + i*9, 4, 4);
  }

  // ─── Resources ────────────────────────────────────────────────────────────

  _createResourceTextures() {
    // ── Full tree (wood resource, alive) ─────────────────────────────────────
    {
      const g = this.make.graphics({ add: false });
      // Shadow
      g.fillStyle(0x000000, 0.18); g.fillEllipse(T/2+3, T-5, T*0.72, T*0.18);
      // Trunk
      g.fillStyle(0x6b3a1f); g.fillRect(T/2-4, T/2+6, 8, 14);
      g.fillStyle(0x8a5030); g.fillRect(T/2-2, T/2+6, 3, 14);
      // Canopy — layered for depth
      g.fillStyle(0x225a10); g.fillCircle(T/2+5, T/2+5, 11);
      g.fillStyle(0x2a6a18); g.fillCircle(T/2-5, T/2+2, 13);
      g.fillStyle(0x3a7a22); g.fillCircle(T/2+2, T/2-3, 14);
      g.fillStyle(0x4a8a30); g.fillCircle(T/2-2, T/2-7, 10);
      g.fillStyle(0x5a9838, 0.7); g.fillCircle(T/2-4, T/2-9, 7);
      g.generateTexture('res_tree', T, T); g.destroy();
    }

    // ── Tree stump (wood depleted, regrowing) ─────────────────────────────────
    {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0x000000, 0.14); g.fillEllipse(T/2+2, T-9, T*0.58, T*0.14);
      // Stump body
      g.fillStyle(0x6b3a1f); g.fillRect(T/2-9, T/2+2, 18, 14);
      g.fillStyle(0x8a5030); g.fillRect(T/2-7, T/2+2, 5, 14);
      // Top face with rings
      g.fillStyle(0x9a6040); g.fillEllipse(T/2, T/2+2, 18, 10);
      g.lineStyle(1, 0x6b3a1f, 0.7); g.strokeEllipse(T/2, T/2+2, 13, 6);
      g.lineStyle(1, 0x6b3a1f, 0.4); g.strokeEllipse(T/2, T/2+2, 7, 4);
      // Small branch stubs
      g.fillStyle(0x5a2a10); g.fillRect(T/2-12, T/2+5, 4, 4);
      g.fillStyle(0x5a2a10); g.fillRect(T/2+8, T/2+6, 4, 4);
      g.generateTexture('res_tree_stump', T, T); g.destroy();
    }

    // ── Sapling (30–90% regrown, can't gather yet) ───────────────────────────
    {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0x000000, 0.10); g.fillEllipse(T/2+1, T-10, T*0.4, T*0.12);
      // Thin trunk
      g.fillStyle(0x7a4a20); g.fillRect(T/2-2, T/2+2, 4, 14);
      // Small canopy
      g.fillStyle(0x2a6a18); g.fillCircle(T/2+3, T/2, 8);
      g.fillStyle(0x3a7a22); g.fillCircle(T/2-2, T/2-3, 9);
      g.fillStyle(0x5a9838, 0.8); g.fillCircle(T/2, T/2-7, 6);
      g.generateTexture('res_tree_sapling', T, T); g.destroy();
    }

    // ── Stone pile ───────────────────────────────────────────────────────────
    {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0x000000, 0.18); g.fillEllipse(T/2+3, T-6, T*0.80, T*0.20);
      // Rocks stacked
      g.fillStyle(0x555250); g.fillCircle(T/2+9, T/2+8, 8);
      g.fillStyle(0x6a6660); g.fillCircle(T/2-8, T/2+5, 10);
      g.fillStyle(0x7a7874); g.fillCircle(T/2+4, T/2+1, 11);
      g.fillStyle(0x8c8a88); g.fillCircle(T/2-2, T/2-5, 9);
      // Highlights
      g.fillStyle(0xa0a09c); g.fillCircle(T/2-4, T/2-7, 5);
      g.fillStyle(0x606060); g.fillCircle(T/2+10, T/2+10, 5);
      g.lineStyle(1, 0x3a3836, 0.5); g.strokeCircle(T/2+4, T/2+1, 11);
      g.lineStyle(1, 0x3a3836, 0.4); g.strokeCircle(T/2-8, T/2+5, 10);
      g.generateTexture('res_stone', T, T); g.destroy();
    }

    // ── Gold ore vein ─────────────────────────────────────────────────────────
    {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0x000000, 0.18); g.fillEllipse(T/2+3, T-6, T*0.80, T*0.20);
      // Dark rock base
      g.fillStyle(0x484440); g.fillCircle(T/2+6, T/2+6, 9);
      g.fillStyle(0x555250); g.fillCircle(T/2-7, T/2+3, 11);
      g.fillStyle(0x606060); g.fillCircle(T/2+2, T/2-4, 12);
      // Gold veins in rock
      g.fillStyle(0xffd700); g.fillRect(T/2-8, T/2-1, 6, 3);
      g.fillStyle(0xffc000); g.fillRect(T/2+3, T/2+3, 7, 3);
      g.fillStyle(0xffdd44); g.fillRect(T/2-2, T/2-7, 5, 3);
      // Gold nuggets (bright spots)
      g.fillStyle(0xffd700, 0.9); g.fillCircle(T/2+5, T/2-2, 4);
      g.fillStyle(0xffee88, 0.8); g.fillCircle(T/2+7, T/2-4, 2);
      g.fillStyle(0xffc000, 0.7); g.fillCircle(T/2-6, T/2+5, 3);
      g.lineStyle(1, 0x2a2820, 0.5); g.strokeCircle(T/2+2, T/2-4, 12);
      g.generateTexture('res_gold', T, T); g.destroy();
    }

    // ── Wheat field ───────────────────────────────────────────────────────────
    {
      const g = this.make.graphics({ add: false });
      // Soil
      g.fillStyle(0x8a6a30, 0.5); g.fillRect(2, Math.floor(T*0.55), T-4, Math.floor(T*0.42));
      // Wheat stalks (7 stalks)
      const stalks = [5, 11, 17, 23, 29, 35, 41];
      for (const sx of stalks) {
        const sh = 14 + (sx % 4);  // vary height slightly
        // Stem
        g.lineStyle(2, 0xa89040);
        g.moveTo(sx+1, T-7); g.lineTo(sx+1, T-7-sh); g.strokePath();
        // Grain head (ear of wheat)
        g.fillStyle(0xd4a820); g.fillRect(sx-2, T-7-sh-8, 5, 9);
        g.fillStyle(0xf0c040); g.fillRect(sx-1, T-7-sh-8, 3, 7);
        // Awns (spikes)
        g.lineStyle(1, 0xc89830);
        g.moveTo(sx-2, T-7-sh-2); g.lineTo(sx-5, T-7-sh-6); g.strokePath();
        g.moveTo(sx+3, T-7-sh-3); g.lineTo(sx+6, T-7-sh-7); g.strokePath();
      }
      g.generateTexture('res_food', T, T); g.destroy();
    }
  }

  // ─── Units ─────────────────────────────────────────────────────────────────

  _createUnitTextures() {
    const SZ = 36;
    const units = [
      { key: 'paysan',         fn: this._unitPaysan.bind(this) },
      { key: 'homme_armes',    fn: this._unitHommeArmes.bind(this) },
      { key: 'archer',         fn: this._unitArcher.bind(this) },
      { key: 'chevalier',      fn: this._unitChevalier.bind(this) },
      { key: 'garde_roi',      fn: this._unitGardeRoi.bind(this) },
      { key: 'croise',         fn: this._unitCroise.bind(this) },
      { key: 'mercenaire',     fn: this._unitMercenaire.bind(this) },
      { key: 'compagnie_loup', fn: this._unitLoupCompagnie.bind(this) },
      { key: 'frere_epee',     fn: this._unitFrereEpee.bind(this) },
    ];

    for (const { key, fn } of units) {
      for (const isEnemy of [false, true]) {
        const suffix = isEnemy ? '_enemy' : '';
        // Map sprite
        const g = this.make.graphics({ add: false });
        fn(g, SZ, isEnemy); g.generateTexture(`unit_${key}${suffix}`, SZ, SZ); g.destroy();
        // Battle sprite (larger)
        const gb = this.make.graphics({ add: false });
        fn(gb, 96, isEnemy); gb.generateTexture(`battle_${key}${suffix}`, 96, 96); gb.destroy();
      }
    }

    // Neutral mobs (no enemy variant)
    const mobs = [
      { key: 'loup',     fn: this._mobLoup.bind(this) },
      { key: 'sanglier', fn: this._mobSanglier.bind(this) },
      { key: 'ours',     fn: this._mobOurs.bind(this) },
    ];
    for (const { key, fn } of mobs) {
      const g = this.make.graphics({ add: false });
      fn(g, SZ); g.generateTexture(`unit_${key}`, SZ, SZ); g.destroy();
      const gb = this.make.graphics({ add: false });
      fn(gb, 96); gb.generateTexture(`battle_${key}`, 96, 96); gb.destroy();
    }

    // Heroes
    const heroes = [
      { key: 'roi_guerrier', fn: this._heroRoi.bind(this) },
      { key: 'chasseresse',  fn: this._heroChasse.bind(this) },
      { key: 'mage_arcane',  fn: this._heroMage.bind(this) },
    ];
    for (const { key, fn } of heroes) {
      const g = this.make.graphics({ add: false });
      fn(g, SZ, false); g.generateTexture(`unit_${key}`, SZ, SZ); g.destroy();
      const ge = this.make.graphics({ add: false });
      fn(ge, SZ, true); ge.generateTexture(`unit_${key}_enemy`, SZ, SZ); ge.destroy();
      const gb = this.make.graphics({ add: false });
      fn(gb, 96, false); gb.generateTexture(`battle_${key}`, 96, 96); gb.destroy();
      const gbe = this.make.graphics({ add: false });
      fn(gbe, 96, true); gbe.generateTexture(`battle_${key}_enemy`, 96, 96); gbe.destroy();
    }
  }

  // ── drawing helpers ────────────────────────────────────────────────────────

  _shadow(g, cx, cy, sz) {
    g.fillStyle(0x00000028); g.fillEllipse(cx, cy + sz*0.36, sz*0.58, sz*0.13);
  }
  _head(g, cx, hy, r, skinCol) {
    g.fillStyle(skinCol || C.SKIN); g.fillCircle(cx, hy, r);
  }
  _stick(g, x1, y1, x2, y2, thick, col) {
    g.lineStyle(thick, col); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.strokePath();
  }

  // ── Paysan ────────────────────────────────────────────────────────────────
  _unitPaysan(g, sz, e) {
    const cx = sz/2, cy = sz*0.58, hy = cy - sz*0.3;
    const body = e ? 0xaa2211 : 0x9a6b3a;
    this._shadow(g, cx, cy, sz);
    // Tunic
    g.fillStyle(body); g.fillEllipse(cx, cy, sz*0.44, sz*0.46);
    g.fillStyle(e ? 0xcc3322 : 0xb08050); g.fillEllipse(cx, cy-sz*0.07, sz*0.34, sz*0.28);
    // Belt
    g.fillStyle(e ? 0x882211 : 0x6b4a1a); g.fillRect(cx-sz*0.2, cy+sz*0.01, sz*0.4, sz*0.05);
    // Head
    this._head(g, cx, hy, sz*0.13, e ? 0xdd4433 : C.SKIN);
    // Straw hat
    g.fillStyle(e ? 0xaa4422 : 0xd4aa44);
    g.fillEllipse(cx, hy-sz*0.06, sz*0.38, sz*0.1);
    g.fillTriangle(cx, hy-sz*0.24, cx-sz*0.12, hy-sz*0.04, cx+sz*0.12, hy-sz*0.04);
    // Pitchfork
    this._stick(g, cx+sz*0.24, hy-sz*0.02, cx+sz*0.24, sz*0.84, sz*0.045, e ? 0x882211 : 0x7a4a20);
    for (const dx of [-sz*0.06, 0, sz*0.06]) {
      this._stick(g, cx+sz*0.24+dx, hy-sz*0.06, cx+sz*0.24+dx, hy+sz*0.06, sz*0.032, e ? 0x882211 : 0x7a4a20);
    }
  }

  // ── Homme d'Armes ─────────────────────────────────────────────────────────
  _unitHommeArmes(g, sz, e) {
    const cx = sz/2, cy = sz*0.58, hy = cy - sz*0.33;
    const armor = e ? 0xaa2211 : 0x6a6a6a;
    const dark  = e ? 0x881100 : 0x3a3a3a;
    const acc   = e ? 0xff5555 : 0xcc3333;
    this._shadow(g, cx, cy, sz);
    // Shield (behind, left)
    g.fillStyle(dark);
    g.fillRoundedRect(cx-sz*0.37, cy-sz*0.28, sz*0.2, sz*0.38, sz*0.03);
    g.fillStyle(acc); g.fillRect(cx-sz*0.36, cy-sz*0.04, sz*0.18, sz*0.04);
    // Armored body
    g.fillStyle(armor); g.fillRoundedRect(cx-sz*0.16, cy-sz*0.26, sz*0.32, sz*0.44, sz*0.03);
    g.fillStyle(dark); g.fillRect(cx-sz*0.14, cy+sz*0.08, sz*0.28, sz*0.04);
    // Helmet
    g.fillStyle(armor); g.fillCircle(cx, hy, sz*0.15);
    g.fillStyle(dark); g.fillRect(cx-sz*0.12, hy-sz*0.04, sz*0.24, sz*0.06);
    g.fillStyle(acc); g.fillRect(cx-sz*0.02, hy-sz*0.14, sz*0.04, sz*0.06);
    // Spear
    this._stick(g, cx+sz*0.26, sz*0.06, cx+sz*0.26, sz*0.84, sz*0.04, e ? 0xaa3311 : 0x8B6914);
    g.fillStyle(e ? 0xff5544 : 0xcccccc);
    g.fillTriangle(cx+sz*0.26, sz*0.03, cx+sz*0.2, sz*0.12, cx+sz*0.32, sz*0.12);
  }

  // ── Archer ────────────────────────────────────────────────────────────────
  _unitArcher(g, sz, e) {
    const cx = sz/2, cy = sz*0.58, hy = cy - sz*0.32;
    const body = e ? 0xaa2211 : 0x3a6a28;
    const acc  = e ? 0xff5544 : 0xc87d2a;
    this._shadow(g, cx, cy, sz);
    // Slim body
    g.fillStyle(body); g.fillEllipse(cx, cy, sz*0.36, sz*0.46);
    g.fillStyle(e ? 0xcc3322 : 0x4a8038); g.fillEllipse(cx, cy-sz*0.08, sz*0.26, sz*0.26);
    // Quiver (right)
    g.fillStyle(acc); g.fillRect(cx+sz*0.16, cy-sz*0.22, sz*0.08, sz*0.26);
    for (let i = 0; i < 3; i++) { g.fillStyle(e ? 0xff6644 : 0xd4aa44); g.fillRect(cx+sz*0.17+i*sz*0.025, cy-sz*0.32, sz*0.02, sz*0.12); }
    // Hood
    g.fillStyle(body); g.fillCircle(cx, hy, sz*0.15);
    g.fillStyle(e ? 0xbb3322 : 0x285020); g.fillTriangle(cx, hy-sz*0.2, cx-sz*0.14, hy+sz*0.04, cx+sz*0.14, hy+sz*0.04);
    g.fillStyle(e ? 0xdd4433 : C.SKIN); g.fillEllipse(cx, hy+sz*0.02, sz*0.1, sz*0.08);
    // Bow arc (left)
    g.lineStyle(sz*0.05, e ? 0x882211 : 0x6b3a1a);
    g.beginPath();
    const bx = cx-sz*0.3, bTop = cy-sz*0.22, bBot = cy+sz*0.22;
    for (let i = 0; i <= 8; i++) { const t = i/8; const ay = bTop+(bBot-bTop)*t; const ax = bx-Math.sin(t*Math.PI)*sz*0.1; if (i===0) g.moveTo(ax,ay); else g.lineTo(ax,ay); }
    g.strokePath();
    g.lineStyle(sz*0.02, 0xddccaa);
    g.beginPath(); g.moveTo(bx, bTop); g.lineTo(bx+sz*0.05, (bTop+bBot)/2); g.lineTo(bx, bBot); g.strokePath();
  }

  // ── Chevalier ─────────────────────────────────────────────────────────────
  _unitChevalier(g, sz, e) {
    const cx = sz/2, cy = sz*0.58, hy = cy - sz*0.34;
    const body = e ? 0xaa2211 : 0x3a5a9a;
    const dark = e ? 0x880000 : 0x1a3a7a;
    const acc  = e ? 0xff8844 : 0xffd700;
    this._shadow(g, cx, cy, sz);
    g.fillStyle(body); g.fillRoundedRect(cx-sz*0.19, cy-sz*0.26, sz*0.38, sz*0.46, sz*0.04);
    g.fillStyle(e ? 0xcc2211 : 0x5a7ac0); g.fillRect(cx-sz*0.17, cy-sz*0.24, sz*0.34, sz*0.1);
    // Cross emblem
    g.fillStyle(acc); g.fillRect(cx-sz*0.02, cy-sz*0.14, sz*0.04, sz*0.14);
    g.fillRect(cx-sz*0.08, cy-sz*0.1, sz*0.16, sz*0.04);
    // Pointed helmet
    g.fillStyle(e ? 0xcc2211 : 0x4a6aaa); g.fillCircle(cx, hy, sz*0.16);
    g.fillTriangle(cx, hy-sz*0.24, cx-sz*0.06, hy-sz*0.08, cx+sz*0.06, hy-sz*0.08);
    g.fillStyle(dark); g.fillRect(cx-sz*0.1, hy-sz*0.03, sz*0.2, sz*0.07);
    // Sword diagonal
    this._stick(g, cx+sz*0.12, cy-sz*0.26, cx+sz*0.3, cy+sz*0.3, sz*0.07, e ? 0xdd4433 : 0xd0d0d0);
    g.fillStyle(acc); g.fillRect(cx+sz*0.17, cy-sz*0.02, sz*0.2, sz*0.04);
    g.fillStyle(acc); g.fillCircle(cx+sz*0.3, cy+sz*0.3, sz*0.05);
  }

  // ── Garde du Roi ──────────────────────────────────────────────────────────
  _unitGardeRoi(g, sz, e) {
    const cx = sz/2, cy = sz*0.58, hy = cy - sz*0.34;
    const body = e ? 0xaa2211 : 0xb8860b;
    const dark = e ? 0x880000 : 0x7a5500;
    const acc  = e ? 0xff9944 : 0xffd700;
    this._shadow(g, cx, cy, sz);
    // Shield (large, center foreground)
    const sp = [cx-sz*0.18,cy-sz*0.22, cx+sz*0.18,cy-sz*0.22, cx+sz*0.18,cy+sz*0.1, cx,cy+sz*0.26, cx-sz*0.18,cy+sz*0.1];
    g.fillStyle(e ? 0xcc2211 : 0x8B6914);
    g.fillPoints([{x:sp[0],y:sp[1]},{x:sp[2],y:sp[3]},{x:sp[4],y:sp[5]},{x:sp[6],y:sp[7]},{x:sp[8],y:sp[9]}], true);
    g.fillStyle(acc); g.fillCircle(cx, cy-sz*0.04, sz*0.06);
    g.fillRect(cx-sz*0.16, cy-sz*0.08, sz*0.32, sz*0.04);
    // Body (behind shield)
    g.fillStyle(body); g.fillRect(cx-sz*0.06, cy-sz*0.22, sz*0.12, sz*0.18);
    // Royal helmet + plume
    g.fillStyle(body); g.fillCircle(cx, hy, sz*0.17);
    g.fillStyle(dark); g.fillRect(cx-sz*0.14, hy-sz*0.04, sz*0.28, sz*0.07);
    g.lineStyle(sz*0.04, acc); g.strokeCircle(cx, hy, sz*0.17);
    // Red plume
    g.fillStyle(0xee2222); g.fillTriangle(cx, hy-sz*0.3, cx-sz*0.04, hy-sz*0.14, cx+sz*0.04, hy-sz*0.14);
  }

  // ── Croisé ────────────────────────────────────────────────────────────────
  _unitCroise(g, sz, e) {
    const cx = sz/2, cy = sz*0.58, hy = cy - sz*0.33;
    const body = e ? 0xaa2211 : 0xe8e8e0;
    const dark = e ? 0x880000 : 0x9a9a9a;
    const cross = e ? 0xff4444 : 0xcc2222;
    this._shadow(g, cx, cy, sz);
    g.fillStyle(body); g.fillRoundedRect(cx-sz*0.17, cy-sz*0.26, sz*0.34, sz*0.44, sz*0.03);
    g.fillStyle(dark); g.fillRect(cx-sz*0.17, cy-sz*0.26, sz*0.34, sz*0.06);
    // Red cross on tabard
    g.fillStyle(cross);
    g.fillRect(cx-sz*0.02, cy-sz*0.22, sz*0.04, sz*0.36);
    g.fillRect(cx-sz*0.12, cy-sz*0.1, sz*0.24, sz*0.04);
    // Visor helmet
    g.fillStyle(dark); g.fillCircle(cx, hy, sz*0.16);
    g.fillStyle(body); g.fillEllipse(cx, hy+sz*0.02, sz*0.12, sz*0.1);
    // Longsword left
    this._stick(g, cx-sz*0.28, cy-sz*0.22, cx-sz*0.28, cy+sz*0.3, sz*0.06, dark);
    g.fillStyle(0xc8960c); g.fillRect(cx-sz*0.35, cy-sz*0.12, sz*0.14, sz*0.04);
  }

  // ── Mercenaire ────────────────────────────────────────────────────────────
  _unitMercenaire(g, sz, e) {
    const cx = sz/2, cy = sz*0.58, hy = cy - sz*0.33;
    const body = e ? 0xaa2211 : 0x1a1a28;
    const leather = e ? 0xcc3322 : 0x3a2a1a;
    const acc  = e ? 0xff5533 : 0x880000;
    this._shadow(g, cx, cy, sz);
    // Dark cloak
    g.fillStyle(body); g.fillTriangle(cx, sz*0.84, cx-sz*0.2, cy-sz*0.26, cx+sz*0.2, cy-sz*0.26);
    g.fillStyle(leather); g.fillRoundedRect(cx-sz*0.14, cy-sz*0.24, sz*0.28, sz*0.38, sz*0.03);
    // Hood
    g.fillStyle(body); g.fillCircle(cx, hy, sz*0.16);
    g.fillStyle(0x00000077); g.fillEllipse(cx, hy+sz*0.04, sz*0.1, sz*0.07);
    g.fillStyle(0xffaa00); g.fillCircle(cx+sz*0.02, hy, sz*0.022); // glinting eye
    // Crossed daggers (X)
    this._stick(g, cx-sz*0.16, cy-sz*0.16, cx+sz*0.16, cy+sz*0.16, sz*0.05, e ? 0xff6644 : 0xcccccc);
    this._stick(g, cx+sz*0.16, cy-sz*0.16, cx-sz*0.16, cy+sz*0.16, sz*0.05, e ? 0xff6644 : 0xcccccc);
    g.fillStyle(acc); g.fillRect(cx-sz*0.04, cy-sz*0.04, sz*0.08, sz*0.02);
  }

  // ── Compagnie du Loup ─────────────────────────────────────────────────────
  _unitLoupCompagnie(g, sz, e) {
    const cx = sz/2, cy = sz*0.58, hy = cy - sz*0.33;
    const body = e ? 0xaa2211 : 0x4a5a2a;
    const fur  = e ? 0xbb3322 : 0x6a6a4a;
    this._shadow(g, cx, cy, sz);
    // Fur mantle (wide)
    g.fillStyle(fur); g.fillEllipse(cx, cy-sz*0.04, sz*0.54, sz*0.5);
    g.fillStyle(body); g.fillEllipse(cx, cy+sz*0.06, sz*0.34, sz*0.36);
    g.fillStyle(e ? 0x881100 : 0x4a4a2a); g.fillEllipse(cx, cy-sz*0.16, sz*0.44, sz*0.2);
    // Wolf-pelt head (with ears)
    g.fillStyle(fur); g.fillCircle(cx, hy, sz*0.15);
    g.fillTriangle(cx-sz*0.1, hy-sz*0.06, cx-sz*0.17, hy-sz*0.24, cx-sz*0.03, hy-sz*0.06);
    g.fillTriangle(cx+sz*0.1, hy-sz*0.06, cx+sz*0.04, hy-sz*0.06, cx+sz*0.17, hy-sz*0.24);
    g.fillStyle(e ? 0xdd4433 : C.SKIN); g.fillCircle(cx, hy+sz*0.02, sz*0.09);
    // Axe (right)
    this._stick(g, cx+sz*0.24, hy, cx+sz*0.24, cy+sz*0.26, sz*0.05, e ? 0xbb3322 : 0x7a4a20);
    g.fillStyle(e ? 0xdd5533 : 0xcccccc);
    g.fillTriangle(cx+sz*0.24, hy-sz*0.02, cx+sz*0.38, hy+sz*0.1, cx+sz*0.24, hy+sz*0.18);
  }

  // ── Frère d'Épée ─────────────────────────────────────────────────────────
  _unitFrereEpee(g, sz, e) {
    const cx = sz/2, cy = sz*0.58, hy = cy - sz*0.33;
    const body = e ? 0xaa2211 : 0x8B0000;
    const dark = e ? 0x660000 : 0x5a0000;
    const metal = e ? 0xff6644 : 0xb8b8b8;
    this._shadow(g, cx, cy, sz);
    g.fillStyle(body); g.fillRoundedRect(cx-sz*0.17, cy-sz*0.24, sz*0.34, sz*0.44, sz*0.03);
    // Brotherhood slash symbol
    this._stick(g, cx-sz*0.1, cy-sz*0.16, cx+sz*0.1, cy+sz*0.06, sz*0.04, dark);
    // Cowl
    g.fillStyle(dark); g.fillCircle(cx, hy, sz*0.16);
    g.fillStyle(e ? 0xdd4433 : C.SKIN); g.fillCircle(cx, hy+sz*0.04, sz*0.09);
    // Longsword (left, tall)
    this._stick(g, cx-sz*0.28, cy-sz*0.3, cx-sz*0.28, cy+sz*0.34, sz*0.07, metal);
    g.fillStyle(0xc8960c); g.fillRect(cx-sz*0.34, cy-sz*0.12, sz*0.12, sz*0.04);
    g.fillStyle(0xc8960c); g.fillCircle(cx-sz*0.28, cy+sz*0.32, sz*0.05);
  }

  // ── MOBS ──────────────────────────────────────────────────────────────────

  _mobLoup(g, sz) {
    const cx = sz*0.48, cy = sz*0.64;
    g.fillStyle(0x00000022); g.fillEllipse(cx, sz*0.9, sz*0.72, sz*0.12);
    g.fillStyle(0x7a6a50); g.fillEllipse(cx, cy, sz*0.58, sz*0.36);
    g.fillStyle(0x8a7a60); g.fillEllipse(cx-sz*0.08, cy-sz*0.06, sz*0.42, sz*0.26);
    // Head
    g.fillStyle(0x7a6a50); g.fillEllipse(cx+sz*0.26, cy-sz*0.1, sz*0.24, sz*0.2);
    g.fillStyle(0x6a5a40); g.fillEllipse(cx+sz*0.36, cy-sz*0.06, sz*0.12, sz*0.1);
    g.fillStyle(0x1a1a1a); g.fillEllipse(cx+sz*0.4, cy-sz*0.1, sz*0.04, sz*0.03);
    // Ears
    g.fillStyle(0x7a6a50);
    g.fillTriangle(cx+sz*0.18, cy-sz*0.16, cx+sz*0.12, cy-sz*0.3, cx+sz*0.26, cy-sz*0.22);
    g.fillTriangle(cx+sz*0.28, cy-sz*0.14, cx+sz*0.24, cy-sz*0.28, cx+sz*0.36, cy-sz*0.16);
    g.fillStyle(0x9a8070);
    g.fillTriangle(cx+sz*0.2, cy-sz*0.17, cx+sz*0.15, cy-sz*0.26, cx+sz*0.25, cy-sz*0.21);
    // Legs
    g.fillStyle(0x6a5a40); g.fillRect(cx-sz*0.18, cy+sz*0.16, sz*0.1, sz*0.16); g.fillRect(cx+sz*0.1, cy+sz*0.16, sz*0.1, sz*0.16);
    // Tail
    this._stick(g, cx-sz*0.28, cy-sz*0.02, cx-sz*0.44, cy-sz*0.18, sz*0.05, 0x7a6a50);
    g.fillStyle(0xffcc00); g.fillCircle(cx+sz*0.29, cy-sz*0.1, sz*0.03);
  }

  _mobSanglier(g, sz) {
    const cx = sz*0.48, cy = sz*0.64;
    g.fillStyle(0x00000022); g.fillEllipse(cx, sz*0.9, sz*0.72, sz*0.12);
    g.fillStyle(0x4a2a10); g.fillEllipse(cx-sz*0.04, cy, sz*0.58, sz*0.44);
    g.fillStyle(0x5a3a18); g.fillEllipse(cx-sz*0.1, cy-sz*0.06, sz*0.44, sz*0.32);
    // Head
    g.fillStyle(0x4a2a10); g.fillEllipse(cx+sz*0.22, cy-sz*0.04, sz*0.28, sz*0.28);
    g.fillStyle(0x5a3a20); g.fillEllipse(cx+sz*0.36, cy, sz*0.14, sz*0.12);
    g.fillStyle(0x2a1808); g.fillCircle(cx+sz*0.33, cy-sz*0.01, sz*0.025); g.fillCircle(cx+sz*0.39, cy-sz*0.01, sz*0.025);
    // Tusks!
    g.fillStyle(0xfffaee);
    g.fillTriangle(cx+sz*0.3, cy+sz*0.04, cx+sz*0.24, cy+sz*0.15, cx+sz*0.35, cy+sz*0.08);
    g.fillTriangle(cx+sz*0.41, cy+sz*0.04, cx+sz*0.38, cy+sz*0.15, cx+sz*0.47, cy+sz*0.08);
    // Ears + Bristles
    g.fillStyle(0x4a2a10); g.fillTriangle(cx+sz*0.12, cy-sz*0.18, cx+sz*0.08, cy-sz*0.32, cx+sz*0.22, cy-sz*0.2);
    g.lineStyle(sz*0.03, 0x2a1808);
    for (let i = 0; i < 4; i++) { this._stick(g, cx-sz*0.2+i*sz*0.12, cy-sz*0.22, cx-sz*0.2+i*sz*0.12, cy-sz*0.3, sz*0.03, 0x2a1808); }
    // Legs
    g.fillStyle(0x3a2008);
    g.fillRect(cx-sz*0.2, cy+sz*0.2, sz*0.1, sz*0.14); g.fillRect(cx+sz*0.06, cy+sz*0.2, sz*0.1, sz*0.14);
  }

  _mobOurs(g, sz) {
    const cx = sz*0.5, cy = sz*0.58;
    g.fillStyle(0x00000022); g.fillEllipse(cx, sz*0.92, sz*0.72, sz*0.14);
    g.fillStyle(0x2a1808); g.fillCircle(cx, cy, sz*0.38);
    g.fillStyle(0x3a2410); g.fillCircle(cx-sz*0.06, cy-sz*0.07, sz*0.3);
    g.fillStyle(0x6a4a28); g.fillEllipse(cx, cy+sz*0.06, sz*0.22, sz*0.26);
    // Head
    g.fillStyle(0x2a1808); g.fillCircle(cx, cy-sz*0.32, sz*0.2);
    // Round ears
    g.fillStyle(0x2a1808); g.fillCircle(cx-sz*0.14, cy-sz*0.5, sz*0.1); g.fillCircle(cx+sz*0.14, cy-sz*0.5, sz*0.1);
    g.fillStyle(0x5a3820); g.fillCircle(cx-sz*0.14, cy-sz*0.5, sz*0.06); g.fillCircle(cx+sz*0.14, cy-sz*0.5, sz*0.06);
    // Snout/eyes
    g.fillStyle(0x4a2808); g.fillEllipse(cx, cy-sz*0.26, sz*0.16, sz*0.12);
    g.fillStyle(0x1a0808); g.fillEllipse(cx, cy-sz*0.28, sz*0.08, sz*0.06);
    g.fillStyle(0x8a5030); g.fillCircle(cx-sz*0.06, cy-sz*0.33, sz*0.03); g.fillCircle(cx+sz*0.06, cy-sz*0.33, sz*0.03);
    // Paws + claws
    g.fillStyle(0x2a1808); g.fillCircle(cx-sz*0.3, cy+sz*0.12, sz*0.1); g.fillCircle(cx+sz*0.3, cy+sz*0.12, sz*0.1);
    g.fillStyle(0xccaa88);
    for (let i = -1; i <= 1; i++) {
      g.fillTriangle(cx-sz*0.3+i*sz*0.06, cy+sz*0.22, cx-sz*0.32+i*sz*0.06, cy+sz*0.28, cx-sz*0.28+i*sz*0.06, cy+sz*0.28);
      g.fillTriangle(cx+sz*0.3+i*sz*0.06, cy+sz*0.22, cx+sz*0.28+i*sz*0.06, cy+sz*0.28, cx+sz*0.32+i*sz*0.06, cy+sz*0.28);
    }
  }

  // ── HEROES ────────────────────────────────────────────────────────────────

  _heroRoi(g, sz, e) {
    const cx = sz/2, cy = sz*0.58, hy = cy - sz*0.34;
    const body = e ? 0xaa2211 : 0xb8860b;
    const dark = e ? 0x880000 : 0x7a5500;
    const gold = 0xffd700;
    this._shadow(g, cx, cy, sz);
    g.fillStyle(body); g.fillRoundedRect(cx-sz*0.2, cy-sz*0.26, sz*0.4, sz*0.46, sz*0.04);
    g.fillStyle(gold); g.fillRect(cx-sz*0.2, cy-sz*0.26, sz*0.4, sz*0.06);
    g.fillRect(cx-sz*0.2, cy+sz*0.14, sz*0.4, sz*0.04);
    // Chest cross
    g.fillStyle(dark); g.fillRect(cx-sz*0.04, cy-sz*0.18, sz*0.08, sz*0.22); g.fillRect(cx-sz*0.1, cy-sz*0.08, sz*0.2, sz*0.06);
    // Helmet
    g.fillStyle(body); g.fillCircle(cx, hy, sz*0.17);
    g.fillStyle(dark); g.fillRect(cx-sz*0.14, hy-sz*0.04, sz*0.28, sz*0.08);
    // Crown!
    g.fillStyle(gold);
    g.fillRect(cx-sz*0.14, hy-sz*0.22, sz*0.28, sz*0.09);
    for (const dx of [-sz*0.1, 0, sz*0.1]) { g.fillTriangle(cx+dx, hy-sz*0.32, cx+dx-sz*0.04, hy-sz*0.22, cx+dx+sz*0.04, hy-sz*0.22); }
    g.fillStyle(0xcc2222); g.fillCircle(cx, hy-sz*0.21, sz*0.025);
    g.fillStyle(0x2222cc); g.fillCircle(cx-sz*0.1, hy-sz*0.21, sz*0.025);
    g.fillStyle(0x22cc22); g.fillCircle(cx+sz*0.1, hy-sz*0.21, sz*0.025);
    // Royal sword
    this._stick(g, cx+sz*0.14, cy-sz*0.28, cx+sz*0.32, cy+sz*0.3, sz*0.09, e ? 0xdd4433 : 0xe0e0e0);
    g.fillStyle(gold); g.fillRect(cx+sz*0.18, cy-sz*0.01, sz*0.22, sz*0.05);
    g.fillStyle(gold); g.fillCircle(cx+sz*0.32, cy+sz*0.3, sz*0.06);
    // Hero glow
    if (!e) { g.lineStyle(sz*0.03, 0xffd700, 0.55); g.strokeCircle(cx, sz/2, sz*0.47); }
  }

  _heroChasse(g, sz, e) {
    const cx = sz/2, cy = sz*0.58, hy = cy - sz*0.34;
    const body = e ? 0xaa2211 : 0x2d7a2d;
    const acc  = e ? 0xff8844 : 0x88ff44;
    this._shadow(g, cx, cy, sz);
    g.fillStyle(body); g.fillEllipse(cx, cy, sz*0.38, sz*0.48);
    g.fillStyle(e ? 0xcc3322 : 0x3a8a3a); g.fillEllipse(cx, cy-sz*0.08, sz*0.3, sz*0.3);
    g.fillStyle(acc); g.fillRect(cx-sz*0.18, cy-sz*0.06, sz*0.36, sz*0.04);
    // Hood + leaf crown
    g.fillStyle(e ? 0xcc3322 : 0x1a6a1a); g.fillCircle(cx, hy, sz*0.15);
    g.fillStyle(e ? 0xdd5533 : 0x22aa22);
    for (let i = -1; i <= 1; i++) { g.fillTriangle(cx+i*sz*0.1, hy-sz*0.22, cx+i*sz*0.1-sz*0.06, hy-sz*0.12, cx+i*sz*0.1+sz*0.06, hy-sz*0.12); }
    g.fillStyle(e ? 0xdd4433 : C.SKIN); g.fillEllipse(cx, hy+sz*0.02, sz*0.1, sz*0.08);
    // Longbow (left)
    g.lineStyle(sz*0.05, e ? 0x882211 : 0x6b3a1a);
    g.beginPath();
    for (let i = 0; i <= 10; i++) { const t=i/10; const by=(cy-sz*0.34)+t*(sz*0.68); const bx=(cx-sz*0.34)-Math.sin(t*Math.PI)*sz*0.14; if(i===0)g.moveTo(bx,by);else g.lineTo(bx,by); }
    g.strokePath();
    g.lineStyle(sz*0.018, 0xddccaa);
    g.beginPath(); g.moveTo(cx-sz*0.34, cy-sz*0.34); g.lineTo(cx-sz*0.28, cy); g.lineTo(cx-sz*0.34, cy+sz*0.34); g.strokePath();
    // Nocked arrow
    this._stick(g, cx-sz*0.28, cy-sz*0.04, cx+sz*0.28, cy-sz*0.04, sz*0.03, 0xd4aa44);
    g.fillStyle(0xcccccc); g.fillTriangle(cx+sz*0.28, cy-sz*0.04, cx+sz*0.22, cy-sz*0.08, cx+sz*0.22, cy);
    if (!e) { g.lineStyle(sz*0.03, 0x88ff44, 0.5); g.strokeCircle(cx, sz/2, sz*0.47); }
  }

  _heroMage(g, sz, e) {
    const cx = sz/2, cy = sz*0.58, hy = cy - sz*0.34;
    const body = e ? 0xaa2211 : 0x6a0dad;
    const acc  = e ? 0xff8888 : 0xcc88ff;
    this._shadow(g, cx, cy, sz);
    // Robe (wide triangle)
    g.fillStyle(body); g.fillTriangle(cx, cy-sz*0.26, cx-sz*0.24, sz*0.84, cx+sz*0.24, sz*0.84);
    g.fillRect(cx-sz*0.12, cy-sz*0.26, sz*0.24, sz*0.26);
    g.fillStyle(e ? 0xcc3322 : 0x8a0fdd); g.fillRect(cx-sz*0.08, cy-sz*0.26, sz*0.16, sz*0.18);
    // Magic runes
    g.lineStyle(sz*0.02, acc, 0.65);
    for (let i = 0; i < 3; i++) { this._stick(g, cx-sz*0.06, cy+i*sz*0.1, cx+sz*0.06, cy+i*sz*0.1, sz*0.02, acc); }
    // Pointed hat
    g.fillStyle(e ? 0x881100 : 0x5a0099);
    g.fillTriangle(cx, hy-sz*0.3, cx-sz*0.18, hy+sz*0.02, cx+sz*0.18, hy+sz*0.02);
    g.fillStyle(e ? 0xaa2211 : 0x8a0fdd); g.fillEllipse(cx, hy+sz*0.02, sz*0.4, sz*0.08);
    g.fillStyle(acc); g.fillCircle(cx, hy-sz*0.14, sz*0.04);
    // Face
    g.fillStyle(0xc8a870); g.fillCircle(cx, hy, sz*0.13);
    g.fillStyle(acc); g.fillCircle(cx-sz*0.04, hy-sz*0.01, sz*0.025); g.fillCircle(cx+sz*0.04, hy-sz*0.01, sz*0.025);
    // Staff with crystal
    this._stick(g, cx+sz*0.3, sz*0.05, cx+sz*0.3, sz*0.84, sz*0.055, e ? 0xaa3311 : 0x6b4a1a);
    g.fillStyle(acc); g.fillCircle(cx+sz*0.3, sz*0.05, sz*0.085);
    g.lineStyle(sz*0.02, 0xffffff, 0.7); g.strokeCircle(cx+sz*0.3, sz*0.05, sz*0.085);
    g.fillStyle(0xffffff); g.fillCircle(cx+sz*0.3-sz*0.02, sz*0.03, sz*0.03);
    // Orbiting particles
    if (!e) {
      for (let i = 0; i < 4; i++) { const a=i/4*Math.PI*2; g.fillStyle(acc); g.fillCircle(cx+Math.cos(a)*sz*0.46, sz/2+Math.sin(a)*sz*0.46, sz*0.03); }
      g.lineStyle(sz*0.03, acc, 0.5); g.strokeCircle(cx, sz/2, sz*0.47);
    }
  }

  // ─── Buildings ────────────────────────────────────────────────────────────

  _createBuildingTextures() {
    const defs = [
      { key: 'town_hall',   fn: this._bldTownHall.bind(this),  sz: 96 },
      { key: 'house',       fn: this._bldHouse.bind(this),     sz: 64 },
      { key: 'barracks',    fn: this._bldBarracks.bind(this),  sz: 64 },
      { key: 'farm',        fn: this._bldFarm.bind(this),      sz: 64 },
      { key: 'mine',        fn: this._bldMine.bind(this),      sz: 64 },
      { key: 'lumber_mill', fn: this._bldLumber.bind(this),    sz: 64 },
      { key: 'market',      fn: this._bldMarket.bind(this),    sz: 64 },
      { key: 'tower',       fn: this._bldTower.bind(this),     sz: 48 },
      { key: 'church',      fn: this._bldChurch.bind(this),    sz: 64 },
      { key: 'stable',      fn: this._bldStable.bind(this),    sz: 64 },
    ];
    for (const d of defs) {
      const g = this.make.graphics({ add: false });
      d.fn(g, d.sz); g.generateTexture(`bld_${d.key}`, d.sz, d.sz); g.destroy();
    }

    // Wall segment (already done inline below)
    const wg = this.make.graphics({ add: false });
    this._bldWall(wg, T); wg.generateTexture('bld_wall', T, T); wg.destroy();

    // Village towers (enemy + captured variant)
    for (const captured of [false, true]) {
      const vg = this.make.graphics({ add: false });
      this._bldVillageTower(vg, 72, captured);
      vg.generateTexture(captured ? 'village_tower_cap' : 'village_tower', 72, 72);
      vg.destroy();
    }
  }

  _bldVillageTower(g, sz, captured) {
    const cx = sz / 2;
    const w = sz * 0.66, h = sz * 0.72;
    const x0 = (sz - w) / 2, y0 = sz * 0.1;

    // Shadow
    g.fillStyle(0x00000040); g.fillRect(x0 + 3, y0 + h + 3, w, 6);

    // Stone walls — dark brownish for enemy, cleaner for captured
    const stoneCol = captured ? 0x8a8a8a : 0x5a4a44;
    g.fillStyle(stoneCol); g.fillRect(x0, y0, w, h);

    // Brick lines
    g.lineStyle(1, 0x00000050);
    for (let row = 0; row < 10; row++) {
      const yy = y0 + row * h / 10;
      const off = row % 2 === 0 ? 0 : sz * 0.09;
      g.beginPath(); g.moveTo(x0, yy); g.lineTo(x0 + w, yy); g.strokePath();
      for (let bx = x0 - off; bx < x0 + w; bx += sz * 0.18) {
        g.beginPath(); g.moveTo(bx, yy); g.lineTo(bx, yy + h / 10); g.strokePath();
      }
    }
    g.lineStyle(2, 0x00000055); g.strokeRect(x0, y0, w, h);

    // Wide crenellations (5 merlons)
    const crenCol = captured ? 0x707070 : 0x443838;
    g.fillStyle(crenCol);
    const crenW = sz * 0.08, crenH = sz * 0.1, gap = (w - 5 * crenW) / 4;
    for (let i = 0; i < 5; i++) {
      g.fillRect(x0 + i * (crenW + gap), y0 - crenH + 2, crenW, crenH);
    }

    // Two arrow slit pairs
    g.fillStyle(0x181818);
    g.fillRect(cx - sz * 0.14, y0 + h * 0.18, sz * 0.07, sz * 0.18);
    g.fillRect(cx + sz * 0.07, y0 + h * 0.18, sz * 0.07, sz * 0.18);
    g.fillRect(cx - sz * 0.04, y0 + h * 0.50, sz * 0.08, sz * 0.16);

    // Flagpole
    const poleX = cx + sz * 0.12;
    g.lineStyle(2, 0x332211, 1);
    g.beginPath(); g.moveTo(poleX, y0 - crenH); g.lineTo(poleX, y0 - sz * 0.38); g.strokePath();

    // Flag
    const flagCol = captured ? 0xffd700 : 0xaa2020;
    g.fillStyle(flagCol);
    g.fillTriangle(poleX, y0 - sz * 0.38, poleX + sz * 0.22, y0 - sz * 0.29, poleX, y0 - sz * 0.20);

    // Captured: white cross on flag
    if (captured) {
      g.fillStyle(0xffffff, 0.85);
      g.fillRect(poleX + sz * 0.04, y0 - sz * 0.36, sz * 0.035, sz * 0.12);
      g.fillRect(poleX + sz * 0.02, y0 - sz * 0.29, sz * 0.10, sz * 0.03);
    }
  }

  _bldBase(g, sz, wallCol, roofCol) {
    const w = sz*0.8, h = sz*0.5, x0 = (sz-w)/2, y0 = sz*0.32;
    // Foundation shadow
    g.fillStyle(0x00000030); g.fillRect(x0+2, y0+h+2, w, 5);
    // Walls
    g.fillStyle(wallCol); g.fillRect(x0, y0, w, h);
    // Brick texture
    const bh = sz*0.07, bw = sz*0.16;
    g.lineStyle(0.8, 0x00000033);
    for (let row = 0; row < Math.ceil(h/bh)+1; row++) {
      const yy = y0 + row*bh; const off = (row%2===0)?0:bw/2;
      g.beginPath(); g.moveTo(x0, yy); g.lineTo(x0+w, yy); g.strokePath();
      for (let bx = x0-off; bx < x0+w; bx += bw) { g.beginPath(); g.moveTo(bx, yy); g.lineTo(bx, yy+bh); g.strokePath(); }
    }
    g.lineStyle(2, 0x00000055); g.strokeRect(x0, y0, w, h);
    // Roof
    g.fillStyle(roofCol);
    g.fillTriangle(sz/2, sz*0.06, x0-4, y0+4, x0+w+4, y0+4);
    g.lineStyle(1, 0x00000044); g.beginPath(); g.moveTo(sz/2, sz*0.06); g.lineTo(x0-4, y0+4); g.moveTo(sz/2, sz*0.06); g.lineTo(x0+w+4, y0+4); g.strokePath();
    return { x0, y0, w, h };
  }

  _bldTownHall(g, sz) {
    // Grand castle building
    const w = sz*0.84, h = sz*0.52, x0 = (sz-w)/2, y0 = sz*0.28;
    // Main shadow
    g.fillStyle(0x00000033); g.fillRect(x0+3, y0+h+3, w, 7);
    // Keep wall
    g.fillStyle(0x8b5e3c); g.fillRect(x0, y0, w, h);
    // Stone texture
    g.lineStyle(0.8, 0x00000044);
    for (let row = 0; row < 7; row++) {
      const yy = y0+row*sz*0.07; const off = row%2===0?0:sz*0.08;
      g.beginPath(); g.moveTo(x0,yy); g.lineTo(x0+w,yy); g.strokePath();
      for (let bx=x0-off; bx<x0+w; bx+=sz*0.16) { g.beginPath(); g.moveTo(bx,yy); g.lineTo(bx,yy+sz*0.07); g.strokePath(); }
    }
    g.lineStyle(2, 0x00000066); g.strokeRect(x0, y0, w, h);
    // Battlements on top
    g.fillStyle(0x6b3a1f);
    for (let i = 0; i < 6; i++) { g.fillRect(x0 + i*(w/5.5), y0 - sz*0.05, sz*0.06, sz*0.06); }
    // Towers at corners
    g.fillStyle(0x7a4f2a); g.fillRect(x0-4, y0, sz*0.14, h+2); g.fillRect(x0+w-sz*0.1, y0, sz*0.14, h+2);
    // Tower battlements
    for (let side of [x0-4, x0+w-sz*0.1]) {
      for (let i = 0; i < 3; i++) { g.fillStyle(0x6b3a1f); g.fillRect(side+i*sz*0.048, y0-sz*0.06, sz*0.03, sz*0.06); }
    }
    // Roof (darker)
    g.fillStyle(0x4a2a0f); g.fillTriangle(sz/2, sz*0.02, x0-8, y0+4, x0+w+8, y0+4);
    // Banner
    g.fillStyle(0xcc1111); g.fillRect(sz/2-2, 0, 4, sz*0.14);
    g.fillStyle(0xdd2222); g.fillTriangle(sz/2-2, 0, sz/2+14, sz*0.06, sz/2-2, sz*0.12);
    // Gate
    g.fillStyle(0x2a1808); g.fillRect(sz/2-8, y0+h-22, 16, 22);
    g.fillStyle(0x4a2810); g.fillEllipse(sz/2, y0+h-22, 16, 10);
    // Windows
    g.fillStyle(0xfffacc); g.fillRect(x0+12, y0+10, 10, 12); g.fillRect(x0+w-22, y0+10, 10, 12);
  }

  _bldHouse(g, sz) {
    const { x0, y0, w, h } = this._bldBase(g, sz, 0xcd9d5a, 0x993322);
    // Chimney
    g.fillStyle(0x9a7040); g.fillRect(x0+w*0.65, y0-sz*0.12, sz*0.07, sz*0.14);
    g.fillStyle(0x6a4a20); g.fillRect(x0+w*0.63, y0-sz*0.14, sz*0.11, sz*0.04);
    // Door + windows
    g.fillStyle(0x3a2010); g.fillRect(sz/2-5, y0+h-18, 10, 18);
    g.fillStyle(0x4a3020); g.fillEllipse(sz/2, y0+h-18, 10, 8);
    g.fillStyle(0xfffacc); g.fillRect(x0+8, y0+8, 10, 10); g.fillRect(x0+w-18, y0+8, 10, 10);
    g.lineStyle(1, 0x6b4a20); g.strokeRect(x0+8, y0+8, 10, 10); g.strokeRect(x0+w-18, y0+8, 10, 10);
    // Cross beams on windows
    g.beginPath(); g.moveTo(x0+13, y0+8); g.lineTo(x0+13, y0+18); g.strokePath();
    g.beginPath(); g.moveTo(x0+8, y0+13); g.lineTo(x0+18, y0+13); g.strokePath();
  }

  _bldBarracks(g, sz) {
    const { x0, y0, w, h } = this._bldBase(g, sz, 0x5a5a5a, 0x333333);
    // Arrow slits
    for (let i = 0; i < 3; i++) {
      g.fillStyle(0x111111); g.fillRect(x0+6+i*(w/3), y0+6, 4, 14);
    }
    // Battlements
    g.fillStyle(0x444444);
    for (let i = 0; i < 5; i++) { g.fillRect(x0+i*(w/4.5), y0-sz*0.06, sz*0.06, sz*0.06); }
    // Crossed swords emblem
    g.lineStyle(2, 0xcc3333);
    g.beginPath(); g.moveTo(sz/2-8, y0+h-18); g.lineTo(sz/2+8, y0+h-4); g.strokePath();
    g.beginPath(); g.moveTo(sz/2+8, y0+h-18); g.lineTo(sz/2-8, y0+h-4); g.strokePath();
    // Heavy gate
    g.fillStyle(0x2a1a0a); g.fillRect(sz/2-7, y0+h-22, 14, 22);
    g.fillStyle(0xcc8833); g.fillCircle(sz/2+3, y0+h-12, 2); // door handle
  }

  _bldFarm(g, sz) {
    const { x0, y0, w, h } = this._bldBase(g, sz, 0xd4aa44, 0xa08030);
    // Hay bales at sides
    g.fillStyle(0xd4aa44); g.fillEllipse(x0-5, y0+h-8, 12, 10); g.fillEllipse(x0+w+5, y0+h-8, 12, 10);
    g.lineStyle(1, 0xa08030);
    g.beginPath(); g.moveTo(x0-10, y0+h-8); g.lineTo(x0, y0+h-8); g.strokePath();
    g.beginPath(); g.moveTo(x0+w, y0+h-8); g.lineTo(x0+w+10, y0+h-8); g.strokePath();
    // Barn door (wide double)
    g.fillStyle(0x7a5520); g.fillRect(sz/2-10, y0+h-22, 20, 22);
    g.lineStyle(2, 0x5a3a10); g.beginPath(); g.moveTo(sz/2, y0+h-22); g.lineTo(sz/2, y0+h); g.strokePath();
    // Wheat symbol
    g.lineStyle(2, 0xffd700); g.beginPath(); g.moveTo(sz/2-4, y0+6); g.lineTo(sz/2-4, y0+16); g.strokePath();
    g.beginPath(); g.moveTo(sz/2+4, y0+6); g.lineTo(sz/2+4, y0+16); g.strokePath();
    // Window
    g.fillStyle(0xfffacc); g.fillRect(x0+6, y0+8, 9, 9); g.fillRect(x0+w-15, y0+8, 9, 9);
  }

  _bldMine(g, sz) {
    // Rock-face entrance style
    const x0 = sz*0.08, y0 = sz*0.25, w = sz*0.84, h = sz*0.56;
    g.fillStyle(0x00000030); g.fillRect(x0+2, y0+h+2, w, 5);
    // Stone base
    g.fillStyle(0x787060); g.fillRect(x0, y0, w, h);
    // Rocky texture
    g.fillStyle(0x888070); g.fillRect(x0+4, y0+4, w*0.4, h*0.4);
    g.fillStyle(0x686058); g.fillRect(x0+w*0.5, y0+8, w*0.44, h*0.36);
    // Mine entrance arch
    g.fillStyle(0x1a1008); g.fillRect(sz/2-10, y0+h-26, 20, 26);
    g.fillStyle(0x1a1008); g.fillEllipse(sz/2, y0+h-26, 20, 14);
    // Support beams
    g.lineStyle(2, 0x7a5a20);
    g.beginPath(); g.moveTo(sz/2-12, y0+h); g.lineTo(sz/2-12, y0+h-30); g.strokePath();
    g.beginPath(); g.moveTo(sz/2+12, y0+h); g.lineTo(sz/2+12, y0+h-30); g.strokePath();
    g.beginPath(); g.moveTo(sz/2-14, y0+h-28); g.lineTo(sz/2+14, y0+h-28); g.strokePath();
    // Pick axes
    g.lineStyle(2, 0x8B6914); g.beginPath(); g.moveTo(x0+10, y0+10); g.lineTo(x0+20, y0+24); g.strokePath();
    g.lineStyle(2, 0x8B6914); g.beginPath(); g.moveTo(x0+w-10, y0+10); g.lineTo(x0+w-20, y0+24); g.strokePath();
    // Triangular rocky roof
    g.fillStyle(0x6a6050); g.fillTriangle(sz/2, y0-sz*0.1, x0-4, y0+6, x0+w+4, y0+6);
  }

  _bldLumber(g, sz) {
    const { x0, y0, w, h } = this._bldBase(g, sz, 0x7a5c30, 0x4a3010);
    // Saw wheel (left side)
    g.fillStyle(0x5a4020); g.fillCircle(x0-2, y0+h*0.5, sz*0.12);
    g.lineStyle(2, 0x8B6914);
    for (let a = 0; a < 8; a++) { const ang = a*Math.PI/4; g.beginPath(); g.moveTo(x0-2, y0+h*0.5); g.lineTo(x0-2+Math.cos(ang)*sz*0.12, y0+h*0.5+Math.sin(ang)*sz*0.12); g.strokePath(); }
    // Log pile (right side)
    for (let i = 0; i < 3; i++) {
      g.fillStyle(0x9a7040); g.fillRect(x0+w-2, y0+h-12-i*8, sz*0.18, 6);
      g.fillStyle(0x6a5030); g.fillEllipse(x0+w-2, y0+h-9-i*8, 7, 6);
    }
    // Door + window
    g.fillStyle(0x2a1808); g.fillRect(sz/2-5, y0+h-18, 10, 18);
    g.fillStyle(0xfffacc); g.fillRect(x0+8, y0+8, 9, 9);
    // Blade
    g.lineStyle(1.5, 0xcccccc); g.beginPath(); g.moveTo(x0+4, y0+h*0.4); g.lineTo(x0+22, y0+h*0.4); g.strokePath();
  }

  _bldMarket(g, sz) {
    const { x0, y0, w, h } = this._bldBase(g, sz, 0xdaa520, 0xa07a10);
    // Awning / canopy (colorful)
    const stripes = [0xdd2222, 0xffd700, 0xdd2222, 0xffd700, 0xdd2222, 0xffd700];
    const sw = w / stripes.length;
    for (let i = 0; i < stripes.length; i++) {
      g.fillStyle(stripes[i]);
      g.fillTriangle(x0+i*sw, y0, x0+(i+1)*sw, y0, x0+(i+0.5)*sw, y0-sz*0.14);
    }
    g.fillStyle(0xcc8800); g.fillRect(x0, y0, w, sz*0.04); // awning rail
    // Display stand
    g.fillStyle(0xc8960c); g.fillRect(sz/2-12, y0+h-16, 24, 8);
    // Coins on stand
    g.fillStyle(0xffd700); g.fillCircle(sz/2-4, y0+h-14, 3); g.fillCircle(sz/2+4, y0+h-14, 3); g.fillCircle(sz/2, y0+h-14, 3);
    // Door
    g.fillStyle(0x3a2010); g.fillRect(sz/2-5, y0+h-20, 10, 20);
    // Windows
    g.fillStyle(0xfffacc); g.fillRect(x0+6, y0+8, 9, 10); g.fillRect(x0+w-15, y0+8, 9, 10);
  }

  _bldTower(g, sz) {
    const cx = sz/2, w = sz*0.56, h = sz*0.68, x0 = (sz-w)/2, y0 = sz*0.1;
    g.fillStyle(0x00000033); g.fillRect(x0+2, y0+h+2, w, 5);
    g.fillStyle(0xa0a0a0); g.fillRect(x0, y0, w, h);
    // Stone texture
    g.lineStyle(0.8, 0x00000033);
    for (let row = 0; row < 9; row++) {
      const yy = y0+row*sz*0.075; const off = row%2===0?0:sz*0.08;
      g.beginPath(); g.moveTo(x0,yy); g.lineTo(x0+w,yy); g.strokePath();
      for (let bx=x0-off; bx<x0+w; bx+=sz*0.16) { g.beginPath(); g.moveTo(bx,yy); g.lineTo(bx,yy+sz*0.075); g.strokePath(); }
    }
    g.lineStyle(2, 0x00000055); g.strokeRect(x0, y0, w, h);
    // Crenellations
    g.fillStyle(0x888888);
    for (let i = 0; i < 4; i++) { g.fillRect(x0+i*(w/3.5), y0-sz*0.08, sz*0.08, sz*0.08); }
    // Arrow slits
    g.fillStyle(0x222222); g.fillRect(cx-2, y0+sz*0.12, 4, 14); g.fillRect(cx-2, y0+sz*0.34, 4, 14);
    // Conical roof
    g.fillStyle(0x606060); g.fillTriangle(cx, y0-sz*0.22, x0-4, y0+2, x0+w+4, y0+2);
    g.fillStyle(0x444444); g.fillCircle(cx, y0-sz*0.22, sz*0.03);
  }

  _bldChurch(g, sz) {
    const { x0, y0, w, h } = this._bldBase(g, sz, 0xe8e0d0, 0x8b6914);
    // Gothic pointed arches (windows)
    g.fillStyle(0xfffacc);
    // Left arch
    g.fillRect(x0+6, y0+8, 9, 14);
    g.fillTriangle(x0+6, y0+8, x0+15, y0+8, x0+10, y0);
    // Right arch
    g.fillRect(x0+w-15, y0+8, 9, 14);
    g.fillTriangle(x0+w-15, y0+8, x0+w-6, y0+8, x0+w-10, y0);
    // Cross (prominent)
    g.fillStyle(0xc8960c);
    g.fillRect(sz/2-2, y0-sz*0.22, 4, sz*0.28); // vertical
    g.fillRect(sz/2-10, y0-sz*0.1, 20, 4);     // horizontal
    // Door (arched)
    g.fillStyle(0x3a2010); g.fillRect(sz/2-6, y0+h-24, 12, 24);
    g.fillStyle(0x3a2010); g.fillEllipse(sz/2, y0+h-24, 12, 10);
    // Bell tower hint
    g.fillStyle(0xd0c8b8); g.fillRect(sz/2-4, y0-sz*0.04, 8, sz*0.06);
  }

  _bldStable(g, sz) {
    const { x0, y0, w, h } = this._bldBase(g, sz, 0x9a7a50, 0x6a4a20);
    // Open sides (fence posts)
    for (let i = 0; i < 3; i++) {
      g.fillStyle(0x8b6040); g.fillRect(x0-3, y0+i*12, 4, 10); g.fillRect(x0+w-1, y0+i*12, 4, 10);
    }
    g.lineStyle(2, 0x8b6040);
    g.beginPath(); g.moveTo(x0-1, y0+4); g.lineTo(x0+7, y0+4); g.strokePath();
    g.beginPath(); g.moveTo(x0-1, y0+14); g.lineTo(x0+7, y0+14); g.strokePath();
    // Horse silhouette (simplified)
    g.fillStyle(0x5a3a20); g.fillEllipse(sz/2, y0+h*0.5, sz*0.3, sz*0.22); // body
    g.fillCircle(sz/2+sz*0.16, y0+h*0.5-sz*0.08, sz*0.08); // head
    g.fillRect(sz/2+sz*0.2, y0+h*0.5-sz*0.16, sz*0.04, sz*0.1); // neck
    // Mane
    g.fillStyle(0x2a1808); g.fillRect(sz/2+sz*0.14, y0+h*0.5-sz*0.18, sz*0.08, sz*0.04);
    // Door
    g.fillStyle(0x4a2810); g.fillRect(sz/2-6, y0+h-18, 12, 18);
    g.lineStyle(2, 0x8b6040); g.beginPath(); g.moveTo(sz/2, y0+h-18); g.lineTo(sz/2, y0+h); g.strokePath();
  }

  _bldWall(g, sz) {
    g.fillStyle(0x808070); g.fillRect(0, 0, sz, sz);
    g.fillStyle(0x999880); g.fillRect(2, 2, sz-4, sz/2-2);
    g.fillStyle(0x999880); g.fillRect(2, sz/2+2, sz-4, sz/2-4);
    g.lineStyle(2, 0x555548); g.strokeRect(1, 1, sz-2, sz-2);
    g.lineStyle(1, 0x555548, 0.6);
    g.beginPath(); g.moveTo(0, sz/2); g.lineTo(sz, sz/2);
    g.moveTo(sz/2, 0); g.lineTo(sz/2, sz/2);
    g.moveTo(sz/4, sz/2); g.lineTo(sz/4, sz);
    g.moveTo(3*sz/4, sz/2); g.lineTo(3*sz/4, sz);
    g.strokePath();
  }

  // ─── NPC Textures ─────────────────────────────────────────────────────────

  _createNPCTextures() {
    const npcs = [
      { key: 'ermite',   col: 0x8b6914, acc: 0xd4aa44 },
      { key: 'marchand', col: 0xd4690a, acc: 0xffd700 },
      { key: 'ancien',   col: 0x668866, acc: 0xaaddaa },
      { key: 'scout',    col: 0x4a5a3a, acc: 0xaabbaa },
      { key: 'pretre',   col: 0xe8e8e0, acc: 0xffd700 },
      { key: 'seigneur', col: 0x5a3a8a, acc: 0xffd700 },
    ];
    for (const d of npcs) {
      const g = this.make.graphics({ add: false });
      this._drawNPC(g, 36, d.col, d.acc, d.key); g.generateTexture(`npc_${d.key}`, 36, 36); g.destroy();
    }
  }

  _drawNPC(g, sz, col, acc, type) {
    const cx = sz/2, cy = sz*0.6, hy = cy-sz*0.32;
    g.fillStyle(0x00000022); g.fillEllipse(cx, sz*0.9, sz*0.5, sz*0.1);
    // Robe
    g.fillStyle(col); g.fillTriangle(cx, cy-sz*0.22, cx-sz*0.18, sz*0.82, cx+sz*0.18, sz*0.82);
    g.fillRect(cx-sz*0.12, cy-sz*0.22, sz*0.24, sz*0.28);
    // Head
    g.fillStyle(C.SKIN); g.fillCircle(cx, hy, sz*0.12);
    if (type === 'ermite') {
      g.fillStyle(col); g.fillCircle(cx, hy, sz*0.15); // hood
      g.fillStyle(C.SKIN); g.fillCircle(cx, hy+sz*0.03, sz*0.09);
      this._stick(g, cx+sz*0.2, hy, cx+sz*0.2, sz*0.84, 2, 0x8b6914);
    } else if (type === 'marchand') {
      g.fillStyle(acc); g.fillEllipse(cx, hy-sz*0.08, sz*0.3, sz*0.08);
      g.fillStyle(col); g.fillTriangle(cx, hy-sz*0.26, cx-sz*0.1, hy-sz*0.06, cx+sz*0.1, hy-sz*0.06);
      g.fillStyle(0x8b6914); g.fillRect(cx+sz*0.1, cy+sz*0.04, sz*0.1, sz*0.1);
    } else if (type === 'ancien') {
      g.lineStyle(2, acc); g.strokeCircle(cx, hy, sz*0.14);
      this._stick(g, cx-sz*0.2, hy, cx-sz*0.2, sz*0.82, 2, acc);
      g.fillStyle(acc); g.fillCircle(cx-sz*0.2, hy, sz*0.04);
    } else if (type === 'pretre') {
      g.fillStyle(col); g.fillCircle(cx, hy, sz*0.15);
      g.fillStyle(C.SKIN); g.fillCircle(cx, hy+sz*0.04, sz*0.08);
      g.fillStyle(acc); g.fillRect(cx-sz*0.01, cy-sz*0.2, sz*0.03, sz*0.16);
      g.fillRect(cx-sz*0.06, cy-sz*0.14, sz*0.12, sz*0.03);
    } else if (type === 'seigneur') {
      g.fillStyle(col); g.fillRect(cx-sz*0.12, hy-sz*0.22, sz*0.24, sz*0.18);
      g.fillStyle(acc); g.fillRect(cx-sz*0.12, hy-sz*0.22, sz*0.24, sz*0.04);
    } else if (type === 'scout') {
      g.fillStyle(col); g.fillCircle(cx, hy, sz*0.14);
      g.fillStyle(C.SKIN_DARK); g.fillCircle(cx, hy+sz*0.02, sz*0.08);
    }
  }

  // ─── UI textures ──────────────────────────────────────────────────────────

  _createUITextures() {
    const sg = this.make.graphics({ add: false });
    sg.lineStyle(2, 0xffee22, 0.85); sg.strokeCircle(22, 22, 20);
    sg.lineStyle(1, 0xffee22, 0.4); sg.strokeCircle(22, 22, 22);
    sg.generateTexture('selection_ring', 44, 44); sg.destroy();
  }
}