import fs from 'fs';

const html = fs.readFileSync('website_deploy/index.html', 'utf8');

const headEnd = html.indexOf('</head>');
const head = html.substring(0, headEnd + 7);

const navStart = html.indexOf('<nav ');
const navEnd = html.indexOf('</nav>') + 6;
let nav = html.substring(navStart, navEnd);

const footerStart = html.indexOf('<footer ');
const footerEnd = html.indexOf('</footer>') + 9;
let footer = html.substring(footerStart, footerEnd);

const trailing = html.substring(footerEnd);

function extractSection(id) {
    let startTag = `<section id="${id}"`;
    let start = html.indexOf(startTag);
    if (start === -1) {
       startTag = `<section class="relative pt-40`; 
       start = html.indexOf(startTag);
       if (start === -1) return "";
    }
    const nextSection = html.indexOf('<section', start + 10);
    const end = nextSection !== -1 ? nextSection : footerStart;
    return html.substring(start, end).trim();
}

const hero = extractSection('hero'); // Will fallback to class="relative pt-40"
const features = extractSection('features');
const how = extractSection('how-it-works');
const pricing = extractSection('pricing');
const reqs = extractSection('requirements');
const contact = extractSection('contact');

nav = nav.replace(/href="#features"/g, 'href="features.html"');
nav = nav.replace(/href="#how-it-works"/g, 'href="index.html#how-it-works"');
nav = nav.replace(/href="#pricing"/g, 'href="pricing.html"');
nav = nav.replace(/href="#requirements"/g, 'href="features.html#requirements"');
nav = nav.replace(/href="#contact"/g, 'href="contact.html"');
nav = nav.replace(/<span class="text-2xl font-black tracking-tight">ATTENDO<\/span>/g, '<a href="index.html" class="text-2xl font-black tracking-tight hover:text-teal-400">ATTENDO</a>');

const bodyStart = html.substring(headEnd + 7, navStart);

function buildPage(content) {
    return head + '\n' + bodyStart + nav + '\n' + content + '\n' + footer + '\n' + trailing;
}

const indexPage = buildPage(hero + '\n\n' + how);
const featuresPage = buildPage(features + '\n\n' + reqs);
const pricingPage = buildPage(pricing);
const contactPage = buildPage(contact);

fs.writeFileSync('website_deploy/index.html', indexPage);
fs.writeFileSync('website_deploy/features.html', featuresPage);
fs.writeFileSync('website_deploy/pricing.html', pricingPage);
fs.writeFileSync('website_deploy/contact.html', contactPage);
console.log("Split successful!");
