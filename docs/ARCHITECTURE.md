# Architecture

A Next.js app with one main page: React renders the UI over a three.js canvas. The engine owns everything 3D; React owns state and UI; they talk through a small set of methods and events.

```
app/page.tsx ──► src/game/Game.tsx ──► Engine (three.js)  ◄── methods ──  actions / session
                        │                  │ events (onHour, onBuild, onArrive, payStage…)
                        ▼                  ▼
                   src/ui/Hud.tsx ◄── useGame (Zustand store) ◄── actions update state
```

## Layers

| Folder | Owns | Notes |
| --- | --- | --- |
| `src/config/` | Data: world layout, road, stations, cabin stages, interior, site text | Plain constants and pure helpers. No three.js, no React. |
| `src/voxel/` | Voxel grid, greedy mesher, palette, every model | Models are functions returning a `VoxelModel` (1 voxel = 1/16 tile). |
| `src/world/` | Scene pieces: terrain, far terrain, water, props, mist, nav grid, character, otter, cabin, interior, stations | Each is a class with a `group` to add to the scene and an `update()`. |
| `src/engine/` | `Engine`, isometric camera, day/night, post-processing (outlines, bloom, grade), toon material | `Engine` builds the scene and runs the frame loop. |
| `src/game/` | State (`store.ts`), rules (`actions.ts`), saving/accounts (`session.ts`), data tables (items, plants, tools, loot, otter) | Rules are plain functions over the store. |
| `src/services/` | `AccountService`: Supabase or browser-only | The game never calls Supabase directly. |
| `src/ui/` | HUD, panels, onboarding, settings, pixel icons | React components reading the store. |

## Key flows

**Startup**

1. `Game.tsx` creates the `Engine` and wires its events.
2. It loads display settings, then calls `initSession()`.
3. That shows the start screen, or the welcome-back summary for a signed-in player.
4. `startPlaying()` copies the save into the store, calls `engine.restore()` (or `playArrival()` for a new game), and starts autosave.

**Using a station**

1. A click on a marker or mesh calls `engine.goTo(id)`, which walks the player there.
2. On arrival, the engine fires `onArrive(id)` and `actions.interact()` runs the station's behaviour: open a panel, start a gather task, start fishing, change floor, sleep, and so on.

**Timed work** (gathering, building, fishing)

1. `engine.work(stationId, seconds, onDone)` or `engine.fish()` puts the character in a work pose.
2. Walking away cancels the task.
3. Cabin building is driven by `Engine.updateBuild`. It asks `payStage(i)` before starting each stage.

**Keeping the world in sync with state**

- `Game.tsx` subscribes to the store and pushes changes into the scene: stone piles, displayed plants (outdoors and inside), and pots on the table.
- The engine reports the clock every 0.25 s through `onHour`. That updates `elapsed`, which drives growth and refills (`tickWorld`).

**Saving**

- `requestSave()` debounces writes.
- `buildSave()` combines store progress with `engine.snapshot()` (clock, cabin, player position).
- With Supabase, a local backup copy is also written, and the newer copy wins on load.
- Old saves are filled in by `normalizeSave()`.

## Coordinates and scale

- 1 tile = 1 world unit. Ground level is y = 0; the map is centred on the origin.
- **Default camera:** looks from the +x/+z corner. The river runs north–south around x = 4–8, and the road is east of it around x = 13–17.
- **Detailed terrain:** 40×40 tiles at 1/8-tile voxels.
- **Far terrain:** a coarse ring out to 96 tiles. The walkable play area is the central 24 tiles.
- **Props and characters:** 1/16-tile voxels.
- **Interior:** its own scene centred on the origin; outdoors is hidden while you're inside.
- **Navigation:** `NavGrid` (4 cells per tile, A*) is built over a `NavSurface`.
  - Outdoors: `NavGrid.forWorld`.
  - Inside: one grid per cabin floor.
  - Station footprints and the cabin are blocked with `blockRect`.

## How to…

**Add an item**

1. Add it to `MATERIALS` in `src/game/items.ts`, with a source story.
2. Add a pixel icon to `src/ui/pixelIcons.ts`.
3. Add it to loot tables, costs or the resource bar as needed.

**Add a station**

1. Add a `StationDef` in `src/config/stations.ts` with a new `kind`, a position, a standing `spot` and a `face` point.
2. Give it a model in `src/voxel/models/stations.ts` and create it in `src/world/stations.ts`. Add it to `footprints()` if it should be solid.
3. Handle the kind in `interact()` in `src/game/actions.ts`, and set its marker icon in `GameHud.tsx`.

**Add a plant species:** add it to `SPECIES` in `src/game/plants.ts` and give it a shape in `pottedPlant()` in `src/voxel/models/stations.ts`. Seeds and cuttings for it then exist automatically.

**Change the game's description:** edit `src/config/site.ts`. Metadata, structured data, the manifest and `llms.txt` all follow.

**Add a saved field**

1. Add it to `SaveState` and `newGameState()`, with a default in `normalizeSave()`.
2. Add it to `Progress` and `progressOf()` in the store.
3. Include it in `buildSave()`.

## Checking changes

- **Before every commit:** `pnpm typecheck` and `pnpm lint`.
- **Production build:** run `pnpm build` with `pnpm dev` stopped, because they share `.next`.
- **World logic** (reachability, clearance, rules) can be checked without a browser. Transpile `src/**/*.ts` with the TypeScript compiler API into a scratch folder and run small Node scripts. Most modules under `src/world`, `src/config` and `src/game` don't need WebGL.
- **Visual changes:** look at them in the running game. Hidden UI (H) helps for screenshots.
