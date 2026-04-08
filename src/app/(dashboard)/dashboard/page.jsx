'use client'
// src/app/(dashboard)/dashboard/page.jsx
import { useSession } from 'next-auth/react'
import { Card } from 'primereact/card'

export default function DashboardPage() {
  const { data: session } = useSession()

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-900 font-bold text-3xl m-0">Dashboard</h1>
        <p className="text-500 mt-1 mb-0">
          Bienvenido, {session?.user?.name}. Sistema GPRO listo.
        </p>
      </div>

      {/* Cards de estado del sistema - se poblarán en Sprint 2 */}
      <div className="grid">
        {[
          { label: 'Proyectos Activos',  icon: 'pi-briefcase',  color: '#2e75b6', value: '—' },
          { label: 'Facturado Total',    icon: 'pi-file-edit',  color: '#1f7a4d', value: '—' },
          { label: 'Cobrado Total',      icon: 'pi-dollar',     color: '#c05621', value: '—' },
          { label: 'Saldo Pendiente',    icon: 'pi-clock',      color: '#7c3aed', value: '—' },
        ].map((card) => (
          <div key={card.label} className="col-12 md:col-6 xl:col-3">
            <Card className="shadow-1 border-round-xl">
              <div className="flex align-items-center justify-content-between">
                <div>
                  <div className="text-500 font-medium text-sm mb-1">{card.label}</div>
                  <div className="text-900 font-bold text-3xl">{card.value}</div>
                </div>
                <div
                  className="flex align-items-center justify-content-center border-round-xl"
                  style={{ width: '48px', height: '48px', background: card.color + '20' }}
                >
                  <i className={`pi ${card.icon} text-xl`} style={{ color: card.color }} />
                </div>
              </div>
            </Card>
          </div>
        ))}
      </div>

      {/* Mensaje de sprint */}
      <div className="mt-4">
        <Card className="shadow-1 border-round-xl border-left-4" style={{ borderLeftColor: '#2e75b6' }}>
          <div className="flex align-items-center gap-3">
            <i className="pi pi-check-circle text-2xl" style={{ color: '#1f7a4d' }} />
            <div>
              <div className="text-900 font-bold">Sprint 0 completado</div>
              <div className="text-500 text-sm">
                Infraestructura base lista. Autenticación funcionando. Base de datos conectada.
                El Sprint 1 implementará Empresas y Clientes.
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
