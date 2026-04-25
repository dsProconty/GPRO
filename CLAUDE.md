# GPRO — Gestor de Proyectos · Proconty
> Archivo de contexto para Claude Code. Leer completo antes de generar cualquier código.

---

## 1. VISIÓN GENERAL

GPRO es un sistema de gestión de proyectos de consultoría para Proconty.
Administra el ciclo de vida completo: desde la prefactibilidad hasta el cierre,
incluyendo facturación y registro de pagos.

**URL producción:** https://gpro.vercel.app  
**Repo:** https://github.com/dsProconty/GPRO  
**Deploy:** Vercel (auto-deploy en push a `main`)

---

## 2. STACK TECNOLÓGICO

| Capa | Tecnología | Notas |
|------|-----------|-------|
| Framework | Next.js 14 (App Router) | Frontend + Backend en uno |
| UI | PrimeReact 10 + PrimeFlex + PrimeIcons | Componentes listos |
| Auth | NextAuth.js v4 | Sesión JWT, 8h |
| ORM | Prisma 5 | Client en `src/lib/prisma.js` |
| Base de datos | PostgreSQL (Neon serverless) | Variables en Vercel |
| Deploy | Vercel | Región iad1 (US East) |
| Estilos | PrimeFlex utility classes | Sin CSS custom salvo excepciones |

### Variables de entorno (ya configuradas en Vercel)
```
DATABASE_URL=postgresql://neondb_owner:...@ep-rough-feather...neon.tech/neondb?sslmode=require
NEXTAUTH_SECRET=pbhO5JLv...
NEXTAUTH_URL=https://gpro.vercel.app
```

---

## 3. ESTRUCTURA DE ARCHIVOS

```
GPRO/
├── CLAUDE.md                          ← este archivo
├── package.json
├── next.config.js                     ← alias @ → src/
├── jsconfig.json                      ← paths @/*
├── vercel.json
├── middleware.js                      ← protege rutas /dashboard, /proyectos, etc.
├── prisma/
│   ├── schema.prisma                  ← modelos de todas las tablas
│   └── seed.js
└── src/
    ├── app/
    │   ├── layout.jsx                 ← Root layout con PrimeReact + Providers
    │   ├── page.jsx                   ← Redirect a /dashboard o /login
    │   ├── (auth)/
    │   │   └── login/page.jsx         ← Pantalla de login
    │   ├── (dashboard)/
    │   │   ├── layout.jsx             ← Sidebar + Topbar (Sakai style)
    │   │   ├── dashboard/page.jsx     ← Home con KPIs (Sprint 2)
    │   │   ├── empresas/              ← Sprint 1
    │   │   │   ├── page.jsx
    │   │   │   └── [id]/page.jsx
    │   │   ├── clientes/              ← Sprint 1
    │   │   │   └── page.jsx
    │   │   ├── proyectos/             ← Sprint 2
    │   │   │   ├── page.jsx
    │   │   │   └── [id]/page.jsx
    │   │   ├── propuestas/            ← Sprint 8
    │   │   │   ├── page.jsx
    │   │   │   └── [id]/page.jsx
    │   │   └── (facturas y pagos dentro de proyectos/[id]) ← Sprint 3
    │   └── api/
    │       ├── auth/[...nextauth]/route.js
    │       └── v1/
    │           ├── empresas/          ← Sprint 1
    │           ├── clientes/          ← Sprint 1
    │           ├── proyectos/         ← Sprint 2
    │           ├── facturas/          ← Sprint 3
    │           ├── pagos/             ← Sprint 3
    │           ├── observaciones/     ← Sprint 4
    │           └── propuestas/        ← Sprint 8
    ├── lib/
    │   ├── prisma.js                  ← Singleton Prisma client
    │   └── auth.js                    ← NextAuth config (authOptions)
    ├── components/
    │   ├── providers.jsx              ← SessionProvider wrapper
    │   └── shared/                    ← Componentes reutilizables (Sprint 2+)
    ├── services/                      ← axios helpers por entidad (Sprint 1+)
    └── utils/
        └── format.js                  ← formatCurrency, formatDate (Sprint 1+)
```

---

## 4. MODELO DE DATOS (Tablas ya creadas en Neon)

### 4.1 users
| Campo | Tipo | Notas |
|-------|------|-------|
| id | SERIAL PK | |
| name | VARCHAR(150) | |
| email | VARCHAR(200) UNIQUE | |
| password | TEXT | bcrypt hash |
| role | VARCHAR(50) | default 'user' |
| created_at / updated_at | TIMESTAMP | |

