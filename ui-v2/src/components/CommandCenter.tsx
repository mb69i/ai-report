"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  FileSpreadsheet,
  Microscope,
  Workflow,
  MessageSquare,
  Download,
  Mail,
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  BarChart3,
  ArrowRight,
  Loader2,
} from "lucide-react";
import {
  getDashboardSummary,
  type DashboardSummary,
  type ActivityItem,
  type AutomationItem,
  type InvestigationItem,
} from "@/lib/api";

// ── Animation variants ────────────────────────────────────────────────────────
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

// ── Static quick-action config (no data dependency) ──────────────────────────
const quickActions = [
  { label: "Download Reports", icon: Download, href: "/reports" },
  { label: "New Investigation", icon: Microscope, href: "/investigations" },
  { label: "Ask Atlas AI", icon: MessageSquare, href: "/chat" },
  { label: "Run Automation", icon: Workflow, href: "/automation" },
  { label: "Email Report", icon: Mail, href: "/reports" },
  { label: "View Analytics", icon: BarChart3, href: "/analytics" },
];

// ── Stat card config maps API keys to labels/icons ───────────────────────────
function buildStats(summary: DashboardSummary) {
  return [
    {
      label: "Reports Today",
      value: String(summary.reports_today),
      change: "+3",
      trend: "up" as const,
      icon: FileSpreadsheet,
      color: "red",
    },
    {
      label: "Active Investigations",
      value: String(summary.active_investigations),
      change: summary.active_investigations > 0 ? `+${summary.active_investigations}` : "0",
      trend: "down" as const,
      icon: Microscope,
      color: "amber",
    },
    {
      label: "Automations Running",
      value: String(summary.automations_running),
      change: "+1",
      trend: "up" as const,
      icon: Workflow,
      color: "blue",
    },
    {
      label: "Warehouse Health",
      value: summary.warehouse_health,
      change: "+2%",
      trend: "up" as const,
      icon: Activity,
      color: "green",
    },
  ];
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SkeletonPulse({ width = "100%", height = 18 }: { width?: string | number; height?: number }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 6,
        background: "var(--bg-elevated)",
        animation: "pulse 1.4s ease-in-out infinite",
      }}
    />
  );
}

