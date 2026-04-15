import { useState } from 'react';
import { Loader2, Truck, PackageCheck } from 'lucide-react';
import type { OrderRow } from '@/lib/database.types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface Props {
  order: OrderRow;
  onUpdated: (next: OrderRow) => void;
}

export function ShippingTab({ order, onUpdated }: Props) {
  const { role } = useAuth();
  const [courier, setCourier] = useState(order.courier_name ?? '');
  const [tracking, setTracking] = useState(order.tracking_number ?? '');
  const [dispatchDate, setDispatchDate] = useState(order.dispatch_date ?? new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  const canShip = (role === 'bookstore' || role === 'manager') && order.delivery_method === 'courier' && order.status === 'ready';
  const canMarkPickup = role === 'manager' && order.delivery_method === 'pickup' && order.status === 'ready';

  async function shipIt() {
    if (!courier.trim() || !tracking.trim()) {
      toast({ variant: 'destructive', title: 'Missing info', description: 'Courier and tracking are required.' });
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .update({
          courier_name: courier,
          tracking_number: tracking,
          dispatch_date: dispatchDate,
          status: 'shipped',
        })
        .eq('id', order.id)
        .select('*')
        .single();
      if (error) throw error;
      if (data) onUpdated(data as OrderRow);
      toast({ title: 'Order shipped' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ variant: 'destructive', title: 'Update failed', description: msg });
    } finally {
      setBusy(false);
    }
  }

  async function markPickedUp() {
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .update({ status: 'picked_up' })
        .eq('id', order.id)
        .select('*')
        .single();
      if (error) throw error;
      if (data) onUpdated(data as OrderRow);
    } finally {
      setBusy(false);
    }
  }

  if (order.delivery_method === 'pickup') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pickup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This order is set to pickup from the campus bookstore.
            {order.status === 'picked_up' && ' ✓ Already marked picked up.'}
          </p>
          {canMarkPickup && (
            <Button onClick={markPickedUp} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackageCheck className="mr-2 h-4 w-4" />}
              Mark picked up
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Courier dispatch</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {order.status === 'shipped' && (
          <div className="rounded-md bg-emerald-50 p-3 text-sm">
            ✓ Shipped on {formatDate(order.dispatch_date)} via {order.courier_name} — tracking <code>{order.tracking_number}</code>
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Delivery address (from customer)</Label>
          <p className="text-sm text-muted-foreground">{order.delivery_address}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Courier</Label>
            <Input value={courier} onChange={(e) => setCourier(e.target.value)} disabled={!canShip} placeholder="e.g. DTDC" />
          </div>
          <div className="space-y-1.5">
            <Label>Tracking number</Label>
            <Input value={tracking} onChange={(e) => setTracking(e.target.value)} disabled={!canShip} />
          </div>
          <div className="space-y-1.5">
            <Label>Dispatch date</Label>
            <Input type="date" value={dispatchDate} onChange={(e) => setDispatchDate(e.target.value)} disabled={!canShip} />
          </div>
        </div>
        <Button onClick={shipIt} disabled={!canShip || busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}
          Mark as shipped
        </Button>
      </CardContent>
    </Card>
  );
}
