# Módulo de Oportunidades — Diseño (Sprint 9 propuesto)

> Estado: v1 diseñada con el PM el 2026-09-03. Validada con Yleana Paola
> Filian Tamayo (comercial, usuaria del módulo) en sesión del 2026-09-04.
> Pendiente de implementación.

## 1. Contexto y motivación

Entró al equipo una nueva persona comercial (Yleana). Necesita un lugar donde
registrar, de forma muy rápida, cada prospecto/cliente nuevo con el que tiene
contacto, hacerle seguimiento (llamadas, correos, reuniones), visualizar en
qué etapa está cada oportunidad de su embudo comercial, y ver cuánto dinero
hay distribuido en cada etapa del pipeline. Cuando una oportunidad avanza lo
suficiente (el cliente pide formalmente una propuesta), el sistema debe
generar automáticamente el registro de **Propuesta** correspondiente (que ya
existe en GPRO desde el Sprint 8), evitando doble digitación.

Este módulo se ubica **antes** del módulo de Propuestas en el ciclo de vida
comercial:

```
Oportunidad ──(Solicitud de RFP)──→ Propuesta ──(Aprobada)──→ Proyecto
```

**Principio acordado con Yleana**: comercial y delivery deben ver siempre la
misma información — Oportunidades NO duplica el detalle de estados que ya
vive en Propuestas (RFI/RFP/negociación de contrato/firma). Oportunidades
cubre únicamente el tramo previo a que exista una propuesta formal; todo lo
que ocurre después (negociación de contrato, cierre, firma) se sigue
gestionando en el módulo de Propuestas, que ya tiene sus propios estados.

## 2. Decisiones de diseño (v1, validadas en sesión del 4/sep)

- **Captura libre de empresa**: la oportunidad NO depende de que la empresa
  exista en el catálogo (`empresas`). La comercial escribe el nombre del
  prospecto como texto libre. **v1 simplificado**: no se intenta resolver
  contra el catálogo ni deduplicar automáticamente al convertir a Propuesta
  — el mecanismo de conciliación con el catálogo se decide en una fase
  posterior. El único control es una regla de disciplina de captura: se pide
  escribir el nombre legal (RUC), no abreviaturas ni nombres comerciales,
  para minimizar duplicados manualmente.
- **Contactos múltiples por oportunidad**: una oportunidad puede tener **N
  contactos** (no uno solo), cada uno con nombre, **cargo/rol**, teléfono y
  correo. El cargo importa porque indica con qué nivel jerárquico del
  cliente se está construyendo la relación.
- **6 etapas de pipeline** (terminología alineada a la de Yleana, no la
  simplificación genérica de la v0):
  `Prospección → Solicitud de RFI → Entrega de RFI → Solicitud de RFP`
  (secuencia principal), más dos estados laterales alcanzables desde
  cualquiera de las tres primeras: `En Suspenso` y `Perdida`. Ambos son
  **reversibles** — pueden volver a cualquier etapa activa más adelante.
- **`Solicitud de RFP` es el gancho**: es el momento en que el cliente pide
  formalmente una propuesta. Al llegar aquí, la oportunidad se convierte
  automáticamente en Propuesta — no representa "negocio ganado" (eso se
  decide después, dentro de Propuestas).
- **Sin umbral de "estancada"**: se descarta la idea de un número de días
  fijo (7, 30, etc.) para alertar sobre inactividad. Yleana maneja ciclos de
  venta de 3 a 6 meses como algo normal, así que cualquier umbral fijo sería
  arbitrario. Para v1 solo se muestra "última actividad: hace X días" como
  dato informativo — la comercial decide con su propio criterio si una
  oportunidad está estancada o no. (Puede revisitarse en una fase futura si
  se detecta la necesidad real.)
- **Gráfica de pipeline por valor**: barra simple, etapa en el eje X,
  valor estimado sumado en el eje Y — para ver en qué etapa está concentrado
  el dinero del embudo. Requerido explícitamente por Yleana y confirmado
  como parte del alcance de v1 (no se pospone).
