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

function calcPorPerfil(lista) {
  const map = {}
  lista.forEach((caso) => {
    caso.lineas.forEach((l) => {
      const key = `${l.perfil.nombre} ${l.perfil.nivel}`
      if (!map[key]) map[key] = { perfil: key, horas: 0, costo: 0, precio: 0 }
      map[key].horas  += Number(l.horas)
      map[key].costo  += Number(l.costo)
      map[key].precio += Number(l.precio)
    })
  })
  return Object.values(map)
    .map((p) => ({
      ...p,
      gm:    p.precio - p.costo,
      gmPct: p.precio > 0 ? Math.round(((p.precio - p.costo) / p.precio) * 100) : 0,
    }))
    .sort((a, b) => b.precio - a.precio)
}

export default function CasosNegocioPage() {
  const toast  = useRef(null)
  const router = useRouter()
  const { puede } = usePermisos()

  const [casos,        setCasos]        = useState([])
  const [loading,      setLoading]      = useState(true)
  const [fechaDesde,   setFechaDesde]   = useState(null)
  const [fechaHasta,   setFechaHasta]   = useState(null)
  const [tipoFiltro,   setTipoFiltro]   = useState(null)
  const [expandedRows, setExpandedRows] = useState(null)
  const [selectedRows, setSelectedRows] = useState([])   // rows selected in table

  useEffect(() => { loadData() }, [fechaDesde, fechaHasta, tipoFiltro])

  const loadData = async () => {
    setLoading(true)
    setSelectedRows([])  // clear selection on reload
    try {
      const params = new URLSearchParams()
      if (fechaDesde) params.set('from', fechaDesde.toISOString().slice(0, 10))
      if (fechaHasta) params.set('to',   fechaHasta.toISOString().slice(0, 10))
      if (tipoFiltro) params.set('tipo', tipoFiltro)

      const res = await axios.get('/api/v1/casos-negocio?' + params.toString())
      setCasos(res.data.data.casos)
    } catch {
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los casos de negocio', life: 4000 })
    } finally {
      setLoading(false)
    }
  }

  // Source for KPIs and charts: selected rows or all rows
  const fuente = selectedRows.length > 0 ? selectedRows : casos

  // KPIs computed from fuente
  const kpi = useMemo(() => {
    const totalCaso   = fuente.length
    const totalHoras  = fuente.reduce((s, c) => s + c.resumen.totalHoras,  0)
    const totalCosto  = fuente.reduce((s, c) => s + c.resumen.totalCosto,  0)
    const totalPrecio = fuente.reduce((s, c) => s + c.resumen.totalPrecio, 0)
    const gm          = totalPrecio - totalCosto
    const gmPct       = totalPrecio > 0 ? Math.round((gm / totalPrecio) * 100) : 0
    return { totalCaso, totalHoras, totalCosto, totalPrecio, gm, gmPct }
  }, [fuente])

  // Breakdown por perfil computed from fuente
  const porPerfil = useMemo(() => calcPorPerfil(fuente), [fuente])

  // Chart data
  const chartData = useMemo(() => ({
    labels: porPerfil.map((p) => p.perfil),
    datasets: [
      { label: 'Ingreso', data: porPerfil.map((p) => p.precio), backgroundColor: '#3b82f6' },
      { label: 'Costo',   data: porPerfil.map((p) => p.costo),  backgroundColor: '#f59e0b' },
    ],
  }), [porPerfil])

  const chartOptions = useMemo(() => ({
    indexAxis: 'y',
    responsive: true,
    plugins: { legend: { position: 'bottom' } },
    scales: { x: { ticks: { callback: (v) => '$' + v.toLocaleString() } } },
  }), [])

  // Row expansion: detail by profile
  const rowExpansionTemplate = (caso) => (
    <div className="p-3 surface-50 border-round">
      <p className="font-semibold text-sm mb-2">Detalle por perfil</p>
      <DataTable value={caso.lineas} size="small">
        <Column header="Perfil"      body={(l) => `${l.perfil.nombre} ${l.perfil.nivel}`} />
        <Column header="Horas"       body={(l) => `${l.horas}h`}                       style={{ width: '80px' }} />
        <Column header="Costo/h"     body={(l) => formatCurrency(l.costoHora)}          style={{ width: '110px', textAlign: 'right' }} />
        <Column header="Precio/h"    body={(l) => formatCurrency(l.precioHora)}         style={{ width: '110px', textAlign: 'right' }} />
        <Column header="Costo Total" body={(l) => formatCurrency(l.costo)}              style={{ width: '120px', textAlign: 'right' }} />
        <Column header="Ingreso"     body={(l) => formatCurrency(l.precio)}             style={{ width: '120px', textAlign: 'right' }} />
        <Column header="GM"          style={{ width: '160px', textAlign: 'right' }}
          body={(l) => (
            <span className={gmColor(l.gmPct || 0)}>
              {formatCurrency(l.gm)} ({l.gmPct ?? 0}%)
            </span>
          )}
        />
      </DataTable>
    </div>
  )

  if (loading && casos.length === 0) {
    return (
      <div className="flex justify-content-center align-items-center" style={{ height: '60vh' }}>
        <ProgressSpinner />
      </div>
    )
  }

  const haySeleccion = selectedRows.length > 0

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

      {/* ── Tabla (primero) ───────────────────────────────────────────────── */}
      <Card className="mb-4">
        {/* Filtros + indicador de selección */}
        <div className="flex flex-wrap gap-3 mb-3 align-items-end justify-content-between">
          <div className="flex flex-wrap gap-3 align-items-end">
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

          {/* Indicador de selección */}
          {haySeleccion ? (
            <div className="flex align-items-center gap-2">
              <Tag value={`${selectedRows.length} de ${casos.length} seleccionados`} severity="info" />
              <Button label="Limpiar selección" icon="pi pi-times" size="small" text severity="secondary"
                onClick={() => setSelectedRows([])} />
            </div>
          ) : (
            <span className="text-xs text-color-secondary">
              <i className="pi pi-info-circle mr-1" />
              Selecciona filas para filtrar los KPIs y gráficas
            </span>
          )}
        </div>

        <DataTable
          value={casos}
          loading={loading}
          selection={selectedRows}
          onSelectionChange={(e) => setSelectedRows(e.value)}
          selectionMode="multiple"
          expandedRows={expandedRows}
          onRowToggle={(e) => setExpandedRows(e.data)}
          rowExpansionTemplate={rowExpansionTemplate}
          dataKey="id"
          emptyMessage="No hay casos de negocio registrados"
          stripedRows
          paginator
          rows={15}
          rowClassName={(row) => selectedRows.some((r) => r.id === row.id && r.tipo === row.tipo) ? 'bg-blue-50' : ''}
        >
          <Column selectionMode="multiple" style={{ width: '3rem' }} />
          <Column expander style={{ width: '3rem' }} />
          <Column header="Tipo" style={{ width: '110px' }} body={(r) => (
            <Tag value={r.tipo === 'proyecto' ? 'Proyecto' : 'Propuesta'}
              severity={r.tipo === 'proyecto' ? 'success' : 'info'} />
          )} />
          <Column header="Nombre" body={(r) => (
            <Button label={r.nombre} link className="p-0 text-left text-sm"
              onClick={() => router.push(`/${r.tipo === 'proyecto' ? 'proyectos' : 'propuestas'}/${r.id}`)} />
          )} style={{ minWidth: '180px' }} />
          <Column header="Empresa" body={(r) => r.empresa?.nombre} />
          <Column header="Estado" style={{ width: '130px' }} body={(r) => (
            <Tag value={r.estado?.nombre} severity={r.estado?.color || 'secondary'} />
          )} />
          <Column header="Fecha" body={(r) => formatDate(r.fecha)} style={{ width: '100px' }} />
          <Column header="Horas" body={(r) => `${r.resumen.totalHoras}h`} style={{ width: '70px', textAlign: 'right' }} />
          <Column header="Ingreso" body={(r) => formatCurrency(r.resumen.totalPrecio)}
            style={{ width: '130px', textAlign: 'right' }} sortable sortField="resumen.totalPrecio" />
          <Column header="GM" style={{ width: '80px', textAlign: 'right' }} body={(r) => (
            <span className={`font-bold ${gmColor(r.resumen.gmPct)}`}>{r.resumen.gmPct}%</span>
          )} />
        </DataTable>
      </Card>

      {/* ── KPI Cards (abajo, reactivos a selección) ─────────────────────── */}
      <div className="mb-4">
        {haySeleccion && (
          <p className="text-xs text-color-secondary mb-2">
            <i className="pi pi-filter-fill mr-1 text-primary" />
            Totales de <strong>{selectedRows.length}</strong> caso(s) seleccionado(s)
          </p>
        )}
        <div className="grid">
          <div className="col-12 md:col-3">
            <Card className="text-center">
              <div className="text-color-secondary text-sm mb-1">Total Casos</div>
              <div className="text-3xl font-bold text-primary">{kpi.totalCaso}</div>
              {haySeleccion && <div className="text-xs text-color-secondary mt-1">de {casos.length} totales</div>}
            </Card>
          </div>
          <div className="col-12 md:col-3">
            <Card className="text-center">
              <div className="text-color-secondary text-sm mb-1">Ingresos Estimados</div>
              <div className="text-2xl font-bold text-blue-600">{formatCurrency(kpi.totalPrecio)}</div>
            </Card>
          </div>
          <div className="col-12 md:col-3">
            <Card className="text-center">
              <div className="text-color-secondary text-sm mb-1">Costos Estimados</div>
              <div className="text-2xl font-bold text-orange-500">{formatCurrency(kpi.totalCosto)}</div>
            </Card>
          </div>
          <div className="col-12 md:col-3">
            <Card className="text-center">
              <div className="text-color-secondary text-sm mb-1">Margen Bruto</div>
              <div className={`text-2xl font-bold ${gmColor(kpi.gmPct)}`}>
                {formatCurrency(kpi.gm)} <span className="text-base">({kpi.gmPct}%)</span>
              </div>
              <ProgressBar value={kpi.gmPct} showValue={false} style={{ height: '6px', marginTop: '6px' }}
                color={kpi.gmPct >= 40 ? 'var(--green-500)' : kpi.gmPct >= 20 ? 'var(--yellow-500)' : 'var(--red-500)'}
              />
            </Card>
          </div>
        </div>
      </div>

      {/* ── Gráficas y tabla por perfil (reactivos a selección) ──────────── */}
      <div className="grid">
        {/* Gráfica de barras horizontal */}
        <div className="col-12 lg:col-7">
          <Card>
            <h3 className="m-0 mb-3 font-semibold text-sm">
              <i className="pi pi-chart-bar mr-2" />
              Ingresos vs Costos por Perfil
              {haySeleccion && <Tag value="Selección" severity="info" className="ml-2" style={{ fontSize: '0.7rem' }} />}
            </h3>
            {porPerfil.length === 0 ? (
              <p className="text-color-secondary text-sm m-0">Sin datos para mostrar</p>
            ) : (
              <Chart
                type="bar"
                data={chartData}
                options={chartOptions}
                style={{ maxHeight: '320px' }}
              />
            )}
          </Card>
        </div>

        {/* Tabla de resumen por perfil */}
        <div className="col-12 lg:col-5">
          <Card>
            <h3 className="m-0 mb-3 font-semibold text-sm">
              <i className="pi pi-users mr-2" />
              Resumen por Perfil
              {haySeleccion && <Tag value="Selección" severity="info" className="ml-2" style={{ fontSize: '0.7rem' }} />}
            </h3>
            {porPerfil.length === 0 ? (
              <p className="text-color-secondary text-sm m-0">Sin datos</p>
            ) : (
              <>
                <div className="flex flex-column gap-2 mb-3">
                  {porPerfil.map((p) => (
                    <div key={p.perfil} className="flex justify-content-between align-items-center text-sm">
                      <span className="text-color-secondary flex-1">{p.perfil}</span>
                      <div className="flex align-items-center gap-2">
                        <span className="text-xs text-color-secondary">{p.horas}h</span>
                        <span className="font-semibold">{formatCurrency(p.precio)}</span>
                        <Tag value={`${p.gmPct}%`} severity={gmSeverity(p.gmPct)} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="surface-50 border-round p-2 flex justify-content-between text-sm font-semibold" style={{ borderTop: '2px solid var(--surface-border)' }}>
                  <span>Total</span>
                  <div className="flex align-items-center gap-2">
                    <span className="text-xs text-color-secondary">{kpi.totalHoras}h</span>
                    <span className={gmColor(kpi.gmPct)}>{formatCurrency(kpi.totalPrecio)}</span>
                    <Tag value={`${kpi.gmPct}%`} severity={gmSeverity(kpi.gmPct)} />
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
