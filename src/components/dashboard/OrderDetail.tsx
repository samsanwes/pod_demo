import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { OrderRow, OrderStatus } from '@/lib/database.types';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmailTemplateDialog } from '@/components/shared/EmailTemplateDialog';
import { DetailsTab } from './tabs/DetailsTab';
import { FilesTab } from './tabs/FilesTab';
import { ProductionTab } from './tabs/ProductionTab';
import { ShippingTab } from './tabs/ShippingTab';
import { InvoiceTab } from './tabs/InvoiceTab';
import { AuditLogTab } from './tabs/AuditLogTab';
import { Calculator } from '@/components/pricing/Calculator';
import { useAuth } from '@/lib/auth';
import { formatCurrency, titleCase } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import type { EmailTemplateId } from '@/lib/emailTemplates';
import { EMAIL_TEMPLATE_LABELS } from '@/lib/emailTemplates';

// Manager status transitions (covers "Any → cancelled" too)
const MANAGER_NEXT_STATUSES: OrderStatus[] = [
  'new', 'under_review', 'quoted', 'confirmed',
  'in_production', 'ready', 'shipped', 'picked_up',
  'invoiced', 'closed', 'cancelled',
];

export function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailOpen, setEmailOpen] = useState<EmailTemplateId | null>(null);
  const { role } = useAuth();

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from('orders').select('*').eq('id', id).single();
      if (cancelled) return;
      if (error) console.error(error);
      setOrder((data as OrderRow) ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  async function changeStatus(next: OrderStatus) {
    if (!order) return;
    const { data, error } = await supabase
      .from('orders')
      .update({ status: next })
      .eq('id', order.id)
      .select('*')
      .single();
    if (error) {
      toast({ variant: 'destructive', title: 'Status change failed', description: error.message });
      return;
    }
    if (data) setOrder(data as OrderRow);
    toast({ title: 'Status updated', description: `Now ${titleCase(next)}` });
  }

  if (loading) return <div>Loading…</div>;
  if (!order) return <div>Order not found.</div>;

  const templates: EmailTemplateId[] = ['quote', 'confirmation', 'sample', 'ready', 'shipped', 'invoice'];

  return (
    <div className="space-y-6">
      <div>
        <Link to="/dashboard/orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to orders
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">
            {order.order_number ?? order.id.slice(0, 8)}
            {order.title && (
              <span className="ml-3 text-lg font-normal text-muted-foreground">— {order.title}</span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            {order.client_name} · {order.client_organization}
            {order.order_source !== 'public' && (
              <span className="ml-2 rounded bg-brand-gold/30 px-2 py-0.5 text-xs font-medium text-brand-foundations">
                {titleCase(order.order_source)}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={order.status} />
          {order.total_price != null && (
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="font-semibold">{formatCurrency(order.total_price)}</div>
            </div>
          )}
          {role === 'manager' && (
            <Select value={order.status} onValueChange={(v) => changeStatus(v as OrderStatus)}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MANAGER_NEXT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {role === 'manager' && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Email templates:</span>
          {templates.map((t) => (
            <Button key={t} size="sm" variant="outline" onClick={() => setEmailOpen(t)}>
              <Mail className="mr-1.5 h-3.5 w-3.5" />
              {EMAIL_TEMPLATE_LABELS[t]}
            </Button>
          ))}
        </div>
      )}

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          {role === 'manager' && <TabsTrigger value="pricing">Pricing</TabsTrigger>}
          {(role === 'manager' || role === 'production') && <TabsTrigger value="production">Production</TabsTrigger>}
          <TabsTrigger value="shipping">Shipping</TabsTrigger>
          {role === 'manager' && <TabsTrigger value="invoice">Invoice</TabsTrigger>}
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>
        <TabsContent value="details"><DetailsTab order={order} /></TabsContent>
        <TabsContent value="files"><FilesTab orderId={order.id} /></TabsContent>
        {role === 'manager' && (
          <TabsContent value="pricing"><Calculator order={order} onUpdated={setOrder} /></TabsContent>
        )}
        {(role === 'manager' || role === 'production') && (
          <TabsContent value="production"><ProductionTab order={order} onUpdated={setOrder} /></TabsContent>
        )}
        <TabsContent value="shipping"><ShippingTab order={order} onUpdated={setOrder} /></TabsContent>
        {role === 'manager' && (
          <TabsContent value="invoice"><InvoiceTab order={order} onUpdated={setOrder} /></TabsContent>
        )}
        <TabsContent value="audit"><AuditLogTab orderId={order.id} /></TabsContent>
      </Tabs>

      {emailOpen && (
        <EmailTemplateDialog
          order={order}
          template={emailOpen}
          open={!!emailOpen}
          onOpenChange={(o) => { if (!o) setEmailOpen(null); }}
        />
      )}
    </div>
  );
}
