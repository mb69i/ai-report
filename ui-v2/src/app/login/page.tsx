"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { Zap, Mail, Lock, User, Eye, EyeOff, AlertCircle, Loader2, ArrowRight } from "lucide-react";

type Mode = "login" | "register";

export default function LoginPage() {
  const { login, register, isAuthenticated, loading } = useAuth();
  const router = useRouter();

  const [mode, setMode]           = useState<Mode>("login");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [fullName, setFullName]   = useState("");
  const [showPass, setShowPass]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);

    const result = mode === "login"
      ? await login(email, password)
      : await register(email, password, fullName);

    if (result.ok) {
      router.replace("/");
    } else {
      setError(result.error ?? "Something went wrong");
      setSubmitting(false);
    }
  };

  if (loading) return null; // Still rehydrating localStorage

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-base)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background grid */}
      <div
        style={{
          position: "absolute", inset: 0,
          backgroundImage: "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          opacity: 0.25,
        }}
      />
      {/* Red glow */}
      <div
        style={{
          position: "absolute",
          width: 480, height: 480,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(169,14,2,0.18) 0%, transparent 70%)",
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        style={{ position: "relative", width: "100%", maxWidth: 420, padding: "0 20px" }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div
            style={{
              width: 56, height: 56, borderRadius: "var(--r-lg)",
              background: "var(--accent)", display: "flex",
              alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px",
              boxShadow: "0 0 32px rgba(169,14,2,0.4)",
            }}
          >
            <Zap size={28} color="white" />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.5 }}>Atlas</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            Warehouse Intelligence Operating System
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: 32 }}>
          {/* Mode toggle */}
          <div
            style={{
              display: "flex", borderRadius: "var(--r-md)",
              background: "var(--bg-elevated)", padding: 3, marginBottom: 28,
            }}
          >
            {(["login", "register"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null); }}
                style={{
                  flex: 1, padding: "8px 0", fontSize: 13, fontWeight: 600,
                  borderRadius: "var(--r-sm)", border: "none", cursor: "pointer",
                  transition: "all 200ms",
                  background: mode === m ? "var(--bg-card)" : "transparent",
                  color: mode === m ? "var(--text-primary)" : "var(--text-muted)",
                  boxShadow: mode === m ? "var(--shadow-sm)" : "none",
                }}
              >
                {m === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Full name (register only) */}
              <AnimatePresence>
                {mode === "register" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.22 }}
                    style={{ overflow: "hidden" }}
                  >
                    <div style={{ position: "relative" }}>
                      <User size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
                      <input
                        className="input"
                        type="text"
                        placeholder="Full name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        style={{ paddingLeft: 38 }}
                        autoComplete="name"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Email */}
              <div style={{ position: "relative" }}>
                <Mail size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
                <input
                  className="input"
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{ paddingLeft: 38 }}
                  autoComplete="email"
                  id="login-email"
                />
              </div>

              {/* Password */}
              <div style={{ position: "relative" }}>
                <Lock size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
                <input
                  className="input"
                  type={showPass ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  style={{ paddingLeft: 38, paddingRight: 40 }}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  id="login-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2 }}
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 8,
                      padding: "10px 13px", borderRadius: "var(--r-md)",
                      background: "var(--error-bg)", border: "1px solid rgba(220,38,38,0.25)",
                      fontSize: 12.5, color: "var(--error)",
                    }}
                  >
                    <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit */}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || !email || !password}
                style={{
                  width: "100%", justifyContent: "center",
                  padding: "12px 0", fontSize: 14, fontWeight: 700,
                  marginTop: 4, gap: 8,
                  boxShadow: "0 4px 24px rgba(169,14,2,0.3)",
                }}
                id="login-submit"
              >
                {submitting
                  ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> {mode === "login" ? "Signing in…" : "Creating account…"}</>
                  : <>{mode === "login" ? "Sign In" : "Create Account"} <ArrowRight size={15} /></>
                }
              </button>
            </div>
          </form>

          {/* Demo hint */}
          <div
            style={{
              marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--border)",
              fontSize: 11.5, color: "var(--text-muted)", textAlign: "center",
            }}
          >
            Demo: <span
              onClick={() => { setEmail("admin@atlas.ai"); setPassword("atlas123"); }}
              style={{ color: "var(--accent)", cursor: "pointer", fontWeight: 600 }}
            >
              admin@atlas.ai
            </span> / atlas123
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: "var(--text-disabled)" }}>
          Atlas V2 · Enterprise Warehouse Intelligence
        </div>
      </motion.div>
    </div>
  );
}
