/* Padrón Único Municipal · app de captura (sin señal primero).
   Todo lo que se captura se guarda como "operación" en el teléfono (IndexedDB) y se envía en lotes al servidor
   del ayuntamiento. Cada operación lleva su op_id: si se reenvía, el servidor no duplica. */
'use strict';
const SRV = (window.PADRON || {}).servidor || '';
const DEMO = !/^https?:|^\//.test(SRV) || SRV.indexOf('PEGUE') >= 0;
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CURP_RE = /^[A-Z]{4}\d{6}[HM][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z\d]\d$/;
const rid = p => p + '-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 7).toUpperCase();
const hoy = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const norm = x => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const TIPOS = { persona: 'Persona', hogar: 'Hogar o familia', grupo: 'Grupo u organización', institucion: 'Institución (escuela, centro de salud…)', territorio: 'Calle, colonia o localidad (obra)', unidad_productiva: 'Parcela, animal o unidad productiva' };
const ERR = { datos: 'Datos incompletos o no válidos', permiso: 'Ese apoyo es de otra área', accion: 'Acción no reconocida' };

let TOKEN = '', S = null, SEL = null, MODO_EV = null, G = {}, HUELLA = false, FIRMADO = false, PILA = [], ocupado = false;

/* ---------- Almacén del teléfono ---------- */
const DB = new Promise((ok, er) => {
  const r = indexedDB.open('padron-municipal', 1);
  r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('ops', { keyPath: 'op_id' }); d.createObjectStore('personas', { keyPath: 'id' }); d.createObjectStore('hechos', { keyPath: 'op_id' }); };
  r.onsuccess = () => ok(r.result); r.onerror = () => er(r.error);
});
const tx = async (s, m, f) => { const d = await DB; return new Promise((ok, er) => { const t = d.transaction(s, m), q = f(t.objectStore(s)); t.oncomplete = () => ok(q && q.result); t.onerror = () => er(t.error); }); };
const pon = (s, v) => tx(s, 'readwrite', o => o.put(v)), todo = s => tx(s, 'readonly', o => o.getAll()), quita = (s, k) => tx(s, 'readwrite', o => o.delete(k));
const guardaSesion = () => { try { localStorage.setItem('sesion', JSON.stringify(S)); } catch (e) {} };

function msg(t, c) { const m = $('m'); m.textContent = t; m.className = t ? (c || 'o') : ''; clearTimeout(msg.t); if (t) msg.t = setTimeout(() => m.className = '', c === 'e' ? 9000 : 4500); }

/* ---------- Servidor ---------- */
async function post(b) {
  if (DEMO) return demo(b);
  const r = await fetch(SRV, { method: 'POST', body: JSON.stringify(Object.assign({ token: TOKEN }, b)) });
  return r.json();
}
/* Modo de muestra (sin servidor configurado): responde con ejemplos y no envía nada. */
function demo(b) {
  if (b.a === 'login') return { ok: true, municipio: 'Ayuntamiento de ejemplo', usuario: { id: 'U-DEMO', nombre: 'Usuario de ejemplo', rol: 'admin', areas: ['DIF'] },
    catalogos: { localidad: ['Centro', 'San Juan'], area: ['DIF', 'Obras Públicas'], grupo: ['Persona adulta mayor', 'Persona con discapacidad', 'Mujer jefa de familia'],
      tipo_apoyo: ['En especie'], unidad: ['paquetes', 'pesos'], periodicidad: ['unica', 'bimestral'], fuente_recurso: ['Municipal'], evidencia: ['foto', 'firma', 'lista'], aviso: ['(Ejemplo) Aviso de privacidad del ayuntamiento.'] },
    programas: [{ id: 'P-DEMO1', nombre: 'Despensa bimestral', area: 'DIF', unidad: 'paquetes', monto_unitario: 350, periodicidad: 'bimestral', evidencia: ['foto', 'firma'], tipo_beneficiario: 'persona', campos_extra: [] }],
    eventos: [{ id: 'EV-DEMO1', nombre: 'Entrega de despensas en el Centro', programa_id: 'P-DEMO1', fecha: hoy(), lugar: 'Explanada' }] };
  if (b.a === 'buscar') return { ok: true, resultados: norm(b.q).indexOf('ana') >= 0 ? [{ id: 'B-DEMO1', nombre: 'Ana Gómez Martínez', localidad: 'Centro', tipo: 'persona' }] : [] };
  if (b.a === 'sync') return { ok: true, resultados: b.ops.map(o => ({ op_id: o.op_id, ok: true, id: o.datos.id })) };
  return { ok: false, error: 'accion' };
}

