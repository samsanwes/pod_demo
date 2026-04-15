import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/shared/Logo';
import { toast } from '@/hooks/use-toast';

export function OrderSubmittedPage() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const [copied, setCopied] = useState(false);

  async function copyRef() {
    if (!orderNumber) return;
    try {
      await navigator.clipboard.writeText(orderNumber);
      setCopied(true);
      toast({ title: 'Copied', description: `${orderNumber} copied to clipboard.` });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ variant: 'destructive', title: 'Copy failed', description: 'Select the reference manually.' });
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8 text-center">
      <Logo className="mb-8" />
      <CheckCircle2 className="h-16 w-16 text-emerald-600" />
      <h1 className="mt-4 font-display text-3xl font-bold">Order received</h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        Thank you — your request has been submitted. Our team will review it and reach out with a quote shortly.
      </p>
      {orderNumber && (
        <div className="mt-4 inline-flex items-center gap-2 rounded-md border bg-card px-4 py-2 font-mono text-sm">
          <span>
            Reference: <strong>{orderNumber}</strong>
          </span>
          <Button
            size="icon"
            variant="ghost"
            onClick={copyRef}
            aria-label="Copy reference"
            className="h-7 w-7"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      )}
      <Button asChild variant="outline" className="mt-8">
        <Link to="/">Submit another order</Link>
      </Button>
    </div>
  );
}
