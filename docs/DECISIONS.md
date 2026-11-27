# Decisions

Significant choices made while building the game, newest areas last. Each says what was decided, why, and what it means for future work. When you change one, update it here rather than deleting it, so the history stays clear.

## Theme and rules

### Nothing is harvested by force

**Decision:** every resource comes from non-destructive sources:

- driftwood and scrap fished from the river (never fish);
- loose stones the river leaves behind;
- soil from compost;
- plants propagated from cuttings and seeds.

The character carries a hammer, rod or pickaxe; the original axe was removed.

**Why:** the brief's core rule ("no cutting trees, no harming wildlife").

**Implication:** new resources need a reuse or regrowth story. Item descriptions say where things come from in those terms (`src/game/items.ts`).

### The cabin costs materials

**Decision:** each of the seven build stages uses reclaimed materials, paid when work on that stage begins.

**Why:** in the original diorama the cabin was free; tying it to gathering gives the loop its purpose. Paying per stage (not all at once) keeps progress visible.

**Implication:** the goal hint tells the player exactly what's missing for the current stage.

### Click to walk, not WASD

**Decision:** the brief described WASD to move and E to interact. The game keeps its existing controls: click/tap to walk, click a marker to use something; WASD pans the camera and E rotates it. The tutorial teaches these.

**Why:** the isometric diorama was built around click-to-walk with pathfinding, which also works on touch screens.

## Accounts and data

### Email and password accounts instead of a Game ID

**Decision:** an earlier draft gave each player a shareable Game ID. It was replaced by email and password accounts.

**Why:** the user asked for it. Accounts work across devices and support password reset, and a Game ID would have been the only key to a save, so anyone who saw it could open the game.

**Implication:** the game promises to use the email only for saving the game, and has a Privacy page. The Privacy page must stay accurate.

### Supabase, behind an interface, with a browser-only fallback

**Decision:** the game talks only to `AccountService` (`src/services/account/types.ts`).

- **Online:** Supabase Auth and a `progress` table, protected by row-level security.
- **Offline:** when the Supabase variables aren't set, accounts and saves live in `localStorage`, with passwords hashed using PBKDF2.

**Why:** Supabase was to be configured later, but the game had to be playable end to end straight away.

**Implication:**
- Switching to Supabase means setting environment variables and running `supabase/schema.sql`, with no code changes.
- Never put the secret or service-role key in a `NEXT_PUBLIC_` variable.
- The email is stored only in Supabase Auth, never copied into game tables.

### Saves resume outdoors

**Decision:** being inside the cabin isn't saved. A game saved indoors reloads just outside the front door, and a befriended otter reappears beside the player.