### 4.2 empresas
| Campo | Tipo | Notas |
|-------|------|-------|
| id_empresa | SERIAL PK | |
| nombre | VARCHAR(150) NOT NULL | |
| ciudad | VARCHAR(100) | opcional |
| created_at / updated_at | TIMESTAMP | |

### 4.3 clientes
| Campo | Tipo | Notas |
|-------|------|-------|
| id_cliente | SERIAL PK | |
| nombre | VARCHAR(100) NOT NULL | |
| apellido | VARCHAR(100) NOT NULL | |
| telefono | VARCHAR(20) | opcional |
| mail | VARCHAR(200) | opcional |
| id_empresa | FK → empresas | requerido |

### 4.4 estados (catálogo — ya seedeado)
| id_estado | nombre | color PrimeReact |
|-----------|--------|-----------------|
| 1 | Prefactibilidad | warning |
| 2 | Elaboracion_Propuesta | info |
| 3 | Adjudicado | success |
| 4 | Rechazado | danger |
| 5 | Cerrado | secondary |

### 4.5 proyectos
| Campo | Tipo | Notas |
|-------|------|-------|
| id_negocio | SERIAL PK | |
| detalle | VARCHAR(255) NOT NULL | nombre del proyecto |
| id_empresa | FK → empresas | 1 sola empresa |
| valor | DECIMAL(12,2) | valor total del contrato |
| fecha_creacion | DATE NOT NULL | |
| fecha_cierre | DATE | opcional |
| id_estado | FK → estados | |
| project_online | VARCHAR(500) | URL externa, opcional |
| created_at / updated_at | TIMESTAMP | |
| **facturado** | ⚠️ CALCULADO | SUM(facturas.valor) — NUNCA guardar en BD |
| **pagado** | ⚠️ CALCULADO | SUM(pagos.valor) — NUNCA guardar en BD |
| **tiempo_vida** | ⚠️ CALCULADO | fecha_cierre - fecha_creacion (o hoy si no hay cierre) |

### 4.6 proyecto_cliente (pivot)
| Campo | Tipo |
|-------|------|
| id_negocio | FK → proyectos |
| id_cliente | FK → clientes |
| PK compuesta | (id_negocio, id_cliente) |

### 4.7 proyecto_responsable (pivot)
| Campo | Tipo |
|-------|------|
| id_negocio | FK → proyectos |
| id_user | FK → users |
| PK compuesta | (id_negocio, id_user) |

### 4.8 facturas
| Campo | Tipo | Notas |
|-------|------|-------|
| id_factura | SERIAL PK | |
| num_factura | VARCHAR(50) UNIQUE | formato SRI: 001-001-XXXXXXX |
| id_negocio | FK → proyectos | |
| orden_compra | VARCHAR(50) | opcional |
| valor | DECIMAL(12,2) NOT NULL | |
| fecha_factura | DATE NOT NULL | |
| observacion | TEXT | opcional |
| created_at / updated_at | TIMESTAMP | |
| **total_pagos** | ⚠️ CALCULADO | SUM(pagos.valor) — NUNCA guardar en BD |
| **saldo** | ⚠️ CALCULADO | valor - total_pagos — NUNCA guardar en BD |

### 4.9 pagos
| Campo | Tipo | Notas |
|-------|------|-------|
| id_pago | SERIAL PK | |
| valor | DECIMAL(12,2) NOT NULL | > 0, no puede superar saldo de factura |
| fecha | DATE NOT NULL | |
| id_factura | FK → facturas | |
| observacion | TEXT | opcional |
| created_at / updated_at | TIMESTAMP | |

### 4.10 observaciones (INMUTABLES)
| Campo | Tipo | Notas |
|-------|------|-------|
| id_observacion | SERIAL PK | |
| id_negocio | FK → proyectos | |
| descripcion | TEXT NOT NULL | |
| id_user | FK → users | se toma del token, NUNCA del body |
| created_at | TIMESTAMP | solo insert, no updated_at |

---

## 5. REGLAS DE NEGOCIO CRÍTICAS

> ⚠️ Estas reglas NUNCA se pueden violar. Verificar en cada sprint.

### RN-01: Campos calculados
- `facturado` y `pagado` del proyecto son `SUM` en tiempo real. **NUNCA se guardan en BD.**
- `total_pagos` y `saldo` de factura son `SUM` en tiempo real. **NUNCA se guardan en BD.**
- Calcularlos siempre con queries SQL agregadas o Prisma `_sum`.

