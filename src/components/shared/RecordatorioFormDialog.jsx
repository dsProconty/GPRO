'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog } from 'primereact/dialog'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { InputNumber } from 'primereact/inputnumber'
import { InputTextarea } from 'primereact/inputtextarea'
import { InputSwitch } from 'primereact/inputswitch'
import { Toast } from 'primereact/toast'
import { recordatorioService } from '@/services/recordatorioService'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function RecordatorioFormDialog({ visible, onHide, onSave, recordatorio, proyectoId }) {
  const toast = useRef(null)
  const emptyForm = { diaMes: null, descripcion: '', destinatarios: '', activo: true }

  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (visible) {
      if (recordatorio) {
        setForm({
          diaMes: recordatorio.diaMes,
          descripcion: recordatorio.descripcion,
          destinatarios: recordatorio.destinatarios,
          activo: recordatorio.activo,
        })
      } else {
        setForm(emptyForm)
      }
      setErrors({})
    }
  }, [recordatorio, visible])

  const validate = () => {
    const e = {}
    if (!form.diaMes || form.diaMes < 1 || form.diaMes > 28)
      e.diaMes = 'El día debe ser entre 1 y 28'
    if (!form.descripcion.trim())
      e.descripcion = 'La descripción es requerida'
    if (!form.destinatarios.trim()) {
      e.destinatarios = 'Ingresa al menos un email'
    } else {
      const emails = form.destinatarios.split(',').map((x) => x.trim()).filter(Boolean)
      if (emails.length === 0 || !emails.every((x) => EMAIL_REGEX.test(x)))
        e.destinatarios = 'Ingresa emails válidos separados por coma'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      if (recordatorio) {
        await recordatorioService.update(recordatorio.id, form)
      } else {
        await recordatorioService.create({ ...form, proyectoId })
      }
      onSave()
    } catch (err) {
      const msg = err.response?.data?.message || 'Error al guardar el recordatorio'
      toast.current?.show({ severity: 'error', summary: 'Error', detail: msg, life: 4000 })
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
        header={recordatorio ? 'Editar Recordatorio' : 'Nuevo Recordatorio de Facturación'}
        visible={visible}
        onHide={onHide}
        footer={footer}
        style={{ width: '520px' }}
        modal
        closable={!loading}
      >
        <div className="flex flex-column gap-3 pt-2">

          {/* Día del mes */}
          <div className="field mb-0">
            <label className="font-semibold block mb-1">
              Día del mes <span className="text-red-500">*</span>
              <span className="text-color-secondary font-normal text-sm ml-2">(1 al 28)</span>
            </label>
            <InputNumber
              value={form.diaMes}
              onValueChange={(e) => setForm({ ...form, diaMes: e.value })}
              min={1}
              max={28}
              showButtons
              className={`w-full ${errors.diaMes ? 'p-invalid' : ''}`}
              placeholder="Ej: 6"
            />
            {errors.diaMes && <small className="p-error">{errors.diaMes}</small>}
            <small className="text-color-secondary">
              El sistema enviará el email cada mes en este día.
            </small>
          </div>

          {/* Descripción */}
          <div className="field mb-0">
            <label className="font-semibold block mb-1">Descripción <span className="text-red-500">*</span></label>
            <InputTextarea
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              className={`w-full ${errors.descripcion ? 'p-invalid' : ''}`}
              placeholder="Ej: Factura mensual contrato de mantenimiento software"
              rows={3}
              autoResize
            />
            {errors.descripcion && <small className="p-error">{errors.descripcion}</small>}
          </div>

          {/* Destinatarios */}
          <div className="field mb-0">
            <label className="font-semibold block mb-1">Destinatarios <span className="text-red-500">*</span></label>
            <InputText
              value={form.destinatarios}
              onChange={(e) => setForm({ ...form, destinatarios: e.target.value })}
              className={`w-full ${errors.destinatarios ? 'p-invalid' : ''}`}
              placeholder="correo1@empresa.com, correo2@empresa.com"
            />
            {errors.destinatarios
              ? <small className="p-error">{errors.destinatarios}</small>
              : <small className="text-color-secondary">Separa múltiples emails con coma.</small>
            }
          </div>

          {/* Activo */}
          <div className="flex align-items-center gap-3">
            <InputSwitch
              checked={form.activo}
              onChange={(e) => setForm({ ...form, activo: e.value })}
            />
            <span className="text-sm">
              {form.activo
                ? <span className="text-green-600 font-semibold">Activo — se enviará el día {form.diaMes || '?'} de cada mes</span>
                : <span className="text-color-secondary">Inactivo — no se enviarán emails</span>
              }
            </span>
          </div>

        </div>
      </Dialog>
    </>
  )
}
