export default function TechView({ state, buyTech, format, techDefs, hasPrereqs, canAffordUI, costText }) {
  const tiers = Array.from(new Set(techDefs.map((t) => t.tier))).sort((a, b) => a - b);
  return (
    <section className="panel space-y-3">
      <div className="text-lg font-semibold">Tech & Milestones</div>
      <div className="text-muted text-sm">Branching tree; unlocks require prior techs.</div>
      <div className="space-y-4">
        {tiers.map((tier) => (
          <div key={tier} className="card space-y-2">
            <div className="font-semibold">Tier {tier}</div>
            <div className="list">
              {techDefs.filter((t) => t.tier === tier).map((t) => {
                const unlockVisible = state.resources.signal >= t.unlock;
                if (!unlockVisible)
                  return (
                    <div key={t.id} className="row-item opacity-50">
                      <div className="row-details">
                        <div className="row-title">{t.name}</div>
                        <div className="row-meta">Requires {t.unlock} signal to reveal.</div>
                      </div>
                    </div>
                  );
                const owned = state.tech[t.id];
                const prereqsMet = hasPrereqs(state, t);
                const prereqText = t.requires?.length ? `Requires: ${t.requires.map((r) => techDefs.find((x) => x.id === r)?.name || r).join(", ")}` : "Root";
                const disabled = owned || !prereqsMet || !canAffordUI(state.resources, t.cost);
                return (
                  <div key={t.id} className="row-item">
                    <div className="row-details">
                      <div className="row-title">
                        {t.name} {owned ? <span className="tag">Owned</span> : null}
                      </div>
                      <div className="row-meta">{t.desc}</div>
                      <div className="row-meta text-xs text-muted">{prereqText}</div>
                    </div>
                    <button className="btn" disabled={disabled} onClick={() => buyTech(t.id)}>
                      {owned ? "Done" : `Research (${costText(t.cost, format)})`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
