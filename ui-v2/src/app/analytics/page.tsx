"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { motion } from "framer-motion";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Package,
  MapPin,
  Target,
  AlertOctagon,
  RefreshCw,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import {
  getAnalyticsMetrics,
  getAccuracyTrend,
  getVarianceByZone,
  type MetricItem,
  type AccuracyDataPoint,
  type ZoneVariancePoint,
} from "@/lib/api";

// ── Icon map ──────────────────────────────────────────────────────────────────
function metricIcon(label: string) {
  if (label.toLowerCase().includes("sku")) return Package;
  if (label.toLowerCase().includes("location")) return MapPin;
  if (label.toLowerCase().includes("pick")) return Target;
  if (label.toLowerCase().includes("shortage")) return AlertOctagon;
  return BarChart3;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function ChartSkeleton({ label }: { label: string }) {
  return (
    <div
      style={{
        minHeight: 300,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      <div style={{ width: "100%", height: 200, background: "var(--bg-elevated)", borderRadius: 8, animation: "pulse 1.4s ease-in-out infinite" }} />
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</span>
    </div>
  );
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────
function AccuracyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const acc = payload.find((p: any) => p.dataKey === "accuracy");
  const picks = payload.find((p: any) => p.dataKey === "picks");
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        padding: "10px 14px",
        boxShadow: "var(--shadow-md)",
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {acc?.value != null && (
        <div style={{ color: "var(--success)" }}>Accuracy: {acc.value}%</div>
      )}
      {picks?.value != null && (
        <div style={{ color: "var(--text-muted)" }}>Picks: {picks.value}</div>
      )}
      {acc?.value == null && (
        <div style={{ color: "var(--text-muted)" }}>No picks this day</div>
      )}
    </div>
  );
}

function VarianceTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        padding: "10px 14px",
        boxShadow: "var(--shadow-md)",
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [metrics, setMetrics] = useState<MetricItem[] | null>(null);
  const [accuracyData, setAccuracyData] = useState<AccuracyDataPoint[] | null>(null);
  const [zoneData, setZoneData] = useState<ZoneVariancePoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    const [m, a, z] = await Promise.all([
      getAnalyticsMetrics(),
      getAccuracyTrend(),
      getVarianceByZone(),
    ]);
    setMetrics(m);
    setAccuracyData(a);
    setZoneData(z);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    let cancelled = false;
    load();
    const interval = setInterval(() => { if (!cancelled) load(); }, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // Thin out accuracy trend to every 3rd point for readability on the x-axis
  const thinAccuracy = accuracyData?.filter((_, i) => i % 3 === 0 || i === (accuracyData.length - 1));

  return (
    <AppShell>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800 }}>Analytics</h2>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
              Live warehouse performance metrics — updated every 60 seconds
            </p>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => load(true)}
            disabled={refreshing}
            style={{ gap: 6 }}
          >
            <RefreshCw size={13} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
            Refresh
          </button>
        </div>

        {/* ── Stat Cards ──────────────────────────────────────────────────── */}
        <div className="stat-grid" style={{ marginBottom: 28 }}>
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="stat-card">
                  <div style={{ height: 90, background: "var(--bg-elevated)", borderRadius: 8, animation: "pulse 1.4s ease-in-out infinite" }} />
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
                      <div className="stat-icon-wrap blue"><Icon size={22} /></div>
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

        {/* ── Charts ──────────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

          {/* Picking Accuracy Trend */}
          <motion.div
            className="card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="card-header">
              <div>
                <div className="card-title">Picking Accuracy Trend</div>
                <div className="card-subtitle">Last 30 days — daily accuracy %</div>
              </div>
              <span className="stat-change up" style={{ fontSize: 13 }}>
                <TrendingUp size={13} />
                30 days
              </span>
            </div>
            {loading ? (
              <ChartSkeleton label="Loading accuracy trend…" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={thinAccuracy ?? []} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    domain={[85, 100]}
                    tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip content={<AccuracyTooltip />} />
                  <ReferenceLine y={95} stroke="var(--warning)" strokeDasharray="4 4" label={{ value: "Target 95%", fill: "var(--warning)", fontSize: 10, position: "insideTopRight" }} />
                  <Line
                    type="monotone"
                    dataKey="accuracy"
                    stroke="var(--accent)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4, fill: "var(--accent)", stroke: "white", strokeWidth: 2 }}
                    connectNulls={false}
                    name="Accuracy"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          {/* Inventory Variance by Zone */}
          <motion.div
            className="card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.36 }}
          >
            <div className="card-header">
              <div>
                <div className="card-title">Inventory Variance by Zone</div>
                <div className="card-subtitle">Cycle count results — last 30 days</div>
              </div>
            </div>
            {loading ? (
              <ChartSkeleton label="Loading zone variance…" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={zoneData ?? []} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="zone"
                    tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<VarianceTooltip />} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  />
                  <Bar dataKey="clean" name="Clean" fill="var(--success)" radius={[3, 3, 0, 0]} opacity={0.85} />
                  <Bar dataKey="overages" name="Overages" fill="var(--info)" radius={[3, 3, 0, 0]} opacity={0.85} />
                  <Bar dataKey="shortages" name="Shortages" fill="var(--error)" radius={[3, 3, 0, 0]} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </motion.div>

        </div>
      </motion.div>
    </AppShell>
  );
}
