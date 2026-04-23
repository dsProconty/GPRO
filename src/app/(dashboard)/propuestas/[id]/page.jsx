'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from 'primereact/card'
import { Button } from 'primereact/button'
import { Tag } from 'primereact/tag'
import { Toast } from 'primereact/toast'
import { ProgressSpinner } from 'primereact/progressspinner'
import { Dialog } from 'primereact/dialog'
import { Dropdown } from 'primereact/dropdown'
import { InputNumber } from 'primereact/inputnumber'
import { ProgressBar } from 'primereact/progressbar'
import { propuestaService } from '@/services/propuestaService'
import { empresaService } from '@/services/empresaService'
import { usuarioService } from '@/services/usuarioService'
import { empleadoService } from '@/services/empleadoService'
import { configuracionService, buildPropuestaConfig } from '@/services/configuracionService'
import { perfilConsultorService } from '@/services/perfilConsultorService'
import { formatCurrency, formatDate } from '@/utils/format'
import PropuestaFormDialog from '@/components/shared/PropuestaFormDialog'
import CambiarEstadoPropuestaDialog from '@/components/shared/CambiarEstadoPropuestaDialog'
import { usePermisos, PERMISOS } from '@/hooks/usePermisos'

// Transiciones permitidas (claves internas — nunca cambian)
const TRANSICIONES_KEYS = {
  Factibilidad: [{ estado: 'Haciendo',  icon: 'pi-arrow-right', severity: 'info'      }],
  Haciendo:     [
    { estado: 'Factibilidad', icon: 'pi-arrow-left',   severity: 'warning'   },
    { estado: 'Enviada',      icon: 'pi-send',          severity: 'secondary' },
  ],
  Enviada:      [
    { estado: 'Aprobada',  icon: 'pi-check-circle', severity: 'success' },
    { estado: 'Rechazada', icon: 'pi-times-circle', severity: 'danger'  },
  ],
  Aprobada:  [],
  Rechazada: [],
}

const DIALOG_VACIO = { visible: false, saving: false, perfilId: null, horas: null, empleadoId: null, precioHora: null, editando: false }

