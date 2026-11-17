# Instalar el padrón en un ayuntamiento

Igual que la herramienta de estructura: la app vive en la dirección de la aplicación web de Apps Script del ayuntamiento. Cada persona entra con su enlace personal, que termina en `?u=` y un código. Nadie necesita cuenta.

Se hace en computadora, una sola vez.

1. Crear una cuenta de Google gratuita para el ayuntamiento y entrar con ella.
2. Crear una hoja de cálculo llamada «Padrón de beneficiarios – nombre del ayuntamiento». Compartirla como editora con la cuenta del Centro.
3. En la hoja, ir a Extensiones › Apps Script. Copiar todo el texto de `plataforma/servidor/Codigo.gs` desde GitHub, pegarlo en lugar de lo que haya en Código.gs y guardar.
4. Implementar › Nueva implementación › Aplicación web, con «Ejecutar como: Yo» y «Quién tiene acceso: Cualquier usuario». Aceptar los permisos.
5. Volver a la hoja y recargarla. En el menú Padrón › 1. Configurar este ayuntamiento, escribir el nombre del ayuntamiento y dejar vacío el enlace corto.
6. Aparece el enlace del administrador. Ojo: desde la hoja, Google pone en el enlace una dirección que no sirve para el público. Cambie lo que va antes de `?u=` por la dirección /exec que dio Implementar (paso 4), o mejor pegue esa dirección antes, en la pestaña Config, clave `URL_APP`. Entregarlo en persona: no se vuelve a mostrar. Si se pierde, usar Padrón › 2. Nuevo enlace de administrador.
   - Los enlaces que se creen después desde la app ya salen bien.
   - En una computadora con varias cuentas de Google abiertas, la app puede decir «No se pudo abrir el archivo». Ábrala en el celular o en una ventana de incógnito.
7. Abrir ese enlace en el celular. Dar de alta los programas, los eventos y los usuarios desde «Programas, eventos y usuarios».

## Para actualizar

- Si cambia la app (`plataforma/app`), no hay que hacer nada: cada ayuntamiento la toma de GitHub y la renueva cada 6 horas. Para tenerla al momento: Padrón › 3. Actualizar la app ahora.
- Si cambia `Codigo.gs`, pegarlo de nuevo y elegir Implementar › Gestionar implementaciones › Editar › Nueva versión. La dirección no cambia.

## Enlace corto (opcional)

Se hace igual que los de estructura, con un sitio nuevo en el proyecto de Firebase «CID enlaces». El sitio se llama, por ejemplo, `padron-chiautzingo`, y su `firebase.json` lleva esto:

```json
{ "hosting": { "site": "padron-chiautzingo", "public": "vacio",
  "redirects": [ { "source": "/:codigo", "destination": "https://script.google.com/macros/s/ID_DEL_SCRIPT/exec?u=:codigo", "type": 302 } ] } }
```

Después pegue `https://padron-chiautzingo.web.app` en la pestaña Config, en la clave `URL_APP`. Los enlaces nuevos saldrán cortos.

## Sin señal

Lo capturado sin señal se queda en el teléfono y se envía solo al volver la conexión. Para abrir la app hace falta señal la primera vez de cada jornada. Si la señal se va, no cierre la pestaña.