/* ---------- Navegación ---------- */
function ir(v, sinPila) {
  const act = document.querySelector('main>section:not([hidden])');
  if (act && !sinPila && act.id !== v) PILA.push(act.id);
  document.querySelectorAll('main>section').forEach(s => s.hidden = s.id !== v);
  window.scrollTo(0, 0);
  if (v === 'v-pen') pintaPendientes();
  if (v === 'v-evs') pintaEventos();
  if (v === 'v-bus') { $('bev').hidden = !MODO_EV; if (MODO_EV) $('bev').innerHTML = 'Evento: <b>' + esc(MODO_EV.nombre) + '</b> · <a href="#" onclick="saleEvento();return false">salir del evento</a>'; setTimeout(() => $('q').focus(), 50); }
}
function volver() { const v = PILA.pop(); ir(v && v !== 'v-ent' && v !== 'v-alta' ? v : 'v-ini', true); }
function inicio() { PILA = []; ir(MODO_EV ? 'v-bus' : 'v-ini', true); }

async function entrar() {
  try {
    const x = await post({ a: 'login' });
    if (!x.ok) { if (x.error === 'enlace') { localStorage.removeItem('token'); localStorage.removeItem('sesion'); S = null; ir('v-sin', true); $('v-sin').querySelector('p').textContent = 'Su enlace ya no es válido. Pida uno nuevo al administrador. Lo que no se envió sigue guardado en este teléfono.'; } return; }
    const locales = S ? { programas: (S.programas || []).filter(p => p.local), eventos: (S.eventos || []).filter(e => e.local) } : { programas: [], eventos: [] };
    S = x;
    const idsP = S.programas.map(p => p.id), idsE = S.eventos.map(e => e.id);
    S.programas = S.programas.concat(locales.programas.filter(p => idsP.indexOf(p.id) < 0));
    S.eventos = S.eventos.concat(locales.eventos.filter(e => idsE.indexOf(e.id) < 0));
    guardaSesion(); mostrar(); enviar();
  } catch (e) { if (!S) msg('No se pudo conectar. Intente con señal.', 'e'); }
}
function mostrar() {
  $('tit').textContent = S.municipio || 'Padrón de beneficiarios';
  $('sub').textContent = S.usuario.nombre + (S.usuario.areas.length ? ' · ' + S.usuario.areas.join(', ') : '');
  $('hola').textContent = DEMO ? 'MUESTRA: no hay servidor configurado; nada se envía.' : 'Hola, ' + S.usuario.nombre + '.';
  const gest = ['admin', 'responsable'].indexOf(S.usuario.rol) >= 0;
  $('b-adm').hidden = !gest; $('adm-u').hidden = S.usuario.rol !== 'admin';
  $('b-sol').hidden = S.usuario.rol === 'consulta';
  const C = S.catalogos || {};
  $('dl-loc').innerHTML = (C.localidad || []).map(l => '<option value="' + esc(l) + '">').join('');
  $('tb').innerHTML = Object.keys(TIPOS).map(k => '<option value="' + k + '">' + TIPOS[k] + '</option>').join('');
  const gr = (C.grupo || []).concat(['Otro (especificar)']);
  $('gr').innerHTML = gr.map((g, i) => '<div class="ck"><input type="checkbox" id="g' + i + '" value="' + esc(g) + '" onchange="cuentaGr()"><label for="g' + i + '" style="margin:0;color:var(--ink)">' + esc(g) + '</label></div>').join('');
  $('avx').textContent = (C.aviso || []).join('\n\n') || 'El administrador aún no ha cargado el texto del aviso de privacidad.';
  pintaAdmin();
  pintaEstado();
  if (!document.querySelector('main>section:not([hidden])') || !$('v-sin').hidden) ir(MODO_EV ? 'v-bus' : 'v-ini', true);
}

/* ---------- Buscar ---------- */
async function buscar() {
  const q = $('q').value.trim(); if (!q) return;
  const n = norm(q), Q = q.toUpperCase(), locales = (await todo('personas')).filter(p => (p.curp && p.curp === Q) || p.id === Q || (n.length >= 3 && norm(p.nombre).indexOf(n) >= 0));
  let rs = locales, aviso = '';
  if (navigator.onLine || DEMO) {
    try { const x = await post({ a: 'buscar', q }); if (x.ok) { const ids = x.resultados.map(r => r.id); rs = x.resultados.concat(locales.filter(l => ids.indexOf(l.id) < 0)); } else if (x.error === 'corto') aviso = 'Escriba al menos nombre y un apellido.'; }
    catch (e) { aviso = 'Sin conexión con el servidor: solo se buscó en este teléfono.'; }
  } else aviso = 'Sin señal: solo se buscó entre las personas registradas en este teléfono.';
  $('res').innerHTML = (aviso ? '<div class="st wn">' + esc(aviso) + '</div>' : '') + (rs.length ? rs.map(r =>
    '<div class="it"><b>' + esc(r.nombre) + '</b>' + (r.tipo && r.tipo !== 'persona' ? '<span class="tag">' + esc(TIPOS[r.tipo] || r.tipo) + '</span>' : '') + '<div class="st">' + esc(r.localidad || '') + (r.estado && r.estado !== 'Completo' ? ' · ' + esc(r.estado) : '') + '</div>' +
    '<button onclick="entrega(\'' + esc(r.id) + '\',this.dataset.n)" data-n="' + esc(r.nombre) + '">Registrar apoyo</button>' +
    (MODO_EV ? '' : '<button class="s" onclick="solicitudDe(\'' + esc(r.id) + '\',this.dataset.n)" data-n="' + esc(r.nombre) + '">Solicitud</button>') + '</div>').join('')
    : '<div class="st">No se encontró. Revise cómo lo escribió o regístrela como nueva.</div>');
}
$('q').addEventListener('keydown', e => { if (e.key === 'Enter') buscar(); });

