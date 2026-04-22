-- Books catalog + internal bookstore orders.
--
-- The bookstore team reprints titles originally sold via Amazon, SAIACS Store,
-- WhatsApp, or walk-in. Production already has the print-ready files for these
-- titles; the catalog keeps the specs consistent so each reprint comes out
-- identically. An internal order is just a regular row in `orders` with
-- `order_source != 'public'` and `book_id` pointing at the catalog entry.

-- 1. Books catalog
CREATE TABLE IF NOT EXISTS books (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title              TEXT NOT NULL,
  author             TEXT,
  isbn               TEXT,
  binding_type       binding_type NOT NULL DEFAULT 'perfect',
  trim_size          TEXT,
  num_pages          INTEGER,
  paper_type         TEXT,
  cover_paper_type   TEXT,
  inner_printing     colour_mode,
  cover_printing     colour_mode,
  cover_lamination   lamination_option,
  notes              TEXT,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS books_title_idx ON books (title);

CREATE TRIGGER books_updated_at
  BEFORE UPDATE ON books
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read books"
  ON books FOR SELECT TO authenticated USING (true);

CREATE POLICY "Manager mutate books"
  ON books FOR ALL TO authenticated
  USING (get_user_role() = 'manager')
  WITH CHECK (get_user_role() = 'manager');

-- 2. Link orders to the catalog + track the title + where it came from.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES books(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS order_source TEXT NOT NULL DEFAULT 'public';

COMMENT ON COLUMN orders.book_id IS
  'Link to the books catalog entry. NULL for public-form orders.';
COMMENT ON COLUMN orders.title IS
  'Book title copy. NULL for public-form orders.';
COMMENT ON COLUMN orders.order_source IS
  'public | amazon | saiacs_store | whatsapp | direct | other';

-- 3. Let manager + bookstore INSERT orders (internal reprints).
-- Anon INSERT via the public form stays untouched.
CREATE POLICY "Staff create orders"
  ON orders FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('manager', 'bookstore'));

-- 4. Bookstore needs to read + update its own internal orders while they're
--    still pre-production. Existing manager policies already allow full access.
CREATE POLICY "Bookstore reads internal orders"
  ON orders FOR SELECT TO authenticated
  USING (
    get_user_role() = 'bookstore'
    AND order_source <> 'public'
  );

CREATE POLICY "Bookstore updates pre-production internal orders"
  ON orders FOR UPDATE TO authenticated
  USING (
    get_user_role() = 'bookstore'
    AND order_source <> 'public'
    AND status IN ('new', 'confirmed')
  );
