import { Student, AttendanceRecord, ActivityLog, AppSettings, UserSession, AttendanceStatus } from '../types';
import { INITIAL_STUDENTS, INITIAL_ATTENDANCE, INITIAL_LOGS, DEFAULT_SETTINGS } from '../data/mockData';
import {
  saveAttendanceToFirestore,
  saveAttendanceBatchToFirestore,
  saveStudentToFirestore,
  saveStudentsBatchToFirestore,
  deleteStudentFromFirestore,
  deleteStudentsBatchFromFirestore,
  getDeviceId,
} from './firebase';

const KEYS = {
  STUDENTS: 'vas_students_v1',
  ATTENDANCE: 'vas_attendance_v1',
  LOGS: 'vas_logs_v1',
  SETTINGS: 'vas_settings_v1',
  SESSION: 'vas_session_v1',
  SYNC_QUEUE: 'vas_sync_queue_v1',
  CREDENTIALS: 'vas_credentials_v1',
  SAVED_LOGIN: 'vas_saved_login_v1',
};

// Helper for local storage read/write
const getItem = <T>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (err) {
    console.error(`Error reading ${key} from localStorage:`, err);
    return defaultValue;
  }
};

const setItem = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel('attendance_app_sync');
        bc.postMessage({ type: 'DATA_UPDATED', key, timestamp: Date.now() });
        bc.close();
      } catch (e) {
        // Ignore BroadcastChannel errors
      }
    }
  } catch (err) {
    console.error(`Error saving ${key} to localStorage:`, err);
  }
};

// Settings
export const getSettings = (): AppSettings => {
  const current = getItem<AppSettings>(KEYS.SETTINGS, DEFAULT_SETTINGS);
  let updated = false;
  if (!current.schoolName || current.schoolName.includes('Vocational Education')) {
    current.schoolName = DEFAULT_SETTINGS.schoolName;
    updated = true;
  }
  if (!current.teacherName || current.teacherName.includes('Rajesh')) {
    current.teacherName = DEFAULT_SETTINGS.teacherName;
    updated = true;
  }
  if (!current.themePreset) {
    current.themePreset = current.darkMode ? 'dark' : 'light';
    updated = true;
  }
  if (updated) {
    saveSettings(current);
  }
  return current;
};

export const saveSettings = (settings: AppSettings): void => {
  setItem(KEYS.SETTINGS, settings);
};

// Session
export const getSession = (): UserSession => {
  const settings = getSettings();
  const defaultSession: UserSession = {
    username: '',
    teacherName: settings.teacherName,
    schoolName: settings.schoolName,
    role: 'Teacher',
    isAuthenticated: false,
    isLoggedIn: false,
  };
  const session = getItem<UserSession>(KEYS.SESSION, defaultSession);
  if (!session.schoolName || session.schoolName.includes('Vocational Education')) {
    session.schoolName = settings.schoolName;
  }
  if (!session.teacherName || session.teacherName.includes('Rajesh')) {
    session.teacherName = settings.teacherName;
  }
  return session;
};

export const saveSession = (session: UserSession): void => {
  setItem(KEYS.SESSION, session);
};

// Password & Credentials Security
export interface SavedLoginInfo {
  username: string;
  password?: string;
  role?: 'Teacher' | 'Admin';
  rememberMe: boolean;
}

export const getSavedLogin = (): SavedLoginInfo | null => {
  return getItem<SavedLoginInfo | null>(KEYS.SAVED_LOGIN, null);
};

export const saveSavedLogin = (info: SavedLoginInfo | null): void => {
  if (info && info.rememberMe) {
    setItem(KEYS.SAVED_LOGIN, info);
  } else {
    try {
      localStorage.removeItem(KEYS.SAVED_LOGIN);
    } catch (err) {
      console.error('Error removing saved login:', err);
    }
  }
};

export const getUserPassword = (): string => {
  return getItem<string>(KEYS.CREDENTIALS, 'password123');
};

export const setUserPassword = (newPassword: string): void => {
  const cleanPass = newPassword.trim();
  setItem(KEYS.CREDENTIALS, cleanPass);
  const saved = getSavedLogin();
  if (saved && saved.rememberMe) {
    saveSavedLogin({ ...saved, password: cleanPass });
  }
  addLog('Security Update', 'Account password was updated successfully', 'Success');
};

export const verifyUserPassword = (inputPassword: string): boolean => {
  const stored = getUserPassword();
  return inputPassword.trim() === stored;
};

