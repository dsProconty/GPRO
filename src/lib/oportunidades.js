// src/lib/oportunidades.js
// Constantes y helpers compartidos del módulo de Oportunidades (Sprint 9)

export const ETAPAS = ['Prospeccion', 'Solicitud_RFI', 'Entrega_RFI', 'Solicitud_RFP', 'En_Suspenso', 'Perdida']

export const ETAPA_CONFIG = {
  Prospeccion:   { label: 'Prospección',      severity: 'secondary' },
  Solicitud_RFI: { label: 'Solicitud de RFI', severity: 'warning' },
  Entrega_RFI:   { label: 'Entrega de RFI',   severity: 'info' },
  Solicitud_RFP: { label: 'Solicitud de RFP', severity: 'success' },
  En_Suspenso:   { label: 'En Suspenso',      severity: 'secondary', color: '#8b5cf6' },
  Perdida:       { label: 'Perdida',          severity: 'danger' },
}

// Modelo de transición flexible (RN-O02): libre entre las 3 etapas activas,
// alcanzable a Suspenso/Perdida desde ellas, reversible de vuelta, y el gancho
// (Solicitud_RFP) solo se dispara desde una etapa activa.
export const TRANSICIONES = {
  Prospeccion:   ['Solicitud_RFI', 'Entrega_RFI', 'Solicitud_RFP', 'En_Suspenso', 'Perdida'],
  Solicitud_RFI: ['Prospeccion', 'Entrega_RFI', 'Solicitud_RFP', 'En_Suspenso', 'Perdida'],
  Entrega_RFI:   ['Prospeccion', 'Solicitud_RFI', 'Solicitud_RFP', 'En_Suspenso', 'Perdida'],
  En_Suspenso:   ['Prospeccion', 'Solicitud_RFI', 'Entrega_RFI', 'Perdida'],
  Perdida:       ['Prospeccion', 'Solicitud_RFI', 'Entrega_RFI'],
  Solicitud_RFP: [],
}

export const ETAPA_HOOK = 'Solicitud_RFP'
