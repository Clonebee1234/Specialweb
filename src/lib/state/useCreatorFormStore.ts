/**
 * Creator form state (Zustand + persist sessionStorage).
 *
 * Persisted key: `ct_creator_v1`.
 * Scope: one tab (sessionStorage). We intentionally do NOT use localStorage —
 * we don't want someone's form draft to leak across windows or outlive the
 * session.
 *
 * The store holds the in-flight form values plus the upload manifest (URLs
 * returned from /api/upload/*). Raw `File` objects are NOT persisted; if the
 * user navigates away and back, they keep their uploaded URLs but must
 * re-select any files that hadn't yet been uploaded.
 */

'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  BIRTHDAY_THEMES as _BT,
  EXPRESSION_THEMES as _ET,
} from '@/lib/validation/shared';
import type { CelebrationType, PhotoRow } from '@/lib/supabase/types';

type Theme = typeof _BT[number] | typeof _ET[number];

export type QuizQuestionDraft = {
  prompt: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
};

export type CreatorFormState = {
  draftToken: string;
  type: CelebrationType | null;
  theme: Theme | null;
  basics: {
    recipient_name: string;
    creator_name: string;
    relationship: string;
  };
  birthday: {
    hero_text: string;
    reasons: string[];
    quiz_questions: QuizQuestionDraft[];
    final_message: string;
  };
  expression: {
    confession_message: string;
    things_i_notice: string[];
    closing_line: string;
  };
  timing: {
    passcode: string;
    passcodeConfirm: string;
    activate_at: string; // local datetime string ('YYYY-MM-DDTHH:mm') — converted to ISO on submit
  };
  media: {
    photos: PhotoRow[];
    song_url: string | null;
  };
  submitResult: {
    shortCode: string;
    passcode: string;
    activate_at: string;
    expires_at: string;
  } | null;
};

function emptyQuiz(): QuizQuestionDraft {
  return { prompt: '', options: ['', '', '', ''], correctIndex: 0 };
}

const initialState: CreatorFormState = {
  draftToken: '',
  type: null,
  theme: null,
  basics: { recipient_name: '', creator_name: '', relationship: 'Partner' },
  birthday: {
    hero_text: '',
    reasons: ['', '', '', '', ''],
    quiz_questions: [emptyQuiz(), emptyQuiz(), emptyQuiz(), emptyQuiz(), emptyQuiz()],
    final_message: '',
  },
  expression: {
    confession_message: '',
    things_i_notice: ['', '', ''],
    closing_line: "I've been meaning to tell you...",
  },
  timing: {
    passcode: '',
    passcodeConfirm: '',
    activate_at: '',
  },
  media: { photos: [], song_url: null },
  submitResult: null,
};

type Actions = {
  setType: (t: CelebrationType) => void;
  setTheme: (t: Theme) => void;
  setBasics: (b: Partial<CreatorFormState['basics']>) => void;
  setBirthday: (b: Partial<CreatorFormState['birthday']>) => void;
  setExpression: (e: Partial<CreatorFormState['expression']>) => void;
  setTiming: (t: Partial<CreatorFormState['timing']>) => void;
  setMedia: (m: Partial<CreatorFormState['media']>) => void;
  ensureDraftToken: () => string;
  setSubmitResult: (r: CreatorFormState['submitResult']) => void;
  reset: () => void;
};

export const useCreatorFormStore = create<CreatorFormState & Actions>()(
  persist(
    (set, get) => ({
      ...initialState,
      setType: (t) => set({ type: t }),
      setTheme: (t) => set({ theme: t }),
      setBasics: (b) => set((s) => ({ basics: { ...s.basics, ...b } })),
      setBirthday: (b) => set((s) => ({ birthday: { ...s.birthday, ...b } })),
      setExpression: (e) => set((s) => ({ expression: { ...s.expression, ...e } })),
      setTiming: (t) => set((s) => ({ timing: { ...s.timing, ...t } })),
      setMedia: (m) => set((s) => ({ media: { ...s.media, ...m } })),
      ensureDraftToken: () => {
        const current = get().draftToken;
        if (current) return current;
        const token =
          'tmp_' +
          (typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID().replace(/-/g, '').slice(0, 20)
            : Math.random().toString(36).slice(2, 22));
        set({ draftToken: token });
        return token;
      },
      setSubmitResult: (r) => set({ submitResult: r }),
      reset: () => set({ ...initialState, draftToken: '' }),
    }),
    {
      name: 'ct_creator_v1',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
