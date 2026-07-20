"use client";

import AppShell from "@/components/AppShell";
import { motion } from "framer-motion";
import { Microscope, AlertTriangle, CheckCircle2, Clock, ArrowRight, Filter, Plus } from "lucide-react";

const investigations = [
  { title: "Shortage on SKU WH-4491 at IQ1-2A17", priority: "critical", confidence: 87, status: "open", date: "2 hrs ago", rootCause: "Operator scan bypass detected" },
  { title: "Picking accuracy drop in Zone C", priority: "high", confidence: 73, status: "open", date: "5 hrs ago", rootCause: "System label mismatch" },
  { title: "Missing container CT-8812", priority: "medium", confidence: 91, status: "in_progress", date: "Yesterday", rootCause: "Dock transfer not logged" },
  { title: "Duplicate allocation on Order #78291", priority: "low", confidence: 95, status: "resolved", date: "Jul 18", rootCause: "WMS double-trigger" },
];

const priorityColors: Record<string, { bg: string; color: string; border: string }> = {
  critical: { bg: "var(--error-bg)", color: "var(--error)", border: "rgba(220,38,38,0.2)" },
  high: { bg: "var(--warning-bg)", color: "var(--warning)", border: "rgba(217,119,6,0.2)" },
  medium: { bg: "var(--info-bg)", color: "var(--info)", border: "rgba(37,99,235,0.2)" },
  low: { bg: "var(--success-bg)", color: "var(--success)", border: "rgba(22,163,74,0.2)" },
};

export default function InvestigationsPage() {
  return (
    <AppShell>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800 }}>Investigations</h2>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>AI-generated root cause analysis for warehouse discrepancies</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary btn-sm"><Filter size={14} /> Filter</button>
            <button className="btn btn-primary btn-sm"><Plus size={14} /> New Investigation</button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {investigations.map((inv, i) => {
            const pc = priorityColors[inv.priority];
            return (
              <motion.div
                key={i}
                className="card"
                style={{ cursor: "pointer", padding: 20 }}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.35 }}
                whileHover={{ y: -2 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <div style={{ width: 42, height: 42, borderRadius: "var(--r-md)", display: "flex", alignItems: "center", justifyContent: "center", background: pc.bg, color: pc.color, flexShrink: 0 }}>
                      {inv.status === "resolved" ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14.5, color: "var(--text-primary)" }}>{inv.title}</div>
                      <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>
                        Root cause: {inv.rootCause} · Confidence: {inv.confidence}%
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <span style={{ padding: "2px 8px", borderRadius: "var(--r-full)", fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", background: pc.bg, color: pc.color, border: `1px solid ${pc.border}` }}>{inv.priority}</span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}><Clock size={11} /> {inv.date}</span>
                      </div>
                    </div>
                  </div>
                  <ArrowRight size={16} style={{ color: "var(--text-muted)" }} />
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </AppShell>
  );
}
