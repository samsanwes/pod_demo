import type { OrderRow } from './database.types';
import { formatCurrency, formatDate } from './utils';

export type EmailTemplateId = 'quote' | 'confirmation' | 'sample' | 'ready' | 'shipped' | 'invoice';

export interface RenderedEmail {
  subject: string;
  body: string;
}

export const EMAIL_TEMPLATE_LABELS: Record<EmailTemplateId, string> = {
  quote: 'Quote',
  confirmation: 'Confirmation',
  sample: 'Sample ready',
  ready: 'Order ready',
  shipped: 'Shipped',
  invoice: 'Invoice',
};

const SIGN_OFF =
  'Warm regards,\nSAIACS Press & Media Team\nSouth Asia Institute of Advanced Christian Studies';

function orderRef(o: OrderRow) {
  return o.order_number ?? o.id.slice(0, 8);
}

export function renderEmail(template: EmailTemplateId, order: OrderRow): RenderedEmail {
  const ref = orderRef(order);
  const greeting = `Dear ${order.client_name},`;
  switch (template) {
    case 'quote':
      return {
        subject: `SAIACS POD — Quote for order ${ref}`,
        body: [
          greeting,
          '',
          `Thank you for your print-on-demand request. Please find the quote details below for order ${ref}.`,
          '',
          `• Quantity: ${order.quantity}`,
          `• Price per copy: ${formatCurrency(order.price_per_copy)}`,
          `• Total: ${formatCurrency(order.total_price)}`,
          `• Delivery by: ${formatDate(order.delivery_date)}`,
          '',
          'Kindly reply to this email to confirm the order, and we will proceed to production.',
          '',
          SIGN_OFF,
        ].join('\n'),
      };
    case 'confirmation':
      return {
        subject: `SAIACS POD — Order ${ref} confirmed`,
        body: [
          greeting,
          '',
          `We have received your confirmation for order ${ref}. Production will begin shortly.`,
          '',
          `• Quantity: ${order.quantity}`,
          `• Expected delivery: ${formatDate(order.delivery_date)}`,
          '',
          'We will keep you informed as your order progresses through production.',
          '',
          SIGN_OFF,
        ].join('\n'),
      };
    case 'sample':
      return {
        subject: `SAIACS POD — Sample ready for order ${ref}`,
        body: [
          greeting,
          '',
          `A sample copy for order ${ref} is ready for your review. Please confirm whether to proceed with full production.`,
          '',
          'Please reply to this email with your approval or any requested changes.',
          '',
          SIGN_OFF,
        ].join('\n'),
      };
    case 'ready':
      return {
        subject: `SAIACS POD — Order ${ref} is ready`,
        body: [
          greeting,
          '',
          `Your order ${ref} is ready${
            order.delivery_method === 'pickup' ? ' for pickup at our campus bookstore' : ' to be dispatched'
          }.`,
          '',
          `• Quantity: ${order.quantity}`,
          `• Delivery method: ${order.delivery_method}`,
          ...(order.delivery_address ? [`• Delivery address: ${order.delivery_address}`] : []),
          '',
          SIGN_OFF,
        ].join('\n'),
      };
    case 'shipped':
      return {
        subject: `SAIACS POD — Order ${ref} shipped`,
        body: [
          greeting,
          '',
          `Good news — order ${ref} has been dispatched.`,
          '',
          ...(order.courier_name ? [`• Courier: ${order.courier_name}`] : []),
          ...(order.tracking_number ? [`• Tracking number: ${order.tracking_number}`] : []),
          ...(order.dispatch_date ? [`• Dispatched on: ${formatDate(order.dispatch_date)}`] : []),
          '',
          'Please reach out if you have any questions about delivery.',
          '',
          SIGN_OFF,
        ].join('\n'),
      };
    case 'invoice':
      return {
        subject: `SAIACS POD — Invoice for order ${ref}`,
        body: [
          greeting,
          '',
          `Please find attached the invoice for order ${ref}.`,
          '',
          `• Total: ${formatCurrency(order.total_price)}`,
          ...(order.zoho_invoice_id ? [`• Invoice reference: ${order.zoho_invoice_id}`] : []),
          `• Payment terms: ${order.payment_terms ?? 'prepay'}`,
          '',
          'Kindly arrange payment at your earliest convenience.',
          '',
          SIGN_OFF,
        ].join('\n'),
      };
  }
}