- **Conversión automática total**: al mover una oportunidad a `Solicitud de
  RFP`, el sistema crea la Propuesta en una sola transacción, sin pantalla
  intermedia de confirmación (mismo patrón que Propuesta Aprobada →
  Proyecto).
- **Vista de lista tipo DataTable** (no Kanban), consistente con el resto
  del sistema (Propuestas, Proyectos). Un tablero Kanban con drag&drop queda
  como posible fase 2 si el volumen de oportunidades lo justifica.
- **Filosofía de v1**: "primero funcional, después mejoramos" (instrucción
  explícita del PM). No se sobre-diseña resolución de duplicados, umbrales
  configurables, ni reglas de transición rígidas — ver sección 8.

## 3. Modelo de datos

### 3.1 `oportunidades`

| Campo | Tipo | Notas |
|---|---|---|
| id | SERIAL PK | |
| titulo | VARCHAR(255) NOT NULL | asunto de la oportunidad (ej. "Consultoría de procesos") |
| empresaNombre | VARCHAR(150) NOT NULL | texto libre, nombre legal/RUC (regla de captura, no validación de sistema) |
| origen | VARCHAR(50) | opcional — Referido / LinkedIn / Networking / Web / Llamada fría / Otro |
| descripcion | TEXT | opcional |
| valorEstimado | DECIMAL(12,2) | opcional, editable en cualquier etapa activa — alimenta el gráfico de pipeline |
| etapa | VARCHAR(30) NOT NULL DEFAULT 'Prospeccion' | ver RN-O01/02 |
| motivoPerdida | TEXT | opcional, solo aplica si etapa = Perdida |
| responsableId | INT FK → users | comercial a cargo |
| propuestaId | INT FK → propuestas, UNIQUE, NULLABLE | se llena al llegar a Solicitud de RFP (RN-O04) |
| fechaCreacion | DATE NOT NULL | |
| createdAt / updatedAt | TIMESTAMP | |

### 3.2 `oportunidad_contactos`

Reemplaza los campos planos de contacto de la v0 — una oportunidad puede
tener varios.

| Campo | Tipo | Notas |
|---|---|---|
| id | SERIAL PK | |
| oportunidadId | FK → oportunidades, ON DELETE CASCADE | |
| nombre | VARCHAR(150) NOT NULL | |
| cargo | VARCHAR(100) | opcional — rol/posición dentro de la empresa |
| telefono | VARCHAR(20) | opcional |
| correo | VARCHAR(200) | opcional |
| createdAt / updatedAt | TIMESTAMP | |

### 3.3 `oportunidad_seguimientos` (INMUTABLE)

Mismo patrón que `observaciones` (RN-03 del sistema).

| Campo | Tipo | Notas |
|---|---|---|
| id | SERIAL PK | |
| oportunidadId | FK → oportunidades | |
| descripcion | TEXT NOT NULL | ej. "Llamada de seguimiento, cliente pide propuesta formal" |
| userId | FK → users | del token, NUNCA del body |
| createdAt | TIMESTAMP | solo insert |

Solo existen endpoints `POST` y `GET`. Sin `PUT` ni `DELETE`.

### 3.4 `oportunidad_estado_logs` (INMUTABLE)

Mismo patrón que `propuesta_estado_logs`.

| Campo | Tipo | Notas |
|---|---|---|
| id | SERIAL PK | |
| oportunidadId | FK → oportunidades | |
| estadoAnterior | VARCHAR(30) NULLABLE | |
| estadoNuevo | VARCHAR(30) NOT NULL | |
| userId | FK → users | |
| nota | TEXT | opcional (incluye `motivoPerdida` cuando aplica) |
| createdAt | TIMESTAMP | |

## 4. Reglas de negocio (RN-O)

- **RN-O01**: la etapa inicial siempre es `Prospeccion`. No se puede crear
  una oportunidad en otra etapa.
