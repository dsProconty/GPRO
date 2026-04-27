import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PUT /api/v1/perfiles-consultor/:id (admin)
export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (session.user?.role !== 'admin') return NextResponse.json({ success: false, message: 'Solo administradores' }, { status: 403 })

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const { nombre, nivel, costoHora, precioHora, activo } = await request.json()

  const errors = {}
  if (!nombre?.trim()) errors.nombre = ['Requerido']
  if (!nivel?.trim())  errors.nivel  = ['Requerido']

  if (Object.keys(errors).length) {
    return NextResponse.json({ success: false, message: 'Datos inválidos', errors }, { status: 422 })
  }

  const perfil = await prisma.perfilConsultor.update({
    where: { id },
    data: {
      nombre:     nombre.trim(),
      nivel:      nivel.trim(),
      costoHora:  Number(costoHora ?? 0),
      precioHora: Number(precioHora ?? 0),
      activo:     activo !== undefined ? Boolean(activo) : undefined,
    },
  })

  return NextResponse.json({ success: true, data: perfil, message: 'Perfil actualizado' })
}

// DELETE /api/v1/perfiles-consultor/:id (admin)
// Solo si no tiene líneas de caso de negocio asociadas
export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (session.user?.role !== 'admin') return NextResponse.json({ success: false, message: 'Solo administradores' }, { status: 403 })

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  const enUso = await prisma.casoNegocioLinea.count({ where: { perfilId: id } })
  if (enUso > 0) {
    return NextResponse.json({
      success: false,
      message: `Este perfil está en uso en ${enUso} caso(s) de negocio. Desactívalo en lugar de eliminarlo.`,
    }, { status: 409 })
  }

  await prisma.perfilConsultor.delete({ where: { id } })
  return NextResponse.json({ success: true, message: 'Perfil eliminado' })
}
