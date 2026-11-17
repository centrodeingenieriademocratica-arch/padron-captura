# Instalar la Consola del Centro

Una sola consola para ver y hacer todo en todos los municipios del padrón. Vive en la cuenta de Google del Centro y solo esa cuenta la puede abrir. Se hace una vez, en computadora.

## Antes

- Activar la verificación en dos pasos en la cuenta de Google del Centro. Esa cuenta es la llave maestra.
- Cada hoja de municipio debe estar compartida como editora con la cuenta del Centro (ya lo están Atlixco y Chiautzingo).

## Pasos

1. Entrar a https://script.google.com con la cuenta del Centro y crear un proyecto nuevo llamado «Consola del Centro · Padrón».
2. Pegar todo `plataforma/consola/Consola.gs` en lugar de lo que haya en Código.gs.
3. Archivo nuevo de tipo HTML llamado exactamente `Consola` y pegar todo `plataforma/consola/Consola.html`.
4. Guardar. Elegir la función `instalarConsola` y pulsar Ejecutar. Aceptar los permisos. Crea en el Drive del Centro la hoja «Consola del Centro · Padrón (PRIVADA, no compartir)». No la comparta.
5. Implementar › Nueva implementación › Aplicación web, con «Ejecutar como: Yo» y «Quién tiene acceso: Solo yo». Guardar la dirección /exec en el doc de llaves.
6. Abrir esa dirección. En «Agregar municipio», pegar la dirección de la hoja del municipio y su enlace de administrador (del doc de llaves). La consola lo prueba antes de guardarlo.

## Qué hace

- **Ver y editar datos**: cualquier pestaña de la hoja de cualquier municipio, con búsqueda. Tocar una celda la cambia; pide motivo y lo anota en la bitácora del municipio y en la de la consola.
- **Ver la app como…**: abre la app real del municipio como administrador, responsable, capturista o consulta, con todas las áreas. Lo que se haga ahí se guarda de verdad. Los usuarios de vista se llaman «Centro (supervisión)».
- **Usuarios**: crear (con enlace y botón de WhatsApp) y dar de baja.
- **Buscar en todos**: una persona por nombre o CURP en todos los municipios a la vez.
- **Bitácora**: todo lo hecho desde la consola.

## Seguridad

- Solo entra la cuenta dueña del script; cualquier otra ve «Sin acceso», aunque tenga la dirección.
- Las llaves de administrador se guardan en las propiedades privadas del script, nunca en una hoja, y la pantalla no las vuelve a mostrar.
- Si la hoja de la consola se comparte por error, la consola lo avisa arriba.

## Para actualizar

Pegar de nuevo los dos archivos y elegir Implementar › Gestionar implementaciones › Editar › Nueva versión. La dirección no cambia.

Estado: 14 pruebas en el simulador (`node plataforma/pruebas/consola.test.js`). **No probado en Google real.**
