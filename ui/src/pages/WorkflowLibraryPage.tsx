import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getWorkflows, deleteWorkflow, duplicateWorkflow, Workflow } from '../api/client';
import {
  Play,
  Edit2,
  Copy,
  Trash2,
  Plus,
  Search,
  Tag,
  Clock,
  Code
} from 'lucide-react';

export default function WorkflowLibraryPage() {
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    setLoading(true);
    try {
      const data = await getWorkflows();
      setWorkflows(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await duplicateWorkflow(id);
      loadWorkflows();
    } catch (err) {
      alert('Failed to duplicate workflow');
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to archive this workflow?')) {
      try {
        await deleteWorkflow(id);
        loadWorkflows();
      } catch (err) {
        alert('Failed to archive workflow');
      }
    }
  };

  const filteredWorkflows = workflows.filter(wf =>
    wf.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    wf.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    wf.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* Header bar actions */}
      <div className="flex justify-between items-center gap-4">
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search workflows by name, tags, description..."
            className="form-input"
            style={{ paddingLeft: '36px' }}
          />
          <Search size={16} className="text-muted" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
        </div>
        <button
          onClick={() => navigate('/training', { state: { editWorkflowId: null } })}
          className="btn btn-primary"
        >
          <Plus size={16} />
          <span>New Workflow</span>
        </button>
      </div>

      {/* Grid List */}
      <div className="workflow-grid">
        {filteredWorkflows.map(wf => (
          <div
            key={wf.id}
            onClick={() => navigate('/training', { state: { editWorkflowId: wf.id } })}
            className="workflow-card"
          >
            <div className="flex justify-between items-start gap-2">
              <span className="workflow-card-name">{wf.name}</span>
              <span className="text-xs text-muted">v{wf.version}</span>
            </div>

            <p className="workflow-card-desc">{wf.description}</p>

            <div className="tag-list">
              {wf.tags.map(t => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
            </div>

            <div className="divider" style={{ margin: '8px 0' }} />

            <div className="workflow-card-meta">
              <span className="text-xs text-muted flex items-center gap-1">
                <Code size={12} /> {wf.steps_count} steps
              </span>
              <div className="flex gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/chat', { state: { runWorkflowId: wf.id } });
                  }}
                  className="btn btn-secondary btn-icon btn-sm"
                  data-tooltip="Execute Run"
                >
                  <Play size={12} className="text-success" />
                </button>
                <button
                  onClick={(e) => handleDuplicate(wf.id, e)}
                  className="btn btn-secondary btn-icon btn-sm"
                  data-tooltip="Duplicate"
                >
                  <Copy size={12} />
                </button>
                <button
                  onClick={(e) => handleDelete(wf.id, e)}
                  className="btn btn-secondary btn-icon btn-sm btn-danger"
                  data-tooltip="Archive"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          </div>
        ))}

        {filteredWorkflows.length === 0 && (
          <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
            <div className="empty-state-icon">
              <Search size={24} />
            </div>
            <div className="empty-state-title">No workflows found</div>
            <div className="empty-state-desc">Try modifying your search or create a new workflow using Training Mode.</div>
          </div>
        )}
      </div>
    </div>
  );
}
