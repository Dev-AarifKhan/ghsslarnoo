import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { Student, AttendanceRecord, AttendanceStatus } from '../types';
import firebaseConfigData from '../../firebase-applet-config.json';

// 1. Firebase Integration Configuration
export const firebaseConfig = {
  apiKey: firebaseConfigData.apiKey || '',
  authDomain: firebaseConfigData.authDomain || '',
  projectId: firebaseConfigData.projectId || '',
  storageBucket: firebaseConfigData.storageBucket || '',
  messagingSenderId: firebaseConfigData.messagingSenderId || '',
  appId: firebaseConfigData.appId || '',
  firestoreDatabaseId: firebaseConfigData.firestoreDatabaseId || '',
};

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore DB (supporting optional named database)
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Unique identifier per scanning device
export const getDeviceId = (): string => {
  if (typeof window === 'undefined') return 'Server-Scanner';
  let deviceId = localStorage.getItem('vas_device_id');
  if (!deviceId) {
    const randomHash = Math.random().toString(36).substring(2, 7).toUpperCase();
    const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad/i.test(navigator.userAgent);
    const platform = isMobile ? 'Mobile' : 'Desktop';
    deviceId = `${platform}-Scanner-${randomHash}`;
    localStorage.setItem('vas_device_id', deviceId);
  }
  return deviceId;
};

// Helper to clean objects before writing to Firestore (removing undefined/null values that crash setDoc/batch.set)
const cleanPayload = <T extends Record<string, any>>(obj: T): Record<string, any> => {
  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined && val !== null) {
      clean[key] = val;
    }
  }
  return clean;
};

// Helper to reliably extract year, month, and day from YYYY-MM-DD date strings
export const parseDateInfo = (dateStr: string) => {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  let year = 2026;
  let month = 'July';
  let day = 'Monday';

  if (dateStr && typeof dateStr === 'string') {
    const parts = dateStr.trim().split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        const dateObj = new Date(y, m, d);
        year = y;
        month = monthNames[m] || 'July';
        day = dayNames[dateObj.getDay()] || 'Monday';
      }
    }
  }

  return { year, month, day };
};

// 2. Real-time Attendance Listener
export const subscribeToAttendance = (
  onUpdate: (records: AttendanceRecord[]) => void,
  getStudentInfo?: (studentId: string) => Student | undefined
) => {
  const attendanceRef = collection(db, 'attendance');

  return onSnapshot(
    attendanceRef,
    (snapshot) => {
      const records: AttendanceRecord[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();

        let tsMillis = Date.now();
        if (data.timestamp && typeof data.timestamp.toMillis === 'function') {
          tsMillis = data.timestamp.toMillis();
        } else if (typeof data.timestamp === 'number') {
          tsMillis = data.timestamp;
        } else if (data.timestamp instanceof Date) {
          tsMillis = data.timestamp.getTime();
        }

        const dateObj = new Date(tsMillis);
        const dateStr = data.date || dateObj.toISOString().split('T')[0];
        const timeStr =
          data.time ||
          dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        const rawStudentId = data.student_id || data.studentId || '';
        const student = getStudentInfo ? getStudentInfo(rawStudentId) : undefined;

        const dateInfo = parseDateInfo(dateStr);

        return {
          id: docSnap.id,
          studentId: rawStudentId,
          studentName: data.student_name || data.studentName || student?.name || rawStudentId,
          className: data.class_id || data.className || student?.className || 'Class 9',
          date: dateStr,
          time: timeStr,
          day: data.day || dateInfo.day,
          month: data.month || dateInfo.month,
          year: data.year || dateInfo.year,
          status: (data.status as AttendanceStatus) || 'Present',
          deviceName: data.device_id || data.deviceName || 'Scanner Device',
          teacherName: data.teacher_name || data.teacherName || 'Teacher',
          timestamp: tsMillis,
          syncedToFirestore: true,
          remarks: data.remarks || '',
        };
      });

      // Sort newest first
      records.sort((a, b) => b.timestamp - a.timestamp);
      onUpdate(records);
    },
    (error) => {
      console.error('Firestore attendance subscription error:', error);
    }
  );
};

// Real-time Students Listener
export const subscribeToStudents = (
  onUpdate: (students: Student[]) => void,
  onError?: (err: Error) => void
) => {
  const studentsRef = collection(db, 'students');

  return onSnapshot(
    studentsRef,
    (snapshot) => {
      console.log(`[Firestore Realtime Students] Snapshot received. Docs count: ${snapshot.docs.length}`);
      if (snapshot.empty) {
        console.log('[Firestore Realtime Students] Firestore students collection is empty.');
        onUpdate([]);
        return;
      }
      const students: Student[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: data.id || docSnap.id,
          name: data.name || '',
          parentage: data.parentage || '',
          className: data.className || data.class_id || 'Class 9',
          academicSession: data.academicSession || '2025-2026',
          gender: data.gender || 'Boy',
          dob: data.dob || '',
          stream: data.stream || '',
          photoUrl: data.photoUrl || '',
          enrollmentDate: data.enrollmentDate || new Date().toISOString().split('T')[0],
          phone: data.phone || '',
          email: data.email || '',
        };
      });
      console.log(`[Firestore Realtime Students] Successfully loaded ${students.length} student(s) from Cloud Firestore.`);
      onUpdate(students);
    },
    (error) => {
      console.error('[Firestore Realtime Students Error] Error fetching students from Firestore:', error);
      if (onError) onError(error);
    }
  );
};

