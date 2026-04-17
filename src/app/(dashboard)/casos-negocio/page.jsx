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
  const [estados,      setEstados]      = useState([])
  const [empresas,     setEmpresas]     = useState([])
  const [loading,      setLoading]      = useState(true)
  const [fechaDesde,   setFechaDesde]   = useState(null)
  const [fechaHasta,   setFechaHasta]   = useState(null)
  const [empresaFiltro, setEmpresaFiltro] = useState(null)
  const [estadoFiltro,  setEstadoFiltro]  = useState(null)
  const [expandedRows, setExpandedRows] = useState(null)
  const [selectedRows, setSelectedRows] = useState([])

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

  // Fuente reactiva: selección o todos
  const fuente = selectedRows.length > 0 ? selectedRows : casos

  const kpi = useMemo(() => {
    const totalCaso    = fuente.length
    const totalHoras   = fuente.reduce((s, c) => s + c.resumen.totalHoras,    0)
    const totalCosto   = fuente.reduce((s, c) => s + c.resumen.totalCosto,    0)
    const totalPrecio  = fuente.reduce((s, c) => s + c.resumen.totalPrecio,   0)
    const totalFact    = fuente.reduce((s, c) => s + c.financiero.facturado,  0)
    const totalPagado  = fuente.reduce((s, c) => s + c.financiero.pagado,     0)
    const saldoCobrar  = totalFact - totalPagado
    const gm           = totalPrecio - totalCosto
    const gmPct        = totalPrecio > 0 ? Math.round((gm / totalPrecio) * 100) : 0
    return { totalCaso, totalHoras, totalCosto, totalPrecio, gm, gmPct, totalFact, totalPagado, saldoCobrar }
  }, [fuente])

  const porPerfil = useMemo(() => calcPorPerfil(fuente), [fuente])

  const chartData = useMemo(() => ({
    labels: porPerfil.map((p) => p.perfil),
    datasets: [
      { label: 'Ingreso Est.', data: porPerfil.map((p) => p.precio), backgroundColor: '#3b82f6' },
      { label: 'Costo Est.',   data: porPerfil.map((p) => p.costo),  backgroundColor: '#f59e0b' },
    ],
  }), [porPerfil])

  const chartOptions = useMemo(() => ({
    indexAxis: 'y',
    responsive: true,
    plugins: { legend: { position: 'bottom' } },
    scales: { x: { ticks: { callback: (v) => '$' + v.toLocaleString() } } },
  }), [])

  const rowExpansionTemplate = (caso) => (
    <div className="p-3 surface-50 border-round">
      <p className="font-semibold text-sm mb-2">Detalle por perfil</p>
      <DataTable value={caso.lineas} size="small">
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
        {/* Filtros */}
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
          emptyMessage="No hay proyectos con caso de negocio registrado"
          stripedRows
          paginator
          rows={15}
          rowClassName={(row) => selectedRows.some((r) => r.id === row.id) ? 'bg-blue-50' : ''}
        >
          <Column selectionMode="multiple" style={{ width: '3rem' }} />
          <Column expander style={{ width: '3rem' }} />
          <Column header="Empresa" body={(r) => <span className="font-medium">{r.empresa?.nombre}</span>} style={{ minWidth: '130px' }} />
          <Column header="Proyecto" body={(r) => (
            <Button label={r.nombre} link className="p-0 text-left text-sm"
              onClick={() => router.push(`/proyectos/${r.id}`)} />
          )} style={{ minWidth: '180px' }} />
          <Column header="Estado" style={{ width: '140px' }} body={(r) => (
            <Tag value={r.estado?.nombre?.replace('_', ' ')} severity={ESTADO_SEVERITY[r.estado?.nombre] || 'secondary'} />
          )} />
          <Column header="Fecha" body={(r) => formatDate(r.fecha)} style={{ width: '95px' }} />
          <Column header="Horas" body={(r) => `${r.resumen.totalHoras}h`} style={{ width: '65px', textAlign: 'right' }} />
          <Column header="Ingreso Est." body={(r) => formatCurrency(r.resumen.totalPrecio)}
            style={{ width: '120px', textAlign: 'right' }} sortable />
          <Column header="Facturado" body={(r) => formatCurrency(r.financiero.facturado)}
            style={{ width: '110px', textAlign: 'right' }} />
          <Column header="Cobrado" body={(r) => formatCurrency(r.financiero.pagado)}
            style={{ width: '110px', textAlign: 'right' }} />
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

      {/* ── KPI Cards ────────────────────────────────────────────────────── */}
      <div className="mb-4">
        {haySeleccion && (
          <p className="text-xs text-color-secondary mb-2">
            <i className="pi pi-filter-fill mr-1 text-primary" />
            Totales de <strong>{selectedRows.length}</strong> proyecto(s) seleccionado(s)
          </p>
        )}
        {/* Fila 1: estimados */}
        <div className="grid mb-3">
          <div className="col-12 md:col-3">
            <Card className="text-center">
              <div className="text-color-secondary text-sm mb-1">Proyectos</div>
              <div className="text-3xl font-bold text-primary">{kpi.totalCaso}</div>
              {haySeleccion && <div className="text-xs text-color-secondary mt-1">de {casos.length} totales</div>}
            </Card>
          </div>
          <div className="col-12 md:col-3">
            <Card className="text-center">
              <div className="text-color-secondary text-sm mb-1">Ingreso Estimado</div>
              <div className="text-xl font-bold text-blue-600">{formatCurrency(kpi.totalPrecio)}</div>
              <div className="text-xs text-color-secondary mt-1">{kpi.totalHoras}h planificadas</div>
            </Card>
          </div>
          <div className="col-12 md:col-3">
            <Card className="text-center">
              <div className="text-color-secondary text-sm mb-1">Costo Estimado</div>
              <div className="text-xl font-bold text-orange-500">{formatCurrency(kpi.totalCosto)}</div>
            </Card>
          </div>
          <div className="col-12 md:col-3">
            <Card className="text-center">
              <div className="text-color-secondary text-sm mb-1">Margen</div>
              <div className={`text-xl font-bold ${margenColor(kpi.gmPct)}`}>
                {kpi.gmPct}%
                <span className="text-sm text-color-secondary ml-2">({formatCurrency(kpi.gm)})</span>
              </div>
              <ProgressBar value={kpi.gmPct} showValue={false} style={{ height: '6px', marginTop: '6px' }}
                color={kpi.gmPct >= 40 ? 'var(--green-500)' : kpi.gmPct >= 20 ? 'var(--yellow-500)' : 'var(--red-500)'}
              />
            </Card>
          </div>
        </div>

        {/* Fila 2: facturación y cobro */}
        <div className="grid">
          <div className="col-12 md:col-4">
            <Card className="text-center">
              <div className="text-color-secondary text-sm mb-1">Total Facturado</div>
              <div className="text-xl font-bold text-blue-700">{formatCurrency(kpi.totalFact)}</div>
              {kpi.totalPrecio > 0 && (
                <div className="text-xs text-color-secondary mt-1">
                  {Math.round((kpi.totalFact / kpi.totalPrecio) * 100)}% del estimado
                </div>
              )}
            </Card>
          </div>
          <div className="col-12 md:col-4">
            <Card className="text-center">
              <div className="text-color-secondary text-sm mb-1">Total Cobrado</div>
              <div className="text-xl font-bold text-green-600">{formatCurrency(kpi.totalPagado)}</div>
              {kpi.totalFact > 0 && (
                <>
                  <div className="text-xs text-color-secondary mt-1">
                    {Math.round((kpi.totalPagado / kpi.totalFact) * 100)}% de lo facturado
                  </div>
                  <ProgressBar value={Math.round((kpi.totalPagado / kpi.totalFact) * 100)} showValue={false}
                    style={{ height: '5px', marginTop: '6px' }} color="var(--green-500)" />
                </>
              )}
            </Card>
          </div>
          <div className="col-12 md:col-4">
            <Card className="text-center" style={{ border: kpi.saldoCobrar > 0 ? '1px solid var(--red-300)' : undefined }}>
              <div className="text-color-secondary text-sm mb-1">Saldo por Cobrar</div>
              <div className={`text-xl font-bold ${kpi.saldoCobrar > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(kpi.saldoCobrar)}
              </div>
              {kpi.saldoCobrar > 0 && (
                <div className="text-xs text-red-400 mt-1">
                  <i className="pi pi-exclamation-triangle mr-1" />
                  Pendiente de cobro
                </div>
              )}
              {kpi.saldoCobrar === 0 && kpi.totalFact > 0 && (
                <div className="text-xs text-green-500 mt-1">
                  <i className="pi pi-check-circle mr-1" />
                  Todo cobrado
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* ── Gráficas y tabla por perfil ──────────────────────────────────── */}
      <div className="grid">
        <div className="col-12 lg:col-7">
          <Card>
            <h3 className="m-0 mb-3 font-semibold text-sm">
              <i className="pi pi-chart-bar mr-2" />
              Ingreso vs Costo por Perfil
              {haySeleccion && <Tag value="Selección" severity="info" className="ml-2" style={{ fontSize: '0.7rem' }} />}
            </h3>
            {porPerfil.length === 0 ? (
              <p className="text-color-secondary text-sm m-0">Sin datos para mostrar</p>
            ) : (
              <Chart type="bar" data={chartData} options={chartOptions} style={{ maxHeight: '320px' }} />
            )}
          </Card>
        </div>

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
                        <Tag value={`${p.gmPct}%`} severity={margenSeverity(p.gmPct)} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="surface-50 border-round p-2 flex justify-content-between text-sm font-semibold" style={{ borderTop: '2px solid var(--surface-border)' }}>
                  <span>Total</span>
                  <div className="flex align-items-center gap-2">
                    <span className="text-xs text-color-secondary">{kpi.totalHoras}h</span>
                    <span className={margenColor(kpi.gmPct)}>{formatCurrency(kpi.totalPrecio)}</span>
                    <Tag value={`${kpi.gmPct}%`} severity={margenSeverity(kpi.gmPct)} />
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
