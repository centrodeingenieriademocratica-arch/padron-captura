/* Pruebas del servidor con el simulador. Correr: node plataforma/pruebas/servidor.test.js */
const assert = require('assert');
const { crear } = require('./simulador');

let n = 0, fallas = 0;
function prueba(nombre, f) {
  n++;
  try { f(); console.log('ok   ' + nombre); } catch (e) { fallas++; console.log('FALLA ' + nombre + '\n      ' + e.message); }
}
const op = (tipo, datos, id) => ({ op_id: id || ('OP-' + Math.random().toString(36).slice(2, 10).toUpperCase()), tipo, datos });

const S = crear();
const adm = S.instalar_('Ayuntamiento de Prueba', 'https://padron-prueba.web.app').token;
const nuevo = (rol, areas) => S.post({ token: adm, a: 'crearUsuario', nombre: rol + ' ' + areas, rol, areas }).token;
const dif = nuevo('capturista', ['DIF']);
const respDif = nuevo('responsable', ['DIF']);
const obras = nuevo('capturista', ['Obras Públicas']);

prueba('instalación crea las pestañas y los catálogos', () => {
  ['Usuarios', 'Beneficiarios', 'Entregas', 'Bitacora', 'Catalogos'].forEach(h => assert.ok(S.hojas[h], 'falta ' + h));
  const r = S.post({ token: adm, a: 'login' });
  assert.ok(r.ok);
  assert.ok(r.catalogos.grupo.length >= 40);
  assert.strictEqual(r.municipio, 'Ayuntamiento de Prueba');
});
prueba('enlace inválido no entra', () => assert.strictEqual(S.post({ token: 'XXXX', a: 'login' }).error, 'enlace'));
prueba('el enlace del administrador usa la dirección de la app', () => {
  const r = S.post({ token: adm, a: 'crearUsuario', nombre: 'Ana', rol: 'consulta', areas: ['DIF'] });
  assert.ok(r.enlace.startsWith('https://padron-prueba.web.app/?u='));
});

prueba('capturista no puede dar de alta programas', () => {
  const r = S.post({ token: dif, a: 'sync', ops: [op('programa', { id: 'P-DESP01', nombre: 'Despensa', area: 'DIF' })] });
  assert.strictEqual(r.resultados[0].error, 'permiso');
});
prueba('responsable da de alta programa de su área, no de otra', () => {
  const r = S.post({ token: respDif, a: 'sync', ops: [
    op('programa', { id: 'P-DESP01', nombre: 'Despensa bimestral', area: 'DIF', unidad: 'paquetes', monto_unitario: 350,
      periodicidad: 'bimestral', evidencia: ['foto', 'firma'] }),
    op('programa', { id: 'P-OBRA01', nombre: 'Pavimentación', area: 'Obras Públicas' })] });
  assert.ok(r.resultados[0].ok);
  assert.strictEqual(r.resultados[1].error, 'permiso');
});
S.post({ token: adm, a: 'sync', ops: [op('programa', { id: 'P-OBRA01', nombre: 'Pavimentación', area: 'Obras Públicas', tipo_beneficiario: 'territorio', unidad: 'metros cuadrados', periodicidad: 'por_avance' })] });
S.post({ token: adm, a: 'sync', ops: [op('programa', { id: 'P-VIOL01', nombre: 'Asesoría jurídica', area: 'Instituto de la Mujer', confidencial: true, periodicidad: 'por_demanda' })] });

prueba('login trae solo los programas del área del usuario', () => {
  const r = S.post({ token: dif, a: 'login' });
  assert.deepStrictEqual(r.programas.map(p => p.id), ['P-DESP01']);
  assert.strictEqual(r.programas[0].periodicidad, 'bimestral');
});

