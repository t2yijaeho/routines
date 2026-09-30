import type { Metadata, Viewport } from "next";
import "./globals.css";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
