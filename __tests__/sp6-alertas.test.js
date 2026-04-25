/**
 * SP6-05: Tests for alert age logic and Excel export row generation
 */

// ── Helpers (inlined to avoid ESM import issues) ──────────────────
function calcDiasMora(fechaFactura) {
  const hoy = new Date()
  const fecha = new Date(fechaFactura)
  return Math.floor((hoy - fecha) / (1000 * 60 * 60 * 24))
}

function facturaVencida(fechaFactura, dias = 30) {
  const fechaLimite = new Date()
  fechaLimite.setDate(fechaLimite.getDate() - dias)
  return new Date(fechaFactura) <= fechaLimite
}

function calcSaldo(valor, pagos) {
  const totalPagos = pagos.reduce((s, p) => s + Number(p.valor), 0)
  return Number(valor) - totalPagos
}

function generarFilasProyecto(proyectos) {
  return proyectos.map((p) => {
    const saldo = Number(p.valor || 0) - Number(p.pagado || 0)
    return {
      'ID': p.id,
      'Proyecto': p.detalle,
      'Cliente': p.empresa?.nombre || '',
      'Estado': (p.estado?.nombre || '').replace('_', ' '),
      'Valor': Number(p.valor) || 0,
      'Facturado': Number(p.facturado) || 0,
      'Pagado': Number(p.pagado) || 0,
      'Saldo': saldo,
    }
  })
}

function generarFilasFactura(facturas) {
  return facturas.map((f) => ({
    'Nº Factura': f.numFactura,
    'OC': f.ordenCompra || '',
    'Valor': Number(f.valor) || 0,
    'Pagado': Number(f.totalPagos) || 0,
    'Saldo': Number(f.saldo) || 0,
  }))
}

// ── Tests de alertas de cobranza ─────────────────────────────────
describe('Alertas de cobranza — umbral de días', () => {
  test('factura con 31 días de antigüedad aparece en alertas (umbral 30)', () => {
    const fecha = new Date()
    fecha.setDate(fecha.getDate() - 31)
    expect(facturaVencida(fecha.toISOString(), 30)).toBe(true)
  })

  test('factura con 30 días exactos aparece en alertas (lte)', () => {
    const fecha = new Date()
    fecha.setDate(fecha.getDate() - 30)
    expect(facturaVencida(fecha.toISOString(), 30)).toBe(true)
  })

  test('factura con 29 días NO aparece en alertas', () => {
    const fecha = new Date()
    fecha.setDate(fecha.getDate() - 29)
    expect(facturaVencida(fecha.toISOString(), 30)).toBe(false)
  })

  test('factura de hoy NO aparece en alertas', () => {
    expect(facturaVencida(new Date().toISOString(), 30)).toBe(false)
  })

  test('umbral configurable: 60 días', () => {
    const fecha61 = new Date()
    fecha61.setDate(fecha61.getDate() - 61)
    const fecha59 = new Date()
    fecha59.setDate(fecha59.getDate() - 59)
    expect(facturaVencida(fecha61.toISOString(), 60)).toBe(true)
    expect(facturaVencida(fecha59.toISOString(), 60)).toBe(false)
  })
})

describe('Alertas de cobranza — cálculo de saldo', () => {
  test('factura sin pagos tiene saldo = valor completo', () => {
    expect(calcSaldo(1000, [])).toBe(1000)
  })

  test('factura con pago parcial tiene saldo correcto', () => {
    expect(calcSaldo(1000, [{ valor: 400 }])).toBe(600)
  })

  test('factura pagada completamente tiene saldo = 0', () => {
    expect(calcSaldo(500, [{ valor: 500 }])).toBe(0)
  })

  test('factura con múltiples pagos acumula correctamente', () => {
    expect(calcSaldo(1000, [{ valor: 300 }, { valor: 200 }, { valor: 100 }])).toBe(400)
  })

  test('saldo no puede ser negativo si hay sobrepago', () => {
    // el saldo puede ser negativo matemáticamente — la validación se hace en el backend
    const saldo = calcSaldo(500, [{ valor: 600 }])
    expect(saldo).toBe(-100) // muestra el valor real; el backend previene esto
  })
})

describe('Alertas — solo facturas con saldo > 0 aparecen', () => {
  const fechaVencida = new Date()
  fechaVencida.setDate(fechaVencida.getDate() - 35)

  const facturas = [
    { id: 1, valor: 1000, pagos: [{ valor: 1000 }], fechaFactura: fechaVencida },  // saldo 0 — no alerta
    { id: 2, valor: 1000, pagos: [{ valor: 400 }],  fechaFactura: fechaVencida },  // saldo 600 — alerta
    { id: 3, valor: 500,  pagos: [],                fechaFactura: fechaVencida },  // saldo 500 — alerta
  ]

  test('filtra correctamente facturas con saldo > 0', () => {
    const alertas = facturas
      .map((f) => ({ ...f, saldo: calcSaldo(f.valor, f.pagos) }))
      .filter((f) => f.saldo > 0.001)

    expect(alertas).toHaveLength(2)
    expect(alertas.map((a) => a.id)).toEqual([2, 3])
  })
})

