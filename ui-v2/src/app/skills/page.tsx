"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { motion } from "framer-motion";
import { Puzzle, Plus, CheckCircle2, Tag, RefreshCw, InboxIcon } from "lucide-react";
import { getPlugins, togglePlugin, type PluginRecord } from "@/lib/api";

// Category colour map
const CATEGORY_STYLE: Record<string, { bg: string; color: string }> = {
  Inventory:  { bg: "var(--accent-subtle)", color: "var(--accent)"   },
  Operations: { bg: "var(--info-bg)",        color: "var(--info)"     },
  Inbound:    { bg: "var(--success-bg)",     color: "var(--success)"  },
  Outbound:   { bg: "var(--warning-bg)",     color: "var(--warning)"  },
  Data:       { bg: "var(--bg-elevated)",    color: "var(--text-muted)" },
};

// ── Static fallback (used when DB has no plugins yet) ─────────────────────────
const FALLBACK_SKILLS: PluginRecord[] = [
  { id: 1, plugin_id: "cycle-count",       name: "Cycle Count",          version: "1.3.0", category: "Inventory",  is_enabled: true,  description: "Automated cycle count collection, normalization, and discrepancy analysis", installed_at: new Date().toISOString() },
  { id: 2, plugin_id: "picking-perf",      name: "Picking Performance",  version: "1.1.0", category: "Operations", is_enabled: true,  description: "Track pick rates, accuracy, and operator performance across zones", installed_at: new Date().toISOString() },
  { id: 3, plugin_id: "receiving-audit",   name: "Receiving Audit",      version: "1.2.0", category: "Inbound",    is_enabled: true,  description: "Dock-level receiving verification with PO matching", installed_at: new Date().toISOString() },
  { id: 4, plugin_id: "shipping-verify",   name: "Shipping Verification",version: "1.0.0", category: "Outbound",   is_enabled: false, description: "Outbound shipment validation with carrier tracking integration", installed_at: new Date().toISOString() },
  { id: 5, plugin_id: "excel-parser",      name: "Excel Report Parser",  version: "2.0.0", category: "Data",       is_enabled: true,  description: "Universal Excel/CSV parser with column auto-mapping", installed_at: new Date().toISOString() },
];

// ── Toggle component ──────────────────────────────────────────────────────────