// Students
export const getStudents = (): Student[] => {
  return getItem<Student[]>(KEYS.STUDENTS, INITIAL_STUDENTS);
};

export const saveStudents = (students: Student[]): void => {
  setItem(KEYS.STUDENTS, students);
};

export const addStudent = (newStudent: Student): { success: boolean; message: string } => {
  const students = getStudents();
  if (students.some((s) => s.id.toLowerCase() === newStudent.id.toLowerCase())) {
    return { success: false, message: `Student ID "${newStudent.id}" already exists!` };
  }
  students.unshift(newStudent);
  saveStudents(students);
  saveStudentToFirestore(newStudent).catch((e) => console.error('Error saving student to Firestore:', e));
  addLog('Student Enrolled', `Enrolled ${newStudent.name} (${newStudent.id}, ${newStudent.className})`);
  return { success: true, message: `Student ${newStudent.name} enrolled successfully!` };
};

export const addStudentsBulk = (newStudents: Student[]): { added: number; updated: number; total: number } => {
  const students = getStudents();
  let added = 0;
  let updated = 0;

  for (const s of newStudents) {
    const existingIdx = students.findIndex((item) => item.id.trim().toLowerCase() === s.id.trim().toLowerCase());
    if (existingIdx !== -1) {
      students[existingIdx] = { ...students[existingIdx], ...s };
      updated++;
    } else {
      students.unshift(s);
      added++;
    }
  }

  saveStudents(students);
  saveStudentsBatchToFirestore(newStudents).catch((e) => console.error('Error batch saving students to Firestore:', e));
  addLog('Bulk Excel Student Import', `Enrolled ${added} new student(s), updated ${updated} existing record(s)`, 'Success');
  return { added, updated, total: newStudents.length };
};

export const updateStudent = (updatedStudent: Student): { success: boolean; message: string } => {
  const students = getStudents();
  const index = students.findIndex((s) => s.id === updatedStudent.id);
  if (index === -1) {
    return { success: false, message: `Student ID "${updatedStudent.id}" not found!` };
  }
  students[index] = updatedStudent;
  saveStudents(students);
  saveStudentToFirestore(updatedStudent).catch((e) => console.error('Error updating student in Firestore:', e));
  addLog('Student Updated', `Updated details for ${updatedStudent.name} (${updatedStudent.id})`);
  return { success: true, message: `Student ${updatedStudent.name} updated!` };
};

export const deleteStudent = (studentId: string): { success: boolean; message: string } => {
  let students = getStudents();
  const cleanId = studentId.trim().toLowerCase();
  const target = students.find((s) => s.id.trim().toLowerCase() === cleanId);
  if (!target) return { success: false, message: 'Student not found!' };

  students = students.filter((s) => s.id.trim().toLowerCase() !== cleanId);
  saveStudents(students);
  deleteStudentFromFirestore(target.id).catch((e) => console.error('Error deleting student from Firestore:', e));
  addLog('Student Deleted', `Deleted student ${target.name} (${target.id})`, 'Warning');
  return { success: true, message: `Student ${target.name} removed successfully!` };
};

export const deleteStudentsBulk = (studentIds: string[]): { success: boolean; count: number; message: string } => {
  let students = getStudents();
  const lowerIds = new Set(studentIds.map((id) => id.trim().toLowerCase()));
  const initialLength = students.length;
  students = students.filter((s) => !lowerIds.has(s.id.trim().toLowerCase()));
  const deletedCount = initialLength - students.length;
  saveStudents(students);
  deleteStudentsBatchFromFirestore(studentIds).catch((e) => console.error('Error bulk deleting student from Firestore:', e));
  addLog('Bulk Students Deleted', `Deleted ${deletedCount} student(s) from directory`, 'Warning');
  return { success: true, count: deletedCount, message: `Successfully deleted ${deletedCount} student(s)!` };
};

// Attendance
export const getAttendanceRecords = (): AttendanceRecord[] => {
  return getItem<AttendanceRecord[]>(KEYS.ATTENDANCE, INITIAL_ATTENDANCE);
};

export const saveAttendanceRecords = (records: AttendanceRecord[]): void => {
  setItem(KEYS.ATTENDANCE, records);
};

