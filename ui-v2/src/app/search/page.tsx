"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import AppShell from "@/components/AppShell";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Package,
  MapPin,
  Microscope,
  FileText,
  Workflow,
  User,
  ArrowRight,
  Loader2,
  X,
  Sparkles,
} from "lucide-react";
import { searchAll, type SearchResultItem } from "@/lib/api";
import Link from "next/link";

// ── Config ────────────────────────────────────────────────────────────────────

const CATEGORIES = ["All", "SKU", "Location", "Investigation", "Report", "Workflow", "Operator"] as const;
type Category = (typeof CATEGORIES)[number];

const TYPE_ICON: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  sku:            Package,
  location:       MapPin,
  investigation:  Microscope,
  report:         FileText,
  workflow:       Workflow,
  operator:       User,
};

const TYPE_COLOR: Record<string, { bg: string; color: string }> = {
  sku:            { bg: "var(--accent-subtle)",  color: "var(--accent)"   },
  location:       { bg: "var(--info-bg)",         color: "var(--info)"     },
  investigation:  { bg: "var(--error-bg)",        color: "var(--error)"    },
  report:         { bg: "var(--success-bg)",      color: "var(--success)"  },
  workflow:       { bg: "var(--warning-bg)",      color: "var(--warning)"  },
  operator:       { bg: "var(--bg-elevated)",     color: "var(--text-muted)" },
};

const EXAMPLE_QUERIES = [
  "Zone A shortages",
  "SKU WH-4491",
  "cycle count",
  "picking performance",
  "dock B",
  "Zone C",
];

// ── Result card ───────────────────────────────────────────────────────────────

function ResultCard({ item, index }: { item: SearchResultItem; index: number }) {
  const Icon = TYPE_ICON[item.type] ?? Package;
  const colors = TYPE_COLOR[item.type] ?? TYPE_COLOR.sku;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.28 }}
    >
      <Link href={item.href} style={{ textDecoration: "none" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "14px 18px",
            borderBottom: "1px solid var(--border)",
            cursor: "pointer",
            transition: "background 120ms",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "var(--bg-hover)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
        >
          {/* Icon */}
          <div
            style={{
              width: 40, height: 40, borderRadius: "var(--r-md)",
              background: colors.bg, color: colors.color,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Icon size={18} />
          </div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
              {item.title}
              <span
                style={{
                  fontSize: 10, fontWeight: 600, padding: "1px 6px",
                  borderRadius: "var(--r-full)", background: colors.bg, color: colors.color,
                  textTransform: "uppercase", letterSpacing: 0.4, flexShrink: 0,
                }}
              >
                {item.type}
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.subtitle}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-disabled)", marginTop: 3 }}>
              {item.meta}
            </div>
          </div>

          <ArrowRight size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
        </div>
      </Link>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const [query, setQuery]               = useState("");
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [results, setResults]           = useState<SearchResultItem[] | null>(null);
  const [total, setTotal]               = useState(0);
  const [loading, setLoading]           = useState(false);
  const inputRef                        = useRef<HTMLInputElement>(null);
  const debounceRef                     = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-focus on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  const runSearch = useCallback(async (q: string, cat: Category) => {
    if (!q.trim()) { setResults(null); setTotal(0); return; }
    setLoading(true);
    const data = await searchAll(q.trim(), cat.toLowerCase());
    setResults(data?.results ?? []);
    setTotal(data?.total ?? 0);
    setLoading(false);
  }, []);

  // Debounced search on every keystroke
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { runSearch(query, activeCategory); }, 280);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, activeCategory, runSearch]);

  const hasResults = results !== null && results.length > 0;
  const noResults  = results !== null && results.length === 0 && query.trim().length > 0;

  return (
    <AppShell>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div style={{ maxWidth: 780, margin: "0 auto" }}>

          {/* ── Hero ──────────────────────────────────────────────────────── */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)", letterSpacing: -0.5 }}>
              Search Everything
            </h2>
            <p style={{ color: "var(--text-muted)", marginTop: 8, fontSize: 14 }}>
              Find any SKU, location, order, investigation, or workflow — instantly
            </p>
          </div>

          {/* ── Search Input ───────────────────────────────────────────────── */}
          <div style={{ position: "relative", marginBottom: 16 }}>
            <Search
              size={20}
              style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }}
            />
            <input
              ref={inputRef}
              className="input"
              placeholder="Type to search across all warehouse data…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ paddingLeft: 48, paddingRight: 44, fontSize: 15.5, padding: "14px 44px 14px 48px", borderRadius: "var(--r-xl)" }}
              id="search-input"
              autoComplete="off"
            />
            {loading && (
              <Loader2
                size={18}
                style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", animation: "spin 1s linear infinite", color: "var(--text-muted)" }}
              />
            )}
            {!loading && query && (
              <button
                onClick={() => { setQuery(""); setResults(null); inputRef.current?.focus(); }}
                style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2 }}
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* ── Category Filters ───────────────────────────────────────────── */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
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

          {/* ── Results ────────────────────────────────────────────────────── */}
          <AnimatePresence mode="wait">
            {!query.trim() ? (
              /* Empty state — show examples */
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="card" style={{ padding: "32px 24px" }}>
                <div style={{ textAlign: "center", color: "var(--text-muted)", marginBottom: 24 }}>
                  <Sparkles size={36} style={{ margin: "0 auto 10px", opacity: 0.4 }} />
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Try searching for…</div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                  {EXAMPLE_QUERIES.map((q) => (
                    <button
                      key={q}
                      className="btn btn-secondary btn-sm"
                      onClick={() => setQuery(q)}
                      style={{ fontSize: 12.5 }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : noResults ? (
              <motion.div key="no-results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="card" style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
                <Search size={36} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
                  No results for "{query}"
                </div>
                <div style={{ fontSize: 13 }}>Try a different keyword or change the category filter.</div>
              </motion.div>
            ) : hasResults ? (
              <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="card" style={{ padding: 0, overflow: "hidden" }}>
                {/* Result count header */}
                <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 500 }}>
                    {total} result{total !== 1 ? "s" : ""} for
                    <span style={{ fontWeight: 700, color: "var(--text-primary)", marginLeft: 4 }}>"{query}"</span>
                  </span>
                  {activeCategory !== "All" && (
                    <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600 }}>
                      Filtered: {activeCategory}
                    </span>
                  )}
                </div>
                {results!.map((item, i) => (
                  <ResultCard key={`${item.type}-${item.id}`} item={item} index={i} />
                ))}
              </motion.div>
            ) : null}
          </AnimatePresence>

        </div>
      </motion.div>
    </AppShell>
  );
}
