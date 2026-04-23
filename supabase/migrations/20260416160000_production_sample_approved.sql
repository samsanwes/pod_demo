-- Add a dedicated "sample_approved" state between sample_approval and
-- full_production. It represents the moment the manager has signed off on
-- the sample — at which point the ball is back in production's court to
-- kick off the full run.

ALTER TYPE production_status ADD VALUE IF NOT EXISTS 'sample_approved' AFTER 'sample_approval';
