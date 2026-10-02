import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

// 3. Hide Active Attendees when not active using regex
const activeRegex = /\{!isZenMode && \([\s\S]*?<h2 className="text-gray-400 text-xs font-bold uppercase tracking-wider">Active Attendees<\/h2>[\s\S]*?<\/div>\s*<\/div>\s*\)\}/;
const activeReplacement = `{!isZenMode && (
                    <div className={\`grid \${isSessionActive ? 'grid-cols-2' : 'grid-cols-1'} gap-6 mb-6 shrink-0 transition-all duration-300\`}>
                      <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                        <h2 className="text-gray-400 text-xs font-bold uppercase tracking-wider">Workspace Students</h2>
                        <p className="text-4xl font-black text-white mt-1">{workspaceTotalStudents}</p>
                      </div>
                      {isSessionActive && (
                        <div className="bg-white/5 rounded-2xl p-6 border border-white/5 animate-fade-in">
                          <h2 className="text-gray-400 text-xs font-bold uppercase tracking-wider">Active Attendees</h2>
                          <p className="text-4xl font-black text-teal-400 mt-1">{scannedStudents.length}</p>
                        </div>
                      )}
                    </div>
                  )}`;

if (activeRegex.test(code)) {
    code = code.replace(activeRegex, activeReplacement);
    console.log("Replaced Active Attendees");
} else {
    console.log("Active Attendees NOT FOUND");
}


// 4. Export buttons regex
const exportRegex = /<div className="flex flex-wrap gap-3">\s*<button\s*onClick=\{\(\) => handleExport\('pdf'\)\}[\s\S]*?<\/button>\s*<\/div>/;
const exportReplacement = `{(!isSessionActive && scannedStudents.length > 0) && (
                          <div className="flex flex-wrap gap-3 animate-fade-in">
                            <button 
                              onClick={() => handleExport('pdf')}
                              disabled={isGenerating || isExporting}
                              className="flex-1 sm:flex-none bg-orange-500 hover:bg-orange-400 text-slate-900 font-bold px-4 py-2.5 rounded-xl text-sm flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(249,115,22,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 whitespace-nowrap"
                            >
                              {isExporting ? <Hourglass className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 
                              {isExporting ? 'Saving...' : 'Export PDF'}
                            </button>
    
                            <button 
                              onClick={() => handleExport('excel')}
                              disabled={isGenerating || isExporting}
                              className="flex-1 sm:flex-none bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold px-4 py-2.5 rounded-xl text-sm flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 whitespace-nowrap"
                            >
                              {isExporting ? <Hourglass className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 
                              {isExporting ? 'Saving...' : 'Export Excel'}
                            </button>
                          </div>
                        )}`;

if (exportRegex.test(code)) {
    code = code.replace(exportRegex, exportReplacement);
    console.log("Replaced Export Buttons");
} else {
    console.log("Export Buttons NOT FOUND");
}

fs.writeFileSync('src/App.tsx', code, 'utf8');
