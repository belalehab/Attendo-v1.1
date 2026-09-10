const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'tauriApi.ts');
let content = fs.readFileSync(filePath, 'utf8');

const helpers = `
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
        
        const doc = new jsPDF('portrait', 'pt', 'a4');

        const settingsRows: any[] = await db.select("SELECT key, value FROM settings");
        const globalSettings: any = {};
        settingsRows.forEach(r => globalSettings[r.key] = r.value);

        const gradeMatch = sessionName.match(/\\[Grade (.*?)\\]/);
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
          const univLogo = globalSettings[\`\${workspace}_university_logo\`] || globalSettings.university_logo;
          if (univLogo) {
            doc.addImage(univLogo, 'PNG', 40, 20, 60, 60);
          }
          
          const facLogo = globalSettings[\`\${workspace}_faculty_logo\`] || globalSettings.faculty_logo;
          if (facLogo) {
            doc.addImage(facLogo, 'PNG', pageWidth - 100, 20, 60, 60);
          }
        };

        const currentYear = new Date().getFullYear();
        const academicYear = \`\${currentYear}/\${currentYear + 1}\`;
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

          detailsText = \`\${extractedSemester} - \${academicYear} | \${activeSubject}\`;
          if (topic) detailsText += \` | \${topic}\`;
          if (type && group) {
            detailsText += \` | \${type} - \${group.replace('Group ', '')}\`;
          } else if (type || group) {
            detailsText += \` | \${type || group.replace('Group ', '')}\`;
          }
          if (week) detailsText += \` | \${week}\`;
        } else {
          detailsText = sessionName;
        }

        doc.setFontSize(10);
        doc.setFont(/[\\u0600-\\u06FF]/.test(detailsText) ? 'Amiri' : 'times', 'normal');
        const splitDetails = doc.splitTextToSize(detailsText, pageWidth - 260);
        let tableStartY = 80 + (splitDetails.length * 12) + 10;

        const drawHeaderText = () => {
          const univText = globalSettings[\`\${workspace}_university_name\`] || globalSettings.university_name || 'Official Report';
          const facText = globalSettings[\`\${workspace}_faculty_name\`] || globalSettings.faculty_name || '';

          doc.setFontSize(18);
          doc.setFont(/[\\u0600-\\u06FF]/.test(univText) ? 'Amiri' : 'times', 'bold');
          doc.setTextColor(0, 0, 0);
          doc.text(univText, pageWidth / 2, 40, { align: 'center' });
          
          doc.setFontSize(12);
          doc.setFont(/[\\u0600-\\u06FF]/.test(facText) ? 'Amiri' : 'times', 'normal');
          doc.text(facText, pageWidth / 2, 60, { align: 'center' });

          doc.setFontSize(10);
          doc.setFont(/[\\u0600-\\u06FF]/.test(detailsText) ? 'Amiri' : 'times', 'normal');
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
          doc.text(\`Powered by Attendo - \${new Date().getFullYear()}\`, 65, pageHeight - 21);
        };

        const isArabic = /[\\u0600-\\u06FF]/.test(attendeesData[0]?.name || sessionName);
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
            doc.text(\`Page \${doc.getCurrentPageInfo().pageNumber}\`, pageWidth - 40, pageHeight - 21, { align: 'right' });
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
        const { desktopDir, join } = await import('@tauri-apps/api/path');
        const { mkdir, writeFile } = await import('@tauri-apps/plugin-fs');
        
        const gradeMatch = sessionName.match(/\\[Grade (.*?)\\]/);
        const workspace = gradeMatch ? gradeMatch[1] : 'Unknown';
        
        const parts = sessionName.split(' - ');
        let type = 'Session';
        if (parts.length > 3) {
           type = parts[3].trim(); 
        }

        const desktop = await desktopDir();
        const safeSessionName = sessionName.replace(/[\\\\/:*?"<>|]/g, '');
        const shadowPath = await join(desktop, 'Attendo Exports', \`Grade \${workspace}\`, type);
        
        await mkdir(shadowPath, { recursive: true });
        
        await writeFile(await join(shadowPath, \`\${safeSessionName}.pdf\`), pdfBuffer);
        await writeFile(await join(shadowPath, \`\${safeSessionName}.xlsx\`), excelBuffer);
        
      } catch (e) {
        console.error("Shadow export failed:", e);
      }
    };
`;

const updatedExports = `
    exportToExcel: async (attendeesData: any[], sessionName: string) => {
      try {
        const filePath = await save({
          filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
          defaultPath: \`\${sessionName.replace(/[\\\\/:*?"<>|]/g, '')}.xlsx\`
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
          defaultPath: \`\${sessionName.replace(/[\\\\/:*?"<>|]/g, '')}.pdf\`
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
`;

content = content.replace('(window as any).api = {', helpers + '\\n  (window as any).api = {');

const startExportExcel = content.indexOf('exportToExcel: async');
const endExportPDF = content.indexOf('getStudentAttendance: async');

if (startExportExcel !== -1 && endExportPDF !== -1) {
    content = content.substring(0, startExportExcel) + updatedExports + '\\n    ' + content.substring(endExportPDF);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Refactoring complete.");
} else {
    console.log("Could not find boundaries.");
}
