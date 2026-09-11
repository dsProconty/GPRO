# Oportunidades → Catálogo real de Empresas/Clientes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que Oportunidades use el catálogo real de `Empresa`/`Cliente` (con un nuevo campo `cargo` en `Cliente`) desde el primer registro, en vez de los campos de texto libre `empresaNombre` y `OportunidadContacto` actuales, siguiendo el diseño aprobado en `docs/superpowers/specs/2026-09-10-oportunidades-catalogo-empresas-clientes-design.md`.

**Architecture:** `Oportunidad` gana una FK `empresaId` y una tabla pivote `oportunidad_cliente` (mismo patrón que `proyecto_cliente`/`propuesta_cliente`). `OportunidadContacto` se elimina. El formulario de Oportunidades reutiliza el patrón ya existente de "empresa nueva vs. existente" (hoy solo disponible en la etapa gancho) desde el primer registro, y el "Punto de contacto" ya expuesto en Propuestas se replica aquí como `MultiSelect` sobre `Cliente`. De paso se corrige un bug de RBAC en `/api/v1/clientes` (no seguía el patrón OR ya usado en `/api/v1/empresas`).

**Tech Stack:** Next.js 14 (App Router), Prisma 5 + PostgreSQL, PrimeReact 10, Jest.

**Nota sobre testing:** este repo no tiene tests de integración de rutas API ni de componentes React (`__tests__/` solo contiene reimplementaciones puras de reglas de negocio, sin imports de `src/`, porque `jest.config.js` no tiene `transform` ni alias `@/` configurados — ver Task 2). Este plan sigue esa misma convención: TDD se aplica donde hay lógica pura nueva (Task 2); el resto de tareas (schema, rutas API, componentes) se verifican con `npx prisma validate`, `npm run build` y una pasada manual guiada en Task 10.

---

### Task 1: Schema — Prisma

**Files:**
- Modify: `prisma/schema.prisma`

- [x] **Step 1: Agregar la relación inversa en `Empresa`**

Busca el modelo `Empresa` (línea ~59) y reemplaza:

```prisma
  // Relaciones
  clientes   Cliente[]
  proyectos  Proyecto[]
  propuestas Propuesta[]
  tarifario  Tarifario? @relation(fields: [tarifarioId], references: [id])
```

por:

```prisma
  // Relaciones
  clientes      Cliente[]
  proyectos     Proyecto[]
  propuestas    Propuesta[]
  oportunidades Oportunidad[]
  tarifario     Tarifario? @relation(fields: [tarifarioId], references: [id])
```

- [x] **Step 2: Agregar `cargo` y la relación inversa en `Cliente`**

Reemplaza el modelo `Cliente` completo (línea ~78):

```prisma
model Cliente {
  id        Int     @id @default(autoincrement()) @map("id_cliente")
  nombre    String  @db.VarChar(100)
  apellido  String  @db.VarChar(100)
  telefono  String? @db.VarChar(20)
  mail      String? @db.VarChar(200)
  empresaId Int     @map("id_empresa")

  // Relaciones
  empresa   Empresa           @relation(fields: [empresaId], references: [id])
  proyectos ProyectoCliente[]
  propuestas PropuestaCliente[]

  @@map("clientes")
}
```

por:

```prisma
model Cliente {
  id        Int     @id @default(autoincrement()) @map("id_cliente")
  nombre    String  @db.VarChar(100)
  apellido  String  @db.VarChar(100)
  telefono  String? @db.VarChar(20)
  mail      String? @db.VarChar(200)
  cargo     String? @db.VarChar(100)
  empresaId Int     @map("id_empresa")

  // Relaciones
  empresa       Empresa              @relation(fields: [empresaId], references: [id])
  proyectos     ProyectoCliente[]
  propuestas    PropuestaCliente[]
  oportunidades OportunidadCliente[]

  @@map("clientes")
}
```

- [x] **Step 3: Reemplazar `Oportunidad` (quitar `empresaNombre`, agregar `empresaId` y la relación `clientes`)**

Reemplaza el modelo `Oportunidad` completo (línea ~447):

```prisma
model Oportunidad {
  id             Int       @id @default(autoincrement())
  titulo         String    @db.VarChar(255)
  empresaNombre  String    @map("empresa_nombre") @db.VarChar(150) // texto libre, sin catálogo en v1
  origen         String?   @db.VarChar(50)
  descripcion    String?   @db.Text
  valorEstimado  Decimal?  @map("valor_estimado") @db.Decimal(12, 2)
  etapa          String    @default("Prospeccion") @db.VarChar(30)
  motivoPerdida  String?   @map("motivo_perdida") @db.Text
  responsableId  Int       @map("id_empleado_responsable")
  propuestaId    Int?      @unique @map("id_propuesta")
  fechaCreacion  DateTime  @map("fecha_creacion") @db.Date
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  responsable  Empleado                @relation(fields: [responsableId], references: [id])
  propuesta    Propuesta?              @relation(fields: [propuestaId], references: [id])
  contactos    OportunidadContacto[]
  seguimientos OportunidadSeguimiento[]
  logs         OportunidadEstadoLog[]

  @@map("oportunidades")
}
```

por:

```prisma
model Oportunidad {
  id             Int       @id @default(autoincrement())
  titulo         String    @db.VarChar(255)
  empresaId      Int       @map("id_empresa")
  origen         String?   @db.VarChar(50)
  descripcion    String?   @db.Text
  valorEstimado  Decimal?  @map("valor_estimado") @db.Decimal(12, 2)
  etapa          String    @default("Prospeccion") @db.VarChar(30)
  motivoPerdida  String?   @map("motivo_perdida") @db.Text
  responsableId  Int       @map("id_empleado_responsable")
  propuestaId    Int?      @unique @map("id_propuesta")
  fechaCreacion  DateTime  @map("fecha_creacion") @db.Date
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  empresa      Empresa                 @relation(fields: [empresaId], references: [id])
  responsable  Empleado                @relation(fields: [responsableId], references: [id])
  propuesta    Propuesta?              @relation(fields: [propuestaId], references: [id])
  clientes     OportunidadCliente[]
  seguimientos OportunidadSeguimiento[]
  logs         OportunidadEstadoLog[]

  @@map("oportunidades")
}

// ─── PIVOT: OPORTUNIDAD ↔ CLIENTE (contactos reales del catálogo) ────────────
model OportunidadCliente {
  oportunidadId Int @map("id_oportunidad")
  clienteId     Int @map("id_cliente")

  oportunidad Oportunidad @relation(fields: [oportunidadId], references: [id], onDelete: Cascade)
  cliente     Cliente     @relation(fields: [clienteId], references: [id], onDelete: Cascade)

  @@id([oportunidadId, clienteId])
  @@map("oportunidad_cliente")
}
```

- [x] **Step 4: Eliminar el modelo `OportunidadContacto`**

Borra por completo este bloque (línea ~472, justo debajo del modelo `Oportunidad`/`OportunidadCliente` que acabas de dejar):

```prisma
// ─── OPORTUNIDAD: CONTACTOS (1 a N) ───────────────────────────────────────────
model OportunidadContacto {
  id            Int      @id @default(autoincrement())
  oportunidadId Int      @map("id_oportunidad")
  nombre        String   @db.VarChar(150)
  cargo         String?  @db.VarChar(100)
  telefono      String?  @db.VarChar(20)
  correo        String?  @db.VarChar(200)
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  oportunidad Oportunidad @relation(fields: [oportunidadId], references: [id], onDelete: Cascade)

  @@map("oportunidad_contactos")
}
```

- [x] **Step 5: Validar el schema**

Run: `npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [x] **Step 6: Aplicar el schema a la base de datos local y regenerar el cliente**

Run: `npx prisma db push`
Expected: confirma que se crea `oportunidad_cliente`, se elimina `oportunidad_contactos`, y se agregan las columnas `id_empresa` (en `oportunidades`) y `cargo` (en `clientes`). Como ambas tablas de Oportunidades están vacías en este entorno, no debería pedir `--accept-data-loss` para los datos existentes de Oportunidades; si lo pide igual (por el drop de la tabla `oportunidad_contactos`), confírmalo — está vacía.

Run: `npx prisma generate`
Expected: `✔ Generated Prisma Client`

- [x] **Step 7: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: Oportunidad usa empresaId real + pivote oportunidad_cliente, Cliente gana campo cargo"
```

---

### Task 2: Fix de RBAC en `/api/v1/clientes` (catálogo compartido)

**Files:**
- Modify: `src/app/api/v1/clientes/route.js:9-26`
- Test: `__tests__/rbac-catalogos-compartidos.test.js`

- [x] **Step 1: Escribir el test (falla porque el helper todavía no existe en el archivo de test)**

Crea `__tests__/rbac-catalogos-compartidos.test.js`:

