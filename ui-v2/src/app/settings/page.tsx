"use client";

import AppShell from "@/components/AppShell";
import { motion } from "framer-motion";
import { Settings as SettingsIcon, Shield, Palette, Bot, Database, Globe, Bell, Key } from "lucide-react";
import { useState } from "react";

const sections = [
  { id: "general", label: "General", icon: SettingsIcon },
  { id: "ai", label: "AI Engine", icon: Bot },
  { id: "security", label: "Security", icon: Shield },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "database", label: "Database", icon: Database },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "api", label: "API Keys", icon: Key },
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState("general");

  return (
    <AppShell>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>Settings</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>Configure Atlas to work exactly how you need</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 20 }}>
          {/* Settings Nav */}
          <div className="card" style={{ padding: 8, height: "fit-content" }}>
            {sections.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  className={`nav-item ${activeSection === s.id ? "active" : ""}`}
                  onClick={() => setActiveSection(s.id)}
                  style={{ color: activeSection === s.id ? "var(--accent)" : "var(--text-secondary)", background: activeSection === s.id ? "var(--accent-subtle)" : "transparent" }}
                >
                  <Icon size={16} />
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>

          {/* Settings Content */}
          <div className="card">
            {activeSection === "general" && (
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>General Settings</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div>
                    <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Instance Name</label>
                    <input className="input" defaultValue="Atlas Warehouse HQ" style={{ maxWidth: 400 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Company Name</label>
                    <input className="input" placeholder="Your company name" style={{ maxWidth: 400 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Debug Mode</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 20, borderRadius: 10, background: "var(--bg-elevated)", cursor: "pointer", position: "relative" }}>
                        <div style={{ width: 16, height: 16, borderRadius: "50%", background: "white", position: "absolute", top: 2, left: 2, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                      </div>
                      <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Enable debug logging</span>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 24 }}>
                  <button className="btn btn-primary">Save Changes</button>
                </div>
              </div>
            )}
            {activeSection === "ai" && (
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>AI Engine Configuration</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div>
                    <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Primary AI Provider</label>
                    <select className="input" defaultValue="gemini" style={{ maxWidth: 400 }}>
                      <option value="gemini">Google Gemini</option>
                      <option value="claude">Anthropic Claude</option>
                      <option value="ollama">Local Gemma (Ollama)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Offline Mode</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 20, borderRadius: 10, background: "var(--bg-elevated)", cursor: "pointer", position: "relative" }}>
                        <div style={{ width: 16, height: 16, borderRadius: "50%", background: "white", position: "absolute", top: 2, left: 2, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                      </div>
                      <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Route all AI through local Ollama</span>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Data Privacy</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 20, borderRadius: 10, background: "var(--accent)", cursor: "pointer", position: "relative" }}>
                        <div style={{ width: 16, height: 16, borderRadius: "50%", background: "white", position: "absolute", top: 2, left: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                      </div>
                      <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Never send raw data to external AI</span>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 24 }}>
                  <button className="btn btn-primary">Save Changes</button>
                </div>
              </div>
            )}
            {activeSection !== "general" && activeSection !== "ai" && (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
                <SettingsIcon size={40} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
                <div style={{ fontSize: 14 }}>{sections.find(s => s.id === activeSection)?.label} settings</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Configuration panel for this section</div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AppShell>
  );
}
