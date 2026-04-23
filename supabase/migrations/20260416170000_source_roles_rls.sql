-- 1. Add order_source_other for the "Other" free-text option in Place order.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_source_other TEXT;

-- 2. Staff INSERT now includes production role (they can also place internal
--    reprint orders — e.g. when they finish stock and the bookstore isn't on site).
DROP POLICY IF EXISTS "Staff create orders" ON orders;
CREATE POLICY "Staff create orders"
  ON orders FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('manager', 'bookstore', 'production'));

-- 3. Bookstore can now see + update all dispatch-stage orders (ready / shipped
--    / picked_up), not just courier. They coordinate physical handover
--    regardless of delivery method.
DROP POLICY IF EXISTS "Bookstore reads shipping orders" ON orders;
DROP POLICY IF EXISTS "Bookstore updates shipping" ON orders;

CREATE POLICY "Bookstore reads shipping orders"
  ON orders FOR SELECT TO authenticated
  USING (
    get_user_role() = 'bookstore'
    AND status IN ('ready', 'shipped', 'picked_up')
  );

CREATE POLICY "Bookstore updates ready orders"
  ON orders FOR UPDATE TO authenticated
  USING (
    get_user_role() = 'bookstore'
    AND status = 'ready'
  );

-- 4. Production already reads + updates confirmed/in_production/ready orders.
--    They also need to INSERT (Place order) — covered by policy in step 2.
