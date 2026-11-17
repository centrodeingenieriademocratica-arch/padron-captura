/* PADRÓN ÚNICO MUNICIPAL DE BENEFICIARIOS · Servidor (Google Apps Script)
   Fase 1, paso 1: modelo de datos y servidor base.
   - Una hoja por ayuntamiento, en una cuenta de Google gratuita del ayuntamiento (la consultora entra como editora).
   - La app instalable (Firebase Hosting) captura sin señal y manda lotes de operaciones a doPost.
   - Cada operación trae su propio id (op_id): si llega dos veces, se responde lo mismo y no se duplica.
   - Nada se borra: los cambios quedan en Bitacora con el valor anterior.
   - Quien captura solo recibe nombres (y localidad) de lo que busca; nunca el padrón completo.
   Probado solo en el simulador (plataforma/pruebas/servidor.test.js). NO PROBADO en Google real. */

const VERSION = 'F1.1';
const TZ = 'America/Mexico_City';

/* ---------- Modelo de datos: una pestaña por tabla. Las columnas nuevas se agregan siempre al final. ---------- */
const HOJAS = {
  Config: ['clave', 'valor'],
  Usuarios: ['id', 'nombre', 'rol', 'areas', 'token_hash', 'activo', 'creado', 'creado_por'],
  Catalogos: ['tipo', 'valor', 'activo'],
  Programas: ['id', 'nombre', 'area', 'tipo_apoyo', 'tipo_beneficiario', 'unidad', 'monto_unitario', 'periodicidad',
    'fuente_recurso', 'evidencia', 'confidencial', 'campos_extra', 'activo', 'creado', 'creado_por'],
  Beneficiarios: ['id', 'tipo', 'curp', 'nombre', 'nombre_norm', 'nacimiento', 'sexo', 'telefono', 'localidad', 'colonia',
    'direccion', 'cp', 'lat', 'lng', 'precision_m', 'origen_ubicacion', 'grupos', 'grupo_otro', 'tutor_id', 'datos_extra',
    'estado', 'posible_duplicado_de', 'confidencial', 'area_alta', 'alta_por', 'alta_ts', 'activo'],
  Integrantes: ['id', 'grupo_id', 'persona_id', 'rol', 'alta_por', 'alta_ts'],
  Eventos: ['id', 'nombre', 'programa_id', 'area', 'fecha', 'lugar', 'lat', 'lng', 'localidad', 'estado', 'creado_por', 'creado'],
  Entregas: ['id', 'beneficiario_id', 'programa_id', 'evento_id', 'solicitud_id', 'lote_id', 'fecha', 'periodo', 'cantidad',
    'unidad', 'monto', 'recibio', 'representante', 'evidencia', 'lat', 'lng', 'area', 'capturista', 'estado', 'alerta', 'ts', 'datos_extra'],
  Solicitudes: ['id', 'beneficiario_id', 'programa_id', 'area', 'fecha', 'descripcion', 'estatus', 'actualizado', 'capturista'],
  Lotes: ['id', 'programa_id', 'descripcion', 'cantidad', 'unidad', 'fecha', 'proveedor', 'factura', 'fuente_recurso', 'creado_por', 'creado'],
  Alias: ['id_telefono', 'id_real', 'ts'],
  Operaciones: ['op_id', 'ts', 'usuario', 'tipo', 'resultado'],
  Bitacora: ['ts', 'usuario', 'accion', 'hoja', 'registro', 'campo', 'antes', 'despues', 'motivo']
};

/* ---------- Catálogos base (cada ayuntamiento agrega o desactiva en la pestaña Catalogos) ---------- */
const CATALOGOS_BASE = {
  area: ['Presidencia', 'Atención Ciudadana', 'DIF', 'Desarrollo Social o Bienestar', 'Educación', 'Salud', 'Obras Públicas',
    'Desarrollo Rural o Agropecuario', 'Desarrollo Económico', 'Deporte', 'Cultura', 'Juventud', 'Instituto de la Mujer',
    'Protección Civil', 'Agua Potable', 'Servicios Públicos', 'Tesorería', 'Registro Civil', 'Ecología'],
  tipo_beneficiario: ['persona', 'hogar', 'grupo', 'institucion', 'territorio', 'unidad_productiva'],
  tipo_apoyo: ['Económico', 'En especie', 'Servicio o atención', 'Beca', 'Pensión', 'Obra o territorio', 'Capacitación',
    'Trámite o descuento', 'Crédito', 'Otro'],
  unidad: ['pesos', 'piezas', 'paquetes', 'kilogramos', 'litros', 'raciones', 'consultas', 'sesiones', 'horas',
    'metros cuadrados', 'metros lineales', 'hogares', 'personas', 'parcelas', 'animales', 'árboles'],
  periodicidad: ['unica', 'semanal', 'quincenal', 'mensual', 'bimestral', 'trimestral', 'semestral', 'anual',
    'por_evento', 'por_avance', 'por_demanda'],
  canal: ['Ventanilla', 'Visita domiciliaria', 'Evento', 'Escuela', 'Centro de salud', 'Teléfono o WhatsApp', 'Otro'],
  fuente_recurso: ['Municipal', 'Estatal', 'Federal', 'Convenio', 'Donación', 'Otro'],
  evidencia: ['foto', 'firma', 'huella', 'lista', 'recibo', 'factura'],
  estatus_solicitud: ['Recibida', 'En revisión', 'Aprobada', 'Rechazada', 'Programada', 'Entregada', 'Entregada parcial', 'Cancelada'],
  sexo: ['Mujer', 'Hombre'],
  grupo: ['Persona adulta mayor', 'Persona con discapacidad', 'Mujer jefa de familia', 'Mujer', 'Madre soltera', 'Persona indígena',
    'Persona afromexicana', 'Persona joven', 'Niñas y niños', 'Estudiante', 'Campesino o productor rural', 'Comerciante o locatario',
    'Emprendedor o microempresario', 'Persona trabajadora', 'Persona desempleada', 'Persona migrante o retornada',
    'Persona en situación de calle', 'Deportista', 'Artesano', 'Persona artista o cultural', 'Familia en situación de vulnerabilidad',
    'Persona con enfermedad crónica', 'Persona con necesidad de vivienda', 'Habitante de comunidad rural con rezago', 'Persona cuidadora',
    'Víctima de violencia', 'Persona LGBTTTIQ+', 'Persona viuda', 'Niñas, niños u adolescentes en orfandad', 'Persona pensionada o jubilada',
    'Mujer embarazada o lactante', 'Persona jornalera agrícola', 'Persona trabajadora del hogar', 'Ganadero o apicultor',
    'Transportista o taxista', 'Persona en rehabilitación por adicciones', 'Persona liberada de un centro penitenciario',
    'Persona damnificada por desastre', 'Colectivo u organización civil', 'Grupo religioso']
};

