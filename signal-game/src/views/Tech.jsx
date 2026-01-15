import { useState } from "react";

// Tech view: branching techs with prereqs; uses helpers from App for afford/prereq checks.
export default function TechView({ state, buyTech, format, techDefs, hasPrereqs, canAffordUI, costText, techUnlockMult, techCostMult }) {
  const [pane, setPane] = useState("lattice");
  const techTabs = [
    { id: "lattice", label: "Research Lattice" },
    { id: "catalog", label: "Tech Archive" },
    { id: "briefing", label: "Lab Notes" },
  ];
  const techTrack = (tech) => {
    const id = tech.id || "";
    if (id.includes("scan") || id.includes("rift")) return "Scan Track";
    if (id.includes("hazard") || id.includes("shield")) return "Safety Track";
    if (id.includes("drone") || id.includes("auto") || id.includes("log")) return "Logistics Track";
    if (id.includes("bio") || id.includes("hab")) return "Habitat Track";
    return "Core Track";
  };
  const tiers = Array.from(new Set(techDefs.map((t) => t.tier))).sort((a, b) => a - b);
  const ownedTech = techDefs.filter((t) => state.tech[t.id]);
  const scaleCost = (cost, mult) => Object.fromEntries(Object.entries(cost || {}).map(([k, v]) => [k, Math.ceil(v * (mult || 1))]));
  const nextUnlock = techDefs
    .filter((t) => !state.tech[t.id])
    .map((t) => Math.ceil(t.unlock * (techUnlockMult || 1)))
    .sort((a, b) => a - b)[0];
  return (
    <section className="panel space-y-4 tech-command">
      <div className="relative overflow-hidden rounded-2xl border border-lime-400/20 bg-slate-950/80 p-4 tech-banner">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(163,230,53,0.18),transparent_60%)]" />
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-slate-950/90 to-transparent" />
        <div className="relative z-10 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-lime-200/70">Research Command</div>
            <div className="text-2xl font-semibold">R&D Grid</div>
            <div className="text-sm text-muted mt-1">Branching lattice; unlocks require prior nodes.</div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="tag">Integrated {ownedTech.length}/{techDefs.length}</span>
            <span className="tag">Signal {format(state.resources.signal || 0)}</span>
            <span className="tag">Next Reveal {nextUnlock ? format(nextUnlock) : "Complete"}</span>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 space-y-3 tech-deck">
        <div className="row row-between">
          <div>
            <div className="font-semibold">Research Matrix</div>
            <div className="text-xs text-muted">Unlock routes, review integrations, and archive lab notes.</div>
          </div>
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
              <div key={tier} className="card space-y-2 tech-panel">
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
                          <div className="row-meta text-xs text-muted">Track: {techTrack(t)} | {prereqText}</div>
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
            <div className="list max-h-[420px] overflow-y-auto pr-1 tech-panel">
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
            <div className="tech-panel card">
              <ul className="text-sm text-muted list-disc list-inside space-y-1">
                <li>Signal thresholds reveal deeper tiers. Keep scanning to surface new nodes.</li>
                <li>Some branches require multiple prerequisites, plan your routes.</li>
                <li>Tech multipliers scale costs; prioritize core unlocks before wide expansion.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
