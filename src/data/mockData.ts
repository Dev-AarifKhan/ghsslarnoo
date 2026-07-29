import { Student, AttendanceRecord, ActivityLog, AppSettings } from '../types';

export const DEFAULT_SETTINGS: AppSettings = {
  schoolName: 'Govt. Higher Secondary School Larnoo',
  subjectName: 'Vocational Subject: IT / ITES',
  teacherName: 'Aarif Ahmad Khan',
  autoSync: true,
  darkMode: true,
  themePreset: 'dark',
  enableVibration: true,
  enableAudio: true,
  disableScreenshots: false,
  encryptLocalDatabase: true,
};

export const INITIAL_STUDENTS: Student[] = [];

export const INITIAL_ATTENDANCE: AttendanceRecord[] = [];

export const INITIAL_LOGS: ActivityLog[] = [
  {
    id: 'LOG-001',
    activity: 'System initialized & ready',
    time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    status: 'Success',
    user: 'System',
    details: 'Database cleaned and ready for new student enrollments.',
  },
];

