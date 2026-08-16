import React, { useState, useEffect } from 'react';
import {
  X,
  Phone,
  Mail,
  MessageSquare,
  Send,
  Copy,
  Check,
  AlertTriangle,
  ExternalLink,
  Save,
  CheckCircle2,
  Share2,
} from 'lucide-react';
import { Student, AppSettings } from '../types';
import { addLog } from '../services/storage';

export interface StudentAttendanceStat {
  student: Student;
  percentage: number;
  present: number;
  absent: number;
  late: number;
  leave: number;
  total: number;
  status: 'critical' | 'warning' | 'good';
}

interface ParentNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentStat: StudentAttendanceStat | null;
  settings: AppSettings;
  threshold: number;
  onUpdateStudent?: (student: Student) => void;
}

export const ParentNotificationModal: React.FC<ParentNotificationModalProps> = ({
  isOpen,
  onClose,
  studentStat,
  settings,
  threshold,
  onUpdateStudent,
}) => {
  if (!isOpen || !studentStat) return null;

  const { student, percentage, present, absent, late, total } = studentStat;

  const [parentPhone, setParentPhone] = useState<string>(student.phone || '');
  const [parentEmail, setParentEmail] = useState<string>(student.email || '');
  const [saveToProfile, setSaveToProfile] = useState<boolean>(true);
  const [templateType, setTemplateType] = useState<'standard' | 'urgent' | 'short'>('standard');
  const [customMessage, setCustomMessage] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [noticeSentStatus, setNoticeSentStatus] = useState<string | null>(null);

  // Generate message based on template
  useEffect(() => {
    const schoolName = settings.schoolName || 'Govt. Higher Secondary School Larnoo';
    const teacherName = settings.teacherName || 'Instructor';
    const parentTitle = student.parentage ? `Mr./Mrs. (${student.parentage})` : 'Parent / Guardian';

    let msg = '';
    if (templateType === 'standard') {
      msg = `*OFFICIAL ATTENDANCE NOTICE*\n\nDear ${parentTitle},\n\nThis is an official update from ${schoolName} regarding your ward *${student.name}* (ID: ${student.id}, ${student.className}).\n\n` +
        `Current Vocational Attendance: *${percentage}%* (Minimum required: ${threshold}%)\n` +
        `• Days Present: ${present}\n` +
        `• Days Absent: ${absent}\n` +
        `• Total Sessions: ${total}\n\n` +
        `As attendance is below the mandatory ${threshold}% threshold, please ensure your ward attends upcoming vocational classes regularly to avoid academic detention.\n\n` +
        `Regards,\n*${teacherName}*\nVocational IT Department, ${schoolName}`;
    } else if (templateType === 'urgent') {
      msg = `*URGENT: CRITICAL LOW ATTENDANCE ALERT*\n\nDear Parent of *${student.name}* (${student.className}, ID: ${student.id}),\n\n` +
        `Your ward's attendance at ${schoolName} has dropped to a critical level of *${percentage}%* (${absent} days absent out of ${total} sessions).\n\n` +
        `Immediate parent-teacher intervention is required. Kindly contact the vocational instructor *${teacherName}* or visit the school office at your earliest convenience.\n\n` +
        `${schoolName}`;
    } else {
      msg = `Attendance Alert: ${student.name} (${student.className}) has ${percentage}% attendance at ${schoolName} (${absent} days absent, req: ${threshold}%). Please ensure regular attendance. - ${teacherName}`;
    }

    setCustomMessage(msg);
  }, [student, percentage, present, absent, total, settings, threshold, templateType]);

  // Clean phone number for WhatsApp / SMS
  const formatPhoneForWhatsApp = (rawPhone: string): string => {
    let digits = rawPhone.replace(/\D/g, '');
    if (digits.length === 10) {
      digits = '91' + digits; // Default India prefix for 10-digit mobile
    }
    return digits;
  };

  const handleSaveContactInfo = () => {
    if (onUpdateStudent && (parentPhone !== student.phone || parentEmail !== student.email)) {
      const updated: Student = {
        ...student,
        phone: parentPhone.trim(),
        email: parentEmail.trim(),
      };
      onUpdateStudent(updated);
    }
  };

  const handleWhatsAppSend = () => {
    if (saveToProfile) handleSaveContactInfo();

    const cleanPhone = formatPhoneForWhatsApp(parentPhone);
    const encodedText = encodeURIComponent(customMessage);

    let url = '';
    if (cleanPhone) {
      url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
    } else {
      url = `https://api.whatsapp.com/send?text=${encodedText}`;
    }

    window.open(url, '_blank');
    addLog(
      'Parent WhatsApp Alert',
      `Sent low attendance warning to parent of ${student.name} (${student.id}, ${percentage}%)`,
      'Info'
    );
    setNoticeSentStatus('Opened WhatsApp with formatted notice.');
    setTimeout(() => setNoticeSentStatus(null), 4000);
  };

  const handleSMSSend = () => {
    if (saveToProfile) handleSaveContactInfo();

    const cleanPhone = parentPhone.replace(/[^\d+]/g, '');
    const encodedText = encodeURIComponent(customMessage);
    const smsUrl = cleanPhone ? `sms:${cleanPhone}?body=${encodedText}` : `sms:?body=${encodedText}`;

    window.location.href = smsUrl;
    addLog(
      'Parent SMS Alert',
      `Sent low attendance SMS warning to parent of ${student.name} (${student.id}, ${percentage}%)`,
      'Info'
    );
    setNoticeSentStatus('Opened native SMS messenger.');
    setTimeout(() => setNoticeSentStatus(null), 4000);
  };

  const handleEmailSend = () => {
    if (saveToProfile) handleSaveContactInfo();

    const subject = encodeURIComponent(
      `Official Attendance Notice: Low Attendance Warning for ${student.name} (${student.className})`
    );
    const body = encodeURIComponent(customMessage.replace(/\*/g, ''));
    const mailtoUrl = parentEmail
      ? `mailto:${parentEmail}?subject=${subject}&body=${body}`
      : `mailto:?subject=${subject}&body=${body}`;

    window.location.href = mailtoUrl;
    addLog(
      'Parent Email Notice',
      `Dispatched attendance email warning to parent of ${student.name} (${student.id})`,
      'Info'
    );
    setNoticeSentStatus('Opened email client.');
    setTimeout(() => setNoticeSentStatus(null), 4000);
  };

  const handleCopy = () => {
    if (saveToProfile) handleSaveContactInfo();

    navigator.clipboard.writeText(customMessage);
    setCopied(true);
    addLog(
      'Attendance Notice Copied',
      `Copied attendance notice for parent of ${student.name} (${student.id}) to clipboard`,
      'Info'
    );
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      id="parent-notification-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn overflow-y-auto"
    >
      <div className="bg-[#111] border border-white/10 rounded-3xl w-full max-w-2xl text-white shadow-2xl overflow-hidden my-6">
        {/* Modal Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-amber-950/30 via-transparent to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Inform Parent • Low Attendance Notice
              </h2>
              <p className="text-[11px] text-gray-400">
                Official warning notice for student falling below {threshold}% attendance threshold
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Student At-Risk Overview Card */}
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              {student.photoUrl ? (
                <img
                  src={student.photoUrl}
                  alt={student.name}
                  className="w-12 h-12 rounded-xl object-cover border border-white/10 shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-cyan-950 border border-cyan-500/30 flex items-center justify-center text-cyan-300 font-bold text-sm shrink-0">
                  {student.name.substring(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-white text-sm">{student.name}</h3>
                  <span className="text-[10px] font-mono font-semibold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded-md border border-cyan-800/40">
                    {student.id}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {student.className} {student.stream ? `• ${student.stream}` : ''}
                </p>
                {student.parentage && (
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Parent/Guardian: <span className="text-gray-300 font-medium">{student.parentage}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Visual Attendance Badge */}
            <div className="text-right sm:border-l sm:border-white/10 sm:pl-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold text-sm font-mono">
                <span>{percentage}%</span>
                <span className="text-[10px] uppercase font-sans font-normal tracking-wide">
                  ({percentage < 50 ? 'Critical' : 'Low'})
                </span>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                Absent: <strong className="text-rose-400">{absent}</strong> / {total} days
              </p>
            </div>
          </div>

          {/* Parent Contact Information Inputs */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
              <span>Parent / Guardian Contact Details</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-gray-300 font-medium mb-1 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-emerald-400" />
                  Parent Phone / WhatsApp Number
                </label>
                <input
                  type="tel"
                  value={parentPhone}
                  onChange={(e) => setParentPhone(e.target.value)}
                  placeholder="e.g. 9876543210 or +919876543210"
                  className="w-full bg-[#0a0a0a] border border-white/10 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] text-gray-300 font-medium mb-1 flex items-center gap-1">
                  <Mail className="w-3 h-3 text-cyan-400" />
                  Parent Email Address
                </label>
                <input
                  type="email"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  placeholder="parent@example.com"
                  className="w-full bg-[#0a0a0a] border border-white/10 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                id="save-to-profile-checkbox"
                type="checkbox"
                checked={saveToProfile}
                onChange={(e) => setSaveToProfile(e.target.checked)}
                className="rounded bg-[#0a0a0a] border-white/20 text-amber-500 focus:ring-0 w-3.5 h-3.5"
              />
              <label htmlFor="save-to-profile-checkbox" className="text-[11px] text-gray-400 cursor-pointer">
                Save / update this contact information in student's profile for future notices
              </label>
            </div>
          </div>

          {/* Template Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">
              Select Message Format:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTemplateType('standard')}
                className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all text-center ${
                  templateType === 'standard'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                    : 'bg-[#0a0a0a] border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                Standard Official
              </button>
              <button
                type="button"
                onClick={() => setTemplateType('urgent')}
                className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all text-center ${
                  templateType === 'urgent'
                    ? 'bg-rose-500/20 border-rose-500 text-rose-300 font-bold'
                    : 'bg-[#0a0a0a] border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                Urgent Warning
              </button>
              <button
                type="button"
                onClick={() => setTemplateType('short')}
                className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all text-center ${
                  templateType === 'short'
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold'
                    : 'bg-[#0a0a0a] border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                Short SMS / Alert
              </button>
            </div>
          </div>

          {/* Editable Live Message Preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-gray-400 font-medium">
              <span>Notice Preview & Customization (Editable):</span>
              <span>{customMessage.length} characters</span>
            </div>
            <textarea
              rows={6}
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-white/10 focus:border-amber-500 rounded-2xl p-3 text-xs text-gray-200 font-mono focus:outline-none transition-colors leading-relaxed"
            />
          </div>

          {noticeSentStatus && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{noticeSentStatus}</span>
            </div>
          )}

          {/* Instant Communication Actions */}
          <div className="pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
              Send Via:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* WhatsApp Button */}
              <button
                type="button"
                onClick={handleWhatsAppSend}
                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-3 rounded-xl text-xs transition-all shadow-md active:scale-95"
              >
                <MessageSquare className="w-4 h-4" />
                <span>WhatsApp</span>
              </button>

              {/* Direct SMS Button */}
              <button
                type="button"
                onClick={handleSMSSend}
                className="flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 px-3 rounded-xl text-xs transition-all shadow-md active:scale-95"
              >
                <Send className="w-4 h-4" />
                <span>Direct SMS</span>
              </button>

              {/* Email Notice Button */}
              <button
                type="button"
                onClick={handleEmailSend}
                className="flex items-center justify-center gap-2 bg-cyan-700 hover:bg-cyan-600 text-white font-bold py-2.5 px-3 rounded-xl text-xs transition-all shadow-md active:scale-95"
              >
                <Mail className="w-4 h-4" />
                <span>Email Notice</span>
              </button>

              {/* Copy to Clipboard */}
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center justify-center gap-2 bg-[#222] hover:bg-[#333] border border-white/10 text-gray-200 font-bold py-2.5 px-3 rounded-xl text-xs transition-all shadow-md active:scale-95"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-gray-300" />
                    <span>Copy Text</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/10 bg-[#0a0a0a] flex items-center justify-between text-xs text-gray-500">
          <span>Official School Communication System</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
