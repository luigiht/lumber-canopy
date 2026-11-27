import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { DM_Sans } from 'next/font/google';
import { SITE, SITE_URL } from '@/config/site';
import './globals.css';

/** Pixelta: the game's display pixel font, for headings and buttons (calls to action). */
const pixelta = localFont({
  src: './fonts/Pixelta.ttf',
  variable: '--font-pixelta',
  display: 'block',
});

/** DM Sans: clean, highly readable body font for text and form fields. */
const bodyFont = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});

// Icons (favicon.ico, icon.png, apple-icon.png) and share images (opengraph-image.jpg,
// twitter-image.jpg) are files in app/, which Next.js links automatically.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE.name}: ${SITE.tagline}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: [...SITE.keywords],
  category: 'games',
  creator: SITE.name,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: SITE.name,
    title: `${SITE.name}: ${SITE.tagline}`,
    description: SITE.description,
    locale: SITE.locale,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE.name}: ${SITE.tagline}`,
    description: SITE.description,
  },
  robots: { index: true, follow: true },
  appleWebApp: { capable: true, title: SITE.shortName, statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: SITE.themeColor,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={SITE.language} className={`${pixelta.variable} ${bodyFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
