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

      {/* ── Header ── */}
      <div className="flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div className="flex align-items-center gap-2 flex-wrap">
          <Button label="Propuestas" icon="pi pi-arrow-left" severity="secondary" text onClick={() => router.push('/propuestas')} />
          <i className="pi pi-angle-right text-color-secondary" />
          <span className="text-900 font-bold text-xl">{propuesta.titulo}</span>
          {propuesta.codigo && (
            <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 600, color: '#64748b', background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '3px 9px', borderRadius: '20px', letterSpacing: '0.3px' }}>
              {propuesta.codigo}
            </span>
          )}
        </div>
        {!esTerminal && puede(PERMISOS.PROPUESTAS.EDITAR) && (
          <Button label="Editar" icon="pi pi-pencil" severity="secondary" outlined onClick={() => setEditDialogVisible(true)} />
        )}
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid mb-3">
        <div className="col-12 md:col-3">
          <div className="surface-card border-round p-3 shadow-1 flex align-items-center gap-3">
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>🏢</div>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#94a3b8', marginBottom: '3px' }}>Empresa</div>
              <div className="font-bold text-sm">{propuesta.empresa?.nombre || '—'}</div>
            </div>
          </div>
        </div>
        <div className="col-12 md:col-3">
          <div className="surface-card border-round p-3 shadow-1 flex align-items-center gap-3">
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>📅</div>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#94a3b8', marginBottom: '3px' }}>Fecha de inicio</div>
              <div className="font-bold text-sm">{formatDate(propuesta.fechaCreacion)}</div>
            </div>
          </div>
        </div>
        <div className="col-12 md:col-3">
          <div className="surface-card border-round p-3 shadow-1 flex align-items-center gap-3">
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>🖥️</div>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#94a3b8', marginBottom: '3px' }}>Aplicativo</div>
              <div className="font-bold text-sm">{propuesta.aplicativo || '—'}</div>
            </div>
          </div>
        </div>
        <div className="col-12 md:col-3">
          <div className="surface-card border-round p-3 shadow-1 flex align-items-center gap-3">
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>💰</div>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#94a3b8', marginBottom: '3px' }}>Valor estimado</div>
              <div className="font-bold text-sm" style={{ color: '#15803d' }}>{propuesta.valorEstimado ? formatCurrency(propuesta.valorEstimado) : '—'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Pipeline de estado ── */}
      {(() => {
        const STEPS = ['Factibilidad', 'Haciendo', 'Enviada']
        const isFork = ['Aprobada', 'Rechazada'].includes(propuesta.estado)
        const pipeIdx = isFork ? 3 : STEPS.indexOf(propuesta.estado)
        const getLabel = (key) => propuestaConfig[key]?.label || key

        return (
          <Card className="mb-3">
            {/* Stepper */}
            <div className="flex align-items-start justify-content-center mb-4" style={{ gap: 0 }}>
              {STEPS.map((key, idx) => {
                const done = pipeIdx > idx
                const curr = pipeIdx === idx
                const circleStyle = done
                  ? { background: '#22C55E', color: '#fff', border: '2px solid #22C55E' }
                  : curr
                    ? { background: '#F97316', color: '#fff', border: '2px solid #F97316', boxShadow: '0 0 0 4px rgba(249,115,22,.18)' }
                    : { background: '#fff', color: '#94a3b8', border: '2px solid #CBD5E1' }
                return (
                  <div key={key} className="flex align-items-center" style={{ flex: idx < STEPS.length - 1 ? 1 : '0 0 auto' }}>
                    <div className="flex flex-column align-items-center" style={{ minWidth: '72px' }}>
                      <div style={{ width: '34px', height: '34px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px', ...circleStyle }}>
                        {done ? '✓' : curr ? '●' : idx + 1}
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: curr ? 700 : 400, color: curr ? '#F97316' : done ? '#16A34A' : '#94a3b8', textAlign: 'center', marginTop: '6px', maxWidth: '72px', lineHeight: '1.3' }}>
                        {getLabel(key)}
                      </div>
                      {curr && <div style={{ fontSize: '9.5px', color: '#94a3b8', marginTop: '2px' }}>Estado actual</div>}
                    </div>
                    {/* Connector */}
                    <div style={{ flex: 1, height: '2px', margin: curr ? '-30px 4px 0' : '-22px 4px 0', backgroundImage: done ? 'none' : 'repeating-linear-gradient(90deg,#CBD5E1 0,#CBD5E1 5px,transparent 5px,transparent 11px)', background: done ? '#22C55E' : undefined }} />
                  </div>
                )
              })}

              {/* Fork: Aprobada | Rechazada */}
              <div style={{ flex: '0 0 160px', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: '10px', paddingTop: 0, position: 'relative' }}>
                <div style={{ position: 'absolute', top: '16px', left: 0, right: '50%', height: '2px', backgroundImage: 'repeating-linear-gradient(90deg,#CBD5E1 0,#CBD5E1 5px,transparent 5px,transparent 11px)' }} />
                {/* Aprobada */}
                <div className="flex flex-column align-items-center">
                  <div style={{ width: '2px', height: '14px', background: '#CBD5E1', marginBottom: '2px' }} />
                  <div style={{ width: '34px', height: '34px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px', background: propuesta.estado === 'Aprobada' ? '#DCFCE7' : '#fff', color: propuesta.estado === 'Aprobada' ? '#15803D' : '#94a3b8', border: propuesta.estado === 'Aprobada' ? '2px solid #BBF7D0' : '2px solid #CBD5E1' }}>✓</div>
                  <div style={{ fontSize: '11px', color: propuesta.estado === 'Aprobada' ? '#16A34A' : '#94a3b8', textAlign: 'center', marginTop: '6px', maxWidth: '65px', lineHeight: '1.3' }}>{getLabel('Aprobada')}</div>
                </div>
                {/* Rechazada */}
                <div className="flex flex-column align-items-center">
                  <div style={{ width: '2px', height: '14px', background: '#CBD5E1', marginBottom: '2px' }} />
                  <div style={{ width: '34px', height: '34px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px', background: propuesta.estado === 'Rechazada' ? '#FEF2F2' : '#fff', color: propuesta.estado === 'Rechazada' ? '#DC2626' : '#94a3b8', border: propuesta.estado === 'Rechazada' ? '2px solid #FECACA' : '2px solid #CBD5E1' }}>✕</div>
                  <div style={{ fontSize: '11px', color: propuesta.estado === 'Rechazada' ? '#DC2626' : '#94a3b8', textAlign: 'center', marginTop: '6px', maxWidth: '65px', lineHeight: '1.3' }}>{getLabel('Rechazada')}</div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            {transicionesUI.length > 0 && puede(PERMISOS.PROPUESTAS.CAMBIAR_ESTADO) && (
              <div className="flex justify-content-center gap-2 flex-wrap pt-3" style={{ borderTop: '1px solid var(--surface-border)' }}>
                {transicionesUI.map((t) => (
                  <Button key={t.estado} label={t.label} icon={'pi ' + t.icon}
                    severity={t.estado === 'Aprobada' ? 'success' : t.estado === 'Rechazada' ? 'danger' : 'secondary'}
                    outlined size="small" onClick={() => abrirCambioEstado(t.estado)} />
                ))}
              </div>
            )}
          </Card>
        )
      })()}

      {/* ── 2 col: Responsables | Descripción ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
        <Card>
          <div className="flex align-items-center gap-2 mb-3">
            <span style={{ fontSize: '15px' }}>👥</span>
            <h3 className="m-0 font-semibold text-base">Responsables</h3>
          </div>
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: '#94a3b8', marginBottom: '10px' }}>Equipo Proconty</div>
          {propuesta.responsables?.length === 0
            ? <p className="text-color-secondary text-sm">Sin responsables asignados</p>
            : propuesta.responsables.map((r) => {
                const initials = r.user?.name?.split(' ').map(w => w[0]).slice(0, 2).join('') || '?'
                return (
                  <div key={r.userId} className="flex align-items-center gap-2 mb-3">
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg,#4F8EF7,#3B5BDB)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
                      {initials}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{r.user?.name}</div>
                      {r.user?.email && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>{r.user.email}</div>}
                    </div>
                  </div>
                )
              })
          }
        </Card>

        <Card>
          <div className="flex align-items-center gap-2 mb-3">
            <span style={{ fontSize: '15px' }}>📄</span>
            <h3 className="m-0 font-semibold text-base">Descripción</h3>
          </div>
          {propuesta.descripcion
            ? <p className="m-0 text-sm text-color-secondary" style={{ lineHeight: '1.65', whiteSpace: 'pre-wrap' }}>{propuesta.descripcion}</p>
            : <p className="m-0 text-sm text-color-secondary" style={{ fontStyle: 'italic' }}>Sin descripción registrada.</p>
          }
          {propuesta.fechaEnvio && (
            <div className="mt-3 pt-3 text-sm" style={{ borderTop: '1px solid var(--surface-border)' }}>
              <span className="text-color-secondary">Fecha de envío: </span><strong>{formatDate(propuesta.fechaEnvio)}</strong>
            </div>
          )}
        </Card>
      </div>

      {/* ── Caso de Negocio ── */}
      <Card className="mb-3" style={{ padding: 0 }}>
        <div className="flex align-items-center justify-content-between p-3" style={{ borderBottom: '1px solid var(--surface-border)' }}>
          <div className="flex align-items-center gap-2 flex-wrap">
            <span style={{ fontSize: '15px' }}>📊</span>
            <h3 className="m-0 font-semibold">Caso de Negocio</h3>
            {casoTarifario && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '20px', background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8', fontSize: '10.5px', fontWeight: 600 }}>
                💲 {casoTarifario.nombre}
              </span>
            )}
          </div>
          {!esTerminal && (
            <div className="flex gap-2">
              {casoTarifario && (
                <Button label="Cargar tarifario" icon="pi pi-download" size="small" severity="secondary" outlined loading={cargandoTarifario} onClick={handleCargarTarifario} />
              )}
              <Button label="Agregar perfil" icon="pi pi-plus" size="small" onClick={abrirNuevaLinea} />
            </div>
          )}
        </div>

        {casoLineas.length === 0 ? (
          <div className="p-3 text-center text-color-secondary text-sm">
            <i className="pi pi-info-circle mr-2" />
            Sin líneas registradas.
            {casoTarifario && !esTerminal && <span> Usa <strong>Cargar tarifario</strong> para precargar las líneas de <em>{casoTarifario.nombre}</em>.</span>}
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              {/* Header tabla */}
              <div className="flex px-3 py-2 text-xs font-semibold" style={{ minWidth: '700px', gap: '8px', background: '#f8f9fa', borderBottom: '1px solid var(--surface-border)', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <div style={{ flex: '0 0 180px' }}>Perfil / Consultor</div>
                <div style={{ flex: '0 0 55px', textAlign: 'right' }}>Horas</div>
                <div style={{ flex: '0 0 90px', textAlign: 'right' }}>Costo/h</div>
                <div style={{ flex: '0 0 90px', textAlign: 'right' }}>Precio/h</div>
                <div style={{ flex: '0 0 90px', textAlign: 'right' }}>Total Costo</div>
                <div style={{ flex: '1 1 auto', textAlign: 'right' }}>Total Precio</div>
                <div style={{ flex: '0 0 70px' }} />
              </div>

              {casoLineas.map((l, idx) => (
                <div key={l.perfilId}
                  className="flex px-3 align-items-center"
                  style={{ borderBottom: '1px solid #f1f5f9', minWidth: '700px', gap: '8px', padding: '13px 12px', background: idx % 2 === 1 ? '#fafbfc' : '#fff' }}
                >
                  <div style={{ flex: '0 0 180px' }}>
                    <div className="font-semibold text-sm">{l.perfil.nombre}</div>
                    <div className="text-xs mt-1 flex align-items-center gap-1">
                      <Tag value={l.perfil.nivel} severity={l.perfil.nivel === 'Senior' ? 'success' : l.perfil.nivel === 'Semi Senior' ? 'info' : 'secondary'} style={{ fontSize: '0.65rem' }} />
                      {l.empleado
                        ? <span style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '3px' }}>👤 {l.empleado.nombre} {l.empleado.apellido}</span>
                        : <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>Sin consultor</span>}
                    </div>
                  </div>
                  <div style={{ flex: '0 0 55px', textAlign: 'right', fontSize: '0.85rem' }}>{l.horas}h</div>
                  <div style={{ flex: '0 0 90px', textAlign: 'right', fontSize: '0.85rem', color: '#94a3b8' }}>{formatCurrency(l.costoHora)}</div>
                  <div style={{ flex: '0 0 90px', textAlign: 'right', fontSize: '0.85rem' }}>
                    <span style={{ color: '#3B82F6', fontWeight: 600 }}>{formatCurrency(l.precioHora)}</span>
                  </div>
                  <div style={{ flex: '0 0 90px', textAlign: 'right', fontSize: '0.85rem', color: '#64748b' }}>{formatCurrency(l.costo)}</div>
                  <div style={{ flex: '1 1 auto', textAlign: 'right', fontSize: '0.85rem', fontWeight: 700 }}>{formatCurrency(l.precio)}</div>
                  <div style={{ flex: '0 0 70px', textAlign: 'right' }}>
                    {!esTerminal && (
                      <div className="flex gap-1 justify-content-end">
                        <Button icon="pi pi-pencil" rounded text severity="info" size="small" tooltip="Editar" tooltipOptions={{ position: 'top' }} onClick={() => abrirEditarLinea(l)} />
                        <Button icon="pi pi-trash" rounded text severity="danger" size="small" tooltip="Eliminar" tooltipOptions={{ position: 'top' }} onClick={() => handleDeleteLinea(l.perfilId)} />
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Fila TOTAL */}
              <div className="flex px-3 font-semibold" style={{ borderTop: '2px solid var(--surface-border)', minWidth: '700px', gap: '8px', padding: '10px 12px', background: '#f8f9fa' }}>
                <div style={{ flex: '0 0 180px', fontSize: '0.85rem' }}>TOTAL</div>
                <div style={{ flex: '0 0 55px', textAlign: 'right', fontSize: '0.85rem' }}>{casoResumen?.totalHoras}h</div>
                <div style={{ flex: '0 0 90px' }} />
                <div style={{ flex: '0 0 90px' }} />
                <div style={{ flex: '0 0 90px', textAlign: 'right', fontSize: '0.85rem', color: '#64748b' }}>{formatCurrency(casoResumen?.totalCosto)}</div>
                <div style={{ flex: '1 1 auto', textAlign: 'right', fontSize: '0.85rem', color: '#15803d', fontWeight: 700 }}>{formatCurrency(casoResumen?.totalPrecio)}</div>
                <div style={{ flex: '0 0 70px' }} />
              </div>
            </div>

            {/* Margen bruto */}
            <div className="flex align-items-center gap-3 px-3" style={{ borderTop: '1px solid var(--surface-border)', padding: '13px 16px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>Margen bruto</span>
              <div style={{ flex: 1, background: '#f1f3f4', borderRadius: '20px', height: '8px', overflow: 'hidden' }}>
                <div style={{ width: `${casoResumen?.gmPct || 0}%`, height: '100%', borderRadius: '20px', background: 'linear-gradient(90deg,#16A34A,#22C55E)' }} />
              </div>
              <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#15803d', whiteSpace: 'nowrap' }}>
                {formatCurrency(casoResumen?.gm)} <span style={{ fontSize: '12px' }}>({casoResumen?.gmPct}%)</span>
              </span>
            </div>

            {!esTerminal && (
              <div className="flex justify-content-end px-3 pb-3">
                <Button label={`↑ Usar ${formatCurrency(casoResumen?.totalPrecio)} como Valor Estimado`} icon="pi pi-arrow-up" size="small" severity="success" outlined onClick={handleAplicarValor} />
              </div>
            )}
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
            <Button label="Ver Proyecto" icon="pi pi-arrow-right" severity="success" outlined size="small" onClick={() => router.push('/proyectos/' + propuesta.proyecto.id)} />
          </div>
        </Card>
      )}

      {/* ── Trazabilidad de Estado ── */}
      <Card>
        <div className="flex align-items-center gap-2 mb-1">
          <span style={{ fontSize: '15px' }}>🕐</span>
          <h3 className="m-0 font-semibold">Trazabilidad de Estado</h3>
        </div>
        <p style={{ fontSize: '11px', color: '#94a3b8', margin: '0 0 16px' }}>Registro inmutable de todos los cambios de estado</p>

        {(!propuesta.logs || propuesta.logs.length === 0) ? (
          <p className="text-color-secondary text-sm m-0">Sin historial de cambios.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {propuesta.logs.map((log, idx) => {
              const cfgNuevo   = propuestaConfig[log.estadoNuevo]    || { color: '#6b7280', label: log.estadoNuevo    }
              const cfgAnterior = log.estadoAnterior ? (propuestaConfig[log.estadoAnterior] || { label: log.estadoAnterior, color: '#6b7280' }) : null
              const isLast = idx === propuesta.logs.length - 1
              const DOT_STYLES = {
                Factibilidad: { bg: '#FFF7ED', color: '#F97316', border: '#FED7AA' },
                Haciendo:     { bg: '#EFF6FF', color: '#3B82F6', border: '#BFDBFE' },
                Enviada:      { bg: '#F8FAFC', color: '#64748B', border: '#CBD5E1' },
                Aprobada:     { bg: '#DCFCE7', color: '#16A34A', border: '#BBF7D0' },
                Rechazada:    { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
              }
              const ds = DOT_STYLES[log.estadoNuevo] || { bg: '#F1F5F9', color: '#64748B', border: '#CBD5E1' }
              return (
                <div key={log.id} style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '36px', flexShrink: 0 }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: ds.bg, color: ds.color, border: `2px solid ${ds.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11px', flexShrink: 0 }}>
                      {log.estadoNuevo?.[0] || '?'}
                    </div>
                    {!isLast && <div style={{ width: '2px', flex: 1, minHeight: '20px', background: '#e2e8f0', margin: '4px 0' }} />}
                  </div>
                  <div style={{ flex: 1, paddingBottom: isLast ? 0 : '22px', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', paddingTop: '5px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                        {cfgAnterior && (
                          <>
                            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: '20px', fontSize: '10.5px', fontWeight: 600, background: cfgAnterior.color + '20', color: cfgAnterior.color }}>{cfgAnterior.label}</span>
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>→</span>
                          </>
                        )}
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: '20px', fontSize: '10.5px', fontWeight: 600, background: cfgNuevo.color + '20', color: cfgNuevo.color }}>{cfgNuevo.label}</span>
                      </div>
                      <span style={{ fontSize: '11px', color: '#94a3b8', flexShrink: 0, marginTop: '1px' }}>{new Date(log.createdAt).toLocaleString('es-EC')}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '5px' }}>
                      👤 {log.user?.name}{!cfgAnterior && <em> · Propuesta creada</em>}
                    </div>
                    {log.nota && <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', marginTop: '2px' }}>{log.nota}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

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
      <Dialog
        visible={casoDialog.visible}
        onHide={() => setCasoDialog(DIALOG_VACIO)}
        header={casoDialog.editando ? 'Editar línea del Caso de Negocio' : 'Agregar perfil al Caso de Negocio'}
        style={{ width: '460px' }}
        footer={dialogFooter}
        modal
      >
        <div className="flex flex-column gap-3 mt-2">
          <div className="flex flex-column gap-1">
            <label className="text-sm font-medium">Perfil <span className="text-red-500">*</span></label>
            <Dropdown value={casoDialog.perfilId} options={perfilesOptions}
              onChange={(e) => setCasoDialog((p) => ({ ...p, perfilId: e.value, empleadoId: null, precioHora: null }))}
              placeholder="Seleccionar perfil" filter disabled={casoDialog.editando} />
          </div>
          <div className="flex flex-column gap-1">
            <label className="text-sm font-medium">Consultor asignado <span className="text-color-secondary text-xs ml-1">(opcional)</span></label>
            <Dropdown value={casoDialog.empleadoId} options={[{ label: '— Sin asignar —', value: null }, ...empleadosOptions]}
              onChange={(e) => setCasoDialog((p) => ({ ...p, empleadoId: e.value }))} placeholder="Sin consultor" filter />
            {empleadoSel && <small className="text-color-secondary">Costo: {formatCurrency(empleadoSel.costoHora)}/h</small>}
          </div>
          <div className="flex flex-column gap-1">
            <label className="text-sm font-medium">Horas <span className="text-red-500">*</span></label>
            <InputNumber value={casoDialog.horas} onValueChange={(e) => setCasoDialog((p) => ({ ...p, horas: e.value }))} minFractionDigits={0} maxFractionDigits={2} min={0.25} placeholder="0.00" />
          </div>
          <div className="flex flex-column gap-1">
            <label className="text-sm font-medium">
              Precio/hora
              {perfilSel && <span className="text-color-secondary text-xs ml-2">(tarifa base: {formatCurrency(perfilSel.precioHora)}/h)</span>}
            </label>
            <InputNumber value={casoDialog.precioHora} onValueChange={(e) => setCasoDialog((p) => ({ ...p, precioHora: e.value }))}
              mode="currency" currency="USD" locale="es-EC" minFractionDigits={2}
              placeholder={perfilSel ? `${formatCurrency(perfilSel.precioHora)} (del perfil)` : 'Precio/hora'} />
            {casoDialog.precioHora !== null && casoDialog.precioHora !== undefined && (
              <small className="text-primary"><i className="pi pi-info-circle mr-1" />Precio personalizado</small>
            )}
          </div>
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
