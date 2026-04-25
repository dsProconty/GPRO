'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card } from 'primereact/card'
import { Chart } from 'primereact/chart'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Tag } from 'primereact/tag'
import { ProgressSpinner } from 'primereact/progressspinner'
import axios from 'axios'
import { formatCurrency, formatDate } from '@/utils/format'

const ESTADO_COLORS = {
  Prefactibilidad:       '#f59e0b',
  Elaboracion_Propuesta: '#3b82f6',
  Adjudicado:            '#22c55e',
  Rechazado:             '#ef4444',
  Cerrado:               '#6b7280',
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [kpis, setKpis] = useState(null)
  const [alertas, setAlertas] = useState([])
  const [loadingKpis, setLoadingKpis] = useState(true)
  const [loadingAlertas, setLoadingAlertas] = useState(true)

  useEffect(() => {
    axios.get('/api/v1/dashboard')
      .then((res) => setKpis(res.data.data))
      .catch(() => {})
      .finally(() => setLoadingKpis(false))

    axios.get('/api/v1/dashboard/alertas?dias=30')
      .then((res) => setAlertas(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoadingAlertas(false))
  }, [])

  // ── Datos gráfica de líneas ─────────────────────────────────────
  const lineData = kpis?.porMes ? {
    labels: kpis.porMes.map((m) => m.mes),
    datasets: [
      {
        label: 'Facturado',
        data: kpis.porMes.map((m) => m.facturado),
        fill: true,
        backgroundColor: 'rgba(46,117,182,0.08)',
        borderColor: '#2e75b6',
        tension: 0.4,
        pointRadius: 3,
      },
      {
        label: 'Cobrado',
        data: kpis.porMes.map((m) => m.cobrado),
        fill: true,
        backgroundColor: 'rgba(34,197,94,0.08)',
        borderColor: '#22c55e',
        tension: 0.4,
        pointRadius: 3,
      },
    ],
  } : null

  const lineOptions = {
    responsive: true,
    plugins: { legend: { position: 'top' } },
    scales: {
      y: { ticks: { callback: (v) => '$' + v.toLocaleString('es-EC') } },
    },
  }

  // ── Datos gráfica donut ─────────────────────────────────────────
  const donutData = kpis?.porEstado?.length ? {
    labels: kpis.porEstado.map((e) => e.nombre.replace('_', ' ')),
    datasets: [{
      data: kpis.porEstado.map((e) => e.total),
      backgroundColor: kpis.porEstado.map((e) => ESTADO_COLORS[e.nombre] || '#6b7280'),
      borderWidth: 2,
    }],
  } : null

  const donutOptions = {
    responsive: true,
    plugins: { legend: { position: 'right' } },
  }

  // ── Datos gráfica barras ────────────────────────────────────────
  const barData = kpis?.topClientes?.length ? {
    labels: kpis.topClientes.map((c) => c.nombre),
    datasets: [{
      label: 'Total facturado',
      data: kpis.topClientes.map((c) => c.total),
      backgroundColor: '#2e75b680',
      borderColor: '#2e75b6',
      borderWidth: 1,
    }],
  } : null

  const barOptions = {
    indexAxis: 'y',
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { callback: (v) => '$' + v.toLocaleString('es-EC') } },
    },
  }

  const kpiCards = [
    {
      label: 'Proyectos Activos',
      icon: 'pi-briefcase',
      color: '#2e75b6',
      value: kpis ? kpis.proyectosActivos : '—',
      sub: kpis ? `de ${kpis.totalProyectos} total` : '',
      onClick: () => router.push('/proyectos'),
    },
    {
      label: 'Facturado Total',
      icon: 'pi-file-edit',
      color: '#1f7a4d',
      value: kpis ? formatCurrency(kpis.facturadoTotal) : '—',
      sub: 'suma de todas las facturas',
    },
    {
      label: 'Cobrado Total',
      icon: 'pi-dollar',
      color: '#c05621',
      value: kpis ? formatCurrency(kpis.cobradoTotal) : '—',
      sub: 'pagos recibidos',
    },
    {
      label: 'Saldo Pendiente',
      icon: 'pi-clock',
      color: kpis?.saldoPendiente > 0 ? '#dc2626' : '#1f7a4d',
      value: kpis ? formatCurrency(kpis.saldoPendiente) : '—',
      sub: kpis?.saldoPendiente > 0 ? 'por cobrar' : 'al día',
    },
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-900 font-bold text-3xl m-0">Dashboard</h1>
        <p className="text-500 mt-1 mb-0">
          Bienvenido, {session?.user?.name}. Resumen general del sistema.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid mb-4">
        {kpiCards.map((card) => (
          <div key={card.label} className="col-12 md:col-6 xl:col-3">
            <Card
              className={`shadow-1 border-round-xl${card.onClick ? ' cursor-pointer' : ''}`}
              onClick={card.onClick}
            >
              <div className="flex align-items-center justify-content-between">
                <div>
                  <div className="text-500 font-medium text-sm mb-1">{card.label}</div>
                  {loadingKpis
                    ? <ProgressSpinner style={{ width: '24px', height: '24px' }} strokeWidth="4" />
                    : <>
                        <div className="text-900 font-bold text-3xl">{card.value}</div>
                        {card.sub && <div className="text-400 text-xs mt-1">{card.sub}</div>}
                      </>
                  }
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

      {/* Gráficas */}
      {loadingKpis ? (
        <div className="flex justify-content-center align-items-center" style={{ height: '200px' }}>
          <ProgressSpinner />
        </div>
      ) : (
        <div className="grid mb-4">
          {/* Líneas: Facturación vs Cobro */}
          <div className="col-12 lg:col-8">
            <Card title="Facturación vs Cobro — últimos 12 meses" className="shadow-1 h-full">
              {lineData ? (
                <Chart type="line" data={lineData} options={lineOptions} style={{ height: '260px' }} />
              ) : (
                <p className="text-color-secondary text-sm m-0">Sin datos de facturación aún.</p>
              )}
            </Card>
          </div>

          {/* Donut: Proyectos por Estado */}
          <div className="col-12 lg:col-4">
            <Card title="Proyectos por Estado" className="shadow-1 h-full">
              {donutData ? (
                <Chart type="doughnut" data={donutData} options={donutOptions} style={{ height: '260px' }} />
              ) : (
                <p className="text-color-secondary text-sm m-0">Sin proyectos registrados.</p>
              )}
            </Card>
          </div>

          {/* Barras: Top 5 Clientes */}
          <div className="col-12">
            <Card title="Top 5 Clientes por Facturación" className="shadow-1">
              {barData ? (
                <Chart type="bar" data={barData} options={barOptions} style={{ height: '200px' }} />
              ) : (
                <p className="text-color-secondary text-sm m-0">Sin datos de clientes aún.</p>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Alertas de Cobranza */}
      <Card className="shadow-1 mb-4">
        <div className="flex align-items-center gap-2 mb-3">
          <i className="pi pi-exclamation-triangle text-xl text-orange-500" />
          <h3 className="m-0 font-semibold">Alertas de Cobranza</h3>
          <span className="text-color-secondary text-sm ml-1">(facturas con saldo pendiente &gt; 30 días)</span>
        </div>

        {loadingAlertas ? (
          <div className="flex justify-content-center p-3">
            <ProgressSpinner style={{ width: '30px', height: '30px' }} />
          </div>
        ) : alertas.length === 0 ? (
          <div className="flex align-items-center gap-2 p-3 surface-50 border-round">
            <i className="pi pi-check-circle text-green-500 text-xl" />
            <span className="text-green-700 font-semibold">Sin facturas vencidas — cobranza al día</span>
          </div>
        ) : (
          <DataTable value={alertas} size="small" stripedRows>
            <Column header="Proyecto" body={(r) => (
              <span
                className="text-primary cursor-pointer font-medium"
                onClick={() => router.push(`/proyectos/${r.proyecto.id}`)}
              >
                {r.proyecto.detalle}
              </span>
            )} />
            <Column header="Cliente" body={(r) => r.proyecto.empresa?.nombre} />
            <Column field="numFactura" header="Nº Factura" />
            <Column header="Fecha" body={(r) => formatDate(r.fechaFactura)} style={{ width: '110px' }} />
            <Column header="Valor" body={(r) => formatCurrency(r.valor)} style={{ textAlign: 'right', width: '110px' }} />
            <Column header="Saldo" style={{ textAlign: 'right', width: '110px' }} body={(r) => (
              <span className="text-red-600 font-semibold">{formatCurrency(r.saldo)}</span>
            )} />
            <Column header="Días de mora" style={{ width: '110px', textAlign: 'center' }} body={(r) => (
              <Tag
                value={`${r.diasMora} días`}
                severity={r.diasMora > 90 ? 'danger' : r.diasMora > 60 ? 'warning' : 'info'}
              />
            )} />
          </DataTable>
        )}
      </Card>

      {/* Accesos rápidos */}
      <div className="grid">
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
