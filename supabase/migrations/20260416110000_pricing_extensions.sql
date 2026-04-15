-- Pricing extensions:
--   1. Overhead costs now scope to a binding type (NULL = applies to all bindings).
--   2. pricing_settings gains a flat shipping_charge + a default_discount_percent.
--   3. orders gains a per-order discount_percent.

-- 1. Overhead costs per binding
ALTER TABLE overhead_costs
  ADD COLUMN IF NOT EXISTS binding_type binding_type;

COMMENT ON COLUMN overhead_costs.binding_type IS
  'If set, this overhead only applies to the matching binding_type. NULL = applies to all bindings.';

-- 2. Pricing settings: shipping + default discount
ALTER TABLE pricing_settings
  ADD COLUMN IF NOT EXISTS shipping_charge DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS default_discount_percent DECIMAL(5,2) DEFAULT 0;

-- 3. Per-order discount
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5,2) DEFAULT 0;
