-- Rate card RLS: manager-only writes; all authenticated can read (needed by pricing edge function via JWT, and by manager UI)

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'paper_types', 'printer_rates', 'lamination_types',
    'overhead_costs', 'pricing_settings', 'imposition_rules'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY "Authenticated read %1$s" ON %1$I FOR SELECT TO authenticated USING (true)', t
    );
    EXECUTE format(
      'CREATE POLICY "Manager mutate %1$s" ON %1$I FOR ALL TO authenticated
       USING (get_user_role() = ''manager'') WITH CHECK (get_user_role() = ''manager'')', t
    );
  END LOOP;
END $$;
