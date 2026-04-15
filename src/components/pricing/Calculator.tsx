import { useState } from 'react';
import { Loader2, Calculator as CalcIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { OrderRow, PriceBreakdown } from '@/lib/database.types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency, titleCase } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { toast } from '@/hooks/use-toast';

interface Props {
  order: OrderRow;
  onUpdated: (next: OrderRow) => void;
}

export function Calculator({ order, onUpdated }: Props) {
  const { role } = useAuth();
  const [margin, setMargin] = useState(order.margin_percent);
  const [inflation, setInflation] = useState(order.inflation_percent);
  const [running, setRunning] = useState(false);

  const bd = order.price_breakdown;
  const canEdit = role === 'manager';

  async function runCalc() {
    setRunning(true);
    try {
      // Persist the manager's margin/inflation overrides first
      await supabase.from('orders').update({
        margin_percent: margin,
        inflation_percent: inflation,
      }).eq('id', order.id);

      const { data, error } = await supabase.functions.invoke('calculate-price', {
        body: { order_id: order.id },
      });
      if (error) throw error;

      // Refresh the order row
      const { data: refreshed } = await supabase
        .from('orders')
        .select('*')
        .eq('id', order.id)
        .single();
      if (refreshed) onUpdated(refreshed as OrderRow);
      toast({ title: 'Price calculated', description: `Total: ${formatCurrency((data as { total_price?: number })?.total_price ?? 0)}` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ variant: 'destructive', title: 'Calculation failed', description: msg });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_1.5fr]">
      <Card>
        <CardHeader><CardTitle className="text-base">Settings</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Margin %</Label>
            <Input type="number" step="0.5" value={margin} onChange={(e) => setMargin(parseFloat(e.target.value))} disabled={!canEdit} />
          </div>
          <div>
            <Label>Inflation %</Label>
            <Input type="number" step="0.5" value={inflation} onChange={(e) => setInflation(parseFloat(e.target.value))} disabled={!canEdit} />
          </div>
          <Button onClick={runCalc} disabled={!canEdit || running} className="w-full">
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalcIcon className="mr-2 h-4 w-4" />}
            {running ? 'Calculating…' : 'Calculate price'}
          </Button>
          <p className="text-xs text-muted-foreground">
            Rate card values are snapshotted into <code>price_breakdown</code> each time you calculate, so quotes
            stay stable even if rates change later.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Breakdown</CardTitle></CardHeader>
        <CardContent>
          {!bd ? (
            <p className="text-sm text-muted-foreground">No price calculated yet.</p>
          ) : (
            <div className="space-y-3">
              <dl className="grid grid-cols-2 gap-y-1 text-sm">
                {Object.entries(bd.components).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted-foreground">{titleCase(k)}</dt>
                    <dd className="text-right">{formatCurrency(v)}</dd>
                  </div>
                ))}
              </dl>
              <hr />
              <dl className="grid grid-cols-2 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Unit cost</dt>
                <dd className="text-right font-medium">{formatCurrency(bd.unit_cost)}</dd>
                <dt className="text-muted-foreground">Margin</dt>
                <dd className="text-right">{bd.margin_percent}%</dd>
                <dt className="text-muted-foreground">Inflation</dt>
                <dd className="text-right">{bd.inflation_percent}%</dd>
                <dt className="text-muted-foreground">Price / copy</dt>
                <dd className="text-right font-medium">{formatCurrency(bd.price_per_copy)}</dd>
                <dt className="text-muted-foreground">Quantity</dt>
                <dd className="text-right">{bd.quantity}</dd>
              </dl>
              <hr />
              <div className="flex items-baseline justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-display text-2xl font-bold">{formatCurrency(bd.total_price)}</span>
              </div>
              <p className="text-xs text-muted-foreground">Calculated {new Date(bd.calculated_at).toLocaleString()}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
