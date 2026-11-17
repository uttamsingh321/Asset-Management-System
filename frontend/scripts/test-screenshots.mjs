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

async function runScreenshotTests() {
  console.log('=====================================================');
  console.log('   AUTOMATED SCREENSHOT TEST SUITE');
  console.log('   Digital Twin Facility Visualizer Verification');
  console.log('=====================================================');
  console.log(`Connecting to Chrome binary: ${chromePath}`);

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
  });

  const page = await browser.newPage();

  // Inject authenticated admin session so main dashboard loads directly
  await page.evaluateOnNewDocument(() => {
    sessionStorage.setItem('meridian_auth', 'true');
    sessionStorage.setItem('meridian_active_factory', 'All Factories');
    sessionStorage.setItem(
      'meridian_user',
      JSON.stringify({
        userId: 'USR-ADMIN',
        userName: 'Uttam Singh',
        role: 'Administrator',
        factory: 'All Factories',
      })
    );
  });

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`  ✓ [PASS] ${message}`);
      passedTests++;
    } else {
      console.error(`  ✗ [FAIL] ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  try {
    // -----------------------------------------------------------------
    // TEST SUITE 1: Standalone Digital Twin (/digital-twin.html)
    // -----------------------------------------------------------------
    console.log('\n--- Test Suite 1: Standalone Visualizer (/digital-twin.html) ---');
    await page.goto('http://localhost:5173/digital-twin.html', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.dt');
    await new Promise((r) => setTimeout(r, 1200));

    // Assert 1: Page title & live telemetry
    const title = await page.$eval('.dt h1', (el) => el.textContent);
    assert(title.includes('Digital Twin Facility Visualizer'), 'Header contains "Digital Twin Facility Visualizer"');
    assert(title.includes('Live telemetry'), 'Header has pulsing "Live telemetry" badge');

    // Assert 2: 5 Top KPI Cards
    const kpis = await page.$$eval('.dt .kpi', (els) =>
      els.map((el) => ({
        val: el.querySelector('b')?.textContent?.trim(),
        label: el.querySelector('span')?.textContent?.trim(),
      }))
    );
    assert(kpis.length === 5, 'Exactly 5 KPI cards are rendered at the top');
    assert(kpis[0].label.includes('Units in C39'), 'KPI 1 displays Units in C39');
    assert(kpis[1].label.includes('Deployed'), 'KPI 2 displays Deployed percentage');
    assert(kpis[2].label.includes('Pending'), 'KPI 3 displays Pending count');
    assert(kpis[3].label.includes('Faults'), 'KPI 4 displays Faults count');
    assert(kpis[4].label.includes('Selected floor'), 'KPI 5 displays Selected floor count');

    // Assert 3: Extruded 3D Isometric Buildings in GIS Map
    const buildingBlocks = await page.$$('.dt svg g.bd');
    assert(buildingBlocks.length === 5, 'GIS map contains 5 extruded building blocks (C39 dual-split, D197, D198, D199)');

    const svgTexts = await page.$$eval('.dt svg text', (els) => els.map((el) => el.textContent?.trim()));
    assert(svgTexts.some((t) => t?.includes('C39 · Sector 57')), 'SVG map labels C39 · Sector 57');
    assert(svgTexts.some((t) => t === 'D198'), 'SVG map labels D198');
    assert(svgTexts.some((t) => t === 'D197'), 'SVG map labels D197');
    assert(svgTexts.some((t) => t === 'D199'), 'SVG map labels D199');
    assert(svgTexts.some((t) => t === 'N'), 'SVG map has Compass N indicator');

    // Assert 4: Right Sidebar with Company & Floor bars
    const sidebarBldgs = await page.$$eval('.dt aside button.gb b', (els) => els.map((el) => el.textContent?.trim()));
    assert(sidebarBldgs.includes('C39'), 'Sidebar includes Building C39 breakdown');
    assert(sidebarBldgs.includes('D198'), 'Sidebar includes Building D198 breakdown');
    assert(sidebarBldgs.includes('D197'), 'Sidebar includes Building D197 breakdown');
    assert(sidebarBldgs.includes('D199'), 'Sidebar includes Building D199 breakdown');

    // Screenshot 1: Standalone GIS Map
    const shot1Path = path.join(screenshotsDir, 'tc-1-standalone-gis-map.png');
    await page.screenshot({ path: shot1Path, fullPage: false });
    console.log(`  📸 Screenshot saved: ${shot1Path}`);

    // Switch to 3D Floor Twin View
    const chips = await page.$$('.chip');
    for (const chip of chips) {
      const text = await page.evaluate((el) => el.textContent, chip);
      if (text && text.includes('3D floor twin')) {
        await chip.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 1500));

    // Assert 5: 3D Floors, Walker & Stairs
    const floors = await page.$$('.dt .floor');
    assert(floors.length === 4, '3D view renders 4 stacked floors (Ground, SMT, Quality, Finance & IT)');

    const walker = await page.$('.dt .pw');
    assert(walker !== null, '3D view renders Walker pedestrian avatar');

    const stairs = await page.$$('.dt .m.st');
    assert(stairs.length > 0, '3D view renders physical multi-step stairs between floors');

    // Screenshot 2: Standalone 3D Floor Twin
    const shot2Path = path.join(screenshotsDir, 'tc-2-standalone-3d-floor.png');
    await page.screenshot({ path: shot2Path, fullPage: false });
    console.log(`  📸 Screenshot saved: ${shot2Path}`);

    // -----------------------------------------------------------------
    // TEST SUITE 2: Integrated App Dashboard (http://localhost:5173/)
    // -----------------------------------------------------------------
    console.log('\n--- Test Suite 2: Main Dashboard Visualizer (/) ---');
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.dt');
    await new Promise((r) => setTimeout(r, 1500));

    // Scroll the digital twin into view
    await page.evaluate(() => {
      const dt = document.querySelector('.dt');
      if (dt) dt.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
    await new Promise((r) => setTimeout(r, 1000));

    const dtHandle = await page.$('.dt');
    assert(dtHandle !== null, 'Digital Twin Visualizer is rendered inside the main application dashboard');

    // Assert that the integrated view defaults to GIS site map matching user screenshot
    const dashKpis = await page.$$eval('.dt .kpi', (els) =>
      els.map((el) => ({
        val: el.querySelector('b')?.textContent?.trim(),
        label: el.querySelector('span')?.textContent?.trim(),
      }))
    );
    assert(dashKpis.length === 5, 'Integrated dashboard renders the 5 KPI cards');

    // Screenshot 3: Integrated Dashboard GIS
    const shot3Path = path.join(screenshotsDir, 'tc-3-dashboard-gis-map.png');
    await dtHandle.screenshot({ path: shot3Path });
    console.log(`  📸 Screenshot saved: ${shot3Path}`);

    // Click 3D floor twin inside the dashboard
    const dashChips = await page.$$('.dt .chip');
    for (const chip of dashChips) {
      const text = await page.evaluate((el) => el.textContent, chip);
      if (text && text.includes('3D floor twin')) {
        await chip.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 1500));

    // Screenshot 4: Integrated Dashboard 3D Floor Twin
    const shot4Path = path.join(screenshotsDir, 'tc-4-dashboard-3d-floor.png');
    await dtHandle.screenshot({ path: shot4Path });
    console.log(`  📸 Screenshot saved: ${shot4Path}`);

    console.log('\n=====================================================');
    console.log(`   TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED (100%)`);
    console.log('   All 4 automated screenshots captured successfully.');
    console.log('=====================================================');
  } catch (err) {
    console.error('\n❌ Screenshot Test Suite Error:', err);
    await browser.close();
    process.exit(1);
  }

  await browser.close();
}

runScreenshotTests();
