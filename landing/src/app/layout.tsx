import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { DebugProvider } from "@/components/DebugFAB";
import { AuthProvider } from "@/context/AuthContext";
import { AuthModal } from "@/components/AuthModal";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Промты для фото ИИ — готовые промпты для генерации фото",
  description:
    "Готовые промты для фото: девушки, пары, дети, студийное, чёрно-белое. Копируй и используй в ИИ для создания фото.",
  viewport: "width=device-width, initial-scale=1, viewport-fit=cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={inter.className}>
      <body className="min-h-screen bg-white text-zinc-900 antialiased">
        <AuthProvider>
          <DebugProvider>{children}</DebugProvider>
          <AuthModal />
        </AuthProvider>
      </body>
    </html>
  );
}
