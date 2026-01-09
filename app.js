
(() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const STORAGE_KEY = "signalDeskProfiles";
  const ACTIVE_KEY = "signalDeskActive";
  const TICK_RATE = 250;
  const UI_RATE = 750;
  const HEAVY_UI_RATE = 2000;
  const SAVE_INTERVAL = 10000;
  const AD_DURATION_MS = 8000;
  const AD_BOOST_MS = 10 * 60 * 1000;
  const AD_COOLDOWN_MS = 15 * 60 * 1000;
  const AD_MULT = 1.4;
  const OFFLINE_BASE_CAP = 4 * 60 * 60;
  const OFFLINE_BASE_MULT = 0.65;
  const FACTION_SWITCH_COOLDOWN = 12 * 60 * 60 * 1000;

  const UPGRADE_DEFS = [
    { id: "scanner", name: "Scanner Drones", desc: "Autonomous drones harvesting weak signal.", baseCost: 15, growth: 1.18, perSec: 0.4, click: 0.05 },
    { id: "relay", name: "Relay Towers", desc: "Signal amplification backbone for long-haul sweeps.", baseCost: 85, growth: 1.2, perSec: 2.4, click: 0.15 },
    { id: "well", name: "Quantum Wells", desc: "Stabilized wells that pull in dense signal.", baseCost: 460, growth: 1.22, perSec: 10, click: 0.35 },
    { id: "forge", name: "Pulse Forge", desc: "High-frequency pulses convert noise to signal.", baseCost: 2200, growth: 1.23, perSec: 45, click: 0.8 },
    { id: "neural", name: "Neural Arrays", desc: "Adaptive pattern mining for constant yield.", baseCost: 10000, growth: 1.24, perSec: 210, click: 1.6 },
    { id: "void", name: "Void Extractors", desc: "Deep field extractors siphon latent signal.", baseCost: 65000, growth: 1.25, perSec: 920, click: 3.2 }
  ];

  const RESEARCH_DEFS = [
    { id: "compression", name: "Signal Compression", desc: "+8% signal output per level.", baseCost: 25, growth: 1.5, max: 6 },
    { id: "distill", name: "Insight Distillation", desc: "+10% insight conversion per level.", baseCost: 20, growth: 1.45, max: 6 },
    { id: "feedback", name: "Resonant Feedback", desc: "+4% resonance gain per level.", baseCost: 35, growth: 1.55, max: 5 },
    { id: "logistics", name: "Expedition Logistics", desc: "-8% expedition time per level.", baseCost: 28, growth: 1.5, max: 5 },
    { id: "catalyst", name: "Archive Catalyst", desc: "+6% relic discovery per level.", baseCost: 26, growth: 1.5, max: 5 },
    { id: "analytics", name: "Mission Analytics", desc: "+10% mission rewards per level.", baseCost: 24, growth: 1.45, max: 6 }
  ];

  const LEGACY_DEFS = [
    { id: "echo", name: "Echo Amplifiers", desc: "+5% signal output per level.", baseCost: 4, growth: 1.6, max: 10 },
    { id: "insight", name: "Residual Insight", desc: "+6% insight conversion per level.", baseCost: 4, growth: 1.6, max: 10 },
    { id: "shadow", name: "Shadow Ops", desc: "+2% mission rewards per level.", baseCost: 3, growth: 1.5, max: 20 },
    { id: "dampers", name: "Anomaly Dampers", desc: "-8% anomaly duration per level.", baseCost: 6, growth: 1.55, max: 8 },
    { id: "sponsor", name: "Sponsor Relations", desc: "-5% sponsor cooldown per level.", baseCost: 8, growth: 1.6, max: 8 }
  ];

  const META_DEFS = [
    { id: "atlas", name: "Atlas Memory", desc: "+7% signal output per level.", baseCost: 2, growth: 1.7, max: 12 },
    { id: "stasis", name: "Stasis Vaults", desc: "+25% offline cap per level.", baseCost: 2, growth: 1.65, max: 10 },
    { id: "covenant", name: "Faction Concord", desc: "+10% faction reputation per level.", baseCost: 3, growth: 1.7, max: 10 },
    { id: "uplink", name: "Star Uplink", desc: "+6% expedition rewards per level.", baseCost: 2, growth: 1.6, max: 12 }
  ];

  const EXPEDITION_DEFS = [
    { id: "sweep", name: "Signal Sweep", desc: "Short range scan run.", cost: 250, duration: 45000, rewardSignal: 800, rewardInsight: 6, success: 0.9 },
    { id: "deep", name: "Deep Listen", desc: "Mid-range expedition for rare signal.", cost: 1400, duration: 120000, rewardSignal: 5200, rewardInsight: 18, success: 0.8 },
    { id: "rift", name: "Rift Traverse", desc: "High-risk venture into unstable bands.", cost: 9000, duration: 300000, rewardSignal: 30000, rewardInsight: 55, success: 0.7 }
  ];

  const MISSION_TEMPLATES = [
    {
      id: "earn",
      label: "Harvest {goal} signal",
      goal: (tier) => Math.floor(2500 * Math.pow(1.55, tier - 1)),
      progress: (game) => game.cycle.earned,
      rewardType: "signal",
      rewardScale: 0.3
    },
    {
      id: "spend",
      label: "Spend {goal} signal",
      goal: (tier) => Math.floor(2000 * Math.pow(1.55, tier - 1)),
      progress: (game) => game.cycle.spent,
      rewardType: "signal",
      rewardScale: 0.25
    },
    {
      id: "clicks",
      label: "Manual calibrations: {goal}",
      goal: (tier) => 140 + tier * 40,
      progress: (game) => game.cycle.clicks,
      rewardType: "signal",
      rewardScale: 12
    },
    {
      id: "expeditions",
      label: "Run {goal} expeditions",
      goal: (tier) => Math.max(2, Math.ceil(tier / 2) + 1),
      progress: (game) => game.cycle.expeditions,
      rewardType: "insight",
      rewardScale: 6
    },
    {
      id: "upgrades",
      label: "Purchase {goal} upgrades",
      goal: (tier) => 4 + tier,
      progress: (game) => game.cycle.upgrades,
      rewardType: "signal",
      rewardScale: 500
    },
    {
      id: "insight",
      label: "Distill {goal} insight",
      goal: (tier) => 90 + tier * 30,
      progress: (game) => game.cycle.insight,
      rewardType: "insight",
      rewardScale: 0.25
    }
  ];

  const RELIC_DEFS = [
    { name: "Fractal Prism", type: "signal", bonus: 0.04 },
    { name: "Echo Coil", type: "signal", bonus: 0.05 },
    { name: "Drift Compass", type: "insight", bonus: 0.05 },
    { name: "Chrono Lens", type: "click", bonus: 0.04 },
    { name: "Stellar Loom", type: "signal", bonus: 0.06 },
    { name: "Mnemonic Key", type: "insight", bonus: 0.04 },
    { name: "Pulse Anchors", type: "click", bonus: 0.05 }
  ];

  const DAILY_EFFECTS = [
    { id: "signal", label: "Signal Surge", signal: 1.1, click: 1, insight: 1, mission: 1 },
    { id: "insight", label: "Insight Focus", signal: 1, click: 1, insight: 1.15, mission: 1 },
    { id: "click", label: "Manual Edge", signal: 1, click: 1.2, insight: 1, mission: 1 },
    { id: "mission", label: "Mission Rally", signal: 1, click: 1, insight: 1, mission: 1.15 }
  ];

  const FACTION_DEFS = [
    {
      id: "helios",
      name: "Helios Union",
      desc: "Industrial harvesters focused on steady signal expansion.",
      bonus: { signal: 0.08, offline: 0.2 }
    },
    {
      id: "umbra",
      name: "Umbra Collective",
      desc: "Shadow analysts that amplify mission outcomes and relics.",
      bonus: { mission: 0.12, relic: 0.05 }
    },
    {
      id: "aether",
      name: "Aether Guild",
      desc: "Explorers who favor insight conversion and expeditions.",
      bonus: { insight: 0.1, expedition: 0.08 }
    }
  ];

  const FACTION_RANKS = [
    { name: "Initiate", threshold: 0, mult: 1 },
    { name: "Agent", threshold: 75, mult: 1.1 },
    { name: "Operative", threshold: 200, mult: 1.2 },
    { name: "Command", threshold: 500, mult: 1.35 },
    { name: "Director", threshold: 1000, mult: 1.5 }
  ];

  const AI_EVENT_LIBRARY = [
    {
      id: "surge",
      title: "Director: Signal Surge",
      body: "A high-energy wave is inbound. Choose a directive.",
      options: [
        {
          id: "stabilize",
          label: "Stabilize Wave",
          summary: "Signal +25% for 2 minutes.",
          apply: (game) => applyBuff(game, "Stabilized Surge", 120000, 1.25, 1.05)
        },
        {
          id: "harvest",
          label: "Harvest Spike",
          summary: "Gain instant signal.",
          apply: (game) => gainSignal(game, Math.floor(600 + game.signal * 0.15))
        }
      ]
    },
    {
      id: "rift",
      title: "Director: Rift Echo",
      body: "A volatile rift opens with weak stability.",
      options: [
        {
          id: "anchor",
          label: "Anchor Beacons",
          summary: "Signal +15% and click +10% for 3 minutes.",
          apply: (game) => applyBuff(game, "Anchored Beacons", 180000, 1.15, 1.1)
        },
        {
          id: "salvage",
          label: "Salvage Fragments",
          summary: "Gain insight and a relic chance.",
          apply: (game) => {
            gainInsight(game, 10);
            maybeDiscoverRelic(game, calculateRates(game, Date.now()));
          }
        }
      ]
    },
    {
      id: "protocol",
      title: "Director: Containment Protocol",
      body: "Incoming drift threatens signal integrity.",
      options: [
        {
          id: "contain",
          label: "Contain Drift",
          summary: "Remove active anomaly and gain signal.",
          apply: (game) => {
            game.anomaly = { label: "", mult: 1, endsAt: 0 };
            gainSignal(game, 1200);
          }
        },
        {
          id: "observe",
          label: "Observe Pattern",
          summary: "Gain insight and mission bonus.",
          apply: (game) => {
            gainInsight(game, 12);
            applyBuff(game, "Pattern Insight", 150000, 1.05, 1.05);
          }
        }
      ]
    },
    {
      id: "sponsor",
      title: "Director: Sponsor Ping",
      body: "A sponsor requests priority routing.",
      options: [
        {
          id: "accept",
          label: "Accept Contract",
          summary: "Reduce sponsor cooldown and gain signal.",
          apply: (game) => {
            game.ads.cooldownUntil = Math.max(Date.now(), game.ads.cooldownUntil - 120000);
            gainSignal(game, 900);
          }
        },
        {
          id: "decline",
          label: "Decline",
          summary: "Gain a relic and reset anomaly timer.",
          apply: (game) => {
            maybeDiscoverRelic(game, calculateRates(game, Date.now()));
            game.nextAnomalyAt = Date.now() + randRange(60000, 120000);
          }
        }
      ]
    }
  ];

  const ACHIEVEMENTS = [
    {
      id: "spark",
      name: "First Spark",
      desc: "Hold 1,000 signal.",
      test: (game) => game.signal >= 1000,
      reward: { type: "signal", amount: 500 }
    },
    {
      id: "flow",
      name: "Signal Flow",
      desc: "Reach 50 signal per sec.",
      test: (game, rates) => rates.perSec >= 50,
      reward: { type: "insight", amount: 10 }
    },
    {
      id: "insight",
      name: "Clarity",
      desc: "Earn 50 insight.",
      test: (game) => game.stats.totalInsight >= 50,
      reward: { type: "signal", amount: 1200 }
    },
    {
      id: "voyager",
      name: "Voyager",
      desc: "Complete 5 expeditions.",
      test: (game) => game.stats.expeditions >= 5,
      reward: { type: "insight", amount: 15 }
    },
    {
      id: "architect",
      name: "Architect",
      desc: "Purchase 20 upgrades.",
      test: (game) => game.stats.totalUpgrades >= 20,
      reward: { type: "signal", amount: 2000 }
    },
    {
      id: "ascend",
      name: "First Ascension",
      desc: "Ascend once.",
      test: (game) => game.stats.ascensions >= 1,
      reward: { type: "resonance", amount: 6 }
    },
    {
      id: "archive",
      name: "Archivist",
      desc: "Discover 3 relics.",
      test: (game) => game.archive.length >= 3,
      reward: { type: "resonance", amount: 4 }
    },
    {
      id: "mission",
      name: "Field Marshal",
      desc: "Reach mission tier 3.",
      test: (game) => game.missions.tier >= 3,
      reward: { type: "insight", amount: 20 }
    },
    {
      id: "transcend",
      name: "Starlight",
      desc: "Transcend once.",
      test: (game) => game.stats.transcends >= 1,
      reward: { type: "starlight", amount: 2 }
    }
  ];

  const STORY_ENTRIES = [
    {
      id: "signal_first",
      title: "First Broadcast",
      body: "The console hums to life. A faint signal breaks the noise and the relay lights up.",
      condition: (game) => game.stats.totalEarned >= 2000
    },
    {
      id: "faction_choice",
      title: "Council Invitation",
      body: "Three factions request your alignment. Each offers a different path through the drift.",
      condition: (game) => !!game.faction.id
    },
    {
      id: "ascend_echo",
      title: "Resonance Echo",
      body: "Your first ascent reverberates across the array. The system remembers you.",
      condition: (game) => game.stats.lifetimeAscensions >= 1
    },
    {
      id: "relic_found",
      title: "Relic Recovered",
      body: "A relic surfaces from the void, humming with archived intelligence.",
      condition: (game) => game.archive.length >= 1
    },
    {
      id: "directive_chain",
      title: "Director's Pattern",
      body: "The Director AI starts predicting your moves. Patterns emerge in the anomalies.",
      condition: (game) => game.stats.anomalies >= 3
    },
    {
      id: "starlight_seed",
      title: "Starlight Seed",
      body: "Beyond resonance lies starlight. A new lattice of power becomes available.",
      condition: (game) => game.starlight >= 1
    }
  ];

  const state = {
    profiles: [],
    activeId: "",
    active: null,
    lastTickAt: Date.now(),
    lastSaveAt: 0,
    saveTimer: null,
    adTimer: null,
    adTimeout: null,
    adEndsAt: 0,
    lastMapSeed: null,
    cachedRates: null,
    lastHeavyRenderAt: 0,
    needsFullRender: true
  };

  let ui = {};
  let toastTimer = null;

  window.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheUi();
    bindUi();
    loadProfiles();
    applyActiveProfile();
    startLoops();
  }

  function cacheUi() {
    ui = {
      tabs: {
        game: $("#tab-game"),
        profile: $("#tab-profile")
      },
      panels: {
        game: $("#panel-game"),
        profile: $("#panel-profile")
      },
      subtabs: $$(".subtab"),
      gameClick: $("#gameClick"),
      convertInsight: $("#convertInsight"),
      ascendBtn: $("#ascendBtn"),
      statSignal: $("#statSignal"),
      statPerSec: $("#statPerSec"),
      statInsight: $("#statInsight"),
      statResonance: $("#statResonance"),
      statClick: $("#statClick"),
      statForecast: $("#statForecast"),
      dailyStatus: $("#dailyStatus"),
      anomalyStatus: $("#anomalyStatus"),
      buffStatus: $("#buffStatus"),
      adStatus: $("#adStatus"),
      offlineStatus: $("#offlineStatus"),
      upgradeList: $("#upgradeList"),
      researchList: $("#researchList"),
      expeditionStatus: $("#expeditionStatus"),
      expeditionList: $("#expeditionList"),
      signalMap: $("#signalMap"),
      mapRegen: $("#mapRegen"),
      missionStatus: $("#missionStatus"),
      missionList: $("#missionList"),
      aiStatus: $("#aiStatus"),
      aiEvent: $("#aiEvent"),
      factionStatus: $("#factionStatus"),
      factionList: $("#factionList"),
      adRelayStatus: $("#adRelayStatus"),
      adBoostBtn: $("#adBoostBtn"),
      metaStatus: $("#metaStatus"),
      metaList: $("#metaList"),
      transcendBtn: $("#transcendBtn"),
      legacyStatus: $("#legacyStatus"),
      legacyList: $("#legacyList"),
      archiveStatus: $("#archiveStatus"),
      archiveList: $("#archiveList"),
      storyStatus: $("#storyStatus"),
      storyList: $("#storyList"),
      achievementList: $("#achievementList"),
      logList: $("#logList"),
      accountName: $("#accountName"),
      accountCreate: $("#accountCreate"),
      accountRename: $("#accountRename"),
      accountDelete: $("#accountDelete"),
      accountSelect: $("#accountSelect"),
      accountSummary: $("#accountSummary"),
      prefDefaultTab: $("#prefDefaultTab"),
      prefCompact: $("#prefCompact"),
      prefAdsEnabled: $("#prefAdsEnabled"),
      resetGame: $("#resetGame"),
      adModal: $("#adModal"),
      adCountdown: $("#adCountdown"),
      adCancel: $("#adCancel"),
      toast: $("#toast")
    };
  }

  function bindUi() {
    if (ui.tabs.game) ui.tabs.game.addEventListener("click", () => setMainTab("game"));
    if (ui.tabs.profile) ui.tabs.profile.addEventListener("click", () => setMainTab("profile"));

    ui.subtabs.forEach((btn) => {
      btn.addEventListener("click", () => setSubtab(btn.dataset.section));
    });

    if (ui.gameClick) ui.gameClick.addEventListener("click", handleCollect);
    if (ui.convertInsight) ui.convertInsight.addEventListener("click", handleConvertInsight);
    if (ui.ascendBtn) ui.ascendBtn.addEventListener("click", attemptAscend);
    if (ui.mapRegen) ui.mapRegen.addEventListener("click", handleMapRegen);
    if (ui.adBoostBtn) ui.adBoostBtn.addEventListener("click", handleAdBoost);
    if (ui.adCancel) ui.adCancel.addEventListener("click", closeAdModal);

    if (ui.upgradeList) {
      ui.upgradeList.addEventListener("click", (event) => {
        const btn = event.target.closest("button[data-upgrade]");
        if (btn) buyUpgrade(btn.dataset.upgrade);
      });
    }

    if (ui.researchList) {
      ui.researchList.addEventListener("click", (event) => {
        const btn = event.target.closest("button[data-research]");
        if (btn) buyResearch(btn.dataset.research);
      });
    }

    if (ui.metaList) {
      ui.metaList.addEventListener("click", (event) => {
        const btn = event.target.closest("button[data-meta]");
        if (btn) buyMeta(btn.dataset.meta);
      });
    }

    if (ui.legacyList) {
      ui.legacyList.addEventListener("click", (event) => {
        const btn = event.target.closest("button[data-legacy]");
        if (btn) buyLegacy(btn.dataset.legacy);
      });
    }

    if (ui.expeditionList) {
      ui.expeditionList.addEventListener("click", (event) => {
        const btn = event.target.closest("button[data-expedition]");
        if (btn) startExpedition(btn.dataset.expedition);
      });
    }

    if (ui.missionList) {
      ui.missionList.addEventListener("click", (event) => {
        const btn = event.target.closest("button[data-mission]");
        if (btn) claimMission(btn.dataset.mission);
      });
    }

    if (ui.factionList) {
      ui.factionList.addEventListener("click", (event) => {
        const btn = event.target.closest("button[data-faction]");
        if (btn) selectFaction(btn.dataset.faction);
      });
    }

    if (ui.aiEvent) {
      ui.aiEvent.addEventListener("click", (event) => {
        const btn = event.target.closest("button[data-ai-option]");
        if (btn) resolveAiOption(btn.dataset.aiOption);
      });
    }

    if (ui.transcendBtn) ui.transcendBtn.addEventListener("click", attemptTranscend);

    if (ui.accountCreate) ui.accountCreate.addEventListener("click", handleAccountCreate);
    if (ui.accountRename) ui.accountRename.addEventListener("click", handleAccountRename);
    if (ui.accountDelete) ui.accountDelete.addEventListener("click", handleAccountDelete);
    if (ui.accountSelect) {
      ui.accountSelect.addEventListener("change", (event) => {
        setActiveProfile(event.target.value);
      });
    }

    if (ui.accountName) {
      ui.accountName.addEventListener("keydown", (event) => {
        if (event.key === "Enter") handleAccountCreate();
      });
    }

    if (ui.prefDefaultTab) {
      ui.prefDefaultTab.addEventListener("change", (event) => {
        const value = event.target.value;
        if (state.active) {
          state.active.prefs.defaultTab = value;
          setMainTab(value, false);
          scheduleSave();
        }
      });
    }

    if (ui.prefCompact) {
      ui.prefCompact.addEventListener("change", (event) => {
        if (state.active) {
          state.active.prefs.compact = event.target.checked;
          document.body.classList.toggle("compact", event.target.checked);
          scheduleSave();
        }
      });
    }

    if (ui.prefAdsEnabled) {
      ui.prefAdsEnabled.addEventListener("change", (event) => {
        if (state.active) {
          state.active.prefs.adsEnabled = event.target.checked;
          scheduleSave();
        }
      });
    }

    if (ui.resetGame) ui.resetGame.addEventListener("click", handleResetGame);

    document.addEventListener("keydown", (event) => {
      const tag = event.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (event.code === "Space") {
        event.preventDefault();
        handleCollect();
        return;
      }

      if (event.key === "c" || event.key === "C") handleConvertInsight();
      if (event.key === "a" || event.key === "A") attemptAscend();
      if (event.key === "u" || event.key === "U") buyCheapestUpgrade();
      if (event.key === "e" || event.key === "E") startQuickExpedition();

      if (event.altKey && event.key === "1") setMainTab("game");
      if (event.altKey && event.key === "2") setMainTab("profile");
    });

    window.addEventListener("beforeunload", () => {
      const game = getGame();
      if (game) {
        game.lastActiveAt = Date.now();
        saveState();
      }
    });
  }

  function loadProfiles() {
    let data = null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {}
    }

    if (data && Array.isArray(data.profiles)) {
      state.profiles = data.profiles;
    } else {
      state.profiles = [createProfile("Pilot")];
    }

    state.profiles.forEach(normalizeProfile);

    const storedActive = localStorage.getItem(ACTIVE_KEY);
    const found = state.profiles.find((profile) => profile.id === storedActive);
    state.active = found || state.profiles[0];
    state.activeId = state.active.id;
  }

  function saveState() {
    try {
      if (state.active?.game) state.active.game.lastActiveAt = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, profiles: state.profiles }));
      localStorage.setItem(ACTIVE_KEY, state.activeId);
      state.lastSaveAt = Date.now();
    } catch {}
  }

  function scheduleSave() {
    if (state.saveTimer) return;
    state.saveTimer = setTimeout(() => {
      state.saveTimer = null;
      saveState();
    }, 1500);
  }

  function applyActiveProfile() {
    if (!state.active) return;
    normalizeProfile(state.active);
    applyPrefs(state.active.prefs);
    applyOfflineProgress(state.active.game);
    renderAccountSelect();
    state.needsFullRender = true;
    state.lastHeavyRenderAt = 0;
    state.lastMapSeed = null;
    drawMapIfNeeded();
    render();
  }

  function setActiveProfile(id) {
    const profile = state.profiles.find((p) => p.id === id);
    if (!profile) return;
    state.active = profile;
    state.activeId = profile.id;
    normalizeProfile(profile);
    applyPrefs(profile.prefs);
    applyOfflineProgress(profile.game);
    renderAccountSelect();
    state.needsFullRender = true;
    state.lastHeavyRenderAt = 0;
    state.lastMapSeed = null;
    drawMapIfNeeded();
    render();
    scheduleSave();
  }

  function renderAccountSelect() {
    if (!ui.accountSelect) return;
    const html = state.profiles
      .map((profile) => `<option value="${profile.id}">${escapeHtml(profile.name)}</option>`)
      .join("");
    setHtml(ui.accountSelect, html);
    ui.accountSelect.value = state.activeId;
  }

  function applyPrefs(prefs) {
    if (!prefs) return;
    if (ui.prefDefaultTab) ui.prefDefaultTab.value = prefs.defaultTab || "game";
    if (ui.prefCompact) ui.prefCompact.checked = !!prefs.compact;
    if (ui.prefAdsEnabled) ui.prefAdsEnabled.checked = prefs.adsEnabled !== false;
    document.body.classList.toggle("compact", !!prefs.compact);
    setMainTab(prefs.defaultTab || "game", false);
    setSubtab(prefs.gameSection || "command", false);
  }

  function setMainTab(tab, persist = true) {
    if (!ui.panels.game || !ui.panels.profile) return;
    const isGame = tab === "game";
    ui.panels.game.classList.toggle("hidden", !isGame);
    ui.panels.profile.classList.toggle("hidden", isGame);
    if (ui.tabs.game) ui.tabs.game.classList.toggle("active", isGame);
    if (ui.tabs.profile) ui.tabs.profile.classList.toggle("active", !isGame);

    if (persist && state.active) {
      state.active.prefs.defaultTab = tab;
      scheduleSave();
    }
  }

  function setSubtab(section, persist = true) {
    ui.subtabs.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.section === section);
    });

    document.querySelectorAll(".gameGrid .card[data-section]").forEach((card) => {
      card.classList.toggle("hidden", card.getAttribute("data-section") !== section);
    });

    if (persist && state.active) {
      state.active.prefs.gameSection = section;
      scheduleSave();
    }
  }

  function startLoops() {
    state.lastTickAt = Date.now();
    setInterval(tick, TICK_RATE);
    setInterval(render, UI_RATE);
  }

  function tick() {
    const game = getGame();
    if (!game) return;

    const now = Date.now();
    const delta = Math.min((now - state.lastTickAt) / 1000, 3);
    state.lastTickAt = now;

    applyDaily(game);
    updateAnomaly(game, now);
    updateAiEvent(game, now);
    updateBuff(game, now);

    const rates = calculateRates(game, now);
    state.cachedRates = rates;

    if (rates.perSec > 0 && delta > 0) {
      gainSignal(game, rates.perSec * delta);
    }

    updateExpedition(game, now, rates);

    if (now - state.lastSaveAt > SAVE_INTERVAL) saveState();
  }

  function render() {
    const game = getGame();
    if (!game) return;

    const now = Date.now();

    const rates = state.cachedRates || calculateRates(game, now);
    state.cachedRates = rates;

    renderStats(game, rates, now);
    renderAiEvent(game, now);
    renderAccountSummary(game, rates);
    renderAdRelay(game, now);

    const heavyDue = state.needsFullRender || now - state.lastHeavyRenderAt >= HEAVY_UI_RATE;
    if (heavyDue) {
      renderUpgrades(game, rates);
      renderResearch(game);
      renderMeta(game);
      renderFactions(game);
      renderLegacy(game, rates);
      renderExpeditions(game, rates, now);
      renderMissions(game, rates);
      renderArchive(game);
      checkStoryUnlocks(game, rates);
      renderStory(game);
      checkAchievements(game, rates);
      renderAchievements(game);
      renderLog(game);
      state.needsFullRender = false;
      state.lastHeavyRenderAt = now;
    }

    drawMapIfNeeded();
  }

  function markFullRender() {
    state.needsFullRender = true;
  }

  function handleCollect() {
    const game = getGame();
    if (!game) return;
    const rates = state.cachedRates || calculateRates(game, Date.now());
    gainSignal(game, rates.clickPower);
    game.cycle.clicks += 1;
    game.stats.totalClicks += 1;
    scheduleSave();
  }

  function handleConvertInsight() {
    const game = getGame();
    if (!game) return;
    const rates = state.cachedRates || calculateRates(game, Date.now());
    const spend = Math.floor(game.signal * 0.2);
    if (spend < 50) {
      toast("Need at least 50 signal to convert.");
      return;
    }

    if (!spendSignal(game, spend)) return;
    const gain = Math.max(1, Math.floor((spend / 100) * rates.insightMult));
    gainInsight(game, gain);
    logEvent(game, `Converted ${formatNumber(spend)} signal into ${formatNumber(gain)} insight.`);
    markFullRender();
    scheduleSave();
  }

  function handleMapRegen() {
    const game = getGame();
    if (!game) return;
    game.mapSeed = randomSeed();
    state.lastMapSeed = null;
    logEvent(game, "Constellation map recalibrated.");
    markFullRender();
    scheduleSave();
    drawMapIfNeeded();
  }

  function handleAdBoost() {
    const profile = state.active;
    if (!profile || !profile.prefs.adsEnabled) {
      toast("Sponsor clips are disabled.");
      return;
    }

    const game = getGame();
    if (!game) return;
    const now = Date.now();
    const cooldown = getAdCooldownMs(game);

    if (now < game.ads.cooldownUntil) {
      toast(`Sponsor available in ${formatDuration(game.ads.cooldownUntil - now)}.`);
      return;
    }

    openAdModal();
  }

  function handleAccountCreate() {
    if (!ui.accountName) return;
    const name = (ui.accountName.value || "").trim();
    if (!name) {
      toast("Enter a name to create an account.");
      return;
    }

    const profile = createProfile(name);
    state.profiles.push(profile);
    ui.accountName.value = "";
    setActiveProfile(profile.id);
    scheduleSave();
  }

  function handleAccountRename() {
    if (!ui.accountName || !state.active) return;
    const name = (ui.accountName.value || "").trim();
    if (!name) {
      toast("Enter a new name.");
      return;
    }

    state.active.name = name;
    ui.accountName.value = "";
    renderAccountSelect();
    renderAccountSummary(state.active.game, state.cachedRates || calculateRates(state.active.game, Date.now()));
    markFullRender();
    scheduleSave();
  }

  function handleAccountDelete() {
    if (!state.active) return;
    if (state.profiles.length <= 1) {
      toast("Create another account before deleting this one.");
      return;
    }

    const confirmed = window.confirm("Delete this account and its progress?");
    if (!confirmed) return;

    state.profiles = state.profiles.filter((profile) => profile.id !== state.activeId);
    state.active = state.profiles[0];
    state.activeId = state.active.id;
    applyActiveProfile();
    scheduleSave();
  }

  function handleResetGame() {
    if (!state.active) return;
    const confirmed = window.confirm("Reset game progress for this account?");
    if (!confirmed) return;
    state.active.game = createNewGame();
    state.lastMapSeed = null;
    applyActiveProfile();
    markFullRender();
    scheduleSave();
  }

  function buyUpgrade(id) {
    const game = getGame();
    if (!game) return;
    const def = UPGRADE_DEFS.find((item) => item.id === id);
    if (!def) return;

    const level = getLevel(game.upgrades, id);
    const cost = getUpgradeCost(def, level);

    if (!spendSignal(game, cost)) {
      toast("Not enough signal.");
      return;
    }

    game.upgrades[id] = level + 1;
    game.cycle.upgrades += 1;
    game.stats.totalUpgrades += 1;
    logEvent(game, `Upgrade purchased: ${def.name}.`);
    markFullRender();
    scheduleSave();
  }

  function buyCheapestUpgrade() {
    const game = getGame();
    if (!game) return;

    let cheapest = null;
    UPGRADE_DEFS.forEach((def) => {
      const level = getLevel(game.upgrades, def.id);
      const cost = getUpgradeCost(def, level);
      if (!cheapest || cost < cheapest.cost) {
        cheapest = { def, cost };
      }
    });

    if (cheapest) buyUpgrade(cheapest.def.id);
  }

  function buyResearch(id) {
    const game = getGame();
    if (!game) return;
    const def = RESEARCH_DEFS.find((item) => item.id === id);
    if (!def) return;

    const level = getLevel(game.research, id);
    if (level >= def.max) {
      toast("Research already maxed.");
      return;
    }

    const cost = getResearchCost(def, level);
    if (game.insight < cost) {
      toast("Not enough insight.");
      return;
    }

    game.insight -= cost;
    game.research[id] = level + 1;
    logEvent(game, `Research upgraded: ${def.name}.`);
    markFullRender();
    scheduleSave();
  }

  function buyMeta(id) {
    const game = getGame();
    if (!game) return;
    const def = META_DEFS.find((item) => item.id === id);
    if (!def) return;

    const level = getLevel(game.meta, id);
    if (level >= def.max) {
      toast("Meta upgrade already maxed.");
      return;
    }

    const cost = getMetaCost(def, level);
    if (game.starlight < cost) {
      toast("Not enough starlight.");
      return;
    }

    game.starlight -= cost;
    game.meta[id] = level + 1;
    logEvent(game, `Meta upgraded: ${def.name}.`);
    markFullRender();
    scheduleSave();
  }

  function buyLegacy(id) {
    const game = getGame();
    if (!game) return;
    const def = LEGACY_DEFS.find((item) => item.id === id);
    if (!def) return;

    const level = getLevel(game.legacy, id);
    if (level >= def.max) {
      toast("Legacy already maxed.");
      return;
    }

    const cost = getLegacyCost(def, level);
    if (game.resonance < cost) {
      toast("Not enough resonance.");
      return;
    }

    game.resonance -= cost;
    game.legacy[id] = level + 1;
    logEvent(game, `Legacy upgraded: ${def.name}.`);
    markFullRender();
    scheduleSave();
  }

  function startExpedition(id) {
    const game = getGame();
    if (!game) return;
    if (game.expedition) {
      toast("Expedition already running.");
      return;
    }

    const def = EXPEDITION_DEFS.find((item) => item.id === id);
    if (!def) return;

    if (!spendSignal(game, def.cost)) {
      toast("Not enough signal.");
      return;
    }

    const rates = state.cachedRates || calculateRates(game, Date.now());
    const duration = Math.floor(def.duration * rates.expeditionSpeed);
    const factionBonus = getFactionBonus(game);
    const uplink = 1 + getLevel(game.meta, "uplink") * 0.06;
    const rewardSignal = Math.floor(def.rewardSignal * uplink * (1 + getLevel(game.legacy, "echo") * 0.02));
    const rewardInsight = Math.floor(def.rewardInsight * uplink * (1 + getArchiveBonuses(game).insight));
    const successRate = clamp(def.success + factionBonus.expedition, 0.6, 0.95);

    game.expedition = {
      id: def.id,
      startedAt: Date.now(),
      endsAt: Date.now() + duration,
      rewardSignal,
      rewardInsight,
      success: successRate
    };

    logEvent(game, `${def.name} launched. ETA ${formatDuration(duration)}.`);
    markFullRender();
    scheduleSave();
  }

  function startQuickExpedition() {
    if (state.active?.game?.expedition) return;
    startExpedition(EXPEDITION_DEFS[0].id);
  }

  function updateExpedition(game, now, rates) {
    if (!game.expedition) return;
    if (now < game.expedition.endsAt) return;

    const expedition = game.expedition;
    const def = EXPEDITION_DEFS.find((item) => item.id === expedition.id);
    game.expedition = null;
    game.cycle.expeditions += 1;
    game.stats.expeditions += 1;

    const success = Math.random() <= expedition.success;
    if (success) {
      gainSignal(game, expedition.rewardSignal);
      gainInsight(game, expedition.rewardInsight);
      logEvent(game, `${def.name} succeeded. +${formatNumber(expedition.rewardSignal)} signal.`);
      maybeDiscoverRelic(game, rates);
      gainFactionRep(game, 8);
    } else {
      const salvage = Math.floor(expedition.rewardSignal * 0.25);
      gainSignal(game, salvage);
      logEvent(game, `${def.name} failed. Salvaged ${formatNumber(salvage)} signal.`);
      gainFactionRep(game, 3);
    }

    markFullRender();
    scheduleSave();
  }

  function ensureMissions(game) {
    if (!game.missions) game.missions = { tier: 1, list: [] };
    if (!Array.isArray(game.missions.list)) game.missions.list = [];
    if (game.missions.list.length === 0) {
      game.missions.list = generateMissions(game.missions.tier);
      scheduleSave();
    }
  }

  function claimMission(id) {
    const game = getGame();
    if (!game) return;
    ensureMissions(game);

    const mission = game.missions.list.find((item) => item.id === id);
    if (!mission) return;

    const template = getMissionTemplate(mission.templateId);
    const progress = template.progress(game);
    if (progress < mission.goal) {
      toast("Mission not complete yet.");
      return;
    }

    if (mission.claimed) return;

    const rates = state.cachedRates || calculateRates(game, Date.now());
    const reward = Math.floor(mission.reward * rates.missionMult);
    applyReward(game, { type: mission.rewardType, amount: reward });
    gainFactionRep(game, Math.floor(4 + game.missions.tier * 2));
    mission.claimed = true;
    logEvent(game, `Mission complete: ${template.label.replace("{goal}", formatNumber(mission.goal))}.`);

    if (game.missions.list.every((item) => item.claimed)) {
      game.missions.tier += 1;
      game.missions.list = generateMissions(game.missions.tier);
      logEvent(game, `Mission tier ${game.missions.tier} unlocked.`);
    }

    markFullRender();
    scheduleSave();
  }

  function selectFaction(id) {
    const game = getGame();
    if (!game) return;
    const def = getFactionById(id);
    if (!def) return;

    const now = Date.now();
    const remaining = getFactionCooldownRemaining(game);
    if (game.faction.id && remaining > 0) {
      toast(`Faction switch available in ${formatDuration(remaining)}.`);
      return;
    }

    if (game.faction.id === id) return;
    game.faction.id = id;
    game.faction.rep = 0;
    game.faction.selectedAt = now;
    logEvent(game, `Aligned with ${def.name}.`);
    markFullRender();
    scheduleSave();
  }

  function attemptAscend() {
    const game = getGame();
    if (!game) return;
    const rates = state.cachedRates || calculateRates(game, Date.now());
    const gain = getAscendGain(game, rates);

    if (gain <= 0) {
      toast("Not enough signal to ascend.");
      return;
    }

    const confirmed = window.confirm(
      `Ascend for +${formatNumber(gain)} resonance? This resets signal, insight, upgrades, research, missions, expeditions, and anomalies.`
    );
    if (!confirmed) return;

    game.resonance += gain;
    game.signal = 0;
    game.insight = 0;
    game.upgrades = {};
    game.research = {};
    game.cycle = createCycle();
    game.missions = { tier: 1, list: [] };
    game.aiEvent = null;
    game.aiCooldownAt = Date.now() + randRange(60000, 120000);
    game.buff = null;
    game.ads = { cooldownUntil: 0, boostEndsAt: 0 };
    game.anomaly = { label: "", mult: 1, endsAt: 0 };
    game.nextAnomalyAt = Date.now() + randRange(60000, 120000);
    game.expedition = null;
    game.stats.ascensions += 1;
    game.stats.lifetimeAscensions += 1;

    logEvent(game, `Ascended. +${formatNumber(gain)} resonance gained.`);
    markFullRender();
    scheduleSave();
  }

  function attemptTranscend() {
    const game = getGame();
    if (!game) return;
    const gain = getTranscendGain(game);

    if (gain <= 0) {
      toast("Not enough resonance to transcend.");
      return;
    }

    const confirmed = window.confirm(
      `Transcend for +${formatNumber(gain)} starlight? This resets resonance, legacy, upgrades, research, missions, expeditions, anomalies, relics, and ascension count.`
    );
    if (!confirmed) return;

    game.starlight += gain;
    game.signal = 0;
    game.insight = 0;
    game.resonance = 0;
    game.upgrades = {};
    game.research = {};
    game.legacy = {};
    game.missions = { tier: 1, list: [] };
    game.cycle = createCycle();
    game.aiEvent = null;
    game.aiCooldownAt = Date.now() + randRange(60000, 120000);
    game.buff = null;
    game.ads = { cooldownUntil: 0, boostEndsAt: 0 };
    game.anomaly = { label: "", mult: 1, endsAt: 0 };
    game.nextAnomalyAt = Date.now() + randRange(60000, 120000);
    game.expedition = null;
    game.archive = [];
    game.faction.rep = 0;
    game.offline = { lastGain: 0, lastSeconds: 0, lastAt: Date.now() };
    game.lastActiveAt = Date.now();
    game.stats.ascensions = 0;
    game.stats.transcends += 1;

    logEvent(game, `Transcended. +${formatNumber(gain)} starlight gained.`);
    markFullRender();
    scheduleSave();
  }

  function createProfile(name) {
    return {
      id: `profile_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: name || "Pilot",
      prefs: defaultPrefs(),
      game: createNewGame()
    };
  }

  function defaultPrefs() {
    return {
      defaultTab: "game",
      compact: false,
      adsEnabled: true,
      gameSection: "command"
    };
  }

  function normalizeProfile(profile) {
    profile.prefs = profile.prefs || defaultPrefs();
    applyDefaults(profile.prefs, defaultPrefs());
    profile.game = normalizeGame(profile.game);
  }

  function createNewGame() {
    const now = Date.now();
    return {
      version: 2,
      signal: 0,
      insight: 0,
      resonance: 0,
      starlight: 0,
      upgrades: {},
      research: {},
      legacy: {},
      meta: {},
      faction: { id: "", rep: 0, selectedAt: 0 },
      cycle: createCycle(),
      missions: { tier: 1, list: [] },
      aiEvent: null,
      aiCooldownAt: now + randRange(60000, 120000),
      buff: null,
      ads: { cooldownUntil: 0, boostEndsAt: 0 },
      daily: { date: "", id: "", label: "", signal: 1, click: 1, insight: 1, mission: 1 },
      anomaly: { label: "", mult: 1, endsAt: 0 },
      nextAnomalyAt: now + randRange(60000, 120000),
      expedition: null,
      mapSeed: randomSeed(),
      archive: [],
      story: { unlocked: [] },
      offline: { lastGain: 0, lastSeconds: 0, lastAt: 0 },
      lastActiveAt: now,
      achievements: {},
      log: [],
      stats: {
        totalEarned: 0,
        totalSpent: 0,
        totalInsight: 0,
        totalClicks: 0,
        expeditions: 0,
        anomalies: 0,
        ascensions: 0,
        lifetimeAscensions: 0,
        transcends: 0,
        totalOffline: 0,
        totalUpgrades: 0
      }
    };
  }

  function normalizeGame(game) {
    if (!game || typeof game !== "object") return createNewGame();
    const defaults = createNewGame();
    applyDefaults(game, defaults);
    if (!game.faction || typeof game.faction !== "object") game.faction = { id: "", rep: 0, selectedAt: 0 };
    if (typeof game.faction.rep !== "number") game.faction.rep = 0;
    if (typeof game.faction.selectedAt !== "number") game.faction.selectedAt = 0;
    if (!Array.isArray(game.story.unlocked)) game.story.unlocked = [];
    return game;
  }

  function createCycle() {
    return {
      earned: 0,
      spent: 0,
      insight: 0,
      clicks: 0,
      expeditions: 0,
      upgrades: 0
    };
  }

  function applyDefaults(target, defaults) {
    Object.keys(defaults).forEach((key) => {
      const value = defaults[key];
      if (target[key] === undefined || target[key] === null) {
        target[key] = cloneValue(value);
        return;
      }

      if (isPlainObject(value)) {
        if (!isPlainObject(target[key])) target[key] = {};
        applyDefaults(target[key], value);
      }
    });
  }

  function cloneValue(value) {
    if (Array.isArray(value)) return value.slice();
    if (isPlainObject(value)) return { ...value };
    return value;
  }

  function isPlainObject(value) {
    return value && typeof value === "object" && !Array.isArray(value);
  }

  function renderStats(game, rates, now) {
    setText(ui.statSignal, formatNumber(game.signal));
    setText(ui.statPerSec, formatNumber(rates.perSec));
    setText(ui.statInsight, formatNumber(game.insight));
    setText(ui.statResonance, formatNumber(game.resonance));
    setText(ui.statClick, formatNumber(rates.clickPower));
    setText(ui.statForecast, formatNumber(game.signal + rates.perSec * 60));

    setText(ui.dailyStatus, game.daily.label ? `Daily: ${game.daily.label}` : "Daily directive pending.");

    if (game.anomaly.endsAt && now < game.anomaly.endsAt) {
      setText(ui.anomalyStatus, `${game.anomaly.label} (${formatDuration(game.anomaly.endsAt - now)})`);
    } else {
      setText(ui.anomalyStatus, `Next anomaly in ${formatDuration(Math.max(0, game.nextAnomalyAt - now))}.`);
    }

    if (game.buff && now < game.buff.endsAt) {
      setText(ui.buffStatus, `${game.buff.label} (${formatDuration(game.buff.endsAt - now)})`);
    } else {
      setText(ui.buffStatus, "No active AI buffs.");
    }

    if (game.ads.boostEndsAt && now < game.ads.boostEndsAt) {
      setText(ui.adStatus, `Sponsor boost active (${formatDuration(game.ads.boostEndsAt - now)}).`);
    } else if (game.ads.cooldownUntil && now < game.ads.cooldownUntil) {
      setText(ui.adStatus, `Sponsor cooldown ${formatDuration(game.ads.cooldownUntil - now)}.`);
    } else {
      setText(ui.adStatus, "Sponsor relay ready.");
    }

    const offlineCap = getOfflineCap(game);
    const offlineMult = getOfflineMultiplier(game);
    if (game.offline.lastGain > 0 && game.offline.lastSeconds > 0) {
      setText(
        ui.offlineStatus,
        `Offline recovery: +${formatNumber(game.offline.lastGain)} signal in ${formatDuration(game.offline.lastSeconds * 1000)}.`
      );
    } else {
      setText(ui.offlineStatus, `Offline cap ${formatDuration(offlineCap * 1000)} at ${Math.round(offlineMult * 100)}% rate.`);
    }
  }

  function renderUpgrades(game) {
    const html = UPGRADE_DEFS.map((def) => {
      const level = getLevel(game.upgrades, def.id);
      const cost = getUpgradeCost(def, level);
      const disabled = game.signal < cost;
      return `
        <div class="upgradeRow">
          <div class="rowDetails">
            <div class="rowTitle">${def.name} <span class="tag">Lv ${level}</span></div>
            <div class="rowMeta">${def.desc} (+${formatNumber(def.perSec)} /s)</div>
          </div>
          <button class="btn" data-upgrade="${def.id}" ${disabled ? "disabled" : ""}>Buy ${formatNumber(cost)}</button>
        </div>
      `;
    }).join("");

    setHtml(ui.upgradeList, html);
  }

  function renderResearch(game) {
    const html = RESEARCH_DEFS.map((def) => {
      const level = getLevel(game.research, def.id);
      const cost = getResearchCost(def, level);
      const disabled = level >= def.max || game.insight < cost;
      return `
        <div class="researchRow">
          <div class="rowDetails">
            <div class="rowTitle">${def.name} <span class="tag">Lv ${level}/${def.max}</span></div>
            <div class="rowMeta">${def.desc}</div>
          </div>
          <button class="btn" data-research="${def.id}" ${disabled ? "disabled" : ""}>Spend ${formatNumber(cost)}</button>
        </div>
      `;
    }).join("");

    setHtml(ui.researchList, html);
  }

  function renderMeta(game) {
    if (!ui.metaList || !ui.metaStatus) return;
    const threshold = getTranscendThreshold(game);
    const gain = getTranscendGain(game);
    setText(ui.metaStatus, `Starlight ${formatNumber(game.starlight)} | Transcend at ${formatNumber(threshold)} resonance for +${formatNumber(gain)}.`);
    if (ui.transcendBtn) ui.transcendBtn.disabled = gain <= 0;

    const html = META_DEFS.map((def) => {
      const level = getLevel(game.meta, def.id);
      const cost = getMetaCost(def, level);
      const disabled = level >= def.max || game.starlight < cost;
      return `
        <div class="metaRow">
          <div class="rowDetails">
            <div class="rowTitle">${def.name} <span class="tag">Lv ${level}/${def.max}</span></div>
            <div class="rowMeta">${def.desc}</div>
          </div>
          <button class="btn" data-meta="${def.id}" ${disabled ? "disabled" : ""}>Invest ${formatNumber(cost)}</button>
        </div>
      `;
    }).join("");

    setHtml(ui.metaList, html);
  }

  function renderFactions(game) {
    if (!ui.factionList || !ui.factionStatus) return;
    const factionDef = getFactionById(game.faction.id);
    const rank = getFactionRank(game.faction.rep);
    const nextRank = getNextFactionRank(game.faction.rep);
    const remaining = getFactionCooldownRemaining(game);

    if (factionDef) {
      const nextLabel = nextRank ? ` | Next ${nextRank.name} at ${nextRank.threshold} rep` : "";
      setText(ui.factionStatus, `Aligned with ${factionDef.name} (${rank.name}) | Rep ${game.faction.rep}${nextLabel}`);
    } else {
      setText(ui.factionStatus, "No faction selected.");
    }

    const html = FACTION_DEFS.map((def) => {
      const active = def.id === game.faction.id;
      const canSwitch = !active && remaining <= 0;
      const bonusText = formatFactionBonuses(def, active ? rank.mult : 1);
      const statusTag = active ? ` <span class="tag">${rank.name}</span>` : "";
      const buttonLabel = active ? "Active" : canSwitch ? "Enlist" : `Cooldown ${formatDuration(remaining)}`;
      return `
        <div class="factionRow ${active ? "active" : ""}">
          <div class="rowDetails">
            <div class="rowTitle">${def.name}${statusTag}</div>
            <div class="rowMeta">${def.desc} ${bonusText}</div>
          </div>
          <button class="btn" data-faction="${def.id}" ${active || !canSwitch ? "disabled" : ""}>${buttonLabel}</button>
        </div>
      `;
    }).join("");

    setHtml(ui.factionList, html);
  }

  function renderStory(game) {
    if (!ui.storyList || !ui.storyStatus) return;
    const unlocked = Array.isArray(game.story.unlocked) ? game.story.unlocked : [];
    setText(ui.storyStatus, `Unlocked ${unlocked.length} / ${STORY_ENTRIES.length} transmissions.`);

    const html = STORY_ENTRIES
      .filter((entry) => unlocked.includes(entry.id))
      .map(
        (entry) => `
        <div class="storyRow">
          <div class="rowDetails">
            <div class="rowTitle">${entry.title}</div>
            <div class="rowMeta">${escapeHtml(entry.body)}</div>
          </div>
        </div>
      `
      )
      .join("");

    setHtml(ui.storyList, html || "<div class=\"status\">No transmissions recovered yet.</div>");
  }

  function renderLegacy(game, rates) {
    const threshold = getAscendThreshold(game);
    const gain = getAscendGain(game, rates);
    setText(ui.legacyStatus, `Resonance ${formatNumber(game.resonance)} | Ascend at ${formatNumber(threshold)} for +${formatNumber(gain)}.`);

    const html = LEGACY_DEFS.map((def) => {
      const level = getLevel(game.legacy, def.id);
      const cost = getLegacyCost(def, level);
      const disabled = level >= def.max || game.resonance < cost;
      return `
        <div class="legacyRow">
          <div class="rowDetails">
            <div class="rowTitle">${def.name} <span class="tag">Lv ${level}/${def.max}</span></div>
            <div class="rowMeta">${def.desc}</div>
          </div>
          <button class="btn" data-legacy="${def.id}" ${disabled ? "disabled" : ""}>Invest ${formatNumber(cost)}</button>
        </div>
      `;
    }).join("");

    setHtml(ui.legacyList, html);
  }

  function renderExpeditions(game, rates, now) {
    if (game.expedition) {
      const def = EXPEDITION_DEFS.find((item) => item.id === game.expedition.id);
      const remaining = Math.max(0, game.expedition.endsAt - now);
      setText(ui.expeditionStatus, `Active: ${def.name} (${formatDuration(remaining)}).`);
    } else {
      setText(ui.expeditionStatus, "No active expedition.");
    }

    const html = EXPEDITION_DEFS.map((def) => {
      const disabled = !!game.expedition || game.signal < def.cost;
      const duration = Math.floor(def.duration * rates.expeditionSpeed);
      return `
        <div class="expeditionRow">
          <div class="rowDetails">
            <div class="rowTitle">${def.name}</div>
            <div class="rowMeta">${def.desc} | ETA ${formatDuration(duration)}</div>
          </div>
          <button class="btn" data-expedition="${def.id}" ${disabled ? "disabled" : ""}>Launch ${formatNumber(def.cost)}</button>
        </div>
      `;
    }).join("");

    setHtml(ui.expeditionList, html);
  }

  function renderMissions(game, rates) {
    ensureMissions(game);
    setText(ui.missionStatus, `Tier ${game.missions.tier} | Rewards x${rates.missionMult.toFixed(2)}.`);

    const html = game.missions.list
      .map((mission) => {
        const template = getMissionTemplate(mission.templateId);
        const progress = template.progress(game);
        const done = progress >= mission.goal;
        const reward = Math.floor(mission.reward * rates.missionMult);
        const label = template.label.replace("{goal}", formatNumber(mission.goal));
        const statusLabel = mission.claimed ? "Claimed" : done ? "Claim" : "In progress";
        const btnClass = done && !mission.claimed ? "btn primary" : "btn";
        const disabled = mission.claimed || !done;
        return `
          <div class="missionRow ${mission.claimed ? "done" : ""}">
            <div class="rowDetails">
              <div class="rowTitle">${label}</div>
              <div class="rowMeta">Progress ${formatNumber(progress)} / ${formatNumber(mission.goal)} | Reward ${formatNumber(reward)} ${mission.rewardType}</div>
            </div>
            <button class="${btnClass}" data-mission="${mission.id}" ${disabled ? "disabled" : ""}>${statusLabel}</button>
          </div>
        `;
      })
      .join("");

    setHtml(ui.missionList, html);
  }

  function renderAiEvent(game, now) {
    if (game.aiEvent) {
      const remaining = Math.max(0, game.aiEvent.expiresAt - now);
      setText(ui.aiStatus, `Directive active (${formatDuration(remaining)}).`);

      const options = game.aiEvent.options
        .map(
          (opt) => `
          <div class="aiOption">
            <div class="rowDetails">
              <div class="rowTitle">${opt.label}</div>
              <div class="rowMeta">${opt.summary}</div>
            </div>
            <button class="btn" data-ai-option="${opt.id}">Execute</button>
          </div>
        `
        )
        .join("");

      const html = `
        <div class="aiEventCard">
          <div class="aiEventTitle">${game.aiEvent.title}</div>
          <div class="aiEventBody">${game.aiEvent.body}</div>
        </div>
        <div class="list">${options}</div>
      `;
      setHtml(ui.aiEvent, html);
    } else {
      const next = Math.max(0, game.aiCooldownAt - now);
      setText(ui.aiStatus, `Next directive in ${formatDuration(next)}.`);
      setHtml(ui.aiEvent, "<div class=\"status\">No active directives.</div>");
    }
  }

  function renderArchive(game) {
    const bonuses = getArchiveBonuses(game);
    const signalBonus = (bonuses.signal * 100).toFixed(1);
    const clickBonus = (bonuses.click * 100).toFixed(1);
    const insightBonus = (bonuses.insight * 100).toFixed(1);
    setText(ui.archiveStatus, `Relics ${game.archive.length} | Signal +${signalBonus}% | Click +${clickBonus}% | Insight +${insightBonus}%`);

    const html = game.archive
      .map(
        (relic) => `
        <div class="archiveRow">
          <div class="rowDetails">
            <div class="rowTitle">${relic.name}</div>
            <div class="rowMeta">${relic.type} +${(relic.bonus * 100).toFixed(1)}%</div>
          </div>
        </div>
      `
      )
      .join("");

    setHtml(ui.archiveList, html || "<div class=\"status\">No relics discovered.</div>");
  }

  function renderAchievements(game) {
    const html = ACHIEVEMENTS.map((ach) => {
      const unlocked = !!game.achievements[ach.id];
      return `
        <div class="achievementRow ${unlocked ? "unlocked" : ""}">
          <div class="rowDetails">
            <div class="rowTitle">${ach.name}</div>
            <div class="rowMeta">${ach.desc}</div>
          </div>
          <span class="tag">${unlocked ? "Unlocked" : "Locked"}</span>
        </div>
      `;
    }).join("");

    setHtml(ui.achievementList, html);
  }

  function renderLog(game) {
    const entries = game.log.slice(-12).reverse();
    const html = entries
      .map(
        (entry) => `
        <div class="logRow">
          <div class="rowDetails">
            <div class="rowTitle">${escapeHtml(entry.text)}</div>
            <div class="rowMeta">${new Date(entry.time).toLocaleTimeString()}</div>
          </div>
        </div>
      `
      )
      .join("");

    setHtml(ui.logList, html || "<div class=\"status\">No activity yet.</div>");
  }

  function renderAccountSummary(game, rates) {
    if (!state.active || !ui.accountSummary) return;
    const text = `Active ${state.active.name} | Ascensions ${game.stats.lifetimeAscensions} | Transcends ${game.stats.transcends} | Total signal ${formatNumber(game.stats.totalEarned)} | Per sec ${formatNumber(rates.perSec)}`;
    setText(ui.accountSummary, text);
  }

  function renderAdRelay(game, now) {
    if (!ui.adRelayStatus || !ui.adBoostBtn) return;
    const enabled = state.active?.prefs.adsEnabled !== false;
    const cooldown = getAdCooldownMs(game);

    if (!enabled) {
      setText(ui.adRelayStatus, "Sponsor clips disabled in preferences.");
      ui.adBoostBtn.disabled = true;
      return;
    }

    if (game.ads.boostEndsAt && now < game.ads.boostEndsAt) {
      setText(ui.adRelayStatus, `Boost active (${formatDuration(game.ads.boostEndsAt - now)}).`);
      ui.adBoostBtn.disabled = true;
      return;
    }

    if (game.ads.cooldownUntil && now < game.ads.cooldownUntil) {
      setText(ui.adRelayStatus, `Cooldown ${formatDuration(game.ads.cooldownUntil - now)}.`);
      ui.adBoostBtn.disabled = true;
      return;
    }

    setText(ui.adRelayStatus, `Boost ready. Cooldown ${formatDuration(cooldown)}.`);
    ui.adBoostBtn.disabled = false;
  }

  function checkStoryUnlocks(game, rates) {
    if (!game.story) game.story = { unlocked: [] };
    if (!Array.isArray(game.story.unlocked)) game.story.unlocked = [];

    STORY_ENTRIES.forEach((entry) => {
      if (game.story.unlocked.includes(entry.id)) return;
      if (entry.condition(game, rates)) {
        game.story.unlocked.push(entry.id);
        logEvent(game, `Transmission recovered: ${entry.title}.`);
        markFullRender();
      }
    });
  }

  function applyOfflineProgress(game) {
    if (!game) return;
    const now = Date.now();
    const lastAt = game.lastActiveAt || now;
    const elapsedSeconds = Math.max(0, (now - lastAt) / 1000);
    const capSeconds = getOfflineCap(game);
    const seconds = Math.min(elapsedSeconds, capSeconds);
    if (seconds < 30) {
      game.offline.lastGain = 0;
      game.offline.lastSeconds = 0;
      game.lastActiveAt = now;
      return;
    }

    const rates = calculateRates(game, now);
    const mult = getOfflineMultiplier(game);
    const gain = Math.floor(rates.perSec * seconds * mult);
    if (gain > 0) {
      gainSignal(game, gain);
      game.stats.totalOffline += gain;
      game.offline = { lastGain: gain, lastSeconds: seconds, lastAt: now };
      logEvent(game, `Offline recovery: +${formatNumber(gain)} signal in ${formatDuration(seconds * 1000)}.`);
    }
    game.lastActiveAt = now;
    markFullRender();
  }

  function checkAchievements(game, rates) {
    ACHIEVEMENTS.forEach((ach) => {
      if (game.achievements[ach.id]) return;
      if (ach.test(game, rates)) {
        game.achievements[ach.id] = true;
        applyReward(game, ach.reward);
        logEvent(game, `Achievement unlocked: ${ach.name}.`);
        scheduleSave();
      }
    });
  }

  function updateAnomaly(game, now) {
    if (game.anomaly.endsAt && now >= game.anomaly.endsAt) {
      logEvent(game, `Anomaly ended: ${game.anomaly.label}.`);
      game.anomaly = { label: "", mult: 1, endsAt: 0 };
      game.nextAnomalyAt = now + randRange(60000, 120000);
    }

    if (!game.anomaly.endsAt && now >= game.nextAnomalyAt) {
      const surge = Math.random() < 0.5;
      const baseDuration = randRange(45000, 90000);
      const dampers = getLevel(game.legacy, "dampers");
      const duration = Math.max(30000, Math.floor(baseDuration * (1 - dampers * 0.08)));

      game.anomaly = {
        label: surge ? "Anomaly Surge" : "Signal Drag",
        mult: surge ? 1.25 : 0.8,
        endsAt: now + duration
      };
      game.nextAnomalyAt = now + duration + randRange(60000, 120000);
      game.stats.anomalies += 1;
      logEvent(game, `${game.anomaly.label} active for ${formatDuration(duration)}.`);
    }
  }

  function updateAiEvent(game, now) {
    if (game.aiEvent && now >= game.aiEvent.expiresAt) {
      logEvent(game, "Director directive expired.");
      game.aiEvent = null;
      game.aiCooldownAt = now + randRange(90000, 150000);
    }

    if (!game.aiEvent && now >= game.aiCooldownAt) {
      game.aiEvent = createAiEvent();
      logEvent(game, `Director directive: ${game.aiEvent.title}.`);
    }
  }

  function updateBuff(game, now) {
    if (game.buff && now >= game.buff.endsAt) {
      logEvent(game, `${game.buff.label} expired.`);
      game.buff = null;
    }

    if (game.ads.boostEndsAt && now >= game.ads.boostEndsAt) {
      game.ads.boostEndsAt = 0;
    }
  }

  function createAiEvent() {
    const template = pick(AI_EVENT_LIBRARY);
    return {
      id: template.id,
      title: template.title,
      body: template.body,
      options: template.options.map((opt) => ({ id: opt.id, label: opt.label, summary: opt.summary })),
      createdAt: Date.now(),
      expiresAt: Date.now() + 120000
    };
  }

  function resolveAiOption(optionId) {
    const game = getGame();
    if (!game || !game.aiEvent) return;
    const template = AI_EVENT_LIBRARY.find((item) => item.id === game.aiEvent.id);
    if (!template) return;
    const option = template.options.find((opt) => opt.id === optionId);
    if (!option) return;

    option.apply(game);
    logEvent(game, `${game.aiEvent.title}: ${option.label}.`);
    game.aiEvent = null;
    game.aiCooldownAt = Date.now() + randRange(90000, 150000);
    scheduleSave();
  }

  function generateMissions(tier) {
    const pool = shuffle(MISSION_TEMPLATES.slice());
    return pool.slice(0, 3).map((template) => {
      const goal = template.goal(tier);
      const reward = Math.floor(goal * template.rewardScale);
      return {
        id: `${template.id}_${tier}_${Math.floor(Math.random() * 10000)}`,
        templateId: template.id,
        goal,
        reward,
        rewardType: template.rewardType,
        claimed: false
      };
    });
  }

  function getMissionTemplate(id) {
    return MISSION_TEMPLATES.find((template) => template.id === id);
  }

  function calculateRates(game, now) {
    const upgradeTotals = UPGRADE_DEFS.reduce(
      (acc, def) => {
        const level = getLevel(game.upgrades, def.id);
        acc.perSec += level * def.perSec;
        acc.click += level * def.click;
        return acc;
      },
      { perSec: 0, click: 0 }
    );

    const compression = getLevel(game.research, "compression");
    const distill = getLevel(game.research, "distill");
    const feedback = getLevel(game.research, "feedback");
    const logistics = getLevel(game.research, "logistics");
    const catalyst = getLevel(game.research, "catalyst");
    const analytics = getLevel(game.research, "analytics");

    const echo = getLevel(game.legacy, "echo");
    const insightLegacy = getLevel(game.legacy, "insight");
    const shadow = getLevel(game.legacy, "shadow");
    const atlas = getLevel(game.meta, "atlas");

    const archiveBonus = getArchiveBonuses(game);
    const daily = getDailyBonus(game);
    const anomalyMult = getAnomalyMultiplier(game, now);
    const buff = getBuffBonus(game, now);
    const adMult = now < game.ads.boostEndsAt ? AD_MULT : 1;
    const factionBonus = getFactionBonus(game);

    const signalMult =
      (1 + compression * 0.08) *
      (1 + echo * 0.05) *
      (1 + atlas * 0.07) *
      (1 + archiveBonus.signal) *
      (1 + factionBonus.signal) *
      daily.signal *
      anomalyMult *
      buff.signal *
      adMult;
    const clickMult = (1 + archiveBonus.click) * daily.click * buff.click;
    const insightMult =
      (1 + distill * 0.1) * (1 + insightLegacy * 0.06) * (1 + archiveBonus.insight) * (1 + factionBonus.insight) * daily.insight;
    const missionMult = (1 + analytics * 0.1) * (1 + shadow * 0.02) * (1 + factionBonus.mission) * daily.mission;
    const resonanceMult = 1 + feedback * 0.04;
    const expeditionSpeed = Math.max(0.5, 1 - logistics * 0.08);
    const relicChance = clamp(0.08 + catalyst * 0.06 + factionBonus.relic, 0, 0.6);

    return {
      perSec: upgradeTotals.perSec * signalMult,
      clickPower: (1 + upgradeTotals.click) * clickMult,
      insightMult,
      missionMult,
      resonanceMult,
      expeditionSpeed,
      relicChance,
      signalMult,
      adMult
    };
  }

  function applyDaily(game) {
    const today = getDateKey();
    if (game.daily.date === today) return;
    const daily = pick(DAILY_EFFECTS);
    game.daily = {
      date: today,
      id: daily.id,
      label: daily.label,
      signal: daily.signal,
      click: daily.click,
      insight: daily.insight,
      mission: daily.mission
    };
    logEvent(game, `Daily directive: ${daily.label}.`);
    scheduleSave();
  }

  function getDailyBonus(game) {
    if (!game.daily) return { signal: 1, click: 1, insight: 1, mission: 1 };
    return {
      signal: game.daily.signal || 1,
      click: game.daily.click || 1,
      insight: game.daily.insight || 1,
      mission: game.daily.mission || 1
    };
  }

  function getAnomalyMultiplier(game, now) {
    if (game.anomaly && game.anomaly.endsAt && now < game.anomaly.endsAt) return game.anomaly.mult || 1;
    return 1;
  }

  function applyBuff(game, label, duration, signalMult, clickMult) {
    game.buff = {
      label,
      mult: signalMult,
      click: clickMult,
      endsAt: Date.now() + duration
    };
  }

  function getBuffBonus(game, now) {
    if (game.buff && now < game.buff.endsAt) {
      return {
        signal: game.buff.mult || 1,
        click: game.buff.click || 1
      };
    }
    return { signal: 1, click: 1 };
  }

  function maybeDiscoverRelic(game, rates) {
    if (Math.random() > rates.relicChance) return;
    const relic = createRelic();
    game.archive.push(relic);
    logEvent(game, `Relic recovered: ${relic.name}.`);
    markFullRender();
  }

  function createRelic() {
    const base = pick(RELIC_DEFS);
    return {
      id: `relic_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: base.name,
      type: base.type,
      bonus: base.bonus,
      acquiredAt: Date.now()
    };
  }

  function getArchiveBonuses(game) {
    return game.archive.reduce(
      (acc, relic) => {
        if (acc[relic.type] !== undefined) acc[relic.type] += relic.bonus;
        return acc;
      },
      { signal: 0, click: 0, insight: 0 }
    );
  }

  function applyReward(game, reward) {
    if (!reward) return;
    if (reward.type === "signal") gainSignal(game, reward.amount);
    if (reward.type === "insight") gainInsight(game, reward.amount);
    if (reward.type === "resonance") game.resonance += reward.amount;
    if (reward.type === "starlight") game.starlight += reward.amount;
  }

  function gainSignal(game, amount) {
    if (!amount || amount <= 0) return;
    game.signal += amount;
    game.stats.totalEarned += amount;
    game.cycle.earned += amount;
  }

  function gainInsight(game, amount) {
    if (!amount || amount <= 0) return;
    game.insight += amount;
    game.stats.totalInsight += amount;
    game.cycle.insight += amount;
  }

  function spendSignal(game, amount) {
    if (amount <= 0) return false;
    if (game.signal < amount) return false;
    game.signal -= amount;
    game.stats.totalSpent += amount;
    game.cycle.spent += amount;
    return true;
  }

  function getAdCooldownMs(game) {
    const sponsor = getLevel(game.legacy, "sponsor");
    const mult = Math.max(0.5, 1 - sponsor * 0.05);
    return Math.floor(AD_COOLDOWN_MS * mult);
  }

  function getOfflineCap(game) {
    const stasis = getLevel(game.meta, "stasis");
    const factionBonus = getFactionBonus(game);
    return Math.floor(OFFLINE_BASE_CAP * (1 + stasis * 0.25 + factionBonus.offline));
  }

  function getOfflineMultiplier(game) {
    const factionBonus = getFactionBonus(game);
    return OFFLINE_BASE_MULT * (1 + factionBonus.offline * 0.5);
  }

  function getAscendThreshold(game) {
    const base = 60000;
    const scale = Math.pow(1.28, game.stats.ascensions);
    return Math.floor(base * scale);
  }

  function getTranscendThreshold(game) {
    const base = 120;
    const scale = Math.pow(1.5, game.stats.transcends);
    return Math.floor(base * scale);
  }

  function getAscendGain(game, rates) {
    const threshold = getAscendThreshold(game);
    if (game.signal < threshold) return 0;
    const ratio = game.signal / threshold;
    const gain = Math.floor(Math.pow(ratio, 0.85) * 10 * rates.resonanceMult);
    return Math.max(1, gain);
  }

  function getTranscendGain(game) {
    const threshold = getTranscendThreshold(game);
    if (game.resonance < threshold) return 0;
    const ratio = game.resonance / threshold;
    const gain = Math.floor(Math.pow(ratio, 0.9) * 3);
    return Math.max(1, gain);
  }

  function getUpgradeCost(def, level) {
    return Math.floor(def.baseCost * Math.pow(def.growth, level));
  }

  function getResearchCost(def, level) {
    return Math.floor(def.baseCost * Math.pow(def.growth, level));
  }

  function getLegacyCost(def, level) {
    return Math.floor(def.baseCost * Math.pow(def.growth, level));
  }

  function getMetaCost(def, level) {
    return Math.floor(def.baseCost * Math.pow(def.growth, level));
  }

  function getLevel(map, id) {
    return map[id] || 0;
  }

  function getFactionById(id) {
    return FACTION_DEFS.find((faction) => faction.id === id);
  }

  function getFactionRank(rep) {
    let current = FACTION_RANKS[0];
    for (let i = 0; i < FACTION_RANKS.length; i += 1) {
      const rank = FACTION_RANKS[i];
      if (rep >= rank.threshold) current = rank;
    }
    return current;
  }

  function getNextFactionRank(rep) {
    for (let i = 0; i < FACTION_RANKS.length; i += 1) {
      const rank = FACTION_RANKS[i];
      if (rep < rank.threshold) return rank;
    }
    return null;
  }

  function getFactionCooldownRemaining(game) {
    if (!game?.faction?.id) return 0;
    const readyAt = (game.faction.selectedAt || 0) + FACTION_SWITCH_COOLDOWN;
    return Math.max(0, readyAt - Date.now());
  }

  function getFactionBonus(game) {
    const def = getFactionById(game.faction.id);
    if (!def) {
      return { signal: 0, mission: 0, insight: 0, relic: 0, expedition: 0, offline: 0 };
    }
    const rank = getFactionRank(game.faction.rep);
    const mult = rank.mult;
    return {
      signal: (def.bonus.signal || 0) * mult,
      mission: (def.bonus.mission || 0) * mult,
      insight: (def.bonus.insight || 0) * mult,
      relic: (def.bonus.relic || 0) * mult,
      expedition: (def.bonus.expedition || 0) * mult,
      offline: (def.bonus.offline || 0) * mult
    };
  }

  function formatFactionBonuses(def, mult) {
    const parts = [];
    if (def.bonus.signal) parts.push(`Signal +${Math.round(def.bonus.signal * mult * 100)}%`);
    if (def.bonus.mission) parts.push(`Mission +${Math.round(def.bonus.mission * mult * 100)}%`);
    if (def.bonus.insight) parts.push(`Insight +${Math.round(def.bonus.insight * mult * 100)}%`);
    if (def.bonus.relic) parts.push(`Relic +${Math.round(def.bonus.relic * mult * 100)}%`);
    if (def.bonus.expedition) parts.push(`Expedition +${Math.round(def.bonus.expedition * mult * 100)}%`);
    if (def.bonus.offline) parts.push(`Offline +${Math.round(def.bonus.offline * mult * 100)}%`);
    return parts.length ? `| ${parts.join(", ")}` : "";
  }

  function gainFactionRep(game, baseAmount) {
    if (!game.faction.id) return;
    const before = getFactionRank(game.faction.rep);
    const covenant = getLevel(game.meta, "covenant");
    const amount = Math.max(1, Math.floor(baseAmount * (1 + covenant * 0.1)));
    game.faction.rep += amount;
    const after = getFactionRank(game.faction.rep);
    if (after.name !== before.name) {
      logEvent(game, `Faction rank up: ${after.name}.`);
    }
    markFullRender();
  }

  function getGame() {
    return state.active ? state.active.game : null;
  }

  function drawMapIfNeeded() {
    const game = getGame();
    if (!game || !ui.signalMap) return;
    if (state.lastMapSeed === game.mapSeed) return;

    const canvas = ui.signalMap;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const rand = makeSeededRandom(game.mapSeed);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(5, 10, 16, 0.8)";
    ctx.fillRect(0, 0, width, height);

    const stars = [];
    const count = 42;
    for (let i = 0; i < count; i += 1) {
      stars.push({
        x: rand() * width,
        y: rand() * height,
        r: 1 + rand() * 2.5
      });
    }

    ctx.strokeStyle = "rgba(34, 211, 238, 0.25)";
    ctx.lineWidth = 1;
    for (let i = 0; i < stars.length - 1; i += 3) {
      const a = stars[i];
      const b = stars[i + 1];
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    stars.forEach((star) => {
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    });

    state.lastMapSeed = game.mapSeed;
  }

  function openAdModal() {
    if (!ui.adModal || !ui.adCountdown) return;
    ui.adModal.classList.remove("hidden");
    state.adEndsAt = Date.now() + AD_DURATION_MS;
    setText(ui.adCountdown, `Relay sync ${formatDuration(AD_DURATION_MS)}`);
    updateAdCountdown();
    if (state.adTimer) clearInterval(state.adTimer);
    if (state.adTimeout) clearTimeout(state.adTimeout);
    state.adTimer = setInterval(updateAdCountdown, 200);
    state.adTimeout = setTimeout(() => finishAdRelay(), AD_DURATION_MS + 250);
  }

  function closeAdModal() {
    if (state.adTimer) {
      clearInterval(state.adTimer);
      state.adTimer = null;
    }
    if (state.adTimeout) {
      clearTimeout(state.adTimeout);
      state.adTimeout = null;
    }
    if (ui.adModal) ui.adModal.classList.add("hidden");
  }

  function updateAdCountdown() {
    const remaining = state.adEndsAt - Date.now();
    if (remaining <= 0) {
      finishAdRelay();
      return;
    }
    setText(ui.adCountdown, `Relay sync ${formatDuration(remaining)}`);
  }

  function finishAdRelay() {
    closeAdModal();
    applyAdBoost();
  }

  function applyAdBoost() {
    const game = getGame();
    if (!game) return;
    const now = Date.now();
    const cooldown = getAdCooldownMs(game);
    game.ads.boostEndsAt = now + AD_BOOST_MS;
    game.ads.cooldownUntil = now + cooldown;
    logEvent(game, "Sponsor boost active.");
    markFullRender();
    scheduleSave();
  }

  function logEvent(game, text) {
    game.log.push({ time: Date.now(), text });
    if (game.log.length > 50) game.log.shift();
    markFullRender();
  }

  function toast(message) {
    if (!ui.toast) return;
    ui.toast.textContent = message;
    ui.toast.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      ui.toast.classList.remove("show");
    }, 2000);
  }

  function formatNumber(value) {
    if (!Number.isFinite(value)) return "0";
    const sign = value < 0 ? "-" : "";
    let num = Math.abs(value);

    if (num < 1000) {
      const digits = num < 10 ? 2 : num < 100 ? 1 : 0;
      return sign + num.toFixed(digits);
    }

    const units = ["K", "M", "B", "T"];
    let unitIndex = -1;
    while (num >= 1000 && unitIndex < units.length - 1) {
      num /= 1000;
      unitIndex += 1;
    }
    const digits = num < 10 ? 2 : num < 100 ? 1 : 0;
    return sign + num.toFixed(digits) + units[unitIndex];
  }

  function formatDuration(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    if (minutes <= 0) return `${seconds}s`;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  function randRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  function randomSeed() {
    return Math.floor(Math.random() * 1000000000);
  }

  function makeSeededRandom(seed) {
    let t = seed >>> 0;
    return () => {
      t = (t * 1664525 + 1013904223) >>> 0;
      return t / 4294967296;
    };
  }

  function getDateKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function setText(element, text) {
    if (!element) return;
    const value = String(text);
    if (element.textContent !== value) element.textContent = value;
  }

  function setHtml(element, html) {
    if (!element) return;
    if (element.innerHTML !== html) element.innerHTML = html;
  }

  function escapeHtml(value) {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return String(value).replace(/[&<>"']/g, (char) => map[char]);
  }
})();
