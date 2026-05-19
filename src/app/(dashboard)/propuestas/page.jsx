'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { Dropdown } from 'primereact/dropdown'
import { Tag } from 'primereact/tag'
import { Toast } from 'primereact/toast'
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog'
import { ProgressSpinner } from 'primereact/progressspinner'
import PropuestaFormDialog from '@/components/shared/PropuestaFormDialog'
import { propuestaService } from '@/services/propuestaService'
import { proyectoService } from '@/services/proyectoService'
import { empresaService } from '@/services/empresaService'
import { usuarioService } from '@/services/usuarioService'
import { configuracionService, buildPropuestaConfig } from '@/services/configuracionService'
import { formatCurrency, formatDate } from '@/utils/format'
import { usePermisos, PERMISOS } from '@/hooks/usePermisos'
import { Dialog } from 'primereact/dialog'
import { InputNumber } from 'primereact/inputnumber'
import { useSession } from 'next-auth/react'

import axios from 'axios'

const ESTADOS_LEGACY = ['Elaboracion_Propuesta', 'Rechazado']

export default function PropuestasPage() {
  const toast = useRef(null)
  const router = useRouter()
  const { puede } = usePermisos()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'admin'
  const [migrating, setMigrating] = useState(false)

  const [propuestas, setPropuestas] = useState([])
  const [proyectosLegacy, setProyectosLegacy] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [propuestaConfig, setPropuestaConfig] = useState({})
  const [loading, setLoading] = useState(true)
  const [globalFilter, setGlobalFilter] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState(null)
  const [dialogVisible, setDialogVisible] = useState(false)
  const [selected, setSelected] = useState(null)

  // Quick-edit dialog para propuestas históricas
  const [quickEditVisible, setQuickEditVisible] = useState(false)
  const [quickEditProyecto, setQuickEditProyecto] = useState(null)
  const [quickEditForm, setQuickEditForm] = useState({})
  const [quickEditLoading, setQuickEditLoading] = useState(false)
  const [estadosAll, setEstadosAll] = useState([])

  // Dialog de detalle (solo lectura)
  const [detalleVisible, setDetalleVisible] = useState(false)
  const [detalleProyecto, setDetalleProyecto] = useState(null)

  // Estados válidos para propuestas históricas
  const ESTADOS_PROPUESTA_VALIDOS = ['Prefactibilidad', 'Elaboracion_Propuesta', 'Adjudicado', 'Rechazado', 'Cerrado']

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [propRes, empRes, usrRes, cfgRes, proyRes, estRes] = await Promise.all([
        propuestaService.getAll(),
        empresaService.getAll(),
        usuarioService.getAll(),
        configuracionService.getAll(),
        proyectoService.getAll(),
        axios.get('/api/v1/estados'),
      ])
      setPropuestas(propRes.data)
      setEmpresas(empRes.data)
      setUsuarios(usrRes.data)
      setPropuestaConfig(buildPropuestaConfig(cfgRes.data.data.estadosPropuesta))
      setProyectosLegacy(proyRes.data.filter((p) => ESTADOS_LEGACY.includes(p.estado?.nombre)))
      setEstadosAll(estRes.data.data || [])
    } catch {
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las propuestas', life: 4000 })
    } finally {
      setLoading(false)
    }
  }

  const estadosFiltro = useMemo(() => [
    { label: 'Todos', value: null },
    ...Object.values(propuestaConfig).map((cfg) => ({ label: cfg.label, value: cfg.key })),
  ], [propuestaConfig])

  // Mapeo propuesta-estado (string) ↔ proyecto-estado (estadoId FK)
  // Al abrir: proyecto.estado.nombre → clave propuesta
  const MAPA_PROYECTO_A_PROPUESTA = {
    Elaboracion_Propuesta: 'Haciendo',
    Rechazado:             'Rechazada',
    Adjudicado:            'Aprobada',
  }
  // Al guardar: clave propuesta → nombre de estado en tabla `estados`
  const MAPA_PROPUESTA_A_PROYECTO = {
    Factibilidad: 'Elaboracion_Propuesta',
    Haciendo:     'Elaboracion_Propuesta',
    Enviada:      'Elaboracion_Propuesta',
    Aprobada:     'Adjudicado',
    Rechazada:    'Rechazado',
  }

  const openQuickEdit = (p) => {
    setQuickEditProyecto(p)
    setQuickEditForm({
      detalle:         p.detalle || '',
      valor:           Number(p.valor) || 0,
      aplicativo:      p.aplicativo || '',
      ot:              p.ot || '',
      // Si ya tiene estadoPropuesta guardado usarlo; sino inferir del estado de proyecto
      estadoPropuesta: p.estadoPropuesta || MAPA_PROYECTO_A_PROPUESTA[p.estado?.nombre] || 'Haciendo',
    })
    setQuickEditVisible(true)
  }

  const handleQuickEditSave = async () => {
    if (!quickEditForm.estadoPropuesta) {
      toast.current.show({ severity: 'warn', summary: 'Atención', detail: 'Selecciona un estado', life: 3000 })
      return
    }
    // Resolver estadoId buscando el nombre correspondiente en estadosAll
    const nombreEstadoProyecto = MAPA_PROPUESTA_A_PROYECTO[quickEditForm.estadoPropuesta] || 'Elaboracion_Propuesta'
    const estadoTarget = estadosAll.find((e) => e.nombre === nombreEstadoProyecto)
    if (!estadoTarget) {
      toast.current.show({ severity: 'error', summary: 'Error', detail: `Estado "${nombreEstadoProyecto}" no encontrado en el sistema`, life: 4000 })
      return
    }
    setQuickEditLoading(true)
    try {
      await proyectoService.update(quickEditProyecto.id, {
        detalle:          quickEditForm.detalle,
        empresaId:        quickEditProyecto.empresaId,
        valor:            quickEditForm.valor,
        fechaCreacion:    quickEditProyecto.fechaCreacion?.split('T')[0] || quickEditProyecto.fechaCreacion,
        fechaCierre:      quickEditProyecto.fechaCierre ? (quickEditProyecto.fechaCierre?.split('T')[0] || quickEditProyecto.fechaCierre) : null,
        estadoId:         estadoTarget.id,
        estadoPropuesta:  quickEditForm.estadoPropuesta,
        aplicativo:       quickEditForm.aplicativo,
        ot:               quickEditForm.ot,
        clienteIds:       quickEditProyecto.clientes?.map((c) => c.clienteId) || [],
        responsableIds:   quickEditProyecto.responsables?.map((r) => r.userId) || [],
      })
      const msg = quickEditForm.estadoPropuesta === 'Aprobada'
        ? 'Propuesta aprobada — pasó al módulo de Proyectos como Adjudicado'
        : 'Propuesta actualizada'
      toast.current.show({ severity: 'success', summary: 'Guardado', detail: msg, life: 4000 })
      setQuickEditVisible(false)
      loadAll()
    } catch (err) {
      toast.current.show({ severity: 'error', summary: 'Error', detail: err.response?.data?.message || 'Error al guardar', life: 4000 })
    } finally {
      setQuickEditLoading(false)
    }
  }

  const ESTADOS_TERMINALES = ['Aprobada', 'Rechazada']

  const propuestasFiltradas = useMemo(() => {
    if (estadoFiltro) return propuestas.filter((p) => p.estado === estadoFiltro)
    return propuestas
  }, [propuestas, estadoFiltro])

  const openCreate = () => { setSelected(null); setDialogVisible(true) }
  const openEdit   = (p) => { setSelected(p);    setDialogVisible(true) }

  const handleSave = () => {
    setDialogVisible(false)
    toast.current.show({ severity: 'success', summary: 'Éxito', detail: selected ? 'Propuesta actualizada' : 'Propuesta creada', life: 3000 })
    loadAll()
  }

  const confirmDelete = (p) => {
    const bloqueado = !['Factibilidad', 'Haciendo'].includes(p.estado)
    if (bloqueado) {
      const cfg = propuestaConfig[p.estado]
      toast.current.show({ severity: 'warn', summary: 'No permitido', detail: 'No se puede eliminar una propuesta en estado "' + (cfg?.label || p.estado) + '"', life: 4000 })
      return
    }
    confirmDialog({
      message: '¿Eliminar la propuesta "' + p.titulo + '"?',
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptClassName: 'p-button-danger',
      accept: async () => {
        try {
          await propuestaService.remove(p.id)
          toast.current.show({ severity: 'success', summary: 'Éxito', detail: 'Propuesta eliminada', life: 3000 })
          loadAll()
        } catch (err) {
          toast.current.show({ severity: 'error', summary: 'Error', detail: err.response?.data?.message || 'Error al eliminar', life: 4000 })
        }
      },
    })
  }

  if (loading && propuestas.length === 0) {
    return <div className="flex justify-content-center align-items-center" style={{ height: '60vh' }}><ProgressSpinner /></div>
  }

  // Colores de severidad de PrimeReact → estilo inline para chips
  const SEVERITY_CHIP = {
    warning:   { bg: '#fef9c3', color: '#ca8a04', border: '#fde047' },
    info:      { bg: '#dbeafe', color: '#2563eb', border: '#93c5fd' },
    secondary: { bg: '#ede9fe', color: '#7c3aed', border: '#c4b5fd' },
    success:   { bg: '#dcfce7', color: '#16a34a', border: '#86efac' },
    danger:    { bg: '#fee2e2', color: '#dc2626', border: '#fca5a5' },
  }

  // KPI chips — usa labels de propuestaConfig para mostrar nombres visibles correctos
  const kpiConteo = (() => {
    const conteo = {}
    propuestas.forEach((p) => {
      const k = p.estado || 'Sin estado'
      conteo[k] = (conteo[k] || 0) + 1
    })
    proyectosLegacy.forEach((p) => {
      const k = p.estado?.nombre || 'Sin estado'
      conteo[k] = (conteo[k] || 0) + 1
    })
    return Object.entries(conteo)
      .map(([estado, count]) => {
        const cfg = propuestaConfig[estado]
        const colors = cfg ? (SEVERITY_CHIP[cfg.severity] || SEVERITY_CHIP.info) : { bg: '#f3f4f6', color: '#6b7280', border: '#d1d5db' }
        return { estado, count, label: cfg?.label || estado, colors }
      })
      .sort((a, b) => b.count - a.count)
  })()

  const totalPropuestas = propuestas.length + proyectosLegacy.length

  return (
    <div className="p-4">
      <Toast ref={toast} />
      <ConfirmDialog />

      <div className="flex align-items-center gap-3 mb-4 flex-wrap">
        <h1 className="text-2xl font-bold m-0 mr-2">Propuestas</h1>

        {/* KPI chips */}
        <div className="flex align-items-center gap-2 flex-1 flex-wrap">
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '0 12px', height: '36px', borderRadius: '18px',
            background: '#f3f4f6', border: '1px solid #d1d5db',
            fontSize: '0.8rem', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap',
          }}>
            <i className="pi pi-send" style={{ fontSize: '0.75rem' }} />
            {totalPropuestas} total
          </span>
          {kpiConteo.map(({ estado, count, label, colors }) => (
            <span key={estado} style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              padding: '0 12px', height: '36px', borderRadius: '18px',
              background: colors.bg, border: `1px solid ${colors.border}`,
              fontSize: '0.8rem', fontWeight: 600, color: colors.color, whiteSpace: 'nowrap',
            }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: colors.color, flexShrink: 0 }} />
              {count} {label}
            </span>
          ))}
        </div>

        {puede(PERMISOS.PROPUESTAS.CREAR) && (
          <Button label="Nueva Propuesta" icon="pi pi-plus" onClick={openCreate} />
        )}
      </div>

      <div className="flex flex-wrap gap-3 mb-3">
        <span className="p-input-icon-left flex-1" style={{ minWidth: '200px' }}>
          <i className="pi pi-search" />
          <InputText value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} placeholder="Buscar propuesta..." className="w-full" />
        </span>
        <Dropdown
          value={estadoFiltro}
          options={estadosFiltro}
          optionLabel="label"
          optionValue="value"
          onChange={(e) => setEstadoFiltro(e.value)}
          placeholder="Filtrar por estado"
          showClear
          style={{ minWidth: '200px' }}
        />
      </div>

      <DataTable
        value={propuestasFiltradas}
        globalFilter={globalFilter}
        loading={loading}
        paginator rows={10} rowsPerPageOptions={[10, 25, 50]}
        emptyMessage="No hay propuestas registradas"
        stripedRows
        filterDisplay="menu"
      >
        <Column field="codigo" header="Código" body={(r) => r.codigo || '—'} sortable filter filterPlaceholder="Buscar código..." style={{ width: '130px', fontFamily: 'monospace', fontSize: '0.85rem' }} />
        <Column field="tipoPropuesta" header="Tipo" style={{ width: '130px' }} sortable filter filterPlaceholder="Buscar tipo..."
          body={(r) => (
            <Tag
              value={r.tipoPropuesta === 'Mensualizada' ? '📅 Mensualizada' : '⏱ Por Horas'}
              severity={r.tipoPropuesta === 'Mensualizada' ? 'info' : 'secondary'}
              style={{ fontSize: '0.75rem' }}
            />
          )}
        />
        <Column field="titulo" header="Título" sortable filter filterPlaceholder="Buscar título..." style={{ minWidth: '200px' }} body={(r) => (
          <Button label={r.titulo} link className="p-0 text-left" style={{ fontWeight: 500 }}
            onClick={() => router.push('/propuestas/' + r.id)} />
        )} />
        <Column field="empresa.nombre" header="Empresa" body={(r) => r.empresa?.nombre} sortable filter filterPlaceholder="Buscar empresa..." />
        <Column field="aplicativo" header="Aplicativo" body={(r) => r.aplicativo || '—'} sortable filter filterPlaceholder="Buscar aplicativo..." style={{ width: '120px' }} />
        <Column header="Valor est." sortable sortField="valorEstimado" dataType="numeric" style={{ textAlign: 'right', width: '130px' }}
          body={(r) => r.valorEstimado ? formatCurrency(r.valorEstimado) : '—'} />
        <Column field="estado" header="Estado" sortable filter filterPlaceholder="Buscar estado..." style={{ width: '180px' }} body={(r) => {
          const cfg = propuestaConfig[r.estado] || { severity: 'secondary', label: r.estado }
          return <Tag value={cfg.label} severity={cfg.severity} />
        }} />
        <Column header="Responsables" body={(r) => (
          <span className="text-sm text-color-secondary">
            {r.responsables?.map((res) => res.user?.name).join(', ') || '—'}
          </span>
        )} />
        <Column header="Creada" sortable sortField="fechaCreacion" style={{ width: '110px' }} body={(r) => formatDate(r.fechaCreacion)} />
        <Column header="Acciones" style={{ width: '120px' }} body={(r) => (
          <div className="flex gap-1">
            <Button icon="pi pi-eye" rounded text severity="success" tooltip="Ver detalle" tooltipOptions={{ position: 'top' }}
              onClick={() => router.push('/propuestas/' + r.id)} />
            {puede(PERMISOS.PROPUESTAS.EDITAR) && (
              <Button icon="pi pi-pencil" rounded text severity="info" tooltip="Editar" tooltipOptions={{ position: 'top' }}
                onClick={() => openEdit(r)} disabled={['Aprobada', 'Rechazada'].includes(r.estado)} />
            )}
            {puede(PERMISOS.PROPUESTAS.ELIMINAR) && (
              <Button icon="pi pi-trash" rounded text severity="danger" tooltip="Eliminar" tooltipOptions={{ position: 'top' }}
                onClick={() => confirmDelete(r)} disabled={!['Factibilidad', 'Haciendo'].includes(r.estado)} />
            )}
          </div>
        )} />
      </DataTable>

      {proyectosLegacy.length > 0 && (
        <div className="mt-5">
          <div className="flex align-items-center justify-content-between mb-3">
            <div>
              <h2 className="text-xl font-semibold m-0">Propuestas históricas</h2>
              <p className="text-color-secondary text-sm mt-1 mb-0">
                {proyectosLegacy.length} registro(s) de PowerApps pendientes de migrar a propuestas
              </p>
            </div>
            {isAdmin && (
              <Button
                label={`Migrar ${proyectosLegacy.length} propuestas al módulo`}
                icon="pi pi-sync"
                severity="warning"
                loading={migrating}
                tooltip="Mueve estos registros de la tabla de Proyectos a Propuestas (ejecutar una vez)"
                tooltipOptions={{ position: 'left' }}
                onClick={async () => {
                  setMigrating(true)
                  try {
                    const res = await axios.post('/api/v1/admin/migrar-propuestas-legacy')
                    const { migrados: mig, omitidos: om, errores: err, detalle } = res.data.data
                    // Mostrar resumen
                    toast.current.show({
                      severity: err > 0 ? 'warn' : 'success',
                      summary: 'Migración completada',
                      detail: `✓ ${mig} migradas · ${om} omitidas · ${err} errores`,
                      life: 5000,
                    })
                    // Mostrar omitidos con su razón
                    if (detalle.omitidos?.length > 0) {
                      setTimeout(() => {
                        detalle.omitidos.forEach((o) => {
                          toast.current.show({
                            severity: 'warn',
                            summary: `Omitida: ${o.detalle}`,
                            detail: `Razón: ${o.razon}`,
                            life: 12000,
                          })
                        })
                      }, 500)
                    }
                    loadAll()
                  } catch (err) {
                    toast.current.show({ severity: 'error', summary: 'Error', detail: err.response?.data?.message || 'Error en migración', life: 5000 })
                  } finally {
                    setMigrating(false)
                  }
                }}
              />
            )}
          </div>

          {/* Aviso explicativo */}
          <div className="p-3 border-round mb-3" style={{ background: '#fefce8', border: '1px solid #fde047' }}>
            <div className="flex align-items-start gap-2">
              <i className="pi pi-info-circle text-yellow-600 mt-1" />
              <div className="text-sm text-yellow-800">
                <strong>¿Por qué están aquí?</strong> Estos registros fueron importados desde PowerApps directamente como "proyectos"
                porque la tabla de propuestas aún no existía. El botón de arriba los mueve al lugar correcto:
                aparecerán en la tabla principal de propuestas con todos sus datos y podrás gestionarlos normalmente.
              </div>
            </div>
          </div>

          <DataTable
            value={proyectosLegacy}
            paginator rows={15} rowsPerPageOptions={[15, 50, 100]}
            emptyMessage="Sin datos"
            stripedRows
            filterDisplay="menu"
          >
            <Column field="codigo" header="Código" body={(r) => r.codigo || '—'} sortable style={{ width: '130px', fontFamily: 'monospace', fontSize: '0.85rem' }} />
            <Column field="detalle" header="Propuesta" sortable body={(r) => (
              <span className="font-medium">{r.detalle}</span>
            )} style={{ minWidth: '200px' }} />
            <Column field="empresa.nombre" header="Empresa" body={(r) => r.empresa?.nombre} sortable />
            <Column field="aplicativo" header="Aplicativo" body={(r) => r.aplicativo || '—'} sortable style={{ width: '120px' }} />
            <Column field="valor" header="Valor" sortable dataType="numeric" style={{ textAlign: 'right', width: '130px' }}
              body={(r) => r.valor ? formatCurrency(r.valor) : '—'} />
            <Column header="Estado actual" style={{ width: '190px' }} body={(r) => (
              <Tag
                value={r.estado?.nombre === 'Elaboracion_Propuesta' ? 'Elab. Propuesta' : r.estado?.nombre}
                severity={r.estado?.nombre === 'Rechazado' ? 'danger' : 'info'}
              />
            )} />
            <Column field="fechaCreacion" header="Fecha" sortable style={{ width: '110px' }} body={(r) => formatDate(r.fechaCreacion)} />
            <Column header="" style={{ width: '60px' }} body={(r) => (
              <Button
                icon="pi pi-external-link"
                rounded text severity="secondary"
                tooltip="Ver detalle del proyecto"
                tooltipOptions={{ position: 'top' }}
                onClick={() => router.push('/proyectos/' + r.id)}
              />
            )} />
          </DataTable>
        </div>
      )}

      <PropuestaFormDialog
        visible={dialogVisible}
        onHide={() => setDialogVisible(false)}
        onSave={handleSave}
        propuesta={selected}
        empresas={empresas}
        usuarios={usuarios}
        propuestaConfig={propuestaConfig}
      />

      {/* ── Detalle (solo lectura) para propuestas históricas ───────────── */}
      <Dialog
        visible={detalleVisible}
        onHide={() => setDetalleVisible(false)}
        header={
          <div>
            <div className="font-bold text-lg">{detalleProyecto?.detalle}</div>
            <div className="text-sm text-color-secondary font-normal mt-1">{detalleProyecto?.empresa?.nombre}</div>
          </div>
        }
        style={{ width: '560px' }}
        modal
        footer={
          <div className="flex justify-content-between align-items-center">
            <Button label="Ir al proyecto" icon="pi pi-external-link" severity="secondary" text
              onClick={() => router.push('/proyectos/' + detalleProyecto?.id)} />
            <Button label="Cerrar" icon="pi pi-times" onClick={() => setDetalleVisible(false)} />
          </div>
        }
      >
        {detalleProyecto && (
          <div className="flex flex-column gap-3 pt-2">
            <div className="grid">
              <div className="col-6">
                <div className="text-xs text-color-secondary font-semibold uppercase mb-1">Código</div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{detalleProyecto.codigo || '—'}</div>
              </div>
              <div className="col-6">
                <div className="text-xs text-color-secondary font-semibold uppercase mb-1">Estado</div>
                <Tag
                  value={detalleProyecto.estado?.nombre === 'Elaboracion_Propuesta' ? 'Elab. Propuesta' : detalleProyecto.estado?.nombre}
                  severity={detalleProyecto.estado?.nombre === 'Rechazado' ? 'danger' : 'info'}
                />
              </div>
            </div>
            <div className="grid">
              <div className="col-6">
                <div className="text-xs text-color-secondary font-semibold uppercase mb-1">Valor estimado</div>
                <div className="font-semibold">{detalleProyecto.valor ? formatCurrency(detalleProyecto.valor) : '—'}</div>
              </div>
              <div className="col-6">
                <div className="text-xs text-color-secondary font-semibold uppercase mb-1">Aplicativo</div>
                <div>{detalleProyecto.aplicativo || '—'}</div>
              </div>
            </div>
            <div className="grid">
              <div className="col-6">
                <div className="text-xs text-color-secondary font-semibold uppercase mb-1">OT</div>
                <div style={{ fontFamily: 'monospace' }}>{detalleProyecto.ot || '—'}</div>
              </div>
              <div className="col-6">
                <div className="text-xs text-color-secondary font-semibold uppercase mb-1">Fecha</div>
                <div>{formatDate(detalleProyecto.fechaCreacion)}</div>
              </div>
            </div>
            {detalleProyecto.clientes?.length > 0 && (
              <div>
                <div className="text-xs text-color-secondary font-semibold uppercase mb-1">Contactos</div>
                <div className="text-sm">{detalleProyecto.clientes.map((c) => `${c.cliente?.nombre || ''} ${c.cliente?.apellido || ''}`).join(', ')}</div>
              </div>
            )}
            {detalleProyecto.responsables?.length > 0 && (
              <div>
                <div className="text-xs text-color-secondary font-semibold uppercase mb-1">Responsables Proconty</div>
                <div className="text-sm">{detalleProyecto.responsables.map((r) => r.user?.name).join(', ')}</div>
              </div>
            )}
          </div>
        )}
      </Dialog>

      {/* ── Quick-edit dialog para propuestas históricas ─────────────────── */}
      <Dialog
        visible={quickEditVisible}
        onHide={() => setQuickEditVisible(false)}
        header={
          <div>
            <div className="font-bold text-lg">{quickEditProyecto?.empresa?.nombre}</div>
            <div className="text-sm text-color-secondary font-normal mt-1" style={{ maxWidth: '480px' }}>
              {quickEditProyecto?.detalle}
            </div>
          </div>
        }
        style={{ width: '540px' }}
        modal
        footer={
          <div className="flex justify-content-end gap-2">
            <Button label="Cancelar" icon="pi pi-times" severity="secondary" outlined onClick={() => setQuickEditVisible(false)} disabled={quickEditLoading} />
            <Button label="Guardar cambios" icon="pi pi-check" onClick={handleQuickEditSave} loading={quickEditLoading} />
          </div>
        }
      >
        <div className="flex flex-column gap-4 pt-2">

          {/* Estado — campo principal */}
          <div className="field mb-0">
            <label className="font-semibold block mb-2">
              Estado <span className="text-red-500">*</span>
            </label>
            <Dropdown
              value={quickEditForm.estadoPropuesta}
              options={Object.values(propuestaConfig).map((cfg) => ({ label: cfg.label, value: cfg.key }))}
              optionLabel="label"
              optionValue="value"
              onChange={(e) => setQuickEditForm({ ...quickEditForm, estadoPropuesta: e.value })}
              placeholder="Seleccionar estado"
              className="w-full"
              itemTemplate={(opt) => {
                const cfg = propuestaConfig[opt.value]
                return cfg ? (
                  <span className={`p-tag p-tag-${cfg.severity}`} style={{ fontSize: '0.8rem' }}>{cfg.label}</span>
                ) : opt.label
              }}
            />
            {quickEditForm.estadoPropuesta === 'Aprobada' && (
              <small className="text-orange-500 mt-1 block">
                <i className="pi pi-exclamation-triangle mr-1" />
                Al guardar, esta propuesta pasará al módulo de Proyectos como <strong>Adjudicado</strong> y desaparecerá de aquí.
              </small>
            )}
          </div>

          {/* Nombre del proyecto */}
          <div className="field mb-0">
            <label className="font-semibold block mb-2">Nombre del proyecto</label>
            <InputText
              value={quickEditForm.detalle || ''}
              onChange={(e) => setQuickEditForm({ ...quickEditForm, detalle: e.target.value })}
              className="w-full"
            />
          </div>

          {/* Valor + Aplicativo en fila */}
          <div className="grid">
            <div className="col-6 field mb-0">
              <label className="font-semibold block mb-2">Valor</label>
              <InputNumber
                value={quickEditForm.valor}
                onValueChange={(e) => setQuickEditForm({ ...quickEditForm, valor: e.value || 0 })}
                mode="currency" currency="USD" locale="es-EC"
                className="w-full"
              />
            </div>
            <div className="col-6 field mb-0">
              <label className="font-semibold block mb-2">Aplicativo</label>
              <InputText
                value={quickEditForm.aplicativo || ''}
                onChange={(e) => setQuickEditForm({ ...quickEditForm, aplicativo: e.target.value })}
                className="w-full"
                placeholder="ej: CRV, TIPS"
              />
            </div>
          </div>

          {/* OT */}
          <div className="field mb-0">
            <label className="font-semibold block mb-2">OT (Orden de Trabajo)</label>
            <InputText
              value={quickEditForm.ot || ''}
              onChange={(e) => setQuickEditForm({ ...quickEditForm, ot: e.target.value })}
              className="w-full"
              placeholder="ej: 35689 (opcional)"
            />
          </div>

        </div>
      </Dialog>
    </div>
  )
}
