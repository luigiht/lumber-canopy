# Gameplay

**Goal:** build a cabin, fill it with plants, and propagate them to earn improvements, without hurting the environment. Nothing is cut down and no wildlife is harmed: every resource comes from reuse, recycling and regrowth.

The numbers below are the current values. Where each one lives is noted so this file can be checked against the code.

## The loop

1. **Gather** reclaimed materials: fish debris from the bridge, gather loose stones, scoop soil from the compost.
2. **Build** the cabin stage by stage; each stage uses materials.
3. **Grow** plants from seeds and cuttings at the potting table.
4. **Propagate** mature plants for more cuttings, then **place** them in and around the cabin, or **sell/trade** them.
5. **Upgrade** tools with coins and materials, which makes gathering faster and finds rarer.
6. **Befriend the otter** with seeds; it brings back finds from the river.

## First session

1. **Start screen:** New game or Sign in (see [Accounts](#accounts-and-saving)).
2. **Goal screen:** the goal and the eco rules, addressed to the player by name.
3. **Taxi arrival:** the taxi drives in along the road east of the river and drops the player at the head of the path to the bridge.
4. **Controls tutorial**, in order: walk (click the ground), use something (click any marker), open the inventory (I), switch tools (1/2/3). It can be skipped. Until it's finished or skipped, the bridge is closed: the player can't go west of x = 7 (`GATE_X` in `src/config/stations.ts`).

**Starter kit** (`newGameState` in `src/game/save.ts`): 2 pots, 2 soil, 2 pothos cuttings, 1 spider plant cutting, 2 spider plant seeds, 1 pothos seed, 5 coins, all tools at level 1.

## Time

- 1× speed: one in-game day every 10 real minutes. Settings also offers pause, 20× and 120×.
- Plants grow and piles refill on **elapsed in-game hours**, which only move forward (scrubbing the time-of-day slider doesn't count).
- **Sleeping** in the bed (bedroom loft) skips to the next 07:00 (`WAKE_HOUR` in `src/game/actions.ts`), with the skipped hours counted as elapsed.

## Gathering

### Fishing (bridge)

Only floating debris: no fish are ever caught. A marker sweeps across a bar; stop it inside the green zone (Space, click or tap) to land a catch.

| Rod level | Catch zone | Rare chance | Extra per catch | Recast wait |
| --- | --- | --- | --- | --- |
| 1 | 16% of the bar | 8% | 0 | 2.5 s |
| 2 | 22% | 12% | 0 | 1.8 s |
| 3 | 28% | 18% | +1 | 1.2 s |

Finds (`src/game/loot.ts`): uncommon 24%, common otherwise.

- **Common:** driftwood or scrap wood, 1–2.
- **Uncommon:** metal, nails, glass or rope, 1.
- **Rare:** copper, or a bottle with a cutting or seeds of any species.

### Loose stones

Five piles along the riverbanks and garden edge. Each holds 6 stones and refills 8 in-game hours after it's first touched (`ROCK_MAX`, `ROCK_REFILL_HOURS`). Gathering repeats automatically while the player stays put.

| Holding | Time per gather | Stones |
| --- | --- | --- |
| Hands (any other tool) | 2.4 s | 1 |
| Pickaxe L1 | 1.6 s | 1 |
| Pickaxe L2 | 1.1 s | 2 |
| Pickaxe L3 | 0.75 s | 2 (50% chance of 3) |

### Compost

Soil for pots: 4 scoops, 2 s each, refilling 6 in-game hours after first use.

## The cabin

Seven stages, each paid for when work on it begins (`CABIN.stages` in `src/config/cabin.ts`). The player builds by standing at the work spot by the log pile.

| Stage | Cost |
| --- | --- |
| Stone footing | 4 stones |
| Floor platform | 4 driftwood, 2 scrap wood |
| Timber frame | 6 driftwood, 2 nails |
| Walls and windows | 6 scrap wood, 2 glass |
| Stone chimney | 8 stones |
| Roof shingles | 4 scrap wood, 3 metal |
| Porch and railing | 4 driftwood, 2 rope |

Hammer level speeds building up: 1×, 1.35×, 1.75×.

Once built, the windows glow at night, the porch light comes on, the chimney smokes, the porch plant spots open, and a **door** marker leads inside.

### Inside

A cutaway view (outdoors is hidden). Walls between the camera and the room hide as the view rotates.

- **Ground floor:** living room (sofa, rug, wood stove, armchair, bookshelf, lamp) and kitchen (counter with sink and cooktop, wall shelf, table and chairs).
- **Bedroom loft:** bed, bedside table and lamp, wardrobe, and a low bookshelf with a record player on top.
- **Getting around:** stair markers move between floors, and the front-door marker leads back out to the porch steps.
- **Saves:** a game saved indoors resumes just outside the door.

## Plants

Five species (`src/game/plants.ts`). Seeds take 1.5× longer than cuttings.

| Species | Hours (cutting) | Sells for | Trades for | Cuttings when propagated |
| --- | --- | --- | --- | --- |
| Spider plant | 5 | 6 coins | 2 rope | 3 |
| Pothos | 6 | 8 coins | 2 metal | 2 |
| Boston fern | 8 | 10 coins | 2 glass, 2 nails | 2 |
| Snake plant | 10 | 14 coins | 3 metal, 1 copper | 2 |
| Monstera | 14 | 22 coins | 2 copper | 2 |

- **Planting** (at the potting table) uses 1 pot, 1 soil and 1 seed or cutting.
- **Pots** are made at the workbench from 2 scrap wood.
- **Growth stages:** newly planted (under 30%), growing, mature (100%).
- **A mature pot** can be:
  - **placed**, which moves it to a display spot;
  - **propagated**, which gives cuttings and sends the plant back to 45% grown;
  - **put in the bag**, which frees the table slot.
- **Table capacity:** 3 pots, plus 1 for every 4 plants on display, up to 6.

### Display spots (23)

- **Garden:** 9 spots, always open.
- **Porch:** 4 spots, open once the cabin is built.
- **Inside:** 10 spots.
  - Living room: 3.
  - Kitchen: 3 (one on the counter and one on the table).
  - Bedroom: 4 (two on top of the low bookshelf).

Empty inside spots show a terracotta saucer.

"Place" without choosing a spot fills: inside first (once built), then the porch, then the garden. Clicking an inside spot lets the player choose which plant goes there, or pick it up.

## Selling and trading

The delivery box by the road takes grown plants (in the bag): sell for coins, or trade for the materials in the table above.

## Tools

Three tools, three levels each, upgraded at the workbench (`src/game/tools.ts`).

| Tool | To level 2 | To level 3 |
| --- | --- | --- |
| Hammer | 12 coins, 2 metal, 3 scrap wood | 35 coins, 4 metal, 1 copper |
| Fishing rod | 10 coins, 2 rope, 1 metal | 30 coins, 3 metal, 1 copper |
| Pickaxe | 10 coins, 2 metal, 2 driftwood | 30 coins, 3 metal, 1 copper |

## The otter

A shy otter sits on the east bank just downstream of the bridge, reachable during the tutorial (`src/game/otter.ts`, `src/world/otter.ts`).

- **Feeding:** it eats any plant **seeds**, one per feed.
- **Friendship at 3 feeds:** it follows the player outdoors and waits on the porch while they're inside.
- **Finds:** feeding a friend sends it to the nearest reachable bank. It dives for 4–6 s and brings back a find; it can't be fed again until it returns.
- **Levels:**

| Level | Feeds | Rare chance | Extra on common/uncommon finds |
| --- | --- | --- | --- |
| Friend | 3 | 15% | 0 |
| Good friend | 10 | 22% | 0 |
| Best friend | 25 | 30% | +1 |

The otter's rare finds favour seeds (weight 3 each vs 1 for cuttings), so it sometimes pays for its own food.

## Accounts and saving

- **New game:** name (1–24 characters), email, and password (at least 8 characters). The form states: "We'll only use your email to save your game."
- **Sign in:** a wrong email or password gets one generic error, so it doesn't reveal which accounts exist.
- **Forgotten password:** a reset link by email (online mode only).
- **Email confirmation (online):** when it's on, the player can play straight away. Progress is kept in the browser until they confirm and sign in, then moved to their account.
- **When it saves:** shortly after any meaningful change, every 30 seconds, and when the tab is hidden or closed.
- **Returning players** see a summary first: cabin stage, plants, times propagated, tool levels and coins.
- **Settings → Account** (the last section) offers **Log out**, **Delete account** (permanent) and a link to the Privacy page. Both buttons also show for players still waiting to confirm their email; for them, Delete removes the progress kept in the browser.

## HUD and controls

- **Top left:** clock and calendar, then the resource bar in two rows of four (driftwood, scrap wood, stones, metal, soil, rope, seeds and cuttings, coins).
- **Top centre:** the tutorial step, then the current goal.
- **Bottom centre:** tools (1/2/3), inventory (I) and plants (P).
- **Bottom right:** rotate and zoom buttons.
- **H** hides all UI for screenshots.

The full controls table is in the [main README](../README.md#controls).
