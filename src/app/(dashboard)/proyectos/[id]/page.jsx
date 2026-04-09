'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from 'primereact/card'
import { Button } from 'primereact/button'
import { Tag } from 'primereact/tag'
import { ProgressSpinner } from 'primereact/progressspinner'
import { Toast } from 'primereact/toast'
import { proyectoService } from '@/services/proyectoService'
import { formatCurrency, formatDate, calcTiempoVida } from '@/utils/format'

const ESTADO_CONFIG = {
  Prefactibilidad:       { severity: 'warning',   label: 'Prefactibilidad' },
  Elaboracion_Propuesta: { severity: 'info',       label: 'Elab. Propuesta' },
  Adjudicado:            { severity: 'success',    label: 'Adjudicado' },
  Rechazado:             { severity: 'danger',     label: 'Rechazado' },
  Cerrado:               { severity: 'secondary',  label: 'Cerrado' },
}

export default function ProyectoDetallePage({ params }) {
  const toast = useRef(null)
  const router = useRouter()
  const id = parseInt(params.id)
  const [proyecto, setProyecto] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    proyectoService.getById(id)
      .then((res) => setProyecto(res.data))
      .catch(() => toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el proyecto', life: 4000 }))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="flex justify-content-center align-items-center" style={{ height: '60vh' }}>
      <ProgressSpinner />
    </div>
  )

  if (!proyecto) return (
    <div className="p-4">
      <Button label="Volver" icon="pi pi-arrow-left" severity="secondary" text onClick={() => router.push('/proyectos')} />
      <p className="mt-3 text-color-secondary">Proyecto no encontrado.</p>
    </div>
  )

  const estadoCfg = ESTADO_CONFIG[proyecto.estado?.nombre] || { severity: 'secondary', label: proyecto.estado?.nombre }

  return (
    <div className="p-4">
      <Toast ref={toast} />

      <div className="flex align-items-center gap-2 mb-4">
        <Button label="Proyectos" icon="pi pi-arrow-left" severity="secondary" text onClick={() => router.push('/proyectos')} />
        <i className="pi pi-angle-right text-color-secondary" />
        <span className="text-900 font-semibold">{proyecto.detalle}</span>
      </div>

      <div className="grid">
        {/* Info principal */}
        <div className="col-12 lg:col-8">
          <Card className="mb-3">
            <div className="flex justify-content-between align-items-start mb-3">
              <div>
                <h2 className="text-2xl font-bold m-0 mb-2">{proyecto.detalle}</h2>
                <div className="flex gap-2 align-items-center flex-wrap">
                  <Tag value={estadoCfg.label} severity={estadoCfg.severity} />
                  <span className="text-color-secondary"><i className="pi pi-building mr-1" />{proyecto.empresa?.nombre}</span>
                  <span className="text-color-secondary"><i className="pi pi-clock mr-1" />{calcTiempoVida(proyecto.fechaCreacion, proyecto.fechaCierre)}</span>
                </div>
              </div>
            </div>
            <div className="grid text-sm">
              <div className="col-6"><span className="text-color-secondary">Fecha inicio:</span> <strong>{formatDate(proyecto.fechaCreacion)}</strong></div>
              <div className="col-6"><span className="text-color-secondary">Fecha cierre:</span> <strong>{formatDate(proyecto.fechaCierre)}</strong></div>
              {proyecto.projectOnline && (
                <div className="col-12">
                  <span className="text-color-secondary">URL:</span>{' '}
                  <a href={proyecto.projectOnline} target="_blank" rel="noopener noreferrer" className="text-primary">{proyecto.projectOnline}</a>
                </div>
              )}
            </div>
          </Card>

          {/* Contactos y Responsables */}
          <Card>
            <div className="grid">
              <div className="col-6">
                <p className="font-semibold mb-2"><i className="pi pi-users mr-2" />Contactos / PMs</p>
                {proyecto.clientes.length === 0
                  ? <p className="text-color-secondary text-sm">Sin contactos asignados</p>
                  : proyecto.clientes.map((c) => (
                      <div key={c.clienteId} className="text-sm mb-1">
                        <i className="pi pi-user mr-1 text-color-secondary" />
                        {c.cliente.nombre} {c.cliente.apellido}
                      </div>
                    ))}
              </div>
              <div className="col-6">
                <p className="font-semibold mb-2"><i className="pi pi-briefcase mr-2" />Responsables Proconty</p>
                {proyecto.responsables.length === 0
                  ? <p className="text-color-secondary text-sm">Sin responsables asignados</p>
                  : proyecto.responsables.map((r) => (
                      <div key={r.userId} className="text-sm mb-1">
                        <i className="pi pi-user mr-1 text-color-secondary" />
                        {r.user.name}
                      </div>
                    ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Resumen financiero */}
        <div className="col-12 lg:col-4">
          <Card title="Resumen Financiero">
            <div className="flex flex-column gap-3">
              <div className="flex justify-content-between">
                <span className="text-color-secondary">Valor contrato</span>
                <strong>{formatCurrency(proyecto.valor)}</strong>
              </div>
              <div className="flex justify-content-between">
                <span className="text-color-secondary">Facturado</span>
                <strong>{formatCurrency(proyecto.facturado)}</strong>
              </div>
              <div className="flex justify-content-between">
                <span className="text-color-secondary">Pagado</span>
                <strong>{formatCurrency(proyecto.pagado)}</strong>
              </div>
              <hr className="my-1" />
              <div className="flex justify-content-between">
                <span className="font-semibold">Saldo pendiente</span>
                <strong style={{ color: proyecto.saldo > 0 ? 'var(--red-500)' : 'var(--green-500)' }}>
                  {formatCurrency(proyecto.saldo)}
                </strong>
              </div>
            </div>
            <p className="text-color-secondary text-xs mt-3 mb-0">
              Facturas y pagos disponibles en Sprint 3.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
