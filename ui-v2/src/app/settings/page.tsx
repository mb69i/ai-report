"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings as SettingsIcon,
  Shield,
  Palette,
  Bot,
  Database,
  Bell,
  Key,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  AlertTriangle,
  Server,
  Cpu,
  HardDrive,
} from "lucide-react";
import {
  getSettings,
  getSystemInfo,
  saveApiKeys,
  testConnection,
  updateSetting,
  type AtlasSettings,
  type SystemInfo,
  type ConnectionTestResult,
} from "@/lib/api";

// ── Nav sections ──────────────────────────────────────────────────────────────

const sections = [
  { id: "general",       label: "General",        icon: SettingsIcon },
  { id: "ai",            label: "AI Engine",       icon: Bot          },
  { id: "security",      label: "Security",        icon: Shield       },
  { id: "appearance",    label: "Appearance",      icon: Palette      },
  { id: "database",      label: "Database",        icon: Database     },
  { id: "notifications", label: "Notifications",   icon: Bell         },
  { id: "api",           label: "API Keys",        icon: Key          },
];

// ── Toggle switch component ───────────────────────────────────────────────────

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!enabled)}
      style={{
        width: 36, height: 20, borderRadius: 10,
        background: enabled ? "var(--accent)" : "var(--bg-elevated)",
        cursor: "pointer", position: "relative", transition: "background 200ms", flexShrink: 0,
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

// ── Label + field wrapper ─────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
        {label}
      </label>
      {children}
      {hint && <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 5 }}>{hint}</div>}
    </div>
  );
}

// ── Connection test badge ─────────────────────────────────────────────────────

function TestBadge({ result }: { result: ConnectionTestResult | null | "loading" }) {
  if (!result) return null;
  if (result === "loading") return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-muted)" }}>
      <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Testing…
    </span>
  );
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600,
        padding: "3px 10px", borderRadius: "var(--r-full)",
        background: result.ok ? "var(--success-bg)" : "var(--error-bg)",
        color: result.ok ? "var(--success)" : "var(--error)",
        border: `1px solid ${result.ok ? "rgba(22,163,74,0.2)" : "rgba(220,38,38,0.2)"}`,
      }}
    >
      {result.ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
      {result.message}
    </span>
  );
}

// ── AI Section ────────────────────────────────────────────────────────────────

