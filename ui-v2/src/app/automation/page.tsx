"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { motion } from "framer-motion";
import {
  Workflow,
  Plus,
  Play,
  Clock,
  Tag,
  Layers,
  CheckCircle2,
  AlertTriangle,
  FileOutput,
} from "lucide-react";
import { getWorkflows, runWorkflow, type WorkflowItem } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";

function SkeletonCard() {
  return (
    <div
      className="card"
      style={{
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        animation: "pulse 1.4s ease-in-out infinite",
      }}
    >
      <div style={{ height: 36, width: 36, background: "var(--bg-elevated)", borderRadius: "var(--r-sm)" }} />
      <div style={{ height: 16, width: "70%", background: "var(--bg-elevated)", borderRadius: 6 }} />
      <div style={{ height: 12, width: "50%", background: "var(--bg-elevated)", borderRadius: 6 }} />
      <div style={{ height: 28, width: 80, background: "var(--bg-elevated)", borderRadius: 6, marginTop: 8 }} />
    </div>
  );
}

const formatBadgeMap: Record<string, string> = {
  excel: "Excel",
  pdf: "PDF",
  json: "JSON",
  csv: "CSV",
  word: "Word",
};

export default function AutomationPage() {
  const [workflows, setWorkflows] = useState<WorkflowItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const data = await getWorkflows();
      if (!cancelled) {
        setWorkflows(data);
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const handleRun = async (wf: WorkflowItem) => {
    if (running.has(wf.id)) return;
    setRunning((prev) => new Set(prev).add(wf.id));
    try {
      const result = await runWorkflow(wf.id, {});
      if (result?.execution_id) {
        // Brief visual feedback
        setTimeout(() => {
          setRunning((prev) => {
            const next = new Set(prev);
            next.delete(wf.id);
            return next;
          });
        }, 3000);
      } else {
        setRunning((prev) => { const n = new Set(prev); n.delete(wf.id); return n; });
      }
    } catch {
      setRunning((prev) => { const n = new Set(prev); n.delete(wf.id); return n; });
    }
  };

  const displayWorkflows = workflows ?? [];

  return (
    <AppShell>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800 }}>Automation Studio</h2>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
              Workflow library — no code required
              {!loading && (
                <span style={{ marginLeft: 8, fontWeight: 600, color: "var(--text-primary)" }}>
                  · {displayWorkflows.length} workflow{displayWorkflows.length !== 1 ? "s" : ""}
                </span>
              )}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary btn-sm">
              <Workflow size={14} /> Teach Atlas
            </button>
            <button className="btn btn-primary btn-sm">
              <Plus size={14} /> New Automation
            </button>
          </div>
        </div>

        {/* Cards */}
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
            {[1, 2, 3, 4].map((n) => <SkeletonCard key={n} />)}
          </div>
        ) : displayWorkflows.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 64, color: "var(--text-muted)" }}>
            <Workflow size={44} style={{ margin: "0 auto 16px", opacity: 0.3 }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
              No workflows yet
            </div>
            <div style={{ fontSize: 13 }}>
              Create your first automation or let Atlas learn by watching you work.
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
            {displayWorkflows.map((wf, i) => {
              const isRunning = running.has(wf.id);
              const lastRunText = wf.last_run_at
                ? formatDistanceToNow(new Date(wf.last_run_at), { addSuffix: true })
                : "Never run";

              return (
                <motion.div
                  key={wf.id}
                  className="card"
                  style={{ cursor: "pointer", padding: 20, position: "relative", overflow: "hidden" }}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  whileHover={{ y: -2 }}
                >
                  {/* Top accent line */}
                  <div
                    style={{
                      position: "absolute", top: 0, left: 0, right: 0, height: 2,
                      background: isRunning ? "var(--success)" : "var(--accent)",
                      opacity: isRunning ? 1 : 0.6,
                      transition: "all 300ms",
                    }}
                  />

                  {/* Title row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 38, height: 38, borderRadius: "var(--r-sm)",
                          background: isRunning ? "var(--success-bg)" : "var(--accent-subtle)",
                          color: isRunning ? "var(--success)" : "var(--accent)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "all 300ms",
                        }}
                      >
                        {isRunning ? <CheckCircle2 size={18} /> : <Workflow size={18} />}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>{wf.name}</div>
                        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
                          v{wf.version}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  {wf.description && (
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.5 }}>
                      {wf.description}
                    </div>
                  )}

                  {/* Meta chips */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 600, padding: "2px 7px", borderRadius: "var(--r-full)", background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                      <Layers size={10} /> {wf.steps_count} steps
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 600, padding: "2px 7px", borderRadius: "var(--r-full)", background: "var(--info-bg)", color: "var(--info)", border: "1px solid rgba(37,99,235,0.2)" }}>
                      <FileOutput size={10} /> {formatBadgeMap[wf.output_format] ?? wf.output_format}
                    </span>
                    {wf.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 600, padding: "2px 7px", borderRadius: "var(--r-full)", background: "var(--accent-subtle)", color: "var(--accent)", border: "1px solid var(--border-accent)" }}
                      >
                        <Tag size={9} /> {tag}
                      </span>
                    ))}
                  </div>

                  {/* Footer row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11.5, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                      <Clock size={11} /> {lastRunText}
                      {wf.run_count > 0 && ` · ${wf.run_count} runs`}
                    </span>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{
                        padding: "5px 12px", fontSize: 12,
                        background: isRunning ? "var(--success)" : "var(--accent)",
                        gap: 5,
                      }}
                      onClick={(e) => { e.stopPropagation(); handleRun(wf); }}
                      disabled={isRunning}
                    >
                      <Play size={11} fill="currentColor" />
                      {isRunning ? "Running…" : "Run"}
                    </button>
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
