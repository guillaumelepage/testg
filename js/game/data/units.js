// Unit definitions — stats, moves, visuals
export const UNIT_STATS = {
  chevalier: {
    label: 'Chevalier', faction: 'Les Chevaliers',
    maxHp: 120, atk: 35, def: 25, spd: 18,
    color: 0x3a6bbf, accentColor: 0xffd700,
    moves: [
      { name: 'Charge de Cavalerie', moveType: 'CAVALERIE', power: 40, desc: 'Percute l\'ennemi avec force.' },
      { name: 'Coup d\'Épée', moveType: 'LOURD', power: 30, desc: 'Taille franche avec la lame.' },
      { name: 'Piétinement', moveType: 'CAVALERIE', power: 25, desc: 'Écrase l\'adversaire sous les sabots.' },
      { name: 'Garde Noble', moveType: 'LOURD', power: 10, desc: 'Se met en garde — réduit les dégâts reçus.' },
    ],
  },
  garde_roi: {
    label: 'Garde du Roi', faction: 'La Garde du Roi',
    maxHp: 150, atk: 30, def: 35, spd: 12,
    color: 0xc0a020, accentColor: 0xffffff,
    moves: [
      { name: 'Frappe Royale', moveType: 'LOURD', power: 38, desc: 'Coup d\'élite au nom du roi.' },
      { name: 'Bouclier du Roi', moveType: 'LOURD', power: 5, desc: 'Absorbe un coup pour les alliés.' },
      { name: 'Lame Sacrée', moveType: 'MAGIE', power: 28, desc: 'Frappe bénie par la cour.' },
      { name: 'Formation Défensive', moveType: 'LOURD', power: 8, desc: 'Renforce la position.' },
    ],
  },
  homme_armes: {
    label: 'Homme d\'Armes', faction: 'Les Hommes d\'Armes',
    maxHp: 100, atk: 28, def: 22, spd: 15,
    color: 0x7a7a7a, accentColor: 0xcc3333,
    moves: [
      { name: 'Coup de Lance', moveType: 'LOURD', power: 32, desc: 'Perce les armures légères.' },
      { name: 'Mêlée', moveType: 'LOURD', power: 25, desc: 'Combat rapproché chaotique.' },
      { name: 'Bousculade', moveType: 'LOURD', power: 20, desc: 'Repousse l\'adversaire.' },
      { name: 'Riposte', moveType: 'LOURD', power: 15, desc: 'Contre-attaque instantanée.' },
    ],
  },
  archer: {
    label: 'Archer du Duché', faction: 'Les Archers du Duché',
    maxHp: 75, atk: 32, def: 14, spd: 22,
    color: 0x4a8a30, accentColor: 0xc87d2a,
    moves: [
      { name: 'Tir Rapide', moveType: 'LEGER', power: 28, desc: 'Décoche une flèche en un éclair.' },
      { name: 'Pluie de Flèches', moveType: 'LEGER', power: 22, desc: 'Volée de projectiles.' },
      { name: 'Flèche Perçante', moveType: 'LEGER', power: 36, desc: 'Traverse l\'armure.' },
      { name: 'Tir à la Volée', moveType: 'LEGER', power: 18, desc: 'Tirs en arc.' },
    ],
  },
  croise: {
    label: 'Croisé', faction: 'Les Croisés',
    maxHp: 130, atk: 32, def: 28, spd: 13,
    color: 0xffffff, accentColor: 0xdd2222,
    moves: [
      { name: 'Frappe Sainte', moveType: 'MAGIE', power: 38, desc: 'Énergie divine concentrée.' },
      { name: 'Épée de Lumière', moveType: 'MAGIE', power: 32, desc: 'La lame brille d\'un éclat sacré.' },
      { name: 'Jugement Divin', moveType: 'MAGIE', power: 45, desc: 'Attaque ultime — force supérieure.' },
      { name: 'Prière Guerrière', moveType: 'LOURD', power: 10, desc: 'Implore les cieux pour la force.' },
    ],
  },
  mercenaire: {
    label: 'Mercenaire Noir', faction: 'Les Mercenaires Noirs',
    maxHp: 90, atk: 36, def: 16, spd: 20,
    color: 0x1a1a1a, accentColor: 0x880000,
    moves: [
      { name: 'Lame Sombre', moveType: 'LEGER', power: 35, desc: 'Frappe traîtresse depuis l\'ombre.' },
      { name: 'Coup Bas', moveType: 'LEGER', power: 28, desc: 'Vise un point faible.' },
      { name: 'Double Frappe', moveType: 'LEGER', power: 20, desc: 'Deux coups rapides.' },
      { name: 'Embuscade', moveType: 'LEGER', power: 40, desc: 'Surgit de nulle part.' },
    ],
  },
  compagnie_loup: {
    label: 'Compagnie du Loup', faction: 'La Compagnie du Loup',
    maxHp: 85, atk: 30, def: 18, spd: 24,
    color: 0x556b2f, accentColor: 0xe0e0e0,
    moves: [
      { name: 'Morsure du Loup', moveType: 'LEGER', power: 30, desc: 'Attaque fulgurante et sauvage.' },
      { name: 'Ruée', moveType: 'CAVALERIE', power: 28, desc: 'Charge rapide et dévastatrice.' },
      { name: 'Croc d\'Acier', moveType: 'LEGER', power: 36, desc: 'Déchire l\'armure.' },
      { name: 'Hurlement', moveType: 'LEGER', power: 12, desc: 'Affaiblit le moral ennemi.' },
    ],
  },
  frere_epee: {
    label: 'Frère d\'Épée', faction: 'Les Frères d\'Épée',
    maxHp: 110, atk: 33, def: 24, spd: 16,
    color: 0x8b0000, accentColor: 0xc0c0c0,
    moves: [
      { name: 'Serment de l\'Épée', moveType: 'LOURD', power: 35, desc: 'Frappe au nom de la confrérie.' },
      { name: 'Fraternité d\'Armes', moveType: 'LOURD', power: 28, desc: 'Force de la cohésion.' },
      { name: 'Tranchant', moveType: 'LOURD', power: 32, desc: 'Coup diagonal précis.' },
      { name: 'Parade', moveType: 'LOURD', power: 8, desc: 'Repousse la prochaine attaque.' },
    ],
  },
  paysan: {
    label: 'Paysan', faction: 'Les Paysans',
    maxHp: 55, atk: 12, def: 8, spd: 14,
    color: 0xa0784a, accentColor: 0x80a030,
    moves: [
      { name: 'Coup de Faux', moveType: 'LEGER', power: 14, desc: 'Frappe avec l\'outil agricole.' },
      { name: 'Lancer de Pierre', moveType: 'LEGER', power: 10, desc: 'Jette un caillou.' },
      { name: 'Bâton Rustique', moveType: 'LEGER', power: 12, desc: 'Frappe avec un bâton.' },
      { name: 'Fuite !', moveType: 'LEGER', power: 0, desc: 'Abandonne le combat.' },
    ],
  },
  tyran: {
    label: 'Tyran des Ombres', faction: 'Créature Maudite',
    maxHp: 600, atk: 50, def: 40, spd: 10,
    color: 0x3a0a5a, accentColor: 0xff2222,
    moves: [
      { name: 'Rugissement Dévastateur', moveType: 'LOURD',     power: 60, desc: 'Souffle de terreur absolue.' },
      { name: 'Frappe Titanesque',       moveType: 'LOURD',     power: 50, desc: 'Coup d\'une force surnaturelle.' },
      { name: 'Griffe du Tyran',         moveType: 'CAVALERIE', power: 45, desc: 'Lacère tout sur son passage.' },
      { name: 'Terreur Absolue',         moveType: 'MAGIE',     power: 55, desc: 'Énergie maudite dévastatrice.' },
    ],
  },

  // ── Héros ──────────────────────────────────────────────────────────────────
  roi_guerrier: {
    label: 'Roi Guerrier', faction: 'La Cour Royale',
    maxHp: 220, atk: 42, def: 38, spd: 14,
    color: 0xb8860b, accentColor: 0xffd700,
    moves: [
      { name: 'Frappe Royale',  moveType: 'LOURD', power: 45, desc: 'Coup de majesté dévastateur.' },
      { name: 'Décret Martial', moveType: 'LOURD', power: 35, desc: 'Attaque commandée.' },
      { name: 'Garde du Trône', moveType: 'LOURD', power: 15, desc: 'Position défensive.' },
      { name: 'Exécution',      moveType: 'LOURD', power: 60, desc: 'Frappe finale puissante.' },
    ],
  },
  chasseresse: {
    label: 'Chasseresse', faction: 'Les Forestières',
    maxHp: 160, atk: 50, def: 22, spd: 28,
    color: 0x2d7a2d, accentColor: 0x88ff44,
    moves: [
      { name: 'Tir de Précision', moveType: 'LEGER', power: 52, desc: 'Vise le point faible.' },
      { name: 'Pluie de Traits',  moveType: 'LEGER', power: 32, desc: 'Multiples flèches rapides.' },
      { name: 'Piège Forestier',  moveType: 'LEGER', power: 28, desc: 'Ralentit la cible.' },
      { name: 'Flèche Enflammée', moveType: 'MAGIE', power: 42, desc: 'Brûle la cible.' },
    ],
  },
  mage_arcane: {
    label: 'Mage Arcane', faction: 'L\'Ordre Arcanique',
    maxHp: 140, atk: 58, def: 15, spd: 18,
    color: 0x6a0dad, accentColor: 0xcc88ff,
    moves: [
      { name: 'Éclair Arcane',  moveType: 'MAGIE', power: 55, desc: 'Foudre magique concentrée.' },
      { name: 'Boule de Feu',   moveType: 'MAGIE', power: 48, desc: 'Explosif et dévastateur.' },
      { name: 'Gel Temporel',   moveType: 'MAGIE', power: 30, desc: 'Ralentit et endommage.' },
      { name: 'Nova Arcanique', moveType: 'MAGIE', power: 65, desc: 'Explosion magique ultime.' },
    ],
  },
  paladin: {
    label: 'Paladin Sacré', faction: 'L\'Ordre Sacré',
    maxHp: 280, atk: 35, def: 50, spd: 10,
    color: 0x4a6a9a, accentColor: 0x88ccff,
    moves: [
      { name: 'Marteau Divin',   moveType: 'LOURD', power: 38, desc: 'Écrase avec la grâce des cieux.' },
      { name: 'Bouclier de Foi', moveType: 'LOURD', power: 12, desc: 'Réduit les dégâts reçus.' },
      { name: 'Lumière Sacrée',  moveType: 'MAGIE', power: 45, desc: 'Rayon de purification.' },
      { name: 'Jugement Saint',  moveType: 'LOURD', power: 60, desc: 'Frappe ultime au nom du divin.' },
    ],
  },
  assassin: {
    label: 'Assassin', faction: 'La Guilde des Ombres',
    maxHp: 130, atk: 62, def: 12, spd: 36,
    color: 0x1a1a2a, accentColor: 0xcc0044,
    moves: [
      { name: 'Lame Jumelle',    moveType: 'LEGER', power: 48, desc: 'Deux coups simultanés.' },
      { name: 'Croc-en-Jambe',   moveType: 'LEGER', power: 32, desc: 'Déstabilise et frappe.' },
      { name: 'Poison Mortel',   moveType: 'LEGER', power: 40, desc: 'Lame enduite de venin.' },
      { name: 'Ombre Mortelle',  moveType: 'LEGER', power: 70, desc: 'Surgit de l\'obscurité.' },
    ],
  },
  necromancien: {
    label: 'Nécromancien', faction: 'Le Cercle de la Mort',
    maxHp: 150, atk: 60, def: 14, spd: 16,
    color: 0x1a2a14, accentColor: 0x44cc44,
    moves: [
      { name: 'Toucher Nécrotique', moveType: 'MAGIE', power: 52, desc: 'Draine la force vitale.' },
      { name: 'Nuage de Miasme',    moveType: 'MAGIE', power: 38, desc: 'Gaz pestilentiel.' },
      { name: 'Os Brisés',          moveType: 'LOURD', power: 44, desc: 'Invoquer la douleur.' },
      { name: 'Fléau des Morts',    moveType: 'MAGIE', power: 68, desc: 'Énergie de l\'au-delà.' },
    ],
  },

  // ── Unité ennemie spéciale ────────────────────────────────────────────────
  banniere_rouge: {
    label: 'Bannière Rouge', faction: 'L\'Ennemi',
    maxHp: 70, atk: 20, def: 12, spd: 18,
    color: 0xaa1111, accentColor: 0xff4444,
    moves: [
      { name: 'Coup de Hampe',    moveType: 'LOURD',     power: 22, desc: 'Frappe avec le manche de la bannière.' },
      { name: 'Charge de Guerre', moveType: 'CAVALERIE', power: 28, desc: 'Fonce vers l\'ennemi.' },
      { name: 'Ralliement',       moveType: 'LOURD',     power: 15, desc: 'Galvanise les troupes.' },
      { name: 'Frappe Rapide',    moveType: 'LEGER',     power: 18, desc: 'Attaque soudaine.' },
    ],
  },

  // ── Mobs neutres ───────────────────────────────────────────────────────────
  loup: {
    label: 'Loup Sauvage', faction: 'Faune',
    maxHp: 25, atk: 15, def: 5, spd: 20,
    color: 0x556644, accentColor: 0xaaaaaa,
    moves: [
      { name: 'Morsure',        moveType: 'LEGER', power: 12, desc: 'Mord violemment.' },
      { name: 'Griffe',         moveType: 'LEGER', power: 10, desc: 'Lacère de ses griffes.' },
      { name: 'Charge de Meute',moveType: 'LEGER', power: 14, desc: 'Attaque coordonnée.' },
      { name: 'Hurlement',      moveType: 'LEGER', power: 8,  desc: 'Déstabilise l\'adversaire.' },
    ],
  },
  sanglier: {
    label: 'Sanglier', faction: 'Faune',
    maxHp: 40, atk: 18, def: 10, spd: 14,
    color: 0x5a3a1a, accentColor: 0xddaa66,
    moves: [
      { name: 'Charge Sauvage', moveType: 'CAVALERIE', power: 16, desc: 'Percute de plein fouet.' },
      { name: 'Coup de Défense',moveType: 'CAVALERIE', power: 12, desc: 'Frappe avec ses défenses.' },
      { name: 'Ruée',           moveType: 'CAVALERIE', power: 18, desc: 'Fonce sans s\'arrêter.' },
      { name: 'Piétinement',    moveType: 'CAVALERIE', power: 10, desc: 'Écrase sous son poids.' },
    ],
  },
  ours: {
    label: 'Ours des Bois', faction: 'Faune',
    maxHp: 65, atk: 22, def: 15, spd: 10,
    color: 0x5a3a20, accentColor: 0xc08840,
    moves: [
      { name: 'Griffe',         moveType: 'LOURD', power: 20, desc: 'Lacère profondément.' },
      { name: 'Morsure Féroce', moveType: 'LOURD', power: 18, desc: 'Mâchoire implacable.' },
      { name: 'Charge Lourde',  moveType: 'LOURD', power: 22, desc: 'Écrase de tout son poids.' },
      { name: 'Rugissement',    moveType: 'LOURD', power: 8,  desc: 'Intimide l\'adversaire.' },
    ],
  },
};

// Type effectiveness chart (attacker type -> defender type -> multiplier)
// Shared with server — single source of truth in shared/gameData.js
const _gd = require('../../../shared/gameData');
export const TYPE_CHART    = _gd.TYPE_CHART;
export const UNIT_MOVE_TYPE = _gd.UNIT_MOVE_TYPE;

// Units available to train per building type
export const BARRACKS_UNITS = ['homme_armes', 'archer', 'frere_epee'];
export const STABLE_UNITS = ['chevalier', 'compagnie_loup'];
export const MARKET_UNITS = ['mercenaire'];
export const CHURCH_UNITS = ['croise', 'garde_roi'];

export const UNIT_COSTS = {
  paysan: { food: 50 },
  homme_armes: { food: 60, gold: 40 },
  archer: { wood: 20, food: 50, gold: 30 },
  chevalier: { food: 80, gold: 80 },
  croise: { food: 70, gold: 70 },
  mercenaire: { gold: 100 },
  compagnie_loup: { food: 60, gold: 50 },
  frere_epee: { food: 65, gold: 55 },
};