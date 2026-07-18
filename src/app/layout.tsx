import type { Metadata } from "next";
import { DM_Sans, Source_Serif_4 } from "next/font/google";

import { parsePublicEnvironment } from "@/shared/config/public-environment";

import "./globals.css";

const dmSans = DM_Sans({
  display: "swap",
  preload: true,
  subsets: ["latin", "latin-ext"],
  variable: "--font-dm-sans",
  weight: ["400", "700"],
});

const sourceSerif = Source_Serif_4({
  display: "swap",
  preload: true,
  subsets: ["latin", "latin-ext"],
  variable: "--font-source-serif",
  weight: ["400", "700"],
});

const publicEnvironment = parsePublicEnvironment({
  NEXT_PUBLIC_SITE_NAME: process.env.NEXT_PUBLIC_SITE_NAME,
});

export const metadata: Metadata = {
  title: {
    default: publicEnvironment.siteName,
    template: `%s | ${publicEnvironment.siteName}`,
  },
  description: "Lisanslı filmler için Türkçe seçki ve izleme platformu.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${dmSans.variable} ${sourceSerif.variable}`}
      data-scroll-behavior="smooth"
      lang="tr"
    >
      <body>{children}</body>
    </html>
  );
}
