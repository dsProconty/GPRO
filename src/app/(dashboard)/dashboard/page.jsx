'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card } from 'primereact/card'
import { ProgressSpinner } from 'primereact/progressspinner'
import axios from 'axios'
import { formatCurrency } from '@/utils/format'

export default function DashboardPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [kpis, setKpis] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get('/api/v1/dashboard')
      .then((res) => setKpis(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const cards = kpis
    ? [
        {
          label: 'Proyectos Activos',
          icon: 'pi-briefcase',
          color: '#2e75b6',
          value: kpis.proyectosActivos,
          sub: `de ${kpis.totalProyectos} total`,
          onClick: () => router.push('/proyectos'),
        },
        {
          label: 'Facturado Total',
          icon: 'pi-file-edit',
          color: '#1f7a4d',
          value: formatCurrency(kpis.facturadoTotal),
          sub: 'suma de todas las facturas',
        },
        {
          label: 'Cobrado Total',
          icon: 'pi-dollar',
          color: '#c05621',
          value: formatCurrency(kpis.cobradoTotal),
          sub: 'pagos recibidos',
        },
        {
          label: 'Saldo Pendiente',
          icon: 'pi-clock',
          color: kpis.saldoPendiente > 0 ? '#dc2626' : '#1f7a4d',
          value: formatCurrency(kpis.saldoPendiente),
          sub: kpis.saldoPendiente > 0 ? 'por cobrar' : 'al día',
        },
      ]
    : [
        { label: 'Proyectos Activos',  icon: 'pi-briefcase',  color: '#2e75b6', value: '—' },
        { label: 'Facturado Total',    icon: 'pi-file-edit',  color: '#1f7a4d', value: '—' },
        { label: 'Cobrado Total',      icon: 'pi-dollar',     color: '#c05621', value: '—' },
        { label: 'Saldo Pendiente',    icon: 'pi-clock',      color: '#7c3aed', value: '—' },
      ]

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-900 font-bold text-3xl m-0">Dashboard</h1>
        <p className="text-500 mt-1 mb-0">
          Bienvenido, {session?.user?.name}. Resumen general del sistema.
        </p>
      </div>

      <div className="grid">
        {cards.map((card) => (
          <div key={card.label} className="col-12 md:col-6 xl:col-3">
            <Card
              className={`shadow-1 border-round-xl${card.onClick ? ' cursor-pointer' : ''}`}
              onClick={card.onClick}
            >
              <div className="flex align-items-center justify-content-between">
                <div>
                  <div className="text-500 font-medium text-sm mb-1">{card.label}</div>
                  {loading ? (
                    <ProgressSpinner style={{ width: '24px', height: '24px' }} strokeWidth="4" />
                  ) : (
                    <>
                      <div className="text-900 font-bold text-3xl">{card.value}</div>
                      {card.sub && <div className="text-400 text-xs mt-1">{card.sub}</div>}
                    </>
                  )}
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

      <div className="mt-4 grid">
        <div className="col-12 md:col-6">
          <Card
            className="shadow-1 border-round-xl border-left-4 cursor-pointer"
            style={{ borderLeftColor: '#2e75b6' }}
            onClick={() => router.push('/proyectos')}
          >
            <div className="flex align-items-center gap-3">
              <i className="pi pi-briefcase text-2xl" style={{ color: '#2e75b6' }} />
              <div>
                <div className="text-900 font-bold">Ver Proyectos</div>
                <div className="text-500 text-sm">Gestiona el ciclo de vida de cada proyecto</div>
              </div>
              <i className="pi pi-chevron-right ml-auto text-400" />
            </div>
          </Card>
        </div>
        <div className="col-12 md:col-6">
          <Card
            className="shadow-1 border-round-xl border-left-4 cursor-pointer"
            style={{ borderLeftColor: '#1f7a4d' }}
            onClick={() => router.push('/clientes')}
          >
            <div className="flex align-items-center gap-3">
              <i className="pi pi-building text-2xl" style={{ color: '#1f7a4d' }} />
              <div>
                <div className="text-900 font-bold">Ver Clientes</div>
                <div className="text-500 text-sm">Administra empresas y sus contactos</div>
              </div>
              <i className="pi pi-chevron-right ml-auto text-400" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
