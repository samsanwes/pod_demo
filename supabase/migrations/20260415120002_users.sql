-- Users table linked to auth.users + role helper (spec §3.3, §4.2)

CREATE TABLE users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  role          user_role NOT NULL,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

-- Helper used in every RLS policy. SECURITY DEFINER bypasses RLS to read users row.
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role::text FROM users WHERE id = auth.uid() AND is_active = true;
$$;

-- Convenience: is the current user the named role
CREATE OR REPLACE FUNCTION is_role(target text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
      AND is_active = true
      AND role::text = target
  );
$$;

-- Users RLS: any authenticated user can read; only manager can mutate
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read users"
  ON users FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Manager mutate users"
  ON users FOR ALL TO authenticated
  USING (get_user_role() = 'manager')
  WITH CHECK (get_user_role() = 'manager');
