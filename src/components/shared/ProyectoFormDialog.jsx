'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog } from 'primereact/dialog'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { InputNumber } from 'primereact/inputnumber'
import { Dropdown } from 'primereact/dropdown'
import { MultiSelect } from 'primereact/multiselect'
import { Calendar } from 'primereact/calendar'
import { Toast } from 'primereact/toast'
import { proyectoService } from '@/services/proyectoService'
import { clienteService } from '@/services/clienteService'

export default function ProyectoFormDialog({ visible, onHide, onSave, proyecto, empresas, estados, usuarios }) {
  const toast = useRef(null)

  const emptyForm = {
    detalle: '',
    empresaId: null,
    valor: 0,
    fechaCreacion: null,
    fechaCierre: null,
    estadoId: null,
    aplicativo: '',
    projectOnline: '',
    clienteIds: [],
    responsableIds: [],
  }

  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [clientesFiltrados, setClientesFiltrados] = useState([])
  const [loadingClientes, setLoadingClientes] = useState(false)

  useEffect(() => {
    if (visible) {
      if (proyecto) {
        setForm({
          detalle: proyecto.detalle || '',
          empresaId: proyecto.empresaId || null,
          valor: Number(proyecto.valor) || 0,
          fechaCreacion: proyecto.fechaCreacion ? new Date(proyecto.fechaCreacion) : null,
          fechaCierre: proyecto.fechaCierre ? new Date(proyecto.fechaCierre) : null,
          estadoId: proyecto.estadoId || null,
          aplicativo: proyecto.aplicativo || '',
          projectOnline: proyecto.projectOnline || '',
          clienteIds: proyecto.clienteIds || [],
          responsableIds: proyecto.responsableIds || [],
        })
        if (proyecto.empresaId) loadClientes(proyecto.empresaId)
      } else {
        setForm(emptyForm)
        setClientesFiltrados([])
      }
      setErrors({})
    }
  }, [proyecto, visible])

  const loadClientes = async (empresaId) => {
    if (!empresaId) { setClientesFiltrados([]); return }
    setLoadingClientes(true)
    try {
      const res = await clienteService.getAll({ empresa_id: empresaId })
      setClientesFiltrados(res.data)
    } catch {
      setClientesFiltrados([])
    } finally {
      setLoadingClientes(false)
    }
  }

  const handleEmpresaChange = (empresaId) => {
    setForm((f) => ({ ...f, empresaId, clienteIds: [] }))
    loadClientes(empresaId)
  }

  const validate = () => {
    const newErrors = {}
    if (!form.detalle.trim()) newErrors.detalle = 'El detalle es requerido'
    if (!form.empresaId) newErrors.empresaId = 'La empresa es requerida'
    if (!form.estadoId) newErrors.estadoId = 'El estado es requerido'
    if (!form.fechaCreacion) newErrors.fechaCreacion = 'La fecha de inicio es requerida'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      const payload = {
        ...form,
        fechaCreacion: form.fechaCreacion?.toISOString().split('T')[0],
        fechaCierre: form.fechaCierre ? form.fechaCierre.toISOString().split('T')[0] : null,
      }
      if (proyecto) {
        await proyectoService.update(proyecto.id, payload)
      } else {
        await proyectoService.create(payload)
      }
      onSave()
    } catch (error) {
      const msg = error.response?.data?.message || 'Error al guardar el proyecto'
      toast.current.show({ severity: 'error', summary: 'Error', detail: msg, life: 4000 })
    } finally {
      setLoading(false)
    }
  }

  const footer = (
    <div>
      <Button label="Cancelar" icon="pi pi-times" severity="secondary" text onClick={onHide} disabled={loading} />
      <Button label="Guardar" icon="pi pi-check" onClick={handleSubmit} loading={loading} />
    </div>
  )

  const usuariosOptions = usuarios.map((u) => ({ ...u, label: `${u.name} (${u.email})` }))
  const clientesOptions = clientesFiltrados.map((c) => ({ ...c, label: `${c.nombre} ${c.apellido}` }))

  return (
    <>
      <Toast ref={toast} />
      <Dialog
        header={proyecto ? 'Editar Proyecto' : 'Nuevo Proyecto'}
        visible={visible}
        onHide={onHide}
        footer={footer}
        style={{ width: '680px' }}
        modal
        closable={!loading}
      >
        <div className="flex flex-column gap-3 pt-2">

          {/* Código (solo lectura en edición) */}
          {proyecto?.codigo && (
            <div className="flex align-items-center gap-2 p-2 surface-100 border-round">
              <i className="pi pi-hashtag text-color-secondary" />
              <span className="text-sm text-color-secondary">Código:</span>
              <span className="font-bold" style={{ fontFamily: 'monospace' }}>{proyecto.codigo}</span>
            </div>
          )}

          {/* Detalle */}
          <div className="field mb-0">
            <label className="font-semibold block mb-1">Detalle / Nombre <span className="text-red-500">*</span></label>
            <InputText
              value={form.detalle}
              onChange={(e) => setForm({ ...form, detalle: e.target.value })}
              className={`w-full ${errors.detalle ? 'p-invalid' : ''}`}
              placeholder="Nombre o descripción del proyecto"
            />
            {errors.detalle && <small className="p-error">{errors.detalle}</small>}
          </div>

          {/* Empresa + Estado */}
          <div className="grid">
            <div className="col-6">
              <div className="field mb-0">
                <label className="font-semibold block mb-1">Cliente <span className="text-red-500">*</span></label>
                <Dropdown
                  value={form.empresaId}
                  options={empresas}
                  optionLabel="nombre"
                  optionValue="id"
                  onChange={(e) => handleEmpresaChange(e.value)}
                  className={`w-full ${errors.empresaId ? 'p-invalid' : ''}`}
                  placeholder="Seleccionar cliente"
                  filter
                />
                {errors.empresaId && <small className="p-error">{errors.empresaId}</small>}
              </div>
            </div>
            <div className="col-6">
              <div className="field mb-0">
                <label className="font-semibold block mb-1">Estado <span className="text-red-500">*</span></label>
                <Dropdown
                  value={form.estadoId}
                  options={estados}
                  optionLabel="nombre"
                  optionValue="id"
                  onChange={(e) => setForm({ ...form, estadoId: e.value })}
                  className={`w-full ${errors.estadoId ? 'p-invalid' : ''}`}
                  placeholder="Seleccionar estado"
                />
                {errors.estadoId && <small className="p-error">{errors.estadoId}</small>}
              </div>
            </div>
          </div>

          {/* Aplicativo */}
          <div className="field mb-0">
            <label className="font-semibold block mb-1">Aplicativo</label>
            <InputText
              value={form.aplicativo}
              onChange={(e) => setForm({ ...form, aplicativo: e.target.value })}
              className="w-full"
              placeholder="ej: CRV, Typing, Tips (opcional)"
            />
          </div>

          {/* Contactos/PMs del proyecto */}
          <div className="field mb-0">
            <label className="font-semibold block mb-1">
              Contactos / PMs
              {!form.empresaId && <span className="text-color-secondary text-sm font-normal ml-2">(selecciona un cliente primero)</span>}
            </label>
            <MultiSelect
              value={form.clienteIds}
              options={clientesOptions}
              optionLabel="label"
              optionValue="id"
              onChange={(e) => setForm({ ...form, clienteIds: e.value })}
              className="w-full"
              placeholder="Seleccionar contactos"
              display="chip"
              disabled={!form.empresaId || loadingClientes}
              emptyMessage="No hay contactos para este cliente"
              filter
            />
          </div>

          {/* Responsables Proconty */}
          <div className="field mb-0">
            <label className="font-semibold block mb-1">Responsables Proconty</label>
            <MultiSelect
              value={form.responsableIds}
              options={usuariosOptions}
              optionLabel="label"
              optionValue="id"
              onChange={(e) => setForm({ ...form, responsableIds: e.value })}
              className="w-full"
              placeholder="Seleccionar responsables"
              display="chip"
              filter
            />
          </div>

          {/* Valor + Fecha inicio */}
          <div className="grid">
            <div className="col-6">
              <div className="field mb-0">
                <label className="font-semibold block mb-1">Valor del contrato (USD)</label>
                <InputNumber
                  value={form.valor}
                  onValueChange={(e) => setForm({ ...form, valor: e.value ?? 0 })}
                  mode="currency"
                  currency="USD"
                  locale="es-EC"
                  className="w-full"
                  minFractionDigits={2}
                />
              </div>
            </div>
            <div className="col-6">
              <div className="field mb-0">
                <label className="font-semibold block mb-1">Fecha de inicio <span className="text-red-500">*</span></label>
                <Calendar
                  value={form.fechaCreacion}
                  onChange={(e) => setForm({ ...form, fechaCreacion: e.value })}
                  className={`w-full ${errors.fechaCreacion ? 'p-invalid' : ''}`}
                  dateFormat="dd/mm/yy"
                  showIcon
                  placeholder="dd/mm/aaaa"
                />
                {errors.fechaCreacion && <small className="p-error">{errors.fechaCreacion}</small>}
              </div>
            </div>
          </div>

          {/* Fecha cierre + URL */}
          <div className="grid">
            <div className="col-6">
              <div className="field mb-0">
                <label className="font-semibold block mb-1">Fecha de cierre</label>
                <Calendar
                  value={form.fechaCierre}
                  onChange={(e) => setForm({ ...form, fechaCierre: e.value })}
                  className="w-full"
                  dateFormat="dd/mm/yy"
                  showIcon
                  placeholder="dd/mm/aaaa (opcional)"
                />
              </div>
            </div>
          </div>

        </div>
      </Dialog>
    </>
  )
}
