/**
 * GPRO — Importación de Perfiles de Consultor (Tarifario Defensa Salud 2026)
 *
 * Uso:
 *   1. Asegúrate de tener DATABASE_URL apuntando a la BD de PRODUCCIÓN en .env.local
 *   2. Ejecuta: node scripts/import-perfiles-2026.js
 *
 * Qué hace:
 *   - Crea los registros de PerfilConsultor (catálogo Rol + Nivel + tarifa)
 *     que faltan según el Excel "Tarifario Defensa Salud 2026".
 *   - NO toca tarifario_lineas (esas requieren un consultor/empleado real
 *     asignado y se cargan luego, una por una, desde /tarifarios/:id).
 *   - Se omiten Java Developer y Arquitecto: ya existen en producción.
 *   - costoHora se deja en 0 (costo interno pendiente de definir).
 *   - Idempotente: si ya existe un perfil con el mismo nombre+nivel+precioHora
 *     exacto, se omite (no duplica si el script se corre 2 veces).
 *
 * Nota especial — "Líder de Proyectos / Certificado" ($23.75):
 *   El sistema solo admite los niveles Junior / Semi Senior / Senior.
 *   Por decisión del PM, se mapea como "Líder de Proyectos / Senior" a $23.75,
 *   coexistiendo con la fila real "Líder de Proyectos / Senior" a $19.38.
 */

'use strict'

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// nombre, nivel, precioHora (costoHora se carga en 0 para todos)
const PERFILES = [
  // ── Negocio ──
  ['QA Analyst', 'Junior', 10.78],
  ['QA Analyst', 'Semi Senior', 15.40],
  ['QA Analyst', 'Senior', 21.56],
  ['QA Automatizador', 'Junior', 11.62],
  ['QA Automatizador', 'Semi Senior', 16.24],
  ['QA Automatizador', 'Senior', 22.40],

  // ── Desarrollo ──
  ['Frontend Developer', 'Junior', 10.78],
  ['Frontend Developer', 'Semi Senior', 15.40],
  ['Frontend Developer', 'Senior', 21.56],
  ['Backend Developer', 'Junior', 11.62],
  ['Backend Developer', 'Semi Senior', 16.24],
  ['Backend Developer', 'Senior', 22.40],
  ['Fullstack Developer', 'Junior', 11.76],
  ['Fullstack Developer', 'Semi Senior', 16.80],
  ['Fullstack Developer', 'Senior', 23.52],
  ['React Native Developer', 'Junior', 11.62],
  ['React Native Developer', 'Semi Senior', 16.24],
  ['React Native Developer', 'Senior', 22.40],
  ['iOS Developer', 'Junior', 12.74],
  ['iOS Developer', 'Semi Senior', 18.20],
  ['iOS Developer', 'Senior', 25.48],
  ['Android Developer', 'Junior', 12.74],
  ['Android Developer', 'Semi Senior', 18.20],
  ['Android Developer', 'Senior', 25.48],
  ['Salesforce Commerce Developer', 'Junior', 13.23],
  ['Salesforce Commerce Developer', 'Semi Senior', 18.90],
  ['Salesforce Commerce Developer', 'Senior', 26.46],
  ['Salesforce Marketing Developer', 'Junior', 12.74],
  ['Salesforce Marketing Developer', 'Semi Senior', 18.20],
  ['Salesforce Marketing Developer', 'Senior', 25.48],
  // Java Developer: ya existe en producción — omitido

  // ── Líder de Proyectos ──
  ['Líder de Proyectos', 'Semi Senior', 17.50],
  ['Líder de Proyectos', 'Senior', 19.38],
  ['Líder de Proyectos', 'Senior', 23.75], // mapeado desde "Certificado" (decisión PM)
  // Arquitecto: ya existe en producción — omitido
]

async function main() {
  console.log('\n🚀 GPRO — Import Perfiles de Consultor (Tarifario 2026)\n')

  let creados = 0
  let omitidos = 0

  for (const [nombre, nivel, precioHora] of PERFILES) {
    const existente = await prisma.perfilConsultor.findFirst({
      where: { nombre, nivel, precioHora },
    })

    if (existente) {
      console.log(`   ⏭️  Ya existe: ${nombre} / ${nivel} / $${precioHora.toFixed(2)}`)
      omitidos++
      continue
    }

    await prisma.perfilConsultor.create({
      data: { nombre, nivel, costoHora: 0, precioHora, activo: true },
    })
    console.log(`   ✅ Creado: ${nombre} / ${nivel} / $${precioHora.toFixed(2)}`)
    creados++
  }

  console.log('\n═══════════════════════════════════════════════')
  console.log(`  Creados:  ${creados}`)
  console.log(`  Omitidos: ${omitidos} (ya existían)`)
  console.log('═══════════════════════════════════════════════\n')
}

main()
  .catch((e) => { console.error('\n❌ ERROR:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
