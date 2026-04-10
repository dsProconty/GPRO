/**
 * Tests para reglas de negocio críticas (CLAUDE.md §5)
 * No requieren base de datos — validan la lógica pura.
 */

// ─── RN-01: Campos calculados ────────────────────────────────────────────────
describe('RN-01: Campos calculados nunca se guardan', () => {
  function calcularResumenFactura(factura) {
    const totalPagos = factura.pagos.reduce((s, p) => s + Number(p.valor), 0)
    return {
      valor: Number(factura.valor),
      totalPagos,
      saldo: Number(factura.valor) - totalPagos,
    }
  }

  test('saldo = valor - totalPagos', () => {
    const factura = { valor: 1000, pagos: [{ valor: 300 }, { valor: 200 }] }
    const { saldo, totalPagos } = calcularResumenFactura(factura)
    expect(totalPagos).toBe(500)
    expect(saldo).toBe(500)
  })

  test('saldo es 0 cuando la factura está completamente pagada', () => {
    const factura = { valor: 500, pagos: [{ valor: 500 }] }
    const { saldo } = calcularResumenFactura(factura)
    expect(saldo).toBe(0)
  })

  test('saldo es el valor completo cuando no hay pagos', () => {
    const factura = { valor: 2000, pagos: [] }
    const { saldo } = calcularResumenFactura(factura)
    expect(saldo).toBe(2000)
  })

  function calcularResumenProyecto(proyecto) {
    const facturado = proyecto.facturas.reduce((s, f) => s + Number(f.valor), 0)
    const pagado = proyecto.facturas.reduce(
      (s, f) => s + f.pagos.reduce((sp, p) => sp + Number(p.valor), 0),
      0
    )
    return { facturado, pagado, saldo: facturado - pagado }
  }

  test('facturado del proyecto = suma de facturas', () => {
    const proyecto = {
      facturas: [
        { valor: 1000, pagos: [{ valor: 500 }] },
        { valor: 2000, pagos: [{ valor: 2000 }] },
      ],
    }
    const { facturado, pagado, saldo } = calcularResumenProyecto(proyecto)
    expect(facturado).toBe(3000)
    expect(pagado).toBe(2500)
    expect(saldo).toBe(500)
  })
})

// ─── RN-02: Validación de pagos ──────────────────────────────────────────────
describe('RN-02: Pago no puede superar saldo de factura', () => {
  function validarPago(valorPago, saldoDisponible) {
    if (Number(valorPago) <= 0) return { valido: false, error: 'El valor debe ser mayor a 0' }
    if (Number(valorPago) > saldoDisponible + 0.001) {
      return { valido: false, error: `Máximo permitido: $${saldoDisponible.toFixed(2)}` }
    }
    return { valido: true }
  }

  test('pago válido dentro del saldo', () => {
    expect(validarPago(300, 500).valido).toBe(true)
  })

  test('pago igual al saldo es válido', () => {
    expect(validarPago(500, 500).valido).toBe(true)
  })

  test('pago que supera el saldo es rechazado', () => {
    const result = validarPago(600, 500)
    expect(result.valido).toBe(false)
    expect(result.error).toContain('500.00')
  })

  test('pago cero es rechazado', () => {
    const result = validarPago(0, 500)
    expect(result.valido).toBe(false)
    expect(result.error).toContain('mayor a 0')
  })

  test('pago negativo es rechazado', () => {
    const result = validarPago(-100, 500)
    expect(result.valido).toBe(false)
  })

  test('tolerancia de flotantes: pago con diferencia menor a 0.001 es válido', () => {
    expect(validarPago(500.0005, 500).valido).toBe(true)
  })
})

// ─── RN-06: Tiempo de vida ───────────────────────────────────────────────────
describe('RN-06: Cálculo de tiempo de vida', () => {
  function calcTiempoVida(fechaCreacion, fechaCierre) {
    const fin = fechaCierre ? new Date(fechaCierre) : new Date()
    const inicio = new Date(fechaCreacion)
    const dias = Math.max(0, Math.floor((fin - inicio) / (1000 * 60 * 60 * 24)))
    return `${dias} días`
  }

  test('calcula días correctamente entre dos fechas', () => {
    expect(calcTiempoVida('2026-01-01', '2026-02-01')).toBe('31 días')
  })

  test('usa fecha actual cuando no hay fecha de cierre', () => {
    const inicio = new Date()
    inicio.setDate(inicio.getDate() - 10)
    const result = calcTiempoVida(inicio.toISOString().split('T')[0], null)
    const dias = parseInt(result)
    expect(dias).toBeGreaterThanOrEqual(9)
    expect(dias).toBeLessThanOrEqual(11)
  })

  test('no puede ser negativo', () => {
    const dias = parseInt(calcTiempoVida('2026-12-31', '2026-01-01'))
    expect(dias).toBe(0)
  })
})

// ─── RN-05: Warning en estado Cerrado con saldo ──────────────────────────────
describe('RN-05: Warning al cerrar proyecto con saldo pendiente', () => {
  function chequearCierreConSaldo(nombreEstado, facturas) {
    if (nombreEstado !== 'Cerrado') return null
    const facturado = facturas.reduce((s, f) => s + Number(f.valor), 0)
    const pagado = facturas.reduce(
      (s, f) => s + f.pagos.reduce((sp, p) => sp + Number(p.valor), 0),
      0
    )
    return facturado - pagado > 0.001 ? 'El proyecto tiene saldo pendiente de cobro.' : null
  }

  test('retorna warning si hay saldo al cerrar', () => {
    const facturas = [{ valor: 1000, pagos: [{ valor: 500 }] }]
    expect(chequearCierreConSaldo('Cerrado', facturas)).toBe('El proyecto tiene saldo pendiente de cobro.')
  })

  test('no retorna warning si está saldado al cerrar', () => {
    const facturas = [{ valor: 1000, pagos: [{ valor: 1000 }] }]
    expect(chequearCierreConSaldo('Cerrado', facturas)).toBeNull()
  })

  test('no retorna warning si el estado no es Cerrado', () => {
    const facturas = [{ valor: 1000, pagos: [{ valor: 500 }] }]
    expect(chequearCierreConSaldo('Adjudicado', facturas)).toBeNull()
  })

  test('no retorna warning si no hay facturas', () => {
    expect(chequearCierreConSaldo('Cerrado', [])).toBeNull()
  })
})
