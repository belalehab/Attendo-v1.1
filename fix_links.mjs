import fs from 'fs';

function fixFile(filePath) {
    let html = fs.readFileSync(filePath, 'utf8');

    // Add smooth scrolling to HTML tag
    html = html.replace(/<html lang="en">/, '<html lang="en" class="scroll-smooth">');
    
    // Replace Select Plus
    html = html.replace(/href="#contact"([^>]*>Select Plus<\/a>)/g, 'href="https://wa.me/201014503937?text=Hello%20Dr.%20Belal,%20I%20would%20like%20to%20purchase%20the%20Attendo%20Plus%20Plan." target="_blank"$1');
    
    // Replace Select Pro
    html = html.replace(/href="#contact"([^>]*>Select Pro<\/a>)/g, 'href="https://wa.me/201014503937?text=Hello%20Dr.%20Belal,%20I%20would%20like%20to%20purchase%20the%20Attendo%20Pro%20Plan." target="_blank"$1');
    
    // Replace Select Ultimate
    html = html.replace(/href="#contact"([^>]*>Select Ultimate<\/a>)/g, 'href="https://wa.me/201014503937?text=Hello%20Dr.%20Belal,%20I%20would%20like%20to%20purchase%20the%20Attendo%20Ultimate%20Plan." target="_blank"$1');

    // Replace Get 1-Month License
    html = html.replace(/href="#contact"([^>]*>Get 1-Month License<\/a>)/g, 'href="https://wa.me/201014503937?text=Hello%20Dr.%20Belal,%20I%20would%20like%20to%20purchase%20a%201-Month%20License." target="_blank"$1');

    // Replace Request Trial Key
    html = html.replace(/href="#contact"([^>]*>Request Trial Key<\/a>)/g, 'href="https://wa.me/201014503937?text=Hello%20Dr.%20Belal,%20I%20would%20like%20to%20request%20a%2014-Day%20Free%20Trial%20Key." target="_blank"$1');

    fs.writeFileSync(filePath, html, 'utf8');
}

fixFile('website_deploy/index.html');
fixFile('docs_and_marketing/Attendo_Website.html');

console.log("Done");
