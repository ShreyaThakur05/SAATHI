import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/components/ThemeToggle";
import { Providers } from "./providers";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const deva = Noto_Sans_Devanagari({ variable: "--font-deva", subsets: ["devanagari"] });

export const metadata: Metadata = {
  title: "Paytm Saathi: problems solved, not just answered",
  description:
    "An AI teammate for support teams that checks the systems, takes the fix within the rules, and proves it worked.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0a1f3c" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${deva.variable} h-full`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
