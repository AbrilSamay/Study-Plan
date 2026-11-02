/* Verificación opcional con Playwright instalado fuera del producto.
 * PLAYWRIGHT_MODULE puede apuntar al paquete del entorno; CHROME_EXECUTABLE, al navegador.
 * La extensión distribuida no depende de estas herramientas.
 */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');

(async () => {
  const root = path.resolve(__dirname, '..');
  const output = path.join(root, 'artifacts');
  await fs.mkdir(output, { recursive: true });
  const profile = await fs.mkdtemp(path.join(output, 'chrome-test-'));
  const context = await chromium.launchPersistentContext(profile, {
    executablePath: process.env.CHROME_EXECUTABLE,
    headless: true,
    args: ['--enable-unsafe-extension-debugging'],
    ignoreDefaultArgs: ['--disable-extensions'],
    viewport: { width: 1440, height: 1100 }, acceptDownloads: true,
  });
  const browser = context.browser();
  try {
    const cdp = await browser.newBrowserCDPSession();
    const { id } = await cdp.send('Extensions.loadUnpacked', { path: root });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`chrome-extension://${id}/interface/index.html`);
    await page.waitForFunction(() => document.querySelector('#track-list').textContent.includes('Una gran colección'));
    assert.equal(await page.locator('#message').isVisible(), false, await page.locator('#message').textContent());

    // Importar metadatos y verificar persistencia real en chrome.storage.
    await page.locator('#import-input').setInputFiles(path.join(root, 'examples/favoritas.csv'));
    await page.waitForFunction(() => document.querySelector('#stat-total').textContent === '3');
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#stat-total').textContent === '3');
    assert.equal(await page.locator('#stat-missing').textContent(), '—');

    // Un archivo con nombre conocido se mantiene por revisar, no se oculta.
    const fixtureDir = path.join(output, 'fixture-music');
    await fs.mkdir(fixtureDir, { recursive: true });
    await fs.writeFile(path.join(fixtureDir, 'La Casa Azul del Sur - Luz de noviembre.mp3'), 'fixture, not audio');
    await page.locator('#folder-input').setInputFiles(fixtureDir);
    await page.waitForFunction(() => document.querySelector('#review-count').textContent === '1 por revisar');
    assert.equal(await page.locator('#stat-missing').textContent(), '2');
    await page.locator('[data-status="review"]').click();
    await page.locator('[data-review]').click();
    await page.locator('[data-confirm="0"]').click();
    await page.waitForFunction(() => document.querySelector('#stat-owned').textContent === '1');

    // Exportar solo pendientes; el archivo local confirmado no debe aparecer.
    const downloading = page.waitForEvent('download');
    await page.locator('#export').click();
    const download = await downloading;
    const csv = await fs.readFile(await download.path(), 'utf8');
    assert.match(csv, /Todo lo que queda/); assert.doesNotMatch(csv, /Luz de noviembre/);

    // Demostración aislada y auditoría visual de escritorio/móvil.
    await page.locator('[data-view="settings"]').click();
    await page.locator('#demo').click();
    await page.locator('[data-status="missing"]').click();
    await page.screenshot({ path: path.join(output, 'desktop.png'), fullPage: true });
    for (const width of [390, 760, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const view of ['discover', 'library', 'sources', 'settings']) {
        await page.locator(`[data-view="${view}"]`).click();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${view}: overflow at ${width}`);
      }
      if (width === 390) {
        await page.locator('[data-view="discover"]').click();
        await page.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true });
      }
    }
    await page.locator('#exit-demo').click();
    await page.waitForFunction(() => document.querySelector('#stat-total').textContent === '3');

    // Adaptadores contra DOM controlado: no es validación de cuentas reales.
    const { readVisibleTracks } = await import(pathToFileURL(path.join(root, 'inputs/page-reader.js')).href);
    const fixture = await context.newPage();
    await fixture.route('https://open.spotify.com/**', route => route.fulfill({ body: '<div data-testid="tracklist-row"><a href="/track/abc">Corazón</a><a href="/artist/123">María</a></div>', contentType: 'text/html; charset=utf-8' }));
    await fixture.goto('https://open.spotify.com/collection/tracks');
    const spotify = await fixture.evaluate(readVisibleTracks);
    assert.equal(spotify.tracks[0].liked, true); assert.equal(spotify.tracks[0].artist, 'María');
    await fixture.goto('https://open.spotify.com/playlist/abc');
    assert.equal((await fixture.evaluate(readVisibleTracks)).tracks[0].liked, false);
    await fixture.route('https://music.youtube.com/**', route => route.fulfill({ body: '<ytmusic-responsive-list-item-renderer style="display:block"><a href="/watch?v=123">Corazón</a><div class="secondary-flex-columns"><a href="/channel/123">María</a></div></ytmusic-responsive-list-item-renderer>', contentType: 'text/html; charset=utf-8' }));
    await fixture.goto('https://music.youtube.com/playlist?list=LM');
    const youtube = await fixture.evaluate(readVisibleTracks);
    assert.equal(youtube.tracks[0].liked, true); assert.equal(youtube.tracks[0].artist, 'María');

    // Un título externo malicioso se muestra como texto, nunca como HTML.
    await page.evaluate(async () => {
      await chrome.runtime.sendMessage({ type: 'import', tracks: [{ title: '<img src=x onerror=alert(1)>', artist: 'Test', url: 'javascript:alert(1)' }] });
    });
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#stat-total').textContent === '4');
    assert.equal(await page.locator('#track-list img').count(), 0);
    assert.equal(await page.locator('a[href^="javascript:"]').count(), 0);
    await page.locator('[data-view="settings"]').click();
    await page.locator('#clear').click();
    await page.locator('#confirm-clear').click();
    await page.waitForFunction(() => document.querySelector('#stat-total').textContent === '0');
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#stat-total').textContent === '0');
    assert.deepEqual(errors, []);
    console.log('PASS: extension load, import, persistence, local scan, review, CSV, isolated demo, 16 responsive checks, DOM adapters, XSS, clear.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
