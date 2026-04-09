import axios from 'axios'

export const observacionService = {
  async getAll(params = {}) {
    const response = await axios.get('/api/v1/observaciones', { params })
    return response.data
  },
  async create(data) {
    const response = await axios.post('/api/v1/observaciones', data)
    return response.data
  },
}
