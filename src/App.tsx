import { useState, useEffect, useRef, useMemo, Fragment } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import Papa from 'papaparse';
import { QRCodeSVG } from 'qrcode.react';
import { toJpeg } from 'html-to-image';
import JSZip from 'jszip'; 
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Html5Qrcode } from 'html5-qrcode'; 
import toast, { Toaster, ToastBar } from 'react-hot-toast';
import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// 🚀 NEW: Import all professional icons
import { 
  GraduationCap, Video, Users, History as HistoryIcon, BarChart3, ArrowLeft, Info, 
  Volume2, VolumeX, QrCode, Save, Settings, Play, Pause, Minimize, Maximize, 
  OctagonX, Smartphone, Laptop, Radio, Keyboard, Trash2, Archive, Search, 
  Upload, Inbox, RefreshCw, Clock, Database, CloudUpload, FolderOpen, 
  PieChart as PieChartIcon, IdCard, CheckCircle, X, MessageCircle, ShieldAlert, Shield,
  Unlock, Rocket, Activity, Package, Hourglass, Undo2, UserPlus, Dices, ListChecks, Calendar, Flag, FileText, FileSpreadsheet, Plus
} from 'lucide-react';

const TitleBar = () => (
  <div data-tauri-drag-region className="h-[36px] w-full bg-[#0a0f1c]/90 flex items-center justify-between pl-4 pr-1.5 border-b border-white/5 select-none shrink-0 z-[100] backdrop-blur-md">
    <div data-tauri-drag-region className="flex items-center gap-3 pointer-events-none w-full h-full">
      <img src="/attendo-icon.png" className="w-5 h-5 drop-shadow-md" alt="Attendo Icon" />
      <span className="text-xs font-black tracking-[0.25em] text-gray-300 pt-0.5">ATTENDO</span>
    </div>
    <div className="flex items-center gap-1 shrink-0 z-[200]">
      <button onClick={() => getCurrentWindow().minimize()} className="w-10 h-7 flex items-center justify-center hover:bg-white/10 rounded-md transition-colors group">
        <Minimize className="w-3 h-3 text-gray-300 group-hover:text-white" />
      </button>
      <button onClick={() => getCurrentWindow().toggleMaximize()} className="w-10 h-7 flex items-center justify-center hover:bg-white/10 rounded-md transition-colors group">
        <Maximize className="w-3 h-3 text-gray-300 group-hover:text-white" />
      </button>
      <button onClick={() => getCurrentWindow().close()} className="w-10 h-7 flex items-center justify-center hover:bg-rose-500 rounded-md transition-colors group">
        <X className="w-4 h-4 text-gray-300 group-hover:text-white" />
      </button>
    </div>
  </div>
);

