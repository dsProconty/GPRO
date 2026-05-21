import axios from 'axios'

const BASE = '/api/v1/empleados'

export const empleadoService = {
  async getAll(params = {})    { const r = await axios.get(BASE, { params }); return r.data },
  async getById(id)            { const r = await axios.get(`${BASE}/${id}`); return r.data },
  async create(data)           { const r = await axios.post(BASE, data); return r.data },
  async update(id, data)       { const r = await axios.put(`${BASE}/${id}`, data); return r.data },
  async remove(id)             { const r = await axios.delete(`${BASE}/${id}`); return r.data },
}
