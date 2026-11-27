
# PBI: Ecofriendly Cabin & Garden – Core Gameplay and UX Overhaul

## Overview

**Goal:** Refactor and extend the existing game to emphasize sustainable, ecofriendly gameplay centered on *reusing*, *collecting*, and *propagating plants* rather than cutting down trees or harming the environment.  

The player’s mission is to decorate the inside of a cabin and its surrounding garden with plants and reclaimed items, progressing by collecting materials in non-destructive ways and trading propagated plants.

---

## High-Level Acceptance Criteria

1. The game begins with a short onboarding/tutorial that:
   - Asks the player to type their name.
   - Has the player create an account with **email and password**, so their game is linked to them and they can sign in later to resume and check their progress.
   - States that the email is only used to save their game, and links to a **Privacy page**.
   - Explains the goal of the game: **build a cabin, fill it with plants, and propagate those plants to earn improvements, all without hurting the environment.**
   - Teaches basic controls (movement, interaction, inventory, tool usage).
   - Explains the ecofriendly rules (no cutting trees, no harming wildlife, focus on reuse and regeneration).
2. The world includes:
   - A road on the other side of the river where the player arrives by taxi.
   - A bridge that can be used to fish for *floating debris* (wood, scrap, other materials).
3. Core gameplay loops:
   - Collecting materials in non-destructive ways (fishing for debris, gathering loose rocks, etc.).
   - Propagating plants and selling them for new items and upgrades.
4. Tools (hammer, fishing rod, pickaxe) can be upgraded to increase efficiency.
5. The visual identity is updated to a more gloomy, moody atmosphere (lighting, palette, VFX).
6. UI is updated to show materials, inventory, tool states, and plant propagation status.

---

## Technical Tasks & Implementation Details

### 1. Onboarding / Tutorial Flow

**Goal:** Add a short, guided introduction at the start of the game that creates the player's profile, explains the goal, and teaches the basic controls.

The onboarding should stay small: a few screens before play, then in-game control prompts. It should take under a minute for a player who reads quickly.

#### 1a. Start Screen: New Game or Sign In

**Tasks:**
- [ ] Show a start screen with two options:
  - **New game**: goes to account creation (1b).
  - **Sign in**: email + password, then loads that player's save (see section 9).
- [ ] On a failed sign-in, show a clear, generic error (“Email or password is incorrect”) and let the player try again, reset their password, or start a new game.
- [ ] If the player is already signed in on this device, skip straight to **Continue** with their saved game.
- [ ] Show a **Privacy** link on the start screen.

#### 1b. Name & Account Creation

**Tasks:**
- [ ] Add an account creation screen with:
  - **Name**: “What should we call you?” Trim whitespace; require 1–24 characters; reject empty names.
  - **Email**: validated email format.
  - **Password**: minimum 8 characters, with a show/hide toggle.
- [ ] Directly under the email field, show the note:
  > “We’ll only use your email to save your game. No newsletters, no sharing. [Privacy](/privacy)”
- [ ] On submit, create the account (section 9) and a new game linked to it. Show clear errors for an email already in use or a weak password.
- [ ] If email confirmation is turned on, tell the player to check their inbox, and let them continue playing locally until it's confirmed (progress then syncs to their account).
- [ ] Add a **“Forgot password?”** flow on the sign-in screen.
- [ ] Add a **Sign out** option in the in-game menu.

#### 1c. Goal of the Game

**Tasks:**
- [ ] Show a short intro dialog, addressed to the player by name, that explains the goal:
  > “Welcome, {name}. Your goal: build a cabin, fill it with plants, and propagate them to earn improvements, all without hurting the environment. Gather only what nature has let go of: driftwood from the river, loose stones, cuttings and seeds.”
- [ ] Optionally show the goal as 3 simple steps with icons:
  1. **Build** your cabin from reclaimed materials.
  2. **Fill** it with plants.
  3. **Propagate** plants to earn upgrades, without harming the land.

#### 1d. Controls Tutorial

**Tasks:**
- [ ] Add a new `OnboardingManager` (or equivalent system) that:
  - Controls a sequence of tutorial steps.
  - Pauses/limits player actions until specific steps are completed.
- [ ] Define tutorial steps (example sequence):
  1. **Movement**: “Use WASD / arrow keys to move.”
  2. **Interaction**: “Press E (or your interact key) near objects to interact.”
  3. **Inventory**: “Press I (or defined key) to open your inventory.”
  4. **Tools**: “Select a tool with number keys or mouse wheel.”
- [ ] Add a “Skip tutorial” option in case players replay. Skipping skips only the controls tutorial (1d); account creation is always required for a new game.

