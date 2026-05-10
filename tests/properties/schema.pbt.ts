// Feature: celebrate-them, Property 5: Fifteen-minute minimum activation offset
// Feature: celebrate-them, Property 17: Theme allowlist by type
// Feature: celebrate-them, Property 18: Birthday content shape (subset)
// Feature: celebrate-them, Property 19: Expression content shape (subset)
// Validates: Requirements 27.13, 5.3, 2.2, 2.3, 2.4, 27.3, 3.1, 27.4, 4.1

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { CreateCelebrationSchema } from '@/lib/validation/createCelebration';
import {
  ALL_THEMES,
  BIRTHDAY_THEMES,
  EXPRESSION_THEMES,
  RELATIONSHIPS,
  MIN_ACTIVATION_OFFSET_MINUTES,
} from '@/lib/constants';

function validBirthdayPayload(overrides: Record<string, unknown> = {}) {
  return {
    type: 'birthday',
    theme: 'confetti-burst',
    recipient_name: 'Sam',
    creator_name: 'Alex',
    relationship: 'Partner',
    passcode: '1234',
    activate_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    hero_text: 'The one who lights up every room.',
    reasons: ['A', 'B', 'C', 'D', 'E'],
    quiz_questions: Array.from({ length: 5 }).map((_, i) => ({
      prompt: `Q${i}`,
      options: ['a', 'b', 'c', 'd'],
      correctIndex: 0,
    })),
    final_message: 'Happy birthday.',
    photos: [
      { url: 'https://x/celebrations/tmp_abc/photo_1.webp', caption: '', order: 1 },
      { url: 'https://x/celebrations/tmp_abc/photo_2.webp', caption: '', order: 2 },
      { url: 'https://x/celebrations/tmp_abc/photo_3.webp', caption: '', order: 3 },
    ],
    ...overrides,
  };
}

function validExpressionPayload(overrides: Record<string, unknown> = {}) {
  return {
    type: 'expression',
    theme: 'midnight-letters',
    recipient_name: 'Sam',
    creator_name: 'Alex',
    relationship: 'Crush',
    passcode: '1234',
    activate_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    confession_message: 'Hi there.',
    things_i_notice: ['a', 'b', 'c'],
    closing_line: 'Will you be mine?',
    photos: [
      { url: 'https://x/celebrations/tmp_xyz/photo_1.webp', caption: '', order: 1 },
      { url: 'https://x/celebrations/tmp_xyz/photo_2.webp', caption: '', order: 2 },
    ],
    ...overrides,
  };
}

describe('Property 5: Fifteen-minute minimum activation offset', () => {
  it('rejects activate_at that is fewer than 15 minutes from now', () => {
    fc.assert(
      fc.property(fc.integer({ min: -120, max: 14 }), (minutesFromNow) => {
        const iso = new Date(Date.now() + minutesFromNow * 60 * 1000).toISOString();
        const res = CreateCelebrationSchema.safeParse(
          validBirthdayPayload({ activate_at: iso }),
        );
        expect(res.success).toBe(false);
      }),
      { numRuns: 50 },
    );
  });

  it('accepts activate_at at or beyond the 15-minute cutoff', () => {
    fc.assert(
      fc.property(fc.integer({ min: MIN_ACTIVATION_OFFSET_MINUTES + 1, max: 1000 }), (minutesFromNow) => {
        const iso = new Date(Date.now() + minutesFromNow * 60 * 1000).toISOString();
        const res = CreateCelebrationSchema.safeParse(
          validBirthdayPayload({ activate_at: iso }),
        );
        expect(res.success).toBe(true);
      }),
      { numRuns: 50 },
    );
  });
});

describe('Property 17: Theme allowlist by type', () => {
  it('birthday payloads only accept birthday themes', () => {
    for (const theme of ALL_THEMES) {
      const res = CreateCelebrationSchema.safeParse(validBirthdayPayload({ theme }));
      expect(res.success).toBe((BIRTHDAY_THEMES as readonly string[]).includes(theme));
    }
  });
  it('expression payloads only accept expression themes', () => {
    for (const theme of ALL_THEMES) {
      const res = CreateCelebrationSchema.safeParse(validExpressionPayload({ theme }));
      expect(res.success).toBe((EXPRESSION_THEMES as readonly string[]).includes(theme));
    }
  });
});

describe('Property 18: Birthday content shape (subset)', () => {
  it('accepts valid counts 5..10 for reasons and 3..7 for photos', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 10 }),
        fc.integer({ min: 3, max: 7 }),
        (reasonCount, photoCount) => {
          const reasons = Array.from({ length: reasonCount }).map((_, i) => `R${i}`);
          const photos = Array.from({ length: photoCount }).map((_, i) => ({
            url: `https://x/celebrations/tmp_abc/photo_${i + 1}.webp`,
            caption: '',
            order: i + 1,
          }));
          const res = CreateCelebrationSchema.safeParse(
            validBirthdayPayload({ reasons, photos }),
          );
          expect(res.success).toBe(true);
        },
      ),
      { numRuns: 40 },
    );
  });

  it('rejects reasons<5 or reasons>10, or photos<3 or photos>7', () => {
    const badReasons = [...Array(4)].map((_, i) => `R${i}`);
    const res = CreateCelebrationSchema.safeParse(validBirthdayPayload({ reasons: badReasons }));
    expect(res.success).toBe(false);

    const badPhotos = [
      { url: 'https://x/celebrations/tmp_abc/photo_1.webp', caption: '', order: 1 },
      { url: 'https://x/celebrations/tmp_abc/photo_2.webp', caption: '', order: 2 },
    ];
    const res2 = CreateCelebrationSchema.safeParse(validBirthdayPayload({ photos: badPhotos }));
    expect(res2.success).toBe(false);
  });
});

describe('Property 19: Expression content shape (subset)', () => {
  it('accepts 3..5 notices and 2..4 photos; rejects out-of-bound counts', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 5 }),
        fc.integer({ min: 2, max: 4 }),
        (noticeCount, photoCount) => {
          const things_i_notice = Array.from({ length: noticeCount }).map((_, i) => `T${i}`);
          const photos = Array.from({ length: photoCount }).map((_, i) => ({
            url: `https://x/celebrations/tmp_abc/photo_${i + 1}.webp`,
            caption: '',
            order: i + 1,
          }));
          const res = CreateCelebrationSchema.safeParse(
            validExpressionPayload({ things_i_notice, photos }),
          );
          expect(res.success).toBe(true);
        },
      ),
      { numRuns: 40 },
    );

    const tooFew = validExpressionPayload({ things_i_notice: ['a', 'b'] });
    expect(CreateCelebrationSchema.safeParse(tooFew).success).toBe(false);

    const tooMany = validExpressionPayload({
      things_i_notice: ['a', 'b', 'c', 'd', 'e', 'f'],
    });
    expect(CreateCelebrationSchema.safeParse(tooMany).success).toBe(false);
  });
});

describe('Relationship enum smoke check', () => {
  it('only accepts the documented set', () => {
    for (const r of RELATIONSHIPS) {
      const res = CreateCelebrationSchema.safeParse(validBirthdayPayload({ relationship: r }));
      expect(res.success).toBe(true);
    }
    const res = CreateCelebrationSchema.safeParse(
      validBirthdayPayload({ relationship: 'Coworker' }),
    );
    expect(res.success).toBe(false);
  });
});
