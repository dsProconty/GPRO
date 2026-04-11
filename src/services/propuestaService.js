import axios from 'axios'

export const propuestaService = {
  async getAll(params = {}) {
    const response = await axios.get('/api/v1/propuestas', { params })
    return response.data
  },
  async getById(id) {
    const response = await axios.get(`/api/v1/propuestas/${id}`)
    return response.data
  },
  async create(data) {
    const response = await axios.post('/api/v1/propuestas', data)
    return response.data
  },
  async update(id, data) {
    const response = await axios.put(`/api/v1/propuestas/${id}`, data)
    return response.data
  },
  async cambiarEstado(id, data) {
    const response = await axios.patch(`/api/v1/propuestas/${id}`, data)
    return response.data
  },
  async remove(id) {
    const response = await axios.delete(`/api/v1/propuestas/${id}`)
    return response.data
  },
  async getLogs(id) {
    const response = await axios.get(`/api/v1/propuestas/${id}/logs`)
    return response.data
  },
  async getCasoNegocio(id) {
    const response = await axios.get(`/api/v1/propuestas/${id}/caso-negocio`)
    return response.data
  },
  async upsertLineaCaso(id, data) {
    const response = await axios.post(`/api/v1/propuestas/${id}/caso-negocio`, data)
    return response.data
  },
  async deleteLineaCaso(id, perfilId) {
    const response = await axios.delete(`/api/v1/propuestas/${id}/caso-negocio?perfilId=${perfilId}`)
    return response.data
  },
}
