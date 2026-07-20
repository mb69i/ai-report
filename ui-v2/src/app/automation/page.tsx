"use client";

import AppShell from "@/components/AppShell";
import { motion } from "framer-motion";
import { Workflow, Plus, Play, Pause, ArrowRight, GripVertical } from "lucide-react";

const automations = [
  { name: "Daily Cycle Count Collection", steps: 6, status: "active", lastRun: "Today 06:00", schedule: "Daily at 06:00" },
  { name: "Weekly Picking Performance", steps: 8, status: "active", lastRun: "Monday 07:00", schedule: "Every Monday" },
  { name: "Shortage Alert & Email", steps: 5, status: "paused", lastRun: "Yesterday", schedule: "On trigger" },
  { name: "SAP Export & Normalize", steps: 10, status: "active", lastRun: "Today 05:30", schedule: "Daily at 05:30" },
];

export default function AutomationPage() {
  return (
    <AppShell>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800 }}>Automation Studio</h2>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>Visual automation builder — no code required</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary btn-sm"><Workflow size={14} /> Teach Atlas</button>
            <button className="btn btn-primary btn-sm"><Plus size={14} /> New Automation</button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {automations.map((auto, i) => (
            <motion.div
              key={i}
              className="card"
              style={{ cursor: "pointer", padding: 20, position: "relative", overflow: "hidden" }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              whileHover={{ y: -2 }}
            >
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: auto.status === "active" ? "var(--accent)" : "var(--text-disabled)", opacity: auto.status === "active" ? 1 : 0.3 }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "var(--r-sm)", background: "var(--accent-subtle)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Workflow size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{auto.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{auto.steps} steps · {auto.schedule}</div>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Last: {auto.lastRun}</span>
                <span style={{ padding: "2px 8px", borderRadius: "var(--r-full)", fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", background: auto.status === "active" ? "var(--success-bg)" : "var(--warning-bg)", color: auto.status === "active" ? "var(--success)" : "var(--warning)", border: `1px solid ${auto.status === "active" ? "rgba(22,163,74,0.2)" : "rgba(217,119,6,0.2)"}` }}>
                  {auto.status}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </AppShell>
  );
}
