'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog } from 'primereact/dialog'
import { Button } from 'primereact/button'
import { InputTextarea } from '@/components/shared/InputTextarea'
import { Toast } from 'primereact/toast'
import { observacionService } from '@/services/observacionService'

export default function ObservacionFormDialog({ visible, onHide, onSave, proyectoId, respuestaA }) {
  const toast = useRef(null)
  const [descripcion, setDescripcion] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (visible) { setDescripcion(''); setError('') }
  }, [visible])

  const handleSubmit = async () => {
    if (!descripcion.trim()) { setError('La observación no puede estar vacía'); return }
    setLoading(true)
    try {
      await observacionService.create({ proyectoId, descripcion, respuestaAId: respuestaA?.id || null })
      onSave()
    } catch (err) {
      const msg = err.response?.data?.message || 'Error al guardar la observación'
      toast.current.show({ severity: 'error', summary: 'Error', detail: msg, life: 4000 })
    } finally {
      setLoading(false)
    }
  }

  const footer = (
    <div>
      <Button label="Cancelar" icon="pi pi-times" severity="secondary" text onClick={onHide} disabled={loading} />
      <Button label="Guardar" icon="pi pi-check" onClick={handleSubmit} loading={loading} />
    </div>
  )

  return (
    <>
      <Toast ref={toast} />
      <Dialog
        header={respuestaA ? 'Responder Observación' : 'Nueva Observación'}
        visible={visible}
        onHide={onHide}
        footer={footer}
        style={{ width: '500px' }}
        modal
        closable={!loading}
      >
        <div className="pt-2">
          {respuestaA && (
            <div className="surface-100 border-round p-3 mb-3 border-left-3" style={{ borderColor: 'var(--surface-400)' }}>
              <div className="text-xs text-color-secondary mb-1">
                <i className="pi pi-reply mr-1" />Respondiendo a <strong>{respuestaA.user?.name}</strong>
              </div>
              <p className="m-0 text-sm text-color-secondary" style={{ fontStyle: 'italic' }}>
                “{respuestaA.descripcion.length > 140 ? respuestaA.descripcion.slice(0, 140) + '…' : respuestaA.descripcion}”
              </p>
            </div>
          )}
          <InputTextarea
            value={descripcion}
            onChange={(e) => { setDescripcion(e.target.value); setError('') }}
            className={`w-full ${error ? 'p-invalid' : ''}`}
            rows={5}
            placeholder={respuestaA ? 'Escribe tu respuesta...' : 'Escribe la observación o nota sobre el proyecto...'}
            autoFocus
          />
          {error && <small className="p-error">{error}</small>}
          <p className="text-color-secondary text-xs mt-2 mb-0">
            <i className="pi pi-lock mr-1" />Las observaciones son inmutables — no se pueden editar ni eliminar.
            {respuestaA && ' Se le notificará por email a quien escribió el comentario original.'}
          </p>
        </div>
      </Dialog>
    </>
  )
}
