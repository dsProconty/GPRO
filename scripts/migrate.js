/**
 * GPRO — Script de Migración desde PowerApps / SharePoint Lists
 *
 * Uso:
 *   1. Asegúrate de tener DATABASE_URL apuntando a la BD correcta en .env.local
 *   2. Ejecuta: npm install (si no lo has hecho)
 *   3. Ejecuta: node scripts/migrate.js
 *
 * Qué hace:
 *   - Borra TODOS los datos excepto usuarios
 *   - Agrega nuevos estados (Elaboracion_Propuesta, Ejecución, Pruebas, Rechazado, Entregado)
 *   - Crea usuarios nuevos para cada responsable del CSV
 *   - Importa: empresas → clientes → proyectos → pivots → facturas → pagos → observaciones
 */

'use strict'

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()
const DATA = path.join(__dirname, 'data')

// ─── UTILIDADES ──────────────────────────────────────────────────────────────

function parseCSV(filename) {
  const raw = fs.readFileSync(path.join(DATA, filename))
  // strip UTF-8 BOM (0xEF 0xBB 0xBF) si existe
  const start = (raw[0] === 0xEF && raw[1] === 0xBB && raw[2] === 0xBF) ? 3 : 0
  const content = raw.slice(start).toString('utf-8')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
  const rows = []
  let headers = null
  let i = 0
  const n = content.length

  while (i < n) {
    const fields = []

    while (i < n) {
      let field = ''

      if (content[i] === '"') {
        i++ // skip opening quote
        while (i < n) {
          if (content[i] === '"') {
            if (i + 1 < n && content[i + 1] === '"') {
              field += '"'; i += 2
            } else {
              i++; break
            }
          } else {
            field += content[i++]
          }
        }
      } else {
        while (i < n && content[i] !== ',' && content[i] !== '\n' && content[i] !== '\r') {
          field += content[i++]
        }
      }

      fields.push(field.trim())

      if (i < n && content[i] === ',') {
        i++
      } else {
        while (i < n && (content[i] === '\r' || content[i] === '\n')) i++
        break
      }
    }

    if (fields.length === 0 || (fields.length === 1 && fields[0] === '')) continue

    if (!headers) {
      headers = fields
    } else {
      if (!fields[0]) continue
      const obj = {}
      headers.forEach((h, idx) => { obj[h] = (fields[idx] || '').trim() })
      rows.push(obj)
    }
  }

  return rows
}

// "$1.878,17" → 1878.17  |  "($21,45)" → -21.45
function parseMoney(s) {
  if (!s || !s.trim()) return 0
  const neg = s.includes('(')
  const clean = s.replace(/[$()]/g, '').replace(/\./g, '').replace(',', '.').trim()
  const val = parseFloat(clean) || 0
  return neg ? -val : val
}

