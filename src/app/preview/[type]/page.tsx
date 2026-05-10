/**
 * /preview/[type] — local-only preview of the recipient experience.
 *
 * Renders the RecipientExperience with sample data so you can see the
 * template without having to create and approve a real celebration. The
 * theme can be overridden via `?theme=...`.
 *
 * NOT meant for production users. Hide behind a robots.txt / auth wall
 * before going live if you want, though no real data ever touches this page.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RecipientExperience } from '@/components/experience/RecipientExperience';
import {
  type PreviewTheme,
  getBirthdayPreview,
  getExpressionPreview,
} from '@/lib/previewData';
import { BIRTHDAY_THEMES, EXPRESSION_THEMES } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export default function PreviewPage({
  params,
  searchParams,
}: {
  params: { type: string };
  searchParams: { theme?: string };
}) {
  if (params.type !== 'birthday' && params.type !== 'expression') notFound();

  const themes = params.type === 'birthday' ? BIRTHDAY_THEMES : EXPRESSION_THEMES;
  const theme = (themes as readonly string[]).includes(searchParams.theme ?? '')
    ? (searchParams.theme as PreviewTheme)
    : (themes[0] as PreviewTheme);

  const payload =
    params.type === 'birthday' ? getBirthdayPreview(theme) : getExpressionPreview(theme);

  return (
    <>
      <PreviewToolbar type={params.type} theme={theme} />
      <RecipientExperience shortCode="preview" previewPayload={payload} />
    </>
  );
}

function PreviewToolbar({ type, theme }: { type: string; theme: PreviewTheme }) {
  const themes = type === 'birthday' ? BIRTHDAY_THEMES : EXPRESSION_THEMES;
  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-black/80 px-4 py-2 text-xs text-text-muted backdrop-blur">
      <div className="flex items-center gap-3">
        <span className="rounded bg-accent-1/20 px-2 py-0.5 font-mono text-accent-1">
          PREVIEW
        </span>
        <span>Sample data — no backend required</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span>Theme:</span>
        {themes.map((t) => (
          <Link
            key={t}
            href={`/preview/${type}?theme=${t}`}
            className={`rounded border px-2 py-0.5 ${
              t === theme
                ? 'border-accent-1 bg-accent-1/20 text-accent-1'
                : 'border-white/15 hover:border-white/40'
            }`}
          >
            {t}
          </Link>
        ))}
        <span className="mx-2 text-white/20">|</span>
        <Link
          href={type === 'birthday' ? '/preview/expression' : '/preview/birthday'}
          className="rounded border border-white/15 px-2 py-0.5 hover:border-white/40"
        >
          Switch to {type === 'birthday' ? 'expression' : 'birthday'}
        </Link>
        <Link href="/" className="text-text-muted underline hover:text-text-primary">
          Exit preview
        </Link>
      </div>
    </div>
  );
}