/* ---------- Alta de beneficiario ---------- */
function altaNueva(otro) {
  ['curp', 'nom', 'nac', 'sx', 'tut', 'tel', 'col', 'cp', 'dir', 'grq', 'gro'].forEach(i => $(i).value = '');
  const q = $('q').value.trim(); if (CURP_RE.test(q.toUpperCase())) { $('curp').value = q.toUpperCase(); deCurp(); } else if (q && !otro) $('nom').value = q;
  if (MODO_EV && MODO_EV.localidad) $('loc').value = MODO_EV.localidad; else $('loc').value = '';
  document.querySelectorAll('#gr input').forEach(i => i.checked = false); cuentaGr(); filtraGr();
  $('av').checked = false; G.alta = null; $('gps-alta').textContent = 'Sin ubicación. Si no se puede tomar, se guarda como pendiente.';
  $('tb').value = otro ? 'hogar' : 'persona'; $('alt-tipo-b').hidden = !otro; tipoAlta(); $('curp-m').textContent = ''; $('tut-b').hidden = true;
  ir('v-alta');
}
function tipoAlta() {
  const per = $('tb').value === 'persona';
  $('alt-per').hidden = !per; $('alt-per2').hidden = !per; $('alt-gr').hidden = !per;
  $('alt-t').textContent = per ? 'Persona nueva' : TIPOS[$('tb').value];
  $('nom-l').textContent = per ? 'Nombre completo' : 'Nombre (ej. Familia Pérez Luna, Escuela Benito Juárez, Calle Reforma)';
}
function deCurp() {
  const c = $('curp').value.trim().toUpperCase(); $('curp').value = c;
  if (!c) { $('curp-m').textContent = ''; return; }
  if (!CURP_RE.test(c)) { $('curp-m').textContent = c.length === 18 ? 'El CURP no tiene el formato correcto.' : ''; return; }
  const f = (/\d/.test(c[16]) ? '19' : '20') + c.slice(4, 6) + '-' + c.slice(6, 8) + '-' + c.slice(8, 10);
  if (!$('nac').value) $('nac').value = f;
  if (!$('sx').value) $('sx').value = c[10] === 'H' ? 'Hombre' : 'Mujer';
  $('curp-m').textContent = 'Se llenaron fecha de nacimiento y sexo desde el CURP. Revíselos.'; menor();
}
function edad(n) { if (!n) return 99; const h = hoy(); let a = +h.slice(0, 4) - +n.slice(0, 4); if (h.slice(5) < n.slice(5)) a--; return a; }
function menor() { $('tut-b').hidden = edad($('nac').value) >= 18; }
$('nac').addEventListener('change', menor);
function filtraGr() { const q = norm($('grq').value); document.querySelectorAll('#gr .ck').forEach(d => d.hidden = q && norm(d.textContent).indexOf(q) < 0 && d.textContent.indexOf('Otro') < 0); }
function cuentaGr() {
  const s = [...document.querySelectorAll('#gr input:checked')].map(i => i.value);
  $('grn').textContent = s.length ? 'Elegidos: ' + s.join(', ') : '';
  $('gro').hidden = s.indexOf('Otro (especificar)') < 0;
}
function verAviso(e) { e.preventDefault(); $('avx').hidden = !$('avx').hidden; }
async function guardaAlta(solo) {
  const tipo = $('tb').value, per = tipo === 'persona', nom = $('nom').value.trim(), curp = $('curp').value.trim().toUpperCase();
  if (!nom) return msg('Escriba el nombre.', 'e');
  if (per && curp && !CURP_RE.test(curp)) return msg('El CURP no es válido. Corríjalo o déjelo vacío.', 'e');
  if (per && $('nac').value > hoy()) return msg('La fecha de nacimiento no es válida.', 'e');
  const grupos = [...document.querySelectorAll('#gr input:checked')].map(i => i.value).filter(g => g !== 'Otro (especificar)');
  const otro = $('gro').hidden ? '' : $('gro').value.trim();
  if (!$('gro').hidden && !otro) return msg('Escriba cuál es el otro grupo.', 'e');
  if (!$('av').checked) return msg('Confirme que informó el aviso de privacidad.', 'e');
  if (per && curp) { const ya = (await todo('personas')).find(p => p.curp === curp); if (ya) { msg('Esa persona ya está registrada en este teléfono.', 'w'); return solo ? inicio() : entrega(ya.id, ya.nombre); } }
  const id = rid('T'), ops = [];
  let tutor = '';
  if (per && !$('tut-b').hidden && $('tut').value.trim()) { tutor = rid('T'); ops.push({ tipo: 'beneficiario', datos: { id: tutor, tipo: 'persona', nombre: $('tut').value.trim(), localidad: $('loc').value.trim(), area: (S.usuario.areas[0] || '') } }); }
  const g = G.alta;
  ops.push({ tipo: 'beneficiario', datos: { id, tipo, curp: per ? curp : '', nombre: nom, nacimiento: per ? $('nac').value : '', sexo: per ? $('sx').value : '',
    telefono: per ? $('tel').value.trim() : '', localidad: $('loc').value.trim(), colonia: $('col').value.trim(), cp: $('cp').value.trim(), direccion: $('dir').value.trim(),
    lat: g ? g.lat : '', lng: g ? g.lng : '', precision_m: g ? g.acc : '', grupos, grupo_otro: otro, tutor_id: tutor, area: MODO_EV ? MODO_EV.area : (S.usuario.areas[0] || '') } });
  for (const o of ops) await encola(o.tipo, o.datos, (o.datos.id === tutor ? 'Tutor: ' : 'Alta: ') + o.datos.nombre);
  await pon('personas', { id, nombre: nom, localidad: $('loc').value.trim(), curp: per ? curp : '', tipo });
  if (tutor) await pon('personas', { id: tutor, nombre: $('tut').value.trim(), localidad: $('loc').value.trim(), curp: '', tipo: 'persona' });
  msg(nom + ' quedó guardado' + (navigator.onLine ? '.' : ' en el teléfono; se enviará con señal.'));
  if (solo) inicio(); else entrega(id, nom);
}

