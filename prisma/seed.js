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
      id:        1,
      nombre:    'Proconty',
      moneda:    'USD',
      logoUrl:   null,
      direccion: null,
      telefono:  null,
      email:     null,
    },
  })
  console.log('✅ Configuración de empresa cargada')

  // ── 5. PERFILES DE CONSULTOR (catálogo inicial) ──────────────────────────
  const perfilesConsultor = [
    { id: 1, nombre: 'Full Stack',   nivel: 'Senior',      costoHora: 15.00, precioHora: 33.00 },
    { id: 2, nombre: 'Full Stack',   nivel: 'Semi Senior', costoHora: 12.00, precioHora: 26.00 },
    { id: 3, nombre: 'Full Stack',   nivel: 'Junior',      costoHora: 10.00, precioHora: 20.00 },
    { id: 4, nombre: 'QA',           nivel: 'Senior',      costoHora: 12.00, precioHora: 28.00 },
    { id: 5, nombre: 'QA',           nivel: 'Junior',      costoHora: 10.00, precioHora: 20.00 },
    { id: 6, nombre: 'PM',           nivel: 'Senior',      costoHora: 15.00, precioHora: 33.00 },
    { id: 7, nombre: 'Arquitecto',   nivel: 'Senior',      costoHora: 18.00, precioHora: 40.00 },
    { id: 8, nombre: 'DevOps',       nivel: 'Senior',      costoHora: 16.00, precioHora: 35.00 },
  ]

  for (const p of perfilesConsultor) {
    await prisma.perfilConsultor.upsert({
      where:  { id: p.id },
      update: {},
      create: p,
    })
  }
  console.log('✅ Perfiles de consultor cargados (8 registros)')

  // ── 6. PERFILES DE USUARIO (RBAC) ────────────────────────────────────────
  const TODOS = [
    'dashboard.ver',
    'proyectos.ver',   'proyectos.crear',  'proyectos.editar', 'proyectos.eliminar',
    'proyectos.cambiarEstado', 'proyectos.pdf',
    'propuestas.ver',  'propuestas.crear', 'propuestas.editar', 'propuestas.eliminar',
    'propuestas.cambiarEstado',
    'clientes.ver',    'clientes.crear',   'clientes.editar',  'clientes.eliminar',
    'empresas.ver',    'empresas.crear',   'empresas.editar',  'empresas.eliminar',
    'facturas.ver',    'facturas.crear',   'facturas.editar',  'facturas.eliminar',
    'pagos.ver',       'pagos.crear',      'pagos.editar',     'pagos.eliminar',
    'observaciones.ver', 'observaciones.crear',
    'recordatorios.ver', 'recordatorios.crear', 'recordatorios.editar', 'recordatorios.eliminar',
  ]

  const perfilesSistema = [
    {
      id: 1,
      nombre: 'Gerencial',
      descripcion: 'Acceso completo a todos los módulos',
      permisos: TODOS,
      estadosProyectoEditables: null,
    },
    {
      id: 2,
      nombre: 'PM',
      descripcion: 'Acceso total excepto eliminar proyectos. Solo puede editar proyectos en estados Por Facturar, Adjudicado y Facturado.',
      permisos: TODOS.filter((p) => p !== 'proyectos.eliminar'),
      estadosProyectoEditables: [2, 3, 4],
    },
    {
      id: 3,
      nombre: 'Consultor',
      descripcion: 'Solo lectura en todos los módulos, puede agregar observaciones y descargar PDFs de proyectos',
      permisos: [
        'dashboard.ver',
        'proyectos.ver', 'proyectos.pdf',
        'propuestas.ver',
        'clientes.ver',
        'empresas.ver',
        'facturas.ver',
        'pagos.ver',
        'observaciones.ver', 'observaciones.crear',
        'recordatorios.ver',
      ],
      estadosProyectoEditables: null,
    },
    {
      id: 4,
      nombre: 'Financiero',
      descripcion: 'Gestión completa de facturas y pagos, lectura de proyectos, propuestas, clientes y empresas',
      permisos: [
        'dashboard.ver',
        'proyectos.ver',
        'propuestas.ver',
        'clientes.ver',
        'empresas.ver',
        'facturas.ver', 'facturas.crear', 'facturas.editar', 'facturas.eliminar',
        'pagos.ver',    'pagos.crear',    'pagos.editar',    'pagos.eliminar',
      ],
      estadosProyectoEditables: null,
    },
  ]

  for (const pf of perfilesSistema) {
    await prisma.perfilUsuario.upsert({
      where:  { id: pf.id },
      update: { nombre: pf.nombre, descripcion: pf.descripcion, permisos: pf.permisos, estadosProyectoEditables: pf.estadosProyectoEditables },
      create: pf,
    })
  }
  console.log('✅ Perfiles de usuario cargados (Gerencial, PM, Consultor, Financiero)')

  // ── 7. DATOS DE DEMO ─────────────────────────────────────────────────────
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
