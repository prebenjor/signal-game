import React, { useMemo, useState } from "react";

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

export default function FactionView({
  profileName,
  supabaseReady,
  factions,
  projects,
  membership,
  loading,
  error,
  leaderboard,
  leaderboardError,
  onJoin,
  onDonate,
  resources,
  format,
}) {
  const needsName = !profileName?.trim();
  const [donateResource, setDonateResource] = useState("metal");
  const [donateAmount, setDonateAmount] = useState(100);
  const [status, setStatus] = useState(null);

  const activeFaction = useMemo(() => factions.find((f) => f.id === membership?.faction_id), [factions, membership]);
  const activeProject = useMemo(() => projects[membership?.faction_id], [projects, membership]);
  const buffs = useMemo(() => formatBuffs(activeProject?.buff || activeFaction?.buffs || {}), [activeProject, activeFaction]);
  const totals = useMemo(() => projectTotals(activeProject), [activeProject]);

  const canDonate =
    supabaseReady &&
    !needsName &&
    !!membership?.faction_id &&
    Number.isFinite(donateAmount) &&
    donateAmount > 0 &&
    (resources?.[donateResource] || 0) >= donateAmount;

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
    if (row.callsign) return row.callsign;
    const id = row.user_id || "";
    return id ? `Pilot ${id.slice(0, 6)}` : "Pilot";
  };

  const canTestRpc =
    supabaseReady &&
    !needsName &&
    !!membership?.faction_id &&
    (resources?.metal || 0) >= 1;

  return (
    <section className="panel space-y-3">
      <div>
        <div className="text-lg font-semibold">Faction Operations</div>
        <div className="text-sm text-muted">Coordinate with a faction on shared projects and buffs.</div>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div className="card space-y-2">
          <div className="font-semibold">Status</div>
          <div className="text-sm text-muted">{supabaseReady ? "Supabase connected." : "Supabase not configured yet."}</div>
          {needsName && <div className="text-xs text-muted">Set a callsign in Account to unlock faction features.</div>}
          {!needsName && supabaseReady && !membership && <div className="text-xs text-muted">Choose a faction to start contributing.</div>}
          {status && <div className="text-xs text-muted">{status}</div>}
          {error && <div className="text-xs text-amber-300">Faction sync issue: {error}</div>}
          <button className="btn" disabled={!canTestRpc} onClick={() => onDonate("metal", 1)}>
            Test RPC (donate 1 metal)
          </button>
          {!canTestRpc && (
            <div className="text-xs text-muted">Join a faction and keep 1 metal to run a quick RPC test.</div>
          )}
        </div>
        <div className="card space-y-2">
          <div className="font-semibold">Your Faction</div>
          {membership && activeFaction ? (
            <div className="space-y-2">
              <div className="text-sm">{activeFaction.name}</div>
              <div className="text-xs text-muted">{activeFaction.tagline}</div>
              {buffs.length > 0 && (
                <div className="text-xs text-muted">
                  Buffs: {buffs.join(" • ")}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted">Not aligned.</div>
          )}
        </div>
      </div>
      <div className="grid lg:grid-cols-[1.1fr,0.9fr] gap-3">
        <div className="card space-y-3">
          <div className="font-semibold">Frontier Project</div>
          {loading && <div className="text-sm text-muted">Loading project data…</div>}
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
                        <span>{key}</span>
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
      <div className="card space-y-2">
        <div className="font-semibold">Factions</div>
        <div className="text-sm text-muted">Pick a faction to align with their doctrine and buffs.</div>
        {!factions.length && <div className="text-xs text-muted">No factions loaded yet.</div>}
        <div className="grid md:grid-cols-3 gap-2">
          {factions.map((faction) => (
            <div key={faction.id} className="rounded-xl border border-white/10 bg-slate-950/60 p-3 space-y-2">
              <div className="text-sm font-semibold">{faction.name}</div>
              <div className="text-xs text-muted">{faction.tagline}</div>
              <div className="text-xs text-muted">{formatBuffs(faction.buffs || {}).join(" • ") || "No listed buffs."}</div>
              <button
                className="btn w-full"
                disabled={!supabaseReady || needsName}
                onClick={() => handleJoin(faction.id)}
              >
                {membership?.faction_id === faction.id ? "Aligned" : "Join"}
              </button>
            </div>
          ))}
        </div>
      </div>
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
        <div className="text-sm text-muted">Based on lifetime faction donations.</div>
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
    </section>
  );
}
