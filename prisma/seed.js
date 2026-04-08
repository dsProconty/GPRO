// prisma/seed.js
// ─────────────────────────────────────────────────────────────────────────────
// Seed: Carga datos iniciales del sistema GPRO
// Ejecutar con: npm run db:seed
// ─────────────────────────────────────────────────────────────────────────────

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed de GPRO...')

  // ── 1. ESTADOS DEL CATÁLOGO ──────────────────────────────────────────────
  // Equivalente al seeder de Laravel con los 5 estados
  const estados = [
    { id: 1, nombre: 'Prefactibilidad',       descripcion: 'Evaluación inicial del proyecto',      color: 'warning'  },
    { id: 2, nombre: 'Elaboracion_Propuesta', descripcion: 'Preparando propuesta formal',           color: 'info'     },
    { id: 3, nombre: 'Adjudicado',            descripcion: 'Proyecto ganado y en ejecución',        color: 'success'  },
    { id: 4, nombre: 'Rechazado',             descripcion: 'Propuesta no aceptada por cliente',     color: 'danger'   },
    { id: 5, nombre: 'Cerrado',               descripcion: 'Proyecto finalizado',                   color: 'secondary'},
  ]

  for (const estado of estados) {
    await prisma.estado.upsert({
      where: { id: estado.id },
      update: estado,
      create: estado,
    })
  }
  console.log('✅ Estados cargados (5 registros)')

  // ── 2. USUARIO ADMIN ─────────────────────────────────────────────────────
  // Equivalente al SP0-05: Seeder de Usuario Admin
  // Credenciales iniciales: admin@proconty.com / password123
  const hashedPassword = await bcrypt.hash('password123', 12)

  await prisma.user.upsert({
    where: { email: 'admin@proconty.com' },
    update: {},
    create: {
      name:     'Administrador GPRO',
      email:    'admin@proconty.com',
      password: hashedPassword,
      role:     'admin',
    },
  })
  console.log('✅ Usuario admin creado: admin@proconty.com / password123')

  // ── 3. DATOS DE DEMO (opcional) ──────────────────────────────────────────
  // Una empresa y un cliente de ejemplo para verificar el flujo
  const empresaDemo = await prisma.empresa.upsert({
    where: { id: 1 },
    update: {},
    create: {
      nombre: 'Fideval S.A.',
      ciudad: 'Quito',
    },
  })

  await prisma.cliente.upsert({
    where: { id: 1 },
    update: {},
    create: {
      nombre:    'Jose Luis',
      apellido:  'Garcia',
      telefono:  '0999205585',
      mail:      'jgarcia@fideval.com',
      empresaId: empresaDemo.id,
    },
  })
  console.log('✅ Datos de demo cargados (empresa + cliente de ejemplo)')

  console.log('\n🚀 Seed completado exitosamente!')
  console.log('   Credenciales admin: admin@proconty.com / password123')
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
