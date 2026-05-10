/**
 * `CreateCelebrationSchema` — the full payload accepted by POST /api/celebrations.
 *
 * Uses a discriminated union on `type` so TypeScript can narrow exhaustively:
 * birthday content fields are required iff type='birthday' and vice versa.
 *
 * The `superRefine` at the bottom enforces the theme-for-type allowlist
 * (Requirement 2.4) and the 15-minute minimum activation offset
 * (Requirement 5.3). Both are cross-field rules that a plain object schema
 * can't express on its own.
 */

import { z } from 'zod';
import {
  BIRTHDAY_THEMES,
  EXPRESSION_THEMES,
  PasscodeSchema,
  PhotoSchema,
  QuizQuestionSchema,
  RelationshipSchema,
  ThemeSchema,
} from '@/lib/validation/shared';

const MIN_OFFSET_MS = 15 * 60 * 1000;

const BirthdayShape = z.object({
  type: z.literal('birthday'),
  hero_text: z.string().min(1).max(150),
  reasons: z.array(z.string().min(1).max(150)).min(5).max(10),
  quiz_questions: z.array(QuizQuestionSchema).length(5),
  final_message: z.string().min(1).max(800),
  photos: z.array(PhotoSchema).min(3).max(7),
});

const ExpressionShape = z.object({
  type: z.literal('expression'),
  confession_message: z.string().min(1).max(1500),
  things_i_notice: z.array(z.string().min(1).max(150)).min(3).max(5),
  closing_line: z.string().min(1).max(200),
  photos: z.array(PhotoSchema).min(2).max(4),
});

const CommonShape = z.object({
  recipient_name: z.string().min(1).max(100),
  creator_name: z.string().min(1).max(100),
  relationship: RelationshipSchema,
  theme: ThemeSchema,
  passcode: PasscodeSchema,
  activate_at: z.string().datetime({ offset: true }),
  song_url: z.string().url().nullable().optional(),
});

export const CreateCelebrationSchema = z
  .discriminatedUnion('type', [
    BirthdayShape.merge(CommonShape),
    ExpressionShape.merge(CommonShape),
  ])
  .superRefine((v, ctx) => {
    const allowed =
      v.type === 'birthday'
        ? (BIRTHDAY_THEMES as readonly string[])
        : (EXPRESSION_THEMES as readonly string[]);
    if (!allowed.includes(v.theme)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['theme'],
        message: 'THEME_NOT_ALLOWED_FOR_TYPE',
      });
    }
    const activateMs = Date.parse(v.activate_at);
    if (Number.isNaN(activateMs)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['activate_at'],
        message: 'INVALID_DATETIME',
      });
      return;
    }
    if (activateMs < Date.now() + MIN_OFFSET_MS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['activate_at'],
        message: 'ACTIVATE_AT_TOO_SOON',
      });
    }
  });

export type CreateCelebrationInput = z.infer<typeof CreateCelebrationSchema>;
