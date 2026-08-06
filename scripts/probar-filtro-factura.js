/**
 * GPRO — Prueba de solo lectura: simula EXACTAMENTE la misma lógica de
 * filtro que usa /proyectos en el navegador, contra los datos reales,
 * para encontrar por qué la búsqueda de "001-001-0000001057" no
 * encuentra resultados a pesar de que el dato existe.
 *
 * Uso: node scripts/probar-filtro-factura.js
 *
 * NO escribe nada en la base de datos.
 */

'use strict'

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const normFactura = (s) => s?.replace(/[\s-]/g, '') ?? ''

const SEARCH_TERMS = [
  '001-001-0000001057',
  '0000001057',
  '1057',
  '001-001-000001057',
]

async function main() {
  console.log('\n🧪 Probando la lógica de filtro contra datos reales\n')

  const facturas = await prisma.factura.findMany({
    where: { numFactura: { contains: '1057' } },
    include: { proyecto: { include: { estado: true } } },
  })

  console.log(`Facturas encontradas con "1057": ${facturas.length}\n`)

  for (const f of facturas) {
    console.log('──────────────────────────────────────────')
    console.log(`Factura id: ${f.id}`)
    console.log(`  numFactura RAW: ${JSON.stringify(f.numFactura)}`)
    console.log(`  numFactura length: ${f.numFactura?.length}`)
    console.log(`  numFactura char codes: [${[...(f.numFactura || '')].map((c) => c.charCodeAt(0)).join(',')}]`)
    console.log(`  Proyecto: ${f.proyecto?.codigo} — "${f.proyecto?.detalle}" — estado: ${f.proyecto?.estado?.nombre}`)

    for (const term of SEARCH_TERMS) {
      const normNum = normFactura(f.numFactura).toLowerCase()
      const normTerm = normFactura(term).toLowerCase()
      const match = normNum.includes(normTerm)
      console.log(`  Búsqueda "${term}" → normNum="${normNum}" normTerm="${normTerm}" → ${match ? '✅ MATCH' : '❌ NO MATCH'}`)
    }
  }

  console.log('\nFin de la prueba. No se modificó nada.\n')
}

main()
  .catch((e) => { console.error('\n❌ ERROR:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
