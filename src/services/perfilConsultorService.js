import axios from 'axios'

export const perfilConsultorService = {
  getAll(params)      { return axios.get('/api/v1/perfiles-consultor', { params }) },
  create(data)        { return axios.post('/api/v1/perfiles-consultor', data) },
  update(id, data)    { return axios.put(`/api/v1/perfiles-consultor/${id}`, data) },
  remove(id)          { return axios.delete(`/api/v1/perfiles-consultor/${id}`) },
}

export const NIVEL_OPTIONS = [
  { label: 'Senior',      value: 'Senior'      },
  { label: 'Semi Senior', value: 'Semi Senior' },
  { label: 'Junior',      value: 'Junior'      },
]
