import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Mail, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { OrderRow, OrderStatus } from '@/lib/database.types';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailOpen, setEmailOpen] = useState<EmailTemplateId | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
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

      <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold sm:text-2xl">
            <span className="break-all">{order.order_number ?? order.id.slice(0, 8)}</span>
            {order.title && (
              <span className="ml-2 text-base font-normal text-muted-foreground sm:ml-3 sm:text-lg">— {order.title}</span>
            )}
          </h1>
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            <span className="truncate">{order.client_name} · {order.client_organization}</span>
            {order.order_source !== 'public' && (
              <span className="rounded bg-brand-gold/30 px-2 py-0.5 text-xs font-medium text-brand-foundations">
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
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
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
          <div className="flex-1" />
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Delete order
          </Button>
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

      {deleteOpen && (
        <DeleteOrderDialog
          order={order}
          onClose={(deleted) => {
            setDeleteOpen(false);
            if (deleted) navigate('/dashboard/orders', { replace: true });
          }}
        />
      )}
    </div>
  );
}

function DeleteOrderDialog({ order, onClose }: { order: OrderRow; onClose: (deleted: boolean) => void }) {
  const ref = order.order_number ?? order.id.slice(0, 8);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);

  const canConfirm = confirmText === ref && !busy;

  async function remove() {
    setBusy(true);
    try {
      // RLS permits DELETE for manager role only (migration 0007). The row's
      // FK children (order_files, order_status_log, order_holds) cascade via
      // ON DELETE CASCADE set up in earlier migrations.
      const { error } = await supabase.from('orders').delete().eq('id', order.id);
      if (error) throw error;
      toast({ title: 'Order deleted', description: `${ref} permanently removed.` });
      onClose(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ variant: 'destructive', title: 'Delete failed', description: msg });
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete order {ref}</DialogTitle>
          <DialogDescription>
            Permanently removes the order row, its uploaded files, audit log entries, and hold history.
            {' '}Prefer <strong>Cancelled</strong> status instead if you need to keep a record. This action
            can't be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>
              Type <code className="rounded bg-muted px-1 text-xs">{ref}</code> to confirm
            </Label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={ref}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onClose(false)}>Cancel</Button>
          <Button variant="destructive" onClick={remove} disabled={!canConfirm}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Delete permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
