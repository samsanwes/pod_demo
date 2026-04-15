// Create a new staff account (manager only).
// Uses the admin API to provision an auth user, sends a magic-link invite,
// and inserts a matching row in public.users.
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
    const { name, email, role } = body as { name?: string; email?: string; role?: string };
    if (!name || !email || !role) {
      return json({ error: 'name, email, role required' }, 400);
    }
    if (!['manager', 'production', 'bookstore'].includes(role)) {
      return json({ error: 'invalid role' }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Verify caller is a manager
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

    // Invite new user via magic link
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { name, role },
    });
    if (inviteErr) throw inviteErr;

    const newUserId = invited.user?.id;
    if (!newUserId) throw new Error('Invite succeeded but no user id was returned.');

    // Insert into public.users
    const { error: upsertErr } = await admin
      .from('users')
      .upsert({ id: newUserId, email, name, role, is_active: true }, { onConflict: 'id' });
    if (upsertErr) throw upsertErr;

    return json({ ok: true, user_id: newUserId });
  } catch (err) {
    const message = extractErrorMessage(err);
    console.error('[create-user] error:', err);
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
