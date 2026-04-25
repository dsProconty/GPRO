import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enviarRecordatorio } from '@/lib/email'

// Vercel Cron Jobs llama este endpoint diariamente a las 8am UTC.
// Requiere el header Authorization: Bearer {CRON_SECRET} (Vercel lo inyecta automáticamente).
// Para probar manualmente: GET /api/cron/recordatorios con el header correcto.

export async function GET(request) {
  // Verificar CRON_SECRET (Vercel lo inyecta; en dev puede omitirse si no está configurado)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  }

  const hoy = new Date()
  const diaHoy = hoy.getDate()

  let enviados = 0
  let errores = 0

  try {
    const recordatorios = await prisma.recordatorioFactura.findMany({
      where: { activo: true, diaMes: diaHoy },
      include: {
        proyecto: {
          select: { id: true, detalle: true, empresa: { select: { nombre: true } } },
        },
      },
    })

    for (const recordatorio of recordatorios) {
      let exitoso = true
      let errorMsg = null

      try {
        await enviarRecordatorio({ proyecto: recordatorio.proyecto, recordatorio })
        enviados++
      } catch (err) {
        exitoso = false
        errorMsg = err.message || 'Error desconocido'
        errores++
      }

      // Registrar log sin importar si fue exitoso o no
      await prisma.recordatorioLog.create({
        data: { recordatorioId: recordatorio.id, exitoso, error: errorMsg },
      })
    }

    return NextResponse.json({
      success: true,
      data: { dia: diaHoy, total: recordatorios.length, enviados, errores },
      message: `Cron ejecutado: ${enviados} enviados, ${errores} errores`,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Error en cron de recordatorios', error: error.message },
      { status: 500 }
    )
  }
}
