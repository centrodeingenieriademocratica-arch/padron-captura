/* Sirve la app (plataforma/app) y conecta /api al simulador del servidor, para probar la app sin Google.
   Uso directo: node plataforma/pruebas/servidor-local.js  → imprime el enlace del administrador. */
const http = require('http'), fs = require('fs'), path = require('path');
const { crear } = require('./simulador');
const APP = path.join(__dirname, '..', 'app');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

const SHIM = "window.google={script:{get run(){let ok=function(){},er=function(){};const r={withSuccessHandler(f){ok=f;return r},withFailureHandler(f){er=f;return r}," +
  "api(b){fetch('/api',{method:'POST',body:JSON.stringify(b)}).then(x=>x.json()).then(ok,er)}};return r}}};";
function arrancar(puerto) {
  const S = crear();
  const base = 'http://localhost:' + puerto;
  const adm = S.instalar_('Ayuntamiento de Prueba', base);
  const srv = http.createServer((q, r) => {
    if (q.method === 'POST' && q.url === '/api') {
      let b = ''; q.on('data', c => b += c); q.on('end', () => {
        let out; try { out = S.post(JSON.parse(b)); } catch (e) { out = { ok: false, error: 'servidor' }; }
        r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify(out));
      });
      return;
    }
    const u = decodeURIComponent(q.url.split('?')[0]);
    /* La raíz se comporta como la dirección /exec de Apps Script: el servidor arma la página y google.script.run se imita con /api. */
    if (u === '/' || u === '/exec') {
      const parametros = Object.fromEntries(new URL(q.url, base).searchParams);
      const html = S.abrir(parametros).replace(/<head>/i, '<head><script>' + SHIM + '</script>');
      r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return r.end(html);
    }
    if (u === '/config.js') { r.writeHead(200, { 'Content-Type': 'text/javascript' }); return r.end("window.PADRON = { servidor: '/api' };"); }
    const f = path.join(APP, u === '/' ? 'index.html' : u);
    if (!f.startsWith(APP) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
  });
  return new Promise(ok => srv.listen(puerto, () => ok({ srv, S, base, admin: adm.token })));
}
module.exports = { arrancar };
if (require.main === module) arrancar(+process.env.PORT || 8080).then(x => console.log('App de prueba: ' + x.base + '/?u=' + x.admin));
