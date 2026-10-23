# Padrón — Captura sin conexión (Etapa 1) · Guía

Qué incluye: **app de captura** (index.html, sw.js, manifest.json) y **servidor** (Code.gs, dentro de tu hoja de Google).
Todo es gratis y queda en tu cuenta de Google. NO está probado con datos reales: haz primero la prueba del final.

## Dónde se guardan los datos
- **Cada ayuntamiento tiene su propia hoja de Google** ("Padrón Único") con su propio servidor (Code.gs). Ahí quedan todos sus datos: hojas Padron (personas), Apoyos (entregas), Capturas (historial de todo lo que llegó), Eventos (apoyos que dan de alta las áreas), Claves y Catalogos. Las fotos van a la carpeta privada "Padron-fotos" del Drive de la cuenta que instaló.
- Las hojas se crean en el Drive de quien administra (una copia por ayuntamiento; ver *Nuevo ayuntamiento*). El ayuntamiento sigue siendo el responsable de los datos personales: hace falta su aviso de privacidad y un acuerdo por escrito sobre quién recibe y resguarda los datos.
- **Muchos capturistas por ayuntamiento**: cada uno con su clave (menú Padrón → 2). Todos envían al mismo servidor; si llegan varios a la vez, el servidor los atiende en fila y la app reintenta sola lo que no entró. Nada se pierde: queda en el teléfono hasta que el servidor confirma.
- **Una sola app para todos los ayuntamientos**: se publica una vez (GitHub Pages) y a cada ayuntamiento se le da su enlace: `https://…/index.html?srv=URL_DE_SU_SERVIDOR` (la URL que termina en `/exec`). El teléfono la recuerda. Solo acepta direcciones de Google Apps Script.
- **Límites**: Google limita el tamaño de una hoja de cálculo (10 millones de celdas) y el uso diario de Apps Script en cuentas gratuitas. Para un ayuntamiento alcanza para decenas de miles de registros; verifica los límites vigentes en la página de cuotas de Google Apps Script. Si un ayuntamiento crece mucho, se le crea una hoja nueva por año.
- El padrón integral de varios ayuntamientos (y el mapa) se arma en la Etapa 2 leyendo estas hojas; no hay que cambiar la captura.

Cambios vs la guía v4: (1) para personas nuevas se piden **fecha de nacimiento y sexo** (obligatorios). Si se escribe un CURP válido, la app los sugiere a partir del CURP; el capturista los revisa con la credencial. El servidor los guarda en las columnas nuevas `nacimiento` y `sexo` de Capturas y Padron (se crean solas). (2) **El nombre ya no se usa para unir ni comparar registros.** El único identificador es el CURP. Sin CURP = siempre registro nuevo con folio `SC-`. Con CURP = solo se une a ese mismo CURP. (3) "Revisar" queda solo para apoyo repetido. Los archivos `_v4` y anteriores quedan obsoletos.

## Menú Padrón (en la hoja)
1. Instalar (una sola vez) · 2. Nueva clave de capturista · 3. Importar histórico (hoja Importar) · 4. Claves en lote: crea la hoja **NuevasClaves**; escribe nombre y municipio de cada capturista, vuelve a correrlo y aparecen las claves en la columna C para imprimir (bórralas después de entregar) · 6. Ubicar direcciones en el mapa (ver abajo) · 5. Actualizar Avance: hoja **Avance** con personas, apoyos y montos, personas que recibieron apoyos de 2 o más áreas en el año, y registros por capturista y por día. Se actualiza sola cada madrugada; este menú la actualiza al momento.

## Instructivo para capturistas (imprimir y entregar)
1. Abra en el celular el enlace que le dieron (Chrome en Android, Safari en iPhone). Menú del navegador → *Agregar a pantalla de inicio*.
2. **La primera vez, con señal**: escriba su clave y toque Entrar. Después funciona sin señal.
3. **Dar de alta un apoyo** (una sola vez por apoyo): *Apoyos y eventos* → *Dar de alta un apoyo o evento* → nombre, programa, tipo, área, canal, monto y fecha → *Guardar apoyo*.
   - **Apoyo periódico**: al crearlo, en *¿Es un apoyo periódico?* elija la frecuencia (mensual, bimestral, etc.). Para cada nueva entrega, en *¿Es una nueva entrega de un apoyo periódico que ya existe?* elíjalo: programa, tipo, eje y área quedan fijos; canal, monto, lugar y localidad se copian de la última entrega y se pueden cambiar; solo escribe el periodo (ej. Noviembre 2026) y la fecha. Recibir otra entrega del mismo apoyo periódico no se marca como repetido; recibir dos veces la misma entrega, sí.
