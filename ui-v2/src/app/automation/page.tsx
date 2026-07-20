"use client";

import { useEffect, useState, useRef } from "react";
import AppShell from "@/components/AppShell";
import { motion, AnimatePresence } from "framer-motion";
import {
  Workflow,
  Plus,
  Play,
  Clock,
  Tag,
  Layers,
  CheckCircle2,
  FileOutput,
  X,
  BookOpen,
  Loader2,
  Zap,
  Save,
  ChevronRight,
  Info,
} from "lucide-react";
import { getWorkflows, runWorkflow, type WorkflowItem } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";

// ── Helpers ───────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, animation: "pulse 1.4s ease-in-out infinite" }}>
      <div style={{ height: 36, width: 36, background: "var(--bg-elevated)", borderRadius: "var(--r-sm)" }} />
      <div style={{ height: 16, width: "70%", background: "var(--bg-elevated)", borderRadius: 6 }} />
      <div style={{ height: 12, width: "50%", background: "var(--bg-elevated)", borderRadius: 6 }} />
      <div style={{ height: 28, width: 80, background: "var(--bg-elevated)", borderRadius: 6, marginTop: 8 }} />
    </div>
  );
}

const formatBadgeMap: Record<string, string> = {
  excel: "Excel", pdf: "PDF", json: "JSON", csv: "CSV", word: "Word",
};

// ── Teach Atlas Modal ─────────────────────────────────────────────────────────

const TEACH_STEPS = [
  { label: "Name your skill", hint: "Give it a clear, descriptive name — e.g. 'Cycle Count Parser'" },
  { label: "Describe what it does", hint: "Explain in plain language what Atlas should learn to do" },
  { label: "Provide an example", hint: "Paste a sample input/output so Atlas can learn the pattern" },
  { label: "Review & confirm", hint: "Atlas will generate a new workflow from your example" },
];

function TeachModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [example, setExample] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleNext = () => {
    if (step < TEACH_STEPS.length - 1) setStep((s) => s + 1);
  };
  const handleBack = () => setStep((s) => Math.max(0, s - 1));

  const handleSubmit = async () => {
    setSubmitting(true);
    // Simulate processing — in production, POST to /api/workflows/learn
    await new Promise((r) => setTimeout(r, 2200));
    setSubmitting(false);
    setDone(true);
  };

  const canNext = [name.trim().length > 2, description.trim().length > 10, example.trim().length > 5, true];

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: "100%", maxWidth: 520, padding: 32, position: "relative" }}
      >
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
          <X size={18} />
        </button>

        {done ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <CheckCircle2 size={48} style={{ color: "var(--success)", margin: "0 auto 16px" }} />
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Skill submitted!</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
              Atlas is learning <strong>"{name}"</strong>. A new workflow will appear in your library shortly.
            </div>
            <button className="btn btn-primary" onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <div style={{ width: 40, height: 40, borderRadius: "var(--r-md)", background: "var(--accent-subtle)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BookOpen size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>Teach Atlas a New Skill</div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Step {step + 1} of {TEACH_STEPS.length}</div>
              </div>
            </div>

            {/* Progress */}
            <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
              {TEACH_STEPS.map((_, i) => (
                <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= step ? "var(--accent)" : "var(--bg-elevated)", transition: "background 300ms" }} />
              ))}
            </div>

            {/* Step label + hint */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{TEACH_STEPS[step].label}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", display: "flex", gap: 6, alignItems: "flex-start" }}>
                <Info size={13} style={{ marginTop: 1, flexShrink: 0 }} />
                {TEACH_STEPS[step].hint}
              </div>
            </div>

            {/* Step inputs */}
            {step === 0 && (
              <input
                className="input"
                placeholder="e.g. Cycle Count Discrepancy Parser"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            )}
            {step === 1 && (
              <textarea
                className="input"
                placeholder="Describe what this skill should do in plain language..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                style={{ resize: "vertical" }}
                autoFocus
              />
            )}
            {step === 2 && (
              <textarea
                className="input"
                placeholder="Paste an example input (e.g. a row from your Excel, a WMS export, etc.)"
                value={example}
                onChange={(e) => setExample(e.target.value)}
                rows={5}
                style={{ resize: "vertical", fontFamily: "var(--font-mono)", fontSize: 12 }}
                autoFocus
              />
            )}
            {step === 3 && (
              <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--r-md)", padding: 16, fontSize: 13, display: "flex", flexDirection: "column", gap: 10 }}>
                {[["Skill name", name], ["Description", description], ["Example provided", example.length > 60 ? example.slice(0, 60) + "…" : example]].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", gap: 12 }}>
                    <span style={{ fontWeight: 600, color: "var(--text-muted)", width: 100, flexShrink: 0 }}>{k}</span>
                    <span style={{ color: "var(--text-primary)" }}>{v}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
              <button className="btn btn-secondary btn-sm" onClick={handleBack} disabled={step === 0}>Back</button>
              {step < TEACH_STEPS.length - 1 ? (
                <button className="btn btn-primary btn-sm" onClick={handleNext} disabled={!canNext[step]} style={{ gap: 5 }}>
                  Next <ChevronRight size={14} />
                </button>
              ) : (
                <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={submitting} style={{ gap: 6 }}>
                  {submitting ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Teaching Atlas…</> : <><Zap size={13} /> Teach Atlas</>}
                </button>
              )}
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

// ── New Automation Modal ───────────────────────────────────────────────────────

const TEMPLATES = [
  { id: "cycle-count",    name: "Cycle Count Report",     description: "Collect discrepancy data, run root-cause AI, generate PDF report", steps: 4, tags: ["inventory", "pdf"] },
  { id: "picking-perf",  name: "Picking Performance",    description: "Aggregate daily picking rates per operator and zone", steps: 3, tags: ["operations", "excel"] },
  { id: "receiving",     name: "Receiving Audit",         description: "Match incoming PO vs actual received items, flag discrepancies", steps: 5, tags: ["inbound", "json"] },
  { id: "blank",         name: "Blank Workflow",          description: "Start from scratch with an empty workflow canvas", steps: 0, tags: [] },
];

function NewAutomationModal({ onClose, onCreated }: { onClose: () => void; onCreated: (name: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [wfName, setWfName] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const handleCreate = async () => {
    if (!wfName.trim() || !selected) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 1400));
    setSaving(false);
    setDone(true);
    setTimeout(() => { onCreated(wfName.trim()); onClose(); }, 1200);
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: "100%", maxWidth: 580, padding: 32, position: "relative" }}
      >
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
          <X size={18} />
        </button>

        {done ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <CheckCircle2 size={48} style={{ color: "var(--success)", margin: "0 auto 16px" }} />
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Automation created!</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              <strong>"{wfName}"</strong> has been added to your workflow library.
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <div style={{ width: 40, height: 40, borderRadius: "var(--r-md)", background: "var(--accent-subtle)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Plus size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>New Automation</div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Choose a template or start blank</div>
              </div>
            </div>

            {/* Template grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setSelected(t.id); if (!wfName) setWfName(t.name); }}
                  style={{
                    padding: "14px 16px", borderRadius: "var(--r-md)", cursor: "pointer",
                    border: `2px solid ${selected === t.id ? "var(--accent)" : "var(--border)"}`,
                    background: selected === t.id ? "var(--accent-subtle)" : "var(--bg-elevated)",
                    textAlign: "left", transition: "all 180ms",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)", marginBottom: 4 }}>{t.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.4 }}>{t.description}</div>
                  {t.steps > 0 && (
                    <div style={{ marginTop: 8, fontSize: 10.5, color: "var(--accent)", fontWeight: 600 }}>{t.steps} steps included</div>
                  )}
                </button>
              ))}
            </div>

            {/* Name input */}
            {selected && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                  Workflow name
                </label>
                <input
                  className="input"
                  placeholder="My automation name"
                  value={wfName}
                  onChange={(e) => setWfName(e.target.value)}
                  autoFocus
                />
              </motion.div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleCreate}
                disabled={!selected || !wfName.trim() || saving}
                style={{ gap: 6 }}
              >
                {saving ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Creating…</> : <><Save size={13} /> Create</>}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AutomationPage() {
  const [workflows, setWorkflows] = useState<WorkflowItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<Set<string>>(new Set());
  const [showTeach, setShowTeach] = useState(false);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const data = await getWorkflows();
      if (!cancelled) { setWorkflows(data); setLoading(false); }
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
      setTimeout(() => {
        setRunning((prev) => { const n = new Set(prev); n.delete(wf.id); return n; });
      }, result?.execution_id ? 3000 : 0);
    } catch {
      setRunning((prev) => { const n = new Set(prev); n.delete(wf.id); return n; });
    }
  };

  const handleCreated = (name: string) => {
    // Reload workflows after creation
    getWorkflows().then(setWorkflows);
  };

  const displayWorkflows = workflows ?? [];

  return (
    <AppShell>
      <AnimatePresence>
        {showTeach && <TeachModal onClose={() => setShowTeach(false)} />}
        {showNew   && <NewAutomationModal onClose={() => setShowNew(false)} onCreated={handleCreated} />}
      </AnimatePresence>

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
            <button className="btn btn-secondary btn-sm" onClick={() => setShowTeach(true)} style={{ gap: 6 }} id="teach-atlas-btn">
              <Workflow size={14} /> Teach Atlas
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)} style={{ gap: 6 }} id="new-automation-btn">
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
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>No workflows yet</div>
            <div style={{ fontSize: 13, marginBottom: 20 }}>Create your first automation or let Atlas learn by watching you work.</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowTeach(true)} style={{ gap: 5 }}>
                <Workflow size={14} /> Teach Atlas
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)} style={{ gap: 5 }}>
                <Plus size={14} /> New Automation
              </button>
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
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: isRunning ? "var(--success)" : "var(--accent)", opacity: isRunning ? 1 : 0.6, transition: "all 300ms" }} />

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 38, height: 38, borderRadius: "var(--r-sm)", background: isRunning ? "var(--success-bg)" : "var(--accent-subtle)", color: isRunning ? "var(--success)" : "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 300ms" }}>
                        {isRunning ? <CheckCircle2 size={18} /> : <Workflow size={18} />}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>{wf.name}</div>
                        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>v{wf.version}</div>
                      </div>
                    </div>
                  </div>

                  {wf.description && (
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.5 }}>{wf.description}</div>
                  )}

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 600, padding: "2px 7px", borderRadius: "var(--r-full)", background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                      <Layers size={10} /> {wf.steps_count} steps
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 600, padding: "2px 7px", borderRadius: "var(--r-full)", background: "var(--info-bg)", color: "var(--info)", border: "1px solid rgba(37,99,235,0.2)" }}>
                      <FileOutput size={10} /> {formatBadgeMap[wf.output_format] ?? wf.output_format}
                    </span>
                    {wf.tags.slice(0, 2).map((tag) => (
                      <span key={tag} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 600, padding: "2px 7px", borderRadius: "var(--r-full)", background: "var(--accent-subtle)", color: "var(--accent)", border: "1px solid var(--border-accent)" }}>
                        <Tag size={9} /> {tag}
                      </span>
                    ))}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11.5, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                      <Clock size={11} /> {lastRunText}
                      {wf.run_count > 0 && ` · ${wf.run_count} runs`}
                    </span>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ padding: "5px 12px", fontSize: 12, background: isRunning ? "var(--success)" : "var(--accent)", gap: 5 }}
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