/* ---------- Entrega en 3 pasos ---------- */
function programasMios() { return (S.programas || []).filter(p => S.usuario.rol === 'admin' || S.usuario.areas.indexOf(p.area) >= 0); }
function entrega(id, nombre) {
  SEL = { id, nombre }; $('e-quien').textContent = nombre;
  $('rec-b').checked = true; recibe(); $('rep').value = ''; $('cant').value = 1; $('mon').value = ''; $('fa').value = ''; $('papel').value = '';
  const ps = programasMios();
  $('prog').innerHTML = '<option value="">Elija el apoyo</option>' + ps.map(p => '<option value="' + esc(p.id) + '">' + esc(p.nombre) + ' · ' + esc(p.area) + '</option>').join('');
  if (MODO_EV) { $('prog').value = MODO_EV.programa_id; $('fec').value = MODO_EV.fecha || hoy(); } else { $('prog').value = ps.length === 1 ? ps[0].id : ''; $('fec').value = hoy(); }
  $('prog').disabled = !!MODO_EV; progSel(); G.ent = null; $('gps-ent').textContent = MODO_EV && MODO_EV.lugar ? 'Se usa la ubicación del evento: ' + MODO_EV.lugar : '';
  ir('v-ent'); paso(1);
  if (!ps.length) msg('No hay apoyos dados de alta para su área. Pida al responsable que los registre.', 'w');
}
function recibe() { $('rep-b').hidden = !$('rec-r').checked; }
function prog() { return (S.programas || []).find(p => p.id === $('prog').value); }
function progSel() {
  const p = prog();
  $('prog-d').textContent = p ? [p.unidad, p.monto_unitario !== '' && p.monto_unitario != null ? '$' + p.monto_unitario + ' por unidad' : 'monto se escribe', p.periodicidad && p.periodicidad !== 'unica' ? 'se entrega: ' + p.periodicidad.replace('_', ' ') : 'entrega única'].join(' · ') : '';
  $('mon').placeholder = p && p.monto_unitario !== '' && p.monto_unitario != null ? 'automático' : 'escriba el monto';
  $('extra').innerHTML = p ? (p.campos_extra || []).map((c, i) => '<label for="x' + i + '">' + esc(c.label || c.k) + '</label><input id="x' + i + '" data-k="' + esc(c.k) + '">').join('') : '';
  $('ev-pide').textContent = p && p.evidencia && p.evidencia.length ? 'Este apoyo pide: ' + p.evidencia.join(', ') + '.' : 'Tome al menos una foto o la firma.';
}
function paso(n) {
  if (n === 2 && $('rec-r').checked && !$('rep').value.trim()) return msg('Escriba quién recoge.', 'e');
  if (n === 3) { if (!prog()) return msg('Elija el apoyo.', 'e'); if (!(+$('cant').value > 0)) return msg('La cantidad debe ser mayor que cero.', 'e'); const p = prog(); if ((p.monto_unitario === '' || p.monto_unitario == null) && $('mon').value === '' && p.unidad === 'pesos') return msg('Escriba el monto entregado.', 'e'); }
  [1, 2, 3].forEach(i => { $('e' + i).hidden = i !== n; $('p' + i).className = i <= n ? 'on' : ''; });
  if (n === 3) iniciaFirma();
}
function iniciaFirma() {
  const c = $('firma'), r = c.getBoundingClientRect(), x = c.getContext('2d');
  c.width = r.width * (window.devicePixelRatio || 1); c.height = r.height * (window.devicePixelRatio || 1);
  x.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1); x.lineWidth = 2.5; x.lineCap = 'round'; x.strokeStyle = '#111';
  x.fillStyle = '#fff'; x.fillRect(0, 0, r.width, r.height); FIRMADO = false; HUELLA = false;
  let d = false; const pt = e => { const b = c.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  c.onpointerdown = e => { d = true; c.setPointerCapture(e.pointerId); x.beginPath(); x.moveTo(...pt(e)); };
  c.onpointermove = e => { if (!d) return; x.lineTo(...pt(e)); x.stroke(); FIRMADO = true; };
  c.onpointerup = () => d = false;
}
function borraFirma() { iniciaFirma(); }
function huella() { HUELLA = true; msg('Anotado: no sabe firmar. Tome foto de la huella o de la firma de un testigo.', 'w'); }
const comp = (f, mx = 1000, q = .6) => new Promise(ok => { if (!f) return ok(''); const im = new Image(), u = URL.createObjectURL(f); im.onload = () => { const k = Math.min(1, mx / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = im.width * k; c.height = im.height * k; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u); ok(c.toDataURL('image/jpeg', q)); }; im.onerror = () => ok(''); im.src = u; });
async function guardaEntrega() {
  const p = prog(); if (!p || !SEL) return;
  const evid = [], foto = await comp($('fa').files[0]);
  if (foto) evid.push({ tipo: 'foto', b64: foto });
  if (FIRMADO) evid.push({ tipo: 'firma', b64: $('firma').toDataURL('image/jpeg', .5) });
  if (HUELLA) evid.push({ tipo: 'huella', ref: 'No sabe firmar' });
  if ($('papel').value.trim()) evid.push({ tipo: 'lista', ref: $('papel').value.trim() });
  if (!evid.length && !confirm('No hay foto, firma ni folio de papel. ¿Guardar sin evidencia?')) return;
  const extra = {}; document.querySelectorAll('#extra input').forEach(i => { if (i.value.trim()) extra[i.dataset.k] = i.value.trim(); });
  const g = G.ent, d = { id: rid('E'), beneficiario_id: SEL.id, programa_id: p.id, evento_id: MODO_EV ? MODO_EV.id : '', fecha: $('fec').value || hoy(),
    cantidad: +$('cant').value, monto: $('mon').value === '' ? '' : +$('mon').value, recibio: $('rec-r').checked ? 'representante' : 'beneficiario',
    representante: $('rep').value.trim(), evidencia: evid, lat: g ? g.lat : '', lng: g ? g.lng : '', datos_extra: Object.keys(extra).length ? extra : '' };
  $('b-ent').disabled = true;
  try { await encola('entrega', d, p.nombre + ' → ' + SEL.nombre); msg('Entrega guardada: ' + SEL.nombre + '.'); SEL = null; $('q').value = ''; $('res').innerHTML = ''; PILA = []; ir(MODO_EV ? 'v-bus' : 'v-ini', true); }
  catch (e) { msg('No se pudo guardar en el teléfono. Libere espacio e intente de nuevo.', 'e'); }
  finally { $('b-ent').disabled = false; }
}

