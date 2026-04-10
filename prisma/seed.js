// prisma/seed.js
// ─────────────────────────────────────────────────────────────────────────────
// Seed: Carga datos iniciales del sistema GPRO
// Ejecutar con: npm run db:seed
// Idempotente: usa upsert para no duplicar datos
// ─────────────────────────────────────────────────────────────────────────────

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed de GPRO...')

  // ── 1. ESTADOS DEL PROYECTO (catálogo configurable) ──────────────────────
  const estados = [
    { id: 1, nombre: 'En Ejecución',  descripcion: 'Proyecto actualmente en ejecución',          color: 'info'     },
    { id: 2, nombre: 'Por Facturar',  descripcion: 'Trabajo completado, pendiente de factura',    color: 'warning'  },
    { id: 3, nombre: 'Adjudicado',    descripcion: 'Proyecto ganado, pendiente de inicio',        color: 'success'  },
    { id: 4, nombre: 'Facturado',     descripcion: 'Factura emitida, pendiente de cobro',         color: 'secondary'},
    { id: 5, nombre: 'Cerrado',       descripcion: 'Proyecto finalizado y cobrado',               color: 'secondary'},
  ]

  for (const estado of estados) {
    await prisma.estado.upsert({
      where:  { id: estado.id },
      update: { nombre: estado.nombre, descripcion: estado.descripcion, color: estado.color },
      create: estado,
    })
  }
  console.log('✅ Estados de proyecto cargados (5 registros)')

  // ── 2. LABELS DE ESTADOS DE PROPUESTA (personalizables) ──────────────────
  // key: identificador interno inmutable usado en la lógica de transiciones
  // label: nombre visible que el admin puede cambiar desde /configuracion
  const propuestaLabels = [
    { key: 'Factibilidad', label: 'Factibilidad',        severity: 'warning',   icon: 'pi-lightbulb',   orden: 1 },
    { key: 'Haciendo',     label: 'Generando Propuesta', severity: 'info',      icon: 'pi-cog',         orden: 2 },
    { key: 'Enviada',      label: 'Propuesta Enviada',   severity: 'secondary', icon: 'pi-send',        orden: 3 },
    { key: 'Aprobada',     label: 'Propuesta Aceptada',  severity: 'success',   icon: 'pi-check-circle',orden: 4 },
    { key: 'Rechazada',    label: 'Propuesta Rechazada', severity: 'danger',    icon: 'pi-times-circle',orden: 5 },
  ]

  for (const pl of propuestaLabels) {
    await prisma.propuestaEstadoLabel.upsert({
      where:  { key: pl.key },
      update: { label: pl.label, severity: pl.severity, icon: pl.icon, orden: pl.orden },
      create: pl,
    })
  }
  console.log('✅ Labels de estados de propuesta cargados (5 registros)')

  // ── 3. USUARIO ADMIN ─────────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash('password123', 12)

  await prisma.user.upsert({
    where:  { email: 'admin@proconty.com' },
    update: {},
    create: {
      name:     'Administrador GPRO',
      email:    'admin@proconty.com',
      password: hashedPassword,
      role:     'admin',
    },
  })
  console.log('✅ Usuario admin: admin@proconty.com / password123')

  // ── 4. CONFIGURACIÓN DE EMPRESA (singleton) ──────────────────────────────
  await prisma.configuracionEmpresa.upsert({
    where:  { id: 1 },
    update: {},   // No sobreescribir si el admin ya personalizó
    create: {
      id:       1,
      nombre:   'Proconty',
      moneda:   'USD',
      logoUrl:  null,
      direccion: null,
      telefono:  null,
      email:     null,
    },
  })
  console.log('✅ Configuración de empresa cargada')

  // ── 5. DATOS DE DEMO ─────────────────────────────────────────────────────
  const empresaDemo = await prisma.empresa.upsert({
    where:  { id: 1 },
    update: {},
    create: { nombre: 'Fideval S.A.', ciudad: 'Quito' },
  })

  await prisma.cliente.upsert({
    where:  { id: 1 },
    update: {},
    create: {
      nombre:    'Jose Luis',
      apellido:  'Garcia',
      telefono:  '0999205585',
      mail:      'jgarcia@fideval.com',
      empresaId: empresaDemo.id,
    },
  })
  console.log('✅ Datos de demo cargados (empresa + cliente)')

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
