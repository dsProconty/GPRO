'use client'

import { useEffect, useState } from 'react'
import { Dialog } from 'primereact/dialog'
import { InputText } from 'primereact/inputtext'
import { InputTextarea } from 'primereact/inputtextarea'
import { InputNumber } from 'primereact/inputnumber'
import { Dropdown } from 'primereact/dropdown'
import { MultiSelect } from 'primereact/multiselect'
import { Calendar } from 'primereact/calendar'
import { Button } from 'primereact/button'
import axios from 'axios'

const EMPTY = {
  titulo: '',
  descripcion: '',
  empresaId: null,
  valorEstimado: null,
  fechaCreacion: new Date(),
  aplicativo: '',
  responsableIds: [],
}

export default function PropuestaFormDialog({ visible, onHide, onSave, propuesta, empresas = [], usuarios = [] }) {
  const isEdit = !!propuesta
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (visible) {
      if (propuesta) {
        setForm({
          titulo: propuesta.titulo || '',
          descripcion: propuesta.descripcion || '',
          empresaId: propuesta.empresaId || null,
          valorEstimado: propuesta.valorEstimado ?? null,
          fechaCreacion: propuesta.fechaCreacion ? new Date(propuesta.fechaCreacion) : new Date(),
          aplicativo: propuesta.aplicativo || '',
          responsableIds: propuesta.responsables?.map((r) => r.userId) || [],
        })
      } else {
        setForm(EMPTY)
      }
      setErrors({})
    }
  }, [visible, propuesta])

  const set = (field) => (e) => {
    const val = e.target?.value ?? e.value ?? e
    setForm((prev) => ({ ...prev, [field]: val }))
    setErrors((prev) => ({ ...prev, [field]: null }))
  }

  const validate = () => {
    const errs = {}
    if (!form.titulo?.trim()) errs.titulo = 'El título es requerido'
    if (!form.empresaId) errs.empresaId = 'La empresa es requerida'
    if (!form.fechaCreacion) errs.fechaCreacion = 'La fecha de creación es requerida'
    return errs
  }

  const handleSubmit = async () => {
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSaving(true)
    try {
      const payload = {
        titulo: form.titulo.trim(),
        descripcion: form.descripcion?.trim() || null,
        empresaId: form.empresaId,
        valorEstimado: form.valorEstimado ?? null,
        fechaCreacion: form.fechaCreacion instanceof Date
          ? form.fechaCreacion.toISOString().slice(0, 10)
          : form.fechaCreacion,
        aplicativo: form.aplicativo?.trim() || null,
        responsableIds: form.responsableIds,
      }
      if (isEdit) {
        await axios.put(`/api/v1/propuestas/${propuesta.id}`, payload)
      } else {
        await axios.post('/api/v1/propuestas', payload)
      }
      onSave()
    } catch (err) {
      const apiErrors = err.response?.data?.errors || {}
      const mapped = {}
      Object.keys(apiErrors).forEach((k) => { mapped[k] = apiErrors[k][0] })
      if (Object.keys(mapped).length > 0) setErrors(mapped)
      else setErrors({ _global: err.response?.data?.message || 'Error al guardar' })
    } finally {
      setSaving(false)
    }
  }

  const footer = (
    <div className="flex justify-content-end gap-2">
      <Button label="Cancelar" icon="pi pi-times" severity="secondary" outlined onClick={onHide} disabled={saving} />
      <Button label={isEdit ? 'Guardar cambios' : 'Crear propuesta'} icon="pi pi-check" onClick={handleSubmit} loading={saving} />
    </div>
  )

  return (
    <Dialog
      visible={visible}
      onHide={onHide}
      header={isEdit ? 'Editar Propuesta' : 'Nueva Propuesta'}
      style={{ width: '520px' }}
      footer={footer}
      modal
    >
      <div className="flex flex-column gap-3 mt-2">
        {errors._global && <div className="p-2 surface-100 border-round text-red-600 text-sm">{errors._global}</div>}

        {propuesta?.codigo && (
          <div className="flex align-items-center gap-2 p-2 surface-100 border-round">
            <i className="pi pi-hashtag text-color-secondary" />
            <span className="text-sm text-color-secondary">Código:</span>
            <span className="font-bold" style={{ fontFamily: 'monospace' }}>{propuesta.codigo}</span>
          </div>
        )}

        <div className="flex flex-column gap-1">
          <label className="text-sm font-medium">Título <span className="text-red-500">*</span></label>
          <InputText value={form.titulo} onChange={set('titulo')} placeholder="Nombre de la propuesta" className={errors.titulo ? 'p-invalid' : ''} />
          {errors.titulo && <small className="text-red-500">{errors.titulo}</small>}
        </div>

        <div className="flex flex-column gap-1">
          <label className="text-sm font-medium">Empresa cliente <span className="text-red-500">*</span></label>
          <Dropdown
            value={form.empresaId}
            options={empresas}
            optionLabel="nombre"
            optionValue="id"
            onChange={set('empresaId')}
            placeholder="Seleccionar empresa"
            filter
            className={errors.empresaId ? 'p-invalid' : ''}
          />
          {errors.empresaId && <small className="text-red-500">{errors.empresaId}</small>}
        </div>

        <div className="grid m-0 gap-3">
          <div className="flex flex-column gap-1 col p-0">
            <label className="text-sm font-medium">Valor estimado (USD)</label>
            <InputNumber
              value={form.valorEstimado}
              onValueChange={(e) => { setForm((p) => ({ ...p, valorEstimado: e.value })); setErrors((p) => ({ ...p, valorEstimado: null })) }}
              mode="decimal"
              minFractionDigits={2}
              maxFractionDigits={2}
              placeholder="0.00"
            />
          </div>
          <div className="flex flex-column gap-1 col p-0">
            <label className="text-sm font-medium">Fecha de inicio <span className="text-red-500">*</span></label>
            <Calendar
              value={form.fechaCreacion}
              onChange={set('fechaCreacion')}
              dateFormat="dd/mm/yy"
              className={errors.fechaCreacion ? 'p-invalid' : ''}
            />
            {errors.fechaCreacion && <small className="text-red-500">{errors.fechaCreacion}</small>}
          </div>
        </div>

        <div className="flex flex-column gap-1">
          <label className="text-sm font-medium">Responsables Proconty</label>
          <MultiSelect
            value={form.responsableIds}
            options={usuarios}
            optionLabel="name"
            optionValue="id"
            onChange={(e) => setForm((p) => ({ ...p, responsableIds: e.value }))}
            placeholder="Seleccionar responsables"
            display="chip"
          />
        </div>

        <div className="flex flex-column gap-1">
          <label className="text-sm font-medium">Aplicativo</label>
          <InputText value={form.aplicativo} onChange={set('aplicativo')} placeholder="ej: CRV, Typing, Tips (opcional)" />
        </div>

        <div className="flex flex-column gap-1">
          <label className="text-sm font-medium">Descripción / Alcance</label>
          <InputTextarea
            value={form.descripcion}
            onChange={set('descripcion')}
            placeholder="Descripción general de la propuesta..."
            rows={3}
            autoResize
          />
        </div>
      </div>
    </Dialog>
  )
}
