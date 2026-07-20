"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { motion } from "framer-motion";
import {
  Microscope,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Filter,
  Plus,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { getActiveInvestigations, type InvestigationItem } from "@/lib/api";

const priorityColors: Record<string, { bg: string; color: string; border: string }> = {
  critical: { bg: "var(--error-bg)", color: "var(--error)", border: "rgba(220,38,38,0.2)" },
  high: { bg: "var(--warning-bg)", color: "var(--warning)", border: "rgba(217,119,6,0.2)" },
  medium: { bg: "var(--info-bg)", color: "var(--info)", border: "rgba(37,99,235,0.2)" },
  low: { bg: "var(--success-bg)", color: "var(--success)", border: "rgba(22,163,74,0.2)" },
};

function SkeletonCard() {
  return (
    <div
      className="card"
      style={{
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        animation: "pulse 1.4s ease-in-out infinite",
      }}
    >
      <div style={{ height: 18, width: "70%", background: "var(--bg-elevated)", borderRadius: 6 }} />
      <div style={{ height: 13, width: "50%", background: "var(--bg-elevated)", borderRadius: 6 }} />
      <div style={{ height: 10, width: "30%", background: "var(--bg-elevated)", borderRadius: 6 }} />
    </div>
  );
}

export default function InvestigationsPage() {
  const [investigations, setInvestigations] = useState<InvestigationItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const data = await getActiveInvestigations();
      if (!cancelled) {
        setInvestigations(data);
        setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <AppShell>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800 }}>Investigations</h2>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
              AI-generated root cause analysis for warehouse discrepancies
              {!loading && investigations !== null && (
                <span style={{ marginLeft: 8, fontWeight: 600, color: "var(--text-primary)" }}>
                  · {investigations.length} active
                </span>
              )}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary btn-sm">
              <Filter size={14} /> Filter
            </button>
            <button className="btn btn-primary btn-sm">
              <Plus size={14} /> New Investigation
            </button>
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2, 3].map((n) => (
              <SkeletonCard key={n} />
            ))}
          </div>
        ) : investigations === null ? (
          /* API error state */
          <div
            className="card"
            style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}
          >
            <AlertTriangle size={36} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
              Could not load investigations
            </div>
            <div style={{ fontSize: 13 }}>Backend is unreachable. Check that the Atlas server is running.</div>
          </div>
        ) : investigations.length === 0 ? (
          /* Empty state */
          <div
            className="card"
            style={{ textAlign: "center", padding: 64, color: "var(--text-muted)" }}
          >
            <ShieldCheck size={48} style={{ margin: "0 auto 16px", color: "var(--success)", opacity: 0.6 }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
              All clear — no open investigations
            </div>
            <div style={{ fontSize: 13 }}>Atlas is actively monitoring. New anomalies will appear here automatically.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {investigations.map((inv, i) => {
              const pc = priorityColors[inv.priority] ?? priorityColors.medium;
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
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: "var(--r-md)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: pc.bg,
                          color: pc.color,
                          flexShrink: 0,
                        }}
                      >
                        {inv.status === "resolved" ? (
                          <CheckCircle2 size={20} />
                        ) : (
                          <AlertTriangle size={20} />
                        )}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14.5, color: "var(--text-primary)" }}>
                          {inv.title}
                        </div>
                        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>
                          {inv.rootCause
                            ? `Root cause: ${inv.rootCause}`
                            : inv.category
                            ? `Category: ${inv.category}`
                            : "Analyzing…"}
                          {" · "}Confidence: {inv.confidence}%
                        </div>
                        {inv.recommendation && (
                          <div
                            style={{
                              marginTop: 8,
                              fontSize: 12,
                              color: "var(--info)",
                              background: "var(--info-bg)",
                              padding: "4px 10px",
                              borderRadius: "var(--r-sm)",
                              display: "inline-block",
                            }}
                          >
                            💡 {inv.recommendation}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: "var(--r-full)",
                              fontSize: 10.5,
                              fontWeight: 600,
                              textTransform: "uppercase",
                              background: pc.bg,
                              color: pc.color,
                              border: `1px solid ${pc.border}`,
                            }}
                          >
                            {inv.priority}
                          </span>
                          {inv.date && (
                            <span
                              style={{
                                fontSize: 11,
                                color: "var(--text-muted)",
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <Clock size={11} /> {inv.date}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ArrowRight size={16} style={{ color: "var(--text-muted)" }} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </AppShell>
  );
}
