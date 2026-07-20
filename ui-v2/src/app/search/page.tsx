"use client";

import AppShell from "@/components/AppShell";
import { motion } from "framer-motion";
import { Search, Filter, Package, MapPin, User, ShoppingCart, FileText } from "lucide-react";
import { useState } from "react";

const categories = ["All", "SKU", "Location", "Order", "Container", "Operator", "Investigation", "Report"];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  return (
    <AppShell>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)", letterSpacing: -0.5 }}>
              Search Everything
            </h2>
            <p style={{ color: "var(--text-muted)", marginTop: 8, fontSize: 14 }}>
              Find any SKU, location, order, container, operator, or investigation instantly
            </p>
          </div>

          <div style={{ position: "relative", marginBottom: 20 }}>
            <Search size={20} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              className="input"
              placeholder="Type to search across all warehouse data..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ paddingLeft: 48, fontSize: 16, padding: "14px 16px 14px 48px", borderRadius: "var(--r-lg)" }}
              id="search-input"
            />
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
            {categories.map((cat) => (
              <button
                key={cat}
                className={`btn btn-sm ${activeCategory === cat ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="card" style={{ padding: 40, textAlign: "center" }}>
            <Search size={40} style={{ color: "var(--text-disabled)", margin: "0 auto 16px" }} />
            <div style={{ color: "var(--text-muted)", fontSize: 14 }}>
              {query ? `Searching for "${query}"...` : "Start typing to search across all warehouse data"}
            </div>
          </div>
        </div>
      </motion.div>
    </AppShell>
  );
}
