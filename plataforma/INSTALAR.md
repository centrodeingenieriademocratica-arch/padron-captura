# Instalar el padrón en un ayuntamiento

Igual que la herramienta de estructura: la app vive en la dirección de la aplicación web de Apps Script del ayuntamiento. Cada persona entra con su enlace personal, que termina en `?u=` y un código. Nadie necesita cuenta.

Se hace en computadora, una sola vez.

1. Crear una cuenta de Google gratuita para el ayuntamiento y entrar con ella.
2. Crear una hoja de cálculo llamada «Padrón de beneficiarios – nombre del ayuntamiento». Compartirla como editora con la cuenta del Centro.
3. En la hoja, ir a Extensiones › Apps Script. Copiar todo el texto de `plataforma/servidor/Cargador.gs` desde GitHub, pegarlo en lugar de lo que haya en Código.gs y guardar. El cargador toma solo la versión maestra (`Codigo.gs`) de GitHub; no se pega nada más, nunca.
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

## App de mando del Centro (una sola vez, cuenta del Centro)

1. **Registro**: en script.google.com con la cuenta del Centro, un proyecto con `plataforma/registro/Registro.gs`. Implementar como aplicación web, «Ejecutar como: Yo», «Quién tiene acceso: Cualquier usuario». Su dirección /exec va en `REGISTRO_CENTRO` de `servidor/Codigo.gs` y en `admin/config.js`.
2. **App**: desde `plataforma/admin`, una vez `firebase hosting:sites:create cid-admin-benefi --project cid-enlaces`, y luego `firebase deploy --only hosting --project cid-enlaces`. El `firebase.json` de esa carpeta solo publica el sitio cid-admin-benefi: no toca ningún otro sitio del proyecto.
3. En el celular abrir https://cid-admin-benefi.web.app, «Agregar a pantalla de inicio», elegir PIN y clave del registro, y escribir la clave de administrador de cada municipio. Las claves quedan solo en ese celular, cifradas con el PIN.
