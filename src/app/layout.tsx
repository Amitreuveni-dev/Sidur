import type { Metadata, Viewport } from 'next';
import { Rubik } from 'next/font/google';
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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl" className={rubik.variable}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="bg-slate-900 font-rubik text-white antialiased min-h-screen">
        <main className="mx-auto max-w-md min-h-screen pb-24">
          {children}
        </main>
      </body>
    </html>
  );
}
