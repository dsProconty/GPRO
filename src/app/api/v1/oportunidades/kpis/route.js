import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { tienePermiso, PERMISOS } from '@/lib/permisos'
import { ETAPAS, ETAPA_HOOK } from '@/lib/oportunidades'
import { logPermisoDenegado } from '@/lib/logger'

// GET /api/v1/oportunidades/kpis
// Conteo por etapa, tasa de conversión a Propuesta, y valor de pipeline por etapa (RN-O07/09, sección 5).
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  if (!tienePermiso(session, PERMISOS.OPORTUNIDADES.VER)) {
    logPermisoDenegado(session, PERMISOS.OPORTUNIDADES.VER, 'GET /oportunidades/kpis')
    return NextResponse.json({ success: false, message: 'Sin permiso para ver oportunidades' }, { status: 403 })
  }

  const oportunidades = await prisma.oportunidad.findMany({
    select: { etapa: true, valorEstimado: true },
  })

  const porEtapa = {}
  const valorPorEtapa = {}
  for (const e of ETAPAS) { porEtapa[e] = 0; valorPorEtapa[e] = 0 }

  for (const o of oportunidades) {
    porEtapa[o.etapa] = (porEtapa[o.etapa] || 0) + 1
    valorPorEtapa[o.etapa] = (valorPorEtapa[o.etapa] || 0) + (o.valorEstimado ? Number(o.valorEstimado) : 0)
  }

  const ganadas = porEtapa[ETAPA_HOOK] || 0
  const perdidas = porEtapa['Perdida'] || 0
  const cerradas = ganadas + perdidas
  const tasaConversion = cerradas > 0 ? Math.round((ganadas / cerradas) * 100) : 0

  return NextResponse.json({
    success: true,
    data: {
      total: oportunidades.length,
      porEtapa,
      valorPorEtapa,
      tasaConversion,
    },
    message: '',
  })
}
