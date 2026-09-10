# Oportunidades: Empresa y Contacto contra catálogo maestro (Empresas / Clientes)

## Contexto y motivación

Hoy `Oportunidad.empresaNombre` es texto libre (el propio schema lo documenta: "texto libre,
sin catálogo en v1") y los contactos viven en `OportunidadContacto` (nombre, cargo, teléfono,
correo), desconectados del catálogo `Cliente` que usan Proyectos y Propuestas. Solo al llegar
a la etapa gancho (`Solicitud_RFP`) el código busca/crea una `Empresa` real para generar la
Propuesta — pero los contactos nunca se migran a `Cliente`, así que la Propuesta resultante
queda sin "Punto de contacto" (columna agregada en v1.8.2).

La sponsor del módulo (Yleana Paola Filian Tamayo) pidió que las empresas y puntos de contacto
que se registran en Oportunidades alimenten el mismo maestro-detalle que ya existe en el
módulo Clientes, para no perder un año de información comercial dispersa en dos sitios.

La tabla `oportunidades` está vacía en producción a la fecha de este diseño (10-sep-2026), por
lo que no se requiere migración de datos históricos.

## Decisiones (de la ronda de preguntas)

1. **Momento de exigencia**: el catálogo (Empresa + Cliente) es obligatorio **desde el primer
   registro** (etapa Prospección), no solo al llegar al gancho.
2. **Campo "Cargo"**: se agrega como columna opcional a `Cliente` — visible también en el
   módulo Clientes existente, no solo en Oportunidades.
3. **Datos históricos**: no aplica: no hay oportunidades registradas todavía. No se escribe
   script de migración.

## 1. Modelo de datos (`prisma/schema.prisma`)

### `Oportunidad`
- Se elimina `empresaNombre String @map("empresa_nombre")`.
- Se agrega `empresaId Int @map("id_empresa")` con relación obligatoria a `Empresa`.
- Se elimina la relación `contactos OportunidadContacto[]`.
- Se agrega la relación `clientes OportunidadCliente[]`.

### Nueva tabla `oportunidad_cliente` (pivote, mismo patrón que `proyecto_cliente` / `propuesta_cliente`)
```prisma
model OportunidadCliente {
  oportunidadId Int @map("id_oportunidad")
  clienteId     Int @map("id_cliente")

  oportunidad Oportunidad @relation(fields: [oportunidadId], references: [id], onDelete: Cascade)
  cliente     Cliente     @relation(fields: [clienteId], references: [id])

  @@id([oportunidadId, clienteId])
  @@map("oportunidad_cliente")
}
```

### `OportunidadContacto`
- Se elimina el modelo completo (y su tabla `oportunidad_contactos`).

### `Cliente`
- Se agrega `cargo String? @db.VarChar(100)`.
- Se agrega la relación inversa `oportunidades OportunidadCliente[]`.

### `Empresa`
- Se agrega la relación inversa `oportunidades Oportunidad[]` (ya tiene back-relations
  análogas para Proyectos/Propuestas/Clientes).

Estos cambios se aplican vía `prisma db push` (parte del script de build), sin necesidad de
`--accept-data-loss` más allá de lo ya configurado, dado que las tablas afectadas están vacías.

## 2. Backend

### `POST /api/v1/oportunidades` y `PUT /api/v1/oportunidades/:id`
- Reemplazan validación de `empresaNombre` (string no vacío) por `empresaId` (requerido,
  debe existir en `Empresa`).
- Reemplazan `contactos[]` (objetos nombre/cargo/telefono/correo) por `clienteIds[]` (array de
  IDs de `Cliente` existentes). Sync con `deleteMany` + `createMany` sobre
  `oportunidad_cliente`, igual que el patrón ya usado para pivots en Proyectos/Propuestas.
- Se elimina la lógica de "crear/matchear Empresa por nombre" en el flujo de creación normal —
  ya no aplica porque `empresaId` viene resuelto desde el formulario.

### `POST /api/v1/oportunidades` — creación directa en el gancho (`Solicitud_RFP`)
- Ya no necesita el parámetro `empresaId` especial de "confirmar cliente" (era para resolver
  el texto libre); usa directamente `datosBase.empresaId`.
- La Propuesta creada en la misma transacción copia `empresaId` **y** `clienteIds` de la
  oportunidad (antes solo copiaba `empresaId`, y ni siquiera eso cuando no se resolvía).

