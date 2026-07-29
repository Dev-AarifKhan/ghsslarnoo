import React, { useState } from 'react';
import {
  Settings,
  School,
  User,
  FileSpreadsheet,
  Download,
  Upload,
  RefreshCw,
  Volume2,
  ShieldCheck,
  Moon,
  Sun,
  Palette,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  History,
  KeyRound,
  Lock,
} from 'lucide-react';
import { AppSettings, ActivityLog } from '../types';
import { exportDatabaseJSON, importDatabaseJSON, verifyUserPassword, setUserPassword, clearAllData } from '../services/storage';

interface SettingsViewProps {
  settings: AppSettings;
  logs: ActivityLog[];
  onSaveSettings: (settings: AppSettings) => void;
  onReloadData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  logs,
  onSaveSettings,
  onReloadData,
}) => {
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Security password change state
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passError, setPassError] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    setFeedback('Settings updated successfully!');
    setTimeout(() => setFeedback(null), 3000);
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);
    setPassSuccess(null);

    if (!verifyUserPassword(currentPass)) {
      setPassError('Current password is incorrect.');
      return;
    }

    if (!newPass.trim() || newPass.length < 4) {
      setPassError('New password must be at least 4 characters long.');
      return;
    }

    if (newPass !== confirmPass) {
      setPassError('New password and confirm password do not match.');
      return;
    }

    setUserPassword(newPass);
    setPassSuccess('Account password updated successfully!');
    setCurrentPass('');
    setNewPass('');
    setConfirmPass('');
    setTimeout(() => setPassSuccess(null), 4000);
  };

  const handleExportBackup = () => {
    const jsonStr = exportDatabaseJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Vocational_Attendance_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = importDatabaseJSON(content);
      if (res.success) {
        setFeedback(res.message);
        onReloadData();
      } else {
        alert(res.message);
      }
    };
    reader.readAsText(file);
  };

  const handleClearData = () => {
    if (window.confirm('Are you sure you want to clear ALL local student records, attendance logs, and sync queues? This action cannot be undone.')) {
      clearAllData();
      setFeedback('All local test data and records have been cleared!');
      onReloadData();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 text-cyan-400" />
            System Settings & Firebase Firestore Backend
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Configure school branding, teacher credentials, theme preferences, and data backups.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold px-4 py-2.5 rounded-2xl text-xs shrink-0">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Firestore Real-Time Live</span>
        </div>
      </div>

      {feedback && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-2xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Settings Form */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md">
          <form onSubmit={handleSubmit} className="space-y-5 text-xs text-slate-200">
            <h2 className="text-sm font-bold text-slate-100 border-b border-slate-800 pb-2">
              🏫 School & Subject Information
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold mb-1">School Name</label>
                <input
                  type="text"
                  value={formData.schoolName}
                  onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Subject Name</label>
                <input
                  type="text"
                  value={formData.subjectName}
                  onChange={(e) => setFormData({ ...formData, subjectName: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold mb-1">Vocational Teacher / Instructor Name</label>
                <input
                  type="text"
                  value={formData.teacherName}
                  onChange={(e) => setFormData({ ...formData, teacherName: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>
            </div>

            <h2 className="text-sm font-bold text-slate-100 border-b border-slate-800 pb-2 pt-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              🔥 Firebase Cloud Firestore Database
            </h2>

            <div className="p-4 bg-slate-800/80 border border-slate-700 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-300">Database Engine:</span>
                <span className="text-emerald-400 font-mono font-bold">Google Cloud Firestore</span>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-300">Sync Strategy:</span>
                <span className="text-cyan-400 font-mono">Real-time WebSocket (`onSnapshot`)</span>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-300">Cross-Device Live Sync:</span>
                <span className="inline-flex items-center gap-1.5 text-emerald-300 text-[11px] font-bold bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Active & Connected
                </span>
              </div>
            </div>

            <h2 className="text-sm font-bold text-slate-100 border-b border-slate-800 pb-2 pt-3 flex items-center gap-2">
              <Palette className="w-4 h-4 text-cyan-400" />
              🎨 Website Theme & Appearance
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, themePreset: 'light', darkMode: false })}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  formData.themePreset === 'light' || (!formData.themePreset && !formData.darkMode)
                    ? 'bg-amber-950/40 border-amber-500 text-white font-bold ring-2 ring-amber-500/30'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                </div>
                <p className="text-xs font-bold text-white">Pure Light</p>
                <p className="text-[10px] text-slate-400">Clean White & Indigo</p>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, themePreset: 'slate', darkMode: false })}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  formData.themePreset === 'slate'
                    ? 'bg-sky-950/40 border-sky-500 text-white font-bold ring-2 ring-sky-500/30'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <Sun className="w-4 h-4 text-sky-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                </div>
                <p className="text-xs font-bold text-white">Slate Light</p>
                <p className="text-[10px] text-slate-400">Cool Slate & Steel Blue</p>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, themePreset: 'dark', darkMode: true })}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  formData.themePreset === 'dark' || (!formData.themePreset && formData.darkMode)
                    ? 'bg-cyan-950/40 border-cyan-500 text-white font-bold ring-2 ring-cyan-500/30'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <Moon className="w-4 h-4 text-cyan-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                </div>
                <p className="text-xs font-bold text-white">Cyber Dark</p>
                <p className="text-[10px] text-slate-400">Obsidian & Cyan</p>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, themePreset: 'midnight', darkMode: true })}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  formData.themePreset === 'midnight'
                    ? 'bg-indigo-950/40 border-indigo-500 text-white font-bold ring-2 ring-indigo-500/30'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <Palette className="w-4 h-4 text-indigo-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
                </div>
                <p className="text-xs font-bold text-white">Midnight Blue</p>
                <p className="text-[10px] text-slate-400">Deep Navy & Sapphire</p>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, themePreset: 'emerald', darkMode: true })}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  formData.themePreset === 'emerald'
                    ? 'bg-emerald-950/40 border-emerald-500 text-white font-bold ring-2 ring-emerald-500/30'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                </div>
                <p className="text-xs font-bold text-white">Emerald Forest</p>
                <p className="text-[10px] text-slate-400">Rich Forest & Mint</p>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, themePreset: 'sunset', darkMode: true })}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  formData.themePreset === 'sunset'
                    ? 'bg-rose-950/40 border-rose-500 text-white font-bold ring-2 ring-rose-500/30'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <Sparkles className="w-4 h-4 text-rose-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                </div>
                <p className="text-xs font-bold text-white">Sunset Rose</p>
                <p className="text-[10px] text-slate-400">Plum, Rose & Gold</p>
              </button>
            </div>



            <div className="pt-3">
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2.5 rounded-xl shadow-md text-xs transition-all uppercase tracking-wider"
              >
                Save Settings
              </button>
            </div>
          </form>
        </div>

        {/* Database Backup & Restore & Security */}
        <div className="space-y-6">
          {/* Security & Change Password Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md text-white">
            <h2 className="text-sm font-bold mb-2 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-cyan-400" />
              Security & Change Account Password
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Update your account password anytime. Changes apply immediately to subsequent logins.
            </p>

            {passError && (
              <div className="mb-3 p-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>{passError}</span>
              </div>
            )}

            {passSuccess && (
              <div className="mb-3 p-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{passSuccess}</span>
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-slate-300">Current Password</label>
                <input
                  type="password"
                  value={currentPass}
                  onChange={(e) => setCurrentPass(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-300">New Password</label>
                <input
                  type="password"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="Enter new password (min 4 chars)"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-300">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all shadow-md mt-2"
              >
                Update Password Now
              </button>
            </form>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md text-white">
            <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Local Database Backup & Restore
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Export all local students, attendance logs, and configuration to a JSON backup file.
            </p>

            <div className="space-y-3">
              <button
                onClick={handleExportBackup}
                className="w-full flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold py-2.5 rounded-xl text-xs transition-all"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Export JSON Backup</span>
              </button>

              <label className="w-full flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold py-2.5 rounded-xl text-xs cursor-pointer transition-all">
                <Upload className="w-4 h-4 text-blue-400" />
                <span>Restore JSON Backup</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportBackup}
                  className="hidden"
                />
              </label>

              <button
                onClick={handleClearData}
                type="button"
                className="w-full flex items-center justify-center space-x-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold py-2.5 rounded-xl text-xs transition-all mt-3"
              >
                <span>Clear All Local Data</span>
              </button>
            </div>
          </div>

          {/* Audit Activity Log */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md text-white">
            <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
              <History className="w-4 h-4 text-blue-400" />
              Recent Audit Activity Log
            </h2>

            <div className="max-h-56 overflow-y-auto space-y-2 text-xs pr-1">
              {logs.slice(0, 10).map((log) => (
                <div key={log.id} className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-200">
                    <span>{log.activity}</span>
                    <span className="text-[10px] text-slate-400">{log.time}</span>
                  </div>
                  {log.details && <p className="text-[10px] text-slate-400 mt-0.5">{log.details}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
