import type { Metadata } from "next";
import { Nunito, DM_Sans } from "next/font/google";
import "./globals.css";

// Nunito for display: rounded, warm, and legible at large sizes — it carries the
// headings without feeling clinical, which matters for an app used one-handed by
// a parent holding a baby.
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

// DM Sans for body: a neutral companion with a tall x-height, so small labels and
// amenity chips stay readable on a phone.
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nursing Room Finder — Singapore",
  description:
    "Find nursing rooms and breastfeeding spaces near you across Singapore.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${nunito.variable} ${dmSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
