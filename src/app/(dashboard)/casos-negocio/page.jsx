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

const ESTADO_SEVERITY = {
  Prefactibilidad:       'warning',
  Elaboracion_Propuesta: 'info',
  Adjudicado:            'success',
  Rechazado:             'danger',
  Cerrado:               'secondary',
}

function margenColor(pct) {
  if (pct >= 40) return 'text-green-600'
  if (pct >= 20) return 'text-yellow-600'
  return 'text-red-600'
}
function margenSeverity(pct) {
  if (pct >= 40) return 'success'
  if (pct >= 20) return 'warning'
  return 'danger'
}

export default function CasosNegocioPage() {
  const toast  = useRef(null)
  const router = useRouter()
  const { puede } = usePermisos()

  const [casos,         setCasos]         = useState([])
  const [estados,       setEstados]       = useState([])
  const [empresas,      setEmpresas]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [fechaDesde,    setFechaDesde]    = useState(null)
  const [fechaHasta,    setFechaHasta]    = useState(null)
  const [empresaFiltro, setEmpresaFiltro] = useState(null)
  const [estadoFiltro,  setEstadoFiltro]  = useState(null)
  const [expandedRows,  setExpandedRows]  = useState(null)
  const [selectedRows,  setSelectedRows]  = useState([])

  useEffect(() => { loadData() }, [fechaDesde, fechaHasta, empresaFiltro, estadoFiltro])

  const loadData = async () => {
    setLoading(true)
    setSelectedRows([])
    try {
      const params = new URLSearchParams()
      if (fechaDesde)    params.set('from',       fechaDesde.toISOString().slice(0, 10))
      if (fechaHasta)    params.set('to',         fechaHasta.toISOString().slice(0, 10))
      if (empresaFiltro) params.set('empresa_id', empresaFiltro)
      if (estadoFiltro)  params.set('estado_id',  estadoFiltro)

      const res = await axios.get('/api/v1/casos-negocio?' + params.toString())
      const { casos, estados, empresas } = res.data.data
      setCasos(casos)
      if (estados?.length)  setEstados(estados)
      if (empresas?.length) setEmpresas(empresas)
    } catch {
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los casos de negocio', life: 4000 })
    } finally {
      setLoading(false)
    }
  }

  const limpiarFiltros = () => {
    setFechaDesde(null)
    setFechaHasta(null)
    setEmpresaFiltro(null)
    setEstadoFiltro(null)
  }

  const fuente = selectedRows.length > 0 ? selectedRows : casos

  const kpi = useMemo(() => {
    const totalCaso   = fuente.length
    const totalHoras  = fuente.reduce((s, c) => s + c.resumen.totalHoras,   0)
    const totalCosto  = fuente.reduce((s, c) => s + c.resumen.totalCosto,   0)
    const totalPrecio = fuente.reduce((s, c) => s + c.resumen.totalPrecio,  0)
    const totalFact   = fuente.reduce((s, c) => s + c.financiero.facturado, 0)
    const totalPagado = fuente.reduce((s, c) => s + c.financiero.pagado,    0)
    const saldoCobrar = totalFact - totalPagado
    const gm          = totalPrecio - totalCosto
    const gmPct       = totalPrecio > 0 ? Math.round((gm / totalPrecio) * 100) : 0
    const pctCobrado  = totalFact   > 0 ? Math.round((totalPagado / totalFact) * 100) : 0
    const pctFacturado = totalPrecio > 0 ? Math.round((totalFact / totalPrecio) * 100) : 0
    return { totalCaso, totalHoras, totalCosto, totalPrecio, gm, gmPct, totalFact, totalPagado, saldoCobrar, pctCobrado, pctFacturado }
  }, [fuente])

  // Gráfica pipeline: Estimado → Facturado → Cobrado
  const pipelineData = useMemo(() => ({
    labels: ['Ingreso Estimado', 'Facturado', 'Cobrado'],
    datasets: [{
      data: [kpi.totalPrecio, kpi.totalFact, kpi.totalPagado],
      backgroundColor: ['#3b82f6', '#f59e0b', '#22c55e'],
      borderRadius: 6,
      borderSkipped: false,
    }],
  }), [kpi])

  const pipelineOptions = useMemo(() => ({
    indexAxis: 'y',
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => ` ${formatCurrency(ctx.raw)}` } },
    },
    scales: {
      x: { ticks: { callback: (v) => '$' + Number(v).toLocaleString('es-EC') }, grid: { display: false } },
      y: { grid: { display: false } },
    },
  }), [])

  // Gráfica donut: estado de cobro
  const cobroData = useMemo(() => ({
    labels: ['Cobrado', 'Por cobrar'],
    datasets: [{
      data: [kpi.totalPagado, Math.max(0, kpi.saldoCobrar)],
      backgroundColor: ['#22c55e', '#ef4444'],
      hoverBackgroundColor: ['#16a34a', '#dc2626'],
      borderWidth: 2,
    }],
  }), [kpi])

  const cobroOptions = useMemo(() => ({
    responsive: true,
    plugins: {
      legend: { position: 'bottom' },
      tooltip: { callbacks: { label: (ctx) => ` ${formatCurrency(ctx.raw)}` } },
    },
    cutout: '65%',
  }), [])

  const rowExpansionTemplate = (caso) => (
    <div className="p-3 surface-50 border-round">
      <p className="font-semibold text-sm mb-2">Detalle por perfil</p>
      <DataTable value={caso.lineas} size="small" emptyMessage="Sin líneas de caso de negocio">
        <Column header="Perfil"       body={(l) => `${l.perfil.nombre} ${l.perfil.nivel}`} />
        <Column header="Horas"        body={(l) => `${l.horas}h`}                        style={{ width: '80px' }} />
        <Column header="Costo/h"      body={(l) => formatCurrency(l.costoHora)}           style={{ width: '110px', textAlign: 'right' }} />
        <Column header="Total Costo"  body={(l) => formatCurrency(l.costo)}               style={{ width: '130px', textAlign: 'right' }} />
        <Column header="Precio/h"     body={(l) => formatCurrency(l.precioHora)}          style={{ width: '110px', textAlign: 'right' }} />
        <Column header="Total Precio" body={(l) => formatCurrency(l.precio)}              style={{ width: '130px', textAlign: 'right' }} />
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

  const estadoOptions = [
    { label: 'Todos los estados', value: null },
    ...estados.map((e) => ({ label: e.nombre.replace('_', ' '), value: e.id })),
  ]
  const empresaOptions = [
    { label: 'Todas las empresas', value: null },
    ...empresas.map((e) => ({ label: e.nombre, value: e.id })),
  ]

  return (
    <div className="p-4">
      <Toast ref={toast} />

      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold m-0">Casos de Negocio</h1>
        <p className="text-color-secondary text-sm mt-1 mb-0">
          Rentabilidad y estado de cobro · Solo proyectos activos
        </p>
      </div>

      {/* ── Tabla ─────────────────────────────────────────────────────────── */}
      <Card className="mb-4">
        <div className="flex flex-wrap gap-3 mb-3 align-items-end justify-content-between">
          <div className="flex flex-wrap gap-3 align-items-end">
            <div className="flex flex-column gap-1">
              <label className="text-xs text-color-secondary">Empresa</label>
              <Dropdown value={empresaFiltro} options={empresaOptions} optionLabel="label" optionValue="value"
                onChange={(e) => setEmpresaFiltro(e.value)} style={{ width: '170px' }} />
            </div>
            <div className="flex flex-column gap-1">
              <label className="text-xs text-color-secondary">Estado</label>
              <Dropdown value={estadoFiltro} options={estadoOptions} optionLabel="label" optionValue="value"
                onChange={(e) => setEstadoFiltro(e.value)} style={{ width: '170px' }} />
            </div>
            <div className="flex flex-column gap-1">
              <label className="text-xs text-color-secondary">Desde</label>
              <Calendar value={fechaDesde} onChange={(e) => setFechaDesde(e.value)} dateFormat="dd/mm/yy"
                showButtonBar placeholder="Fecha inicio" style={{ width: '140px' }} />
            </div>
            <div className="flex flex-column gap-1">
              <label className="text-xs text-color-secondary">Hasta</label>
              <Calendar value={fechaHasta} onChange={(e) => setFechaHasta(e.value)} dateFormat="dd/mm/yy"
                showButtonBar placeholder="Fecha fin" style={{ width: '140px' }} />
            </div>
            <Button icon="pi pi-refresh" severity="secondary" outlined size="small"
              onClick={limpiarFiltros} tooltip="Limpiar filtros" tooltipOptions={{ position: 'top' }} />
          </div>

          {haySeleccion ? (
            <div className="flex align-items-center gap-2">
              <Tag value={`${selectedRows.length} de ${casos.length} seleccionados`} severity="info" />
              <Button label="Limpiar selección" icon="pi pi-times" size="small" text severity="secondary"
                onClick={() => setSelectedRows([])} />
            </div>
          ) : (
            <span className="text-xs text-color-secondary">
              <i className="pi pi-info-circle mr-1" />
              Selecciona filas para filtrar KPIs y gráficas
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
          emptyMessage="No hay proyectos registrados"
          stripedRows
          paginator
          rows={15}
          rowClassName={(row) => selectedRows.some((r) => r.id === row.id) ? 'bg-blue-50' : ''}
        >
          <Column selectionMode="multiple" style={{ width: '3rem' }} />
          <Column expander style={{ width: '3rem' }} />
          <Column header="Código" body={(r) => r.codigo || '—'} style={{ width: '120px', fontFamily: 'monospace', fontSize: '0.85rem' }} />
          <Column header="Empresa" body={(r) => <span className="font-medium">{r.empresa?.nombre}</span>} style={{ minWidth: '130px' }} />
          <Column header="Aplicativo" body={(r) => r.aplicativo || '—'} style={{ width: '110px' }} />
          <Column header="Proyecto" body={(r) => (
            <Button label={r.nombre} link className="p-0 text-left text-sm"
              onClick={() => router.push(`/proyectos/${r.id}`)} />
          )} style={{ minWidth: '180px' }} />
          <Column header="Estado" style={{ width: '140px' }} body={(r) => (
            <Tag value={r.estado?.nombre?.replace('_', ' ')} severity={ESTADO_SEVERITY[r.estado?.nombre] || 'secondary'} />
          )} />
          <Column header="Fecha"       body={(r) => formatDate(r.fecha)}                      style={{ width: '95px' }} />
          <Column header="Horas"       body={(r) => `${r.resumen.totalHoras}h`}               style={{ width: '65px', textAlign: 'right' }} />
          <Column header="Ingreso Est." body={(r) => formatCurrency(r.resumen.totalPrecio)}   style={{ width: '120px', textAlign: 'right' }} sortable />
          <Column header="Facturado"   body={(r) => formatCurrency(r.financiero.facturado)}   style={{ width: '110px', textAlign: 'right' }} />
          <Column header="Cobrado"     body={(r) => formatCurrency(r.financiero.pagado)}      style={{ width: '110px', textAlign: 'right' }} />
          <Column header="Saldo" style={{ width: '110px', textAlign: 'right' }} body={(r) => (
            <span className={r.financiero.saldo > 0 ? 'font-bold text-red-600' : 'text-green-600'}>
              {formatCurrency(r.financiero.saldo)}
            </span>
          )} />
          <Column header="%" style={{ width: '70px', textAlign: 'right' }} body={(r) => (
            <span className={`font-bold ${margenColor(r.resumen.gmPct)}`}>{r.resumen.gmPct}%</span>
          )} />
        </DataTable>
      </Card>

      {/* ── KPIs + Gráficas ──────────────────────────────────────────────── */}
      {haySeleccion && (
        <p className="text-xs text-color-secondary mb-2">
          <i className="pi pi-filter-fill mr-1 text-primary" />
          Métricas de <strong>{selectedRows.length}</strong> proyecto(s) seleccionado(s)
        </p>
      )}

      <div className="grid">
        {/* Columna izquierda: 3 KPI cards apiladas */}
        <div className="col-12 lg:col-3 flex flex-column gap-3">

          {/* KPI: Proyectos */}
          <Card className="text-center flex-1">
            <div className="text-color-secondary text-sm mb-2">
              <i className="pi pi-briefcase mr-1" />Proyectos
            </div>
            <div className="text-4xl font-bold text-primary mb-1">{kpi.totalCaso}</div>
            {haySeleccion && <div className="text-xs text-color-secondary">de {casos.length} totales</div>}
            <div className="text-xs text-color-secondary mt-1">{kpi.totalHoras}h planificadas</div>
          </Card>

          {/* KPI: Margen */}
          <Card className="flex-1">
            <div className="text-color-secondary text-sm mb-2 text-center">
              <i className="pi pi-percentage mr-1" />Margen
            </div>
            <div className={`text-3xl font-bold text-center mb-1 ${margenColor(kpi.gmPct)}`}>{kpi.gmPct}%</div>
            <div className="text-xs text-color-secondary text-center mb-2">{formatCurrency(kpi.gm)} de ganancia</div>
            <ProgressBar value={kpi.gmPct} showValue={false} style={{ height: '8px' }}
              color={kpi.gmPct >= 40 ? 'var(--green-500)' : kpi.gmPct >= 20 ? 'var(--yellow-500)' : 'var(--red-500)'} />
            <div className="flex justify-content-between text-xs text-color-secondary mt-1">
              <span>Costo: {formatCurrency(kpi.totalCosto)}</span>
              <span>Ingreso: {formatCurrency(kpi.totalPrecio)}</span>
            </div>
          </Card>

          {/* KPI: Saldo por cobrar */}
          <Card className="flex-1 text-center" style={{ border: kpi.saldoCobrar > 0 ? '1px solid var(--red-300)' : '1px solid var(--green-300)' }}>
            <div className="text-color-secondary text-sm mb-2">
              <i className={`pi ${kpi.saldoCobrar > 0 ? 'pi-exclamation-triangle text-red-500' : 'pi-check-circle text-green-500'} mr-1`} />
              Saldo por Cobrar
            </div>
            <div className={`text-2xl font-bold mb-1 ${kpi.saldoCobrar > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(kpi.saldoCobrar)}
            </div>
            <div className="text-xs text-color-secondary">
              {formatCurrency(kpi.totalPagado)} cobrado de {formatCurrency(kpi.totalFact)}
            </div>
            {kpi.totalFact > 0 && (
              <ProgressBar value={kpi.pctCobrado} showValue={false} style={{ height: '6px', marginTop: '8px' }}
                color="var(--green-500)" />
            )}
            {kpi.totalFact > 0 && (
              <div className="text-xs text-green-600 mt-1">{kpi.pctCobrado}% cobrado</div>
            )}
          </Card>
        </div>

        {/* Columna derecha: 2 gráficas */}
        <div className="col-12 lg:col-9 flex flex-column gap-3">

          {/* Gráfica 1: Pipeline financiero */}
          <Card className="flex-1">
            <h3 className="m-0 mb-3 font-semibold text-sm">
              <i className="pi pi-chart-bar mr-2 text-blue-500" />
              Pipeline Financiero
              {haySeleccion && <Tag value="Selección" severity="info" className="ml-2" style={{ fontSize: '0.7rem' }} />}
            </h3>
            {kpi.totalPrecio === 0 && kpi.totalFact === 0 ? (
              <p className="text-color-secondary text-sm m-0 text-center p-4">Sin datos financieros para mostrar</p>
            ) : (
              <Chart type="bar" data={pipelineData} options={pipelineOptions} style={{ maxHeight: '160px' }} />
            )}
          </Card>

          {/* Gráfica 2: Estado de cobro (donut) */}
          <Card className="flex-1">
            <h3 className="m-0 mb-3 font-semibold text-sm">
              <i className="pi pi-chart-pie mr-2 text-green-500" />
              Estado de Cobro
              {haySeleccion && <Tag value="Selección" severity="info" className="ml-2" style={{ fontSize: '0.7rem' }} />}
            </h3>
            {kpi.totalFact === 0 ? (
              <p className="text-color-secondary text-sm m-0 text-center p-4">Sin facturas registradas</p>
            ) : (
              <div className="flex align-items-center gap-4">
                <Chart type="doughnut" data={cobroData} options={cobroOptions} style={{ maxHeight: '200px', maxWidth: '200px' }} />
                <div className="flex flex-column gap-3 flex-1">
                  <div>
                    <div className="text-xs text-color-secondary mb-1">Total Facturado</div>
                    <div className="text-xl font-bold text-orange-500">{formatCurrency(kpi.totalFact)}</div>
                    <div className="text-xs text-color-secondary">{kpi.pctFacturado}% del ingreso estimado</div>
                  </div>
                  <div>
                    <div className="text-xs text-color-secondary mb-1">Total Cobrado</div>
                    <div className="text-xl font-bold text-green-600">{formatCurrency(kpi.totalPagado)}</div>
                    <div className="text-xs text-color-secondary">{kpi.pctCobrado}% de lo facturado</div>
                  </div>
                  <div>
                    <div className="text-xs text-color-secondary mb-1">Por Cobrar</div>
                    <div className={`text-xl font-bold ${kpi.saldoCobrar > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(kpi.saldoCobrar)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
