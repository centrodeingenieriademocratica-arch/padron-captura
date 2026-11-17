/* Pruebas de la Consola del Centro con el simulador. Correr: node plataforma/pruebas/consola.test.js
   Dos municipios simulados (servidor real Codigo.gs) y la consola en otro contexto, como en Google. */
const assert = require('assert'), fs = require('fs'), vm = require('vm'), path = require('path'), crypto = require('crypto');
const { crear } = require('./simulador');

let n = 0, fallas = 0;
function prueba(nombre, f) {
  n++;
  try { f(); console.log('ok   ' + nombre); } catch (e) { fallas++; console.log('FALLA ' + nombre + '\n      ' + e.message); }
}

/* Dos municipios, cada uno con su hoja y su servidor. */
function municipio(nombre, exec) {
  const S = crear();
  const adm = S.instalar_(nombre, '');
  S.ponConfig_('URL_EXEC', exec);
  return { S, exec, llave: exec + '?u=' + adm.token, id: 'HOJA' + crypto.randomBytes(12).toString('hex') };
}
const A = municipio('Ayuntamiento de Atlixco', 'https://script.google.com/macros/s/AAA/exec');
const B = municipio('Ayuntamiento de Chiautzingo', 'https://script.google.com/macros/s/BBB/exec');
const libroDe = (S, nombre, id) => {
  const l = S.SpreadsheetApp.getActive();
  return Object.assign(l, { getSheets: () => Object.values(S.hojas), getName: () => nombre, getId: () => id, getUrl: () => 'https://docs/' + id });
};
const libros = { [A.id]: libroDe(A.S, 'Padrón Atlixco', A.id), [B.id]: libroDe(B.S, 'Padrón Chiautzingo', B.id) };
const porExec = { [A.exec]: A.S, [B.exec]: B.S };

/* La consola: su propia hoja privada, sesión de Google y llamadas a los servidores de los municipios. */
const propio = crear(), props = {};
const sesion = { dueno: 'centro@ejemplo.mx', activo: 'centro@ejemplo.mx' }, compartida = { editores: [], acceso: 'PRIVATE' };
let consolaLibro = null;
const ctx = {
  console,
  Session: { getEffectiveUser: () => ({ getEmail: () => sesion.dueno }), getActiveUser: () => ({ getEmail: () => sesion.activo }) },
  SpreadsheetApp: {
    create: () => (consolaLibro = libroDe(propio, 'Consola', 'CONSOLA')),
    openById: id => { if (id === 'CONSOLA' && consolaLibro) return consolaLibro; if (libros[id]) return libros[id]; throw new Error('sin permiso'); }
  },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; }, deleteProperty: k => { delete props[k]; } }) },
  DriveApp: { getFileById: () => ({ getEditors: () => compartida.editores, getViewers: () => [], getSharingAccess: () => compartida.acceso }) },
  UrlFetchApp: { fetch: (url, o) => {
    const S = porExec[url];
    const body = S ? S.doPost({ postData: { contents: o.payload } }).contenido : '<html>no</html>';
    return { getContentText: () => body, getResponseCode: () => S ? 200 : 404 };
  } },
  Utilities: Object.assign({}, propio.Utilities, { formatDate: d => d.toISOString().slice(0, 16).replace('T', ' ') }),
  HtmlService: { createHtmlOutput: s => ({ contenido: s }), createHtmlOutputFromFile: f => { const o = { archivo: f, setTitle() { return o; }, addMetaTag() { return o; } }; return o; } },
  Logger: { log() {} }
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'consola', 'Consola.gs'), 'utf8'), ctx);
const C = (a, d) => ctx.consola(a, d);

