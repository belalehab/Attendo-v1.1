import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Modify handleGenerateCards
code = code.replace(/const handleGenerateCards = async \(\) => \{[\s\S]*?const gradeStudents = response\.data\.filter\(\(s: any\) => s\.grade === activeWorkspace\);/m, 
`const handleGenerateCards = async (specificIds?: string[] | any) => {
    setIsGenerating(true);
    const targetIds = Array.isArray(specificIds) && specificIds.length > 0 ? specificIds : selectedStudents;
    const isPartial = targetIds.length > 0;
    const toastId = toast.loading(isPartial ? \`Generating \${targetIds.length} QR images...\` : 'Generating QR image bundle...');
    // @ts-ignore
    const response = await window.api.getRosterForPrint();
    
    if (response.success && response.data.length > 0) {
      let gradeStudents = response.data.filter((s: any) => s.grade === activeWorkspace);
      if (isPartial) {
         gradeStudents = gradeStudents.filter((s: any) => targetIds.includes(s.national_id || s.nationalId));
      }`);

// Also fix the folder naming when it's partial so they don't overwrite the main one
code = code.replace(/const folder = zip\.folder\(\`Attendo_Grade_\$\{activeWorkspace\}_QRs\`\);/g, 
`const folder = zip.folder(isPartial ? \`Attendo_Partial_QRs_\${Date.now()}\` : \`Attendo_Grade_\${activeWorkspace}_QRs\`);`);

// And the zip filename
code = code.replace(/const res = await window\.api\.saveBlob\(arrayBuffer, \`Attendo_Grade_\$\{activeWorkspace\}_QRs\.zip\`\);/g,
`const res = await window.api.saveBlob(arrayBuffer, isPartial ? \`Attendo_Partial_QRs_\${Date.now()}.zip\` : \`Attendo_Grade_\${activeWorkspace}_QRs.zip\`);`);

// Add button to bulk actions
const bulkActionsRegex = /<button onClick=\{handleBulkArchive\} className="bg-rose-500\/20 hover:bg-rose-500 hover:text-white text-rose-400 px-3 py-1\.5 rounded-lg text-xs font-bold transition-all border border-rose-500\/30 shadow-sm">Archive<\/button>\s*\)/m;
code = code.replace(bulkActionsRegex, `<button onClick={() => handleGenerateCards()} className="bg-teal-500 hover:bg-teal-400 text-slate-900 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-[0_0_15px_rgba(20,184,166,0.2)] flex items-center gap-1.5"><QrCode className="w-3.5 h-3.5" /> Download QRs</button>\n                          <button onClick={handleBulkArchive} className="bg-rose-500/20 hover:bg-rose-500 hover:text-white text-rose-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-rose-500/30 shadow-sm">Archive</button>\n                        )`);

fs.writeFileSync('src/App.tsx', code, 'utf8');
console.log("Done");