### `PATCH /api/v1/oportunidades/:id` — cambio de etapa al gancho
- Se elimina el parámetro `empresaId` del body (ya no hace falta preguntarlo: la oportunidad
  ya tiene su empresa fija desde que se creó).
- La transacción que crea la Propuesta ya no necesita `tx.empresa.findUnique` /
  `tx.empresa.create` — usa `oportunidad.empresaId` y copia `oportunidad.clientes` (vía la
  tabla pivote) hacia `propuesta.clientes`.

### `GET /api/v1/clientes` y `POST /api/v1/clientes` — fix de permisos (RBAC)
Siguiendo el patrón ya usado en `/api/v1/empresas` (documentado en CLAUDE.md §2.2), se cambia
el chequeo de permiso único `CLIENTES.VER` / `CLIENTES.CREAR` por un OR que incluye también
`PROYECTOS.VER`/`CREAR`, `PROPUESTAS.VER`/`CREAR` y `OPORTUNIDADES.VER`/`CREAR` — estos módulos
ya consumen (o van a consumir) el catálogo de Clientes como dropdown/multiselect y hoy fallan
en silencio para un usuario que solo tiene permiso sobre el módulo padre, no sobre Clientes.

## 3. UX / Formularios

### `OportunidadFormDialog.jsx`
- El `InputText` libre "Empresa / prospecto" se reemplaza por un `Dropdown` con buscador +
  opción "➕ Crear nueva empresa: '<texto escrito>'" — el mismo componente/patrón que hoy solo
  aparece condicionalmente cuando `etapa === ETAPA_HOOK`. Ahora es el campo principal, siempre
  visible, para cualquier etapa inicial.
- Se elimina la tabla de "Contactos" en texto libre (columnas Nombre/Cargo/Teléfono/Correo).
- Se agrega un `MultiSelect` de Clientes filtrado por la empresa elegida (idéntico al "Punto de
  contacto" ya implementado en `PropuestaFormDialog.jsx`), con opción inline "➕ Crear nuevo
  contacto" que abre un mini-formulario (nombre, apellido, teléfono, mail, cargo), hace
  `POST /api/v1/clientes` con el `empresaId` ya elegido, y agrega el nuevo id a la selección.
- Se retira todo el bloque condicional "Al crearla directamente en Solicitud de RFP..." con su
  selector de empresa — ya no aplica porque la empresa se elige arriba, siempre.

### `CambiarEtapaOportunidadDialog.jsx`
- Se elimina el bloque "Asignar propuesta al cliente" (Dropdown de empresa) del caso
  `esHook` — el mensaje informativo de que se generará la Propuesta se mantiene, sin pedir
  ningún dato adicional.

### Listado `/oportunidades` (`page.jsx`)
- Columna "Cliente": pasa de `r.empresaNombre` a `r.empresa?.nombre`.
- Columna "Contacto": pasa de `r.contactos?.[0]` a `r.clientes?.[0]?.cliente` (nombre +
  apellido + cargo), con el mismo indicador "+N más" si hay varios.
- `globalFilterFields` se ajusta de `['titulo', 'empresaNombre', 'contactoPrincipal']` a los
  campos derivados equivalentes sobre la nueva forma de datos.

### Detalle `/oportunidades/[id]` (`page.jsx`)
- Header: `oportunidad.empresaNombre` → `oportunidad.empresa.nombre`.
- Sección de contactos: itera `oportunidad.clientes` (vía pivote) en vez de
  `oportunidad.contactos`, mostrando nombre + apellido + cargo + teléfono + mail del `Cliente`.

### Módulo Clientes (`ClienteFormDialog.jsx` + tabla `/clientes`)
- Se agrega el campo "Cargo" (opcional) al formulario de creación/edición de Cliente.
- Se agrega la columna "Cargo" a la tabla de Clientes, igual que las demás columnas opcionales
  existentes (ej. `ciudad` en Empresas): visible siempre, mostrando "—" cuando está vacía.

## Fuera de alcance

- Migración de datos históricos (no aplica: tabla vacía).
- Deduplicación/fuzzy-matching de empresas existentes — la elección real vs. texto libre ya
  la resuelve el propio Dropdown con buscador.
- Cambios a los permisos de RBAC más allá del fix puntual de `/api/v1/clientes` descrito
  arriba (no se agregan permisos nuevos).
