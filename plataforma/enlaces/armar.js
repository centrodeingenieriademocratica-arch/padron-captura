/* Arma las direcciones cortas del padrón (una por ayuntamiento) para Firebase Hosting, proyecto «cid-enlaces».
   Uso: node armar.js   → crea publico/<sitio>/ y firebase.json. Después: firebase deploy --only hosting
   Para un ayuntamiento nuevo: agregar su renglón en sitios.json (sitio, municipio, dirección /exec),
   crear el sitio una vez (firebase hosting:sites:create <sitio>) y volver a correr esto. */
const fs = require('fs'), path = require('path');
const aqui = __dirname, sitios = JSON.parse(fs.readFileSync(path.join(aqui, 'sitios.json'), 'utf8'));
const plantilla = fs.readFileSync(path.join(aqui, 'plantilla.html'), 'utf8');
const hosting = [], targets = {};
for (const s of sitios) {
  if (!/^[a-z0-9-]+$/.test(s.sitio) || !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(s.exec)) throw new Error('Renglón inválido: ' + s.sitio);
  const dir = path.join(aqui, 'publico', s.sitio);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), plantilla.split('{{MUNICIPIO}}').join(s.municipio)
    .split('{{SITIO}}').join('https://' + s.sitio + '.web.app').split('{{EXEC}}').join(s.exec));
  fs.copyFileSync(path.join(aqui, 'icono.png'), path.join(dir, 'icono.png'));
  hosting.push({ target: s.sitio, public: 'publico/' + s.sitio, cleanUrls: true,
    rewrites: [{ source: '**', destination: '/index.html' }],
    headers: [{ source: '/', headers: [{ key: 'Cache-Control', value: 'no-cache' }] }] });
  targets[s.sitio] = [s.sitio];
}
fs.writeFileSync(path.join(aqui, 'firebase.json'), JSON.stringify({ hosting }, null, 2) + '\n');
fs.writeFileSync(path.join(aqui, '.firebaserc'), JSON.stringify({ projects: { default: 'cid-enlaces' },
  targets: { 'cid-enlaces': { hosting: targets } } }, null, 2) + '\n');
console.log('Listo: ' + sitios.map(s => 'https://' + s.sitio + '.web.app').join(', '));
