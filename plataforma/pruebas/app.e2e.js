/* Prueba de punta a punta de la app con el servidor simulado y un navegador sin pantalla.
   Correr: node plataforma/pruebas/app.e2e.js */
const assert = require('assert');
const { chromium } = require('playwright');
const { arrancar } = require('./servidor-local');

(async () => {
  const { srv, S, base, admin } = await arrancar(8091);
  const nav = await chromium.launch();
  const ctx = await nav.newContext({ permissions: ['geolocation'], geolocation: { latitude: 19.0414, longitude: -98.2063, accuracy: 12 } });
  const pg = await ctx.newPage(); pg.setDefaultTimeout(6000);
  const errores = [];
  pg.on('pageerror', e => errores.push(e.message));
  pg.on('dialog', d => d.accept('Dejó el cargo'));
  const hoja = n => S.hojas[n].datos;
  const filas = n => hoja(n).length - 1;
  const col = (n, c) => hoja(n)[0].indexOf(c);
  let n = 0, fallas = 0;
  const paso = async (nombre, f) => { n++; try { await f(); console.log('ok   ' + nombre); } catch (e) { fallas++; console.log('FALLA ' + nombre + '\n      ' + e.message.split('\n')[0] + ' ' + ((e.stack.match(/app.e2e.js:(\d+)/) || [])[1] || '')); if (process.env.VER) console.log(errores); } };
  const hasta = async (f, ms = 6000) => { const t0 = Date.now(); while (!f()) { if (Date.now() - t0 > ms) throw new Error('no ocurrió a tiempo: ' + f); await new Promise(r => setTimeout(r, 100)); } };
  const espera = (f, ms = 5000) => pg.waitForFunction(f, null, { timeout: ms });

  await paso('el administrador entra con su enlace y el enlace se quita de la barra', async () => {
    await pg.goto(base + '/?u=' + admin);
    await espera(() => document.getElementById('hola').textContent.startsWith('Hola'));
    assert.ok(!pg.url().includes('u='));
    assert.strictEqual(await pg.textContent('#tit'), 'Ayuntamiento de Prueba');
    assert.ok(await pg.isVisible('#b-adm'));
  });

  await paso('da de alta un programa y llega al servidor', async () => {
    await pg.click('#b-adm');
    await pg.fill('#pa-n', 'Despensa bimestral');
    await pg.selectOption('#pa-a', 'DIF');
    await pg.selectOption('#pa-u', 'paquetes');
    await pg.fill('#pa-m', '350');
    await pg.selectOption('#pa-p', 'bimestral');
    await pg.click('text=Guardar programa');
    await hasta(() => filas('Programas') === 1);
  });

  await paso('crea un evento y un lote del programa', async () => {
    await pg.fill('#ev-n', 'Despensas en el Centro');
    await pg.selectOption('#ev-p', { index: 1 });
    await pg.fill('#ev-l', 'Explanada');
    await pg.click('text=Guardar evento');
    await pg.selectOption('#lo-p', { index: 1 });
    await pg.fill('#lo-c', '2');
    await pg.click('text=Guardar lote');
    await hasta(() => filas('Eventos') === 1 && filas('Lotes') === 1);
  });

  let enlaceCap = '';
  await paso('crea el enlace de un capturista del DIF', async () => {
    await pg.fill('#us-n', 'Rosa Capturista');
    await pg.selectOption('#us-r', 'capturista');
    await pg.check('#us-a input[value="DIF"]');
    await pg.click('text=Crear enlace');
    await pg.waitForSelector('#us-out a');
    enlaceCap = await pg.getAttribute('#us-out a', 'href');
    assert.ok(enlaceCap.startsWith(base + '/?u='));
  });

  /* A partir de aquí trabaja el capturista en otro teléfono. */
  const ctx2 = await nav.newContext({ permissions: ['geolocation'], geolocation: { latitude: 19.0414, longitude: -98.2063, accuracy: 80 } });
  const t = await ctx2.newPage(); t.setDefaultTimeout(6000);
  t.on('pageerror', e => errores.push(e.message));
  t.on('dialog', d => d.accept());
  const espera2 = (f, ms = 5000) => t.waitForFunction(f, null, { timeout: ms });

  await paso('el capturista entra y no ve administración', async () => {
    await t.goto(enlaceCap);
    await espera2(() => document.getElementById('hola').textContent.startsWith('Hola'));
    assert.ok(!(await t.isVisible('#b-adm')));
  });

  await paso('sin señal: registra a una persona con CURP y su entrega con firma', async () => {
    await ctx2.setOffline(true);
    await t.click('text=Buscar persona y registrar apoyo');
    await t.fill('#q', 'GOMA800101MPLRRN09');
    await t.click('#v-bus button:text-is("Buscar")');
    await t.waitForSelector('#res .st');
    await t.click('text=No está: registrar persona nueva');
    assert.strictEqual(await t.inputValue('#curp'), 'GOMA800101MPLRRN09');
    assert.strictEqual(await t.inputValue('#nac'), '1980-01-01');
    await t.fill('#nom', 'Ana Gómez Martínez');
    await t.fill('#loc', 'Centro');
    await t.click('text=Estoy aquí: tomar ubicación');
    await t.waitForSelector('#gps-alta .wn');
    await t.check('#gr input[value="Mujer jefa de familia"]').catch(() => t.check('#gr input >> nth=0'));
    await t.check('#av');
    await t.click('text=Guardar y registrar apoyo');
    await t.waitForSelector('#v-ent:not([hidden])');
    await t.click('#e1 >> text=Siguiente');
    assert.ok(await t.inputValue('#prog'), 'el único programa del área debe quedar elegido');
    await t.click('#e2 >> text=Siguiente');
    const b = await t.locator('#firma').boundingBox();
    await t.mouse.move(b.x + 20, b.y + 20); await t.mouse.down(); await t.mouse.move(b.x + 120, b.y + 60, { steps: 5 }); await t.mouse.up();
    await t.click('#b-ent');
    await t.waitForSelector('#v-ini:not([hidden])');
    assert.match(await t.textContent('#est'), /Sin señal · 2 por enviar/);
    assert.strictEqual(filas('Beneficiarios'), 0);
  });

  await paso('otra alta sin señal: menor de edad con tutor, solo guardar', async () => {
    await t.click('text=Buscar persona y registrar apoyo');
    await t.fill('#q', 'Luis Pérez');
    await t.click('text=No está: registrar persona nueva');
    await t.fill('#nac', '2018-05-03'); await t.dispatchEvent('#nac', 'change');
    assert.ok(await t.isVisible('#tut'));
    await t.fill('#tut', 'María Pérez Luna');
    await t.fill('#loc', 'San Juan');
    await t.check('#av');
    await t.click('text=Solo guardar a la persona');
    await t.waitForSelector('#v-ini:not([hidden])');
    assert.match(await t.textContent('#est'), /4 por enviar/);
  });

  await paso('al volver la señal se envía todo y llega completo', async () => {
    await ctx2.setOffline(false);
    await espera2(() => document.getElementById('est').textContent === 'Todo enviado', 8000);
    assert.strictEqual(filas('Beneficiarios'), 3);
    assert.strictEqual(filas('Entregas'), 1);
    const e = hoja('Entregas')[1];
    assert.strictEqual(e[col('Entregas', 'monto')], 350);
    const ana = hoja('Beneficiarios').find(f => f[col('Beneficiarios', 'curp')] === 'GOMA800101MPLRRN09');
    assert.ok(ana, 'Ana con su CURP');
    assert.strictEqual(String(ana[col('Beneficiarios', 'precision_m')]), '80');
    const luis = hoja('Beneficiarios').find(f => f[col('Beneficiarios', 'nombre')] === 'Luis Pérez');
    assert.ok(luis[col('Beneficiarios', 'tutor_id')], 'el menor queda ligado a su tutor');
  });

  await paso('buscar en línea encuentra a la persona y solo muestra nombre y localidad', async () => {
    await t.click('text=Buscar persona y registrar apoyo');
    await t.fill('#q', 'Ana Gómez');
    await t.click('#v-bus button:text-is("Buscar")');
    await t.waitForSelector('#res .it');
    assert.match(await t.textContent('#res'), /Ana Gómez Martínez/);
    assert.ok(!(await t.textContent('#res')).includes('GOMA800101'));
  });

  await paso('entrega repetida en el mismo periodo se guarda con aviso', async () => {
    await t.click('#res .it button');
    await t.click('#e1 >> text=Siguiente');
    await t.click('#e2 >> text=Siguiente');
    await t.click('text=No sabe firmar');
    await t.fill('#papel', 'Lista 12, renglón 4');
    await t.click('#b-ent');
    await hasta(() => filas('Entregas') === 2);
    await t.click('text=Mis pendientes');
    await t.waitForSelector('#hechos .wn');
    assert.match(await t.textContent('#hechos'), /repetida/);
    await t.click('#v-pen >> text=Volver');
  });

  await paso('entrega en evento: el apoyo queda fijo y se liga al evento', async () => {
    await t.click('text=Entrega en evento o fila');
    await t.click('#evl button');
    assert.ok(await t.isVisible('#bev'));
    await t.fill('#q', 'Luis Pérez');
    await t.click('#v-bus button:text-is("Buscar")');
    await t.waitForSelector('#res .it');
    await t.click('#res .it button');
    assert.ok(await t.isDisabled('#prog'));
    await t.click('#e1 >> text=Siguiente');
    await t.click('#e2 >> text=Siguiente');
    await t.click('text=No sabe firmar');
    await t.click('#b-ent');
    await t.waitForSelector('#v-bus:not([hidden])');
    await hasta(() => filas('Entregas') === 3);
    const ult = hoja('Entregas')[3];
    assert.ok(ult[col('Entregas', 'evento_id')], 'liga al evento');
  });

  await paso('la tercera entrega rebasa el lote de 2 y se guarda con alerta', async () => {
    const al = hoja('Entregas').slice(1).map(f => f[col('Entregas', 'alerta')]).join(' ');
    assert.match(al, /lote/);
  });

  await paso('el administrador da de baja al capturista y su enlace deja de servir', async () => {
    await pg.click('text=Ver usuarios');
    await pg.waitForSelector('#us-l .x');
    await pg.click('#us-l .x');
    await pg.waitForFunction(() => !document.querySelector('#us-l .x'));
    await t.reload();
    await espera2(() => !document.getElementById('v-sin').hidden);
    assert.match(await t.textContent('#v-sin'), /ya no es válido/);
  });

  await paso('sin errores de JavaScript en la página', async () => assert.deepStrictEqual(errores, []));

  console.log('\n' + (n - fallas) + ' de ' + n + ' pruebas de la app pasaron.');
  await nav.close(); srv.close();
  process.exit(fallas ? 1 : 0);
})();
