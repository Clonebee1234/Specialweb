/** Unlock + reply input schemas. */

import { z } from 'zod';
import { PasscodeSchema } from '@/lib/validation/shared';

export const UnlockSchema = z.object({
  passcode: PasscodeSchema,
});

export const ReplySchema = z.object({
  replyText: z.string().trim().min(1).max(200),
});

export type UnlockInput = z.infer<typeof UnlockSchema>;
export type ReplyInput = z.infer<typeof ReplySchema>;
