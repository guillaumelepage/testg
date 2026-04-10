'use strict';

const { MAP_WIDTH, MAP_HEIGHT, T } = require('./constants');

// ── Seeded LCG random number generator ────────────────────────────────────────
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// ── Procedural world map generation ───────────────────────────────────────────
function generateMap(seed) {
  const rand = rng(seed);
  const map  = Array.from({ length: MAP_HEIGHT }, () => Array(MAP_WIDTH).fill(T.GRASS));
  const resources = [];

  // ── Water bodies with SHALLOW_WATER transition ring ──────────────────────
  for (let i = 0; i < 5; i++) {
    const cx   = Math.floor(rand() * MAP_WIDTH);
    const cy   = Math.floor(rand() * MAP_HEIGHT);
    const size = 3 + Math.floor(rand() * 6);
    for (let dy = -(size + 2); dy <= size + 2; dy++) {
      for (let dx = -(size + 2); dx <= size + 2; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) continue;
        const d2 = dx * dx + dy * dy;
        if      (d2 <= size * size)                                              map[ny][nx] = T.WATER;
        else if (d2 <= (size + 1) * (size + 1) && map[ny][nx] === T.GRASS)      map[ny][nx] = T.SHALLOW_WATER;
        else if (d2 <= (size + 2) * (size + 2) && map[ny][nx] === T.GRASS)      map[ny][nx] = T.SAND;
      }
    }
  }

  // ── Forest clusters ───────────────────────────────────────────────────────
  for (let i = 0; i < 12; i++) {
    const cx   = Math.floor(rand() * MAP_WIDTH);
    const cy   = Math.floor(rand() * MAP_HEIGHT);
    const size = 2 + Math.floor(rand() * 5);
    for (let dy = -size; dy <= size; dy++) {
      for (let dx = -size; dx <= size; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT
            && dx * dx + dy * dy <= size * size && map[ny][nx] === T.GRASS)
          map[ny][nx] = T.FOREST;
      }
    }
  }

  // ── Mountains with SNOW core for large clusters ───────────────────────────
  for (let i = 0; i < 6; i++) {
    const cx   = Math.floor(rand() * MAP_WIDTH);
    const cy   = Math.floor(rand() * MAP_HEIGHT);
    const size = 1 + Math.floor(rand() * 4);
    for (let dy = -size; dy <= size; dy++) {
      for (let dx = -size; dx <= size; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) continue;
        const d2 = dx * dx + dy * dy;
        if (d2 <= size * size && map[ny][nx] !== T.WATER) {
          map[ny][nx] = (size >= 3 && d2 <= (size - 1) * (size - 1)) ? T.SNOW : T.MOUNTAIN;
        }
      }
    }
  }

  // ── MARSH — 50% chance on grass tiles within 2 tiles of water ────────────
  const marshRng = rng(seed ^ 0xaabb5c);
  for (let y = 1; y < MAP_HEIGHT - 1; y++) {
    for (let x = 1; x < MAP_WIDTH - 1; x++) {
      if (map[y][x] !== T.GRASS && map[y][x] !== T.DARK_GRASS) continue;
      let nearWater = false;
      outer: for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const ny2 = y + dy, nx2 = x + dx;
          if (ny2 >= 0 && ny2 < MAP_HEIGHT && nx2 >= 0 && nx2 < MAP_WIDTH) {
            const t = map[ny2][nx2];
            if (t === T.WATER || t === T.SHALLOW_WATER) { nearWater = true; break outer; }
          }
        }
      }
      if (nearWater && marshRng() < 0.5) map[y][x] = T.MARSH;
    }
  }

  // ── RUINS clusters ────────────────────────────────────────────────────────
  const ruinsRng = rng(seed ^ 0xc0ffee);
  for (let i = 0; i < 5; i++) {
    const cx   = 5 + Math.floor(ruinsRng() * (MAP_WIDTH  - 10));
    const cy   = 5 + Math.floor(ruinsRng() * (MAP_HEIGHT - 10));
    const size = 1 + Math.floor(ruinsRng() * 2);
    for (let dy = -size; dy <= size; dy++) {
      for (let dx = -size; dx <= size; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) continue;
        if (dx * dx + dy * dy <= size * size
            && (map[ny][nx] === T.GRASS || map[ny][nx] === T.DARK_GRASS))
          map[ny][nx] = T.RUINS;
      }
    }
  }

  // ── Resources ─────────────────────────────────────────────────────────────
  const resourceDefs = [
    { type: 'wood',  tile: T.FOREST,     count: 175, amount: 220 },
    { type: 'stone', tile: T.MOUNTAIN,   count: 100, amount: 320 },
    { type: 'gold',  tile: T.MOUNTAIN,   count:  70, amount: 420 },
    { type: 'food',  tile: T.GRASS,      count: 125, amount: 160 },
    { type: 'food',  tile: T.FARMLAND,   count:  60, amount: 200 },
    { type: 'stone', tile: T.RUINS,      count:  40, amount: 180 },
    { type: 'food',  tile: T.DARK_GRASS, count:  40, amount: 130 },
  ];
  for (const def of resourceDefs) {
    let placed = 0, attempts = 0;
    while (placed < def.count && attempts < 4000) {
      attempts++;
      const x = Math.floor(rand() * MAP_WIDTH);
      const y = Math.floor(rand() * MAP_HEIGHT);
      if (map[y][x] !== def.tile || resources.some(r => r.x === x && r.y === y)) continue;
      // Keep resources away from starting bases
      const dP1 = Math.abs(x - 5)              + Math.abs(y - 5);
      const dP2 = Math.abs(x - (MAP_WIDTH - 6)) + Math.abs(y - (MAP_HEIGHT - 6));
      if (dP1 > 6 && dP2 > 6) {
        resources.push({
          id: `res_${resources.length}`, type: def.type, x, y,
          amount: def.amount, maxAmount: def.amount,
          state: 'alive', regrowTimer: 0,
        });
        placed++;
      }
    }
  }

  return { map, resources };
}

module.exports = { rng, generateMap };