/**
 * pre-deploy.js — Corre ANTES de prisma db push en el build de Vercel.
 * Hace migraciones de datos que Prisma no puede manejar solo (columnas NOT NULL
 * en tablas con datos, reestructuración de PKs, etc.).
 * Todas las operaciones son idempotentes (seguras de correr varias veces).
 */
'use strict'

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function step(name, fn) {
  try {
    await fn()
    console.log(`✅ ${name}`)
  } catch (e) {
    console.warn(`⚠️  ${name} — ${e.message}`)
  }
}

async function main() {
  // ── Legacy: eliminar constraint de num_factura que Prisma mal-maneja ─────────
  await step('Drop facturas_num_factura_key', () => prisma.$executeRaw`
    ALTER TABLE facturas DROP CONSTRAINT IF EXISTS facturas_num_factura_key
  `)

  // ── Agregar columnas necesarias (idempotente) ────────────────────────────────
  await step('Add users.id_empleado', () => prisma.$executeRaw`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS id_empleado INTEGER
  `)
  await step('Add proyecto_responsable.id_empleado', () => prisma.$executeRaw`
    ALTER TABLE proyecto_responsable ADD COLUMN IF NOT EXISTS id_empleado INTEGER
  `)
  await step('Add propuesta_responsable.id_empleado', () => prisma.$executeRaw`
    ALTER TABLE propuesta_responsable ADD COLUMN IF NOT EXISTS id_empleado INTEGER
  `)
  await step('Add empresas.codigo_cliente', () => prisma.$executeRaw`
    ALTER TABLE empresas ADD COLUMN IF NOT EXISTS codigo_cliente VARCHAR(10)
  `)

  // ── Migrar responsables: crear empleados desde usuarios, vincular pivots ─────
  // Solo corre si hay filas en proyecto_responsable SIN id_empleado
  // (en una BD vacía la tabla puede no existir aún → capturamos el error)
  let pendientes = 0
  try {
    const [row] = await prisma.$queryRaw`
      SELECT COUNT(*)::int as count FROM proyecto_responsable WHERE id_empleado IS NULL
    `
    pendientes = row?.count ?? 0
  } catch {
    console.log('ℹ️  proyecto_responsable no existe aún — se creará con prisma db push')
  }

  if (pendientes > 0) {
    console.log(`ℹ️  Encontradas ${pendientes} filas en proyecto_responsable sin id_empleado — migrando...`)

    // Crear empleados para cada usuario que no tenga uno
    const usuarios = await prisma.$queryRaw`
      SELECT id, name, email, id_empleado FROM users
    `

    for (const u of usuarios) {
      if (u.id_empleado) continue

      const partes = (u.name || '').trim().split(/\s+/)
      const nombre   = partes[0] || 'Sin nombre'
      const apellido = partes.slice(1).join(' ') || '—'

      // Buscar por email primero
      let [empleado] = u.email
        ? await prisma.$queryRaw`SELECT id FROM empleados WHERE email = ${u.email} LIMIT 1`
        : []

      if (!empleado) {
        const [nuevo] = await prisma.$queryRaw`
          INSERT INTO empleados (nombre, apellido, email, costo_hora, activo, created_at, updated_at)
          VALUES (${nombre}, ${apellido}, ${u.email || null}, 0, true, NOW(), NOW())
          RETURNING id
        `
        empleado = nuevo
        console.log(`  ✅ Empleado creado: ${nombre} ${apellido}`)
      }

      await prisma.$executeRaw`UPDATE users SET id_empleado = ${empleado.id} WHERE id = ${u.id}`
    }

    // Rellenar id_empleado en proyecto_responsable
    await step('Populate proyecto_responsable.id_empleado', () => prisma.$executeRaw`
      UPDATE proyecto_responsable pr
      SET    id_empleado = u.id_empleado
      FROM   users u
      WHERE  pr.id_user = u.id
        AND  pr.id_empleado IS NULL
        AND  u.id_empleado IS NOT NULL
    `)
    // Eliminar huérfanos (usuario sin empleado)
    await step('Delete orphan rows in proyecto_responsable', () => prisma.$executeRaw`
      DELETE FROM proyecto_responsable WHERE id_empleado IS NULL
    `)

    // Rellenar id_empleado en propuesta_responsable
    await step('Populate propuesta_responsable.id_empleado', () => prisma.$executeRaw`
      UPDATE propuesta_responsable pr
      SET    id_empleado = u.id_empleado
      FROM   users u
      WHERE  pr.id_user = u.id
        AND  pr.id_empleado IS NULL
        AND  u.id_empleado IS NOT NULL
    `)
    await step('Delete orphan rows in propuesta_responsable', () => prisma.$executeRaw`
      DELETE FROM propuesta_responsable WHERE id_empleado IS NULL
    `)
  } else {
    console.log('ℹ️  proyecto_responsable ya migrado — omitiendo creación de empleados')
  }

  // ── Reestructurar PK de proyecto_responsable ─────────────────────────────────
  // Detectar si la PK actual todavía usa id_user
  let pkProyecto = null
  try {
    ;[pkProyecto] = await prisma.$queryRaw`
      SELECT kcu.column_name
      FROM   information_schema.table_constraints tc
      JOIN   information_schema.key_column_usage kcu
             ON tc.constraint_name = kcu.constraint_name
      WHERE  tc.table_name = 'proyecto_responsable'
        AND  tc.constraint_type = 'PRIMARY KEY'
        AND  kcu.column_name = 'id_user'
      LIMIT 1
    `
  } catch { /* tabla no existe aún */ }

  if (pkProyecto) {
    await step('Drop old PK proyecto_responsable', () => prisma.$executeRaw`
      ALTER TABLE proyecto_responsable DROP CONSTRAINT IF EXISTS proyecto_responsable_pkey
    `)
    await step('Set id_empleado NOT NULL en proyecto_responsable', () => prisma.$executeRaw`
      ALTER TABLE proyecto_responsable ALTER COLUMN id_empleado SET NOT NULL
    `)
    await step('Add new PK (id_negocio, id_empleado) en proyecto_responsable', () => prisma.$executeRaw`
      ALTER TABLE proyecto_responsable ADD PRIMARY KEY (id_negocio, id_empleado)
    `)
    await step('Drop id_user column de proyecto_responsable', () => prisma.$executeRaw`
      ALTER TABLE proyecto_responsable DROP COLUMN IF EXISTS id_user
    `)
  } else {
    console.log('ℹ️  PK de proyecto_responsable ya migrada — omitiendo')
  }

  // ── Reestructurar PK de propuesta_responsable ─────────────────────────────────
  let pkPropuesta = null
  try {
    ;[pkPropuesta] = await prisma.$queryRaw`
      SELECT kcu.column_name
      FROM   information_schema.table_constraints tc
      JOIN   information_schema.key_column_usage kcu
             ON tc.constraint_name = kcu.constraint_name
      WHERE  tc.table_name = 'propuesta_responsable'
        AND  tc.constraint_type = 'PRIMARY KEY'
        AND  kcu.column_name = 'id_user'
      LIMIT 1
    `
  } catch { /* tabla no existe aún */ }

  if (pkPropuesta) {
    await step('Drop old PK propuesta_responsable', () => prisma.$executeRaw`
      ALTER TABLE propuesta_responsable DROP CONSTRAINT IF EXISTS propuesta_responsable_pkey
    `)
    await step('Set id_empleado NOT NULL en propuesta_responsable', () => prisma.$executeRaw`
      ALTER TABLE propuesta_responsable ALTER COLUMN id_empleado SET NOT NULL
    `)
    await step('Add new PK (id_propuesta, id_empleado) en propuesta_responsable', () => prisma.$executeRaw`
      ALTER TABLE propuesta_responsable ADD PRIMARY KEY (id_propuesta, id_empleado)
    `)
    await step('Drop id_user column de propuesta_responsable', () => prisma.$executeRaw`
      ALTER TABLE propuesta_responsable DROP COLUMN IF EXISTS id_user
    `)
  } else {
    console.log('ℹ️  PK de propuesta_responsable ya migrada — omitiendo')
  }

  // ── FK constraints (idempotentes) ────────────────────────────────────────────
  await step('FK fk_pr_empleado', () => prisma.$executeRaw`
    ALTER TABLE proyecto_responsable
      DROP CONSTRAINT IF EXISTS fk_pr_empleado,
      ADD  CONSTRAINT fk_pr_empleado
        FOREIGN KEY (id_empleado) REFERENCES empleados(id) ON DELETE CASCADE
  `)
  await step('FK fk_propuesta_r_empleado', () => prisma.$executeRaw`
    ALTER TABLE propuesta_responsable
      DROP CONSTRAINT IF EXISTS fk_propuesta_r_empleado,
      ADD  CONSTRAINT fk_propuesta_r_empleado
        FOREIGN KEY (id_empleado) REFERENCES empleados(id) ON DELETE CASCADE
  `)
  await step('FK fk_user_empleado', () => prisma.$executeRaw`
    ALTER TABLE users
      DROP CONSTRAINT IF EXISTS fk_user_empleado,
      ADD  CONSTRAINT fk_user_empleado
        FOREIGN KEY (id_empleado) REFERENCES empleados(id) ON DELETE SET NULL
  `)

  console.log('pre-deploy: completado')
}

main()
  .catch(e => {
    console.error('pre-deploy FATAL:', e.message)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
