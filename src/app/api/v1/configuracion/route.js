import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Defaults usados para auto-seed si la tabla está vacía
const PROPUESTA_LABEL_DEFAULTS = [
  { key: 'Factibilidad', label: 'Factibilidad',        severity: 'warning',   icon: 'pi-lightbulb',    orden: 1 },
  { key: 'Haciendo',     label: 'Generando Propuesta', severity: 'info',      icon: 'pi-cog',          orden: 2 },
  { key: 'Enviada',      label: 'Propuesta Enviada',   severity: 'secondary', icon: 'pi-send',         orden: 3 },
  { key: 'Aprobada',     label: 'Propuesta Aceptada',  severity: 'success',   icon: 'pi-check-circle', orden: 4 },
  { key: 'Rechazada',    label: 'Propuesta Rechazada', severity: 'danger',    icon: 'pi-times-circle', orden: 5 },
]

// GET /api/v1/configuracion — devuelve estados de proyecto + labels de propuesta
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })

  // Auto-seed propuesta labels si la tabla está vacía
  const count = await prisma.propuestaEstadoLabel.count()
  if (count === 0) {
    await prisma.propuestaEstadoLabel.createMany({ data: PROPUESTA_LABEL_DEFAULTS })
  }

  // Auto-seed ConfiguracionEmpresa si no existe
  const empCount = await prisma.configuracionEmpresa.count()
  if (empCount === 0) {
    await prisma.configuracionEmpresa.create({ data: { id: 1, nombre: 'Mi Empresa', moneda: 'USD' } })
  }

  const [estadosProyecto, estadosPropuesta, empresa] = await Promise.all([
    prisma.estado.findMany({ orderBy: { id: 'asc' } }),
    prisma.propuestaEstadoLabel.findMany({ orderBy: { orden: 'asc' } }),
    prisma.configuracionEmpresa.findUnique({ where: { id: 1 } }),
  ])

  return NextResponse.json({
    success: true,
    data: { estadosProyecto, estadosPropuesta, empresa },
    message: '',
  })
}

// POST /api/v1/configuracion — crear nuevo estado de proyecto (admin)
export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (session.user?.role !== 'admin') return NextResponse.json({ success: false, message: 'Solo administradores' }, { status: 403 })

  const { nombre, descripcion, color } = await request.json()

  if (!nombre?.trim()) {
    return NextResponse.json({ success: false, message: 'El nombre es requerido', errors: { nombre: ['Requerido'] } }, { status: 422 })
  }

  const data = {
    nombre:      nombre.trim(),
    descripcion: descripcion?.trim() || null,
    color:       color || 'secondary',
  }

  let estado
  try {
    estado = await prisma.estado.create({ data })
  } catch (e) {
    // Los estados se seedean/migran con id explícito (1..N), lo que deja la secuencia
    // SERIAL atrasada y el siguiente INSERT choca con un id existente (P2002 en id_estado).
    // Se resincroniza la secuencia al máximo actual y se reintenta una sola vez.
    const choqueDeId = e?.code === 'P2002' && String(e?.meta?.target ?? '').includes('id_estado')
    if (!choqueDeId) throw e
    await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('estados', 'id_estado'), (SELECT COALESCE(MAX(id_estado), 1) FROM estados))`
    estado = await prisma.estado.create({ data })
  }

  return NextResponse.json({ success: true, data: estado, message: 'Estado creado exitosamente' }, { status: 201 })
}