### RN-02: Validación de pagos
- Un pago **NO puede superar el saldo disponible** de su factura.
- Validar en **backend Y frontend**.
- Retornar error 422 con mensaje claro si se intenta superar el saldo.
- Un pago no puede ser negativo ni cero.

### RN-03: Observaciones inmutables
- Solo existen endpoints `POST` y `GET` para observaciones.
- **NO hay PUT ni DELETE** en ninguna circunstancia.
- El `id_user` se toma **del token JWT**, nunca del request body.
- Se muestran ordenadas por `created_at DESC`.

### RN-04: Proyectos y pivots
- Un proyecto tiene **exactamente 1 empresa**.
- Un proyecto puede tener **N clientes** y **N responsables** (tablas pivot).
- Al crear/editar proyecto, sincronizar pivots con `deleteMany` + `createMany`.
- `MultiSelect` de clientes debe filtrar por empresa seleccionada.

### RN-05: Estado del proyecto
- El estado se puede cambiar en cualquier momento.
- Flujo normal: Prefactibilidad → Elaboracion_Propuesta → Adjudicado → Cerrado.
- `Rechazado` puede aplicarse desde cualquier estado previo a Adjudicado.
- Mostrar **warning (no bloqueante)** si se intenta cerrar un proyecto con saldo pendiente.

### RN-06: Tiempo de vida
- `tiempo_vida = fecha_cierre - fecha_creacion`
- Si no hay `fecha_cierre`, usar la fecha actual.
- Mostrar en días: "X días".

---

## 6. CONVENCIONES DE CÓDIGO

### API Routes (Next.js)
```javascript
// Ruta: src/app/api/v1/empresas/route.js
// Formato de respuesta SIEMPRE:
// Éxito:
{ "success": true, "data": {}, "message": "Operación completada" }
// Error validación:
{ "success": false, "message": "Error de validación", "errors": { "campo": ["msg"] } }

// Usar getServerSession(authOptions) para proteger endpoints
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
```

### Componentes React
- Nombres en **PascalCase**: `EmpresaList.jsx`, `ProyectoForm.jsx`
- Siempre `'use client'` en componentes con estado o eventos
- Manejo de errores SIEMPRE con `Toast` de PrimeReact
- Loading states con `<ProgressSpinner />` o skeleton de PrimeReact
- Formularios: `useState` local + validación antes del submit

### Servicios (axios)
```javascript
// src/services/empresaService.js
// Funciones: getAll(), getById(id), create(data), update(id, data), remove(id)
// Usar axios con base /api/v1/
```

### Componentes PrimeReact a usar
- Listas/tablas: `DataTable`, `Column`
- Formularios: `InputText`, `InputNumber`, `Dropdown`, `MultiSelect`, `Calendar`, `InputTextarea`
- Feedback: `Toast`, `ConfirmDialog`
- Layout: `Panel`, `Card`, `TabView`, `TabPanel`
- Indicadores: `Tag`, `ProgressBar`, `ProgressSpinner`
- Acciones: `Button` con iconos PrimeIcons

### Colores de estado (para `<Tag severity="">`)
```javascript
const ESTADO_CONFIG = {
  'Prefactibilidad':       { severity: 'warning',   label: 'Prefactibilidad'       },
  'Elaboracion_Propuesta': { severity: 'info',       label: 'Elab. Propuesta'       },
  'Adjudicado':            { severity: 'success',   label: 'Adjudicado'            },
  'Rechazado':             { severity: 'danger',    label: 'Rechazado'             },
  'Cerrado':               { severity: 'secondary', label: 'Cerrado'               },
}
```

### Formato de moneda y fechas
```javascript
// src/utils/format.js
export const formatCurrency = (value) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(value ?? 0)

export const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString('es-EC') : '—'

export const calcTiempoVida = (fechaCreacion, fechaCierre) => {
  const fin = fechaCierre ? new Date(fechaCierre) : new Date()
  const inicio = new Date(fechaCreacion)
  const dias = Math.floor((fin - inicio) / (1000 * 60 * 60 * 24))
  return `${dias} días`
}
```

---

## 7. SPRINTS Y ESTADO

| Sprint | Nombre | Estado | Semanas |
|--------|--------|--------|---------|
| **Sprint 0** | Setup y Fundamentos | ✅ COMPLETADO | 1-2 |
| **Sprint 1** | Empresas y Clientes | ✅ COMPLETADO | 3-4 |
| **Sprint 2** | Proyectos - Core | ✅ COMPLETADO | 5-7 |
| **Sprint 3** | Facturas y Pagos | ✅ COMPLETADO | 8-10 |
| **Sprint 4** | Detalle + Observaciones | ✅ COMPLETADO | 11-12 |
| **Sprint 5** | QA, Polish y Release | ✅ COMPLETADO | 13-14 |
| **Sprint 6** | Visibilidad Gerencial | ✅ COMPLETADO | 15-16 |
| **Sprint 7** | Administración, Reportes y Productividad | ✅ COMPLETADO | 17-18 |
| **Sprint 8** | Módulo de Propuestas | ✅ COMPLETADO | 19-20 |

