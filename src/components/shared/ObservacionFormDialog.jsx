'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog } from 'primereact/dialog'
import { Button } from 'primereact/button'
import { InputTextarea } from 'primereact/inputtextarea'
import { Toast } from 'primereact/toast'
import { observacionService } from '@/services/observacionService'

export default function ObservacionFormDialog({ visible, onHide, onSave, proyectoId }) {
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
      await observacionService.create({ proyectoId, descripcion })
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
        header="Nueva Observación"
        visible={visible}
        onHide={onHide}
        footer={footer}
        style={{ width: '500px' }}
        modal
        closable={!loading}
      >
        <div className="pt-2">
          <InputTextarea
            value={descripcion}
            onChange={(e) => { setDescripcion(e.target.value); setError('') }}
            className={`w-full ${error ? 'p-invalid' : ''}`}
            rows={5}
            placeholder="Escribe la observación o nota sobre el proyecto..."
            autoFocus
          />
          {error && <small className="p-error">{error}</small>}
          <p className="text-color-secondary text-xs mt-2 mb-0">
            <i className="pi pi-lock mr-1" />Las observaciones son inmutables — no se pueden editar ni eliminar.
          </p>
        </div>
      </Dialog>
    </>
  )
}
