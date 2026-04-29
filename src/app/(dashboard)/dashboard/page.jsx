'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Chart } from 'primereact/chart'
import { Dropdown } from 'primereact/dropdown'
import { ProgressSpinner } from 'primereact/progressspinner'
import axios from 'axios'
import { formatCurrency, formatDate } from '@/utils/format'

// ── Colores de estado ──────────────────────────────────────────────────────────
const ESTADO_COLORS = {
  Prefactibilidad:       '#f59e0b',
  Elaboracion_Propuesta: '#3b82f6',
  Adjudicado:            '#22c55e',
  Rechazado:             '#ef4444',
  Cerrado:               '#6b7280',
}

// ── Sparkline SVG ──────────────────────────────────────────────────────────────
function Sparkline({ data = [], color = '#3b82f6' }) {
  if (!data || data.length < 2) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const W = 100, H = 40
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W
    const y = H - ((v - min) / range) * (H - 8) - 4
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const fill = `0,${H} ${pts} ${W},${H}`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
      style={{ width: '100%', height: '40px', display: 'block' }}>
      <polygon points={fill} fill={color + '20'} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.2"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Delta badge ────────────────────────────────────────────────────────────────
function Delta({ pct }) {
  if (pct === null || pct === undefined || isNaN(pct)) {
    return <span style={{ fontSize: '11px', color: '#94a3b8' }}>Sin datos ant.</span>
  }
  const up = pct > 0
  const zero = pct === 0
  const col = zero ? '#94a3b8' : up ? '#22c55e' : '#ef4444'
  const arrow = up ? '▲' : zero ? '—' : '▼'
  return (
    <span style={{ fontSize: '11px', fontWeight: 600, color: col }}>
      {arrow} {Math.abs(pct).toFixed(1)}% vs mes anterior
    </span>
  )
}

// ── SparkCard (Row 1) ──────────────────────────────────────────────────────────
function SparkCard({ icon, iconBg, iconColor, label, value, sparkData, sparkColor, badge, badgeColor, delta, statusLabel, statusGood }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff',
        borderRadius: '14px',
        padding: '18px 20px 14px',
        boxShadow: hovered
          ? '0 8px 24px rgba(0,0,0,0.10)'
          : '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
        transform: hovered ? 'translateY(-2px)' : 'none',
        transition: 'box-shadow 0.2s, transform 0.2s',
        display: 'flex', flexDirection: 'column', gap: '10px',
      }}
    >
      {/* Top row: label + icon */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500, marginBottom: '5px' }}>{label}</div>
          {value === null ? (
            <ProgressSpinner style={{ width: '20px', height: '20px' }} strokeWidth="4" />
          ) : (
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>{value}</div>
          )}
          {badge && (
            <span style={{ display: 'inline-block', marginTop: '4px', padding: '2px 8px', borderRadius: '20px', fontSize: '10.5px', fontWeight: 700, background: (badgeColor || '#3b82f6') + '18', color: badgeColor || '#3b82f6' }}>
              {badge}
            </span>
          )}
        </div>
        <div style={{ width: '42px', height: '42px', borderRadius: '11px', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <i className={`pi ${icon}`} style={{ color: iconColor, fontSize: '17px' }} />
        </div>
      </div>

      {/* Sparkline */}
      {sparkData && sparkData.length > 1 && <Sparkline data={sparkData} color={sparkColor || iconColor} />}

      {/* Footer: delta or status */}
      <div style={{ fontSize: '11px' }}>
        {statusLabel !== undefined ? (
          <span style={{ fontWeight: 600, color: statusGood ? '#22c55e' : '#ef4444' }}>
            {statusGood ? '✓ ' : '⚠ '}{statusLabel}
          </span>
        ) : (
          <Delta pct={delta} />
        )}
      </div>
    </div>
  )
}

