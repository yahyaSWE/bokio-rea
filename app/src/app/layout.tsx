import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getSession } from "@/lib/auth";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Huvudbok",
  description: "Bokföring, fakturering och moms för småföretag",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6f3" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0e0d" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Användarens val av tema; "system" (eller utloggad) följer operativsystemet.
  const theme = (await getSession())?.user.theme;
  return (
    <html lang="sv" data-theme={theme === "light" || theme === "dark" ? theme : undefined}>
      <body className={`${geist.variable} ${geistMono.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
