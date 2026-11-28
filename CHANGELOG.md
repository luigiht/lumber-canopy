# Changelog

All notable changes to Lumber & Canopy are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Seed trees:** the four broadleaf trees now and then have 1–2 seeds caught in their branches, mostly spider plant and pothos. A picked tree has seeds again after 10–16 in-game hours, and its marker dims until then.
- **Garden field:** a rope-fenced patch in front of the cabin, where you build raised beds (3, then 6) and sow seeds there with a little soil and no pot. Each bed gives back 2–3 seeds of its kind.
- **Email confirmation in Settings:** the Account section shows whether your email is confirmed, checks again with the server when Settings opens, and lets you resend the confirmation link (with a 60-second cooldown) or check again. Players still waiting to confirm can enter their password to check after confirming on another device; their game then moves to the account without leaving play.

### Changed

- The welcome-back summary shows each tool's level as a small label next to its name.
- The potting table no longer lists the plants on display ("In and around your cabin"); the Plants panel (P) still does.
- **Cabin exterior** redesigned after the cozy forest cabin sheets:
  - a straight, even slate roof with fine shingles, bargeboards, fascia and rafter tails;
  - a raised stone-block foundation;
  - board-and-batten walls with honey A-frame timbering and bigger windows;
  - a stone chimney with a firebox base;
  - a porch on stone piers, with balustered railings and four steps;
  - flower boxes, a bench, crate and barrel, a doormat, a lamp post, ivy and shrubs;
  - a woodpile of round, staggered logs with bark rims, pale cut ends and uneven lengths, under a slate lean-to, with a chopping stump and axe beside it.
- **Cabin interior** is roomier (10 × 8 tiles, up from 8 × 6) and restyled:
  - log walls framed in honey timber, with a vaulted gable on the back wall;
  - a stone fireplace in place of the wood stove;
  - a green sofa and armchairs, and a green-and-gold rug;
  - a balustered loft railing and a reading chair in the loft;
  - a bedside table and lamp on each side of the bed, the wardrobe moved into the corner clear of the windows, and a sideboard under the back loft window holding the corner plant spot.
- **Footbridge** rebuilt in more detail: stone abutments set into both banks, a gently arched plank deck (with gaps, knots and nails) on two stringers, two braced trestle bents standing in the river, railings with posts, a handrail and a mid rail, mossy stone pillars at each end and a lantern on the cabin side. The dirt paths now run right over the bank onto the bridge at both ends, and the player follows the deck's arch.
- **Bridge collision:** the player and the otter stay on a lane between the railings and can only step onto the bridge from the paths at its ends, not through the railings, the pillars or from the bank beside it.
- **Player character** redesigned as gender-neutral: no beard, chin-length hair under the beanie with a side-swept fringe, rounder eyes and a small smile.
- **Houseplants** have more detail, and displayed plants come in a mix of pots: terracotta, cream, charcoal, woven basket, and a stand on floor spots.

## [0.1.0] - 2026-11-27

The first playable version: an eco-friendly cabin and garden game built on the misty valley diorama.

### Added

- **Onboarding:** start screen, account creation (name, email, password), sign-in, forgotten password, email confirmation, a goal screen explaining the game, and a four-step controls tutorial that can be skipped.
- **Accounts and saving:** Supabase email/password accounts with row-level security, automatic saving, a welcome-back progress summary, sign out and delete account. Without Supabase configured, an offline mode keeps accounts and saves in the browser.
- **Privacy page** (`/privacy`) and a **reset password** page (`/reset-password`).
- **Arrival by taxi** along a curving road that continues past the walkable area.
- **Fishing** for river debris (never fish) from the bridge, with a timing minigame and common, uncommon and rare finds.
- **Loose-stone piles** and a **compost heap** that empty as you gather and refill over time.
- **Cabin stages that cost reclaimed materials** (stone, driftwood, scrap, nails, glass, metal, rope).
- **Tools** (hammer, fishing rod, pickaxe) with three upgrade levels each at the workbench, plus making planter pots.
- **Houseplants:** five species grown from seeds or cuttings at the potting table, three growth stages, propagation, and placement in the garden, on the porch and inside the cabin.
- **Delivery box** to sell plants for coins or trade them for materials.
- **Cabin interior:** a cutaway two-floor view with a living room, kitchen and bedroom loft, ten plant spots, a bookshelf with a record player, stairs and walls that hide as the camera turns.
- **Sleeping:** go to bed and wake at 07:00 the next morning; plants grow and piles refill while you sleep.
- **Otter companion:** feed it seeds to befriend it; it follows you and dives for finds that improve with friendship.
- **HUD:** resource bar, toolbar, inventory, plants, workbench, delivery and otter panels, world markers, toasts, goal hints, brightness and text-size settings, and **H** to hide the UI for screenshots.
- **Pixel-art icons** (16×16) for every item, tool and button.
- **Loading screen** with the intro illustration, logo and a pixel spinner.
- **SEO and GEO:** page metadata, Open Graph and Twitter share images, favicon and app icons, a web app manifest, `robots.txt`, a sitemap, structured data describing the game, and `llms.txt`.

### Changed

- A moodier look: muted greens, greyer stone, teal water, a desaturating colour grade with a vignette, and soft bloom from lamps and windows at night.
- Mist now rests on the treetops and stays off the river, with boxy clouds floating over the river and hills.
- Body text uses DM Sans; the Pixelta pixel font is kept for headings and buttons.
- The lumberjack's axe is gone: the character carries whichever tool is selected.

### Fixed

- Shadow acne (small triangles) on block faces turned away from the sun.
- A gap between the top of the stairs and the bedroom loft.
- Players walking through the potting table, workbench, compost heap and delivery box.
