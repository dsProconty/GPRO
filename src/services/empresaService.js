import axios from 'axios'

export const empresaService = {
  async getAll() {
    const response = await axios.get('/api/v1/empresas')
    return response.data
  },

  async getById(id) {
    const response = await axios.get(`/api/v1/empresas/${id}`)
    return response.data
  },

  async create(data) {
    const response = await axios.post('/api/v1/empresas', data)
    return response.data
  },

  async update(id, data) {
    const response = await axios.put(`/api/v1/empresas/${id}`, data)
    return response.data
  },

  async remove(id) {
    const response = await axios.delete(`/api/v1/empresas/${id}`)
    return response.data
  },
}
