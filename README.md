# Signal Frontier

Signal Frontier is a single-page idle/strategy game built with Vite + React + Tailwind + Framer Motion. You collect signal, launch missions to asteroids/planets, build outposts, recruit crew, research tech, and prestige for long-term boosts. It saves locally and supports profile export/import.

## Play Loop
- Collect signal and run pulse scans for early resources.
- Launch missions to targets for metal/fuel/research; pick stances and specialists for different cargo/hazard tradeoffs.
- Build and upgrade hub structures to unlock slots, production, and research.
- Establish bases per biome, resolve events, and run local ops to boost production.
- Recruit crew, assign roles, and research branching tech to unlock new targets and efficiencies.
- Prestige to reset with production bonuses; progress auto-saves locally (plus export/import).

## Build/Deploy
- Dev: `npm install` then `npm run dev` inside `signal-game/`.
- Prod build: `npm run build`; output goes to `signal-game/dist` (Vite base set for GitHub Pages).
- Deploy: GitHub Actions workflow builds and publishes Pages from `main`.

## Save/Profiles
- Auto-saves every few seconds to localStorage + cookie. Export/import is available in Profile tab. Local saves are per-browser; use export/import to move devices.