3b. **Entregas en un lugar (evento)**: al dar de alta el apoyo escriba también el lugar de entrega, su dirección, tome el GPS estando en el lugar (o escriba coordenadas) y la localidad de los beneficiarios. Luego, en *Capturar beneficiarios de un evento*, elíjalo y toque **Entrar al evento**: arriba aparece el evento y por cada persona solo se piden sus datos; el apoyo, el lugar, la fecha, el monto y la ubicación ya no se vuelven a capturar. La app sigue en el evento (aunque se cierre) hasta tocar *Salir del evento*. Si el apoyo no tiene lugar (se entrega en cada domicilio), sí se pide la ubicación de cada domicilio.
4. **Registrar a una persona**: foto de la INE (frente y reverso) si la trae; revise lo que se llenó solo. CURP (si no lo tiene, déjelo vacío). Nombre, nacimiento, sexo, domicilio, colonia, CP, localidad, teléfono, grupos, foto.
5. **Ubicación**: si está en el domicilio, al aire libre, toque *Estoy en el domicilio: tomar ubicación GPS*. Si captura en la oficina, en un evento o no hay GPS, toque *No estoy en el domicilio o no hay GPS*, elija el motivo y escriba completa la dirección (calle, número, colonia, CP, localidad). Si conoce las coordenadas (por ejemplo, de Google Maps), escríbalas. **Nunca tome el GPS si no está en el domicilio.**
6. **Apoyo**: marque *Registrar un apoyo entregado*, elija el apoyo de la lista, escriba el monto solo si lo pide, foto del apoyo.
7. Lea o explique el aviso de privacidad, marque la casilla y toque **Guardar registro**.
8. Si aparece *Ya registrado: NOMBRE*, no capture otra vez sus datos: solo el apoyo nuevo.
9. **Al final del día, con señal**: toque *Enviar pendientes ahora* hasta que diga *Todo enviado*. No cierre sesión con pendientes.
10. Un dato mal capturado no lo puede corregir usted: avise a su administrador con el nombre y qué está mal.

## Nuevo ayuntamiento en 15 minutos (una copia por ayuntamiento)
Cada ayuntamiento recibe **su propia copia**: su hoja, su servidor, sus claves, su carpeta de fotos y su enlace. Nada en la app ni en su hoja menciona a otros ayuntamientos.

**Una sola vez: la plantilla.** Crea una hoja vacía llamada "Plantilla Padrón", ve a Extensiones → Apps Script, pega `Code.gs` y guarda. No captures nada en la plantilla. GitHub Pages tiene que estar activo (Settings → Pages → rama `main`, carpeta `/ (root)`). En una cuenta gratuita, el repositorio debe ser público; el código no contiene datos.

**Por cada ayuntamiento:**
1. Plantilla → **Archivo → Hacer una copia** → nómbrala "Padrón de beneficiarios · NOMBRE DEL AYUNTAMIENTO".
2. Abre la copia, recárgala y entra al menú **Padrón → 1. Instalar**. Escribe el nombre del ayuntamiento tal como lo verán los capturistas. Acepta los permisos: Google avisará que la app no está verificada porque es tu propio script; elige *Avanzado → Continuar*. Instalar detecta que es una copia y crea claves y una carpeta de fotos propias. Además deja programada la actualización diaria de **Avance**.
3. Extensiones → Apps Script → **Implementar → Nueva implementación → Aplicación web**. *Ejecutar como*: **Yo**. *Quién tiene acceso*: **Cualquier persona**. Copia la URL que termina en `/exec`.
4. Arma el enlace del ayuntamiento: `https://centrodeingenieriademocratica-arch.github.io/padron-captura/?srv=` + esa URL. Ábrelo en tu celular: arriba debe aparecer "Padrón de beneficiarios · NOMBRE".
5. En **Catalogos** (columna municipio = `*`) escribe sus localidades (tipo `localidad`), sus grupos (tipo `grupo`) y el **aviso de privacidad del ayuntamiento** (tipo `aviso`, el texto completo en la columna valor). La app lo muestra antes de guardar.
6. **Claves**: menú **Padrón → 4. Claves en lote**. Escribe un nombre por fila, vuelve a correrlo, imprime las claves y bórralas de la hoja después de entregarlas.
7. **Que el ayuntamiento vea su padrón**: botón **Compartir** de su copia → correo de su enlace o administrador → *Lector* (o *Editor*, solo para quien corrige datos). Esa hoja es su padrón integral: Padron (personas), Apoyos (todas las entregas de todas las áreas), Eventos, Avance. Se descarga a Excel con Archivo → Descargar.
8. Entrega el enlace, las claves y el *Instructivo para capturistas*.

