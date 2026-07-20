"use client";

import React from "react";
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
  Package,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  BarChart3,
  ArrowRight,
} from "lucide-react";

// ── Animation variants ───────────────────────────────────────────────────────
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

// ── Mock Data ────────────────────────────────────────────────────────────────
const stats = [
  {
    label: "Reports Today",
    value: "24",
    change: "+3",
    trend: "up" as const,
    icon: FileSpreadsheet,
    color: "red",
  },
  {
    label: "Active Investigations",
    value: "7",
    change: "-2",
    trend: "down" as const,
    icon: Microscope,
    color: "amber",
  },
  {
    label: "Automations Running",
    value: "3",
    change: "+1",
    trend: "up" as const,
    icon: Workflow,
    color: "blue",
  },
  {
    label: "Warehouse Health",
    value: "94%",
    change: "+2%",
    trend: "up" as const,
    icon: Activity,
    color: "green",
  },
];

const quickActions = [
  { label: "Download Reports", icon: Download, href: "/reports" },
  { label: "New Investigation", icon: Microscope, href: "/investigations" },
  { label: "Ask Atlas AI", icon: MessageSquare, href: "/chat" },
  { label: "Run Automation", icon: Workflow, href: "/automation" },
  { label: "Email Report", icon: Mail, href: "/reports" },
  { label: "View Analytics", icon: BarChart3, href: "/analytics" },
];

const recentActivity = [
  {
    type: "success" as const,
    text: "Cycle count report for Zone A downloaded successfully",
    time: "2 min ago",
  },
  {
    type: "info" as const,
    text: "Atlas AI analyzed 1,247 inventory records across 3 warehouses",
    time: "8 min ago",
  },
  {
    type: "warning" as const,
    text: "Location IQ1-2A17 shows variance of -12 units on SKU WH-4491",
    time: "15 min ago",
  },
  {
    type: "success" as const,
    text: "Automated picking report collection completed — 18 reports processed",
    time: "32 min ago",
  },
  {
    type: "error" as const,
    text: "The SAP export page took longer than expected. Atlas retried automatically.",
    time: "1 hr ago",
  },
  {
    type: "info" as const,
    text: "New skill installed: Receiving Audit v1.2.0",
    time: "2 hrs ago",
  },
];

const activeAutomations = [
  { name: "Cycle Count – Zone A", status: "running", progress: 72 },
  { name: "Picking Performance Daily", status: "running", progress: 45 },
  { name: "Inventory Snapshot Export", status: "queued", progress: 0 },
];

const recentInvestigations = [
  {
    title: "Shortage on SKU WH-4491 at IQ1-2A17",
    priority: "high",
    confidence: 87,
    status: "open",
  },
  {
    title: "Picking accuracy drop in Zone C",
    priority: "medium",
    confidence: 73,
    status: "open",
  },
  {
    title: "Unexpected container movement – CT-8812",
    priority: "low",
    confidence: 91,
    status: "resolved",
  },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function CommandCenter() {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      style={{ display: "flex", flexDirection: "column", gap: 24 }}
    >
      {/* ── Welcome Banner ────────────────────────────────────────── */}
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
          <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 4, fontWeight: 500 }}>
            Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>
            Command Center
          </div>
          <div style={{ fontSize: 14, opacity: 0.75, marginTop: 8, maxWidth: 480, lineHeight: 1.5 }}>
            Atlas processed 24 reports today. 3 automations are currently active.
            7 investigations require your attention.
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
        {/* Decorative circles */}
        <div style={{ position: "absolute", right: -40, top: -40, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
        <div style={{ position: "absolute", right: 60, bottom: -60, width: 150, height: 150, borderRadius: "50%", background: "rgba(255,255,255,0.03)" }} />
      </motion.div>

      {/* ── Stat Cards ────────────────────────────────────────────── */}
      <div className="stat-grid">
        {stats.map((stat, i) => {
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

      {/* ── Main Grid ─────────────────────────────────────────────── */}
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
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {activeAutomations.map((auto) => (
                <div key={auto.name} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        className={`status-dot ${auto.status === "running" ? "pulse" : ""}`}
                        style={{
                          color: auto.status === "running" ? "var(--success)" : "var(--text-muted)",
                        }}
                      />
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>
                        {auto.name}
                      </span>
                    </div>
                    <span
                      className={auto.status === "running" ? "badge-success" : "badge-info"}
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
                          style={{
                            height: "100%",
                            background: "var(--accent)",
                            borderRadius: "var(--r-full)",
                          }}
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
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {recentInvestigations.map((inv, i) => (
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
                          inv.priority === "high"
                            ? "var(--error-bg)"
                            : inv.priority === "medium"
                            ? "var(--warning-bg)"
                            : "var(--info-bg)",
                        color:
                          inv.priority === "high"
                            ? "var(--error)"
                            : inv.priority === "medium"
                            ? "var(--warning)"
                            : "var(--info)",
                      }}
                    >
                      {inv.priority === "high" ? (
                        <AlertTriangle size={18} />
                      ) : inv.status === "resolved" ? (
                        <CheckCircle2 size={18} />
                      ) : (
                        <Microscope size={18} />
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>
                        {inv.title}
                      </div>
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
          </motion.div>
        </div>

        {/* Right Column – Activity Feed */}
        <motion.div className="card" variants={item} style={{ height: "fit-content" }}>
          <div className="card-header">
            <div>
              <div className="card-title">Activity Feed</div>
              <div className="card-subtitle">Live system events</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {recentActivity.map((event, i) => (
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
        </motion.div>
      </div>
    </motion.div>
  );
}
