-- Fix: next_order_number() needs SECURITY DEFINER to CREATE SEQUENCE when the
-- year rolls over, and explicit grants for the service_role + edge functions.

CREATE OR REPLACE FUNCTION next_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  yr INT := EXTRACT(YEAR FROM now())::INT;
  seq_name TEXT := format('order_seq_%s', yr);
  next_val BIGINT;
BEGIN
  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %I START 1', seq_name);
  EXECUTE format('SELECT nextval(%L)', seq_name) INTO next_val;
  RETURN format('POD-%s-%s', yr, lpad(next_val::text, 4, '0'));
END;
$$;

GRANT EXECUTE ON FUNCTION next_order_number() TO anon, authenticated, service_role;

-- Ensure service_role can also use the helper set_audit_user RPC
GRANT EXECUTE ON FUNCTION set_audit_user(UUID) TO authenticated, service_role;

-- get_user_role is already SECURITY DEFINER; just ensure grants are present
GRANT EXECUTE ON FUNCTION get_user_role() TO anon, authenticated, service_role;
