/* Pruebas del cargador (lo único que se pega en cada municipio) (el registro de municipios se prueba en registro-cloudflare.test.js).
   Correr: node plataforma/pruebas/cargador.test.js */
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const { crear } = require('./simulador');

let n = 0, fallas = 0;
function prueba(nombre, f) {
  n++;
  try { f(); console.log('ok   ' + nombre); } catch (e) { fallas++; console.log('FALLA ' + nombre + '\n      ' + e.message); }
}
const MAESTRA = fs.readFileSync(path.join(__dirname, '..', 'servidor', 'Codigo.gs'), 'utf8');
let github = MAESTRA, githubCaido = false, pedidas = 0;
const resp = (code, txt) => ({ getResponseCode: () => code, getContentText: () => txt });

/* Un municipio ya instalado con el servidor pegado completo; el cargador entra sobre la misma hoja. */
const VIEJO = crear(), adm = VIEJO.instalar_('Ayuntamiento de Atlixco', '').token;
const C = crear({ archivo: 'Cargador.gs', hojas: VIEJO.hojas, props: VIEJO.props, fetch: url => {
  if (/servidor\/Codigo\.gs$/.test(url)) { pedidas++; return githubCaido ? resp(500, '') : resp(200, github); }
  return null;
} });
prueba('el cargador toma la versión maestra y los enlaces de siempre siguen entrando', () => {
  const r = C.post({ token: adm, a: 'login' });
  assert.ok(r.ok, JSON.stringify(r)); assert.strictEqual(r.municipio, 'Ayuntamiento de Atlixco');
  assert.strictEqual(pedidas, 1);
  assert.strictEqual(C.post({ token: 'NADA', a: 'login' }).error, 'enlace');
});
prueba('captura y números a través del cargador; la copia de 6 horas evita volver a pedirla', () => {
  const s = C.post({ token: adm, a: 'sync', ops: [{ op_id: 'OP-CARGA0001', tipo: 'beneficiario', datos: { id: 'B-CARGA00001', nombre: 'Rosa Díaz' } }] });
  assert.ok(s.ok && s.resultados[0].ok, JSON.stringify(s));
  assert.strictEqual(C.post({ token: adm, a: 'resumen' }).beneficiarios, 1);
  vm.runInContext('NUCLEO_ = null', C); C.post({ token: adm, a: 'login' });
  assert.strictEqual(pedidas, 1);
});
prueba('la copia de respaldo sirve si GitHub se cae', () => {
  C.cache.nucleo = undefined; delete C.cache.nucleo;
  githubCaido = true;
  vm.runInContext('NUCLEO_ = null', C);
  assert.ok(C.post({ token: adm, a: 'login' }).ok);
  githubCaido = false;
});
prueba('un cambio en la versión maestra llega al borrar la copia (actualizar)', () => {
  github = MAESTRA.replace("const VERSION = '", "const VERSION = 'NUEVA-");
  vm.runInContext('NUCLEO_ = null', C);
  assert.ok(!/NUEVA/.test(C.abrir({ estado: 1 })), 'sigue la copia de 6 horas');
  delete C.cache.nucleo; vm.runInContext('NUCLEO_ = null', C);
  assert.ok(/NUEVA-/.test(C.abrir({ estado: 1 })), 'tomó la versión nueva');
  github = MAESTRA;
});
prueba('una versión maestra rota no reemplaza la buena', () => {
  github = 'function atiende_( { esto no compila';
  delete C.cache.nucleo; vm.runInContext('NUCLEO_ = null', C);
  assert.ok(/padron-municipal/.test(C.abrir({ estado: 1 })));
  github = MAESTRA;
});

const EXEC = 'https://script.google.com/macros/s/' + 'A'.repeat(30) + '/exec';
prueba('el servidor del municipio se anota en el registro al abrirse', () => {
  let anotado = null;
  const S = crear({ fetch: (url, o) => { if (url === 'https://padron.ejemplo/api/registro') { anotado = JSON.parse(o.payload); return resp(200, '{"ok":true}'); } return null; } });
  S.instalar_('Ayuntamiento de Chiautzingo', '');
  S.ponConfig_('REGISTRO', 'https://padron.ejemplo/api/registro'); S.ponConfig_('URL_EXEC', EXEC);
  S.abrir({ estado: 1 });
  assert.ok(anotado && anotado.a === 'anotar' && anotado.url === EXEC && anotado.nombre === 'Ayuntamiento de Chiautzingo');
  assert.ok(!('token' in anotado));
});

console.log('\n' + (n - fallas) + ' de ' + n + ' pruebas pasaron.');
process.exit(fallas ? 1 : 0);
