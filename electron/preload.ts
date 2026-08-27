import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  getDashboardStats: () => ipcRenderer.invoke('get-dashboard-stats'),
  importRoster: (students: any[]) => ipcRenderer.invoke('import-roster', students),
  getRosterForPrint: () => ipcRenderer.invoke('get-roster-for-print'),
  getLocalIP: () => ipcRenderer.invoke('get-local-ip'),
  exportToExcel: (attendees: any[], sessionName: string) => ipcRenderer.invoke('export-to-excel', attendees, sessionName),
  triggerShadowBackup: () => ipcRenderer.invoke('trigger-shadow-backup'),
  archiveSession: (sessionName: string) => ipcRenderer.invoke('archive-session', sessionName),
  restoreSession: (sessionName: string) => ipcRenderer.invoke('restore-session', sessionName),
  resolveConflicts: (backupPath: string, resolutions: any[], activeWorkspace: string) => ipcRenderer.invoke('resolve-conflicts', backupPath, resolutions, activeWorkspace),

  onStudentScanned: (callback: (payload: string) => void) => {
    ipcRenderer.removeAllListeners('student-scanned');
    ipcRenderer.on('student-scanned', (_event, payload) => callback(payload));
  },
  
  // 🚀 SECURITY & LICENSING ENDPOINTS
  getHardwareId: () => ipcRenderer.invoke('get-hardware-id'),
  checkLicense: () => ipcRenderer.invoke('check-license'),
  activateLicense: (token: string) => ipcRenderer.invoke('activate-license', token),
  factoryReset: () => ipcRenderer.invoke('factory-reset'),

  // 🚀 GLOBAL SETTINGS ENDPOINTS
  getGlobalSettings: () => ipcRenderer.invoke('get-global-settings'),
  saveGlobalSettings: (config: any) => ipcRenderer.invoke('save-global-settings', config),

  // 🚀 ANALYTICS & MATRIX ENDPOINTS
  saveSessionData: (sessionName: string, attendees: any[]) => ipcRenderer.invoke('save-session-data', sessionName, attendees),
  getSemesterAnalytics: (workspace: string, filterType: string) => ipcRenderer.invoke('get-semester-analytics', workspace, filterType),
  exportMasterReport: (workspace: string, filterType: string) => ipcRenderer.invoke('export-master-report', workspace, filterType),
  updateThreshold: (newThreshold: number) => ipcRenderer.invoke('update-threshold', newThreshold),
  getStudentAttendance: (nationalId: string, workspace: string) => ipcRenderer.invoke('get-student-attendance', nationalId, workspace),
  
  // 🚀 DATABASE MERGER ENDPOINTS
  exportBackup: (workspace: string) => ipcRenderer.invoke('export-backup', workspace),
  importBackup: (workspace: string) => ipcRenderer.invoke('import-backup', workspace),

  // 🚀 HISTORY ENDPOINTS
  getAllSessions: () => ipcRenderer.invoke('get-all-sessions'),
  deleteSession: (name: string) => ipcRenderer.invoke('delete-session', name),
  getSessionDetails: (sessionName: string, workspace: string) => ipcRenderer.invoke('get-session-details', sessionName, workspace),
  toggleAttendance: (sessionName: string, nationalId: string, newStatus: boolean) => ipcRenderer.invoke('toggle-attendance', sessionName, nationalId, newStatus),
  updateModifier: (sessionName: string, nationalId: string, field: string, value: any) => ipcRenderer.invoke('update-modifier', sessionName, nationalId, field, value),

  // 🚀 ROSTER ENDPOINTS
  getRoster: () => ipcRenderer.invoke('get-roster'),
  softDeleteStudent: (id: string) => ipcRenderer.invoke('soft-delete-student', id),
  getDeletedRoster: () => ipcRenderer.invoke('get-deleted-roster'),
  restoreStudent: (id: string) => ipcRenderer.invoke('restore-student', id),
  updateStudentName: (nationalId: string, newName: string) => ipcRenderer.invoke('update-student-name', nationalId, newName)
})