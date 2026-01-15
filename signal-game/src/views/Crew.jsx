// Crew view: manage assignments, recruit candidates, and invest in training programs.
import { useState } from "react";

export default function CrewView({ state, hire, rollRecruits, changeCrew, format, costText, crewProgramDefs, buyCrewProgram, isCrewProgramUnlocked, scaledCost, canAffordUI, costExpCrew, milestones, techDefs, setCrewFocus, setAllFocus, quickAssign, crewContracts, acceptContract, rollContracts, formatDuration, nextContractAt }) {
  const assignedCount = Object.values(state.workers.assigned).reduce((a, b) => a + b, 0);
  const unassigned = state.workers.total - assignedCount;
  const tierCap = (state.milestonesUnlocked || []).includes("M3_INTEGRATION_UNLOCK")
    ? 3
    : (state.milestonesUnlocked || []).includes("M2_SYSTEMS_DISCOVERED")
      ? 2
      : 1;
  const moralePct = Math.round((state.workers.satisfaction || 0) * 100);
  const foodUpkeep = (state.workers.total || 0) * 0.2;
  const habitat = state.resources.habitat || 0;
  const freeHabitat = Math.max(0, habitat - state.workers.total);
  const refreshMs = 45000;
  const sinceRoll = Date.now() - (state.lastRecruitRoll || 0);
  const nextRefresh = Math.max(0, refreshMs - sinceRoll);
  const refreshLabel = state.lastRecruitRoll ? `${Math.ceil(nextRefresh / 1000)}s` : "ready";
  const [rosterFilter, setRosterFilter] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const [pane, setPane] = useState("overview");
  const programLevels = Object.values(state.crewPrograms || {}).reduce((sum, level) => sum + level, 0);
  const crewTier = programLevels >= 9 ? 3 : programLevels >= 6 ? 2 : programLevels >= 3 ? 1 : 0;
  const unlockQuickAssign = crewTier >= 1;
  const unlockMassFocus = crewTier >= 2;
  const contracts = crewContracts || [];
  const contractRefresh = Math.max(0, (nextContractAt || 0) - Date.now());
  const crewTabs = [
    { id: "overview", label: "Crew Overview" },
    { id: "assignments", label: "Assignments" },
    { id: "recruitment", label: "Recruitment Bay" },
    { id: "roster", label: "Roster Ledger" },
    { id: "training", label: "Training Lab" },
  ];
  const focusLabels = {
    production: "Production",
    ore: "Ore Output",
    salvage: "Salvage",
    nutrition: "Nutrition",
    biofuel: "Biofuel",
    stability: "Stability",
    automation: "Automation",
    recovery: "Recovery",
    research: "Research",
  };
  const focusOptionsForRole = (role) => {
    if (role === "miner") return ["production", "ore", "salvage", "recovery", "research"];
    if (role === "botanist") return ["production", "nutrition", "biofuel", "recovery", "research"];
    if (role === "engineer") return ["production", "stability", "automation", "recovery", "research"];
    return ["production", "recovery", "research"];
  };
  const milestoneNames = Object.fromEntries((milestones || []).map((m) => [m.id, m.title]));
  const techNames = Object.fromEntries((techDefs || []).map((t) => [t.id, t.name]));
  const unlockText = (program) => {
    const unlock = program.unlock || {};
    const parts = [];
    if (unlock.milestone) parts.push(`Milestone: ${milestoneNames[unlock.milestone] || unlock.milestone}`);
    if (unlock.tech) parts.push(`Tech: ${techNames[unlock.tech] || unlock.tech}`);
    return parts.length ? `Unlocks at ${parts.join(" + ")}` : "Available now.";
  };
  const roster = state.crewRoster || [];
  const assignedLeft = {
    miner: state.workers.assigned.miner || 0,
    botanist: state.workers.assigned.botanist || 0,
    engineer: state.workers.assigned.engineer || 0,
  };
  const rosterWithStatus = [...roster]
    .sort((a, b) => (b.hiredAt || 0) - (a.hiredAt || 0))
    .map((crew) => {
      const roleKey = crew.role;
      const assigned = (assignedLeft[roleKey] || 0) > 0;
      if (assigned) assignedLeft[roleKey] -= 1;
      const fatigue = Math.round((crew.fatigue || 0) * 100);
      const fatigueLabel = fatigue >= 70 ? "Overworked" : fatigue >= 30 ? "Steady" : "Rested";
      const contract = !!crew.temp;
      return { ...crew, status: assigned ? "Assigned" : "Reserve", fatigue, fatigueLabel, contract };
    });
  const filteredRoster = rosterWithStatus.filter((crew) => {
    if (rosterFilter === "assigned") return crew.status === "Assigned";
    if (rosterFilter === "reserve") return crew.status === "Reserve";
    if (rosterFilter === "contract") return crew.contract;
    return true;
  });
  const rosterDisplay = showAll ? filteredRoster : filteredRoster.slice(0, 8);
  return (
    <section className="panel space-y-3">
      <div>
        <div className="text-lg font-semibold">Crew Command</div>
        <div className="text-sm text-muted">Roles add +10% per assignment (miners/botanists) or +5% (engineers) to linked systems. Cohesion scales all output; keep food/habitat/power stable. Fatigue dulls output, recovery focus restores. Focus choices tune each role's effect.</div>
      </div>
      <div className="card space-y-3">
        <div className="row row-between">
          <div className="font-semibold">Crew Operations Deck</div>
          <div className="flex flex-wrap gap-2">
            {crewTabs.map((tab) => (
              <button key={tab.id} className={`tab ${pane === tab.id ? "active" : ""}`} onClick={() => setPane(tab.id)}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {pane === "overview" && (
          <div className="grid lg:grid-cols-3 gap-3">
            <div className="card">
              <div className="row-title mb-1">Crew Readout</div>
              <div className="list">
                <div className="row-item">
                  <div className="row-details">
                    <div className="row-title">Headcount</div>
                    <div className="row-meta">{state.workers.total} total | {assignedCount} assigned | {unassigned} idle</div>
                  </div>
                </div>
                <div className="row-item">
                  <div className="row-details">
                    <div className="row-title">Cohesion</div>
                    <div className="row-meta">Stability {moralePct}% (scales all output)</div>
                  </div>
                </div>
                <div className="row-item">
                  <div className="row-details">
                    <div className="row-title">Habitat</div>
                    <div className="row-meta">{format(habitat)} capacity | {format(freeHabitat)} free</div>
                  </div>
                </div>
                <div className="row-item">
                  <div className="row-details">
                    <div className="row-title">Life Support</div>
                    <div className="row-meta">Food upkeep {foodUpkeep.toFixed(1)}/tick</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="row-title mb-1">Role Uplinks</div>
              <div className="list">
                <div className="row-item">
                  <div className="row-details">
                    <div className="row-title">Miners</div>
                    <div className="row-meta">Boosts: Ore Rig, Fuel Cracker, metal/rare output</div>
                  </div>
                  <div className="text-xs text-muted">Assigned {state.workers.assigned.miner || 0}</div>
                </div>
                <div className="row-item">
                  <div className="row-details">
                    <div className="row-title">Botanists</div>
                    <div className="row-meta">Boosts: Algae Farm and food chains</div>
                  </div>
                  <div className="text-xs text-muted">Assigned {state.workers.assigned.botanist || 0}</div>
                </div>
                <div className="row-item">
                  <div className="row-details">
                    <div className="row-title">Engineers</div>
                    <div className="row-meta">Boosts: most other structures and hazard control</div>
                  </div>
                  <div className="text-xs text-muted">Assigned {state.workers.assigned.engineer || 0}</div>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="row-title mb-1">Crew Advisory</div>
              <div className="text-sm text-muted">
                Idle crew provide rest benefits to morale. Assign specialists when scaling production or dealing with hazards.
              </div>
              <div className="text-sm text-muted mt-2">
                Recruitment tiers unlock with milestones; reach new frontiers to find elite crew.
              </div>
            </div>
          </div>
        )}

        {pane === "assignments" && (
          <div className="grid md:grid-cols-2 gap-3">
            <div className="card">
              <div className="row-title mb-1">Role Allocation</div>
              <div className="list">
                {['miner', 'botanist', 'engineer'].map((r) => (
                  <div key={r} className="row-item">
                    <div className="row-details">
                      <div className="row-title">
                        {r.toUpperCase()} ({state.workers.assigned[r] || 0})
                      </div>
                      <div className="row-meta">Bonus {Math.round((state.workers.bonus[r] || 0) * 100)}%</div>
                    </div>
                    <div className="row">
                      <button className="btn" onClick={() => changeCrew(r, -1)}>-</button>
                      <button className="btn" disabled={unassigned <= 0} onClick={() => changeCrew(r, 1)}>+</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-sm text-muted mt-2">Unassigned: {unassigned}</div>
            </div>
            <div className="card space-y-2">
              <div className="row-title">Crew Directives</div>
              <div className="row row-between">
                <div className="text-sm text-muted">Balance roles quickly to match roster size.</div>
                <button className="btn" disabled={!unlockQuickAssign} onClick={quickAssign}>Auto-balance</button>
              </div>
              {!unlockQuickAssign && <div className="text-xs text-muted">Unlock at Training Tier 1 (3 total program levels).</div>}
              <div className="row row-between">
                <div className="text-sm text-muted">Shift the whole crew focus for short-term pushes.</div>
                <div className="row gap-2">
                  <button className="btn" disabled={!unlockMassFocus} onClick={() => setAllFocus("production")}>Production Push</button>
                  <button className="btn" disabled={!unlockMassFocus} onClick={() => setAllFocus("recovery")}>Recovery Cycle</button>
                  <button className="btn" disabled={!unlockMassFocus} onClick={() => setAllFocus("research")}>Research Push</button>
                </div>
              </div>
              {!unlockMassFocus && <div className="text-xs text-muted">Unlock at Training Tier 2 (6 total program levels).</div>}
            </div>
          </div>
        )}

        {pane === "recruitment" && (
          <div className="grid md:grid-cols-2 gap-3">
            <div className="card">
              <div className="row row-between mb-1">
                <div className="row-title">Recruitment Bay</div>
                <button className="btn" onClick={rollRecruits}>Ping</button>
              </div>
              <div className="text-xs text-muted mb-2">Recruit tier cap: {tierCap}. Unlock higher tiers by pushing deeper milestones.</div>
              <div className="text-xs text-muted mb-2">Refresh cadence: {refreshMs / 1000}s | Next refresh: {refreshLabel}</div>
              <div className="list">
                {state.recruits.map((c) => (
                  <div key={c.id} className="row-item">
                    <div className="row-details">
                      <div className="row-title">
                        {c.name} - {c.role}
                      </div>
                      <div className="row-meta">{c.trait}</div>
                      <div className="row-meta">Cost {costText(c.cost, format)}</div>
                    </div>
                    <button className="btn" onClick={() => hire(c.id)}>Enlist</button>
                  </div>
                ))}
                {!state.recruits.length && <div className="text-muted text-sm">No candidates in the queue. Ping to roll new crew.</div>}
              </div>
            </div>
            <div className="card space-y-2">
              <div className="row row-between">
                <div className="row-title">Contracted Specialists</div>
                <button className="btn" onClick={rollContracts}>Ping</button>
              </div>
              <div className="text-xs text-muted">Next refresh in {contractRefresh ? formatDuration(contractRefresh) : "now"}.</div>
              <div className="list">
                {(contracts || []).map((c) => {
                  const canAfford = canAffordUI(state.resources, c.cost);
                  const canHire = canAfford && freeHabitat > 0;
                  return (
                    <div key={c.offerId} className="row-item">
                      <div className="row-details">
                        <div className="row-title">{c.name}</div>
                        <div className="row-meta">{c.role} - {c.trait}</div>
                        <div className="row-meta text-xs text-muted">{c.perk}</div>
                        <div className="row-meta text-xs text-muted">Duration {formatDuration(c.durationMs)} | Cost {costText(c.cost, format)}</div>
                      </div>
                      <button className="btn" disabled={!canHire} onClick={() => acceptContract(c.offerId)}>Sign</button>
                    </div>
                  );
                })}
                {!(contracts || []).length && <div className="text-muted text-sm">No contracts in the queue. Check back later.</div>}
              </div>
              {freeHabitat <= 0 && <div className="text-xs text-muted">Need spare habitat to accept contracts.</div>}
            </div>
          </div>
        )}

        {pane === "roster" && (
          <div className="card">
            <div className="row row-between mb-1">
              <div className="row-title">Roster Ledger</div>
              <div className="row gap-2">
                <select className="select bg-slate-800 text-white" value={rosterFilter} onChange={(e) => setRosterFilter(e.target.value)}>
                  <option value="all">All</option>
                  <option value="assigned">Assigned</option>
                  <option value="reserve">Reserve</option>
                  <option value="contract">Contract</option>
                </select>
                <label className="row text-xs">
                  <span>Show all</span>
                  <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
                </label>
              </div>
            </div>
            <div className="text-sm text-muted mb-2">Roster detail with focus, fatigue, and contract timers.</div>
            <div className="list max-h-[420px] overflow-y-auto pr-1">
              {rosterDisplay.map((crew) => (
                <div key={crew.id} className="row-item">
                  <div className="row-details">
                    <div className="row-title">
                      {crew.name} <span className="tag">{crew.status}</span> {crew.contract && <span className="tag">Contract</span>}
                    </div>
                    <div className="row-meta">{crew.role} - {crew.trait}</div>
                    <div className="row-meta text-xs text-muted">Fatigue {crew.fatigue}% ({crew.fatigueLabel})</div>
                    {crew.perk && <div className="row-meta text-xs text-muted">{crew.perk}</div>}
                    {crew.expiresAt && (
                      <div className="row-meta text-xs text-muted">Contract ends in {formatDuration(Math.max(0, crew.expiresAt - Date.now()))}</div>
                    )}
                  </div>
                  <div className="row gap-2">
                    <select className="select bg-slate-800 text-white" value={crew.focus || "production"} onChange={(e) => setCrewFocus(crew.id, e.target.value)}>
                      {focusOptionsForRole(crew.role).map((opt) => (
                        <option key={opt} value={opt}>{focusLabels[opt] || opt}</option>
                      ))}
                    </select>
                    <div className="text-xs text-muted">+{Math.round((crew.bonus || 0) * 100)}%</div>
                  </div>
                </div>
              ))}
              {!rosterDisplay.length && <div className="text-muted text-sm">No crew matches this filter yet.</div>}
            </div>
            {filteredRoster.length > rosterDisplay.length && (
              <div className="text-xs text-muted mt-2">Showing {rosterDisplay.length} of {filteredRoster.length} crew.</div>
            )}
          </div>
        )}

        {pane === "training" && (
          <div className="space-y-3">
            <div className="card space-y-2">
              <div className="row-title">Training Protocols</div>
              <div className="text-sm text-muted">Program levels: {programLevels} | Tier {crewTier}</div>
            <div className="list max-h-[420px] overflow-y-auto pr-1">
                <div className="row-item">
                  <div className="row-details">
                    <div className="row-title">Tier 1</div>
                    <div className="row-meta">Unlocks auto-balance assignments.</div>
                  </div>
                  {crewTier >= 1 ? <span className="tag">Unlocked</span> : <span className="tag">Locked</span>}
                </div>
                <div className="row-item">
                  <div className="row-details">
                    <div className="row-title">Tier 2</div>
                    <div className="row-meta">Unlocks crew-wide focus actions.</div>
                  </div>
                  {crewTier >= 2 ? <span className="tag">Unlocked</span> : <span className="tag">Locked</span>}
                </div>
                <div className="row-item">
                  <div className="row-details">
                    <div className="row-title">Tier 3</div>
                    <div className="row-meta">Contracts refresh faster.</div>
                  </div>
                  {crewTier >= 3 ? <span className="tag">Unlocked</span> : <span className="tag">Locked</span>}
                </div>
              </div>
            </div>
            <div className="card">
              <div className="row-title mb-1">Training Programs</div>
              <div className="text-sm text-muted mb-2">Invest in formal crew programs to boost missions, stabilize outposts, and improve scan output as the frontier grows.</div>
              <div className="list">
                {(crewProgramDefs || []).map((program) => {
                  const level = state.crewPrograms?.[program.id] || 0;
                  const cost = scaledCost(program.cost, level, costExpCrew);
                  const unlocked = isCrewProgramUnlocked(state, program);
                  const canAfford = canAffordUI(state.resources, cost);
                  return (
                    <div key={program.id} className="row-item">
                      <div className="row-details">
                        <div className="row-title">
                          {program.name} {level > 0 && <span className="tag">Lv {level}</span>} {!unlocked && <span className="tag">Locked</span>}
                        </div>
                        <div className="row-meta">{program.desc}</div>
                        <div className="row-meta text-xs text-muted">{unlockText(program)}</div>
                        <div className="row-meta text-xs text-muted">Next training: {costText(cost, format)}</div>
                      </div>
                      <button className="btn" disabled={!unlocked || !canAfford} onClick={() => buyCrewProgram(program.id)}>
                        {unlocked ? "Train" : "Locked"}
                      </button>
                    </div>
                  );
                })}
                {!crewProgramDefs?.length && <div className="text-muted text-sm">No programs available yet.</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}


