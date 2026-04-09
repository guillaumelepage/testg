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

    // Tile SVGs (feTurbulence noise)
    this.load.image('tile_grass',      'assets/tiles/grass.svg');
    this.load.image('tile_dark_grass', 'assets/tiles/dark_grass.svg');
    this.load.image('tile_water',      'assets/tiles/water.svg');
    this.load.image('tile_sand',       'assets/tiles/sand.svg');
    this.load.image('tile_forest',     'assets/tiles/forest.svg');
    this.load.image('tile_mountain',   'assets/tiles/mountain.svg');
    this.load.image('tile_dirt',       'assets/tiles/dirt.svg');
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
    this.scene.start('Menu');
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
