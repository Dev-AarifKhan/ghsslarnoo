import React, { useState } from 'react';
import {
  ShieldAlert,
  SlidersHorizontal,
  Search,
  Phone,
  Mail,
  Bell,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Users,
  MessageSquare,
  ArrowRight,
  TrendingDown,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Student, AttendanceRecord, AppSettings } from '../types';
import { ParentNotificationModal, StudentAttendanceStat } from './ParentNotificationModal';

interface AttendanceAlertsViewProps {
  students: Student[];
  attendance: AttendanceRecord[];
  settings: AppSettings;
  onSelectTab: (tab: string) => void;
  onSaveSettings?: (settings: AppSettings) => void;
  onUpdateStudent?: (student: Student) => void;
}

export const AttendanceAlertsView: React.FC<AttendanceAlertsViewProps> = ({
  students,
  attendance,
  settings,
  onSelectTab,
  onSaveSettings,
  onUpdateStudent,
}) => {
  // Configurable Attendance Risk Threshold State
  const [lowThreshold, setLowThreshold] = useState<number>(
    settings.lowAttendanceThreshold ?? 75
  );
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [selectedStudentForNotice, setSelectedStudentForNotice] =
    useState<StudentAttendanceStat | null>(null);
  const [isNoticeModalOpen, setIsNoticeModalOpen] = useState<boolean>(false);
  const [thresholdSavedToast, setThresholdSavedToast] = useState<boolean>(false);

  // Helper to normalize class names
  const normalizeClassName = (rawClass: string | undefined | null): string => {
    if (!rawClass) return '';
    const classStr = String(rawClass).trim().toLowerCase();
    if (classStr.includes('12') || classStr.includes('twelve')) return 'Class 12';
    if (classStr.includes('11') || classStr.includes('eleven')) return 'Class 11';
    if (classStr.includes('10') || classStr.includes('ten')) return 'Class 10';
    if (classStr.includes('9') || classStr.includes('nine')) return 'Class 9';
    return String(rawClass).trim();
  };

  // Deduplicate unique students
  const uniqueStudentsMap = new Map<string, Student>();
  (students || []).forEach((s) => {
    if (s && s.id && String(s.id).trim()) {
      const cleanId = String(s.id).trim().toUpperCase();
      if (!uniqueStudentsMap.has(cleanId)) {
        uniqueStudentsMap.set(cleanId, s);
      }
    }
  });
  const uniqueStudents = Array.from(uniqueStudentsMap.values());

  const classes = ['Class 9', 'Class 10', 'Class 11', 'Class 12'] as const;

  // Calculate stats for all students
  const allStudentStats: StudentAttendanceStat[] = uniqueStudents.map((s) => {
    const cleanId = s.id.trim().toUpperCase();
    const records = (attendance || []).filter(
      (r) => r.studentId && r.studentId.trim().toUpperCase() === cleanId
    );

    // Deduplicate by date (keep latest per date)
    const dateMap = new Map<string, AttendanceRecord>();
    records.forEach((r) => {
      const d = r.date || (r.timestamp ? new Date(r.timestamp).toISOString().split('T')[0] : '');
      if (d) {
        const existing = dateMap.get(d);
        if (!existing || (r.timestamp || 0) >= (existing.timestamp || 0)) {
          dateMap.set(d, r);
        }
      }
    });

    let p = 0;
    let a = 0;
    let l = 0;
    let lv = 0;
    let h = 0;

    dateMap.forEach((rec) => {
      const st = String(rec.status || '').trim().toLowerCase();
      if (st === 'present' || st === 'p') p++;
      else if (st === 'absent' || st === 'a') a++;
      else if (st === 'late' || st === 'l') l++;
      else if (st === 'leave' || st === 'excused' || st === 'lv') lv++;
      else if (st === 'holiday' || st === 'h') h++;
    });

    // Only working days calculated (omit holidays). Only consider present and absent days.
    const tot = p + a;
    const pct = tot > 0 ? Math.min(100, Math.round((p / tot) * 100)) : 0;
    const status: 'critical' | 'warning' | 'good' =
      tot === 0 ? 'good' : pct < 50 ? 'critical' : pct < lowThreshold ? 'warning' : 'good';

    return {
      student: s,
      percentage: pct,
      present: p,
      absent: a,
      late: l,
      leave: lv,
      total: tot,
      status,
    };
  });

  // Filter students below threshold with evaluated attendance
  const allAtRiskStudents = allStudentStats
    .filter((stat) => stat.total > 0 && stat.percentage < lowThreshold)
    .sort((a, b) => a.percentage - b.percentage);

  const criticalCount = allAtRiskStudents.filter((s) => s.percentage < 50).length;
  const warningCount = allAtRiskStudents.length - criticalCount;

  const filteredAtRiskStudents = allAtRiskStudents.filter((stat) => {
    const matchesClass =
      classFilter === 'ALL' || normalizeClassName(stat.student.className) === classFilter;
    const matchesQuery =
      !searchQuery.trim() ||
      stat.student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stat.student.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (stat.student.parentage &&
        stat.student.parentage.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesClass && matchesQuery;
  });

  const handleSetThresholdDefault = (newThreshold: number) => {
    setLowThreshold(newThreshold);
    if (onSaveSettings) {
      onSaveSettings({
        ...settings,
        lowAttendanceThreshold: newThreshold,
      });
      setThresholdSavedToast(true);
      setTimeout(() => setThresholdSavedToast(false), 3000);
    }
  };

  const handleOpenNotice = (stat: StudentAttendanceStat) => {
    setSelectedStudentForNotice(stat);
    setIsNoticeModalOpen(true);
  };

  return (
    <div id="attendance-alerts-view" className="space-y-6 animate-fadeIn">
      {/* Top Banner Header */}
      <div className="bg-[#111] border border-white/5 rounded-3xl p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-950/20 via-transparent to-rose-950/20 pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center space-x-2 text-[10px] font-bold uppercase tracking-widest text-amber-400 mb-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Early Warning System • Student Attendance Alerts</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif italic text-white tracking-tight">
              Low Attendance & Parent Alerts
            </h1>
            <p className="text-xs text-gray-400 mt-1 max-w-2xl leading-relaxed">
              Identify students falling below the required attendance threshold and dispatch immediate official notices to parents via WhatsApp, SMS, or Email.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onSelectTab('dashboard')}
              className="flex items-center space-x-2 bg-[#1a1a1a] hover:bg-white/10 text-gray-200 border border-white/10 font-medium px-4 py-2.5 rounded-xl transition-all text-xs"
            >
              <span>Back to Dashboard</span>
            </button>
            <button
              onClick={() => onSelectTab('reports')}
              className="flex items-center space-x-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-4 py-2.5 rounded-xl transition-all text-xs shadow-md"
            >
              <span>Full Attendance Reports</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total At Risk */}
        <div className="bg-[#111] border border-amber-500/30 rounded-2xl p-5 shadow-xl bg-gradient-to-b from-amber-950/20 to-[#111]">
          <div className="flex items-center justify-between text-amber-400 text-[10px] uppercase tracking-widest font-bold mb-2">
            <span>Total At-Risk Students</span>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-3xl font-serif text-amber-400 font-bold">{allAtRiskStudents.length}</p>
          <span className="text-[10px] text-gray-400 mt-1 block">
            Below {lowThreshold}% attendance threshold
          </span>
        </div>

        {/* Critical Risk (<50%) */}
        <div className="bg-[#111] border border-rose-500/30 rounded-2xl p-5 shadow-xl bg-gradient-to-b from-rose-950/20 to-[#111]">
          <div className="flex items-center justify-between text-rose-400 text-[10px] uppercase tracking-widest font-bold mb-2">
            <span>Critical Deficit (&lt;50%)</span>
            <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" />
          </div>
          <p className="text-3xl font-serif text-rose-400 font-bold">{criticalCount}</p>
          <span className="text-[10px] text-rose-400/80 mt-1 block font-semibold">
            Immediate parent intervention needed
          </span>
        </div>

        {/* Warning Range (50% - Threshold) */}
        <div className="bg-[#111] border border-white/5 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between text-gray-400 text-[10px] uppercase tracking-widest font-bold mb-2">
            <span>Warning Range (50% - {lowThreshold}%)</span>
            <TrendingDown className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-3xl font-serif text-gray-200">{warningCount}</p>
          <span className="text-[10px] text-gray-500 mt-1 block">
            Requires monitoring & advisory
          </span>
        </div>

        {/* Active Threshold Config */}
        <div className="bg-[#111] border border-white/5 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 text-[10px] uppercase tracking-widest font-bold mb-1">
            <span>Active Threshold</span>
            <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-serif font-bold text-cyan-400">{lowThreshold}%</span>
            <span className="text-[11px] text-gray-400">Minimum Required</span>
          </div>
          <span className="text-[10px] text-gray-500 mt-1 block">
            Adjustable via threshold selector below
          </span>
        </div>
      </div>

      {/* Threshold & Notification Center Main Panel */}
      <div
        id="at-risk-watchlist-section"
        className="bg-[#111] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Header with Threshold Selector */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
                At-Risk Student Watchlist
              </h2>
              {allAtRiskStudents.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 border border-rose-500/30 text-rose-300 animate-pulse font-mono">
                  {allAtRiskStudents.length} Students
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">
              Students whose attendance is below {lowThreshold}%. Click "Inform Parent" to dispatch pre-formatted notices.
            </p>
          </div>

          {/* Configurable Threshold Pill Bar */}
          <div className="flex flex-wrap items-center gap-2 bg-[#0a0a0a] border border-white/10 p-2 rounded-2xl shrink-0">
            <div className="flex items-center gap-1.5 px-2 text-xs font-semibold text-gray-300">
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
              <span>Threshold:</span>
            </div>

            {[60, 70, 75, 80, 85].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => handleSetThresholdDefault(val)}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold font-mono transition-all ${
                  lowThreshold === val
                    ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20 scale-105'
                    : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {val}%
              </button>
            ))}

            {/* Custom Input */}
            <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-2 py-0.5 ml-1">
              <input
                type="number"
                min="30"
                max="95"
                value={lowThreshold}
                onChange={(e) => {
                  const num = Math.min(99, Math.max(10, Number(e.target.value) || 0));
                  setLowThreshold(num);
                }}
                className="w-10 bg-transparent text-xs text-amber-400 font-bold font-mono text-center focus:outline-none"
              />
              <span className="text-[10px] text-gray-500">%</span>
            </div>
          </div>
        </div>

        {thresholdSavedToast && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Attendance alert threshold updated and saved to {lowThreshold}%!</span>
          </div>
        )}

        {/* Filter Controls: Class tabs, Search, View Mode */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Class Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setClassFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                classFilter === 'ALL'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'bg-[#0a0a0a] text-gray-400 hover:text-white border border-white/5'
              }`}
            >
              All Classes ({allAtRiskStudents.length})
            </button>
            {classes.map((c) => {
              const count = allAtRiskStudents.filter(
                (s) => normalizeClassName(s.student.className) === c
              ).length;
              return (
                <button
                  key={c}
                  onClick={() => setClassFilter(c)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    classFilter === c
                      ? 'bg-cyan-600 text-white shadow-md'
                      : 'bg-[#0a0a0a] text-gray-400 hover:text-white border border-white/5'
                  }`}
                >
                  <span>{c}</span>
                  {count > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500/30 text-rose-300 font-bold">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search Box & View Mode Toggle */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Search student or parent..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>

            <div className="flex items-center bg-[#0a0a0a] border border-white/10 rounded-xl p-0.5">
              <button
                onClick={() => setViewMode('cards')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  viewMode === 'cards'
                    ? 'bg-white/10 text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                Cards
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  viewMode === 'table'
                    ? 'bg-white/10 text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                Table
              </button>
            </div>
          </div>
        </div>

        {/* At-Risk Students Content */}
        {filteredAtRiskStudents.length === 0 ? (
          <div className="py-16 bg-[#0a0a0a] border border-white/5 rounded-2xl text-center px-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto mb-3">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-white">
              {allAtRiskStudents.length === 0
                ? `All Students Meet Attendance Standards (≥ ${lowThreshold}%)`
                : 'No at-risk students match the selected filter.'}
            </h3>
            <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto leading-relaxed">
              {allAtRiskStudents.length === 0
                ? `No students have attendance rates below ${lowThreshold}%. All students are actively compliant with attendance minimums.`
                : 'Try adjusting the class tab or clear your search term to see other students.'}
            </p>
          </div>
        ) : viewMode === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredAtRiskStudents.map((item) => {
              const { student, percentage, present, absent, total, status } = item;
              const isCritical = status === 'critical' || percentage < 50;

              return (
                <div
                  key={student.id}
                  className={`bg-[#0a0a0a] border rounded-2xl p-5 transition-all hover:border-white/20 shadow-lg relative flex flex-col justify-between ${
                    isCritical
                      ? 'border-rose-500/40 bg-gradient-to-b from-rose-950/20 to-[#0a0a0a]'
                      : 'border-amber-500/30 bg-gradient-to-b from-amber-950/10 to-[#0a0a0a]'
                  }`}
                >
                  <div>
                    {/* Student Identity Header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        {student.photoUrl ? (
                          <img
                            src={student.photoUrl}
                            alt={student.name}
                            className="w-11 h-11 rounded-xl object-cover border border-white/10 shrink-0"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-xl bg-cyan-950/80 border border-cyan-500/30 flex items-center justify-center text-cyan-300 font-bold text-xs shrink-0">
                            {student.name.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <h4 className="font-bold text-white text-sm leading-snug">
                            {student.name}
                          </h4>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[10px] font-bold text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-1.5 py-0.2 rounded">
                              {student.id}
                            </span>
                            <span className="text-[11px] text-gray-400 font-medium">
                              {student.className}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Percentage Badge */}
                      <div
                        className={`text-right px-2.5 py-1 rounded-xl font-mono font-bold text-xs border ${
                          isCritical
                            ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                            : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                        }`}
                      >
                        <span className="text-sm font-black">{percentage}%</span>
                        <div className="text-[9px] uppercase font-sans tracking-wide">
                          {isCritical ? 'Critical' : 'At Risk'}
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1 mb-3">
                      <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isCritical ? 'bg-rose-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-gray-400">
                        <span>
                          Target: <strong className="text-gray-300">{lowThreshold}%</strong>
                        </span>
                        <span className="text-rose-400 font-semibold font-mono">
                          -{Math.max(0, lowThreshold - percentage)}% deficit
                        </span>
                      </div>
                    </div>

                    {/* Stats Matrix */}
                    <div className="grid grid-cols-3 gap-2 bg-white/5 rounded-xl p-2.5 mb-3 text-center text-xs">
                      <div>
                        <span className="text-[10px] text-gray-500 block uppercase">Absent</span>
                        <span className="font-bold text-rose-400 font-mono text-sm">{absent}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 block uppercase">Present</span>
                        <span className="font-bold text-emerald-400 font-mono text-sm">{present}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 block uppercase">Total Sessions</span>
                        <span className="font-bold text-gray-300 font-mono text-sm">{total}</span>
                      </div>
                    </div>

                    {/* Parent & Contact Status */}
                    <div className="text-[11px] text-gray-400 space-y-1 mb-4">
                      {student.parentage && (
                        <p className="truncate">
                          Guardian:{' '}
                          <span className="text-gray-200 font-medium">{student.parentage}</span>
                        </p>
                      )}
                      <div className="flex items-center gap-3 pt-0.5">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold ${
                            student.phone ? 'text-emerald-400' : 'text-gray-500'
                          }`}
                        >
                          <Phone className="w-3 h-3" />
                          {student.phone ? student.phone : 'No Phone'}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold ${
                            student.email ? 'text-cyan-400' : 'text-gray-500'
                          }`}
                        >
                          <Mail className="w-3 h-3" />
                          {student.email ? 'Email Set' : 'No Email'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => handleOpenNotice(item)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 ${
                        isCritical
                          ? 'bg-rose-600 hover:bg-rose-500 text-white'
                          : 'bg-amber-600 hover:bg-amber-500 text-white'
                      }`}
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>Inform Parent</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectTab('viewer')}
                      title="View student profile & attendance history in Student Viewer"
                      className="p-2.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl text-xs font-medium transition-colors border border-white/5"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View Mode */
          <div className="overflow-x-auto bg-[#0a0a0a] border border-white/10 rounded-2xl">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-[#111] text-gray-400 uppercase text-[10px] tracking-wider font-bold border-b border-white/10">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Attendance %</th>
                  <th className="px-4 py-3 text-center">Days Absent</th>
                  <th className="px-4 py-3 text-center">Days Present</th>
                  <th className="px-4 py-3">Parent Info</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredAtRiskStudents.map((item) => {
                  const { student, percentage, present, absent, total, status } = item;
                  const isCritical = status === 'critical' || percentage < 50;

                  return (
                    <tr key={student.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-500/30 flex items-center justify-center text-cyan-300 font-bold text-xs shrink-0">
                            {student.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-white block">{student.name}</span>
                            <span className="font-mono text-[10px] text-cyan-400">{student.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">{student.className}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold inline-block border ${
                            isCritical
                              ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                              : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                          }`}
                        >
                          {percentage}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-rose-400">
                        {absent}
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-emerald-400">
                        {present}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-[11px]">
                          <span className="text-gray-300 block">{student.parentage || '—'}</span>
                          <span className="text-[10px] text-gray-500">{student.phone || 'No phone'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenNotice(item)}
                          className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 py-1.5 rounded-xl text-[11px] transition-all shadow-md"
                        >
                          <Bell className="w-3 h-3" />
                          <span>Inform Parent</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Parent Notification Modal */}
      <ParentNotificationModal
        isOpen={isNoticeModalOpen}
        onClose={() => {
          setIsNoticeModalOpen(false);
          setSelectedStudentForNotice(null);
        }}
        studentStat={selectedStudentForNotice}
        settings={settings}
        threshold={lowThreshold}
        onUpdateStudent={onUpdateStudent}
      />
    </div>
  );
};
