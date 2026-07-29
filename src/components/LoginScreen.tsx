import React, { useState } from 'react';
import { QrCode, Lock, User, ShieldCheck, AlertCircle, KeyRound, CheckCircle2, Eye } from 'lucide-react';
import { UserSession } from '../types';
import { verifyUserPassword, setUserPassword, getUserPassword, saveSavedLogin } from '../services/storage';

interface LoginScreenProps {
  onLoginSuccess: (session: UserSession) => void;
  defaultTeacherName: string;
  defaultSchoolName: string;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  defaultTeacherName,
  defaultSchoolName,
}) => {
  // Username & Password MUST start blank by default per user security request
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'Teacher' | 'Admin'>('Teacher');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Reset password modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }

    const isValid = verifyUserPassword(password);
    const un = username.trim().toLowerCase();
    const teacherLower = (defaultTeacherName || 'aarif ahmad khan').toLowerCase();

    // Accept teacher name, partial instructor name, or standard handles
    const isAllowedUser =
      un === teacherLower ||
      un.includes('aarif') ||
      un.includes('khan') ||
      un === 'teacher' ||
      un === 'admin';

    if (isAllowedUser && isValid) {
      if (rememberMe) {
        saveSavedLogin({
          username: username.trim(),
          password: password.trim(),
          role: role,
          rememberMe: true,
        });
      } else {
        saveSavedLogin(null);
      }

      const session: UserSession = {
        username: username.trim(),
        teacherName: defaultTeacherName || 'Aarif Ahmad Khan',
        schoolName: defaultSchoolName,
        role: role,
        isAuthenticated: true,
        isLoggedIn: true,
      };
      onLoginSuccess(session);
    } else {
      setError('Invalid username or password. Please check your credentials or click "Update Password?" if needed.');
    }
  };

  const handleGuestLogin = () => {
    const guestSession: UserSession = {
      username: 'Guest Visitor',
      teacherName: 'Guest User',
      schoolName: defaultSchoolName,
      role: 'Guest',
      isAuthenticated: true,
      isLoggedIn: true,
    };
    onLoginSuccess(guestSession);
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);

    if (!verifyUserPassword(oldPass)) {
      setResetError('Old / Current password is incorrect.');
      return;
    }

    if (!newPass.trim()) {
      setResetError('Please enter a new password.');
      return;
    }
    if (newPass.length < 4) {
      setResetError('Password must be at least 4 characters.');
      return;
    }
    if (newPass !== confirmPass) {
      setResetError('Passwords do not match.');
      return;
    }

    setUserPassword(newPass);
    setShowResetModal(false);
    setSuccessMsg('Password updated successfully! You can now log in with your new password.');
    setPassword(newPass);
    setOldPass('');
    setNewPass('');
    setConfirmPass('');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-blue-900/20 text-white">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30 ring-4 ring-blue-500/20">
            <QrCode className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Vocational Attendance System</h1>
          <p className="text-xs text-blue-400 font-semibold mt-1">Vocational Subject IT / ITES</p>
          <p className="text-xs text-slate-400 mt-2">{defaultSchoolName}</p>
        </div>

        {successMsg && (
          <div className="mb-6 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {error && (
          <div className="mb-6 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Role</label>
            <button
              type="button"
              onClick={() => setRole('Teacher')}
              className="w-full py-2.5 px-4 text-xs font-semibold rounded-xl border bg-blue-600 border-blue-500 text-white shadow-md transition-all flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              Vocational Teacher
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Username (Instructor Name)
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={`e.g. ${defaultTeacherName || 'Aarif Ahmad Khan'}`}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500 transition-colors font-medium"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-blue-500"
              />
              <span>Remember me</span>
            </label>
            <button
              type="button"
              onClick={() => {
                setShowResetModal(true);
                setResetError(null);
              }}
              className="text-cyan-400 hover:underline flex items-center gap-1 text-[11px] font-semibold"
            >
              <KeyRound className="w-3 h-3" />
              <span>Update Password?</span>
            </button>
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-600/30 active:scale-95 transition-all text-xs uppercase tracking-wider"
          >
            Authenticate & Access App
          </button>
        </form>

        {/* Guest Read-Only Access */}
        <div className="mt-6 pt-6 border-t border-slate-800 text-center">
          <div className="relative flex py-1 items-center mb-4">
            <div className="flex-grow border-t border-slate-800"></div>
            <span className="flex-shrink mx-3 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Or Explore Without Credentials
            </span>
            <div className="flex-grow border-t border-slate-800"></div>
          </div>

          <button
            type="button"
            onClick={handleGuestLogin}
            className="w-full py-3 px-4 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 hover:border-cyan-500/50 text-cyan-300 hover:text-cyan-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2.5 shadow-md active:scale-95"
          >
            <Eye className="w-4 h-4 text-cyan-400" />
            <span>Continue as Guest (Read Only)</span>
          </button>
          <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
            Guest mode allows viewing attendance reports, dashboard, and student records in read-only mode.
          </p>
        </div>
      </div>

      {/* Password Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 rounded-3xl p-6 sm:p-8 max-w-md w-full text-white shadow-2xl relative">
            <div className="flex items-center space-x-3 mb-6 border-b border-white/10 pb-4">
              <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl text-cyan-400">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Update Account Password</h3>
                <p className="text-xs text-gray-400">Security credential management for Vocational Teacher</p>
              </div>
            </div>

            {resetError && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{resetError}</span>
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Old / Current Password</label>
                <input
                  type="password"
                  value={oldPass}
                  onChange={(e) => setOldPass(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="Enter new security password"
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  placeholder="Re-enter new security password"
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-cyan-950/50 transition-all"
                >
                  Save New Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
