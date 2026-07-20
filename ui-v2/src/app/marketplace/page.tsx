"use client";

import { useState } from "react";
import AppShell from "@/components/AppShell";
import { motion, AnimatePresence } from "framer-motion";
import {
  Store, Download, Star, CheckCircle2, Search,
  Zap, Filter, ExternalLink, Tag,
} from "lucide-react";

// ── Data ──────────────────────────────────────────────────────────────────────

const MARKETPLACE: MarketplaceItem[] = [
  { id: "sap-connector",   name: "SAP Connector",          author: "Atlas Team",   downloads: 2400, rating: 4.8, category: "ERP",           tag: "official", description: "Connect Atlas to SAP ECC and S/4HANA for automated data extraction — purchase orders, GR, cycle counts, and picking lists.", price: "free" },
  { id: "oracle-wms",      name: "Oracle WMS Bridge",      author: "Atlas Team",   downloads: 1100, rating: 4.5, category: "ERP",           tag: "official", description: "Pull warehouse data from Oracle WMS Cloud — locations, slots, ASNs, and receiving records.", price: "free" },
  { id: "powerbi-export",  name: "Power BI Export",        author: "Community",    downloads: 890,  rating: 4.3, category: "Analytics",      tag: "community", description: "Push Atlas analytics directly into Power BI datasets with automatic refresh and scheduled syncs.", price: "free" },
  { id: "email-reporter",  name: "Email Reporter",         author: "Atlas Team",   downloads: 3200, rating: 4.9, category: "Communication",  tag: "official", description: "Automated email reports with HTML formatting, charts, and attachments — scheduled or on-trigger.", price: "free" },
  { id: "telegram-alerts", name: "Telegram Alerts",        author: "Community",    downloads: 620,  rating: 4.1, category: "Communication",  tag: "community", description: "Send real-time alerts to Telegram channels and groups when Atlas detects anomalies.", price: "free" },
  { id: "barcode-scanner", name: "Barcode Scanner",        author: "Atlas Team",   downloads: 450,  rating: 4.6, category: "Hardware",       tag: "official", description: "USB/Bluetooth barcode scanner integration for real-time inventory verification and discrepancy logging.", price: "free" },
  { id: "ms365-sharepoint",name: "Microsoft 365",          author: "Atlas Team",   downloads: 780,  rating: 4.4, category: "Cloud",          tag: "official", description: "Sync reports to SharePoint, trigger Teams notifications, and export to Excel Online automatically.", price: "free" },
  { id: "qr-generator",   name: "QR Label Generator",     author: "Community",    downloads: 310,  rating: 4.2, category: "Hardware",       tag: "community", description: "Generate and print QR location labels directly from Atlas locations and inventory data.", price: "free" },
  { id: "rfid-bridge",    name: "RFID Bridge",            author: "Atlas Team",   downloads: 190,  rating: 4.7, category: "Hardware",       tag: "official", description: "Integrate RFID readers for real-time inventory tracking and zone transitions.", price: "pro" },
];

const CATEGORIES = ["All", "ERP", "Analytics", "Communication", "Hardware", "Cloud"];

interface MarketplaceItem {
  id: string;
  name: string;
  author: string;
  downloads: number;
  rating: number;
  category: string;
  tag: "official" | "community";
  description: string;
  price: "free" | "pro";
}

const TAG_STYLE = {
  official:  { bg: "var(--accent-subtle)",  color: "var(--accent)",  label: "Official" },
  community: { bg: "var(--info-bg)",         color: "var(--info)",    label: "Community" },
};

function formatDownloads(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

// ── Card ──────────────────────────────────────────────────────────────────────

function MarketplaceCard({ item, index, onInstall, installing }: {
  item: MarketplaceItem; index: number;
  onInstall: (id: string) => void; installing: boolean;
}) {
  const tagStyle = TAG_STYLE[item.tag];

  return (
    <motion.div
      className="card"
      style={{ padding: 22, cursor: "pointer", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
    >
      {/* PRO badge */}
      {item.price === "pro" && (
        <div style={{ position: "absolute", top: 0, right: 0, background: "var(--accent)", color: "white", fontSize: 9, fontWeight: 800, padding: "3px 8px", borderRadius: "0 var(--r-md) 0 var(--r-sm)", letterSpacing: 1 }}>
          PRO
        </div>
      )}

      {/* Icon + title */}
      <div style={{ display: "flex", gap: 14, marginBottom: 12 }}>
        <div
          style={{
            width: 46, height: 46, borderRadius: "var(--r-md)",
            background: "var(--accent-subtle)", color: "var(--accent)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}
        >
          <Zap size={22} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 2 }}>{item.name}</div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
            <span>by {item.author}</span>
            <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--text-disabled)", display: "inline-block" }} />
            <span
              style={{
                fontSize: 10, fontWeight: 600, padding: "1px 6px",
                borderRadius: "var(--r-full)", background: tagStyle.bg, color: tagStyle.color,
              }}
            >
              {tagStyle.label}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6, flex: 1, marginBottom: 16 }}>
        {item.description}
      </p>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 14, fontSize: 11.5, color: "var(--text-muted)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Star size={12} style={{ color: "var(--warning)" }} /> {item.rating}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Download size={11} /> {formatDownloads(item.downloads)}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Tag size={11} /> {item.category}
          </span>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => onInstall(item.id)}
          disabled={installing}
          style={{ gap: 5 }}
        >
          {installing ? <CheckCircle2 size={12} /> : <Download size={12} />}
          {installing ? "Installed" : "Install"}
        </button>
      </div>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const [search, setSearch]             = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [installed, setInstalled]       = useState<Set<string>>(new Set());

  const handleInstall = (id: string) => {
    setInstalled((prev) => new Set(prev).add(id));
  };

  const filtered = MARKETPLACE.filter((item) => {
    const matchCat = activeCategory === "All" || item.category === activeCategory;
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase()) || item.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <AppShell>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800 }}>Marketplace</h2>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
              Install connectors and skills with one click
              <span style={{ marginLeft: 8, fontWeight: 600, color: "var(--text-primary)" }}>
                · {MARKETPLACE.length} available
              </span>
            </p>
          </div>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
            <input
              className="input"
              placeholder="Search marketplace…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 32, fontSize: 13, width: 220 }}
            />
          </div>
        </div>

        {/* Category filters */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`btn btn-sm ${activeCategory === cat ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setActiveCategory(cat)}
              style={{ fontSize: 12.5 }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid */}
        <AnimatePresence mode="wait">
          {filtered.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card" style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
              <Store size={36} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>No results</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Try a different search or category.</div>
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {filtered.map((item, i) => (
                <MarketplaceCard
                  key={item.id}
                  item={item}
                  index={i}
                  onInstall={handleInstall}
                  installing={installed.has(item.id)}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AppShell>
  );
}
