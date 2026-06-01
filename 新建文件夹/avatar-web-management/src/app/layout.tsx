import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import Script from 'next/script';
import ThemeProvider from '@/components/providers/ThemeProvider';
import PerformanceMonitor from '@/components/monitoring/PerformanceMonitor';
import CookieConsent from '@/components/common/CookieConsent';
import './globals.css';

const geist = Geist({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-geist',
});
const geistMono = Geist_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-geist-mono',
});

export const metadata: Metadata = {
  title: 'AstralFox Market - AI桌面宠伴侣 + 创作者市场',
  description: 'AI桌面宠物市场：发现、购买、分享Live2D模型、人格卡、语音包和动画',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${geist.variable} ${geistMono.variable}`}>
      <body className="font-sans">
        <Script
          src="https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js"
          strategy="afterInteractive"
        />
        <NextIntlClientProvider messages={messages} locale={locale}>
          <ThemeProvider>
            <PerformanceMonitor />
            {children}
            <CookieConsent />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
