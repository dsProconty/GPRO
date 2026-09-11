'use client'

import { useEffect, useState } from 'react'
import { Dialog } from 'primereact/dialog'
import { InputText } from '@/components/shared/InputText'
import { InputTextarea } from '@/components/shared/InputTextarea'
import { InputNumber } from 'primereact/inputnumber'
import { Dropdown } from 'primereact/dropdown'
import { MultiSelect } from 'primereact/multiselect'
import { Calendar } from 'primereact/calendar'
import { Button } from 'primereact/button'
import { Tag } from 'primereact/tag'
import { oportunidadService } from '@/services/oportunidadService'
import { clienteService } from '@/services/clienteService'
import { ETAPAS, ETAPA_CONFIG, ETAPA_HOOK } from '@/lib/oportunidades'

function EtapaTag({ etapa }) {
  const cfg = ETAPA_CONFIG[etapa] || { label: etapa, severity: 'secondary' }
  return <Tag value={cfg.label} severity={cfg.severity} style={cfg.color ? { background: cfg.color, color: '#fff' } : undefined} />
}

const NUEVA_EMPRESA = '__NUEVA__'

const ORIGEN_OPTIONS = ['Referido', 'LinkedIn', 'Networking', 'Web', 'Llamada fría', 'Otro']

const CONTACTO_NUEVO_VACIO = { nombre: '', apellido: '', cargo: '', telefono: '', mail: '' }

const EMPTY = {
  titulo: '',
  empresaId: null,
  origen: null,
  valorEstimado: null,
  responsableId: null,
  fechaCreacion: new Date(),
  descripcion: '',
  etapa: 'Prospeccion',
  clienteIds: [],
}

