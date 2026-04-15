-- Storage bucket + policies for order file uploads (spec §5.3)

INSERT INTO storage.buckets (id, name, public)
VALUES ('order-files', 'order-files', false)
ON CONFLICT (id) DO NOTHING;

-- Anyone (including anon submitting the public form) can upload
CREATE POLICY "Anyone uploads order files"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'order-files');

-- Staff (manager + production) can read uploaded files
CREATE POLICY "Staff reads order files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'order-files'
    AND get_user_role() IN ('manager', 'production')
  );

-- Manager can delete files (e.g. cleanup on order cancel)
CREATE POLICY "Manager deletes order files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'order-files'
    AND get_user_role() = 'manager'
  );
