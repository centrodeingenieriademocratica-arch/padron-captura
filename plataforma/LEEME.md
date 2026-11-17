# Plataforma nueva · Padrón Único Municipal de Beneficiarios

Reemplaza a la app de captura v13 (archivos de la raíz del repositorio), que sigue en uso mientras esta se termina. El plan completo está en `requerimientos/PLAN_POR_FASES.md`, en la carpeta del proyecto.

## Cómo está armada

- **servidor/Cargador.gs**: lo único que se pega en cada ayuntamiento. Toma del sitio del padrón en Cloudflare la versión maestra (`Codigo.gs`) y la renueva cada 6 horas, así cada mejora llega sola a todos los municipios, cada uno desde su propia cuenta.
- **admin/**: «CID Admin Beneficiarios», la app de mando de la usuaria (celular, padron-cid.pages.dev/admin). Números de todos los municipios, lo vencido y lo que requiere atención, vista completa de administrador de cada uno y «ver como» cualquier rol, solo para mirar (el servidor no deja guardar ni cambiar nada con esos enlaces). Las claves se guardan solo en su celular, cifradas con su PIN.
- **cloudflare/**: el sitio del padrón en Cloudflare Pages (se publica solo desde main): app de mando, versión maestra, app del celular y `functions/api/registro.js`, el registro donde cada municipio se anota solo al abrirse (nombre y dirección, sin claves; guardado en Cloudflare KV). La app de mando lee la lista con la clave del registro. Nada vive en la cuenta Google del CID.
- **servidor/Codigo.gs** (versión maestra): Apps Script de **un** ayuntamiento, pegado en su hoja, que vive en una cuenta de Google gratuita del ayuntamiento. Menú *Padrón → 1. Configurar* crea las pestañas, los catálogos base y el enlace del administrador. Cómo instalarlo: `INSTALAR.md`.
- **app/**: la app para celular. Como en la herramienta de estructura, la sirve el propio Apps Script del ayuntamiento en su dirección `/exec?u=CODIGO`. El servidor la toma del sitio de Cloudflare y la renueva cada 6 horas, así que las mejoras llegan a todos sin volver a pegar nada. Abierta como archivo suelto, sin servidor, funciona en modo de muestra.
  - Buscar persona, alta (persona, hogar, grupo, institución, obra o unidad productiva; menor con tutor; CURP llena fecha y sexo), entrega en 3 pasos (quién recibe, apoyo y cantidad, evidencia: foto, firma, "no sabe firmar", folio de lista en papel, ubicación), entrega en evento o fila, solicitudes, pendientes y administración (programas, eventos, lotes, usuarios).
  - Todo se guarda primero en el teléfono y se envía solo cuando hay señal; si se envía dos veces no se duplica.
- **pruebas/**: un simulador de Apps Script para probar sin Google.
  - `node plataforma/pruebas/servidor.test.js`: reglas del servidor.
  - `node plataforma/pruebas/app.e2e.js`: la app completa en un navegador sin pantalla (administrador y capturista, sin señal y con señal).
  - `node plataforma/pruebas/cargador.test.js`: el cargador.
  - `node plataforma/pruebas/registro-cloudflare.test.js`: el registro de municipios.
  - `node plataforma/pruebas/admin.e2e.js`: la app de mando con dos municipios simulados.
  - `node plataforma/pruebas/servidor-local.js`: abre la app con el servidor simulado en http://localhost:8080 para revisarla a mano.

## Modelo de datos (una pestaña por tabla)

| Pestaña | Para qué |
|---|---|
| Config | Nombre del ayuntamiento, dirección de la app, carpeta de evidencias |
| Usuarios | Enlace personal (solo se guarda su huella), rol (admin, responsable, capturista, consulta) y áreas |
| Catalogos | Áreas, tipos de beneficiario y de apoyo, unidades, periodicidades, grupos poblacionales, etc. |
| Programas | La plantilla de cada apoyo: área, unidad, monto unitario, periodicidad, fuente, evidencia exigida, si es confidencial |
| Beneficiarios | Persona, hogar, grupo, institución, territorio o unidad productiva; CURP opcional; ubicación o "pendiente" |
| Integrantes | Quién pertenece a un hogar, grupo o institución; tutor de un menor |
| Eventos | Se dan de alta una vez; las entregas se ligan a ellos |
| Entregas | Cada apoyo entregado: cantidad, monto, periodo, evidencia, representante, alerta |
| Solicitudes | Quien pidió y aún no recibe, con su estatus |
| Lotes | Inventario: lo comprado contra lo entregado |
| Alias | Cuando dos teléfonos dieron de alta a la misma persona (mismo CURP) |
| Operaciones | Cada envío del teléfono, para no duplicar si llega dos veces |
| Bitacora | Quién hizo qué, cuándo, valor anterior y motivo. Nada se borra |

## Reglas que ya cumple el servidor

- Mismo CURP es la misma persona: no se duplica, aunque se capture en dos teléfonos sin señal.
- Sin CURP, nunca se une por nombre: si el nombre y la fecha de nacimiento coinciden, se guarda en "Revisar".
- Ninguna regla bloquea una entrega real. Entrega repetida en el periodo, lote agotado o falta de evidencia se guardan con alerta.
- Cada entrega se descuenta sola del primer lote del programa que tenga existencia.
- Cada usuario solo opera los programas de sus áreas. Quien captura solo recibe nombre y localidad al buscar.
- Los casos confidenciales solo los encuentra su área.
- Las correcciones directas son del administrador o del responsable del área, con motivo. Quien captura pide la corrección.

Estado: probado solo en el simulador (28 pruebas del servidor y 14 de la app). **No probado en Google real ni en un teléfono real.**
