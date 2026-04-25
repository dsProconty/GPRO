import axios from 'axios'

export const perfilUsuarioService = {
  async getAll() {
    const response = await axios.get('/api/v1/perfiles-usuario')
    return response.data
  },
  async create(data) {
    const response = await axios.post('/api/v1/perfiles-usuario', data)
    return response.data
  },
  async update(id, data) {
    const response = await axios.put(`/api/v1/perfiles-usuario/${id}`, data)
    return response.data
  },
  async remove(id) {
    const response = await axios.delete(`/api/v1/perfiles-usuario/${id}`)
    return response.data
  },
}
