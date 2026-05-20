import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/v1/admin/migrar-responsables-a-empleados
 *
 * Migración completa en 6 pasos:
 * 1. Agrega columnas id_empleado a users, proyecto_responsable, propuesta_responsable
 * 2. Crea empleados para cada usuario (por email si ya existe, o nuevo si no)
 * 3. Vincula users.id_empleado → empleados.id
 * 4. Rellena id_empleado en las tablas pivot
 * 5. Reestructura las PKs (elimina id_user, pone id_empleado)
 * 6. Agrega FK constraints
 */
export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (session.user?.role !== 'admin') return NextResponse.json({ success: false, message: 'Solo administradores' }, { status: 403 })

  const log = []

  try {
    // ── Verificar si la migración ya se completó (id_user ya no existe) ────────
    const [yaCompletada] = await prisma.$queryRaw`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'proyecto_responsable' AND column_name = 'id_user'
      LIMIT 1
    `
    if (!yaCompletada) {
      log.push('ℹ️  Migración ya completada anteriormente (id_user no existe en las tablas pivot)')
      return NextResponse.json({ success: true, data: { log }, message: 'La migración ya estaba completa' })
    }

    // ── PASO 1: Agregar columnas id_empleado (idempotente con IF NOT EXISTS) ──
    await prisma.$executeRaw`ALTER TABLE users ADD COLUMN IF NOT EXISTS id_empleado INTEGER`
    await prisma.$executeRaw`ALTER TABLE proyecto_responsable ADD COLUMN IF NOT EXISTS id_empleado INTEGER`
    await prisma.$executeRaw`ALTER TABLE propuesta_responsable ADD COLUMN IF NOT EXISTS id_empleado INTEGER`
    log.push('✅ Paso 1: columnas agregadas')

    // ── PASO 2 & 3: Crear empleados desde users, vincular ────────────────────
    const usuarios = await prisma.user.findMany({ select: { id: true, name: true, email: true, empleadoId: true } })

    for (const u of usuarios) {
      if (u.empleadoId) continue // ya vinculado

      // Dividir name en nombre + apellido
      const partes = (u.name || '').trim().split(/\s+/)
      const nombre   = partes[0] || 'Sin nombre'
      const apellido = partes.slice(1).join(' ') || '—'

      // Buscar empleado existente por email
      let empleado = u.email
        ? await prisma.empleado.findFirst({ where: { email: u.email } })
        : null

      if (!empleado) {
        empleado = await prisma.empleado.create({
          data: { nombre, apellido, email: u.email || null, costoHora: 0, activo: true },
        })
        log.push(`✅ Empleado creado: ${nombre} ${apellido} (user id=${u.id})`)
      } else {
        log.push(`ℹ️  Empleado existente reutilizado: ${empleado.nombre} ${empleado.apellido} (user id=${u.id})`)
      }

      await prisma.$executeRaw`UPDATE users SET id_empleado = ${empleado.id} WHERE id = ${u.id}`
    }
    log.push('✅ Paso 2-3: empleados vinculados a usuarios')

    // ── PASO 4: Rellenar id_empleado en proyecto_responsable ─────────────────
    await prisma.$executeRaw`
      UPDATE proyecto_responsable pr
      SET    id_empleado = u.id_empleado
      FROM   users u
      WHERE  pr.id_user = u.id
        AND  pr.id_empleado IS NULL
        AND  u.id_empleado IS NOT NULL
    `
    // Filas huérfanas (usuario sin empleado vinculado): eliminar
    await prisma.$executeRaw`
      DELETE FROM proyecto_responsable WHERE id_empleado IS NULL AND id_user IS NOT NULL
    `
    log.push('✅ Paso 4a: proyecto_responsable actualizado')

    // ── PASO 4b: Rellenar id_empleado en propuesta_responsable ───────────────
    await prisma.$executeRaw`
      UPDATE propuesta_responsable pr
      SET    id_empleado = u.id_empleado
      FROM   users u
      WHERE  pr.id_user = u.id
        AND  pr.id_empleado IS NULL
        AND  u.id_empleado IS NOT NULL
    `
    await prisma.$executeRaw`
      DELETE FROM propuesta_responsable WHERE id_empleado IS NULL AND id_user IS NOT NULL
    `
    log.push('✅ Paso 4b: propuesta_responsable actualizado')

    // ── PASO 5: Reestructurar PKs ─────────────────────────────────────────────
    // proyecto_responsable
    await prisma.$executeRaw`ALTER TABLE proyecto_responsable DROP CONSTRAINT IF EXISTS proyecto_responsable_pkey`
    await prisma.$executeRaw`ALTER TABLE proyecto_responsable ALTER COLUMN id_empleado SET NOT NULL`
    await prisma.$executeRaw`ALTER TABLE proyecto_responsable ADD PRIMARY KEY (id_negocio, id_empleado)`
    await prisma.$executeRaw`ALTER TABLE proyecto_responsable DROP COLUMN IF EXISTS id_user`
    log.push('✅ Paso 5a: PK proyecto_responsable reestructurada')

    // propuesta_responsable
    await prisma.$executeRaw`ALTER TABLE propuesta_responsable DROP CONSTRAINT IF EXISTS propuesta_responsable_pkey`
    await prisma.$executeRaw`ALTER TABLE propuesta_responsable ALTER COLUMN id_empleado SET NOT NULL`
    await prisma.$executeRaw`ALTER TABLE propuesta_responsable ADD PRIMARY KEY (id_propuesta, id_empleado)`
    await prisma.$executeRaw`ALTER TABLE propuesta_responsable DROP COLUMN IF EXISTS id_user`
    log.push('✅ Paso 5b: PK propuesta_responsable reestructurada')

    // ── PASO 6: FK constraints ────────────────────────────────────────────────
    await prisma.$executeRaw`
      ALTER TABLE proyecto_responsable
        DROP CONSTRAINT IF EXISTS fk_pr_empleado,
        ADD  CONSTRAINT fk_pr_empleado
          FOREIGN KEY (id_empleado) REFERENCES empleados(id) ON DELETE CASCADE
    `
    await prisma.$executeRaw`
      ALTER TABLE propuesta_responsable
        DROP CONSTRAINT IF EXISTS fk_propuesta_r_empleado,
        ADD  CONSTRAINT fk_propuesta_r_empleado
          FOREIGN KEY (id_empleado) REFERENCES empleados(id) ON DELETE CASCADE
    `
    await prisma.$executeRaw`
      ALTER TABLE users
        DROP CONSTRAINT IF EXISTS fk_user_empleado,
        ADD  CONSTRAINT fk_user_empleado
          FOREIGN KEY (id_empleado) REFERENCES empleados(id) ON DELETE SET NULL
    `
    log.push('✅ Paso 6: FK constraints agregadas')

    return NextResponse.json({ success: true, data: { log }, message: 'Migración completada exitosamente' })
  } catch (error) {
    log.push(`❌ Error: ${error.message}`)
    return NextResponse.json({ success: false, data: { log }, message: error.message }, { status: 500 })
  }
}
