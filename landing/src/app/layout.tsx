import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { FeatureAccessProvider } from "@/context/FeatureAccessContext";
import { GenerationProvider } from "@/context/GenerationContext";
import { PromptCardModalProvider } from "@/context/PromptCardModalContext";
import { FotoVPromtMobileModalProvider } from "@/context/FotoVPromtMobileModalContext";
import { GenerateMobileModalProvider } from "@/context/GenerateMobileModalContext";
import { GenerateDockProvider } from "@/context/GenerateDockContext";
import { AuthModal } from "@/components/AuthModal";
import { GenerationModal } from "@/components/GenerationModal";
import { ClientCardModal } from "@/components/ClientCardModal";
import { FotoVPromtMobileModal } from "@/components/foto-v-promt/FotoVPromtMobileModal";
import { GenerateMobileModal } from "@/components/generate/GenerateMobileModal";
import { YandexMetrikaRouteTracker } from "@/components/YandexMetrikaRouteTracker";
import { HOMEPAGE_SEO } from "@/lib/homepage-seo-copy";
import { YANDEX_METRIKA_COUNTER_ID } from "@/lib/yandex-metrika";

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
  // Early connection to the Supabase / imgproxy image origin — shaves ~100 ms off
  // the first card image request (DNS + TLS handshake done before fetch).
  const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

  return (
    <html lang="ru" className={inter.className}>
      <head>
        {supabaseOrigin && (
          <link rel="preconnect" href={supabaseOrigin} crossOrigin="anonymous" />
        )}
        <Script id="yandex-metrika-queue" strategy="beforeInteractive">{`
          (function(m,i,max){
            if(typeof m[i]!=="function"){
              var queue=function(){
                var items=queue.a=queue.a||[];
                items.push(arguments);
                if(items.length>max+1){items.splice(1,items.length-(max+1));}
              };
              queue.a=[];
              queue.l=1*new Date();
              m[i]=queue;
            }
          })(window,"ym",100);
          ym(${YANDEX_METRIKA_COUNTER_ID},"init",{ssr:true,webvisor:true,clickmap:true,ecommerce:"dataLayer",referrer:document.referrer,url:location.href,accurateTrackBounce:true,trackLinks:true});
        `}</Script>
      </head>
      <body className="min-h-screen bg-white text-zinc-900 antialiased">
        <AuthProvider>
          <FeatureAccessProvider>
            <GenerationProvider>
              <PromptCardModalProvider>
                <FotoVPromtMobileModalProvider>
                  <GenerateMobileModalProvider>
                    <GenerateDockProvider>
                      <Suspense fallback={null}>
                        <YandexMetrikaRouteTracker />
                      </Suspense>
                      {children}
                      {modal}
                      <ClientCardModal />
                      <FotoVPromtMobileModal />
                      <GenerateMobileModal />
                      <GenerationModal />
                    </GenerateDockProvider>
                  </GenerateMobileModalProvider>
                </FotoVPromtMobileModalProvider>
              </PromptCardModalProvider>
            </GenerationProvider>
          </FeatureAccessProvider>
          <AuthModal />
        </AuthProvider>

        <Script id="yandex-metrika-loader" strategy="lazyOnload">{`
          (function(e,t,r,k,a){
            for(var j=0;j<e.scripts.length;j++){if(e.scripts[j].src===r){return;}}
            k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a);
          })(document,"script","https://mc.yandex.ru/metrika/tag.js?id=${YANDEX_METRIKA_COUNTER_ID}");
        `}</Script>
        <noscript>
          <div>
            {/* Yandex noscript pixel — must stay a raw <img>, not next/image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://mc.yandex.ru/watch/${YANDEX_METRIKA_COUNTER_ID}`} style={{position:"absolute",left:"-9999px"}} alt="" />
          </div>
        </noscript>
      </body>
    </html>
  );
}
