import type { OrderRow } from '@/lib/database.types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BINDING_LABELS, BOOK_LIKE_BINDINGS } from '@/components/form/schemas';
import type { BindingType } from '@/lib/database.types';
import { titleCase, formatDate, formatDateTime } from '@/lib/utils';

export function DetailsTab({ order }: { order: OrderRow }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Contact</CardTitle></CardHeader>
        <CardContent className="grid gap-1 text-sm">
          <Row k="Name" v={order.client_name} />
          <Row k="Organisation" v={order.client_organization} />
          <Row k="Email" v={order.client_email} />
          <Row k="Phone" v={order.client_phone} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Order</CardTitle></CardHeader>
        <CardContent className="grid gap-1 text-sm">
          <Row k="Print type" v={order.binding_type === 'other' ? order.binding_type_other ?? '—' : BINDING_LABELS[order.binding_type as BindingType] ?? titleCase(order.binding_type)} />
          <Row k="Quantity" v={String(order.quantity)} />
          <Row k="Delivery by" v={formatDate(order.delivery_date)} />
          <Row k="Delivery method" v={titleCase(order.delivery_method)} />
          {order.delivery_method === 'courier' && <Row k="Address" v={order.delivery_address ?? ''} />}
          <Row k="Submitted" v={formatDateTime(order.created_at)} />
        </CardContent>
      </Card>

      {BOOK_LIKE_BINDINGS.includes(order.binding_type) && (
        <Card>
          <CardHeader><CardTitle className="text-base">Book specification</CardTitle></CardHeader>
          <CardContent className="grid gap-1 text-sm">
            <Row k="Trim size" v={order.trim_size === 'other' ? order.trim_size_other ?? '—' : order.trim_size ?? '—'} />
            <Row k="Pages" v={order.num_pages?.toString() ?? '—'} />
            <Row k="Text paper" v={order.paper_type ?? '—'} />
            <Row k="Cover paper" v={order.cover_paper_type ?? '—'} />
            <Row k="Inner printing" v={order.inner_printing === 'bw' ? 'B/W' : order.inner_printing === 'colour' ? 'Colour' : '—'} />
            <Row k="Cover printing" v={order.cover_printing === 'bw' ? 'B/W' : order.cover_printing === 'colour' ? 'Colour' : '—'} />
            <Row k="Cover lamination" v={order.cover_lamination ? titleCase(order.cover_lamination) : '—'} />
          </CardContent>
        </Card>
      )}

      {!BOOK_LIKE_BINDINGS.includes(order.binding_type) && (
        <Card>
          <CardHeader><CardTitle className="text-base">Print specification</CardTitle></CardHeader>
          <CardContent className="grid gap-1 text-sm">
            <Row k="Colour" v={(order.printing_type ?? []).map((c) => (c === 'bw' ? 'B/W' : 'Colour')).join(', ') || '—'} />
            <Row k="Sides" v={order.printing_sides ? titleCase(order.printing_sides) : '—'} />
            <Row k="Paper size" v={order.paper_size === 'other' ? order.paper_size_other ?? '—' : order.paper_size ?? '—'} />
          </CardContent>
        </Card>
      )}

      {order.special_instructions && (
        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base">Special instructions</CardTitle></CardHeader>
          <CardContent className="whitespace-pre-line text-sm">{order.special_instructions}</CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-4">
      <span className="w-36 shrink-0 text-muted-foreground">{k}</span>
      <span className="break-all">{v || '—'}</span>
    </div>
  );
}
