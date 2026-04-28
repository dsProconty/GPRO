'use client'

import { useEffect, useState, useMemo } from 'react'
import { Dialog } from 'primereact/dialog'
import { InputText } from 'primereact/inputtext'
import { InputTextarea } from 'primereact/inputtextarea'
import { InputNumber } from 'primereact/inputnumber'
import { Dropdown } from 'primereact/dropdown'
import { MultiSelect } from 'primereact/multiselect'
import { Calendar } from 'primereact/calendar'
import { Button } from 'primereact/button'
import { Tag } from 'primereact/tag'
import axios from 'axios'

const EMPTY = {
  titulo: '',
  descripcion: '',
  empresaId: null,
  valorEstimado: null,
  fechaCreacion: new Date(),
  aplicativo: '',
  responsableIds: [],
}

const LINEA_VACIA = { perfilId: null, horas: null, empleadoId: null, precioHora: null }

const fmt = (v) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(v ?? 0)

export default function PropuestaFormDialog({ visible, onHide, onSave, propuesta, empresas = [], usuarios = [] }) {
  const isEdit = !!propuesta

  // ── Formulario principal ──────────────────────────────────────
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  // ── Caso de negocio ───────────────────────────────────────────
  const [casoLineas, setCasoLineas] = useState([])          // líneas actuales
  const [lineasEliminadas, setLineasEliminadas] = useState([]) // perfilIds a eliminar en modo edición
  const [perfiles, setPerfiles] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [lineaForm, setLineaForm] = useState(null)          // null = panel cerrado
  const [lineaEditIdx, setLineaEditIdx] = useState(null)    // null = nuevo, número = editar
  const [cargandoTarifario, setCargandoTarifario] = useState(false)

  // ── Carga al abrir ────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return

    // Resetear estado
    setErrors({})
    setLineasEliminadas([])
    setLineaForm(null)
    setLineaEditIdx(null)

    if (propuesta) {
      setForm({
        titulo:         propuesta.titulo || '',
        descripcion:    propuesta.descripcion || '',
        empresaId:      propuesta.empresaId || null,
        valorEstimado:  propuesta.valorEstimado ?? null,
        fechaCreacion:  propuesta.fechaCreacion ? new Date(propuesta.fechaCreacion) : new Date(),
        aplicativo:     propuesta.aplicativo || '',
        responsableIds: propuesta.responsables?.map((r) => r.userId) || [],
      })
      // Cargar líneas existentes
      axios.get(`/api/v1/propuestas/${propuesta.id}/caso-negocio`)
        .then((res) => setCasoLineas((res.data.lineas || []).map((l) => ({ ...l, _isNew: false }))))
        .catch(() => setCasoLineas([]))
    } else {
      setForm(EMPTY)
      setCasoLineas([])
    }

    // Cargar perfiles y empleados para el selector
    Promise.all([
      axios.get('/api/v1/perfiles-consultor?activo=true'),
      axios.get('/api/v1/empleados?activo=true'),
    ]).then(([pfRes, emplRes]) => {
      setPerfiles(pfRes.data.data || [])
      setEmpleados(emplRes.data.data || [])
    }).catch(() => {})
  }, [visible, propuesta])

  // ── Helpers formulario principal ─────────────────────────────
  const set = (field) => (e) => {
    const val = e.target?.value ?? e.value ?? e
    setForm((prev) => ({ ...prev, [field]: val }))
    setErrors((prev) => ({ ...prev, [field]: null }))
  }

  const validate = () => {
    const errs = {}
    if (!form.titulo?.trim())    errs.titulo        = 'El título es requerido'
    if (!form.empresaId)          errs.empresaId     = 'La empresa es requerida'
    if (!form.fechaCreacion)      errs.fechaCreacion = 'La fecha de creación es requerida'
    return errs
  }

  // ── Helpers caso de negocio ───────────────────────────────────
  const perfilesUsados = useMemo(() => new Set(casoLineas.map((l) => l.perfilId)), [casoLineas])

  const perfilesOptions = useMemo(() =>
    perfiles
      .filter((p) => !perfilesUsados.has(p.id) || p.id === lineaForm?.perfilId)
      .map((p) => ({ label: `${p.nombre} · ${p.nivel}`, value: p.id })),
    [perfiles, perfilesUsados, lineaForm?.perfilId]
  )

  const empleadosOptions = useMemo(() => [
    { label: '— Sin asignar —', value: null },
    ...empleados.map((e) => ({
      label: `${e.nombre} ${e.apellido}${e.perfilBase ? ' · ' + e.perfilBase.nombre : ''}`,
      value: e.id,
    })),
  ], [empleados])

  // Empresa y tarifario seleccionados
  const empresaSel      = useMemo(() => empresas.find((e) => e.id === form.empresaId) || null, [empresas, form.empresaId])
  const tarifarioActivo = empresaSel?.tarifario || null

  // Cargar tarifario de la empresa seleccionada
  const handleCargarTarifario = async () => {
    if (!tarifarioActivo) return
    setCargandoTarifario(true)
    try {
      if (isEdit) {
        // En edición: el API crea las líneas directo en la BD
        await axios.put(`/api/v1/propuestas/${propuesta.id}/caso-negocio`)
        const res = await axios.get(`/api/v1/propuestas/${propuesta.id}/caso-negocio`)
        setCasoLineas((res.data.lineas || []).map((l) => ({ ...l, _isNew: false })))
        setLineasEliminadas([])
      } else {
        // En creación: cargar líneas del tarifario en estado local
        const res = await axios.get(`/api/v1/tarifarios/${tarifarioActivo.id}`)
        const lineasTarifario = res.data.data?.lineas || []
        const nuevasLineas = lineasTarifario.map((tl) => ({
          perfilId:   tl.perfilId,
          horas:      0,
          empleadoId: tl.empleadoId || null,
          precioHora: Number(tl.precioHora),
          costoHora:  tl.empleado ? Number(tl.empleado.costoHora) : Number(tl.perfil?.costoHora ?? 0),
          perfil:     tl.perfil   ? { nombre: tl.perfil.nombre, nivel: tl.perfil.nivel } : null,
          empleado:   tl.empleado ? { nombre: tl.empleado.nombre, apellido: tl.empleado.apellido } : null,
          _isNew:     true,
        }))
        setCasoLineas(nuevasLineas)
      }
    } catch {
      // silencioso — el usuario puede ver el error en toast del padre si es necesario
    } finally {
      setCargandoTarifario(false)
    }
  }

  // Perfil y empleado seleccionados en el form de línea (para preview)
  const perfilSel    = perfiles.find((p) => p.id === lineaForm?.perfilId)
  const empleadoSel  = empleados.find((e) => e.id === lineaForm?.empleadoId)
  const costoHEfect  = empleadoSel ? Number(empleadoSel.costoHora) : (perfilSel ? Number(perfilSel.costoHora) : null)
  const precioHEfect = lineaForm?.precioHora ?? (perfilSel ? Number(perfilSel.precioHora) : null)

  // Totales calculados en tiempo real
  const resumen = useMemo(() => {
    let totalHoras = 0, totalCosto = 0, totalPrecio = 0
    for (const l of casoLineas) {
      const horas  = l.horas ?? 0
      const costoH = l.costoHora  ?? Number(empleados.find((e) => e.id === l.empleadoId)?.costoHora  ?? perfiles.find((p) => p.id === l.perfilId)?.costoHora  ?? 0)
      const preciH = l.precioHora ?? Number(perfiles.find((p) => p.id === l.perfilId)?.precioHora ?? 0)
      totalHoras  += horas
      totalCosto  += horas * costoH
      totalPrecio += horas * preciH
    }
    const gm    = totalPrecio - totalCosto
    const gmPct = totalPrecio > 0 ? Math.round((gm / totalPrecio) * 100) : 0
    return { totalHoras, totalCosto, totalPrecio, gm, gmPct }
  }, [casoLineas, perfiles, empleados])

  const abrirNuevaLinea = () => {
    setLineaForm({ ...LINEA_VACIA })
    setLineaEditIdx(null)
  }

  const abrirEditarLinea = (idx) => {
    const l = casoLineas[idx]
    setLineaForm({ perfilId: l.perfilId, horas: l.horas, empleadoId: l.empleadoId || null, precioHora: l.precioHora ?? null })
    setLineaEditIdx(idx)
  }

  const guardarLinea = () => {
    if (!lineaForm?.perfilId || !lineaForm?.horas || lineaForm.horas <= 0) return
    const perfil   = perfiles.find((p) => p.id === lineaForm.perfilId)
    const empleado = empleados.find((e) => e.id === lineaForm.empleadoId)
    const nuevaLinea = {
      perfilId:   lineaForm.perfilId,
      horas:      lineaForm.horas,
      empleadoId: lineaForm.empleadoId || null,
      precioHora: lineaForm.precioHora ?? (perfil ? Number(perfil.precioHora) : null),
      costoHora:  empleado ? Number(empleado.costoHora) : (perfil ? Number(perfil.costoHora) : null),
      perfil:     perfil   ? { nombre: perfil.nombre, nivel: perfil.nivel }             : (lineaEditIdx !== null ? casoLineas[lineaEditIdx].perfil   : null),
      empleado:   empleado ? { nombre: empleado.nombre, apellido: empleado.apellido }   : null,
      _isNew:     lineaEditIdx !== null ? casoLineas[lineaEditIdx]._isNew : true,
    }
    setCasoLineas((prev) =>
      lineaEditIdx !== null
        ? prev.map((l, i) => (i === lineaEditIdx ? nuevaLinea : l))
        : [...prev, nuevaLinea]
    )
    setLineaForm(null)
    setLineaEditIdx(null)
  }

  const eliminarLinea = (idx) => {
    const linea = casoLineas[idx]
    if (isEdit && !linea._isNew) setLineasEliminadas((prev) => [...prev, linea.perfilId])
    setCasoLineas((prev) => prev.filter((_, i) => i !== idx))
  }

  // ── Submit ────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSaving(true)
    try {
      const payload = {
        titulo:         form.titulo.trim(),
        descripcion:    form.descripcion?.trim() || null,
        empresaId:      form.empresaId,
        valorEstimado:  form.valorEstimado ?? null,
        fechaCreacion:  form.fechaCreacion instanceof Date
          ? form.fechaCreacion.toISOString().slice(0, 10)
          : form.fechaCreacion,
        aplicativo:     form.aplicativo?.trim() || null,
        responsableIds: form.responsableIds,
      }

      let propuestaId
      if (isEdit) {
        await axios.put(`/api/v1/propuestas/${propuesta.id}`, payload)
        propuestaId = propuesta.id
        // Eliminar líneas que el usuario borró
        for (const perfilId of lineasEliminadas) {
          await axios.delete(`/api/v1/propuestas/${propuestaId}/caso-negocio?perfilId=${perfilId}`)
        }
      } else {
        const res = await axios.post('/api/v1/propuestas', payload)
        propuestaId = res.data.data.id
      }

      // Upsert todas las líneas actuales
      for (const linea of casoLineas) {
        await axios.post(`/api/v1/propuestas/${propuestaId}/caso-negocio`, {
          perfilId:   linea.perfilId,
          horas:      linea.horas,
          empleadoId: linea.empleadoId || null,
          precioHora: linea.precioHora ?? null,
        })
      }

      onSave()
    } catch (err) {
      const apiErrors = err.response?.data?.errors || {}
      const mapped = {}
      Object.keys(apiErrors).forEach((k) => { mapped[k] = apiErrors[k][0] })
      if (Object.keys(mapped).length > 0) setErrors(mapped)
      else setErrors({ _global: err.response?.data?.message || 'Error al guardar' })
    } finally {
      setSaving(false)
    }
  }

  const footer = (
    <div className="flex justify-content-end gap-2">
      <Button label="Cancelar" icon="pi pi-times" severity="secondary" outlined onClick={onHide} disabled={saving} />
      <Button label={isEdit ? 'Guardar cambios' : 'Crear propuesta'} icon="pi pi-check" onClick={handleSubmit} loading={saving} />
    </div>
  )

  return (
    <Dialog
      visible={visible}
      onHide={onHide}
      header={isEdit ? 'Editar Propuesta' : 'Nueva Propuesta'}
      style={{ width: '720px', maxWidth: '95vw' }}
      contentStyle={{ maxHeight: '75vh', overflowY: 'auto', padding: '1.25rem 1.5rem' }}
      footer={footer}
      modal
    >
      <div className="flex flex-column gap-3 mt-2">
        {errors._global && (
          <div className="p-2 surface-100 border-round text-red-600 text-sm">{errors._global}</div>
        )}

        {propuesta?.codigo && (
          <div className="flex align-items-center gap-2 p-2 surface-100 border-round">
            <i className="pi pi-hashtag text-color-secondary" />
            <span className="text-sm text-color-secondary">Código:</span>
            <span className="font-bold" style={{ fontFamily: 'monospace' }}>{propuesta.codigo}</span>
          </div>
        )}

        {/* Título */}
        <div className="flex flex-column gap-1">
          <label className="text-sm font-medium">Título <span className="text-red-500">*</span></label>
          <InputText value={form.titulo} onChange={set('titulo')} placeholder="Nombre de la propuesta" className={errors.titulo ? 'p-invalid' : ''} />
          {errors.titulo && <small className="text-red-500">{errors.titulo}</small>}
        </div>

        {/* Empresa */}
        <div className="flex flex-column gap-1">
          <label className="text-sm font-medium">Empresa cliente <span className="text-red-500">*</span></label>
          <Dropdown
            value={form.empresaId} options={empresas} optionLabel="nombre" optionValue="id"
            onChange={set('empresaId')} placeholder="Seleccionar empresa" filter
            className={errors.empresaId ? 'p-invalid' : ''}
          />
          {errors.empresaId && <small className="text-red-500">{errors.empresaId}</small>}
        </div>

        {/* Valor estimado + Fecha */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="flex flex-column gap-1">
            <label className="text-sm font-medium">Valor estimado (USD)</label>
            <InputNumber
              value={form.valorEstimado}
              onValueChange={(e) => { setForm((p) => ({ ...p, valorEstimado: e.value })); setErrors((p) => ({ ...p, valorEstimado: null })) }}
              mode="decimal" minFractionDigits={2} maxFractionDigits={2} placeholder="0.00"
              pt={{ input: { onPaste: (e) => {
                const text = e.clipboardData.getData('text').replace(/[$,\s]/g, '')
                const num = parseFloat(text)
                if (!isNaN(num)) {
                  e.preventDefault()
                  setForm((p) => ({ ...p, valorEstimado: num }))
                  setErrors((p) => ({ ...p, valorEstimado: null }))
                }
              }}}}
            />
          </div>
          <div className="flex flex-column gap-1">
            <label className="text-sm font-medium">Fecha de inicio <span className="text-red-500">*</span></label>
            <Calendar value={form.fechaCreacion} onChange={set('fechaCreacion')} dateFormat="dd/mm/yy" className={errors.fechaCreacion ? 'p-invalid' : ''} />
            {errors.fechaCreacion && <small className="text-red-500">{errors.fechaCreacion}</small>}
          </div>
        </div>

        {/* Responsables */}
        <div className="flex flex-column gap-1">
          <label className="text-sm font-medium">Responsables Proconty</label>
          <MultiSelect
            value={form.responsableIds} options={usuarios} optionLabel="name" optionValue="id"
            onChange={(e) => setForm((p) => ({ ...p, responsableIds: e.value }))}
            placeholder="Seleccionar responsables" display="chip"
            filter filterPlaceholder="Buscar responsable..."
          />
        </div>

        {/* Aplicativo */}
        <div className="flex flex-column gap-1">
          <label className="text-sm font-medium">Aplicativo</label>
          <InputText value={form.aplicativo} onChange={set('aplicativo')} placeholder="ej: CRV, Typing, Tips (opcional)" />
        </div>

        {/* Descripción */}
        <div className="flex flex-column gap-1">
          <label className="text-sm font-medium">Descripción / Alcance</label>
          <InputTextarea value={form.descripcion} onChange={set('descripcion')}
            placeholder="Descripción general de la propuesta..." rows={3} autoResize />
        </div>

        {/* ── Caso de Negocio ── */}
        <div style={{ border: '1px solid var(--surface-border)', borderRadius: '8px', overflow: 'hidden' }}>

          {/* Header caso */}
          <div style={{ padding: '10px 14px', background: '#f8fafc', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
              <span>📊</span>
              <span style={{ fontWeight: 600, fontSize: '13px' }}>Caso de Negocio</span>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>(opcional)</span>
              {tarifarioActivo && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '20px', background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8', fontSize: '10.5px', fontWeight: 600 }}>
                  💲 {tarifarioActivo.nombre}
                </span>
              )}
            </div>
            {!lineaForm && (
              <div style={{ display: 'flex', gap: '6px' }}>
                <Button
                  label="Cargar tarifario"
                  icon="pi pi-download"
                  size="small"
                  severity="secondary"
                  outlined
                  loading={cargandoTarifario}
                  disabled={!tarifarioActivo || !form.empresaId}
                  tooltip={
                    !form.empresaId           ? 'Primero selecciona una empresa'
                    : !tarifarioActivo        ? 'Esta empresa no tiene tarifario asignado'
                    : `Cargar líneas de "${tarifarioActivo.nombre}"`
                  }
                  tooltipOptions={{ position: 'top' }}
                  onClick={handleCargarTarifario}
                />
                <Button label="Agregar perfil" icon="pi pi-plus" size="small" onClick={abrirNuevaLinea} />
              </div>
            )}
          </div>

          {/* Formulario inline agregar/editar línea */}
          {lineaForm && (
            <div style={{ padding: '14px', background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div className="flex flex-column gap-1">
                  <label className="text-xs font-medium">Perfil <span className="text-red-500">*</span></label>
                  <Dropdown
                    value={lineaForm.perfilId} options={perfilesOptions}
                    onChange={(e) => setLineaForm((p) => ({ ...p, perfilId: e.value, empleadoId: null, precioHora: null }))}
                    placeholder="Seleccionar perfil" filter disabled={lineaEditIdx !== null}
                  />
                </div>
                <div className="flex flex-column gap-1">
                  <label className="text-xs font-medium">Consultor <span style={{ color: '#94a3b8', fontSize: '10px' }}>(opcional)</span></label>
                  <Dropdown
                    value={lineaForm.empleadoId} options={empleadosOptions}
                    onChange={(e) => setLineaForm((p) => ({ ...p, empleadoId: e.value }))}
                    placeholder="Sin consultor" filter
                  />
                </div>
                <div className="flex flex-column gap-1">
                  <label className="text-xs font-medium">Horas <span className="text-red-500">*</span></label>
                  <InputNumber
                    value={lineaForm.horas}
                    onValueChange={(e) => setLineaForm((p) => ({ ...p, horas: e.value }))}
                    minFractionDigits={0} maxFractionDigits={2} min={0.25} placeholder="0"
                  />
                </div>
                <div className="flex flex-column gap-1">
                  <label className="text-xs font-medium">
                    Precio/hora
                    {perfilSel && <span style={{ color: '#94a3b8', fontSize: '10px', marginLeft: '4px' }}>(base: {fmt(perfilSel.precioHora)}/h)</span>}
                  </label>
                  <InputNumber
                    value={lineaForm.precioHora}
                    onValueChange={(e) => setLineaForm((p) => ({ ...p, precioHora: e.value }))}
                    mode="currency" currency="USD" locale="es-EC" minFractionDigits={2}
                    placeholder={perfilSel ? fmt(perfilSel.precioHora) : '0.00'}
                  />
                </div>
              </div>

              {/* Preview de totales */}
              {lineaForm.horas > 0 && costoHEfect !== null && (
                <div style={{ display: 'flex', gap: '20px', fontSize: '12px', color: '#64748b', marginBottom: '10px', padding: '8px 10px', background: '#fff', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                  <span>Costo: <strong>{fmt(lineaForm.horas * costoHEfect)}</strong></span>
                  {precioHEfect && <span>Ingreso: <strong style={{ color: '#15803d' }}>{fmt(lineaForm.horas * precioHEfect)}</strong></span>}
                  {precioHEfect && costoHEfect && precioHEfect > 0 && (
                    <span>Margen: <strong style={{ color: '#2563eb' }}>{Math.round(((precioHEfect - costoHEfect) / precioHEfect) * 100)}%</strong></span>
                  )}
                </div>
              )}

              <div className="flex gap-2 justify-content-end">
                <Button label="Cancelar" size="small" severity="secondary" outlined
                  onClick={() => { setLineaForm(null); setLineaEditIdx(null) }} />
                <Button
                  label={lineaEditIdx !== null ? 'Guardar cambios' : 'Agregar'}
                  icon="pi pi-check" size="small"
                  onClick={guardarLinea}
                  disabled={!lineaForm?.perfilId || !lineaForm?.horas || lineaForm.horas <= 0}
                />
              </div>
            </div>
          )}

          {/* Tabla vacía */}
          {casoLineas.length === 0 && !lineaForm && (
            <div style={{ padding: '22px', textAlign: 'center', fontSize: '13px', color: '#94a3b8' }}>
              <i className="pi pi-info-circle mr-2" />
              {!form.empresaId
                ? 'Selecciona una empresa para habilitar el caso de negocio.'
                : tarifarioActivo
                  ? <>Sin líneas. Usa <strong>Cargar tarifario</strong> para precargar desde <em>{tarifarioActivo.nombre}</em>, o agrega perfiles manualmente.</>
                  : 'Sin líneas registradas. Agrega perfiles para calcular el presupuesto.'}
            </div>
          )}

          {/* Tabla con líneas */}
          {casoLineas.length > 0 && (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                  <colgroup>
                    <col style={{ width: '28%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '10%' }} />
                  </colgroup>
                  <thead>
                    <tr style={{ background: '#f8f9fa', borderBottom: '1px solid var(--surface-border)' }}>
                      {['Perfil / Consultor', 'Horas', 'Costo/h', 'Precio/h', 'Total Costo', 'Total Precio', ''].map((h, i) => (
                        <th key={i} style={{ padding: '7px 10px', textAlign: i === 0 ? 'left' : 'right', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {casoLineas.map((l, idx) => {
                      const costoH  = l.costoHora  ?? Number(empleados.find((e) => e.id === l.empleadoId)?.costoHora ?? perfiles.find((p) => p.id === l.perfilId)?.costoHora ?? 0)
                      const precioH = l.precioHora ?? Number(perfiles.find((p) => p.id === l.perfilId)?.precioHora ?? 0)
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 ? '#fafbfc' : '#fff' }}>
                          <td style={{ padding: '10px' }}>
                            <div className="font-semibold" style={{ fontSize: '12.5px' }}>{l.perfil?.nombre || '—'}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px' }}>
                              {l.perfil?.nivel && (
                                <Tag value={l.perfil.nivel}
                                  severity={l.perfil.nivel === 'Senior' ? 'success' : l.perfil.nivel === 'Semi Senior' ? 'info' : 'secondary'}
                                  style={{ fontSize: '0.6rem' }} />
                              )}
                              {l.empleado
                                ? <span style={{ fontSize: '10.5px', color: '#64748b' }}>👤 {l.empleado.nombre} {l.empleado.apellido}</span>
                                : <span style={{ fontSize: '10.5px', color: '#94a3b8', fontStyle: 'italic' }}>Sin consultor</span>}
                            </div>
                          </td>
                          <td style={{ padding: '10px', textAlign: 'right', color: '#1e293b' }}>{l.horas}h</td>
                          <td style={{ padding: '10px', textAlign: 'right', color: '#94a3b8' }}>{fmt(costoH)}</td>
                          <td style={{ padding: '10px', textAlign: 'right' }}>
                            <span style={{ color: '#3B82F6', fontWeight: 600 }}>{fmt(precioH)}</span>
                          </td>
                          <td style={{ padding: '10px', textAlign: 'right', color: '#64748b' }}>{fmt(l.horas * costoH)}</td>
                          <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700 }}>{fmt(l.horas * precioH)}</td>
                          <td style={{ padding: '10px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '2px', justifyContent: 'flex-end' }}>
                              <Button icon="pi pi-pencil" rounded text severity="info" size="small"
                                tooltip="Editar" tooltipOptions={{ position: 'top' }}
                                onClick={() => abrirEditarLinea(idx)} />
                              <Button icon="pi pi-trash" rounded text severity="danger" size="small"
                                tooltip="Eliminar" tooltipOptions={{ position: 'top' }}
                                onClick={() => eliminarLinea(idx)} />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#f8f9fa', borderTop: '2px solid var(--surface-border)', fontWeight: 700 }}>
                      <td style={{ padding: '8px 10px', fontSize: '12px' }}>TOTAL</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '12px' }}>{resumen.totalHoras}h</td>
                      <td /><td />
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '12px', color: '#64748b' }}>{fmt(resumen.totalCosto)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '12px', color: '#15803d' }}>{fmt(resumen.totalPrecio)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Barra de margen bruto */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderTop: '1px solid var(--surface-border)' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>Margen bruto</span>
                <div style={{ flex: 1, background: '#f1f3f4', borderRadius: '20px', height: '7px', overflow: 'hidden' }}>
                  <div style={{ width: `${resumen.gmPct}%`, height: '100%', borderRadius: '20px', background: 'linear-gradient(90deg,#16A34A,#22C55E)' }} />
                </div>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#15803d', whiteSpace: 'nowrap' }}>
                  {fmt(resumen.gm)} <span style={{ fontWeight: 400, fontSize: '11px' }}>({resumen.gmPct}%)</span>
                </span>
              </div>
            </>
          )}
        </div>
        {/* fin Caso de Negocio */}

      </div>
    </Dialog>
  )
}
