import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { OrderRow, OrderStatus, ProductionStatus, OrderStatusLogRow, BindingType } from '@/lib/database.types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { StatusBadge, ProductionStatusBadge } from '@/components/shared/StatusBadge';
import { BINDING_LABELS } from '@/components/form/schemas';
import { formatCurrency, formatDate, titleCase } from '@/lib/utils';

type Period = 'day' | 'week' | 'month' | 'quarter' | 'year';

const PERIOD_LABEL: Record<Period, string> = {
  day: 'Today',
  week: 'This week',
  month: 'This month',
  quarter: 'This quarter',
  year: 'This year',
};

/** Start of the current day/week/month/quarter/year in local time, as ISO. */
function periodStart(p: Period): string {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (p === 'day') return startOfDay.toISOString();
  if (p === 'week') {
    const dow = startOfDay.getDay(); // 0 = Sun
    const diff = dow === 0 ? -6 : 1 - dow;
    const d = new Date(startOfDay);
    d.setDate(d.getDate() + diff);
    return d.toISOString();
  }
  if (p === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  if (p === 'quarter') {
    const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
    return new Date(now.getFullYear(), qStartMonth, 1).toISOString();
  }
  // year
  return new Date(now.getFullYear(), 0, 1).toISOString();
}

const REVENUE_STATUSES: OrderStatus[] = ['invoiced', 'closed'];
const PRODUCTION_STATUSES: OrderStatus[] = ['confirmed', 'in_production', 'ready'];

interface TurnaroundEntry {
  binding_type: string;
  orders: number;
  totalCopies: number;
  avgHoursPerOrder: number;
  avgHoursPerCopy: number;
  medianHoursPerOrder: number;
}

export function Reports() {
  const [period, setPeriod] = useState<Period>('week');
  const [allOrders, setAllOrders] = useState<OrderRow[]>([]);
  const [productionOrders, setProductionOrders] = useState<OrderRow[]>([]);
  const [turnaround, setTurnaround] = useState<TurnaroundEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const start = periodStart(period);
      const [periodRes, productionRes, turnaroundRes] = await Promise.all([
        supabase
          .from('orders')
          .select('*')
          .gte('created_at', start)
          .order('created_at', { ascending: false })
          .limit(5000),
        supabase
          .from('orders')
          .select('*')
          .in('status', PRODUCTION_STATUSES)
          .order('delivery_date', { ascending: true })
          .limit(1000),
        // Fetch all "status" changes in this period so we can compute turnaround.
        supabase
          .from('order_status_log')
          .select('*')
          .eq('field_changed', 'status')
          .gte('changed_at', start)
          .order('changed_at', { ascending: true })
          .limit(10000),
      ]);
      if (cancelled) return;
      const orders = (periodRes.data ?? []) as OrderRow[];
      setAllOrders(orders);
      setProductionOrders((productionRes.data ?? []) as OrderRow[]);
      setTurnaround(computeTurnaround(orders, (turnaroundRes.data ?? []) as OrderStatusLogRow[]));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [period]);

  const ordersSummary = useMemo(() => {
    const byStatus: Record<string, number> = {};
    for (const o of allOrders) byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
    return { total: allOrders.length, byStatus };
  }, [allOrders]);

  const revenue = useMemo(() => {
    const billable = allOrders.filter((o) => REVENUE_STATUSES.includes(o.status));
    const total = billable.reduce((sum, o) => sum + Number(o.total_price ?? 0), 0);
    const paidTotal = billable
      .filter((o) => o.payment_received_at)
      .reduce((sum, o) => sum + Number(o.total_price ?? 0), 0);
    return {
      total,
      paidTotal,
      outstanding: total - paidTotal,
      invoiceCount: billable.length,
      paidCount: billable.filter((o) => o.payment_received_at).length,
    };
  }, [allOrders]);

  const onHoldCount = useMemo(
    () => productionOrders.filter((o) => o.is_on_hold).length,
    [productionOrders]
  );

  return (
    <div className="space-y-6">
      {/* --- Controls (hidden in print) --- */}
      <div className="flex items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="font-display text-2xl font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground">
            Quick snapshot of order activity, revenue, production load, and turnaround performance.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1.5">
            <div className="text-xs text-muted-foreground">Period</div>
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Today</SelectItem>
                <SelectItem value="week">This week</SelectItem>
                <SelectItem value="month">This month</SelectItem>
                <SelectItem value="quarter">This quarter</SelectItem>
                <SelectItem value="year">This year</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={() => window.print()} aria-label="Print report">
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      {/* --- Print-only header (shown only on printed page) --- */}
      <div className="hidden print:block">
        <h1 className="font-display text-2xl font-bold">SAIACS POD — Reports ({PERIOD_LABEL[period]})</h1>
        <p className="text-xs text-muted-foreground">Generated {new Date().toLocaleString()}</p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Orders summary — {PERIOD_LABEL[period]}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <>
                <div className="mb-3 flex items-baseline gap-2">
                  <span className="font-display text-3xl font-bold">{ordersSummary.total}</span>
                  <span className="text-sm text-muted-foreground">orders received</span>
                </div>
                {ordersSummary.total === 0 ? (
                  <p className="text-sm text-muted-foreground">No orders in this period.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {Object.entries(ordersSummary.byStatus)
                      .sort((a, b) => b[1] - a[1])
                      .map(([status, count]) => (
                        <li key={status} className="flex items-center justify-between">
                          <StatusBadge status={status as OrderStatus} />
                          <span className="font-mono">{count}</span>
                        </li>
                      ))}
                  </ul>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue — {PERIOD_LABEL[period]}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <>
                <div className="mb-4 flex items-baseline gap-2">
                  <span className="font-display text-3xl font-bold">{formatCurrency(revenue.total)}</span>
                  <span className="text-sm text-muted-foreground">invoiced</span>
                </div>
                <dl className="grid grid-cols-2 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Paid</dt>
                  <dd className="text-right">
                    {formatCurrency(revenue.paidTotal)}{' '}
                    <span className="text-xs text-muted-foreground">({revenue.paidCount})</span>
                  </dd>
                  <dt className="text-muted-foreground">Outstanding</dt>
                  <dd className="text-right">
                    {formatCurrency(revenue.outstanding)}{' '}
                    <span className="text-xs text-muted-foreground">({revenue.invoiceCount - revenue.paidCount})</span>
                  </dd>
                  <dt className="text-muted-foreground">Invoiced orders</dt>
                  <dd className="text-right">{revenue.invoiceCount}</dd>
                </dl>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Turnaround by binding type */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Turnaround time by print type — {PERIOD_LABEL[period]}</CardTitle>
          <p className="text-xs text-muted-foreground">
            Average time from <em>Confirmed</em> to <em>Ready</em>, grouped by binding option. Only
            orders that reached <em>Ready</em> within the period are counted. Per-order shows raw
            turnaround; per-copy normalises for run size — useful for comparing binding types with
            very different typical quantities.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Print type</TableHead>
                <TableHead className="text-right">Orders completed</TableHead>
                <TableHead className="text-right">Copies</TableHead>
                <TableHead className="text-right">Avg / order</TableHead>
                <TableHead className="text-right">Median / order</TableHead>
                <TableHead className="text-right">Avg / copy</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
              {!loading && turnaround.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No orders reached "Ready" in this period yet.
                  </TableCell>
                </TableRow>
              )}
              {turnaround.map((t) => (
                <TableRow key={t.binding_type}>
                  <TableCell className="font-medium">
                    {BINDING_LABELS[t.binding_type as BindingType] ?? titleCase(t.binding_type)}
                  </TableCell>
                  <TableCell className="text-right">{t.orders}</TableCell>
                  <TableCell className="text-right">{t.totalCopies}</TableCell>
                  <TableCell className="text-right">{humanise(t.avgHoursPerOrder)}</TableCell>
                  <TableCell className="text-right">{humanise(t.medianHoursPerOrder)}</TableCell>
                  <TableCell className="text-right">{t.avgHoursPerCopy.toFixed(2)} hrs</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Production queue */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Production queue</CardTitle>
            <div className="flex items-center gap-2 text-xs">
              <span>{productionOrders.length} in progress</span>
              {onHoldCount > 0 && <Badge variant="tangerine">{onHoldCount} on hold</Badge>}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Orders currently in <em>Confirmed</em>, <em>In production</em>, or <em>Ready</em> — ordered by delivery date.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Production</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Hold</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
              {!loading && productionOrders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Nothing in production right now.
                  </TableCell>
                </TableRow>
              )}
              {productionOrders.map((o) => (
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
                  <TableCell><StatusBadge status={o.status} /></TableCell>
                  <TableCell><ProductionStatusBadge status={o.production_status as ProductionStatus | null} /></TableCell>
                  <TableCell>{o.quantity}</TableCell>
                  <TableCell className="text-sm">{formatDate(o.delivery_date)}</TableCell>
                  <TableCell>
                    {o.is_on_hold
                      ? <Badge variant="tangerine" title={o.hold_reason ?? undefined}>On hold</Badge>
                      : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Status totals */}
      <Card>
        <CardHeader><CardTitle className="text-base">Status totals — {PERIOD_LABEL[period]}</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : Object.keys(ordersSummary.byStatus).length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders in this period.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 print:grid-cols-4">
              {Object.entries(ordersSummary.byStatus).map(([status, count]) => (
                <div key={status} className="rounded border bg-white p-3">
                  <div className="text-xs text-muted-foreground">{titleCase(status)}</div>
                  <div className="font-display text-xl font-bold">{count}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Compute average turnaround by binding type.
 *
 * Algorithm: for each status-change log row that sets a row to 'confirmed' or 'ready',
 * record the timestamp. Pair them up per order. Group by order.binding_type, output
 * averages in hours.
 */
function computeTurnaround(orders: OrderRow[], logs: OrderStatusLogRow[]): TurnaroundEntry[] {
  const orderById = new Map<string, OrderRow>();
  for (const o of orders) orderById.set(o.id, o);

  const confirmedAt: Record<string, number> = {};
  const readyAt: Record<string, number> = {};
  for (const l of logs) {
    if (l.new_value === 'confirmed' && !confirmedAt[l.order_id]) {
      confirmedAt[l.order_id] = new Date(l.changed_at).getTime();
    }
    if (l.new_value === 'ready' && !readyAt[l.order_id]) {
      readyAt[l.order_id] = new Date(l.changed_at).getTime();
    }
  }

  const buckets: Record<string, { hours: number[]; copies: number[] }> = {};
  for (const [orderId, tReady] of Object.entries(readyAt)) {
    const tConfirmed = confirmedAt[orderId];
    if (!tConfirmed || tConfirmed > tReady) continue; // can't compute
    const order = orderById.get(orderId);
    if (!order) continue;
    const key = order.binding_type;
    if (!buckets[key]) buckets[key] = { hours: [], copies: [] };
    buckets[key].hours.push((tReady - tConfirmed) / (1000 * 60 * 60));
    buckets[key].copies.push(order.quantity || 1);
  }

  const result: TurnaroundEntry[] = [];
  for (const [binding, { hours, copies }] of Object.entries(buckets)) {
    const totalHours = hours.reduce((a, b) => a + b, 0);
    const totalCopies = copies.reduce((a, b) => a + b, 0);
    const sorted = [...hours].sort((a, b) => a - b);
    const median = sorted.length % 2
      ? sorted[Math.floor(sorted.length / 2)]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    result.push({
      binding_type: binding,
      orders: hours.length,
      totalCopies,
      avgHoursPerOrder: totalHours / hours.length,
      avgHoursPerCopy: totalCopies > 0 ? totalHours / totalCopies : 0,
      medianHoursPerOrder: median,
    });
  }
  return result.sort((a, b) => b.orders - a.orders);
}

function humanise(hours: number): string {
  if (!isFinite(hours) || hours <= 0) return '—';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 24) return `${hours.toFixed(1)} hrs`;
  const days = hours / 24;
  return `${days.toFixed(1)} days`;
}
