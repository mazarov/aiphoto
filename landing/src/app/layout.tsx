import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import "./globals.css";
import { DebugProvider } from "@/components/DebugFAB";
import { AuthProvider } from "@/context/AuthContext";
import { GenerationProvider } from "@/context/GenerationContext";
import { AuthModal } from "@/components/AuthModal";
import { GenerationModal } from "@/components/GenerationModal";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Промты для фото ИИ — готовые промпты для генерации фото",
  description:
    "Готовые промты для фото: девушки, пары, дети, студийное, чёрно-белое. Копируй и используй в ИИ для создания фото.",
  manifest: "/site.webmanifest",
  robots: {
    index: true,
    follow: true,
    "max-image-preview": "large" as const,
    "max-snippet": -1,
    "max-video-preview": -1,
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
          <DebugProvider>
            <GenerationProvider>
              {children}
              <GenerationModal />
            </GenerationProvider>
          </DebugProvider>
          <AuthModal />
        </AuthProvider>

        <Script id="yandex-metrika" strategy="lazyOnload">{`
          (function(m,e,t,r,i,k,a){
            m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
            m[i].l=1*new Date();
            for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}
            k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
          })(window,document,'script','https://mc.yandex.ru/metrika/tag.js?id=107703100','ym');
          ym(107703100,'init',{ssr:true,webvisor:true,clickmap:true,ecommerce:"dataLayer",referrer:document.referrer,url:location.href,accurateTrackBounce:true,trackLinks:true});
        `}</Script>
        <noscript>
          <div>
            {/* Yandex noscript pixel — must stay a raw <img>, not next/image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://mc.yandex.ru/watch/107703100" style={{position:"absolute",left:"-9999px"}} alt="" />
          </div>
        </noscript>
      </body>
    </html>
  );
}
