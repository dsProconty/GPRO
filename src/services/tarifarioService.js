import axios from 'axios'

const BASE = '/api/v1/tarifarios'

export const tarifarioService = {
  getAll:       (params = {})        => axios.get(BASE, { params }),
  getById:      (id)                 => axios.get(`${BASE}/${id}`),
  create:       (data)               => axios.post(BASE, data),
  update:       (id, data)           => axios.put(`${BASE}/${id}`, data),
  remove:       (id)                 => axios.delete(`${BASE}/${id}`),
  getLineas:    (id)                 => axios.get(`${BASE}/${id}/lineas`),
  saveLinea:    (id, data)           => axios.post(`${BASE}/${id}/lineas`, data),
  removeLinea:  (id, lineaId)        => axios.delete(`${BASE}/${id}/lineas?lineaId=${lineaId}`),
}
