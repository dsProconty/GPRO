'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Button } from 'primereact/button'
import { Card } from 'primereact/card'
import { Tag } from 'primereact/tag'
import { Calendar } from 'primereact/calendar'
import { Dropdown } from 'primereact/dropdown'
import { ProgressBar } from 'primereact/progressbar'
import { ProgressSpinner } from 'primereact/progressspinner'
import { Toast } from 'primereact/toast'
import { Chart } from 'primereact/chart'
import axios from 'axios'
import { formatCurrency, formatDate } from '@/utils/format'
import { usePermisos, PERMISOS } from '@/hooks/usePermisos'

const TIPO_OPTIONS = [
  { label: 'Todos',      value: null },
  { label: 'Proyectos',  value: 'proyecto' },
  { label: 'Propuestas', value: 'propuesta' },
]

function gmColor(pct) {
  if (pct >= 40) return 'text-green-600'
  if (pct >= 20) return 'text-yellow-600'
  return 'text-red-600'
}
function gmSeverity(pct) {
  if (pct >= 40) return 'success'
  if (pct >= 20) return 'warning'
  return 'danger'
}

export default function CasosNegocioPage() {
  const toast   = useRef(null)
  const router  = useRouter()
  const { puede } = usePermisos()

  const [casos,       setCasos]       = useState([])
  const [resumen,     setResumen]     = useState(null)
  const [porPerfil,   setPorPerfil]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [fechaDesde,  setFechaDesde]  = useState(null)
  const [fechaHasta,  setFechaHasta]  = useState(null)
  const [tipoFiltro,  setTipoFiltro]  = useState(null)
  const [expandedRows, setExpandedRows] = useState(null)

  useEffect(() => { loadData() }, [fechaDesde, fechaHasta, tipoFiltro])

  const loadData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (fechaDesde) params.set('from', fechaDesde.toISOString().slice(0, 10))
      if (fechaHasta) params.set('to',   fechaHasta.toISOString().slice(0, 10))
      if (tipoFiltro) params.set('tipo', tipoFiltro)

      const res = await axios.get('/api/v1/casos-negocio?' + params.toString())
      setCasos(res.data.data.casos)
      setResumen(res.data.data.resumenGlobal)
      setPorPerfil(res.data.data.porPerfil)
    } catch {
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los casos de negocio', life: 4000 })
    } finally {
      setLoading(false)
    }
  }

  // Chart: ingresos por perfil (barras horizontales)
  const chartData = useMemo(() => ({
    labels: porPerfil.map((p) => p.perfil),
    datasets: [
      {
        label: 'Ingreso',
        data: porPerfil.map((p) => p.precio),
        backgroundColor: '#3b82f6',
      },
      {
        label: 'Costo',
        data: porPerfil.map((p) => p.costo),
        backgroundColor: '#f59e0b',
      },
    ],
  }), [porPerfil])

  const chartOptions = {
    indexAxis: 'y',
    responsive: true,
    plugins: { legend: { position: 'bottom' } },
    scales: { x: { ticks: { callback: (v) => '$' + v.toLocaleString() } } },
  }

  // Expansión de filas: detalle de líneas
  const rowExpansionTemplate = (caso) => (
    <div className="p-3 surface-50 border-round">
      <p className="font-semibold text-sm mb-2">Detalle por perfil</p>
      <DataTable value={caso.lineas} size="small">
        <Column header="Perfil" body={(l) => `${l.perfil.nombre} ${l.perfil.nivel}`} />
        <Column header="Horas" body={(l) => `${l.horas}h`} style={{ width: '80px' }} />
        <Column header="Costo/h" body={(l) => formatCurrency(l.costoHora)} style={{ width: '100px', textAlign: 'right' }} />
        <Column header="Precio/h" body={(l) => formatCurrency(l.precioHora)} style={{ width: '100px', textAlign: 'right' }} />
        <Column header="Costo Total" body={(l) => formatCurrency(l.costo)} style={{ width: '120px', textAlign: 'right' }} />
        <Column header="Ingreso" body={(l) => formatCurrency(l.precio)} style={{ width: '120px', textAlign: 'right' }} />
        <Column header="GM" body={(l) => (
          <span className={gmColor(l.gmPct || 0)}>{formatCurrency(l.gm)} ({l.gmPct ?? 0}%)</span>
        )} style={{ width: '160px', textAlign: 'right' }} />
      </DataTable>
    </div>
  )

  if (loading && casos.length === 0) {
    return <div className="flex justify-content-center align-items-center" style={{ height: '60vh' }}><ProgressSpinner /></div>
  }

  return (
    <div className="p-4">
      <Toast ref={toast} />

      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold m-0">Casos de Negocio</h1>
        <p className="text-color-secondary text-sm mt-1 mb-0">
          Análisis de rentabilidad por proyecto y propuesta
        </p>
      </div>

      {/* KPI Cards */}
      {resumen && (
        <div className="grid mb-4">
          <div className="col-12 md:col-3">
            <Card className="text-center">
              <div className="text-color-secondary text-sm mb-1">Total Casos</div>
              <div className="text-3xl font-bold text-primary">{resumen.totalCaso}</div>
            </Card>
          </div>
          <div className="col-12 md:col-3">
            <Card className="text-center">
              <div className="text-color-secondary text-sm mb-1">Ingresos Estimados</div>
              <div className="text-2xl font-bold text-blue-600">{formatCurrency(resumen.totalPrecio)}</div>
            </Card>
          </div>
          <div className="col-12 md:col-3">
            <Card className="text-center">
              <div className="text-color-secondary text-sm mb-1">Costos Estimados</div>
              <div className="text-2xl font-bold text-orange-500">{formatCurrency(resumen.totalCosto)}</div>
            </Card>
          </div>
          <div className="col-12 md:col-3">
            <Card className="text-center">
              <div className="text-color-secondary text-sm mb-1">Margen Bruto Global</div>
              <div className={`text-2xl font-bold ${gmColor(resumen.gmPct)}`}>
                {formatCurrency(resumen.gm)} <span className="text-base">({resumen.gmPct}%)</span>
              </div>
              <ProgressBar value={resumen.gmPct} showValue={false} style={{ height: '6px', marginTop: '6px' }}
                color={resumen.gmPct >= 40 ? 'var(--green-500)' : resumen.gmPct >= 20 ? 'var(--yellow-500)' : 'var(--red-500)'}
              />
            </Card>
          </div>
        </div>
      )}

      <div className="grid">
        {/* Tabla principal */}
        <div className="col-12 lg:col-8">
          <Card>
            {/* Filtros */}
            <div className="flex flex-wrap gap-3 mb-3 align-items-end">
              <div className="flex flex-column gap-1">
                <label className="text-xs text-color-secondary">Desde</label>
                <Calendar value={fechaDesde} onChange={(e) => setFechaDesde(e.value)} dateFormat="dd/mm/yy"
                  showButtonBar placeholder="Fecha inicio" style={{ width: '150px' }} />
              </div>
              <div className="flex flex-column gap-1">
                <label className="text-xs text-color-secondary">Hasta</label>
                <Calendar value={fechaHasta} onChange={(e) => setFechaHasta(e.value)} dateFormat="dd/mm/yy"
                  showButtonBar placeholder="Fecha fin" style={{ width: '150px' }} />
              </div>
              <div className="flex flex-column gap-1">
                <label className="text-xs text-color-secondary">Tipo</label>
                <Dropdown value={tipoFiltro} options={TIPO_OPTIONS} optionLabel="label" optionValue="value"
                  onChange={(e) => setTipoFiltro(e.value)} style={{ width: '150px' }} />
              </div>
              <Button icon="pi pi-refresh" severity="secondary" outlined size="small"
                onClick={() => { setFechaDesde(null); setFechaHasta(null); setTipoFiltro(null) }}
                tooltip="Limpiar filtros" tooltipOptions={{ position: 'top' }} />
            </div>

            <DataTable
              value={casos}
              loading={loading}
              expandedRows={expandedRows}
              onRowToggle={(e) => setExpandedRows(e.data)}
              rowExpansionTemplate={rowExpansionTemplate}
              dataKey="id"
              emptyMessage="No hay casos de negocio registrados"
              stripedRows
              paginator rows={15}
            >
              <Column expander style={{ width: '3rem' }} />
              <Column header="Tipo" style={{ width: '100px' }} body={(r) => (
                <Tag value={r.tipo === 'proyecto' ? 'Proyecto' : 'Propuesta'}
                  severity={r.tipo === 'proyecto' ? 'success' : 'info'} />
              )} />
              <Column header="Nombre" body={(r) => (
                <Button label={r.nombre} link className="p-0 text-left text-sm"
                  onClick={() => router.push(`/${r.tipo === 'proyecto' ? 'proyectos' : 'propuestas'}/${r.id}`)} />
              )} style={{ minWidth: '180px' }} />
              <Column header="Empresa" body={(r) => r.empresa?.nombre} />
              <Column header="Estado" body={(r) => (
                <Tag value={r.estado?.nombre} severity={r.estado?.color || 'secondary'} />
              )} style={{ width: '130px' }} />
              <Column header="Fecha" body={(r) => formatDate(r.fecha)} style={{ width: '100px' }} />
              <Column header="Horas" body={(r) => `${r.resumen.totalHoras}h`} style={{ width: '70px', textAlign: 'right' }} />
              <Column header="Ingreso" body={(r) => formatCurrency(r.resumen.totalPrecio)}
                style={{ width: '120px', textAlign: 'right' }} sortable sortField="resumen.totalPrecio" />
              <Column header="GM" style={{ width: '110px', textAlign: 'right' }} body={(r) => (
                <span className={`font-bold ${gmColor(r.resumen.gmPct)}`}>
                  {r.resumen.gmPct}%
                </span>
              )} />
            </DataTable>
          </Card>
        </div>

        {/* Panel lateral: por perfil */}
        <div className="col-12 lg:col-4">
          <Card className="mb-3">
            <h3 className="m-0 mb-3 font-semibold text-sm"><i className="pi pi-chart-bar mr-2" />Ingresos por Perfil</h3>
            {porPerfil.length === 0 ? (
              <p className="text-color-secondary text-sm m-0">Sin datos</p>
            ) : (
              <>
                <Chart type="bar" data={chartData} options={chartOptions} style={{ maxHeight: '280px' }} />
                <div className="mt-3 flex flex-column gap-2">
                  {porPerfil.map((p) => (
                    <div key={p.perfil} className="flex justify-content-between align-items-center text-sm">
                      <span className="text-color-secondary">{p.perfil}</span>
                      <div className="flex align-items-center gap-2">
                        <span className="font-semibold">{formatCurrency(p.precio)}</span>
                        <Tag value={`${p.gmPct}%`} severity={gmSeverity(p.gmPct)} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>

          {/* Totales por perfil */}
          {porPerfil.length > 0 && (
            <Card>
              <h3 className="m-0 mb-3 font-semibold text-sm"><i className="pi pi-users mr-2" />Resumen por Perfil</h3>
              <DataTable value={porPerfil} size="small">
                <Column header="Perfil" field="perfil" />
                <Column header="Horas" body={(r) => `${r.horas}h`} style={{ width: '60px' }} />
                <Column header="GM%" body={(r) => (
                  <Tag value={`${r.gmPct}%`} severity={gmSeverity(r.gmPct)} />
                )} style={{ width: '70px' }} />
              </DataTable>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
