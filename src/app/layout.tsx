import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/geist-latin.woff2",
  display: "swap",
  weight: "100 900",
  variable: "--font-geist-sans",
});

const geistMono = localFont({
  src: "./fonts/geist-mono-latin.woff2",
  display: "swap",
  weight: "100 900",
  variable: "--font-geist-mono",
});

const title = "QuickExit — Trade it. Profit. Send it home.";
const description =
  "Explore QuickExit, a crypto trading product concept built around one trade, your profit target, and a clear exit back to your bank. Interactive prototype.";
const socialImage = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "QuickExit. Trade it. Profit. Send it home. Crypto trading product concept.",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://quickexit.net"),
  applicationName: "QuickExit",
  title,
  description,
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: "https://quickexit.net/",
    siteName: "QuickExit",
    title,
    description,
    images: [socialImage],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [socialImage],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
