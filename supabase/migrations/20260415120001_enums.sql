-- Custom types per spec §4.1

CREATE TYPE order_status AS ENUM (
  'new', 'under_review', 'quoted', 'confirmed',
  'in_production', 'ready', 'shipped', 'picked_up',
  'invoiced', 'closed', 'cancelled'
);

CREATE TYPE production_status AS ENUM (
  'not_started', 'started', 'in_progress',
  'sample_approval', 'full_production', 'completed'
);

CREATE TYPE binding_type AS ENUM (
  'perfect', 'saddle', 'wiro', 'comb', 'document', 'other'
);

CREATE TYPE delivery_method AS ENUM ('pickup', 'courier');
CREATE TYPE colour_mode AS ENUM ('bw', 'colour');
CREATE TYPE paper_usage AS ENUM ('text', 'cover', 'special');
CREATE TYPE lamination_option AS ENUM ('glossy', 'matte', 'velvet', 'none');
CREATE TYPE file_type AS ENUM ('inner_pages', 'cover_page', 'print_file');
CREATE TYPE user_role AS ENUM ('manager', 'production', 'bookstore');
CREATE TYPE payment_terms AS ENUM ('prepay', 'credit');
