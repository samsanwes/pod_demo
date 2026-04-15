import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

type TableName = 'paper_types' | 'printer_rates' | 'lamination_types' | 'overhead_costs' | 'imposition_rules';

interface ColumnDef {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'select';
  options?: readonly string[];
  required?: boolean;
  step?: number;
}

const SCHEMAS: Record<TableName, { label: string; columns: ColumnDef[] }> = {
  paper_types: {
    label: 'Paper types',
    columns: [
      { key: 'name', label: 'Name', required: true },
      { key: 'gsm', label: 'GSM', type: 'number', required: true },
      { key: 'size', label: 'Size', required: true },
      { key: 'usage', label: 'Usage', type: 'select', options: ['text', 'cover', 'special'], required: true },
      { key: 'price_per_sheet', label: 'Price / sheet', type: 'number', step: 0.01, required: true },
    ],
  },
  printer_rates: {
    label: 'Printer rates',
    columns: [
      { key: 'printer_name', label: 'Printer', required: true },
      { key: 'colour_mode', label: 'Mode', type: 'select', options: ['bw', 'colour'], required: true },
      { key: 'paper_size', label: 'Size', required: true },
      { key: 'price_per_sheet', label: 'Price / sheet', type: 'number', step: 0.01, required: true },
      { key: 'alt_price', label: 'Alt price', type: 'number', step: 0.01 },
    ],
  },
  lamination_types: {
    label: 'Lamination',
    columns: [
      { key: 'name', label: 'Name', required: true },
      { key: 'thickness_microns', label: 'Microns', type: 'number', required: true },
      { key: 'roll_size', label: 'Roll size', required: true },
      { key: 'roll_price', label: 'Roll price', type: 'number', step: 0.01, required: true },
    ],
  },
  overhead_costs: {
    label: 'Overhead',
    columns: [
      { key: 'name', label: 'Name', required: true },
      { key: 'cost_per_copy', label: 'Cost / copy', type: 'number', step: 0.01, required: true },
      {
        key: 'binding_type',
        label: 'Applies to',
        type: 'select',
        options: ['__all__', 'perfect', 'saddle', 'wiro', 'comb', 'document', 'other'],
      },
    ],
  },
  imposition_rules: {
    label: 'Imposition',
    columns: [
      { key: 'trim_size', label: 'Trim size', required: true },
      { key: 'printer_paper_size', label: 'Printer paper', required: true },
      { key: 'pages_per_sheet', label: 'Pages / sheet', type: 'number', required: true },
    ],
  },
};

export function RateCardAdmin() {
  const [active, setActive] = useState<TableName>('paper_types');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Rate card</h1>
        <p className="text-sm text-muted-foreground">Pricing inputs. Each change is reflected in future price calculations; existing quotes keep their snapshot.</p>
      </div>

      <Tabs value={active} onValueChange={(v) => setActive(v as TableName)}>
        <TabsList>
          {(Object.keys(SCHEMAS) as TableName[]).map((t) => (
            <TabsTrigger key={t} value={t}>{SCHEMAS[t].label}</TabsTrigger>
          ))}
        </TabsList>
        {(Object.keys(SCHEMAS) as TableName[]).map((t) => (
          <TabsContent key={t} value={t}>
            <RateTable table={t} />
          </TabsContent>
        ))}
      </Tabs>

      <PricingSettingsCard />
    </div>
  );
}

type Row = Record<string, unknown> & { id: string; is_active?: boolean };

function RateTable({ table }: { table: TableName }) {
  const schema = SCHEMAS[table];
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);

  async function reload() {
    setLoading(true);
    const { data } = await supabase.from(table).select('*').order('updated_at', { ascending: false });
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }

  useEffect(() => { reload(); }, [table]);

  async function remove(row: Row) {
    if (!confirm('Deactivate this row? (Soft-delete)')) return;
    if ('is_active' in row) {
      await supabase.from(table).update({ is_active: false }).eq('id', row.id);
    } else {
      await supabase.from(table).delete().eq('id', row.id);
    }
    await reload();
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{schema.label}</CardTitle>
        <Button size="sm" onClick={() => setCreating(true)}><Plus className="mr-1 h-4 w-4" />Add</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              {schema.columns.map((c) => <TableHead key={c.key}>{c.label}</TableHead>)}
              <TableHead></TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={schema.columns.length + 2} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
            {!loading && rows.length === 0 && <TableRow><TableCell colSpan={schema.columns.length + 2} className="text-center text-muted-foreground">No rows yet.</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id}>
                {schema.columns.map((c) => (
                  <TableCell key={c.key}>
                    {c.key === 'binding_type' && !r[c.key]
                      ? <span className="text-muted-foreground">All bindings</span>
                      : String(r[c.key] ?? '—')}
                  </TableCell>
                ))}
                <TableCell>{r.is_active === false && <Badge variant="muted">inactive</Badge>}</TableCell>
                <TableCell className="space-x-1 text-right">
                  <Button size="sm" variant="ghost" onClick={() => setEditOpen(r)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(r)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      {(editOpen || creating) && (
        <EditDialog
          table={table}
          row={editOpen}
          onClose={() => { setEditOpen(null); setCreating(false); reload(); }}
        />
      )}
    </Card>
  );
}

