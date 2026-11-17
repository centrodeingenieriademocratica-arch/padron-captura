/* CID Admin Beneficiarios: app de mando del Centro, solo para la administradora.
   - Las claves (enlaces de administrador de cada municipio y la clave del registro) se guardan SOLO en este celular,
     cifradas con AES-GCM y una llave derivada del PIN (PBKDF2). Nunca se mandan a otro lado que no sea su municipio.
   - La lista de municipios viene del registro del Centro (nombre y dirección, sin claves).
   - Los datos y la operación siguen en el Apps Script de cada municipio; esta app solo les pide números y abre su app. */
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const REG = (window.ADMIN && window.ADMIN.registro) || '';
let B = null, LLAVE = null, MUNS = [], RES = {}, ACT = null, ROL = 'admin';

function msg(t, k) { const m = $('m'); m.textContent = t; m.className = k || 'o'; clearTimeout(msg.t); msg.t = setTimeout(() => m.className = '', 5000); }
function ir(v) {
  document.querySelectorAll('main>section').forEach(s => s.hidden = s.id !== v);
  const dentro = ['v-nuevo', 'v-pin'].indexOf(v) < 0; $('b-ini').hidden = !dentro; $('b-aj').hidden = !dentro;
  if (v === 'v-aj') ajustes();
  scrollTo(0, 0);
}
const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
  del: k => { try { localStorage.removeItem(k); } catch (e) {} } };

/* ---------- Bóveda cifrada con el PIN ---------- */
const b64 = a => btoa(String.fromCharCode(...new Uint8Array(a))), deb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function llaveDe(pin, sal) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: sal, iterations: 210000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function guarda() {
  const iv = crypto.getRandomValues(new Uint8Array(12)), g = JSON.parse(ls.get('boveda'));
  const datos = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, LLAVE, new TextEncoder().encode(JSON.stringify(B)));
  ls.set('boveda', JSON.stringify({ sal: g.sal, iv: b64(iv), datos: b64(datos) }));
}
async function crearBoveda() {
  const pin = $('n-pin').value, reg = $('n-reg').value;
  if (!/^\d{6,}$/.test(pin)) return msg('El PIN debe tener al menos 6 números.', 'e');
  if (pin !== $('n-pin2').value) return msg('Los PIN no coinciden.', 'e');
  if (reg.length < 8) return msg('La clave del registro debe tener al menos 8 caracteres.', 'e');
  if (REG) {
    let r = await registro({ a: 'lista', clave: reg });
    if (!r.ok && r.error === 'sin_clave') { await registro({ a: 'ponClave', clave: reg }); r = await registro({ a: 'lista', clave: reg }); }
    if (!r.ok) return msg(r.error === 'clave' ? 'Esa no es la clave del registro.' : 'No se pudo hablar con el registro. Revise la señal.', 'e');
  }
  const sal = crypto.getRandomValues(new Uint8Array(16));
  LLAVE = await llaveDe(pin, sal);
  B = { registro: reg, llaves: {}, vistas: {}, dias: 30 };
  ls.set('boveda', JSON.stringify({ sal: b64(sal) }));
  await guarda();
  $('n-pin').value = $('n-pin2').value = $('n-reg').value = '';
  inicio();
}
async function abrirBoveda() {
  const g = JSON.parse(ls.get('boveda') || 'null'); if (!g) return ir('v-nuevo');
  try {
    LLAVE = await llaveDe($('p-pin').value, deb64(g.sal));
    B = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deb64(g.iv) }, LLAVE, deb64(g.datos))));
  } catch (e) { LLAVE = null; B = null; return msg('PIN incorrecto.', 'e'); }
  $('p-pin').value = ''; inicio();
}
function cerrar() { B = null; LLAVE = null; RES = {}; $('fr').src = 'about:blank'; ir('v-pin'); }
function borrarTodo() {
  if (!confirm('Se borran de este celular todas las claves. Tendrá que escribirlas otra vez. ¿Seguir?')) return;
  ls.del('boveda'); B = null; LLAVE = null; ir('v-nuevo');
}
/* Si la app queda en segundo plano más de 10 minutos, se cierra. */
let oculto = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) oculto = Date.now(); else if (B && oculto && Date.now() - oculto > 600000) cerrar();
});

