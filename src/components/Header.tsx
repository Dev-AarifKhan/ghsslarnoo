import React, { useState, useEffect } from 'react';
import {
  QrCode,
  RefreshCw,
  Wifi,
  WifiOff,
  Sun,
  Moon,
  Palette,
  Sparkles,
  LogOut,
  UserCheck,
  Building2,
  BookOpen,
  FileSpreadsheet,
} from 'lucide-react';
import { AppSettings, UserSession, SyncStatus, ThemePreset } from '../types';

interface HeaderProps {
  settings: AppSettings;
  session: UserSession;
  syncStatus: SyncStatus;
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onSync: () => void;
  onToggleTheme: () => void;
  onSelectTheme?: (theme: ThemePreset) => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  session,
  syncStatus,
  onSelectTab,
  onSync,
  onToggleTheme,
  onSelectTheme,
  onLogout,
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  const currentPreset: ThemePreset = settings.themePreset || (settings.darkMode ? 'dark' : 'light');

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-[#0a0a0a] text-white border-b border-white/10 shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Brand & Subject Title */}
          <div className="flex items-center space-x-3.5 cursor-pointer" onClick={() => onSelectTab('dashboard')}>
            <div className="w-10 h-10 rounded-lg bg-cyan-600 flex items-center justify-center font-bold text-white shadow-lg shadow-cyan-900/20">
              <QrCode className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-serif italic text-lg tracking-tight text-white font-medium">
                  {settings.schoolName || 'Govt. Vocational High School'}
                </span>
              </div>
              <p className="text-[10px] uppercase tracking-widest text-cyan-500 font-bold flex items-center gap-1">
                <BookOpen className="w-3 h-3 text-cyan-500" />
                {settings.subjectName || 'Vocational Attendance System • IT/ITES'}
              </p>
            </div>
          </div>

          {/* Center / Right Action Controls */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Quick Floating Camera QR Button */}
            <button
              onClick={() => onSelectTab('scanner')}
              className="flex items-center space-x-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold px-4 py-2 rounded-lg uppercase tracking-widest shadow-lg shadow-cyan-950/40 active:scale-95 transition-all"
              title="Open QR Camera Scanner"
            >
              <QrCode className="w-4 h-4 animate-pulse text-cyan-200" />
              <span className="hidden sm:inline">Scan QR</span>
            </button>

            {/* Firestore Real-Time Sync Indicator */}
            <button
              onClick={onSync}
              disabled={syncStatus.isSyncing}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 transition-all shadow-sm cursor-pointer"
              title="Firebase Firestore Real-Time Sync Active"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${syncStatus.isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">
                {syncStatus.isSyncing ? 'Refreshing...' : 'Firestore Live'}
              </span>
            </button>

            {/* Theme Switcher Button */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowThemeMenu(!showThemeMenu);
                  setShowProfileMenu(false);
                }}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#111] border border-white/10 text-gray-200 hover:bg-white/5 hover:border-cyan-500/30 transition-all shadow-sm"
                title="Change Theme / Appearance Preset"
              >
                {currentPreset === 'light' ? (
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                ) : currentPreset === 'slate' ? (
                  <Sun className="w-3.5 h-3.5 text-sky-400" />
                ) : currentPreset === 'emerald' ? (
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                ) : currentPreset === 'midnight' ? (
                  <Palette className="w-3.5 h-3.5 text-indigo-400" />
                ) : currentPreset === 'sunset' ? (
                  <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                ) : (
                  <Moon className="w-3.5 h-3.5 text-cyan-400" />
                )}
                <span className="hidden sm:inline capitalize font-bold text-gray-200">
                  {currentPreset === 'dark' ? 'Cyber' : currentPreset === 'light' ? 'Pure Light' : currentPreset === 'slate' ? 'Slate Light' : currentPreset === 'midnight' ? 'Navy' : currentPreset === 'sunset' ? 'Sunset' : 'Emerald'}
                </span>
              </button>

              {showThemeMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-[#111] border border-white/10 rounded-2xl shadow-2xl p-2 z-50 space-y-1 text-xs">
                  <div className="px-3 py-2 text-[10px] uppercase font-bold text-gray-400 tracking-wider border-b border-white/10 mb-1 flex items-center justify-between">
                    <span>Website Themes</span>
                    <Palette className="w-3.5 h-3.5 text-cyan-400" />
                  </div>

                  <div className="px-2 py-1 text-[9px] uppercase font-bold text-amber-400 tracking-wider">
                    ☀️ Light Themes
                  </div>

                  <button
                    onClick={() => {
                      if (onSelectTheme) onSelectTheme('light');
                      else onToggleTheme();
                      setShowThemeMenu(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-all ${
                      currentPreset === 'light'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold'
                        : 'hover:bg-white/5 text-gray-300'
                    }`}
                  >
                    <Sun className="w-4 h-4 text-amber-400 shrink-0" />
                    <div className="text-left">
                      <p className="font-semibold text-white">Pure Light</p>
                      <p className="text-[10px] text-gray-400">Clean White & Indigo</p>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      if (onSelectTheme) onSelectTheme('slate');
                      else onToggleTheme();
                      setShowThemeMenu(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-all ${
                      currentPreset === 'slate'
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold'
                        : 'hover:bg-white/5 text-gray-300'
                    }`}
                  >
                    <Sun className="w-4 h-4 text-sky-400 shrink-0" />
                    <div className="text-left">
                      <p className="font-semibold text-white">Slate Light</p>
                      <p className="text-[10px] text-gray-400">Cool Slate & Steel Blue</p>
                    </div>
                  </button>

                  <div className="px-2 py-1 text-[9px] uppercase font-bold text-cyan-400 tracking-wider pt-1">
                    🌙 Dark Themes
                  </div>

                  <button
                    onClick={() => {
                      if (onSelectTheme) onSelectTheme('dark');
                      else onToggleTheme();
                      setShowThemeMenu(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-all ${
                      currentPreset === 'dark'
                        ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 font-bold'
                        : 'hover:bg-white/5 text-gray-300'
                    }`}
                  >
                    <Moon className="w-4 h-4 text-cyan-400 shrink-0" />
                    <div className="text-left">
                      <p className="font-semibold text-white">Cyber Dark</p>
                      <p className="text-[10px] text-gray-400">Obsidian & Cyan Neon</p>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      if (onSelectTheme) onSelectTheme('midnight');
                      else onToggleTheme();
                      setShowThemeMenu(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-all ${
                      currentPreset === 'midnight'
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold'
                        : 'hover:bg-white/5 text-gray-300'
                    }`}
                  >
                    <Palette className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div className="text-left">
                      <p className="font-semibold text-white">Midnight Blue</p>
                      <p className="text-[10px] text-gray-400">Deep Navy & Sapphire</p>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      if (onSelectTheme) onSelectTheme('emerald');
                      else onToggleTheme();
                      setShowThemeMenu(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-all ${
                      currentPreset === 'emerald'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold'
                        : 'hover:bg-white/5 text-gray-300'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div className="text-left">
                      <p className="font-semibold text-white">Emerald Forest</p>
                      <p className="text-[10px] text-gray-400">Rich Forest & Mint</p>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      if (onSelectTheme) onSelectTheme('sunset');
                      else onToggleTheme();
                      setShowThemeMenu(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-all ${
                      currentPreset === 'sunset'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold'
                        : 'hover:bg-white/5 text-gray-300'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-rose-400 shrink-0" />
                    <div className="text-left">
                      <p className="font-semibold text-white">Sunset Rose</p>
                      <p className="text-[10px] text-gray-400">Plum, Rose & Warm Gold</p>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Online / Offline Status Badge */}
            <div
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border ${
                isOnline
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}
              title={isOnline ? 'Online (Connected)' : 'Offline (Local Storage Active)'}
            >
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span className="hidden lg:inline text-[11px] uppercase tracking-wider">{isOnline ? 'Online' : 'Offline'}</span>
            </div>

            {/* User Profile Avatar Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center space-x-2 p-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <div className="h-9 w-9 rounded-full border border-white/20 bg-gradient-to-tr from-gray-800 to-gray-700 flex items-center justify-center text-xs font-medium text-white shadow-md">
                  {session.teacherName ? session.teacherName.split(' ').map(n=>n[0]).join('').slice(0,2) : 'AB'}
                </div>
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-[#111] border border-white/10 rounded-2xl shadow-2xl py-2 z-50 text-gray-200">
                  <div className="px-4 py-3 border-b border-white/10">
                    <p className="text-sm font-medium text-white truncate">{session.teacherName}</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-tighter truncate">{session.role} • {settings.schoolName}</p>
                  </div>

                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      onSelectTab('settings');
                    }}
                    className="w-full text-left px-4 py-2 text-xs hover:bg-white/5 flex items-center gap-2 text-gray-300"
                  >
                    <Building2 className="w-4 h-4 text-gray-400" />
                    School & Teacher Settings
                  </button>

                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      onLogout();
                    }}
                    className="w-full text-left px-4 py-2 text-xs hover:bg-rose-500/10 text-rose-400 flex items-center gap-2 border-t border-white/10 mt-1"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out Teacher Session
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
