import axios from 'axios'

export const facturaService = {
  async getAll(params = {}) {
    const response = await axios.get('/api/v1/facturas', { params })
    return response.data
  },
  async getById(id) {
    const response = await axios.get(`/api/v1/facturas/${id}`)
    return response.data
  },
  async create(data) {
    const response = await axios.post('/api/v1/facturas', data)
    return response.data
  },
  async update(id, data) {
    const response = await axios.put(`/api/v1/facturas/${id}`, data)
    return response.data
  },
  async remove(id) {
    const response = await axios.delete(`/api/v1/facturas/${id}`)
    return response.data
  },
}