function LiveAutomations({ automations }: { automations: AutomationItem[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {automations.map((auto) => (
        <div key={auto.name} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                className={`status-dot ${auto.status === "running" ? "pulse" : ""}`}
                style={{ color: auto.status === "running" ? "var(--success)" : "var(--text-muted)" }}
              />
              <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>
                {auto.name}
              </span>
            </div>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 8px",
                borderRadius: "var(--r-full)",
                fontSize: 10.5,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                background: auto.status === "running" ? "var(--success-bg)" : "var(--bg-elevated)",
                color: auto.status === "running" ? "var(--success)" : "var(--text-muted)",
                border: `1px solid ${auto.status === "running" ? "rgba(22,163,74,0.2)" : "var(--border)"}`,
              }}
            >
              {auto.status}
            </span>
          </div>
          {auto.status === "running" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  flex: 1,
                  height: 4,
                  background: "var(--bg-elevated)",
                  borderRadius: "var(--r-full)",
                  overflow: "hidden",
                }}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${auto.progress}%` }}
                  transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                  style={{ height: "100%", background: "var(--accent)", borderRadius: "var(--r-full)" }}
                />
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", minWidth: 36, textAlign: "right" }}>
                {auto.progress}%
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function RecentInvestigations({ investigations }: { investigations: InvestigationItem[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {investigations.map((inv, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
            background: "var(--bg-elevated)",
            borderRadius: "var(--r-md)",
            border: "1px solid var(--border)",
            cursor: "pointer",
            transition: "all 150ms",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "var(--r-sm)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background:
                  inv.priority === "critical" || inv.priority === "high"
                    ? "var(--error-bg)"
                    : inv.priority === "medium"
                    ? "var(--warning-bg)"
                    : "var(--info-bg)",
                color:
                  inv.priority === "critical" || inv.priority === "high"
                    ? "var(--error)"
                    : inv.priority === "medium"
                    ? "var(--warning)"
                    : "var(--info)",
              }}
            >
              {inv.status === "resolved" ? (
                <CheckCircle2 size={18} />
              ) : inv.priority === "critical" || inv.priority === "high" ? (
                <AlertTriangle size={18} />
              ) : (
                <Microscope size={18} />
              )}
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>{inv.title}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
                Confidence: {inv.confidence}% · Priority: {inv.priority}
              </div>
            </div>
          </div>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: "var(--r-full)",
              fontSize: 10.5,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              background: inv.status === "resolved" ? "var(--success-bg)" : "var(--warning-bg)",
              color: inv.status === "resolved" ? "var(--success)" : "var(--warning)",
              border: `1px solid ${inv.status === "resolved" ? "rgba(22,163,74,0.2)" : "rgba(217,119,6,0.2)"}`,
            }}
          >
            {inv.status}
          </span>
        </div>
      ))}
    </div>
  );
}

function ActivityFeed({ activity }: { activity: ActivityItem[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {activity.map((event, i) => (
        <div className="activity-item" key={i}>
          <div className={`activity-dot ${event.type}`} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="activity-text">{event.text}</div>
            <div className="activity-time">
              <Clock size={10} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
              {event.time}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CommandCenter() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const data = await getDashboardSummary();
      if (!cancelled) {
        setSummary(data);
        setLoading(false);
      }
    };

    load();

    // Refresh every 60 seconds for live feel
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const stats = summary ? buildStats(summary) : null;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const bannerLine = summary
    ? `Atlas processed ${summary.reports_today} reports today. ${summary.automations_running} automation${summary.automations_running !== 1 ? "s" : ""} active. ${summary.active_investigations} investigation${summary.active_investigations !== 1 ? "s" : ""} require attention.`
    : "Loading live warehouse data…";

  return (
    <motion.div variants={container} initial="hidden" animate="show" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* ── Welcome Banner ─────────────────────────────────────────── */}
      <motion.div
        variants={item}
        style={{
          background: "linear-gradient(135deg, var(--accent) 0%, #6B0B01 100%)",
          borderRadius: "var(--r-xl)",
          padding: "32px 36px",
          color: "white",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "0 8px 32px rgba(169, 14, 2, 0.3)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 4, fontWeight: 500 }}>Good {greeting}</div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>Command Center</div>
          <div style={{ fontSize: 14, opacity: 0.75, marginTop: 8, maxWidth: 480, lineHeight: 1.5 }}>
            {bannerLine}
          </div>
        </div>
        <div style={{ position: "relative", zIndex: 1, display: "flex", gap: 12 }}>
          <button className="btn" style={{ background: "rgba(255,255,255,0.15)", color: "white", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.2)" }}>
            <MessageSquare size={16} />
            Ask Atlas AI
          </button>
          <button className="btn" style={{ background: "white", color: "var(--accent)" }}>
            <Zap size={16} />
            Quick Run
          </button>
        </div>
        <div style={{ position: "absolute", right: -40, top: -40, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
        <div style={{ position: "absolute", right: 60, bottom: -60, width: 150, height: 150, borderRadius: "50%", background: "rgba(255,255,255,0.03)" }} />
      </motion.div>

      {/* ── Stat Cards ─────────────────────────────────────────────── */}
      <div className="stat-grid">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <motion.div key={i} className="stat-card" variants={item}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <SkeletonPulse width={40} height={40} />
                  <SkeletonPulse width="60%" height={28} />
                  <SkeletonPulse width="80%" height={14} />
                </div>
              </motion.div>
            ))
          : stats!.map((stat) => {
              const Icon = stat.icon;
              return (
                <motion.div key={stat.label} className="stat-card" variants={item}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div className={`stat-icon-wrap ${stat.color}`}>
                      <Icon size={22} />
                    </div>
                    <span className={`stat-change ${stat.trend}`}>
                      {stat.trend === "up" ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      {stat.change}
                    </span>
                  </div>
                  <div>
                    <div className="stat-value">{stat.value}</div>
                    <div className="stat-label">{stat.label}</div>
                  </div>
                </motion.div>
              );
            })}
      </div>

      {/* ── Main Grid ──────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20 }}>
        {/* Left Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Quick Actions */}
          <motion.div className="card" variants={item}>
            <div className="card-header">
              <div>
                <div className="card-title">Quick Actions</div>
                <div className="card-subtitle">Common tasks — one click away</div>
              </div>
            </div>
            <div className="quick-actions">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <a key={action.label} href={action.href} className="quick-action">
                    <div className="quick-action-icon">
                      <Icon size={20} />
                    </div>
                    {action.label}
                  </a>
                );
              })}
            </div>
          </motion.div>

          {/* Live Automations */}
          <motion.div className="card" variants={item}>
            <div className="card-header">
              <div>
                <div className="card-title">Live Automations</div>
                <div className="card-subtitle">Currently running collectors and workflows</div>
              </div>
              <a href="/automation" className="btn btn-ghost btn-sm">
                View All <ArrowRight size={14} />
              </a>
            </div>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {[1, 2].map((n) => <SkeletonPulse key={n} height={40} />)}
              </div>
            ) : (
              <LiveAutomations automations={summary?.active_automations ?? []} />
            )}
          </motion.div>

          {/* Recent Investigations */}
          <motion.div className="card" variants={item}>
            <div className="card-header">
              <div>
                <div className="card-title">Recent Investigations</div>
                <div className="card-subtitle">AI-generated root cause analysis</div>
              </div>
              <a href="/investigations" className="btn btn-ghost btn-sm">
                View All <ArrowRight size={14} />
              </a>
            </div>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[1, 2, 3].map((n) => <SkeletonPulse key={n} height={60} />)}
              </div>
            ) : summary?.recent_investigations.length ? (
              <RecentInvestigations investigations={summary.recent_investigations} />
            ) : (
              <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px 0", fontSize: 13 }}>
                <CheckCircle2 size={32} style={{ margin: "0 auto 8px", opacity: 0.3 }} />
                No open investigations — warehouse looks healthy.
              </div>
            )}
          </motion.div>
        </div>

        {/* Right Column – Activity Feed */}
        <motion.div className="card" variants={item} style={{ height: "fit-content" }}>
          <div className="card-header">
            <div>
              <div className="card-title">Activity Feed</div>
              <div className="card-subtitle">Live system events</div>
            </div>
            {loading && <Loader2 size={14} style={{ animation: "spin 1s linear infinite", color: "var(--text-muted)" }} />}
          </div>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[1, 2, 3, 4, 5, 6].map((n) => <SkeletonPulse key={n} height={36} />)}
            </div>
          ) : (
            <ActivityFeed activity={summary?.recent_activity ?? []} />
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
