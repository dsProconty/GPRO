import axios from 'axios'

export const clienteService = {
  async getAll(params = {}) {
    const response = await axios.get('/api/v1/clientes', { params })
    return response.data
  },

  async getById(id) {
    const response = await axios.get(`/api/v1/clientes/${id}`)
    return response.data
  },

  async create(data) {
    const response = await axios.post('/api/v1/clientes', data)
    return response.data
  },

  async update(id, data) {
    const response = await axios.put(`/api/v1/clientes/${id}`, data)
    return response.data
  },

  async remove(id) {
    const response = await axios.delete(`/api/v1/clientes/${id}`)
    return response.data
  },
}
