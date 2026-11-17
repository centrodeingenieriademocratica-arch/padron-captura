/* Arma el sitio de Cloudflare en dist/ desde el repositorio: la app de mando (/admin), la versión maestra del
   servidor (/servidor/Codigo.gs) y la app del celular (/app/). Correr: node plataforma/cloudflare/armar.js */
const fs = require('fs'), path = require('path');
const AQUI = __dirname, PLAT = path.join(AQUI, '..'), DIST = path.join(AQUI, 'dist');
fs.rmSync(DIST, { recursive: true, force: true });
const copia = (de, a, filtro) => {
  fs.mkdirSync(a, { recursive: true });
  for (const f of fs.readdirSync(de)) {
    if (f.startsWith('.') || (filtro && !filtro(f))) continue;
    const o = path.join(de, f);
    if (fs.statSync(o).isFile()) fs.copyFileSync(o, path.join(a, f));
  }
};
copia(path.join(PLAT, 'admin'), path.join(DIST, 'admin'), f => f !== 'firebase.json');
copia(path.join(PLAT, 'app'), path.join(DIST, 'app'));
copia(path.join(PLAT, 'servidor'), path.join(DIST, 'servidor'), f => f === 'Codigo.gs' || f === 'Cargador.gs');
fs.writeFileSync(path.join(DIST, '_headers'), '/*\n  Cache-Control: no-cache\n/servidor/*\n  Content-Type: text/plain; charset=utf-8\n');
fs.writeFileSync(path.join(DIST, '_redirects'), '/ /admin/ 302\n');
console.log('Listo: ' + DIST);
