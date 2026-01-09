# Signal Game

A browser-based idle game focused on signal collection, research, expeditions, AI directives, and prestige loops. The app runs as a static site served by a small Express server and stores progress locally in the browser.

## Features
- Click + idle signal generation with upgrades and research.
- Missions that scale per ascension and reward signal or insight.
- AI director events with choices and timed buffs.
- Expeditions that return signal, insight, and relics.
- Prestige (resonance) + legacy upgrades.
- Sponsor relay boost (simulated, no external ad network).
- Local profiles and preferences stored in `localStorage`.

## Local setup
```bash
npm install
npm start
```

Open `http://localhost:3000`.

## Controls
- Space: collect signal
- C: convert insight
- U: buy cheapest upgrade
- E: start quick expedition
- A: ascend
- Alt+1 / Alt+2: switch tabs

## Notes
- Progress is saved per account in the browser.
- Sponsor clips are simulated. If you want real ads, integrate a compliant ad unit (AdSense does not allow rewarded ads).