/* ---------- Ubicación ---------- */
function gps(k) {
  const out = $('gps-' + k); out.textContent = 'Buscando señal GPS…';
  if (!navigator.geolocation) { out.textContent = 'Este teléfono no da ubicación. Se guarda como pendiente.'; return; }
  navigator.geolocation.getCurrentPosition(p => {
    G[k] = { lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), acc: Math.round(p.coords.accuracy) };
    out.innerHTML = G[k].acc > 30 ? '<span class="wn">Ubicación tomada con poca precisión (±' + G[k].acc + ' m). Si puede, salga a un lugar abierto y vuelva a tocar el botón.</span>' : '<span class="ok">Ubicación tomada (±' + G[k].acc + ' m).</span>';
  }, () => { out.textContent = 'No se pudo tomar la ubicación. Se guardará como pendiente; escriba bien la dirección.'; }, { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 });
}

/* ---------- Eventos ---------- */
function pintaEventos() {
  const mios = programasMios().map(p => p.id), l = (S.eventos || []).filter(e => mios.indexOf(e.programa_id) >= 0);
  $('evl').innerHTML = l.length ? l.map(e => '<div class="it"><b>' + esc(e.nombre) + '</b><div class="st">' + esc([e.fecha, e.lugar].filter(Boolean).join(' · ')) + '</div><button onclick="entraEvento(\'' + esc(e.id) + '\')">Entrar</button></div>').join('') : '<div class="st">No hay eventos de su área. El responsable los da de alta en “Programas, eventos y usuarios”.</div>';
}
function entraEvento(id) { MODO_EV = (S.eventos || []).find(e => e.id === id) || null; const p = MODO_EV && (S.programas || []).find(x => x.id === MODO_EV.programa_id); if (MODO_EV && p) MODO_EV.area = p.area; PILA = []; $('q').value = ''; $('res').innerHTML = ''; ir('v-bus', true); }
function saleEvento() { MODO_EV = null; PILA = []; ir('v-ini', true); }

