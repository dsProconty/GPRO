'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { IconField } from 'primereact/iconfield'
import { InputIcon } from 'primereact/inputicon'
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
  Adjudicado:            'success',
  'En Ejecución':        'info',
  'Por Facturar':        'warning',
  Facturado:             'secondary',
  Cerrado:               'secondary',
  Elaboracion_Propuesta: 'info',
  Ejecución:             'info',
  Pruebas:               'warning',
  Rechazado:             'danger',
  Entregado:             'success',
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
  const [visibleRows,   setVisibleRows]   = useState([])
  const [globalFilter,  setGlobalFilter]  = useState('')

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

  const fuente = selectedRows.length > 0 ? selectedRows : (visibleRows.length > 0 ? visibleRows : casos)

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

  // Barra apilada horizontal: composición del ingreso estimado
  const stackedData = useMemo(() => ({
    labels: [''],
    datasets: [
      {
        label: 'Cobrado',
        data: [kpi.totalPagado],
        backgroundColor: '#22c55e',
        borderRadius: 0,
      },
      {
        label: 'Facturado (saldo)',
        data: [kpi.saldoCobrar],
        backgroundColor: '#f59e0b',
        borderRadius: 0,
      },
      {
        label: 'Por Facturar',
        data: [Math.max(0, kpi.totalPrecio - kpi.totalFact)],
        backgroundColor: '#e5e7eb',
        borderRadius: 0,
      },
    ],
  }), [kpi])

  const stackedOptions = useMemo(() => ({
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 14, font: { size: 12 } } },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`,
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        ticks: { callback: (v) => '$' + Number(v).toLocaleString('es-EC'), font: { size: 11 } },
        grid: { color: '#f3f4f6' },
      },
      y: { stacked: true, grid: { display: false }, ticks: { display: false } },
    },
  }), [])

  // Unused options placeholder kept for reference
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

        {/* Buscador global */}
        <div className="mb-3">
          <IconField iconPosition="left" className="w-full">
            <InputIcon className="pi pi-search" />
            <InputText
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Buscar proyecto, empresa, aplicativo..."
              className="w-full"
            />
          </IconField>
        </div>

        <DataTable
          value={casos}
          loading={loading}
          globalFilter={globalFilter}
          onValueChange={(rows) => setVisibleRows(rows)}
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
          rowsPerPageOptions={[15, 30, 50]}
          filterDisplay="menu"
          rowClassName={(row) => selectedRows.some((r) => r.id === row.id) ? 'bg-blue-50' : ''}
        >
          <Column selectionMode="multiple" style={{ width: '3rem' }} />
          <Column expander style={{ width: '3rem' }} />
          <Column field="codigo" header="Código" body={(r) => r.codigo || '—'} sortable filter filterPlaceholder="Buscar código..." style={{ width: '120px', fontFamily: 'monospace', fontSize: '0.85rem' }} />
          <Column field="empresa.nombre" header="Empresa" body={(r) => <span className="font-medium">{r.empresa?.nombre}</span>} sortable filter filterPlaceholder="Buscar empresa..." style={{ minWidth: '130px' }} />
          <Column field="aplicativo" header="Aplicativo" body={(r) => r.aplicativo || '—'} sortable filter filterPlaceholder="Buscar aplicativo..." style={{ width: '110px' }} />
          <Column field="nombre" header="Proyecto" body={(r) => (
            <Button label={r.nombre} link className="p-0 text-left text-sm"
              onClick={() => router.push(`/proyectos/${r.id}`)} />
          )} sortable filter filterPlaceholder="Buscar proyecto..." style={{ minWidth: '180px' }} />
          <Column field="estado.nombre" header="Estado" style={{ width: '140px' }} sortable filter filterPlaceholder="Buscar estado..." body={(r) => (
            <Tag value={r.estado?.nombre?.replace('_', ' ')} severity={ESTADO_SEVERITY[r.estado?.nombre] || 'secondary'} />
          )} />
          <Column field="fecha" header="Fecha" body={(r) => formatDate(r.fecha)} sortable style={{ width: '95px' }} />
          <Column field="resumen.totalHoras" header="Horas" body={(r) => `${r.resumen.totalHoras}h`} sortable dataType="numeric" style={{ width: '75px', textAlign: 'right' }} />
          <Column field="resumen.totalPrecio" header="Ingreso Est." body={(r) => formatCurrency(r.resumen.totalPrecio)} sortable dataType="numeric" style={{ width: '120px', textAlign: 'right' }} />
          <Column field="financiero.facturado" header="Facturado" body={(r) => formatCurrency(r.financiero.facturado)} sortable dataType="numeric" style={{ width: '110px', textAlign: 'right' }} />
          <Column field="financiero.pagado" header="Cobrado" body={(r) => formatCurrency(r.financiero.pagado)} sortable dataType="numeric" style={{ width: '110px', textAlign: 'right' }} />
          <Column field="financiero.saldo" header="Saldo" sortable dataType="numeric" style={{ width: '110px', textAlign: 'right' }} body={(r) => (
            <span className={r.financiero.saldo > 0 ? 'font-bold text-red-600' : 'text-green-600'}>
              {formatCurrency(r.financiero.saldo)}
            </span>
          )} />
          <Column field="resumen.gmPct" header="%" sortable dataType="numeric" style={{ width: '70px', textAlign: 'right' }} body={(r) => (
            <span className={`font-bold ${margenColor(r.resumen.gmPct)}`}>{r.resumen.gmPct}%</span>
          )} />
        </DataTable>
      </Card>

      {/* ── KPIs financieros ─────────────────────────────────────────────── */}
      {haySeleccion && (
        <p className="text-xs text-color-secondary mb-2">
          <i className="pi pi-filter-fill mr-1 text-primary" />
          Métricas de <strong>{selectedRows.length}</strong> proyecto(s) seleccionado(s)
        </p>
      )}

      {/* Fila 1: pipeline de 5 KPIs */}
      <div className="grid mb-3">
        {/* 1. Proyectos */}
        <div className="col-12 sm:col-6 lg:col-2">
          <Card className="text-center h-full">
            <div className="text-color-secondary text-xs mb-1"><i className="pi pi-briefcase mr-1" />Proyectos</div>
            <div className="text-3xl font-bold text-primary">{kpi.totalCaso}</div>
            {haySeleccion && <div className="text-xs text-color-secondary mt-1">de {casos.length} totales</div>}
          </Card>
        </div>

        {/* 2. Ingreso Estimado */}
        <div className="col-12 sm:col-6 lg:col-2">
          <Card className="h-full" style={{ borderTop: '3px solid #3b82f6' }}>
            <div className="text-color-secondary text-xs mb-1"><i className="pi pi-dollar mr-1" />Ingreso Estimado</div>
            <div className="text-xl font-bold text-blue-600">{formatCurrency(kpi.totalPrecio)}</div>
            <div className="text-xs text-color-secondary mt-1">valor total de proyectos</div>
          </Card>
        </div>

        {/* 3. Facturado */}
        <div className="col-12 sm:col-6 lg:col-2">
          <Card className="h-full" style={{ borderTop: '3px solid #f59e0b' }}>
            <div className="text-color-secondary text-xs mb-1"><i className="pi pi-file mr-1" />Facturado</div>
            <div className="text-xl font-bold text-orange-500">{formatCurrency(kpi.totalFact)}</div>
            <div className="text-xs text-color-secondary mt-1">{kpi.pctFacturado}% del estimado</div>
            <ProgressBar value={Math.min(kpi.pctFacturado, 100)} showValue={false} style={{ height: '4px', marginTop: '6px' }}
              color="var(--orange-400)" />
          </Card>
        </div>

        {/* 4. Por Facturar */}
        <div className="col-12 sm:col-6 lg:col-2">
          <Card className="h-full" style={{ borderTop: `3px solid ${kpi.totalPrecio - kpi.totalFact > 0 ? '#ef4444' : '#22c55e'}` }}>
            <div className="text-color-secondary text-xs mb-1"><i className="pi pi-clock mr-1" />Por Facturar</div>
            <div className={`text-xl font-bold ${kpi.totalPrecio - kpi.totalFact > 0 ? 'text-red-500' : 'text-green-600'}`}>
              {formatCurrency(Math.max(0, kpi.totalPrecio - kpi.totalFact))}
            </div>
            <div className="text-xs text-color-secondary mt-1">
              {kpi.totalPrecio > 0 ? Math.round(((kpi.totalPrecio - kpi.totalFact) / kpi.totalPrecio) * 100) : 0}% sin facturar
            </div>
          </Card>
        </div>

        {/* 5. Cobrado */}
        <div className="col-12 sm:col-6 lg:col-2">
          <Card className="h-full" style={{ borderTop: '3px solid #22c55e' }}>
            <div className="text-color-secondary text-xs mb-1"><i className="pi pi-check-circle mr-1" />Cobrado</div>
            <div className="text-xl font-bold text-green-600">{formatCurrency(kpi.totalPagado)}</div>
            <div className="text-xs text-color-secondary mt-1">{kpi.pctCobrado}% de lo facturado</div>
            <ProgressBar value={Math.min(kpi.pctCobrado, 100)} showValue={false} style={{ height: '4px', marginTop: '6px' }}
              color="var(--green-500)" />
          </Card>
        </div>

        {/* 6. Saldo por Cobrar */}
        <div className="col-12 sm:col-6 lg:col-2">
          <Card className="h-full" style={{ borderTop: `3px solid ${kpi.saldoCobrar > 0 ? '#ef4444' : '#22c55e'}` }}>
            <div className="text-color-secondary text-xs mb-1">
              <i className={`pi ${kpi.saldoCobrar > 0 ? 'pi-exclamation-triangle text-red-500' : 'pi-check-circle text-green-500'} mr-1`} />
              Saldo por Cobrar
            </div>
            <div className={`text-xl font-bold ${kpi.saldoCobrar > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(kpi.saldoCobrar)}
            </div>
            <div className="text-xs text-color-secondary mt-1">facturado no cobrado</div>
          </Card>
        </div>
      </div>

      {/* Fila 2: gráfica de pipeline */}
      <div className="grid">
        <div className="col-12">
          <Card>
            <div className="flex align-items-center justify-content-between mb-3">
              <h3 className="m-0 font-semibold text-sm">
                <i className="pi pi-chart-bar mr-2 text-blue-500" />
                Composición del Ingreso Estimado
                {haySeleccion && <Tag value="Selección" severity="info" className="ml-2" style={{ fontSize: '0.7rem' }} />}
              </h3>
              <span className="text-xs text-color-secondary">
                Total: <strong>{formatCurrency(kpi.totalPrecio)}</strong>
              </span>
            </div>
            {kpi.totalPrecio === 0 ? (
              <p className="text-color-secondary text-sm m-0 text-center p-4">Sin datos financieros para mostrar</p>
            ) : (
              <div style={{ height: '100px' }}>
                <Chart type="bar" data={stackedData} options={stackedOptions} />
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
