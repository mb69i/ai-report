"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  Search,
  FileSpreadsheet,
  Microscope,
  BarChart3,
  Workflow,
  Settings,
  Puzzle,
  ScrollText,
  ShieldCheck,
  Zap,
  Store,
} from "lucide-react";

const navSections = [
  {
    label: "Command",
    items: [
      { label: "Command Center", path: "/", icon: LayoutDashboard },
      { label: "AI Assistant", path: "/chat", icon: MessageSquare },
      { label: "Search", path: "/search", icon: Search },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Reports", path: "/reports", icon: FileSpreadsheet },
      { label: "Investigations", path: "/investigations", icon: Microscope },
      { label: "Analytics", path: "/analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Automation",
    items: [
      { label: "Automation Studio", path: "/automation", icon: Workflow },
      { label: "Skills", path: "/skills", icon: Puzzle },
      { label: "Marketplace", path: "/marketplace", icon: Store },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Logs", path: "/logs", icon: ScrollText },
      { label: "Settings", path: "/settings", icon: Settings },
    ],
  },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [backendStatus, setBackendStatus] = useState<
    "connected" | "connecting" | "disconnected"
  >("connecting");
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("http://localhost:7411/health");
        if (res.ok) setBackendStatus("connected");
        else setBackendStatus("disconnected");
      } catch {
        setBackendStatus("disconnected");
      }
    };
    check();
    const interval = setInterval(check, 8000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const currentPageLabel =
    navSections.flatMap((s) => s.items).find((i) => i.path === pathname)
      ?.label || "Atlas";

  return (
    <div className="app-shell">
      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <Zap size={18} color="white" />
          </div>
          <span className="sidebar-brand-text">Atlas</span>
        </div>

        <nav className="sidebar-nav">
          {navSections.map((section) => (
            <React.Fragment key={section.label}>
              <div className="nav-section">{section.label}</div>
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={`nav-item ${active ? "active" : ""}`}
                  >
                    <Icon className="nav-icon" size={18} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </React.Fragment>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              fontSize: 12,
              color: "var(--text-sidebar)",
            }}
          >
            <ShieldCheck
              size={14}
              style={{
                color:
                  backendStatus === "connected"
                    ? "var(--success)"
                    : "var(--error)",
              }}
            />
            <span>
              {backendStatus === "connected"
                ? "Engine Active"
                : backendStatus === "connecting"
                ? "Connecting..."
                : "Offline"}
            </span>
          </div>
          <div
            style={{
              padding: "4px 12px",
              fontSize: 10,
              color: "rgba(255,255,255,0.2)",
              fontFamily: "var(--font-mono)",
            }}
          >
            v2.0.0
          </div>
        </div>
      </aside>

      {/* ── Main Area ────────────────────────────────────────────── */}
      <div className="main-area">
        <header className="header">
          <h1 className="header-title">{currentPageLabel}</h1>

          <button
            className="header-search"
            onClick={() => setSearchOpen(true)}
            id="global-search-trigger"
          >
            <Search size={15} />
            <span>Search anything...</span>
            <kbd>⌘K</kbd>
          </button>

          <div
            className={`badge-${backendStatus === "connected" ? "success" : "error"}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "3px 10px",
              borderRadius: "var(--r-full)",
              fontSize: 11,
              fontWeight: 600,
              background:
                backendStatus === "connected"
                  ? "var(--success-bg)"
                  : "var(--error-bg)",
              color:
                backendStatus === "connected"
                  ? "var(--success)"
                  : "var(--error)",
              border: `1px solid ${
                backendStatus === "connected"
                  ? "rgba(22,163,74,0.2)"
                  : "rgba(220,38,38,0.2)"
              }`,
            }}
          >
            <span
              className={`status-dot ${backendStatus === "connecting" ? "pulse" : ""}`}
            />
            <span>
              {backendStatus === "connected" ? "ACTIVE" : "OFFLINE"}
            </span>
          </div>
        </header>

        <div className="page-content">{children}</div>
      </div>

      {/* ── Search Modal ─────────────────────────────────────────── */}
      {searchOpen && (
        <div
          className="search-modal-backdrop"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="search-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: 12 }}
              >
                <Search
                  size={20}
                  style={{
                    color: "var(--text-muted)",
                    flexShrink: 0,
                  }}
                />
                <input
                  autoFocus
                  className="input"
                  placeholder="Search SKU, location, order, operator, investigation..."
                  style={{
                    border: "none",
                    background: "transparent",
                    boxShadow: "none",
                    padding: 0,
                    fontSize: 16,
                  }}
                  id="global-search-input"
                />
              </div>
            </div>
            <div
              style={{
                padding: "32px 20px",
                color: "var(--text-muted)",
                textAlign: "center",
                fontSize: 13,
              }}
            >
              Start typing to search across all warehouse data
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