const ROLES = ['admin', 'responsable', 'capturista', 'consulta'];
const CURP_RE = /^[A-Z]{4}\d{6}[HM][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z\d]\d$/;
const ID_RE = /^[A-Z0-9][A-Z0-9-]{5,40}$/;

/* ---------- Utilidades de hoja ---------- */
function libro_() { return SpreadsheetApp.getActive(); }
function hoja_(n) {
  const a = libro_();
  let s = a.getSheetByName(n);
  if (!s) { s = a.insertSheet(n); s.appendRow(HOJAS[n]); s.setFrozenRows(1); }
  return s;
}
function encabezados_(n) {
  const s = hoja_(n), c = HOJAS[n], h = s.getRange(1, 1, 1, c.length).getValues()[0];
  c.forEach((x, i) => { if (h[i] === '' || h[i] === undefined) s.getRange(1, i + 1).setValue(x); });
}
const col_ = (n, campo) => HOJAS[n].indexOf(campo) + 1;
function filas_(n) {
  const s = hoja_(n), u = s.getLastRow();
  if (u < 2) return [];
  return s.getRange(2, 1, u - 1, HOJAS[n].length).getValues().map(r => obj_(n, r));
}
function obj_(n, r) { const o = {}; HOJAS[n].forEach((c, i) => o[c] = r[i] === undefined ? '' : r[i]); return o; }
function agrega_(n, o) { hoja_(n).appendRow(HOJAS[n].map(c => o[c] === undefined || o[c] === null ? '' : o[c])); }
/* Busca filas por el valor exacto de una columna sin leer la hoja completa. */
function buscaFilas_(n, campo, valor) {
  const s = hoja_(n), u = s.getLastRow();
  if (u < 2 || valor === '' || valor === null || valor === undefined) return [];
  const c = col_(n, campo);
  const rs = s.getRange(2, c, u - 1, 1).createTextFinder(String(valor)).matchEntireCell(true).findAll();
  return rs.map(r => {
    const fila = r.getRow();
    return { fila, o: obj_(n, s.getRange(fila, 1, 1, HOJAS[n].length).getValues()[0]) };
  }).filter(x => String(x.o[campo]) === String(valor));
}
const uno_ = (n, campo, valor) => (buscaFilas_(n, campo, valor)[0] || null);
function cambia_(n, fila, campo, valor) { hoja_(n).getRange(fila, col_(n, campo)).setValue(valor); }

function config_(k) { const f = uno_('Config', 'clave', k); return f ? String(f.o.valor) : ''; }
function ponConfig_(k, v) { const f = uno_('Config', 'clave', k); if (f) cambia_('Config', f.fila, 'valor', v); else agrega_('Config', { clave: k, valor: v }); }

const norm_ = x => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ').trim();
const txt_ = (x, max) => String(x === undefined || x === null ? '' : x).trim().slice(0, max || 200);
const hoy_ = () => Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
const fechaOk_ = f => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return false;
  const d = new Date(f + 'T12:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === f && f >= '1900-01-01';
};
const enMexico_ = (la, lo) => isFinite(la) && isFinite(lo) && la >= 14 && la <= 33 && lo >= -118.5 && lo <= -86;
const nuevoId_ = p => p + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 10).toUpperCase();
const lista_ = x => (Array.isArray(x) ? x : String(x || '').split(';')).map(s => String(s).trim()).filter(Boolean);

function bitacora_(u, accion, n, registro, campo, antes, despues, motivo) {
  agrega_('Bitacora', { ts: new Date(), usuario: u ? u.id : 'sistema', accion, hoja: n, registro, campo: campo || '',
    antes: antes === undefined ? '' : antes, despues: despues === undefined ? '' : despues, motivo: motivo || '' });
}

