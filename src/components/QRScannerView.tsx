import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  QrCode,
  Camera,
  CameraOff,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Keyboard,
  Sparkles,
  Volume2,
  VolumeX,
  Search,
  Zap,
  ZapOff,
  SwitchCamera,
  Pause,
  Play,
  RotateCw,
  Clock,
  UserCheck,
  ShieldCheck,
  XCircle,
  Power,
  VideoOff,
} from 'lucide-react';
import { Student, AttendanceRecord } from '../types';
import { playWarningSound, triggerVibration } from '../services/sound';

interface QRScannerViewProps {
  students: Student[];
  onMarkAttendance: (
    studentId: string,
    status?: 'Present' | 'Absent' | 'Late' | 'Leave'
  ) => { success: boolean; record?: AttendanceRecord; message: string; isDuplicate?: boolean };
  onSelectTab: (tab: string) => void;
}

interface CameraDevice {
  id: string;
  label: string;
}

interface RecentScan {
  id: string;
  studentName: string;
  studentId: string;
  className: string;
  status: string;
  time: string;
  isDuplicate?: boolean;
}

// Global helper to immediately force-stop all camera MediaStreamTracks in the browser DOM
const forceStopAllCameraTracks = () => {
  try {
    const videoElements = document.querySelectorAll('video');
    videoElements.forEach((video) => {
      video.onabort = null;
      video.onerror = null;
      try {
        video.pause();
      } catch (_) {}
      if (video.srcObject && video.srcObject instanceof MediaStream) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach((track) => {
          try {
            track.onended = null;
            track.stop();
          } catch (e) {
            console.warn('Error stopping camera track:', e);
          }
        });
        video.srcObject = null;
      }
    });

    const viewport = document.getElementById('qr-reader-viewport');
    if (viewport) {
      viewport.innerHTML = '';
    }
  } catch (err) {
    console.warn('Error in forceStopAllCameraTracks:', err);
  }
};

