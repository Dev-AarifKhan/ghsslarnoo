import React, { useState, useRef } from 'react';
import {
  Contact,
  Search,
  Upload,
  Download,
  FolderArchive,
  Image as ImageIcon,
  CheckCircle2,
  RefreshCw,
  X,
  User,
  School,
  ShieldCheck,
  Check,
  FileType,
  FileText,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import { Student, AppSettings } from '../types';

interface StudentIDCardViewProps {
  students: Student[];
  settings: AppSettings;
  onUpdateStudent: (student: Student) => { success: boolean; message: string };
}

type CardTheme = 'official' | 'cyber_tech' | 'glassmorphism' | 'swiss_minimal' | 'gradient_wave' | 'navy' | 'emerald' | 'burgundy' | 'midnight';
type CardOrientation = 'portrait' | 'landscape';
type BulkExportFormat = 'zip_jpg' | 'zip_pdf' | 'single_pdf';

export const StudentIDCardView: React.FC<StudentIDCardViewProps> = ({
  students,
  settings,
  onUpdateStudent,
}) => {
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    students.length > 0 ? students[0].id : ''
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('All');
  const [cardTheme, setCardTheme] = useState<CardTheme>('official');
  const [cardOrientation, setCardOrientation] = useState<CardOrientation>('portrait');
  const [selectedForBulk, setSelectedForBulk] = useState<Record<string, boolean>>({});

  // Single card download state
  const [isDownloadingSingle, setIsDownloadingSingle] = useState<'jpg' | 'pdf' | null>(null);
  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState<string | null>(null);

  // Bulk download modal state
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkScope, setBulkScope] = useState<'all' | 'class' | 'selected'>('all');
  const [bulkClass, setBulkClass] = useState<string>('All');
  const [bulkFormat, setBulkFormat] = useState<BulkExportFormat>('zip_jpg');
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });

  // Offscreen bulk render student state
  const [bulkRenderStudent, setBulkRenderStudent] = useState<Student | null>(null);

  // References
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const bulkCardRef = useRef<HTMLDivElement>(null);

  // Filter students list
  const filteredStudents = students.filter((s) => {
    const matchesClass = selectedClass === 'All' || s.className === selectedClass;
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.parentage.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesClass && matchesSearch;
  });

  const selectedStudent = students.find((s) => s.id === selectedStudentId) || students[0];

  // Handle Local Photo Upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedStudent) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Photo size is too large. Please select an image under 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Photo = event.target?.result as string;
      if (base64Photo) {
        const updatedStudent: Student = {
          ...selectedStudent,
          photoUrl: base64Photo,
        };
        onUpdateStudent(updatedStudent);
      }
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove photo
  const handleRemovePhoto = () => {
    if (!selectedStudent) return;
    const updatedStudent: Student = {
      ...selectedStudent,
      photoUrl: undefined,
    };
    onUpdateStudent(updatedStudent);
  };

  // Bulk selection helper
  const toggleSelectForBulk = (id: string) => {
    setSelectedForBulk((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const toggleSelectAllFiltered = () => {
    const allSelected = filteredStudents.every((s) => selectedForBulk[s.id]);
    const updated = { ...selectedForBulk };
    filteredStudents.forEach((s) => {
      updated[s.id] = !allSelected;
    });
    setSelectedForBulk(updated);
  };

  // Helper to reliably trigger local computer download via Blob URL
  const downloadFileBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  };

  // Helper to convert modern CSS color functions (like oklch, oklab, color-mix) into standard rgb/rgba
  const convertModernColorFunctions = (str: string): string => {
    if (!str) return str;
    let result = str;

    // Replace oklch(L C H [/ A])
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

        if (isNaN(L) || isNaN(C)) return 'rgb(15, 23, 42)';

        // OKLCH to OKLAB
        const hRad = (H * Math.PI) / 180;
        const labA = C * Math.cos(hRad);
        const labB = C * Math.sin(hRad);

        // OKLAB to Linear RGB
        const l_ = L + 0.3963377774 * labA + 0.2158037573 * labB;
        const m_ = L - 0.1055613458 * labA - 0.0638541728 * labB;
        const s_ = L - 0.0894841775 * labA - 0.1291851517 * labB;

        const l3 = l_ * l_ * l_;
        const m3 = m_ * m_ * m_;
        const s3 = s_ * s_ * s_;

        const r_lin = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
        const g_lin = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
        const b_lin = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

        const gamma = (val: number) =>
          val >= 0.0031308 ? 1.055 * Math.pow(val, 1 / 2.4) - 0.055 : 12.92 * val;

        const outR = Math.min(255, Math.max(0, Math.round(gamma(r_lin) * 255)));
        const outG = Math.min(255, Math.max(0, Math.round(gamma(g_lin) * 255)));
        const outB = Math.min(255, Math.max(0, Math.round(gamma(b_lin) * 255)));

        if (alpha < 1) {
          return `rgba(${outR}, ${outG}, ${outB}, ${alpha.toFixed(3)})`;
        }
        return `rgb(${outR}, ${outG}, ${outB})`;
      } catch {
        return 'rgb(15, 23, 42)';
      }
    });

    result = result.replace(/oklch\([\s\S]*?\)/gi, 'rgb(15, 23, 42)');
    result = result.replace(/oklab\([\s\S]*?\)/gi, 'rgb(15, 23, 42)');
    result = result.replace(/color-mix\([\s\S]*?\)/gi, 'rgb(15, 23, 42)');
    result = result.replace(/light-dark\([\s\S]*?\)/gi, 'rgb(15, 23, 42)');

    return result;
  };

  // Helper to make sure all images in container are fully loaded before html2canvas
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

  // Core High-Resolution Canvas Renderer with QR & Image Preloading + OKLCH color sanitizer
  const renderCardToCanvas = async (element: HTMLElement): Promise<HTMLCanvasElement> => {
    await ensureImagesLoaded(element);
    return html2canvas(element, {
      scale: 3, // High-DPI quality
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      onclone: (clonedDoc, clonedElement) => {
        const targetEl = clonedElement || clonedDoc.querySelector('[data-card]') || clonedDoc.body;
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
            'accent-color',
            'caret-color',
            'background',
          ];

          targets.forEach((el) => {
            const htmlEl = el as HTMLElement;

            try {
              const computed = view.getComputedStyle(el);
              colorProps.forEach((prop) => {
                let val = computed.getPropertyValue(prop);
                if (val && typeof val === 'string') {
                  if (/oklch|oklab|color-mix|light-dark/i.test(val)) {
                    val = convertModernColorFunctions(val);
                  }
                  htmlEl.style.setProperty(prop, val);
                }
              });
            } catch (e) {
              // Ignore
            }

            const styleAttr = htmlEl.getAttribute('style');
            if (styleAttr && /oklch|oklab|color-mix|light-dark/i.test(styleAttr)) {
              htmlEl.setAttribute('style', convertModernColorFunctions(styleAttr));
            }
          });
        }

        // Sanitize all style elements
        clonedDoc.querySelectorAll('style').forEach((styleEl) => {
          try {
            if (styleEl.textContent && /oklch|oklab|color-mix|light-dark/i.test(styleEl.textContent)) {
              styleEl.textContent = convertModernColorFunctions(styleEl.textContent);
            }
          } catch (e) {
            // Ignore
          }
        });

        // Sanitize or replace external stylesheets
        clonedDoc.querySelectorAll('link[rel="stylesheet"]').forEach((linkEl) => {
          try {
            const sheet = (linkEl as HTMLLinkElement).sheet;
            if (sheet) {
              let isClean = true;
              const rules = Array.from(sheet.cssRules || []);
              let newCss = '';
              rules.forEach((rule) => {
                let txt = rule.cssText;
                if (/oklch|oklab|color-mix|light-dark/i.test(txt)) {
                  isClean = false;
                  txt = convertModernColorFunctions(txt);
                }
                newCss += txt + '\n';
              });
              if (!isClean) {
                const newStyle = clonedDoc.createElement('style');
                newStyle.textContent = newCss;
                if (linkEl.parentNode) {
                  linkEl.parentNode.replaceChild(newStyle, linkEl);
                }
              }
            }
          } catch (e) {
            // Cross-origin or unreadable stylesheet: remove link element from clone so html2canvas doesn't fail parsing oklch
            if (linkEl.parentNode) {
              linkEl.parentNode.removeChild(linkEl);
            }
          }
        });
      },
    });
  };

  // Download Single ID Card JPEG
  const handleDownloadSingleJpg = async () => {
    if (!cardRef.current || !selectedStudent) return;
    setIsDownloadingSingle('jpg');
    setDownloadSuccessMessage(null);

    try {
      await new Promise((res) => setTimeout(res, 200));

      const canvas = await renderCardToCanvas(cardRef.current);
      const safeName = selectedStudent.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `${safeName}_${selectedStudent.id}_ID_Card.jpg`;

      if (canvas.toBlob) {
        canvas.toBlob((blob) => {
          if (blob) {
            downloadFileBlob(blob, fileName);
          } else {
            const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            setTimeout(() => document.body.removeChild(link), 1000);
          }
        }, 'image/jpeg', 0.95);
      } else {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => document.body.removeChild(link), 1000);
      }

      setDownloadSuccessMessage(`Downloaded HD JPEG ID Card for ${selectedStudent.name}!`);
      setTimeout(() => setDownloadSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error('Error rendering ID card image:', err);
      alert(`Failed to generate ID Card image: ${err?.message || 'Please try again.'}`);
    } finally {
      setIsDownloadingSingle(null);
    }
  };

  // Download Single ID Card PDF (CR80 Standard Physical Size)
  const handleDownloadSinglePdf = async () => {
    if (!cardRef.current || !selectedStudent) return;
    setIsDownloadingSingle('pdf');
    setDownloadSuccessMessage(null);

    try {
      await new Promise((res) => setTimeout(res, 200));

      const canvas = await renderCardToCanvas(cardRef.current);
      const isPortrait = cardOrientation === 'portrait';
      const cardWidthMM = isPortrait ? 53.98 : 85.6;
      const cardHeightMM = isPortrait ? 85.6 : 53.98;

      const pdf = new jsPDF({
        orientation: isPortrait ? 'portrait' : 'landscape',
        unit: 'mm',
        format: [cardWidthMM, cardHeightMM],
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      pdf.addImage(imgData, 'JPEG', 0, 0, cardWidthMM, cardHeightMM);

      const safeName = selectedStudent.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `${safeName}_${selectedStudent.id}_ID_Card.pdf`;

      const pdfBlob = pdf.output('blob');
      downloadFileBlob(pdfBlob, fileName);

      setDownloadSuccessMessage(`Downloaded Print-Ready PDF ID Card for ${selectedStudent.name}!`);
      setTimeout(() => setDownloadSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error('Error generating ID card PDF:', err);
      alert(`Failed to generate ID Card PDF: ${err?.message || 'Please try again.'}`);
    } finally {
      setIsDownloadingSingle(null);
    }
  };

  // Bulk Download Handler (ZIP of JPGs, ZIP of PDFs, or Single Master PDF)
  const handleStartBulkDownload = async () => {
    let targetList: Student[] = [];
    if (bulkScope === 'all') {
      targetList = students;
    } else if (bulkScope === 'class') {
      targetList = bulkClass === 'All' ? students : students.filter((s) => s.className === bulkClass);
    } else {
      targetList = students.filter((s) => selectedForBulk[s.id]);
    }

    if (targetList.length === 0) {
      alert('No students selected for bulk download.');
      return;
    }

    setIsProcessingBulk(true);
    setBulkProgress({ current: 0, total: targetList.length });

    const isPortrait = cardOrientation === 'portrait';
    const cardWidthMM = isPortrait ? 53.98 : 85.6;
    const cardHeightMM = isPortrait ? 85.6 : 53.98;
    const safeSchool = settings.schoolName.replace(/[^a-zA-Z0-9_-]/g, '_');

    try {
      if (bulkFormat === 'single_pdf') {
        // Combined Master PDF Document
        let masterPdf: jsPDF | null = null;

        for (let i = 0; i < targetList.length; i++) {
          const student = targetList[i];
          setBulkProgress({ current: i + 1, total: targetList.length });

          setBulkRenderStudent(student);
          await new Promise((res) => setTimeout(res, 250));

          if (bulkCardRef.current) {
            const canvas = await renderCardToCanvas(bulkCardRef.current);
            const imgData = canvas.toDataURL('image/jpeg', 0.98);

            if (!masterPdf) {
              masterPdf = new jsPDF({
                orientation: isPortrait ? 'portrait' : 'landscape',
                unit: 'mm',
                format: [cardWidthMM, cardHeightMM],
              });
            } else {
              masterPdf.addPage([cardWidthMM, cardHeightMM], isPortrait ? 'portrait' : 'landscape');
            }

            masterPdf.addImage(imgData, 'JPEG', 0, 0, cardWidthMM, cardHeightMM);
          }
        }

        if (masterPdf) {
          const masterPdfBlob = masterPdf.output('blob');
          downloadFileBlob(masterPdfBlob, `Student_ID_Cards_Master_${safeSchool}.pdf`);
        }
      } else {
        // ZIP Package (ZIP of JPGs or ZIP of PDFs)
        const zip = new JSZip();
        const folder = zip.folder('Student_ID_Cards') || zip;

        for (let i = 0; i < targetList.length; i++) {
          const student = targetList[i];
          setBulkProgress({ current: i + 1, total: targetList.length });

          setBulkRenderStudent(student);
          await new Promise((res) => setTimeout(res, 250));

          if (bulkCardRef.current) {
            const canvas = await renderCardToCanvas(bulkCardRef.current);
            const safeName = student.name.replace(/[^a-zA-Z0-9_-]/g, '_');
            const safeClass = student.className.replace(/\s+/g, '_');

            if (bulkFormat === 'zip_jpg') {
              const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
              const base64Data = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
              folder.file(`${safeClass}_${safeName}_${student.id}.jpg`, base64Data, { base64: true });
            } else if (bulkFormat === 'zip_pdf') {
              const pdf = new jsPDF({
                orientation: isPortrait ? 'portrait' : 'landscape',
                unit: 'mm',
                format: [cardWidthMM, cardHeightMM],
              });
              const imgData = canvas.toDataURL('image/jpeg', 0.98);
              pdf.addImage(imgData, 'JPEG', 0, 0, cardWidthMM, cardHeightMM);
              const pdfArrayBuffer = pdf.output('arraybuffer');
              folder.file(`${safeClass}_${safeName}_${student.id}.pdf`, pdfArrayBuffer);
            }
          }
        }

        const zipContent = await zip.generateAsync({ type: 'blob' });
        downloadFileBlob(zipContent, `Student_ID_Cards_${safeSchool}.zip`);
      }

      setIsBulkModalOpen(false);
    } catch (err: any) {
      console.error('Bulk generation error:', err);
      alert(`An error occurred during bulk generation: ${err?.message || 'Please try again.'}`);
    } finally {
      setIsProcessingBulk(false);
      setBulkRenderStudent(null);
    }
  };

  // Theme styling definitions
  const getThemeStyle = (theme: CardTheme) => {
    switch (theme) {
      case 'cyber_tech':
        return {
          headerBg: 'bg-slate-950 text-cyan-400 border-b border-cyan-500/30',
          accentBorder: 'border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.5)]',
          badgeBg: 'bg-cyan-500 text-black font-mono',
          idBadgeBg: 'bg-cyan-950 text-cyan-300 border-cyan-500/50',
          tagBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
          goldLine: 'bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-cyan-400',
        };
      case 'glassmorphism':
        return {
          headerBg: 'bg-white/20 backdrop-blur-md text-white border-b border-white/20',
          accentBorder: 'border-white/50 shadow-lg',
          badgeBg: 'bg-white/30 text-white backdrop-blur-md',
          idBadgeBg: 'bg-white/20 text-white border-white/40',
          tagBg: 'bg-white/20 text-white border-white/30',
          goldLine: 'bg-gradient-to-r from-white/60 via-white/90 to-white/60',
        };
      case 'swiss_minimal':
        return {
          headerBg: 'bg-black text-white',
          accentBorder: 'border-black',
          badgeBg: 'bg-amber-400 text-black font-black',
          idBadgeBg: 'bg-yellow-100 text-black border-2 border-black font-mono font-bold',
          tagBg: 'bg-black text-white',
          goldLine: 'bg-amber-400',
        };
      case 'gradient_wave':
        return {
          headerBg: 'bg-gradient-to-r from-rose-500 via-purple-600 to-indigo-600 text-white',
          accentBorder: 'border-rose-400',
          badgeBg: 'bg-rose-500 text-white',
          idBadgeBg: 'bg-rose-100 text-rose-900 border-rose-300',
          tagBg: 'bg-rose-500/20 text-rose-200 border-rose-300/30',
          goldLine: 'bg-gradient-to-r from-amber-300 via-rose-300 to-indigo-300',
        };
      case 'emerald':
        return {
          headerBg: 'bg-gradient-to-r from-emerald-900 via-teal-800 to-emerald-950',
          accentBorder: 'border-emerald-500',
          badgeBg: 'bg-emerald-600 text-white',
          idBadgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
          tagBg: 'bg-emerald-500/20 text-emerald-200 border-emerald-300/30',
          goldLine: 'bg-gradient-to-r from-amber-400 via-emerald-300 to-amber-400',
        };
      case 'burgundy':
        return {
          headerBg: 'bg-gradient-to-r from-rose-950 via-rose-900 to-amber-950',
          accentBorder: 'border-amber-500',
          badgeBg: 'bg-amber-600 text-white',
          idBadgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
          tagBg: 'bg-amber-500/20 text-amber-200 border-amber-300/30',
          goldLine: 'bg-gradient-to-r from-amber-300 via-rose-300 to-amber-300',
        };
      case 'midnight':
        return {
          headerBg: 'bg-gradient-to-r from-slate-900 via-zinc-900 to-black',
          accentBorder: 'border-cyan-400',
          badgeBg: 'bg-cyan-600 text-white',
          idBadgeBg: 'bg-cyan-100 text-cyan-900 border-cyan-300',
          tagBg: 'bg-cyan-500/20 text-cyan-200 border-cyan-300/30',
          goldLine: 'bg-gradient-to-r from-cyan-400 via-slate-300 to-cyan-400',
        };
      case 'navy':
      default:
        return {
          headerBg: 'bg-gradient-to-r from-blue-950 via-indigo-900 to-slate-950',
          accentBorder: 'border-cyan-400',
          badgeBg: 'bg-blue-600 text-white',
          idBadgeBg: 'bg-blue-100 text-blue-900 border-blue-300',
          tagBg: 'bg-cyan-400/20 text-cyan-200 border-cyan-300/30',
          goldLine: 'bg-gradient-to-r from-amber-400 via-cyan-300 to-amber-400',
        };
    }
  };

  const themeStyle = getThemeStyle(cardTheme);

  // Helper to format class name as Roman numeral (e.g. Class 12 -> XII)
  const formatRomanClass = (cls: string) => {
    if (!cls) return 'XII';
    const lower = cls.toLowerCase();
    if (lower.includes('12') || lower.includes('xii')) return 'XII';
    if (lower.includes('11') || lower.includes('xi')) return 'XI';
    if (lower.includes('10') || lower.includes('x')) return 'X';
    if (lower.includes('9') || lower.includes('ix')) return 'IX';
    return cls.replace(/^class\s+/i, '');
  };

  // Reusable Executive CR80 ID Card DOM Component
  const renderCardContent = (student: Student) => {
    const isPortrait = cardOrientation === 'portrait';
    const isSeniorClass = student.className === 'Class 11' || student.className === 'Class 12';

    if (cardTheme === 'official') {
      const romanClass = formatRomanClass(student.className);

      if (isPortrait) {
        return (
          <div
            style={{
              width: '350px',
              height: '560px',
              padding: '3px',
              backgroundColor: '#ffffff',
              borderRadius: '22px',
              border: '3px dashed #6366f1',
            }}
            className="relative overflow-hidden font-sans select-none shrink-0 shadow-2xl flex flex-col justify-between"
          >
            <div className="bg-[#fffdfa] rounded-[18px] h-full w-full flex flex-col justify-between overflow-hidden relative">
              {/* Background Circular Seal Watermark */}
              <div
                style={{
                  position: 'absolute',
                  top: '52%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  opacity: 0.12,
                  pointerEvents: 'none',
                  width: '230px',
                  height: '230px',
                  zIndex: 0,
                }}
              >
                <svg viewBox="0 0 200 200" className="w-full h-full text-slate-800">
                  <path id="circlePath" d="M 100, 100 m -75, 0 a 75,75 0 1,1 150,0 a 75,75 0 1,1 -150,0" fill="none" />
                  <circle cx="100" cy="100" r="88" stroke="currentColor" strokeWidth="2" fill="none" />
                  <circle cx="100" cy="100" r="62" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" fill="none" />
                  <text fontSize="8.5" fontWeight="bold" fill="currentColor" letterSpacing="0.8">
                    <textPath href="#circlePath" startOffset="50%" textAnchor="middle">
                      GOVT HIGHER SECONDARY SCHOOL • ESTD 1935 • LARNOO
                    </textPath>
                  </text>
                  <g transform="translate(68, 68) scale(1.3)">
                    <path fill="currentColor" d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3zm0 2.84L18 11h-1v7h-2v-6H9v6H7v-7H6l6-5.16z"/>
                  </g>
                </svg>
              </div>

              {/* Top Header Banner */}
              <div className="bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-600 p-2.5 text-center relative z-10 shadow-sm">
                <h1 className="text-[14px] font-black uppercase text-rose-800 tracking-wide leading-tight">
                  STUDENT ID CARD
                </h1>
                <h2 className="text-[12px] font-extrabold uppercase text-slate-900 tracking-tight leading-tight mt-0.5">
                  {settings.schoolName || 'GOVT. HIGHER SECONDARY SCHOOL'}
                </h2>
                <h3 className="text-[12px] font-extrabold uppercase text-slate-900 tracking-tight leading-tight">
                  LARNOO
                </h3>
              </div>

              {/* Body Content */}
              <div className="px-3 py-2 flex-1 flex flex-col justify-between relative z-10">
                {/* Student Photo */}
                <div className="flex justify-center mt-1 mb-2">
                  <div className="w-32 h-36 rounded-2xl border-4 border-pink-400 overflow-hidden bg-slate-100 shadow-md flex items-center justify-center p-0.5 relative">
                    {student.photoUrl ? (
                      <img
                        src={student.photoUrl}
                        alt={student.name}
                        crossOrigin="anonymous"
                        className="w-full h-full object-cover rounded-xl"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-200 flex flex-col items-center justify-center text-slate-400">
                        <User className="w-12 h-12 stroke-1" />
                        <span className="text-[9px] font-bold uppercase mt-1">PHOTO</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Info Fields Stack */}
                <div className="space-y-1.5 flex-1 flex flex-col justify-center">
                  {/* Student ID */}
                  <div className="bg-[#fce7f3]/80 border border-pink-200/80 rounded-xl px-2.5 py-1 flex items-center justify-between">
                    <span className="text-rose-900 font-extrabold text-[11px] w-28 shrink-0">Student ID:</span>
                    <span className="text-slate-950 font-black text-[11px] uppercase tracking-wider">{student.id}</span>
                  </div>

                  {/* Name */}
                  <div className="bg-[#fce7f3]/80 border border-pink-200/80 rounded-xl px-2.5 py-1 flex items-center justify-between">
                    <span className="text-rose-900 font-extrabold text-[11px] w-28 shrink-0">Name:</span>
                    <span className="text-slate-950 font-black text-[11px] uppercase truncate">{student.name}</span>
                  </div>

                  {/* Parentage */}
                  <div className="bg-[#fce7f3]/80 border border-pink-200/80 rounded-xl px-2.5 py-1 flex items-center justify-between">
                    <span className="text-rose-900 font-extrabold text-[11px] w-28 shrink-0">Parentage:</span>
                    <span className="text-slate-950 font-black text-[11px] uppercase truncate">{student.parentage}</span>
                  </div>

                  {/* Address */}
                  <div className="bg-[#fce7f3]/80 border border-pink-200/80 rounded-xl px-2.5 py-1 flex items-center justify-between">
                    <span className="text-rose-900 font-extrabold text-[11px] w-28 shrink-0">Address:</span>
                    <span className="text-slate-950 font-black text-[11px] uppercase truncate">{student.address || 'BHATPORA LARNOO'}</span>
                  </div>

                  {/* Class */}
                  <div className="bg-[#fce7f3]/80 border border-pink-200/80 rounded-xl px-2.5 py-1 flex items-center justify-between">
                    <span className="text-rose-900 font-extrabold text-[11px] w-28 shrink-0">Class:</span>
                    <span className="text-slate-950 font-black text-[11px] uppercase">{romanClass}</span>
                  </div>

                  {/* Valid Upto + Signature + QR Code Row */}
                  <div className="flex items-end justify-between gap-1 pt-0.5">
                    {/* Valid Upto pill */}
                    <div className="bg-[#fce7f3]/80 border border-pink-200/80 rounded-xl px-2.5 py-1 flex items-center justify-between flex-1">
                      <span className="text-rose-900 font-extrabold text-[11px] whitespace-nowrap mr-2">Valid Upto:</span>
                      <span className="text-slate-950 font-black text-[11px] font-mono">{student.validUpto || '31/12/2026'}</span>
                    </div>

                    {/* Principal Signature */}
                    <div className="relative text-center px-1 shrink-0 flex flex-col items-center justify-end h-10">
                      <svg viewBox="0 0 100 40" className="w-16 h-8 text-indigo-900 fill-none stroke-current stroke-2">
                        <path d="M 10 30 Q 20 5 30 25 T 50 15 T 70 28 T 90 10 M 20 28 L 80 20" strokeLinecap="round" />
                      </svg>
                      <span className="text-[9px] font-bold text-indigo-950 font-serif italic -mt-2">Principal</span>
                    </div>

                    {/* QR Code */}
                    <div className="bg-white p-1 rounded-xl border border-slate-300 shadow-sm shrink-0">
                      <QRCodeSVG value={student.id} size={64} level="H" includeMargin={false} fgColor="#000000" bgColor="#ffffff" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Section */}
              <div className="bg-gradient-to-r from-amber-100 via-yellow-100 to-emerald-100 border-t border-amber-200 p-2 text-center text-slate-800 leading-tight text-[9px] space-y-0.5 relative z-10">
                <div>
                  <span className="font-extrabold text-slate-900">School Address: </span>
                  <span>{settings.schoolAddress || 'LARNOO, KOKERNAG, ANANTNAG, PINCODE: 192202'}</span>
                </div>
                <div>
                  <span className="font-extrabold text-slate-900">Email: </span>
                  <span>{settings.schoolEmail || 'hsslarnoo024@gmail.com'}</span>
                </div>
                <div>
                  <span className="font-extrabold text-slate-900">UDISE Code: </span>
                  <span>{settings.udiseCode || '01061601505'}</span>
                  <span className="font-extrabold text-slate-900"> | Phone: </span>
                  <span>{settings.phone || '+91-7006485144'}</span>
                </div>
              </div>
            </div>
          </div>
        );
      } else {
        /* LANDSCAPE OFFICIAL LAYOUT */
        return (
          <div
            style={{
              width: '540px',
              height: '350px',
              padding: '3px',
              backgroundColor: '#ffffff',
              borderRadius: '22px',
              border: '3px dashed #6366f1',
            }}
            className="relative overflow-hidden font-sans select-none shrink-0 shadow-2xl flex flex-col justify-between"
          >
            <div className="bg-[#fffdfa] rounded-[18px] h-full w-full flex flex-col justify-between overflow-hidden relative">
              {/* Background Circular Seal Watermark */}
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  opacity: 0.12,
                  pointerEvents: 'none',
                  width: '200px',
                  height: '200px',
                  zIndex: 0,
                }}
              >
                <svg viewBox="0 0 200 200" className="w-full h-full text-slate-800">
                  <path id="circlePath" d="M 100, 100 m -75, 0 a 75,75 0 1,1 150,0 a 75,75 0 1,1 -150,0" fill="none" />
                  <circle cx="100" cy="100" r="88" stroke="currentColor" strokeWidth="2" fill="none" />
                  <circle cx="100" cy="100" r="62" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" fill="none" />
                  <text fontSize="8.5" fontWeight="bold" fill="currentColor" letterSpacing="0.8">
                    <textPath href="#circlePath" startOffset="50%" textAnchor="middle">
                      GOVT HIGHER SECONDARY SCHOOL • ESTD 1935 • LARNOO
                    </textPath>
                  </text>
                  <g transform="translate(68, 68) scale(1.3)">
                    <path fill="currentColor" d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3zm0 2.84L18 11h-1v7h-2v-6H9v6H7v-7H6l6-5.16z"/>
                  </g>
                </svg>
              </div>

              {/* Top Header Banner */}
              <div className="bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-600 p-2 text-center relative z-10 shadow-sm flex items-center justify-between px-4">
                <h1 className="text-[12px] font-black uppercase text-rose-800 tracking-wide">
                  STUDENT ID CARD
                </h1>
                <div className="text-right">
                  <h2 className="text-[11px] font-extrabold uppercase text-slate-900 tracking-tight leading-tight">
                    {settings.schoolName || 'GOVT. HIGHER SECONDARY SCHOOL LARNOO'}
                  </h2>
                </div>
              </div>

              {/* Main Content Row */}
              <div className="px-3 py-2 flex-1 flex items-center gap-3 relative z-10">
                {/* Left Photo */}
                <div className="w-28 h-32 rounded-2xl border-4 border-pink-400 overflow-hidden bg-slate-100 shadow-md flex items-center justify-center p-0.5 shrink-0">
                  {student.photoUrl ? (
                    <img
                      src={student.photoUrl}
                      alt={student.name}
                      crossOrigin="anonymous"
                      className="w-full h-full object-cover rounded-xl"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-200 flex flex-col items-center justify-center text-slate-400">
                      <User className="w-10 h-10 stroke-1" />
                      <span className="text-[8px] font-bold uppercase mt-0.5">PHOTO</span>
                    </div>
                  )}
                </div>

                {/* Middle Info Stack */}
                <div className="flex-1 space-y-1">
                  <div className="bg-[#fce7f3]/80 border border-pink-200/80 rounded-xl px-2.5 py-0.5 flex items-center justify-between text-[10px]">
                    <span className="text-rose-900 font-extrabold w-24 shrink-0">Student ID:</span>
                    <span className="text-slate-950 font-black uppercase">{student.id}</span>
                  </div>
                  <div className="bg-[#fce7f3]/80 border border-pink-200/80 rounded-xl px-2.5 py-0.5 flex items-center justify-between text-[10px]">
                    <span className="text-rose-900 font-extrabold w-24 shrink-0">Name:</span>
                    <span className="text-slate-950 font-black uppercase truncate">{student.name}</span>
                  </div>
                  <div className="bg-[#fce7f3]/80 border border-pink-200/80 rounded-xl px-2.5 py-0.5 flex items-center justify-between text-[10px]">
                    <span className="text-rose-900 font-extrabold w-24 shrink-0">Parentage:</span>
                    <span className="text-slate-950 font-black uppercase truncate">{student.parentage}</span>
                  </div>
                  <div className="bg-[#fce7f3]/80 border border-pink-200/80 rounded-xl px-2.5 py-0.5 flex items-center justify-between text-[10px]">
                    <span className="text-rose-900 font-extrabold w-24 shrink-0">Address:</span>
                    <span className="text-slate-950 font-black uppercase truncate">{student.address || 'BHATPORA LARNOO'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <div className="bg-[#fce7f3]/80 border border-pink-200/80 rounded-xl px-2 py-0.5 flex items-center justify-between text-[10px]">
                      <span className="text-rose-900 font-extrabold mr-1">Class:</span>
                      <span className="text-slate-950 font-black uppercase">{romanClass}</span>
                    </div>
                    <div className="bg-[#fce7f3]/80 border border-pink-200/80 rounded-xl px-2 py-0.5 flex items-center justify-between text-[10px]">
                      <span className="text-rose-900 font-extrabold mr-1">Valid:</span>
                      <span className="text-slate-950 font-black font-mono">{student.validUpto || '31/12/2026'}</span>
                    </div>
                  </div>
                </div>

                {/* Right Side Signature & QR Code */}
                <div className="flex flex-col items-center justify-between h-32 shrink-0 border-l border-pink-200/50 pl-2">
                  <div className="bg-white p-1 rounded-xl border border-slate-300 shadow-sm">
                    <QRCodeSVG value={student.id} size={64} level="H" includeMargin={false} fgColor="#000000" bgColor="#ffffff" />
                  </div>
                  <div className="relative text-center flex flex-col items-center justify-end">
                    <svg viewBox="0 0 100 40" className="w-14 h-6 text-indigo-900 fill-none stroke-current stroke-2">
                      <path d="M 10 30 Q 20 5 30 25 T 50 15 T 70 28 T 90 10 M 20 28 L 80 20" strokeLinecap="round" />
                    </svg>
                    <span className="text-[8px] font-bold text-indigo-950 font-serif italic -mt-1">Principal</span>
                  </div>
                </div>
              </div>

              {/* Footer Section */}
              <div className="bg-gradient-to-r from-amber-100 via-yellow-100 to-emerald-100 border-t border-amber-200 p-1.5 text-center text-slate-800 leading-tight text-[8.5px] space-y-0.2 relative z-10">
                <div>
                  <span className="font-extrabold text-slate-900">School Address: </span>
                  <span>{settings.schoolAddress || 'LARNOO, KOKERNAG, ANANTNAG, PINCODE: 192202'}</span>
                </div>
                <div>
                  <span className="font-extrabold text-slate-900">Email: </span>
                  <span>{settings.schoolEmail || 'hsslarnoo024@gmail.com'}</span>
                  <span className="font-extrabold text-slate-900"> | UDISE Code: </span>
                  <span>{settings.udiseCode || '01061601505'}</span>
                  <span className="font-extrabold text-slate-900"> | Phone: </span>
                  <span>{settings.phone || '+91-7006485144'}</span>
                </div>
              </div>
            </div>
          </div>
        );
      }
    }

    return (
      <div
        style={{
          width: isPortrait ? '340px' : '532px',
          height: isPortrait ? '540px' : '340px',
        }}
        className="bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-300 relative overflow-hidden flex flex-col justify-between font-sans select-none shrink-0"
      >
        {/* Top Header Ribbon */}
        <div className={`${themeStyle.headerBg} text-white p-3.5 relative overflow-hidden shrink-0`}>
          <div className="flex items-center space-x-2.5 relative z-10">
            {/* School Emblem */}
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
              <School className="w-6 h-6 text-amber-300" />
            </div>

            <div className="leading-tight overflow-hidden flex-1">
              <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-white truncate">
                {settings.schoolName}
              </h2>
              <p className="text-[9px] text-cyan-100 font-medium truncate">
                {settings.subjectName || 'Vocational Subject: IT / ITES'}
              </p>
              <div
                className={`inline-block mt-0.5 px-2 py-0.2 rounded-full text-[8px] font-bold uppercase tracking-widest border ${themeStyle.tagBg}`}
              >
                STUDENT IDENTITY CARD
              </div>
            </div>
          </div>
          {/* Gold Accent Line */}
          <div className={`h-1 w-full absolute bottom-0 left-0 ${themeStyle.goldLine}`} />
        </div>

        {/* Card Body Content */}
        {isPortrait ? (
          /* PORTRAIT LAYOUT */
          <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2 bg-slate-50">
            {/* Photo & QR Section */}
            <div className="flex items-center justify-between gap-3">
              {/* Passport Photo */}
              <div className="relative">
                <div
                  className={`w-28 h-32 rounded-xl bg-white border-2 ${themeStyle.accentBorder} shadow-md overflow-hidden flex items-center justify-center p-0.5`}
                >
                  {student.photoUrl ? (
                    <img
                      src={student.photoUrl}
                      alt={student.name}
                      crossOrigin="anonymous"
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                      <User className="w-10 h-10 stroke-1" />
                      <span className="text-[8px] font-bold uppercase text-slate-400 mt-1">
                        PASSPORT PHOTO
                      </span>
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-1.5 -right-1.5 bg-slate-900 text-white text-[7px] font-bold px-1.5 py-0.5 rounded border border-slate-700 shadow flex items-center gap-0.5">
                  <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
                  <span>VERIFIED</span>
                </div>
              </div>

              {/* Attendance Scan QR Code */}
              <div className="flex flex-col items-center justify-center bg-white p-2 rounded-xl border border-slate-200 shadow-sm shrink-0">
                <QRCodeSVG value={student.id} size={86} level="H" includeMargin={false} fgColor="#000000" bgColor="#ffffff" />
                <span className="text-[7px] font-extrabold text-slate-700 mt-1 uppercase font-mono tracking-wider">
                  ATTENDANCE SCAN QR
                </span>
              </div>
            </div>

            {/* Student Info Box */}
            <div className="space-y-1.5 bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm">
              <div className="border-b border-slate-100 pb-1 flex items-center justify-between gap-2">
                <div>
                  <div className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">
                    Student Full Name
                  </div>
                  <div className="text-sm font-extrabold text-slate-900 leading-tight">
                    {student.name}
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-extrabold border ${themeStyle.idBadgeBg}`}
                >
                  {student.id}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
                <div>
                  <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold block">
                    Class / Grade
                  </span>
                  <span className="font-bold text-slate-800">{student.className}</span>
                </div>

                <div>
                  <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold block">
                    Parentage
                  </span>
                  <span className="font-semibold text-slate-700 truncate block">
                    {student.parentage}
                  </span>
                </div>

                <div>
                  <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold block">
                    Academic Session
                  </span>
                  <span className="font-semibold text-slate-700">
                    {student.academicSession || '2025-2026'}
                  </span>
                </div>

                <div>
                  <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold block">
                    Gender
                  </span>
                  <span className="font-semibold text-slate-700">{student.gender || 'Boy'}</span>
                </div>

                {student.dob && (
                  <div>
                    <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold block">
                      Date of Birth
                    </span>
                    <span className="font-medium text-slate-700 font-mono">{student.dob}</span>
                  </div>
                )}

                {(isSeniorClass || student.stream) && (
                  <div>
                    <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold block">
                      Stream
                    </span>
                    <span className="font-bold text-cyan-800 bg-cyan-50 px-1.5 py-0.2 rounded border border-cyan-200 inline-block">
                      {student.stream || 'General'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Signature & Location */}
            <div className="pt-1 flex items-end justify-between border-t border-slate-200 text-[8px] text-slate-500">
              <div>
                <div className="font-bold text-slate-700">Govt. HSS Larnoo</div>
                <div>Anantnag, J&K</div>
              </div>

              <div className="text-right">
                <div className="font-serif italic font-bold text-slate-900 text-[10px] border-b border-slate-400 px-2 pb-0.5 inline-block">
                  {settings.teacherName}
                </div>
                <div className="text-[7px] uppercase tracking-wider font-bold text-slate-400 mt-0.5">
                  Instructor Signature
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* LANDSCAPE LAYOUT */
          <div className="p-3.5 flex-1 flex items-center justify-between gap-3 bg-slate-50">
            {/* Left Photo */}
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div
                className={`w-24 h-28 rounded-xl bg-white border-2 ${themeStyle.accentBorder} shadow-md overflow-hidden flex items-center justify-center`}
              >
                {student.photoUrl ? (
                  <img
                    src={student.photoUrl}
                    alt={student.name}
                    crossOrigin="anonymous"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-10 h-10 text-slate-300" />
                )}
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[9px] font-mono font-extrabold border ${themeStyle.idBadgeBg}`}
              >
                {student.id}
              </span>
            </div>

            {/* Center Info */}
            <div className="flex-1 space-y-1 bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm text-left">
              <div>
                <div className="text-[8px] uppercase text-slate-400 font-bold">Student Name</div>
                <div className="text-sm font-extrabold text-slate-900 leading-tight">
                  {student.name}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[9px]">
                <div>
                  <span className="text-slate-400 block font-bold text-[7px] uppercase">
                    Class
                  </span>
                  <span className="font-bold text-slate-800">{student.className}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold text-[7px] uppercase">
                    Parentage
                  </span>
                  <span className="font-semibold text-slate-700 truncate block">
                    {student.parentage}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold text-[7px] uppercase">
                    Session / Gender
                  </span>
                  <span className="font-medium text-slate-700">
                    {student.academicSession || '2025-2026'} ({student.gender || 'Boy'})
                  </span>
                </div>
                {(isSeniorClass || student.stream) && (
                  <div>
                    <span className="text-slate-400 block font-bold text-[7px] uppercase">
                      Stream
                    </span>
                    <span className="font-bold text-cyan-800">{student.stream || 'General'}</span>
                  </div>
                )}
              </div>
              <div className="text-[8px] text-slate-500 pt-1 border-t border-slate-100 flex justify-between items-end">
                <span>DOB: {student.dob || 'N/A'}</span>
                <div className="text-right">
                  <div className="font-serif italic font-bold text-slate-800 text-[9px] border-b border-slate-300 px-1">
                    {settings.teacherName}
                  </div>
                  <div className="text-[6px] uppercase font-bold text-slate-400">Instructor</div>
                </div>
              </div>
            </div>

            {/* Right QR Code */}
            <div className="flex flex-col items-center justify-center bg-white p-2 rounded-xl border border-slate-200 shadow-sm shrink-0">
              <QRCodeSVG value={student.id} size={82} level="H" includeMargin={false} fgColor="#000000" bgColor="#ffffff" />
              <span className="text-[7px] font-bold text-slate-600 mt-1 uppercase font-mono">
                ATTENDANCE QR
              </span>
            </div>
          </div>
        )}

        {/* Bottom Theme Accent Line */}
        <div className={`h-1.5 w-full ${themeStyle.goldLine}`} />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Offscreen element for generating bulk ID cards */}
      {bulkRenderStudent && (
        <div style={{ position: 'fixed', top: 0, left: '-9999px', zIndex: -9999, pointerEvents: 'none' }}>
          <div ref={bulkCardRef}>{renderCardContent(bulkRenderStudent)}</div>
        </div>
      )}

      {/* Hidden file input for local photo selection */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handlePhotoUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111] border border-white/5 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Contact className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-wide">Student ID Card Generator</h1>
          </div>
          <p className="text-xs text-gray-400">
            Generate, customize, and export professional student identity cards with attendance QR codes.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2.5 relative z-10 shrink-0">
          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="flex items-center space-x-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-lg transition-all cursor-pointer"
          >
            <FolderArchive className="w-4 h-4" />
            <span>Bulk Download Cards</span>
          </button>
        </div>

        {/* Background Subtle Glow */}
        <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Success Notification Banner */}
      {downloadSuccessMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between shadow-lg animate-in fade-in duration-200">
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="font-semibold">{downloadSuccessMessage}</span>
          </div>
          <button
            onClick={() => setDownloadSuccessMessage(null)}
            className="text-emerald-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Grid View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Student Selector List */}
        <div className="lg:col-span-4 bg-[#111] border border-white/5 rounded-3xl p-5 shadow-2xl flex flex-col h-[650px]">
          <div className="space-y-3 pb-3 border-b border-white/5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-300 flex items-center gap-2">
                <User className="w-4 h-4 text-cyan-400" />
                <span>Select Student ({filteredStudents.length})</span>
              </h2>

              <button
                type="button"
                onClick={toggleSelectAllFiltered}
                className="text-[10px] font-bold text-cyan-400 hover:underline cursor-pointer"
              >
                Select All
              </button>
            </div>

            {/* Filter by Class */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {['All', 'Class 9', 'Class 10', 'Class 11', 'Class 12'].map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedClass(c)}
                  className={`px-2.5 py-1 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                    selectedClass === c
                      ? 'bg-cyan-500 text-black shadow-md'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or student ID..."
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>

          {/* Student List */}
          <div className="flex-1 overflow-y-auto space-y-2 pt-3 pr-1">
            {filteredStudents.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-xs">
                No students found matching filters.
              </div>
            ) : (
              filteredStudents.map((s) => {
                const isSelected = s.id === selectedStudentId;
                const isChecked = !!selectedForBulk[s.id];

                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedStudentId(s.id)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${
                      isSelected
                        ? 'bg-cyan-500/10 border-cyan-500/50 shadow-lg'
                        : 'bg-[#161616] border-white/5 hover:border-white/20 hover:bg-[#1a1a1a]'
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleSelectForBulk(s.id);
                        }}
                        className="w-4 h-4 rounded text-cyan-500 focus:ring-cyan-500 cursor-pointer"
                      />

                      <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                        {s.photoUrl ? (
                          <img src={s.photoUrl} alt={s.name} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-5 h-5 text-gray-400" />
                        )}
                      </div>

                      <div className="min-w-0 leading-tight">
                        <div className="text-xs font-bold text-white truncate group-hover:text-cyan-300 transition-colors">
                          {s.name}
                        </div>
                        <div className="text-[10px] text-gray-400 flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-cyan-400">{s.id}</span>
                          <span>•</span>
                          <span>{s.className}</span>
                        </div>
                      </div>
                    </div>

                    {isSelected && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Card Preview & Customization Controls */}
        <div className="lg:col-span-8 bg-[#111] border border-white/5 rounded-3xl p-6 shadow-2xl flex flex-col justify-between">
          <div>
            {/* Customization Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/5 mb-6">
              {/* Theme Picker */}
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Theme:
                </span>
                <div className="flex items-center space-x-1.5 bg-[#0a0a0a] p-1 rounded-xl border border-white/10">
                  {(['official', 'navy', 'emerald', 'burgundy', 'midnight'] as CardTheme[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setCardTheme(t)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold capitalize transition-all cursor-pointer ${
                        cardTheme === t
                          ? 'bg-cyan-500 text-black shadow'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {t === 'official' ? 'Official Larnoo' : t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Orientation Switcher */}
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Layout:
                </span>
                <div className="flex items-center space-x-1.5 bg-[#0a0a0a] p-1 rounded-xl border border-white/10">
                  {(['portrait', 'landscape'] as CardOrientation[]).map((o) => (
                    <button
                      key={o}
                      onClick={() => setCardOrientation(o)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold capitalize transition-all cursor-pointer ${
                        cardOrientation === o
                          ? 'bg-cyan-500 text-black shadow'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Selected Student Card Display */}
            {selectedStudent ? (
              <div className="space-y-6 flex flex-col items-center">
                {/* Live Card Container (Target for html2canvas & jsPDF) */}
                <div ref={cardRef}>{renderCardContent(selectedStudent)}</div>

                {/* Card Action Controls */}
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={handleDownloadSinglePdf}
                    disabled={isDownloadingSingle !== null}
                    className="flex items-center space-x-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold px-5 py-3 rounded-2xl shadow-xl transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isDownloadingSingle === 'pdf' ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileText className="w-4 h-4" />
                    )}
                    <span>Download PDF (.pdf)</span>
                  </button>

                  <button
                    onClick={handleDownloadSingleJpg}
                    disabled={isDownloadingSingle !== null}
                    className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-5 py-3 rounded-2xl shadow-xl transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isDownloadingSingle === 'jpg' ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <ImageIcon className="w-4 h-4" />
                    )}
                    <span>Download Image (.jpg)</span>
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 text-white border border-white/10 text-xs font-bold px-4 py-3 rounded-2xl transition-all cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>
                      {selectedStudent.photoUrl ? 'Change Local Photo' : 'Upload Student Photo'}
                    </span>
                  </button>

                  {selectedStudent.photoUrl && (
                    <button
                      onClick={handleRemovePhoto}
                      className="text-rose-400 hover:text-rose-300 text-xs font-semibold px-3 py-3 rounded-2xl border border-rose-500/20 hover:bg-rose-500/10 transition-all cursor-pointer"
                    >
                      Remove Photo
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-20 text-gray-500 space-y-2">
                <User className="w-12 h-12 mx-auto stroke-1" />
                <p className="text-sm">Select a student from the sidebar list to view ID card.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bulk Download Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#111111] border border-cyan-500/30 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0">
                  <FolderArchive className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Bulk Download ID Cards</h3>
                  <p className="text-xs text-gray-400">
                    Export high-resolution ID cards in PDF or Image format.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBulkModalOpen(false)}
                disabled={isProcessingBulk}
                className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isProcessingBulk ? (
              <div className="py-8 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto">
                  <RefreshCw className="w-7 h-7 text-cyan-400 animate-spin" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">Generating High-Res ID Cards...</h4>
                  <p className="text-xs text-gray-400">
                    Processing card {bulkProgress.current} of {bulkProgress.total}
                  </p>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-cyan-500 to-emerald-500 h-full transition-all duration-200"
                    style={{
                      width: `${(bulkProgress.current / Math.max(bulkProgress.total, 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Scope selection */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-300">Select Scope:</label>

                  <div className="space-y-2">
                    <label className="flex items-center justify-between p-3 rounded-2xl bg-[#181818] border border-white/10 cursor-pointer hover:border-cyan-500/50">
                      <div className="flex items-center gap-2.5 text-xs font-medium text-white">
                        <input
                          type="radio"
                          name="bulkScope"
                          checked={bulkScope === 'all'}
                          onChange={() => setBulkScope('all')}
                          className="text-cyan-500 focus:ring-cyan-500 cursor-pointer"
                        />
                        <span>All Enrolled Students</span>
                      </div>
                      <span className="text-xs font-bold text-cyan-400">
                        {students.length} Cards
                      </span>
                    </label>

                    <label className="flex items-center justify-between p-3 rounded-2xl bg-[#181818] border border-white/10 cursor-pointer hover:border-cyan-500/50">
                      <div className="flex items-center gap-2.5 text-xs font-medium text-white">
                        <input
                          type="radio"
                          name="bulkScope"
                          checked={bulkScope === 'class'}
                          onChange={() => setBulkScope('class')}
                          className="text-cyan-500 focus:ring-cyan-500 cursor-pointer"
                        />
                        <span>By Class</span>
                      </div>
                      <select
                        value={bulkClass}
                        onChange={(e) => {
                          setBulkScope('class');
                          setBulkClass(e.target.value);
                        }}
                        className="bg-black border border-white/20 text-xs text-white rounded-xl px-2.5 py-1 focus:outline-none"
                      >
                        {['All', 'Class 9', 'Class 10', 'Class 11', 'Class 12'].map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex items-center justify-between p-3 rounded-2xl bg-[#181818] border border-white/10 cursor-pointer hover:border-cyan-500/50">
                      <div className="flex items-center gap-2.5 text-xs font-medium text-white">
                        <input
                          type="radio"
                          name="bulkScope"
                          checked={bulkScope === 'selected'}
                          onChange={() => setBulkScope('selected')}
                          className="text-cyan-500 focus:ring-cyan-500 cursor-pointer"
                        />
                        <span>Custom Selected Students</span>
                      </div>
                      <span className="text-xs font-bold text-emerald-400">
                        {Object.values(selectedForBulk).filter(Boolean).length} Selected
                      </span>
                    </label>
                  </div>
                </div>

                {/* Export Format selection */}
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <label className="text-xs font-bold text-gray-300">Export Format:</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setBulkFormat('zip_jpg')}
                      className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                        bulkFormat === 'zip_jpg'
                          ? 'bg-cyan-500/10 border-cyan-500 text-white'
                          : 'bg-[#181818] border-white/10 text-gray-400 hover:text-white'
                      }`}
                    >
                      <ImageIcon className="w-4 h-4 mb-1 text-emerald-400" />
                      <div className="text-[11px] font-bold leading-tight">ZIP of JPGs</div>
                      <div className="text-[9px] text-gray-400">Images in ZIP</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBulkFormat('zip_pdf')}
                      className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                        bulkFormat === 'zip_pdf'
                          ? 'bg-cyan-500/10 border-cyan-500 text-white'
                          : 'bg-[#181818] border-white/10 text-gray-400 hover:text-white'
                      }`}
                    >
                      <FileType className="w-4 h-4 mb-1 text-rose-400" />
                      <div className="text-[11px] font-bold leading-tight">ZIP of PDFs</div>
                      <div className="text-[9px] text-gray-400">CR80 PDFs in ZIP</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBulkFormat('single_pdf')}
                      className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                        bulkFormat === 'single_pdf'
                          ? 'bg-cyan-500/10 border-cyan-500 text-white'
                          : 'bg-[#181818] border-white/10 text-gray-400 hover:text-white'
                      }`}
                    >
                      <FileText className="w-4 h-4 mb-1 text-cyan-400" />
                      <div className="text-[11px] font-bold leading-tight">Master PDF</div>
                      <div className="text-[9px] text-gray-400">All in 1 Document</div>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
                  <button
                    onClick={() => setIsBulkModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStartBulkDownload}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold transition-all shadow-lg flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Package</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
