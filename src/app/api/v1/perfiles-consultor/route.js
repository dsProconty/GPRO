import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/v1/perfiles-consultor?activo=true
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const soloActivos = searchParams.get('activo') === 'true'

  const perfiles = await prisma.perfilConsultor.findMany({
    where: soloActivos ? { activo: true } : {},
    orderBy: [{ nombre: 'asc' }, { nivel: 'asc' }],
  })

  return NextResponse.json({ success: true, data: perfiles })
}

// POST /api/v1/perfiles-consultor (admin)
export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (session.user?.role !== 'admin') return NextResponse.json({ success: false, message: 'Solo administradores' }, { status: 403 })

  const { nombre, nivel, costoHora, precioHora } = await request.json()

  const errors = {}
  if (!nombre?.trim()) errors.nombre = ['Requerido']
  if (!nivel?.trim())  errors.nivel  = ['Requerido']

  if (Object.keys(errors).length) {
    return NextResponse.json({ success: false, message: 'Datos inválidos', errors }, { status: 422 })
  }

  const perfil = await prisma.perfilConsultor.create({
    data: {
      nombre:     nombre.trim(),
      nivel:      nivel.trim(),
      costoHora:  Number(costoHora ?? 0),
      precioHora: Number(precioHora ?? 0),
    },
  })

  return NextResponse.json({ success: true, data: perfil, message: 'Perfil creado' }, { status: 201 })
}
