# Instalar el padrón en un ayuntamiento

Igual que la herramienta de estructura: la app vive en la dirección de la aplicación web de Apps Script del ayuntamiento. Cada persona entra con su enlace personal, que termina en `?u=` y un código. Nadie necesita cuenta.

Se hace en computadora, una sola vez.

1. Crear una cuenta de Google gratuita para el ayuntamiento y entrar con ella.
2. Crear una hoja de cálculo llamada «Padrón de beneficiarios – nombre del ayuntamiento». Compartirla como editora con la cuenta del Centro.
3. En la hoja, ir a Extensiones › Apps Script. Copiar todo el texto de `plataforma/servidor/Cargador.gs` desde GitHub, pegarlo en lugar de lo que haya en Código.gs y guardar. El cargador toma solo la versión maestra (`Codigo.gs`) de GitHub (pendiente: de la Maestra en el Drive del CID); no se pega nada más, nunca.
4. Implementar › Nueva implementación › Aplicación web, con «Ejecutar como: Yo» y «Quién tiene acceso: Cualquier usuario». Aceptar los permisos.
5. Volver a la hoja y recargarla. En el menú Padrón › 1. Configurar este ayuntamiento, escribir el nombre del ayuntamiento y dejar vacío el enlace corto.
6. Aparece el enlace del administrador. Ojo: desde la hoja, Google pone en el enlace una dirección que no sirve para el público. Cambie lo que va antes de `?u=` por la dirección /exec que dio Implementar (paso 4), o mejor pegue esa dirección antes, en la pestaña Config, clave `URL_APP`. Entregarlo en persona: no se vuelve a mostrar. Si se pierde, usar Padrón › 2. Nuevo enlace de administrador.
   - Los enlaces que se creen después desde la app ya salen bien.
   - En una computadora con varias cuentas de Google abiertas, la app puede decir «No se pudo abrir el archivo». Ábrala en el celular o en una ventana de incógnito.
7. Abrir ese enlace en el celular. Dar de alta los programas, los eventos y los usuarios desde «Programas, eventos y usuarios».

## Para actualizar

- Si cambia la app (`plataforma/app`), no hay que hacer nada: cada ayuntamiento la toma de GitHub y la renueva cada 6 horas. Para tenerla al momento: Padrón › 3. Actualizar la app ahora.
- Si cambia `Codigo.gs` (la versión maestra), tampoco hay que hacer nada: el cargador la toma sola en máximo 6 horas. Para tenerla al momento en todos: botón «Actualizar todos a la versión maestra» en la app de mando.
- Solo si cambia `Cargador.gs` (casi nunca) hay que pegarlo de nuevo y elegir Implementar › Gestionar implementaciones › Editar › Nueva versión.
- Ayuntamientos instalados antes del cargador (Atlixco, Chiautzingo): pegar `Cargador.gs` en lugar del código completo una sola vez y hacer Nueva versión. Sus datos y enlaces no cambian.

## Dirección propia del Centro (enlace corto con nombre)

Igual que en estructura: cada ayuntamiento tiene su dirección `https://cid-padron-<municipio>.web.app` en el proyecto de Firebase «CID enlaces» (cuenta del Centro). La app se abre dentro de esa página, así que el celular siempre muestra la dirección del Centro, con su logo y su título al mandarla por WhatsApp. Los enlaces quedan así: `https://cid-padron-atlixco.web.app/ana-<código>`.

1. En `plataforma/enlaces/sitios.json` agregar un renglón con el sitio, el municipio y la dirección `/exec`.
2. Una sola vez por ayuntamiento: `firebase hosting:sites:create cid-padron-<municipio> --project cid-enlaces`.
3. `node plataforma/enlaces/armar.js` y luego, desde `plataforma/enlaces`, `firebase deploy --only hosting`.
4. En la hoja del ayuntamiento, pestaña Config, poner la clave `URL_CORTA` con `https://cid-padron-<municipio>.web.app`. Desde ese momento los enlaces nuevos (y los botones de WhatsApp) salen con la dirección corta. Los enlaces viejos siguen sirviendo.

## Sin señal

Lo capturado sin señal se queda en el teléfono y se envía solo al volver la conexión. Para abrir la app hace falta señal la primera vez de cada jornada. Si la señal se va, no cierre la pestaña.

## Dónde vive todo (estándar del Arquitecto, opción B)

Javier decidió (17-nov) que todo vive en Google: la cuenta del CID guarda solo el código maestro (carpeta «Apps CID / Padrón / Maestra», versiones servidor-vN) y la lista de municipios; los datos, siempre en la cuenta de cada municipio. No se usa Cloudflare.

Pendiente: (1) cargador que tome la Maestra del Drive del CID cada 10 minutos, solo archivos cuyo dueño sea el CID, con copia local (modelo: Mérito); hoy todavía la toma de GitHub. (2) Registro: archivo chico en la cuenta del municipio, compartido solo para leer con el CID. (3) App de mando «Padrón · Mando» igual al modelo de Estructura territorial, con las piezas de «Apps CID / Timón / Maestra / Pieza común». La consola de `plataforma/admin` NO se publica (orden 36e).
