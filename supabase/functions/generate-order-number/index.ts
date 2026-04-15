// Assigns a human-friendly POD-YYYY-NNNN order number to a newly submitted order.
// Public endpoint — callable from the anonymous order form.
// @ts-expect-error Deno runtime
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
// @ts-expect-error Deno runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { corsHeaders } from '../_shared/cors.ts';

// @ts-expect-error Deno global
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
// @ts-expect-error Deno global
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const orderId: string | undefined = body.order_id;
    if (!orderId) {
      return json({ error: 'order_id is required' }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Generate via DB function (year-scoped sequence)
    const { data: numData, error: numErr } = await admin.rpc('next_order_number');
    if (numErr) throw numErr;
    const orderNumber = numData as unknown as string;

    const { error: updErr } = await admin
      .from('orders')
      .update({ order_number: orderNumber })
      .eq('id', orderId);
    if (updErr) throw updErr;

    return json({ ok: true, order_id: orderId, order_number: orderNumber });
  } catch (err) {
    const message = extractErrorMessage(err);
    console.error('[generate-order-number] error:', err);
    return json({ error: message }, 500);
  }
});

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    if (typeof e.message === 'string') return e.message;
    if (typeof e.error === 'string') return e.error;
    try { return JSON.stringify(err); } catch { /* fallthrough */ }
  }
  return String(err);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
