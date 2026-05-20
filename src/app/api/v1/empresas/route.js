import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { tienePermiso, PERMISOS } from '@/lib/permisos'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.EMPRESAS.VER)) {
    return NextResponse.json({ success: false, message: 'Sin permiso para ver empresas' }, { status: 403 })
  }

  const todas = await prisma.empresa.findMany({
    orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
    include: { _count: { select: { clientes: true } } },
  })

  // Deduplicar por nombre (conservar el registro con menor id por nombre)
  const seen = new Set()
  const empresas = todas.filter((e) => {
    const key = e.nombre.toLowerCase().trim()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return NextResponse.json({ success: true, data: empresas, message: '' })
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  }
  if (!tienePermiso(session, PERMISOS.EMPRESAS.CREAR)) {
    return NextResponse.json({ success: false, message: 'No tiene permiso para crear empresas' }, { status: 403 })
  }

  const { nombre, ciudad, codigoCliente } = await request.json()

  if (!nombre || nombre.trim() === '') {
    return NextResponse.json(
      { success: false, message: 'El nombre es requerido', errors: { nombre: ['El nombre es requerido'] } },
      { status: 422 }
    )
  }

  const empresa = await prisma.empresa.create({
    data: {
      nombre: nombre.trim(),
      ciudad: ciudad?.trim() || null,
      codigoCliente: codigoCliente?.trim().toUpperCase() || null,
    },
  })

  return NextResponse.json(
    { success: true, data: empresa, message: 'Empresa creada exitosamente' },
    { status: 201 }
  )
}
