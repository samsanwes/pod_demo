// Calculate price for an order using the rate card.
//
// Spec §7 formula, extended per Apr-2026 requests:
//   Unit Cost      = paper_text + paper_cover + print_text + print_cover
//                    + binding + lamination + overhead_components
//                    (overhead_components = overhead_costs rows where binding_type
//                     is NULL OR matches order.binding_type)
//   Price/Copy     = Unit Cost / (1 - margin%)
//   After Inflate  = Price/Copy * (1 + inflation%)
//   After Discount = After Inflate * (1 - discount%)
//   Subtotal       = After Discount * quantity
//   Total          = ROUND( Subtotal + (shipping_charge if courier) )   — to whole rupees
//
// @ts-expect-error Deno runtime
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
// @ts-expect-error Deno runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { corsHeaders } from '../_shared/cors.ts';

// @ts-expect-error Deno global
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
// @ts-expect-error Deno global
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface Order {
  id: string;
  binding_type: string;
  quantity: number;
  num_pages: number | null;
  trim_size: string | null;
  paper_type: string | null;
  cover_paper_type: string | null;
  inner_printing: 'bw' | 'colour' | null;
  cover_printing: 'bw' | 'colour' | null;
  cover_lamination: 'glossy' | 'matte' | 'velvet' | 'none' | null;
  paper_size: string | null;
  printing_type: ('bw' | 'colour')[] | null;
  printing_sides: string | null;
  delivery_method: 'pickup' | 'courier';
  margin_percent: number;
  inflation_percent: number;
  discount_percent: number;
}

