-- Per-year order number sequence + helper used by edge function
-- 2026 sequence created up-front; future years auto-created on demand

CREATE SEQUENCE IF NOT EXISTS order_seq_2026 START 1;

CREATE OR REPLACE FUNCTION next_order_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  yr INT := EXTRACT(YEAR FROM now())::INT;
  seq_name TEXT := format('order_seq_%s', yr);
  next_val BIGINT;
BEGIN
  -- Create the year's sequence if missing
  EXECUTE format(
    'CREATE SEQUENCE IF NOT EXISTS %I START 1', seq_name
  );
  EXECUTE format('SELECT nextval(%L)', seq_name) INTO next_val;
  RETURN format('POD-%s-%s', yr, lpad(next_val::text, 4, '0'));
END;
$$;
