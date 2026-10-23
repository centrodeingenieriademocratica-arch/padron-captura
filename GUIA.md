# Padrón — Captura sin conexión (Etapa 1) · Guía

Qué incluye: **app de captura** (index.html, sw.js, manifest.json) y **servidor** (Code.gs, dentro de tu hoja central de Google).
Todo es gratis y queda en tu cuenta de Google. NO está probado con datos reales: haz primero la prueba del final.

## Dónde se guardan los datos
- **Un solo servidor, una hoja por ayuntamiento.** El servidor (Code.gs) vive en tu **hoja central** (carpeta de Drive 1.1.Plataforma). Cada ayuntamiento tiene **su propia hoja** en esa misma carpeta, con sus hojas Padron (personas), Apoyos (entregas), Capturas (historial), Eventos (apoyos dados de alta), Claves y Catalogos, y su carpeta privada de fotos de INE. La hoja central solo guarda la lista de ayuntamientos (hoja **Ayuntamientos**: nombre, hoja, enlace y código).
- **Cada ayuntamiento ve solo lo suyo**: su enlace de la app lleva un código propio (`m=`); la app muestra solo su nombre y sus claves solo funcionan con su enlace. Nada menciona a otros ayuntamientos.
- **Muchos capturistas por ayuntamiento**: cada uno con su clave, que da el administrador del ayuntamiento desde la app. Si llegan varios a la vez, el servidor los atiende en fila y la app reintenta sola. Nada se pierde: queda en el teléfono hasta que el servidor confirma.
- El ayuntamiento sigue siendo el responsable de los datos personales: hace falta su aviso de privacidad y un acuerdo por escrito sobre quién recibe y resguarda los datos.
- **Límites**: Google limita el tamaño de cada hoja (10 millones de celdas) y el uso diario de Apps Script en cuentas gratuitas, y esos límites diarios se reparten entre todos los ayuntamientos de tu cuenta. Verifica los límites vigentes en la página de cuotas de Google Apps Script.
- El padrón integral de varios ayuntamientos (y el mapa) se arma en la Etapa 2 leyendo estas hojas; no hay que cambiar la captura.

## Menú Padrón (en la hoja central)
1. **Instalar** (una sola vez) · 2. **Nuevo ayuntamiento**: crea todo y muestra su enlace y la clave de su administrador · 3. **Nueva clave de administrador** (si se perdió; elige antes su fila en Ayuntamientos) · 4. **Actualizar Avance de todos**: hoja Avance en la hoja de cada ayuntamiento (personas, apoyos, montos, personas con apoyos de 2 o más áreas en el año, registros por capturista y por día) · 5. **Ubicar direcciones en el mapa (todos)**. El 4 y el 5 corren solos cada madrugada.

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

## Puesta en marcha (una sola vez en total)
1. Abre la hoja central "Padrón · Central" (carpeta 1.1.Plataforma) → **Extensiones → Apps Script**. Borra lo que haya, pega todo `Code.gs` y guarda.
2. Recarga la hoja. Menú **Padrón → 1. Instalar**. Acepta los permisos: Google avisará que la app no está verificada porque es tu propio script; elige *Avanzado → Continuar*.
3. En Apps Script: **Implementar → Nueva implementación → Aplicación web**. *Ejecutar como*: **Yo**. *Quién tiene acceso*: **Cualquier persona**. Implementar.
   - Si cambias el código después: **Implementar → Administrar implementaciones → editar → Nueva versión**, para conservar la misma URL y que los enlaces sigan sirviendo.

## Nuevo ayuntamiento (1 minuto)
1. Hoja central → **Padrón → 2. Nuevo ayuntamiento** → escribe su nombre como lo verán los capturistas (ej. *Ayuntamiento de Chiautzingo*).
2. Se crea sola su hoja "Padrón de beneficiarios · Chiautzingo" en la misma carpeta, su carpeta privada de fotos y su primera clave (administrador). Aparecen **el enlace de la app y la clave del administrador**: copia ambos (la clave no se vuelve a mostrar; el enlace queda en la hoja Ayuntamientos).
3. Entrega al administrador del ayuntamiento el enlace, su clave y el *Instructivo para capturistas*. Con su clave, en la app, él da las claves a sus capturistas (*Claves de capturistas*) e importa sus listas de Excel (*Importar lista de Excel*).
4. Opcional: en la hoja del ayuntamiento, **Catalogos** (municipio = `*`): localidades (tipo `localidad`), grupos (tipo `grupo`) y el **aviso de privacidad** (tipo `aviso`, texto completo en valor).
5. **Que el ayuntamiento vea su padrón**: botón **Compartir** de su hoja → correo de su enlace → *Lector*. Esa hoja es su padrón integral. Se descarga a Excel con Archivo → Descargar.

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

Solo el administrador del ayuntamiento ve esta opción. No hay que reacomodar nada: se salta las filas de título y reconoce nombres distintos para lo mismo (CURP, apellido paterno y materno con nombre(s) o nombre completo, género o sexo, fecha de nacimiento, calle, núm. ext., domicilio o dirección, colonia o barrio, comunidad, localidad o junta auxiliar, CP, teléfono o celular, correo, grupo, programa, tipo de apoyo o concepto, área o dependencia, monto o importe, fecha de entrega, latitud y longitud). Al terminar dice qué columna se usó para qué y cuáles se guardaron sin usar.
- Se une solo por CURP. Si el CURP viene mal escrito, la persona se importa sin CURP (folio `SC-`) y se anota en la columna `resultado` de la hoja Importar. Si faltan nacimiento o sexo y el CURP es válido, se toman del CURP. Se marca como repetido solo el mismo programa con la misma fecha.
- Si no encuentra la columna del nombre, lo dice con la lista de encabezados: cambia ese encabezado a `Nombre` en el Excel y vuelve a importarlo.

**Ubicar direcciones en el mapa (coordenadas)**
- Cada madrugada (o con el menú **Padrón → 5** de la hoja central) se convierte en coordenadas la dirección de cada persona que no las tenga (las importadas y las capturadas fuera del domicilio). Es gratis y usa el servicio de mapas de Google desde tu cuenta. Tiene un límite diario: lo que falte se sigue solo cada madrugada.
- En Padron, la columna `origen_ubicacion` dice de dónde salió cada punto: *GPS* (tomado en el domicilio), *Escrita a mano*, *Del Excel*, *Geocodificada* o *Pendiente*. La columna `precision` dice si la dirección se encontró exacta, por calle o solo aproximada (colonia o localidad).
- *No encontrada*: corrige la dirección en Padron, borra "No encontrada" y se reintenta esa madrugada.

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
