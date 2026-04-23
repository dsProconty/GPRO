import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { tienePermiso, PERMISOS } from '@/lib/permisos'

// GET /api/v1/tarifarios?activo=true
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.TARIFARIOS.VER)) {
    return NextResponse.json({ success: false, message: 'Sin permiso' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const soloActivos = searchParams.get('activo') === 'true'

  const tarifarios = await prisma.tarifario.findMany({
    where: soloActivos ? { activo: true } : {},
    include: { _count: { select: { lineas: true } } },
    orderBy: { nombre: 'asc' },
  })

  return NextResponse.json({ success: true, data: tarifarios })
}

// POST /api/v1/tarifarios
export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.TARIFARIOS.CREAR)) {
    return NextResponse.json({ success: false, message: 'Sin permiso' }, { status: 403 })
  }

  const { nombre, descripcion, activo } = await request.json()

  if (!nombre?.trim()) {
    return NextResponse.json({ success: false, message: 'Datos inválidos', errors: { nombre: ['Requerido'] } }, { status: 422 })
  }

  const tarifario = await prisma.tarifario.create({
    data: {
      nombre:      nombre.trim(),
      descripcion: descripcion?.trim() || null,
      activo:      activo !== undefined ? Boolean(activo) : true,
    },
    include: { _count: { select: { lineas: true } } },
  })

  return NextResponse.json({ success: true, data: tarifario, message: 'Tarifario creado' }, { status: 201 })
}
