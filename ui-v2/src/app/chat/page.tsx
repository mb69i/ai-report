"use client";

import AppShell from "@/components/AppShell";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Zap, Sparkles, Trash2, WifiOff } from "lucide-react";
import { sendChatMessage, getChatHistory, type ChatResponse } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

type MessageRole = "user" | "assistant";

interface ChatMessage {
  role: MessageRole;
  content: string;
  intent?: string;
  confidence?: number;
  provider?: string;
  isError?: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SESSION_ID = "atlas-default";

const WELCOME: ChatMessage = {
  role: "assistant",
  content:
    "Hello! I'm Atlas AI — your warehouse intelligence assistant. I can download reports, investigate discrepancies, run automations, analyze trends, and answer questions in plain language. Just tell me what you need.",
};

const SUGGESTIONS = [
  "Download yesterday's cycle count reports",
  "Investigate location IQ1-2A17",
  "Generate Excel for Zone A",
  "Explain shortages this week",
  "Show picking accuracy trend",
  "Email today's report to the team",
];

const OFFLINE_REPLY: ChatMessage = {
  role: "assistant",
  content:
    "I'm having trouble reaching the Atlas backend right now. Please make sure the server is running on port 7411 and try again.",
  isError: true,
};

// ── Typing dots ───────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 4, padding: "4px 0" }}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--text-muted)" }}
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  );
}

// ── Intent badge ─────────────────────────────────────────────────────────────
function IntentBadge({ intent, confidence }: { intent?: string; confidence?: number }) {
  if (!intent || intent === "other") return null;
  const label = intent.replace(/_/g, " ");
  return (
    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
      <span
        style={{
          fontSize: 10.5, fontWeight: 600, padding: "2px 8px",
          borderRadius: "var(--r-full)", background: "var(--accent-subtle)",
          color: "var(--accent)", border: "1px solid var(--border-accent)",
          textTransform: "uppercase", letterSpacing: 0.4,
        }}
      >
        {label}
      </span>
      {confidence != null && (
        <span style={{ fontSize: 10.5, color: "var(--text-muted)", alignSelf: "center" }}>
          {Math.round(confidence * 100)}% confident
        </span>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom on every message update
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [input]);

  // Load chat history on mount
  useEffect(() => {
    if (historyLoaded) return;
    getChatHistory(SESSION_ID).then((history) => {
      if (history && history.length > 0) {
        const restored: ChatMessage[] = history.map((m) => ({
          role: m.role as MessageRole,
          content: m.content,
        }));
        setMessages([WELCOME, ...restored]);
      }
      setHistoryLoaded(true);
    });
  }, [historyLoaded]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isTyping) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setIsTyping(true);

    const result = await sendChatMessage(text, SESSION_ID);
    setIsTyping(false);

    if (!result) {
      setMessages((prev) => [...prev, OFFLINE_REPLY]);
      return;
    }

    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: result.response,
        intent: result.intent,
        confidence: result.confidence,
        provider: result.provider,
      },
    ]);
  }, [input, isTyping]);

  const handleClear = async () => {
    setMessages([WELCOME]);
    // Backend session cleared on next send
  };

  const showSuggestions = messages.length <= 1 && !isTyping;

  return (
    <AppShell>
      <div className="chat-container">
        {/* Toolbar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: "1px solid var(--border)", marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="chat-avatar atlas" style={{ width: 30, height: 30, fontSize: 12 }}>
              <Zap size={14} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Atlas AI</div>
              <div style={{ fontSize: 11, color: "var(--success)", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)", display: "inline-block" }} />
                Online · {SESSION_ID}
              </div>
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleClear}
            title="Clear conversation"
            style={{ gap: 5, fontSize: 12 }}
          >
            <Trash2 size={13} /> Clear
          </button>
        </div>

        {/* Messages */}
        <div className="chat-messages">
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                className={`chat-msg ${msg.role === "user" ? "user" : "atlas"}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                <div className={`chat-avatar ${msg.role === "user" ? "user" : "atlas"}`}>
                  {msg.role === "user" ? "U" : <Zap size={14} />}
                </div>
                <div>
                  <div
                    className="chat-bubble"
                    style={
                      msg.isError
                        ? { borderColor: "var(--error)", background: "var(--error-bg)" }
                        : undefined
                    }
                  >
                    {msg.isError && <WifiOff size={13} style={{ display: "inline", marginRight: 6, verticalAlign: "middle", color: "var(--error)" }} />}
                    {msg.content}
                  </div>
                  {msg.role === "assistant" && (
                    <IntentBadge intent={msg.intent} confidence={msg.confidence} />
                  )}
                  {msg.provider && (
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3, paddingLeft: 2 }}>
                      via {msg.provider}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          {isTyping && (
            <motion.div
              className="chat-msg atlas"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="chat-avatar atlas"><Zap size={14} /></div>
              <div className="chat-bubble"><TypingDots /></div>
            </motion.div>
          )}

          <div ref={messagesEnd} />
        </div>

        {/* Suggestions */}
        <AnimatePresence>
          {showSuggestions && (
            <motion.div
              style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "0 0 12px" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  className="btn btn-secondary btn-sm"
                  onClick={() => setInput(s)}
                  style={{ fontSize: 12.5 }}
                >
                  <Sparkles size={12} />
                  {s}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input area */}
        <div className="chat-input-area">
          <textarea
            ref={textareaRef}
            className="chat-input"
            placeholder="Tell Atlas what you need…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            id="chat-input"
            disabled={isTyping}
          />
          <button
            className="chat-send-btn"
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            id="chat-send"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </AppShell>
  );
}
