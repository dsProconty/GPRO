import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PUT /api/v1/configuracion/empresa — actualizar datos de la empresa (admin)
export async function PUT(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (session.user?.role !== 'admin') return NextResponse.json({ success: false, message: 'Solo administradores' }, { status: 403 })

  const { nombre, moneda, logoUrl, direccion, telefono, email } = await request.json()

  if (!nombre?.trim()) {
    return NextResponse.json({ success: false, message: 'El nombre es requerido', errors: { nombre: ['Requerido'] } }, { status: 422 })
  }

  const empresa = await prisma.configuracionEmpresa.upsert({
    where:  { id: 1 },
    update: {
      nombre:    nombre.trim(),
      moneda:    moneda || 'USD',
      logoUrl:   logoUrl?.trim() || null,
      direccion: direccion?.trim() || null,
      telefono:  telefono?.trim() || null,
      email:     email?.trim() || null,
    },
    create: {
      id:        1,
      nombre:    nombre.trim(),
      moneda:    moneda || 'USD',
      logoUrl:   logoUrl?.trim() || null,
      direccion: direccion?.trim() || null,
      telefono:  telefono?.trim() || null,
      email:     email?.trim() || null,
    },
  })

  return NextResponse.json({ success: true, data: empresa, message: 'Configuración de empresa actualizada' })
}
