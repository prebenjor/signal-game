
/**
 * Core app shell and game loop.
 * - State lives in a single reducer; see initialState and reducer cases.
 * - Auto-saves via persistState() to localStorage + cookie (key: signalFrontierReact), with export/import in Account tab.
 * - Tick loop applies production, resolves missions/events, and keeps UI in sync.
 * - Tabs render via view components in src/views/ (Missions, Bases, Crew, Tech, Systems, Faction); pass helpers as props to keep logic centralized here.
 * Extend flow:
 *   * Add new resources/rates in initialState and bump compute loops in applyProduction().
 *   * Add new buildings/tech/targets by extending constants (HUB_BUILDINGS, TECH, BODIES, BIOME_BUILDINGS) and any unlock rules.
 *   * Use log() for player feedback; use bumpResources/spend to modify economy.
 */
import { Suspense, lazy, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./App.css";
import { supabase, supabaseConfigured } from "./lib/supabase";
import { STORAGE_KEY, LEGACY_KEY, GAME_TITLE, TICK_MS, SAVE_MS, MAX_EVENTS_PER_BASE, SAVE_VERSION, EVENT_COOLDOWN_MS, FRAGMENT_TOTAL, FRAGMENT_THRESHOLDS, PACE, CREW_FATIGUE, CONTRACT_REFRESH_MS, COST_EXP, HUB_TIER_STEP, HUB_TIER_COST_MULT, HUB_UPGRADE_TIER_MULT, SYSTEM_EVENT_COOLDOWN_MS, MAX_SYSTEM_EVENTS, BODIES, HUB_UPGRADES, HUB_BUILDINGS, HUB_BUILDING_TIERS, BIOME_BUILDINGS, BASE_ZONES, BASE_TRAITS, TECH, BASE_OPS, STARTER_TOUR, CODEX_ENTRIES, WIKI_ENTRIES, MISSION_MODES, SYSTEM_NAME_PARTS, SYSTEM_TRAITS, SYSTEM_SURVEY_STEPS, SURVEY_SEQUENCE, COLONY_ROLES, COLONY_COST, CREW_PROGRAMS, CREW_CONTRACTS, SYSTEM_EVENTS, INTEGRATION_PROJECTS, GALAXY_RULESETS, DOCTRINES, FACTION_OVERRIDES } from "./game/data";

const ExpeditionsView = lazy(() => import("./views/Expeditions"));
const CrewView = lazy(() => import("./views/Crew"));
const TechView = lazy(() => import("./views/Tech"));
const FactionView = lazy(() => import("./views/Faction"));

const viewPreloaders = {
  expeditions: () => import("./views/Expeditions"),
  missions: () => import("./views/Missions"),
  bases: () => import("./views/Bases"),
  crew: () => import("./views/Crew"),
  tech: () => import("./views/Tech"),
  faction: () => import("./views/Faction"),
};

function seedCrewRoster(workers) {
  const assigned = workers?.assigned || { miner: 0, botanist: 0, engineer: 0 };
  const names = ["Kade", "Mira", "Orion", "Tala", "Nyx", "Rin", "Vega", "Ash"];
  const roles = [
    ...Array.from({ length: assigned.miner || 0 }, () => "miner"),
    ...Array.from({ length: assigned.botanist || 0 }, () => "botanist"),
    ...Array.from({ length: assigned.engineer || 0 }, () => "engineer"),
  ];
  while (roles.length < (workers?.total || 0)) roles.push("engineer");
  return roles.map((role, idx) => {
    const bonus = 0.05;
    const name = names[idx % names.length];
    return {
      id: `core-${role}-${idx}`,
      name,
      role,
      trait: `+${Math.round(bonus * 100)}% to ${role}`,
      bonus,
      focus: "production",
      fatigue: 0,
      temp: false,
      hiredAt: 0,
    };
  });
}

const initialState = {
  saveVersion: SAVE_VERSION,
  tab: "hub",
  profile: { name: "" },
  resources: { signal: 0, research: 2, metal: 0, organics: 0, fuel: 12, power: 0, food: 0, habitat: 0, morale: 0, rare: 0 },
  rates: { signal: 0, research: 0, metal: 0, organics: 0, fuel: 0, power: 0, food: 0, morale: 0 },
  population: { total: 3, progress: 0 },
  fragments: { recovered: 0 },
  workers: { total: 3, assigned: { miner: 1, botanist: 1, engineer: 1 }, bonus: { miner: 0, botanist: 0, engineer: 0 }, satisfaction: 1 },
  autoBalance: { enabled: true, mode: "balanced" },
  priority: { metal: 20, organics: 20, fuel: 20, food: 20, research: 20 },
  hubBuildings: {},
  hubUpgrades: {},
  systems: [],
  colonies: [],
  galaxies: [],
  activeGalaxyId: null,
  doctrine: null,
  bases: {},
  tech: {},
  missions: { active: [] },
  targetDepletion: {},
  systemEvents: [],
  integration: { eventRateMult: 1, travelMult: 1, saturationRelief: 0, signalCapBonus: 0 },
  crewPrograms: {},
  crewRoster: seedCrewRoster({ total: 3, assigned: { miner: 1, botanist: 1, engineer: 1 } }),
  crewContracts: [],
  nextContractAt: 0,
  autoLaunch: { enabled: false, bodyId: null, mode: "balanced", specialist: "none" },
  selectedBody: "debris",
  recruits: [],
  lastRecruitRoll: 0,
  log: [],
  milestones: {},
  milestonesUnlocked: [],
  codexUnlocked: [],
  tourStep: 0,
  tourSeen: false,
  prestige: { points: 0, runs: 0, boost: 1 },
};

const NON_NEGATIVE_RESOURCES = new Set(["power", "signal", "morale", "habitat", "research", "rare"]);

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function fragmentProgress(stateObj) {
  const recovered = Math.max(0, Math.floor(stateObj.fragments?.recovered || 0));
  const total = Math.max(1, FRAGMENT_TOTAL);
  const percent = clamp(recovered / total, 0, 1);
  const next = FRAGMENT_THRESHOLDS.find((threshold) => percent < threshold.percent) || null;
  return { recovered, total, percent, next };
}

function fragmentMilestoneIds(recovered) {
  const total = Math.max(1, FRAGMENT_TOTAL);
  const percent = clamp((recovered || 0) / total, 0, 1);
  return FRAGMENT_THRESHOLDS.filter((threshold) => percent >= threshold.percent).map((threshold) => `M6_${threshold.id}`);
}

function reducer(state, action) {
  switch (action.type) {
    case "LOAD":
      return { ...state, ...action.payload };
    case "SET_TAB":
      return { ...state, tab: action.tab };
    case "SET_SELECTED_BODY":
      return { ...state, selectedBody: action.id };
    case "LOG":
      return { ...state, log: [...state.log.slice(-50), { text: action.text, time: Date.now() }] };
    case "SET_RECRUITS":
      return { ...state, recruits: action.recruits, lastRecruitRoll: Date.now() };
    case "UPDATE":
      return { ...state, ...action.patch };
    case "TOUR_STEP":
      return { ...state, tourStep: action.step, tourSeen: action.seen ?? state.tourSeen };
    default:
      return state;
  }
}
export default function App() {
  const initState = useMemo(() => loadSavedState(), []);
  const [state, dispatch] = useReducer(reducer, initState);
  const [tick, setTick] = useState(0);
  const [compact, setCompact] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [supabaseUserId, setSupabaseUserId] = useState(null);
  const [factionState, setFactionState] = useState({
    factions: [],
    projects: {},
    buildings: {},
    activity: [],
    donations: [],
    chat: [],
    membership: null,
    loading: false,
    error: null,
    activityError: null,
    donationsError: null,
    chatError: null,
    leaderboard: [],
    leaderboardError: null,
    buildingsError: null,
  });
  const [profileNameDraft, setProfileNameDraft] = useState(initState.profile?.name || "");
  const stateRef = useRef(state);
  const leaderboardRefreshRef = useRef(0);
  const currentBody = selectedBody();
  const currentBase = useMemo(() => ensureBaseState(state.bases[state.selectedBody], currentBody), [state.bases, state.selectedBody]);
  const currentTraits = baseTraitList(currentBase);
  const currentMaintenance = baseMaintenanceStats(currentBase);
  const populationTotal = Math.max(state.population?.total || 0, state.workers.total || 0);
  const availablePopulation = Math.max(0, populationTotal - state.workers.total - totalBaseWorkers(state));
  const supabaseReady = supabaseConfigured && !!supabase;
  const capabilities = deriveCapabilities(state);
  const navTabs = buildNavTabs(capabilities, supabaseReady);
  const tabOrder = navTabs.map((tab) => tab.id);
  const missionMods = colonyModifiers(state);
  const CHAT_RETENTION_MS = 4 * 60 * 60 * 1000;
  const lazyFallback = <div className="panel text-sm text-muted">Loading module…</div>;

  useEffect(() => {
    if (!state.bases[state.selectedBody]) {
      const base = defaultBaseState(currentBody);
      dispatch({ type: "UPDATE", patch: { bases: { ...state.bases, [currentBody.id]: base } } });
    }
  }, [state.selectedBody, state.bases]);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { setProfileNameDraft(state.profile?.name || ""); }, [state.profile?.name]);

  useEffect(() => {
    if (!supabaseConfigured || !supabase) return;
    let active = true;
    const initAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data?.session?.user?.id) {
        setSupabaseUserId(data.session.user.id);
        return;
      }
      const { data: signed } = await supabase.auth.signInAnonymously();
      if (!active) return;
      setSupabaseUserId(signed?.session?.user?.id || null);
    };
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setSupabaseUserId(session?.user?.id || null);
    });
    initAuth();
    return () => {
      active = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const refreshLeaderboard = async () => {
    if (!supabaseConfigured || !supabase) return;
    const now = Date.now();
    if (now - leaderboardRefreshRef.current < 800) return;
    leaderboardRefreshRef.current = now;
    const { data, error } = await supabase.rpc("get_faction_leaderboard", { limit_count: 10 });
    setFactionState((prev) => ({
      ...prev,
      leaderboard: data || prev.leaderboard,
      leaderboardError: error ? "Leaderboard RPC unavailable." : null,
    }));
  };

  useEffect(() => {
    if (!supabaseConfigured || !supabase || !supabaseUserId) return;
    let active = true;
    setFactionState((prev) => ({ ...prev, loading: true, error: null }));
    const loadFactionData = async () => {
      const [factionsRes, projectsRes, buildingsRes, memberRes, leaderboardRes] = await Promise.all([
        supabase.from("factions").select("*").order("name"),
        supabase.from("faction_projects").select("*"),
        supabase.from("faction_building_progress").select("*"),
        supabase.from("faction_members").select("*").eq("user_id", supabaseUserId).maybeSingle(),
        supabase.rpc("get_faction_leaderboard", { limit_count: 10 }),
      ]);
      if (!active) return;
      const projectsByFaction = {};
      (projectsRes.data || []).forEach((project) => {
        projectsByFaction[project.faction_id] = project;
      });
      const buildingsByFaction = {};
      (buildingsRes.data || []).forEach((row) => {
        if (!row.faction_id || !row.building_id) return;
        const factionBuildings = buildingsByFaction[row.faction_id] || {};
        factionBuildings[row.building_id] = row;
        buildingsByFaction[row.faction_id] = factionBuildings;
      });
      const error = factionsRes.error?.message || projectsRes.error?.message || memberRes.error?.message || null;
      const leaderboardError = leaderboardRes.error ? "Leaderboard RPC unavailable." : null;
      const buildingsError = buildingsRes.error ? "Faction buildings unavailable." : null;
      setFactionState((prev) => ({
        ...prev,
        factions: factionsRes.data || prev.factions,
        projects: projectsRes.data ? projectsByFaction : prev.projects,
        buildings: buildingsRes.data ? buildingsByFaction : prev.buildings,
        membership: memberRes.data || null,
        leaderboard: leaderboardRes.data || prev.leaderboard,
        leaderboardError,
        buildingsError,
        loading: false,
        error,
      }));
    };
    loadFactionData();
    const channel = supabase
      .channel("faction_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "faction_projects" }, (payload) => {
        const record = payload.new || payload.old;
        if (!record?.faction_id) return;
        setFactionState((prev) => {
          const nextProjects = { ...prev.projects };
          if (payload.eventType === "DELETE") {
            delete nextProjects[record.faction_id];
          } else {
            nextProjects[record.faction_id] = record;
          }
          return { ...prev, projects: nextProjects };
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "faction_building_progress" }, (payload) => {
        const record = payload.new || payload.old;
        if (!record?.faction_id || !record?.building_id) return;
        setFactionState((prev) => {
          const nextBuildings = { ...prev.buildings };
          const factionBuildings = { ...(nextBuildings[record.faction_id] || {}) };
          if (payload.eventType === "DELETE") {
            delete factionBuildings[record.building_id];
          } else {
            factionBuildings[record.building_id] = record;
          }
          nextBuildings[record.faction_id] = factionBuildings;
          return { ...prev, buildings: nextBuildings };
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "faction_members" }, (payload) => {
        const record = payload.new || payload.old;
        if (!record) return;
        if (record.user_id === supabaseUserId) {
          setFactionState((prev) => ({ ...prev, membership: payload.eventType === "DELETE" ? null : record }));
        }
        refreshLeaderboard();
      })
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [supabaseUserId]);

  useEffect(() => {
    if (!supabaseConfigured || !supabase || !supabaseUserId) return;
    const factionId = factionState.membership?.faction_id;
    if (!factionId) {
      setFactionState((prev) => ({
        ...prev,
        activity: [],
        donations: [],
        chat: [],
        activityError: null,
        donationsError: null,
        chatError: null,
      }));
      return;
    }
    let active = true;
    const isFreshChat = (row) => {
      const stamp = Date.parse(row?.created_at);
      return Number.isFinite(stamp) && (Date.now() - stamp) <= CHAT_RETENTION_MS;
    };
    const trimChat = (rows) => rows.filter(isFreshChat).slice(0, 50);
    const loadLogs = async () => {
      const [activityRes, donationsRes, chatRes] = await Promise.all([
        supabase.from("faction_activity_log").select("*").eq("faction_id", factionId).order("created_at", { ascending: false }).limit(25),
        supabase.from("faction_donations_log").select("*").eq("faction_id", factionId).order("created_at", { ascending: false }).limit(25),
        supabase.from("faction_chat_log").select("*").eq("faction_id", factionId).order("created_at", { ascending: false }).limit(50),
      ]);
      if (!active) return;
      setFactionState((prev) => ({
        ...prev,
        activity: activityRes.data || [],
        donations: donationsRes.data || [],
        activityError: activityRes.error?.message || null,
        donationsError: donationsRes.error?.message || null,
        chat: trimChat(chatRes.data || []),
        chatError: chatRes.error?.message || null,
      }));
    };
    loadLogs();

    const upsertLog = (list, record) => {
      const next = list.filter((row) => row.id !== record.id);
      next.unshift(record);
      return next.slice(0, 25);
    };
    const upsertChat = (list, record) => {
      const next = list.filter((row) => row.id !== record.id);
      next.unshift(record);
      return trimChat(next);
    };

    const channel = supabase
      .channel(`faction_logs_${factionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "faction_activity_log", filter: `faction_id=eq.${factionId}` }, (payload) => {
        const record = payload.new || payload.old;
        if (!record?.id) return;
        setFactionState((prev) => {
          const next = payload.eventType === "DELETE"
            ? prev.activity.filter((row) => row.id !== record.id)
            : upsertLog(prev.activity, record);
          return { ...prev, activity: next };
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "faction_donations_log", filter: `faction_id=eq.${factionId}` }, (payload) => {
        const record = payload.new || payload.old;
        if (!record?.id) return;
        setFactionState((prev) => {
          const next = payload.eventType === "DELETE"
            ? prev.donations.filter((row) => row.id !== record.id)
            : upsertLog(prev.donations, record);
          return { ...prev, donations: next };
        });
        refreshLeaderboard();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "faction_chat_log", filter: `faction_id=eq.${factionId}` }, (payload) => {
        const record = payload.new || payload.old;
        if (!record?.id) return;
        setFactionState((prev) => {
          const next = payload.eventType === "DELETE"
            ? prev.chat.filter((row) => row.id !== record.id)
            : upsertChat(prev.chat, record);
          return { ...prev, chat: next };
        });
      })
      .subscribe();
    const pollId = setInterval(loadLogs, 5000);
    const pruneId = setInterval(() => {
      setFactionState((prev) => ({ ...prev, chat: trimChat(prev.chat || []) }));
    }, 60 * 1000);

    return () => {
      active = false;
      clearInterval(pollId);
      clearInterval(pruneId);
      supabase.removeChannel(channel);
    };
  }, [supabaseUserId, factionState.membership?.faction_id]);

  // Persist current in-memory state to storage (localStorage + cookie).
  const persistState = () => {
    try {
      const payload = JSON.stringify(stateRef.current);
      localStorage.setItem(STORAGE_KEY, payload);
      document.cookie = `signalFrontier=${encodeURIComponent(btoa(payload))};path=/;max-age=31536000`;
      setLastSaved(Date.now());
    } catch (e) {
      console.warn("Save failed", e);
    }
  };

  // Manual save trigger used by Account tab.
  const manualSave = () => {
    persistState();
  };

  async function joinFaction(factionId) {
    if (!supabaseReady || !supabase) return { ok: false, message: "Supabase not configured." };
    if (!state.profile?.name?.trim()) return { ok: false, message: "Set a callsign in Command Account first." };
    if (!supabaseUserId) return { ok: false, message: "Signing in? try again." };
    const { data, error } = await supabase.rpc("join_faction", {
      p_faction_id: factionId,
      p_callsign: state.profile.name.trim(),
    });
    if (error) {
      log(`Faction join failed: ${error.message}`);
      return { ok: false, message: `Join failed: ${error.message}` };
    }
    setFactionState((prev) => ({ ...prev, membership: data }));
    const name = FACTION_OVERRIDES[factionId]?.name || factionState.factions.find((f) => f.id === factionId)?.name || "faction";
    log(`Aligned with ${name}.`);
    return { ok: true, message: `Aligned with ${name}.` };
  }

  useEffect(() => {
    if (!supabaseReady || !supabase || !supabaseUserId) return;
    if (!factionState.membership?.faction_id) return;
    const callsign = state.profile?.name?.trim();
    if (!callsign) return;
    supabase.rpc("set_faction_callsign", { p_callsign: callsign });
  }, [supabaseReady, supabaseUserId, factionState.membership?.faction_id, state.profile?.name]);

  async function donateFaction(resource, amount) {
    const value = Math.floor(Number(amount));
    if (!supabaseReady || !supabase) return { ok: false, message: "Supabase not configured." };
    if (!factionState.membership?.faction_id) return { ok: false, message: "Join a faction first." };
    if (!resource || !Number.isFinite(value) || value <= 0) return { ok: false, message: "Enter a valid amount." };
    const cost = { [resource]: value };
    if (!canAfford(cost)) return { ok: false, message: "Not enough resources." };
    spend(cost);
    const { error } = await supabase.rpc("donate_faction", {
      p_faction_id: factionState.membership.faction_id,
      p_resource: resource,
      p_amount: value,
    });
    if (error) {
      bumpResources(cost);
      log(`Donation failed: ${error.message}`);
      return { ok: false, message: `Donation failed: ${error.message}` };
    }
    setFactionState((prev) => {
      const factionId = prev.membership?.faction_id;
      if (!factionId) return prev;
      const project = prev.projects?.[factionId];
      if (!project) return prev;
      const progress = { ...(project.progress || {}) };
      progress[resource] = (progress[resource] || 0) + value;
      const nextProjects = { ...prev.projects, [factionId]: { ...project, progress, updated_at: new Date().toISOString() } };
      return { ...prev, projects: nextProjects };
    });
    log(`Donated ${value} ${resource} to faction project.`);
    refreshLeaderboard();
    return { ok: true, message: "Donation sent." };
  }

  async function donateFactionBuilding(buildingId, resource, amount) {
    const value = Math.floor(Number(amount));
    if (!supabaseReady || !supabase) return { ok: false, message: "Supabase not configured." };
    if (!factionState.membership?.faction_id) return { ok: false, message: "Join a faction first." };
    if (!buildingId) return { ok: false, message: "Choose a building." };
    if (!resource || !Number.isFinite(value) || value <= 0) return { ok: false, message: "Enter a valid amount." };
    const cost = { [resource]: value };
    if (!canAfford(cost)) return { ok: false, message: "Not enough resources." };
    spend(cost);
    const { error } = await supabase.rpc("donate_faction_building", {
      p_faction_id: factionState.membership.faction_id,
      p_building_id: buildingId,
      p_resource: resource,
      p_amount: value,
    });
    if (error) {
      bumpResources(cost);
      log(`Building donation failed: ${error.message}`);
      return { ok: false, message: `Donation failed: ${error.message}` };
    }
    setFactionState((prev) => {
      const factionId = prev.membership?.faction_id;
      if (!factionId) return prev;
      const nextBuildings = { ...prev.buildings };
      const factionBuildings = { ...(nextBuildings[factionId] || {}) };
      const existing = factionBuildings[buildingId] || { faction_id: factionId, building_id: buildingId, progress: {} };
      const progress = { ...(existing.progress || {}) };
      progress[resource] = (progress[resource] || 0) + value;
      factionBuildings[buildingId] = { ...existing, progress, updated_at: new Date().toISOString() };
      nextBuildings[factionId] = factionBuildings;
      return { ...prev, buildings: nextBuildings };
    });
    log(`Donated ${value} ${resource} to faction construction.`);
    refreshLeaderboard();
    return { ok: true, message: "Construction resources delivered." };
  }

  async function sendFactionChat(message) {
    const content = message?.trim().slice(0, 240);
    if (!supabaseReady || !supabase) return { ok: false, message: "Supabase not configured." };
    if (!factionState.membership?.faction_id) return { ok: false, message: "Align with a faction first." };
    if (!state.profile?.name?.trim()) return { ok: false, message: "Set a callsign in Command Account first." };
    if (!supabaseUserId) return { ok: false, message: "Signing in? try again." };
    if (!content) return { ok: false, message: "Enter a message." };
    const { data, error } = await supabase.rpc("post_faction_chat", {
      p_faction_id: factionState.membership.faction_id,
      p_callsign: state.profile.name.trim(),
      p_message: content,
    });
    if (error) return { ok: false, message: `Transmission failed: ${error.message}` };
    if (data?.id) {
      setFactionState((prev) => {
        const next = [data, ...(prev.chat || [])].slice(0, 50);
        return { ...prev, chat: next };
      });
    }
    return { ok: true, message: "Transmission sent." };
  }

  useEffect(() => {
    persistState(); // initial save to normalize keys
    const id = setInterval(persistState, SAVE_MS);
    const onVis = () => { if (document.visibilityState === "hidden") persistState(); };
    const onBeforeUnload = () => persistState();
    window.addEventListener("visibilitychange", onVis);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      clearInterval(id);
      window.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), TICK_MS); return () => clearInterval(id); }, []);
  useEffect(() => { applyProduction(); resolveMissions(); processSystems(); processEvents(); processCrew(); processMilestones(); ensureSystems(); }, [tick]);
  useEffect(() => { ensureGalaxy(); }, [state.systems.length, state.milestonesUnlocked]);
  useEffect(() => {
    if (state.tab === "profile") return;
    if (!tabOrder.includes(state.tab)) dispatch({ type: "SET_TAB", tab: "hub" });
  }, [state.tab, tabOrder]);

  useEffect(() => {
    const onKey = (e) => {
      if (["INPUT","TEXTAREA"].includes(e.target.tagName) || e.target.isContentEditable) return;
      if (e.code.startsWith("Digit")) {
        const num = Number(e.key);
        const idx = num === 0 ? tabOrder.length - 1 : num - 1;
        if (idx >= 0 && idx < tabOrder.length) dispatch({ type: "SET_TAB", tab: tabOrder[idx] });
      }
      else if (e.code === "ArrowRight") cycleTab(1);
      else if (e.code === "ArrowLeft") cycleTab(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function cycleTab(delta) {
    if (!tabOrder.length) return;
    const idx = Math.max(0, tabOrder.indexOf(state.tab));
    const next = (idx + delta + tabOrder.length) % tabOrder.length;
    dispatch({ type: "SET_TAB", tab: tabOrder[next] });
  }

  function applyResourceDelta(base, delta) {
    const next = { ...base };
    Object.entries(delta).forEach(([key, value]) => {
      const updated = (next[key] || 0) + value;
      next[key] = NON_NEGATIVE_RESOURCES.has(key) ? Math.max(0, updated) : updated;
    });
    return next;
  }

  // Apply resource delta; used across economy adjustments.
  function bumpResources(delta) {
    dispatch({ type: "UPDATE", patch: { resources: applyResourceDelta(state.resources, delta) } });
  }

  function log(text) { dispatch({ type: "LOG", text }); }

  function unlockCodex(id, message) {
    const unlocked = new Set(state.codexUnlocked || []);
    if (unlocked.has(id)) return;
    unlocked.add(id);
    dispatch({ type: "UPDATE", patch: { codexUnlocked: Array.from(unlocked) } });
    if (message) log(message);
  }

  function rollFragmentDiscovery(body, efficiency, success, hadObjective) {
    const tier = body?.tier || 1;
    const baseChance = 0.03 + tier * 0.01;
    const objectiveBonus = hadObjective ? 0.04 : 0;
    const successBonus = success === "full" ? 0.04 : success === "partial" ? 0.02 : 0;
    const chance = clamp((baseChance + objectiveBonus + successBonus) * (efficiency || 1), 0, 0.35);
    if (Math.random() > chance) return 0;
    const baseYield = 1 + Math.floor(tier * (success === "full" ? 0.6 : 0.35));
    return Math.max(1, baseYield);
  }

  function awardFragments(amount, body) {
    if (!amount) return;
    const recovered = Math.min(FRAGMENT_TOTAL, (state.fragments?.recovered || 0) + amount);
    dispatch({ type: "UPDATE", patch: { fragments: { ...state.fragments, recovered } } });
    if (!(state.fragments?.recovered || 0)) {
      unlockCodex("veil_premise");
      unlockCodex("veil_fragments");
    }
    log(`Recovered ${amount} fragment shard${amount === 1 ? "" : "s"} near ${body?.name || "unknown space"}.`);
  }

  // Per-tick production: aggregates hub/base output, morale, focus, hazards, and power gating.
  function applyProduction() {
    const r = { ...state.resources };
    const contributions = [];
    const eventMods = aggregateEventMods(currentBase);
    const traitMods = traitEffects(currentBase.traits);
    const maintenance = baseMaintenanceStats(currentBase);
    const focusMods = crewFocusModifiers(state);
    const contractMods = crewContractModifiers(state);
    const hubMods = hubUpgradeMods(state);
    const workforce = baseWorkforceStats(currentBase);

    const addContribution = (prod, cons, requiresPower) => contributions.push({ prod, cons, requiresPower });

    Object.entries(state.hubBuildings).forEach(([id, lvl]) => {
      const def = HUB_BUILDINGS.find((b) => b.id === id); if (!def) return; const mult = workerMult(def.id);
      const prod = {}; Object.entries(def.prod || {}).forEach(([k, v]) => prod[k] = v * lvl * mult);
      addContribution(applyProdMult(prod, focusMods, contractMods), scaleCons(def.cons, lvl), !!def.cons?.power);
    });
    if (state.hubUpgrades.fuel_farm) addContribution(applyProdMult({ fuel: 1 * state.hubUpgrades.fuel_farm }, focusMods, contractMods), {}, false);
    if (state.hubUpgrades.scan_array) addContribution(applyProdMult({ signal: 2 * state.hubUpgrades.scan_array }, focusMods, contractMods), {}, false);
    if (hubMods.habitat || hubMods.morale) addContribution({ habitat: hubMods.habitat, morale: hubMods.morale }, {}, false);
    if (state.tech.deep_scan) addContribution(applyProdMult({ research: 1 * state.tech.deep_scan }, focusMods, contractMods), {}, false);
    if (state.tech.bio_domes) addContribution(applyProdMult({ food: 2 * state.tech.bio_domes, habitat: 2 * state.tech.bio_domes }, focusMods, contractMods), {}, false);

    const focus = currentBase.focus || "balanced";
    Object.entries(currentBase.buildings || {}).forEach(([id, lvl]) => {
      const def = biomeBuildingById(id); if (!def) return;
      const prod = {};
      Object.entries(def.prod || {}).forEach(([k, v]) => {
        const traitMult = traitMods.prod[k] || 1;
        const workforceMult = k === "research" ? workforce.researchMult : workforce.productionMult;
        prod[k] = v * lvl * workerMult(id) * focusBoost(focus, k) * (eventMods.mult[k] || 1) * traitMult * (maintenance.factor || 1) * workforceMult;
      });
      addContribution(applyProdMult(prod, focusMods, contractMods), scaleCons(def.cons, lvl), !!def.cons?.power);
    });

    const sumRates = (powerGate, throttleMap) => {
      const rates = { signal: 0, research: 0, metal: 0, organics: 0, fuel: 0, power: 0, food: 0, morale: 0, habitat: 0, rare: 0 };
      contributions.forEach(({ prod, cons, requiresPower }) => {
        let scale = powerGate && requiresPower ? 0 : 1;
        if (throttleMap && cons && Object.keys(cons).length) {
          const throttle = Object.keys(cons).reduce((min, key) => {
            const value = throttleMap[key];
            if (!Number.isFinite(value)) return min;
            return Math.min(min, value);
          }, 1);
          scale *= throttle;
        }
        Object.entries(prod).forEach(([k, v]) => rates[k] = (rates[k] || 0) + v * scale);
        Object.entries(cons || {}).forEach(([k, v]) => rates[k] = (rates[k] || 0) - v * scale);
      });
      return rates;
    };

    const prodBoost = 1 + ((state.prestige?.boost || 1) - 1);
    const projected = sumRates(false);
    const projectedPower = (state.resources.power || 0) + projected.power;
    const powerGate = projectedPower <= 0;
    let rates = sumRates(powerGate);
    const autoBalanceEnabled = (state.hubBuildings.auto_balancer || 0) > 0 && (state.autoBalance?.enabled ?? true);
    if (autoBalanceEnabled) {
      const horizonTicks = Math.max(1, Math.round(30000 / TICK_MS));
      const throttles = {};
      Object.entries(rates).forEach(([key, rate]) => {
        if (rate >= 0) return;
        const reserve = r[key] || 0;
        const projectedReserve = reserve + rate * horizonTicks;
        if (projectedReserve < 0) {
          throttles[key] = clamp(reserve / Math.max(1, Math.abs(rate) * horizonTicks), 0, 1);
        }
      });
      if (Object.keys(throttles).length) {
        rates = sumRates(powerGate, throttles);
      }
    }
    const fuelShort = (state.resources.fuel || 0) <= 0 && (rates.fuel || 0) <= 0;
    if (fuelShort) {
      rates.signal *= 0.8;
      rates.research *= 0.85;
    }
    const popCheck = Math.max(state.population?.total || 0, state.workers.total || 0);
    const upkeepCheck = populationFoodUpkeep(popCheck);
    const foodCheck = populationFoodState(state.resources.food || 0, rates.food || 0, upkeepCheck);
    const foodPenalty = foodCheck.state === "low" ? 0.9 : foodCheck.state === "negative" ? 0.75 : 1;
    if (foodPenalty !== 1) {
      ["metal", "organics", "fuel", "power", "research", "rare", "signal", "habitat"].forEach((k) => {
        rates[k] = (rates[k] || 0) * foodPenalty;
      });
    }
    if ((state.hubBuildings.priority_manager || 0) > 0) {
      const priority = state.priority || defaultPriority();
      ["metal", "organics", "fuel", "food", "research"].forEach((key) => {
        if ((rates[key] || 0) <= 0) return;
        rates[key] = rates[key] * priorityMultiplier(priority, key);
      });
    }
    rates.morale = (rates.morale || 0) + (traitMods.morale || 0);
    const saturation = signalSaturation(state);
    if (rates.signal > 0 && saturation.factor < 1) rates.signal *= saturation.factor;

    Object.keys(rates).forEach((k) => {
      const updated = r[k] + rates[k] * (k === "power" ? 1 : prodBoost);
      r[k] = NON_NEGATIVE_RESOURCES.has(k) ? Math.max(0, updated) : updated;
    });

    const popState = state.population || { total: state.workers.total || 0, progress: 0 };
    let popTotal = Math.max(popState.total || 0, state.workers.total || 0);
    const popCap = Math.max(popTotal, Math.floor(r.habitat || 0));
    const upkeep = populationFoodUpkeep(popTotal);
    const foodSnapshot = r.food;
    const foodInfo = populationFoodState(foodSnapshot, rates.food || 0, upkeep);
    r.food = foodSnapshot - upkeep;

    const growthBase = 1 / Math.max(1, Math.round(30000 / TICK_MS));
    const declineBase = 1 / Math.max(1, Math.round(60000 / TICK_MS));
    let progress = popState.progress || 0;
    if (foodInfo.state === "negative") {
      progress -= declineBase;
    } else if (popTotal < popCap) {
      let mult = foodInfo.state === "abundant" ? 1.5 : foodInfo.state === "low" ? 0.5 : 1;
      if (popCap > 0 && popTotal / popCap >= 0.9) mult *= 0.5;
      progress += growthBase * mult;
    }
    if (progress >= 1) {
      const add = Math.floor(progress);
      popTotal = Math.min(popCap, popTotal + add);
      progress -= add;
    }
    if (progress <= -1) {
      const sub = Math.floor(Math.abs(progress));
      popTotal = Math.max(0, popTotal - sub);
      progress += sub;
    }
    popTotal = Math.max(popTotal, state.workers.total || 0);
    const population = { total: popTotal, progress };

    const netRates = { ...rates, food: (rates.food || 0) - upkeep };

    const morale = computeMorale(r, netRates, state, currentBase, eventMods, powerGate);
    dispatch({ type: "UPDATE", patch: { resources: r, rates: netRates, workers: { ...state.workers, satisfaction: morale }, population } });
  }

  function workerMult(buildingId) {
    const bonus = state.workers.bonus || {};
    const moraleBoost = clamp(state.workers.satisfaction || 1, 0.5, 1.5);
    const fatigueStats = crewFatigueStats(state);
    const focusMods = crewFocusModifiers(state);
    if (["ore_rig","fuel_cracker","core_rig","core_tap"].includes(buildingId)) {
      const fatigueMult = 1 - (fatigueStats.byRole.miner || 0) * 0.2;
      const focusBonus = focusMods.roleProdBonus.miner || 0;
      const oreFocus = (["ore_rig","core_rig","core_tap"].includes(buildingId)) ? (focusMods.minerOreMult || 1) : 1;
      return (1 + (state.workers.assigned.miner || 0) * 0.1 + (bonus.miner || 0)) * (1 + focusBonus) * oreFocus * fatigueMult * moraleBoost;
    }
    if (["algae_farm","protein_farm","bio_reactor","hydroponics"].includes(buildingId)) {
      const fatigueMult = 1 - (fatigueStats.byRole.botanist || 0) * 0.2;
      const focusBonus = focusMods.roleProdBonus.botanist || 0;
      const nutritionFocus = focusMods.botanistNutritionMult || 1;
      return (1 + (state.workers.assigned.botanist || 0) * 0.1 + (bonus.botanist || 0)) * (1 + focusBonus) * nutritionFocus * fatigueMult * moraleBoost;
    }
    const fatigueMult = 1 - (fatigueStats.byRole.engineer || 0) * 0.2;
    const focusBonus = focusMods.roleProdBonus.engineer || 0;
    return (1 + (state.workers.assigned.engineer || 0) * 0.05 + (bonus.engineer || 0)) * (1 + focusBonus) * fatigueMult * moraleBoost;
  }

  const crewBonusText = (buildingId) => {
    const mult = workerMult(buildingId);
    const pct = Math.max(0, (mult - 1) * 100);
    return `${pct.toFixed(0)}%`;
  };

  // Settle completed missions; applies cargo, objectives, failure risk, and logs.
  function resolveMissions() {
    const active = state.missions.active || [];
    if (!active.length) return;
    const now = Date.now(); const remaining = [];
    const depletion = { ...(state.targetDepletion || {}) };
    const depletionWarned = { ...(state.milestones?.depletionWarned || {}) };
    let depletionChanged = false;
    active.forEach((m) => {
      if (now < m.endsAt) { remaining.push(m); return; }
      const body = BODIES.find((b) => b.id === m.bodyId); if (!body) return;
      const efficiency = m.efficiency || depletionFactor(state, body.id);
      let cargo = missionYield(state, body, m.mode, m.specialist, efficiency);
      if (m.variance && m.variance !== 1) cargo = scaleCargo(cargo, m.variance);
      let acceptedObjective = false;
      if (m.objective) {
        const choice = window.confirm(`Side Objective: ${m.objective.desc}.\nTake the risk for ${m.objective.rewardText}?`);
        if (choice) {
          acceptedObjective = true;
          cargo = combineCargo(cargo, m.objective.reward);
          if (Math.random() < m.objective.failRisk) {
            cargo = reduceCargo(cargo, 0.5);
            log("Side objective mishap reduced cargo.");
          } else {
            log("Side objective succeeded. Bonus cargo added.");
          }
        }
      }
      const risk = Math.min(0.8, Math.max(0.05, (m.hazard || 0) * 0.6 + 0.05));
      const partial = Math.min(0.95, risk + 0.25);
      const roll = Math.random();
      if (roll < risk) {
        const salvage = reduceCargo(cargo, 0.2); bumpResources(salvage); log(`Expedition to ${body.name} failed. Salvaged ${Object.keys(salvage).length ? "scrap" : "nothing"}.`);
      } else if (roll < partial) {
        const haul = reduceCargo(cargo, 0.65); bumpResources(haul); log(`Expedition to ${body.name} returned partially due to hazard.`);
        const shards = rollFragmentDiscovery(body, efficiency, "partial", acceptedObjective);
        awardFragments(shards, body);
      } else {
        bumpResources(cargo); log(`Expedition from ${body.name} returned with cargo.`);
        const shards = rollFragmentDiscovery(body, efficiency, "full", acceptedObjective);
        awardFragments(shards, body);
      }
      if ((state.colonies || []).length && m.hazard >= 0.2) {
        const colonySystems = (state.colonies || []).map((c) => c.systemId);
        const systemId = colonySystems[Math.floor(Math.random() * colonySystems.length)];
        if (systemId) adjustSystemStability(systemId, -Math.round(m.hazard * 6), "Expedition strain detected.");
      }
      const current = depletion[body.id] || 0;
      const next = clamp(current + depletionRate(body), 0, 0.85);
      if (next !== current) {
        depletion[body.id] = next;
        depletionChanged = true;
        if (next >= 0.55 && !depletionWarned[body.id]) {
          depletionWarned[body.id] = true;
          log(`${body.name} yields are thinning. Extend range to access stronger targets.`);
        }
      }
    });
    const missionsDone = (state.milestones.missionsDone || 0) + (active.length - remaining.length);
    dispatch({
      type: "UPDATE",
      patch: {
        missions: { active: remaining },
        milestones: { ...state.milestones, missionsDone, depletionWarned },
        ...(depletionChanged ? { targetDepletion: depletion } : {}),
      },
    });

    // Auto-launch if enabled and slots free
    const slots = 1 + (state.hubUpgrades.launch_bay || 0) + (state.tech.auto_pilots ? 1 : 0);
    if (state.autoLaunch?.enabled && capabilities.missions && (remaining.length < slots)) {
      const target = state.autoLaunch.bodyId || state.selectedBody;
      const modeId = state.autoLaunch.mode || "balanced";
      const specialist = state.autoLaunch.specialist || "none";
      startMission(target, 0, modeId, specialist, true);
    }
  }

  // Rolls base events and keeps per-body event timers moving.
  function processEvents() {
    const now = Date.now();
    const bases = { ...state.bases };
    let changed = false;
    const crewMods = crewProgramModifiers(state);
    const focusMods = crewFocusModifiers(state);
    const contractMods = crewContractModifiers(state);
    BODIES.forEach((body) => {
      if (!isUnlocked(body)) return;
      const base = ensureBaseState(bases[body.id], body);
      if (!bases[body.id]) { bases[body.id] = base; changed = true; }
      const maintenance = baseMaintenanceStats(base);
      const workforce = baseWorkforceStats(base);
      const traitMods = traitEffects(base.traits);
      if (!base.nextEventAt) base.nextEventAt = now + randomBetween(...EVENT_COOLDOWN_MS);
      if (now >= base.nextEventAt) {
        if ((base.events || []).length < MAX_EVENTS_PER_BASE) {
          base.events = [...(base.events || []), createEvent(body)];
          log(`Event at ${body.name}: ${base.events[base.events.length - 1].name}`);
        }
        const eventMult = (traitMods.eventMult || 1) * (maintenance.over ? 0.7 : 1) * (workforce.eventRateMult || 1) * (crewMods.baseEventRateMult || 1) * (focusMods.baseEventRateMult || 1) * (contractMods.baseEventRateMult || 1);
        base.nextEventAt = now + randomBetween(...EVENT_COOLDOWN_MS) * eventMult;
        bases[body.id] = base; changed = true;
      }
    });
    if (changed) dispatch({ type: "UPDATE", patch: { bases } });
  }

  function processCrew() {
    const now = Date.now();
    let crewRoster = state.crewRoster || [];
    let workers = state.workers;
    let changed = false;
    const expired = [];

    if (!crewRoster.length && workers?.total) {
      crewRoster = seedCrewRoster(workers);
      changed = true;
    }

    crewRoster = crewRoster.filter((crew) => {
      if (crew.temp && crew.expiresAt && now >= crew.expiresAt) {
        expired.push(crew);
        return false;
      }
      return true;
    });

    const assignedRoster = assignCrewRoster({ ...state, crewRoster });
    const assignedIds = new Set(assignedRoster.filter((c) => c.assigned).map((c) => c.id));
    const focusMods = crewFocusModifiers({ ...state, crewRoster });
    const gainBase = CREW_FATIGUE.gain * (focusMods.fatigueGainMult || 1);
    const recoveryBase = CREW_FATIGUE.recovery * (focusMods.fatigueRecoveryMult || 1);

    crewRoster = crewRoster.map((crew) => {
      const assigned = assignedIds.has(crew.id);
      const focus = crew.focus || "production";
      let delta = assigned ? gainBase : -recoveryBase;
      if (focus === "recovery") delta *= assigned ? 0.7 : 1.4;
      const nextFatigue = clamp((crew.fatigue || 0) + delta, 0, 1);
      if (nextFatigue !== crew.fatigue || crew.focus !== focus) changed = true;
      return nextFatigue !== crew.fatigue || crew.focus !== focus ? { ...crew, fatigue: nextFatigue, focus } : crew;
    });

    if (expired.length) {
      const assigned = { ...workers.assigned };
      const bonus = { ...workers.bonus };
      expired.forEach((crew) => {
        assigned[crew.role] = Math.max(0, (assigned[crew.role] || 0) - 1);
        bonus[crew.role] = Math.max(0, (bonus[crew.role] || 0) - (crew.bonus || 0));
      });
      const assignedSum = Object.values(assigned).reduce((sum, v) => sum + v, 0);
      const total = Math.max(assignedSum, Math.max(0, workers.total - expired.length));
      workers = { ...workers, total, assigned, bonus };
      changed = true;
      log("Contract crew rotated out.");
    }

    let crewContracts = state.crewContracts || [];
    let nextContractAt = state.nextContractAt || 0;
    if (now >= nextContractAt && crewContracts.length === 0) {
      const pool = [...CREW_CONTRACTS].sort(() => Math.random() - 0.5).slice(0, 2);
      crewContracts = pool.map((c) => ({ ...c, offerId: `${c.id}-${now}-${Math.random().toString(16).slice(2, 6)}` }));
      const refreshMs = Math.floor(CONTRACT_REFRESH_MS * (crewTrainingTier(state) >= 3 ? 0.7 : 1));
      nextContractAt = now + refreshMs;
      changed = true;
      log("Specialist contracts posted.");
    }

    if (changed) dispatch({ type: "UPDATE", patch: { crewRoster, workers, crewContracts, nextContractAt } });
  }

  function processSystems() {
    const systems = state.systems || [];
    if (!systems.length) return;
    const now = Date.now();
    let updated = systems;
    let changed = false;
    const modifiers = colonyModifiers(state);
    const crewMods = crewProgramModifiers(state);
    const systemEvents = [...(state.systemEvents || [])];
    let eventsChanged = false;
    let integrationPatch = null;
    updated = systems.map((system) => {
      if (!system.op || now < system.op.endsAt) return system;
      const nextStage = nextSurveyStage(system.stage);
      const stepName = SYSTEM_SURVEY_STEPS[system.stage]?.name || "Survey step";
      log(`${stepName} complete for ${system.name}.`);
      changed = true;
      return { ...system, stage: nextStage, op: null, surveyedAt: nextStage === "colonize" ? now : system.surveyedAt };
    });
    updated = updated.map((system) => {
      if (system.project && now >= system.project.endsAt) {
        const project = INTEGRATION_PROJECTS.find((p) => p.id === system.project.id);
        const integrationBase = integrationPatch || state.integration || { eventRateMult: 1, travelMult: 1, saturationRelief: 0, signalCapBonus: 0 };
        const integration = { ...integrationBase };
        if (project?.effect) {
          if (project.effect.eventRateMult) integration.eventRateMult = (integration.eventRateMult || 1) * project.effect.eventRateMult;
          if (project.effect.travelMult) integration.travelMult = (integration.travelMult || 1) * project.effect.travelMult;
          if (project.effect.saturationRelief) integration.saturationRelief = clamp((integration.saturationRelief || 0) + project.effect.saturationRelief, 0, 0.6);
          if (project.effect.signalCapBonus) integration.signalCapBonus = (integration.signalCapBonus || 0) + project.effect.signalCapBonus;
        }
        if (project?.effect?.stability) {
          system.stability = clamp((system.stability ?? 100) + project.effect.stability, 35, 100);
        }
        integrationPatch = integration;
        log(`Integration complete in ${system.name}: ${project?.name || "Project"}.`);
        changed = true;
        return { ...system, project: null, integratedAt: system.integratedAt || now };
      }
      return system;
    });

    updated = updated.map((system) => {
      const isColonized = (state.colonies || []).some((c) => c.systemId === system.id);
      if (!isColonized) return system;
      const relatedEvents = systemEvents.filter((e) => e.systemId === system.id);
      const regen = (relatedEvents.length ? 0 : 0.005) + (crewMods.stabilityRecovery || 0);
      const nextStability = clamp((system.stability ?? 100) + regen, 35, 100);
      if (nextStability !== system.stability) {
        changed = true;
        system = { ...system, stability: nextStability };
      }
      if (!system.nextEventAt) system.nextEventAt = now + randomBetween(...SYSTEM_EVENT_COOLDOWN_MS);
      if (now >= system.nextEventAt && relatedEvents.length < MAX_SYSTEM_EVENTS) {
        const pick = SYSTEM_EVENTS[Math.floor(Math.random() * SYSTEM_EVENTS.length)];
        systemEvents.push({ ...pick, id: `${system.id}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`, systemId: system.id });
        eventsChanged = true;
        log(`System event at ${system.name}: ${pick.name}.`);
        const stabilityFactor = clamp((system.stability ?? 100) / 100, 0.6, 1.2);
        const eventRate = modifiers.eventRateMult || 1;
        system.nextEventAt = now + randomBetween(...SYSTEM_EVENT_COOLDOWN_MS) * stabilityFactor * eventRate;
        changed = true;
      } else if (now >= system.nextEventAt && relatedEvents.length >= MAX_SYSTEM_EVENTS) {
        const stabilityFactor = clamp((system.stability ?? 100) / 100, 0.6, 1.2);
        const eventRate = modifiers.eventRateMult || 1;
        system.nextEventAt = now + randomBetween(...SYSTEM_EVENT_COOLDOWN_MS) * stabilityFactor * eventRate;
        changed = true;
      }
      return system;
    });
    if (modifiers.stabilityDrain > 0) {
      updated = updated.map((system) => {
        if (!(state.colonies || []).some((c) => c.systemId === system.id)) return system;
        const next = clamp((system.stability ?? 100) - modifiers.stabilityDrain, 35, 100);
        if (next === system.stability) return system;
        changed = true;
        return { ...system, stability: next };
      });
    }
    const patch = {};
    if (changed) patch.systems = updated;
    if (eventsChanged) patch.systemEvents = systemEvents;
    if (modifiers.command.over > 0 && !state.milestones?.commandOverCap) {
      patch.milestones = { ...state.milestones, commandOverCap: true };
      log("Command capacity exceeded. Colony efficiency slipping.");
    }
    if (integrationPatch) patch.integration = integrationPatch;
    if (Object.keys(patch).length) dispatch({ type: "UPDATE", patch });
  }

  function ensureGalaxy() {
    if (!capabilities.systems) return;
    if ((state.galaxies || []).length) {
      if (!state.activeGalaxyId) {
        dispatch({ type: "UPDATE", patch: { activeGalaxyId: state.galaxies[0].id } });
      }
      return;
    }
    const starter = { id: `gal-${Date.now()}`, name: "Origin Galaxy", rulesetId: "dense", depth: 1, discoveredAt: Date.now() };
    dispatch({ type: "UPDATE", patch: { galaxies: [starter], activeGalaxyId: starter.id } });
    log("Galaxy layer initialized: Origin Galaxy.");
  }

  function chartNewGalaxy(rulesetId) {
    const integratedSystems = (state.systems || []).filter((s) => s.integratedAt).length;
    if (integratedSystems < 2) {
      log("Integrate at least two systems before charting a new galaxy.");
      return;
    }
    const ruleset = galaxyById(rulesetId);
    const galaxies = state.galaxies || [];
    const depth = galaxies.length + 1;
    const newGalaxy = { id: `gal-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`, name: `${ruleset.name} ${depth}`, rulesetId: ruleset.id, depth, discoveredAt: Date.now() };
    dispatch({
      type: "UPDATE",
      patch: {
        galaxies: [...galaxies, newGalaxy],
        activeGalaxyId: newGalaxy.id,
        systems: [],
        colonies: [],
        systemEvents: [],
        integration: { eventRateMult: 1, travelMult: 1, saturationRelief: 0, signalCapBonus: 0 },
        missions: { active: [] },
      },
    });
    log(`Charted new galaxy: ${ruleset.name}. Systems reinitialized.`);
  }

  function chooseDoctrine(id) {
    if (state.doctrine) { log("Doctrine already selected."); return; }
    if ((state.prestige?.runs || 0) < 1) { log("Prestige Protocol once to unlock doctrines."); return; }
    const def = doctrineById(id);
    if (!def) return;
    dispatch({ type: "UPDATE", patch: { doctrine: def.id } });
    log(`Doctrine adopted: ${def.name}.`);
  }

  function ensureSystems() {
    const desired = targetSystemCount(state);
    if (!desired) return;
    const existing = state.systems || [];
    if (existing.length >= desired) return;
    const extra = generateSystems(desired - existing.length, existing);
    dispatch({ type: "UPDATE", patch: { systems: [...existing, ...extra] } });
    log("Signal echoes reveal nearby systems. Survey chains are now available.");
  }

  function startSystemOp(systemId) {
    const system = (state.systems || []).find((s) => s.id === systemId);
    if (!system) return;
    if (system.op) { log("Survey already running for this system."); return; }
    if (!["scan", "probe", "survey"].includes(system.stage)) { log("No survey operations available."); return; }
    const step = SYSTEM_SURVEY_STEPS[system.stage];
    if (!step) return;
    if (!canAfford(step.cost)) { log("Not enough resources for that survey operation."); return; }
    spend(step.cost);
    const speed = colonyModifiers(state).surveySpeed || 1;
    const endsAt = Date.now() + Math.floor(step.duration * speed * PACE.surveyDurationMult);
    const systems = (state.systems || []).map((s) => s.id === systemId ? { ...s, op: { type: step.id, endsAt } } : s);
    dispatch({ type: "UPDATE", patch: { systems } });
    log(`${step.name} started in ${system.name}.`);
  }

  function colonizeSystem(systemId, roleId) {
    const system = (state.systems || []).find((s) => s.id === systemId);
    if (!system) return;
    if (system.stage !== "colonize") { log("Complete the survey chain before colonizing."); return; }
    if ((state.colonies || []).some((c) => c.systemId === systemId)) { log("Colony already established here."); return; }
    const role = colonyRoleById(roleId);
    if (!canAfford(COLONY_COST)) { log("Not enough resources to establish a colony."); return; }
    spend(COLONY_COST);
    const colony = {
      id: `col-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      systemId,
      role: role.id,
      distance: system.distance,
      createdAt: Date.now(),
    };
    const systems = (state.systems || []).map((s) => s.id === systemId ? { ...s, stage: "colonized", colonizedAt: Date.now() } : s);
    dispatch({ type: "UPDATE", patch: { colonies: [...(state.colonies || []), colony], systems } });
    unlockCodex("colonies_anchor", `Colony established at ${system.name}.`);
  }

  function startIntegrationProject(systemId, projectId) {
    const system = (state.systems || []).find((s) => s.id === systemId);
    if (!system) return;
    if (system.project) { log("Integration project already running here."); return; }
    if (!(state.colonies || []).some((c) => c.systemId === systemId)) { log("Establish a colony before starting integration."); return; }
    const project = INTEGRATION_PROJECTS.find((p) => p.id === projectId);
    if (!project) return;
    const activeProjects = (state.systems || []).filter((s) => s.project).length;
    const capacity = Math.max(1, Math.floor(commandCapacity(state) / 2) + 1);
    if (activeProjects >= capacity) { log("Hub attention maxed. Finish an active integration project first."); return; }
    if (!canAfford(project.cost)) { log("Not enough resources to start this project."); return; }
    spend(project.cost);
    const systems = (state.systems || []).map((s) => s.id === systemId ? { ...s, project: { id: project.id, endsAt: Date.now() + Math.floor(project.duration * PACE.integrationDurationMult) } } : s);
    dispatch({ type: "UPDATE", patch: { systems } });
    log(`Integration project started in ${system.name}: ${project.name}.`);
  }

  function resolveSystemEvent(systemId, eventId) {
    const event = (state.systemEvents || []).find((e) => e.id === eventId && e.systemId === systemId);
    if (!event) return;
    if (!canAfford(event.cost)) { log("Not enough resources to resolve event."); return; }
    spend(event.cost);
    const systemEvents = (state.systemEvents || []).filter((e) => e.id !== eventId);
    dispatch({ type: "UPDATE", patch: { systemEvents } });
    adjustSystemStability(systemId, 4, "Stability improved after resolving the incident.");
    log(`Resolved ${event.name} at ${systemNameById(systemId)}.`);
  }

  function systemNameById(id) {
    return (state.systems || []).find((s) => s.id === id)?.name || "system";
  }

  function adjustSystemStability(systemId, delta, message) {
    const systems = (state.systems || []).map((system) => {
      if (system.id !== systemId) return system;
      const next = clamp((system.stability ?? 100) + delta, 35, 100);
      return { ...system, stability: next };
    });
    dispatch({ type: "UPDATE", patch: { systems } });
    if (message) log(message);
  }

  // Launch mission with stance/specialist; charges fuel logistics and schedules resolution.
  function startMission(bodyId, fuelBoost = 0, modeId = "balanced", specialist = "none", silent = false) {
    const fail = (message) => {
      if (!silent) log(message);
      return { ok: false, message };
    };
    if (!capabilities.missions) return fail("Expedition console locked.");
    const body = BODIES.find((b) => b.id === bodyId && isUnlocked(b));
    if (!body) return fail("Target locked.");
    const slots = 1 + (state.hubUpgrades.launch_bay || 0) + (state.tech.auto_pilots ? 1 : 0);
    if ((state.missions.active || []).length >= slots) return fail("All expedition slots busy.");
    const crewMods = crewProgramModifiers(state);
    const missionMods = colonyModifiers(state);
    const hubMods = hubUpgradeMods(state);
    let fuelCost = Math.max(5, Math.floor(body.travel / 3)) + fuelBoost;
    fuelCost = Math.ceil(fuelCost * (missionMods.fuelMult || 1) * (crewMods.fuelMult || 1) * (hubMods.fuelMult || 1));
    const isFirstMission = (state.milestones?.missionsDone || 0) === 0;
    if (isFirstMission || !state.milestones?.firstLaunch) fuelCost = 0;
    if (fuelCost > 0 && state.resources.fuel < fuelCost) return fail("Not enough fuel.");
    bumpResources({ fuel: -fuelCost });
    const mode = isMissionModeUnlocked(state, missionModeById(modeId)) ? missionModeById(modeId) : firstUnlockedMissionMode(state);
    const bonuses = baseBonuses(state, body.id);
    const hubBonus = hubMissionBonuses(state);
    const hazardBase = body.hazard - (state.tech.hazard_gear ? 0.25 : 0) - (state.tech.shielding ? 0.2 : 0) + (mode?.hazard || 0) + (specialist === "engineer" ? -0.1 : 0);
    const hazard = Math.max(0, hazardBase * (bonuses.hazard || 1) * (missionMods.hazardMult || 1) * (crewMods.hazardMult || 1) * (hubMods.hazardMult || 1));
    const lowFuelPenalty = (state.resources.fuel - fuelCost) <= 5 ? 1.2 : 1;
    const duration = Math.max(15000, ((body.travel * 1000 * (bonuses.travel || 1) * (hubBonus.travel || 1) * (missionMods.travelMult || 1) * (crewMods.travelMult || 1)) - fuelBoost * 3000 + (mode?.durationMs || 0)) * (state.tech.auto_pilots ? 0.9 : 1) * lowFuelPenalty * PACE.missionDurationMult);
    const objectiveChance = Math.min(0.55, 0.3 + (missionMods.objectiveBonus || 0) + (crewMods.objectiveBonus || 0));
    const objective = Math.random() < objectiveChance ? makeObjective(body) : null;
    const efficiency = depletionFactor(state, body.id);
    const variance = Number(randomBetween(0.9, 1.1).toFixed(2));
    const mission = { bodyId: body.id, endsAt: Date.now() + duration, hazard, mode: mode.id, specialist, objective, efficiency, variance };
    dispatch({ type: "UPDATE", patch: { missions: { active: [...(state.missions.active || []), mission] } } });
    unlockCodex("mission_ops");
    unlockCodex("local_ops");
    if (!silent) log(`Launched ${mode?.name || "expedition"} to ${body.name}. ETA ${formatDuration(duration)}.`);
    dispatch({ type: "UPDATE", patch: { milestones: { ...state.milestones, firstLaunch: true } } });
    return { ok: true };
  }

  function setAutoLaunch(payload) {
    dispatch({ type: "UPDATE", patch: { autoLaunch: payload } });
    log(payload.enabled ? `Auto-launch enabled for ${BODIES.find((b) => b.id === payload.bodyId)?.name || "target"}.` : "Auto-launch disabled.");
  }

  function processMilestones() {
    const unlocked = new Set(state.milestonesUnlocked || []);
    const codexUnlocked = new Set(state.codexUnlocked || []);
    let changed = false;
    MILESTONES.forEach((m) => {
      if (unlocked.has(m.id)) return;
      if (m.condition(state)) {
        unlocked.add(m.id);
        if (m.codexEntryId) codexUnlocked.add(m.codexEntryId);
        log(m.message || `Milestone unlocked: ${m.title}.`);
        changed = true;
      }
    });
    if (changed) {
      dispatch({ type: "UPDATE", patch: { milestonesUnlocked: Array.from(unlocked), codexUnlocked: Array.from(codexUnlocked) } });
    }
  }


  function isUnlocked(body) {
    if ((body.tier || 1) > hubRange(state)) return false;
    if (body.requireTech && !state.tech[body.requireTech]) return false;
    if (body.requireMissions && (state.milestones.missionsDone || 0) < body.requireMissions) return false;
    return state.resources.signal >= Math.ceil((body.unlock || 0) * PACE.bodyUnlockMult);
  }

  function bodyEvents(body) { return [createEvent(body)]; }

  // Build/level hub structures; scales cost by COST_EXP.hub.
  function buildHub(id) {
    const def = HUB_BUILDINGS.find((b) => b.id === id); if (!def) return;
    const status = hubBuildingUnlockStatus(state, def);
    if (!status.unlocked) { log(`Fabrication locked. ${status.reasons[0] || "Advance the Nexus tier."}`); return; }
    const level = state.hubBuildings[id] || 0;
    const cost = scaledHubCost(def.cost, level, def.costExp);
    if (!canAfford(cost)) { log("Not enough resources."); return; }
    spend(cost);
    dispatch({ type: "UPDATE", patch: { hubBuildings: { ...state.hubBuildings, [id]: (state.hubBuildings[id] || 0) + 1 } } });
    unlockCodex("hub_ops");
    log(`Constructed ${def.name}.`);
  }

  function buyHubUpgrade(id) {
    const def = HUB_UPGRADES.find((u) => u.id === id); if (!def) return;
    const status = hubUpgradeUnlockStatus(state, def);
    if (!status.unlocked) {
      log(`Upgrade locked. ${status.reasons[0] || "Advance the Nexus tier."}`);
      return;
    }
    const level = state.hubUpgrades[id] || 0;
    const cost = scaledUpgradeCost(def.cost, level);
    if (!canAfford(cost)) { log("Not enough resources."); return; }
    spend(cost);
    dispatch({ type: "UPDATE", patch: { hubUpgrades: { ...state.hubUpgrades, [id]: (state.hubUpgrades[id] || 0) + 1 } } });
    unlockCodex("hub_ops");
    log(`Upgraded ${def.name}.`);
  }

  // Build/level biome structures on the focused base; includes logistics fuel cost.
  function buildBase(id) {
    const def = biomeBuildingById(id); if (!def) return;
    const level = (state.bases[state.selectedBody]?.buildings?.[id] || 0);
    const base = ensureBaseState(state.bases[state.selectedBody], selectedBody());
    const zoneId = def.zone || "core";
    const zoneDef = BASE_ZONES.find((z) => z.id === zoneId);
    const zoneUnlocked = zoneId === "core" || base.zones?.[zoneId];
    if (!zoneUnlocked) { log(`Unlock ${zoneDef?.name || zoneId} in Workforce before building.`); return; }
    if (!requirementsMet(base, def)) { log("Requirements not met for this structure."); return; }
    const cost = withLogisticsCost(scaledCost(def.cost, level, COST_EXP.base), selectedBody());
    if (!canAfford(cost)) { log("Not enough resources (includes logistics fuel)."); return; }
    spend(cost);
    const newBase = { ...base, buildings: { ...base.buildings, [id]: (base.buildings[id] || 0) + 1 } };
    dispatch({ type: "UPDATE", patch: { bases: { ...state.bases, [state.selectedBody]: newBase } } });
    log(`Built ${def.name} on ${selectedBody().name} (logistics fuel included).`);
  }

  function setBaseFocus(focus) {
    const base = ensureBaseState(state.bases[state.selectedBody], selectedBody());
    const updated = { ...base, focus };
    dispatch({ type: "UPDATE", patch: { bases: { ...state.bases, [state.selectedBody]: updated } } });
    log(`Outpost focus set to ${focus}.`);
  }

  function refreshEvents() {
    const base = ensureBaseState(state.bases[state.selectedBody], selectedBody());
    const updated = { ...base, events: bodyEvents(selectedBody()) };
    dispatch({ type: "UPDATE", patch: { bases: { ...state.bases, [state.selectedBody]: updated } } });
    log("Local events refreshed.");
  }

  function availablePopulationForBase(bodyId) {
    const populationTotal = Math.max(state.population?.total || 0, state.workers.total || 0);
    const assignedBase = totalBaseWorkers(state);
    const base = ensureBaseState(state.bases[bodyId], bodyById(bodyId));
    const currentTotal = baseWorkerTotals(base).total;
    return Math.max(0, populationTotal - state.workers.total - (assignedBase - currentTotal));
  }

  function assignBaseWorkers(bodyId, role, delta) {
    const base = ensureBaseState(state.bases[bodyId], bodyById(bodyId));
    const assigned = { ...base.workers.assigned };
    const current = assigned[role] || 0;
    const next = current + delta;
    if (next < 0) return;
    assigned[role] = next;
    const newTotal = Object.values(assigned).reduce((sum, v) => sum + (v || 0), 0);
    const cap = baseWorkerCap(base);
    if (newTotal > cap) {
      log("Workforce cap reached. Build Maintenance Bays to expand.");
      return;
    }
    const available = availablePopulationForBase(bodyId);
    const currentTotal = baseWorkerTotals(base).total;
    if (delta > 0 && newTotal > currentTotal + available) {
      log("No available population to assign.");
      return;
    }
    const workers = { total: newTotal, assigned };
    const updated = { ...base, workers };
    dispatch({ type: "UPDATE", patch: { bases: { ...state.bases, [bodyId]: updated } } });
  }

  function setBaseWorkerPreset(bodyId, preset) {
    const base = ensureBaseState(state.bases[bodyId], bodyById(bodyId));
    const available = availablePopulationForBase(bodyId);
    const cap = baseWorkerCap(base);
    const currentTotal = baseWorkerTotals(base).total;
    const normalizedPreset = preset === "max" ? "balanced" : preset;
    let target = normalizedPreset === "clear" ? 0 : Math.min(cap, currentTotal + available);
    if (target < 0) target = 0;
    const weights = {
      balanced: { production: 0.5, maintenance: 0.3, research: 0.2 },
      production: { production: 0.7, maintenance: 0.2, research: 0.1 },
      maintenance: { production: 0.4, maintenance: 0.5, research: 0.1 },
      research: { production: 0.3, maintenance: 0.2, research: 0.5 },
    };
    let assigned = { production: 0, maintenance: 0, research: 0 };
    if (normalizedPreset !== "clear") {
      const weight = weights[normalizedPreset] || weights.balanced;
      assigned = {
        production: Math.floor(target * weight.production),
        maintenance: Math.floor(target * weight.maintenance),
        research: Math.floor(target * weight.research),
      };
      let remainder = target - (assigned.production + assigned.maintenance + assigned.research);
      const order = ["production", "maintenance", "research"];
      let idx = 0;
      while (remainder > 0) {
        assigned[order[idx % order.length]] += 1;
        remainder -= 1;
        idx += 1;
      }
    }
    const workers = { total: target, assigned };
    const updated = { ...base, workers };
    dispatch({ type: "UPDATE", patch: { bases: { ...state.bases, [bodyId]: updated } } });
    log(normalizedPreset === "clear" ? "Workers recalled to hub pool." : "Workforce protocol applied.");
  }

  function unlockBaseZone(bodyId, zoneId) {
    const zone = BASE_ZONES.find((z) => z.id === zoneId);
    if (!zone || zoneId === "core") return;
    const base = ensureBaseState(state.bases[bodyId], bodyById(bodyId));
    if (base.zones?.[zoneId]) { log(`${zone.name} already unlocked.`); return; }
    if ((state.resources.habitat || 0) < zone.cost) { log("Not enough habitat to unlock this zone."); return; }
    spend({ habitat: zone.cost });
    const zones = { ...(base.zones || { core: true }), [zoneId]: true };
    const updated = { ...base, zones };
    dispatch({ type: "UPDATE", patch: { bases: { ...state.bases, [bodyId]: updated } } });
    log(`${zone.name} unlocked at ${bodyById(bodyId).name}.`);
  }

  function selectedBody() { return BODIES.find((b) => b.id === state.selectedBody) || BODIES[0]; }

  function canAfford(cost) { return Object.entries(cost).every(([k, v]) => (state.resources[k] || 0) >= v); }

  // Spend helper; respects resource floors and updates state in one place.
  function spend(cost) {
    const delta = Object.fromEntries(Object.entries(cost).map(([k, v]) => [k, -v]));
    dispatch({ type: "UPDATE", patch: { resources: applyResourceDelta(state.resources, delta) } });
  }

  // Research tech; enforces prereqs and reveals gated targets.
  function buyTech(id) {
    const def = TECH.find((t) => t.id === id); if (!def || state.tech[id]) return;
    if (!hasPrereqs(state, def)) { log("Complete prerequisite tech first."); return; }
    const unlockSignal = Math.ceil(def.unlock * PACE.techUnlockMult);
    const cost = scaleCost(def.cost, PACE.techCostMult);
    if (state.resources.signal < unlockSignal) { log("Need more signal to access this tech."); return; }
    if (!canAfford(cost)) { log("Not enough resources."); return; }
    spend(cost); dispatch({ type: "UPDATE", patch: { tech: { ...state.tech, [id]: 1 } } });
    unlockCodex("tech_ops");
    log(`Tech unlocked: ${def.name}.`);
  }

  // Prestige Protocol/reset with boost based on total value.
  function ascend() {
    if (!(state.milestonesUnlocked || []).includes("M4_PRESTIGE_UNLOCK")) {
      log("Prestige Protocol is locked. Reach galaxy depth 2 and integrate systems first.");
      return;
    }
    const totalValue = (state.resources.signal || 0) + (state.resources.metal || 0) + (state.resources.research || 0) * 5 + (state.resources.rare || 0) * 20;
    const points = Math.max(1, Math.floor(totalValue / 5000));
    const prestige = { points: (state.prestige?.points || 0) + points, runs: (state.prestige?.runs || 0) + 1, boost: 1 + ((state.prestige?.points || 0) + points) * 0.02 };
    const fragmentStats = fragmentProgress(state);
    const fragmentMilestones = fragmentMilestoneIds(fragmentStats.recovered);
    const fragmentCodex = FRAGMENT_THRESHOLDS.filter((t) => fragmentStats.percent >= t.percent).map((t) => t.codexEntryId).filter(Boolean);
    if (fragmentStats.recovered > 0) fragmentCodex.push("veil_premise", "veil_fragments");
    const resetState = {
      ...initialState,
      prestige,
      fragments: { ...(state.fragments || { recovered: 0 }) },
      milestonesUnlocked: fragmentMilestones,
      codexUnlocked: Array.from(new Set(fragmentCodex)),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(resetState));
    dispatch({ type: "LOAD", payload: resetState });
    log(`Ascended for ${points} prestige. Global production boost now ${Math.round((prestige.boost - 1) * 100)}%.`);
  }

  // Export obfuscated account blob for cross-browser transfer.
  function exportProfile() {
    try {
      const raw = JSON.stringify(state);
      const hash = hashStr(raw);
      const salted = xorString(raw, "signal-salt");
      const encoded = btoa(salted);
      const bundle = `${hash}.${encoded}`;
      const copyPromise = navigator.clipboard?.writeText ? navigator.clipboard.writeText(bundle) : Promise.reject();
      copyPromise
        .then(() => {
          log("Account exported. Copied to clipboard; keep the string safe.");
          window.alert("Export copied to clipboard. Keep it safe.");
        })
        .catch(() => {
          log("Account exported. Copy the shown string to import elsewhere.");
          window.prompt("Copy your export string", bundle);
        });
    } catch (e) {
      console.error(e);
      alert("Failed to export account.");
    }
  }

  // Import account blob (base64+xor) and overwrite current state.
  function importProfile() {
    const data = window.prompt("Paste exported account string");
    if (!data) return;
    try {
      const [hash, payload] = data.trim().split(".");
      if (!hash || !payload) throw new Error("Malformed bundle");
      const salted = atob(payload);
      const raw = xorString(salted, "signal-salt");
      if (hashStr(raw) !== hash) throw new Error("Checksum mismatch");
      const parsed = JSON.parse(raw);
      dispatch({ type: "LOAD", payload: { ...initialState, ...parsed } });
      log("Account imported.");
      alert("Account import successful.");
    } catch (e) {
      console.error(e);
      alert("Import failed: invalid string.");
    }
  }

  function rollRecruits(force) {
    const now = Date.now();
    if (!force && now - state.lastRecruitRoll < 45000 && state.recruits.length) return;
    const candidates = Array.from({ length: 3 }, (_, i) => makeCandidate(i));
    dispatch({ type: "SET_RECRUITS", recruits: candidates });
  }

  function maxRecruitTier(stateObj) {
    const unlocked = new Set(stateObj.milestonesUnlocked || []);
    if (unlocked.has("M3_INTEGRATION_UNLOCK")) return 3;
    if (unlocked.has("M2_SYSTEMS_DISCOVERED")) return 2;
    return 1;
  }

  function isCrewProgramUnlocked(stateObj, program) {
    const unlock = program?.unlock || {};
    if (unlock.milestone && !(stateObj.milestonesUnlocked || []).includes(unlock.milestone)) return false;
    if (unlock.tech && !stateObj.tech?.[unlock.tech]) return false;
    return true;
  }

  function buyCrewProgram(id) {
    const def = CREW_PROGRAMS.find((p) => p.id === id);
    if (!def) return;
    if (!isCrewProgramUnlocked(state, def)) { log("Training program is still locked."); return; }
    const level = state.crewPrograms?.[id] || 0;
    const cost = scaledCost(def.cost, level, COST_EXP.crew);
    if (!canAfford(cost)) { log("Not enough resources for training."); return; }
    spend(cost);
    dispatch({ type: "UPDATE", patch: { crewPrograms: { ...state.crewPrograms, [id]: level + 1 } } });
    log(`Crew program advanced: ${def.name} Lv ${level + 1}.`);
  }

  function resolveEvent(bodyId, eventId) {
    const base = ensureBaseState(state.bases[bodyId], bodyById(bodyId));
    const ev = (base.events || []).find((e) => e.id === eventId);
    if (!ev) return;
    if (ev.requiresRole && (state.workers.assigned[ev.requiresRole] || 0) <= 0) { log(`Need an active ${ev.requiresRole} to resolve.`); return; }
    if (ev.cost && !canAfford(ev.cost)) { log("Not enough resources to resolve event."); return; }
    if (ev.cost) spend(ev.cost);
    const events = (base.events || []).filter((e) => e.id !== eventId);
    const updated = { ...base, events };
    dispatch({ type: "UPDATE", patch: { bases: { ...state.bases, [bodyId]: updated } } });
    log(`Resolved event: ${ev.name}.`);
  }

  function runBaseOp(bodyId, opId) {
    const body = BODIES.find((b) => b.id === bodyId); if (!body) return;
    const ops = BASE_OPS[body.type] || [];
    const op = ops.find((o) => o.id === opId); if (!op) return;
    const base = ensureBaseState(state.bases[bodyId], bodyById(bodyId));
    if (Date.now() < (base.opsReadyAt || 0)) { log("Base ops cooling down."); return; }
    if (!canAfford(op.cost)) { log("Not enough resources for this op."); return; }
    spend(op.cost);
    bumpResources(op.reward);
    const workforce = baseWorkforceStats(base);
    const cooldownMult = clamp(workforce.opsCooldownMult || 1, 0.5, 1);
    const updated = { ...base, opsReadyAt: Date.now() + op.cooldown * cooldownMult };
    dispatch({ type: "UPDATE", patch: { bases: { ...state.bases, [bodyId]: updated } } });
    log(`Ran ${op.name} on ${body.name}.`);
  }

  function makeCandidate(seed) {
    const roles = ["miner","botanist","engineer"];
    const role = roles[Math.floor(Math.random() * roles.length)];
    const tierCap = maxRecruitTier(state);
    const tier = 1 + Math.floor(Math.random() * tierCap);
    const bonus = tier === 1 ? 0.05 : tier === 2 ? 0.12 : 0.2;
    const names = ["Nyx","Orion","Vega","Rin","Tala","Kade","Mira","Ash"];
    const name = names[Math.floor(Math.random() * names.length)];
    return { id: `${Date.now()}-${seed}-${Math.random().toString(16).slice(2,6)}`, name, role, trait: `+${Math.round(bonus * 100)}% to ${role}`, bonus, cost: { food: 4 * tier, metal: 12 * tier } };
  }

  function hire(id) {
    const cand = state.recruits.find((c) => c.id === id); if (!cand) return;
    const populationTotal = Math.max(state.population?.total || 0, state.workers.total || 0);
    if (populationTotal <= state.workers.total) { log("Need population surplus to train a specialist."); return; }
    if (state.resources.habitat <= state.workers.total) { log("Need spare habitat to house new crew."); return; }
    if (!canAfford(cand.cost)) { log("Not enough resources to hire."); return; }
    spend(cand.cost);
    const workers = { ...state.workers, total: state.workers.total + 1, assigned: { ...state.workers.assigned, [cand.role]: (state.workers.assigned[cand.role] || 0) + 1 }, bonus: { ...state.workers.bonus, [cand.role]: (state.workers.bonus[cand.role] || 0) + cand.bonus } };
    const crewRoster = [...(state.crewRoster || []), { id: cand.id, name: cand.name, role: cand.role, trait: cand.trait, bonus: cand.bonus, focus: "production", fatigue: 0, temp: false, hiredAt: Date.now() }];
    const recruits = state.recruits.filter((c) => c.id !== id);
    dispatch({ type: "UPDATE", patch: { workers, recruits, crewRoster } });
    log(`Hired ${cand.name} (${cand.role}).`);
  }

  function changeCrew(role, delta) {
    const current = state.workers.assigned[role] || 0; const target = current + delta; if (target < 0) return;
    const totalAssigned = Object.values(state.workers.assigned).reduce((a, b) => a + b, 0); if (delta > 0 && totalAssigned >= state.workers.total) return;
    const assigned = { ...state.workers.assigned, [role]: target };
    dispatch({ type: "UPDATE", patch: { workers: { ...state.workers, assigned } } });
  }

  function setCrewFocus(id, focus) {
    const roster = (state.crewRoster || []).map((crew) => crew.id === id ? { ...crew, focus } : crew);
    dispatch({ type: "UPDATE", patch: { crewRoster: roster } });
  }

  function setAllFocus(focus) {
    const roster = (state.crewRoster || []).map((crew) => ({ ...crew, focus }));
    dispatch({ type: "UPDATE", patch: { crewRoster: roster } });
    log(`Crew focus shifted to ${focus}.`);
  }

  function quickAssign() {
    const total = state.workers.total || 0;
    const base = Math.floor(total / 3);
    const remainder = total % 3;
    const assigned = { miner: base, botanist: base, engineer: base };
    if (remainder > 0) assigned.miner += 1;
    if (remainder > 1) assigned.engineer += 1;
    dispatch({ type: "UPDATE", patch: { workers: { ...state.workers, assigned } } });
    log("Crew assignments balanced.");
  }

  function toggleAutoBalance(enabled) {
    const autoBalance = { ...(state.autoBalance || { enabled: true, mode: "balanced" }), enabled };
    dispatch({ type: "UPDATE", patch: { autoBalance } });
  }

  function setPriority(priority) {
    dispatch({ type: "UPDATE", patch: { priority: normalizePriority(priority) } });
  }

  function rollContracts(force) {
    const now = Date.now();
    if (!force && now < (state.nextContractAt || 0) && (state.crewContracts || []).length) return;
    const pool = [...CREW_CONTRACTS].sort(() => Math.random() - 0.5).slice(0, 2);
    const offers = pool.map((c) => ({ ...c, offerId: `${c.id}-${now}-${Math.random().toString(16).slice(2, 6)}` }));
    const refreshMs = Math.floor(CONTRACT_REFRESH_MS * (crewTrainingTier(state) >= 3 ? 0.7 : 1));
    dispatch({ type: "UPDATE", patch: { crewContracts: offers, nextContractAt: now + refreshMs } });
    log("New specialist contracts available.");
  }

  function acceptContract(offerId) {
    const offer = (state.crewContracts || []).find((c) => c.offerId === offerId);
    if (!offer) return;
    const populationTotal = Math.max(state.population?.total || 0, state.workers.total || 0);
    if (populationTotal <= state.workers.total) { log("Need population surplus to onboard a specialist."); return; }
    if (state.resources.habitat <= state.workers.total) { log("Need spare habitat for contract crew."); return; }
    if (!canAfford(offer.cost)) { log("Not enough resources for this contract."); return; }
    spend(offer.cost);
    const contract = {
      id: `contract-${offer.id}-${Date.now()}`,
      contractId: offer.id,
      name: offer.name,
      role: offer.role,
      trait: offer.trait,
      perk: offer.perk,
      bonus: offer.bonus,
      mods: offer.mods,
      focus: "production",
      fatigue: 0,
      temp: true,
      hiredAt: Date.now(),
      expiresAt: Date.now() + offer.durationMs,
    };
    const crewRoster = [...(state.crewRoster || []), contract];
    const workers = {
      ...state.workers,
      total: state.workers.total + 1,
      assigned: { ...state.workers.assigned, [offer.role]: (state.workers.assigned[offer.role] || 0) + 1 },
      bonus: { ...state.workers.bonus, [offer.role]: (state.workers.bonus[offer.role] || 0) + offer.bonus },
    };
    const crewContracts = (state.crewContracts || []).filter((c) => c.offerId !== offerId);
    dispatch({ type: "UPDATE", patch: { crewRoster, crewContracts, workers } });
    log(`Contract accepted: ${offer.name}.`);
  }

  function format(n) {
    if (!Number.isFinite(n)) return "0";
    const abs = Math.abs(n); if (abs < 1000) return n.toFixed(0);
    const units = ["K","M","B","T"]; let u = -1; let val = abs;
    while (val >= 1000 && u < units.length - 1) { val /= 1000; u++; }
    return `${n < 0 ? "-" : ""}${val.toFixed(val < 10 ? 2 : 1)}${units[u]}`;
  }

  function formatDuration(ms) { const sec = Math.max(0, Math.ceil(ms / 1000)); const m = Math.floor(sec / 60); const s = sec % 60; return m > 0 ? `${m}m ${s}s` : `${s}s`; }
function biomeBuildingById(id) { return Object.values(BIOME_BUILDINGS).flat().find((b) => b.id === id); }
  const needsProfileName = !state.profile?.name?.trim();
  const saveProfileName = () => {
    const name = profileNameDraft.trim();
    if (!name) return;
    dispatch({ type: "UPDATE", patch: { profile: { ...state.profile, name } } });
    log(`Callsign set to ${name}.`);
  };
  return (
    <div className="min-h-screen pb-16">
      <AnimatePresence>
        {needsProfileName && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950 p-5 shadow-xl">
              <div className="text-lg font-semibold">Choose a callsign</div>
              <div className="text-sm text-muted mt-1">Anonymous accounts need a callsign before joining multiplayer features.</div>
              <div className="mt-3 space-y-2">
                <input
                  className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
                  placeholder="Enter callsign"
                  value={profileNameDraft}
                  onChange={(e) => setProfileNameDraft(e.target.value)}
                />
                <button className="btn w-full" onClick={saveProfileName} disabled={!profileNameDraft.trim()}>
                  Commit callsign
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="w-full max-w-screen-2xl mx-auto px-3 sm:px-5 lg:px-8 pt-6 flex flex-col gap-4">
        <header className="panel flex flex-col gap-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="inline-flex px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs tracking-[0.1em] font-semibold">{GAME_TITLE}</div>
              <div className="text-muted text-sm mt-1">Scan, settle, and build outposts across the void.</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden sm:block text-xs text-muted">Callsign: {state.profile?.name || "unset"}</div>
              <button
                className={`btn ${state.tab === "profile" ? "btn-primary" : ""}`}
                onClick={() => dispatch({ type: "SET_TAB", tab: "profile" })}
              >
                Account
              </button>
            </div>
          </div>
          <ResourceBar resources={state.resources} rates={state.rates} format={format} />
        </header>
        <div className="flex flex-col md:flex-row gap-4">
          <nav className="md:w-48 w-full flex md:flex-col flex-wrap gap-2 overflow-x-auto pb-1">
            {navTabs.map((tab) => (
              <button
                key={tab.id}
                className={`tab w-full md:w-full text-left whitespace-nowrap ${state.tab === tab.id ? 'active' : ''}`}
                onClick={() => dispatch({ type: 'SET_TAB', tab: tab.id })}
                onMouseEnter={() => viewPreloaders[tab.id]?.()}
                onFocus={() => viewPreloaders[tab.id]?.()}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          <main className="flex-1 flex flex-col gap-3">
            {state.tab === 'hub' && (
              <HubView
                state={state}
                buildHub={buildHub}
                buyHubUpgrade={buyHubUpgrade}
                crewBonusText={crewBonusText}
                ascend={ascend}
                format={format}
                supabaseReady={supabaseReady}
                toggleAutoBalance={toggleAutoBalance}
                setPriority={setPriority}
                buyTech={buyTech}
              />
            )}
            {state.tab === 'expeditions' && (
              <Suspense fallback={lazyFallback}>
                <ExpeditionsView
                  state={state}
                  startMission={startMission}
                  setAutoLaunch={setAutoLaunch}
                  setSelected={(id) => dispatch({ type: 'SET_SELECTED_BODY', id })}
                  format={format}
                  missionModeById={missionModeById}
                  missionYield={missionYield}
                  formatDuration={formatDuration}
                  bodies={BODIES}
                  missionModes={MISSION_MODES}
                  bodyUnlockMult={PACE.bodyUnlockMult}
                  isUnlockedUI={isUnlockedUI}
                  hubRange={hubRange(state)}
                  depletionFactor={(id) => depletionFactor(state, id)}
                  missionMods={missionMods}
                  baseBonuses={(id) => baseBonuses(state, id)}
                  missionDurationMult={PACE.missionDurationMult}
                  biomeBuildings={BIOME_BUILDINGS}
                  baseOps={BASE_OPS}
                  buildBase={buildBase}
                  setBaseFocus={setBaseFocus}
                  refreshEvents={refreshEvents}
                  resolveEvent={resolveEvent}
                  runBaseOp={runBaseOp}
                  crewBonusText={crewBonusText}
                  bodyEvents={bodyEvents}
                  scaledCost={scaledCost}
                  withLogisticsCost={withLogisticsCost}
                  costText={costText}
                  canAffordUI={canAffordUI}
                  costExpBase={COST_EXP.base}
                  requirementsMet={requirementsMet}
                  baseTraits={currentTraits}
                  maintenanceStats={currentMaintenance}
                  availablePopulation={availablePopulation}
                  assignBaseWorkers={assignBaseWorkers}
                  setBaseWorkerPreset={setBaseWorkerPreset}
                  unlockBaseZone={unlockBaseZone}
                  baseZones={BASE_ZONES}
                />
              </Suspense>
            )}
            {state.tab === 'crew' && (
              <Suspense fallback={lazyFallback}>
                <CrewView
                  state={state}
                  hire={hire}
                  rollRecruits={() => rollRecruits(true)}
                  changeCrew={changeCrew}
                  format={format}
                  costText={costText}
                  crewProgramDefs={CREW_PROGRAMS}
                  buyCrewProgram={buyCrewProgram}
                  isCrewProgramUnlocked={isCrewProgramUnlocked}
                  scaledCost={scaledCost}
                  canAffordUI={canAffordUI}
                  costExpCrew={COST_EXP.crew}
                  milestones={MILESTONES}
                  techDefs={TECH}
                  setCrewFocus={setCrewFocus}
                  setAllFocus={setAllFocus}
                  quickAssign={quickAssign}
                  crewContracts={state.crewContracts || []}
                  acceptContract={acceptContract}
                  rollContracts={() => rollContracts(true)}
                  formatDuration={formatDuration}
                  nextContractAt={state.nextContractAt || 0}
                />
              </Suspense>
            )}
            {state.tab === 'tech' && (
              <Suspense fallback={lazyFallback}>
                <TechView
                  state={state}
                  buyTech={buyTech}
                  format={format}
                  techDefs={TECH}
                  hasPrereqs={hasPrereqs}
                  canAffordUI={canAffordUI}
                  costText={costText}
                  techUnlockMult={PACE.techUnlockMult}
                  techCostMult={PACE.techCostMult}
                />
              </Suspense>
            )}
            {state.tab === 'systems' && (
              <SystemsView
                state={state}
                capabilities={capabilities}
                format={format}
                formatDuration={formatDuration}
                startSystemOp={startSystemOp}
                colonizeSystem={colonizeSystem}
                startIntegrationProject={startIntegrationProject}
                resolveSystemEvent={resolveSystemEvent}
                chartNewGalaxy={chartNewGalaxy}
                colonyRoles={COLONY_ROLES}
              />
            )}
            {state.tab === 'faction' && (
              <Suspense fallback={lazyFallback}>
                <FactionView
                  profileName={state.profile?.name}
                  currentUserId={supabaseUserId}
                  supabaseReady={supabaseReady}
                  factions={factionState.factions}
                  projects={factionState.projects}
                  buildings={factionState.buildings}
                  buildingsError={factionState.buildingsError}
                  activity={factionState.activity}
                  donations={factionState.donations}
                  chat={factionState.chat}
                  activityError={factionState.activityError}
                  donationsError={factionState.donationsError}
                  chatError={factionState.chatError}
                  membership={factionState.membership}
                  loading={factionState.loading}
                  error={factionState.error}
                  leaderboard={factionState.leaderboard}
                  leaderboardError={factionState.leaderboardError}
                  onJoin={joinFaction}
                  onDonate={donateFaction}
                  onDonateBuilding={donateFactionBuilding}
                  onSendChat={sendFactionChat}
                  resources={state.resources}
                  fragmentStatus={fragmentProgress(state)}
                  format={format}
                />
              </Suspense>
            )}
            {state.tab === 'codex' && <CodexView state={state} />}
            {state.tab === 'wiki' && <WikiView />}
            {state.tab === 'log' && <LogView log={state.log} />}
            {state.tab === 'profile' && (
              <AccountView
                state={state}
                exportProfile={exportProfile}
                importProfile={importProfile}
                compact={compact}
                setCompact={setCompact}
                manualSave={manualSave}
                lastSaved={lastSaved}
                chooseDoctrine={chooseDoctrine}
                setProfileName={(name) => dispatch({ type: "UPDATE", patch: { profile: { ...state.profile, name } } })}
                supabaseReady={supabaseReady}
              />
            )}
          </main>
        </div>
      </div>
      <StarterTour tourStep={state.tourStep} seen={state.tourSeen} onStep={(step, seen) => dispatch({ type: 'TOUR_STEP', step, seen })} />
    </div>
  );
}

function ResourceBar({ resources, rates, format }) {
  const entries = [
    { label: 'Signal', key: 'signal' }, { label: 'Research', key: 'research' }, { label: 'Metal', key: 'metal' },
    { label: 'Organics', key: 'organics' }, { label: 'Fuel', key: 'fuel' }, { label: 'Power', key: 'power' },
    { label: 'Food', key: 'food' }, { label: 'Habitat', key: 'habitat' }, { label: 'Rare', key: 'rare' },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
      {entries.map((e) => (
        <div key={e.key} className="stat-box">
          <span className="text-muted text-xs">{e.label}</span>
          <strong>{format(resources[e.key] || 0)}</strong>
          <span className="text-[11px] text-muted">{`${format(rates[e.key] || 0)}/tick`}</span>
        </div>
      ))}
    </div>
  );
}

function AccountView({ state, exportProfile, importProfile, compact, setCompact, manualSave, lastSaved, chooseDoctrine, setProfileName, supabaseReady }) {
  const doctrine = doctrineById(state.doctrine);
  const [nameInput, setNameInput] = useState(state.profile?.name || "");
  useEffect(() => { setNameInput(state.profile?.name || ""); }, [state.profile?.name]);
  const saveName = () => {
    const name = nameInput.trim();
    if (!name) return;
    setProfileName(name);
  };
  return (
    <section className="panel space-y-3">
      <div className="text-lg font-semibold">Command Account</div>
      <div className="grid md:grid-cols-3 gap-3">
        <div className="card space-y-2">
          <div className="font-semibold">Callsign</div>
          <div className="text-sm text-muted">Required to access the relay network and leaderboards.</div>
          <input
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
            placeholder="Enter callsign"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
          />
          <button className="btn" onClick={saveName} disabled={!nameInput.trim()}>Commit callsign</button>
        </div>
        <div className="card space-y-2">
          <div className="font-semibold">Multiplayer</div>
          <div className="text-sm text-muted">Relay link: {supabaseReady ? "Online" : "Offline"}</div>
          <div className="text-xs text-muted">Callsigned pilots can join factions and contribute to frontier projects.</div>
        </div>
        <div className="card space-y-2">
          <div className="font-semibold">Strategic Doctrine</div>
          <div className="text-sm text-muted">Choose a doctrine after your first prestige to define long-term strategy.</div>
          {state.prestige?.runs > 0 && !doctrine && (
            <div className="space-y-2">
              {DOCTRINES.map((doc) => (
                <div key={doc.id} className="row-item">
                  <div className="row-details">
                    <div className="row-title">{doc.name}</div>
                    <div className="row-meta">{doc.desc}</div>
                  </div>
                  <button className="btn" onClick={() => chooseDoctrine(doc.id)}>Enact</button>
                </div>
              ))}
            </div>
          )}
          {doctrine && (
            <div className="text-sm text-muted">Active doctrine: {doctrine.name}</div>
          )}
          {!state.prestige?.runs && (
            <div className="text-xs text-muted">Prestige Protocol once to unlock doctrine selection.</div>
          )}
        </div>
        <div className="card space-y-2">
        <div className="font-semibold">Account Vault</div>
          <div className="text-sm text-muted">Accounts cache locally (storage + cookie). Export/import to move between browsers.</div>
          <div className="flex flex-wrap gap-2">
            <button className="btn" onClick={exportProfile}>Export Account</button>
            <button className="btn" onClick={importProfile}>Import Account</button>
            <button className="btn" onClick={manualSave}>Sync now</button>
          </div>
          <div className="text-xs text-muted">Export copies a sealed code string; import pastes it here. Last sync: {lastSaved ? new Date(lastSaved).toLocaleTimeString() : "never"}</div>
        </div>
        <div className="card space-y-2">
          <div className="font-semibold">Interface</div>
          <div className="text-sm text-muted">Toggle compact mode to tighten the HUD and reduce padding.</div>
          <label className="row">
            <span className="text-sm">Compact mode</span>
            <input type="checkbox" checked={compact} onChange={(e) => setCompact(e.target.checked)} />
          </label>
        </div>
      </div>
    </section>
  );
}

function HubView({ state, buildHub, buyHubUpgrade, crewBonusText, ascend, format, supabaseReady, toggleAutoBalance, setPriority, buyTech }) {
  const [pane, setPane] = useState("build");
  const initialCategory = (state.resources.power || 0) <= 0 && !(state.hubBuildings?.reactor) ? "power" : "all";
  const [buildCategory, setBuildCategory] = useState(initialCategory);
  const [buildTier, setBuildTier] = useState("all");
  const [buildStage, setBuildStage] = useState("all");
  const [buildSort, setBuildSort] = useState("tier");
  const [buildQuery, setBuildQuery] = useState("");
  const command = commandUsage(state);
  const hubLevels = hubTotalLevel(state);
  const hubTier = Math.floor(hubLevels / HUB_TIER_STEP);
  const hubMods = hubUpgradeMods(state);
  const hubTravel = hubMissionBonuses(state).travel || 1;
  const fragmentStatus = fragmentProgress(state);
  const fragmentPercent = Math.round(fragmentStatus.percent * 100);
  const fragmentNext = fragmentStatus.next;
  const missionSlots = 1 + (state.hubUpgrades.launch_bay || 0) + (state.tech.auto_pilots ? 1 : 0);
  const cargoBoost = (state.hubUpgrades.drone_bay || 0) * 8;
  const researchBoost = (state.hubUpgrades.survey_lab || 0) * 8;
  const hazardShield = Math.round((1 - (hubMods.hazardMult || 1)) * 100);
  const fuelSavings = Math.round((1 - (hubMods.fuelMult || 1)) * 100);
  const saturation = signalSaturation(state);
  const signalFill = clamp((state.resources.signal || 0) / Math.max(1, saturation.cap), 0, 1);
  const commandFill = clamp((command.used || 0) / Math.max(1, command.capacity || 1), 0, 1);
  const moraleFill = clamp(state.workers.satisfaction || 0, 0, 1);
  const canPrestige = (state.milestonesUnlocked || []).includes("M4_PRESTIGE_UNLOCK");
  const unlockHints = unlockHintText(state, supabaseReady);
  const priorityActions = bottleneckGuidance(state, state.rates);
  const intelCount = (priorityActions.length ? 1 : 0) + (unlockHints.length ? 1 : 0);
  const populationTotal = Math.max(state.population?.total || 0, state.workers.total || 0);
  const assignedBaseWorkers = totalBaseWorkers(state);
  const availablePopulation = Math.max(0, populationTotal - state.workers.total - assignedBaseWorkers);
  const populationCap = Math.max(populationTotal, Math.floor(state.resources.habitat || 0));
  const populationUpkeep = populationFoodUpkeep(populationTotal);
  const foodInfo = populationFoodState(state.resources.food || 0, state.rates.food || 0, populationUpkeep);
  const foodStateLabel = {
    abundant: "Abundant",
    stable: "Stable",
    low: "Low",
    negative: "Negative",
  }[foodInfo.state] || "Stable";
  const foodMinutes = Number.isFinite(foodInfo.minutes) ? Math.max(0, Math.round(foodInfo.minutes)) : null;
  let growthLabel = "At capacity";
  if (foodInfo.state === "negative") growthLabel = "Declining (-1/60s)";
  else if (populationTotal < populationCap) {
    const mult = foodInfo.state === "abundant" ? 1.5 : foodInfo.state === "low" ? 0.5 : 1;
    const slow = populationCap > 0 && populationTotal / populationCap >= 0.9;
    const base = 30;
    const seconds = Math.round(base / (mult * (slow ? 0.5 : 1)));
    growthLabel = `Growth +1/${seconds}s`;
  }
  const buildCategories = [
    { id: "all", label: "All" },
    { id: "materials", label: "Materials" },
    { id: "power", label: "Power" },
    { id: "fuel", label: "Fuel" },
    { id: "life", label: "Life Support" },
    { id: "signal", label: "Signal" },
    { id: "logistics", label: "Logistics" },
  ];
  const tierList = Array.from(new Set(HUB_BUILDINGS.map((b) => b.tier || 0))).sort((a, b) => a - b);
  const nextTier = tierList.find((tier) => !hubTierUnlockStatus(state, tier).unlocked);
  const visibleTiers = new Set([...tierList.filter((tier) => hubTierUnlockStatus(state, tier).unlocked), nextTier].filter((t) => t !== undefined));
  const visibleBuildings = HUB_BUILDINGS.filter((b) => visibleTiers.has(b.tier || 0));
  const fuelBuildOptions = visibleBuildings.filter((b) => (b.prod?.fuel || 0) > 0);
  const buildOptions = buildCategory === "all"
    ? visibleBuildings
    : buildCategory === "fuel"
      ? fuelBuildOptions
      : visibleBuildings.filter((b) => b.category === buildCategory);
  const nextTierStatus = nextTier !== undefined ? hubTierUnlockStatus(state, nextTier) : null;
  const fuelRate = state.rates.fuel || 0;
  const metalRate = state.rates.metal || 0;
  const organicsRate = state.rates.organics || 0;
  const foodRate = state.rates.food || 0;
  const habitatRate = state.rates.habitat || 0;
  const hubFuelCons = HUB_BUILDINGS.reduce((sum, b) => sum + (state.hubBuildings?.[b.id] || 0) * (b.cons?.fuel || 0), 0);
  const alertTicks = Math.max(1, Math.round((2 * 60 * 1000) / TICK_MS));
  const shouldBlink = (reserve, rate) => rate < 0 && (reserve || 0) <= Math.abs(rate) * alertTicks;
  const lowPower = shouldBlink(state.resources.power, state.rates.power || 0);
  const lowFood = shouldBlink(state.resources.food, state.rates.food || 0);
  const lowFuel = shouldBlink(state.resources.fuel, state.rates.fuel || 0);
  const lowMetal = shouldBlink(state.resources.metal, state.rates.metal || 0);
  const lowOrganics = shouldBlink(state.resources.organics, state.rates.organics || 0);
  const lowHabitat = shouldBlink(state.resources.habitat, state.rates.habitat || 0);
  const lowLife = lowFood || lowHabitat;
  const lowMaterials = lowMetal || lowOrganics;
  const buildStageOptions = [
    { id: "all", label: "All" },
    { id: "available", label: "Available" },
    { id: "locked", label: "Locked" },
    { id: "next", label: "Next tier" },
  ];
  const buildSortOptions = [
    { id: "tier", label: "Tier" },
    { id: "name", label: "Name" },
    { id: "cost", label: "Cost" },
  ];
  const fuelTech = TECH.find((tech) => tech.id === "fuel_synth");
  const fuelTechCost = fuelTech ? scaleCost(fuelTech.cost, PACE.techCostMult) : null;
  const fuelTechSignal = fuelTech ? Math.ceil(fuelTech.unlock * PACE.techUnlockMult) : 0;
  const fuelTechUnlocked = !fuelTech || state.tech.fuel_synth;
  const canResearchFuel = fuelTechCost ? canAffordUI(state.resources, fuelTechCost) && (state.resources.signal || 0) >= fuelTechSignal : false;
  const hubTabs = [
    { id: "build", label: "Fabrication" },
    { id: "upgrades", label: "Upgrades" },
    { id: "status", label: "Nexus Intel" },
    { id: "range", label: "Range Uplink" },
    { id: "prestige", label: "Prestige Protocols" },
  ];
  const activeDoctrine = doctrineById(state.doctrine);
  const priority = state.priority || defaultPriority();
  const priorityTotal = Object.values(priority).reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0);
  const autoBalanceEnabled = (state.hubBuildings.auto_balancer || 0) > 0 && (state.autoBalance?.enabled ?? true);
  const priorityEnabled = (state.hubBuildings.priority_manager || 0) > 0;
  const priorityPresets = {
    balanced: defaultPriority(),
    fuel: { metal: 15, organics: 15, fuel: 40, food: 15, research: 15 },
    food: { metal: 15, organics: 15, fuel: 10, food: 40, research: 20 },
    metal: { metal: 40, organics: 20, fuel: 15, food: 10, research: 15 },
    research: { metal: 15, organics: 15, fuel: 10, food: 10, research: 50 },
  };
  const earlyOpsLocked = !(state.milestonesUnlocked || []).includes("M1_LOCAL_OPS");

  return (
    <section className="panel space-y-4 hub-bridge">
      <div className="relative overflow-hidden rounded-2xl border border-amber-400/20 bg-slate-950/80 p-4 hub-bridge-banner">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.18),transparent_60%)]" />
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-slate-950/90 to-transparent" />
        <div className="relative z-10 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-amber-200/70">Bridge Uplink</div>
            <div className="text-2xl font-semibold">Command Nexus</div>
            <div className="text-sm text-muted mt-1">Primary control node for operations, automation, and expansion.</div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="tag">Nexus Lv {hubLevels}</span>
            <span className="tag">Upgrade Tier {hubTier}</span>
            <span className="tag">Command {command.used}/{command.capacity}</span>
            <span className="tag">Range {hubRange(state)}</span>
            <span className="tag">Signal Cap {format(saturation.cap)}</span>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[340px,1fr] gap-3">
        <div className="space-y-3">
          <div className="rounded-2xl border border-amber-400/15 bg-slate-950/70 p-4 space-y-3 hub-bridge-panel">
            <div className="row row-between">
              <div className="font-semibold">Bridge Status</div>
              <span className="text-xs text-muted">Telemetry</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div className={`stat-box ${lowPower ? "blink-alert" : ""}`}>
                <span className="text-muted text-xs">Power</span>
                <strong>{format(state.resources.power)}</strong>
              </div>
              <div className={`stat-box ${lowFuel ? "blink-alert" : ""}`}>
                <span className="text-muted text-xs">Fuel</span>
                <strong>{format(state.resources.fuel)}</strong>
              </div>
              <div className={`stat-box ${lowFood ? "blink-alert" : ""}`}>
                <span className="text-muted text-xs">Food</span>
                <strong>{format(state.resources.food)}</strong>
              </div>
              <div className={`stat-box ${lowHabitat ? "blink-alert" : ""}`}>
                <span className="text-muted text-xs">Habitat</span>
                <strong>{format(state.resources.habitat)}</strong>
              </div>
              <div className={`stat-box ${lowMetal ? "blink-alert" : ""}`}>
                <span className="text-muted text-xs">Metal</span>
                <strong>{format(state.resources.metal)}</strong>
              </div>
              <div className={`stat-box ${lowOrganics ? "blink-alert" : ""}`}>
                <span className="text-muted text-xs">Organics</span>
                <strong>{format(state.resources.organics)}</strong>
              </div>
              <div className="stat-box">
                <span className="text-muted text-xs">Morale</span>
                <strong>{Math.round((state.workers.satisfaction || 1) * 100)}%</strong>
              </div>
              <div className="stat-box">
                <span className="text-muted text-xs">Signal Cap</span>
                <strong>{format(saturation.cap)}</strong>
              </div>
              <div className="stat-box">
                <span className="text-muted text-xs">Saturation</span>
                <strong>{Math.round(saturation.penalty * 100)}%</strong>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs text-muted">Command Load</div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-amber-400" style={{ width: `${commandFill * 100}%` }} />
              </div>
              <div className="text-xs text-muted">Signal Progress</div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-sky-400" style={{ width: `${signalFill * 100}%` }} />
              </div>
              <div className="text-xs text-muted">Crew Morale</div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-emerald-400" style={{ width: `${moraleFill * 100}%` }} />
              </div>
            </div>
            {command.over > 0 && (
              <div className="text-xs text-muted">Over capacity: expedition efficiency reduced, stability drifting.</div>
            )}
            <div className="text-xs text-muted">Keep power non-negative and food above upkeep ({populationUpkeep.toFixed(2)}/tick).</div>
            <div className="text-xs text-muted">{bottleneckReport(state, state.rates).join(" ")}</div>
            <div className="text-xs text-muted">
              Prestige Protocol: {(state.milestonesUnlocked || []).includes("M4_PRESTIGE_UNLOCK") ? "Ready" : "Locked"} (Depth 2, 2 integrations, saturation 25%).
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 space-y-3 hub-bridge-deck">
          <div className="row row-between">
            <div>
              <div className="font-semibold">Nexus Operations Deck</div>
              <div className="text-xs text-muted">Command surfaces and routing protocols.</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {hubTabs.map((tab) => (
                <button key={tab.id} className={`tab ${pane === tab.id ? 'active' : ''}`} onClick={() => setPane(tab.id)}>
                  {tab.label}
                  {tab.id === "status" && intelCount > 0 && (
                    <span className="ml-2 tag">{intelCount}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {pane === "build" && (
            <div className="space-y-3">
              <div className="card space-y-2">
                <div className="text-xs text-muted">Filters</div>
                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    className="w-full md:w-64 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
                    placeholder="Search bays, outputs, or keywords"
                    value={buildQuery}
                    onChange={(e) => setBuildQuery(e.target.value)}
                  />
                  <select className="select bg-slate-800 text-white" value={buildCategory} onChange={(e) => setBuildCategory(e.target.value)}>
                    {buildCategories.map((tab) => (
                      <option key={tab.id} value={tab.id}>{tab.label}</option>
                    ))}
                  </select>
                  <select className="select bg-slate-800 text-white" value={buildTier} onChange={(e) => setBuildTier(e.target.value)}>
                    <option value="all">All tiers</option>
                    {tierList.map((tier) => (
                      <option key={tier} value={String(tier)}>Tier {tier}</option>
                    ))}
                  </select>
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-[11px] uppercase tracking-[0.2em] text-muted">Stage</span>
                    {buildStageOptions.map((opt) => (
                      <button key={opt.id} className={`tab ${buildStage === opt.id ? "active" : ""}`} onClick={() => setBuildStage(opt.id)}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-[11px] uppercase tracking-[0.2em] text-muted">Sort</span>
                    {buildSortOptions.map((opt) => (
                      <button key={opt.id} className={`tab ${buildSort === opt.id ? "active" : ""}`} onClick={() => setBuildSort(opt.id)}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="card grid md:grid-cols-3 gap-2 text-xs">
                <div className={`stat-box ${lowMaterials ? "blink-alert" : ""}`}>
                  <span className="text-muted text-[10px]">Materials</span>
                  <strong className="text-sm">Metal {format(metalRate)}/t</strong>
                  <div className="text-[10px] text-muted">Organics {format(organicsRate)}/t</div>
                </div>
                <div className={`stat-box ${lowLife ? "blink-alert" : ""}`}>
                  <span className="text-muted text-[10px]">Life Support</span>
                  <strong className="text-sm">Food {format(foodRate)}/t</strong>
                  <div className="text-[10px] text-muted">Hab {format(habitatRate)}/t</div>
                </div>
                <div className={`stat-box ${lowFuel ? "blink-alert" : ""}`}>
                  <span className="text-muted text-[10px]">Fuel</span>
                  <strong className="text-sm">Net {format(fuelRate)}/t</strong>
                  <div className="text-[10px] text-muted">Burn {format(hubFuelCons)}/t</div>
                </div>
              </div>
              {nextTierStatus && (
                <div className="card space-y-1">
                  <div className="font-semibold">Tier {nextTier} Unlock</div>
                  <div className="text-xs text-muted">Advance the hub to surface the next fabrication tier.</div>
                  <div className="text-xs text-muted">{nextTierStatus.reasons.join(" | ")}</div>
                </div>
              )}
              {!fuelTechUnlocked && fuelTechCost && (
                <div className="card space-y-2">
                  <div className="font-semibold">Fuel Synthesis Research</div>
                  <div className="text-xs text-muted">Unlocks Fuel Refinery and early fuel bays.</div>
                  <div className="text-xs text-muted">
                    Cost: {costText(fuelTechCost, format)}
                    {fuelTechSignal > 0 ? ` | Signal ${format(fuelTechSignal)}` : ""}
                  </div>
                  <button className="btn" disabled={!canResearchFuel} onClick={() => buyTech("fuel_synth")}>
                    {canResearchFuel ? "Research Fuel Synthesis" : "Requires more resources"}
                  </button>
                </div>
              )}
              <div className="list max-h-[520px] overflow-y-auto pr-1 virtual-list">
                {buildOptions
                  .filter((b) => {
                    const status = hubBuildingUnlockStatus(state, b);
                    if (buildTier !== "all" && String(b.tier || 0) !== buildTier) return false;
                    if (buildStage === "available" && !status.unlocked) return false;
                    if (buildStage === "locked" && status.unlocked) return false;
                    if (buildStage === "next" && nextTier !== undefined && (b.tier || 0) !== nextTier) return false;
                    if (buildStage === "next" && nextTier === undefined) return false;
                    if (buildQuery.trim()) {
                      const haystack = `${b.name} ${b.desc} ${b.category || ""} ${b.id}`.toLowerCase();
                      return haystack.includes(buildQuery.trim().toLowerCase());
                    }
                    return true;
                  })
                  .sort((a, b) => {
                    if (buildSort === "name") return a.name.localeCompare(b.name);
                    if (buildSort === "cost") {
                      const levelA = state.hubBuildings[a.id] || 0;
                      const levelB = state.hubBuildings[b.id] || 0;
                      const costA = Object.values(scaledHubCost(a.cost, levelA, a.costExp)).reduce((sum, v) => sum + v, 0);
                      const costB = Object.values(scaledHubCost(b.cost, levelB, b.costExp)).reduce((sum, v) => sum + v, 0);
                      return costA - costB;
                    }
                    const tierA = a.tier || 0;
                    const tierB = b.tier || 0;
                    return tierA === tierB ? a.name.localeCompare(b.name) : tierA - tierB;
                  })
                  .map((b) => {
                  const level = state.hubBuildings[b.id] || 0;
                  const cost = scaledHubCost(b.cost, level, b.costExp);
                  const status = hubBuildingUnlockStatus(state, b);
                  const can = status.unlocked && canAffordUI(state.resources, cost);
                  return (
                    <div key={b.id} className={`row-item ${!status.unlocked ? "opacity-60" : ""}`}>
                      <div className="row-details">
                        <div className="row-title">{b.name} <span className="tag">Lv {level}</span> <span className="tag">Tier {b.tier ?? 0}</span></div>
                        <div className="row-meta">{b.desc}</div>
                        <div className="row-meta text-xs text-muted">Crew bonus: {crewBonusText(b.id)}</div>
                        <div className="row-meta text-xs text-muted">Next cost: {costText(cost, format)}</div>
                        {!status.unlocked && <div className="row-meta text-xs text-muted">Unlock: {status.reasons.join(" | ")}</div>}
                      </div>
                      <button className="btn" disabled={!can} onClick={() => buildHub(b.id)}>
                        {status.unlocked ? `Build (${costText(cost, format)})` : "Locked"}
                      </button>
                    </div>
                  );
                })}
                {!buildOptions.length && <div className="text-muted text-sm">No bays available yet.</div>}
              </div>
            </div>
          )}

          {pane === "upgrades" && (
            <div className="list max-h-[520px] overflow-y-auto pr-1 virtual-list">
              {HUB_UPGRADES.map((u) => {
                const level = state.hubUpgrades[u.id] || 0;
                const status = hubUpgradeUnlockStatus(state, u);
                const cost = scaledUpgradeCost(u.cost, level);
                return (
                  <div key={u.id} className="row-item">
                    <div className="row-details">
                      <div className="row-title">{u.name} <span className="tag">Tier {level}</span></div>
                      <div className="row-meta">{u.desc}</div>
                      <div className="row-meta text-xs text-muted">
                        {status.unlocked ? `Unlocked at Nexus level ${status.unlockAt}` : `Unlock: ${status.reasons.join(" | ")}`}
                      </div>
                    </div>
                    <button className="btn" disabled={!status.unlocked || !canAffordUI(state.resources, cost)} onClick={() => buyHubUpgrade(u.id)}>
                      {status.unlocked ? `Upgrade (${costText(cost, format)})` : "Locked"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {pane === "status" && (
            <div className="grid md:grid-cols-2 gap-3">
              <div className="card space-y-2">
                <div className="font-semibold">Priority Actions</div>
                {priorityActions.length ? (
                  <div className="list">
                    {priorityActions.map((item) => (
                      <div key={item.title} className="row-item">
                        <div className="row-details">
                          <div className="row-title">{item.title}</div>
                          <div className="row-meta text-xs text-muted">{item.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted">No critical actions queued.</div>
                )}
              </div>
              {earlyOpsLocked && (
                <div className="card space-y-2">
                  <div className="font-semibold">Early Hub Loop</div>
                  <div className="text-xs text-muted">Hub-only startup. Unlock Expeditions at Signal 60 + Nexus Lv 4.</div>
                  <ul className="text-sm text-muted list-disc list-inside space-y-1">
                    <li>Build Salvage Dock to start metal flow.</li>
                    <li>Add Biofilter Vats for organics.</li>
                    <li>Bring Micro Reactor online for power.</li>
                    <li>Deploy Signal Uplink to raise Signal.</li>
                    <li>Install Hydroponics Bay to stabilize food.</li>
                  </ul>
                </div>
              )}
              <div className="card space-y-2">
                <div className="font-semibold">Population Command</div>
                <div className="text-sm">{populationTotal} / {populationCap} population</div>
                <div className="text-xs text-muted">Food upkeep {populationUpkeep.toFixed(2)}/tick</div>
                <div className="text-xs text-muted">
                  Food status: {foodStateLabel}{foodMinutes !== null ? ` (${foodMinutes}m)` : ""} | {growthLabel}
                </div>
              </div>
              {(state.hubBuildings.auto_balancer || state.hubBuildings.priority_manager) && (
                <div className="card space-y-3">
                  <div className="font-semibold">Automation Matrix</div>
                  {(state.hubBuildings.auto_balancer || 0) > 0 ? (
                    <label className="row row-between text-sm">
                      <span className="text-muted">Auto-Balancer</span>
                      <input type="checkbox" checked={autoBalanceEnabled} onChange={(e) => toggleAutoBalance(e.target.checked)} />
                    </label>
                  ) : (
                    <div className="text-xs text-muted">Auto-Balancer offline.</div>
                  )}
                  {(state.hubBuildings.priority_manager || 0) > 0 ? (
                    <div className="space-y-2">
                      <div className="text-xs text-muted">Priority Manager ({priorityTotal}%)</div>
                      <div className="flex flex-wrap gap-2 text-[11px]">
                        {[
                          { id: "balanced", label: "Balanced" },
                          { id: "fuel", label: "Fuel Push" },
                          { id: "food", label: "Food Push" },
                          { id: "metal", label: "Metal Push" },
                          { id: "research", label: "Research Push" },
                        ].map((preset) => (
                          <button
                            key={preset.id}
                            className="tab"
                            onClick={() => setPriority(priorityPresets[preset.id])}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                      {["metal", "organics", "fuel", "food", "research"].map((key) => (
                        <div key={key} className="flex items-center gap-2 text-xs">
                          <span className="w-20 capitalize">{key}</span>
                          <input
                            className="flex-1"
                            type="range"
                            min="0"
                            max="100"
                            value={priority[key] || 0}
                            onChange={(e) => {
                              const next = { ...priority, [key]: Number(e.target.value) };
                              setPriority(next);
                            }}
                          />
                          <span className="w-10 text-right">{priority[key] || 0}%</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-muted">Priority Manager offline.</div>
                  )}
                </div>
              )}
              <div className="card space-y-2">
                <div className="font-semibold">Command Array</div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted">
                  <div className="stat-box">
                    <span className="text-muted text-[10px]">Expedition Slots</span>
                    <strong className="text-sm">{missionSlots}</strong>
                  </div>
                  <div className="stat-box">
                    <span className="text-muted text-[10px]">Travel Efficiency</span>
                    <strong className="text-sm">{Math.round(hubTravel * 100)}%</strong>
                  </div>
                  <div className="stat-box">
                    <span className="text-muted text-[10px]">Fuel Logistics</span>
                    <strong className="text-sm">{fuelSavings > 0 ? `-${fuelSavings}%` : "Stable"}</strong>
                  </div>
                  <div className="stat-box">
                    <span className="text-muted text-[10px]">Hazard Shielding</span>
                    <strong className="text-sm">{hazardShield > 0 ? `-${hazardShield}%` : "None"}</strong>
                  </div>
                  <div className="stat-box">
                    <span className="text-muted text-[10px]">Cargo Boost</span>
                    <strong className="text-sm">{cargoBoost > 0 ? `+${cargoBoost}%` : "None"}</strong>
                  </div>
                  <div className="stat-box">
                    <span className="text-muted text-[10px]">Research Boost</span>
                    <strong className="text-sm">{researchBoost > 0 ? `+${researchBoost}%` : "None"}</strong>
                  </div>
                  <div className="stat-box">
                    <span className="text-muted text-[10px]">Signal Cap Boost</span>
                    <strong className="text-sm">{hubMods.signalCapBonus > 0 ? `+${hubMods.signalCapBonus}` : "None"}</strong>
                  </div>
                  <div className="stat-box">
                    <span className="text-muted text-[10px]">Habitat Lift</span>
                    <strong className="text-sm">{hubMods.habitat > 0 ? `+${hubMods.habitat}/t` : "None"}</strong>
                  </div>
                </div>
              </div>
              <div className="card space-y-2">
                <div className="font-semibold">Next Unlocks</div>
                {unlockHints.length ? (
                  <div className="list">
                    {unlockHints.map((hint) => (
                      <div key={hint.id} className="row-item">
                        <div className="row-details">
                          <div className="row-title">{hint.title}</div>
                          <div className="row-meta text-xs text-muted">{hint.reqs.join(" | ")}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted">All current hub consoles are unlocked.</div>
                )}
              </div>
              <div className="card space-y-2">
                <div className="font-semibold">Fragment Index</div>
                <div className="text-sm">{format(fragmentStatus.recovered)} / {format(fragmentStatus.total)} ({fragmentPercent}%)</div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-indigo-400" style={{ width: `${fragmentPercent}%` }} />
                </div>
                <div className="text-xs text-muted">
                  {fragmentNext ? `Next threshold: ${fragmentNext.title} at ${Math.round(fragmentNext.percent * 100)}%.` : "Reassembly complete."}
                </div>
              </div>
            </div>
          )}

          {pane === "range" && (
            <div className="space-y-3">
              <div className="card space-y-2">
                <div className="font-semibold">Range Uplink</div>
                <div className="row-item">
                  <div className="row-details">
                    <div className="row-title">Range Tier {hubRange(state)}</div>
                    <div className="row-meta">Unlocks higher-tier targets.</div>
                  </div>
                </div>
                <div className="text-xs text-muted">Extend range via Scan Array (Hub), Deep Scan Arrays + Rift Mapping (Tech), and Relay Anchor colonies.</div>
              </div>
              <div className="card space-y-2">
                <div className="font-semibold">Range Channels</div>
                <ul className="text-xs text-muted list-disc list-inside space-y-1">
                  <li>Scan Array uplinked to the hub core</li>
                  <li>Deep Scan Arrays research line</li>
                  <li>Rift Mapping research line</li>
                  <li>Relay Anchor colonies in nearby systems</li>
                </ul>
              </div>
            </div>
          )}

          {pane === "prestige" && (
            <div className="space-y-3">
              <div className="card space-y-2">
                <div className="font-semibold">Prestige Protocols</div>
                <div className="text-sm text-muted">Recalibrate for a global production boost. Current boost: {Math.round(((state.prestige?.boost || 1) - 1) * 100)}% | Points: {state.prestige?.points || 0}</div>
                <button className="btn" disabled={!canPrestige} onClick={ascend}>Recalibrate</button>
                <div className="text-xs text-muted">
                  {canPrestige ? "Grants legacy signal based on total value. Progress auto-saves locally; refresh won't wipe." : "Prestige Protocol unlocks after galaxy depth 2, two integrations, and saturation pressure."}
                </div>
              </div>
              <div className="card space-y-2">
                <div className="font-semibold">Doctrine Cache</div>
                <div className="text-xs text-muted">{activeDoctrine ? `Active doctrine: ${activeDoctrine.name}` : "No doctrine selected yet."}</div>
                {!state.prestige?.runs && (
                  <div className="text-xs text-muted">Prestige Protocol once to unlock doctrine selection.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
function LogView({ log }) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const rows = useMemo(() => {
    const entries = [...(log || [])].reverse();
    if (!normalized) return entries;
    return entries.filter((e) => (e.text || "").toLowerCase().includes(normalized));
  }, [log, normalized]);
  return (
    <section className="panel space-y-3">
      <div className="row row-between">
        <div>
          <div className="text-lg font-semibold">Operations Log</div>
          <div className="text-sm text-muted">Telemetry and player actions, archived in real-time.</div>
        </div>
        <div className="text-xs text-muted">{rows.length} entries</div>
      </div>
      <div className="card">
        <input
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
          placeholder="Filter by keyword"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="list">
        {rows.map((e, i) => (
          <div key={i} className="row-item">
            <div className="row-details">
              <div className="row-title">{e.text}</div>
              <div className="row-meta">{new Date(e.time).toLocaleTimeString()}</div>
            </div>
          </div>
        ))}
        {!rows.length && <div className="text-muted text-sm">No matching entries.</div>}
      </div>
    </section>
  );
}

function SystemsView({ state, capabilities, format, formatDuration, startSystemOp, colonizeSystem, startIntegrationProject, resolveSystemEvent, chartNewGalaxy, colonyRoles }) {
  const [rolePick, setRolePick] = useState({});
  const [nextGalaxy, setNextGalaxy] = useState("dense");
  const [pane, setPane] = useState("overview");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  if (!capabilities.systems) {
    return (
      <section className="panel space-y-2">
        <div className="text-lg font-semibold">Systems</div>
        <div className="text-muted text-sm">Unlock by extending hub range or researching Deep Scan arrays.</div>
      </section>
    );
  }
  const systems = state.systems || [];
  const colonies = state.colonies || [];
  const systemEvents = state.systemEvents || [];
  const colonyBySystem = useMemo(() => {
    const map = new Map();
    colonies.forEach((colony) => {
      if (colony?.systemId) map.set(colony.systemId, colony);
    });
    return map;
  }, [colonies]);
  const eventsBySystem = useMemo(() => {
    const map = {};
    systemEvents.forEach((ev) => {
      if (!ev?.systemId) return;
      map[ev.systemId] = [...(map[ev.systemId] || []), ev];
    });
    return map;
  }, [systemEvents]);
  const command = commandUsage(state);
  const surveySpeed = colonyModifiers(state).surveySpeed || 1;
  const integration = state.integration || { eventRateMult: 1, travelMult: 1, saturationRelief: 0, signalCapBonus: 0 };
  const galaxy = activeGalaxy(state);
  const galaxyRule = galaxyById(galaxy?.rulesetId);
  const integratedSystems = systems.filter((s) => s.integratedAt).length;
  const canChartGalaxy = integratedSystems >= 2;
  const traitName = (id) => SYSTEM_TRAITS.find((t) => t.id === id)?.name || id;
  const activeProjects = systems.filter((s) => s.project).length;
  const projectCap = Math.max(1, Math.floor(commandCapacity(state) / 2) + 1);
  const activeOps = systems.filter((s) => s.op);
  const allEvents = systemEvents.map((ev) => ({ ...ev, system: systems.find((s) => s.id === ev.systemId) }));
  const normalized = query.trim().toLowerCase();
  const stageBucket = (system, colony) => {
    if (system.integratedAt) return "integrated";
    if (colony) return "anchored";
    if (system.stage === "colonize") return "colonize";
    return "survey";
  };
  const filteredSystems = systems.filter((system) => {
    const colony = colonyBySystem.get(system.id);
    const bucket = stageBucket(system, colony);
    if (filter === "active" && !system.op) return false;
    if (filter !== "all" && filter !== "active" && bucket !== filter) return false;
    if (!normalized) return true;
    const traits = (system.traits || []).map(traitName).join(" ").toLowerCase();
    const name = (system.name || "").toLowerCase();
    return name.includes(normalized) || traits.includes(normalized);
  });
  const deckTabs = [
    { id: "overview", label: "Overview" },
    { id: "ops", label: "Survey Ops" },
    { id: "integration", label: "Integration" },
    { id: "events", label: "Events" },
  ];
  const filters = [
    { id: "all", label: "All" },
    { id: "survey", label: "Survey Chain" },
    { id: "colonize", label: "Colonize" },
    { id: "anchored", label: "Anchored" },
    { id: "integrated", label: "Integrated" },
    { id: "active", label: "Active Ops" },
  ];
  return (
    <section className="panel space-y-3">
      <div>
        <div className="text-lg font-semibold">Systems</div>
        <div className="text-muted text-sm">Run scan to probe to survey chains to unlock colonies.</div>
      </div>

      <div className="card space-y-3">
        <div className="row row-between">
          <div className="font-semibold">System Command Deck</div>
          <div className="flex flex-wrap gap-2">
            {deckTabs.map((tab) => (
              <button key={tab.id} className={`tab ${pane === tab.id ? "active" : ""}`} onClick={() => setPane(tab.id)}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        {pane === "overview" && (
          <div className="grid md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3 space-y-1">
              <div className="text-xs text-muted">Galaxy Overview</div>
              <div className="text-sm font-semibold">{galaxy?.name || "Uncharted"}</div>
              <div className="text-xs text-muted">Ruleset: {galaxyRule?.name || "Unknown"} | Depth {galaxy?.depth || 0}</div>
              <div className="text-xs text-muted">Integrations: {integratedSystems}</div>
              <div className="text-xs text-muted">Effects: cargo {Math.round((galaxyRule?.mods?.cargoMult || 1) * 100)}% | hazards {Math.round((galaxyRule?.mods?.hazardMult || 1) * 100)}%</div>
              <div className="text-xs text-muted">{galaxyRule?.desc || "Reach systems to unlock galaxy options."}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3 space-y-1">
              <div className="text-xs text-muted">Command Capacity</div>
              <div className="text-sm font-semibold">{command.used}/{command.capacity} slots in use</div>
              <div className="text-xs text-muted">Over-capacity reduces expedition efficiency and destabilizes colonies.</div>
              <div className="text-xs text-muted">Integration effects: travel {Math.round((integration.travelMult || 1) * 100)}% | event rate {Math.round((integration.eventRateMult || 1) * 100)}%</div>
            </div>
          </div>
        )}
        {pane === "ops" && (
          <div className="space-y-2">
            {!activeOps.length && <div className="text-sm text-muted">No active survey chains.</div>}
            {activeOps.map((system) => {
              const step = SYSTEM_SURVEY_STEPS[system.stage];
              const remaining = system.op ? Math.max(0, system.op.endsAt - Date.now()) : 0;
              return (
                <div key={system.id} className="rounded-xl border border-white/10 bg-slate-950/60 p-3 space-y-1">
                  <div className="text-sm font-semibold">{system.name}</div>
                  <div className="text-xs text-muted">{step?.name || "Survey"} running • {formatDuration(remaining)} remaining</div>
                </div>
              );
            })}
          </div>
        )}
        {pane === "integration" && (
          <div className="grid md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3 space-y-2">
              <div className="font-semibold text-sm">Galaxy Controls</div>
              <div className="text-xs text-muted">Chart a new galaxy once two systems are integrated.</div>
              <div className="row gap-2">
                <select className="select bg-slate-800 text-white" value={nextGalaxy} onChange={(e) => setNextGalaxy(e.target.value)}>
                  {GALAXY_RULESETS.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <button className="btn" disabled={!canChartGalaxy} onClick={() => chartNewGalaxy(nextGalaxy)}>
                  {canChartGalaxy ? "Chart New Galaxy" : "Integrate 2 systems"}
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3 space-y-1">
              <div className="font-semibold text-sm">Integration Status</div>
              <div className="text-xs text-muted">Integrated systems: {integratedSystems}</div>
              <div className="text-xs text-muted">Active projects: {activeProjects}/{projectCap}</div>
              <div className="text-xs text-muted">Travel efficiency: {Math.round((integration.travelMult || 1) * 100)}%</div>
              <div className="text-xs text-muted">Event rate: {Math.round((integration.eventRateMult || 1) * 100)}%</div>
            </div>
          </div>
        )}
        {pane === "events" && (
          <div className="space-y-2">
            {!allEvents.length && <div className="text-sm text-muted">No active system events.</div>}
            {allEvents.length > 0 && (
              <div className="list">
                {allEvents.map((ev) => (
                  <div key={ev.id} className="row-item">
                    <div className="row-details">
                      <div className="row-title">{ev.name}</div>
                      <div className="row-meta">{ev.system?.name || "Unknown system"} • {ev.desc}</div>
                      <div className="row-meta text-xs text-muted">Resolve cost: {costText(ev.cost, format)}</div>
                    </div>
                    <button className="btn" onClick={() => resolveSystemEvent(ev.systemId, ev.id)}>Resolve</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card space-y-2">
        <div className="row row-between">
          <div className="font-semibold">System Registry</div>
          <div className="text-xs text-muted">{filteredSystems.length}/{systems.length} visible</div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {filters.map((tab) => (
            <button key={tab.id} className={`tab ${filter === tab.id ? "active" : ""}`} onClick={() => setFilter(tab.id)}>
              {tab.label}
            </button>
          ))}
          <input
            className="min-w-[180px] flex-1 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
            placeholder="Search systems"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="list">
        {filteredSystems.map((system) => {
          const colony = colonyBySystem.get(system.id);
          const events = eventsBySystem[system.id] || [];
          const traits = (system.traits || []).map(traitName).join(", ") || "Unstable signals";
          const stage = system.stage || "scan";
          const stageLabel = stage === "colonized" ? "Anchored" : stage[0].toUpperCase() + stage.slice(1);
          const opRemaining = system.op ? Math.max(0, system.op.endsAt - Date.now()) : 0;
          const step = SYSTEM_SURVEY_STEPS[stage];
          const roleChoice = rolePick[system.id] || "relay";
          const roleDef = colony ? colonyRoleById(colony.role) : colonyRoleById(roleChoice);
          const project = system.project ? INTEGRATION_PROJECTS.find((p) => p.id === system.project.id) : null;
          const projectRemaining = system.project ? Math.max(0, system.project.endsAt - Date.now()) : 0;
          const trend = events.length ? "Declining" : "Stable";
          const canStartProject = !system.project && activeProjects < projectCap;
          return (
            <div key={system.id} className="row-item">
              <div className="row-details">
                <div className="row-title">
                  {system.name} <span className="tag">{stageLabel}</span> {system.integratedAt && <span className="tag">Integrated</span>}
                </div>
                <div className="row-meta">Distance {format(system.distance || 0)} AU | Traits {traits}</div>
                <div className="row-meta text-xs text-muted">Stability {Math.round(system.stability ?? 100)}% | Trend {trend}</div>
                {system.op && <div className="row-meta text-xs text-muted">{step?.name} running: {formatDuration(opRemaining)} remaining</div>}
                {!system.op && ["scan", "probe", "survey"].includes(stage) && (
                  <div className="row-meta text-xs text-muted">
                    {step?.name} cost: {step ? costText(step.cost, format) : "n/a"} | Duration {step ? formatDuration(step.duration * surveySpeed * PACE.surveyDurationMult) : "n/a"}
                  </div>
                )}
                {colony && (
                  <div className="row-meta text-xs text-muted">Colony: {roleDef.name} | Command cost {colonyCapacityCost(colony)} | Events {events.length}/{MAX_SYSTEM_EVENTS}</div>
                )}
                {!colony && stage === "colonize" && (
                  <div className="row-meta text-xs text-muted">Colony cost: {costText(COLONY_COST, format)}</div>
                )}
                {!colony && stage === "colonize" && (
                  <div className="row-meta text-xs text-muted">{roleDef.desc}</div>
                )}
                {project && (
                  <div className="row-meta text-xs text-muted">Project: {project.name} | {formatDuration(projectRemaining)} remaining</div>
                )}
                {!project && colony && (
                  <div className="row-meta text-xs text-muted">Integration slots {activeProjects}/{projectCap}</div>
                )}
              </div>
              <div className="flex flex-col gap-2 items-end">
                {["scan", "probe", "survey"].includes(stage) && !system.op && (
                  <button className="btn" onClick={() => startSystemOp(system.id)}>{step?.name || "Start Survey"}</button>
                )}
                {["scan", "probe", "survey"].includes(stage) && system.op && (
                  <button className="btn" disabled>In Progress</button>
                )}
                {stage === "colonize" && !colony && (
                  <>
                    <select className="select bg-slate-800 text-white" value={roleChoice} onChange={(e) => setRolePick({ ...rolePick, [system.id]: e.target.value })}>
                      {colonyRoles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                    </select>
                    <button className="btn btn-primary" onClick={() => colonizeSystem(system.id, roleChoice)}>Establish Colony</button>
                  </>
                )}
                {colony && <span className="tag">Anchored</span>}
              </div>
              {colony && (
                <div className="mt-3 w-full space-y-2">
                  <div className="text-xs text-muted">Integration Projects</div>
                  <div className="grid md:grid-cols-3 gap-2">
                    {INTEGRATION_PROJECTS.map((proj) => (
                      <div key={proj.id} className="card space-y-1">
                        <div className="font-semibold text-sm">{proj.name}</div>
                        <div className="text-xs text-muted">{proj.desc}</div>
                        <div className="text-xs text-muted">Cost: {costText(proj.cost, format)}</div>
                        <button className="btn" disabled={!canStartProject} onClick={() => startIntegrationProject(system.id, proj.id)}>
                          {canStartProject ? "Start" : "Busy"}
                        </button>
                      </div>
                    ))}
                  </div>
                  {!!events.length && (
                    <div className="space-y-2">
                      <div className="text-xs text-muted">System Events</div>
                      <div className="list">
                        {events.map((ev) => (
                          <div key={ev.id} className="row-item">
                            <div className="row-details">
                              <div className="row-title">{ev.name}</div>
                              <div className="row-meta">{ev.desc}</div>
                              <div className="row-meta text-xs text-muted">Resolve cost: {costText(ev.cost, format)}</div>
                            </div>
                            <button className="btn" onClick={() => resolveSystemEvent(system.id, ev.id)}>Resolve</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {!systems.length && <div className="text-muted text-sm">No systems detected yet. Raise hub range to reveal new targets.</div>}
        {!!systems.length && !filteredSystems.length && <div className="text-muted text-sm">No systems match the current filters.</div>}
      </div>
    </section>
  );
}

function CodexView({ state }) {
  const unlocked = new Set(state.codexUnlocked || []);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const totalCount = CODEX_ENTRIES.length;
  const unlockedCount = CODEX_ENTRIES.filter((entry) => unlocked.has(entry.id)).length;
  const entries = useMemo(() => {
    return CODEX_ENTRIES.filter((entry) => {
      const isUnlocked = unlocked.has(entry.id);
      if (filter === "unlocked" && !isUnlocked) return false;
      if (filter === "locked" && isUnlocked) return false;
      if (!normalized) return true;
      const text = `${entry.title} ${entry.body}`.toLowerCase();
      return text.includes(normalized);
    });
  }, [filter, normalized, unlocked]);
  return (
    <section className="panel space-y-3">
      <div className="row row-between">
        <div>
          <div className="text-lg font-semibold">Codex Archive</div>
          <div className="text-muted text-sm">Operational knowledge unlocks as milestones are reached.</div>
        </div>
        <div className="text-xs text-muted">{unlockedCount}/{totalCount} unlocked</div>
      </div>
      <div className="card space-y-2">
        <div className="row row-between">
          <div className="text-xs text-muted">Filters</div>
          <div className="flex flex-wrap gap-2">
            {[
              { id: "all", label: "All" },
              { id: "unlocked", label: "Unlocked" },
              { id: "locked", label: "Locked" },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`tab ${filter === tab.id ? "active" : ""}`}
                onClick={() => setFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <input
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
          placeholder="Search codex entries"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="list">
        {entries.map((entry) => {
          const isUnlocked = unlocked.has(entry.id);
          return (
            <div key={entry.id} className="row-item">
              <div className="row-details">
                <div className="row-title">{entry.title}</div>
                <div className="row-meta">{isUnlocked ? entry.body : "Locked. Reach the relevant milestone to reveal."}</div>
              </div>
              <span className="tag">{isUnlocked ? "Unlocked" : "Locked"}</span>
            </div>
          );
        })}
        {!entries.length && <div className="text-muted text-sm">No entries match this filter.</div>}
      </div>
    </section>
  );
}

function WikiView() {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const entries = useMemo(() => {
    if (!normalized) return WIKI_ENTRIES;
    return WIKI_ENTRIES.filter((entry) => {
      const text = `${entry.title} ${entry.body}`.toLowerCase();
      return text.includes(normalized);
    });
  }, [normalized]);
  return (
    <section className="panel space-y-3">
      <div className="row row-between">
        <div>
          <div className="text-lg font-semibold">Field Manual</div>
          <div className="text-muted text-sm">Reference for core systems, caps, and progression rules.</div>
        </div>
        <div className="text-xs text-muted">{entries.length}/{WIKI_ENTRIES.length} entries</div>
      </div>
      <div className="card space-y-2">
        <input
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
          placeholder="Search manual entries"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="list">
        {entries.map((entry) => (
          <div key={entry.id} className="row-item">
            <div className="row-details">
              <div className="row-title">{entry.title}</div>
              <div className="row-meta">{entry.body}</div>
            </div>
          </div>
        ))}
        {!entries.length && <div className="text-muted text-sm">No manual entries match this search.</div>}
      </div>
    </section>
  );
}

function StarterTour({ tourStep, seen, onStep }) {
  const step = STARTER_TOUR[tourStep];
  return (
    <AnimatePresence>
      {!seen && step && (
        <div className="modal-backdrop" key="tour">
          <motion.div className="modal" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="text-lg font-semibold mb-2">{step.title}</div>
            <div className="text-muted text-sm mb-4">{step.body}</div>
            <div className="flex gap-2 justify-end">
              <button className="btn" onClick={() => onStep(tourStep + 1, tourStep + 1 >= STARTER_TOUR.length)}>{tourStep + 1 >= STARTER_TOUR.length ? 'Finish' : 'Next'}</button>
              <button className="btn" onClick={() => onStep(tourStep, true)}>Skip</button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function focusBoost(focus, resourceKey) {
  if (focus === "production" && ["metal","organics","fuel","signal","rare"].includes(resourceKey)) return 1.2;
  if (focus === "sustain" && ["food","habitat","power"].includes(resourceKey)) return 1.2;
  if (focus === "morale" && resourceKey === "morale") return 1.25;
  return 1;
}

function missionModeById(id) { return MISSION_MODES.find((m) => m.id === id) || MISSION_MODES[0]; }
function isMissionModeUnlocked(stateObj, mode) {
  if (!mode?.unlock) return true;
  const unlock = mode.unlock || {};
  if (unlock.missions && (stateObj.milestones?.missionsDone || 0) < unlock.missions) return false;
  if (unlock.signal && (stateObj.resources.signal || 0) < unlock.signal) return false;
  if (unlock.tech && !stateObj.tech?.[unlock.tech]) return false;
  if (unlock.milestone && !(stateObj.milestonesUnlocked || []).includes(unlock.milestone)) return false;
  return true;
}
function firstUnlockedMissionMode(stateObj) {
  return MISSION_MODES.find((mode) => isMissionModeUnlocked(stateObj, mode)) || MISSION_MODES[0];
}
function loadSavedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY);
    const cookie = document.cookie.split("; ").find((c) => c.startsWith("signalFrontier="));
    const cookieData = cookie ? decodeURIComponent(cookie.split("=")[1]) : null;
    const data = raw || (cookieData ? atob(cookieData) : null);
    if (data) {
      const parsed = JSON.parse(data);
      const migrated = migrateSave(parsed);
      return { ...initialState, ...migrated };
    }
  } catch (e) {
    console.warn("Failed to load state, starting fresh", e);
  }
  return initialState;
}
function scaledCost(baseCost, level, exp) {
  const out = {};
  Object.entries(baseCost || {}).forEach(([k, v]) => {
    out[k] = Math.ceil(v * Math.pow(exp || 1.1, level || 0));
  });
  return out;
}
function hubTotalLevel(stateObj) {
  return Object.values(stateObj.hubBuildings || {}).reduce((sum, lvl) => sum + (lvl || 0), 0);
}
function scaledHubCost(baseCost, level, expOverride) {
  const tier = Math.floor((level || 0) / HUB_TIER_STEP);
  const tierMult = Math.pow(HUB_TIER_COST_MULT, tier);
  const exp = Number.isFinite(expOverride) ? expOverride : COST_EXP.hub;
  return scaleCost(scaledCost(baseCost, level, exp), tierMult);
}
function scaledUpgradeCost(baseCost, level) {
  const tierMult = Math.pow(HUB_UPGRADE_TIER_MULT, (level || 0) + 1);
  return scaleCost(scaledCost(baseCost, level, COST_EXP.hub), tierMult);
}
function scaleCost(baseCost, mult = 1) {
  const out = {};
  Object.entries(baseCost || {}).forEach(([k, v]) => {
    out[k] = Math.ceil(v * (mult || 1));
  });
  return out;
}
function requirementsMet(base, building) {
  const prereqs = building.requires ? building.requires.every((req) => (base.buildings?.[req.id] || 0) >= (req.level || 1)) : true;
  const groupOk = building.group ? !Object.entries(base.buildings || {}).some(([id, lvl]) => {
    if (lvl <= 0) return false;
    const def = Object.values(BIOME_BUILDINGS).flat().find((b) => b.id === id);
    return def?.group && def.group === building.group && id !== building.id;
  }) : true;
  return prereqs && groupOk;
}
function scaleCons(cons = {}, lvl = 1) { const out = {}; Object.entries(cons || {}).forEach(([k, v]) => out[k] = v * lvl); return out; }
function applyProdMult(prod = {}, focusMods = {}, contractMods = {}) {
  const out = { ...prod };
  Object.keys(out).forEach((k) => {
    let mult = 1;
    if (k === "food" && focusMods.botanistNutritionMult) mult *= focusMods.botanistNutritionMult;
    if (k === "fuel" && focusMods.fuelProdMult) mult *= focusMods.fuelProdMult;
    if (contractMods.prodMult?.[k]) mult *= contractMods.prodMult[k];
    out[k] = out[k] * mult;
  });
  return out;
}
function aggregateEventMods(base) {
  const mult = {};
  let moralePenalty = 0;
  (base?.events || []).forEach((ev) => {
    if (ev.status === "resolved") return;
    Object.entries(ev.effect?.mult || {}).forEach(([k, v]) => { mult[k] = (mult[k] || 1) * v; });
    moralePenalty += ev.effect?.moralePenalty || 0;
  });
  return { mult, moralePenalty };
}
function populationFoodUpkeep(popTotal) {
  if (popTotal <= 100) return 0.1;
  if (popTotal <= 500) return 0.5;
  if (popTotal <= 1000) return 1.0;
  if (popTotal <= 2500) return 2.5;
  return 5.0;
}
function populationFoodState(foodStock, foodRate, upkeep) {
  if (upkeep <= 0) return { state: "abundant", minutes: Infinity };
  const minutes = (foodStock / upkeep) * (TICK_MS / 60000);
  const net = (foodRate || 0) - upkeep;
  if (foodStock <= 0 && net < 0) return { state: "negative", minutes };
  if (minutes >= 60) return { state: "abundant", minutes };
  if (minutes >= 10) return { state: "stable", minutes };
  if (minutes > 0) return { state: "low", minutes };
  return { state: "negative", minutes };
}
function computeMorale(resources, rates, state, currentBase, eventMods, powerGate) {
  const populationTotal = Math.max(state.population?.total || 0, state.workers.total || 0);
  const foodUpkeep = populationFoodUpkeep(populationTotal);
  const foodFactor = clamp((resources.food / Math.max(1, foodUpkeep)) * 0.9, 0.35, 1.25);
  const habitatFactor = clamp((resources.habitat || 0) / Math.max(1, populationTotal), 0.5, 1.2);
  const powerFactor = powerGate ? 0.4 : 1;
  const unassigned = state.workers.total - Object.values(state.workers.assigned).reduce((a, b) => a + b, 0);
  const restFactor = clamp(0.9 + unassigned * 0.04, 0.85, 1.15);
  const missionHazard = (state.missions.active || []).reduce((acc, m) => acc + (m.hazard || 0), 0) / Math.max(1, (state.missions.active || []).length);
  const hazardPenalty = missionHazard * 0.3;
  const foodDebt = Math.max(0, foodUpkeep - (resources.food || 0));
  const foodPenalty = clamp(foodDebt / Math.max(1, foodUpkeep), 0, 1) * 0.25;
  const powerPenalty = powerGate ? 0.15 : 0;
  const eventPenalty = (currentBase.events || []).length * 0.04 + (eventMods.moralePenalty || 0);
  const fatiguePenalty = (crewFatigueStats(state).avgAssigned || 0) * 0.08;
  const crewMods = crewProgramModifiers(state);
  const contractMods = crewContractModifiers(state);
  const crewBonus = (crewMods.moraleBonus || 0) + (contractMods.moraleBonus || 0);
  const baseMorale = (foodFactor * 0.4) + (habitatFactor * 0.2) + (powerFactor * 0.15) + (restFactor * 0.15) - hazardPenalty - eventPenalty - fatiguePenalty - foodPenalty - powerPenalty;
  return clamp(baseMorale + (rates.morale || 0) + crewBonus, 0.5, 1.5);
}
function randomBetween(min, max) { return min + Math.random() * (max - min); }
function traitById(id) {
  return Object.values(BASE_TRAITS).flat().find((t) => t.id === id);
}
function rollTraits(body) {
  const pool = BASE_TRAITS[body.type] || [];
  const count = pool.length >= 2 ? 2 : 1;
  const picks = [];
  while (picks.length < count && pool.length) {
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (!picks.includes(pick.id)) picks.push(pick.id);
  }
  return picks;
}
function defaultBaseState(body) {
  return {
    buildings: {},
    events: [],
    focus: "balanced",
    nextEventAt: Date.now() + randomBetween(...EVENT_COOLDOWN_MS),
    opsReadyAt: 0,
    traits: body ? rollTraits(body) : [],
    workers: { total: 0, assigned: { production: 0, maintenance: 0, research: 0 } },
    zones: { core: true },
  };
}
function traitEffects(traitIds = []) {
  const out = { prod: {}, hazardMult: 1, travelMult: 1, cargoMult: 1, eventMult: 1, maintenanceCap: 0, morale: 0 };
  traitIds.forEach((id) => {
    const trait = traitById(id);
    if (!trait?.effects) return;
    Object.entries(trait.effects.prod || {}).forEach(([k, v]) => {
      out.prod[k] = (out.prod[k] || 1) * v;
    });
    if (trait.effects.hazardMult) out.hazardMult *= trait.effects.hazardMult;
    if (trait.effects.travelMult) out.travelMult *= trait.effects.travelMult;
    if (trait.effects.cargoMult) out.cargoMult *= trait.effects.cargoMult;
    if (trait.effects.eventMult) out.eventMult *= trait.effects.eventMult;
    if (trait.effects.maintenanceCap) out.maintenanceCap += trait.effects.maintenanceCap;
    if (trait.effects.morale) out.morale += trait.effects.morale;
  });
  return out;
}
function baseMaintenanceStats(base) {
  const used = Object.values(base.buildings || {}).reduce((sum, lvl) => sum + (lvl || 0), 0);
  const cap = 4 + ((base.buildings?.maintenance_bay || 0) * 2) + (traitEffects(base.traits).maintenanceCap || 0);
  const over = used > cap;
  const factor = over ? Math.max(0.6, 1 - (used - cap) * 0.08) : 1;
  return { used, cap, over, factor };
}
function baseWorkerCap(base) {
  const maintenance = base.buildings?.maintenance_bay || 0;
  const residentialBonus = base.zones?.residential ? 15 : 0;
  return 25 + maintenance * 5 + residentialBonus;
}
function baseWorkerTotals(base) {
  const assigned = base.workers?.assigned || { production: 0, maintenance: 0, research: 0 };
  const total = Object.values(assigned).reduce((sum, v) => sum + (v || 0), 0);
  return { assigned, total };
}
function baseWorkforceStats(base) {
  const { assigned, total } = baseWorkerTotals(base);
  const cap = baseWorkerCap(base);
  let efficiency = 0.5;
  if (total <= 5) efficiency = 0.5;
  else if (total <= 15) efficiency = 0.75;
  else if (total <= 25) efficiency = 1;
  else efficiency = 1 + Math.min(0.25, (total - 25) * 0.01);
  const productionShare = total > 0 ? assigned.production / total : 0;
  const maintenanceShare = total > 0 ? assigned.maintenance / total : 0;
  const researchShare = total > 0 ? assigned.research / total : 0;
  const productionMult = efficiency * (0.85 + productionShare * 0.3);
  const researchMult = efficiency * (0.85 + researchShare * 0.3);
  const eventRateMult = 1 - maintenanceShare * 0.3;
  const opsCooldownMult = 1 - maintenanceShare * 0.5;
  return { total, cap, assigned, efficiency, productionMult, researchMult, eventRateMult, opsCooldownMult };
}
function totalBaseWorkers(stateObj) {
  return Object.values(stateObj?.bases || {}).reduce((sum, base) => {
    const assigned = base?.workers?.assigned;
    if (!assigned) return sum;
    return sum + Object.values(assigned).reduce((acc, v) => acc + (v || 0), 0);
  }, 0);
}
function defaultPriority() {
  return { metal: 20, organics: 20, fuel: 20, food: 20, research: 20 };
}
function normalizePriority(priority) {
  const keys = ["metal", "organics", "fuel", "food", "research"];
  const cleaned = {};
  let total = 0;
  keys.forEach((key) => {
    const value = Number(priority?.[key]);
    const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
    cleaned[key] = safe;
    total += safe;
  });
  if (!total) return defaultPriority();
  const scale = 100 / total;
  keys.forEach((key) => {
    cleaned[key] = Math.round(cleaned[key] * scale);
  });
  const diff = 100 - keys.reduce((sum, key) => sum + cleaned[key], 0);
  if (diff !== 0) {
    const maxKey = keys.reduce((best, key) => (cleaned[key] > cleaned[best] ? key : best), keys[0]);
    cleaned[maxKey] += diff;
  }
  return cleaned;
}
function priorityMultiplier(priority, resource) {
  if (!priority || !Object.prototype.hasOwnProperty.call(priority, resource)) return 1;
  const values = Object.values(priority);
  const total = values.reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0);
  const count = values.length || 1;
  const baseline = total > 0 ? total / count : 20;
  const weight = Number.isFinite(priority[resource]) ? priority[resource] : baseline;
  const delta = (weight - baseline) / Math.max(1, baseline);
  const scaled = clamp(delta * 0.25, -0.25, 0.25);
  return 1 + scaled;
}
function ensureBaseState(base, body) {
  if (base) {
    const next = { ...base };
    if (!next.traits?.length) next.traits = rollTraits(body);
    if (!next.workers) next.workers = { total: 0, assigned: { production: 0, maintenance: 0, research: 0 } };
    if (!next.workers.assigned) next.workers.assigned = { production: 0, maintenance: 0, research: 0 };
    if (!Number.isFinite(next.workers.total)) {
      next.workers.total = Object.values(next.workers.assigned).reduce((sum, v) => sum + (v || 0), 0);
    }
    if (!next.zones) next.zones = { core: true };
    return next;
  }
  return defaultBaseState(body);
}
function baseTraitList(base) {
  return (base.traits || []).map(traitById).filter(Boolean);
}
function migrateSave(save) {
  let out = { ...save };
  const version = Number.isFinite(out.saveVersion) ? out.saveVersion : 0;
  if (version < 1) {
    out.milestonesUnlocked = out.milestonesUnlocked || [];
    out.codexUnlocked = out.codexUnlocked || [];
    out.systems = out.systems || [];
    out.colonies = out.colonies || [];
    out.galaxies = out.galaxies || [];
  }
  if (version < 4) {
    out.targetDepletion = out.targetDepletion || {};
    out.milestones = { ...(out.milestones || {}), depletionWarned: out.milestones?.depletionWarned || {} };
  }
  if (version < 5) {
    out.systems = (out.systems || []).map((system) => normalizeSystem(system));
    out.colonies = (out.colonies || []).map((colony) => ({
      ...colony,
      role: colony.role || "relay",
      distance: Number.isFinite(colony.distance) ? colony.distance : 4,
      createdAt: colony.createdAt || Date.now(),
    }));
  }
  if (version < 6) {
    out.systemEvents = out.systemEvents || [];
    out.integration = out.integration || { eventRateMult: 1, travelMult: 1, saturationRelief: 0, signalCapBonus: 0 };
    out.systems = (out.systems || []).map((system) => ({
      ...normalizeSystem(system),
      nextEventAt: system.nextEventAt || Date.now() + randomBetween(...SYSTEM_EVENT_COOLDOWN_MS),
      project: system.project || null,
    }));
  }
  if (version < 7) {
    out.galaxies = out.galaxies || [];
    out.activeGalaxyId = out.activeGalaxyId || (out.galaxies[0]?.id ?? null);
    out.doctrine = out.doctrine || null;
  }
  if (version < 8) {
    out.crewPrograms = out.crewPrograms || {};
  }
  if (version < 9) {
    out.crewRoster = out.crewRoster || [];
  }
  if (version < 10) {
    out.crewContracts = out.crewContracts || [];
    out.nextContractAt = out.nextContractAt || 0;
  }
  if (version < 11) {
    out.fragments = out.fragments || { recovered: 0 };
  }
  if (!out.population) {
    const total = Math.max(out.workers?.total || 0, 0);
    out.population = { total, progress: 0 };
  }
  if (out.bases && typeof out.bases === "object") {
    Object.entries(out.bases).forEach(([id, base]) => {
      if (!base) return;
      const assigned = base.workers?.assigned;
      if (!base.workers) base.workers = { total: 0, assigned: { production: 0, maintenance: 0, research: 0 } };
      if (!assigned) base.workers.assigned = { production: 0, maintenance: 0, research: 0 };
      if (!Number.isFinite(base.workers.total)) {
        base.workers.total = Object.values(base.workers.assigned).reduce((sum, v) => sum + (v || 0), 0);
      }
      if (!base.zones) base.zones = { core: true };
      const zoneSet = { ...(base.zones || { core: true }) };
      Object.entries(base.buildings || {}).forEach(([buildingId, lvl]) => {
        if (!lvl) return;
        const def = biomeBuildingById(buildingId);
        const zoneId = def?.zone;
        if (zoneId) zoneSet[zoneId] = true;
      });
      base.zones = zoneSet;
      out.bases[id] = base;
    });
  }
  if (!out.profile) out.profile = { name: "" };
  if (typeof out.profile?.name !== "string") out.profile.name = "";
  if (!out.fragments) out.fragments = { recovered: 0 };
  if (!Number.isFinite(out.fragments.recovered)) out.fragments.recovered = 0;
  if (!out.autoBalance) out.autoBalance = { enabled: true, mode: "balanced" };
  if (!out.priority) out.priority = { metal: 20, organics: 20, fuel: 20, food: 20, research: 20 };
  out.priority = normalizePriority(out.priority);
  if (out.tab === "missions" || out.tab === "bases") out.tab = "expeditions";

  if (!out.crewRoster?.length && out.workers?.total) {
    out.crewRoster = seedCrewRoster(out.workers);
  }
  out.crewRoster = (out.crewRoster || []).map((crew, idx) => ({
    ...crew,
    id: crew.id || `crew-${idx}-${Date.now()}`,
    focus: crew.focus || "production",
    fatigue: Number.isFinite(crew.fatigue) ? crew.fatigue : 0,
    temp: !!crew.temp,
    hiredAt: crew.hiredAt || 0,
  }));
  out.saveVersion = SAVE_VERSION;
  return out;
}
function baseBonuses(stateObj, bodyId) {
  const body = BODIES.find((b) => b.id === bodyId);
  const defs = body ? BIOME_BUILDINGS[body.type] || [] : [];
  const base = ensureBaseState(stateObj?.bases?.[bodyId], body || BODIES[0]);
  const traits = traitEffects(base.traits);
  let cargo = traits.cargoMult || 1;
  let travel = traits.travelMult || 1;
  let hazard = traits.hazardMult || 1;
  Object.entries(base.buildings || {}).forEach(([id, lvl]) => {
    const def = defs.find((d) => d.id === id);
    if (!def) return;
    if (def.cargoMult) cargo *= Math.pow(def.cargoMult, lvl || 0);
    if (def.travelMult) travel *= Math.pow(def.travelMult, lvl || 0);
    if (def.hazardMult) hazard *= Math.pow(def.hazardMult, lvl || 0);
  });
  return { cargo, travel, hazard };
}
function hubMissionBonuses(stateObj) {
  let travel = 1;
  HUB_BUILDINGS.forEach((def) => {
    if (!def.travelMult) return;
    const lvl = stateObj.hubBuildings?.[def.id] || 0;
    if (lvl > 0) travel *= Math.pow(def.travelMult, lvl);
  });
  return { travel };
}
function hubUpgradeMods(stateObj) {
  const upgrades = stateObj.hubUpgrades || {};
  const missionControl = upgrades.mission_control || 0;
  const supplyDepot = upgrades.supply_depot || 0;
  const signalVault = upgrades.signal_vault || 0;
  const habitatWing = upgrades.habitat_wing || 0;
  return {
    hazardMult: Math.pow(0.96, missionControl),
    fuelMult: Math.pow(0.95, supplyDepot),
    signalCapBonus: signalVault * 120,
    habitat: habitatWing * 2,
    morale: habitatWing * 0.01,
  };
}
function bodyById(id) { return BODIES.find((b) => b.id === id) || BODIES[0]; }
function withLogisticsCost(cost, body) {
  const logisticsFuel = Math.max(2, Math.floor((body?.travel || 0) / 25));
  return { ...cost, fuel: (cost.fuel || 0) + logisticsFuel };
}
function reduceCargo(cargo, factor) { const out = {}; Object.entries(cargo).forEach(([k, v]) => out[k] = Math.floor(v * factor)); return out; }
function scaleCargo(cargo, factor) {
  const out = {};
  Object.entries(cargo).forEach(([k, v]) => { out[k] = Math.max(0, Math.floor(v * factor)); });
  return out;
}
function signalSaturation(stateObj) {
  const galaxyMods = galaxyModifiers(stateObj);
  const doctrineMods = doctrineModifiers(stateObj);
  const hubMods = hubUpgradeMods(stateObj);
  const baseCap = 300 + (stateObj.hubUpgrades.scan_array || 0) * 140 + (stateObj.tech.deep_scan ? 220 : 0) + (stateObj.tech.rift_mapping ? 240 : 0);
  const integrationBonus = stateObj.integration?.signalCapBonus || 0;
  const capMult = galaxyMods.signalCapMult || 1;
  const cap = Math.max(150, Math.floor(baseCap * capMult) + integrationBonus + (doctrineMods.signalCapBonus || 0) + (hubMods.signalCapBonus || 0));
  const current = stateObj.resources.signal || 0;
  if (current <= cap) return { factor: 1, cap, penalty: 0 };
  const relief = clamp((stateObj.integration?.saturationRelief || 0) + (galaxyMods.saturationRelief || 0) + (doctrineMods.saturationRelief || 0), 0, 0.6);
  const over = (current - cap) / cap;
  const penalty = clamp(over * 0.45 * (1 - relief), 0, 0.7);
  return { factor: 1 - penalty, cap, penalty };
}
function galaxyDepth(stateObj) {
  const galaxies = stateObj.galaxies || [];
  if (!galaxies.length) return 0;
  return Math.max(...galaxies.map((g) => g.depth || 0));
}
function hubRange(state) {
  const relayBonus = colonyRoleCounts(state).relay || 0;
  return 1 + (state.hubUpgrades.scan_array || 0) + (state.tech.deep_scan ? 1 : 0) + (state.tech.rift_mapping ? 1 : 0) + relayBonus;
}
const FRAGMENT_MILESTONES = FRAGMENT_THRESHOLDS.map((threshold) => ({
  id: `M6_${threshold.id}`,
  title: threshold.title,
  codexEntryId: threshold.codexEntryId,
  message: threshold.message,
  condition: (state) => fragmentProgress(state).percent >= threshold.percent,
}));
const UNLOCKS = {
  missions: { signal: 60, hubLevel: 4 },
  tech: { signal: 80, research: 10 },
  crew: { signal: 90, hubLevel: 6, missions: 2 },
  bases: { signal: 120, missions: 4 },
  faction: { signal: 100, missions: 3 },
};
const MILESTONES = [
  { id: "M0_FOUNDATIONS", title: "Foundations Online", codexEntryId: "foundations", condition: (state) => true },
  { id: "M0_SIGNAL_UPLINK", title: "Signal Uplink Online", codexEntryId: "scan_ops", condition: (state) => (state.hubBuildings?.signal_uplink || 0) >= 1 },
  { id: "M1_LOCAL_OPS", title: "Local Operations", codexEntryId: "local_ops", condition: (state) => (state.resources.signal || 0) >= UNLOCKS.missions.signal && hubTotalLevel(state) >= UNLOCKS.missions.hubLevel },
  { id: "M1_TECH_ACCESS", title: "Research Grid Online", codexEntryId: "tech_ops", condition: (state) => (state.resources.signal || 0) >= UNLOCKS.tech.signal && (state.resources.research || 0) >= UNLOCKS.tech.research },
  { id: "M1_CREW_COMMAND", title: "Crew Command", codexEntryId: "crew_ops", condition: (state) => (state.resources.signal || 0) >= UNLOCKS.crew.signal && hubTotalLevel(state) >= UNLOCKS.crew.hubLevel && (state.milestones?.missionsDone || 0) >= UNLOCKS.crew.missions },
  { id: "M1_BASES_ONLINE", title: "Outpost Charter", codexEntryId: "base_ops", condition: (state) => (state.resources.signal || 0) >= UNLOCKS.bases.signal && (state.milestones?.missionsDone || 0) >= UNLOCKS.bases.missions },
  { id: "M1_NETWORK_LINK", title: "Relay Network Access", condition: (state) => (state.resources.signal || 0) >= UNLOCKS.faction.signal && (state.milestones?.missionsDone || 0) >= UNLOCKS.faction.missions },
  { id: "M2_SYSTEMS_DISCOVERED", title: "Systems Unlocked", codexEntryId: "systems_light", condition: (state) => hubRange(state) >= 3 },
  { id: "M2_FIRST_COLONY", title: "First Colony", codexEntryId: "colonies_anchor", condition: (state) => (state.colonies || []).length >= 1 },
  { id: "M3_INTEGRATION_UNLOCK", title: "Integration Projects", codexEntryId: "integration_projects", condition: (state) => (state.systems || []).some((s) => s.integratedAt) },
  { id: "M4_GALAXY_CHARTED", title: "Galaxy Charted", codexEntryId: "galaxy_ops", condition: (state) => galaxyDepth(state) >= 2 },
  { id: "M5_DOCTRINE_SELECTED", title: "Doctrine Selected", codexEntryId: "doctrine_ops", condition: (state) => !!state.doctrine },
  { id: "M4_PRESTIGE_UNLOCK", title: "Prestige Protocol Ready", codexEntryId: "prestige_recalibration", condition: (state) => galaxyDepth(state) >= 2 && (state.systems || []).filter((s) => s.integratedAt).length >= 2 && signalSaturation(state).penalty >= 0.25 },
  ...FRAGMENT_MILESTONES,
];
function bottleneckReport(stateObj, rates) {
  const alerts = [];
  if ((stateObj.resources.power || 0) <= 0 && (rates.power || 0) < 0) alerts.push("Power collapse: powered production halted and morale slipping.");
  if ((stateObj.resources.food || 0) <= 0 && (rates.food || 0) <= 0) alerts.push("Food deficit: crew morale dropping, output penalties stacking.");
  if ((stateObj.resources.fuel || 0) <= 0 && (rates.fuel || 0) <= 0) alerts.push("Fuel dry: logistics slowdown, intel throughput reduced, travel stretched.");
  if (alerts.length) return alerts;
  const drains = Object.entries(rates || {}).filter(([, v]) => v < 0);
  if (!drains.length) return ["No immediate bottlenecks detected."];
  drains.sort((a, b) => a[1] - b[1]);
  const [key, val] = drains[0];
  return [`${key} is the tightest drain (${val.toFixed(1)}/tick).`];
}
function bottleneckGuidance(stateObj, rates) {
  const guidance = [];
  const res = stateObj.resources || {};
  const missionsDone = stateObj.milestones?.missionsDone || 0;
  if ((res.power || 0) <= 0 && (rates.power || 0) < 0) {
    guidance.push({ title: "Restore power", detail: "Warm biomes feed organics for reactors. Prioritize Lava Rock and power bays." });
  }
  if ((res.fuel || 0) <= 0 && (rates.fuel || 0) <= 0) {
    guidance.push({ title: "Refuel the grid", detail: "Ice Moon and Cradle Station boost fuel. Build Fuel Refinery, Catalyst Cracker, or Hydrogen Cracker (after Advanced Refining)." });
  }
  if ((res.food || 0) <= 0 && (rates.food || 0) <= 0) {
    guidance.push({ title: "Stabilize food", detail: "Ice Moon yields food. Build Hydroponics or Bioforge to meet upkeep." });
  }
  if ((res.metal || 0) <= 0 && (rates.metal || 0) <= 0) {
    guidance.push({ title: "Secure metal", detail: "Debris Field and asteroid bases dominate metal output. Upgrade Salvage Dock/Ore Rigs." });
  }
  if ((res.organics || 0) <= 0 && (rates.organics || 0) <= 0) {
    guidance.push({ title: "Grow organics", detail: "Warm biomes and Biofilter Vats feed refiners and life support." });
  }
  if ((res.rare || 0) <= 0 && (rates.rare || 0) <= 0 && missionsDone >= 4) {
    guidance.push({ title: "Acquire rare materials", detail: "Unknown sites and anomaly labs provide rare stock for late upgrades." });
  }
  return guidance;
}
function createEvent(body) {
  const pool = {
    asteroid: [
      { name: "Hull Breach", desc: "Power loss and morale drop until patched.", effect: { mult: { metal: 0.7 }, moralePenalty: 0.08 }, cost: { metal: 20 }, requiresRole: "engineer" },
      { name: "Dust Clog", desc: "Signal arrays sluggish.", effect: { mult: { signal: 0.6 } }, cost: { fuel: 6 }, requiresRole: "engineer" },
    ],
    ice: [
      { name: "Cryo Leak", desc: "Fuel bleeding off.", effect: { mult: { fuel: 0.5 } }, cost: { metal: 14, fuel: 6 }, requiresRole: "engineer" },
      { name: "Frostbite", desc: "Crew morale falling in the cold.", effect: { moralePenalty: 0.1 }, cost: { food: 8 }, requiresRole: "botanist" },
    ],
    warm: [
      { name: "Heat Stress", desc: "Systems throttled to avoid melt.", effect: { mult: { fuel: 0.7, metal: 0.8 } }, cost: { metal: 18 }, requiresRole: "engineer" },
      { name: "Dust Storm", desc: "Visibility down, morale slipping.", effect: { mult: { signal: 0.7 }, moralePenalty: 0.06 }, cost: { food: 6 }, requiresRole: "miner" },
    ],
    unknown: [
      { name: "Anomaly Surge", desc: "Strange readings disrupt output.", effect: { mult: { rare: 0.5, metal: 0.8 }, moralePenalty: 0.08 }, cost: { rare: 2, metal: 20 }, requiresRole: "engineer" },
    ],
  };
  const list = pool[body.type] || pool.asteroid;
  const pick = list[Math.floor(Math.random() * list.length)];
  return { id: `${body.id}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`, bodyId: body.id, ...pick, status: "active" };
}
function missionYield(state, body, modeId, specialist = "none", efficiency = 1) {
  const base = body.resources || {};
  const drone = state.tech?.drone_log ? 0.2 : 0;
  const rareBonus = state.tech?.rift_mapping ? 0.2 : 0;
  const mult = 1 + drone + rareBonus;
  const bonuses = baseBonuses(state, body.id);
  const crewMods = crewProgramModifiers(state);
  const focusMods = crewFocusModifiers(state);
  const contractMods = crewContractModifiers(state);
  const colonyMods = colonyModifiers(state);
  const hubCargo = 1 + (state.hubUpgrades?.drone_bay || 0) * 0.08;
  const hubResearch = 1 + (state.hubUpgrades?.survey_lab || 0) * 0.08;
  const mode = missionModeById(modeId);
  const cargo = {};
  Object.entries(base).forEach(([k, v]) => {
    const modeBoost = mode?.reward?.[k] ?? mode?.reward?.all ?? 1;
    let specBoost = 1;
    if (specialist === "miner" && (k === "metal" || k === "rare")) specBoost = 1.15;
    if (specialist === "botanist" && (k === "organics" || k === "fuel")) specBoost = 1.15;
    if (specialist === "engineer" && (k === "research")) specBoost = 1.1;
    const crewMult = k === "research" ? (crewMods.researchMult || 1) * (focusMods.researchMult || 1) : 1;
    const focusMission = focusMods.missionMult?.[k] || 1;
    const contractMission = contractMods.missionMult?.[k] || 1;
    const contractCargo = contractMods.cargoMult || 1;
    const hubBoost = k === "research" ? hubResearch : 1;
    cargo[k] = Math.floor(v * mult * modeBoost * specBoost * (bonuses.cargo || 1) * (colonyMods.cargoMult || 1) * hubCargo * contractCargo * crewMult * focusMission * contractMission * hubBoost * efficiency * PACE.missionYieldMult);
  });
  return cargo;
}
function targetDepletion(stateObj, bodyId) {
  return clamp(stateObj.targetDepletion?.[bodyId] || 0, 0, 0.85);
}
function depletionFactor(stateObj, bodyId) {
  return clamp(1 - targetDepletion(stateObj, bodyId), 0.25, 1);
}
function depletionRate(body) {
  const tier = body.tier || 1;
  const base = 0.06 - (Math.max(0, tier - 1) * 0.005);
  return Math.max(0.02, base);
}
function makeObjective(body) {
  const tables = {
    asteroid: [
      { desc: "Scan derelict hull for data cores", reward: { research: 10, metal: 15 }, rewardText: "+10 research +15 metal", failRisk: 0.25 },
      { desc: "Detour to salvage pods", reward: { fuel: 8, metal: 12 }, rewardText: "+8 fuel +12 metal", failRisk: 0.2 },
    ],
    ice: [
      { desc: "Sample cryo vents", reward: { organics: 12, fuel: 6 }, rewardText: "+12 organics +6 fuel", failRisk: 0.25 },
      { desc: "Deep crevasse scan", reward: { research: 14 }, rewardText: "+14 research", failRisk: 0.3 },
    ],
    warm: [
      { desc: "Investigate thermal plumes", reward: { rare: 3, metal: 18 }, rewardText: "+3 rare +18 metal", failRisk: 0.35 },
      { desc: "Shield calibration drill", reward: { fuel: 10, research: 10 }, rewardText: "+10 fuel +10 research", failRisk: 0.25 },
    ],
    unknown: [
      { desc: "Probe anomaly rift", reward: { rare: 5, research: 25 }, rewardText: "+5 rare +25 research", failRisk: 0.4 },
      { desc: "Anchor relay node", reward: { fuel: 16, signal: 40 }, rewardText: "+16 fuel +40 signal", failRisk: 0.3 },
    ],
  };
  const list = tables[body.type] || tables.asteroid;
  const pick = list[Math.floor(Math.random() * list.length)];
  return pick;
}
function combineCargo(base, bonus) {
  const out = { ...base };
  Object.entries(bonus || {}).forEach(([k, v]) => { out[k] = (out[k] || 0) + v; });
  return out;
}
function randomSystemName(existing = []) {
  const taken = new Set(existing.map((s) => s.name));
  let name = "";
  let tries = 0;
  while (!name || taken.has(name)) {
    const prefix = SYSTEM_NAME_PARTS.prefix[Math.floor(Math.random() * SYSTEM_NAME_PARTS.prefix.length)];
    const suffix = SYSTEM_NAME_PARTS.suffix[Math.floor(Math.random() * SYSTEM_NAME_PARTS.suffix.length)];
    name = `${prefix} ${suffix}`;
    tries += 1;
    if (tries > 12) break;
  }
  return name;
}
function pickSystemTraits() {
  const picks = [];
  const pool = [...SYSTEM_TRAITS];
  const count = 2;
  while (picks.length < count && pool.length) {
    const idx = Math.floor(Math.random() * pool.length);
    const [trait] = pool.splice(idx, 1);
    if (trait) picks.push(trait.id);
  }
  return picks;
}
function normalizeSystem(system) {
  const distance = Number.isFinite(system.distance) ? system.distance : Math.floor(randomBetween(3, 10));
  const traits = Array.isArray(system.traits) && system.traits.length ? system.traits : pickSystemTraits();
  const stage = system.stage || (system.colonizedAt ? "colonized" : "scan");
  return {
    ...system,
    id: system.id || `sys-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    name: system.name || randomSystemName([]),
    distance,
    traits,
    stage,
    stability: Number.isFinite(system.stability) ? system.stability : 100,
    op: system.op || null,
    project: system.project || null,
    nextEventAt: system.nextEventAt || Date.now() + randomBetween(...SYSTEM_EVENT_COOLDOWN_MS),
    discoveredAt: system.discoveredAt || Date.now(),
  };
}
function generateSystems(count, existing = []) {
  const list = [];
  for (let i = 0; i < count; i += 1) {
    list.push(normalizeSystem({ name: randomSystemName(existing.concat(list)) }));
  }
  return list;
}
function targetSystemCount(stateObj) {
  const range = hubRange(stateObj);
  if (range < 3) return 0;
  const extra = Math.max(0, Math.floor(range - 3));
  const galaxyBonus = galaxyModifiers(stateObj).systemCountBonus || 0;
  return Math.min(6, Math.max(1, 3 + extra + galaxyBonus));
}
function nextSurveyStage(stage) {
  const idx = SURVEY_SEQUENCE.indexOf(stage);
  if (idx === -1 || idx >= SURVEY_SEQUENCE.length - 1) return stage;
  return SURVEY_SEQUENCE[idx + 1];
}
function colonyRoleById(id) { return COLONY_ROLES.find((r) => r.id === id) || COLONY_ROLES[0]; }
function colonyRoleCounts(stateObj) {
  return (stateObj.colonies || []).reduce((acc, colony) => {
    acc[colony.role] = (acc[colony.role] || 0) + 1;
    return acc;
  }, { relay: 0, survey: 0, logistics: 0 });
}
function systemEventModifiers(stateObj) {
  const mods = { cargoMult: 1, travelMult: 1, scanMult: 1, surveySpeed: 1, hazardMult: 1, stabilityDrain: 0 };
  (stateObj.systemEvents || []).forEach((ev) => {
    const effect = ev.effect || {};
    if (effect.cargoMult) mods.cargoMult *= effect.cargoMult;
    if (effect.travelMult) mods.travelMult *= effect.travelMult;
    if (effect.scanMult) mods.scanMult *= effect.scanMult;
    if (effect.surveySpeed) mods.surveySpeed *= effect.surveySpeed;
    if (effect.hazardMult) mods.hazardMult *= effect.hazardMult;
    if (effect.stabilityDrain) mods.stabilityDrain += effect.stabilityDrain;
  });
  return mods;
}
function crewProgramModifiers(stateObj) {
  const levels = stateObj.crewPrograms || {};
  const mods = {
    cargoMult: 1,
    objectiveBonus: 0,
    hazardMult: 1,
    travelMult: 1,
    fuelMult: 1,
    scanMult: 1,
    researchMult: 1,
    baseEventRateMult: 1,
    systemEventRateMult: 1,
    moraleBonus: 0,
    stabilityRecovery: 0,
  };
  const missionLvl = levels.mission_corps || 0;
  if (missionLvl) {
    mods.cargoMult *= 1 + missionLvl * 0.03;
    mods.objectiveBonus += missionLvl * 0.02;
    mods.hazardMult *= Math.max(0.88, 1 - missionLvl * 0.01);
  }
  const baseLvl = levels.base_command || 0;
  if (baseLvl) {
    mods.baseEventRateMult *= 1 + baseLvl * 0.08;
    mods.systemEventRateMult *= 1 + baseLvl * 0.06;
    mods.stabilityRecovery += baseLvl * 0.0015;
  }
  const scienceLvl = levels.science_guild || 0;
  if (scienceLvl) {
    mods.scanMult *= 1 + scienceLvl * 0.06;
    mods.researchMult *= 1 + scienceLvl * 0.05;
  }
  const logisticsLvl = levels.logistics_wing || 0;
  if (logisticsLvl) {
    mods.travelMult *= Math.max(0.84, 1 - logisticsLvl * 0.03);
    mods.fuelMult *= Math.max(0.82, 1 - logisticsLvl * 0.03);
  }
  const moraleLvl = levels.morale_office || 0;
  if (moraleLvl) {
    mods.moraleBonus += moraleLvl * 0.02;
  }
  return mods;
}
function assignCrewRoster(stateObj) {
  const roster = [...(stateObj.crewRoster || [])].sort((a, b) => (a.hiredAt || 0) - (b.hiredAt || 0));
  const assignedLeft = {
    miner: stateObj.workers?.assigned?.miner || 0,
    botanist: stateObj.workers?.assigned?.botanist || 0,
    engineer: stateObj.workers?.assigned?.engineer || 0,
  };
  return roster.map((crew) => {
    const assigned = (assignedLeft[crew.role] || 0) > 0;
    if (assigned) assignedLeft[crew.role] -= 1;
    return { ...crew, assigned };
  });
}
function crewFatigueStats(stateObj) {
  const assigned = assignCrewRoster(stateObj);
  const totals = { miner: 0, botanist: 0, engineer: 0 };
  const counts = { miner: 0, botanist: 0, engineer: 0 };
  let allFatigue = 0;
  let allCount = 0;
  assigned.forEach((crew) => {
    if (!crew.assigned) return;
    const fatigue = Number.isFinite(crew.fatigue) ? crew.fatigue : 0;
    totals[crew.role] += fatigue;
    counts[crew.role] += 1;
    allFatigue += fatigue;
    allCount += 1;
  });
  const byRole = {
    miner: counts.miner ? totals.miner / counts.miner : 0,
    botanist: counts.botanist ? totals.botanist / counts.botanist : 0,
    engineer: counts.engineer ? totals.engineer / counts.engineer : 0,
  };
  const avgAssigned = allCount ? allFatigue / allCount : 0;
  return { byRole, avgAssigned };
}
function crewFocusModifiers(stateObj) {
  const assigned = assignCrewRoster(stateObj);
  const prodCounts = { miner: 0, botanist: 0, engineer: 0 };
  let researchCount = 0;
  let recoveryCount = 0;
  let minerOre = 0;
  let minerSalvage = 0;
  let botanistNutrition = 0;
  let botanistBiofuel = 0;
  let engineerStability = 0;
  let engineerAutomation = 0;
  assigned.forEach((crew) => {
    if (!crew.assigned) return;
    const focus = crew.focus || "production";
    if (focus === "production") prodCounts[crew.role] += 1;
    if (focus === "research") researchCount += 1;
    if (focus === "recovery") recoveryCount += 1;
    if (crew.role === "miner" && focus === "ore") minerOre += 1;
    if (crew.role === "miner" && focus === "salvage") minerSalvage += 1;
    if (crew.role === "botanist" && focus === "nutrition") botanistNutrition += 1;
    if (crew.role === "botanist" && focus === "biofuel") botanistBiofuel += 1;
    if (crew.role === "engineer" && focus === "stability") engineerStability += 1;
    if (crew.role === "engineer" && focus === "automation") engineerAutomation += 1;
  });
  return {
    roleProdBonus: {
      miner: Math.min(0.12, prodCounts.miner * 0.02),
      botanist: Math.min(0.12, prodCounts.botanist * 0.02),
      engineer: Math.min(0.12, prodCounts.engineer * 0.02),
    },
    minerOreMult: 1 + Math.min(0.18, minerOre * 0.03),
    missionMult: {
      metal: 1 + Math.min(0.12, minerOre * 0.02),
      rare: 1 + Math.min(0.08, minerOre * 0.02),
    },
    cargoMult: 1 + Math.min(0.12, minerSalvage * 0.02),
    botanistNutritionMult: 1 + Math.min(0.15, botanistNutrition * 0.03),
    fuelProdMult: 1 + Math.min(0.15, botanistBiofuel * 0.03),
    hazardMult: Math.max(0.85, 1 - engineerStability * 0.02),
    baseEventRateMult: Math.max(0.85, 1 - engineerStability * 0.03),
    systemEventRateMult: Math.max(0.85, 1 - engineerStability * 0.03),
    travelMult: Math.max(0.85, 1 - engineerAutomation * 0.02),
    scanMult: 1 + Math.min(0.2, researchCount * 0.02),
    researchMult: 1 + Math.min(0.2, researchCount * 0.02),
    fatigueGainMult: Math.max(0.7, 1 - recoveryCount * 0.05),
    fatigueRecoveryMult: 1 + Math.min(0.5, recoveryCount * 0.05),
  };
}
function crewContractModifiers(stateObj) {
  const mods = {
    cargoMult: 1,
    travelMult: 1,
    hazardMult: 1,
    scanMult: 1,
    researchMult: 1,
    baseEventRateMult: 1,
    systemEventRateMult: 1,
    moraleBonus: 0,
    prodMult: {},
    missionMult: {},
  };
  (stateObj.crewRoster || []).forEach((crew) => {
    if (!crew.temp || !crew.mods) return;
    const m = crew.mods || {};
    if (m.cargoMult) mods.cargoMult *= m.cargoMult;
    if (m.travelMult) mods.travelMult *= m.travelMult;
    if (m.hazardMult) mods.hazardMult *= m.hazardMult;
    if (m.scanMult) mods.scanMult *= m.scanMult;
    if (m.researchMult) mods.researchMult *= m.researchMult;
    if (m.baseEventRateMult) mods.baseEventRateMult *= m.baseEventRateMult;
    if (m.systemEventRateMult) mods.systemEventRateMult *= m.systemEventRateMult;
    if (m.moraleBonus) mods.moraleBonus += m.moraleBonus;
    Object.entries(m.prodMult || {}).forEach(([k, v]) => {
      mods.prodMult[k] = (mods.prodMult[k] || 1) * v;
    });
    Object.entries(m.missionMult || {}).forEach(([k, v]) => {
      mods.missionMult[k] = (mods.missionMult[k] || 1) * v;
    });
  });
  return mods;
}
function crewTrainingTier(stateObj) {
  const levels = Object.values(stateObj.crewPrograms || {}).reduce((sum, level) => sum + level, 0);
  if (levels >= 9) return 3;
  if (levels >= 6) return 2;
  if (levels >= 3) return 1;
  return 0;
}
function galaxyById(id) { return GALAXY_RULESETS.find((g) => g.id === id) || GALAXY_RULESETS[0]; }
function activeGalaxy(stateObj) {
  const galaxies = stateObj.galaxies || [];
  if (!galaxies.length) return null;
  return galaxies.find((g) => g.id === stateObj.activeGalaxyId) || galaxies[0];
}
function doctrineById(id) { return DOCTRINES.find((d) => d.id === id); }
function doctrineModifiers(stateObj) {
  if (!stateObj.doctrine) return {};
  return doctrineById(stateObj.doctrine)?.mods || {};
}
function galaxyModifiers(stateObj) {
  const galaxy = activeGalaxy(stateObj);
  const ruleset = galaxyById(galaxy?.rulesetId);
  return ruleset?.mods || {};
}
function colonyCapacityCost(colony) {
  const distance = Number.isFinite(colony.distance) ? colony.distance : 4;
  return 1 + Math.floor(distance / 4);
}
function commandUsage(stateObj) {
  const capacity = commandCapacity(stateObj);
  const used = (stateObj.colonies || []).reduce((sum, colony) => sum + colonyCapacityCost(colony), 0);
  const over = Math.max(0, used - capacity);
  return { used, capacity, over };
}
function colonyModifiers(stateObj) {
  const counts = colonyRoleCounts(stateObj);
  const systemMods = systemEventModifiers(stateObj);
  const integration = stateObj.integration || { eventRateMult: 1, travelMult: 1, saturationRelief: 0, signalCapBonus: 0 };
  const galaxyMods = galaxyModifiers(stateObj);
  const doctrineMods = doctrineModifiers(stateObj);
  const crewMods = crewProgramModifiers(stateObj);
  const focusMods = crewFocusModifiers(stateObj);
  const contractMods = crewContractModifiers(stateObj);
  const relayRange = counts.relay || 0;
  const scanMult = (1 + Math.min(0.3, counts.survey * 0.1)) * (systemMods.scanMult || 1) * (galaxyMods.scanMult || 1) * (doctrineMods.scanMult || 1) * (crewMods.scanMult || 1) * (focusMods.scanMult || 1) * (contractMods.scanMult || 1);
  const surveySpeed = Math.max(0.75, 1 - counts.survey * 0.05) * (systemMods.surveySpeed || 1);
  const objectiveBonus = Math.min(0.2, counts.survey * 0.05);
  const travelMult = Math.max(0.8, 1 - counts.logistics * 0.05) * (integration.travelMult || 1) * (systemMods.travelMult || 1) * (galaxyMods.travelMult || 1) * (doctrineMods.travelMult || 1) * (crewMods.travelMult || 1) * (focusMods.travelMult || 1) * (contractMods.travelMult || 1);
  const fuelMult = Math.max(0.8, 1 - counts.logistics * 0.04);
  const cargoMult = (1 + Math.min(0.2, counts.logistics * 0.04)) * (systemMods.cargoMult || 1) * (galaxyMods.cargoMult || 1) * (doctrineMods.cargoMult || 1) * (crewMods.cargoMult || 1) * (focusMods.cargoMult || 1) * (contractMods.cargoMult || 1);
  const command = commandUsage(stateObj);
  const overCargo = Math.max(0.7, 1 - command.over * 0.07);
  const overTravel = 1 + command.over * 0.08;
  const stabilityDrain = command.over > 0 ? command.over * 0.01 : 0;
  return {
    relayRange,
    scanMult,
    surveySpeed,
    objectiveBonus,
    travelMult: travelMult * overTravel,
    fuelMult: fuelMult * (crewMods.fuelMult || 1),
    cargoMult: cargoMult * overCargo,
    command,
    stabilityDrain: stabilityDrain + (systemMods.stabilityDrain || 0),
    hazardMult: (systemMods.hazardMult || 1) * (galaxyMods.hazardMult || 1) * (doctrineMods.hazardMult || 1) * (focusMods.hazardMult || 1) * (contractMods.hazardMult || 1),
    eventRateMult: (integration.eventRateMult || 1) * (galaxyMods.eventRateMult || 1) * (doctrineMods.eventRateMult || 1) * (crewMods.systemEventRateMult || 1) * (focusMods.systemEventRateMult || 1) * (contractMods.systemEventRateMult || 1),
    integration,
    galaxyMods,
    doctrineMods,
    crewMods,
    focusMods,
    contractMods,
  };
}
function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (h * 131 + str.charCodeAt(i)) >>> 0; }
  return h.toString(16);
}
function xorString(str, salt) {
  let out = "";
  for (let i = 0; i < str.length; i++) {
    out += String.fromCharCode(str.charCodeAt(i) ^ salt.charCodeAt(i % salt.length));
  }
  return out;
}
function hasPrereqs(state, tech) { return (tech.requires || []).every((id) => state.tech[id]); }
function canAffordUI(resources, cost) { return Object.entries(cost).every(([k, v]) => (resources[k] || 0) >= v); }
function costText(cost, format) { return Object.entries(cost).map(([k, v]) => `${format(v)} ${k}`).join(', '); }
function formatDuration(ms) { const sec = Math.max(0, Math.ceil(ms / 1000)); const m = Math.floor(sec / 60); const s = sec % 60; return m > 0 ? `${m}m ${s}s` : `${s}s`; }
function hubTierUnlockStatus(stateObj, tier) {
  const rules = HUB_BUILDING_TIERS?.[tier] || {};
  const reasons = [];
  const hubLevel = hubTotalLevel(stateObj);
  const missionsDone = stateObj.milestones?.missionsDone || 0;
  const signal = stateObj.resources?.signal || 0;
  if (rules.signal && signal < rules.signal) reasons.push(`Signal ${Math.floor(signal)}/${rules.signal}`);
  if (rules.hubLevel && hubLevel < rules.hubLevel) reasons.push(`Nexus level ${hubLevel}/${rules.hubLevel}`);
  if (rules.missions && missionsDone < rules.missions) reasons.push(`Expeditions ${missionsDone}/${rules.missions}`);
  if (rules.tech && !stateObj.tech?.[rules.tech]) {
    const techName = TECH.find((tech) => tech.id === rules.tech)?.name || rules.tech;
    reasons.push(`Research: ${techName}`);
  }
  if (rules.milestone && !(stateObj.milestonesUnlocked || []).includes(rules.milestone)) reasons.push("Milestone not met");
  return { unlocked: reasons.length === 0, reasons };
}
function hubBuildingUnlockStatus(stateObj, def) {
  const tierStatus = hubTierUnlockStatus(stateObj, def.tier || 0);
  if (!tierStatus.unlocked) return tierStatus;
  const reasons = [];
  const unlock = def.unlock || {};
  if (unlock.signal && (stateObj.resources?.signal || 0) < unlock.signal) reasons.push(`Signal ${Math.floor(stateObj.resources.signal || 0)}/${unlock.signal}`);
  if (unlock.hubLevel && hubTotalLevel(stateObj) < unlock.hubLevel) reasons.push(`Nexus level ${hubTotalLevel(stateObj)}/${unlock.hubLevel}`);
  if (unlock.missions && (stateObj.milestones?.missionsDone || 0) < unlock.missions) reasons.push(`Expeditions ${stateObj.milestones?.missionsDone || 0}/${unlock.missions}`);
  if (unlock.tech && !stateObj.tech?.[unlock.tech]) {
    const techName = TECH.find((tech) => tech.id === unlock.tech)?.name || unlock.tech;
    reasons.push(`Research: ${techName}`);
  }
  if (unlock.milestone && !(stateObj.milestonesUnlocked || []).includes(unlock.milestone)) reasons.push("Milestone not met");
  (unlock.requires || []).forEach((req) => {
    const level = stateObj.hubBuildings?.[req.id] || 0;
    const name = HUB_BUILDINGS.find((b) => b.id === req.id)?.name || req.id;
    if (level < (req.level || 1)) reasons.push(`${name} Lv ${level}/${req.level}`);
  });
  return { unlocked: reasons.length === 0, reasons };
}
function hubUpgradeUnlockStatus(stateObj, def) {
  const level = stateObj.hubUpgrades?.[def.id] || 0;
  const unlockAt = (level + 1) * HUB_TIER_STEP;
  const hubLevel = hubTotalLevel(stateObj);
  const reasons = [];
  if (hubLevel < unlockAt) reasons.push(`Nexus level ${hubLevel}/${unlockAt}`);
  const unlock = def.unlock || {};
  if (unlock.signal && (stateObj.resources?.signal || 0) < unlock.signal) reasons.push(`Signal ${Math.floor(stateObj.resources.signal || 0)}/${unlock.signal}`);
  if (unlock.missions && (stateObj.milestones?.missionsDone || 0) < unlock.missions) reasons.push(`Expeditions ${stateObj.milestones?.missionsDone || 0}/${unlock.missions}`);
  if (unlock.tech && !stateObj.tech?.[unlock.tech]) {
    const techName = TECH.find((tech) => tech.id === unlock.tech)?.name || unlock.tech;
    reasons.push(`Research: ${techName}`);
  }
  if (unlock.milestone && !(stateObj.milestonesUnlocked || []).includes(unlock.milestone)) reasons.push("Milestone not met");
  (def.requires || []).forEach((req) => {
    const lvl = stateObj.hubBuildings?.[req.id] || 0;
    const name = HUB_BUILDINGS.find((b) => b.id === req.id)?.name || req.id;
    if (lvl < (req.level || 1)) reasons.push(`${name} Lv ${lvl}/${req.level}`);
  });
  return { unlocked: reasons.length === 0, reasons, unlockAt };
}
function isUnlockedUI(state, body) {
  if ((body.tier || 1) > hubRange(state)) return false;
  if (body.requireTech && !state.tech[body.requireTech]) return false;
  if (body.requireMissions && (state.milestones?.missionsDone || 0) < body.requireMissions) return false;
  return (state.resources.signal || 0) >= Math.ceil((body.unlock || 0) * PACE.bodyUnlockMult);
}
function commandCapacity(state) {
  const galaxyBonus = galaxyModifiers(state).commandCapBonus || 0;
  const doctrineBonus = doctrineModifiers(state).commandCapBonus || 0;
  return 1 + (state.hubUpgrades.launch_bay || 0) + (state.hubUpgrades.command_uplink || 0) + (state.tech.auto_pilots ? 1 : 0) + galaxyBonus + doctrineBonus;
}
function deriveCapabilities(state) {
  const unlocked = new Set(state.milestonesUnlocked || []);
  const systemsUnlocked = unlocked.has("M2_SYSTEMS_DISCOVERED") || unlocked.has("M1_SYSTEMS_DISCOVERED");
  return {
    missions: unlocked.has("M1_LOCAL_OPS"),
    bases: unlocked.has("M1_BASES_ONLINE"),
    crew: unlocked.has("M1_CREW_COMMAND"),
    tech: unlocked.has("M1_TECH_ACCESS"),
    systems: systemsUnlocked,
    faction: unlocked.has("M1_NETWORK_LINK"),
    colonies: unlocked.has("M2_FIRST_COLONY"),
    integration: unlocked.has("M3_INTEGRATION_UNLOCK"),
    prestige: unlocked.has("M4_PRESTIGE_UNLOCK"),
  };
}
function buildNavTabs(capabilities, supabaseReady) {
  const tabs = [{ id: "hub", label: "Hub" }];
  if (capabilities.missions || capabilities.bases) tabs.push({ id: "expeditions", label: "Expeditions" });
  if (capabilities.crew) tabs.push({ id: "crew", label: "Crew" });
  if (capabilities.tech) tabs.push({ id: "tech", label: "Research Command" });
  if (capabilities.systems) tabs.push({ id: "systems", label: "Systems" });
  if (capabilities.faction && supabaseReady) tabs.push({ id: "faction", label: "Faction" });
  tabs.push({ id: "codex", label: "Codex" });
  tabs.push({ id: "wiki", label: "Wiki" });
  tabs.push({ id: "log", label: "Log" });
  return tabs;
}
function unlockHintText(state, supabaseReady) {
  const unlocked = new Set(state.milestonesUnlocked || []);
  const hubLevel = hubTotalLevel(state);
  const missionsDone = state.milestones?.missionsDone || 0;
  const signal = state.resources.signal || 0;
  const research = state.resources.research || 0;
  const range = hubRange(state);
  const hints = [];
  if (!unlocked.has("M1_LOCAL_OPS")) {
    hints.push({
      id: "missions",
      title: "Expedition Command",
      reqs: [
        `Signal ${Math.floor(signal)}/${UNLOCKS.missions.signal}`,
        `Nexus level ${hubLevel}/${UNLOCKS.missions.hubLevel}`,
      ],
    });
  }
  if (!unlocked.has("M1_TECH_ACCESS")) {
    hints.push({
      id: "tech",
      title: "Research Command",
      reqs: [
        `Signal ${Math.floor(signal)}/${UNLOCKS.tech.signal}`,
        `Research ${Math.floor(research)}/${UNLOCKS.tech.research}`,
      ],
    });
  }
  if (!unlocked.has("M1_CREW_COMMAND")) {
    hints.push({
      id: "crew",
      title: "Crew Command",
      reqs: [
        `Signal ${Math.floor(signal)}/${UNLOCKS.crew.signal}`,
        `Nexus level ${hubLevel}/${UNLOCKS.crew.hubLevel}`,
        `Expeditions ${missionsDone}/${UNLOCKS.crew.missions}`,
      ],
    });
  }
  if (!unlocked.has("M1_BASES_ONLINE")) {
    hints.push({
      id: "bases",
      title: "Outpost Charter",
      reqs: [
        `Signal ${Math.floor(signal)}/${UNLOCKS.bases.signal}`,
        `Expeditions ${missionsDone}/${UNLOCKS.bases.missions}`,
      ],
    });
  }
  if (supabaseReady && !unlocked.has("M1_NETWORK_LINK")) {
    hints.push({
      id: "faction",
      title: "Relay Network",
      reqs: [
        `Signal ${Math.floor(signal)}/${UNLOCKS.faction.signal}`,
        `Expeditions ${missionsDone}/${UNLOCKS.faction.missions}`,
      ],
    });
  }
  if (!unlocked.has("M2_SYSTEMS_DISCOVERED")) {
    hints.push({
      id: "systems",
      title: "Systems Grid",
      reqs: [`Range tier ${range}/3`],
    });
  }
  return hints;
}
