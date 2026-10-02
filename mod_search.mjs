import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/onClick=\{\(\) => setShowDeleted\(\!showDeleted\)\}/g, 'onClick={() => { setShowDeleted(!showDeleted); setSearchQuery(\'\'); }}');
code = code.replace(/onClick=\{\(\) => setShowArchivedSessions\(\!showArchivedSessions\)\}/g, 'onClick={() => { setShowArchivedSessions(!showArchivedSessions); setSearchQuery(\'\'); }}');

fs.writeFileSync('src/App.tsx', code, 'utf8');
console.log("Done");
