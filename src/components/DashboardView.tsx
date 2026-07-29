import React from 'react';
import {
  Users,
  CheckCircle,
  XCircle,
  Clock,
  QrCode,
  UserPlus,
  ClipboardList,
  FileText,
  BarChart2,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { Student, AttendanceRecord, SyncStatus, AppSettings } from '../types';

interface DashboardViewProps {
  students: Student[];
  attendance: AttendanceRecord[];
  syncStatus: SyncStatus;
  settings: AppSettings;
  onSelectTab: (tab: string) => void;
  onSync: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  students,
  attendance,
  syncStatus,
  settings,
  onSelectTab,
  onSync,
}) => {
  const now = new Date();
  const localTodayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const utcTodayStr = now.toISOString().split('T')[0];

  const [selectedComparisonDate, setSelectedComparisonDate] = React.useState<string>(localTodayStr);

  // Helper to normalize class name variations (e.g., '10th', 'Class 10th', '10', 'Class 10 - IT') to 'Class 9', 'Class 10', 'Class 11', 'Class 12'
  const normalizeClassName = (rawClass: string | undefined | null): string => {
    if (!rawClass) return '';
    const classStr = String(rawClass).trim().toLowerCase();
    if (classStr.includes('12') || classStr.includes('twelve')) return 'Class 12';
    if (classStr.includes('11') || classStr.includes('eleven')) return 'Class 11';
    if (classStr.includes('10') || classStr.includes('ten')) return 'Class 10';
    if (classStr.includes('9') || classStr.includes('nine')) return 'Class 9';
    return String(rawClass).trim();
  };

  // 1. Unique Enrolled Students (Deduplicated by Student ID)
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
  const totalEnrolled = uniqueStudents.length;

  // 2. Helper to check if a record matches a target date string (YYYY-MM-DD)
  const isMatchDate = (r: AttendanceRecord, targetDate: string): boolean => {
    if (!r) return false;
    const cleanTarget = targetDate.trim();

    if (r.date && String(r.date).trim() === cleanTarget) {
      return true;
    }

    if (typeof r.timestamp === 'number' && !isNaN(r.timestamp) && r.timestamp > 0) {
      const rDate = new Date(r.timestamp);
      if (!isNaN(rDate.getTime())) {
        const y = rDate.getFullYear();
        const m = String(rDate.getMonth() + 1).padStart(2, '0');
        const d = String(rDate.getDate()).padStart(2, '0');
        if (`${y}-${m}-${d}` === cleanTarget) return true;
      }
    }

    if (r.date) {
      const parsedDate = new Date(r.date);
      if (!isNaN(parsedDate.getTime())) {
        const y = parsedDate.getFullYear();
        const m = String(parsedDate.getMonth() + 1).padStart(2, '0');
        const d = String(parsedDate.getDate()).padStart(2, '0');
        if (`${y}-${m}-${d}` === cleanTarget) return true;
      }
    }

    return false;
  };

  const isTodayRecord = (r: AttendanceRecord): boolean => isMatchDate(r, localTodayStr) || isMatchDate(r, utcTodayStr);

  // Filter & deduplicate records for selected comparison date per student
  const comparisonStudentMap = new Map<string, AttendanceRecord>();
  (attendance || []).forEach((r) => {
    if (
      (isMatchDate(r, selectedComparisonDate) ||
        (selectedComparisonDate === localTodayStr && isTodayRecord(r))) &&
      r.studentId
    ) {
      const key = String(r.studentId).trim().toUpperCase();
      const existing = comparisonStudentMap.get(key);
      if (!existing || (r.timestamp || 0) >= (existing.timestamp || 0)) {
        comparisonStudentMap.set(key, r);
      }
    }
  });

  // 4. Counts for Selected Date based on enrolled students & latest records
  let presentCount = 0;
  let absentCount = 0;
  let lateCount = 0;
  let leaveCount = 0;

  const processedStudentIds = new Set<string>();

  uniqueStudents.forEach((s) => {
    const cleanId = s.id.trim().toUpperCase();
    processedStudentIds.add(cleanId);
    const rec = comparisonStudentMap.get(cleanId);
    if (rec) {
      const st = String(rec.status || '').trim().toLowerCase();
      if (st === 'present' || st === 'p') {
        presentCount++;
      } else if (st === 'late' || st === 'l') {
        lateCount++;
      } else if (st === 'leave' || st === 'excused' || st === 'lv') {
        leaveCount++;
      } else {
        absentCount++;
      }
    } else {
      // Enrolled student with no attendance record on selected date -> Absent / Unmarked
      absentCount++;
    }
  });

  // Include any extra attendance records on that date for student IDs not in uniqueStudents
  comparisonStudentMap.forEach((rec, cleanId) => {
    if (!processedStudentIds.has(cleanId)) {
      const st = String(rec.status || '').trim().toLowerCase();
      if (st === 'present' || st === 'p') {
        presentCount++;
      } else if (st === 'late' || st === 'l') {
        lateCount++;
      } else if (st === 'leave' || st === 'excused' || st === 'lv') {
        leaveCount++;
      } else {
        absentCount++;
      }
    }
  });

  const totalEvaluated = Math.max(
    totalEnrolled,
    presentCount + absentCount + lateCount + leaveCount
  );
  const totalDivisor = totalEvaluated > 0 ? totalEvaluated : 1;
  const attendancePercentage = Math.min(
    100,
    Math.round(((presentCount + lateCount) / totalDivisor) * 100)
  );

  // 5. Class breakdown for Class 9, Class 10, Class 11, Class 12 on selected date
  const classes = ['Class 9', 'Class 10', 'Class 11', 'Class 12'] as const;
  const classBreakdown = classes.map((cName) => {
    const classStudents = uniqueStudents.filter(
      (s) => normalizeClassName(s.className) === cName
    );

    let cPresent = 0;
    let cAbsent = 0;
    let cLate = 0;
    let cLeave = 0;

    const classStudentIds = new Set<string>();

    classStudents.forEach((s) => {
      const cleanId = s.id.trim().toUpperCase();
      classStudentIds.add(cleanId);
      const rec = comparisonStudentMap.get(cleanId);
      if (rec) {
        const st = String(rec.status || '').trim().toLowerCase();
        if (st === 'present' || st === 'p') {
          cPresent++;
        } else if (st === 'late' || st === 'l') {
          cLate++;
        } else if (st === 'leave' || st === 'excused' || st === 'lv') {
          cLeave++;
        } else {
          cAbsent++;
        }
      } else {
        // Enrolled student in this class with no record on selected date -> Absent
        cAbsent++;
      }
    });

    // Check for extra records belonging to this class not in classStudents
    comparisonStudentMap.forEach((rec, cleanId) => {
      if (!classStudentIds.has(cleanId)) {
        const rClass = normalizeClassName(rec.className);
        if (rClass === cName) {
          const st = String(rec.status || '').trim().toLowerCase();
          if (st === 'present' || st === 'p') {
            cPresent++;
          } else if (st === 'late' || st === 'l') {
            cLate++;
          } else if (st === 'leave' || st === 'excused' || st === 'lv') {
            cLeave++;
          } else {
            cAbsent++;
          }
        }
      }
    });

    const totalInClass = Math.max(classStudents.length, cPresent + cAbsent + cLate + cLeave);
    const totalPresent = cPresent + cLate;
    const pct = totalInClass > 0 ? Math.min(100, Math.round((totalPresent / totalInClass) * 100)) : 0;

    return {
      className: cName,
      total: totalInClass,
      present: totalPresent,
      absent: cAbsent,
      leave: cLeave,
      percentage: pct,
    };
  });

  // 6. Recent scans (sorted by timestamp descending)
  const recentScans = [...(attendance || [])]
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Status */}
      <div className="bg-[#111] border border-white/5 rounded-3xl p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-900/10 via-transparent to-cyan-900/5 pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center space-x-2 text-[10px] font-bold uppercase tracking-widest text-cyan-500 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Vocational Education • IT / ITES Division</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif italic text-white tracking-tight">Attendance Dashboard</h1>
            <p className="text-xs text-gray-400 mt-1">
              {settings.schoolName}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Instructor: <span className="text-white font-medium">{settings.teacherName}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onSelectTab('scanner')}
              className="flex items-center space-x-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-5 py-3 rounded-xl uppercase tracking-widest text-xs shadow-lg shadow-cyan-950/40 active:scale-95 transition-all"
            >
              <QrCode className="w-4 h-4 text-white animate-pulse" />
              <span>Launch QR Scanner</span>
            </button>

            <button
              onClick={onSync}
              disabled={syncStatus.isSyncing}
              className="flex items-center space-x-2 bg-[#1a1a1a] hover:bg-white/10 text-gray-200 border border-white/10 font-medium px-4 py-3 rounded-xl transition-all text-xs"
            >
              <RefreshCw className={`w-4 h-4 ${syncStatus.isSyncing ? 'animate-spin text-cyan-400' : ''}`} />
              <span className="hidden sm:inline">Sync Sheets</span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-[#111] border border-white/5 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-2">
            <span>Total Enrolled</span>
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-3xl font-serif text-white">{totalEnrolled}</p>
          <span className="text-[10px] text-gray-500 mt-1 block">Vocational IT Students</span>
        </div>

        <div className="bg-[#111] border border-white/5 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-2">
            <span>{selectedComparisonDate === localTodayStr ? "Today's Present" : "Present"}</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-3xl font-serif text-emerald-400">{presentCount}</p>
          <span className="text-[10px] text-emerald-400/80 font-bold mt-1 block">{attendancePercentage}% Attendance Rate</span>
        </div>

        <div className="bg-[#111] border border-white/5 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-2">
            <span>{selectedComparisonDate === localTodayStr ? "Today's Absent" : "Absent"}</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-3xl font-serif text-rose-400">{absentCount}</p>
          <span className="text-[10px] text-rose-400/80 font-bold mt-1 block">Absent / Unmarked</span>
        </div>

        <div className="bg-[#111] border border-white/5 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-2">
            <span>Late / Leave</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-3xl font-serif text-amber-400">{lateCount + leaveCount}</p>
          <span className="text-[10px] text-gray-500 mt-1 block">Late: {lateCount} | Leave: {leaveCount}</span>
        </div>

        <div className="col-span-2 lg:col-span-1 bg-[#111] border border-white/5 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-1">
            <span>Sheets Sync</span>
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <p className="text-xs font-bold text-gray-200 truncate">
            {syncStatus.lastSyncTime ? syncStatus.lastSyncTime : 'Not Synced Yet'}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-[10px]">
            {syncStatus.pendingCount > 0 ? (
              <span className="text-amber-400 font-bold">{syncStatus.pendingCount} Pending Local Queue</span>
            ) : (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Connected & Synced
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Class Comparison & Attendance Rates Grid */}
      <div className="bg-[#111] border border-white/5 rounded-3xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-white/5 pb-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              Class Comparison & Attendance Rates
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Comparing class-wise attendance for:{' '}
              <span className="text-white font-medium">
                {selectedComparisonDate === localTodayStr ? `Today (${selectedComparisonDate})` : selectedComparisonDate}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <label htmlFor="dashboard-date-picker" className="text-xs text-gray-400 font-medium flex items-center gap-1.5 shrink-0">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              <span>Select Date:</span>
            </label>
            <input
              id="dashboard-date-picker"
              type="date"
              value={selectedComparisonDate}
              onChange={(e) => setSelectedComparisonDate(e.target.value)}
              className="bg-[#0a0a0a] text-white border border-white/10 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-cyan-500 transition-colors"
            />
            {selectedComparisonDate !== localTodayStr && (
              <button
                onClick={() => setSelectedComparisonDate(localTodayStr)}
                className="text-[10px] bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/60 px-2.5 py-1.5 rounded-xl font-bold uppercase tracking-wider transition-all"
              >
                Today
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {classBreakdown.map((item) => (
            <div key={item.className} className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-4 hover:border-white/10 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-xs text-gray-200">{item.className}</span>
                <span className="text-xs font-serif italic text-cyan-400 font-bold">{item.percentage}%</span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-1.5 mb-2.5 overflow-hidden">
                <div
                  className="bg-cyan-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(item.percentage, 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-gray-400">
                <span>Present: <strong className="text-emerald-400 font-semibold">{item.present}</strong></span>
                <span>Absent: <strong className="text-rose-400 font-semibold">{item.absent}</strong></span>
                <span>Total: <strong className="text-gray-300 font-semibold">{item.total}</strong></span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <button
          onClick={() => onSelectTab('scanner')}
          className="bg-[#111] border border-cyan-500/30 hover:border-cyan-400 rounded-2xl p-4 text-left transition-all hover:bg-white/5 group shadow-lg"
        >
          <div className="w-10 h-10 rounded-xl bg-cyan-600 text-white flex items-center justify-center mb-3 group-hover:bg-cyan-500 shadow-md">
            <QrCode className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-xs text-white">Scan QR</h3>
          <p className="text-[10px] text-gray-500 mt-0.5">Camera scanner</p>
        </button>

        <button
          onClick={() => onSelectTab('enrollment')}
          className="bg-[#111] border border-white/5 hover:border-white/20 rounded-2xl p-4 text-left transition-all hover:bg-white/5 group shadow-lg"
        >
          <div className="w-10 h-10 rounded-xl bg-white/5 text-gray-300 flex items-center justify-center mb-3">
            <UserPlus className="w-5 h-5 text-cyan-400" />
          </div>
          <h3 className="font-bold text-xs text-gray-200">Enroll Student</h3>
          <p className="text-[10px] text-gray-500 mt-0.5">Register new ID</p>
        </button>

        <button
          onClick={() => onSelectTab('manual')}
          className="bg-[#111] border border-white/5 hover:border-white/20 rounded-2xl p-4 text-left transition-all hover:bg-white/5 group shadow-lg"
        >
          <div className="w-10 h-10 rounded-xl bg-white/5 text-emerald-400 flex items-center justify-center mb-3">
            <ClipboardList className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-xs text-gray-200">Manual Entry</h3>
          <p className="text-[10px] text-gray-500 mt-0.5">Batch status</p>
        </button>

        <button
          onClick={() => onSelectTab('reports')}
          className="bg-[#111] border border-white/5 hover:border-white/20 rounded-2xl p-4 text-left transition-all hover:bg-white/5 group shadow-lg"
        >
          <div className="w-10 h-10 rounded-xl bg-white/5 text-amber-400 flex items-center justify-center mb-3">
            <FileText className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-xs text-gray-200">Reports</h3>
          <p className="text-[10px] text-gray-500 mt-0.5">PDF & Excel</p>
        </button>

        <button
          onClick={() => onSelectTab('analytics')}
          className="bg-[#111] border border-white/5 hover:border-white/20 rounded-2xl p-4 text-left transition-all hover:bg-white/5 group shadow-lg"
        >
          <div className="w-10 h-10 rounded-xl bg-white/5 text-purple-400 flex items-center justify-center mb-3">
            <BarChart2 className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-xs text-gray-200">Analytics</h3>
          <p className="text-[10px] text-gray-500 mt-0.5">Visual graphs</p>
        </button>

        <button
          onClick={() => onSelectTab('settings')}
          className="bg-[#111] border border-white/5 hover:border-white/20 rounded-2xl p-4 text-left transition-all hover:bg-white/5 group shadow-lg"
        >
          <div className="w-10 h-10 rounded-xl bg-white/5 text-cyan-400 flex items-center justify-center mb-3">
            <RefreshCw className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-xs text-gray-200">Google Sheets</h3>
          <p className="text-[10px] text-gray-500 mt-0.5">Apps Script</p>
        </button>
      </div>

      {/* Recent Activity Live Stream */}
      <div className="bg-[#111] border border-white/5 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-cyan-400" />
            Live Activity Scan Log
          </p>
          <button
            onClick={() => onSelectTab('reports')}
            className="text-[10px] uppercase tracking-widest font-bold text-cyan-400 hover:underline"
          >
            View Full History
          </button>
        </div>

        {recentScans.length === 0 ? (
          <div className="py-8 text-center text-gray-500 text-xs">
            No attendance recorded today yet. Launch QR Scanner to start!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-[#0a0a0a] text-gray-500 uppercase text-[10px] tracking-widest font-bold">
                <tr>
                  <th className="px-4 py-3 rounded-l-xl">Student ID</th>
                  <th className="px-4 py-3">Student Name</th>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Date & Time</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 rounded-r-xl">Sheet Sync</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentScans.map((scan) => (
                  <tr key={scan.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-cyan-400">{scan.studentId}</td>
                    <td className="px-4 py-3 font-semibold text-white">{scan.studentName}</td>
                    <td className="px-4 py-3">{scan.className}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {scan.date} • {scan.time}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${
                          scan.status === 'Present'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : scan.status === 'Absent'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : scan.status === 'Late'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                        }`}
                      >
                        {scan.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {scan.syncedToFirestore ? (
                        <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Synced
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-amber-400 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> Real-time
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
