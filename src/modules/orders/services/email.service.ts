import { supabase } from '@/lib/supabase'
import type { CreateOrderPayload, OrderStatus } from '@/modules/orders/types/orders'

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_EMAIL       = 'centripartsjed@outlook.es'
const WA_NUMBER         = '573503160713'
const SITE_URL          = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, '') ?? ''
const FUNCTION_SECRET   = import.meta.env.VITE_FUNCTION_SECRET as string | undefined

function trackingUrl(orderNumber: string) {
  return `${SITE_URL}/seguimiento?order=${encodeURIComponent(orderNumber)}`
}

function waUrl(orderNumber: string) {
  const msg = encodeURIComponent(
    `Hola, quiero consultar sobre mi pedido ${orderNumber}`,
  )
  return `https://wa.me/${WA_NUMBER}?text=${msg}`
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML helpers
// ─────────────────────────────────────────────────────────────────────────────

function esc(str: string | null | undefined): string {
  return (str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const fmt = new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0,
})

function currency(n: number) { return fmt.format(n) }

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared template blocks
// ─────────────────────────────────────────────────────────────────────────────

const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif`

function emailHeader() {
  return `
    <tr>
      <td style="background-color:#18181b;border-radius:12px 12px 0 0;padding:24px 40px;text-align:center;">
        <span style="font-family:${FONT};font-size:20px;font-weight:900;letter-spacing:3px;color:#facc15;">
          CENTRIPARTS
        </span>
      </td>
    </tr>`
}

function emailFooter() {
  const year = new Date().getFullYear()
  return `
    <tr>
      <td style="background-color:#27272a;border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;">
        <p style="margin:0 0 6px 0;font-family:${FONT};font-size:13px;color:#a1a1aa;">
          Centriparts — Distribuidores de Repuestos Automotrices
        </p>
        <p style="margin:0 0 4px 0;font-family:${FONT};font-size:12px;color:#71717a;">
          <a href="mailto:${ADMIN_EMAIL}" style="color:#facc15;text-decoration:none;">${ADMIN_EMAIL}</a>
        </p>
        <p style="margin:8px 0 0 0;font-family:${FONT};font-size:11px;color:#52525b;">
          © ${year} Centriparts. Todos los derechos reservados.
        </p>
      </td>
    </tr>`
}

function primaryButton(label: string, url: string) {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td align="center" style="padding:8px 0;">
          <a href="${url}"
             style="display:inline-block;font-family:${FONT};font-size:14px;font-weight:700;
                    color:#000000;text-decoration:none;background-color:#facc15;
                    padding:13px 32px;border-radius:8px;">
            ${label}
          </a>
        </td>
      </tr>
    </table>`
}

function waButton(orderNumber: string) {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td align="center" style="padding:8px 0;">
          <a href="${waUrl(orderNumber)}"
             style="display:inline-block;font-family:${FONT};font-size:14px;font-weight:700;
                    color:#ffffff;text-decoration:none;background-color:#25D366;
                    padding:13px 32px;border-radius:8px;">
            Contactar por WhatsApp
          </a>
        </td>
      </tr>
    </table>`
}

function divider() {
  return `<tr><td style="padding:8px 0;"><hr style="border:none;border-top:1px solid #e4e4e7;margin:0;"></td></tr>`
}

function sectionLabel(text: string) {
  return `<p style="margin:0 0 12px 0;font-family:${FONT};font-size:11px;font-weight:700;
                    letter-spacing:1.5px;text-transform:uppercase;color:#a1a1aa;">${esc(text)}</p>`
}

