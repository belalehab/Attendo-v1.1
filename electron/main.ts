// 1. Native Node.js Tools (The Polyfills)
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import os from 'node:os';
import https from 'node:https';
import forge from 'node-forge';
import ExcelJS from 'exceljs';
import jwt from 'jsonwebtoken';
import fs from 'node:fs';

// 2. The Electron Engine & Toolkits
import { app, shell, BrowserWindow, ipcMain } from 'electron';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { dialog } from 'electron';

// 3. Your Local Backend Files
import db from './database'; 
import { generateHardwareFingerprint } from './security';

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    title: 'Attendo',
    icon: path.join(process.env.VITE_PUBLIC, 'attendo-icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // 🚀 Start the window Maximized (Standard Desktop Behavior)
  win.maximize();
  
  // OPTIONAL: If you want TRUE fullscreen (Kiosk Mode) that hides the Windows taskbar, 
  // delete "win.maximize();" above and uncomment the line below:
  // win.setFullScreen(true);

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  // 🚀 FIXED: Native OS Exit Confirmation Dialog
  win.on('close', (e) => {
    const choice = dialog.showMessageBoxSync(win!, {
      type: 'question',
      buttons: ['Cancel', 'Exit Attendo'],
      defaultId: 0,
      cancelId: 0,
      title: 'Confirm Exit',
      message: 'Are you sure you want to exit Attendo?',
      detail: 'Make sure you have saved and ended any active sessions before leaving.'
    });
    
    // If the user clicked "Cancel" (index 0), prevent the window from closing
    if (choice === 0) {
      e.preventDefault();
    }
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  generateHardwareFingerprint().then(fingerprint => {
    console.log('🔒 Hardware Fingerprint Generated:', fingerprint);
  }).catch(err => {
    console.error('❌ Security check failed:', err);
  });

  createWindow()
  
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 1. Dashboard Stats (🚀 UPDATED: Ignore deleted students)
  ipcMain.handle('get-dashboard-stats', () => {
    try {
      const stmt = db.prepare('SELECT COUNT(*) as total FROM students WHERE is_deleted = 0');
      const result = stmt.get() as { total: number };
      
      return { 
        totalStudents: result.total, 
        activeSession: 'Online (Secure)' 
      };
    } catch (error) {
      console.error('Database query failed:', error);
      return { totalStudents: 0, activeSession: 'Error' };
    }
  });

  // 2. Roster Import
  ipcMain.handle('import-roster', (event, students) => {
    try {
      const insert = db.prepare('INSERT OR IGNORE INTO students (name, national_id, grade) VALUES (?, ?, ?)');
      
      const insertMany = db.transaction((roster) => {
        let added = 0;
        for (const student of roster) {
          const result = insert.run(student.name, student.nationalId, student.grade);
          if (result.changes > 0) added++; 
        }
        return added;
      });

      const newlyAddedCount = insertMany(students);
      return { success: true, count: newlyAddedCount };
    } catch (error) {
      console.error('Import failed:', error);
      return { success: false, error: 'Database insertion failed' };
    }
  });

  // 🚀 PHASE D: DATABASE INITIALIZATION
  db.exec(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      national_id TEXT,
      session_name TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    INSERT OR IGNORE INTO settings (key, value) VALUES ('absence_threshold', '3');
  `);

  // 🚀 PHASE B: SOFT DELETES MIGRATION
  try {
    db.exec("ALTER TABLE students ADD COLUMN is_deleted INTEGER DEFAULT 0;");
  } catch (e) {}

  // 🚀 DATABASE MIGRATIONS (Independent Execution)
  // Each column must have its own try/catch so existing columns don't block new ones!
  try { db.exec("ALTER TABLE attendance ADD COLUMN is_excused INTEGER DEFAULT 0;"); } catch (e) {}
  try { db.exec("ALTER TABLE attendance ADD COLUMN bonus_points INTEGER DEFAULT 0;"); } catch (e) {}
  try { db.exec("ALTER TABLE attendance ADD COLUMN is_archived INTEGER DEFAULT 0;"); } catch (e) {}
  // 🚀 NEW: Audit Trail & Granularity
  try { db.exec("ALTER TABLE attendance ADD COLUMN excuse_reason TEXT DEFAULT NULL;"); } catch (e) {}
  try { db.exec("ALTER TABLE attendance ADD COLUMN audit_trail TEXT DEFAULT '[]';"); } catch (e) {}

  // 🚀 PHASE B: GET FULL ROSTER
  ipcMain.handle('get-roster', () => {
    try {
      const stmt = db.prepare('SELECT * FROM students WHERE is_deleted = 0 ORDER BY name ASC');
      return { success: true, data: stmt.all() };
    } catch(err) { 
      return { success: false, data: [] }; 
    }
  });

  // 🚀 PHASE B: SOFT DELETE STUDENT
  ipcMain.handle('soft-delete-student', (event, nationalId) => {
    try {
      db.prepare('UPDATE students SET is_deleted = 1 WHERE national_id = ?').run(nationalId);
      return { success: true };
    } catch(err) { 
      return { success: false }; 
    }
  });

// 🚀 PHASE B: GET DELETED ROSTER (Archived)
  ipcMain.handle('get-deleted-roster', () => {
    try {
      const stmt = db.prepare('SELECT * FROM students WHERE is_deleted = 1 ORDER BY name ASC');
      return { success: true, data: stmt.all() };
    } catch(err) { 
      return { success: false, data: [] }; 
    }
  });

  // 🚀 PHASE B: RESTORE STUDENT (FIXED)
  ipcMain.handle('restore-student', (event, nationalId) => {
    try {
      db.prepare('UPDATE students SET is_deleted = 0 WHERE national_id = ?').run(nationalId);
      return { success: true };
    } catch(err) { 
      return { success: false }; 
    }
  });

  // 🚀 PHASE B: UPDATE STUDENT NAME
  ipcMain.handle('update-student-name', (event, nationalId, newName) => {
    try {
      db.prepare('UPDATE students SET name = ? WHERE national_id = ?').run(newName, nationalId);
      return { success: true };
    } catch(err) { 
      return { success: false }; 
    }
  });

  // 🚀 PHASE D: SAVE LIVE SESSION TO DB
  ipcMain.handle('save-session-data', (event, sessionName, attendees) => {
    try {
      const insert = db.prepare('INSERT INTO attendance (national_id, session_name) VALUES (?, ?)');
      const insertMany = db.transaction((records) => {
        for (const student of records) {
          insert.run(student.id || student.nationalId || student.national_id, sessionName);
        }
      });
      insertMany(attendees);
      return { success: true };
    } catch (err: any) {
      console.error(err);
      return { success: false, msg: err.message };
    }
  });

  // 🚀 PHASE 3: THE MASTER ANALYTICS ENGINE (WEEK-BASED AGGREGATION)
  ipcMain.handle('get-semester-analytics', async (event, workspace, filterType) => {
    try {
      const thresholdRow = db.prepare("SELECT value FROM settings WHERE key = 'absence_threshold'").get() as any;
      const threshold = thresholdRow ? parseInt(thresholdRow.value) : 3;

      let likePattern = `[Grade ${workspace}]%`;
      if (filterType === 'Lecture') likePattern = `[Grade ${workspace}]% - Lecture%`;
      if (filterType === 'Section') likePattern = `[Grade ${workspace}]% - Section%`;

      // 1. Fetch all relevant attendance
      const allAttendance = db.prepare(`SELECT national_id, session_name, is_excused, bonus_points FROM attendance WHERE session_name LIKE ?`).all(likePattern) as any[];

      // 2. Extract unique weeks from all session names matching the filter
      const weekSet = new Set<number>();
      const sessions = db.prepare("SELECT DISTINCT session_name FROM attendance WHERE session_name LIKE ? ORDER BY timestamp ASC").all(likePattern) as any[];
      
      sessions.forEach(s => {
        // 🚀 FIXED: Dropped the strict parentheses requirement!
        const match = s.session_name.match(/Week (\d+)/); 
        if (match) weekSet.add(parseInt(match[1]));
      });
      const uniqueWeeks = Array.from(weekSet).sort((a, b) => a - b);
      const totalWorkspaceWeeks = uniqueWeeks.length;

      const students = db.prepare("SELECT * FROM students WHERE grade = ? AND is_deleted = 0 ORDER BY name ASC").all(workspace) as any[];

      const analytics = students.map(student => {
        let attended = 0;
        let excused = 0;
        let bonuses = 0;

        // 3. Generate Weekly Sparkline
        const sparkline = uniqueWeeks.map(weekNum => {
          // Find ALL attendance records for this student in this specific week
          const weekRecords = allAttendance.filter(a => 
            a.national_id === student.national_id && 
            // 🚀 FIXED: Dropped the strict parentheses requirement!
            a.session_name.includes(`Week ${weekNum}`)
          );

          if (weekRecords.length === 0) return 'absent'; // Didn't attend any group this week

          // Did they attend? (Not excused)
          const attendedAny = weekRecords.some(r => r.is_excused === 0);
          const excusedAny = weekRecords.some(r => r.is_excused === 1);
          
          // Sum all bonuses earned across any groups they attended this week
          const weekBonuses = weekRecords.reduce((sum, r) => sum + (r.bonus_points || 0), 0);
          if (weekBonuses > 0) bonuses += weekBonuses;

          if (attendedAny) {
            attended++;
            return weekBonuses > 0 ? 'bonus' : 'present';
          } else if (excusedAny) {
            excused++;
            return 'excused';
          }

          return 'absent';
        });

        const absent = Math.max(0, totalWorkspaceWeeks - (attended + excused));

        return {
          ...student,
          attended,
          absent,
          excused,
          bonuses,
          atRisk: absent >= threshold,
          sparkline: sparkline.slice(-10) // Keep the UI clean by only sending the last 10 weeks
        };
      });

      return { success: true, data: analytics, threshold, totalSessions: totalWorkspaceWeeks };
    } catch (err: any) {
      console.error('Analytics failed:', err);
      return { success: false, msg: err.message };
    }
  });

  // 🚀 PHASE D: UPDATE THRESHOLD
  ipcMain.handle('update-threshold', (event, newThreshold) => {
    db.prepare("UPDATE settings SET value = ? WHERE key = 'absence_threshold'").run(newThreshold.toString());
    return { success: true };
  });

  // 🚀 PHASE F: FETCH INDIVIDUAL STUDENT TIMELINE (Upgraded with Modifiers)
  ipcMain.handle('get-student-attendance', (event, nationalId, workspace) => {
    try {
      // 🚀 FIXED: Now selecting is_excused and bonus_points from the database
      const stmt = db.prepare("SELECT session_name, timestamp, is_excused, bonus_points FROM attendance WHERE national_id = ? AND session_name LIKE ? ORDER BY timestamp DESC");
      return { success: true, data: stmt.all(nationalId, `[Grade ${workspace}]%`) };
    } catch (err: any) {
      return { success: false, msg: err.message };
    }
  });

// 🚀 PHASE A: GLOBAL SETTINGS & SETUP
  ipcMain.handle('get-global-settings', () => {
    try {
      const rows = db.prepare("SELECT key, value FROM settings").all() as any[];
      const config: Record<string, string> = {};
      rows.forEach(r => config[r.key] = r.value);
      return { success: true, data: config };
    } catch (err) {
      return { success: false, data: null };
    }
  });

ipcMain.handle('save-global-settings', (event, config) => {
    try {
      const insert = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
      const transaction = db.transaction((settingsObj) => {
        for (const [key, value] of Object.entries(settingsObj)) {
          insert.run(key, String(value));
        }
      });
      transaction(config);
      return { success: true };
    } catch (err: any) {
      console.error('Setup failed:', err);
      return { success: false, msg: err.message };
    }
  });

// 🚀 PHASE A: SECURE OFFLINE LICENSING
  const SECRET_LICENSE_KEY = 'Attendo_Secure_RSA_2026_!@#_Key'; // Your private signing key

  // Initialize clock tracking
  db.exec(`INSERT OR IGNORE INTO settings (key, value) VALUES ('last_opened_timestamp', '0');`);

  ipcMain.handle('get-hardware-id', async () => {
    return await generateHardwareFingerprint();
  });

  ipcMain.handle('check-license', async () => {
    try {
      const now = Date.now();
      const lastOpenedRow = db.prepare("SELECT value FROM settings WHERE key = 'last_opened_timestamp'").get() as any;
      const lastOpened = lastOpenedRow ? parseInt(lastOpenedRow.value) : 0;
      
      // 🚨 ANTI-TAMPER: Did they rewind the system clock?
      if (now < lastOpened) {
        return { valid: false, status: 'TAMPERED', msg: 'System clock anomaly detected. Security lockdown active.' };
      }
      
      // Update the clock tracker
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('last_opened_timestamp', ?)").run(now.toString());

      const tokenRow = db.prepare("SELECT value FROM settings WHERE key = 'license_token'").get() as any;
      if (!tokenRow || !tokenRow.value) return { valid: false, status: 'UNLICENSED' };

      const hwId = await generateHardwareFingerprint();
      const decoded = jwt.verify(tokenRow.value, SECRET_LICENSE_KEY) as any;
      
      // Hardware Mismatch Check
      if (decoded.hwId !== hwId) {
        return { valid: false, status: 'INVALID', msg: 'License is bound to a different machine.' };
      }

      return { valid: true, expires: decoded.exp * 1000 };
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') return { valid: false, status: 'EXPIRED', msg: 'Your license has expired.' };
      return { valid: false, status: 'INVALID', msg: 'Invalid license signature.' };
    }
  });

  ipcMain.handle('activate-license', async (event, token) => {
    try {
      const hwId = await generateHardwareFingerprint();
      const decoded = jwt.verify(token, SECRET_LICENSE_KEY) as any;
      
      if (decoded.hwId !== hwId) return { success: false, msg: 'License does not match this hardware.' };
      
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('license_token', ?)").run(token);
      return { success: true };
    } catch (err: any) {
      return { success: false, msg: 'Invalid or expired activation token.' };
    }
  });

  // 🚀 HELPER: Dynamic Export Directory Setup
  const getDynamicExportDir = (workspace: string, category: string) => {
    const desktopPath = app.getPath('desktop');
    // Builds: Desktop / Attendo Exports / Grade X / Category
    const exportDir = path.join(desktopPath, 'Attendo Exports', `Grade ${workspace}`, category);
    
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    return exportDir;
  };

  // 🚀 PHASE D: SILENT MASTER EXPORT (Week-Based Matrix Engine)
  ipcMain.handle('export-master-report', async (event, workspace, filterType) => {
    try {
      // Route it to the "Master Reports" subfolder for this specific Grade
      const exportDir = getDynamicExportDir(workspace, 'Master Reports');
      
      const typeLabel = filterType === 'All' ? 'All_Sessions' : `${filterType}s`;
      const safeName = `Grade_${workspace}_Master_Report_${typeLabel}_${new Date().toISOString().split('T')[0]}`;
      const filePath = path.join(exportDir, `${safeName}.xlsx`);

      const thresholdRow = db.prepare("SELECT value FROM settings WHERE key = 'absence_threshold'").get() as any;
      const threshold = thresholdRow ? parseInt(thresholdRow.value) : 3;

      let likePattern = `[Grade ${workspace}]%`;
      if (filterType === 'Lecture') likePattern = `[Grade ${workspace}]% - Lecture%`;
      if (filterType === 'Section') likePattern = `[Grade ${workspace}]% - Section%`;

      // 1. Extract unique weeks from the session strings
      const weekSet = new Set<number>();
      const sessions = db.prepare("SELECT DISTINCT session_name FROM attendance WHERE session_name LIKE ? ORDER BY timestamp ASC").all(likePattern) as {session_name: string}[];
      
      sessions.forEach(s => {
        // 🚀 FIXED: Dropped the strict parentheses requirement!
        const match = s.session_name.match(/Week (\d+)/);
        if (match) weekSet.add(parseInt(match[1]));
      });
      const uniqueWeeks = Array.from(weekSet).sort((a, b) => a - b);
      
      // 2. Get all active students in the workspace
      const students = db.prepare("SELECT * FROM students WHERE grade = ? AND is_deleted = 0 ORDER BY name ASC").all(workspace) as any[];

      // 3. Get all attendance records matching the filter
      const attendanceRecords = db.prepare("SELECT national_id, session_name, is_excused FROM attendance WHERE session_name LIKE ?").all(likePattern) as {national_id: string, session_name: string, is_excused: number}[];

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Master Report');

      // Build Columns Dynamically by Week instead of Session
      const columns: any[] = [
        { header: 'Name', key: 'name', width: 30 },
        { header: 'ID', key: 'national_id', width: 20 },
        { header: 'Grade', key: 'grade', width: 10 },
        { header: 'Attended', key: 'attended', width: 12 },
        { header: 'Absent', key: 'absent', width: 12 },
        { header: 'Status', key: 'status', width: 12 }
      ];

      uniqueWeeks.forEach(weekNum => {
         columns.push({ header: `Week ${weekNum}`, key: `week_${weekNum}`, width: 15 });
      });

      sheet.columns = columns;

      // Populate Rows with Week-Based Logic
      students.forEach((student: any) => {
        let attendedCount = 0;
        let excusedCount = 0;
        
        const rowData: any = {
          name: student.name,
          national_id: student.national_id,
          grade: student.grade,
        };

        uniqueWeeks.forEach(weekNum => {
           // Find ALL records for this student in this specific week (across all groups)
           const weekRecords = attendanceRecords.filter(a => 
             a.national_id === student.national_id && 
             // 🚀 FIXED: Dropped the strict parentheses requirement!
             a.session_name.includes(`Week ${weekNum}`)
           );

           let cellValue = '❌ Absent';
           
           if (weekRecords.length > 0) {
             // Did they attend ANY group this week? (Not excused)
             const attendedAny = weekRecords.some(r => r.is_excused === 0);
             if (attendedAny) {
               attendedCount++;
               cellValue = '✅ Present';
             } else {
               // If not present, were they excused from ANY group?
               const excusedAny = weekRecords.some(r => r.is_excused === 1);
               if (excusedAny) {
                 excusedCount++;
                 cellValue = '📘 Excused';
               }
             }
           }
           
           rowData[`week_${weekNum}`] = cellValue;
        });

        // Calculate absences based on total weeks, not total sessions
        const absentCount = Math.max(0, uniqueWeeks.length - (attendedCount + excusedCount));
        const isAtRisk = absentCount >= threshold;

        rowData.attended = attendedCount;
        rowData.absent = absentCount;
        rowData.status = isAtRisk ? 'At Risk' : 'Safe';

        const row = sheet.addRow(rowData);

        row.eachCell((cell, colNum) => {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          if (colNum === 2) cell.numFmt = '@'; 
          
          // Color formatting for the dynamic weekly columns
          if (colNum > 6) {
              if (cell.value === '❌ Absent') cell.font = { color: { argb: 'FFE74C3C' } };
              if (cell.value === '✅ Present') cell.font = { color: { argb: 'FF2DD4BF' } };
              if (cell.value === '📘 Excused') cell.font = { color: { argb: 'FF3B82F6' } };
          }
        });

        if (isAtRisk) {
          row.getCell('absent').font = { color: { argb: 'FFE74C3C' }, bold: true };
          row.getCell('status').font = { color: { argb: 'FFE74C3C' }, bold: true };
        }
      });

      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } };

      await workbook.xlsx.writeFile(filePath);
      return { success: true, path: filePath };
    } catch (error: any) {
      return { success: false, msg: error.message };
    }
  });

  // 🚀 PHASE D: SILENT SESSION EXPORT
  ipcMain.handle('export-to-excel', async (event, attendeesData, sessionName) => {
    try {
      // Extract the Grade number from the session string (e.g., "[Grade 3]")
      const gradeMatch = sessionName.match(/\[Grade (.*?)\]/);
      const workspace = gradeMatch ? gradeMatch[1] : 'Misc';
      
      // Determine if it's a Lecture or Section
      const category = sessionName.includes('- Lecture') ? 'Lectures' : (sessionName.includes('- Section') ? 'Sections' : 'Other');
      
      // Route it to the correct dynamic folder
      const exportDir = getDynamicExportDir(workspace, category);
      
      const safeSessionName = sessionName.replace(/[\\/:*?"<>|]/g, ''); // Remove invalid filename chars
      const filePath = path.join(exportDir, `${safeSessionName}.xlsx`);

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Attendance Log');

      // Define the columns based on what App.tsx is sending
      sheet.columns = [
        { header: '#', key: 'index', width: 8 },
        { header: 'Student Name', key: 'name', width: 35 },
        { header: 'National ID', key: 'id', width: 20 },
        { header: 'Grade', key: 'grade', width: 10 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Bonus', key: 'bonus', width: 10 }
      ];

      // Add the students
      attendeesData.forEach((student: any) => {
        const row = sheet.addRow({
          index: student.index,
          name: student.name,
          id: student.id,
          grade: student.grade,
          status: student.status || 'Present',
          bonus: student.bonus || 0
        });
        
        row.eachCell((cell, colNum) => {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          if (colNum === 3) cell.numFmt = '@'; 
          if (colNum === 5) {
             if (cell.value === 'Absent') cell.font = { color: { argb: 'FFE74C3C' }, bold: true };
             if (cell.value === 'Excused') cell.font = { color: { argb: 'FF3B82F6' }, bold: true };
             if (cell.value === 'Present') cell.font = { color: { argb: 'FF10B981' }, bold: true };
          }
        });
      });

      // Style the header row with Attendo Teal
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF14B8A6' } }; 

      await workbook.xlsx.writeFile(filePath);
      return { success: true, path: filePath };
    } catch (error: any) {
      console.error('Session export failed:', error);
      return { success: false, msg: error.message };
    }
  });

  // 🚀 PHASE D: EXPORT & BACKUP ENGINE (Native SQLite Backup)
  ipcMain.handle('export-backup', async (event, activeWorkspace) => {
    try {
      const safeBackupDir = path.join(os.homedir(), 'Attendo_Backups');
      if (!fs.existsSync(safeBackupDir)) {
        fs.mkdirSync(safeBackupDir, { recursive: true });
      }

      const safeName = `Attendo_Grade_${activeWorkspace}_Backup_${new Date().toISOString().split('T')[0]}`;
      const destPath = path.join(safeBackupDir, `${safeName}.attdb`);

      // 🚀 FIXED: Bypass Windows file-locks using SQLite's native, safe backup API
      await db.backup(destPath);

      // We attach the newly copied file and prune out the students not in this workspace
      db.exec(`ATTACH DATABASE '${destPath}' AS exportDb;`);

      const pruneTransaction = db.transaction(() => {
        db.prepare('DELETE FROM exportDb.students WHERE grade != ?').run(activeWorkspace);
        db.prepare("DELETE FROM exportDb.attendance WHERE session_name NOT LIKE ?").run(`[Grade ${activeWorkspace}]%`);
        // 🚀 CRITICAL: Silently strips out all archived sessions so they don't pollute colleague backups!
        db.prepare("DELETE FROM exportDb.attendance WHERE is_archived = 1").run();
      });

      pruneTransaction();

      // Detach the file
      db.exec(`DETACH DATABASE exportDb;`);

      return { success: true, path: destPath };
    } catch (err: any) {
      console.error('Backup export failed:', err);
      try { db.exec(`DETACH DATABASE exportDb;`); } catch(e) {}
      return { success: false, msg: err.message };
    }
  });

  // 🚀 PHASE E: STRICT WORKSPACE IMPORT & MERGE (With TA Conflict Detection)
  ipcMain.handle('import-backup', async (event, activeWorkspace) => {
    try {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      const { canceled, filePaths } = await dialog.showOpenDialog(focusedWindow!, {
        title: `Merge Colleague Backup (Grade ${activeWorkspace} Only)`,
        buttonLabel: `Merge Grade ${activeWorkspace}`,
        filters: [{ name: 'Attendo Backup File', extensions: ['attdb', 'db'] }],
        properties: ['openFile']
      });

      if (canceled || filePaths.length === 0) return { success: false, msg: 'Import Cancelled' };

      const backupPath = filePaths[0];

      // 1. Attach external DB
      db.exec(`ATTACH DATABASE '${backupPath}' AS backupDb;`);

      // 2. Find Merge Conflicts (Same student, same session, but different outcome)
      const conflicts = db.prepare(`
        SELECT l.national_id, l.session_name, 
               l.is_excused as local_excused, backup_a.is_excused as ext_excused,
               s.name
        FROM attendance l
        JOIN backupDb.attendance backup_a ON l.national_id = backup_a.national_id AND l.session_name = backup_a.session_name
        JOIN students s ON l.national_id = s.national_id
        WHERE l.session_name LIKE ? 
          AND (l.is_excused != backup_a.is_excused OR IFNULL(l.bonus_points,0) != IFNULL(backup_a.bonus_points,0))
      `).all(`[Grade ${activeWorkspace}]%`);

      if (conflicts.length > 0) {
        db.exec(`DETACH DATABASE backupDb;`);
        // We pause the import and send the conflicts to the UI!
        return { success: true, requiresResolution: true, conflicts, backupPath };
      }

      // 3. No conflicts? Proceed with strict safe merge
      const mergeTransaction = db.transaction(() => {
        db.prepare(`
          INSERT OR IGNORE INTO students (name, national_id, grade, is_deleted)
          SELECT name, national_id, grade, is_deleted FROM backupDb.students WHERE grade = ?
        `).run(activeWorkspace);

        const result = db.prepare(`
          INSERT INTO attendance (national_id, session_name, timestamp, is_excused, bonus_points, excuse_reason)
          SELECT backup_a.national_id, backup_a.session_name, backup_a.timestamp, backup_a.is_excused, backup_a.bonus_points, backup_a.excuse_reason
          FROM backupDb.attendance backup_a
          WHERE backup_a.session_name LIKE ? 
            AND backup_a.national_id IN (SELECT national_id FROM backupDb.students WHERE grade = ?)
            AND NOT EXISTS (
              SELECT 1 FROM attendance local_a 
              WHERE local_a.national_id = backup_a.national_id AND local_a.session_name = backup_a.session_name
            )
        `).run(`[Grade ${activeWorkspace}]%`, activeWorkspace);

        return result.changes;
      });

      const totalMerged = mergeTransaction();
      db.exec(`DETACH DATABASE backupDb;`);
      return { success: true, count: totalMerged, requiresResolution: false };

    } catch (err: any) {
      try { db.exec(`ROLLBACK; DETACH DATABASE backupDb;`); } catch(e) {}
      return { success: false, msg: err.message };
    }
  });

  // 🚀 NEW: API to Apply the User's Conflict Choices
  ipcMain.handle('resolve-conflicts', async (event, backupPath, resolutions, activeWorkspace) => {
    try {
      db.exec(`ATTACH DATABASE '${backupPath}' AS backupDb;`);
      let resolvedCount = 0;

      const resolveTx = db.transaction(() => {
        // Apply choices
        for (const res of resolutions) {
          if (res.keep === 'external') {
            db.prepare(`
              REPLACE INTO attendance (id, national_id, session_name, timestamp, is_excused, bonus_points, is_archived, excuse_reason, audit_trail)
              SELECT (SELECT id FROM attendance WHERE national_id = ? AND session_name = ?), 
                     national_id, session_name, timestamp, is_excused, bonus_points, is_archived, excuse_reason, audit_trail
              FROM backupDb.attendance WHERE session_name = ? AND national_id = ?
            `).run(res.national_id, res.session_name, res.session_name, res.national_id);
            resolvedCount++;
          }
        }

        // Merge the rest safely
        const result = db.prepare(`
          INSERT INTO attendance (national_id, session_name, timestamp, is_excused, bonus_points, excuse_reason)
          SELECT backup_a.national_id, backup_a.session_name, backup_a.timestamp, backup_a.is_excused, backup_a.bonus_points, backup_a.excuse_reason
          FROM backupDb.attendance backup_a
          WHERE backup_a.session_name LIKE ? 
            AND backup_a.national_id IN (SELECT national_id FROM backupDb.students WHERE grade = ?)
            AND NOT EXISTS (
              SELECT 1 FROM attendance local_a 
              WHERE local_a.national_id = backup_a.national_id AND local_a.session_name = backup_a.session_name
            )
        `).run(`[Grade ${activeWorkspace}]%`, activeWorkspace);

        return resolvedCount + result.changes;
      });

      const finalCount = resolveTx();
      db.exec(`DETACH DATABASE backupDb;`);
      return { success: true, count: finalCount };
    } catch (error: any) {
      try { db.exec(`ROLLBACK; DETACH DATABASE backupDb;`); } catch(e){}
      return { success: false, msg: error.message };
    }
  });

  // 3. QR Generation (🚀 UPDATED: Ignore deleted students)
  ipcMain.handle('get-roster-for-print', () => {
    try {
      const stmt = db.prepare('SELECT id, name, national_id, grade FROM students WHERE is_deleted = 0 ORDER BY name ASC');
      const students = stmt.all();

      const SECRET_APP_KEY = 'Attendo_Secure_2026_!@#';
      const ACADEMIC_YEAR = '2025-2026';

      const studentsWithQR = students.map((student: any) => {
        const rawString = `${student.national_id}${SECRET_APP_KEY}${ACADEMIC_YEAR}`;
        const hash = crypto.createHash('sha256').update(rawString).digest('hex');
        
        return {
          ...student,
          qrPayload: hash 
        };
      });

      return { success: true, data: studentsWithQR };
    } catch (error) {
      console.error('Failed to generate QR payloads:', error);
      return { success: false, data: [] };
    }
  });

  // 4. Network Sniffer & Server
  const getLocalIPAddress = () => {
    const interfaces = os.networkInterfaces();
    let fallbackIp = '127.0.0.1';

    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]!) {
        // Must be IPv4 and an external-facing adapter
        if (iface.family === 'IPv4' && !iface.internal) {
          // Ignore Windows disconnected "APIPA" addresses
          if (iface.address.startsWith('169.254')) continue;
          
          // 🚀 FIXED: Aggressively hunt for iOS and Android Hotspot IP subnets
          if (iface.address.startsWith('172.20.10.') || iface.address.startsWith('192.168.') || iface.address.startsWith('10.')) {
            return iface.address;
          }
          
          // Save a valid fallback just in case
          if (fallbackIp === '127.0.0.1') {
            fallbackIp = iface.address;
          }
        }
      }
    }
    return fallbackIp; 
  };

  const expressApp = express();
  expressApp.use(cors());
  expressApp.use(express.json()); 
  
  // 🚀 NEW: Expose the public folder so the phone can download html5-qrcode offline
  expressApp.use('/static', express.static(process.env.VITE_PUBLIC as string));

  // 🚀 THE OFFLINE MOBILE SCANNER PWA
  expressApp.get('/', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          <title>Attendo Scanner</title>
          
          <script src="/static/html5-qrcode.min.js"></script>
          
          <style>
            body { background-color: #0f172a; color: white; margin: 0; font-family: system-ui, sans-serif; display: flex; flex-direction: column; height: 100vh; padding: 24px; box-sizing: border-box; overscroll-behavior: none; }
            .text-center { text-align: center; }
            .mb-6 { margin-bottom: 24px; }
            .mt-2 { margin-top: 8px; }
            h1 { font-size: 1.875rem; line-height: 2.25rem; font-weight: 700; color: #2dd4bf; margin: 0; letter-spacing: -0.025em; }
            p { font-size: 0.875rem; line-height: 1.25rem; color: #94a3b8; }
            .text-red { color: #f87171 !important; font-weight: 700; }
            
            .flex-grow { flex-grow: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; position: relative; }
            #reader-container { width: 100%; max-width: 400px; margin: 0 auto; position: relative; }
            #reader { width: 100%; border-radius: 16px; overflow: hidden; border: 3px solid #14b8a6; box-shadow: 0 0 20px rgba(20, 184, 166, 0.2); background: rgba(0,0,0,0.5); }
            #reader video { object-fit: cover; }
            #reader__dashboard_section_csr span { display: none !important; }
            
            #start-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.95); z-index: 50; display: flex; flex-direction: column; align-items: center; justify-content: center; backdrop-filter: blur(10px); }
            .btn { background-color: #14b8a6; color: #0f172a; font-weight: 900; font-size: 1.25rem; padding: 24px 32px; border-radius: 16px; border: none; box-shadow: 0 0 30px rgba(20,184,166,0.5); cursor: pointer; transition: transform 0.1s; }
            .btn:active { transform: scale(0.95); }
            
            #scan-toast { position: absolute; bottom: -20px; left: 0; right: 0; padding: 16px; background-color: #14b8a6; border-radius: 12px; text-align: center; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); transform: translateY(50px); opacity: 0; transition: all 0.3s; pointer-events: none; }
            #scan-toast h2 { color: #0f172a; font-weight: 900; font-size: 1.25rem; margin: 0; }
          </style>
      </head>
      <body>
          <div id="start-overlay">
              <button id="unlock-btn" class="btn">TAP TO START SCANNER</button>
              <p style="color: rgba(45, 212, 191, 0.6); margin-top: 24px;">Unlocks Camera, Audio & Haptics</p>
          </div>
          <div class="text-center mb-6 mt-2">
              <h1>Attendo Scanner</h1>
              <p id="status">Waiting to start...</p>
          </div>
          <div class="flex-grow">
              <div id="reader-container">
                  <div id="reader"></div>
                  <div id="scan-toast"><h2>✅ SCAN SUCCESS</h2></div>
              </div>
          </div>
          <script>
              const html5QrCode = new Html5Qrcode("reader");
              const statusEl = document.getElementById('status');
              const readerEl = document.getElementById('reader');
              const scanToast = document.getElementById('scan-toast');
              const config = { fps: 15, qrbox: { width: 250, height: 250 } };
              const recentScans = new Map();
              let audioCtx = null;

              function initHardwareAndStart() {
                  document.getElementById('start-overlay').style.display = 'none';
                  statusEl.innerText = "Align QR code in the frame";
                  try {
                      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                      const osc = audioCtx.createOscillator();
                      osc.frequency.value = 0;
                      osc.connect(audioCtx.destination);
                      osc.start();
                      osc.stop(audioCtx.currentTime + 0.01);
                  } catch(e) {}
                  html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess)
                      .catch(err => {
                          statusEl.innerText = "Please allow camera access.";
                          statusEl.className = "text-red";
                      });
              }

              function playSuccessBeep() {
                  if (!audioCtx) return;
                  try {
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
              }

              function showToast() {
                  readerEl.style.borderColor = "#22c55e"; 
                  scanToast.style.opacity = "1";
                  scanToast.style.transform = "translate-y-0";
                  setTimeout(() => {
                      readerEl.style.borderColor = "#14b8a6"; 
                      scanToast.style.opacity = "0";
                      scanToast.style.transform = "translate-y-50px";
                  }, 1500);
              }

              function onScanSuccess(decodedText) {
                  const now = Date.now();
                  if (recentScans.has(decodedText) && (now - recentScans.get(decodedText) < 3000)) return; 
                  recentScans.set(decodedText, now);
                  if (navigator.vibrate) navigator.vibrate([150, 50, 150]);
                  playSuccessBeep();
                  showToast();
                  fetch('/scan', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ payload: decodedText })
                  }).catch(error => {
                      statusEl.innerText = "Network Error: Check Hotspot";
                      statusEl.className = "text-red";
                  });
              }
              document.getElementById('unlock-btn').addEventListener('click', initHardwareAndStart);
          </script>
      </body>
      </html>
    `);
  });

  ipcMain.handle('get-all-sessions', () => {
    try {
      // 🚀 FIXED: Now pulls the archive status of the session alongside the metrics
      const stmt = db.prepare(`
        SELECT session_name, 
               MIN(timestamp) as date, 
               SUM(CASE WHEN IFNULL(is_excused, 0) = 0 THEN 1 ELSE 0 END) as total_attendees,
               MAX(IFNULL(is_archived, 0)) as is_archived
        FROM attendance 
        GROUP BY session_name 
        ORDER BY date DESC
      `);
      return { success: true, data: stmt.all() };
    } catch (err) { return { success: false, data: [] }; }
  });

  ipcMain.handle('delete-session', (event, sessionName) => {
    try {
      db.prepare("DELETE FROM attendance WHERE session_name = ?").run(sessionName);
      return { success: true };
    } catch (err) { return { success: false }; }
  });

  // 🚀 NEW: Archive & Restore Session APIs
  ipcMain.handle('archive-session', (event, sessionName) => {
    try {
      db.prepare("UPDATE attendance SET is_archived = 1 WHERE session_name = ?").run(sessionName);
      return { success: true };
    } catch (err) { return { success: false }; }
  });

  ipcMain.handle('restore-session', (event, sessionName) => {
    try {
      db.prepare("UPDATE attendance SET is_archived = 0 WHERE session_name = ?").run(sessionName);
      return { success: true };
    } catch (err) { return { success: false }; }
  });

  // 🚀 PHASE 2: AUDIT LEDGER - Fetch session roster with attendance status
  ipcMain.handle('get-session-details', (event, sessionName, workspace) => {
    try {
      const stmt = db.prepare(`
        SELECT 
          s.name, 
          s.national_id, 
          CASE WHEN a.national_id IS NOT NULL AND a.is_excused = 0 THEN 1 ELSE 0 END as present,
          IFNULL(a.is_excused, 0) as is_excused,
          IFNULL(a.bonus_points, 0) as bonus_points,
          IFNULL(a.excuse_reason, '') as excuse_reason
        FROM students s
        LEFT JOIN attendance a ON s.national_id = a.national_id AND a.session_name = ?
        WHERE s.grade = ? AND s.is_deleted = 0
        ORDER BY s.name ASC
      `);
      
      const records = stmt.all(sessionName, workspace).map((row: any) => ({
        ...row,
        present: row.present === 1,
        is_excused: row.is_excused === 1,
        bonus_points: row.bonus_points,
        excuse_reason: row.excuse_reason
      }));
      
      return { success: true, data: records };
    } catch (err: any) {
      return { success: false, msg: err.message };
    }
  });

  // 🚀 PHASE 2: AUDIT LEDGER - Retroactively toggle attendance & log to Audit Trail
  ipcMain.handle('toggle-attendance', (event, sessionName, nationalId, newStatus) => {
    try {
      const now = new Date().toLocaleString();
      
      if (newStatus) {
        db.prepare(`
          INSERT INTO attendance (national_id, session_name, audit_trail)
          SELECT ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM attendance WHERE national_id = ? AND session_name = ?)
        `).run(nationalId, sessionName, JSON.stringify([{ time: now, action: 'Marked Present manually' }]), nationalId, sessionName);
        
        db.prepare(`UPDATE attendance SET is_excused = 0, excuse_reason = NULL WHERE national_id = ? AND session_name = ?`).run(nationalId, sessionName);
      } else {
        db.prepare(`DELETE FROM attendance WHERE national_id = ? AND session_name = ?`).run(nationalId, sessionName);
      }
      return { success: true };
    } catch (err: any) { return { success: false, msg: err.message }; }
  });

  ipcMain.handle('update-modifier', (event, sessionName, nationalId, field, value, reason = null) => {
    try {
      const now = new Date().toLocaleString();
      
      // Ensure row exists
      db.prepare(`
        INSERT INTO attendance (national_id, session_name)
        SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM attendance WHERE national_id = ? AND session_name = ?)
      `).run(nationalId, sessionName, nationalId, sessionName);

      // Fetch existing trail
      const current = db.prepare("SELECT audit_trail FROM attendance WHERE session_name = ? AND national_id = ?").get(sessionName, nationalId) as any;
      const trail = current?.audit_trail ? JSON.parse(current.audit_trail) : [];

      if (field === 'bonus') {
        trail.push({ time: now, action: `Bonus points adjusted to ${value}` });
        db.prepare(`UPDATE attendance SET bonus_points = ?, audit_trail = ? WHERE national_id = ? AND session_name = ?`)
          .run(value, JSON.stringify(trail), nationalId, sessionName);
      } else if (field === 'excuse') {
        const logMsg = value ? `Marked Excused (${reason})` : `Removed Excuse`;
        trail.push({ time: now, action: logMsg });
        db.prepare(`UPDATE attendance SET is_excused = ?, excuse_reason = ?, audit_trail = ? WHERE national_id = ? AND session_name = ?`)
          .run(value ? 1 : 0, reason, JSON.stringify(trail), nationalId, sessionName);
      }
      return { success: true };
    } catch (err: any) { return { success: false, msg: err.message }; }
  });

  // 🚀 NEW: Silent Shadow Backup Engine
const fs = require('fs');
const path = require('path');

  ipcMain.handle('trigger-shadow-backup', async () => {
    try {
      const backupDir = path.join(os.homedir(), 'Attendo_Backups', 'Shadow_Copies');
      
      // Create the backup folder if it doesn't exist
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      // Connect to your live database file
      const liveDbPath = path.join(app.getPath('userData'), 'attendo_core.db'); 
      
      const recent = path.join(backupDir, 'Attendo_Backup_Recent.attdb');
      const older = path.join(backupDir, 'Attendo_Backup_Older.attdb');
      const oldest = path.join(backupDir, 'Attendo_Backup_Oldest.attdb');

      // 1. Delete the oldest backup (The rolling mechanism)
      if (fs.existsSync(oldest)) fs.unlinkSync(oldest);
      
      // 2. Shift 'Older' down to 'Oldest'
      if (fs.existsSync(older)) fs.renameSync(older, oldest);
      
      // 3. Shift 'Recent' down to 'Older'
      if (fs.existsSync(recent)) fs.renameSync(recent, older);

      // 4. Save the exact current state as the new 'Recent'
      fs.copyFileSync(liveDbPath, recent);
      
      return { success: true };
    } catch (err: any) {
      console.error('Shadow Backup Failed:', err);
      return { success: false, msg: err.message };
    }
  });
  
  // 🚀 UPDATED: Foolproof Factory Reset Database
  ipcMain.handle('factory-reset', async () => {
    try {
      const wipeData = db.transaction(() => {
        // 1. Get every single table in the database EXCEPT settings and internal trackers
        const tables = db.prepare(`
          SELECT name FROM sqlite_master 
          WHERE type='table' 
          AND name NOT IN ('settings', 'sqlite_sequence')
        `).all() as {name: string}[];

        // 2. Loop through and delete all rows from each table dynamically
        for (const table of tables) {
          db.prepare(`DELETE FROM "${table.name}"`).run();
        }
      });

      wipeData();
      return { success: true };
    } catch (err: any) {
      console.error("Factory Reset Error:", err);
      return { success: false, msg: err.message };
    }
  });

  expressApp.post('/scan', (req, res) => {
    const { payload } = req.body;
    console.log("📱 Incoming Scan from Mobile:", payload);
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) windows[0].webContents.send('student-scanned', payload);
    res.sendStatus(200);
  });

  let globalScannerPort = 8443;
  const ipAddress = getLocalIPAddress();

  try {
    const pki = forge.pki;
    const keys = pki.rsa.generateKeyPair(2048);
    const cert = pki.createCertificate();
    
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01'; 
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

    const attrs = [{ name: 'commonName', value: ipAddress }];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);

    cert.setExtensions([
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', serverAuth: true }, 
      { name: 'subjectAltName', altNames: [{ type: 7, ip: ipAddress }] }
    ]);

    cert.sign(keys.privateKey, forge.md.sha256.create());
    const pemCert = pki.certificateToPem(cert);
    const pemKey = pki.privateKeyToPem(keys.privateKey);

    const httpsServer = https.createServer({
      key: pemKey,
      cert: pemCert,
      secureOptions: crypto.constants.SSL_OP_NO_TLSv1 | crypto.constants.SSL_OP_NO_TLSv1_1
    }, expressApp);

    const startServer = (port: number) => {
      httpsServer.listen(port, '0.0.0.0', () => {
        globalScannerPort = port;
        console.log(`📡 Secure Mobile Server hosting on https://${ipAddress}:${port}`);
      }).on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') startServer(port + 1);
      });
    };
    
    startServer(8443);

  } catch (sslError) {}

  ipcMain.handle('get-local-ip', () => {
    // 🚀 FIXED: Dynamically fetch the fresh IP the exact millisecond the user clicks the button
    const freshIp = getLocalIPAddress();
    return `https://${freshIp}:${globalScannerPort}`;
  });
});