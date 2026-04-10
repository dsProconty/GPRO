import axios from 'axios'

export const configuracionService = {
  // GET /api/v1/configuracion → { estadosProyecto, estadosPropuesta }
  getAll() {
    return axios.get('/api/v1/configuracion')
  },

  // Crear nuevo estado de proyecto
  createEstadoProyecto(data) {
    return axios.post('/api/v1/configuracion', data)
  },

  // Editar nombre/color de estado de proyecto
  updateEstadoProyecto(id, data) {
    return axios.put(`/api/v1/configuracion/estados-proyecto/${id}`, data)
  },

  // Eliminar estado de proyecto (solo si no hay proyectos usándolo)
  deleteEstadoProyecto(id) {
    return axios.delete(`/api/v1/configuracion/estados-proyecto/${id}`)
  },

  // Renombrar label de estado de propuesta (key es el identificador interno)
  updateEstadoPropuesta(key, data) {
    return axios.put(`/api/v1/configuracion/estados-propuesta/${key}`, data)
  },
}

// Helpers para construir el mapa de config indexado por key/id
export const SEVERITY_COLORS = {
  warning:   '#f59e0b',
  info:      '#3b82f6',
  secondary: '#6b7280',
  success:   '#22c55e',
  danger:    '#ef4444',
}

// Convierte array de propuestaEstadoLabels → mapa indexado por key
export function buildPropuestaConfig(labels = []) {
  return Object.fromEntries(
    labels.map((l) => [
      l.key,
      { ...l, color: SEVERITY_COLORS[l.severity] || '#6b7280' },
    ])
  )
}
