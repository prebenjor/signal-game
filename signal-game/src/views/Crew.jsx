export default function CrewView({ state, hire, rollRecruits, changeCrew, format, costText }) {
  const unassigned = state.workers.total - Object.values(state.workers.assigned).reduce((a, b) => a + b, 0);
  return (
    <section className="panel space-y-3">
      <div className="text-lg font-semibold">Crew & Recruits</div>
      <div className="text-sm text-muted">Roles give +10% per assignment (miners/botanists) or +5% (engineers) to linked buildings. Morale scales all output; keep food/habitat/power stable.</div>
      <div className="grid md:grid-cols-2 gap-3">
        <div className="card">
          <div className="row-title mb-1">Assignments</div>
          <div className="list">
            {["miner", "botanist", "engineer"].map((r) => (
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
        <div className="card">
          <div className="row row-between mb-1">
            <div className="row-title">Recruitment Hub</div>
            <button className="btn" onClick={rollRecruits}>Refresh</button>
          </div>
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
                <button className="btn" onClick={() => hire(c.id)}>Hire</button>
              </div>
            ))}
            {!state.recruits.length && <div className="text-muted text-sm">No candidates. Refresh to roll new crew.</div>}
          </div>
        </div>
      </div>
    </section>
  );
}