export default function OportunidadFormDialog({ visible, onHide, onSave, oportunidad, empleados = [], empresas = [] }) {
  const isEdit = !!oportunidad

  const [form, setForm] = useState(EMPTY)
  const [nuevaEmpresaNombre, setNuevaEmpresaNombre] = useState('')
  const [clientesEmpresa, setClientesEmpresa] = useState([])
  const [contactosNuevos, setContactosNuevos] = useState([])
  const [contactoForm, setContactoForm] = useState(null) // null = panel cerrado
  const [motivoPerdidaInicial, setMotivoPerdidaInicial] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const empresaEsNueva = form.empresaId === NUEVA_EMPRESA

  useEffect(() => {
    if (!visible) return
    setErrors({})
    setMotivoPerdidaInicial('')
    setContactosNuevos([])
    setContactoForm(null)
    setNuevaEmpresaNombre('')

    if (oportunidad) {
      setForm({
        titulo: oportunidad.titulo || '',
        empresaId: oportunidad.empresaId || null,
        origen: oportunidad.origen || null,
        valorEstimado: oportunidad.valorEstimado ?? null,
        responsableId: oportunidad.responsableId || null,
        fechaCreacion: oportunidad.fechaCreacion ? new Date(oportunidad.fechaCreacion) : new Date(),
        descripcion: oportunidad.descripcion || '',
        etapa: oportunidad.etapa || 'Prospeccion',
        clienteIds: oportunidad.clientes?.map((c) => c.clienteId) || [],
      })
    } else {
      setForm(EMPTY)
    }
  }, [visible, oportunidad])

  // Cargar los contactos existentes de la empresa elegida (solo si es una empresa real)
  useEffect(() => {
    if (!form.empresaId || form.empresaId === NUEVA_EMPRESA) { setClientesEmpresa([]); return }
    clienteService.getAll({ empresa_id: form.empresaId })
      .then((res) => setClientesEmpresa(res.data || []))
      .catch(() => setClientesEmpresa([]))
  }, [form.empresaId])

  const set = (field) => (e) => {
    const val = e.target?.value ?? e.value ?? e
    setForm((prev) => ({ ...prev, [field]: val }))
    setErrors((prev) => ({ ...prev, [field]: null }))
  }

  const handleEmpresaChange = (e) => {
    setForm((prev) => ({ ...prev, empresaId: e.value, clienteIds: [] }))
    setErrors((prev) => ({ ...prev, empresaId: null }))
    setContactosNuevos([])
    setContactoForm(null)
  }

  const validate = () => {
    const errs = {}
    if (!form.titulo?.trim()) errs.titulo = 'El título es requerido'
    if (!form.empresaId) errs.empresaId = 'La empresa es requerida'
    if (form.empresaId === NUEVA_EMPRESA && !nuevaEmpresaNombre.trim()) errs.empresaId = 'Escribe el nombre de la nueva empresa'
    if (!form.responsableId) errs.responsableId = 'El responsable es requerido'
    if (!form.fechaCreacion) errs.fechaCreacion = 'La fecha de creación es requerida'
    return errs
  }

  // ── Contacto nuevo cuando la empresa YA existe → se crea de una vez como Cliente real ──
  const guardarContactoExistente = async () => {
    if (!contactoForm?.nombre?.trim() || !contactoForm?.apellido?.trim()) return
    try {
      const res = await clienteService.create({
        nombre: contactoForm.nombre.trim(),
        apellido: contactoForm.apellido.trim(),
        cargo: contactoForm.cargo?.trim() || null,
        telefono: contactoForm.telefono?.trim() || null,
        mail: contactoForm.mail?.trim() || null,
        empresaId: form.empresaId,
      })
      const nuevoCliente = res.data
      setClientesEmpresa((prev) => [...prev, nuevoCliente])
      setForm((prev) => ({ ...prev, clienteIds: [...prev.clienteIds, nuevoCliente.id] }))
      setContactoForm(null)
    } catch (err) {
      setErrors((prev) => ({ ...prev, _global: err.response?.data?.message || 'Error al crear el contacto' }))
    }
  }

  // ── Contacto nuevo cuando la empresa TODAVÍA no existe → se guarda localmente y se crea junto con la oportunidad ──
  const agregarContactoLocal = () => {
    if (!contactoForm?.nombre?.trim() || !contactoForm?.apellido?.trim()) return
    setContactosNuevos((prev) => [...prev, { ...contactoForm }])
    setContactoForm(null)
  }

  const quitarContactoNuevo = (idx) => setContactosNuevos((prev) => prev.filter((_, i) => i !== idx))

  const handleSubmit = async () => {
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSaving(true)
    try {
      const payload = {
        titulo: form.titulo.trim(),
        origen: form.origen || null,
        valorEstimado: form.valorEstimado ?? null,
        responsableId: form.responsableId,
        fechaCreacion: form.fechaCreacion instanceof Date ? form.fechaCreacion.toISOString().slice(0, 10) : form.fechaCreacion,
        descripcion: form.descripcion?.trim() || null,
        clienteIds: form.clienteIds,
      }
      if (empresaEsNueva) {
        payload.empresaId = null
        payload.empresaNombreNueva = nuevaEmpresaNombre.trim()
        payload.contactosNuevos = contactosNuevos
      } else {
        payload.empresaId = form.empresaId
      }
      if (!isEdit) {
        payload.etapa = form.etapa
        if (form.etapa === 'Perdida') payload.motivoPerdida = motivoPerdidaInicial?.trim() || null
      }

      const res = isEdit
        ? await oportunidadService.update(oportunidad.id, payload)
        : await oportunidadService.create(payload)

      onSave(res)
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

  const empresaOptions = isEdit
    ? empresas.map((e) => ({ label: e.nombre, value: e.id }))
    : [{ label: '➕ Crear nueva empresa', value: NUEVA_EMPRESA }, ...empresas.map((e) => ({ label: e.nombre, value: e.id }))]

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

        <div style={{ display: 'grid', gridTemplateColumns: isEdit ? '1fr' : '2fr 1fr', gap: '12px' }}>
          <div className="flex flex-column gap-1">
            <label className="text-sm font-medium">Empresa <span className="text-red-500">*</span></label>
            <Dropdown
              value={form.empresaId}
              options={empresaOptions}
              onChange={handleEmpresaChange}
              placeholder="Buscar o crear empresa"
              filter
              className={errors.empresaId ? 'p-invalid' : ''}
            />
            {empresaEsNueva && (
              <InputText
                value={nuevaEmpresaNombre}
                onChange={(e) => { setNuevaEmpresaNombre(e.target.value); setErrors((p) => ({ ...p, empresaId: null })) }}
                placeholder="Nombre legal de la nueva empresa (RUC)"
                className={`mt-1 ${errors.empresaId ? 'p-invalid' : ''}`}
              />
            )}
            {errors.empresaId && <small className="text-red-500">{errors.empresaId}</small>}
          </div>

          {!isEdit && (
            <div className="flex flex-column gap-1">
              <label className="text-sm font-medium">Etapa inicial</label>
              <Dropdown
                value={form.etapa}
                options={ETAPAS.map((e) => ({ label: ETAPA_CONFIG[e].label, value: e }))}
                onChange={set('etapa')}
                itemTemplate={(opt) => <EtapaTag etapa={opt.value} />}
                valueTemplate={(opt) => opt ? <EtapaTag etapa={opt.value} /> : <span className="text-color-secondary">Seleccionar</span>}
              />
            </div>
          )}
        </div>

        {!isEdit && form.etapa === ETAPA_HOOK && (
          <div className="flex align-items-start gap-2 p-3 border-round" style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
            <i className="pi pi-info-circle text-green-600 mt-1" />
            <div className="text-sm text-green-800">
              Al crearla directamente en <strong>Solicitud de RFP</strong>, GPRO generará automáticamente una <strong>Propuesta</strong> en estado Factibilidad, con esta empresa y estos contactos ya asignados.
            </div>
          </div>
        )}

        {!isEdit && form.etapa === 'Perdida' && (
          <div className="flex flex-column gap-1">
            <label className="text-sm font-medium">Motivo de pérdida (opcional)</label>
            <InputTextarea value={motivoPerdidaInicial} onChange={(e) => setMotivoPerdidaInicial(e.target.value)} placeholder="Ej. presupuesto insuficiente, eligió otro proveedor..." rows={2} autoResize />
          </div>
        )}

        {/* ── Contactos ── */}
        <div className="flex flex-column gap-2">
          <label className="text-sm font-medium">Puntos de contacto</label>

          {!empresaEsNueva && (
            <MultiSelect
              value={form.clienteIds}
              options={clientesEmpresa.map((c) => ({ label: `${c.nombre} ${c.apellido}${c.cargo ? ' · ' + c.cargo : ''}`, value: c.id }))}
              onChange={(e) => setForm((p) => ({ ...p, clienteIds: e.value }))}
              placeholder={form.empresaId ? 'Seleccionar contacto(s)' : 'Primero elige una empresa'}
              disabled={!form.empresaId}
              display="chip"
              filter
              filterPlaceholder="Buscar contacto..."
              emptyMessage="Sin contactos para esta empresa"
            />
          )}

          {empresaEsNueva && contactosNuevos.length > 0 && (
            <div className="flex flex-column gap-1">
              {contactosNuevos.map((c, idx) => (
                <div key={idx} className="flex align-items-center justify-content-between p-2 border-round surface-100">
                  <span className="text-sm">
                    {c.nombre} {c.apellido}{c.cargo ? ` · ${c.cargo}` : ''}{c.telefono ? ` · ${c.telefono}` : ''}{c.mail ? ` · ${c.mail}` : ''}
                  </span>
                  <Button icon="pi pi-trash" rounded text severity="danger" size="small" onClick={() => quitarContactoNuevo(idx)} />
                </div>
              ))}
            </div>
          )}

          {!contactoForm && (
            <Button
              label="Agregar contacto"
              icon="pi pi-user-plus"
              size="small"
              text
              disabled={!form.empresaId || (empresaEsNueva && !nuevaEmpresaNombre.trim())}
              onClick={() => setContactoForm({ ...CONTACTO_NUEVO_VACIO })}
            />
          )}

          {contactoForm && (
            <div className="flex flex-column gap-2 p-3 border-round" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <InputText value={contactoForm.nombre} onChange={(e) => setContactoForm((p) => ({ ...p, nombre: e.target.value }))} placeholder="Nombre *" />
                <InputText value={contactoForm.apellido} onChange={(e) => setContactoForm((p) => ({ ...p, apellido: e.target.value }))} placeholder="Apellido *" />
                <InputText value={contactoForm.cargo} onChange={(e) => setContactoForm((p) => ({ ...p, cargo: e.target.value }))} placeholder="Cargo (ej. Gerente de Compras)" />
                <InputText value={contactoForm.telefono} onChange={(e) => setContactoForm((p) => ({ ...p, telefono: e.target.value }))} placeholder="Teléfono" />
                <InputText value={contactoForm.mail} onChange={(e) => setContactoForm((p) => ({ ...p, mail: e.target.value }))} placeholder="Correo" style={{ gridColumn: '1 / -1' }} />
              </div>
              <div className="flex gap-2 justify-content-end">
                <Button label="Cancelar" size="small" severity="secondary" outlined onClick={() => setContactoForm(null)} />
                <Button
                  label="Guardar contacto"
                  icon="pi pi-check"
                  size="small"
                  disabled={!contactoForm.nombre?.trim() || !contactoForm.apellido?.trim()}
                  onClick={empresaEsNueva ? agregarContactoLocal : guardarContactoExistente}
                />
              </div>
            </div>
          )}
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