/* ---------- Llamadas ---------- */
async function postA(url, body) {
  const r = await fetch(url, { method: 'POST', body: JSON.stringify(body) });
  return r.json();
}
async function registro(body) { if (!REG) return { ok: false, error: 'sin_registro' }; try { return await postA(REG, body); } catch (e) { return { ok: false, error: 'red' }; } }
function token(enlace) {
  const s = String(enlace || '').trim(), q = s.match(/[?&]u=([A-Za-z0-9_-]+)/);
  const t = q ? q[1] : s.split('?')[0].replace(/\/+$/, '').split('/').pop();
  return t.split('-').pop().toUpperCase();
}
async function mun(m, body) {
  const ll = B.llaves[m.url]; if (!ll) return { ok: false, error: 'sin_llave' };
  try { return await postA(m.url, Object.assign({ token: token(ll) }, body)); } catch (e) { return { ok: false, error: 'red' }; }
}

/* ---------- Inicio: números de todos ---------- */
async function inicio() {
  if (!B) return ir(ls.get('boveda') ? 'v-pin' : 'v-nuevo');
  ir('v-ini'); await cargar();
}
async function cargar() {
  $('ini-st').textContent = 'Cargando…';
  const r = await registro({ a: 'lista', clave: B.registro });
  const lista = r.ok ? r.municipios : [];
  /* Municipios con clave guardada aunque el registro no responda. */
  Object.keys(B.llaves).forEach(u => { if (!lista.some(x => x.url === u)) lista.push({ url: u, nombre: B.nombres && B.nombres[u] || u }); });
  MUNS = lista;
  $('ini-st').textContent = r.ok ? '' : (r.error === 'sin_registro' ? 'Falta la dirección del registro.' : 'El registro no respondió; se muestran los municipios con clave guardada.');
  pinta();
  await Promise.all(MUNS.map(async m => { RES[m.url] = B.llaves[m.url] ? await mun(m, { a: 'resumen', dias: B.dias }) : { ok: false, error: 'sin_llave' }; pinta(); }));
}
const SUMA = ['beneficiarios', 'entregas_mes', 'solicitudes_vencidas', 'eventos_vencidos', 'beneficiarios_revisar', 'entregas_alerta'];
const NOMBRE = { beneficiarios: 'Beneficiarios', entregas_mes: 'Entregas este mes', entregas: 'Entregas en total', solicitudes_abiertas: 'Solicitudes abiertas',
  solicitudes_vencidas: 'Solicitudes vencidas', eventos_vencidos: 'Eventos vencidos', beneficiarios_revisar: 'Personas por revisar',
  entregas_alerta: 'Entregas con alerta', provisionales: 'Sin CURP (provisionales)', usuarios: 'Usuarios activos' };
const TONO = { solicitudes_vencidas: 'er', eventos_vencidos: 'er', beneficiarios_revisar: 'wn', entregas_alerta: 'wn', provisionales: 'wn' };
const caja = (k, v) => '<div class="n ' + (v > 0 && TONO[k] ? TONO[k] : '') + '"><b>' + esc(v) + '</b><span>' + esc(NOMBRE[k]) + '</span></div>';
function pinta() {
  const t = {}; SUMA.forEach(k => t[k] = 0);
  MUNS.forEach(m => { const r = RES[m.url]; if (r && r.ok) SUMA.forEach(k => t[k] += Number(r[k] || 0)); });
  $('tot').innerHTML = '<div class="n"><b>' + MUNS.length + '</b><span>Municipios</span></div>' + SUMA.map(k => caja(k, t[k])).join('');
  $('muns').innerHTML = MUNS.map((m, i) => {
    const r = RES[m.url];
    let chips;
    if (!B.llaves[m.url]) chips = '<span class="chip wn">Falta su clave: toque para escribirla</span>';
    else if (!r) chips = '<span class="chip">Cargando…</span>';
    else if (!r.ok) chips = '<span class="chip er">' + esc(r.error === 'enlace' ? 'La clave ya no sirve' : r.error === 'accion' ? 'Servidor sin actualizar' : 'No respondió') + '</span>';
    else {
      const venc = r.solicitudes_vencidas + r.eventos_vencidos, aten = r.beneficiarios_revisar + r.entregas_alerta;
      chips = '<span class="chip">' + r.beneficiarios + ' beneficiarios</span><span class="chip">' + r.entregas_mes + ' entregas este mes</span>' +
        '<span class="chip ' + (venc ? 'er' : 'ok') + '">' + venc + ' vencido</span><span class="chip ' + (aten ? 'wn' : 'ok') + '">' + aten + ' requiere atención</span>';
    }
    return '<div class="c mun" onclick="abrirMun(' + i + ')"><h2>' + esc(m.nombre) + '</h2><div class="st">' + esc(m.corta || '') + '</div><div class="chips">' + chips + '</div></div>';
  }).join('') || '<div class="c st">Aún no hay municipios. Aparecen solos cuando se abre la app de cada uno.</div>';
}
async function actualizarTodos() {
  const con = MUNS.filter(m => B.llaves[m.url]);
  const rs = await Promise.all(con.map(m => mun(m, { a: 'actualizar' })));
  const ok = rs.filter(r => r.ok).length;
  msg(ok + ' de ' + con.length + ' municipios tomarán la versión maestra al abrirse.', ok === con.length ? 'o' : 'w');
}

