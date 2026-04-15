-- Order file metadata per spec §4.4

CREATE TABLE order_files (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  file_type       file_type NOT NULL,
  file_name       TEXT NOT NULL,
  storage_path    TEXT NOT NULL,
  file_size_bytes INTEGER,
  mime_type       TEXT,
  uploaded_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX order_files_order_id_idx ON order_files (order_id);
