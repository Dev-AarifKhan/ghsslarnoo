import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, X, Eye } from 'lucide-react';
import { Header } from './components/Header';
import { SidebarNav } from './components/SidebarNav';
import { LoginScreen } from './components/LoginScreen';
import { DashboardView } from './components/DashboardView';
import { EnrollmentView } from './components/EnrollmentView';
import { QRGeneratorView } from './components/QRGeneratorView';
import { QRScannerView } from './components/QRScannerView';
import { ManualAttendanceView } from './components/ManualAttendanceView';
import { StudentViewer } from './components/StudentViewer';
import { ReportsView } from './components/ReportsView';
import { StudentIDCardView } from './components/StudentIDCardView';
import { SettingsView } from './components/SettingsView';
import { AuditLogsView } from './components/AuditLogsView';

import {
  Student,
  AttendanceRecord,
  ActivityLog,
  AppSettings,
  UserSession,
  SyncStatus,
  AttendanceStatus,
  ThemePreset,
} from './types';

import {
  getSettings,
  saveSettings,
  getSession,
  saveSession,
  getStudents,
  saveStudents,
  addStudent,
  addStudentsBulk,
  updateStudent,
  deleteStudent,
  deleteStudentsBulk,
  getAttendanceRecords,
  saveAttendanceRecords,
  markAttendance,
  markAttendanceBatch,
  getLogs,
  initPasswordRealtimeSync,
} from './services/storage';