prueba('otra cuenta no entra (pantalla ni acciones)', () => {
  sesion.activo = 'otra@ejemplo.mx';
  assert.ok(/Sin acceso/.test(ctx.doGet().contenido));
  assert.strictEqual(C('inicio').error, 'sin_acceso');
  sesion.activo = ''; assert.strictEqual(C('inicio').error, 'sin_acceso');
  sesion.activo = sesion.dueno;
  assert.strictEqual(ctx.doGet().archivo, 'Consola');
});
prueba('inicio sin municipios y sin avisos de seguridad', () => {
  const r = C('inicio'); assert.ok(r.ok, JSON.stringify(r));
  assert.strictEqual(JSON.stringify([r.municipios, r.avisos]), '[[],[]]');
});
prueba('avisa si la hoja de la consola está compartida', () => {
  compartida.editores = ['x']; compartida.acceso = 'ANYONE_WITH_LINK';
  assert.strictEqual(C('inicio').avisos.length, 2);
  compartida.editores = []; compartida.acceso = 'PRIVATE';
});
prueba('alta rechaza hoja sin permiso y llave que no sirve', () => {
  assert.ok(/no puede abrir/.test(C('agregar', { hoja_id: 'X'.repeat(30), llave: A.llave }).error));
  assert.ok(/administrador activo/.test(C('agregar', { hoja_id: A.id, llave: A.exec + '?u=ZZZZZZZZZZZZZZZZZZZZ' }).error));
  assert.strictEqual(C('inicio').municipios.length, 0);
});
let MA, MB;
prueba('alta de dos municipios con su llave; la llave nunca sale', () => {
  const r = C('agregar', { hoja_id: 'https://docs.google.com/spreadsheets/d/' + A.id + '/edit#gid=0', llave: A.llave });
  assert.ok(r.ok && r.probado, JSON.stringify(r)); assert.strictEqual(r.nombre, 'Ayuntamiento de Atlixco');
  /* Llave con dirección corta: la dirección /exec se toma de Config del municipio. */
  const tB = B.llave.split('u=')[1];
  const r2 = C('agregar', { hoja_id: B.id, llave: 'https://cid-benefi-chiautzingo.web.app/administrador-' + tB.toLowerCase() });
  assert.ok(r2.ok && r2.probado, JSON.stringify(r2));
  const i = C('inicio'); assert.strictEqual(i.municipios.length, 2);
  assert.ok(i.municipios.every(m => m.con_llave));
  assert.ok(JSON.stringify(i).indexOf(tB) < 0 && JSON.stringify(i).indexOf(A.llave.split('u=')[1]) < 0);
  assert.ok(!JSON.stringify(propio.hojas).includes(tB), 'la llave no debe quedar en la hoja');
  [MA, MB] = i.municipios.map(m => m.id);
  /* Volver a darlo de alta lo actualiza, no lo duplica. */
  assert.ok(C('agregar', { hoja_id: A.id, llave: '' }).ok);
  assert.strictEqual(C('inicio').municipios.length, 2);
});
prueba('ver todo: pestañas y filas de cualquier hoja, sin huellas de enlaces', () => {
  const p = C('pestanas', { id: MA }); assert.ok(p.pestanas.some(x => x.nombre === 'Beneficiarios'));
  const u = C('leer', { id: MA, pestana: 'Usuarios' });
  assert.ok(u.ok && u.total >= 1); const th = u.encabezados.indexOf('token_hash');
  assert.ok(u.filas.every(f => f.v[th] === '•••'));
});
prueba('hacer todo: la app del municipio como administrador (alta de programa y beneficiario)', () => {
  const op = (tipo, datos) => ({ op_id: 'OP-' + crypto.randomBytes(4).toString('hex').toUpperCase(), tipo, datos });
  const r = C('app', { id: MA, datos: { a: 'sync', ops: [op('programa', { id: 'P-DESP01', nombre: 'Despensa', area: 'DIF' }),
    op('beneficiario', { id: 'B-TEL0000001', nombre: 'María López Pérez', localidad: 'Centro' })] } });
  assert.ok(r.ok && r.resultados.every(x => x.ok), JSON.stringify(r));
  const b = C('leer', { id: MA, pestana: 'Beneficiarios', buscar: 'maría' }); assert.strictEqual(b.total, 1);
});
prueba('editar celda con motivo; queda en las dos bitácoras y el nombre se normaliza', () => {
  const b = C('leer', { id: MA, pestana: 'Beneficiarios', buscar: 'B-TEL0000001' }), col = b.encabezados.indexOf('nombre') + 1;
  assert.ok(/motivo/.test(C('editar', { id: MA, pestana: 'Beneficiarios', fila: b.filas[0].n, columna: col, valor: 'X' }).error));
  const r = C('editar', { id: MA, pestana: 'Beneficiarios', fila: b.filas[0].n, columna: col, valor: 'María López Peña', motivo: 'Corrección de acta' });
  assert.ok(r.ok, JSON.stringify(r));
  const d = C('leer', { id: MA, pestana: 'Beneficiarios', buscar: 'B-TEL0000001' });
  assert.strictEqual(d.filas[0].v[col - 1], 'María López Peña');
  assert.strictEqual(d.filas[0].v[d.encabezados.indexOf('nombre_norm')], 'maria lopez pena');
  const bm = C('leer', { id: MA, pestana: 'Bitacora', buscar: 'cambio_centro' }); assert.strictEqual(bm.total, 1);
  assert.ok(C('bitacora', {}).filas.some(f => f.accion === 'edita'));
  assert.ok(/no se edita/.test(C('editar', { id: MA, pestana: 'Usuarios', fila: 2, columna: 5, valor: 'x', motivo: 'y' }).error));
  assert.strictEqual(C('editar', { id: MA, pestana: 'Beneficiarios', fila: 1, columna: 1, valor: 'x', motivo: 'y' }).error, 'datos');
});
prueba('un texto que parece fórmula se guarda como texto', () => {
  const b = C('leer', { id: MA, pestana: 'Beneficiarios', buscar: 'B-TEL0000001' }), col = b.encabezados.indexOf('colonia') + 1;
  C('editar', { id: MA, pestana: 'Beneficiarios', fila: b.filas[0].n, columna: col, valor: '=HYPERLINK("x")', motivo: 'prueba' });
  assert.strictEqual(C('leer', { id: MA, pestana: 'Beneficiarios', buscar: 'B-TEL0000001' }).filas[0].v[col - 1], '=HYPERLINK("x")');
});
prueba('buscar en todos los municipios por nombre', () => {
  const op = { op_id: 'OP-BBB00001', tipo: 'beneficiario', datos: { id: 'B-TEL0000002', nombre: 'Mario López Ruiz' } };
  assert.ok(C('app', { id: MB, datos: { a: 'sync', ops: [op] } }).ok);
  const r = C('buscarTodo', { q: 'López' });
  assert.ok(r.ok); assert.strictEqual(r.resultados.map(x => x.municipio).sort().join('|'), 'Ayuntamiento de Atlixco|Ayuntamiento de Chiautzingo');
});
prueba('usuarios: crear con enlace, listar y dar de baja', () => {
  const r = C('crearUsuario', { id: MB, nombre: 'Ana Ruiz', rol: 'capturista', areas: ['DIF'] });
  assert.ok(r.ok && /BBB\/exec\?u=/.test(r.enlace), JSON.stringify(r));
  assert.ok(C('usuarios', { id: MB }).usuarios.some(u => u.nombre === 'Ana Ruiz' && u.activo));
  assert.ok(C('bajaUsuario', { id: MB, usuario: r.id, motivo: 'ya no trabaja' }).ok);
  assert.ok(!C('usuarios', { id: MB }).usuarios.find(u => u.id === r.id).activo);
});
prueba('ver como cualquier rol: enlace que entra con ese rol y todas las áreas; se reutiliza y se renueva', () => {
  const ad = C('verComo', { id: MA, rol: 'admin' }); assert.strictEqual(ad.enlace, A.llave);
  const c1 = C('verComo', { id: MA, rol: 'capturista' }), c2 = C('verComo', { id: MA, rol: 'capturista' });
  assert.ok(c1.ok && c1.enlace === c2.enlace);
  const l = A.S.post({ token: c1.enlace.split('u=')[1], a: 'login' });
  assert.strictEqual(l.usuario.rol, 'capturista'); assert.ok(l.usuario.areas.length >= 19);
  const c3 = C('verComo', { id: MA, rol: 'capturista', renovar: true });
  assert.notStrictEqual(c3.enlace, c1.enlace);
  assert.strictEqual(A.S.post({ token: c1.enlace.split('u=')[1], a: 'login' }).error, 'enlace');
  ['responsable', 'consulta'].forEach(rol => assert.strictEqual(A.S.post({ token: C('verComo', { id: MA, rol }).enlace.split('u=')[1], a: 'login' }).usuario.rol, rol));
});
prueba('quitar un municipio de la consola no toca sus datos', () => {
  assert.ok(C('quitar', { id: MB }).ok);
  assert.strictEqual(C('inicio').municipios.length, 1);
  assert.ok(B.S.hojas.Beneficiarios.getLastRow() >= 2);
});
prueba('acción desconocida y municipio inexistente no rompen', () => {
  assert.strictEqual(C('borrarTodo').error, 'accion');
  assert.strictEqual(C('leer', { id: 'NO' }).error, 'municipio');
});

console.log('\n' + (n - fallas) + ' de ' + n + ' pruebas pasaron.');
process.exit(fallas ? 1 : 0);