```javascript
/**
 * Tests para el patrón de permisos OR en catálogos compartidos (CLAUDE.md §2.2).
 * No requieren base de datos ni imports de src/ (mismo enfoque que reglas-negocio.test.js):
 * se reimplementa la lógica pura que debe vivir en las rutas de /api/v1/clientes.
 */

function tienePermiso(session, permiso) {
  if (session?.user?.role === 'admin') return true
  return (session?.user?.permisos || []).includes(permiso)
}

const PERMISOS = {
  CLIENTES:      { VER: 'clientes.ver', CREAR: 'clientes.crear' },
  PROYECTOS:     { VER: 'proyectos.ver', CREAR: 'proyectos.crear' },
  PROPUESTAS:    { VER: 'propuestas.ver', CREAR: 'propuestas.crear' },
  OPORTUNIDADES: { VER: 'oportunidades.ver', CREAR: 'oportunidades.crear' },
  FACTURAS:      { VER: 'facturas.ver' },
}

function puedeVerClientes(session) {
  return (
    tienePermiso(session, PERMISOS.CLIENTES.VER) ||
    tienePermiso(session, PERMISOS.PROYECTOS.VER) ||
    tienePermiso(session, PERMISOS.PROPUESTAS.VER) ||
    tienePermiso(session, PERMISOS.OPORTUNIDADES.VER)
  )
}

function puedeCrearClientes(session) {
  return (
    tienePermiso(session, PERMISOS.CLIENTES.CREAR) ||
    tienePermiso(session, PERMISOS.PROYECTOS.CREAR) ||
    tienePermiso(session, PERMISOS.PROPUESTAS.CREAR) ||
    tienePermiso(session, PERMISOS.OPORTUNIDADES.CREAR)
  )
}

describe('RBAC: Clientes es catálogo compartido entre módulos (CLAUDE.md §2.2)', () => {
  test('un perfil con permiso de Propuestas puede ver el dropdown de Clientes aunque no tenga clientes.ver', () => {
    const session = { user: { role: 'user', permisos: [PERMISOS.PROPUESTAS.VER] } }
    expect(puedeVerClientes(session)).toBe(true)
  })

  test('un perfil con permiso de Oportunidades puede crear un contacto inline aunque no tenga clientes.crear', () => {
    const session = { user: { role: 'user', permisos: [PERMISOS.OPORTUNIDADES.CREAR] } }
    expect(puedeCrearClientes(session)).toBe(true)
  })

  test('un perfil con permiso de Proyectos puede ver el dropdown de Clientes', () => {
    const session = { user: { role: 'user', permisos: [PERMISOS.PROYECTOS.VER] } }
    expect(puedeVerClientes(session)).toBe(true)
  })

  test('un perfil sin ninguno de los permisos relacionados no puede ver ni crear clientes', () => {
    const session = { user: { role: 'user', permisos: [PERMISOS.FACTURAS.VER] } }
    expect(puedeVerClientes(session)).toBe(false)
    expect(puedeCrearClientes(session)).toBe(false)
  })

  test('admin siempre puede, sin importar el array de permisos', () => {
    const session = { user: { role: 'admin', permisos: [] } }
    expect(puedeVerClientes(session)).toBe(true)
    expect(puedeCrearClientes(session)).toBe(true)
  })
})
```

- [x] **Step 2: Correr el test para confirmar que pasa contra la lógica esperada**

Run: `npx jest __tests__/rbac-catalogos-compartidos.test.js -v`
Expected: PASS (los 5 tests) — este archivo es una especificación ejecutable de la regla; el siguiente paso es hacer que la ruta real siga exactamente esta misma lógica.

- [x] **Step 3: Aplicar el mismo patrón OR a la ruta real**

En `src/app/api/v1/clientes/route.js`, reemplaza el `GET` (líneas 9-14):

```javascript
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.CLIENTES.VER)) {
    return NextResponse.json({ success: false, message: 'Sin permiso para ver clientes' }, { status: 403 })
  }
```

por:

```javascript
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  // Clientes se usa como catálogo/dropdown desde otros módulos (Proyectos, Propuestas,
  // Oportunidades) — no solo desde su propia pantalla de gestión. Mismo patrón que /api/v1/empresas.
  const puedeVer = (
    tienePermiso(session, PERMISOS.CLIENTES.VER) ||
    tienePermiso(session, PERMISOS.PROYECTOS.VER) ||
    tienePermiso(session, PERMISOS.PROPUESTAS.VER) ||
    tienePermiso(session, PERMISOS.OPORTUNIDADES.VER)
  )
  if (!puedeVer) {
    return NextResponse.json({ success: false, message: 'Sin permiso para ver clientes' }, { status: 403 })
  }
```

Y reemplaza el `POST` (líneas 28-35):

```javascript
export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  }
  if (!tienePermiso(session, PERMISOS.CLIENTES.CREAR)) {
    return NextResponse.json({ success: false, message: 'No tiene permiso para crear clientes' }, { status: 403 })
  }
```

por:

```javascript
export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  }
  const puedeCrear = (
    tienePermiso(session, PERMISOS.CLIENTES.CREAR) ||
    tienePermiso(session, PERMISOS.PROYECTOS.CREAR) ||
    tienePermiso(session, PERMISOS.PROPUESTAS.CREAR) ||
    tienePermiso(session, PERMISOS.OPORTUNIDADES.CREAR)
  )
  if (!puedeCrear) {
    return NextResponse.json({ success: false, message: 'No tiene permiso para crear clientes' }, { status: 403 })
  }
```

- [x] **Step 4: Commit**

```bash
git add __tests__/rbac-catalogos-compartidos.test.js src/app/api/v1/clientes/route.js
git commit -m "fix: clientes.ver/crear ahora acepta permiso de Proyectos, Propuestas u Oportunidades (mismo patron que empresas)"
```

---

### Task 3: Campo "Cargo" en Cliente (backend + UI)

**Files:**
- Modify: `src/app/api/v1/clientes/route.js:37,61-67`
- Modify: `src/app/api/v1/clientes/[id]/route.js:23,47-56`
- Modify: `src/components/shared/ClienteFormDialog.jsx`
- Modify: `src/app/(dashboard)/clientes/[id]/page.jsx:216-225`

- [x] **Step 1: Persistir `cargo` en `POST /api/v1/clientes`**

En `src/app/api/v1/clientes/route.js`, reemplaza:

```javascript
  const { nombre, apellido, telefono, mail, empresaId } = await request.json()
```

por:

```javascript
  const { nombre, apellido, telefono, mail, cargo, empresaId } = await request.json()
```

Y reemplaza el bloque de creación:

```javascript
    const cliente = await prisma.cliente.create({
      data: {
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        telefono: telefono?.trim() || null,
        mail: mail?.trim() || null,
        empresaId: parseInt(empresaId),
```

por:

```javascript
    const cliente = await prisma.cliente.create({
      data: {
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        telefono: telefono?.trim() || null,
        mail: mail?.trim() || null,
        cargo: cargo?.trim() || null,
        empresaId: parseInt(empresaId),
```

- [x] **Step 2: Persistir `cargo` en `PUT /api/v1/clientes/:id`**

En `src/app/api/v1/clientes/[id]/route.js`, reemplaza:

```javascript
  const { nombre, apellido, telefono, mail, empresaId } = await request.json()
```

por:

```javascript
  const { nombre, apellido, telefono, mail, cargo, empresaId } = await request.json()
```

Y reemplaza el bloque de actualización:

```javascript
    const cliente = await prisma.cliente.update({
      where: { id },
      data: {
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        telefono: telefono?.trim() || null,
        mail: mail?.trim() || null,
        empresaId: parseInt(empresaId),
      },
      include: { empresa: { select: { id: true, nombre: true } } },
    })
```

por:

```javascript
    const cliente = await prisma.cliente.update({
      where: { id },
      data: {
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        telefono: telefono?.trim() || null,
        mail: mail?.trim() || null,
        cargo: cargo?.trim() || null,
        empresaId: parseInt(empresaId),
      },
      include: { empresa: { select: { id: true, nombre: true } } },
    })
```

- [x] **Step 3: Agregar el campo al formulario `ClienteFormDialog.jsx`**

En `src/components/shared/ClienteFormDialog.jsx`, reemplaza el estado inicial:

```javascript
  const [form, setForm] = useState({ nombre: '', apellido: '', telefono: '', mail: '', empresaId: null })
```

por:

```javascript
  const [form, setForm] = useState({ nombre: '', apellido: '', telefono: '', mail: '', cargo: '', empresaId: null })
```

Reemplaza el `useEffect` que carga el formulario:

```javascript
      if (cliente) {
        setForm({
          nombre: cliente.nombre || '',
          apellido: cliente.apellido || '',
          telefono: cliente.telefono || '',
          mail: cliente.mail || '',
          empresaId: cliente.empresaId || empresaFija || null,
        })
      } else {
        setForm({ nombre: '', apellido: '', telefono: '', mail: '', empresaId: empresaFija || null })
      }
```

por:

```javascript
      if (cliente) {
        setForm({
          nombre: cliente.nombre || '',
          apellido: cliente.apellido || '',
          telefono: cliente.telefono || '',
          mail: cliente.mail || '',
          cargo: cliente.cargo || '',
          empresaId: cliente.empresaId || empresaFija || null,
        })
      } else {
        setForm({ nombre: '', apellido: '', telefono: '', mail: '', cargo: '', empresaId: empresaFija || null })
      }
```

Agrega el campo visual justo después del bloque de "Apellido" (después de su `</div>` de cierre, antes del bloque condicional `{!empresaFija && (...)}`):

```jsx
          <div className="field mb-0">
            <label htmlFor="cargo" className="font-semibold block mb-1">Cargo</label>
            <InputText
              id="cargo"
              value={form.cargo}
              onChange={(e) => setForm({ ...form, cargo: e.target.value })}
              className="w-full"
              placeholder="Ej. Gerente de Compras (opcional)"
            />
          </div>
```