/* ---------- Seguridad: enlaces personales. En la hoja solo queda la huella del token. ---------- */
function sal_() {
  const p = PropertiesService.getScriptProperties();
  let s = p.getProperty('SAL');
  if (!s) { s = Utilities.getUuid(); p.setProperty('SAL', s); }
  return s;
}
function huella_(t) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, sal_() + String(t).trim()));
}
function nuevoToken_() {
  const al = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let t = '';
  for (let i = 0; i < 20; i++) t += al[Math.floor(Math.random() * al.length)];
  return t;
}
function usuario_(token) {
  if (!token) return null;
  const f = uno_('Usuarios', 'token_hash', huella_(token));
  if (!f || String(f.o.activo).toUpperCase() !== 'SI') return null;
  return { id: f.o.id, nombre: f.o.nombre, rol: f.o.rol, areas: lista_(f.o.areas) };
}
const esAdmin_ = u => u.rol === 'admin';
const puedeArea_ = (u, area) => esAdmin_(u) || u.areas.indexOf(String(area)) >= 0;
function creaUsuario_(quien, nombre, rol, areas) {
  const token = nuevoToken_(), id = nuevoId_('U');
  agrega_('Usuarios', { id, nombre, rol, areas: lista_(areas).join(';'), token_hash: huella_(token), activo: 'SI',
    creado: new Date(), creado_por: quien ? quien.id : 'instalacion' });
  bitacora_(quien, 'alta_usuario', 'Usuarios', id, 'rol', '', rol);
  return { id, token, enlace: enlace_(token) };
}
function enlace_(token) { const app = config_('URL_APP'); return app ? app.replace(/\/?$/, '/') + '?u=' + token : token; }

/* ---------- Instalación (una vez por ayuntamiento, desde la hoja) ---------- */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Padrón')
    .addItem('1. Configurar este ayuntamiento', 'configurar')
    .addItem('2. Nuevo enlace de administrador', 'enlaceAdmin')
    .addToUi();
}
function configurar() {
  const ui = SpreadsheetApp.getUi();
  const mun = ui.prompt('Nombre del ayuntamiento', 'Como lo verán sus usuarios. Ej.: Ayuntamiento de Chiautzingo', ui.ButtonSet.OK_CANCEL);
  if (mun.getSelectedButton() !== ui.Button.OK) return;
  const app = ui.prompt('Dirección de la app', 'La dirección de Firebase Hosting de este ayuntamiento (ej. https://padron-chiautzingo.web.app). Puede dejarlo vacío y ponerlo después en la pestaña Config.', ui.ButtonSet.OK_CANCEL);
  const r = instalar_(mun.getResponseText(), app.getSelectedButton() === ui.Button.OK ? app.getResponseText() : '');
  ui.alert('Listo.\n\nEnlace del administrador del ayuntamiento:\n' + r.enlace +
    '\n\nEntréguelo en persona; no se vuelve a mostrar. Con él se crean los enlaces de responsables y capturistas.');
}
function enlaceAdmin() {
  const r = creaUsuario_(null, 'Administrador', 'admin', []);
  SpreadsheetApp.getUi().alert('Enlace nuevo de administrador:\n' + r.enlace + '\n\nEntréguelo en persona; no se vuelve a mostrar.');
}
/* Crea las pestañas, llena catálogos vacíos y devuelve el enlace del primer administrador. */
function instalar_(municipio, urlApp) {
  Object.keys(HOJAS).forEach(n => { hoja_(n); encabezados_(n); });
  if (txt_(municipio)) ponConfig_('MUNICIPIO', txt_(municipio, 120));
  if (txt_(urlApp)) ponConfig_('URL_APP', txt_(urlApp, 200));
  if (hoja_('Catalogos').getLastRow() < 2)
    Object.keys(CATALOGOS_BASE).forEach(t => CATALOGOS_BASE[t].forEach(v => agrega_('Catalogos', { tipo: t, valor: v, activo: 'SI' })));
  sal_();
  return creaUsuario_(null, 'Administrador', 'admin', []);
}

/* ---------- Entrada web ---------- */
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function doGet() { return json_({ ok: true, servicio: 'padron-municipal', version: VERSION, municipio: config_('MUNICIPIO') }); }
function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    const u = usuario_(d.token);
    if (!u) return json_({ ok: false, error: 'enlace' });
    return json_(atiende_(u, d));
  } catch (err) {
    return json_({ ok: false, error: 'servidor' });
  }
}
function atiende_(u, d) {
  switch (d.a) {
    case 'login': return login_(u);
    case 'buscar': return buscar_(u, d);
    case 'lista': return listaPrograma_(u, d);
    case 'sync': return sync_(u, d.ops || []);
    case 'usuarios': return esAdmin_(u) ? usuarios_() : { ok: false, error: 'permiso' };
    case 'crearUsuario': return crearUsuarioWeb_(u, d);
    case 'bajaUsuario': return bajaUsuario_(u, d);
    default: return { ok: false, error: 'accion' };
  }
}

/* ---------- Inicio de sesión: lo que la app necesita para trabajar sin señal ---------- */
function catalogos_() {
  const o = {};
  filas_('Catalogos').filter(f => String(f.activo).toUpperCase() !== 'NO').forEach(f => (o[f.tipo] = o[f.tipo] || []).push(String(f.valor)));
  return o;
}
function programaPublico_(p) {
  return { id: p.id, nombre: p.nombre, area: p.area, tipo_apoyo: p.tipo_apoyo, tipo_beneficiario: p.tipo_beneficiario,
    unidad: p.unidad, monto_unitario: p.monto_unitario === '' ? '' : Number(p.monto_unitario), periodicidad: p.periodicidad,
    fuente_recurso: p.fuente_recurso, evidencia: lista_(p.evidencia), confidencial: String(p.confidencial).toUpperCase() === 'SI',
    campos_extra: leeJson_(p.campos_extra, []) };
}
function leeJson_(x, def) { try { return x ? JSON.parse(x) : def; } catch (e) { return def; } }
function login_(u) {
  const programas = filas_('Programas').filter(p => String(p.activo).toUpperCase() !== 'NO' && puedeArea_(u, p.area)).map(programaPublico_);
  const ids = programas.map(p => p.id);
  const eventos = filas_('Eventos').filter(ev => ev.estado !== 'Cerrado' && ids.indexOf(String(ev.programa_id)) >= 0)
    .map(ev => ({ id: ev.id, nombre: ev.nombre, programa_id: ev.programa_id, area: ev.area, fecha: fecha_(ev.fecha),
      lugar: ev.lugar, lat: ev.lat, lng: ev.lng, localidad: ev.localidad }));
  return { ok: true, version: VERSION, municipio: config_('MUNICIPIO'),
    usuario: { id: u.id, nombre: u.nombre, rol: u.rol, areas: u.areas }, catalogos: catalogos_(), programas, eventos };
}
const fecha_ = x => x instanceof Date ? Utilities.formatDate(x, TZ, 'yyyy-MM-dd') : String(x || '');