export default function PropuestaDetallePage({ params }) {
  const toast = useRef(null)
  const router = useRouter()
  const { puede } = usePermisos()
  const id = parseInt(params.id)

  const [propuesta, setPropuesta] = useState(null)
  const [empresas, setEmpresas] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [propuestaConfig, setPropuestaConfig] = useState({})
  const [loading, setLoading] = useState(true)

  // Caso de negocio
  const [casoLineas, setCasoLineas] = useState([])
  const [casoResumen, setCasoResumen] = useState(null)
  const [casoTarifario, setCasoTarifario] = useState(null)
  const [perfilesActivos, setPerfilesActivos] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [casoDialog, setCasoDialog] = useState(DIALOG_VACIO)
  const [cargandoTarifario, setCargandoTarifario] = useState(false)

  const [editDialogVisible, setEditDialogVisible] = useState(false)
  const [estadoDialog, setEstadoDialog] = useState({ visible: false, estadoDestino: null, saving: false })

  useEffect(() => { loadAll() }, [id])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [propRes, empRes, usrRes, cfgRes, casoRes, pfRes, emplRes] = await Promise.all([
        propuestaService.getById(id),
        empresaService.getAll(),
        usuarioService.getAll(),
        configuracionService.getAll(),
        propuestaService.getCasoNegocio(id),
        perfilConsultorService.getAll({ activo: true }),
        empleadoService.getAll({ activo: true }),
      ])
      setPropuesta(propRes.data)
      setEmpresas(empRes.data)
      setUsuarios(usrRes.data)
      setPropuestaConfig(buildPropuestaConfig(cfgRes.data.data.estadosPropuesta))
      setCasoLineas(casoRes.data.lineas)
      setCasoResumen(casoRes.data.resumen)
      setCasoTarifario(casoRes.data.tarifario)
      setPerfilesActivos(pfRes.data.data)
      setEmpleados(emplRes.data.data || [])
    } catch {
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la propuesta', life: 4000 })
    } finally {
      setLoading(false)
    }
  }

  const loadCaso = async () => {
    try {
      const res = await propuestaService.getCasoNegocio(id)
      setCasoLineas(res.data.lineas)
      setCasoResumen(res.data.resumen)
      setCasoTarifario(res.data.tarifario)
    } catch {}
  }

  const abrirNuevaLinea = () => {
    setCasoDialog({ ...DIALOG_VACIO, visible: true })
  }

  const abrirEditarLinea = (linea) => {
    setCasoDialog({
      visible: true,
      saving: false,
      editando: true,
      perfilId: linea.perfilId,
      horas: linea.horas,
      empleadoId: linea.empleadoId || null,
      precioHora: linea.precioHora || null,
    })
  }

  const handleSaveLinea = async () => {
    if (!casoDialog.perfilId || !casoDialog.horas || casoDialog.horas <= 0) return
    setCasoDialog((p) => ({ ...p, saving: true }))
    try {
      await propuestaService.upsertLineaCaso(id, {
        perfilId:   casoDialog.perfilId,
        horas:      casoDialog.horas,
        empleadoId: casoDialog.empleadoId || null,
        precioHora: casoDialog.precioHora ?? null,
      })
      setCasoDialog(DIALOG_VACIO)
      toast.current.show({ severity: 'success', summary: 'Guardado', detail: 'Línea guardada en el caso de negocio', life: 3000 })
      loadCaso()
    } catch (err) {
      setCasoDialog((p) => ({ ...p, saving: false }))
      toast.current.show({ severity: 'error', summary: 'Error', detail: err.response?.data?.message || 'Error al guardar', life: 4000 })
    }
  }

  const handleDeleteLinea = async (perfilId) => {
    try {
      await propuestaService.deleteLineaCaso(id, perfilId)
      toast.current.show({ severity: 'success', summary: 'Eliminado', detail: 'Línea eliminada', life: 3000 })
      loadCaso()
    } catch (err) {
      toast.current.show({ severity: 'error', summary: 'Error', detail: err.response?.data?.message || 'Error al eliminar', life: 4000 })
    }
  }

  const handleCargarTarifario = async () => {
    setCargandoTarifario(true)
    try {
      await propuestaService.cargarTarifario(id)
      toast.current.show({ severity: 'success', summary: 'Tarifario cargado', detail: `Líneas precargadas desde "${casoTarifario.nombre}"`, life: 4000 })
      loadCaso()
    } catch (err) {
      toast.current.show({ severity: 'error', summary: 'Error', detail: err.response?.data?.message || 'Error al cargar tarifario', life: 4000 })
    } finally {
      setCargandoTarifario(false)
    }
  }

  const handleAplicarValor = async () => {
    if (!casoResumen?.totalPrecio) return
    try {
      await propuestaService.update(id, {
        titulo:         propuesta.titulo,
        empresaId:      propuesta.empresaId,
        fechaCreacion:  propuesta.fechaCreacion,
        valorEstimado:  casoResumen.totalPrecio,
        responsableIds: propuesta.responsables?.map((r) => r.userId) || [],
      })
      toast.current.show({ severity: 'success', summary: 'Aplicado', detail: `Valor estimado actualizado a ${formatCurrency(casoResumen.totalPrecio)}`, life: 3000 })
      loadAll()
    } catch {
      toast.current.show({ severity: 'error', summary: 'Error', detail: 'No se pudo actualizar el valor', life: 4000 })
    }
  }

  const abrirCambioEstado = (estadoDestino) => {
    setEstadoDialog({ visible: true, estadoDestino, saving: false })
  }

  const confirmarCambioEstado = async (nota) => {
    setEstadoDialog((prev) => ({ ...prev, saving: true }))
    try {
      const res = await propuestaService.cambiarEstado(id, { estadoNuevo: estadoDialog.estadoDestino, nota })
      setPropuesta(res.data)
      setEstadoDialog({ visible: false, estadoDestino: null, saving: false })

      if (res.proyectoCreado) {
        const labelAprobada = propuestaConfig['Aprobada']?.label || 'Aprobada'
        toast.current.show({
          severity: 'success',
          summary: 'Propuesta ' + labelAprobada + '!',
          detail: 'Proyecto "' + res.proyectoCreado.detalle + '" creado automáticamente.',
          life: 6000,
        })
      } else {
        const labelDestino = propuestaConfig[estadoDialog.estadoDestino]?.label || estadoDialog.estadoDestino
        toast.current.show({ severity: 'success', summary: 'Estado actualizado', detail: 'Propuesta movida a ' + labelDestino, life: 3000 })
      }
    } catch (err) {
      setEstadoDialog((prev) => ({ ...prev, saving: false }))
      toast.current.show({ severity: 'error', summary: 'Error', detail: err.response?.data?.message || 'Error al cambiar estado', life: 4000 })
    }
  }

  if (loading) return (
    <div className="flex justify-content-center align-items-center" style={{ height: '60vh' }}>
      <ProgressSpinner />
    </div>
  )

  if (!propuesta) return (
    <div className="p-4">
      <Button label="Volver" icon="pi pi-arrow-left" severity="secondary" text onClick={() => router.push('/propuestas')} />
      <p className="mt-3 text-color-secondary">Propuesta no encontrada.</p>
    </div>
  )

  const cfg = propuestaConfig[propuesta.estado] || { severity: 'secondary', label: propuesta.estado, color: '#6b7280', icon: 'pi-circle' }
  const esTerminal = ['Aprobada', 'Rechazada'].includes(propuesta.estado)

  const transicionesUI = (TRANSICIONES_KEYS[propuesta.estado] || []).map((t) => ({
    ...t,
    label: propuestaConfig[t.estado]
      ? 'Mover a: ' + propuestaConfig[t.estado].label
      : t.estado,
  }))

  // ── Dialog helpers ───────────────────────────────────────────────────────────
  const perfilesUsados = new Set(casoLineas.map((l) => l.perfilId))
  const perfilesOptions = [
    ...perfilesActivos
      .filter((p) => !perfilesUsados.has(p.id) || p.id === casoDialog.perfilId)
      .map((p) => ({
        label: `${p.nombre} · ${p.nivel}`,
        value: p.id,
      })),
    ...casoLineas
      .filter((l) => !perfilesActivos.find((p) => p.id === l.perfilId))
      .map((l) => ({ label: `${l.perfil.nombre} · ${l.perfil.nivel}  [ya en uso]`, value: l.perfilId })),
  ]

  const empleadosOptions = empleados.map((e) => ({
    label: `${e.nombre} ${e.apellido}${e.perfilBase ? ' · ' + e.perfilBase.nombre : ''}`,
    value: e.id,
  }))

  const perfilSel = perfilesActivos.find((p) => p.id === casoDialog.perfilId)
  const empleadoSel = empleados.find((e) => e.id === casoDialog.empleadoId)
  const costoHoraEfectivo = empleadoSel ? Number(empleadoSel.costoHora) : (perfilSel ? Number(perfilSel.costoHora) : null)
  const precioHoraEfectivo = casoDialog.precioHora ?? (perfilSel ? Number(perfilSel.precioHora) : null)
  const previewCosto  = costoHoraEfectivo  !== null && casoDialog.horas ? casoDialog.horas * costoHoraEfectivo  : null
  const previewPrecio = precioHoraEfectivo !== null && casoDialog.horas ? casoDialog.horas * precioHoraEfectivo : null

  const dialogFooter = (
    <div className="flex justify-content-end gap-2">
      <Button label="Cancelar" icon="pi pi-times" severity="secondary" outlined
        onClick={() => setCasoDialog(DIALOG_VACIO)}
        disabled={casoDialog.saving} />
      <Button label="Guardar" icon="pi pi-check" onClick={handleSaveLinea}
        loading={casoDialog.saving}
        disabled={!casoDialog.perfilId || !casoDialog.horas || casoDialog.horas <= 0} />
    </div>
  )

  return (
    <div className="p-4">
      <Toast ref={toast} />

      {/* Breadcrumb */}
      <div className="flex justify-content-between align-items-center mb-4">
        <div className="flex align-items-center gap-2">
          <Button label="Propuestas" icon="pi pi-arrow-left" severity="secondary" text onClick={() => router.push('/propuestas')} />
          <i className="pi pi-angle-right text-color-secondary" />
          <span className="text-900 font-semibold">{propuesta.titulo}</span>
        </div>
        {!esTerminal && puede(PERMISOS.PROPUESTAS.EDITAR) && (
          <Button label="Editar" icon="pi pi-pencil" severity="info" outlined onClick={() => setEditDialogVisible(true)} />
        )}
      </div>

      <div className="grid">
        {/* Col principal */}
        <div className="col-12 lg:col-8">

          {/* Info + Estado */}
          <Card className="mb-3">
            <div className="flex align-items-start justify-content-between mb-3">
              <div>
                <h2 className="text-2xl font-bold m-0 mb-2">{propuesta.titulo}</h2>
                <div className="flex align-items-center gap-2 flex-wrap">
                  <Tag value={cfg.label} severity={cfg.severity} style={{ fontSize: '0.95rem', padding: '4px 12px' }} />
                  <span className="text-color-secondary text-sm"><i className="pi pi-building mr-1" />{propuesta.empresa?.nombre}</span>
                </div>
              </div>
            </div>

            {/* Botones de transición */}
            {transicionesUI.length > 0 && puede(PERMISOS.PROPUESTAS.CAMBIAR_ESTADO) && (
              <div className="flex flex-wrap gap-2 mb-3 p-3 surface-50 border-round">
                <span className="text-sm font-semibold text-color-secondary align-self-center mr-1">Cambiar a:</span>
                {transicionesUI.map((t) => (
                  <Button
                    key={t.estado}
                    label={t.label}
                    icon={'pi ' + t.icon}
                    severity={t.severity}
                    outlined={t.estado !== 'Aprobada' && t.estado !== 'Rechazada'}
                    size="small"
                    onClick={() => abrirCambioEstado(t.estado)}
                  />
                ))}
              </div>
            )}

            {/* Info general */}
            <div className="grid text-sm">
              <div className="col-6"><span className="text-color-secondary">Fecha de inicio:</span> <strong>{formatDate(propuesta.fechaCreacion)}</strong></div>
              <div className="col-6"><span className="text-color-secondary">Fecha de envío:</span> <strong>{formatDate(propuesta.fechaEnvio)}</strong></div>
              {propuesta.aplicativo && (
                <div className="col-12 mt-1">
                  <span className="text-color-secondary">Aplicativo:</span> <strong>{propuesta.aplicativo}</strong>
                </div>
              )}
              {propuesta.descripcion && (
                <div className="col-12 mt-2">
                  <span className="text-color-secondary">Descripción:</span>
                  <p className="mt-1 mb-0" style={{ whiteSpace: 'pre-wrap' }}>{propuesta.descripcion}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Responsables */}
          <Card className="mb-3">
            <p className="font-semibold mb-2 m-0"><i className="pi pi-users mr-2" />Responsables Proconty</p>
            {propuesta.responsables?.length === 0
              ? <p className="text-color-secondary text-sm m-0">Sin responsables asignados</p>
              : propuesta.responsables.map((r) => (
                  <div key={r.userId} className="text-sm mb-1">
                    <i className="pi pi-user mr-1 text-color-secondary" />{r.user?.name}
                  </div>
                ))
            }
          </Card>

          {/* ── Caso de Negocio ── */}
          <Card className="mb-3">
            <div className="flex align-items-center justify-content-between mb-3">
              <div>
                <h3 className="m-0 font-semibold"><i className="pi pi-calculator mr-2" />Caso de Negocio</h3>
                <p className="text-color-secondary text-xs mt-1 mb-0">
                  Horas por perfil · consultor asignado · costos e ingresos estimados
                  {casoTarifario && <span className="ml-2 text-primary"><i className="pi pi-dollar mr-1" />Tarifario: {casoTarifario.nombre}</span>}
                </p>
              </div>
              {!esTerminal && (
                <div className="flex gap-2">
                  {casoTarifario && (
                    <Button
                      label="Cargar tarifario"
                      icon="pi pi-download"
                      size="small"
                      severity="secondary"
                      outlined
                      loading={cargandoTarifario}
                      onClick={handleCargarTarifario}
                      tooltip={`Precarga líneas desde "${casoTarifario.nombre}"`}
                      tooltipOptions={{ position: 'top' }}
                    />
                  )}
                  <Button
                    label="Agregar perfil"
                    icon="pi pi-plus"
                    size="small"
                    outlined
                    onClick={abrirNuevaLinea}
                  />
                </div>
              )}
            </div>

            {casoLineas.length === 0 ? (
              <div className="p-3 surface-50 border-round text-center text-color-secondary text-sm">
                <i className="pi pi-info-circle mr-2" />
                Sin líneas registradas.
                {casoTarifario && !esTerminal && (
                  <span> Usa <strong>Cargar tarifario</strong> para precargar las líneas de <em>{casoTarifario.nombre}</em>.</span>
                )}
              </div>
            ) : (
              <>
                {/* Tabla de líneas */}
                <div className="border-round overflow-hidden mb-3" style={{ border: '1px solid var(--surface-border)', overflowX: 'auto' }}>
                  {/* Cabecera */}
                  <div className="flex px-3 py-2 surface-100 text-xs font-semibold text-color-secondary" style={{ minWidth: '700px', gap: '8px' }}>
                    <div style={{ flex: '0 0 180px' }}>Perfil / Consultor</div>
                    <div style={{ flex: '0 0 55px', textAlign: 'right' }}>Horas</div>
                    <div style={{ flex: '0 0 90px', textAlign: 'right' }}>Costo/h</div>
                    <div style={{ flex: '0 0 90px', textAlign: 'right' }}>Precio/h</div>
                    <div style={{ flex: '0 0 90px', textAlign: 'right' }}>Total Costo</div>
                    <div style={{ flex: '1 1 auto', textAlign: 'right' }}>Total Precio</div>
                    <div style={{ flex: '0 0 70px' }} />
                  </div>

                  {casoLineas.map((l, idx) => (
                    <div
                      key={l.perfilId}
                      className={`flex px-3 py-2 align-items-center ${idx % 2 === 1 ? 'surface-50' : ''}`}
                      style={{ borderTop: '1px solid var(--surface-border)', minWidth: '700px', gap: '8px' }}
                    >
                      {/* Perfil + Empleado */}
                      <div style={{ flex: '0 0 180px' }}>
                        <div className="font-semibold text-sm">{l.perfil.nombre}</div>
                        <div className="text-xs mt-1 flex align-items-center gap-1">
                          <Tag value={l.perfil.nivel} severity={l.perfil.nivel === 'Senior' ? 'success' : l.perfil.nivel === 'Semi Senior' ? 'info' : 'secondary'} style={{ fontSize: '0.65rem' }} />
                          {l.empleado
                            ? <span className="text-color-secondary"><i className="pi pi-user ml-1 mr-1" />{l.empleado.nombre} {l.empleado.apellido}</span>
                            : <span className="text-color-secondary" style={{ fontStyle: 'italic' }}>Sin consultor</span>
                          }
                        </div>
                      </div>

                      <div style={{ flex: '0 0 55px', textAlign: 'right', fontSize: '0.85rem' }}>{l.horas}h</div>
                      <div style={{ flex: '0 0 90px', textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-color-secondary)' }}>{formatCurrency(l.costoHora)}</div>
                      <div style={{ flex: '0 0 90px', textAlign: 'right', fontSize: '0.85rem' }}>
                        <span className={l.precioHora !== null ? 'text-primary font-medium' : 'text-color-secondary'}>
                          {formatCurrency(l.precioHora)}
                        </span>
                      </div>
                      <div style={{ flex: '0 0 90px', textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-color-secondary)' }}>{formatCurrency(l.costo)}</div>
                      <div style={{ flex: '1 1 auto', textAlign: 'right', fontSize: '0.85rem', fontWeight: 600 }}>{formatCurrency(l.precio)}</div>

                      {/* Acciones */}
                      <div style={{ flex: '0 0 70px', textAlign: 'right' }}>
                        {!esTerminal && (
                          <div className="flex gap-1 justify-content-end">
                            <Button
                              icon="pi pi-pencil"
                              rounded text severity="info" size="small"
                              tooltip="Editar"
                              tooltipOptions={{ position: 'top' }}
                              onClick={() => abrirEditarLinea(l)}
                            />
                            <Button
                              icon="pi pi-trash"
                              rounded text severity="danger" size="small"
                              tooltip="Eliminar"
                              tooltipOptions={{ position: 'top' }}
                              onClick={() => handleDeleteLinea(l.perfilId)}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Fila totales */}
                  <div className="flex px-3 py-2 font-semibold surface-100" style={{ borderTop: '2px solid var(--surface-border)', minWidth: '700px', gap: '8px' }}>
                    <div style={{ flex: '0 0 180px', fontSize: '0.85rem' }}>TOTAL</div>
                    <div style={{ flex: '0 0 55px', textAlign: 'right', fontSize: '0.85rem' }}>{casoResumen?.totalHoras}h</div>
                    <div style={{ flex: '0 0 90px' }} />
                    <div style={{ flex: '0 0 90px' }} />
                    <div style={{ flex: '0 0 90px', textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-color-secondary)' }}>{formatCurrency(casoResumen?.totalCosto)}</div>
                    <div style={{ flex: '1 1 auto', textAlign: 'right', fontSize: '0.85rem', color: 'var(--green-700)' }}>{formatCurrency(casoResumen?.totalPrecio)}</div>
                    <div style={{ flex: '0 0 70px' }} />
                  </div>
                </div>

                {/* Resumen GM */}
                <div className="p-3 border-round" style={{ background: 'var(--surface-50)', border: '1px solid var(--surface-border)' }}>
                  <div className="flex justify-content-between align-items-center mb-2">
                    <span className="text-sm font-semibold">Margen bruto</span>
                    <span className={`text-lg font-bold ${(casoResumen?.gmPct || 0) >= 40 ? 'text-green-600' : (casoResumen?.gmPct || 0) >= 20 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {formatCurrency(casoResumen?.gm)} <span className="text-sm">({casoResumen?.gmPct}%)</span>
                    </span>
                  </div>
                  <ProgressBar value={casoResumen?.gmPct || 0} showValue={false} style={{ height: '6px' }}
                    color={(casoResumen?.gmPct || 0) >= 40 ? 'var(--green-500)' : (casoResumen?.gmPct || 0) >= 20 ? 'var(--yellow-500)' : 'var(--red-500)'}
                  />
                  {!esTerminal && (
                    <div className="flex justify-content-end mt-2">
                      <Button
                        label={`Usar ${formatCurrency(casoResumen?.totalPrecio)} como Valor Estimado`}
                        icon="pi pi-arrow-up"
                        size="small"
                        severity="success"
                        outlined
                        onClick={handleAplicarValor}
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </Card>

          {/* Proyecto vinculado */}
          {propuesta.proyecto && (
            <Card className="mb-3">
              <div className="flex align-items-center justify-content-between">
                <div>
                  <p className="font-semibold m-0 mb-1"><i className="pi pi-briefcase mr-2 text-green-600" />Proyecto generado</p>
                  <p className="text-color-secondary text-sm m-0">{propuesta.proyecto.detalle}</p>
                </div>
                <Button
                  label="Ver Proyecto"
                  icon="pi pi-arrow-right"
                  severity="success"
                  outlined
                  size="small"
                  onClick={() => router.push('/proyectos/' + propuesta.proyecto.id)}
                />
              </div>
            </Card>
          )}

          {/* Trazabilidad de estado */}
          <Card>
            <div className="mb-3">
              <h3 className="m-0 font-semibold"><i className="pi pi-history mr-2" />Trazabilidad de Estado</h3>
              <p className="text-color-secondary text-xs mt-1 mb-0">Registro inmutable de todos los cambios de estado</p>
            </div>

            {(!propuesta.logs || propuesta.logs.length === 0) ? (
              <p className="text-color-secondary text-sm m-0">Sin historial de cambios.</p>
            ) : (
              <div className="flex flex-column gap-0">
                {propuesta.logs.map((log, idx) => {
                  const cfgNuevo = propuestaConfig[log.estadoNuevo] || { color: '#6b7280', label: log.estadoNuevo, icon: 'pi-circle', severity: 'secondary' }
                  const cfgAnterior = log.estadoAnterior ? (propuestaConfig[log.estadoAnterior] || { label: log.estadoAnterior, color: '#6b7280' }) : null
                  const isLast = idx === propuesta.logs.length - 1
                  return (
                    <div key={log.id} className="flex gap-3">
                      <div className="flex flex-column align-items-center" style={{ width: '28px', flexShrink: 0 }}>
                        <div
                          className="flex align-items-center justify-content-center border-circle flex-shrink-0"
                          style={{ width: '28px', height: '28px', background: cfgNuevo.color + '20', border: '2px solid ' + cfgNuevo.color }}
                        >
                          <i className={'pi ' + cfgNuevo.icon} style={{ fontSize: '11px', color: cfgNuevo.color }} />
                        </div>
                        {!isLast && (
                          <div style={{ width: '2px', flex: 1, minHeight: '20px', background: 'var(--surface-border)' }} />
                        )}
                      </div>
                      <div className="pb-3 flex-1">
                        <div className="flex align-items-center gap-2 flex-wrap mb-1">
                          {cfgAnterior && (
                            <>
                              <span className="text-sm font-medium" style={{ color: cfgAnterior.color }}>{cfgAnterior.label}</span>
                              <i className="pi pi-arrow-right text-color-secondary" style={{ fontSize: '10px' }} />
                            </>
                          )}
                          <span className="text-sm font-bold" style={{ color: cfgNuevo.color }}>{cfgNuevo.label}</span>
                        </div>
                        <div className="flex align-items-center gap-2 text-xs text-color-secondary mb-1">
                          <i className="pi pi-user" /><span>{log.user?.name}</span>
                          <i className="pi pi-clock" /><span>{new Date(log.createdAt).toLocaleString('es-EC')}</span>
                        </div>
                        {log.nota && (
                          <div className="p-2 surface-50 border-round text-sm" style={{ whiteSpace: 'pre-wrap' }}>{log.nota}</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Col lateral: resumen */}
        <div className="col-12 lg:col-4">
          <Card>
            <h3 className="m-0 mb-3 font-semibold">Resumen</h3>
            <div className="flex flex-column gap-3 text-sm">
              {propuesta.codigo && (
                <div>
                  <div className="text-color-secondary mb-1">Código</div>
                  <code className="font-bold" style={{ fontSize: '0.9rem' }}>{propuesta.codigo}</code>
                </div>
              )}
              <div>
                <div className="text-color-secondary mb-1">Estado actual</div>
                <Tag value={cfg.label} severity={cfg.severity} style={{ fontSize: '0.9rem' }} />
              </div>
              <div>
                <div className="text-color-secondary mb-1">Empresa</div>
                <strong>{propuesta.empresa?.nombre}</strong>
              </div>
              <div>
                <div className="text-color-secondary mb-1">Valor estimado</div>
                <strong className="text-xl">{propuesta.valorEstimado ? formatCurrency(propuesta.valorEstimado) : '—'}</strong>
              </div>
              <hr className="my-1" />
              <div>
                <div className="text-color-secondary mb-1">Fecha de inicio</div>
                <strong>{formatDate(propuesta.fechaCreacion)}</strong>
              </div>
              {propuesta.fechaEnvio && (
                <div>
                  <div className="text-color-secondary mb-1">Fecha de envío</div>
                  <strong>{formatDate(propuesta.fechaEnvio)}</strong>
                </div>
              )}
              <div>
                <div className="text-color-secondary mb-1">Cambios de estado</div>
                <strong>{propuesta.logs?.length ?? 0}</strong>
              </div>
              {propuesta.proyecto && (
                <>
                  <hr className="my-1" />
                  <div>
                    <div className="text-color-secondary mb-1 text-green-700 font-semibold">
                      <i className="pi pi-check-circle mr-1" />Proyecto creado
                    </div>
                    <Button
                      label={propuesta.proyecto.detalle}
                      link
                      className="p-0 text-sm"
                      onClick={() => router.push('/proyectos/' + propuesta.proyecto.id)}
                    />
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* ── Dialogs ── */}
      <PropuestaFormDialog
        visible={editDialogVisible}
        onHide={() => setEditDialogVisible(false)}
        onSave={() => {
          setEditDialogVisible(false)
          loadAll()
          toast.current.show({ severity: 'success', summary: 'Éxito', detail: 'Propuesta actualizada', life: 3000 })
        }}
        propuesta={propuesta}
        empresas={empresas}
        usuarios={usuarios}
      />
      <CambiarEstadoPropuestaDialog
        visible={estadoDialog.visible}
        onHide={() => setEstadoDialog({ visible: false, estadoDestino: null, saving: false })}
        onConfirm={confirmarCambioEstado}
        estadoActual={propuesta.estado}
        estadoDestino={estadoDialog.estadoDestino}
        saving={estadoDialog.saving}
        propuestaConfig={propuestaConfig}
      />

      {/* Dialog: agregar / editar línea del caso de negocio */}
      <Dialog
        visible={casoDialog.visible}
        onHide={() => setCasoDialog(DIALOG_VACIO)}
        header={casoDialog.editando ? 'Editar línea del Caso de Negocio' : 'Agregar perfil al Caso de Negocio'}
        style={{ width: '460px' }}
        footer={dialogFooter}
        modal
      >
        <div className="flex flex-column gap-3 mt-2">
          {/* Perfil */}
          <div className="flex flex-column gap-1">
            <label className="text-sm font-medium">Perfil <span className="text-red-500">*</span></label>
            <Dropdown
              value={casoDialog.perfilId}
              options={perfilesOptions}
              onChange={(e) => setCasoDialog((p) => ({ ...p, perfilId: e.value, empleadoId: null, precioHora: null }))}
              placeholder="Seleccionar perfil"
              filter
              disabled={casoDialog.editando}
            />
          </div>

          {/* Empleado / Consultor */}
          <div className="flex flex-column gap-1">
            <label className="text-sm font-medium">
              Consultor asignado
              <span className="text-color-secondary text-xs ml-2">(opcional)</span>
            </label>
            <Dropdown
              value={casoDialog.empleadoId}
              options={[{ label: '— Sin asignar —', value: null }, ...empleadosOptions]}
              onChange={(e) => setCasoDialog((p) => ({ ...p, empleadoId: e.value }))}
              placeholder="Sin consultor"
              filter
            />
            {empleadoSel && (
              <small className="text-color-secondary">Costo: {formatCurrency(empleadoSel.costoHora)}/h</small>
            )}
          </div>

          {/* Horas */}
          <div className="flex flex-column gap-1">
            <label className="text-sm font-medium">Horas <span className="text-red-500">*</span></label>
            <InputNumber
              value={casoDialog.horas}
              onValueChange={(e) => setCasoDialog((p) => ({ ...p, horas: e.value }))}
              minFractionDigits={0}
              maxFractionDigits={2}
              min={0.25}
              placeholder="0.00"
            />
          </div>

          {/* Precio/hora override */}
          <div className="flex flex-column gap-1">
            <label className="text-sm font-medium">
              Precio/hora
              {perfilSel && (
                <span className="text-color-secondary text-xs ml-2">(tarifa base: {formatCurrency(perfilSel.precioHora)}/h)</span>
              )}
            </label>
            <InputNumber
              value={casoDialog.precioHora}
              onValueChange={(e) => setCasoDialog((p) => ({ ...p, precioHora: e.value }))}
              mode="currency"
              currency="USD"
              locale="es-EC"
              minFractionDigits={2}
              placeholder={perfilSel ? `${formatCurrency(perfilSel.precioHora)} (del perfil)` : 'Precio/hora'}
            />
            {casoDialog.precioHora !== null && casoDialog.precioHora !== undefined && (
              <small className="text-primary"><i className="pi pi-info-circle mr-1" />Precio personalizado (sobreescribe la tarifa del perfil)</small>
            )}
          </div>

          {/* Preview */}
          {previewCosto !== null && (
            <div className="grid text-sm surface-50 border-round p-2 m-0">
              <div className="col-6">
                <div className="text-color-secondary text-xs mb-1">Costo estimado</div>
                <strong className="text-color-secondary">{formatCurrency(previewCosto)}</strong>
              </div>
              <div className="col-6">
                <div className="text-color-secondary text-xs mb-1">Ingreso estimado</div>
                <strong>{formatCurrency(previewPrecio)}</strong>
              </div>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  )
}