- [x] **Step 4: Mostrar "Cargo" en la tabla de contactos de `/clientes/[id]`**

En `src/app/(dashboard)/clientes/[id]/page.jsx`, reemplaza:

```jsx
          <Column header="Nombre" body={(row) => `${row.nombre} ${row.apellido}`} sortable sortField="apellido" />
          <Column header="Teléfono" body={(row) => row.telefono || '—'} />
          <Column header="Email" body={(row) => row.mail || '—'} />
```

por:

```jsx
          <Column header="Nombre" body={(row) => `${row.nombre} ${row.apellido}`} sortable sortField="apellido" />
          <Column header="Cargo" body={(row) => row.cargo || '—'} />
          <Column header="Teléfono" body={(row) => row.telefono || '—'} />
          <Column header="Email" body={(row) => row.mail || '—'} />
```

- [x] **Step 5: Build para confirmar que no hay errores de sintaxis/tipos**

Run: `npm run build`
Expected: build exitoso (sin errores en las rutas ni componentes tocados). Puedes interrumpir con Ctrl+C una vez que veas que compiló `/clientes` y `/api/v1/clientes` sin errores si el build completo tarda demasiado en tu máquina.

- [x] **Step 6: Commit**

```bash
git add src/app/api/v1/clientes/route.js src/app/api/v1/clientes/[id]/route.js src/components/shared/ClienteFormDialog.jsx "src/app/(dashboard)/clientes/[id]/page.jsx"
git commit -m "feat: agregar campo Cargo a Cliente (backend + formulario + tabla de contactos)"
```

---

### Task 4: Backend — `POST`/`GET /api/v1/oportunidades` (reescritura completa)

**Files:**
- Modify: `src/app/api/v1/oportunidades/route.js` (reemplazo completo del archivo)

- [x] **Step 1: Reemplazar el archivo completo**

Reemplaza **todo el contenido** de `src/app/api/v1/oportunidades/route.js` por:

```javascript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { tienePermiso, PERMISOS } from '@/lib/permisos'
import { logPermisoDenegado } from '@/lib/logger'
import { ETAPAS, ETAPA_HOOK } from '@/lib/oportunidades'
import { generarCodigoPropuesta } from '@/lib/codigoHelper'

const OPORTUNIDAD_INCLUDE = {
  empresa: { select: { id: true, nombre: true } },
  responsable: { select: { id: true, nombre: true, apellido: true } },
  clientes: { include: { cliente: { select: { id: true, nombre: true, apellido: true, cargo: true, telefono: true, mail: true } } } },
  propuesta: { select: { id: true, codigo: true, estado: true } },
  seguimientos: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
}

const serializeOportunidad = (o) => ({
  ...o,
  valorEstimado: o.valorEstimado != null ? Number(o.valorEstimado) : null,
  ultimoSeguimiento: o.seguimientos?.[0]?.createdAt ?? null,
  seguimientos: undefined,
})

// Resuelve la empresa (existente o nueva) y la lista final de clienteIds
// (existentes + recién creados) dentro de la transacción `tx` dada.
async function resolverEmpresaYClientes(tx, { empresaId, empresaNombreNueva, clienteIds = [], contactosNuevos = [] }) {
  let empresaIdFinal
  if (empresaId) {
    const empresa = await tx.empresa.findUnique({ where: { id: parseInt(empresaId) }, select: { id: true } })
    if (!empresa) throw new Error('EMPRESA_NO_EXISTE')
    empresaIdFinal = empresa.id
  } else {
    const nombre = empresaNombreNueva?.trim()
    if (!nombre) throw new Error('EMPRESA_NOMBRE_REQUERIDO')
    const nuevaEmpresa = await tx.empresa.create({ data: { nombre } })
    empresaIdFinal = nuevaEmpresa.id
  }

  const clienteIdsFinal = clienteIds.map((cid) => parseInt(cid))
  for (const c of contactosNuevos) {
    if (!c.nombre?.trim() || !c.apellido?.trim()) continue
    const nuevoCliente = await tx.cliente.create({
      data: {
        nombre: c.nombre.trim(),
        apellido: c.apellido.trim(),
        cargo: c.cargo?.trim() || null,
        telefono: c.telefono?.trim() || null,
        mail: c.mail?.trim() || null,
        empresaId: empresaIdFinal,
      },
      select: { id: true },
    })
    clienteIdsFinal.push(nuevoCliente.id)
  }

  return { empresaIdFinal, clienteIdsFinal }
}

// GET /api/v1/oportunidades?etapa=&responsable_id=
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.OPORTUNIDADES.VER)) {
    logPermisoDenegado(session, PERMISOS.OPORTUNIDADES.VER, 'GET /oportunidades')
    return NextResponse.json({ success: false, message: 'Sin permiso para ver oportunidades' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const etapa = searchParams.get('etapa')
  const responsableId = searchParams.get('responsable_id')

  const where = {}
  if (etapa) where.etapa = etapa
  if (responsableId && !isNaN(parseInt(responsableId))) where.responsableId = parseInt(responsableId)

  const oportunidades = await prisma.oportunidad.findMany({
    where,
    include: OPORTUNIDAD_INCLUDE,
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ success: true, data: oportunidades.map(serializeOportunidad), message: '' })
}

// POST /api/v1/oportunidades
export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.OPORTUNIDADES.CREAR)) {
    logPermisoDenegado(session, PERMISOS.OPORTUNIDADES.CREAR, 'POST /oportunidades')
    return NextResponse.json({ success: false, message: 'No tiene permiso para crear oportunidades' }, { status: 403 })
  }

  const {
    titulo, origen, descripcion, valorEstimado,
    responsableId, fechaCreacion, etapa, motivoPerdida,
    empresaId, empresaNombreNueva, clienteIds = [], contactosNuevos = [],
  } = await request.json()

  const errors = {}
  if (!titulo?.trim()) errors.titulo = ['El título es requerido']
  if (!empresaId && !empresaNombreNueva?.trim()) errors.empresaId = ['La empresa es requerida']
  if (!responsableId) errors.responsableId = ['El responsable es requerido']
  if (!fechaCreacion) errors.fechaCreacion = ['La fecha de creación es requerida']

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ success: false, message: 'Error de validación', errors }, { status: 422 })
  }

  const etapaInicial = ETAPAS.includes(etapa) ? etapa : 'Prospeccion'
  const userId = parseInt(session.user.id)

  const datosBase = {
    titulo: titulo.trim(),
    origen: origen?.trim() || null,
    descripcion: descripcion?.trim() || null,
    valorEstimado: valorEstimado != null ? parseFloat(valorEstimado) : null,
    responsableId: parseInt(responsableId),
    fechaCreacion: new Date(fechaCreacion),
  }

  try {
    // ── RN-O04: si nace directamente en el gancho, genera la Propuesta ya mismo ──
    if (etapaInicial === ETAPA_HOOK) {
      let oportunidadCreada = null
      let propuestaCreada = null

      await prisma.$transaction(async (tx) => {
        const { empresaIdFinal, clienteIdsFinal } = await resolverEmpresaYClientes(tx, { empresaId, empresaNombreNueva, clienteIds, contactosNuevos })
        const codigo = await generarCodigoPropuesta(empresaIdFinal, new Date(), tx)

        propuestaCreada = await tx.propuesta.create({
          data: {
            codigo,
            titulo: datosBase.titulo,
            descripcion: datosBase.descripcion,
            empresaId: empresaIdFinal,
            valorEstimado: datosBase.valorEstimado,
            fechaCreacion: new Date(),
            estado: 'Factibilidad',
            clientes: { create: clienteIdsFinal.map((cid) => ({ clienteId: cid })) },
            logs: { create: { estadoAnterior: null, estadoNuevo: 'Factibilidad', userId, nota: `Generada automáticamente desde la oportunidad "${datosBase.titulo}"` } },
          },
          select: { id: true, codigo: true, titulo: true, estado: true },
        })

        oportunidadCreada = await tx.oportunidad.create({
          data: {
            ...datosBase,
            empresaId: empresaIdFinal,
            etapa: etapaInicial,
            propuestaId: propuestaCreada.id,
            clientes: { create: clienteIdsFinal.map((cid) => ({ clienteId: cid })) },
            logs: { create: { etapaAnterior: null, etapaNueva: etapaInicial, userId, nota: `Oportunidad creada. Se generó automáticamente ${propuestaCreada.codigo} en estado Factibilidad.` } },
          },
          include: OPORTUNIDAD_INCLUDE,
        })
      })

      return NextResponse.json({
        success: true,
        data: serializeOportunidad(oportunidadCreada),
        propuestaCreada,
        message: `Oportunidad creada. Propuesta "${propuestaCreada.codigo}" generada automáticamente.`,
      }, { status: 201 })
    }

    // ── Creación normal ────────────────────────────────────────────────────────
    let oportunidad = null
    await prisma.$transaction(async (tx) => {
      const { empresaIdFinal, clienteIdsFinal } = await resolverEmpresaYClientes(tx, { empresaId, empresaNombreNueva, clienteIds, contactosNuevos })

      oportunidad = await tx.oportunidad.create({
        data: {
          ...datosBase,
          empresaId: empresaIdFinal,
          etapa: etapaInicial,
          motivoPerdida: etapaInicial === 'Perdida' ? (motivoPerdida?.trim() || null) : null,
          clientes: { create: clienteIdsFinal.map((cid) => ({ clienteId: cid })) },
          logs: { create: { etapaAnterior: null, etapaNueva: etapaInicial, userId, nota: 'Oportunidad creada' } },
        },
        include: OPORTUNIDAD_INCLUDE,
      })
    })

    return NextResponse.json({ success: true, data: serializeOportunidad(oportunidad), message: 'Oportunidad creada exitosamente' }, { status: 201 })
  } catch (e) {
    if (e.message === 'EMPRESA_NO_EXISTE') return NextResponse.json({ success: false, message: 'La empresa seleccionada no existe' }, { status: 422 })
    if (e.message === 'EMPRESA_NOMBRE_REQUERIDO') return NextResponse.json({ success: false, message: 'Escribe el nombre de la nueva empresa' }, { status: 422 })
    if (e.code === 'P2003') return NextResponse.json({ success: false, message: 'El responsable indicado no existe' }, { status: 422 })
    console.error('POST /oportunidades error:', e.message)
    return NextResponse.json({ success: false, message: 'Error interno al crear la oportunidad' }, { status: 500 })
  }
}
```

