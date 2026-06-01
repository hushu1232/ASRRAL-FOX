import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['zh-CN', 'en', 'ja'],
  defaultLocale: 'zh-CN',
  localeDetection: true,
});
