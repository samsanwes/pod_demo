-- Widen rate card mutate policies to include production role (was manager-only).
-- Read stays open to all authenticated roles via the existing "Authenticated read …" policies.

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'paper_types', 'printer_rates', 'lamination_types',
    'overhead_costs', 'pricing_settings', 'imposition_rules'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Manager mutate %1$s" ON %1$I', t);
    EXECUTE format(
      'CREATE POLICY "Manager and production mutate %1$s" ON %1$I FOR ALL TO authenticated
       USING (get_user_role() IN (''manager'', ''production''))
       WITH CHECK (get_user_role() IN (''manager'', ''production''))', t
    );
  END LOOP;
END $$;
