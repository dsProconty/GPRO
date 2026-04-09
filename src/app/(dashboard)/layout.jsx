'use client'
// src/app/(dashboard)/layout.jsx
import { useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Button } from 'primereact/button'
import { Ripple } from 'primereact/ripple'
import { classNames } from 'primereact/utils'

const menuItems = [
  {
    label: 'Principal',
    items: [
      { label: 'Dashboard', icon: 'pi pi-home',      path: '/dashboard' },
      { label: 'Proyectos', icon: 'pi pi-briefcase', path: '/proyectos' },
    ],
  },
  {
    label: 'Configuración',
    items: [
      { label: 'Clientes', icon: 'pi pi-building', path: '/clientes' },
    ],
  },
]

export default function DashboardLayout({ children }) {
  const { data: session, status } = useSession()
  const router   = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="flex align-items-center justify-content-center min-h-screen">
        <i className="pi pi-spinner pi-spin text-4xl text-primary" />
      </div>
    )
  }

  if (!session) return null

  return (
    <div className="flex min-h-screen surface-ground">
      <aside
        className="flex flex-column surface-card shadow-2"
        style={{
          width: sidebarOpen ? '260px' : '0px',
          minWidth: sidebarOpen ? '260px' : '0px',
          overflow: 'hidden',
          transition: 'width 0.3s, min-width 0.3s',
          borderRight: '1px solid var(--surface-border)',
        }}
      >
        <div className="flex align-items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--surface-border)', minHeight: '64px' }}>
          <div className="flex align-items-center justify-content-center border-round flex-shrink-0" style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #1e3a5f, #2e75b6)' }}>
            <i className="pi pi-briefcase text-white text-sm" />
          </div>
          <div>
            <div className="text-900 font-bold text-lg">GPRO</div>
            <div className="text-400 text-xs">Gestor de Proyectos</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          {menuItems.map((section) => (
            <div key={section.label} className="mb-3">
              <span className="text-400 text-xs font-bold uppercase px-3 py-1 block mb-1">{section.label}</span>
              <ul className="list-none m-0 p-0 flex flex-column gap-1">
                {section.items.map((item) => {
                  const active = pathname === item.path || pathname.startsWith(item.path + '/')
                  return (
                    <li key={item.path}>
                      <Link href={item.path} style={{ textDecoration: 'none' }}>
                        <div className={classNames('p-ripple flex align-items-center gap-2 px-3 py-2 border-round cursor-pointer', active ? 'bg-primary text-white' : 'text-700 hover:surface-200')}>
                          <i className={classNames(item.icon, 'text-base')} />
                          <span className="font-medium text-sm">{item.label}</span>
                          <Ripple />
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="p-3" style={{ borderTop: '1px solid var(--surface-border)' }}>
          <div className="flex align-items-center gap-2 px-3 py-2 border-round surface-100">
            <div className="flex align-items-center justify-content-center border-round-full flex-shrink-0 text-white text-sm font-bold" style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #1e3a5f, #2e75b6)' }}>
              {session.user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-900 text-sm font-semibold">{session.user?.name}</div>
              <div className="text-400 text-xs">{session.user?.email}</div>
            </div>
            <Button icon="pi pi-sign-out" rounded text severity="secondary" size="small" onClick={() => signOut({ callbackUrl: '/login' })} />
          </div>
        </div>
      </aside>
      <div className="flex flex-column flex-1" style={{ overflow: 'hidden' }}>
        <header className="flex align-items-center gap-3 px-4 surface-card shadow-1" style={{ height: '64px', borderBottom: '1px solid var(--surface-border)', flexShrink: 0 }}>
          <Button icon="pi pi-bars" rounded text severity="secondary" onClick={() => setSidebarOpen(!sidebarOpen)} />
          <span className="text-900 font-semibold">GPRO · Proconty</span>
          <div className="flex-1" />
          <span className="text-400 text-sm">{new Date().toLocaleDateString('es-EC', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </header>
        <main className="flex-1 overflow-y-auto p-4">{children}</main>
      </div>
    </div>
  )
}
