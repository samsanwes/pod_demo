// Calculate price for an order using the rate card.
// Applies spec §7 formula:
//   Unit Cost = paper_text + paper_cover + print_text + print_cover + binding + lamination + overhead
//   Price/Copy = Unit Cost / (1 - margin%)
//   Total/Copy = Price/Copy * (1 + inflation%)
//   Order Total = Total/Copy * quantity
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
  inner_printing: 'bw' | 'colour' | null;
  cover_printing: 'bw' | 'colour' | null;
  cover_lamination: 'glossy' | 'matte' | 'velvet' | 'none' | null;
  paper_size: string | null;
  printing_type: ('bw' | 'colour')[] | null;
  printing_sides: string | null;
  margin_percent: number;
  inflation_percent: number;
}

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

    // Fetch active rate card
    const [papersRes, printersRes, lamRes, overheadRes, imposRes] = await Promise.all([
      admin.from('paper_types').select('*').eq('is_active', true),
      admin.from('printer_rates').select('*').eq('is_active', true),
      admin.from('lamination_types').select('*').eq('is_active', true),
      admin.from('overhead_costs').select('*').eq('is_active', true),
      admin.from('imposition_rules').select('*'),
    ]);

    const papers = (papersRes.data ?? []) as Array<{ name: string; gsm: number; usage: string; price_per_sheet: number }>;
    const printers = (printersRes.data ?? []) as Array<{ colour_mode: string; paper_size: string; price_per_sheet: number }>;
    const lams = (lamRes.data ?? []) as Array<{ name: string; roll_price: number }>;
    const overheads = (overheadRes.data ?? []) as Array<{ name: string; cost_per_copy: number }>;
    const imposs = (imposRes.data ?? []) as Array<{ trim_size: string; printer_paper_size: string; pages_per_sheet: number }>;

    const components: Record<string, number> = {};

    // --- Book-binding (perfect) pricing ---
    if (order.binding_type === 'perfect') {
      const pages = order.num_pages ?? 0;
      const trim = order.trim_size ?? 'A5';
      const printerPaperSize = 'A3'; // default; could be looked up from paper_type config
      const impos = imposs.find((i) => i.trim_size === trim && i.printer_paper_size === printerPaperSize);
      const pagesPerSheet = impos?.pages_per_sheet ?? 4;
      const sheetsPerCopy = Math.ceil(pages / pagesPerSheet);

      // Text paper cost
      const matchedTextPaper = matchPaper(papers, order.paper_type, 'text');
      if (matchedTextPaper) {
        components.paper_text = sheetsPerCopy * matchedTextPaper.price_per_sheet;
      }
      // Cover paper (assume 1 sheet cover)
      const coverPaper = matchPaper(papers, null, 'cover');
      if (coverPaper) components.paper_cover = coverPaper.price_per_sheet;

      // Printing (inner)
      const innerPrint = printers.find(
        (p) => p.colour_mode === (order.inner_printing ?? 'bw') && p.paper_size === printerPaperSize
      );
      if (innerPrint) components.print_text = sheetsPerCopy * innerPrint.price_per_sheet;

      // Printing (cover)
      const coverPrint = printers.find(
        (p) => p.colour_mode === (order.cover_printing ?? 'colour') && p.paper_size === printerPaperSize
      );
      if (coverPrint) components.print_cover = coverPrint.price_per_sheet;

      // Lamination
      if (order.cover_lamination && order.cover_lamination !== 'none') {
        const lam = lams.find((l) => l.name.toLowerCase() === order.cover_lamination);
        // Very simple model: amortize roll price over ~200 covers
        if (lam) components.lamination = lam.roll_price / 200;
      }

      // Binding per-copy (flat; use overhead 'Binding' if present else default)
      const bindingOverhead = overheads.find((o) => o.name.toLowerCase() === 'binding');
      components.binding = bindingOverhead?.cost_per_copy ?? 8.0;
    } else {
      // --- Non-book print jobs (saddle/wiro/comb/document/other) ---
      const sheetsPerCopy = order.printing_sides === 'double' ? Math.ceil((order.num_pages ?? 1) / 2) : order.num_pages ?? 1;
      const size = order.paper_size ?? 'A4';

      // Use first matching text paper for size
      const paper = papers.find((p) => p.usage === 'text') ?? papers[0];
      if (paper) components.paper_text = sheetsPerCopy * paper.price_per_sheet;

      // Printing — sum each requested colour mode
      for (const mode of order.printing_type ?? ['bw']) {
        const p = printers.find((r) => r.colour_mode === mode && r.paper_size === size);
        if (p) components[`print_${mode}`] = sheetsPerCopy * p.price_per_sheet;
      }

      // Light binding for wiro/comb
      if (['wiro', 'comb'].includes(order.binding_type)) {
        components.binding = 15.0;
      }
    }

    // Overheads (cutting, labour, machinery, admin)
    for (const oh of overheads) {
      if (!components[oh.name.toLowerCase()]) {
        components[oh.name.toLowerCase()] = oh.cost_per_copy;
      }
    }

    const unitCost = Object.values(components).reduce((a, b) => a + b, 0);
    const margin = Number(order.margin_percent ?? 30);
    const inflation = Number(order.inflation_percent ?? 9);

    const marginDenom = Math.max(0.0001, 1 - margin / 100);
    const pricePerCopyBeforeInflation = unitCost / marginDenom;
    const pricePerCopy = pricePerCopyBeforeInflation * (1 + inflation / 100);
    const totalPrice = pricePerCopy * order.quantity;

    const breakdown = {
      unit_cost: round2(unitCost),
      components: Object.fromEntries(Object.entries(components).map(([k, v]) => [k, round2(v)])),
      margin_percent: margin,
      inflation_percent: inflation,
      price_per_copy: round2(pricePerCopy),
      total_price: round2(totalPrice),
      quantity: order.quantity,
      rate_card_snapshot: {
        papers, printers, lams, overheads, imposs,
      },
      calculated_at: new Date().toISOString(),
    };

    const { error: updErr } = await admin
      .from('orders')
      .update({
        unit_production_cost: round2(unitCost),
        price_per_copy: round2(pricePerCopy),
        total_price: round2(totalPrice),
        price_breakdown: breakdown,
      })
      .eq('id', orderId);
    if (updErr) throw updErr;

    return json(breakdown);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});

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
