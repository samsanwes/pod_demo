import { useState } from 'react';
import { Copy, Check, Mail } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import type { OrderRow } from '@/lib/database.types';
import { renderEmail, EMAIL_TEMPLATE_LABELS, type EmailTemplateId } from '@/lib/emailTemplates';
import { toast } from '@/hooks/use-toast';

interface Props {
  order: OrderRow;
  template: EmailTemplateId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmailTemplateDialog({ order, template, open, onOpenChange }: Props) {
  const rendered = renderEmail(template, order);
  const [copiedField, setCopiedField] = useState<'subject' | 'body' | null>(null);

  async function copy(field: 'subject' | 'body', value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      toast({ title: 'Copied', description: `${field === 'subject' ? 'Subject' : 'Body'} copied to clipboard.` });
      setTimeout(() => setCopiedField(null), 1500);
    } catch {
      toast({ variant: 'destructive', title: 'Copy failed', description: 'Select the text manually.' });
    }
  }

  function openInMail() {
    const url = `mailto:${encodeURIComponent(order.client_email)}?subject=${encodeURIComponent(
      rendered.subject
    )}&body=${encodeURIComponent(rendered.body)}`;
    window.location.href = url;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{EMAIL_TEMPLATE_LABELS[template]} email</DialogTitle>
          <DialogDescription>
            Copy the subject and body into your mail client, or open directly in your default app.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>To</Label>
            <Input readOnly value={order.client_email} className="mt-1.5" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="subject">Subject</Label>
              <Button size="sm" variant="outline" onClick={() => copy('subject', rendered.subject)}>
                {copiedField === 'subject' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span className="ml-1.5">Copy</span>
              </Button>
            </div>
            <Input id="subject" readOnly value={rendered.subject} className="mt-1.5" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="body">Body</Label>
              <Button size="sm" variant="outline" onClick={() => copy('body', rendered.body)}>
                {copiedField === 'body' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span className="ml-1.5">Copy</span>
              </Button>
            </div>
            <Textarea id="body" readOnly value={rendered.body} className="mt-1.5 min-h-[280px] font-mono text-xs" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={openInMail}>
            <Mail className="mr-2 h-4 w-4" />
            Open in mail app
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
