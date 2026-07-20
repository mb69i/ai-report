"use client";

import AppShell from "@/components/AppShell";
import { motion } from "framer-motion";
import { Store, Download, Star, ExternalLink } from "lucide-react";

const marketplace = [
  { name: "SAP Connector", author: "Atlas Team", downloads: "2.4k", rating: 4.8, category: "ERP", description: "Connect Atlas to SAP ECC and S/4HANA for automated data extraction" },
  { name: "Oracle WMS Bridge", author: "Atlas Team", downloads: "1.1k", rating: 4.5, category: "ERP", description: "Pull warehouse data from Oracle WMS Cloud" },
  { name: "Power BI Export", author: "Community", downloads: "890", rating: 4.3, category: "Analytics", description: "Push Atlas data directly into Power BI datasets" },
  { name: "Email Reporter", author: "Atlas Team", downloads: "3.2k", rating: 4.9, category: "Communication", description: "Automated email reports with HTML formatting and attachments" },
  { name: "Telegram Alerts", author: "Community", downloads: "620", rating: 4.1, category: "Communication", description: "Send real-time alerts to Telegram channels and groups" },
  { name: "Barcode Scanner", author: "Atlas Team", downloads: "450", rating: 4.6, category: "Hardware", description: "USB/Bluetooth barcode scanner integration for inventory verification" },
];

export default function MarketplacePage() {
  return (
    <AppShell>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>Marketplace</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>Install new skills and connectors with one click</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {marketplace.map((item, i) => (
            <motion.div key={i} className="card" style={{ padding: 20, cursor: "pointer" }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} whileHover={{ y: -2 }}>
              <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: "var(--r-md)", background: "var(--accent-subtle)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Store size={22} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>{item.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>by {item.author} · {item.category}</div>
                </div>
              </div>
              <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 14 }}>{item.description}</p>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 12, fontSize: 11.5, color: "var(--text-muted)" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Star size={12} style={{ color: "var(--warning)" }} /> {item.rating}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Download size={12} /> {item.downloads}</span>
                </div>
                <button className="btn btn-primary btn-sm">Install</button>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </AppShell>
  );
}
