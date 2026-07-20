import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  startRecording,
  stopRecording,
  generateWorkflowFromRecording,
  getRecordingEventSource,
} from '../api/client';
import {
  Save, Plus, Trash2, ArrowUp, ArrowDown,
  Circle, Square, Zap, Code, Edit3,
  Info, ChevronRight, Globe, MousePointer,
  Keyboard, List, AlertCircle, CheckCircle,
  Loader, RefreshCw,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type TabId = 'builder' | 'record' | 'json';
type RecorderStatus = 'idle' | 'starting' | 'recording' | 'stopping' | 'generating' | 'done' | 'error';

interface CapturedEvent {
  type: string;
  url?: string;
  selector?: string;
  text?: string;
  value?: string;
  label?: string;
  tag?: string;
  input_type?: string;
  context?: string;
  timestamp_ms?: number;
  rows?: number;
  headers?: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function eventIcon(type: string) {
  switch (type) {
    case 'navigate':   return <Globe size={12} style={{ color: '#60a5fa' }} />;
    case 'click':      return <MousePointer size={12} style={{ color: '#4ade80' }} />;
    case 'fill':       return <Keyboard size={12} style={{ color: '#c084fc' }} />;
    case 'select':     return <List size={12} style={{ color: '#fb923c' }} />;
    case 'key_enter':  return <ChevronRight size={12} style={{ color: '#94a3b8' }} />;
    case 'table_detected': return <List size={12} style={{ color: '#10b981' }} />;
    case 'typing':     return <Keyboard size={12} style={{ color: '#475569', opacity: 0.5 }} />;
    default:           return <Circle size={12} style={{ color: '#94a3b8' }} />;
  }
}

function eventLabel(evt: CapturedEvent): string {
  switch (evt.type) {
    case 'navigate':  return `Navigate → ${evt.url || ''}`;
    case 'click':     return `Click "${evt.text || evt.selector || ''}"`;
    case 'fill':      return `Type "${evt.value || ''}" in ${evt.label || evt.selector || ''}`;
    case 'select':    return `Select "${evt.value || ''}" from ${evt.label || evt.selector || ''}`;
    case 'key_enter': return `Press Enter in ${evt.selector || ''}`;
    case 'table_detected': return `📊 Table auto-detected: ${evt.rows} rows (Headers: ${(evt.headers || []).join(', ')})`;
    case 'typing':    return `Typing in ${evt.label || evt.selector || ''}…`;
    default:          return evt.type;
  }
}

function isDisplayEvent(evt: CapturedEvent): boolean {
  // Collapse repeated typing events; show only fill/change
  return evt.type !== 'typing';
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function TrainingModePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const editId = location.state?.editWorkflowId || null;

  // ── Tab ────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>('builder');

  // ── Builder state ──────────────────────────────────────────────────────────
  const [name, setName]               = useState('');
  const [description, setDesc]        = useState('');
  const [tagsString, setTagsString]   = useState('');
  const [inputs, setInputs]           = useState<any[]>([]);
  const [steps, setSteps]             = useState<any[]>([]);
  const [outputFormat, setOutputFmt]  = useState('excel');
  const [loading, setLoading]         = useState(false);
  const [saveMsg, setSaveMsg]         = useState('');

  // ── Recorder state ─────────────────────────────────────────────────────────
  const [recUrl, setRecUrl]               = useState('');
  const [recDesc, setRecDesc]             = useState('');
  const [sessionId, setSessionId]         = useState<string | null>(null);
  const [recStatus, setRecStatus]         = useState<RecorderStatus>('idle');
  const [recError, setRecError]           = useState('');
  const [capturedEvents, setCapturedEvents] = useState<CapturedEvent[]>([]);
  const [stoppedEvents, setStoppedEvents]   = useState<CapturedEvent[]>([]);
  const esRef = useRef<EventSource | null>(null);
  const feedRef = useRef<HTMLDivElement | null>(null);

  // ── JSON tab state ─────────────────────────────────────────────────────────
  const [rawJson, setRawJson]       = useState('');
  const [jsonError, setJsonError]   = useState('');

  // ── Load existing workflow for editing ─────────────────────────────────────
  useEffect(() => {
    if (editId) loadWorkflowDetail(editId);
  }, [editId]);

  // ── Sync JSON tab from builder ─────────────────────────────────────────────
  useEffect(() => {
    const payload = buildPayload();
    setRawJson(JSON.stringify(payload, null, 2));
    setJsonError('');
  }, [name, description, tagsString, inputs, steps, outputFormat]);

  // ── Auto-scroll event feed ─────────────────────────────────────────────────
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [capturedEvents]);

  // ── Cleanup SSE on unmount ─────────────────────────────────────────────────
  useEffect(() => {
    return () => { esRef.current?.close(); };
  }, []);

  // ── API ────────────────────────────────────────────────────────────────────

  const loadWorkflowDetail = async (id: string) => {
    setLoading(true);
    try {
      const data = await getWorkflow(id);
      const def  = data.definition;
      setName(def.name || '');
      setDesc(def.description || '');
      setTagsString(def.tags ? def.tags.join(', ') : '');
      setInputs(def.required_inputs || []);
      setSteps(def.steps || []);
      setOutputFmt(def.output?.format || 'excel');
    } catch (err: any) {
      // Workflow not found (deleted) — reset to a clean blank form
      console.warn('Workflow not found, resetting to new form:', err.message);
      setName('');
      setDesc('');
      setTagsString('');
      setInputs([]);
      setSteps([]);
      setOutputFmt('excel');
      // Clear the stale editId from router state so we're in 'new' mode
      navigate('/training', { replace: true, state: { editWorkflowId: null } });
    } finally {
      setLoading(false);
    }
  };

  const buildPayload = useCallback(() => ({
    name,
    description,
    tags: tagsString.split(',').map(s => s.trim()).filter(Boolean),
    required_inputs: inputs,
    steps,
    output: { format: outputFormat },
    validation: { min_rows: 0 },
  }), [name, description, tagsString, inputs, steps, outputFormat]);

  const handleSave = async () => {
    if (!name.trim()) { setSaveMsg('⚠ Workflow name is required.'); return; }
    setLoading(true);
    setSaveMsg('');
    try {
      if (editId) {
        await updateWorkflow(editId, buildPayload());
        setSaveMsg('✓ Workflow updated!');
      } else {
        await createWorkflow(buildPayload());
        setSaveMsg('✓ Workflow saved!');
      }
      setTimeout(() => navigate('/library'), 1200);
    } catch (err: any) {
      setSaveMsg(`✕ Save failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ── Builder helpers ────────────────────────────────────────────────────────

  const addInput = () => setInputs(p => [
    ...p, { name: 'input_' + p.length, type: 'text', label: 'Field Label', required: true }
  ]);
  const removeInput = (i: number) => setInputs(p => p.filter((_, idx) => idx !== i));
  const updateInput = (i: number, f: string, v: any) =>
    setInputs(p => p.map((x, idx) => idx === i ? { ...x, [f]: v } : x));

  const addStep = () => setSteps(p => [...p, {
    id: 'step_' + (p.length + 1), type: 'navigate',
    description: '', url: 'https://', selector: '', value: '', on_failure: 'stop',
  }]);
  const removeStep = (i: number) => setSteps(p => p.filter((_, idx) => idx !== i));
  const updateStep = (i: number, f: string, v: any) =>
    setSteps(p => p.map((x, idx) => idx === i ? { ...x, [f]: v } : x));
  const moveStep = (i: number, dir: 'up' | 'down') => {
    const target = dir === 'up' ? i - 1 : i + 1;
    if (target < 0 || target >= steps.length) return;
    const s = [...steps];
    [s[i], s[target]] = [s[target], s[i]];
    setSteps(s);
  };

  // ── Recorder handlers ──────────────────────────────────────────────────────

  const handleStartRecording = async () => {
    if (!recUrl) { setRecError('Please enter a start URL.'); return; }
    setRecError('');
    setRecStatus('starting');
    setCapturedEvents([]);
    setStoppedEvents([]);

    try {
      const res = await startRecording(recUrl, recDesc);
      setSessionId(res.session_id);
      setRecStatus('recording');

      // Open SSE stream for live event feed
      const es = getRecordingEventSource(res.session_id);
      esRef.current = es;
      es.onmessage = (e) => {
        try {
          const evt: CapturedEvent = JSON.parse(e.data);
          if ((evt as any).type === '__done__') {
            es.close();
            setRecStatus('done');
            return;
          }
          setCapturedEvents(prev => [...prev, evt]);
        } catch (_) {}
      };
      es.onerror = () => {
        es.close();
        // If the browser closed on its own, reset state gracefully
        setRecStatus('idle');
        setRecError('Recording connection closed (the browser window might have been closed).');
      };
    } catch (err: any) {
      setRecStatus('error');
      setRecError(err.message || 'Failed to launch browser. Is the backend running?');
    }
  };

  const handleStopAndGenerate = async () => {
    if (!sessionId) return;
    esRef.current?.close();
    setRecStatus('stopping');

    try {
      const stopRes = await stopRecording(sessionId);
      setStoppedEvents(stopRes.events);
      setRecStatus('generating');

      const genRes = await generateWorkflowFromRecording({
        session_id: sessionId,
        description: recDesc,
        events: stopRes.events,
      });

      // Pre-fill the builder from AI output
      const wf = genRes.workflow;
      setName(wf.name || '');
      setDesc(wf.description || '');
      setTagsString((wf.tags || []).join(', '));
      setInputs(wf.required_inputs || []);
      setSteps(wf.steps || []);
      setOutputFmt(wf.output?.format || 'excel');

      setRecStatus('done');
      // Switch to builder with a small delay so user sees the "done" state
      setTimeout(() => setActiveTab('builder'), 800);
    } catch (err: any) {
      setRecStatus('error');
      setRecError(err.message || 'Failed to generate workflow.');
    }
  };

  // ── JSON tab handlers ──────────────────────────────────────────────────────

  const handleLoadFromJson = () => {
    setJsonError('');
    try {
      const parsed = JSON.parse(rawJson);
      if (parsed.name)             setName(parsed.name);
      if (parsed.description)      setDesc(parsed.description);
      if (parsed.tags)             setTagsString(parsed.tags.join(', '));
      if (parsed.required_inputs)  setInputs(parsed.required_inputs);
      if (parsed.steps)            setSteps(parsed.steps);
      if (parsed.output?.format)   setOutputFmt(parsed.output.format);
      setActiveTab('builder');
    } catch (_) {
      setJsonError('Invalid JSON — check for syntax errors and try again.');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  // Only show full-page spinner when LOADING an existing workflow (never for new blank form)
  if (loading && editId && steps.length === 0 && inputs.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0 animate-fade-in" style={{ minHeight: '100%' }}>

      {/* ── Tab bar ──────────────────────────────────────────────────────────── */}
      <div className="flex gap-0 mb-4" style={{
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-card)',
        borderRadius: 'var(--r-lg) var(--r-lg) 0 0',
        padding: '0 16px',
      }}>
        {([
          { id: 'builder', icon: <Edit3 size={14} />,  label: 'Manual Builder' },
          { id: 'record',  icon: <Circle size={14} style={{ color: recStatus === 'recording' ? '#ef4444' : undefined }} />, label: 'Live Record & Generate' },
          { id: 'json',    icon: <Code size={14} />,    label: 'Raw JSON' },
        ] as { id: TabId; icon: React.ReactNode; label: string }[]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '12px 16px', fontSize: '13px', fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'none', border: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none',
              cursor: 'pointer', transition: 'all 0.15s', marginBottom: '-1px',
            }}
          >
            {tab.icon} {tab.label}
            {tab.id === 'record' && recStatus === 'recording' && (
              <span style={{
                width: 7, height: 7, borderRadius: '50%', background: '#ef4444',
                animation: 'pulse 1s infinite', display: 'inline-block', marginLeft: 2,
              }} />
            )}
          </button>
        ))}

        {/* Save button top-right */}
        <div style={{ flex: 1 }} />
        <div className="flex items-center gap-2" style={{ padding: '8px 0' }}>
          {saveMsg && (
            <span style={{ fontSize: '12px', color: saveMsg.startsWith('✓') ? '#4ade80' : '#f87171' }}>
              {saveMsg}
            </span>
          )}
          <button onClick={handleSave} className="btn btn-primary btn-sm" disabled={loading}>
            {loading ? <Loader size={13} className="spin" /> : <Save size={13} />}
            {editId ? 'Update Workflow' : 'Save Workflow'}
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 1 – MANUAL BUILDER
      ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'builder' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>

          {/* Left — Metadata & Inputs */}
          <div className="card flex flex-col gap-3">
            <div className="card-title">{editId ? 'Edit Workflow' : 'New Workflow'}</div>

            <div className="form-group">
              <label className="form-label">Workflow Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Cycle Count" className="form-input" />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea value={description} onChange={e => setDesc(e.target.value)}
                placeholder="What does this workflow automate?" className="form-textarea" />
            </div>

            <div className="form-group">
              <label className="form-label">Tags (comma-separated)</label>
              <input type="text" value={tagsString} onChange={e => setTagsString(e.target.value)}
                placeholder="inventory, daily, report" className="form-input" />
            </div>

            <div className="form-group">
              <label className="form-label">Default Output Format</label>
              <select value={outputFormat} onChange={e => setOutputFmt(e.target.value)} className="form-select">
                <option value="excel">Excel Sheet (.xlsx)</option>
                <option value="pdf">PDF Document</option>
                <option value="csv">CSV File</option>
                <option value="json">JSON Structured Data</option>
              </select>
            </div>

            <div className="divider" />

            <div className="flex justify-between items-center">
              <span className="form-label font-bold">Required Inputs</span>
              <button onClick={addInput} className="btn btn-secondary btn-sm btn-icon">
                <Plus size={14} />
              </button>
            </div>

            <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: '240px' }}>
              {inputs.map((inp, i) => (
                <div key={i} className="flex gap-2 items-center p-2"
                  style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
                  <div className="flex flex-col gap-1 flex-1">
                    <input type="text" value={inp.name} onChange={e => updateInput(i, 'name', e.target.value)}
                      placeholder="name" className="form-input text-xs" style={{ padding: '4px 8px' }} />
                    <input type="text" value={inp.label} onChange={e => updateInput(i, 'label', e.target.value)}
                      placeholder="label" className="form-input text-xs" style={{ padding: '4px 8px' }} />
                  </div>
                  <select value={inp.type} onChange={e => updateInput(i, 'type', e.target.value)}
                    className="form-select text-xs" style={{ padding: '4px 8px', width: '80px' }}>
                    <option value="text">Text</option>
                    <option value="date">Date</option>
                    <option value="textarea">Textarea</option>
                    <option value="file">File Upload</option>
                  </select>
                  <button onClick={() => removeInput(i)} className="btn btn-secondary btn-icon btn-sm btn-danger">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {inputs.length === 0 && (
                <div className="text-center py-4 text-xs text-muted">No custom runtime inputs.</div>
              )}
            </div>
          </div>

          {/* Right — Step sequence */}
          <div className="card flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <div className="card-title">Automation Steps</div>
              <button onClick={addStep} className="btn btn-secondary btn-sm">
                <Plus size={14} /> Add Step
              </button>
            </div>
            <div className="divider" style={{ margin: '4px 0' }} />

            <div className="flex-1 flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
              {steps.map((step, i) => (
                <div key={i} className="flex flex-col gap-2 p-3"
                  style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-2">
                    <span className="step-number">{i + 1}</span>
                    <span className="step-type-badge">{step.type.toUpperCase()}</span>
                    <input type="text" value={step.description || ''}
                      onChange={e => updateStep(i, 'description', e.target.value)}
                      placeholder="Step description…" className="form-input flex-1 text-xs font-bold"
                      style={{ padding: '4px 8px' }} />
                    <button onClick={() => moveStep(i, 'up')} disabled={i === 0} className="btn btn-secondary btn-icon btn-sm"><ArrowUp size={12} /></button>
                    <button onClick={() => moveStep(i, 'down')} disabled={i === steps.length - 1} className="btn btn-secondary btn-icon btn-sm"><ArrowDown size={12} /></button>
                    <button onClick={() => removeStep(i)} className="btn btn-secondary btn-icon btn-sm btn-danger"><Trash2 size={12} /></button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label text-xs">Action Type</label>
                      <select value={step.type} onChange={e => updateStep(i, 'type', e.target.value)}
                        className="form-select text-xs" style={{ padding: '6px' }}>
                        <option value="navigate">Navigate URL</option>
                        <option value="click">Click Element</option>
                        <option value="fill">Fill Input</option>
                        <option value="select">Select Option</option>
                        <option value="wait">Wait for Selector</option>
                        <option value="scroll">Scroll</option>
                        <option value="extract_table">Extract Table</option>
                        <option value="extract_text">Extract Text</option>
                        <option value="extract_metadata">Extract Metadata</option>
                        <option value="screenshot">Screenshot</option>
                        <option value="download">Download File</option>
                        <option value="for_each_row">Loop: For Each Row</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label text-xs">On Failure</label>
                      <select value={step.on_failure || 'stop'} onChange={e => updateStep(i, 'on_failure', e.target.value)}
                        className="form-select text-xs" style={{ padding: '6px' }}>
                        <option value="stop">Stop (Fail)</option>
                        <option value="continue">Skip & Continue</option>
                      </select>
                    </div>

                    {step.type === 'navigate' && (
                      <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
                        <label className="form-label text-xs">URL — use {'{config.base_url}'} or {'{inputs.var}'}</label>
                        <input type="text" value={step.url || ''} onChange={e => updateStep(i, 'url', e.target.value)}
                          placeholder="https://example.com/path" className="form-input text-xs" style={{ padding: '6px' }} />
                      </div>
                    )}

                    {['click','fill','select','wait','extract_table','extract_text','download'].includes(step.type) && (
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label text-xs">CSS Selector</label>
                        <input type="text" value={step.selector || ''} onChange={e => updateStep(i, 'selector', e.target.value)}
                          placeholder="#submit-btn or .search-input" className="form-input text-xs" style={{ padding: '6px' }} />
                      </div>
                    )}

                    {step.type === 'fill' && (
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label text-xs">Fill Value (use {'{inputs.var}'})</label>
                        <input type="text" value={step.value || ''} onChange={e => updateStep(i, 'value', e.target.value)}
                          placeholder="{inputs.date}" className="form-input text-xs" style={{ padding: '6px' }} />
                      </div>
                    )}

                    {['extract_table','extract_text','extract_metadata'].includes(step.type) && (
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label text-xs">Output Key</label>
                        <input type="text" value={step.output_key || ''} onChange={e => updateStep(i, 'output_key', e.target.value)}
                          placeholder="results_table" className="form-input text-xs" style={{ padding: '6px' }} />
                      </div>
                    )}

                    {step.type === 'for_each_row' && (
                      <>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label text-xs">Excel Source File Path</label>
                          <input type="text" value={step.source || ''} onChange={e => updateStep(i, 'source', e.target.value)}
                            placeholder="{inputs.batch_file}" className="form-input text-xs" style={{ padding: '6px' }} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label text-xs">Excel Column Header to Loop Over</label>
                          <input type="text" value={step.column || ''} onChange={e => updateStep(i, 'column', e.target.value)}
                            placeholder="Task ID" className="form-input text-xs" style={{ padding: '6px' }} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label text-xs">Assign Loop Row To (Variable Name)</label>
                          <input type="text" value={step.input_var || ''} onChange={e => updateStep(i, 'input_var', e.target.value)}
                            placeholder="task_id" className="form-input text-xs" style={{ padding: '6px' }} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label text-xs">Collect Output Key (From Inner Steps)</label>
                          <input type="text" value={step.collect_output_key || ''} onChange={e => updateStep(i, 'collect_output_key', e.target.value)}
                            placeholder="extracted_table" className="form-input text-xs" style={{ padding: '6px' }} />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
                          <label className="form-label text-xs">Combined Output Target Key</label>
                          <input type="text" value={step.output_key || ''} onChange={e => updateStep(i, 'output_key', e.target.value)}
                            placeholder="all_results" className="form-input text-xs" style={{ padding: '6px' }} />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {steps.length === 0 && (
                <div className="empty-state">
                  <div className="empty-state-icon"><Info size={20} /></div>
                  <div className="empty-state-title">No steps yet</div>
                  <div className="empty-state-desc">
                    Add steps manually, or use the <strong>Live Record</strong> tab to capture them automatically.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 2 – LIVE RECORD & GENERATE
      ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'record' && (
        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '16px', alignItems: 'start' }}>

          {/* Left — Controls */}
          <div className="card flex flex-col gap-4">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Circle size={16} style={{ color: '#ef4444' }} />
              Live Record & Generate
            </div>

            <div style={{
              padding: '12px', borderRadius: 'var(--r-md)',
              background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
              fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6,
            }}>
              <strong style={{ color: 'var(--text)' }}>How it works:</strong><br />
              Enter a URL → click Start Recording → perform your workflow in the browser →
              click Stop & Generate → Atlas AI writes the workflow for you.
            </div>

            <div className="form-group">
              <label className="form-label">Workflow Description</label>
              <input type="text" value={recDesc} onChange={e => setRecDesc(e.target.value)}
                placeholder="e.g. Generate Cycle Count report for today"
                className="form-input" disabled={recStatus === 'recording' || recStatus === 'starting'} />
            </div>

            <div className="form-group">
              <label className="form-label">Start URL</label>
              <input type="text" value={recUrl} onChange={e => setRecUrl(e.target.value)}
                placeholder="https://your-system.com/login"
                className="form-input" disabled={recStatus === 'recording' || recStatus === 'starting'} />
            </div>

            {recError && (
              <div style={{
                padding: '10px 12px', borderRadius: 'var(--r-md)',
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                color: '#fca5a5', fontSize: '12px', display: 'flex', gap: '8px', alignItems: 'flex-start',
              }}>
                <AlertCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
                {recError}
              </div>
            )}

            {/* Action buttons */}
            {recStatus === 'idle' || recStatus === 'error' ? (
              <button
                onClick={handleStartRecording}
                className="btn btn-primary"
                style={{ justifyContent: 'center', padding: '12px', gap: '10px', fontSize: '14px' }}
              >
                <Circle size={16} style={{ fill: 'currentColor' }} />
                Start Recording
              </button>
            ) : recStatus === 'starting' ? (
              <button className="btn btn-secondary" disabled style={{ justifyContent: 'center', padding: '12px' }}>
                <Loader size={16} className="spin" /> Launching browser…
              </button>
            ) : recStatus === 'recording' ? (
              <button
                onClick={handleStopAndGenerate}
                className="btn"
                style={{
                  justifyContent: 'center', padding: '12px', gap: '10px', fontSize: '14px',
                  background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
                  color: '#fca5a5',
                }}
              >
                <Square size={16} style={{ fill: 'currentColor' }} />
                Stop & Generate Workflow
              </button>
            ) : recStatus === 'stopping' ? (
              <button className="btn btn-secondary" disabled style={{ justifyContent: 'center', padding: '12px' }}>
                <Loader size={16} className="spin" /> Stopping browser…
              </button>
            ) : recStatus === 'generating' ? (
              <button className="btn btn-secondary" disabled style={{ justifyContent: 'center', padding: '12px' }}>
                <Zap size={16} className="spin" /> AI is generating workflow…
              </button>
            ) : recStatus === 'done' ? (
              <div style={{
                padding: '12px', borderRadius: 'var(--r-md)', textAlign: 'center',
                background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)',
                color: '#4ade80', fontSize: '13px', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: '8px',
              }}>
                <CheckCircle size={16} /> Workflow generated — switching to Builder…
              </div>
            ) : null}

            {/* Event count badge */}
            {capturedEvents.length > 0 && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                {capturedEvents.filter(isDisplayEvent).length} interactions captured
              </div>
            )}

            {/* Re-record button */}
            {(recStatus === 'done' || recStatus === 'error') && (
              <button
                onClick={() => {
                  setRecStatus('idle');
                  setCapturedEvents([]);
                  setStoppedEvents([]);
                  setSessionId(null);
                  setRecError('');
                }}
                className="btn btn-secondary btn-sm"
                style={{ justifyContent: 'center' }}
              >
                <RefreshCw size={13} /> Record Again
              </button>
            )}
          </div>

          {/* Right — Live event feed */}
          <div className="card flex flex-col" style={{ minHeight: '500px' }}>
            <div className="card-title" style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={15} />
              Live Event Feed
              {recStatus === 'recording' && (
                <span style={{
                  fontSize: '11px', padding: '2px 8px', borderRadius: '20px',
                  background: 'rgba(239,68,68,0.15)', color: '#fca5a5',
                  border: '1px solid rgba(239,68,68,0.3)',
                }}>● RECORDING</span>
              )}
              {recStatus === 'generating' && (
                <span style={{
                  fontSize: '11px', padding: '2px 8px', borderRadius: '20px',
                  background: 'rgba(99,102,241,0.15)', color: '#a5b4fc',
                  border: '1px solid rgba(99,102,241,0.3)',
                }}>✦ AI PROCESSING</span>
              )}
            </div>

            <div
              ref={feedRef}
              className="flex flex-col gap-1 overflow-y-auto flex-1"
              style={{ maxHeight: 'calc(100vh - 280px)', minHeight: '380px' }}
            >
              {capturedEvents.filter(isDisplayEvent).map((evt, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: '8px',
                    padding: '7px 10px', borderRadius: 'var(--r-sm)',
                    background: 'var(--bg-elevated)',
                    borderLeft: `3px solid ${
                      evt.type === 'navigate' ? '#3b82f6' :
                      evt.type === 'click'    ? '#22c55e' :
                      evt.type === 'fill'     ? '#a855f7' :
                      evt.type === 'select'   ? '#f97316' :
                      evt.type === 'key_enter'? '#64748b' :
                      evt.type === 'table_detected' ? '#10b981' :
                      'var(--border)'
                    }`,
                    animation: 'fadeIn 0.15s ease',
                  }}
                >
                  <span style={{ marginTop: 2, flexShrink: 0 }}>{eventIcon(evt.type)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '12px', color: 'var(--text)', display: 'block' }}>
                      {eventLabel(evt)}
                    </span>
                    {evt.selector && (
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {evt.selector}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>
                    {evt.type.replace('_', ' ')}
                  </span>
                </div>
              ))}

              {capturedEvents.filter(isDisplayEvent).length === 0 && (
                <div className="empty-state" style={{ flex: 1 }}>
                  <div className="empty-state-icon">
                    {recStatus === 'idle' || recStatus === 'error'
                      ? <Globe size={24} />
                      : recStatus === 'starting'
                      ? <Loader size={24} className="spin" />
                      : <Circle size={24} />
                    }
                  </div>
                  <div className="empty-state-title">
                    {recStatus === 'idle' || recStatus === 'error'
                      ? 'No recording yet'
                      : recStatus === 'starting'
                      ? 'Opening browser…'
                      : 'Waiting for interactions…'
                    }
                  </div>
                  <div className="empty-state-desc">
                    {recStatus === 'idle' || recStatus === 'error'
                      ? 'Fill in the URL and click Start Recording to begin.'
                      : 'Each click, keystroke, and navigation will appear here.'
                    }
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 3 – RAW JSON EDITOR
      ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'json' && (
        <div className="card flex flex-col gap-3" style={{ minHeight: '500px' }}>
          <div className="flex justify-between items-center">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Code size={16} /> Raw JSON Editor
            </div>
            <div className="flex gap-2 items-center">
              {jsonError && (
                <span style={{ fontSize: '12px', color: '#f87171' }}>{jsonError}</span>
              )}
              <button onClick={handleLoadFromJson} className="btn btn-primary btn-sm">
                <CheckCircle size={13} /> Load into Builder
              </button>
            </div>
          </div>

          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
            The JSON below reflects your current workflow. You can paste a custom JSON here and click
            <strong> Load into Builder</strong> to import it.
          </p>

          <textarea
            value={rawJson}
            onChange={e => { setRawJson(e.target.value); setJsonError(''); }}
            className="form-textarea"
            spellCheck={false}
            style={{
              flex: 1,
              minHeight: '420px',
              fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
              fontSize: '12px',
              lineHeight: 1.6,
              resize: 'none',
              whiteSpace: 'pre',
              overflowX: 'auto',
            }}
          />
        </div>
      )}

    </div>
  );
}