/* ---------- Un municipio: administrar y ver como ---------- */
function abrirMun(i) {
  ACT = MUNS[i];
  if (!B.llaves[ACT.url]) { $('cl-t').textContent = 'Clave de ' + ACT.nombre; $('cl-v').value = ''; return ir('v-clave'); }
  ir('v-mun'); $('mu-t').textContent = ACT.nombre;
  const r = RES[ACT.url];
  $('mu-n').innerHTML = r && r.ok ? Object.keys(NOMBRE).map(k => caja(k, r[k])).join('') : '';
  vista('admin');
}
async function vista(rol, renovar) {
  ROL = rol;
  document.querySelectorAll('#v-mun [data-rol]').forEach(b => b.className = b.dataset.rol === rol ? 'on' : 's');
  $('mu-st').textContent = 'Abriendo…';
  let enlace;
  if (rol === 'admin') enlace = ACT.url + '?u=' + token(B.llaves[ACT.url]);
  else {
    B.vistas[ACT.url] = B.vistas[ACT.url] || {};
    const ya = B.vistas[ACT.url][rol];
    if (ya && !renovar) enlace = ya.enlace;
    else {
      const l = await mun(ACT, { a: 'login' });
      if (!l.ok) { $('mu-st').textContent = ''; return msg('No se pudo entrar al municipio.', 'e'); }
      const r = await mun(ACT, { a: 'crearUsuario', nombre: 'Centro (supervisión) ' + rol, rol, areas: (l.catalogos && l.catalogos.area) || [] });
      if (!r.ok) { $('mu-st').textContent = ''; return msg('No se pudo crear la vista.', 'e'); }
      if (ya) await mun(ACT, { a: 'bajaUsuario', id: ya.id, motivo: 'App de mando: enlace renovado' });
      B.vistas[ACT.url][rol] = { id: r.id, enlace: ACT.url + '?u=' + r.token };
      await guarda();
      enlace = B.vistas[ACT.url][rol].enlace;
    }
  }
  $('mu-st').textContent = rol === 'admin' ? 'Vista completa de administrador.' : 'Viendo como ' + rol + ', con todas las áreas.';
  $('fr').src = enlace;
}
function renovar() { if (ROL !== 'admin' && confirm('Se da de baja este enlace de vista y se crea otro. ¿Seguir?')) vista(ROL, true); }
async function guardaClave() {
  const v = $('cl-v').value.trim(); if (!v) return;
  const l = await postA(ACT.url, { token: token(v), a: 'login' }).catch(() => ({ ok: false, error: 'red' }));
  if (!l.ok) return msg(l.error === 'enlace' ? 'Esa clave no entra a este municipio.' : 'No respondió el municipio.', 'e');
  if (l.usuario.rol !== 'admin') return msg('Esa clave no es de administrador.', 'e');
  B.llaves[ACT.url] = v; B.nombres = B.nombres || {}; B.nombres[ACT.url] = ACT.nombre;
  await guarda(); $('cl-v').value = ''; msg('Guardada en este celular.'); inicio();
}

/* ---------- Ajustes ---------- */
function ajustes() {
  $('aj-d').value = B.dias;
  $('aj-cl').innerHTML = MUNS.map((m, i) => '<div>' + esc(m.nombre) + ': ' + (B.llaves[m.url] ? '<span class="ok">guardada</span> <button class="s" onclick="cambiaClave(' + i + ')">Cambiar</button>' : '<span class="wn">falta</span> <button onclick="cambiaClave(' + i + ')">Escribir</button>') + '</div>').join('');
  $('aj-v').textContent = 'Claves guardadas solo en este celular, cerradas con su PIN.';
}
function cambiaClave(i) { ACT = MUNS[i]; $('cl-t').textContent = 'Clave de ' + ACT.nombre; $('cl-v').value = ''; ir('v-clave'); }
async function guardaDias() { const d = Math.min(365, Math.max(1, Number($('aj-d').value) || 30)); B.dias = d; await guarda(); msg('Guardado.'); }

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
ir(ls.get('boveda') ? 'v-pin' : 'v-nuevo');
