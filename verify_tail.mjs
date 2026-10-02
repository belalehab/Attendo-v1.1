import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Column spanning logic
code = code.replace(
    /<div className="lg:col-span-4 flex flex-col h-full overflow-hidden">/g, 
    '<div className={`${(isSessionActive || scannedStudents.length > 0) ? \'lg:col-span-4\' : \'lg:col-span-7 max-w-4xl mx-auto w-full\'} flex flex-col h-full overflow-hidden transition-all duration-500 ease-out`}>'
);

// 2. Wrap the Live Log component
code = code.replace(
    /<div className="lg:col-span-3 flex flex-col bg-black\/20 rounded-2xl border border-white\/10 overflow-hidden h-full shadow-inner">/g,
    '{(isSessionActive || scannedStudents.length > 0) && (\n                <div className="lg:col-span-3 flex flex-col bg-black/20 rounded-2xl border border-white/10 overflow-hidden h-full shadow-inner animate-slide-in-right">'
);

// To safely close the conditional render for Live Log, I will find the exact `</div>` that closes it.
// The Live Log div contains `<h3 className="text-white font-bold tracking-wide">Live Log</h3>`
// And ends exactly right before `</div>` which closes the `grid-cols-7`.
// Let's just look at the exact tail of `activeTab === 'scanner'`:
const targetTail = `
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}
`;
// Let's check if the tail looks like that.
