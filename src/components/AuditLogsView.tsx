import React from 'react';
import { History, ShieldCheck, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { ActivityLog } from '../types';

interface AuditLogsViewProps {
  logs: ActivityLog[];
}

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({ logs }) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <History className="w-6 h-6 text-blue-400" />
            System Audit & Activity Logs
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Complete security audit trail tracking enrollment, attendance scans, edits, and Google Sheets syncs.
          </p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md">
        <div className="overflow-x-auto overflow-y-auto max-h-[520px] scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-800/50">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/90 backdrop-blur-sm text-slate-400 uppercase text-[10px] font-bold sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-3 rounded-l-xl">Log ID</th>
                <th className="px-4 py-3">Activity</th>
                <th className="px-4 py-3">Details</th>
                <th className="px-4 py-3">User / System</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3 text-right rounded-r-xl">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-blue-400">{log.id}</td>
                  <td className="px-4 py-3 font-semibold text-slate-100">{log.activity}</td>
                  <td className="px-4 py-3 text-slate-400">{log.details || '—'}</td>
                  <td className="px-4 py-3 text-slate-300">{log.user}</td>
                  <td className="px-4 py-3 text-slate-400">{log.time}</td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                        log.status === 'Success'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : log.status === 'Warning'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : log.status === 'Error'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}
                    >
                      {log.status === 'Success' && <CheckCircle2 className="w-3 h-3" />}
                      {log.status === 'Warning' && <AlertCircle className="w-3 h-3" />}
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
