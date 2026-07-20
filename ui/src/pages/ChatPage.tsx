import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  sendChatMessage,
  getChatHistory,
  clearChatHistory,
  runWorkflow,
  cancelWorkflow,
  getStreamUrl,
  getWorkflow,
  uploadBatchFile,
  Workflow
} from '../api/client';
import {
  Send,
  Trash2,
  Play,
  StopCircle,
  Loader2,
  CheckCircle,
  XCircle,
  Terminal,
  Activity,
  User,
  Zap,
  Info,
  Paperclip,
  FileText
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  metadata?: any;
}

export default function ChatPage() {
  const location = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);

  // Active Job State
  const [activeJob, setActiveJob] = useState<any>(null);
  const [jobProgress, setJobProgress] = useState<any>({
    percent: 0,
    currentStep: '',
    steps: []
  });
  const [jobLogs, setJobLogs] = useState<string[]>([]);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);

  // Interactive Form Collection (when AI detects missing inputs)
  const [formInputs, setFormInputs] = useState<Record<string, string>>({});
  const [missingInputsFields, setMissingInputsFields] = useState<any[]>([]);
  const [pendingWorkflowId, setPendingWorkflowId] = useState<string | null>(null);

  const [uploadingFields, setUploadingFields] = useState<Record<string, boolean>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});

  const handleFileChange = async (fieldName: string, file: File | null) => {
    if (!file) return;
    setUploadingFields(prev => ({ ...prev, [fieldName]: true }));
    setUploadErrors(prev => ({ ...prev, [fieldName]: '' }));
    try {
      const res = await uploadBatchFile(file);
      setFormInputs(prev => ({ ...prev, [fieldName]: res.file_path }));
    } catch (err: any) {
      setUploadErrors(prev => ({ ...prev, [fieldName]: err.message || 'Upload failed.' }));
    } finally {
      setUploadingFields(prev => ({ ...prev, [fieldName]: false }));
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatLogsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadHistory();
    // Check if redirecting from dashboard with a workflow pre-selected
    if (location.state?.runWorkflowId) {
      handleWorkflowQuickSelect(location.state.runWorkflowId);
    }
  }, [location]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, jobLogs]);

  const loadHistory = async () => {
    try {
      const history = await getChatHistory();
      const formatted = history.map((h: any) => ({
        id: String(h.id),
        role: h.role,
        content: h.content,
        created_at: h.created_at,
        metadata: h.metadata_json ? JSON.parse(h.metadata_json) : null
      }));
      setMessages(formatted);
    } catch (err) {
      console.error('Failed to load chat history:', err);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (chatLogsRef.current) {
      chatLogsRef.current.scrollTop = chatLogsRef.current.scrollHeight;
    }
  };

  const handleWorkflowQuickSelect = async (wfId: string) => {
    try {
      const wf = await getWorkflow(wfId);
      const def = wf.definition;
      const responseText = `I have selected the **${def.name}** workflow. Please fill in the required inputs below to begin.`;
      setMessages(prev => [
        ...prev,
        {
          id: 'quick_' + Date.now(),
          role: 'assistant',
          content: responseText,
          created_at: new Date().toISOString()
        }
      ]);
      if (def.required_inputs && def.required_inputs.length > 0) {
        setMissingInputsFields(def.required_inputs);
        setPendingWorkflowId(wfId);
      } else {
        triggerWorkflowRun(wfId, {});
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || sending) return;

    const userText = inputValue;
    setInputValue('');
    setSending(true);

    // Optimistically append user message
    setMessages(prev => [
      ...prev,
      {
        id: 'usr_' + Date.now(),
        role: 'user',
        content: userText,
        created_at: new Date().toISOString()
      }
    ]);

    try {
      const response = await sendChatMessage(userText);

      // Append assistant response
      setMessages(prev => [
        ...prev,
        {
          id: 'ast_' + Date.now(),
          role: 'assistant',
          content: response.response,
          created_at: new Date().toISOString(),
          metadata: response
        }
      ]);

      // If AI matched a workflow and inputs are missing, prompt form
      if (response.intent === 'run_workflow' && response.workflow_id) {
        if (response.missing_inputs && response.missing_inputs.length > 0) {
          // Fetch full workflow detail to get full field inputs metadata
          const wf = await getWorkflow(response.workflow_id);
          const fields = wf.definition.required_inputs.filter((i: any) =>
            response.missing_inputs.includes(i.name)
          );
          setMissingInputsFields(fields);
          setPendingWorkflowId(response.workflow_id);
        } else {
          // No inputs missing — confirm and run
          triggerWorkflowRun(response.workflow_id, {});
        }
      }
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          role: 'assistant',
          content: `Sorry, I encountered an error: ${err.message}`,
          created_at: new Date().toISOString()
        }
      ]);
    } finally {
      setSending(false);
    }
  };

  // Triggered when form collects all inputs
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingWorkflowId) return;
    const inputs = { ...formInputs };
    setMissingInputsFields([]);
    setPendingWorkflowId(null);
    setFormInputs({});
    triggerWorkflowRun(pendingWorkflowId, inputs);
  };

  const triggerWorkflowRun = async (workflowId: string, inputs: Record<string, any>) => {
    try {
      setActiveJob({ id: 'pending', name: workflowId, status: 'starting' });
      setJobLogs(['[Atlas] Initializing browser automation context...', '[Atlas] Requesting token session keys...']);

      const run = await runWorkflow(workflowId, inputs);
      const execId = run.execution_id;

      setActiveJob({ id: execId, name: workflowId, status: 'running' });

      // Start SSE stream listener
      const sseUrl = getStreamUrl(execId);
      const source = new EventSource(sseUrl);
      setEventSource(source);

      source.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        if (payload.type === 'stream_end') {
          source.close();
          setEventSource(null);
          return;
        }

        // Add run log message
        if (payload.message) {
          setJobLogs(prev => [...prev, `[${payload.type.toUpperCase()}] ${payload.message}`]);
        }

        if (payload.type === 'step_started') {
          setJobProgress((prev: any) => ({
            ...prev,
            currentStep: payload.message,
            percent: payload.data.percent
          }));
        } else if (payload.type === 'step_completed') {
          setJobProgress((prev: any) => ({
            ...prev,
            percent: payload.data.percent,
            steps: [...prev.steps, payload.step_id]
          }));
        } else if (payload.type === 'execution_completed') {
          setActiveJob((prev: any) => ({ ...prev, status: 'completed' }));
          setMessages(prev => [
            ...prev,
            {
              id: 'completion_' + Date.now(),
              role: 'assistant',
              content: `### Execution Summary\nWorkflow **${workflowId}** completed successfully.\n\n*Outputs generated successfully.*`,
              created_at: new Date().toISOString()
            }
          ]);
        } else if (payload.type === 'execution_failed') {
          setActiveJob((prev: any) => ({ ...prev, status: 'failed' }));
          setMessages(prev => [
            ...prev,
            {
              id: 'failure_' + Date.now(),
              role: 'assistant',
              content: `❌ **Execution Failed:** ${payload.message}`,
              created_at: new Date().toISOString()
            }
          ]);
        }
      };

      source.onerror = () => {
        source.close();
        setEventSource(null);
        setActiveJob((prev: any) => ({ ...prev, status: 'failed' }));
      };

    } catch (err: any) {
      setJobLogs(prev => [...prev, `[ERROR] ${err.message}`]);
      setActiveJob((prev: any) => ({ ...prev, status: 'failed' }));
    }
  };

  const handleCancelJob = async () => {
    if (!activeJob || activeJob.id === 'pending') return;
    try {
      await cancelWorkflow(activeJob.id);
      setJobLogs(prev => [...prev, '[Atlas] Sending cancellation signal to automation engine...']);
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearHistory = async () => {
    if (confirm('Are you sure you want to clear your chat history?')) {
      await clearChatHistory();
      setMessages([]);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: activeJob ? '1.5fr 1fr' : '1fr', gap: '16px', height: 'calc(100vh - 120px)' }}>
      {/* Left Chat Window */}
      <div className="card flex flex-col overflow-hidden relative" style={{ padding: 0 }}>
        {/* Chat Header */}
        <div className="flex justify-between items-center" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-accent" />
            <span className="font-bold">Atlas AI Assistant</span>
          </div>
          <button onClick={handleClearHistory} className="btn btn-ghost btn-sm btn-icon" data-tooltip="Clear chat history">
            <Trash2 size={16} />
          </button>
        </div>

        {/* Chat Messages */}
        <div className="chat-messages flex-1">
          {messages.map(msg => (
            <div key={msg.id} className={`chat-message ${msg.role}`}>
              <div className={`chat-avatar ${msg.role === 'user' ? 'user' : 'atlas'}`}>
                {msg.role === 'user' ? <User size={14} /> : <Activity size={14} />}
              </div>
              <div className="chat-bubble">
                {/* Parse Markdown content simple style */}
                <div style={{ whiteSpace: 'pre-wrap' }}>
                  {msg.content}
                </div>
              </div>
            </div>
          ))}

          {/* Interactive Form for Missing Inputs */}
          {missingInputsFields.length > 0 && (
            <div className="chat-message assistant">
              <div className="chat-avatar atlas">
                <Activity size={14} />
              </div>
              <div className="chat-bubble" style={{ width: '100%' }}>
                <form onSubmit={handleFormSubmit} className="flex flex-col gap-3">
                  <div className="font-bold flex items-center gap-2 text-sm text-accent">
                    <Info size={14} />
                    <span>Inputs Needed for Workflow</span>
                  </div>
                  {missingInputsFields.map(f => (
                    <div key={f.name} className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">{f.label || f.name}</label>
                      {f.type === 'textarea' ? (
                        <textarea
                          required={f.required}
                          value={formInputs[f.name] || ''}
                          onChange={e => setFormInputs(prev => ({ ...prev, [f.name]: e.target.value }))}
                          placeholder={f.placeholder}
                          className="form-textarea"
                        />
                      ) : f.type === 'file' ? (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="file"
                              accept=".xlsx,.xls,.csv"
                              required={f.required && !formInputs[f.name]}
                              onChange={e => handleFileChange(f.name, e.target.files?.[0] || null)}
                              style={{ display: 'none' }}
                              id={`file-upload-${f.name}`}
                            />
                            <label
                              htmlFor={`file-upload-${f.name}`}
                              className="btn btn-secondary btn-sm flex items-center gap-1 cursor-pointer"
                              style={{ margin: 0 }}
                            >
                              <Paperclip size={13} />
                              <span>Select Excel / CSV</span>
                            </label>
                            {uploadingFields[f.name] && (
                              <Loader2 size={14} className="animate-spin text-accent" />
                            )}
                            {formInputs[f.name] && (
                              <span className="flex items-center gap-1 text-xs text-success font-medium">
                                <FileText size={13} />
                                <span>Uploaded successfully</span>
                              </span>
                            )}
                          </div>
                          {formInputs[f.name] && (
                            <div className="text-[10px] text-muted font-mono bg-base p-1.5 rounded border border-border" style={{ wordBreak: 'break-all' }}>
                              Path: {formInputs[f.name]}
                            </div>
                          )}
                          {uploadErrors[f.name] && (
                            <span className="text-xs text-danger font-medium">{uploadErrors[f.name]}</span>
                          )}
                        </div>
                      ) : (
                        <input
                          type={f.type || 'text'}
                          required={f.required}
                          value={formInputs[f.name] || ''}
                          onChange={e => setFormInputs(prev => ({ ...prev, [f.name]: e.target.value }))}
                          placeholder={f.placeholder}
                          className="form-input"
                        />
                      )}
                    </div>
                  ))}
                  <button type="submit" className="btn btn-primary btn-sm align-self-start">
                    Submit & Execute Run
                  </button>
                </form>
              </div>
            </div>
          )}

          {sending && (
            <div className="chat-message assistant">
              <div className="chat-avatar atlas">
                <Activity size={14} />
              </div>
              <div className="chat-bubble">
                <div className="typing-dots">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input form */}
        <form onSubmit={handleSend} className="chat-input-area">
          <textarea
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask Atlas to generate a report, audit, etc. (e.g. 'Generate receiving logs')"
            rows={1}
            className="chat-input"
          />
          <button type="submit" disabled={sending || !inputValue.trim()} className="chat-send-btn">
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </form>
      </div>

      {/* Right Live Job Tracker */}
      {activeJob && (
        <div className="card flex flex-col overflow-hidden" style={{ padding: 0 }}>
          {/* Header */}
          <div className="flex justify-between items-center" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <span className="font-bold flex items-center gap-2">
              <Activity size={16} className="text-accent animate-spin" />
              <span>Live Job Tracker</span>
            </span>
            <span className={`badge ${activeJob.status}`}>{activeJob.status.toUpperCase()}</span>
          </div>

          <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
            {/* Progress metrics */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs font-bold text-muted">
                <span>PROGRESS</span>
                <span>{jobProgress.percent}%</span>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${jobProgress.percent}%` }} />
              </div>
              {jobProgress.currentStep && (
                <div className="text-sm font-medium text-ellipsis" style={{ color: 'var(--text-secondary)' }}>
                  {jobProgress.currentStep}
                </div>
              )}
            </div>

            <div className="divider" style={{ margin: 0 }} />

            {/* Step execution logs terminal */}
            <div className="flex-1 flex flex-col gap-2 overflow-hidden">
              <div className="flex items-center justify-between text-xs font-bold text-muted">
                <span className="flex items-center gap-1">
                  <Terminal size={12} /> ENGINE CONSOLE
                </span>
                <span>{jobLogs.length} events</span>
              </div>
              <div
                ref={chatLogsRef}
                style={{
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-md)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  padding: '12px',
                  flex: 1,
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  color: '#a3e635'
                }}
              >
                {jobLogs.map((log, idx) => (
                  <div key={idx} style={{ marginBottom: '4px' }}>
                    {log}
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {activeJob.status === 'running' && (
                <button onClick={handleCancelJob} className="btn btn-danger w-full justify-center">
                  <StopCircle size={16} />
                  <span>Cancel Job Execution</span>
                </button>
              )}
              {(activeJob.status === 'completed' || activeJob.status === 'failed') && (
                <button onClick={() => setActiveJob(null)} className="btn btn-secondary w-full justify-center">
                  <span>Dismiss Tracker</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
