const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'tauriApi.ts');
let content = fs.readFileSync(filePath, 'utf8');

const masterExcelHelper = `
    const generateMasterExcelBuffer = async (workspace: string, filterType: string, db: any) => {
        const thresholdRow: any = await db.select("SELECT value FROM settings WHERE key = 'absence_threshold'");
        const threshold = thresholdRow.length > 0 ? parseInt(thresholdRow[0].value) : 3;

        let likePattern = \`[Grade \${workspace}]%\`;
        if (filterType === 'Lecture') likePattern = \`[Grade \${workspace}]% - Lecture%\`;
        if (filterType === 'Section') likePattern = \`[Grade \${workspace}]% - Section%\`;

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
           const shortName = sessionName.replace(\`[Grade \${workspace}] \`, '');
           columns.push({ header: shortName, key: \`session_\${index}\`, width: 18 });
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
             rowData[\`session_\${index}\`] = cellValue;
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
`;

// Insert the helper at the top
content = content.replace('(window as any).api = {', masterExcelHelper + '\\n  (window as any).api = {');

// Rewrite exportMasterReport
const exportMasterReportRegex = /exportMasterReport: async \(workspace: string, filterType: string\) => {[^]+?catch \(e: any\) {[^]+?}\s*},/;

const newExportMasterReport = \`exportMasterReport: async (workspace: string, filterType: string) => {
      try {
        const filePath = await save({
          filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
          defaultPath: \`Grade_\${workspace}_\${filterType}_Master_Report.xlsx\`
        });
        if (!filePath) return { success: false, msg: 'Cancelled' };

        const excelBuffer = await generateMasterExcelBuffer(workspace, filterType, db);
        const { writeFile } = await import('@tauri-apps/plugin-fs');
        await writeFile(filePath, excelBuffer);
        
        try {
          await invoke('auto_shadow_export', { 
            sessionName: \`[Grade \${workspace}] - A - B - Master reports\`, 
            pdfBytes: [], 
            excelBytes: Array.from(excelBuffer),
            filenameOverride: \`Grade_\${workspace}_\${filterType}_Master_Report\`
          });
        } catch (e) {}

        return { success: true };
      } catch (e: any) {
        return { success: false, msg: e.toString() };
      }
    },\`;

content = content.replace(exportMasterReportRegex, newExportMasterReport);


// In exportMasterReportPDF, we just modify the auto_shadow_export block at the bottom.
const pdfShadowBlockRegex = /try {\s*await invoke\('auto_shadow_export', \{\s*sessionName: \`\[Grade \$\{workspace\}\] - A - B - Master reports\`,\s*pdfBytes: Array\.from\(new Uint8Array\(pdfBuffer\)\),\s*excelBytes: \[\](?:,\s*filenameOverride:.*)?\s*\}\);\s*\} catch \(e\) \{\}/;

const newPdfShadowBlock = \`try {
          const excelBuffer = await generateMasterExcelBuffer(workspace, filterType, db);
          await invoke('auto_shadow_export', { 
            sessionName: \`[Grade \${workspace}] - A - B - Master reports\`, 
            pdfBytes: Array.from(new Uint8Array(pdfBuffer)), 
            excelBytes: Array.from(excelBuffer),
            filenameOverride: \`Grade_\${workspace}_\${filterType}_Master_Report\`
          });
        } catch (e) {}\`;

content = content.replace(pdfShadowBlockRegex, newPdfShadowBlock);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Master report refactoring complete.");
