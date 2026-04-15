import { Badge } from '@/components/ui/badge';
import type { OrderStatus, ProductionStatus } from '@/lib/database.types';
import { titleCase } from '@/lib/utils';

const variantByStatus: Record<OrderStatus, Parameters<typeof Badge>[0]['variant']> = {
  new: 'sky',
  under_review: 'sky',
  quoted: 'gold',
  confirmed: 'gold',
  in_production: 'default',
  ready: 'success',
  shipped: 'success',
  picked_up: 'success',
  invoiced: 'muted',
  closed: 'muted',
  cancelled: 'tangerine',
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={variantByStatus[status] ?? 'default'}>{titleCase(status)}</Badge>;
}

export function ProductionStatusBadge({ status }: { status: ProductionStatus | null }) {
  if (!status) return <Badge variant="muted">Not started</Badge>;
  return <Badge variant="outline">{titleCase(status)}</Badge>;
}
