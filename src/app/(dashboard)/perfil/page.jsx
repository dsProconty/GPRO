'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card } from 'primereact/card'
import { InputText } from 'primereact/inputtext'
import { Button } from 'primereact/button'
import { Toast } from 'primereact/toast'
import axios from 'axios'

export default function PerfilPage() {
  const { data: session, update: updateSession } = useSession()
  const toast = useRef(null)

  // Datos personales
  const [name, setName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameError, setNameError] = useState('')

  // Cambio de contraseña
  const [pwdForm, setPwdForm] = useState({ passwordActual: '', passwordNueva: '', passwordConfirmar: '' })
  const [pwdErrors, setPwdErrors] = useState({})
  const [savingPwd, setSavingPwd] = useState(false)

  useEffect(() => {
    if (session?.user?.name) setName(session.user.name)
  }, [session])

  const handleSaveName = async () => {
    if (!name.trim()) { setNameError('El nombre es requerido'); return }
    setNameError('')
    setSavingName(true)
    try {
      await axios.put('/api/v1/usuarios/perfil', { name })
      await updateSession({ name })
      toast.current.show({ severity: 'success', summary: 'Éxito', detail: 'Nombre actualizado', life: 3000 })
    } catch (err) {
      toast.current.show({ severity: 'error', summary: 'Error', detail: err.response?.data?.message || 'Error al guardar', life: 4000 })
    } finally {
      setSavingName(false)
    }
  }

  const setPwd = (field) => (e) => {
    setPwdForm((prev) => ({ ...prev, [field]: e.target.value }))
    setPwdErrors((prev) => ({ ...prev, [field]: null }))
  }

  const handleSavePassword = async () => {
    const errs = {}
    if (!pwdForm.passwordActual) errs.passwordActual = 'La contraseña actual es requerida'
    if (!pwdForm.passwordNueva || pwdForm.passwordNueva.length < 8) errs.passwordNueva = 'Mínimo 8 caracteres'
    if (pwdForm.passwordNueva !== pwdForm.passwordConfirmar) errs.passwordConfirmar = 'Las contraseñas no coinciden'
    if (Object.keys(errs).length > 0) { setPwdErrors(errs); return }

    setSavingPwd(true)
    try {
      await axios.patch('/api/v1/usuarios/perfil', pwdForm)
      setPwdForm({ passwordActual: '', passwordNueva: '', passwordConfirmar: '' })
      setPwdErrors({})
      toast.current.show({ severity: 'success', summary: 'Éxito', detail: 'Contraseña actualizada', life: 3000 })
    } catch (err) {
      const apiErrors = err.response?.data?.errors || {}
      const mapped = {}
      Object.keys(apiErrors).forEach((k) => { mapped[k] = apiErrors[k][0] })
      if (Object.keys(mapped).length > 0) {
        setPwdErrors(mapped)
      } else {
        toast.current.show({ severity: 'error', summary: 'Error', detail: err.response?.data?.message || 'Error al cambiar contraseña', life: 4000 })
      }
    } finally {
      setSavingPwd(false)
    }
  }

  return (
    <div className="p-4" style={{ maxWidth: '600px' }}>
      <Toast ref={toast} />

      <div className="mb-4">
        <h1 className="text-2xl font-bold m-0">Mi Perfil</h1>
        <p className="text-color-secondary text-sm mt-1 mb-0">Actualiza tus datos personales y contraseña</p>
      </div>

      {/* Datos personales */}
      <Card className="mb-4">
        <h3 className="m-0 mb-3 font-semibold"><i className="pi pi-user mr-2" />Datos personales</h3>
        <div className="flex flex-column gap-3">
          <div className="flex flex-column gap-1">
            <label className="text-sm font-medium">Email</label>
            <InputText value={session?.user?.email || ''} disabled className="surface-100" />
            <small className="text-color-secondary">El email no se puede modificar</small>
          </div>
          <div className="flex flex-column gap-1">
            <label className="text-sm font-medium">Nombre <span className="text-red-500">*</span></label>
            <InputText value={name} onChange={(e) => { setName(e.target.value); setNameError('') }} placeholder="Tu nombre completo" className={nameError ? 'p-invalid' : ''} />
            {nameError && <small className="text-red-500">{nameError}</small>}
          </div>
          <div>
            <Button label="Guardar nombre" icon="pi pi-check" onClick={handleSaveName} loading={savingName} />
          </div>
        </div>
      </Card>

      {/* Cambio de contraseña */}
      <Card>
        <h3 className="m-0 mb-3 font-semibold"><i className="pi pi-lock mr-2" />Cambiar contraseña</h3>
        <div className="flex flex-column gap-3">
          <div className="flex flex-column gap-1">
            <label className="text-sm font-medium">Contraseña actual <span className="text-red-500">*</span></label>
            <InputText value={pwdForm.passwordActual} onChange={setPwd('passwordActual')} type="password" placeholder="••••••••" className={pwdErrors.passwordActual ? 'p-invalid' : ''} />
            {pwdErrors.passwordActual && <small className="text-red-500">{pwdErrors.passwordActual}</small>}
          </div>
          <div className="flex flex-column gap-1">
            <label className="text-sm font-medium">Nueva contraseña <span className="text-red-500">*</span></label>
            <InputText value={pwdForm.passwordNueva} onChange={setPwd('passwordNueva')} type="password" placeholder="Mínimo 8 caracteres" className={pwdErrors.passwordNueva ? 'p-invalid' : ''} />
            {pwdErrors.passwordNueva && <small className="text-red-500">{pwdErrors.passwordNueva}</small>}
          </div>
          <div className="flex flex-column gap-1">
            <label className="text-sm font-medium">Confirmar nueva contraseña <span className="text-red-500">*</span></label>
            <InputText value={pwdForm.passwordConfirmar} onChange={setPwd('passwordConfirmar')} type="password" placeholder="Repite la nueva contraseña" className={pwdErrors.passwordConfirmar ? 'p-invalid' : ''} />
            {pwdErrors.passwordConfirmar && <small className="text-red-500">{pwdErrors.passwordConfirmar}</small>}
          </div>
          <div>
            <Button label="Cambiar contraseña" icon="pi pi-lock" severity="warning" onClick={handleSavePassword} loading={savingPwd} />
          </div>
        </div>
      </Card>
    </div>
  )
}
