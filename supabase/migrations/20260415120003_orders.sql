-- Orders table per spec §4.3

CREATE TABLE orders (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number            TEXT UNIQUE,
  status                  order_status DEFAULT 'new',
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now(),

  -- Contact
  client_email            TEXT NOT NULL,
  client_name             TEXT NOT NULL,
  client_phone            TEXT NOT NULL,
  client_organization     TEXT NOT NULL,

  -- Order basics
  binding_type            binding_type NOT NULL,
  binding_type_other      TEXT,
  quantity                INTEGER NOT NULL CHECK (quantity >= 1),
  delivery_date           DATE NOT NULL,
  delivery_method         delivery_method NOT NULL,
  delivery_address        TEXT,
  special_instructions    TEXT,

  -- Book specification (binding_type = perfect)
  trim_size               TEXT,
  trim_size_other         TEXT,
  num_pages               INTEGER,
  paper_type              TEXT,
  cover_printing          colour_mode,
  inner_printing          colour_mode,
  cover_lamination        lamination_option,

  -- Print specification (binding_type != perfect)
  printing_type           colour_mode[],
  printing_sides          TEXT,
  paper_size              TEXT,
  paper_size_other        TEXT,

  -- Pricing
  unit_production_cost    DECIMAL(10,2),
  margin_percent          DECIMAL(5,2) DEFAULT 30,
  inflation_percent       DECIMAL(5,2) DEFAULT 9,
  price_per_copy          DECIMAL(10,2),
  total_price             DECIMAL(10,2),
  price_breakdown         JSONB,

  -- Production
  production_status       production_status,
  assigned_to             UUID REFERENCES users(id),
  is_on_hold              BOOLEAN DEFAULT false,
  hold_reason             TEXT,

  -- Shipping
  courier_name            TEXT,
  tracking_number         TEXT,
  dispatch_date           DATE,

  -- Invoicing
  zoho_invoice_id         TEXT,
  invoice_sent_at         TIMESTAMPTZ,
  payment_received_at     TIMESTAMPTZ,
  payment_terms           payment_terms,

  -- Constraint: courier deliveries must have an address
  CONSTRAINT courier_needs_address CHECK (
    delivery_method <> 'courier' OR (delivery_address IS NOT NULL AND length(delivery_address) > 0)
  )
);

CREATE INDEX orders_status_idx ON orders (status);
CREATE INDEX orders_created_at_idx ON orders (created_at DESC);
CREATE INDEX orders_delivery_method_idx ON orders (delivery_method);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
