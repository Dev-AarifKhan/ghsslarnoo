import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { BarChart2, TrendingUp, AlertTriangle, Users, Sparkles } from 'lucide-react';
import { Student, AttendanceRecord } from '../types';

interface AnalyticsViewProps {
  students: Student[];
  attendance: AttendanceRecord[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ students, attendance }) => {
  // Class Comparison Data
  const classes = ['Class 9', 'Class 10', 'Class 11', 'Class 12'] as const;
  const classComparisonData = classes.map((cName) => {
    const classRecords = attendance.filter((r) => r.className === cName);
    const present = classRecords.filter((r) => r.status === 'Present' || r.status === 'Late').length;
    const absent = classRecords.filter((r) => r.status === 'Absent').length;
    const total = classRecords.length || 1;
    const rate = Math.round((present / total) * 100);

    return {
      className: cName,
      Present: present,
      Absent: absent,
      Rate: rate,
    };
  });

  // Overall Status Distribution Pie Data
  const presentTotal = attendance.filter((r) => r.status === 'Present').length;
  const absentTotal = attendance.filter((r) => r.status === 'Absent').length;
  const lateTotal = attendance.filter((r) => r.status === 'Late').length;
  const leaveTotal = attendance.filter((r) => r.status === 'Leave').length;
  const holidayTotal = attendance.filter((r) => r.status === 'Holiday').length;

  const pieData = [
    { name: 'Present', value: presentTotal, color: '#10B981' },
    { name: 'Absent', value: absentTotal, color: '#F43F5E' },
    { name: 'Late', value: lateTotal, color: '#F59E0B' },
    { name: 'Leave', value: leaveTotal, color: '#3B82F6' },
    { name: 'Holiday', value: holidayTotal, color: '#A855F7' },
  ];

  // Attendance Shortage Alert List (<75%)
  const shortageStudents = students
    .map((s) => {
      const sRecords = attendance.filter((r) => r.studentId.toLowerCase() === s.id.toLowerCase());
      const present = sRecords.filter((r) => r.status === 'Present' || r.status === 'Late').length;
      const total = sRecords.length || 1;
      const percentage = Math.round((present / total) * 100);
      return {
        ...s,
        percentage,
        total,
        present,
      };
    })
    .filter((s) => s.percentage < 75);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-blue-400" />
            Vocational Attendance Analytics & Trends
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Visual graphs for monthly attendance rates, class comparisons, and student shortage warnings.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Class Comparison Bar Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md">
          <h2 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            Class-wise Attendance Rate Comparison (%)
          </h2>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={classComparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="className" stroke="#94A3B8" fontSize={12} />
                <YAxis stroke="#94A3B8" fontSize={12} unit="%" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', color: '#F8FAFC' }}
                />
                <Bar dataKey="Rate" fill="#3B82F6" radius={[6, 6, 0, 0]} name="Attendance Rate %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Overall Status Distribution Pie Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md">
          <h2 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            Overall Status Breakdown (Present / Absent / Late / Leave)
          </h2>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', color: '#F8FAFC' }}
                />
                <Legend formatter={(value) => <span className="text-xs text-slate-300">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Attendance Shortage Warnings (<75%) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md">
        <h2 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          Attendance Shortage Alert List (&lt; 75% Attendance Threshold)
        </h2>

        {shortageStudents.length === 0 ? (
          <div className="p-8 text-center text-emerald-400 text-xs font-semibold">
            🎉 All enrolled vocational students meet or exceed the mandatory 75% attendance criteria!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px] font-bold">
                <tr>
                  <th className="px-4 py-3 rounded-l-xl">Student ID</th>
                  <th className="px-4 py-3">Student Name</th>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Parentage</th>
                  <th className="px-4 py-3 text-center">Attendance %</th>
                  <th className="px-4 py-3 text-right rounded-r-xl">Action Required</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {shortageStudents.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-rose-400">{st.id}</td>
                    <td className="px-4 py-3 font-semibold text-slate-100">{st.name}</td>
                    <td className="px-4 py-3">{st.className}</td>
                    <td className="px-4 py-3 text-slate-400">{st.parentage}</td>
                    <td className="px-4 py-3 text-center font-bold text-rose-400">
                      {st.percentage}%
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="px-2.5 py-1 bg-rose-500/10 text-rose-300 border border-rose-500/20 rounded-md font-bold text-[10px]">
                        Send Parent Alert
                      </span>
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
