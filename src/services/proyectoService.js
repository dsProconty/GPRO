import axios from 'axios'

export const proyectoService = {
  async getAll(params = {}) {
    const response = await axios.get('/api/v1/proyectos', { params })
    return response.data
  },

  async getById(id) {
    const response = await axios.get(`/api/v1/proyectos/${id}`)
    return response.data
  },

  async create(data) {
    const response = await axios.post('/api/v1/proyectos', data)
    return response.data
  },

  async update(id, data) {
    const response = await axios.put(`/api/v1/proyectos/${id}`, data)
    return response.data
  },

  async remove(id) {
    const response = await axios.delete(`/api/v1/proyectos/${id}`)
    return response.data
  },
}
