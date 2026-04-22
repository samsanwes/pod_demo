import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Book, BindingType, ColourMode, LaminationOption } from '@/lib/database.types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BINDING_LABELS, BINDING_OPTIONS_PUBLIC, TRIM_SIZES, TEXT_PAPER_OPTIONS, COVER_PAPER_OPTIONS, LAMINATION_OPTIONS, COLOUR_MODES, NOT_SURE_PAPER } from '@/components/form/schemas';
import { titleCase } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const EMPTY_BOOK: Omit<Book, 'id' | 'created_at' | 'updated_at'> = {
  title: '',
  author: null,
  isbn: null,
  binding_type: 'perfect',
  trim_size: 'A5',
  num_pages: null,
  paper_type: 'Maplitho 80gsm',
  cover_paper_type: 'Art Card 250gsm',
  inner_printing: 'bw',
  cover_printing: 'colour',
  cover_lamination: 'matte',
  notes: null,
  is_active: true,
};

export function BooksAdmin() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Book | null>(null);
  const [creating, setCreating] = useState(false);

  async function reload() {
    setLoading(true);
    const { data } = await supabase.from('books').select('*').order('title', { ascending: true });
    setBooks((data ?? []) as Book[]);
    setLoading(false);
  }

  useEffect(() => { reload(); }, []);

  async function toggleActive(b: Book) {
    await supabase.from('books').update({ is_active: !b.is_active }).eq('id', b.id);
    await reload();
  }

  async function remove(b: Book) {
    if (!confirm(`Permanently delete "${b.title}" from the catalog? (Orders using this title will keep their own spec snapshot.)`)) return;
    const { error } = await supabase.from('books').delete().eq('id', b.id);
    if (error) toast({ variant: 'destructive', title: 'Delete failed', description: error.message });
    await reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Books catalog</h1>
          <p className="text-sm text-muted-foreground">
            Titles the bookstore team can re-order. Each entry stores the print spec so every reprint
            comes out identically. Production files are kept separately.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="mr-1 h-4 w-4" />Add book</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Binding</TableHead>
                <TableHead>Trim · Pages</TableHead>
                <TableHead>Papers (text / cover)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
              {!loading && books.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No books yet. Add one to let the bookstore team place orders.</TableCell></TableRow>
              )}
              {books.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.title}{b.isbn && <span className="ml-2 text-xs text-muted-foreground">({b.isbn})</span>}</TableCell>
                  <TableCell className="text-sm">{b.author || '—'}</TableCell>
                  <TableCell className="text-sm">{BINDING_LABELS[b.binding_type]}</TableCell>
                  <TableCell className="text-sm">{b.trim_size || '—'} · {b.num_pages ?? '—'}p</TableCell>
                  <TableCell className="text-xs">
                    <div>{b.paper_type || '—'}</div>
                    <div className="text-muted-foreground">{b.cover_paper_type || '—'}</div>
                  </TableCell>
                  <TableCell>{b.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="muted">Inactive</Badge>}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(b)}>Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleActive(b)}>
                        {b.is_active ? 'Disable' : 'Enable'}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => remove(b)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {(editing || creating) && (
        <BookDialog
          initial={editing ?? null}
          onClose={(saved) => { setEditing(null); setCreating(false); if (saved) reload(); }}
        />
      )}
    </div>
  );
}

function BookDialog({ initial, onClose }: { initial: Book | null; onClose: (saved: boolean) => void }) {
  const [values, setValues] = useState(() => (initial ? initial : { ...EMPTY_BOOK } as Book));
  const [busy, setBusy] = useState(false);

  function set<K extends keyof Book>(key: K, v: Book[K]) {
    setValues((prev) => ({ ...prev, [key]: v } as Book));
  }

  async function save() {
    if (!values.title.trim()) {
      toast({ variant: 'destructive', title: 'Title required' });
      return;
    }
    setBusy(true);
    try {
      const payload = {
        title: values.title.trim(),
        author: values.author?.trim() || null,
        isbn: values.isbn?.trim() || null,
        binding_type: values.binding_type,
        trim_size: values.trim_size,
        num_pages: values.num_pages,
        paper_type: values.paper_type,
        cover_paper_type: values.cover_paper_type,
        inner_printing: values.inner_printing,
        cover_printing: values.cover_printing,
        cover_lamination: values.cover_lamination,
        notes: values.notes?.trim() || null,
        is_active: values.is_active,
      };
      if (initial) {
        const { error } = await supabase.from('books').update(payload).eq('id', initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('books').insert(payload);
        if (error) throw error;
      }
      toast({ title: initial ? 'Book updated' : 'Book added' });
      onClose(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ variant: 'destructive', title: 'Save failed', description: msg });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit book' : 'Add book'}</DialogTitle>
          <DialogDescription>
            The spec saved here is what internal orders will request from production.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Title" required>
            <Input value={values.title} onChange={(e) => set('title', e.target.value)} />
          </Field>
          <Field label="Author">
            <Input value={values.author ?? ''} onChange={(e) => set('author', e.target.value)} />
          </Field>
          <Field label="ISBN">
            <Input value={values.isbn ?? ''} onChange={(e) => set('isbn', e.target.value)} placeholder="978-..." />
          </Field>
          <Field label="Binding / Print type">
            <Select value={values.binding_type} onValueChange={(v) => set('binding_type', v as BindingType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BINDING_OPTIONS_PUBLIC.map((b) => <SelectItem key={b} value={b}>{BINDING_LABELS[b]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Trim size">
            <Select value={values.trim_size ?? 'A5'} onValueChange={(v) => set('trim_size', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRIM_SIZES.map((t) => <SelectItem key={t} value={t}>{titleCase(t)}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Page count">
            <Input type="number" min={1} value={values.num_pages ?? ''} onChange={(e) => set('num_pages', e.target.value ? parseInt(e.target.value, 10) : null)} />
          </Field>
          <Field label="Text paper">
            <Select value={values.paper_type ?? TEXT_PAPER_OPTIONS[0]} onValueChange={(v) => set('paper_type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEXT_PAPER_OPTIONS.filter((p) => p !== NOT_SURE_PAPER).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Cover paper">
            <Select value={values.cover_paper_type ?? COVER_PAPER_OPTIONS[0]} onValueChange={(v) => set('cover_paper_type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COVER_PAPER_OPTIONS.filter((p) => p !== NOT_SURE_PAPER).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Inner printing">
            <Select value={values.inner_printing ?? 'bw'} onValueChange={(v) => set('inner_printing', v as ColourMode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COLOUR_MODES.map((c) => <SelectItem key={c} value={c}>{c === 'bw' ? 'Black & white' : 'Colour'}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Cover printing">
            <Select value={values.cover_printing ?? 'colour'} onValueChange={(v) => set('cover_printing', v as ColourMode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COLOUR_MODES.map((c) => <SelectItem key={c} value={c}>{c === 'bw' ? 'Black & white' : 'Colour'}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Cover lamination">
            <Select value={values.cover_lamination ?? 'matte'} onValueChange={(v) => set('cover_lamination', v as LaminationOption)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LAMINATION_OPTIONS.map((l) => <SelectItem key={l} value={l}>{titleCase(l)}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Notes (for production)">
              <Textarea rows={2} value={values.notes ?? ''} onChange={(e) => set('notes', e.target.value)} placeholder="e.g. file location, special handling" />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onClose(false)}>Cancel</Button>
          <Button onClick={save} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save book
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}{required && <span className="text-destructive"> *</span>}</Label>
      {children}
    </div>
  );
}
