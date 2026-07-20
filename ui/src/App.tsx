import React, { useState, useEffect } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  Library,
  PenTool,
  History,
  FileCode,
  FileSpreadsheet,
  Settings,
  Puzzle,
  Database,
  Terminal,
  Activity,
  LogOut,
  ChevronRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

// Pages
import DashboardPage from './pages/DashboardPage';
import ChatPage from './pages/ChatPage';
import WorkflowLibraryPage from './pages/WorkflowLibraryPage';
import TrainingModePage from './pages/TrainingModePage';
import HistoryPage from './pages/HistoryPage';
import LogsPage from './pages/LogsPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import PluginManagerPage from './pages/PluginManagerPage';
import BackupManagerPage from './pages/BackupManagerPage';

// API Client Import
import { getSystemInfo } from './api/client';

function AppShell() {
  const location = useLocation();
  const [backendStatus, setBackendStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [systemInfo, setSystemInfo] = useState<any>(null);

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const info = await getSystemInfo();
        setSystemInfo(info);
        setBackendStatus('connected');
      } catch (err) {
        setBackendStatus('disconnected');
      }
    };

    checkBackend();
    const interval = setInterval(checkBackend, 5000);
    return () => clearInterval(interval);
  }, []);

  const menuItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard, section: 'core' },
    { label: 'AI Assistant', path: '/chat', icon: MessageSquare, section: 'core' },
    { label: 'Workflow Library', path: '/library', icon: Library, section: 'automation' },
    { label: 'Training Mode', path: '/training', icon: PenTool, section: 'automation' },
    { label: 'Execution History', path: '/history', icon: History, section: 'monitor' },
    { label: 'System Logs', path: '/logs', icon: Terminal, section: 'monitor' },
    { label: 'Generated Reports', path: '/reports', icon: FileSpreadsheet, section: 'data' },
    { label: 'Backup Manager', path: '/backups', icon: Database, section: 'system' },
    { label: 'Plugin Manager', path: '/plugins', icon: Puzzle, section: 'system' },
    { label: 'Settings', path: '/settings', icon: Settings, section: 'system' },
  ];

  return (
    <div className="app-shell animate-fade-in">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <Activity size={18} className="text-white" />
          </div>
          <span className="sidebar-logo-text">ATLAS</span>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Core</div>
          {menuItems.filter(i => i.section === 'core').map(item => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} className={`nav-item ${active ? 'active' : ''}`}>
                <Icon className="nav-icon" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <div className="nav-section-label">Automation</div>
          {menuItems.filter(i => i.section === 'automation').map(item => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} className={`nav-item ${active ? 'active' : ''}`}>
                <Icon className="nav-icon" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <div className="nav-section-label">Monitor & Data</div>
          {menuItems.filter(i => i.section === 'monitor' || i.section === 'data').map(item => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} className={`nav-item ${active ? 'active' : ''}`}>
                <Icon className="nav-icon" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <div className="nav-section-label">System</div>
          {menuItems.filter(i => i.section === 'system').map(item => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} className={`nav-item ${active ? 'active' : ''}`}>
                <Icon className="nav-icon" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="flex items-center gap-2 p-2 text-xs text-muted">
            <ShieldCheck size={12} className={backendStatus === 'connected' ? 'text-success' : 'text-error'} />
            <span className="text-ellipsis">
              {backendStatus === 'connected' ? 'Engine Connected' : 'Offline'}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <main className="main-content">
        {/* Top Header */}
        <header className="header-bar">
          <div className="header-title">
            {menuItems.find(i => i.path === location.pathname)?.label || 'Atlas Platform'}
          </div>
          <div className="flex items-center gap-3">
            <div className={`header-badge ${backendStatus === 'connected' ? 'success' : 'error'}`}>
              <span className={`status-dot ${backendStatus === 'connecting' ? 'pulse' : ''}`} />
              <span>{backendStatus === 'connected' ? 'ACTIVE' : 'DISCONNECTED'}</span>
            </div>
            {systemInfo?.offline_mode && (
              <div className="header-badge warning">
                <span>OFFLINE MODE</span>
              </div>
            )}
          </div>
        </header>

        {/* Page Routing */}
        <div className="page-content">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/library" element={<WorkflowLibraryPage />} />
            <Route path="/training" element={<TrainingModePage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/logs" element={<LogsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/backups" element={<BackupManagerPage />} />
            <Route path="/plugins" element={<PluginManagerPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppShell />
    </HashRouter>
  );
}
