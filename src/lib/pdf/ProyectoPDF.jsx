import {
  Document, Page, Text, View, StyleSheet, Font,
} from '@react-pdf/renderer'

// ── Estilos ───────────────────────────────────────────────────────────────────
const C = {
  primary:   '#1e3a5f',
  accent:    '#2e75b6',
  success:   '#22c55e',
  danger:    '#ef4444',
  warning:   '#f59e0b',
  gray:      '#6b7280',
  lightGray: '#f3f4f6',
  border:    '#e5e7eb',
  white:     '#ffffff',
}

const ESTADO_COLORS = {
  Prefactibilidad:       C.warning,
  Elaboracion_Propuesta: C.accent,
  Adjudicado:            C.success,
  Rechazado:             C.danger,
  Cerrado:               C.gray,
}

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, padding: 36, color: '#111827', backgroundColor: C.white },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 14, borderBottom: `2px solid ${C.primary}` },
  headerLeft: { flex: 1 },
  logoBox: { backgroundColor: C.primary, padding: '6 10', borderRadius: 4, marginBottom: 6, alignSelf: 'flex-start' },
  logoText: { color: C.white, fontSize: 14, fontFamily: 'Helvetica-Bold', letterSpacing: 1 },
  proyectoNombre: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.primary, marginBottom: 4 },
  headerRight: { alignItems: 'flex-end' },
  estadoBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginBottom: 6 },
  estadoText: { color: C.white, fontSize: 8, fontFamily: 'Helvetica-Bold' },
  fechaGen: { fontSize: 7, color: C.gray },

  // Sections
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.primary, marginBottom: 8, paddingBottom: 4, borderBottom: `1px solid ${C.border}` },

  // Grid info
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  infoItem: { width: '50%', marginBottom: 6 },
  infoLabel: { fontSize: 7, color: C.gray, marginBottom: 2 },
  infoValue: { fontSize: 9, fontFamily: 'Helvetica-Bold' },

  // Financial summary
  finRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 4 },
  finLabel: { fontSize: 9, color: C.gray },
  finValue: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  finDivider: { borderTop: `1px solid ${C.border}`, marginVertical: 4 },
  progressBar: { height: 5, borderRadius: 3, backgroundColor: C.border, marginTop: 4 },
  progressFill: { height: 5, borderRadius: 3 },

  // Tables
  table: { marginTop: 4 },
  tableHeader: { flexDirection: 'row', backgroundColor: C.primary, padding: '5 6', borderRadius: '3 3 0 0' },
  tableHeaderCell: { color: C.white, fontSize: 7, fontFamily: 'Helvetica-Bold', flex: 1 },
  tableRow: { flexDirection: 'row', padding: '4 6', borderBottom: `1px solid ${C.border}` },
  tableRowAlt: { flexDirection: 'row', padding: '4 6', borderBottom: `1px solid ${C.border}`, backgroundColor: C.lightGray },
  tableCell: { fontSize: 8, flex: 1 },
  tableCellRight: { fontSize: 8, flex: 1, textAlign: 'right' },

  // Observations
  obsItem: { marginBottom: 6, padding: 8, backgroundColor: C.lightGray, borderRadius: 4, borderLeft: `3px solid ${C.accent}` },
  obsMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  obsAuthor: { fontSize: 7, color: C.primary, fontFamily: 'Helvetica-Bold' },
  obsDate: { fontSize: 7, color: C.gray },
  obsText: { fontSize: 8, lineHeight: 1.4 },

  // Footer
  footer: { position: 'absolute', bottom: 20, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', borderTop: `1px solid ${C.border}`, paddingTop: 6 },
  footerText: { fontSize: 7, color: C.gray },
})

// ── Helpers ───────────────────────────────────────────────────────────────────
const makeFmt = (currency = 'USD') => (val) => {
  const n = Number(val ?? 0)
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency, minimumFractionDigits: 2 }).format(n)
}

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-EC') : '—'

