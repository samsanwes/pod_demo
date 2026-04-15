import { useState } from 'react';
import { Loader2, Receipt, IndianRupee } from 'lucide-react';
import type { OrderRow, PaymentTerms } from '@/lib/database.types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmailTemplateDialog } from '@/components/shared/EmailTemplateDialog';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface Props {
  order: OrderRow;
  onUpdated: (next: OrderRow) => void;
}

export function InvoiceTab({ order, onUpdated }: Props) {
  const { role } = useAuth();
  const canEdit = role === 'manager';

  const [zohoId, setZohoId] = useState(order.zoho_invoice_id ?? '');
  const [terms, setTerms] = useState<PaymentTerms>(order.payment_terms ?? 'prepay');
  const [busy, setBusy] = useState(false);
  const [showEmail, setShowEmail] = useState(false);

  async function markInvoiced() {
    if (!zohoId.trim()) {
      toast({ variant: 'destructive', title: 'Missing Zoho ID', description: 'Enter the Zoho invoice ID first.' });
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .update({
          zoho_invoice_id: zohoId,
          payment_terms: terms,
          invoice_sent_at: new Date().toISOString(),
          status: 'invoiced',
        })
        .eq('id', order.id)
        .select('*')
        .single();
      if (error) throw error;
      if (data) onUpdated(data as OrderRow);
      toast({ title: 'Marked invoiced' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ variant: 'destructive', title: 'Update failed', description: msg });
    } finally {
      setBusy(false);
    }
  }

  async function markPaid() {
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .update({
          payment_received_at: new Date().toISOString(),
          status: 'closed',
        })
        .eq('id', order.id)
        .select('*')
        .single();
      if (error) throw error;
      if (data) onUpdated(data as OrderRow);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Invoice</CardTitle>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="font-display text-xl font-bold">{formatCurrency(order.total_price)}</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Zoho Invoice ID</Label>
              <Input value={zohoId} onChange={(e) => setZohoId(e.target.value)} disabled={!canEdit} placeholder="e.g. INV-00142" />
            </div>
            <div className="space-y-1.5">
              <Label>Payment terms</Label>
              <Select value={terms} onValueChange={(v) => setTerms(v as PaymentTerms)} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="prepay">Prepay</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={markInvoiced} disabled={!canEdit || busy || order.status === 'invoiced' || order.status === 'closed'}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Receipt className="mr-2 h-4 w-4" />}
                Mark invoiced
              </Button>
            </div>
          </div>

          {order.invoice_sent_at && (
            <p className="text-xs text-muted-foreground">
              Invoiced on {formatDateTime(order.invoice_sent_at)}
            </p>
          )}

          <Button variant="outline" onClick={() => setShowEmail(true)} disabled={!canEdit}>
            Generate invoice email
          </Button>
        </CardContent>
      </Card>

      {order.status === 'invoiced' && (
        <Card>
          <CardHeader><CardTitle className="text-base">Payment</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {order.payment_received_at
                ? `Payment recorded ${formatDateTime(order.payment_received_at)}.`
                : 'Mark as paid once you have received payment. This closes the order.'}
            </p>
            <Button onClick={markPaid} disabled={!canEdit || busy || !!order.payment_received_at}>
              <IndianRupee className="mr-2 h-4 w-4" />
              Mark payment received
            </Button>
          </CardContent>
        </Card>
      )}

      <EmailTemplateDialog order={order} template="invoice" open={showEmail} onOpenChange={setShowEmail} />
    </div>
  );
}
