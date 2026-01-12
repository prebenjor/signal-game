// Bases view: per-biome build queues, events, ops, and focus controls. Uses helpers from App to reuse logic.
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
}) {
  const body = bodies.find((b) => b.id === state.selectedBody) || bodies[0];
  const buildings = biomeBuildings[body.type] || [];
  const base = state.bases[body.id] || { buildings: {}, events: bodyEvents(body), focus: "balanced" };
  const ops = baseOps[body.type] || [];
  const opsCd = Math.max(0, (base.opsReadyAt || 0) - Date.now());

  return (
    <section className="panel space-y-3">
      <div>
        <div className="text-lg font-semibold">Bases</div>
        <div className="text-muted text-sm">Manage structures, events, and base-specific ops. Mission targeting lives in Missions.</div>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div className="card space-y-3">
          <div className="font-semibold">Select Site</div>
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
          <div className="text-sm text-muted">Switching focus here does not launch missions; use Missions tab to send expeditions.</div>
        </div>
        <div className="card space-y-2">
          <div className="font-semibold">Build on {body.name}</div>
          <div className="list">
            {buildings.map((b) => {
              const lvl = base.buildings[b.id] || 0;
              const cost = withLogisticsCost(scaledCost(b.cost, lvl, costExpBase), body);
              const logistics = Math.max(2, Math.floor((body.travel || 0) / 25));
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
                  </div>
                  <button className="btn" disabled={!canAffordUI(state.resources, cost)} onClick={() => buildBase(b.id)}>
                    Build ({costText(cost, format)})
                  </button>
                </div>
              );
            })}
          </div>
          <div className="font-semibold mt-2">Local Events</div>
          <div className="list">
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
            <button className="btn mt-2" onClick={refreshEvents}>Refresh Events</button>
          </div>
          <div className="font-semibold mt-2">Outpost Focus</div>
          <div className="flex flex-wrap gap-2">
            {["balanced", "production", "sustain", "morale"].map((f) => (
              <button key={f} className={`btn ${base.focus === f ? "btn-primary" : ""}`} onClick={() => setBaseFocus(f)}>
                {f[0].toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <div className="font-semibold mt-2">Outpost Ops</div>
          <div className="list">
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
                  {opsCd > 0 ? `Ready in ${formatDuration(opsCd)}` : "Run"}
                </button>
              </div>
            ))}
            {!ops.length && <div className="text-muted text-sm">No base ops for this biome yet.</div>}
          </div>
        </div>
      </div>
    </section>
  );
}
