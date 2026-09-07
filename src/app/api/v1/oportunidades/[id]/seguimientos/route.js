import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { tienePermiso, PERMISOS } from '@/lib/permisos'
import { logPermisoDenegado } from '@/lib/logger'

// GET /api/v1/oportunidades/:id/seguimientos
export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.OPORTUNIDADES.VER)) {
    logPermisoDenegado(session, PERMISOS.OPORTUNIDADES.VER, `GET /oportunidades/${params.id}/seguimientos`)
    return NextResponse.json({ success: false, message: 'Sin permiso para ver oportunidades' }, { status: 403 })
  }

  const oportunidadId = parseInt(params.id)
  if (isNaN(oportunidadId)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const seguimientos = await prisma.oportunidadSeguimiento.findMany({
    where: { oportunidadId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ success: true, data: seguimientos, message: '' })
}

// POST /api/v1/oportunidades/:id/seguimientos — RN-O06: solo insert, inmutable
export async function POST(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.OPORTUNIDADES.EDITAR)) {
    logPermisoDenegado(session, PERMISOS.OPORTUNIDADES.EDITAR, `POST /oportunidades/${params.id}/seguimientos`)
    return NextResponse.json({ success: false, message: 'No tiene permiso para registrar seguimientos' }, { status: 403 })
  }

  const oportunidadId = parseInt(params.id)
  if (isNaN(oportunidadId)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const { descripcion } = await request.json()
  if (!descripcion?.trim()) {
    return NextResponse.json({ success: false, message: 'Error de validación', errors: { descripcion: ['La descripción es requerida'] } }, { status: 422 })
  }

  const existe = await prisma.oportunidad.findUnique({ where: { id: oportunidadId }, select: { id: true } })
  if (!existe) return NextResponse.json({ success: false, message: 'Oportunidad no encontrada' }, { status: 404 })

  const seguimiento = await prisma.oportunidadSeguimiento.create({
    data: {
      oportunidadId,
      descripcion: descripcion.trim(),
      userId: parseInt(session.user.id), // del token, nunca del body
    },
    include: { user: { select: { id: true, name: true } } },
  })

  return NextResponse.json({ success: true, data: seguimiento, message: 'Seguimiento registrado' }, { status: 201 })
}

// RN-O06: sin PUT ni DELETE — 405 explícito
export async function PUT() {
  return NextResponse.json({ success: false, message: 'Los seguimientos son inmutables' }, { status: 405 })
}
export async function DELETE() {
  return NextResponse.json({ success: false, message: 'Los seguimientos son inmutables' }, { status: 405 })
}