// "26/02/2025" → Date
function parseDate(s) {
  if (!s || !s.trim()) return null
  const parts = s.trim().split('/')
  if (parts.length !== 3) return null
  const [d, m, y] = parts
  if (!d || !m || !y || y.length !== 4) return null
  return new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T12:00:00.000Z`)
}

function slug(str) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '.')
}

// ─── MAPEOS DE ESTADOS ───────────────────────────────────────────────────────
// IDs del CSV viejo → IDs en GPRO (existentes + nuevos)
// Existentes: 1=En Ejecución, 2=Por Facturar, 3=Adjudicado, 4=Facturado, 5=Cerrado
// Nuevos:     6=Elaboracion_Propuesta, 7=Ejecución, 8=Pruebas, 9=Rechazado, 10=Entregado
const ESTADO_MAP = {
  '1': 6,  // En Propuesta  → Elaboracion_Propuesta
  '2': 7,  // En Ejecución  → Ejecución
  '3': 8,  // Pruebas       → Pruebas
  '4': 5,  // Cerrado       → Cerrado
  '5': 9,  // Rechazado     → Rechazado
  '8': 10, // Entregado     → Entregado
  '9': 4,  // Facturado     → Facturado (ya existe)
}

// ─── RESPONSABLES ────────────────────────────────────────────────────────────
const RESPONSABLES = [
  { name: 'Zayda Anabel Yaguana Torres',          email: 'zayda.yaguana@proconty.com'     },
  { name: 'Christian Hugo Terán Panchi',           email: 'christian.teran@proconty.com'   },
  { name: 'Angélica Jeanneth Nicolalde Montalvo',  email: 'angelica.nicolalde@proconty.com'},
  { name: 'Mario Stalin Malan Castro',             email: 'mario.malan@proconty.com'       },
  { name: 'Johnny Andrés Moya Suárez',             email: 'johnny.moya@proconty.com'       },
  { name: 'Kenny Sebastián Vera Vera',             email: 'kenny.vera@proconty.com'        },
  { name: 'Eddin Eduardo Ramírez Chang',           email: 'eddin.ramirez@proconty.com'     },
  { name: 'Alexis Maldonado (Externo)',            email: 'alexis.maldonado.pics3@gmail.com'},
  { name: 'Alexis Maldonado Villacis',             email: 'alexis.maldonado@proconty.com'  },
  { name: 'Stalyn Roberto Toapanta Cauja',         email: 'stalyn.toapanta@proconty.com'   },
  { name: 'César Casa',                            email: 'cesar.casa@proconty.com'        },
  { name: 'Diego Manuel Sánchez Martín',           email: 'diego.sanchez@proconty.com'     },
  { name: 'Kevin Xavier Gende Cedeño',             email: 'kevin.gende@proconty.com'       },
  { name: 'Victor Miguel Macas Rivera',            email: 'victor.macas@proconty.com'      },
  { name: 'Jhony Marcelo Martínez Chugá',          email: 'jhony.martinez@proconty.com'    },
  { name: 'Jefferson Santiago Miño Tasinchana',    email: 'jefferson.mino@proconty.com'    },
  { name: 'Patricio Daniel Jiménez Loor',          email: 'patricio.jimenez@proconty.com'  },
  { name: 'Joshua Sebastian Herrera Diaz',         email: 'joshua.herrera@proconty.com'    },
  { name: 'César Nicolhai Casa Terán',             email: 'cesar.nicolhai@proconty.com'    },
]

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🚀 GPRO — Migración desde PowerApps\n')

  // ── PASO 1: BORRAR DATOS (excepto users) ─────────────────────────────────
  console.log('🗑️  Borrando datos existentes (se conservan usuarios)...')
  await prisma.$transaction([
    prisma.propuestaEstadoLog.deleteMany(),
    prisma.propuestaResponsable.deleteMany(),
    prisma.propuesta.deleteMany(),
    prisma.recordatorioLog.deleteMany(),
    prisma.recordatorioFactura.deleteMany(),
    prisma.proyectoEstadoLog.deleteMany(),
    prisma.observacion.deleteMany(),
    prisma.pago.deleteMany(),
    prisma.factura.deleteMany(),
    prisma.proyectoResponsable.deleteMany(),
    prisma.proyectoCliente.deleteMany(),
    prisma.proyecto.deleteMany(),
    prisma.cliente.deleteMany(),
    prisma.empresa.deleteMany(),
  ])
  console.log('   ✅ Datos borrados\n')

  // ── PASO 2: AGREGAR NUEVOS ESTADOS ───────────────────────────────────────
  console.log('📋 Creando nuevos estados...')
  const nuevosEstados = [
    { id: 6,  nombre: 'Elaboracion_Propuesta', descripcion: 'En elaboración de propuesta', color: 'info'      },
    { id: 7,  nombre: 'Ejecución',             descripcion: 'Proyecto en ejecución',       color: 'info'      },
    { id: 8,  nombre: 'Pruebas',               descripcion: 'En fase de pruebas',          color: 'warning'   },
    { id: 9,  nombre: 'Rechazado',             descripcion: 'Proyecto rechazado',          color: 'danger'    },
    { id: 10, nombre: 'Entregado',             descripcion: 'Proyecto entregado',          color: 'success'   },
  ]
  for (const e of nuevosEstados) {
    await prisma.estado.upsert({ where: { id: e.id }, update: e, create: e })
  }
  console.log(`   ✅ ${nuevosEstados.length} estados creados/actualizados\n`)

  // ── PASO 3: CREAR USUARIOS PARA RESPONSABLES ─────────────────────────────
  console.log('👥 Creando usuarios para responsables...')
  const passHash = await bcrypt.hash('Proconty2025!', 10)
  const nameToUserId = {}

  for (const r of RESPONSABLES) {
    const user = await prisma.user.upsert({
      where:  { email: r.email },
      update: {},
      create: { name: r.name, email: r.email, password: passHash, role: 'user' },
    })
    nameToUserId[r.name] = user.id
    // Alias para el email-like entry
    nameToUserId[r.email] = user.id
  }
  console.log(`   ✅ ${RESPONSABLES.length} usuarios creados/verificados\n`)

  // Obtener admin para observaciones
  const admin = await prisma.user.findFirst({ where: { role: 'admin' } })
  if (!admin) throw new Error('No se encontró usuario admin. Ejecuta el seed primero.')

  // ── PASO 4: EMPRESAS ─────────────────────────────────────────────────────
  console.log('🏢 Importando empresas...')
  const csvEmpresas = parseCSV('empresas.csv')
  const empresaIdMap = {} // oldId → newId

  for (const row of csvEmpresas) {
    const emp = await prisma.empresa.create({
      data: {
        nombre: row['Razón_Social']?.trim() || 'Sin nombre',
        ciudad: row['Ciudad']?.trim() || null,
      }
    })
    empresaIdMap[row['ID']] = emp.id
  }
  console.log(`   ✅ ${csvEmpresas.length} empresas importadas\n`)

  // ── PASO 5: CLIENTES ─────────────────────────────────────────────────────
  console.log('👤 Importando clientes...')
  const csvClientes = parseCSV('clientes.csv')
  const clienteIdMap = {} // oldId → newId
  let clientesOk = 0, clientesSkip = 0

  for (const row of csvClientes) {
    const oldEmpId = row['ID_Empresa']
    const newEmpId = empresaIdMap[oldEmpId]
    if (!newEmpId) { clientesSkip++; continue }

    const cli = await prisma.cliente.create({
      data: {
        nombre:    row['Nombre']?.trim()   || 'Sin nombre',
        apellido:  row['Apellido']?.trim() || 'Sin apellido',
        telefono:  row['Teléfono']?.trim() || null,
        mail:      row['Mail']?.trim()     || null,
        empresaId: newEmpId,
      }
    })
    clienteIdMap[row['ID']] = cli.id
    clientesOk++
  }
  console.log(`   ✅ ${clientesOk} clientes importados | ⚠️  ${clientesSkip} omitidos (empresa no encontrada)\n`)

  // ── PASO 6: PROYECTOS ────────────────────────────────────────────────────
  console.log('📁 Importando proyectos...')
  const csvProyectos = parseCSV('proyectos.csv')
  const proyectoIdMap = {} // oldId → newId
  let proyectosOk = 0, proyectosSkip = 0

  for (const row of csvProyectos) {
    const oldEmpId   = row['ID_Empresa']
    const oldEstadoId = row['ID_Estado']
    const newEmpId   = empresaIdMap[oldEmpId]
    const newEstadoId = ESTADO_MAP[oldEstadoId]

    if (!newEmpId) { proyectosSkip++; continue }
    if (!newEstadoId) {
      console.warn(`   ⚠️  Proyecto ${row['ID']}: estado "${oldEstadoId}" no mapeado, usando Cerrado`)
    }

    const proy = await prisma.proyecto.create({
      data: {
        detalle:       row['Descripción']?.trim() || 'Sin descripción',
        empresaId:     newEmpId,
        valor:         parseMoney(row['Valor']),
        fechaCreacion: parseDate(row['Fecha_Creación']) || new Date(),
        fechaCierre:   parseDate(row['Fecha_Cierre'])   || null,
        estadoId:      newEstadoId || 5,
        projectOnline: null,
        aplicativo:    row['Aplicativo']?.trim() || null,
        ot:            row['OT']?.trim()         || null,
      }
    })
    proyectoIdMap[row['ID']] = proy.id
    proyectosOk++
  }
  console.log(`   ✅ ${proyectosOk} proyectos importados | ⚠️  ${proyectosSkip} omitidos\n`)

  // ── PASO 7: PIVOTS proyecto_cliente ──────────────────────────────────────
  console.log('🔗 Importando relaciones proyecto-cliente...')
  const csvProjCli = parseCSV('proyectos_clientes.csv')
  let pcOk = 0, pcSkip = 0

  for (const row of csvProjCli) {
    const newProjId = proyectoIdMap[row['ID_Proyecto']]
    const newCliId  = clienteIdMap[row['ID_Cliente']]
    if (!newProjId || !newCliId) { pcSkip++; continue }

    try {
      await prisma.proyectoCliente.create({
        data: { proyectoId: newProjId, clienteId: newCliId }
      })
      pcOk++
    } catch { pcSkip++ }
  }
  console.log(`   ✅ ${pcOk} relaciones proyecto-cliente | ⚠️  ${pcSkip} omitidas\n`)

  // ── PASO 8: PIVOTS proyecto_responsable ──────────────────────────────────
  console.log('🔗 Importando relaciones proyecto-responsable...')
  const csvProjResp = parseCSV('proyectos_responsables.csv')
  let prOk = 0, prSkip = 0

  for (const row of csvProjResp) {
    const newProjId = proyectoIdMap[row['ID_Proyecto']]
    const respName  = row['Responsable']?.trim()
    const userId    = nameToUserId[respName] || nameToUserId[respName?.toLowerCase()]
    if (!newProjId || !userId) { prSkip++; continue }

    try {
      await prisma.proyectoResponsable.create({
        data: { proyectoId: newProjId, userId }
      })
      prOk++
    } catch { prSkip++ }
  }
  console.log(`   ✅ ${prOk} relaciones proyecto-responsable | ⚠️  ${prSkip} omitidas\n`)

  // ── PASO 9: FACTURAS ─────────────────────────────────────────────────────
  console.log('🧾 Importando facturas...')
  const csvFacturas = parseCSV('facturas.csv')
  const facturaIdMap = {} // oldId → newId
  let factOk = 0, factSkip = 0

  for (const row of csvFacturas) {
    const newProjId = proyectoIdMap[row['ID_Proyecto']]
    if (!newProjId) { factSkip++; continue }

    const fechaFact = parseDate(row['Fecha_Factura'])
    if (!fechaFact) { factSkip++; continue }

    try {
      const fact = await prisma.factura.create({
        data: {
          numFactura:   row['Num_factura']?.trim() || `SIN-NUM-${row['ID']}`,
          proyectoId:   newProjId,
          ordenCompra:  row['Orden_Compra']?.trim() || null,
          valor:        parseMoney(row['Valor']),
          fechaFactura: fechaFact,
          observacion:  row['Observación']?.trim() || null,
        }
      })
      facturaIdMap[row['ID']] = fact.id
      factOk++
    } catch (e) {
      console.warn(`   ⚠️  Factura ${row['ID']} error: ${e.message}`)
      factSkip++
    }
  }
  console.log(`   ✅ ${factOk} facturas importadas | ⚠️  ${factSkip} omitidas\n`)

  // ── PASO 10: PAGOS ────────────────────────────────────────────────────────
  console.log('💰 Importando pagos...')
  const csvPagos = parseCSV('pagos.csv')
  let pagosOk = 0, pagosSkip = 0

  for (const row of csvPagos) {
    const newFactId = facturaIdMap[row['ID_Factura']]
    if (!newFactId) { pagosSkip++; continue }

    const fechaPago = parseDate(row['Fecha'])
    if (!fechaPago) { pagosSkip++; continue }

    const valor = parseMoney(row['Valor'])
    if (valor <= 0) { pagosSkip++; continue }

    try {
      await prisma.pago.create({
        data: {
          facturaId:   newFactId,
          valor,
          fecha:       fechaPago,
          observacion: row['Observación']?.trim() || null,
        }
      })
      pagosOk++
    } catch (e) {
      console.warn(`   ⚠️  Pago ${row['ID']} error: ${e.message}`)
      pagosSkip++
    }
  }
  console.log(`   ✅ ${pagosOk} pagos importados | ⚠️  ${pagosSkip} omitidos\n`)

  // ── PASO 11: OBSERVACIONES (desde Seguimiento) ────────────────────────────
  console.log('📝 Importando seguimientos como observaciones...')
  const csvSeg = parseCSV('seguimiento.csv')
  let obsOk = 0, obsSkip = 0

  for (const row of csvSeg) {
    const newProjId = proyectoIdMap[row['ID_Proyecto']]
    if (!newProjId) { obsSkip++; continue }

    const desc = row['Seguimiento']?.trim()
    if (!desc) { obsSkip++; continue }

    const fecha = parseDate(row['Fecha'])

    try {
      await prisma.observacion.create({
        data: {
          proyectoId:  newProjId,
          descripcion: desc,
          userId:      admin.id,
          createdAt:   fecha || new Date(),
        }
      })
      obsOk++
    } catch (e) {
      console.warn(`   ⚠️  Seguimiento ${row['ID']} error: ${e.message}`)
      obsSkip++
    }
  }
  console.log(`   ✅ ${obsOk} observaciones importadas | ⚠️  ${obsSkip} omitidas\n`)

  // ── RESUMEN ───────────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════')
  console.log('✅ MIGRACIÓN COMPLETADA')
  console.log('═══════════════════════════════════════════════')
  console.log(`  Empresas:      ${csvEmpresas.length}`)
  console.log(`  Clientes:      ${clientesOk}`)
  console.log(`  Proyectos:     ${proyectosOk}`)
  console.log(`  Facturas:      ${factOk}`)
  console.log(`  Pagos:         ${pagosOk}`)
  console.log(`  Observaciones: ${obsOk}`)
  console.log('═══════════════════════════════════════════════\n')
  console.log('⚠️  Usuarios nuevos (contraseña temporal: Proconty2025!):')
  RESPONSABLES.forEach(r => console.log(`   • ${r.email}`))
  console.log('\n📌 Recuerda correr: npx prisma db push (si cambiaste el schema)\n')
}

main()
  .catch(e => { console.error('\n❌ ERROR EN MIGRACIÓN:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
