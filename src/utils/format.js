export const formatCurrency = (value, currency = 'USD') =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency }).format(value ?? 0)

const toDatePart = (date) => {
  if (!date) return null
  const iso = typeof date === 'string' ? date : date instanceof Date ? date.toISOString() : String(date)
  return iso.substring(0, 10)
}

export const formatDate = (date) => {
  if (!date) return '—'
  // Extrae solo yyyy-mm-dd y ancla al mediodía local para evitar
  // el desfase UTC-5 (Ecuador) tanto en strings planos como en ISO completo de Prisma
  return new Date(toDatePart(date) + 'T12:00:00').toLocaleDateString('es-EC')
}

export const calcTiempoVida = (fechaCreacion, fechaCierre) => {
  const inicio = new Date(toDatePart(fechaCreacion) + 'T12:00:00')
  const fin = fechaCierre ? new Date(toDatePart(fechaCierre) + 'T12:00:00') : new Date()
  const dias = Math.floor((fin - inicio) / (1000 * 60 * 60 * 24))
  return `${dias} días`
}