- [x] **Step 2: Commit**

```bash
git add src/app/api/v1/oportunidades/route.js
git commit -m "feat: POST/GET oportunidades usan empresaId real y clienteIds en vez de empresaNombre/contactos libres"
```

---

### Task 5: Backend — `src/app/api/v1/oportunidades/[id]/route.js` (reescritura completa)

**Files:**
- Modify: `src/app/api/v1/oportunidades/[id]/route.js` (reemplazo completo del archivo)

- [x] **Step 1: Reemplazar el archivo completo**

Reemplaza **todo el contenido** de `src/app/api/v1/oportunidades/[id]/route.js` por:

```javascript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { tienePermiso, PERMISOS } from '@/lib/permisos'
import { generarCodigoPropuesta } from '@/lib/codigoHelper'
import { TRANSICIONES, ETAPA_HOOK } from '@/lib/oportunidades'
import { logger, logPermisoDenegado } from '@/lib/logger'

const OPORTUNIDAD_INCLUDE = {
  empresa: { select: { id: true, nombre: true } },
  responsable: { select: { id: true, nombre: true, apellido: true } },
  clientes: { include: { cliente: { select: { id: true, nombre: true, apellido: true, cargo: true, telefono: true, mail: true } } } },
  propuesta: { select: { id: true, codigo: true, estado: true } },
  logs: {
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  },
  seguimientos: {
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  },
}

function serializeOportunidad(o) {
  return { ...o, valorEstimado: o.valorEstimado != null ? Number(o.valorEstimado) : null }
}

// GET /api/v1/oportunidades/:id
export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.OPORTUNIDADES.VER)) {
    logPermisoDenegado(session, PERMISOS.OPORTUNIDADES.VER, `GET /oportunidades/${params.id}`)
    return NextResponse.json({ success: false, message: 'Sin permiso para ver oportunidades' }, { status: 403 })
  }

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const oportunidad = await prisma.oportunidad.findUnique({ where: { id }, include: OPORTUNIDAD_INCLUDE })
  if (!oportunidad) return NextResponse.json({ success: false, message: 'Oportunidad no encontrada' }, { status: 404 })

  return NextResponse.json({ success: true, data: serializeOportunidad(oportunidad), message: '' })
}

// PUT /api/v1/oportunidades/:id — editar metadata (RN-O08: bloqueado si ya tiene propuestaId)
export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.OPORTUNIDADES.EDITAR)) {
    logPermisoDenegado(session, PERMISOS.OPORTUNIDADES.EDITAR, `PUT /oportunidades/${params.id}`)
    return NextResponse.json({ success: false, message: 'No tiene permiso para editar oportunidades' }, { status: 403 })
  }

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const actual = await prisma.oportunidad.findUnique({ where: { id }, select: { propuestaId: true } })
  if (!actual) return NextResponse.json({ success: false, message: 'Oportunidad no encontrada' }, { status: 404 })
  if (actual.propuestaId) {
    return NextResponse.json({ success: false, message: 'No se puede editar: esta oportunidad ya generó una propuesta' }, { status: 422 })
  }

  const { titulo, empresaId, origen, descripcion, valorEstimado, responsableId, fechaCreacion, clienteIds = [] } = await request.json()

  const errors = {}
  if (!titulo?.trim()) errors.titulo = ['El título es requerido']
  if (!empresaId) errors.empresaId = ['La empresa es requerida']
  if (!responsableId) errors.responsableId = ['El responsable es requerido']
  if (!fechaCreacion) errors.fechaCreacion = ['La fecha de creación es requerida']

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ success: false, message: 'Error de validación', errors }, { status: 422 })
  }

  const empresaExiste = await prisma.empresa.findUnique({ where: { id: parseInt(empresaId) }, select: { id: true } })
  if (!empresaExiste) {
    return NextResponse.json({ success: false, message: 'La empresa seleccionada no existe' }, { status: 422 })
  }

  await prisma.oportunidadCliente.deleteMany({ where: { oportunidadId: id } })

  const oportunidad = await prisma.oportunidad.update({
    where: { id },
    data: {
      titulo: titulo.trim(),
      empresaId: parseInt(empresaId),
      origen: origen?.trim() || null,
      descripcion: descripcion?.trim() || null,
      valorEstimado: valorEstimado != null ? parseFloat(valorEstimado) : null,
      responsableId: parseInt(responsableId),
      fechaCreacion: new Date(fechaCreacion),
      clientes: { create: clienteIds.map((cid) => ({ clienteId: parseInt(cid) })) },
    },
    include: OPORTUNIDAD_INCLUDE,
  })

  return NextResponse.json({ success: true, data: serializeOportunidad(oportunidad), message: 'Oportunidad actualizada exitosamente' })
}

// PATCH /api/v1/oportunidades/:id — cambiar etapa (RN-O02, RN-O04, RN-O05)
export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.OPORTUNIDADES.CAMBIAR_ETAPA)) {
    logPermisoDenegado(session, PERMISOS.OPORTUNIDADES.CAMBIAR_ETAPA, `PATCH /oportunidades/${params.id}`)
    return NextResponse.json({ success: false, message: 'No tiene permiso para cambiar la etapa de oportunidades' }, { status: 403 })
  }

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const { etapaNueva, nota, motivoPerdida } = await request.json()
  if (!etapaNueva) return NextResponse.json({ success: false, message: 'etapaNueva es requerida' }, { status: 422 })

  const oportunidad = await prisma.oportunidad.findUnique({ where: { id } })
  if (!oportunidad) return NextResponse.json({ success: false, message: 'Oportunidad no encontrada' }, { status: 404 })

  const permitidas = TRANSICIONES[oportunidad.etapa] || []
  if (!permitidas.includes(etapaNueva)) {
    return NextResponse.json({
      success: false,
      message: `Transición inválida: ${oportunidad.etapa} → ${etapaNueva}. Permitidas: ${permitidas.join(', ') || 'ninguna'}`,
    }, { status: 422 })
  }

  const userId = parseInt(session.user.id)
  const etapaAnterior = oportunidad.etapa

  // ── RN-O04: gancho a Propuesta ───────────────────────────────────────────
  if (etapaNueva === ETAPA_HOOK) {
    let propuestaCreada = null
    let oportunidadActualizada = null

    await prisma.$transaction(async (tx) => {
      const clientesOportunidad = await tx.oportunidadCliente.findMany({ where: { oportunidadId: id }, select: { clienteId: true } })
      const codigo = await generarCodigoPropuesta(oportunidad.empresaId, new Date(), tx)

      propuestaCreada = await tx.propuesta.create({
        data: {
          codigo,
          titulo: oportunidad.titulo,
          descripcion: oportunidad.descripcion,
          empresaId: oportunidad.empresaId,
          valorEstimado: oportunidad.valorEstimado,
          fechaCreacion: new Date(),
          estado: 'Factibilidad',
          clientes: { create: clientesOportunidad.map((c) => ({ clienteId: c.clienteId })) },
          logs: { create: { estadoAnterior: null, estadoNuevo: 'Factibilidad', userId, nota: `Generada automáticamente desde la oportunidad "${oportunidad.titulo}"` } },
        },
        select: { id: true, codigo: true, titulo: true, estado: true },
      })

      oportunidadActualizada = await tx.oportunidad.update({
        where: { id },
        data: { etapa: etapaNueva, propuestaId: propuestaCreada.id },
        include: OPORTUNIDAD_INCLUDE,
      })

      await tx.oportunidadEstadoLog.create({
        data: {
          oportunidadId: id,
          etapaAnterior,
          etapaNueva,
          userId,
          nota: nota?.trim() || `Cliente solicitó formalmente una propuesta. Se generó automáticamente ${propuestaCreada.codigo} en estado Factibilidad.`,
        },
      })
    })

    logger.info('OPORTUNIDAD_CONVERTIDA', { oportunidadId: id, propuestaId: propuestaCreada.id, userId, userName: session.user.name })

    return NextResponse.json({
      success: true,
      data: serializeOportunidad(oportunidadActualizada),
      propuestaCreada,
      message: `Oportunidad convertida. Propuesta "${propuestaCreada.codigo}" generada automáticamente.`,
    })
  }

  // ── Cambio normal de etapa ────────────────────────────────────────────────
  const dataUpdate = { etapa: etapaNueva }
  if (etapaNueva === 'Perdida') dataUpdate.motivoPerdida = motivoPerdida?.trim() || null
  else if (etapaAnterior === 'Perdida') dataUpdate.motivoPerdida = null // reactivación limpia el motivo

  const [oportunidadActualizada] = await prisma.$transaction([
    prisma.oportunidad.update({ where: { id }, data: dataUpdate, include: OPORTUNIDAD_INCLUDE }),
    prisma.oportunidadEstadoLog.create({
      data: { oportunidadId: id, etapaAnterior, etapaNueva, userId, nota: nota?.trim() || null },
    }),
  ])

  logger.info('OPORTUNIDAD_ETAPA_CAMBIADA', { oportunidadId: id, etapaAnterior, etapaNueva, userId, userName: session.user.name })

  return NextResponse.json({
    success: true,
    data: serializeOportunidad(oportunidadActualizada),
    propuestaCreada: null,
    message: `Etapa actualizada a ${etapaNueva}`,
  })
}

// DELETE /api/v1/oportunidades/:id (RN-O03)
export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.OPORTUNIDADES.ELIMINAR)) {
    logPermisoDenegado(session, PERMISOS.OPORTUNIDADES.ELIMINAR, `DELETE /oportunidades/${params.id}`)
    return NextResponse.json({ success: false, message: 'No tiene permiso para eliminar oportunidades' }, { status: 403 })
  }

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const oportunidad = await prisma.oportunidad.findUnique({ where: { id }, select: { etapa: true, titulo: true } })
  if (!oportunidad) return NextResponse.json({ success: false, message: 'Oportunidad no encontrada' }, { status: 404 })

  if (!['Prospeccion', 'Solicitud_RFI', 'Entrega_RFI'].includes(oportunidad.etapa)) {
    return NextResponse.json({
      success: false,
      message: `No se puede eliminar una oportunidad en etapa "${oportunidad.etapa}".`,
    }, { status: 422 })
  }

  await prisma.oportunidad.delete({ where: { id } })
  return NextResponse.json({ success: true, data: null, message: 'Oportunidad eliminada exitosamente' })
}
```