### Sprint 0 — Lo que ya existe ✅
- Next.js 14 configurado con App Router
- NextAuth.js con login/logout funcional
- Prisma schema con todas las tablas
- Base de datos Neon con tablas creadas y seedeadas
- Layout dashboard con sidebar y topbar (estilo Sakai)
- Deploy en Vercel funcionando: https://gpro.vercel.app
- Usuario admin: `admin@proconty.com` / `password123`

---

## 8. HISTORIAS DE USUARIO POR SPRINT

### SPRINT 1 — Empresas y Clientes (26 pts)

**Objetivo:** CRUD completo de Empresas y Clientes. Al final el PM puede registrar empresas cliente y sus contactos.

| ID | Título | Story Points | Prioridad |
|----|--------|-------------|-----------|
| SP1-01 | API CRUD Empresas | 5 | Alta |
| SP1-02 | Pantalla Lista de Empresas | 5 | Alta |
| SP1-03 | Formulario Empresa (Create/Edit) | 3 | Alta |
| SP1-04 | API CRUD Clientes | 5 | Alta |
| SP1-05 | Pantalla Lista de Clientes | 5 | Alta |
| SP1-06 | Validaciones y Tests SP1 | 3 | Media |

**SP1-01 Criterios:** GET lista paginada · POST con nombre requerido · PUT y DELETE · respuesta `{success, data, message}`

**SP1-02 Criterios:** DataTable con id/nombre/ciudad/acciones · buscador en tiempo real · botones Nuevo/Editar/Eliminar · Toast · Spinner

**SP1-03 Criterios:** Dialog reutilizable crear/editar · campos nombre (req) y ciudad (opt) · validación antes de submit · cierra y refresca al guardar

**SP1-04 Criterios:** GET con `?empresa_id=` · POST con `id_empresa` requerido · ClienteResource incluye empresa relacionada

**SP1-05 Criterios:** DataTable nombre completo/empresa/teléfono/mail · Dropdown filtro por empresa · CRUD con Dialog · validar email

**SP1-06 Criterios:** Test empresa sin nombre → 422 · test cliente con empresa inexistente → 422 · buscador funcional

---

### SPRINT 2 — Proyectos Core (34 pts)

**Objetivo:** CRUD de Proyectos con relaciones. Grid principal con campos calculados.

| ID | Título | Story Points | Prioridad |
|----|--------|-------------|-----------|
| SP2-01 | Modelo y queries Proyecto | 3 | Alta |
| SP2-02 | API CRUD Proyectos | 8 | Alta |
| SP2-03 | Grid Principal de Proyectos | 8 | Alta |
| SP2-04 | Formulario Crear/Editar Proyecto | 8 | Alta |
| SP2-05 | Badge de Estado con Colores | 3 | Alta |
| SP2-06 | Validaciones y Tests SP2 | 4 | Media |

**SP2-02 Criterios:** GET incluye `facturado`, `pagado`, `saldo` calculados · POST con arrays `clienteIds[]` y `responsableIds[]` · sync de pivots con deleteMany+createMany · DELETE valida si tiene facturas

**SP2-03 Criterios:** Columnas: ID/Detalle(link), Empresa, Valor, Facturado, Pagado, Saldo(rojo/verde), Tiempo de Vida, Estado(badge), Acciones · formato `$#,###.##` · filtro por estado · buscador

**SP2-04 Criterios:** InputText detalle (req) · Dropdown empresa (req) · MultiSelect clientes (filtra por empresa) · MultiSelect responsables (usuarios) · InputNumber valor USD · Dropdown estado · Calendar fechas · InputText URL

---

### SPRINT 3 — Facturas y Pagos (34 pts)

**Objetivo:** Módulo financiero completo. Ciclo de cobro funcional.

| ID | Título | Story Points | Prioridad |
|----|--------|-------------|-----------|
| SP3-01 | API CRUD Facturas | 8 | Alta |
| SP3-02 | Grid de Facturas en Proyecto | 5 | Alta |
| SP3-03 | Formulario de Factura (Dialog) | 5 | Alta |
| SP3-04 | API CRUD Pagos | 8 | Alta |
| SP3-05 | Sub-grid de Pagos en Factura | 5 | Alta |
| SP3-06 | Resumen Financiero del Proyecto | 3 | Alta |

