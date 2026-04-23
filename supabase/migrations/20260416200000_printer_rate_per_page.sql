-- Printer rates are now stored per-page instead of per printer sheet.
-- This matches how the press actually thinks about pricing — a "click" is
-- per impression, and users enter per-page values directly rather than
-- calculating via imposition. Paper costs still stay per-sheet on
-- paper_types (paper is genuinely sold by sheet).

ALTER TABLE printer_rates RENAME COLUMN price_per_sheet TO price_per_page;

COMMENT ON COLUMN printer_rates.price_per_page IS
  'Cost per printed page (per impression). The pricing calc multiplies this by num_pages.';
