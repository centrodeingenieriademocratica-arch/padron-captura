/* Prueba de la dirección corta (plataforma/enlaces). Correr: node plataforma/pruebas/enlaces.test.js */
const assert = require('assert'), fs = require('fs'), path = require('path'), { chromium } = require('playwright');
const dir = path.join(__dirname, '..', 'enlaces');
require(path.join(dir, 'armar.js'));
const sitio = JSON.parse(fs.readFileSync(path.join(dir, 'sitios.json'), 'utf8'))[0];
const html = fs.readFileSync(path.join(dir, 'publico', sitio.sitio, 'index.html'), 'utf8');
(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.route('https://corta.test/**', r => r.fulfill({ contentType: 'text/html', body: html }));
  await p.route('https://script.google.com/**', r => r.fulfill({ contentType: 'text/html', body: 'app' }));
  const casos = [['/ana-kbuyhm336jc37v4ggcqp', 'KBUYHM336JC37V4GGCQP'], ['/KBUYHM336JC37V4GGCQP', 'KBUYHM336JC37V4GGCQP'],
    ['/?u=kbuyhm336jc37v4ggcqp', 'KBUYHM336JC37V4GGCQP'], ['/', null], ['/ana-abc', null]];
  for (const [ruta, codigo] of casos) {
    await p.goto('https://corta.test' + ruta);
    const src = await p.evaluate(() => { const f = document.getElementById('app'); return f ? f.src : null; });
    assert.strictEqual(src, codigo ? sitio.exec + '?u=' + codigo : null, ruta);
    console.log('ok   ' + ruta);
  }
  assert.ok(html.indexOf('og:title') > 0 && html.indexOf(sitio.municipio) > 0);
  await b.close(); console.log('\nDirección corta: todas las pruebas pasaron.');
})().catch(e => { console.log('FALLA ' + e.message); process.exit(1); });
