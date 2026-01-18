import { useState } from "react";
import MissionsView from "./Missions";
import BasesView from "./Bases";

export default function ExpeditionsView(props) {
  const [pane, setPane] = useState("planning");
  const tabs = [
    { id: "planning", label: "Expedition Planning" },
    { id: "active", label: "Active Expeditions" },
    { id: "outposts", label: "Established Outposts" },
  ];

  return (
    <section className="panel space-y-4 expedition-command">
      <div className="relative overflow-hidden rounded-2xl border border-cyan-400/20 bg-slate-950/80 p-3 sm:p-4 expedition-banner">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),transparent_60%)]" />
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-slate-950/90 to-transparent" />
        <div className="relative z-10 flex flex-col gap-2 sm:gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-cyan-200/70">Expedition Command</div>
            <div className="text-xl sm:text-2xl font-semibold">Survey - Colonize - Operate</div>
            <div className="text-sm text-muted mt-1">Unified command for discovery, launch routing, and outpost management.</div>
          </div>
          <div className="flex flex-wrap gap-1.5 sm:gap-2 text-[11px] sm:text-xs">
            {tabs.map((tab) => (
              <button key={tab.id} className={`tab whitespace-nowrap ${pane === tab.id ? "active" : ""}`} onClick={() => setPane(tab.id)}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {pane === "planning" && (
        <MissionsView
          {...props}
          embedded
          defaultPane="targeting"
        />
      )}
      {pane === "active" && (
        <MissionsView
          {...props}
          embedded
          defaultPane="active"
          compact
        />
      )}
      {pane === "outposts" && (
        <BasesView
          {...props}
          embedded
          compact
        />
      )}
    </section>
  );
}