/* ---------- Búsqueda: solo nombre y localidad; los casos confidenciales solo los ve su área ---------- */
function visible_(u, b) { return String(b.confidencial).toUpperCase() !== 'SI' || puedeArea_(u, b.area_alta); }
function resumen_(b) { return { id: b.id, nombre: b.nombre, localidad: b.localidad, tipo: b.tipo, estado: b.estado }; }
function buscar_(u, d) {
  const q = txt_(d.q, 120), Q = q.toUpperCase();
  let rs = [];
  if (CURP_RE.test(Q)) rs = buscaFilas_('Beneficiarios', 'curp', Q).map(x => x.o);
  else if (ID_RE.test(Q) && /-/.test(Q)) { const f = uno_('Beneficiarios', 'id', idReal_(Q)); rs = f ? [f.o] : []; }
  else {
    const n = norm_(q);
    if (n.length < 4) return { ok: false, error: 'corto' };
    const s = hoja_('Beneficiarios'), last = s.getLastRow();
    if (last >= 2) {
      const c = col_('Beneficiarios', 'nombre_norm');
      const hall = s.getRange(2, c, last - 1, 1).createTextFinder(n).matchEntireCell(false).findAll().slice(0, 40);
      rs = hall.map(r => obj_('Beneficiarios', s.getRange(r.getRow(), 1, 1, HOJAS.Beneficiarios.length).getValues()[0]))
        .filter(b => n.split(' ').every(p => String(b.nombre_norm).indexOf(p) >= 0));
    }
  }
  rs = rs.filter(b => String(b.activo).toUpperCase() !== 'NO' && visible_(u, b)).slice(0, 10);
  return { ok: true, resultados: rs.map(resumen_) };
}

/* Lista de un programa periódico: quienes ya lo recibieron antes (para marcar la nueva entrega). Solo nombres. */
function listaPrograma_(u, d) {
  const p = uno_('Programas', 'id', txt_(d.programa_id));
  if (!p) return { ok: false, error: 'datos' };
  if (!puedeArea_(u, p.o.area)) return { ok: false, error: 'permiso' };
  const vistos = {}, out = [];
  buscaFilas_('Entregas', 'programa_id', p.o.id).forEach(x => {
    if (x.o.estado === 'Cancelada' || vistos[x.o.beneficiario_id]) return;
    vistos[x.o.beneficiario_id] = true;
    const b = uno_('Beneficiarios', 'id', x.o.beneficiario_id);
    if (b && visible_(u, b.o)) out.push(resumen_(b.o));
  });
  out.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
  return { ok: true, programa_id: p.o.id, beneficiarios: out };
}

/* ---------- Sincronización: lote de operaciones capturadas en el teléfono ---------- */
function idReal_(id) { const a = uno_('Alias', 'id_telefono', id); return a ? String(a.o.id_real) : id; }
function sync_(u, ops) {
  if (!Array.isArray(ops) || ops.length > 200) return { ok: false, error: 'datos' };
  const L = LockService.getScriptLock();
  try { L.waitLock(25000); } catch (e) { return { ok: false, error: 'ocupado' }; }
  try {
    Object.keys(HOJAS).forEach(n => encabezados_(n));
    const resultados = ops.map(op => {
      const opId = txt_(op && op.op_id, 60);
      if (!ID_RE.test(opId)) return { op_id: opId, ok: false, error: 'datos' };
      const ya = uno_('Operaciones', 'op_id', opId);
      if (ya) return Object.assign(leeJson_(ya.o.resultado, {}), { op_id: opId, repetida: true });
      let r;
      try { r = operacion_(u, op.tipo, op.datos || {}); }
      catch (err) { return { op_id: opId, ok: false, error: 'ocupado' }; } /* error raro: el teléfono lo reintenta */
      r.op_id = opId;
      /* Los errores de permiso y de datos sí se guardan: reintentar no los arregla. */
      agrega_('Operaciones', { op_id: opId, ts: new Date(), usuario: u.id, tipo: txt_(op.tipo, 30), resultado: JSON.stringify(r) });
      return r;
    });
    return { ok: true, resultados };
  } finally { L.releaseLock(); }
}
function operacion_(u, tipo, d) {
  const puede = {
    beneficiario: ['admin', 'responsable', 'capturista'], entrega: ['admin', 'responsable', 'capturista'],
    solicitud: ['admin', 'responsable', 'capturista'], integrante: ['admin', 'responsable', 'capturista'],
    correccion: ['admin', 'responsable', 'capturista'], evento: ['admin', 'responsable'], lote: ['admin', 'responsable'],
    programa: ['admin', 'responsable'], editar: ['admin', 'responsable']
  };
  if (!puede[tipo]) return { ok: false, error: 'accion' };
  if (puede[tipo].indexOf(u.rol) < 0) return { ok: false, error: 'permiso' };
  return ({ beneficiario: opBeneficiario_, entrega: opEntrega_, solicitud: opSolicitud_, integrante: opIntegrante_,
    correccion: opCorreccion_, evento: opEvento_, lote: opLote_, programa: opPrograma_, editar: opEditar_ })[tipo](u, d);
}

