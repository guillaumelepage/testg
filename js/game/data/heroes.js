// ── Hero definitions ──────────────────────────────────────────────────────────
export const HERO_DEFS = {
  roi_guerrier: {
    label: 'Roi Guerrier', icon: '👑',
    desc: 'Combattant lourd, inspire ses alliés. Fort défenseur au corps-à-corps.',
    color: 0xb8860b, accent: 0xffd700,
    maxHp: 220, atk: 42, def: 38, spd: 14, visionRadius: 6,
    moveType: 'LOURD',
    moves: [
      { name: 'Frappe Royale',  moveType: 'LOURD', power: 45, desc: 'Coup de majesté dévastateur.' },
      { name: 'Décret Martial', moveType: 'LOURD', power: 35, desc: 'Attaque commandée.' },
      { name: 'Garde du Trône', moveType: 'LOURD', power: 15, desc: 'Position défensive.' },
      { name: 'Exécution',      moveType: 'LOURD', power: 60, desc: 'Frappe finale puissante.' },
    ],
    startEquip: { weapon: 'epee_rouille', armor: 'armure_rouille', accessory: null },
  },
  chasseresse: {
    label: 'Chasseresse', icon: '🏹',
    desc: "Tireuse d'élite. Excellente contre les créatures sauvages. Grande portée de vision.",
    color: 0x2d7a2d, accent: 0x88ff44,
    maxHp: 160, atk: 50, def: 22, spd: 28, visionRadius: 8,
    moveType: 'LEGER',
    moves: [
      { name: 'Tir de Précision', moveType: 'LEGER', power: 52, desc: 'Vise le point faible.' },
      { name: 'Pluie de Traits',  moveType: 'LEGER', power: 32, desc: 'Multiples flèches rapides.' },
      { name: 'Piège Forestier',  moveType: 'LEGER', power: 28, desc: 'Ralentit la cible.' },
      { name: 'Flèche Enflammée', moveType: 'MAGIE', power: 42, desc: 'Brûle la cible.' },
    ],
    startEquip: { weapon: 'arc_primitif', armor: 'armure_rouille', accessory: null },
  },
  mage_arcane: {
    label: 'Mage Arcane', icon: '🔮',
    desc: 'Puissance magique dévastatrice. Fragile au corps-à-corps. Parfait contre les armures.',
    color: 0x6a0dad, accent: 0xcc88ff,
    maxHp: 140, atk: 58, def: 15, spd: 18, visionRadius: 5,
    moveType: 'MAGIE',
    moves: [
      { name: 'Éclair Arcane',  moveType: 'MAGIE', power: 55, desc: 'Foudre magique concentrée.' },
      { name: 'Boule de Feu',   moveType: 'MAGIE', power: 48, desc: 'Explosif et dévastateur.' },
      { name: 'Gel Temporel',   moveType: 'MAGIE', power: 30, desc: 'Ralentit et endommage.' },
      { name: 'Nova Arcanique', moveType: 'MAGIE', power: 65, desc: 'Explosion magique ultime.' },
    ],
    startEquip: { weapon: 'baton_bois', armor: 'robe_bure', accessory: null },
  },
  paladin: {
    label: 'Paladin Sacré', icon: '🛡',
    desc: 'Bastion indestructible béni par la lumière. Absorbe les coups pour ses alliés.',
    color: 0x4a6a9a, accent: 0x88ccff,
    maxHp: 280, atk: 35, def: 50, spd: 10, visionRadius: 5,
    moveType: 'LOURD',
    moves: [
      { name: 'Marteau Divin',   moveType: 'LOURD', power: 38, desc: 'Écrase avec la grâce des cieux.' },
      { name: 'Bouclier de Foi', moveType: 'LOURD', power: 12, desc: 'Réduit les dégâts reçus.' },
      { name: 'Lumière Sacrée',  moveType: 'MAGIE', power: 45, desc: 'Rayon de purification.' },
      { name: 'Jugement Saint',  moveType: 'LOURD', power: 60, desc: 'Frappe ultime au nom du divin.' },
    ],
    startEquip: { weapon: 'epee_rouille', armor: 'armure_rouille', accessory: null },
  },
  assassin: {
    label: 'Assassin', icon: '🗡',
    desc: 'Ombre implacable. Frappe en premier et disparaît. Lames empoisonnées.',
    color: 0x1a1a2a, accent: 0xcc0044,
    maxHp: 130, atk: 62, def: 12, spd: 36, visionRadius: 7,
    moveType: 'LEGER',
    moves: [
      { name: 'Lame Jumelle',    moveType: 'LEGER', power: 48, desc: 'Deux coups simultanés.' },
      { name: 'Croc-en-Jambe',   moveType: 'LEGER', power: 32, desc: 'Déstabilise et frappe.' },
      { name: 'Poison Mortel',   moveType: 'LEGER', power: 40, desc: 'Lame enduite de venin.' },
      { name: 'Ombre Mortelle',  moveType: 'LEGER', power: 70, desc: 'Surgit de l\'obscurité.' },
    ],
    startEquip: { weapon: 'epee_rouille', armor: 'armure_rouille', accessory: null },
  },
  necromancien: {
    label: 'Nécromancien', icon: '💀',
    desc: 'Maître de la mort et du chaos. Puissance nécrotique dévastatrice. Voit loin dans l\'obscurité.',
    color: 0x1a2a14, accent: 0x44cc44,
    maxHp: 150, atk: 60, def: 14, spd: 16, visionRadius: 9,
    moveType: 'MAGIE',
    moves: [
      { name: 'Toucher Nécrotique', moveType: 'MAGIE', power: 52, desc: 'Draine la force vitale.' },
      { name: 'Nuage de Miasme',    moveType: 'MAGIE', power: 38, desc: 'Gaz pestilentiel.' },
      { name: 'Os Brisés',          moveType: 'LOURD', power: 44, desc: 'Invoquer la douleur.' },
      { name: 'Fléau des Morts',    moveType: 'MAGIE', power: 68, desc: 'Énergie de l\'au-delà.' },
    ],
    startEquip: { weapon: 'baton_bois', armor: 'robe_bure', accessory: null },
  },
};

