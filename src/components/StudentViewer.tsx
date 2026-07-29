import React, { useState } from 'react';
import {
  UserCheck,
  Search,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  BookOpen,
  PieChart,
  User,
} from 'lucide-react';
import { Student, AttendanceRecord } from '../types';

interface StudentViewerProps {
  students: Student[];
  attendance: AttendanceRecord[];
}

export const StudentViewer: React.FC<StudentViewerProps> = ({ students, attendance }) => {
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    students[0]?.id || ''
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'none'>('asc');
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [selectedMonthIdx, setSelectedMonthIdx] = useState<number>(today.getMonth()); // 0-based

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const selectedStudent = students.find((s) => s.id === selectedStudentId) || students[0];

  const filteredStudents = students.filter(
    (s) =>
      s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedStudents = [...filteredStudents].sort((a, b) => {
    if (sortOrder === 'asc') return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    if (sortOrder === 'desc') return b.name.localeCompare(a.name, undefined, { sensitivity: 'base' });
    return 0;
  });

  // Filter attendance for selected student
  const studentRecords = attendance.filter((r) => r.studentId === selectedStudent?.id);

  const presentCount = studentRecords.filter((r) => r.status === 'Present').length;
  const absentCount = studentRecords.filter((r) => r.status === 'Absent').length;
  const lateCount = studentRecords.filter((r) => r.status === 'Late').length;
  const leaveCount = studentRecords.filter((r) => r.status === 'Leave').length;
  const totalRecords = studentRecords.length || 1;

  const attendancePercentage = Math.round(((presentCount + lateCount) / totalRecords) * 100);

  // Calendar calculations for selected month & year
  const daysInMonth = new Date(selectedYear, selectedMonthIdx + 1, 0).getDate();
  const firstDayOfWeek = new Date(selectedYear, selectedMonthIdx, 1).getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => {
    const dayNum = i + 1;
    const dateStr = `${selectedYear}-${String(selectedMonthIdx + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const record = studentRecords.find((r) => r.date === dateStr);
    return {
      dayNum,
      dateStr,
      record,
    };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-blue-400" />
            Individual Student Attendance Viewer
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Search student profile, inspect interactive monthly attendance calendar, and monitor eligibility.
          </p>
        </div>

        {/* Quick Search Student Autocomplete */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ID or Name..."
            className="w-full bg-slate-800 border border-slate-700 rounded-2xl pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Student List Sidebar */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-md">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-200">Enrolled Students List</h2>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc' | 'none')}
              className="bg-slate-800 border border-slate-700 rounded-xl px-2 py-1 text-[11px] text-blue-400 font-semibold focus:outline-none"
            >
              <option value="asc">Name A → Z</option>
              <option value="desc">Name Z → A</option>
              <option value="none">Default</option>
            </select>
          </div>

          <div className="max-h-[500px] overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-slate-700">
            {sortedStudents.map((st) => (
              <button
                key={st.id}
                onClick={() => setSelectedStudentId(st.id)}
                className={`w-full text-left p-3 rounded-2xl text-xs flex items-center justify-between transition-all ${
                  selectedStudent?.id === st.id
                    ? 'bg-blue-600 text-white font-bold shadow-md'
                    : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xs">
                    {st.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold">{st.name}</p>
                    <p className="text-[10px] opacity-80">{st.className}</p>
                  </div>
                </div>
                <span className="font-mono text-[11px] font-bold">{st.id}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Selected Student Details & Interactive Calendar */}
        {selectedStudent && (
          <div className="lg:col-span-2 space-y-6">
            {/* Student Profile Overview Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md text-white">
              <div className="flex flex-col sm:flex-row items-center gap-5 border-b border-slate-800 pb-5">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                  {selectedStudent.name.charAt(0)}
                </div>

                <div className="flex-1 text-center sm:text-left space-y-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h2 className="text-xl font-bold">{selectedStudent.name}</h2>
                    <span className="px-3 py-1 bg-blue-500/20 text-blue-300 font-bold text-xs rounded-full border border-blue-500/30 w-fit mx-auto sm:mx-0">
                      {selectedStudent.className}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono">Student ID: {selectedStudent.id}</p>
                  <p className="text-xs text-slate-400">Parentage: {selectedStudent.parentage}</p>
                </div>
              </div>

              {/* Stats KPI Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5">
                <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60 text-center">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Attendance %</span>
                  <p className={`text-lg font-bold ${attendancePercentage >= 75 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {attendancePercentage}%
                  </p>
                </div>
                <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60 text-center">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Present</span>
                  <p className="text-lg font-bold text-emerald-400">{presentCount}</p>
                </div>
                <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60 text-center">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Absent</span>
                  <p className="text-lg font-bold text-rose-400">{absentCount}</p>
                </div>
                <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60 text-center">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Late</span>
                  <p className="text-lg font-bold text-amber-400">{lateCount}</p>
                </div>
                <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60 text-center">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Leave</span>
                  <p className="text-lg font-bold text-blue-400">{leaveCount}</p>
                </div>
              </div>
            </div>

            {/* Monthly Interactive Calendar View */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-bold text-slate-200">
                    Monthly Calendar View
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedMonthIdx}
                    onChange={(e) => setSelectedMonthIdx(parseInt(e.target.value, 10))}
                    className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-semibold"
                  >
                    {monthNames.map((m, idx) => (
                      <option key={m} value={idx}>{m}</option>
                    ))}
                  </select>

                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                    className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-semibold"
                  >
                    {[2024, 2025, 2026, 2027, 2028].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status Legend */}
              <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold mb-4 bg-slate-800/40 p-2.5 rounded-2xl border border-slate-800">
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Present
                </span>
                <span className="flex items-center gap-1 text-rose-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Absent
                </span>
                <span className="flex items-center gap-1 text-amber-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Late
                </span>
                <span className="flex items-center gap-1 text-blue-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Leave
                </span>
                <span className="flex items-center gap-1 text-purple-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Holiday
                </span>
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} className="text-center text-[10px] font-bold text-slate-500 uppercase py-1">
                    {d}
                  </div>
                ))}

                {/* Empty padding cells for days before the 1st of the month */}
                {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                  <div key={`pad-${idx}`} className="h-12 rounded-xl p-1.5 bg-slate-950/20 border border-slate-800/30" />
                ))}

                {calendarDays.map((cd) => {
                  const status = cd.record?.status;
                  return (
                    <div
                      key={cd.dayNum}
                      className={`h-12 rounded-xl p-1.5 flex flex-col justify-between border transition-all text-xs font-semibold ${
                        status === 'Present'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                          : status === 'Absent'
                          ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                          : status === 'Late'
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                          : status === 'Leave'
                          ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                          : status === 'Holiday'
                          ? 'bg-purple-500/10 border-purple-500/30 text-purple-300'
                          : 'bg-slate-800/40 border-slate-800 text-slate-500'
                      }`}
                    >
                      <span className="text-[10px] opacity-80">{cd.dayNum}</span>
                      {status && <span className="text-[9px] font-bold truncate">{status}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