// 3. Mark Attendance directly in Firestore
export const saveAttendanceToFirestore = async (record: {
  studentId: string;
  className: string;
  status: AttendanceStatus;
  studentName?: string;
  customDate?: string;
  customTime?: string;
  remarks?: string;
  teacherName?: string;
}): Promise<void> => {
  const dateStr = record.customDate || new Date().toISOString().split('T')[0];
  const timeStr =
    record.customTime ||
    new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const dateInfo = parseDateInfo(dateStr);

  const sanitizedStudentId = record.studentId.trim().replace(/[/\\#?]/g, '-');
  const docId = `${sanitizedStudentId.toLowerCase()}_${dateStr}`;
  const docRef = doc(db, 'attendance', docId);

  const payload = cleanPayload({
    student_id: record.studentId,
    class_id: record.className || 'Class 9',
    timestamp: serverTimestamp(),
    status: record.status || 'Present',
    device_id: getDeviceId(),
    student_name: record.studentName || '',
    date: dateStr,
    time: timeStr,
    day: dateInfo.day,
    month: dateInfo.month,
    year: dateInfo.year,
    remarks: record.remarks || '',
    teacher_name: record.teacherName || 'Teacher',
  });

  await setDoc(docRef, payload, { merge: true });
};

// Bulk Attendance to Firestore
export const saveAttendanceBatchToFirestore = async (
  records: Array<{
    studentId: string;
    className: string;
    status: AttendanceStatus;
    studentName?: string;
    customDate?: string;
    customTime?: string;
    remarks?: string;
    teacherName?: string;
  }>
): Promise<void> => {
  const deviceId = getDeviceId();
  const chunkSize = 400;

  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    const batch = writeBatch(db);

    for (const record of chunk) {
      const dateStr = record.customDate || new Date().toISOString().split('T')[0];
      const timeStr =
        record.customTime ||
        new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      const dateInfo = parseDateInfo(dateStr);

      const sanitizedStudentId = record.studentId.trim().replace(/[/\\#?]/g, '-');
      const docId = `${sanitizedStudentId.toLowerCase()}_${dateStr}`;
      const docRef = doc(db, 'attendance', docId);

      const payload = cleanPayload({
        student_id: record.studentId,
        class_id: record.className || 'Class 9',
        timestamp: serverTimestamp(),
        status: record.status || 'Present',
        device_id: deviceId,
        student_name: record.studentName || '',
        date: dateStr,
        time: timeStr,
        day: dateInfo.day,
        month: dateInfo.month,
        year: dateInfo.year,
        remarks: record.remarks || '',
        teacher_name: record.teacherName || 'Teacher',
      });

      batch.set(docRef, payload, { merge: true });
    }

    await batch.commit();
  }
};

// Save Student to Firestore
export const saveStudentToFirestore = async (student: Student): Promise<void> => {
  if (!student || !student.id) return;
  const docRef = doc(db, 'students', student.id.trim());
  const payload = cleanPayload({ ...student });
  await setDoc(docRef, payload, { merge: true });
};

// Bulk Save Students to Firestore
export const saveStudentsBatchToFirestore = async (students: Student[]): Promise<void> => {
  if (!students || students.length === 0) return;
  const chunkSize = 400;

  for (let i = 0; i < students.length; i += chunkSize) {
    const chunk = students.slice(i, i + chunkSize);
    const batch = writeBatch(db);

    for (const student of chunk) {
      if (!student || !student.id) continue;
      const docRef = doc(db, 'students', student.id.trim());
      const payload = cleanPayload({ ...student });
      batch.set(docRef, payload, { merge: true });
    }

    await batch.commit();
  }
};

// Delete Student from Firestore
export const deleteStudentFromFirestore = async (studentId: string): Promise<void> => {
  if (!studentId) return;
  const docRef = doc(db, 'students', studentId.trim());
  await deleteDoc(docRef);
};

// Delete Batch of Students from Firestore
export const deleteStudentsBatchFromFirestore = async (studentIds: string[]): Promise<void> => {
  if (!studentIds || studentIds.length === 0) return;
  const chunkSize = 400;

  for (let i = 0; i < studentIds.length; i += chunkSize) {
    const chunk = studentIds.slice(i, i + chunkSize);
    const batch = writeBatch(db);

    for (const id of chunk) {
      if (!id || !id.trim()) continue;
      const docRef = doc(db, 'students', id.trim());
      batch.delete(docRef);
    }

    await batch.commit();
  }
};
