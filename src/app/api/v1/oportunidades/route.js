import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { tienePermiso, PERMISOS } from '@/lib/permisos'
import { logPermisoDenegado } from '@/lib/logger'
import { ETAPAS, ETAPA_HOOK } from '@/lib/oportunidades'
import { generarCodigoPropuesta } from '@/lib/codigoHelper'

const OPORTUNIDAD_INCLUDE = {
  responsable: { select: { id: true, nombre: true, apellido: true } },
  contactos: true,
  propuesta: { select: { id: true, codigo: true, estado: true } },
  seguimientos: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
}

const serializeOportunidad = (o) => ({
  ...o,
  valorEstimado: o.valorEstimado != null ? Number(o.valorEstimado) : null,
  ultimoSeguimiento: o.seguimientos?.[0]?.createdAt ?? null,
  seguimientos: undefined,
})

// GET /api/v1/oportunidades?etapa=&responsable_id=
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.OPORTUNIDADES.VER)) {
    logPermisoDenegado(session, PERMISOS.OPORTUNIDADES.VER, 'GET /oportunidades')
    return NextResponse.json({ success: false, message: 'Sin permiso para ver oportunidades' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const etapa = searchParams.get('etapa')
  const responsableId = searchParams.get('responsable_id')

  const where = {}
  if (etapa) where.etapa = etapa
  if (responsableId && !isNaN(parseInt(responsableId))) where.responsableId = parseInt(responsableId)

  const oportunidades = await prisma.oportunidad.findMany({
    where,
    include: OPORTUNIDAD_INCLUDE,
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ success: true, data: oportunidades.map(serializeOportunidad), message: '' })
}

// POST /api/v1/oportunidades
export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.OPORTUNIDADES.CREAR)) {
    logPermisoDenegado(session, PERMISOS.OPORTUNIDADES.CREAR, 'POST /oportunidades')
    return NextResponse.json({ success: false, message: 'No tiene permiso para crear oportunidades' }, { status: 403 })
  }

  const {
    titulo, empresaNombre, origen, descripcion, valorEstimado,
    responsableId, fechaCreacion, contactos = [], etapa, motivoPerdida,
  } = await request.json()

  const errors = {}
  if (!titulo?.trim()) errors.titulo = ['El título es requerido']
  if (!empresaNombre?.trim()) errors.empresaNombre = ['La empresa es requerida']
  if (!responsableId) errors.responsableId = ['El responsable es requerido']
  if (!fechaCreacion) errors.fechaCreacion = ['La fecha de creación es requerida']

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ success: false, message: 'Error de validación', errors }, { status: 422 })
  }

  const etapaInicial = ETAPAS.includes(etapa) ? etapa : 'Prospeccion'
  const userId = parseInt(session.user.id)

  const contactosData = contactos
    .filter((c) => c.nombre?.trim())
    .map((c) => ({
      nombre: c.nombre.trim(),
      cargo: c.cargo?.trim() || null,
      telefono: c.telefono?.trim() || null,
      correo: c.correo?.trim() || null,
    }))

  const datosBase = {
    titulo: titulo.trim(),
    empresaNombre: empresaNombre.trim(),
    origen: origen?.trim() || null,
    descripcion: descripcion?.trim() || null,
    valorEstimado: valorEstimado != null ? parseFloat(valorEstimado) : null,
    responsableId: parseInt(responsableId),
    fechaCreacion: new Date(fechaCreacion),
  }

  try {
    // ── RN-O04: si nace directamente en el gancho, genera la Propuesta ya mismo ──
    if (etapaInicial === ETAPA_HOOK) {
      let oportunidadCreada = null
      let propuestaCreada = null

      await prisma.$transaction(async (tx) => {
        const empresa = await tx.empresa.create({ data: { nombre: datosBase.empresaNombre } })
        const codigo = await generarCodigoPropuesta(empresa.id, new Date(), tx)

        propuestaCreada = await tx.propuesta.create({
          data: {
            codigo,
            titulo: datosBase.titulo,
            descripcion: datosBase.descripcion,
            empresaId: empresa.id,
            valorEstimado: datosBase.valorEstimado,
            fechaCreacion: new Date(),
            estado: 'Factibilidad',
            logs: { create: { estadoAnterior: null, estadoNuevo: 'Factibilidad', userId, nota: `Generada automáticamente desde la oportunidad "${datosBase.titulo}"` } },
          },
          select: { id: true, codigo: true, titulo: true, estado: true },
        })

        oportunidadCreada = await tx.oportunidad.create({
          data: {
            ...datosBase,
            etapa: etapaInicial,
            propuestaId: propuestaCreada.id,
            contactos: { create: contactosData },
            logs: { create: { etapaAnterior: null, etapaNueva: etapaInicial, userId, nota: `Oportunidad creada. Se generó automáticamente ${propuestaCreada.codigo} en estado Factibilidad.` } },
          },
          include: OPORTUNIDAD_INCLUDE,
        })
      })

      return NextResponse.json({
        success: true,
        data: serializeOportunidad(oportunidadCreada),
        propuestaCreada,
        message: `Oportunidad creada. Propuesta "${propuestaCreada.codigo}" generada automáticamente.`,
      }, { status: 201 })
    }

    // ── Creación normal ────────────────────────────────────────────────────────
    const oportunidad = await prisma.oportunidad.create({
      data: {
        ...datosBase,
        etapa: etapaInicial,
        motivoPerdida: etapaInicial === 'Perdida' ? (motivoPerdida?.trim() || null) : null,
        contactos: { create: contactosData },
        logs: {
          create: {
            etapaAnterior: null,
            etapaNueva: etapaInicial,
            userId,
            nota: 'Oportunidad creada',
          },
        },
      },
      include: OPORTUNIDAD_INCLUDE,
    })

    return NextResponse.json({ success: true, data: serializeOportunidad(oportunidad), message: 'Oportunidad creada exitosamente' }, { status: 201 })
  } catch (e) {
    if (e.code === 'P2003') return NextResponse.json({ success: false, message: 'El responsable indicado no existe' }, { status: 422 })
    console.error('POST /oportunidades error:', e.message)
    return NextResponse.json({ success: false, message: 'Error interno al crear la oportunidad' }, { status: 500 })
  }
}