function EditDialog({ table, row, onClose }: { table: TableName; row: Row | null; onClose: () => void }) {
  const schema = SCHEMAS[table];
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    if (row) {
      const copy: Record<string, unknown> = { ...row };
      // Map stored NULL back to the "__all__" sentinel so the Select shows something
      for (const c of schema.columns) {
        if (c.type === 'select' && copy[c.key] == null && c.options?.includes('__all__')) {
          copy[c.key] = '__all__';
        }
      }
      return copy;
    }
    const init: Record<string, unknown> = {};
    for (const c of schema.columns) init[c.key] = c.type === 'number' ? 0 : c.options ? c.options[0] : '';
    return init;
  });
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {};
      for (const c of schema.columns) {
        let v = values[c.key];
        if (c.type === 'number' && typeof v === 'string') v = parseFloat(v);
        if (c.required && (v === '' || v == null)) {
          toast({ variant: 'destructive', title: `Missing ${c.label}` });
          setBusy(false);
          return;
        }
        // Empty string → NULL for optional select columns (e.g. overhead.binding_type = "All bindings")
        if (!c.required && v === '') v = null;
        // "__all__" sentinel → NULL for the overhead.binding_type column
        if (v === '__all__') v = null;
        payload[c.key] = v;
      }
      if (row) {
        const { error } = await supabase.from(table).update(payload).eq('id', row.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(table).insert(payload);
        if (error) throw error;
      }
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ variant: 'destructive', title: 'Save failed', description: msg });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{row ? 'Edit' : 'Add'} {schema.label.toLowerCase()}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          {schema.columns.map((c) => (
            <div key={c.key} className="space-y-1.5">
              <Label>{c.label}{c.required && <span className="text-destructive"> *</span>}</Label>
              {c.type === 'select' && c.options ? (
                <Select value={String(values[c.key] ?? '')} onValueChange={(v) => setValues({ ...values, [c.key]: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {c.options.map((o) => (
                      <SelectItem key={o} value={o}>{o === '__all__' ? 'All bindings' : o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type={c.type === 'number' ? 'number' : 'text'}
                  step={c.step}
                  value={String(values[c.key] ?? '')}
                  onChange={(e) => setValues({ ...values, [c.key]: c.type === 'number' ? e.target.value : e.target.value })}
                />
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PricingSettingsCard() {
  const [margin, setMargin] = useState('30');
  const [inflation, setInflation] = useState('9');
  const [defaultDiscount, setDefaultDiscount] = useState('0');
  const [shippingCharge, setShippingCharge] = useState('0');
  const [id, setId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('pricing_settings').select('*').limit(1).maybeSingle();
      if (data) {
        setId(data.id as string);
        setMargin(String(data.margin_percent ?? 30));
        setInflation(String(data.inflation_percent ?? 9));
        setDefaultDiscount(String(data.default_discount_percent ?? 0));
        setShippingCharge(String(data.shipping_charge ?? 0));
      }
    })();
  }, []);

  async function save() {
    setBusy(true);
    try {
      const payload = {
        margin_percent: parseFloat(margin) || 0,
        inflation_percent: parseFloat(inflation) || 0,
        default_discount_percent: parseFloat(defaultDiscount) || 0,
        shipping_charge: parseFloat(shippingCharge) || 0,
      };
      if (id) {
        await supabase.from('pricing_settings').update(payload).eq('id', id);
      } else {
        const { data } = await supabase.from('pricing_settings').insert(payload).select('id').single();
        if (data) setId(data.id as string);
      }
      toast({ title: 'Saved' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pricing settings</CardTitle>
        <p className="text-xs text-muted-foreground">
          These are the defaults used when a new order is calculated. Individual orders can still
          override margin / inflation / discount in the pricing calculator.
        </p>
      </CardHeader>
      <CardContent className="grid max-w-2xl gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Margin %</Label>
          <Input type="number" step="0.5" value={margin} onChange={(e) => setMargin(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Inflation %</Label>
          <Input type="number" step="0.5" value={inflation} onChange={(e) => setInflation(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Default discount %</Label>
          <Input type="number" step="0.5" value={defaultDiscount} onChange={(e) => setDefaultDiscount(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Courier shipping charge (₹, flat)</Label>
          <Input type="number" step="1" value={shippingCharge} onChange={(e) => setShippingCharge(e.target.value)} />
          <p className="text-xs text-muted-foreground">Added to orders where delivery method = courier.</p>
        </div>
        <div className="md:col-span-2">
          <Button onClick={save} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
