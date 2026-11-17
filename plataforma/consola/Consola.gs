/* CONSOLA DEL CENTRO · Padrón de beneficiarios (Google Apps Script)
   Una sola consola, en la cuenta de Google del Centro, para ver y hacer todo en todos los municipios.
   - Se publica como aplicación web con «Ejecutar como: Yo» y «Quién tiene acceso: Solo yo». La llave maestra es la
     cuenta de Google del Centro (con verificación en dos pasos): no hay enlace secreto que se pueda filtrar.
   - Cada función revisa además que quien entra sea la dueña del script.
   - Lee y escribe directo en la hoja de cada municipio (el Centro es editora) y usa la llave de administrador del
     municipio para lo que necesita al servidor (crear usuarios, abrir la app como cualquier rol, cualquier acción de la app).
   - Las llaves se guardan en las propiedades privadas de este script, nunca en una hoja.
   - Todo lo que se hace desde la consola queda en la Bitácora de la consola y, si cambia datos, en la del municipio.
   Probado solo en el simulador (plataforma/pruebas/consola.test.js). NO PROBADO en Google real. */

const CONSOLA_VERSION = 'C1.0';
const C_HOJAS = {
  Municipios: ['id', 'nombre', 'hoja_id', 'url_exec', 'url_corta', 'activo', 'alta', 'nota'],
  Vistas: ['municipio_id', 'rol', 'usuario_id', 'enlace', 'creado'],
  Bitacora: ['ts', 'quien', 'municipio', 'accion', 'detalle']
};
const C_ROLES = ['admin', 'responsable', 'capturista', 'consulta'];

/* ---------- Acceso: solo la dueña del script ---------- */
function dueno_() {
  const yo = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  const quien = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  if (!yo || quien !== yo) throw new Error('sin_acceso');
  return quien;
}

/* ---------- Hoja privada de la consola (se crea sola en el Drive del Centro) ---------- */
function cLibro_() {
  const pr = PropertiesService.getScriptProperties();
  let id = pr.getProperty('CONSOLA_HOJA');
  if (id) try { return SpreadsheetApp.openById(id); } catch (e) {}
  const l = SpreadsheetApp.create('Consola del Centro · Padrón (PRIVADA, no compartir)');
  pr.setProperty('CONSOLA_HOJA', l.getId());
  return l;
}
function cHoja_(n) {
  const l = cLibro_();
  let s = l.getSheetByName(n);
  if (!s) { s = l.insertSheet(n); s.appendRow(C_HOJAS[n]); s.setFrozenRows(1); }
  return s;
}
function cFilas_(n) {
  const s = cHoja_(n), u = s.getLastRow();
  if (u < 2) return [];
  return s.getRange(2, 1, u - 1, C_HOJAS[n].length).getValues().map((r, i) => {
    const o = { _fila: i + 2 }; C_HOJAS[n].forEach((c, j) => o[c] = r[j] === undefined ? '' : r[j]); return o;
  });
}
const cCelda_ = v => typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v;
function cAgrega_(n, o) { cHoja_(n).appendRow(C_HOJAS[n].map(c => o[c] === undefined || o[c] === null ? '' : cCelda_(o[c]))); }
function cCambia_(n, fila, campo, v) { cHoja_(n).getRange(fila, C_HOJAS[n].indexOf(campo) + 1).setValue(cCelda_(v)); }
function cBitacora_(quien, mun, accion, detalle) {
  cAgrega_('Bitacora', { ts: new Date(), quien, municipio: mun || '', accion, detalle: String(detalle || '').slice(0, 500) });
}
const cTxt_ = (x, max) => String(x === undefined || x === null ? '' : x).trim().slice(0, max || 200);
const cTexto_ = v => v instanceof Date ? Utilities.formatDate(v, 'America/Mexico_City', 'yyyy-MM-dd HH:mm') : String(v === undefined || v === null ? '' : v);

