// Missions view: handles target selection, launch config, specialists, auto-launch, and showing active missions.
import { useEffect, useState } from "react";

export default function MissionsView({ state, startMission, setAutoLaunch, setSelected, format, missionModeById, missionYield, formatDuration, bodies, missionModes, isUnlockedUI, baseBonuses, hubRange, depletionFactor, missionMods, missionDurationMult, bodyUnlockMult }) {
  const [pane, setPane] = useState("targeting");
  const missionTabs = [
    { id: "targeting", label: "Target Lattice" },
    { id: "launch", label: "Launch Bay" },
    { id: "active", label: "Ops Monitor" },
    { id: "intel", label: "Signal Intel" },
  ];
  const selectedBody = bodies.find((b) => b.id === state.selectedBody) || bodies[0];
  const efficiency = depletionFactor(selectedBody.id);
  const efficiencyPct = Math.round(efficiency * 100);
  const bonuses = baseBonuses ? baseBonuses(selectedBody.id) : { cargo: 1, travel: 1, hazard: 1 };
  const rangeLocked = (selectedBody.tier || 1) > hubRange;
  const missionsDone = state.milestones?.missionsDone || 0;
  const signal = state.resources.signal || 0;
  const techState = state.tech || {};
  const formatName = (value) => value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  const modeUnlocked = (mode) => {
    if (!mode?.unlock) return true;
    const unlock = mode.unlock || {};
    if (unlock.missions && missionsDone < unlock.missions) return false;
    if (unlock.signal && signal < unlock.signal) return false;
    if (unlock.tech && !techState[unlock.tech]) return false;
    return true;
  };
  const unlockedModes = missionModes.filter(modeUnlocked);
  const lockedModes = missionModes.filter((mode) => !modeUnlocked(mode));
  const modeUnlockText = (mode) => {
    const unlock = mode.unlock || {};
    const parts = [];
    if (unlock.missions) parts.push(`${unlock.missions} missions`);
    if (unlock.signal) parts.push(`Signal ${unlock.signal}`);
    if (unlock.tech) parts.push(`Tech: ${formatName(unlock.tech)}`);
    return parts.length ? parts.join(" · ") : "Locked";
  };
  const formatBonus = (value) => {
    const delta = Math.round((value - 1) * 100);
    if (delta === 0) return "0%";
    return `${delta > 0 ? "+" : ""}${delta}%`;
  };

  return (
    <section className="panel space-y-4 mission-command">
      <div className="relative overflow-hidden rounded-2xl border border-sky-400/20 bg-slate-950/80 p-4 mission-banner">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),transparent_60%)]" />
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-slate-950/90 to-transparent" />
        <div className="relative z-10 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-sky-200/70">Mission Control</div>
            <div className="text-2xl font-semibold">Missions</div>
            <div className="text-sm text-muted mt-1">Biome-specific hazards and salvage. Burn fuel to cut transit time. Debris Field is your early fuel/research trickle.</div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="tag">Range Tier {hubRange}</span>
            <span className="tag">Efficiency {efficiencyPct}%</span>
            <span className="tag">Selected {selectedBody.name}</span>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 space-y-3 mission-deck">
        <div className="row row-between">
          <div>
            <div className="font-semibold">Mission Operations Deck</div>
            <div className="text-xs text-muted">Targeting, launch routing, and live ops telemetry.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {missionTabs.map((tab) => (
              <button key={tab.id} className={`tab ${pane === tab.id ? "active" : ""}`} onClick={() => setPane(tab.id)}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {pane === "targeting" && (
          <div className="grid md:grid-cols-2 gap-3">
            <div className="card mission-panel">
              <div className="font-semibold mb-1">Target Locks</div>
              <div className="list max-h-[420px] overflow-y-auto pr-1">
                {bodies.map((b) => {
                  const locked = !isUnlockedUI(state, b);
                  const bodyRangeLocked = (b.tier || 1) > hubRange;
                  const bodyEfficiency = depletionFactor(b.id);
                  const efficiencyLabel = Math.round(bodyEfficiency * 100);
                  const requirements = [];
                  if (bodyRangeLocked) requirements.push(`Range tier ${b.tier}`);
                  if (b.requireMissions && missionsDone < b.requireMissions) requirements.push(`Missions ${missionsDone}/${b.requireMissions}`);
                  if (b.requireTech && !techState[b.requireTech]) requirements.push(`Tech: ${formatName(b.requireTech)}`);
                  if (!bodyRangeLocked && b.unlock) {
                    const requiredSignal = Math.ceil((b.unlock || 0) * (bodyUnlockMult || 1));
                    if (signal < requiredSignal) requirements.push(`Signal ${Math.floor(signal)}/${requiredSignal}`);
                  }
                  return (
                    <div key={b.id} className="row-item">
                      <div className="row-details">
                        <div className="row-title">
                          {b.name} {!locked && state.selectedBody === b.id && <span className="tag">Selected</span>} {bodyRangeLocked && <span className="tag">Beyond Range</span>} {!bodyRangeLocked && locked && <span className="tag">Locked</span>}
                        </div>
                        <div className="row-meta">{b.type.toUpperCase()} - Travel {formatDuration(b.travel * 1000)} - Hazard {(b.hazard * 100).toFixed(0)}%</div>
                        <div className="row-meta text-xs text-muted">Tier {b.tier} | Efficiency {efficiencyLabel}%</div>
                        {!!requirements.length && <div className="row-meta text-xs text-muted">Unlock: {requirements.join(" · ")}</div>}
                      </div>
                      <button className="btn" disabled={locked} onClick={() => setSelected(b.id)}>Lock</button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card space-y-2 mission-panel">
              <div className="font-semibold">Target Intel</div>
              <div className="row-item">
                <div className="row-details">
                  <div className="row-title">{selectedBody.name}</div>
                  <div className="row-meta">{selectedBody.type.toUpperCase()} | Travel {formatDuration(selectedBody.travel * 1000)} | Hazard {(selectedBody.hazard * 100).toFixed(0)}%</div>
                </div>
                {rangeLocked && <span className="tag">Beyond Range</span>}
              </div>
              <div className="text-xs text-muted">Efficiency {efficiencyPct}% | Range Tier {selectedBody.tier || 1}</div>
              <div className="text-xs text-muted">Base modifiers: Cargo {formatBonus(bonuses.cargo || 1)} | Travel {formatBonus(bonuses.travel || 1)} | Hazard {formatBonus(bonuses.hazard || 1)}</div>
              <div className="text-xs text-muted">Range Tier {hubRange} opens higher targets. Extend range via Hub Scan Array, Tech (Deep Scan/Rift Mapping), and Relay Anchors.</div>
            </div>
          </div>
        )}

        {pane === "launch" && (
          <div className="space-y-2">
            <div className="font-semibold">Launch Bay</div>
            <MissionLaunch
              state={state}
              startMission={startMission}
              setAutoLaunch={setAutoLaunch}
              format={format}
              missionModeById={missionModeById}
              missionYield={missionYield}
              formatDuration={formatDuration}
              bodies={bodies}
              missionModes={unlockedModes}
              baseBonuses={baseBonuses}
              depletionFactor={depletionFactor}
              missionMods={missionMods}
              missionDurationMult={missionDurationMult}
            />
          </div>
        )}

        {pane === "active" && (
          <div className="space-y-2">
            <div className="font-semibold">Active Operations</div>
            <div className="card mission-panel">
              <ActiveMissions
                state={state}
                bodies={bodies}
                missionModeById={missionModeById}
                formatDuration={formatDuration}
              />
            </div>
          </div>
        )}

        {pane === "intel" && (
          <div className="space-y-2">
            <div className="font-semibold">Operational Intel</div>
            <div className="card mission-panel">
              <ul className="text-sm text-muted list-disc list-inside space-y-1">
                <li>Fuel boost reduces travel time by 3s per step and reduces returns on long routes.</li>
                <li>Stance selection tunes hazard and reward balance; specialists push a specific output.</li>
                <li>Depletion lowers yields on repeated runs, rotate targets to recover efficiency.</li>
                <li>Command over-capacity increases travel time and reduces cargo return.</li>
                <li>Fragment shards sometimes surface in mission cargo; higher tiers and side objectives improve odds.</li>
              </ul>
            </div>
            {!!lockedModes.length && (
              <div className="card mission-panel space-y-2">
                <div className="font-semibold">Stance Unlocks</div>
                <div className="text-xs text-muted">Additional stances unlock after sorties and uplink milestones.</div>
                <div className="list">
                  {lockedModes.map((mode) => (
                    <div key={mode.id} className="row-item">
                      <div className="row-details">
                        <div className="row-title">{mode.name}</div>
                        <div className="row-meta text-xs text-muted">{modeUnlockText(mode)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function MissionLaunch({ state, startMission, setAutoLaunch, format, missionModeById, missionYield, formatDuration, bodies, missionModes, baseBonuses, depletionFactor, missionMods, missionDurationMult }) {
  const [fuelBoost, setFuelBoost] = useState(0);
  const [modeId, setModeId] = useState("balanced");
  const [specialist, setSpecialist] = useState("none");
  const body = bodies.find((b) => b.id === state.selectedBody) || bodies[0];
  const bonuses = baseBonuses(body.id);
  const efficiency = depletionFactor(body.id);
  const slots = 1 + (state.hubUpgrades.launch_bay || 0) + (state.tech.auto_pilots ? 1 : 0);
  const active = state.missions.active || [];
  const mode = missionModeById(modeId);
  const hazardBase = body.hazard - (state.tech.hazard_gear ? 0.25 : 0) - (state.tech.shielding ? 0.2 : 0) + (mode?.hazard || 0) + (specialist === "engineer" ? -0.1 : 0);
  const hazard = Math.max(0, hazardBase * (bonuses.hazard || 1));
  const forecast = missionYield(state, body, modeId, specialist, efficiency);
  const failChance = Math.min(80, Math.max(5, Math.round(((hazard || 0) * 60 + 5))));
  const auto = state.autoLaunch || {};
  const travelMult = missionMods?.travelMult || 1;
  const travelMs = Math.max(15000, ((body.travel * 1000 * (bonuses.travel || 1) * travelMult) - fuelBoost * 3000 + (mode?.durationMs || 0)) * (missionDurationMult || 1) * (state.tech.auto_pilots ? 0.9 : 1));
  const efficiencyPct = Math.round(efficiency * 100);
  const command = missionMods?.command || { used: 0, capacity: 0, over: 0 };
  useEffect(() => {
    if (!missionModes.length) return;
    if (!missionModes.some((m) => m.id === modeId)) {
      setModeId(missionModes[0].id);
    }
  }, [missionModes, modeId]);
  return (
    <div className="space-y-3">
      <div className="row row-between">
        <div className="text-sm text-muted">Launch status</div>
        <span className="tag">Slots {active.length}/{slots}</span>
      </div>

      <div className="card space-y-2 mission-panel">
        <div className="font-semibold">Launch Settings</div>
        <div className="row-item">
          <div className="row-details">
            <div className="row-title">Operational Stance</div>
            <div className="row-meta">{mode?.desc}</div>
          </div>
          <select className="select bg-slate-800 text-white" value={modeId} onChange={(e) => setModeId(e.target.value)}>
            {missionModes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="row-item">
          <div className="row-details">
            <div className="row-title">Assign Specialist</div>
            <div className="row-meta">Miner: +metal/rare | Botanist: +organics/fuel | Engineer: -hazard, +research</div>
          </div>
          <select className="select bg-slate-800 text-white" value={specialist} onChange={(e) => setSpecialist(e.target.value)}>
            <option value="none">None</option>
            <option value="miner">Miner</option>
            <option value="botanist">Botanist</option>
            <option value="engineer">Engineer</option>
          </select>
        </div>
        <div className="row">
          <input type="range" min="0" max="10" value={fuelBoost} onChange={(e) => setFuelBoost(Number(e.target.value))} />
          <span className="text-sm text-muted">Fuel boost: {fuelBoost}</span>
        </div>
      </div>

      <div className="card space-y-2 mission-panel">
        <div className="font-semibold">Cargo Projection</div>
        <div className="text-sm">{Object.entries(forecast).map(([k, v]) => `${format(v)} ${k}`).join(" - ")}</div>
        <div className="text-xs text-muted">Hazard {Math.round(hazard * 100)}% | Failure risk ~{failChance}% | Travel {formatDuration(travelMs)} | Mode {mode?.name}</div>
        <div className="text-xs text-muted">Efficiency {efficiencyPct}% | Variance +/-10%</div>
        {command.over > 0 && <div className="text-xs text-muted">Command over-capacity: -{Math.round(command.over * 7)}% cargo, +{Math.round(command.over * 8)}% travel time.</div>}
        <button className="btn btn-primary w-full" onClick={() => startMission(body.id, fuelBoost, modeId, specialist)}>Deploy</button>
      </div>

      <div className="card space-y-2 mission-panel">
        <div className="font-semibold">Auto-deploy</div>
        <div className="row row-between">
          <div className="text-sm text-muted">Deploy this target automatically when slots are free.</div>
          <div className="flex gap-2 items-center">
            <input type="checkbox" checked={auto.enabled && auto.bodyId === body.id} onChange={(e) => {
              if (e.target.checked) setAutoLaunch({ enabled: true, bodyId: body.id, mode: modeId, specialist });
              else setAutoLaunch({ enabled: false, bodyId: null, mode: "balanced", specialist: "none" });
            }} />
            <span className="text-sm text-muted">{auto.enabled && auto.bodyId === body.id ? "Armed" : "Idle"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActiveMissions({ state, bodies, missionModeById, formatDuration }) {
  const active = state.missions.active || [];
  return (
    <div className="list max-h-[420px] overflow-y-auto pr-1">
      {active.map((m, i) => {
        const b = bodies.find((x) => x.id === m.bodyId);
        const remaining = Math.max(0, m.endsAt - Date.now());
        return (
          <div key={i} className="row-item">
            <div className="row-details">
              <div className="row-title">In transit to {b?.name || "target"} <span className="tag">{missionModeById(m.mode)?.name || "Balanced"}</span></div>
              <div className="row-meta">{formatDuration(remaining)} remaining</div>
              {m.objective && <div className="row-meta text-xs text-muted">Side objective: {m.objective.desc}</div>}
              {m.specialist && m.specialist !== "none" && <div className="row-meta text-xs text-muted">Specialist: {m.specialist}</div>}
            </div>
          </div>
        );
      })}
      {!active.length && <div className="text-muted text-sm">No active sorties.</div>}
    </div>
  );
}
