// World scene constants shared across mixins

export const TILE_SIZE = 24;
export const MAP_W = 160;
export const MAP_H = 120;

// Resource texture keys (non-wood have fixed textures)
export const RESOURCE_KEYS = { stone: 'res_stone', gold: 'res_gold', food: 'res_food' };

// Tile indices that block movement/placement (WATER=2, MOUNTAIN=6, SNOW=10)
export const IMPASSABLE = new Set([2, 6, 10]);

// Vision radius per unit type (fog of war — heroes use HERO_DEFS.visionRadius)
export const UNIT_VISION = {
  paysan: 2,
  homme_armes: 4, archer: 4, mercenaire: 4, compagnie_loup: 4,
  chevalier: 5, garde_roi: 5, croise: 5, frere_epee: 5, banniere_rouge: 5,
};

export const BLD_VISION = { town_hall: 7, tower: 5, wall: 2 };

// Returns the correct texture key for a wood resource node based on its growth state
export function treeTexKey(node) {
  if (node.state === 'stump')   return 'res_tree_stump';
  if (node.state === 'sapling') return 'res_tree_sapling';
  return 'res_tree';
}