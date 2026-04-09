'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog } from 'primereact/dialog'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { Dropdown } from 'primereact/dropdown'
import { Toast } from 'primereact/toast'
import { clienteService } from '@/services/clienteService'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ClienteFormDialog({ visible, onHide, onSave, cliente, empresas }) {
  const toast = useRef(null)
  const [form, setForm] = useState({ nombre: '', apellido: '', telefono: '', mail: '', empresaId: null })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (visible) {
      if (cliente) {
        setForm({
          nombre: cliente.nombre || '',
          apellido: cliente.apellido || '',
          telefono: cliente.telefono || '',
          mail: cliente.mail || '',
          empresaId: cliente.empresaId || null,
        })
      } else {
        setForm({ nombre: '', apellido: '', telefono: '', mail: '', empresaId: null })
      }
      setErrors({})
    }
  }, [cliente, visible])

  const validate = () => {
    const newErrors = {}
    if (!form.nombre.trim()) newErrors.nombre = 'El nombre es requerido'
    if (!form.apellido.trim()) newErrors.apellido = 'El apellido es requerido'
    if (!form.empresaId) newErrors.empresaId = 'La empresa es requerida'
    if (form.mail.trim() && !EMAIL_REGEX.test(form.mail)) newErrors.mail = 'Email inválido'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      if (cliente) {
        await clienteService.update(cliente.id, form)
      } else {
        await clienteService.create(form)
      }
      onSave()
    } catch (error) {
      const msg = error.response?.data?.message || 'Error al guardar el cliente'
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

  return (
    <>
      <Toast ref={toast} />
      <Dialog
        header={cliente ? 'Editar Cliente' : 'Nuevo Cliente'}
        visible={visible}
        onHide={onHide}
        footer={footer}
        style={{ width: '520px' }}
        modal
        closable={!loading}
      >
        <div className="flex flex-column gap-3 pt-2">
          <div className="field mb-0">
            <label htmlFor="nombre" className="font-semibold block mb-1">
              Nombre <span className="text-red-500">*</span>
            </label>
            <InputText
              id="nombre"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className={`w-full ${errors.nombre ? 'p-invalid' : ''}`}
              placeholder="Nombre"
            />
            {errors.nombre && <small className="p-error">{errors.nombre}</small>}
          </div>

          <div className="field mb-0">
            <label htmlFor="apellido" className="font-semibold block mb-1">
              Apellido <span className="text-red-500">*</span>
            </label>
            <InputText
              id="apellido"
              value={form.apellido}
              onChange={(e) => setForm({ ...form, apellido: e.target.value })}
              className={`w-full ${errors.apellido ? 'p-invalid' : ''}`}
              placeholder="Apellido"
            />
            {errors.apellido && <small className="p-error">{errors.apellido}</small>}
          </div>

          <div className="field mb-0">
            <label htmlFor="empresa" className="font-semibold block mb-1">
              Empresa <span className="text-red-500">*</span>
            </label>
            <Dropdown
              id="empresa"
              value={form.empresaId}
              options={empresas}
              optionLabel="nombre"
              optionValue="id"
              onChange={(e) => setForm({ ...form, empresaId: e.value })}
              className={`w-full ${errors.empresaId ? 'p-invalid' : ''}`}
              placeholder="Seleccionar empresa"
              filter
              filterPlaceholder="Buscar empresa..."
            />
            {errors.empresaId && <small className="p-error">{errors.empresaId}</small>}
          </div>

          <div className="field mb-0">
            <label htmlFor="telefono" className="font-semibold block mb-1">Teléfono</label>
            <InputText
              id="telefono"
              value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              className="w-full"
              placeholder="Teléfono (opcional)"
            />
          </div>

          <div className="field mb-0">
            <label htmlFor="mail" className="font-semibold block mb-1">Email</label>
            <InputText
              id="mail"
              value={form.mail}
              onChange={(e) => setForm({ ...form, mail: e.target.value })}
              className={`w-full ${errors.mail ? 'p-invalid' : ''}`}
              placeholder="correo@ejemplo.com (opcional)"
            />
            {errors.mail && <small className="p-error">{errors.mail}</small>}
          </div>
        </div>
      </Dialog>
    </>
  )
}