const NOT_SURE = 'Not sure — please recommend';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const orderId: string | undefined = body.order_id;
    if (!orderId) return json({ error: 'order_id is required' }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Enforce caller is authenticated manager
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    if (jwt) {
      const { data: userData } = await admin.auth.getUser(jwt);
      const uid = userData.user?.id;
      if (!uid) return json({ error: 'Unauthorized' }, 401);
      const { data: row } = await admin.from('users').select('role,is_active').eq('id', uid).single();
      const profile = row as { role?: string; is_active?: boolean } | null;
      if (!profile?.is_active || profile?.role !== 'manager') {
        return json({ error: 'Manager role required' }, 403);
      }
    }

    const { data: orderData, error: orderErr } = await admin
      .from('orders').select('*').eq('id', orderId).single();
    if (orderErr || !orderData) return json({ error: orderErr?.message ?? 'Order not found' }, 404);
    const order = orderData as Order;

    // Fetch active rate card + pricing settings
    const [papersRes, printersRes, lamRes, overheadRes, imposRes, settingsRes] = await Promise.all([
      admin.from('paper_types').select('*').eq('is_active', true),
      admin.from('printer_rates').select('*').eq('is_active', true),
      admin.from('lamination_types').select('*').eq('is_active', true),
      admin.from('overhead_costs').select('*').eq('is_active', true),
      admin.from('imposition_rules').select('*'),
      admin.from('pricing_settings').select('*').limit(1).maybeSingle(),
    ]);

    const papers = (papersRes.data ?? []) as Array<{ name: string; gsm: number; usage: string; price_per_sheet: number }>;
    const printers = (printersRes.data ?? []) as Array<{ colour_mode: string; paper_size: string; price_per_sheet: number }>;
    const lams = (lamRes.data ?? []) as Array<{ name: string; roll_price: number }>;
    const allOverheads = (overheadRes.data ?? []) as Array<{ name: string; cost_per_copy: number; binding_type: string | null }>;
    const imposs = (imposRes.data ?? []) as Array<{ trim_size: string; printer_paper_size: string; pages_per_sheet: number }>;
    const settings = (settingsRes.data ?? {}) as { shipping_charge?: number };

    // Only overheads where binding_type is NULL (applies-to-all) OR matches the order's binding.
    const overheads = allOverheads.filter(
      (o) => o.binding_type == null || o.binding_type === order.binding_type
    );

    const components: Record<string, number> = {};

    // --- Book-binding pricing (perfect binding + saddle stitch) ---
    if (['perfect', 'saddle'].includes(order.binding_type)) {
      const pages = order.num_pages ?? 0;
      const trim = order.trim_size ?? 'A5';
      const printerPaperSize = 'A3';
      const impos = imposs.find((i) => i.trim_size === trim && i.printer_paper_size === printerPaperSize);
      const pagesPerSheet = impos?.pages_per_sheet ?? 4;
      const sheetsPerCopy = Math.ceil(pages / pagesPerSheet);

      const textPref = order.paper_type === NOT_SURE ? null : order.paper_type;
      const matchedTextPaper = matchPaper(papers, textPref, 'text');
      if (matchedTextPaper) {
        components.paper_text = sheetsPerCopy * matchedTextPaper.price_per_sheet;
      }
      const coverPref = order.cover_paper_type === NOT_SURE ? null : order.cover_paper_type;
      const coverPaper = matchPaper(papers, coverPref, 'cover');
      if (coverPaper) components.paper_cover = coverPaper.price_per_sheet;

      const innerPrint = printers.find(
        (p) => p.colour_mode === (order.inner_printing ?? 'bw') && p.paper_size === printerPaperSize
      );
      if (innerPrint) components.print_text = sheetsPerCopy * innerPrint.price_per_sheet;

      const coverPrint = printers.find(
        (p) => p.colour_mode === (order.cover_printing ?? 'colour') && p.paper_size === printerPaperSize
      );
      if (coverPrint) components.print_cover = coverPrint.price_per_sheet;

      if (order.cover_lamination && order.cover_lamination !== 'none') {
        const lam = lams.find((l) => l.name.toLowerCase() === order.cover_lamination);
        if (lam) components.lamination = lam.roll_price / 200;
      }

      // Fallback binding cost — only used if no overhead row named "binding" exists for this binding type.
      if (!overheads.find((o) => o.name.toLowerCase() === 'binding')) {
        components.binding = order.binding_type === 'perfect' ? 8.0 : 3.0;
      }
    } else {
      // --- Non-book print jobs ---
      const sheetsPerCopy = order.printing_sides === 'double'
        ? Math.ceil((order.num_pages ?? 1) / 2)
        : order.num_pages ?? 1;
      const size = order.paper_size ?? 'A4';

      const paper = papers.find((p) => p.usage === 'text') ?? papers[0];
      if (paper) components.paper_text = sheetsPerCopy * paper.price_per_sheet;

      for (const mode of order.printing_type ?? ['bw']) {
        const p = printers.find((r) => r.colour_mode === mode && r.paper_size === size);
        if (p) components[`print_${mode}`] = sheetsPerCopy * p.price_per_sheet;
      }

      if (['wiro', 'comb'].includes(order.binding_type) &&
          !overheads.find((o) => o.name.toLowerCase() === 'binding')) {
        components.binding = 15.0;
      }
    }

    // Binding-scoped overheads (cutting, labour, admin, or binding-specific ones).
    for (const oh of overheads) {
      const key = oh.name.toLowerCase().replace(/\s+/g, '_');
      if (!components[key]) {
        components[key] = oh.cost_per_copy;
      }
    }

    const unitCost = Object.values(components).reduce((a, b) => a + b, 0);
    const margin = Number(order.margin_percent ?? 30);
    const inflation = Number(order.inflation_percent ?? 9);
    const discount = Number(order.discount_percent ?? 0);
    const shippingCharge = order.delivery_method === 'courier'
      ? Number(settings.shipping_charge ?? 0)
      : 0;

    const marginDenom = Math.max(0.0001, 1 - margin / 100);
    const pricePerCopyBeforeDiscount = (unitCost / marginDenom) * (1 + inflation / 100);
    const pricePerCopy = pricePerCopyBeforeDiscount * (1 - discount / 100);
    const subtotal = pricePerCopy * order.quantity;
    const totalRaw = subtotal + shippingCharge;
    const totalPrice = Math.round(totalRaw); // whole rupees

    const breakdown = {
      unit_cost: round2(unitCost),
      components: Object.fromEntries(Object.entries(components).map(([k, v]) => [k, round2(v)])),
      margin_percent: margin,
      inflation_percent: inflation,
      discount_percent: discount,
      price_per_copy: round2(pricePerCopyBeforeDiscount),
      price_per_copy_after_discount: round2(pricePerCopy),
      shipping_charge: round2(shippingCharge),
      subtotal: round2(subtotal),
      total_price: totalPrice,
      quantity: order.quantity,
      delivery_method: order.delivery_method,
      rate_card_snapshot: { papers, printers, lams, overheads: allOverheads, imposs, settings },
      calculated_at: new Date().toISOString(),
    };

    const { error: updErr } = await admin
      .from('orders')
      .update({
        unit_production_cost: round2(unitCost),
        price_per_copy: round2(pricePerCopy),
        total_price: totalPrice,
        price_breakdown: breakdown,
      })
      .eq('id', orderId);
    if (updErr) throw updErr;

    return json(breakdown);
  } catch (err) {
    const message = extractErrorMessage(err);
    console.error('[calculate-price] error:', err);
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

function matchPaper(papers: Array<{ name: string; gsm: number; usage: string; price_per_sheet: number }>, wanted: string | null, usage: 'text' | 'cover' | 'special') {
  if (wanted) {
    const byName = papers.find((p) => wanted.toLowerCase().includes(p.name.toLowerCase()) && p.usage === usage);
    if (byName) return byName;
  }
  return papers.find((p) => p.usage === usage);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
