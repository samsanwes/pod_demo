-- Fix: the audit trigger inserts into order_status_log, but that table has
-- RLS enabled with only SELECT policies. Without SECURITY DEFINER the trigger
-- tries to insert as the user's role and gets rejected.
--
-- Making the function SECURITY DEFINER is correct here: audit logging is a
-- system write, not a user action, and the trigger only writes well-formed
-- rows derived from NEW/OLD so there's no injection surface.

CREATE OR REPLACE FUNCTION log_order_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
