/**
 * Hand-written Supabase types matching the schema defined in
 * `supabase/migrations/0001_init.sql` + `0003_settings.sql`.
 *
 * In a fuller setup you'd generate this with `supabase gen types typescript`,
 * but a hand-written version keeps us independent of the CLI in CI and
 * matches exactly what the server code expects.
 */

export type CelebrationType = 'birthday' | 'expression';
export type CelebrationStatus = 'pending' | 'active' | 'inactive' | 'deleted';

export type PhotoRow = {
  url: string;
  caption: string;
  order: number;
};

export type QuizQuestion = {
  prompt: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
};

export type CelebrationRow = {
  id: string;
  short_code: string;
  passcode: string;
  passcode_version: number;

  type: CelebrationType;
  status: CelebrationStatus;
  theme: string;

  recipient_name: string;
  creator_name: string;
  relationship: string;
  song_url: string | null;
  photos: PhotoRow[];

  hero_text: string | null;
  reasons: string[] | null;
  quiz_questions: QuizQuestion[] | null;
  final_message: string | null;

  confession_message: string | null;
  things_i_notice: string[] | null;
  closing_line: string | null;

  expression_reply: string | null;
  expression_reply_downloaded: boolean;

  activate_at: string;
  expires_at: string;
  created_at: string;

  approved_at: string | null;
  approved_by: string | null;
  admin_notes: string | null;
  times_reactivated: number;
  last_viewed_at: string | null;
  view_count: number;
};

export type CelebrationInsert = Omit<
  CelebrationRow,
  | 'id'
  | 'created_at'
  | 'approved_at'
  | 'approved_by'
  | 'admin_notes'
  | 'times_reactivated'
  | 'last_viewed_at'
  | 'view_count'
  | 'expression_reply'
  | 'expression_reply_downloaded'
  | 'passcode_version'
> & {
  id?: string;
  passcode_version?: number;
};

export type CelebrationUpdate = Partial<CelebrationRow>;

export type SettingsRow = {
  key: string;
  value: unknown;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      celebrations: {
        Row: CelebrationRow;
        Insert: CelebrationInsert;
        Update: CelebrationUpdate;
      };
      settings: {
        Row: SettingsRow;
        Insert: { key: string; value: unknown; updated_at?: string };
        Update: Partial<SettingsRow>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
