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
| `BootScene` | Loads SVG assets + generates world-map sprite textures via `RenderTexture` |
| `MenuScene` | Room creation/join via Socket.io; hero & clan picker; rejoin banner on page refresh |
| `WorldScene` | Main game: scrollable tile map, unit selection/movement, building placement, fog of war |
| `UIScene` | Persistent HUD overlay (resources, minimap, build menu, unit/building panels) |
| `BattleScene` | Pokémon-style turn-based combat overlay; handles dungeon room transitions internally |

### Game Data
- `js/game/data/units.js` — stats (HP/ATK/DEF/SPD) + 4 moves per unit for **all** types: player units, heroes (`roi_guerrier`, `chasseresse`, `mage_arcane`), neutral mobs (`loup`, `sanglier`, `ours`), boss (`tyran`). Also `TYPE_CHART` and `UNIT_MOVE_TYPE`.
- `js/game/data/heroes.js` — hero definitions (XP/level table, equipment defs, NPC quest givers)
- `js/game/data/buildings.js` — building definitions, costs, trainable units per building

### Network
- `js/game/network/SocketManager.js` — singleton wrapping Socket.io client; `sendAction(action)` for all player commands; `setSession`/`clearSession` persist room code + player name to `localStorage` for reconnection
- `server/GameRoom.js` — canonical game state: map generation, resource nodes, units, buildings, AI, battle resolution, population, dungeons, random events
- `server/index.js` — Express + Socket.io; room codes (6-char); 1s tick loop running all sub-ticks

### Server Tick Loop (`server/index.js`, every 1 s)
| Sub-tick | Method | What it does |
|---|---|---|
| Movement | `tickUnitMovement()` | Steps all units toward their target |
| Gathering | `tickGathering()` | Paysans harvest adjacent resource nodes |
| Construction | `tickConstruction()` | Advances building progress |
| Regen | `tickResourceRegen()` | Slowly restores depleted resource nodes |
| Enemy AI | `tickEnemyAI()` | Moves enemies, spawns new ones |
| Timed effects | `tickTimedEffects()` | Decrements stun, nightOfBlood, truce |
| Population | `tickPopulation()` | Ages children, promotes adults, SDF → enemy |
| Neutral mobs | `tickNeutralMobs()` | Wander + village guard aggro + boss chase |
| Village siege | `tickVillageTowers()` + `tickVillageSiege()` | Tower arrows, siege damage |
| Random events | `tickRandomEvents()` | Fires every 180 ticks (3 min), 15 event types |

### Key Systems

**Combat**
- Triggered by: player moves onto enemy/neutral tile, village guard aggro, boss collision, dungeon entry (`ENTER_DUNGEON` action)
- `_startBattle(triggerPlayer, triggerEnemy)`: groups nearby allies + nearby enemies (neutrals join if trigger is neutral)
- `_battleMove(moveIndex)`: resolves player attack then enemy retaliation in one call → returns `BATTLE_UPDATE`, `BATTLE_END`, or `DUNGEON_NEXT_ROOM`
- `_moveUnit()` guards against `activeBattle` to prevent overwriting an active fight
- BattleScene sequences animations: enemy hit → death fall + new unit enters from side → enemy retaliation on player

**Population**
- Constants: `POP` object (`ADULT_TICKS=320`, `REPRO_COOLDOWN=240`, `SDF_TIMEOUT=90`)
- Houses reproduce every 240 ticks; children become adults at 320 ticks (≈ 16 in-game years)
- Adults without a house get `sdfTimer`; after 90 ticks they become enemy units
- Training a unit (`_trainUnit`) requires an undeployed adult citizen; links `citizen.unitId` to the new unit

**Dungeons**
- 3 dungeons on the map (positions fixed in `_generateDungeons`), each with 3 rooms + artifact
- Enter: select hero → click cave entrance → `ENTER_DUNGEON` action
- Room transitions: BattleScene handles `dungeon_next_room` itself (stops + relaunches itself)
- Artifacts: `{ stat: 'hp'|'atk'|'def', value }` applied permanently to hero on dungeon clear

**Random Events** (15 types in `tickRandomEvents`)
`merchant`, `drought`, `mercenaries`, `enemy_raid`, `storm`, `wolf_pack`, `deposit`, `fire`, `mage`, `deserter`, `refugees`, `night_blood`, `discovery`, `truce`, `boss`

**Reconnection**
- `SocketManager` auto-sends `rejoin_game` on reconnect if `_wasConnected && session`
- On page refresh: MenuScene shows a "Reprendre la partie" banner using `localStorage` session
- WorldScene listens to `game_start` to refresh state after mid-game rejoin

### Key Design Decisions
- **Ground layer**: rendered once as a `RenderTexture` (performance). Units/buildings/resources are individual GameObjects.
- **Authority**: server holds canonical state; clients send `action` events and receive `state_update` / battle events.
- **Map**: 80×60 tiles (48px each = 3840×2880 world). Tile types: `[0=GRASS, 1=DARK_GRASS, 2=WATER, 3=SAND, 4=DIRT, 5=FOREST, 6=MOUNTAIN]`.
- **Type chart**: `LOURD / LEGER / CAVALERIE / MAGIE` — multipliers in `TYPE_CHART` in **both** `units.js` and `GameRoom.js` (must stay in sync).
- **Unit data sync**: `UNIT_STATS` and `UNIT_MOVE_TYPE` in `units.js` must cover ALL types that can appear in BattleScene (player units, heroes, neutral mobs, boss). Missing entries cause wrong move display and broken type badges.
- **SocketManager handlers**: only one handler per event (last `.on()` wins). BattleScene overwrites WorldScene's `battle_update`/`battle_end` handlers and must restore them on close.