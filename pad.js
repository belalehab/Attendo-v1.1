import fs from 'fs';

function addPadding(file) {
    let html = fs.readFileSync(file, 'utf8');
    html = html.replace(/<section id=".*?" class="py-24/, (match) => match.replace('py-24', 'pt-40 pb-24'));
    fs.writeFileSync(file, html, 'utf8');
}

addPadding('website_deploy/features.html');
addPadding('website_deploy/pricing.html');
addPadding('website_deploy/contact.html');
console.log("Padding adjusted!");
