-- Collapse production sub-status "started" into "in_progress".
-- The two were redundant for a small press — "started" meant "prep/setup",
-- "in_progress" meant "actively printing". Simplifying to a single active
-- state.
--
-- The enum value "started" is kept in the type for backwards compatibility
-- with any historical audit-log rows; it's just no longer surfaced in the UI.

UPDATE orders
   SET production_status = 'in_progress'
 WHERE production_status = 'started';