**Acceptance Criteria:**
- When starting a new game, onboarding triggers automatically in this order: name + account creation → goal → controls.
- The player cannot start a new game without a valid name, email and password.
- The account creation screen states that the email is only used to save the game, and links to the Privacy page.
- Signing in with a valid email and password loads that player's progress; wrong credentials show a generic error.
- A player can reset a forgotten password and sign out.
- The player cannot proceed to the main cabin area until the basic controls are introduced (or the tutorial is skipped).
- The goal text explicitly mentions:
  - Building the cabin.
  - Filling it with plants and propagating them to earn improvements.
  - Not hurting the environment (reuse/recycling, non-destructive gathering).

---

### 2. World Update: Road and Taxi Drop-off

**Goal:** Introduce a road and taxi arrival sequence on the opposite side of the river.

**Tasks:**
- [ ] Extend the world map to include:
  - A **road** on the far side of the river.
  - A **taxi** object/vehicle at the start.
- [ ] Create a **taxi arrival cutscene** or scripted sequence:
  - Camera focuses on the road.
  - Taxi drives in and stops.
  - Player character exits taxi at a designated spawn point.
- [ ] Connect the road area to the bridge leading toward the cabin/garden area.

**Acceptance Criteria:**
- New game starts with the player outside the taxi on the road side of the river.
- The road is visually distinct (asphalt/dirt road, markings, etc.) and clearly separate from the cabin area.
- The player can walk from the road to the bridge, then across the river to the cabin/garden.

---

### 3. Fishing from the Bridge for Materials

**Goal:** Replace any destructive wood collection with a fishing mechanic where the player retrieves floating debris and materials from the river.

**Tasks:**
- [ ] Add **fishing spots** or define a fishing zone on/near the bridge.
- [ ] Implement a **fishing minigame** (simple version):
  - Player uses the **fishing rod** while standing on the bridge.
  - A short timing/precision mechanic (e.g., press key within a highlighted zone) determines success.
- [ ] Define **fishing loot tables**:
  - Common: Driftwood, small branches, scrap wood.
  - Uncommon: Metal scraps, old nails, glass shards (recyclable), rope.
  - Rare: Special decorative items or plant cuttings in bottles, etc.
- [ ] Ensure fishing yields **non-living** resources (no catching fish or harming wildlife).
- [ ] Add **cooldown** or stamina cost to prevent spamming if needed.

**Acceptance Criteria:**
- Player can only obtain wood and similar materials via fishing (or other non-destructive means), not by chopping trees.
- Fishing is only possible from designated areas (e.g., bridge).
- The minigame is clear, has feedback (success/failure), and adds materials to the inventory.

---

### 4. Non-Destructive Rock Collection Mechanic

**Goal:** Allow the player to collect rocks without damaging the environment.

**Design Concept:**
- Rocks are gathered from **loose stones**, **riverbed pebbles**, or **fallen rock fragments**, not mined directly out of cliffs or large formations.
- Over time, some rock piles **replenish** to simulate natural accumulation (river flow, erosion, etc.).

**Tasks:**
- [ ] Place **rock piles** or **loose stone nodes** in the environment:
  - On riverbanks.
  - Around paths.
  - Near garden edges.
- [ ] Implement interaction:
  - Player uses **hands** or **pickaxe** to collect from these nodes.
  - Each node has a limited number of stones before it becomes “empty.”
- [ ] Add **non-destructive lore/UX**:
  - Tooltips or small text: “You’re gathering loose stones carried by the river, not damaging the landscape.”
- [ ] Optional: Implement a **slow respawn** of rock piles in certain areas.

**Acceptance Criteria:**
- Collecting rocks does not visually alter major natural formations (no big holes in cliffs).
- Rock nodes visually indicate when they are depleted and when they respawn.
- The game explicitly frames rock collection as using loose, naturally available materials.

---

### 5. Tool System & Upgrades (Hammer, Fishing Rod, Pickaxe)

**Goal:** Introduce tools and an upgrade path that increases collection efficiency while preserving ecofriendly constraints.

**Tasks:**
- [ ] Implement a **Tool** data structure (class/ScriptableObject/config) with:
  - `name` (Hammer, Fishing Rod, Pickaxe).
  - `level` (e.g., 1–3).
  - `efficiency` (affects collection speed/amount).
  - `durability` (optional).
- [ ] Implement **basic tools**:
  - **Hammer**: Used for building, repairing furniture, assembling decorations from collected materials.
  - **Fishing Rod**: Used for fishing debris from the bridge.
  - **Pickaxe**: Used to collect from rock piles more efficiently (not for breaking large rocks).
