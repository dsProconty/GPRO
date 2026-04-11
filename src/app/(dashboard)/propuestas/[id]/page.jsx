'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from 'primereact/card'
import { Button } from 'primereact/button'
import { Tag } from 'primereact/tag'
import { Toast } from 'primereact/toast'
import { ProgressSpinner } from 'primereact/progressspinner'
import { propuestaService } from '@/services/propuestaService'
import { empresaService } from '@/services/empresaService'
import { usuarioService } from '@/services/usuarioService'
import { formatCurrency, formatDate } from '@/utils/format'
import PropuestaFormDialog from '@/components/shared/PropuestaFormDialog'
import CambiarEstadoPropuestaDialog from '@/components/shared/CambiarEstadoPropuestaDialog'
import { usePermisos, PERMISOS } from '@/hooks/usePermisos'

const PROPUESTA_CONFIG = {
  Factibilidad: { severity: 'warning',   label: 'Factibilidad', icon: 'pi-lightbulb',    color: '#f59e0b' },
  Haciendo:     { severity: 'info',      label: 'Haciendo',     icon: 'pi-cog',           color: '#3b82f6' },
  Enviada:      { severity: 'secondary', label: 'Enviada',      icon: 'pi-send',          color: '#6b7280' },
  Aprobada:     { severity: 'success',   label: 'Aprobada',     icon: 'pi-check-circle',  color: '#22c55e' },
  Rechazada:    { severity: 'danger',    label: 'Rechazada',    icon: 'pi-times-circle',  color: '#ef4444' },
}

// Qué transiciones están disponibles según el estado actual
const TRANSICIONES_UI = {
  Factibilidad: [{ estado: 'Haciendo',  label: 'Mover a Haciendo',   severity: 'info',    icon: 'pi-arrow-right' }],
  Haciendo:     [
    { estado: 'Factibilidad', label: 'Volver a Factibilidad', severity: 'warning', icon: 'pi-arrow-left'  },
    { estado: 'Enviada',      label: 'Marcar como Enviada',   severity: 'secondary',icon: 'pi-send'        },
  ],
  Enviada:      [
    { estado: 'Aprobada',  label: 'Aprobar',   severity: 'success', icon: 'pi-check-circle' },
    { estado: 'Rechazada', label: 'Rechazar',  severity: 'danger',  icon: 'pi-times-circle' },
  ],
  Aprobada:  [],
  Rechazada: [],
}

export default function PropuestaDetallePage({ params }) {
  const toast = useRef(null)
  const router = useRouter()
  const { puede } = usePermisos()
  const id = parseInt(params.id)

  const [propuesta, setPropuesta] = useState(null)
  const [empresas, setEmpresas] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)

  // Dialogs
  const [editDialogVisible, setEditDialogVisible] = useState(false)
  const [estadoDialog, setEstadoDialog] = useState({ visible: false, estadoDestino: null, saving: false })

  useEffect(() => { loadAll() }, [id])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [propRes, empRes, usrRes] = await Promise.all([
        propuestaService.getById(id),
        empresaService.getAll(),
        usuarioService.getAll(),
      ])
      setPropuesta(propRes.data)
      setEmpresas(empRes.data)
      setUsuarios(usrRes.data)
    } catch {
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la propuesta', life: 4000 })
    } finally {
      setLoading(false)
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
        toast.current.show({
          severity: 'success',
          summary: '¡Propuesta aprobada!',
          detail: `Proyecto "${res.proyectoCreado.detalle}" creado automáticamente.`,
          life: 6000,
        })
      } else {
        toast.current.show({ severity: 'success', summary: 'Estado actualizado', detail: res.message, life: 3000 })
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

  const cfg = PROPUESTA_CONFIG[propuesta.estado] || { severity: 'secondary', label: propuesta.estado, color: '#6b7280', icon: 'pi-circle' }
  const transiciones = TRANSICIONES_UI[propuesta.estado] || []
  const esTerminal = ['Aprobada', 'Rechazada'].includes(propuesta.estado)

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
            {transiciones.length > 0 && puede(PERMISOS.PROPUESTAS.CAMBIAR_ESTADO) && (
              <div className="flex flex-wrap gap-2 mb-3 p-3 surface-50 border-round">
                <span className="text-sm font-semibold text-color-secondary align-self-center mr-1">Cambiar a:</span>
                {transiciones.map((t) => (
                  <Button
                    key={t.estado}
                    label={t.label}
                    icon={`pi ${t.icon}`}
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

          {/* Proyecto vinculado (si fue aprobada) */}
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
                  onClick={() => router.push(`/proyectos/${propuesta.proyecto.id}`)}
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
                  const cfgNuevo = PROPUESTA_CONFIG[log.estadoNuevo] || { color: '#6b7280', label: log.estadoNuevo, icon: 'pi-circle' }
                  const isLast = idx === propuesta.logs.length - 1
                  return (
                    <div key={log.id} className="flex gap-3">
                      {/* Línea de tiempo */}
                      <div className="flex flex-column align-items-center" style={{ width: '28px', flexShrink: 0 }}>
                        <div
                          className="flex align-items-center justify-content-center border-circle flex-shrink-0"
                          style={{ width: '28px', height: '28px', background: cfgNuevo.color + '20', border: `2px solid ${cfgNuevo.color}` }}
                        >
                          <i className={`pi ${cfgNuevo.icon}`} style={{ fontSize: '11px', color: cfgNuevo.color }} />
                        </div>
                        {!isLast && (
                          <div style={{ width: '2px', flex: 1, minHeight: '20px', background: 'var(--surface-border)' }} />
                        )}
                      </div>
                      {/* Contenido */}
                      <div className="pb-3 flex-1">
                        <div className="flex align-items-center gap-2 flex-wrap mb-1">
                          {log.estadoAnterior && (
                            <>
                              <span className="text-sm font-medium" style={{ color: PROPUESTA_CONFIG[log.estadoAnterior]?.color || '#6b7280' }}>
                                {PROPUESTA_CONFIG[log.estadoAnterior]?.label || log.estadoAnterior}
                              </span>
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
                      onClick={() => router.push(`/proyectos/${propuesta.proyecto.id}`)}
                    />
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <PropuestaFormDialog
        visible={editDialogVisible}
        onHide={() => setEditDialogVisible(false)}
        onSave={() => { setEditDialogVisible(false); loadAll(); toast.current.show({ severity: 'success', summary: 'Éxito', detail: 'Propuesta actualizada', life: 3000 }) }}
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
      />
    </div>
  )
}
