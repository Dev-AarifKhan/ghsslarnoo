import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  UserCheck,
  UserX,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { Student, ClassName, AttendanceStatus, AttendanceRecord } from '../types';

interface ManualAttendanceViewProps {
  students: Student[];
  attendance: AttendanceRecord[];
  onMarkAttendance: (
    studentId: string,
    status: AttendanceStatus,
    date?: string,
    time?: string,
    remarks?: string
  ) => { success: boolean; message: string };
  onMarkAttendanceBatch?: (
    items: Array<{
      studentId: string;
      status: AttendanceStatus;
      date?: string;
      time?: string;
      remarks?: string;
    }>
  ) => { success: boolean; count: number; message: string };
}

export const ManualAttendanceView: React.FC<ManualAttendanceViewProps> = ({
  students,
  attendance,
  onMarkAttendance,
  onMarkAttendanceBatch,
}) => {
  const [selectedClass, setSelectedClass] = useState<ClassName>('Class 9');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus | 'Unmarked'>>({});
  const [feedback, setFeedback] = useState<string | null>(null);

  const normalizeClassName = (rawClass: string | undefined | null): string => {
    if (!rawClass) return '';
    const classStr = String(rawClass).trim().toLowerCase();
    if (classStr.includes('12') || classStr.includes('twelve')) return 'Class 12';
    if (classStr.includes('11') || classStr.includes('eleven')) return 'Class 11';
    if (classStr.includes('10') || classStr.includes('ten')) return 'Class 10';
    if (classStr.includes('9') || classStr.includes('nine')) return 'Class 9';
    return String(rawClass).trim();
  };

  const classStudents = students.filter((s) => {
    const matchesClass =
      s.className === selectedClass ||
      normalizeClassName(s.className) === normalizeClassName(selectedClass);
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesClass && matchesSearch;
  });

  // Sync state with existing attendance records for selectedDate and selectedClass
  useEffect(() => {
    const initialStatuses: Record<string, AttendanceStatus | 'Unmarked'> = {};
    classStudents.forEach((s) => {
      const existingRecord = attendance.find(
        (r) => r.studentId.toLowerCase() === s.id.toLowerCase() && r.date === selectedDate
      );
      if (existingRecord) {
        initialStatuses[s.id] = existingRecord.status;
      } else {
        initialStatuses[s.id] = 'Unmarked';
      }
    });
    setStatuses(initialStatuses);
  }, [selectedClass, selectedDate, attendance]);

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setStatuses((prev) => ({ ...prev, [studentId]: status }));
    const result = onMarkAttendance(studentId, status, selectedDate);
    if (result.success) {
      setFeedback(result.message);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleMarkAll = (status: AttendanceStatus) => {
    const updated: Record<string, AttendanceStatus> = {};
    const items = classStudents.map((s) => {
      updated[s.id] = status;
      return {
        studentId: s.id,
        status,
        date: selectedDate,
      };
    });

    setStatuses((prev) => ({ ...prev, ...updated }));

    if (onMarkAttendanceBatch) {
      onMarkAttendanceBatch(items);
    } else {
      items.forEach((item) => onMarkAttendance(item.studentId, item.status, item.date));
    }

    setFeedback(`Marked all ${classStudents.length} students as ${status} on ${selectedDate}!`);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleMarkRemainingAbsent = () => {
    const updated: Record<string, AttendanceStatus> = {};
    const itemsToMark: Array<{
      studentId: string;
      status: AttendanceStatus;
      date: string;
    }> = [];

    classStudents.forEach((s) => {
      const current = statuses[s.id];
      if (!current || current === 'Unmarked') {
        updated[s.id] = 'Absent';
        itemsToMark.push({
          studentId: s.id,
          status: 'Absent',
          date: selectedDate,
        });
      }
    });

    if (itemsToMark.length === 0) {
      setFeedback('No remaining unmarked students in this class register.');
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    setStatuses((prev) => ({ ...prev, ...updated }));

    if (onMarkAttendanceBatch) {
      onMarkAttendanceBatch(itemsToMark);
    } else {
      itemsToMark.forEach((item) => onMarkAttendance(item.studentId, item.status, item.date));
    }

    setFeedback(`Marked ${itemsToMark.length} remaining student(s) as Absent on ${selectedDate}!`);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleSaveBatchAttendance = () => {
    const items = classStudents.map((s) => {
      const st = statuses[s.id];
      const finalStatus: AttendanceStatus = (!st || st === 'Unmarked') ? 'Absent' : st;
      return {
        studentId: s.id,
        status: finalStatus,
        date: selectedDate,
      };
    });

    const updated: Record<string, AttendanceStatus> = {};
    items.forEach((item) => {
      updated[item.studentId] = item.status;
    });
    setStatuses((prev) => ({ ...prev, ...updated }));

    if (onMarkAttendanceBatch) {
      onMarkAttendanceBatch(items);
    } else {
      items.forEach((item) => onMarkAttendance(item.studentId, item.status, item.date));
    }

    setFeedback(`Batch register saved and updated for ${items.length} students on ${selectedDate}!`);
    setTimeout(() => setFeedback(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111] border border-white/5 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden">
        <div>
          <div className="flex items-center space-x-2 text-[10px] font-bold uppercase tracking-widest text-cyan-500 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Class Register</span>
          </div>
          <h1 className="text-2xl font-serif italic text-white tracking-tight flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-cyan-400" />
            Batch Attendance Registry
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Manually update attendance statuses for students by class and date.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div>
            <label className="block text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-1">Select Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-1">Select Class</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value as ClassName)}
              className="bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
            >
              <option value="Class 9">Class 9</option>
              <option value="Class 10">Class 10</option>
              <option value="Class 11">Class 11</option>
              <option value="Class 12">Class 12</option>
            </select>
          </div>
        </div>
      </div>

      {feedback && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-2xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Class Batch Attendance Table */}
      <div className="bg-[#111] border border-white/5 rounded-3xl p-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">
              {selectedClass} Roster ({classStudents.length})
            </p>

            <div className="relative ml-2">
              <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="bg-[#0a0a0a] border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none w-32 sm:w-44"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleMarkAll('Present')}
              className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 rounded-xl text-xs font-semibold transition-all"
            >
              All Present
            </button>
            <button
              onClick={() => handleMarkAll('Absent')}
              className="px-3 py-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 rounded-xl text-xs font-semibold transition-all"
            >
              All Absent
            </button>
            <button
              onClick={handleMarkRemainingAbsent}
              className="px-3 py-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
              title="Mark all remaining unmarked students as Absent"
            >
              <UserX className="w-3.5 h-3.5" />
              <span>Mark Remaining Absent</span>
            </button>
            <button
              onClick={() => handleMarkAll('Holiday')}
              className="px-3 py-1.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 rounded-xl text-xs font-semibold transition-all"
            >
              Mark Holiday
            </button>
            <button
              onClick={handleSaveBatchAttendance}
              className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-cyan-950/40 transition-all"
            >
              Save Class Register
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300">
            <thead className="bg-[#0a0a0a] text-gray-500 uppercase text-[10px] tracking-widest font-bold">
              <tr>
                <th className="px-4 py-3 rounded-l-xl">ID</th>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Parentage</th>
                <th className="px-4 py-3 text-center rounded-r-xl">Mark Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {classStudents.map((s) => {
                const currentStatus = statuses[s.id] || 'Unmarked';
                return (
                  <tr key={s.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-cyan-400">{s.id}</td>
                    <td className="px-4 py-3 font-semibold text-white">{s.name}</td>
                    <td className="px-4 py-3 text-gray-400">{s.parentage}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-1 bg-[#0a0a0a] p-1 rounded-xl border border-white/5">
                        {currentStatus === 'Unmarked' && (
                          <span className="text-[10px] text-amber-400/80 font-mono px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 mr-1">
                            Not Marked
                          </span>
                        )}
                        <button
                          onClick={() => handleStatusChange(s.id, 'Present')}
                          className={`px-3 py-1 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all ${
                            currentStatus === 'Present'
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          Present
                        </button>
                        <button
                          onClick={() => handleStatusChange(s.id, 'Absent')}
                          className={`px-3 py-1 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all ${
                            currentStatus === 'Absent'
                              ? 'bg-rose-600 text-white shadow-sm'
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          Absent
                        </button>
                        <button
                          onClick={() => handleStatusChange(s.id, 'Late')}
                          className={`px-3 py-1 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all ${
                            currentStatus === 'Late'
                              ? 'bg-amber-600 text-white shadow-sm'
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          Late
                        </button>
                        <button
                          onClick={() => handleStatusChange(s.id, 'Leave')}
                          className={`px-3 py-1 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all ${
                            currentStatus === 'Leave'
                              ? 'bg-cyan-600 text-white shadow-sm'
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          Leave
                        </button>
                        <button
                          onClick={() => handleStatusChange(s.id, 'Holiday')}
                          className={`px-3 py-1 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all ${
                            currentStatus === 'Holiday'
                              ? 'bg-purple-600 text-white shadow-sm'
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          Holiday
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
