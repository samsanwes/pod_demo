import { useState } from 'react';
import { Loader2, Pause, Play } from 'lucide-react';
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

const PROD_STATUSES: ProductionStatus[] = [
  'not_started', 'started', 'in_progress', 'sample_approval', 'full_production', 'completed',
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

  const canEdit = role === 'manager' || role === 'production';
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
      // Find the open hold and mark it resumed
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
            <div className="flex items-center gap-2">
              <Select value={nextProd} onValueChange={(v) => setNextProd(v as ProductionStatus)} disabled={!canEditStatus}>
                <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROD_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={applyStatus} disabled={!canEditStatus || busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Update
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Hold / resume</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {order.is_on_hold ? (
            <Button onClick={resume} disabled={!canEdit || busy}>
              <Play className="mr-2 h-4 w-4" />
              Resume production
            </Button>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>Reason for hold</Label>
                <Textarea value={holdReason} onChange={(e) => setHoldReason(e.target.value)} rows={2} placeholder="e.g. waiting on client approval of sample" disabled={!canEdit} />
              </div>
              <Button variant="accent" onClick={placeHold} disabled={!canEdit || !holdReason.trim() || busy}>
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
