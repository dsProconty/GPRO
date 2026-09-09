'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Button } from 'primereact/button'
import { InputText } from '@/components/shared/InputText'
import { IconField } from 'primereact/iconfield'
import { InputIcon } from 'primereact/inputicon'
import { Dropdown } from 'primereact/dropdown'
import { Tag } from 'primereact/tag'
import { Toast } from 'primereact/toast'
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog'
import { ProgressSpinner } from 'primereact/progressspinner'
import OportunidadFormDialog from '@/components/shared/OportunidadFormDialog'
import CambiarEtapaOportunidadDialog from '@/components/shared/CambiarEtapaOportunidadDialog'
import { oportunidadService } from '@/services/oportunidadService'
import { empleadoService } from '@/services/empleadoService'
import { formatCurrency, formatDate } from '@/utils/format'
import { usePermisos, PERMISOS } from '@/hooks/usePermisos'
import { ETAPAS, ETAPA_CONFIG, ETAPA_HOOK } from '@/lib/oportunidades'

function EtapaTag({ etapa }) {
  const cfg = ETAPA_CONFIG[etapa] || { label: etapa, severity: 'secondary' }
  return <Tag value={cfg.label} severity={cfg.severity} style={cfg.color ? { background: cfg.color, color: '#fff' } : undefined} />
}

function diasDesde(fecha) {
  if (!fecha) return null
  const dias = Math.floor((new Date() - new Date(fecha)) / (1000 * 60 * 60 * 24))
  return dias
}

function ultimaActividadLabel(o) {
  const ref = o.ultimoSeguimiento || o.createdAt
  const dias = diasDesde(ref)
  if (dias === null) return '—'
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'hace 1 día'
  return `hace ${dias} días`
}

