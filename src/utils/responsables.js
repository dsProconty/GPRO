// Los responsables de proyectos/propuestas son Empleados (ya no Users).
// Nombre completo de un responsable (pivote con `empleado` incluido), o '' si no hay datos.
export const nombreResponsable = (r) =>
  r?.empleado ? `${r.empleado.nombre ?? ''} ${r.empleado.apellido ?? ''}`.trim() : ''

// "Ana Pérez, Luis Mora" — omite los vacíos; '—' si no hay ninguno.
export const listaResponsables = (responsables) =>
  (responsables ?? []).map(nombreResponsable).filter(Boolean).join(', ') || '—'