/* Alta de beneficiario. Mismo CURP = misma persona: no se duplica y el id del teléfono queda como alias.
   Sin CURP, mismo nombre y nacimiento: se guarda, pero en "Revisar", nunca se une sola. */
function opBeneficiario_(u, d) {
  const tipos = CATALOGOS_BASE.tipo_beneficiario, tipo = tipos.indexOf(d.tipo) >= 0 ? d.tipo : 'persona';
  const idTel = txt_(d.id, 40).toUpperCase(), nombre = txt_(d.nombre, 150);
  if (!ID_RE.test(idTel) || !nombre) return { ok: false, error: 'datos' };
  const curp = txt_(d.curp, 18).toUpperCase();
  if (curp && !CURP_RE.test(curp)) return { ok: false, error: 'datos', campo: 'curp' };
  if (tipo === 'persona' && curp) {
    const ex = uno_('Beneficiarios', 'curp', curp);
    if (ex) {
      if (ex.o.id !== idTel) agrega_('Alias', { id_telefono: idTel, id_real: ex.o.id, ts: new Date() });
      return { ok: true, id: ex.o.id, aviso: 'ya_registrado' };
    }
  }
  if (uno_('Beneficiarios', 'id', idTel)) return { ok: true, id: idTel };
  const nac = txt_(d.nacimiento, 10), sexo = txt_(d.sexo, 10);
  if (nac && (!fechaOk_(nac) || nac > hoy_())) return { ok: false, error: 'datos', campo: 'nacimiento' };
  const la = Number(d.lat), lo = Number(d.lng), conPunto = d.lat !== '' && d.lat != null && enMexico_(la, lo);
  const avisos = [];
  let estado = 'Completo', dup = '';
  if (tipo === 'persona') {
    if (!curp || !nac || CATALOGOS_BASE.sexo.indexOf(sexo) < 0) estado = 'Provisional';
    if (!curp) {
      const parecidos = buscaFilas_('Beneficiarios', 'nombre_norm', norm_(nombre))
        .filter(x => !nac || !x.o.nacimiento || fecha_(x.o.nacimiento) === nac).map(x => x.o.id);
      if (parecidos.length) { estado = 'Revisar'; dup = parecidos.slice(0, 5).join(';'); avisos.push('posible_duplicado'); }
    }
    if (nac && edad_(nac) < 18 && !txt_(d.tutor_id)) avisos.push('menor_sin_tutor');
  }
  if (!conPunto) avisos.push('ubicacion_pendiente');
  const grupos = lista_(d.grupos).slice(0, 60).map(g => txt_(g, 80));
  agrega_('Beneficiarios', {
    id: idTel, tipo, curp, nombre, nombre_norm: norm_(nombre), nacimiento: nac, sexo, telefono: txt_(d.telefono, 20),
    localidad: txt_(d.localidad, 120), colonia: txt_(d.colonia, 120), direccion: txt_(d.direccion, 200), cp: /^\d{5}$/.test(d.cp) ? d.cp : '',
    lat: conPunto ? la : '', lng: conPunto ? lo : '', precision_m: conPunto && isFinite(Number(d.precision_m)) ? Math.round(Number(d.precision_m)) : '',
    origen_ubicacion: conPunto ? (d.origen_ubicacion === 'mapa' ? 'mapa' : 'GPS') : (txt_(d.direccion) ? 'pendiente_direccion' : 'pendiente'),
    grupos: grupos.join('; '), grupo_otro: txt_(d.grupo_otro, 80), tutor_id: d.tutor_id ? idReal_(txt_(d.tutor_id, 40).toUpperCase()) : '',
    datos_extra: d.datos_extra ? JSON.stringify(d.datos_extra).slice(0, 2000) : '', estado, posible_duplicado_de: dup,
    confidencial: d.confidencial ? 'SI' : '', area_alta: txt_(d.area, 80), alta_por: u.id, alta_ts: new Date(), activo: 'SI'
  });
  bitacora_(u, 'alta', 'Beneficiarios', idTel, 'estado', '', estado);
  return { ok: true, id: idTel, estado, avisos };
}
function edad_(nac) {
  const h = hoy_(), a = Number(h.slice(0, 4)) - Number(nac.slice(0, 4));
  return h.slice(5) < nac.slice(5) ? a - 1 : a;
}

/* Periodo de una entrega según la periodicidad del programa; sirve para avisar entregas repetidas. */
function periodo_(per, fecha, eventoId) {
  const y = fecha.slice(0, 4), m = Number(fecha.slice(5, 7)), dd = Number(fecha.slice(8, 10));
  switch (per) {
    case 'unica': return 'unica';
    case 'anual': return y;
    case 'semestral': return y + '-S' + (m <= 6 ? 1 : 2);
    case 'trimestral': return y + '-T' + Math.ceil(m / 3);
    case 'bimestral': return y + '-B' + Math.ceil(m / 2);
    case 'mensual': return fecha.slice(0, 7);
    case 'quincenal': return fecha.slice(0, 7) + '-Q' + (dd <= 15 ? 1 : 2);
    case 'semanal': { const d = new Date(fecha + 'T12:00:00Z'), j = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      return y + '-W' + Math.ceil(((d - j) / 864e5 + j.getUTCDay() + 1) / 7); }
    case 'por_evento': return eventoId ? 'evento:' + eventoId : fecha;
    default: return ''; /* por_avance y por_demanda: no se avisa repetición */
  }
}

