// Missions view: handles target selection, launch config, specialists, auto-launch, and showing active missions.
import { useState } from "react";

export default function MissionsView({ state, startMission, setAutoLaunch, setSelected, format, missionModeById, missionYield, formatDuration, bodies, missionModes, isUnlockedUI, baseBonuses, hubRange, depletionFactor, missionMods, missionDurationMult }) {
  return (
    <section className="panel space-y-3">
      <div>
        <div className="text-lg font-semibold">Missions</div>
        <div className="text-muted text-sm">Biome-specific hazards and loot. Boost fuel to cut travel time. Debris Field is your early fuel/research drip.</div>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div className="card">
          <div className="font-semibold mb-1">Targets</div>
          <div className="list">
            {bodies.map((b) => {
              const locked = !isUnlockedUI(state, b);
              const rangeLocked = (b.tier || 1) > hubRange;
              const efficiency = depletionFactor(b.id);
              const efficiencyPct = Math.round(efficiency * 100);
              return (
                <div key={b.id} className="row-item">
                  <div className="row-details">
                    <div className="row-title">
                      {b.name} {!locked && state.selectedBody === b.id && <span className="tag">Selected</span>} {rangeLocked && <span className="tag">Out of Range</span>} {!rangeLocked && locked && <span className="tag">Locked</span>}
                    </div>
                    <div className="row-meta">{b.type.toUpperCase()} - Travel {formatDuration(b.travel * 1000)} - Hazard {(b.hazard * 100).toFixed(0)}%</div>
                    <div className="row-meta text-xs text-muted">Tier {b.tier} | Efficiency {efficiencyPct}%</div>
                    {rangeLocked && <div className="row-meta text-xs text-muted">Requires Range Tier {b.tier} (current {hubRange}).</div>}
                  </div>
                  <button className="btn" disabled={locked} onClick={() => setSelected(b.id)}>Target</button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="font-semibold mb-1">Launch</div>
          <MissionLaunch
            state={state}
            startMission={startMission}
            setAutoLaunch={setAutoLaunch}
            format={format}
            missionModeById={missionModeById}
            missionYield={missionYield}
            formatDuration={formatDuration}
            bodies={bodies}
            missionModes={missionModes}
            baseBonuses={baseBonuses}
            depletionFactor={depletionFactor}
            missionMods={missionMods}
            missionDurationMult={missionDurationMult}
          />
        </div>
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
  return (
    <div className="space-y-3">
      <div className="text-sm text-muted">Slots {active.length}/{slots}</div>
      <div className="row-item">
        <div className="row-details">
          <div className="row-title">Mission Stance</div>
          <div className="row-meta">{mode?.desc}</div>
        </div>
        <select className="select bg-slate-800 text-white" value={modeId} onChange={(e) => setModeId(e.target.value)}>
          {missionModes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <div className="row">
        <input type="range" min="0" max="10" value={fuelBoost} onChange={(e) => setFuelBoost(Number(e.target.value))} />
        <span className="text-sm text-muted">Fuel boost: {fuelBoost}</span>
      </div>
      <div className="row-item">
        <div className="row-details">
          <div className="row-title">Cargo Forecast</div>
          <div className="row-meta">{Object.entries(forecast).map(([k, v]) => `${format(v)} ${k}`).join(" - ")}</div>
          <div className="row-meta">Hazard {Math.round(hazard * 100)}% | Fail risk ~{failChance}% | Travel {formatDuration(travelMs)} | Mode {mode?.name}</div>
          <div className="row-meta text-xs text-muted">Efficiency {efficiencyPct}% | Variance +/-10%</div>
          {command.over > 0 && <div className="row-meta text-xs text-muted">Command over-capacity: -{Math.round(command.over * 7)}% cargo, +{Math.round(command.over * 8)}% travel time.</div>}
        </div>
        <button className="btn btn-primary" onClick={() => startMission(body.id, fuelBoost, modeId, specialist)}>Launch</button>
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
      <div className="row-item">
        <div className="row-details">
          <div className="row-title">Auto-launch</div>
          <div className="row-meta">Launch this target automatically when slots are free.</div>
        </div>
        <div className="flex gap-2 items-center">
          <input type="checkbox" checked={auto.enabled && auto.bodyId === body.id} onChange={(e) => {
            if (e.target.checked) setAutoLaunch({ enabled: true, bodyId: body.id, mode: modeId, specialist });
            else setAutoLaunch({ enabled: false, bodyId: null, mode: "balanced", specialist: "none" });
          }} />
          <span className="text-sm text-muted">{auto.enabled && auto.bodyId === body.id ? "Enabled" : "Disabled"}</span>
        </div>
      </div>
      <div className="list">
        {active.map((m, i) => {
          const b = bodies.find((x) => x.id === m.bodyId);
          const remaining = Math.max(0, m.endsAt - Date.now());
          return (
            <div key={i} className="row-item">
              <div className="row-details">
                <div className="row-title">En route to {b?.name || "target"} <span className="tag">{missionModeById(m.mode)?.name || "Balanced"}</span></div>
                <div className="row-meta">{formatDuration(remaining)} remaining</div>
                {m.objective && <div className="row-meta text-xs text-muted">Side objective: {m.objective.desc}</div>}
                {m.specialist && m.specialist !== "none" && <div className="row-meta text-xs text-muted">Specialist: {m.specialist}</div>}
              </div>
            </div>
          );
        })}
        {!active.length && <div className="text-muted text-sm">No active missions.</div>}
      </div>
    </div>
  );
}
