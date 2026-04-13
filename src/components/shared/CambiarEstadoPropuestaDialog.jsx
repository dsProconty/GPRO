'use client'

import { useEffect, useState } from 'react'
import { Dialog } from 'primereact/dialog'
import { InputTextarea } from 'primereact/inputtextarea'
import { Button } from 'primereact/button'
import { Tag } from 'primereact/tag'

// Fallback por si propuestaConfig no está cargado aún
const FALLBACK = {
  Factibilidad: { severity: 'warning',   label: 'Factibilidad',        icon: 'pi-lightbulb'    },
  Haciendo:     { severity: 'info',      label: 'Generando Propuesta',  icon: 'pi-cog'          },
  Enviada:      { severity: 'secondary', label: 'Propuesta Enviada',    icon: 'pi-send'         },
  Aprobada:     { severity: 'success',   label: 'Propuesta Aceptada',   icon: 'pi-check-circle' },
  Rechazada:    { severity: 'danger',    label: 'Propuesta Rechazada',  icon: 'pi-times-circle' },
}

export default function CambiarEstadoPropuestaDialog({
  visible, onHide, onConfirm, estadoActual, estadoDestino, saving, propuestaConfig = {},
}) {
  const [nota, setNota] = useState('')
  useEffect(() => { if (visible) setNota('') }, [visible])

  const config = Object.keys(propuestaConfig).length > 0 ? propuestaConfig : FALLBACK
  const cfgActual  = config[estadoActual]  || { severity: 'secondary', label: estadoActual,  icon: 'pi-circle' }
  const cfgDestino = config[estadoDestino] || { severity: 'secondary', label: estadoDestino, icon: 'pi-circle' }

  const esAprobada  = estadoDestino === 'Aprobada'
  const esRechazada = estadoDestino === 'Rechazada'
  const btnSeverity = esAprobada ? 'success' : esRechazada ? 'danger' : 'primary'
  const btnLabel    = esAprobada ? 'Aprobar propuesta' : esRechazada ? 'Rechazar propuesta' : 'Mover a ' + cfgDestino.label

  const footer = (
    <div className="flex justify-content-end gap-2">
      <Button label="Cancelar" icon="pi pi-times" severity="secondary" outlined onClick={onHide} disabled={saving} />
      <Button label={btnLabel} icon={'pi ' + cfgDestino.icon} severity={btnSeverity} onClick={() => onConfirm(nota)} loading={saving} />
    </div>
  )

  return (
    <Dialog visible={visible} onHide={onHide} header="Cambiar estado" style={{ width: '420px' }} footer={footer} modal>
      <div className="flex flex-column gap-3 mt-2">
        {/* Flecha de transición */}
        <div className="flex align-items-center justify-content-center gap-3 p-3 surface-50 border-round">
          <Tag value={cfgActual.label} severity={cfgActual.severity} style={{ fontSize: '0.9rem' }} />
          <i className="pi pi-arrow-right text-color-secondary text-xl" />
          <Tag value={cfgDestino.label} severity={cfgDestino.severity} style={{ fontSize: '0.9rem' }} />
        </div>

        {/* Aviso especial si es Aprobada */}
        {esAprobada && (
          <div className="flex align-items-start gap-2 p-3 border-round" style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
            <i className="pi pi-info-circle text-green-600 mt-1" />
            <div className="text-sm text-green-800">
              <strong>Se creará un proyecto automáticamente</strong> en estado "Adjudicado" con los datos de esta propuesta.
            </div>
          </div>
        )}

        {/* Nota opcional */}
        <div className="flex flex-column gap-1">
          <label className="text-sm font-medium">Nota (opcional)</label>
          <InputTextarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Agrega una nota sobre este cambio de estado..."
            rows={3}
            autoResize
          />
        </div>
      </div>
    </Dialog>
  )
}