/* La hoja privada no debe estar compartida con nadie. */
function seguridad_() {
  const avisos = [];
  try {
    const f = DriveApp.getFileById(cLibro_().getId());
    if (f.getEditors().length || f.getViewers().length) avisos.push('La hoja de la consola está compartida con alguien. Quite a todos en Compartir.');
    if (String(f.getSharingAccess()) !== 'PRIVATE') avisos.push('La hoja de la consola se puede abrir con el enlace. Póngala en «Restringido».');
  } catch (e) { avisos.push('No se pudo revisar con quién está compartida la hoja de la consola.'); }
  return avisos;
}

/* ---------- Llaves de administrador de cada municipio (propiedades privadas del script) ---------- */
function llave_(mid) { return PropertiesService.getScriptProperties().getProperty('LLAVE_' + mid) || ''; }
function ponLlave_(mid, enlace) { PropertiesService.getScriptProperties().setProperty('LLAVE_' + mid, enlace); }
/* Código del enlace: …/exec?u=CODIGO, …web.app/nombre-codigo o el código solo. */
function token_(enlace) {
  const s = String(enlace || '').trim(), q = s.match(/[?&]u=([A-Za-z0-9_-]+)/);
  const t = q ? q[1] : s.split('?')[0].replace(/\/+$/, '').split('/').pop();
  return t.split('-').pop().toUpperCase();
}
function municipio_(mid) {
  const m = cFilas_('Municipios').find(x => String(x.id) === String(mid));
  if (!m) throw new Error('municipio');
  return m;
}
function libroMun_(m) { return SpreadsheetApp.openById(String(m.hoja_id)); }
function configMun_(libro) {
  const s = libro.getSheetByName('Config'), o = {};
  if (!s || s.getLastRow() < 2) return o;
  s.getRange(2, 1, s.getLastRow() - 1, 2).getValues().forEach(r => { if (String(r[0]).trim()) o[String(r[0]).trim()] = String(r[1]).trim(); });
  return o;
}
/* Llama al servidor del municipio como su administrador: cualquier acción que tiene la app. */
function servidor_(m, datos) {
  const url = String(m.url_exec || '');
  if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(url)) return { ok: false, error: 'sin_direccion' };
  const t = token_(llave_(m.id));
  if (!t) return { ok: false, error: 'sin_llave' };
  const r = UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', muteHttpExceptions: true, followRedirects: true,
    payload: JSON.stringify(Object.assign({}, datos, { token: t })) });
  try { return JSON.parse(r.getContentText('UTF-8')); } catch (e) { return { ok: false, error: 'respuesta', codigo: r.getResponseCode() }; }
}

