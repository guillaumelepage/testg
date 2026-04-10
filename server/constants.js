'use strict';

// ── Map dimensions ─────────────────────────────────────────────────────────────
const MAP_WIDTH  = 160;
const MAP_HEIGHT = 120;

// ── Tile type indices (must match TILE_KEYS order in WorldScene.js) ────────────
const T = {
  GRASS: 0, DARK_GRASS: 1, WATER: 2, SAND: 3, DIRT: 4, FOREST: 5, MOUNTAIN: 6,
  MARSH: 7, PATH: 8, SHALLOW_WATER: 9, SNOW: 10, RUINS: 11, FARMLAND: 12,
};

// ── Terrain movement speed multipliers (tiles/tick, applied to _moveAccum) ─────
// Tiles not listed default to 1.0
const TILE_SPEED_FACTOR = {
  [T.MARSH]:         0.45,
  [T.SHALLOW_WATER]: 0.55,
  [T.PATH]:          1.6,
};

// ── Population ─────────────────────────────────────────────────────────────────
const POP = {
  YEAR_TICKS:     20,   // 1 in-game year = 20 real seconds
  ADULT_AGE:      16,   // years to reach adulthood
  get ADULT_TICKS() { return this.YEAR_TICKS * this.ADULT_AGE; }, // 320 ticks
  REPRO_COOLDOWN: 240,  // ticks between births per house (4 min)
  SDF_TIMEOUT:    90,   // ticks homeless before turning enemy (1.5 min)
  HOUSE_CAPACITY: 2,    // adults per house
};

// ── Construction times (ticks = seconds) ──────────────────────────────────────
const BUILD_TIMES = {
  house: 10, barracks: 20, farm: 8, mine: 15,
  lumber_mill: 12, market: 18, tower: 20, church: 25, stable: 20, wall: 3,
};

// ── Unit movement speed (tiles/tick base) ──────────────────────────────────────
const UNIT_SPEED = {
  roi_guerrier: 1.8, chasseresse: 1.8, mage_arcane: 1.8,
  paladin: 1.8, assassin: 1.8, necromancien: 1.8,
  homme_armes: 1.4, archer: 1.4, chevalier: 1.4,
  garde_roi: 1.4, croise: 1.4, mercenaire: 1.4,
  compagnie_loup: 1.4, frere_epee: 1.4, banniere_rouge: 1.4,
  paysan: 1.0,
  tyran: 1.2,
};

// ── Type chart + combat type per unit (shared with client via shared/gameData.js) ─
const { TYPE_CHART, UNIT_MOVE_TYPE } = require('../shared/gameData');

