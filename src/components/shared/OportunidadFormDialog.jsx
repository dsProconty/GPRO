'use client'

import { useEffect, useState } from 'react'
import { Dialog } from 'primereact/dialog'
import { InputText } from '@/components/shared/InputText'
import { InputTextarea } from '@/components/shared/InputTextarea'
import { InputNumber } from 'primereact/inputnumber'
import { Dropdown } from 'primereact/dropdown'
import { Calendar } from 'primereact/calendar'
import { Button } from 'primereact/button'
import { oportunidadService } from '@/services/oportunidadService'
import { ETAPAS_INICIALES, ETAPA_CONFIG } from '@/lib/oportunidades'

const ORIGEN_OPTIONS = ['Referido', 'LinkedIn', 'Networking', 'Web', 'Llamada fría', 'Otro']

const CONTACTO_VACIO = { nombre: '', cargo: '', telefono: '', correo: '' }

const EMPTY = {
  titulo: '',
  empresaNombre: '',
  origen: null,
  valorEstimado: null,
  responsableId: null,
  fechaCreacion: new Date(),
  descripcion: '',
  etapa: 'Prospeccion',
}

export default function OportunidadFormDialog({ visible, onHide, onSave, oportunidad, empleados = [] }) {
  const isEdit = !!oportunidad

  const [form, setForm] = useState(EMPTY)
  const [contactos, setContactos] = useState([{ ...CONTACTO_VACIO }])
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!visible) return
    setErrors({})

    if (oportunidad) {
      setForm({
        titulo: oportunidad.titulo || '',
        empresaNombre: oportunidad.empresaNombre || '',
        origen: oportunidad.origen || null,
        valorEstimado: oportunidad.valorEstimado ?? null,
        responsableId: oportunidad.responsableId || null,
        fechaCreacion: oportunidad.fechaCreacion ? new Date(oportunidad.fechaCreacion) : new Date(),
        descripcion: oportunidad.descripcion || '',
      })
      setContactos(
        oportunidad.contactos?.length > 0
          ? oportunidad.contactos.map((c) => ({ nombre: c.nombre || '', cargo: c.cargo || '', telefono: c.telefono || '', correo: c.correo || '' }))
          : [{ ...CONTACTO_VACIO }]
      )
    } else {
      setForm(EMPTY)
      setContactos([{ ...CONTACTO_VACIO }])
    }
  }, [visible, oportunidad])

  const set = (field) => (e) => {
    const val = e.target?.value ?? e.value ?? e
    setForm((prev) => ({ ...prev, [field]: val }))
    setErrors((prev) => ({ ...prev, [field]: null }))
  }

  const setContacto = (idx, field, value) => {
    setContactos((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)))
  }

  const agregarContacto = () => setContactos((prev) => [...prev, { ...CONTACTO_VACIO }])
  const quitarContacto = (idx) => setContactos((prev) => prev.filter((_, i) => i !== idx))

  const validate = () => {
    const errs = {}
    if (!form.titulo?.trim()) errs.titulo = 'El título es requerido'
    if (!form.empresaNombre?.trim()) errs.empresaNombre = 'La empresa es requerida'
    if (!form.responsableId) errs.responsableId = 'El responsable es requerido'
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
        empresaNombre: form.empresaNombre.trim(),
        origen: form.origen || null,
        valorEstimado: form.valorEstimado ?? null,
        responsableId: form.responsableId,
        fechaCreacion: form.fechaCreacion instanceof Date ? form.fechaCreacion.toISOString().slice(0, 10) : form.fechaCreacion,
        descripcion: form.descripcion?.trim() || null,
        contactos: contactos.filter((c) => c.nombre?.trim()),
      }
      if (!isEdit) payload.etapa = form.etapa

      if (isEdit) await oportunidadService.update(oportunidad.id, payload)
      else await oportunidadService.create(payload)

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
      <Button label={isEdit ? 'Guardar cambios' : 'Crear oportunidad'} icon="pi pi-check" onClick={handleSubmit} loading={saving} />
    </div>
  )

  return (
    <Dialog
      visible={visible}
      onHide={onHide}
      header={isEdit ? 'Editar Oportunidad' : 'Nueva Oportunidad'}
      style={{ width: '680px', maxWidth: '95vw' }}
      contentStyle={{ maxHeight: '75vh', overflowY: 'auto', padding: '1.25rem 1.5rem' }}
      footer={footer}
      modal
    >
      <div className="flex flex-column gap-3 mt-2">
        {errors._global && <div className="p-2 surface-100 border-round text-red-600 text-sm">{errors._global}</div>}

        <div className="flex flex-column gap-1">
          <label className="text-sm font-medium">Título de la oportunidad <span className="text-red-500">*</span></label>
          <InputText value={form.titulo} onChange={set('titulo')} placeholder="Ej. Consultoría de procesos logísticos" className={errors.titulo ? 'p-invalid' : ''} />
          {errors.titulo && <small className="text-red-500">{errors.titulo}</small>}
        </div>

        <div className="flex flex-column gap-1">
          <label className="text-sm font-medium">Empresa / prospecto <span className="text-red-500">*</span></label>
          <InputText value={form.empresaNombre} onChange={set('empresaNombre')} placeholder="Nombre legal tal como aparece en el RUC" className={errors.empresaNombre ? 'p-invalid' : ''} />
          <small className="text-color-secondary">Escribe el nombre legal (RUC), no abreviaturas ni nombres comerciales — así evitamos duplicados si esto se convierte en cliente.</small>
          {errors.empresaNombre && <small className="text-red-500">{errors.empresaNombre}</small>}
        </div>

        <div className="flex flex-column gap-2">
          <label className="text-sm font-medium">Contactos</label>
          <div style={{ border: '1px solid var(--surface-border)', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '520px' }}>
                <colgroup>
                  <col style={{ width: '27%' }} />
                  <col style={{ width: '25%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '26%' }} />
                  <col style={{ width: '4%' }} />
                </colgroup>
                <thead>
                  <tr style={{ background: '#f8f9fa', borderBottom: '1px solid var(--surface-border)' }}>
                    {['Nombre', 'Cargo', 'Teléfono', 'Correo', ''].map((h, i) => (
                      <th key={i} style={{ padding: '7px 8px', textAlign: 'left', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contactos.map((c, idx) => (
                    <tr key={idx} style={{ borderBottom: idx < contactos.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                      <td style={{ padding: '3px 4px' }}>
                        <InputText
                          value={c.nombre} onChange={(e) => setContacto(idx, 'nombre', e.target.value)}
                          placeholder="Nombre del contacto" className="w-full"
                          style={{ border: 'none', boxShadow: 'none', background: 'transparent', padding: '6px 6px', fontSize: '13px' }}
                        />
                      </td>
                      <td style={{ padding: '3px 4px' }}>
                        <InputText
                          value={c.cargo} onChange={(e) => setContacto(idx, 'cargo', e.target.value)}
                          placeholder="Ej. Gerente de Compras" className="w-full"
                          style={{ border: 'none', boxShadow: 'none', background: 'transparent', padding: '6px 6px', fontSize: '13px' }}
                        />
                      </td>
                      <td style={{ padding: '3px 4px' }}>
                        <InputText
                          value={c.telefono} onChange={(e) => setContacto(idx, 'telefono', e.target.value)}
                          placeholder="09XXXXXXXX" className="w-full"
                          style={{ border: 'none', boxShadow: 'none', background: 'transparent', padding: '6px 6px', fontSize: '13px' }}
                        />
                      </td>
                      <td style={{ padding: '3px 4px' }}>
                        <InputText
                          value={c.correo} onChange={(e) => setContacto(idx, 'correo', e.target.value)}
                          placeholder="contacto@empresa.com" className="w-full"
                          style={{ border: 'none', boxShadow: 'none', background: 'transparent', padding: '6px 6px', fontSize: '13px' }}
                        />
                      </td>
                      <td style={{ padding: '3px 2px', textAlign: 'center' }}>
                        {contactos.length > 1 && (
                          <Button
                            icon="pi pi-trash" rounded text severity="danger" size="small"
                            style={{ width: '26px', height: '26px' }}
                            tooltip="Quitar contacto" tooltipOptions={{ position: 'top' }}
                            onClick={() => quitarContacto(idx)}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '6px 8px', borderTop: '1px solid var(--surface-border)', background: '#fafbfc' }}>
              <Button label="Agregar otro contacto" icon="pi pi-plus" size="small" text onClick={agregarContacto} />
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="flex flex-column gap-1">
            <label className="text-sm font-medium">Origen</label>
            <Dropdown value={form.origen} options={ORIGEN_OPTIONS} onChange={set('origen')} placeholder="Seleccionar origen" showClear />
          </div>
          <div className="flex flex-column gap-1">
            <label className="text-sm font-medium">Valor estimado (USD)</label>
            <InputNumber value={form.valorEstimado} onValueChange={(e) => setForm((p) => ({ ...p, valorEstimado: e.value }))} mode="decimal" minFractionDigits={2} maxFractionDigits={2} placeholder="0.00" />
          </div>
        </div>

        {!isEdit && (
          <div className="flex flex-column gap-1">
            <label className="text-sm font-medium">Etapa inicial</label>
            <Dropdown
              value={form.etapa}
              options={ETAPAS_INICIALES.map((e) => ({ label: ETAPA_CONFIG[e].label, value: e }))}
              onChange={set('etapa')}
            />
            <small className="text-color-secondary">No siempre nace en Prospección — elige en qué punto del proceso ya se encuentra esta oportunidad.</small>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="flex flex-column gap-1">
            <label className="text-sm font-medium">Responsable <span className="text-red-500">*</span></label>
            <Dropdown
              value={form.responsableId}
              options={empleados.map((e) => ({ label: `${e.nombre} ${e.apellido}`, value: e.id }))}
              onChange={set('responsableId')}
              placeholder="Seleccionar responsable" filter
              className={errors.responsableId ? 'p-invalid' : ''}
            />
            {errors.responsableId && <small className="text-red-500">{errors.responsableId}</small>}
          </div>
          <div className="flex flex-column gap-1">
            <label className="text-sm font-medium">Fecha de creación <span className="text-red-500">*</span></label>
            <Calendar value={form.fechaCreacion} onChange={set('fechaCreacion')} dateFormat="dd/mm/yy" className={errors.fechaCreacion ? 'p-invalid' : ''} />
            {errors.fechaCreacion && <small className="text-red-500">{errors.fechaCreacion}</small>}
          </div>
        </div>

        <div className="flex flex-column gap-1">
          <label className="text-sm font-medium">Descripción</label>
          <InputTextarea value={form.descripcion} onChange={set('descripcion')} placeholder="Detalle breve de lo que necesita el prospecto..." rows={3} autoResize />
        </div>

      </div>
    </Dialog>
  )
}
