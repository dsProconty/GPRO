/**
 * GPRO — Devuelve el proyecto PRO26-FMS-004 (Soporte OBI 160h, Femsa Salud, id 1031)
 * a la etapa de Propuesta comercial.
 *
 * Contexto: este proyecto fue heredado del sistema anterior ya en estado
 * Adjudicado, sin haber pasado nunca por el flujo de Propuestas de GPRO.
 * El cliente dio el OK en su momento pero el proyecto nunca pudo arrancar.
 * Se necesita "reabrirlo" como Propuesta para que, cuando el cliente
 * reconfirme, se vuelva a aprobar y genere un Proyecto nuevo.
 *
 * Qué hace (todo en una transacción):
 *   1. Verifica que el proyecto 1031 siga en estado Adjudicado (guard de seguridad,
 *      para no correr esto dos veces ni sobre datos que ya cambiaron).
 *   2. Crea una Propuesta nueva para Femsa Salud con los mismos datos (título,
 *      valor, cliente de contacto, responsable), en estado "Enviada" (ya había
 *      acuerdo previo con el cliente), con su historial de trazabilidad
 *      (Factibilidad → Enviada) documentando el motivo.
 *   3. Cambia el Proyecto 1031 a estado "Rechazado" (id 9) — queda en el sistema
 *      como registro histórico pero ya no cuenta como Adjudicado activo.
 *   4. Registra el cambio de estado del proyecto y una Observación explicando
 *      la razón, con link al código de la nueva propuesta.
 *
 * NO borra nada. NO toca facturas/pagos (no tiene ninguno).
 *
 * Uso: node scripts/devolver-pro26-fms-004-a-propuesta.js
 */

'use strict'

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const PROYECTO_ID = 1031
const ESTADO_ADJUDICADO = 3
const ESTADO_RECHAZADO = 9

async function generarCodigoPropuesta(empresaId, fechaCreacion) {
  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId }, select: { codigoCliente: true } })
  const codigoEmpresa = (empresa?.codigoCliente || 'XXX').toUpperCase()
  const anio = String(new Date(fechaCreacion).getFullYear()).slice(2)
  const prefijo = `PRP${anio}-${codigoEmpresa}-`

  const existentes = await prisma.propuesta.findMany({
    where: { codigo: { startsWith: prefijo } },
    select: { codigo: true },
  })
  const maxNum = existentes.reduce((max, r) => {
    const partes = r.codigo?.split('-') || []
    const num = parseInt(partes[partes.length - 1])
    return isNaN(num) ? max : Math.max(max, num)
  }, 0)

  return `${prefijo}${String(maxNum + 1).padStart(3, '0')}`
}

async function main() {
  console.log('\n🚀 Devolver PRO26-FMS-004 a Propuesta\n')

  const proyecto = await prisma.proyecto.findUnique({
    where: { id: PROYECTO_ID },
    include: { clientes: true, responsables: true },
  })

  if (!proyecto) throw new Error(`No existe proyecto con id ${PROYECTO_ID}`)
  if (proyecto.codigo !== 'PRO26-FMS-004') throw new Error(`El proyecto ${PROYECTO_ID} no tiene el código esperado (tiene: ${proyecto.codigo})`)
  if (proyecto.estadoId !== ESTADO_ADJUDICADO) {
    console.log(`⚠️  El proyecto ya no está en estado Adjudicado (estadoId actual: ${proyecto.estadoId}). Abortando para no duplicar.`)
    return
  }

  const admin = await prisma.user.findFirst({ where: { role: 'admin' } })
  if (!admin) throw new Error('No se encontró usuario admin para registrar los logs')

  const fechaCreacion = new Date()
  const codigo = await generarCodigoPropuesta(proyecto.empresaId, fechaCreacion)

  const notaMigracion =
    `Recreada desde el proyecto heredado ${proyecto.codigo} (id ${proyecto.id}), que fue adjudicado ` +
    `directamente al migrar del sistema anterior, sin pasar por el flujo de Propuestas de GPRO. ` +
    `El cliente había dado el OK para arrancar pero el proyecto nunca pudo iniciar. ` +
    `Se retoma como propuesta a la espera de una nueva confirmación del cliente.`

  const resultado = await prisma.$transaction(async (tx) => {
    const propuesta = await tx.propuesta.create({
      data: {
        titulo: proyecto.detalle,
        descripcion: notaMigracion,
        empresaId: proyecto.empresaId,
        valorEstimado: proyecto.valor,
        fechaCreacion,
        fechaEnvio: fechaCreacion,
        estado: 'Enviada',
        codigo,
        aplicativo: proyecto.aplicativo,
      },
    })

    if (proyecto.clientes.length > 0) {
      await tx.propuestaCliente.createMany({
        data: proyecto.clientes.map((c) => ({ propuestaId: propuesta.id, clienteId: c.clienteId })),
      })
    }
    if (proyecto.responsables.length > 0) {
      await tx.propuestaResponsable.createMany({
        data: proyecto.responsables.map((r) => ({ propuestaId: propuesta.id, empleadoId: r.empleadoId })),
      })
    }

    await tx.propuestaEstadoLog.create({
      data: { propuestaId: propuesta.id, estadoAnterior: null, estadoNuevo: 'Factibilidad', userId: admin.id, nota: notaMigracion },
    })
    await tx.propuestaEstadoLog.create({
      data: { propuestaId: propuesta.id, estadoAnterior: 'Factibilidad', estadoNuevo: 'Enviada', userId: admin.id, nota: 'El cliente ya había confirmado interés previamente; se marca como Enviada a la espera de re-confirmación formal.' },
    })

    await tx.proyecto.update({
      where: { id: proyecto.id },
      data: { estadoId: ESTADO_RECHAZADO },
    })
    await tx.proyectoEstadoLog.create({
      data: { proyectoId: proyecto.id, estadoAnteriorId: ESTADO_ADJUDICADO, estadoNuevoId: ESTADO_RECHAZADO, userId: admin.id },
    })
    await tx.observacion.create({
      data: {
        proyectoId: proyecto.id,
        userId: admin.id,
        descripcion: `Proyecto devuelto a fase de propuesta comercial (ver Propuesta ${codigo}). ${notaMigracion}`,
      },
    })

    return propuesta
  })

  console.log(`✅ Propuesta creada: ${resultado.codigo} (id ${resultado.id}), estado "Enviada"`)
  console.log(`✅ Proyecto ${proyecto.codigo} (id ${proyecto.id}) actualizado a estado "Rechazado"`)
  console.log('\nCuando el cliente reconfirme, aprobá la propuesta desde /propuestas para generar un Proyecto nuevo.\n')
}

main()
  .catch((e) => { console.error('\n❌ ERROR:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
