import { useState } from "react";

// Tech view: branching techs with prereqs; uses helpers from App for afford/prereq checks.
export default function TechView({ state, buyTech, format, techDefs, hasPrereqs, canAffordUI, costText, techUnlockMult, techCostMult }) {
  const [pane, setPane] = useState("lattice");
  const techTabs = [
    { id: "lattice", label: "Research Lattice" },
    { id: "catalog", label: "Tech Archive" },
    { id: "briefing", label: "Lab Notes" },
  ];
  const tiers = Array.from(new Set(techDefs.map((t) => t.tier))).sort((a, b) => a - b);
  const ownedTech = techDefs.filter((t) => state.tech[t.id]);
  const scaleCost = (cost, mult) => Object.fromEntries(Object.entries(cost || {}).map(([k, v]) => [k, Math.ceil(v * (mult || 1))]));
  return (
    <section className="panel space-y-3">
      <div>
        <div className="text-lg font-semibold">R&D Grid</div>
        <div className="text-muted text-sm">Branching lattice; unlocks require prior nodes.</div>
      </div>
      <div className="card space-y-3">
        <div className="row row-between">
          <div className="font-semibold">Research Matrix</div>
          <div className="flex flex-wrap gap-2">
            {techTabs.map((tab) => (
              <button key={tab.id} className={`tab ${pane === tab.id ? "active" : ""}`} onClick={() => setPane(tab.id)}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {pane === "lattice" && (
          <div className="space-y-4 max-h-[520px] overflow-y-auto pr-1">
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
        )}

        {pane === "catalog" && (
          <div className="space-y-2">
            <div className="font-semibold">Integrated Tech</div>
            <div className="text-xs text-muted">{ownedTech.length} nodes integrated.</div>
            <div className="list max-h-[420px] overflow-y-auto pr-1">
              {ownedTech.map((t) => (
                <div key={t.id} className="row-item">
                  <div className="row-details">
                    <div className="row-title">{t.name}</div>
                    <div className="row-meta">{t.desc}</div>
                  </div>
                </div>
              ))}
              {!ownedTech.length && <div className="text-muted text-sm">No nodes integrated yet.</div>}
            </div>
          </div>
        )}

        {pane === "briefing" && (
          <div className="space-y-2">
            <div className="font-semibold">Lab Notes</div>
            <ul className="text-sm text-muted list-disc list-inside space-y-1">
              <li>Signal thresholds reveal deeper tiers. Keep scanning to surface new nodes.</li>
              <li>Some branches require multiple prerequisites, plan your routes.</li>
              <li>Tech multipliers scale costs; prioritize core unlocks before wide expansion.</li>
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
