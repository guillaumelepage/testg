# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Conquête Médiévale** — A cooperative medieval strategy game with Pokémon-style turn-based combat. Two players share a map and resources against AI enemy waves. Built with Phaser 3 (frontend) + Socket.io Node.js server (multiplayer backend).

## Commands

```bash
# Full dev mode (both client + server, with hot reload)
npm run dev

# Client only (webpack dev server on :8080, proxies /socket.io → :3000)
npm start

# Server only (Socket.io game server on :3000)
npm run server

# Production build → dist/
npm run build

# Server install (run once)
cd server && npm install
```

## Architecture

### Scenes (Phaser)
Scene flow: `Boot → Menu → World` (with `UI` overlaid and `Battle` launched on top).

| Scene | Role |
|-------|------|
| `BootScene` | Generates **all textures procedurally** via Phaser Graphics — no image assets |
| `MenuScene` | Room creation/join via Socket.io; waits for both players before starting |
| `WorldScene` | Main game: scrollable tile map, unit selection/movement, building placement |
| `UIScene` | Persistent HUD overlay (resources, minimap, build menu, unit/building panels) |
| `BattleScene` | Pokémon-style turn-based combat, launched as an overlay over WorldScene |

### Game Data
- `js/game/data/units.js` — unit stats (HP/ATK/DEF/SPD), 4 moves per unit, type effectiveness chart
- `js/game/data/buildings.js` — building definitions, costs, what units each building produces

### Network
- `js/game/network/SocketManager.js` — singleton wrapping Socket.io client; `sendAction(action)` for all player commands
- `server/GameRoom.js` — canonical game state: map generation (procedural), resource nodes, units, buildings, AI logic, battle resolution
- `server/index.js` — Express + Socket.io; room codes (6-char); ticks every 2s (gathering + AI movement), enemy spawns every 30s

### Key Design Decisions
- **Ground layer**: rendered once as a `RenderTexture` (performance). Units/buildings/resources are individual GameObjects.
- **Authority**: server holds canonical state, clients send `action` events and receive `state_update` / `battle_start` / `battle_end`.
- **Map**: 80×60 tiles (48px each = 3840×2880 world). Tile types: `[0=GRASS, 1=DARK_GRASS, 2=WATER, 3=SAND, 4=DIRT, 5=FOREST, 6=MOUNTAIN]`.
- **Type chart**: `LOURD / LEGER / CAVALERIE / MAGIE` — multipliers in `TYPE_CHART` in both `units.js` and `GameRoom.js` (must stay in sync).
- **Battle**: triggered when a player unit moves onto an enemy tile → server resolves both moves → broadcasts `battle_update` or `battle_end`.