// ── Componente ────────────────────────────────────────────────────────────────
export function ProyectoPDF({ proyecto, facturas, observaciones, empresa = {}, casoNegocio = null }) {
  const nombreEmpresa = empresa.nombre || 'GPRO'
  const moneda        = empresa.moneda  || 'USD'
  const fmt           = makeFmt(moneda)
  const estadoNombre  = proyecto.estado?.nombre || 'Desconocido'
  const estadoLabel   = estadoNombre.replace('_', ' ')
  const estadoColor   = ESTADO_COLORS[estadoNombre] || C.gray

  const facturado = facturas.reduce((s, f) => s + Number(f.valor), 0)
  const pagado    = facturas.reduce((s, f) => s + Number(f.totalPagos ?? 0), 0)
  const saldo     = facturado - pagado
  const valorCtto = Number(proyecto.valor ?? 0)
  const pctFact   = valorCtto > 0 ? Math.min(100, Math.round((facturado / valorCtto) * 100)) : 0
  const pctPag    = facturado > 0 ? Math.min(100, Math.round((pagado / facturado) * 100)) : 0

  const fin      = proyecto.fechaCierre ? new Date(proyecto.fechaCierre) : new Date()
  const inicio   = new Date(proyecto.fechaCreacion)
  const diasVida = Math.max(0, Math.floor((fin - inicio) / (1000 * 60 * 60 * 24)))

  const responsables = proyecto.responsables?.map((r) => r.user?.name).join(', ') || '—'
  const contactos    = proyecto.clientes?.map((c) => `${c.cliente?.nombre} ${c.cliente?.apellido}`).join(', ') || '—'

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.logoBox}><Text style={styles.logoText}>{nombreEmpresa}</Text></View>
            <Text style={styles.proyectoNombre}>{proyecto.detalle}</Text>
            <Text style={{ fontSize: 8, color: C.gray }}>{proyecto.empresa?.nombre}</Text>
            {(empresa.direccion || empresa.telefono || empresa.email) && (
              <Text style={{ fontSize: 7, color: C.gray, marginTop: 3 }}>
                {[empresa.direccion, empresa.telefono, empresa.email].filter(Boolean).join('  ·  ')}
              </Text>
            )}
          </View>
          <View style={styles.headerRight}>
            <View style={[styles.estadoBadge, { backgroundColor: estadoColor }]}>
              <Text style={styles.estadoText}>{estadoLabel}</Text>
            </View>
            <Text style={styles.fechaGen}>Generado: {fmtDate(new Date())}</Text>
            {moneda !== 'USD' && <Text style={{ fontSize: 7, color: C.gray, marginTop: 2 }}>Moneda: {moneda}</Text>}
          </View>
        </View>

        {/* ── Info General ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información General</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Empresa cliente</Text>
              <Text style={styles.infoValue}>{proyecto.empresa?.nombre || '—'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Valor del contrato</Text>
              <Text style={styles.infoValue}>{fmt(proyecto.valor)}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Fecha de inicio</Text>
              <Text style={styles.infoValue}>{fmtDate(proyecto.fechaCreacion)}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Fecha de cierre</Text>
              <Text style={styles.infoValue}>{fmtDate(proyecto.fechaCierre)}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Tiempo de vida</Text>
              <Text style={styles.infoValue}>{diasVida} días</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Responsables Proconty</Text>
              <Text style={styles.infoValue}>{responsables}</Text>
            </View>
            <View style={[styles.infoItem, { width: '100%' }]}>
              <Text style={styles.infoLabel}>Contactos del cliente</Text>
              <Text style={styles.infoValue}>{contactos}</Text>
            </View>
            {proyecto.projectOnline && (
              <View style={[styles.infoItem, { width: '100%' }]}>
                <Text style={styles.infoLabel}>URL del proyecto</Text>
                <Text style={[styles.infoValue, { color: C.accent }]}>{proyecto.projectOnline}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Resumen Financiero ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumen Financiero</Text>
          <View style={[styles.finRow, { backgroundColor: C.lightGray }]}>
            <Text style={styles.finLabel}>Valor contrato</Text>
            <Text style={styles.finValue}>{fmt(proyecto.valor)}</Text>
          </View>
          <View style={styles.finRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.finLabel}>Facturado</Text>
                <Text style={styles.finValue}>{fmt(facturado)}</Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${pctFact}%`, backgroundColor: C.accent }]} />
              </View>
              <Text style={{ fontSize: 7, color: C.gray, marginTop: 1 }}>{pctFact}% del contrato</Text>
            </View>
          </View>
          <View style={styles.finRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.finLabel}>Cobrado</Text>
                <Text style={styles.finValue}>{fmt(pagado)}</Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${pctPag}%`, backgroundColor: C.success }]} />
              </View>
              <Text style={{ fontSize: 7, color: C.gray, marginTop: 1 }}>{pctPag}% de lo facturado</Text>
            </View>
          </View>
          <View style={styles.finDivider} />
          <View style={[styles.finRow, { backgroundColor: saldo > 0.001 ? '#fef2f2' : '#f0fdf4' }]}>
            <Text style={[styles.finLabel, { fontFamily: 'Helvetica-Bold' }]}>Saldo pendiente</Text>
            <Text style={[styles.finValue, { color: saldo > 0.001 ? C.danger : C.success }]}>{fmt(saldo)}</Text>
          </View>
        </View>

        {/* ── Caso de Negocio ── */}
        {casoNegocio && casoNegocio.lineas.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Caso de Negocio</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Perfil / Consultor</Text>
                <Text style={[styles.tableHeaderCell, { textAlign: 'right' }]}>Horas</Text>
                <Text style={[styles.tableHeaderCell, { textAlign: 'right' }]}>Costo/h</Text>
                <Text style={[styles.tableHeaderCell, { textAlign: 'right' }]}>Precio/h</Text>
                <Text style={[styles.tableHeaderCell, { textAlign: 'right' }]}>Total Costo</Text>
                <Text style={[styles.tableHeaderCell, { textAlign: 'right' }]}>Total Precio</Text>
              </View>
              {casoNegocio.lineas.map((l, i) => (
                <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.tableCell}>{l.perfil?.nombre} {l.perfil?.nivel}</Text>
                    {l.empleado && (
                      <Text style={{ fontSize: 7, color: C.gray }}>{l.empleado.nombre} {l.empleado.apellido}</Text>
                    )}
                  </View>
                  <Text style={styles.tableCellRight}>{l.horas}h</Text>
                  <Text style={styles.tableCellRight}>{fmt(l.costoHora)}</Text>
                  <Text style={[styles.tableCellRight, { color: C.accent }]}>{fmt(l.precioHora)}</Text>
                  <Text style={styles.tableCellRight}>{fmt(l.costo)}</Text>
                  <Text style={[styles.tableCellRight, { fontFamily: 'Helvetica-Bold' }]}>{fmt(l.precio)}</Text>
                </View>
              ))}
              <View style={[styles.tableRow, { backgroundColor: C.lightGray }]}>
                <Text style={[styles.tableCell, { flex: 2, fontFamily: 'Helvetica-Bold' }]}>TOTAL</Text>
                <Text style={[styles.tableCellRight, { fontFamily: 'Helvetica-Bold' }]}>{casoNegocio.resumen.totalHoras}h</Text>
                <Text style={styles.tableCellRight} />
                <Text style={styles.tableCellRight} />
                <Text style={[styles.tableCellRight, { fontFamily: 'Helvetica-Bold' }]}>{fmt(casoNegocio.resumen.totalCosto)}</Text>
                <Text style={[styles.tableCellRight, { fontFamily: 'Helvetica-Bold', color: C.accent }]}>{fmt(casoNegocio.resumen.totalPrecio)}</Text>
              </View>
            </View>
            {casoNegocio.resumen.totalPrecio > 0 && (
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 }}>
                <Text style={{ fontSize: 8, color: C.gray }}>Margen bruto: </Text>
                <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.success }}>
                  {fmt(casoNegocio.resumen.totalPrecio - casoNegocio.resumen.totalCosto)}
                  {` (${Math.round(((casoNegocio.resumen.totalPrecio - casoNegocio.resumen.totalCosto) / casoNegocio.resumen.totalPrecio) * 100)}%)`}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Facturas ── */}
        {facturas.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Facturas ({facturas.length})</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Nº Factura</Text>
                <Text style={styles.tableHeaderCell}>OC</Text>
                <Text style={styles.tableHeaderCell}>Fecha</Text>
                <Text style={[styles.tableHeaderCell, { textAlign: 'right' }]}>Valor</Text>
                <Text style={[styles.tableHeaderCell, { textAlign: 'right' }]}>Pagado</Text>
                <Text style={[styles.tableHeaderCell, { textAlign: 'right' }]}>Saldo</Text>
              </View>
              {facturas.map((f, i) => {
                const s = Number(f.valor) - Number(f.totalPagos ?? 0)
                return (
                  <View key={f.id} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                    <Text style={[styles.tableCell, { flex: 1.5 }]}>{f.numFactura}</Text>
                    <Text style={styles.tableCell}>{f.ordenCompra || '—'}</Text>
                    <Text style={styles.tableCell}>{fmtDate(f.fechaFactura)}</Text>
                    <Text style={styles.tableCellRight}>{fmt(f.valor)}</Text>
                    <Text style={styles.tableCellRight}>{fmt(f.totalPagos)}</Text>
                    <Text style={[styles.tableCellRight, { color: s > 0.001 ? C.danger : C.success, fontFamily: 'Helvetica-Bold' }]}>{fmt(s)}</Text>
                  </View>
                )
              })}
            </View>
          </View>
        )}

        {/* ── Observaciones ── */}
        {observaciones.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Observaciones ({observaciones.length})</Text>
            {observaciones.map((obs) => (
              <View key={obs.id} style={styles.obsItem}>
                <View style={styles.obsMeta}>
                  <Text style={styles.obsAuthor}>{obs.user?.name || 'Sistema'}</Text>
                  <Text style={styles.obsDate}>{new Date(obs.createdAt).toLocaleString('es-EC')}</Text>
                </View>
                <Text style={styles.obsText}>{obs.descripcion}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Footer ── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>GPRO · {nombreEmpresa} · {new Date().getFullYear()}</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>

      </Page>
    </Document>
  )
}
