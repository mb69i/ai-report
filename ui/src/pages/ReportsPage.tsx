import React, { useState, useEffect } from 'react';
import { getReports, deleteReport, getReportDownloadUrl, ReportRecord } from '../api/client';
import { FileSpreadsheet, FileText, Download, Trash2, Calendar, HardDrive } from 'lucide-react';

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    try {
      const data = await getReports();
      setReports(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this report?')) {
      try {
        await deleteReport(id);
        loadReports();
      } catch (err) {
        alert('Failed to delete report');
      }
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
    <div className="flex flex-col gap-4 animate-fade-in">
      <div className="card flex flex-col gap-3" style={{ padding: 0 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }} className="flex justify-between items-center">
          <span className="font-bold">Generated Audit Reports</span>
        </div>

        <div className="overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Report File</th>
                <th>Format</th>
                <th>File Size</th>
                <th>Generated At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map(rep => (
                <tr key={rep.report_id}>
                  <td className="font-medium">
                    <div className="flex items-center gap-2">
                      {rep.format === 'excel' ? (
                        <FileSpreadsheet className="text-success" size={16} />
                      ) : (
                        <FileText className="text-accent" size={16} />
                      )}
                      <span>{rep.name}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${rep.format === 'excel' ? 'completed' : 'running'}`}>
                      {rep.format.toUpperCase()}
                    </span>
                  </td>
                  <td className="text-muted">{formatBytes(rep.file_size_bytes)}</td>
                  <td className="text-muted">
                    {new Date(rep.created_at).toLocaleString()}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <a
                        href={getReportDownloadUrl(rep.report_id)}
                        className="btn btn-secondary btn-icon btn-sm"
                        download
                      >
                        <Download size={12} />
                      </a>
                      <button
                        onClick={() => handleDelete(rep.report_id)}
                        className="btn btn-secondary btn-icon btn-sm btn-danger"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {reports.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted" style={{ padding: '30px' }}>
                    No reports generated yet. Execute a workflow and request a report from the AI chat.
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
