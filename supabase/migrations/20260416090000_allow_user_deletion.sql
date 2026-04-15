-- Relax FK constraints so deleting a user doesn't blow up on history references.
-- History rows stay, but attribution becomes NULL (= "System" in the audit log UI).

-- orders.assigned_to: if the assigned staff is deleted, leave the order unassigned
ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_assigned_to_fkey,
  ADD CONSTRAINT orders_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;

-- order_status_log.changed_by: keep history even if the author is deleted
ALTER TABLE order_status_log
  DROP CONSTRAINT IF EXISTS order_status_log_changed_by_fkey,
  ADD CONSTRAINT order_status_log_changed_by_fkey
    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL;

-- order_holds.placed_by is NOT NULL. Relax that so deletion doesn't cascade-delete holds.
ALTER TABLE order_holds
  ALTER COLUMN placed_by DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS order_holds_placed_by_fkey,
  ADD CONSTRAINT order_holds_placed_by_fkey
    FOREIGN KEY (placed_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE order_holds
  DROP CONSTRAINT IF EXISTS order_holds_resumed_by_fkey,
  ADD CONSTRAINT order_holds_resumed_by_fkey
    FOREIGN KEY (resumed_by) REFERENCES users(id) ON DELETE SET NULL;
