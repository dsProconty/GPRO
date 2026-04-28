export const formatCurrency = (value, currency = 'USD') =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency }).format(value ?? 0)

export const formatDate = (date) => {
  if (!date) return '—'
  // Handles both "2026-04-28" (date-only strings) and full ISO timestamps
  // Date-only strings like "2026-04-28" are parsed as UTC midnight; add 'T12:00:00'
  // to avoid shifting to the previous day in UTC-5 (Ecuador)
  const str = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? date + 'T12:00:00'
    : date
  return new Date(str).toLocaleDateString('es-EC')
}

export const calcTiempoVida = (fechaCreacion, fechaCierre) => {
  const fin = fechaCierre ? new Date(fechaCierre) : new Date()
  const inicio = new Date(fechaCreacion)
  const dias = Math.floor((fin - inicio) / (1000 * 60 * 60 * 24))
  return `${dias} días`
}
