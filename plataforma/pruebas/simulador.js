/* Simulador mínimo de Google Apps Script para probar Codigo.gs en Node, sin Google.
   Imita solo lo que usa el servidor: hojas, rangos, buscador de texto, candado, propiedades y utilidades. */
const fs = require('fs'), vm = require('vm'), crypto = require('crypto'), path = require('path');

/* Como Google Sheets: un texto que empieza con ' se guarda sin el apóstrofo; uno que empieza con = o + se vuelve fórmula (error). */
const comoHoja = x => typeof x !== 'string' ? x : x[0] === "'" ? x.slice(1) : /^[=+]/.test(x) ? '#ERROR!' : x;
class Rango {
  constructor(h, r, c, nr, nc) { Object.assign(this, { h, r, c, nr, nc }); }
  getRow() { return this.r; }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const fila = this.h.datos[this.r - 1 + i] || [];
      const v = [];
      for (let j = 0; j < this.nc; j++) { const x = fila[this.c - 1 + j]; v.push(x === undefined ? '' : x); }
      out.push(v);
    }
    return out;
  }
  setValue(x) {
    const f = this.h.datos[this.r - 1] || (this.h.datos[this.r - 1] = []);
    f[this.c - 1] = comoHoja(x);
    return this;
  }
  createTextFinder(t) { return new Buscador(this, String(t)); }
}
class Buscador {
  constructor(rg, t) { this.rg = rg; this.t = t.toLowerCase(); this.entera = false; }
  matchEntireCell(b) { this.entera = b; return this; }
  matchCase() { return this; }
  findAll() {
    const v = this.rg.getValues(), out = [];
    v.forEach((fila, i) => fila.forEach((x, j) => {
      const s = String(x).toLowerCase();
      if (this.entera ? s === this.t : s.indexOf(this.t) >= 0) out.push(new Rango(this.rg.h, this.rg.r + i, this.rg.c + j, 1, 1));
    }));
    return out;
  }
  findNext() { return this.findAll()[0] || null; }
}
class Hoja {
  constructor(n) { this.n = n; this.datos = []; }
  getName() { return this.n; }
  getLastRow() { return this.datos.length; }
  getLastColumn() { return Math.max(0, ...this.datos.map(f => f.length)); }
  appendRow(f) { this.datos.push(f.map(comoHoja)); }
  getRange(r, c, nr, nc) { return new Rango(this, r, c, nr || 1, nc || 1); }
  setFrozenRows() {}
}
function crear(opciones = {}) {
  const hojas = opciones.hojas || {}, props = opciones.props || {}, cache = {};
  const libro = {
    getSheetByName: n => hojas[n] || null,
    insertSheet: n => (hojas[n] = new Hoja(n)),
  };
  const ctx = {
    console,
    SpreadsheetApp: { getActive: () => libro, getUi: () => { throw new Error('sin UI'); } },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (alg, s) => [...crypto.createHash(alg).update(s, 'utf8').digest()],
      base64Encode: b => Buffer.from(b).toString('base64'),
      base64Decode: s => [...Buffer.from(s, 'base64')],
      formatDate: (d, tz, f) => {
        const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
        if (f !== 'yyyy-MM-dd') throw new Error('formato no simulado');
        return p;
      }
    },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType() { return this; }, contenido: s }) },
    HtmlService: { XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' }, createHtmlOutput: s => { const o = { contenido: s, setTitle(t) { o.titulo = t; return o; }, addMetaTag() { return o; }, setXFrameOptionsMode(m) { o.marco = m; return o; }, setFaviconUrl(u) { o.icono = u; return o; } }; return o; } },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) },
    ScriptApp: { getService: () => ({ getUrl: () => null }) },
    /* GitHub simulado: lee los archivos de plataforma/app. opciones.sinRed simula GitHub caído. */
    UrlFetchApp: { fetch: function (url) {
      const nom = url.split('/').pop(), f = path.join(__dirname, '..', /\.gs$/.test(nom) ? 'servidor' : 'app', nom);
      if (opciones.fetch) { const r = opciones.fetch(url, arguments[1]); if (r) return r; }
      const ok = !opciones.sinRed && fs.existsSync(f);
      return { getResponseCode: () => ok ? 200 : 404, getContentText: () => ok ? fs.readFileSync(f, 'utf8') : '' };
    } }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'servidor', opciones.archivo || 'Codigo.gs'), 'utf8'), ctx);
  /* Llamada como la haría la app: POST con JSON. */
  ctx.post = (body) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).contenido);
  ctx.hojas = hojas; ctx.props = props; ctx.cache = cache; ctx.opciones = opciones;
  /* Abrir la dirección /exec como en un navegador: devuelve el HTML de la app. */
  ctx.abrir = (parametros) => ctx.doGet({ parameter: parametros || {} }).contenido;
  return ctx;
}
module.exports = { crear };
