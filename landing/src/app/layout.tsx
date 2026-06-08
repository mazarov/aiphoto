import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { GenerationProvider } from "@/context/GenerationContext";
import { PromptCardModalProvider } from "@/context/PromptCardModalContext";
import { AuthModal } from "@/components/AuthModal";
import { GenerationModal } from "@/components/GenerationModal";
import { ClientCardModal } from "@/components/ClientCardModal";
import { YandexMetrikaRouteTracker } from "@/components/YandexMetrikaRouteTracker";
import { HOMEPAGE_SEO } from "@/lib/homepage-seo-copy";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: HOMEPAGE_SEO.title,
  description: HOMEPAGE_SEO.description,
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
  // Keyboard opens in top sheet — avoid shrinking layout viewport (stale dvh dock gap on iOS).
  interactiveWidget: "overlays-content",
};

export default function RootLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={inter.className}>
      <body className="min-h-screen bg-white text-zinc-900 antialiased">
        <AuthProvider>
            <GenerationProvider>
              <PromptCardModalProvider>
                <Suspense fallback={null}>
                  <YandexMetrikaRouteTracker />
                </Suspense>
                {children}
                {modal}
                <ClientCardModal />
                <GenerationModal />
              </PromptCardModalProvider>
            </GenerationProvider>
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
