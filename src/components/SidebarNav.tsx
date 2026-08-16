import React from 'react';
import {
  LayoutDashboard,
  QrCode,
  UserPlus,
  Contact,
  BadgeCheck,
  ClipboardList,
  UserCheck,
  FileText,
  Settings,
  History,
  Palette,
  ShieldAlert,
} from 'lucide-react';

interface SidebarNavProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  pendingSyncCount: number;
  atRiskCount?: number;
  onToggleTheme?: () => void;
  currentTheme?: string;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeTab,
  onSelectTab,
  pendingSyncCount,
  atRiskCount = 0,
  onToggleTheme,
  currentTheme = 'dark',
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'scanner', label: 'Scan Attendance', icon: QrCode, highlight: true },
    { id: 'enrollment', label: 'Enrollment', icon: UserPlus },
    { id: 'idcards', label: 'Student ID Cards', icon: Contact },
    { id: 'qrcards', label: 'QR Cards', icon: BadgeCheck },
    { id: 'manual', label: 'Manual Attendance', icon: ClipboardList },
    { id: 'viewer', label: 'Student Viewer', icon: UserCheck },
    {
      id: 'alerts',
      label: 'Attendance Alerts',
      icon: ShieldAlert,
      badge: atRiskCount > 0 ? `${atRiskCount}` : null,
      badgeColor: 'bg-rose-500 text-white',
    },
    { id: 'reports', label: 'Reports & Export', icon: FileText },
    { id: 'settings', label: 'Settings & Sheets', icon: Settings, badge: pendingSyncCount > 0 ? `${pendingSyncCount}` : null },
    { id: 'logs', label: 'Audit Logs', icon: History },
  ];

  return (
    <aside className="w-full md:w-64 bg-[#0a0a0a] border-r border-white/10 shrink-0 p-4 flex flex-col justify-between">
      <nav className="space-y-1">
        <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
          Vocational Navigation
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-950/50 font-bold'
                  : item.highlight
                  ? 'text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : item.highlight ? 'text-cyan-400' : 'text-gray-500'}`} />
                <span>{item.label}</span>
              </div>

              {item.badge && (
                <span
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-full animate-pulse ${
                    item.badgeColor || 'bg-amber-500 text-black'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="mt-6 pt-4 border-t border-white/5 px-1 space-y-3">
        {onToggleTheme && (
          <button
            onClick={onToggleTheme}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#111] hover:bg-white/5 border border-white/10 text-xs font-semibold text-gray-300 transition-all"
            title="Cycle Website Theme"
          >
            <div className="flex items-center gap-2.5">
              <Palette className="w-4 h-4 text-cyan-400" />
              <span>Website Theme</span>
            </div>
            <span className="text-[10px] uppercase font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20 capitalize">
              {currentTheme}
            </span>
          </button>
        )}

        <div className="bg-[#111] rounded-2xl p-4 border border-white/5 text-xs">
          <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">Backend Sync</p>
          <p className="font-medium text-white">Google Sheets Connected</p>
          <div className="mt-2.5 flex items-center gap-2 text-[10px] text-emerald-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            System Live & Ready
          </div>
        </div>
      </div>
    </aside>
  );
};