function Toggle({ enabled, onChange, disabled }: { enabled: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <div
      onClick={disabled ? undefined : onChange}
      style={{
        width: 36, height: 20, borderRadius: 10,
        background: enabled ? "var(--accent)" : "var(--bg-elevated)",
        cursor: disabled ? "not-allowed" : "pointer",
        position: "relative", transition: "background 200ms",
        opacity: disabled ? 0.5 : 1,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 16, height: 16, borderRadius: "50%", background: "white",
          position: "absolute", top: 2, left: enabled ? 18 : 2,
          transition: "left 200ms", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }}
      />
    </div>
  );
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, animation: "pulse 1.4s ease-in-out infinite" }}>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ width: 40, height: 40, background: "var(--bg-elevated)", borderRadius: "var(--r-md)" }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ height: 14, width: "60%", background: "var(--bg-elevated)", borderRadius: 6 }} />
          <div style={{ height: 11, width: "40%", background: "var(--bg-elevated)", borderRadius: 6 }} />
        </div>
      </div>
      <div style={{ height: 12, width: "90%", background: "var(--bg-elevated)", borderRadius: 6 }} />
      <div style={{ height: 12, width: "70%", background: "var(--bg-elevated)", borderRadius: 6 }} />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SkillsPage() {
  const [skills, setSkills]   = useState<PluginRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const data = await getPlugins();
      if (!cancelled) {
        // Use live data if available, otherwise show fallback for demo
        setSkills(data && data.length > 0 ? data : FALLBACK_SKILLS);
        setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const handleToggle = async (skill: PluginRecord) => {
    if (toggling.has(skill.plugin_id)) return;
    setToggling((prev) => new Set(prev).add(skill.plugin_id));

    // Optimistic UI update
    setSkills((prev) =>
      prev?.map((s) =>
        s.plugin_id === skill.plugin_id ? { ...s, is_enabled: !s.is_enabled } : s
      ) ?? null
    );

    await togglePlugin(skill.plugin_id);
    setToggling((prev) => {
      const n = new Set(prev);
      n.delete(skill.plugin_id);
      return n;
    });
  };

  const displaySkills = skills ?? [];
  const enabledCount  = displaySkills.filter((s) => s.is_enabled).length;

  return (
    <AppShell>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800 }}>Installed Skills</h2>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
              Modular capabilities that extend Atlas intelligence
              {!loading && (
                <span style={{ marginLeft: 8, fontWeight: 600, color: "var(--text-primary)" }}>
                  · {enabledCount}/{displaySkills.length} active
                </span>
              )}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary btn-sm" style={{ gap: 5 }}>
              <RefreshCw size={13} /> Check Updates
            </button>
            <button className="btn btn-primary btn-sm" style={{ gap: 5 }}>
              <Plus size={14} /> Install Skill
            </button>
          </div>
        </div>

        {/* Summary strip */}
        {!loading && displaySkills.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="card"
            style={{
              marginBottom: 20, padding: "14px 20px",
              display: "flex", gap: 24, alignItems: "center",
              background: "linear-gradient(135deg, var(--accent-subtle) 0%, transparent 100%)",
              border: "1px solid var(--border-accent)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={16} style={{ color: "var(--success)" }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>{enabledCount} skills active</span>
            </div>
            <div style={{ height: 14, width: 1, background: "var(--border)" }} />
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {displaySkills.length - enabledCount} paused
            </div>
            <div style={{ height: 14, width: 1, background: "var(--border)" }} />
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {[...new Set(displaySkills.map((s) => s.category))].length} categories
            </div>
          </motion.div>
        )}

        {/* Cards grid */}
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {[1, 2, 3, 4, 5].map((n) => <SkeletonCard key={n} />)}
          </div>
        ) : displaySkills.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 64, color: "var(--text-muted)" }}>
            <InboxIcon size={44} style={{ margin: "0 auto 16px", opacity: 0.3 }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>No skills installed</div>
            <div style={{ fontSize: 13 }}>Install skills from the Marketplace to extend Atlas capabilities.</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {displaySkills.map((skill, i) => {
              const catStyle = CATEGORY_STYLE[skill.category] ?? CATEGORY_STYLE.Data;
              const isToggling = toggling.has(skill.plugin_id);

              return (
                <motion.div
                  key={skill.plugin_id}
                  className="card"
                  style={{ padding: 20, position: "relative", overflow: "hidden" }}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                >
                  {/* Active indicator stripe */}
                  <div
                    style={{
                      position: "absolute", top: 0, left: 0, right: 0, height: 2,
                      background: skill.is_enabled ? "var(--accent)" : "var(--text-disabled)",
                      opacity: skill.is_enabled ? 1 : 0.3,
                      transition: "all 300ms",
                    }}
                  />

                  {/* Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <div
                        style={{
                          width: 40, height: 40, borderRadius: "var(--r-md)",
                          background: skill.is_enabled ? "var(--accent-subtle)" : "var(--bg-elevated)",
                          color: skill.is_enabled ? "var(--accent)" : "var(--text-muted)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "all 300ms",
                        }}
                      >
                        <Puzzle size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: skill.is_enabled ? "var(--text-primary)" : "var(--text-muted)" }}>
                          {skill.name}
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 1 }}>
                          v{skill.version}
                        </div>
                      </div>
                    </div>
                    <Toggle
                      enabled={skill.is_enabled}
                      onChange={() => handleToggle(skill)}
                      disabled={isToggling}
                    />
                  </div>

                  {/* Description */}
                  <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55, marginBottom: 14 }}>
                    {skill.description}
                  </p>

                  {/* Category badge */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 600,
                        padding: "2px 8px", borderRadius: "var(--r-full)",
                        background: catStyle.bg, color: catStyle.color,
                        border: "1px solid var(--border)",
                      }}
                    >
                      <Tag size={9} /> {skill.category}
                    </span>
                    <span style={{ fontSize: 10.5, color: skill.is_enabled ? "var(--success)" : "var(--text-disabled)", fontWeight: 600 }}>
                      {isToggling ? "Updating…" : skill.is_enabled ? "● Active" : "○ Paused"}
                    </span>
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
