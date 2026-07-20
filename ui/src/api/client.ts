/**
 * Atlas Frontend API Client
 *
 * All requests communicate with the Python FastAPI backend.
 * Uses the default configured port 7411.
 */

const BASE_URL = 'http://127.0.0.1:7411';

async function request(path: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText || response.statusText);
  }
  return response.json();
}

// ── System ───────────────────────────────────────────────────────────────────
export async function getSystemInfo() {
  return request('/api/system/info');
}

// ── Workflows ─────────────────────────────────────────────────────────────────
export interface Workflow {
  id: string;
  db_id?: number;
  name: string;
  description: string;
  version: string;
  tags: string[];
  run_count: number;
  last_run_at: string | null;
  created_at: string;
  modified_at: string;
  required_inputs: any[];
  steps_count: number;
  output_format: string;
}

export async function getWorkflows(): Promise<Workflow[]> {
  return request('/api/workflows/');
}

export async function getWorkflow(workflowId: string) {
  return request(`/api/workflows/${workflowId}`);
}

export async function createWorkflow(data: any) {
  return request('/api/workflows/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateWorkflow(workflowId: string, data: any) {
  return request(`/api/workflows/${workflowId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteWorkflow(workflowId: string) {
  return request(`/api/workflows/${workflowId}`, {
    method: 'DELETE',
  });
}

export async function duplicateWorkflow(workflowId: string) {
  return request(`/api/workflows/${workflowId}/duplicate`, {
    method: 'POST',
  });
}

// ── Runner ────────────────────────────────────────────────────────────────────
export async function runWorkflow(workflowId: string, inputs: Record<string, any>) {
  return request('/api/runner/run', {
    method: 'POST',
    body: JSON.stringify({ workflow_id: workflowId, inputs }),
  });
}

export async function cancelWorkflow(executionId: string) {
  return request('/api/runner/cancel', {
    method: 'POST',
    body: JSON.stringify({ execution_id: executionId }),
  });
}

export async function getExecutionStatus(executionId: string) {
  return request(`/api/runner/status/${executionId}`);
}

export function getStreamUrl(executionId: string): string {
  return `${BASE_URL}/api/runner/stream/${executionId}`;
}

// ── AI Chat ──────────────────────────────────────────────────────────────────
export interface ChatResponse {
  intent: 'run_workflow' | 'list_workflows' | 'create_workflow' | 'ask_question' | 'other';
  workflow_id: string | null;
  confidence: number;
  missing_inputs: string[];
  response: string;
  plan: string | null;
  provider: string;
  raw_response: string;
}

export async function sendChatMessage(message: string, sessionId = 'default'): Promise<ChatResponse> {
  return request('/api/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ message, session_id: sessionId }),
  });
}

export async function getChatHistory(sessionId = 'default') {
  return request(`/api/ai/history/${sessionId}`);
}

export async function clearChatHistory(sessionId = 'default') {
  return request(`/api/ai/history/${sessionId}`, {
    method: 'DELETE',
  });
}

// ── History & Stats ──────────────────────────────────────────────────────────
export interface ExecutionRecord {
  execution_id: string;
  workflow_id: string;
  workflow_name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  steps_total: number;
  steps_completed: number;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  error_message: string | null;
  report_path: string | null;
  created_at: string;
}

export async function getExecutionHistory(limit = 50, offset = 0): Promise<ExecutionRecord[]> {
  return request(`/api/history/?limit=${limit}&offset=${offset}`);
}

export async function getExecutionSteps(executionId: string) {
  return request(`/api/history/${executionId}/steps`);
}

export async function deleteExecution(executionId: string) {
  return request(`/api/history/${executionId}`, {
    method: 'DELETE',
  });
}

export async function getStatsSummary() {
  return request('/api/history/stats/summary');
}

// ── Reports ──────────────────────────────────────────────────────────────────
export interface ReportRecord {
  id: number;
  report_id: string;
  execution_id: string;
  workflow_id: string;
  name: string;
  format: 'excel' | 'pdf' | 'word' | 'csv' | 'json';
  file_path: string;
  file_size_bytes: number;
  created_at: string;
}

export async function getReports(): Promise<ReportRecord[]> {
  return request('/api/reports/');
}

export async function generateReport(executionId: string, format = 'excel', title = '') {
  return request('/api/reports/generate', {
    method: 'POST',
    body: JSON.stringify({ execution_id: executionId, format, title }),
  });
}

export async function deleteReport(reportId: string) {
  return request(`/api/reports/${reportId}`, {
    method: 'DELETE',
  });
}

export function getReportDownloadUrl(reportId: string): string {
  return `${BASE_URL}/api/reports/download/${reportId}`;
}

// ── Backups ──────────────────────────────────────────────────────────────────
export async function getBackups() {
  return request('/api/backup/list');
}

export async function createBackup() {
  return request('/api/backup/create', { method: 'POST' });
}

export async function createBlankCopy(destination?: string) {
  const q = destination ? `?destination=${encodeURIComponent(destination)}` : '';
  return request(`/api/backup/create-blank-copy${q}`, { method: 'POST' });
}

// ── Plugins ──────────────────────────────────────────────────────────────────
export async function getPlugins() {
  return request('/api/plugins/');
}

export async function togglePlugin(pluginId: string) {
  return request(`/api/plugins/${pluginId}/toggle`, { method: 'PUT' });
}

// ── Settings ─────────────────────────────────────────────────────────────────
export async function getSettings() {
  return request('/api/settings/');
}

export async function updateSetting(key: string, value: string, valueType = 'string') {
  return request('/api/settings/', {
    method: 'PUT',
    body: JSON.stringify({ key, value, value_type: valueType }),
  });
}

export async function updateConfig(configUpdate: any) {
  return request('/api/settings/config', {
    method: 'PUT',
    body: JSON.stringify(configUpdate),
  });
}

export async function saveApiKeys(keys: { gemini_api_key?: string; openai_api_key?: string }) {
  return request('/api/settings/keys', {
    method: 'PUT',
    body: JSON.stringify(keys),
  });
}

export async function testConnection(params: {
  provider: string;
  api_key?: string;
  model?: string;
  base_url?: string;
}) {
  return request('/api/settings/test-connection', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// ── Recorder ─────────────────────────────────────────────────────────────────
export interface RecorderStartResponse {
  ok: boolean;
  session_id: string;
  status: string;
  message: string;
}

export async function startRecording(
  start_url: string,
  description: string
): Promise<RecorderStartResponse> {
  return request('/api/recorder/start', {
    method: 'POST',
    body: JSON.stringify({ start_url, description }),
  });
}

export async function stopRecording(
  session_id: string
): Promise<{ ok: boolean; session_id: string; event_count: number; events: any[] }> {
  return request(`/api/recorder/stop/${session_id}`, { method: 'POST' });
}

export async function generateWorkflowFromRecording(params: {
  session_id?: string;
  description: string;
  events: any[];
}): Promise<{ ok: boolean; workflow: any }> {
  return request('/api/recorder/generate', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/** Returns a native EventSource for the SSE live-events stream. */
export function getRecordingEventSource(session_id: string): EventSource {
  return new EventSource(`${BASE_URL}/api/recorder/events/${session_id}`);
}

export async function uploadBatchFile(file: File): Promise<{ ok: boolean; file_path: string }> {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(`${BASE_URL}/api/runner/upload-batch`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText || response.statusText);
  }
  return response.json();
}