**SP3-01 Criterios:** `total_pagos` y `saldo` calculados en respuesta · num_factura único · formato SRI validado

**SP3-04 Criterios:** ⚠️ Validación CRÍTICA: `valor_pago <= saldo_disponible` → 422 si supera · re-validar en PUT

**SP3-06 Criterios:** Panel con Valor/Facturado/Pagado/Saldo · `<ProgressBar>` % facturado y % pagado · actualización reactiva

---

### SPRINT 4 — Detalle de Proyecto y Observaciones (26 pts)

**Objetivo:** Vista completa del proyecto. Bitácora inmutable.

| ID | Título | Story Points | Prioridad |
|----|--------|-------------|-----------|
| SP4-01 | Vista Detalle de Proyecto - Layout | 5 | Alta |
| SP4-02 | API Observaciones (solo insert) | 5 | Alta |
| SP4-03 | Grid de Observaciones | 5 | Alta |
| SP4-04 | Cambio de Estado del Proyecto | 5 | Alta |
| SP4-05 | Navegación y UX General | 3 | Media |
| SP4-06 | Validaciones y Tests SP4 | 3 | Media |

**SP4-02 Criterios:** ⚠️ Solo POST y GET · DELETE retorna 405 · `id_user` del token, NUNCA del body · ordenado DESC

**SP4-03 Criterios:** Sin botones editar/eliminar · Dialog para agregar · aparece inmediatamente al guardar

---

### SPRINT 5 — QA, Polish y Release (21 pts) ✅ COMPLETADO

| ID | Título | Story Points | Prioridad |
|----|--------|-------------|-----------|
| SP5-01 | Testing E2E Flujos Críticos | 8 | Alta |
| SP5-02 | Corrección de Bugs y Deuda Técnica | 5 | Alta |
| SP5-03 | Documentación API | 3 | Media |
| SP5-04 | Seguridad y Autorización | 3 | Alta |
| SP5-05 | Deploy y Config Producción | 2 | Alta |

---

### SPRINT 6 — Visibilidad Gerencial (48 pts)

**Objetivo:** Dar al gerente herramientas de análisis y control. Dashboard con gráficas reales,
exportación para contabilidad, alertas de cobranza y recordatorios automáticos de facturación recurrente por email.

| ID | Título | Story Points | Prioridad |
|----|--------|-------------|-----------|
| SP6-01 | API datos para gráficas (dashboard ampliado) | 5 | Alta |
| SP6-02 | Gráficas en Dashboard | 8 | Alta |
| SP6-03 | Exportación a Excel/CSV | 5 | Alta |
| SP6-04 | Alertas de facturas vencidas | 5 | Alta |
| SP6-05 | Tests y ajustes Sprint 6 | 4 | Media |
| SP6-06 | Schema + API Recordatorios CRUD | 5 | Alta |
| SP6-07 | UI: Sección recordatorios en detalle de proyecto | 5 | Alta |
| SP6-08 | Integración Resend + Cron Vercel | 8 | Alta |
| SP6-09 | Badge sidebar + recordatoriosHoy en dashboard | 3 | Media |

**SP6-01 Criterios:**
- Ampliar `GET /api/v1/dashboard` con campo `porMes`: array de últimos 12 meses con `{ mes, facturado, cobrado }`
- Agregar `GET /api/v1/dashboard/alertas?dias=30` → facturas con saldo > 0 y antigüedad ≥ N días
- Agregar campo `porEstado`: conteo de proyectos agrupado por nombre de estado
- Agregar campo `topClientes`: top 5 empresas por `SUM(factura.valor)`, con nombre y total
- Protegido con `getServerSession` · respuesta `{success, data, message}`

**SP6-02 Criterios:**
- Usar `<Chart>` de PrimeReact (ya incluido, sin dependencias nuevas) + `chart.js`
- **Gráfico de líneas**: "Facturación vs Cobro" — ejes: meses (últimos 12), líneas: facturado (azul) y cobrado (verde)
- **Gráfico de donut**: "Proyectos por Estado" — segmento por cada estado con color del `ESTADO_CONFIG`
- **Gráfico de barras**: "Top 5 Clientes" — barras horizontales por valor total facturado
- Los 3 gráficos se renderizan en la misma página `/dashboard` debajo de los KPI cards
- Loading state con `<ProgressSpinner />` mientras carga

