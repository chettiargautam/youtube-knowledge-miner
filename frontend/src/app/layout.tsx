import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { ThemeInitScript } from "@/components/theme/theme-init-script";
import { ThemeSync } from "@/components/theme/theme-sync";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "YT Knowledge Base Miner",
  description:
    "Turn any YouTube channel into a searchable topic-specific knowledge base.",
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
        {children}
      </body>
    </html>
  );
}
