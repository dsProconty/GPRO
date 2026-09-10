'use client'

import { useEffect, useState } from 'react'
import { Dialog } from 'primereact/dialog'
import { InputTextarea } from '@/components/shared/InputTextarea'
import { Dropdown } from 'primereact/dropdown'
import { Button } from 'primereact/button'
import { Tag } from 'primereact/tag'
import { ETAPA_CONFIG, TRANSICIONES, ETAPA_HOOK } from '@/lib/oportunidades'

const NUEVA_EMPRESA = '__NUEVA__'

function EtapaTag({ etapa }) {
  const cfg = ETAPA_CONFIG[etapa] || { label: etapa, severity: 'secondary' }
  return <Tag value={cfg.label} severity={cfg.severity} style={cfg.color ? { background: cfg.color, color: '#fff' } : undefined} />
}

export default function CambiarEtapaOportunidadDialog({ visible, onHide, onConfirm, oportunidad, saving, empresas = [] }) {
  const [destino, setDestino] = useState(null)
  const [nota, setNota] = useState('')
  const [motivoPerdida, setMotivoPerdida] = useState('')
  const [empresaId, setEmpresaId] = useState(NUEVA_EMPRESA)

  useEffect(() => {
    if (visible) { setDestino(null); setNota(''); setMotivoPerdida(''); setEmpresaId(NUEVA_EMPRESA) }
  }, [visible])

  useEffect(() => {
    if (destino === ETAPA_HOOK && oportunidad) {
      const match = empresas.find((e) => e.nombre?.trim().toLowerCase() === oportunidad.empresaNombre?.trim().toLowerCase())
      setEmpresaId(match ? match.id : NUEVA_EMPRESA)
    }
  }, [destino, oportunidad, empresas])

  if (!oportunidad) return null

  const etapaActual = oportunidad.etapa
  const permitidas = TRANSICIONES[etapaActual] || []
  const esHook = destino === ETAPA_HOOK
  const esSuspenso = destino === 'En_Suspenso'
  const esPerdida = destino === 'Perdida'

  const footer = (
    <div className="flex justify-content-end gap-2">
      <Button label="Cancelar" icon="pi pi-times" severity="secondary" outlined onClick={onHide} disabled={saving} />
      <Button
        label={esHook ? 'Confirmar y generar Propuesta' : 'Confirmar cambio'}
        icon="pi pi-check"
        severity={esHook ? 'success' : esPerdida ? 'danger' : 'primary'}
        onClick={() => onConfirm({ etapaNueva: destino, nota, motivoPerdida, empresaId: esHook ? (empresaId === NUEVA_EMPRESA ? null : empresaId) : undefined })}
        loading={saving}
        disabled={!destino || (esHook && !empresaId)}
      />
    </div>
  )

  return (
    <Dialog visible={visible} onHide={onHide} header={`Cambiar etapa · ${oportunidad.empresaNombre}`} style={{ width: '480px', maxWidth: '95vw' }} footer={footer} modal>
      <div className="flex flex-column gap-3 mt-2">
        <div className="flex flex-column gap-1">
          <label className="text-sm font-medium">Etapa actual</label>
          <div><EtapaTag etapa={etapaActual} /></div>
        </div>

        <div className="flex flex-column gap-2">
          <label className="text-sm font-medium">Nueva etapa</label>
          <div className="flex flex-wrap gap-2">
            {permitidas.map((etapa) => {
              const cfg = ETAPA_CONFIG[etapa]
              const selected = destino === etapa
              return (
                <Button
                  key={etapa}
                  type="button"
                  label={cfg.label}
                  size="small"
                  outlined={!selected}
                  severity={cfg.severity === 'secondary' ? 'secondary' : cfg.severity}
                  style={selected && cfg.color ? { background: cfg.color, borderColor: cfg.color, color: '#fff' } : undefined}
                  onClick={() => setDestino(etapa)}
                />
              )
            })}
          </div>
        </div>

        {esHook && (
          <div className="flex flex-column gap-2 p-3 border-round" style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
            <div className="flex align-items-start gap-2">
              <i className="pi pi-info-circle text-green-600 mt-1" />
              <div className="text-sm text-green-800">
                Al mover esta oportunidad a <strong>Solicitud de RFP</strong>, GPRO creará automáticamente una <strong>Propuesta</strong> en estado Factibilidad, con el título y valor estimado precargados.
              </div>
            </div>
            <div className="flex flex-column gap-1">
              <label className="text-sm font-medium text-green-800">Asignar propuesta al cliente</label>
              <Dropdown
                value={empresaId}
                options={[
                  { label: `➕ Crear nuevo cliente: "${oportunidad.empresaNombre}"`, value: NUEVA_EMPRESA },
                  ...empresas.map((e) => ({ label: e.nombre, value: e.id })),
                ]}
                onChange={(e) => setEmpresaId(e.value)}
                filter
                className="w-full"
              />
            </div>
          </div>
        )}

        {esSuspenso && (
          <div className="flex align-items-start gap-2 p-3 border-round" style={{ background: '#ede9fe', border: '1px solid #c4b5fd' }}>
            <i className="pi pi-info-circle mt-1" style={{ color: '#6d28d9' }} />
            <div className="text-sm" style={{ color: '#6d28d9' }}>
              La oportunidad puede reactivarse más adelante — "En Suspenso" no es un cierre definitivo.
            </div>
          </div>
        )}

        {esPerdida && (
          <div className="flex flex-column gap-1">
            <label className="text-sm font-medium">Motivo de pérdida</label>
            <InputTextarea value={motivoPerdida} onChange={(e) => setMotivoPerdida(e.target.value)} placeholder="Ej. presupuesto insuficiente, eligió otro proveedor..." rows={2} autoResize />
          </div>
        )}

        <div className="flex flex-column gap-1">
          <label className="text-sm font-medium">Nota (opcional)</label>
          <InputTextarea value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Detalle del cambio de etapa..." rows={2} autoResize />
        </div>
      </div>
    </Dialog>
  )
}
