/**
 * GPRO — Inspección de solo lectura: busca todas las facturas con
 * numFactura = '001-001-000001057' y muestra a qué proyecto pertenece
 * cada una, con su estado real (para diagnosticar por qué aparece
 * duplicada / por qué un proyecto "Entregado" no aparece en la búsqueda).
 *
 * Uso: node scripts/inspeccionar-factura-duplicada.js
 *
 * NO escribe nada en la base de datos.
 */

'use strict'

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const NUM_FACTURA = '001-001-000001057'

async function main() {
  console.log(`\n🔎 Buscando todas las facturas con numFactura = "${NUM_FACTURA}"\n`)

  const facturas = await prisma.factura.findMany({
    where: { numFactura: NUM_FACTURA },
    include: {
      proyecto: {
        include: { estado: true, empresa: { select: { nombre: true } } },
      },
      pagos: true,
    },
  })

  console.log(`Encontradas: ${facturas.length} factura(s) con ese número exacto\n`)

  for (const f of facturas) {
    console.log('──────────────────────────────────────────')
    console.log(`Factura id: ${f.id}`)
    console.log(`  numFactura: "${f.numFactura}"`)
    console.log(`  valor: ${f.valor}`)
    console.log(`  fechaFactura: ${f.fechaFactura}`)
    console.log(`  Proyecto id: ${f.proyecto?.id}, código: ${f.proyecto?.codigo}, detalle: "${f.proyecto?.detalle}"`)
    console.log(`  Proyecto estado: id=${f.proyecto?.estado?.id}, nombre="${f.proyecto?.estado?.nombre}"`)
    console.log(`  Empresa: ${f.proyecto?.empresa?.nombre}`)
  }

  console.log('\n── Búsqueda parecida (contains, no exacta) por si hay variantes con espacios/formato distinto ──')
  const parecidas = await prisma.factura.findMany({
    where: { numFactura: { contains: '000001057' } },
    select: { id: true, numFactura: true, proyectoId: true },
  })
  console.table(parecidas)

  console.log('\nFin de la inspección. No se modificó nada.\n')
}

main()
  .catch((e) => { console.error('\n❌ ERROR:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
