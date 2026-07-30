import React, { useState, useRef } from 'react';
import {
  UserCheck,
  Search,
  Calendar,
  Download,
  Share2,
  FileImage,
  User,
  School,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  MessageSquare,
  Mail,
  Send,
  ShieldCheck,
  Building2,
  BookOpen,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { Student, AttendanceRecord, AppSettings } from '../types';

interface StudentViewerProps {
  students: Student[];
  attendance: AttendanceRecord[];
  settings?: AppSettings;
}

export const StudentViewer: React.FC<StudentViewerProps> = ({
  students,
  attendance,
  settings,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'calendar' | 'report'>('calendar');
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    students[0]?.id || ''
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'none'>('asc');

  const today = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [selectedMonthIdx, setSelectedMonthIdx] = useState<number>(today.getMonth()); // 0-based

  // Report generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const reportCardRef = useRef<HTMLDivElement>(null);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const selectedStudent = students.find((s) => s.id === selectedStudentId) || students[0];

  const filteredStudents = students.filter(
    (s) =>
      s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.className.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedStudents = [...filteredStudents].sort((a, b) => {
    if (sortOrder === 'asc') return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    if (sortOrder === 'desc') return b.name.localeCompare(a.name, undefined, { sensitivity: 'base' });
    return 0;
  });

  // Filter all records for selected student
  const studentRecordsAll = attendance.filter(
    (r) => r.studentId.toLowerCase() === selectedStudent?.id.toLowerCase()
  );

  // Overall student stats
  const totalPresentAll = studentRecordsAll.filter((r) => r.status === 'Present').length;
  const totalAbsentAll = studentRecordsAll.filter((r) => r.status === 'Absent').length;
  const totalLateAll = studentRecordsAll.filter((r) => r.status === 'Late').length;
  const totalLeaveAll = studentRecordsAll.filter((r) => r.status === 'Leave').length;
  const totalOverallRecords = studentRecordsAll.length || 1;
  const overallPercentage = Math.round(((totalPresentAll + totalLateAll) / totalOverallRecords) * 100);

  // Month-specific calculations
  const daysInMonth = new Date(selectedYear, selectedMonthIdx + 1, 0).getDate();
  const firstDayOfWeek = new Date(selectedYear, selectedMonthIdx, 1).getDay(); // 0 = Sun, 1 = Mon, ...

  // Records for the specific month and year
  const monthRecords = studentRecordsAll.filter((r) => {
    if (!r.date) return false;
    const [yStr, mStr] = r.date.split('-');
    return (
      parseInt(yStr, 10) === selectedYear &&
      parseInt(mStr, 10) === selectedMonthIdx + 1
    );
  });

  const monthPresent = monthRecords.filter((r) => r.status === 'Present').length;
  const monthAbsent = monthRecords.filter((r) => r.status === 'Absent').length;
  const monthLate = monthRecords.filter((r) => r.status === 'Late').length;
  const monthLeave = monthRecords.filter((r) => r.status === 'Leave').length;
  const monthHoliday = monthRecords.filter((r) => r.status === 'Holiday').length;

  // Calendar days builder
  const monthCalendarDays = Array.from({ length: daysInMonth }, (_, i) => {
    const dayNum = i + 1;
    const dateStr = `${selectedYear}-${String(selectedMonthIdx + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const dayOfWeek = new Date(selectedYear, selectedMonthIdx, dayNum).getDay();
    const isSunday = dayOfWeek === 0;

    const record = monthRecords.find((r) => r.date === dateStr);

    let effectiveStatus: 'Present' | 'Absent' | 'Late' | 'Leave' | 'Holiday' | undefined = undefined;
    if (record?.status) {
      effectiveStatus = record.status;
    } else if (isSunday) {
      effectiveStatus = 'Holiday';
    }

    return {
      dayNum,
      dateStr,
      isSunday,
      record,
      effectiveStatus,
    };
  });

  // Calculate totals including Sundays as Holidays if not explicitly marked
  const totalSundaysInMonth = monthCalendarDays.filter((d) => d.isSunday && !d.record).length;
  const totalHolidaysInMonth = monthHoliday + totalSundaysInMonth;
  const workingDaysInMonth = Math.max(1, daysInMonth - totalHolidaysInMonth);
  const totalAttendedMonth = monthPresent + monthLate;
  const monthAttendancePercentage = Math.round((totalAttendedMonth / Math.max(1, monthPresent + monthAbsent + monthLate + monthLeave)) * 100);

  // Helper to convert modern CSS color functions (like oklch, oklab, color-mix) into standard rgb/rgba
  const convertModernColorFunctions = (str: string): string => {
    if (!str) return str;
    let result = str;

    result = result.replace(/oklch\(([^)]+)\)/gi, (match, content) => {
      try {
        const parts = content.trim().split(/[\s\/]+/);
        if (parts.length < 3) return match;

        const lStr = parts[0];
        const cStr = parts[1];
        const hStr = parts[2];
        const aStr = parts[3];

        let L = lStr.endsWith('%') ? parseFloat(lStr) / 100 : parseFloat(lStr);
        let C = parseFloat(cStr);
        let H = parseFloat(hStr);
        if (isNaN(H)) H = 0;

        let alpha = 1;
        if (aStr !== undefined) {
          alpha = aStr.endsWith('%') ? parseFloat(aStr) / 100 : parseFloat(aStr);
          if (isNaN(alpha)) alpha = 1;
        }

        if (isNaN(L) || isNaN(C)) return match;

        // OKLCH to OKLAB
        const rad = (H * Math.PI) / 180;
        const aLab = C * Math.cos(rad);
        const bLab = C * Math.sin(rad);

        // OKLAB to linear RGB
        const l_ = L + 0.3963377774 * aLab + 0.2158037573 * bLab;
        const m_ = L - 0.1055613458 * aLab - 0.0638541728 * bLab;
        const s_ = L - 0.0894841775 * aLab - 1.291485548 * bLab;

        const l = l_ * l_ * l_;
        const m = m_ * m_ * m_;
        const s = s_ * s_ * s_;

        let r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
        let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
        let b = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

        // Gamma correction
        r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
        g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
        b = b > 0.0031308 ? 1.055 * Math.pow(b, 1 / 2.4) - 0.055 : 12.92 * b;

        const r255 = Math.min(255, Math.max(0, Math.round(r * 255)));
        const g255 = Math.min(255, Math.max(0, Math.round(g * 255)));
        const b255 = Math.min(255, Math.max(0, Math.round(b * 255)));

        return alpha < 1
          ? `rgba(${r255}, ${g255}, ${b255}, ${alpha})`
          : `rgb(${r255}, ${g255}, ${b255})`;
      } catch (e) {
        return match;
      }
    });

    result = result.replace(/oklab\([^)]+\)/gi, 'rgb(15, 23, 42)');
    result = result.replace(/color-mix\([^)]+\)/gi, 'rgb(15, 23, 42)');

    return result;
  };

  // Preload all images inside container before canvas rendering
  const ensureImagesLoaded = async (element: HTMLElement) => {
    const images = Array.from(element.querySelectorAll('img'));
    const promises = images.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    });
    await Promise.all(promises);
  };

  // Render report HTML element safely to Canvas
  const renderReportToCanvas = async (element: HTMLElement): Promise<HTMLCanvasElement> => {
    await ensureImagesLoaded(element);
    return await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#0f172a',
      scrollX: 0,
      scrollY: 0,
      windowWidth: element.scrollWidth || 800,
      windowHeight: element.scrollHeight || 1000,
      onclone: (clonedDoc, clonedElement) => {
        // 1. Sanitize all <style> tags in document head/body
        const styleEls = clonedDoc.querySelectorAll('style');
        styleEls.forEach((s) => {
          if (s.textContent && /oklch|oklab|color-mix/i.test(s.textContent)) {
            s.textContent = convertModernColorFunctions(s.textContent);
          }
        });

        // 2. Sanitize element and children
        const targetEl = clonedElement || clonedDoc.querySelector('[data-report-card]') || clonedDoc.body;
        if (targetEl) {
          const targets = [targetEl, ...Array.from(targetEl.querySelectorAll('*'))];
          const view = clonedDoc.defaultView || window;
          const colorProps = [
            'color',
            'background-color',
            'border-color',
            'border-top-color',
            'border-right-color',
            'border-bottom-color',
            'border-left-color',
            'outline-color',
            'fill',
            'stroke',
            'box-shadow',
            'text-shadow',
          ];

          targets.forEach((el) => {
            const htmlEl = el as HTMLElement;
            const styleAttr = htmlEl.getAttribute('style');
            if (styleAttr && /oklch|oklab|color-mix/i.test(styleAttr)) {
              htmlEl.setAttribute('style', convertModernColorFunctions(styleAttr));
            }

            try {
              const computed = view.getComputedStyle(el);
              colorProps.forEach((prop) => {
                const val = computed.getPropertyValue(prop);
                if (val && typeof val === 'string' && /oklch|oklab|color-mix/i.test(val)) {
                  htmlEl.style.setProperty(prop, convertModernColorFunctions(val));
                }
              });
            } catch (e) {
              // Ignore computed style inspect errors
            }
          });
        }
      },
    });
  };

  // Helper to trigger local computer download via Blob URL
  const downloadFileBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  };

  // Download High Quality PNG directly
  const handleDownloadPNG = async () => {
    if (!reportCardRef.current || !selectedStudent) return;
    setIsGenerating(true);
    setDownloadMessage(null);

    try {
      const canvas = await renderReportToCanvas(reportCardRef.current);
      const safeName = selectedStudent.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `${safeName}_${monthNames[selectedMonthIdx]}_${selectedYear}_Attendance_Report.png`;

      if (canvas.toBlob) {
        canvas.toBlob((blob) => {
          if (blob) {
            downloadFileBlob(blob, fileName);
          } else {
            const dataUrl = canvas.toDataURL('image/png', 1.0);
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            setTimeout(() => {
              if (link.parentNode) document.body.removeChild(link);
            }, 1000);
          }
        }, 'image/png', 0.95);
      } else {
        const dataUrl = canvas.toDataURL('image/png', 1.0);
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          if (link.parentNode) document.body.removeChild(link);
        }, 1000);
      }

      setDownloadMessage(`✓ Monthly Attendance Report for ${selectedStudent.name} downloaded as PNG!`);
      setTimeout(() => setDownloadMessage(null), 5000);
    } catch (err: any) {
      console.error('PNG download error:', err);
      alert(`An error occurred while generating PNG: ${err?.message || 'Please try again.'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Share Report via Web Share API or Fallback Modal
  const handleShareReport = async () => {
    if (!reportCardRef.current || !selectedStudent) return;
    setIsGenerating(true);

    try {
      const canvas = await renderReportToCanvas(reportCardRef.current);
      const fileName = `${selectedStudent.name.replace(/\s+/g, '_')}_${monthNames[selectedMonthIdx]}_${selectedYear}_Attendance_Report.png`;

      canvas.toBlob(async (blob) => {
        if (!blob) {
          setIsGenerating(false);
          setShowShareModal(true);
          return;
        }

        const file = new File([blob], fileName, { type: 'image/png' });

        // Check if device supports sharing files directly (WhatsApp, Mail, etc.)
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `${selectedStudent.name} - Monthly Attendance Report`,
              text: `📊 Monthly Attendance Report for ${selectedStudent.name} (${selectedStudent.className}) - ${monthNames[selectedMonthIdx]} ${selectedYear}. Attendance Rate: ${monthAttendancePercentage}%.`,
            });
            setDownloadMessage('✓ Attendance Report shared successfully!');
            setTimeout(() => setDownloadMessage(null), 5000);
          } catch (shareErr) {
            console.log('Native share cancelled or failed, opening fallback share modal');
            setShowShareModal(true);
          }
        } else {
          setShowShareModal(true);
        }
        setIsGenerating(false);
      }, 'image/png', 0.95);
    } catch (err) {
      console.error('Share error:', err);
      setShowShareModal(true);
      setIsGenerating(false);
    }
  };

  // Formatted Text Summary for WhatsApp / Copying
  const reportTextSummary = `📋 *MONTHLY ATTENDANCE REPORT*
🏫 *School:* ${settings?.schoolName || 'Vocational Higher Secondary School'}
👤 *Student Name:* ${selectedStudent?.name || ''}
🆔 *Student ID:* ${selectedStudent?.id || ''}
📚 *Class/Section:* ${selectedStudent?.className || ''}
📅 *Month & Year:* ${monthNames[selectedMonthIdx]} ${selectedYear}

📊 *SUMMARY:*
- ✅ Present: ${monthPresent} days
- ❌ Absent: ${monthAbsent} days
- ⏰ Late: ${monthLate} days
- 🔷 Leave: ${monthLeave} days
- 🌸 Holidays/Sundays: ${totalHolidaysInMonth} days
- 📈 Attendance Percentage: ${monthAttendancePercentage}%
- 🎖️ Status: ${monthAttendancePercentage >= 75 ? 'ELIGIBLE (Satisfactory)' : 'SHORTAGE (Needs Improvement)'}

Verified by Smart Student Attendance System.`;

  const copyTextToClipboard = () => {
    navigator.clipboard.writeText(reportTextSummary);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 3000);
  };

  const whatsappShareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(reportTextSummary)}`;
  const emailShareUrl = `mailto:?subject=${encodeURIComponent(`Monthly Attendance Report - ${selectedStudent?.name}`)}&body=${encodeURIComponent(reportTextSummary)}`;

  return (
    <div className="space-y-6">
      {/* Header & Sub-Navigation */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
              <UserCheck className="w-7 h-7 text-blue-400" />
              Student Attendance Hub
            </h1>
            <p className="text-xs text-slate-300 mt-1">
              Inspect student profiles, interactive calendar records, and generate/share monthly PNG attendance reports for parents.
            </p>
          </div>

          {/* Quick Search Student */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ID, Name, or Class..."
              className="w-full bg-slate-800 border border-slate-700 rounded-2xl pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        {/* Sub-Navigation Tabs Option */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
          <button
            onClick={() => setActiveSubTab('calendar')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeSubTab === 'calendar'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 ring-2 ring-blue-400/50'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Calendar className="w-4 h-4 text-blue-300" />
            <span>Interactive Attendance Calendar</span>
          </button>

          <button
            onClick={() => setActiveSubTab('report')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeSubTab === 'report'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-2 ring-emerald-400/50'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <FileImage className="w-4 h-4 text-emerald-300" />
            <span>Download / Share Attendance Report</span>
            <span className="px-2 py-0.5 bg-emerald-400/20 text-emerald-300 text-[10px] uppercase font-extrabold rounded-full border border-emerald-400/30">
              New PNG
            </span>
          </button>
        </div>
      </div>

      {/* Main Grid View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Student List Sidebar */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-md h-fit">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-400" />
              Enrolled Students ({sortedStudents.length})
            </h2>
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

          <div className="max-h-[550px] overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-slate-700">
            {sortedStudents.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No students found.</p>
            ) : (
              sortedStudents.map((st) => (
                <button
                  key={st.id}
                  onClick={() => setSelectedStudentId(st.id)}
                  className={`w-full text-left p-3 rounded-2xl text-xs flex items-center justify-between transition-all ${
                    selectedStudent?.id === st.id
                      ? 'bg-blue-600 text-white font-bold shadow-md'
                      : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-slate-700 flex items-center justify-center font-bold text-xs text-blue-200">
                      {st.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold">{st.name}</p>
                      <p className="text-[10px] opacity-80">{st.className}</p>
                    </div>
                  </div>
                  <span className="font-mono text-[11px] font-bold opacity-90">{st.id}</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Selected Student View Content */}
        {selectedStudent ? (
          <div className="lg:col-span-2 space-y-6">
            {/* SUB-TAB 1: INTERACTIVE CALENDAR VIEW */}
            {activeSubTab === 'calendar' && (
              <>
                {/* Student Profile Overview Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md text-white">
                  <div className="flex flex-col sm:flex-row items-center gap-5 border-b border-slate-800 pb-5">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg shrink-0">
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

                    <button
                      onClick={() => setActiveSubTab('report')}
                      className="px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                    >
                      <FileImage className="w-4 h-4 text-emerald-400" />
                      <span>Get Printable PNG</span>
                    </button>
                  </div>

                  {/* Overall Stats KPI Pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5">
                    <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60 text-center">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Overall Rate</span>
                      <p className={`text-lg font-bold ${overallPercentage >= 75 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {overallPercentage}%
                      </p>
                    </div>
                    <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60 text-center">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Total Present</span>
                      <p className="text-lg font-bold text-emerald-400">{totalPresentAll}</p>
                    </div>
                    <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60 text-center">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Total Absent</span>
                      <p className="text-lg font-bold text-rose-400">{totalAbsentAll}</p>
                    </div>
                    <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60 text-center">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Total Late</span>
                      <p className="text-lg font-bold text-amber-400">{totalLateAll}</p>
                    </div>
                    <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60 text-center">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Total Leave</span>
                      <p className="text-lg font-bold text-blue-400">{totalLeaveAll}</p>
                    </div>
                  </div>
                </div>

                {/* Monthly Interactive Calendar View */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-slate-800 pb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-400" />
                      <h3 className="text-sm font-bold text-slate-200">
                        Monthly Calendar View ({monthNames[selectedMonthIdx]} {selectedYear})
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
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Present
                    </span>
                    <span className="flex items-center gap-1.5 text-rose-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Absent
                    </span>
                    <span className="flex items-center gap-1.5 text-amber-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Late
                    </span>
                    <span className="flex items-center gap-1.5 text-blue-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Leave
                    </span>
                    <span className="flex items-center gap-1.5 text-pink-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-pink-500" /> Holiday
                    </span>
                  </div>

                  {/* Days Grid */}
                  <div className="grid grid-cols-7 gap-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                      <div key={d} className="text-center text-[10px] font-bold text-slate-500 uppercase py-1">
                        {d}
                      </div>
                    ))}

                    {/* Empty padding cells */}
                    {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                      <div key={`pad-${idx}`} className="h-12 rounded-xl p-1.5 bg-slate-950/20 border border-slate-800/30" />
                    ))}

                    {monthCalendarDays.map((cd) => {
                      const status = cd.effectiveStatus;
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
                              ? 'bg-pink-500/10 border-pink-500/30 text-pink-300'
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
              </>
            )}

            {/* SUB-TAB 2: DOWNLOAD / SHARE ATTENDANCE REPORT */}
            {activeSubTab === 'report' && (
              <div className="space-y-6">
                {/* Control Panel Bar */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg text-white space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                    <div>
                      <h2 className="text-base font-bold flex items-center gap-2">
                        <FileImage className="w-5 h-5 text-emerald-400" />
                        Generate Monthly Attendance PNG Report
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Select student, month, and year to generate a color-coded printable calendar PNG for parents.
                      </p>
                    </div>

                    {/* Download & Share Action Buttons */}
                    <div className="flex items-center gap-2.5 shrink-0">
                      <button
                        onClick={handleDownloadPNG}
                        disabled={isGenerating}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                      >
                        {isGenerating ? (
                          <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        ) : (
                          <Download className="w-4 h-4 text-white" />
                        )}
                        <span>Download PNG</span>
                      </button>

                      <button
                        onClick={handleShareReport}
                        disabled={isGenerating}
                        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                      >
                        {isGenerating ? (
                          <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        ) : (
                          <Share2 className="w-4 h-4 text-white" />
                        )}
                        <span>Share Report</span>
                      </button>
                    </div>
                  </div>

                  {/* Notification Feedback Toast */}
                  {downloadMessage && (
                    <div className="bg-emerald-500/20 border border-emerald-500/40 p-3 rounded-2xl text-emerald-300 text-xs font-bold flex items-center justify-between">
                      <span>{downloadMessage}</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    </div>
                  )}

                  {/* Filter Selectors */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                        Select Student
                      </label>
                      <select
                        value={selectedStudentId}
                        onChange={(e) => setSelectedStudentId(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
                      >
                        {students.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.className} • ID: {s.id})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                        Select Month
                      </label>
                      <select
                        value={selectedMonthIdx}
                        onChange={(e) => setSelectedMonthIdx(parseInt(e.target.value, 10))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
                      >
                        {monthNames.map((m, idx) => (
                          <option key={m} value={idx}>{m}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                        Select Year
                      </label>
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
                      >
                        {[2024, 2025, 2026, 2027, 2028].map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* THE VISUALLY ATTRACTIVE ATTENDANCE REPORT CARD (Target for HTML2Canvas) */}
                <div className="overflow-x-auto pb-4">
                  <div
                    ref={reportCardRef}
                    data-report-card="true"
                    className="w-full min-w-[340px] max-w-[720px] mx-auto bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 sm:p-8 text-white shadow-2xl space-y-6 font-sans relative overflow-hidden"
                  >
                    {/* Decorative Top Accent Bar */}
                    <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500" />

                    {/* Report Card Header */}
                    <div className="flex items-start justify-between border-b border-slate-800 pb-5">
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg shrink-0">
                          <School className="w-6 h-6" />
                        </div>
                        <div>
                          <h2 className="text-base sm:text-lg font-black tracking-tight text-white uppercase">
                            {settings?.schoolName || 'Govt. Vocational Higher Secondary School'}
                          </h2>
                          <p className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider">
                            Department of School Education • Monthly Attendance Report
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="inline-block px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-xs font-black text-amber-300 font-mono">
                          {monthNames[selectedMonthIdx]} {selectedYear}
                        </span>
                      </div>
                    </div>

                    {/* Student Info Box */}
                    <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4 justify-between">
                      <div className="flex items-center gap-3.5 w-full sm:w-auto">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-md shrink-0 border border-white/20">
                          {selectedStudent.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="text-base font-extrabold text-white">{selectedStudent.name}</h3>
                          <p className="text-xs text-slate-300">
                            Parentage: <strong className="text-slate-100">{selectedStudent.parentage || 'N/A'}</strong>
                          </p>
                          <p className="text-xs text-slate-400">
                            Subject/Stream: {selectedStudent.stream || settings?.subjectName || 'Vocational Education'}
                          </p>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-700/60 font-mono text-xs gap-1">
                        <div className="bg-slate-900/90 px-3 py-1 rounded-xl border border-slate-700 text-slate-200">
                          ID: <strong className="text-cyan-300">{selectedStudent.id}</strong>
                        </div>
                        <div className="bg-slate-900/90 px-3 py-1 rounded-xl border border-slate-700 text-slate-200">
                          Class: <strong className="text-emerald-300">{selectedStudent.className}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Color-Coded Calendar Title & Legend */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-emerald-400" />
                          Attendance Calendar Grid ({monthNames[selectedMonthIdx]})
                        </h4>
                      </div>

                      {/* Color-Coded Status Legend */}
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-[10px] font-bold">
                        <div className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-emerald-500 text-white rounded-xl shadow-sm">
                          <span className="w-2 h-2 rounded-full bg-white" />
                          <span>Green = Present</span>
                        </div>
                        <div className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-rose-500 text-white rounded-xl shadow-sm">
                          <span className="w-2 h-2 rounded-full bg-white" />
                          <span>Red = Absent</span>
                        </div>
                        <div className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-amber-400 text-slate-950 rounded-xl shadow-sm">
                          <span className="w-2 h-2 rounded-full bg-slate-950" />
                          <span>Yellow = Late</span>
                        </div>
                        <div className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-blue-500 text-white rounded-xl shadow-sm">
                          <span className="w-2 h-2 rounded-full bg-white" />
                          <span>Blue = Leave</span>
                        </div>
                        <div className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-pink-500 text-white rounded-xl shadow-sm col-span-3 sm:col-span-1">
                          <span className="w-2 h-2 rounded-full bg-white" />
                          <span>Pink = Holiday</span>
                        </div>
                      </div>

                      {/* 7-Column Days Grid */}
                      <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl space-y-2">
                        {/* Weekday Labels */}
                        <div className="grid grid-cols-7 gap-1.5">
                          {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d) => (
                            <div key={d} className="text-center text-[10px] font-black text-slate-400 uppercase py-1">
                              {d}
                            </div>
                          ))}
                        </div>

                        {/* Days Cells */}
                        <div className="grid grid-cols-7 gap-1.5">
                          {/* Empty offset padding */}
                          {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                            <div key={`pad-${idx}`} className="h-11 rounded-xl bg-slate-900/30 border border-slate-800/40" />
                          ))}

                          {monthCalendarDays.map((cd) => {
                            const status = cd.effectiveStatus;
                            let bgStyle = 'bg-slate-800/40 border-slate-700/60 text-slate-400';
                            let labelText = '';

                            if (status === 'Present') {
                              bgStyle = 'bg-emerald-500 text-white border-emerald-400 font-extrabold shadow-md';
                              labelText = 'P';
                            } else if (status === 'Absent') {
                              bgStyle = 'bg-rose-500 text-white border-rose-400 font-extrabold shadow-md';
                              labelText = 'A';
                            } else if (status === 'Late') {
                              bgStyle = 'bg-amber-400 text-slate-950 border-amber-300 font-extrabold shadow-md';
                              labelText = 'L';
                            } else if (status === 'Leave') {
                              bgStyle = 'bg-blue-500 text-white border-blue-400 font-extrabold shadow-md';
                              labelText = 'LV';
                            } else if (status === 'Holiday') {
                              bgStyle = 'bg-pink-500 text-white border-pink-400 font-extrabold shadow-md';
                              labelText = cd.isSunday ? 'SUN' : 'HOL';
                            }

                            return (
                              <div
                                key={cd.dayNum}
                                className={`h-11 rounded-xl p-1 flex flex-col justify-between border transition-all text-center ${bgStyle}`}
                              >
                                <span className="text-[9px] font-bold opacity-80 self-start leading-none pl-0.5 pt-0.5">
                                  {cd.dayNum}
                                </span>
                                <span className="text-[10px] font-black uppercase tracking-tighter pb-0.5">
                                  {labelText || '—'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Attendance Monthly Summary Box */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">
                        Attendance Summary ({monthNames[selectedMonthIdx]})
                      </h4>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                        <div className="bg-slate-800/80 border border-emerald-500/30 p-2.5 rounded-2xl text-center">
                          <span className="text-[10px] text-emerald-400 uppercase font-black">Present</span>
                          <p className="text-lg font-black text-emerald-400">{monthPresent}</p>
                        </div>

                        <div className="bg-slate-800/80 border border-rose-500/30 p-2.5 rounded-2xl text-center">
                          <span className="text-[10px] text-rose-400 uppercase font-black">Absent</span>
                          <p className="text-lg font-black text-rose-400">{monthAbsent}</p>
                        </div>

                        <div className="bg-slate-800/80 border border-amber-500/30 p-2.5 rounded-2xl text-center">
                          <span className="text-[10px] text-amber-400 uppercase font-black">Late</span>
                          <p className="text-lg font-black text-amber-400">{monthLate}</p>
                        </div>

                        <div className="bg-slate-800/80 border border-blue-500/30 p-2.5 rounded-2xl text-center">
                          <span className="text-[10px] text-blue-400 uppercase font-black">Leave</span>
                          <p className="text-lg font-black text-blue-400">{monthLeave}</p>
                        </div>

                        <div className="bg-slate-800/80 border border-pink-500/30 p-2.5 rounded-2xl text-center col-span-2 sm:col-span-1">
                          <span className="text-[10px] text-pink-400 uppercase font-black">Holidays</span>
                          <p className="text-lg font-black text-pink-400">{totalHolidaysInMonth}</p>
                        </div>
                      </div>

                      {/* Score Banner */}
                      <div className="bg-slate-800 border border-slate-700/80 p-3.5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-md ${
                            monthAttendancePercentage >= 75 ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                          }`}>
                            {monthAttendancePercentage}%
                          </div>
                          <div>
                            <p className="text-xs font-extrabold text-white">Monthly Attendance Percentage</p>
                            <p className="text-[11px] text-slate-300">
                              Working Days Evaluated: <strong>{workingDaysInMonth} Days</strong>
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0">
                          <span className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border shadow-sm ${
                            monthAttendancePercentage >= 75
                              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                              : 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                          }`}>
                            {monthAttendancePercentage >= 75 ? '✓ SATISFACTORY / ELIGIBLE' : '⚠️ ATTENTION REQUIRED'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Report Card Footer / Stamp Placeholder */}
                    <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] text-slate-400">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Verified Official Document • Smart Attendance Portal</span>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <div className="w-24 border-b border-slate-600 mb-0.5" />
                          <span className="text-[9px] uppercase font-bold text-slate-400">Class Teacher</span>
                        </div>
                        <div className="text-center">
                          <div className="w-24 border-b border-slate-600 mb-0.5" />
                          <span className="text-[9px] uppercase font-bold text-slate-400">Principal Stamp</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* SHARE REPORT FALLBACK MODAL */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full text-white shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold flex items-center gap-2 text-emerald-400">
                <Share2 className="w-5 h-5" />
                Share Attendance Report
              </h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Share the monthly report for <strong>{selectedStudent?.name}</strong> directly with parents via WhatsApp, Email, or copy summary details.
            </p>

            {/* Direct Social Links */}
            <div className="space-y-2.5">
              <a
                href={whatsappShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-2xl transition-all flex items-center justify-center gap-2.5 shadow-md"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Share via WhatsApp</span>
              </a>

              <a
                href={emailShareUrl}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-2xl transition-all flex items-center justify-center gap-2.5 shadow-md"
              >
                <Mail className="w-4 h-4" />
                <span>Send via Email</span>
              </a>

              <button
                onClick={copyTextToClipboard}
                className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs rounded-2xl transition-all flex items-center justify-center gap-2.5"
              >
                {copiedSummary ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
                <span>{copiedSummary ? 'Summary Copied to Clipboard!' : 'Copy Summary Text'}</span>
              </button>

              <button
                onClick={() => {
                  setShowShareModal(false);
                  handleDownloadPNG();
                }}
                className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 font-bold text-xs rounded-2xl transition-all flex items-center justify-center gap-2.5"
              >
                <Download className="w-4 h-4 text-amber-400" />
                <span>Download High-Res PNG Image</span>
              </button>
            </div>

            <button
              onClick={() => setShowShareModal(false)}
              className="w-full py-2 bg-slate-800/50 text-slate-400 hover:text-white font-semibold text-xs rounded-xl"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
