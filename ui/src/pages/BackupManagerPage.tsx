import React, { useState, useEffect } from 'react';
import { getBackups, createBackup, createBlankCopy } from '../api/client';
import { Database, Download, ShieldCheck, FolderPlus, HelpCircle, FileText, CheckCircle2 } from 'lucide-react';

export default function BackupManagerPage() {
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [backingUp, setBackingUp] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [cloneDest, setCloneDest] = useState('');

  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = async () => {
    setLoading(true);
    try {
      const data = await getBackups();
      setBackups(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleBackupNow = async () => {
    setBackingUp(true);
    try {
      await createBackup();
      alert('Backup process started in background.');
      setTimeout(loadBackups, 3000);
    } catch (err) {
      alert('Failed to start backup');
    } finally {
      setBackingUp(false);
    }
  };

  const handleCreateBlankCopy = async () => {
    setCloning(true);
    try {
      const res = await createBlankCopy(cloneDest || undefined);
      alert(`Blank Project Copy initiated! Saved to:\n${res.destination}`);
      setCloneDest('');
    } catch (err: any) {
      alert('Failed to clone: ' + err.message);
    } finally {
      setCloning(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '16px' }} className="animate-fade-in">
      {/* Create Blank Copy Panel */}
      <div className="card flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <FolderPlus size={16} className="text-accent" />
          <span className="card-title">Clone Blank Project Copy</span>
        </div>
        <div className="divider" style={{ margin: '4px 0' }} />
        <p className="text-xs text-muted" style={{ lineHeight: '1.6' }}>
          When clicked, this creates a complete copy of Atlas ready to open in Antigravity for future upgrades.
          <br /><br />
          <strong>Automatically removes:</strong>
          <span className="block mt-1 text-accent font-medium">
            ✓ SQLite database tables<br />
            ✓ Downloaded logs & reports<br />
            ✓ Session authentication caches<br />
            ✓ API keys & secrets (.env)<br />
          </span>
        </p>

        <div className="form-group mt-2">
          <label className="form-label text-xs">Destination Folder (Optional)</label>
          <input
            type="text"
            value={cloneDest}
            onChange={e => setCloneDest(e.target.value)}
            placeholder="e.g. D:\Atlas-Dev-Blank"
            className="form-input text-xs"
          />
        </div>

        <button onClick={handleCreateBlankCopy} disabled={cloning} className="btn btn-primary justify-center w-full mt-2">
          {cloning ? 'Cloning Clean Scaffold...' : 'Create Blank Project Copy'}
        </button>
      </div>

      {/* Backups List Panel */}
      <div className="card flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <span className="card-title flex items-center gap-2">
            <Database size={16} className="text-accent" />
            <span>Database Backups</span>
          </span>
          <button onClick={handleBackupNow} disabled={backingUp} className="btn btn-secondary btn-sm">
            {backingUp ? 'Backing Up...' : 'Backup Database Now'}
          </button>
        </div>
        <div className="divider" style={{ margin: '4px 0' }} />

        <div className="overflow-hidden" style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Backup Name</th>
                <th>File Size</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((bak, idx) => (
                <tr key={idx}>
                  <td className="font-mono text-xs">{bak.backup_name}</td>
                  <td>{formatBytes(bak.size_bytes)}</td>
                  <td className="text-muted">
                    {new Date(bak.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {backups.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center text-muted" style={{ padding: '24px' }}>
                    No automated backups found. Click "Backup Database Now" to generate one.
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
