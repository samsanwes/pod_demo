import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Book, OrderSource } from '@/lib/database.types';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BINDING_LABELS } from '@/components/form/schemas';
import { toast } from '@/hooks/use-toast';
import { titleCase } from '@/lib/utils';

const SOURCE_OPTIONS: { value: OrderSource; label: string }[] = [
  { value: 'amazon', label: 'Amazon' },
  { value: 'saiacs_store', label: 'SAIACS Store' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'direct', label: 'Direct' },
  { value: 'other', label: 'Other' },
];

export function NewInternalOrder() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [books, setBooks] = useState<Book[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(true);

  const [bookId, setBookId] = useState<string>('');
  const [source, setSource] = useState<OrderSource>('amazon');
  const [quantity, setQuantity] = useState<number>(50);
  const [deliveryDate, setDeliveryDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      setLoadingBooks(true);
      const { data } = await supabase
        .from('books')
        .select('*')
        .eq('is_active', true)
        .order('title', { ascending: true });
      setBooks((data ?? []) as Book[]);
      setLoadingBooks(false);
    })();
  }, []);

  const selectedBook = useMemo(() => books.find((b) => b.id === bookId) ?? null, [books, bookId]);

  async function submit() {
    if (!selectedBook) {
      toast({ variant: 'destructive', title: 'Pick a book', description: 'Select a title from the catalog.' });
      return;
    }
    if (quantity < 1) {
      toast({ variant: 'destructive', title: 'Quantity must be ≥ 1' });
      return;
    }
    setSubmitting(true);
    try {
      const orderId = crypto.randomUUID();
      const payload = {
        id: orderId,
        status: 'confirmed' as const, // internal orders skip the quote/confirm flow
        order_source: source,
        book_id: selectedBook.id,
        title: selectedBook.title,

        // Client placeholder — this is the bookstore acting as "client"
        client_name: 'SAIACS Bookstore',
        client_email: profile?.email ?? 'bookstore@saiacs.org',
        client_phone: 'Internal',
        client_organization: 'SAIACS Bookstore',

        // Snapshot the book spec at order time
        binding_type: selectedBook.binding_type,
        trim_size: selectedBook.trim_size,
        num_pages: selectedBook.num_pages,
        paper_type: selectedBook.paper_type,
        cover_paper_type: selectedBook.cover_paper_type,
        inner_printing: selectedBook.inner_printing,
        cover_printing: selectedBook.cover_printing,
        cover_lamination: selectedBook.cover_lamination,

        quantity,
        delivery_date: deliveryDate,
        delivery_method: 'pickup' as const, // campus handover
        special_instructions: notes.trim() || null,
      };

      const { error: insertErr } = await supabase.from('orders').insert(payload);
      if (insertErr) throw insertErr;

      // Assign POD-YYYY-NNNN via the edge function. Non-fatal if it's slow —
      // the order is already in the queue.
      let orderNumber = orderId.slice(0, 8);
      try {
        const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000));
        const call = supabase.functions.invoke('generate-order-number', { body: { order_id: orderId } });
        const { data } = (await Promise.race([call, timeout])) as { data: { order_number?: string } };
        if (data?.order_number) orderNumber = data.order_number;
      } catch (err) {
        console.warn('[new-internal-order] generate-order-number failed', err);
      }

      toast({ title: 'Order placed', description: `${orderNumber} queued for production.` });
      navigate(`/dashboard/orders/${orderId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ variant: 'destructive', title: 'Submission failed', description: msg });
      setSubmitting(false);
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Place bookstore order</h1>
        <p className="text-sm text-muted-foreground">
          For reprints originating from Amazon, SAIACS Store, WhatsApp, or walk-ins. Pick a book
          from the catalog — the print spec comes from the catalog entry so production knows what
          to run.
        </p>
      </div>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Order details</CardTitle>
          <CardDescription>
            {loadingBooks
              ? 'Loading catalog…'
              : books.length === 0
                ? 'The books catalog is empty. Ask the manager to add titles first.'
                : `${books.length} active title${books.length === 1 ? '' : 's'} in the catalog.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Book</Label>
              <Select value={bookId} onValueChange={setBookId} disabled={loadingBooks || books.length === 0}>
                <SelectTrigger><SelectValue placeholder="Pick a title from the catalog…" /></SelectTrigger>
                <SelectContent>
                  {books.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.title}{b.author ? ` — ${b.author}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Channel / source</Label>
              <Select value={source} onValueChange={(v) => setSource(v as OrderSource)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value) || 0)} />
            </div>

            <div className="space-y-1.5">
              <Label>Need by</Label>
              <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>Notes (optional)</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. special handling, customer comments" />
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedBook && (
        <Card className="max-w-3xl bg-brand-snow">
          <CardHeader>
            <CardTitle className="text-base">Spec preview — {selectedBook.title}</CardTitle>
            <CardDescription>
              This is what production will receive. Make sure the files on record still match this spec
              before printing. Contact the manager if the title needs a spec change.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm md:grid-cols-2">
            <Row k="Author" v={selectedBook.author || '—'} />
            <Row k="ISBN" v={selectedBook.isbn || '—'} />
            <Row k="Print type" v={BINDING_LABELS[selectedBook.binding_type]} />
            <Row k="Trim size" v={selectedBook.trim_size || '—'} />
            <Row k="Pages" v={selectedBook.num_pages?.toString() ?? '—'} />
            <Row k="Text paper" v={selectedBook.paper_type || '—'} />
            <Row k="Cover paper" v={selectedBook.cover_paper_type || '—'} />
            <Row k="Inner print" v={selectedBook.inner_printing ? (selectedBook.inner_printing === 'bw' ? 'B/W' : 'Colour') : '—'} />
            <Row k="Cover print" v={selectedBook.cover_printing ? (selectedBook.cover_printing === 'bw' ? 'B/W' : 'Colour') : '—'} />
            <Row k="Cover lamination" v={selectedBook.cover_lamination ? titleCase(selectedBook.cover_lamination) : '—'} />
            {selectedBook.notes && (
              <div className="md:col-span-2 rounded bg-white p-3 text-xs">
                <div className="font-medium text-muted-foreground">Production notes</div>
                <div className="whitespace-pre-line">{selectedBook.notes}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="max-w-3xl">
        <Button onClick={submit} disabled={!selectedBook || submitting}>
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Submit order to production
        </Button>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-4">
      <span className="w-32 shrink-0 text-muted-foreground">{k}</span>
      <span>{v}</span>
    </div>
  );
}