- [x] **Step 2: Build para confirmar que ambos archivos de ruta compilan sin errores**

Run: `npm run build`
Expected: build exitoso, sin errores en `/api/v1/oportunidades` ni `/api/v1/oportunidades/[id]`.

- [x] **Step 3: Commit**

```bash
git add "src/app/api/v1/oportunidades/[id]/route.js"
git commit -m "feat: PUT/PATCH/GET oportunidades/:id usan empresaId real y pivote de clientes, hook ya no pide empresa"
```

---

### Task 6: Frontend — `OportunidadFormDialog.jsx` (reescritura completa)

**Files:**
- Modify: `src/components/shared/OportunidadFormDialog.jsx` (reemplazo completo del archivo)

- [ ] **Step 1: Reemplazar el archivo completo**

Reemplaza **todo el contenido** de `src/components/shared/OportunidadFormDialog.jsx` por:

```jsx
'use client'

import { useEffect, useState } from 'react'
import { Dialog } from 'primereact/dialog'
import { InputText } from '@/components/shared/InputText'
import { InputTextarea } from '@/components/shared/InputTextarea'
import { InputNumber } from 'primereact/inputnumber'
import { Dropdown } from 'primereact/dropdown'
import { MultiSelect } from 'primereact/multiselect'
import { Calendar } from 'primereact/calendar'
import { Button } from 'primereact/button'
import { Tag } from 'primereact/tag'
import { oportunidadService } from '@/services/oportunidadService'
import { clienteService } from '@/services/clienteService'
import { ETAPAS, ETAPA_CONFIG, ETAPA_HOOK } from '@/lib/oportunidades'

function EtapaTag({ etapa }) {
  const cfg = ETAPA_CONFIG[etapa] || { label: etapa, severity: 'secondary' }
  return <Tag value={cfg.label} severity={cfg.severity} style={cfg.color ? { background: cfg.color, color: '#fff' } : undefined} />
}

const NUEVA_EMPRESA = '__NUEVA__'

const ORIGEN_OPTIONS = ['Referido', 'LinkedIn', 'Networking', 'Web', 'Llamada fría', 'Otro']

const CONTACTO_NUEVO_VACIO = { nombre: '', apellido: '', cargo: '', telefono: '', mail: '' }

const EMPTY = {
  titulo: '',
  empresaId: null,
  origen: null,
  valorEstimado: null,
  responsableId: null,
  fechaCreacion: new Date(),
  descripcion: '',
  etapa: 'Prospeccion',
  clienteIds: [],
}

export default function OportunidadFormDialog({ visible, onHide, onSave, oportunidad, empleados = [], empresas = [] }) {
  const isEdit = !!oportunidad

  const [form, setForm] = useState(EMPTY)
  const [nuevaEmpresaNombre, setNuevaEmpresaNombre] = useState('')
  const [clientesEmpresa, setClientesEmpresa] = useState([])
  const [contactosNuevos, setContactosNuevos] = useState([])
  const [contactoForm, setContactoForm] = useState(null) // null = panel cerrado
  const [motivoPerdidaInicial, setMotivoPerdidaInicial] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const empresaEsNueva = form.empresaId === NUEVA_EMPRESA

  useEffect(() => {
    if (!visible) return
    setErrors({})
    setMotivoPerdidaInicial('')
    setContactosNuevos([])
    setContactoForm(null)
    setNuevaEmpresaNombre('')

    if (oportunidad) {
      setForm({
        titulo: oportunidad.titulo || '',
        empresaId: oportunidad.empresaId || null,
        origen: oportunidad.origen || null,
        valorEstimado: oportunidad.valorEstimado ?? null,
        responsableId: oportunidad.responsableId || null,
        fechaCreacion: oportunidad.fechaCreacion ? new Date(oportunidad.fechaCreacion) : new Date(),
        descripcion: oportunidad.descripcion || '',
        etapa: oportunidad.etapa || 'Prospeccion',
        clienteIds: oportunidad.clientes?.map((c) => c.clienteId) || [],
      })
    } else {
      setForm(EMPTY)
    }
  }, [visible, oportunidad])

  // Cargar los contactos existentes de la empresa elegida (solo si es una empresa real)
  useEffect(() => {
    if (!form.empresaId || form.empresaId === NUEVA_EMPRESA) { setClientesEmpresa([]); return }
    clienteService.getAll({ empresa_id: form.empresaId })
      .then((res) => setClientesEmpresa(res.data || []))
      .catch(() => setClientesEmpresa([]))
  }, [form.empresaId])

  const set = (field) => (e) => {
    const val = e.target?.value ?? e.value ?? e
    setForm((prev) => ({ ...prev, [field]: val }))
    setErrors((prev) => ({ ...prev, [field]: null }))
  }

  const handleEmpresaChange = (e) => {
    setForm((prev) => ({ ...prev, empresaId: e.value, clienteIds: [] }))
    setErrors((prev) => ({ ...prev, empresaId: null }))
    setContactosNuevos([])
    setContactoForm(null)
  }

  const validate = () => {
    const errs = {}
    if (!form.titulo?.trim()) errs.titulo = 'El título es requerido'
    if (!form.empresaId) errs.empresaId = 'La empresa es requerida'
    if (form.empresaId === NUEVA_EMPRESA && !nuevaEmpresaNombre.trim()) errs.empresaId = 'Escribe el nombre de la nueva empresa'
    if (!form.responsableId) errs.responsableId = 'El responsable es requerido'
    if (!form.fechaCreacion) errs.fechaCreacion = 'La fecha de creación es requerida'
    return errs
  }

  // ── Contacto nuevo cuando la empresa YA existe → se crea de una vez como Cliente real ──
  const guardarContactoExistente = async () => {
    if (!contactoForm?.nombre?.trim() || !contactoForm?.apellido?.trim()) return
    try {
      const res = await clienteService.create({
        nombre: contactoForm.nombre.trim(),
        apellido: contactoForm.apellido.trim(),
        cargo: contactoForm.cargo?.trim() || null,
        telefono: contactoForm.telefono?.trim() || null,
        mail: contactoForm.mail?.trim() || null,
        empresaId: form.empresaId,
      })
      const nuevoCliente = res.data
      setClientesEmpresa((prev) => [...prev, nuevoCliente])
      setForm((prev) => ({ ...prev, clienteIds: [...prev.clienteIds, nuevoCliente.id] }))
      setContactoForm(null)
    } catch (err) {
      setErrors((prev) => ({ ...prev, _global: err.response?.data?.message || 'Error al crear el contacto' }))
    }
  }

  // ── Contacto nuevo cuando la empresa TODAVÍA no existe → se guarda localmente y se crea junto con la oportunidad ──
  const agregarContactoLocal = () => {
    if (!contactoForm?.nombre?.trim() || !contactoForm?.apellido?.trim()) return
    setContactosNuevos((prev) => [...prev, { ...contactoForm }])
    setContactoForm(null)
  }

  const quitarContactoNuevo = (idx) => setContactosNuevos((prev) => prev.filter((_, i) => i !== idx))

  const handleSubmit = async () => {
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSaving(true)
    try {
      const payload = {
        titulo: form.titulo.trim(),
        origen: form.origen || null,
        valorEstimado: form.valorEstimado ?? null,
        responsableId: form.responsableId,
        fechaCreacion: form.fechaCreacion instanceof Date ? form.fechaCreacion.toISOString().slice(0, 10) : form.fechaCreacion,
        descripcion: form.descripcion?.trim() || null,
        clienteIds: form.clienteIds,
      }
      if (empresaEsNueva) {
        payload.empresaId = null
        payload.empresaNombreNueva = nuevaEmpresaNombre.trim()
        payload.contactosNuevos = contactosNuevos
      } else {
        payload.empresaId = form.empresaId
      }
      if (!isEdit) {
        payload.etapa = form.etapa
        if (form.etapa === 'Perdida') payload.motivoPerdida = motivoPerdidaInicial?.trim() || null
      }

      const res = isEdit
        ? await oportunidadService.update(oportunidad.id, payload)
        : await oportunidadService.create(payload)

      onSave(res)
    } catch (err) {
      const apiErrors = err.response?.data?.errors || {}
      const mapped = {}
      Object.keys(apiErrors).forEach((k) => { mapped[k] = apiErrors[k][0] })
      if (Object.keys(mapped).length > 0) setErrors(mapped)
      else setErrors({ _global: err.response?.data?.message || 'Error al guardar' })
    } finally {
      setSaving(false)
    }
  }

  const footer = (
    <div className="flex justify-content-end gap-2">
      <Button label="Cancelar" icon="pi pi-times" severity="secondary" outlined onClick={onHide} disabled={saving} />
      <Button label={isEdit ? 'Guardar cambios' : 'Crear oportunidad'} icon="pi pi-check" onClick={handleSubmit} loading={saving} />
    </div>
  )

  const empresaOptions = isEdit
    ? empresas.map((e) => ({ label: e.nombre, value: e.id }))
    : [{ label: '➕ Crear nueva empresa', value: NUEVA_EMPRESA }, ...empresas.map((e) => ({ label: e.nombre, value: e.id }))]

  return (
    <Dialog
      visible={visible}
      onHide={onHide}
      header={isEdit ? 'Editar Oportunidad' : 'Nueva Oportunidad'}
      style={{ width: '680px', maxWidth: '95vw' }}
      contentStyle={{ maxHeight: '75vh', overflowY: 'auto', padding: '1.25rem 1.5rem' }}
      footer={footer}
      modal
    >
      <div className="flex flex-column gap-3 mt-2">
        {errors._global && <div className="p-2 surface-100 border-round text-red-600 text-sm">{errors._global}</div>}

        <div className="flex flex-column gap-1">
          <label className="text-sm font-medium">Título de la oportunidad <span className="text-red-500">*</span></label>
          <InputText value={form.titulo} onChange={set('titulo')} placeholder="Ej. Consultoría de procesos logísticos" className={errors.titulo ? 'p-invalid' : ''} />
          {errors.titulo && <small className="text-red-500">{errors.titulo}</small>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isEdit ? '1fr' : '2fr 1fr', gap: '12px' }}>
          <div className="flex flex-column gap-1">
            <label className="text-sm font-medium">Empresa <span className="text-red-500">*</span></label>
            <Dropdown
              value={form.empresaId}
              options={empresaOptions}
              onChange={handleEmpresaChange}
              placeholder="Buscar o crear empresa"
              filter
              className={errors.empresaId ? 'p-invalid' : ''}
            />
            {empresaEsNueva && (
              <InputText
                value={nuevaEmpresaNombre}
                onChange={(e) => { setNuevaEmpresaNombre(e.target.value); setErrors((p) => ({ ...p, empresaId: null })) }}
                placeholder="Nombre legal de la nueva empresa (RUC)"
                className={`mt-1 ${errors.empresaId ? 'p-invalid' : ''}`}
              />
            )}
            {errors.empresaId && <small className="text-red-500">{errors.empresaId}</small>}
          </div>

          {!isEdit && (
            <div className="flex flex-column gap-1">
              <label className="text-sm font-medium">Etapa inicial</label>
              <Dropdown
                value={form.etapa}
                options={ETAPAS.map((e) => ({ label: ETAPA_CONFIG[e].label, value: e }))}
                onChange={set('etapa')}
                itemTemplate={(opt) => <EtapaTag etapa={opt.value} />}
                valueTemplate={(opt) => opt ? <EtapaTag etapa={opt.value} /> : <span className="text-color-secondary">Seleccionar</span>}
              />
            </div>
          )}
        </div>

        {!isEdit && form.etapa === ETAPA_HOOK && (
          <div className="flex align-items-start gap-2 p-3 border-round" style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
            <i className="pi pi-info-circle text-green-600 mt-1" />
            <div className="text-sm text-green-800">
              Al crearla directamente en <strong>Solicitud de RFP</strong>, GPRO generará automáticamente una <strong>Propuesta</strong> en estado Factibilidad, con esta empresa y estos contactos ya asignados.
            </div>
          </div>
        )}

        {!isEdit && form.etapa === 'Perdida' && (
          <div className="flex flex-column gap-1">
            <label className="text-sm font-medium">Motivo de pérdida (opcional)</label>
            <InputTextarea value={motivoPerdidaInicial} onChange={(e) => setMotivoPerdidaInicial(e.target.value)} placeholder="Ej. presupuesto insuficiente, eligió otro proveedor..." rows={2} autoResize />
          </div>
        )}

        {/* ── Contactos ── */}
        <div className="flex flex-column gap-2">
          <label className="text-sm font-medium">Puntos de contacto</label>

          {!empresaEsNueva && (
            <MultiSelect
              value={form.clienteIds}
              options={clientesEmpresa.map((c) => ({ label: `${c.nombre} ${c.apellido}${c.cargo ? ' · ' + c.cargo : ''}`, value: c.id }))}
              onChange={(e) => setForm((p) => ({ ...p, clienteIds: e.value }))}
              placeholder={form.empresaId ? 'Seleccionar contacto(s)' : 'Primero elige una empresa'}
              disabled={!form.empresaId}
              display="chip"
              filter
              filterPlaceholder="Buscar contacto..."
              emptyMessage="Sin contactos para esta empresa"
            />
          )}

          {empresaEsNueva && contactosNuevos.length > 0 && (
            <div className="flex flex-column gap-1">
              {contactosNuevos.map((c, idx) => (
                <div key={idx} className="flex align-items-center justify-content-between p-2 border-round surface-100">
                  <span className="text-sm">
                    {c.nombre} {c.apellido}{c.cargo ? ` · ${c.cargo}` : ''}{c.telefono ? ` · ${c.telefono}` : ''}{c.mail ? ` · ${c.mail}` : ''}
                  </span>
                  <Button icon="pi pi-trash" rounded text severity="danger" size="small" onClick={() => quitarContactoNuevo(idx)} />
                </div>
              ))}
            </div>
          )}

          {!contactoForm && (
            <Button
              label="Agregar contacto"
              icon="pi pi-user-plus"
              size="small"
              text
              disabled={!form.empresaId || (empresaEsNueva && !nuevaEmpresaNombre.trim())}
              onClick={() => setContactoForm({ ...CONTACTO_NUEVO_VACIO })}
            />
          )}

          {contactoForm && (
            <div className="flex flex-column gap-2 p-3 border-round" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <InputText value={contactoForm.nombre} onChange={(e) => setContactoForm((p) => ({ ...p, nombre: e.target.value }))} placeholder="Nombre *" />
                <InputText value={contactoForm.apellido} onChange={(e) => setContactoForm((p) => ({ ...p, apellido: e.target.value }))} placeholder="Apellido *" />
                <InputText value={contactoForm.cargo} onChange={(e) => setContactoForm((p) => ({ ...p, cargo: e.target.value }))} placeholder="Cargo (ej. Gerente de Compras)" />
                <InputText value={contactoForm.telefono} onChange={(e) => setContactoForm((p) => ({ ...p, telefono: e.target.value }))} placeholder="Teléfono" />
                <InputText value={contactoForm.mail} onChange={(e) => setContactoForm((p) => ({ ...p, mail: e.target.value }))} placeholder="Correo" style={{ gridColumn: '1 / -1' }} />
              </div>
              <div className="flex gap-2 justify-content-end">
                <Button label="Cancelar" size="small" severity="secondary" outlined onClick={() => setContactoForm(null)} />
                <Button
                  label="Guardar contacto"
                  icon="pi pi-check"
                  size="small"
                  disabled={!contactoForm.nombre?.trim() || !contactoForm.apellido?.trim()}
                  onClick={empresaEsNueva ? agregarContactoLocal : guardarContactoExistente}
                />
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="flex flex-column gap-1">
            <label className="text-sm font-medium">Origen</label>
            <Dropdown value={form.origen} options={ORIGEN_OPTIONS} onChange={set('origen')} placeholder="Seleccionar origen" showClear />
          </div>
          <div className="flex flex-column gap-1">
            <label className="text-sm font-medium">Valor estimado (USD)</label>
            <InputNumber value={form.valorEstimado} onValueChange={(e) => setForm((p) => ({ ...p, valorEstimado: e.value }))} mode="decimal" minFractionDigits={2} maxFractionDigits={2} placeholder="0.00" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="flex flex-column gap-1">
            <label className="text-sm font-medium">Responsable <span className="text-red-500">*</span></label>
            <Dropdown
              value={form.responsableId}
              options={empleados.map((e) => ({ label: `${e.nombre} ${e.apellido}`, value: e.id }))}
              onChange={set('responsableId')}
              placeholder="Seleccionar responsable" filter
              className={errors.responsableId ? 'p-invalid' : ''}
            />
            {errors.responsableId && <small className="text-red-500">{errors.responsableId}</small>}
          </div>
          <div className="flex flex-column gap-1">
            <label className="text-sm font-medium">Fecha de creación <span className="text-red-500">*</span></label>
            <Calendar value={form.fechaCreacion} onChange={set('fechaCreacion')} dateFormat="dd/mm/yy" className={errors.fechaCreacion ? 'p-invalid' : ''} />
            {errors.fechaCreacion && <small className="text-red-500">{errors.fechaCreacion}</small>}
          </div>
        </div>

        <div className="flex flex-column gap-1">
          <label className="text-sm font-medium">Descripción</label>
          <InputTextarea value={form.descripcion} onChange={set('descripcion')} placeholder="Detalle breve de lo que necesita el prospecto..." rows={3} autoResize />
        </div>

      </div>
    </Dialog>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/shared/OportunidadFormDialog.jsx
git commit -m "feat: OportunidadFormDialog usa Empresa/Cliente reales desde el primer registro"
```

