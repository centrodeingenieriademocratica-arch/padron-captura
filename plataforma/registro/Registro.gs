/* REGISTRO DE MUNICIPIOS DEL CENTRO · Padrón de beneficiarios (Google Apps Script, cuenta del Centro)
   Cada municipio se anota solo cuando se abre su app: nombre y dirección /exec. Nunca guarda claves.
   La app de administrador del Centro lee la lista con la clave del registro, que la usuaria pone una sola vez
   desde su celular (aquí solo queda su huella).
   Se publica como aplicación web: «Ejecutar como: Yo» y «Quién tiene acceso: Cualquier usuario».
   Probado solo en el simulador (plataforma/pruebas/registro.test.js). */

const EXEC_RE = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,}\/exec$/;

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function doGet(e) {
  if (e && e.parameter && e.parameter.estado) return json_({ ok: true, servicio: 'registro-padron' });
  return json_({ ok: false });
}
function doPost(e) {
  try { return json_(atiende_(JSON.parse(e.postData.contents))); } catch (err) { return json_({ ok: false, error: 'servidor' }); }
}
const props_ = () => PropertiesService.getScriptProperties();
function lee_() { try { return JSON.parse(props_().getProperty('MUNICIPIOS') || '{}'); } catch (e) { return {}; } }
function huella_(c) {
  let sal = props_().getProperty('SAL');
  if (!sal) { sal = Utilities.getUuid(); props_().setProperty('SAL', sal); }
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, sal + String(c)));
}
const txt_ = (x, n) => String(x === undefined || x === null ? '' : x).trim().slice(0, n || 150);

function atiende_(d) {
  d = d || {};
  if (d.a === 'anotar') return anotar_(d);
  if (d.a === 'ponClave') {
    const c = String(d.clave || '');
    if (props_().getProperty('CLAVE')) return { ok: false, error: 'ya_hay_clave' };
    if (c.length < 8) return { ok: false, error: 'clave_corta' };
    props_().setProperty('CLAVE', huella_(c));
    return { ok: true };
  }
  if (d.a === 'lista') {
    const h = props_().getProperty('CLAVE');
    if (!h) return { ok: false, error: 'sin_clave' };
    if (huella_(String(d.clave || '')) !== h) { Utilities.sleep(800); return { ok: false, error: 'clave' }; }
    const m = lee_();
    return { ok: true, municipios: Object.keys(m).map(k => m[k]).filter(x => !x.oculto).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')) };
  }
  if (d.a === 'ocultar') {
    const h = props_().getProperty('CLAVE');
    if (!h || huella_(String(d.clave || '')) !== h) return { ok: false, error: 'clave' };
    const L = LockService.getScriptLock(); L.waitLock(20000);
    try { const m = lee_(); if (m[d.url]) { m[d.url].oculto = !!d.oculto; props_().setProperty('MUNICIPIOS', JSON.stringify(m)); } } finally { L.releaseLock(); }
    return { ok: true };
  }
  return { ok: false, error: 'accion' };
}
/* Solo se anota una dirección /exec que de verdad responde como padrón de un municipio. */
function anotar_(d) {
  const url = txt_(d.url, 200);
  if (!EXEC_RE.test(url)) return { ok: false, error: 'datos' };
  const m = lee_(), ya = m[url], nombre = txt_(d.nombre, 120);
  if (!ya || ya.nombre !== nombre) {
    let est = null;
    try { est = JSON.parse(UrlFetchApp.fetch(url + '?estado=1', { muteHttpExceptions: true }).getContentText()); } catch (e) {}
    if (!est || est.servicio !== 'padron-municipal') return { ok: false, error: 'no_es_padron' };
  }
  const L = LockService.getScriptLock(); L.waitLock(20000);
  try {
    const m2 = lee_();
    m2[url] = { nombre: nombre || (ya && ya.nombre) || 'Sin nombre', url, corta: txt_(d.corta, 200), version: txt_(d.version, 20),
      visto: new Date().toISOString(), alta: (ya && ya.alta) || new Date().toISOString(), oculto: !!(ya && ya.oculto) };
    props_().setProperty('MUNICIPIOS', JSON.stringify(m2));
  } finally { L.releaseLock(); }
  return { ok: true };
}