- [ ] Add a **Tool Upgrade Station** (e.g., workbench inside cabin or a local shop):
  - Player can spend materials or money (from plant sales) to upgrade tools.
  - Upgrades increase:
    - Amount of material per action.
    - Chance for rare materials.
    - Reduced action time.
- [ ] Add UI indicators showing:
  - Current tool selected.
  - Tool level and effect (e.g., “Fishing Rod L2: +20% chance for rare debris”).

**Acceptance Criteria:**
- Player can access and switch between tools.
- Each tool has at least 2–3 upgrade levels with clear, perceivable benefits.
- Upgrades require materials or currency gained from sustainable activities (fishing debris, plant sales).

---

### 6. Gloomy Visual Identity

**Goal:** Give the game a more gloomy, moody atmosphere, similar to the references in `@context/images`.

**Tasks:**
- [ ] Adjust **global lighting**:
  - Lower overall brightness.
  - Increase contrast and subtle vignetting.
  - Slightly desaturated color palette with muted greens and browns.
- [ ] Update **skybox / background**:
  - Overcast clouds or late-afternoon/early-evening sky.
- [ ] Add **post-processing** (if engine supports it):
  - Slight bloom for lamps and windows.
  - Color grading toward cooler tones (bluish/gray) with warm highlights from interior lights.
- [ ] Update **environment assets**:
  - Darker, more weathered textures on cabin, bridge, and road.
  - Subtle fog or mist near the river.
- [ ] Ensure performance remains acceptable after visual changes.

**Acceptance Criteria:**
- The scene feels moody and slightly gloomy but still cozy and inviting.
- Lighting and color grading are consistent across main areas (road, bridge, cabin, garden).
- No critical visibility issues (important objects remain clearly readable).

---

### 7. UI Overhaul: Materials, Inventory, and Tool Info

**Goal:** Provide clear visibility into materials, inventory, and tools.

**Tasks:**
- [ ] Implement or refine an **Inventory Panel**:
  - Shows all collected materials (wood, metal scraps, rocks, plant cuttings, seeds, etc.).
  - Shows stack counts and item descriptions.
- [ ] Add a **Materials Summary HUD**:
  - Small HUD section that shows key resource counts (e.g., wood, rocks, metal, seeds, money).
- [ ] Add **Tool HUD**:
  - Currently equipped tool icon.
  - Tool level and any special bonuses.
- [ ] Add **Plant Propagation UI** (see next section) integrated into inventory or a dedicated screen.
- [ ] Ensure UI supports:
  - Keyboard/mouse navigation.
  - Clear, eco-themed icons and colors (greens, earthy tones).
- [ ] Add tooltips or short text descriptions explaining:
  - Where resources come from (e.g., “Driftwood: collected by fishing debris from the river.”).

**Acceptance Criteria:**
- Player can see their inventory and materials at a glance.
- Changing tools updates the HUD immediately.
- Inventory updates correctly when collecting, using, selling, or crafting items.

---

### 8. Plant Propagation and Trading System

**Goal:** Allow players to propagate plants and sell them to obtain new items and upgrades.

**Design Concept:**
- The player finds **plant cuttings, seeds, or small starter plants**.
- Using pots, soil, and time, they can **propagate** plants.
- Mature plants can be:
  - Placed as decorations in the cabin/garden.
  - Sold for currency or rare materials.

**Tasks:**
- [ ] Add **plant items**:
  - Seeds.
  - Cuttings.
  - Potted plants at different growth stages.
- [ ] Implement **Propagation Stations**:
  - E.g., a potting table or greenhouse area.
  - Player can combine:
    - A pot.
    - Soil (resource).
    - A seed or cutting.
  - This starts a **growth timer**.
- [ ] Implement **growth stages**:
  - Stage 1: Newly planted.
  - Stage 2: Growing.
  - Stage 3: Mature (ready to decorate/sell).
- [ ] Add **Plant Management UI**:
  - Shows all active plants, their growth stages, and time remaining.
- [ ] Implement **selling mechanic**:
  - A local buyer, market stall, or “delivery box” near the cabin.
  - Player can sell mature plants for:
    - Currency.
    - Rare materials or upgrade tokens.
- [ ] Ensure placing plants as decorations:
  - Updates the look of the cabin/garden.
  - Can contribute to a “coziness” or “eco-score” (optional future extension).

**Acceptance Criteria:**
- Player can obtain seeds/cuttings (e.g., via fishing rare items, found in the world, or initial starter kit).
- Player can propagate plants from seed/cutting to mature plant.
- Player can sell mature plants in exchange for currency or materials used for tool upgrades or new decorative items.
- Plant decorations persist in the world and visually improve the cabin/garden.