export const QRScannerView: React.FC<QRScannerViewProps> = ({
  students,
  onMarkAttendance,
  onSelectTab,
}) => {
  const [activeTabMode, setActiveTabMode] = useState<'camera' | 'upload' | 'manual'>('camera');
  const [manualId, setManualId] = useState('');
  
  // Camera state
  const [cameraDevices, setCameraDevices] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(true); // User toggle to power on/off camera
  const [isScanning, setIsScanning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Scan feedback & recent scans history
  const [scanResult, setScanResult] = useState<{
    type: 'success' | 'warning' | 'error';
    title: string;
    message: string;
    student?: Student;
    record?: AttendanceRecord;
    timestamp: number;
  } | null>(null);

  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);

  // Refs
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const lastScannedIdRef = useRef<string | null>(null);
  const lastScannedTimeRef = useRef<number>(0);
  const isStoppingRef = useRef<boolean>(false);

  const studentsRef = useRef(students);
  studentsRef.current = students;
  const onMarkAttendanceRef = useRef(onMarkAttendance);
  onMarkAttendanceRef.current = onMarkAttendance;
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  // Safely stop and clear existing scanner instance and kill media tracks
  const stopScanner = useCallback(async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    if (html5QrcodeRef.current) {
      const instance = html5QrcodeRef.current;
      html5QrcodeRef.current = null;
      try {
        if (instance.isScanning) {
          await instance.stop();
        }
        instance.clear();
      } catch (err) {
        console.warn('Error clearing scanner instance:', err);
      }
    }

    // Immediately stop hardware media tracks so LED turns off
    forceStopAllCameraTracks();

    setIsScanning(false);
    setIsTorchOn(false);
    isStoppingRef.current = false;
  }, []);

  // Handle scanned QR text with debouncing
  const handleQRScanned = useCallback(
    (scannedText: string) => {
      const cleanedId = scannedText.trim().toUpperCase();
      const now = Date.now();

      // Debounce identical scans within 3 seconds to avoid spamming
      if (
        lastScannedIdRef.current === cleanedId &&
        now - lastScannedTimeRef.current < 3000
      ) {
        return;
      }

      lastScannedIdRef.current = cleanedId;
      lastScannedTimeRef.current = now;

      const currentStudents = studentsRef.current;
      const currentOnMarkAttendance = onMarkAttendanceRef.current;
      const currentSoundEnabled = soundEnabledRef.current;

      // Find matching student
      const student = currentStudents.find((s) => s.id.toUpperCase() === cleanedId);
      const res = currentOnMarkAttendance(cleanedId, 'Present');
      const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      if (res.success) {
        setScanResult({
          type: 'success',
          title: 'Attendance Marked!',
          message: res.message,
          student,
          record: res.record,
          timestamp: now,
        });

        if (student) {
          setRecentScans((prev) => [
            {
              id: `${student.id}-${now}`,
              studentName: student.name,
              studentId: student.id,
              className: student.className,
              status: 'Present',
              time: timeStr,
            },
            ...prev.slice(0, 4),
          ]);
        }
      } else if (res.isDuplicate) {
        if (currentSoundEnabled) playWarningSound();
        triggerVibration(150);

        setScanResult({
          type: 'warning',
          title: 'Already Marked Today',
          message: res.message,
          student,
          timestamp: now,
        });

        if (student) {
          setRecentScans((prev) => [
            {
              id: `${student.id}-${now}`,
              studentName: student.name,
              studentId: student.id,
              className: student.className,
              status: 'Already Marked',
              time: timeStr,
              isDuplicate: true,
            },
            ...prev.slice(0, 4),
          ]);
        }
      } else {
        if (currentSoundEnabled) playWarningSound();
        setScanResult({
          type: 'error',
          title: 'Student Not Found',
          message: res.message || `No record registered for ID: ${cleanedId}`,
          timestamp: now,
        });
      }
    },
    []
  );

  // Start Camera Scanner
  const startScanner = useCallback(
    async (targetCameraIdOrFacing?: string) => {
      await stopScanner();

      const viewportId = 'qr-reader-viewport';
      const viewport = document.getElementById(viewportId);
      if (!viewport) return;
      viewport.innerHTML = '';

      try {
        const html5Qrcode = new Html5Qrcode(viewportId);
        html5QrcodeRef.current = html5Qrcode;

        const config = {
          fps: 15,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minDim = Math.min(viewfinderWidth, viewfinderHeight);
            return {
              width: Math.min(Math.floor(minDim * 0.72), 270),
              height: Math.min(Math.floor(minDim * 0.72), 270),
            };
          },
          aspectRatio: 1.0,
        };

        const cameraChoice =
          targetCameraIdOrFacing || selectedCameraId || { facingMode };

        await html5Qrcode.start(
          cameraChoice,
          config,
          (decodedText) => {
            handleQRScanned(decodedText);
          },
          () => {
            // Per-frame decode failure is normal when no QR is present
          }
        );

        setIsScanning(true);
        setIsPaused(false);
        setCameraError(null);

        // Attach safe error/abort handlers to video elements inside the viewport
        const videoElements = viewport.querySelectorAll('video');
        videoElements.forEach((v) => {
          v.onabort = (e: any) => {
            if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
          };
          v.onerror = (e: any) => {
            if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
          };
        });

        // Check torch support
        try {
          const capabilities = html5Qrcode.getRunningTrackCapabilities() as any;
          setHasTorch(!!capabilities?.torch);
        } catch {
          setHasTorch(false);
        }
      } catch (err: any) {
        console.error('Camera QR start error:', err);
        setIsScanning(false);
        let errMsg = 'Failed to access camera.';
        if (
          err?.name === 'NotAllowedError' ||
          String(err).includes('Permission')
        ) {
          errMsg =
            'Camera permission was denied. Please allow camera permissions in your browser address bar.';
        } else if (
          err?.name === 'NotFoundError' ||
          String(err).includes('NotFound')
        ) {
          errMsg = 'No active camera hardware found on this device.';
        } else if (
          err?.name === 'NotReadableError' ||
          String(err).includes('in use')
        ) {
          errMsg =
            'Camera is currently locked or in use by another application/tab.';
        } else if (typeof err === 'string') {
          errMsg = err;
        } else if (err?.message) {
          errMsg = err.message;
        }
        setCameraError(errMsg);
      }
    },
    [stopScanner, selectedCameraId, facingMode, handleQRScanned]
  );

  // Fetch Available Cameras & suppress benign camera surface abort errors on Mount
  useEffect(() => {
    const handleCameraAbortError = (event: ErrorEvent) => {
      const msg = String(event?.message || event?.error || '');
      if (
        msg.includes('onabort') ||
        msg.includes('RenderedCameraImpl') ||
        msg.includes('video surface')
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    const handleCameraAbortRejection = (event: PromiseRejectionEvent) => {
      const reason = String(event?.reason || '');
      if (
        reason.includes('onabort') ||
        reason.includes('RenderedCameraImpl') ||
        reason.includes('video surface')
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    window.addEventListener('error', handleCameraAbortError);
    window.addEventListener('unhandledrejection', handleCameraAbortRejection);

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          const formatted = devices.map((d, index) => ({
            id: d.id,
            label: d.label || `Camera ${index + 1}`,
          }));
          setCameraDevices(formatted);
          // Prefer back/environment camera
          const backCam = formatted.find(
            (c) =>
              c.label.toLowerCase().includes('back') ||
              c.label.toLowerCase().includes('rear') ||
              c.label.toLowerCase().includes('environment')
          );
          if (backCam) {
            setSelectedCameraId(backCam.id);
          } else {
            setSelectedCameraId(formatted[0].id);
          }
        }
      })
      .catch((err) => {
        console.warn('Could not enumerate cameras:', err);
      });

    return () => {
      window.removeEventListener('error', handleCameraAbortError);
      window.removeEventListener('unhandledrejection', handleCameraAbortRejection);
    };
  }, []);

  // Handle activeTabMode switching and camera power toggle
  useEffect(() => {
    if (activeTabMode === 'camera' && isCameraActive) {
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      // Immediate cleanup when switching tabs or unmounting component
      if (html5QrcodeRef.current) {
        try {
          if (html5QrcodeRef.current.isScanning) {
            html5QrcodeRef.current.stop().catch(() => {}).finally(() => {
              forceStopAllCameraTracks();
            });
          }
          html5QrcodeRef.current.clear();
        } catch (e) {}
        html5QrcodeRef.current = null;
      }
      forceStopAllCameraTracks();
    };
  }, [activeTabMode, isCameraActive, startScanner, stopScanner]);

  // Toggle Camera Active state (Power On/Off button)
  const toggleCameraActive = () => {
    if (isCameraActive) {
      setIsCameraActive(false);
      stopScanner();
    } else {
      setIsCameraActive(true);
      setCameraError(null);
      startScanner();
    }
  };

  // Toggle Torch
  const toggleTorch = async () => {
    if (!html5QrcodeRef.current || !hasTorch) return;
    try {
      const nextState = !isTorchOn;
      await html5QrcodeRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState } as any],
      });
      setIsTorchOn(nextState);
    } catch (err) {
      console.warn('Failed to toggle torch:', err);
    }
  };

  // Switch Facing Mode / Device
  const handleSwitchCamera = async () => {
    if (cameraDevices.length > 1) {
      const currentIndex = cameraDevices.findIndex((c) => c.id === selectedCameraId);
      const nextIndex = (currentIndex + 1) % cameraDevices.length;
      const nextCam = cameraDevices[nextIndex];
      setSelectedCameraId(nextCam.id);
      await startScanner(nextCam.id);
    } else {
      const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
      setFacingMode(nextFacing);
      await startScanner(nextFacing);
    }
  };

  // Pause or Resume Scanning
  const togglePauseScan = () => {
    if (!html5QrcodeRef.current) return;
    try {
      if (isPaused) {
        html5QrcodeRef.current.resume();
        setIsPaused(false);
      } else {
        html5QrcodeRef.current.pause(true);
        setIsPaused(true);
      }
    } catch (err) {
      console.warn('Pause/Resume toggle failed:', err);
    }
  };

  // Handle File Upload QR Scanner
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const html5Qrcode = new Html5Qrcode('qr-reader-file-viewport');
    html5Qrcode
      .scanFile(file, true)
      .then((decodedText) => {
        handleQRScanned(decodedText);
      })
      .catch(() => {
        setScanResult({
          type: 'error',
          title: 'Invalid QR Image',
          message: 'Could not read a valid student QR code from the uploaded image file.',
          timestamp: Date.now(),
        });
      });
  };

  // Handle Manual Form Submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualId.trim()) return;
    handleQRScanned(manualId);
    setManualId('');
  };

  return (
    <div className="space-y-6">
      {/* Inline styles for custom scan line keyframes */}
      <style>{`
        @keyframes laser-scan {
          0% { top: 12%; opacity: 0.3; }
          50% { opacity: 1; }
          100% { top: 86%; opacity: 0.3; }
        }
        .animate-laser {
          animation: laser-scan 2.2s ease-in-out infinite alternate;
        }
      `}</style>

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111] border border-white/5 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden">
        <div>
          <div className="flex items-center space-x-2 text-[10px] font-bold uppercase tracking-widest text-cyan-400 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>High-Speed Attendance Scanner</span>
          </div>
          <h1 className="text-2xl font-serif italic text-white tracking-tight flex items-center gap-2">
            <QrCode className="w-6 h-6 text-cyan-400" />
            Scanner Interface
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Point student QR badges at camera lens for instant verification & Google Sheets sync.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 bg-[#0a0a0a] p-1.5 rounded-2xl border border-white/5">
          <button
            type="button"
            onClick={() => setActiveTabMode('camera')}
            className={`px-3.5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-all ${
              activeTabMode === 'camera'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950/50'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Live Camera</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTabMode('upload')}
            className={`px-3.5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-all ${
              activeTabMode === 'upload'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950/50'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Image</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTabMode('manual')}
            className={`px-3.5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-all ${
              activeTabMode === 'manual'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950/50'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>Manual ID</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scanner View Area */}
        <div className="lg:col-span-2 bg-[#111] border border-white/5 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center">
          {activeTabMode === 'camera' && (
            <div className="w-full max-w-lg space-y-4">
              {/* Controls Bar Above Viewfinder */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-[#080808] border border-white/10 px-4 py-2.5 rounded-2xl text-xs">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span
                      className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        isScanning && !isPaused && isCameraActive ? 'bg-emerald-400' : 'bg-rose-400'
                      }`}
                    />
                    <span
                      className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                        isScanning && !isPaused && isCameraActive ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                    />
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300">
                    {!isCameraActive
                      ? 'Camera Powered Off'
                      : isPaused
                      ? 'Scanner Paused'
                      : isScanning
                      ? 'Camera Live'
                      : 'Initializing Lens...'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Power On/Off Camera Button */}
                  <button
                    type="button"
                    onClick={toggleCameraActive}
                    className={`px-3 py-1.5 rounded-xl font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md ${
                      isCameraActive
                        ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50'
                    }`}
                  >
                    {isCameraActive ? (
                      <>
                        <VideoOff className="w-3.5 h-3.5" />
                        <span>Stop Camera</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-3.5 h-3.5" />
                        <span>Start Camera</span>
                      </>
                    )}
                  </button>

                  {isCameraActive && (
                    <>
                      {/* Camera Flip / Select */}
                      <button
                        type="button"
                        onClick={handleSwitchCamera}
                        title="Switch Camera Device / Facing Mode"
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all"
                      >
                        <SwitchCamera className="w-4 h-4" />
                      </button>

                      {/* Torch Toggle */}
                      {hasTorch && (
                        <button
                          type="button"
                          onClick={toggleTorch}
                          title={isTorchOn ? 'Turn Flash Off' : 'Turn Flash On'}
                          className={`p-2 rounded-xl transition-all ${
                            isTorchOn
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-white/5 hover:bg-white/10 text-gray-300'
                          }`}
                        >
                          {isTorchOn ? <ZapOff className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                        </button>
                      )}

                      {/* Sound Toggle */}
                      <button
                        type="button"
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        title={soundEnabled ? 'Mute Beep Sound' : 'Enable Beep Sound'}
                        className={`p-2 rounded-xl transition-all ${
                          soundEnabled
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            : 'bg-white/5 hover:bg-white/10 text-gray-400'
                        }`}
                      >
                        {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                      </button>

                      {/* Pause / Play */}
                      {isScanning && (
                        <button
                          type="button"
                          onClick={togglePauseScan}
                          title={isPaused ? 'Resume Scanning' : 'Pause Camera'}
                          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all"
                        >
                          {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                        </button>
                      )}

                      {/* Reload Lens */}
                      <button
                        type="button"
                        onClick={() => startScanner()}
                        title="Restart Camera Stream"
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all"
                      >
                        <RotateCw className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Camera Error View */}
              {cameraError && isCameraActive && (
                <div className="p-5 bg-rose-500/10 border border-rose-500/30 rounded-3xl text-center space-y-3 text-rose-200">
                  <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
                  <div>
                    <h4 className="font-bold text-sm">Camera Hardware Error</h4>
                    <p className="text-xs text-rose-300/80 mt-1">{cameraError}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => startScanner()}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all"
                    >
                      Retry Camera
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTabMode('manual')}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all"
                    >
                      Use Manual ID Entry
                    </button>
                  </div>
                </div>
              )}

              {/* Camera Frame & Viewfinder */}
              <div className="relative overflow-hidden rounded-3xl border-2 border-cyan-500/30 bg-[#050505] shadow-2xl aspect-square flex items-center justify-center">
                {/* HTML5 QR Code DOM Viewport Container */}
                <div
                  id="qr-reader-viewport"
                  className="w-full h-full object-cover [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
                />

                {/* Powered Off Overlay */}
                {!isCameraActive && (
                  <div className="absolute inset-0 bg-[#0a0a0a]/95 backdrop-blur-md z-20 flex flex-col items-center justify-center p-6 text-center space-y-4">
                    <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-3xl flex items-center justify-center text-rose-400 shadow-lg">
                      <CameraOff className="w-8 h-8 text-rose-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-serif italic text-lg">Camera Access Stopped</h3>
                      <p className="text-xs text-gray-400 mt-1 max-w-xs">
                        The camera hardware feed and indicator light are completely powered off.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={toggleCameraActive}
                      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-xs uppercase tracking-widest shadow-xl shadow-emerald-950/50 flex items-center gap-2 transition-all"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Start Camera Access</span>
                    </button>
                  </div>
                )}

                {/* Custom Modern Cyber Overlay Frame */}
                {isScanning && isCameraActive && !cameraError && (
                  <div className="absolute inset-0 pointer-events-none p-8 flex flex-col justify-between">
                    {/* Top Corner Brackets */}
                    <div className="flex justify-between">
                      <div className="w-8 h-8 border-t-4 border-l-4 border-cyan-400 rounded-tl-xl shadow-[0_0_10px_#22d3ee]" />
                      <div className="w-8 h-8 border-t-4 border-r-4 border-cyan-400 rounded-tr-xl shadow-[0_0_10px_#22d3ee]" />
                    </div>

                    {/* Animated Laser Scanning Line */}
                    {!isPaused && (
                      <div className="absolute left-10 right-10 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee] animate-laser" />
                    )}

                    {/* Bottom Corner Brackets */}
                    <div className="flex justify-between">
                      <div className="w-8 h-8 border-b-4 border-l-4 border-cyan-400 rounded-bl-xl shadow-[0_0_10px_#22d3ee]" />
                      <div className="w-8 h-8 border-b-4 border-r-4 border-cyan-400 rounded-br-xl shadow-[0_0_10px_#22d3ee]" />
                    </div>
                  </div>
                )}
              </div>

              {/* Camera Selection Dropdown if Multiple Devices Available */}
              {cameraDevices.length > 1 && (
                <div className="flex items-center justify-between bg-[#080808] border border-white/5 px-4 py-2 rounded-2xl text-xs">
                  <span className="text-[10px] uppercase font-bold text-gray-400">Select Camera:</span>
                  <select
                    value={selectedCameraId}
                    onChange={(e) => {
                      setSelectedCameraId(e.target.value);
                      startScanner(e.target.value);
                    }}
                    className="bg-[#111] text-cyan-300 border border-white/10 rounded-xl px-3 py-1 text-xs focus:outline-none focus:border-cyan-500"
                  >
                    {cameraDevices.map((dev) => (
                      <option key={dev.id} value={dev.id}>
                        {dev.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {activeTabMode === 'upload' && (
            <div className="w-full max-w-md text-center py-8">
              <div className="w-16 h-16 bg-cyan-600/10 text-cyan-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-cyan-500/20">
                <Upload className="w-8 h-8" />
              </div>
              <h3 className="font-serif italic text-white text-lg mb-1">Upload Student QR Badge</h3>
              <p className="text-xs text-gray-400 mb-6">Select PNG or JPG photo containing a valid student QR code</p>

              <label className="inline-flex items-center space-x-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-6 py-3 rounded-2xl cursor-pointer text-xs uppercase tracking-widest shadow-lg shadow-cyan-950/40 transition-all">
                <Upload className="w-4 h-4" />
                <span>Browse Photo File</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <div id="qr-reader-file-viewport" className="hidden" />
            </div>
          )}

          {activeTabMode === 'manual' && (
            <div className="w-full max-w-md py-6">
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div className="text-center mb-4">
                  <h3 className="font-serif italic text-white text-lg">Instant Student ID Entry</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Enter Student ID to mark attendance instantly</p>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-1">
                    Student ID
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={manualId}
                      onChange={(e) => setManualId(e.target.value)}
                      placeholder="e.g. IT901 or IT1001"
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-2xl text-xs uppercase tracking-widest shadow-lg shadow-cyan-950/40 transition-all"
                >
                  Mark Present Instantly
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Live Feedback & Recent Scans Side Panel */}
        <div className="bg-[#111] border border-white/5 rounded-3xl p-6 shadow-2xl flex flex-col justify-between gap-6">
          <div className="space-y-6">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                Latest Scan Result
              </p>

              {scanResult ? (
                <div
                  className={`p-5 rounded-2xl border text-center transition-all ${
                    scanResult.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                      : scanResult.type === 'warning'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                  }`}
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 shadow-md">
                    {scanResult.type === 'success' && <CheckCircle2 className="w-8 h-8 text-emerald-400" />}
                    {scanResult.type === 'warning' && <AlertTriangle className="w-8 h-8 text-amber-400" />}
                    {scanResult.type === 'error' && <XCircle className="w-8 h-8 text-rose-400" />}
                  </div>

                  <h3 className="font-serif italic text-lg mb-1">{scanResult.title}</h3>
                  <p className="text-xs opacity-90 mb-3">{scanResult.message}</p>

                  {scanResult.student && (
                    <div className="bg-[#0a0a0a] rounded-2xl p-4 text-left border border-white/5 space-y-1 text-gray-300 text-xs">
                      <p className="font-bold text-sm text-cyan-400">{scanResult.student.name}</p>
                      <p className="font-mono text-gray-400">ID: {scanResult.student.id}</p>
                      <p className="text-gray-400">Parentage: {scanResult.student.parentage}</p>
                      <p className="font-bold text-emerald-400">{scanResult.student.className}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center text-gray-500 text-xs bg-[#080808] border border-white/5 rounded-2xl p-4">
                  <QrCode className="w-10 h-10 text-gray-600 mx-auto mb-2 animate-pulse" />
                  <p className="font-bold text-gray-300">Ready to Scan</p>
                  <p className="mt-1 text-[11px] text-gray-500">Hold QR code inside camera viewfinder</p>
                </div>
              )}
            </div>

            {/* Live Session Recent Scans */}
            {recentScans.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    Recent Scans Feed
                  </p>
                  <span className="text-[10px] text-gray-500 font-mono">{recentScans.length} logged</span>
                </div>

                <div className="space-y-2">
                  {recentScans.map((scan) => (
                    <div
                      key={scan.id}
                      className="bg-[#080808] border border-white/5 rounded-2xl p-3 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center space-x-2.5">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            scan.isDuplicate ? 'bg-amber-400' : 'bg-emerald-400'
                          }`}
                        />
                        <div>
                          <p className="font-bold text-white text-xs">{scan.studentName}</p>
                          <p className="text-[10px] text-gray-400 font-mono">
                            {scan.studentId} • {scan.className}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            scan.isDuplicate
                              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                          }`}
                        >
                          {scan.status}
                        </span>
                        <p className="text-[9px] text-gray-500 mt-0.5">{scan.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-white/5 text-center">
            <button
              type="button"
              onClick={() => onSelectTab('manual')}
              className="text-[10px] uppercase tracking-widest font-bold text-cyan-400 hover:underline flex items-center justify-center gap-1.5 mx-auto"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Switch to Batch Class Attendance Register</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
