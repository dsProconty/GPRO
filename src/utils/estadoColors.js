// Color hex de cada `severity` del catálogo de estados (ver SEVERITY_OPTIONS en
// configuracion/page.jsx y src/app/tag-colors.css). Sirve donde no se puede usar <Tag>:
// gráficas, PDF y puntos de la línea de tiempo. Así un estado creado desde el CRUD
// de configuración se ve bien sin tocar código.
export const SEVERITY_HEX = {
  info: '#0ea5e9',
  success: '#22c55e',
  warning: '#f97316',
  danger: '#ef4444',
  secondary: '#64748b',
  contrast: '#1e293b',
  help: '#a855f7',
  indigo: '#6366f1',
  teal: '#14b8a6',
  cyan: '#06b6d4',
  pink: '#ec4899',
  yellow: '#eab308',
  brown: '#92400e',
}

export const severityHex = (severity, fallback = '#6b7280') => SEVERITY_HEX[severity] || fallback

// Colores del punto de la línea de tiempo: fondo/borde translúcidos a partir del hex
export const severityDot = (severity) => {
  const hex = severityHex(severity, '#64748b')
  return { bg: `${hex}22`, color: hex, border: `${hex}55` }
}

// Estados que forman el flujo lineal del proyecto (barra de pasos del detalle).
// Cualquier otro (p. ej. Stand By) es un estado "fuera de flujo".
export const PIPELINE_IDS = [3, 1, 2, 4, 5]
