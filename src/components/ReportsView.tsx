import React, { useState } from 'react';
import {
  FileText,
  Download,
  Printer,
  FileSpreadsheet,
  Share2,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { Student, AttendanceRecord, ClassName, AttendanceStatus } from '../types';
import { exportAttendanceToExcel, exportStudentSummaryToExcel, printReportHTML } from '../services/pdfExcel';

interface ReportsViewProps {
  students: Student[];
  attendance: AttendanceRecord[];
  onMarkAttendance?: (
    studentId: string,
    status: 'Present' | 'Absent' | 'Late' | 'Leave',
    date?: string,
    time?: string,
    remarks?: string
  ) => { success: boolean; message: string };
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  students,
  attendance,
  onMarkAttendance,
}) => {
  const [selectedClass, setSelectedClass] = useState<string>('All');
  const [selectedMonth, setSelectedMonth] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Months list
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Filter raw attendance records
  const cleanSearch = searchQuery.trim().toLowerCase();

  const normalizeClassName = (rawClass: string | undefined | null): string => {
    if (!rawClass) return '';
    const classStr = String(rawClass).trim().toLowerCase();
    if (classStr.includes('12') || classStr.includes('twelve')) return 'Class 12';
    if (classStr.includes('11') || classStr.includes('eleven')) return 'Class 11';
    if (classStr.includes('10') || classStr.includes('ten')) return 'Class 10';
    if (classStr.includes('9') || classStr.includes('nine')) return 'Class 9';
    return String(rawClass).trim();
  };

  const filteredRecords = attendance.filter((r) => {
    const matchesClass =
      selectedClass === 'All' ||
      r.className === selectedClass ||
      normalizeClassName(r.className) === normalizeClassName(selectedClass);
    const matchesMonth = selectedMonth === 'All' || r.month === selectedMonth;
    const matchesStatus = selectedStatus === 'All' || r.status === selectedStatus;
    const matchesSearch =
      !cleanSearch ||
      String(r.studentId || '').toLowerCase().includes(cleanSearch) ||
      String(r.studentName || '').toLowerCase().includes(cleanSearch) ||
      String(r.className || '').toLowerCase().includes(cleanSearch);

    return matchesClass && matchesMonth && matchesStatus && matchesSearch;
  });

  // Calculate Student Summary (Working Days, Present, Absent, Late, Leave, %)
  const targetStudents = students.filter((s) => {
    const matchesClass =
      selectedClass === 'All' ||
      s.className === selectedClass ||
      normalizeClassName(s.className) === normalizeClassName(selectedClass);
    const matchesSearch =
      !cleanSearch ||
      String(s.id || '').toLowerCase().includes(cleanSearch) ||
      String(s.name || '').toLowerCase().includes(cleanSearch) ||
      String(s.parentage || '').toLowerCase().includes(cleanSearch) ||
      String(s.className || '').toLowerCase().includes(cleanSearch);

    return matchesClass && matchesSearch;
  });

  const studentSummaries = targetStudents
    .map((s) => {
      const recordByDateMap = new Map<string, AttendanceRecord>();
      attendance.forEach((r) => {
        if (r.studentId.toLowerCase() === s.id.toLowerCase()) {
          const matchMonth = selectedMonth === 'All' || r.month === selectedMonth;
          if (matchMonth) {
            if (!recordByDateMap.has(r.date)) {
              recordByDateMap.set(r.date, r);
            } else {
              const existing = recordByDateMap.get(r.date)!;
              if ((r.timestamp || 0) >= (existing.timestamp || 0)) {
                recordByDateMap.set(r.date, r);
              }
            }
          }
        }
      });

      const sRecords = Array.from(recordByDateMap.values());

      const present = sRecords.filter((r) => r.status === 'Present').length;
      const absent = sRecords.filter((r) => r.status === 'Absent').length;
      const late = sRecords.filter((r) => r.status === 'Late').length;
      const leave = sRecords.filter((r) => r.status === 'Leave').length;
      const holiday = sRecords.filter((r) => r.status === 'Holiday').length;

      const workingDays = sRecords.filter((r) => r.status !== 'Holiday').length || 1;
      const percentage = Math.round(((present + late) / workingDays) * 100);

      return {
        studentId: s.id,
        name: s.name,
        parentage: s.parentage,
        className: s.className,
        workingDays,
        present,
        absent,
        late,
        leave,
        holiday,
        percentage,
      };
    })
    .filter((s) => {
      if (selectedStatus === 'All') return true;
      if (selectedStatus === 'Present') return s.present > 0;
      if (selectedStatus === 'Absent') return s.absent > 0;
      if (selectedStatus === 'Late') return s.late > 0;
      if (selectedStatus === 'Leave') return s.leave > 0;
      if (selectedStatus === 'Holiday') return s.holiday > 0;
      return true;
    });

  const [viewMode, setViewMode] = useState<'summary' | 'daywise'>('daywise');

  // Extract all unique dates from filtered attendance records sorted chronologically
  const uniqueDates = Array.from(new Set(filteredRecords.map((r) => r.date))).sort() as string[];

  // Map studentId -> date -> record for quick day-wise matrix lookup
  const studentDateMap = React.useMemo(() => {
    const map: Record<string, Record<string, AttendanceRecord>> = {};
    attendance.forEach((r) => {
      const sid = r.studentId.toLowerCase();
      if (!map[sid]) {
        map[sid] = {};
      }
      const existing = map[sid][r.date];
      if (!existing || (r.timestamp || 0) >= (existing.timestamp || 0)) {
        map[sid][r.date] = r;
      }
    });
    return map;
  }, [attendance]);

  // Handle direct cell status toggle in reports view
  const handleCellStatusClick = (studentId: string, _studentName: string, date: string, currentStatus: string) => {
    if (!onMarkAttendance) return;
    const nextStatusMap: Record<string, AttendanceStatus> = {
      Present: 'Absent',
      Absent: 'Late',
      Late: 'Leave',
      Leave: 'Holiday',
      Holiday: 'Present',
      '-': 'Present',
    };
    const nextStatus = nextStatusMap[currentStatus] || 'Present';
    onMarkAttendance(studentId, nextStatus, date);
  };

  // Print PDF HTML Generator
  const handlePrintPDF = () => {
    const isDayWise = viewMode === 'daywise' && uniqueDates.length > 0;

    const dateHeaders = isDayWise
      ? uniqueDates.map((d) => `<th>${d.slice(5)}</th>`).join('')
      : '';

    const tableRows = studentSummaries
      .map(
        (s, idx) => {
          const dayCells = isDayWise
            ? uniqueDates
                .map((d) => {
                  const record = studentDateMap[s.studentId.toLowerCase()]?.[d];
                  const status = record ? record.status : '-';
                  const badgeClass =
                    status === 'Present'
                      ? 'present'
                      : status === 'Absent'
                      ? 'absent'
                      : status === 'Late'
                      ? 'late'
                      : status === 'Leave'
                      ? 'leave'
                      : '';
                  return `<td><span class="badge ${badgeClass}">${status.charAt(0) || '-'}</span></td>`;
                })
                .join('')
            : '';

          return `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${s.studentId}</strong></td>
        <td>${s.name}</td>
        <td>${s.className}</td>
        ${dayCells}
        <td>${s.workingDays}</td>
        <td><span class="badge present">${s.present}</span></td>
        <td><span class="badge absent">${s.absent}</span></td>
        <td><span class="badge late">${s.late}</span></td>
        <td><span class="badge leave">${s.leave}</span></td>
        <td><strong>${s.percentage}%</strong></td>
        <td>${s.percentage >= 75 ? 'Eligible' : 'Shortage'}</td>
      </tr>
    `;
        }
      )
      .join('');

    const htmlContent = `
      <h1>Govt. Higher Secondary School Larnoo</h1>
      <h2>Vocational Subject IT / ITES Day-Wise & Summary Report</h2>
      <h3>Class: ${selectedClass} | Month: ${selectedMonth}</h3>
      <div class="header-meta">
        <div>Date Generated: ${new Date().toLocaleDateString()}</div>
        <div>Total Students: ${studentSummaries.length}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>ID</th>
            <th>Student Name</th>
            <th>Class</th>
            ${dateHeaders}
            <th>Days</th>
            <th>P</th>
            <th>A</th>
            <th>L</th>
            <th>LV</th>
            <th>%</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
      <div class="footer">
        <div class="signature-box">Aarif Ahmad Khan (Instructor)</div>
        <div class="signature-box">School Principal Signature</div>
      </div>
    `;

    printReportHTML(`Attendance_Report_${selectedClass}_${selectedMonth}`, htmlContent);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111] border border-white/5 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden">
        <div>
          <h1 className="text-2xl font-serif italic tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-cyan-400" />
            Attendance Reports & Day-Wise Analytics
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Day-wise attendance register matrix (Present, Absent, Late, Leave) and class performance export.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              exportStudentSummaryToExcel(
                studentSummaries,
                `Attendance_Report_${selectedClass}_${selectedMonth}`,
                filteredRecords
              )
            }
            className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl uppercase tracking-widest shadow-lg transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel Day-Wise Report (.xlsx)</span>
          </button>

          <button
            onClick={handlePrintPDF}
            className="flex items-center space-x-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl uppercase tracking-widest shadow-lg shadow-cyan-950/40 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Print / PDF Report</span>
          </button>
        </div>
      </div>

      {/* Filter Bar & View Toggle */}
      <div className="bg-[#111] border border-white/5 rounded-3xl p-5 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-400 font-semibold">
            <Filter className="w-4 h-4 text-cyan-400" />
            <span>Filters:</span>
          </div>

          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="All">All Classes</option>
            <option value="Class 9">Class 9</option>
            <option value="Class 10">Class 10</option>
            <option value="Class 11">Class 11</option>
            <option value="Class 12">Class 12</option>
          </select>

          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="All">All Months</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="All">All Statuses</option>
            <option value="Present">Present Only</option>
            <option value="Absent">Absent Only</option>
            <option value="Late">Late Only</option>
            <option value="Leave">Leave Only</option>
            <option value="Holiday">Holiday Only</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="bg-[#0a0a0a] p-1 rounded-xl border border-white/10 flex items-center gap-1">
            <button
              onClick={() => setViewMode('daywise')}
              className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                viewMode === 'daywise'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Day-Wise Register
            </button>
            <button
              onClick={() => setViewMode('summary')}
              className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                viewMode === 'summary'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Summary View
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Student..."
              className="bg-[#0a0a0a] border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 w-44"
            />
          </div>
        </div>
      </div>

      {/* Class Student Attendance Table */}
      <div className="bg-[#111] border border-white/5 rounded-3xl p-6 shadow-2xl">
        <h2 className="text-xs uppercase font-bold tracking-widest text-gray-300 mb-4 flex items-center justify-between">
          <span>
            {viewMode === 'daywise' ? 'Day-Wise Attendance Register' : 'Student Attendance Aggregated Summary'} ({studentSummaries.length} Students)
          </span>
          <span className="text-[10px] text-gray-500 font-normal">
            {onMarkAttendance ? '💡 Click any status badge in register to toggle status' : 'Attendance Rule: Min 75% for Eligibility'}
          </span>
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300">
            <thead className="bg-[#0a0a0a] text-gray-500 uppercase text-[10px] tracking-widest font-bold">
              <tr>
                <th className="px-3 py-2.5 rounded-l-xl">ID</th>
                <th className="px-3 py-2.5">Name</th>
                <th className="px-3 py-2.5">Class</th>

                {/* Render Day Columns if in DayWise view */}
                {viewMode === 'daywise' &&
                  (uniqueDates.length > 0 ? (
                    uniqueDates.map((d) => (
                      <th key={d} className="px-3 py-2.5 text-center min-w-[70px]">
                        {d.slice(5)}
                      </th>
                    ))
                  ) : (
                    <th className="px-3 py-2.5 text-center">Dates</th>
                  ))}

                <th className="px-3 py-2.5 text-center">Days</th>
                <th className="px-3 py-2.5 text-center">Present</th>
                <th className="px-3 py-2.5 text-center">Absent</th>
                <th className="px-3 py-2.5 text-center">Late</th>
                <th className="px-3 py-2.5 text-center">Leave</th>
                <th className="px-3 py-2.5 text-center">%</th>
                <th className="px-3 py-2.5 text-right rounded-r-xl">Eligibility</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {studentSummaries.length === 0 ? (
                <tr>
                  <td
                    colSpan={
                      10 + (viewMode === 'daywise' ? (uniqueDates.length > 0 ? uniqueDates.length : 1) : 0)
                    }
                    className="px-4 py-8 text-center text-gray-400 italic font-medium"
                  >
                    No matching students found{searchQuery ? ` for "${searchQuery}"` : ''}.
                  </td>
                </tr>
              ) : (
                studentSummaries.map((s) => (
                <tr key={s.studentId} className="hover:bg-white/5 transition-colors">
                  <td className="px-3 py-3 font-mono font-bold text-cyan-400">{s.studentId}</td>
                  <td className="px-3 py-3 font-semibold text-white">{s.name}</td>
                  <td className="px-3 py-3">{s.className}</td>

                  {/* Render Day-Wise Status Pills */}
                  {viewMode === 'daywise' &&
                    (uniqueDates.length > 0 ? (
                      uniqueDates.map((d) => {
                        const rec = studentDateMap[s.studentId.toLowerCase()]?.[d];
                        const status = rec ? rec.status : '-';
                        return (
                          <td key={d} className="px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleCellStatusClick(s.studentId, s.name, d, status)}
                              title={onMarkAttendance ? `Click to cycle status for ${s.name} on ${d}` : undefined}
                              className={`transition-all rounded focus:outline-none ${onMarkAttendance ? 'hover:scale-105 cursor-pointer' : ''}`}
                            >
                              {status === 'Present' ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  Present
                                </span>
                              ) : status === 'Absent' ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                  Absent
                                </span>
                              ) : status === 'Late' ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  Late
                                </span>
                              ) : status === 'Leave' ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                  Leave
                                </span>
                              ) : status === 'Holiday' ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                  Holiday
                                </span>
                              ) : (
                                <span className="text-gray-600 font-mono hover:text-cyan-400 px-1 py-0.5">-</span>
                              )}
                            </button>
                          </td>
                        );
                      })
                    ) : (
                      <td className="px-3 py-3 text-center text-gray-500 italic">No dates</td>
                    ))}

                  <td className="px-3 py-3 text-center">{s.workingDays}</td>
                  <td className="px-3 py-3 text-center text-emerald-400 font-bold">{s.present}</td>
                  <td className="px-3 py-3 text-center text-rose-400 font-bold">{s.absent}</td>
                  <td className="px-3 py-3 text-center text-amber-400 font-bold">{s.late}</td>
                  <td className="px-3 py-3 text-center text-cyan-400 font-bold">{s.leave}</td>
                  <td className="px-3 py-3 text-center font-bold">
                    <span className={s.percentage >= 75 ? 'text-emerald-400' : 'text-rose-400'}>
                      {s.percentage}%
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        s.percentage >= 75
                          ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                      }`}
                    >
                      {s.percentage >= 75 ? 'Eligible' : 'Shortage'}
                    </span>
                  </td>
                </tr>
              ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
