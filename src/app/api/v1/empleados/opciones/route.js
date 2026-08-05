import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/v1/empleados/opciones — lista mínima (id, nombre, apellido) para dropdowns
// Requiere solo sesión válida; no expone costos ni salarios
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })

  const empleados = await prisma.empleado.findMany({
    where: { activo: true },
    select: { id: true, nombre: true, apellido: true },
    orderBy: [{ nombre: 'asc' }, { apellido: 'asc' }],
  })

  return NextResponse.json({ success: true, data: empleados })
}
