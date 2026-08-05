import { Resend } from 'resend'

// Escapa caracteres HTML para prevenir inyección en emails (SEC-03)
function esc(str) {
  return (str ?? '').toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export async function enviarRecordatorio({ proyecto, recordatorio }) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const destinatarios = recordatorio.destinatarios
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)

  if (destinatarios.length === 0) {
    throw new Error('No hay destinatarios válidos')
  }

  return resend.emails.send({
    from: 'GPRO Proconty <recordatorios@gpro.proconty.com>',
    to: destinatarios,
    subject: `[GPRO] Recordatorio de facturación — ${esc(proyecto.detalle)}`,
    html: plantillaEmail({ proyecto, recordatorio }),
  })
}

export async function enviarNotificacionRespuesta({ proyecto, observacionOriginal, respuesta, autorRespuestaNombre }) {
  const destinatario = observacionOriginal.user?.email
  if (!destinatario) {
    throw new Error('El autor del comentario original no tiene email registrado')
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  return resend.emails.send({
    from: 'GPRO Proconty <recordatorios@gpro.proconty.com>',
    to: [destinatario],
    subject: `[GPRO] ${autorRespuestaNombre} respondió tu comentario — ${esc(proyecto.detalle)}`,
    html: plantillaRespuesta({ proyecto, observacionOriginal, respuesta, autorRespuestaNombre }),
  })
}

function plantillaRespuesta({ proyecto, observacionOriginal, respuesta, autorRespuestaNombre }) {
  const appUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || ''
  const fecha = new Date().toLocaleDateString('es-EC', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a5f,#2e75b6);padding:28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="color:#ffffff;font-size:22px;font-weight:bold;">📋 GPRO</span>
                  <span style="color:#a8c8f0;font-size:13px;margin-left:8px;">Gestor de Proyectos · Proconty</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Alerta -->
        <tr>
          <td style="background:#eff6ff;border-left:4px solid #2e75b6;padding:14px 32px;">
            <span style="color:#1e3a5f;font-size:14px;font-weight:bold;">💬 Nueva respuesta a tu comentario</span>
            <span style="color:#1e3a5f;font-size:13px;margin-left:8px;">${fecha}</span>
          </td>
        </tr>

        <!-- Contenido -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 6px;color:#6b7280;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;">Proyecto</p>
            <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">${esc(proyecto.detalle)}</h2>
            <p style="margin:0 0 24px;color:#6b7280;font-size:13px;">${esc(proyecto.empresa?.nombre) || '—'}</p>

            <p style="margin:0 0 8px;color:#6b7280;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;">Tu comentario</p>
            <p style="margin:0 0 20px;color:#6b7280;font-size:14px;line-height:1.6;background:#f9fafb;border-left:3px solid #cbd5e1;padding:12px 16px;border-radius:0 6px 6px 0;">
              ${esc(observacionOriginal.descripcion)}
            </p>

            <p style="margin:0 0 8px;color:#6b7280;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;">Respuesta de ${esc(autorRespuestaNombre)}</p>
            <p style="margin:0 0 28px;color:#374151;font-size:15px;line-height:1.6;background:#f0f9ff;border-left:3px solid #2e75b6;padding:12px 16px;border-radius:0 6px 6px 0;">
              ${esc(respuesta.descripcion)}
            </p>

            <a href="${appUrl}/proyectos/${proyecto.id}"
               style="display:inline-block;background:#2e75b6;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600;">
              Ver conversación en GPRO →
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">
              Notificación automática de GPRO · Proconty.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function plantillaEmail({ proyecto, recordatorio }) {
  const appUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || ''
  const fecha = new Date().toLocaleDateString('es-EC', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  const diaConfigurado = recordatorio.frecuencia === 'anual'
    ? `Día ${recordatorio.diaMes} de ${MESES[recordatorio.mes - 1]}, cada año`
    : `Día ${recordatorio.diaMes} de cada mes`

  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a5f,#2e75b6);padding:28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="color:#ffffff;font-size:22px;font-weight:bold;">📋 GPRO</span>
                  <span style="color:#a8c8f0;font-size:13px;margin-left:8px;">Gestor de Proyectos · Proconty</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Alerta -->
        <tr>
          <td style="background:#fff8e1;border-left:4px solid #f59e0b;padding:14px 32px;">
            <span style="color:#92400e;font-size:14px;font-weight:bold;">⏰ Recordatorio de Facturación</span>
            <span style="color:#92400e;font-size:13px;margin-left:8px;">${fecha}</span>
          </td>
        </tr>

        <!-- Contenido -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 6px;color:#6b7280;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;">Proyecto</p>
            <h2 style="margin:0 0 24px;color:#111827;font-size:20px;">${esc(proyecto.detalle)}</h2>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:6px;padding:16px;margin-bottom:24px;">
              <tr>
                <td style="padding:6px 0;color:#6b7280;font-size:13px;width:130px;">Cliente:</td>
                <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600;">${esc(proyecto.empresa?.nombre) || '—'}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#6b7280;font-size:13px;">Día configurado:</td>
                <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600;">${diaConfigurado}</td>
              </tr>
            </table>

            <p style="margin:0 0 8px;color:#6b7280;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;">Nota</p>
            <p style="margin:0 0 28px;color:#374151;font-size:15px;line-height:1.6;background:#f0f9ff;border-left:3px solid #2e75b6;padding:12px 16px;border-radius:0 6px 6px 0;">
              ${esc(recordatorio.descripcion)}
            </p>

            <a href="${appUrl}/proyectos/${proyecto.id}"
               style="display:inline-block;background:#2e75b6;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600;">
              Ver proyecto en GPRO →
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">
              Este recordatorio fue configurado en GPRO · Proconty.
              Para desactivarlo, ingresa al proyecto y edita la sección "Recordatorios".
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}
