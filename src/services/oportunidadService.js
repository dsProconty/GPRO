import axios from 'axios'

const BASE = '/api/v1/oportunidades'

export const oportunidadService = {
  async getAll(params = {})   { const r = await axios.get(BASE, { params }); return r.data },
  async getById(id)           { const r = await axios.get(`${BASE}/${id}`); return r.data },
  async create(data)          { const r = await axios.post(BASE, data); return r.data },
  async update(id, data)      { const r = await axios.put(`${BASE}/${id}`, data); return r.data },
  async cambiarEtapa(id, data){ const r = await axios.patch(`${BASE}/${id}`, data); return r.data },
  async remove(id)            { const r = await axios.delete(`${BASE}/${id}`); return r.data },
  async getKpis()             { const r = await axios.get(`${BASE}/kpis`); return r.data },
  async getSeguimientos(id)   { const r = await axios.get(`${BASE}/${id}/seguimientos`); return r.data },
  async addSeguimiento(id, descripcion) { const r = await axios.post(`${BASE}/${id}/seguimientos`, { descripcion }); return r.data },
}
