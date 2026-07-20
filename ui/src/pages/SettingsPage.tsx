import React, { useState, useEffect, useCallback } from 'react';
import {
  getSettings,
  updateConfig,
  saveApiKeys,
  testConnection,
} from '../api/client';
import {
  Save,
  ShieldAlert,
  Cpu,
  Monitor,
  Key,
  Eye,
  EyeOff,
  Wifi,
  WifiOff,
  CheckCircle,
  XCircle,
  Loader,
  RefreshCw,
  Globe,
  HardDrive,
  Zap,
  Info,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface KeysStatus {
  gemini_configured: boolean;
  openai_configured: boolean;
}

interface TestResult {
  ok: boolean;
  message: string;
}

type TestingState = 'idle' | 'testing' | 'ok' | 'error';

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={16} className="text-accent" />
        <span className="card-title">{title}</span>
      </div>
      <div className="divider" style={{ margin: '4px 0 12px' }} />
    </>
  );
}

function StatusBadge({ configured }: { configured: boolean }) {
  return (
    <span
      style={{
        fontSize: '11px',
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: '100px',
        background: configured ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)',
        color: configured ? '#22c55e' : '#ef4444',
        letterSpacing: '0.02em',
      }}
    >
      {configured ? '● Configured' : '○ Not set'}
    </span>
  );
}

function MaskedInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="form-input"
        style={{ paddingRight: '40px', fontFamily: value && !visible ? 'monospace' : undefined }}
        autoComplete="off"
        spellCheck={false}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        style={{
          position: 'absolute',
          right: '10px',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          padding: '2px',
          display: 'flex',
          alignItems: 'center',
        }}
        title={visible ? 'Hide key' : 'Show key'}
      >
        {visible ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

function ConnectionTestButton({
  state,
  onTest,
  label,
}: {
  state: TestingState;
  onTest: () => void;
  label?: string;
}) {
  const busy = state === 'testing';
  return (
    <button
      type="button"
      onClick={onTest}
      disabled={busy}
      className="btn"
      style={{
        background:
          state === 'ok'
            ? 'rgba(34,197,94,0.15)'
            : state === 'error'
            ? 'rgba(239,68,68,0.12)'
            : 'var(--bg-elevated)',
        color:
          state === 'ok'
            ? '#22c55e'
            : state === 'error'
            ? '#ef4444'
            : 'var(--text-primary)',
        border: '1px solid var(--border)',
        gap: '6px',
        fontSize: '12px',
        padding: '6px 12px',
        minWidth: '120px',
      }}
    >
      {busy ? (
        <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} />
      ) : state === 'ok' ? (
        <CheckCircle size={13} />
      ) : state === 'error' ? (
        <XCircle size={13} />
      ) : (
        <Wifi size={13} />
      )}
      <span>{busy ? 'Testing…' : label || 'Test Connection'}</span>
    </button>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SettingsPage() {
  // ── Config state ─────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingKeys, setSavingKeys] = useState(false);
  const [keysStatus, setKeysStatus] = useState<KeysStatus>({ gemini_configured: false, openai_configured: false });

  // AI config
  const [primaryProvider, setPrimaryProvider] = useState('gemini');
  const [geminiModel, setGeminiModel] = useState('gemini-1.5-pro');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o');
  const [ollamaModel, setOllamaModel] = useState('llama3.2');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [offlineMode, setOfflineMode] = useState(false);
  const [dataPrivacy, setDataPrivacy] = useState(true);

  // Browser config
  const [headless, setHeadless] = useState(false);
  const [slowMo, setSlowMo] = useState(0);

  // API key inputs (never pre-filled from server)
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');

  // Connection test states
  const [geminiTest, setGeminiTest] = useState<TestingState>('idle');
  const [openaiTest, setOpenaiTest] = useState<TestingState>('idle');
  const [ollamaTest, setOllamaTest] = useState<TestingState>('idle');
  const [testMessages, setTestMessages] = useState<Record<string, string>>({});

  // Save feedback
  const [saveMsg, setSaveMsg] = useState('');

  // Discovered models from connection check
  const [availableGeminiModels, setAvailableGeminiModels] = useState<string[]>([
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-2.0-flash',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-3.5-flash',
  ]);
  const [testDetails, setTestDetails] = useState<Record<string, string>>({});

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSettings();
      const cfg = data.config;
      const ks = data.keys_status || {};
      setKeysStatus(ks);
      if (data.available_gemini_models && data.available_gemini_models.length > 0) {
        setAvailableGeminiModels(data.available_gemini_models);
      }
      setPrimaryProvider(cfg.ai?.primary_provider || 'gemini');
      setGeminiModel(cfg.ai?.gemini_model || 'gemini-1.5-flash');
      setOpenaiModel(cfg.ai?.openai_model || 'gpt-4o');
      setOllamaModel(cfg.ai?.ollama_model || 'llama3.2');
      setOllamaUrl(cfg.ai?.ollama_base_url || 'http://localhost:11434');
      setOfflineMode(cfg.ai?.offline_mode || false);
      setDataPrivacy(cfg.ai?.send_data_to_ai !== undefined ? !cfg.ai.send_data_to_ai : true);
      setHeadless(cfg.browser?.headless || false);
      setSlowMo(cfg.browser?.slow_mo_ms || 0);
    } catch (err) {
      console.error('Failed to load settings', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  // ── Save AI keys ──────────────────────────────────────────────────────────
  const handleSaveKeys = async () => {
    if (!geminiKey && !openaiKey) return;
    setSavingKeys(true);
    try {
      await saveApiKeys({
        ...(geminiKey ? { gemini_api_key: geminiKey } : {}),
        ...(openaiKey ? { openai_api_key: openaiKey } : {}),
      });
      setGeminiKey('');
      setOpenaiKey('');
      await loadSettings();
      setSaveMsg('API keys saved securely to .env ✓');
      setTimeout(() => setSaveMsg(''), 4000);
    } catch (err: any) {
      setSaveMsg(`Failed to save keys: ${err.message}`);
    } finally {
      setSavingKeys(false);
    }
  };

  // ── Test connections ──────────────────────────────────────────────────────
  const handleTest = async (provider: string) => {
    const setters: Record<string, (s: TestingState) => void> = {
      gemini: setGeminiTest,
      openai: setOpenaiTest,
      ollama: setOllamaTest,
    };
    const setter = setters[provider];
    setter('testing');
    setTestMessages((m) => ({ ...m, [provider]: '' }));

    try {
      const params: any = { provider };
      if (provider === 'gemini') {
        if (geminiKey) params.api_key = geminiKey;
        params.model = geminiModel;
      } else if (provider === 'openai') {
        if (openaiKey) params.api_key = openaiKey;
        params.model = openaiModel;
      } else if (provider === 'ollama') {
        params.base_url = ollamaUrl;
        params.model = ollamaModel;
      }

      const result: any = await testConnection(params);
      setter(result.ok ? 'ok' : 'error');
      setTestMessages((m) => ({ ...m, [provider]: result.message }));
      if (result.detail) {
        setTestDetails((d) => ({ ...d, [provider]: result.detail }));
      }
      if (result.ok && provider === 'gemini' && result.available_models) {
        setAvailableGeminiModels(result.available_models);
        if (result.message && result.message.includes('using ')) {
          const usedModel = result.message.split('using ')[1].trim();
          setGeminiModel(usedModel);
        }
      }
    } catch (err: any) {
      setter('error');
      setTestMessages((m) => ({ ...m, [provider]: err.message }));
    }

    // Reset after 10 seconds
    setTimeout(() => {
      setter('idle');
      setTestMessages((m) => ({ ...m, [provider]: '' }));
      setTestDetails((d) => ({ ...d, [provider]: '' }));
    }, 10000);
  };

  // ── Save config ───────────────────────────────────────────────────────────
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateConfig({
        ai: {
          primary_provider: primaryProvider,
          gemini_model: geminiModel,
          openai_model: openaiModel,
          ollama_model: ollamaModel,
          ollama_base_url: ollamaUrl,
          offline_mode: offlineMode,
          send_data_to_ai: !dataPrivacy,
        },
        browser: {
          headless: headless,
          slow_mo_ms: Number(slowMo),
        },
      });
      setSaveMsg('Configuration saved ✓');
      setTimeout(() => setSaveMsg(''), 4000);
      loadSettings();
    } catch (err: any) {
      setSaveMsg(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="loading-spinner" />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in" style={{ maxWidth: '860px', margin: '0 auto' }}>

      {/* ── API Keys Card ────────────────────────────────────────────────── */}
      <div className="card flex flex-col gap-4" style={{ marginBottom: '16px' }}>
        <SectionHeader icon={Key} title="API Key Vault" />

        <div
          style={{
            background: 'rgba(99,102,241,0.06)',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: 'var(--r-md)',
            padding: '10px 14px',
            fontSize: '13px',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
          }}
        >
          <Info size={14} style={{ marginTop: '2px', flexShrink: 0, color: 'var(--accent)' }} />
          <span>
            Keys are stored only in your local <code style={{ color: 'var(--accent)' }}>.env</code> file and never
            sent to any server. Leave a field empty to keep the existing key.
          </span>
        </div>

        {/* Gemini Key Row */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="form-label" style={{ margin: 0 }}>
              Google Gemini API Key
            </label>
            <div className="flex items-center gap-2">
              <StatusBadge configured={keysStatus.gemini_configured} />
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: '11px', color: 'var(--accent)', textDecoration: 'none' }}
              >
                Get free key ↗
              </a>
            </div>
          </div>
          <div className="flex gap-2">
            <div style={{ flex: 1 }}>
              <MaskedInput
                id="gemini-key"
                value={geminiKey}
                onChange={setGeminiKey}
                placeholder={keysStatus.gemini_configured ? '••••••••••• (key saved — enter new to replace)' : 'AIza...'}
              />
            </div>
            <ConnectionTestButton
              state={geminiTest}
              onTest={() => handleTest('gemini')}
            />
          </div>
          {testMessages.gemini && (
            <div className="flex flex-col gap-1 mt-1 p-2" style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)' }}>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: geminiTest === 'ok' ? '#22c55e' : '#ef4444',
                }}
              >
                {testMessages.gemini}
              </span>
              {testDetails.gemini && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {testDetails.gemini}
                </span>
              )}
            </div>
          )}
        </div>

        {/* OpenAI Key Row */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="form-label" style={{ margin: 0 }}>
              OpenAI API Key <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(optional)</span>
            </label>
            <div className="flex items-center gap-2">
              <StatusBadge configured={keysStatus.openai_configured} />
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: '11px', color: 'var(--accent)', textDecoration: 'none' }}
              >
                platform.openai.com ↗
              </a>
            </div>
          </div>
          <div className="flex gap-2">
            <div style={{ flex: 1 }}>
              <MaskedInput
                id="openai-key"
                value={openaiKey}
                onChange={setOpenaiKey}
                placeholder={keysStatus.openai_configured ? '••••••••••• (key saved — enter new to replace)' : 'sk-...'}
              />
            </div>
            <ConnectionTestButton
              state={openaiTest}
              onTest={() => handleTest('openai')}
            />
          </div>
          {testMessages.openai && (
            <span
              style={{
                fontSize: '12px',
                color: openaiTest === 'ok' ? '#22c55e' : '#ef4444',
              }}
            >
              {testMessages.openai}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleSaveKeys}
          disabled={savingKeys || (!geminiKey && !openaiKey)}
          className="btn btn-primary"
          style={{ alignSelf: 'flex-start', gap: '8px' }}
        >
          {savingKeys ? (
            <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <Key size={14} />
          )}
          <span>{savingKeys ? 'Saving Keys…' : 'Save API Keys'}</span>
        </button>
      </div>

      {/* ── Config form ──────────────────────────────────────────────────── */}
      <form onSubmit={handleSaveConfig} className="flex flex-col gap-4">

        {/* AI Engine */}
        <div className="card flex flex-col gap-4">
          <SectionHeader icon={Cpu} title="Cognitive AI Orchestrator" />

          {/* Primary Provider */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Primary Provider</label>
              <select
                value={primaryProvider}
                onChange={(e) => {
                  setPrimaryProvider(e.target.value);
                  if (e.target.value === 'ollama') setOfflineMode(true);
                  else setOfflineMode(false);
                }}
                className="form-select"
              >
                <option value="gemini">🌐 Google Gemini (Cloud)</option>
                <option value="openai">🤖 OpenAI GPT (Cloud)</option>
                <option value="ollama">💻 Ollama (Local / Offline)</option>
              </select>
            </div>

            {/* Model picker — context-sensitive */}
            {primaryProvider === 'gemini' && (
              <div className="form-group">
                <label className="form-label">Gemini Model</label>
                <select value={geminiModel} onChange={(e) => setGeminiModel(e.target.value)} className="form-select">
                  {availableGeminiModels.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {primaryProvider === 'openai' && (
              <div className="form-group">
                <label className="form-label">OpenAI Model</label>
                <select value={openaiModel} onChange={(e) => setOpenaiModel(e.target.value)} className="form-select">
                  <option value="gpt-4o">GPT-4o (Recommended)</option>
                  <option value="gpt-4o-mini">GPT-4o Mini (Fast · Cheap)</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Legacy)</option>
                  <option value="o1-mini">o1 Mini (Reasoning)</option>
                </select>
              </div>
            )}

            {primaryProvider === 'ollama' && (
              <div className="form-group">
                <label className="form-label">Ollama Model</label>
                <select value={ollamaModel} onChange={(e) => setOllamaModel(e.target.value)} className="form-select">
                  <option value="llama3.2">Llama 3.2 3B</option>
                  <option value="llama3.1">Llama 3.1 8B</option>
                  <option value="llama3.1:70b">Llama 3.1 70B</option>
                  <option value="mistral">Mistral 7B</option>
                  <option value="mixtral">Mixtral 8x7B</option>
                  <option value="phi3">Phi-3 Mini</option>
                  <option value="gemma2">Gemma 2 9B</option>
                  <option value="qwen2.5">Qwen 2.5 7B</option>
                </select>
              </div>
            )}
          </div>

          {/* Ollama URL */}
          {primaryProvider === 'ollama' && (
            <div className="flex gap-2 items-end">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Ollama Host Address</label>
                <input
                  type="text"
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="form-input"
                />
              </div>
              <ConnectionTestButton
                state={ollamaTest}
                onTest={() => handleTest('ollama')}
                label="Ping Ollama"
              />
            </div>
          )}
          {testMessages.ollama && (
            <span style={{ fontSize: '12px', color: ollamaTest === 'ok' ? '#22c55e' : '#ef4444' }}>
              {testMessages.ollama}
            </span>
          )}

          {/* Privacy toggles */}
          <div
            className="flex flex-col gap-3 p-3"
            style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}
          >
            <Toggle
              id="offline-mode"
              title="Offline Mode"
              desc="Disable all external AI calls — forces Ollama only"
              value={offlineMode}
              onChange={(v) => {
                setOfflineMode(v);
                if (v) setPrimaryProvider('ollama');
              }}
            />
            <div className="divider" style={{ margin: '4px 0' }} />
            <Toggle
              id="data-privacy"
              title="AI Data Privacy Vault"
              desc="Prevent sending extracted page content to external AI services"
              value={dataPrivacy}
              onChange={setDataPrivacy}
              icon={<ShieldAlert size={13} className="text-warning" />}
            />
          </div>
        </div>

        {/* Browser Engine */}
        <div className="card flex flex-col gap-3">
          <SectionHeader icon={Monitor} title="Browser Automation Sandbox" />

          <div
            className="flex flex-col gap-3 p-3"
            style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}
          >
            <Toggle
              id="headless"
              title="Headless Execution Mode"
              desc="Run tasks in background without opening a browser window"
              value={headless}
              onChange={setHeadless}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Action Slow-Mo delay (milliseconds)</label>
            <input
              type="number"
              value={slowMo}
              onChange={(e) => setSlowMo(Number(e.target.value))}
              placeholder="0"
              min={0}
              max={5000}
              className="form-input"
              style={{ maxWidth: '220px' }}
            />
            <span className="text-xs text-muted" style={{ marginTop: '4px', display: 'block' }}>
              Adds a pause between each browser action. Useful for debugging (0 = disabled)
            </span>
          </div>
        </div>

        {/* Save button + feedback */}
        {saveMsg && (
          <div
            style={{
              padding: '10px 16px',
              borderRadius: 'var(--r-md)',
              background: saveMsg.startsWith('Failed') ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
              color: saveMsg.startsWith('Failed') ? '#ef4444' : '#22c55e',
              fontSize: '13px',
              border: `1px solid ${saveMsg.startsWith('Failed') ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
            }}
          >
            {saveMsg}
          </div>
        )}

        <button type="submit" disabled={saving} className="btn btn-primary justify-center w-full">
          {saving ? (
            <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <Save size={16} />
          )}
          <span>{saving ? 'Saving Configuration…' : 'Save & Apply Configuration'}</span>
        </button>
      </form>
    </div>
  );
}

// ── Toggle helper ─────────────────────────────────────────────────────────────
function Toggle({
  id,
  title,
  desc,
  value,
  onChange,
  icon,
}: {
  id: string;
  title: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
  icon?: React.ReactNode;
}) {
  return (
    <label htmlFor={id} className="flex justify-between items-center" style={{ cursor: 'pointer', userSelect: 'none' }}>
      <div>
        <span className="font-bold text-sm flex items-center gap-1">
          {icon}
          {title}
        </span>
        <span className="text-xs text-muted">{desc}</span>
      </div>
      <div
        onClick={() => onChange(!value)}
        style={{
          width: '42px',
          height: '22px',
          borderRadius: '100px',
          background: value ? 'var(--accent)' : 'var(--border)',
          position: 'relative',
          cursor: 'pointer',
          transition: 'background 0.2s',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '3px',
            left: value ? '22px' : '3px',
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 0.2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }}
        />
      </div>
      <input id={id} type="checkbox" checked={value} onChange={() => {}} style={{ display: 'none' }} />
    </label>
  );
}
