/**
 * GPRO — Renombra el PerfilConsultor duplicado "Líder de Proyectos / Senior"
 * que viene del nivel "Certificado" (mapeado a Senior en el import anterior),
 * para distinguirlo del "Líder de Proyectos / Senior" real ($19.38) en los
 * dropdowns de Caso de Negocio / Tarifarios.
 *
 * Uso:
 *   node scripts/rename-lider-certificado.js
 *
 * Identifica el registro por nombre='Líder de Proyectos', nivel='Senior',
 * precioHora=23.75 (único con ese precio) y le cambia el nombre a
 * "Líder de Proyectos (Certificado)". Idempotente.
 */

'use strict'

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const perfil = await prisma.perfilConsultor.findFirst({
    where: { nombre: 'Líder de Proyectos', nivel: 'Senior', precioHora: 23.75 },
  })

  if (!perfil) {
    console.log('⚠️  No se encontró "Líder de Proyectos / Senior" a $23.75. ¿Ya fue renombrado?')
    return
  }

  if (perfil.nombre === 'Líder de Proyectos (Certificado)') {
    console.log('⏭️  Ya estaba renombrado.')
    return
  }

  const actualizado = await prisma.perfilConsultor.update({
    where: { id: perfil.id },
    data: { nombre: 'Líder de Proyectos (Certificado)' },
  })

  console.log(`✅ Renombrado: id ${actualizado.id} → "${actualizado.nombre} / ${actualizado.nivel}" ($${Number(actualizado.precioHora).toFixed(2)})`)
}

main()
  .catch((e) => { console.error('\n❌ ERROR:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
