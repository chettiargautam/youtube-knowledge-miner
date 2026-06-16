import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { ThemeInitScript } from "@/components/theme/theme-init-script";
import { ThemeSync } from "@/components/theme/theme-sync";
import { CursorSpotlight } from "@/components/ui/cursor-spotlight";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "YT Knowledge Base Miner",
  description:
    "Turn any YouTube channel into a searchable topic-specific knowledge base.",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeInitScript />
      </head>
      <body className={`${inter.variable} antialiased`}>
        <ThemeSync />
        <CursorSpotlight />
        {children}
      </body>
    </html>
  );
}
