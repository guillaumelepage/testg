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
};

// Type effectiveness chart (attacker type -> defender type -> multiplier)
export const TYPE_CHART = {
  LOURD: { LOURD: 1.0, LEGER: 1.5, CAVALERIE: 0.5, MAGIE: 0.5 },
  LEGER: { LOURD: 0.7, LEGER: 1.0, CAVALERIE: 1.0, MAGIE: 1.2 },
  CAVALERIE: { LOURD: 1.5, LEGER: 1.0, CAVALERIE: 1.0, MAGIE: 0.7 },
  MAGIE: { LOURD: 1.5, LEGER: 0.8, CAVALERIE: 1.2, MAGIE: 1.0 },
};

export const UNIT_MOVE_TYPE = {
  chevalier: 'CAVALERIE',
  garde_roi: 'LOURD',
  homme_armes: 'LOURD',
  archer: 'LEGER',
  croise: 'LOURD',
  mercenaire: 'LEGER',
  compagnie_loup: 'LEGER',
  frere_epee: 'LOURD',
  paysan: 'LEGER',
};

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