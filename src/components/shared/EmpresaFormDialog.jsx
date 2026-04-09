'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog } from 'primereact/dialog'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { Toast } from 'primereact/toast'
import { empresaService } from '@/services/empresaService'

export default function EmpresaFormDialog({ visible, onHide, onSave, empresa }) {
  const toast = useRef(null)
  const [form, setForm] = useState({ nombre: '', ciudad: '' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (visible) {
      if (empresa) {
        setForm({ nombre: empresa.nombre || '', ciudad: empresa.ciudad || '' })
      } else {
        setForm({ nombre: '', ciudad: '' })
      }
      setErrors({})
    }
  }, [empresa, visible])

  const validate = () => {
    const newErrors = {}
    if (!form.nombre.trim()) newErrors.nombre = 'El nombre es requerido'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      if (empresa) {
        await empresaService.update(empresa.id, form)
      } else {
        await empresaService.create(form)
      }
      onSave()
    } catch (error) {
      const msg = error.response?.data?.message || 'Error al guardar la empresa'
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
        header={empresa ? 'Editar Empresa' : 'Nueva Empresa'}
        visible={visible}
        onHide={onHide}
        footer={footer}
        style={{ width: '420px' }}
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
              placeholder="Nombre de la empresa"
            />
            {errors.nombre && <small className="p-error">{errors.nombre}</small>}
          </div>

          <div className="field mb-0">
            <label htmlFor="ciudad" className="font-semibold block mb-1">Ciudad</label>
            <InputText
              id="ciudad"
              value={form.ciudad}
              onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
              className="w-full"
              placeholder="Ciudad (opcional)"
            />
          </div>
        </div>
      </Dialog>
    </>
  )
}
