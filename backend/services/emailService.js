/**
 * Nodemailer-backed transactional email.
 *
 * OFF BY DEFAULT, same pattern as geminiService.js — every function here is
 * a safe no-op unless EMAIL_HOST/EMAIL_USER/EMAIL_PASSWORD are set. Orders
 * are fully valid and checkout never fails because of this file: a missing
 * config or an SMTP hiccup is logged and swallowed, never thrown, so a
 * flaky mail server can't block a customer's order from completing.
 */

const nodemailer = require('nodemailer');

let cachedTransporter = null;

function isEnabled() {
  return Boolean(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASSWORD);
}

function getTransporter() {
  if (!isEnabled()) return null;
  if (cachedTransporter) return cachedTransporter;

  cachedTransporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: Number(process.env.EMAIL_PORT) === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
  return cachedTransporter;
}

function formatNpr(n) {
  return `NPR ${Number(n).toLocaleString('en-IN')}`;
}

function renderItemRows(items) {
  return items
    .map((item) => {
      const label = item.isCustomBuild ? `${item.name} (Custom Build)` : item.name;
      return `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #eee;">${label} × ${item.quantity}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">${formatNpr(item.price * item.quantity)}</td>
      </tr>`;
    })
    .join('');
}

function renderOrderHtml(order, { heading, intro }) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#222;">
    <h2 style="color:#1a1a2e;">${heading}</h2>
    <p>${intro}</p>
    <p><strong>Order ID:</strong> ${order.orderId}<br/>
       <strong>Payment method:</strong> ${order.paymentMethod.toUpperCase()}<br/>
       <strong>Payment status:</strong> ${order.paymentStatus}</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      ${renderItemRows(order.items)}
      <tr><td style="padding:8px 0;">Subtotal</td><td style="text-align:right;">${formatNpr(order.subtotal)}</td></tr>
      <tr><td style="padding:8px 0;">Shipping</td><td style="text-align:right;">${order.shippingCost ? formatNpr(order.shippingCost) : 'Free'}</td></tr>
      ${order.discount ? `<tr><td style="padding:8px 0;">Discount</td><td style="text-align:right;">-${formatNpr(order.discount)}</td></tr>` : ''}
      <tr><td style="padding:8px 0;font-weight:bold;">Total</td><td style="text-align:right;font-weight:bold;">${formatNpr(order.total)}</td></tr>
    </table>
    <p><strong>Shipping to:</strong><br/>
      ${order.shippingAddress.fullName}<br/>
      ${order.shippingAddress.address}, ${order.shippingAddress.city}, ${order.shippingAddress.province}<br/>
      ${order.shippingAddress.phone}</p>
    <p style="color:#777;font-size:12px;">BuildForge — this is an automated message.</p>
  </div>`;
}

// Sends the "your order is confirmed" email to the customer. Call this once
// an order's payment is actually settled (COD placed, card Paid, or an
// eSewa callback verified as COMPLETE) — not while paymentStatus is still
// Pending, or a customer could get a false confirmation.
async function sendOrderConfirmationEmail(order) {
  const transporter = getTransporter();
  if (!transporter) return { sent: false, reason: 'email service not configured' };

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"BuildForge" <no-reply@buildforge.com>',
      to: order.shippingAddress.email,
      subject: `Order confirmed — ${order.orderId}`,
      html: renderOrderHtml(order, {
        heading: 'Thanks for your order!',
        intro: `We've received your order and it's being prepared for shipping.`,
      }),
    });
    return { sent: true };
  } catch (err) {
    console.error('sendOrderConfirmationEmail failed:', err.message);
    return { sent: false, reason: err.message };
  }
}

// Sends a "payment didn't go through" heads-up — used for an eSewa
// redirect that comes back as a failure, so the customer isn't left
// wondering why the order never got confirmed.
async function sendPaymentFailedEmail(order) {
  const transporter = getTransporter();
  if (!transporter) return { sent: false, reason: 'email service not configured' };

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"BuildForge" <no-reply@buildforge.com>',
      to: order.shippingAddress.email,
      subject: `Payment failed — ${order.orderId}`,
      html: renderOrderHtml(order, {
        heading: 'Payment could not be completed',
        intro: `Your payment for this order wasn't successful, so it hasn't been confirmed. The items have been released back into stock — feel free to try checking out again.`,
      }),
    });
    return { sent: true };
  } catch (err) {
    console.error('sendPaymentFailedEmail failed:', err.message);
    return { sent: false, reason: err.message };
  }
}

// Sends a lightweight "your order status changed" heads-up (e.g. Shipped,
// Out for Delivery, Delivered, Cancelled) — used by the admin order
// management API in Phase 6. Off-by-default / fail-soft like every other
// function here.
async function sendOrderStatusUpdateEmail(order, previousStatus) {
  const transporter = getTransporter();
  if (!transporter) return { sent: false, reason: 'email service not configured' };

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"BuildForge" <no-reply@buildforge.com>',
      to: order.shippingAddress.email,
      subject: `Order update — ${order.orderId} is now ${order.orderStatus}`,
      html: renderOrderHtml(order, {
        heading: `Your order is now: ${order.orderStatus}`,
        intro: `Order ${order.orderId} moved from "${previousStatus}" to "${order.orderStatus}".`,
      }),
    });
    return { sent: true };
  } catch (err) {
    console.error('sendOrderStatusUpdateEmail failed:', err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = {
  isEnabled,
  sendOrderConfirmationEmail,
  sendPaymentFailedEmail,
  sendOrderStatusUpdateEmail,
};
