"use client";

import AppShell from "@/components/AppShell";
import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, Zap, Sparkles, Paperclip, Mic } from "lucide-react";

const suggestions = [
  "Download yesterday's reports",
  "Investigate location IQ1-2A17",
  "Generate Excel for Zone A cycle count",
  "Explain shortages this week",
  "Email today's report to the team",
  "Show picking accuracy trend",
];

type ChatMessage = { role: "user" | "assistant"; content: string };

const welcomeMessages: ChatMessage[] = [
  {
    role: "assistant",
    content:
      "Hello! I'm Atlas AI, your warehouse intelligence assistant. I can help you download reports, investigate discrepancies, run automations, analyze trends, and much more. Just tell me what you need in plain language.",
  },
];

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(welcomeMessages);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg: ChatMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const reply: ChatMessage = {
        role: "assistant",
        content: `I understand you'd like to "${userMsg.content}". Let me process that for you. In production, this will connect to the Atlas AI Engine to execute your request automatically.`,
      };
      setMessages((prev) => [...prev, reply]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <AppShell>
      <div className="chat-container">
        {/* Messages */}
        <div className="chat-messages">
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              className={`chat-msg ${msg.role === "user" ? "user" : "atlas"}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <div className={`chat-avatar ${msg.role === "user" ? "user" : "atlas"}`}>
                {msg.role === "user" ? "U" : <Zap size={16} />}
              </div>
              <div className="chat-bubble">{msg.content}</div>
            </motion.div>
          ))}

          {isTyping && (
            <div className="chat-msg atlas">
              <div className="chat-avatar atlas"><Zap size={16} /></div>
              <div className="chat-bubble">
                <div className="typing-dots">
                  <span /><span /><span />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEnd} />
        </div>

        {/* Suggestions */}
        {messages.length <= 1 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "0 0 12px" }}>
            {suggestions.map((s) => (
              <button
                key={s}
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setInput(s);
                }}
                style={{ fontSize: 12.5 }}
              >
                <Sparkles size={13} />
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="chat-input-area">
          <textarea
            className="chat-input"
            placeholder="Tell Atlas what you need..."
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
          />
          <button
            className="chat-send-btn"
            onClick={handleSend}
            disabled={!input.trim()}
            id="chat-send"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </AppShell>
  );
}