/* Entrega de un apoyo. Nunca se bloquea por reglas: se guarda y, si algo no cuadra, queda en "Revisar" con la alerta. */
function opEntrega_(u, d) {
  const id = txt_(d.id, 40).toUpperCase();
  if (!ID_RE.test(id)) return { ok: false, error: 'datos' };
  if (uno_('Entregas', 'id', id)) return { ok: true, id };
  const p = uno_('Programas', 'id', txt_(d.programa_id, 40));
  if (!p || String(p.o.activo).toUpperCase() === 'NO') return { ok: false, error: 'datos', campo: 'programa' };
  if (!puedeArea_(u, p.o.area)) return { ok: false, error: 'permiso' };
  const benId = idReal_(txt_(d.beneficiario_id, 40).toUpperCase()), b = uno_('Beneficiarios', 'id', benId);
  if (!b) return { ok: false, error: 'datos', campo: 'beneficiario' };
  let ev = null;
  if (d.evento_id) { ev = uno_('Eventos', 'id', txt_(d.evento_id, 40).toUpperCase()); if (!ev) return { ok: false, error: 'datos', campo: 'evento' }; }
  let fecha = txt_(d.fecha, 10) || (ev ? fecha_(ev.o.fecha) : '') || hoy_();
  if (!fechaOk_(fecha)) return { ok: false, error: 'datos', campo: 'fecha' };
  const cantidad = d.cantidad === '' || d.cantidad == null ? 1 : Number(d.cantidad);
  if (!(cantidad > 0)) return { ok: false, error: 'datos', campo: 'cantidad' };
  const mu = p.o.monto_unitario === '' ? null : Number(p.o.monto_unitario);
  const monto = d.monto !== '' && d.monto != null && Number(d.monto) >= 0 ? Number(d.monto) : (mu !== null ? mu * cantidad : '');
  const per = periodo_(String(p.o.periodicidad), fecha, ev ? ev.o.id : '');
  const alertas = [];
  if (per) {
    const rep = buscaFilas_('Entregas', 'beneficiario_id', benId)
      .some(x => x.o.programa_id === p.o.id && x.o.periodo === per && x.o.estado !== 'Cancelada');
    if (rep) alertas.push('repetida_en_periodo');
  }
  const loteId = txt_(d.lote_id, 40).toUpperCase();
  if (loteId) {
    const lote = uno_('Lotes', 'id', loteId);
    if (!lote) alertas.push('lote_desconocido');
    else {
      const usado = buscaFilas_('Entregas', 'lote_id', loteId).filter(x => x.o.estado !== 'Cancelada')
        .reduce((s, x) => s + Number(x.o.cantidad || 0), 0);
      if (usado + cantidad > Number(lote.o.cantidad)) alertas.push('lote_agotado');
    }
  }
  const evid = lista_(p.o.evidencia), fotos = guardaEvidencia_(id, d.evidencia);
  const faltan = evid.filter(t => !fotos.some(f => f.tipo === t));
  if (faltan.length) alertas.push('falta_evidencia:' + faltan.join(','));
  const la = Number(d.lat), lo = Number(d.lng), punto = d.lat !== '' && d.lat != null && enMexico_(la, lo);
  const estado = alertas.some(a => a !== 'lote_desconocido' && a.indexOf('falta_evidencia') !== 0) ? 'Revisar' : 'Valida';
  agrega_('Entregas', {
    id, beneficiario_id: benId, programa_id: p.o.id, evento_id: ev ? ev.o.id : '', solicitud_id: txt_(d.solicitud_id, 40).toUpperCase(),
    lote_id: loteId, fecha, periodo: per, cantidad, unidad: p.o.unidad, monto, recibio: d.recibio === 'representante' ? 'representante' : 'beneficiario',
    representante: d.recibio === 'representante' ? txt_(d.representante, 150) : '', evidencia: fotos.map(f => f.tipo + ':' + f.ref).join(';'),
    lat: punto ? la : (ev ? ev.o.lat : ''), lng: punto ? lo : (ev ? ev.o.lng : ''), area: p.o.area, capturista: u.id, estado,
    alerta: alertas.join(';'), ts: new Date(), datos_extra: d.datos_extra ? JSON.stringify(d.datos_extra).slice(0, 2000) : ''
  });
  if (String(p.o.confidencial).toUpperCase() === 'SI' && String(b.o.confidencial).toUpperCase() !== 'SI') {
    cambia_('Beneficiarios', b.fila, 'confidencial', 'SI');
    if (!b.o.area_alta) cambia_('Beneficiarios', b.fila, 'area_alta', p.o.area);
  }
  bitacora_(u, 'alta', 'Entregas', id, 'estado', '', estado);
  return { ok: true, id, estado, alertas };
}
/* Fotos, firma, lista o recibo: se guardan comprimidas en la carpeta privada del ayuntamiento. */
function guardaEvidencia_(id, ev) {
  if (!Array.isArray(ev)) return [];
  return ev.slice(0, 6).map((x, i) => {
    const tipo = CATALOGOS_BASE.evidencia.indexOf(x && x.tipo) >= 0 ? x.tipo : 'foto';
    if (x && x.ref) return { tipo, ref: txt_(x.ref, 120) }; /* evidencia en papel con folio */
    const b64 = String(x && x.b64 || '').split(',').pop();
    if (!b64 || typeof DriveApp === 'undefined') return null;
    const carpeta = carpeta_();
    const f = carpeta.createFile(Utilities.newBlob(Utilities.base64Decode(b64), 'image/jpeg', id + '_' + tipo + '_' + i + '.jpg'));
    return { tipo, ref: f.getId() };
  }).filter(Boolean);
}
function carpeta_() {
  const id = config_('CARPETA_EVIDENCIA');
  if (id) try { return DriveApp.getFolderById(id); } catch (e) {}
  const c = DriveApp.createFolder('Padrón · evidencias (privada) · ' + (config_('MUNICIPIO') || 'ayuntamiento'));
  ponConfig_('CARPETA_EVIDENCIA', c.getId());
  return c;
}

