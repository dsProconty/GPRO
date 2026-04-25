export const formatCurrency = (value, currency = 'USD') =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency }).format(value ?? 0)

export const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString('es-EC') : '—'

export const calcTiempoVida = (fechaCreacion, fechaCierre) => {
  const fin = fechaCierre ? new Date(fechaCierre) : new Date()
  const inicio = new Date(fechaCreacion)
  const dias = Math.floor((fin - inicio) / (1000 * 60 * 60 * 24))
  return `${dias} días`
}
