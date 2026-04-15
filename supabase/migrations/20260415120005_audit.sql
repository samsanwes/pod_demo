-- Audit log + holds + auto-audit trigger (spec §4.5, §4.6 + plan decision)

CREATE TABLE order_status_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  field_changed   TEXT NOT NULL,
  old_value       TEXT,
  new_value       TEXT NOT NULL,
  changed_by      UUID REFERENCES users(id),
  changed_at      TIMESTAMPTZ DEFAULT now(),
  notes           TEXT
);

CREATE INDEX order_status_log_order_id_idx ON order_status_log (order_id, changed_at DESC);

CREATE TABLE order_holds (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  placed_by                     UUID NOT NULL REFERENCES users(id),
  placed_at                     TIMESTAMPTZ DEFAULT now(),
  reason                        TEXT NOT NULL,
  resumed_by                    UUID REFERENCES users(id),
  resumed_at                    TIMESTAMPTZ,
  production_status_before_hold TEXT
);

CREATE INDEX order_holds_order_id_idx ON order_holds (order_id);

-- Set the audit user for the current transaction. Client calls this RPC at sign-in.
CREATE OR REPLACE FUNCTION set_audit_user(uid UUID)
RETURNS void
LANGUAGE sql
AS $$
  SELECT set_config('app.user_id', uid::text, false);
$$;

-- Audit trigger: on UPDATE, log changes to tracked fields
CREATE OR REPLACE FUNCTION log_order_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  audit_uid UUID;
  field TEXT;
  tracked TEXT[] := ARRAY[
    'status', 'production_status', 'is_on_hold', 'hold_reason',
    'assigned_to', 'unit_production_cost', 'price_per_copy', 'total_price',
    'courier_name', 'tracking_number', 'dispatch_date',
    'zoho_invoice_id', 'invoice_sent_at', 'payment_received_at', 'payment_terms'
  ];
BEGIN
  -- Resolve audit user from session var; fall back to auth.uid()
  BEGIN
    audit_uid := nullif(current_setting('app.user_id', true), '')::UUID;
  EXCEPTION WHEN OTHERS THEN
    audit_uid := NULL;
  END;
  IF audit_uid IS NULL THEN
    audit_uid := auth.uid();
  END IF;

  FOREACH field IN ARRAY tracked LOOP
    EXECUTE format(
      'SELECT ($1).%1$I::text IS DISTINCT FROM ($2).%1$I::text', field
    )
    INTO STRICT FOUND USING OLD, NEW;

    IF FOUND THEN
      EXECUTE format(
        'INSERT INTO order_status_log (order_id, field_changed, old_value, new_value, changed_by)
         VALUES ($1, $2, ($3).%1$I::text, ($4).%1$I::text, $5)', field
      ) USING NEW.id, field, OLD, NEW, audit_uid;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_audit
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION log_order_changes();

-- Order_status_log: anyone with order read access can read; trigger writes
ALTER TABLE order_status_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read audit log"
  ON order_status_log FOR SELECT TO authenticated USING (true);

ALTER TABLE order_holds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read holds"
  ON order_holds FOR SELECT TO authenticated USING (true);
CREATE POLICY "Production+manager write holds"
  ON order_holds FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('manager', 'production'));
CREATE POLICY "Production+manager update holds"
  ON order_holds FOR UPDATE TO authenticated
  USING (get_user_role() IN ('manager', 'production'));
