import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(n: number | null | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatDate(s: string | null | undefined): string {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(s: string | null | undefined): string {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function titleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const ORDER_SOURCE_LABELS: Record<string, string> = {
  public: 'POD Form',
  amazon: 'Amazon',
  online_store: 'Online Store',
  book_store: 'Book Store',
  whatsapp: 'WhatsApp',
  other: 'Other',
  // Legacy values — shown with nicer labels so old orders read cleanly.
  saiacs_store: 'Online Store',
  direct: 'Book Store',
};

/** Friendly label for an order_source value, with optional free-text "Other" note. */
export function formatOrderSource(
  source: string | null | undefined,
  otherText?: string | null,
): string {
  if (!source) return '—';
  const base = ORDER_SOURCE_LABELS[source] ?? titleCase(source);
  if (source === 'other' && otherText && otherText.trim().length > 0) {
    return `${base} — ${otherText.trim()}`;
  }
  return base;
}