---

### 9. Player Accounts & Progress Saving (Email + Password)

**Goal:** Link each game to a player account (email + password) so players can sign in from any device to continue and check their progress. Accounts and saves will live in **Supabase** (Supabase Auth for accounts, a table for saves). The Supabase project will be configured later, so the game must work before it exists.

**Tasks:**
- [ ] Use **Supabase Auth** email/password sign-up, sign-in, password reset and sign-out. Never store or handle passwords in our own tables or code beyond passing them to Supabase Auth.
- [ ] Define a `SaveStore` / `AuthService` interface (e.g. `signUp`, `signIn`, `signOut`, `loadProgress`, `saveProgress`) so the game code never calls Supabase directly.
- [ ] Implement a **local fallback** (e.g. `localStorage`, single local player, no real accounts) used while Supabase is not configured, so the game can be developed and played end to end.
- [ ] Implement a **Supabase adapter**, enabled only when `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set.
- [ ] Draft the table schema (to be created when Supabase is set up), for example:
  - `profiles`: `user_id` (PK, FK → `auth.users.id`), `name` (text), `created_at`, `updated_at`.
  - `progress`: `user_id` (FK → `profiles`), `state` (jsonb: inventory, tool levels, cabin build stage, placed plants, propagation timers, tutorial completed), `updated_at`.
  - The email lives only in Supabase Auth (`auth.users`); don't copy it into other tables.
- [ ] Save automatically at key moments (finishing onboarding, building/upgrading, planting, selling) and when the player leaves the page.
- [ ] Add a simple **progress summary** shown after signing in (e.g. cabin build stage, plants owned/propagated, tool levels).
- [ ] Add a **Delete my account** option (in the in-game menu and referenced on the Privacy page) that removes the account, profile and progress.

**Security notes (for when Supabase is configured):**
- Turn on Row Level Security on `profiles` and `progress` with policies limited to `auth.uid() = user_id`, so players can only read and write their own data.
- Keep the Supabase service-role key server-side only; the client uses the anon key.
- Decide whether to require email confirmation (recommended, to stop sign-ups with someone else's email).
- Player names are user input: limit length and escape them when displayed.

**Acceptance Criteria:**
- Each game is linked to one account, and signing in on any device restores that player's progress.
- A player can only access their own progress.
- With no Supabase configuration, the game still runs end to end using the local fallback.
- Switching to Supabase later requires only setting environment variables, creating the tables/policies and enabling email auth, not changing game code.

---

### 10. Privacy Page

**Goal:** Explain plainly what data we collect and why, backing up the promise that the email is only used to save the game.

**Tasks:**
- [ ] Add a `/privacy` page, linked from the start screen, the account creation screen (next to the email note) and the in-game menu.
- [ ] Content, in plain language:
  - **What we collect:** name, email, password (stored hashed by our auth provider; we never see it), and game progress.
  - **Why:** only to create your account and save your game. We don't send marketing emails, and we don't sell or share your email. The only emails you'll get are account emails (confirmation, password reset).
  - **Where it's stored:** Supabase (our database and auth provider), including the region once chosen.
  - **How long we keep it:** until you delete your account (and any inactivity period we decide on).
  - **Your choices:** how to delete your account and data, and a contact for privacy questions.
  - **Last updated** date.
- [ ] Have the final wording reviewed before launch (e.g. GDPR/UK GDPR applies if players are in the UK/EU).

**Acceptance Criteria:**
- The Privacy page is reachable from the start screen, account creation and in-game menu, including when signed out.
- The page matches what the game actually does with player data.
- The page explains how to delete your account, and that option works.

---

## Non-Functional & Design Constraints

- **Ecofriendly theme is enforced:**
  - No cutting down trees.
  - No harming animals or the environment.
  - Resource gathering must be framed as reuse, recycling, or non-destructive collection.
- **Performance:**
  - Visual changes (lighting/fog/post-processing) should not significantly degrade performance on target hardware.
- **Accessibility:**
  - Tutorial text and UI elements must be legible under the new gloomy lighting.
  - Provide options to adjust brightness and text size if possible.

---

## Definition of Done

- All acceptance criteria above are met.
- No game-breaking regressions in:
  - Movement.
  - Interaction.
  - Sign-up, sign-in and saving/loading progress.
- Onboarding (name, account creation, goal), Privacy page, tutorial, new world elements (road, taxi, bridge fishing), tools, UI, and plant propagation are all testable in a single play session starting from a fresh save.
- The overall experience clearly communicates the sustainable, ecofriendly mission and supports it through all core mechanics.