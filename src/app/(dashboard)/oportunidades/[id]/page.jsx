'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from 'primereact/card'
import { Button } from 'primereact/button'
import { Tag } from 'primereact/tag'
import { Toast } from 'primereact/toast'
import { ProgressSpinner } from 'primereact/progressspinner'
import { InputTextarea } from '@/components/shared/InputTextarea'
import { oportunidadService } from '@/services/oportunidadService'
import { empleadoService } from '@/services/empleadoService'
import { formatCurrency, formatDate } from '@/utils/format'
import OportunidadFormDialog from '@/components/shared/OportunidadFormDialog'
import CambiarEtapaOportunidadDialog from '@/components/shared/CambiarEtapaOportunidadDialog'
import { usePermisos, PERMISOS } from '@/hooks/usePermisos'
import { ETAPA_CONFIG, ETAPA_HOOK } from '@/lib/oportunidades'

function EtapaTag({ etapa }) {
  const cfg = ETAPA_CONFIG[etapa] || { label: etapa, severity: 'secondary' }
  return <Tag value={cfg.label} severity={cfg.severity} style={cfg.color ? { background: cfg.color, color: '#fff' } : undefined} />
}

export default function OportunidadDetallePage({ params }) {
  const toast = useRef(null)
  const router = useRouter()
  const { puede } = usePermisos()
  const id = parseInt(params.id)

  const [oportunidad, setOportunidad] = useState(null)
  const [empleados, setEmpleados] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialogVisible, setDialogVisible] = useState(false)
  const [etapaDialogVisible, setEtapaDialogVisible] = useState(false)
  const [savingEtapa, setSavingEtapa] = useState(false)
  const [nuevoSeguimiento, setNuevoSeguimiento] = useState('')
  const [enviandoSeguimiento, setEnviandoSeguimiento] = useState(false)

  useEffect(() => { loadAll() }, [id])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [opRes, empRes] = await Promise.all([
        oportunidadService.getById(id),
        empleadoService.getAll({ activo: true }),
      ])
      setOportunidad(opRes.data)
      setEmpleados(empRes.data)
    } catch {
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la oportunidad', life: 4000 })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = (res) => {
    setDialogVisible(false)
    if (res?.propuestaCreada) {
      toast.current.show({ severity: 'success', summary: '¡Propuesta generada!', detail: res.message, life: 6000 })
    } else {
      toast.current.show({ severity: 'success', summary: 'Éxito', detail: 'Oportunidad actualizada', life: 3000 })
    }
    loadAll()
  }

  const handleCambiarEtapa = async ({ etapaNueva, nota, motivoPerdida }) => {
    setSavingEtapa(true)
    try {
      const res = await oportunidadService.cambiarEtapa(id, { etapaNueva, nota, motivoPerdida })
      setEtapaDialogVisible(false)
      toast.current.show({ severity: 'success', summary: res.propuestaCreada ? '¡Propuesta generada!' : 'Éxito', detail: res.message, life: res.propuestaCreada ? 6000 : 3000 })
      loadAll()
    } catch (err) {
      toast.current.show({ severity: 'error', summary: 'Error', detail: err.response?.data?.message || 'Error al cambiar la etapa', life: 4000 })
    } finally {
      setSavingEtapa(false)
    }
  }

  const handleAgregarSeguimiento = async () => {
    if (!nuevoSeguimiento.trim()) return
    setEnviandoSeguimiento(true)
    try {
      await oportunidadService.addSeguimiento(id, nuevoSeguimiento.trim())
      setNuevoSeguimiento('')
      loadAll()
    } catch (err) {
      toast.current.show({ severity: 'error', summary: 'Error', detail: err.response?.data?.message || 'Error al registrar el seguimiento', life: 4000 })
    } finally {
      setEnviandoSeguimiento(false)
    }
  }

  if (loading || !oportunidad) {
    return <div className="flex justify-content-center align-items-center" style={{ height: '60vh' }}><ProgressSpinner /></div>
  }

  const puedeEditar = !oportunidad.propuestaId && puede(PERMISOS.OPORTUNIDADES.EDITAR)
  const puedeCambiarEtapa = oportunidad.etapa !== ETAPA_HOOK && puede(PERMISOS.OPORTUNIDADES.CAMBIAR_ETAPA)

  return (
    <div className="p-4">
      <Toast ref={toast} />

      <div className="flex align-items-center gap-2 mb-3">
        <Button icon="pi pi-arrow-left" text rounded onClick={() => router.push('/oportunidades')} />
        <span className="text-color-secondary text-sm cursor-pointer" onClick={() => router.push('/oportunidades')}>Oportunidades</span>
        <i className="pi pi-angle-right text-color-secondary text-xs" />
        <span className="text-sm font-medium">{oportunidad.titulo}</span>
      </div>

      <div className="flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold m-0">{oportunidad.titulo}</h1>
          <p className="text-color-secondary text-sm mt-1 mb-0">{oportunidad.empresaNombre}</p>
        </div>
        <div className="flex align-items-center gap-2">
          <EtapaTag etapa={oportunidad.etapa} />
          {puedeCambiarEtapa && <Button label="Cambiar etapa" icon="pi pi-arrow-right-arrow-left" severity="info" outlined onClick={() => setEtapaDialogVisible(true)} />}
          {puedeEditar && <Button label="Editar" icon="pi pi-pencil" outlined onClick={() => setDialogVisible(true)} />}
        </div>
      </div>

      <div className="grid">
        <div className="col-12 lg:col-8 flex flex-column gap-4">
          <Card title="Datos generales">
            <div className="grid">
              <div className="col-6 md:col-3">
                <div className="text-xs text-color-secondary uppercase font-bold mb-1">Origen</div>
                <div>{oportunidad.origen || '—'}</div>
              </div>
              <div className="col-6 md:col-3">
                <div className="text-xs text-color-secondary uppercase font-bold mb-1">Valor estimado</div>
                <div className="font-bold">{oportunidad.valorEstimado ? formatCurrency(oportunidad.valorEstimado) : '—'}</div>
              </div>
              <div className="col-6 md:col-3">
                <div className="text-xs text-color-secondary uppercase font-bold mb-1">Responsable</div>
                <div>{oportunidad.responsable ? `${oportunidad.responsable.nombre} ${oportunidad.responsable.apellido}` : '—'}</div>
              </div>
              <div className="col-6 md:col-3">
                <div className="text-xs text-color-secondary uppercase font-bold mb-1">Fecha de creación</div>
                <div>{formatDate(oportunidad.fechaCreacion)}</div>
              </div>
            </div>
            {oportunidad.descripcion && (
              <div className="mt-3">
                <div className="text-xs text-color-secondary uppercase font-bold mb-1">Descripción</div>
                <p className="m-0 text-color-secondary line-height-3">{oportunidad.descripcion}</p>
              </div>
            )}
          </Card>

          {oportunidad.propuesta && (
            <div className="p-3 border-round" style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
              <i className="pi pi-check-circle text-green-600 mr-2" />
              <span className="text-green-800">
                Esta oportunidad generó la propuesta <strong>{oportunidad.propuesta.codigo}</strong>, actualmente en estado <strong>{oportunidad.propuesta.estado}</strong>.
              </span>
              <Button label="Ver propuesta" link className="ml-2 p-0" onClick={() => router.push(`/propuestas/${oportunidad.propuesta.id}`)} />
            </div>
          )}

          {oportunidad.etapa === 'Perdida' && oportunidad.motivoPerdida && (
            <div className="p-3 border-round" style={{ background: '#fee2e2', border: '1px solid #fca5a5' }}>
              <i className="pi pi-times-circle text-red-600 mr-2" />
              <span className="text-red-800"><strong>Motivo de pérdida:</strong> {oportunidad.motivoPerdida}</span>
            </div>
          )}

          <Card title="Contactos">
            {oportunidad.contactos?.length > 0 ? (
              <div className="flex flex-column gap-2">
                {oportunidad.contactos.map((c) => (
                  <div key={c.id} className="flex align-items-center gap-3 p-2 border-round surface-100">
                    <div className="flex align-items-center justify-content-center border-round-full flex-shrink-0 font-bold text-sm" style={{ width: '32px', height: '32px', background: 'var(--surface-200)' }}>
                      {c.nombre?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{c.nombre}</div>
                      <div className="text-xs text-color-secondary">{c.cargo}</div>
                      <div className="text-xs text-color-secondary">{[c.telefono, c.correo].filter(Boolean).join(' · ')}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-color-secondary text-sm m-0">Sin contactos registrados.</p>}
          </Card>

          <Card title="Seguimientos">
            {puede(PERMISOS.OPORTUNIDADES.EDITAR) && (
              <div className="flex gap-2 mb-3">
                <InputTextarea value={nuevoSeguimiento} onChange={(e) => setNuevoSeguimiento(e.target.value)} placeholder="Registrar una llamada, correo o reunión..." rows={2} autoResize className="flex-1" />
                <Button label="Agregar" icon="pi pi-plus" onClick={handleAgregarSeguimiento} loading={enviandoSeguimiento} disabled={!nuevoSeguimiento.trim()} />
              </div>
            )}
            {oportunidad.seguimientos?.length > 0 ? (
              <div className="flex flex-column gap-3">
                {oportunidad.seguimientos.map((s) => (
                  <div key={s.id} className="pl-3" style={{ borderLeft: '2px solid var(--surface-border)' }}>
                    <div className="text-sm">{s.descripcion}</div>
                    <div className="text-xs text-color-secondary mt-1">{s.user?.name} · {formatDate(s.createdAt)}</div>
                  </div>
                ))}
              </div>
            ) : <p className="text-color-secondary text-sm m-0">Sin seguimientos registrados.</p>}
          </Card>
        </div>

        <div className="col-12 lg:col-4">
          <Card title="Trazabilidad de etapa">
            {oportunidad.logs?.length > 0 ? (
              <div className="flex flex-column gap-3">
                {oportunidad.logs.map((l) => (
                  <div key={l.id} className="pl-3" style={{ borderLeft: '2px solid var(--surface-border)' }}>
                    <div className="text-sm font-medium">
                      {l.etapaAnterior ? `${ETAPA_CONFIG[l.etapaAnterior]?.label || l.etapaAnterior} → ${ETAPA_CONFIG[l.etapaNueva]?.label || l.etapaNueva}` : `Creada en ${ETAPA_CONFIG[l.etapaNueva]?.label || l.etapaNueva}`}
                    </div>
                    <div className="text-xs text-color-secondary mt-1">{l.user?.name} · {formatDate(l.createdAt)}</div>
                    {l.nota && <div className="text-xs text-color-secondary mt-1">{l.nota}</div>}
                  </div>
                ))}
              </div>
            ) : <p className="text-color-secondary text-sm m-0">Sin historial.</p>}
          </Card>
        </div>
      </div>

      <OportunidadFormDialog
        visible={dialogVisible}
        onHide={() => setDialogVisible(false)}
        onSave={handleSave}
        oportunidad={oportunidad}
        empleados={empleados}
      />

      <CambiarEtapaOportunidadDialog
        visible={etapaDialogVisible}
        onHide={() => setEtapaDialogVisible(false)}
        onConfirm={handleCambiarEtapa}
        oportunidad={oportunidad}
        saving={savingEtapa}
      />
    </div>
  )
}