const CURP = 'GOMA800101MPLRRN09';
let resA;
prueba('alta de persona con CURP y entrega en el mismo envío (sin señal, después sincroniza)', () => {
  const r = S.post({ token: dif, a: 'sync', ops: [
    op('beneficiario', { id: 'T-AAAA1111', tipo: 'persona', curp: CURP, nombre: 'Ana Gómez Martínez', nacimiento: '1980-01-01',
      sexo: 'Mujer', localidad: 'Centro', lat: 19.04, lng: -98.2, precision_m: 12, grupos: ['Mujer jefa de familia'] }),
    op('entrega', { id: 'E-AAAA0001', beneficiario_id: 'T-AAAA1111', programa_id: 'P-DESP01', fecha: '2026-11-10',
      evidencia: [{ tipo: 'foto', ref: 'papel-001' }, { tipo: 'firma', ref: 'papel-001' }] })] });
  resA = r;
  assert.ok(r.resultados[0].ok);
  assert.strictEqual(r.resultados[0].estado, 'Completo');
  assert.ok(r.resultados[1].ok, JSON.stringify(r.resultados[1]));
  assert.strictEqual(r.resultados[1].estado, 'Valida');
  const e = S.hojas.Entregas.datos[1];
  assert.strictEqual(e[10], 350); /* monto = monto unitario × 1 */
  assert.strictEqual(e[7], '2026-B6'); /* periodo bimestral */
});
prueba('reenviar la misma operación no duplica', () => {
  const antes = S.hojas.Beneficiarios.datos.length;
  const ops = [op('beneficiario', { id: 'T-REPE0001', nombre: 'Luis Pérez', nacimiento: '1990-05-05', sexo: 'Hombre' }, 'OP-REPETIDA1')];
  S.post({ token: dif, a: 'sync', ops });
  const r = S.post({ token: dif, a: 'sync', ops });
  assert.ok(r.resultados[0].repetida);
  assert.strictEqual(S.hojas.Beneficiarios.datos.length, antes + 1);
});
prueba('mismo CURP desde otro teléfono: no duplica, queda alias y la entrega se liga a la persona correcta', () => {
  const antes = S.hojas.Beneficiarios.datos.length;
  const r = S.post({ token: dif, a: 'sync', ops: [
    op('beneficiario', { id: 'T-BBBB2222', curp: CURP, nombre: 'ANA GOMEZ', nacimiento: '1980-01-01', sexo: 'Mujer' }),
    op('entrega', { id: 'E-BBBB0001', beneficiario_id: 'T-BBBB2222', programa_id: 'P-DESP01', fecha: '2026-11-11',
      evidencia: [{ tipo: 'foto', ref: 'x' }, { tipo: 'firma', ref: 'x' }] })] });
  assert.strictEqual(r.resultados[0].id, 'T-AAAA1111');
  assert.strictEqual(r.resultados[0].aviso, 'ya_registrado');
  assert.strictEqual(S.hojas.Beneficiarios.datos.length, antes);
  assert.strictEqual(S.hojas.Entregas.datos[2][1], 'T-AAAA1111');
});
prueba('segunda despensa en el mismo bimestre: se guarda, pero en Revisar con alerta', () => {
  const r = resA && S.post({ token: dif, a: 'sync', ops: [] });
  const fila = S.hojas.Entregas.datos[2];
  assert.strictEqual(fila[18], 'Revisar');
  assert.ok(String(fila[19]).includes('repetida_en_periodo'));
});
prueba('falta de evidencia avisa pero no manda a Revisar', () => {
  const r = S.post({ token: dif, a: 'sync', ops: [
    op('beneficiario', { id: 'T-CCCC3333', nombre: 'Rosa Luna', nacimiento: '1950-03-03', sexo: 'Mujer' }),
    op('entrega', { id: 'E-CCCC0001', beneficiario_id: 'T-CCCC3333', programa_id: 'P-DESP01', fecha: '2026-11-10' })] });
  assert.strictEqual(r.resultados[0].estado, 'Provisional'); /* sin CURP */
  assert.ok(r.resultados[0].avisos.includes('ubicacion_pendiente'));
  assert.strictEqual(r.resultados[1].estado, 'Valida');
  assert.ok(r.resultados[1].alertas.some(a => a.startsWith('falta_evidencia')));
});
prueba('homónimo sin CURP: se guarda en Revisar, nunca se une solo', () => {
  const r = S.post({ token: dif, a: 'sync', ops: [op('beneficiario', { id: 'T-DDDD4444', nombre: 'Rosa  Luna', nacimiento: '1950-03-03', sexo: 'Mujer' })] });
  assert.strictEqual(r.resultados[0].estado, 'Revisar');
  assert.ok(r.resultados[0].avisos.includes('posible_duplicado'));
  assert.ok(r.resultados[0].ok);
});
prueba('menor sin tutor avisa', () => {
  const r = S.post({ token: dif, a: 'sync', ops: [op('beneficiario', { id: 'T-EEEE5555', nombre: 'Niño Prueba', nacimiento: '2018-02-02', sexo: 'Hombre' })] });
  assert.ok(r.resultados[0].avisos.includes('menor_sin_tutor'));
});
prueba('capturista no entrega apoyos de otra área', () => {
  const r = S.post({ token: obras, a: 'sync', ops: [op('entrega', { id: 'E-FFFF0001', beneficiario_id: 'T-AAAA1111', programa_id: 'P-DESP01' })] });
  assert.strictEqual(r.resultados[0].error, 'permiso');
});
prueba('beneficiario territorial (obra) con entrega por avance', () => {
  const r = S.post({ token: obras, a: 'sync', ops: [
    op('beneficiario', { id: 'T-TERR0001', tipo: 'territorio', nombre: 'Calle Reforma, Colonia Centro', localidad: 'Centro' }),
    op('entrega', { id: 'E-TERR0001', beneficiario_id: 'T-TERR0001', programa_id: 'P-OBRA01', cantidad: 350, monto: 420000 }),
    op('entrega', { id: 'E-TERR0002', beneficiario_id: 'T-TERR0001', programa_id: 'P-OBRA01', cantidad: 200, monto: 250000 })] });
  assert.ok(r.resultados.every(x => x.ok), JSON.stringify(r.resultados));
  assert.strictEqual(r.resultados[2].estado, 'Valida'); /* por avance no avisa repetición */
});
prueba('buscar por nombre devuelve solo nombre y localidad', () => {
  const r = S.post({ token: dif, a: 'buscar', q: 'ana gomez' });
  assert.strictEqual(r.resultados.length, 1);
  assert.deepStrictEqual(Object.keys(r.resultados[0]).sort(), ['estado', 'id', 'localidad', 'nombre', 'tipo']);
  assert.strictEqual(S.post({ token: dif, a: 'buscar', q: CURP }).resultados[0].id, 'T-AAAA1111');
  assert.strictEqual(S.post({ token: dif, a: 'buscar', q: 'an' }).error, 'corto');
});
prueba('caso confidencial: otra área no lo encuentra', () => {
  const mujer = nuevo('capturista', ['Instituto de la Mujer']);
  S.post({ token: mujer, a: 'sync', ops: [
    op('beneficiario', { id: 'T-CONF0001', nombre: 'Persona Reservada', nacimiento: '1985-01-01', sexo: 'Mujer', area: 'Instituto de la Mujer', confidencial: true }),
    op('entrega', { id: 'E-CONF0001', beneficiario_id: 'T-CONF0001', programa_id: 'P-VIOL01' })] });
  assert.strictEqual(S.post({ token: dif, a: 'buscar', q: 'persona reservada' }).resultados.length, 0);
  assert.strictEqual(S.post({ token: mujer, a: 'buscar', q: 'persona reservada' }).resultados.length, 1);
});
prueba('evento y lote: sobrepasar el lote manda a Revisar', () => {
  const r = S.post({ token: respDif, a: 'sync', ops: [
    op('evento', { id: 'EV-DIC0001', nombre: 'Entrega de cobijas', programa_id: 'P-DESP01', fecha: '2027-01-15', lugar: 'Explanada' }),
    op('lote', { id: 'L-COB0001', programa_id: 'P-DESP01', cantidad: 1, proveedor: 'Proveedor X', factura: 'F-1' }),
    op('entrega', { id: 'E-EV000001', beneficiario_id: 'T-CCCC3333', programa_id: 'P-DESP01', evento_id: 'EV-DIC0001', lote_id: 'L-COB0001', evidencia: [{ tipo: 'foto', ref: 'a' }, { tipo: 'firma', ref: 'a' }] }),
    op('entrega', { id: 'E-EV000002', beneficiario_id: 'T-AAAA1111', programa_id: 'P-DESP01', evento_id: 'EV-DIC0001', lote_id: 'L-COB0001', evidencia: [{ tipo: 'foto', ref: 'b' }, { tipo: 'firma', ref: 'b' }] })] });
  assert.ok(r.resultados.every(x => x.ok), JSON.stringify(r.resultados));
  assert.strictEqual(r.resultados[2].estado, 'Valida');
  assert.ok(r.resultados[3].alertas.includes('lote_agotado'));
  assert.strictEqual(S.hojas.Entregas.datos.find(f => f[0] === 'E-EV000001')[6], '2027-01-15'); /* fecha del evento */
});
prueba('lista del programa periódico trae a quienes ya lo recibieron', () => {
  const r = S.post({ token: dif, a: 'lista', programa_id: 'P-DESP01' });
  assert.deepStrictEqual(r.beneficiarios.map(b => b.nombre), ['Ana Gómez Martínez', 'Rosa Luna']);
});
prueba('solicitud y cambio de estatus con bitácora', () => {
  S.post({ token: dif, a: 'sync', ops: [op('solicitud', { id: 'S-0000001', beneficiario_id: 'T-CCCC3333', programa_id: 'P-DESP01', descripcion: 'Pide silla de ruedas' })] });
  const r = S.post({ token: respDif, a: 'sync', ops: [op('editar', { hoja: 'Solicitudes', id: 'S-0000001', cambios: { estatus: 'Aprobada' }, motivo: 'Estudio socioeconómico favorable' })] });
  assert.deepStrictEqual(r.resultados[0].cambiados, ['estatus']);
  const b = S.hojas.Bitacora.datos.find(f => f[2] === 'cambio' && f[4] === 'S-0000001');
  assert.strictEqual(b[6], 'Recibida');
  assert.strictEqual(b[7], 'Aprobada');
});
prueba('editar sin motivo no se acepta; capturista no edita', () => {
  assert.strictEqual(S.post({ token: respDif, a: 'sync', ops: [op('editar', { hoja: 'Beneficiarios', id: 'T-CCCC3333', cambios: { telefono: '1' } })] }).resultados[0].error, 'datos');
  assert.strictEqual(S.post({ token: dif, a: 'sync', ops: [op('editar', { hoja: 'Beneficiarios', id: 'T-CCCC3333', cambios: { telefono: '1' }, motivo: 'x' })] }).resultados[0].error, 'permiso');
});
prueba('capturista pide corrección y queda en bitácora', () => {
  const r = S.post({ token: dif, a: 'sync', ops: [op('correccion', { registro: 'T-BBBB2222', texto: 'El teléfono correcto es 2221234567' })] });
  assert.ok(r.resultados[0].ok);
  assert.ok(S.hojas.Bitacora.datos.some(f => f[2] === 'pide_correccion' && f[4] === 'T-AAAA1111'));
});
prueba('baja de usuario: su enlace deja de servir', () => {
  const t = nuevo('capturista', ['DIF']);
  const id = S.post({ token: t, a: 'login' }).usuario.id;
  assert.ok(S.post({ token: adm, a: 'bajaUsuario', id, motivo: 'Dejó el cargo' }).ok);
  assert.strictEqual(S.post({ token: t, a: 'login' }).error, 'enlace');
});

console.log('\n' + (n - fallas) + ' de ' + n + ' pruebas pasaron.');
process.exit(fallas ? 1 : 0);
