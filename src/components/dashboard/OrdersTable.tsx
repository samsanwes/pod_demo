import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { OrderRow, OrderStatus, ProductionStatus, UserRole } from '@/lib/database.types';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { StatusBadge, ProductionStatusBadge } from '@/components/shared/StatusBadge';
import { formatCurrency, formatDate, formatOrderSource, titleCase } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

const ALL_STATUSES: (OrderStatus | 'all')[] = [
  'all', 'new', 'under_review', 'quoted', 'confirmed', 'in_production', 'ready',
  'shipped', 'picked_up', 'invoiced', 'closed', 'cancelled',
];

interface TabDef {
  id: string;
  label: string;
  help: string;
  match: (o: OrderRow) => boolean;
}

/** Manager view — 5 tabs covering the full lifecycle. */
const MANAGER_TABS: TabDef[] = [
  {
    id: 'attention', label: 'Needs my action',
    help: 'New / under review / quoted, or awaiting sample approval',
    match: (o) =>
      ['new', 'under_review', 'quoted'].includes(o.status)
      || o.production_status === 'sample_approval',
  },
  {
    id: 'production', label: 'In production',
    help: 'Confirmed or currently being produced (excluding sample-approval pauses)',
    match: (o) =>
      ['confirmed', 'in_production'].includes(o.status)
      && o.production_status !== 'sample_approval',
  },
  {
    id: 'ready', label: 'Ready / shipped',
    help: 'Ready to ship, shipped, or picked up',
    match: (o) => ['ready', 'shipped', 'picked_up'].includes(o.status),
  },
  { id: 'done', label: 'Completed', help: 'Invoiced and closed', match: (o) => ['invoiced', 'closed'].includes(o.status) },
  { id: 'all', label: 'All', help: 'Everything', match: () => true },
];

/** Production view — focused on what they need to act on. */
const PRODUCTION_TABS: TabDef[] = [
  {
    id: 'attention', label: 'Needs my action',
    help: 'Orders ready for you to start — confirmed, or sample approved',
    match: (o) =>
      o.status === 'confirmed'
      || o.production_status === 'sample_approved',
  },
  {
    id: 'in_progress', label: 'In progress',
    help: 'Actively producing or awaiting sample approval from the manager',
    match: (o) =>
      o.status === 'in_production'
      && o.production_status !== 'sample_approved',
  },
  {
    id: 'ready', label: 'Ready', help: 'Completed production, awaiting dispatch', match: (o) => o.status === 'ready' },
  { id: 'all', label: 'All', help: 'Everything visible to me', match: () => true },
];

/** Bookstore view — focused on dispatch. */
const BOOKSTORE_TABS: TabDef[] = [
  {
    id: 'to_dispatch', label: 'To dispatch',
    help: 'Ready orders awaiting pickup or shipment',
    match: (o) => o.status === 'ready',
  },
  {
    id: 'dispatched', label: 'Dispatched',
    help: 'Shipped or picked up',
    match: (o) => ['shipped', 'picked_up'].includes(o.status),
  },
  { id: 'all', label: 'All', help: 'Everything visible to me', match: () => true },
];

function tabsForRole(role: UserRole | null): TabDef[] {
  if (role === 'manager') return MANAGER_TABS;
  if (role === 'production') return PRODUCTION_TABS;
  if (role === 'bookstore') return BOOKSTORE_TABS;
  return [];
}

export function OrdersTable() {
  const { role } = useAuth();
  const tabs = useMemo(() => tabsForRole(role), [role]);
  const defaultTabId = tabs[0]?.id ?? 'all';

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [tabId, setTabId] = useState<string>(defaultTabId);

  // Re-seed tab when role finishes loading
  useEffect(() => { setTabId(defaultTabId); }, [defaultTabId]);

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

  const activeTab = useMemo(() => tabs.find((t) => t.id === tabId) ?? tabs[0], [tabs, tabId]);

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const t of tabs) out[t.id] = orders.filter(t.match).length;
    return out;
  }, [orders, tabs]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (activeTab && !activeTab.match(o)) return false;
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
  }, [orders, q, statusFilter, activeTab]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Orders</h1>
        <p className="text-sm text-muted-foreground">
          {role === 'production'
            ? "Your production queue. 'Needs my action' shows orders you can pick up or advance next."
            : role === 'bookstore'
            ? 'Dispatch queue. Mark orders as shipped or picked up from here.'
            : 'Split by where you need to act. Counts update live.'}
        </p>
      </div>

      {tabs.length > 0 && (
        <Tabs value={tabId} onValueChange={setTabId}>
          <TabsList>
            {tabs.map((t) => (
              <TabsTrigger key={t.id} value={t.id} title={t.help} className="gap-2">
                <span>{t.label}</span>
                <Badge variant={t.id === tabId ? 'secondary' : 'muted'} className="px-1.5">
                  {counts[t.id] ?? 0}
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
              <TableHead>Source</TableHead>
              <TableHead>Binding</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Production</TableHead>
              <TableHead>Due</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">Loading…</TableCell>
              </TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">No orders match.</TableCell>
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
                      <div className="text-xs text-muted-foreground">{o.client_name}</div>
                    </>
                  ) : (
                    <>
                      <div className="font-medium">{o.client_name}</div>
                      <div className="text-xs text-muted-foreground">{o.client_organization}</div>
                    </>
                  )}
                </TableCell>
                <TableCell className="text-xs">{formatOrderSource(o.order_source, o.order_source_other)}</TableCell>
                <TableCell>{titleCase(o.binding_type)}</TableCell>
                <TableCell>{o.quantity}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={o.status} />
                    {o.is_on_hold && <Badge variant="tangerine">Hold</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <ProductionStatusBadge status={o.production_status as ProductionStatus | null} />
                    {o.production_status === 'sample_approval' && (
                      <Badge variant="gold" title="Awaiting manager's sample approval">!</Badge>
                    )}
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
