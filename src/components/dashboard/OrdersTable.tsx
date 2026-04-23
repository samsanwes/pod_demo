import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { OrderRow, OrderStatus } from '@/lib/database.types';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatCurrency, formatDate, titleCase } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

const ALL_STATUSES: (OrderStatus | 'all')[] = [
  'all', 'new', 'under_review', 'quoted', 'confirmed', 'in_production', 'ready',
  'shipped', 'picked_up', 'invoiced', 'closed', 'cancelled',
];

type QueueTab = 'attention' | 'production' | 'ready' | 'done' | 'all';

const TAB_DEFS: Array<{ id: QueueTab; label: string; help: string }> = [
  { id: 'attention', label: 'Needs my action', help: 'New, under review, quoted, cancelled — or awaiting sample approval' },
  { id: 'production', label: 'In production', help: 'Confirmed or currently being produced' },
  { id: 'ready', label: 'Ready / shipped', help: 'Ready to ship, shipped, or picked up' },
  { id: 'done', label: 'Completed', help: 'Invoiced and closed' },
  { id: 'all', label: 'All', help: 'Everything' },
];

function matchesTab(tab: QueueTab, o: OrderRow): boolean {
  switch (tab) {
    case 'attention':
      // Manager needs to act when: a new order arrives, needs review/quote,
      // or production has pulled a sample and is waiting for client sign-off.
      return (
        ['new', 'under_review', 'quoted'].includes(o.status)
        || o.production_status === 'sample_approval'
      );
    case 'production':
      // Production phase: confirmed + actively producing + the "sample_approved"
      // handoff state where production is ready to start the full run.
      return (
        ['confirmed', 'in_production'].includes(o.status)
        && o.production_status !== 'sample_approval'
      );
    case 'ready':
      return ['ready', 'shipped', 'picked_up'].includes(o.status);
    case 'done':
      return ['invoiced', 'closed'].includes(o.status);
    case 'all':
      return true;
  }
}

export function OrdersTable() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [tab, setTab] = useState<QueueTab>('attention');
  const { role } = useAuth();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (cancelled) return;
      if (error) console.error(error);
      setOrders((data ?? []) as OrderRow[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Tab counts — always reflect the entire visible set (ignore search/status filter)
  const counts: Record<QueueTab, number> = useMemo(() => ({
    attention: orders.filter((o) => matchesTab('attention', o)).length,
    production: orders.filter((o) => matchesTab('production', o)).length,
    ready: orders.filter((o) => matchesTab('ready', o)).length,
    done: orders.filter((o) => matchesTab('done', o)).length,
    all: orders.length,
  }), [orders]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (!matchesTab(tab, o)) return false;
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (!q) return true;
      const needle = q.toLowerCase();
      return (
        o.order_number?.toLowerCase().includes(needle) ||
        o.title?.toLowerCase().includes(needle) ||
        o.client_name.toLowerCase().includes(needle) ||
        o.client_organization.toLowerCase().includes(needle) ||
        o.client_email.toLowerCase().includes(needle)
      );
    });
  }, [orders, q, statusFilter, tab]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Orders</h1>
        <p className="text-sm text-muted-foreground">
          {role === 'production'
            ? 'Your production queue — confirmed, in-production, and ready orders.'
            : role === 'bookstore'
            ? 'Shipping queue — ready orders with courier delivery, plus any internal orders you placed.'
            : 'All orders. Tabs below split by where you need to act.'}
        </p>
      </div>

      {/* Tabs — manager only. Production/bookstore already have RLS-scoped views. */}
      {role === 'manager' && (
        <Tabs value={tab} onValueChange={(v) => setTab(v as QueueTab)}>
          <TabsList>
            {TAB_DEFS.map((t) => (
              <TabsTrigger key={t.id} value={t.id} title={t.help} className="gap-2">
                <span>{t.label}</span>
                <Badge variant={t.id === tab ? 'secondary' : 'muted'} className="px-1.5">
                  {counts[t.id]}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input placeholder="Search order number, title, client, email…" value={q} onChange={(e) => setQ(e.target.value)} className="sm:max-w-sm" />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-full sm:w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ALL_STATUSES.map((s) => (
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
              <TableHead>Client / Title</TableHead>
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
                <TableCell colSpan={7} className="text-center text-muted-foreground">No orders match.</TableCell>
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
                  {o.title ? (
                    <>
                      <div className="font-medium">{o.title}</div>
                      <div className="text-xs text-muted-foreground">{titleCase(o.order_source)}</div>
                    </>
                  ) : (
                    <>
                      <div className="font-medium">{o.client_name}</div>
                      <div className="text-xs text-muted-foreground">{o.client_organization}</div>
                    </>
                  )}
                </TableCell>
                <TableCell>{titleCase(o.binding_type)}</TableCell>
                <TableCell>{o.quantity}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={o.status} />
                    {o.production_status === 'sample_approval' && (
                      <Badge variant="gold" title="Awaiting sample approval (manager)">Sample</Badge>
                    )}
                    {o.production_status === 'sample_approved' && (
                      <Badge variant="success" title="Sample approved — production can start full run">Approved</Badge>
                    )}
                    {o.is_on_hold && <Badge variant="tangerine">Hold</Badge>}
                  </div>
                </TableCell>
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
