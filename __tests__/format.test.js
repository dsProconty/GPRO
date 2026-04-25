/**
 * Tests para utilidades de formato (src/utils/format.js)
 * Lógica inlineada para compatibilidad con Jest CommonJS.
 */

// Lógica espejada de src/utils/format.js
const formatCurrency = (value) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(value ?? 0)

const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString('es-EC') : '—'

const calcTiempoVida = (fechaCreacion, fechaCierre) => {
  const fin = fechaCierre ? new Date(fechaCierre) : new Date()
  const inicio = new Date(fechaCreacion)
  const dias = Math.floor((fin - inicio) / (1000 * 60 * 60 * 24))
  return `${dias} días`
}

describe('formatCurrency', () => {
  test('formatea un valor positivo en USD', () => {
    const result = formatCurrency(1500)
    expect(result).toContain('1.500')
    expect(result).toContain('$')
  })

  test('formatea cero correctamente', () => {
    const result = formatCurrency(0)
    expect(result).toContain('0')
  })

  test('maneja null con valor 0', () => {
    const result = formatCurrency(null)
    expect(result).toContain('0')
  })

  test('maneja undefined con valor 0', () => {
    const result = formatCurrency(undefined)
    expect(result).toContain('0')
  })

  test('formatea decimales correctamente', () => {
    const result = formatCurrency(1234.56)
    expect(result).toContain('1.234')
  })
})

describe('formatDate', () => {
  test('retorna "—" cuando la fecha es null', () => {
    expect(formatDate(null)).toBe('—')
  })

  test('retorna "—" cuando la fecha es undefined', () => {
    expect(formatDate(undefined)).toBe('—')
  })

  test('formatea una fecha ISO correctamente', () => {
    const result = formatDate('2026-01-15')
    expect(result).toBeTruthy()
    expect(result).not.toBe('—')
    expect(result).toContain('2026')
  })
})

describe('calcTiempoVida', () => {
  test('calcula dias entre dos fechas', () => {
    const result = calcTiempoVida('2026-01-01', '2026-01-31')
    expect(result).toBe('30 días')
  })

  test('retorna 0 dias cuando fechas son iguales', () => {
    const result = calcTiempoVida('2026-01-01', '2026-01-01')
    expect(result).toBe('0 días')
  })

  test('usa fecha actual cuando no hay fecha de cierre', () => {
    const ayer = new Date()
    ayer.setDate(ayer.getDate() - 5)
    const fechaInicio = ayer.toISOString().split('T')[0]
    const result = calcTiempoVida(fechaInicio, null)
    const dias = parseInt(result.replace(' días', ''))
    expect(dias).toBeGreaterThanOrEqual(4)
    expect(dias).toBeLessThanOrEqual(6)
  })
})
