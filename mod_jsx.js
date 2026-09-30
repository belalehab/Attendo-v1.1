import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');
const searchStr = `{!showDeleted ? (
                          <button onClick={() => handleGenerateCards()} className="bg-teal-500 hover:bg-teal-400 text-slate-900 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-[0_0_15px_rgba(20,184,166,0.2)] flex items-center gap-1.5"><QrCode className="w-3.5 h-3.5" /> Download QRs</button>
                          <button onClick={handleBulkArchive} className="bg-rose-500/20 hover:bg-rose-500 hover:text-white text-rose-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-rose-500/30 shadow-sm">Archive</button>
                        ) : (`;
const replaceStr = `{!showDeleted ? (
                          <>
                            <button onClick={() => handleGenerateCards()} className="bg-teal-500 hover:bg-teal-400 text-slate-900 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-[0_0_15px_rgba(20,184,166,0.2)] flex items-center gap-1.5"><QrCode className="w-3.5 h-3.5" /> Download QRs</button>
                            <button onClick={handleBulkArchive} className="bg-rose-500/20 hover:bg-rose-500 hover:text-white text-rose-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-rose-500/30 shadow-sm">Archive</button>
                          </>
                        ) : (`;
code = code.replace(searchStr, replaceStr);
fs.writeFileSync('src/App.tsx', code, 'utf8');
console.log("Done");
