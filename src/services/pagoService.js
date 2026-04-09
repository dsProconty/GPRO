import axios from 'axios'

export const pagoService = {
  async getAll(params = {}) {
    const response = await axios.get('/api/v1/pagos', { params })
    return response.data
  },
  async create(data) {
    const response = await axios.post('/api/v1/pagos', data)
    return response.data
  },
  async update(id, data) {
    const response = await axios.put(`/api/v1/pagos/${id}`, data)
    return response.data
  },
  async remove(id) {
    const response = await axios.delete(`/api/v1/pagos/${id}`)
    return response.data
  },
}
