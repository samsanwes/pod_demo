import { z } from 'zod';

export const BINDING_TYPES = ['perfect', 'saddle', 'wiro', 'comb', 'document', 'other'] as const;

/**
 * Friendly labels shown in the public form. These map 1:1 to the DB enum values
 * but with a more descriptive name like "Perfect Binding (Book Printing)".
 * 'comb' is kept in the enum for legacy/manual use but hidden from the public select.
 */
export const BINDING_LABELS: Record<(typeof BINDING_TYPES)[number], string> = {
  perfect: 'Perfect Binding (Book Printing)',
  saddle: 'Center Pinning / Saddle Stitch (Booklet Printing)',
  wiro: 'Wiro Binding (Workbook Printing)',
  comb: 'Comb Binding',
  document: 'Document Printing',
  other: 'Other',
};

export const BINDING_OPTIONS_PUBLIC = [
  'perfect',
  'saddle',
  'wiro',
  'document',
  'other',
] as const;

/** Bindings that are "book-like" — they use the Book Spec step (trim size, pages, cover, lamination). */
export const BOOK_LIKE_BINDINGS: readonly string[] = ['perfect', 'saddle'];

export const DELIVERY_METHODS = ['pickup', 'courier'] as const;
export const COLOUR_MODES = ['bw', 'colour'] as const;
export const LAMINATION_OPTIONS = ['glossy', 'matte', 'velvet', 'none'] as const;

export const TRIM_SIZES = ['A4', 'A5', 'A6', 'Custom 5.5x8.5', 'Custom 6x9', 'other'] as const;
export const PAPER_SIZES = ['A3', 'A4', 'A5', 'Letter', 'Legal', 'other'] as const;

/** Sentinel string for "I don't know — please recommend". Stored as-is in the DB. */
export const NOT_SURE_PAPER = 'Not sure — please recommend';

export const TEXT_PAPER_OPTIONS = [
  'Maplitho 70gsm',
  'Maplitho 80gsm',
  'Bond 100gsm',
  NOT_SURE_PAPER,
] as const;

export const COVER_PAPER_OPTIONS = [
  'Art Card 220gsm',
  'Art Card 250gsm',
  'Art Card 300gsm',
  'Sun Board 350gsm',
  NOT_SURE_PAPER,
] as const;

export const step1Schema = z
  .object({
    client_name: z.string().min(2, 'Name is required'),
    client_email: z.string().email('Valid email required'),
    client_phone: z.string().min(7, 'Phone is required'),
    client_organization: z.string().min(2, 'Organisation is required'),
    binding_type: z.enum(BINDING_TYPES),
    binding_type_other: z.string().optional(),
    quantity: z.number().int().min(1, 'At least 1 copy'),
    delivery_date: z.string().min(1, 'Delivery date required'),
    delivery_method: z.enum(DELIVERY_METHODS),
    delivery_address: z.string().optional(),
    special_instructions: z.string().optional(),
  })
  .refine((v) => v.binding_type !== 'other' || (v.binding_type_other && v.binding_type_other.length > 1), {
    message: 'Describe the binding type',
    path: ['binding_type_other'],
  })
  .refine((v) => v.delivery_method !== 'courier' || (v.delivery_address && v.delivery_address.length > 4), {
    message: 'Courier needs a delivery address',
    path: ['delivery_address'],
  });

export const bookSpecSchema = z
  .object({
    trim_size: z.enum(TRIM_SIZES),
    trim_size_other: z.string().optional(),
    num_pages: z.number().int().min(1, 'Page count required'),
    paper_type: z.string().min(1, 'Text paper required'),
    cover_paper_type: z.string().min(1, 'Cover paper required'),
    cover_printing: z.enum(COLOUR_MODES),
    inner_printing: z.enum(COLOUR_MODES),
    cover_lamination: z.enum(LAMINATION_OPTIONS),
  })
  .refine((v) => v.trim_size !== 'other' || (v.trim_size_other && v.trim_size_other.length > 1), {
    message: 'Describe the trim size',
    path: ['trim_size_other'],
  });

export const printSpecSchema = z
  .object({
    printing_type: z.array(z.enum(COLOUR_MODES)).min(1, 'Choose at least one colour option'),
    printing_sides: z.enum(['single', 'double']),
    paper_size: z.enum(PAPER_SIZES),
    paper_size_other: z.string().optional(),
  })
  .refine((v) => v.paper_size !== 'other' || (v.paper_size_other && v.paper_size_other.length > 1), {
    message: 'Describe the paper size',
    path: ['paper_size_other'],
  });

export type Step1Values = z.infer<typeof step1Schema>;
export type BookSpecValues = z.infer<typeof bookSpecSchema>;
export type PrintSpecValues = z.infer<typeof printSpecSchema>;

export interface UploadedFileMeta {
  file_type: 'inner_pages' | 'cover_page' | 'print_file';
  file_name: string;
  storage_path: string;
  file_size_bytes: number;
  mime_type: string;
}
