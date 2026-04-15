import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { UploadedFileMeta, Step1Values, BookSpecValues, PrintSpecValues } from '../schemas';
import { BINDING_LABELS, DELIVERY_LABELS } from '../schemas';
import { titleCase, formatDate } from '@/lib/utils';

interface Props {
  contact: Step1Values;
  bookSpec: BookSpecValues | null;
  printSpec: PrintSpecValues | null;
  files: UploadedFileMeta[];
}

export function Step3Review({ contact, bookSpec, printSpec, files }: Props) {
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader><CardTitle className="text-lg">Contact</CardTitle></CardHeader>
        <CardContent className="grid gap-1 text-sm">
          <Row k="Name" v={contact.client_name} />
          <Row k="Email" v={contact.client_email} />
          <Row k="Phone" v={contact.client_phone} />
          <Row k="Organisation" v={contact.client_organization} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Order basics</CardTitle></CardHeader>
        <CardContent className="grid gap-1 text-sm">
          <Row k="Print type" v={contact.binding_type === 'other' ? contact.binding_type_other ?? '—' : BINDING_LABELS[contact.binding_type]} />
          <Row k="Quantity" v={String(contact.quantity)} />
          <Row k="Required by" v={formatDate(contact.delivery_date)} />
          <Row k="Delivery" v={DELIVERY_LABELS[contact.delivery_method]} />
          {contact.delivery_method === 'courier' && <Row k="Address" v={contact.delivery_address ?? ''} />}
          {contact.special_instructions && <Row k="Notes" v={contact.special_instructions} />}
        </CardContent>
      </Card>

      {bookSpec && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Book specification</CardTitle></CardHeader>
          <CardContent className="grid gap-1 text-sm">
            <Row k="Trim size" v={bookSpec.trim_size === 'other' ? bookSpec.trim_size_other ?? '—' : bookSpec.trim_size} />
            <Row k="Pages" v={String(bookSpec.num_pages)} />
            <Row k="Text paper" v={bookSpec.paper_type} />
            <Row k="Cover paper" v={bookSpec.cover_paper_type} />
            <Row k="Inner printing" v={bookSpec.inner_printing === 'bw' ? 'Black & white' : 'Colour'} />
            <Row k="Cover printing" v={bookSpec.cover_printing === 'bw' ? 'Black & white' : 'Colour'} />
            <Row k="Cover lamination" v={titleCase(bookSpec.cover_lamination)} />
          </CardContent>
        </Card>
      )}

      {printSpec && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Print specification</CardTitle></CardHeader>
          <CardContent className="grid gap-1 text-sm">
            <Row k="Colour" v={printSpec.printing_type.map((c) => (c === 'bw' ? 'Black & white' : 'Colour')).join(', ')} />
            <Row k="Sides" v={titleCase(printSpec.printing_sides)} />
            <Row k="Paper size" v={printSpec.paper_size === 'other' ? printSpec.paper_size_other ?? '—' : printSpec.paper_size} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-lg">Files</CardTitle></CardHeader>
        <CardContent className="text-sm">
          {files.length === 0 && <p className="text-muted-foreground">No files uploaded.</p>}
          <ul className="space-y-1">
            {files.map((f) => (
              <li key={f.storage_path} className="flex items-center justify-between rounded bg-brand-snow px-3 py-2">
                <span>
                  <span className="font-medium">{titleCase(f.file_type)}:</span> {f.file_name}
                </span>
                <span className="text-xs text-muted-foreground">{(f.file_size_bytes / 1024 / 1024).toFixed(1)} MB</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-4">
      <span className="w-36 shrink-0 text-muted-foreground">{k}</span>
      <span>{v || '—'}</span>
    </div>
  );
}
