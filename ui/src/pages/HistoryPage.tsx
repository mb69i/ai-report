import React, { useState, useEffect } from 'react';
import { getExecutionHistory, getExecutionSteps, deleteExecution, ExecutionRecord } from '../api/client';
import {
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
  Trash2,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  Play,
  Settings
} from 'lucide-react';

export default function HistoryPage() {
  const [history, setHistory] = useState<ExecutionRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSteps, setLoadingSteps] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await getExecutionHistory();
      setHistory(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExpandToggle = async (executionId: string) => {
    if (expandedId === executionId) {
      setExpandedId(null);
      setExpandedSteps([]);
      return;
    }

    setExpandedId(executionId);
    setExpandedSteps([]);
    setLoadingSteps(true);
    try {
      const steps = await getExecutionSteps(executionId);
      setExpandedSteps(steps);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSteps(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this execution record?')) {
      try {
        await deleteExecution(id);
        if (expandedId === id) {
          setExpandedId(null);
          setExpandedSteps([]);
        }
        loadHistory();
      } catch (err) {
        alert('Failed to delete execution record');
      }
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
      <div className="card flex flex-col gap-3" style={{ padding: 0 }}>
        {/* Table header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }} className="flex justify-between items-center">
          <span className="font-bold">Execution Logs History</span>
        </div>

        {/* Execution List table */}
        <div className="overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th></th>
                <th>Workflow Name</th>
                <th>Triggered At</th>
                <th>Duration</th>
                <th>Steps Progress</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {history.map(run => {
                const isExpanded = expandedId === run.execution_id;
                return (
                  <React.Fragment key={run.execution_id}>
                    <tr
                      onClick={() => handleExpandToggle(run.execution_id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </td>
                      <td className="font-medium">{run.workflow_name}</td>
                      <td className="text-muted">
                        {run.started_at ? new Date(run.started_at).toLocaleString() : 'Pending'}
                      </td>
                      <td>{run.duration_seconds ? `${run.duration_seconds.toFixed(1)}s` : '—'}</td>
                      <td>{run.steps_completed} / {run.steps_total}</td>
                      <td>
                        <span className={`badge ${run.status}`}>
                          {run.status.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={(e) => handleDelete(run.execution_id, e)}
                          className="btn btn-secondary btn-icon btn-sm btn-danger"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>

                    {/* Expanded details row */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={7} style={{ background: 'var(--bg-elevated)', padding: '16px' }}>
                          <div className="flex flex-col gap-3">
                            <div className="flex justify-between items-center text-xs font-bold text-muted">
                              <span>GRANULAR STEP AUDIT TRAIL</span>
                              <span>ID: {run.execution_id}</span>
                            </div>

                            {loadingSteps ? (
                              <div className="flex justify-center py-4">
                                <div className="loading-spinner" />
                              </div>
                            ) : (
                              <div className="flex flex-col gap-2">
                                {expandedSteps.map((step, idx) => (
                                  <div
                                    key={idx}
                                    className="flex justify-between items-center p-2"
                                    style={{
                                      background: 'var(--bg-card)',
                                      borderRadius: 'var(--r-sm)',
                                      borderLeft: `3px solid ${
                                        step.status === 'completed'
                                          ? 'var(--success)'
                                          : step.status === 'failed'
                                          ? 'var(--error)'
                                          : 'var(--text-muted)'
                                      }`
                                    }}
                                  >
                                    <div className="flex flex-col">
                                      <span className="font-medium text-sm">
                                        Step {step.step_index + 1}: {step.description}
                                      </span>
                                      <span className="text-xs text-muted">
                                        Type: {step.step_type} {step.error_message ? `| Error: ${step.error_message}` : ''}
                                      </span>
                                    </div>
                                    <span className={`badge ${step.status} text-xs`}>
                                      {step.status.toUpperCase()}
                                    </span>
                                  </div>
                                ))}
                                {expandedSteps.length === 0 && (
                                  <div className="text-center py-4 text-xs text-muted">
                                    No steps recorded.
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {history.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-muted" style={{ padding: '30px' }}>
                    No execution records found. Run a workflow first.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
