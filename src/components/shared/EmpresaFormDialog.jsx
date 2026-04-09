'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog } from 'primereact/dialog'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { Toast } from 'primereact/toast'
import { Divider } from 'primereact/divider'
import { empresaService } from '@/services/empresaService'
import { clienteService } from '@/services/clienteService'

const EMPTY_CONTACTO = { nombre: '', apellido: '', telefono: '', mail: '' }

export default function EmpresaFormDialog({ visible, onHide, onSave, empresa, labelOverride }) {
  const label = labelOverride || 'Empresa'
  const toast = useRef(null)
  const [form, setForm] = useState({ nombre: '', ciudad: '' })
  const [contactos, setContactos] = useState([])
  const [errors, setErrors] = useState({})
  const [contactoErrors, setContactoErrors] = useState([])
  const [loading, setLoading] = useState(false)

  const isCreating = !empresa

  useEffect(() => {
    if (visible) {
      if (empresa) {
        setForm({ nombre: empresa.nombre || '', ciudad: empresa.ciudad || '' })
        setContactos([])
      } else {
        setForm({ nombre: '', ciudad: '' })
        setContactos([])
      }
      setErrors({})
      setContactoErrors([])
    }
  }, [empresa, visible])

  const addContacto = () => {
    setContactos([...contactos, { ...EMPTY_CONTACTO }])
    setContactoErrors([...contactoErrors, {}])
  }

  const removeContacto = (index) => {
    setContactos(contactos.filter((_, i) => i !== index))
    setContactoErrors(contactoErrors.filter((_, i) => i !== index))
  }

  const updateContacto = (index, field, value) => {
    const updated = [...contactos]
    updated[index] = { ...updated[index], [field]: value }
    setContactos(updated)
  }

  const validate = () => {
    const newErrors = {}
    if (!form.nombre.trim()) newErrors.nombre = 'El nombre es requerido'
    setErrors(newErrors)

    const newContactoErrors = contactos.map((c) => {
      const errs = {}
      if (!c.nombre.trim()) errs.nombre = 'Requerido'
      if (!c.apellido.trim()) errs.apellido = 'Requerido'
      if (c.mail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.mail)) errs.mail = 'Email inválido'
      return errs
    })
    setContactoErrors(newContactoErrors)

    const hasContactoErrors = newContactoErrors.some((e) => Object.keys(e).length > 0)
    return Object.keys(newErrors).length === 0 && !hasContactoErrors
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      if (empresa) {
        await empresaService.update(empresa.id, form)
      } else {
        const res = await empresaService.create(form)
        const empresaId = res.data.id

        for (const contacto of contactos) {
          await clienteService.create({
            ...contacto,
            empresaId,
          })
        }
      }
      onSave()
    } catch (error) {
      const msg = error.response?.data?.message || `Error al guardar el ${label.toLowerCase()}`
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
        header={empresa ? `Editar ${label}` : `Nuevo ${label}`}
        visible={visible}
        onHide={onHide}
        footer={footer}
        style={{ width: isCreating ? '580px' : '420px' }}
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
              placeholder={`Nombre del ${label.toLowerCase()}`}
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

          {/* Sección de contactos solo al crear */}
          {isCreating && (
            <>
              <Divider className="my-2" />
              <div className="flex justify-content-between align-items-center">
                <span className="font-semibold text-sm">
                  <i className="pi pi-users mr-2" />
                  Contactos / PMs
                </span>
                <Button
                  label="Agregar"
                  icon="pi pi-user-plus"
                  size="small"
                  text
                  onClick={addContacto}
                />
              </div>

              {contactos.length === 0 && (
                <p className="text-color-secondary text-sm m-0">
                  Puedes agregar contactos ahora o después desde el detalle del cliente.
                </p>
              )}

              {contactos.map((contacto, idx) => (
                <div key={idx} className="surface-100 border-round p-3">
                  <div className="flex justify-content-between align-items-center mb-2">
                    <span className="text-sm font-semibold text-color-secondary">Contacto {idx + 1}</span>
                    <Button
                      icon="pi pi-times"
                      rounded
                      text
                      severity="danger"
                      size="small"
                      onClick={() => removeContacto(idx)}
                      tooltip="Quitar"
                      tooltipOptions={{ position: 'top' }}
                    />
                  </div>
                  <div className="grid">
                    <div className="col-6">
                      <InputText
                        value={contacto.nombre}
                        onChange={(e) => updateContacto(idx, 'nombre', e.target.value)}
                        className={`w-full ${contactoErrors[idx]?.nombre ? 'p-invalid' : ''}`}
                        placeholder="Nombre *"
                      />
                      {contactoErrors[idx]?.nombre && <small className="p-error">{contactoErrors[idx].nombre}</small>}
                    </div>
                    <div className="col-6">
                      <InputText
                        value={contacto.apellido}
                        onChange={(e) => updateContacto(idx, 'apellido', e.target.value)}
                        className={`w-full ${contactoErrors[idx]?.apellido ? 'p-invalid' : ''}`}
                        placeholder="Apellido *"
                      />
                      {contactoErrors[idx]?.apellido && <small className="p-error">{contactoErrors[idx].apellido}</small>}
                    </div>
                    <div className="col-6">
                      <InputText
                        value={contacto.telefono}
                        onChange={(e) => updateContacto(idx, 'telefono', e.target.value)}
                        className="w-full"
                        placeholder="Teléfono"
                      />
                    </div>
                    <div className="col-6">
                      <InputText
                        value={contacto.mail}
                        onChange={(e) => updateContacto(idx, 'mail', e.target.value)}
                        className={`w-full ${contactoErrors[idx]?.mail ? 'p-invalid' : ''}`}
                        placeholder="Email"
                      />
                      {contactoErrors[idx]?.mail && <small className="p-error">{contactoErrors[idx].mail}</small>}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </Dialog>
    </>
  )
}
