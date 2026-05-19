import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/v1/admin/generar-codigos
 * Asigna retroactivamente códigos PRO/PRP a todos los registros existentes.
 * - Ordena por fechaCreacion ASC (los más antiguos reciben el menor consecutivo)
 * - Consecutivo separado por empresa + año + tipo (PRO vs PRP)
 * - Solo reasigna si force=true; si no, solo asigna los que no tienen código
 */
export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (session.user?.role !== 'admin') return NextResponse.json({ success: false, message: 'Solo administradores' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const force = body.force === true

  const resumen = { proyectosActualizados: 0, propuestasActualizadas: 0, errores: [] }

  // ── PROYECTOS ──────────────────────────────────────────────────────────────
  const proyectos = await prisma.proyecto.findMany({
    where: force ? {} : { codigo: null },
    select: { id: true, fechaCreacion: true, empresaId: true, codigo: true },
    orderBy: { fechaCreacion: 'asc' },
  })

  // Obtener todas las empresas con su codigoCliente
  const empresas = await prisma.empresa.findMany({ select: { id: true, codigoCliente: true } })
  const empresaMap = Object.fromEntries(empresas.map((e) => [e.id, (e.codigoCliente || 'XXX').toUpperCase()]))

  // Contadores por "PRO{yy}-{codigo}" para proyectos
  const contadoresProyecto = {}
  // Primero construir contadores con los registros que YA tienen código nuevo (si force=false)
  if (!force) {
    const conCodigo = await prisma.proyecto.findMany({
      where: { codigo: { not: null } },
      select: { codigo: true },
    })
    for (const r of conCodigo) {
      if (!r.codigo) continue
      const partes = r.codigo.split('-')
      if (partes.length < 3) continue
      const prefijo = partes.slice(0, 2).join('-')
      const num = parseInt(partes[partes.length - 1])
      if (!isNaN(num)) {
        contadoresProyecto[prefijo] = Math.max(contadoresProyecto[prefijo] || 0, num)
      }
    }
  }

  for (const p of proyectos) {
    try {
      const codigoEmpresa = empresaMap[p.empresaId] || 'XXX'
      const anio = String(new Date(p.fechaCreacion).getFullYear()).slice(2)
      const prefijo = `PRO${anio}-${codigoEmpresa}`
      contadoresProyecto[prefijo] = (contadoresProyecto[prefijo] || 0) + 1
      const codigo = `${prefijo}-${String(contadoresProyecto[prefijo]).padStart(3, '0')}`

      await prisma.proyecto.update({ where: { id: p.id }, data: { codigo } })
      resumen.proyectosActualizados++
    } catch (e) {
      resumen.errores.push(`Proyecto ${p.id}: ${e.message}`)
    }
  }

  // ── PROPUESTAS ─────────────────────────────────────────────────────────────
  const propuestas = await prisma.propuesta.findMany({
    where: force ? {} : { codigo: null },
    select: { id: true, fechaCreacion: true, empresaId: true, codigo: true },
    orderBy: { fechaCreacion: 'asc' },
  })

  const contadoresPropuesta = {}
  if (!force) {
    const conCodigo = await prisma.propuesta.findMany({
      where: { codigo: { not: null } },
      select: { codigo: true },
    })
    for (const r of conCodigo) {
      if (!r.codigo) continue
      const partes = r.codigo.split('-')
      if (partes.length < 3) continue
      const prefijo = partes.slice(0, 2).join('-')
      const num = parseInt(partes[partes.length - 1])
      if (!isNaN(num)) {
        contadoresPropuesta[prefijo] = Math.max(contadoresPropuesta[prefijo] || 0, num)
      }
    }
  }

  for (const p of propuestas) {
    try {
      const codigoEmpresa = empresaMap[p.empresaId] || 'XXX'
      const anio = String(new Date(p.fechaCreacion).getFullYear()).slice(2)
      const prefijo = `PRP${anio}-${codigoEmpresa}`
      contadoresPropuesta[prefijo] = (contadoresPropuesta[prefijo] || 0) + 1
      const codigo = `${prefijo}-${String(contadoresPropuesta[prefijo]).padStart(3, '0')}`

      await prisma.propuesta.update({ where: { id: p.id }, data: { codigo } })
      resumen.propuestasActualizadas++
    } catch (e) {
      resumen.errores.push(`Propuesta ${p.id}: ${e.message}`)
    }
  }

  return NextResponse.json({ success: true, data: resumen, message: `Códigos generados: ${resumen.proyectosActualizados} proyectos, ${resumen.propuestasActualizadas} propuestas` })
}
