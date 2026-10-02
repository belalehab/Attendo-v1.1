import fs from 'fs';
let html = fs.readFileSync('docs_and_marketing/Attendo_Website.html', 'utf8');
html = html.replace(/\.\.\/public\//g, 'public/');
fs.writeFileSync('website_deploy/index.html', html, 'utf8');
console.log("Done");
