import { useParams, Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/shared/Logo';

export function OrderSubmittedPage() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8 text-center">
      <Logo className="mb-8" />
      <CheckCircle2 className="h-16 w-16 text-emerald-600" />
      <h1 className="mt-4 font-display text-3xl font-bold">Order received</h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        Thank you — your request has been submitted. Our team will review it and reach out with a quote shortly.
      </p>
      {orderNumber && (
        <p className="mt-4 rounded-md border bg-card px-4 py-2 font-mono text-sm">
          Reference: <strong>{orderNumber}</strong>
        </p>
      )}
      <Button asChild variant="outline" className="mt-8">
        <Link to="/">Submit another order</Link>
      </Button>
    </div>
  );
}