function App() {
  const [licenseStatus, setLicenseStatus] = useState<'checking' | 'valid' | 'unlicensed' | 'expired' | 'tampered' | 'invalid' | 'REVOKED' | 'SYNC_REQUIRED'>('checking');
  const [licenseWarning, setLicenseWarning] = useState<{show: boolean, daysLeft: number}>({show: false, daysLeft: 0});
  const [licenseDetails, setLicenseDetails] = useState<{plan: string, duration: string | number, exp: number}>({plan: 'plus', duration: 'Academic Year (12 Months)', exp: 0});
  const [showWelcome, setShowWelcome] = useState(false);
  const [hardwareId, setHardwareId] = useState('');
  const [licenseInput, setLicenseInput] = useState('');
  const [licenseError, setLicenseError] = useState('');

  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);
  const [globalSettings, setGlobalSettings] = useState<any>({});
  
  const [activeWorkspace, setActiveWorkspace] = useState<string | null>(null);

  const [setupInstructor, setSetupInstructor] = useState('');
  const [setupSubjects, setSetupSubjects] = useState<Record<string, string>>({});
  const [setupSemester, setSetupSemester] = useState('First Semester');
  // 🚀 NEW: Tracks max number of groups to generate
  const [setupTotalGroups, setSetupTotalGroups] = useState<number>(5);
  const [setupStartDate, setSetupStartDate] = useState('');
  const [setupEndDate, setSetupEndDate] = useState('');
  const [setupGrades, setSetupGrades] = useState<string[]>([]);
  const [isSavingSetup, setIsSavingSetup] = useState(false);
  const [setupUniversity, setSetupUniversity] = useState('');
  const [setupFaculty, setSetupFaculty] = useState('');

  const [activeTab, setActiveTab] = useState<'scanner' | 'roster' | 'history' | 'analytics' | 'vault'>('scanner');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [isSessionActive, setIsSessionActive] = useState(false);
  const isSessionActiveRef = useRef(false); 
  const [isMuted, setIsMuted] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  const [isColdCallActive, setIsColdCallActive] = useState(false);

  const [sessionType, setSessionType] = useState<'Lecture' | 'Section'>('Lecture');
  const [weekNumber, setWeekNumber] = useState<number>(1);
  // 🚀 NEW: Tracks which group is currently being taught (Multi-Select)
  const [sessionGroups, setSessionGroups] = useState<string[]>(['All Groups']);
  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false);
  const [isScannerTypeDropdownOpen, setIsScannerTypeDropdownOpen] = useState(false);
  const [isAnalyticsTypeDropdownOpen, setIsAnalyticsTypeDropdownOpen] = useState(false);
  const [historyTypeFilter, setHistoryTypeFilter] = useState<'All' | 'Lecture' | 'Section'>('All');
  const [isHistoryTypeDropdownOpen, setIsHistoryTypeDropdownOpen] = useState(false);
  const sessionTopicRef = useRef(''); 

  const getSubjectName = (specificWorkspace?: string) => {
    try {
      const parsed = JSON.parse(globalSettings.subject_name || '{}');
      const ws = specificWorkspace || activeWorkspace || '';
      return parsed[ws] || globalSettings.subject_name || 'Subject';
    } catch(e) {
      return globalSettings.subject_name || 'Subject';
    }
  };

  const [scannerMode, setScannerMode] = useState<'mobile' | 'webcam'>('mobile');
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [manualId, setManualId] = useState('');
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  const [stats, setStats] = useState({ totalStudents: '--', activeSession: 'Connecting...' });
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [printData, setPrintData] = useState<any[]>([]); 
  const [scannerUrl, setScannerUrl] = useState<string | null>(null);
  const [scannedStudents, setScannedStudents] = useState<any[]>([]);
  
  const [rosterData, setRosterData] = useState<any[]>([]); 
  const [deletedRosterData, setDeletedRosterData] = useState<any[]>([]); 
  const [showDeleted, setShowDeleted] = useState(false); 
  // 🚀 NEW: State to toggle view between active and archived sessions
  const [showArchivedSessions, setShowArchivedSessions] = useState(false);
  // 🚀 FIXED: Batch Selection State for History Tab
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [analyticsData, setAnalyticsData] = useState<any[]>([]);
  const [pastSessions, setPastSessions] = useState<any[]>([]);
  
  // 🚀 NEW: Audit Ledger States
  const [auditingSession, setAuditingSession] = useState<any>(null);
  const [sessionDetails, setSessionDetails] = useState<any[]>([]);
  const [excuseMenuOpenFor, setExcuseMenuOpenFor] = useState<string | null>(null);

  // 🚀 NEW: Conflict Resolver States
  const [mergeConflicts, setMergeConflicts] = useState<any[]>([]);
  const [pendingImportPath, setPendingImportPath] = useState<string | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, 'local' | 'external'>>({});
  
  const [reportFilter, setReportFilter] = useState<'All' | 'Lecture' | 'Section'>('All');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const lastSelectedIndexRef = useRef<number | null>(null);
  const [studentProfile, setStudentProfile] = useState<any>(null);
  const [studentAttendanceRecord, setStudentAttendanceRecord] = useState<any[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [threshold, setThreshold] = useState(3);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');

  // 🚀 NEW: Rapid Paper-to-Digital Entry States
  const [isRapidEntryOpen, setIsRapidEntryOpen] = useState(false);
  const [rapidSearchQuery, setRapidSearchQuery] = useState('');
  const [rapidSelectedIds, setRapidSelectedIds] = useState<string[]>([]);

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [commandSearchQuery, setCommandSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // 🚀 NEW: Ref for the Rapid Entry Search Bar
  const rapidSearchRef = useRef<HTMLInputElement>(null);

  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isManagingWorkspaces, setIsManagingWorkspaces] = useState(false);
  const [manageWorkspaces, setManageWorkspaces] = useState<{id: string, subject: string}[]>([]);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentId, setNewStudentId] = useState('');
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  // 🚀 NEW: Right-Click Context Menu State
  const [contextMenu, setContextMenu] = useState<{ visible: boolean, x: number, y: number, student: any | null }>({ visible: false, x: 0, y: 0, student: null });
  const [modalTimelineTab, setModalTimelineTab] = useState<'attended' | 'absent'>('attended');

  // 🚀 STEP 6: Hold-to-Peek State
  const [showShortcuts, setShowShortcuts] = useState(false);

  const rosterMapRef = useRef<Record<string, any>>({});
  const nationalIdMapRef = useRef<Record<string, any>>({}); 
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 🚀 NEW: Close context menu on global click
  useEffect(() => {
    const closeMenu = () => setContextMenu(prev => ({ ...prev, visible: false }));
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  // 🚀 FIXED: Shortcut Overlay now strictly listens for holding Ctrl + Alt
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.altKey) {
        setShowShortcuts(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      // Hide if EITHER Ctrl or Alt is released
      if (!(e.ctrlKey || e.metaKey) || !e.altKey) {
        setShowShortcuts(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleContextMenu = (e: React.MouseEvent, student: any) => {
    e.preventDefault(); // Prevents the default browser right-click menu
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, student });
  };

  const confirmAction = (message: string, onConfirm: () => void) => {
    toast((t) => (
      <div className="flex flex-col gap-3 min-w-[250px]">
        <p className="font-bold text-sm text-white">{message}</p>
        <div className="flex justify-end gap-2 mt-2">
          <button onClick={() => toast.dismiss(t.id)} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-gray-300 rounded-lg text-xs font-bold transition-colors">Cancel</button>
          <button onClick={() => { onConfirm(); toast.dismiss(t.id); }} className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-900 rounded-lg text-xs font-bold transition-colors">Confirm</button>
        </div>
      </div>
    ), { duration: Infinity, style: { background: '#0f172a', border: '1px solid #14b8a6', padding: '16px' } });
  };

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isSessionActiveRef.current) {
        stopWebcam();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      // Safety check: Let users natively use Ctrl+A and Ctrl+Z when typing in search bars!
      const isInputFocused = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA';

      // 1. Tab Jumper (Ctrl + Up/Down)
      if ((e.ctrlKey || e.metaKey) && (e.code === 'ArrowUp' || e.code === 'ArrowDown')) {
        e.preventDefault();
        const tabs: ('scanner' | 'roster' | 'history' | 'analytics' | 'vault')[] = ['scanner', 'roster', 'history', 'analytics', 'vault'];
        const currentIndex = tabs.indexOf(activeTab);
        let nextIndex = currentIndex;
        
        if (e.code === 'ArrowDown') {
          nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
        } else {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
        }
        
        setActiveTab(tabs[nextIndex]);
        setSearchQuery(''); 
        return;
      }

      // 2. Open Unified Entry Panel (Ctrl + E)
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyE') {
        e.preventDefault();
        if (activeTab === 'scanner' && isSessionActive) {
          setIsRapidEntryOpen(true);
          setRapidSelectedIds([]);
          setRapidSearchQuery('');
        }
      }

      // 3. Start Session (Ctrl + Space)
      if ((e.ctrlKey || e.metaKey) && e.code === 'Space') {
        if (activeTab === 'scanner' && !isSessionActive) {
          e.preventDefault();
          document.getElementById('btn-start-session')?.click();
        }
      }

      // 4. Context-Aware Export (Ctrl + Shift + S)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyS') {
        e.preventDefault();
        if (activeTab === 'scanner' && isSessionActive && scannedStudents.length > 0) {
          (async () => {
            await handleExport('pdf');
            await handleGlobalEndSession();
          })();
        } else if (activeTab === 'analytics' && analyticsData.length > 0) {
          handleExportMaster();
        } else if (activeTab === 'history' && auditingSession) {
          // 🚀 FIXED: Added Re-Export trigger for the Audit Ledger!
          handleReExportSession('pdf');
        }
      }

      // 5. Download QRs (Ctrl + Q)
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyQ') {
        e.preventDefault();
        if (activeWorkspace) handleGenerateCards();
      }

      // 6. Cold Call (Ctrl + A)
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyA') {
        if (isInputFocused) return; // DANGER AVERTED: Allows normal 'Select All' in text inputs!
        e.preventDefault();
        if (activeTab === 'scanner' && isSessionActive && scannedStudents.length > 0) {
          handleColdCall();
        }
      }

      // 7. Escape (Close Modals / Exit Zen)
      if (e.code === 'Escape') {
        if (isAboutOpen) { e.preventDefault(); setIsAboutOpen(false); return; }
        if (isSettingsOpen) { e.preventDefault(); setIsSettingsOpen(false); return; }
        if (isAddStudentOpen) { e.preventDefault(); setIsAddStudentOpen(false); setNewStudentName(''); setNewStudentId(''); return; }
        if (isRapidEntryOpen) { e.preventDefault(); setIsRapidEntryOpen(false); return; }
        if (isCommandPaletteOpen) { e.preventDefault(); setIsCommandPaletteOpen(false); setCommandSearchQuery(''); return; }
        if (isZenMode) { e.preventDefault(); setIsZenMode(false); return; }
        if (isColdCallActive) { e.preventDefault(); setIsColdCallActive(false); toast.dismiss('cold-call-toast'); return; }
        if (studentProfile) setStudentProfile(null);
      }

      // 8. Global Command Palette (Ctrl + K)
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyK') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }

      // 9. Undo Scan (Ctrl + Z)
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        if (isInputFocused) return; // Allow natural text-typing undo!
        if (activeTab === 'scanner' && isSessionActive && scannedStudents.length > 0) {
          e.preventDefault();
          setScannedStudents(prev => {
            const newScans = [...prev];
            const removedStudent = newScans.shift(); 
            if (removedStudent) toast.success(`Undid scan for ${removedStudent.name}`, { icon: <Undo2 className="w-5 h-5 text-teal-400" />, id: 'undo-toast' });
            return newScans;
          });
        }
      }

      // 10. Mute Toggle (Ctrl + M)
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyM') {
        e.preventDefault();
        setIsMuted(prev => !prev);
      }

      // 11. Zen Mode Toggle (Ctrl + D)
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyD') {
        e.preventDefault();
        setIsZenMode(prev => !prev);
      }

      // 12. Add New Student (Ctrl + N)
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyN') {
        e.preventDefault();
        if (activeWorkspace) {
          setIsAddStudentOpen(true);
          setNewStudentName('');
          setNewStudentId('');
        }
      }

      // 13. Context-Aware Batch Actions (Delete / Backspace)
      if (!isInputFocused) {
        // Roster Tab Action
        if (activeTab === 'roster' && selectedStudents.length > 0 && (e.code === 'Delete' || e.code === 'Backspace')) {
          e.preventDefault();
          if (showDeleted) handleBulkDeleteStudents();
          else handleBulkArchive();
        }
        // 🚀 FIXED: History Tab Action
        if (activeTab === 'history' && selectedSessions.length > 0 && (e.code === 'Delete' || e.code === 'Backspace')) {
          e.preventDefault();
          if (showArchivedSessions) handleBulkDeleteSessions();
          else handleBulkArchiveSessions();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  // 🚀 FIXED: Injected selectedSessions so the global shortcut reads the new History checkboxes!
  }, [activeTab, isSessionActive, studentProfile, isZenMode, isCommandPaletteOpen, isAboutOpen, isSettingsOpen, isAddStudentOpen, isColdCallActive, isRapidEntryOpen, scannedStudents, analyticsData, activeWorkspace, selectedStudents, showDeleted, auditingSession, selectedSessions, showArchivedSessions]);

  useEffect(() => {
    if (isCommandPaletteOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isCommandPaletteOpen]);
  
  const playSuccessBeep = () => {
    if (isMuted) return; 
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1800, audioCtx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.1);
    } catch(e) {}
  };

  const playErrorBeep = () => {
    if (isMuted) return; 
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.3);
      gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch(e) {}
  };

  useEffect(() => {
    const initBoot = async () => {
      // @ts-ignore
      const hwRes = await window.api.getHardwareId();
      setHardwareId(hwRes);
      // @ts-ignore
      const licRes = await window.api.checkLicense();
      if (!licRes.valid) {
        setLicenseStatus(licRes.status);
        if (licRes.msg) setLicenseError(licRes.msg);
        return; 
      }
      setLicenseStatus('valid');
      if (licRes.plan) setLicenseDetails({ plan: licRes.plan, duration: licRes.duration || 'Academic Year (12 Months)', exp: licRes.exp });

      if (localStorage.getItem('justActivated') === 'true') {
        localStorage.removeItem('justActivated');
        setShowWelcome(true);
      }

      if (licRes.warning) {
        setLicenseWarning({ show: true, daysLeft: licRes.daysLeft });
      } else {
        setLicenseWarning({ show: false, daysLeft: 0 });
      }
      // @ts-ignore
      const setupRes = await window.api.getGlobalSettings();
      if (setupRes.success && setupRes.data && setupRes.data.setup_complete === 'true') {
        setGlobalSettings(setupRes.data);
        setIsSetupComplete(true);
      } else {
        setIsSetupComplete(false);
      }
    };
    initBoot();
  }, []);

  const handleActivate = async () => {
    // @ts-ignore
    const res = await window.api.activateLicense(licenseInput.trim());
    if (res.success) {
      let p = 'plus', d: string | number = 'Academic Year (12 Months)', e = 0;
      try {
         const payloadBase64 = licenseInput.trim().split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
         const decoded = JSON.parse(atob(payloadBase64));
         if (decoded.plan) p = decoded.plan;
         if (decoded.duration) d = decoded.duration;
         if (decoded.exp) e = decoded.exp;
      } catch(ex) {}
      
      setLicenseDetails({ plan: p, duration: d, exp: e });
      setLicenseStatus('valid');
      setShowWelcome(true);
      
      // Also ensure setup complete status is ready
      // @ts-ignore
      const setupRes = await window.api.getGlobalSettings();
      if (setupRes.success && setupRes.data && setupRes.data.setup_complete === 'true') {
        setGlobalSettings(setupRes.data);
        setIsSetupComplete(true);
      } else {
        setIsSetupComplete(false);
      }
    } else {
      setLicenseError(res.msg);
    }
  };

  useEffect(() => {
    if (licenseStatus !== 'valid' || !isSetupComplete || !activeWorkspace) return;

    fetchStats();
    loadMemoryMap();
    fetchAnalytics();
    fetchHistory();
    fetchRoster();
    
    if (activeTab !== 'scanner') stopWebcam(); 
    setSelectedStudents([]); 

    // @ts-ignore
    if (window.api.onStudentScanned) {
      // @ts-ignore
      window.api.onStudentScanned((payload: string) => {
        handleSuccessfulScan(payload, true);
      });
    }

    return () => { stopWebcam(); };
  }, [activeTab, isSetupComplete, licenseStatus, activeWorkspace, reportFilter, showArchivedSessions]); 

  const loadMemoryMap = async () => {
    // @ts-ignore
    const res = await window.api.getRosterForPrint();
    if (res.success) {
      const hashmap: Record<string, any> = {};
      const idmap: Record<string, any> = {};
      res.data.forEach((student: any) => {
        hashmap[student.qrPayload] = student;
        idmap[student.national_id || student.nationalId] = student;
      });
      rosterMapRef.current = hashmap;
      nationalIdMapRef.current = idmap;
    }
  };

  const fetchStats = async () => {
    try {
      // @ts-ignore
      const data = await window.api.getDashboardStats();
      setStats(data);
    } catch (error) {}
  };

  const fetchAnalytics = async () => {
    if (!activeWorkspace) return;
    // @ts-ignore
    const res = await window.api.getSemesterAnalytics(activeWorkspace, reportFilter, false); 
    if (res.success) {
      setAnalyticsData(res.data);
      setThreshold(res.threshold);
    }
  };

  const fetchHistory = async () => {
    // @ts-ignore
    const res = await window.api.getAllSessions();
    if (res.success) setPastSessions(res.data);
  };

  const fetchRoster = async () => {
    // @ts-ignore
    const res = await window.api.getRoster();
    if (res.success) setRosterData(res.data);

    // @ts-ignore
    const deletedRes = await window.api.getDeletedRoster();
    if (deletedRes.success) setDeletedRosterData(deletedRes.data);
  };

  const openStudentProfile = async (student: any) => {
    // 1. Instantly open the profile. Inject temporary '--' placeholders if data is missing.
    setStudentProfile({
      ...student,
      attended: student.attended ?? '--',
      excused: student.excused ?? '--',
      absent: student.absent ?? '--'
    });
    
    const natId = student.national_id || student.nationalId;
    // @ts-ignore
    const res = await window.api.getStudentAttendance(natId, activeWorkspace);
    
    const attendedRecords = res.success ? res.data : [];
    setStudentAttendanceRecord(attendedRecords);

    // 🚀 FIXED: Pull the strictly accurate Weekly numbers from the Analytics Master State!
    const accurateStats = analyticsData.find(a => a.national_id === natId);
    
    if (accurateStats) {
      setStudentProfile((prev: any) => prev ? { 
        ...prev, 
        attended: accurateStats.attended,
        excused: accurateStats.excused,
        bonuses: accurateStats.bonuses,
        absent: accurateStats.absent 
      } : null);
    } else {
      // Fallback if they have completely zero history
      setStudentProfile((prev: any) => prev ? { ...prev, attended: 0, excused: 0, bonuses: 0, absent: 0 } : null);
    }
  };

  const handleBulkArchive = () => {
    if (selectedStudents.length === 0) return;
    confirmAction(`Archive ${selectedStudents.length} selected students?`, async () => {
      const toastId = toast.loading('Archiving students...');
      // @ts-ignore
      await Promise.all(selectedStudents.map(id => window.api.softDeleteStudent(id)));
      toast.success('Students safely archived.', { id: toastId });
      setSelectedStudents([]);
      fetchRoster();  
      fetchStats();   
      loadMemoryMap(); 
    });
  };

  const handleBulkRestore = () => {
    if (selectedStudents.length === 0) return;
    confirmAction(`Restore ${selectedStudents.length} selected students?`, async () => {
      const toastId = toast.loading('Restoring students...');
      // @ts-ignore
      await Promise.all(selectedStudents.map(id => window.api.restoreStudent(id)));
      toast.success('Students safely restored.', { id: toastId });
      setSelectedStudents([]);
      fetchRoster();  
      fetchStats();   
      loadMemoryMap(); 
    });
  };

  const handleBulkDeleteStudents = () => {
    if (selectedStudents.length === 0) return;
    confirmAction(`WARNING: Permanently delete ${selectedStudents.length} selected students and all their attendance records? This CANNOT be undone.`, async () => {
      const toastId = toast.loading('Permanently deleting students...');
      // @ts-ignore
      await Promise.all(selectedStudents.map(id => window.api.permanentlyDeleteStudent(id)));
      toast.success('Students permanently deleted.', { id: toastId });
      setSelectedStudents([]);
      fetchRoster();  
      fetchStats();   
      loadMemoryMap(); 
    });
  };

  // 🚀 FIXED: Bulk Operations for Sessions (History Tab)
  // 🚀 FIXED: Bulk Operations for Sessions with Error Catching
  const handleBulkArchiveSessions = () => {
    if (selectedSessions.length === 0) return;
    confirmAction(`Archive ${selectedSessions.length} selected sessions?`, async () => {
      const toastId = toast.loading('Archiving sessions...');
      try {
        // @ts-ignore
        await Promise.all(selectedSessions.map(name => window.api.archiveSession(name)));
        toast.success('Sessions safely archived.', { id: toastId });
        setSelectedSessions([]);
        fetchHistory(); 
        fetchStats();   
      } catch (err) {
        toast.error('API Error: Check preload.ts bridge', { id: toastId });
      }
    });
  };

  const handleBulkDeleteSessions = () => {
    if (selectedSessions.length === 0) return;
    confirmAction(`WARNING: Permanently delete ${selectedSessions.length} sessions? This CANNOT be undone.`, async () => {
      const toastId = toast.loading('Permanently deleting sessions...');
      try {
        // @ts-ignore
        await Promise.all(selectedSessions.map(name => window.api.deleteSession(name)));
        toast.success('Sessions permanently deleted.', { id: toastId });
        setSelectedSessions([]);
        fetchHistory();
        fetchAnalytics();
        fetchStats();
      } catch (err) {
        toast.error('API Error', { id: toastId });
      }
    });
  };

  const handleBulkRestoreSessions = () => {
    if (selectedSessions.length === 0) return;
    confirmAction(`Restore ${selectedSessions.length} selected sessions?`, async () => {
      const toastId = toast.loading('Restoring sessions...');
      try {
        // @ts-ignore
        await Promise.all(selectedSessions.map(name => window.api.restoreSession(name)));
        toast.success('Sessions safely restored.', { id: toastId });
        setSelectedSessions([]);
        fetchHistory(); 
        fetchStats();   
      } catch (err) {
        toast.error('API Error: Check preload.ts bridge', { id: toastId });
      }
    });
  };
  
  const handleDeleteStudent = (name: string, nationalId: string) => {
    confirmAction(`Remove ${name} from the active roster? Past attendance will be preserved.`, async () => {
      // @ts-ignore
      const res = await window.api.softDeleteStudent(nationalId);
      if (res.success) {
        toast.success(`${name} removed from active roster.`);
        fetchRoster();  
        fetchStats();   
        loadMemoryMap(); 
      } else {
        toast.error("Database error. Failed to remove student.");
      }
    });
  };

  const handlePermanentDeleteStudent = (name: string, nationalId: string) => {
    confirmAction(`WARNING: Permanently delete ${name} and all their attendance history? This CANNOT be undone.`, async () => {
      // @ts-ignore
      const res = await window.api.permanentlyDeleteStudent(nationalId);
      if (res.success) {
        toast.success(`${name} permanently deleted.`);
        fetchRoster();  
        fetchStats();   
        loadMemoryMap(); 
      } else {
        toast.error("Database error. Failed to delete student.");
      }
    });
  };

  const handleRestoreStudent = async (name: string, nationalId: string) => {
    // @ts-ignore
    const res = await window.api.restoreStudent(nationalId);
    if (res.success) {
      toast.success(`${name} restored to active roster.`);
      fetchRoster();  
      fetchStats();   
      loadMemoryMap(); 
    }
  };

  const handleUpdateStudentName = async (nationalId: string) => {
    if (!editNameValue.trim()) return setEditingStudentId(null);
    // @ts-ignore
    const res = await window.api.updateStudentName(nationalId, editNameValue.trim());
    if (res.success) {
      toast.success('Student name updated!');
      fetchRoster();  
      loadMemoryMap(); 
    } else {
      toast.error("Database error. Failed to update name.");
    }
    setEditingStudentId(null);
  };
  
  // 🚀 NEW: Audit Ledger Functions
  const openAuditLedger = async (session: any) => {
    setAuditingSession(session);
    const toastId = toast.loading('Fetching session records...');
    
    // @ts-ignore
    const res = await window.api.getSessionDetails(session.session_name, activeWorkspace);
    if (res.success) {
      setSessionDetails(res.data);
      toast.dismiss(toastId);
    } else {
      toast.error("Failed to fetch session details.", { id: toastId });
      setAuditingSession(null);
    }
  };

  const closeAuditLedger = () => {
    setAuditingSession(null);
    setSessionDetails([]);
  };

  const handleReExportSession = async (format: 'pdf' | 'excel') => {
    if (!auditingSession || sessionDetails.length === 0) return;
    const toastId = toast.loading(`Re-compiling ${format.toUpperCase()} file...`);
    setIsExporting(true);
    try {
      // 🚀 Only export students who actually attended or are excused
      const actualAttendees = sessionDetails.filter(s => s.present || s.is_excused);
      
      const attendeesData = actualAttendees.map((s, index) => ({
        index: index + 1, 
        name: s.name, 
        id: s.national_id, 
        grade: activeWorkspace,
        status: s.present ? 'Present' : (s.is_excused ? 'Excused' : 'Absent'),
        bonus: s.bonus_points || 0
      }));
      
      let result;
      if (format === 'pdf') {
        // @ts-ignore
        result = await window.api.exportSessionToPDF(attendeesData, auditingSession.session_name);
      } else {
        // @ts-ignore
        result = await window.api.exportToExcel(attendeesData, auditingSession.session_name);
      }
      
      if (result.success) toast.success(`Re-exported ${format.toUpperCase()} successfully!`, { id: toastId, duration: 5000 });
      else toast.error(`Export failed: ${result.msg || 'Unknown error'}`, { id: toastId });
    } catch(err) {
      toast.error('Failed to export.', { id: toastId });
    } finally { 
      setIsExporting(false); 
    }
  };
  
  const handleToggleAttendance = async (nationalId: string, currentStatus: boolean) => {
    if (!auditingSession) return;
    
    const newStatus = !currentStatus; // Flip the boolean
    
    // 1. Optimistic UI Update (Instantly visually toggle the button)
    setSessionDetails(prev => prev.map(s => 
      s.national_id === nationalId ? { ...s, present: newStatus } : s
    ));

    // 2. Send the command to SQLite
    // @ts-ignore
    const res = await window.api.toggleAttendance(auditingSession.session_name, nationalId, newStatus);
    
    if (res.success) {
      toast.success(newStatus ? 'Student marked Present.' : 'Student marked Absent.', { duration: 2000 });
      // Silently refresh the background data so the History & Analytics tabs stay accurate
      fetchHistory(); 
      fetchAnalytics(); 
    } else {
      // 3. Rollback the UI if the database fails
      toast.error("Database error. Reverting change.");
      setSessionDetails(prev => prev.map(s => 
        s.national_id === nationalId ? { ...s, present: currentStatus } : s
      ));
    }
  };

  const handleToggleExcuse = async (nationalId: string, currentStatus: boolean, reason: string | null = null) => {
    if (!auditingSession) return;
    const newStatus = !currentStatus;
    
    setSessionDetails(prev => prev.map(s => s.national_id === nationalId ? { ...s, is_excused: newStatus, excuse_reason: reason, present: false } : s));
    setExcuseMenuOpenFor(null);
    
    // @ts-ignore
    await window.api.updateModifier(auditingSession.session_name, nationalId, 'excuse', newStatus, reason);
    fetchAnalytics();
  };

  const handleUpdateBonus = async (nationalId: string, currentBonus: number, change: number) => {
    if (!auditingSession) return;
    const newBonus = Math.max(0, currentBonus + change); // Prevents negative bonuses
    setSessionDetails(prev => prev.map(s => s.national_id === nationalId ? { ...s, bonus_points: newBonus } : s));
    // @ts-ignore
    await window.api.updateModifier(auditingSession.session_name, nationalId, 'bonus', newBonus);
    fetchAnalytics();
  };

  const handleDeleteSession = (name: string) => {
    confirmAction(`Delete session "${name}"? This cannot be undone.`, async () => {
      // @ts-ignore
      const res = await window.api.deleteSession(name);
      if (res.success) {
        toast.success(`Session "${name}" deleted.`);
        fetchHistory(); 
        fetchStats();   
      } else {
        toast.error("Database error. Failed to delete session.");
      }
    });
  };

  const handleSuccessfulScan = (payload: string, isHash: boolean = true) => {
    if (!isSessionActiveRef.current) {
      toast.error("You must click 'Start Session' to begin scanning.", { id: 'scan-error' });
      return;
    }

    setScannedStudents(prev => {
      const student = isHash ? rosterMapRef.current[payload] : nationalIdMapRef.current[payload];
      
      if (!student) return prev;

      if (student.grade !== activeWorkspace) {
        playErrorBeep();
        if (!isHash) toast.error(`Scan Rejected: ${student.name} belongs to Grade ${student.grade}.`, { id: 'wrong-grade' });
        return prev;
      }

      if (prev.some(s => (s.national_id || s.nationalId) === (student.national_id || student.nationalId))) {
        return prev;
      }

      playSuccessBeep();
      return [student, ...prev];
    });
  };

  const handleRemoveScan = (idToRemove: string) => {
    setScannedStudents(prev => prev.filter(s => (s.national_id || s.nationalId) !== idToRemove));
    toast.success("Scan removed.", { icon: <Trash2 className="w-5 h-5 text-teal-400" /> });
  };

  // 🚀 NEW: Cold Call Randomizer
  // We need to store the picked student in a state so the new modal can display them!
  const [coldCallStudent, setColdCallStudent] = useState<any>(null);

  const handleColdCall = () => {
    if (scannedStudents.length === 0) return;
    
    const randomIndex = Math.floor(Math.random() * scannedStudents.length);
    setColdCallStudent(scannedStudents[randomIndex]);

    playSuccessBeep(); 
    setIsColdCallActive(true);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSessionActiveRef.current) {
      toast.error("Please Start the Session first.", { id: 'manual-error' });
      return;
    }
    
    const rawInput = manualId.trim();
    if (!rawInput) return;

    // 🚀 FIXED: Regex extracts EVERY 14-digit sequence from the pasted text (ignoring spaces/commas)
    const extractedIds = rawInput.match(/\d{14}/g);

    if (!extractedIds) {
      toast.error(`No valid 14-digit IDs found in text.`, { id: 'not-found' });
      return;
    }

    let successCount = 0;
    let missingCount = 0;

    // Process all extracted IDs silently
    extractedIds.forEach(id => {
      if (nationalIdMapRef.current[id]) {
        handleSuccessfulScan(id, false);
        successCount++;
      } else {
        missingCount++;
      }
    });

    if (successCount > 0) {
      setManualId('');
      toast.success(`Successfully batch-added ${successCount} students!`);
    }
    if (missingCount > 0) {
      toast.error(`${missingCount} IDs were ignored (not found in Grade ${activeWorkspace}).`);
    }
  };

  const startWebcam = () => {
    setIsWebcamActive(true);
    setTimeout(async () => {
      const html5QrCode = new Html5Qrcode("desktop-reader");
      html5QrCodeRef.current = html5QrCode;
      try {
        await html5QrCode.start(
          { facingMode: "user" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => handleSuccessfulScan(decodedText, true),
          () => {} 
        );
      } catch (err) {
        setIsWebcamActive(false);
      }
    }, 100);
  };

  const stopWebcam = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (e) {}
      html5QrCodeRef.current = null;
    }
    setIsWebcamActive(false);
  };

  const handleGlobalStartSession = () => {
    if (scannedStudents.length > 0) {
      confirmAction("Start new session? The current attendance log will be cleared.", () => {
        setScannedStudents([]);
        setIsSessionActive(true);
        isSessionActiveRef.current = true; 
        toast.success("Session Started & Locked.");
      });
      return;
    }
    setScannedStudents([]);
    setIsSessionActive(true);
    isSessionActiveRef.current = true; 
    toast.success("Session Started & Locked.");
  };

  const handleGlobalEndSession = async () => {
    stopWebcam();
    setScannerUrl(null);
    setIsSessionActive(false);
    isSessionActiveRef.current = false;
    toast('Session Ended. Scanning locked.', { icon: <OctagonX className="w-5 h-5 text-rose-500" /> });

    // 🚀 NEW: Fire the Silent Shadow Backup
    try {
      // @ts-ignore
      await window.api.triggerShadowBackup();
      console.log("Shadow backup secured.");
    } catch (e) {
      console.error("Shadow backup failed to trigger.", e);
    }
  };

  const handleStartMobileServer = async () => {
    // @ts-ignore
    const url = await window.api.getLocalIP();
    setScannerUrl(url); 
  };

  const handleExport = async (format: 'pdf' | 'excel') => {
    if (scannedStudents.length === 0) return;
    
    const topicText = sessionTopicRef.current ? ` - ${sessionTopicRef.current}` : '';
    // 🚀 FIXED: Dynamically appends " - Group X" to the end of the session string!
    let groupStr = sessionGroups.length === 0 || sessionGroups.includes('All Groups') ? 'All Groups' : sessionGroups.map(g => g.replace('Group ', '')).join(' & ');
    if (groupStr !== 'All Groups') groupStr = 'Group ' + groupStr;
    const autoName = `[Grade ${activeWorkspace}] ${getSubjectName()} - ${globalSettings.semester || 'Semester'} - Week ${weekNumber} - ${sessionType}${topicText} - ${groupStr}`;
    
    setIsExporting(true);
    const toastId = toast.loading(`Silently saving and compiling ${format.toUpperCase()} file...`);
    
    try {
      const safeAttendeesForDB = scannedStudents.map(s => ({
        national_id: s.national_id || s.nationalId,
        bonus: s.bonus || 0
      }));

      // @ts-ignore
      const dbResult = await window.api.saveSessionData(autoName, safeAttendeesForDB);
      if (dbResult && !dbResult.success) {
        toast.error(`Database Error: ${dbResult.msg}`, { id: toastId });
        return;
      }

      const attendeesData = scannedStudents.map((s, index) => ({
        index: scannedStudents.length - index, 
        name: s.name,
        id: s.national_id || s.nationalId, 
        grade: s.grade,
        status: 'Present',
        bonus: s.bonus || 0
      })).reverse(); 

      let result;
      if (format === 'pdf') {
        // @ts-ignore
        result = await window.api.exportSessionToPDF(attendeesData, autoName);
      } else {
        // @ts-ignore
        result = await window.api.exportToExcel(attendeesData, autoName);
      }
      
      if (result.success) {
        toast.success(`Exported ${format.toUpperCase()} successfully!`, { id: toastId, duration: 4000 });
        
        setScannedStudents([]);
        sessionTopicRef.current = ''; 
        const topicInput = document.getElementById('topic-input') as HTMLInputElement;
        if (topicInput) topicInput.value = '';

      } else if (result.msg !== 'Cancelled') {
        toast.error(`Export failed: ${result.msg}`, { id: toastId });
      } else {
        toast.dismiss(toastId);
      }
    } catch (error) {
      toast.error('An unexpected error occurred.', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportMaster = async () => {
    setIsExporting(true);
    const toastId = toast.loading('Generating Excel Master Report...');
    try {
      // @ts-ignore
      const result = await window.api.exportMasterReport(activeWorkspace, reportFilter);
      if (result.success) {
        toast.success('Matrix Report saved successfully!', { id: toastId });
      } else {
        toast.error(`Export failed: ${result.msg}`, { id: toastId });
      }
    } catch (error) {
      toast.error('Failed to generate report.', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportMasterPDF = async () => {
    setIsExporting(true);
    let chartsBase64 = null;
    try {
      const chartsEl = document.getElementById('analytics-charts-deck');
      if (chartsEl) {
        chartsBase64 = await toJpeg(chartsEl, { quality: 0.95, backgroundColor: '#0f172a' });
      }
    } catch (err) {
      console.warn("Failed to capture charts", err);
    }
    const toastId = toast.loading('Generating PDF Master Report...');
    try {
      // @ts-ignore
      const result = await window.api.exportMasterReportPDF(activeWorkspace, reportFilter, globalSettings, chartsBase64);
      if (result.success) {
        toast.success('Official PDF Report saved successfully!', { id: toastId });
      } else {
        toast.error(`Export failed: ${result.msg}`, { id: toastId });
      }
    } catch (error) {
      toast.error('Failed to generate report.', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  const getAcademicYear = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth(); 
    return month >= 7 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
  };

  const handleExportBackup = async () => {
    if (!activeWorkspace) return; 
    setIsExporting(true);
    const toastId = toast.loading('Compressing silent database backup...');
    try {
      const getAcademicYear = () => {
        const date = new Date();
        const year = date.getFullYear();
        const month = date.getMonth(); 
        return month >= 7 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
      };

      const autoName = `Attendo_Grade${activeWorkspace}_Backup_${getAcademicYear()}.attdb`;
      
      // @ts-ignore
      const result = await window.api.exportBackup(activeWorkspace, autoName); 
      
      if (result.success) {
        // 🚀 FIXED: Tell the user EXACTLY where it saved
        toast.success(`Backup safely stored in C:\\Attendo_Backups!`, { id: toastId, duration: 6000 });
      } else {
        // 🚀 FIXED: This line was missing! Now it will show us exactly why it failed.
        toast.error(`Export Failed: ${result.msg}`, { id: toastId, duration: 8000 });
      }
    } catch (error) {
      toast.error('System failed to trigger export.', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFactoryReset = () => {
    const toastId = toast.loading('Formatting database...');
    // @ts-ignore
    window.api.factoryReset().then((res: any) => {
      if (res.success) {
        toast.success('Database wiped and ready for the new academic year!', { id: toastId, duration: 6000 });
        setRosterData([]);
        setDeletedRosterData([]);
        setPastSessions([]);
        setAnalyticsData([]);
        setScannedStudents([]);
        setIsSettingsOpen(false);
        setResetConfirmText(''); 
        fetchStats(); 
      } else {
          toast.error(`Reset Failed: ${res.msg || 'Database error'}`, { id: toastId, duration: 6000 });
      }
    });
  };

  const handleImportMerge = async () => {
    if (!activeWorkspace) return; 
    setIsImporting(true); 
    const toastId = toast.loading('Scanning for records and conflicts...');
    try {
      // @ts-ignore
      const result = await window.api.importBackup(activeWorkspace); 
      if (result.success) {
        if (result.requiresResolution) {
          toast.dismiss(toastId);
          setMergeConflicts(result.conflicts);
          setPendingImportPath(result.backupPath);
          setResolutions({}); // Reset choices
        } else {
          toast.success(`Merge Complete! Integrated ${result.count} sessions.`, { id: toastId, duration: 5000 });
          fetchAnalytics(); fetchHistory(); fetchRoster();
        }
      } else if (result.msg !== 'Import Cancelled') {
        toast.error(`Merge Failed: ${result.msg}`, { id: toastId });
      } else {
        toast.dismiss(toastId);
      }
    } catch (error) {
      toast.error('Failed to import backup.', { id: toastId });
    } finally {
      setIsImporting(false); 
    }
  };

  const submitConflictResolutions = async () => {
    const toastId = toast.loading('Applying resolutions...');
    const resolutionPayload = Object.entries(resolutions).map(([key, choice]) => {
      const [national_id, session_name] = key.split('||');
      return { national_id, session_name, keep: choice };
    });

    // @ts-ignore
    const result = await window.api.resolveConflicts(pendingImportPath, resolutionPayload, activeWorkspace);
    if (result.success) {
      toast.success(`Conflict resolved! Integrated ${result.count} sessions.`, { id: toastId });
      setMergeConflicts([]);
      setPendingImportPath(null);
      fetchAnalytics(); fetchHistory(); fetchRoster();
    } else {
      toast.error('Failed to apply resolutions.', { id: toastId });
    }
  };

  const handleThresholdChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = parseInt(e.target.value);
    if (isNaN(val) || val < 1) val = 1; // Prevent NaN or negative values
    setThreshold(val);
    // @ts-ignore
    await window.api.updateThreshold(val);
    if (activeTab === 'analytics') fetchAnalytics();
  };

  const handleGenerateCards = async () => {
    setIsGenerating(true);
    const toastId = toast.loading('Generating QR image bundle...');
    // @ts-ignore
    const response = await window.api.getRosterForPrint();
    
    if (response.success && response.data.length > 0) {
      const gradeStudents = response.data.filter((s: any) => s.grade === activeWorkspace);
      
      if (gradeStudents.length === 0) {
         toast.error(`No students found for Grade ${activeWorkspace}.`, { id: toastId });
         setIsGenerating(false);
         return;
      }

      setPrintData(gradeStudents); 
      
      setTimeout(async () => {
        try {
          // 🚀 FIXED: Clean instantiation without the 'any' hack
          const zip = new JSZip();
          const folder = zip.folder(`Attendo_Grade_${activeWorkspace}_QRs`);
          const elements = document.querySelectorAll('.qr-export-card');

          for (let i = 0; i < elements.length; i++) {
            const el = elements[i] as HTMLElement;
            const student = gradeStudents[i];
            
            // 🚀 FIXED: skipFonts prevents html-to-image from crashing if offline or blocked by CORS
            const dataUrl = await toJpeg(el, { 
              quality: 1.0, 
              pixelRatio: 2, 
              backgroundColor: '#ffffff',
              skipFonts: true 
            });
            const base64Data = dataUrl.split(',')[1]; 

            const safeName = student.name.replace(/[^a-zA-Z0-9\u0600-\u06FF\s]/g, '').trim();
            folder?.file(`${safeName}_QR.jpg`, base64Data, { base64: true });
          }

          const zipBlob = await zip.generateAsync({ type: 'blob' });
          const arrayBuffer = await zipBlob.arrayBuffer();
          // @ts-ignore
          const res = await window.api.saveBlob(arrayBuffer, `Attendo_Grade_${activeWorkspace}_QRs.zip`);
          if (!res.success && res.msg !== 'Cancelled') {
            throw new Error(res.msg);
          }
          
          toast.success('QR Bundle downloaded!', { id: toastId });
        } catch (err) {
          // 🚀 FIXED: Will now print the actual technical error to the DevTools console!
          console.error("QR Generation Crash:", err);
          toast.error(`Error: ${err instanceof Error ? err.message : String(err)}`, { id: toastId, duration: 6000 });
        } finally {
          setIsGenerating(false); 
        }
      }, 800); // 🚀 Increased timeout slightly to ensure heavy DOM paints completely before scanning
      
    } else {
      setIsGenerating(false);
      toast.error('No students found. Import a roster first!', { id: toastId });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = ''; 
  };

  const processFile = (file: File) => {
    const toastId = toast.loading('Parsing CSV file...');
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const validStudents: any[] = [];
        
        results.data.forEach((row: any) => {
          const rawName = row['Name'] || row['name'] || row['الاسم'] || '';
          const rawId = row['ID'] || row['id'] || row['الرقم القومي'] || '';
          const rawGrade = row['Grade'] || row['grade'] || row['الفرقة'] || '';
          
          let cleanId = String(rawId).trim();
          // Strip out Excel text formatting artifacts like ="1234" or '1234
          cleanId = cleanId.replace(/^="?/, '').replace(/"?$/, '').replace(/^'/, '');
          
          const cleanGrade = String(rawGrade).trim();
          const isValidId = /^\d{14}$/.test(cleanId);

          if (rawName.trim() && isValidId) {
            validStudents.push({ name: rawName.trim(), nationalId: cleanId, grade: cleanGrade });
          }
        });

        if (validStudents.length > 0) {
          // @ts-ignore
          const response = await window.api.importRoster(validStudents);
          if (response.success) {
            toast.success(`Imported ${response.count} new students!`, { id: toastId, duration: 4000 });
            fetchStats();
            loadMemoryMap(); 
            fetchRoster(); 
          } else {
            toast.error('Database error during import.', { id: toastId });
          }
        } else {
          toast.error("No valid students found. Ensure proper formatting.", { id: toastId });
        }
      }
    });
  };

  const handleManualAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace) return;

    const cleanId = newStudentId.trim();
    if (!/^\d{14}$/.test(cleanId)) {
      toast.error("National ID must be exactly 14 digits.");
      return;
    }
    if (!newStudentName.trim()) {
      toast.error("Student name is required.");
      return;
    }

    const toastId = toast.loading('Adding student to roster...');
    const singleStudentArray = [{ name: newStudentName.trim(), nationalId: cleanId, grade: activeWorkspace }];

    // @ts-ignore
    const response = await window.api.importRoster(singleStudentArray);
    
    if (response.success && response.count > 0) {
      toast.success(`${newStudentName.trim()} added successfully!`, { id: toastId });
      setIsAddStudentOpen(false);
      setNewStudentName('');
      setNewStudentId('');
      fetchStats();
      loadMemoryMap();
      fetchRoster();
    } else {
      toast.error('Failed to add student. The ID might already exist.', { id: toastId });
    }
  };

  const downloadTemplate = async () => {
    // @ts-ignore
    const res = await window.api.downloadTemplate();
    if (res.success) {
      toast.success('Template downloaded successfully!');
    } else if (res.msg !== 'Cancelled') {
      toast.error('Failed to download template: ' + res.msg);
    }
  };

  const commandPaletteResults = useMemo(() => {
    if (!commandSearchQuery.trim()) return [];
    const query = commandSearchQuery.toLowerCase();
    return rosterData.filter(s => 
      (!activeWorkspace || s.grade === activeWorkspace) &&
      (s.name.toLowerCase().includes(query) || (s.national_id || s.nationalId)?.includes(query))
    ).slice(0, 5); 
  }, [commandSearchQuery, rosterData, activeWorkspace]);

  const filteredAnalytics = useMemo(() => {
    const query = debouncedSearchQuery.toLowerCase();
    return analyticsData.filter(s => 
      s.grade === activeWorkspace && (s.name.toLowerCase().includes(query) || s.national_id.includes(query))
    );
  }, [debouncedSearchQuery, analyticsData, activeWorkspace]);

  const filteredHistory = useMemo(() => {
    const query = debouncedSearchQuery.toLowerCase();
    const filtered = pastSessions.filter(s => {
      const isWorkspaceMatch = s.session_name.startsWith(`[Grade ${activeWorkspace}]`);
      const isSearchMatch = activeTab === 'history' ? s.session_name.toLowerCase().includes(query) : true;
      const isArchiveMatch = showArchivedSessions ? s.is_archived === 1 : s.is_archived === 0;
      
      let isTypeMatch = true;
      if (historyTypeFilter === 'Lecture') {
        isTypeMatch = s.session_name.includes(' - Lecture');
      } else if (historyTypeFilter === 'Section') {
        isTypeMatch = s.session_name.includes(' - Section');
      }
      
      return isWorkspaceMatch && isSearchMatch && isArchiveMatch && isTypeMatch;
    });

    // Sort chronologically
    return filtered.sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());
  }, [debouncedSearchQuery, pastSessions, activeWorkspace, activeTab, showArchivedSessions, historyTypeFilter]);

  const filteredRoster = useMemo(() => {
    const query = debouncedSearchQuery.toLowerCase();
    return rosterData.filter(s => 
      s.grade === activeWorkspace && (s.name.toLowerCase().includes(query) || (s.national_id || s.nationalId)?.includes(query))
    );
  }, [debouncedSearchQuery, rosterData, activeWorkspace]);

  const filteredDeletedRoster = useMemo(() => {
    const query = debouncedSearchQuery.toLowerCase();
    return deletedRosterData.filter(s => 
      s.grade === activeWorkspace && (s.name.toLowerCase().includes(query) || (s.national_id || s.nationalId)?.includes(query))
    );
  }, [debouncedSearchQuery, deletedRosterData, activeWorkspace]);

  const currentRosterList = showDeleted ? filteredDeletedRoster : filteredRoster;

  // 🚀 NEW: Semester Timeline Visualizer Engine
  const semesterTimeline = useMemo(() => {
    if (!globalSettings.semester_start || !globalSettings.semester_end) return null;
    
    const start = new Date(globalSettings.semester_start);
    const end = new Date(globalSettings.semester_end);
    const today = new Date();

    const totalMs = end.getTime() - start.getTime();
    const elapsedMs = today.getTime() - start.getTime();
    const progress = Math.max(0, Math.min(100, (elapsedMs / totalMs) * 100));

    const weeks: { weekNum: number, date: Date, isCurrent: boolean, isPast: boolean }[] = [];
    let currentIter = new Date(start);
    let weekNum = 1;

    while (currentIter <= end) {
      const nextWeek = new Date(currentIter);
      nextWeek.setDate(nextWeek.getDate() + 7);

      const isPast = today >= nextWeek;
      const isCurrent = today >= currentIter && today < nextWeek;

      weeks.push({ weekNum, date: new Date(currentIter), isCurrent, isPast });

      currentIter = nextWeek;
      weekNum++;
    }

    return { progress, weeks, start, end };
  }, [globalSettings]);

  const pieData = useMemo(() => [
    { name: 'Safe', value: filteredAnalytics.filter(s => !s.atRisk).length, color: '#2dd4bf' },
    { name: 'At Risk', value: filteredAnalytics.filter(s => s.atRisk).length, color: '#f87171' }
  ], [filteredAnalytics]);

  // 🚀 FIXED: Week-Based Aggregation with Secret Group Payloads!
  const barData = useMemo(() => {
    const filtered = pastSessions.filter(s => {
      const isWorkspaceMatch = s.session_name.startsWith(`[Grade ${activeWorkspace}]`);
      const isActive = s.is_archived === 0;
      
      let isTypeMatch = true;
      if (reportFilter === 'Lecture') isTypeMatch = s.session_name.includes(' - Lecture');
      if (reportFilter === 'Section') isTypeMatch = s.session_name.includes(' - Section');
      
      return isWorkspaceMatch && isActive && isTypeMatch;
    });

    // We now store an object containing the total AND a dictionary of groups
    const weeklyAggregator: Record<string, { total: number, groups: Record<string, number> }> = {};

    filtered.forEach(s => {
      const weekMatch = s.session_name.match(/Week (\d+)/);
      const weekKey = weekMatch ? `Week ${weekMatch[1]}` : 'Other';

      // Extract the exact group/session type name (e.g., "Lecture", "Group A")
      const groupMatch = s.session_name.match(/-\s*(.+)$/);
      const groupName = groupMatch ? groupMatch[1].trim() : 'Unassigned';

      if (!weeklyAggregator[weekKey]) {
        weeklyAggregator[weekKey] = { total: 0, groups: {} };
      }
      
      weeklyAggregator[weekKey].total += s.total_attendees;
      // Add or update the specific group's turnout inside this week
      weeklyAggregator[weekKey].groups[groupName] = (weeklyAggregator[weekKey].groups[groupName] || 0) + s.total_attendees;
    });

    return Object.entries(weeklyAggregator)
      .sort((a, b) => {
        const numA = parseInt(a[0].replace(/\D/g, '')) || 0;
        const numB = parseInt(b[0].replace(/\D/g, '')) || 0;
        return numA - numB;
      })
      .map(([weekName, data]) => ({
        name: weekName.replace('Week ', 'W'), 
        fullName: `${weekName} Turnout`, 
        Attendees: data.total,
        groups: data.groups // 🚀 The secret payload for the Tooltip!
      }));
  }, [pastSessions, activeWorkspace, reportFilter]);


  // 🚀 NEW: The Details-on-Demand Rich Tooltip Component
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      
      // A palette of dynamic colors for the group dots
      const dotColors = ['bg-indigo-500', 'bg-rose-500', 'bg-amber-500', 'bg-blue-500', 'bg-emerald-500', 'bg-purple-500'];

      return (
        <div className="bg-[#0f172a]/95 border border-[#334155] p-4 rounded-xl shadow-[0_10px_25px_rgba(0,0,0,0.5)] backdrop-blur-md min-w-[180px]">
          <p className="text-white font-bold mb-3 text-sm flex items-center justify-between border-b border-white/10 pb-2 uppercase tracking-wider">
            {data.fullName}
            <span className="text-teal-400 font-black text-lg ml-4">{data.Attendees}</span>
          </p>
          <div className="space-y-2">
            {data.groups && Object.entries(data.groups).sort().map(([groupName, count], idx) => {
              const colorClass = dotColors[idx % dotColors.length];
              return (
                <div key={groupName} className="flex justify-between items-center gap-4">
                  <span className="text-gray-300 text-xs flex items-center gap-2 font-medium">
                    <span className={`w-2 h-2 rounded-full ${colorClass} shadow-[0_0_8px_currentColor] opacity-80`}></span>
                    {groupName}
                  </span>
                  <span className="text-white font-bold text-xs bg-white/5 px-2 py-0.5 rounded-md border border-white/5">{count as number}</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return null;
  };

  const fullStudentTimeline = useMemo(() => {
    if (!studentProfile || !pastSessions) return { attended: [], absent: [] };
    
    // Filter the workspace sessions exactly how the analytics tab does
    const relevantSessions = pastSessions.filter(s => {
      // Must match the current active/archive view of the analytics tab
      const matchesArchive = showArchivedSessions ? s.is_archived === 1 : s.is_archived === 0;
      if (!matchesArchive) return false;
      
      // Must match the dropdown filter
      if (reportFilter === 'Lecture') return s.session_name.includes(' - Lecture');
      if (reportFilter === 'Section') return s.session_name.includes(' - Section');
      return true;
    });

    const attended: any[] = [];
    const absent: any[] = [];

    // Default to empty array if no attendance records yet
    const records = studentAttendanceRecord || [];

    relevantSessions.forEach(session => {
       const attendanceMatch = records.find(r => r.session_name === session.session_name);
       if (attendanceMatch) {
         attended.push({ ...attendanceMatch, is_absent: false });
       } else {
         absent.push({ 
           session_name: session.session_name, 
           timestamp: session.date, 
           is_absent: true,
           is_excused: 0,
           bonus_points: 0
         });
       }
    });

    // Sort both by timestamp descending (newest first)
    attended.sort((a, b) => b.timestamp - a.timestamp);
    absent.sort((a, b) => b.timestamp - a.timestamp);

    return { attended, absent };
  }, [studentProfile, studentAttendanceRecord, pastSessions, reportFilter, showArchivedSessions]);

  // 🚀 FIXED: Spatial Keyboard Navigation Engine (Moved below the variables it uses)
  useEffect(() => {
    setFocusedIndex(null); // Reset focus when switching lists, tabs, or filtering
    setSelectedSessions([]); // Reset session checkboxes when changing views
    setSelectedStudents([]); // Reset student checkboxes when changing views
  }, [activeTab, debouncedSearchQuery, showDeleted, reportFilter, showArchivedSessions, activeWorkspace]);

  useEffect(() => {
    const handleSpatialNav = (e: KeyboardEvent) => {
      // 1. Block navigation if modals are open, inline-editing, OR if the Audit Ledger is actively open
      const isBlockingState = isAboutOpen || isSettingsOpen || isAddStudentOpen || isCommandPaletteOpen || studentProfile !== null || editingStudentId !== null || auditingSession !== null;
      if (isBlockingState || activeTab === 'scanner') return;

      // 2. Dynamically select the list based on the active tab
      let activeList: any[] = [];
      if (activeTab === 'roster') activeList = currentRosterList;
      else if (activeTab === 'analytics') activeList = filteredAnalytics;
      else if (activeTab === 'history') activeList = filteredHistory;

      if (activeList.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault(); // Stop window from scrolling
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); 
        setFocusedIndex(prev => (prev === null || prev >= activeList.length - 1) ? 0 : prev + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); 
        setFocusedIndex(prev => (prev === null || prev === 0) ? activeList.length - 1 : prev - 1);
      } else if (e.key === 'Enter') {
        if (focusedIndex !== null && activeList[focusedIndex]) {
          e.preventDefault();
          // Context-aware Enter key!
          if (activeTab === 'history') {
            openAuditLedger(activeList[focusedIndex]);
          } else {
            openStudentProfile(activeList[focusedIndex]);
          }
        }
      }
    };

    window.addEventListener('keydown', handleSpatialNav);
    return () => window.removeEventListener('keydown', handleSpatialNav);
  // Added auditingSession & filteredHistory to the dependency array
  }, [activeTab, currentRosterList, filteredAnalytics, filteredHistory, focusedIndex, isAboutOpen, isSettingsOpen, isAddStudentOpen, isCommandPaletteOpen, studentProfile, editingStudentId, auditingSession]);

// 🚀 NEW: Context-Aware Auto-Scroll Engine
  useEffect(() => {
    if (focusedIndex !== null) {
      const rowPrefix = activeTab === 'history' ? 'session-row-' : 'student-row-';
      const el = document.getElementById(`${rowPrefix}${focusedIndex}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [focusedIndex, activeTab]);

  if (licenseStatus === 'checking') {
    return (
      <div className="bg-slate-900 w-screen h-screen flex flex-col font-sans relative overflow-hidden">
        <TitleBar />
        <div className="flex-1 flex flex-col items-center justify-center p-6 relative w-full h-full overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-500/10 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="z-10 flex flex-col items-center animate-fade-in mb-16">
          <img src="./attendo-icon.png" alt="Attendo Logo" className="w-28 h-28 object-contain mb-6 animate-pulse drop-shadow-[0_0_20px_rgba(20,184,166,0.4)]" />
          <h1 className="text-4xl font-black text-white tracking-tight mb-2">
            Welcome to <span className="text-teal-400">Attendo.</span>
          </h1>
          <p className="text-gray-400 text-xs font-bold tracking-widest uppercase">
            The Future of Academic Attendance
          </p>
        </div>
        <div className="absolute bottom-10 flex flex-col items-center text-center gap-1.5 z-10 animate-fade-in">
          <p className="text-teal-400 font-black text-sm tracking-wide">Developed by Dr. Belal El-Fakharany</p>
          <p className="text-gray-300 text-xs font-bold uppercase tracking-widest">Theriogenology Department</p>
          <p className="text-gray-500 text-xs font-semibold">Faculty of Veterinary Medicine - Suez Canal University</p>
        </div>
        </div>
      </div>
    );
  }

  if (licenseStatus === 'tampered') {
    return (
      <div className="bg-slate-900 w-screen h-screen flex flex-col font-sans">
        <TitleBar />
        <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-rose-500/10 border border-rose-500/50 p-8 rounded-3xl max-w-lg text-center shadow-[0_0_50px_rgba(244,63,94,0.2)] flex flex-col items-center">
          <ShieldAlert className="w-16 h-16 text-rose-500 mb-4" />
          <h1 className="text-3xl font-black text-rose-400 mb-2">Security Lockdown</h1>
          <p className="text-gray-300 leading-relaxed">System clock manipulation detected. The application has locked itself to protect the integrity of the data. Please contact your system administrator.</p>
        </div>
        </div>
      </div>
    );
  }

  if (licenseStatus === 'REVOKED') {
    return (
      <div className="bg-slate-900 w-screen h-screen flex flex-col font-sans">
        <TitleBar />
        <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-rose-500/10 border border-rose-500/50 p-8 rounded-3xl max-w-lg text-center shadow-[0_0_50px_rgba(244,63,94,0.2)] flex flex-col items-center">
          <OctagonX className="w-16 h-16 text-rose-500 mb-4" />
          <h1 className="text-3xl font-black text-rose-400 mb-2">License Revoked</h1>
          <p className="text-gray-300 leading-relaxed mb-6">This license has been permanently revoked by the administrator. Your local key has been invalidated.</p>
          <a 
              href={`https://wa.me/201014503937?text=${encodeURIComponent(`Hello Dr. Belal, my Attendo license was revoked. Can you please assist me?`)}`}
              target="_blank" 
              rel="noopener noreferrer" 
              className="inline-flex items-center justify-center gap-2 w-full bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/30 hover:border-[#25D366]/50 text-[#25D366] transition-all px-4 py-3 rounded-xl group cursor-pointer"
            >
              <MessageCircle className="w-5 h-5 grayscale group-hover:grayscale-0 transition-all" />
              <span className="text-sm font-bold tracking-wide">Contact Administrator</span>
            </a>
        </div>
        </div>
      </div>
    );
  }

  if (licenseStatus === 'SYNC_REQUIRED') {
    return (
      <div className="bg-slate-900 w-screen h-screen flex flex-col font-sans">
        <TitleBar />
        <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-amber-500/10 border border-amber-500/50 p-8 rounded-3xl max-w-lg text-center shadow-[0_0_50px_rgba(245,158,11,0.2)] flex flex-col items-center">
          <CloudUpload className="w-16 h-16 text-amber-500 mb-4" />
          <h1 className="text-3xl font-black text-amber-400 mb-2">Offline Limit Reached</h1>
          <p className="text-gray-300 leading-relaxed mb-6">You have been using Attendo offline for over 21 days. To continue using the software, please connect to the internet for a few seconds to sync your license.</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-black py-4 rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all flex items-center justify-center gap-2"
          >
            Retry Connection <RefreshCw className="w-5 h-5" />
          </button>
        </div>
        </div>
      </div>
    );
  }

  if (licenseStatus !== 'valid') {
    return (
      <div className="bg-slate-900 w-screen h-screen flex flex-col font-sans">
        <TitleBar />
        <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 md:p-12 rounded-3xl shadow-2xl w-full max-w-xl text-center">
          <h1 className="text-3xl font-black text-teal-400 mb-2">Attendo Activation</h1>
          <p className="text-gray-400 text-sm mb-8">Please provide your academic license token to activate this software.</p>
          
          <div className="bg-black/30 border border-white/5 p-4 rounded-xl mb-6 text-left">
            <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Machine Hardware ID</p>
            <p className="text-teal-300 font-mono text-sm break-all select-all mb-4">{hardwareId}</p>
            
            <a 
              href={`https://wa.me/201014503937?text=${encodeURIComponent(`Hello Dr. Belal, I would like to request an activation token for Attendo.\n\nMy Machine Hardware ID is:\n${hardwareId}`)}`}
              target="_blank" 
              rel="noopener noreferrer" 
              className="inline-flex items-center justify-center gap-2 w-full bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/30 hover:border-[#25D366]/50 text-[#25D366] transition-all px-4 py-3 rounded-xl group cursor-pointer"
            >
              <MessageCircle className="w-5 h-5 grayscale group-hover:grayscale-0 transition-all" />
              <span className="text-sm font-bold tracking-wide">Send ID via WhatsApp</span>
            </a>
          </div>

          <textarea 
            placeholder="Paste your JWT activation token here..." 
            value={licenseInput} 
            onChange={e => setLicenseInput(e.target.value)}
            className="w-full h-32 bg-black/50 border border-white/10 text-gray-300 font-mono text-xs p-4 rounded-xl focus:outline-none focus:border-teal-500 transition-colors mb-4 resize-none"
          />
          
          {licenseError && <p className="text-rose-400 text-sm font-bold mb-4">{licenseError}</p>}
          
          <button 
            onClick={handleActivate}
            disabled={!licenseInput}
            className="w-full bg-teal-500 hover:bg-teal-400 text-slate-900 font-black py-4 rounded-xl shadow-[0_0_20px_rgba(20,184,166,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            Activate License <Unlock className="w-5 h-5" />
          </button>
        </div>
        </div>
      </div>
    );
  }

  const welcomeModalNode = showWelcome ? (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-[#020617]/95 backdrop-blur-md p-4 animate-fade-in" onClick={() => setShowWelcome(false)}>
           <div className="bg-slate-900 border border-teal-500/30 rounded-3xl w-full max-w-lg p-8 flex flex-col items-center text-center shadow-[0_0_50px_rgba(20,184,166,0.3)] relative overflow-hidden" onClick={e => e.stopPropagation()}>
           <div className="w-20 h-20 bg-teal-500/10 border border-teal-500/20 rounded-full flex items-center justify-center mb-6 mt-2 shadow-[0_0_20px_rgba(20,184,166,0.2)]">
             <img src="./attendo-icon.png" alt="Attendo Logo" className="w-10 h-10 drop-shadow-[0_0_10px_rgba(20,184,166,0.5)]" />
           </div>
           <h2 className="text-3xl font-black text-white mb-2">Welcome to Attendo!</h2>
           <p className="text-gray-400 mb-8">Your license has been successfully activated.</p>
           
           <div className="w-full bg-black/40 border border-white/5 rounded-2xl p-6 mb-8 text-left">
              <div className="flex justify-between items-center mb-4">
                 <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">Plan Type</span>
                 <span className="text-white font-bold capitalize flex items-center gap-2"><Shield className="w-4 h-4 text-teal-400" /> {licenseDetails.plan} License</span>
              </div>
              <div className="flex justify-between items-center mb-4">
                 <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">Duration</span>
                 <span className="text-white font-bold capitalize flex items-center gap-2"><Clock className="w-4 h-4 text-indigo-400" /> {typeof licenseDetails.duration === 'number' ? `${licenseDetails.duration} Months` : licenseDetails.duration}</span>
              </div>
              <div className="flex justify-between items-center">
                 <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">Expires On</span>
                 <span className="text-teal-400 font-bold">{new Date(licenseDetails.exp * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
           </div>

           <button onClick={() => setShowWelcome(false)} className="w-full bg-teal-500 hover:bg-teal-400 text-slate-900 font-black py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(20,184,166,0.3)] text-lg">
             Get Started
           </button>
       </div>
    </div>
  ) : null;

  if (isSetupComplete === null) {
    return (
      <div className="bg-slate-900 w-screen h-screen flex flex-col font-sans">
        <TitleBar />
        <div className="flex-1 flex items-center justify-center text-teal-400 font-bold text-xl animate-pulse">Initializing Environment...</div>
      </div>
    );
  }

  if (isSetupComplete === false) {
    return (
      <div className="bg-slate-900 w-screen h-screen flex flex-col font-sans relative overflow-hidden">
        <TitleBar />
        <div className="flex-1 flex items-center justify-center p-4 relative w-full overflow-y-auto">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none"></div>
        
        {/* Widened the container to max-w-3xl to comfortably fit two columns */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 md:p-8 rounded-3xl shadow-2xl w-full max-w-3xl relative z-10 animate-fade-in">
          <h1 className="text-3xl font-black text-teal-400 mb-2">Welcome to Attendo</h1>
          <p className="text-gray-400 mb-6 text-sm">Let's configure your environment. This information will be used to automatically name your export files and format your reports.</p>
          
          <div className="space-y-4">
            
            {/* 🚀 Row 1: Instructor & Subject */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase mb-2 block tracking-wider">Instructor Name</label>
                <input type="text" placeholder="e.g., Dr. Ahmed" value={setupInstructor} onChange={e => setSetupInstructor(e.target.value)} className="w-full bg-black/30 border border-white/10 text-white p-3 rounded-xl focus:outline-none focus:border-teal-500 transition-colors" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-gray-400 font-bold uppercase block tracking-wider">Subject Name (Per Grade)</label>
                {setupGrades.length === 0 ? (
                  <p className="text-xs text-gray-500 italic py-2">Select grades below to assign subjects.</p>
                ) : (
                  setupGrades.map(grade => (
                    <div key={grade} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-teal-500 w-16">Grade {grade}:</span>
                      <input type="text" placeholder="e.g., Anatomy" value={setupSubjects[grade] || ''} onChange={e => setSetupSubjects({...setupSubjects, [grade]: e.target.value})} className="w-full bg-black/30 border border-white/10 text-white p-2 rounded-xl focus:outline-none focus:border-teal-500 transition-colors text-sm" />
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 🚀 Row 2: Semester, Groups & Grades */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-400 font-bold uppercase mb-2 block tracking-wider">Semester</label>
                  <select value={setupSemester} onChange={e => setSetupSemester(e.target.value)} className="w-full bg-black/30 border border-white/10 text-white p-3 rounded-xl focus:outline-none focus:border-teal-500 transition-colors cursor-pointer">
                    <option value="First Semester">First Semester</option>
                    <option value="Second Semester">Second Semester</option>
                    <option value="Summer Semester">Summer Semester</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 font-bold uppercase mb-2 block tracking-wider">Max Groups</label>
                  <input type="number" min="1" max="26" value={setupTotalGroups} onChange={e => setSetupTotalGroups(parseInt(e.target.value)||1)} className="w-full bg-black/30 border border-white/10 text-white p-3 rounded-xl focus:outline-none focus:border-teal-500 transition-colors" />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase mb-2 block tracking-wider">Grades Taught (Select all that apply)</label>
                <div className="flex gap-2 flex-wrap">
                  {['1', '2', '3', '4', '5'].map(grade => (
                    <button 
                      key={grade}
                      onClick={() => setSetupGrades(prev => prev.includes(grade) ? prev.filter(g => g !== grade) : [...prev, grade])}
                      className={`w-11 h-11 rounded-lg font-bold transition-all ${setupGrades.includes(grade) ? 'bg-teal-500 text-slate-900 shadow-[0_0_15px_rgba(20,184,166,0.4)]' : 'bg-black/30 text-gray-400 border border-white/10 hover:border-teal-500'}`}
                    >
                      {grade}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 🚀 Row 3: University & Faculty Names */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase mb-2 block tracking-wider">University Name</label>
                <input type="text" placeholder="e.g., Suez Canal University" value={setupUniversity} onChange={e => setSetupUniversity(e.target.value)} className="w-full bg-black/30 border border-white/10 text-white p-3 rounded-xl focus:outline-none focus:border-teal-500 transition-colors" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase mb-2 block tracking-wider">Faculty Name</label>
                <input type="text" placeholder="e.g., Faculty of Veterinary Medicine" value={setupFaculty} onChange={e => setSetupFaculty(e.target.value)} className="w-full bg-black/30 border border-white/10 text-white p-3 rounded-xl focus:outline-none focus:border-teal-500 transition-colors" />
              </div>
            </div>

            {/* 🚀 Row 4: Semester Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase mb-2 block tracking-wider">Semester Start Date</label>
                <input type="date" value={setupStartDate} onChange={e => setSetupStartDate(e.target.value)} className="w-full bg-black/30 border border-white/10 text-white p-3 rounded-xl focus:outline-none focus:border-teal-500 transition-colors cursor-pointer" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase mb-2 block tracking-wider">Semester End Date</label>
                <input type="date" value={setupEndDate} onChange={e => setSetupEndDate(e.target.value)} className="w-full bg-black/30 border border-white/10 text-white p-3 rounded-xl focus:outline-none focus:border-teal-500 transition-colors cursor-pointer" />
              </div>
            </div>

            <button 
              disabled={!setupInstructor || setupGrades.length === 0 || setupGrades.some(g => !setupSubjects[g]?.trim()) || !setupUniversity || !setupFaculty || !setupStartDate || !setupEndDate || isSavingSetup}
              onClick={async () => {
                setIsSavingSetup(true);
                const config = {
                  setup_complete: 'true',
                  instructor_name: setupInstructor,
                  subject_name: JSON.stringify(setupSubjects),
                  semester: setupSemester,
                  grades: JSON.stringify(setupGrades),
                  university_name: setupUniversity.trim(),
                  faculty_name: setupFaculty.trim(),
                  total_groups: setupTotalGroups.toString(),
                  semester_start: setupStartDate,
                  semester_end: setupEndDate
                };
                // @ts-ignore
                const res = await window.api.saveGlobalSettings(config);
                if (res.success) {
                  setGlobalSettings(config);
                  setIsSetupComplete(true);
                } else {
                  toast.error("Failed to save setup.");
                  setIsSavingSetup(false);
                }
              }}
              className="w-full bg-teal-500 hover:bg-teal-400 text-slate-900 font-black py-3.5 rounded-xl shadow-[0_0_20px_rgba(20,184,166,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2 flex items-center justify-center gap-2"
            >
              {isSavingSetup ? 'Saving Setup...' : <><Rocket className="w-5 h-5" /> Complete Setup</>}
            </button>
          </div>
        </div>
        </div>
        {welcomeModalNode}
      </div>
    );
  }

  if (isSetupComplete && !activeWorkspace) {
    const gradesList = JSON.parse(globalSettings.grades || '[]');
    return (
      <div className="bg-slate-900 w-screen h-screen flex flex-col font-sans relative overflow-hidden">
        <TitleBar />
        <div className="flex-1 flex flex-col items-center justify-center p-6 relative w-full h-full overflow-hidden">
        <Toaster position="bottom-right" toastOptions={{ style: { background: '#1e293b', color: '#fff', border: '1px solid #334155', padding: '12px 16px' } }}>
        {(t) => (
          <ToastBar toast={t}>
            {({ icon, message }) => (
              <>
                {icon}
                {message}
                {t.type !== 'loading' && (
                  <button 
                    onClick={() => toast.dismiss(t.id)} 
                    className="ml-3 p-1 rounded-md text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors focus:outline-none"
                    title="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </ToastBar>
        )}
      </Toaster>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-teal-500/5 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="text-center z-10 animate-fade-in">
          <h1 className="text-4xl font-black text-teal-400 mb-2">Select Workspace</h1>
          <p className="text-gray-400 mb-12">Choose which grade you are teaching right now.</p>
          <div className="flex flex-wrap justify-center gap-6">
            {gradesList.map((grade: string) => (
              <button 
                key={grade} 
                onClick={() => setActiveWorkspace(grade)} 
                className="bg-white/5 border border-white/10 hover:bg-white/10 hover:border-teal-400 hover:-translate-y-2 p-8 rounded-3xl shadow-xl transition-all w-64 group flex flex-col items-center"
              >
                <GraduationCap className="w-16 h-16 text-gray-400 mb-4 group-hover:scale-110 group-hover:text-teal-400 transition-all" />
                <h2 className="text-2xl font-bold text-white mb-1">{grade.match(/^\d+$/) ? `Grade ${grade}` : grade}</h2>
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest">{getSubjectName(grade)}</p>
              </button>
            ))}

            <button 
              onClick={async () => { 
                let currentSubjects: any = {};
                try { currentSubjects = JSON.parse(globalSettings.subject_name || '{}'); } 
                catch(e) { /* Ignore plain string errors */ }
                
                setManageWorkspaces(gradesList.map((g: string) => ({ id: g, subject: currentSubjects[g] || globalSettings.subject_name || '' })));
                
                if (rosterData.length === 0) {
                  // @ts-ignore
                  const res = await window.api.getRoster();
                  if (res.success) setRosterData(res.data);
                }

                setIsManagingWorkspaces(true); 
              }}
              className="bg-transparent border-2 border-dashed border-white/10 hover:bg-white/5 hover:border-teal-400/50 hover:-translate-y-2 p-8 rounded-3xl shadow-xl transition-all w-64 group flex flex-col items-center justify-center"
            >
              <Settings className="w-10 h-10 text-gray-500 mb-4 group-hover:scale-110 group-hover:text-teal-400 transition-all" />
              <h2 className="text-xl font-bold text-gray-400 mb-1 group-hover:text-teal-400 transition-all">Manage</h2>
              <p className="text-xs text-gray-600 font-semibold uppercase tracking-widest group-hover:text-teal-400/70 transition-all">Add / Remove</p>
            </button>
          </div>
          

          {Math.ceil((licenseDetails.exp * 1000 - Date.now()) / 86400000) <= 30 && (
            <div className="mt-16 bg-black/30 border border-amber-500/20 p-6 rounded-3xl max-w-3xl mx-auto shadow-2xl relative overflow-hidden group cursor-default">
              <div className="absolute inset-0 bg-amber-500/5 group-hover:bg-amber-500/10 transition-colors pointer-events-none"></div>
              <h3 className="text-lg font-black text-amber-400 mb-6 flex items-center justify-center gap-2">
                <ShieldAlert className="w-5 h-5" /> License Expiring Soon
              </h3>
              <div className="grid grid-cols-4 gap-6 text-left relative z-10">
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Plan Type</p>
                  <p className="text-white font-bold capitalize">{licenseDetails.plan} License</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Status</p>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-400 text-xs font-bold border border-amber-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span> Action Required
                  </span>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Expiration Date</p>
                  <p className="text-gray-300 text-sm font-semibold">{new Date(licenseDetails.exp * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Days Remaining</p>
                  <p className="text-amber-400 text-sm font-black">{Math.max(0, Math.ceil((licenseDetails.exp * 1000 - Date.now()) / 86400000))} days left</p>
                </div>
              </div>
            </div>
          )}
          
        </div>

        {/* 🚀 NEW: Manage Workspaces Modal */}
        {isManagingWorkspaces && (
          <div className="fixed inset-0 bg-[#020617]/95 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center p-6 border-b border-white/10 shrink-0">
                <h2 className="text-2xl font-black text-teal-400 flex items-center gap-3"><Settings className="w-6 h-6" /> Manage Workspaces</h2>
                <button onClick={() => setIsManagingWorkspaces(false)} className="text-gray-400 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-8 overflow-y-auto flex-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#475569 transparent' }}>
                <p className="text-gray-400 mb-6 text-sm">Add custom workspaces (e.g., "Grade 10", "Section A", "Morning Class") and assign the specific subject you teach them.</p>
                
                <div className="flex flex-col gap-3">
                  {manageWorkspaces.map((workspace, index) => (
                    <div key={index} className="flex gap-3 items-center bg-black/20 p-3 rounded-xl border border-white/5">
                      <div className="flex-1">
                        <label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block tracking-wider">Workspace ID / Name</label>
                        <input 
                          type="text" 
                          placeholder="e.g., 10" 
                          value={workspace.id} 
                          onChange={(e) => {
                            const newWs = [...manageWorkspaces];
                            newWs[index].id = e.target.value;
                            setManageWorkspaces(newWs);
                          }} 
                          className="w-full bg-black/30 border border-white/10 text-white p-2.5 rounded-lg focus:outline-none focus:border-teal-500 transition-colors text-sm font-bold" 
                        />
                      </div>
                      <div className="flex-[2]">
                        <label className="text-[10px] text-gray-400 font-bold uppercase mb-1 block tracking-wider">Subject Taught</label>
                        <input 
                          type="text" 
                          placeholder="e.g., Anatomy" 
                          value={workspace.subject} 
                          onChange={(e) => {
                            const newWs = [...manageWorkspaces];
                            newWs[index].subject = e.target.value;
                            setManageWorkspaces(newWs);
                          }} 
                          className="w-full bg-black/30 border border-white/10 text-white p-2.5 rounded-lg focus:outline-none focus:border-teal-500 transition-colors text-sm" 
                        />
                      </div>
                      <button 
                        onClick={async () => {
                          const { confirm } = await import('@tauri-apps/plugin-dialog');
                          const yes = await confirm(
                            `Are you sure you want to remove workspace "${workspace.id || 'Blank'}" from your dashboard?\n\n(Note: This will only hide the workspace. Student data and attendance records will NOT be deleted from the database.)`,
                            { title: 'Remove Workspace?', kind: 'warning' }
                          );
                          
                          if (yes) {
                            const newWs = [...manageWorkspaces];
                            newWs.splice(index, 1);
                            setManageWorkspaces(newWs);
                          }
                        }}
                        className="mt-5 p-2.5 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                        title="Remove Workspace"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                  
                  <button 
                    onClick={() => setManageWorkspaces([...manageWorkspaces, { id: '', subject: '' }])}
                    className="w-full mt-2 border border-dashed border-white/20 hover:border-teal-400/50 text-gray-400 hover:text-teal-400 p-4 rounded-xl transition-colors font-bold text-sm flex items-center justify-center gap-2"
                  >
                    + Add New Workspace
                  </button>
                  
                  {(() => {
                    const activeIds = manageWorkspaces.map(w => w.id.trim().toLowerCase());
                    const allGradesInDb = Array.from(new Set(rosterData.map(s => s.grade.trim())));
                    const orphanedGrades = allGradesInDb.filter(g => !activeIds.includes(g.toLowerCase()) && g !== '');
                    
                    if (orphanedGrades.length === 0) return null;
                    
                    return (
                      <div className="mt-4 bg-indigo-500/10 border border-indigo-500/30 p-5 rounded-xl">
                        <p className="text-indigo-400 text-sm font-bold mb-2 flex items-center gap-2"><GraduationCap className="w-4 h-4" /> Hidden Workspaces Detected</p>
                        <p className="text-gray-400 text-xs mb-4">We found students in the database belonging to workspaces that are currently hidden from your dashboard. Click to restore them.</p>
                        <div className="flex flex-wrap gap-2">
                          {orphanedGrades.map(g => (
                            <button
                              key={g}
                              onClick={() => {
                                let oldSubjects: any = {};
                                try { oldSubjects = JSON.parse(globalSettings.subject_name || '{}'); } catch(e) {}
                                setManageWorkspaces([...manageWorkspaces, { id: g, subject: oldSubjects[g] || 'Restored Workspace' }]);
                              }}
                              className="bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 px-3 py-2 rounded-lg text-xs font-bold transition-all border border-indigo-500/30 shadow-sm"
                            >
                              Restore "{g}"
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
              <div className="p-6 border-t border-white/10 bg-black/20 flex justify-end gap-3 shrink-0">
                <button onClick={() => setIsManagingWorkspaces(false)} className="px-6 py-3 rounded-xl font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-all">Cancel</button>
                <button 
                  onClick={async () => {
                    const validWorkspaces = manageWorkspaces.filter(w => w.id.trim() !== '');
                    if (validWorkspaces.length === 0) return toast.error("You must have at least one valid workspace with an ID!");
                    
                    const newGrades = validWorkspaces.map(w => w.id.trim());
                    // Check for duplicates
                    if (new Set(newGrades).size !== newGrades.length) return toast.error("Workspace IDs must be unique!");

                    let oldSubjects: any = {};
                    try { oldSubjects = JSON.parse(globalSettings.subject_name || '{}'); } catch(e) {}
                    
                    // Merge new changes on top of the old dictionary so we never permanently lose a deleted workspace's subject name
                    const newSubjects: Record<string, string> = { ...oldSubjects };
                    validWorkspaces.forEach(w => {
                      newSubjects[w.id.trim()] = w.subject.trim() || oldSubjects[w.id.trim()] || 'Unknown Subject';
                    });

                    const newSettings = { 
                      ...globalSettings, 
                      grades: JSON.stringify(newGrades),
                      subject_name: JSON.stringify(newSubjects)
                    };
                    
                    // @ts-ignore
                    await window.api.saveGlobalSettings(newSettings);
                    setGlobalSettings(newSettings);
                    setIsManagingWorkspaces(false);
                    toast.success("Workspaces updated successfully!");
                  }}
                  className="bg-teal-500 hover:bg-teal-400 text-slate-900 font-black px-8 py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(20,184,166,0.3)]"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
        {welcomeModalNode}
      </div>
    );
  }

  const workspaceTotalStudents = rosterData.filter(s => s.grade === activeWorkspace).length;

  return (
    <div className="bg-slate-900 flex flex-col h-screen w-screen overflow-hidden font-sans text-white relative">
      <TitleBar />
      <div className="flex flex-1 w-full overflow-hidden relative">
      
      <Toaster position="bottom-right" toastOptions={{ style: { background: '#1e293b', color: '#fff', border: '1px solid #334155', padding: '12px 16px' } }}>
        {(t) => (
          <ToastBar toast={t}>
            {({ icon, message }) => (
              <>
                {icon}
                {message}
                {t.type !== 'loading' && (
                  <button 
                    onClick={() => toast.dismiss(t.id)} 
                    className="ml-3 p-1 rounded-md text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors focus:outline-none"
                    title="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </ToastBar>
        )}
      </Toaster>

      {isSessionActive && activeTab !== 'scanner' && (
        <div 
          onClick={() => setActiveTab('scanner')}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-teal-500/30 shadow-[0_0_30px_rgba(20,184,166,0.3)] rounded-full px-6 py-3 flex items-center gap-4 hover:scale-105 transition-all cursor-pointer animate-fade-in"
        >
          <span className="relative flex h-3 w-3">
             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
             <span className="relative inline-flex rounded-full h-3 w-3 bg-teal-500"></span>
          </span>
          <span className="font-bold text-teal-400 text-sm tracking-widest uppercase">Live Session Running</span>
          <span className="bg-teal-500/20 text-teal-300 text-xs px-2.5 py-1 rounded-md font-black">{scannedStudents.length} Scans</span>
        </div>
      )}

      {(!isZenMode || activeTab !== 'scanner') && (
        <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} transition-[width] duration-300 ease-in-out bg-black/40 border-r border-white/10 flex flex-col h-full shrink-0 relative z-20 overflow-hidden`}>
          
          <div className={`p-6 border-b border-white/10 flex flex-col ${!isSidebarOpen ? 'items-center' : ''}`}>
            <div className={`flex items-center w-full ${isSidebarOpen ? 'justify-start gap-4' : 'justify-center'}`}>
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="text-gray-400 hover:text-teal-400 transition-colors p-1 shrink-0"
                title={isSidebarOpen ? "Collapse sidebar" : "Toggle sidebar"}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              {isSidebarOpen && (
                <div className="flex items-center gap-3">
                  <img src="./attendo-icon.png" alt="Attendo Logo" className="w-8 h-8 object-contain shrink-0" />
                  <h1 className="text-2xl font-black text-teal-400 tracking-tight">Attendo</h1>
                </div>
              )}
            </div>
            {isSidebarOpen && (
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest flex items-center gap-2 mt-4 pl-12">
                <GraduationCap className="w-4 h-4" /> Grade {activeWorkspace}
              </p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 relative" style={{ scrollbarWidth: 'none' }}>
            {/* 🚀 NEW: Smooth Sliding Tab Highlight (Now includes Vault) */}
            <div 
              className="absolute left-4 right-4 h-[48px] bg-teal-500/10 border border-teal-500/20 rounded-xl transition-transform duration-300 ease-out z-0 pointer-events-none"
              style={{
                top: '16px', 
                transform: `translateY(calc(${['scanner', 'roster', 'history', 'analytics', 'vault'].indexOf(activeTab)} * (48px + 8px)))` 
              }}
            />

            <button 
              onClick={(e) => { e.currentTarget.blur(); setSearchQuery(''); setActiveTab('scanner'); }}
              title="Scanner"
              className={`w-full flex items-center ${isSidebarOpen ? 'px-4 gap-3' : 'justify-center px-0'} h-[48px] rounded-xl font-bold transition-colors focus:outline-none relative z-10 ${activeTab === 'scanner' ? 'text-teal-400' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              <Video className="w-5 h-5 shrink-0" />
              {isSidebarOpen && <span className="truncate">Scanner</span>}
            </button>
            
            <button 
              onClick={(e) => { e.currentTarget.blur(); setSearchQuery(''); setShowDeleted(false); setActiveTab('roster'); }}
              title="Roster"
              className={`w-full flex items-center ${isSidebarOpen ? 'px-4 gap-3' : 'justify-center px-0'} h-[48px] rounded-xl font-bold transition-colors focus:outline-none relative z-10 ${activeTab === 'roster' ? 'text-teal-400' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              <Users className="w-5 h-5 shrink-0" />
              {isSidebarOpen && <span className="truncate">Roster</span>}
            </button>
            
            <button 
              onClick={(e) => { e.currentTarget.blur(); setSearchQuery(''); setActiveTab('history'); }}
              title="History"
              className={`w-full flex items-center ${isSidebarOpen ? 'px-4 gap-3' : 'justify-center px-0'} h-[48px] rounded-xl font-bold transition-colors focus:outline-none relative z-10 ${activeTab === 'history' ? 'text-teal-400' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              <HistoryIcon className="w-5 h-5 shrink-0" />
              {isSidebarOpen && <span className="truncate">History</span>}
            </button>
            
            <button 
              onClick={(e) => { e.currentTarget.blur(); setSearchQuery(''); setActiveTab('analytics'); }}
              title="Analytics"
              className={`w-full flex items-center ${isSidebarOpen ? 'px-4 gap-3' : 'justify-center px-0'} h-[48px] rounded-xl font-bold transition-colors focus:outline-none relative z-10 ${activeTab === 'analytics' ? 'text-teal-400' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              <BarChart3 className="w-5 h-5 shrink-0" />
              {isSidebarOpen && <span className="truncate">Analytics</span>}
            </button>

            <button 
              onClick={(e) => { e.currentTarget.blur(); setSearchQuery(''); setActiveTab('vault'); }}
              title="System Vault"
              className={`w-full flex items-center ${isSidebarOpen ? 'px-4 gap-3' : 'justify-center px-0'} h-[48px] rounded-xl font-bold transition-colors focus:outline-none relative z-10 ${activeTab === 'vault' ? 'text-teal-400' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              <Database className="w-5 h-5 shrink-0" />
              {isSidebarOpen && <span className="truncate">Vault</span>}
            </button>
          </div>

          <div className="p-4 border-t border-white/10 flex flex-col gap-2">
            <button 
              onClick={() => setShowShortcuts(true)}
              title="Keyboard Shortcuts"
              className={`w-full flex items-center ${isSidebarOpen ? 'px-4 gap-3' : 'justify-center px-0'} py-3 rounded-xl font-bold text-xs text-teal-400 hover:text-teal-300 hover:bg-teal-500/10 transition-all`}
            >
              <Keyboard className="w-5 h-5 shrink-0" />
              {isSidebarOpen && <span className="truncate">Shortcuts</span>}
            </button>
            <button 
              onClick={() => setActiveWorkspace(null)} 
              title="Switch Workspace"
              className={`w-full flex items-center ${isSidebarOpen ? 'px-4 gap-3' : 'justify-center px-0'} py-3 rounded-xl font-bold text-xs text-gray-500 hover:text-white hover:bg-white/5 transition-all`}
            >
              <ArrowLeft className="w-5 h-5 shrink-0" />
              {isSidebarOpen && <span className="truncate">Switch Workspace</span>}
            </button>
            <button 
              onClick={() => setIsAboutOpen(true)} 
              title="About Attendo"
              className={`w-full flex items-center ${isSidebarOpen ? 'px-4 gap-3' : 'justify-center px-0'} py-3 rounded-xl font-bold text-xs text-gray-500 hover:text-white hover:bg-white/5 transition-all`}
            >
              <Info className="w-5 h-5 shrink-0" />
              {isSidebarOpen && <span className="truncate">About</span>}
            </button>
            <button 
              onClick={() => setIsSettingsOpen(true)} 
              title="Global Settings"
              className={`w-full flex items-center ${isSidebarOpen ? 'px-4 gap-3' : 'justify-center px-0'} py-3 rounded-xl font-bold text-xs text-gray-500 hover:text-white hover:bg-white/5 transition-all`}
            >
              <Settings className="w-5 h-5 shrink-0" />
              {isSidebarOpen && <span className="truncate">Settings</span>}
            </button>
            {/* 🚀 NEW: Quiet Institutional Metadata */}
            {isSidebarOpen && globalSettings.university_name && (
              <div className="mt-3 flex flex-col items-center text-center select-none animate-fade-in">
                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest leading-tight opacity-70">
                  {globalSettings.university_name}
                </p>
                <p className="text-[8px] text-gray-600 font-semibold tracking-wider opacity-50 mt-0.5">
                  {globalSettings.faculty_name}
                </p>
              </div>
            )}
          </div>
        </aside>
      )}

      <main className="flex-1 h-full p-4 lg:p-6 overflow-hidden relative">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl h-full rounded-3xl overflow-hidden relative p-6 lg:p-8 flex flex-col">
          
          {licenseWarning.show && (
            <div className="bg-amber-500/20 border border-amber-500/50 rounded-xl p-4 mb-6 flex items-center gap-4 animate-pulse">
              <ShieldAlert className="w-6 h-6 text-amber-500 shrink-0" />
              <div>
                <h3 className="text-amber-400 font-bold text-sm">License Sync Required</h3>
                <p className="text-amber-200/80 text-xs mt-1">Please connect to the internet soon. Your offline access will expire in {licenseWarning.daysLeft} days.</p>
              </div>
            </div>
          )}
          {activeTab === 'scanner' && (
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-8 h-full overflow-hidden">
              <div className="lg:col-span-7 flex flex-col overflow-y-auto h-full pr-2 lg:pr-4 pb-8" style={{ scrollbarWidth: 'thin', scrollbarColor: '#475569 transparent' }}>
                
                {!isSessionActive ? (
                  <>
                    <div className="border-b border-white/10 pb-6 mb-6 flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4 shrink-0">
                      <div>
                        <div className="flex items-center gap-4">
                          <h1 className="text-4xl font-bold text-teal-400 tracking-tight">{getSubjectName()}</h1>
                          <button 
                            onClick={() => setIsMuted(!isMuted)}
                            title={isMuted ? "Unmute Scanner" : "Mute Scanner (Library Mode)"}
                            className={`text-lg p-2 rounded-xl transition-all shadow-inner ${isMuted ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30' : 'bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 border border-teal-500/20'}`}
                          >
                            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                          </button>
                        </div>
                        <p className="text-gray-400 mt-2 italic flex items-center gap-2">
                          Instructor: {globalSettings.instructor_name}
                        </p>
                      </div>
                      
                      <div className="flex flex-wrap gap-3">


                        <button 
                          onClick={() => handleExport('pdf')}
                          disabled={isGenerating || isExporting || scannedStudents.length === 0}
                          className="flex-1 sm:flex-none bg-orange-500 hover:bg-orange-400 text-slate-900 font-bold px-4 py-2.5 rounded-xl text-sm flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(249,115,22,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 whitespace-nowrap"
                        >
                          {isExporting ? <Hourglass className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 
                          {isExporting ? 'Saving...' : 'Export PDF'}
                        </button>

                        <button 
                          onClick={() => handleExport('excel')}
                          disabled={isGenerating || isExporting || scannedStudents.length === 0}
                          className="flex-1 sm:flex-none bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold px-4 py-2.5 rounded-xl text-sm flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 whitespace-nowrap"
                        >
                          {isExporting ? <Hourglass className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 
                          {isExporting ? 'Saving...' : 'Export Excel'}
                        </button>
                      </div>
                    </div>

                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10 mb-6 shrink-0">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-white font-bold text-sm flex items-center gap-2"><Settings className="w-4 h-4" /> Session Configuration</h3>
                        <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${isSessionActive ? 'bg-teal-500/20 text-teal-400' : 'bg-orange-500/20 text-orange-400'}`}>
                          {isSessionActive ? <><Play className="w-3 h-3" fill="currentColor" /> Session Live</> : <><Pause className="w-3 h-3" fill="currentColor" /> Standby</>}
                        </span>
                      </div>

                      {/* 🚀 FIXED: Upgraded to a 4-column grid to include the Group Selector */}
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        <div className="relative">
                          <label className="text-xs text-gray-400 font-bold uppercase mb-1 block">Type</label>
                          <div className="relative">
                            <button 
                              disabled={isSessionActive || scannedStudents.length > 0} 
                              onClick={() => setIsScannerTypeDropdownOpen(!isScannerTypeDropdownOpen)} 
                              className="w-full bg-black/30 border border-white/10 text-white p-2.5 rounded-lg focus:outline-none focus:border-teal-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left flex justify-between items-center"
                            >
                              <span className="truncate">{sessionType}</span>
                              <span className="text-xs">▼</span>
                            </button>
                            {isScannerTypeDropdownOpen && !isSessionActive && scannedStudents.length === 0 && (
                              <div className="absolute top-full left-0 w-full mt-1 bg-slate-800 border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden flex flex-col p-2">
                                {['Lecture', 'Section'].map(type => (
                                  <button
                                    key={type}
                                    onClick={() => { setSessionType(type as 'Lecture'|'Section'); setIsScannerTypeDropdownOpen(false); }}
                                    className="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer w-full text-left"
                                  >
                                    <span className={`text-sm ${sessionType === type ? 'text-teal-400 font-bold' : 'text-white'}`}>{type}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 font-bold uppercase mb-1 block">Group</label>
                          <div className="relative">
                            <button 
                              disabled={isSessionActive || scannedStudents.length > 0} 
                              onClick={() => setIsGroupDropdownOpen(!isGroupDropdownOpen)} 
                              className="w-full bg-black/30 border border-white/10 text-white p-2.5 rounded-lg focus:outline-none focus:border-teal-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left flex justify-between items-center"
                            >
                              <span className="truncate">
                                {sessionGroups.length === 0 || sessionGroups.includes('All Groups') ? 'All Groups' : sessionGroups.map(g => g.replace('Group ', '')).join(' & ')}
                              </span>
                              <span className="text-xs">▼</span>
                            </button>
                            {isGroupDropdownOpen && !isSessionActive && scannedStudents.length === 0 && (
                              <div className="absolute top-full left-0 w-full mt-1 bg-slate-800 border border-white/10 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto p-2">
                                <label className="flex items-center gap-2 p-2 hover:bg-white/5 rounded cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    checked={sessionGroups.includes('All Groups')}
                                    onChange={(e) => {
                                      if (e.target.checked) setSessionGroups(['All Groups']);
                                      else setSessionGroups([]);
                                    }}
                                  />
                                  <span className="text-sm text-white">All Groups</span>
                                </label>
                                {Array.from({ length: parseInt(globalSettings.total_groups || '5') }).map((_, i) => {
                                  const groupLetter = String.fromCharCode(65 + i); 
                                  const gName = `Group ${groupLetter}`;
                                  return (
                                    <label key={gName} className="flex items-center gap-2 p-2 hover:bg-white/5 rounded cursor-pointer">
                                      <input 
                                        type="checkbox" 
                                        checked={sessionGroups.includes(gName) && !sessionGroups.includes('All Groups')}
                                        onChange={(e) => {
                                          let newGroups = sessionGroups.filter(g => g !== 'All Groups');
                                          if (e.target.checked) newGroups.push(gName);
                                          else newGroups = newGroups.filter(g => g !== gName);
                                          if (newGroups.length === 0) newGroups = ['All Groups'];
                                          if (newGroups.length === parseInt(globalSettings.total_groups || '5')) newGroups = ['All Groups'];
                                          setSessionGroups(newGroups);
                                        }}
                                      />
                                      <span className="text-sm text-white">{gName}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 font-bold uppercase mb-1 block">Week</label>
                          <input disabled={isSessionActive || scannedStudents.length > 0} type="number" min="1" value={weekNumber} onChange={e => setWeekNumber(parseInt(e.target.value)||1)} className="w-full bg-black/30 border border-white/10 text-white p-2.5 rounded-lg focus:outline-none focus:border-teal-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 font-bold uppercase mb-1 block">Topic (Optional)</label>
                          <input 
                            id="topic-input"
                            disabled={isSessionActive || scannedStudents.length > 0} 
                            type="text" 
                            placeholder="e.g., General Intro" 
                            defaultValue={sessionTopicRef.current} 
                            onChange={e => { sessionTopicRef.current = e.target.value; }} 
                            className="w-full bg-black/30 border border-white/10 text-white p-2.5 rounded-lg focus:outline-none focus:border-teal-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
                          />
                        </div>
                      </div>

                      <div className="mt-6">
                        <button id="btn-start-session" onClick={handleGlobalStartSession} className="w-full bg-teal-500 hover:bg-teal-400 text-slate-900 font-black py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(20,184,166,0.2)] flex items-center justify-center gap-2">
                          <Play className="w-5 h-5" fill="currentColor" /> Start Session
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-teal-500/10 border border-teal-500/30 rounded-2xl p-6 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0 animate-fade-in">
                    <div>
                      <h2 className="text-2xl font-black text-teal-400 flex items-center gap-3">
                        <span className="relative flex h-4 w-4">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-4 w-4 bg-teal-500"></span>
                        </span>
                        Live Session Active
                      </h2>
                      <p className="text-gray-400 font-medium mt-1">Week {weekNumber} • {sessionType} ({sessionGroups.length === 0 || sessionGroups.includes('All Groups') ? 'All Groups' : 'Group ' + sessionGroups.map(g => g.replace('Group ', '')).join(' & ')}) {sessionTopicRef.current ? `• ${sessionTopicRef.current}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setIsZenMode(!isZenMode)} className="bg-black/30 hover:bg-black/50 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-all border border-white/10 flex items-center gap-2" title="Toggle Zen Mode (Esc to exit)">
                        {isZenMode ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                        {isZenMode ? 'Exit Zen Mode' : 'Zen Mode'}
                      </button>
                      <button 
                        id="btn-end-session" 
                        onClick={handleGlobalEndSession} 
                        disabled={isExporting}
                        className="bg-rose-500 hover:bg-rose-400 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-all shadow-[0_0_15px_rgba(244,63,94,0.2)] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <OctagonX className="w-4 h-4" /> End Session
                      </button>
                    </div>
                  </div>
                )}

                {!isZenMode && (
                  <div className="grid grid-cols-2 gap-6 mb-6 shrink-0">
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                      <h2 className="text-gray-400 text-xs font-bold uppercase tracking-wider">Workspace Students</h2>
                      <p className="text-4xl font-black text-white mt-1">{workspaceTotalStudents}</p>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                      <h2 className="text-gray-400 text-xs font-bold uppercase tracking-wider">Active Attendees</h2>
                      <p className="text-4xl font-black text-teal-400 mt-1">{scannedStudents.length}</p>
                    </div>
                  </div>
                )}

                {isSessionActive && (
                  <>
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10 mb-6 shrink-0 animate-fade-in">
                      {/* 🚀 FIXED: Dual Scanning Mode Engine (Mobile + Webcam Simultaneously) */}
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        
                        {/* LEFT: Mobile Server */}
                        <div className="text-center flex flex-col items-center justify-center bg-black/20 p-4 rounded-2xl border border-white/5 shadow-inner min-h-[140px]">
                          {!scannerUrl ? (
                            <>
                              <Smartphone className="w-8 h-8 text-gray-400 mb-3" />
                              <button onClick={handleStartMobileServer} className="bg-teal-500 hover:bg-teal-400 text-slate-900 font-bold px-4 py-2.5 rounded-xl text-sm transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(20,184,166,0.3)]">
                                <Radio className="w-4 h-4" /> Mobile Hotspot
                              </button>
                              <p className="text-xs text-gray-500 mt-3 max-w-[200px]">Turn phone hotspot on and connect laptop.</p>
                            </>
                          ) : (
                            <div className="flex flex-col items-center justify-center gap-4 w-full animate-fade-in">
                              <div className="bg-white p-2 rounded-xl border-4 border-teal-500 shrink-0">
                                <QRCodeSVG value={typeof scannerUrl === 'string' ? `https://${scannerUrl}:3000` : "127.0.0.1"} size={100} level="H" />
                              </div>
                              <div className="text-center">
                                <h2 className="text-sm font-bold text-teal-400 mb-1 flex items-center justify-center gap-1.5"><Radio className="w-3 h-3 animate-pulse" /> Mobile Server Live</h2>
                                <div className="bg-black/40 px-3 py-1.5 rounded-lg border border-white/5 inline-block text-[10px] font-mono text-teal-300">
                                  {typeof scannerUrl === 'string' ? `https://${scannerUrl}:3000` : "127.0.0.1"}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* RIGHT: Native Webcam */}
                        <div className="text-center flex flex-col items-center justify-center bg-black/20 p-4 rounded-2xl border border-white/5 shadow-inner min-h-[140px]">
                          {!isWebcamActive ? (
                            <>
                              <Laptop className="w-8 h-8 text-gray-400 mb-3" />
                              <button onClick={startWebcam} className="bg-indigo-500/20 hover:bg-indigo-500 text-indigo-400 hover:text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-all flex items-center gap-2 border border-indigo-500/30">
                                <Video className="w-4 h-4" /> Laptop Camera
                              </button>
                              <p className="text-xs text-gray-500 mt-3 max-w-[200px]">Scan students from your webcam.</p>
                            </>
                          ) : (
                            <div className="w-full flex flex-col items-center animate-fade-in">
                              <div className="flex justify-between items-center w-full mb-2 px-2">
                                <h2 className="text-sm font-bold text-indigo-400 flex items-center gap-1.5"><Video className="w-3 h-3" /> Camera Active</h2>
                                <button onClick={stopWebcam} className="text-xs text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-500 px-3 py-1 rounded-lg font-bold transition-colors">Stop Camera</button>
                              </div>
                              <div id="desktop-reader" className="w-full rounded-xl overflow-hidden border-2 border-indigo-500 bg-black"></div>
                            </div>
                          )}
                        </div>

                      </div>
                    </div>

                    <div className="bg-white/5 rounded-2xl p-5 border border-white/10 mb-6 shrink-0 animate-fade-in flex flex-col md:flex-row justify-between items-center gap-4">
                      <div>
                        <h3 className="text-white font-bold mb-1 text-sm flex items-center gap-2"><ListChecks className="w-4 h-4" /> Unified Manual Entry</h3>
                        <p className="text-xs text-gray-400">Log attendance from a paper list, manually type IDs, or paste bulk data from WhatsApp/Excel.</p>
                      </div>
                      <button 
                        onClick={() => { setIsRapidEntryOpen(true); setRapidSelectedIds([]); setRapidSearchQuery(''); }}
                        className="w-full md:w-auto px-4 py-2.5 bg-indigo-500/20 hover:bg-indigo-500 text-indigo-400 hover:text-white border border-indigo-500/30 font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shrink-0"
                      >
                        Open Entry Panel
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className="lg:col-span-3 flex flex-col bg-black/20 rounded-2xl border border-white/10 overflow-hidden h-full shadow-inner">
                <div className="bg-white/5 px-6 py-5 border-b border-white/10 flex justify-between items-center shrink-0">
                <h3 className="text-white font-bold tracking-wide">Live Log</h3>
                <div className="flex items-center gap-3">
                  {scannedStudents.length > 0 && (
                    <>
                      <button 
                        onClick={handleColdCall}
                        className="flex items-center gap-1.5 text-xs bg-indigo-500/20 hover:bg-indigo-500 text-indigo-400 hover:text-white px-4 py-1.5 rounded-xl font-bold transition-all border border-indigo-500/30 hover:shadow-[0_0_15px_rgba(99,102,241,0.4)]"
                      >
                        <Dices className="w-4 h-4" /> Random Call
                      </button>
                    </>
                  )}
                </div>
              </div>
                
                <div className="p-4 flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#2dd4bf transparent' }}>
                  {scannedStudents.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-40">
                      <Smartphone className="w-12 h-12 mb-4 text-gray-400" />
                      <p className="text-white font-medium text-lg">Waiting for scan...</p>
                    </div>
                  ) : (
                    <div className="space-y-3 pb-4">
                      {scannedStudents.map((student, index) => (
                        <div key={`${student.qrPayload}-${index}`} className="flex flex-col relative bg-white/5 p-4 rounded-xl border border-teal-500/20 hover:bg-white/10 transition-colors shadow-sm animate-fade-in group">
                          <div className="flex items-start gap-3 mb-2">
                            <div className="bg-teal-500/20 text-teal-400 w-7 h-7 flex items-center justify-center rounded-full font-bold text-xs shrink-0 mt-0.5">
                              {scannedStudents.length - index}
                            </div>
                            <div className="text-left w-full">
                              <div className="flex items-center gap-2">
                                <p className="text-white font-bold leading-tight text-sm break-words">{student.name}</p>
                                {(() => {
                                  // Cross-reference the student with the pre-loaded analytics state
                                  const stat = analyticsData.find(a => a.national_id === (student.national_id || student.nationalId));
                                  
                                  // If no history exists, assume they are safe (first session)
                                  if (!stat) return <span title="New / No Absences" className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"></span>;
                                  
                                  return (
                                    <span 
                                      title={stat.atRisk ? `At Risk (${stat.absent} absences)` : `Safe (${stat.absent} absences)`} 
                                      className={`w-2 h-2 rounded-full shadow-[0_0_8px_currentColor] ${stat.atRisk ? 'bg-rose-500 text-rose-500 animate-pulse' : 'bg-emerald-400 text-emerald-400'}`} 
                                    ></span>
                                  );
                                })()}
                              </div>
                              <p className="text-gray-400 text-xs font-mono mt-1">{student.national_id || student.nationalId}</p>
                            </div>
                          </div>
                          
                          <div className="flex justify-between items-center mt-2">
                            <button 
                              onClick={() => handleRemoveScan(student.national_id || student.nationalId)}
                              className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-500 px-3 py-1 rounded-lg text-[10px] font-bold transition-all"
                            >
                              <Trash2 className="w-3 h-3" /> Undo
                            </button>
                            
                            <div className={`flex items-center rounded-lg overflow-hidden border transition-all ${student.bonus > 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-black/20 border-white/5 opacity-40 group-hover:opacity-100'}`}>
                              <button 
                                disabled={!(student.bonus > 0)}
                                onClick={() => {
                                  setScannedStudents(prev => prev.map(s => 
                                    (s.national_id || s.nationalId) === (student.national_id || student.nationalId)
                                      ? { ...s, bonus: Math.max(0, (s.bonus || 0) - 1) }
                                      : s
                                  ));
                                }}
                                className="px-2.5 py-1 text-gray-400 hover:text-rose-400 hover:bg-white/10 disabled:opacity-30 transition-all font-black text-sm"
                              >
                                -
                              </button>
                              <span className={`px-1 text-[10px] font-black tracking-wider ${student.bonus > 0 ? 'text-amber-400' : 'text-gray-500'}`}>
                                {student.bonus || 0} XP
                              </span>
                              <button 
                                onClick={() => {
                                  setScannedStudents(prev => prev.map(s => 
                                    (s.national_id || s.nationalId) === (student.national_id || student.nationalId)
                                      ? { ...s, bonus: (s.bonus || 0) + 1 }
                                      : s
                                  ));
                                }}
                                className="px-2.5 py-1 text-gray-400 hover:text-emerald-400 hover:bg-white/10 transition-all font-black text-sm"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'roster' && (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 shrink-0 gap-4">
                <div>
                  <h2 className="text-3xl font-bold text-teal-400">Workspace Roster</h2>
                  <p className="text-gray-400 mt-1">Import new lists and manage enrolled students.</p>
                </div>
                <div className="flex flex-wrap gap-4">
                  <button 
                    onClick={() => setShowDeleted(!showDeleted)}
                    className={`border h-[48px] px-6 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 ${showDeleted ? 'bg-rose-500/20 text-rose-400 border-rose-500/50' : 'bg-transparent text-gray-400 border-white/10 hover:text-white'}`}
                  >
                    {showDeleted ? <><ArrowLeft className="w-4 h-4" />Active Students</> : <><Archive className="w-4 h-4" />Archived Students</>}
                  </button>
                  <div className="bg-white/5 border border-white/10 px-5 h-[48px] rounded-xl min-w-[120px] flex items-center justify-between gap-4">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{showDeleted ? 'Archived' : 'Active'}</p>
                    <p className={`text-xl font-black ${showDeleted ? 'text-rose-400' : 'text-teal-400'}`}>
                      {showDeleted ? filteredDeletedRoster.length : filteredRoster.length}
                    </p>
                  </div>
                </div>
              </div>

              {/* 🚀 FUSED DATA DECK: Controls + Table */}
              <div className="bg-black/20 border border-white/10 rounded-2xl flex flex-col shadow-inner min-h-[400px] flex-1 overflow-hidden mb-6">
                
                {/* Fused Header / Controls Engine */}
                <div className="flex flex-col lg:flex-row gap-4 p-4 border-b border-white/10 bg-[#0f172a] rounded-t-2xl shadow-sm z-20 shrink-0 items-start lg:items-center justify-between">
                  
                  {/* Search Bar */}
                  <div className="relative flex-1 w-full lg:w-auto">
                    <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input 
                      type="text" 
                      placeholder={`Search ${showDeleted ? 'Archived' : 'Active'} Roster...`}
                      value={searchQuery} 
                      onChange={e => setSearchQuery(e.target.value)} 
                      className="w-full bg-black/40 border border-white/10 text-white pl-11 pr-4 py-3 rounded-xl focus:outline-none focus:border-teal-500 transition-colors text-sm font-bold" 
                    />
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto shrink-0">
                    <button 
                      onClick={downloadTemplate}
                      className="bg-black/40 border border-white/10 hover:bg-white/10 text-teal-400 px-4 py-2.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 w-full sm:w-auto text-sm shrink-0"
                    >
                      <FileSpreadsheet className="w-4 h-4" /> Template
                    </button>
                    <div 
                      onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) processFile(file);
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      className={`px-4 py-2.5 rounded-xl transition-all text-center cursor-pointer flex items-center justify-center gap-2 w-full sm:w-auto text-sm ${
                        isDragging ? 'border-2 border-dashed border-teal-400 bg-teal-400/10 text-white' : 'border-2 border-dashed border-white/10 bg-black/40 hover:bg-white/10 text-white'
                      }`}
                    >
                      <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                      <Upload className="w-4 h-4 text-gray-400" />
                      <span className="font-bold">Import CSV</span>
                    </div>
                    
                    <button 
                      onClick={handleGenerateCards}
                      disabled={isGenerating || isExporting}
                      className={`font-bold px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 w-full sm:w-auto cursor-pointer text-sm border ${
                        isGenerating || isExporting
                          ? 'border-white/10 text-gray-500 cursor-not-allowed bg-black/40'
                          : 'border-teal-500/50 text-teal-400 hover:bg-teal-500/10 hover:border-teal-400 bg-black/40'
                      }`}
                    >
                      {isGenerating ? <Package className="w-4 h-4" /> : <QrCode className="w-4 h-4" />} 
                      {isGenerating ? 'Bundling...' : 'Download QRs'}
                    </button>

                    <button 
                      onClick={() => setIsAddStudentOpen(true)}
                      className="bg-teal-500 hover:bg-teal-400 text-slate-900 font-bold px-4 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(20,184,166,0.2)] flex items-center justify-center gap-2 w-full sm:w-auto cursor-pointer text-sm"
                    >
                      <UserPlus className="w-4 h-4" /> Add Student
                    </button>
                  </div>

                </div>

                <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#475569 transparent' }}>
                  <div className="sticky top-0 z-10 grid grid-cols-12 gap-4 px-4 py-3 border-b border-white/10 bg-[#0f172a] font-bold text-gray-400 text-[11px] uppercase tracking-wider items-center shadow-sm">
                  <div className="col-span-8 flex items-center gap-4 text-left pl-4">
                    <input 
                      type="checkbox" 
                      onChange={(e) => e.target.checked ? setSelectedStudents(currentRosterList.map(s => s.national_id || s.nationalId)) : setSelectedStudents([])}
                      checked={selectedStudents.length === currentRosterList.length && currentRosterList.length > 0}
                      className={`w-4 h-4 bg-black/30 border-white/10 cursor-pointer ${showDeleted ? 'accent-rose-500' : 'accent-teal-500'}`}
                    />
                    {selectedStudents.length > 0 ? (
                      <div className="flex items-center gap-2">
                        <span className="text-teal-400 text-xs font-bold uppercase tracking-widest bg-teal-500/10 px-3 py-1.5 rounded-lg border border-teal-500/20">{selectedStudents.length} Selected</span>
                        {!showDeleted ? (
                          <button onClick={handleBulkArchive} className="bg-rose-500/20 hover:bg-rose-500 hover:text-white text-rose-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-rose-500/30 shadow-sm">Archive</button>
                        ) : (
                          <>
                            <button onClick={handleBulkRestore} className="bg-teal-500/20 hover:bg-teal-500 hover:text-slate-900 text-teal-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-teal-500/30 shadow-sm">Restore</button>
                            <button onClick={handleBulkDeleteStudents} className="bg-rose-500 hover:bg-rose-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm">Delete Permanently</button>
                          </>
                        )}
                      </div>
                    ) : (
                      <span>SELECT ALL (Right-Click for Actions)</span>
                    )}
                  </div>
                  <div className="col-span-4 text-right pr-4">
                    <span>Grade</span>
                  </div>
                </div>
                
                <div className="p-2">
                  {currentRosterList.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-40 py-12">
                      <Inbox className="w-16 h-16 mb-4 text-gray-400" />
                      <h3 className="text-xl font-bold text-white mb-1">Roster is Empty</h3>
                      <p className="text-sm text-gray-400">Import a CSV file to populate Grade {activeWorkspace}.</p>
                    </div>
                  ) : (
                    currentRosterList.map((s, i) => (
                      <div 
                        key={i} 
                        id={`student-row-${i}`}
                        onContextMenu={(e) => handleContextMenu(e, s)}
                        onClick={(e) => {
                          const studentId = s.national_id || s.nationalId;
                          setSelectedStudents(prev => 
                            prev.includes(studentId) 
                              ? prev.filter(id => id !== studentId)
                              : [...prev, studentId]
                          );
                          lastSelectedIndexRef.current = i;
                        }}
                        className={`group grid grid-cols-12 gap-4 p-4 mb-2 items-center rounded-xl border transition-all duration-200 cursor-pointer ${
                          selectedStudents.includes(s.national_id || s.nationalId)
                            ? 'bg-teal-900/20 border-teal-500/30' 
                            : showDeleted 
                              ? 'bg-rose-950/20 border-rose-900/30 hover:border-rose-500/50' 
                              : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/20'
                        } ${focusedIndex === i ? 'ring-2 ring-teal-400 bg-white/10 shadow-[0_0_15px_rgba(45,212,191,0.2)] scale-[1.01]' : ''}`}
                      >
                        <div className="col-span-8 flex items-center gap-4 text-left">
                          <input 
                            type="checkbox" 
                            checked={selectedStudents.includes(s.national_id || s.nationalId)}
                            onClick={(e) => {
                              e.stopPropagation();
                              const target = e.target as HTMLInputElement;
                              const isChecked = target.checked;
                              const studentId = s.national_id || s.nationalId;
                              if (e.shiftKey && lastSelectedIndexRef.current !== null) {
                                const start = Math.min(lastSelectedIndexRef.current, i);
                                const end = Math.max(lastSelectedIndexRef.current, i);
                                const batchIds = currentRosterList.slice(start, end + 1).map(st => st.national_id || st.nationalId);
                                if (isChecked) setSelectedStudents(prev => Array.from(new Set([...prev, ...batchIds])));
                                else setSelectedStudents(prev => prev.filter(id => !batchIds.includes(id)));
                              } else {
                                if (isChecked) setSelectedStudents(prev => [...prev, studentId]);
                                else setSelectedStudents(prev => prev.filter(id => id !== studentId));
                              }
                              lastSelectedIndexRef.current = i; 
                            }}
                            onChange={() => {}} 
                            className={`w-4 h-4 bg-black/30 border-white/10 cursor-pointer shrink-0 ${showDeleted ? 'accent-rose-500' : 'accent-teal-500'}`}
                          />
                          <div className="flex-1 min-w-0">
                          {editingStudentId === (s.national_id || s.nationalId) && !showDeleted ? (
                            <input 
                              autoFocus
                              type="text" 
                              value={editNameValue} 
                              onChange={e => setEditNameValue(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              onBlur={() => handleUpdateStudentName(s.national_id || s.nationalId)}
                              onKeyDown={e => { 
                                if (e.key === 'Enter') handleUpdateStudentName(s.national_id || s.nationalId); 
                                if (e.key === 'Escape') setEditingStudentId(null); 
                              }}
                              className="bg-black/50 border border-teal-500 text-white text-sm font-bold px-2 py-0.5 rounded outline-none w-full shadow-inner mb-1"
                            />
                          ) : (
                            <p className={`font-bold text-sm truncate ${showDeleted ? 'text-gray-400 line-through' : 'text-white transition-colors'}`}>
                              {s.name}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 font-mono mt-0.5">{s.national_id || s.nationalId}</p>
                          </div>
                        </div>
                        <div className="col-span-4 text-right pr-4 text-xs font-semibold text-gray-400">{s.grade}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="flex flex-col h-full overflow-hidden">
              {!auditingSession ? (
                <>
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 shrink-0 gap-4">
                    <div>
                      <h2 className="text-3xl font-bold text-teal-400">Workspace History</h2>
                      <p className="text-gray-400 mt-1">Manage and edit past attendance sessions.</p>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <button 
                        onClick={() => setShowArchivedSessions(!showArchivedSessions)}
                        className={`border h-[48px] px-6 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 ${showArchivedSessions ? 'bg-rose-500/20 text-rose-400 border-rose-500/50' : 'bg-transparent text-gray-400 border-white/10 hover:text-white'}`}
                      >
                        {showArchivedSessions ? <><ArrowLeft className="w-4 h-4" />Active Sessions</> : <><Archive className="w-4 h-4" />Archived Sessions</>}
                      </button>
                    </div>
                  </div>

                  {/* 🚀 FUSED DATA DECK: Controls + Table */}
                  <div className="bg-black/20 border border-white/10 rounded-2xl flex flex-col shadow-inner min-h-[400px] flex-1 overflow-hidden mb-6">
                    
                    {/* Fused Header / Controls Engine */}
                    <div className="flex flex-col lg:flex-row gap-4 p-4 border-b border-white/10 bg-[#0f172a] rounded-t-2xl shadow-sm z-20 shrink-0">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input 
                          type="text" 
                          placeholder={`Search ${showArchivedSessions ? 'Archived' : 'Active'} sessions...`}
                          value={searchQuery} 
                          onChange={e => setSearchQuery(e.target.value)} 
                          className="w-full bg-black/40 border border-white/10 text-white pl-11 pr-4 py-3 rounded-xl focus:outline-none focus:border-teal-500 transition-colors text-sm font-bold" 
                        />
                      </div>
                      
                      <div className="flex gap-4">
                        <div className="flex items-center gap-4 bg-black/40 px-4 py-2 rounded-xl border border-white/10">
                          <input 
                            type="checkbox" 
                            onChange={(e) => e.target.checked ? setSelectedSessions(filteredHistory.map(s => s.session_name)) : setSelectedSessions([])}
                            checked={selectedSessions.length === filteredHistory.length && filteredHistory.length > 0}
                            className={`w-4 h-4 bg-black/30 border-white/10 cursor-pointer ${showArchivedSessions ? 'accent-rose-500' : 'accent-teal-500'}`}
                          />
                          <div className="flex items-center justify-between min-w-[120px]">
                            {selectedSessions.length > 0 ? (
                              <div className="flex items-center gap-2">
                                <span className="text-teal-400 text-[10px] font-bold uppercase tracking-widest">{selectedSessions.length} Selected</span>
                                {!showArchivedSessions ? (
                                  <button onClick={handleBulkArchiveSessions} className="bg-rose-500/20 hover:bg-rose-500 hover:text-white text-rose-400 px-3 py-1 rounded-lg text-xs font-bold transition-all border border-rose-500/30">Archive</button>
                                ) : (
                                  <>
                                    <button onClick={handleBulkRestoreSessions} className="bg-teal-500/20 hover:bg-teal-500 hover:text-slate-900 text-teal-400 px-3 py-1 rounded-lg text-xs font-bold transition-all border border-teal-500/30">Restore</button>
                                    <button onClick={handleBulkDeleteSessions} className="bg-red-500/20 hover:bg-red-600 hover:text-white text-red-400 px-3 py-1 rounded-lg text-xs font-bold transition-all border border-red-500/30">Delete</button>
                                  </>
                                )}
                              </div>
                            ) : (
                              <span className="font-bold text-gray-400 text-[10px] uppercase tracking-wider">SELECT ALL</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 bg-black/40 px-4 py-2.5 rounded-xl border border-white/10 min-w-[140px]">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Type:</label>
                          <div className="relative flex-1">
                            <button 
                              onClick={() => setIsHistoryTypeDropdownOpen(!isHistoryTypeDropdownOpen)} 
                              className="w-full bg-transparent text-white focus:outline-none cursor-pointer flex justify-between items-center text-sm font-bold"
                            >
                              <span className="truncate">{historyTypeFilter === 'All' ? 'All Sessions' : historyTypeFilter + 's'}</span>
                              <span className="text-[10px] text-gray-400 ml-2">▼</span>
                            </button>
                            {isHistoryTypeDropdownOpen && (
                              <div className="absolute top-full right-0 w-full mt-2 bg-slate-800 border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden flex flex-col p-2 min-w-[140px]">
                                {['All', 'Lecture', 'Section'].map(type => (
                                  <button
                                    key={type}
                                    onClick={() => { setHistoryTypeFilter(type as any); setIsHistoryTypeDropdownOpen(false); }}
                                    className="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer w-full text-left"
                                  >
                                    <span className={`text-sm ${historyTypeFilter === type ? 'text-teal-400 font-bold' : 'text-white'}`}>{type === 'All' ? 'All Sessions' : type + 's'}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#475569 transparent' }}>
                      <div className="sticky top-0 z-10 grid grid-cols-12 gap-4 px-4 py-3 border-b border-white/10 bg-[#0f172a] font-bold text-gray-400 text-[11px] uppercase tracking-wider items-center shadow-sm">
                        <div className="col-span-4 pl-8">Session</div>
                        <div className="col-span-2 text-center">Date</div>
                        <div className="col-span-2 text-center">Attendees</div>
                        <div className="col-span-4 text-center">Actions</div>
                      </div>

                      <div className="p-2">
                      {filteredHistory.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-40 py-12">
                          <Clock className="w-16 h-16 mb-4 text-gray-400" />
                          <h3 className="text-xl font-bold text-white mb-1">No Session History</h3>
                          <p className="text-sm text-gray-400">Start scanning to build your timeline.</p>
                        </div>
                      ) : (
                        <>
                          {filteredHistory.map((s, i) => {
                            return (
                            <Fragment key={i}>
                              <div 
                                id={`session-row-${i}`}
                                onClick={() => {
                                  setSelectedSessions(prev => 
                                    prev.includes(s.session_name) 
                                      ? prev.filter(name => name !== s.session_name)
                                      : [...prev, s.session_name]
                                  );
                                }}
                                className={`group grid grid-cols-12 gap-4 p-4 mb-2 items-center rounded-xl border transition-all duration-200 cursor-pointer ${focusedIndex === i ? 'ring-2 ring-teal-400 bg-white/10 shadow-[0_0_15px_rgba(45,212,191,0.2)] scale-[1.01]' : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/20'} ${selectedSessions.includes(s.session_name) ? 'bg-teal-900/20 border-teal-500/30' : ''}`}
                              >
                              {/* 🚀 FIXED: Native Checkbox with Shift-Click Batching! */}
                              <div className="col-span-4 flex items-center gap-4 text-left">
                                <input 
                                  type="checkbox" 
                                  checked={selectedSessions.includes(s.session_name)}
                                  onChange={() => {}} 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const target = e.target as HTMLInputElement;
                                    const isChecked = target.checked;
                                    
                                    if (e.shiftKey && lastSelectedIndexRef.current !== null) {
                                      const start = Math.min(lastSelectedIndexRef.current, i);
                                      const end = Math.max(lastSelectedIndexRef.current, i);
                                      const batchNames = filteredHistory.slice(start, end + 1).map(st => st.session_name);
                                      if (isChecked) setSelectedSessions(prev => Array.from(new Set([...prev, ...batchNames])));
                                      else setSelectedSessions(prev => prev.filter(name => !batchNames.includes(name)));
                                    } else {
                                      if (isChecked) setSelectedSessions(prev => [...prev, s.session_name]);
                                      else setSelectedSessions(prev => prev.filter(name => name !== s.session_name));
                                    }
                                    lastSelectedIndexRef.current = i; 
                                  }}
                                  className={`w-4 h-4 bg-black/30 border-white/10 cursor-pointer shrink-0 ${showArchivedSessions ? 'accent-rose-500' : 'accent-teal-500'}`}
                                />
                                
                                {(() => {
                                  let displayName = s.session_name;
                                  const parts = s.session_name.split(' - ');
                                  
                                  // Base format is at least 5 parts: [Grade] Subj - Semester - Week X - Type - Group
                                  if (parts.length === 5) {
                                    const week = parts[2];
                                    const groups = parts[4];
                                    displayName = `${week} - ${groups}`;
                                  } else if (parts.length >= 6) {
                                    const week = parts[2];
                                    const groups = parts[parts.length - 1];
                                    const topic = parts.slice(4, parts.length - 1).join(' - ');
                                    displayName = `${topic} - ${week} - ${groups}`;
                                  }

                                  return (
                                    <h4 className="text-white font-bold text-sm truncate" title={displayName}>{displayName}</h4>
                                  );
                                })()}
                              </div>
                              
                              <div className="col-span-2 text-center text-sm text-gray-400 font-mono">
                                {new Date(s.date).toLocaleDateString()}
                              </div>

                              <div className="col-span-2 flex justify-center items-center">
                                <span className="font-bold text-teal-400">{s.total_attendees}</span>
                              </div>
                              
                              <div className="col-span-4 flex items-center justify-end gap-2 w-full">
                              {!showArchivedSessions ? (
                                <>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); openAuditLedger(s); }} 
                                    className="flex-1 md:flex-none bg-teal-500/10 hover:bg-teal-500 text-teal-400 hover:text-slate-900 font-bold text-sm px-6 py-2.5 rounded-xl transition-all duration-200 border border-teal-500/20 shadow-sm flex items-center justify-center gap-2"
                                  >
                                    <ListChecks className="w-4 h-4" /> Edit Session
                                  </button>
                                  <button 
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      // @ts-ignore
                                      const res = await window.api.archiveSession(s.session_name);
                                      if (res.success) { toast.success('Session Archived'); fetchHistory(); fetchStats(); }
                                    }} 
                                    className="bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-all duration-200 border border-rose-500/20 flex items-center justify-center"
                                    title="Archive Session"
                                  >
                                    <Archive className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button 
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      // @ts-ignore
                                      const res = await window.api.restoreSession(s.session_name);
                                      if (res.success) { toast.success('Session Restored'); fetchHistory(); fetchStats(); }
                                    }} 
                                    className="flex-1 md:flex-none bg-indigo-500/10 hover:bg-indigo-500 text-indigo-400 hover:text-white font-bold text-sm px-6 py-2.5 rounded-xl transition-all duration-200 border border-indigo-500/20 shadow-sm flex items-center justify-center gap-2"
                                  >
                                    <RefreshCw className="w-4 h-4" /> Restore Session
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.session_name); }} 
                                    className="bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-all duration-200 border border-rose-500/20 flex items-center justify-center"
                                    title="Permanently Delete Session"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          </Fragment>
                        );})}
                      </>
                    )}
                    </div>
                    </div>
                  </div>
                </>
              ) : (
                /* 🚀 STEP 2 & 3: THE AUDIT LEDGER */
                <div className="flex flex-col h-full animate-fade-in">
                  <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6 shrink-0 border-b border-white/10 pb-6 w-full">
                    <div className="flex items-center gap-4">
                      <button onClick={closeAuditLedger} className="bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 p-3 rounded-xl transition-all"><ArrowLeft className="w-5 h-5" /></button>
                      <div>
                        <h2 className="text-2xl font-black text-teal-400 flex items-center gap-3">Session Audit <span className="bg-teal-500/20 text-teal-300 text-[10px] uppercase tracking-widest px-3 py-1 rounded-full border border-teal-500/30">Edit Mode</span></h2>
                        <p className="text-gray-400 text-sm mt-1">{auditingSession.session_name}</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                      <div className="relative w-full sm:w-80">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input type="text" placeholder="Search roster to add missing student..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-black/30 border border-white/10 text-white pl-9 pr-3 py-2.5 rounded-xl focus:outline-none focus:border-teal-500 text-sm transition-colors" />
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto shrink-0">
                        <button onClick={() => handleReExportSession('pdf')} disabled={isExporting} className="flex-1 sm:flex-none bg-orange-500 hover:bg-orange-400 text-slate-900 font-bold px-4 py-2.5 rounded-xl text-sm flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(249,115,22,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 whitespace-nowrap">
                          {isExporting ? <Hourglass className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Export PDF
                        </button>
                        <button onClick={() => handleReExportSession('excel')} disabled={isExporting} className="flex-1 sm:flex-none bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold px-4 py-2.5 rounded-xl text-sm flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 whitespace-nowrap">
                          {isExporting ? <Hourglass className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Export Excel
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto bg-black/20 border border-white/10 rounded-2xl relative" style={{ scrollbarWidth: 'thin', scrollbarColor: '#475569 transparent' }}>
                    <div className="sticky top-0 z-10 grid grid-cols-12 gap-4 p-4 border-b border-white/10 bg-[#0f172a] font-bold text-gray-400 text-sm uppercase tracking-wider items-center shadow-sm">
                      <div className="col-span-5">Student Name</div>
                      <div className="col-span-2 text-center">ID</div>
                      <div className="col-span-2 text-center">Bonus Points</div>
                      <div className="col-span-3 text-right pr-4">Attendance</div>
                    </div>
                    
                    <div className="p-2">
                      {sessionDetails.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 opacity-50">
                          <Hourglass className="w-10 h-10 text-teal-400 animate-spin mb-4" />
                          <p className="text-white font-bold">Awaiting Backend Records...</p>
                        </div>
                      ) : (
                        sessionDetails
                          .filter(s => {
                            // If searching, show EVERYONE so user can find and add missing students
                            if (debouncedSearchQuery.trim() !== '') {
                              return s.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) || s.national_id.includes(debouncedSearchQuery);
                            }
                            // Otherwise, ONLY show students who actually attended or are excused
                            return s.present || s.is_excused;
                          })
                          .map((student, i) => (
                          <div key={i} className="grid grid-cols-12 gap-4 p-3 mb-2 items-center rounded-xl bg-white/5 border border-transparent hover:bg-white/10 transition-colors">
                            <div className="col-span-5">
                              <p className="font-bold text-white text-sm truncate" title={student.name}>{student.name}</p>
                            </div>
                            <div className="col-span-2 text-center">
                              <p className="text-xs text-gray-500 font-mono">{student.national_id}</p>
                            </div>
                            <div className="col-span-2 flex justify-center items-center gap-3">
                              {/* 🚀 FIXED: Bonus Counter now disables and fades out if the student is not present! */}
                              <div className={`flex items-center gap-1 bg-black/40 px-2 py-1 rounded-lg border border-white/5 transition-opacity ${!student.present ? 'opacity-30 pointer-events-none grayscale' : ''}`}>
                                <button onClick={() => handleUpdateBonus(student.national_id, student.bonus_points, -1)} className="text-gray-500 hover:text-rose-400 font-black px-1.5">-</button>
                                <span className={`text-xs font-black w-3 text-center ${student.bonus_points > 0 ? 'text-amber-400' : 'text-gray-500'}`}>{student.bonus_points}</span>
                                <button onClick={() => handleUpdateBonus(student.national_id, student.bonus_points, 1)} className="text-gray-500 hover:text-emerald-400 font-black px-1.5">+</button>
                              </div>
                            </div>
                            <div className="col-span-3 flex justify-end gap-2">
                              {/* 🚀 FIXED: Granular Excuse Dropdown & Audit Trail */}
                              {!student.present && (
                                <div className="relative">
                                  <button
                                    onClick={() => student.is_excused ? handleToggleExcuse(student.national_id, true) : setExcuseMenuOpenFor(student.national_id)}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${student.is_excused ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.2)]' : 'bg-black/30 text-gray-500 border-white/5 hover:bg-white/5 hover:text-gray-300'}`}
                                  >
                                    {student.is_excused ? `Excused: ${student.excuse_reason || 'Other'}` : 'Add Excuse'}
                                  </button>
                                  
                                  {excuseMenuOpenFor === student.national_id && (
                                    <div className="absolute right-0 top-full mt-2 w-40 bg-[#0f172a] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in">
                                      <div className="p-2 border-b border-white/10"><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Select Reason</p></div>
                                      <button onClick={() => handleToggleExcuse(student.national_id, false, 'Medical')} className="w-full text-left px-4 py-2 text-xs font-bold text-gray-300 hover:bg-indigo-500/20 hover:text-indigo-400 transition-colors">Medical (Clinic)</button>
                                      <button onClick={() => handleToggleExcuse(student.national_id, false, 'Athletic')} className="w-full text-left px-4 py-2 text-xs font-bold text-gray-300 hover:bg-indigo-500/20 hover:text-indigo-400 transition-colors">Athletic Event</button>
                                      <button onClick={() => handleToggleExcuse(student.national_id, false, 'Administrative')} className="w-full text-left px-4 py-2 text-xs font-bold text-gray-300 hover:bg-indigo-500/20 hover:text-indigo-400 transition-colors">Administrative</button>
                                      <button onClick={() => handleToggleExcuse(student.national_id, false, 'Other')} className="w-full text-left px-4 py-2 text-xs font-bold text-gray-300 hover:bg-indigo-500/20 hover:text-indigo-400 transition-colors">Other</button>
                                    </div>
                                  )}
                                </div>
                              )}
                              {/* Attendance Button */}
                              <button
                                onClick={() => handleToggleAttendance(student.national_id, student.present)}
                                className={`w-20 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${student.present ? 'bg-teal-500/20 text-teal-400 border-teal-500/30 shadow-[0_0_10px_rgba(45,212,191,0.2)]' : 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500 hover:text-white'}`}
                              >
                                {student.present ? 'Present' : 'Absent'}
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="flex flex-col h-full overflow-hidden animate-fade-in">
              
              {/* 🚀 HEADER & SEGMENTED HOVER TIMELINE */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 shrink-0 gap-4 border-b border-white/10 pb-5">
                <div className="flex-1 w-full">
                  <h2 className="text-3xl font-bold text-teal-400 mb-1">Workspace Analytics</h2>
                  {/* @ts-ignore */}
                  {semesterTimeline ? (
                    <div className="flex items-center gap-4 mt-3 max-w-xl">
                      <div className="flex-1 flex gap-1 h-2.5">
                        {/* @ts-ignore */}
                        {semesterTimeline.weeks.map((week: any, idx: number) => (
                          <div key={idx} className="flex-1 relative group cursor-pointer h-full rounded-full bg-white/10 border border-white/5 transition-all hover:scale-y-150 hover:bg-white/20">
                            <div 
                              className={`absolute inset-0 rounded-full transition-all ${week.isPast ? 'bg-teal-500/80' : week.isCurrent ? 'bg-teal-400 shadow-[0_0_8px_#2dd4bf] animate-pulse' : 'bg-transparent'}`}
                            />
                            {/* 🚀 FIXED: Expanded boundary logic. The first 3 and last 3 weeks lock to their respective edges! */}
                            <div className={`absolute top-full mt-3 ${idx < 3 ? 'left-0' : idx > semesterTimeline.weeks.length - 4 ? 'right-0' : 'left-1/2 -translate-x-1/2'} opacity-0 group-hover:opacity-100 bg-[#0f172a] border border-white/20 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg shadow-[0_10px_25px_rgba(0,0,0,0.5)] pointer-events-none transition-opacity z-[100] whitespace-nowrap`}>
                              <span className={week.isCurrent ? 'text-teal-400' : 'text-gray-300'}>Week {week.weekNum}</span>
                              <span className="text-gray-500 mx-2">|</span> 
                              {week.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs font-black text-teal-400 uppercase tracking-widest shrink-0">
                        {/* @ts-ignore */}
                        {Math.round(semesterTimeline.progress)}%
                      </p>
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm mt-1">Identify at-risk students and visualize sessions.</p>
                  )}
                </div>
                <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                  <button 
                    onClick={handleExportMasterPDF} 
                    disabled={isExporting || analyticsData.length === 0} 
                    className="flex-1 sm:flex-none bg-orange-500 hover:bg-orange-400 text-slate-900 font-bold px-4 py-2.5 rounded-xl text-sm flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(249,115,22,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 whitespace-nowrap"
                  >
                    {isExporting ? <Hourglass className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} 
                    Export PDF
                  </button>
                  <button 
                    onClick={handleExportMaster} 
                    disabled={isExporting || analyticsData.length === 0} 
                    className="flex-1 sm:flex-none bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold px-4 py-2.5 rounded-xl text-sm flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 whitespace-nowrap"
                  >
                    {isExporting ? <Hourglass className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} 
                    Export Excel
                  </button>
                </div>
              </div>

              {/* 🚀 SCROLLABLE BODY (BENTO BOX LAYOUT) */}
              <div className="flex-1 overflow-y-auto pr-2 space-y-6 pb-8" style={{ scrollbarWidth: 'thin', scrollbarColor: '#475569 transparent' }}>
                
                {/* 🚀 BENTO DECK: Charts & Stats Fusion */}
                <div id="analytics-charts-deck" className="grid grid-cols-1 xl:grid-cols-3 gap-6 shrink-0 h-auto xl:h-[280px]">
                  
                  {/* BENTO LEFT: Area Chart */}
                  <div className="xl:col-span-2 bg-black/20 border border-white/10 rounded-2xl p-5 flex flex-col shadow-inner relative min-h-[280px]">
                    <h3 className="text-sm font-bold text-gray-400 mb-4 uppercase tracking-wider text-center">Session Turnout Trend</h3>
                    {barData.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center opacity-30">
                        <BarChart3 className="w-12 h-12 mb-3 text-gray-400" />
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No Sessions</p>
                      </div>
                    ) : (
                      <div className="flex-1 w-full h-full relative [&_.recharts-wrapper]:!outline-none">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={barData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }} className="outline-none">
                            <defs>
                              <linearGradient id="colorTurnout" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.6}/>
                                <stop offset="95%" stopColor="#0d9488" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                            <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                            <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                            <Tooltip 
                              content={<CustomTooltip />}
                              cursor={{ stroke: '#2dd4bf', strokeWidth: 1, strokeDasharray: '3 3', fill: 'transparent' }} 
                            />
                            <Area type="monotone" dataKey="Attendees" stroke="#2dd4bf" strokeWidth={3} fill="url(#colorTurnout)" activeDot={{ r: 6, fill: '#2dd4bf', stroke: '#0f172a', strokeWidth: 2 }} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  {/* 🚀 FIXED BENTO RIGHT: Clean Radial Pie Chart + Footer Stats */}
                  <div className="bg-black/20 border border-white/10 rounded-2xl p-6 flex flex-col shadow-inner relative min-h-[280px]">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider text-center mb-4">Class Status</h3>

                    {filteredAnalytics.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center opacity-30">
                        <PieChartIcon className="w-12 h-12 mb-3 text-gray-400" />
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No Data</p>
                      </div>
                    ) : (
                      <>
                        {/* 🚀 MIDDLE: Flex-1 ensures perfect vertical centering of the pie chart */}
                        <div className="flex-1 flex items-center justify-center gap-6 w-full py-2">
                          
                          <div className="relative w-[130px] h-[130px] shrink-0 [&_.recharts-wrapper]:!outline-none">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart className="outline-none">
                                <Pie data={pieData} innerRadius="75%" outerRadius="100%" dataKey="value" stroke="none" paddingAngle={3}>
                                  {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                </Pie>
                              </PieChart>
                            </ResponsiveContainer>
                            
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                              <span className="text-2xl font-black text-white tracking-tighter drop-shadow-md">
                                {(pieData[0].value + pieData[1].value) > 0 ? ((pieData[0].value / (pieData[0].value + pieData[1].value)) * 100).toFixed(1) : "0.0"}%
                              </span>
                              <span className="text-[8px] font-black text-teal-400 uppercase tracking-widest mt-0.5">Safe</span>
                            </div>
                          </div>

                          <div className="flex flex-col gap-4 justify-center shrink-0">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <div className="w-2 h-2 rounded-full bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.5)]"></div>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Safe</span>
                              </div>
                              <span className="text-xl font-black text-white pl-4 leading-none">{pieData[0].value}</span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <div className="w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.5)]"></div>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">At Risk</span>
                              </div>
                              <span className="text-xl font-black text-white pl-4 leading-none">{pieData[1].value}</span>
                            </div>
                          </div>

                        </div>
                        
                        {/* 🚀 BOTTOM: Sleek, proportionate footer locked to the bottom */}
                        <div className="grid grid-cols-2 pt-4 border-t border-white/5 divide-x divide-white/10 shrink-0">
                          <div className="text-center flex flex-col justify-center">
                            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">Avg Turnout</p>
                            <p className="text-xl font-black text-teal-400 leading-none">
                              {barData.length > 0 ? Math.round(barData.reduce((a, b) => a + b.Attendees, 0) / barData.length) : 0}
                            </p>
                          </div>
                          <div className="text-center flex flex-col justify-center">
                            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">Total Weeks</p>
                            <p className="text-xl font-black text-white leading-none">{barData.length}</p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* 🚀 FUSED DATA DECK: Controls + Table */}
                <div className="bg-black/20 border border-white/10 rounded-2xl flex flex-col shadow-inner min-h-[400px]">
                  
                  {/* Fused Header / Controls Engine */}
                  <div className="sticky top-0 z-20 flex flex-col lg:flex-row gap-4 p-4 border-b border-white/10 bg-[#0f172a] rounded-t-2xl shadow-sm">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input 
                        type="text" 
                        placeholder="Search Student by Name or ID..." 
                        value={searchQuery} 
                        onChange={e => setSearchQuery(e.target.value)} 
                        className="w-full bg-black/40 border border-white/10 text-white pl-11 pr-4 py-3 rounded-xl focus:outline-none focus:border-teal-500 transition-colors text-sm font-bold" 
                      />
                    </div>
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2 bg-black/40 px-4 py-2 rounded-xl border border-white/10">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Type:</label>
                        <div className="relative">
                          <button 
                            onClick={() => setIsAnalyticsTypeDropdownOpen(!isAnalyticsTypeDropdownOpen)}
                            className="bg-transparent text-white text-sm font-bold focus:outline-none cursor-pointer flex items-center gap-1.5"
                          >
                            <span>{reportFilter === 'All' ? 'All Sessions' : reportFilter === 'Lecture' ? 'Lectures' : 'Sections'}</span>
                            <span className="text-[10px] text-gray-400">▼</span>
                          </button>
                          
                          {isAnalyticsTypeDropdownOpen && (
                            <div className="absolute top-full left-0 mt-2 w-36 bg-slate-800 border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden flex flex-col p-2">
                              {[
                                { value: 'All', label: 'All Sessions' },
                                { value: 'Lecture', label: 'Lectures' },
                                { value: 'Section', label: 'Sections' }
                              ].map(option => (
                                <button
                                  key={option.value}
                                  onClick={() => { setReportFilter(option.value as any); setIsAnalyticsTypeDropdownOpen(false); }}
                                  className="flex items-center p-2 hover:bg-white/5 rounded cursor-pointer w-full text-left"
                                >
                                  <span className={`text-sm ${reportFilter === option.value ? 'text-teal-400 font-bold' : 'text-white'}`}>{option.label}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 bg-black/40 px-4 py-2 rounded-xl border border-white/10 w-32">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Threshold:</label>
                        <input 
                          type="number" min="1" value={threshold} onChange={handleThresholdChange} 
                          className="w-8 bg-transparent text-white p-0 text-right focus:outline-none" 
                        />
                      </div>
                    </div>
                  </div>

                  {/* Table Column Headers */}
                  <div className="sticky top-[72px] lg:top-[72px] z-10 grid grid-cols-12 gap-4 px-4 py-3 border-b border-white/10 bg-[#0f172a] font-bold text-gray-400 text-[11px] uppercase tracking-wider items-center shadow-sm">
                    <div className="col-span-3">Student</div>
                    <div className="col-span-3 text-center">Recent Trend</div>
                    <div className="col-span-2 text-center">Attended</div>
                    <div className="col-span-2 text-center">Absent</div>
                    <div className="col-span-2 text-center">Status</div>
                  </div>
                  
                  <div className="p-2">
                    {filteredAnalytics.length === 0 ? (
                      <div className="flex flex-col items-center justify-center opacity-40 py-12">
                        <FolderOpen className="w-16 h-16 mb-4 text-gray-400" />
                        <h3 className="text-xl font-bold text-white mb-1">No Data Available</h3>
                        <p className="text-sm text-gray-400">No attendance records found for this filter.</p>
                      </div>
                    ) : (
                      filteredAnalytics.map((student, i) => (
                        <div 
                          key={i} id={`student-row-${i}`} onClick={() => openStudentProfile(student)}
                          className={`grid grid-cols-12 gap-4 p-4 mb-2 items-center rounded-xl border transition-all duration-200 cursor-pointer ${student.atRisk ? 'bg-red-500/10 border-red-500/30 hover:bg-red-500/20' : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/20'} ${focusedIndex === i ? 'ring-2 ring-teal-400 bg-white/10 shadow-[0_0_15px_rgba(45,212,191,0.2)] scale-[1.01]' : ''}`}
                        >
                          <div className="col-span-3">
                            <p className="font-bold text-white text-sm truncate" title={student.name}>{student.name}</p>
                            <p className="text-xs text-gray-400 font-mono mt-1">{student.national_id}</p>
                          </div>
                          
                          <div className="col-span-3 flex justify-center items-end gap-1 h-6">
                            {(!student.sparkline || student.sparkline.length === 0) ? (
                              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">No Data</span>
                            ) : (
                              student.sparkline.map((status: string, idx: number) => (
                                <div 
                                  key={idx} title={status.charAt(0).toUpperCase() + status.slice(1)}
                                  className={`w-2 rounded-full transition-all duration-300 ${status === 'present' ? 'bg-teal-400 h-full opacity-80' : status === 'excused' ? 'bg-indigo-400 h-2/3 opacity-80' : status === 'bonus' ? 'bg-amber-400 h-full shadow-[0_0_8px_rgba(251,191,36,0.6)]' : 'bg-rose-500 h-1/3 opacity-80'}`}
                                />
                              ))
                            )}
                          </div>

                          <div className="col-span-2 flex flex-col items-center justify-center">
                            <span className="font-bold text-teal-400">{student.attended}</span>
                            {student.bonuses > 0 && <span className="text-[10px] text-amber-400 font-bold -mt-1">+{student.bonuses} Bonus</span>}
                          </div>
                          
                          <div className="col-span-2 flex flex-col items-center justify-center">
                            <span className={`font-bold ${student.atRisk ? 'text-red-400' : 'text-gray-300'}`}>{student.absent}</span>
                            {student.excused > 0 && <span className="text-[10px] text-indigo-400 font-bold -mt-1">{student.excused} Excused</span>}
                          </div>

                          <div className="col-span-2 flex justify-center">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${student.atRisk ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-teal-500/10 text-teal-400'}`}>
                              {student.atRisk ? 'At Risk' : 'Safe'}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {activeTab === 'vault' && (
            <div className="flex flex-col h-full overflow-hidden animate-fade-in">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 shrink-0 gap-4">
                <div>
                  <h2 className="text-3xl font-bold text-teal-400">System Vault</h2>
                  <p className="text-gray-400 mt-1">Manage local backups, merge records, and reset for a new academic year.</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-4 space-y-6" style={{ scrollbarWidth: 'thin', scrollbarColor: '#475569 transparent' }}>

                {/* 🚀 Section 1: Local Database Controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-black/20 border border-white/10 rounded-3xl p-6 shadow-inner">
                    <h3 className="text-white font-bold mb-2 flex items-center gap-2"><Save className="w-5 h-5 text-teal-400" /> Manual Export</h3>
                    <p className="text-xs text-gray-400 mb-6 h-8">Compress and save a hard copy of the database to your local machine.</p>
                    <button 
                      onClick={handleExportBackup} 
                      disabled={isExporting || isImporting}
                      className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold py-3 rounded-xl transition-all flex justify-center items-center gap-2 disabled:opacity-50"
                    >
                      {isExporting ? <Hourglass className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />} {isExporting ? 'Exporting...' : 'Export .attdb'}
                    </button>
                  </div>

                  <div className="bg-black/20 border border-white/10 rounded-3xl p-6 shadow-inner">
                    <h3 className="text-white font-bold mb-2 flex items-center gap-2"><RefreshCw className="w-5 h-5 text-indigo-400" /> Merge Records</h3>
                    <p className="text-xs text-gray-400 mb-6 h-8">Import a backup file from another machine to combine attendance data.</p>
                    <button 
                      onClick={handleImportMerge} 
                      disabled={isImporting || isExporting}
                      className="w-full bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 font-bold py-3 rounded-xl transition-all flex justify-center items-center gap-2 disabled:opacity-50"
                    >
                      {isImporting ? <Hourglass className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {isImporting ? 'Merging...' : 'Import & Merge'}
                    </button>
                  </div>
                </div>

                {/* 🚀 Section 2: The Danger Zone */}
                <div className="bg-rose-500/5 border border-rose-500/20 rounded-3xl p-6 mt-6">
                  <h3 className="text-rose-400 font-black flex items-center gap-2 mb-2"><ShieldAlert className="w-5 h-5" /> Danger Zone</h3>
                  <p className="text-xs text-gray-400 mb-6">Start a brand new academic year. This permanently wipes all students and attendance records but keeps your environment setup.</p>
                  
                  <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <input 
                      type="text" 
                      placeholder="Type 'RESET' to confirm"
                      value={resetConfirmText}
                      // 🚀 FIXED: Forces the actual state to uppercase so the validation logic works!
                      onChange={(e) => setResetConfirmText(e.target.value.toUpperCase())}
                      className="flex-1 bg-black/40 border border-rose-500/30 text-rose-400 text-center sm:text-left font-black tracking-widest p-3.5 rounded-xl focus:outline-none focus:border-rose-500 transition-colors placeholder-rose-900/50 uppercase"
                    />
                    <button 
                      onClick={() => { handleFactoryReset(); setResetConfirmText(''); }}
                      disabled={resetConfirmText !== 'RESET'}
                      className="w-full sm:w-auto px-8 bg-rose-500 hover:bg-rose-400 text-white font-black py-3.5 rounded-xl transition-all shadow-[0_0_15px_rgba(244,63,94,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 shrink-0"
                    >
                      <Trash2 className="w-5 h-5" /> Factory Reset
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>
      </main>
      
      {/* About Attendo Modal */}
      {isAboutOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setIsAboutOpen(false)}>
          <div 
            className="bg-slate-900 border border-white/10 shadow-2xl rounded-3xl w-full max-w-sm overflow-hidden flex flex-col animate-fade-in p-8 text-center relative" 
            onClick={e => e.stopPropagation()}
          >
            <button onClick={() => setIsAboutOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white bg-black/50 hover:bg-black/80 w-8 h-8 rounded-full flex items-center justify-center transition-all font-bold"><X className="w-4 h-4" /></button>
            
            <img src="./attendo-icon.png" alt="Attendo Logo" className="w-20 h-20 mx-auto mb-4 drop-shadow-[0_0_15px_rgba(20,184,166,0.3)]" />
            <h2 className="text-3xl font-black text-white tracking-tight mb-1">Attendo</h2>
            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-3">Version 1.1.0</p>
            
            <div className="flex justify-center gap-2 mb-8">
              <span className="bg-teal-500/10 border border-teal-500/20 text-teal-400 text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5 uppercase tracking-widest shadow-[0_0_10px_rgba(20,184,166,0.2)]">
                <Shield className="w-3 h-3" /> {licenseDetails.plan}
              </span>
              <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5 uppercase tracking-widest shadow-[0_0_10px_rgba(99,102,241,0.2)]">
                <Clock className="w-3 h-3" /> {typeof licenseDetails.duration === 'number' ? `${licenseDetails.duration}-Month` : licenseDetails.duration.toString().replace(' Months', '-Month').replace(' Days', '-Day')}
              </span>
            </div>
            
            <div className="bg-white/5 rounded-2xl p-6 border border-white/5 mb-6 shadow-inner">
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-3">Developed By</p>
              <p className="text-teal-400 font-black text-base tracking-wide mb-2">Dr. Belal El-Fakharany</p>
              <p className="text-gray-300 text-[10px] font-bold uppercase tracking-widest mb-1">Theriogenology Department</p>
              <p className="text-gray-500 text-[10px] font-semibold mb-5">Faculty of Veterinary Medicine<br/>Suez Canal University</p>
              
              <a 
                href="https://wa.me/201014503937" 
                target="_blank" 
                rel="noopener noreferrer" 
                title="Chat on WhatsApp"
                className="inline-flex items-center justify-center gap-2 w-full bg-black/40 hover:bg-[#25D366]/20 border border-white/5 hover:border-[#25D366]/40 text-gray-400 hover:text-[#25D366] transition-all px-4 py-2.5 rounded-xl group cursor-pointer"
              >
                <MessageCircle className="w-5 h-5 grayscale group-hover:grayscale-0 transition-all" />
                <span className="text-xs font-mono font-bold tracking-widest">+20 101 450 3937</span>
              </a>
            </div>
            
            <p className="text-gray-600 text-[10px]">© {new Date().getFullYear()} All Rights Reserved.</p>
          </div>
        </div>
      )}


      
      {/* Global Command Palette Overlay */}
      {isCommandPaletteOpen && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 pt-[20vh]" onClick={() => { setIsCommandPaletteOpen(false); setCommandSearchQuery(''); }}>
          <div 
            className="bg-slate-900 border border-white/10 shadow-2xl rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-fade-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center p-4 border-b border-white/10 bg-white/5">
              <Search className="w-5 h-5 mr-3 text-gray-400" />
              <input 
                ref={searchInputRef}
                type="text" 
                placeholder="Search any student by name or ID... (Ctrl + K)" 
                value={commandSearchQuery}
                onChange={e => setCommandSearchQuery(e.target.value)}
                className="flex-1 bg-transparent border-none text-white text-lg focus:outline-none placeholder-gray-500"
              />
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest border border-white/10 px-2 py-1 rounded-md ml-3">ESC</span>
            </div>
            
            {commandSearchQuery.trim() && (
              <div className="max-h-[400px] overflow-y-auto p-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#475569 transparent' }}>
                {commandPaletteResults.length === 0 ? (
                  <p className="p-4 text-center text-gray-500 italic text-sm">No students found matching "{commandSearchQuery}"</p>
                ) : (
                  commandPaletteResults.map((s, i) => (
                    <button 
                      key={i}
                      onClick={() => {
                        openStudentProfile(s);
                        setIsCommandPaletteOpen(false);
                        setCommandSearchQuery('');
                      }}
                      className="w-full text-left flex items-center justify-between p-4 hover:bg-teal-500/10 rounded-xl transition-colors group"
                    >
                      <div>
                        <p className="text-white font-bold group-hover:text-teal-400 transition-colors">{s.name}</p>
                        <p className="text-xs text-gray-500 font-mono mt-0.5">{s.national_id || s.nationalId}</p>
                      </div>
                      <span className="text-[10px] bg-white/5 text-gray-400 px-3 py-1 rounded-full font-bold">
                        Grade {s.grade}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Student Profile Modal Overlay */}
      {studentProfile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-white/10 shadow-2xl rounded-3xl w-full max-w-lg overflow-hidden flex flex-col animate-fade-in">
            <div className="p-6 border-b border-white/10 flex justify-between items-start bg-white/5">
              <div>
                <h2 className="text-2xl font-black text-teal-400">{studentProfile.name}</h2>
                <p className="text-gray-400 font-mono mt-1 flex items-center gap-2">
                  <IdCard className="w-4 h-4" /> {studentProfile.national_id}
                </p>
              </div>
              <button onClick={() => setStudentProfile(null)} className="text-gray-500 hover:text-white bg-black/50 hover:bg-black/80 w-8 h-8 rounded-full flex items-center justify-center transition-all font-bold"><X className="w-4 h-4" /></button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto max-h-[60vh]" style={{ scrollbarWidth: 'thin', scrollbarColor: '#475569 transparent' }}>
              
              {/* 🚀 FIXED: Upgraded to a 3-box layout to show Excused, and added a dynamic Bonus XP badge */}
              <div className="flex gap-4 mb-6">
                <div className="bg-white/5 rounded-xl p-4 flex-1 text-center border border-white/5 shadow-inner relative">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Attended</p>
                  <p className="text-3xl font-black text-teal-400">{studentProfile.attended}</p>
                  {studentProfile.bonuses > 0 && <span className="absolute top-2 right-2 text-[10px] font-black text-amber-400">+{studentProfile.bonuses} XP</span>}
                </div>
                <div className="bg-white/5 rounded-xl p-4 flex-1 text-center border border-white/5 shadow-inner">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Excused</p>
                  <p className="text-3xl font-black text-indigo-400">{studentProfile.excused || 0}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-4 flex-1 text-center border border-white/5 shadow-inner">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Absent</p>
                  <p className="text-3xl font-black text-rose-400">{studentProfile.absent}</p>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-white/10 pb-3">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Detailed History</h3>
                <div className="flex bg-black/40 rounded-lg p-1 border border-white/5">
                  <button 
                    onClick={() => setModalTimelineTab('attended')}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${modalTimelineTab === 'attended' ? 'bg-teal-500/20 text-teal-400 shadow-sm' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                  >
                    Attended / Excused ({fullStudentTimeline.attended.length})
                  </button>
                  <button 
                    onClick={() => setModalTimelineTab('absent')}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${modalTimelineTab === 'absent' ? 'bg-rose-500/20 text-rose-400 shadow-sm' : 'text-gray-500 hover:text-rose-400/50 hover:bg-white/5'}`}
                  >
                    Absent ({fullStudentTimeline.absent.length})
                  </button>
                </div>
              </div>
              
              {/* Full Modal History Timeline based on Tabs */}
              {fullStudentTimeline.attended.length === 0 && fullStudentTimeline.absent.length === 0 ? (
                <p className="text-gray-500 text-sm italic text-center p-6 bg-white/5 rounded-xl border border-white/5">No active records found for this filter.</p>
              ) : (
                <div>
                  {modalTimelineTab === 'attended' && (
                    <div className="space-y-2 animate-fade-in">
                      {fullStudentTimeline.attended.length === 0 ? (
                        <p className="text-gray-500 text-sm italic text-center p-6 bg-white/5 rounded-xl border border-white/5">Perfectly absent. No attended records found.</p>
                      ) : (
                        fullStudentTimeline.attended.map((record: any, idx) => {
                          const sessionNameClean = record.session_name.split(' - ').slice(1).join(' - ') || record.session_name;
                          const dateClean = new Date(record.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                          
                          return (
                            <div key={`att-${idx}`} className="bg-black/30 p-3 rounded-xl border border-white/5 flex justify-between items-center hover:bg-white/5 transition-colors">
                              <div>
                                <p className="text-sm text-gray-200 font-bold">{sessionNameClean}</p>
                                <p className="text-[10px] text-gray-500 mt-1">{dateClean}</p>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                {record.bonus_points > 0 && (
                                  <span className="text-[10px] text-amber-400 font-black">+{record.bonus_points} Bonus</span>
                                )}
                                
                                {record.is_excused === 1 ? (
                                  <p className="flex items-center gap-1.5 text-[10px] text-indigo-400 font-bold uppercase tracking-widest bg-indigo-500/10 border border-indigo-500/30 px-3 py-1.5 rounded-lg shadow-sm">
                                    <Archive className="w-3 h-3" /> Excused
                                  </p>
                                ) : (
                                  <p className="flex items-center gap-1.5 text-[10px] text-teal-400 font-bold uppercase tracking-widest bg-teal-500/10 border border-teal-500/20 px-3 py-1.5 rounded-lg shadow-sm">
                                    <CheckCircle className="w-3 h-3" /> Present
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {modalTimelineTab === 'absent' && (
                    <div className="space-y-2 animate-fade-in">
                      {fullStudentTimeline.absent.length === 0 ? (
                        <p className="text-gray-500 text-sm italic text-center p-6 bg-white/5 rounded-xl border border-white/5">Perfect attendance! No absent records found.</p>
                      ) : (
                        fullStudentTimeline.absent.map((record: any, idx) => {
                          const sessionNameClean = record.session_name.split(' - ').slice(1).join(' - ') || record.session_name;
                          const dateClean = new Date(record.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                          
                          return (
                            <div key={`abs-${idx}`} className="bg-black/30 p-3 rounded-xl border border-rose-500/10 flex justify-between items-center hover:bg-rose-500/5 transition-colors opacity-80">
                              <div>
                                <p className="text-sm text-rose-200/80 font-bold">{sessionNameClean}</p>
                                <p className="text-[10px] text-rose-500/60 mt-1">{dateClean}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <p className="flex items-center gap-1.5 text-[10px] text-rose-400 font-bold uppercase tracking-widest bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-lg shadow-sm">
                                  <X className="w-3 h-3" /> Absent
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🚀 NEW: Add Student Modal */}
      {isAddStudentOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => { setIsAddStudentOpen(false); setNewStudentName(''); setNewStudentId(''); }}>
          <div 
            className="bg-slate-900 border border-white/10 shadow-2xl rounded-3xl w-full max-w-md overflow-hidden flex flex-col animate-fade-in p-8 relative" 
            onClick={e => e.stopPropagation()}
          >
            <button onClick={() => { setIsAddStudentOpen(false); setNewStudentName(''); setNewStudentId(''); }} className="absolute top-4 right-4 text-gray-500 hover:text-white bg-black/50 hover:bg-black/80 w-8 h-8 rounded-full flex items-center justify-center transition-all font-bold"><X className="w-4 h-4" /></button>
            
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-teal-500/20 p-2 rounded-xl text-teal-400"><UserPlus className="w-6 h-6" /></div>
              <h2 className="text-2xl font-black text-white tracking-tight">Manual Registration</h2>
            </div>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-6">Injecting to Grade {activeWorkspace}</p>
            
            <form onSubmit={handleManualAddStudent} className="space-y-4">
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5 block">Student Full Name</label>
                <input 
                  autoFocus
                  type="text" 
                  placeholder="e.g., Ahmed Mohamed"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 text-white p-3 rounded-xl focus:outline-none focus:border-teal-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1.5 block">14-Digit National ID</label>
                <input 
                  type="text" 
                  placeholder="2990616..."
                  value={newStudentId}
                  onChange={(e) => setNewStudentId(e.target.value.replace(/\D/g, ''))} // Strips non-numbers instantly
                  maxLength={14}
                  className="w-full bg-black/40 border border-white/10 text-white p-3 rounded-xl focus:outline-none focus:border-teal-500 transition-colors font-mono tracking-widest"
                />
              </div>
              
              <button 
                type="submit"
                disabled={!newStudentName.trim() || newStudentId.length !== 14}
                className="w-full bg-teal-500 hover:bg-teal-400 text-slate-900 font-black py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(20,184,166,0.3)] mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Register to Roster
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 🚀 NEW: Custom Right-Click Context Menu */}
      {contextMenu.visible && contextMenu.student && (
        <div 
          className="fixed z-[500] bg-[#0f172a] border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.5)] rounded-xl py-2 w-56 animate-fade-in"
          style={{ 
            top: Math.min(contextMenu.y, window.innerHeight - 150), 
            left: Math.min(contextMenu.x, window.innerWidth - 224) 
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-2 border-b border-white/10 mb-1">
            <p className="text-white font-bold text-sm truncate">{contextMenu.student.name}</p>
            <p className="text-teal-400 font-mono text-[10px]">{contextMenu.student.national_id || contextMenu.student.nationalId}</p>
          </div>
          
          {showDeleted ? (
            <>
              <button 
                onClick={() => { handleRestoreStudent(contextMenu.student.name, contextMenu.student.national_id || contextMenu.student.nationalId); setContextMenu(prev => ({...prev, visible: false})); }}
                className="w-full text-left px-4 py-2 text-sm font-bold text-teal-400 hover:bg-teal-500/10 flex items-center gap-3 transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> Restore Student
              </button>
              <button 
                onClick={() => { handlePermanentDeleteStudent(contextMenu.student.name, contextMenu.student.national_id || contextMenu.student.nationalId); setContextMenu(prev => ({...prev, visible: false})); }}
                className="w-full text-left px-4 py-2 text-sm font-bold text-rose-500 hover:bg-rose-500/10 flex items-center gap-3 transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Delete Permanently
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={() => { openStudentProfile(contextMenu.student); setContextMenu(prev => ({...prev, visible: false})); }}
                className="w-full text-left px-4 py-2 text-sm font-bold text-gray-300 hover:bg-white/5 hover:text-white flex items-center gap-3 transition-colors"
              >
                <IdCard className="w-4 h-4" /> View Profile
              </button>
              <button 
                onClick={() => { setEditingStudentId(contextMenu.student.national_id || contextMenu.student.nationalId); setEditNameValue(contextMenu.student.name); setContextMenu(prev => ({...prev, visible: false})); }}
                className="w-full text-left px-4 py-2 text-sm font-bold text-gray-300 hover:bg-white/5 hover:text-white flex items-center gap-3 transition-colors"
              >
                <Settings className="w-4 h-4" /> Edit Name
              </button>
              <div className="h-px bg-white/10 my-1 mx-2"></div>
              <button 
                onClick={() => { handleDeleteStudent(contextMenu.student.name, contextMenu.student.national_id || contextMenu.student.nationalId); setContextMenu(prev => ({...prev, visible: false})); }}
                className="w-full text-left px-4 py-2 text-sm font-bold text-rose-400 hover:bg-rose-500/10 flex items-center gap-3 transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Archive Student
              </button>
            </>
          )}
        </div>
      )}

      {/* 🚀 FIXED: Fully Populated Command Matrix Overlay (Now interactive) */}
      {showShortcuts && (
        <div 
          onClick={() => setShowShortcuts(false)}
          className="fixed inset-0 z-[1000] bg-[#0f172a]/90 backdrop-blur-md flex flex-col items-center justify-center animate-fade-in cursor-pointer"
        >
          <div className="mb-8 text-center">
            <h2 className="text-4xl font-black text-white tracking-widest uppercase shadow-black drop-shadow-xl mb-2">Command Matrix</h2>
            <p className="text-indigo-400 font-bold tracking-widest text-sm uppercase">Release Ctrl+Alt or Click anywhere to close</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl w-full px-8">
            
            {/* COLUMN 1: Scanner & Flow */}
            <div className="bg-black/40 border border-white/10 rounded-2xl p-6 shadow-2xl">
              <h3 className="text-teal-400 font-black mb-4 flex items-center gap-2 uppercase text-sm tracking-widest"><Video className="w-5 h-5" /> Session & Scanner</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center"><span className="text-gray-300 text-sm font-semibold">Start Session</span><kbd className="bg-white/10 border border-white/10 text-teal-300 px-2.5 py-1 rounded-md text-xs font-mono font-bold shadow-inner">Ctrl + Space</kbd></div>
                <div className="flex justify-between items-center"><span className="text-gray-300 text-sm font-semibold">Open Entry Panel</span><kbd className="bg-white/10 border border-white/10 text-teal-300 px-2.5 py-1 rounded-md text-xs font-mono font-bold shadow-inner">Ctrl + E</kbd></div>
                <div className="flex justify-between items-center"><span className="text-gray-300 text-sm font-semibold">Cold Call Spin</span><kbd className="bg-white/10 border border-white/10 text-teal-300 px-2.5 py-1 rounded-md text-xs font-mono font-bold shadow-inner">Ctrl + A</kbd></div>
                <div className="flex justify-between items-center"><span className="text-gray-300 text-sm font-semibold">Undo Last Action</span><kbd className="bg-white/10 border border-white/10 text-teal-300 px-2.5 py-1 rounded-md text-xs font-mono font-bold shadow-inner">Ctrl + Z</kbd></div>
                <div className="flex justify-between items-center"><span className="text-gray-300 text-sm font-semibold">End & Export</span><kbd className="bg-white/10 border border-white/10 text-teal-300 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold shadow-inner">Ctrl+Shift+S</kbd></div>
              </div>
            </div>

            {/* COLUMN 2: Workspace & Data */}
            <div className="bg-black/40 border border-white/10 rounded-2xl p-6 shadow-2xl">
              <h3 className="text-amber-400 font-black mb-4 flex items-center gap-2 uppercase text-sm tracking-widest"><Database className="w-5 h-5" /> Roster & Views</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center"><span className="text-gray-300 text-sm font-semibold">Add New Student</span><kbd className="bg-white/10 border border-white/10 text-amber-300 px-2.5 py-1 rounded-md text-xs font-mono font-bold shadow-inner">Ctrl + N</kbd></div>
                <div className="flex justify-between items-center"><span className="text-gray-300 text-sm font-semibold">Archive / Delete</span><kbd className="bg-white/10 border border-white/10 text-amber-300 px-2.5 py-1 rounded-md text-xs font-mono font-bold shadow-inner">Del / Bksp</kbd></div>
                <div className="flex justify-between items-center"><span className="text-gray-300 text-sm font-semibold">Toggle Zen Mode</span><kbd className="bg-white/10 border border-white/10 text-amber-300 px-2.5 py-1 rounded-md text-xs font-mono font-bold shadow-inner">Ctrl + D</kbd></div>
                <div className="flex justify-between items-center"><span className="text-gray-300 text-sm font-semibold">Toggle Sound/Mute</span><kbd className="bg-white/10 border border-white/10 text-amber-300 px-2.5 py-1 rounded-md text-xs font-mono font-bold shadow-inner">Ctrl + M</kbd></div>
                <div className="flex justify-between items-center"><span className="text-gray-300 text-sm font-semibold">Download QRs</span><kbd className="bg-white/10 border border-white/10 text-amber-300 px-2.5 py-1 rounded-md text-xs font-mono font-bold shadow-inner">Ctrl + Q</kbd></div>
              </div>
            </div>

            {/* COLUMN 3: Global System */}
            <div className="bg-black/40 border border-white/10 rounded-2xl p-6 shadow-2xl">
              <h3 className="text-indigo-400 font-black mb-4 flex items-center gap-2 uppercase text-sm tracking-widest"><Search className="w-5 h-5" /> Global Tools</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center"><span className="text-gray-300 text-sm font-semibold">Search Anything</span><kbd className="bg-white/10 border border-white/10 text-indigo-300 px-2.5 py-1 rounded-md text-xs font-mono font-bold shadow-inner">Ctrl + K</kbd></div>
                <div className="flex justify-between items-center"><span className="text-gray-300 text-sm font-semibold">Switch App Tabs</span><kbd className="bg-white/10 border border-white/10 text-indigo-300 px-2.5 py-1 rounded-md text-xs font-mono font-bold shadow-inner">Ctrl + ↑/↓</kbd></div>
                <div className="flex justify-between items-center"><span className="text-gray-300 text-sm font-semibold">List Actions</span><kbd className="bg-white/10 border border-white/10 text-indigo-300 px-2.5 py-1 rounded-md text-xs font-mono font-bold shadow-inner">↑ / ↓ / Enter</kbd></div>
                <div className="flex justify-between items-center"><span className="text-gray-300 text-sm font-semibold">Close Modals</span><kbd className="bg-white/10 border border-white/10 text-indigo-300 px-2.5 py-1 rounded-md text-xs font-mono font-bold shadow-inner">ESC</kbd></div>
                <div className="flex justify-between items-center"><span className="text-gray-300 text-sm font-semibold">Peek Shortcuts</span><kbd className="bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 px-2.5 py-1 rounded-md text-xs font-mono font-bold shadow-inner">Hold Ctrl+Alt</kbd></div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 🚀 NEW: Rapid Paper-to-Digital Modal */}
      {isRapidEntryOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setIsRapidEntryOpen(false)}>
          <div 
            className="bg-slate-900 border border-white/10 shadow-2xl rounded-3xl w-full max-w-2xl h-[80vh] overflow-hidden flex flex-col animate-fade-in relative" 
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 border-b border-white/10 flex justify-between items-start bg-white/5 shrink-0">
              <div>
                <h2 className="text-2xl font-black text-indigo-400 flex items-center gap-3"><ListChecks className="w-6 h-6" /> Unified Entry Panel</h2>
                <p className="text-gray-400 text-sm mt-1">Select names, type a 14-digit ID, or paste bulk IDs directly into the search bar.</p>
              </div>
              <button onClick={() => setIsRapidEntryOpen(false)} className="text-gray-500 hover:text-white bg-black/50 hover:bg-black/80 w-8 h-8 rounded-full flex items-center justify-center transition-all font-bold"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-4 shrink-0 bg-black/20 border-b border-white/10">
              <div className="relative w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  ref={rapidSearchRef}
                  autoFocus type="text" placeholder="Search by name, or paste multiple 14-digit IDs here..." 
                  value={rapidSearchQuery} 
                  onChange={e => {
                    const rawInput = e.target.value;
                    const extractedIds = rawInput.match(/\d{14}/g);
                    
                    // 🚀 THE OMNIBOX ENGINE: If it detects any 14-digit sequence, intercept it!
                    if (extractedIds && extractedIds.length > 0) {
                      let validCount = 0;
                      
                      extractedIds.forEach(id => {
                        // Check if the ID exists in the current Grade Workspace
                        if (nationalIdMapRef.current[id] && nationalIdMapRef.current[id].grade === activeWorkspace) {
                          setRapidSelectedIds(prev => Array.from(new Set([...prev, id])));
                          validCount++;
                        }
                      });
                      
                      if (validCount > 0) {
                        toast.success(`Auto-selected ${validCount} students from ID data!`);
                      } else {
                        toast.error('No valid students found in that data.');
                      }
                      
                      // Instantly clear the bar so they can type the next name/ID!
                      setRapidSearchQuery(''); 
                    } else {
                      // Normal name filtering
                      setRapidSearchQuery(rawInput);
                    }
                  }} 
                  className="w-full bg-black/40 border border-white/10 text-white pl-9 pr-3 py-3 rounded-xl focus:outline-none focus:border-indigo-500 text-sm transition-colors font-bold" 
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 bg-black/10" style={{ scrollbarWidth: 'thin', scrollbarColor: '#475569 transparent' }}>
              {currentRosterList
                .filter(s => !scannedStudents.some(scanned => (scanned.national_id || scanned.nationalId) === (s.national_id || s.nationalId))) // Hide already scanned
                .filter(s => s.name.toLowerCase().includes(rapidSearchQuery.toLowerCase()))
                .map((student, i) => {
                  const sId = student.national_id || student.nationalId;
                  const isSelected = rapidSelectedIds.includes(sId);
                  
                  return (
                    <div 
                      key={i} 
                      onClick={() => {
                        setRapidSelectedIds(prev => isSelected ? prev.filter(id => id !== sId) : [...prev, sId]);
                        // 🚀 FIXED: Instantly focus the input and highlight all text for the next search!
                        if (rapidSearchRef.current) {
                          rapidSearchRef.current.focus();
                          rapidSearchRef.current.select();
                        }
                      }}
                      className={`flex justify-between items-center p-4 mb-2 rounded-xl border cursor-pointer transition-all ${isSelected ? 'bg-indigo-500/20 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'bg-white/5 border-transparent hover:bg-white/10'}`}
                    >
                      <div>
                        <p className={`font-bold text-sm ${isSelected ? 'text-indigo-300' : 'text-white'}`}>{student.name}</p>
                        <p className="text-xs text-gray-500 font-mono mt-0.5">{sId}</p>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-gray-500'}`}>
                        {isSelected && <CheckCircle className="w-4 h-4 text-slate-900" />}
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="p-6 shrink-0 bg-white/5 border-t border-white/10 flex justify-between items-center">
              <p className="text-sm font-bold text-gray-400">Selected: <span className="text-indigo-400 text-lg">{rapidSelectedIds.length}</span></p>
              <button 
                disabled={rapidSelectedIds.length === 0}
                onClick={() => {
                  rapidSelectedIds.forEach(id => handleSuccessfulScan(id, false));
                  setIsRapidEntryOpen(false);
                  toast.success(`Batch processed ${rapidSelectedIds.length} students!`);
                }}
                className="bg-indigo-500 hover:bg-indigo-400 text-slate-900 font-black px-8 py-3 rounded-xl shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <CheckCircle className="w-5 h-5" /> Submit Batch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 FIXED: True Cold Call Modal with blurred background */}
      {isColdCallActive && coldCallStudent && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setIsColdCallActive(false)}>
          <div 
            className="max-w-md w-full bg-slate-900 border-2 border-indigo-500/50 shadow-[0_0_50px_rgba(99,102,241,0.3)] rounded-3xl pointer-events-auto flex p-8 flex-col items-center text-center animate-fade-in relative"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-indigo-500/20 p-4 rounded-full mb-4">
              <Dices className="w-12 h-12 text-indigo-400 animate-bounce" />
            </div>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Random Call Selected</p>
            <p className="text-3xl font-black text-white mb-2">{coldCallStudent.name}</p>
            <p className="text-indigo-400 font-mono text-sm tracking-widest bg-indigo-500/10 px-4 py-1 rounded-lg border border-indigo-500/20">
              {coldCallStudent.national_id || coldCallStudent.nationalId}
            </p>
            <button onClick={() => setIsColdCallActive(false)} className="mt-8 w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold py-3.5 rounded-xl transition-all">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* 🚀 NEW: TA Merge Conflict Resolver Modal */}
      {mergeConflicts.length > 0 && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-indigo-500/30 shadow-[0_0_50px_rgba(99,102,241,0.2)] rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col animate-fade-in">
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-indigo-500/10">
              <div>
                <h2 className="text-2xl font-black text-indigo-400 flex items-center gap-3"><ShieldAlert className="w-6 h-6" /> Merge Conflicts Detected</h2>
                <p className="text-gray-300 text-sm mt-1">The imported file contradicts your local master ledger. Select which record to keep.</p>
              </div>
              <button 
                onClick={async () => {
                  setMergeConflicts([]);
                  if (pendingImportPath) {
                    try {
                      const { invoke } = await import('@tauri-apps/api/core');
                      await invoke('delete_temp_backup', { path: pendingImportPath });
                    } catch(e) {}
                  }
                }} 
                className="text-gray-500 hover:text-white bg-black/50 hover:bg-black/80 w-8 h-8 rounded-full flex items-center justify-center transition-all font-bold"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4" style={{ scrollbarWidth: 'thin', scrollbarColor: '#6366f1 transparent' }}>
              {mergeConflicts.map((conflict, idx) => {
                const key = `${conflict.national_id}||${conflict.session_name}`;
                const choice = resolutions[key] || null;

                return (
                  <div key={idx} className="bg-black/40 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <p className="text-white font-bold">{conflict.name} <span className="text-gray-500 font-mono text-xs ml-2">{conflict.national_id}</span></p>
                      <p className="text-indigo-300 text-xs font-bold bg-indigo-500/10 px-3 py-1 rounded-full">{conflict.session_name}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      {/* Local Option */}
                      <div 
                        onClick={() => setResolutions(prev => ({ ...prev, [key]: 'local' }))}
                        className={`p-4 rounded-xl cursor-pointer border transition-all ${choice === 'local' ? 'bg-teal-500/20 border-teal-500 shadow-[0_0_15px_rgba(45,212,191,0.2)]' : 'bg-white/5 border-white/10 hover:border-teal-500/50'}`}
                      >
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Keep Local Record (Yours)</p>
                        <p className={`text-lg font-black ${conflict.local_excused ? 'text-indigo-400' : 'text-white'}`}>
                          {conflict.local_excused ? 'Excused' : 'Recorded'}
                        </p>
                      </div>
                      
                      {/* External Option */}
                      <div 
                        onClick={() => setResolutions(prev => ({ ...prev, [key]: 'external' }))}
                        className={`p-4 rounded-xl cursor-pointer border transition-all ${choice === 'external' ? 'bg-amber-500/20 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'bg-white/5 border-white/10 hover:border-amber-500/50'}`}
                      >
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Keep Imported Record</p>
                        <p className={`text-lg font-black ${conflict.ext_excused ? 'text-indigo-400' : 'text-white'}`}>
                          {conflict.ext_excused ? 'Excused' : 'Recorded'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-6 border-t border-white/10 bg-white/5 flex justify-between items-center">
              <p className="text-gray-400 text-sm font-bold">{Object.keys(resolutions).length} of {mergeConflicts.length} resolved</p>
              <button 
                onClick={submitConflictResolutions}
                disabled={Object.keys(resolutions).length !== mergeConflicts.length}
                className="bg-indigo-500 hover:bg-indigo-400 text-white font-black px-8 py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Apply & Complete Merge
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 🚀 NEW: Global Settings Modal (Report Branding) */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-[#020617]/95 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-xl flex flex-col max-h-[90vh] shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-white/10 bg-white/5 shrink-0">
              <h2 className="text-2xl font-black text-teal-400 flex items-center gap-3"><Settings className="w-6 h-6" /> Global Settings</h2>
              <button onClick={() => setIsSettingsOpen(false)} className="text-gray-400 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="p-8 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#475569 transparent' }}>
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" /> Report Branding (PDF)
              </h3>
              
              <div className="flex flex-col gap-6">
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 font-bold uppercase block tracking-widest mb-2">Left Header Text</label>
                    <input 
                      type="text" 
                      placeholder={globalSettings.university_name || 'Official Report'}
                      value={globalSettings[`${activeWorkspace}_university_name`] || ''}
                      onChange={async (e) => {
                        const newSettings = { ...globalSettings, [`${activeWorkspace}_university_name`]: e.target.value };
                        setGlobalSettings(newSettings);
                        // @ts-ignore
                        await window.api.saveGlobalSettings(newSettings);
                      }}
                      className="w-full bg-black/30 border border-white/10 text-white p-3 rounded-xl focus:outline-none focus:border-teal-500 transition-colors text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 font-bold uppercase block tracking-widest mb-2">Right Header Text</label>
                    <input 
                      type="text" 
                      placeholder={globalSettings.faculty_name || ''}
                      value={globalSettings[`${activeWorkspace}_faculty_name`] || ''}
                      onChange={async (e) => {
                        const newSettings = { ...globalSettings, [`${activeWorkspace}_faculty_name`]: e.target.value };
                        setGlobalSettings(newSettings);
                        // @ts-ignore
                        await window.api.saveGlobalSettings(newSettings);
                      }}
                      className="w-full bg-black/30 border border-white/10 text-white p-3 rounded-xl focus:outline-none focus:border-teal-500 transition-colors text-sm"
                    />
                  </div>
                </div>

                <hr className="border-white/5" />

                <div>
                  <label className="text-xs text-gray-400 font-bold uppercase block tracking-widest mb-2">Left Logo</label>
                  <div className="flex items-center gap-4">
                    {globalSettings[`${activeWorkspace}_university_logo`] && (
                      <img src={globalSettings[`${activeWorkspace}_university_logo`]} alt="Left Logo" className="w-16 h-16 object-contain bg-white rounded-lg p-1 border border-white/20" />
                    )}
                    <input 
                      type="file" 
                      accept="image/png, image/jpeg"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = async () => {
                            const b64 = reader.result as string;
                            const newSettings = { ...globalSettings, [`${activeWorkspace}_university_logo`]: b64 };
                            setGlobalSettings(newSettings);
                            // @ts-ignore
                            await window.api.saveGlobalSettings(newSettings);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      title=" "
                      className="text-transparent file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-teal-500/10 file:text-teal-400 hover:file:bg-teal-500/20 cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 font-bold uppercase block tracking-widest mb-2">Right Logo</label>
                  <div className="flex items-center gap-4">
                    {globalSettings[`${activeWorkspace}_faculty_logo`] && (
                      <img src={globalSettings[`${activeWorkspace}_faculty_logo`]} alt="Right Logo" className="w-16 h-16 object-contain bg-white rounded-lg p-1 border border-white/20" />
                    )}
                    <input 
                      type="file" 
                      accept="image/png, image/jpeg"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = async () => {
                            const b64 = reader.result as string;
                            const newSettings = { ...globalSettings, [`${activeWorkspace}_faculty_logo`]: b64 };
                            setGlobalSettings(newSettings);
                            // @ts-ignore
                            await window.api.saveGlobalSettings(newSettings);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      title=" "
                      className="text-transparent file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-teal-500/10 file:text-teal-400 hover:file:bg-teal-500/20 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-white/10 bg-white/5 flex justify-end">
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="bg-white/10 hover:bg-white/20 text-white font-bold px-6 py-2 rounded-xl transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Render Zone for QRs */}
      <div className="absolute top-[-20000px] left-[-20000px] flex flex-col gap-10">
        {printData.map((student, index) => (
          <div 
            key={index} 
            className="qr-export-card bg-white flex flex-col items-center justify-center border-4 border-gray-100"
            style={{ width: '600px', height: '600px', padding: '40px' }}
          >
            <QRCodeSVG value={student.qrPayload} size={400} level="H" />
            <h2 style={{ fontFamily: "'Tajawal', sans-serif" }} className="mt-8 font-bold text-[32px] text-black text-center leading-tight">
              {student.name}
            </h2>
          </div>
        ))}
      </div>

      </div>

      {welcomeModalNode}
    </div>
  );
}

export default App;