/**
 * Sample payloads for the `/preview/*` routes.
 *
 * These let you see the recipient experience without a database. They use
 * public-domain placeholder images and plausible-looking content so the
 * layout, theming, and flow are all visible.
 *
 * Not shipped to the live recipient bundle; only the preview pages import this.
 */

export type PreviewTheme =
  | 'confetti-burst'
  | 'golden-glow'
  | 'neon-night'
  | 'starry-dream'
  | 'midnight-letters'
  | 'soft-bloom'
  | 'warm-sunset';

export type PreviewPayload = {
  type: 'birthday' | 'expression';
  theme: PreviewTheme;
  recipient_name: string;
  creator_name: string;
  relationship: string;
  song_url: string | null;
  photos: Array<{ url: string; caption: string; order: number }>;
  hero_text?: string;
  reasons?: string[];
  quiz_questions?: Array<{
    prompt: string;
    options: [string, string, string, string];
    correctIndex: number;
  }>;
  final_message?: string;
  confession_message?: string;
  things_i_notice?: string[];
  closing_line?: string;
};

const SAMPLE_PHOTOS = [
  'https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=1200&q=80',
  'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=1200&q=80',
  'https://images.unsplash.com/photo-1531956531700-dc0ee0f1f9a5?w=1200&q=80',
  'https://images.unsplash.com/photo-1464207687429-7505649dae38?w=1200&q=80',
  'https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?w=1200&q=80',
];

export function getBirthdayPreview(theme: PreviewTheme = 'confetti-burst'): PreviewPayload {
  return {
    type: 'birthday',
    theme,
    recipient_name: 'Alex',
    creator_name: 'Sam',
    relationship: 'Partner',
    song_url: null,
    photos: SAMPLE_PHOTOS.slice(0, 4).map((url, i) => ({
      url,
      caption: [
        'That time on the pier',
        'Coffee, always coffee',
        'The morning we stayed in',
        'You, laughing at nothing',
      ][i]!,
      order: i + 1,
    })),
    hero_text: 'The one who lights up every room without even trying.',
    reasons: [
      'You make ordinary days feel like celebrations.',
      'Your laugh is the best part of every room.',
      'You remember the tiniest things about people.',
      'You cook without a recipe and it still works.',
      'You tell the truth, gently.',
      'You make me braver than I think I am.',
    ],
    quiz_questions: [
      {
        prompt: 'What did I order on our first date?',
        options: ['Espresso', 'Cappuccino', 'Iced matcha', 'Just water'],
        correctIndex: 2,
      },
      {
        prompt: "Which city have we said we'd move to someday?",
        options: ['Lisbon', 'Kyoto', 'Reykjavík', 'Mexico City'],
        correctIndex: 1,
      },
      {
        prompt: "What's my go-to late-night snack?",
        options: ['Popcorn', 'Chocolate', 'Noodles', 'Nothing, I sleep'],
        correctIndex: 0,
      },
      {
        prompt: 'Favorite season?',
        options: ['Spring', 'Summer', 'Autumn', 'Winter'],
        correctIndex: 2,
      },
      {
        prompt: 'What word do I overuse?',
        options: ['Literally', 'Honestly', 'Basically', 'Actually'],
        correctIndex: 1,
      },
    ],
    final_message: `Alex,

Thank you for being exactly who you are.

You've made the last year feel lighter than any before it. I don't know what I did to deserve your quiet, steady, wonderful presence — but I'm grateful every day.

Happy birthday. Here's to more mornings with you, more quiet laughs, more nothing-in-particular evenings that turn out to be everything.

Yours,
Sam`,
  };
}

export function getExpressionPreview(theme: PreviewTheme = 'midnight-letters'): PreviewPayload {
  return {
    type: 'expression',
    theme,
    recipient_name: 'Alex',
    creator_name: 'Sam',
    relationship: 'Crush',
    song_url: null,
    photos: SAMPLE_PHOTOS.slice(0, 3).map((url, i) => ({
      url,
      caption: ['That evening on the rooftop', 'Walking home in the rain', 'You, reading'][i]!,
      order: i + 1,
    })),
    confession_message: `I've been holding onto this for a while.

Every time I try to explain what you mean to me, the words come out smaller than the feeling. So I'm going to stop trying to make it sound clever.

You are my favorite person to think about. You are the voice I hear when I'm trying to be brave. You are the thing I want to come home to at the end of a tired day.

I love you. I have for a long time. I just wanted you to know.`,
    things_i_notice: [
      'The way your eyes narrow a little when you are thinking hard about something kind.',
      'How you always remember what people said three conversations ago.',
      "The way you hold a mug with both hands when you're tired.",
      'How you laugh quietly at your own jokes before anyone else can.',
    ],
    closing_line: 'I just wanted you to know.',
  };
}
