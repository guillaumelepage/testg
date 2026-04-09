import Phaser from 'phaser';

const T = 48;

const C = {
  GRASS: 0x5a9e42, GRASS_MID: 0x4a8c35, GRASS_DARK: 0x3a7028,
  WATER: 0x2060a8, WATER_MID: 0x3478c0, WATER_LIGHT: 0x5a9ad8, WATER_FOAM: 0xbcddee,
  SAND: 0xd6ba6c, SAND_DARK: 0xb89840, SAND_LIGHT: 0xe8d08a,
  FOREST: 0x224e14, FOREST_MID: 0x316620, FOREST_LIGHT: 0x42802c, FOREST_TRUNK: 0x6b3e18,
  MOUNTAIN: 0x8a7a68, MOUNTAIN_LIGHT: 0xb0a090, MOUNTAIN_DARK: 0x5a4e40, MOUNTAIN_SNOW: 0xeeeedd,
  DIRT: 0xa07850, DIRT_DARK: 0x7a5830, DIRT_LIGHT: 0xc09868,
  SKIN: 0xd4a87a, SKIN_DARK: 0xb88858,
  STONE: 0x8e8278, STONE_DARK: 0x5e5650, STONE_LIGHT: 0xb8b0a8,
  WOOD: 0x9a6e38, WOOD_DARK: 0x6a4818, WOOD_LIGHT: 0xc49050,
  ROOF_RED: 0x8a2a14, ROOF_DARK: 0x3a2010,
  GOLD: 0xffd700, GOLD_DARK: 0xc8960c,
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
    // Base coat
    g.fillStyle(C.GRASS_MID); g.fillRect(0, 0, T, T);
    // Darker patches for variation
    g.fillStyle(C.GRASS_DARK);
    g.fillRect(0, 0, 18, 16); g.fillRect(30, 28, 18, 20); g.fillRect(8, 36, 14, 12);
    // Lighter highlights
    g.fillStyle(C.GRASS);
    g.fillRect(20, 4, 22, 14); g.fillRect(2, 22, 16, 10); g.fillRect(34, 10, 14, 18);
    // Grass tufts — pairs of short strokes
    g.fillStyle(C.GRASS_DARK);
    const tufts = [[4,8],[14,18],[26,6],[38,14],[10,30],[32,38],[44,26],[20,40],[6,44]];
    for (const [x,y] of tufts) {
      g.fillRect(x, y, 2, 5); g.fillRect(x+3, y+1, 2, 4); g.fillRect(x+6, y, 2, 5);
    }
    g.fillStyle(0x70c050, 0.35);
    g.fillRect(22, 22, 4, 6); g.fillRect(10, 10, 3, 5); g.fillRect(38, 36, 3, 5);
  }
  _drawDarkGrass(g) {
    g.fillStyle(C.GRASS_DARK); g.fillRect(0, 0, T, T);
    // Mossy patches
    g.fillStyle(0x2e5e1e); g.fillRect(4, 4, 14, 10); g.fillRect(26, 20, 18, 12); g.fillRect(8, 32, 16, 14);
    g.fillStyle(C.GRASS_MID); g.fillRect(10, 8, 8, 6); g.fillRect(30, 24, 10, 7); g.fillRect(14, 36, 8, 7);
    // Tufts
    g.fillStyle(C.FOREST_MID);
    const t2 = [[6,14],[18,6],[36,8],[42,24],[4,38],[28,38],[20,26]];
    for (const [x,y] of t2) { g.fillRect(x,y,2,6); g.fillRect(x+4,y+2,2,5); }
  }
  _drawWater(g) {
    g.fillStyle(C.WATER); g.fillRect(0, 0, T, T);
    // Depth variation
    g.fillStyle(C.WATER_MID); g.fillRect(0, 0, T, 18); g.fillRect(0, 32, T, 16);
    // Wave bands
    g.fillStyle(C.WATER_LIGHT, 0.7);
    g.fillRect(2, 10, 22, 3); g.fillRect(28, 22, 18, 3); g.fillRect(4, 36, 26, 3);
    // Foam dots
    g.fillStyle(C.WATER_FOAM, 0.5);
    for (const [x,y] of [[6,12],[18,11],[34,23],[10,37],[40,37],[26,9]]) { g.fillCircle(x,y,2); }
    // Dark depth patches
    g.fillStyle(C.WATER, 0.6); g.fillRect(14, 18, 20, 12);
  }
  _drawSand(g) {
    g.fillStyle(C.SAND); g.fillRect(0, 0, T, T);
    // Shading patches
    g.fillStyle(C.SAND_DARK); g.fillRect(0, 0, 16, 14); g.fillRect(32, 30, 16, 18); g.fillRect(10, 36, 14, 12);
    g.fillStyle(C.SAND_LIGHT); g.fillRect(18, 6, 20, 12); g.fillRect(4, 22, 14, 10); g.fillRect(34, 14, 14, 16);
    // Pebble dots
    g.fillStyle(C.SAND_DARK);
    for (const [x,y,r] of [[8,8,2],[24,16,1],[38,10,2],[14,28,1],[42,32,1],[6,40,2],[28,42,1],[20,34,2]]) g.fillCircle(x,y,r);
    g.fillStyle(C.SAND_LIGHT);
    for (const [x,y] of [[10,6],[26,14],[40,8],[16,26],[44,30],[8,38],[30,40]]) g.fillCircle(x,y,1);
  }
  _drawForest(g) {
    // Ground
    g.fillStyle(C.GRASS_DARK); g.fillRect(0, 0, T, T);
    g.fillStyle(0x1c3c10); g.fillRect(4, 28, T-8, T-28);
    // Trunk
    g.fillStyle(C.FOREST_TRUNK); g.fillRect(T/2-3, T/2+6, 7, 14);
    g.fillStyle(C.WOOD_DARK); g.fillRect(T/2-3, T/2+6, 3, 14);
    // Canopy — back to front for depth (pine style from reference)
    g.fillStyle(C.FOREST); g.fillCircle(T/2+8, T/2+6, 10);      // back right
    g.fillStyle(C.FOREST); g.fillCircle(T/2-8, T/2+4, 11);      // back left
    g.fillStyle(C.FOREST_MID); g.fillCircle(T/2+4, T/2, 13);    // mid right
    g.fillStyle(C.FOREST_MID); g.fillCircle(T/2-5, T/2-2, 12);  // mid left
    g.fillStyle(C.FOREST_LIGHT); g.fillCircle(T/2, T/2-6, 13);  // front top
    g.fillStyle(0x5a9a38, 0.7); g.fillCircle(T/2-3, T/2-10, 8); // highlight
    // Pine tip
    g.fillStyle(C.FOREST_MID); g.fillTriangle(T/2, 4, T/2-7, 18, T/2+7, 18);
    g.fillStyle(C.FOREST_LIGHT); g.fillTriangle(T/2, 6, T/2-4, 16, T/2+4, 16);
  }
  _drawMountain(g) {
    g.fillStyle(C.GRASS_DARK); g.fillRect(0, 0, T, T);
    // Rock rubble at base
    g.fillStyle(C.MOUNTAIN_DARK);
    g.fillRect(2, T-10, 12, 8); g.fillRect(34, T-10, 12, 8);
    // Back peak (smaller, behind)
    g.fillStyle(C.MOUNTAIN_DARK); g.fillTriangle(T/2+10, 8, T-2, T-8, T-2, T-8);
    g.fillStyle(C.MOUNTAIN); g.fillTriangle(T/2+10, 8, T*0.58, T-8, T-2, T-8);
    // Main peak
    g.fillStyle(C.MOUNTAIN_DARK); g.fillTriangle(T/2, 2, 4, T-7, T-4, T-7);
    g.fillStyle(C.MOUNTAIN); g.fillTriangle(T/2+2, 2, T/2+2, T-7, T-4, T-7); // lit face
    // Rock face cracks
    g.lineStyle(1, C.MOUNTAIN_DARK, 0.6);
    g.beginPath(); g.moveTo(T/2-3, 24); g.lineTo(T/2-8, 36); g.lineTo(T/2-4, T-8); g.strokePath();
    g.beginPath(); g.moveTo(T/2+4, 28); g.lineTo(T/2+8, 40); g.strokePath();
    // Snow cap
    g.fillStyle(C.MOUNTAIN_SNOW); g.fillTriangle(T/2, 2, T/2-10, 22, T/2+10, 22);
    g.fillStyle(0xffffff, 0.6); g.fillTriangle(T/2, 2, T/2-4, 16, T/2+4, 16);
    // Light on right face
    g.fillStyle(C.MOUNTAIN_LIGHT, 0.4); g.fillTriangle(T/2, 22, T/2+10, 22, T-4, T-7);
  }
  _drawDirt(g) {
    g.fillStyle(C.DIRT); g.fillRect(0, 0, T, T);
    // Variation patches
    g.fillStyle(C.DIRT_DARK); g.fillRect(0, 0, 14, 16); g.fillRect(28, 24, 20, 16); g.fillRect(6, 34, 16, 14);
    g.fillStyle(C.DIRT_LIGHT); g.fillRect(16, 4, 18, 12); g.fillRect(2, 22, 14, 10); g.fillRect(34, 6, 14, 18);
    // Cracked earth lines
    g.lineStyle(1, C.DIRT_DARK, 0.7);
    g.beginPath(); g.moveTo(10, 10); g.lineTo(20, 22); g.lineTo(16, 36); g.strokePath();
    g.beginPath(); g.moveTo(30, 4); g.lineTo(38, 18); g.strokePath();
    g.beginPath(); g.moveTo(6, 40); g.lineTo(22, 44); g.strokePath();
    // Pebbles
    g.fillStyle(C.DIRT_DARK);
    for (const [x,y] of [[12,14],[34,28],[8,36],[40,12],[24,38],[44,40]]) g.fillCircle(x,y,2);
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
    g.fillStyle(0x00000038); g.fillEllipse(cx+sz*0.04, cy + sz*0.38, sz*0.62, sz*0.14);
  }
  _head(g, cx, hy, r, skinCol) {
    // Slight shadow behind head for depth
    g.fillStyle(0x00000028); g.fillCircle(cx+1, hy+1, r+1);
    g.fillStyle(skinCol || C.SKIN); g.fillCircle(cx, hy, r);
    // subtle highlight
    g.fillStyle(0xffffff, 0.18); g.fillCircle(cx-r*0.3, hy-r*0.3, r*0.35);
  }
  _stick(g, x1, y1, x2, y2, thick, col) {
    g.lineStyle(thick, col); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.strokePath();
  }
  _shield(g, cx, cy, w, h, mainCol, emblemCol) {
    // Kite shield shape
    g.fillStyle(0x00000030); g.fillRect(cx-w/2+2, cy-h/2+2, w, h);
    g.fillStyle(mainCol);
    g.fillRect(cx-w/2, cy-h/2, w, h*0.7);
    g.fillTriangle(cx-w/2, cy-h/2+h*0.7, cx+w/2, cy-h/2+h*0.7, cx, cy+h/2);
    if (emblemCol) {
      g.fillStyle(emblemCol);
      // horizontal bar
      g.fillRect(cx-w*0.3, cy-h*0.05, w*0.6, h*0.1);
      // vertical bar
      g.fillRect(cx-w*0.08, cy-h*0.3, w*0.16, h*0.6);
    }
    g.lineStyle(1, 0x00000060); g.strokeRect(cx-w/2, cy-h/2, w, h*0.7);
  }

  // ── Paysan ────────────────────────────────────────────────────────────────
  _unitPaysan(g, sz, e) {
    const cx = sz/2, cy = sz*0.60, hy = cy - sz*0.30;
    const tunic = e ? 0xaa2211 : 0x9a6b38;
    const tunic2 = e ? 0xcc3322 : 0xb88050;
    this._shadow(g, cx, cy, sz);
    // Body — tunic with slight taper
    g.fillStyle(tunic); g.fillEllipse(cx, cy+sz*0.04, sz*0.42, sz*0.44);
    g.fillStyle(tunic2); g.fillEllipse(cx, cy-sz*0.10, sz*0.32, sz*0.28);
    // Belt
    g.fillStyle(e ? 0x881100 : 0x5a3a10); g.fillRect(cx-sz*0.20, cy+sz*0.03, sz*0.40, sz*0.06);
    // Head + hat
    this._head(g, cx, hy, sz*0.13, e ? 0xdd4433 : C.SKIN);
    g.fillStyle(e ? 0x993311 : 0xc8a030);
    g.fillTriangle(cx, hy-sz*0.25, cx-sz*0.13, hy-sz*0.02, cx+sz*0.13, hy-sz*0.02);
    g.fillEllipse(cx, hy-sz*0.04, sz*0.36, sz*0.09);
    // Pitchfork — shaft + 3 tines
    this._stick(g, cx+sz*0.22, hy, cx+sz*0.22, sz*0.86, sz*0.04, e ? 0x882211 : 0x7a4a20);
    g.lineStyle(sz*0.03, e ? 0x882211 : 0x6b3a10);
    for (const dx of [-sz*0.05, 0, sz*0.05]) {
      g.beginPath(); g.moveTo(cx+sz*0.22+dx, hy-sz*0.04); g.lineTo(cx+sz*0.22+dx, hy+sz*0.07); g.strokePath();
    }
    // Arm hint
    g.fillStyle(tunic); g.fillEllipse(cx+sz*0.18, cy-sz*0.06, sz*0.14, sz*0.08);
  }

  // ── Homme d'Armes ─────────────────────────────────────────────────────────
  _unitHommeArmes(g, sz, e) {
    const cx = sz/2, cy = sz*0.58, hy = cy - sz*0.33;
    const armor = e ? 0xaa2211 : 0x707070;
    const dark  = e ? 0x881100 : 0x3e3e3e;
    const acc   = e ? 0xff5555 : 0xcc2222;
    this._shadow(g, cx, cy, sz);
    // Spear (behind body)
    this._stick(g, cx+sz*0.26, sz*0.04, cx+sz*0.26, sz*0.84, sz*0.04, e ? 0xaa3311 : C.WOOD);
    g.fillStyle(e ? 0xff5544 : C.STONE_LIGHT);
    g.fillTriangle(cx+sz*0.26, sz*0.02, cx+sz*0.20, sz*0.13, cx+sz*0.32, sz*0.13);
    // Shield left
    this._shield(g, cx-sz*0.28, cy-sz*0.06, sz*0.20, sz*0.30, e ? 0x881100 : 0x2a2a80, acc);
    // Armoured body
    g.fillStyle(armor); g.fillRoundedRect(cx-sz*0.15, cy-sz*0.26, sz*0.30, sz*0.46, sz*0.03);
    g.fillStyle(0xffffff,0.12); g.fillRect(cx-sz*0.13, cy-sz*0.26, sz*0.10, sz*0.44); // lit left face
    // Waist band
    g.fillStyle(dark); g.fillRect(cx-sz*0.15, cy+sz*0.06, sz*0.30, sz*0.05);
    // Helmet
    g.fillStyle(armor); g.fillCircle(cx, hy, sz*0.16);
    g.fillStyle(dark); g.fillRect(cx-sz*0.13, hy-sz*0.02, sz*0.26, sz*0.07); // visor
    g.fillStyle(acc); g.fillRect(cx-sz*0.02, hy-sz*0.16, sz*0.04, sz*0.07); // nasal
  }

  // ── Archer ────────────────────────────────────────────────────────────────
  _unitArcher(g, sz, e) {
    const cx = sz/2, cy = sz*0.58, hy = cy - sz*0.32;
    const body = e ? 0xaa2211 : 0x3a6a28;
    const hood = e ? 0xbb3322 : 0x245a1e;
    const acc  = e ? 0xff5544 : 0xc87d2a;
    this._shadow(g, cx, cy, sz);
    // Bow (left, drawn arc)
    const bx=cx-sz*0.30, bTop=cy-sz*0.26, bBot=cy+sz*0.24;
    g.lineStyle(sz*0.05, e ? 0x882211 : 0x6b3a1a);
    g.beginPath();
    for (let i=0; i<=10; i++) { const t=i/10; const ay=bTop+(bBot-bTop)*t; const ax=bx-Math.sin(t*Math.PI)*sz*0.11; if(i===0)g.moveTo(ax,ay); else g.lineTo(ax,ay); }
    g.strokePath();
    // Bowstring
    g.lineStyle(sz*0.018, 0xd8c888);
    g.beginPath(); g.moveTo(bx,bTop); g.lineTo(bx+sz*0.06,(bTop+bBot)/2); g.lineTo(bx,bBot); g.strokePath();
    // Nocked arrow
    this._stick(g, bx+sz*0.05, cy-sz*0.04, cx+sz*0.22, cy-sz*0.04, sz*0.025, 0xd4aa44);
    g.fillStyle(0xb0b0b0); g.fillTriangle(cx+sz*0.22, cy-sz*0.04, cx+sz*0.16, cy-sz*0.08, cx+sz*0.16, cy);
    // Body (leather with highlight)
    g.fillStyle(body); g.fillEllipse(cx, cy, sz*0.36, sz*0.46);
    g.fillStyle(e ? 0xcc3322 : 0x4a8038); g.fillEllipse(cx, cy-sz*0.10, sz*0.26, sz*0.26);
    g.fillStyle(0xffffff,0.10); g.fillEllipse(cx-sz*0.06, cy-sz*0.14, sz*0.12, sz*0.18); // highlight
    // Quiver
    g.fillStyle(acc); g.fillRect(cx+sz*0.16, cy-sz*0.24, sz*0.09, sz*0.28);
    g.fillStyle(0xd4aa44); for (let i=0; i<3; i++) g.fillRect(cx+sz*0.18+i*sz*0.025, cy-sz*0.34, sz*0.02, sz*0.13);
    // Hood
    g.fillStyle(hood); g.fillCircle(cx, hy, sz*0.16);
    g.fillTriangle(cx, hy-sz*0.22, cx-sz*0.14, hy+sz*0.06, cx+sz*0.14, hy+sz*0.06);
    g.fillStyle(e ? 0xdd4433 : C.SKIN); g.fillEllipse(cx, hy+sz*0.03, sz*0.10, sz*0.09);
  }

  // ── Chevalier ─────────────────────────────────────────────────────────────
  _unitChevalier(g, sz, e) {
    const cx = sz/2, cy = sz*0.58, hy = cy - sz*0.34;
    const armor = e ? 0xaa2211 : 0x5878b8;
    const dark  = e ? 0x880000 : 0x2a4898;
    const metal = e ? 0xcc3322 : 0x8898cc;
    const acc   = C.GOLD;
    this._shadow(g, cx, cy, sz);
    // Sword behind body
    this._stick(g, cx+sz*0.20, cy-sz*0.30, cx+sz*0.36, cy+sz*0.32, sz*0.07, e ? 0xdd4433 : 0xd0d0d0);
    g.fillStyle(acc); g.fillRect(cx+sz*0.20, cy-sz*0.04, sz*0.22, sz*0.05); // crossguard
    g.fillStyle(acc); g.fillCircle(cx+sz*0.36, cy+sz*0.32, sz*0.055); // pommel
    // Armoured body
    g.fillStyle(armor); g.fillRoundedRect(cx-sz*0.18, cy-sz*0.26, sz*0.36, sz*0.46, sz*0.04);
    g.fillStyle(0xffffff,0.14); g.fillRect(cx-sz*0.16, cy-sz*0.26, sz*0.12, sz*0.44);
    // Chest cross emblem
    g.fillStyle(acc); g.fillRect(cx-sz*0.02, cy-sz*0.16, sz*0.04, sz*0.16); g.fillRect(cx-sz*0.09, cy-sz*0.1, sz*0.18, sz*0.04);
    // Waist plate
    g.fillStyle(dark); g.fillRect(cx-sz*0.18, cy+sz*0.08, sz*0.36, sz*0.06);
    // Great helm
    g.fillStyle(metal); g.fillCircle(cx, hy, sz*0.17);
    g.fillStyle(dark); g.fillRect(cx-sz*0.13, hy-sz*0.04, sz*0.26, sz*0.08); // eye slit
    // Crest on helm
    g.fillStyle(acc); g.fillTriangle(cx, hy-sz*0.26, cx-sz*0.04, hy-sz*0.14, cx+sz*0.04, hy-sz*0.14);
  }

  // ── Garde du Roi ──────────────────────────────────────────────────────────
  _unitGardeRoi(g, sz, e) {
    const cx = sz/2, cy = sz*0.58, hy = cy - sz*0.34;
    const body = e ? 0xaa2211 : 0xb8860b;
    const dark = e ? 0x880000 : 0x7a5500;
    const acc  = C.GOLD;
    this._shadow(g, cx, cy, sz);
    // Body (gold armour)
    g.fillStyle(body); g.fillRoundedRect(cx-sz*0.17, cy-sz*0.26, sz*0.34, sz*0.46, sz*0.04);
    g.fillStyle(0xffffff,0.14); g.fillRect(cx-sz*0.15, cy-sz*0.26, sz*0.10, sz*0.44);
    // Large kite shield
    this._shield(g, cx-sz*0.26, cy, sz*0.22, sz*0.36, e ? 0x881100 : 0x8B6914, acc);
    // Belt
    g.fillStyle(dark); g.fillRect(cx-sz*0.17, cy+sz*0.08, sz*0.34, sz*0.06);
    // Royal helmet with plume + gold rim
    g.fillStyle(body); g.fillCircle(cx, hy, sz*0.17);
    g.fillStyle(dark); g.fillRect(cx-sz*0.14, hy-sz*0.04, sz*0.28, sz*0.07);
    g.lineStyle(sz*0.04, acc); g.strokeCircle(cx, hy, sz*0.17);
    // Crimson plume
    g.fillStyle(0xdd1111); g.fillTriangle(cx, hy-sz*0.32, cx-sz*0.05, hy-sz*0.14, cx+sz*0.05, hy-sz*0.14);
    g.fillStyle(0xff4444, 0.6); g.fillTriangle(cx, hy-sz*0.32, cx+sz*0.01, hy-sz*0.15, cx+sz*0.05, hy-sz*0.14);
    // Halberd right
    this._stick(g, cx+sz*0.22, hy-sz*0.06, cx+sz*0.22, sz*0.86, sz*0.04, C.WOOD_DARK);
    g.fillStyle(0xcccccc); g.fillTriangle(cx+sz*0.22, sz*0.04, cx+sz*0.16, sz*0.16, cx+sz*0.28, sz*0.16);
    g.fillStyle(acc); g.fillRect(cx+sz*0.18, sz*0.15, sz*0.08, sz*0.03);
  }

  // ── Croisé ────────────────────────────────────────────────────────────────
  _unitCroise(g, sz, e) {
    const cx = sz/2, cy = sz*0.58, hy = cy - sz*0.33;
    const tabard = e ? 0xaa2211 : 0xe8e8e0;
    const plate  = e ? 0x880000 : 0x9a9a9a;
    const cross  = e ? 0xff4444 : 0xcc1111;
    this._shadow(g, cx, cy, sz);
    // Longsword left
    this._stick(g, cx-sz*0.30, cy-sz*0.28, cx-sz*0.30, cy+sz*0.32, sz*0.06, plate);
    g.fillStyle(C.GOLD_DARK); g.fillRect(cx-sz*0.37, cy-sz*0.14, sz*0.14, sz*0.04); // crossguard
    g.fillStyle(C.GOLD_DARK); g.fillCircle(cx-sz*0.30, cy+sz*0.32, sz*0.05); // pommel
    // White tabard with red cross
    g.fillStyle(tabard); g.fillRoundedRect(cx-sz*0.18, cy-sz*0.28, sz*0.36, sz*0.46, sz*0.04);
    g.fillStyle(0xffffff,0.16); g.fillRect(cx-sz*0.16, cy-sz*0.28, sz*0.10, sz*0.44);
    // Large red cross
    g.fillStyle(cross);
    g.fillRect(cx-sz*0.03, cy-sz*0.24, sz*0.06, sz*0.40);
    g.fillRect(cx-sz*0.14, cy-sz*0.12, sz*0.28, sz*0.06);
    // Plate border on shoulders
    g.fillStyle(plate); g.fillRect(cx-sz*0.18, cy-sz*0.28, sz*0.36, sz*0.07);
    // Visor helm
    g.fillStyle(plate); g.fillCircle(cx, hy, sz*0.16);
    g.fillStyle(tabard); g.fillEllipse(cx, hy+sz*0.03, sz*0.13, sz*0.10);
    g.fillStyle(0x111111,0.5); g.fillRect(cx-sz*0.08, hy-sz*0.02, sz*0.16, sz*0.05); // slit
  }

  // ── Mercenaire ────────────────────────────────────────────────────────────
  _unitMercenaire(g, sz, e) {
    const cx = sz/2, cy = sz*0.58, hy = cy - sz*0.33;
    const cloak   = e ? 0xaa2211 : 0x1a1a28;
    const leather = e ? 0xcc3322 : 0x3e2e1a;
    this._shadow(g, cx, cy, sz);
    // Dark cloak (wide triangle for drama)
    g.fillStyle(cloak); g.fillTriangle(cx, sz*0.84, cx-sz*0.22, cy-sz*0.24, cx+sz*0.22, cy-sz*0.24);
    g.fillStyle(0x00000030); g.fillTriangle(cx+sz*0.04, sz*0.84, cx-sz*0.18, cy-sz*0.24, cx+sz*0.22, cy-sz*0.24);
    // Leather chest piece
    g.fillStyle(leather); g.fillRoundedRect(cx-sz*0.14, cy-sz*0.24, sz*0.28, sz*0.38, sz*0.03);
    g.fillStyle(0xffffff,0.08); g.fillRect(cx-sz*0.12, cy-sz*0.24, sz*0.08, sz*0.36);
    // Crossed daggers
    this._stick(g, cx-sz*0.18, cy-sz*0.18, cx+sz*0.18, cy+sz*0.16, sz*0.045, e ? 0xff7766 : 0xd8d8d8);
    this._stick(g, cx+sz*0.18, cy-sz*0.18, cx-sz*0.18, cy+sz*0.16, sz*0.045, e ? 0xff7766 : 0xd8d8d8);
    g.fillStyle(e ? 0xcc4422 : 0x8b6914); g.fillRect(cx-sz*0.04, cy-sz*0.04, sz*0.08, sz*0.02); // dagger cross
    // Dark hood
    g.fillStyle(cloak); g.fillCircle(cx, hy, sz*0.16);
    g.fillStyle(0x000000, 0.5); g.fillEllipse(cx, hy+sz*0.04, sz*0.11, sz*0.07); // face shadow
    g.fillStyle(0xffaa00); g.fillCircle(cx+sz*0.02, hy, sz*0.025); // glinting eye
  }

  // ── Compagnie du Loup ─────────────────────────────────────────────────────
  _unitLoupCompagnie(g, sz, e) {
    const cx = sz/2, cy = sz*0.58, hy = cy - sz*0.33;
    const body = e ? 0xaa2211 : 0x506030;
    const fur  = e ? 0xbb3322 : 0x707058;
    this._shadow(g, cx, cy, sz);
    // Fur mantle (wide)
    g.fillStyle(fur); g.fillEllipse(cx, cy-sz*0.06, sz*0.54, sz*0.48);
    g.fillStyle(body); g.fillEllipse(cx, cy+sz*0.08, sz*0.34, sz*0.36);
    g.fillStyle(e ? 0x881100 : 0x484836); g.fillEllipse(cx, cy-sz*0.18, sz*0.44, sz*0.18); // collar shadow
    // Wolf-pelt hood with ears
    g.fillStyle(fur); g.fillCircle(cx, hy, sz*0.16);
    g.fillTriangle(cx-sz*0.10, hy-sz*0.06, cx-sz*0.18, hy-sz*0.26, cx-sz*0.02, hy-sz*0.06);
    g.fillTriangle(cx+sz*0.10, hy-sz*0.06, cx+sz*0.02, hy-sz*0.06, cx+sz*0.18, hy-sz*0.26);
    g.fillStyle(e ? 0xdd4433 : C.SKIN); g.fillCircle(cx, hy+sz*0.03, sz*0.10);
    g.fillStyle(0xff6600, 0.8); g.fillCircle(cx-sz*0.04, hy, sz*0.025); g.fillCircle(cx+sz*0.04, hy, sz*0.025); // eyes
    // Battle axe right
    this._stick(g, cx+sz*0.22, hy, cx+sz*0.22, cy+sz*0.28, sz*0.05, e ? 0xbb3322 : C.WOOD);
    g.fillStyle(e ? 0xdd5533 : 0xd8d8d8);
    g.fillTriangle(cx+sz*0.22, hy-sz*0.03, cx+sz*0.40, hy+sz*0.09, cx+sz*0.22, hy+sz*0.20);
    g.fillStyle(0xffffff,0.3); g.fillTriangle(cx+sz*0.26, hy, cx+sz*0.40, hy+sz*0.09, cx+sz*0.28, hy+sz*0.16);
  }

  // ── Frère d'Épée ─────────────────────────────────────────────────────────
  _unitFrereEpee(g, sz, e) {
    const cx = sz/2, cy = sz*0.58, hy = cy - sz*0.33;
    const body  = e ? 0xaa2211 : 0x8B0000;
    const cowl  = e ? 0x660000 : 0x5a0000;
    const metal = e ? 0xff6644 : 0xc0c0c0;
    this._shadow(g, cx, cy, sz);
    // Longsword
    this._stick(g, cx-sz*0.30, cy-sz*0.32, cx-sz*0.30, cy+sz*0.34, sz*0.07, metal);
    g.fillStyle(C.GOLD_DARK); g.fillRect(cx-sz*0.38, cy-sz*0.14, sz*0.16, sz*0.04); // crossguard
    g.fillStyle(C.GOLD_DARK); g.fillCircle(cx-sz*0.30, cy+sz*0.34, sz*0.05); // pommel
    // Robe
    g.fillStyle(body); g.fillRoundedRect(cx-sz*0.17, cy-sz*0.26, sz*0.34, sz*0.46, sz*0.03);
    g.fillStyle(0xffffff, 0.10); g.fillRect(cx-sz*0.15, cy-sz*0.26, sz*0.10, sz*0.44);
    // Brotherhood slash + rune marks
    this._stick(g, cx-sz*0.10, cy-sz*0.18, cx+sz*0.10, cy+sz*0.04, sz*0.04, cowl);
    g.lineStyle(1, C.GOLD_DARK, 0.6);
    g.beginPath(); g.moveTo(cx-sz*0.08, cy+sz*0.08); g.lineTo(cx+sz*0.08, cy+sz*0.08); g.strokePath();
    g.beginPath(); g.moveTo(cx-sz*0.06, cy+sz*0.14); g.lineTo(cx+sz*0.06, cy+sz*0.14); g.strokePath();
    // Dark cowl
    g.fillStyle(cowl); g.fillCircle(cx, hy, sz*0.17);
    g.fillStyle(e ? 0xdd4433 : C.SKIN); g.fillCircle(cx, hy+sz*0.04, sz*0.09);
    g.fillStyle(0x000000, 0.4); g.fillRect(cx-sz*0.06, hy+sz*0.01, sz*0.12, sz*0.04); // eye shadow
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
    const gold = C.GOLD;
    this._shadow(g, cx, cy, sz);
    // Hero glow
    if (!e) { g.lineStyle(sz*0.04, 0xffd700, 0.40); g.strokeCircle(cx, sz/2, sz*0.48); }
    // Royal sword (prominent, behind body)
    this._stick(g, cx+sz*0.16, cy-sz*0.30, cx+sz*0.34, cy+sz*0.32, sz*0.09, e ? 0xdd4433 : 0xe0e0e0);
    g.fillStyle(gold); g.fillRect(cx+sz*0.18, cy-sz*0.02, sz*0.24, sz*0.05); // crossguard
    g.fillStyle(gold); g.fillCircle(cx+sz*0.34, cy+sz*0.32, sz*0.065); // pommel
    g.fillStyle(0xffffff,0.4); g.fillRect(cx+sz*0.19, cy-sz*0.30, sz*0.03, sz*0.22); // blade shine
    // Armoured body (gold trim)
    g.fillStyle(body); g.fillRoundedRect(cx-sz*0.20, cy-sz*0.26, sz*0.40, sz*0.46, sz*0.04);
    g.fillStyle(0xffffff,0.16); g.fillRect(cx-sz*0.18, cy-sz*0.26, sz*0.12, sz*0.44);
    g.fillStyle(gold); g.fillRect(cx-sz*0.20, cy-sz*0.26, sz*0.40, sz*0.06); // shoulder pauldron
    g.fillRect(cx-sz*0.20, cy+sz*0.14, sz*0.40, sz*0.05); // tassets
    // Chest heraldry
    g.fillStyle(dark); g.fillRect(cx-sz*0.04, cy-sz*0.20, sz*0.08, sz*0.24); g.fillRect(cx-sz*0.12, cy-sz*0.10, sz*0.24, sz*0.07);
    // Helmet
    g.fillStyle(body); g.fillCircle(cx, hy, sz*0.18);
    g.fillStyle(dark); g.fillRect(cx-sz*0.14, hy-sz*0.04, sz*0.28, sz*0.08);
    g.fillStyle(gold); g.lineStyle(sz*0.03, gold); g.strokeCircle(cx, hy, sz*0.18);
    // Crown with jewels
    g.fillStyle(gold); g.fillRect(cx-sz*0.14, hy-sz*0.24, sz*0.28, sz*0.09);
    for (const dx of [-sz*0.10, 0, sz*0.10]) { g.fillTriangle(cx+dx, hy-sz*0.34, cx+dx-sz*0.04, hy-sz*0.24, cx+dx+sz*0.04, hy-sz*0.24); }
    g.fillStyle(0xcc2222); g.fillCircle(cx, hy-sz*0.23, sz*0.028);
    g.fillStyle(0x2244cc); g.fillCircle(cx-sz*0.10, hy-sz*0.23, sz*0.028);
    g.fillStyle(0x22cc44); g.fillCircle(cx+sz*0.10, hy-sz*0.23, sz*0.028);
  }

  _heroChasse(g, sz, e) {
    const cx = sz/2, cy = sz*0.58, hy = cy - sz*0.34;
    const body = e ? 0xaa2211 : 0x2e7a28;
    const hood = e ? 0xbb3322 : 0x1e5a1e;
    const acc  = e ? 0xff8844 : 0x66ee44;
    this._shadow(g, cx, cy, sz);
    if (!e) { g.lineStyle(sz*0.04, 0x66ee44, 0.38); g.strokeCircle(cx, sz/2, sz*0.48); }
    // Longbow (tall, left)
    const bx=cx-sz*0.36, bTop=cy-sz*0.36, bBot=cy+sz*0.36;
    g.lineStyle(sz*0.055, e ? 0x882211 : 0x6b3a1a);
    g.beginPath();
    for (let i=0; i<=12; i++) { const t=i/12; const by=bTop+(bBot-bTop)*t; const bxx=bx-Math.sin(t*Math.PI)*sz*0.15; if(i===0)g.moveTo(bxx,by); else g.lineTo(bxx,by); }
    g.strokePath();
    g.lineStyle(sz*0.020, 0xd8c888);
    g.beginPath(); g.moveTo(bx,bTop); g.lineTo(bx+sz*0.07,(bTop+bBot)/2); g.lineTo(bx,bBot); g.strokePath();
    // Arrow nocked
    this._stick(g, bx+sz*0.06, cy, cx+sz*0.26, cy, sz*0.028, 0xd4aa44);
    g.fillStyle(0xc0c0c0); g.fillTriangle(cx+sz*0.26, cy, cx+sz*0.20, cy-sz*0.05, cx+sz*0.20, cy+sz*0.05);
    // Leather body
    g.fillStyle(body); g.fillEllipse(cx, cy, sz*0.38, sz*0.48);
    g.fillStyle(e ? 0xcc3322 : 0x3a8a38); g.fillEllipse(cx, cy-sz*0.10, sz*0.30, sz*0.30);
    g.fillStyle(0xffffff,0.12); g.fillEllipse(cx-sz*0.08, cy-sz*0.16, sz*0.14, sz*0.24);
    // Shoulder strap + quiver right
    g.fillStyle(acc); g.fillRect(cx-sz*0.18, cy-sz*0.08, sz*0.36, sz*0.04);
    g.fillStyle(e ? 0xcc4422 : 0xaa8830); g.fillRect(cx+sz*0.16, cy-sz*0.26, sz*0.10, sz*0.30);
    g.fillStyle(0xd4aa44); for (let i=0; i<3; i++) g.fillRect(cx+sz*0.18+i*sz*0.026, cy-sz*0.36, sz*0.022, sz*0.13);
    // Hood + leaf crown
    g.fillStyle(hood); g.fillCircle(cx, hy, sz*0.16);
    g.fillTriangle(cx, hy-sz*0.23, cx-sz*0.15, hy+sz*0.05, cx+sz*0.15, hy+sz*0.05);
    g.fillStyle(acc);
    for (let i=-1; i<=1; i++) { g.fillTriangle(cx+i*sz*0.10, hy-sz*0.24, cx+i*sz*0.10-sz*0.06, hy-sz*0.13, cx+i*sz*0.10+sz*0.06, hy-sz*0.13); }
    g.fillStyle(e ? 0xdd4433 : C.SKIN); g.fillEllipse(cx, hy+sz*0.02, sz*0.11, sz*0.09);
    g.fillStyle(0x000000,0.3); g.fillRect(cx-sz*0.04, hy+sz*0.01, sz*0.08, sz*0.03); // eye shadow
  }

  _heroMage(g, sz, e) {
    const cx = sz/2, cy = sz*0.58, hy = cy - sz*0.34;
    const robe = e ? 0xaa2211 : 0x6a0dad;
    const inner = e ? 0xcc3322 : 0x8a0fdd;
    const acc  = e ? 0xff8888 : 0xcc88ff;
    this._shadow(g, cx, cy, sz);
    if (!e) {
      for (let i=0; i<4; i++) { const a=i/4*Math.PI*2; g.fillStyle(acc); g.fillCircle(cx+Math.cos(a)*sz*0.46, sz/2+Math.sin(a)*sz*0.46, sz*0.032); }
      g.lineStyle(sz*0.035, acc, 0.45); g.strokeCircle(cx, sz/2, sz*0.48);
    }
    // Staff (right, behind)
    this._stick(g, cx+sz*0.32, sz*0.04, cx+sz*0.32, sz*0.84, sz*0.056, e ? 0xaa3311 : 0x6b4a1a);
    // Crystal orb
    g.fillStyle(acc); g.fillCircle(cx+sz*0.32, sz*0.06, sz*0.09);
    g.lineStyle(sz*0.022, 0xffffff, 0.7); g.strokeCircle(cx+sz*0.32, sz*0.06, sz*0.09);
    g.fillStyle(0xffffff, 0.8); g.fillCircle(cx+sz*0.30, sz*0.03, sz*0.034);
    // Robe (wide, magical)
    g.fillStyle(robe); g.fillTriangle(cx, cy-sz*0.26, cx-sz*0.26, sz*0.84, cx+sz*0.26, sz*0.84);
    g.fillRect(cx-sz*0.13, cy-sz*0.26, sz*0.26, sz*0.26);
    g.fillStyle(inner); g.fillRect(cx-sz*0.08, cy-sz*0.26, sz*0.16, sz*0.18);
    g.fillStyle(0xffffff,0.12); g.fillRect(cx-sz*0.11, cy-sz*0.26, sz*0.06, sz*0.50);
    // Runic trim
    g.lineStyle(sz*0.022, acc, 0.70);
    for (let i=0; i<3; i++) { g.beginPath(); g.moveTo(cx-sz*0.10, cy+i*sz*0.09); g.lineTo(cx+sz*0.10, cy+i*sz*0.09); g.strokePath(); }
    // Pointed hat
    g.fillStyle(e ? 0x881100 : 0x5a0099);
    g.fillTriangle(cx, hy-sz*0.32, cx-sz*0.20, hy+sz*0.03, cx+sz*0.20, hy+sz*0.03);
    g.fillStyle(0xffffff,0.12); g.fillTriangle(cx, hy-sz*0.32, cx+sz*0.03, hy-sz*0.12, cx+sz*0.20, hy+sz*0.03); // lit face
    g.fillStyle(inner); g.fillEllipse(cx, hy+sz*0.03, sz*0.42, sz*0.09); // brim
    g.fillStyle(acc); g.fillCircle(cx, hy-sz*0.16, sz*0.042); // star on hat
    // Face + glowing eyes
    g.fillStyle(0xc8a870); g.fillCircle(cx, hy, sz*0.14);
    g.fillStyle(acc); g.fillCircle(cx-sz*0.04, hy, sz*0.028); g.fillCircle(cx+sz*0.04, hy, sz*0.028);
    g.fillStyle(0xffffff,0.8); g.fillCircle(cx-sz*0.045, hy-sz*0.005, sz*0.012); g.fillCircle(cx+sz*0.035, hy-sz*0.005, sz*0.012);
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

  _bldStoneBrick(g, x0, y0, w, h, col) {
    // Fills a rect with col + brick lines
    g.fillStyle(col); g.fillRect(x0, y0, w, h);
    const bh = Math.max(6, h/6), bw = Math.max(10, w/4);
    g.lineStyle(1, 0x00000040);
    for (let row = 0; row <= Math.ceil(h/bh); row++) {
      const yy = y0 + row*bh;
      const off = row%2===0 ? 0 : bw/2;
      g.beginPath(); g.moveTo(x0,yy); g.lineTo(x0+w,yy); g.strokePath();
      for (let bx = x0-off; bx < x0+w; bx += bw) { g.beginPath(); g.moveTo(bx,yy); g.lineTo(bx,yy+bh); g.strokePath(); }
    }
    g.lineStyle(2, 0x00000055); g.strokeRect(x0,y0,w,h);
  }
  _bldBase(g, sz, wallCol, roofCol) {
    const w = sz*0.8, h = sz*0.5, x0 = (sz-w)/2, y0 = sz*0.32;
    // Ground shadow
    g.fillStyle(0x00000040); g.fillEllipse(sz/2+3, y0+h+5, w*0.9, 8);
    // Walls with brick
    this._bldStoneBrick(g, x0, y0, w, h, wallCol);
    // Side shading (right face darker)
    g.fillStyle(0x00000020); g.fillRect(x0+w-sz*0.1, y0, sz*0.1, h);
    // Roof
    g.fillStyle(roofCol);
    g.fillTriangle(sz/2, sz*0.05, x0-5, y0+5, x0+w+5, y0+5);
    // Roof ridge highlight
    g.lineStyle(2, 0xffffff, 0.15); g.beginPath(); g.moveTo(x0-5,y0+5); g.lineTo(sz/2,sz*0.05); g.lineTo(x0+w+5,y0+5); g.strokePath();
    // Roof underside shadow
    g.lineStyle(1, 0x00000040); g.beginPath(); g.moveTo(x0-5,y0+5); g.lineTo(x0+w+5,y0+5); g.strokePath();
    return { x0, y0, w, h };
  }

  _bldTownHall(g, sz) {
    const w = sz*0.82, h = sz*0.50, x0 = (sz-w)/2, y0 = sz*0.26;
    const tw = sz*0.16, th = h+sz*0.06;  // corner tower dims
    // Ground shadow
    g.fillStyle(0x00000050); g.fillEllipse(sz/2+4, y0+h+8, w+tw*2, 12);
    // Corner towers (behind main wall)
    this._bldStoneBrick(g, x0-tw*0.7, y0-sz*0.04, tw, th, C.STONE);
    this._bldStoneBrick(g, x0+w-tw*0.3, y0-sz*0.04, tw, th, C.STONE);
    // Tower crenellations
    g.fillStyle(C.STONE_DARK);
    for (const tx of [x0-tw*0.7, x0+w-tw*0.3]) {
      for (let i=0; i<3; i++) g.fillRect(tx+i*(tw/2.8), y0-sz*0.1, sz*0.04, sz*0.07);
    }
    // Main keep wall
    this._bldStoneBrick(g, x0, y0, w, h, 0x9a8878);
    // Right-face shadow for depth
    g.fillStyle(0x00000025); g.fillRect(x0+w-sz*0.12, y0, sz*0.12, h);
    // Battlements
    g.fillStyle(C.STONE_DARK);
    const cw = sz*0.055, cg = (w - 6*cw) / 5;
    for (let i=0; i<6; i++) g.fillRect(x0+i*(cw+cg), y0-sz*0.06, cw, sz*0.07);
    // Conical roof on towers
    g.fillStyle(C.ROOF_DARK); g.fillTriangle(x0-tw*0.3, y0-sz*0.18, x0-tw*0.7, y0-sz*0.03, x0+tw*0.3, y0-sz*0.03);
    g.fillStyle(C.ROOF_DARK); g.fillTriangle(x0+w+tw*0.3, y0-sz*0.18, x0+w-tw*0.3, y0-sz*0.03, x0+w+tw*0.7, y0-sz*0.03);
    // Main roof
    g.fillStyle(C.ROOF_DARK); g.fillTriangle(sz/2, sz*0.02, x0-8, y0+5, x0+w+8, y0+5);
    g.fillStyle(0xffffff,0.1); g.fillTriangle(sz/2,sz*0.02, sz/2,y0+5, x0+w+8,y0+5);
    // Flag pole + banner
    g.lineStyle(2, C.WOOD_DARK); g.beginPath(); g.moveTo(sz/2,sz*0.02); g.lineTo(sz/2,y0-sz*0.12); g.strokePath();
    g.fillStyle(0xcc1111); g.fillTriangle(sz/2, y0-sz*0.12, sz/2+sz*0.14, y0-sz*0.07, sz/2, y0-sz*0.02);
    // Gate arch
    g.fillStyle(C.STONE_DARK); g.fillRect(sz/2-sz*0.09, y0+h-sz*0.22, sz*0.18, sz*0.22);
    g.fillStyle(0x1a1008); g.fillRect(sz/2-sz*0.07, y0+h-sz*0.20, sz*0.14, sz*0.20);
    g.fillStyle(0x1a1008); g.fillEllipse(sz/2, y0+h-sz*0.20, sz*0.14, sz*0.1);
    // Portcullis lines
    g.lineStyle(1, C.WOOD_DARK, 0.5);
    for (let i=1; i<3; i++) { g.beginPath(); g.moveTo(sz/2-sz*0.07+i*sz*0.04, y0+h-sz*0.20); g.lineTo(sz/2-sz*0.07+i*sz*0.04, y0+h); g.strokePath(); }
    // Windows (lit amber)
    g.fillStyle(0xffe8a0); g.fillRect(x0+sz*0.08, y0+sz*0.08, sz*0.1, sz*0.14); g.fillRect(x0+w-sz*0.18, y0+sz*0.08, sz*0.1, sz*0.14);
    g.lineStyle(1, 0xc8960c); g.strokeRect(x0+sz*0.08, y0+sz*0.08, sz*0.1, sz*0.14); g.strokeRect(x0+w-sz*0.18, y0+sz*0.08, sz*0.1, sz*0.14);
  }

  _bldHouse(g, sz) {
    const { x0, y0, w, h } = this._bldBase(g, sz, 0xc8985a, 0x8a2a14);
    // Chimney (stone)
    this._bldStoneBrick(g, x0+w*0.62, y0-sz*0.14, sz*0.09, sz*0.16, C.STONE);
    g.fillStyle(C.STONE_DARK); g.fillRect(x0+w*0.60, y0-sz*0.155, sz*0.13, sz*0.03);
    // Smoke hint
    g.fillStyle(0xaaaaaa, 0.3); g.fillCircle(x0+w*0.66, y0-sz*0.17, 3); g.fillCircle(x0+w*0.68, y0-sz*0.22, 4);
    // Door (arched)
    g.fillStyle(C.WOOD_DARK); g.fillRect(sz/2-sz*0.07, y0+h-sz*0.26, sz*0.14, sz*0.26);
    g.fillStyle(0x1a0a00); g.fillEllipse(sz/2, y0+h-sz*0.26, sz*0.14, sz*0.10);
    g.fillStyle(C.GOLD_DARK); g.fillCircle(sz/2+sz*0.04, y0+h-sz*0.14, 2);
    // Windows with cross beams
    g.fillStyle(0xffe8a0); g.fillRect(x0+sz*0.06, y0+sz*0.08, sz*0.12, sz*0.12); g.fillRect(x0+w-sz*0.18, y0+sz*0.08, sz*0.12, sz*0.12);
    g.lineStyle(1, C.WOOD_DARK);
    g.beginPath(); g.moveTo(x0+sz*0.12, y0+sz*0.08); g.lineTo(x0+sz*0.12, y0+sz*0.20); g.strokePath();
    g.beginPath(); g.moveTo(x0+sz*0.06, y0+sz*0.14); g.lineTo(x0+sz*0.18, y0+sz*0.14); g.strokePath();
    g.beginPath(); g.moveTo(x0+w-sz*0.12, y0+sz*0.08); g.lineTo(x0+w-sz*0.12, y0+sz*0.20); g.strokePath();
    g.beginPath(); g.moveTo(x0+w-sz*0.18, y0+sz*0.14); g.lineTo(x0+w-sz*0.06, y0+sz*0.14); g.strokePath();
  }

  _bldBarracks(g, sz) {
    const { x0, y0, w, h } = this._bldBase(g, sz, C.STONE, C.STONE_DARK);
    // Crenellations
    g.fillStyle(C.STONE_DARK);
    for (let i=0; i<5; i++) g.fillRect(x0+i*(w/4.5), y0-sz*0.07, sz*0.06, sz*0.07);
    // Arrow slits
    g.fillStyle(0x111111);
    for (let i=0; i<3; i++) g.fillRect(x0+sz*0.06+i*(w/3.2), y0+sz*0.06, sz*0.04, sz*0.14);
    // Crossed swords emblem on gate
    g.fillStyle(C.STONE_DARK); g.fillRect(sz/2-sz*0.08, y0+h-sz*0.26, sz*0.16, sz*0.26);
    g.lineStyle(2, 0xcc3333);
    g.beginPath(); g.moveTo(sz/2-sz*0.06, y0+h-sz*0.22); g.lineTo(sz/2+sz*0.06, y0+h-sz*0.04); g.strokePath();
    g.beginPath(); g.moveTo(sz/2+sz*0.06, y0+h-sz*0.22); g.lineTo(sz/2-sz*0.06, y0+h-sz*0.04); g.strokePath();
    g.fillStyle(0xcc3333); g.fillRect(sz/2-sz*0.06, y0+h-sz*0.13, sz*0.12, sz*0.025);
    // Side shading depth
    g.fillStyle(0x00000020); g.fillRect(x0+w-sz*0.08, y0, sz*0.08, h);
  }

  _bldFarm(g, sz) {
    const { x0, y0, w, h } = this._bldBase(g, sz, 0xc8aa44, 0x9a7820);
    // Hay bales at corners (round)
    g.fillStyle(0xd4b040); g.fillEllipse(x0-sz*0.06, y0+h-sz*0.1, sz*0.14, sz*0.12);
    g.fillStyle(0xd4b040); g.fillEllipse(x0+w+sz*0.06, y0+h-sz*0.1, sz*0.14, sz*0.12);
    g.lineStyle(1, 0x9a7820); g.strokeEllipse(x0-sz*0.06, y0+h-sz*0.1, sz*0.14, sz*0.12);
    g.lineStyle(1, 0x9a7820); g.strokeEllipse(x0+w+sz*0.06, y0+h-sz*0.1, sz*0.14, sz*0.12);
    // Barn double door
    g.fillStyle(C.WOOD); g.fillRect(sz/2-sz*0.12, y0+h-sz*0.28, sz*0.24, sz*0.28);
    g.lineStyle(2, C.WOOD_DARK); g.beginPath(); g.moveTo(sz/2, y0+h-sz*0.28); g.lineTo(sz/2, y0+h); g.strokePath();
    // Wheat icon
    g.fillStyle(0xffd700); g.fillRect(sz/2-sz*0.04, y0+sz*0.08, sz*0.03, sz*0.12); g.fillRect(sz/2+sz*0.01, y0+sz*0.06, sz*0.03, sz*0.14);
    g.fillStyle(0xffa020); g.fillRect(sz/2-sz*0.05, y0+sz*0.05, sz*0.04, sz*0.06); g.fillRect(sz/2+sz*0.01, y0+sz*0.03, sz*0.04, sz*0.06);
    g.fillStyle(0xfffacc); g.fillRect(x0+sz*0.06, y0+sz*0.08, sz*0.10, sz*0.10); g.fillRect(x0+w-sz*0.16, y0+sz*0.08, sz*0.10, sz*0.10);
  }

  _bldMine(g, sz) {
    const x0=sz*0.06, y0=sz*0.22, w=sz*0.88, h=sz*0.56;
    // Ground shadow
    g.fillStyle(0x00000048); g.fillEllipse(sz/2+4, y0+h+7, w*0.9, 10);
    // Rock face
    this._bldStoneBrick(g, x0, y0, w, h, 0x706858);
    g.fillStyle(0x5a5048); g.fillRect(x0+w-sz*0.1, y0, sz*0.1, h); // right face dark
    g.fillStyle(0x888070); g.fillRect(x0+sz*0.04, y0+sz*0.04, w*0.38, h*0.38); // lighter patch
    // Triangular stone roof
    g.fillStyle(0x605848); g.fillTriangle(sz/2, y0-sz*0.12, x0-5, y0+5, x0+w+5, y0+5);
    // Mine entrance arch
    g.fillStyle(0x1a1008); g.fillRect(sz/2-sz*0.12, y0+h-sz*0.28, sz*0.24, sz*0.28);
    g.fillStyle(0x1a1008); g.fillEllipse(sz/2, y0+h-sz*0.28, sz*0.24, sz*0.14);
    // Timber frame
    g.lineStyle(2, C.WOOD);
    g.beginPath(); g.moveTo(sz/2-sz*0.14, y0+h); g.lineTo(sz/2-sz*0.14, y0+h-sz*0.30); g.strokePath();
    g.beginPath(); g.moveTo(sz/2+sz*0.14, y0+h); g.lineTo(sz/2+sz*0.14, y0+h-sz*0.30); g.strokePath();
    g.beginPath(); g.moveTo(sz/2-sz*0.15, y0+h-sz*0.29); g.lineTo(sz/2+sz*0.15, y0+h-sz*0.29); g.strokePath();
    // Pick icon
    g.lineStyle(2, C.GOLD_DARK);
    g.beginPath(); g.moveTo(x0+sz*0.10, y0+sz*0.10); g.lineTo(x0+sz*0.24, y0+sz*0.26); g.strokePath();
    g.beginPath(); g.moveTo(x0+sz*0.08, y0+sz*0.10); g.lineTo(x0+sz*0.16, y0+sz*0.04); g.strokePath();
  }

  _bldLumber(g, sz) {
    const { x0, y0, w, h } = this._bldBase(g, sz, C.WOOD, C.WOOD_DARK);
    // Log pile right
    for (let i=0; i<3; i++) {
      g.fillStyle(0x9a7040); g.fillRect(x0+w, y0+h-sz*0.10-i*sz*0.09, sz*0.16, sz*0.06);
      g.fillStyle(0x8B4513); g.fillEllipse(x0+w, y0+h-sz*0.07-i*sz*0.09, sz*0.07, sz*0.06);
    }
    // Saw wheel left
    g.fillStyle(C.STONE_DARK); g.fillCircle(x0, y0+h*0.50, sz*0.11);
    g.lineStyle(2, C.STONE_LIGHT);
    for (let a=0; a<6; a++) { const ang=a*Math.PI/3; g.beginPath(); g.moveTo(x0,y0+h*0.50); g.lineTo(x0+Math.cos(ang)*sz*0.10, y0+h*0.50+Math.sin(ang)*sz*0.10); g.strokePath(); }
    g.lineStyle(1.5, 0xdddddd); g.beginPath(); g.moveTo(x0+sz*0.02, y0+h*0.40); g.lineTo(x0+sz*0.14, y0+h*0.40); g.strokePath();
    // Door + window
    g.fillStyle(C.WOOD_DARK); g.fillRect(sz/2-sz*0.07, y0+h-sz*0.24, sz*0.14, sz*0.24);
    g.fillStyle(0xffe8a0); g.fillRect(x0+sz*0.08, y0+sz*0.08, sz*0.10, sz*0.10);
  }

  _bldMarket(g, sz) {
    const { x0, y0, w, h } = this._bldBase(g, sz, 0xd0a030, 0x9a7010);
    // Colourful awning triangles
    const cols = [0xcc2222, 0xffd700, 0xcc2222, 0xffd700, 0xcc2222, 0xffd700];
    const sw = w / cols.length;
    for (let i=0; i<cols.length; i++) {
      g.fillStyle(cols[i]); g.fillTriangle(x0+i*sw, y0, x0+(i+1)*sw, y0, x0+(i+0.5)*sw, y0-sz*0.16);
    }
    g.fillStyle(C.WOOD_DARK); g.fillRect(x0, y0-sz*0.01, w, sz*0.04);
    // Display goods
    g.fillStyle(0xa04010); g.fillRect(sz/2-sz*0.14, y0+h-sz*0.18, sz*0.28, sz*0.08);
    g.fillStyle(C.GOLD); g.fillCircle(sz/2-sz*0.06, y0+h-sz*0.16, 3); g.fillCircle(sz/2, y0+h-sz*0.16, 3); g.fillCircle(sz/2+sz*0.06, y0+h-sz*0.16, 3);
    g.fillStyle(C.WOOD_DARK); g.fillRect(sz/2-sz*0.06, y0+h-sz*0.22, sz*0.12, sz*0.22);
    g.fillStyle(0xfffacc); g.fillRect(x0+sz*0.06, y0+sz*0.06, sz*0.10, sz*0.12); g.fillRect(x0+w-sz*0.16, y0+sz*0.06, sz*0.10, sz*0.12);
  }

  _bldTower(g, sz) {
    const cx=sz/2, w=sz*0.54, h=sz*0.70, x0=(sz-w)/2, y0=sz*0.08;
    // Shadow
    g.fillStyle(0x00000050); g.fillEllipse(cx+3, y0+h+6, w*0.9, 10);
    // Stone shaft
    this._bldStoneBrick(g, x0, y0, w, h, C.STONE);
    g.fillStyle(0x00000022); g.fillRect(x0+w-sz*0.08, y0, sz*0.08, h);
    // Crenellations
    g.fillStyle(C.STONE_DARK);
    const cw=sz*0.07, cg=(w-4*cw)/3;
    for (let i=0; i<4; i++) g.fillRect(x0+i*(cw+cg), y0-sz*0.09, cw, sz*0.10);
    // Arrow slits
    g.fillStyle(0x181818); g.fillRect(cx-sz*0.03, y0+sz*0.12, sz*0.06, sz*0.16); g.fillRect(cx-sz*0.03, y0+sz*0.36, sz*0.06, sz*0.16);
    // Conical roof
    g.fillStyle(C.STONE_DARK); g.fillTriangle(cx, y0-sz*0.24, x0-4, y0+2, x0+w+4, y0+2);
    g.fillStyle(0xffffff,0.12); g.fillTriangle(cx, y0-sz*0.24, cx, y0+2, x0+w+4, y0+2); // lit face
    // Spire tip
    g.fillStyle(C.STONE_DARK); g.fillCircle(cx, y0-sz*0.24, 3);
  }

  _bldChurch(g, sz) {
    const { x0, y0, w, h } = this._bldBase(g, sz, 0xe0d8c8, C.WOOD_DARK);
    // Gothic arch windows
    g.fillStyle(0xffe8a0);
    g.fillRect(x0+sz*0.06, y0+sz*0.08, sz*0.12, sz*0.18);
    g.fillTriangle(x0+sz*0.06, y0+sz*0.08, x0+sz*0.18, y0+sz*0.08, x0+sz*0.12, y0+sz*0.01);
    g.fillRect(x0+w-sz*0.18, y0+sz*0.08, sz*0.12, sz*0.18);
    g.fillTriangle(x0+w-sz*0.18, y0+sz*0.08, x0+w-sz*0.06, y0+sz*0.08, x0+w-sz*0.12, y0+sz*0.01);
    // Bell tower stub
    g.fillStyle(0xd0c8b8); this._bldStoneBrick(g, sz/2-sz*0.06, y0-sz*0.06, sz*0.12, sz*0.08, 0xd8d0c0);
    // Cross (gold)
    g.fillStyle(C.GOLD_DARK); g.fillRect(sz/2-sz*0.02, y0-sz*0.24, sz*0.04, sz*0.20);
    g.fillRect(sz/2-sz*0.09, y0-sz*0.17, sz*0.18, sz*0.04);
    // Arched door
    g.fillStyle(C.WOOD_DARK); g.fillRect(sz/2-sz*0.07, y0+h-sz*0.28, sz*0.14, sz*0.28);
    g.fillStyle(0x1a0a00); g.fillEllipse(sz/2, y0+h-sz*0.28, sz*0.14, sz*0.10);
  }

  _bldStable(g, sz) {
    const { x0, y0, w, h } = this._bldBase(g, sz, 0xa07848, C.WOOD_DARK);
    // Fence posts left & right
    g.fillStyle(C.WOOD);
    for (let i=0; i<3; i++) { g.fillRect(x0-sz*0.06, y0+i*sz*0.12, sz*0.05, sz*0.10); g.fillRect(x0+w+sz*0.01, y0+i*sz*0.12, sz*0.05, sz*0.10); }
    g.lineStyle(2, C.WOOD_DARK);
    g.beginPath(); g.moveTo(x0-sz*0.04, y0+sz*0.04); g.lineTo(x0+sz*0.06, y0+sz*0.04); g.strokePath();
    g.beginPath(); g.moveTo(x0-sz*0.04, y0+sz*0.14); g.lineTo(x0+sz*0.06, y0+sz*0.14); g.strokePath();
    // Horse silhouette
    g.fillStyle(0x6a4428); g.fillEllipse(sz/2, y0+h*0.44, sz*0.32, sz*0.22);
    g.fillCircle(sz/2+sz*0.18, y0+h*0.44-sz*0.09, sz*0.08);
    g.fillRect(sz/2+sz*0.20, y0+h*0.44-sz*0.18, sz*0.05, sz*0.11);
    g.fillStyle(0x3a2010); g.fillRect(sz/2+sz*0.14, y0+h*0.44-sz*0.20, sz*0.10, sz*0.04);
    // Stable door
    g.fillStyle(C.WOOD_DARK); g.fillRect(sz/2-sz*0.08, y0+h-sz*0.22, sz*0.16, sz*0.22);
    g.lineStyle(2, C.WOOD); g.beginPath(); g.moveTo(sz/2, y0+h-sz*0.22); g.lineTo(sz/2, y0+h); g.strokePath();
  }

  _bldWall(g, sz) {
    // Stone wall segment with top crenellations
    this._bldStoneBrick(g, 0, sz*0.3, sz, sz*0.7, C.STONE);
    // Top merlon pair
    g.fillStyle(C.STONE_DARK);
    g.fillRect(sz*0.04, sz*0.14, sz*0.36, sz*0.18);
    g.fillRect(sz*0.60, sz*0.14, sz*0.36, sz*0.18);
    // Crenel gap (open centre)
    g.fillStyle(C.GRASS_DARK); g.fillRect(sz*0.40, sz*0.14, sz*0.20, sz*0.16);
    // Arrow slit
    g.fillStyle(0x181818); g.fillRect(sz*0.44, sz*0.44, sz*0.12, sz*0.20);
    // Outline
    g.lineStyle(2, C.STONE_DARK, 0.7); g.strokeRect(0, sz*0.3, sz, sz*0.7);
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