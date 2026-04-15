-- Rate card tables per spec §4.7

CREATE TABLE paper_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  gsm INTEGER NOT NULL,
  size TEXT NOT NULL,
  price_per_sheet DECIMAL(10,4) NOT NULL,
  usage paper_usage NOT NULL,
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE printer_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  printer_name TEXT NOT NULL,
  colour_mode colour_mode NOT NULL,
  paper_size TEXT NOT NULL,
  price_per_sheet DECIMAL(10,4) NOT NULL,
  alt_price DECIMAL(10,4),
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE lamination_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  thickness_microns INTEGER NOT NULL,
  roll_size TEXT NOT NULL,
  roll_price DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE overhead_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cost_per_copy DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE pricing_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  margin_percent DECIMAL(5,2) DEFAULT 30,
  inflation_percent DECIMAL(5,2) DEFAULT 9,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE imposition_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trim_size TEXT NOT NULL,
  printer_paper_size TEXT NOT NULL,
  pages_per_sheet INTEGER NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (trim_size, printer_paper_size)
);

-- Single-row pricing settings (seed will insert one row)
CREATE UNIQUE INDEX pricing_settings_singleton
  ON pricing_settings ((true));

-- updated_at triggers
CREATE TRIGGER paper_types_updated_at BEFORE UPDATE ON paper_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER printer_rates_updated_at BEFORE UPDATE ON printer_rates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER lamination_types_updated_at BEFORE UPDATE ON lamination_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER overhead_costs_updated_at BEFORE UPDATE ON overhead_costs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER pricing_settings_updated_at BEFORE UPDATE ON pricing_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER imposition_rules_updated_at BEFORE UPDATE ON imposition_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
