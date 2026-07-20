import React, { useState, useEffect } from 'react';
import { getStatsSummary, getExecutionHistory, getWorkflows, Workflow, ExecutionRecord } from '../api/client';
import {
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  TrendingUp,
  FileSpreadsheet,
  AlertTriangle,
  ChevronRight,
  Database
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>({
    total_executions: 0,
    completed: 0,
    failed: 0,
    success_rate: 0,
    avg_duration_seconds: 0
  });
  const [history, setHistory] = useState<ExecutionRecord[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const statsData = await getStatsSummary();
        const historyData = await getExecutionHistory(5);
        const workflowsData = await getWorkflows();

        setStats(statsData);
        setHistory(historyData);
        setWorkflows(workflowsData);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  // Format chart data based on history
  const chartData = history
    .slice()
    .reverse()
    .map(h => ({
      name: h.started_at ? new Date(h.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Unknown',
      duration: h.duration_seconds || 0,
      steps: h.steps_completed || 0
    }));

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* Welcome Banner */}
      <div className="card-glass flex justify-between items-center relative overflow-hidden" style={{ padding: '24px 30px' }}>
        <div className="flex flex-col gap-1">
          <h1 className="sidebar-logo-text" style={{ fontSize: '24px', fontWeight: '800' }}>Welcome to Atlas</h1>
          <p className="text-muted" style={{ fontSize: '13.5px' }}>
            Your digital employee is online. Run workflows, chat with the AI assistant, or train new behaviors.
          </p>
        </div>
        <button onClick={() => navigate('/chat')} className="btn btn-primary">
          <Zap size={16} />
          <span>Ask Assistant</span>
        </button>
      </div>

      {/* Stats Cards Grid */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon indigo">
            <Zap size={20} />
          </div>
          <div>
            <div className="stat-value">{stats.total_executions}</div>
            <div className="stat-label">Total Executions</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <CheckCircle size={20} />
          </div>
          <div>
            <div className="stat-value">{stats.success_rate}%</div>
            <div className="stat-label">Success Rate</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <Clock size={20} />
          </div>
          <div>
            <div className="stat-value">{stats.avg_duration_seconds}s</div>
            <div className="stat-label">Avg. Duration</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon amber">
            <Database size={20} />
          </div>
          <div>
            <div className="stat-value">{workflows.length}</div>
            <div className="stat-label">Active Workflows</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
        {/* Execution Activity Chart */}
        <div className="card flex flex-col gap-3">
          <div className="card-header" style={{ marginBottom: 0 }}>
            <div>
              <div className="card-title">Execution Performance</div>
              <div className="card-subtitle">Duration and size of recent execution jobs</div>
            </div>
            <TrendingUp size={16} className="text-muted" />
          </div>
          <div className="divider" style={{ margin: '8px 0 16px' }} />
          <div style={{ width: '100%', height: '240px' }}>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorDuration" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--r-md)',
                      color: 'var(--text-primary)'
                    }}
                  />
                  <Area type="monotone" dataKey="duration" name="Duration (s)" stroke="var(--accent)" fillOpacity={1} fill="url(#colorDuration)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted">
                No recent activity logs to plot.
              </div>
            )}
          </div>
        </div>

        {/* Quick Workflows List */}
        <div className="card flex flex-col gap-3">
          <div className="card-header" style={{ marginBottom: 0 }}>
            <div>
              <div className="card-title">Quick Actions</div>
              <div className="card-subtitle">Launch standard automation tasks</div>
            </div>
          </div>
          <div className="divider" style={{ margin: '8px 0 16px' }} />
          <div className="flex flex-col gap-2">
            {workflows.slice(0, 4).map(wf => (
              <button
                key={wf.id}
                onClick={() => navigate('/chat', { state: { runWorkflowId: wf.id } })}
                className="btn btn-secondary justify-between w-full"
                style={{ textAlign: 'left' }}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <Play size={14} className="text-accent" />
                  <span className="text-ellipsis font-medium">{wf.name}</span>
                </div>
                <ChevronRight size={14} className="text-muted" />
              </button>
            ))}
            {workflows.length === 0 && (
              <div className="text-center py-6 text-muted text-sm flex flex-col items-center gap-2">
                <span>No workflows defined.</span>
                <Link to="/training" className="btn btn-secondary btn-sm">Create Workflow</Link>
              </div>
            )}
            {workflows.length > 4 && (
              <Link to="/library" className="btn btn-ghost btn-sm justify-center w-full">
                View All Workflows
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Recent Execution History Table */}
      <div className="card flex flex-col gap-3">
        <div className="card-header" style={{ marginBottom: 0 }}>
          <div>
            <div className="card-title">Recent Executions</div>
            <div className="card-subtitle">Real-time completion status of automated runs</div>
          </div>
          <Link to="/history" className="btn btn-ghost btn-sm">View Full History</Link>
        </div>
        <div className="divider" style={{ margin: '8px 0 16px' }} />

        <div className="overflow-hidden" style={{ borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Workflow Name</th>
                <th>Triggered At</th>
                <th>Duration</th>
                <th>Steps</th>
                <th>Status</th>
                <th>Report</th>
              </tr>
            </thead>
            <tbody>
              {history.map(run => (
                <tr key={run.execution_id}>
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
                    {run.report_path ? (
                      <span className="text-accent flex items-center gap-1">
                        <FileSpreadsheet size={14} /> Available
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-muted" style={{ padding: '30px' }}>
                    No execution history. Run a workflow using the AI assistant or Training mode.
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
