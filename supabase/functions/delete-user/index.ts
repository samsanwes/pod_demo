// Hard-delete a staff account (manager only).
// Cascades to public.users via ON DELETE CASCADE.
// FK references in orders/history become NULL (migration 20260416090000_allow_user_deletion).
// @ts-expect-error Deno runtime
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
// @ts-expect-error Deno runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { corsHeaders } from '../_shared/cors.ts';

// @ts-expect-error Deno global
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
// @ts-expect-error Deno global
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { user_id } = body as { user_id?: string };
    if (!user_id) return json({ error: 'user_id is required' }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Verify caller is an active manager
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    const { data: userData } = await admin.auth.getUser(jwt);
    const callerId = userData.user?.id;
    if (!callerId) return json({ error: 'Unauthorized' }, 401);

    const { data: callerRow } = await admin
      .from('users').select('role,is_active').eq('id', callerId).single();
    const caller = callerRow as { role?: string; is_active?: boolean } | null;
    if (!caller?.is_active || caller?.role !== 'manager') {
      return json({ error: 'Manager role required' }, 403);
    }

    // Safety: don't let a manager delete themselves — they could lock themselves out.
    if (user_id === callerId) {
      return json({ error: 'You cannot delete your own account.' }, 400);
    }

    // auth.admin.deleteUser() cascades to public.users via the FK
    const { error: deleteErr } = await admin.auth.admin.deleteUser(user_id);
    if (deleteErr) throw deleteErr;

    return json({ ok: true, deleted_user_id: user_id });
  } catch (err) {
    const message = extractErrorMessage(err);
    console.error('[delete-user] error:', err);
    return json({ error: message }, 500);
  }
});

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    if (typeof e.message === 'string') return e.message;
    if (typeof e.error === 'string') return e.error;
    try { return JSON.stringify(err); } catch { /* fallthrough */ }
  }
  return String(err);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