**Why:** fewer edge cases when restoring (floors, stairs, the otter's position) for very little loss.

## World and visuals

### Moody, misty look from the reference

**Decision:** the look is based on *Misty Mountain Cabin and Waterfall Valley*:

- muted olive and pine greens, greyer stone, teal water;
- a desaturating grade with a vignette, and night-only bloom from lamps and windows;
- an overcast sky;
- mist that never fully clears, at most 55% thinner at midday.

**Why:** the brief asked for gloomy but cosy, and the user asked for "less colourful, more misty".

**Details:** [ART-DIRECTION.md](ART-DIRECTION.md).

### Mist rests on treetops; boxy clouds float clear of everything

**Decision:**

- **Mist sheets** sit 3.7–4.6 tiles above the highest ground under their whole footprint, which is pine-crown height. They never form over the river and fade out if they drift over it.
- **Valley clouds** (stacked boxes) float 2.6–4 tiles above ground or water, along the river beyond the play area and over the back hills.

**Why:** the first version placed mist relative to a single point, so it cut into the rock ledge and pools; the user asked that mist only ever touch treetops.

**Implication:** mist heights come from a precomputed "mist floor" map in `src/world/mist.ts`. New terrain features are covered automatically, because the map is built from the terrain.

### The road continues past the walkable area

**Decision:** the road follows a two-sine curve, defined once in `roadCenterX` in `src/config/world.ts`. It's painted on both the detailed terrain and the coarse far terrain, and the taxi follows the same curve.

**Why:** the road used to stop where the detailed terrain ended. Fog starts at 18 tiles, so the road (which reaches about 17 tiles out) stays clear.

### The interior is a separate cutaway scene

**Decision:** going inside hides the outdoors and shows a purpose-built two-floor interior centred on the origin, with walls that hide when they face the camera. The interior isn't carved out of the exterior cabin model.

**Why:** the exterior model has no inside, and a loft over the living room needs two walkable floors, which one heightmap can't represent.

**Implication:**
- Each floor has its own nav grid; stair markers switch between them.
- Inside stations use interior coordinates (`area: 'inside'` in `src/config/stations.ts`).
- Nothing outdoors may treat them as world positions; the outdoor scatter skips them.

### Shadows skip faces turned away from the sun

**Decision:** in the toon material, faces turned away from the sun don't sample the shadow map (`patchToonShadows` in `src/engine/toon.ts`). Indoors, the shadow map covers only the cabin, for sharper shadows.

**Why:** toon shading lights back faces partly, so shadow acne showed up as small triangles along the meshes. Those faces are already in the darkest band, so nothing is lost.

## Interface

### Pixel-art icons as text grids

**Decision:** every icon is a 16×16 (simple buttons 12×12) grid of characters with a palette, in `src/ui/pixelIcons.ts`, drawn as crisp SVG by `ItemIcon`. No emoji.

**Why:** emoji looked inconsistent with the pixel world and differ by platform. Grids are easy to edit and keep every icon on the same pixel scale.

**Implication:** a new item or button needs a grid icon. Icons were drafted with shape helpers and an automatic outline, then previewed before being added.

### Two fonts: Pixelta for headings, DM Sans for reading

**Decision:** Pixelta (pixel font) for headings, buttons, box titles and the clock; DM Sans for body text and form fields.

**Why:** Pixelta all over was hard to read. Pixelify Sans and DotGothic16 were tried for body text first; the user chose a non-pixel sans for readability.

**Implication:** use the `.heading` style for panel and card titles.

### UI text sizes scale with a setting

**Decision:** all UI font sizes are `calc(Npx * var(--text-scale))`, set by the text size option (100/115/130%). Brightness is a separate option applied by the grade pass.

**Why:** the brief's accessibility requirement (legible under gloomy lighting).

## Companion

### The otter eats plant seeds and follows you

**Decision:**

- **Food:** any plant seeds.
- **Friendship:** reached at 3 feeds, with better finds at 10 and 25.
- **Behaviour:** follows the player outdoors.
- **Finds:** fishing debris with higher rare odds, favouring seeds.
- **Supply:** the starter kit includes 3 seeds, exactly enough to befriend it.

**Why:** the user's choices when the feature was planned.

**Known trade-off:** seeds are scarce, so after befriending, feeding slows down. A common "seed mix" item is the planned fix if it feels too slow.

## Platform and repo

### SEO and GEO text in one place

**Decision:** the game's description, features, keywords and share-image alt text live in `src/config/site.ts`, which feeds:

- page metadata and share cards;
- structured data identifying the page as a video game;
- the web manifest;
- `llms.txt`;
- the hidden description on the home page.

**Why:** search engines and AI assistants should describe the game accurately, and the text should change in one place when the game does.

**Implication:** set `NEXT_PUBLIC_SITE_URL` in production, or links point to localhost.

### pnpm

**Decision:** the project uses pnpm (`pnpm-lock.yaml`).

The stale `package-lock.json` was removed so Vercel (and anyone else) installs with pnpm and the locked versions.

### Deployed on Vercel from GitHub

**Decision:** Vercel's GitHub integration deploys `main` to production on every push, and previews other branches. There's no `vercel.json`; the defaults fit a Next.js app.

**Implication:** the site address falls back to Vercel's production URL. A broken build blocks the deploy, so run the checks before pushing. Details are in [DEPLOYMENT.md](DEPLOYMENT.md).

## Open items

- **Privacy page placeholders:** data region, privacy contact email and an inactive-account policy. The wording needs a GDPR / UK GDPR review before launch.
- **No license** has been chosen; all rights are reserved for now.
- **Visual checks:** most visual changes were checked with scripts (reachability, clearance, proportions) rather than in a browser. Look at new visuals in the running game.
