import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { OrderStatusLogRow, UserRow } from '@/lib/database.types';
import { titleCase, formatDateTime } from '@/lib/utils';

export function AuditLogTab({ orderId }: { orderId: string }) {
  const [rows, setRows] = useState<OrderStatusLogRow[]>([]);
  const [users, setUsers] = useState<Record<string, UserRow>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: log }, { data: userRows }] = await Promise.all([
        supabase.from('order_status_log').select('*').eq('order_id', orderId).order('changed_at', { ascending: false }),
        supabase.from('users').select('*'),
      ]);
      if (cancelled) return;
      setRows((log ?? []) as OrderStatusLogRow[]);
      const byId: Record<string, UserRow> = {};
      for (const u of (userRows ?? []) as UserRow[]) byId[u.id] = u;
      setUsers(byId);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [orderId]);

  if (loading) return <div className="text-sm text-muted-foreground">Loading audit log…</div>;
  if (rows.length === 0) return <div className="text-sm text-muted-foreground">No changes recorded yet.</div>;

  return (
    <ol className="relative border-l pl-6">
      {rows.map((r) => (
        <li key={r.id} className="mb-4">
          <div className="absolute -left-1.5 h-3 w-3 rounded-full bg-primary" />
          <div className="text-sm">
            <span className="font-semibold">{titleCase(r.field_changed)}</span>
            <span className="text-muted-foreground"> changed from </span>
            <code className="rounded bg-muted px-1 text-xs">{r.old_value ?? '∅'}</code>
            <span className="text-muted-foreground"> to </span>
            <code className="rounded bg-muted px-1 text-xs">{r.new_value}</code>
          </div>
          <div className="text-xs text-muted-foreground">
            {r.changed_by && users[r.changed_by] ? users[r.changed_by].name : 'System'} · {formatDateTime(r.changed_at)}
          </div>
        </li>
      ))}
    </ol>
  );
}