function orderNumberBlock(orderNumber: string) {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="background-color:#f9fafb;border:1px solid #e4e4e7;border-radius:8px;margin:0 0 24px 0;">
      <tr>
        <td style="padding:20px 24px;text-align:center;">
          ${sectionLabel('Número de pedido')}
          <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:26px;
                    font-weight:700;letter-spacing:2px;color:#18181b;">
            ${esc(orderNumber)}
          </p>
          <p style="margin:8px 0 0 0;font-family:${FONT};font-size:12px;color:#a1a1aa;">
            Guarda este número para hacer seguimiento de tu pedido.
          </p>
        </td>
      </tr>
    </table>`
}

function itemsTable(items: CreateOrderPayload['items']) {
  const rows = items.map((item, i) => `
    <tr style="background-color:${i % 2 === 0 ? '#ffffff' : '#f9fafb'};">
      <td style="padding:12px 16px;font-family:${FONT};font-size:13px;color:#18181b;
                 border-bottom:1px solid #e4e4e7;">
        <span style="font-weight:600;">${esc(item.product_name)}</span>
        ${item.product_reference
          ? `<br><span style="font-size:11px;color:#a1a1aa;">Ref: ${esc(item.product_reference)}</span>`
          : ''}
      </td>
      <td style="padding:12px 16px;font-family:${FONT};font-size:13px;color:#18181b;
                 text-align:center;border-bottom:1px solid #e4e4e7;white-space:nowrap;">
        ${item.quantity}
      </td>
      <td style="padding:12px 16px;font-family:${FONT};font-size:13px;color:#71717a;
                 text-align:right;border-bottom:1px solid #e4e4e7;white-space:nowrap;">
        ${currency(item.unit_price)}
      </td>
      <td style="padding:12px 16px;font-family:${FONT};font-size:13px;font-weight:600;
                 color:#18181b;text-align:right;border-bottom:1px solid #e4e4e7;white-space:nowrap;">
        ${currency(item.subtotal)}
      </td>
    </tr>`).join('')

  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="border-collapse:collapse;border:1px solid #e4e4e7;border-radius:8px;
                  overflow:hidden;margin:0 0 8px 0;">
      <thead>
        <tr style="background-color:#f4f4f5;">
          <th style="padding:10px 16px;font-family:${FONT};font-size:11px;font-weight:600;
                     text-transform:uppercase;letter-spacing:0.5px;color:#71717a;text-align:left;
                     border-bottom:2px solid #e4e4e7;">
            Producto
          </th>
          <th style="padding:10px 16px;font-family:${FONT};font-size:11px;font-weight:600;
                     text-transform:uppercase;letter-spacing:0.5px;color:#71717a;text-align:center;
                     border-bottom:2px solid #e4e4e7;">
            Cant.
          </th>
          <th style="padding:10px 16px;font-family:${FONT};font-size:11px;font-weight:600;
                     text-transform:uppercase;letter-spacing:0.5px;color:#71717a;text-align:right;
                     border-bottom:2px solid #e4e4e7;">
            Precio
          </th>
          <th style="padding:10px 16px;font-family:${FONT};font-size:11px;font-weight:600;
                     text-transform:uppercase;letter-spacing:0.5px;color:#71717a;text-align:right;
                     border-bottom:2px solid #e4e4e7;">
            Subtotal
          </th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`
}

function totalBlock(total: number, shippingCost = 0) {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="margin:0 0 32px 0;">
      ${shippingCost > 0 ? `
      <tr>
        <td style="padding:6px 0;font-family:${FONT};font-size:13px;color:#71717a;">Envío</td>
        <td style="padding:6px 0;font-family:${FONT};font-size:13px;color:#71717a;text-align:right;">
          ${currency(shippingCost)}
        </td>
      </tr>` : `
      <tr>
        <td style="padding:6px 0;font-family:${FONT};font-size:13px;color:#71717a;">Envío</td>
        <td style="padding:6px 0;font-family:${FONT};font-size:13px;color:#a1a1aa;text-align:right;">
          Por coordinar
        </td>
      </tr>`}
      <tr>
        <td style="padding:12px 0 0 0;font-family:${FONT};font-size:16px;font-weight:700;
                   color:#18181b;border-top:2px solid #e4e4e7;">
          Total
        </td>
        <td style="padding:12px 0 0 0;font-family:${FONT};font-size:18px;font-weight:700;
                   color:#18181b;text-align:right;border-top:2px solid #e4e4e7;">
          ${currency(total)}
        </td>
      </tr>
    </table>`
}

function nextStepsBlock() {
  const steps = [
    ['1', 'Confirmación por correo', 'Recibirás un resumen de tu pedido en tu correo electrónico.'],
    ['2', 'Revisión por un asesor', 'Un asesor revisará tu pedido y se pondrá en contacto contigo.'],
    ['3', 'Acuerdo de pago y envío', 'Coordinarás los detalles de pago y fecha de entrega.'],
    ['4', 'Despacho del pedido', 'Tu pedido será preparado y enviado a tu dirección.'],
  ]

  const rows = steps.map(([num, title, detail]) => `
    <tr>
      <td width="36" valign="top" style="padding:0 14px 16px 0;">
        <span style="display:inline-block;width:28px;height:28px;border-radius:50%;
                     background-color:#fef9c3;font-family:${FONT};font-size:12px;
                     font-weight:700;color:#854d0e;text-align:center;line-height:28px;">
          ${num}
        </span>
      </td>
      <td valign="top" style="padding:0 0 16px 0;">
        <p style="margin:0 0 3px 0;font-family:${FONT};font-size:13px;font-weight:600;color:#18181b;">
          ${title}
        </p>
        <p style="margin:0;font-family:${FONT};font-size:12px;color:#71717a;line-height:1.5;">
          ${detail}
        </p>
      </td>
    </tr>`).join('')

  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="background-color:#f9fafb;border:1px solid #e4e4e7;border-radius:8px;
                  margin:0 0 24px 0;">
      <tr>
        <td style="padding:20px 24px;">
          ${sectionLabel('¿Qué sigue?')}
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tbody>${rows}</tbody>
          </table>
        </td>
      </tr>
    </table>`
}

