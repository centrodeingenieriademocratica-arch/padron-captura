/* Pruebas del registro de municipios (función de Cloudflare Pages, plataforma/cloudflare/functions/api/registro.js).
   Correr: node plataforma/pruebas/registro-cloudflare.test.js */
const assert = require('assert');
const { kv, registro } = require('./kv-simulado');
const EXEC = 'https://script.google.com/macros/s/' + 'A'.repeat(30) + '/exec', FALSA = 'https://script.google.com/macros/s/' + 'B'.repeat(30) + '/exec';
const fetchSim = async url => ({ json: async () => url.indexOf(EXEC) === 0 ? { ok: true, servicio: 'padron-municipal' } : JSON.parse('<html>') });

(async () => {
  const { atiende, onRequestPost } = await registro(), KV = kv(), reg = d => atiende(d, KV, fetchSim);
  let n = 0, fallas = 0;
  const prueba = async (nombre, f) => { n++; try { await f(); console.log('ok   ' + nombre); } catch (e) { fallas++; console.log('FALLA ' + nombre + '\n      ' + e.message); } };

  await prueba('sin clave no lista; la primera clave queda y no se puede cambiar', async () => {
    assert.strictEqual((await reg({ a: 'lista', clave: 'x' })).error, 'sin_clave');
    assert.strictEqual((await reg({ a: 'ponClave', clave: 'corta' })).error, 'clave_corta');
    assert.ok((await reg({ a: 'ponClave', clave: 'clave-del-centro' })).ok);
    assert.strictEqual((await reg({ a: 'ponClave', clave: 'otra-clave-x' })).error, 'ya_hay_clave');
    assert.strictEqual((await reg({ a: 'lista', clave: 'mala-clave' })).error, 'clave');
    assert.ok(![...KV.datos.values()].join().includes('clave-del-centro'), 'solo guarda la huella');
  });
  await prueba('un municipio se anota solo, sin claves, y no se duplica', async () => {
    assert.ok((await reg({ a: 'anotar', nombre: 'Ayuntamiento de Atlixco', url: EXEC, version: 'F1.4' })).ok);
    assert.ok((await reg({ a: 'anotar', nombre: 'Ayuntamiento de Atlixco', url: EXEC, version: 'F1.5' })).ok);
    const l = await reg({ a: 'lista', clave: 'clave-del-centro' });
    assert.strictEqual(l.municipios.length, 1); assert.strictEqual(l.municipios[0].version, 'F1.5');
    assert.ok(l.municipios[0].alta, 'guarda la fecha de alta');
  });
  await prueba('no anota direcciones que no son un padrón', async () => {
    assert.strictEqual((await reg({ a: 'anotar', nombre: 'X', url: FALSA })).error, 'no_es_padron');
    assert.strictEqual((await reg({ a: 'anotar', nombre: 'X', url: 'https://malo.com/exec' })).error, 'datos');
    assert.strictEqual((await reg({ a: 'lista', clave: 'clave-del-centro' })).municipios.length, 1);
  });
  await prueba('ocultar un municipio pide la clave', async () => {
    assert.strictEqual((await reg({ a: 'ocultar', clave: 'mala-clave', url: EXEC, oculto: true })).error, 'clave');
    assert.ok((await reg({ a: 'ocultar', clave: 'clave-del-centro', url: EXEC, oculto: true })).ok);
    assert.strictEqual((await reg({ a: 'lista', clave: 'clave-del-centro' })).municipios.length, 0);
  });
  await prueba('la función responde JSON aunque llegue basura', async () => {
    const r = await onRequestPost({ request: new Request('https://x/api/registro', { method: 'POST', body: 'no es json' }), env: { REGISTRO: KV } });
    assert.deepStrictEqual(await r.json(), { ok: false, error: 'servidor' });
  });
  console.log('\n' + (n - fallas) + ' de ' + n + ' pruebas pasaron.');
  process.exit(fallas ? 1 : 0);
})();
