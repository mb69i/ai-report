"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, TrendingDown, Activity, Package, MapPin, Target, AlertOctagon } from "lucide-react";
import { getAnalyticsMetrics, type MetricItem } from "@/lib/api";

// Icon map keyed on metric label substring
function metricIcon(label: string) {
  if (label.toLowerCase().includes("sku")) return Package;
  if (label.toLowerCase().includes("location")) return MapPin;
  if (label.toLowerCase().includes("pick")) return Target;
  if (label.toLowerCase().includes("shortage")) return AlertOctagon;
  return BarChart3;
}

function SkeletonPulse({ height = 120 }: { height?: number }) {
  return (
    <div
      style={{
        height,
        borderRadius: "var(--r-lg)",
        background: "var(--bg-elevated)",
        animation: "pulse 1.4s ease-in-out infinite",
      }}
    />
  );
}

export default function AnalyticsPage() {
  const [metrics, setMetrics] = useState<MetricItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const data = await getAnalyticsMetrics();
      if (!cancelled) {
        setMetrics(data);
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
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>Analytics</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
            Warehouse performance metrics and trend analysis
          </p>
        </div>

        <div className="stat-grid" style={{ marginBottom: 24 }}>
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="stat-card">
                  <SkeletonPulse height={90} />
                </div>
              ))
            : (metrics ?? []).map((m, i) => {
                const Icon = metricIcon(m.label);
                return (
                  <motion.div
                    key={m.label}
                    className="stat-card"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div className="stat-icon-wrap blue">
                        <Icon size={22} />
                      </div>
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
                );
              })}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div
            className="card"
            style={{ minHeight: 300, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <div style={{ textAlign: "center", color: "var(--text-muted)" }}>
              <Activity size={40} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>Picking Accuracy Trend</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                {loading
                  ? "Loading data…"
                  : `${metrics?.find((m) => m.label.toLowerCase().includes("pick"))?.value ?? "–"} accuracy over the last 30 days`}
              </div>
            </div>
          </div>
          <div
            className="card"
            style={{ minHeight: 300, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <div style={{ textAlign: "center", color: "var(--text-muted)" }}>
              <BarChart3 size={40} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>Inventory Variance by Zone</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                {loading
                  ? "Loading data…"
                  : `Shortage rate: ${metrics?.find((m) => m.label.toLowerCase().includes("shortage"))?.value ?? "–"}`}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AppShell>
  );
}
