# Padrón — Captura sin conexión (Etapa 1) · Guía

Qué incluye: **app de captura** (index.html, sw.js, manifest.json) y **servidor** (Code.gs, dentro de tu hoja de Google).
Todo es gratis y queda en tu cuenta de Google. NO está probado con datos reales: haz primero la prueba del final.

Cambios vs la guía v4: (1) para personas nuevas se piden **fecha de nacimiento y sexo** (obligatorios). Si se escribe un CURP válido, la app los sugiere a partir del CURP; el capturista los revisa con la credencial. El servidor los guarda en las columnas nuevas `nacimiento` y `sexo` de Capturas y Padron (se crean solas). (2) **El nombre ya no se usa para unir ni comparar registros.** El único identificador es el CURP. Sin CURP = siempre registro nuevo con folio `SC-`. Con CURP = solo se une a ese mismo CURP. (3) "Revisar" queda solo para apoyo repetido. Los archivos `_v4` y anteriores quedan obsoletos.

## Instalación (unos 20 minutos)

**A. Servidor**
1. En Google Drive crea una **Hoja de cálculo** nueva. Nómbrala "Padrón Único".
2. Menú **Extensiones → Apps Script**. Borra el contenido y pega todo `Code.gs`. Guarda.
3. Vuelve a la hoja y recárgala. Aparece el menú **Padrón**. Elige **1. Instalar (una sola vez)** y acepta los permisos (Google avisará que la app no está verificada: es tu propio script; elige "Avanzado → Continuar").
4. En la hoja **Catalogos** los trabajadores del ayuntamiento escriben localidades y grupos. Columnas: municipio, tipo (`localidad` o `grupo`) y valor. Con `*` en municipio aplica a todos.
   - Los apoyos se dan de alta desde la app, en la sección **Apoyos y eventos** (funciona sin señal; quedan disponibles de inmediato en ese teléfono y, al enviarse, en todos los del municipio). También se pueden escribir directo en la hoja **Eventos**: cada área da de alta, una sola vez, cada apoyo que va a entregar: id (único, ej. `DIF-001`), municipio (o `*`), nombre que verá el capturista, programa, tipo de apoyo, eje, área, canal de atención, monto, fecha y activo (`SI`/`NO`). Monto vacío = el capturista escribe el monto. Fecha vacía = se usa el día de la captura. Para dejar de ofrecerlo, escriba `NO` en activo. El capturista solo elige el nombre; el servidor copia los demás datos desde esta hoja.
   - En una hoja instalada con una versión anterior, crea la hoja **Eventos** con esas columnas en la fila 1 (o vuelve a correr *Instalar*). Los `programa`, `eje` y `area` de Catalogos ya no se usan.
5. En Apps Script: **Implementar → Nueva implementación → Aplicación web**. *Ejecutar como*: **Yo**. *Quién tiene acceso*: **Cualquier persona**. Copia la **URL** que termina en `/exec`.
   - Si cambias el código después, usa **Implementar → Administrar implementaciones → editar → Nueva versión**, para conservar la misma URL. En una hoja ya instalada no hace falta repetir "Instalar": las columnas `nacimiento` y `sexo` se crean solas al primer guardado.

**B. App de captura**
6. Abre `index.html` con un editor de texto y reemplaza `PEGUE_AQUI_LA_URL_DE_LA_APP_WEB` por esa URL (entre comillas).
7. Publica la carpeta en un alojamiento gratuito con https (GitHub Pages, Cloudflare Pages o Netlify), junto con `sw.js` y `manifest.json`. Verifica en su sitio las condiciones actuales del plan gratuito.
8. En el celular abre el enlace en Chrome y elige **Instalar app / Añadir a pantalla de inicio**. Abre la app una vez con señal: así queda guardada para usarse sin conexión.

**C. Claves de capturista**
9. Menú **Padrón → 2. Nueva clave de capturista**. Escribe nombre y municipio. La clave se muestra **una sola vez**; entrégala en persona. Para darla de baja escribe `NO` en la columna *activa* de la hoja **Claves**.
10. El municipio de cada capturista lo fijas tú aquí; el capturista no puede elegirlo.

