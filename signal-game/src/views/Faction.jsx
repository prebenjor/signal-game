import React, { useMemo, useState } from "react";
import { FACTION_BUILDINGS, FACTION_DIRECTIVES } from "../game/data";

const BUFF_LABELS = {
  scanMult: "Scan yield",
  travelMult: "Travel time",
  hazardMult: "Hazard exposure",
  missionCargo: "Mission cargo",
  rangeBonus: "Range tier",
  researchMult: "Research output",
  signalMult: "Signal output",
  eventRateMult: "Event rate",
};

const RESOURCE_OPTIONS = [
  { id: "metal", label: "Metal" },
  { id: "fuel", label: "Fuel" },
  { id: "research", label: "Research" },
  { id: "signal", label: "Signal" },
  { id: "organics", label: "Organics" },
  { id: "rare", label: "Rare" },
];

const TABS = [
  { id: "ops", label: "Operations" },
  { id: "construction", label: "Construction" },
  { id: "directives", label: "Directives" },
  { id: "allegiance", label: "Allegiance" },
  { id: "network", label: "Network" },
];

const NETWORK_FEATURES = [
  { id: "convoys", name: "Convoy Runs", desc: "Time-boxed supply convoys that grant shared loot when completed.", status: "Prototype" },
  { id: "anomaly", name: "Anomaly Broadcasts", desc: "Global scans surface rare targets; factions race for first lock.", status: "Concept" },
  { id: "faction_ops", name: "Faction Ops", desc: "Scheduled ops where donations unlock temporary buffs or events.", status: "Draft" },
  { id: "relay_war", name: "Relay Warfronts", desc: "Soft PvP scoreboards where factions compete on stability metrics.", status: "Concept" },
];

const formatPercent = (value) => `${Math.round(value * 100)}%`;

function formatBuffs(buffs) {
  if (!buffs) return [];
  return Object.entries(buffs).map(([key, value]) => {
    const label = BUFF_LABELS[key] || key;
    if (typeof value === "number") {
      if (value > 0 && value < 2) return `${label} ${(value - 1) >= 0 ? "+" : ""}${formatPercent(value - 1)}`;
      if (value < 0) return `${label} ${formatPercent(value)}`;
      return `${label} x${value}`;
    }
    return `${label} ${String(value)}`;
  });
}

function projectTotals(project) {
  const goalEntries = Object.entries(project?.goal || {});
  const progressEntries = goalEntries.map(([key, goal]) => [key, Math.min(project?.progress?.[key] || 0, goal)]);
  const totalGoal = goalEntries.reduce((sum, [, goal]) => sum + Number(goal || 0), 0);
  const totalProgress = progressEntries.reduce((sum, [, val]) => sum + Number(val || 0), 0);
  const percent = totalGoal > 0 ? totalProgress / totalGoal : 0;
  return { goalEntries, progressEntries, totalGoal, totalProgress, percent };
}

function baseGoal(def) {
  return def?.baseGoal || def?.goal || {};
}

function tierScale(def) {
  return Number.isFinite(def?.tierScale) ? def.tierScale : 1;
}

function goalForTier(def, tier) {
  const scale = tierScale(def);
  const goal = baseGoal(def);
  const out = {};
  Object.entries(goal).forEach(([key, value]) => {
    out[key] = Math.round(Number(value || 0) * Math.pow(scale, Math.max(0, tier - 1)));
  });
  return out;
}

function progressForTier(def, progress, tier) {
  const scale = tierScale(def);
  const goal = baseGoal(def);
  const out = {};
  Object.entries(goal).forEach(([key, value]) => {
    const base = Number(value || 0);
    const total = Number(progress?.[key] || 0);
    const prev = scale === 1
      ? base * Math.max(0, tier - 1)
      : base * (Math.pow(scale, Math.max(0, tier - 1)) - 1) / (scale - 1);
    out[key] = Math.max(0, total - prev);
  });
  return out;
}

function buildingTotals(def, progress, tier) {
  const goal = goalForTier(def, tier);
  const tierProgress = progressForTier(def, progress, tier);
  const goalEntries = Object.entries(goal);
  const progressEntries = goalEntries.map(([key, goalValue]) => [key, Math.min(tierProgress?.[key] || 0, goalValue)]);
  const totalGoal = goalEntries.reduce((sum, [, goal]) => sum + Number(goal || 0), 0);
  const totalProgress = progressEntries.reduce((sum, [, val]) => sum + Number(val || 0), 0);
  const percent = totalGoal > 0 ? totalProgress / totalGoal : 0;
  return { goalEntries, progressEntries, totalGoal, totalProgress, percent };
}

