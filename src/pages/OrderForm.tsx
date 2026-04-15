import { Link } from 'react-router-dom';
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
            Submit your print project — we'll review, quote, and produce it on campus.
          </p>
        </div>
        <OrderForm />
      </main>
      <footer className="mt-10 border-t py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} South Asia Institute of Advanced Christian Studies
      </footer>
    </div>
  );
}