- **RN-O02**: modelo de transición **flexible** para v1 (no una máquina de
  estados estricta): desde `Prospeccion`, `Solicitud_RFI` o `Entrega_RFI` se
  puede mover libremente entre esas tres, o pasar a `En_Suspenso` o
  `Perdida`. Desde `En_Suspenso` o `Perdida` se puede **reactivar** de vuelta
  a cualquiera de las tres etapas activas (ambas son reversibles, confirmado
  explícitamente por el PM). La transición a `Solicitud_RFP` solo es válida
  desde las tres etapas activas y dispara RN-O04 de inmediato.
- **RN-O03**: solo se puede eliminar una oportunidad si su etapa es
  `Prospeccion`, `Solicitud_RFI` o `Entrega_RFI` (no si ya generó una
  Propuesta, ni si está Perdida — para conservar el historial).
- **RN-O04**: al pasar a `Solicitud_RFP`, transacción atómica:
  1. Crea `Empresa` nueva usando `oportunidad.empresaNombre` tal cual fue
     escrito — **v1 no intenta hacer match contra el catálogo existente**
     (ver sección 8, riesgo de duplicados aceptado conscientemente por
     ahora).
  2. Crea `Propuesta`: `titulo` = `oportunidad.titulo`, `empresaId` = la
     empresa recién creada, `valorEstimado` = `oportunidad.valorEstimado`,
     `descripcion` = `oportunidad.descripcion` + contactos, `fechaCreacion`
     = hoy, `estado` = `Factibilidad`.
  3. Actualiza `oportunidad.propuestaId` con el id de la nueva propuesta.
  4. Registra log de oportunidad (etapa anterior → `Solicitud_RFP`) y el log
     inicial estándar de la propuesta (ya existente desde Sprint 8).
  5. La respuesta del endpoint incluye `{ data, propuestaCreada: true,
     propuestaId, message }` para que el frontend muestre un toast especial
     con link a la propuesta generada.
- **RN-O05**: al pasar a `Perdida`, se solicita `motivoPerdida` (campo de
  texto recomendado pero no bloqueante) en el mismo diálogo de cambio de
  etapa.
- **RN-O06**: los logs de `oportunidad_estado_logs` y los registros de
  `oportunidad_seguimientos` son inmutables — solo INSERT, nunca UPDATE ni
  DELETE, igual que el resto del sistema (RN-03, RN-P06).
- **RN-O07**: la vista muestra "última actividad: hace N días" (calculado
  desde el seguimiento más reciente, o desde `fechaCreacion` si no tiene
  ninguno) como **dato informativo, sin umbral ni alerta automática**. No
  hay concepto de "estancada" en v1.
- **RN-O08**: la metadata (título, empresa, contactos, valor, descripción,
  origen) es editable mientras la oportunidad no tenga `propuestaId`
  asignado (es decir, mientras no haya llegado a `Solicitud_RFP`).
- **RN-O09**: el detalle de una oportunidad con `propuestaId` muestra el
  **estado actual** de esa Propuesta (no solo que fue creada), para que la
  comercial pueda seguir el avance sin salir de Oportunidades — evita
  duplicar información entre los dos módulos, principio remarcado por
  Yleana en la sesión de validación.

## 5. API (Next.js App Router, mismo formato de respuesta del sistema)

- `GET /api/v1/oportunidades?etapa=&responsable_id=` — lista con
  responsable, contactos, propuesta vinculada (con su estado actual, si
  existe), y `ultimoSeguimiento`.
- `POST /api/v1/oportunidades` — crea en etapa `Prospeccion` con su arreglo
  de contactos (`contactos[]`, al menos uno recomendado pero no bloqueante),
  registra log inicial.
- `GET /api/v1/oportunidades/:id` — detalle con contactos, seguimientos y
  logs de etapa.
- `PUT /api/v1/oportunidades/:id` — edita metadata y sincroniza contactos
  (`deleteMany` + `createMany`, mismo patrón que pivots de Proyecto) — válido
  según RN-O08.
- `DELETE /api/v1/oportunidades/:id` — valida RN-O03.
- `PATCH /api/v1/oportunidades/:id` — cambia etapa, ejecuta RN-O04 si el
  destino es `Solicitud_RFP`.