**SP6-03 Criterios:**
- Instalar `xlsx` (SheetJS) como dependencia
- Botón "Exportar Excel" en la página `/proyectos` (esquina superior derecha, junto a "Nuevo Proyecto")
- Exporta todos los proyectos visibles (respetando filtro de estado activo) a un `.xlsx`
- Columnas: ID · Proyecto · Cliente · Responsable(s) · Estado · Valor · Facturado · Pagado · Saldo · Tiempo de vida · Fecha inicio · Fecha cierre
- Nombre del archivo: `proyectos_YYYY-MM-DD.xlsx`
- Botón "Exportar Excel" también en la sección de Facturas del detalle de proyecto
- Columnas de facturas: Nº Factura · OC · Fecha · Valor · Pagado · Saldo

**SP6-04 Criterios:**
- Nueva sección "Alertas de Cobranza" en el Dashboard, debajo de las gráficas
- Muestra facturas con saldo > 0 y `fechaFactura` con más de 30 días de antigüedad
- Columnas: Proyecto · Cliente · Nº Factura · Fecha · Valor · Saldo · **Días de mora** (en rojo)
- Badge rojo en el ítem "Dashboard" del sidebar si hay alertas: `<Badge value={n} severity="danger" />`
- Si no hay alertas: mostrar mensaje verde "Sin facturas vencidas"
- Umbral configurable: 30 días (parámetro `?dias=30` en la API)

**SP6-05 Criterios:**
- Tests Jest para la lógica de alertas: factura de 31 días → aparece · 29 días → no aparece
- Tests para la función de exportación (genera el array correcto de filas)
- Verificar que las gráficas no crashean con 0 proyectos o 0 facturas
- Push a `main` y deploy verde en Vercel

**SP6-06 Criterios:**
- 2 tablas nuevas en BD: `recordatorio_facturas` y `recordatorio_logs` (via `prisma db push`)
- Relación `Proyecto → RecordatorioFactura` en schema.prisma
- `GET /api/v1/recordatorios?proyecto_id=` → lista con último log de cada uno
- `POST /api/v1/recordatorios` → valida diaMes 1-28, emails válidos, proyectoId requerido
- `PUT /api/v1/recordatorios/:id` · `DELETE /api/v1/recordatorios/:id`
- Todos protegidos con `getServerSession`

**SP6-07 Criterios:**
- Card "Recordatorios de Facturación" en `/proyectos/[id]` entre Observaciones y Facturas
- DataTable: día del mes · descripción · destinatarios (truncado) · estado (activo/inactivo) · último envío · acciones
- Dialog crear/editar con: `InputNumber` día (1-28), `InputTextarea` descripción, `InputText` emails, `InputSwitch` activo
- Confirmar antes de eliminar · Toast de éxito/error

**SP6-08 Criterios:**
- Instalar `resend` como dependencia
- `src/lib/email.js`: función `enviarRecordatorio()` con plantilla HTML profesional
- `vercel.json`: cron `"0 8 * * *"` apuntando a `/api/cron/recordatorios`
- `GET /api/cron/recordatorios`: verifica `CRON_SECRET`, busca recordatorios con `diaMes = hoy`, envía emails, guarda logs
- Si falla el envío: registra log con `exitoso: false, error: mensaje` (no interrumpe los demás)
- Variable de entorno requerida: `RESEND_API_KEY` (agregar en Vercel dashboard)

**SP6-09 Criterios:**
- `GET /api/v1/dashboard` retorna campo `recordatoriosHoy` (count de recordatorios activos para hoy)
- `layout.jsx`: carga el dato al montar · muestra `<Badge value={n} severity="danger" />` junto al ítem Dashboard si `n > 0`
- Badge desaparece cuando `recordatoriosHoy = 0`

---

### SPRINT 7 — Administración, Reportes y Productividad (34 pts) ✅ COMPLETADO

**Objetivo:** Cerrar brechas de administración y productividad: gestión de usuarios, reporte PDF, historial de cambios de estado, perfil del usuario y filtros avanzados.

| ID | Título | Story Points | Prioridad |
|----|--------|-------------|-----------|
| SP7-01 | Gestión de Usuarios (Admin Panel) | 8 | Alta |
| SP7-02 | Reporte PDF del Proyecto | 8 | Alta |
| SP7-03 | Historial de Cambios de Estado | 5 | Media |
| SP7-04 | Perfil de Usuario / Cambio de Contraseña | 5 | Media |
| SP7-05 | Filtros Avanzados en Proyectos | 5 | Media |
| SP7-06 | Tests + Ajustes Sprint 7 | 3 | Media |

