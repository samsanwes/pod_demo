import { Link } from 'react-router-dom';
import { Mail, MessageCircle } from 'lucide-react';
import { Logo } from '@/components/shared/Logo';
import { OrderForm } from '@/components/form/OrderForm';

export function OrderFormPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white">
        <div className="container flex items-center justify-between py-4">
          <Logo />
          <Link to="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            Staff sign in →
          </Link>
        </div>
      </header>
      <main className="container py-10">
        <div className="mx-auto mb-8 max-w-3xl text-center">
          <h1 className="font-display text-4xl font-bold tracking-tight">Print on Demand</h1>
          <p className="mt-2 text-muted-foreground">
            Submit your print project — we'll review it, provide a quote, and be glad to assist with your order.
          </p>
        </div>
        <OrderForm />

        <div className="mx-auto mt-8 max-w-3xl rounded-lg border bg-white p-4 text-center text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Need a hand?</p>
          <p className="mt-1">
            For assistance, please email us at{' '}
            <a href="mailto:saiacspress@saiacs.org" className="inline-flex items-center gap-1 font-medium text-brand-foundations hover:underline">
              <Mail className="h-3.5 w-3.5" />
              saiacspress@saiacs.org
            </a>{' '}
            or send a WhatsApp message to{' '}
            <a
              href="https://wa.me/919606718535"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-brand-foundations hover:underline"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              +91 96067 18535
            </a>.
          </p>
        </div>
      </main>
      <footer className="mt-10 border-t py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} South Asia Institute of Advanced Christian Studies
      </footer>
    </div>
  );
}
