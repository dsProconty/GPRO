'use client'
// src/hooks/usePermisos.js
// Hook React para verificar permisos del usuario autenticado (Sprint 11)
import { useSession } from 'next-auth/react'
import { PERMISOS } from '@/lib/permisos'

export { PERMISOS }

export function usePermisos() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'admin'
  const permisos = session?.user?.permisos || []
  const estadosEditables = session?.user?.estadosProyectoEditables ?? null // null | int[]

  return {
    /**
     * Retorna true si el usuario tiene el permiso dado.
     * admin siempre retorna true.
     */
    puede: (permiso) => isAdmin || permisos.includes(permiso),

    /**
     * Retorna true si el usuario puede editar un proyecto en el estado dado.
     * Requiere proyectos.editar y que el estado esté en estadosEditables (si aplica).
     */
    puedeEditarProyecto: (estadoId) => {
      if (!isAdmin && !permisos.includes(PERMISOS.PROYECTOS.EDITAR)) return false
      if (isAdmin || !estadosEditables) return true
      return estadosEditables.includes(Number(estadoId))
    },

    isAdmin,
    permisos,
    estadosEditables,
    session,
  }
}
