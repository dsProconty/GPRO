import axios from 'axios'

const BASE = '/api/v1/empleados'

export const empleadoService = {
  getAll:  (params = {}) => axios.get(BASE, { params }),
  getById: (id)          => axios.get(`${BASE}/${id}`),
  create:  (data)        => axios.post(BASE, data),
  update:  (id, data)    => axios.put(`${BASE}/${id}`, data),
  remove:  (id)          => axios.delete(`${BASE}/${id}`),
}
