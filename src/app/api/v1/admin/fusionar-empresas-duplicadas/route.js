import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/v1/admin/fusionar-empresas-duplicadas
 * Detecta empresas con el mismo nombre (case-insensitive),
 * conserva la de menor id y reasigna todos sus registros relacionados.
 */
export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (session.user?.role !== 'admin') return NextResponse.json({ success: false, message: 'Solo administradores' }, { status: 403 })

  const todas = await prisma.empresa.findMany({ orderBy: { id: 'asc' } })

  // Agrupar por nombre normalizado
  const grupos = {}
  for (const e of todas) {
    const key = e.nombre.toLowerCase().trim()
    if (!grupos[key]) grupos[key] = []
    grupos[key].push(e)
  }

  const duplicados = Object.values(grupos).filter((g) => g.length > 1)

  if (duplicados.length === 0) {
    return NextResponse.json({ success: true, data: { fusionadas: 0 }, message: 'No se encontraron empresas duplicadas' })
  }

  let fusionadas = 0
  const detalle = []

  for (const grupo of duplicados) {
    const [principal, ...extras] = grupo // el de menor id es el principal
    for (const dup of extras) {
      try {
        await prisma.$transaction(async (tx) => {
          // Reasignar clientes
          await tx.cliente.updateMany({ where: { empresaId: dup.id }, data: { empresaId: principal.id } })
          // Reasignar proyectos
          await tx.proyecto.updateMany({ where: { empresaId: dup.id }, data: { empresaId: principal.id } })
          // Reasignar propuestas
          await tx.propuesta.updateMany({ where: { empresaId: dup.id }, data: { empresaId: principal.id } })
          // Eliminar el duplicado
          await tx.empresa.delete({ where: { id: dup.id } })
        })
        fusionadas++
        detalle.push({ eliminado: `${dup.nombre} (id ${dup.id})`, conservado: `${principal.nombre} (id ${principal.id})` })
      } catch (e) {
        detalle.push({ error: `No se pudo eliminar id ${dup.id}: ${e.message}` })
      }
    }
  }

  return NextResponse.json({
    success: true,
    data: { fusionadas, detalle },
    message: `Se fusionaron ${fusionadas} empresa(s) duplicada(s)`,
  })
}
