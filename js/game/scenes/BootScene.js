import Phaser from 'phaser';

const T = 24;

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

    // Tile SVGs (feTurbulence noise)
    this.load.image('tile_grass',         'assets/tiles/grass.svg');
    this.load.image('tile_dark_grass',    'assets/tiles/dark_grass.svg');
    this.load.image('tile_water',         'assets/tiles/water.svg');
    this.load.image('tile_sand',          'assets/tiles/sand.svg');
    this.load.image('tile_forest',        'assets/tiles/forest.svg');
    this.load.image('tile_mountain',      'assets/tiles/mountain.svg');
    this.load.image('tile_dirt',          'assets/tiles/dirt.svg');
    this.load.image('tile_marsh',         'assets/tiles/marsh.svg');
    this.load.image('tile_path',          'assets/tiles/path.svg');
    this.load.image('tile_shallow_water', 'assets/tiles/shallow_water.svg');
    this.load.image('tile_snow',          'assets/tiles/snow.svg');
    this.load.image('tile_ruins',         'assets/tiles/ruins.svg');
    this.load.image('tile_farmland',      'assets/tiles/farmland.svg');
    // Resource SVGs
    this.load.image('res_tree',         'assets/resources/tree.svg');
    this.load.image('res_tree_stump',   'assets/resources/tree_stump.svg');
    this.load.image('res_tree_sapling', 'assets/resources/tree_sapling.svg');
    this.load.image('res_stone',        'assets/resources/stone.svg');
    this.load.image('res_gold',         'assets/resources/gold.svg');
    this.load.image('res_food',         'assets/resources/food.svg');
    // Building PNGs
    this.load.image('bld_town_hall',   'assets/buildings/hotel_de_ville.png');
    this.load.image('bld_house',       'assets/buildings/maison.png');
    this.load.image('bld_barracks',    'assets/buildings/caserne.png');
    this.load.image('bld_farm',        'assets/buildings/ferme.png');
    this.load.image('bld_mine',        'assets/buildings/mine.png');
    this.load.image('bld_lumber_mill', 'assets/buildings/scierie.png');
    this.load.image('bld_market',      'assets/buildings/marche.png');
    this.load.image('bld_tower',       'assets/buildings/tour_de_garde.png');
    this.load.image('bld_church',      'assets/buildings/eglise.png');
    this.load.image('bld_stable',      'assets/buildings/ecurie.png');
    this.load.image('bld_wall',        'assets/buildings/muraille.png');
    this.load.image('village_tower',     'assets/buildings/village_tower.svg');
    this.load.image('village_tower_cap', 'assets/buildings/village_tower_cap.svg');
    // Unit battle sprites (96×96) — world sprites (36×36) generated from these in create()
    const unitKeys = ['paysan','homme_armes','archer','chevalier','garde_roi','croise','mercenaire','compagnie_loup','frere_epee'];
    for (const k of unitKeys) {
      this.load.image(`battle_${k}`,       `assets/units/${k}.svg`);
      this.load.image(`battle_${k}_enemy`, `assets/units/${k}_enemy.svg`);
    }
    const heroKeys = ['roi_guerrier','chasseresse','mage_arcane','paladin','assassin','necromancien'];
    for (const k of heroKeys) {
      this.load.image(`battle_${k}`,       `assets/units/${k}.svg`);
      this.load.image(`battle_${k}_enemy`, `assets/units/${k}.svg`); // même SVG, clé distincte
    }
    const mobKeys = ['loup','sanglier','ours'];
    for (const k of mobKeys) {
      this.load.image(`battle_${k}`,       `assets/units/${k}.svg`);
      this.load.image(`battle_${k}_enemy`, `assets/units/${k}.svg`); // même SVG, clé distincte
    }
    // NPCs
    for (const k of ['ermite','marchand','ancien','scout','pretre','seigneur']) {
      this.load.image(`npc_${k}`, `assets/npcs/${k}.svg`);
    }
    // UI
    this.load.image('selection_ring', 'assets/ui/selection_ring.svg');
    // Dungeons
    this.load.image('cave_entrance', 'assets/dungeons/cave_entrance.svg');
  }


  create() {
    this._createUnitTextures();
    this._createTileVariants();
    this.scene.start('Menu');
  }

  /**
   * Generate 4 visual variants for each tile type.
   * Variants are the base SVG + tiny seeded-random marks (dots, specks, thin lines).
   * Details are small (1-3 px) and low-alpha so the variation reads as texture,
   * not as obvious geometric patches.
   */
  _createTileVariants() {
    // Seeded LCG — deterministic per variant index so tiles always look the same
    const lcg = (seed) => {
      let s = seed | 0;
      return () => { s = Math.imul(s, 1664525) + 1013904223; return (s >>> 0) / 0xFFFFFFFF; };
    };

    // Draw `count` tiny filled circles at random positions within the 48×48 tile
    const scatter = (g, color, alpha, count, rMin, rMax, seed, margin = 3) => {
      const rand = lcg(seed);
      g.fillStyle(color, alpha);
      for (let i = 0; i < count; i++) {
        const x = margin + rand() * (T - margin * 2);
        const y = margin + rand() * (T - margin * 2);
        const r = rMin + rand() * (rMax - rMin);
        g.fillCircle(x, y, r);
      }
    };

    // Draw horizontal ripple lines (water waves)
    const ripples = (g, color, alpha, count, seed) => {
      const rand = lcg(seed);
      g.fillStyle(color, alpha);
      for (let i = 0; i < count; i++) {
        const y  = 2 + rand() * 20;
        const x0 = 1 + rand() * 8;
        const w  = 5 + rand() * 10;
        g.fillRect(x0, y, w, 1);
      }
    };

    // Per-tile-type: four overlay descriptions (null = plain base, no marks)
    // Each non-null entry: array of draw calls applied in order
    const SPECS = {
      tile_grass: [
        null,
        (g) => scatter(g, 0x2a5e1a, 0.18, 7,  1.0, 2.0, 11),
        (g) => scatter(g, 0x2a5e1a, 0.14, 12, 0.8, 1.5, 22),
        (g) => { scatter(g, 0x2a5e1a, 0.16, 5, 1.2, 2.2, 33);
                 scatter(g, 0x8ecf5a, 0.12, 4, 1.0, 1.8, 44); },
      ],
      tile_dark_grass: [
        null,
        (g) => scatter(g, 0x1a3e0e, 0.22, 7,  1.0, 2.0, 55),
        (g) => scatter(g, 0x1a3e0e, 0.18, 11, 0.8, 1.4, 66),
        (g) => { scatter(g, 0x1a3e0e, 0.20, 5, 1.2, 2.0, 77);
                 scatter(g, 0x5a9e42, 0.10, 4, 0.8, 1.5, 88); },
      ],
      tile_water: [
        null,
        (g) => ripples(g, 0x7ab8e8, 0.22, 5, 111),
        (g) => ripples(g, 0x7ab8e8, 0.18, 8, 222),
        (g) => { ripples(g, 0x7ab8e8, 0.16, 4, 333);
                 ripples(g, 0xbcddee, 0.12, 3, 444); },
      ],
      tile_sand: [
        null,
        (g) => scatter(g, 0x9a7a28, 0.18, 9,  0.8, 1.8, 131),
        (g) => scatter(g, 0x9a7a28, 0.14, 14, 0.6, 1.2, 142),
        (g) => { scatter(g, 0x9a7a28, 0.16, 6, 1.0, 2.0, 153);
                 scatter(g, 0xe8d08a, 0.12, 5, 0.8, 1.4, 164); },
      ],
      tile_dirt: [
        null,
        (g) => scatter(g, 0x5a3820, 0.20, 8,  1.0, 2.2, 211),
        (g) => scatter(g, 0x5a3820, 0.16, 13, 0.7, 1.4, 222),
        (g) => { scatter(g, 0x5a3820, 0.18, 6, 1.2, 2.4, 233);
                 scatter(g, 0xb08860, 0.12, 4, 0.8, 1.6, 244); },
      ],
      tile_forest: [
        null,
        (g) => scatter(g, 0x0e280a, 0.28, 6,  1.2, 2.4, 311),
        (g) => scatter(g, 0x0e280a, 0.22, 10, 0.8, 1.6, 322),
        (g) => { scatter(g, 0x0e280a, 0.25, 5, 1.4, 2.6, 333);
                 scatter(g, 0x42802c, 0.14, 4, 1.0, 2.0, 344); },
      ],
      tile_mountain: [
        null,
        (g) => scatter(g, 0x3e3430, 0.22, 7,  1.0, 2.2, 411),
        (g) => scatter(g, 0x3e3430, 0.18, 11, 0.7, 1.5, 422),
        (g) => { scatter(g, 0x3e3430, 0.20, 5, 1.2, 2.4, 433);
                 scatter(g, 0xd8d0c8, 0.14, 4, 0.8, 1.6, 444); },
      ],
      tile_marsh: [
        null,
        (g) => scatter(g, 0x1a2c0a, 0.25, 6,  1.0, 2.0, 511),
        (g) => scatter(g, 0x2a4818, 0.20, 10, 0.7, 1.4, 522),
        (g) => { scatter(g, 0x1a2c0a, 0.22, 5, 1.2, 2.2, 533);
                 scatter(g, 0x3a6028, 0.14, 4, 0.8, 1.5, 544); },
      ],
      tile_path: [
        null,
        (g) => scatter(g, 0x6a4820, 0.20, 8,  0.8, 1.8, 611),
        (g) => scatter(g, 0x6a4820, 0.16, 12, 0.6, 1.2, 622),
        (g) => { scatter(g, 0x6a4820, 0.18, 5, 1.0, 2.0, 633);
                 scatter(g, 0xd0b080, 0.12, 4, 0.8, 1.5, 644); },
      ],
      tile_shallow_water: [
        null,
        (g) => ripples(g, 0xb0d8ee, 0.28, 4, 711),
        (g) => ripples(g, 0xb0d8ee, 0.22, 6, 722),
        (g) => { ripples(g, 0xb0d8ee, 0.20, 3, 733);
                 ripples(g, 0xd8e8c8, 0.14, 3, 744); },
      ],
      tile_snow: [
        null,
        (g) => scatter(g, 0x8898b0, 0.18, 7,  0.8, 1.8, 811),
        (g) => scatter(g, 0x8898b0, 0.14, 11, 0.6, 1.2, 822),
        (g) => { scatter(g, 0x8898b0, 0.16, 5, 1.0, 2.0, 833);
                 scatter(g, 0xffffff, 0.18, 4, 0.8, 1.5, 844); },
      ],
      tile_ruins: [
        null,
        (g) => scatter(g, 0x383028, 0.25, 6,  1.0, 2.2, 911),
        (g) => scatter(g, 0x383028, 0.20, 10, 0.7, 1.5, 922),
        (g) => { scatter(g, 0x383028, 0.22, 5, 1.2, 2.4, 933);
                 scatter(g, 0x5a8030, 0.14, 4, 0.8, 1.6, 944); },
      ],
      tile_farmland: [
        null,
        (g) => scatter(g, 0x4a2a10, 0.20, 5,  0.8, 1.6, 1011),
        (g) => scatter(g, 0x4a2a10, 0.16, 8,  0.6, 1.2, 1022),
        (g) => { scatter(g, 0x4a2a10, 0.18, 4, 1.0, 1.8, 1033);
                 scatter(g, 0x78c840, 0.14, 4, 0.6, 1.2, 1044); },
      ],
    };

    for (const [baseKey, variants] of Object.entries(SPECS)) {
      for (let v = 0; v < variants.length; v++) {
        const rt = this.add.renderTexture(0, 0, T, T);
        // SVG source files are 48×48; scale down to T×T
        const img = this.make.image({ key: baseKey, add: false });
        img.setDisplaySize(T, T).setOrigin(0, 0);
        rt.draw(img, 0, 0);
        img.destroy();
        const fn = variants[v];
        if (fn) {
          const g = this.add.graphics();
          fn(g);
          rt.draw(g, 0, 0);
          g.destroy();
        }
        rt.saveTexture(`${baseKey}_${v}`);
        rt.destroy();
      }
    }
  }


  _createUnitTextures() {
    // Generate 36×36 world sprites by scaling down the 96×96 battle SVG images
    const SCALE = 36 / 96;
    const unitKeys = ['paysan','homme_armes','archer','chevalier','garde_roi','croise','mercenaire','compagnie_loup','frere_epee'];
    const heroKeys = ['roi_guerrier','chasseresse','mage_arcane','paladin','assassin','necromancien'];
    const mobKeys  = ['loup','sanglier','ours'];

    const makeWorld = (battleKey, worldKey) => {
      const rt = this.add.renderTexture(0, 0, 36, 36);
      const img = this.make.image({ key: battleKey, add: false });
      img.setScale(SCALE);
      rt.draw(img, 18, 18);
      rt.saveTexture(worldKey);
      img.destroy();
      rt.destroy();
    };

    for (const k of unitKeys) {
      makeWorld(`battle_${k}`,       `unit_${k}`);
      makeWorld(`battle_${k}_enemy`, `unit_${k}_enemy`);
    }
    for (const k of heroKeys) {
      makeWorld(`battle_${k}`,       `unit_${k}`);
      makeWorld(`battle_${k}_enemy`, `unit_${k}_enemy`);
    }
    for (const k of mobKeys) {
      makeWorld(`battle_${k}`,       `unit_${k}`);
      makeWorld(`battle_${k}_enemy`, `unit_${k}_enemy`);
    }

    // Boss tyran reuses garde_roi_enemy sprite (scaled up slightly for intimidation)
    const makeBoss = (srcKey, dstKey) => {
      const rt = this.add.renderTexture(0, 0, 96, 96);
      const img = this.make.image({ key: srcKey, add: false });
      img.setScale(1.15);
      rt.draw(img, 48, 48);
      rt.saveTexture(dstKey);
      img.destroy(); rt.destroy();
    };
    makeBoss('battle_garde_roi_enemy', 'battle_tyran');
    makeBoss('battle_garde_roi_enemy', 'battle_tyran_enemy');
    makeWorld('battle_tyran', 'unit_tyran');
  }
}
