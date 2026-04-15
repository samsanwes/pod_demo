import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { OrderRow, OrderStatus } from '@/lib/database.types';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatCurrency, formatDate, titleCase } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

const ORDER_STATUSES: (OrderStatus | 'all')[] = [
  'all', 'new', 'under_review', 'quoted', 'confirmed', 'in_production', 'ready',
  'shipped', 'picked_up', 'invoiced', 'closed', 'cancelled',
];

export function OrdersTable() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const { role } = useAuth();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (cancelled) return;
      if (error) {
        console.error(error);
      } else {
        setOrders((data ?? []) as OrderRow[]);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (!q) return true;
      const needle = q.toLowerCase();
      return (
        o.order_number?.toLowerCase().includes(needle) ||
        o.client_name.toLowerCase().includes(needle) ||
        o.client_organization.toLowerCase().includes(needle) ||
        o.client_email.toLowerCase().includes(needle)
      );
    });
  }, [orders, q, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Orders</h1>
          <p className="text-sm text-muted-foreground">
            {role === 'production'
              ? 'Your production queue — confirmed, in-production, and ready orders.'
              : role === 'bookstore'
              ? 'Shipping queue — ready orders with courier delivery.'
              : 'All orders. RLS filters the rest of the team automatically.'}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Input placeholder="Search order number, client, email…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ORDER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s === 'all' ? 'All statuses' : titleCase(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Binding</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">Loading…</TableCell>
              </TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">No orders found.</TableCell>
              </TableRow>
            )}
            {filtered.map((o) => (
              <TableRow key={o.id}>
                <TableCell>
                  <Link to={`/dashboard/orders/${o.id}`} className="font-mono text-sm font-medium hover:underline">
                    {o.order_number ?? o.id.slice(0, 8)}
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{o.client_name}</div>
                  <div className="text-xs text-muted-foreground">{o.client_organization}</div>
                </TableCell>
                <TableCell>{titleCase(o.binding_type)}</TableCell>
                <TableCell>{o.quantity}</TableCell>
                <TableCell><StatusBadge status={o.status} /></TableCell>
                <TableCell className="text-sm">{formatDate(o.delivery_date)}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(o.total_price)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
