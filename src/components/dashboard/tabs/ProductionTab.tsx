import { useState } from 'react';
import { Loader2, Pause, Play, CheckCircle2, Clock, PlayCircle } from 'lucide-react';
import type { OrderRow, ProductionStatus } from '@/lib/database.types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ProductionStatusBadge } from '@/components/shared/StatusBadge';
import { titleCase } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { toast } from '@/hooks/use-toast';

// Production dropdown options (UI). "started" is collapsed into "in_progress"
// (migration 20260416150000). "sample_approved" is never picked directly —
// it's set by the manager's Approve button and cleared by the production
// person's Start-full-production button.
const PROD_STATUSES_FOR_UI: ProductionStatus[] = [
  'not_started', 'in_progress', 'sample_approval', 'full_production', 'completed',
];

interface Props {
  order: OrderRow;
  onUpdated: (next: OrderRow) => void;
}

export function ProductionTab({ order, onUpdated }: Props) {
  const { role, user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [holdReason, setHoldReason] = useState('');
  const [nextProd, setNextProd] = useState<ProductionStatus>(order.production_status ?? 'not_started');

  const ps = order.production_status;
  const isAwaitingSampleApproval = ps === 'sample_approval';
  const isSampleApproved = ps === 'sample_approved';
  const isManager = role === 'manager';
  const isProduction = role === 'production';

  // Ballpark responsibility ownership by sub-status:
  //  - sample_approval → ball is with MANAGER (review sample, approve)
  //  - sample_approved → ball is with PRODUCTION (kick off full run)
  // Neither role picks these via dropdown — they transition via the two
  // dedicated buttons below.
  const productionIsBlocked = isProduction && isAwaitingSampleApproval;
  const canEdit = (isManager || isProduction) && !productionIsBlocked;
  const canEditStatus = canEdit && !order.is_on_hold && ['confirmed', 'in_production', 'ready'].includes(order.status);

  async function updateOrder(patch: Partial<OrderRow>) {
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .update(patch)
        .eq('id', order.id)
        .select('*')
        .single();
      if (error) throw error;
      if (data) onUpdated(data as OrderRow);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ variant: 'destructive', title: 'Update failed', description: msg });
    } finally {
      setBusy(false);
    }
  }

  async function applyStatus() {
    const patch: Partial<OrderRow> = { production_status: nextProd };
    if (order.status === 'confirmed' && nextProd !== 'not_started') patch.status = 'in_production';
    if (nextProd === 'completed') patch.status = 'ready';
    await updateOrder(patch);
  }

  async function approveSample() {
    // Manager signs off on the sample — hands the ball back to production.
    await updateOrder({ production_status: 'sample_approved' });
    toast({ title: 'Sample approved', description: 'Production has been notified to start the full run.' });
  }

  async function startFullProduction() {
    // Production acknowledges the approval and kicks off the real run.
    await updateOrder({ production_status: 'full_production' });
    toast({ title: 'Full production started' });
  }

  async function placeHold() {
    if (!holdReason.trim() || !user) return;
    setBusy(true);
    try {
      await supabase.from('order_holds').insert({
        order_id: order.id,
        placed_by: user.id,
        reason: holdReason.trim(),
        production_status_before_hold: order.production_status,
      });
      await updateOrder({ is_on_hold: true, hold_reason: holdReason.trim() });
      setHoldReason('');
    } finally {
      setBusy(false);
    }
  }

  async function resume() {
    if (!user) return;
    setBusy(true);
    try {
      const { data: open } = await supabase
        .from('order_holds')
        .select('*')
        .eq('order_id', order.id)
        .is('resumed_at', null)
        .order('placed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const prevStatus = (open?.production_status_before_hold as ProductionStatus | null) ?? order.production_status;
      if (open) {
        await supabase
          .from('order_holds')
          .update({ resumed_by: user.id, resumed_at: new Date().toISOString() })
          .eq('id', open.id);
      }
      await updateOrder({ is_on_hold: false, hold_reason: null, production_status: prevStatus });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      {/* Sample-approval request (manager action required) */}
      {isAwaitingSampleApproval && (
        <Card className="border-brand-gold/50 bg-brand-gold/10">
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-brand-foundations" />
              <div>
                <div className="font-semibold text-brand-foundations">Awaiting sample approval</div>
                <div className="text-sm text-muted-foreground">
                  {isManager
                    ? 'Production has pulled a sample. Share it with the client, then click Approve to hand the ball back to production.'
                    : "Manager is reviewing the sample with the client. You'll see the next step appear here once they approve."}
                </div>
              </div>
            </div>
            {isManager && (
              <Button onClick={approveSample} disabled={busy} className="shrink-0">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Approve sample
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sample approved — production action required */}
      {isSampleApproved && (
        <Card className="border-emerald-400/50 bg-emerald-50">
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
              <div>
                <div className="font-semibold text-emerald-900">Sample approved</div>
                <div className="text-sm text-muted-foreground">
                  {isProduction
                    ? 'The client signed off on the sample. Ready to start the full run? Click Start full production to begin.'
                    : 'Ball is with production — they will start the full run.'}
                </div>
              </div>
            </div>
            {(isProduction || isManager) && (
              <Button onClick={startFullProduction} disabled={busy} className="shrink-0" variant="default">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
                Start full production
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Production status</CardTitle>
          <ProductionStatusBadge status={order.production_status} />
        </CardHeader>
        <CardContent className="space-y-3">
          {order.is_on_hold ? (
            <div className="rounded-md bg-brand-tangerine/15 p-3 text-sm">
              <div className="font-semibold text-brand-foundations">On hold</div>
              <div className="text-muted-foreground">{order.hold_reason}</div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select value={nextProd} onValueChange={(v) => setNextProd(v as ProductionStatus)} disabled={!canEditStatus || isSampleApproved}>
                <SelectTrigger className="w-full sm:w-[220px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROD_STATUSES_FOR_UI.map((s) => (
                    <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={applyStatus} disabled={!canEditStatus || isSampleApproved || busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Update
              </Button>
            </div>
          )}
          {isSampleApproved && !order.is_on_hold && (
            <p className="text-xs text-muted-foreground">
              Use the Start full production button above to advance from the sample-approved state.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Hold / resume</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {order.is_on_hold ? (
            <Button onClick={resume} disabled={!(isManager || isProduction) || busy}>
              <Play className="mr-2 h-4 w-4" />
              Resume production
            </Button>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>Reason for hold</Label>
                <Textarea value={holdReason} onChange={(e) => setHoldReason(e.target.value)} rows={2} placeholder="e.g. waiting on client approval of sample" disabled={!(isManager || isProduction)} />
              </div>
              <Button variant="accent" onClick={placeHold} disabled={!(isManager || isProduction) || !holdReason.trim() || busy}>
                <Pause className="mr-2 h-4 w-4" />
                Place on hold
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
