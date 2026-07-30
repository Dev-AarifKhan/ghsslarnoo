export type ClassName = 'Class 9' | 'Class 10' | 'Class 11' | 'Class 12';

export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Leave' | 'Holiday';

export type Gender = 'Boy' | 'Girl' | 'Other';
export type Stream = 'Medical' | 'Non-Medical' | 'Arts' | 'Commerce';

export interface Student {
  id: string; // e.g. IT2026-001
  name: string;
  parentage: string; // Father / Mother name
  className: ClassName;
  academicSession?: string; // e.g. 2025-2026
  gender?: Gender | string; // Boy / Girl
  dob?: string; // YYYY-MM-DD
  stream?: Stream | string; // Medical, Non-Medical, Arts, Commerce
  photoUrl?: string;
  enrollmentDate: string; // YYYY-MM-DD
  phone?: string;
  email?: string;
  address?: string;
  validUpto?: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  className: ClassName;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM AM/PM
  day: string; // e.g. Monday
  month: string; // e.g. July
  year: number; // e.g. 2026
  status: AttendanceStatus;
  deviceName: string;
  teacherName: string;
  timestamp: number; // Date.now()
  syncedToFirestore: boolean;
  remarks?: string;
}

export interface ActivityLog {
  id: string;
  activity: string;
  time: string;
  status: 'Success' | 'Warning' | 'Error' | 'Info';
  user: string;
  details?: string;
}

export interface UserSession {
  username: string;
  teacherName: string;
  schoolName: string;
  role: 'Teacher' | 'Admin' | 'Guest';
  isAuthenticated: boolean;
  isLoggedIn: boolean;
  photoUrl?: string;
  loginPassword?: string;
}

export type ThemePreset = 'dark' | 'light' | 'slate' | 'midnight' | 'emerald' | 'sunset';

export interface AppSettings {
  schoolName: string;
  subjectName: string; // e.g. IT / ITES Vocational
  teacherName: string;
  autoSync: boolean;
  darkMode: boolean;
  themePreset?: ThemePreset;
  enableVibration: boolean;
  enableAudio: boolean;
  disableScreenshots: boolean;
  encryptLocalDatabase: boolean;
  schoolAddress?: string;
  schoolEmail?: string;
  udiseCode?: string;
  phone?: string;
}

export interface SyncStatus {
  lastSyncTime: string | null;
  pendingCount: number;
  isSyncing: boolean;
  error: string | null;
}