---

### Task 7: Frontend — `CambiarEtapaOportunidadDialog.jsx` (reescritura completa)

**Files:**
- Modify: `src/components/shared/CambiarEtapaOportunidadDialog.jsx` (reemplazo completo del archivo)

- [ ] **Step 1: Reemplazar el archivo completo**

Reemplaza **todo el contenido** de `src/components/shared/CambiarEtapaOportunidadDialog.jsx` por:

```jsx
'use client'

import { useEffect, useState } from 'react'
import { Dialog } from 'primereact/dialog'
import { InputTextarea } from '@/components/shared/InputTextarea'
import { Button } from 'primereact/button'
import { Tag } from 'primereact/tag'
import { ETAPA_CONFIG, TRANSICIONES, ETAPA_HOOK } from '@/lib/oportunidades'

function EtapaTag({ etapa }) {
  const cfg = ETAPA_CONFIG[etapa] || { label: etapa, severity: 'secondary' }
  return <Tag value={cfg.label} severity={cfg.severity} style={cfg.color ? { background: cfg.color, color: '#fff' } : undefined} />
}

export default function CambiarEtapaOportunidadDialog({ visible, onHide, onConfirm, oportunidad, saving }) {
  const [destino, setDestino] = useState(null)
  const [nota, setNota] = useState('')
  const [motivoPerdida, setMotivoPerdida] = useState('')

  useEffect(() => {
    if (visible) { setDestino(null); setNota(''); setMotivoPerdida('') }
  }, [visible])

  if (!oportunidad) return null

  const etapaActual = oportunidad.etapa
  const permitidas = TRANSICIONES[etapaActual] || []
  const esHook = destino === ETAPA_HOOK
  const esSuspenso = destino === 'En_Suspenso'
  const esPerdida = destino === 'Perdida'

  const footer = (
    <div className="flex justify-content-end gap-2">
      <Button label="Cancelar" icon="pi pi-times" severity="secondary" outlined onClick={onHide} disabled={saving} />
      <Button
        label={esHook ? 'Confirmar y generar Propuesta' : 'Confirmar cambio'}
        icon="pi pi-check"
        severity={esHook ? 'success' : esPerdida ? 'danger' : 'primary'}
        onClick={() => onConfirm({ etapaNueva: destino, nota, motivoPerdida })}
        loading={saving}
        disabled={!destino}
      />
    </div>
  )

  return (
    <Dialog visible={visible} onHide={onHide} header={`Cambiar etapa · ${oportunidad.empresa?.nombre || ''}`} style={{ width: '480px', maxWidth: '95vw' }} footer={footer} modal>
      <div className="flex flex-column gap-3 mt-2">
        <div className="flex flex-column gap-1">
          <label className="text-sm font-medium">Etapa actual</label>
          <div><EtapaTag etapa={etapaActual} /></div>
        </div>

        <div className="flex flex-column gap-2">
          <label className="text-sm font-medium">Nueva etapa</label>
          <div className="flex flex-wrap gap-2">
            {permitidas.map((etapa) => {
              const cfg = ETAPA_CONFIG[etapa]
              const selected = destino === etapa
              return (
                <Button
                  key={etapa}
                  type="button"
                  label={cfg.label}
                  size="small"
                  outlined={!selected}
                  severity={cfg.severity === 'secondary' ? 'secondary' : cfg.severity}
                  style={selected && cfg.color ? { background: cfg.color, borderColor: cfg.color, color: '#fff' } : undefined}
                  onClick={() => setDestino(etapa)}
                />
              )
            })}
          </div>
        </div>

        {esHook && (
          <div className="flex align-items-start gap-2 p-3 border-round" style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
            <i className="pi pi-info-circle text-green-600 mt-1" />
            <div className="text-sm text-green-800">
              Al mover esta oportunidad a <strong>Solicitud de RFP</strong>, GPRO creará automáticamente una <strong>Propuesta</strong> en estado Factibilidad, con esta empresa, sus contactos, título y valor estimado ya precargados.
            </div>
          </div>
        )}

        {esSuspenso && (
          <div className="flex align-items-start gap-2 p-3 border-round" style={{ background: '#ede9fe', border: '1px solid #c4b5fd' }}>
            <i className="pi pi-info-circle mt-1" style={{ color: '#6d28d9' }} />
            <div className="text-sm" style={{ color: '#6d28d9' }}>
              La oportunidad puede reactivarse más adelante — "En Suspenso" no es un cierre definitivo.
            </div>
          </div>
        )}

        {esPerdida && (
          <div className="flex flex-column gap-1">
            <label className="text-sm font-medium">Motivo de pérdida</label>
            <InputTextarea value={motivoPerdida} onChange={(e) => setMotivoPerdida(e.target.value)} placeholder="Ej. presupuesto insuficiente, eligió otro proveedor..." rows={2} autoResize />
          </div>
        )}

        <div className="flex flex-column gap-1">
          <label className="text-sm font-medium">Nota (opcional)</label>
          <InputTextarea value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Detalle del cambio de etapa..." rows={2} autoResize />
        </div>
      </div>
    </Dialog>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/shared/CambiarEtapaOportunidadDialog.jsx
git commit -m "refactor: CambiarEtapaOportunidadDialog ya no pide empresa al llegar al gancho (ya es fija desde la creacion)"
```

