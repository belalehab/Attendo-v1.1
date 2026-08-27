import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import Database from "@tauri-apps/plugin-sql";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";

export async function initTauriApi() {
  const db = await Database.load("sqlite:attendo_core.db");

  // Database Initialization Migrations
  await db.execute(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      national_id TEXT UNIQUE,
      grade TEXT,
      status TEXT DEFAULT 'offline'
    );
  `);
  
  await db.execute(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      national_id TEXT,
      session_name TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  
  await db.execute(`INSERT OR IGNORE INTO settings (key, value) VALUES ('absence_threshold', '3')`);

  // Safe migrations
  const tryMigrate = async (sql: string) => {
    try { await db.execute(sql); } catch (e) {}
  };
  
  await tryMigrate("ALTER TABLE students ADD COLUMN is_deleted INTEGER DEFAULT 0;");
  await tryMigrate("ALTER TABLE attendance ADD COLUMN is_excused INTEGER DEFAULT 0;");
  await tryMigrate("ALTER TABLE attendance ADD COLUMN bonus_points INTEGER DEFAULT 0;");
  await tryMigrate("ALTER TABLE attendance ADD COLUMN is_archived INTEGER DEFAULT 0;");
  await tryMigrate("ALTER TABLE attendance ADD COLUMN excuse_reason TEXT DEFAULT NULL;");
  await tryMigrate("ALTER TABLE attendance ADD COLUMN audit_trail TEXT DEFAULT '[]';");

  // Mount API to window
  
    const generateExcelBuffer = async (attendeesData: any[]) => {
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Attendance Log');

        sheet.columns = [
          { header: '#', key: 'index', width: 8 },
          { header: 'Student Name', key: 'name', width: 35 },
          { header: 'National ID', key: 'id', width: 20 },
          { header: 'Grade', key: 'grade', width: 10 },
          { header: 'Status', key: 'status', width: 15 },
          { header: 'Bonus', key: 'bonus', width: 10 }
        ];

        attendeesData.forEach((student, i) => {
          const row = sheet.addRow({
            index: i + 1,
            name: student.name,
            id: student.id || student.nationalId || student.national_id,
            grade: student.grade,
            status: student.status || 'Present',
            bonus: student.bonus || 0
          });
          
          row.eachCell((cell, colNum) => {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            if (colNum === 5) {
               if (cell.value === 'Absent') cell.font = { color: { argb: 'FFE74C3C' }, bold: true };
               if (cell.value === 'Excused') cell.font = { color: { argb: 'FF3B82F6' }, bold: true };
               if (cell.value === 'Present') cell.font = { color: { argb: 'FF10B981' }, bold: true };
            }
          });
        });

        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF14B8A6' } };

        return new Uint8Array(await workbook.xlsx.writeBuffer());
    };

    const generatePDFBuffer = async (attendeesData: any[], sessionName: string) => {
        const jsPDF = (await import('jspdf')).default;
        const autoTable = (await import('jspdf-autotable')).default;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });

        const settingsRows: any[] = await db.select("SELECT key, value FROM settings");
        const globalSettings: any = {};
        settingsRows.forEach(r => globalSettings[r.key] = r.value);

        const gradeMatch = sessionName.match(/\[Grade (.*?)\]/);
        const workspace = gradeMatch ? gradeMatch[1] : 'Unknown';

        const fontBytes = await fetch('/fonts/Amiri-Regular.ttf').then(res => res.arrayBuffer());
        let binary = '';
        const bytes = new Uint8Array(fontBytes);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const fontBase64 = btoa(binary);
        doc.addFileToVFS('Amiri-Regular.ttf', fontBase64);
        doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
        doc.addFont('Amiri-Regular.ttf', 'Amiri', 'bold');
        
        doc.setFont('Amiri');

        const logoBytes = await fetch('/attendo-icon.png').then(res => res.arrayBuffer());
        let logoBinary = '';
        const logoBytesU8 = new Uint8Array(logoBytes);
        for (let i = 0; i < logoBytesU8.byteLength; i++) {
            logoBinary += String.fromCharCode(logoBytesU8[i]);
        }
        const attendoLogoBase64 = 'data:image/png;base64,' + btoa(logoBinary);

        const pageWidth = doc.internal.pageSize.getWidth();
        const drawLogos = () => {
          const univLogo = globalSettings[`${workspace}_university_logo`] || globalSettings.university_logo;
          if (univLogo) {
            doc.addImage(univLogo, 'PNG', 40, 20, 60, 60);
          }
          
          const facLogo = globalSettings[`${workspace}_faculty_logo`] || globalSettings.faculty_logo;
          if (facLogo) {
            doc.addImage(facLogo, 'PNG', pageWidth - 100, 20, 60, 60);
          }
        };

        const currentYear = new Date().getFullYear();
        const academicYear = `${currentYear}/${currentYear + 1}`;
        const semester = globalSettings.semester || 'Semester';
        const subjects = JSON.parse(globalSettings.subject_name || '{}');
        const activeSubject = subjects[workspace] || globalSettings.subject_name || 'Subject';
        
        const parts = sessionName.split(' - ');
        let detailsText = '';
        if (parts.length >= 5) {
          const extractedSemester = parts[1] || semester;
          const week = parts[2] || '';
          const type = parts[3] || '';
          let topic = '';
          let group = '';
          if (parts.length > 5) {
            topic = parts.slice(4, parts.length - 1).join(' - ');
            group = parts[parts.length - 1];
          } else {
            group = parts[4];
          }

          detailsText = `${extractedSemester} - ${academicYear} | ${activeSubject}`;
          if (topic) detailsText += ` | ${topic}`;
          if (type && group) {
            detailsText += ` | ${type} - ${group.replace('Group ', '')}`;
          } else if (type || group) {
            detailsText += ` | ${type || group.replace('Group ', '')}`;
          }
          if (week) detailsText += ` | ${week}`;
        } else {
          detailsText = sessionName;
        }

        doc.setFontSize(10);
        doc.setFont(/[\u0600-\u06FF]/.test(detailsText) ? 'Amiri' : 'times', 'normal');
        const splitDetails = doc.splitTextToSize(detailsText, pageWidth - 260);
        let tableStartY = 80 + (splitDetails.length * 12) + 10;

        const drawHeaderText = () => {
          const univText = globalSettings[`${workspace}_university_name`] || globalSettings.university_name || 'Official Report';
          const facText = globalSettings[`${workspace}_faculty_name`] || globalSettings.faculty_name || '';

          doc.setFontSize(18);
          doc.setFont(/[\u0600-\u06FF]/.test(univText) ? 'Amiri' : 'times', 'bold');
          doc.setTextColor(0, 0, 0);
          doc.text(univText, pageWidth / 2, 40, { align: 'center' });
          
          doc.setFontSize(12);
          doc.setFont(/[\u0600-\u06FF]/.test(facText) ? 'Amiri' : 'times', 'normal');
          doc.text(facText, pageWidth / 2, 60, { align: 'center' });

          doc.setFontSize(10);
          doc.setFont(/[\u0600-\u06FF]/.test(detailsText) ? 'Amiri' : 'times', 'normal');
          doc.text(splitDetails, pageWidth / 2, 80, { align: 'center' });
          
          doc.setFont('Amiri', 'normal');
        };

        const drawFooter = (data?: any) => {
          const pageHeight = doc.internal.pageSize.getHeight();
          const pageWidth = doc.internal.pageSize.getWidth();
          
          doc.setDrawColor(20, 184, 166);
          doc.setLineWidth(0.5);
          doc.line(40, pageHeight - 40, pageWidth - 40, pageHeight - 40);

          doc.addImage(attendoLogoBase64, 'PNG', 40, pageHeight - 35, 20, 20);

          doc.setFontSize(9);
          doc.setFont('Amiri', 'normal');
          doc.setTextColor(150, 150, 150);
          doc.text(`Powered by Attendo - ${new Date().getFullYear()}`, 65, pageHeight - 21);
        };

        const isArabic = /[\u0600-\u06FF]/.test(attendeesData[0]?.name || sessionName);
        let headRow = ['#', 'Student Name', 'Grade', 'Status', 'Bonus'];
        if (isArabic) headRow = headRow.reverse();
        const head = [headRow];

        const body = attendeesData.map((student) => {
          let rowData = [
            student.index.toString(),
            student.name,
            student.grade || '',
            student.status || 'Present',
            (student.bonus || 0).toString()
          ];
          if (isArabic) rowData = rowData.reverse();
          return rowData;
        });

        const totalCols = headRow.length;
        const statusColIndex = isArabic ? totalCols - 4 : 3;

        autoTable(doc, {
          startY: tableStartY,
          margin: { top: tableStartY },
          head: head,
          body: body,
          theme: 'striped',
          rowPageBreak: 'avoid',
          styles: { font: 'Amiri', fontSize: 10, cellPadding: 5, halign: 'center' },
          headStyles: { fillColor: [20, 184, 166], textColor: 255, halign: 'center' },
          didDrawPage: function(data: any) {
            drawLogos();
            drawHeaderText();
            drawFooter();
            
            const pageHeight = doc.internal.pageSize.getHeight();
            const pageWidth = doc.internal.pageSize.getWidth();
            doc.setFontSize(9);
            doc.setFont('Amiri', 'normal');
            doc.setTextColor(150, 150, 150);
            doc.text(`Page ${doc.getCurrentPageInfo().pageNumber}`, pageWidth - 40, pageHeight - 21, { align: 'right' });
          },
          didParseCell: function (data: any) {
            if (data.section === 'body') {
              if (data.column.index === statusColIndex) {
                data.cell.styles.fontStyle = 'bold';
                if (data.cell.raw === 'Absent') data.cell.styles.textColor = [239, 68, 68];
                else if (data.cell.raw === 'Excused') data.cell.styles.textColor = [59, 130, 246];
                else if (data.cell.raw === 'Present') data.cell.styles.textColor = [16, 185, 129];
              }
            }
          }
        });

        return new Uint8Array(doc.output('arraybuffer'));
    };

    const performAutoShadowExport = async (sessionName: string, pdfBuffer: Uint8Array, excelBuffer: Uint8Array) => {
      try {
        await invoke('auto_shadow_export', { 
            sessionName, 
            pdfBytes: Array.from(pdfBuffer), 
            excelBytes: Array.from(excelBuffer),
            filenameOverride: null
        });
      } catch (e) {
        console.error("Shadow export failed:", e);
      }
    };

    const generateMasterExcelBuffer = async (workspace: string, filterType: string, db: any) => {
        const thresholdRow: any = await db.select("SELECT value FROM settings WHERE key = 'absence_threshold'");
        const threshold = thresholdRow.length > 0 ? parseInt(thresholdRow[0].value) : 3;

        let likePattern = `[Grade ${workspace}]%`;
        if (filterType === 'Lecture') likePattern = `[Grade ${workspace}]% - Lecture%`;
        if (filterType === 'Section') likePattern = `[Grade ${workspace}]% - Section%`;

        const sessions: any[] = await db.select("SELECT DISTINCT session_name FROM attendance WHERE session_name LIKE $1 AND is_archived = 0 ORDER BY timestamp ASC", [likePattern]);
        const sessionNames = sessions.map(s => s.session_name);
        const totalSessionsCount = sessionNames.length;

        const students: any[] = await db.select("SELECT * FROM students WHERE grade = $1 AND is_deleted = 0 ORDER BY name ASC", [workspace]);
        const attendanceRecords: any[] = await db.select("SELECT national_id, session_name, is_excused FROM attendance WHERE session_name LIKE $1 AND is_archived = 0", [likePattern]);

        // @ts-ignore
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Master Report');

        const columns: any[] = [
          { header: 'Name', key: 'name', width: 30 },
          { header: 'ID', key: 'national_id', width: 20 },
          { header: 'Grade', key: 'grade', width: 10 },
          { header: 'Attended', key: 'attended', width: 12 },
          { header: 'Absent', key: 'absent', width: 12 },
          { header: 'Status', key: 'status', width: 12 }
        ];

        sessionNames.forEach((sessionName, index) => {
           const shortName = sessionName.replace(`[Grade ${workspace}] `, '');
           columns.push({ header: shortName, key: `session_${index}`, width: 18 });
        });
        sheet.columns = columns;

        students.forEach((student: any) => {
          let attendedCount = 0;
          let excusedCount = 0;
          
          const rowData: any = {
            name: student.name,
            national_id: student.national_id,
            grade: student.grade,
          };

          sessionNames.forEach((sessionName, index) => {
             const record = attendanceRecords.find(a => 
               a.national_id === student.national_id && 
               a.session_name === sessionName
             );

             let cellValue = '❌ Absent';
             if (record) {
               if (record.is_excused === 0) {
                 attendedCount++;
                 cellValue = '✅ Present';
               } else if (record.is_excused === 1) {
                 excusedCount++;
                 cellValue = '📘 Excused';
               }
             }
             rowData[`session_${index}`] = cellValue;
          });

          const absentCount = Math.max(0, totalSessionsCount - (attendedCount + excusedCount));
          const isAtRisk = absentCount >= threshold;

          rowData.attended = attendedCount;
          rowData.absent = absentCount;
          rowData.status = isAtRisk ? 'At Risk' : 'Safe';

          const row = sheet.addRow(rowData);

          row.eachCell((cell, colNum) => {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            if (colNum > 6) {
                if (cell.value === '❌ Absent') cell.font = { color: { argb: 'FFE74C3C' } };
                if (cell.value === '✅ Present') cell.font = { color: { argb: 'FF2DD4BF' } };
                if (cell.value === '📘 Excused') cell.font = { color: { argb: 'FF3B82F6' } };
            }
          });

          const statusCell = row.getCell('status');
          if (isAtRisk) {
              statusCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
              statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE74C3C' } };
          }
        });

        const buffer = await workbook.xlsx.writeBuffer();
        return new Uint8Array(buffer);
    };

  (window as any).api = {
    getHardwareId: () => invoke("get_hardware_id"),
    checkLicense: async () => {
      try {
        const now = Date.now();
        const lastOpenedRow: any = await db.select("SELECT value FROM settings WHERE key = 'last_opened_timestamp'");
        const lastOpened = lastOpenedRow[0]?.value ? parseInt(lastOpenedRow[0].value) : 0;
        
        if (now < lastOpened) {
          return { valid: false, status: 'TAMPERED', msg: 'System clock anomaly detected. Security lockdown active.' };
        }
        
        await db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('last_opened_timestamp', $1)", [now.toString()]);
        
        const tokenRow: any = await db.select("SELECT value FROM settings WHERE key = 'license_token'");
        if (!tokenRow || !tokenRow[0] || !tokenRow[0].value) {
          return { valid: false, status: 'UNLICENSED' };
        }
        
        const token = tokenRow[0].value;
        const isValid = await invoke("check_license", { token });
        
        return { valid: true, expires: 9999999999999 };
      } catch (e: any) {
        return { valid: false, status: 'INVALID', msg: e.toString() };
      }
    },
    
    activateLicense: async (token: string) => {
      try {
        const isValid = await invoke("check_license", { token });
        if (isValid) {
          await db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('license_token', $1)", [token]);
          return { success: true };
        }
        return { success: false, msg: 'License does not match this hardware.' };
      } catch (e: any) {
        return { success: false, msg: e.toString() };
      }
    },

    getDashboardStats: async () => {
      const res: any = await db.select("SELECT COUNT(*) as total FROM students WHERE is_deleted = 0");
      return { totalStudents: res[0]?.total || 0, activeSession: "Online (Secure)" };
    },
    
    getGlobalSettings: async () => {
      const res: any = await db.select("SELECT * FROM settings");
      const config: any = {};
      res.forEach((row: any) => { config[row.key] = row.value; });
      return { success: true, data: config };
    },
    
    saveGlobalSettings: async (config: any) => {
      for (const key of Object.keys(config)) {
        await db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ($1, $2)", [key, config[key]]);
      }
      return { success: true };
    },

    getRoster: async () => {
      const data = await db.select("SELECT * FROM students WHERE is_deleted = 0 ORDER BY name ASC");
      return { success: true, data };
    },

    getRosterForPrint: async () => {
      try {
        const data: any = await db.select("SELECT id, name, national_id, grade FROM students WHERE is_deleted = 0 ORDER BY name ASC");
        
        const SECRET_APP_KEY = 'Attendo_Secure_2026_!@#';
        const ACADEMIC_YEAR = '2025-2026';

        // Helper to hash string using Web Crypto API
        const sha256 = async (message: string) => {
            const msgBuffer = new TextEncoder().encode(message);                    
            const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        };

        const studentsWithQR = await Promise.all(data.map(async (student: any) => {
          const rawString = `${student.national_id}${SECRET_APP_KEY}${ACADEMIC_YEAR}`;
          const hash = await sha256(rawString);
          return {
            ...student,
            qrPayload: `${student.national_id}|${hash}`
          };
        }));
        
        return { success: true, data: studentsWithQR };
      } catch (err: any) {
        return { success: false, msg: err.toString() };
      }
    },

    importRoster: async (students: any[]) => {
      let count = 0;
      for (const student of students) {
        const res: any = await db.execute(
          "INSERT OR IGNORE INTO students (name, national_id, grade) VALUES ($1, $2, $3)", 
          [student.name, student.nationalId, student.grade]
        );
        if (res.rowsAffected > 0) count++;
      }
      return { success: true, count };
    },

    softDeleteStudent: async (id: string) => {
      await db.execute("UPDATE students SET is_deleted = 1 WHERE national_id = $1", [id]);
      return { success: true };
    },

    permanentlyDeleteStudent: async (id: string) => {
      // 1. Delete all attendance records
      await db.execute("DELETE FROM attendance WHERE national_id = $1", [id]);
      // 2. Delete the student
      await db.execute("DELETE FROM students WHERE national_id = $1", [id]);
      return { success: true };
    },

    getDeletedRoster: async () => {
      const data = await db.select("SELECT * FROM students WHERE is_deleted = 1 ORDER BY name ASC");
      return { success: true, data };
    },

    restoreStudent: async (id: string) => {
      await db.execute("UPDATE students SET is_deleted = 0 WHERE national_id = $1", [id]);
      return { success: true };
    },

    updateStudentName: async (id: string, newName: string) => {
      await db.execute("UPDATE students SET name = $1 WHERE national_id = $2", [newName, id]);
      return { success: true };
    },

    saveSessionData: async (sessionName: string, attendees: any[]) => {
      try {
        for (const student of attendees) {
          const id = student.id || student.nationalId || student.national_id;
          const exists: any[] = await db.select("SELECT id FROM attendance WHERE national_id = $1 AND session_name = $2", [id, sessionName]);
          
          if (exists.length === 0) {
            await db.execute(
              "INSERT INTO attendance (national_id, session_name, bonus_points) VALUES ($1, $2, $3)", 
              [id, sessionName, student.bonus || 0]
            );
          } else {
            await db.execute(
              "UPDATE attendance SET bonus_points = $1 WHERE national_id = $2 AND session_name = $3", 
              [student.bonus || 0, id, sessionName]
            );
          }
        }
        return { success: true };
      } catch (err: any) {
        return { success: false, msg: err.toString() };
      }
    },

    getAllSessions: async () => {
      const data: any = await db.select(`
        SELECT session_name, 
               MIN(timestamp) as date, 
               SUM(CASE WHEN IFNULL(is_excused, 0) = 0 THEN 1 ELSE 0 END) as total_attendees,
               MAX(IFNULL(is_archived, 0)) as is_archived
        FROM attendance 
        GROUP BY session_name 
        ORDER BY date DESC
      `);
      return { success: true, data };
    },

    deleteSession: async (name: string) => {
      await db.execute("DELETE FROM attendance WHERE session_name = $1", [name]);
      return { success: true };
    },

    archiveSession: async (name: string) => {
      await db.execute("UPDATE attendance SET is_archived = 1 WHERE session_name = $1", [name]);
      return { success: true };
    },

    restoreSession: async (name: string) => {
      await db.execute("UPDATE attendance SET is_archived = 0 WHERE session_name = $1", [name]);
      return { success: true };
    },

    getSessionDetails: async (sessionName: string, workspace: string) => {
      try {
        const records: any[] = await db.select(`
          SELECT 
            s.name, 
            s.national_id, 
            CASE WHEN a.national_id IS NOT NULL AND a.is_excused = 0 THEN 1 ELSE 0 END as present,
            IFNULL(a.is_excused, 0) as is_excused,
            IFNULL(a.bonus_points, 0) as bonus_points,
            IFNULL(a.excuse_reason, '') as excuse_reason
          FROM students s
          LEFT JOIN attendance a ON s.national_id = a.national_id AND a.session_name = $1
          WHERE s.grade = $2 AND s.is_deleted = 0
          ORDER BY s.name ASC
        `, [sessionName, workspace]);
        
        const mapped = records.map(row => ({
          ...row,
          present: row.present === 1,
          is_excused: row.is_excused === 1,
          bonus_points: row.bonus_points,
          excuse_reason: row.excuse_reason
        }));
        
        return { success: true, data: mapped };
      } catch (err: any) {
        return { success: false, msg: err.toString() };
      }
    },

    toggleAttendance: async (sessionName: string, nationalId: string, newStatus: boolean) => {
      if (newStatus) {
        await db.execute(`
          INSERT INTO attendance (national_id, session_name, is_archived) 
          SELECT $1, $2, IFNULL((SELECT MAX(is_archived) FROM attendance WHERE session_name = $2), 0)
        `, [nationalId, sessionName]);
      } else {
        await db.execute("DELETE FROM attendance WHERE session_name = $1 AND national_id = $2", [sessionName, nationalId]);
      }
      return { success: true };
    },

    updateModifier: async (sessionName: string, nationalId: string, field: string, value: any, reason?: string) => {
      // 1. Ensure the row exists and inherits the session's archive state
      await db.execute(`
        INSERT INTO attendance (national_id, session_name, is_archived)
        SELECT $1, $2, IFNULL((SELECT MAX(is_archived) FROM attendance WHERE session_name = $2), 0)
        WHERE NOT EXISTS (SELECT 1 FROM attendance WHERE national_id = $3 AND session_name = $4)
      `, [nationalId, sessionName, nationalId, sessionName]);

      // 2. Update specific fields
      if (field === 'bonus') {
        await db.execute(`UPDATE attendance SET bonus_points = $1 WHERE national_id = $2 AND session_name = $3`, [value, nationalId, sessionName]);
      } else if (field === 'excuse') {
        await db.execute(`UPDATE attendance SET is_excused = $1, excuse_reason = $2 WHERE national_id = $3 AND session_name = $4`, [value ? 1 : 0, reason || '', nationalId, sessionName]);
        
        // If un-excusing an absent student, they should be completely removed from the table again 
        // to maintain clean data (since they are neither present nor excused)
        if (!value) {
           await db.execute(`DELETE FROM attendance WHERE national_id = $1 AND session_name = $2 AND is_excused = 0 AND (bonus_points IS NULL OR bonus_points = 0)`, [nationalId, sessionName]);
        }
      }
      return { success: true };
    },

    onStudentScanned: (callback: any) => {
      listen("student-scanned", (event) => {
        callback(event.payload);
      });
    },

    downloadTemplate: async () => {
      try {
        const filePath = await save({
          filters: [{ name: 'CSV', extensions: ['csv'] }],
          defaultPath: 'Attendo_Roster_Template.csv'
        });
        if (!filePath) return { success: false, msg: 'Cancelled' };
        
        const headers = "Name,ID,Grade\n";
        const sampleData = "أحمد محمد,=\"12345678901234\",1\n";
        const csvContent = "\uFEFF" + headers + sampleData;
        
        await writeTextFile(filePath, csvContent);
        return { success: true };
      } catch (err: any) {
        return { success: false, msg: err.toString() };
      }
    },

    saveBlob: async (blobData: ArrayBuffer, defaultName: string) => {
      try {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const { writeFile } = await import('@tauri-apps/plugin-fs');
        
        const filePath = await save({
          defaultPath: defaultName
        });
        
        if (!filePath) return { success: false, msg: 'Cancelled' };
        
        await writeFile(filePath, new Uint8Array(blobData));
        return { success: true };
      } catch (err: any) {
        return { success: false, msg: err.toString() };
      }
    },

    getSemesterAnalytics: async (workspace: string, filterType: string, isArchived: boolean = false) => {
      try {
        const thresholdRow: any = await db.select("SELECT value FROM settings WHERE key = 'absence_threshold'");
        const threshold = thresholdRow.length > 0 ? parseInt(thresholdRow[0].value) : 3;

        let likePattern = `[Grade ${workspace}]%`;
        if (filterType === 'Lecture') likePattern = `[Grade ${workspace}]% - Lecture%`;
        if (filterType === 'Section') likePattern = `[Grade ${workspace}]% - Section%`;

        const archiveFilter = isArchived ? 1 : 0;
        const allAttendance: any[] = await db.select(`SELECT national_id, session_name, is_excused, bonus_points FROM attendance WHERE session_name LIKE $1 AND is_archived = $2`, [likePattern, archiveFilter]);
        const sessions: any[] = await db.select("SELECT DISTINCT session_name FROM attendance WHERE session_name LIKE $1 AND is_archived = $2 ORDER BY timestamp ASC", [likePattern, archiveFilter]);
        
        const totalSessionsCount = sessions.length;

        const students: any[] = await db.select("SELECT * FROM students WHERE grade = $1 AND is_deleted = 0 ORDER BY name ASC", [workspace]);

        const analytics = students.map(student => {
          let attended = 0;
          let excused = 0;
          let bonuses = 0;

          const sparkline = sessions.map(session => {
            const record = allAttendance.find(a => 
              a.national_id === student.national_id && 
              a.session_name === session.session_name
            );
            
            if (!record) return 'absent';
            if (record.bonus_points > 0) bonuses += record.bonus_points;

            if (record.is_excused === 1) {
              excused++;
              return 'excused';
            } else {
              attended++;
              return record.bonus_points > 0 ? 'bonus' : 'present';
            }
          });

          const absent = Math.max(0, totalSessionsCount - (attended + excused));
          return {
            ...student,
            attended,
            absent,
            excused,
            bonuses,
            atRisk: absent >= threshold,
            sparkline: sparkline.slice(-10)
          };
        });

        return { success: true, data: analytics, threshold, totalSessions: totalSessionsCount };
      } catch (e: any) {
        return { success: false, msg: e.toString() };
      }
    },

    exportMasterReport: async (workspace: string, filterType: string) => {
      try {
        const filePath = await save({
          filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
          defaultPath: `Grade_${workspace}_${filterType}_Master_Report.xlsx`
        });
        if (!filePath) return { success: false, msg: 'Cancelled' };

        const excelBuffer = await generateMasterExcelBuffer(workspace, filterType, db);
        const { writeFile } = await import('@tauri-apps/plugin-fs');
        await writeFile(filePath, excelBuffer);
        
        try {
          await invoke('auto_shadow_export', { 
            sessionName: `[Grade ${workspace}] - A - B - Master reports`, 
            pdfBytes: [], 
            excelBytes: Array.from(excelBuffer),
            filenameOverride: `Grade_${workspace}_${filterType}_Master_Report`
          });
        } catch (e) {}

        return { success: true };
      } catch (e: any) {
        return { success: false, msg: e.toString() };
      }
    },

    exportMasterReportPDF: async (workspace: string, filterType: string, globalSettings: any, chartsBase64?: string) => {
      try {
        const filePath = await save({
          filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
          defaultPath: `Grade_${workspace}_${filterType}_Master_Report.pdf`
        });
        if (!filePath) return { success: false, msg: 'Cancelled' };

        const thresholdRow: any = await db.select("SELECT value FROM settings WHERE key = 'absence_threshold'");
        const threshold = thresholdRow.length > 0 ? parseInt(thresholdRow[0].value) : 3;

        let likePattern = `[Grade ${workspace}]%`;
        if (filterType === 'Lecture') likePattern = `[Grade ${workspace}]% - Lecture%`;
        if (filterType === 'Section') likePattern = `[Grade ${workspace}]% - Section%`;

        const sessions: any[] = await db.select("SELECT DISTINCT session_name FROM attendance WHERE session_name LIKE $1 AND is_archived = 0 ORDER BY timestamp ASC", [likePattern]);
        const sessionNames = sessions.map(s => s.session_name);
        const totalSessionsCount = sessionNames.length;

        const students: any[] = await db.select("SELECT * FROM students WHERE grade = $1 AND is_deleted = 0 ORDER BY name ASC", [workspace]);
          const attendanceRecords: any[] = await db.select("SELECT national_id, session_name, is_excused FROM attendance WHERE session_name LIKE $1 AND is_archived = 0", [likePattern]);

        // @ts-ignore
        const jsPDF = (await import('jspdf')).default;
        // @ts-ignore
        const autoTable = (await import('jspdf-autotable')).default;
        
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4', compress: true });

        // Load Font for Arabic/UTF-8 support
        const fontBytes = await fetch('/fonts/Amiri-Regular.ttf').then(res => res.arrayBuffer());
        let binary = '';
        const bytes = new Uint8Array(fontBytes);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const fontBase64 = btoa(binary);
        doc.addFileToVFS('Amiri-Regular.ttf', fontBase64);
        doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
        doc.addFont('Amiri-Regular.ttf', 'Amiri', 'bold');
        
        doc.setFont('Amiri');

        // Load Attendo Logo for Footer
        const logoBytes = await fetch('/attendo-icon.png').then(res => res.arrayBuffer());
        let logoBinary = '';
        const logoBytesU8 = new Uint8Array(logoBytes);
        for (let i = 0; i < logoBytesU8.byteLength; i++) {
            logoBinary += String.fromCharCode(logoBytesU8[i]);
        }
        const attendoLogoBase64 = 'data:image/png;base64,' + btoa(logoBinary);

        const pageWidth = doc.internal.pageSize.getWidth();
        const drawLogos = () => {
          const univLogo = globalSettings[`${workspace}_university_logo`] || globalSettings.university_logo;
          if (univLogo) {
            doc.addImage(univLogo, 'PNG', 40, 20, 60, 60);
          }
          
          const facLogo = globalSettings[`${workspace}_faculty_logo`] || globalSettings.faculty_logo;
          if (facLogo) {
            doc.addImage(facLogo, 'PNG', pageWidth - 100, 20, 60, 60);
          }
        };

        const drawHeaderText = () => {
          const univText = globalSettings[`${workspace}_university_name`] || globalSettings.university_name || 'Official Report';
          const facText = globalSettings[`${workspace}_faculty_name`] || globalSettings.faculty_name || '';
          
          const subjects = JSON.parse(globalSettings.subject_name || '{}');
          const activeSubject = subjects[workspace] || globalSettings.subject_name || 'Subject';
          const semester = globalSettings.semester || 'Semester';
          const currentYear = new Date().getFullYear();
          const academicYear = `${currentYear}-${currentYear + 1}`;
          const detailsText = `${semester} ${academicYear} | Subject: ${activeSubject} | Grade: ${workspace} | Instructor: ${globalSettings.instructor_name || ''}`;

          doc.setFontSize(18);
          doc.setFont(/[\u0600-\u06FF]/.test(univText) ? 'Amiri' : 'times', 'bold');
          doc.setTextColor(0, 0, 0);
          doc.text(univText, pageWidth / 2, 40, { align: 'center' });
          
          doc.setFontSize(12);
          doc.setFont(/[\u0600-\u06FF]/.test(facText) ? 'Amiri' : 'times', 'normal');
          doc.text(facText, pageWidth / 2, 60, { align: 'center' });

          doc.setFontSize(10);
          doc.setFont(/[\u0600-\u06FF]/.test(detailsText) ? 'Amiri' : 'times', 'normal');
          doc.text(detailsText, pageWidth / 2, 80, { align: 'center' });
          
          // Switch back to Amiri for the rest of the document (table contents etc) which might have Arabic names
          doc.setFont('Amiri', 'normal');
        };

        let tableStartY = 100;

        // Detect Arabic names to determine RTL or LTR table layout
        const isArabic = /[\u0600-\u06FF]/.test(students[0]?.name || '');

        // Build Table
        // Extract only "Week X - Type - Group - Topic" from the long session name for cleaner columns
        const cleanSessionName = (s: string) => {
          const match = s.match(/Week \d+ - .*/);
          return match ? match[0] : s.replace(`[Grade ${workspace}] `, '');
        };

        let headRow = ['Name', 'Total', 'Absent', 'Status', ...sessionNames.map(cleanSessionName)];
        if (isArabic) {
          headRow = headRow.reverse();
        }
        const head = [headRow];
        
        let totalSafe = 0;
        let totalAtRisk = 0;
        let lectureSafe = 0; let lectureAtRisk = 0;
        let sectionSafe = 0; let sectionAtRisk = 0;

        const totalLectureSessions = sessionNames.filter(n => n.includes(' - Lecture')).length;
        const totalSectionSessions = sessionNames.filter(n => n.includes(' - Section')).length;

        let sessionTurnout = sessionNames.map(name => ({ name: cleanSessionName(name), originalName: name, attendees: 0 }));

        const body = students.map((student: any) => {
          let attendedCount = 0;
          let excusedCount = 0;
          let lectureAttended = 0; let lectureExcused = 0;
          let sectionAttended = 0; let sectionExcused = 0;
          
          const sessionStatuses = sessionNames.map((sessionName, index) => {
            const isLecture = sessionName.includes(' - Lecture');
            const record = attendanceRecords.find(a => 
              a.national_id === student.national_id && 
              a.session_name === sessionName
            );
            if (!record) return 'X';
            if (record.is_excused === 1) {
              excusedCount++;
              if (isLecture) lectureExcused++; else sectionExcused++;
              return 'E';
            }
            attendedCount++;
            if (isLecture) lectureAttended++; else sectionAttended++;
            sessionTurnout[index].attendees++;
            return 'P';
          });

          const absentCount = Math.max(0, totalSessionsCount - (attendedCount + excusedCount));
          const isAtRisk = absentCount >= threshold;
          if (isAtRisk) totalAtRisk++;
          else totalSafe++;

          if (totalLectureSessions > 0) {
            const lectureAbsent = Math.max(0, totalLectureSessions - (lectureAttended + lectureExcused));
            if (lectureAbsent >= threshold) lectureAtRisk++; else lectureSafe++;
          }
          if (totalSectionSessions > 0) {
            const sectionAbsent = Math.max(0, totalSectionSessions - (sectionAttended + sectionExcused));
            if (sectionAbsent >= threshold) sectionAtRisk++; else sectionSafe++;
          }

          let rowData = [
            student.name,
            totalSessionsCount.toString(),
            absentCount.toString(),
            isAtRisk ? 'At Risk' : 'Safe',
            ...sessionStatuses
          ];

          if (isArabic) {
            rowData = rowData.reverse();
          }
          return rowData;
        });

        // Determine column styling indices dynamically
        const totalCols = headRow.length;
        const nameColIndex = isArabic ? totalCols - 1 : 0;
        const totalColIndex = isArabic ? totalCols - 2 : 1;
        const absentColIndex = isArabic ? totalCols - 3 : 2;
        const statusColIndex = isArabic ? totalCols - 4 : 3;

        const drawFooter = (data?: any) => {
          const pageHeight = doc.internal.pageSize.getHeight();
          const pageWidth = doc.internal.pageSize.getWidth();
          
          doc.setDrawColor(20, 184, 166);
          doc.setLineWidth(0.5);
          doc.line(40, pageHeight - 40, pageWidth - 40, pageHeight - 40);

          doc.addImage(attendoLogoBase64, 'PNG', 40, pageHeight - 35, 20, 20);

          doc.setFontSize(9);
          doc.setFont('Amiri', 'normal');
          doc.setTextColor(150, 150, 150);
          doc.text(`Powered by Attendo - ${new Date().getFullYear()}`, 65, pageHeight - 21);

          // We will draw the page number conditionally
        };

        autoTable(doc, {
          startY: tableStartY,
          margin: { top: 100 },
          head: head,
          body: body,
          theme: 'striped',
          rowPageBreak: 'avoid',
          styles: { font: 'Amiri', fontSize: 8, cellPadding: 3, halign: 'center' },
          headStyles: { fillColor: [20, 184, 166], textColor: 255, halign: 'center' },
          columnStyles: {
            [nameColIndex]: { halign: isArabic ? 'right' : 'left', minCellWidth: 100 },
          },
          didDrawPage: function(data: any) {
            drawLogos();
            drawHeaderText();
            drawFooter();
            
            // Draw page number explicitly
            const pageHeight = doc.internal.pageSize.getHeight();
            const pageWidth = doc.internal.pageSize.getWidth();
            doc.setFontSize(9);
            doc.setFont('Amiri', 'normal');
            doc.setTextColor(150, 150, 150);
            doc.text(`Page ${doc.getCurrentPageInfo().pageNumber}`, pageWidth - 40, pageHeight - 21, { align: 'right' });
          },
          didParseCell: function (data: any) {
            if (data.section === 'body') {
              const isSessionCol = isArabic ? data.column.index < totalCols - 4 : data.column.index >= 4;
              
              if (isSessionCol) {
                if (data.cell.raw === 'P') data.cell.styles.textColor = [45, 212, 191]; // Teal
                else if (data.cell.raw === 'X') data.cell.styles.textColor = [239, 68, 68]; // Red
                else if (data.cell.raw === 'E') data.cell.styles.textColor = [59, 130, 246]; // Blue
              }
              if (data.column.index === statusColIndex) {
                data.cell.styles.fontStyle = 'bold';
                if (data.cell.raw === 'At Risk') data.cell.styles.textColor = [239, 68, 68]; // Red
                else data.cell.styles.textColor = [16, 185, 129]; // Green
              }
            }
          }
        });

          // --- NATIVE ANALYTICS PAGE ---
          doc.addPage();
          
          // Draw Logos and Footer for the Analytics page (NO full header text as requested)
          drawLogos();
          drawFooter();
          
          const date = new Date();
          const year = date.getFullYear();
          const month = date.getMonth(); 
          const semesterLabel = month >= 7 ? `First Semester ${year}-${year + 1}` : `Second Semester ${year - 1}-${year}`;
          const filterLabel = filterType === 'All' ? 'All Sessions' : filterType + 's';
          const analyticsTitle = `${semesterLabel} Analytics - ${filterLabel}`;

          doc.setFontSize(18);
          doc.setFont(/[\u0600-\u06FF]/.test(analyticsTitle) ? 'Amiri' : 'times', 'bold');
          doc.setTextColor(0, 0, 0); // Formal Black
          doc.text(analyticsTitle, pageWidth / 2, 60, { align: 'center' });

          doc.setDrawColor(20, 184, 166);
          doc.setLineWidth(1);
          doc.line(40, 100, pageWidth - 40, 100);

          // --- STACKED ALIGNMENT CONSTANTS ---
          const chart1TitleY = 130;
          const chart1BaselineY = 280;
          const chart1Y = chart1BaselineY - 15;
          const chartH = 120; 
          const chartW = 550;
          const chartX = (pageWidth - chartW) / 2; 

          const chart2TitleY = 340;
          const chart2BaselineY = 520;
          const cy = 420; 
          const r = 60;   
          const cx = (pageWidth / 2) - 40; 

          // --- HELPER TO DRAW A LINE CHART ---
          const drawLineChart = (title: string, turnoutData: any[], cx: number, cw: number) => {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.setTextColor(100, 100, 100);
            doc.text(title, cx + (cw/2), chart1TitleY, { align: 'center' });

            if (turnoutData.length > 0) {
              const maxTurnout = Math.max(...turnoutData.map(s => s.attendees), 1);
              
              doc.setFontSize(8);
              doc.setFont('helvetica', 'normal');
              doc.setTextColor(150, 150, 150);
              doc.text('0', cx - 10, chart1Y + 3, { align: 'right' });
              doc.text(Math.round(maxTurnout / 2).toString(), cx - 10, chart1Y - (chartH / 2) + 3, { align: 'right' });
              doc.text(maxTurnout.toString(), cx - 10, chart1Y - chartH + 3, { align: 'right' });

              doc.setDrawColor(240, 240, 240);
              doc.setLineWidth(1);
              doc.line(cx, chart1Y - (chartH / 2), cx + cw, chart1Y - (chartH / 2));
              doc.line(cx, chart1Y - chartH, cx + cw, chart1Y - chartH);

              doc.setDrawColor(200, 200, 200);
              doc.line(cx, chart1Y, cx + cw, chart1Y); 
              doc.line(cx, chart1Y, cx, chart1Y - chartH); 

              const stepX = turnoutData.length > 1 ? cw / (turnoutData.length - 1) : cw / 2;
              let prevX = cx;
              let prevY = chart1Y - (turnoutData[0].attendees / maxTurnout) * chartH;

              turnoutData.forEach((s, i) => {
                const currX = turnoutData.length === 1 ? cx + stepX : cx + i * stepX;
                const currY = chart1Y - (s.attendees / maxTurnout) * chartH;
                
                if (i > 0) {
                  doc.setDrawColor(45, 212, 191);
                  doc.setLineWidth(2);
                  const cpX1 = (currX - prevX) / 2; const cpY1 = 0;
                  const cpX2 = (currX - prevX) / 2; const cpY2 = currY - prevY;
                  doc.lines([[cpX1, cpY1, cpX2, cpY2, currX - prevX, currY - prevY]], prevX, prevY, [1, 1], 'S');
                }
                
                doc.setFillColor(45, 212, 191);
                doc.circle(currX, currY, 4, 'F');
                
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(150, 150, 150);
                doc.text(`W${i+1}`, currX, chart1BaselineY, { align: 'center' });
                
                prevX = currX; prevY = currY;
              });
            }
          };

          // --- HELPER TO DRAW A DONUT CHART WITH STATS ---
          const drawDonutChart = (title: string, safeC: number, riskC: number, turnoutData: any[], dcx: number) => {
            const totStudents = safeC + riskC;
            const safeRatio = totStudents === 0 ? 0 : safeC / totStudents;
            const safeDegrees = safeRatio * 360;
            
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(100, 100, 100);
            doc.text(title, dcx + 40, chart2TitleY, { align: 'center' });
            
            const thickness = 20;

            doc.setFillColor(239, 68, 68);
            doc.circle(dcx, cy, r, 'F');

            if (safeDegrees > 0) {
              doc.setFillColor(45, 212, 191);
              let currentAngle = -90;
              for (let i = 0; i <= safeDegrees; i++) {
                const rad1 = (currentAngle + i) * Math.PI / 180;
                const rad2 = (currentAngle + i + 1) * Math.PI / 180;
                doc.triangle(dcx, cy, dcx + r * Math.cos(rad1), cy + r * Math.sin(rad1), dcx + r * Math.cos(rad2), cy + r * Math.sin(rad2), 'F');
              }
            }

            doc.setFillColor(255, 255, 255);
            doc.circle(dcx, cy, r - thickness, 'F');

            const safePercent = totStudents === 0 ? "0.0%" : (safeRatio * 100).toFixed(1) + "%";
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(50, 50, 50);
            doc.text(safePercent, dcx, cy + 5, { align: 'center' });
            doc.setFontSize(7);
            doc.setTextColor(100, 100, 100);
            doc.text('SAFE', dcx, cy + 15, { align: 'center' });

            const legendX = dcx + 90;
            const legendY = cy - 20;

            doc.setFillColor(45, 212, 191);
            doc.circle(legendX, legendY, 3, 'F');
            doc.setFontSize(9);
            doc.setTextColor(150, 150, 150);
            doc.text('SAFE', legendX + 10, legendY + 3);
            doc.setFontSize(14);
            doc.setTextColor(50, 50, 50);
            doc.text(`${safeC}`, legendX + 10, legendY + 20);

            doc.setFillColor(239, 68, 68);
            doc.circle(legendX, legendY + 40, 3, 'F');
            doc.setFontSize(9);
            doc.setTextColor(150, 150, 150);
            doc.text('AT RISK*', legendX + 10, legendY + 43);

            doc.setFontSize(14);
            doc.setTextColor(50, 50, 50);
            doc.text(`${riskC}`, legendX + 10, legendY + 60);

            doc.setDrawColor(240, 240, 240);
            doc.line(dcx - 50, cy + 70, dcx + 130, cy + 70); 

            const avgTurnout = turnoutData.length > 0 ? Math.round(turnoutData.reduce((sum, s) => sum + s.attendees, 0) / turnoutData.length) : 0;
            
            const lineCenter = dcx + 40;

            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text('AVG TURNOUT', lineCenter - 45, chart2BaselineY - 15, { align: 'center' });
            doc.setFontSize(16);
            doc.setTextColor(45, 212, 191);
            doc.text(`${avgTurnout}`, lineCenter - 45, chart2BaselineY, { align: 'center' });

            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text('TOTAL WEEKS', lineCenter + 45, chart2BaselineY - 15, { align: 'center' });
            doc.setFontSize(16);
            doc.setTextColor(50, 50, 50);
            doc.text(`${turnoutData.length}`, lineCenter + 45, chart2BaselineY, { align: 'center' });

            // Add footnote below the turnout and weeks numbers
            doc.setFontSize(7);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(160, 160, 160);
            doc.text(`*absence threshold was set to ${threshold}`, lineCenter, chart2BaselineY + 15, { align: 'center' });
            doc.setFont('helvetica', 'normal');
          };

          if (filterType === 'All') {
            const splitW = 340;
            const splitSpace = 60;
            const splitX1 = (pageWidth - (2 * splitW + splitSpace)) / 2;
            const splitX2 = splitX1 + splitW + splitSpace;
            const splitCx1 = splitX1 + (splitW / 2) - 40;
            const splitCx2 = splitX2 + (splitW / 2) - 40;

            const lecTurnout = sessionTurnout.filter(s => s.originalName.includes(' - Lecture'));
            const secTurnout = sessionTurnout.filter(s => s.originalName.includes(' - Section'));

            drawLineChart('LECTURES TURNOUT TREND', lecTurnout, splitX1, splitW);
            drawLineChart('SECTIONS TURNOUT TREND', secTurnout, splitX2, splitW);

            drawDonutChart('LECTURES CLASS STATUS', lectureSafe, lectureAtRisk, lecTurnout, splitCx1);
            drawDonutChart('SECTIONS CLASS STATUS', sectionSafe, sectionAtRisk, secTurnout, splitCx2);
          } else {
            drawLineChart('SESSION TURNOUT TREND', sessionTurnout, chartX, chartW);
            drawDonutChart('CLASS STATUS', totalSafe, totalAtRisk, sessionTurnout, cx);
          }

          drawFooter();

          const pdfBuffer = doc.output('arraybuffer');
        const { writeFile } = await import('@tauri-apps/plugin-fs');
        await writeFile(filePath, new Uint8Array(pdfBuffer));
        
        try {
          const excelBuffer = await generateMasterExcelBuffer(workspace, filterType, db);
          await invoke('auto_shadow_export', { 
            sessionName: `[Grade ${workspace}] - A - B - Master reports`, 
            pdfBytes: Array.from(new Uint8Array(pdfBuffer)), 
            excelBytes: Array.from(excelBuffer),
            filenameOverride: `Grade_${workspace}_${filterType}_Master_Report`
          });
        } catch (e) {}

        return { success: true };
      } catch (e: any) {
        return { success: false, msg: e.toString() };
      }
    },

    
    exportToExcel: async (attendeesData: any[], sessionName: string) => {
      try {
        const filePath = await save({
          filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
          defaultPath: `${sessionName.replace(/[\\/:*?"<>|]/g, '')}.xlsx`
        });
        if (!filePath) return { success: false, msg: 'Cancelled' };

        const excelBuffer = await generateExcelBuffer(attendeesData);
        const { writeFile } = await import('@tauri-apps/plugin-fs');
        await writeFile(filePath, excelBuffer);
        
        try {
          const pdfBuffer = await generatePDFBuffer(attendeesData, sessionName);
          await performAutoShadowExport(sessionName, pdfBuffer, excelBuffer);
        } catch (e) {}

        return { success: true, msg: 'Saved successfully!' };
      } catch (err: any) {
        return { success: false, msg: err.toString() };
      }
    },

    exportSessionToPDF: async (attendeesData: any[], sessionName: string) => {
      try {
        const filePath = await save({
          filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
          defaultPath: `${sessionName.replace(/[\\/:*?"<>|]/g, '')}.pdf`
        });
        if (!filePath) return { success: false, msg: 'Cancelled' };

        const pdfBuffer = await generatePDFBuffer(attendeesData, sessionName);
        const { writeFile } = await import('@tauri-apps/plugin-fs');
        await writeFile(filePath, pdfBuffer);
        
        try {
          const excelBuffer = await generateExcelBuffer(attendeesData);
          await performAutoShadowExport(sessionName, pdfBuffer, excelBuffer);
        } catch (e) {}

        return { success: true, msg: 'Saved successfully!' };
      } catch (err: any) {
        return { success: false, msg: err.toString() };
      }
    },

    getStudentAttendance: async (nationalId: string, workspace: string) => {
      const data = await db.select("SELECT * FROM attendance WHERE national_id = $1 ORDER BY timestamp DESC", [nationalId]);
      return { success: true, data };
    },

    updateThreshold: async (newThreshold: number) => {
      await db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('absence_threshold', $1)", [newThreshold.toString()]);
      return { success: true };
    },

    getLocalIP: async () => {
      try {
        const ip = await invoke("get_local_ip");
        return ip;
      } catch (e) {
        return "127.0.0.1";
      }
    },

    exportBackup: async (workspace: string, autoName: string) => {
      try {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const destPath = await save({
          filters: [{ name: 'Attendo Backup', extensions: ['attdb'] }],
          defaultPath: autoName
        });
        if (!destPath) return { success: false, msg: 'Cancelled' };
        
        // CRITICAL: Force SQLite to flush all pending WAL memory data into the main file before OS copying!
        await db.execute("PRAGMA wal_checkpoint(TRUNCATE);");

        await invoke('export_backup', { destPath });
        return { success: true };
      } catch (err: any) {
        return { success: false, msg: err.toString() };
      }
    },

    importBackup: async (activeWorkspace: string) => {
      try {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const backupPath = await open({
          title: `Merge Colleague Backup (Grade ${activeWorkspace} Only)`,
          filters: [{ name: 'Attendo Backup File', extensions: ['attdb', 'db'] }]
        });
        
        if (!backupPath || Array.isArray(backupPath)) return { success: false, msg: 'Import Cancelled' };

        const tempPath = await invoke<string>('create_temp_backup', { srcPath: backupPath });

        const backupDb = await Database.load(`sqlite:${tempPath}`);
        
        const localAttendance: any[] = await db.select(`SELECT national_id, session_name, is_excused, bonus_points FROM attendance WHERE session_name LIKE $1`, [`[Grade ${activeWorkspace}]%`]);
        const extAttendance: any[] = await backupDb.select(`
          SELECT a.national_id, a.session_name, a.is_excused as ext_excused, a.bonus_points as ext_bonus, s.name, a.timestamp, a.excuse_reason, a.is_archived, a.audit_trail
          FROM attendance a
          JOIN students s ON a.national_id = s.national_id
          WHERE a.session_name LIKE $1 AND s.grade = $2
        `, [`[Grade ${activeWorkspace}]%`, activeWorkspace]);

        const conflicts: any[] = [];
        const toInsert: any[] = [];
        
        extAttendance.forEach(ext => {
          const local = localAttendance.find(l => l.national_id === ext.national_id && l.session_name === ext.session_name);
          if (local) {
            if (local.is_excused !== ext.ext_excused || (local.bonus_points || 0) !== (ext.ext_bonus || 0)) {
              conflicts.push({
                national_id: ext.national_id,
                session_name: ext.session_name,
                local_excused: local.is_excused,
                ext_excused: ext.ext_excused,
                name: ext.name
              });
            }
          } else {
            toInsert.push(ext);
          }
        });

        if (conflicts.length > 0) {
          return { success: true, requiresResolution: true, conflicts, backupPath: tempPath };
        }

        const extStudents: any[] = await backupDb.select("SELECT * FROM students WHERE grade = $1", [activeWorkspace]);
        for (const s of extStudents) {
           await db.execute("INSERT OR IGNORE INTO students (name, national_id, grade, is_deleted) VALUES ($1, $2, $3, $4)", [s.name, s.national_id, s.grade, s.is_deleted]);
        }
        for (const a of toInsert) {
           await db.execute("INSERT INTO attendance (national_id, session_name, timestamp, is_excused, bonus_points, excuse_reason, is_archived, audit_trail) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)", 
           [a.national_id, a.session_name, a.timestamp, a.ext_excused, a.ext_bonus, a.excuse_reason, a.is_archived || 0, a.audit_trail || '[]']);
        }

        // @ts-ignore
        await backupDb.close(backupDb.path);
        try { await invoke('delete_temp_backup', { path: tempPath }); } catch (e) {} // Clean up temp file
        const integratedSessions = new Set(toInsert.map(a => a.session_name)).size;
        return { success: true, count: integratedSessions, requiresResolution: false };
      } catch (err: any) {
        return { success: false, msg: err.toString() };
      }
    },

    resolveConflicts: async (backupPath: string, resolutions: any[], activeWorkspace: string) => {
      try {
        const backupDb = await Database.load(`sqlite:${backupPath}`);
        let finalCount = 0;
        
        for (const res of resolutions) {
          const extRecord: any[] = await backupDb.select("SELECT * FROM attendance WHERE national_id = $1 AND session_name = $2", [res.national_id, res.session_name]);
          if (extRecord.length > 0 && res.keep === 'external') {
            await db.execute("UPDATE attendance SET is_excused = $1, bonus_points = $2 WHERE national_id = $3 AND session_name = $4", 
            [extRecord[0].is_excused, extRecord[0].bonus_points, res.national_id, res.session_name]);
            finalCount++;
          }
        }
        
        const localAttendance: any[] = await db.select(`SELECT national_id, session_name FROM attendance WHERE session_name LIKE $1`, [`[Grade ${activeWorkspace}]%`]);
        const extAttendance: any[] = await backupDb.select(`
          SELECT a.*
          FROM attendance a
          JOIN students s ON a.national_id = s.national_id
          WHERE a.session_name LIKE $1 AND s.grade = $2
        `, [`[Grade ${activeWorkspace}]%`, activeWorkspace]);

        const toInsert = extAttendance.filter(ext => !localAttendance.some(l => l.national_id === ext.national_id && l.session_name === ext.session_name));
        
        const extStudents: any[] = await backupDb.select("SELECT * FROM students WHERE grade = $1", [activeWorkspace]);
        for (const s of extStudents) {
           await db.execute("INSERT OR IGNORE INTO students (name, national_id, grade, is_deleted) VALUES ($1, $2, $3, $4)", [s.name, s.national_id, s.grade, s.is_deleted]);
        }
        for (const a of toInsert) {
           await db.execute("INSERT INTO attendance (national_id, session_name, timestamp, is_excused, bonus_points, excuse_reason, is_archived, audit_trail) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)", 
           [a.national_id, a.session_name, a.timestamp, a.is_excused, a.bonus_points, a.excuse_reason, a.is_archived || 0, a.audit_trail || '[]']);
           finalCount++;
        }
        
        const integratedSessions = new Set();
        for (const res of resolutions) {
          if (res.keep === 'external') integratedSessions.add(res.session_name);
        }
        for (const a of toInsert) {
           integratedSessions.add(a.session_name);
        }

        // @ts-ignore
        await backupDb.close(backupDb.path);
        try { await invoke('delete_temp_backup', { path: backupPath }); } catch (e) {} // Clean up temp file
        return { success: true, count: integratedSessions.size };
      } catch (err: any) {
        return { success: false, msg: err.toString() };
      }
    },

    factoryReset: async () => {
      try {
        await db.execute("DELETE FROM attendance");
        await db.execute("DELETE FROM students");
        await db.execute("DELETE FROM settings");
        return { success: true };
      } catch (err: any) {
        return { success: false, msg: err.toString() };
      }
    },
    
    triggerShadowBackup: async () => {
      try {
        await db.execute("PRAGMA wal_checkpoint(TRUNCATE);");
        await invoke('trigger_shadow_backup');
        return { success: true };
      } catch (err: any) {
        return { success: false, msg: err.toString() };
      }
    }
  };
}
