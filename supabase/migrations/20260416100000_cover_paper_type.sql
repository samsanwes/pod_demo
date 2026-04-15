-- Allow clients to specify cover paper separately from text paper for book-bound
-- orders. `paper_type` (existing) remains text paper. Both accept a special
-- sentinel value 'Not sure — please recommend' which the UI surfaces as a
-- radio option. The pricing calculator falls back to a sensible default when
-- either is set to that sentinel.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS cover_paper_type TEXT;