// XP required to reach level N (index = level, level 1 = 0 XP)
export const XP_PER_LEVEL = [0, 0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700];

// ── Equipment ─────────────────────────────────────────────────────────────────
const EQ = (label, slot, bonus) => ({ label, slot, bonus });
export const EQUIPMENT_DEFS = {
  epee_rouille:    EQ('Épée Rouillée',    'weapon',    { atk: 0  }),
  epee_bronze:     EQ('Épée de Bronze',   'weapon',    { atk: 8  }),
  epee_argent:     EQ("Lame d'Argent",    'weapon',    { atk: 18 }),
  epee_or:         EQ('Épée Dorée',       'weapon',    { atk: 30 }),
  arc_primitif:    EQ('Arc Primitif',     'weapon',    { atk: 0  }),
  arc_long:        EQ('Arc Long',         'weapon',    { atk: 10 }),
  arc_composite:   EQ('Arc Composite',    'weapon',    { atk: 22 }),
  baton_bois:      EQ('Bâton de Bois',    'weapon',    { atk: 0  }),
  baton_runes:     EQ('Bâton de Runes',   'weapon',    { atk: 12 }),
  baton_cristal:   EQ('Bâton de Cristal', 'weapon',    { atk: 25 }),
  armure_rouille:  EQ('Armure Rouillée',  'armor',     { def: 0,  maxHp: 0  }),
  armure_bronze:   EQ('Armure de Bronze', 'armor',     { def: 8,  maxHp: 30 }),
  armure_argent:   EQ("Armure d'Argent",  'armor',     { def: 18, maxHp: 50 }),
  robe_bure:       EQ('Robe de Bure',     'armor',     { def: 0,  maxHp: 0  }),
  robe_enchantee:  EQ('Robe Enchantée',   'armor',     { def: 10, maxHp: 20 }),
  amulette_chance: EQ('Amulette Chanceuse','accessory', { spd: 3   }),
  collier_vie:     EQ('Collier de Vie',   'accessory', { maxHp: 40 }),
  anneau_force:    EQ("Anneau de Force",  'accessory', { atk: 5   }),
};

// ── NPC quest givers — fixed map positions ────────────────────────────────────
export const NPC_DEFS = [
  {
    id: 'npc_ermite',   type: 'ermite',   name: 'Vieux Gontran',      x: 22, y: 22,
    quest: { id: 'q_loups',    label: 'La Menace des Loups',
      desc: 'Des loups rôdent près de ma hutte. Éliminez-en 3 pour ma tranquillité.',
      type: 'kill_mobs', target: 'loup', needed: 3,
      xpReward: 80,  resReward: { food: 50 },           equipReward: 'epee_bronze' },
  },
  {
    id: 'npc_marchand', type: 'marchand', name: 'Aldric le Marchand',  x: 42, y: 28,
    quest: { id: 'q_marche',   label: 'Le Commerce Florissant',
      desc: 'Construisez un marché pour relancer les échanges entre villages.',
      type: 'build', target: 'market', needed: 1,
      xpReward: 120, resReward: { gold: 80 },            equipReward: 'amulette_chance' },
  },
  {
    id: 'npc_chef',     type: 'ancien',   name: 'Dame Éléonore',       x: 58, y: 18,
    quest: { id: 'q_soldats',  label: "Lever une Armée",
      desc: 'Recrutez 5 soldats pour défendre le royaume.',
      type: 'train_units', target: null, needed: 5,
      xpReward: 150, resReward: { gold: 100, food: 50 }, equipReward: 'armure_bronze' },
  },
  {
    id: 'npc_scout',    type: 'scout',    name: "Raban l'Éclaireur",   x: 32, y: 44,
    quest: { id: 'q_ours',    label: 'Le Grand Ours',
      desc: 'Un ours terrifiant menace nos forêts. Abattez-le !',
      type: 'kill_mobs', target: 'ours', needed: 1,
      xpReward: 200, resReward: { stone: 100 },          equipReward: 'arc_long' },
  },
  {
    id: 'npc_pretre',   type: 'pretre',   name: 'Frère Ansbert',       x: 52, y: 48,
    quest: { id: 'q_eglise',  label: 'La Maison de Dieu',
      desc: 'Érigez une église pour bénir notre peuple.',
      type: 'build', target: 'church', needed: 1,
      xpReward: 180, resReward: { gold: 60, food: 80 },  equipReward: 'collier_vie' },
  },
  {
    id: 'npc_seigneur', type: 'seigneur', name: 'Seigneur Bertrand',   x: 12, y: 42,
    quest: { id: 'q_ennemi',  label: "Écraser l'Ennemi",
      desc: 'Détruisez 2 bâtiments du camp ennemi !',
      type: 'destroy_buildings', target: null, needed: 2,
      xpReward: 300, resReward: { gold: 150, stone: 100 }, equipReward: 'epee_argent' },
  },
];