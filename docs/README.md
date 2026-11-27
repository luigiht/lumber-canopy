# Lumber & Canopy docs

Context for anyone working on the game, whether a person or an AI assistant. Read these before making changes; update them when you change a rule, a number or a direction.

| Document | What's in it |
| --- | --- |
| [GAMEPLAY.md](GAMEPLAY.md) | How the game plays: the loop, every system, and the numbers behind them. |
| [DECISIONS.md](DECISIONS.md) | Why things are the way they are: each significant choice, its reason and what it rules out. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | How the code is organised, how data flows, and how to add common things. |
| [ART-DIRECTION.md](ART-DIRECTION.md) | The look: voxel scale, palette, lighting, mist, UI, fonts and pixel icons. |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Deploying to Vercel on every push: one-time setup, environment variables, Supabase URLs. |

Elsewhere:

- [`../README.md`](../README.md): what the game is and how to run it.
- [`../CHANGELOG.md`](../CHANGELOG.md): what changed in each version.
- [`../context/features/pbi-game-enhancements.md`](../context/features/pbi-game-enhancements.md): the original feature brief (PBI).
- [`../context/images/`](../context/images/): visual references. *Misty Mountain Cabin and Waterfall Valley* is the main mood reference.

The single source of truth is always the code. The most important numbers live in `src/config/` and `src/game/`; this folder explains them, and points to where they are.
