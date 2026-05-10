import type { Config } from 'tailwindcss';

/**
 * Tailwind config wired to CSS custom properties defined in src/styles/themes.css
 * (added in Phase 14). Each theme class (e.g. `theme-golden-glow`) overrides
 * these variables, so utilities like `bg-bg-a` or `text-accent-1` always resolve
 * against the currently active theme.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-a': 'var(--bg-a)',
        'bg-b': 'var(--bg-b)',
        'accent-1': 'var(--accent-1)',
        'accent-2': 'var(--accent-2)',
        'accent-3': 'var(--accent-3)',
        'text-primary': 'var(--text-primary)',
        'text-muted': 'var(--text-muted)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        body: ['var(--font-body)', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 40px -8px var(--accent-1)',
      },
    },
  },
  plugins: [],
};

export default config;
