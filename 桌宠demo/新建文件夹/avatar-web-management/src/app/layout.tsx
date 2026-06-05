import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import Script from 'next/script';
import ThemeProvider from '@/components/providers/ThemeProvider';
import PerformanceMonitor from '@/components/monitoring/PerformanceMonitor';
import NetworkStatusIndicator from '@/components/monitoring/NetworkStatusIndicator';
import CookieConsent from '@/components/common/CookieConsent';
import './globals.css';        // Tailwind + design tokens + Ant Design overrides (source of truth)
import '@/styles/global.scss';  // BEM reset + supplementary styles

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
        {/* Service Worker registration — progressive enhancement, non-blocking */}
        <Script id="register-sw" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').catch(function() {
                  // SW registration failed — app still works without it
                });
              });
            }
          `}
        </Script>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <ThemeProvider>
            <PerformanceMonitor />
            {children}
            <CookieConsent />
            <NetworkStatusIndicator />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
