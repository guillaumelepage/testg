export const BUILDING_DATA = {
  town_hall: {
    label: 'Hôtel de Ville', icon: '🏰',
    size: 3, color: 0x8b5e3c, roofColor: 0x6b3a1f,
    hp: 500, maxHp: 500,
    cost: null, // not buildable, starting building
    produces: ['paysan'],
    desc: 'Quartier général de votre village. Dépose les ressources ici.',
  },
  house: {
    label: 'Maison', icon: '🏠',
    size: 2, color: 0xcd9d5a, roofColor: 0x993322,
    hp: 150, maxHp: 150,
    cost: { wood: 50 },
    produces: [],
    desc: 'Augmente la population maximale.',
  },
  barracks: {
    label: 'Caserne', icon: '⚔️',
    size: 2, color: 0x5a5a5a, roofColor: 0x333333,
    hp: 250, maxHp: 250,
    cost: { wood: 80, stone: 60, gold: 20 },
    produces: ['homme_armes', 'archer', 'frere_epee'],
    desc: 'Entraîne les unités militaires de base.',
  },
  farm: {
    label: 'Ferme', icon: '🌾',
    size: 2, color: 0xd4aa44, roofColor: 0xa08030,
    hp: 100, maxHp: 100,
    cost: { wood: 40 },
    produces: [],
    desc: 'Génère de la nourriture passivement.',
  },
  mine: {
    label: 'Mine', icon: '⛏️',
    size: 2, color: 0x808080, roofColor: 0x505050,
    hp: 200, maxHp: 200,
    cost: { wood: 60, stone: 40 },
    produces: [],
    desc: 'Améliore l\'extraction de pierre et d\'or.',
  },
  lumber_mill: {
    label: 'Scierie', icon: '🪵',
    size: 2, color: 0x7a5c30, roofColor: 0x4a3010,
    hp: 150, maxHp: 150,
    cost: { wood: 50, stone: 30 },
    produces: [],
    desc: 'Améliore la récolte de bois.',
  },
  market: {
    label: 'Marché', icon: '💰',
    size: 2, color: 0xdaa520, roofColor: 0xa07a10,
    hp: 180, maxHp: 180,
    cost: { wood: 60, stone: 40, gold: 30 },
    produces: ['mercenaire'],
    desc: 'Commerce et recrutement de mercenaires.',
  },
  tower: {
    label: 'Tour de Garde', icon: '🗼',
    size: 1, color: 0xa0a0a0, roofColor: 0x606060,
    hp: 300, maxHp: 300,
    cost: { wood: 40, stone: 80, gold: 20 },
    produces: ['archer'],
    desc: 'Fortification défensive, archers inclus.',
  },
  church: {
    label: 'Église', icon: '⛪',
    size: 2, color: 0xe8e0d0, roofColor: 0x8b6914,
    hp: 200, maxHp: 200,
    cost: { wood: 70, stone: 80, gold: 40 },
    produces: ['croise', 'garde_roi'],
    desc: 'Entraîne les guerriers saints.',
  },
  stable: {
    label: 'Écurie', icon: '🐴',
    size: 2, color: 0x9a7a50, roofColor: 0x6a4a20,
    hp: 180, maxHp: 180,
    cost: { wood: 80, stone: 30, food: 40 },
    produces: ['chevalier', 'compagnie_loup'],
    desc: 'Entraîne les unités montées.',
  },
  wall: {
    label: 'Muraille', icon: '🧱',
    size: 1, color: 0x888888, roofColor: 0x606060,
    hp: 300, maxHp: 300,
    cost: { stone: 15, wood: 5 },
    produces: [],
    desc: 'Fortification. Bloque les ennemis. Max 20 par partie.',
  },
};

export const BUILDABLE = ['house', 'barracks', 'farm', 'mine', 'lumber_mill', 'market', 'tower', 'church', 'stable', 'wall'];

export const BUILDING_COSTS = Object.fromEntries(
  Object.entries(BUILDING_DATA)
    .filter(([, d]) => d.cost)
    .map(([k, d]) => [k, d.cost])
);