// ── Unit base stats (server-side combat) ───────────────────────────────────────
const UNIT_BASE_STATS = {
  chevalier: {
    maxHp: 120, atk: 35, def: 25, spd: 18,
    moves: [
      { name: 'Charge de Cavalerie', moveType: 'CAVALERIE', power: 40 },
      { name: "Coup d'Épée",          moveType: 'LOURD',     power: 30 },
      { name: 'Piétinement',          moveType: 'CAVALERIE', power: 25 },
      { name: 'Garde Noble',          moveType: 'LOURD',     power: 10 },
    ],
  },
  garde_roi: {
    maxHp: 150, atk: 30, def: 35, spd: 12,
    moves: [
      { name: 'Frappe Royale',       moveType: 'LOURD', power: 38 },
      { name: 'Bouclier du Roi',     moveType: 'LOURD', power: 5  },
      { name: 'Lame Sacrée',         moveType: 'MAGIE', power: 28 },
      { name: 'Formation Défensive', moveType: 'LOURD', power: 8  },
    ],
  },
  homme_armes: {
    maxHp: 100, atk: 28, def: 22, spd: 15,
    moves: [
      { name: 'Coup de Lance', moveType: 'LOURD', power: 32 },
      { name: 'Mêlée',         moveType: 'LOURD', power: 25 },
      { name: 'Bousculade',    moveType: 'LOURD', power: 20 },
      { name: 'Riposte',       moveType: 'LOURD', power: 15 },
    ],
  },
  archer: {
    maxHp: 75, atk: 32, def: 14, spd: 22,
    moves: [
      { name: 'Tir Rapide',       moveType: 'LEGER', power: 28 },
      { name: 'Pluie de Flèches', moveType: 'LEGER', power: 22 },
      { name: 'Flèche Perçante',  moveType: 'LEGER', power: 36 },
      { name: 'Tir à la Volée',   moveType: 'LEGER', power: 18 },
    ],
  },
  croise: {
    maxHp: 130, atk: 32, def: 28, spd: 13,
    moves: [
      { name: 'Frappe Sainte',    moveType: 'MAGIE', power: 38 },
      { name: 'Épée de Lumière',  moveType: 'MAGIE', power: 32 },
      { name: 'Jugement Divin',   moveType: 'MAGIE', power: 45 },
      { name: 'Prière Guerrière', moveType: 'LOURD', power: 10 },
    ],
  },
  mercenaire: {
    maxHp: 90, atk: 36, def: 16, spd: 20,
    moves: [
      { name: 'Lame Sombre',   moveType: 'LEGER', power: 35 },
      { name: 'Coup Bas',      moveType: 'LEGER', power: 28 },
      { name: 'Double Frappe', moveType: 'LEGER', power: 20 },
      { name: 'Embuscade',     moveType: 'LEGER', power: 40 },
    ],
  },
  compagnie_loup: {
    maxHp: 85, atk: 30, def: 18, spd: 24,
    moves: [
      { name: 'Morsure du Loup', moveType: 'LEGER',     power: 30 },
      { name: 'Ruée',            moveType: 'CAVALERIE', power: 28 },
      { name: "Croc d'Acier",    moveType: 'LEGER',     power: 36 },
      { name: 'Hurlement',       moveType: 'LEGER',     power: 12 },
    ],
  },
  frere_epee: {
    maxHp: 110, atk: 33, def: 24, spd: 16,
    moves: [
      { name: "Serment de l'Épée",  moveType: 'LOURD', power: 35 },
      { name: "Fraternité d'Armes", moveType: 'LOURD', power: 28 },
      { name: 'Tranchant',          moveType: 'LOURD', power: 32 },
      { name: 'Parade',             moveType: 'LOURD', power: 8  },
    ],
  },
  paysan: {
    maxHp: 55, atk: 12, def: 8, spd: 14,
    moves: [
      { name: 'Coup de Faux',     moveType: 'LEGER', power: 14 },
      { name: 'Lancer de Pierre', moveType: 'LEGER', power: 10 },
      { name: 'Bâton Rustique',   moveType: 'LEGER', power: 12 },
      { name: 'Fuite !',          moveType: 'LEGER', power: 0  },
    ],
  },
  loup: {
    maxHp: 25, atk: 15, def: 5, spd: 20, reward: 10,
    moves: [
      { name: 'Morsure',         moveType: 'LEGER', power: 12 },
      { name: 'Griffe',          moveType: 'LEGER', power: 10 },
      { name: 'Charge de Meute', moveType: 'LEGER', power: 14 },
      { name: 'Hurlement',       moveType: 'LEGER', power: 8  },
    ],
  },
  sanglier: {
    maxHp: 40, atk: 18, def: 10, spd: 14, reward: 18,
    moves: [
      { name: 'Charge Sauvage',  moveType: 'CAVALERIE', power: 16 },
      { name: 'Coup de Défense', moveType: 'CAVALERIE', power: 12 },
      { name: 'Ruée',            moveType: 'CAVALERIE', power: 18 },
      { name: 'Piétinement',     moveType: 'CAVALERIE', power: 10 },
    ],
  },
  ours: {
    maxHp: 65, atk: 22, def: 15, spd: 10, reward: 30,
    moves: [
      { name: 'Griffe',         moveType: 'LOURD', power: 20 },
      { name: 'Morsure Féroce', moveType: 'LOURD', power: 18 },
      { name: 'Charge Lourde',  moveType: 'LOURD', power: 22 },
      { name: 'Rugissement',    moveType: 'LOURD', power: 8  },
    ],
  },
  banniere_rouge: {
    maxHp: 70, atk: 20, def: 12, spd: 18,
    moves: [
      { name: 'Coup de Hampe',    moveType: 'LOURD',     power: 22 },
      { name: 'Charge de Guerre', moveType: 'CAVALERIE', power: 28 },
      { name: 'Ralliement',       moveType: 'LOURD',     power: 15 },
      { name: 'Frappe Rapide',    moveType: 'LEGER',     power: 18 },
    ],
  },
  tyran: {
    maxHp: 600, atk: 50, def: 40, spd: 10, reward: 300,
    moves: [
      { name: 'Rugissement Dévastateur', moveType: 'LOURD',     power: 60 },
      { name: 'Frappe Titanesque',       moveType: 'LOURD',     power: 50 },
      { name: 'Griffe du Tyran',         moveType: 'CAVALERIE', power: 45 },
      { name: 'Terreur Absolue',         moveType: 'MAGIE',     power: 55 },
    ],
  },
};

