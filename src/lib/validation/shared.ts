/**
 * Shared validation primitives used across every Zod schema in this folder.
 *
 * This file re-exports enum lists from `@/lib/constants` so schemas and UI
 * stay in lockstep. Changing a theme list or character limit happens in one
 * place (`constants.ts`) and every dependent validator updates automatically.
 */

import { z } from 'zod';
import {
  ALL_THEMES,
  BIRTHDAY_THEMES,
  CHAR_LIMITS,
  EXPRESSION_THEMES,
  PASSCODE_REGEX,
  RELATIONSHIPS,
} from '@/lib/constants';

export { ALL_THEMES, BIRTHDAY_THEMES, EXPRESSION_THEMES, RELATIONSHIPS };

export const PhotoSchema = z.object({
  url: z.string().url(),
  caption: z.string().max(CHAR_LIMITS.caption).default(''),
  order: z.number().int().min(1),
});

export const QuizQuestionSchema = z.object({
  prompt: z.string().min(1).max(CHAR_LIMITS.quiz_prompt),
  options: z.tuple([
    z.string().min(1).max(CHAR_LIMITS.quiz_option),
    z.string().min(1).max(CHAR_LIMITS.quiz_option),
    z.string().min(1).max(CHAR_LIMITS.quiz_option),
    z.string().min(1).max(CHAR_LIMITS.quiz_option),
  ]),
  correctIndex: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
});

export type PhotoInput = z.infer<typeof PhotoSchema>;
export type QuizQuestionInput = z.infer<typeof QuizQuestionSchema>;

export const ThemeSchema = z.enum(ALL_THEMES);
export const RelationshipSchema = z.enum(RELATIONSHIPS);

export const PasscodeSchema = z
  .string()
  .regex(PASSCODE_REGEX, 'Passcode must be exactly 4 digits');