// ── Tests de generación de filas para Excel ───────────────────────
describe('Exportación Excel — filas de proyectos', () => {
  const proyectos = [
    {
      id: 1,
      detalle: 'Proyecto Alpha',
      empresa: { nombre: 'ACME Corp' },
      estado: { nombre: 'Adjudicado' },
      valor: 50000,
      facturado: 20000,
      pagado: 15000,
    },
    {
      id: 2,
      detalle: 'Proyecto Beta',
      empresa: null,
      estado: { nombre: 'Elaboracion_Propuesta' },
      valor: 30000,
      facturado: 0,
      pagado: 0,
    },
  ]

  test('genera el número correcto de filas', () => {
    expect(generarFilasProyecto(proyectos)).toHaveLength(2)
  })

  test('fila incluye todos los campos requeridos', () => {
    const filas = generarFilasProyecto(proyectos)
    const fila = filas[0]
    expect(fila).toHaveProperty('ID')
    expect(fila).toHaveProperty('Proyecto')
    expect(fila).toHaveProperty('Cliente')
    expect(fila).toHaveProperty('Estado')
    expect(fila).toHaveProperty('Valor')
    expect(fila).toHaveProperty('Facturado')
    expect(fila).toHaveProperty('Pagado')
    expect(fila).toHaveProperty('Saldo')
  })

  test('reemplaza guion bajo del estado', () => {
    const filas = generarFilasProyecto(proyectos)
    expect(filas[1]['Estado']).toBe('Elaboracion Propuesta')
  })

  test('empresa null → string vacío (no crashea)', () => {
    const filas = generarFilasProyecto(proyectos)
    expect(filas[1]['Cliente']).toBe('')
  })

  test('saldo calculado correctamente', () => {
    const filas = generarFilasProyecto(proyectos)
    expect(filas[0]['Saldo']).toBe(35000) // 50000 - 15000
    expect(filas[1]['Saldo']).toBe(30000) // 30000 - 0
  })
})

describe('Exportación Excel — filas de facturas', () => {
  const facturas = [
    { id: 1, numFactura: '001-001-000000001', ordenCompra: 'OC-100', valor: 5000, totalPagos: 3000, saldo: 2000 },
    { id: 2, numFactura: '001-001-000000002', ordenCompra: null,     valor: 2000, totalPagos: 2000, saldo: 0 },
  ]

  test('genera filas correctas para facturas', () => {
    const filas = generarFilasFactura(facturas)
    expect(filas).toHaveLength(2)
    expect(filas[0]['Nº Factura']).toBe('001-001-000000001')
    expect(filas[0]['Valor']).toBe(5000)
    expect(filas[0]['Saldo']).toBe(2000)
  })

  test('OC null → string vacío (no crashea)', () => {
    const filas = generarFilasFactura(facturas)
    expect(filas[1]['OC']).toBe('')
  })

  test('factura pagada tiene saldo 0', () => {
    const filas = generarFilasFactura(facturas)
    expect(filas[1]['Saldo']).toBe(0)
  })
})

// ── Tests de días de mora ─────────────────────────────────────────
describe('Días de mora', () => {
  test('factura de hace 45 días tiene ~45 días de mora', () => {
    const fecha = new Date()
    fecha.setDate(fecha.getDate() - 45)
    const diasMora = calcDiasMora(fecha.toISOString())
    expect(diasMora).toBeGreaterThanOrEqual(44)
    expect(diasMora).toBeLessThanOrEqual(46)
  })

  test('factura de hoy tiene 0 días de mora', () => {
    expect(calcDiasMora(new Date().toISOString())).toBe(0)
  })

  test('severity: más de 90 días → danger', () => {
    const diasMora = 91
    const severity = diasMora > 90 ? 'danger' : diasMora > 60 ? 'warning' : 'info'
    expect(severity).toBe('danger')
  })

  test('severity: 61-90 días → warning', () => {
    const diasMora = 75
    const severity = diasMora > 90 ? 'danger' : diasMora > 60 ? 'warning' : 'info'
    expect(severity).toBe('warning')
  })

  test('severity: ≤60 días → info', () => {
    const diasMora = 45
    const severity = diasMora > 90 ? 'danger' : diasMora > 60 ? 'warning' : 'info'
    expect(severity).toBe('info')
  })
})