// ── Hero base stats ───────────────────────────────────────────────────────────
const HERO_BASE_STATS = {
  roi_guerrier: {
    maxHp: 220, atk: 42, def: 38, spd: 14,
    moves: [
      { name: 'Frappe Royale',  moveType: 'LOURD', power: 45 },
      { name: 'Décret Martial', moveType: 'LOURD', power: 35 },
      { name: 'Garde du Trône', moveType: 'LOURD', power: 15 },
      { name: 'Exécution',      moveType: 'LOURD', power: 60 },
    ],
    startEquip: { weapon: 'epee_rouille', armor: 'armure_rouille', accessory: null },
  },
  chasseresse: {
    maxHp: 160, atk: 50, def: 22, spd: 28,
    moves: [
      { name: 'Tir de Précision', moveType: 'LEGER', power: 52 },
      { name: 'Pluie de Traits',  moveType: 'LEGER', power: 32 },
      { name: 'Piège Forestier',  moveType: 'LEGER', power: 28 },
      { name: 'Flèche Enflammée', moveType: 'MAGIE', power: 42 },
    ],
    startEquip: { weapon: 'arc_primitif', armor: 'armure_rouille', accessory: null },
  },
  mage_arcane: {
    maxHp: 140, atk: 58, def: 15, spd: 18,
    moves: [
      { name: 'Éclair Arcane',  moveType: 'MAGIE', power: 55 },
      { name: 'Boule de Feu',   moveType: 'MAGIE', power: 48 },
      { name: 'Gel Temporel',   moveType: 'MAGIE', power: 30 },
      { name: 'Nova Arcanique', moveType: 'MAGIE', power: 65 },
    ],
    startEquip: { weapon: 'baton_bois', armor: 'robe_bure', accessory: null },
  },
  paladin: {
    maxHp: 280, atk: 35, def: 50, spd: 10,
    moves: [
      { name: 'Marteau Divin',   moveType: 'LOURD', power: 38 },
      { name: 'Bouclier de Foi', moveType: 'LOURD', power: 12 },
      { name: 'Lumière Sacrée',  moveType: 'MAGIE', power: 45 },
      { name: 'Jugement Saint',  moveType: 'LOURD', power: 60 },
    ],
    startEquip: { weapon: 'epee_rouille', armor: 'armure_rouille', accessory: null },
  },
  assassin: {
    maxHp: 130, atk: 62, def: 12, spd: 36,
    moves: [
      { name: 'Lame Jumelle',   moveType: 'LEGER', power: 48 },
      { name: 'Croc-en-Jambe',  moveType: 'LEGER', power: 32 },
      { name: 'Poison Mortel',  moveType: 'LEGER', power: 40 },
      { name: 'Ombre Mortelle', moveType: 'LEGER', power: 70 },
    ],
    startEquip: { weapon: 'epee_rouille', armor: 'armure_rouille', accessory: null },
  },
  necromancien: {
    maxHp: 150, atk: 60, def: 14, spd: 16,
    moves: [
      { name: 'Toucher Nécrotique', moveType: 'MAGIE', power: 52 },
      { name: 'Nuage de Miasme',    moveType: 'MAGIE', power: 38 },
      { name: 'Os Brisés',          moveType: 'LOURD', power: 44 },
      { name: 'Fléau des Morts',    moveType: 'MAGIE', power: 68 },
    ],
    startEquip: { weapon: 'baton_bois', armor: 'robe_bure', accessory: null },
  },
};