import {
  subscribeToAttendance,
  subscribeToStudents,
  saveStudentsBatchToFirestore,
} from './services/firebase';

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(getSettings());
  const [session, setSession] = useState<UserSession>(getSession());
  const [students, setStudents] = useState<Student[]>(getStudents());
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(getAttendanceRecords());
  const [logs, setLogs] = useState<ActivityLog[]>(getLogs());

  const [activeTab, setActiveTab] = useState<string>('dashboard');

  const [syncModalInfo, setSyncModalInfo] = useState<{
    isOpen: boolean;
    isSyncing: boolean;
    message?: string;
    syncedCount?: number;
    error?: string | null;
  } | null>(null);

  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    lastSyncTime: null,
    pendingCount: 0,
    isSyncing: false,
    error: null,
  });

  // Reload data from storage
  const reloadData = () => {
    setStudents(getStudents());
    setAttendance(getAttendanceRecords());
    setLogs(getLogs());
    setSettings(getSettings());
  };

  // Real-time Cloud Firestore listeners (Instant sync across scanner devices)
  useEffect(() => {
    const unsubscribeAttendance = subscribeToAttendance(
      (updatedRecords) => {
        const validRecords = updatedRecords || [];
        setAttendance(validRecords);
        saveAttendanceRecords(validRecords);
        setSyncStatus((prev) => ({
          ...prev,
          lastSyncTime: new Date().toLocaleTimeString(),
          isSyncing: false,
          pendingCount: 0,
          error: null,
        }));
      },
      (id) => students.find((s) => s.id.toLowerCase() === id.toLowerCase())
    );

    const unsubscribeStudents = subscribeToStudents(
      (updatedStudents) => {
        console.log(`[App Realtime Students] Received live Firestore update with ${updatedStudents?.length || 0} student(s)`);
        const validList = updatedStudents || [];
        setStudents(validList);
        saveStudents(validList);
      },
      (error) => {
        console.error('[App Realtime Students Error] Error receiving student snapshot:', error);
      }
    );

    // Real-time Central Password Synchronization listener across all devices
    const unsubscribePassword = initPasswordRealtimeSync((newRemotePassword) => {
      console.log('[App Realtime Security] Central password updated in Firestore.');
      const currentSession = getSession();
      if (
        currentSession.isLoggedIn &&
        currentSession.role !== 'Guest' &&
        currentSession.loginPassword &&
        currentSession.loginPassword !== newRemotePassword
      ) {
        const invalidatedSession: UserSession = {
          ...currentSession,
          isAuthenticated: false,
          isLoggedIn: false,
        };
        saveSession(invalidatedSession);
        setSession(invalidatedSession);
        alert('🔐 Security Alert: Your account password was updated on another device. Please log in with your new password.');
      }
    });

    return () => {
      unsubscribeAttendance();
      unsubscribeStudents();
      unsubscribePassword();
    };
  }, []);

  // Listen for local cross-tab / cross-window updates
  useEffect(() => {
    const handleStorageChange = () => reloadData();
    window.addEventListener('storage', handleStorageChange);

    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        bc = new BroadcastChannel('attendance_app_sync');
        bc.onmessage = () => reloadData();
      } catch (e) {
        // Ignore BroadcastChannel errors
      }
    }

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (bc) bc.close();
    };
  }, []);

  // Sync handler (Real-time Cloud Firestore Refresh)
  const handleSync = async (isUserTrigger: boolean = true) => {
    if (isUserTrigger) {
      setSyncModalInfo({
        isOpen: true,
        isSyncing: true,
        message: 'Refreshing real-time synchronization with Firebase Cloud Firestore...',
      });
    }

    setSyncStatus((prev) => ({ ...prev, isSyncing: true }));
    try {
      reloadData();
      setTimeout(() => {
        setSyncStatus({
          lastSyncTime: new Date().toLocaleTimeString(),
          pendingCount: 0,
          isSyncing: false,
          error: null,
        });

        if (isUserTrigger) {
          setSyncModalInfo({
            isOpen: true,
            isSyncing: false,
            message: 'All records are live and synchronized with Firebase Cloud Firestore in real-time!',
            syncedCount: attendance.length,
            error: null,
          });
        }
      }, 500);
    } catch (err: any) {
      console.error('Error during Firestore sync:', err);
      setSyncStatus((prev) => ({
        ...prev,
        isSyncing: false,
        error: err?.message || 'Failed to sync with Cloud Firestore.',
      }));
      if (isUserTrigger) {
        setSyncModalInfo({
          isOpen: true,
          isSyncing: false,
          error: err?.message || 'Sync failed',
          message: 'Error connecting to Cloud Firestore',
        });
      }
    }
  };

  // Handle Login
  const handleLoginSuccess = (newSession: UserSession) => {
    setSession(newSession);
    saveSession(newSession);
  };

  // Handle Direct Logout
  const handleLogout = () => {
    const updatedSession: UserSession = {
      ...session,
      isLoggedIn: false,
    };
    setSession(updatedSession);
    saveSession(updatedSession);
  };

  const currentTheme: ThemePreset = settings.themePreset || (settings.darkMode ? 'dark' : 'light');

  // Toggle Theme (cycles through available presets)
  const handleToggleTheme = () => {
    const presets: ThemePreset[] = ['dark', 'light', 'slate', 'midnight', 'emerald', 'sunset'];
    const currentIndex = presets.indexOf(currentTheme);
    const nextPreset = presets[(currentIndex + 1) % presets.length];
    const isDark = nextPreset !== 'light' && nextPreset !== 'slate';
    const updated: AppSettings = {
      ...settings,
      themePreset: nextPreset,
      darkMode: isDark,
    };
    setSettings(updated);
    saveSettings(updated);
  };

  // Select Specific Theme
  const handleSelectTheme = (preset: ThemePreset) => {
    const isDark = preset !== 'light' && preset !== 'slate';
    const updated: AppSettings = {
      ...settings,
      themePreset: preset,
      darkMode: isDark,
    };
    setSettings(updated);
    saveSettings(updated);
  };

  // Add Student Handler
  const handleAddStudent = (newStudent: Student) => {
    if (session.role === 'Guest') {
      alert('Read-Only Mode: Guest users cannot add new students. Please log in as a Teacher.');
      return { success: false, message: 'Read-Only Mode: Guest users cannot perform modifications.' };
    }
    const result = addStudent(newStudent);
    if (result.success) {
      reloadData();
    }
    return result;
  };

  // Bulk Add Students Handler (Excel Import)
  const handleBulkAddStudents = async (newStudents: Student[]) => {
    if (session.role === 'Guest') {
      alert('Read-Only Mode: Guest users cannot import students. Please log in as a Teacher.');
      return { added: 0, updated: 0, total: 0, syncMessage: 'Read-Only Mode' };
    }
    const result = addStudentsBulk(newStudents);
    reloadData();

    return {
      added: result.added,
      updated: result.updated,
      total: result.total,
      syncMessage: 'Synced to Firebase Cloud Firestore',
    };
  };

  // Update Student Handler
  const handleUpdateStudent = (updatedStudent: Student) => {
    if (session.role === 'Guest') {
      alert('Read-Only Mode: Guest users cannot edit student profiles. Please log in as a Teacher.');
      return { success: false, message: 'Read-Only Mode' };
    }
    const result = updateStudent(updatedStudent);
    if (result.success) {
      reloadData();
    }
    return result;
  };

  // Delete Student Handler
  const handleDeleteStudent = (studentId: string) => {
    if (session.role === 'Guest') {
      alert('Read-Only Mode: Guest users cannot delete students. Please log in as a Teacher.');
      return { success: false, message: 'Read-Only Mode' };
    }
    const result = deleteStudent(studentId);
    if (result.success) reloadData();
    return result;
  };

  // Bulk Delete Students Handler
  const handleBulkDeleteStudents = (studentIds: string[]) => {
    if (session.role === 'Guest') {
      alert('Read-Only Mode: Guest users cannot delete students. Please log in as a Teacher.');
      return { success: false, message: 'Read-Only Mode' };
    }
    const result = deleteStudentsBulk(studentIds);
    if (result.success) reloadData();
    return result;
  };

  // Mark Attendance Handler
  const handleMarkAttendance = (
    studentId: string,
    status: AttendanceStatus = 'Present',
    date?: string,
    time?: string,
    remarks?: string
  ) => {
    if (session.role === 'Guest') {
      alert('Read-Only Mode: Guest users cannot mark attendance. Please log in as a Teacher.');
      return { success: false, record: null, isDuplicate: false, message: 'Read-Only Mode' };
    }
    const result = markAttendance(studentId, status, date, time, remarks);
    reloadData();
    return result;
  };

  // Mark Attendance Batch Handler (Instant bulk marking for 250+ students)
  const handleMarkAttendanceBatch = (
    items: Array<{
      studentId: string;
      status: AttendanceStatus;
      date?: string;
      time?: string;
      remarks?: string;
    }>
  ) => {
    if (session.role === 'Guest') {
      alert('Read-Only Mode: Guest users cannot mark attendance. Please log in as a Teacher.');
      return { success: false, markedCount: 0, updatedCount: 0, message: 'Read-Only Mode' };
    }
    const result = markAttendanceBatch(items);
    reloadData();
    return result;
  };

  // Save Settings Handler
  const handleSaveSettings = (newSettings: AppSettings) => {
    if (session.role === 'Guest') {
      alert('Read-Only Mode: Guest users cannot modify school settings. Please log in as a Teacher.');
      return;
    }
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  if (!session.isLoggedIn) {
    return (
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
        defaultTeacherName={settings.teacherName}
        defaultSchoolName={settings.schoolName}
      />
    );
  }

  const themeContainerClass =
    currentTheme === 'light'
      ? 'bg-slate-50 text-slate-900 theme-light'
      : currentTheme === 'slate'
      ? 'bg-slate-100 text-slate-800 theme-slate'
      : currentTheme === 'midnight'
      ? 'bg-[#0a0f1d] text-slate-100 theme-midnight'
      : currentTheme === 'emerald'
      ? 'bg-[#051a14] text-emerald-50 theme-emerald'
      : currentTheme === 'sunset'
      ? 'bg-[#180e19] text-rose-100 theme-sunset'
      : 'bg-[#080808] text-gray-200 theme-dark';

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-300 selection:bg-cyan-500/30 selection:text-cyan-200 ${themeContainerClass}`}>
      {/* Top Application Header */}
      <Header
        settings={settings}
        session={session}
        syncStatus={syncStatus}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onSync={handleSync}
        onToggleTheme={handleToggleTheme}
        onSelectTheme={handleSelectTheme}
        onLogout={handleLogout}
      />

      {/* Guest Read-Only Mode Banner */}
      {session.role === 'Guest' && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 text-amber-200 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
            <Eye className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="flex-1">
              <strong>Guest Read-Only Mode:</strong> You are viewing website content as a guest. All reports, student records, and logs are in read-only mode.
            </span>
            <button
              onClick={handleLogout}
              className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-100 rounded-lg text-xs font-bold transition-all shrink-0 ml-2"
            >
              Log In as Teacher
            </button>
          </div>
        </div>
      )}

      {/* Main Content Layout with Sidebar */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex flex-col md:flex-row">
        <SidebarNav
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          pendingSyncCount={syncStatus.pendingCount}
          onToggleTheme={handleToggleTheme}
          currentTheme={currentTheme}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              students={students}
              attendance={attendance}
              syncStatus={syncStatus}
              settings={settings}
              onSelectTab={setActiveTab}
              onSync={handleSync}
            />
          )}

          {activeTab === 'scanner' && (
            <QRScannerView
              students={students}
              onMarkAttendance={handleMarkAttendance}
              onSelectTab={setActiveTab}
            />
          )}

          {activeTab === 'enrollment' && (
            <EnrollmentView
              students={students}
              onAddStudent={handleAddStudent}
              onBulkAddStudents={handleBulkAddStudents}
              onUpdateStudent={handleUpdateStudent}
              onDeleteStudent={handleDeleteStudent}
              onBulkDeleteStudents={handleBulkDeleteStudents}
              onSelectTab={setActiveTab}
            />
          )}

          {activeTab === 'idcards' && (
            <StudentIDCardView
              students={students}
              settings={settings}
              onUpdateStudent={handleUpdateStudent}
            />
          )}

          {activeTab === 'qrcards' && (
            <QRGeneratorView students={students} settings={settings} />
          )}

          {activeTab === 'manual' && (
            <ManualAttendanceView
              students={students}
              attendance={attendance}
              onMarkAttendance={handleMarkAttendance}
              onMarkAttendanceBatch={handleMarkAttendanceBatch}
            />
          )}

          {activeTab === 'viewer' && (
            <StudentViewer students={students} attendance={attendance} settings={settings} />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              students={students}
              attendance={attendance}
              onMarkAttendance={handleMarkAttendance}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              settings={settings}
              logs={logs}
              onSaveSettings={handleSaveSettings}
              onReloadData={reloadData}
            />
          )}

          {activeTab === 'logs' && <AuditLogsView logs={logs} />}
        </main>
      </div>

      {/* Bottom Status Footer */}
      <footer className="h-10 bg-[#050505] border-t border-white/5 px-6 md:px-10 flex items-center justify-between text-[10px] text-gray-500 uppercase tracking-[0.2em] font-medium shrink-0">
        <div>&copy; {new Date().getFullYear()} Govt. Higher Secondary School Larnoo</div>
        <div className="hidden sm:block">Developer: Aarif Ahmad Khan</div>
        <div>Email: ghsslarnoo@gmail.com</div>
      </footer>

      {/* Sync Status Feedback Modal */}
      {syncModalInfo && syncModalInfo.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#111111] border border-white/10 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <RefreshCw className={`w-5 h-5 text-cyan-400 ${syncModalInfo.isSyncing ? 'animate-spin' : ''}`} />
                <h3 className="text-base font-bold text-white">Cloud Firestore Synchronization</h3>
              </div>
              {!syncModalInfo.isSyncing && (
                <button
                  onClick={() => setSyncModalInfo(null)}
                  className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {syncModalInfo.isSyncing ? (
              <div className="py-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto">
                  <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
                </div>
                <p className="text-sm text-gray-200 font-medium">Connecting with Firebase Cloud Firestore...</p>
                <p className="text-xs text-gray-400">Synchronizing real-time vocational attendance records.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-3 bg-[#1a1a1a] border border-white/5 rounded-2xl p-4">
                  {syncModalInfo.error ? (
                    <AlertCircle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-white">
                      {syncModalInfo.error ? 'Firestore Sync Notice' : 'Real-Time Sync Active'}
                    </h4>
                    <p className="text-xs text-gray-300 leading-relaxed">
                      {syncModalInfo.message || 'Operation completed.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end pt-2">
                  <button
                    onClick={() => setSyncModalInfo(null)}
                    className="px-5 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