/* ---------- Entrada web ---------- */
function doGet() {
  try { dueno_(); } catch (e) {
    return HtmlService.createHtmlOutput('<p style="font:16px sans-serif;padding:20px">Sin acceso.</p>');
  }
  return HtmlService.createHtmlOutputFromFile('Consola').setTitle('Consola del Centro · Padrón')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
/* Todas las llamadas de la pantalla pasan por aquí: revisa a la dueña, ejecuta y nunca devuelve un error crudo. */
function consola(a, d) {
  let quien;
  try { quien = dueno_(); } catch (e) { return { ok: false, error: 'sin_acceso' }; }
  d = d || {};
  try {
    const f = ACCIONES[a];
    if (!f) return { ok: false, error: 'accion' };
    return JSON.parse(JSON.stringify(f(quien, d)));
  } catch (err) {
    return { ok: false, error: String(err && err.message || err).slice(0, 200) };
  }
}

const ACCIONES = {
  /* Lista de municipios con su estado. Nunca devuelve llaves. */
  inicio: (q) => ({ ok: true, version: CONSOLA_VERSION, quien: q, avisos: seguridad_(), hoja_consola: cLibro_().getUrl(),
    municipios: cFilas_('Municipios').filter(m => String(m.activo).toUpperCase() !== 'NO').map(m => ({
      id: m.id, nombre: m.nombre, hoja_id: m.hoja_id, url_exec: m.url_exec, url_corta: m.url_corta,
      hoja_url: 'https://docs.google.com/spreadsheets/d/' + m.hoja_id + '/edit', con_llave: !!llave_(m.id) })) }),

  /* Alta (o actualización) de un municipio: id de la hoja + enlace de administrador. Comprueba que ambos sirvan. */
  agregar: (q, d) => {
    const hid = cTxt_(d.hoja_id, 200).replace(/^.*\/d\/([A-Za-z0-9_-]+).*$/, '$1'), enlace = cTxt_(d.llave, 300);
    if (!/^[A-Za-z0-9_-]{20,}$/.test(hid)) return { ok: false, error: 'Falta el id o la dirección de la hoja del municipio.' };
    let libro;
    try { libro = SpreadsheetApp.openById(hid); } catch (e) { return { ok: false, error: 'La cuenta del Centro no puede abrir esa hoja. Compártala como editora.' }; }
    const cfg = configMun_(libro);
    let exec = (enlace.match(/^(https:\/\/script\.google\.com\/[^?#]+\/exec)/) || [])[1] || cfg.URL_EXEC || '';
    if (!exec && /\/exec$/.test(cfg.URL_APP || '')) exec = cfg.URL_APP;
    const nombre = cTxt_(d.nombre, 120) || cfg.MUNICIPIO || libro.getName();
    const ya = cFilas_('Municipios').find(m => String(m.hoja_id) === hid);
    const id = ya ? String(ya.id) : 'M' + Utilities.getUuid().replace(/-/g, '').slice(0, 8).toUpperCase();
    const fila = { id, nombre, hoja_id: hid, url_exec: exec, url_corta: cfg.URL_CORTA || '', activo: 'SI', alta: new Date(), nota: '' };
    if (enlace) ponLlave_(id, enlace);
    let prueba = { ok: false, error: 'sin_llave' };
    if (llave_(id)) prueba = servidor_(fila, { a: 'login' });
    if (llave_(id) && !prueba.ok) {
      if (!ya && enlace) PropertiesService.getScriptProperties().deleteProperty('LLAVE_' + id);
      return { ok: false, error: prueba.error === 'enlace' ? 'La llave no es de un administrador activo de ese municipio.'
        : prueba.error === 'sin_direccion' ? 'No encontré la dirección /exec del municipio. Pegue el enlace largo de administrador (el que termina en /exec?u=…).'
        : 'El servidor del municipio no respondió (' + prueba.error + ').' };
    }
    if (prueba.ok && prueba.usuario.rol !== 'admin') return { ok: false, error: 'Esa llave no es de administrador.' };
    if (ya) Object.keys(fila).forEach(c => { if (c !== 'alta') cCambia_('Municipios', ya._fila, c, fila[c]); });
    else cAgrega_('Municipios', fila);
    cBitacora_(q, nombre, ya ? 'actualiza_municipio' : 'alta_municipio', hid);
    return { ok: true, id, nombre, probado: !!prueba.ok };
  },
  quitar: (q, d) => {
    const m = municipio_(d.id);
    cCambia_('Municipios', m._fila, 'activo', 'NO');
    cBitacora_(q, m.nombre, 'quita_municipio', '');
    return { ok: true };
  },

  /* Ver todo: pestañas de la hoja del municipio y su contenido, con búsqueda. */
  pestanas: (q, d) => {
    const m = municipio_(d.id), l = libroMun_(m);
    return { ok: true, pestanas: l.getSheets().map(s => ({ nombre: s.getName(), filas: Math.max(0, s.getLastRow() - 1) })) };
  },
  leer: (q, d) => {
    const m = municipio_(d.id), s = libroMun_(m).getSheetByName(cTxt_(d.pestana, 100));
    if (!s) return { ok: false, error: 'pestana' };
    const nf = s.getLastRow(), nc = s.getLastColumn();
    if (nf < 1 || nc < 1) return { ok: true, encabezados: [], filas: [], total: 0 };
    const enc = s.getRange(1, 1, 1, nc).getValues()[0].map(cTexto_);
    let filas = nf > 1 ? s.getRange(2, 1, nf - 1, nc).getValues().map((r, i) => ({ n: i + 2, v: r.map(cTexto_) })) : [];
    /* La huella del enlace no sirve para nada a la vista: se oculta. */
    const th = enc.indexOf('token_hash');
    if (th >= 0) filas.forEach(f => f.v[th] = '•••');
    const b = cTxt_(d.buscar, 100).toLowerCase();
    if (b) filas = filas.filter(f => f.v.some(x => x.toLowerCase().indexOf(b) >= 0));
    const total = filas.length, desde = Math.max(0, Number(d.desde) || 0), cuantos = Math.min(500, Math.max(1, Number(d.cuantos) || 100));
    if (d.recientes) filas.reverse();
    return { ok: true, encabezados: enc, filas: filas.slice(desde, desde + cuantos), total, desde };
  },
  /* Hacer todo: cambia cualquier celda (desde la fila 2), con motivo, y lo anota en las dos bitácoras. */
  editar: (q, d) => {
    const m = municipio_(d.id), l = libroMun_(m), n = cTxt_(d.pestana, 100), s = l.getSheetByName(n);
    const fila = Number(d.fila), col = Number(d.columna), motivo = cTxt_(d.motivo, 300), valor = cTxt_(d.valor, 2000);
    if (!s || !(fila >= 2) || !(col >= 1) || col > s.getLastColumn()) return { ok: false, error: 'datos' };
    if (!motivo) return { ok: false, error: 'Escriba el motivo del cambio.' };
    const campo = String(s.getRange(1, col).getValues()[0][0]);
    if (campo === 'token_hash') return { ok: false, error: 'Ese campo no se edita: para cambiar un enlace, dé de baja al usuario y cree otro.' };
    const antes = cTexto_(s.getRange(fila, col).getValues()[0][0]);
    if (antes === valor) return { ok: true, sin_cambio: true };
    s.getRange(fila, col).setValue(cCelda_(valor));
    const enc = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0].map(String);
    const reg = enc.indexOf('id') >= 0 ? String(s.getRange(fila, enc.indexOf('id') + 1).getValues()[0][0]) : 'fila ' + fila;
    if (n === 'Beneficiarios' && campo === 'nombre' && enc.indexOf('nombre_norm') >= 0)
      s.getRange(fila, enc.indexOf('nombre_norm') + 1).setValue(normaliza_(valor));
    const bit = l.getSheetByName('Bitacora');
    if (bit) bit.appendRow([new Date(), 'CENTRO', 'cambio_centro', n, reg, campo, cCelda_(antes), cCelda_(valor), cCelda_(motivo)]);
    cBitacora_(q, m.nombre, 'edita', n + ' · ' + reg + ' · ' + campo + ': «' + antes + '» → «' + valor + '» · ' + motivo);
    return { ok: true };
  },

  /* Buscar a una persona (nombre o CURP) en todos los municipios a la vez. */
  buscarTodo: (q, d) => {
    const t = cTxt_(d.q, 100);
    if (t.length < 3) return { ok: false, error: 'Escriba al menos 3 letras.' };
    const out = [];
    cFilas_('Municipios').filter(m => String(m.activo).toUpperCase() !== 'NO').forEach(m => {
      let s; try { s = libroMun_(m).getSheetByName('Beneficiarios'); } catch (e) { out.push({ municipio: m.nombre, error: true }); return; }
      if (!s || s.getLastRow() < 2) return;
      const enc = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0].map(String), ci = c => enc.indexOf(c);
      const busca = /^[A-Z]{4}\d{6}/i.test(t) ? t.toUpperCase() : normaliza_(t);
      s.getRange(2, 1, s.getLastRow() - 1, s.getLastColumn()).createTextFinder(busca).matchEntireCell(false).findAll().slice(0, 30)
        .forEach(r => {
          const v = s.getRange(r.getRow(), 1, 1, enc.length).getValues()[0];
          if (out.some(x => x.municipio_id === m.id && x.fila === r.getRow())) return;
          out.push({ municipio: m.nombre, municipio_id: m.id, fila: r.getRow(), id: cTexto_(v[ci('id')]), nombre: cTexto_(v[ci('nombre')]),
            curp: cTexto_(v[ci('curp')]), localidad: cTexto_(v[ci('localidad')]), estado: cTexto_(v[ci('estado')]) });
        });
    });
    return { ok: true, resultados: out.slice(0, 100) };
  },

  /* Usuarios del municipio (por su servidor). */
  usuarios: (q, d) => servidor_(municipio_(d.id), { a: 'usuarios' }),
  crearUsuario: (q, d) => {
    const m = municipio_(d.id), r = servidor_(m, { a: 'crearUsuario', nombre: cTxt_(d.nombre, 100), rol: d.rol, areas: d.areas || [] });
    if (r.ok) cBitacora_(q, m.nombre, 'alta_usuario', cTxt_(d.nombre, 100) + ' · ' + d.rol);
    return r.ok ? { ok: true, id: r.id, enlace: r.enlace } : r;
  },
  bajaUsuario: (q, d) => {
    const m = municipio_(d.id), r = servidor_(m, { a: 'bajaUsuario', id: cTxt_(d.usuario, 40), motivo: 'Consola del Centro: ' + cTxt_(d.motivo, 150) });
    if (r.ok) cBitacora_(q, m.nombre, 'baja_usuario', cTxt_(d.usuario, 40));
    return r;
  },

  /* Ver como: el enlace del rol pedido, con todas las áreas del municipio. Se crea una vez y se reutiliza. */
  verComo: (q, d) => {
    const m = municipio_(d.id), rol = C_ROLES.indexOf(d.rol) >= 0 ? d.rol : 'capturista';
    if (rol === 'admin') {
      const ll = llave_(m.id);
      if (!ll) return { ok: false, error: 'sin_llave' };
      return { ok: true, enlace: /^https?:/.test(ll) ? ll : m.url_exec + '?u=' + token_(ll) };
    }
    const ya = cFilas_('Vistas').find(v => String(v.municipio_id) === String(m.id) && v.rol === rol);
    if (ya && !d.renovar) return { ok: true, enlace: ya.enlace };
    const login = servidor_(m, { a: 'login' });
    if (!login.ok) return login;
    const areas = (login.catalogos && login.catalogos.area) || [];
    const r = servidor_(m, { a: 'crearUsuario', nombre: 'Centro (supervisión) ' + rol, rol, areas });
    if (!r.ok) return r;
    if (ya) {
      servidor_(m, { a: 'bajaUsuario', id: ya.usuario_id, motivo: 'Consola del Centro: enlace renovado' });
      cCambia_('Vistas', ya._fila, 'usuario_id', r.id); cCambia_('Vistas', ya._fila, 'enlace', r.enlace); cCambia_('Vistas', ya._fila, 'creado', new Date());
    } else cAgrega_('Vistas', { municipio_id: m.id, rol, usuario_id: r.id, enlace: r.enlace, creado: new Date() });
    cBitacora_(q, m.nombre, 'ver_como', rol);
    return { ok: true, enlace: r.enlace };
  },

  /* Cualquier otra acción de la app, como administrador del municipio (login, buscar, lista, sync…). */
  app: (q, d) => {
    const m = municipio_(d.id), datos = d.datos || {};
    if (!datos.a) return { ok: false, error: 'accion' };
    const r = servidor_(m, datos);
    if (datos.a === 'sync') cBitacora_(q, m.nombre, 'app_sync', (datos.ops || []).map(o => o.tipo).join(','));
    return r;
  },

  bitacora: (q, d) => {
    const f = cFilas_('Bitacora').reverse().slice(0, Math.min(500, Number(d.cuantos) || 100));
    return { ok: true, filas: f.map(x => ({ ts: cTexto_(x.ts), quien: x.quien, municipio: x.municipio, accion: x.accion, detalle: x.detalle })) };
  }
};

function normaliza_(x) {
  return String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/* Para correr una vez desde el editor (botón Ejecutar): crea la hoja privada y pide los permisos. */
function instalarConsola() {
  Object.keys(C_HOJAS).forEach(cHoja_);
  const l = cLibro_(), s = l.getSheetByName('Hoja 1') || l.getSheetByName('Sheet1');
  if (s && l.getSheets().length > 1) l.deleteSheet(s);
  Logger.log('Hoja privada de la consola: ' + l.getUrl());
}