- `GET /api/v1/oportunidades/:id/seguimientos` · `POST
  /api/v1/oportunidades/:id/seguimientos` — RN-O06 / patrón observaciones.
- `GET /api/v1/oportunidades/kpis` — conteo por etapa, tasa de conversión a
  Propuesta, y suma de `valorEstimado` por etapa (para el gráfico de
  pipeline).

Todos los endpoints protegidos con `getServerSession` + verificación de
permiso puntual (ver sección 5.1), formato de respuesta
`{ success, data, message }` / `{ success: false, message, errors }`.

## 5.1 Permisos (RBAC — se integra al sistema existente, no uno nuevo)

GPRO ya tiene un módulo de Perfiles de Acceso (`src/lib/permisos.js` +
`/perfiles`). Oportunidades se suma ahí con el mismo patrón que usan
Proyectos y Propuestas — no se crea un mecanismo de permisos aparte.

- **`src/lib/permisos.js`** — nueva entrada en `PERMISOS`:
  ```js
  OPORTUNIDADES: {
    VER:            'oportunidades.ver',
    CREAR:          'oportunidades.crear',
    EDITAR:         'oportunidades.editar',
    ELIMINAR:       'oportunidades.eliminar',
    CAMBIAR_ETAPA:  'oportunidades.cambiarEtapa',
  },
  ```
  (mismo esquema que `PROPUESTAS`, con `CAMBIAR_ETAPA` jugando el rol que
  `CAMBIAR_ESTADO` juega en Propuestas).
- **`/perfiles`** — nueva fila en la matriz `MODULOS` (`page.jsx`) para que
  un admin pueda otorgar estos permisos por perfil:
  ```js
  {
    key: 'oportunidades',
    label: 'Oportunidades',
    acciones: [
      { key: 'ver', label: 'Ver' },
      { key: 'crear', label: 'Crear' },
      { key: 'editar', label: 'Editar' },
      { key: 'eliminar', label: 'Eliminar' },
    ],
    especiales: [{ key: 'cambiarEtapa', label: 'Cambiar Etapa' }],
  }
  ```
- **API**: cada endpoint valida con `tienePermiso(session,
  PERMISOS.OPORTUNIDADES.X)` antes de ejecutar la acción — `admin` siempre
  pasa, igual que en el resto del sistema. El `PATCH` de cambio de etapa
  valida específicamente `CAMBIAR_ETAPA` (no `EDITAR`), igual que
  Propuestas separa "editar metadata" de "cambiar estado".
- **Sidebar** (`layout.jsx`): el ítem "Oportunidades" se filtra con
  `permiso: 'oportunidades.ver'`, mismo mecanismo que ya oculta/muestra
  Propuestas, Proyectos, etc. según el perfil del usuario.
- **UI de la página**: botones "Nueva Oportunidad" / "Editar" / "Eliminar" /
  "Cambiar etapa" condicionados con `usePermisos().puede(...)`, igual patrón
  que `propuestas/page.jsx` (`puede(PERMISOS.PROPUESTAS.CREAR)`, etc.).

## 6. UI

- Nuevo ítem **"Oportunidades"** en el sidebar, sección Principal, entre
  **Dashboard** y **Propuestas**, visible solo con permiso
  `oportunidades.ver` (ver sección 5.1).
- `/oportunidades`: pastillas de KPI en la cabecera (conteo por etapa +
  tasa de conversión a Propuesta, sin badge de alerta — ya no hay concepto
  de estancada) + **gráfica de barras de pipeline por valor** + filtros
  (buscador, etapa, responsable) + DataTable con columnas
  Oportunidad/Contacto (principal + "+N más" si hay varios)/Origen/Etapa
  (Tag)/Valor est./Responsable/Última actividad/Acciones.
- `/oportunidades/[id]`: datos generales, lista de **contactos** (tarjetas
  con nombre/cargo/teléfono/correo), card de seguimientos (timeline, con
  diálogo "Agregar seguimiento"), timeline de trazabilidad de etapa, botón
  de "Cambiar etapa", y card "Propuesta generada" con el **estado actual**
  de la propuesta vinculada (RN-O09) si `propuestaId` existe.