export const markAttendance = (
  studentId: string,
  status: AttendanceStatus = 'Present',
  customDate?: string,
  customTime?: string,
  remarks?: string
): { success: boolean; record?: AttendanceRecord; message: string; isDuplicate?: boolean } => {
  const students = getStudents();
  const student = students.find((s) => s.id.toLowerCase() === studentId.toLowerCase());

  if (!student) {
    return { success: false, message: `Student ID "${studentId}" not registered in the system!` };
  }

  const records = getAttendanceRecords();
  const settings = getSettings();
  
  // Parse date properly to extract day, month, year
  const dateStr = customDate || new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const dateParts = dateStr.split('-');
  let dateObj = new Date();
  if (dateParts.length === 3) {
    dateObj = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const timeStr = customTime || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const dayName = dayNames[dateObj.getDay()] || 'Monday';
  const monthName = monthNames[dateObj.getMonth()] || 'July';
  const year = dateObj.getFullYear() || 2026;

  // Check if attendance already exists for same student on same day
  const existingIndex = records.findIndex(
    (r) => r.studentId.toLowerCase() === studentId.toLowerCase() && r.date === dateStr
  );

  const isDuplicate = existingIndex !== -1;

  const attendanceRecord: AttendanceRecord = {
    id: isDuplicate ? records[existingIndex].id : `ATT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    studentId: student.id,
    studentName: student.name,
    className: student.className,
    date: dateStr,
    time: timeStr,
    day: dayName,
    month: monthName,
    year,
    status,
    deviceName: getDeviceId(),
    teacherName: settings.teacherName,
    timestamp: Date.now(),
    syncedToFirestore: true,
    remarks,
  };

  if (isDuplicate) {
    records[existingIndex] = attendanceRecord;
  } else {
    records.unshift(attendanceRecord);
  }

  saveAttendanceRecords(records);

  // Directly write to Firestore for real-time synchronization across devices
  saveAttendanceToFirestore({
    studentId: student.id,
    className: student.className,
    status,
    studentName: student.name,
    customDate: dateStr,
    customTime: timeStr,
    remarks,
    teacherName: settings.teacherName,
  }).catch((err) => console.error('Error writing attendance record to Firestore:', err));

  addLog(
    isDuplicate ? 'Attendance Updated' : 'Attendance Marked',
    `Marked ${status} for ${student.name} (${student.id}, ${student.className}) on ${dateStr}`,
    'Success'
  );

  return {
    success: true,
    record: attendanceRecord,
    isDuplicate,
    message: isDuplicate
      ? `Updated attendance to ${status} for ${student.name} on ${dateStr}!`
      : `Attendance marked ${status} for ${student.name} on ${dateStr}!`,
  };
};

export const markAttendanceBatch = (
  items: Array<{
    studentId: string;
    status: AttendanceStatus;
    date?: string;
    time?: string;
    remarks?: string;
  }>
): { success: boolean; count: number; message: string } => {
  if (!items || items.length === 0) {
    return { success: true, count: 0, message: 'No items provided for batch attendance.' };
  }

  const students = getStudents();
  const records = getAttendanceRecords();
  const settings = getSettings();
  const queue = getSyncQueue();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  let processedCount = 0;
  const now = Date.now();

  items.forEach((item, index) => {
    const student = students.find((s) => s.id.toLowerCase() === item.studentId.toLowerCase());
    if (!student) return;

    const dateStr = item.date || new Date().toISOString().split('T')[0];
    const dateParts = dateStr.split('-');
    let dateObj = new Date();
    if (dateParts.length === 3) {
      dateObj = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
    }

    const timeStr = item.time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const dayName = dayNames[dateObj.getDay()] || 'Monday';
    const monthName = monthNames[dateObj.getMonth()] || 'July';
    const year = dateObj.getFullYear() || 2026;

    const existingIndex = records.findIndex(
      (r) => r.studentId.toLowerCase() === item.studentId.toLowerCase() && r.date === dateStr
    );

    if (existingIndex !== -1) {
      const existing = records[existingIndex];
      const updatedRecord: AttendanceRecord = {
        ...existing,
        studentName: student.name,
        className: student.className,
        status: item.status,
        time: item.time || timeStr,
        day: dayName,
        month: monthName,
        year,
        remarks: item.remarks !== undefined ? item.remarks : existing.remarks,
        timestamp: now + index,
        syncedToFirestore: true,
      };
      records[existingIndex] = updatedRecord;
    } else {
      const newRecord: AttendanceRecord = {
        id: `ATT-${now}-${index}-${Math.floor(Math.random() * 1000)}`,
        studentId: student.id,
        studentName: student.name,
        className: student.className,
        date: dateStr,
        time: timeStr,
        day: dayName,
        month: monthName,
        year,
        status: item.status,
        deviceName: 'Manual Register / Batch Mode',
        teacherName: settings.teacherName,
        timestamp: now + index,
        syncedToFirestore: true,
        remarks: item.remarks,
      };
      records.unshift(newRecord);
    }
    processedCount++;
  });

  saveAttendanceRecords(records);

  const firestoreBatch = items.map((item) => {
    const st = students.find((s) => s.id.toLowerCase() === item.studentId.toLowerCase());
    return {
      studentId: item.studentId,
      className: st?.className || 'Class 9',
      status: item.status,
      studentName: st?.name || '',
      customDate: item.date,
      customTime: item.time,
      remarks: item.remarks,
      teacherName: settings.teacherName,
    };
  });
  saveAttendanceBatchToFirestore(firestoreBatch).catch((err) =>
    console.error('Error saving batch attendance to Firestore:', err)
  );

  addLog(
    'Batch Attendance Marked',
    `Marked attendance for ${processedCount} student(s) in batch`,
    'Success'
  );

  return {
    success: true,
    count: processedCount,
    message: `Batch attendance saved for ${processedCount} students!`,
  };
};

// Sync Queue Management for Google Sheets
export const getSyncQueue = (): AttendanceRecord[] => {
  return getItem<AttendanceRecord[]>(KEYS.SYNC_QUEUE, []);
};

export const addToSyncQueue = (record: AttendanceRecord): void => {
  const queue = getSyncQueue();
  const existingIdx = queue.findIndex(
    (r) => r.id === record.id || (r.studentId.toLowerCase() === record.studentId.toLowerCase() && r.date === record.date)
  );
  if (existingIdx !== -1) {
    queue[existingIdx] = record;
  } else {
    queue.push(record);
  }
  setItem(KEYS.SYNC_QUEUE, queue);
};

export const removeFromSyncQueue = (recordId: string): void => {
  const queue = getSyncQueue();
  const updated = queue.filter((r) => r.id !== recordId);
  setItem(KEYS.SYNC_QUEUE, updated);
};

// Logs
export const getLogs = (): ActivityLog[] => {
  return getItem<ActivityLog[]>(KEYS.LOGS, INITIAL_LOGS);
};

export const clearAllData = (): void => {
  saveStudents([]);
  saveAttendanceRecords([]);
  setItem(KEYS.SYNC_QUEUE, []);
  setItem(KEYS.LOGS, [
    {
      id: `LOG-${Date.now()}`,
      activity: 'Database Cleared',
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      status: 'Warning',
      user: getSettings().teacherName || 'Teacher',
      details: 'All students, attendance records, and sync queues were cleared.',
    },
  ]);
};

export const addLog = (
  activity: string,
  details?: string,
  status: 'Success' | 'Warning' | 'Error' | 'Info' = 'Info'
): void => {
  const logs = getLogs();
  const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const newLog: ActivityLog = {
    id: `LOG-${Date.now()}`,
    activity,
    time: timeStr,
    status,
    user: getSettings().teacherName || 'Teacher',
    details,
  };
  logs.unshift(newLog);
  // Keep max 100 logs
  if (logs.length > 100) logs.pop();
  setItem(KEYS.LOGS, logs);
};

// Export and Import Database
export const exportDatabaseJSON = (): string => {
  const data = {
    students: getStudents(),
    attendance: getAttendanceRecords(),
    settings: getSettings(),
    logs: getLogs(),
    exportDate: new Date().toISOString(),
  };
  return JSON.stringify(data, null, 2);
};

export const importDatabaseJSON = (jsonString: string): { success: boolean; message: string } => {
  try {
    const data = JSON.parse(jsonString);
    if (data.students && Array.isArray(data.students)) {
      saveStudents(data.students);
    }
    if (data.attendance && Array.isArray(data.attendance)) {
      saveAttendanceRecords(data.attendance);
    }
    if (data.settings) {
      saveSettings(data.settings);
    }
    addLog('Database Restored', 'Restored backup from JSON file', 'Success');
    return { success: true, message: 'Database imported successfully!' };
  } catch (err) {
    return { success: false, message: `Failed to import JSON backup: ${(err as Error).message}` };
  }
};