## Uso diario
- **Capturista**: entra con su clave (con señal, solo la primera vez), llena el registro y toca *Guardar*. El CURP puede ir vacío. Si no hay señal queda en el teléfono y se envía solo al volver la conexión, o con el botón *Enviar pendientes ahora*.
- **Fecha de nacimiento y sexo**: obligatorios para una persona nueva. Si el CURP está escrito, la app los llena sola (solo si están vacíos) y muestra un aviso; compárelos con la credencial. Sin CURP se capturan a mano.
- **Ubicación**: toca *Tomar mi ubicación actual*, al aire libre. Solo si no se logra, toca *No puedo tomar la ubicación* y elige el motivo (GPS sin señal o no funciona; la persona no permitió; domicilio de difícil acceso; otro). Con "Otro" hay que explicar en Notas. Sin ubicación ni motivo la app no deja guardar.
- **Aviso de privacidad**: antes de guardar, marcar la casilla "Le informé a la persona el aviso de privacidad". El texto del aviso y el responsable de datos los defines tú (pendiente).
- **Al escribir un CURP completo** (con señal): si esa persona ya está registrada en su municipio, la app muestra "Ya registrado: NOMBRE" y oculta los datos personales (incluidos nacimiento y sexo). Solo se captura ubicación, apoyo nuevo (elegido de la lista de apoyos; monto solo si el apoyo lo pide) y notas. Si no es la persona, toque "No es esta persona" y corrija el CURP. Sin señal no puede saberlo: captura normal y el servidor lo une al registro de ese mismo CURP.
- **Datos de la persona**: nombre, nacimiento, sexo, localidad, teléfono y correo (opcionales), domicilio, colonia, código postal, grupos, foto, y foto de la INE por frente y reverso (opcionales).
- **Sin CURP**: cada captura crea un registro nuevo con folio `SC-`, aunque el nombre ya exista. Dos personas pueden llamarse igual; por eso el nombre nunca une registros.
- **Fin del día**: el capturista debe tocar *Enviar pendientes ahora* con señal antes de terminar. La app avisa si hay pendientes y si alguno lleva más de un día sin enviarse.
- **Administrador**: las capturas llegan a la hoja **Capturas** y se procesan solas hacia **Padron** y **Apoyos** (fotos en la carpeta privada "Padron-fotos" de tu Drive). No hay aprobación manual.

## Estados de una captura
- **Completa**: trae CURP. Se une solo al registro de ese mismo CURP en Padron; si no existe, se crea.
- **Incompleta**: sin CURP. Siempre crea un registro nuevo en Padron con folio `SC-xxxxxxxx`. Solo el administrador puede completarlo a mano (ver anexo).
- **Revisar**: solo apoyo repetido: mismo CURP o folio, mismo programa y mismo año. La columna **aviso** de Apoyos dice "Duplicado probable".

## Seguridad: qué sí y qué no
- El capturista nunca recibe datos del padrón ni de otros capturistas. La única excepción es la búsqueda de CURP: el servidor responde **solo el nombre**, y únicamente si esa persona está en el municipio del propio capturista. Las claves se guardan cifradas (hash).
- Las fotos están en tu Drive y no son públicas.
- **Tu hoja y tu carpeta son tan seguras como tu cuenta de Google:** activa la verificación en dos pasos y no compartas la hoja con capturistas.
- Los datos quedan en servidores de Google. Antes de usar datos reales define responsable y aviso de privacidad.
- Cualquiera con la URL puede intentar claves; por eso son de 10 caracteres aleatorios. Si sospechas filtración, pon `NO` a la clave.
- Quien tenga el teléfono desbloqueado puede ver los registros pendientes y los últimos enviados (solo nombre). Recomienda bloqueo de pantalla.

## Límites conocidos
- Google limita a 30 ejecuciones simultáneas por cuenta; con 20 o 30 capturistas suele bastar. Los límites pueden cambiar. Las fotos se suben fuera del candado de escritura para reducir esperas.
- Si el servidor está ocupado, el registro sigue en el teléfono y se reintenta cada minuto. Un registro reintentado puede dejar fotos repetidas en la carpeta de fotos.
- Cada registro con fotos pesa unos cientos de KB. Con señal débil puede tardar.
- Un iPhone puede borrar datos de sitios que no se usan por varias semanas. La app pide al teléfono conservar los datos, pero no está probado que lo conceda: enviar los pendientes cada día.
- Fotos y datos pendientes en el teléfono no están cifrados.
- Cada captura lee la columna de claves de Padron y de Apoyos: con miles de registros puede volverse lenta (velocidad sin medir).
- Un motivo de "sin ubicación" no se verifica: el capturista podría elegirlo sin intentar el GPS. Revisa la columna `motivoSinGps` de Capturas para ver si un capturista la usa demasiado.
- Una misma persona capturada sin CURP varias veces queda como varios registros `SC-`. Es a propósito (el nombre no une); el administrador puede juntarlos a mano.
- Si una persona ya registrada sin CURP vuelve con CURP, se crea un registro nuevo con su CURP; el `SC-` viejo no se une solo.
- Fecha de nacimiento y sexo de una persona ya registrada con CURP no se vuelven a pedir ni se actualizan.
- Sexo solo tiene dos opciones (Mujer, Hombre), igual que la letra del CURP.
- Aún no incluye: elegibilidad de programas, eventos masivos, Tablero, Auditoría, Solicitudes ni Bitácora (otras etapas).

