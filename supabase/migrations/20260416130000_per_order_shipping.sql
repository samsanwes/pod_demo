-- Per-order shipping charge. If NULL, the pricing calculator falls back to the
-- `shipping_charge` default in pricing_settings. Applies only to courier orders.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_charge DECIMAL(10,2);

COMMENT ON COLUMN orders.shipping_charge IS
  'Per-order courier charge. NULL = use pricing_settings.shipping_charge default.';