---

### Task 8: Frontend — `oportunidades/page.jsx` (listado)

**Files:**
- Modify: `src/app/(dashboard)/oportunidades/page.jsx:88-97,114-126,240-317`

- [ ] **Step 1: Actualizar el cálculo de columnas derivadas**

Reemplaza:

```javascript
  const oportunidadesFiltradas = useMemo(() => {
    let lista = oportunidades
    if (etapaFiltro) lista = lista.filter((o) => o.etapa === etapaFiltro)
    if (responsableFiltro) lista = lista.filter((o) => o.responsableId === responsableFiltro)
    return lista.map((o) => ({
      ...o,
      responsableNombre: o.responsable ? `${o.responsable.nombre} ${o.responsable.apellido}` : '',
      contactoPrincipal: o.contactos?.[0]?.nombre || '',
    }))
  }, [oportunidades, etapaFiltro, responsableFiltro])
```

por:

```javascript
  const oportunidadesFiltradas = useMemo(() => {
    let lista = oportunidades
    if (etapaFiltro) lista = lista.filter((o) => o.etapa === etapaFiltro)
    if (responsableFiltro) lista = lista.filter((o) => o.responsableId === responsableFiltro)
    return lista.map((o) => ({
      ...o,
      responsableNombre: o.responsable ? `${o.responsable.nombre} ${o.responsable.apellido}` : '',
      contactoPrincipal: o.clientes?.[0]?.cliente ? `${o.clientes[0].cliente.nombre} ${o.clientes[0].cliente.apellido}` : '',
    }))
  }, [oportunidades, etapaFiltro, responsableFiltro])
```

- [ ] **Step 2: Quitar `empresaId` del handler de cambio de etapa**

Reemplaza:

```javascript
  const handleCambiarEtapa = async ({ etapaNueva, nota, motivoPerdida, empresaId }) => {
    setSavingEtapa(true)
    try {
      const res = await oportunidadService.cambiarEtapa(selected.id, { etapaNueva, nota, motivoPerdida, empresaId })
```

por:

```javascript
  const handleCambiarEtapa = async ({ etapaNueva, nota, motivoPerdida }) => {
    setSavingEtapa(true)
    try {
      const res = await oportunidadService.cambiarEtapa(selected.id, { etapaNueva, nota, motivoPerdida })
```

- [ ] **Step 3: Actualizar las columnas "Cliente" y "Contacto" del `DataTable`, y el `globalFilterFields`**

Reemplaza:

```jsx
        globalFilterFields={['titulo', 'empresaNombre', 'contactoPrincipal']}
```

