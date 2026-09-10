const sharp = require('sharp');
async function go() {
  const baseIconPath = '../public/attendo-icon.png';
  const outputPath = './app-icon.png';
  const shieldSvg = `<svg width="256" height="256" viewBox="0 0 24 24" fill="#0f172a" stroke="#2DD4BF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`;
  const shieldBuffer = Buffer.from(shieldSvg);
  await sharp(baseIconPath)
    .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .composite([{ input: await sharp(shieldBuffer).resize(400, 400).toBuffer(), gravity: 'southeast' }])
    .toFile(outputPath);
  console.log('DONE');
}
go();