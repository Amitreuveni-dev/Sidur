import type { Metadata, Viewport } from 'next';
import { Rubik } from 'next/font/google';
import { ThemeProvider } from '@/lib/themeContext';
import './globals.css';

const rubik = Rubik({
  subsets: ['hebrew', 'latin'],
  display: 'swap',
  variable: '--font-rubik',
});

export const metadata: Metadata = {
  title: 'סידור - ניו דלהי',
  description: 'ניהול משמרות לסניף ניו דלהי, צור הדסה',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'סידור',
  },
};

export const viewport: Viewport = {
  themeColor: '#3b82f6',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl" className={rubik.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('sidur_theme')||'dark';document.documentElement.classList.add(t);})();`,
          }}
        />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="bg-warm-100 dark:bg-slate-900 font-rubik text-slate-900 dark:text-white antialiased min-h-screen">
        <ThemeProvider>
          <main className="mx-auto max-w-md min-h-screen pb-[calc(6rem+env(safe-area-inset-bottom))]">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
