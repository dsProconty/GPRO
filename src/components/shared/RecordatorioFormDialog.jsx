'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog } from 'primereact/dialog'
import { Button } from 'primereact/button'
import { InputText } from '@/components/shared/InputText'
import { InputNumber } from 'primereact/inputnumber'
import { InputTextarea } from '@/components/shared/InputTextarea'
import { InputSwitch } from 'primereact/inputswitch'
import { SelectButton } from 'primereact/selectbutton'
import { Dropdown } from 'primereact/dropdown'
import { Toast } from 'primereact/toast'
import { recordatorioService } from '@/services/recordatorioService'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const FRECUENCIA_OPTIONS = [
  { label: '📅 Mensual', value: 'mensual' },
  { label: '🗓️ Anual', value: 'anual' },
]

const MES_OPTIONS = [
  { label: 'Enero', value: 1 }, { label: 'Febrero', value: 2 }, { label: 'Marzo', value: 3 },
  { label: 'Abril', value: 4 }, { label: 'Mayo', value: 5 }, { label: 'Junio', value: 6 },
  { label: 'Julio', value: 7 }, { label: 'Agosto', value: 8 }, { label: 'Septiembre', value: 9 },
  { label: 'Octubre', value: 10 }, { label: 'Noviembre', value: 11 }, { label: 'Diciembre', value: 12 },
]

export default function RecordatorioFormDialog({ visible, onHide, onSave, recordatorio, proyectoId }) {
  const toast = useRef(null)
  const emptyForm = { diaMes: null, frecuencia: 'mensual', mes: null, descripcion: '', destinatarios: '', activo: true }

  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (visible) {
      if (recordatorio) {
        setForm({
          diaMes: recordatorio.diaMes,
          frecuencia: recordatorio.frecuencia || 'mensual',
          mes: recordatorio.mes || null,
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
    if (form.frecuencia === 'anual' && !form.mes)
      e.mes = 'Selecciona el mes'
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

          {/* Frecuencia */}
          <div className="field mb-0">
            <label className="font-semibold block mb-1">Frecuencia</label>
            <SelectButton
              value={form.frecuencia}
              options={FRECUENCIA_OPTIONS}
              onChange={(e) => {
                if (e.value) setForm({ ...form, frecuencia: e.value })
              }}
            />
            {form.frecuencia === 'anual' && (
              <small className="text-color-secondary">
                Ideal para renovaciones de servicios anuales.
              </small>
            )}
          </div>

          {/* Día / Mes */}
          <div className={form.frecuencia === 'anual' ? 'grid formgrid' : ''}>
            <div className={`field mb-0 ${form.frecuencia === 'anual' ? 'col-6' : ''}`}>
              <label className="font-semibold block mb-1">
                Día <span className="text-red-500">*</span>
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
            </div>
            {form.frecuencia === 'anual' && (
              <div className="field mb-0 col-6">
                <label className="font-semibold block mb-1">Mes <span className="text-red-500">*</span></label>
                <Dropdown
                  value={form.mes}
                  options={MES_OPTIONS}
                  onChange={(e) => setForm({ ...form, mes: e.value })}
                  placeholder="Selecciona el mes"
                  className={`w-full ${errors.mes ? 'p-invalid' : ''}`}
                />
                {errors.mes && <small className="p-error">{errors.mes}</small>}
              </div>
            )}
          </div>
          <small className="text-color-secondary" style={{ marginTop: '-8px' }}>
            {form.frecuencia === 'anual'
              ? 'El sistema enviará el email una vez al año, en el día y mes elegidos.'
              : 'El sistema enviará el email cada mes en este día.'}
          </small>

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
                ? <span className="text-green-600 font-semibold">
                    Activo — se enviará el día {form.diaMes || '?'}
                    {form.frecuencia === 'anual'
                      ? ` de ${MES_OPTIONS.find((m) => m.value === form.mes)?.label || '?'}, cada año`
                      : ' de cada mes'}
                  </span>
                : <span className="text-color-secondary">Inactivo — no se enviarán emails</span>
              }
            </span>
          </div>

        </div>
      </Dialog>
    </>
  )
}
