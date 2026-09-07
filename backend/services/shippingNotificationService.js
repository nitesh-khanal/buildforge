/**
 * Shipping-partner handoff: an email with the pick-up/delivery details, plus
 * a click-to-chat WhatsApp link so whoever is running fulfillment can open a
 * chat with the courier pre-filled with the order details in one tap.
 *
 * There's no real WhatsApp Business API account behind this (that requires
 * a paid Meta-verified business setup) — `wa.me` click-to-chat links are the
 * standard lightweight way to do this without one, and they work with any
 * regular WhatsApp number. The link is pure string-building (no network
 * call), so it's always returned even if email sending is unavailable; the
 * email is best-effort like the rest of the notification layer.
 */

const nodemailer = require('nodemailer');

function isEnabled() {
  return Boolean(process.env.SHIPPING_PARTNER_EMAIL || process.env.SHIPPING_PARTNER_WHATSAPP);
}

function buildOrderSummaryText(order) {
  const lines = order.items.map((item) => {
    const label = item.isCustomBuild ? `${item.name} (Custom Build)` : item.name;
    return `- ${label} x${item.quantity}`;
  });
  return lines.join('\n');
}

// Pure string-building — safe to call any time, no config required. Returns
// null only if no shipping-partner WhatsApp number has been configured.
function buildWhatsAppLink(order) {
  const number = (process.env.SHIPPING_PARTNER_WHATSAPP || '').replace(/[^\d]/g, '');
  if (!number) return null;

  const message = [
    `New BuildForge order for pickup: ${order.orderId}`,
    `Customer: ${order.shippingAddress.fullName} (${order.shippingAddress.phone})`,
    `Deliver to: ${order.shippingAddress.address}, ${order.shippingAddress.city}, ${order.shippingAddress.province}`,
    `Payment: ${order.paymentMethod.toUpperCase()} (${order.paymentStatus})`,
    `Items:`,
    buildOrderSummaryText(order),
    `Total: NPR ${Number(order.total).toLocaleString('en-IN')}`,
  ].join('\n');

  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

// Best-effort email to the shipping partner's inbox with the same details.
// Reuses EMAIL_HOST/EMAIL_USER/EMAIL_PASSWORD from emailService's transport
// config rather than requiring a second SMTP setup.
async function emailShippingPartner(order) {
  const to = process.env.SHIPPING_PARTNER_EMAIL;
  if (!to || !process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    return { sent: false, reason: 'shipping partner email not configured' };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: Number(process.env.EMAIL_PORT) === 465,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"BuildForge" <no-reply@buildforge.com>',
      to,
      subject: `Pickup requested — ${order.orderId}`,
      text: [
        `New order ready for pickup/delivery.`,
        '',
        `Order ID: ${order.orderId}`,
        `Customer: ${order.shippingAddress.fullName} (${order.shippingAddress.phone})`,
        `Address: ${order.shippingAddress.address}, ${order.shippingAddress.city}, ${order.shippingAddress.province}`,
        `Payment: ${order.paymentMethod.toUpperCase()} (${order.paymentStatus})`,
        '',
        'Items:',
        buildOrderSummaryText(order),
        '',
        `Total: NPR ${Number(order.total).toLocaleString('en-IN')}`,
      ].join('\n'),
    });
    return { sent: true };
  } catch (err) {
    console.error('emailShippingPartner failed:', err.message);
    return { sent: false, reason: err.message };
  }
}

// Combines both channels. Called once an order is actually confirmed
// (paid/COD) — never for a still-Pending eSewa order, so the courier is
// never notified about an order that might not end up paid for.
async function notifyShippingPartner(order) {
  const whatsappLink = buildWhatsAppLink(order);
  const emailResult = await emailShippingPartner(order);
  return { whatsappLink, emailSent: emailResult.sent };
}

module.exports = {
  isEnabled,
  buildWhatsAppLink,
  emailShippingPartner,
  notifyShippingPartner,
};