function AiSection({ settings }: { settings: AtlasSettings | null }) {
  const [provider, setProvider] = useState("gemini");
  const [geminiKey, setGeminiKey]   = useState("");
  const [openaiKey, setOpenaiKey]   = useState("");
  const [showGemini, setShowGemini] = useState(false);
  const [showOpenAI, setShowOpenAI] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [geminiTest, setGeminiTest] = useState<ConnectionTestResult | null | "loading">(null);
  const [openaiTest, setOpenaiTest] = useState<ConnectionTestResult | null | "loading">(null);

  const handleSaveKeys = async () => {
    setSaving(true);
    setSaved(false);
    await saveApiKeys({
      gemini_api_key: geminiKey || undefined,
      openai_api_key: openaiKey || undefined,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleTestGemini = async () => {
    setGeminiTest("loading");
    const result = await testConnection("gemini", geminiKey || undefined);
    setGeminiTest(result);
  };

  const handleTestOpenAI = async () => {
    setOpenaiTest("loading");
    const result = await testConnection("openai", openaiKey || undefined);
    setOpenaiTest(result);
  };

  const keysStatus = settings?.keys_status;

  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>AI Engine Configuration</h3>
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 24 }}>
        Configure which AI provider Atlas uses for chat, investigations, and automation.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <Field label="Primary AI Provider">
          <select className="input" value={provider} onChange={(e) => setProvider(e.target.value)} style={{ maxWidth: 340 }}>
            <option value="gemini">Google Gemini</option>
            <option value="openai">OpenAI (GPT-4)</option>
            <option value="ollama">Local Ollama (offline)</option>
          </select>
        </Field>

        {/* Gemini Key */}
        <div style={{ padding: 18, borderRadius: "var(--r-lg)", border: "1px solid var(--border)", background: "var(--bg-elevated)", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Google Gemini API Key</span>
            <span style={{
              fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: "var(--r-full)",
              background: keysStatus?.gemini_configured ? "var(--success-bg)" : "var(--warning-bg)",
              color: keysStatus?.gemini_configured ? "var(--success)" : "var(--warning)",
            }}>
              {keysStatus?.gemini_configured ? "Configured" : "Not set"}
            </span>
          </div>
          <div style={{ position: "relative" }}>
            <input
              className="input"
              type={showGemini ? "text" : "password"}
              placeholder={keysStatus?.gemini_configured ? "••••••••••••  (leave blank to keep existing)" : "AIza…"}
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              style={{ paddingRight: 38 }}
            />
            <button
              onClick={() => setShowGemini((v) => !v)}
              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
            >
              {showGemini ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="btn btn-secondary btn-sm" onClick={handleTestGemini} disabled={geminiTest === "loading"}>
              <RefreshCw size={12} /> Test Connection
            </button>
            <TestBadge result={geminiTest} />
          </div>
          {geminiTest && geminiTest !== "loading" && geminiTest.detail && (
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", background: "var(--bg-card)", borderRadius: "var(--r-sm)", padding: "8px 12px" }}>
              {geminiTest.detail}
            </div>
          )}
        </div>

        {/* OpenAI Key */}
        <div style={{ padding: 18, borderRadius: "var(--r-lg)", border: "1px solid var(--border)", background: "var(--bg-elevated)", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>OpenAI API Key</span>
            <span style={{
              fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: "var(--r-full)",
              background: keysStatus?.openai_configured ? "var(--success-bg)" : "var(--warning-bg)",
              color: keysStatus?.openai_configured ? "var(--success)" : "var(--warning)",
            }}>
              {keysStatus?.openai_configured ? "Configured" : "Not set"}
            </span>
          </div>
          <div style={{ position: "relative" }}>
            <input
              className="input"
              type={showOpenAI ? "text" : "password"}
              placeholder={keysStatus?.openai_configured ? "••••••••••••  (leave blank to keep existing)" : "sk-…"}
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              style={{ paddingRight: 38 }}
            />
            <button
              onClick={() => setShowOpenAI((v) => !v)}
              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
            >
              {showOpenAI ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="btn btn-secondary btn-sm" onClick={handleTestOpenAI} disabled={openaiTest === "loading"}>
              <RefreshCw size={12} /> Test Connection
            </button>
            <TestBadge result={openaiTest} />
          </div>
        </div>

        <div>
          <button
            className="btn btn-primary"
            onClick={handleSaveKeys}
            disabled={saving || (!geminiKey && !openaiKey)}
            style={{ gap: 7 }}
          >
            {saving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={14} />}
            {saved ? "Saved!" : saving ? "Saving…" : "Save API Keys"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Database section ──────────────────────────────────────────────────────────

function DatabaseSection({ sysInfo }: { sysInfo: SystemInfo | null }) {
  if (!sysInfo) return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
      <Loader2 size={28} style={{ margin: "0 auto 12px", animation: "spin 1s linear infinite" }} />
      Loading system information…
    </div>
  );

  const items = [
    { icon: Server,    label: "Atlas Version",     value: `v${sysInfo.app_version}` },
    { icon: Cpu,       label: "Python Version",    value: sysInfo.python_version.split(" ")[0] },
    { icon: HardDrive, label: "Platform",          value: `${sysInfo.platform}` },
    { icon: Database,  label: "Database",          value: sysInfo.database === "postgresql" ? "PostgreSQL" : "SQLite (dev)" },
    { icon: Bot,       label: "Gemini AI",         value: sysInfo.gemini_configured ? "Configured" : "Not configured" },
    { icon: Bot,       label: "Claude AI",         value: sysInfo.claude_configured ? "Configured" : "Not configured" },
    { icon: Server,    label: "Ollama URL",        value: sysInfo.ollama_url },
    { icon: Shield,    label: "Offline Mode",      value: sysInfo.offline_mode ? "Enabled" : "Disabled" },
  ];

  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>System Information</h3>
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 24 }}>
        Live snapshot of Atlas server configuration.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 0, borderRadius: "var(--r-lg)", border: "1px solid var(--border)", overflow: "hidden" }}>
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "13px 18px",
                borderBottom: i < items.length - 1 ? "1px solid var(--border)" : "none",
                background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-elevated)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--text-muted)" }}>
                <Icon size={14} />
                {item.label}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                {item.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState("general");
  const [atlasSettings, setAtlasSettings] = useState<AtlasSettings | null>(null);
  const [sysInfo, setSysInfo]             = useState<SystemInfo | null>(null);

  useEffect(() => {
    getSettings().then(setAtlasSettings);
    getSystemInfo().then(setSysInfo);
  }, []);

  return (
    <AppShell>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>Settings</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
            Configure Atlas to work exactly how you need
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 20 }}>
          {/* Nav */}
          <div className="card" style={{ padding: 8, height: "fit-content" }}>
            {sections.map((s) => {
              const Icon = s.icon;
              const isActive = activeSection === s.id;
              return (
                <button
                  key={s.id}
                  className="nav-item"
                  onClick={() => setActiveSection(s.id)}
                  style={{
                    color: isActive ? "var(--accent)" : "var(--text-secondary)",
                    background: isActive ? "var(--accent-subtle)" : "transparent",
                    width: "100%",
                    textAlign: "left",
                  }}
                >
                  <Icon size={15} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 13.5 }}>{s.label}</span>
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="card">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18 }}
              >
                {activeSection === "general" && (
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>General Settings</h3>
                    <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 24 }}>
                      Basic configuration for your Atlas instance.
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                      <Field label="Instance Name">
                        <input className="input" defaultValue="Atlas Warehouse HQ" style={{ maxWidth: 400 }} />
                      </Field>
                      <Field label="Company Name">
                        <input className="input" placeholder="Your company name" style={{ maxWidth: 400 }} />
                      </Field>
                      <Field label="Debug Mode" hint="Enables verbose logging in the server console">
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Toggle enabled={false} onChange={() => {}} />
                          <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Enable debug logging</span>
                        </div>
                      </Field>
                    </div>
                    <div style={{ marginTop: 24 }}>
                      <button className="btn btn-primary" style={{ gap: 7 }}><Save size={14} /> Save Changes</button>
                    </div>
                  </div>
                )}

                {activeSection === "ai" && <AiSection settings={atlasSettings} />}

                {activeSection === "database" && <DatabaseSection sysInfo={sysInfo} />}

                {activeSection === "api" && (
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>API Keys</h3>
                    <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 24 }}>
                      Manage external service integrations. Keys are stored securely in .env and never exposed.
                    </p>
                    <div
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px",
                        borderRadius: "var(--r-md)", background: "var(--warning-bg)",
                        border: "1px solid rgba(217,119,6,0.2)", marginBottom: 24,
                      }}
                    >
                      <AlertTriangle size={16} style={{ color: "var(--warning)", marginTop: 2, flexShrink: 0 }} />
                      <div style={{ fontSize: 13, color: "var(--warning)" }}>
                        API keys are write-only from this UI. They are stored in your server's .env file and never returned to the browser. Configure them in the <strong>AI Engine</strong> section.
                      </div>
                    </div>
                    <button className="btn btn-primary" onClick={() => setActiveSection("ai")}>
                      <Key size={14} /> Go to AI Engine Settings
                    </button>
                  </div>
                )}

                {!["general", "ai", "database", "api"].includes(activeSection) && (
                  <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
                    <SettingsIcon size={40} style={{ margin: "0 auto 12px", opacity: 0.25 }} />
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                      {sections.find((s) => s.id === activeSection)?.label} Settings
                    </div>
                    <div style={{ fontSize: 13 }}>This section is being configured.</div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </AppShell>
  );
}
