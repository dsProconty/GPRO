'use client'
// src/app/(auth)/login/page.jsx
// ─────────────────────────────────────────────────────────────────────────────
// SP0-04: Autenticación - Login
// Pantalla de login estilo Sakai PrimeReact
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { InputText } from 'primereact/inputtext'
import { Password } from 'primereact/password'
import { Button } from 'primereact/button'
import { Toast } from 'primereact/toast'
import { classNames } from 'primereact/utils'

export default function LoginPage() {
  const router = useRouter()
  const toast  = useRef(null)

  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [loading,   setLoading]   = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setSubmitted(true)

    if (!email || !password) return

    setLoading(true)

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      toast.current.show({
        severity: 'error',
        summary:  'Error de autenticación',
        detail:   'Email o contraseña incorrectos',
        life:     4000,
      })
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div
      className="flex align-items-center justify-content-center min-h-screen"
      style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2e75b6 100%)' }}
    >
      <Toast ref={toast} />

      <div className="surface-card p-5 shadow-4 border-round-xl" style={{ width: '100%', maxWidth: '420px' }}>

        {/* Logo / Header */}
        <div className="text-center mb-5">
          <div
            className="flex align-items-center justify-content-center border-round mx-auto mb-3"
            style={{ width: '64px', height: '64px', background: 'linear-gradient(135deg, #1e3a5f 0%, #2e75b6 100%)' }}
          >
            <i className="pi pi-briefcase text-white text-3xl" />
          </div>
          <div className="text-900 text-3xl font-bold mb-1">GPRO</div>
          <div className="text-500 font-medium">Gestor de Proyectos · Proconty</div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleLogin} className="flex flex-column gap-3">

          {/* Email */}
          <div className="flex flex-column gap-2">
            <label htmlFor="email" className="text-900 font-semibold">
              Correo electrónico
            </label>
            <span className="p-input-icon-left w-full">
              <i className="pi pi-envelope" />
              <InputText
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@proconty.com"
                className={classNames('w-full', { 'p-invalid': submitted && !email })}
                autoComplete="email"
              />
            </span>
            {submitted && !email && (
              <small className="p-error">El email es requerido</small>
            )}
          </div>

          {/* Password */}
          <div className="flex flex-column gap-2">
            <label htmlFor="password" className="text-900 font-semibold">
              Contraseña
            </label>
            <Password
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              feedback={false}
              toggleMask
              className={classNames('w-full', { 'p-invalid': submitted && !password })}
              inputClassName="w-full"
              autoComplete="current-password"
            />
            {submitted && !password && (
              <small className="p-error">La contraseña es requerida</small>
            )}
          </div>

          {/* Botón */}
          <Button
            type="submit"
            label={loading ? 'Ingresando...' : 'Ingresar'}
            icon={loading ? 'pi pi-spinner pi-spin' : 'pi pi-sign-in'}
            loading={loading}
            className="w-full mt-2"
            style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2e75b6 100%)', border: 'none' }}
          />

        </form>

        {/* Footer */}
        <div className="text-center mt-4">
          <span className="text-400 text-sm">v1.0.0 · Proconty {new Date().getFullYear()}</span>
        </div>
      </div>
    </div>
  )
}
