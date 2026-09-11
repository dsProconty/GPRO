import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { tienePermiso, PERMISOS } from '@/lib/permisos'
import { logPermisoDenegado } from '@/lib/logger'
import { ETAPAS, ETAPA_HOOK } from '@/lib/oportunidades'
import { generarCodigoPropuesta } from '@/lib/codigoHelper'

const OPORTUNIDAD_INCLUDE = {
  empresa: { select: { id: true, nombre: true } },
  responsable: { select: { id: true, nombre: true, apellido: true } },
  clientes: { include: { cliente: { select: { id: true, nombre: true, apellido: true, cargo: true, telefono: true, mail: true } } } },
  propuesta: { select: { id: true, codigo: true, estado: true } },
  seguimientos: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
}

const serializeOportunidad = (o) => ({
  ...o,
  valorEstimado: o.valorEstimado != null ? Number(o.valorEstimado) : null,
  ultimoSeguimiento: o.seguimientos?.[0]?.createdAt ?? null,
  seguimientos: undefined,
})

// Resuelve la empresa (existente o nueva) y la lista final de clienteIds
// (existentes + recién creados) dentro de la transacción `tx` dada.
async function resolverEmpresaYClientes(tx, { empresaId, empresaNombreNueva, clienteIds = [], contactosNuevos = [] }) {
  let empresaIdFinal
  if (empresaId) {
    const empresa = await tx.empresa.findUnique({ where: { id: parseInt(empresaId) }, select: { id: true } })
    if (!empresa) throw new Error('EMPRESA_NO_EXISTE')
    empresaIdFinal = empresa.id
  } else {
    const nombre = empresaNombreNueva?.trim()
    if (!nombre) throw new Error('EMPRESA_NOMBRE_REQUERIDO')
    const nuevaEmpresa = await tx.empresa.create({ data: { nombre } })
    empresaIdFinal = nuevaEmpresa.id
  }

  const clienteIdsFinal = clienteIds.map((cid) => parseInt(cid))
  for (const c of contactosNuevos) {
    if (!c.nombre?.trim() || !c.apellido?.trim()) continue
    const nuevoCliente = await tx.cliente.create({
      data: {
        nombre: c.nombre.trim(),
        apellido: c.apellido.trim(),
        cargo: c.cargo?.trim() || null,
        telefono: c.telefono?.trim() || null,
        mail: c.mail?.trim() || null,
        empresaId: empresaIdFinal,
      },
      select: { id: true },
    })
    clienteIdsFinal.push(nuevoCliente.id)
  }

  return { empresaIdFinal, clienteIdsFinal }
}

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
    titulo, origen, descripcion, valorEstimado,
    responsableId, fechaCreacion, etapa, motivoPerdida,
    empresaId, empresaNombreNueva, clienteIds = [], contactosNuevos = [],
  } = await request.json()

  const errors = {}
  if (!titulo?.trim()) errors.titulo = ['El título es requerido']
  if (!empresaId && !empresaNombreNueva?.trim()) errors.empresaId = ['La empresa es requerida']
  if (!responsableId) errors.responsableId = ['El responsable es requerido']
  if (!fechaCreacion) errors.fechaCreacion = ['La fecha de creación es requerida']

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ success: false, message: 'Error de validación', errors }, { status: 422 })
  }

  const etapaInicial = ETAPAS.includes(etapa) ? etapa : 'Prospeccion'
  const userId = parseInt(session.user.id)

  const datosBase = {
    titulo: titulo.trim(),
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
        const { empresaIdFinal, clienteIdsFinal } = await resolverEmpresaYClientes(tx, { empresaId, empresaNombreNueva, clienteIds, contactosNuevos })
        const codigo = await generarCodigoPropuesta(empresaIdFinal, new Date(), tx)

        propuestaCreada = await tx.propuesta.create({
          data: {
            codigo,
            titulo: datosBase.titulo,
            descripcion: datosBase.descripcion,
            empresaId: empresaIdFinal,
            valorEstimado: datosBase.valorEstimado,
            fechaCreacion: new Date(),
            estado: 'Factibilidad',
            clientes: { create: clienteIdsFinal.map((cid) => ({ clienteId: cid })) },
            logs: { create: { estadoAnterior: null, estadoNuevo: 'Factibilidad', userId, nota: `Generada automáticamente desde la oportunidad "${datosBase.titulo}"` } },
          },
          select: { id: true, codigo: true, titulo: true, estado: true },
        })

        oportunidadCreada = await tx.oportunidad.create({
          data: {
            ...datosBase,
            empresaId: empresaIdFinal,
            etapa: etapaInicial,
            propuestaId: propuestaCreada.id,
            clientes: { create: clienteIdsFinal.map((cid) => ({ clienteId: cid })) },
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
    let oportunidad = null
    await prisma.$transaction(async (tx) => {
      const { empresaIdFinal, clienteIdsFinal } = await resolverEmpresaYClientes(tx, { empresaId, empresaNombreNueva, clienteIds, contactosNuevos })

      oportunidad = await tx.oportunidad.create({
        data: {
          ...datosBase,
          empresaId: empresaIdFinal,
          etapa: etapaInicial,
          motivoPerdida: etapaInicial === 'Perdida' ? (motivoPerdida?.trim() || null) : null,
          clientes: { create: clienteIdsFinal.map((cid) => ({ clienteId: cid })) },
          logs: { create: { etapaAnterior: null, etapaNueva: etapaInicial, userId, nota: 'Oportunidad creada' } },
        },
        include: OPORTUNIDAD_INCLUDE,
      })
    })

    return NextResponse.json({ success: true, data: serializeOportunidad(oportunidad), message: 'Oportunidad creada exitosamente' }, { status: 201 })
  } catch (e) {
    if (e.message === 'EMPRESA_NO_EXISTE') return NextResponse.json({ success: false, message: 'La empresa seleccionada no existe' }, { status: 422 })
    if (e.message === 'EMPRESA_NOMBRE_REQUERIDO') return NextResponse.json({ success: false, message: 'Escribe el nombre de la nueva empresa' }, { status: 422 })
    if (e.code === 'P2003') return NextResponse.json({ success: false, message: 'El responsable indicado no existe' }, { status: 422 })
    console.error('POST /oportunidades error:', e.message)
    return NextResponse.json({ success: false, message: 'Error interno al crear la oportunidad' }, { status: 500 })
  }
}
