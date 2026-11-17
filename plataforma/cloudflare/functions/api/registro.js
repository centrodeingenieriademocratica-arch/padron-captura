/* REGISTRO DE MUNICIPIOS · Padrón de beneficiarios (función de Cloudflare Pages, sin cuenta Google del CID)
   Cada municipio se anota solo cuando se abre su app: nombre y dirección /exec. Nunca guarda claves de municipios.
   La app de mando lee la lista con la clave del registro, que la usuaria pone una sola vez desde su celular
   (aquí solo queda su huella). La lista vive en Cloudflare KV (enlace REGISTRO en wrangler.toml).
   Probado solo en local (plataforma/pruebas/registro-cloudflare.test.js). */

const EXEC_RE = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,}\/exec$/;
const json = o => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const txt = (x, n) => String(x === undefined || x === null ? '' : x).trim().slice(0, n || 150);
const espera = ms => new Promise(r => setTimeout(r, ms));

async function huella(kv, c) {
  let sal = await kv.get('SAL');
  if (!sal) { sal = crypto.randomUUID(); await kv.put('SAL', sal); }
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sal + String(c)));
  return btoa(String.fromCharCode(...new Uint8Array(h)));
}
async function claveOk(kv, c) {
  const h = await kv.get('CLAVE');
  if (!h) return 'sin_clave';
  if ((await huella(kv, c)) !== h) { await espera(800); return 'clave'; }
  return '';
}
const leeMun = async (kv, url) => { try { return JSON.parse(await kv.get('m:' + url) || 'null'); } catch (e) { return null; } };

export async function atiende(d, kv, fetchFn) {
  d = d || {};
  if (d.a === 'anotar') return anotar(d, kv, fetchFn);
  if (d.a === 'ponClave') {
    const c = String(d.clave || '');
    if (await kv.get('CLAVE')) return { ok: false, error: 'ya_hay_clave' };
    if (c.length < 8) return { ok: false, error: 'clave_corta' };
    await kv.put('CLAVE', await huella(kv, c));
    return { ok: true };
  }
  if (d.a === 'lista') {
    const e = await claveOk(kv, d.clave); if (e) return { ok: false, error: e };
    const out = []; let cursor;
    do {
      const r = await kv.list({ prefix: 'm:', cursor });
      for (const k of r.keys) { const m = await leeMun(kv, k.name.slice(2)); if (m && !m.oculto) out.push(m); }
      cursor = r.list_complete ? null : r.cursor;
    } while (cursor);
    return { ok: true, municipios: out.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')) };
  }
  if (d.a === 'ocultar') {
    const e = await claveOk(kv, d.clave); if (e) return { ok: false, error: 'clave' };
    const m = await leeMun(kv, txt(d.url, 200));
    if (m) { m.oculto = !!d.oculto; await kv.put('m:' + m.url, JSON.stringify(m)); }
    return { ok: true };
  }
  return { ok: false, error: 'accion' };
}
/* Solo se anota una dirección /exec que de verdad responde como padrón de un municipio. */
async function anotar(d, kv, fetchFn) {
  const url = txt(d.url, 200);
  if (!EXEC_RE.test(url)) return { ok: false, error: 'datos' };
  const ya = await leeMun(kv, url), nombre = txt(d.nombre, 120);
  if (!ya || ya.nombre !== nombre) {
    let est = null;
    try { est = await (await fetchFn(url + '?estado=1', { redirect: 'follow' })).json(); } catch (e) {}
    if (!est || est.servicio !== 'padron-municipal') return { ok: false, error: 'no_es_padron' };
  }
  const ahora = new Date().toISOString();
  await kv.put('m:' + url, JSON.stringify({ nombre: nombre || (ya && ya.nombre) || 'Sin nombre', url, corta: txt(d.corta, 200),
    version: txt(d.version, 20), visto: ahora, alta: (ya && ya.alta) || ahora, oculto: !!(ya && ya.oculto) }));
  return { ok: true };
}

export async function onRequestPost({ request, env }) {
  try { return json(await atiende(JSON.parse(await request.text()), env.REGISTRO, fetch)); }
  catch (e) { return json({ ok: false, error: 'servidor' }); }
}
export async function onRequestGet({ request }) {
  return json(new URL(request.url).searchParams.get('estado') ? { ok: true, servicio: 'registro-padron' } : { ok: false });
}
