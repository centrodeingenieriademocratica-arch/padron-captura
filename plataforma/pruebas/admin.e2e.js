/* La app de mando en un navegador sin pantalla, con dos municipios y el registro simulados.
   Correr: node plataforma/pruebas/admin.e2e.js */
const { chromium } = require('playwright'), http = require('http'), fs = require('fs'), path = require('path'), vm = require('vm');
const { crear } = require('./simulador');
const DIR = path.join(__dirname, '..', 'admin');
const EA = 'https://script.google.com/macros/s/' + 'A'.repeat(30) + '/exec', EB = 'https://script.google.com/macros/s/' + 'B'.repeat(30) + '/exec';
const REG = '/api/registro';
const A = crear(), B = crear();
const ta = A.instalar_('Ayuntamiento de Atlixco', '').token, tb = B.instalar_('Ayuntamiento de Chiautzingo', '').token;
A.agrega_('Solicitudes', { id: 'S-VIEJA0001', beneficiario_id: 'X', area: 'DIF', fecha: '2020-01-01', descripcion: 'x', estatus: 'Recibida' });
/* Registro simulado: la misma función de Cloudflare, con KV en memoria. */
const { kv: nuevoKv, registro } = require('./kv-simulado'), KV = nuevoKv();
const esPadron = async () => ({ json: async () => ({ servicio: 'padron-municipal' }) });
let reg;

let n = 0, fallas = 0;
const ok = (c, t) => { n++; if (c) console.log('ok   ' + t); else { fallas++; console.log('FALLA ' + t); } };
const srv = http.createServer(async (q, r) => {
  let f = q.url.split('?')[0]; if (f === '/') f = '/index.html';
  if (f === REG) { let b = ''; for await (const c of q) b += c; r.setHeader('content-type', 'application/json'); return r.end(JSON.stringify(await reg(JSON.parse(b)))); }
  if (f === '/config.js') { r.setHeader('content-type', 'text/javascript'); return r.end("window.ADMIN = { registro: '" + REG + "' };"); }
  const p = path.join(DIR, f); if (!fs.existsSync(p)) { r.statusCode = 404; return r.end(); }
  r.setHeader('content-type', { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' }[path.extname(p)] || 'text/plain');
  r.end(fs.readFileSync(p));
}).listen(8099, async () => {
  const { atiende } = await registro(); reg = d => atiende(d, KV, esPadron);
  await reg({ a: 'anotar', nombre: 'Ayuntamiento de Atlixco', url: EA }); await reg({ a: 'anotar', nombre: 'Ayuntamiento de Chiautzingo', url: EB });
  const b = await chromium.launch(), pg = await b.newPage({ viewport: { width: 390, height: 844 } }), errs = [], vistos = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.route('https://script.google.com/**', async rt => {
    const u = rt.request().url(), base = u.split('?')[0], S = base === EA ? A : base === EB ? B : null;
    const h = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
    if (rt.request().method() === 'GET') { vistos.push(u); return rt.fulfill({ status: 200, headers: { 'content-type': 'text/html' }, body: '<p>app ' + u + '</p>' }); }
    const body = rt.request().postData();
    const out = S.doPost({ postData: { contents: body } }).contenido;
    rt.fulfill({ status: 200, headers: h, body: out });
  });
  const t = ms => pg.waitForTimeout(ms);
  await pg.goto('http://localhost:8099/'); await t(300);
  ok(await pg.isVisible('#v-nuevo'), 'primera vez pide PIN y clave del registro');
  await pg.fill('#n-pin', '123456'); await pg.fill('#n-pin2', '123456'); await pg.fill('#n-reg', 'clave-del-centro');
  await pg.click('text=Guardar'); await t(1500);
  ok(await pg.isVisible('#v-ini'), 'entra al inicio');
  ok((await pg.textContent('#muns')).includes('Falta su clave'), 'los municipios del registro aparecen solos, pidiendo su clave');
  const bov = await pg.evaluate(() => localStorage.getItem('boveda'));
  ok(!bov.includes('clave-del-centro'), 'la clave del registro queda cifrada en el celular');
  await pg.click('text=Ayuntamiento de Atlixco'); await t(200);
  await pg.fill('#cl-v', 'https://cid-benefi-atlixco.web.app/administrador-' + ta.toLowerCase());
  await pg.click('text=Guardar y probar'); await t(1500);
  await pg.click('text=Ayuntamiento de Chiautzingo'); await t(200);
  await pg.fill('#cl-v', 'NOSIRVENOSIRVE'); await pg.click('text=Guardar y probar'); await t(600);
  ok((await pg.textContent('#m')).includes('no entra'), 'una clave que no sirve no se guarda');
  await pg.fill('#cl-v', EB + '?u=' + tb); await pg.click('text=Guardar y probar'); await t(1500);
  const txt = await pg.textContent('#muns');
  ok(txt.includes('1 vencido') && txt.includes('beneficiarios'), 'cada municipio muestra sus números, lo vencido y lo que requiere atención');
  ok((await pg.textContent('#tot')).includes('Solicitudes vencidas'), 'totales de todos los municipios');
  const bov2 = await pg.evaluate(() => localStorage.getItem('boveda'));
  ok(!bov2.includes(ta) && !bov2.includes(ta.toLowerCase()) && !bov2.includes(tb), 'las claves de los municipios quedan cifradas');
  await pg.click('text=Ayuntamiento de Atlixco'); await t(800);
  ok(vistos.some(u => u === EA + '?u=' + ta), 'tocar el municipio abre su vista completa de administrador');
  await pg.click('text=Ver como capturista'); await t(1500);
  const cap = vistos[vistos.length - 1].split('u=')[1];
  const l = A.post({ token: cap, a: 'login' });
  ok(l.ok && l.usuario.rol === 'capturista' && l.usuario.areas.length > 10 && l.usuario.soloLectura === true, 'ver como capturista entra con ese rol, todas las áreas y solo para mirar');
  await pg.click('text=Ver como responsable'); await t(1500);
  await pg.click('text=Ver como capturista'); await t(800);
  ok(vistos[vistos.length - 1].split('u=')[1] === cap, 'el enlace de vista se reutiliza');
  await pg.click('#b-ini'); await t(1500);
  await pg.click('text=Actualizar todos a la versión maestra'); await t(800);
  ok((await pg.textContent('#m')).includes('2 de 2'), 'actualizar todos a la versión maestra');
  await pg.reload(); await t(300);
  ok(await pg.isVisible('#v-pin'), 'al volver a abrir pide el PIN');
  await pg.fill('#p-pin', '000000'); await pg.click('#v-pin button'); await t(2500);
  ok((await pg.textContent('#m')).includes('PIN incorrecto') && await pg.isVisible('#v-pin'), 'PIN equivocado no abre ' + await pg.textContent('#m'));
  await pg.fill('#p-pin', '123456'); await pg.click('#v-pin button'); await t(1500);
  ok(!(await pg.textContent('#muns')).includes('Falta su clave'), 'con el PIN correcto las claves siguen ahí');
  ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'sin desplazamiento horizontal en celular');
  ok(!errs.length, 'sin errores en la página ' + errs.join(' | '));
  await b.close(); srv.close();
  console.log('\n' + (n - fallas) + ' de ' + n + ' pruebas de la app de mando pasaron.');
  process.exit(fallas ? 1 : 0);
});