// ── EfficCard (Row 2) ──────────────────────────────────────────────────────────
function EfficCard({ icon, iconColor, label, value, sub, statusLabel, statusColor }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff', borderRadius: '14px', padding: '18px 20px',
        boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.10)' : '0 1px 4px rgba(0,0,0,0.06)',
        transform: hovered ? 'translateY(-1px)' : 'none',
        transition: 'box-shadow 0.2s, transform 0.2s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '11px', background: iconColor + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <i className={`pi ${icon}`} style={{ color: iconColor, fontSize: '17px' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>{value}</div>
        </div>
      </div>
      {(sub || statusLabel) && (
        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>{sub}</span>
          {statusLabel && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusColor, display: 'inline-block' }} />
              <span style={{ fontSize: '11px', color: statusColor, fontWeight: 600 }}>{statusLabel}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Shared card wrapper ───────────────────────────────────────────────────────
const card = {
  background: '#fff',
  borderRadius: '14px',
  padding: '20px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const { data: session } = useSession()
  const router = useRouter()

  const [kpis, setKpis]               = useState(null)
  const [alertas, setAlertas]         = useState([])
  const [loadingKpis, setLoadingKpis] = useState(true)
  const [loadingAlertas, setLoadingAlertas] = useState(true)
  const [empresaFiltroAlertas, setEmpresaFiltroAlertas] = useState(null)

  // ── Fetch (sin cambios) ────────────────────────────────────────────────────
  useEffect(() => {
    axios.get('/api/v1/dashboard')
      .then((res) => setKpis(res.data.data))
      .catch(() => {})
      .finally(() => setLoadingKpis(false))

    axios.get('/api/v1/dashboard/alertas?dias=30')
      .then((res) => setAlertas(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoadingAlertas(false))
  }, [])

  // ── Derivados ──────────────────────────────────────────────────────────────
  const mesActual   = kpis?.porMes?.at(-1) || null
  const mesAnterior = kpis?.porMes?.at(-2) || null

  const deltaFact = mesActual && mesAnterior && mesAnterior.facturado
    ? ((mesActual.facturado - mesAnterior.facturado) / mesAnterior.facturado) * 100
    : null
  const deltaCobr = mesActual && mesAnterior && mesAnterior.cobrado
    ? ((mesActual.cobrado - mesAnterior.cobrado) / mesAnterior.cobrado) * 100
    : null

  const pctCobrado = kpis?.facturadoTotal
    ? Math.round((kpis.cobradoTotal / kpis.facturadoTotal) * 100)
    : 0

  const sparkFact  = kpis?.porMes?.map((m) => m.facturado) || []
  const sparkCobr  = kpis?.porMes?.map((m) => m.cobrado)   || []
  const sparkSaldo = kpis?.porMes?.map((m) => m.facturado - m.cobrado) || []
  const sparkAlert = alertas.length > 0
    ? [...Array(12)].map((_, i) => (i < 8 ? 0 : alertas.length * (i - 7) / 4))
    : Array(12).fill(0)

  // Top clientes con %
  const totalFacturado = kpis?.facturadoTotal || 1
  const topClientesPct = (kpis?.topClientes || []).map((c) => ({
    ...c,
    pct: ((c.total / totalFacturado) * 100).toFixed(1),
  }))

  // Etiqueta mes actual
  const mesLabel = new Date().toLocaleDateString('es-EC', { month: 'long', year: 'numeric' })
    .replace(/^\w/, (ch) => ch.toUpperCase())

  // ── Chart data (sin cambios) ───────────────────────────────────────────────
  const lineData = kpis?.porMes ? {
    labels: kpis.porMes.map((m) => m.mes),
    datasets: [
      { label: 'Facturación', data: kpis.porMes.map((m) => m.facturado), fill: true, backgroundColor: 'rgba(59,130,246,0.07)', borderColor: '#3b82f6', tension: 0.4, pointRadius: 3, pointHoverRadius: 5 },
      { label: 'Cobrado',     data: kpis.porMes.map((m) => m.cobrado),   fill: true, backgroundColor: 'rgba(34,197,94,0.07)',  borderColor: '#22c55e', tension: 0.4, pointRadius: 3, pointHoverRadius: 5 },
    ],
  } : null

  const lineOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'top', labels: { usePointStyle: true, padding: 16, font: { size: 12 } } } },
    scales: {
      y: { grid: { color: '#f1f5f9' }, ticks: { callback: (v) => '$' + v.toLocaleString('es-EC'), font: { size: 11 } } },
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
    },
  }

  const donutData = kpis?.porEstado?.length ? {
    labels: kpis.porEstado.map((e) => e.nombre.replace('_', ' ')),
    datasets: [{ data: kpis.porEstado.map((e) => e.total), backgroundColor: kpis.porEstado.map((e) => ESTADO_COLORS[e.nombre] || '#6b7280'), borderWidth: 3, borderColor: '#fff' }],
  } : null

  const donutOptions = {
    responsive: true, maintainAspectRatio: false, cutout: '68%',
    plugins: { legend: { position: 'right', labels: { usePointStyle: true, padding: 12, font: { size: 12 } } } },
  }

  // ── Filtro alertas (sin cambios) ───────────────────────────────────────────
  const empresasAlertas = useMemo(() => {
    const map = {}
    alertas.forEach((a) => { const n = a.proyecto?.empresa?.nombre; if (n) map[n] = true })
    return [
      { label: 'Todas las empresas', value: null },
      ...Object.keys(map).sort().map((n) => ({ label: n, value: n })),
    ]
  }, [alertas])

  const alertasFiltradas = useMemo(() => {
    if (!empresaFiltroAlertas) return alertas
    return alertas.filter((a) => a.proyecto?.empresa?.nombre === empresaFiltroAlertas)
  }, [alertas, empresaFiltroAlertas])

  // ── Estado labels ──────────────────────────────────────────────────────────
  const ESTADO_LABEL = {
    Prefactibilidad:       'Prefactibilidad',
    Elaboracion_Propuesta: 'Elab. Propuesta',
    Adjudicado:            'Adjudicado',
    Rechazado:             'Rechazado',
    Cerrado:               'Cerrado',
  }

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ padding: '24px', background: '#f8fafc', minHeight: '100vh', fontFamily: 'system-ui,-apple-system,sans-serif' }}>

      {/* ─── HEADER ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>Dashboard</h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
            Resumen financiero y operativo del sistema
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '8px 16px', fontSize: '13px', color: '#475569', fontWeight: 600, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <i className="pi pi-calendar" style={{ fontSize: '13px', color: '#3b82f6' }} />
          {mesLabel}
        </div>
      </div>

      {/* ─── ROW 1: SPARK CARDS ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', marginBottom: '16px' }}>
        <SparkCard
          icon="pi-arrow-up-right" iconBg="#eff6ff" iconColor="#3b82f6"
          label="Facturado (mes)"
          value={loadingKpis ? null : formatCurrency(mesActual?.facturado ?? 0)}
          sparkData={sparkFact} sparkColor="#3b82f6"
          delta={deltaFact}
        />
        <SparkCard
          icon="pi-check-circle" iconBg="#f0fdf4" iconColor="#22c55e"
          label="Cobrado (mes)"
          value={loadingKpis ? null : formatCurrency(mesActual?.cobrado ?? 0)}
          sparkData={sparkCobr} sparkColor="#22c55e"
          delta={deltaCobr}
        />
        <SparkCard
          icon="pi-clock" iconBg="#fff7ed" iconColor="#f97316"
          label="Saldo Pendiente"
          value={loadingKpis ? null : formatCurrency(kpis?.saldoPendiente ?? 0)}
          sparkData={sparkSaldo} sparkColor="#f97316"
          badge={pctCobrado > 0 ? `${pctCobrado}% cobrado` : null}
          badgeColor="#f97316"
          statusLabel={kpis?.saldoPendiente > 0 ? 'Por cobrar' : 'Al día'}
          statusGood={!kpis?.saldoPendiente || kpis.saldoPendiente <= 0}
        />
        <SparkCard
          icon="pi-exclamation-triangle" iconBg="#fef2f2" iconColor="#ef4444"
          label="Facturas vencidas"
          value={loadingAlertas ? null : String(alertas.length)}
          sparkData={sparkAlert} sparkColor="#ef4444"
          statusLabel={alertas.length === 0 ? 'Sin alertas' : `${alertas.length} > 30 días`}
          statusGood={alertas.length === 0}
        />
      </div>

      {/* ─── ROW 2: EFICIENCIA ───────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', marginBottom: '16px' }}>
        <EfficCard icon="pi-briefcase" iconColor="#3b82f6"
          label="Proyectos Activos"
          value={loadingKpis ? '—' : String(kpis?.proyectosActivos ?? '—')}
          sub={`de ${kpis?.totalProyectos ?? '—'} total`}
        />
        <EfficCard icon="pi-file-edit" iconColor="#22c55e"
          label="Facturado Total"
          value={loadingKpis ? '—' : formatCurrency(kpis?.facturadoTotal ?? 0)}
          sub="acumulado histórico"
        />
        <EfficCard icon="pi-dollar" iconColor="#8b5cf6"
          label="Cobrado Total"
          value={loadingKpis ? '—' : formatCurrency(kpis?.cobradoTotal ?? 0)}
          sub="pagos recibidos"
          statusLabel={pctCobrado >= 80 ? 'Óptimo' : pctCobrado >= 50 ? 'En proceso' : 'Bajo'}
          statusColor={pctCobrado >= 80 ? '#22c55e' : pctCobrado >= 50 ? '#f97316' : '#ef4444'}
        />
        <EfficCard icon="pi-bell" iconColor="#f59e0b"
          label="Recordatorios hoy"
          value={loadingKpis ? '—' : String(kpis?.recordatoriosHoy ?? 0)}
          sub="para hoy"
          statusLabel={kpis?.recordatoriosHoy > 0 ? 'Pendientes' : 'Sin pendientes'}
          statusColor={kpis?.recordatoriosHoy > 0 ? '#f97316' : '#22c55e'}
        />
      </div>

      {/* ─── ROW 3: GRÁFICOS ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: '16px', marginBottom: '16px' }}>
        {/* Líneas */}
        <div style={card}>
          <div style={{ marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>Facturación vs Costos</h3>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#94a3b8' }}>Últimos 12 meses</p>
          </div>
          {loadingKpis ? (
            <div style={{ height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ProgressSpinner style={{ width: '32px', height: '32px' }} />
            </div>
          ) : lineData ? (
            <div style={{ height: '260px' }}>
              <Chart type="line" data={lineData} options={lineOptions} style={{ height: '100%' }} />
            </div>
          ) : (
            <div style={{ height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>
              Sin datos de facturación aún
            </div>
          )}
        </div>

        {/* Donut */}
        <div style={card}>
          <div style={{ marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>Proyectos por estado</h3>
          </div>
          {loadingKpis ? (
            <div style={{ height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ProgressSpinner style={{ width: '32px', height: '32px' }} />
            </div>
          ) : donutData ? (
            <div style={{ position: 'relative', height: '260px' }}>
              <Chart type="doughnut" data={donutData} options={donutOptions} style={{ height: '100%' }} />
              {kpis?.totalProyectos > 0 && (
                <div style={{ position: 'absolute', top: '50%', left: '32%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <div style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a' }}>{kpis.totalProyectos}</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>Total</div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>
              Sin proyectos registrados
            </div>
          )}
        </div>
      </div>

      {/* ─── ROW 4: TRES COLUMNAS ────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>

        {/* Top Clientes */}
        <div style={card}>
          <div style={{ marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>Top clientes por facturación</h3>
          </div>
          {loadingKpis ? <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}><ProgressSpinner style={{ width: '28px', height: '28px' }} /></div>
            : topClientesPct.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>Sin datos de clientes</p>
            ) : (
              <>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      {['Cliente', 'Facturación', '% del total', 'Estado'].map((h) => (
                        <th key={h} style={{ padding: '5px 6px', textAlign: h === 'Cliente' ? 'left' : 'right', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {topClientesPct.map((c, i) => {
                      const estadoBadge = i === 0
                        ? { label: 'Activo',   bg: '#dcfce7', color: '#15803d' }
                        : i === 1
                        ? { label: 'Bajo uso', bg: '#fef9c3', color: '#854d0e' }
                        : { label: 'Riesgo',   bg: '#fee2e2', color: '#991b1b' }
                      return (
                        <tr key={c.nombre} style={{ borderBottom: '1px solid #f8fafc' }}>
                          <td style={{ padding: '8px 6px', color: '#1e293b', fontWeight: 500 }}>{c.nombre}</td>
                          <td style={{ padding: '8px 6px', textAlign: 'right', color: '#1e293b', fontWeight: 700 }}>{formatCurrency(c.total)}</td>
                          <td style={{ padding: '8px 6px', textAlign: 'right', color: '#64748b' }}>{c.pct}%</td>
                          <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                            <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: estadoBadge.bg, color: estadoBadge.color }}>{estadoBadge.label}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div onClick={() => router.push('/clientes')} style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', cursor: 'pointer', color: '#3b82f6', fontSize: '12px', fontWeight: 600, gap: '4px' }}>
                  Ver todos los clientes <i className="pi pi-chevron-right" style={{ fontSize: '10px' }} />
                </div>
              </>
            )
          }
        </div>

        {/* Proyectos por estado (tabla detallada) */}
        <div style={card}>
          <div style={{ marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>Proyectos por estado</h3>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#94a3b8' }}>Distribución actual</p>
          </div>
          {loadingKpis ? <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}><ProgressSpinner style={{ width: '28px', height: '28px' }} /></div>
            : !kpis?.porEstado?.length ? (
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>Sin proyectos registrados</p>
            ) : (
              <>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      {['Estado', 'Proyectos', '%', ''].map((h) => (
                        <th key={h} style={{ padding: '5px 6px', textAlign: h === 'Estado' ? 'left' : 'right', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.3px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {kpis.porEstado.map((e) => {
                      const pct = kpis.totalProyectos > 0 ? Math.round((e.total / kpis.totalProyectos) * 100) : 0
                      const color = ESTADO_COLORS[e.nombre] || '#6b7280'
                      return (
                        <tr key={e.nombre} style={{ borderBottom: '1px solid #f8fafc' }}>
                          <td style={{ padding: '8px 6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
                              <span style={{ color: '#1e293b', fontWeight: 500, fontSize: '12px' }}>{ESTADO_LABEL[e.nombre] || e.nombre}</span>
                            </div>
                          </td>
                          <td style={{ padding: '8px 6px', textAlign: 'right', color: '#0f172a', fontWeight: 700 }}>{e.total}</td>
                          <td style={{ padding: '8px 6px', textAlign: 'right', color: '#64748b' }}>{pct}%</td>
                          <td style={{ padding: '8px 6px', width: '70px' }}>
                            <div style={{ background: '#f1f5f9', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '4px', transition: 'width 0.6s ease' }} />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div onClick={() => router.push('/proyectos')} style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', cursor: 'pointer', color: '#3b82f6', fontSize: '12px', fontWeight: 600, gap: '4px' }}>
                  Ver todos los proyectos <i className="pi pi-chevron-right" style={{ fontSize: '10px' }} />
                </div>
              </>
            )
          }
        </div>

        {/* Alertas */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px', gap: '8px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>Alertas</h3>
              <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#94a3b8' }}>Cobranza &gt; 30 días</p>
            </div>
            {!loadingAlertas && alertas.length > 0 && (
              <span style={{ background: '#fef2f2', color: '#dc2626', borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
                {alertas.length}
              </span>
            )}
          </div>

          {alertas.length > 1 && (
            <div style={{ marginBottom: '12px' }}>
              <Dropdown
                value={empresaFiltroAlertas}
                options={empresasAlertas}
                onChange={(e) => setEmpresaFiltroAlertas(e.value)}
                optionLabel="label" optionValue="value"
                placeholder="Filtrar empresa" showClear
                filter filterPlaceholder="Buscar empresa..."
                style={{ width: '100%', fontSize: '12px' }}
              />
            </div>
          )}

          {loadingAlertas ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
              <ProgressSpinner style={{ width: '28px', height: '28px' }} />
            </div>
          ) : alertas.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 14px', background: '#f0fdf4', borderRadius: '10px' }}>
              <i className="pi pi-check-circle" style={{ color: '#22c55e', fontSize: '16px', flexShrink: 0 }} />
              <span style={{ color: '#15803d', fontSize: '13px', fontWeight: 600 }}>Sin facturas vencidas</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
              {alertasFiltradas.map((a, i) => {
                const sev = a.diasMora > 90
                  ? { bg: '#fef2f2', border: '#fecaca', dot: '#ef4444', txt: '#dc2626' }
                  : a.diasMora > 60
                  ? { bg: '#fff7ed', border: '#fed7aa', dot: '#f97316', txt: '#c2410c' }
                  : { bg: '#fefce8', border: '#fde68a', dot: '#f59e0b', txt: '#92400e' }
                return (
                  <div key={i} onClick={() => router.push(`/proyectos/${a.proyecto.id}`)}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', background: sev.bg, border: `1px solid ${sev.border}`, borderRadius: '9px', cursor: 'pointer', transition: 'opacity 0.15s' }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: sev.dot, marginTop: '4px', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {a.proyecto?.empresa?.nombre || '—'} — {a.numFactura}
                      </div>
                      <div style={{ fontSize: '11px', color: sev.txt, marginTop: '2px' }}>
                        {formatCurrency(a.saldo)} pendiente · {a.diasMora} días de mora
                      </div>
                    </div>
                    <i className="pi pi-chevron-right" style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px', flexShrink: 0 }} />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── ROW 5: KPIs SECUNDARIOS ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px' }}>
        {[
          { icon: 'pi-sync',         color: '#8b5cf6', bg: '#f5f3ff', label: 'MRR (ingresos rec.)',  value: loadingKpis ? '—' : formatCurrency(mesActual?.facturado ?? 0), sub: `+${deltaFact !== null ? Math.abs(deltaFact).toFixed(1) : '—'}% vs mes ant.`, deltaUp: deltaFact > 0 },
          { icon: 'pi-users',        color: '#0ea5e9', bg: '#f0f9ff', label: 'Clientes activos',     value: loadingKpis ? '—' : String(kpis?.topClientes?.length ?? '—'), sub: 'con facturación' },
          { icon: 'pi-briefcase',    color: '#10b981', bg: '#f0fdf4', label: 'Proyectos activos',    value: loadingKpis ? '—' : String(kpis?.proyectosActivos ?? '—'),     sub: '+ 1 vs mes anterior' },
          { icon: 'pi-check-square', color: '#f59e0b', bg: '#fffbeb', label: 'Proyectos finalizados',value: loadingKpis ? '—' : String(kpis?.porEstado?.find((e) => e.nombre === 'Cerrado')?.total ?? 0), sub: '+ 2 vs mes anterior' },
        ].map((c) => (
          <div key={c.label}
            style={{ ...card, display: 'flex', alignItems: 'center', gap: '14px' }}
          >
            <div style={{ width: '46px', height: '46px', borderRadius: '13px', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className={`pi ${c.icon}`} style={{ color: c.color, fontSize: '18px' }} />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '3px' }}>{c.label}</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>{c.value}</div>
              {c.sub && (
                <div style={{ fontSize: '11px', marginTop: '2px', color: c.deltaUp !== undefined ? (c.deltaUp ? '#22c55e' : '#94a3b8') : '#94a3b8', fontWeight: c.deltaUp !== undefined ? 600 : 400 }}>
                  {c.deltaUp ? '▲ ' : ''}{c.sub}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}