- Diálogos:
  - `OportunidadFormDialog`: título, empresa (con hint de "nombre legal, no
    nombre comercial"), **lista dinámica de contactos** (agregar/quitar),
    origen, valor estimado, descripción.
  - `CambiarEtapaOportunidadDialog`: selector de las 6 etapas (excluyendo la
    actual), aviso especial si el destino es `Solicitud de RFP` ("se
    generará una Propuesta automáticamente"), aviso de que `En Suspenso` es
    reversible, campo `motivoPerdida` si el destino es `Perdida`, nota
    opcional.
- Paleta de etapas (`<Tag severity="">`):
  ```js
  const ETAPA_CONFIG = {
    'Prospeccion':     { severity: 'secondary', label: 'Prospección' },
    'Solicitud_RFI':   { severity: 'warning',   label: 'Solicitud de RFI' },
    'Entrega_RFI':     { severity: 'info',      label: 'Entrega de RFI' },
    'Solicitud_RFP':   { severity: 'success',   label: 'Solicitud de RFP' },
    'En_Suspenso':     { severity: 'help',      label: 'En Suspenso' }, // violeta
    'Perdida':         { severity: 'danger',    label: 'Perdida' },
  }
  ```

## 7. Historias de usuario (Sprint 9 propuesto — 45 pts)

| ID | Título | Story Points | Prioridad |
|----|--------|--------------|-----------|
| SP9-01 | Schema BD (4 tablas nuevas) | 3 | Alta |
| SP9-02 | API CRUD Oportunidades + Contactos | 8 | Alta |
| SP9-03 | API Cambio de Etapa + conversión automática a Propuesta | 8 | Alta |
| SP9-04 | API Seguimientos (solo insert) | 3 | Alta |
| SP9-05 | Lista de Oportunidades + KPIs + gráfica de pipeline | 8 | Alta |
| SP9-06 | Detalle de Oportunidad (contactos + trazabilidad + seguimientos) | 6 | Media |
| SP9-07 | Dialogs (Form con contactos dinámicos + CambiarEtapa + AgregarSeguimiento) | 6 | Alta |
| SP9-08 | Permisos granulares en RBAC (`PERMISOS.OPORTUNIDADES` + matriz de `/perfiles`) | 3 | Alta |

**SP9-01 Criterios:** 4 tablas nuevas vía `prisma db push` · relación
`Oportunidad → OportunidadContacto[]` (1 a N) · `User → Oportunidad[]`
(responsable) · `Propuesta ↔ Oportunidad` (1 a 1 opcional vía
`propuestaId`).

**SP9-02 Criterios:** GET lista filtrada con `ultimoSeguimiento` calculado y
contactos incluidos · POST valida `titulo`/`empresaNombre` requeridos, al
menos estructura válida de `contactos[]`, etapa forzada a `Prospeccion` ·
PUT sincroniza contactos y bloquea edición si ya tiene `propuestaId`
(RN-O08) · DELETE valida RN-O03.

**SP9-03 Criterios:** transición libre entre etapas activas y reversible
desde En Suspenso/Perdida (RN-O02) · ejecución atómica de RN-O04 con Prisma
`$transaction` al llegar a `Solicitud_RFP` · retorna `propuestaCreada` para
el toast especial del frontend.

**SP9-04 Criterios:** ⚠️ Solo POST y GET · DELETE/PUT retornan 405 ·
`userId` del token · ordenado DESC.

**SP9-05 Criterios:** pastillas KPI por etapa + tasa de conversión a
Propuesta · gráfica de barras horizontal, etapa en eje vertical y valor en
la longitud de la barra, excluyendo `Perdida` del total de pipeline abierto
· DataTable con buscador global y filtro por etapa/responsable · botón
"Nueva Oportunidad".

**SP9-06 Criterios:** lista de contactos con cargo visible · timeline de
seguimientos sin botones editar/eliminar (inmutables) · timeline de cambios
de etapa con usuario/fecha/nota · card de "Propuesta generada" mostrando el
**estado actual** de la propuesta (RN-O09), no solo la fecha de creación.

**SP9-08 Criterios:** `PERMISOS.OPORTUNIDADES` agregado a
`src/lib/permisos.js` (VER/CREAR/EDITAR/ELIMINAR/CAMBIAR_ETAPA) · nueva fila
en `MODULOS` de `/perfiles` para asignar estos permisos por perfil · ítem de
sidebar y botones de acción (Nueva/Editar/Eliminar/Cambiar etapa)
condicionados con `usePermisos().puede(...)` · endpoints validan el permiso
correspondiente con `tienePermiso()`, `admin` bypasea siempre — todo
siguiendo el patrón ya existente de Proyectos/Propuestas (sección 5.1), sin
tabla ni mecanismo de permisos nuevo.

**SP9-07 Criterios:** el formulario permite agregar/quitar contactos
dinámicamente (mínimo 1 fila siempre visible) · `CambiarEtapaOportunidadDialog`
muestra aviso especial cuando el destino es `Solicitud de RFP` · campo
`motivoPerdida` visible solo cuando el destino es `Perdida` · aviso de
reversibilidad cuando el destino es `En Suspenso`.

## 8. Fuera de alcance en v1 (decisión explícita del PM: "funcional primero, mejoramos después")

- **Vinculación/deduplicación automática contra el catálogo de Empresas al
  convertir a Propuesta.** V1 crea una Empresa nueva con el nombre tal cual
  fue escrito en la oportunidad. El riesgo de duplicados (ej. "FEMSA" vs
  "Femsa S.A.") se acepta conscientemente por ahora; se resolverá en una
  fase posterior, posiblemente con un paso de confirmación/selección manual
  al momento de la conversión.
- **Umbral o alerta automática de "oportunidad estancada".** Se mostrará la
  información de última actividad, pero sin badge, color de alerta ni
  cálculo de umbral — decisión explícita de no construir esto todavía.
- Tablero Kanban con drag & drop entre etapas.
- Recordatorios automáticos de seguimiento (email) — podría reusar
  `src/lib/email.js` del Sprint 6.
- Múltiples responsables por oportunidad (hoy: 1 solo).
- Reglas de transición de etapa más estrictas (por ahora es un modelo
  flexible, pensado para una sola persona comercial que conoce su propio
  proceso).

## 9. Historial de decisiones

- **2026-09-03**: diseño inicial v0 con el PM (5 etapas genéricas, contacto
  único, umbral de estancada a 7 días, conversión al marcar "Ganada").
- **2026-09-04**: sesión de validación con Yleana Paola Filian Tamayo
  (comercial). Se revisan y ajustan: nomenclatura real de etapas
  (Prospección/RFI/RFP, alineada al Excel de sales stages que ya manejaba
  el equipo comercial), contactos múltiples con cargo, remoción del umbral
  de estancada, adición de la gráfica de pipeline por valor, adición del
  estado "En Suspenso" (reversible), renombre del gancho de "Ganada" a
  "Solicitud de RFP", y simplificación del modelo de empresa (sin matching
  automático en v1). El PM confirma estos cambios directamente tras la
  sesión (2026-09-04).
- **2026-09-07**: se descubre que el PM ya tiene un flujo de despliegue real
  vigente (Azure App Service `gpro-app` vía GitHub Actions desde
  `main-azure`) y que Vercel se usará como entorno de prueba previo. El spec
  se re-basa sobre el código real de `main-azure` (que incluye RBAC de
  Sprint 11, no presente en la versión de CLAUDE.md leída originalmente). Se
  agrega la sección 5.1: Oportunidades debe integrarse al sistema de
  Perfiles de Acceso existente (`PERMISOS.OPORTUNIDADES` +
  fila en la matriz de `/perfiles`), no crear un mecanismo de permisos
  aparte. Nueva historia SP9-08.