/* ---------- Solicitudes ---------- */
function nuevaSolicitud() { MODO_EV = null; msg('Busque a la persona y toque “Solicitud”.', 'w'); ir('v-bus'); }
function solicitudDe(id, nombre) {
  SEL = { id, nombre }; $('sol-q').textContent = nombre; $('sol-d').value = '';
  const areas = (S.catalogos.area || []);
  $('sol-p').innerHTML = '<option value="">Elija</option>' + (S.programas || []).map(p => '<option value="P:' + esc(p.id) + '">' + esc(p.nombre) + '</option>').join('') + areas.map(a => '<option value="A:' + esc(a) + '">Área: ' + esc(a) + '</option>').join('');
  ir('v-sol');
}
async function guardaSolicitud() {
  const v = $('sol-p').value, d = $('sol-d').value.trim();
  if (!v || !d) return msg('Elija el apoyo o área y escriba qué pide.', 'e');
  await encola('solicitud', { id: rid('S'), beneficiario_id: SEL.id, programa_id: v[0] === 'P' ? v.slice(2) : '', area: v[0] === 'A' ? v.slice(2) : '', descripcion: d }, 'Solicitud: ' + SEL.nombre);
  msg('Solicitud guardada.'); inicio();
}

/* ---------- Cola y envío ---------- */
async function encola(tipo, datos, texto) {
  await pon('ops', { op_id: rid('OP'), tipo, datos, texto, ts: Date.now(), estado: 'pendiente' });
  pintaEstado(); enviar();
}
async function enviar(manual) {
  if (ocupado || !S) return;
  if (!navigator.onLine && !DEMO) { if (manual) msg('Sin señal. Se enviará solo cuando haya conexión.', 'w'); return pintaEstado(); }
  ocupado = true;
  try {
    for (let vuelta = 0; vuelta < 10; vuelta++) {
      const pend = (await todo('ops')).filter(o => o.estado === 'pendiente').sort((a, b) => a.ts - b.ts).slice(0, 25);
      if (!pend.length) { if (manual) msg('Todo enviado.'); break; }
      let x;
      try { x = await post({ a: 'sync', ops: pend.map(o => ({ op_id: o.op_id, tipo: o.tipo, datos: o.datos })) }); }
      catch (e) { if (manual) msg('No se pudo conectar. Se reintentará solo.', 'w'); break; }
      if (!x.ok) { if (x.error === 'enlace') msg('Su enlace ya no es válido. Pida uno nuevo; lo capturado sigue en el teléfono.', 'e'); else if (manual) msg('El servidor está ocupado. Se reintentará solo.', 'w'); break; }
      let atorado = false;
      for (const r of x.resultados) {
        const o = pend.find(p => p.op_id === r.op_id); if (!o) continue;
        if (r.ok) {
          await quita('ops', o.op_id);
          const avisos = [].concat(r.avisos || [], r.alertas || []);
          await pon('hechos', { op_id: o.op_id, texto: o.texto, ts: Date.now(), avisos, estado: r.estado || '' });
          if (o.tipo === 'beneficiario' && r.id && r.id !== o.datos.id) { await quita('personas', o.datos.id); await pon('personas', { id: r.id, nombre: o.datos.nombre, localidad: o.datos.localidad, curp: o.datos.curp, tipo: o.datos.tipo }); }
          if (o.tipo === 'programa' || o.tipo === 'evento') { const l = o.tipo === 'programa' ? S.programas : S.eventos, it = l.find(i => i.id === o.datos.id); if (it) delete it.local; guardaSesion(); }
        } else if (r.error === 'ocupado') atorado = true;
        else { o.estado = 'error'; o.error = ERR[r.error] || r.error; if (r.campo) o.error += ' (' + r.campo + ')'; await pon('ops', o); }
      }
      if (atorado) break;
    }
  } finally { ocupado = false; pintaEstado(); if (!$('v-pen').hidden) pintaPendientes(); }
}
async function pintaEstado() {
  const ops = await todo('ops'), p = ops.filter(o => o.estado === 'pendiente').length, e = ops.length - p;
  $('est').textContent = (navigator.onLine ? '' : 'Sin señal · ') + (p ? p + ' por enviar' : 'Todo enviado') + (e ? ' · ' + e + ' con error' : '');
  $('npen').textContent = p + e ? '(' + (p + e) + ')' : '';
}
async function pintaPendientes() {
  const ops = (await todo('ops')).sort((a, b) => b.ts - a.ts), f = t => new Date(t).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  $('pen-r').textContent = ops.length ? ops.length + ' sin enviar. No borre los datos del navegador ni desinstale la app hasta enviarlos.' : 'No hay nada pendiente.';
  $('pen').innerHTML = ops.map(o => '<div class="it ' + (o.estado === 'error' ? 'er' : 'wn') + '"><b>' + esc(o.texto) + '</b><div class="st">' + f(o.ts) + ' · ' + (o.estado === 'error' ? 'No se aceptó: ' + esc(o.error) : 'Pendiente') + '</div>' +
    (o.estado === 'error' ? '<button class="x" onclick="descarta(\'' + o.op_id + '\')">Borrar</button><button class="s" onclick="reintenta(\'' + o.op_id + '\')">Reintentar</button>' : '') + '</div>').join('');
  const h = (await todo('hechos')).filter(x => Date.now() - x.ts < 864e5).sort((a, b) => b.ts - a.ts);
  $('hechos').innerHTML = h.length ? h.map(x => '<div class="it ok">' + esc(x.texto) + (x.avisos && x.avisos.length ? '<div class="st wn">Aviso: ' + esc(x.avisos.join(', ').replace(/_/g, ' ')) + '</div>' : '') + '</div>').join('') : '<div class="st">Nada todavía.</div>';
}
async function descarta(id) { if (!confirm('¿Borrar este registro? No se enviará.')) return; await quita('ops', id); pintaPendientes(); pintaEstado(); }
async function reintenta(id) { const o = (await todo('ops')).find(x => x.op_id === id); if (!o) return; o.estado = 'pendiente'; delete o.error; o.op_id = rid('OP'); await quita('ops', id); await pon('ops', o); enviar(true); }

