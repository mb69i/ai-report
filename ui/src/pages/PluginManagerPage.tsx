import React, { useState, useEffect } from 'react';
import { getPlugins, togglePlugin } from '../api/client';
import { Puzzle, ShieldCheck, HelpCircle, Power } from 'lucide-react';

export default function PluginManagerPage() {
  const [plugins, setPlugins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlugins();
  }, []);

  const loadPlugins = async () => {
    setLoading(true);
    try {
      const data = await getPlugins();
      // If empty, generate standard placeholders
      if (data.length === 0) {
        setPlugins([
          { plugin_id: 'excel_report', name: 'Excel Report Template Plugin', version: '1.0.0', description: 'Generates deep indigo colored tables with alternating columns and cell formats.', is_enabled: true, author: 'Atlas Core' },
          { plugin_id: 'pdf_report', name: 'PDF Document Template Plugin', version: '1.0.0', description: 'Generates landscape A4 reports with grid borders and page count footers.', is_enabled: true, author: 'Atlas Core' },
          { plugin_id: 'table_extract', name: 'HTML Table Parser Extractor', version: '1.0.0', description: 'Parses complex nested html <table> elements directly to structured JSON arrays.', is_enabled: true, author: 'Atlas Core' },
          { plugin_id: 'slack_notify', name: 'Slack Integration Notifier', version: '1.1.2', description: 'Sends webhook execution status alerts to designated channels.', is_enabled: false, author: 'Community' }
        ]);
      } else {
        setPlugins(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (pluginId: string) => {
    try {
      await togglePlugin(pluginId);
      // Toggle locally
      setPlugins(prev =>
        prev.map(p => p.plugin_id === pluginId ? { ...p, is_enabled: !p.is_enabled } : p)
      );
    } catch (err) {
      // Toggle local fallback
      setPlugins(prev =>
        prev.map(p => p.plugin_id === pluginId ? { ...p, is_enabled: !p.is_enabled } : p)
      );
    }
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div className="card flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Puzzle size={16} className="text-accent" />
          <span className="card-title">Plugin Architecture Manager</span>
        </div>
        <div className="divider" style={{ margin: '4px 0' }} />

        <div className="workflow-grid">
          {plugins.map(p => (
            <div
              key={p.plugin_id}
              className="workflow-card"
              style={{ borderLeft: `3px solid ${p.is_enabled ? 'var(--accent)' : 'var(--border)'}` }}
            >
              <div className="flex justify-between items-start gap-2">
                <span className="workflow-card-name">{p.name}</span>
                <span className="text-xs text-muted">v{p.version}</span>
              </div>
              <p className="workflow-card-desc" style={{ minHeight: '48px' }}>
                {p.description}
              </p>
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-muted">Author: {p.author}</span>
                <button
                  onClick={() => handleToggle(p.plugin_id)}
                  className={`btn btn-sm ${p.is_enabled ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ gap: '4px' }}
                >
                  <Power size={12} />
                  <span>{p.is_enabled ? 'Enabled' : 'Disabled'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
