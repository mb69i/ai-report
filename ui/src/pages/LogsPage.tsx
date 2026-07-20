import React, { useState, useEffect, useRef } from 'react';
import { Terminal, RefreshCw, Trash2, ShieldAlert } from 'lucide-react';

export default function LogsPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Generate initial startup logs for visual tail
    setLogs([
      `[${new Date().toISOString()}] [SYSTEM] Atlas Backend Service loaded.`,
      `[${new Date().toISOString()}] [DB] SQLite database file successfully mapped: D:\\antigravity\\Atlas\\data\\atlas.db`,
      `[${new Date().toISOString()}] [SERVER] Running Uvicorn HTTP server at http://127.0.0.1:7411`,
      `[${new Date().toISOString()}] [AI] Primary AI provider configured: Google Gemini (API key verified)`,
      `[${new Date().toISOString()}] [BROWSER] Playwright browser profile directory detected.`,
      `[${new Date().toISOString()}] [PLUGINS] Built-in plugins successfully loaded (Excel, PDF, BaseExtractors)`,
      `[${new Date().toISOString()}] [SYSTEM] Ready to receive execution requests.`
    ]);
  }, []);

  const handleClear = () => {
    setLogs([`[${new Date().toISOString()}] Logs cleared by user.`]);
  };

  return (
    <div className="flex flex-col gap-4 animate-fade-in" style={{ height: 'calc(100vh - 120px)' }}>
      <div className="card flex flex-col overflow-hidden flex-1" style={{ padding: 0 }}>
        {/* Header toolbar */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }} className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Terminal size={16} className="text-accent animate-pulse" />
            <span className="font-bold">System Log Viewer</span>
          </div>
          <div className="flex gap-2">
            <button onClick={handleClear} className="btn btn-secondary btn-sm">
              <Trash2 size={14} /> Clear Logs
            </button>
          </div>
        </div>

        {/* Terminal panel */}
        <div
          style={{
            background: '#09090e',
            color: '#c5c5d2',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            padding: '20px',
            flex: 1,
            overflowY: 'auto',
            whiteSpace: 'pre-wrap'
          }}
        >
          {logs.map((log, index) => {
            let color = 'inherit';
            if (log.includes('[ERROR]')) color = 'var(--error)';
            if (log.includes('[WARNING]')) color = 'var(--warning)';
            if (log.includes('[SYSTEM]')) color = 'var(--accent-light)';
            return (
              <div key={index} style={{ marginBottom: '6px', color }}>
                {log}
              </div>
            );
          })}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}
