/* PADRÓN ÚNICO MUNICIPAL DE BENEFICIARIOS · Cargador (Google Apps Script)
   Esto es lo único que se pega en el Apps Script de cada ayuntamiento, una sola vez.
   El servidor completo (la versión maestra) se publica en Cloudflare (sitio del padrón, armado desde plataforma/servidor/Codigo.gs).
   El cargador lo toma de ahí, lo guarda 6 horas y lo usa. Así cada cambio de la versión maestra llega solo a todos
   los municipios, cada uno desde su propia cuenta. Si Cloudflare no responde, usa la última copia buena guardada.
   El administrador puede pedir la versión nueva al momento (acción «actualizar» o menú Padrón › 3).
   Probado solo en el simulador (plataforma/pruebas/cargador.test.js). */

const FUENTE_NUCLEO = 'https://padron-cid.pages.dev/servidor/Codigo.gs';
const EXPORTA_ = ['doGet', 'doPost', 'api', 'onOpen', 'configurar', 'enlaceAdmin', 'actualizarApp'];

let NUCLEO_ = null;
function nucleo_() {
  if (NUCLEO_) return NUCLEO_;
  const cache = CacheService.getScriptCache();
  let src = cache.get('nucleo');
  if (!src) {
    try {
      const r = UrlFetchApp.fetch(FUENTE_NUCLEO, { muteHttpExceptions: true });
      if (r.getResponseCode() !== 200) throw new Error('maestra');
      src = r.getContentText('UTF-8');
      if (src.indexOf('function atiende_(') < 0) throw new Error('forma');
      armaNucleo_(src); /* si no compila, no se guarda */
      guardaNucleo_(src);
    } catch (err) { src = leeNucleo_(); }
    if (!src) throw new Error('No se pudo cargar el servidor del padrón.');
    try { cache.put('nucleo', src, 21600); } catch (err) {}
  }
  NUCLEO_ = armaNucleo_(src);
  return NUCLEO_;
}
function armaNucleo_(src) {
  return new Function(src + '\nreturn {' + EXPORTA_.map(f => f + ': typeof ' + f + " === 'function' ? " + f + ' : null').join(', ') + '};')();
}
/* Copia de respaldo en pedazos (cada propiedad guarda hasta 9 KB). */
function guardaNucleo_(src) {
  const pr = PropertiesService.getScriptProperties(), n = Math.ceil(src.length / 8000);
  for (let i = 0; i < n; i++) pr.setProperty('NUC_' + i, src.slice(i * 8000, (i + 1) * 8000));
  pr.setProperty('NUC_N', String(n));
}
function leeNucleo_() {
  const pr = PropertiesService.getScriptProperties(), n = Number(pr.getProperty('NUC_N') || 0);
  let s = ''; for (let i = 0; i < n; i++) s += pr.getProperty('NUC_' + i) || '';
  return s;
}

function doGet(e) { return nucleo_().doGet(e); }
function doPost(e) { return nucleo_().doPost(e); }
function api(d) { return nucleo_().api(d); }
function onOpen(e) { return nucleo_().onOpen(e); }
function configurar() { return nucleo_().configurar(); }
function enlaceAdmin() { return nucleo_().enlaceAdmin(); }
function actualizarApp() { CacheService.getScriptCache().remove('nucleo'); return nucleo_().actualizarApp(); }