function isTierComplete(def, progress, tier) {
  const goal = goalForTier(def, tier);
  return Object.entries(goal).every(([key, value]) => (progress?.[key] || 0) >= value);
}

const resourceLabel = (id) => RESOURCE_OPTIONS.find((opt) => opt.id === id)?.label || id;

export default function FactionView({
  profileName,
  currentUserId,
  supabaseReady,
  factions,
  projects,
  buildings,
  buildingsError,
  activity,
  donations,
  chat,
  activityError,
  donationsError,
  chatError,
  membership,
  loading,
  error,
  leaderboard,
  leaderboardError,
  onJoin,
  onDonate,
  onDonateBuilding,
  onSendChat,
  resources,
  format,
}) {
  const needsName = !profileName?.trim();
  const [pane, setPane] = useState("ops");
  const [donateResource, setDonateResource] = useState("metal");
  const [donateAmount, setDonateAmount] = useState(100);
  const [buildResource, setBuildResource] = useState("metal");
  const [buildAmount, setBuildAmount] = useState(100);
  const [chatDraft, setChatDraft] = useState("");
  const [chatStatus, setChatStatus] = useState(null);
  const [status, setStatus] = useState(null);

  const activeFaction = useMemo(() => factions.find((f) => f.id === membership?.faction_id), [factions, membership]);
  const activeProject = useMemo(() => projects[membership?.faction_id], [projects, membership]);
  const activeFactionId = membership?.faction_id || null;
  const buffs = useMemo(() => formatBuffs(activeProject?.buff || activeFaction?.buffs || {}), [activeProject, activeFaction]);
  const totals = useMemo(() => projectTotals(activeProject), [activeProject]);
  const buildingDefs = useMemo(() => (activeFactionId ? (FACTION_BUILDINGS[activeFactionId] || []) : []), [activeFactionId]);
  const buildingProgress = useMemo(() => (activeFactionId ? (buildings?.[activeFactionId] || {}) : {}), [activeFactionId, buildings]);
  const directives = useMemo(() => (activeFactionId ? (FACTION_DIRECTIVES[activeFactionId] || []) : []), [activeFactionId]);
  const buildingTierMap = useMemo(() => {
    const out = {};
    buildingDefs.forEach((def) => {
      const row = buildingProgress[def.id] || {};
      out[def.id] = {
        tier: Math.max(1, row.tier || 1),
        completed: row.completed_tier || 0,
      };
    });
    return out;
  }, [buildingDefs, buildingProgress]);

  const canDonate =
    supabaseReady &&
    !!onDonate &&
    !needsName &&
    !!membership?.faction_id &&
    Number.isFinite(donateAmount) &&
    donateAmount > 0 &&
    (resources?.[donateResource] || 0) >= donateAmount;

  const canDonateBuilding =
    supabaseReady &&
    !!onDonateBuilding &&
    !needsName &&
    !!membership?.faction_id &&
    Number.isFinite(buildAmount) &&
    buildAmount > 0 &&
    (resources?.[buildResource] || 0) >= buildAmount;

  const canSendChat =
    supabaseReady &&
    !!onSendChat &&
    !needsName &&
    !!membership?.faction_id &&
    !!chatDraft.trim();

  const handleJoin = async (id) => {
    if (!onJoin) return;
    setStatus(null);
    const result = await onJoin(id);
    if (result?.message) setStatus(result.message);
  };

  const handleDonate = async () => {
    if (!onDonate) return;
    setStatus(null);
    const result = await onDonate(donateResource, donateAmount);
    if (result?.message) setStatus(result.message);
  };

  const handleDonateBuilding = async (buildingId) => {
    if (!onDonateBuilding) return;
    setStatus(null);
    const result = await onDonateBuilding(buildingId, buildResource, buildAmount);
    if (result?.message) setStatus(result.message);
  };

  const handleSendChat = async () => {
    if (!onSendChat) return;
    const message = chatDraft.trim();
    if (!message) return;
    setChatStatus(null);
    const result = await onSendChat(message);
    if (result?.ok) setChatDraft("");
    if (result?.message) setChatStatus(result.message);
  };

  const standings = useMemo(() => {
    return factions
      .map((faction) => {
        const project = projects[faction.id];
        const totals = projectTotals(project);
        return {
          id: faction.id,
          name: faction.name,
          percent: totals.percent || 0,
          totalGoal: totals.totalGoal || 0,
          totalProgress: totals.totalProgress || 0,
        };
      })
      .sort((a, b) => b.percent - a.percent);
  }, [factions, projects]);

  const leaderboardRows = useMemo(() => leaderboard || [], [leaderboard]);
  const formatPilot = (row) => {
    if (!row) return "Pilot";
    if (currentUserId && row.user_id === currentUserId && profileName?.trim()) return profileName.trim();
    if (row.callsign) return row.callsign;
    const id = row.user_id || "";
    return id ? `Pilot ${id.slice(0, 6)}` : "Pilot";
  };

  const activityRows = useMemo(() => activity || [], [activity]);
  const donationRows = useMemo(() => donations || [], [donations]);
  const chatRows = useMemo(() => chat || [], [chat]);
  const formatLogTime = (value) => {
    if (!value) return "";
    const stamp = new Date(value);
    return Number.isNaN(stamp.getTime()) ? "" : stamp.toLocaleTimeString();
  };
  const buildingNameById = (id) => buildingDefs.find((b) => b.id === id)?.name || id || "facility";
  const formatActivityLine = (row) => {
    const type = row?.activity_type || "activity";
    const payload = row?.payload || {};
    if (type === "building_donation") {
      return `${formatPilot(row)} routed ${format(payload.amount || 0)} ${resourceLabel(payload.resource)} to ${buildingNameById(payload.building_id)}.`;
    }
    if (type === "project_donation") {
      return `${formatPilot(row)} routed ${format(payload.amount || 0)} ${resourceLabel(payload.resource)} to the frontier project.`;
    }
    if (type === "building_tier_complete") {
      return `${buildingNameById(payload.building_id)} tier ${payload.tier || "?"} completed.`;
    }
    return `${formatPilot(row)}: ${type.replace(/_/g, " ")}`;
  };
  const formatDonationLine = (row) => {
    const target = row?.target_type === "building"
      ? buildingNameById(row?.target_id)
      : row?.target_type === "project"
        ? "Frontier Project"
        : "Relay";
    return `${formatPilot(row)} donated ${format(row?.amount || 0)} ${resourceLabel(row?.resource)} to ${target}.`;
  };

  return (
    <section className="panel network-panel space-y-3">
      <div className="network-hero">
        <div>
          <div className="network-hero-title">Relay Network</div>
          <div className="text-sm text-muted">A separate command layer for shared infrastructure and cooperative operations.</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="tag">{supabaseReady ? "Link Online" : "Link Offline"}</span>
          <span className="tag">{activeFaction?.name || "Unaligned"}</span>
        </div>
      </div>
      <div className="row row-between">
        <div className="text-sm text-muted">Network console</div>
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button key={tab.id} className={`tab ${pane === tab.id ? "active" : ""}`} onClick={() => setPane(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {pane === "ops" && (
        <>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="card space-y-2">
              <div className="font-semibold">Status</div>
              <div className="text-sm text-muted">{supabaseReady ? "Relay link online." : "Relay link offline."}</div>
              {needsName && <div className="text-xs text-muted">Set a callsign in Command Account to unlock faction features.</div>}
              {!needsName && supabaseReady && !membership && <div className="text-xs text-muted">Choose a faction in Allegiance to start contributing.</div>}
              {supabaseReady && !factions.length && (
                <div className="text-xs text-muted">No factions found in the database. Seed them in Supabase.</div>
              )}
              {status && <div className="text-xs text-muted">{status}</div>}
              {error && <div className="text-xs text-amber-300">Faction sync issue: {error}</div>}
            </div>
            <div className="card space-y-2">
              <div className="font-semibold">Your Alignment</div>
              {membership && activeFaction ? (
                <div className="space-y-2">
                  <div className="text-sm">{activeFaction.name}</div>
                  <div className="text-xs text-muted">{activeFaction.tagline}</div>
                  {buffs.length > 0 && (
                    <div className="text-xs text-muted">Buffs: {buffs.join(" | ")}</div>
                  )}
                  <div className="text-xs text-muted">Switch allegiance in the Allegiance tab.</div>
                </div>
              ) : (
                <div className="text-sm text-muted">Not aligned.</div>
              )}
            </div>
          </div>

          <div className="grid lg:grid-cols-[1.1fr,0.9fr] gap-3">
            <div className="card space-y-3">
              <div className="font-semibold">Frontier Project</div>
              {loading && <div className="text-sm text-muted">Loading project data...</div>}
              {!loading && !activeProject && <div className="text-sm text-muted">No active project yet.</div>}
              {activeProject && (
                <div className="space-y-3">
                  <div>
                    <div className="text-sm">{activeProject.name}</div>
                    <div className="text-xs text-muted">Live project progress across the faction.</div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-amber-400" style={{ width: `${Math.min(100, totals.percent * 100)}%` }} />
                    </div>
                    <div className="text-xs text-muted">
                      {format(totals.totalProgress)} / {format(totals.totalGoal)} total ({formatPercent(totals.percent)})
                    </div>
                  </div>
                  <div className="space-y-2">
                    {totals.goalEntries.map(([key, goal]) => {
                      const progress = activeProject.progress?.[key] || 0;
                      const pct = goal > 0 ? Math.min(1, progress / goal) : 0;
                      return (
                        <div key={key} className="space-y-1">
                          <div className="flex justify-between text-xs text-muted">
                            <span>{resourceLabel(key)}</span>
                            <span>{format(progress)} / {format(goal)}</span>
                          </div>
                          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full bg-slate-500" style={{ width: `${pct * 100}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="card space-y-3">
              <div className="font-semibold">Contribute</div>
              <div className="text-sm text-muted">Donate resources to advance the project.</div>
              <div className="space-y-2">
                <label className="text-xs text-muted">Resource</label>
                <select
                  className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
                  value={donateResource}
                  onChange={(e) => setDonateResource(e.target.value)}
                >
                  {RESOURCE_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
                <label className="text-xs text-muted">Amount</label>
                <input
                  type="number"
                  min="1"
                  className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
                  value={donateAmount}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setDonateAmount(Number.isFinite(next) ? next : 0);
                  }}
                />
                <button className="btn w-full" disabled={!canDonate} onClick={handleDonate}>
                  Donate {donateAmount > 0 ? `${format(donateAmount)} ${donateResource}` : ""}
                </button>
                {!membership && <div className="text-xs text-muted">Join a faction to donate.</div>}
                {membership && !canDonate && (
                  <div className="text-xs text-muted">Need resources available to donate.</div>
                )}
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="card space-y-2">
              <div className="font-semibold">Faction Standings</div>
              <div className="text-sm text-muted">Ranked by current project completion.</div>
              {!standings.length && <div className="text-xs text-muted">No standings yet.</div>}
              <div className="space-y-2">
                {standings.map((entry, idx) => (
                  <div key={entry.id} className="flex items-center justify-between text-xs text-muted">
                    <span>{idx + 1}. {entry.name}</span>
                    <span>{format(entry.totalProgress)} / {format(entry.totalGoal)} ({formatPercent(entry.percent)})</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card space-y-2">
              <div className="font-semibold">Top Contributors</div>
              <div className="text-sm text-muted">Live updates while the relay link is online.</div>
              {leaderboardError && <div className="text-xs text-amber-300">{leaderboardError}</div>}
              {!leaderboardRows.length && !leaderboardError && (
                <div className="text-xs text-muted">No contribution data yet.</div>
              )}
              <div className="space-y-2">
                {leaderboardRows.map((row, idx) => (
                  <div key={row.user_id || idx} className="flex items-center justify-between text-xs text-muted">
                    <span>{idx + 1}. {formatPilot(row)}</span>
                    <span>{format(row.total_donated || 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {pane === "construction" && (
        <div className="space-y-3">
          <div className="card space-y-2">
            <div className="font-semibold">Faction Construction</div>
            <div className="text-sm text-muted">Fund shared facilities that unlock faction-wide events and buffs.</div>
            <div className="text-xs text-muted">Tiered goals scale steeply; expect multi-pilot contributions.</div>
            {buildingsError && <div className="text-xs text-amber-300">{buildingsError}</div>}
            {!activeFaction && <div className="text-xs text-muted">Align with a faction to see construction queues.</div>}
            {activeFaction && !buildingDefs.length && <div className="text-xs text-muted">No faction facilities configured yet.</div>}
          </div>
          {activeFaction && buildingDefs.length > 0 && (
            <>
              <div className="card space-y-2">
                <div className="font-semibold">Send Materials</div>
                <div className="row">
                  <select
                    className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
                    value={buildResource}
                    onChange={(e) => setBuildResource(e.target.value)}
                  >
                    {RESOURCE_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    className="w-28 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
                    value={buildAmount}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      setBuildAmount(Number.isFinite(next) ? next : 0);
                    }}
                  />
                  <div className="text-xs text-muted">Applied to the facility you select.</div>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                {buildingDefs.map((def) => {
                  const progressRow = buildingProgress[def.id] || {};
                  const progress = progressRow.progress || {};
                  const maxTier = def.maxTier || 1;
                  const tier = Math.min(Math.max(1, progressRow.tier || 1), maxTier);
                  const completedTier = progressRow.completed_tier || 0;
                  const totals = buildingTotals(def, progress, tier);
                  const tierComplete = isTierComplete(def, progress, tier);
                  const scale = tierScale(def);
                  const isMaxed = completedTier >= maxTier;
                  const unlocks = Array.isArray(def.unlocks) ? def.unlocks : def.unlocks?.[tier] || [];
                  const nextUnlocks = Array.isArray(def.unlocks) ? [] : def.unlocks?.[tier + 1] || [];
                  return (
                    <div key={def.id} className="card space-y-2">
                      <div className="row row-between">
                        <div>
                          <div className="font-semibold">{def.name}</div>
                          <div className="text-xs text-muted">{def.desc}</div>
                        </div>
                        <span className="tag">{isMaxed ? "Maxed" : tierComplete ? "Tier Ready" : "Under Construction"}</span>
                      </div>
                      <div className="text-xs text-muted">Tier {tier}/{maxTier} | Scale x{scale.toFixed(2)} per tier</div>
                      <div className="space-y-2">
                        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full bg-amber-400" style={{ width: `${Math.min(100, totals.percent * 100)}%` }} />
                        </div>
                        <div className="text-xs text-muted">
                          {format(totals.totalProgress)} / {format(totals.totalGoal)} this tier ({formatPercent(totals.percent)})
                        </div>
                      </div>
                      <div className="space-y-2">
                        {totals.goalEntries.map(([key, goal]) => {
                          const amount = progressForTier(def, progress, tier)?.[key] || 0;
                          const pct = goal > 0 ? Math.min(1, amount / goal) : 0;
                          return (
                            <div key={key} className="space-y-1">
                              <div className="flex justify-between text-xs text-muted">
                                <span>{resourceLabel(key)}</span>
                                <span>{format(amount)} / {format(goal)}</span>
                              </div>
                              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                                <div className="h-full bg-slate-500" style={{ width: `${pct * 100}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {!!unlocks.length && (
                        <div className="text-xs text-muted">Unlocks (tier {tier}): {unlocks.join(" | ")}</div>
                      )}
                      {!!nextUnlocks.length && (
                        <div className="text-xs text-muted">Next tier unlocks: {nextUnlocks.join(" | ")}</div>
                      )}
                      <button className="btn" disabled={!canDonateBuilding || isMaxed} onClick={() => handleDonateBuilding(def.id)}>
                        {isMaxed ? "Maxed" : `Send ${buildAmount > 0 ? `${format(buildAmount)} ${buildResource}` : "materials"}`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {pane === "directives" && (
        <div className="space-y-3">
          <div className="card space-y-2">
            <div className="font-semibold">Faction Directives</div>
            <div className="text-sm text-muted">Directive slots unlock as faction facilities come online.</div>
            {!activeFaction && <div className="text-xs text-muted">Align with a faction to see active directives.</div>}
            {activeFaction && !directives.length && <div className="text-xs text-muted">No directives configured yet.</div>}
          </div>
          {activeFaction && directives.length > 0 && (
            <div className="grid md:grid-cols-2 gap-3">
              {directives.map((directive) => {
                const reqBuilding = directive.requires?.building;
                const reqTier = directive.requires?.tier || 1;
                const unlocked = !reqBuilding || (buildingTierMap[reqBuilding]?.completed || 0) >= reqTier;
                return (
                  <div key={directive.id} className="card space-y-2">
                    <div className="row row-between">
                      <div className="font-semibold">{directive.name}</div>
                      <span className="tag">{unlocked ? "Active" : "Locked"}</span>
                    </div>
                    <div className="text-xs text-muted">{directive.desc}</div>
                    <div className="text-xs text-muted">{directive.effect}</div>
                    {reqBuilding && !unlocked && (
                      <div className="text-xs text-muted">Requires: {buildingDefs.find((b) => b.id === reqBuilding)?.name || reqBuilding} tier {reqTier}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {pane === "allegiance" && (
        <div className="space-y-3">
          <div className="card space-y-2">
            <div className="font-semibold">Allegiance Console</div>
            <div className="text-sm text-muted">Choose a faction to align with their doctrine and shared bonuses.</div>
            {needsName && <div className="text-xs text-muted">Set a callsign in Command Account before aligning.</div>}
            {!factions.length && <div className="text-xs text-muted">No factions found. Seed them in Supabase.</div>}
          </div>
          <div className="grid md:grid-cols-3 gap-2">
            {factions.map((faction) => (
              <div key={faction.id} className="rounded-xl border border-white/10 bg-slate-950/60 p-3 space-y-2">
                <div className="text-sm font-semibold">{faction.name}</div>
                <div className="text-xs text-muted">{faction.tagline}</div>
                <div className="text-xs text-muted">{formatBuffs(faction.buffs || {}).join(" | ") || "No listed buffs."}</div>
                <button
                  className="btn w-full"
                  disabled={!supabaseReady || needsName}
                  onClick={() => handleJoin(faction.id)}
                >
                  {membership?.faction_id === faction.id ? "Aligned" : "Align"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {pane === "network" && (
        <div className="space-y-3">
          <div className="card space-y-2">
            <div className="font-semibold">Relay Feed</div>
            <div className="text-sm text-muted">Live transmissions and donation telemetry from your faction.</div>
          </div>
          <div className="grid lg:grid-cols-[1.1fr,0.9fr] gap-3">
            <div className="card space-y-2">
              <div className="font-semibold">Transmission Feed</div>
              <div className="text-sm text-muted">Faction-level events, tier completions, and relay diagnostics.</div>
              {activityError && <div className="text-xs text-amber-300">{activityError}</div>}
              {!activeFaction && <div className="text-xs text-muted">Align with a faction to see the relay feed.</div>}
              {!!activeFaction && !activityRows.length && !activityError && (
                <div className="text-xs text-muted">No transmissions yet.</div>
              )}
              <div className="list">
                {activityRows.map((row) => (
                  <div key={row.id} className="row-item">
                    <div className="row-details">
                      <div className="row-title">{formatActivityLine(row)}</div>
                      <div className="row-meta">{formatLogTime(row.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card space-y-2">
              <div className="font-semibold">Donation Ledger</div>
              <div className="text-sm text-muted">Recent material transfers routed through the relay.</div>
              {donationsError && <div className="text-xs text-amber-300">{donationsError}</div>}
              {!activeFaction && <div className="text-xs text-muted">Align with a faction to see donations.</div>}
              {!!activeFaction && !donationRows.length && !donationsError && (
                <div className="text-xs text-muted">No donations logged yet.</div>
              )}
              <div className="list">
                {donationRows.map((row) => (
                  <div key={row.id} className="row-item">
                    <div className="row-details">
                      <div className="row-title">{formatDonationLine(row)}</div>
                      <div className="row-meta">{formatLogTime(row.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="card space-y-2">
            <div className="font-semibold">Relay Chat</div>
            <div className="text-sm text-muted">Faction transmissions clear after a few hours.</div>
            {chatError && <div className="text-xs text-amber-300">{chatError}</div>}
            {!activeFaction && <div className="text-xs text-muted">Align with a faction to use relay chat.</div>}
            {!!activeFaction && !chatRows.length && !chatError && (
              <div className="text-xs text-muted">No transmissions yet.</div>
            )}
            <div className="list max-h-64 overflow-y-auto">
              {chatRows.map((row) => (
                <div key={row.id} className="row-item">
                  <div className="row-details">
                    <div className="row-title">{row.message || ""}</div>
                    <div className="row-meta">{formatPilot(row)} · {formatLogTime(row.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="row">
              <input
                className="flex-1 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
                placeholder={needsName ? "Set callsign to transmit" : "Type transmission"}
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSendChat(); }}
                disabled={!supabaseReady || !membership?.faction_id || needsName}
                maxLength={240}
              />
              <button className="btn" onClick={handleSendChat} disabled={!canSendChat}>
                Transmit
              </button>
            </div>
            {chatStatus && <div className="text-xs text-muted">{chatStatus}</div>}
          </div>
          <div className="card space-y-2">
            <div className="font-semibold">Network Horizons</div>
            <div className="text-sm text-muted">Upcoming multiplayer layers that fit the faction system.</div>
            <div className="grid md:grid-cols-2 gap-3 mt-2">
              {NETWORK_FEATURES.map((feature) => (
                <div key={feature.id} className="card space-y-2">
                  <div className="row row-between">
                    <div className="font-semibold">{feature.name}</div>
                    <span className="tag">{feature.status}</span>
                  </div>
                  <div className="text-xs text-muted">{feature.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
