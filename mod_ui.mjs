import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Make the main panel span 7 columns if no active session and no history to show
code = code.replace(
    /<div className="lg:col-span-4 flex flex-col h-full overflow-hidden">/g, 
    '<div className={`${(isSessionActive || scannedStudents.length > 0) ? \'lg:col-span-4\' : \'lg:col-span-7 max-w-4xl mx-auto w-full\'} flex flex-col h-full overflow-hidden transition-all duration-500 ease-out`}>'
);

// 2. Wrap the Live Log in a conditional render and add animation
const liveLogStartStr = '<div className="lg:col-span-3 flex flex-col bg-black/20 rounded-2xl border border-white/10 overflow-hidden h-full shadow-inner">';
const liveLogEndStr = '</div>\n\n              </div>\n            )}';
// Wait, regex might be tricky for wrapping. Let's just find the Live Log block.
// It starts with `lg:col-span-3 flex flex-col`
code = code.replace(
    /<div className="lg:col-span-3 flex flex-col bg-black\/20 rounded-2xl border border-white\/10 overflow-hidden h-full shadow-inner">/g,
    '{(isSessionActive || scannedStudents.length > 0) && (\n                <div className="lg:col-span-3 flex flex-col bg-black/20 rounded-2xl border border-white/10 overflow-hidden h-full shadow-inner animate-slide-in-right">'
);

// Now find the end of that Live Log div. It is just before `</main>`? No, it's before `</div>` (the 7 column grid).
// The structure is: 
// <div className="grid grid-cols-1 lg:grid-cols-7 gap-6 h-full">
//    <div className="lg:col-span-4...">...</div>
//    <div className="lg:col-span-3...">...</div>
// </div>
// Let's replace the end:
code = code.replace(
    /<\/div>\n\n              <\/div>\n            \)}/g,
    '</div>\n              )}\n\n              </div>\n            )}'
);

// Actually, replacing `</div>\n\n              </div>\n            )}` is dangerous if the spacing changed. Let's use string manipulation safely.
