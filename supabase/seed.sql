-- Placeholder rate card seed.
-- Replace via the in-app Rate Card admin (manager only) before going live.

-- Pricing settings (singleton)
INSERT INTO pricing_settings (margin_percent, inflation_percent)
VALUES (30, 9)
ON CONFLICT DO NOTHING;

-- Paper types
INSERT INTO paper_types (name, gsm, size, price_per_sheet, usage) VALUES
  ('Maplitho', 70, 'A3', 2.50, 'text'),
  ('Maplitho', 80, 'A3', 2.85, 'text'),
  ('Bond', 100, 'A3', 3.40, 'text'),
  ('Art Card', 220, 'A3', 7.20, 'cover'),
  ('Art Card', 250, 'A3', 8.10, 'cover'),
  ('Art Card', 300, 'A3', 9.50, 'cover'),
  ('Sun Board', 350, 'A3', 12.00, 'special');

-- Printer rates (per-sheet print cost)
INSERT INTO printer_rates (printer_name, colour_mode, paper_size, price_per_sheet) VALUES
  ('Konica BW',     'bw',     'A3', 0.45),
  ('Konica BW',     'bw',     'A4', 0.30),
  ('Konica Colour', 'colour', 'A3', 6.50),
  ('Konica Colour', 'colour', 'A4', 4.00);

-- Lamination
INSERT INTO lamination_types (name, thickness_microns, roll_size, roll_price) VALUES
  ('Glossy', 80, '320mm x 200m',  1800.00),
  ('Matte',  80, '320mm x 200m',  1950.00),
  ('Velvet', 100, '320mm x 200m', 2500.00);

-- Overhead per copy
INSERT INTO overhead_costs (name, cost_per_copy) VALUES
  ('Cutting',   1.00),
  ('Labour',    3.00),
  ('Machinery', 1.50),
  ('Admin',     2.00);

-- Imposition rules: how many trim-size pages fit on one printer sheet
INSERT INTO imposition_rules (trim_size, printer_paper_size, pages_per_sheet) VALUES
  ('A4', 'A3', 2),
  ('A5', 'A3', 4),
  ('A5', 'A4', 2),
  ('A6', 'A3', 8),
  ('Custom 5.5x8.5', 'A3', 4),
  ('Custom 6x9', 'A3', 4)
ON CONFLICT (trim_size, printer_paper_size) DO NOTHING;
