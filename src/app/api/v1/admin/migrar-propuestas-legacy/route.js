import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ESTADO_MAP = {
  Elaboracion_Propuesta: 'Haciendo',
  Rechazado:             'Rechazada',
}

/**
 * POST /api/v1/admin/migrar-propuestas-legacy
 * Mueve los proyectos con estado Elaboracion_Propuesta o Rechazado
 * a la tabla propuestas donde corresponden.
 *
 * Por cada proyecto legacy:
 *  1. Crea un registro en `propuestas` con los datos del proyecto
 *  2. Copia los responsables a `propuesta_responsable`
 *  3. Elimina el proyecto (cascade borra pivots y observaciones)
 *
 * Si el proyecto tiene facturas: se omite y se reporta en `omitidos`
 * para revisión manual.
 *
 * Solo ejecutar UNA vez. Idempotente: si ya fue migrado no duplica.
 */
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (session.user?.role !== 'admin') {
    return NextResponse.json({ success: false, message: 'Solo administradores' }, { status: 403 })
  }

  const ESTADOS_LEGACY = ['Elaboracion_Propuesta', 'Rechazado']

  // Cargar proyectos legacy con todas sus relaciones
  const proyectosLegacy = await prisma.proyecto.findMany({
    where: { estado: { nombre: { in: ESTADOS_LEGACY } } },
    include: {
      estado:       { select: { nombre: true } },
      responsables: { select: { userId: true } },
      facturas:     { select: { id: true } },
    },
  })

  const migrados  = []
  const omitidos  = []
  const errores   = []

  for (const p of proyectosLegacy) {
    // Verificar que no existe ya una propuesta vinculada a este proyecto
    const yaExiste = await prisma.propuesta.findFirst({
      where: { proyectoId: p.id },
    })
    if (yaExiste) {
      omitidos.push({ id: p.id, detalle: p.detalle, razon: 'Ya migrado (propuesta existente vinculada)' })
      continue
    }

    // Si tiene facturas, no eliminar el proyecto — marcar para revisión
    if (p.facturas.length > 0) {
      omitidos.push({ id: p.id, detalle: p.detalle, razon: `Tiene ${p.facturas.length} factura(s) — revisión manual` })
      continue
    }

    const estadoPropuesta = ESTADO_MAP[p.estado?.nombre] || 'Haciendo'

    try {
      await prisma.$transaction(async (tx) => {
        // 1. Crear propuesta
        const propuesta = await tx.propuesta.create({
          data: {
            titulo:        p.detalle,
            empresaId:     p.empresaId,
            valorEstimado: p.valor,
            fechaCreacion: p.fechaCreacion,
            aplicativo:    p.aplicativo,
            estado:        estadoPropuesta,
            tipoPropuesta: 'PorHoras',
            responsables: {
              create: p.responsables.map((r) => ({ userId: r.userId })),
            },
          },
        })

        // 2. Eliminar proyecto (cascade: proyecto_cliente, proyecto_responsable, observaciones)
        await tx.proyecto.delete({ where: { id: p.id } })

        migrados.push({ id: propuesta.id, titulo: propuesta.titulo, estado: estadoPropuesta })
      })
    } catch (err) {
      errores.push({ id: p.id, detalle: p.detalle, error: err.message })
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      total:    proyectosLegacy.length,
      migrados: migrados.length,
      omitidos: omitidos.length,
      errores:  errores.length,
      detalle:  { migrados, omitidos, errores },
    },
    message: `Migración completada: ${migrados.length} propuestas creadas, ${omitidos.length} omitidas, ${errores.length} errores`,
  })
}