**SP7-01 Criterios:**
- `POST /api/v1/usuarios` — solo admin, valida nombre/email/password, hashea con bcryptjs
- `PUT /api/v1/usuarios/:id` — solo admin, password vacío = no cambiar
- `DELETE /api/v1/usuarios/:id` — solo admin, no puede eliminarse a sí mismo
- Página `/usuarios` con DataTable + UsuarioFormDialog (visible solo a admins)
- Ítem "Usuarios" en sidebar (solo si `session.user.role === 'admin'`)

**SP7-02 Criterios:**
- `src/lib/pdf/ProyectoPDF.jsx` — layout A4 con header, info general, resumen financiero, facturas y observaciones
- `GET /api/v1/proyectos/:id/pdf` — renderToBuffer + Content-Type: application/pdf
- Botón "PDF" en el detalle del proyecto (junto a "Editar")
- Dependencia: `@react-pdf/renderer`

**SP7-03 Criterios:**
- Tabla `proyecto_estado_logs` (via `prisma db push` en deploy)
- `PATCH /api/v1/proyectos/:id` crea log en transacción con el cambio de estado
- `GET /api/v1/proyectos/:id/estado-logs` retorna historial con usuario y estados
- Timeline en el detalle del proyecto (últimos 5 cambios)

**SP7-04 Criterios:**
- Página `/perfil` — sección datos personales (cambiar nombre) + sección contraseña
- `PUT /api/v1/usuarios/perfil` — actualiza nombre del usuario autenticado
- `PATCH /api/v1/usuarios/perfil` — valida password actual con bcrypt.compare, hashea la nueva
- Botón "Mi perfil" (icono) en el footer del sidebar

**SP7-05 Criterios:**
- Dropdown "Filtrar por responsable" en `/proyectos` — filtra `proyectosFiltrados` con `useMemo`
- Calendar con `selectionMode="range"` — filtra por `fechaCreacion` entre las fechas
- Filtros combinados (estado + responsable + rango) funcionan simultáneamente
- Excel export respeta los filtros aplicados

**SP7-06 Criterios:**
- `__tests__/sp7-usuarios.test.js` — 28 tests: validación usuario (crear/editar), eliminación propia, cambio contraseña, filtros por responsable y fecha
- Total: 75 tests en 4 suites, todos green

---

### SPRINT 8 — Módulo de Propuestas (34 pts)

**Objetivo:** Pipeline comercial previo a la adjudicación. Una propuesta pasa por estados propios y al ser aprobada crea automáticamente un Proyecto Adjudicado. Trazabilidad inmutable de todos los cambios de estado.

**Flujo de estados:**
```
Factibilidad ──→ Haciendo ──→ Enviada ──┬──→ Aprobada  ──→ [crea Proyecto Adjudicado]
                    ↑___________|        └──→ Rechazada
```

| ID | Título | Story Points | Prioridad |
|----|--------|-------------|-----------|
| SP8-01 | Schema BD (3 tablas nuevas) | 5 | Alta |
| SP8-02 | API CRUD Propuestas | 8 | Alta |
| SP8-03 | API Cambio de Estado + Aprobación automática | 8 | Alta |
| SP8-04 | Lista de Propuestas | 5 | Alta |
| SP8-05 | Detalle de Propuesta con Trazabilidad | 5 | Alta |
| SP8-06 | Componentes Dialog (Form + CambiarEstado) | 3 | Alta |

**SP8-01 Criterios:**
- Tabla `propuestas`: titulo, descripcion, empresaId, valorEstimado, fechaCreacion, fechaEnvio, estado, proyectoId
- Tabla `propuesta_responsable`: pivot propuestaId + userId
- Tabla `propuesta_estado_logs`: inmutable, estadoAnterior, estadoNuevo, userId, nota, createdAt
- Back-relations en Empresa, Proyecto, User

**SP8-02 Criterios:**
- `GET /api/v1/propuestas?estado=&empresa_id=` — lista filtrada con empresa, responsables, count de logs
- `POST /api/v1/propuestas` — crea en estado `Factibilidad`, registra log inicial automáticamente
- `GET /api/v1/propuestas/:id` — detalle completo con empresa, responsables, logs con usuarios, proyecto vinculado
- `PUT /api/v1/propuestas/:id` — edita metadata (no edita estado), sync de responsables
- `DELETE /api/v1/propuestas/:id` — solo si estado es `Factibilidad` o `Haciendo`

