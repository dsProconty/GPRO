import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const KEYS_VALIDOS = ['Factibilidad', 'Haciendo', 'Enviada', 'Aprobada', 'Rechazada']

// PUT /api/v1/configuracion/estados-propuesta/:key — renombrar label de estado
export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (session.user?.role !== 'admin') return NextResponse.json({ success: false, message: 'Solo administradores' }, { status: 403 })

  const key = params.key
  if (!KEYS_VALIDOS.includes(key)) {
    return NextResponse.json({ success: false, message: 'Clave de estado inválida' }, { status: 400 })
  }

  const { label, severity, icon } = await request.json()
  if (!label?.trim()) {
    return NextResponse.json({ success: false, message: 'El nombre es requerido', errors: { label: ['Requerido'] } }, { status: 422 })
  }

  const updated = await prisma.propuestaEstadoLabel.upsert({
    where:  { key },
    update: { label: label.trim(), severity: severity || 'secondary', icon: icon || 'pi-circle' },
    create: { key, label: label.trim(), severity: severity || 'secondary', icon: icon || 'pi-circle', orden: KEYS_VALIDOS.indexOf(key) + 1 },
  })

  return NextResponse.json({ success: true, data: updated, message: 'Label actualizado' })
}
