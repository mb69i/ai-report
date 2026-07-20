"use client";

import AppShell from "@/components/AppShell";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, TrendingDown, Activity } from "lucide-react";

const metrics = [
  { label: "Total SKUs Tracked", value: "12,847", change: "+342", trend: "up" },
  { label: "Locations Active", value: "1,204", change: "+18", trend: "up" },
  { label: "Avg Picking Accuracy", value: "97.2%", change: "-0.3%", trend: "down" },
  { label: "Shortage Rate", value: "1.4%", change: "-0.2%", trend: "up" },
];

export default function AnalyticsPage() {
  return (
    <AppShell>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>Analytics</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>Warehouse performance metrics and trend analysis</p>
        </div>

        <div className="stat-grid" style={{ marginBottom: 24 }}>
          {metrics.map((m, i) => (
            <motion.div key={m.label} className="stat-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div className="stat-icon-wrap blue"><BarChart3 size={22} /></div>
                <span className={`stat-change ${m.trend}`}>
                  {m.trend === "up" ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {m.change}
                </span>
              </div>
              <div>
                <div className="stat-value">{m.value}</div>
                <div className="stat-label">{m.label}</div>
              </div>
            </motion.div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div className="card" style={{ minHeight: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center", color: "var(--text-muted)" }}>
              <Activity size={40} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
              <div style={{ fontSize: 14 }}>Picking Accuracy Trend</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Charts will render with live warehouse data</div>
            </div>
          </div>
          <div className="card" style={{ minHeight: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center", color: "var(--text-muted)" }}>
              <BarChart3 size={40} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
              <div style={{ fontSize: 14 }}>Inventory Variance by Zone</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Charts will render with live warehouse data</div>
            </div>
          </div>
        </div>
      </motion.div>
    </AppShell>
  );
}