**Para que parezca solo de ellos y no se acabe el espacio**, lo recomendable es crear una **cuenta de Google gratuita por ayuntamiento** (ej. padron.nombredelmunicipio@gmail.com), hacer ahí su copia y compartirla con tu cuenta principal como Editor. Así cada ayuntamiento tiene sus 15 GB y sus propios límites de uso de Google, y el dueño que se ve es esa cuenta. Si usas tu misma cuenta para varios ayuntamientos, el espacio y los límites diarios de Google se reparten entre todos.

## Instalación (detalle técnico)

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
6. Da a los capturistas el enlace de la app con `?srv=` y la URL de tu servidor al final (ver *Dónde se guardan los datos*). O, si prefieres, abre `index.html` y reemplaza `PEGUE_AQUI_LA_URL_DE_LA_APP_WEB` por esa URL (entre comillas).
7. Publica la carpeta en un alojamiento gratuito con https (GitHub Pages, Cloudflare Pages o Netlify), junto con `sw.js` y `manifest.json`. Verifica en su sitio las condiciones actuales del plan gratuito.
8. En el celular abre el enlace en Chrome y elige **Instalar app / Añadir a pantalla de inicio**. Abre la app una vez con señal: así queda guardada para usarse sin conexión.

**C. Claves de capturista**
9. Menú **Padrón → 2. Nueva clave de capturista** (o 4, en lote). Escribe el nombre; el municipio es el del ayuntamiento de esta copia. La clave se muestra **una sola vez**; entrégala en persona. Para darla de baja escribe `NO` en la columna *activa* de la hoja **Claves**.
10. El capturista no puede elegir el municipio: es siempre el de esta copia.

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

**Importar beneficiarios históricos (Excel), tal como los tenga cada área**
**Lo más fácil: desde la app.** En la app, abre **Importar lista de Excel (histórico)**, elige el archivo (Excel o CSV, tal como venga) y, si la lista no trae columnas de programa o área, escríbelos una vez. Oprime **Importar al padrón**. La lista completa queda en una hoja nueva `Importar <archivo> · <código>` (el dato original, con todas sus columnas) y cada persona pasa al padrón. Si se corta la señal, **Seguir importando** continúa sin duplicar. Necesita señal. NO probado en Google real.

**También desde la hoja:**
1. En la hoja del ayuntamiento: **Archivo → Importar → Subir** el Excel → *Insertar hojas nuevas*. Cambia el nombre de esa hoja para que empiece con **Importar** (ej. `Importar DIF 2024`, `Importar Becas 2023`). Puede haber varias.
2. No hay que reacomodar nada. La fila 1 debe tener los encabezados, como sea que los llamen. El sistema reconoce nombres distintos para lo mismo: CURP, apellido paterno y materno con nombre(s) o nombre completo, género o sexo, fecha de nacimiento, calle, núm. ext., domicilio o dirección, colonia o barrio, comunidad, localidad o junta auxiliar, CP, teléfono o celular, correo, grupo, programa, tipo de apoyo o concepto, área o dependencia, monto o importe, fecha de entrega, latitud y longitud.
3. Abre esa hoja y usa el menú **Padrón → 3. Importar histórico**. Si la lista no trae columna de programa, pregunta una vez de qué programa es toda la lista y qué área lo entregó.
4. Al terminar, un mensaje dice qué columna se usó para qué y cuáles se conservaron sin usar. **Nada se borra ni se cambia** en la hoja original: solo se agregan al final `clave_padron` (la persona en Padron) y `resultado`. No borres esas hojas: son el dato original del ayuntamiento.
5. Se une solo por CURP. Si el CURP viene mal escrito, la persona se importa sin CURP (folio `SC-`) y se anota en resultado. Si faltan nacimiento o sexo y el CURP es válido, se toman del CURP. Se marca como repetido solo el mismo programa con la misma fecha.
6. Si un encabezado no se reconoce y sí lo necesitas, cámbiale el nombre (ej. a `Colonia`), borra las columnas `resultado` y `clave_padron` y vuelve a correr. Con listas muy grandes, el mensaje pide volver a correr para seguir.

**Ubicar direcciones en el mapa (coordenadas)**
- Menú **Padrón → 6. Ubicar direcciones en el mapa**: convierte en coordenadas la dirección de cada persona que no las tenga (las importadas y las capturadas fuera del domicilio). Es gratis y usa el servicio de mapas de Google desde tu cuenta. Tiene un límite diario: lo que falte se sigue solo cada madrugada.
- En Padron, la columna `origen_ubicacion` dice de dónde salió cada punto: *GPS* (tomado en el domicilio), *Escrita a mano*, *Del Excel*, *Geocodificada* o *Pendiente*. La columna `precision` dice si la dirección se encontró exacta, por calle o solo aproximada (colonia o localidad).
- *No encontrada*: corrige la dirección en Padron, borra "No encontrada" y vuelve a correr el menú.

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
