// Outposts view: per-biome build queues, events, ops, and focus controls. Uses helpers from App to reuse logic.
import { useEffect, useMemo, useState } from "react";

export default function BasesView({
  state,
  bodies,
  biomeBuildings,
  baseOps,
  setSelected,
  buildBase,
  setBaseFocus,
  refreshEvents,
  resolveEvent,
  runBaseOp,
  crewBonusText,
  format,
  bodyEvents,
  formatDuration,
  isUnlockedUI,
  scaledCost,
  withLogisticsCost,
  costText,
  canAffordUI,
  costExpBase,
  requirementsMet,
  baseTraits,
  maintenanceStats,
  baseBonuses,
  availablePopulation,
  assignBaseWorkers,
  setBaseWorkerPreset,
  baseZones,
  unlockBaseZone,
  embedded = false,
}) {
  const body = bodies.find((b) => b.id === state.selectedBody) || bodies[0];
  const buildings = biomeBuildings[body.type] || [];
  const base = state.bases[body.id] || { buildings: {}, events: bodyEvents(body), focus: "balanced" };
  const zoneState = base.zones || { core: true };
  const ops = baseOps[body.type] || [];
  const opsCd = Math.max(0, (base.opsReadyAt || 0) - Date.now());
  const [pane, setPane] = useState("overview");
  const [buildGroup, setBuildGroup] = useState("All");
  const [buildSearch, setBuildSearch] = useState("");
  const bonuses = baseBonuses ? baseBonuses(body.id) : { cargo: 1, travel: 1, hazard: 1 };
  const maintenanceFill = Math.min(1, maintenanceStats.used / Math.max(1, maintenanceStats.cap));
  const incidents = base.events || [];
  const incidentFill = Math.min(1, incidents.length / 4);
  const workforceAssigned = base.workers?.assigned || { production: 0, maintenance: 0, research: 0 };
  const workforceTotal = Object.values(workforceAssigned).reduce((sum, v) => sum + (v || 0), 0);
  const workforceCap = 25 + (base.buildings?.maintenance_bay || 0) * 5 + (zoneState.residential ? 15 : 0);
  const workforceEfficiency = workforceTotal <= 5
    ? 0.5
    : workforceTotal <= 15
      ? 0.75
      : workforceTotal <= 25
        ? 1
        : 1 + Math.min(0.25, (workforceTotal - 25) * 0.01);
  const groupedBuildings = useMemo(() => {
    const classify = (b) => {
      if (b.maintenanceCap) return "Infrastructure";
      if (b.group) return "Specializations";
      if ((b.cargoMult || b.travelMult) && Object.keys(b.prod || {}).length === 0) return "Logistics";
      return "Production";
    };
    const groups = {};
    buildings.forEach((b) => {
      const key = classify(b);
      if (!groups[key]) groups[key] = [];
      groups[key].push(b);
    });
    const order = ["Production", "Infrastructure", "Logistics", "Specializations"];
    return order.filter((k) => groups[k]?.length).map((k) => ({ name: k, items: groups[k] }));
  }, [buildings]);
  const groupNames = useMemo(() => groupedBuildings.map((g) => g.name), [groupedBuildings]);
  useEffect(() => {
    if (buildGroup === "All") return;
    if (!groupNames.includes(buildGroup)) setBuildGroup(groupNames[0] || "All");
  }, [groupNames, buildGroup]);

  const labelify = (value) => value.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
  const groupLabel = (group) => labelify(group || "");
  const buildingNameById = (id) => buildings.find((b) => b.id === id)?.name || labelify(id || "");
  const zoneById = (id) => (baseZones || []).find((z) => z.id === id);
  const visibleGroups = buildGroup === "All"
    ? groupedBuildings
    : groupedBuildings.filter((g) => g.name === buildGroup);
  const buildQuery = buildSearch.trim().toLowerCase();
  const focusHelp = {
    balanced: "Even output across the grid.",
    production: "Boosts metal, organics, fuel, signal, rare.",
    sustain: "Boosts food, habitat, and power.",
    morale: "Boosts morale generation.",
  };
  const paneLabels = {
    overview: "Site Overview",
    build: "Fabrication Bay",
    events: "Incident Queue",
    ops: "Field Ops",
    focus: "Focus Protocols",
    traits: "Site Traits",
    workforce: "Workforce",
  };
  const tabOrder = ["overview", "workforce", "build", "events", "ops", "focus", "traits"];
  const formatMod = (value) => {
    const delta = Math.round((value - 1) * 100);
    if (delta === 0) return "0%";
    return `${delta > 0 ? "+" : ""}${delta}%`;
  };

  const content = (
    <div className={`${embedded ? "" : "panel "}space-y-4 base-command`}>
      {!embedded && (
        <div className="relative overflow-hidden rounded-2xl border border-emerald-400/20 bg-slate-950/80 p-4 base-banner">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),transparent_60%)]" />
          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-slate-950/90 to-transparent" />
          <div className="relative z-10 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-emerald-200/70">Outpost Command</div>
              <div className="text-2xl font-semibold">Outposts</div>
              <div className="text-sm text-muted mt-1">Coordinate structures, incidents, and site ops. Expedition routing lives in Expedition Command.</div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="tag">{labelify(body.type)} Site</span>
              <span className="tag">Travel {formatDuration(body.travel * 1000)}</span>
              <span className="tag">Hazard {(body.hazard * 100).toFixed(0)}%</span>
              <span className="tag">Incidents {incidents.length}/4</span>
            </div>
          </div>
        </div>
      )}
      <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 space-y-3 base-deck">
        <div className="row row-between">
          <div>
            <div className="font-semibold">Outpost Operations Deck</div>
            <div className="text-xs text-muted">Site-level controls, fabrication, and field protocols.</div>
          </div>
          <div className="text-xs text-muted">Each site is tuned to its biome. Build for the resource chain your hub lacks.</div>
          <div className="flex flex-wrap gap-2">
            {tabOrder.map((key) => (
              <button key={key} className={`tab ${pane === key ? "active" : ""}`} onClick={() => setPane(key)}>
                {paneLabels[key] || key[0].toUpperCase() + key.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {pane === "overview" && (
          <div className="grid lg:grid-cols-2 gap-3">
            <div className="space-y-3">
              <div className="card space-y-3 base-panel">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">Outpost Dossier</div>
                    <div className="text-xs text-muted">Sector overview and routing</div>
                  </div>
                  <span className="tag">{labelify(body.type)} Site</span>
                </div>
                <div className="row-item">
                  <div className="row-details">
                    <div className="row-title">{body.name}</div>
                    <div className="row-meta">
                      {body.type.toUpperCase()} | Travel {formatDuration(body.travel * 1000)} | Hazard {(body.hazard * 100).toFixed(0)}%
                    </div>
                  </div>
                  <select className="select bg-slate-800 text-white" value={body.id} onChange={(e) => setSelected(e.target.value)}>
                    {bodies.map((b) => (
                      <option key={b.id} value={b.id} disabled={!isUnlockedUI(state, b)}>
                        {b.name} {isUnlockedUI(state, b) ? "" : "(locked)"}
                      </option>
                    ))}
                  </select>
                </div>
                {!!body.focus?.length && <div className="text-xs text-muted">Site focus: {body.focus.join(" | ")}</div>}
                {body.reason && <div className="text-xs text-muted">{body.reason}</div>}
                <div className="flex flex-wrap gap-2">
                  <span className="tag">Travel {formatDuration(body.travel * 1000)}</span>
                  <span className="tag">Hazard {(body.hazard * 100).toFixed(0)}%</span>
                  <span className="tag">Ops {ops.length}</span>
                  <span className="tag">Incidents {incidents.length}/4</span>
                  <span className="tag">Focus {labelify(base.focus)}</span>
                </div>
                <div className="text-sm text-muted">Focus shifts here do not launch sorties; use Expedition Planning to dispatch runs.</div>
              </div>

              <div className="card space-y-2 base-panel">
                <div className="font-semibold">Stability Grid</div>
                <div className="row-item">
                  <div className="row-details">
                    <div className="row-title">Structure Capacity</div>
                    <div className="row-meta">
                      {maintenanceStats.used}/{maintenanceStats.cap} structures {maintenanceStats.over ? "(Over cap)" : ""}
                    </div>
                  </div>
                  <div className="tag">{maintenanceStats.over ? "Reduced output" : "Stable"}</div>
                </div>
                <div className="space-y-2">
                  <div className="text-xs text-muted">Capacity load</div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-emerald-400" style={{ width: `${maintenanceFill * 100}%` }} />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-xs text-muted">Incident pressure</div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-amber-400" style={{ width: `${incidentFill * 100}%` }} />
                  </div>
                </div>
                <div className="text-xs text-muted">Build Maintenance Bays to raise cap and slow incident spikes.</div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="card space-y-2 base-panel">
                <div className="font-semibold">Performance Snapshot</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="stat-box">
                    <span className="text-muted text-xs">Cargo Bonus</span>
                    <strong>{formatMod(bonuses.cargo || 1)}</strong>
                  </div>
                  <div className="stat-box">
                    <span className="text-muted text-xs">Travel Time</span>
                    <strong>{formatMod(bonuses.travel || 1)}</strong>
                  </div>
                  <div className="stat-box">
                    <span className="text-muted text-xs">Hazard</span>
                    <strong>{formatMod(bonuses.hazard || 1)}</strong>
                  </div>
                  <div className="stat-box">
                    <span className="text-muted text-xs">Traits</span>
                    <strong>{baseTraits.length}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {pane === "focus" && (
          <div className="card space-y-2 base-panel">
            <div className="font-semibold">Focus Protocol</div>
            <div className="flex flex-wrap gap-2">
              {['balanced', 'production', 'sustain', 'morale'].map((f) => (
                <button key={f} className={`btn ${base.focus === f ? "btn-primary" : ""}`} onClick={() => setBaseFocus(f)}>
                  {f[0].toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <div className="text-xs text-muted">{focusHelp[base.focus] || ""}</div>
          </div>
        )}

        {pane === "workforce" && (
          <div className="grid lg:grid-cols-2 gap-3">
            <div className="card space-y-3 base-panel">
              <div>
                <div className="font-semibold">Workforce Command</div>
                <div className="text-xs text-muted">Assign population to keep output stable and incidents low.</div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="tag">Workers {workforceTotal}/{workforceCap}</span>
                <span className="tag">Available {format(availablePopulation || 0)}</span>
                <span className="tag">Efficiency {Math.round(workforceEfficiency * 100)}%</span>
              </div>
              <div className="list">
                {[
                  { id: "production", label: "Production", hint: "Boosts output." },
                  { id: "maintenance", label: "Maintenance", hint: "Reduces incidents, speeds ops." },
                  { id: "research", label: "Research", hint: "Boosts research output." },
                ].map((role) => (
                  <div key={role.id} className="row-item">
                    <div className="row-details">
                      <div className="row-title">{role.label}</div>
                      <div className="row-meta">{role.hint}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="btn" onClick={() => assignBaseWorkers(body.id, role.id, -1)}>-</button>
                      <span className="text-sm w-6 text-center">{workforceAssigned[role.id] || 0}</span>
                      <button className="btn" onClick={() => assignBaseWorkers(body.id, role.id, 1)}>+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card space-y-3 base-panel">
              <div>
                <div className="font-semibold">Deployment Protocols</div>
                <div className="text-xs text-muted">Apply a distribution template for this base.</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn" onClick={() => setBaseWorkerPreset(body.id, "balanced")}>Balanced</button>
                <button className="btn" onClick={() => setBaseWorkerPreset(body.id, "production")}>Production</button>
                <button className="btn" onClick={() => setBaseWorkerPreset(body.id, "maintenance")}>Maintenance</button>
                <button className="btn" onClick={() => setBaseWorkerPreset(body.id, "research")}>Research</button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn" onClick={() => setBaseWorkerPreset(body.id, "max")}>Fill to cap</button>
                <button className="btn" onClick={() => setBaseWorkerPreset(body.id, "clear")}>Recall workers</button>
              </div>
              <div className="text-xs text-muted">Workforce draws from your population pool. Build habitat to expand capacity.</div>
            </div>

            <div className="card space-y-3 base-panel">
              <div>
                <div className="font-semibold">Expansion Zones</div>
                <div className="text-xs text-muted">Unlock new build tiers by investing habitat.</div>
              </div>
              <div className="list">
                {(baseZones || []).map((zone) => {
                  const unlocked = zone.id === "core" || zoneState[zone.id];
                  const cost = zone.cost || 0;
                  return (
                    <div key={zone.id} className="row-item">
                      <div className="row-details">
                        <div className="row-title">
                          {zone.name} {unlocked ? <span className="tag">Online</span> : null}
                        </div>
                        <div className="row-meta">{zone.desc}</div>
                        {zone.id !== "core" && (
                          <div className="row-meta text-xs text-muted">Habitat cost: {format(cost)}</div>
                        )}
                      </div>
                      {zone.id === "core" ? null : (
                        <button className="btn" disabled={unlocked || (state.resources.habitat || 0) < cost} onClick={() => unlockBaseZone(body.id, zone.id)}>
                          {unlocked ? "Unlocked" : `Unlock (${cost} habitat)`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {pane === "traits" && (
          <div className="card space-y-2 base-panel">
            <div className="font-semibold">Site Traits</div>
            <div className="list">
              {baseTraits.map((t) => (
                <div key={t.id} className="row-item">
                  <div className="row-details">
                    <div className="row-title">{t.name}</div>
                    <div className="row-meta">{t.desc}</div>
                  </div>
                </div>
              ))}
              {!baseTraits.length && <div className="text-muted text-sm">No traits assigned.</div>}
            </div>
          </div>
        )}

        {pane === "build" && (
          <div className="space-y-4">
            {groupNames.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {["All", ...groupNames].map((name) => (
                  <button key={name} className={`tab ${buildGroup === name ? "active" : ""}`} onClick={() => setBuildGroup(name)}>
                    {name}
                  </button>
                ))}
              </div>
            )}
            <input
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
              placeholder="Search facilities"
              value={buildSearch}
              onChange={(e) => setBuildSearch(e.target.value)}
            />
            {visibleGroups.map((group) => (
              <div key={group.name} className="space-y-2 base-build-group">
                <div className="row row-between base-build-group-header">
                  <div className="font-semibold">{group.name}</div>
                  <div className="text-xs text-muted">{group.items.length} schematics</div>
                </div>
                <div className="base-build-divider" />
                <div className="list max-h-[420px] overflow-y-auto pr-1 base-build-list">
                  {(buildQuery
                    ? group.items.filter((b) => {
                        const name = (b.name || "").toLowerCase();
                        const desc = (b.desc || "").toLowerCase();
                        return name.includes(buildQuery) || desc.includes(buildQuery);
                      })
                    : group.items
                  ).map((b) => {
                    const lvl = base.buildings[b.id] || 0;
                    const cost = withLogisticsCost(scaledCost(b.cost, lvl, costExpBase), body);
                    const logistics = Math.max(2, Math.floor((body.travel || 0) / 25));
                    const reqMet = requirementsMet(base, b);
                    const zoneId = b.zone || "core";
                    const zone = zoneById(zoneId);
                    const zoneUnlocked = zoneId === "core" || zoneState[zoneId];
                    const zoneLabel = zone?.name || labelify(zoneId);
                    const reqText = b.requires ? `Requires: ${b.requires.map((r) => `${buildingNameById(r.id)} Lv ${r.level || 1}`).join(", ")}` : "";
                    const groupText = b.group ? `Branch: ${groupLabel(b.group)} (choose one)` : "";
                    const zoneText = zoneId === "core" ? "Zone: Core" : `Zone: ${zoneLabel}`;
                    const canBuild = reqMet && zoneUnlocked && canAffordUI(state.resources, cost);
                    return (
                      <div key={b.id} className="row-item">
                        <div className="row-details">
                          <div className="row-title">
                            {b.name} <span className="tag">Lv {lvl}</span>
                          </div>
                          <div className="row-meta">{b.desc}</div>
                          <div className="row-meta text-xs text-muted">Logistics: +{logistics} fuel</div>
                          <div className="row-meta text-xs text-muted">Crew bonus: {crewBonusText(b.id)}</div>
                          <div className="row-meta text-xs text-muted">Next cost: {costText(cost, format)}</div>
                          <div className="row-meta text-xs text-muted">{zoneText}{zoneUnlocked ? "" : " (locked)"}</div>
                          {reqText && <div className="row-meta text-xs text-muted">{reqText}</div>}
                          {groupText && <div className="row-meta text-xs text-muted">{groupText}</div>}
                          {!zoneUnlocked && <div className="row-meta text-xs text-muted">Unlock {zoneLabel} in Workforce.</div>}
                        </div>
                        <button className="btn" disabled={!canBuild} onClick={() => buildBase(b.id)}>
                          {canBuild ? `Fabricate (${costText(cost, format)})` : "Locked"}
                        </button>
                      </div>
                    );
                  })}
                  {buildQuery && !group.items.some((b) => {
                    const name = (b.name || "").toLowerCase();
                    const desc = (b.desc || "").toLowerCase();
                    return name.includes(buildQuery) || desc.includes(buildQuery);
                  }) && (
                    <div className="text-muted text-sm">No facilities match this filter.</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {pane === "events" && (
          <div className="space-y-3">
            <div className="font-semibold">Local Incidents</div>
            <div className="list max-h-[520px] overflow-y-auto pr-1">
              {(base.events || []).map((e, i) => (
                <div key={e.id || i} className="row-item">
                  <div className="row-details">
                    <div className="row-title">{e.name || e}</div>
                    <div className="row-meta">{e.desc || "Local situation requires attention."}</div>
                    {e.cost && <div className="row-meta text-xs">Cost {costText(e.cost, format)} {e.requiresRole ? `| Needs ${e.requiresRole}` : ""}</div>}
                  </div>
                  {e.id ? <button className="btn" onClick={() => resolveEvent(body.id, e.id)}>Resolve</button> : null}
                </div>
              ))}
              {!base.events?.length && <div className="text-muted text-sm">No active incidents.</div>}
            </div>
            <button className="btn" onClick={refreshEvents}>Rescan Sector</button>
          </div>
        )}

        {pane === "ops" && (
          <div className="space-y-3">
            <div className="font-semibold">Field Ops</div>
            <div className="list max-h-[520px] overflow-y-auto pr-1">
              {ops.map((op) => (
                <div key={op.id} className="row-item">
                  <div className="row-details">
                    <div className="row-title">{op.name}</div>
                    <div className="row-meta">{op.desc}</div>
                    <div className="row-meta text-xs text-muted">
                      {(() => {
                        const maintenanceShare = workforceTotal > 0 ? (workforceAssigned.maintenance || 0) / workforceTotal : 0;
                        const cooldownMult = 1 - maintenanceShare * 0.5;
                        const effective = Math.max(1, Math.round((op.cooldown * cooldownMult) / 1000));
                        return `Cost ${costText(op.cost, format)} | Cooldown ${effective}s`;
                      })()}
                    </div>
                  </div>
                  <button className="btn" disabled={opsCd > 0 || !canAffordUI(state.resources, op.cost)} onClick={() => runBaseOp(body.id, op.id)}>
                    {opsCd > 0 ? `Ready in ${formatDuration(opsCd)}` : "Execute"}
                  </button>
                </div>
              ))}
              {!ops.length && <div className="text-muted text-sm">No base ops for this biome yet.</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return content;
}
