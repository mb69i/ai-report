"use client";

import AppShell from "@/components/AppShell";
import { motion } from "framer-motion";
import { Puzzle, Package, BarChart3, FileSpreadsheet, Bell, CheckCircle2 } from "lucide-react";

const skills = [
  { name: "Cycle Count", version: "1.3.0", category: "Inventory", enabled: true, description: "Automated cycle count collection, normalization, and discrepancy analysis" },
  { name: "Picking Performance", version: "1.1.0", category: "Operations", enabled: true, description: "Track pick rates, accuracy, and operator performance across zones" },
  { name: "Receiving Audit", version: "1.2.0", category: "Inbound", enabled: true, description: "Dock-level receiving verification with PO matching" },
  { name: "Shipping Verification", version: "1.0.0", category: "Outbound", enabled: false, description: "Outbound shipment validation with carrier tracking integration" },
  { name: "Excel Report Parser", version: "2.0.0", category: "Data", enabled: true, description: "Universal Excel/CSV parser with column auto-mapping" },
];

export default function SkillsPage() {
  return (
    <AppShell>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>Installed Skills</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>Modular capabilities that extend Atlas intelligence</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {skills.map((skill, i) => (
            <motion.div key={i} className="card" style={{ padding: 20 }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ width: 40, height: 40, borderRadius: "var(--r-md)", background: "var(--accent-subtle)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Puzzle size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{skill.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>v{skill.version} · {skill.category}</div>
                  </div>
                </div>
                <div style={{ width: 36, height: 20, borderRadius: 10, background: skill.enabled ? "var(--accent)" : "var(--bg-elevated)", cursor: "pointer", position: "relative", transition: "background 200ms" }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", background: "white", position: "absolute", top: 2, left: skill.enabled ? 18 : 2, transition: "left 200ms", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                </div>
              </div>
              <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>{skill.description}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </AppShell>
  );
}
