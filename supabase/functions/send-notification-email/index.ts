// Sends transactional notification emails to the Press & Media Manager via Resend.
//
// Triggered by Supabase Database Webhooks on the `orders` table — one webhook
// for INSERT and one for UPDATE. Payload:
//   { type: 'INSERT' | 'UPDATE', table: 'orders', record: OrderRow, old_record?: OrderRow }
//
// This function inspects the diff and fires an email for:
//   - new_order        : INSERT with order_source='public' (i.e. public form submission)
//   - sample_approval  : UPDATE where production_status transitioned to 'sample_approval'
//   - ready            : UPDATE where status transitioned to 'ready'
//   - cancelled        : UPDATE where status transitioned to 'cancelled'
//
// If RESEND_API_KEY is not set, the function logs and returns 200 so the
// webhook isn't stuck retrying. Set the secret via:
//   supabase secrets set RESEND_API_KEY=re_xxx
//
// @ts-expect-error Deno runtime
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';

// @ts-expect-error Deno global
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
// @ts-expect-error Deno global
const NOTIFY_TO = Deno.env.get('NOTIFY_TO') ?? 'saiacspress@saiacs.org';
// @ts-expect-error Deno global
const NOTIFY_FROM = Deno.env.get('NOTIFY_FROM') ?? 'SAIACS POD <onboarding@resend.dev>';
// @ts-expect-error Deno global
const APP_BASE_URL = Deno.env.get('APP_BASE_URL') ?? 'https://pod-demo-mu.vercel.app';

interface OrderRecord {
  id: string;
  order_number: string | null;
  status: string;
  production_status: string | null;
  binding_type: string;
  quantity: number;
  delivery_date: string;
  delivery_method: string;
  client_name: string;
  client_email: string;
  client_organization: string;
  client_phone: string;
  total_price: number | null;
  title: string | null;
  order_source: string | null;
  hold_reason: string | null;
}

serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const type: 'INSERT' | 'UPDATE' | undefined = body.type;
    const record: OrderRecord | undefined = body.record;
    const oldRecord: OrderRecord | undefined = body.old_record;

    if (!record) return json({ ok: true, skipped: 'no record' });

    const event = pickEvent(type, record, oldRecord);
    if (!event) return json({ ok: true, skipped: 'no matching event' });

    if (!RESEND_API_KEY) {
      console.warn('[send-notification-email] RESEND_API_KEY not set — skipping actual send', event, record.id);
      return json({ ok: true, skipped: 'no_api_key', event });
    }

    const msg = buildMessage(event, record);
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: NOTIFY_FROM,
        to: [NOTIFY_TO],
        subject: msg.subject,
        text: msg.text,
      }),
    });
    const resendText = await resendRes.text();
    if (!resendRes.ok) {
      console.error('[send-notification-email] Resend failed', resendRes.status, resendText);
      return json({ error: `Resend HTTP ${resendRes.status}`, body: resendText }, 502);
    }

    return json({ ok: true, event, resend: JSON.parse(resendText) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[send-notification-email] error', err);
    return json({ error: message }, 500);
  }
});

type NotificationEvent = 'new_order' | 'sample_approval' | 'ready' | 'cancelled';

function pickEvent(
  type: 'INSERT' | 'UPDATE' | undefined,
  record: OrderRecord,
  oldRecord: OrderRecord | undefined,
): NotificationEvent | null {
  if (type === 'INSERT') {
    // New public order submission.
    if (record.order_source === 'public' || record.order_source == null) {
      return 'new_order';
    }
    return null;
  }
  if (type === 'UPDATE' && oldRecord) {
    if (record.production_status === 'sample_approval' && oldRecord.production_status !== 'sample_approval') {
      return 'sample_approval';
    }
    if (record.status === 'ready' && oldRecord.status !== 'ready') {
      return 'ready';
    }
    if (record.status === 'cancelled' && oldRecord.status !== 'cancelled') {
      return 'cancelled';
    }
  }
  return null;
}

interface Msg { subject: string; text: string }

function buildMessage(event: NotificationEvent, o: OrderRecord): Msg {
  const ref = o.order_number ?? o.id.slice(0, 8);
  const deepLink = `${APP_BASE_URL}/dashboard/orders/${o.id}`;
  const summary = [
    `Reference : ${ref}`,
    o.title ? `Title     : ${o.title}` : null,
    `Client    : ${o.client_name} (${o.client_organization})`,
    `Email     : ${o.client_email}`,
    `Phone     : ${o.client_phone}`,
    `Binding   : ${o.binding_type}`,
    `Quantity  : ${o.quantity}`,
    `Delivery  : ${o.delivery_method} by ${o.delivery_date}`,
    o.total_price != null ? `Total     : ₹${o.total_price}` : null,
  ].filter(Boolean).join('\n');

  switch (event) {
    case 'new_order':
      return {
        subject: `[SAIACS POD] New order received — ${ref}`,
        text: [
          `A new print-on-demand request has just been submitted.`,
          '',
          summary,
          '',
          `Action needed: review the order, calculate the price, and send a quote.`,
          '',
          `Open: ${deepLink}`,
          '',
          `— SAIACS POD`,
        ].join('\n'),
      };
    case 'sample_approval':
      return {
        subject: `[SAIACS POD] Sample ready for your review — ${ref}`,
        text: [
          `Production has reached the sample approval stage. The sample should be available at the press.`,
          '',
          summary,
          '',
          `Action needed: collect the sample, share it with the client, and click "Approve sample" in the order detail once the client approves.`,
          '',
          `Open: ${deepLink}`,
          '',
          `— SAIACS POD`,
        ].join('\n'),
      };
    case 'ready':
      return {
        subject: `[SAIACS POD] Order ready — ${ref}`,
        text: [
          `Production is complete. The order is ready for pickup / dispatch.`,
          '',
          summary,
          '',
          `Action needed: notify the client and arrange delivery. Move through shipping and invoicing as applicable.`,
          '',
          `Open: ${deepLink}`,
          '',
          `— SAIACS POD`,
        ].join('\n'),
      };
    case 'cancelled':
      return {
        subject: `[SAIACS POD] Order cancelled — ${ref}`,
        text: [
          `An order has been marked cancelled.`,
          '',
          summary,
          '',
          `Open: ${deepLink}`,
          '',
          `— SAIACS POD`,
        ].join('\n'),
      };
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