export default function OportunidadesPage() {
  const toast = useRef(null)
  const router = useRouter()
  const { puede } = usePermisos()

  const [oportunidades, setOportunidades] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [kpis, setKpis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [globalFilter, setGlobalFilter] = useState('')
  const [etapaFiltro, setEtapaFiltro] = useState(null)
  const [responsableFiltro, setResponsableFiltro] = useState(null)
  const [dialogVisible, setDialogVisible] = useState(false)
  const [etapaDialogVisible, setEtapaDialogVisible] = useState(false)
  const [selected, setSelected] = useState(null)
  const [savingEtapa, setSavingEtapa] = useState(false)

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [opRes, empRes, kpiRes] = await Promise.all([
        oportunidadService.getAll(),
        empleadoService.getAll({ activo: true }),
        oportunidadService.getKpis(),
      ])
      setOportunidades(opRes.data)
      setEmpleados(empRes.data)
      setKpis(kpiRes.data)
    } catch {
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las oportunidades', life: 4000 })
    } finally {
      setLoading(false)
    }
  }

  const oportunidadesFiltradas = useMemo(() => {
    let lista = oportunidades
    if (etapaFiltro) lista = lista.filter((o) => o.etapa === etapaFiltro)
    if (responsableFiltro) lista = lista.filter((o) => o.responsableId === responsableFiltro)
    return lista.map((o) => ({
      ...o,
      responsableNombre: o.responsable ? `${o.responsable.nombre} ${o.responsable.apellido}` : '',
      contactoPrincipal: o.contactos?.[0]?.nombre || '',
    }))
  }, [oportunidades, etapaFiltro, responsableFiltro])

  const openCreate = () => { setSelected(null); setDialogVisible(true) }
  const openEdit = (o) => { setSelected(o); setDialogVisible(true) }
  const openEtapa = (o) => { setSelected(o); setEtapaDialogVisible(true) }
  const verDetalle = (o) => router.push(`/oportunidades/${o.id}`)

  const handleSave = () => {
    setDialogVisible(false)
    toast.current.show({ severity: 'success', summary: 'Éxito', detail: selected ? 'Oportunidad actualizada' : 'Oportunidad creada', life: 3000 })
    loadAll()
  }

  const handleCambiarEtapa = async ({ etapaNueva, nota, motivoPerdida }) => {
    setSavingEtapa(true)
    try {
      const res = await oportunidadService.cambiarEtapa(selected.id, { etapaNueva, nota, motivoPerdida })
      setEtapaDialogVisible(false)
      toast.current.show({ severity: 'success', summary: res.propuestaCreada ? '¡Propuesta generada!' : 'Éxito', detail: res.message, life: res.propuestaCreada ? 6000 : 3000 })
      loadAll()
    } catch (err) {
      toast.current.show({ severity: 'error', summary: 'Error', detail: err.response?.data?.message || 'Error al cambiar la etapa', life: 4000 })
    } finally {
      setSavingEtapa(false)
    }
  }

  const confirmDelete = (o) => {
    confirmDialog({
      message: `¿Eliminar la oportunidad "${o.titulo}"?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptClassName: 'p-button-danger',
      accept: async () => {
        try {
          await oportunidadService.remove(o.id)
          toast.current.show({ severity: 'success', summary: 'Éxito', detail: 'Oportunidad eliminada', life: 3000 })
          loadAll()
        } catch (err) {
          toast.current.show({ severity: 'error', summary: 'Error', detail: err.response?.data?.message || 'Error al eliminar', life: 4000 })
        }
      },
    })
  }

  const responsableOptions = useMemo(() => [
    { label: 'Todos los responsables', value: null },
    ...empleados.map((e) => ({ label: `${e.nombre} ${e.apellido}`, value: e.id })),
  ], [empleados])

  const maxValor = kpis ? Math.max(1, ...ETAPAS.filter((e) => e !== 'Perdida').map((e) => kpis.valorPorEtapa?.[e] || 0)) : 1
  const valorAbierto = kpis ? ETAPAS.filter((e) => e !== 'Perdida').reduce((s, e) => s + (kpis.valorPorEtapa?.[e] || 0), 0) : 0

  if (loading && oportunidades.length === 0) {
    return <div className="flex justify-content-center align-items-center" style={{ height: '60vh' }}><ProgressSpinner /></div>
  }

  return (
    <div className="p-4">
      <Toast ref={toast} />
      <ConfirmDialog />

      <div className="flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <h1 className="text-2xl font-bold m-0">Oportunidades</h1>

        {kpis && (
          <div className="flex flex-wrap align-items-center gap-2">
            <Tag value={`${kpis.total} total`} severity="secondary" style={{ background: 'var(--surface-100)', color: 'var(--text-color)' }} />
            {ETAPAS.map((etapa) => (
              <Tag
                key={etapa}
                value={`${kpis.porEtapa?.[etapa] || 0} ${ETAPA_CONFIG[etapa].label}`}
                severity={ETAPA_CONFIG[etapa].severity}
                style={ETAPA_CONFIG[etapa].color ? { background: ETAPA_CONFIG[etapa].color, color: '#fff' } : undefined}
              />
            ))}
            <Tag value={`${kpis.tasaConversion}% conversión a Propuesta`} style={{ background: 'var(--primary-color)', color: '#fff' }} />
          </div>
        )}

        {puede(PERMISOS.OPORTUNIDADES.CREAR) && (
          <Button label="Nueva Oportunidad" icon="pi pi-plus" onClick={openCreate} />
        )}
      </div>

      {/* Pipeline por valor */}
      {kpis && (
        <div className="surface-card border-round shadow-1 p-3 mb-4">
          <div className="flex align-items-baseline justify-content-between mb-3">
            <span className="font-semibold text-sm">Pipeline · valor por etapa</span>
            <span className="text-sm text-color-secondary">
              <strong>{formatCurrency(valorAbierto)}</strong> en oportunidades abiertas
            </span>
          </div>
          <div className="flex flex-column gap-2">
            {ETAPAS.filter((e) => e !== 'Perdida').map((etapa) => {
              const valor = kpis.valorPorEtapa?.[etapa] || 0
              const pct = Math.round((valor / maxValor) * 100)
              const cfg = ETAPA_CONFIG[etapa]
              return (
                <div key={etapa} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 100px', alignItems: 'center', gap: '12px' }}>
                  <span className="text-sm text-color-secondary font-medium">{cfg.label}</span>
                  <div style={{ height: '12px', background: 'var(--surface-200)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: '999px', background: cfg.color || `var(--${cfg.severity === 'secondary' ? 'surface-500' : cfg.severity}-color, #64748b)` }} />
                  </div>
                  <span className="text-sm font-bold text-right">{formatCurrency(valor)}</span>
                </div>
              )
            })}
          </div>
          {kpis.valorPorEtapa?.Perdida > 0 && (
            <div className="text-xs text-color-secondary mt-2">No incluye oportunidades en etapa Perdida ({formatCurrency(kpis.valorPorEtapa.Perdida)} adicionales).</div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-3">
        <IconField iconPosition="left" className="flex-1" style={{ minWidth: '200px' }}>
          <InputIcon className="pi pi-search" />
          <InputText value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} placeholder="Buscar por empresa, título o contacto..." className="w-full" />
        </IconField>
        <Dropdown
          value={etapaFiltro}
          options={[{ label: 'Todas las etapas', value: null }, ...ETAPAS.map((e) => ({ label: ETAPA_CONFIG[e].label, value: e }))]}
          onChange={(e) => setEtapaFiltro(e.value)}
          placeholder="Filtrar por etapa"
          style={{ minWidth: '200px' }}
        />
        <Dropdown
          value={responsableFiltro}
          options={responsableOptions}
          onChange={(e) => setResponsableFiltro(e.value)}
          placeholder="Filtrar por responsable"
          style={{ minWidth: '220px' }}
        />
      </div>

      <DataTable
        value={oportunidadesFiltradas}
        globalFilter={globalFilter}
        globalFilterFields={['titulo', 'empresaNombre', 'contactoPrincipal']}
        loading={loading}
        paginator rows={10} rowsPerPageOptions={[10, 25, 50]}
        emptyMessage="No hay oportunidades registradas"
        stripedRows
        filterDisplay="menu"
      >
        <Column field="titulo" header="Oportunidad" sortable filter filterPlaceholder="Buscar título..." style={{ minWidth: '190px' }} body={(r) => (
          <Button label={r.titulo} link className="p-0 text-left" style={{ fontWeight: 500 }} onClick={() => verDetalle(r)} />
        )} />
        <Column field="empresaNombre" header="Cliente" sortable filter filterPlaceholder="Buscar cliente..." style={{ minWidth: '160px' }} body={(r) => r.empresaNombre} />
        <Column field="contactoPrincipal" header="Contacto" filter filterPlaceholder="Buscar contacto..." body={(r) => {
          const c0 = r.contactos?.[0]
          if (!c0) return <span className="text-color-secondary">—</span>
          const cargoTelefono = [c0.cargo, c0.telefono].filter(Boolean).join(' - ')
          return (
            <div>
              <div className="text-sm">{c0.nombre}</div>
              {cargoTelefono && <div className="text-xs text-color-secondary">{cargoTelefono}</div>}
              {r.contactos.length > 1 && <div className="text-xs" style={{ color: 'var(--primary-color)', fontWeight: 600 }}>+{r.contactos.length - 1} más</div>}
            </div>
          )
        }} />
        <Column field="origen" header="Origen" sortable filter filterPlaceholder="Buscar origen..." body={(r) => r.origen || '—'} style={{ width: '120px' }} />
        <Column field="etapa" header="Etapa" sortable filter filterPlaceholder="Buscar etapa..." style={{ width: '190px' }} body={(r) => (
          <div>
            <EtapaTag etapa={r.etapa} />
            {r.propuesta && (
              <div className="text-xs mt-1" style={{ color: 'var(--green-600)' }}>
                <i className="pi pi-check-circle mr-1" />{r.propuesta.codigo} · {r.propuesta.estado}
              </div>
            )}
            {r.etapa === 'Perdida' && r.motivoPerdida && (
              <div className="text-xs text-color-secondary mt-1">Motivo: {r.motivoPerdida}</div>
            )}
          </div>
        )} />
        <Column field="valorEstimado" header="Valor est." sortable dataType="numeric" filter filterPlaceholder="Buscar valor..." style={{ textAlign: 'right', width: '140px' }}
          body={(r) => r.valorEstimado ? formatCurrency(r.valorEstimado) : '—'} />
        <Column field="responsableNombre" header="Responsable" sortable filter filterPlaceholder="Buscar responsable..." style={{ width: '160px' }} body={(r) => r.responsableNombre || '—'} />
        <Column header="Última actividad" body={(r) => <span className="text-sm text-color-secondary">{ultimaActividadLabel(r)}</span>} style={{ width: '140px' }} />
        <Column header="Acciones" style={{ width: '140px' }} body={(r) => (
          <div className="flex gap-1">
            <Button icon="pi pi-eye" rounded text severity="success" tooltip="Ver detalle" tooltipOptions={{ position: 'top' }} onClick={() => verDetalle(r)} />
            {r.etapa !== ETAPA_HOOK && puede(PERMISOS.OPORTUNIDADES.CAMBIAR_ETAPA) && (
              <Button icon="pi pi-arrow-right-arrow-left" rounded text severity="info" tooltip="Cambiar etapa" tooltipOptions={{ position: 'top' }} onClick={() => openEtapa(r)} />
            )}
            {!r.propuestaId && puede(PERMISOS.OPORTUNIDADES.EDITAR) && (
              <Button icon="pi pi-pencil" rounded text severity="info" tooltip="Editar" tooltipOptions={{ position: 'top' }} onClick={() => openEdit(r)} />
            )}
            {['Prospeccion', 'Solicitud_RFI', 'Entrega_RFI'].includes(r.etapa) && puede(PERMISOS.OPORTUNIDADES.ELIMINAR) && (
              <Button icon="pi pi-trash" rounded text severity="danger" tooltip="Eliminar" tooltipOptions={{ position: 'top' }} onClick={() => confirmDelete(r)} />
            )}
          </div>
        )} />
      </DataTable>

      <OportunidadFormDialog
        visible={dialogVisible}
        onHide={() => setDialogVisible(false)}
        onSave={handleSave}
        oportunidad={selected}
        empleados={empleados}
      />

      <CambiarEtapaOportunidadDialog
        visible={etapaDialogVisible}
        onHide={() => setEtapaDialogVisible(false)}
        onConfirm={handleCambiarEtapa}
        oportunidad={selected}
        saving={savingEtapa}
      />
    </div>
  )
}
