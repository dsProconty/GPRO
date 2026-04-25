import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { renderToBuffer } from '@react-pdf/renderer'
import { ProyectoPDF } from '@/lib/pdf/ProyectoPDF'
import React from 'react'

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 })

  try {
    const [proyecto, empresaCfg] = await Promise.all([
      prisma.proyecto.findUnique({
        where: { id },
        include: {
          empresa: { select: { id: true, nombre: true } },
          estado: { select: { id: true, nombre: true } },
          clientes: { include: { cliente: { select: { nombre: true, apellido: true } } } },
          responsables: { include: { user: { select: { name: true } } } },
        },
      }),
      prisma.configuracionEmpresa.findUnique({ where: { id: 1 } }),
    ])

    if (!proyecto) return NextResponse.json({ success: false, message: 'Proyecto no encontrado' }, { status: 404 })

    const [facturas, observaciones, casoLineas] = await Promise.all([
      prisma.factura.findMany({
        where: { proyectoId: id },
        include: { pagos: { select: { valor: true } } },
        orderBy: { fechaFactura: 'asc' },
      }),
      prisma.observacion.findMany({
        where: { proyectoId: id },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.proyectoCasoNegocioLinea.findMany({
        where: { proyectoId: id },
        include: {
          perfilConsultor: true,
          empleado: { select: { id: true, nombre: true, apellido: true } },
        },
        orderBy: { perfilConsultor: { nombre: 'asc' } },
      }),
    ])

    // Calcular totalPagos por factura
    const facturasConPagos = facturas.map((f) => ({
      ...f,
      valor: Number(f.valor),
      totalPagos: f.pagos.reduce((s, p) => s + Number(p.valor), 0),
    }))

    const casoNegocio = casoLineas.length > 0 ? {
      lineas: casoLineas.map((l) => ({
        perfil:    l.perfilConsultor,
        empleado:  l.empleado,
        horas:     Number(l.horas),
        costoHora: Number(l.costoHora),
        precioHora: Number(l.precioHora),
        costo:     Number(l.horas) * Number(l.costoHora),
        precio:    Number(l.horas) * Number(l.precioHora),
      })),
      resumen: {
        totalHoras:  casoLineas.reduce((s, l) => s + Number(l.horas), 0),
        totalCosto:  casoLineas.reduce((s, l) => s + Number(l.horas) * Number(l.costoHora), 0),
        totalPrecio: casoLineas.reduce((s, l) => s + Number(l.horas) * Number(l.precioHora), 0),
      },
    } : null

    const buffer = await renderToBuffer(
      React.createElement(ProyectoPDF, {
        proyecto: { ...proyecto, valor: Number(proyecto.valor) },
        facturas: facturasConPagos,
        observaciones,
        empresa: empresaCfg || {},
        casoNegocio,
      })
    )

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="proyecto_${id}_${new Date().toISOString().slice(0, 10)}.pdf"`,
      },
    })
  } catch (error) {
    console.error('PDF generation error:', error)
    return NextResponse.json({ success: false, message: 'Error al generar el PDF' }, { status: 500 })
  }
}
