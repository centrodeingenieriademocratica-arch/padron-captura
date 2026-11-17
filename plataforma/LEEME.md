# Plataforma nueva · Padrón Único Municipal de Beneficiarios

Reemplaza a la app de captura v13 (archivos de la raíz del repositorio), que sigue en uso mientras esta se termina. El plan completo está en `requerimientos/PLAN_POR_FASES.md`, en la carpeta del proyecto.

## Cómo está armada

- **servidor/Codigo.gs**: Apps Script de **un** ayuntamiento, pegado en su hoja, que vive en una cuenta de Google gratuita del ayuntamiento. Menú *Padrón → 1. Configurar* crea las pestañas, los catálogos base y el enlace del administrador.
- **app/** (paso siguiente): app instalable en Firebase Hosting, con un enlace corto por ayuntamiento. Funciona sin señal y envía lotes de operaciones al servidor.
- **pruebas/**: un simulador de Apps Script para probar el servidor sin Google. Se corre con `node plataforma/pruebas/servidor.test.js`.

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
- Cada usuario solo opera los programas de sus áreas. Quien captura solo recibe nombre y localidad al buscar.
- Los casos confidenciales solo los encuentra su área.
- Las correcciones directas son del administrador o del responsable del área, con motivo. Quien captura pide la corrección.

Estado: probado solo en el simulador (23 pruebas). **No probado en Google real.**