// Merge heroes into UNIT_BASE_STATS for battle lookup
Object.assign(UNIT_BASE_STATS, HERO_BASE_STATS);

// ── Building costs ─────────────────────────────────────────────────────────────
const BUILDING_COSTS = {
  house:       { wood: 50 },
  barracks:    { wood: 80, stone: 60, gold: 20 },
  farm:        { wood: 40 },
  mine:        { wood: 60, stone: 40 },
  lumber_mill: { wood: 50, stone: 30 },
  market:      { wood: 60, stone: 40, gold: 30 },
  tower:       { wood: 40, stone: 80, gold: 20 },
  church:      { wood: 70, stone: 80, gold: 40 },
  stable:      { wood: 80, stone: 30, food: 40 },
  wall:        { stone: 15, wood: 5 },
};

// ── Unit training costs ────────────────────────────────────────────────────────
const UNIT_COSTS = {
  paysan:         { food: 50 },
  homme_armes:    { food: 60, gold: 40 },
  archer:         { wood: 20, food: 50, gold: 30 },
  chevalier:      { food: 80, gold: 80 },
  croise:         { food: 70, gold: 70 },
  mercenaire:     { gold: 100 },
  compagnie_loup: { food: 60, gold: 50 },
  frere_epee:     { food: 65, gold: 55 },
};

// ── Hero XP thresholds (index = level) ────────────────────────────────────────
const XP_PER_LEVEL = [0, 0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700];

// ── Equipment slot map ────────────────────────────────────────────────────────
const EQUIP_SLOT_MAP = {
  epee_rouille: 'weapon', epee_bronze: 'weapon', epee_argent: 'weapon', epee_or: 'weapon',
  arc_primitif: 'weapon', arc_long: 'weapon', arc_composite: 'weapon',
  baton_bois: 'weapon', baton_runes: 'weapon', baton_cristal: 'weapon',
  armure_rouille: 'armor', armure_bronze: 'armor', armure_argent: 'armor',
  robe_bure: 'armor', robe_enchantee: 'armor',
  amulette_chance: 'accessory', collier_vie: 'accessory', anneau_force: 'accessory',
};

// ── NPC definitions ───────────────────────────────────────────────────────────
const SERVER_NPC_DEFS = [
  { id: 'npc_ermite',   type: 'ermite',   name: 'Vieux Gontran',     x: 22, y: 22,
    quest: { id: 'q_loups',   label: 'La Menace des Loups',
      desc: 'Des loups rôdent près de ma hutte. Éliminez-en 3.',
      type: 'kill_mobs', target: 'loup', needed: 3,
      xpReward: 80,  resReward: { food: 50 },            equipReward: 'epee_bronze' } },
  { id: 'npc_marchand', type: 'marchand', name: 'Aldric le Marchand', x: 42, y: 28,
    quest: { id: 'q_marche',  label: 'Le Commerce Florissant',
      desc: 'Construisez un marché pour relancer les échanges.',
      type: 'build', target: 'market', needed: 1,
      xpReward: 120, resReward: { gold: 80 },             equipReward: 'amulette_chance' } },
  { id: 'npc_chef',     type: 'ancien',   name: 'Dame Éléonore',      x: 58, y: 18,
    quest: { id: 'q_soldats', label: 'Lever une Armée',
      desc: 'Recrutez 5 soldats pour défendre le royaume.',
      type: 'train_units', target: null, needed: 5,
      xpReward: 150, resReward: { gold: 100, food: 50 }, equipReward: 'armure_bronze' } },
  { id: 'npc_scout',    type: 'scout',    name: "Raban l'Éclaireur",  x: 32, y: 44,
    quest: { id: 'q_ours',    label: 'Le Grand Ours',
      desc: 'Un ours terrifiant menace nos forêts. Abattez-le !',
      type: 'kill_mobs', target: 'ours', needed: 1,
      xpReward: 200, resReward: { stone: 100 },           equipReward: 'arc_long' } },
  { id: 'npc_pretre',   type: 'pretre',   name: 'Frère Ansbert',      x: 52, y: 48,
    quest: { id: 'q_eglise',  label: 'La Maison de Dieu',
      desc: 'Érigez une église pour bénir notre peuple.',
      type: 'build', target: 'church', needed: 1,
      xpReward: 180, resReward: { gold: 60, food: 80 },  equipReward: 'collier_vie' } },
  { id: 'npc_seigneur', type: 'seigneur', name: 'Seigneur Bertrand',  x: 12, y: 42,
    quest: { id: 'q_ennemi',  label: "Écraser l'Ennemi",
      desc: 'Détruisez 2 bâtiments du camp ennemi !',
      type: 'destroy_buildings', target: null, needed: 2,
      xpReward: 300, resReward: { gold: 150, stone: 100 }, equipReward: 'epee_argent' } },
];