function opSolicitud_(u, d) {
  const id = txt_(d.id, 40).toUpperCase();
  if (!ID_RE.test(id)) return { ok: false, error: 'datos' };
  if (uno_('Solicitudes', 'id', id)) return { ok: true, id };
  const benId = idReal_(txt_(d.beneficiario_id, 40).toUpperCase());
  if (!uno_('Beneficiarios', 'id', benId)) return { ok: false, error: 'datos', campo: 'beneficiario' };
  const p = d.programa_id ? uno_('Programas', 'id', txt_(d.programa_id, 40)) : null;
  const area = p ? p.o.area : txt_(d.area, 80);
  if (!area || !txt_(d.descripcion)) return { ok: false, error: 'datos' };
  agrega_('Solicitudes', { id, beneficiario_id: benId, programa_id: p ? p.o.id : '', area, fecha: txt_(d.fecha, 10) || hoy_(),
    descripcion: txt_(d.descripcion, 500), estatus: 'Recibida', actualizado: new Date(), capturista: u.id });
  bitacora_(u, 'alta', 'Solicitudes', id, 'estatus', '', 'Recibida');
  return { ok: true, id };
}
function opIntegrante_(u, d) {
  const id = txt_(d.id, 40).toUpperCase(), g = idReal_(txt_(d.grupo_id, 40).toUpperCase()), p = idReal_(txt_(d.persona_id, 40).toUpperCase());
  if (!ID_RE.test(id) || !uno_('Beneficiarios', 'id', g) || !uno_('Beneficiarios', 'id', p) || g === p) return { ok: false, error: 'datos' };
  if (uno_('Integrantes', 'id', id)) return { ok: true, id };
  agrega_('Integrantes', { id, grupo_id: g, persona_id: p, rol: txt_(d.rol, 40) || 'integrante', alta_por: u.id, alta_ts: new Date() });
  return { ok: true, id };
}
/* Quien captura no corrige directo: deja la petición en la bitácora para su responsable. */
function opCorreccion_(u, d) {
  const reg = idReal_(txt_(d.registro, 40).toUpperCase()), t = txt_(d.texto, 500);
  if (!reg || !t) return { ok: false, error: 'datos' };
  bitacora_(u, 'pide_correccion', txt_(d.hoja, 30) || 'Beneficiarios', reg, '', '', '', t);
  return { ok: true };
}
function opEvento_(u, d) {
  const id = txt_(d.id, 40).toUpperCase(), p = uno_('Programas', 'id', txt_(d.programa_id, 40));
  if (!ID_RE.test(id) || !p || !txt_(d.nombre)) return { ok: false, error: 'datos' };
  if (!puedeArea_(u, p.o.area)) return { ok: false, error: 'permiso' };
  if (uno_('Eventos', 'id', id)) return { ok: true, id };
  const f = txt_(d.fecha, 10) || hoy_();
  if (!fechaOk_(f)) return { ok: false, error: 'datos', campo: 'fecha' };
  const la = Number(d.lat), lo = Number(d.lng), punto = d.lat !== '' && d.lat != null && enMexico_(la, lo);
  agrega_('Eventos', { id, nombre: txt_(d.nombre, 150), programa_id: p.o.id, area: p.o.area, fecha: f, lugar: txt_(d.lugar, 200),
    lat: punto ? la : '', lng: punto ? lo : '', localidad: txt_(d.localidad, 120), estado: 'Abierto', creado_por: u.id, creado: new Date() });
  bitacora_(u, 'alta', 'Eventos', id, 'estado', '', 'Abierto');
  return { ok: true, id };
}
function opLote_(u, d) {
  const id = txt_(d.id, 40).toUpperCase(), p = uno_('Programas', 'id', txt_(d.programa_id, 40)), c = Number(d.cantidad);
  if (!ID_RE.test(id) || !p || !(c > 0)) return { ok: false, error: 'datos' };
  if (!puedeArea_(u, p.o.area)) return { ok: false, error: 'permiso' };
  if (uno_('Lotes', 'id', id)) return { ok: true, id };
  agrega_('Lotes', { id, programa_id: p.o.id, descripcion: txt_(d.descripcion, 200), cantidad: c, unidad: p.o.unidad,
    fecha: txt_(d.fecha, 10) || hoy_(), proveedor: txt_(d.proveedor, 150), factura: txt_(d.factura, 60),
    fuente_recurso: txt_(d.fuente_recurso, 40) || p.o.fuente_recurso, creado_por: u.id, creado: new Date() });
  bitacora_(u, 'alta', 'Lotes', id, 'cantidad', '', c);
  return { ok: true, id };
}
/* Programa = plantilla del apoyo. Lo da de alta el administrador o el responsable de esa área. */
function opPrograma_(u, d) {
  const id = txt_(d.id, 40).toUpperCase(), area = txt_(d.area, 80), C = CATALOGOS_BASE;
  if (!ID_RE.test(id) || !txt_(d.nombre) || !area) return { ok: false, error: 'datos' };
  if (!puedeArea_(u, area)) return { ok: false, error: 'permiso' };
  if (uno_('Programas', 'id', id)) return { ok: true, id };
  const per = C.periodicidad.indexOf(d.periodicidad) >= 0 ? d.periodicidad : 'unica';
  const tb = C.tipo_beneficiario.indexOf(d.tipo_beneficiario) >= 0 ? d.tipo_beneficiario : 'persona';
  const mu = d.monto_unitario === '' || d.monto_unitario == null ? '' : Number(d.monto_unitario);
  if (mu !== '' && !(mu >= 0)) return { ok: false, error: 'datos', campo: 'monto_unitario' };
  agrega_('Programas', { id, nombre: txt_(d.nombre, 150), area, tipo_apoyo: txt_(d.tipo_apoyo, 60), tipo_beneficiario: tb,
    unidad: txt_(d.unidad, 40) || 'piezas', monto_unitario: mu, periodicidad: per, fuente_recurso: txt_(d.fuente_recurso, 40),
    evidencia: lista_(d.evidencia).filter(x => C.evidencia.indexOf(x) >= 0).join(';'), confidencial: d.confidencial ? 'SI' : '',
    campos_extra: Array.isArray(d.campos_extra) ? JSON.stringify(d.campos_extra.slice(0, 15)) : '', activo: 'SI', creado: new Date(), creado_por: u.id });
  bitacora_(u, 'alta', 'Programas', id, 'nombre', '', txt_(d.nombre, 150));
  return { ok: true, id };
}
/* Corrección directa (administrador o responsable del área). Siempre con motivo y valor anterior en la bitácora. */
const EDITABLES = {
  Beneficiarios: ['tipo', 'curp', 'nombre', 'nacimiento', 'sexo', 'telefono', 'localidad', 'colonia', 'direccion', 'cp', 'lat', 'lng',
    'origen_ubicacion', 'grupos', 'grupo_otro', 'tutor_id', 'estado', 'posible_duplicado_de', 'confidencial', 'activo'],
  Entregas: ['fecha', 'cantidad', 'monto', 'recibio', 'representante', 'estado', 'alerta', 'lote_id'],
  Solicitudes: ['estatus', 'descripcion', 'programa_id'],
  Eventos: ['nombre', 'fecha', 'lugar', 'lat', 'lng', 'localidad', 'estado'],
  Programas: ['nombre', 'unidad', 'monto_unitario', 'periodicidad', 'fuente_recurso', 'evidencia', 'confidencial', 'activo']
};
function opEditar_(u, d) {
  const n = String(d.hoja), motivo = txt_(d.motivo, 300), cambios = d.cambios || {};
  if (!EDITABLES[n] || !motivo || typeof cambios !== 'object') return { ok: false, error: 'datos' };
  const f = uno_(n, 'id', idReal_(txt_(d.id, 40).toUpperCase()));
  if (!f) return { ok: false, error: 'datos' };
  const area = n === 'Beneficiarios' ? (f.o.area_alta || '') : f.o.area !== undefined ? f.o.area
    : (uno_('Programas', 'id', f.o.programa_id) || { o: {} }).o.area;
  if (!esAdmin_(u) && !(area && puedeArea_(u, area))) return { ok: false, error: 'permiso' };
  const hechos = [];
  Object.keys(cambios).forEach(c => {
    if (EDITABLES[n].indexOf(c) < 0) return;
    let v = txt_(cambios[c], 300);
    if (c === 'curp') { v = v.toUpperCase(); if (v && !CURP_RE.test(v)) return; }
    if (c === 'estatus' && CATALOGOS_BASE.estatus_solicitud.indexOf(v) < 0) return;
    const antes = f.o[c] instanceof Date ? fecha_(f.o[c]) : String(f.o[c]);
    if (antes === v) return;
    cambia_(n, f.fila, c, v);
    if (n === 'Beneficiarios' && c === 'nombre') cambia_(n, f.fila, 'nombre_norm', norm_(v));
    if (n === 'Solicitudes') cambia_(n, f.fila, 'actualizado', new Date());
    bitacora_(u, 'cambio', n, f.o.id, c, antes, v, motivo);
    hechos.push(c);
  });
  return { ok: true, id: f.o.id, cambiados: hechos };
}

