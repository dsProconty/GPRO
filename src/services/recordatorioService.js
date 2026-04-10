import axios from 'axios'

export const recordatorioService = {
  async getAll(params = {}) {
    const response = await axios.get('/api/v1/recordatorios', { params })
    return response.data
  },
  async create(data) {
    const response = await axios.post('/api/v1/recordatorios', data)
    return response.data
  },
  async update(id, data) {
    const response = await axios.put(`/api/v1/recordatorios/${id}`, data)
    return response.data
  },
  async remove(id) {
    const response = await axios.delete(`/api/v1/recordatorios/${id}`)
    return response.data
  },
}
