'use client'

import { useEffect, useState } from 'react'
import { Dialog } from 'primereact/dialog'
import { InputText } from 'primereact/inputtext'
import { Dropdown } from 'primereact/dropdown'
import { Button } from 'primereact/button'
import axios from 'axios'

const ROLES = [
  { label: 'Usuario', value: 'user' },
  { label: 'Administrador', value: 'admin' },
]

const EMPTY = { name: '', email: '', password: '', role: 'user', perfilUsuarioId: null }

export default function UsuarioFormDialog({ visible, onHide, onSave, usuario }) {
  const isEdit = !!usuario
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [perfiles, setPerfiles] = useState([])

  // Cargar perfiles de acceso al abrir el dialog
  useEffect(() => {
    if (visible) {
      axios.get('/api/v1/perfiles-usuario')
        .then((res) => setPerfiles(res.data.data || []))
        .catch(() => {})

      setForm(usuario
        ? { name: usuario.name, email: usuario.email, password: '', role: usuario.role, perfilUsuarioId: usuario.perfilUsuarioId ?? null }
        : EMPTY
      )
      setErrors({})
    }
  }, [visible, usuario])

  const set = (field) => (e) => {
    const val = e.target?.value ?? e.value ?? e
    setForm((prev) => ({ ...prev, [field]: val }))
    setErrors((prev) => ({ ...prev, [field]: null }))
  }

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'El nombre es requerido'
    if (!form.email.trim()) errs.email = 'El email es requerido'
    if (!isEdit && (!form.password || form.password.length < 6)) errs.password = 'Mínimo 6 caracteres'
    if (isEdit && form.password && form.password.length < 6) errs.password = 'Mínimo 6 caracteres'
    return errs
  }

  const handleSubmit = async () => {
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        perfilUsuarioId: form.role === 'admin' ? null : (form.perfilUsuarioId ?? null),
      }
      if (form.password) payload.password = form.password
      if (isEdit) {
        await axios.put(`/api/v1/usuarios/${usuario.id}`, payload)
      } else {
        await axios.post('/api/v1/usuarios', payload)
      }
      onSave()
    } catch (err) {
      const apiErrors = err.response?.data?.errors || {}
      const msg = err.response?.data?.message || 'Error al guardar'
      const mapped = {}
      if (apiErrors.name) mapped.name = apiErrors.name[0]
      if (apiErrors.email) mapped.email = apiErrors.email[0]
      if (apiErrors.password) mapped.password = apiErrors.password[0]
      if (Object.keys(mapped).length > 0) {
        setErrors(mapped)
      } else {
        setErrors({ _global: msg })
      }
    } finally {
      setSaving(false)
    }
  }

  const perfilOptions = [
    { label: '— Sin perfil (sin acceso) —', value: null },
    ...perfiles.map((p) => ({ label: p.nombre, value: p.id })),
  ]

  const footer = (
    <div className="flex justify-content-end gap-2">
      <Button label="Cancelar" icon="pi pi-times" severity="secondary" outlined onClick={onHide} disabled={saving} />
      <Button label={isEdit ? 'Guardar cambios' : 'Crear usuario'} icon="pi pi-check" onClick={handleSubmit} loading={saving} />
    </div>
  )

  return (
    <Dialog
      visible={visible}
      onHide={onHide}
      header={isEdit ? 'Editar Usuario' : 'Nuevo Usuario'}
      style={{ width: '440px' }}
      footer={footer}
      modal
    >
      <div className="flex flex-column gap-3 mt-2">
        {errors._global && (
          <div className="p-2 bg-red-50 border-round text-red-600 text-sm">{errors._global}</div>
        )}
        <div className="flex flex-column gap-1">
          <label className="text-sm font-medium">Nombre <span className="text-red-500">*</span></label>
          <InputText value={form.name} onChange={set('name')} placeholder="Nombre completo" className={errors.name ? 'p-invalid' : ''} />
          {errors.name && <small className="text-red-500">{errors.name}</small>}
        </div>
        <div className="flex flex-column gap-1">
          <label className="text-sm font-medium">Email <span className="text-red-500">*</span></label>
          <InputText value={form.email} onChange={set('email')} placeholder="usuario@proconty.com" type="email" className={errors.email ? 'p-invalid' : ''} />
          {errors.email && <small className="text-red-500">{errors.email}</small>}
        </div>
        <div className="flex flex-column gap-1">
          <label className="text-sm font-medium">
            Contraseña {isEdit && <span className="text-color-secondary text-xs">(dejar vacío para no cambiar)</span>}
            {!isEdit && <span className="text-red-500">*</span>}
          </label>
          <InputText value={form.password} onChange={set('password')} type="password" placeholder="Mínimo 6 caracteres" className={errors.password ? 'p-invalid' : ''} />
          {errors.password && <small className="text-red-500">{errors.password}</small>}
        </div>
        <div className="flex flex-column gap-1">
          <label className="text-sm font-medium">Rol</label>
          <Dropdown value={form.role} options={ROLES} onChange={set('role')} optionLabel="label" optionValue="value" />
        </div>
        {form.role !== 'admin' && (
          <div className="flex flex-column gap-1">
            <label className="text-sm font-medium">Perfil de acceso</label>
            <Dropdown
              value={form.perfilUsuarioId}
              options={perfilOptions}
              onChange={set('perfilUsuarioId')}
              optionLabel="label"
              optionValue="value"
              placeholder="Sin perfil"
            />
            <small className="text-color-secondary">Determina los permisos del usuario. Aplica al próximo inicio de sesión.</small>
          </div>
        )}
      </div>
    </Dialog>
  )
}
