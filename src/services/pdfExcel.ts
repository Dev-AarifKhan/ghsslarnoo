import * as XLSX from 'xlsx';
import { AttendanceRecord, Student } from '../types';

/**
 * Export Attendance Report to Excel (.xlsx) file
 */
export const exportAttendanceToExcel = (
  records: AttendanceRecord[],
  filename: string = 'Attendance_Report'
) => {
  const data = records.map((r, index) => ({
    'S.No': index + 1,
    'Student ID': r.studentId,
    'Student Name': r.studentName,
    'Class': r.className,
    'Date': r.date,
    'Time': r.time,
    'Day': r.day,
    'Status': r.status,
    'Teacher': r.teacherName,
    'Device': r.deviceName,
    'Sync Status': r.syncedToFirestore ? 'Firestore Live' : 'Synced',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance Report');

  // Auto-fit column widths
  const max_widths = Object.keys(data[0] || {}).map((key) => ({
    wch: Math.max(key.length + 3, 15),
  }));
  worksheet['!cols'] = max_widths;

  XLSX.writeFile(workbook, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
};

/**
 * Export Attendance Summary per Student to Excel, including day-wise attendance
 */
export const exportStudentSummaryToExcel = (
  summaryData: Array<{
    studentId: string;
    name: string;
    parentage: string;
    className: string;
    workingDays: number;
    present: number;
    absent: number;
    late: number;
    leave: number;
    percentage: number;
  }>,
  title: string = 'Student_Attendance_Summary',
  records: AttendanceRecord[] = []
) => {
  // Extract unique dates chronologically
  const uniqueDates = Array.from(new Set(records.map((r) => r.date))).sort();

  // Create lookup map studentId -> date -> status
  const studentDateMap: Record<string, Record<string, string>> = {};
  records.forEach((r) => {
    if (!studentDateMap[r.studentId]) {
      studentDateMap[r.studentId] = {};
    }
    studentDateMap[r.studentId][r.date] = r.status;
  });

  const data = summaryData.map((s, index) => {
    const row: Record<string, any> = {
      'S.No': index + 1,
      'Student ID': s.studentId,
      'Student Name': s.name,
      'Parentage': s.parentage,
      'Class': s.className,
    };

    // Add day-wise attendance status columns
    uniqueDates.forEach((dateStr) => {
      const status = studentDateMap[s.studentId]?.[dateStr] || '-';
      let code = status;
      if (status === 'Present') code = 'P';
      else if (status === 'Absent') code = 'A';
      else if (status === 'Late') code = 'L';
      else if (status === 'Leave') code = 'LV';
      row[dateStr] = code;
    });

    // Add aggregated metrics
    row['Working Days'] = s.workingDays;
    row['Present'] = s.present;
    row['Absent'] = s.absent;
    row['Late'] = s.late;
    row['Leave'] = s.leave;
    row['Attendance %'] = `${s.percentage.toFixed(1)}%`;
    row['Status Eligibility'] = s.percentage >= 75 ? 'Eligible (>=75%)' : 'Shortage (<75%)';

    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Day-Wise & Summary Report');

  // Auto-fit column widths
  if (data.length > 0) {
    const max_widths = Object.keys(data[0]).map((key) => ({
      wch: Math.max(key.length + 2, 12),
    }));
    worksheet['!cols'] = max_widths;
  }

  // Append Daily Scans Log sheet if records exist
  if (records.length > 0) {
    const rawData = records.map((r, idx) => ({
      'S.No': idx + 1,
      'Student ID': r.studentId,
      'Student Name': r.studentName,
      'Class': r.className,
      'Date': r.date,
      'Time': r.time,
      'Day': r.day,
      'Month': r.month,
      'Status': r.status === 'Present' ? 'P' : r.status === 'Absent' ? 'A' : r.status === 'Late' ? 'L' : r.status === 'Leave' ? 'LV' : r.status,
      'Teacher': r.teacherName,
      'Device': r.deviceName,
    }));
    const rawWorksheet = XLSX.utils.json_to_sheet(rawData);
    XLSX.utils.book_append_sheet(workbook, rawWorksheet, 'Daily Scans Log');
  }

  XLSX.writeFile(workbook, `${title}_DayWise_${new Date().toISOString().split('T')[0]}.xlsx`);
};

/**
 * Export Students List to Excel
 */
export const exportStudentsToExcel = (students: Student[]) => {
  const data = students.map((s, idx) => ({
    'S.No': idx + 1,
    'Student ID': s.id,
    'Name': s.name,
    'Parentage': s.parentage,
    'Class': s.className,
    'Academic Session': s.academicSession || '2025-2026',
    'Gender': s.gender || 'N/A',
    'Date of Birth': s.dob || 'N/A',
    'Stream': s.stream || (s.className === 'Class 11' || s.className === 'Class 12' ? 'General' : 'N/A'),
    'Enrollment Date': s.enrollmentDate,
    'Phone': s.phone || 'N/A',
    'Email': s.email || 'N/A',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Enrolled Students');
  XLSX.writeFile(workbook, `Enrolled_Students_${new Date().toISOString().split('T')[0]}.xlsx`);
};

/**
 * Parse an uploaded Excel or CSV file containing student records
 * Flexible matching for headers: Student ID, Name, Parentage, Class, Gender, DOB, Session, Stream, Phone, Email
 */
export const parseStudentsFromExcel = (file: File): Promise<Student[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        if (!buffer) {
          reject(new Error('File is empty or could not be read.'));
          return;
        }

        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rawRows || rawRows.length === 0) {
          reject(new Error('No data rows found in the uploaded Excel file.'));
          return;
        }

        const parsedStudents: Student[] = [];
        let autoIdCounter = 1;

        rawRows.forEach((row) => {
          const keys = Object.keys(row);
          const getVal = (...possibleKeys: string[]): string => {
            for (const pk of possibleKeys) {
              const matchedKey = keys.find(
                (k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === pk.toLowerCase().replace(/[^a-z0-9]/g, '')
              );
              if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null) {
                return String(row[matchedKey]).trim();
              }
            }
            return '';
          };

          const rawId = getVal('studentid', 'id', 'rollno', 'roll', 'studentcode', 'sno', 'regno', 'registrationno', 'admissionno', 'code');
          const rawName = getVal('name', 'studentname', 'fullname', 'nameofstudent', 'candidate', 'candidatename', 'student');
          const rawParentage = getVal('parentage', 'fathername', 'parentname', 'guardian', 'fathersname', 'father', 'mothername');
          const rawClass = getVal('class', 'classname', 'grade', 'standard', 'sec', 'section', 'classlevel');
          const rawGender = getVal('gender', 'sex');
          const rawDob = getVal('dob', 'dateofbirth', 'birthdate');
          const rawSession = getVal('academicsession', 'session', 'academic', 'year');
          const rawStream = getVal('stream', 'subjectstream', 'branch', 'subject');
          const phone = getVal('phone', 'mobile', 'contact', 'phonenumber', 'mobilenumber', 'contactno', 'mobileno');
          const email = getVal('email', 'mail', 'emailaddress');

          if (!rawName && !rawParentage && !rawId) return;

          let finalId = rawId ? rawId.toUpperCase() : `STU${autoIdCounter++}`;
          if (!finalId.startsWith('STU') && !isNaN(Number(finalId))) {
            finalId = `STU${finalId}`;
          }

          let finalClass: any = 'Class 9';
          const classStr = rawClass.toLowerCase();
          if (classStr.includes('12') || classStr.includes('twelve')) finalClass = 'Class 12';
          else if (classStr.includes('11') || classStr.includes('eleven')) finalClass = 'Class 11';
          else if (classStr.includes('10') || classStr.includes('ten')) finalClass = 'Class 10';
          else if (classStr.includes('9') || classStr.includes('nine')) finalClass = 'Class 9';

          let finalGender = 'Boy';
          if (rawGender.toLowerCase().startsWith('g') || rawGender.toLowerCase().startsWith('f')) {
            finalGender = 'Girl';
          } else if (rawGender) {
            finalGender = rawGender;
          }

          if (rawName) {
            parsedStudents.push({
              id: finalId,
              name: rawName,
              parentage: rawParentage || 'N/A',
              className: finalClass,
              academicSession: rawSession || '2025-2026',
              gender: finalGender,
              dob: rawDob || undefined,
              stream: rawStream || undefined,
              phone: phone || undefined,
              email: email || undefined,
              enrollmentDate: new Date().toISOString().split('T')[0],
            });
          }
        });

        if (parsedStudents.length === 0) {
          reject(
            new Error(
              'Could not find valid student records. Ensure file has columns like "Student ID", "Name", "Parentage", "Class".'
            )
          );
          return;
        }

        resolve(parsedStudents);
      } catch (err) {
        reject(new Error(`Failed to parse Excel file: ${(err as Error).message}`));
      }
    };

    reader.onerror = () => reject(new Error('Error reading the file.'));
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Print / Export PDF formatted document view
 */
export const printReportHTML = (title: string, htmlContent: string) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to view and print report PDF.');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #1e293b; }
          h1 { text-align: center; color: #0f172a; margin-bottom: 4px; font-size: 22px; }
          h2 { text-align: center; color: #2563eb; margin-top: 0; font-size: 16px; font-weight: 500; }
          .header-meta { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 20px; font-size: 13px; color: #64748b; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
          th { background-color: #2563eb; color: white; text-align: left; padding: 8px 12px; font-weight: 600; }
          td { border-bottom: 1px solid #e2e8f0; padding: 8px 12px; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .badge { padding: 2px 8px; borderRadius: 4px; font-weight: 600; font-size: 11px; display: inline-block; }
          .present { background-color: #dcfce7; color: #15803d; }
          .absent { background-color: #fee2e2; color: #b91c1c; }
          .late { background-color: #fef3c7; color: #b45309; }
          .leave { background-color: #e0f2fe; color: #0369a1; }
          .footer { margin-top: 30px; display: flex; justify-content: space-between; font-size: 12px; color: #64748b; }
          .signature-box { border-top: 1px solid #94a3b8; width: 200px; text-align: center; padding-top: 4px; margin-top: 40px; }
          @media print {
            .no-print { display: none; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 15px; text-align: right;">
          <button onclick="window.print()" style="background: #2563eb; color: white; border: none; padding: 8px 16px; font-weight: bold; border-radius: 6px; cursor: pointer;">
            🖨️ Print / Save as PDF
          </button>
        </div>
        ${htmlContent}
        <script>
          setTimeout(() => { window.print(); }, 500);
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};
