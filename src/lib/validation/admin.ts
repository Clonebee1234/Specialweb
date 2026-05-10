/**
 * Zod schemas for the mutating admin endpoints.
 * Import site: app/api/admin/celebrations/[id]/route.ts and siblings.
 */

import { z } from 'zod';
import { PhotoSchema, QuizQuestionSchema, ThemeSchema } from '@/lib/validation/shared';

/** POST /api/admin/celebrations/:id/approve — empty body. */
export const ApproveSchema = z.object({}).optional();

export const RejectSchema = z.object({
  admin_notes: z.string().max(2000).optional(),
});

/** POST /api/admin/celebrations/:id/reset-passcode — no input required. */
export const ResetPasscodeSchema = z.object({}).optional();

/**
 * PATCH /api/admin/celebrations/:id
 * All fields are optional; present ones are validated against the same limits
 * used at creation. `status` cannot be flipped to 'pending' or 'deleted' here
 * (approval goes through its own endpoint; permanent delete through DELETE).
 */
export const PatchCelebrationSchema = z
  .object({
    recipient_name: z.string().min(1).max(100).optional(),
    creator_name: z.string().min(1).max(100).optional(),
    relationship: z.string().min(1).max(50).optional(),
    theme: ThemeSchema.optional(),

    hero_text: z.string().min(1).max(150).optional(),
    reasons: z.array(z.string().min(1).max(150)).min(5).max(10).optional(),
    quiz_questions: z.array(QuizQuestionSchema).length(5).optional(),
    final_message: z.string().min(1).max(800).optional(),

    confession_message: z.string().min(1).max(1500).optional(),
    things_i_notice: z.array(z.string().min(1).max(150)).min(3).max(5).optional(),
    closing_line: z.string().min(1).max(200).optional(),

    photos: z.array(PhotoSchema).optional(),
    song_url: z.string().url().nullable().optional(),
    admin_notes: z.string().max(2000).nullable().optional(),

    status: z.enum(['active', 'inactive']).optional(),
    extend_hours: z.number().int().min(1).max(168).optional(),
  })
  .strict();

export type PatchCelebrationInput = z.infer<typeof PatchCelebrationSchema>;

export const PermanentDeleteSchema = z.object({
  /** The admin types the short_code back to confirm destructive action. */
  confirmShortCode: z.string().min(6).max(8),
});

export const LoginSchema = z.object({
  password: z.string().min(1).max(200),
});

export const SettingsPatchSchema = z
  .object({
    default_activation_window_hours: z.number().int().min(1).max(168).optional(),
    maintenance_mode: z.boolean().optional(),
    admin_password_current: z.string().optional(),
    admin_password_new: z.string().min(8).max(200).optional(),
  })
  .strict();
