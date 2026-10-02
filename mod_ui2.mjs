import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

// 3. Hide Active Attendees when not active
const activeAttendeesStr = `                  {!isZenMode && (
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
                  )}`;

const newActiveAttendeesStr = `                  {!isZenMode && (
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

if (code.includes(activeAttendeesStr)) {
    code = code.replace(activeAttendeesStr, newActiveAttendeesStr);
    console.log("Replaced Active Attendees successfully.");
} else {
    console.log("Could not find Active Attendees string.");
}

// 4. Wrap Export Buttons so they only appear if !isSessionActive && scannedStudents.length > 0
const exportButtonsStr = `                        <div className="flex flex-wrap gap-3">
  
  
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
                        </div>`;

const newExportButtonsStr = `                        {(!isSessionActive && scannedStudents.length > 0) && (
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

if (code.includes(exportButtonsStr)) {
    code = code.replace(exportButtonsStr, newExportButtonsStr);
    console.log("Replaced Export Buttons successfully.");
} else {
    console.log("Could not find Export Buttons string.");
}

fs.writeFileSync('src/App.tsx', code, 'utf8');
