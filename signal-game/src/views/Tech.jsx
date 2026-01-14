// Tech view: branching techs with prereqs; uses helpers from App for afford/prereq checks.
export default function TechView({ state, buyTech, format, techDefs, hasPrereqs, canAffordUI, costText, techUnlockMult, techCostMult }) {
  const tiers = Array.from(new Set(techDefs.map((t) => t.tier))).sort((a, b) => a - b);
  const scaleCost = (cost, mult) => Object.fromEntries(Object.entries(cost || {}).map(([k, v]) => [k, Math.ceil(v * (mult || 1))]));
  return (
    <section className="panel space-y-3">
      <div className="text-lg font-semibold">R&D Grid</div>
      <div className="text-muted text-sm">Branching lattice; unlocks require prior nodes.</div>
      <div className="space-y-4">
        {tiers.map((tier) => (
          <div key={tier} className="card space-y-2">
            <div className="font-semibold">Tier {tier}</div>
            <div className="list">
              {techDefs.filter((t) => t.tier === tier).map((t) => {
                const unlockSignal = Math.ceil(t.unlock * (techUnlockMult || 1));
                const unlockVisible = state.resources.signal >= unlockSignal;
                if (!unlockVisible)
                  return (
                    <div key={t.id} className="row-item opacity-50">
                      <div className="row-details">
                        <div className="row-title">{t.name}</div>
                        <div className="row-meta">Requires {unlockSignal} signal to reveal node.</div>
                      </div>
                    </div>
                  );
                const owned = state.tech[t.id];
                const prereqsMet = hasPrereqs(state, t);
                const cost = scaleCost(t.cost, techCostMult);
                const prereqText = t.requires?.length ? `Requires: ${t.requires.map((r) => techDefs.find((x) => x.id === r)?.name || r).join(", ")}` : "Root";
                const disabled = owned || !prereqsMet || !canAffordUI(state.resources, cost);
                return (
                  <div key={t.id} className="row-item">
                    <div className="row-details">
                      <div className="row-title">
                        {t.name} {owned ? <span className="tag">Integrated</span> : null}
                      </div>
                      <div className="row-meta">{t.desc}</div>
                      <div className="row-meta text-xs text-muted">{prereqText}</div>
                    </div>
                    <button className="btn" disabled={disabled} onClick={() => buyTech(t.id)}>
                      {owned ? "Integrated" : `Research (${costText(cost, format)})`}
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