por:

```jsx
        globalFilterFields={['titulo', 'empresa.nombre', 'contactoPrincipal']}
```

Reemplaza:

```jsx
        <Column field="empresaNombre" header="Cliente" sortable filter filterPlaceholder="Buscar cliente..." style={{ minWidth: '160px' }} body={(r) => r.empresaNombre} />
        <Column field="contactoPrincipal" header="Contacto" filter filterPlaceholder="Buscar contacto..." body={(r) => {
          const c0 = r.contactos?.[0]
          if (!c0) return <span className="text-color-secondary">—</span>
          const cargoTelefono = [c0.cargo, c0.telefono].filter(Boolean).join(' - ')
          return (
            <div>
              <div className="text-sm">{c0.nombre}</div>
              {cargoTelefono && <div className="text-xs text-color-secondary">{cargoTelefono}</div>}
              {r.contactos.length > 1 && <div className="text-xs" style={{ color: 'var(--primary-color)', fontWeight: 600 }}>+{r.contactos.length - 1} más</div>}
            </div>
          )
        }} />
```

por:

```jsx
        <Column field="empresa.nombre" header="Cliente" sortable filter filterPlaceholder="Buscar cliente..." style={{ minWidth: '160px' }} body={(r) => r.empresa?.nombre} />
        <Column field="contactoPrincipal" header="Contacto" filter filterPlaceholder="Buscar contacto..." body={(r) => {
          const c0 = r.clientes?.[0]?.cliente
          if (!c0) return <span className="text-color-secondary">—</span>
          const cargoTelefono = [c0.cargo, c0.telefono].filter(Boolean).join(' - ')
          return (
            <div>
              <div className="text-sm">{c0.nombre} {c0.apellido}</div>
              {cargoTelefono && <div className="text-xs text-color-secondary">{cargoTelefono}</div>}
              {r.clientes.length > 1 && <div className="text-xs" style={{ color: 'var(--primary-color)', fontWeight: 600 }}>+{r.clientes.length - 1} más</div>}
            </div>
          )
        }} />
```

- [ ] **Step 4: Quitar el prop `empresas` ya no usado por `CambiarEtapaOportunidadDialog`**

Reemplaza:

```jsx
      <CambiarEtapaOportunidadDialog
        visible={etapaDialogVisible}
        onHide={() => setEtapaDialogVisible(false)}
        onConfirm={handleCambiarEtapa}
        oportunidad={selected}
        saving={savingEtapa}
        empresas={empresas}
      />
```

por:

```jsx
      <CambiarEtapaOportunidadDialog
        visible={etapaDialogVisible}
        onHide={() => setEtapaDialogVisible(false)}
        onConfirm={handleCambiarEtapa}
        oportunidad={selected}
        saving={savingEtapa}
      />
```

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/oportunidades/page.jsx"
git commit -m "feat: listado de Oportunidades muestra empresa/contactos reales del catalogo"
```

---

### Task 9: Frontend — `oportunidades/[id]/page.jsx` (detalle)

**Files:**
- Modify: `src/app/(dashboard)/oportunidades/[id]/page.jsx:74-77,123,178-195,245-252`

- [ ] **Step 1: Quitar `empresaId` del handler de cambio de etapa**

Reemplaza:

```javascript
  const handleCambiarEtapa = async ({ etapaNueva, nota, motivoPerdida, empresaId }) => {
    setSavingEtapa(true)
    try {
      const res = await oportunidadService.cambiarEtapa(id, { etapaNueva, nota, motivoPerdida, empresaId })
```

por:

```javascript
  const handleCambiarEtapa = async ({ etapaNueva, nota, motivoPerdida }) => {
    setSavingEtapa(true)
    try {
      const res = await oportunidadService.cambiarEtapa(id, { etapaNueva, nota, motivoPerdida })
```

- [ ] **Step 2: Mostrar el nombre real de la empresa en el header**

Reemplaza:

```jsx
          <p className="text-color-secondary text-sm mt-1 mb-0">{oportunidad.empresaNombre}</p>
```

por:

```jsx
          <p className="text-color-secondary text-sm mt-1 mb-0">{oportunidad.empresa?.nombre}</p>
```

- [ ] **Step 3: Reescribir la sección "Contactos" para leer `oportunidad.clientes`**

Reemplaza:

```jsx
          <Card title="Contactos">
            {oportunidad.contactos?.length > 0 ? (
              <div className="flex flex-column gap-2">
                {oportunidad.contactos.map((c) => (
                  <div key={c.id} className="flex align-items-center gap-3 p-2 border-round surface-100">
                    <div className="flex align-items-center justify-content-center border-round-full flex-shrink-0 font-bold text-sm" style={{ width: '32px', height: '32px', background: 'var(--surface-200)' }}>
                      {c.nombre?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{c.nombre}</div>
                      <div className="text-xs text-color-secondary">{c.cargo}</div>
                      <div className="text-xs text-color-secondary">{[c.telefono, c.correo].filter(Boolean).join(' · ')}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-color-secondary text-sm m-0">Sin contactos registrados.</p>}
          </Card>
```

por:

```jsx
          <Card title="Contactos">
            {oportunidad.clientes?.length > 0 ? (
              <div className="flex flex-column gap-2">
                {oportunidad.clientes.map(({ cliente: c }) => (
                  <div key={c.id} className="flex align-items-center gap-3 p-2 border-round surface-100">
                    <div className="flex align-items-center justify-content-center border-round-full flex-shrink-0 font-bold text-sm" style={{ width: '32px', height: '32px', background: 'var(--surface-200)' }}>
                      {c.nombre?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{c.nombre} {c.apellido}</div>
                      {c.cargo && <div className="text-xs text-color-secondary">{c.cargo}</div>}
                      <div className="text-xs text-color-secondary">{[c.telefono, c.mail].filter(Boolean).join(' · ')}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-color-secondary text-sm m-0">Sin contactos registrados.</p>}
          </Card>
```

- [ ] **Step 4: Quitar el prop `empresas` ya no usado por `CambiarEtapaOportunidadDialog`**

Reemplaza:

```jsx
      <CambiarEtapaOportunidadDialog
        visible={etapaDialogVisible}
        onHide={() => setEtapaDialogVisible(false)}
        onConfirm={handleCambiarEtapa}
        oportunidad={oportunidad}
        saving={savingEtapa}
        empresas={empresas}
      />
```

por:

```jsx
      <CambiarEtapaOportunidadDialog
        visible={etapaDialogVisible}
        onHide={() => setEtapaDialogVisible(false)}
        onConfirm={handleCambiarEtapa}
        oportunidad={oportunidad}
        saving={savingEtapa}
      />
```

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/oportunidades/[id]/page.jsx"
git commit -m "feat: detalle de Oportunidad muestra empresa/contactos reales del catalogo"
```

---

### Task 10: Verificación manual end-to-end, versión y deploy

**Files:**
- Modify: `package.json` (versión)

- [ ] **Step 1: Correr toda la suite de Jest**

Run: `npm test`
Expected: todas las suites en verde, incluyendo la nueva `__tests__/rbac-catalogos-compartidos.test.js`.

- [ ] **Step 2: Levantar el servidor de desarrollo y probar el flujo completo a mano**

Run: `npm run dev`

Con sesión de admin (o un perfil con `oportunidades.crear`), en `/oportunidades`:
1. "Nueva Oportunidad" → elegir "➕ Crear nueva empresa", escribir un nombre, agregar un contacto nuevo (nombre+apellido+cargo), guardar. Verificar que la oportunidad aparece con el nombre de empresa y el contacto en las columnas "Cliente"/"Contacto".
2. Abrir `/clientes` y confirmar que la empresa nueva y su contacto quedaron creados ahí (con el cargo visible en `/clientes/<id>`).
3. Crear otra Oportunidad eligiendo esa MISMA empresa (ya existente) — el MultiSelect de contactos debe mostrar el contacto recién creado; agregar un segundo contacto con "Agregar contacto" (debe crearse de inmediato, sin esperar a guardar la oportunidad) y seleccionarlo.
4. Cambiar la etapa de una de las oportunidades a "Solicitud de RFP" — confirmar que el diálogo ya NO pide elegir empresa, y que la Propuesta generada en `/propuestas` trae la columna "Punto de contacto" ya poblada con los mismos contactos de la oportunidad.
5. Editar una oportunidad existente (sin propuesta aún) y confirmar que se puede cambiar a otra empresa ya existente del catálogo.

- [ ] **Step 3: Actualizar la versión (RN-07 / CLAUDE.md §2.1 — obligatorio antes de cada push a `main-azure`)**

En `package.json`, cambia:

```json
  "version": "1.8.2",
```

por (feature nueva → sube el MINOR):

```json
  "version": "1.9.0",
```

- [ ] **Step 4: Commit final de versión**

```bash
git add package.json
git commit -m "chore: bump version a 1.9.0"
```

- [ ] **Step 5: Push a `main-azure` y verificar el deploy**

```bash
git push origin main-azure
```

Verifica en Azure Portal → `gpro-app` → Centro de implementación → Registros que el deploy del último commit terminó en "Se realizó correctamente". Luego actualiza manualmente la Application Setting `NEXT_PUBLIC_APP_VERSION` a `1.9.0` en Azure Portal → `gpro-app` → Configuración (el build no la actualiza solo).
