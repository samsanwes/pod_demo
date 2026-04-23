-- Add an intermediate "sample_approved" state between sample_approval and
-- full_production. Manager's "Approve sample" now sets this state; production
-- acknowledges by clicking "Start full production" which advances to full_production.
-- This mirrors the real-world handoff: manager approves the sample verbally,
-- production then actively starts the full run.

ALTER TYPE production_status ADD VALUE IF NOT EXISTS 'sample_approved' AFTER 'sample_approval';
