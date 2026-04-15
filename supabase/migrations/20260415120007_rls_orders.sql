-- Row Level Security on orders + order_files (spec §5.1, §5.3)

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Public can submit orders (anonymous form)
CREATE POLICY "Public can submit orders"
  ON orders FOR INSERT TO anon
  WITH CHECK (true);

-- Manager: full access
CREATE POLICY "Manager reads all"
  ON orders FOR SELECT TO authenticated
  USING (get_user_role() = 'manager');

CREATE POLICY "Manager updates all"
  ON orders FOR UPDATE TO authenticated
  USING (get_user_role() = 'manager');

CREATE POLICY "Manager deletes"
  ON orders FOR DELETE TO authenticated
  USING (get_user_role() = 'manager');

-- Production: confirmed → ready only
CREATE POLICY "Production reads production orders"
  ON orders FOR SELECT TO authenticated
  USING (
    get_user_role() = 'production'
    AND status IN ('confirmed', 'in_production', 'ready')
  );

CREATE POLICY "Production updates production orders"
  ON orders FOR UPDATE TO authenticated
  USING (
    get_user_role() = 'production'
    AND status IN ('confirmed', 'in_production', 'ready')
  );

-- Bookstore: ready + courier only
CREATE POLICY "Bookstore reads shipping orders"
  ON orders FOR SELECT TO authenticated
  USING (
    get_user_role() = 'bookstore'
    AND status = 'ready'
    AND delivery_method = 'courier'
  );

CREATE POLICY "Bookstore updates shipping"
  ON orders FOR UPDATE TO authenticated
  USING (
    get_user_role() = 'bookstore'
    AND status = 'ready'
    AND delivery_method = 'courier'
  );

-- order_files: anyone can insert (anon form), staff (manager+production) can read
ALTER TABLE order_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can insert order files"
  ON order_files FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Staff read order files"
  ON order_files FOR SELECT TO authenticated
  USING (get_user_role() IN ('manager', 'production'));

CREATE POLICY "Manager mutate order files"
  ON order_files FOR ALL TO authenticated
  USING (get_user_role() = 'manager')
  WITH CHECK (get_user_role() = 'manager');
