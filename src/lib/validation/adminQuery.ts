/**
 * Zod schema for the admin celebrations list query string.
 *
 * Accepts comma-separated multi-select for `status` and `type`, plus optional
 * `activate_at` range filters. Sort keys are strictly enumerated so we never
 * stitch user input into SQL column names.
 */

import { z } from 'zod';

const STATUS_VALUES = ['pending', 'active', 'inactive'] as const;
const TYPE_VALUES = ['birthday', 'expression'] as const;
const SORT_VALUES = ['created_at', 'activate_at', 'expires_at', 'approved_at', 'view_count'] as const;
const ORDER_VALUES = ['asc', 'desc'] as const;

const csv = <T extends readonly string[]>(options: T) =>
  z
    .string()
    .optional()
    .transform((s) => (s ? s.split(',') : []))
    .pipe(z.array(z.enum(options as unknown as [T[number], ...T[number][]])));

export const AdminListQuerySchema = z.object({
  status: csv(STATUS_VALUES),
  type: csv(TYPE_VALUES),
  q: z.string().max(100).optional(),
  activateFrom: z.string().datetime().optional(),
  activateTo: z.string().datetime().optional(),
  sort: z.enum(SORT_VALUES).default('created_at'),
  order: z.enum(ORDER_VALUES).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export type AdminListQuery = z.infer<typeof AdminListQuerySchema>;
