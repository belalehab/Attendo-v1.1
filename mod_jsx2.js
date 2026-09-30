import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /\{\!showDeleted \? \(\s*<button onClick=\{\(\) => handleGenerateCards\(\)\}[\s\S]*?<\/button>\s*<button onClick=\{handleBulkArchive\}[\s\S]*?<\/button>\s*\) : \(/m;
const match = code.match(regex);
if (match) {
    const replacement = match[0].replace(/{!showDeleted \? \(/, '{!showDeleted ? (\n                          <>').replace(/\) : \(/, '</>\n                        ) : (');
    code = code.replace(match[0], replacement);
    fs.writeFileSync('src/App.tsx', code, 'utf8');
    console.log("Done regex");
} else {
    console.log("No match");
}
