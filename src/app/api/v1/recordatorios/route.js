import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validarDestinatarios(str) {
  if (!str?.trim()) return false
  return str.split(',').map((e) => e.trim()).filter(Boolean).every((e) => EMAIL_REGEX.test(e))
}

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const proyectoId = searchParams.get('proyecto_id')
  if (!proyectoId) return NextResponse.json({ success: false, message: 'proyecto_id requerido' }, { status: 400 })

  try {
    const recordatorios = await prisma.recordatorioFactura.findMany({
      where: { proyectoId: parseInt(proyectoId) },
      include: { logs: { orderBy: { enviadoEn: 'desc' }, take: 1 } },
      orderBy: { diaMes: 'asc' },
    })
    return NextResponse.json({ success: true, data: recordatorios, message: '' })
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Error al cargar recordatorios' }, { status: 500 })
  }
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })

  const body = await request.json()
  const { proyectoId, diaMes, descripcion, destinatarios, activo = true } = body

  const errors = {}
  if (!proyectoId) errors.proyectoId = ['El proyecto es requerido']
  if (!diaMes || diaMes < 1 || diaMes > 28) errors.diaMes = ['El día debe ser entre 1 y 28']
  if (!descripcion?.trim()) errors.descripcion = ['La descripción es requerida']
  if (!destinatarios?.trim()) errors.destinatarios = ['Los destinatarios son requeridos']
  else if (!validarDestinatarios(destinatarios)) errors.destinatarios = ['Ingresa emails válidos separados por coma']

  if (Object.keys(errors).length > 0)
    return NextResponse.json({ success: false, message: 'Error de validación', errors }, { status: 422 })

  const proyecto = await prisma.proyecto.findUnique({ where: { id: parseInt(proyectoId) } })
  if (!proyecto) return NextResponse.json({ success: false, message: 'Proyecto no encontrado' }, { status: 422 })

  try {
    const recordatorio = await prisma.recordatorioFactura.create({
      data: {
        proyectoId: parseInt(proyectoId),
        diaMes: parseInt(diaMes),
        descripcion: descripcion.trim(),
        destinatarios: destinatarios.split(',').map((e) => e.trim()).filter(Boolean).join(', '),
        activo,
      },
    })
    return NextResponse.json({ success: true, data: recordatorio, message: 'Recordatorio creado' }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Error al crear recordatorio' }, { status: 500 })
  }
}