/* ---------- Administración ---------- */
const opc = (l, f) => (l || []).map(v => '<option value="' + esc(v) + '">' + esc(f ? f(v) : v) + '</option>').join('');
function pintaAdmin() {
  const C = S.catalogos || {}, mias = S.usuario.rol === 'admin' ? (C.area || []) : S.usuario.areas;
  $('pa-a').innerHTML = opc(mias); $('pa-t').innerHTML = opc(C.tipo_apoyo); $('pa-b').innerHTML = opc(Object.keys(TIPOS), k => TIPOS[k]);
  $('pa-u').innerHTML = opc(C.unidad); $('pa-p').innerHTML = opc(C.periodicidad, v => v.replace('_', ' ')); $('pa-f').innerHTML = opc(C.fuente_recurso);
  $('pa-e').innerHTML = (C.evidencia || []).map(v => '<div class="ck"><input type="checkbox" value="' + esc(v) + '" id="pe-' + esc(v) + '"' + (v === 'foto' || v === 'firma' ? ' checked' : '') + '><label for="pe-' + esc(v) + '" style="margin:0;color:var(--ink)">' + esc(v) + '</label></div>').join('');
  const ps = '<option value="">Elija</option>' + programasMios().map(p => '<option value="' + esc(p.id) + '">' + esc(p.nombre) + '</option>').join('');
  $('ev-p').innerHTML = ps; $('lo-p').innerHTML = ps; $('ev-f').value = hoy();
  $('us-a').innerHTML = (C.area || []).map((a, i) => '<div class="ck"><input type="checkbox" id="ua' + i + '" value="' + esc(a) + '"><label for="ua' + i + '" style="margin:0;color:var(--ink)">' + esc(a) + '</label></div>').join('');
}
async function guardaPrograma() {
  const n = $('pa-n').value.trim(); if (!n) return msg('Escriba el nombre del programa.', 'e');
  const d = { id: rid('P'), nombre: n, area: $('pa-a').value, tipo_apoyo: $('pa-t').value, tipo_beneficiario: $('pa-b').value, unidad: $('pa-u').value,
    monto_unitario: $('pa-m').value === '' ? '' : +$('pa-m').value, periodicidad: $('pa-p').value, fuente_recurso: $('pa-f').value,
    evidencia: [...document.querySelectorAll('#pa-e input:checked')].map(i => i.value), confidencial: $('pa-c').checked, campos_extra: [] };
  S.programas.push(Object.assign({ local: true }, d)); guardaSesion(); await encola('programa', d, 'Programa: ' + n);
  $('pa-n').value = ''; $('pa-m').value = ''; $('pa-c').checked = false; pintaAdmin(); msg('Programa guardado. Ya se puede elegir al registrar.');
}
async function guardaEvento() {
  const n = $('ev-n').value.trim(), p = $('ev-p').value; if (!n || !p) return msg('Escriba el nombre y elija el apoyo.', 'e');
  const g = G.ev, d = { id: rid('EV'), nombre: n, programa_id: p, fecha: $('ev-f').value || hoy(), lugar: $('ev-l').value.trim(), localidad: $('ev-lo').value.trim(), lat: g ? g.lat : '', lng: g ? g.lng : '' };
  S.eventos.push(Object.assign({ local: true }, d)); guardaSesion(); await encola('evento', d, 'Evento: ' + n);
  $('ev-n').value = ''; $('ev-l').value = ''; G.ev = null; $('gps-ev').textContent = ''; msg('Evento guardado. Ábralo en “Entrega en evento o fila”.');
}
async function guardaLote() {
  const p = $('lo-p').value, c = +$('lo-c').value; if (!p || !(c > 0)) return msg('Elija el apoyo y la cantidad.', 'e');
  await encola('lote', { id: rid('L'), programa_id: p, cantidad: c, factura: $('lo-fa').value.trim(), proveedor: $('lo-pr').value.trim() }, 'Lote: ' + c);
  $('lo-c').value = ''; $('lo-fa').value = ''; $('lo-pr').value = ''; msg('Lote guardado.');
}
async function creaUsuario() {
  const n = $('us-n').value.trim(), areas = [...document.querySelectorAll('#us-a input:checked')].map(i => i.value), rol = $('us-r').value;
  if (!n) return msg('Escriba el nombre.', 'e'); if (rol !== 'admin' && !areas.length) return msg('Elija al menos un área.', 'e');
  if (!navigator.onLine && !DEMO) return msg('Crear usuarios necesita señal.', 'w');
  try { const x = await post({ a: 'crearUsuario', nombre: n, rol, areas });
    $('us-out').innerHTML = x.ok ? '<b>' + esc(n) + '</b>: <a href="' + esc(x.enlace) + '">' + esc(x.enlace) + '</a><div class="st">Mándeselo solo a esa persona. No se vuelve a mostrar.</div>' : 'No se pudo crear.';
    if (x.ok) { $('us-n').value = ''; document.querySelectorAll('#us-a input').forEach(i => i.checked = false); } } catch (e) { msg('No se pudo conectar.', 'e'); }
}
async function verUsuarios() {
  try { const x = await post({ a: 'usuarios' }); if (!x.ok) return;
    $('us-l').innerHTML = x.usuarios.filter(u => u.activo).map(u => '<div class="it">' + esc(u.nombre) + ' <span class="tag">' + esc(u.rol) + '</span><div class="st">' + esc(u.areas.join(', ')) + '</div>' + (u.id !== S.usuario.id ? '<button class="x" onclick="bajaUsuario(\'' + esc(u.id) + '\')">Dar de baja</button>' : '') + '</div>').join(''); }
  catch (e) { msg('No se pudo conectar.', 'e'); }
}
async function bajaUsuario(id) { const m = prompt('Motivo de la baja (ej. dejó el cargo):'); if (!m) return; const x = await post({ a: 'bajaUsuario', id, motivo: m }); msg(x.ok ? 'Enlace desactivado.' : 'No se pudo.', x.ok ? 'o' : 'e'); verUsuarios(); }

/* ---------- Arranque (al final: todo lo de arriba ya está definido) ---------- */
(async function arranque() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  const q = new URLSearchParams(location.search), u = (q.get('u') || '').trim();
  try { if (u) { localStorage.setItem('token', u); history.replaceState(null, '', location.pathname); } TOKEN = localStorage.getItem('token') || ''; S = JSON.parse(localStorage.getItem('sesion') || 'null'); } catch (e) {}
  if (DEMO && !TOKEN) TOKEN = 'DEMO';
  if (!TOKEN) return ir('v-sin', true);
  if (S) mostrar();
  if (navigator.onLine || DEMO) await entrar();
  else if (!S) { ir('v-sin', true); $('v-sin').querySelector('p').textContent = 'La primera vez necesita señal para entrar. Conéctese y vuelva a abrir el enlace.'; }
  setInterval(() => enviar(), 60000);
  window.addEventListener('online', () => { pintaEstado(); enviar(); });
  window.addEventListener('offline', pintaEstado);
})();
