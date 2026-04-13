// src/lib/permisos.js
// ─────────────────────────────────────────────────────────────────────────────
// RBAC: Constantes de permisos + helpers de enforcement
// Sprint 11 — Módulo de Perfiles de Acceso
// ─────────────────────────────────────────────────────────────────────────────

export const PERMISOS = {
  DASHBOARD: {
    VER: 'dashboard.ver',
  },
  PROYECTOS: {
    VER:           'proyectos.ver',
    CREAR:         'proyectos.crear',
    EDITAR:        'proyectos.editar',
    ELIMINAR:      'proyectos.eliminar',
    CAMBIAR_ESTADO:'proyectos.cambiarEstado',
    PDF:           'proyectos.pdf',
  },
  PROPUESTAS: {
    VER:           'propuestas.ver',
    CREAR:         'propuestas.crear',
    EDITAR:        'propuestas.editar',
    ELIMINAR:      'propuestas.eliminar',
    CAMBIAR_ESTADO:'propuestas.cambiarEstado',
  },
  CLIENTES: {
    VER:      'clientes.ver',
    CREAR:    'clientes.crear',
    EDITAR:   'clientes.editar',
    ELIMINAR: 'clientes.eliminar',
  },
  EMPRESAS: {
    VER:      'empresas.ver',
    CREAR:    'empresas.crear',
    EDITAR:   'empresas.editar',
    ELIMINAR: 'empresas.eliminar',
  },
  FACTURAS: {
    VER:      'facturas.ver',
    CREAR:    'facturas.crear',
    EDITAR:   'facturas.editar',
    ELIMINAR: 'facturas.eliminar',
  },
  PAGOS: {
    VER:      'pagos.ver',
    CREAR:    'pagos.crear',
    EDITAR:   'pagos.editar',
    ELIMINAR: 'pagos.eliminar',
  },
  OBSERVACIONES: {
    VER:   'observaciones.ver',
    CREAR: 'observaciones.crear',
  },
  RECORDATORIOS: {
    VER:      'recordatorios.ver',
    CREAR:    'recordatorios.crear',
    EDITAR:   'recordatorios.editar',
    ELIMINAR: 'recordatorios.eliminar',
  },
  CASOS_NEGOCIO: {
    VER:    'casosNegocio.ver',
    EDITAR: 'casosNegocio.editar',
  },
}

// Lista plana de todos los permisos posibles (útil para UI de selección)
export const TODOS_LOS_PERMISOS = Object.values(PERMISOS).flatMap((m) => Object.values(m))

/**
 * Verifica si la sesión tiene el permiso solicitado.
 * admin bypassa siempre. Usuarios sin perfil (permisos vacíos) no tienen acceso.
 */
export function tienePermiso(session, permiso) {
  if (session?.user?.role === 'admin') return true
  return (session?.user?.permisos || []).includes(permiso)
}

/**
 * Verifica si la sesión puede editar un proyecto en el estado dado.
 * Requiere primero el permiso proyectos.editar.
 * estadosProyectoEditables: null = todos los estados permitidos, int[] = solo esos.
 */
export function puedeEditarProyecto(session, estadoId) {
  if (!tienePermiso(session, PERMISOS.PROYECTOS.EDITAR)) return false
  if (session?.user?.role === 'admin') return true
  const estados = session?.user?.estadosProyectoEditables
  if (!estados) return true
  return estados.includes(Number(estadoId))
}