## Lectura de INE (gratis, en el teléfono)
Al fotografiar el frente de la credencial, el teléfono lee el texto con Tesseract.js (lector OCR gratuito y de código abierto) y llena CURP, nombre y domicilio; con el CURP sugiere también fecha de nacimiento y sexo. **La imagen no se envía a ningún servicio de IA**: se procesa en el propio teléfono y solo viaja al guardar el registro, a tu servidor.
- La primera vez necesita señal para descargar el lector (varios MB). Puede que sin señal no funcione aunque se haya usado antes, porque parte se descarga de otro sitio que la app no guarda. Si falla, se teclea.
- Es menos precisa que una IA de visión: fotos con reflejos, sombras o poca luz producen errores. El CURP leído se corrige en confusiones típicas (0/O, 1/I, 5/S) y se verifica con su dígito verificador; si no pasa, la app avisa. Siempre se revisa lo que llenó.
- La lógica de lectura solo se probó con texto ficticio. Prueba con 10 credenciales propias o de voluntarios y revisa cuántos campos salen bien.

## Prueba antes de usarlo
1. Crea una clave de prueba y entra desde un celular.
2. Activa modo avión, guarda un registro **con CURP**, ubicación, fotos y aviso marcado; revisa que fecha de nacimiento y sexo se sugirieron bien. Debe quedar *Pendiente*.
3. Quita el modo avión; debe pasar a *Enviado* y verse en la hoja Capturas con estado *Completa* y con `nacimiento` y `sexo` llenos.
4. Intenta guardar una persona nueva sin fecha de nacimiento o sin sexo: debe negarse.
5. Guarda un registro **sin CURP**: debe llegar como *Incompleta* con folio `SC-`.
6. Guarda otra vez el mismo nombre sin CURP en el mismo municipio: debe llegar como *Incompleta* con **otro** folio `SC-` (no *Revisar*, no se une).
7. Repite el mismo CURP con el mismo apoyo de Eventos en el mismo año: debe marcar *Revisar* en Capturas y "Duplicado probable" en Apoyos.
8. Con señal, escribe el CURP del paso 2: debe salir "Ya registrado" con el nombre y ocultar los datos personales; registra un apoyo de otro programa y debe llegar sin crear persona nueva en Padron.
9. Provoca un error de servidor (pide al administrador pausar la implementación) y confirma que el registro queda *Pendiente* y no *Rechazado*.
10. Pon `NO` a la clave y confirma que ya no deja enviar.
11. Fotografía una INE de prueba y revisa qué campos llena y con cuántos errores.
12. Sin tocar ubicación, intenta guardar: debe negarse. Toca *No puedo tomar la ubicación*, elige un motivo y guarda: debe llegar con lat/lng vacíos y el motivo en `motivoSinGps`. Con motivo "Otro" y Notas vacías debe negarse.
13. Intenta guardar sin marcar el aviso de privacidad: debe negarse.

## Anexo: casos "Revisar" y datos mal escritos (propuesta, NO probada)
Lo hace el administrador (dueño de la hoja); el capturista nunca ve el padrón.

**1. Revisar apoyos repetidos (sugerido: una vez por semana)**
1. Abre la hoja **Capturas**, activa un filtro (Datos → Crear un filtro) y filtra la columna **estado** = `Revisar`.
2. Por cada fila, busca su **id** en la columna **captura** de la hoja **Apoyos** (la columna **aviso** dice "Duplicado probable").
3. Si de verdad se entregó dos veces: déjalo. Si fue captura doble: borra la fila repetida en Apoyos.
4. Al terminar, cambia el **estado** de esa fila en **Capturas** de `Revisar` a `Revisada`. El servidor no lee ese valor, así que no afecta nada más.

**2. Completar un registro Incompleto (solo a mano)**
1. Si sabes con certeza el CURP de un registro `SC-` (por ejemplo, con la credencial), en **Padron** escribe el CURP en **clave** y en **curp** de esa fila, y cambia **estado** a `Completo`.
2. En **Apoyos**, cambia la columna **clave** de sus apoyos del folio `SC-` al CURP.
3. Si ese CURP ya tenía su propia fila en Padron, no dejes dos filas con la misma clave: pasa los apoyos al CURP y en la fila del folio escribe en **estado** `Unido a` + el CURP (no borres filas, para conservar historial).
4. Nunca unas registros solo porque el nombre coincide.

**3. Corregir un dato mal escrito**
1. El capturista avisa al administrador (nombre del registro y qué está mal). No puede corregirlo él mismo.
2. El administrador corrige directo en la hoja **Padron** (nombre, localidad, teléfono, domicilio, grupos, nacimiento, sexo).
3. Si lo que está mal es el **CURP**: cambia **clave** y **curp** en Padron y la columna **clave** de sus apoyos en Apoyos. Verifica que el CURP nuevo tenga 18 caracteres válidos.
4. No edites la hoja **Capturas**: es el historial de lo que llegó.

**Qué NO está probado:** ningún paso se ejecutó en una hoja real. La búsqueda de CURP lee Padron (columna A y municipio): si cambias el municipio de una fila a mano, esa persona dejará de aparecer para su capturista. `Revisada` y `Unido a` son convenciones propuestas, no existen en el código.
