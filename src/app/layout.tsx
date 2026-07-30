import type { Metadata, Viewport } from "next";
import { Anton, Cormorant_Garamond, Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/context/auth-context";
import { QueryProvider } from "@/components/providers/query-provider";
import { AppModeBanner } from "@/components/shared/app-mode-banner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Club-poster display face — landing/marketing headlines only. */
const anton = Anton({
  weight: "400",
  variable: "--font-anton",
  subsets: ["latin"],
});

/** Serif "voice" face — italic descriptive/atmospheric copy (menu descriptions,
    empty-state invitations, editorial lines). */
const cormorant = Cormorant_Garamond({
  weight: ["500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "NightLifeNext — Nightclub Operations, Reimagined",
    template: "%s · NightLifeNext",
  },
  description:
    "QR ordering, table service, and live operations for nightclubs and lounges.",
};

export const viewport: Viewport = {
  themeColor: "#1a1410",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${anton.variable} ${cormorant.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {/* Dark is the brand default; light is opt-in via the header toggle. */}
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <AppModeBanner />
          <TooltipProvider>
            <QueryProvider>
              <AuthProvider>{children}</AuthProvider>
            </QueryProvider>
          </TooltipProvider>
          <Toaster position="top-center" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
