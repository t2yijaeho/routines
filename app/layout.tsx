import type { Metadata, Viewport } from "next";
import { Noto_Serif, Work_Sans, Space_Mono } from "next/font/google";
import "./globals.css";

const notoSerif = Noto_Serif({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  style: ["normal", "italic"],
  variable: "--font-headline",
  display: "swap",
});

const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Motive — Routine Builder",
  description:
    "Build a private movement routine from animated strength, flexibility, isometric and cardio components.",
  applicationName: "Motive",
  keywords: [
    "routine builder",
    "strength",
    "flexibility",
    "isometric",
    "cardio",
    "calisthenics",
  ],
  category: "fitness",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    siteName: "Motive",
    title: "Motive — Move with a plan",
    description:
      "Assemble strength, mobility, holds and cardio into a clear routine that stays on your device.",
  },
  twitter: {
    card: "summary",
    title: "Motive — Move with a plan",
    description:
      "A private, animated movement library and physical routine builder.",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f3f0e8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${notoSerif.variable} ${workSans.variable} ${spaceMono.variable}`}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
