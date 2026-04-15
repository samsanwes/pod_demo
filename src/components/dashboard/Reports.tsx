import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { OrderRow, OrderStatus, ProductionStatus } from '@/lib/database.types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { StatusBadge, ProductionStatusBadge } from '@/components/shared/StatusBadge';
import { formatCurrency, formatDate, titleCase } from '@/lib/utils';

type Period = 'day' | 'week' | 'month';

const PERIOD_LABEL: Record<Period, string> = {
  day: 'Today',
  week: 'This week',
  month: 'This month',
};

// Returns the start of the current day/week/month in the user's local timezone,
// as an ISO string for use in PostgREST filters.
function periodStart(p: Period): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (p === 'day') return d.toISOString();
  if (p === 'week') {
    // Week starts Monday
    const dow = d.getDay(); // 0 = Sun
    const diff = dow === 0 ? -6 : 1 - dow;
    d.setDate(d.getDate() + diff);
    return d.toISOString();
  }
  // month
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

const REVENUE_STATUSES: OrderStatus[] = ['invoiced', 'closed'];
const PRODUCTION_STATUSES: OrderStatus[] = ['confirmed', 'in_production', 'ready'];

export function Reports() {
  const [period, setPeriod] = useState<Period>('week');
  const [allOrders, setAllOrders] = useState<OrderRow[]>([]);
  const [productionOrders, setProductionOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const start = periodStart(period);
      const [periodRes, productionRes] = await Promise.all([
        supabase
          .from('orders')
          .select('*')
          .gte('created_at', start)
          .order('created_at', { ascending: false })
          .limit(1000),
        supabase
          .from('orders')
          .select('*')
          .in('status', PRODUCTION_STATUSES)
          .order('delivery_date', { ascending: true })
          .limit(1000),
      ]);
      if (cancelled) return;
      setAllOrders((periodRes.data ?? []) as OrderRow[]);
      setProductionOrders((productionRes.data ?? []) as OrderRow[]);
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground">
            Quick snapshot of order activity, revenue, and what's in production right now.
          </p>
        </div>
        <div className="space-y-1.5">
          <div className="text-xs text-muted-foreground">Period</div>
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Today</SelectItem>
              <SelectItem value="week">This week</SelectItem>
              <SelectItem value="month">This month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2">
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

      {/* Status-by-status breakdown */}
      <Card>
        <CardHeader><CardTitle className="text-base">Status totals — {PERIOD_LABEL[period]}</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : Object.keys(ordersSummary.byStatus).length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders in this period.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
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
