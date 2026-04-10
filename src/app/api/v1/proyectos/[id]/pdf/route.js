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
      }),
      prisma.configuracionEmpresa.findUnique({ where: { id: 1 } }),
    ])

    if (!proyecto) return NextResponse.json({ success: false, message: 'Proyecto no encontrado' }, { status: 404 })

    const facturas = await prisma.factura.findMany({
      where: { proyectoId: id },
      include: { pagos: { select: { valor: true } } },
      orderBy: { fechaFactura: 'asc' },
    })

    const observaciones = await prisma.observacion.findMany({
      where: { proyectoId: id },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    })

    // Calcular totalPagos por factura
    const facturasConPagos = facturas.map((f) => ({
      ...f,
      valor: Number(f.valor),
      totalPagos: f.pagos.reduce((s, p) => s + Number(p.valor), 0),
    }))

    const buffer = await renderToBuffer(
      React.createElement(ProyectoPDF, {
        proyecto: { ...proyecto, valor: Number(proyecto.valor) },
        facturas: facturasConPagos,
        observaciones,
        empresa: empresaCfg || {},
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
