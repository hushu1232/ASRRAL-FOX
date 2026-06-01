'use client';

import { useTranslations } from 'next-intl';

export default function SkipToMain() {
  const t = useTranslations('a11y');

  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[9999] focus:px-4 focus:py-2 focus:rounded-md focus:no-underline focus:font-medium"
      style={{
        background: 'var(--accent)',
        color: '#ffffff',
      }}
    >
      {t('skipToMain')}
    </a>
  );
}
