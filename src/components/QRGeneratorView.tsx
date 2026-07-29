import React, { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { renderToString } from 'react-dom/server';
import {
  QrCode,
  Printer,
  Download,
  Share2,
  Search,
  School,
  User,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import { Student, AppSettings } from '../types';

interface QRGeneratorViewProps {
  students: Student[];
  settings: AppSettings;
}

export const QRGeneratorView: React.FC<QRGeneratorViewProps> = ({ students, settings }) => {
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    students[0]?.id || ''
  );
  const [filterClass, setFilterClass] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const printableRef = useRef<HTMLDivElement>(null);

  const selectedStudent = students.find((s) => s.id === selectedStudentId) || students[0];

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = filterClass === 'All' || s.className === filterClass;
    return matchesSearch && matchesClass;
  });

  // Download QR Code image as PNG
  const handleDownloadQR = () => {
    if (!selectedStudent) return;
    const svgElement = document.getElementById(`qr-code-svg-${selectedStudent.id}`);
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width || 300;
      canvas.height = img.height || 300;
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        const safeName = selectedStudent.name.replace(/[^a-zA-Z0-9_-]/g, '_');
        const fileName = `QR_${selectedStudent.id}_${safeName}.png`;

        if (canvas.toBlob) {
          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              const downloadLink = document.createElement('a');
              downloadLink.download = fileName;
              downloadLink.href = url;
              document.body.appendChild(downloadLink);
              downloadLink.click();
              setTimeout(() => {
                document.body.removeChild(downloadLink);
                URL.revokeObjectURL(url);
              }, 1000);
            }
          }, 'image/png');
        } else {
          const pngFile = canvas.toDataURL('image/png');
          const downloadLink = document.createElement('a');
          downloadLink.download = fileName;
          downloadLink.href = pngFile;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          setTimeout(() => document.body.removeChild(downloadLink), 1000);
        }
      }
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  // Print single or bulk ID badges
  const handlePrint = (singleOnly: boolean = false) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print QR badges.');
      return;
    }

    const studentsToPrint = singleOnly && selectedStudent ? [selectedStudent] : filteredStudents;

    const cardsHtml = studentsToPrint
      .map((st) => {
        const qrSvgString = renderToString(
          <QRCodeSVG
            value={st.id}
            size={140}
            level="H"
            includeMargin={true}
            fgColor="#000000"
            bgColor="#ffffff"
          />
        );

        return `
      <div style="
        width: 280px;
        border: 2px solid #cbd5e1;
        border-radius: 16px;
        padding: 16px;
        margin: 10px;
        background: #ffffff;
        box-shadow: 0 4px 12px rgba(0,0,0,0.06);
        text-align: center;
        display: inline-block;
        vertical-align: top;
        font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
        page-break-inside: avoid;
        break-inside: avoid;
      ">
        <div style="border-bottom: 2px solid #0284c7; padding-bottom: 8px; margin-bottom: 12px;">
          <div style="font-size: 12px; font-weight: bold; color: #0284c7; text-transform: uppercase; letter-spacing: 0.5px;">
            ${settings.schoolName}
          </div>
          <div style="font-size: 10px; color: #64748b; font-weight: 600; margin-top: 2px;">
            ${settings.subjectName}
          </div>
        </div>

        <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 12px;">
          <div style="
            background: #ffffff;
            padding: 8px;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
            display: inline-block;
          ">
            ${qrSvgString}
          </div>
        </div>

        <div style="font-size: 16px; font-weight: 800; color: #0f172a; margin-bottom: 2px;">
          ${st.name}
        </div>
        <div style="font-size: 12px; font-weight: bold; color: #0284c7; font-family: monospace;">
          ID: ${st.id}
        </div>
        <div style="font-size: 11px; color: #475569; margin-top: 4px;">
          Parent: ${st.parentage}
        </div>
        <div style="font-size: 11px; font-weight: 600; color: #059669; margin-top: 2px;">
          ${st.className}
        </div>
      </div>
    `;
      })
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Student QR Code ID Cards - ${settings.schoolName}</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; padding: 20px; background: #f8fafc; color: #0f172a; margin: 0; }
            .no-print { margin-bottom: 20px; text-align: right; }
            .print-btn {
              background: #0284c7;
              color: #ffffff;
              border: none;
              padding: 10px 22px;
              font-weight: 700;
              font-size: 14px;
              border-radius: 10px;
              cursor: pointer;
              box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);
              transition: all 0.2s;
            }
            .print-btn:hover { background: #0369a1; }
            .cards-wrapper { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; }
            @media print {
              body { background: #ffffff; padding: 0; }
              .no-print { display: none !important; }
              .cards-wrapper { gap: 8px; }
            }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button onclick="window.print()" class="print-btn">
              🖨️ Print All Cards Now
            </button>
          </div>
          <div class="cards-wrapper">
            ${cardsHtml}
          </div>
          <script>
            setTimeout(() => {
              window.print();
            }, 300);
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111] border border-white/5 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden">
        <div>
          <div className="flex items-center space-x-2 text-[10px] font-bold uppercase tracking-widest text-cyan-500 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>ID Badge Generator</span>
          </div>
          <h1 className="text-2xl font-serif italic text-white tracking-tight flex items-center gap-2">
            <QrCode className="w-6 h-6 text-cyan-400" />
            Student QR ID Badges
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Generate, preview, and print high-resolution QR badges containing Student IDs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePrint(true)}
            className="flex items-center space-x-1.5 bg-[#0a0a0a] hover:bg-white/10 text-gray-300 border border-white/10 text-xs font-semibold px-3.5 py-2.5 rounded-xl transition-all"
          >
            <Printer className="w-4 h-4 text-cyan-400" />
            <span>Print Current Badge</span>
          </button>
          <button
            onClick={() => handlePrint(false)}
            className="flex items-center space-x-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl uppercase tracking-widest shadow-lg shadow-cyan-950/40 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Print All Cards</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Student Selector Sidebar */}
        <div className="bg-[#111] border border-white/5 rounded-3xl p-5 shadow-2xl">
          <p className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-3">Select Student</p>

          <div className="space-y-3 mb-4">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name/ID..."
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
            >
              <option value="All">All Classes</option>
              <option value="Class 9">Class 9</option>
              <option value="Class 10">Class 10</option>
              <option value="Class 11">Class 11</option>
              <option value="Class 12">Class 12</option>
            </select>
          </div>

          <div className="max-h-[420px] overflow-y-auto space-y-1.5 pr-1">
            {filteredStudents.map((student) => (
              <button
                key={student.id}
                onClick={() => setSelectedStudentId(student.id)}
                className={`w-full text-left p-2.5 rounded-xl text-xs flex items-center justify-between transition-all ${
                  selectedStudent?.id === student.id
                    ? 'bg-cyan-600 text-white font-semibold shadow-md'
                    : 'bg-[#0a0a0a] hover:bg-white/5 text-gray-300'
                }`}
              >
                <div>
                  <p className="font-bold">{student.name}</p>
                  <p className="text-[10px] opacity-80">{student.parentage}</p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-[11px] font-bold">{student.id}</span>
                  <p className="text-[10px] opacity-80">{student.className}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Live ID Card Preview */}
        {selectedStudent && (
          <div className="lg:col-span-2 bg-[#111] border border-white/5 rounded-3xl p-6 shadow-2xl flex flex-col items-center justify-center">
            <h2 className="text-[10px] uppercase font-bold tracking-widest text-gray-400 mb-4">
              Printable ID Badge Preview
            </h2>

            {/* Official ID Badge Card */}
            <div
              ref={printableRef}
              className="w-full max-w-sm bg-[#0a0a0a] border-2 border-white/10 rounded-3xl p-6 shadow-2xl text-white text-center relative overflow-hidden"
            >
              {/* Header */}
              <div className="border-b border-white/10 pb-3 mb-4">
                <div className="flex items-center justify-center gap-1.5 text-cyan-400 text-xs font-bold uppercase tracking-wider">
                  <School className="w-4 h-4" />
                  <span>{settings.schoolName}</span>
                </div>
                <p className="text-[11px] text-gray-400 font-medium mt-0.5">
                  {settings.subjectName}
                </p>
              </div>

              {/* QR Code Canvas */}
              <div className="bg-white p-4 rounded-2xl inline-block border-2 border-cyan-500/30 shadow-2xl mb-4">
                <QRCodeSVG
                  id={`qr-code-svg-${selectedStudent.id}`}
                  value={selectedStudent.id}
                  size={160}
                  level="H"
                  includeMargin={true}
                  fgColor="#000000"
                  bgColor="#ffffff"
                />
              </div>

              {/* Student Details */}
              <div className="space-y-1">
                <h3 className="text-lg font-serif italic text-white">{selectedStudent.name}</h3>
                <p className="text-sm font-mono font-bold text-cyan-400">
                  ID: {selectedStudent.id}
                </p>
                <p className="text-xs text-gray-400">Parentage: {selectedStudent.parentage}</p>
                <div className="pt-2">
                  <span className="px-3 py-1 bg-cyan-500/10 text-cyan-300 font-bold text-xs rounded-full border border-cyan-500/20">
                    {selectedStudent.className}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/10 text-[10px] text-gray-500 flex justify-between items-center uppercase tracking-widest">
                <span>Vocational Badge</span>
                <span>QR Attendance</span>
              </div>
            </div>

            {/* Actions for current student */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={handleDownloadQR}
                className="flex items-center space-x-2 bg-[#0a0a0a] hover:bg-white/10 text-gray-300 border border-white/10 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Download PNG</span>
              </button>

              <button
                onClick={() => handlePrint(true)}
                className="flex items-center space-x-2 bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-cyan-950/40"
              >
                <Printer className="w-4 h-4" />
                <span>Print Badge</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Cards Grid View */}
      <div className="bg-[#111] border border-white/5 rounded-3xl p-6 shadow-2xl">
        <h2 className="text-xs font-bold text-gray-300 mb-4 flex items-center justify-between uppercase tracking-widest">
          <span>Student QR Cards Grid ({filteredStudents.length})</span>
          <span className="text-[10px] text-gray-500 font-normal">Scannable Student IDs</span>
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {filteredStudents.map((st) => (
            <div
              key={st.id}
              className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-3 text-center flex flex-col items-center hover:border-white/10 transition-all"
            >
              <div className="bg-white p-2 rounded-xl border border-white/10 mb-2">
                <QRCodeSVG
                  id={`qr-code-svg-${st.id}`}
                  value={st.id}
                  size={90}
                  level="M"
                  includeMargin={false}
                  fgColor="#000000"
                  bgColor="#ffffff"
                />
              </div>
              <p className="font-bold text-xs text-white truncate w-full">{st.name}</p>
              <p className="font-mono text-[11px] font-bold text-cyan-400">{st.id}</p>
              <span className="text-[10px] text-gray-400">{st.className}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