// ── Village tier definitions (consolidated from village/ai systems) ─────────────
const VILLAGE_TIER = {
  1: { towerHp: 200, guardType: 'homme_armes', guardHp: 50,  guardCount: 1, lootMul: 0.7, counterUnit: 'homme_armes' },
  2: { towerHp: 280, guardType: 'homme_armes', guardHp: 70,  guardCount: 2, lootMul: 1.0, counterUnit: 'homme_armes' },
  3: { towerHp: 350, guardType: 'frere_epee',  guardHp: 90,  guardCount: 2, lootMul: 1.3, counterUnit: 'frere_epee'  },
  4: { towerHp: 440, guardType: 'croise',      guardHp: 110, guardCount: 2, lootMul: 1.7, counterUnit: 'croise'      },
  5: { towerHp: 550, guardType: 'garde_roi',   guardHp: 140, guardCount: 3, lootMul: 2.2, counterUnit: 'garde_roi'   },
};

// ── Dungeon definitions ────────────────────────────────────────────────────────
const DUNGEON_DEFS = [
  {
    pos: { x: 25, y: 20 },
    artifact: { name: 'Cœur de Fer', stat: 'hp', value: 30 },
    rooms: [
      { name: 'Entrée sombre',      mobs: [{ type: 'loup', hp: 45 }, { type: 'sanglier', hp: 60 }] },
      { name: 'Couloir hanté',      mobs: [{ type: 'homme_armes', hp: 80 }, { type: 'archer', hp: 65 }, { type: 'loup', hp: 45 }] },
      { name: 'Gardien du Tombeau', mobs: [{ type: 'garde_roi', hp: 200 }] },
    ],
  },
  {
    pos: { x: 52, y: 36 },
    artifact: { name: 'Lame Maudite', stat: 'atk', value: 8 },
    rooms: [
      { name: 'Antre des brigands', mobs: [{ type: 'mercenaire', hp: 70 }, { type: 'compagnie_loup', hp: 75 }] },
      { name: 'Salle des gardes',   mobs: [{ type: 'chevalier', hp: 95 }, { type: 'homme_armes', hp: 80 }, { type: 'archer', hp: 65 }] },
      { name: 'Chef des Pillards',  mobs: [{ type: 'croise', hp: 220 }] },
    ],
  },
  {
    pos: { x: 32, y: 46 },
    artifact: { name: 'Égide Ancienne', stat: 'def', value: 6 },
    rooms: [
      { name: 'Crypte profonde',       mobs: [{ type: 'sanglier', hp: 65 }, { type: 'ours', hp: 90 }] },
      { name: 'Salle maudite',         mobs: [{ type: 'frere_epee', hp: 90 }, { type: 'croise', hp: 95 }] },
      { name: "Seigneur de l'Ombre",   mobs: [{ type: 'chevalier', hp: 240 }] },
    ],
  },
];

module.exports = {
  MAP_WIDTH, MAP_HEIGHT,
  T, TILE_SPEED_FACTOR,
  POP, BUILD_TIMES,
  UNIT_SPEED, TYPE_CHART, UNIT_MOVE_TYPE,
  UNIT_BASE_STATS, HERO_BASE_STATS,
  BUILDING_COSTS, UNIT_COSTS,
  XP_PER_LEVEL, EQUIP_SLOT_MAP,
  SERVER_NPC_DEFS,
  VILLAGE_TIER, DUNGEON_DEFS,
};