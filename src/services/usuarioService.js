import axios from 'axios'

export const usuarioService = {
  async getAll() {
    const response = await axios.get('/api/v1/usuarios')
    return response.data
  },
}
