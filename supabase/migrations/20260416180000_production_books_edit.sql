-- Production role can now add/edit books too (in addition to managers).
-- Bookstore still reads-only via the existing "Authenticated read books" policy.

DROP POLICY IF EXISTS "Manager mutate books" ON books;

CREATE POLICY "Manager and production mutate books"
  ON books FOR ALL TO authenticated
  USING (get_user_role() IN ('manager', 'production'))
  WITH CHECK (get_user_role() IN ('manager', 'production'));