function emailWrapper(headerRow: string, contentHtml: string) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:${FONT};">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="background-color:#f4f4f5;min-width:100%;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation"
               style="max-width:600px;width:100%;">
          ${headerRow}
          ${emailHeader()}
          <tr>
            <td style="background-color:#ffffff;padding:36px 40px;">
              ${contentHtml}
            </td>
          </tr>
          ${emailFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ─────────────────────────────────────────────────────────────────────────────
// Template: customer — order created
// ─────────────────────────────────────────────────────────────────────────────

export interface OrderCreatedEmailData {
  orderNumber:  string
  customerName: string
  payload:      CreateOrderPayload
  createdAt:    string
}

export function buildCustomerOrderCreatedEmail(data: OrderCreatedEmailData) {
  const { orderNumber, customerName, payload, createdAt } = data
  const firstName = customerName.split(' ')[0]

  const content = `
    <p style="margin:0 0 4px 0;font-family:${FONT};font-size:22px;font-weight:700;color:#18181b;">
      ¡Pedido recibido!
    </p>
    <p style="margin:0 0 28px 0;font-family:${FONT};font-size:13px;color:#71717a;">
      ${formatDate(createdAt)}
    </p>

    <p style="margin:0 0 24px 0;font-family:${FONT};font-size:14px;color:#3f3f46;line-height:1.6;">
      Hola <strong>${esc(firstName)}</strong>, hemos recibido tu pedido correctamente.
      Un asesor revisará los detalles y se pondrá en contacto contigo para confirmar
      el pago y la entrega.
    </p>

    ${orderNumberBlock(orderNumber)}

    ${sectionLabel('Artículos del pedido')}
    ${itemsTable(payload.items)}
    ${totalBlock(payload.total, payload.shipping_cost)}

    ${nextStepsBlock()}

    ${sectionLabel('Seguimiento')}
    <p style="margin:0 0 12px 0;font-family:${FONT};font-size:13px;color:#71717a;">
      Puedes consultar el estado de tu pedido en cualquier momento:
    </p>
    ${primaryButton('Ver seguimiento del pedido', trackingUrl(orderNumber))}

    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:8px 0 0 0;">
      <tr>
        <td align="center">
          <a href="${trackingUrl(orderNumber)}" style="font-family:${FONT};font-size:11px;
             color:#a1a1aa;text-decoration:underline;">${trackingUrl(orderNumber)}</a>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:28px 0 8px 0;">
      <tr><td style="padding:16px 0 0 0;border-top:1px solid #e4e4e7;"></td></tr>
    </table>

    ${sectionLabel('¿Necesitas ayuda?')}
    <p style="margin:0 0 12px 0;font-family:${FONT};font-size:13px;color:#71717a;">
      Escríbenos por WhatsApp y un asesor te atenderá de inmediato.
    </p>
    ${waButton(orderNumber)}
  `

  return {
    subject: `Hemos recibido tu pedido ${orderNumber} — Centriparts`,
    html:    emailWrapper('', content),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Template: customer — status update
// ─────────────────────────────────────────────────────────────────────────────

export interface StatusEmailData {
  orderNumber:  string
  customerName: string
  newStatus:    OrderStatus
  updatedAt:    string
}

const STATUS_CONFIG: Record<
  Extract<OrderStatus, 'confirmed' | 'shipped' | 'delivered' | 'cancelled'>,
  { title: string; headline: string; body: string; bannerColor: string }
> = {
  confirmed: {
    title:       'Tu pedido ha sido confirmado',
    headline:    '¡Tu pedido está confirmado!',
    body:        'Hemos confirmado tu pedido. Nuestro equipo ya está preparando todo para el despacho. Te avisaremos cuando sea enviado.',
    bannerColor: '#2563eb',
  },
  shipped: {
    title:       'Tu pedido está en camino',
    headline:    '¡Tu pedido está en camino!',
    body:        'Tu pedido ha sido despachado y está en camino hacia ti. Podrás rastrear el estado del envío en el enlace de seguimiento.',
    bannerColor: '#7c3aed',
  },
  delivered: {
    title:       'Tu pedido ha sido entregado',
    headline:    '¡Tu pedido fue entregado!',
    body:        'Tu pedido ha sido entregado exitosamente. Si tienes alguna pregunta o comentario sobre tu compra, estamos aquí para ayudarte.',
    bannerColor: '#16a34a',
  },
  cancelled: {
    title:       'Tu pedido ha sido cancelado',
    headline:    'Tu pedido fue cancelado',
    body:        'Tu pedido ha sido cancelado. Si tienes preguntas o necesitas más información sobre el motivo de la cancelación, comunícate con nosotros.',
    bannerColor: '#dc2626',
  },
}

export function buildCustomerStatusEmail(data: StatusEmailData) {
  const { orderNumber, customerName, newStatus, updatedAt } = data
  const config    = STATUS_CONFIG[newStatus as keyof typeof STATUS_CONFIG]
  const firstName = customerName.split(' ')[0]

  if (!config) return null

  const content = `
    <p style="margin:0 0 4px 0;font-family:${FONT};font-size:22px;font-weight:700;color:#18181b;">
      ${config.headline}
    </p>
    <p style="margin:0 0 28px 0;font-family:${FONT};font-size:13px;color:#71717a;">
      ${formatDate(updatedAt)}
    </p>

    <p style="margin:0 0 24px 0;font-family:${FONT};font-size:14px;color:#3f3f46;line-height:1.6;">
      Hola <strong>${esc(firstName)}</strong>, ${config.body}
    </p>

    ${orderNumberBlock(orderNumber)}

    ${sectionLabel('Seguimiento')}
    <p style="margin:0 0 12px 0;font-family:${FONT};font-size:13px;color:#71717a;">
      Consulta el estado actualizado de tu pedido en cualquier momento:
    </p>
    ${primaryButton('Ver seguimiento del pedido', trackingUrl(orderNumber))}

    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:8px 0 0 0;">
      <tr>
        <td align="center">
          <a href="${trackingUrl(orderNumber)}" style="font-family:${FONT};font-size:11px;
             color:#a1a1aa;text-decoration:underline;">${trackingUrl(orderNumber)}</a>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:28px 0 8px 0;">
      <tr><td style="padding:16px 0 0 0;border-top:1px solid #e4e4e7;"></td></tr>
    </table>

    ${sectionLabel('¿Tienes preguntas?')}
    <p style="margin:0 0 12px 0;font-family:${FONT};font-size:13px;color:#71717a;">
      Escríbenos por WhatsApp y con gusto te ayudamos.
    </p>
    ${waButton(orderNumber)}
  `

  // Thin color bar above header to indicate status type
  const statusBar = `
    <tr>
      <td style="background-color:${config.bannerColor};border-radius:12px 12px 0 0;
                 height:6px;font-size:0;line-height:0;">
        &nbsp;
      </td>
    </tr>`

  return {
    subject: `${config.title} — Centriparts`,
    html:    emailWrapper(statusBar, content),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Template: admin — new order
// ─────────────────────────────────────────────────────────────────────────────

export interface AdminOrderEmailData {
  orderId:     string
  orderNumber: string
  payload:     CreateOrderPayload
  createdAt:   string
}

export function buildAdminNewOrderEmail(data: AdminOrderEmailData) {
  const { orderId, orderNumber, payload, createdAt } = data

  const adminLink = `${SITE_URL}/admin/orders/${orderId}`

  const content = `
    <p style="margin:0 0 4px 0;font-family:${FONT};font-size:20px;font-weight:700;color:#18181b;">
      Nuevo pedido recibido
    </p>
    <p style="margin:0 0 28px 0;font-family:${FONT};font-size:13px;color:#71717a;">
      ${formatDate(createdAt)}
    </p>

    ${orderNumberBlock(orderNumber)}

    ${sectionLabel('Datos del cliente')}
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="background-color:#f9fafb;border:1px solid #e4e4e7;border-radius:8px;
                  margin:0 0 24px 0;">
      <tr>
        <td style="padding:20px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="padding:4px 0;font-family:${FONT};font-size:12px;color:#a1a1aa;width:100px;">
                Nombre
              </td>
              <td style="padding:4px 0;font-family:${FONT};font-size:13px;font-weight:600;color:#18181b;">
                ${esc(payload.customer_name)}
              </td>
            </tr>
            <tr>
              <td style="padding:4px 0;font-family:${FONT};font-size:12px;color:#a1a1aa;">Correo</td>
              <td style="padding:4px 0;font-family:${FONT};font-size:13px;color:#18181b;">
                <a href="mailto:${esc(payload.customer_email)}" style="color:#2563eb;text-decoration:none;">
                  ${esc(payload.customer_email)}
                </a>
              </td>
            </tr>
            ${payload.customer_phone ? `
            <tr>
              <td style="padding:4px 0;font-family:${FONT};font-size:12px;color:#a1a1aa;">Teléfono</td>
              <td style="padding:4px 0;font-family:${FONT};font-size:13px;color:#18181b;">
                ${esc(payload.customer_phone)}
              </td>
            </tr>` : ''}
            <tr>
              <td style="padding:4px 0;font-family:${FONT};font-size:12px;color:#a1a1aa;">Pago</td>
              <td style="padding:4px 0;font-family:${FONT};font-size:13px;color:#18181b;">
                ${esc(payload.payment_method ?? 'No especificado')}
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0 4px 0;font-family:${FONT};font-size:12px;color:#a1a1aa;">
                Envío a
              </td>
              <td style="padding:8px 0 4px 0;font-family:${FONT};font-size:13px;color:#18181b;">
                ${esc(payload.shipping_address)}, ${esc(payload.shipping_city)},
                ${esc(payload.shipping_department)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${sectionLabel('Artículos')}
    ${itemsTable(payload.items)}
    ${totalBlock(payload.total, payload.shipping_cost)}

    ${payload.customer_notes ? `
    ${sectionLabel('Notas del cliente')}
    <p style="margin:0 0 24px 0;font-family:${FONT};font-size:13px;color:#3f3f46;
              background-color:#fefce8;border:1px solid #fde047;border-radius:6px;
              padding:12px 16px;line-height:1.5;">
      ${esc(payload.customer_notes)}
    </p>` : ''}

    ${primaryButton('Ver pedido en el panel de administración', adminLink)}
  `

  return {
    subject: `Nuevo pedido ${orderNumber} — Centriparts`,
    html:    emailWrapper('', content),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sender — calls the Supabase Edge Function
// ─────────────────────────────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const headers: Record<string, string> = {}
  if (FUNCTION_SECRET) {
    headers['x-internal-secret'] = FUNCTION_SECRET
  }

  const { error } = await supabase.functions.invoke('send-email', {
    body:    { to, subject, html, replyTo: ADMIN_EMAIL },
    headers,
  })
  if (error) {
    // Log but never throw — email failure must not break the order flow
    console.error('[email] Failed to send to', to, error)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Composite senders (called from service layer, fire-and-forget)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Called once after a new order is successfully created.
 * Sends two emails: one to the customer, one to admin.
 */
export function sendOrderCreatedEmails(
  orderId:     string,
  orderNumber: string,
  payload:     CreateOrderPayload,
): void {
  const now = new Date().toISOString()

  // Customer email — fire and forget
  const customerEmail = buildCustomerOrderCreatedEmail({
    orderNumber,
    customerName: payload.customer_name,
    payload,
    createdAt: now,
  })
  sendEmail(payload.customer_email, customerEmail.subject, customerEmail.html).catch(() => {})

  // Admin email — fire and forget
  const adminEmail = buildAdminNewOrderEmail({ orderId, orderNumber, payload, createdAt: now })
  sendEmail(ADMIN_EMAIL, adminEmail.subject, adminEmail.html).catch(() => {})
}

/**
 * Called after an order status is updated.
 * Only sends for statuses that are meaningful to the customer.
 */
export function sendOrderStatusEmail(
  orderNumber:   string,
  customerName:  string,
  customerEmail: string,
  newStatus:     OrderStatus,
): void {
  const NOTIFY_STATUSES: OrderStatus[] = ['confirmed', 'shipped', 'delivered', 'cancelled']
  if (!NOTIFY_STATUSES.includes(newStatus)) return

  const email = buildCustomerStatusEmail({
    orderNumber,
    customerName,
    newStatus,
    updatedAt: new Date().toISOString(),
  })
  if (!email) return

  sendEmail(customerEmail, email.subject, email.html).catch(() => {})
}
