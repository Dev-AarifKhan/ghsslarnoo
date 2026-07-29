import React, { useState, useRef } from 'react';
import {
  UserPlus,
  Upload,
  Download,
  Trash2,
  Edit3,
  Search,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  QrCode,
  UserCheck,
  RefreshCw,
  X,
  FileUp,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { Student, ClassName } from '../types';
import { exportStudentsToExcel, parseStudentsFromExcel } from '../services/pdfExcel';

interface EnrollmentViewProps {
  students: Student[];
  onAddStudent: (student: Student) => { success: boolean; message: string };
  onBulkAddStudents?: (
    students: Student[],
    syncToSheets?: boolean
  ) => Promise<{ added: number; updated: number; total: number; syncMessage: string }>;
  onUpdateStudent: (student: Student) => { success: boolean; message: string };
  onDeleteStudent: (studentId: string) => { success: boolean; message: string };
  onBulkDeleteStudents?: (studentIds: string[]) => { success: boolean; count: number; message: string };
  onSelectTab: (tab: string) => void;
}

export const EnrollmentView: React.FC<EnrollmentViewProps> = ({
  students,
  onAddStudent,
  onBulkAddStudents,
  onUpdateStudent,
  onDeleteStudent,
  onBulkDeleteStudents,
  onSelectTab,
}) => {
  const [studentId, setStudentId] = useState('');
  const [name, setName] = useState('');
  const [parentage, setParentage] = useState('');
  const [className, setClassName] = useState<ClassName>('Class 9');
  const [academicSession, setAcademicSession] = useState('2025-2026');
  const [gender, setGender] = useState<'Boy' | 'Girl' | 'Other'>('Boy');
  const [dob, setDob] = useState('');
  const [stream, setStream] = useState<'Medical' | 'Non-Medical' | 'Arts' | 'Commerce'>('Medical');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState<string>('All');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'none'>('asc');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);

  // Batch Selection & Bulk Deletion States
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState<boolean>(false);

  const formFileInputRef = useRef<HTMLInputElement>(null);

  const handleFormPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setFeedback({ type: 'error', message: 'Photo file size must be under 5MB.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setPhotoUrl(base64);
        setFeedback({ type: 'success', message: 'Photo loaded from local device!' });
      }
    };
    reader.readAsDataURL(file);

    if (formFileInputRef.current) {
      formFileInputRef.current.value = '';
    }
  };

  // Excel Upload States
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isParsingExcel, setIsParsingExcel] = useState(false);
  const [excelStudents, setExcelStudents] = useState<Student[] | null>(null);
  const [syncToSheetsCheck, setSyncToSheetsCheck] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    added: number;
    updated: number;
    total: number;
    syncMessage: string;
  } | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingExcel(true);
    setFeedback(null);
    try {
      const parsed = await parseStudentsFromExcel(file);
      setExcelStudents(parsed);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: (err as Error).message || 'Failed to read Excel file.',
      });
    } finally {
      setIsParsingExcel(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleConfirmExcelImport = async () => {
    if (!excelStudents || excelStudents.length === 0) return;
    setIsImporting(true);

    try {
      if (onBulkAddStudents) {
        const res = await onBulkAddStudents(excelStudents, syncToSheetsCheck);
        setImportSummary(res);
      } else {
        // Fallback item by item
        let added = 0;
        let updated = 0;
        for (const s of excelStudents) {
          const res = onAddStudent(s);
          if (res.success) added++;
          else updated++;
        }
        setImportSummary({
          added,
          updated,
          total: excelStudents.length,
          syncMessage: 'Enrolled into local directory',
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: `Import failed: ${(err as Error).message}`,
      });
    } finally {
      setIsImporting(false);
      setExcelStudents(null);
    }
  };

  // Auto-generate next Student ID hint
  const handleGenerateNextId = () => {
    const stuIds = students
      .map((s) => {
        const match = s.id.match(/^STU(\d+)$/i);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => !isNaN(n));
    const nextNum = stuIds.length > 0 ? Math.max(...stuIds) + 1 : students.length + 1;
    setStudentId(`STU${nextNum}`);
  };

  const handleClearForm = () => {
    setStudentId('');
    setName('');
    setParentage('');
    setClassName('Class 9');
    setAcademicSession('2025-2026');
    setGender('Boy');
    setDob('');
    setStream('Medical');
    setPhone('');
    setEmail('');
    setPhotoUrl('');
    setIsEditing(false);
    setFeedback(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId.trim() || !name.trim() || !parentage.trim()) {
      setFeedback({ type: 'error', message: 'Please fill in Student ID, Name, and Parentage.' });
      return;
    }

    const isSeniorClass = className === 'Class 11' || className === 'Class 12';

    const studentData: Student = {
      id: studentId.trim().toUpperCase(),
      name: name.trim(),
      parentage: parentage.trim(),
      className,
      academicSession: academicSession.trim() || '2025-2026',
      gender,
      dob: dob || undefined,
      stream: isSeniorClass ? stream : undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      photoUrl: photoUrl.trim() || undefined,
      enrollmentDate: new Date().toISOString().split('T')[0],
    };

    if (isEditing) {
      const res = onUpdateStudent(studentData);
      setFeedback({ type: res.success ? 'success' : 'error', message: res.message });
      if (res.success) handleClearForm();
    } else {
      const res = onAddStudent(studentData);
      setFeedback({ type: res.success ? 'success' : 'error', message: res.message });
      if (res.success) handleClearForm();
    }
  };

  const handleEditClick = (student: Student) => {
    setStudentId(student.id);
    setName(student.name);
    setParentage(student.parentage);
    setClassName(student.className);
    setAcademicSession(student.academicSession || '2025-2026');
    setGender((student.gender as any) || 'Boy');
    setDob(student.dob || '');
    setStream((student.stream as any) || 'Medical');
    setPhone(student.phone || '');
    setEmail(student.email || '');
    setPhotoUrl(student.photoUrl || '');
    setIsEditing(true);
    setFeedback(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Filter and sort students list
  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.parentage.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = filterClass === 'All' || s.className === filterClass;
    return matchesSearch && matchesClass;
  });

  const sortedStudents = [...filteredStudents].sort((a, b) => {
    if (sortOrder === 'asc') {
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    }
    if (sortOrder === 'desc') {
      return b.name.localeCompare(a.name, undefined, { sensitivity: 'base' });
    }
    return 0;
  });

  // Batch selection helpers
  const handleToggleSelectStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const isAllFilteredSelected =
    sortedStudents.length > 0 &&
    sortedStudents.every((s) => selectedStudentIds.includes(s.id));

  const isSomeFilteredSelected =
    sortedStudents.some((s) => selectedStudentIds.includes(s.id)) &&
    !isAllFilteredSelected;

  const handleSelectAllFiltered = () => {
    if (isAllFilteredSelected) {
      const filteredSet = new Set(sortedStudents.map((s) => s.id));
      setSelectedStudentIds((prev) => prev.filter((id) => !filteredSet.has(id)));
    } else {
      const filteredIds = sortedStudents.map((s) => s.id);
      setSelectedStudentIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const handleClearSelection = () => {
    setSelectedStudentIds([]);
  };

  const handleConfirmBulkDelete = () => {
    if (selectedStudentIds.length === 0) return;

    let message = '';
    let isSuccess = true;

    if (onBulkDeleteStudents) {
      const res = onBulkDeleteStudents(selectedStudentIds);
      isSuccess = res.success;
      message = res.message;
    } else {
      let count = 0;
      for (const id of selectedStudentIds) {
        const res = onDeleteStudent(id);
        if (res.success) count++;
      }
      message = `Successfully deleted ${count} student(s)!`;
    }

    setFeedback({
      type: isSuccess ? 'success' : 'error',
      message,
    });

    if (isEditing && selectedStudentIds.includes(studentId)) {
      handleClearForm();
    }

    setSelectedStudentIds([]);
    setShowBulkDeleteModal(false);
  };

  // Download Sample Excel Template
  const handleDownloadTemplate = () => {
    const sample = [
      {
        'Student ID': 'STU11',
        'Student Name': 'Sample Student',
        'Parentage': 'Parent Name',
        'Class': 'Class 9',
        'Phone': '+91 9876543210',
        'Email': 'student@school.edu.in',
      },
    ];
    exportStudentsToExcel(
      sample.map((s) => ({
        id: s['Student ID'],
        name: s['Student Name'],
        parentage: s['Parentage'],
        className: s['Class'] as ClassName,
        enrollmentDate: new Date().toISOString().split('T')[0],
        phone: s['Phone'],
        email: s['Email'],
      }))
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111] border border-white/5 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden">
        <div>
          <div className="flex items-center space-x-2 text-[10px] font-bold uppercase tracking-widest text-cyan-500 mb-1">
            <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Student Registration</span>
          </div>
          <h1 className="text-2xl font-serif italic text-white tracking-tight flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-cyan-400" />
            Vocational Student Directory
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Enroll and manage IT / ITES students across Class 9, 10, 11, and 12.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx, .xls, .csv"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isParsingExcel}
            className="flex items-center space-x-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-50"
          >
            {isParsingExcel ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <FileUp className="w-4 h-4" />
            )}
            <span>Upload Excel File</span>
          </button>
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center space-x-1.5 bg-[#0a0a0a] hover:bg-white/10 text-gray-300 border border-white/10 text-xs font-semibold px-3.5 py-2.5 rounded-xl transition-all"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Excel Template</span>
          </button>
          <button
            onClick={() => exportStudentsToExcel(students)}
            className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Roster</span>
          </button>
        </div>
      </div>

      {/* Excel Bulk Upload Banner */}
      <div className="bg-gradient-to-r from-cyan-950/40 via-[#111111] to-emerald-950/40 border border-cyan-500/20 rounded-3xl p-5 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0">
            <Upload className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Bulk Student Registration via Excel
              <span className="bg-cyan-500/20 text-cyan-300 text-[10px] font-mono px-2 py-0.5 rounded-full border border-cyan-500/30">
                Auto Sync
              </span>
            </h3>
            <p className="text-xs text-gray-300 mt-0.5">
              Upload an Excel (.xlsx / .csv) file with columns: <span className="text-cyan-300 font-mono font-medium">Student ID</span>, <span className="text-cyan-300 font-mono font-medium">Name</span>, <span className="text-cyan-300 font-mono font-medium">Parentage</span>, <span className="text-cyan-300 font-mono font-medium">Class</span> to automatically enroll all students into the system and Google Sheets.
            </p>
          </div>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isParsingExcel}
          className="shrink-0 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-bold text-xs px-5 py-3 rounded-2xl shadow-xl transition-all flex items-center gap-2 cursor-pointer"
        >
          {isParsingExcel ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <FileUp className="w-4 h-4" />
          )}
          <span>Select Excel File</span>
        </button>
      </div>

      {/* Form & List Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Enrollment Form */}
        <div className="bg-[#111] border border-white/5 rounded-3xl p-6 shadow-2xl h-fit">
          <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-300">
              {isEditing ? 'Update Student' : 'Enroll Student'}
            </h2>
            {!isEditing && (
              <button
                type="button"
                onClick={handleGenerateNextId}
                className="text-[10px] font-bold uppercase tracking-widest text-cyan-400 hover:underline"
              >
                Auto ID
              </button>
            )}
          </div>

          {feedback && (
            <div
              className={`mb-4 p-3 rounded-xl text-xs flex items-center gap-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                Student ID *
              </label>
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="e.g. STU1, STU2..."
                disabled={isEditing}
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono uppercase focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-50"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter student full name"
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                Parentage *
              </label>
              <input
                type="text"
                value={parentage}
                onChange={(e) => setParentage(e.target.value)}
                placeholder="Father / Mother Name"
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Class Level *</label>
              <select
                value={className}
                onChange={(e) => setClassName(e.target.value as ClassName)}
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
              >
                <option value="Class 9">Class 9 (Vocational Level 1)</option>
                <option value="Class 10">Class 10 (Vocational Level 2)</option>
                <option value="Class 11">Class 11 (Vocational Level 3)</option>
                <option value="Class 12">Class 12 (Vocational Level 4)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                  Academic Session *
                </label>
                <input
                  type="text"
                  value={academicSession}
                  onChange={(e) => setAcademicSession(e.target.value)}
                  placeholder="2025-2026"
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                  Gender *
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as any)}
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
                >
                  <option value="Boy">Boy</option>
                  <option value="Girl">Girl</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                  Date of Birth (DOB)
                </label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              {(className === 'Class 11' || className === 'Class 12') && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                    Stream *
                  </label>
                  <select
                    value={stream}
                    onChange={(e) => setStream(e.target.value as any)}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
                  >
                    <option value="Medical">Medical</option>
                    <option value="Non-Medical">Non-Medical</option>
                    <option value="Arts">Arts</option>
                    <option value="Commerce">Commerce</option>
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                Student Photograph (Upload from Device)
              </label>
              <input
                type="file"
                ref={formFileInputRef}
                onChange={handleFormPhotoUpload}
                accept="image/*"
                className="hidden"
              />
              {photoUrl ? (
                <div className="flex items-center gap-3 bg-[#0a0a0a] border border-white/10 p-2.5 rounded-xl">
                  <img
                    src={photoUrl}
                    alt="Student Preview"
                    className="w-11 h-11 rounded-lg object-cover border border-cyan-500/50 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white truncate">Photo Attached</div>
                    <div className="text-[10px] text-emerald-400 font-semibold">Loaded from local device</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => formFileInputRef.current?.click()}
                    className="bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhotoUrl('')}
                    className="text-rose-400 hover:text-rose-300 text-[11px] font-bold px-1 cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => formFileInputRef.current?.click()}
                  className="w-full bg-[#0a0a0a] border border-dashed border-white/20 hover:border-cyan-500/50 rounded-xl p-3 text-center transition-all cursor-pointer group flex items-center justify-center space-x-2"
                >
                  <Upload className="w-4 h-4 text-gray-400 group-hover:text-cyan-400 transition-colors" />
                  <span className="text-xs text-gray-300 font-medium group-hover:text-white transition-colors">
                    Upload Photo
                  </span>
                </button>
              )}
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="submit"
                className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-cyan-950/40 text-xs uppercase tracking-widest transition-all"
              >
                {isEditing ? 'Update Details' : 'Enroll Student'}
              </button>

              <button
                type="button"
                onClick={handleClearForm}
                className="px-4 py-3 bg-[#0a0a0a] hover:bg-white/10 text-gray-400 rounded-xl text-xs font-semibold transition-all border border-white/10"
              >
                Clear
              </button>
            </div>
          </form>
        </div>

        {/* Enrolled Students Table */}
        <div className="lg:col-span-2 bg-[#111] border border-white/5 rounded-3xl p-6 shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">
                Registered Roster ({filteredStudents.length})
              </p>

              <div className="flex items-center gap-2">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search name/ID..."
                    className="bg-[#0a0a0a] border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 w-36 sm:w-48"
                  />
                </div>

                {/* Class Filter */}
                <select
                  value={filterClass}
                  onChange={(e) => setFilterClass(e.target.value)}
                  className="bg-[#0a0a0a] border border-white/10 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none"
                >
                  <option value="All">All Classes</option>
                  <option value="Class 9">Class 9</option>
                  <option value="Class 10">Class 10</option>
                  <option value="Class 11">Class 11</option>
                  <option value="Class 12">Class 12</option>
                </select>

                {/* Sort Order Selector */}
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc' | 'none')}
                  className="bg-[#0a0a0a] border border-white/10 rounded-xl px-2 py-1.5 text-xs text-cyan-400 font-semibold focus:outline-none focus:border-cyan-500"
                  title="Sort Alphabetically"
                >
                  <option value="asc">Name: A → Z</option>
                  <option value="desc">Name: Z → A</option>
                  <option value="none">Sort: Default</option>
                </select>
              </div>
            </div>

            {/* Batch Selection Banner */}
            {selectedStudentIds.length > 0 && (
              <div className="mb-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl p-3 flex items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center gap-2.5 text-xs text-rose-200">
                  <span className="w-6 h-6 rounded-lg bg-rose-500/20 text-rose-400 font-bold font-mono flex items-center justify-center text-xs border border-rose-500/30">
                    {selectedStudentIds.length}
                  </span>
                  <span className="font-semibold">
                    {selectedStudentIds.length === 1 ? '1 student selected' : `${selectedStudentIds.length} students selected`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Deselect All
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBulkDeleteModal(true)}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Selected ({selectedStudentIds.length})</span>
                  </button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="bg-[#0a0a0a] text-gray-500 uppercase text-[10px] tracking-widest font-bold">
                  <tr>
                    <th className="px-3 py-2.5 rounded-l-xl w-10 text-center">
                      <input
                        type="checkbox"
                        checked={isAllFilteredSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = isSomeFilteredSelected;
                        }}
                        onChange={handleSelectAllFiltered}
                        className="w-4 h-4 rounded bg-[#111] border-white/20 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0 cursor-pointer"
                        title={isAllFilteredSelected ? 'Deselect all filtered' : 'Select all filtered'}
                      />
                    </th>
                    <th className="px-3 py-2.5">ID</th>
                    <th
                      onClick={() => {
                        if (sortOrder === 'asc') setSortOrder('desc');
                        else if (sortOrder === 'desc') setSortOrder('none');
                        else setSortOrder('asc');
                      }}
                      className="px-3 py-2.5 cursor-pointer hover:text-white transition-colors group select-none"
                      title="Click to toggle alphabetical sort"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Name</span>
                        {sortOrder === 'asc' && <ArrowUp className="w-3.5 h-3.5 text-cyan-400" />}
                        {sortOrder === 'desc' && <ArrowDown className="w-3.5 h-3.5 text-cyan-400" />}
                        {sortOrder === 'none' && <ArrowUpDown className="w-3.5 h-3.5 text-gray-500 group-hover:text-cyan-400" />}
                      </div>
                    </th>
                    <th className="px-3 py-2.5">Parentage</th>
                    <th className="px-3 py-2.5">Class / Stream</th>
                    <th className="px-3 py-2.5">Session / Gender</th>
                    <th className="px-3 py-2.5 text-center">Badge</th>
                    <th className="px-3 py-2.5 text-right rounded-r-xl">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {sortedStudents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-gray-500">
                        No students found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    sortedStudents.map((student) => {
                      const isSelected = selectedStudentIds.includes(student.id);
                      return (
                        <tr
                          key={student.id}
                          className={`transition-colors ${
                            isSelected ? 'bg-cyan-500/10' : 'hover:bg-white/5'
                          }`}
                        >
                          <td className="px-3 py-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectStudent(student.id)}
                              className="w-4 h-4 rounded bg-[#111] border-white/20 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0 cursor-pointer"
                            />
                          </td>
                          <td className="px-3 py-2.5 font-mono font-bold text-cyan-400">{student.id}</td>
                          <td className="px-3 py-2.5 font-semibold text-white flex items-center gap-2">
                            {student.photoUrl ? (
                              <img
                                src={student.photoUrl}
                                alt={student.name}
                                className="w-7 h-7 rounded-full object-cover border border-white/10"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-[#0a0a0a] text-cyan-400 flex items-center justify-center font-bold text-xs border border-white/10">
                                {student.name.charAt(0)}
                              </div>
                            )}
                            <span>{student.name}</span>
                          </td>
                          <td className="px-3 py-2.5 text-gray-400">{student.parentage}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex flex-col gap-1">
                              <span className="px-2 py-0.5 text-[10px] font-bold bg-cyan-500/10 text-cyan-300 rounded-md border border-cyan-500/20 w-fit">
                                {student.className}
                              </span>
                              {student.stream && (
                                <span className="text-[9px] font-semibold text-amber-300">
                                  {student.stream}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-gray-300">
                            <div className="text-[11px] font-mono">{student.academicSession || '2025-2026'}</div>
                            <div className="text-[10px] text-gray-400">{student.gender || 'Boy'}</div>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button
                              onClick={() => onSelectTab('qrcards')}
                              className="p-1.5 text-cyan-400 hover:text-white hover:bg-white/10 rounded-lg"
                              title="View QR ID Badge"
                            >
                              <QrCode className="w-4 h-4" />
                            </button>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleEditClick(student)}
                                className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg"
                                title="Edit Student"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setStudentToDelete(student)}
                                className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-white/10 rounded-lg transition-colors"
                                title="Delete Student"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Student Confirmation Modal */}
      {studentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#111111] border border-white/10 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Student Record?</h3>
                <p className="text-xs text-gray-400">This action will remove the student from the directory.</p>
              </div>
            </div>

            <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-4 text-xs text-gray-300 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-gray-500">Student ID:</span>
                <span className="font-mono font-bold text-cyan-400">{studentToDelete.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Name:</span>
                <span className="font-semibold text-white">{studentToDelete.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Class:</span>
                <span className="text-gray-300">{studentToDelete.className}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Parentage:</span>
                <span className="text-gray-300">{studentToDelete.parentage}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetId = studentToDelete.id;
                  const res = onDeleteStudent(targetId);
                  setFeedback({
                    type: res.success ? 'success' : 'error',
                    message: res.message || `Student ${studentToDelete.name} deleted successfully!`,
                  });
                  if (isEditing && studentId === targetId) {
                    handleClearForm();
                  }
                  // Remove from selection if present
                  setSelectedStudentIds((prev) => prev.filter((id) => id !== targetId));
                  setStudentToDelete(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Students Confirmation Modal */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#111111] border border-rose-500/30 rounded-3xl max-w-lg w-full p-6 text-white shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center gap-3 border-b border-white/10 pb-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Bulk Delete Students?</h3>
                <p className="text-xs text-gray-400">
                  You are about to permanently remove <span className="text-rose-400 font-bold">{selectedStudentIds.length}</span> selected student(s) from the directory.
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto max-h-52 border border-white/10 rounded-2xl bg-[#0a0a0a] p-2 space-y-1.5">
              {students
                .filter((s) => selectedStudentIds.includes(s.id))
                .map((s) => (
                  <div key={s.id} className="flex items-center justify-between bg-[#161616] p-2.5 rounded-xl border border-white/5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-cyan-400">{s.id}</span>
                      <span className="font-semibold text-white">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-[11px]">{s.parentage}</span>
                      <span className="text-[10px] bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded font-bold">{s.className}</span>
                    </div>
                  </div>
                ))}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(false)}
                className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkDelete}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Confirm Delete ({selectedStudentIds.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excel Student Import Preview Modal */}
      {excelStudents && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#111111] border border-cyan-500/30 rounded-3xl max-w-2xl w-full p-6 text-white shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Confirm Excel Student Import</h3>
                  <p className="text-xs text-gray-400">
                    Extracted <span className="text-cyan-400 font-bold">{excelStudents.length}</span> student record(s) from your file.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setExcelStudents(null)}
                disabled={isImporting}
                className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Preview Table */}
            <div className="flex-1 overflow-y-auto max-h-64 border border-white/10 rounded-2xl bg-[#0a0a0a]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#1a1a1a] sticky top-0 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-white/10">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Student ID</th>
                    <th className="p-3">Name</th>
                    <th className="p-3">Parentage</th>
                    <th className="p-3">Class</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-sans">
                  {excelStudents.map((s, idx) => (
                    <tr key={idx} className="hover:bg-white/5 transition-colors">
                      <td className="p-3 text-gray-500">{idx + 1}</td>
                      <td className="p-3 font-mono font-bold text-cyan-400">{s.id}</td>
                      <td className="p-3 font-semibold text-white">{s.name}</td>
                      <td className="p-3 text-gray-300">{s.parentage}</td>
                      <td className="p-3 text-gray-300">
                        <span className="bg-white/5 border border-white/10 text-gray-300 px-2 py-0.5 rounded-full text-[10px]">
                          {s.className}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Sync option & Actions */}
            <div className="bg-[#181818] border border-white/5 rounded-2xl p-4 space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-gray-200 select-none">
                <input
                  type="checkbox"
                  checked={syncToSheetsCheck}
                  onChange={(e) => setSyncToSheetsCheck(e.target.checked)}
                  className="w-4 h-4 rounded bg-black border-white/20 text-cyan-500 focus:ring-cyan-500 shrink-0"
                />
                <span>Automatically sync & enroll these students in <strong>Google Sheets</strong></span>
              </label>

              <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setExcelStudents(null)}
                  disabled={isImporting}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmExcelImport}
                  disabled={isImporting}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isImporting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Enrolling & Syncing...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm & Enroll ({excelStudents.length} Students)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Summary Modal */}
      {importSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#111111] border border-emerald-500/30 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Excel Import Complete!</h3>
                <p className="text-xs text-gray-400">Student enrollment processed successfully.</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-3">
                <div className="text-lg font-bold text-emerald-400">{importSummary.added}</div>
                <div className="text-[10px] uppercase font-bold text-gray-400">New Added</div>
              </div>
              <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-3">
                <div className="text-lg font-bold text-cyan-400">{importSummary.updated}</div>
                <div className="text-[10px] uppercase font-bold text-gray-400">Updated</div>
              </div>
              <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-3">
                <div className="text-lg font-bold text-white">{importSummary.total}</div>
                <div className="text-[10px] uppercase font-bold text-gray-400">Total</div>
              </div>
            </div>

            <div className="bg-[#161616] border border-white/5 rounded-2xl p-3.5 text-xs text-gray-300">
              <div className="text-[10px] uppercase font-bold text-cyan-400 mb-1">Google Sheets Status</div>
              <p>{importSummary.syncMessage}</p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setImportSummary(null)}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
