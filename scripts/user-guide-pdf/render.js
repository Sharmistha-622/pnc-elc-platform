// Prints guide.html to PDF with page numbers, and lists any broken internal links.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const [, , input, output] = process.argv;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + path.resolve(input));

  // Mark tables with many columns so the stylesheet can tighten them.
  const broken = await page.evaluate(() => {
    document.querySelectorAll('table').forEach((t) => {
      if (t.querySelectorAll('thead th').length >= 8) t.classList.add('wide');
    });
    const ids = new Set([...document.querySelectorAll('[id]')].map((e) => e.id));
    return [...document.querySelectorAll('a[href^="#"]')]
      .map((a) => a.getAttribute('href').slice(1))
      .filter((id) => !ids.has(id));
  });
  if (broken.length) console.log('BROKEN LINKS:', [...new Set(broken)]);

  await page.pdf({
    path: output,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: `<div style="width:100%;font-family:Inter,sans-serif;font-size:7.5pt;color:#8a93a3;padding:0 18mm;display:flex;justify-content:space-between">
      <span>NavGurukul ELC Platform · User Guide</span>
      <span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    preferCSSPageSize: true,
  });
  await browser.close();
  console.log('pdf written');
})();
