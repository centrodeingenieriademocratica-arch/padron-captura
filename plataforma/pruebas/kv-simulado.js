/* Cloudflare KV en memoria, para probar el registro sin Cloudflare. */
function kv() {
  const m = new Map();
  return { datos: m,
    get: async k => (m.has(k) ? m.get(k) : null),
    put: async (k, v) => { m.set(k, String(v)); },
    list: async ({ prefix = '' } = {}) => ({ keys: [...m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }) };
}
const registro = () => import('../cloudflare/functions/api/registro.js');
module.exports = { kv, registro };
