/**
 * GPRO — Inspección de solo lectura del proyecto PRO26-FMS-004
 * (Soporte OBI 160 horas, Femsa Salud) antes de devolverlo a Propuesta.
 *
 * Uso: node scripts/inspeccionar-pro26-fms-004.js
 *
 * NO escribe nada en la base de datos. Solo imprime:
 *   - El proyecto completo (empresa, clientes, responsables, estado)
 *   - El catálogo completo de Estados de Proyecto
 *   - Si ya existe alguna Propuesta para esa empresa con título similar
 */

'use strict'

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('\n🔎 Inspección PRO26-FMS-004\n')

  const proyecto = await prisma.proyecto.findFirst({
    where: { codigo: 'PRO26-FMS-004' },
    include: {
      empresa: true,
      estado: true,
      clientes: { include: { cliente: true } },
      responsables: { include: { empleado: true } },
    },
  })

  if (!proyecto) {
    console.log('❌ No se encontró ningún proyecto con código PRO26-FMS-004')
  } else {
    console.log('── PROYECTO ──')
    console.log(JSON.stringify(proyecto, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2))
  }

  console.log('\n── CATÁLOGO DE ESTADOS (proyectos) ──')
  const estados = await prisma.estado.findMany({ orderBy: { id: 'asc' } })
  console.table(estados.map((e) => ({ id: e.id, nombre: e.nombre, color: e.color })))

  if (proyecto) {
    console.log('\n── ¿YA EXISTE UNA PROPUESTA SIMILAR PARA ESTA EMPRESA? ──')
    const propuestas = await prisma.propuesta.findMany({
      where: { empresaId: proyecto.empresaId },
      select: { id: true, titulo: true, estado: true, proyectoId: true, codigo: true },
    })
    console.table(propuestas)
  }

  console.log('\nFin de la inspección. No se modificó nada.\n')
}

main()
  .catch((e) => { console.error('\n❌ ERROR:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