**SP8-03 Criterios:**
- `PATCH /api/v1/propuestas/:id` — valida transición según tabla de reglas
- Transiciones válidas: Factibilidad→Haciendo, Haciendo→{Enviada, Factibilidad}, Enviada→{Aprobada, Rechazada}
- Cuando estadoNuevo=`Enviada`: auto-set `fechaEnvio = hoy`
- Cuando estadoNuevo=`Aprobada`: transacción atómica crea Proyecto (estadoId=3 Adjudicado), actualiza propuesta.proyectoId, registra 2 logs
- Retorna `{ data, proyectoCreado, message }` — frontend muestra toast especial si proyectoCreado
- `GET /api/v1/propuestas/:id/logs` — historial completo DESC

**SP8-04 Criterios:**
- DataTable: ID · Título(link) · Empresa · Valor est. · Estado(Tag) · Responsables · Fecha creación · Acciones
- Filtro por estado con Dropdown + buscador global
- Botón editar deshabilitado si estado `Aprobada` o `Rechazada`
- Botón eliminar deshabilitado si estado no es `Factibilidad` o `Haciendo`

**SP8-05 Criterios:**
- Breadcrumb + botón Editar (oculto si estado terminal)
- Botones de transición contextuales según el estado actual
- Card "Proyecto generado" con link si `propuesta.proyectoId` existe
- Timeline de trazabilidad: círculo coloreado + línea vertical + estado anterior→nuevo + usuario + fecha + nota

**SP8-06 Criterios:**
- `PropuestaFormDialog`: titulo, empresa (req), valorEstimado, fechaCreacion, responsables, descripcion
- `CambiarEstadoPropuestaDialog`: flecha estado actual→destino, aviso si es Aprobada (creará proyecto), nota opcional
- Ítem "Propuestas" en sidebar entre Dashboard y Proyectos

**Reglas de negocio (RN-P):**
- **RN-P01**: Estado inicial siempre `Factibilidad`. No se puede crear en otro estado.
- **RN-P02**: Solo se puede eliminar si estado es `Factibilidad` o `Haciendo`.
- **RN-P03**: Metadata editable mientras estado NO sea `Aprobada` ni `Rechazada`.
- **RN-P04**: Al pasar a `Enviada`, `fechaEnvio` se registra automáticamente.
- **RN-P05**: Al aprobar, proyecto creado con estadoId=3 (Adjudicado). Propuesta queda vinculada via `proyectoId`.
- **RN-P06**: Logs de estado son inmutables (solo INSERT, nunca UPDATE/DELETE).

---

## 9. DEFINITION OF DONE

Una historia está DONE cuando:
- [ ] Código revisado (no broken imports, no console.error en producción)
- [ ] API Route protegida con `getServerSession`
- [ ] Validaciones en backend Y frontend alineadas
- [ ] Toast de éxito y error funcionando
- [ ] Loading state implementado
- [ ] Probado en Chrome
- [ ] Push a `main` y deploy verde en Vercel

---

## 10. PROMPT BASE PARA CLAUDE CODE

Usar este template al inicio de cada sesión de Claude Code:

```
Soy el PM del sistema GPRO (Gestor de Proyectos - Proconty).
Lee el archivo CLAUDE.md completo antes de generar cualquier código.

Estoy implementando [Sprint X - Historia SP-X-XX: Título].

Stack real del proyecto:
- Next.js 14 con App Router (NO Laravel, NO Vite)
- PrimeReact 10 + PrimeFlex (NO Tailwind)
- NextAuth.js v4 para auth (NO Sanctum)
- Prisma 5 + PostgreSQL Neon (NO MySQL/Eloquent)
- Deploy en Vercel

Lo que ya existe (Sprint 0 completado):
- Auth funcionando: src/lib/auth.js + src/app/api/auth/[...nextauth]/route.js
- Prisma client: src/lib/prisma.js
- Dashboard layout con sidebar: src/app/(dashboard)/layout.jsx
- Todas las tablas en la BD ya creadas

Genera código completo y funcional archivo por archivo.
Señala qué regla de negocio del CLAUDE.md implementa cada sección.
```

---

## 11. CREDENCIALES Y ACCESOS

| Servicio | URL / Credencial |
|---------|-----------------|
| App producción | https://gpro.vercel.app |
| Login admin | admin@proconty.com / password123 |
| GitHub repo | https://github.com/dsProconty/GPRO |
| Vercel dashboard | https://vercel.com/dsprocontys-projects/gpro |
| Neon DB | https://console.neon.tech → proyecto Gpro |
| DB name | neondb |

---

*GPRO v1.0 · Proconty · Abril 2026*
