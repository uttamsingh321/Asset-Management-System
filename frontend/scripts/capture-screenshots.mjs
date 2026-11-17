import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const screenshotsDir = path.resolve(__dirname, '../screenshots');

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function capture() {
  console.log('Launching Chrome from:', chromePath);
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
  });

  const page = await browser.newPage();

  console.log('Navigating to http://localhost:5173/digital-twin.html...');
  await page.goto('http://localhost:5173/digital-twin.html', { waitUntil: 'networkidle0' });
  await page.waitForSelector('.dt');
  // Wait 1.5s for SVG isometric campus and animations to render
  await new Promise((r) => setTimeout(r, 1500));

  const dtHtmlPath = path.join(screenshotsDir, 'digital-twin-gis-target.png');
  await page.screenshot({ path: dtHtmlPath, fullPage: false });
  console.log('Saved GIS screenshot to:', dtHtmlPath);

  // Click 3D floor twin chip to capture 3D view
  const chips = await page.$$('.chip');
  for (const chip of chips) {
    const text = await page.evaluate((el) => el.textContent, chip);
    if (text && text.includes('3D floor twin')) {
      console.log('Clicking 3D floor twin button...');
      await chip.click();
      break;
    }
  }

  // Wait for 3D floors and walker
  await new Promise((r) => setTimeout(r, 2000));
  const dt3dPath = path.join(screenshotsDir, 'digital-twin-3d-floor.png');
  await page.screenshot({ path: dt3dPath, fullPage: false });
  console.log('Saved 3D floor screenshot to:', dt3dPath);

  await browser.close();
  console.log('Finished capturing screenshots successfully!');
}

capture().catch((err) => {
  console.error('Error capturing screenshot:', err);
  process.exit(1);
});