/* ---------- Usuarios (solo administrador, con señal) ---------- */
function usuarios_() {
  return { ok: true, usuarios: filas_('Usuarios').map(x => ({ id: x.id, nombre: x.nombre, rol: x.rol, areas: lista_(x.areas),
    activo: String(x.activo).toUpperCase() === 'SI' })) };
}
function crearUsuarioWeb_(u, d) {
  if (!esAdmin_(u)) return { ok: false, error: 'permiso' };
  const nombre = txt_(d.nombre, 100), rol = ROLES.indexOf(d.rol) >= 0 ? d.rol : 'capturista', areas = lista_(d.areas);
  if (!nombre || (rol !== 'admin' && !areas.length)) return { ok: false, error: 'datos' };
  const r = creaUsuario_(u, nombre, rol, areas);
  return { ok: true, id: r.id, enlace: r.enlace, token: r.token };
}
function bajaUsuario_(u, d) {
  if (!esAdmin_(u)) return { ok: false, error: 'permiso' };
  if (d.id === u.id) return { ok: false, error: 'propia' };
  const f = uno_('Usuarios', 'id', txt_(d.id, 40));
  if (!f) return { ok: false, error: 'datos' };
  cambia_('Usuarios', f.fila, 'activo', 'NO');
  bitacora_(u, 'baja_usuario', 'Usuarios', f.o.id, 'activo', 'SI', 'NO', txt_(d.motivo, 200));
  return { ok: true };
}
