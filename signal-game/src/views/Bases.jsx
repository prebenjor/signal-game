// Bases view: per-biome build queues, events, ops, and focus controls. Uses helpers from App to reuse logic.
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
}) {
  const body = bodies.find((b) => b.id === state.selectedBody) || bodies[0];
  const buildings = biomeBuildings[body.type] || [];
  const base = state.bases[body.id] || { buildings: {}, events: bodyEvents(body), focus: "balanced" };
  const ops = baseOps[body.type] || [];
  const opsCd = Math.max(0, (base.opsReadyAt || 0) - Date.now());
  const [pane, setPane] = useState("build");
  const [buildGroup, setBuildGroup] = useState("All");
  const bonuses = baseBonuses ? baseBonuses(body.id) : { cargo: 1, travel: 1, hazard: 1 };
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
  const visibleGroups = buildGroup === "All"
    ? groupedBuildings
    : groupedBuildings.filter((g) => g.name === buildGroup);
  const focusHelp = {
    balanced: "Even output across the grid.",
    production: "Boosts metal, organics, fuel, signal, rare.",
    sustain: "Boosts food, habitat, and power.",
    morale: "Boosts morale generation.",
  };
  const paneLabels = { build: "Fabrication", events: "Incidents", ops: "Field Ops" };
  const formatMod = (value) => {
    const delta = Math.round((value - 1) * 100);
    if (delta === 0) return "0%";
    return `${delta > 0 ? "+" : ""}${delta}%`;
  };

  return (
    <section className="panel space-y-3">
      <div>
        <div className="text-lg font-semibold">Bases</div>
        <div className="text-muted text-sm">Coordinate structures, incidents, and site ops. Mission targeting lives in Missions.</div>
      </div>
      <div className="grid lg:grid-cols-[340px,1fr] gap-3">
        <div className="space-y-3">
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">Site Command</div>
                <div className="text-xs text-muted">Outpost Overview</div>
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
            <div className="flex flex-wrap gap-2">
              <span className="tag">Travel {formatDuration(body.travel * 1000)}</span>
              <span className="tag">Hazard {(body.hazard * 100).toFixed(0)}%</span>
              <span className="tag">Ops {ops.length}</span>
              <span className="tag">Incidents {(base.events || []).length}/{4}</span>
            </div>
            <div className="text-sm text-muted">Focus shifts here do not launch sorties; use Missions to dispatch expeditions.</div>
          </div>

          <div className="card space-y-2">
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
            <div className="text-xs text-muted">Build Maintenance Bays to raise cap and slow incident spikes.</div>
          </div>

          <div className="card space-y-2">
            <div className="font-semibold">Outpost Summary</div>
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

          <div className="card space-y-2">
            <div className="font-semibold">Focus Protocol</div>
            <div className="flex flex-wrap gap-2">
              {["balanced", "production", "sustain", "morale"].map((f) => (
                <button key={f} className={`btn ${base.focus === f ? "btn-primary" : ""}`} onClick={() => setBaseFocus(f)}>
                  {f[0].toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <div className="text-xs text-muted">{focusHelp[base.focus] || ""}</div>
          </div>

          <div className="card space-y-2">
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
        </div>

        <div className="card space-y-3">
          <div className="row row-between">
            <div className="font-semibold">Outpost Console</div>
            <div className="flex flex-wrap gap-2">
              {["build", "events", "ops"].map((key) => (
                <button key={key} className={`tab ${pane === key ? "active" : ""}`} onClick={() => setPane(key)}>
                  {paneLabels[key] || key[0].toUpperCase() + key.slice(1)}
                </button>
              ))}
            </div>
          </div>

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
              {visibleGroups.map((group) => (
                <div key={group.name} className="space-y-2">
                  <div className="font-semibold">{group.name}</div>
                  <div className="list max-h-[420px] overflow-y-auto pr-1">
                    {group.items.map((b) => {
                      const lvl = base.buildings[b.id] || 0;
                      const cost = withLogisticsCost(scaledCost(b.cost, lvl, costExpBase), body);
                      const logistics = Math.max(2, Math.floor((body.travel || 0) / 25));
                      const reqMet = requirementsMet(base, b);
                      const reqText = b.requires ? `Requires: ${b.requires.map((r) => `${buildingNameById(r.id)} Lv ${r.level || 1}`).join(", ")}` : "";
                      const groupText = b.group ? `Branch: ${groupLabel(b.group)} (choose one)` : "";
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
                            {reqText && <div className="row-meta text-xs text-muted">{reqText}</div>}
                            {groupText && <div className="row-meta text-xs text-muted">{groupText}</div>}
                          </div>
                          <button className="btn" disabled={!reqMet || !canAffordUI(state.resources, cost)} onClick={() => buildBase(b.id)}>
                            {reqMet ? `Fabricate (${costText(cost, format)})` : "Locked"}
                          </button>
                        </div>
                      );
                    })}
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
                        Cost {costText(op.cost, format)} | Cooldown {Math.round(op.cooldown / 1000)}s
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
    </section>
  );
}
