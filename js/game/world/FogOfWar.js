import { TILE_SIZE, MAP_W, MAP_H, UNIT_VISION, BLD_VISION } from './constants';
import { HERO_DEFS } from '../data/heroes';

// Fog-of-war mixin — mixed into WorldScene.prototype via Object.assign
export const FogOfWarMixin = {

  _addTilesInRadius(set, cx, cy, r) {
    const r2 = r * r;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r2) {
          const x = cx + dx, y = cy + dy;
          if (x >= 0 && x < MAP_W && y >= 0 && y < MAP_H) set.add(`${x},${y}`);
        }
      }
    }
  },

  _computeVisibility() {
    const visible = new Set();
    for (const bld of this.shared.buildings) {
      // Only player-owned buildings reveal fog; neutral (village) and enemy buildings don't
      if (bld.owner !== 'shared') continue;
      const r  = BLD_VISION[bld.type] ?? 5;
      const cx = bld.type === 'wall' ? bld.x : bld.x + 1;
      const cy = bld.type === 'wall' ? bld.y : bld.y + 1;
      this._addTilesInRadius(visible, cx, cy, r);
    }
    for (const unit of this.shared.units) {
      if (unit.owner === 'enemy' || unit.owner === 'neutral') continue;
      const r = unit.isHero
        ? (HERO_DEFS[unit.type]?.visionRadius ?? 5)
        : (UNIT_VISION[unit.type] ?? 3);
      this._addTilesInRadius(visible, unit.x, unit.y, r);
    }
    // Captured villages reveal a large area around them
    for (const village of (this.shared.villages || [])) {
      if (village.capturedBy) {
        this._addTilesInRadius(visible, village.x, village.y, 6);
      }
    }
    for (const key of visible) this.visitedTiles.add(key);
    return visible;
  },

  _updateFog() {
    this._lastVisible = this._computeVisibility();
    this.fogGfx.clear();
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const key = `${x},${y}`;
        if (this._lastVisible.has(key)) continue;
        const alpha = this.visitedTiles.has(key) ? 0.58 : 1.0;
        this.fogGfx.fillStyle(0x000000, alpha);
        this.fogGfx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  },

  // Returns true if tile (tx,ty) is currently visible (not in fog)
  _tileVisible(tx, ty) {
    return this._lastVisible?.has(`${tx},${ty}`) || false;
  },
};