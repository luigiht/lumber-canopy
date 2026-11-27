# Art direction

Cosy but moody: a misty, overcast forest valley in chunky voxels with ink outlines, warm light from windows and lamps, and a wood-and-parchment UI. The main reference is [`context/images/Misty Mountain Cabin and Waterfall Valley 1.png`](../context/images/); the other images in that folder cover the clearing, the cabin build site and houseplants.

## World

- **Voxel scale:**
  - Props and characters: 1/16 tile per voxel.
  - Terrain: 1/8 tile.
  - Distant terrain: coarser, painted in the shader to match.
- **Shading:** toon material with three flat light bands; models carry baked vertex colours; ink outlines come from depth edges and fade into the mist.
- **Palette** (`src/voxel/palette.ts`):
  - Greens: dark, muted olive and pine.
  - Stone: grey, with muted moss.
  - Water: teal, with soft foam.
  - Dirt paths: a dull brown.
  - Flowers: soft, so they don't pop.

  Every model draws from this palette so the world reads as one image.
- **Colour grade** (`src/engine/GradePass.ts`):
  - Saturation 68%, with warm bright light (lamps, windows) kept saturated.
  - Cool shadows and a slight contrast lift.
  - A soft vignette.
  - Brightness is the player's setting.
- **Light** (`src/engine/DayNight.ts`):
  - Day: overcast grey-blue sky.
  - Dusk: short and amber.
  - Night: deep blue.
  - Cabin windows glow from dusk, and bloom appears only at night.
- **Mist:**
  - Radial fog from 18 to 40 tiles.
  - Flat mist sheets resting on the pine crowns.
  - Boxy voxel clouds over the river and back hills.
  - Never fully clear (lightest at midday); never touches terrain or water (see [DECISIONS.md](DECISIONS.md)).
- **Shadows:** crisp and blocky. Faces turned away from the sun take the flat dark toon band instead of sampling shadows.

### Characters

- **The player:** chibi, with a buffalo-check shirt, jeans, beard and yellow beanie, holding the selected tool.
- **The otter:** long and low (about three times longer than wide), brown with a cream muzzle and belly, dark ears and nose. It stands on all four paws with its tail visible.

### Interior

- Warm and lived-in: honey-wood floors, teal kitchen units, stone tiles, a rust sofa, a blue quilt and shelves of coloured books.
- Lamps and the stove glow brighter at night against a dark backdrop.
- Plant spots that are empty show a terracotta saucer.

## Interface

- **Panels:** carved wood with grain, a pixel bevel and parchment text (`src/ui/hud.module.css`). Selected options are honey-amber.
- **Fonts:**
  - **Pixelta:** headings, buttons, box titles (19px), the clock and key caps. Kept crisp, without smoothing.
  - **DM Sans:** body text, notes and form fields, anti-aliased.
- **Icons:** pixel art only, no emoji (`src/ui/pixelIcons.ts`).
  - 16×16 grid with a one-pixel dark outline in a deep tone of the icon's own colour.
  - Top-left highlight, bottom-right shadow.
  - Simple button glyphs (plus, minus, rotate) are 12×12 in parchment with a dark outline.
- **Scrollbars:** pixel art: a square carved-wood handle with a hard bevel on a dark wood track, no arrows (`app/globals.css`). Firefox only supports scrollbar colours, so there it's a plain wood-coloured scrollbar.
- **Layout (no overlaps):**
  - **Top left:** calendar, materials and, on phones, messages share one stacked column.
  - **Phones and small tablets (900px wide or less):**
    - The bottom row has the tools on the left and rotate on the right. Rotate stacks above the tools under 460px wide.
    - The tutorial, goal and fishing panels share the strip above that row, and the goal hides while fishing.
    - At most two messages show at once.
    - Short landscape screens move messages beside the gear and fishing to the right.
  - Keep new HUD pieces inside these zones (`hud.module.css`, `ui.module.css`).
- **Markers:** small wood buttons with an icon floating over each usable thing. The name shows on hover.
- **Loading screen:** the intro illustration with a dark vignette, the white logo, a stepped pixel spinner and small white text.
- **Motion:** short and soft (fades, gentle bobbing). Respect `prefers-reduced-motion`.

## Brand

- **Logo:** [`context/brand/logo-full.svg`](../context/brand/logo-full.svg), white with a drop shadow, so use it on dark or busy backgrounds. A copy is served at `/brand/logo-full.svg`.
- **App icon:** the cosy cabin from `context/images/icon.svg`, rendered to `app/favicon.ico`, `app/icon.png` and `app/apple-icon.png`. The Apple icon sits on a solid `#1d2a1f` background.
- **Share image:** `context/images/og-image.svg`, rendered to `app/opengraph-image.jpg` (1200×630).
- **Theme colour:** `#1d2a1f`, a deep forest green.
