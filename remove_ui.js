import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Remove REVOKED screen
code = code.replace(/if \(licenseStatus === 'REVOKED'\) \{[\s\S]*?return \([\s\S]*?\}\s*(?=if \(licenseStatus === 'SYNC_REQUIRED'\))/m, '');

// Remove SYNC_REQUIRED screen
code = code.replace(/if \(licenseStatus === 'SYNC_REQUIRED'\) \{[\s\S]*?return \([\s\S]*?\}\s*(?=if \(licenseStatus !== 'valid'\))/m, '');

// Change Welcome Modal Expiry and Duration
code = code.replace(/<span className="text-white font-bold capitalize flex items-center gap-2"><Clock className="w-4 h-4 text-indigo-400" \/> \{typeof licenseDetails\.duration === 'number' \? `\$\{licenseDetails\.duration\} Months` : licenseDetails\.duration\}<\/span>/, '<span className="text-white font-bold capitalize flex items-center gap-2"><Clock className="w-4 h-4 text-indigo-400" /> Lifetime</span>');
code = code.replace(/<span className="text-xs text-gray-500 font-bold uppercase tracking-widest">Expires On<\/span>\s*<span className="text-teal-400 font-bold">\{new Date\(licenseDetails\.exp \* 1000\)\.toLocaleDateString\(undefined, \{ year: 'numeric', month: 'long', day: 'numeric' \}\)\}<\/span>/, '<span className="text-xs text-gray-500 font-bold uppercase tracking-widest">Expires On</span>\n                 <span className="text-teal-400 font-bold">Never</span>');

// Remove License Expiring Soon banner
code = code.replace(/\{Math\.ceil\(\(licenseDetails\.exp \* 1000 - Date\.now\(\)\) \/ 86400000\) <= 30 && \([\s\S]*?<\/div>\s*\)\}\s*/m, '');

// Remove License Sync Required warning in UI
code = code.replace(/\{licenseWarning\.show && \([\s\S]*?<\/div>\s*\)\}\s*/m, '');

// Bottom right license pill
code = code.replace(/<Clock className="w-3 h-3" \/> \{typeof licenseDetails\.duration === 'number' \? `\$\{licenseDetails\.duration\}-Month` : licenseDetails\.duration\.toString\(\)\.replace\(' Months', '-Month'\)\.replace\(' Days', '-Day'\)\}/, '<Clock className="w-3 h-3" /> Lifetime');

fs.writeFileSync('src/App.tsx', code, 'utf8');
console.log("Done modifying App.tsx");
